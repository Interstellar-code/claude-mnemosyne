// The Health tab (plan VIEWS.2; the mockup is design/Health.dc.html): how much of the
// memory is used, how much is going stale, and which engine features are switched on.
//
// The data is GET /api/health-report (KAPI.2). The functions are pure (no DOM) except
// the `draw*` builders at the end, which make elements with createElement and
// textContent only. ui/app.ts fetches the reply and calls them.
import { plainLabel } from './escape'
import { EMBEDDINGS_HINT } from './map-state'

export type HealthData = {
  total: number
  global: number
  owners: { owner: string; label: string; count: number }[]
  neverCount: number
  recallsPerDay: { date: string; count: number }[]
  otherRecallsPerDay: { date: string; count: number }[]
  daysCovered: number
  storeSize: number
  logSize: number
  tables: { name: string; rows: number }[]
  coverage: { tagged: number; knowledge: number; embeddings: number; provenance: number }
}

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const whole = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)
const objects = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object' && !Array.isArray(row)) : [])

const perDay = (value: unknown) =>
  objects(value)
    .filter(row => typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .map(row => ({ date: text(row.date), count: whole(row.count) }))

/** A /api/health-report reply made safe to use; null when it is no object. */
export function parseHealth(body: unknown): HealthData | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const raw = body as Record<string, unknown>
  const never = raw.neverRecalled !== null && typeof raw.neverRecalled === 'object' ? (raw.neverRecalled as Record<string, unknown>) : {}
  const coverage = raw.coverage !== null && typeof raw.coverage === 'object' ? (raw.coverage as Record<string, unknown>) : {}
  const tables = raw.tables !== null && typeof raw.tables === 'object' && !Array.isArray(raw.tables) ? (raw.tables as Record<string, unknown>) : {}
  const sizes = raw.sizes !== null && typeof raw.sizes === 'object' ? (raw.sizes as Record<string, unknown>) : {}
  return {
    total: whole(raw.total),
    global: whole(raw.global),
    owners: objects(raw.owners)
      .filter(row => typeof row.owner === 'string')
      .map(row => ({ owner: text(row.owner), label: plainLabel(text(row.label, text(row.owner)), 60), count: whole(row.count) })),
    neverCount: whole(raw.neverRecalledCount ?? never.count),
    recallsPerDay: perDay(raw.recallsPerDay),
    otherRecallsPerDay: perDay(raw.otherRecallsPerDay),
    daysCovered: whole(raw.daysCovered),
    storeSize: whole(raw.storeSize ?? sizes.store),
    logSize: whole(raw.logSize ?? sizes.log),
    tables: Object.entries(tables)
      .map(([name, rows]) => ({ name: plainLabel(name, 60), rows: whole(rows) }))
      .sort((a, b) => (a.name === 'working_memory' ? -1 : b.name === 'working_memory' ? 1 : a.name.localeCompare(b.name))),
    coverage: { tagged: whole(coverage.tagged), knowledge: whole(coverage.knowledge), embeddings: whole(coverage.embeddings), provenance: whole(coverage.provenance ?? coverage.author_type) },
  }
}

/** A size in bytes in plain units. */
export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export type Kpi = { label: string; value: string; note: string }

/** Memories, never recalled, Claude's recalls in the log, other apps' recalls, store size. */
export function kpis(data: HealthData): Kpi[] {
  const recalls = data.recallsPerDay.reduce((sum, day) => sum + day.count, 0)
  const others = data.otherRecallsPerDay.reduce((sum, day) => sum + day.count, 0)
  const projects = data.owners.filter(owner => owner.owner !== 'global').length
  return [
    { label: 'Memories', value: String(data.total), note: `${plural(projects, 'project', 'projects')}, ${data.global} global` },
    { label: 'Never recalled', value: String(data.neverCount), note: `${percent(data.neverCount, data.total)}% of all memories` },
    { label: 'Claude recalls in the log', value: String(recalls), note: data.daysCovered > 0 ? `over ${plural(data.daysCovered, 'day', 'days')} of activity log, without dashboard searches` : 'the activity log has no days yet' },
    { label: "Other apps' recalls", value: String(others), note: 'from other MCP clients, not counted as Claude recalls' },
    { label: 'Store size', value: bytes(data.storeSize + data.logSize), note: `database ${bytes(data.storeSize)}, log ${bytes(data.logSize)}` },
  ]
}

/** Whether embeddings count as on: the store holds at least one vector, or the galaxy reply said `meaning: true` (a caller that has the reply passes it). */
export const embeddingsOn = (data: HealthData, meaning = false): boolean => meaning || data.coverage.embeddings > 0

/** `done` is set when every memory has the feature: its note is then plain information, shown muted. */
export type Coverage = { label: string; value: string; pct: number; note: string; good: boolean; done: boolean }

/** The coverage bars: tagged, knowledge, embeddings, provenance, recalled at least once; each with what it means and how to turn it on. */
export function coverageBars(data: HealthData, meaning = false): Coverage[] {
  const total = data.total
  const embeddings = embeddingsOn(data, meaning)
  const of = (n: number) => `${n} of ${total}`
  const { tagged, knowledge, provenance } = data.coverage
  const used = Math.max(0, total - data.neverCount)
  const all = (n: number) => total > 0 && n === total
  return [
    {
      label: 'Topic tags',
      value: of(tagged),
      pct: percent(tagged, total),
      good: total > 0 && tagged === total,
      done: all(tagged),
      note: tagged === 0 ? 'No memory has tags yet. Run /mnemosyne-tags to tag them.' : tagged < total ? `${plural(total - tagged, 'memory has', 'memories have')} no tag. Run /mnemosyne-tags to tag them.` : 'Every memory has a topic tag.',
    },
    {
      label: 'Knowledge extracted',
      value: of(knowledge),
      pct: percent(knowledge, total),
      good: total > 0 && knowledge > 0,
      done: all(knowledge),
      note: knowledge === 0 ? 'No memory has had facts, preferences or instructions mined yet. Set extractionModel and restart the dashboard, or run /mnemosyne-knowledge.' : `${plural(knowledge, 'memory has', 'memories have')} knowledge mined from ${knowledge === 1 ? 'it' : 'them'}.`,
    },
    {
      label: 'Embeddings (meaning search)',
      value: of(embeddings ? data.coverage.embeddings : 0),
      pct: embeddings ? percent(data.coverage.embeddings, total) : 0,
      good: embeddings && total > 0 && data.coverage.embeddings > 0,
      done: embeddings && all(data.coverage.embeddings),
      note: embeddings ? 'Memories are placed by meaning.' : EMBEDDINGS_HINT,
    },
    {
      label: 'Who wrote it (provenance)',
      value: of(provenance),
      pct: percent(provenance, total),
      good: total > 0 && provenance > 0,
      done: all(provenance),
      note: provenance === 0 ? 'Author and certainty are not recorded on save yet. To turn it on, update the plugin and run /mnemosyne-setup: saves made after that record who wrote them.' : `${plural(provenance, 'memory records', 'memories record')} who wrote ${provenance === 1 ? 'it' : 'them'}.`,
    },
    {
      label: 'Recalled at least once',
      value: of(used),
      pct: percent(used, total),
      good: total > 0 && percent(used, total) >= 50,
      done: all(used),
      note: total === 0 ? 'Nothing is stored yet.' : percent(used, total) >= 50 ? 'Healthy: most memories are being used.' : 'Most memories have never been recalled: review or forget the cold ones in the Review tab.',
    },
  ]
}

/** A bar width class from a percentage: w0 ... w20 in steps of 5 (style.css). */
export const widthClass = (pct: number) => `w${Math.round(Math.min(100, Math.max(0, pct)) / 5)}`
/** A bar height class from a share of the tallest bar: h0 ... h20 (style.css). */
export const heightClass = (count: number, max: number) => `h${max > 0 ? Math.round((Math.min(count, max) / max) * 20) : 0}`

export const CHART_DAYS = 14
const DAY_MS = 86_400_000

export type Day = { date: string; label: string; count: number; height: string; /** False for a day before the activity log starts: nothing was logged, so there is no count to show. */ covered: boolean }

/** The last 14 days up to and including today (UTC, as the log's dates are), oldest first. A day the log covers shows its count (0 when none); an earlier day is `covered: false`. */
export function dayBars(data: HealthData, now: number): Day[] {
  const counts = new Map(data.recallsPerDay.map(day => [day.date, day.count]))
  const days: Day[] = []
  for (let back = CHART_DAYS - 1; back >= 0; back--) {
    const date = new Date(now - back * DAY_MS).toISOString().slice(0, 10)
    // The log covers `daysCovered` days up to its newest line, which is today's or close to it.
    days.push({ date, label: back === 0 ? 'today' : `${back}d`, count: counts.get(date) ?? 0, height: '', covered: back < data.daysCovered })
  }
  const max = days.reduce((a, day) => Math.max(a, day.count), 0)
  for (const day of days) day.height = day.covered ? heightClass(day.count, max) : 'h0'
  return days
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** 2026-10-19 as "19 Oct". */
const shortDate = (date: string) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''}`

/** The chart's words: the numbers in text, and the day the activity log starts when that is inside the 14 days. */
export function chartText(days: readonly Day[], data: HealthData): { label: string; summary: string } {
  const sum = days.reduce((a, day) => a + day.count, 0)
  const first = days.find(day => day.covered)
  const starts = first !== undefined && first !== days[0] ? ` The activity log starts on ${shortDate(first.date)}; earlier days are greyed out because nothing was logged then.` : ''
  return {
    label: `Bar chart of recalls per day for the last ${CHART_DAYS} days, oldest first: ${days.map(day => `${day.label} ${day.covered ? day.count : 'not logged'}`).join(', ')}.`,
    summary: data.daysCovered === 0 ? 'The activity log is empty or off, so there are no recalls to count.' : `${plural(sum, 'recall', 'recalls')} in the last ${CHART_DAYS} days.${starts}`,
  }
}

/** The storage rows: the two files, then each table with its row count ('empty' for none). */
export function storageRows(data: HealthData): { name: string; value: string; empty: boolean }[] {
  return [
    { name: 'database file', value: bytes(data.storeSize), empty: false },
    { name: 'activity log', value: bytes(data.logSize), empty: false },
    ...data.tables.map(table => ({ name: table.name, value: table.rows === 0 ? 'empty' : plural(table.rows, 'row', 'rows'), empty: table.rows === 0 })),
  ]
}

export type TableFilter = 'all' | 'data' | 'empty'
export const TABLE_FILTERS: readonly { id: TableFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'data', label: 'Has data' },
  { id: 'empty', label: 'Empty' },
]

/** The tables that pass a filter: all of them, the ones with rows, or the empty ones. */
export function filterTables<T extends { rows: number }>(rows: readonly T[], filter: TableFilter): T[] {
  return rows.filter(row => filter === 'all' || (filter === 'empty' ? row.rows === 0 : row.rows > 0))
}

/** The Storage summary line: the size, the tables and how many are empty. */
export function storageSummary(data: HealthData): string {
  const empty = data.tables.filter(table => table.rows === 0).length
  return `Storage · ${bytes(data.storeSize + data.logSize)} · ${plural(data.tables.length, 'table', 'tables')}, ${empty} empty`
}

// ---- Elements: createElement and textContent only ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string, className?: string) {
  const element = document.createElement(tag)
  if (content !== undefined) element.textContent = content
  if (className) element.className = className
  return element
}

export type HealthHost = {
  /** The project's colour dot and readable name. */
  project: (owner: string) => HTMLElement
  /** Opens the Review tab (the Never recalled tile). */
  openReview: () => void
}

/** The KPI tiles. With `openReview` the Never recalled tile is a button that opens the Review tab. */
export function kpiTiles(data: HealthData, openReview?: () => void): HTMLElement[] {
  return kpis(data).map(kpi => {
    const link = openReview !== undefined && kpi.label === 'Never recalled'
    // A button holds spans only (a div inside one is not valid); the same classes style them.
    const part = link ? 'span' : 'div'
    const tile = link ? el('button', undefined, 'tile tile-link') : el('div', undefined, 'tile')
    tile.append(el(part, kpi.label, 'tile-label'), el(part, kpi.value, 'tile-value'), el(part, kpi.note, 'tile-note muted small'))
    if (link) {
      const button = tile as HTMLButtonElement
      button.type = 'button'
      button.title = 'Open the Review tab'
      button.addEventListener('click', openReview)
    }
    return tile
  })
}

export function coverageRows(data: HealthData, meaning = false): HTMLElement[] {
  return coverageBars(data, meaning).map(bar => {
    const row = el('div', undefined, 'cov-row')
    const head = el('div', undefined, 'cov-head')
    head.append(el('span', bar.label), el('span', bar.value, 'mono'))
    const track = el('div', undefined, 'bar cov-bar')
    track.append(el('span', undefined, `bar-fill ${widthClass(bar.pct)}`))
    row.append(head, track, el('span', bar.note, bar.done ? 'cov-note is-done small' : bar.good ? 'cov-note is-good small' : 'cov-note small'))
    return row
  })
}

export function chartBars(days: readonly Day[]): HTMLElement[] {
  return days.map(day => {
    const column = el('div', undefined, day.covered ? 'day' : 'day is-off')
    const bar = el('div', undefined, `day-bar ${day.height}`)
    column.append(el('span', day.covered ? String(day.count) : '', 'day-count mono'), bar, el('span', day.label, 'day-label muted'))
    return column
  })
}

export function projectRows(data: HealthData, host: HealthHost): HTMLElement[] {
  return data.owners.map(owner => {
    const row = el('div', undefined, 'list-row')
    row.append(host.project(owner.owner), el('span', plural(owner.count, 'memory', 'memories'), 'mono muted small'))
    return row
  })
}

/** The All | Has data | Empty buttons (a segmented control of aria-pressed toggles). */
export function tableFilterButtons(selected: TableFilter, pick: (filter: TableFilter) => void): HTMLElement[] {
  return TABLE_FILTERS.map(({ id, label }) => {
    const button = el('button', label, 'seg-btn')
    button.type = 'button'
    button.dataset.filter = id
    button.setAttribute('aria-pressed', String(id === selected))
    button.addEventListener('click', () => pick(id))
    return button
  })
}

/** The storage list. All: the two files, then every table. Has data / Empty: only the tables that match, or one line when none do. */
export function storageList(data: HealthData, filter: TableFilter = 'all'): HTMLElement[] {
  const rows = storageRows(data)
  const tables = filterTables(
    data.tables.map((table, index) => ({ ...rows[index + 2]!, rows: table.rows })),
    filter,
  )
  if (filter !== 'all' && tables.length === 0) return [el('p', 'No tables match.', 'muted small')]
  return [...(filter === 'all' ? rows.slice(0, 2) : []), ...tables].map(row => {
    const item = el('div', undefined, 'list-row')
    item.append(el('span', row.name, 'mono small'), el('span', row.value, row.empty ? 'small is-stale' : 'small'))
    return item
  })
}
