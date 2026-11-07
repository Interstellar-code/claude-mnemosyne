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
  /** 0.23.0: the live memories (the set the never-recalled count is taken from); the total from an older server. */
  liveTotal: number
  global: number
  owners: { owner: string; label: string; count: number }[]
  neverCount: number
  recallsPerDay: { date: string; count: number }[]
  otherRecallsPerDay: { date: string; count: number }[]
  /** 0.23.0: the dashboard's searches per day; [] from an older server. */
  uiRecallsPerDay: { date: string; count: number }[]
  daysCovered: number
  storeSize: number
  logSize: number
  tables: { name: string; rows: number }[]
  /** Tables that are empty by design, each with the reason (C10); `{}` from an older server, which then shows plain "empty". */
  unusedByDesign: Record<string, string>
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
  const unused = raw.unusedByDesign !== null && typeof raw.unusedByDesign === 'object' && !Array.isArray(raw.unusedByDesign) ? (raw.unusedByDesign as Record<string, unknown>) : {}
  const sizes = raw.sizes !== null && typeof raw.sizes === 'object' ? (raw.sizes as Record<string, unknown>) : {}
  return {
    total: whole(raw.total),
    liveTotal: typeof raw.liveTotal === 'number' ? whole(raw.liveTotal) : whole(raw.total),
    global: whole(raw.global),
    owners: objects(raw.owners)
      .filter(row => typeof row.owner === 'string')
      .map(row => ({ owner: text(row.owner), label: plainLabel(text(row.label, text(row.owner)), 60), count: whole(row.count) })),
    neverCount: whole(raw.neverRecalledCount ?? never.count),
    recallsPerDay: perDay(raw.recallsPerDay),
    otherRecallsPerDay: perDay(raw.otherRecallsPerDay),
    uiRecallsPerDay: perDay(raw.uiRecallsPerDay),
    daysCovered: whole(raw.daysCovered),
    storeSize: whole(raw.storeSize ?? sizes.store),
    logSize: whole(raw.logSize ?? sizes.log),
    tables: Object.entries(tables)
      .map(([name, rows]) => ({ name: plainLabel(name, 60), rows: whole(rows) }))
      .sort((a, b) => (a.name === 'working_memory' ? -1 : b.name === 'working_memory' ? 1 : a.name.localeCompare(b.name))),
    unusedByDesign: Object.fromEntries(Object.entries(unused).filter(([, reason]) => typeof reason === 'string').map(([name, reason]) => [plainLabel(name, 60), plainLabel(String(reason), 300)])),
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

/** 0.23.0: a state shown by shape and colour: ok (a check in a circle), act (a triangle), watch (a dot), info (an i). */
export type Level = 'ok' | 'act' | 'watch' | 'info'

export type Kpi = { label: string; value: string; note: string; level: Level }

const sum = (days: readonly { count: number }[]) => days.reduce((n, day) => n + day.count, 0)

/** Memories, never recalled, Claude's recalls in the log, other apps' recalls, store size; each with its level. */
export function kpis(data: HealthData): Kpi[] {
  const recalls = sum(data.recallsPerDay)
  const others = sum(data.otherRecallsPerDay)
  const projects = data.owners.filter(owner => owner.owner !== 'global').length
  return [
    { label: 'Memories', value: String(data.total), note: `${plural(projects, 'project', 'projects')}, ${data.global} global`, level: 'ok' },
    { label: 'Never recalled', value: String(data.neverCount), note: `${percent(data.neverCount, data.total)}% of all memories`, level: 'info' },
    // No Claude recall over the days the log covers is the one number to act on: the plugin's recall may be off.
    { label: 'Claude recalls in the log', value: String(recalls), note: data.daysCovered > 0 ? `over ${plural(data.daysCovered, 'day', 'days')} of activity log, without dashboard searches` : 'the activity log has no days yet', level: data.daysCovered > 1 && recalls === 0 ? 'act' : data.daysCovered === 0 ? 'info' : 'ok' },
    { label: "Other apps' recalls", value: String(others), note: 'from other MCP clients, not counted as Claude recalls', level: 'info' },
    { label: 'Store size', value: bytes(data.storeSize + data.logSize), note: `database ${bytes(data.storeSize)}, log ${bytes(data.logSize)}`, level: 'ok' },
  ]
}

export type Finding = { level: Level; title: string; detail: string; action: 'settings' | 'review' | 'knowledge' | '' ; actionLabel: string }

/**
 * What needs action first (0.23.0), worst first: act, then watch, then ok. The board shows the first three that are not ok,
 * and counts every level.
 */
export function findings(data: HealthData, meaning = false): Finding[] {
  const out: Finding[] = []
  const claude = sum(data.recallsPerDay)
  const others = sum(data.otherRecallsPerDay) + sum(data.uiRecallsPerDay)
  if (data.daysCovered === 0) out.push({ level: 'watch', title: 'The activity log is empty or off', detail: 'Recalls cannot be counted without it. Turn on activityLog in Settings.', action: 'settings', actionLabel: 'Open Settings' })
  else if (claude === 0 && data.daysCovered > 1)
    out.push({
      level: 'act',
      title: `Claude has not recalled anything in ${plural(data.daysCovered, 'day', 'days')}`,
      detail: others > 0 ? `All ${plural(others, 'recall', 'recalls')} in the log came from other apps or the dashboard. Check that Claude Code has the Mnemosyne memory tools switched on.` : 'Nothing in the log recalled a memory. Check that Claude Code has the Mnemosyne memory tools switched on.',
      action: 'settings',
      actionLabel: 'Open Settings',
    })
  else out.push({ level: 'ok', title: `Claude recalled ${plural(claude, 'time', 'times')} in ${plural(data.daysCovered, 'day', 'days')}`, detail: '', action: '', actionLabel: '' })
  const total = data.total
  const missingKnowledge = Math.max(0, total - data.coverage.knowledge)
  if (total > 0 && missingKnowledge > 0)
    out.push({ level: 'watch', title: `${plural(missingKnowledge, 'memory has', 'memories have')} no knowledge extracted`, detail: `${data.coverage.knowledge} of ${total} done. Extraction runs on save; these predate it or failed. /mnemosyne-knowledge fills them.`, action: 'knowledge', actionLabel: 'Open Knowledge' })
  else if (total > 0) out.push({ level: 'ok', title: 'Knowledge extracted from every memory', detail: '', action: '', actionLabel: '' })
  if (data.neverCount > 0) out.push({ level: 'watch', title: `${plural(data.neverCount, 'live memory has', 'live memories have')} never been recalled`, detail: 'They are in the Review queue, with the new ones marked.', action: 'review', actionLabel: 'Open Review' })
  else if (total > 0) out.push({ level: 'ok', title: 'Every live memory has been recalled', detail: '', action: '', actionLabel: '' })
  const untagged = Math.max(0, total - data.coverage.tagged)
  if (untagged > 0) out.push({ level: 'watch', title: `${plural(untagged, 'memory has', 'memories have')} no topic tag`, detail: 'Run /mnemosyne-tags, or see them in the Review queue No tags.', action: 'review', actionLabel: 'Open Review' })
  else if (total > 0) out.push({ level: 'ok', title: 'Every memory has a topic tag', detail: '', action: '', actionLabel: '' })
  if (embeddingsOn(data, meaning)) out.push({ level: 'ok', title: 'Meaning search is on', detail: '', action: '', actionLabel: '' })
  else out.push({ level: 'info', title: 'Meaning search is off', detail: EMBEDDINGS_HINT, action: '', actionLabel: '' })
  const rank: Record<Level, number> = { act: 0, watch: 1, info: 2, ok: 3 }
  return out.map((finding, index) => ({ finding, index })).sort((a, b) => rank[a.finding.level] - rank[b.finding.level] || a.index - b.index).map(entry => entry.finding)
}

/** The board's verdict line: "Running, with 1 thing to act on", "Running, 2 things to watch", "All good". */
export function verdict(list: readonly Finding[]): string {
  const act = list.filter(f => f.level === 'act').length
  const watch = list.filter(f => f.level === 'watch').length
  if (act > 0) return `Running, with ${plural(act, 'thing', 'things')} to act on`
  if (watch > 0) return `Running, ${plural(watch, 'thing', 'things')} to watch`
  return 'All good'
}

/** Whether embeddings count as on: the store holds at least one vector, or the galaxy reply said `meaning: true` (a caller that has the reply passes it). */
export const embeddingsOn = (data: HealthData, meaning = false): boolean => meaning || data.coverage.embeddings > 0

/**
 * `done` is set when every memory has the feature: its note is then plain information, shown muted. 0.23.0: `level` is the
 * row's state, and `byDesign` marks a row whose gap is expected (provenance: only saves since it began carry it).
 */
export type Coverage = { label: string; value: string; pct: number; note: string; good: boolean; done: boolean; level?: Level; byDesign?: boolean }

/** The coverage bars with their state (0.23.0): ok when done or healthy, by design for provenance, watch for the rest. */
export function coverageLevels(data: HealthData, meaning = false): (Coverage & { level: Level; byDesign: boolean })[] {
  return coverageBars(data, meaning).map(bar => {
    const byDesign = bar.label.startsWith('Who wrote it') && bar.good
    const level: Level = bar.done || (bar.good && !bar.label.startsWith('Knowledge')) ? 'ok' : byDesign ? 'ok' : bar.label.startsWith('Embeddings') && !bar.good ? 'info' : 'watch'
    return { ...bar, level, byDesign }
  })
}

/** The coverage bars: tagged, knowledge, embeddings, provenance, recalled at least once; each with what it means and how to turn it on. */
export function coverageBars(data: HealthData, meaning = false): Coverage[] {
  const total = data.total
  const embeddings = embeddingsOn(data, meaning)
  const of = (n: number) => `${n} of ${total}`
  const { tagged, knowledge, provenance } = data.coverage
  // 0.23.0: a share of the live memories, the set the never-recalled count is taken from (a retired one is not waiting).
  const live = data.liveTotal
  const used = Math.max(0, live - data.neverCount)
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
      value: live === total ? of(used) : `${used} of ${live} live`,
      pct: percent(used, live),
      good: live > 0 && percent(used, live) >= 50,
      done: live > 0 && used === live,
      note: total === 0 ? 'Nothing is stored yet.' : percent(used, live) >= 50 ? 'Healthy: most memories are being used.' : 'Most memories have never been recalled: review or forget the cold ones in the Review tab.',
    },
  ]
}

/** A bar width class from a percentage: w0 ... w20 in steps of 5 (style.css). */
export const widthClass = (pct: number) => `w${Math.round(Math.min(100, Math.max(0, pct)) / 5)}`
/** A bar height class from a share of the tallest bar: h0 ... h20 (style.css). */
export const heightClass = (count: number, max: number) => `h${max > 0 ? Math.round((Math.min(count, max) / max) * 20) : 0}`

export const CHART_DAYS = 14
const DAY_MS = 86_400_000

/**
 * `count` is Claude's recalls that day. 0.23.0: `other` (other apps) and `ui` (the dashboard's searches) stack on top;
 * `height` is the whole stack's against the tallest day, and `parts` are each segment's share of its stack in twentieths.
 */
export type Day = {
  date: string
  label: string
  count: number
  other: number
  ui: number
  height: string
  parts: { claude: number; other: number; ui: number }
  /** False for a day before the activity log starts: nothing was logged, so there is no count to show. */
  covered: boolean
}

/** The last 14 days up to and including today (UTC, as the log's dates are), oldest first. A day the log covers shows its count (0 when none); an earlier day is `covered: false`. */
export function dayBars(data: HealthData, now: number): Day[] {
  const of = (list: { date: string; count: number }[]) => new Map(list.map(day => [day.date, day.count]))
  const counts = of(data.recallsPerDay)
  const others = of(data.otherRecallsPerDay)
  const uis = of(data.uiRecallsPerDay)
  const days: Day[] = []
  for (let back = CHART_DAYS - 1; back >= 0; back--) {
    const date = new Date(now - back * DAY_MS).toISOString().slice(0, 10)
    // The log covers `daysCovered` days up to its newest line, which is today's or close to it.
    days.push({ date, label: back === 0 ? 'today' : `${back}d`, count: counts.get(date) ?? 0, other: others.get(date) ?? 0, ui: uis.get(date) ?? 0, height: '', parts: { claude: 0, other: 0, ui: 0 }, covered: back < data.daysCovered })
  }
  const total = (day: Day) => day.count + day.other + day.ui
  const max = days.reduce((a, day) => Math.max(a, total(day)), 0)
  for (const day of days) {
    day.height = day.covered ? heightClass(total(day), max) : 'h0'
    const t = total(day)
    const share = (n: number) => (t === 0 || n === 0 ? 0 : Math.max(1, Math.round((n / t) * 20)))
    day.parts = { claude: share(day.count), other: share(day.other), ui: share(day.ui) }
  }
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

/** The storage rows: the two files, then each table with its row count. An empty table the server names in `unusedByDesign` says "unused by design" and its reason, and is not a gap (`byDesign`). */
export function storageRows(data: HealthData): { name: string; value: string; empty: boolean; byDesign: boolean; reason: string }[] {
  const reasonOf = (name: string) => (Object.hasOwn(data.unusedByDesign, name) ? data.unusedByDesign[name]! : '')
  return [
    { name: 'database file', value: bytes(data.storeSize), empty: false, byDesign: false, reason: '' },
    { name: 'activity log', value: bytes(data.logSize), empty: false, byDesign: false, reason: '' },
    ...data.tables.map(table => {
      const reason = table.rows === 0 ? reasonOf(table.name) : ''
      return { name: table.name, value: table.rows === 0 ? (reason === '' ? 'empty' : 'unused by design') : plural(table.rows, 'row', 'rows'), empty: table.rows === 0, byDesign: reason !== '', reason }
    }),
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

/** The storage chips (0.23.0): tables that are empty (not by design), empty by design, and those with data. */
export function storageChips(data: HealthData): { empty: number; byDesign: number; withData: number } {
  const byDesign = data.tables.filter(table => table.rows === 0 && Object.hasOwn(data.unusedByDesign, table.name)).length
  const empty = data.tables.filter(table => table.rows === 0).length - byDesign
  return { empty, byDesign, withData: data.tables.length - empty - byDesign }
}

/** The Storage summary line: the size, the tables and how many are empty. */
export function storageSummary(data: HealthData): string {
  // A table that is empty by design is not counted: it is not a fault.
  const empty = data.tables.filter(table => table.rows === 0 && !Object.hasOwn(data.unusedByDesign, table.name)).length
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
  /** 0.23.0, optional: open Settings or Knowledge from a finding. */
  openSettings?: () => void
  openKnowledge?: () => void
}

/** A state mark: its shape tells the level (check, triangle, dot, i), its name is its label. */
export function levelMark(level: Level): HTMLElement {
  const mark = el('span', undefined, `lvl lvl-${level}`)
  mark.setAttribute('role', 'img')
  mark.setAttribute('aria-label', level === 'ok' ? 'ok' : level === 'act' ? 'needs action' : level === 'watch' ? 'to watch' : 'information')
  return mark
}

/** The KPI tiles. With `openReview` the Never recalled tile is a button that opens the Review tab. 0.23.0: each tile shows its level. */
export function kpiTiles(data: HealthData, openReview?: () => void): HTMLElement[] {
  return kpis(data).map(kpi => {
    const link = openReview !== undefined && kpi.label === 'Never recalled'
    // A button holds spans only (a div inside one is not valid); the same classes style them.
    const part = link ? 'span' : 'div'
    const tile = link ? el('button', undefined, `tile tile-link tile-${kpi.level}`) : el('div', undefined, `tile tile-${kpi.level}`)
    const label = el(part, undefined, 'tile-label')
    label.append(levelMark(kpi.level), el('span', kpi.label))
    tile.append(label, el(part, kpi.value, 'tile-value'), el(part, kpi.note, 'tile-note muted small'))
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
  return coverageLevels(data, meaning).map(bar => {
    // 0.23.0: a state mark first; a by-design row's bar is slate and a watch row's blue.
    const row = el('div', undefined, `cov-row cov-${bar.byDesign ? 'design' : bar.level}`)
    const head = el('div', undefined, 'cov-head')
    const name = el('span', undefined, 'cov-name')
    name.append(levelMark(bar.level), el('span', bar.label))
    head.append(name, el('span', bar.value, 'mono'))
    const track = el('div', undefined, 'bar cov-bar')
    track.append(el('span', undefined, `bar-fill ${widthClass(bar.pct)}`))
    row.append(head, track, el('span', bar.byDesign ? `By design: ${bar.note.charAt(0).toLowerCase()}${bar.note.slice(1)} Only saves since provenance began carry it.` : bar.note, bar.done ? 'cov-note is-done small' : bar.good ? 'cov-note is-good small' : 'cov-note small'))
    return row
  })
}

export function chartBars(days: readonly Day[]): HTMLElement[] {
  return days.map(day => {
    const column = el('div', undefined, day.covered ? 'day' : 'day is-off')
    const bar = el('div', undefined, `day-bar ${day.height}`)
    // 0.23.0: stacked by who asked (Claude Code, other apps, the dashboard), each a share of the stack.
    if (day.covered) {
      if (day.parts.ui > 0) bar.append(el('span', undefined, `dseg f-ui p${day.parts.ui}`))
      if (day.parts.other > 0) bar.append(el('span', undefined, `dseg f-other p${day.parts.other}`))
      if (day.parts.claude > 0) bar.append(el('span', undefined, `dseg f-claude p${day.parts.claude}`))
    }
    column.title = day.covered ? `${day.date}: Claude ${day.count}, other apps ${day.other}, dashboard ${day.ui}` : `${day.date}: before the activity log began`
    column.append(el('span', day.covered ? String(day.count) : '', 'day-count mono'), bar, el('span', day.label, 'day-label muted'))
    return column
  })
}

/** Project rows: the chip, then (0.23.0) a bar against the largest (global gold) and the count. `limit` shows the largest first and cuts the list. */
export function projectRows(data: HealthData, host: HealthHost, limit = Infinity): HTMLElement[] {
  const most = Math.max(1, ...data.owners.map(owner => owner.count))
  const sorted = limit === Infinity ? data.owners : [...data.owners].sort((a, b) => (a.owner === 'global' ? -1 : b.owner === 'global' ? 1 : b.count - a.count))
  return sorted.slice(0, limit).map(owner => {
    const row = el('div', undefined, 'list-row proj-row')
    const bar = el('span', undefined, 'bar proj-bar')
    bar.setAttribute('aria-hidden', 'true')
    bar.append(el('span', undefined, `bar-fill ${owner.owner === 'global' ? 'is-global' : ''} ${widthClass((owner.count / most) * 100)}`.replace('  ', ' ')))
    row.append(host.project(owner.owner), bar, el('span', plural(owner.count, 'memory', 'memories'), 'mono muted small'))
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
    // Empty by design reads as a note, not a warning: the reason sits under the name.
    const name = el('span', undefined, 'storage-name')
    name.append(el('span', row.name, 'mono small'))
    if (row.byDesign) name.append(el('span', row.reason, 'muted small storage-reason'))
    item.append(name, el('span', row.value, row.byDesign ? 'small muted' : row.empty ? 'small is-stale' : 'small'))
    return item
  })
}
