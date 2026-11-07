// 0.27.2: the dashboard's one warm search engine (ui/warm-engine.ts). A fake process checks the protocol, the order,
// restarts, timeouts and the idle stop; a real engine on a temp store checks that each call answers as its own owner
// (engine change 21), which a process without MNEMOPI_OWNER_PER_CALL never does.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createWarmEngine, replyText, supportsOwnerPerCall, type WarmProcess, type WarmSpawn } from '../../ui/warm-engine'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'
import { isolatedEnv } from './helpers'

/** A process stand-in: what is written to stdin is recorded; `answer` sends a line on stdout; `exit` ends it. */
function fakeProcess() {
  const written: string[] = []
  let push: (line: string) => void = () => {}
  let close: () => void = () => {}
  let exit: (code: number) => void = () => {}
  let killed = false
  const stdout = new ReadableStream<Uint8Array>({
    start(controller) {
      push = line => controller.enqueue(new TextEncoder().encode(line))
      close = () => controller.close()
    },
  })
  const exited = new Promise<number>(resolve => {
    exit = code => {
      close()
      resolve(code)
    }
  })
  const proc: WarmProcess = {
    stdin: { write: (text: string) => written.push(text) },
    stdout,
    exited,
    kill: () => {
      killed = true
      exit(143)
    },
  }
  return { proc, written, answer: (id: number, text: string) => push(`${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } })}\n`), exit, killed: () => killed }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 5))

describe('the warm engine with a fake process', () => {
  test('a call carries the owner, answers come back by id, one call at a time, one process for all', async () => {
    const fakes: ReturnType<typeof fakeProcess>[] = []
    const envs: Record<string, string | undefined>[] = []
    const spawn: WarmSpawn = (_cmd, env) => {
      envs.push(env)
      const fake = fakeProcess()
      fakes.push(fake)
      return fake.proc
    }
    const warm = createWarmEngine({ cli: 'cli.ts', store: '/store', spawn, baseEnv: { PATH: 'x' } })
    const a = warm.call('project-a', ['mnemopi_recall', { query: 'q', limit: 5 }])
    const b = warm.call('project-b', ['mnemopi_recall', { query: 'q', limit: 5 }])
    await tick()
    // Only the first is sent until it is answered.
    expect(fakes).toHaveLength(1)
    expect(fakes[0]!.written).toHaveLength(1)
    const first = JSON.parse(fakes[0]!.written[0]!)
    expect(first).toMatchObject({ method: 'tools/call', params: { name: 'mnemopi_recall', arguments: { query: 'q', limit: 5, owner: 'project-a' } } })
    fakes[0]!.answer(first.id, '{"status":"ok","results":[]}')
    expect(await a).toBe('{"status":"ok","results":[]}')
    await tick()
    const second = JSON.parse(fakes[0]!.written[1]!)
    expect(second.params.arguments.owner).toBe('project-b')
    fakes[0]!.answer(second.id, 'B')
    expect(await b).toBe('B')
    expect(warm.starts()).toBe(1)
    // Its process takes the owner per call and runs with meaning search on.
    expect(envs[0]).toMatchObject({ MNEMOPI_OWNER_PER_CALL: '1', MNEMOPI_SESSION_ID: 'global', MNEMOPI_DATA_DIR: '/store', MNEMOPI_NO_EMBEDDINGS: '' })
    warm.stop()
  })

  test('a process that dies fails its call; the next call starts a new one', async () => {
    const fakes: ReturnType<typeof fakeProcess>[] = []
    const warm = createWarmEngine({
      cli: 'cli.ts',
      store: '/store',
      spawn: () => {
        const fake = fakeProcess()
        fakes.push(fake)
        return fake.proc
      },
    })
    const lost = warm.call('p', ['mnemopi_recall', { query: 'q' }])
    await tick()
    fakes[0]!.exit(1)
    expect(await lost).toBeInstanceOf(Error)
    expect(warm.running()).toBe(false)
    const next = warm.call('p', ['mnemopi_recall', { query: 'q' }])
    await tick()
    expect(fakes).toHaveLength(2)
    fakes[1]!.answer(JSON.parse(fakes[1]!.written[0]!).id, 'ok')
    expect(await next).toBe('ok')
    warm.stop()
  })

  test('a call past its time ends the process; an idle engine stops by itself', async () => {
    const fakes: ReturnType<typeof fakeProcess>[] = []
    const warm = createWarmEngine({
      cli: 'cli.ts',
      store: '/store',
      callTimeoutMs: 30,
      idleMs: 40,
      spawn: () => {
        const fake = fakeProcess()
        fakes.push(fake)
        return fake.proc
      },
    })
    const slow = await warm.call('p', ['mnemopi_recall', { query: 'q' }])
    expect(slow).toBeInstanceOf(Error)
    expect((slow as Error).message).toContain('did not answer')
    expect(fakes[0]!.killed()).toBe(true)
    const quick = warm.call('p', ['mnemopi_recall', { query: 'q' }])
    await tick()
    fakes[1]!.answer(JSON.parse(fakes[1]!.written[0]!).id, 'ok')
    expect(await quick).toBe('ok')
    expect(warm.running()).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 80))
    expect(warm.running()).toBe(false)
    expect(fakes[1]!.killed()).toBe(true)
  })

  test('replies and engine builds', () => {
    expect(replyText({ error: { message: 'boom' } })).toEqual(new Error('boom'))
    expect(replyText({ result: { content: [{ text: 'bad' }], isError: true } })).toEqual(new Error('bad'))
    expect(replyText({ result: { content: [{ text: 'fine' }] } })).toBe('fine')
    expect(supportsOwnerPerCall('18.12.3-mnemosyne.13')).toBe(true)
    expect(supportsOwnerPerCall('18.12.3-mnemosyne.20')).toBe(true)
    expect(supportsOwnerPerCall('18.12.3-mnemosyne.12')).toBe(false)
    expect(supportsOwnerPerCall('18.12.3')).toBe(false)
    expect(supportsOwnerPerCall(undefined)).toBe(false)
  })
})

describe('the warm engine on a real engine and temp store', () => {
  const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
  const temp = tempDir('warm-engine')
  const store = join(temp.dir, 'store')
  let a = ''
  let b = ''

  beforeAll(async () => {
    a = (body((await engineCall(CLI, store, 'project-a-1a2b', [toolCall(1, 'mnemopi_remember', { content: 'The heron nests by the quiet lake in spring.' })])).get(1)) as { memory_id: string }).memory_id
    b = (body((await engineCall(CLI, store, 'project-b-3c4d', [toolCall(1, 'mnemopi_remember', { content: 'A heron fishes at the lake every dawn.' })])).get(1)) as { memory_id: string }).memory_id
  }, 120_000)
  afterAll(() => temp.dispose())

  test('one process answers each call as the owner it names', async () => {
    const warm = createWarmEngine({ cli: CLI, store, embeddings: false, baseEnv: { ...(process.env as Record<string, string>), ...isolatedEnv('warm') } })
    try {
      const ids = async (owner: string) => {
        const text = await warm.call(owner, ['mnemopi_recall', { query: 'heron lake', limit: 5, update_recall_counts: false }])
        if (text instanceof Error) throw text
        return (JSON.parse(text).results as { id: string }[]).map(row => row.id)
      }
      expect(await ids('project-a-1a2b')).toEqual([a])
      expect(await ids('project-b-3c4d')).toEqual([b])
      expect(warm.starts()).toBe(1)
    } finally {
      warm.stop()
    }
  }, 120_000)

  test('without the flag a call cannot pick another owner', async () => {
    const replies = await engineCall(CLI, store, 'project-a-1a2b', [toolCall(1, 'mnemopi_recall', { query: 'heron lake', limit: 5, owner: 'project-b-3c4d', update_recall_counts: false })])
    expect((body(replies.get(1)).results as { id: string }[]).map(row => row.id)).toEqual([a])
  }, 120_000)
})
