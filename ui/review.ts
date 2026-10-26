// The Review tab: memories worth a second look, so you can open them or retire them.
// It started as the Health tab's Never recalled list. It holds four filters on the newest memories
// (GET /api/memories: importance, tags, recall count, last recall, state), "Retire candidates" (GET /api/review:
// the live memories the server flags, each with its reasons) and "Not live" (the same reply: retired, expired
// and lapsed memories, each with Restore and its last audit rows).
//
// Nothing happens in bulk: Retire is one memory at a time, behind its own confirm that names the memory, and a
// row's change shows only after the server confirmed it. Forget is not here; it stays in the memory sheet.
// The functions are pure (no DOM) except the builders at the end, which make elements with createElement and
// textContent only. ui/app.ts fetches the replies and calls them.
import { agoText, daysAgo, STALE_DAYS } from './knowledge'
import { plainLabel } from './escape'

export type ReviewMemory = {
  id: string
  owner: string
  text: string
  created: string | null
  lastRecalled: string | null
  recalls: number
  importance: number | null
  tags: string[]
  /** live, retired, expired or lapsed; an older server sends none, which reads as live. */
  state: string
}
/** `total` is what the store holds; `rows` are the memories the server sent (at most its list limit). */
export type ReviewData = { total: number; rows: ReviewMemory[] }

/** The four filters that work on the memory list; 'retire' and 'notlive' work on the review queue. */
export type RowFilter = 'never' | 'untagged' | 'stale' | 'low'
export type ReviewFilter = RowFilter | 'retire' | 'notlive'
export const LOW_IMPORTANCE = 0.4
export const REVIEW_FILTERS: readonly { id: ReviewFilter; label: string }[] = [
  { id: 'never', label: 'Never recalled' },
  { id: 'untagged', label: 'No tags' },
  { id: 'stale', label: `Not recalled in ${STALE_DAYS} days` },
  { id: 'low', label: `Low importance (under ${LOW_IMPORTANCE})` },
  { id: 'retire', label: 'Retire candidates' },
  { id: 'notlive', label: 'Not live' },
]

const objects = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object' && !Array.isArray(row)) : [])
const whole = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

/** A /api/memories reply made safe to use; null when it is no object. */
export function parseReview(body: unknown): ReviewData | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const raw = body as Record<string, unknown>
  const rows = objects(raw.memories)
    .filter(row => typeof row.id === 'string' && row.id !== '')
    .map(row => ({
      id: String(row.id),
      owner: typeof row.owner === 'string' ? row.owner : '',
      text: plainLabel(typeof row.preview === 'string' ? row.preview : '', 200),
      created: typeof row.timestamp === 'string' ? row.timestamp : null,
      lastRecalled: typeof row.last_recalled === 'string' ? row.last_recalled : null,
      recalls: whole(row.recall_count),
      importance: typeof row.importance === 'number' && Number.isFinite(row.importance) ? row.importance : null,
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string' && tag !== '') : [],
      state: typeof row.state === 'string' && row.state !== '' ? row.state : 'live',
    }))
  return { total: whole(raw.total) || rows.length, rows }
}

/** Whether a memory belongs under a filter. Not recalled in 30 days: the last recall, else the day it was saved, is older than that (a memory saved last week is not yet cold). */
export function matchesReview(memory: ReviewMemory, filter: RowFilter, now: number): boolean {
  if (filter === 'never') return memory.recalls === 0
  if (filter === 'untagged') return memory.tags.length === 0
  if (filter === 'low') return memory.importance !== null && memory.importance < LOW_IMPORTANCE
  const days = daysAgo(memory.lastRecalled ?? memory.created, now)
  return days !== null && days >= STALE_DAYS
}

export const reviewList = (rows: readonly ReviewMemory[], filter: RowFilter, now: number) => rows.filter(row => matchesReview(row, filter, now))

/** The memories that are live: a row with no state (an older server) is live. Only these are reviewed by the four filters. */
export const liveRows = (rows: readonly ReviewMemory[]) => rows.filter(row => row.state === 'live')

/** How many memories each filter holds; `queue` is the counts of the two queue lists (candidates, not-live rows). */
export function reviewCounts(rows: readonly ReviewMemory[], now: number, queue: { retire: number; notlive: number } = { retire: 0, notlive: 0 }): Record<ReviewFilter, number> {
  return { never: reviewList(rows, 'never', now).length, untagged: reviewList(rows, 'untagged', now).length, stale: reviewList(rows, 'stale', now).length, low: reviewList(rows, 'low', now).length, ...queue }
}

// ---- The review queue: GET /api/review ----

export type Candidate = { id: string; owner: string; text: string; reasons: string[] }
export type TrailLine = { action: string; validator: string; at: string | null }
export type NotLive = { id: string; owner: string; text: string; state: 'retired' | 'expired' | 'lapsed'; since: string | null; history: TrailLine[] }
/** `candidateTotal` and `notLiveTotal` are what the server holds; the lists are cut at its limit. */
export type Queue = { candidates: Candidate[]; candidateTotal: number; notLive: NotLive[]; notLiveTotal: number }

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : [])

/** A /api/review reply made safe to use; null when it is no object. A missing list is empty; an unknown state reads as lapsed. */
export function parseQueue(body: unknown): Queue | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const raw = body as Record<string, unknown>
  const candidates = objects(raw.candidates)
    .filter(row => typeof row.id === 'string' && row.id !== '')
    .map(row => ({ id: String(row.id), owner: typeof row.owner === 'string' ? row.owner : '', text: plainLabel(typeof row.preview === 'string' ? row.preview : '', 200), reasons: strings(row.reasons).map(reason => plainLabel(reason, 200)) }))
  const notLive = objects(raw.notLive)
    .filter(row => typeof row.id === 'string' && row.id !== '')
    .map(row => ({
      id: String(row.id),
      owner: typeof row.owner === 'string' ? row.owner : '',
      text: plainLabel(typeof row.preview === 'string' ? row.preview : '', 200),
      state: (row.state === 'retired' ? 'retired' : row.state === 'expired' ? 'expired' : 'lapsed') as NotLive['state'],
      since: typeof row.since === 'string' ? row.since : null,
      history: objects(row.history)
        .filter(entry => typeof entry.action === 'string')
        .map(entry => ({ action: String(entry.action), validator: typeof entry.validator === 'string' ? entry.validator : '', at: typeof entry.at === 'string' ? entry.at : null })),
    }))
  return { candidates, candidateTotal: whole(raw.candidateTotal) || candidates.length, notLive, notLiveTotal: whole(raw.notLiveTotal) || notLive.length }
}

/** The id a near-duplicate reason names ("near-duplicate of <id> (0.93)"), or null for any other reason. */
export function nearPartner(reason: string): string | null {
  return /^near-duplicate of (\S+) \(/.exec(reason)?.[1] ?? null
}

/** A local calendar day, YYYY-MM-DD; '' when there is none. */
function dayText(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The state mark of a not-live row: retired by hand, expired as unused (with its last-used day when known) or lapsed (its own expiry passed). */
export function stateMark(row: Pick<NotLive, 'state'>, lastUsed?: string | null): string {
  if (row.state === 'retired') return 'retired'
  if (row.state === 'expired') {
    const used = dayText(lastUsed)
    return used === '' ? 'expired as unused' : `expired as unused (last used ${used})`
  }
  return 'lapsed (its expiry date passed)'
}

const VERBS: Record<string, string> = { retire: 'retired', restore: 'restored', update: 'updated', attest: 'confirmed', expire: 'expired' }

/** One audit row as a line: "retired by dashboard, 2026-10-25". Nobody known ('unknown' or none) drops the "by"; no date drops the date. Never any memory text. */
export function historyLine(entry: TrailLine): string {
  const verb = VERBS[entry.action] ?? plainLabel(entry.action, 30)
  const who = entry.validator === '' || entry.validator === 'unknown' ? '' : ` by ${plainLabel(entry.validator, 40)}`
  const when = dayText(entry.at)
  return `${verb}${who}${when === '' ? '' : `, ${when}`}`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The sentence under the filters for the two queue lists: what the list is, or that it is empty. `total` is what the server holds. */
export function queueText(filter: 'retire' | 'notlive', shown: number, total: number): string {
  const cut = total > shown ? ` Showing the first ${shown} of ${total}.` : ''
  if (filter === 'retire') {
    if (shown === 0) return 'Nothing looks like it needs retiring.'
    return `${plural(shown, 'memory is', 'memories are')} worth a second look. Retire one at a time: it stops being recalled, and Restore brings it back.${cut}`
  }
  if (shown === 0) return 'Every memory is live.'
  return `${plural(shown, 'memory is', 'memories are')} not live. Restore brings one back.${cut}`
}

/** The sentence under the filters: what the list is, or that it is empty. `loaded` is how many memories the page has; `total` how many the store holds. */
export function reviewText(filter: RowFilter, shown: number, loaded: number, total: number): string {
  const cut = loaded < total ? ` Looking at the newest ${loaded} of ${total} memories.` : ''
  if (shown === 0) {
    const none: Record<RowFilter, string> = {
      never: 'Every memory has come back in a recall at least once.',
      untagged: 'Every memory has a tag.',
      stale: `Every memory was recalled or saved in the last ${STALE_DAYS} days.`,
      low: `No memory has an importance under ${LOW_IMPORTANCE}.`,
    }
    return `${none[filter]}${cut}`
  }
  const what: Record<RowFilter, string> = {
    never: `${plural(shown, 'memory has', 'memories have')} never come back in a recall`,
    untagged: `${plural(shown, 'memory has', 'memories have')} no tag`,
    stale: `${plural(shown, 'memory has', 'memories have')} not come back in a recall for ${STALE_DAYS} days or more`,
    low: `${plural(shown, 'memory has', 'memories have')} an importance under ${LOW_IMPORTANCE}`,
  }
  return `${what[filter]}: candidates to review or retire.${cut}`
}

// ---- Elements: createElement and textContent only ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string, className?: string) {
  const element = document.createElement(tag)
  if (content !== undefined) element.textContent = content
  if (className) element.className = className
  return element
}

export type ReviewHost = {
  /** The project's colour dot and readable name. */
  project: (owner: string) => HTMLElement
  /** Open the memory (the Memories view). */
  open: (id: string) => void
  /** Retire one memory (POST /api/memory/retire); `done` gets an error text on failure, nothing on the server's confirmation. */
  retire: (id: string, replacedBy: string | undefined, done: (error?: string) => void) => void
  /** Restore one memory (POST /api/memory/restore); `done` as for retire. */
  restore: (id: string, done: (error?: string) => void) => void
  /** The day a memory was last used (recalled, else saved), when the page has it; the "expired as unused" mark shows it. */
  lastUsed: (id: string) => string | null
  now: () => number
}

/** The filter buttons (a segmented control of aria-pressed toggles), each with its count. */
export function filterButtons(counts: Record<ReviewFilter, number>, selected: ReviewFilter, pick: (filter: ReviewFilter) => void): HTMLElement[] {
  return REVIEW_FILTERS.map(({ id, label }) => {
    const button = el('button', undefined, 'seg-btn')
    button.type = 'button'
    button.dataset.filter = id
    button.setAttribute('aria-pressed', String(id === selected))
    button.append(el('span', label), el('span', ` ${counts[id]}`, 'mono'))
    button.addEventListener('click', () => pick(id))
    return button
  })
}

/** The first non-empty line of a text, cut to `max` characters. */
function lineOf(text: string, max = 80): string {
  const line = text.split('\n').find(part => part.trim() !== '') ?? ''
  return plainLabel(line, max)
}

/**
 * Open and a two-step Retire in one cell. Retire… opens a confirm that names the memory's first line and id and offers an
 * optional "replaced by"; only its Retire button asks the server, for this one memory. `note` is an extra line for the confirm.
 * `removed` runs once the server has confirmed.
 */
function retireCell(memory: { id: string; text: string }, host: ReviewHost, removed: () => void, note?: string): HTMLElement {
  const actions = el('td', undefined, 'row-actions')
  const open = el('button', 'Open', 'link')
  open.type = 'button'
  open.addEventListener('click', () => host.open(memory.id))
  const ask = el('button', 'Retire…', 'link danger-link')
  ask.type = 'button'
  const confirm = el('span', undefined, 'confirm-inline')
  confirm.hidden = true
  const warning = el('span', 'Retire this memory? It stops being recalled; Restore brings it back.', 'warn small')
  const naming = el('span', undefined, 'small')
  naming.append(el('span', `“${lineOf(memory.text) || '(no text)'}”`), el('span', ` · ${memory.id}`, 'mono muted'))
  const replaced = el('input', undefined, 'input')
  replaced.type = 'text'
  replaced.placeholder = 'Replaced by (memory id, optional)'
  replaced.setAttribute('aria-label', 'Replaced by, a memory id (optional)')
  replaced.maxLength = 64
  const yes = el('button', 'Retire', 'btn danger')
  yes.type = 'button'
  const keep = el('button', 'Keep', 'btn')
  keep.type = 'button'
  const problem = el('span', undefined, 'warn small')
  problem.hidden = true
  confirm.append(warning, naming)
  if (note !== undefined) confirm.append(el('span', note, 'small'))
  confirm.append(replaced, yes, keep, problem)
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
    problem.hidden = true
    const other = replaced.value.trim()
    host.retire(memory.id, other === '' ? undefined : other, error => {
      yes.disabled = false
      if (error === undefined) {
        removed()
        return
      }
      problem.textContent = error
      problem.hidden = false
    })
  })
  actions.append(open, ask, confirm)
  return actions
}

/** One row: the memory, its project, when it was saved, how often it came back, Open and a two-step Retire. */
export function reviewRow(memory: ReviewMemory, host: ReviewHost, removed: () => void): HTMLElement {
  const tr = el('tr')
  tr.dataset.id = memory.id
  const project = el('td', undefined, 'col-project')
  project.append(host.project(memory.owner))
  const recalled = memory.recalls === 0 ? 'never' : `${memory.recalls}, last ${agoText(memory.lastRecalled, host.now()) || 'unknown'}`
  tr.append(el('td', memory.text === '' ? '(no text)' : memory.text, 'know-text'), project, el('td', agoText(memory.created, host.now()) || 'unknown', 'small'), el('td', recalled, 'small'), retireCell(memory, host, removed))
  return tr
}

/**
 * One retire candidate: the memory, its project, why it is listed, Open and a two-step Retire. A near-duplicate
 * reason marks the row "keep one of these", so a pair is never retired by accident; the confirm names the other one.
 */
export function candidateRow(candidate: Candidate, host: ReviewHost, removed: () => void): HTMLElement {
  const tr = el('tr')
  tr.dataset.id = candidate.id
  const project = el('td', undefined, 'col-project')
  project.append(host.project(candidate.owner))
  const why = el('td', undefined, 'small')
  const partner = candidate.reasons.map(nearPartner).find((id): id is string => id !== null) ?? null
  const reasons = el('ul', undefined, 'reasons')
  for (const reason of candidate.reasons) reasons.append(el('li', reason))
  why.append(reasons)
  if (partner !== null) why.append(el('span', `Keep one of these: retire only one of this pair (the other is ${partner}).`, 'is-stale small'))
  tr.append(el('td', candidate.text === '' ? '(no text)' : candidate.text, 'know-text'), project, why, retireCell(candidate, host, removed, partner === null ? undefined : `This is one of a near-duplicate pair. Retire only one: the other is ${partner}.`))
  return tr
}

/** One not-live row: the memory, its project, its state mark and date, its last audit rows (none when it has none), Open and Restore. */
export function notLiveRow(row: NotLive, host: ReviewHost, restored: () => void): HTMLElement {
  const tr = el('tr')
  tr.dataset.id = row.id
  const project = el('td', undefined, 'col-project')
  project.append(host.project(row.owner))
  const state = el('td', undefined, 'small')
  const since = dayText(row.since)
  state.append(el('span', stateMark(row, row.state === 'expired' ? host.lastUsed(row.id) : null), `state-mark is-${row.state}`))
  if (since !== '') state.append(el('span', ` · ${since}`, 'muted'))
  const history = el('td', undefined, 'small muted')
  // Nothing at all for a row with no audit rows (a lapsed row usually has none).
  for (const entry of row.history) history.append(el('div', historyLine(entry)))
  const actions = el('td', undefined, 'row-actions')
  const open = el('button', 'Open', 'link')
  open.type = 'button'
  open.addEventListener('click', () => host.open(row.id))
  const restore = el('button', 'Restore', 'btn')
  restore.type = 'button'
  const problem = el('span', undefined, 'warn small')
  problem.hidden = true
  restore.addEventListener('click', () => {
    restore.disabled = true
    problem.hidden = true
    host.restore(row.id, error => {
      restore.disabled = false
      if (error === undefined) {
        restored()
        return
      }
      problem.textContent = error
      problem.hidden = false
    })
  })
  actions.append(open, restore, problem)
  tr.append(el('td', row.text === '' ? '(no text)' : row.text, 'know-text'), project, state, history, actions)
  return tr
}
