// The Activity feed's page logic, DOM-free: the real exported functions of
// ui/app.ts (review r1 LOW 4: Pause survives a reconnect; LOW 7: one chunk of
// the stream is drawn once).
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
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
    // The row keeps its six cells, in the header's order.
    expect((app.activityItem(LINES.codexRecall) as Fake).children.length).toBe(6)
  })

  test('ACT.1.a4: a session shows its first 8 characters, never more; a line without one shows none', () => {
    const item = app.activityItem(LINES.hookRecall, () => {}) as Fake
    const texts = item.texts()
    expect(texts).toContain('a1b2c3d4')
    expect(texts.some(text => text.includes('a1b2c3d4-'))).toBe(false)
    expect(item.all().some(e => e.tagName === 'button')).toBe(true)
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
    expect(app.appOptions(ALL)).toEqual(['Claude Code', 'Codex', 'Cursor', 'Dashboard', 'zed'])
    // The picked app stays listed even when no line shows it any more.
    expect(app.appOptions([], 'Windsurf')).toEqual(['Claude Code', 'Codex', 'Cursor', 'Dashboard', 'Windsurf'])
  })

  test('ACT.2.a1: the App drop-down narrows the list, and its entries come from the lines seen', () => {
    app.drawFeed()
    expect(rows().length).toBe(ALL.length)
    const options = els.get('act-app')!.children as Fake[]
    expect(options.map(o => o.value)).toEqual(['all', 'Claude Code', 'Codex', 'Cursor', 'Dashboard', 'zed'])
    pickApp('Codex')
    expect(shownTimes()).toEqual(timesOf('codexRecall'))
    pickApp('zed')
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
