// The dashboard when its server goes away (ui/connection.ts and its use in ui/app.ts). A fake probe and
// fake timers drive the watch; the page-level test runs the real ui/app.ts over a stand-in document and a
// fetch that refuses, so the banner is read as the user would see it. No server, no sleep for the back-off.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createWatch, PROBE_BACKOFF_MAX_MS, PROBE_BACKOFF_MS } from '../../ui/connection'
import type { ProbeResult, WatchTimers } from '../../ui/connection'
import { ROOT } from './helpers'

/** Timers the test fires by hand: each wait is recorded with its length. */
function fakeTimers() {
  const waits: { ms: number; run: () => void; cleared: boolean; fired: boolean }[] = []
  const timers: WatchTimers = {
    set: (run, ms) => {
      const wait = { ms, run, cleared: false, fired: false }
      waits.push(wait)
      return wait
    },
    clear: handle => {
      ;(handle as (typeof waits)[number]).cleared = true
    },
  }
  /** Fires the newest wait that is still pending, and lets the probe it starts finish. */
  const fire = async () => {
    const wait = [...waits].reverse().find(item => !item.cleared && !item.fired)
    if (wait === undefined) throw new Error('no wait pending')
    wait.fired = true
    wait.run()
    await Bun.sleep(0)
  }
  return { timers, waits, fire }
}

function setup(answers: ProbeResult[] | (() => ProbeResult)) {
  const clock = fakeTimers()
  const calls: number[] = []
  const changes: boolean[] = []
  const queue = Array.isArray(answers) ? [...answers] : null
  const watch = createWatch({
    probe: async () => {
      calls.push(calls.length)
      return queue !== null ? (queue.shift() ?? 'down') : (answers as () => ProbeResult)()
    },
    onChange: lost => changes.push(lost),
    timers: clock.timers,
  })
  return { watch, clock, calls, changes }
}

describe('the watch on the server', () => {
  test('a failed request that finds the server up changes nothing and asks no more', async () => {
    const { watch, clock, calls, changes } = setup(['up'])
    watch.suspect()
    await Bun.sleep(0)
    expect(calls.length).toBe(1)
    expect(changes).toEqual([])
    expect(watch.lost()).toBe(false)
    expect(clock.waits).toEqual([])
  })

  test('a probe that finds nothing marks the server lost once and asks again after 1 s, 2 s, 4 s ... at most 30 s', async () => {
    const { watch, clock, changes } = setup(() => 'down')
    watch.suspect()
    await Bun.sleep(0)
    expect(watch.lost()).toBe(true)
    expect(changes).toEqual([true])
    for (let i = 0; i < 8; i++) await clock.fire()
    expect(clock.waits.map(wait => wait.ms)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000])
    expect(PROBE_BACKOFF_MS).toBe(1000)
    expect(PROBE_BACKOFF_MAX_MS).toBe(30000)
    // Still one change: more failed probes do not say it again.
    expect(changes).toEqual([true])
  })

  test('more failed requests while the server is gone do not cut the wait short', async () => {
    const { watch, clock, calls } = setup(() => 'down')
    watch.suspect()
    await Bun.sleep(0)
    for (let i = 0; i < 20; i++) watch.suspect()
    await Bun.sleep(0)
    expect(calls.length).toBe(1)
    expect(clock.waits.length).toBe(1)
  })

  test('the same server coming back ends the loss, resets the back-off and stops asking', async () => {
    const { watch, clock, calls, changes } = setup(['down', 'down', 'up', 'down'])
    watch.suspect()
    await Bun.sleep(0)
    await clock.fire()
    await clock.fire()
    expect(changes).toEqual([true, false])
    expect(watch.lost()).toBe(false)
    const asked = calls.length
    expect(clock.waits.filter(wait => !wait.fired && !wait.cleared)).toEqual([])
    // A later loss starts again at 1 s.
    watch.suspect()
    await Bun.sleep(0)
    expect(calls.length).toBe(asked + 1)
    expect(clock.waits.at(-1)!.ms).toBe(1000)
    expect(changes).toEqual([true, false, true])
  })

  test('an answer from any request (reached) ends the loss at once and cancels the wait', async () => {
    const { watch, clock, changes } = setup(() => 'down')
    watch.suspect()
    await Bun.sleep(0)
    watch.reached()
    expect(changes).toEqual([true, false])
    expect(clock.waits[0]!.cleared).toBe(true)
    // Nothing lost: reached() is a no-op.
    watch.reached()
    expect(changes).toEqual([true, false])
  })

  test('an expired link is the page\'s own message: the watch neither says lost nor keeps asking', async () => {
    const { watch, clock, changes } = setup(['expired'])
    watch.suspect()
    await Bun.sleep(0)
    expect(changes).toEqual([])
    expect(clock.waits).toEqual([])
  })

  test('an expired link found while the server is lost ends the loss and the asking', async () => {
    const { watch, clock, calls, changes } = setup(['down', 'expired'])
    watch.suspect()
    await Bun.sleep(0)
    await clock.fire()
    expect(changes).toEqual([true, false])
    expect(watch.lost()).toBe(false)
    expect(clock.waits.filter(wait => !wait.fired && !wait.cleared)).toEqual([])
    const asked = calls.length
    watch.suspect()
    await Bun.sleep(0)
    expect(calls.length).toBe(asked)
  })

  test('a probe that was out when a request got through is not believed: the recovered page does not go back to lost', async () => {
    const clock = fakeTimers()
    const changes: boolean[] = []
    const replies: ((result: ProbeResult) => void)[] = []
    const watch = createWatch({ probe: () => new Promise<ProbeResult>(resolve => void replies.push(resolve)), onChange: lost => changes.push(lost), timers: clock.timers })
    // Lost, then the wait's probe goes out and a request gets through before it answers.
    watch.suspect()
    replies[0]!('down')
    await Bun.sleep(0)
    await clock.fire()
    expect(replies.length).toBe(2)
    watch.reached()
    replies[1]!('down')
    await Bun.sleep(0)
    expect(changes).toEqual([true, false])
    expect(watch.lost()).toBe(false)
    expect(clock.waits.filter(wait => !wait.fired && !wait.cleared)).toEqual([])
    // Not lost yet: a request that got through while the probe was out is the same.
    watch.suspect()
    watch.reached()
    replies[2]!('down')
    await Bun.sleep(0)
    expect(changes).toEqual([true, false])
    expect(watch.lost()).toBe(false)
  })

  test('a probe that throws counts as down, and stop() cancels the wait', async () => {
    const clock = fakeTimers()
    const changes: boolean[] = []
    const watch = createWatch({ probe: async () => Promise.reject(new Error('boom')), onChange: lost => changes.push(lost), timers: clock.timers })
    watch.suspect()
    await Bun.sleep(0)
    expect(changes).toEqual([true])
    watch.stop()
    expect(clock.waits[0]!.cleared).toBe(true)
    watch.suspect()
    await Bun.sleep(0)
    expect(clock.waits.length).toBe(1)
  })
})

// ---- The page: ui/app.ts over a stand-in document and a fetch that refuses ----

type Box = { textContent: string; className: string; hidden: boolean; listeners: number; [key: string]: unknown }

describe('the page when the server stops', () => {
  const g = globalThis as Record<string, any>
  const saved = { document: g.document, fetch: g.fetch, setTimeout: g.setTimeout, location: g.location, sessionStorage: g.sessionStorage, history: g.history }
  const boxes = new Map<string, Box>()
  const box = (id: string) => boxes.get(id)!
  const listeners = (id: string) => (g.document.getElementById(id) as Box).listeners
  let app: Record<string, any>
  let answer: 'refuse' | 'ok' | '401' = 'refuse'
  let requests: string[] = []
  /** The back-off waits the page asked for: the test fires them, so no spec waits a second. */
  let waits: (() => void)[] = []
  const fire = async () => {
    waits.shift()!()
    await Bun.sleep(20)
  }
  const node = (): Box => ({
    textContent: '',
    className: '',
    hidden: false,
    value: '',
    listeners: 0,
    options: [{}],
    dataset: {},
    style: {},
    children: [],
    addEventListener() {
      this.listeners++
    },
    replaceChildren() {},
    append() {},
    focus() {},
    querySelectorAll: () => [],
    setAttribute() {},
    removeAttribute() {},
    classList: { add() {}, remove() {}, toggle() {} },
  })

  beforeAll(async () => {
    g.document = {
      getElementById: (id: string) => {
        if (!boxes.has(id)) boxes.set(id, node())
        return boxes.get(id)
      },
      createElement: () => node(),
      documentElement: node(),
      readyState: 'complete',
      addEventListener() {},
    }
    g.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} }
    g.setTimeout = ((run: () => void, ms?: number, ...rest: unknown[]) => {
      if (typeof ms === 'number' && ms >= 1000) {
        waits.push(run)
        return 0
      }
      return saved.setTimeout(run, ms, ...rest)
    }) as typeof setTimeout
    g.fetch = async (path: string) => {
      requests.push(path)
      if (answer === 'refuse') throw new TypeError('Failed to fetch')
      if (answer === '401') return new Response('{}', { status: 401 })
      return Response.json({ ok: true, pid: 1, owners: [], total: 0, store: '' })
    }
    // Its own copy of ui/app.ts (the query makes a new module): another spec in this process may have left the shared one lost or booted.
    app = await import(`${join(ROOT, 'ui', 'app.ts')}?connection`)
  })
  afterAll(() => {
    for (const [name, value] of Object.entries(saved)) g[name] = value
  })

  test('a first load that fails and a server that answers later: the page loads, wires its tabs once, and only then says Connected', async () => {
    g.location = { hash: '#token=abc', pathname: '/', search: '' }
    g.history = { replaceState() {} }
    // The page starts on a tab that draws nothing of its own (the Map would build its scene here).
    app.show('search')
    await app.main()
    await Bun.sleep(20)
    expect(box('status').textContent).toBe(app.LOST)
    // Not wired: the Activity tab's Pause button has no listener yet.
    expect(listeners('pause')).toBe(0)
    answer = 'ok'
    await fire()
    expect(box('status').textContent).toBe('Connected to the local Mnemosyne server.')
    expect(listeners('pause')).toBe(1)
    // Once only: a later loss and return does not wire again.
    answer = 'refuse'
    await app.loadHealthReport()
    await Bun.sleep(20)
    answer = 'ok'
    await fire()
    expect(listeners('pause')).toBe(1)
  })

  test('a failed request puts the disconnected banner up, and it stays when other messages try to replace it', async () => {
    requests = []
    answer = 'refuse'
    await app.loadHealthReport()
    await Bun.sleep(20)
    expect(box('status').textContent).toBe(app.LOST)
    expect(app.LOST).toContain('/mnemosyne-ui')
    expect(app.LOST).toContain('has stopped')
    expect(box('status').className).toBe('status is-error')
    // The tab's own message is still there, but a tab switch does not bring the Connected line back.
    expect(box('health-status').textContent).toContain('Could not load the health report')
    app.show('review')
    expect(box('status').textContent).toBe(app.LOST)
    // One failed request is one probe (plus the request itself), not a storm.
    expect(requests.filter(path => path === '/api/health').length).toBe(1)
    expect(waits.length).toBe(1)
  })

  test('the same server answering again brings the Connected banner back by itself', async () => {
    answer = 'ok'
    await fire()
    expect(box('status').textContent).toBe('Connected to the local Mnemosyne server.')
    expect(box('status').className).toBe('status is-ok')
  })

  test('a new server (the link answers 401) while the server is lost replaces the banner with the link message', async () => {
    answer = 'refuse'
    await app.loadHealthReport()
    await Bun.sleep(20)
    expect(box('status').textContent).toBe(app.LOST)
    answer = '401'
    await fire()
    expect(box('status').textContent).toContain('This link no longer works')
    expect(box('status').className).toBe('status is-error')
    expect(waits).toEqual([])
  })
})
