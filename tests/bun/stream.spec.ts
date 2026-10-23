// EVT.1: one shared reader of /api/activity/stream. A fake api drives it — no
// real fetch, no token — and two subscribers must share one poll.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createStream, STREAM_CATCHUP, takeLines } from '../../ui/stream'
import type { StreamApi, StreamTimers } from '../../ui/stream'
import { ROOT } from './helpers'

type Activity = { lines: Record<string, unknown>[]; cursor: string; off?: boolean }

/** A fake api: one open stream per stream call, each controllable by the test; /api/activity answers `activity`. */
function fakeApi(activity: () => Activity = () => ({ lines: [], cursor: '1:0' })) {
  const calls: string[] = []
  const signals: (AbortSignal | undefined)[] = []
  const cancelled: string[] = []
  const controllers: ReadableStreamDefaultController<Uint8Array>[] = []
  const api: StreamApi = async (path, init) => {
    calls.push(path)
    signals.push(init?.signal)
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    if (path.startsWith('/api/activity?')) return Response.json({ off: false, ...activity() })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controllers.push(controller)
      },
      cancel() {
        cancelled.push(path)
      },
    })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } })
  }
  const push = (text: string) => controllers[controllers.length - 1]?.enqueue(new TextEncoder().encode(text))
  const end = () => controllers[controllers.length - 1]?.close()
  return { api, calls, signals, cancelled, push, end, controllers }
}

/** Timers the test fires by hand: each backoff wait is recorded with its length. */
function fakeTimers() {
  const waits: { ms: number; run: () => void; done: boolean }[] = []
  const timers: StreamTimers = {
    set(run, ms) {
      const wait = { ms, run, done: false }
      waits.push(wait)
      return wait
    },
    clear(handle) {
      ;(handle as { done: boolean }).done = true
    },
  }
  /** Ends the oldest open wait, as its timer would. */
  const fire = () => {
    const wait = waits.find(item => !item.done)
    if (wait === undefined) throw new Error('no wait is open')
    wait.done = true
    wait.run()
  }
  return { timers, waits, fire }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))
const settle = async () => {
  for (let i = 0; i < 6; i++) await tick()
}
const line = (t: string) => ({ t, action: 'recall', ok: true, ids: [t] })
const ndjson = (...lines: object[]) => lines.map(item => `${JSON.stringify(item)}\n`).join('')

describe('EVT.1: createStream', () => {
  test('EVT.1.a1: the reader polls /api/activity/stream and hands each line to its subscribers', async () => {
    const fake = fakeApi()
    const stream = createStream({ api: fake.api })
    const seen: Record<string, unknown>[] = []
    stream.subscribe(line => seen.push(line))
    await tick()
    expect(fake.calls).toEqual(['/api/activity/stream'])
    fake.push('{"t":"t1","action":"recall","ids":["a"]}\n{"t":"t2","action":"remember","ids":["b"]}\n')
    await tick()
    expect(seen.map(line => line.t)).toEqual(['t1', 't2'])
    expect(stream.status()).toBe('live')
    stream.close()
  })

  test('EVT.1.a3: two subscribers share one poll; the stream closes when the last leaves', async () => {
    const fake = fakeApi()
    const stream = createStream({ api: fake.api })
    const one: Record<string, unknown>[] = []
    const two: Record<string, unknown>[] = []
    const offOne = stream.subscribe(line => one.push(line))
    stream.subscribe(line => two.push(line))
    await tick()
    expect(fake.calls).toHaveLength(1)
    expect(stream.polls()).toBe(1)
    fake.push('{"t":"t","action":"update","ids":["x"]}\n')
    await tick()
    expect(one.map(line => line.t)).toEqual(['t'])
    expect(two.map(line => line.t)).toEqual(['t'])
    offOne()
    expect(stream.status()).toBe('live')
    stream.close()
  })

  test('EVT.1.a3: the cursor resumes the stream where the page left it', async () => {
    const fake = fakeApi()
    const stream = createStream({ api: fake.api, cursor: '7:120' })
    stream.subscribe(() => {})
    await tick()
    expect(fake.calls[0]).toBe('/api/activity/stream?cursor=7%3A120')
    stream.close()
  })

  test('EVT.1.a1: a 404 means the log is off, and the reader does not reconnect', async () => {
    let calls = 0
    const stream = createStream({
      api: async () => {
        calls++
        return new Response('{"error":"the activity log is off"}', { status: 404 })
      },
    })
    stream.subscribe(() => {})
    await tick()
    expect(stream.status()).toBe('off')
    expect(calls).toBe(1)
    stream.close()
  })

  test('EVT.1.a1: the reconnect backoff doubles from 1 s, stops growing at 30 s, and starts again after a live stream', async () => {
    let failing = true
    const fake = fakeApi()
    const api: StreamApi = async (path, init) => (failing ? new Response('down', { status: 500 }) : fake.api(path, init))
    const clock = fakeTimers()
    const stream = createStream({ api, timers: clock.timers })
    stream.subscribe(() => {})
    for (let i = 0; i < 8; i++) {
      await settle()
      expect(stream.status()).toBe('reconnecting')
      clock.fire()
    }
    await settle()
    expect(clock.waits.map(wait => wait.ms)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000, 30_000])
    // A stream that went live and then ended waits 1 s again.
    failing = false
    clock.fire()
    await settle()
    expect(stream.status()).toBe('live')
    fake.end()
    await settle()
    expect(clock.waits.at(-1)!.ms).toBe(1_000)
    stream.close()
  })

  test('EVT.1.a1: a reconnect re-reads /api/activity, follows its fresh cursor, and hands on each line once', async () => {
    const [l1, l2, l3, l4] = ['t1', 't2', 't3', 't4'].map(line)
    // While the reader was away the log gained t3 and t4; /api/activity answers newest first.
    const fake = fakeApi(() => ({ lines: [l4!, l3!, l2!, l1!], cursor: '9:500' }))
    const clock = fakeTimers()
    const stream = createStream({ api: fake.api, cursor: '7:120', timers: clock.timers })
    const seen: unknown[] = []
    stream.subscribe(item => seen.push(item.t))
    await settle()
    fake.push(ndjson(l1!, l2!))
    await settle()
    fake.end()
    await settle()
    expect(stream.status()).toBe('reconnecting')
    clock.fire()
    await settle()
    expect(fake.calls).toEqual(['/api/activity/stream?cursor=7%3A120', `/api/activity?limit=${STREAM_CATCHUP}`, '/api/activity/stream?cursor=9%3A500'])
    fake.push(ndjson(line('t5')))
    await settle()
    expect(seen).toEqual(['t1', 't2', 't3', 't4', 't5'])
    expect(stream.status()).toBe('live')
    stream.close()
  })

  test('EVT.1.a1: a reconnect with nothing delivered keeps its cursor and makes no extra read', async () => {
    const fake = fakeApi()
    const clock = fakeTimers()
    const stream = createStream({ api: fake.api, cursor: '7:120', timers: clock.timers })
    stream.subscribe(() => {})
    await settle()
    fake.end()
    await settle()
    clock.fire()
    await settle()
    expect(fake.calls).toEqual(['/api/activity/stream?cursor=7%3A120', '/api/activity/stream?cursor=7%3A120'])
    stream.close()
  })

  test('EVT.1.a3: unsubscribe and subscribe again in the same tick: the new listener gets the next line', async () => {
    const fake = fakeApi()
    const stream = createStream({ api: fake.api })
    const off = stream.subscribe(() => {})
    off()
    const seen: unknown[] = []
    stream.subscribe(item => seen.push(item.t))
    await settle()
    fake.push(ndjson(line('after')))
    await settle()
    expect(seen).toEqual(['after'])
    expect(stream.status()).toBe('live')
    stream.close()
  })

  test('EVT.1.a3: the request is aborted when the LAST subscriber leaves, not before', async () => {
    const fake = fakeApi()
    const stream = createStream({ api: fake.api })
    const offOne = stream.subscribe(() => {})
    const offTwo = stream.subscribe(() => {})
    await settle()
    expect(fake.signals).toHaveLength(1)
    offOne()
    expect(fake.signals[0]!.aborted).toBe(false)
    offTwo()
    expect(fake.signals[0]!.aborted).toBe(true)
    await settle()
    expect(fake.cancelled).toEqual(['/api/activity/stream'])
  })

  test('EVT.1.a1: a request that answers after the stop leaves the reader idle and its body cancelled', async () => {
    let answer = (_: Response) => {}
    let cancelled = false
    const api: StreamApi = () => new Promise(done => (answer = done))
    const stream = createStream({ api })
    stream.subscribe(() => {})
    await settle()
    stream.close()
    answer(new Response(new ReadableStream({ cancel: () => void (cancelled = true) }), { status: 200 }))
    await settle()
    expect(stream.status()).toBe('idle')
    expect(cancelled).toBe(true)
  })

  test('EVT.1.a5: an endless line past the buffer cap drops the connection', async () => {
    const fake = fakeApi()
    const clock = fakeTimers()
    const stream = createStream({ api: fake.api, timers: clock.timers })
    stream.subscribe(() => {})
    await settle()
    fake.push('x'.repeat(2_000_000))
    await settle()
    expect(stream.status()).toBe('reconnecting')
    expect(fake.cancelled).toEqual(['/api/activity/stream'])
    stream.close()
  })

  test('EVT.1.a4: ui/stream.ts imports nothing from ui/app.ts, and a fake api carries its requests', async () => {
    const source = readFileSync(join(ROOT, 'ui', 'stream.ts'), 'utf8')
    const imports = [...source.matchAll(/^\s*import[^\n]*from\s+['"]([^'"]+)['"]/gm)].map(match => match[1]!)
    // Each import resolved against ui/: none is ui/app or ui/app.ts (a name that merely contains 'app' is fine).
    const app = join(ROOT, 'ui', 'app')
    expect(imports.filter(path => path.startsWith('.') && [app, `${app}.ts`].includes(resolve(ROOT, 'ui', path)))).toEqual([])
    const fake = fakeApi()
    const stream = createStream({ api: fake.api })
    stream.subscribe(() => {})
    await tick()
    expect(fake.calls).toHaveLength(1)
    stream.close()
  })

  test('EVT.1.a5: takeLines yields whole lines only and keeps the rest', () => {
    const taken = takeLines('{"a":1}\n{"b":2}\n{"c":')
    expect(taken.lines).toEqual([{ a: 1 }, { b: 2 }])
    expect(taken.rest).toBe('{"c":')
    expect(takeLines('not json\n\n[1]\n').lines).toEqual([])
    expect(takeLines('{"a":1}').rest).toBe('{"a":1}')
  })
})
