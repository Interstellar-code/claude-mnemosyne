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
const { bytes, chartBars, chartText, coverageBars, coverageRows, dayBars, heightClass, hotRows, kpiTiles, kpis, neverRow, neverText, parseHealth, projectRows, storageList, storageRows, widthClass, EMBEDDINGS_ARRIVED } = health
type HealthHost = { project: (owner: string) => unknown; review: (id: string) => void; forget: (id: string, done: (error?: string) => void) => void; now: () => number }

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

  const host = (calls: string[] = [], failWith?: string): HealthHost => ({
    project: owner => {
      const span = fakeDocument.createElement('span')
      span.textContent = owner
      return span
    },
    review: id => void calls.push(`review ${id}`),
    forget: (id, done) => {
      calls.push(`forget ${id}`)
      done(failWith)
    },
    now: () => now,
  })

  test('VIEWS.2.a1: the KPIs are memories, never recalled, recalls in the log and the store size', () => {
    expect(data.total).toBe(5)
    expect(kpis(data).map((k: { label: string; value: string; note: string }) => [k.label, k.value])).toEqual([
      ['Memories', '5'],
      ['Never recalled', '2'],
      ['Claude recalls in the log', '6'],
      ['Store size', bytes(data.storeSize + data.logSize)],
    ])
    expect(kpis(data)[0]!.note).toBe('2 projects, 1 global')
    expect(kpis(data)[1]!.note).toBe('40% of all memories')
    expect(kpis(data)[2]!.note).toBe('over 6 days of activity log, without dashboard searches')
    expect(bytes(500)).toBe('500 B')
    expect(bytes(2048)).toBe('2 KB')
    expect(bytes(3 * 1024 * 1024)).toBe('3.0 MB')
  })

  test('VIEWS.2.a1: coverage bars each carry a note on what they mean and how to turn them on; embeddings read 0 in 0.6.0', () => {
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
    expect(bars[2]).toMatchObject({ pct: 0, note: 'Embeddings arrive in a later version' })
    expect(bars[3]!.note).toContain('1 memory records who wrote it')
    // With no provenance yet the note says how to turn it on (VIEWS.2.a1: every bar).
    const none = coverageBars({ ...data, coverage: { ...data.coverage, provenance: 0 } })[3]!.note
    expect(none).toStartWith('Author and certainty are not recorded on save yet.')
    expect(none).toContain('To turn it on')
    expect(none).toContain('/mnemosyne-setup')
    expect(bars[4]).toMatchObject({ pct: 60, good: true, note: 'Healthy: most memories are being used.' })
    expect(bars[0]!.pct).toBe(60)
    expect(EMBEDDINGS_ARRIVED).toBe(false)
    // Even if the store held embeddings, 0.6.0 reads 0.
    expect(coverageBars({ ...data, coverage: { ...data.coverage, embeddings: 5 } })[2]).toMatchObject({ value: '0 of 5', pct: 0 })
    expect(widthClass(60)).toBe('w12')
    expect(widthClass(150)).toBe('w20')
    expect(widthClass(-3)).toBe('w0')
    withDocumentSync(() => {
      const rows = coverageRows(data) as FakeNode[]
      expect(rows).toHaveLength(5)
      expect(rows[0]!.texts().join('|')).toContain('Topic tags|3 of 5')
      expect(rows[2]!.all().some(n => n.className.includes('bar-fill w0'))).toBe(true)
      expect(rows[0]!.all().some(n => n.className.includes('bar-fill w12'))).toBe(true)
    })
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
    expect(words.summary).toBe('6 recalls in the last 14 days. The activity log covers 6 days, so older days show 0 here.')
    withDocumentSync(() => {
      const bars = chartBars(days) as FakeNode[]
      expect(bars).toHaveLength(14)
      expect(bars.at(-1)!.texts()).toEqual(['3', 'today'])
      expect(bars.at(-1)!.all().some(n => n.className.includes('day-bar h20'))).toBe(true)
    })
    // The empty store: no log, nothing to chart.
    const empty = dayBars(emptyData, now)
    expect(empty.every((d: { count: number }) => d.count === 0)).toBe(true)
    expect(chartText(empty, emptyData).summary).toBe('The activity log is empty or off, so there are no recalls to count.')
  })

  test('VIEWS.2.a1: never recalled with Review and a two-step Forget, most recalled, projects and the storage rows', () => {
    expect(neverText(data)).toBe('2 memories have never come back in a recall: candidates to review or forget.')
    expect(data.neverList.map((m: { id: string }) => m.id).sort()).toEqual([ids.a2, ids.a3].sort())
    expect(data.mostRecalled.map((m: { recalls: number }) => m.recalls)).toEqual([9, 2, 1])
    withDocumentSync(() => {
      const calls: string[] = []
      const rows = data.neverList.map((m: unknown) => neverRow(m, host(calls), () => calls.push('removed'))) as FakeNode[]
      const row = rows.find(r => r.texts().some(t => t.includes(MARKUP)))!
      // The hostile text is text.
      expect(row.texts()).toContain(`${MARKUP} never recalled`)
      expect(row.all().map(n => n.tagName).filter(tag => !['tr', 'td', 'span', 'button'].includes(tag))).toEqual([])
      const buttons = row.all().filter(n => n.tagName === 'button')
      const [review, ask, yes, keep] = buttons
      expect(buttons.map(b => b.textContent)).toEqual(['Review', 'Forget…', 'Forget', 'Keep'])
      review!.fire('click')
      expect(calls).toEqual([`review ${ids.a2}`])
      // The confirm is hidden until Forget… is pressed; Keep puts it away again and calls nothing.
      const confirm = row.all().find(n => n.className === 'confirm-inline')!
      expect(confirm.hidden).toBe(true)
      ask!.fire('click')
      expect(confirm.hidden).toBe(false)
      expect(ask!.hidden).toBe(true)
      keep!.fire('click')
      expect(confirm.hidden).toBe(true)
      expect(calls).toEqual([`review ${ids.a2}`])
      // Forget asks the guarded forget with the memory's id, then the row is removed.
      ask!.fire('click')
      yes!.fire('click')
      expect(calls).toEqual([`review ${ids.a2}`, `forget ${ids.a2}`, 'removed'])
    })
    withDocumentSync(() => {
      // A failed forget keeps the row and says why.
      const calls: string[] = []
      const row = neverRow(data.neverList[0], host(calls, 'Forget failed: the server answered 500'), () => calls.push('removed')) as unknown as FakeNode
      const yes = row.all().find(n => n.textContent === 'Forget' && n.tagName === 'button')!
      yes.fire('click')
      expect(calls).toEqual([`forget ${data.neverList[0].id}`])
      expect(row.texts()).toContain('Forget failed: the server answered 500')
    })
    withDocumentSync(() => {
      const hot = hotRows(data, host()) as FakeNode[]
      expect(hot.map(r => r.texts()[0])).toEqual(['9', '2', '1'])
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
  })

  test('VIEWS.2: an empty store reads as zeros, with no never-recalled list', () => {
    expect(emptyData.total).toBe(0)
    expect(kpis(emptyData).map((k: { value: string }) => k.value)).toEqual(['0', '0', '0', '0 B'])
    expect(neverText(emptyData)).toBe('Every memory has come back in a recall at least once.')
    expect(coverageBars(emptyData).every((b: { pct: number }) => b.pct === 0)).toBe(true)
    expect(coverageBars(emptyData)[4]!.note).toBe('Nothing is stored yet.')
    expect(parseHealth(null)).toBeNull()
    expect(parseHealth([])).toBeNull()
    expect(parseHealth({})).toMatchObject({ total: 0, neverList: [], tables: [] })
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
    expect(html).toMatch(/id="health-never"/)
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
