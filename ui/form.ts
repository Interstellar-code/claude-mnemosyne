// The New memory and Edit form (plan CRUD.1): content, kind, tags from the vocabulary, importance, expiry,
// Pinned (edit only) and owner (new only). One form for both; the routes are POST /api/memory/create and
// /api/memory/update (C7, ui/server.ts).
//
// The page never shows a save as done before the server said so: Save sends the request and waits, and the
// sheet closes (host.done) only on a 200. Answers: 409 lists each warning (the guard's rule, and each
// near-duplicate with its id and score) and offers Save anyway, which resends the same request with
// confirm: true; 422 lists the rule names and offers no save; 413 says the text is too long.
// The functions are pure except `buildForm`, which makes elements with createElement and textContent only
// (no HTML is ever parsed from data; the CSP refuses inline styles and scripts).
import { CONTEXT_EXPIRY_DAYS, isKind, KINDS } from '../hooks/kinds'
import { plainLabel } from './escape'
import { groupTags, type VocabData } from './vocabulary'

export type FormMemory = {
  id: string
  owner: string
  content?: string
  preview?: string
  importance?: number | null
  memory_type?: string | null
  valid_until?: string | null
  metadata?: Record<string, unknown> | null
  tags?: string[]
}

/** What the fields hold when Save is pressed. */
export type FormValues = {
  owner: string
  content: string
  kind: string
  tags: string[]
  importance: string
  expires: string
  removeExpiry: boolean
  pinned: boolean
}

export type Request = { body: Record<string, unknown> } | { error: string }

/** The expiry a kind starts with: 14 days for project state (kind context), none for the rest. */
export const defaultExpiry = (kind: string): string => (kind === 'context' ? String(CONTEXT_EXPIRY_DAYS) : '')

const num = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text))

/** Why the importance or expiry text cannot be sent, or undefined. */
function fieldProblem(values: FormValues): string | undefined {
  const importance = num(values.importance)
  if (values.importance.trim() !== '' && !(importance >= 0 && importance <= 1)) return 'Importance is a number from 0 to 1.'
  if (values.expires.trim() !== '') {
    const days = num(values.expires)
    if (!Number.isInteger(days) || days < 1 || days > 365) return 'Expiry is a whole number of days from 1 to 365.'
  }
  return undefined
}

/**
 * The create request. Kind is required, and `pinned` is never part of it (a new memory is not pinned; pinning is an edit).
 * `confirm` is added only by Save anyway.
 */
export function createRequest(values: FormValues): Request {
  if (values.content.trim() === '') return { error: 'Write the memory first.' }
  if (!isKind(values.kind)) return { error: 'Pick a kind.' }
  if (values.owner === '') return { error: 'Pick where it belongs.' }
  const problem = fieldProblem(values)
  if (problem !== undefined) return { error: problem }
  return {
    body: {
      owner: values.owner,
      content: values.content,
      kind: values.kind,
      tags: values.tags,
      ...(values.importance.trim() === '' ? {} : { importance: Number(values.importance) }),
      ...(values.expires.trim() === '' ? {} : { expires_in_days: Number(values.expires) }),
    },
  }
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n')

/** The memory's tags as the form first shows them. */
export const tagsOf = (memory: FormMemory): string[] => (Array.isArray(memory.tags) ? memory.tags : Array.isArray(memory.metadata?.tags) ? (memory.metadata.tags as unknown[]) : []).filter((tag): tag is string => typeof tag === 'string' && tag !== '')

/** The edit request: only what changed, so an untouched text is not checked by the guard again. 'nothing' says there is nothing to save. */
export function updateRequest(memory: FormMemory, values: FormValues): Request {
  const problem = fieldProblem(values)
  if (problem !== undefined) return { error: problem }
  const body: Record<string, unknown> = { memory_id: memory.id }
  const original = memory.content ?? memory.preview ?? ''
  if (values.content.trim() === '') return { error: 'The memory cannot be empty.' }
  if (values.content !== original) body.content = values.content
  if (values.kind !== '' && values.kind !== (memory.memory_type ?? '')) {
    if (!isKind(values.kind)) return { error: 'Pick a kind.' }
    body.kind = values.kind
  }
  if (!sameList(values.tags, tagsOf(memory))) body.tags = values.tags
  const was = typeof memory.importance === 'number' ? memory.importance : null
  if (values.importance.trim() !== '' && Number(values.importance) !== was) body.importance = Number(values.importance)
  if (values.removeExpiry) body.expires_in_days = null
  else if (values.expires.trim() !== '') body.expires_in_days = Number(values.expires)
  const pinned = memory.metadata?.pinned === true
  if (values.pinned !== pinned) body.pinned = values.pinned
  if (Object.keys(body).length === 1) return { error: 'Nothing has changed.' }
  return { body }
}

export type Near = { id: string; score: number; preview: string }
export type Hit = { rule: string; message: string }

export type Answer =
  | { kind: 'saved'; text: string; id: string }
  | { kind: 'warn'; text: string; hits: Hit[]; near: Near[] }
  | { kind: 'blocked'; text: string; hits: Hit[] }
  | { kind: 'toolong'; text: string }
  | { kind: 'failed'; text: string }

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

function hitsOf(value: unknown): Hit[] {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).map(hit => ({ rule: typeof hit.rule === 'string' ? hit.rule : '?', message: typeof hit.message === 'string' ? plainLabel(hit.message, 300) : '' }))
}

function nearOf(value: unknown): Near[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(isObject)
    .filter(item => typeof item.id === 'string')
    .map(item => ({ id: String(item.id), score: typeof item.score === 'number' ? item.score : 0, preview: typeof item.preview === 'string' ? plainLabel(item.preview, 120) : '' }))
}

/** The server's answer to a create or update, as the form shows it. Status 0 is a request that got no answer. */
export function answerOf(status: number, body: unknown, creating: boolean): Answer {
  const reply = isObject(body) ? body : {}
  const error = typeof reply.error === 'string' ? plainLabel(reply.error, 300) : ''
  if (status === 200 && (reply.status === 'stored' || reply.status === 'updated')) {
    const id = typeof reply.memory_id === 'string' ? reply.memory_id : ''
    return { kind: 'saved', id, text: `${creating ? 'Saved' : 'Updated'} memory ${id}.` }
  }
  if (status === 409 && reply.verdict === 'warn') {
    return { kind: 'warn', text: 'The save guard has warnings about this text.', hits: hitsOf(reply.hits), near: nearOf(reply.near) }
  }
  if (status === 422) return { kind: 'blocked', text: 'The save guard refused this text. It cannot be saved as it is.', hits: hitsOf(reply.hits) }
  if (status === 413) return { kind: 'toolong', text: 'That text is too long to save. Shorten it and try again.' }
  if (status === 0) return { kind: 'failed', text: error || 'Could not reach the server. Nothing was saved.' }
  return { kind: 'failed', text: `${creating ? 'Save' : 'Update'} failed: ${error || `the server answered ${status}`}` }
}

/** One warning as a line: the rule and what it says. The near-duplicate rule (G3) is listed by `nearLines` instead when the answer has them. */
export const hitLine = (hit: Hit) => `${hit.rule}: ${hit.message}`

/** A near-duplicate as a line: its id, its score and the start of its text. */
export const nearLine = (near: Near) => `Near-duplicate of ${near.id} (score ${near.score.toFixed(2)})${near.preview === '' ? '' : `: ${near.preview}`}`

/** The lines of a warning or a block: the guard's hits, with G3 replaced by each near-duplicate (id and score) when the answer has them. */
export function answerLines(answer: Answer): string[] {
  if (answer.kind === 'blocked') return answer.hits.map(hitLine)
  if (answer.kind !== 'warn') return []
  const hits = answer.near.length > 0 ? answer.hits.filter(hit => hit.rule !== 'G3') : answer.hits
  return [...hits.map(hitLine), ...answer.near.map(nearLine)]
}

// ---- Elements: createElement and textContent only ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string, className?: string) {
  const element = document.createElement(tag)
  if (content !== undefined) element.textContent = content
  if (className) element.className = className
  return element
}

function labelled(label: string, control: HTMLElement, hint?: string) {
  const box = el('label', undefined, 'field')
  box.append(el('span', label), control)
  if (hint !== undefined) box.append(el('span', hint, 'muted small'))
  return box
}

export type FormHost = {
  /** POST with the token. Status 0 means the request never got an answer. */
  post: (path: string, body: unknown) => Promise<{ status: number; body: unknown }>
  /** The vocabulary the tag picker offers; null when it cannot be read. */
  vocabulary: () => Promise<VocabData | null>
  /** The project owners of the store, for the New memory form's owner choice ('global' is always offered). */
  owners: () => string[]
  /** The owner the New form starts with. */
  owner: () => string
  /** The save was confirmed by the server: closes the form and refreshes the lists. */
  done: (message: string, id: string) => void
  /** Cancel was pressed. */
  cancel: () => void
  /** A readable project name for an owner. */
  ownerName: (owner: string) => string
}

export type BuiltForm = { element: HTMLElement; ready: Promise<void>; focus: () => void }

/**
 * The form. `memory` is the row being edited, or undefined for a new memory. The vocabulary loads in the
 * background (`ready` settles when the tag picker is filled); everything else is usable at once.
 */
export function buildForm(host: FormHost, memory?: FormMemory): BuiltForm {
  const creating = memory === undefined
  const form = el('form', undefined, 'memory-form')
  form.setAttribute('novalidate', '')
  form.append(el('h3', creating ? 'New memory' : 'Edit memory', 'card-title'))

  const content = el('textarea', undefined, 'input memory-content')
  content.rows = 6
  content.value = memory?.content ?? memory?.preview ?? ''
  content.setAttribute('aria-label', 'Memory text')

  const kind = el('select', undefined, 'input')
  const noKind = el('option', creating ? 'Choose a kind…' : 'Not set')
  noKind.value = ''
  kind.append(noKind)
  for (const item of KINDS) {
    const option = el('option', item.label)
    option.value = item.name
    kind.append(option)
  }
  kind.value = isKind(memory?.memory_type) ? memory.memory_type : ''

  const importance = el('input', undefined, 'input')
  importance.type = 'number'
  importance.min = '0'
  importance.max = '1'
  importance.step = '0.05'
  importance.value = typeof memory?.importance === 'number' ? String(memory.importance) : '0.5'

  const expires = el('input', undefined, 'input')
  expires.type = 'number'
  expires.min = '1'
  expires.max = '365'
  expires.step = '1'
  expires.value = creating ? defaultExpiry(kind.value) : ''
  let expiresTouched = false
  const removeExpiry = el('input')
  removeExpiry.type = 'checkbox'

  // Owner: new memories only. An existing memory keeps its owner.
  const owner = el('select', undefined, 'input')
  const ownerChoices = ['global', ...host.owners().filter(name => name !== 'global')]
  for (const name of ownerChoices) {
    const option = el('option', name === 'global' ? 'Global (every project)' : host.ownerName(name))
    option.value = name
    owner.append(option)
  }
  const start = host.owner()
  owner.value = ownerChoices.includes(start) ? start : 'global'

  const pinned = el('input')
  pinned.type = 'checkbox'
  pinned.checked = memory?.metadata?.pinned === true

  // The tag picker fills in when the vocabulary arrives. Tags the memory already has stay, offered or not.
  const picker = el('div', undefined, 'tag-picker')
  picker.append(el('p', 'Loading the tags…', 'muted small'))
  const boxes = new Map<string, HTMLInputElement>()
  const own = memory === undefined ? [] : tagsOf(memory)
  const drawPicker = (vocabulary: VocabData | null) => {
    const offered = vocabulary?.tags ?? []
    const groups = groupTags(offered.map(tag => ({ tag: tag.tag, ns: tag.ns })))
    const outside = own.filter(tag => !offered.some(item => item.tag === tag))
    if (outside.length > 0) groups.push({ id: 'current', label: 'On this memory, not in the vocabulary', tags: outside.map(tag => ({ tag, ns: null })) })
    const parts: HTMLElement[] = []
    if (groups.length === 0) parts.push(el('p', vocabulary === null ? 'The tag vocabulary could not be read, so no tags are offered.' : 'There is no tag vocabulary yet. Run /mnemosyne-tags in Claude Code to make one.', 'muted small'))
    for (const group of groups) {
      const set = el('fieldset', undefined, 'tag-group')
      set.dataset.ns = group.id
      set.append(el('legend', group.label, 'small muted'))
      for (const tag of group.tags) {
        const box = el('input')
        box.type = 'checkbox'
        box.value = tag.tag
        box.checked = own.includes(tag.tag)
        boxes.set(tag.tag, box)
        const label = el('label', undefined, 'tag-choice')
        label.append(box, el('span', tag.tag, 'tag'))
        set.append(label)
        box.addEventListener('change', changed)
      }
      parts.push(set)
    }
    picker.replaceChildren(...parts)
  }

  // Messages: one status line, and the warning block (with Save anyway) or the block list (without).
  const status = el('p', undefined, 'small')
  status.setAttribute('role', 'status')
  status.hidden = true
  const notes = el('div', undefined, 'confirm')
  notes.hidden = true
  const buttons = el('div', undefined, 'buttons')
  const save = el('button', creating ? 'Save' : 'Save changes', 'btn primary')
  save.type = 'submit'
  const cancel = el('button', 'Cancel', 'btn')
  cancel.type = 'button'
  buttons.append(save, cancel)

  let warned: Record<string, unknown> | null = null
  let busy = false
  const say = (text: string, error = true) => {
    status.textContent = text
    status.className = error ? 'warn small' : 'muted small'
    status.hidden = text === ''
  }
  const clearNotes = () => {
    warned = null
    notes.hidden = true
    notes.replaceChildren()
  }
  // Any edit after a warning withdraws it: Save anyway would otherwise send text the guard has not seen.
  function changed() {
    if (warned !== null) clearNotes()
  }

  const values = (): FormValues => ({
    owner: creating ? owner.value : (memory?.owner ?? ''),
    content: content.value,
    kind: kind.value,
    tags: [...boxes.entries()].filter(([, box]) => box.checked).map(([tag]) => tag),
    importance: importance.value,
    expires: expires.value,
    removeExpiry: removeExpiry.checked,
    pinned: pinned.checked,
  })

  const send = async (body: Record<string, unknown>) => {
    busy = true
    save.disabled = true
    cancel.disabled = true
    say('Saving…', false)
    const reply = await host.post(creating ? '/api/memory/create' : '/api/memory/update', body)
    busy = false
    save.disabled = false
    cancel.disabled = false
    const answer = answerOf(reply.status, reply.body, creating)
    if (answer.kind === 'saved') {
      // Only now, with the server's word, is the save shown as done.
      host.done(answer.text, answer.id)
      return
    }
    say(answer.text)
    if (answer.kind === 'warn') {
      warned = body
      notes.replaceChildren(...answerLines(answer).map(line => el('p', line, 'warn small')))
      const again = el('button', 'Save anyway', 'btn danger')
      again.type = 'button'
      again.addEventListener('click', () => {
        if (busy || warned === null) return
        const resend = { ...warned, confirm: true }
        clearNotes()
        void send(resend)
      })
      notes.append(again)
      notes.hidden = false
    } else if (answer.kind === 'blocked') {
      // No save button: the rules are named, and the text has to change.
      warned = null
      notes.replaceChildren(...answerLines(answer).map(line => el('p', line, 'warn small')))
      notes.hidden = false
    } else {
      clearNotes()
    }
  }

  const submit = () => {
    if (busy) return
    clearNotes()
    const built = memory === undefined ? createRequest(values()) : updateRequest(memory, values())
    if ('error' in built) return say(built.error)
    say('')
    void send(built.body)
  }
  form.addEventListener('submit', event => {
    ;(event as Event | undefined)?.preventDefault?.()
    submit()
  })
  save.addEventListener('click', event => {
    ;(event as Event | undefined)?.preventDefault?.()
    submit()
  })
  cancel.addEventListener('click', () => host.cancel())
  for (const field of [content, importance, expires, removeExpiry, pinned, owner]) {
    field.addEventListener('input', changed)
    field.addEventListener('change', changed)
  }
  expires.addEventListener('input', () => {
    expiresTouched = true
  })
  kind.addEventListener('change', () => {
    changed()
    // The expiry follows the kind until it has been typed in: 14 days for project state, none for the rest.
    if (!expiresTouched && (creating || kind.value !== (memory?.memory_type ?? ''))) expires.value = defaultExpiry(kind.value)
  })

  form.append(labelled('Memory', content), labelled('Kind', kind, 'What sort of memory this is. Project state fades after 14 days unless you change the expiry.'))
  form.append(el('span', 'Tags', 'small'), picker)
  form.append(labelled('Importance (0 to 1)', importance))
  const expiry = labelled('Expires after (days)', expires, memory?.valid_until ? `Now expires ${memory.valid_until.slice(0, 10)}. Leave empty to keep that.` : 'Leave empty for no expiry.')
  form.append(expiry)
  if (!creating && memory?.valid_until) {
    const row = el('label', undefined, 'tag-choice')
    row.append(removeExpiry, el('span', 'Remove the expiry'))
    form.append(row)
  }
  if (creating) form.append(labelled('Belongs to', owner))
  else {
    const row = el('label', undefined, 'tag-choice')
    row.append(pinned, el('span', 'Pinned (never expires unused, never a review candidate)'))
    form.append(row)
  }
  form.append(status, notes, buttons)

  const ready = host.vocabulary().then(
    vocabulary => drawPicker(vocabulary),
    () => drawPicker(null),
  )
  return { element: form, ready, focus: () => content.focus() }
}
