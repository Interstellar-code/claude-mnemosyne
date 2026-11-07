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
/** `exists` is false while there is no vocabulary file (the server answers empty lists). `autoAdmit` (0.24.0) is tags.autoAdmitCount. */
export type VocabData = { exists: boolean; tags: VocabTag[]; candidates: VocabCandidate[]; autoAdmit: number }

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
    autoAdmit: whole(raw.autoAdmitCount) || 3,
  }
}

/**
 * The groups in the order the page shows them, each with a glyph so it reads without colour. 0.24.0: a tag with no namespace
 * is a Topic, or a Project when its name is part of a project on the map ("Other tags" is gone).
 */
export const NAMESPACES: readonly { id: string; label: string; glyph: string; help: string }[] = [
  { id: 'other', label: 'Topics', glyph: '#', help: 'Tags with no namespace that name no project.' },
  { id: 'project', label: 'Projects', glyph: '▣', help: 'Tags whose name is part of a project on the map.' },
  { id: 'entity', label: 'Entities', glyph: '◆', help: 'People, companies and clients.' },
  { id: 'asset', label: 'Assets', glyph: '▲', help: 'Servers, tools and things you run.' },
  { id: 'agent', label: 'Agents', glyph: '●', help: 'The apps that work with memory.' },
]

/** Letters and digits only, lower case: "NCE-MCS" and "nce mcs" read alike. */
const bare = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Words a project name carries that do not name it: "Project-Uno-2025" is "uno", "Code-Subshero" is "subshero". */
const FILLER = new Set(['project', 'projects', 'code', 'the', 'repo'])

/** A project name's core: its words without filler words and plain numbers, joined. */
export const projectCore = (project: string) =>
  project
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word !== '' && !FILLER.has(word) && !/^\d+$/.test(word))
    .join('')

/**
 * Whether a tag with no namespace names a project: its bare name is the project's whole name or its core ("nce-mcs" for
 * NCE-MCS, "uno" for Project-Uno-2025). A word that is only part of a name ("sap" in SAPflow, "personal" in personal-life)
 * stays a topic.
 */
export function namesProject(tag: string, projects: readonly string[]): boolean {
  const t = bare(tag)
  if (t.length < 2) return false
  return projects.some(project => t === bare(project) || t === projectCore(project))
}

/** The tags grouped, in NAMESPACES order, empty groups left out; inside a group the given order (the server's: most used first). */
export function groupTags<T extends { tag: string; ns: string | null }>(tags: readonly T[], projects: readonly string[] = []): { id: string; label: string; glyph: string; help: string; tags: T[] }[] {
  const groupOf = (tag: T) => {
    if (tag.ns !== null && NAMESPACES.some(known => known.id === tag.ns && known.id !== 'other' && known.id !== 'project')) return tag.ns
    return tag.ns === null && namesProject(tag.tag, projects) ? 'project' : 'other'
  }
  return NAMESPACES.map(group => ({ ...group, tags: tags.filter(tag => groupOf(tag) === group.id) })).filter(group => group.tags.length > 0)
}

export type TagSort = 'used' | 'az'

/** The tags that match the find text (tag, alias or description, case ignored), in the order picked. */
export function findTags<T extends VocabTag>(tags: readonly T[], query: string, sort: TagSort = 'used'): T[] {
  const needle = query.trim().toLowerCase()
  const kept = needle === '' ? [...tags] : tags.filter(tag => tag.tag.toLowerCase().includes(needle) || tag.aliases.some(alias => alias.toLowerCase().includes(needle)) || tag.description.toLowerCase().includes(needle))
  return sort === 'az' ? kept.sort((a, b) => nameOf(a.tag).localeCompare(nameOf(b.tag))) : kept.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/** A tag without its namespace: "entity:arxada" → "arxada". */
export const nameOf = (tag: string) => (tag.includes(':') ? tag.slice(tag.indexOf(':') + 1) : tag)

/** The tiles: admitted, waiting, unused, and how many tag uses in all. */
export function vocabTiles(data: VocabData): { admitted: number; waiting: number; unused: number; uses: number } {
  return { admitted: data.tags.length, waiting: data.candidates.length, unused: data.tags.filter(tag => tag.count === 0).length, uses: data.tags.reduce((n, tag) => n + tag.count, 0) }
}

/** Uses per group, for the ribbon: each group's share in twentieths (at least 1 for a group with uses). */
export function ribbon(data: VocabData, projects: readonly string[] = []): { id: string; label: string; glyph: string; uses: number; tags: number; width: number }[] {
  const groups = groupTags(data.tags, projects).map(group => ({ id: group.id, label: group.label, glyph: group.glyph, uses: group.tags.reduce((n, tag) => n + tag.count, 0), tags: group.tags.length }))
  const total = groups.reduce((n, group) => n + group.uses, 0)
  return groups.map(group => ({ ...group, width: total === 0 || group.uses === 0 ? 0 : Math.max(1, Math.round((group.uses / total) * 20)) }))
}

/** The edit distance between two short texts (insert, delete, change one character). */
export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j]!
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = keep
    }
  }
  return row[b.length]!
}

/**
 * The admitted tag a candidate looks like a spelling of: the nearest by edit distance (2 or less, on the bare names), else one
 * whose bare name contains the candidate's or the other way round (3+ characters). Null when none is close.
 */
export function spellingOf(candidate: string, admitted: readonly VocabTag[]): VocabTag | null {
  const c = bare(nameOf(candidate))
  if (c === '') return null
  let best: VocabTag | null = null
  let bestDistance = 3
  for (const tag of admitted) {
    const t = bare(nameOf(tag.tag))
    // The same letters spelt with other punctuation ("s4-hana" for s4hana) is the closest of all.
    if (t === '' || tag.tag === candidate) continue
    const d = editDistance(c, t)
    if (d < bestDistance || (d === bestDistance && best !== null && tag.count > best.count)) {
      best = tag
      bestDistance = d
    }
  }
  if (best !== null && bestDistance <= 2) return best
  return admitted.filter(tag => {
    const t = bare(nameOf(tag.tag))
    return t.length >= 3 && c.length >= 3 && t !== c && (t.includes(c) || c.includes(t))
  }).sort((a, b) => b.count - a.count)[0] ?? null
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
  /** 0.24.0, optional: the Memories tab filtered to one tag, and the Settings tab (the auto-admit count). */
  openTag?: (tag: string) => void
  openSettings?: () => void
}

export type GroupOptions = { projects?: readonly string[]; query?: string; sort?: TagSort; openTag?: (tag: string) => void }

/**
 * The tags, grouped (0.24.0: Topics, Projects, Entities, Assets, Agents), each row with its name (the namespace muted), its
 * other spellings and description, a usage bar against the most used tag, and its count. An unused tag is ash with a dashed
 * "unused" label: it is allowed, and stays until a person removes it.
 */
export function tagGroups(data: VocabData, options: GroupOptions = {}): HTMLElement[] {
  if (data.tags.length === 0) return [el('p', data.exists ? 'No tags are admitted yet.' : '', 'muted small')]
  const shown = findTags(data.tags, options.query ?? '', options.sort ?? 'used')
  if (shown.length === 0) return [el('p', `No tag matches “${plainLabel(options.query ?? '', 60)}”.`, 'muted small')]
  const most = Math.max(1, ...data.tags.map(tag => tag.count))
  return groupTags(shown, options.projects ?? []).map(group => {
    const box = el('section', undefined, 'card vocab-group')
    box.dataset.ns = group.id
    const title = el('h3', undefined, 'card-title vg-head')
    const uses = group.tags.reduce((n, tag) => n + tag.count, 0)
    title.append(el('span', group.glyph, 'vg-glyph'), el('span', group.label), el('span', String(group.tags.length), 'vg-n mono'), el('span', `${uses} ${uses === 1 ? 'use' : 'uses'}`, 'vg-uses mono muted'))
    box.append(title, el('p', group.help, 'muted small vg-help'))
    const list = el('div', undefined, 'list')
    for (const tag of group.tags) {
      const row = el('div', undefined, tag.count === 0 ? 'list-row vocab-tag is-unused' : 'list-row vocab-tag')
      row.dataset.tag = tag.tag
      const head = el('span', undefined, 'vocab-name')
      if (tag.tag.includes(':')) head.append(el('span', tag.tag.slice(0, tag.tag.indexOf(':') + 1), 'vt-ns'))
      head.append(el('span', nameOf(tag.tag), 'vt-name'))
      if (tag.description !== '') head.append(el('span', ` ${tag.description}`, 'muted small'))
      if (tag.aliases.length > 0) head.append(el('span', ` also ${tag.aliases.join(', ')}`, 'muted small vt-also'))
      if (tag.count === 0) head.append(el('span', 'unused', 'vt-unused'))
      else if (options.openTag) {
        const open = el('button', `Open ${countText(tag.count)} →`, 'link small vt-open')
        open.type = 'button'
        const go = options.openTag
        open.addEventListener('click', () => go(tag.tag))
        head.append(open)
      }
      const bar = el('span', undefined, 'bar vt-bar')
      bar.setAttribute('aria-hidden', 'true')
      bar.append(el('span', undefined, `bar-fill w${tag.count === 0 ? 0 : Math.max(1, Math.round((tag.count / most) * 20))}`))
      // The count: the number for the eye, the words for a screen reader and the old "0 memories" text.
      const count = el('span', undefined, 'vt-count mono')
      count.append(el('span', String(tag.count)), el('span', ` ${tag.count === 1 ? 'memory' : 'memories'}`, 'sr-only'))
      row.append(head, bar, count)
      list.append(row)
    }
    box.append(list)
    return box
  })
}

/**
 * One candidate (0.24.0 card): its count, ticks toward the auto-admit count, a spelling suggestion when one admitted tag is
 * close ("Count as sap" first), Admit, and Count as… with any admitted tag. Each call asks the server, then reloads.
 */
export function candidateRow(candidate: VocabCandidate, admitted: readonly VocabTag[], host: VocabularyHost, autoAdmit = 3): HTMLElement {
  const row = el('div', undefined, 'list-row vocab-candidate')
  row.dataset.tag = candidate.tag
  const head = el('span', undefined, 'vocab-name vc-head')
  head.append(el('span', candidate.tag, 'tag vc-tag'), el('span', ` ${countText(candidate.count)}`, 'muted small'))
  const ticks = el('span', undefined, 'vc-ticks')
  ticks.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < autoAdmit; i++) ticks.append(el('span', undefined, i < candidate.count ? 'vc-tick is-on' : 'vc-tick'))
  const progress = el('span', `${Math.min(candidate.count, autoAdmit)} of ${autoAdmit} · admitted on its own at ${autoAdmit}`, 'muted small vc-progress')
  const suggestion = spellingOf(candidate.tag, admitted)
  const actions = el('span', undefined, 'vocab-actions')
  const problem = el('span', undefined, 'warn small')
  problem.hidden = true
  const admit = el('button', suggestion ? 'Admit as new' : 'Admit', suggestion ? 'btn small' : 'btn primary small')
  admit.type = 'button'
  const target = el('select', undefined, 'input vc-target')
  target.setAttribute('aria-label', `Count ${candidate.tag} as`)
  const none = el('option', 'Count as…')
  none.value = ''
  target.append(none)
  for (const tag of admitted) {
    const option = el('option', tag.tag)
    option.value = tag.tag
    target.append(option)
  }
  const alias = el('button', 'Apply', 'btn small vc-alias')
  alias.type = 'button'
  const buttons: HTMLButtonElement[] = [admit, alias]
  const say = (text: string) => {
    problem.textContent = text
    problem.hidden = text === ''
  }
  const run = async (path: string, body: unknown) => {
    for (const b of buttons) b.disabled = true
    say('')
    const reply = await host.post(path, body)
    for (const b of buttons) b.disabled = false
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
  const card: HTMLElement[] = [head, ticks, progress]
  if (suggestion) {
    const looks = el('p', undefined, 'vc-looks small')
    looks.append(document.createTextNode('Looks like '), el('strong', suggestion.tag), document.createTextNode(' (spelling)'))
    const count = el('button', `Count as ${suggestion.tag}`, 'btn primary small vc-suggest')
    count.type = 'button'
    count.addEventListener('click', () => void run('/api/vocabulary/alias', { from: candidate.tag, to: suggestion.tag }))
    buttons.push(count)
    target.value = suggestion.tag
    actions.append(count, admit)
    card.push(looks)
  } else actions.append(admit)
  const other = el('span', undefined, 'vocab-actions vc-other')
  other.append(target, alias)
  card.push(actions, other, problem)
  row.append(...card)
  return row
}

/** The candidates panel: a card per candidate, or (0.24.0) an empty state that says how a tag joins on its own. */
export function candidateList(data: VocabData, host: VocabularyHost): HTMLElement[] {
  if (!data.exists) return []
  const box = el('section', undefined, 'card vocab-group vc-panel')
  const title = el('h3', undefined, 'card-title vg-head')
  title.append(el('span', 'Candidates to review'), el('span', String(data.candidates.length), 'vg-n mono'))
  box.append(title, el('p', 'Tags the tagger proposed that are not admitted yet.', 'muted small'))
  if (data.candidates.length === 0) {
    const empty = el('div', undefined, 'vc-empty')
    empty.append(el('p', 'No candidates waiting', 'st-title'), el('p', `New tags the tagger proposes show here. A tag used by ${data.autoAdmit} memories joins the vocabulary on its own.`, 'muted small'))
    if (host.openSettings) {
      const go = el('button', `Auto-admit count: ${data.autoAdmit} → Settings`, 'link small')
      go.type = 'button'
      go.addEventListener('click', host.openSettings)
      empty.append(go)
    }
    box.append(empty)
  } else {
    const list = el('div', undefined, 'list vc-list')
    for (const candidate of data.candidates) list.append(candidateRow(candidate, data.tags, host, data.autoAdmit))
    box.append(list)
  }
  const notes = el('ul', undefined, 'vc-notes muted small')
  notes.append(el('li', 'A candidate never changes a memory’s tags until you act.'), el('li', '“Count as” keeps the old spelling as an alias; nothing is retagged by hand.'))
  box.append(notes)
  return [box]
}
