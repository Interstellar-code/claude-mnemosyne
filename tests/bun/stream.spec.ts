// EVT.1: one shared reader of /api/activity/stream. A fake api drives it — no
// real fetch, no token — and two subscribers must share one poll.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createStream, STREAM_BACKOFF_MAX_MS, takeLines } from '../../ui/stream'
import type { StreamApi } from '../../ui/stream'
import { ROOT } from './helpers'

/** A fake api: one open stream per call, each controllable by the test. */
function fakeApi() {
  const calls: string[] = []
  const controllers: ReadableStreamDefaultController<Uint8Array>[] = []
  const api: StreamApi = async (path, init) => {
    calls.push(path)
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError')
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controllers.push(controller)
      },
    })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } })
  }
  const push = (text: string) => controllers[controllers.length - 1]?.enqueue(new TextEncoder().encode(text))
  const end = () => controllers[controllers.length - 1]?.close()
  return { api, calls, push, end, controllers }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

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

  test('EVT.1.a1: the reconnect backoff is bounded, as app.ts follow()', () => {
    expect(STREAM_BACKOFF_MAX_MS).toBe(30_000)
  })

  test('EVT.1.a4: ui/stream.ts imports nothing from ui/app.ts, and a fake api carries its requests', async () => {
    const source = readFileSync(join(ROOT, 'ui', 'stream.ts'), 'utf8')
    const imports = [...source.matchAll(/^\s*import[^\n]*from\s+['"]([^'"]+)['"]/gm)].map(match => match[1]!)
    expect(imports.some(path => path.includes('app'))).toBe(false)
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
