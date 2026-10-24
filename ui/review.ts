// The Review tab: memories worth a second look, so you can open them or forget them.
// It started as the Health tab's Never recalled list and now holds four filters.
//
// The data is GET /api/memories (the newest memories with their importance, tags,
// recall count and last recall). The functions are pure (no DOM) except the builders
// at the end, which make elements with createElement and textContent only.
// ui/app.ts fetches the reply and calls them.
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
}
/** `total` is what the store holds; `rows` are the memories the server sent (at most its list limit). */
export type ReviewData = { total: number; rows: ReviewMemory[] }

export type ReviewFilter = 'never' | 'untagged' | 'stale' | 'low'
export const LOW_IMPORTANCE = 0.4
export const REVIEW_FILTERS: readonly { id: ReviewFilter; label: string }[] = [
  { id: 'never', label: 'Never recalled' },
  { id: 'untagged', label: 'No tags' },
  { id: 'stale', label: `Not recalled in ${STALE_DAYS} days` },
  { id: 'low', label: `Low importance (under ${LOW_IMPORTANCE})` },
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
    }))
  return { total: whole(raw.total) || rows.length, rows }
}

/** Whether a memory belongs under a filter. Not recalled in 30 days: the last recall, else the day it was saved, is older than that (a memory saved last week is not yet cold). */
export function matchesReview(memory: ReviewMemory, filter: ReviewFilter, now: number): boolean {
  if (filter === 'never') return memory.recalls === 0
  if (filter === 'untagged') return memory.tags.length === 0
  if (filter === 'low') return memory.importance !== null && memory.importance < LOW_IMPORTANCE
  const days = daysAgo(memory.lastRecalled ?? memory.created, now)
  return days !== null && days >= STALE_DAYS
}

export const reviewList = (rows: readonly ReviewMemory[], filter: ReviewFilter, now: number) => rows.filter(row => matchesReview(row, filter, now))

/** How many memories each filter holds. */
export function reviewCounts(rows: readonly ReviewMemory[], now: number): Record<ReviewFilter, number> {
  return { never: reviewList(rows, 'never', now).length, untagged: reviewList(rows, 'untagged', now).length, stale: reviewList(rows, 'stale', now).length, low: reviewList(rows, 'low', now).length }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The sentence under the filters: what the list is, or that it is empty. `loaded` is how many memories the page has; `total` how many the store holds. */
export function reviewText(filter: ReviewFilter, shown: number, loaded: number, total: number): string {
  const cut = loaded < total ? ` Looking at the newest ${loaded} of ${total} memories.` : ''
  if (shown === 0) {
    const none: Record<ReviewFilter, string> = {
      never: 'Every memory has come back in a recall at least once.',
      untagged: 'Every memory has a tag.',
      stale: `Every memory was recalled or saved in the last ${STALE_DAYS} days.`,
      low: `No memory has an importance under ${LOW_IMPORTANCE}.`,
    }
    return `${none[filter]}${cut}`
  }
  const what: Record<ReviewFilter, string> = {
    never: `${plural(shown, 'memory has', 'memories have')} never come back in a recall`,
    untagged: `${plural(shown, 'memory has', 'memories have')} no tag`,
    stale: `${plural(shown, 'memory has', 'memories have')} not come back in a recall for ${STALE_DAYS} days or more`,
    low: `${plural(shown, 'memory has', 'memories have')} an importance under ${LOW_IMPORTANCE}`,
  }
  return `${what[filter]}: candidates to review or forget.${cut}`
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
  /** The existing guarded forget; `done` gets an error text on failure. */
  forget: (id: string, done: (error?: string) => void) => void
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

/** One row: the memory, its project, when it was saved, how often it came back, Open and a two-step Forget. */
export function reviewRow(memory: ReviewMemory, host: ReviewHost, removed: () => void): HTMLElement {
  const tr = el('tr')
  tr.dataset.id = memory.id
  const project = el('td', undefined, 'col-project')
  project.append(host.project(memory.owner))
  const recalled = memory.recalls === 0 ? 'never' : `${memory.recalls}, last ${agoText(memory.lastRecalled, host.now()) || 'unknown'}`
  const actions = el('td', undefined, 'row-actions')
  const open = el('button', 'Open', 'link')
  open.type = 'button'
  open.addEventListener('click', () => host.open(memory.id))
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
  actions.append(open, ask, confirm)
  tr.append(el('td', memory.text === '' ? '(no text)' : memory.text, 'know-text'), project, el('td', agoText(memory.created, host.now()) || 'unknown', 'small'), el('td', recalled, 'small'), actions)
  return tr
}
