// The Knowledge tab (plan VIEWS.1; the mockup is design/Knowledge.dc.html): what the
// extractor mined from memories (facts, preferences, instructions, dated events,
// relations), where each item came from, and how often its source memory is recalled.
//
// The data is GET /api/knowledge (KAPI.1). The functions here are pure (no DOM) except
// the few `draw*` builders at the end, which make elements with createElement and
// textContent only: no HTML is ever parsed from data (tests/bun/inert.spec.ts scans
// this file). ui/app.ts fetches the reply and calls them.
import { plainLabel } from './escape'
import { buildGalaxy, GLOBAL_COLOUR, projectColour } from './map-state'

export type KnowledgeKind = 'fact' | 'preference' | 'instruction' | 'timeline' | 'relation'

// 0.20.0: no colour of their own (a fifth palette); each kind shows the memory-kind glyph of the same shape (`glyph`).
export const KINDS: readonly { kind: KnowledgeKind; list: 'facts' | 'preferences' | 'instructions' | 'timelines' | 'relations'; label: string; head: string; glyph: string; one: string; many: string }[] = [
  { kind: 'fact', list: 'facts', label: 'Facts', head: 'Fact', glyph: 'fact', one: 'fact', many: 'facts' },
  { kind: 'preference', list: 'preferences', label: 'Preferences', head: 'Preference', glyph: 'preference', one: 'preference', many: 'preferences' },
  { kind: 'instruction', list: 'instructions', label: 'Instructions', head: 'Instruction', glyph: 'instruction', one: 'instruction', many: 'instructions' },
  { kind: 'timeline', list: 'timelines', label: 'Timeline', head: 'Event', glyph: 'event', one: 'event', many: 'events' },
  { kind: 'relation', list: 'relations', label: 'Relations', head: 'Relation', glyph: 'relation', one: 'relation', many: 'relations' },
]

/** "3 facts", "1 event". */
export const kindCount = (kind: KnowledgeKind, n: number) => {
  const k = KINDS.find(entry => entry.kind === kind)!
  return `${n} ${n === 1 ? k.one : k.many}`
}

export type KnowledgeItem = {
  /** '<kind>:<rowid>' (C6). */
  id: string
  kind: KnowledgeKind
  text: string
  owner: string
  /** The memory it was mined from. */
  memory: string
  topic: string | null
  /** Times its source memory was recalled (all time), and when last. */
  recalls: number
  lastRecalled: string | null
  /** An instruction's state, when the reply carries one. */
  active: boolean | null
  /** A relation's confidence, when the reply carries one. */
  confidence: number | null
  /** The source memory's scope (0.20.0; null from older servers or when unknown). */
  scope: string | null
  /** A relation's subject, link and object (0.20.0; null for other kinds and older servers). */
  parts: { subject: string; predicate: string; object: string } | null
}

/** `totals` per kind: how many the store holds; the server sends at most 2000 a kind (`items` holds those). */
export type KnowledgeData = { extraction: string; items: Record<KnowledgeKind, KnowledgeItem[]>; totals: Record<KnowledgeKind, number> }

const TEXT_CHARS = 200
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const whole = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

/** A /api/knowledge reply made safe to use; null when it is no object. A row of the wrong shape is dropped. */
export function parseKnowledge(body: unknown): KnowledgeData | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const raw = body as Record<string, unknown>
  const items = { fact: [], preference: [], instruction: [], timeline: [], relation: [] } as Record<KnowledgeKind, KnowledgeItem[]>
  const totals = { fact: 0, preference: 0, instruction: 0, timeline: 0, relation: 0 } as Record<KnowledgeKind, number>
  const counted = raw.total !== null && typeof raw.total === 'object' ? (raw.total as Record<string, unknown>) : {}
  for (const { kind, list } of KINDS) {
    const rows = raw[list]
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (row === null || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      if (typeof r.id !== 'string' || r.id === '') continue
      const usage = r.usage !== null && typeof r.usage === 'object' ? (r.usage as Record<string, unknown>) : {}
      items[kind].push({
        id: r.id,
        kind,
        text: plainLabel(text(r.text) || text(r.item), TEXT_CHARS),
        owner: text(r.owner),
        memory: text(r.source_memory_id),
        topic: typeof r.topic === 'string' && r.topic !== '' ? plainLabel(r.topic, 40) : null,
        recalls: whole(typeof r.recalls === 'number' ? r.recalls : usage.recalls),
        lastRecalled: typeof r.lastRecalled === 'string' ? r.lastRecalled : typeof usage.lastRecalled === 'string' ? usage.lastRecalled : null,
        active: typeof r.active === 'boolean' ? r.active : typeof r.active === 'number' ? r.active !== 0 : null,
        confidence: typeof r.confidence === 'number' && Number.isFinite(r.confidence) ? r.confidence : null,
        scope: typeof r.scope === 'string' && r.scope !== '' ? r.scope : null,
        parts:
          kind === 'relation' && text(r.subject) !== '' && text(r.object) !== ''
            ? { subject: plainLabel(text(r.subject), 60), predicate: plainLabel(text(r.predicate), 60), object: plainLabel(text(r.object), 60) }
            : null,
      })
    }
  }
  // The store's count, never below what arrived.
  for (const { kind, list } of KINDS) totals[kind] = Math.max(whole(counted[list]), items[kind].length)
  return { extraction: text(raw.extraction) || 'unknown', items, totals }
}

/**
 * The Map's project colours, for every tab: the colour buildGalaxy (ui/map-state.ts) gives each owner of a store
 * that holds these owners (it sorts them by name and takes the palette in turn; global is grey). The Map's own
 * function, so a project has one colour everywhere.
 */
export function ownerColours(owners: readonly string[]): Map<string, string> {
  const galaxy = buildGalaxy({ projects: [...new Set(owners)].map(owner => ({ owner, label: owner, count: 0, recalls: 0 })), memories: [], knowledge: [], meaning: false, total: 0, shown: 0 })
  return new Map([...new Set(owners)].map(owner => [owner, projectColour(galaxy, owner)]))
}

/** One owner's colour: its Map colour, grey for global, 'all' or an owner the store does not list. */
export const ownerColour = (colours: ReadonlyMap<string, string>, owner: string | undefined): string => (owner === undefined || owner === 'all' ? GLOBAL_COLOUR : (colours.get(owner) ?? GLOBAL_COLOUR))

/** The Map's palette in the order it hands colours out, read off a store of many owners. */
const SLOTS = [...new Set(ownerColours(Array.from({ length: 64 }, (_, i) => `probe-${String(i).padStart(2, '0')}`)).values())]

/** The CSS class that paints a project dot in `colour` (ui/style.css: .c0, .c1 … are the Map's palette in that order, .c-global its grey). The CSP refuses inline styles, so a colour is a class. */
export const dotClass = (colour: string): string => {
  const slot = SLOTS.indexOf(colour)
  return slot < 0 ? 'c-global' : `c${slot}`
}

export const total = (data: KnowledgeData) => KINDS.reduce((sum, { kind }) => sum + data.items[kind].length, 0)
/** Every item the store holds, shown or not. */
export const storeTotal = (data: KnowledgeData) => KINDS.reduce((sum, { kind }) => sum + data.totals[kind], 0)

/** A count, or 'showing n of m' when the server cut the list. */
export const countText = (shown: number, all: number) => (shown < all ? `showing ${shown} of ${all}` : String(shown))

const DAY_MS = 86_400_000

/** Whole days from an ISO time to `now`, or null when there is no time. */
export function daysAgo(value: string | null | undefined, now: number): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY_MS)) : null
}

/** 'today', 'yesterday', 'n days ago'; '' when there is no time. */
export function agoText(value: string | null | undefined, now: number): string {
  const days = daysAgo(value, now)
  if (days === null) return ''
  return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}

export const STALE_DAYS = 30

export type Kpi = { label: string; value: string }

/** Items, items whose memory was recalled in the last 7 days, items whose memory was never recalled (items, not memories: one memory can hold several). */
export function kpis(data: KnowledgeData, now: number): Kpi[] {
  const all = KINDS.flatMap(({ kind }) => data.items[kind])
  const recent = all.filter(item => {
    const days = daysAgo(item.lastRecalled, now)
    return days !== null && days <= 7
  }).length
  return [
    { label: 'Items', value: countText(all.length, storeTotal(data)) },
    { label: 'Memory recalled in the last 7 days', value: String(recent) },
    { label: 'Items whose memory was never recalled', value: String(all.filter(item => item.recalls === 0).length) },
  ]
}

export type ExtractionState = { mode: 'on' | 'off' | 'unknown'; status: string }

/** The extraction line: a model id means it is on; `off` and `unknown` say how to turn it on (C11). */
export function extractionState(extraction: string): ExtractionState {
  if (extraction === 'off') return { mode: 'off', status: 'Extraction is off. To turn it on, set extractionModel in the plugin settings and restart the dashboard (/mnemosyne-ui).' }
  if (extraction === 'unknown' || extraction === '') return { mode: 'unknown', status: 'This dashboard was started without the extraction setting, so it cannot say whether extraction is on. To be sure, set extractionModel in the plugin settings and restart the dashboard (/mnemosyne-ui).' }
  return { mode: 'on', status: `Extraction is on (model ${plainLabel(extraction, 60)}). It runs in the background after each save.` }
}

/** A notice when extraction is off or the store holds no items; null otherwise ('unknown' counts as on). */
export function notice(data: KnowledgeData): { title: string; body: string } | null {
  const count = total(data)
  const state = extractionState(data.extraction)
  if (state.mode === 'off') {
    return { title: 'Extraction is off.', body: `${count === 0 ? 'The store holds no knowledge items yet.' : `The ${count} items below were mined while it was on.`} Turn it on with extractionModel in the plugin settings, then restart the dashboard (/mnemosyne-ui); then run /mnemosyne-knowledge to backfill older memories.` }
  }
  if (count === 0) {
    return { title: 'No knowledge items yet.', body: 'Items appear here once extraction has run on a saved memory. Check extractionModel in the plugin settings (restart the dashboard after changing it), or run /mnemosyne-knowledge to backfill older memories.' }
  }
  return null
}

export type Row = {
  id: string
  text: string
  topic: string
  owner: string
  memory: string
  status: string
  /** Times the source memory was recalled; 'used' is its cell text ('never' for 0). */
  recalls: number
  used: string
  last: string
  stale: boolean
  /** The item itself (0.20.0): a relation's parts, an instruction's state, a relation's confidence. */
  item?: KnowledgeItem
}

// ---- 0.20.0: KPI tiles, quick states, top topics, project › topic groups, siblings ----

export type Tiles = { items: string; memories: number; perKind: string; week: number; quiet: number; never: number }

/** The four tiles: items (from how many memories, and per kind), recalled this week, gone quiet, never used (all items, any filter aside). */
export function kpiTiles(data: KnowledgeData, now: number): Tiles {
  const all = KINDS.flatMap(({ kind }) => data.items[kind])
  return {
    items: countText(all.length, storeTotal(data)),
    memories: new Set(all.map(item => item.memory).filter(id => id !== '')).size,
    perKind: KINDS.filter(({ kind }) => data.totals[kind] > 0)
      .map(({ kind }) => kindCount(kind, data.totals[kind]))
      .join(' · '),
    week: all.filter(item => {
      const days = daysAgo(item.lastRecalled, now)
      return days !== null && days <= 7
    }).length,
    quiet: all.filter(item => isQuiet(item, now)).length,
    never: all.filter(item => item.recalls === 0).length,
  }
}

export type QuickState = 'all' | 'quiet' | 'never'
export const stateOf = (filter: KnowledgeFilter): QuickState => (filter.neverUsed ? 'never' : filter.quiet ? 'quiet' : 'all')
export const withState = (filter: KnowledgeFilter, state: QuickState): KnowledgeFilter => ({ ...filter, neverUsed: state === 'never', quiet: state === 'quiet' })

/** The counts on All / Gone quiet / Never used: this kind under the other filters (project, topic, text). */
export function quickCounts(items: readonly KnowledgeItem[], filter: KnowledgeFilter, now: number): Record<QuickState, number> {
  const base = filterItems(items, { ...filter, neverUsed: false, quiet: false }, now)
  return { all: base.length, quiet: base.filter(item => isQuiet(item, now)).length, never: base.filter(item => item.recalls === 0).length }
}

/** The topics of these items (under the project filter only), most first, then by name. */
export function topTopics(items: readonly KnowledgeItem[], owner: string): [string, number][] {
  const counts = new Map<string, number>()
  for (const item of items) if (item.topic && (owner === '' || item.owner === owner)) counts.set(item.topic, (counts.get(item.topic) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export const NO_TOPIC = 'no topic'

export type TopicGroup = { topic: string; rows: Row[] }
export type ProjectGroup = {
  owner: string
  count: number
  /** How many of its items came from a memory shared with every project (scope global). */
  shared: number
  topics: TopicGroup[]
  /** The fewest and most recalls of its source memories, and the newest recall. */
  minRecalls: number
  maxRecalls: number
  lastRecalled: string | null
}

/** The rows grouped by project, then topic: global first, then the larger groups; topics by size; rows keep the sort. */
export function groupRows(rows: readonly Row[]): ProjectGroup[] {
  const groups = new Map<string, Row[]>()
  for (const row of rows) groups.set(row.owner, [...(groups.get(row.owner) ?? []), row])
  return [...groups]
    .map(([owner, list]) => {
      const topics = new Map<string, Row[]>()
      for (const row of list) topics.set(row.topic || NO_TOPIC, [...(topics.get(row.topic || NO_TOPIC) ?? []), row])
      const recalls = list.map(row => row.recalls)
      const times = list.map(row => row.item?.lastRecalled ?? null).filter((t): t is string => t !== null)
      return {
        owner,
        count: list.length,
        shared: list.filter(row => row.item?.scope === 'global').length,
        topics: [...topics].map(([topic, items]) => ({ topic, rows: items })).sort((a, b) => b.rows.length - a.rows.length || (a.topic === NO_TOPIC ? 1 : b.topic === NO_TOPIC ? -1 : a.topic.localeCompare(b.topic))),
        minRecalls: Math.min(...recalls),
        maxRecalls: Math.max(...recalls),
        lastRecalled: times.length === 0 ? null : times.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b)),
      }
    })
    .sort((a, b) => (a.owner === 'global' ? -1 : b.owner === 'global' ? 1 : b.count - a.count || a.owner.localeCompare(b.owner)))
}

/** "recalled 15×", "recalled 1–4×", "never recalled". */
export function recallRange(min: number, max: number): string {
  if (max === 0) return 'never recalled'
  return min === max ? `recalled ${max}×` : `recalled ${min}–${max}×`
}

/** The other items mined from the same memory, any kind. */
export function siblings(data: KnowledgeData, memory: string, except: string): KnowledgeItem[] {
  if (memory === '') return []
  return KINDS.flatMap(({ kind }) => data.items[kind]).filter(item => item.memory === memory && item.id !== except)
}

/** A relation's confidence as 0 to 5 lit pips (null: none). */
export const confidenceLit = (confidence: number | null) => (confidence === null ? 0 : Math.max(0, Math.min(5, Math.round(confidence * 5))))

/** The status cell: an instruction is active or retired, a relation shows its confidence; else blank. */
export function statusOf(item: KnowledgeItem): string {
  if (item.kind === 'instruction') return item.active === null ? '' : item.active ? 'active' : 'retired'
  if (item.kind === 'relation') return item.confidence === null ? '' : `confidence ${item.confidence}`
  return ''
}

/** The Used cell: how many times the memory the item came from was recalled; 'never' for none. */
export const usedText = (recalls: number) => (recalls === 0 ? 'never' : String(recalls))

/** What the Used column heading says on hover (the column itself shows only the number). */
export const USED_HINT = 'How many times the memory this item came from was recalled (all time). The engine keeps no usage count of its own for these items.'

/** Whether a kind has a Status column: only instructions (active or retired) and relations (confidence) have values. */
export const hasStatus = (kind: KnowledgeKind) => kind === 'instruction' || kind === 'relation'

/** The width class of a Used bar, in twentieths (ui/style.css .w0 … .w20): this item's recalls against the most in the list. */
export const usedBar = (recalls: number, most: number) => `w${most <= 0 ? 0 : Math.round(Math.min(1, Math.max(0, recalls / most)) * 20)}`

export type KnowledgeSort = 'newest' | 'most' | 'least' | 'last'
/**
 * The filter. `neverUsed`: only items whose memory was never recalled. `quiet` (0.20.0): only items whose memory was
 * recalled, but not in the last STALE_DAYS days ("gone quiet"). `topic` (0.20.0): one topic, exactly.
 */
export type KnowledgeFilter = { owner: string; neverUsed: boolean; quiet?: boolean; topic?: string; text: string; sort: KnowledgeSort }
export const NO_FILTER: KnowledgeFilter = { owner: '', neverUsed: false, quiet: false, topic: '', text: '', sort: 'newest' }

/** Gone quiet: recalled once, but not in the last STALE_DAYS days. */
export function isQuiet(item: Pick<KnowledgeItem, 'lastRecalled'>, now: number): boolean {
  const days = daysAgo(item.lastRecalled, now)
  return days !== null && days > STALE_DAYS
}

/** The items that pass the filter, in the chosen order. 'newest' keeps the reply's order (the server sends newest first); the other sorts are stable. */
export function filterItems(items: readonly KnowledgeItem[], filter: KnowledgeFilter, now = Date.now()): KnowledgeItem[] {
  const needle = filter.text.trim().toLowerCase()
  const kept = items.filter(item => {
    if (filter.owner !== '' && item.owner !== filter.owner) return false
    if (filter.neverUsed && item.recalls !== 0) return false
    if (filter.quiet && !isQuiet(item, now)) return false
    if (filter.topic && (item.topic ?? '') !== filter.topic) return false
    return needle === '' || item.text.toLowerCase().includes(needle) || (item.topic ?? '').toLowerCase().includes(needle)
  })
  const time = (item: KnowledgeItem) => (item.lastRecalled === null ? Number.NaN : Date.parse(item.lastRecalled))
  const order = kept.map((item, index) => ({ item, index }))
  if (filter.sort === 'most') order.sort((a, b) => b.item.recalls - a.item.recalls || a.index - b.index)
  else if (filter.sort === 'least') order.sort((a, b) => a.item.recalls - b.item.recalls || a.index - b.index)
  else if (filter.sort === 'last') {
    // Most recently used first; an item never used goes last.
    order.sort((a, b) => {
      const x = time(a.item)
      const y = time(b.item)
      if (Number.isNaN(x) || Number.isNaN(y)) return Number.isNaN(x) === Number.isNaN(y) ? a.index - b.index : Number.isNaN(x) ? 1 : -1
      return y - x || a.index - b.index
    })
  }
  return order.map(entry => entry.item)
}

/** The owners the loaded items belong to, sorted, for the project select. */
export const ownersOf = (data: KnowledgeData): string[] => [...new Set(KINDS.flatMap(({ kind }) => data.items[kind].map(item => item.owner)))].filter(owner => owner !== '').sort()

/** The rows of one kind, filtered and sorted (the reply's order by default): item, topic, project, source memory, status, used, last used (stale over 30 days). */
export function rowsOf(data: KnowledgeData, kind: KnowledgeKind, now: number, filter: KnowledgeFilter = NO_FILTER): Row[] {
  return filterItems(data.items[kind], filter, now).map(item => {
    const days = daysAgo(item.lastRecalled, now)
    return {
      id: item.id,
      text: item.text,
      topic: item.topic ?? '',
      owner: item.owner,
      memory: item.memory,
      status: statusOf(item),
      recalls: item.recalls,
      used: usedText(item.recalls),
      last: item.lastRecalled === null ? 'never' : agoText(item.lastRecalled, now) || 'never',
      stale: days !== null && days > STALE_DAYS,
      item,
    }
  })
}

// ---- Elements: createElement and textContent only ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string, className?: string) {
  const element = document.createElement(tag)
  if (content !== undefined) element.textContent = content
  if (className) element.className = className
  return element
}

export type KnowledgeHost = {
  /** The project's readable name and colour dot. */
  project: (owner: string) => HTMLElement
  /** Show on map: select the source star (MapView.show, C10). */
  showOnMap: (memoryId: string) => void
  /** A row picked: its source memory in the bottom sheet; focus goes back to the row on close. */
  open: (memoryId: string, row: HTMLElement) => void
  now: () => number
  /** 0.20.0, optional: a kind glyph (the memory kinds' shapes), and the reach marker of a group. */
  glyph?: (kind: string) => HTMLElement
  reach?: (reach: 'all' | 'shared') => HTMLElement
  /**
   * 0.20.0, optional: a row click toggles its source panel instead of opening the memory. `expanded` is the open
   * row's item id; `detail` builds the panel. Without `toggle` a click opens the memory, as before.
   */
  toggle?: (itemId: string) => void
  expanded?: () => string
  detail?: (row: Row) => HTMLElement
}

/** The kind tabs with their counts: plain toggle buttons (aria-pressed), not ARIA tabs; a glyph (0.20.0) instead of a coloured dot. */
export function kindTabs(data: KnowledgeData, selected: KnowledgeKind, pick: (kind: KnowledgeKind) => void, glyph?: (kind: string) => HTMLElement): HTMLElement[] {
  return KINDS.map(({ kind, label, glyph: shape }, index) => {
    const button = el('button', undefined, 'know-tab')
    button.type = 'button'
    button.setAttribute('aria-pressed', String(kind === selected))
    button.dataset.kind = kind
    button.title = `${label} (key ${index + 1})`
    if (glyph) button.append(glyph(shape))
    button.append(el('span', label), el('span', countText(data.items[kind].length, data.totals[kind]), 'know-tab-n mono'))
    button.addEventListener('click', () => pick(kind))
    return button
  })
}
/** The summary as stats: '257 items', '193 recalled this week'; the never-used count rides on the Never used toggle (neverUsedText). */
export function summaryLine(data: KnowledgeData, now: number): HTMLElement[] {
  const [all, recent] = kpis(data, now)
  const stat = (value: string, words: string, title: string) => {
    const span = el('span', undefined, 'k-stat')
    span.title = title
    span.append(el('strong', value), document.createTextNode(` ${words}`))
    return span
  }
  return [
    stat(all!.value, 'items', 'Items of every kind the engine mined'),
    stat(recent!.value, 'recalled this week', 'Items whose memory was recalled in the last 7 days'),
  ]
}

/** The Never used toggle's words, with its count: 'Never used · 64'. */
export const neverUsedText = (data: KnowledgeData, now: number) => `Never used · ${kpis(data, now)[2]!.value}`

/** The column count of a kind's table (the Status column only for instructions and relations). */
export const columnsOf = (kind: KnowledgeKind) => (hasStatus(kind) ? 7 : 6)

/** One full-width row: a note, a group or topic heading, or a source panel. */
function wideRow(kind: KnowledgeKind, className: string, ...content: (HTMLElement | Text)[]) {
  const tr = el('tr', undefined, className)
  const td = el('td')
  td.colSpan = columnsOf(kind)
  td.append(...content)
  tr.append(td)
  return tr
}

/** The table rows of one kind; an empty kind (or a filter that matches nothing) says so in one row. */
export function tableRows(data: KnowledgeData, kind: KnowledgeKind, host: KnowledgeHost, filter: KnowledgeFilter = NO_FILTER): HTMLElement[] {
  const rows = rowsOf(data, kind, host.now(), filter)
  if (rows.length === 0) return [emptyRow(data, kind)]
  const most = Math.max(...rows.map(row => row.recalls))
  return rows.flatMap(row => itemRows(row, kind, host, most))
}

function emptyRow(data: KnowledgeData, kind: KnowledgeKind) {
  const tr = el('tr')
  const td = el('td', data.items[kind].length === 0 ? 'Nothing of this kind yet.' : 'Nothing matches these filters.', 'muted')
  td.colSpan = columnsOf(kind)
  tr.append(td)
  return tr
}

/** An item's row, then its source panel when it is the expanded one. */
function itemRows(row: Row, kind: KnowledgeKind, host: KnowledgeHost, most: number): HTMLElement[] {
  const tr = itemRow(row, kind, host, most)
  if (host.toggle && host.expanded?.() === row.id && host.detail) {
    tr.classList?.add?.('is-open')
    const panel = wideRow(kind, 'exp', host.detail(row))
    return [tr, panel]
  }
  return [tr]
}

/** The item cell: plain text, or a relation as subject, link and object (0.20.0). */
function itemCell(row: Row, head: string) {
  const td = cell('td', undefined, 'know-text k-text', head)
  const parts = row.item?.parts
  if (parts) {
    td.append(el('span', parts.subject, 'node'), document.createTextNode(' '), el('span', parts.predicate, 'pred'), document.createTextNode(' '), el('span', parts.object, 'node'))
  } else td.textContent = row.text
  return td
}

/** The status cell: an instruction's state as a pill, a relation's confidence as five pips with the number as text. */
function statusCell(row: Row) {
  const td = cell('td', undefined, 'muted k-status', 'Status')
  const item = row.item
  if (item?.kind === 'instruction' && row.status !== '') td.append(el('span', row.status, `state-pill ${item.active ? 'is-active' : 'is-retired'}`))
  else if (item?.kind === 'relation' && item.confidence !== null) {
    const lit = confidenceLit(item.confidence)
    const pips = el('span', undefined, `imp i${lit}`)
    pips.setAttribute('aria-hidden', 'true')
    for (let i = 0; i < 5; i++) pips.append(el('span'))
    pips.title = row.status
    td.append(pips, el('span', row.status, 'sr-only'))
  } else td.textContent = row.status
  return td
}

function itemRow(row: Row, kind: KnowledgeKind, host: KnowledgeHost, most: number) {
  const status = hasStatus(kind)
  const head = itemHead(kind)
  const tr = el('tr')
  tr.dataset.id = row.id
  // The whole row opens its source memory (or, with host.toggle, its source panel); the buttons inside keep their own jobs.
  if (row.memory !== '') {
    tr.className = 'row'
    tr.tabIndex = 0
    const act = () => (host.toggle ? host.toggle(row.id) : host.open(row.memory, tr))
    tr.title = host.toggle ? 'Show the memory this item came from' : 'Open the memory this item came from'
    if (host.toggle) tr.setAttribute('aria-expanded', String(host.expanded?.() === row.id))
    tr.addEventListener('click', event => {
      if ((event.target as HTMLElement | null)?.closest?.('button')) return
      act()
    })
    tr.addEventListener('keydown', event => {
      if (event.target === tr && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault()
        act()
      }
    })
  }
  const map = el('button', 'Map \u2197', 'link')
  map.type = 'button'
  map.title = 'Show on map: select the star of the memory this item came from'
  map.setAttribute('aria-label', 'Show on map')
  map.disabled = row.memory === ''
  map.addEventListener('click', () => host.showOnMap(row.memory))
  const project = cell('td', undefined, 'k-project')
  project.append(host.project(row.owner))
  const fromMemory = cell('td', undefined, 'k-from')
  if (host.toggle) {
    const open = el('button', 'Open', 'link')
    open.type = 'button'
    open.title = 'Open the memory this item came from'
    open.disabled = row.memory === ''
    open.addEventListener('click', () => host.open(row.memory, tr))
    fromMemory.append(open, document.createTextNode(' '))
  }
  fromMemory.append(map)
  // Source recalls: the number with a bar scaled to the most in the list; 'never' alone, muted.
  const used = cell('td', undefined, row.recalls === 0 ? 'small muted k-used' : 'small k-used', 'Source recalls')
  if (row.recalls === 0) used.append(el('span', row.used))
  else {
    const bar = el('span', undefined, 'bar k-bar')
    bar.setAttribute('aria-hidden', 'true')
    bar.append(el('span', undefined, `bar-fill ${usedBar(row.recalls, most)}`))
    used.append(el('span', row.used, 'k-count'), bar)
  }
  // On a phone each row is a card (ui/style.css): data-label names a cell there, the kind first, then the item.
  tr.append(
    itemCell(row, head),
    cell('td', row.topic, 'muted k-topic'),
    project,
    fromMemory,
    ...(status ? [statusCell(row)] : []),
    used,
    cell('td', row.last, row.stale ? 'small is-stale k-last' : 'small k-last', 'Last used'),
  )
  return tr
}

/**
 * The rows grouped (0.20.0): a project row (owner chip, reach, count, its topics when folded, recall range and
 * freshness), then per topic a topic row and its items. `folded` holds the owners shown closed; `fold` flips one.
 */
export function groupedRows(data: KnowledgeData, kind: KnowledgeKind, host: KnowledgeHost, filter: KnowledgeFilter, folded: ReadonlySet<string>, fold: (owner: string) => void): HTMLElement[] {
  const now = host.now()
  const rows = rowsOf(data, kind, now, filter)
  if (rows.length === 0) return [emptyRow(data, kind)]
  const most = Math.max(...rows.map(row => row.recalls))
  return groupRows(rows).flatMap(group => {
    const closed = folded.has(group.owner)
    const toggle = el('button', undefined, 'grp-fold')
    toggle.type = 'button'
    toggle.setAttribute('aria-expanded', String(!closed))
    toggle.setAttribute('aria-label', `${closed ? 'Show' : 'Hide'} the ${kindCount(kind, group.count)} of ${group.owner}`)
    toggle.addEventListener('click', () => fold(group.owner))
    const left = el('span', undefined, 'grp-left')
    left.append(toggle, host.project(group.owner))
    if (group.owner === 'global' && host.reach) left.append(host.reach('all'))
    else if (group.shared > 0 && host.reach) left.append(host.reach('shared'))
    left.append(el('span', kindCount(kind, group.count), 'grp-n mono'))
    if (closed) left.append(el('span', group.topics.map(t => t.topic).slice(0, 6).join(' · ') + (group.topics.length > 6 ? ` · +${group.topics.length - 6}` : ''), 'grp-topics muted small'))
    const right = el('span', recallRange(group.minRecalls, group.maxRecalls), 'grp-right muted small')
    const ago = agoText(group.lastRecalled, now)
    if (ago !== '') {
      const days = daysAgo(group.lastRecalled, now)
      right.append(document.createTextNode(' · '), el('span', ago, days !== null && days > STALE_DAYS ? 'is-stale' : ''))
    }
    const head = wideRow(kind, 'grp', left, right)
    head.dataset.owner = group.owner
    head.tabIndex = 0
    head.setAttribute('aria-expanded', String(!closed))
    head.addEventListener('click', event => {
      if ((event.target as HTMLElement | null)?.closest?.('button')) return
      fold(group.owner)
    })
    head.addEventListener('keydown', event => {
      if (event.target !== head) return
      const key = (event as KeyboardEvent).key
      if ((key === 'ArrowLeft' && !closed) || (key === 'ArrowRight' && closed) || key === 'Enter' || key === ' ') {
        event.preventDefault()
        fold(group.owner)
      }
    })
    if (closed) return [head]
    return [
      head,
      ...group.topics.flatMap(topic => {
        const label = el('span', undefined, 'topic-label')
        label.append(el('span', topic.topic, topic.topic === NO_TOPIC ? 'topic-name muted' : 'topic-name mono'), el('span', ` · ${topic.rows.length}`, 'muted'))
        return [wideRow(kind, 'topic', label), ...topic.rows.flatMap(row => itemRows(row, kind, host, most))]
      }),
    ]
  })
}

/** The source panel of an expanded row: where it came from, the memory's text when loaded, Open and Map, and its siblings. */
export function sourcePanel(
  row: Row,
  data: KnowledgeData,
  memory: { content?: string; memory_type?: string | null; timestamp?: string | null } | null | 'loading' | 'error',
  host: KnowledgeHost & { reachOf?: (owner: string, scope: string | null) => HTMLElement | null; saved?: (value: string | null | undefined) => string },
  tr: () => HTMLElement | undefined,
): HTMLElement {
  const box = el('div', undefined, 'src')
  const main = el('div', undefined, 'src-main')
  const meta = el('p', undefined, 'src-meta')
  if (memory !== null && typeof memory === 'object' && host.glyph) meta.append(host.glyph(memory.memory_type ?? 'unknown'))
  meta.append(el('span', 'Mined from'))
  if (memory !== null && typeof memory === 'object' && memory.memory_type) meta.append(el('span', ` · ${memory.memory_type}`))
  meta.append(document.createTextNode(' · '), host.project(row.owner))
  const reach = host.reachOf?.(row.owner, row.item?.scope ?? null)
  if (reach) meta.append(document.createTextNode(' '), reach)
  if (memory !== null && typeof memory === 'object' && memory.timestamp && host.saved) meta.append(el('span', ` · saved ${host.saved(memory.timestamp)}`))
  main.append(meta)
  if (memory === 'loading') main.append(el('p', 'Loading the memory…', 'muted small'))
  else if (memory === 'error' || memory === null) main.append(el('p', memory === null ? 'That memory is gone.' : 'Could not load the memory.', 'muted small'))
  else main.append(el('p', `“${plainLabel(memory.content ?? '', 360)}”`, 'src-text'))
  const others = siblings(data, row.memory, row.id)
  if (others.length > 0) {
    const line = el('p', `${others.length} more ${others.length === 1 ? 'item came' : 'items came'} from this memory: `, 'muted small src-sib')
    line.append(document.createTextNode(others.slice(0, 3).map(item => `“${plainLabel(item.text, 50)}”`).join(' · ') + (others.length > 3 ? ' …' : '')))
    main.append(line)
  }
  const actions = el('div', undefined, 'src-actions')
  const open = el('button', 'Open memory', 'btn small')
  open.type = 'button'
  open.addEventListener('click', () => host.open(row.memory, tr() ?? open))
  const map = el('button', 'Show on map', 'btn small')
  map.type = 'button'
  map.addEventListener('click', () => host.showOnMap(row.memory))
  actions.append(open, map)
  box.append(main, actions)
  return box
}
/** A table cell with its class names and, for the phone card, the label shown before its text. */
function cell(tag: 'td', content: string | undefined, className: string, label?: string) {
  const td = el(tag, content, className)
  if (label !== undefined) td.dataset.label = label
  return td
}

/** The column heading of the first and the status column for a kind. */
export const itemHead = (kind: KnowledgeKind) => KINDS.find(k => k.kind === kind)?.head ?? 'Item'
