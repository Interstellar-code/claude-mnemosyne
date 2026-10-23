// A small host for the register-level knowledge specs (KNOWX R2).
//
// `claude plugin test` runs hooks in a sandbox with no processes and no files,
// so a spec there can only fake bin/memories.ts and the engine (that is how the
// first KNOWX round shipped a wiring bug under green tests). This host loads the
// REAL hooks/register.ts and answers its host calls (`$.process.run`, `$.fs.*`,
// `$.env.get`) with the real thing over a temp HOME: the real engine
// (engine/src/cli.ts), the real bin/memories.ts and bin/activity.ts. The only
// stand-in is `$.model.complete`, because a model cannot run in a test.
//
// Import this file BEFORE anything that imports hooks/register.ts.
import { mock } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ENGINE_BUILD } from '../../hooks/engine-build'
import { ROOT } from './helpers'

// ---- the 'claude-code' runtime: only atom/read/update, kept per host ($) ----
type AtomKey = { plugin: string; key: string; initial: unknown }
mock.module('claude-code', () => ({
  atom: (id: { plugin: string; key: string }, initial: unknown) => ({ ...id, initial }) satisfies AtomKey,
  // Async like the real read, so two hooks running at once interleave as they do in the host.
  read: async ($: { atoms: Map<string, unknown> }, a: AtomKey) => {
    await Promise.resolve()
    return $.atoms.has(`${a.plugin}/${a.key}`) ? $.atoms.get(`${a.plugin}/${a.key}`) : a.initial
  },
  // The updater runs on the value as it is when the update lands: atomic, as the host's is.
  update: async ($: { atoms: Map<string, unknown> }, a: AtomKey, fn: (value: unknown) => unknown) => {
    await Promise.resolve()
    const next = fn($.atoms.has(`${a.plugin}/${a.key}`) ? $.atoms.get(`${a.plugin}/${a.key}`) : a.initial)
    $.atoms.set(`${a.plugin}/${a.key}`, next)
    return next
  },
}))

const registerPath = '../../hooks/register'
const registerModule = (await import(registerPath)) as {
  register: (on: unknown, options: Record<string, unknown>) => unknown
  [name: string]: unknown
}
export const hooks = registerModule

export type ModelRequest = { model: string; system?: string; prompt: string; maxTokens?: number; timeoutMs?: number; effort?: string }
export type ModelAnswer = { isAnswered: true; text: string } | { isAnswered: false; reason: string; status?: number | null; error?: string }
export type Ran = { argv: readonly string[]; stdin?: string; env?: Record<string, string>; startedAt: number; endedAt?: number; exitCode?: number }
type Handler = { event: string; filter: Record<string, unknown> | undefined; fn: (...args: any[]) => any }

export type HostOptions = {
  /** The model: called once per model.complete; the returned promise may stay open to hold the call. */
  model?: (request: ModelRequest, n: number, signal?: AbortSignal) => ModelAnswer | Promise<ModelAnswer>
  /** Plugin options (extractionModel, scope, activityLog, ...). */
  options?: Record<string, unknown>
  /** Values for $.env.get; HOME is always the temp home. */
  env?: Record<string, string>
  /** Install a fake engine of this build, so the stale-engine path is real. */
  engineBuild?: string
  /** Variables laid over the parent environment of every child process (a hostile shell). */
  parentEnv?: Record<string, string>
}

export type Host = Awaited<ReturnType<typeof makeHost>>

export async function makeHost(opts: HostOptions = {}) {
  const home = mkdtempSync(join(tmpdir(), 'mnemosyne-host-'))
  const root = join(home, '.claude', 'mnemosyne')
  const store = join(root, 'store')
  const pendingDir = join(root, 'knowledge-pending')
  const scope = join(root, 'engine', 'node_modules', '@oh-my-pi')
  mkdirSync(scope, { recursive: true })
  if (opts.engineBuild === undefined) {
    symlinkSync(join(ROOT, 'engine'), join(scope, 'pi-mnemopi'), 'dir')
  } else {
    mkdirSync(join(scope, 'pi-mnemopi', 'src'), { recursive: true })
    writeFileSync(join(scope, 'pi-mnemopi', 'package.json'), JSON.stringify({ name: '@oh-my-pi/pi-mnemopi', version: opts.engineBuild }))
    writeFileSync(join(scope, 'pi-mnemopi', 'src', 'cli.ts'), '')
  }

  const runs: Ran[] = []
  const model: { request: ModelRequest; startedAt: number; endedAt?: number }[] = []
  const handlers: Handler[] = []
  const env: Record<string, string> = { HOME: home, MNEMOSYNE_ACTIVITY_APPEND: 'await', ...(opts.env ?? {}) }

  async function runProcess(argv: readonly string[], init: { stdin?: string; env?: Record<string, string>; timeoutMs?: number } | undefined) {
    const record: Ran = { argv, stdin: init?.stdin, env: init?.env, startedAt: Date.now() }
    runs.push(record)
    // The host lays init.env over its own environment.
    const child = Bun.spawn([...argv], {
      env: { ...(process.env as Record<string, string>), ...(opts.parentEnv ?? {}), ...(init?.env ?? {}) },
      stdin: init?.stdin === undefined ? 'ignore' : new Blob([init.stdin]),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const timer = init?.timeoutMs === undefined ? undefined : setTimeout(() => child.kill(), init.timeoutMs)
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    if (timer !== undefined) clearTimeout(timer)
    record.endedAt = Date.now()
    record.exitCode = exitCode
    return { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false }
  }

  const $ = {
    atoms: new Map<string, unknown>(),
    plugin: { root: ROOT, name: 'mnemosyne' },
    env: { get: async (name: string) => env[name] ?? '' },
    session: { id: async () => 's1', repo: async () => ({ root: '/work/My Repo' }), cwd: async () => '/work/My Repo' },
    fs: {
      read: async (path: string) => readFileSync(path, 'utf8'),
      stat: async (path: string) => {
        const stat = statSync(path)
        return { kind: stat.isDirectory() ? 'directory' : 'file' }
      },
    },
    process: {
      run: (argv: readonly string[], init?: { stdin?: string; env?: Record<string, string>; timeoutMs?: number }) => runProcess(argv, init),
      spawn: async function* (init: { argv: readonly string[]; input?: string }) {
        await runProcess(init.argv, { stdin: init.input })
      },
    },
    ui: { log: () => undefined, status: () => undefined, toast: () => undefined, copy: () => undefined },
    clock: { sleep: async () => undefined },
    command: { register: async () => undefined },
    tool: { register: async () => undefined },
    model: {
      complete: async (request: ModelRequest, init?: { signal?: AbortSignal }) => {
        const n = model.length
        const entry = { request, startedAt: Date.now() } as (typeof model)[number]
        model.push(entry)
        const answer = opts.model ? await opts.model(request, n, init?.signal) : ({ isAnswered: true, text: '{}' } as ModelAnswer)
        entry.endedAt = Date.now()
        return answer.isAnswered ? { ...answer, usage: {} } : { status: null, error: 'unknown', ...answer, usage: {} }
      },
    },
  }

  const on = (event: string, a: unknown, b?: unknown) => {
    const fn = (typeof a === 'function' ? a : b) as Handler['fn']
    handlers.push({ event, filter: typeof a === 'function' ? undefined : (a as Record<string, unknown>), fn })
    return { catch: () => undefined }
  }
  registerModule.register(on, opts.options ?? {})

  const find = (event: string, match?: (filter: Record<string, unknown> | undefined) => boolean) => {
    const found = handlers.find(h => h.event === event && (match === undefined || match(h.filter)))
    if (found === undefined) throw new Error(`no ${event} handler`)
    return found.fn
  }
  const passThrough = (signal: AbortSignal = new AbortController().signal) => Object.assign(async (e: unknown) => e, { signal })

  const host = {
    $,
    home,
    root,
    store,
    pendingDir,
    runs,
    model,
    options: opts.options ?? {},
    /** A memory tool call as the host delivers it. */
    tool: async (name: string, input: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => {
      const fn = find('tool.call')
      return (await fn($, { tool: `mcp__mnemosyne__${name}`, ...input, ...extra })) as { result?: string; deny?: string }
    },
    /** A prompt submit, with the identity next. */
    prompt: async (text: string) => {
      const fn = find('prompt.submit')
      return fn($, { text, origin: { kind: 'composer' } }, passThrough())
    },
    turn: async (extra: Record<string, unknown> = {}) => {
      const fn = find('turn.complete')
      return fn($, { answer: 'done', turnId: 't1', durationMs: 1, isAborted: false, ...extra }, passThrough())
    },
    /** A slash command: /mnemosyne-knowledge [apply]. */
    command: async (command: string, args = '', signal?: AbortSignal) => {
      const fn = find('command.run', filter => String(filter?.command) === command)
      return (await fn($, { command, args }, passThrough(signal))) as { text: string }
    },
    /** The activity lines written so far. */
    activity: () => {
      try {
        return readFileSync(join(root, 'activity.jsonl'), 'utf8')
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line) as Record<string, any>)
      } catch {
        return []
      }
    },
    extractLines: () => host.activity().filter(line => line.action === 'extract'),
    /** The pending entry file names (empty when the folder is absent). */
    pending: () => {
      try {
        return readdirSync(pendingDir).filter(name => name.endsWith('.json')).sort()
      } catch {
        return []
      }
    },
    pendingEntry: (id: string) => JSON.parse(readFileSync(join(pendingDir, `${id}.json`), 'utf8')) as { id: string; owner: string; sha256: string },
    mode: (path: string) => (statSync(path).mode & 0o777).toString(8),
    /** Processes the hooks ran whose argv contains `needle` after the script name. */
    ran: (script: string) => runs.filter(run => String(run.argv[1] ?? '').endsWith(script)),
    /** The engine processes the hooks ran (`bun <cli> mcp`). */
    engineRuns: () => runs.filter(run => run.argv[2] === 'mcp'),
    /** The memories CLI commands the hooks ran: [command, ...] after the optional --store pair. */
    memoriesRuns: () => runs.filter(run => String(run.argv[1] ?? '').endsWith('/bin/memories.ts')),
    dispose: () => rmSync(home, { recursive: true, force: true }),
  }
  return host
}

/** Waits (real time) until `check` is truthy; rejects naming `what` after `ms`. */
export async function until<T>(what: string, check: () => T | undefined | false | Promise<T | undefined | false>, ms = 8_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const got = await check()
    if (got) return got
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await Bun.sleep(20)
  }
}

export const GOOD_REPLY = JSON.stringify({
  facts: ['Deploys happen on Fridays'],
  preferences: [],
  instructions: [],
  timelines: [],
  kg: [],
})

export { ENGINE_BUILD }
