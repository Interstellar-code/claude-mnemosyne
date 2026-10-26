// VIEWS.2: the Health tab, on the real /api/health-report of the real server over a
// temporary store (memories saved by the real engine, an activity log of recent days).
// Only the DOM is stood in for.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

// ui/health.ts is DOM code (checked by ui/tsconfig.json): loaded by a path tsc does not follow.
const health = (await import(join(ROOT, 'ui', 'health.ts'))) as Record<string, any>
const { bytes, chartBars, chartText, coverageBars, coverageRows, dayBars, filterTables, heightClass, kpiTiles, kpis, parseHealth, projectRows, storageList, storageRows, storageSummary, tableFilterButtons, widthClass, embeddingsOn } = health
type HealthHost = { project: (owner: string) => unknown; openReview: () => void }

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const MARKUP = '<img src=x onerror=alert(1)>'
const DAY = 86_400_000

// ---- A DOM-free stand-in document (only the network edge and the DOM are faked) ----

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
  style: Record<string, string> = {}
  className = ''
  hidden = false
  disabled = false
  colSpan = 1
  type = ''
  title = ''
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
  focus() {}
  all(): FakeNode[] {
    return [this, ...this.children.flatMap(child => (child instanceof FakeNode ? child.all() : []))]
  }
  texts(): string[] {
    return this.children.flatMap(child => (child instanceof FakeNode ? child.texts() : [child.data]))
  }
}

const fakeDocument = {
  createElement: (tag: string) => new FakeNode(tag.toLowerCase()),
  createTextNode: (data: string) => new FakeText(data),
}

/** Runs `body` with the stand-in document installed. */
async function withDocument<T>(body: () => Promise<T> | T): Promise<T> {
  const g = globalThis as Record<string, unknown>
  const saved = g.document
  g.document = fakeDocument
  try {
    return await body()
  } finally {
    g.document = saved
  }
}

const iso = (ms: number) => new Date(ms).toISOString()

describe('VIEWS.2: the Health tab on a real store', () => {
  const temp = tempDir('health-view')
  const store = join(temp.dir, 'store')
  const log = join(temp.dir, 'activity.jsonl')
  const ids = {} as Record<'g1' | 'a1' | 'a2' | 'a3' | 'b1', string>
  let started: Started
  let emptyStarted: Started
  let now = 0
  let data: any
  let emptyData: any

  const report = async (server: Started) => {
    const response = await fetch(`http://127.0.0.1:${server.port}/api/health-report`, { headers: { Authorization: `Bearer ${server.token}` } })
    expect(response.status).toBe(200)
    return parseHealth(await response.json())
  }
  async function remember(owner: string, call: number, content: string, tags?: string[]) {
    const reply = body((await engineCall(CLI, store, owner, [toolCall(call, 'mnemopi_remember', { content, ...(tags ? { metadata: { tags } } : {}) })])).get(call)) as { memory_id: string }
    return reply.memory_id
  }

  beforeAll(async () => {
    now = Date.now()
    mkdirSync(store, { recursive: true })
    const line = (daysBack: number, action: string) => JSON.stringify({ t: iso(now - daysBack * DAY), action, origin: 'hook', owner: 'global', text: 'q', ids: [], count: 1, ok: true })
    // Today 3 recalls, 2 days ago 1, 5 days ago 2, and a save; the log covers 6 days.
    // Four dashboard searches today (origin ui): logged as recall lines, the audit trail, but not Claude recalling, so no count includes them.
    const dashboardSearches = [0, 0, 0, 5].map(daysBack => JSON.stringify({ t: iso(now - daysBack * DAY), action: 'recall', origin: 'ui', owner: 'global', text: 'search', ids: [], count: 1, ok: true }))
    writeFileSync(log, `${[line(5, 'recall'), line(5, 'recall'), line(5, 'remember'), line(2, 'recall'), line(0, 'recall'), line(0, 'recall'), line(0, 'recall'), ...dashboardSearches].join('\n')}\n`)
    ids.g1 = await remember('global', 1, 'global note', ['topic'])
    ids.a1 = await remember('project-alpha-1a2b', 2, 'alpha note one', ['alpha'])
    ids.a2 = await remember('project-alpha-1a2b', 3, `${MARKUP} never recalled`)
    ids.a3 = await remember('project-alpha-1a2b', 4, 'alpha untagged')
    ids.b1 = await remember('project-beta-9z8y', 5, 'beta note', ['beta'])
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      db.run('UPDATE working_memory SET recall_count = 9, last_recalled = ? WHERE id = ?', [iso(now - DAY), ids.a1])
      db.run('UPDATE working_memory SET recall_count = 2, last_recalled = ? WHERE id = ?', [iso(now - 3 * DAY), ids.g1])
      db.run('UPDATE working_memory SET recall_count = 1, last_recalled = ? WHERE id = ?', [iso(now - 4 * DAY), ids.b1])
      db.run("UPDATE working_memory SET author_type = 'human' WHERE id = ?", [ids.a1])
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: log, pluginRoot: ROOT })
    emptyStarted = await startServer({ root: join(temp.dir, 'root2'), store: join(temp.dir, 'nothing'), cli: CLI, activityLog: '', pluginRoot: ROOT })
    data = await report(started)
    emptyData = await report(emptyStarted)
  }, 180_000)

  afterAll(() => {
    started?.stop()
    emptyStarted?.stop()
    temp.dispose()
  })

  const host = (calls: string[] = []): HealthHost => ({
    project: owner => {
      const span = fakeDocument.createElement('span')
      span.textContent = owner
      return span
    },
    openReview: () => void calls.push('review'),
  })

  test('VIEWS.2.a1: the KPIs are memories, never recalled, recalls in the log and the store size', () => {
    expect(data.total).toBe(5)
    expect(kpis(data).map((k: { label: string; value: string; note: string }) => [k.label, k.value])).toEqual([
      ['Memories', '5'],
      ['Never recalled', '2'],
      ['Claude recalls in the log', '6'],
      ["Other apps' recalls", '0'],
      ['Store size', bytes(data.storeSize + data.logSize)],
    ])
    expect(kpis(data)[0]!.note).toBe('2 projects, 1 global')
    expect(kpis(data)[1]!.note).toBe('40% of all memories')
    expect(kpis(data)[2]!.note).toBe('over 6 days of activity log, without dashboard searches')
    expect(bytes(500)).toBe('500 B')
    expect(bytes(2048)).toBe('2 KB')
    expect(bytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })

  test('VIEWS.2.a1: coverage bars each carry a note on what they mean and how to turn them on; with no embeddings the bar reads 0 and gives the embeddings hint', () => {
    const bars = coverageBars(data)
    expect(bars.map((b: { label: string; value: string }) => [b.label, b.value])).toEqual([
      ['Topic tags', '3 of 5'],
      ['Knowledge extracted', '0 of 5'],
      ['Embeddings (meaning search)', '0 of 5'],
      ['Who wrote it (provenance)', '1 of 5'],
      ['Recalled at least once', '3 of 5'],
    ])
    expect(bars[0]!.note).toContain('/mnemosyne-tags')
    expect(bars[1]!.note).toContain('extractionModel')
    expect(bars[1]!.note).toContain('/mnemosyne-knowledge')
    expect(bars[2]).toMatchObject({ pct: 0, good: false, note: 'Turn on embeddings, then run /mnemosyne-embed apply' })
    expect(bars[3]!.note).toContain('1 memory records who wrote it')
    // With no provenance yet the note says how to turn it on (VIEWS.2.a1: every bar).
    const none = coverageBars({ ...data, coverage: { ...data.coverage, provenance: 0 } })[3]!.note
    expect(none).toStartWith('Author and certainty are not recorded on save yet.')
    expect(none).toContain('To turn it on')
    expect(none).toContain('/mnemosyne-setup')
    expect(bars[4]).toMatchObject({ pct: 60, good: true, note: 'Healthy: most memories are being used.' })
    expect(bars[0]!.pct).toBe(60)
    // Not complete here, so no note is muted; the note of "Recalled at least once" points to the Review tab, not "below".
    expect(bars.map((b: { done: boolean }) => b.done)).toEqual([false, false, false, false, false])
    expect(coverageBars({ ...data, neverCount: 4 })[4]!.note).toBe('Most memories have never been recalled: review or forget the cold ones in the Review tab.')
    // A feature every memory has is done: its note is muted (is-done) instead of green.
    const full = { ...data, coverage: { ...data.coverage, tagged: data.total } }
    expect(coverageBars(full)[0]).toMatchObject({ done: true, good: true, note: 'Every memory has a topic tag.' })
    expect(coverageBars({ ...data, neverCount: 0 })[4]).toMatchObject({ done: true, value: '5 of 5' })
    expect(coverageBars(emptyData).some((b: { done: boolean }) => b.done)).toBe(false)
    expect(widthClass(60)).toBe('w12')
    expect(widthClass(150)).toBe('w20')
    expect(widthClass(-3)).toBe('w0')
    withDocumentSync(() => {
      const rows = coverageRows(data) as FakeNode[]
      expect(rows).toHaveLength(5)
      expect(rows[0]!.texts().join('|')).toContain('Topic tags|3 of 5')
      expect(rows[2]!.all().some(n => n.className.includes('bar-fill w0'))).toBe(true)
      expect(rows[0]!.all().some(n => n.className.includes('bar-fill w12'))).toBe(true)
      expect(rows[0]!.all().some(n => n.className.includes('cov-note small'))).toBe(true)
      const done = coverageRows(full) as FakeNode[]
      expect(done[0]!.all().some(n => n.className === 'cov-note is-done small')).toBe(true)
      expect(done[0]!.all().some(n => n.className.includes('is-good'))).toBe(false)
    })
  })

  test('SEM.2.a3: the embeddings note is the same hint as the Meaning button while there are no vectors, and the bar reads the vectors once there are', () => {
    const hint = 'Turn on embeddings, then run /mnemosyne-embed apply'
    expect(embeddingsOn(data)).toBe(false)
    expect(coverageBars(data)[2]).toMatchObject({ label: 'Embeddings (meaning search)', value: '0 of 5', pct: 0, good: false, note: hint })
    // The old 0.6.0 sentence is gone, and the text is the one the Map tab shows.
    expect(coverageBars(data).some((bar: { note: string }) => bar.note.includes('later version'))).toBe(false)
    withDocumentSync(() => {
      expect((coverageRows(data) as FakeNode[])[2]!.texts().join('|')).toContain(`Embeddings (meaning search)|0 of 5|${hint}`)
      expect((coverageRows(data, true) as FakeNode[])[2]!.texts().join('|')).toContain('Memories are placed by meaning.')
    })
    // Vectors in the store turn it on: the count, the share and the good mark come from the data.
    const some = { ...data, coverage: { ...data.coverage, embeddings: 5 } }
    expect(embeddingsOn(some)).toBe(true)
    expect(coverageBars(some)[2]).toMatchObject({ value: '5 of 5', pct: 100, good: true, note: 'Memories are placed by meaning.' })
    expect(coverageBars({ ...data, coverage: { ...data.coverage, embeddings: 2 } })[2]).toMatchObject({ value: '2 of 5', pct: 40, good: true })
    // A galaxy reply that says meaning: true turns it on too, even when the store count has not reached the report yet.
    expect(embeddingsOn(data, true)).toBe(true)
    expect(coverageBars(data, true)[2]).toMatchObject({ note: 'Memories are placed by meaning.' })
    expect(coverageBars(data, true)[2]!.note).not.toBe(hint)
    // The other bars do not change either way.
    expect(coverageBars(data, true).filter((_: unknown, i: number) => i !== 2)).toEqual(coverageBars(data).filter((_: unknown, i: number) => i !== 2))
  })

  test('VIEWS.2.a1: recalls per day: 14 bars with the numbers in text, the chart has an aria-label, and the days the log covers are said', () => {
    const days = dayBars(data, now)
    expect(days).toHaveLength(14)
    expect(days.at(-1)).toMatchObject({ label: 'today', count: 3, height: 'h20' })
    expect(days[11]).toMatchObject({ label: '2d', count: 1 })
    expect(days[8]).toMatchObject({ label: '5d', count: 2 })
    expect(days.filter((d: { count: number }) => d.count === 0)).toHaveLength(11)
    expect(heightClass(1, 3)).toBe('h7')
    expect(heightClass(0, 0)).toBe('h0')
    const words = chartText(days, data)
    expect(words.label).toContain('last 14 days')
    expect(words.label).toContain('today 3')
    expect(words.label).toContain('2d 1')
    // The log covers 6 days (today and the 5 before): the 8 earlier days are not covered, and the caption says where the log starts.
    expect(days.map((d: { covered: boolean }) => d.covered)).toEqual([...Array(8).fill(false), ...Array(6).fill(true)])
    const startsOn = new Date(now - 5 * DAY)
    const startText = `${startsOn.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][startsOn.getUTCMonth()]}`
    expect(words.summary).toBe(`6 recalls in the last 14 days. The activity log starts on ${startText}; earlier days are greyed out because nothing was logged then.`)
    expect(words.label).toContain('13d not logged')
    expect(words.label).toContain('4d 0')
    expect(days[7]).toMatchObject({ covered: false, count: 0, height: 'h0' })
    withDocumentSync(() => {
      const bars = chartBars(days) as FakeNode[]
      expect(bars).toHaveLength(14)
      expect(bars.at(-1)!.texts()).toEqual(['3', 'today'])
      expect(bars.at(-1)!.all().some(n => n.className.includes('day-bar h20'))).toBe(true)
      // A covered day with no recall says 0; a day before the log has no number and is muted.
      expect(bars.at(-3)!.texts()[0]).toBe('1')
      expect(bars.at(-2)!.texts()[0]).toBe('0')
      expect(bars.at(-2)!.className).toBe('day')
      expect(bars[7]!.className).toBe('day is-off')
      expect(bars[7]!.texts()).toEqual(['6d'])
    })
    // A log that covers the whole window says nothing about where it starts.
    const full = dayBars({ ...data, daysCovered: 30 }, now)
    expect(full.every((d: { covered: boolean }) => d.covered)).toBe(true)
    expect(chartText(full, { ...data, daysCovered: 30 }).summary).toBe('6 recalls in the last 14 days.')
    // The empty store: no log, nothing to chart.
    const empty = dayBars(emptyData, now)
    expect(empty.every((d: { count: number }) => d.count === 0)).toBe(true)
    expect(chartText(empty, emptyData).summary).toBe('The activity log is empty or off, so there are no recalls to count.')
  })

  test('VIEWS.2.a1: the Most recalled list is gone from the page; the API still sends it', () => {
    expect(data).not.toHaveProperty('mostRecalled')
    expect(data).not.toHaveProperty('neverList')
    expect(health.hotRows).toBeUndefined()
    expect(health.neverRow).toBeUndefined()
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const page = html.slice(html.indexOf('id="view-health"'))
    expect(page).not.toContain('health-hot')
    expect(page).not.toContain('Most recalled')
  })

  test('the Never recalled tile is a button that opens the Review tab; the other tiles are plain', () => {
    withDocumentSync(() => {
      const calls: string[] = []
      const tiles = kpiTiles(data, () => calls.push('review')) as FakeNode[]
      expect(tiles.map(t => t.tagName)).toEqual(['div', 'button', 'div', 'div', 'div'])
      const never = tiles[1]!
      expect(never.className).toBe('tile tile-link')
      expect(never.type).toBe('button')
      // Only spans inside the button (a div inside one is not valid HTML); same words as the plain tile.
      expect(never.all().slice(1).map(n => n.tagName)).toEqual(['span', 'span', 'span'])
      expect(never.texts()).toEqual(['Never recalled', '2', '40% of all memories'])
      never.fire('click')
      expect(calls).toEqual(['review'])
      // Without a callback every tile is plain.
      expect((kpiTiles(data) as FakeNode[]).map(t => t.tagName)).toEqual(['div', 'div', 'div', 'div', 'div'])
    })
  })

  test('VIEWS.2.a1: projects and the storage rows; the Storage summary reads size and table counts', () => {
    withDocumentSync(() => {
      const projects = projectRows(data, host()) as FakeNode[]
      expect(projects.map(r => r.texts().join('|')).sort()).toEqual(['global|1 memory', 'project-alpha-1a2b|3 memories', 'project-beta-9z8y|1 memory'])
      const storage = storageList(data) as FakeNode[]
      expect(storage[0]!.texts()).toEqual(['database file', bytes(data.storeSize)])
      expect(storage[1]!.texts()).toEqual(['activity log', bytes(data.logSize)])
    })
    const rowsOfStorage = storageRows(data)
    expect(rowsOfStorage.find((r: { name: string }) => r.name === 'working_memory')).toMatchObject({ value: '5 rows', empty: false })
    expect(rowsOfStorage.find((r: { name: string }) => r.name === 'memoria_facts')).toMatchObject({ value: 'empty', empty: true })
    expect(rowsOfStorage[2]!.name).toBe('working_memory')
    // A table that is empty by design is not counted in "N empty" (CRUD.4).
    const empty = data.tables.filter((t: { rows: number; name: string }) => t.rows === 0 && !Object.hasOwn(data.unusedByDesign, t.name)).length
    expect(empty).toBeGreaterThan(0)
    expect(storageSummary(data)).toBe(`Storage · ${bytes(data.storeSize + data.logSize)} · ${data.tables.length} tables, ${empty} empty`)
    expect(storageSummary({ ...data, tables: [{ name: 'one', rows: 0 }] })).toContain('1 table, 1 empty')
  })

  test('CRUD.4: a table the server names in unusedByDesign says "unused by design" and its reason, is not counted as empty, and the Empty filter still lists it, marked', () => {
    const names = Object.keys(data.unusedByDesign)
    expect(names.length).toBeGreaterThan(0)
    const reason = data.unusedByDesign[names[0]!]
    expect(typeof reason).toBe('string')
    const byDesign = storageRows(data).find((r: { name: string }) => r.name === names[0])
    expect(byDesign).toMatchObject({ value: 'unused by design', empty: true, byDesign: true, reason })
    // A table nothing explains is still plain "empty".
    expect(storageRows(data).find((r: { name: string }) => r.name === 'memoria_facts')).toMatchObject({ value: 'empty', byDesign: false })
    const tables = [{ name: 'gists', rows: 0 }, { name: 'plain', rows: 0 }, { name: 'full', rows: 2 }]
    const some = { ...data, tables, unusedByDesign: { gists: 'Written only by the sleep tool, which the plugin never exposes.', full: 'ignored: it has rows' } }
    expect(storageSummary(some)).toBe(`Storage · ${bytes(data.storeSize + data.logSize)} · 3 tables, 1 empty`)
    expect(storageRows(some).find((r: { name: string }) => r.name === 'full')).toMatchObject({ value: '2 rows', byDesign: false })
    withDocumentSync(() => {
      const empty = storageList(some, 'empty') as FakeNode[]
      expect(empty.map(r => r.texts().join('|'))).toEqual(['gists|Written only by the sleep tool, which the plugin never exposes.|unused by design', 'plain|empty'])
      expect((storageList(some, 'data') as FakeNode[]).map(r => r.texts()[0])).toEqual(['full'])
      // The reason is text: markup in it stays text.
      const hostile = storageList({ ...some, unusedByDesign: { gists: MARKUP } }, 'empty') as FakeNode[]
      expect(hostile[0]!.texts()).toContain(MARKUP)
      expect(hostile[0]!.all().map(n => n.tagName).filter(tag => !['div', 'span'].includes(tag))).toEqual([])
    })
    // An older server sends no unusedByDesign: every empty table reads "empty" and counts.
    const old = parseHealth({ total: 1, tables: { working_memory: 1, gists: 0 } })
    expect(old.unusedByDesign).toEqual({})
    expect(storageRows(old).find((r: { name: string }) => r.name === 'gists')).toMatchObject({ value: 'empty', byDesign: false })
    expect(storageSummary(old)).toContain('2 tables, 1 empty')
    expect(parseHealth({ unusedByDesign: [1], tables: {} }).unusedByDesign).toEqual({})
    expect(parseHealth({ unusedByDesign: { a: 1, b: 'why' }, tables: {} }).unusedByDesign).toEqual({ b: 'why' })
  })

  test('filterTables: All keeps every table, Has data the ones with rows, Empty the ones without; storageList draws them and says when none match', () => {
    const tables = [{ name: 'a', rows: 3 }, { name: 'b', rows: 0 }, { name: 'c', rows: 1 }]
    expect(filterTables(tables, 'all').map((t: { name: string }) => t.name)).toEqual(['a', 'b', 'c'])
    expect(filterTables(tables, 'data').map((t: { name: string }) => t.name)).toEqual(['a', 'c'])
    expect(filterTables(tables, 'empty').map((t: { name: string }) => t.name)).toEqual(['b'])
    expect(filterTables([], 'all')).toEqual([])
    expect(filterTables([{ name: 'z', rows: 2 }], 'empty')).toEqual([])
    withDocumentSync(() => {
      const some = { ...data, tables }
      // All: the two files and the three tables. Has data / Empty: tables only.
      expect((storageList(some, 'all') as FakeNode[]).map(r => r.texts()[0])).toEqual(['database file', 'activity log', 'a', 'b', 'c'])
      expect((storageList(some, 'data') as FakeNode[]).map(r => r.texts()[0])).toEqual(['a', 'c'])
      expect((storageList(some, 'empty') as FakeNode[]).map(r => r.texts().join('|'))).toEqual(['b|empty'])
      const none = storageList({ ...some, tables: [{ name: 'a', rows: 3 }] }, 'empty') as FakeNode[]
      expect(none).toHaveLength(1)
      expect(none[0]!.texts()).toEqual(['No tables match.'])
      // The default is All.
      expect(storageList(some)).toHaveLength(5)
      // The filter buttons: aria-pressed toggles, the chosen one pressed, a click picks it.
      const picked: string[] = []
      const buttons = tableFilterButtons('data', (f: string) => picked.push(f)) as FakeNode[]
      expect(buttons.map(b => b.textContent)).toEqual(['All', 'Has data', 'Empty'])
      expect(buttons.map(b => b.attributes.get('aria-pressed'))).toEqual(['false', 'true', 'false'])
      expect(buttons.every(b => b.className === 'seg-btn' && b.type === 'button')).toBe(true)
      buttons[2]!.fire('click')
      expect(picked).toEqual(['empty'])
    })
  })

  test("QAPAGE R2 item 1: other apps' recalls are their own KPI line, never added to Claude's", () => {
    const days = [{ date: '2026-10-23', count: 9 }]
    const other = [{ date: '2026-10-23', count: 2 }, { date: 'bad', count: 5 }]
    const mixed = parseHealth({ recallsPerDay: days, otherRecallsPerDay: other, daysCovered: 1 })
    expect(kpis(mixed).filter((k: { label: string }) => k.label.includes('recalls')).map((k: { label: string; value: string }) => [k.label, k.value])).toEqual([
      ['Claude recalls in the log', '9'],
      ["Other apps' recalls", '2'],
    ])
    // A reply without the field (an older server) reads 0, not an error.
    expect(kpis(parseHealth({ recallsPerDay: days }))[3]).toMatchObject({ label: "Other apps' recalls", value: '0' })
  })

  test('VIEWS.2: an empty store reads as zeros', () => {
    expect(emptyData.total).toBe(0)
    expect(kpis(emptyData).map((k: { value: string }) => k.value)).toEqual(['0', '0', '0', '0', '0 B'])
    expect(coverageBars(emptyData).every((b: { pct: number }) => b.pct === 0)).toBe(true)
    expect(coverageBars(emptyData)[4]!.note).toBe('Nothing is stored yet.')
    expect(parseHealth(null)).toBeNull()
    expect(parseHealth([])).toBeNull()
    expect(parseHealth({})).toMatchObject({ total: 0, neverCount: 0, tables: [] })
  })

  test('VIEWS.2.a2: the chart has an aria-label and the numbers are also text; the page is built with textContent only and the markup holds the ids', () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const app = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    expect(html).toMatch(/id="health-chart"[^>]*role="img"[^>]*aria-label=/)
    expect(app).toMatch(/chart\.setAttribute\('aria-label', words\.label\)/)
    expect(app).toContain("byId('health-chart-text').textContent = words.summary")
    for (const file of ['health.ts', 'knowledge.ts']) expect(readFileSync(join(ROOT, 'ui', file), 'utf8')).not.toMatch(/\binnerHTML\b|insertAdjacentHTML|outerHTML/)
    // The Forget here is the existing guarded one: a POST to /api/forget through the token-carrying api().
    expect(app).toMatch(/function forgetById[\s\S]*api\('\/api\/forget', \{ method: 'POST', body: \{ memory_id: id \} \}\)/)
    // Phone width: the cards stack and the table scrolls in its box.
    const css = readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')
    expect(css).toMatch(/@media \(max-width: 760px\) \{\s*\.health-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/)
    expect(html.slice(html.indexOf('id="view-health"'), html.indexOf('<footer'))).not.toMatch(/\sstyle=|<script|\son\w+=/)
    // Storage is a collapsed <details> with a summary, a filter group and a scrolling list.
    expect(html).toMatch(/<details id="health-storage-box">\s*<summary id="health-storage-summary"[^>]*>/)
    expect(html).not.toMatch(/<details id="health-storage-box"[^>]*\sopen/)
    expect(html).toMatch(/id="health-storage-filter" class="segmented" role="group"/)
    expect(css).toMatch(/\.storage-list \{[^}]*max-height: 320px; overflow-y: auto/)
    expect(css).toMatch(/\.day\.is-off \.day-bar/)
    expect(css).toMatch(/\.cov-note\.is-done \{ color: var\(--muted\)/)
  })
})

function withDocumentSync(body: () => void) {
  const g = globalThis as Record<string, unknown>
  const saved = g.document
  g.document = fakeDocument
  try {
    body()
  } finally {
    g.document = saved
  }
}
