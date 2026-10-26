// VIEWS.1: the Knowledge tab, on the real /api/knowledge of the real server over a
// temporary store whose rows were written by the real engine tool
// (mnemopi_knowledge_store, as tests/bun/knowledge-api.spec.ts does). Only the DOM is
// stood in for; nothing else is faked.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GALAXY_LIMIT, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

// ui/knowledge.ts is DOM code (checked by ui/tsconfig.json): loaded by a path tsc does not follow.
const { agoText, countText, daysAgo, extractionState, itemHead, KINDS, kindTabs, kpis, summaryLine, neverUsedText, filterItems, hasStatus, usedBar, ownersOf, notice, parseKnowledge, rowsOf, statusOf, tableRows, total, usedText } = (await import(join(ROOT, 'ui', 'knowledge.ts'))) as Record<string, any>
type KnowledgeHost = { project: (owner: string) => unknown; showOnMap: (id: string) => void; open: (id: string, row: unknown) => void; now: () => number }
type KnowledgeData = any

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

describe('VIEWS.1: the Knowledge tab on a real store', () => {
  const temp = tempDir('knowledge-view')
  const store = join(temp.dir, 'store')
  const emptyStore = join(temp.dir, 'empty')
  const ids = {} as Record<'m1' | 'm2' | 'm3', string>
  let started: Started
  let emptyStarted: Started
  let now = 0

  const get = async (server: Started, path: string) => (await fetch(`http://127.0.0.1:${server.port}${path}`, { headers: { Authorization: `Bearer ${server.token}` } })).json()
  const knowledge = async (server = started, extraction?: string) => {
    if (extraction === undefined) delete process.env.MNEMOSYNE_EXTRACTION
    else process.env.MNEMOSYNE_EXTRACTION = extraction
    return parseKnowledge(await get(server, '/api/knowledge'))!
  }

  async function remember(owner: string, call: number, content: string, tags?: string[]) {
    const reply = body((await engineCall(CLI, store, owner, [toolCall(call, 'mnemopi_remember', { content, ...(tags ? { metadata: { tags } } : {}) })])).get(call)) as { memory_id: string }
    return reply.memory_id
  }
  async function mine(owner: string, id: string, call: number, items: Record<string, unknown>) {
    const prompt = body((await engineCall(CLI, store, owner, [toolCall(call, 'mnemopi_knowledge_prompt', { memory_id: id })])).get(call)) as { sha256: string }
    await engineCall(CLI, store, owner, [toolCall(call + 1, 'mnemopi_knowledge_store', { memory_id: id, reply: JSON.stringify(items), sha256: prompt.sha256 })])
  }

  beforeAll(async () => {
    now = Date.now()
    mkdirSync(store, { recursive: true })
    mkdirSync(emptyStore, { recursive: true })
    ids.m1 = await remember('project-alpha-1a2b', 1, 'Alpha code standards.\nAlways run typecheck.', ['standards'])
    ids.m2 = await remember('project-beta-9z8y', 2, 'Beta release note.\nMilestone v1.', ['milestone'])
    ids.m3 = await remember('project-alpha-1a2b', 3, 'Untagged note.')
    await mine('project-alpha-1a2b', ids.m1, 10, { facts: ['Mnemosyne requires Bun', MARKUP], preferences: ['User prefers tabs'], instructions: ['Always run typecheck before commit'], timelines: [], kg: [] })
    await mine('project-beta-9z8y', ids.m2, 20, { facts: [], preferences: [], instructions: [], timelines: ['Milestone v1 on 2026-11-01'], kg: [{ subject: 'Antigravity', predicate: 'powers', object: 'Mnemosyne' }] })
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      db.run('UPDATE working_memory SET recall_count = 7, last_recalled = ? WHERE id = ?', [iso(now - 2 * DAY), ids.m1])
      db.run('UPDATE working_memory SET recall_count = 1, last_recalled = ? WHERE id = ?', [iso(now - 40 * DAY), ids.m2])
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    emptyStarted = await startServer({ root: join(temp.dir, 'root2'), store: emptyStore, cli: CLI, activityLog: '', pluginRoot: ROOT })
  }, 180_000)

  afterAll(() => {
    delete process.env.MNEMOSYNE_EXTRACTION
    started?.stop()
    emptyStarted?.stop()
    temp.dispose()
  })

  const host = (shown: string[] = [], opened: string[] = []): KnowledgeHost => ({
    project: owner => {
      const span = fakeDocument.createElement('span')
      span.textContent = owner
      return span
    },
    showOnMap: id => void shown.push(id),
    open: id => void opened.push(id),
    now: () => now,
  })

  test('VIEWS.1.a1: five kinds with counts; KPIs are items, memory recalled in the last 7 days, memory never recalled', async () => {
    const data = await knowledge(started, 'claude-haiku-5-5')
    expect(KINDS.map((k: { label: string; kind: string }) => [k.label, data.items[k.kind].length])).toEqual([['Facts', 2], ['Preferences', 1], ['Instructions', 1], ['Timeline', 1], ['Relations', 1]])
    expect(total(data)).toBe(6)
    expect(kpis(data, now).map((k: { label: string; value: string }) => [k.label, k.value])).toEqual([
      ['Items', '6'],
      ['Memory recalled in the last 7 days', '4'],
      ['Items whose memory was never recalled', '0'],
    ])
    await withDocument(() => {
      const tabs = kindTabs(data, 'fact', () => {}) as unknown as FakeNode[]
      expect(tabs.map(tab => tab.texts().join(' '))).toEqual(['Facts 2', 'Preferences 1', 'Instructions 1', 'Timeline 1', 'Relations 1'])
      // Plain toggle buttons (VIEWS R2 item 6): aria-pressed, no tab role pretending to be ARIA tabs.
      expect(tabs.map(tab => tab.attributes.get('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false'])
      expect(tabs.map(tab => tab.tagName)).toEqual(['button', 'button', 'button', 'button', 'button'])
      expect(tabs.some(tab => tab.attributes.has('role') || tab.attributes.has('aria-selected'))).toBe(false)
      const picked: string[] = []
      const again = kindTabs(data, 'fact', (kind: string) => picked.push(kind)) as unknown as FakeNode[]
      again[3]!.fire('click')
      expect(picked).toEqual(['timeline'])
      const line = summaryLine(data, now) as unknown as FakeNode[]
      expect(line.map(node => node.textContent)).toEqual(['6 items', '4 recalled this week'])
      expect(neverUsedText(data, now)).toBe('Never used · 0')
    })
  })

  test('VIEWS.1.a2: rows show item, topic, project, From memory, status, used and last used; facts, timelines and relations show value or description only', async () => {
    const data = await knowledge(started, 'unknown')
    const facts = rowsOf(data, 'fact', now)
    // Newest first (KAPI.1 review fix): the second fact stored comes first.
    expect(facts.map((r: { text: string }) => r.text)).toEqual([MARKUP, 'Mnemosyne requires Bun'])
    expect(facts[0]).toMatchObject({ topic: 'standards', owner: 'project-alpha-1a2b', memory: ids.m1, status: '', recalls: 7, used: '7', last: '2 days ago', stale: false })
    // A memory not recalled for 40 days is amber.
    const timeline = rowsOf(data, 'timeline', now)[0]!
    expect(timeline).toMatchObject({ text: 'Milestone v1 on 2026-11-01', memory: ids.m2, recalls: 1, used: '1', last: '40 days ago', stale: true })
    const relation = rowsOf(data, 'relation', now)[0]!
    expect(relation.text).toBe('Antigravity powers Mnemosyne')
    expect(data.items.fact[0]!.id).toMatch(/^fact:\d+$/)
    expect(data.items.relation[0]!.id).toMatch(/^relation:\d+$/)
    expect(usedText(0)).toBe('never')
    expect(usedText(3)).toBe('3')
    expect(itemHead('timeline')).toBe('Event')
    // The table: six cells a row (seven with a Status column), Show on map hands the source memory to the map.
    await withDocument(() => {
      const shown: string[] = []
      const opened: string[] = []
      const rows = tableRows(data, 'fact', host(shown, opened)) as unknown as FakeNode[]
      expect(rows).toHaveLength(2)
      expect(rows[0]!.children).toHaveLength(6)
      const button = rows[0]!.all().find(n => n.tagName === 'button')!
      expect(button.textContent).toBe('Map \u2197')
      expect((button as unknown as { title: string }).title).toContain('Show on map')
      button.fire('click')
      expect(shown).toEqual([ids.m1])
      // The row itself opens the source memory (the bottom sheet).
      expect(rows[0]!.className).toBe('row')
      rows[0]!.fire('click')
      expect(opened).toEqual([ids.m1])
      expect(rows[0]!.texts().join('|')).toContain('7')
      const old = (tableRows(data, 'timeline', host()) as unknown as FakeNode[])[0]!
      expect((old.children[5] as FakeNode).className).toContain('is-stale')
      expect((rows[0]!.children[5] as FakeNode).className).not.toContain('is-stale')
      // An item with no source memory has nothing to show.
      const orphan = { ...data, items: { ...data.items, fact: [{ ...data.items.fact[0]!, memory: '' }] } }
      expect((tableRows(orphan, 'fact', host()) as unknown as FakeNode[])[0]!.all().find(n => n.tagName === 'button')!.disabled).toBe(true)
    })
  })

  test('VIEWS.1.a2 (cross): the Status cell of the real /api/knowledge reply reads active for an instruction and confidence 0.7 for a relation', async () => {
    // No hand-made rows: the engine stored them (instructions active, kg at 0.7 by C6), the real server sent them.
    const raw = (await get(started, '/api/knowledge')) as { instructions: Record<string, unknown>[]; relations: Record<string, unknown>[] }
    expect(raw.instructions[0]!.active).toBe(true)
    expect(raw.relations[0]!.confidence).toBe(0.7)
    const data = parseKnowledge(raw)!
    expect(rowsOf(data, 'instruction', now).map((r: { status: string }) => r.status)).toEqual(['active'])
    expect(rowsOf(data, 'relation', now).map((r: { status: string }) => r.status)).toEqual(['confidence 0.7'])
    for (const kind of ['fact', 'preference', 'timeline']) expect(rowsOf(data, kind, now).every((r: { status: string }) => r.status === '')).toBe(true)
    // The fifth cell of the drawn row is the status.
    await withDocument(() => {
      expect(((tableRows(data, 'instruction', host()) as unknown as FakeNode[])[0]!.children[4] as FakeNode).textContent).toBe('active')
      expect(((tableRows(data, 'relation', host()) as unknown as FakeNode[])[0]!.children[4] as FakeNode).textContent).toBe('confidence 0.7')
    })
  })

  test('QAPAGE item 3: each cell of a row has the class the phone card rules place it by, and the card labels (kind, Status, Used, Last used)', async () => {
    const data = await knowledge(started, 'claude-haiku-5-5')
    await withDocument(() => {
      for (const [kind, head] of [['instruction', 'Instruction'], ['fact', 'Fact'], ['relation', 'Relation']] as const) {
        const row = (tableRows(data, kind, host()) as unknown as FakeNode[])[0]!
        const cells = row.children as FakeNode[]
        expect(cells.map(cell => cell.className.split(' ').find(name => name.startsWith('k-')))).toEqual(kind === 'fact' ? ['k-text', 'k-topic', 'k-project', 'k-from', 'k-used', 'k-last'] : ['k-text', 'k-topic', 'k-project', 'k-from', 'k-status', 'k-used', 'k-last'])
        // The card reads: the kind above the text, then Status / Used / Last used each with its label.
        expect(cells.map(cell => cell.dataset.label ?? null)).toEqual(kind === 'fact' ? [head, null, null, null, 'Used', 'Last used'] : [head, null, null, null, 'Status', 'Used', 'Last used'])
      }
      // A stale item keeps both classes: the amber and the card placement.
      const old = (tableRows(data, 'timeline', host()) as unknown as FakeNode[])[0]!
      expect((old.children[5] as FakeNode).className.split(' ')).toEqual(expect.arrayContaining(['is-stale', 'k-last']))
    })
  })

  test('statusOf (pure unit, hand-made items): active or retired, confidence, blank when absent or for other kinds', async () => {
    const data = await knowledge(started)
    expect(statusOf({ ...data.items.instruction[0]!, active: null })).toBe('')
    expect(statusOf({ ...data.items.instruction[0]!, active: false })).toBe('retired')
    expect(statusOf({ ...data.items.relation[0]!, confidence: null })).toBe('')
    expect(statusOf({ ...data.items.fact[0]!, active: false, confidence: 0.2 })).toBe('')
    // The parse reads a stored 0/1 as a boolean and drops a non-number confidence.
    const parsed = parseKnowledge({ instructions: [{ id: 'instruction:1', active: 0 }], relations: [{ id: 'relation:1', confidence: 'high' }] })!
    expect(parsed.items.instruction[0]!.active).toBe(false)
    expect(parsed.items.relation[0]!.confidence).toBeNull()
  })

  test('VIEWS.1.a3: extraction as a model id, off and unknown each get a status line; off and an empty store get a notice', async () => {
    const model = await knowledge(started, 'claude-haiku-5-5')
    expect(model.extraction).toBe('claude-haiku-5-5')
    expect(extractionState(model.extraction)).toMatchObject({ mode: 'on' })
    expect(extractionState(model.extraction).status).toContain('claude-haiku-5-5')
    expect(notice(model)).toBeNull()

    const off = await knowledge(started, 'off')
    expect(off.extraction).toBe('off')
    const offState = extractionState('off')
    expect(offState.mode).toBe('off')
    expect(offState.status).toContain('extractionModel')
    expect(offState.status).toContain('restart the dashboard')
    expect(notice(off)).toMatchObject({ title: 'Extraction is off.' })
    expect(notice(off)!.body).toContain('extractionModel')
    expect(notice(off)!.body).toContain('/mnemosyne-knowledge')
    expect(notice(off)!.body).toContain('restart the dashboard')

    const unknown = await knowledge(started)
    expect(unknown.extraction).toBe('unknown')
    expect(extractionState('unknown').mode).toBe('unknown')
    expect(extractionState('unknown').status).toContain('extractionModel')
    // Unknown is treated as on: with items there is no off notice.
    expect(notice(unknown)).toBeNull()

    // An empty store: the notice says so, for each state of extraction, and says how to fill it.
    for (const extraction of ['claude-haiku-5-5', 'off', undefined]) {
      const empty = await knowledge(emptyStarted, extraction)
      expect(total(empty)).toBe(0)
      const note = notice(empty)!
      expect(note).not.toBeNull()
      expect(note.body).toContain('/mnemosyne-knowledge')
      expect(note.body).toContain('extractionModel')
      expect(kpis(empty, now).map((k: { value: string }) => k.value)).toEqual(['0', '0', '0'])
      await withDocument(() => {
        const rows = tableRows(empty, 'fact', host()) as unknown as FakeNode[]
        expect(rows).toHaveLength(1)
        expect(rows[0]!.texts()).toEqual(['Nothing of this kind yet.'])
      })
    }
    expect(notice(await knowledge(emptyStarted, 'off'))!.title).toBe('Extraction is off.')
    expect(notice(await knowledge(emptyStarted))!.title).toBe('No knowledge items yet.')
  })

  test('VIEWS.1.a4: a hostile string in a knowledge row stays text, in the row and on the tabs', async () => {
    const data = await knowledge(started)
    await withDocument(() => {
      const rows = tableRows(data, 'fact', host()) as unknown as FakeNode[]
      const nodes = rows.flatMap(row => row.all())
      expect(rows[0]!.texts()).toContain(MARKUP)
      expect(nodes.map(n => n.tagName).filter(tag => !['tr', 'td', 'button', 'span'].includes(tag))).toEqual([])
      expect(nodes.some(n => [...n.attributes.keys()].some(name => /^on/i.test(name)))).toBe(false)
    })
    // A reply with hostile project and topic names and a row of the wrong shape.
    const odd = parseKnowledge({
      extraction: MARKUP,
      facts: [{ id: 'fact:1', text: MARKUP, owner: MARKUP, source_memory_id: 'x', topic: MARKUP, recalls: 'many', usage: { recalls: 4 } }, { nope: 1 }, 'junk', null],
      preferences: 'not a list',
    })!
    expect(odd.items.fact).toHaveLength(1)
    expect(odd.items.fact[0]).toMatchObject({ text: MARKUP, topic: MARKUP, recalls: 4 })
    expect(extractionState(odd.extraction).status).toContain(MARKUP)
    expect(parseKnowledge(null)).toBeNull()
    expect(parseKnowledge([])).toBeNull()
    expect(parseKnowledge({})!.extraction).toBe('unknown')
  })

  test('item 4: past the server cap the kind tab and the Items KPI say showing N of M (real server, more rows than the cap)', async () => {
    const big = join(temp.dir, 'big')
    mkdirSync(big, { recursive: true })
    const db = new Database(join(big, 'mnemopi.db'))
    try {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER, last_recalled TEXT, metadata_json TEXT)')
      db.run("INSERT INTO working_memory VALUES ('m1', 'p1', 'x', '2026-10-01', 0, NULL, NULL)")
      db.run('CREATE TABLE memoria_facts (id INTEGER PRIMARY KEY, session_id TEXT, value TEXT, source_memory_id TEXT)')
      db.run('CREATE TABLE memoria_preferences (id INTEGER PRIMARY KEY, session_id TEXT, preference TEXT, source_memory_id TEXT)')
      const insert = db.prepare("INSERT INTO memoria_facts (session_id, value, source_memory_id) VALUES ('p1', ?, 'm1')")
      db.transaction(() => {
        for (let i = 1; i <= GALAXY_LIMIT + 5; i++) insert.run(`fact ${i}`)
      })()
      db.run("INSERT INTO memoria_preferences (session_id, preference, source_memory_id) VALUES ('p1', 'tabs', 'm1')")
    } finally {
      db.close()
    }
    const bigStarted = await startServer({ root: join(temp.dir, 'root3'), store: big, cli: CLI, activityLog: '', pluginRoot: ROOT })
    try {
      const data = await knowledge(bigStarted)
      expect(data.items.fact).toHaveLength(GALAXY_LIMIT)
      expect(data.totals).toEqual({ fact: GALAXY_LIMIT + 5, preference: 1, instruction: 0, timeline: 0, relation: 0 })
      expect(kpis(data, now)[0]).toEqual({ label: 'Items', value: `showing ${GALAXY_LIMIT + 1} of ${GALAXY_LIMIT + 6}` })
      await withDocument(() => {
        const tabs = kindTabs(data, 'fact', () => {}) as unknown as FakeNode[]
        expect(tabs.map(tab => tab.texts().join(' '))).toEqual([`Facts showing ${GALAXY_LIMIT} of ${GALAXY_LIMIT + 5}`, 'Preferences 1', 'Instructions 0', 'Timeline 0', 'Relations 0'])
      })
    } finally {
      bigStarted.stop()
    }
    // Under the cap the plain count stays; a reply without total counts what arrived.
    expect(countText(3, 3)).toBe('3')
    expect(parseKnowledge({ facts: [{ id: 'fact:1' }] })!.totals.fact).toBe(1)
    expect(parseKnowledge({ facts: [{ id: 'fact:1' }], total: { facts: 'lots' } })!.totals.fact).toBe(1)
  })

  test('days: whole days ago, today and yesterday', () => {
    expect(daysAgo(iso(now - 3 * DAY - 5000), now)).toBe(3)
    expect(daysAgo(null, now)).toBeNull()
    expect(daysAgo('not a date', now)).toBeNull()
    expect(agoText(iso(now - 1000), now)).toBe('today')
    expect(agoText(iso(now - DAY - 1000), now)).toBe('yesterday')
    expect(agoText(iso(now - 12 * DAY), now)).toBe('12 days ago')
    expect(agoText(null, now)).toBe('')
  })

  test('filterItems: project, never used, text and sort; hasStatus and usedBar', async () => {
    const data = await knowledge(started, 'unknown')
    const facts = data.items.fact as { owner: string; recalls: number; text: string; lastRecalled: string | null }[]
    const base = { owner: '', neverUsed: false, text: '', sort: 'newest' }
    expect(filterItems(facts, base)).toEqual(facts)
    expect(filterItems(facts, { ...base, owner: 'nobody' })).toEqual([])
    expect(filterItems(facts, { ...base, owner: facts[0]!.owner }).every((i: { owner: string }) => i.owner === facts[0]!.owner)).toBe(true)
    const mk = (text: string, recalls: number, lastRecalled: string | null) => ({ ...facts[0]!, text, recalls, lastRecalled, topic: null })
    const items = [mk('a', 0, null), mk('b', 5, '2026-01-01T00:00:00Z'), mk('c', 2, '2026-03-01T00:00:00Z'), mk('d', 0, null)]
    const names = (f: object) => filterItems(items, { ...base, ...f }).map((i: { text: string }) => i.text).join('')
    expect(names({})).toBe('abcd')
    expect(names({ sort: 'most' })).toBe('bcad')
    expect(names({ sort: 'least' })).toBe('adcb')
    expect(names({ sort: 'last' })).toBe('cbad')
    expect(names({ neverUsed: true })).toBe('ad')
    expect(names({ text: ' B ' })).toBe('b')
    expect(hasStatus('instruction') && hasStatus('relation')).toBe(true)
    expect(['fact', 'preference', 'timeline'].some(hasStatus)).toBe(false)
    expect(usedBar(0, 0)).toBe('w0')
    expect(usedBar(5, 5)).toBe('w20')
    expect(usedBar(1, 4)).toBe('w5')
    expect(ownersOf(data)).toEqual([...new Set(ownersOf(data))])
    await withDocument(() => {
      const rows = tableRows(data, 'fact', host(), { ...base, text: 'zzz-no-match' }) as unknown as FakeNode[]
      expect(rows).toHaveLength(1)
      expect(rows[0]!.texts().join('')).toBe('Nothing matches these filters.')
    })
  })

  test('VIEWS.1.a4: the page has the Knowledge tab, its markup, and tsc covers the new files', () => {
    const app = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    expect(app).toMatch(/const VIEWS = \['map', 'memories', 'activity', 'search', 'knowledge', 'review', 'health', 'settings'\] as const/)
    expect(app).toMatch(/knowledge: 'Knowledge', review: 'Review', health: 'Health', settings: 'Settings'/)
    for (const id of ['view-knowledge', 'view-review', 'review-status', 'review-retry', 'review-title', 'review-body', 'view-health', 'know-status', 'know-notice', 'know-tabs', 'know-summary', 'know-owner', 'know-sort', 'know-find', 'know-never', 'know-status-head', 'know-rows', 'know-item-head', 'know-body', 'know-retry', 'health-status', 'health-retry', 'health-title']) expect(html).toContain(`id="${id}"`)
    // Plain toggle buttons in a labelled group: no tablist without tabpanels and arrow keys.
    expect(html).toContain('<div id="know-tabs" class="chips" role="group" aria-label="Knowledge kind">')
    expect(html).not.toMatch(/role="tab(list)?"/)
    // Every id the Knowledge and Health code looks up is in the markup.
    const wanted = [...app.matchAll(/byId(?:<[^>]*>)?\('((?:know|health|review)-[^']+)'\)/g)].map(m => m[1]!)
    expect(wanted.length).toBeGreaterThan(15)
    const have = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]!))
    expect(wanted.filter(id => !have.has(id))).toEqual([])
    // Phone width: the table scrolls in its box; no inline style or script.
    expect(html).toMatch(/<div class="table-wrap">\s*<table class="table know-table">\s*<thead>\s*<tr><th id="know-item-head">/)
    expect(html.slice(html.indexOf('id="view-knowledge"'), html.indexOf('<footer'))).not.toMatch(/\sstyle=|<script|\son\w+=/)
    const tsconfig = JSON.parse(readFileSync(join(ROOT, 'ui', 'tsconfig.json'), 'utf8')) as { include: string[] }
    expect(tsconfig.include).toEqual(expect.arrayContaining(['knowledge.ts', 'health.ts', 'review.ts']))
    // The tabs are built in this order, like the others.
    expect(app.indexOf("'search', 'knowledge', 'review', 'health'")).toBeGreaterThan(0)
    // The data comes only from the two endpoints, through the page's api().
    expect(app).toContain("api('/api/knowledge')")
    expect(app).toContain("api('/api/health-report')")
  })
})

