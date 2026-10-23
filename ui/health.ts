// The Health tab (plan VIEWS.2; the mockup is design/Health.dc.html): how much of the
// memory is used, how much is going stale, and which engine features are switched on.
//
// The data is GET /api/health-report (KAPI.2). The functions are pure (no DOM) except
// the `draw*` builders at the end, which make elements with createElement and
// textContent only. ui/app.ts fetches the reply and calls them.
import { agoText } from './knowledge'
import { plainLabel } from './escape'

export type MemoryRow = { id: string; owner: string; created: string | null; lastRecalled: string | null; label: string; tags: string[]; recalls: number }
export type HealthData = {
  total: number
  global: number
  owners: { owner: string; label: string; count: number }[]
  neverCount: number
  neverList: MemoryRow[]
  mostRecalled: MemoryRow[]
  recallsPerDay: { date: string; count: number }[]
  daysCovered: number
  storeSize: number
  logSize: number
  tables: { name: string; rows: number }[]
  coverage: { tagged: number; knowledge: number; embeddings: number; provenance: number }
}

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const whole = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)
const objects = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object' && !Array.isArray(row)) : [])

function memoryRows(value: unknown): MemoryRow[] {
  return objects(value)
    .filter(row => typeof row.id === 'string' && row.id !== '')
    .map(row => ({
      id: text(row.id),
      owner: text(row.owner),
      created: typeof row.created === 'string' ? row.created : null,
      lastRecalled: typeof row.lastRecalled === 'string' ? row.lastRecalled : null,
      label: plainLabel(text(row.label), 120),
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string' && tag !== '') : [],
      recalls: whole(row.recalls),
    }))
}

/** A /api/health-report reply made safe to use; null when it is no object. */
export function parseHealth(body: unknown): HealthData | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const raw = body as Record<string, unknown>
  const never = raw.neverRecalled !== null && typeof raw.neverRecalled === 'object' ? (raw.neverRecalled as Record<string, unknown>) : {}
  const coverage = raw.coverage !== null && typeof raw.coverage === 'object' ? (raw.coverage as Record<string, unknown>) : {}
  const tables = raw.tables !== null && typeof raw.tables === 'object' && !Array.isArray(raw.tables) ? (raw.tables as Record<string, unknown>) : {}
  const sizes = raw.sizes !== null && typeof raw.sizes === 'object' ? (raw.sizes as Record<string, unknown>) : {}
  const neverList = memoryRows(raw.neverRecalledList ?? never.list)
  return {
    total: whole(raw.total),
    global: whole(raw.global),
    owners: objects(raw.owners)
      .filter(row => typeof row.owner === 'string')
      .map(row => ({ owner: text(row.owner), label: plainLabel(text(row.label, text(row.owner)), 60), count: whole(row.count) })),
    neverCount: whole(raw.neverRecalledCount ?? never.count),
    neverList,
    mostRecalled: memoryRows(raw.mostRecalled),
    recallsPerDay: objects(raw.recallsPerDay)
      .filter(row => typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
      .map(row => ({ date: text(row.date), count: whole(row.count) })),
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

/** Memories, never recalled, recalls in the log, store size. */
export function kpis(data: HealthData): Kpi[] {
  const recalls = data.recallsPerDay.reduce((sum, day) => sum + day.count, 0)
  const projects = data.owners.filter(owner => owner.owner !== 'global').length
  return [
    { label: 'Memories', value: String(data.total), note: `${plural(projects, 'project', 'projects')}, ${data.global} global` },
    { label: 'Never recalled', value: String(data.neverCount), note: `${percent(data.neverCount, data.total)}% of all memories` },
    { label: 'Recalls in the log', value: String(recalls), note: data.daysCovered > 0 ? `over ${plural(data.daysCovered, 'day', 'days')} of activity log` : 'the activity log has no days yet' },
    { label: 'Store size', value: bytes(data.storeSize + data.logSize), note: `database ${bytes(data.storeSize)}, log ${bytes(data.logSize)}` },
  ]
}

/** In 0.6.0 embeddings are not built (EMB is 0.7.0): the bar reads 0 whatever the store holds. */
export const EMBEDDINGS_ARRIVED = false

export type Coverage = { label: string; value: string; pct: number; note: string; good: boolean }

/** The coverage bars: tagged, knowledge, embeddings, provenance, recalled at least once; each with what it means and how to turn it on. */
export function coverageBars(data: HealthData): Coverage[] {
  const total = data.total
  const of = (n: number) => `${n} of ${total}`
  const { tagged, knowledge, provenance } = data.coverage
  const used = Math.max(0, total - data.neverCount)
  return [
    {
      label: 'Topic tags',
      value: of(tagged),
      pct: percent(tagged, total),
      good: total > 0 && tagged === total,
      note: tagged === 0 ? 'No memory has tags yet. Run /mnemosyne-tags to tag them.' : tagged < total ? `${plural(total - tagged, 'memory has', 'memories have')} no tag. Run /mnemosyne-tags to tag them.` : 'Every memory has a topic tag.',
    },
    {
      label: 'Knowledge extracted',
      value: of(knowledge),
      pct: percent(knowledge, total),
      good: total > 0 && knowledge > 0,
      note: knowledge === 0 ? 'No memory has had facts, preferences or instructions mined yet. Set extractionModel and restart the dashboard, or run /mnemosyne-knowledge.' : `${plural(knowledge, 'memory has', 'memories have')} knowledge mined from ${knowledge === 1 ? 'it' : 'them'}.`,
    },
    {
      label: 'Embeddings (meaning search)',
      value: EMBEDDINGS_ARRIVED ? of(data.coverage.embeddings) : of(0),
      pct: EMBEDDINGS_ARRIVED ? percent(data.coverage.embeddings, total) : 0,
      good: false,
      note: EMBEDDINGS_ARRIVED ? 'Memories are placed by meaning.' : 'Embeddings arrive in a later version',
    },
    {
      label: 'Who wrote it (provenance)',
      value: of(provenance),
      pct: percent(provenance, total),
      good: total > 0 && provenance > 0,
      note: provenance === 0 ? 'Author and certainty are not recorded on save yet. To turn it on, update the plugin and run /mnemosyne-setup: saves made after that record who wrote them.' : `${plural(provenance, 'memory records', 'memories record')} who wrote ${provenance === 1 ? 'it' : 'them'}.`,
    },
    {
      label: 'Recalled at least once',
      value: of(used),
      pct: percent(used, total),
      good: total > 0 && percent(used, total) >= 50,
      note: total === 0 ? 'Nothing is stored yet.' : percent(used, total) >= 50 ? 'Healthy: most memories are being used.' : 'Most memories have never been recalled: review or forget the cold ones below.',
    },
  ]
}

/** A bar width class from a percentage: w0 ... w20 in steps of 5 (style.css). */
export const widthClass = (pct: number) => `w${Math.round(Math.min(100, Math.max(0, pct)) / 5)}`
/** A bar height class from a share of the tallest bar: h0 ... h20 (style.css). */
export const heightClass = (count: number, max: number) => `h${max > 0 ? Math.round((Math.min(count, max) / max) * 20) : 0}`

export const CHART_DAYS = 14
const DAY_MS = 86_400_000

export type Day = { date: string; label: string; count: number; height: string }

/** The last 14 days up to and including today (UTC, as the log's dates are), oldest first, with zero for a day with no recall. */
export function dayBars(data: HealthData, now: number): Day[] {
  const counts = new Map(data.recallsPerDay.map(day => [day.date, day.count]))
  const days: Day[] = []
  for (let back = CHART_DAYS - 1; back >= 0; back--) {
    const date = new Date(now - back * DAY_MS).toISOString().slice(0, 10)
    days.push({ date, label: back === 0 ? 'today' : `${back}d`, count: counts.get(date) ?? 0, height: '' })
  }
  const max = days.reduce((a, day) => Math.max(a, day.count), 0)
  for (const day of days) day.height = heightClass(day.count, max)
  return days
}

/** The chart's words: the numbers in text, and how many days the log covers. */
export function chartText(days: readonly Day[], data: HealthData): { label: string; summary: string } {
  const sum = days.reduce((a, day) => a + day.count, 0)
  return {
    label: `Bar chart of recalls per day for the last ${CHART_DAYS} days, oldest first: ${days.map(day => `${day.label} ${day.count}`).join(', ')}.`,
    summary:
      data.daysCovered === 0
        ? 'The activity log is empty or off, so there are no recalls to count.'
        : `${plural(sum, 'recall', 'recalls')} in the last ${CHART_DAYS} days. The activity log covers ${plural(data.daysCovered, 'day', 'days')}, so older days show 0 here.`,
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

/** The never-recalled heading's sentence. */
export function neverText(data: HealthData): string {
  if (data.neverCount === 0) return 'Every memory has come back in a recall at least once.'
  const base = `${plural(data.neverCount, 'memory has', 'memories have')} never come back in a recall: candidates to review or forget.`
  return data.neverList.length < data.neverCount ? `${base} Showing the newest ${data.neverList.length}.` : base
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
  /** Review: open the memory in the Memories view. */
  review: (id: string) => void
  /** The existing guarded forget; `done` gets an error text on failure. */
  forget: (id: string, done: (error?: string) => void) => void
  now: () => number
}

export function kpiTiles(data: HealthData): HTMLElement[] {
  return kpis(data).map(kpi => {
    const tile = el('div', undefined, 'tile')
    tile.append(el('div', kpi.label, 'tile-label'), el('div', kpi.value, 'tile-value'), el('div', kpi.note, 'tile-note muted small'))
    return tile
  })
}

export function coverageRows(data: HealthData): HTMLElement[] {
  return coverageBars(data).map(bar => {
    const row = el('div', undefined, 'cov-row')
    const head = el('div', undefined, 'cov-head')
    head.append(el('span', bar.label), el('span', bar.value, 'mono'))
    const track = el('div', undefined, 'bar cov-bar')
    track.append(el('span', undefined, `bar-fill ${widthClass(bar.pct)}`))
    row.append(head, track, el('span', bar.note, bar.good ? 'cov-note is-good small' : 'cov-note small'))
    return row
  })
}

export function chartBars(days: readonly Day[]): HTMLElement[] {
  return days.map(day => {
    const column = el('div', undefined, 'day')
    const bar = el('div', undefined, `day-bar ${day.height}`)
    column.append(el('span', String(day.count), 'day-count mono'), bar, el('span', day.label, 'day-label muted'))
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

/** One never-recalled row: the memory, its project, when it was saved, Review and a two-step Forget. */
export function neverRow(memory: MemoryRow, host: HealthHost, removed: () => void): HTMLElement {
  const tr = el('tr')
  const project = el('td')
  project.append(host.project(memory.owner))
  const actions = el('td', undefined, 'row-actions')
  const review = el('button', 'Review', 'link')
  review.type = 'button'
  review.addEventListener('click', () => host.review(memory.id))
  const ask = el('button', 'Forget…', 'link danger-link')
  ask.type = 'button'
  const confirm = el('span', undefined, 'confirm-inline')
  confirm.hidden = true
  const warning = el('span', 'Forget for good?', 'warn small')
  const yes = el('button', 'Forget', 'btn danger')
  yes.type = 'button'
  const keep = el('button', 'Keep', 'btn')
  keep.type = 'button'
  const problem = el('span', undefined, 'warn small')
  problem.hidden = true
  confirm.append(warning, yes, keep, problem)
  ask.addEventListener('click', () => {
    ask.hidden = true
    confirm.hidden = false
    keep.focus()
  })
  keep.addEventListener('click', () => {
    confirm.hidden = true
    ask.hidden = false
    problem.hidden = true
    ask.focus()
  })
  yes.addEventListener('click', () => {
    yes.disabled = true
    host.forget(memory.id, error => {
      yes.disabled = false
      if (error === undefined) {
        removed()
        return
      }
      problem.textContent = error
      problem.hidden = false
    })
  })
  actions.append(review, ask, confirm)
  tr.append(el('td', memory.label === '' ? '(no text)' : memory.label, 'know-text'), project, el('td', agoText(memory.created, host.now()) || 'unknown', 'small'), actions)
  return tr
}

export function hotRows(data: HealthData, host: HealthHost): HTMLElement[] {
  return data.mostRecalled.map(memory => {
    const row = el('div', undefined, 'hot-row')
    row.append(el('span', String(memory.recalls), 'mono hot-count'), el('span', memory.label === '' ? '(no text)' : memory.label, 'hot-text'), host.project(memory.owner))
    return row
  })
}

export function storageList(data: HealthData): HTMLElement[] {
  return storageRows(data).map(row => {
    const item = el('div', undefined, 'list-row')
    item.append(el('span', row.name, 'mono small'), el('span', row.value, row.empty ? 'small is-stale' : 'small'))
    return item
  })
}
