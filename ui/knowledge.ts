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

export const KINDS: readonly { kind: KnowledgeKind; list: 'facts' | 'preferences' | 'instructions' | 'timelines' | 'relations'; label: string; head: string; colour: string }[] = [
  { kind: 'fact', list: 'facts', label: 'Facts', head: 'Fact', colour: '#5DA9F5' },
  { kind: 'preference', list: 'preferences', label: 'Preferences', head: 'Preference', colour: '#E86AA0' },
  { kind: 'instruction', list: 'instructions', label: 'Instructions', head: 'Instruction', colour: '#3FAE59' },
  { kind: 'timeline', list: 'timelines', label: 'Timeline', head: 'Event', colour: '#D99A1E' },
  { kind: 'relation', list: 'relations', label: 'Relations', head: 'Relation', colour: '#9168E0' },
]

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
  used: string
  last: string
  stale: boolean
}

/** The status cell: an instruction is active or retired, a relation shows its confidence; else blank. */
export function statusOf(item: KnowledgeItem): string {
  if (item.kind === 'instruction') return item.active === null ? '' : item.active ? 'active' : 'retired'
  if (item.kind === 'relation') return item.confidence === null ? '' : `confidence ${item.confidence}`
  return ''
}

/** The Used cell: how many times the memory the item came from was recalled. */
export const usedText = (recalls: number) => `its memory was recalled ${recalls} ${recalls === 1 ? 'time' : 'times'}`

/** The rows of one kind, in the reply's order: item, topic, project, source memory, status, used, last used (stale over 30 days). */
export function rowsOf(data: KnowledgeData, kind: KnowledgeKind, now: number): Row[] {
  return data.items[kind].map(item => {
    const days = daysAgo(item.lastRecalled, now)
    return {
      id: item.id,
      text: item.text,
      topic: item.topic ?? '',
      owner: item.owner,
      memory: item.memory,
      status: statusOf(item),
      used: usedText(item.recalls),
      last: item.lastRecalled === null ? 'never' : agoText(item.lastRecalled, now) || 'never',
      stale: days !== null && days > STALE_DAYS,
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
  now: () => number
}

/** The kind tabs with their counts: plain toggle buttons (aria-pressed), not ARIA tabs. */
export function kindTabs(data: KnowledgeData, selected: KnowledgeKind, pick: (kind: KnowledgeKind) => void): HTMLElement[] {
  return KINDS.map(({ kind, label, colour }) => {
    const button = el('button', undefined, 'chip-btn know-tab')
    button.type = 'button'
    button.setAttribute('aria-pressed', String(kind === selected))
    button.dataset.kind = kind
    const dotNode = el('span', undefined, 'lg-dot')
    dotNode.setAttribute('aria-hidden', 'true')
    dotNode.style.backgroundColor = colour
    button.append(dotNode, el('span', label), el('span', countText(data.items[kind].length, data.totals[kind]), 'mono muted'))
    button.addEventListener('click', () => pick(kind))
    return button
  })
}

/** The KPI tiles. */
export function kpiTiles(data: KnowledgeData, now: number): HTMLElement[] {
  return kpis(data, now).map(kpi => {
    const tile = el('div', undefined, 'tile')
    tile.append(el('div', kpi.label, 'tile-label'), el('div', kpi.value, 'tile-value'))
    return tile
  })
}

/** The table rows of one kind; an empty kind says so in one row. */
export function tableRows(data: KnowledgeData, kind: KnowledgeKind, host: KnowledgeHost): HTMLElement[] {
  const rows = rowsOf(data, kind, host.now())
  if (rows.length === 0) {
    const tr = el('tr')
    const td = el('td', 'Nothing of this kind yet.', 'muted')
    td.colSpan = 7
    tr.append(td)
    return [tr]
  }
  const head = itemHead(kind)
  return rows.map(row => {
    const tr = el('tr')
    const open = el('button', 'Show on map', 'link')
    open.type = 'button'
    open.disabled = row.memory === ''
    open.addEventListener('click', () => host.showOnMap(row.memory))
    const project = cell('td', undefined, 'k-project')
    project.append(host.project(row.owner))
    const fromMemory = cell('td', undefined, 'k-from')
    fromMemory.append(open)
    // On a phone each row is a card (ui/style.css): data-label names a cell there, the kind first, then the item.
    tr.append(
      cell('td', row.text, 'know-text k-text', head),
      cell('td', row.topic, 'muted k-topic'),
      project,
      fromMemory,
      cell('td', row.status, 'muted k-status', 'Status'),
      cell('td', row.used, 'small k-used', 'Used'),
      cell('td', row.last, row.stale ? 'small is-stale k-last' : 'small k-last', 'Last used'),
    )
    return tr
  })
}

/** A table cell with its class names and, for the phone card, the label shown before its text. */
function cell(tag: 'td', content: string | undefined, className: string, label?: string) {
  const td = el(tag, content, className)
  if (label !== undefined) td.dataset.label = label
  return td
}

/** The column heading of the first and the status column for a kind. */
export const itemHead = (kind: KnowledgeKind) => KINDS.find(k => k.kind === kind)?.head ?? 'Item'
