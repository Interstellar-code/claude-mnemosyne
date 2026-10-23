// The Activity feed's page logic, DOM-free: the real exported functions of
// ui/app.ts (review r1 LOW 4: Pause survives a reconnect; LOW 7: one chunk of
// the stream is drawn once).
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { toMapEvent } from '../../ui/map-live'
import { ROOT } from './helpers'

type Line = { text: string }

describe('the Activity feed state', () => {
  let app: Record<string, any>

  beforeAll(async () => {
    // A path tsc does not follow: ui/app.ts is DOM code, checked by ui/tsconfig.json.
    app = await import(join(ROOT, 'ui', 'app.ts'))
  })

  const texts = (lines: Line[]) => lines.map(line => line.text)
  const ndjson = (...names: string[]) => names.map(text => `${JSON.stringify({ text })}\n`).join('')

  test('LOW 7: every whole line of a chunk goes in, newest first, and the view is drawn once', () => {
    const feed = app.newFeed()
    let draws = 0
    const draw = () => draws++
    // Three whole lines, a blank keep-alive line, a broken one, and half a line.
    const rest = app.receiveChunk(feed, `${ndjson('a', 'b')}\n{not json\n${ndjson('c')}{"text":"d`, draw)
    expect(draws).toBe(1)
    expect(texts(feed.lines)).toEqual(['c', 'b', 'a'])
    expect(rest).toBe('{"text":"d')
    // The rest of the half line arrives: one more draw.
    expect(app.receiveChunk(feed, `${rest}"}\n`, draw)).toBe('')
    expect(draws).toBe(2)
    expect(texts(feed.lines)).toEqual(['d', 'c', 'b', 'a'])
    // Only keep-alive lines: no draw.
    expect(app.receiveChunk(feed, '\n\n', draw)).toBe('')
    expect(draws).toBe(2)
  })

  test('LOW 4: while paused, streamed lines and a reconnect reload wait, and the view is not redrawn; Resume puts them in', () => {
    const feed = app.newFeed()
    let draws = 0
    const draw = () => draws++
    expect(app.feedReload(feed, [{ text: 'old 2' }, { text: 'old 1' }], '7:100')).toBe(true)
    expect(feed.cursor).toBe('7:100')
    expect(app.feedPause(feed, true)).toBe(false)
    app.receiveChunk(feed, ndjson('while paused'), draw)
    expect(draws).toBe(0)
    expect(texts(feed.lines)).toEqual(['old 2', 'old 1'])
    // The stream drops and the page catches up: the read holds the paused line too.
    expect(app.feedReload(feed, [{ text: 'while paused' }, { text: 'old 2' }, { text: 'old 1' }], '7:180')).toBe(false)
    expect(feed.cursor).toBe('7:180')
    expect(texts(feed.lines)).toEqual(['old 2', 'old 1'])
    // The new stream starts at the cursor and sends what came after it.
    app.receiveChunk(feed, ndjson('after reconnect'), draw)
    expect(draws).toBe(0)
    expect(texts(feed.lines)).toEqual(['old 2', 'old 1'])
    // Resume: the reload, then the newer line, each once.
    expect(app.feedPause(feed, false)).toBe(true)
    expect(texts(feed.lines)).toEqual(['after reconnect', 'while paused', 'old 2', 'old 1'])
    // Resume with nothing waiting asks for no redraw.
    app.feedPause(feed, true)
    expect(app.feedPause(feed, false)).toBe(false)
  })

  test('the feed keeps at most 1000 lines', () => {
    const feed = app.newFeed()
    app.feedReload(feed, Array.from({ length: 1000 }, (_, i) => ({ text: `r${i}` })), '')
    app.feedAdd(feed, [{ text: 'new' }])
    expect(feed.lines.length).toBe(1000)
    expect(feed.lines[0].text).toBe('new')
  })
})

// ---- ACT.1 / ACT.2: the Activity rows, the filters and the session chip ----

type Fake = InstanceType<typeof FakeNode>

class FakeText {
  constructor(public data: string) {}
  get textContent() {
    return this.data
  }
}

class FakeNode {
  children: (FakeNode | FakeText)[] = []
  attributes = new Map<string, string>()
  dataset: Record<string, string> = {}
  className = ''
  hidden = false
  title = ''
  type = ''
  value = ''
  listeners = new Map<string, ((event: unknown) => void)[]>()
  constructor(public tagName: string) {}
  get textContent(): string {
    return this.children.map(child => child.textContent).join('')
  }
  set textContent(value: string) {
    this.children = value === '' ? [] : [new FakeText(String(value))]
  }
  append(...nodes: (FakeNode | FakeText | string)[]) {
    for (const node of nodes) this.children.push(typeof node === 'string' ? new FakeText(node) : node)
  }
  replaceChildren(...nodes: (FakeNode | FakeText | string)[]) {
    this.children = []
    this.append(...nodes)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value))
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  fire(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
  all(): FakeNode[] {
    return [this, ...this.children.flatMap(child => (child instanceof FakeNode ? child.all() : []))]
  }
  texts(): string[] {
    return this.children.flatMap(child => (child instanceof FakeNode ? child.texts() : [child.data]))
  }
  // The filter chips of #act-filters.
  chips: FakeNode[] = []
  querySelectorAll(_selector: string) {
    return this.chips
  }
}

const iso = (n: number) => `2026-10-22T10:00:0${n}.000Z`
const SESSION_A = 'a1b2c3d4-0000-4000-8000-aaaaaaaaaaaa'
const SESSION_B = 'f9e8d7c6-0000-4000-8000-bbbbbbbbbbbb'

// Real-shaped lines (the fields bin/activity writes), then the new `client` and `session`.
const base = { owner: 'project-x-1a2b', text: 'apple pie', ids: [] as string[], count: 1, ok: true }
const LINES = {
  hookRecall: { ...base, t: iso(1), action: 'recall', origin: 'hook', client: 'claude-code', session: SESSION_A },
  toolRemember: { ...base, t: iso(2), action: 'remember', origin: 'tool', client: 'claude-code', session: SESSION_A },
  toolRecallB: { ...base, t: iso(3), action: 'recall', origin: 'tool', client: 'claude-code', session: SESSION_B },
  codexRecall: { ...base, t: iso(4), action: 'recall', origin: 'external', client: 'codex-mcp-client' },
  cursorUpdate: { ...base, t: iso(5), action: 'update', origin: 'external', client: 'cursor-vscode' },
  zedRecall: { ...base, t: iso(6), action: 'recall', origin: 'external', client: 'zed' },
  uiRecall: { ...base, t: iso(7), action: 'recall', origin: 'ui' },
  // An old line: none of the new fields.
  legacy: { ...base, t: iso(8), action: 'forget', origin: 'tool' },
}
const ALL = Object.values(LINES)

describe('ACT: the Activity list on real-shaped lines', () => {
  let app: Record<string, any>
  let saved: unknown
  const els = new Map<string, Fake>()

  beforeAll(async () => {
    app = await import(join(ROOT, 'ui', 'app.ts'))
    saved = (globalThis as Record<string, unknown>).document
  })
  afterAll(() => {
    ;(globalThis as Record<string, unknown>).document = saved
  })

  // A fresh page and fresh state for every test; only the document is faked.
  beforeEach(() => {
    els.clear()
    for (const id of ['tile-recall', 'tile-remember', 'tile-update', 'tile-failed', 'act-list', 'act-app', 'act-session', 'act-filters', 'pause', 'live', 'live-text']) els.set(id, new FakeNode('x'))
    els.get('act-session')!.hidden = true
    els.get('act-filters')!.chips = ['all', 'recall', 'remember', 'update', 'forget', 'external'].map(name => {
      const chip = new FakeNode('button')
      chip.dataset.filter = name
      return chip
    })
    ;(globalThis as Record<string, unknown>).document = {
      createElement: (tag: string) => new FakeNode(tag),
      createTextNode: (data: string) => new FakeText(data),
      getElementById: (id: string) => els.get(id) ?? null,
    }
    app.feed.lines = [...ALL].reverse()
    app.feedView.filter = app.newFilter()
    app.feedView.apps = ''
    app.wireActivity()
  })

  const rows = () => (els.get('act-list')!.children as Fake[]).filter(row => !row.className.includes('empty'))
  const shownTexts = () => rows().map(row => (row.children[4] as Fake).textContent + '|' + row.all().filter(e => e.className.includes('origin')).map(e => e.textContent).join('/'))
  const shownTimes = () => rows().map(row => (row.children[0] as Fake).textContent)
  const timesOf = (...names: (keyof typeof LINES)[]) => names.map(name => app.clock(LINES[name].t)).sort()
  const pickApp = (name: string) => {
    els.get('act-app')!.value = name
    els.get('act-app')!.fire('change', { target: els.get('act-app') })
  }
  const pickAction = (name: string) => els.get('act-filters')!.chips.find(chip => chip.dataset.filter === name)!.fire('click')
  const clickSession = (row: Fake) => row.all().find(e => e.tagName === 'button')!.fire('click')

  test('ACT.1.a2: Source shows the friendly label, then the raw origin; external names the app', () => {
    const cell = (line: unknown) => {
      const item = app.activityItem(line) as Fake
      return item.children[2] as Fake
    }
    const pairs = (line: unknown) => {
      const source = cell(line)
      return [(source.children[0] as Fake).textContent, ((source.children[1] as Fake).children[0] as Fake).textContent]
    }
    expect(pairs(LINES.hookRecall)).toEqual(['first prompt', 'hook'])
    expect(pairs(LINES.toolRemember)).toEqual(['Claude tool', 'tool'])
    expect(pairs(LINES.uiRecall)).toEqual(['dashboard', 'ui'])
    expect(pairs(LINES.codexRecall)).toEqual(['Codex', 'external'])
    expect(pairs(LINES.cursorUpdate)).toEqual(['Cursor', 'external'])
    expect(pairs(LINES.zedRecall)).toEqual(['zed', 'external'])
    // No client: the old words.
    expect(pairs({ ...LINES.zedRecall, client: undefined })).toEqual(['outside agent', 'external'])
    expect(pairs({ ...LINES.zedRecall, client: '  ' })).toEqual(['outside agent', 'external'])
    expect(pairs({ ...LINES.zedRecall, client: 42 })).toEqual(['outside agent', 'external'])
    // The raw origin line is mono.
    const rawLine = ((app.activityItem(LINES.hookRecall) as Fake).children[2] as Fake).children[1] as Fake
    expect(rawLine.className.split(' ')).toContain('mono')
    // The row keeps its six cells, in the header's order.
    expect((app.activityItem(LINES.codexRecall) as Fake).children.length).toBe(6)
  })

  test('ACT.1.a4: a session shows its first 8 characters, never more; a line without one shows none', () => {
    const item = app.activityItem(LINES.hookRecall, () => {}) as Fake
    const texts = item.texts()
    expect(texts).toContain('a1b2c3d4')
    expect(texts.some(text => text.includes('a1b2c3d4-'))).toBe(false)
    const button = item.all().find(e => e.tagName === 'button')!
    expect(button.attributes.get('aria-label')).toBe('Show only session a1b2c3d4')
    let picked = ''
    const pickable = app.activityItem(LINES.hookRecall, (id: string) => (picked = id)) as Fake
    pickable.all().find(e => e.tagName === 'button')!.fire('click')
    expect(picked).toBe(SESSION_A)
    expect(app.shortSession('abc')).toBe('abc')
    expect(app.shortSession('0123456789')).toBe('01234567')
    const legacy = app.activityItem(LINES.legacy, () => {}) as Fake
    expect(legacy.all().some(e => e.tagName === 'button')).toBe(false)
    expect(legacy.texts()).toContain('tool')
  })

  test('ACT.1.a6: extract shows as learn, with its item count or its failure reason', () => {
    const ok = { ...base, t: iso(1), action: 'extract', origin: 'hook', count: 3 }
    const failed = { ...base, t: iso(2), action: 'extract', origin: 'hook', count: 0, ok: false, error: 'engine out of date' }
    const okRow = app.activityItem(ok) as Fake
    expect((okRow.children[1] as Fake).textContent).toBe('learn')
    expect((okRow.children[5] as Fake).textContent).toBe('3 items')
    expect(app.resultLabel({ ...ok, count: 1 })).toBe('1 item')
    const failedRow = app.activityItem(failed) as Fake
    expect((failedRow.children[1] as Fake).textContent).toBe('learn')
    expect((failedRow.children[5] as Fake).textContent).toBe('failed: engine out of date')
    expect((failedRow.children[5] as Fake).className).toContain('is-failed')
    expect(app.resultLabel({ ...failed, error: undefined })).toBe('failed')
    // The old action words are unchanged.
    expect(app.actionLabel('rearm')).toBe('re-arm')
    expect(app.actionLabel('recall')).toBe('recall')
  })

  test('ACT.2.a1: appOf names each line\'s app; the drop-down lists the four, then any other client seen', () => {
    expect(ALL.map(line => app.appOf(line))).toEqual(['Claude Code', 'Claude Code', 'Claude Code', 'Codex', 'Cursor', 'zed', 'Dashboard', 'Claude Code'])
    expect(app.appOf({ origin: 'external' })).toBe('')
    expect(app.appOptions([])).toEqual(['Claude Code', 'Codex', 'Cursor', 'Dashboard'])
    // An outside client's own name is namespaced (ext:), so it can never equal a fixed app.
    expect(app.appOptions(ALL)).toEqual(['Claude Code', 'Codex', 'Cursor', 'Dashboard', 'ext:zed'])
    expect(app.appName('ext:zed')).toBe('zed')
    // The picked app stays listed even when no line shows it any more.
    expect(app.appOptions([], 'ext:Windsurf')).toEqual(['Claude Code', 'Codex', 'Cursor', 'Dashboard', 'ext:Windsurf'])
  })

  test('review 2 / 2: an outside client that names itself "Dashboard" is not the dashboard, in the filter or the options', () => {
    const fake = { ...base, t: iso(9), action: 'recall', origin: 'external', client: 'Dashboard' }
    expect(app.appKey(fake)).toBe('ext:Dashboard')
    expect(app.showLine(fake, { action: 'all', app: 'Dashboard', session: '' })).toBe(false)
    expect(app.showLine(fake, { action: 'all', app: 'ext:Dashboard', session: '' })).toBe(true)
    expect(app.showLine(LINES.uiRecall, { action: 'all', app: 'Dashboard', session: '' })).toBe(true)
    expect(app.appOptions([fake])).toEqual(['Claude Code', 'Codex', 'Cursor', 'Dashboard', 'ext:Dashboard'])
    // Through the drop-down: the real dashboard line and the fake one fall in different entries.
    app.feed.lines = [fake, LINES.uiRecall]
    app.drawFeed()
    expect((els.get('act-app')!.children as Fake[]).map(o => [o.value, o.textContent])).toEqual([
      ['all', 'All'], ['Claude Code', 'Claude Code'], ['Codex', 'Codex'], ['Cursor', 'Cursor'], ['Dashboard', 'Dashboard'], ['ext:Dashboard', 'Dashboard'],
    ])
    pickApp('Dashboard')
    expect(shownTimes()).toEqual([app.clock(LINES.uiRecall.t)])
    // A client that names itself Claude Code is Claude Code (a known app), not a raw name.
    expect(app.appKey({ origin: 'external', client: 'claude-code' })).toBe('Claude Code')
  })

  test('review 2 / 3: hook, tool and trigger lines are Claude Code; a backfill line takes its client, else no app', () => {
    for (const origin of ['hook', 'tool', 'trigger']) expect(app.appOf({ ...base, origin })).toBe('Claude Code')
    expect(app.appOf({ ...base, origin: 'backfill', client: 'mnemosyne-tags' })).toBe('mnemosyne-tags')
    expect(app.appOf({ ...base, origin: 'backfill' })).toBe('')
    expect(app.appKey({ ...base, origin: 'backfill' })).toBe('')
    expect(app.showLine({ ...base, origin: 'backfill' }, { action: 'all', app: 'Claude Code', session: '' })).toBe(false)
    expect(app.showLine({ ...base, origin: 'backfill' }, { action: 'all', app: 'all', session: '' })).toBe(true)
    expect(app.appOptions([{ ...base, origin: 'backfill' }])).toEqual(['Claude Code', 'Codex', 'Cursor', 'Dashboard'])
    // Without an origin or a client, no app either.
    expect(app.appOf({ owner: 'global' })).toBe('')
  })

  test('review 2 / 5: the App drop-down\'s first entry reads All', () => {
    app.drawFeed()
    expect((els.get('act-app')!.children as Fake[])[0]!.textContent).toBe('All')
  })

  test('ACT.2.a1: the App drop-down narrows the list, and its entries come from the lines seen', () => {
    app.drawFeed()
    expect(rows().length).toBe(ALL.length)
    const options = els.get('act-app')!.children as Fake[]
    expect(options.map(o => o.value)).toEqual(['all', 'Claude Code', 'Codex', 'Cursor', 'Dashboard', 'ext:zed'])
    expect(options.map(o => o.textContent)).toEqual(['All', 'Claude Code', 'Codex', 'Cursor', 'Dashboard', 'zed'])
    pickApp('Codex')
    expect(shownTimes()).toEqual(timesOf('codexRecall'))
    pickApp('ext:zed')
    expect(shownTimes()).toEqual(timesOf('zedRecall'))
    pickApp('Dashboard')
    expect(shownTimes()).toEqual(timesOf('uiRecall'))
    pickApp('Claude Code')
    expect(shownTimes().sort()).toEqual(timesOf('hookRecall', 'toolRemember', 'toolRecallB', 'legacy'))
    pickApp('all')
    expect(rows().length).toBe(ALL.length)
  })

  test('ACT.2.a2: clicking a row\'s session shows only that session, with a chip that clears it', () => {
    app.drawFeed()
    const chip = els.get('act-session')!
    expect(chip.hidden).toBe(true)
    clickSession(rows().find(row => row.texts().includes('a1b2c3d4'))!)
    expect(shownTimes().sort()).toEqual(timesOf('hookRecall', 'toolRemember'))
    expect(chip.hidden).toBe(false)
    expect(chip.textContent).toBe('Session: a1b2c3d4 ×')
    expect(chip.attributes.get('aria-label')).toBe('Clear session filter: a1b2c3d4')
    // The chip clears it, and another session can be picked.
    chip.fire('click')
    clickSession(rows().find(row => row.texts().includes('f9e8d7c6'))!)
    expect(shownTimes()).toEqual(timesOf('toolRecallB'))
    chip.fire('click')
    expect(chip.hidden).toBe(true)
    expect(chip.textContent).toBe('')
    expect(rows().length).toBe(ALL.length)
  })

  test('ACT.2.a3: app, session and action filters combine, each pair and all three', () => {
    app.drawFeed()
    // action + app
    pickAction('recall')
    pickApp('Claude Code')
    expect(shownTimes().sort()).toEqual(timesOf('hookRecall', 'toolRecallB'))
    // + session
    clickSession(rows().find(row => row.texts().includes('f9e8d7c6'))!)
    expect(shownTimes()).toEqual(timesOf('toolRecallB'))
    // action + session: another action leaves nothing, and says so
    pickApp('all')
    pickAction('remember')
    expect(shownTimes()).toEqual([])
    expect(els.get('act-list')!.texts()).toEqual(['No activity matches these filters.'])
    // app + session: Codex has no line in that session
    pickAction('all')
    pickApp('Codex')
    expect(shownTimes()).toEqual([])
    // the session alone, then the chip clears and the other two still hold
    pickApp('all')
    expect(shownTimes()).toEqual(timesOf('toolRecallB'))
    els.get('act-session')!.fire('click')
    pickAction('external')
    expect(shownTimes().sort()).toEqual(timesOf('codexRecall', 'cursorUpdate', 'zedRecall'))
    pickApp('Cursor')
    expect(shownTimes()).toEqual(timesOf('cursorUpdate'))
  })

  test('showLine: every combination of action, app and session, with lines that lack client and session', () => {
    const f = (action: string, appName: string, session: string) => ALL.filter(line => app.showLine(line, { action, app: appName, session })).map(line => line.t)
    const t = (...names: (keyof typeof LINES)[]) => names.map(name => LINES[name].t)
    expect(f('all', 'all', '')).toEqual(ALL.map(line => line.t))
    expect(f('recall', 'all', '')).toEqual(t('hookRecall', 'toolRecallB', 'codexRecall', 'zedRecall', 'uiRecall'))
    expect(f('all', 'Claude Code', '')).toEqual(t('hookRecall', 'toolRemember', 'toolRecallB', 'legacy'))
    expect(f('all', 'all', SESSION_A)).toEqual(t('hookRecall', 'toolRemember'))
    expect(f('recall', 'Claude Code', '')).toEqual(t('hookRecall', 'toolRecallB'))
    expect(f('recall', 'all', SESSION_A)).toEqual(t('hookRecall'))
    expect(f('all', 'Claude Code', SESSION_B)).toEqual(t('toolRecallB'))
    expect(f('recall', 'Claude Code', SESSION_A)).toEqual(t('hookRecall'))
    expect(f('external', 'Cursor', '')).toEqual(t('cursorUpdate'))
    expect(f('external', 'Claude Code', '')).toEqual([])
    // A line with no session never matches a session filter.
    expect(f('all', 'all', 'nope')).toEqual([])
  })
})

// ---- LIVE.4: the Activity tab and the map read ONE shared stream ----

/** A fake api: one open NDJSON stream per call, controlled by the test (only the network edge is faked). */
function fakeStreamApi() {
  const calls: string[] = []
  const controllers: ReadableStreamDefaultController<Uint8Array>[] = []
  const api = async (path: string) => {
    calls.push(path)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controllers.push(controller)
      },
    })
    return new Response(body, { status: 200 })
  }
  const push = (...lines: object[]) => controllers[controllers.length - 1]?.enqueue(new TextEncoder().encode(lines.map(line => `${JSON.stringify(line)}\n`).join('')))
  const end = () => controllers[controllers.length - 1]?.close()
  return { api, calls, push, end }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

// Real-shaped lines of the CTX format (client and session), an extract line and a failed one.
const recallLine = { t: '2026-10-23T10:00:01.000Z', action: 'recall', origin: 'tool', owner: 'project-x-1a2b', text: 'apple', ids: ['m1', 'm2'], count: 2, ok: true, client: 'claude-code', session: 'a1b2c3d4-0000-4000-8000-aaaaaaaaaaaa' }
const rememberLine = { ...recallLine, t: '2026-10-23T10:00:02.000Z', action: 'remember', ids: ['m3'], count: 1 }
const extractLine = { ...recallLine, t: '2026-10-23T10:00:03.000Z', action: 'extract', origin: 'hook', ids: ['m3'], count: 3 }
const failedLine = { ...recallLine, t: '2026-10-23T10:00:04.000Z', action: 'recall', ids: [], count: 0, ok: false, error: 'engine down' }

describe('LIVE.4: one shared stream for the Activity tab and the Map tab', () => {
  let app: Record<string, any>

  beforeAll(async () => {
    app = await import(join(ROOT, 'ui', 'app.ts'))
  })

  test('LIVE.4.a1: the Activity feed and the map get the SAME line from ONE reader, with one request', async () => {
    const fake = fakeStreamApi()
    let prepared = 0
    const shared = app.shareStream(fake.api, async () => {
      prepared++
      return '7:100'
    })
    const feed = app.newFeed()
    const mapEvents: unknown[] = []
    shared.subscribe((line: Record<string, unknown>) => app.feedAdd(feed, [line]))
    shared.subscribe((line: Record<string, unknown>) => {
      const event = toMapEvent(line)
      if (event !== null) mapEvents.push(event)
    })
    await tick()
    await tick()
    expect(prepared).toBe(1)
    expect(fake.calls).toEqual(['/api/activity/stream?cursor=7%3A100'])
    expect(shared.reader().polls()).toBe(1)
    fake.push(recallLine)
    await tick()
    // The Activity feed holds the line, the map got its event, from that one read.
    expect(feed.lines).toEqual([recallLine])
    expect(mapEvents).toEqual([{ kind: 'recall', ids: ['m1', 'm2'], client: 'claude-code', t: recallLine.t, owner: 'project-x-1a2b' }])
    shared.reader().close()
  })

  test('LIVE.4.a1: an extract line and a failed line reach the Activity feed, and the map draws nothing for them', async () => {
    const fake = fakeStreamApi()
    const shared = app.shareStream(fake.api, async () => '')
    const feed = app.newFeed()
    const mapEvents: unknown[] = []
    shared.subscribe((line: Record<string, unknown>) => app.feedAdd(feed, [line]))
    shared.subscribe((line: Record<string, unknown>) => {
      const event = toMapEvent(line)
      if (event !== null) mapEvents.push(event)
    })
    await tick()
    await tick()
    fake.push(rememberLine, extractLine, failedLine)
    await tick()
    expect(feed.lines.map((line: { action: string; ok: boolean }) => [line.action, line.ok])).toEqual([['recall', false], ['extract', true], ['remember', true]])
    expect(mapEvents.map((event: any) => event.kind)).toEqual(['save'])
    shared.reader().close()
  })

  test('LIVE.4.a1: a listener that leaves stops hearing; the reader stays for the other', async () => {
    const fake = fakeStreamApi()
    const shared = app.shareStream(fake.api, async () => '')
    const one: unknown[] = []
    const two: unknown[] = []
    const off = shared.subscribe((line: unknown) => one.push(line))
    shared.subscribe((line: unknown) => two.push(line))
    await tick()
    await tick()
    fake.push(recallLine)
    await tick()
    off()
    fake.push(rememberLine)
    await tick()
    expect(one).toHaveLength(1)
    expect(two).toHaveLength(2)
    expect(fake.calls).toHaveLength(1)
    shared.reader().close()
  })

  test('LIVE.4.a1: a history read that fails still starts the stream, from the start', async () => {
    const fake = fakeStreamApi()
    const shared = app.shareStream(fake.api, async () => {
      throw new Error('history failed')
    })
    shared.subscribe(() => {})
    await tick()
    await tick()
    expect(fake.calls).toEqual(['/api/activity/stream'])
    shared.reader().close()
  })

  test('LIVE.4.a1: after a reconnect the repeated lines are dropped and the new ones come through once', async () => {
    const fake = fakeStreamApi()
    const shared = app.shareStream(fake.api, async () => '7:100')
    const seen: string[] = []
    const statuses: string[] = []
    shared.onStatus((status: string) => statuses.push(status))
    shared.subscribe((line: { t: string }) => seen.push(line.t))
    await tick()
    await tick()
    fake.push(recallLine, rememberLine)
    await tick()
    fake.end()
    // The reader waits 1 s and reconnects from the same cursor: the server repeats both lines, then sends a new one.
    await new Promise(resolve => setTimeout(resolve, 1100))
    expect(fake.calls).toHaveLength(2)
    fake.push(recallLine, rememberLine, extractLine)
    await tick()
    expect(seen).toEqual([recallLine.t, rememberLine.t, extractLine.t])
    expect(statuses).toContain('reconnecting')
    shared.reader().close()
  })

  test('replayFilter: skips what repeats in order, lets the first different line through, and works again after the next reconnect', () => {
    const filter = app.replayFilter()
    expect(filter.accept(recallLine)).toBe(true)
    expect(filter.accept(rememberLine)).toBe(true)
    filter.reconnecting()
    expect(filter.accept(recallLine)).toBe(false)
    expect(filter.accept(rememberLine)).toBe(false)
    expect(filter.accept(extractLine)).toBe(true)
    // A new line equal to an old one, after the replay is over, is a real line.
    expect(filter.accept(recallLine)).toBe(true)
    // A log that was rotated: the first line differs, so nothing is skipped.
    filter.reconnecting()
    expect(filter.accept(failedLine)).toBe(true)
  })

  test('LIVE.4.a1: ui/app.ts has no request loop of its own: one createStream, no /api/activity/stream path, no follow()', () => {
    const source = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    expect(source.match(/\bcreateStream\(/g)?.length).toBe(1)
    expect(source).not.toMatch(/\/api\/activity\/stream/)
    expect(source).not.toMatch(/function follow\(/)
    // The map gets the shared stream through its host, not a reader of its own.
    expect(source).toMatch(/events: listener => useEvents\(\)\.subscribe\(listener\)/)
    const imports = [...readFileSync(join(ROOT, 'ui', 'stream.ts'), 'utf8').matchAll(/^\s*import[^\n]*from\s+['"]([^'"]+)['"]/gm)].map(m => m[1]!)
    expect(imports.some(path => path.includes('app'))).toBe(false)
  })
})
