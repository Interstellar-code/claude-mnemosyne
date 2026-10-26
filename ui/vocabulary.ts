// The Vocabulary tab (plan CRUD.3): the shared tag list by namespace with counts, and the candidates the
// tagger proposed, each with Admit and Alias to. The data is GET /api/vocabulary; the writes are
// POST /api/vocabulary/admit and /alias (C7).
//
// A change shows as done only after the server confirmed it: the buttons send the request, then the page reads
// the vocabulary again, so the lists are the server's. A refusal (400 for a tag that cannot be used, 409 for a
// rule of the vocabulary) is shown as its message. The functions are pure except the `draw*` builders, which make
// elements with createElement and textContent only. ui/app.ts fetches the lists and passes in a VocabularyHost.
import { plainLabel } from './escape'

export type VocabTag = { tag: string; ns: string | null; description: string; aliases: string[]; count: number }
export type VocabCandidate = { tag: string; count: number }
/** `exists` is false while there is no vocabulary file (the server answers empty lists). */
export type VocabData = { exists: boolean; tags: VocabTag[]; candidates: VocabCandidate[] }

const objects = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object' && !Array.isArray(row)) : [])
const whole = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

/** A /api/vocabulary reply made safe to use; null when it is no object. */
export function parseVocabulary(body: unknown): VocabData | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const raw = body as Record<string, unknown>
  return {
    exists: raw.exists === true,
    tags: objects(raw.tags)
      .filter(row => typeof row.tag === 'string' && row.tag !== '')
      .map(row => ({
        tag: String(row.tag),
        ns: typeof row.ns === 'string' && row.ns !== '' ? row.ns : null,
        description: typeof row.description === 'string' ? plainLabel(row.description, 200) : '',
        aliases: Array.isArray(row.aliases) ? row.aliases.filter((alias): alias is string => typeof alias === 'string' && alias !== '') : [],
        count: whole(row.count),
      })),
    candidates: objects(raw.candidates)
      .filter(row => typeof row.tag === 'string' && row.tag !== '')
      .map(row => ({ tag: String(row.tag), count: whole(row.count) })),
  }
}

/** The namespaces in the order the page shows them; a tag with none is under 'other'. */
export const NAMESPACES: readonly { id: string; label: string }[] = [
  { id: 'entity', label: 'Entities' },
  { id: 'agent', label: 'Agents' },
  { id: 'asset', label: 'Assets' },
  { id: 'other', label: 'Other tags' },
]

/** The tags grouped by namespace, in NAMESPACES order, empty groups left out; inside a group the server's order (most used first). */
export function groupTags<T extends { tag: string; ns: string | null }>(tags: readonly T[]): { id: string; label: string; tags: T[] }[] {
  const groupOf = (ns: string | null) => (NAMESPACES.some(known => known.id === ns && known.id !== 'other') ? (ns as string) : 'other')
  return NAMESPACES.map(group => ({ ...group, tags: tags.filter(tag => groupOf(tag.ns) === group.id) })).filter(group => group.tags.length > 0)
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The count a tag shows: a tag nothing uses yet shows 0 (it is never removed on its own). */
export const countText = (count: number) => plural(count, 'memory', 'memories')

/** The sentence under the heading: what the lists hold, or that there is no vocabulary yet. */
export function vocabularyText(data: VocabData): string {
  if (!data.exists) return 'There is no tag vocabulary yet. Run /mnemosyne-tags in Claude Code to make one.'
  return `${plural(data.tags.length, 'tag', 'tags')} in the vocabulary, ${plural(data.candidates.length, 'candidate', 'candidates')} waiting.`
}

/** The text of a refused or failed vocabulary call. */
export function vocabularyFailure(status: number, body: unknown): string {
  const error = body !== null && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? plainLabel((body as { error: string }).error, 300) : ''
  if (status === 0) return error || 'Could not reach the server.'
  return error || `The server answered ${status}.`
}

/** What a confirmed admit or alias says. Taken from the server's reply, never from what was typed. */
export function vocabularyDone(path: string, reply: unknown): string {
  const body = reply !== null && typeof reply === 'object' ? (reply as Record<string, unknown>) : {}
  if (path.endsWith('/admit')) {
    const tag = typeof body.tag === 'string' ? body.tag : 'the tag'
    return body.status === 'already admitted' ? `${tag} was already in the vocabulary.` : `${tag} is now in the vocabulary.`
  }
  const from = typeof body.from === 'string' ? body.from : 'the spelling'
  const to = typeof body.to === 'string' ? body.to : 'the tag'
  return `${from} now counts as ${to}.`
}

// ---- Elements: createElement and textContent only ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string, className?: string) {
  const element = document.createElement(tag)
  if (content !== undefined) element.textContent = content
  if (className) element.className = className
  return element
}

export type VocabularyHost = {
  /** POST with the token. Status 0 means the request never got an answer. */
  post: (path: string, body: unknown) => Promise<{ status: number; body: unknown }>
  /** Reads the vocabulary again and redraws; `message` is shown once, after the fresh lists are in. */
  reload: (message: string) => void
}

/** The tags, grouped by namespace, each with its count, its description and its other spellings. */
export function tagGroups(data: VocabData): HTMLElement[] {
  if (data.tags.length === 0) return [el('p', data.exists ? 'No tags are admitted yet.' : '', 'muted small')]
  return groupTags(data.tags).map(group => {
    const box = el('section', undefined, 'card vocab-group')
    box.dataset.ns = group.id
    box.append(el('h3', `${group.label} (${group.tags.length})`, 'card-title'))
    const list = el('div', undefined, 'list')
    for (const tag of group.tags) {
      const row = el('div', undefined, 'list-row vocab-tag')
      row.dataset.tag = tag.tag
      const head = el('span', undefined, 'vocab-name')
      head.append(el('span', tag.tag, 'tag'))
      if (tag.description !== '') head.append(el('span', ` ${tag.description}`, 'muted small'))
      const notes = tag.aliases.length > 0 ? ` · also written ${tag.aliases.join(', ')}` : ''
      // A tag nothing uses shows 0; it stays until a person removes it.
      row.append(head, el('span', `${countText(tag.count)}${notes}`, tag.count === 0 ? 'mono small is-stale' : 'mono muted small'))
      list.append(row)
    }
    box.append(list)
    return box
  })
}

/** One candidate: its count, Admit, and Alias to (a select of the admitted tags and a button). Each call asks the server, then reloads. */
export function candidateRow(candidate: VocabCandidate, admitted: readonly VocabTag[], host: VocabularyHost): HTMLElement {
  const row = el('div', undefined, 'list-row vocab-candidate')
  row.dataset.tag = candidate.tag
  const head = el('span', undefined, 'vocab-name')
  head.append(el('span', candidate.tag, 'tag'), el('span', ` ${countText(candidate.count)}`, 'muted small'))
  const actions = el('span', undefined, 'vocab-actions')
  const problem = el('span', undefined, 'warn small')
  problem.hidden = true
  const admit = el('button', 'Admit', 'btn')
  admit.type = 'button'
  const target = el('select', undefined, 'input')
  target.setAttribute('aria-label', `Alias ${candidate.tag} to`)
  const none = el('option', 'Alias to…')
  none.value = ''
  target.append(none)
  for (const tag of admitted) {
    const option = el('option', tag.tag)
    option.value = tag.tag
    target.append(option)
  }
  const alias = el('button', 'Alias', 'btn')
  alias.type = 'button'
  const say = (text: string) => {
    problem.textContent = text
    problem.hidden = text === ''
  }
  const run = async (path: string, body: unknown) => {
    admit.disabled = true
    alias.disabled = true
    say('')
    const reply = await host.post(path, body)
    admit.disabled = false
    alias.disabled = false
    if (reply.status === 200) {
      // The lists are read again from the server; the sentence comes from its reply.
      host.reload(vocabularyDone(path, reply.body))
      return
    }
    say(vocabularyFailure(reply.status, reply.body))
  }
  admit.addEventListener('click', () => void run('/api/vocabulary/admit', { tag: candidate.tag }))
  alias.addEventListener('click', () => {
    if (target.value === '') return say('Pick the tag it should count as.')
    void run('/api/vocabulary/alias', { from: candidate.tag, to: target.value })
  })
  actions.append(admit, target, alias, problem)
  row.append(head, actions)
  return row
}

/** The candidates card, or one line when there are none. */
export function candidateList(data: VocabData, host: VocabularyHost): HTMLElement[] {
  if (!data.exists) return []
  if (data.candidates.length === 0) return [el('p', 'No candidates are waiting.', 'muted small')]
  const box = el('section', undefined, 'card vocab-group')
  box.append(el('h3', `Candidates (${data.candidates.length})`, 'card-title'), el('p', 'Tags the tagger proposed that are not in the vocabulary. Admit one, or make it count as an admitted tag.', 'muted small'))
  const list = el('div', undefined, 'list')
  for (const candidate of data.candidates) list.append(candidateRow(candidate, data.tags, host))
  box.append(list)
  return [box]
}
