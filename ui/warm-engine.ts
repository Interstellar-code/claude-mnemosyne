// 0.27.2: the dashboard's one warm search engine.
//
// A meaning search loads the embedding model in every engine process, and the dashboard used to start one
// process per project, so a search across all projects loaded the model about ten times (20-30 s). This keeps
// one engine process alive with the model loaded and asks it for each project in turn: the engine takes the
// owner from the call only because this process is started with MNEMOPI_OWNER_PER_CALL=1 (engine change 21);
// every other engine (hooks, the MCP launcher) has it cleared by engineEnv. Calls go one at a time, a call that
// takes too long or a process that dies ends the process (the next call starts a new one), and the process
// stops after `idleMs` without calls, so an idle dashboard holds no model in memory.
import { engineEnv, type EngineRequest } from '../hooks/engine'

/**
 * Whether an installed engine build takes the owner per call (change 21, build 18.12.3-mnemosyne.13). An older
 * engine ignores `owner` and would answer every project as the process's own owner, so the dashboard keeps one
 * process per owner for it.
 */
export function supportsOwnerPerCall(build: string | undefined): boolean {
  const local = /-mnemosyne\.(\d+)$/.exec(build ?? '')
  return local !== null && Number(local[1]) >= 13
}

export const WARM_IDLE_MS = 10 * 60_000
export const WARM_CALL_TIMEOUT_MS = 60_000

/** What spawning needs: Bun.spawn's shape, so a test can hand in a fake process. */
export type WarmProcess = {
  stdin: { write(text: string): unknown; end?(): unknown }
  stdout: ReadableStream<Uint8Array>
  stderr?: ReadableStream<Uint8Array>
  exited: Promise<number>
  kill(): void
}
export type WarmSpawn = (cmd: string[], env: Record<string, string | undefined>) => WarmProcess

export type WarmOptions = {
  cli: string
  store: string
  baseEnv?: Record<string, string | undefined>
  idleMs?: number
  callTimeoutMs?: number
  spawn?: WarmSpawn
  /** Meaning search on (the default: this engine exists for it); a test without the model turns it off. */
  embeddings?: boolean
}

export type WarmEngine = {
  /** One tool call as `owner`: the tool's text, or an Error. */
  call(owner: string, request: EngineRequest): Promise<string | Error>
  /** How many processes this engine has started (1 while one stays warm). */
  starts(): number
  running(): boolean
  stop(): void
}

type Reply = { id?: unknown; error?: { message?: string }; result?: { content?: { text?: string }[]; isError?: boolean } }

/** A JSON-RPC reply as the tool's text or an Error, as hooks/engine.ts parseReplies reads one. */
export function replyText(reply: Reply): string | Error {
  if (reply.error) return new Error(reply.error.message ?? 'engine error')
  const text = reply.result?.content?.[0]?.text ?? ''
  return reply.result?.isError ? new Error(text) : text
}

const defaultSpawn: WarmSpawn = (cmd, env) =>
  Bun.spawn(cmd, { env: env as Record<string, string>, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' }) as unknown as WarmProcess

export function createWarmEngine(options: WarmOptions): WarmEngine {
  const idleMs = options.idleMs ?? WARM_IDLE_MS
  const callTimeoutMs = options.callTimeoutMs ?? WARM_CALL_TIMEOUT_MS
  const spawn = options.spawn ?? defaultSpawn
  let child: WarmProcess | null = null
  let started = 0
  let nextId = 1
  let idle: ReturnType<typeof setTimeout> | null = null
  let queue: Promise<unknown> = Promise.resolve()
  let stderrTail = ''
  const pending = new Map<number, (answer: string | Error) => void>()

  const failAll = (why: string) => {
    for (const resolve of pending.values()) resolve(new Error(why))
    pending.clear()
  }

  function end(why: string) {
    const current = child
    child = null
    if (current !== null) {
      try {
        current.kill()
      } catch {
        // already gone
      }
    }
    failAll(why)
  }

  async function read(proc: WarmProcess) {
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for await (const chunk of proc.stdout as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true })
        let at = buffer.indexOf('\n')
        while (at >= 0) {
          const line = buffer.slice(0, at)
          buffer = buffer.slice(at + 1)
          at = buffer.indexOf('\n')
          let message: Reply
          try {
            message = JSON.parse(line) as Reply
          } catch {
            continue // engine chatter
          }
          const id = typeof message.id === 'number' ? message.id : Number.NaN
          const resolve = pending.get(id)
          if (resolve === undefined) continue
          pending.delete(id)
          resolve(replyText(message))
        }
      }
    } catch {
      // the stream ended with the process
    }
  }

  async function drain(stream: ReadableStream<Uint8Array> | undefined) {
    if (stream === undefined) return
    const decoder = new TextDecoder()
    try {
      for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) stderrTail = (stderrTail + decoder.decode(chunk, { stream: true })).slice(-600)
    } catch {
      // ended
    }
  }

  function ensure(): WarmProcess {
    if (child !== null) return child
    const env = { ...(options.baseEnv ?? process.env), ...engineEnv(options.store, 'global', { embeddings: options.embeddings !== false }), MNEMOPI_OWNER_PER_CALL: '1' }
    const proc = spawn([process.execPath, options.cli, 'mcp'], env)
    child = proc
    started++
    stderrTail = ''
    void read(proc)
    void drain(proc.stderr)
    void proc.exited.then(code => {
      if (child === proc) {
        child = null
        failAll(`engine exited ${code}: ${stderrTail.trim().slice(-300)}`)
      }
    })
    return proc
  }

  function armIdle() {
    if (idle !== null) clearTimeout(idle)
    idle = setTimeout(() => {
      idle = null
      if (pending.size === 0) end('idle')
    }, idleMs)
    // An idle timer must never keep the server (or a test) alive.
    ;(idle as { unref?: () => void }).unref?.()
  }

  function callNow(owner: string, [name, args]: EngineRequest): Promise<string | Error> {
    const proc = ensure()
    const id = nextId++
    return new Promise<string | Error>(resolve => {
      const timer = setTimeout(() => {
        if (!pending.has(id)) return
        pending.delete(id)
        resolve(new Error(`the warm engine did not answer within ${Math.round(callTimeoutMs / 1000)} s`))
        // A stuck engine is ended: the next call starts a new one.
        end('timed out')
      }, callTimeoutMs)
      pending.set(id, answer => {
        clearTimeout(timer)
        resolve(answer)
      })
      try {
        proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: { ...args, owner } } })}\n`)
      } catch (err) {
        pending.delete(id)
        clearTimeout(timer)
        end('write failed')
        resolve(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  return {
    call(owner, request) {
      // One call at a time, in order; a failed call does not stop the ones after it.
      const run = queue.then(() => callNow(owner, request))
      queue = run.catch(() => undefined)
      return run.finally(armIdle)
    },
    starts: () => started,
    running: () => child !== null,
    stop() {
      if (idle !== null) clearTimeout(idle)
      idle = null
      end('stopped')
    },
  }
}
