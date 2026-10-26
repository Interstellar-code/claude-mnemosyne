// The Settings tab (0.8.5 settings plan, phase UI; the routes are ui/settings-routes.ts).
//
// The page draws from GET /api/settings only: every row, its help, default, range, home and "applies"
// badge come from the server's reply, so a setting the server adds later (an option the CLI's schema
// gains) shows up with no change here. The one local group is "This browser" (theme, search mode),
// which the page keeps in this browser's own storage (ui/app.ts).
//
// A value is shown as the current one only after the server confirmed it: Save and Reset send the
// request, and the row takes the value from the reply (or shows the refusal and keeps the old value).
// The functions are pure except the `draw*` builders, which make elements with createElement and
// textContent only (no HTML is ever parsed from data; the CSP refuses inline styles and scripts).
// ui/app.ts fetches the reply and passes in a SettingsHost for the network, the clipboard and the browser.
import { bytes } from './health'

export type Group = { id: string; label: string }

export type SettingRow = {
  id: string
  ref: string
  group: string
  label: string
  help: string
  type: string
  home: string
  applies: string
  default: unknown
  value: unknown
  configured?: boolean
  isDefault?: boolean
  advanced?: boolean
  min?: number
  max?: number
  choices?: string[]
  confirm?: boolean
  note?: string
  restartNeeded?: boolean
  maxItems?: number
  minItemLength?: number
  maxItemLength?: number
  action?: string
  keep?: number
}

export type SettingsData = {
  plugin: { id: string | null; optionsEditable: boolean; note: string; reason: string }
  groups: Group[]
  settings: SettingRow[]
  warnings: string[]
  restartNeeded: string[]
}

/** What the page gives the tab: the token-carrying POST, the clipboard, and this browser's preferences. */
export type SettingsHost = {
  /** POST with the token. Status 0 means the request never got an answer (the body then holds `error`). */
  post: (path: string, body: unknown) => Promise<{ status: number; body: unknown }>
  /** Copies text to the clipboard; false when the browser refused. */
  copy: (text: string) => Promise<boolean>
  /** Reads the settings again and redraws (after Reset all and Back up now). */
  reload: () => void
  /** The "This browser" rows: each returns its value and takes a new one. */
  browser: BrowserPrefs
}

export type BrowserPref = { label: string; help: string; choices: { value: string; label: string; disabled?: boolean; title?: string }[]; get: () => string; set: (value: string) => void }
export type BrowserPrefs = BrowserPref[]

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// ---- Reading the reply ----

const optionalNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

function parseRow(raw: unknown): SettingRow | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || raw.id === '') return null
  const choices = Array.isArray(raw.choices) ? raw.choices.filter((item): item is string => typeof item === 'string') : undefined
  const row: SettingRow = {
    id: raw.id,
    ref: text(raw.ref),
    group: text(raw.group, 'other'),
    label: text(raw.label, raw.id),
    help: text(raw.help),
    type: text(raw.type, 'text'),
    home: text(raw.home, 'read-only'),
    applies: text(raw.applies),
    default: raw.default ?? null,
    value: raw.value ?? null,
  }
  if (typeof raw.configured === 'boolean') row.configured = raw.configured
  if (typeof raw.isDefault === 'boolean') row.isDefault = raw.isDefault
  if (raw.advanced === true) row.advanced = true
  if (raw.confirm === true) row.confirm = true
  if (raw.restartNeeded === true) row.restartNeeded = true
  if (typeof raw.note === 'string' && raw.note !== '') row.note = raw.note
  if (typeof raw.action === 'string') row.action = raw.action
  const numbers = { min: optionalNumber(raw.min), max: optionalNumber(raw.max), maxItems: optionalNumber(raw.maxItems), minItemLength: optionalNumber(raw.minItemLength), maxItemLength: optionalNumber(raw.maxItemLength), keep: optionalNumber(raw.keep) }
  for (const [key, value] of Object.entries(numbers)) if (value !== undefined) (row as Record<string, unknown>)[key] = value
  if (choices !== undefined && choices.length > 0) row.choices = choices
  return row
}

/** A GET /api/settings reply made safe to use; null when it is not a settings reply. */
export function parseSettings(body: unknown): SettingsData | null {
  if (!isObject(body) || !Array.isArray(body.settings)) return null
  const plugin = isObject(body.plugin) ? body.plugin : {}
  const groups: Group[] = (Array.isArray(body.groups) ? body.groups : []).flatMap(group => (isObject(group) && typeof group.id === 'string' ? [{ id: group.id, label: text(group.label, group.id) }] : []))
  const warnings = (Array.isArray(body.warnings) ? body.warnings : []).flatMap(item => {
    if (typeof item === 'string') return [item]
    if (isObject(item) && typeof item.key === 'string') return [`${item.key}: ${text(item.reason, 'a problem')}`]
    return []
  })
  return {
    plugin: { id: typeof plugin.id === 'string' ? plugin.id : null, optionsEditable: plugin.optionsEditable === true, note: text(plugin.note), reason: text(plugin.reason) },
    groups,
    settings: body.settings.map(parseRow).filter((row): row is SettingRow => row !== null),
    warnings,
    restartNeeded: (Array.isArray(body.restartNeeded) ? body.restartNeeded : []).filter((id): id is string => typeof id === 'string'),
  }
}

// ---- Words ----

/** A value in plain words: on/off, a list joined, "none" for an empty list, "not set" for no value. */
export function formatValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  if (value === null || value === undefined) return 'not set'
  if (Array.isArray(value)) return value.length === 0 ? 'none' : value.map(String).join(', ')
  if (typeof value === 'string') return value === '' ? '(empty)' : value
  if (isObject(value)) return JSON.stringify(value)
  return String(value)
}

/** The badge words for a server "applies" value ("now", "next session", "after restart"). */
export const appliesText = (applies: string) => (applies === '' ? '' : `Applies ${applies}`)

const HOMES: Record<string, string> = { config: 'Mnemosyne config', option: 'Plugin option', 'read-only': 'Read-only' }
export const homeText = (home: string) => HOMES[home] ?? home

/** The range in words, for the hint under a number field. */
export function rangeText(row: SettingRow): string {
  if (row.min !== undefined && row.max !== undefined) return `${row.min} to ${row.max}`
  if (row.min !== undefined) return `${row.min} or more`
  if (row.max !== undefined) return `${row.max} or less`
  return ''
}

/** Rows a person can change: not read-only, not a facts row. */
export const isEditable = (row: SettingRow) => row.home !== 'read-only' && row.type !== 'facts'

/** The rows matching the filter box (name, help, id, group label), case ignored; an empty filter keeps all. */
export function filterRows(rows: readonly SettingRow[], groups: readonly Group[], filter: string): SettingRow[] {
  const needle = filter.trim().toLowerCase()
  if (needle === '') return [...rows]
  const label = (id: string) => groups.find(group => group.id === id)?.label ?? id
  return rows.filter(row => [row.label, row.help, row.id, row.note ?? '', label(row.group)].some(part => part.toLowerCase().includes(needle)))
}

// ---- Checking a value before it is sent ----

export type Checked = { ok: true; value: unknown } | { ok: false; reason: string }

const CONTROL = /[\p{Cc}\u2028\u2029]/u

/** The value the field holds, checked against the row's type and range. The server checks again; this only saves the trip. */
export function checkValue(row: SettingRow, raw: string): Checked {
  if (row.type === 'integer' || row.type === 'number') {
    const trimmed = raw.trim()
    const number = trimmed === '' ? Number.NaN : Number(trimmed)
    const range = rangeText(row)
    if (!Number.isFinite(number)) return { ok: false, reason: `Enter a number${range ? ` from ${range}` : ''}.` }
    if (row.type === 'integer' && !Number.isInteger(number)) return { ok: false, reason: `Enter a whole number${range ? ` from ${range}` : ''}.` }
    if ((row.min !== undefined && number < row.min) || (row.max !== undefined && number > row.max)) return { ok: false, reason: `Enter a number from ${range}.` }
    return { ok: true, value: number }
  }
  if (row.type === 'choice') {
    return row.choices === undefined || row.choices.includes(raw) ? { ok: true, value: raw } : { ok: false, reason: `Pick one of ${row.choices.join(', ')}.` }
  }
  const value = raw.trim()
  if (CONTROL.test(value)) return { ok: false, reason: 'Use one line of plain text.' }
  if (Array.from(value).length > 1000) return { ok: false, reason: 'Use at most 1000 characters.' }
  return { ok: true, value }
}

/** One list item, checked against the row's length limits (a words list) and its choices (a pick list). */
export function checkItem(row: SettingRow, raw: string, current: readonly string[]): Checked {
  const item = raw.trim()
  if (item === '') return { ok: false, reason: 'Type a word or phrase first.' }
  if (CONTROL.test(item)) return { ok: false, reason: 'Use one line of plain text.' }
  if (row.choices !== undefined) {
    if (!row.choices.includes(item)) return { ok: false, reason: `Pick one of ${row.choices.join(', ')}.` }
  } else {
    const length = Array.from(item).length
    if (row.minItemLength !== undefined && length < row.minItemLength) return { ok: false, reason: `Use at least ${row.minItemLength} characters.` }
    if (row.maxItemLength !== undefined && length > row.maxItemLength) return { ok: false, reason: `Use at most ${row.maxItemLength} characters.` }
  }
  if (row.type === 'terms' && item.includes(',')) return { ok: false, reason: 'No commas inside one entry.' }
  if (current.some(seen => seen.toLowerCase() === item.toLowerCase())) return { ok: false, reason: 'That one is already in the list.' }
  if (row.maxItems !== undefined && current.length >= row.maxItems) return { ok: false, reason: `The list holds at most ${row.maxItems} entries.` }
  return { ok: true, value: item }
}

/** The line shown when the server accepted a change: "Saved. Applies next session." (the server's own words for when). */
export function savedText(reply: Record<string, unknown>, reset = false): string {
  const applies = text(reply.applies)
  const base = reply.changed === false ? 'Nothing changed.' : reset ? 'Back at the default.' : 'Saved.'
  return `${base}${applies ? ` ${appliesText(applies)}.` : ''}`
}

/** A refusal or failure as one line for the row. */
export function failureText(status: number, body: unknown): string {
  const error = isObject(body) && typeof body.error === 'string' ? body.error : ''
  if (status === 0) return error || 'The server did not answer.'
  return error || `The server answered ${status}.`
}

// ---- Elements: createElement and textContent only ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, content?: string, className?: string) {
  const element = document.createElement(tag)
  if (content !== undefined) element.textContent = content
  if (className) element.className = className
  return element
}

function button(label: string, className: string, onClick: () => void, title?: string) {
  const element = el('button', label, `btn ${className}`.trim())
  element.type = 'button'
  if (title) element.title = title
  element.addEventListener('click', onClick)
  return element
}

let fieldCount = 0
const nextId = (prefix: string) => `${prefix}-${++fieldCount}`

/** A labelled input: the label text, the control and an optional hint, wired by id. */
function labelled(label: string, control: HTMLElement, hint?: string) {
  const id = nextId('set-f')
  control.id = id
  const wrap = el('div', undefined, 'set-field')
  const name = el('label', label, 'set-label')
  name.htmlFor = id
  wrap.append(name, control)
  if (hint) wrap.append(el('span', hint, 'muted small'))
  return wrap
}

/** The shared state of one drawn tab: the data, the filter, one write at a time, the last banner notice. */
export type SettingsView = {
  data: SettingsData | null
  filter: string
  busy: boolean
  /** A line under the banner after Reset all or Back up now (kept across the reload). */
  notice: string
  /** The command text last copied, to flag its button. */
  copied: string
  /** Setup card extras: the last backup answer and the live backup list. */
  backup: { text: string; error: boolean; list: { name: string; size: number; date: string }[] | null }
  resetAll: boolean
  /** The drawn banner, so a reply that changes the restart list can redraw it alone. */
  banner: { node: HTMLElement; data: SettingsData; view: SettingsView } | null
}

export const newView = (): SettingsView => ({ data: null, filter: '', busy: false, notice: '', copied: '', backup: { text: '', error: false, list: null }, resetAll: false, banner: null })

const BUSY_TEXT = 'Another change is still saving. Try again in a moment.'

// One row: the head (name, badges), the help, the current value and default, then the editor or the facts.
type RowParts = { box: HTMLElement; message: HTMLElement; current: HTMLElement; badges: HTMLElement }

function say(parts: RowParts, line: string, error = false) {
  parts.message.textContent = line
  parts.message.className = error ? 'set-msg warn' : 'set-msg small muted'
  parts.message.hidden = line === ''
}

function showCurrent(row: SettingRow, parts: RowParts) {
  const isDefault = row.type === 'facts' ? false : sameJson(row.value, row.default) && row.configured !== true
  parts.current.textContent = `Current: ${formatValue(row.value)}${isDefault ? ' (default)' : ''}  ·  Default: ${formatValue(row.default)}`
  parts.badges.replaceChildren(...badgeList(row))
}

function badgeList(row: SettingRow): HTMLElement[] {
  const out = [el('span', homeText(row.home), 'mini-badge')]
  const applies = appliesText(row.applies)
  if (applies !== '' && row.home !== 'read-only') out.push(el('span', applies, 'mini-badge set-applies'))
  if (row.restartNeeded === true) out.push(el('span', 'Restart needed', 'mini-badge set-restart'))
  if (row.advanced === true) out.push(el('span', 'Advanced', 'mini-badge'))
  return out
}

/** A confirmed change: the row takes the value from the server's reply, never from the field. */
function takeReply(row: SettingRow, reply: Record<string, unknown>, parts: RowParts, view: SettingsView) {
  if ('value' in reply) row.value = reply.value
  if ('default' in reply) row.default = reply.default
  if (typeof reply.applies === 'string') row.applies = reply.applies
  // The server says again on every reply whether this row needs a restart: a later save can clear it.
  if (row.restartNeeded !== (reply.restartNeeded === true)) {
    if (reply.restartNeeded === true) row.restartNeeded = true
    else delete row.restartNeeded
  }
  const live = view.banner?.data
  if (live !== undefined) {
    const listed = live.restartNeeded.includes(row.id)
    if (reply.restartNeeded === true && !listed) live.restartNeeded = [...live.restartNeeded, row.id]
    else if (reply.restartNeeded !== true && listed) live.restartNeeded = live.restartNeeded.filter(id => id !== row.id)
    if (view.banner !== null) fillBanner(view.banner.node, live, view)
  }
  // An option keeps a stored value once saved (even at the default) until it is reset; a config row is "default" when its value matches.
  if (row.home === 'option') row.configured = reply.reset !== true
  showCurrent(row, parts)
}

async function send(view: SettingsView, host: SettingsHost, parts: RowParts, path: string, body: unknown, work: string) {
  if (view.busy) {
    say(parts, BUSY_TEXT, true)
    return null
  }
  view.busy = true
  say(parts, work)
  try {
    const reply = await host.post(path, body)
    if (reply.status >= 200 && reply.status < 300 && isObject(reply.body) && reply.body.ok === true) return reply.body
    say(parts, failureText(reply.status, reply.body), true)
    return null
  } catch (err) {
    say(parts, `The request failed: ${err instanceof Error ? err.message : String(err)}`, true)
    return null
  } finally {
    view.busy = false
  }
}

function doneText(reply: Record<string, unknown>, reset = false) {
  const extra = [text(reply.note), text(reply.warning)].filter(part => part !== '').join(' ')
  return `${savedText(reply, reset)}${extra ? ` ${extra}` : ''}`
}

function done(parts: RowParts, reply: Record<string, unknown>, reset = false) {
  say(parts, doneText(reply, reset))
}

/** The editor for one row: [editor elements], each with its own Save. Returns the elements to place under the value. */
function editorFor(row: SettingRow, view: SettingsView, host: SettingsHost, parts: RowParts): HTMLElement[] {
  const update = (body: Record<string, unknown>) => send(view, host, parts, '/api/settings/update', { id: row.id, ...body }, 'Saving…')

  if (row.type === 'boolean') {
    const box = el('input')
    box.type = 'checkbox'
    box.setAttribute('role', 'switch')
    box.checked = row.value === true
    const wrap = labelled('On', box)
    const save = button('Save', 'primary', () => {
      void (async () => {
        const reply = await update({ value: box.checked })
        if (reply === null) return
        takeReply(row, reply, parts, view)
        box.checked = row.value === true
        done(parts, reply)
      })()
    })
    return [fieldLine(wrap, save)]
  }

  if (row.type === 'choice') {
    const select = el('select', undefined, 'input')
    for (const choice of row.choices ?? []) {
      const option = el('option', choice)
      option.value = choice
      select.append(option)
    }
    select.value = text(row.value)
    const again = row.confirm === true ? el('input', undefined, 'input') : null
    let againField: HTMLElement | null = null
    if (again !== null) {
      again.type = 'text'
      againField = labelled('Type the new value again to confirm', again, 'Memories already saved are not moved to the new place.')
    }
    const save = button('Save', 'primary', () => {
      const checked = checkValue(row, select.value)
      if (!checked.ok) return say(parts, checked.reason, true)
      if (again !== null && again.value.trim() !== String(checked.value)) return say(parts, 'The two entries differ. Type the new value again exactly to confirm.', true)
      void (async () => {
        const reply = await update({ value: checked.value, ...(again !== null ? { confirm: again.value.trim() } : {}) })
        if (reply === null) return
        takeReply(row, reply, parts, view)
        select.value = text(row.value)
        if (again !== null) again.value = ''
        done(parts, reply)
      })()
    })
    return againField === null ? [fieldLine(labelled('New value', select), save)] : [fieldLine(labelled('New value', select), save), againField]
  }

  if (row.type === 'integer' || row.type === 'number' || row.type === 'text') {
    const input = el('input', undefined, 'input')
    input.type = 'text'
    if (row.type !== 'text') input.inputMode = row.type === 'integer' ? 'numeric' : 'decimal'
    input.value = formatValue(row.value) === 'not set' ? '' : String(row.value ?? '')
    const range = row.type === 'text' ? '' : rangeText(row)
    const field = labelled('New value', input, range ? `Allowed: ${range}` : undefined)
    const again = row.confirm === true ? el('input', undefined, 'input') : null
    let againField: HTMLElement | null = null
    if (again !== null) {
      again.type = 'text'
      againField = labelled('Type the new value again to confirm', again, 'Memories already saved are not moved to the new place.')
    }
    const save = button('Save', 'primary', () => {
      const checked = checkValue(row, input.value)
      if (!checked.ok) return say(parts, checked.reason, true)
      if (again !== null && again.value.trim() !== String(checked.value)) return say(parts, 'The two entries differ. Type the new value again exactly to confirm.', true)
      void (async () => {
        const reply = await update({ value: checked.value, ...(again !== null ? { confirm: again.value.trim() } : {}) })
        if (reply === null) return
        takeReply(row, reply, parts, view)
        input.value = row.value === null ? '' : String(row.value)
        if (again !== null) again.value = ''
        done(parts, reply)
      })()
    })
    return againField === null ? [fieldLine(field, save)] : [fieldLine(field, save), againField]
  }

  if (row.type === 'words' || row.type === 'terms' || row.type === 'pick') {
    const list = el('ul', undefined, 'set-items')
    const draw = () => {
      const items = Array.isArray(row.value) ? row.value.map(String) : []
      list.replaceChildren(
        ...(items.length === 0
          ? [el('li', 'No entries.', 'muted small')]
          : items.map(item => {
              const li = el('li', undefined, 'set-item')
              li.append(el('span', item, 'tag'), button('Remove', 'small', () => {
                void (async () => {
                  const reply = await update({ remove: item })
                  if (reply === null) return
                  takeReply(row, reply, parts, view)
                  draw()
                  refill()
                  done(parts, reply)
                })()
              }, `Remove ${item}`))
              return li
            })),
      )
    }
    draw()
    const current = () => (Array.isArray(row.value) ? row.value.map(String) : [])
    let control: HTMLElement
    let read: () => string
    let clear = () => {}
    let refill = () => {}
    if (row.choices !== undefined) {
      const select = el('select', undefined, 'input')
      const fill = () => {
        select.replaceChildren(...(row.choices ?? []).filter(choice => !current().includes(choice)).map(choice => Object.assign(el('option', choice), { value: choice })))
      }
      fill()
      control = select
      read = () => select.value
      // The add list shows only what is not in the list yet.
      refill = fill
    } else {
      const input = el('input', undefined, 'input')
      input.type = 'text'
      control = input
      read = () => input.value
      clear = () => {
        input.value = ''
      }
    }
    const add = button('Add', 'primary', () => {
      const checked = checkItem(row, read(), current())
      if (!checked.ok) return say(parts, checked.reason, true)
      void (async () => {
        const reply = await update({ add: checked.value })
        if (reply === null) return
        takeReply(row, reply, parts, view)
        clear()
        draw()
        refill()
        done(parts, reply)
      })()
    })
    const limits = row.type === 'words' && row.maxItems !== undefined ? `Up to ${row.maxItems} entries, ${row.minItemLength ?? 1} to ${row.maxItemLength ?? 80} characters each. Plain words, no patterns.` : undefined
    return [list, fieldLine(labelled(row.choices !== undefined ? 'Add from the list' : 'Add an entry', control, limits), add)]
  }

  // An unknown type has no editor: it is shown, not changed.
  return []
}

/** One field and its button side by side. */
function fieldLine(field: HTMLElement, action: HTMLElement) {
  const line = el('div', undefined, 'set-edit')
  line.append(field, action)
  return line
}

// ---- Read-only facts ----

/** A facts value as lines: a list of text as one line, an object as "name: value" lines, text as is. */
export function factLines(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) return [`${prefix}${value.length === 0 ? 'none' : value.map(String).join(', ')}`]
  if (isObject(value)) return Object.entries(value).flatMap(([key, inner]) => (isObject(inner) ? factLines(inner, `${prefix}${key} · `) : [`${prefix}${key}: ${formatValue(inner)}`]))
  return [`${prefix}${formatValue(value)}`]
}

function drawFacts(row: SettingRow): HTMLElement {
  const box = el('div', undefined, 'set-facts')
  if (row.value === null || row.value === undefined) return box
  for (const line of factLines(row.value)) box.append(el('p', line, 'set-fact small'))
  return box
}

// ---- A row ----

export function settingRow(row: SettingRow, view: SettingsView, host: SettingsHost, message = ''): HTMLElement {
  const box = el('div', undefined, 'set-row')
  box.dataset.id = row.id
  const parts: RowParts = { box, message: el('p', '', 'set-msg small muted'), current: el('p', undefined, 'set-current small'), badges: el('span', undefined, 'set-badges') }
  say(parts, message)
  const head = el('div', undefined, 'set-head')
  head.append(el('h3', row.label, 'set-name'), parts.badges)
  box.append(head)
  if (row.help !== '') box.append(el('p', row.help, 'set-help small muted'))
  if (row.note !== undefined) box.append(el('p', row.note, 'set-note small'))
  if (row.type !== 'facts') {
    showCurrent(row, parts)
    box.append(parts.current)
  } else {
    parts.badges.replaceChildren(...badgeList(row))
  }
  if (isEditable(row)) {
    box.append(...editorFor(row, view, host, parts))
    // Reset to default: asks the server; the row changes only on its reply, then is drawn again so the editors hold the new value.
    // memoryDir and scope: the server wants the default typed again as confirm.
    const sure = row.confirm === true ? el('input', undefined, 'input') : null
    if (sure !== null) {
      sure.type = 'text'
      box.append(labelled('Type the default again to reset', sure, `The default is ${formatValue(row.default)}. Memories already saved are not moved.`))
    }
    box.append(
      button('Reset to default', 'link-btn', () => {
        const want = String(row.default ?? '')
        if (sure !== null && sure.value.trim() !== want) return say(parts, 'The entry differs from the default. Type the default exactly to confirm.', true)
        void (async () => {
          const reply = await send(view, host, parts, '/api/settings/reset', sure !== null ? { id: row.id, confirm: sure.value.trim() } : { id: row.id }, 'Resetting…')
          if (reply === null) return
          takeReply(row, { ...reply, reset: true }, parts, view)
          box.replaceWith(settingRow(row, view, host, doneText(reply, true)))
        })()
      }),
    )
  } else if (row.type === 'facts') {
    box.append(drawFacts(row))
  }
  box.append(parts.message)
  return box
}

// ---- Groups and the banner ----

export const BROWSER_GROUP: Group = { id: 'browser', label: 'This browser' }

/** The banner lines: config warnings, the restart note and the plugin-options note. */
export function bannerLines(data: SettingsData, view: SettingsView): string[] {
  const lines: string[] = []
  if (!data.plugin.optionsEditable) lines.push(data.plugin.note || 'Plugin options are read-only here: change them in /config.')
  if (data.restartNeeded.length > 0) {
    const names = data.restartNeeded.map(id => data.settings.find(row => row.id === id)?.label ?? id)
    lines.push(`Restart needed for: ${names.join(', ')}. The dashboard still runs with the old value until Claude Code restarts.`)
  }
  for (const warning of data.warnings) lines.push(`Warning: ${warning}`)
  if (view.notice !== '') lines.push(view.notice)
  return lines
}

function drawBrowserRows(host: SettingsHost): HTMLElement[] {
  return host.browser.map(pref => {
    const box = el('div', undefined, 'set-row')
    const head = el('div', undefined, 'set-head')
    head.append(el('h3', pref.label, 'set-name'), el('span', 'This browser', 'mini-badge'))
    box.append(head, el('p', pref.help, 'set-help small muted'))
    const group = el('div', undefined, 'segmented')
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', pref.label)
    const buttons: HTMLButtonElement[] = []
    const paint = () => {
      for (const [index, choice] of pref.choices.entries()) buttons[index]!.setAttribute('aria-pressed', String(choice.value === pref.get()))
    }
    for (const choice of pref.choices) {
      const pick = el('button', choice.label, 'seg-btn')
      pick.type = 'button'
      if (choice.disabled === true) pick.disabled = true
      if (choice.title) pick.title = choice.title
      pick.addEventListener('click', () => {
        if (choice.disabled === true) return
        pref.set(choice.value)
        paint()
      })
      buttons.push(pick)
      group.append(pick)
    }
    paint()
    box.append(group)
    return box
  })
}

// ---- Setup and backups (UI.3) ----

export const SETUP_COMMANDS: readonly { command: string; what: string }[] = [
  { command: '/mnemosyne-setup', what: 'Installs or repairs the engine, the model and the wrapper.' },
  { command: '/mnemosyne-embed', what: 'Turns on meaning search and builds the vectors.' },
  { command: '/mnemosyne-tags', what: 'Reviews and tidies the tag vocabulary.' },
  { command: '/mnemosyne-knowledge', what: 'Extracts facts and preferences from memories.' },
]

type SetupFacts = {
  engine?: { installed?: boolean; build?: string | null; expected?: string; current?: boolean }
  embeddings?: { marker?: boolean; modelFiles?: number; modelFilesExpected?: number; modelReady?: boolean }
  wrapper?: boolean
  bun?: string
}

/** The setup status as short lines: what is installed and what is missing. */
export function setupLines(value: unknown): string[] {
  if (!isObject(value)) return []
  const facts = value as SetupFacts
  const lines: string[] = []
  const engine = facts.engine
  if (engine !== undefined) {
    lines.push(engine.installed !== true ? 'Engine: not installed.' : engine.current === true ? `Engine: installed, build ${text(engine.build)} (current).` : `Engine: installed, build ${text(engine.build, 'unknown')}; this plugin expects ${text(engine.expected, 'a newer one')}.`)
  }
  const embeddings = facts.embeddings
  if (embeddings !== undefined) {
    lines.push(`Model files: ${embeddings.modelFiles ?? 0} of ${embeddings.modelFilesExpected ?? 0} present${embeddings.modelReady === true ? ' (ready)' : ''}.`)
    lines.push(`Embeddings marker: ${embeddings.marker === true ? 'present' : 'absent'}.`)
  }
  if (typeof facts.wrapper === 'boolean') lines.push(`MCP wrapper for outside agents: ${facts.wrapper ? 'present' : 'missing'}.`)
  if (typeof facts.bun === 'string') lines.push(`Bun ${facts.bun}.`)
  return lines
}

export type BackupInfo = { name: string; size: number; date: string }

export function parseBackups(value: unknown): BackupInfo[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => (isObject(item) && typeof item.name === 'string' ? [{ name: item.name, size: optionalNumber(item.size) ?? 0, date: text(item.date) }] : []))
}

/** An ISO date as "2026-10-25 14:03" (UTC); anything else as is. */
export function dateText(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : iso
}

function drawSetup(rows: readonly SettingRow[], view: SettingsView, host: SettingsHost): HTMLElement[] {
  const out: HTMLElement[] = []
  const status = rows.find(row => row.id === 'setup.status')
  const backups = rows.find(row => row.id === 'setup.backups')
  const rest = rows.filter(row => row !== status && row !== backups)
  if (status !== undefined) {
    const card = el('div', undefined, 'set-row')
    const head = el('div', undefined, 'set-head')
    head.append(el('h3', status.label, 'set-name'), el('span', 'Read-only', 'mini-badge'))
    card.append(head)
    if (status.help) card.append(el('p', status.help, 'set-help small muted'))
    const lines = setupLines(status.value)
    for (const line of lines.length > 0 ? lines : ['No setup status was reported.']) card.append(el('p', line, 'set-fact small'))
    card.append(el('p', 'These buttons copy a command. Paste it into Claude Code to run it; this page never runs setup or rebuilds vectors.', 'set-help small muted'))
    const list = el('ul', undefined, 'set-cmds')
    for (const item of SETUP_COMMANDS) {
      const li = el('li', undefined, 'set-cmd')
      const copy = button(view.copied === item.command ? 'Copied' : 'Copy', 'small', () => {
        void (async () => {
          const ok = await host.copy(item.command)
          copy.textContent = ok ? 'Copied' : 'Copy failed: select the command and copy it'
          view.copied = ok ? item.command : ''
        })()
      }, `Copy ${item.command}`)
      li.append(el('code', item.command, 'mono'), el('span', item.what, 'muted small'), copy)
      list.append(li)
    }
    card.append(list)
    out.push(card)
  }
  if (backups !== undefined) {
    const card = el('div', undefined, 'set-row')
    const head = el('div', undefined, 'set-head')
    head.append(el('h3', backups.label, 'set-name'), el('span', 'Action', 'mini-badge'))
    card.append(head)
    if (backups.help) card.append(el('p', backups.help, 'set-help small muted'))
    const note = el('p', view.backup.text, view.backup.error ? 'set-msg warn' : 'set-msg small muted')
    note.hidden = view.backup.text === ''
    const list = el('ul', undefined, 'set-backups')
    const drawList = () => {
      const shown = view.backup.list ?? parseBackups(backups.value)
      list.replaceChildren(...(shown.length === 0 ? [el('li', 'No backups yet.', 'muted small')] : shown.map(item => {
        const li = el('li', undefined, 'set-backup')
        li.append(el('code', item.name, 'mono'), el('span', `${bytes(item.size)} · ${dateText(item.date)}`, 'muted small'))
        return li
      })))
    }
    drawList()
    const keep = backups.keep !== undefined ? el('p', `The newest ${backups.keep} are kept.`, 'muted small') : null
    const now = button('Back up now', 'primary', () => {
      if (view.busy) {
        note.textContent = BUSY_TEXT
        note.className = 'set-msg warn'
        note.hidden = false
        return
      }
      view.busy = true
      now.disabled = true
      note.textContent = 'Backing up…'
      note.className = 'set-msg small muted'
      note.hidden = false
      void (async () => {
        try {
          const reply = await host.post('/api/backup', {})
          if (reply.status >= 200 && reply.status < 300 && isObject(reply.body) && reply.body.ok === true) {
            view.backup = { text: `Backed up as ${text(reply.body.name)} (${bytes(optionalNumber(reply.body.size) ?? 0)}).`, error: false, list: parseBackups(reply.body.backups) }
          } else {
            view.backup = { text: failureText(reply.status, reply.body), error: true, list: view.backup.list }
          }
        } catch (err) {
          view.backup = { text: `The request failed: ${err instanceof Error ? err.message : String(err)}`, error: true, list: view.backup.list }
        } finally {
          view.busy = false
          now.disabled = false
        }
        note.textContent = view.backup.text
        note.className = view.backup.error ? 'set-msg warn' : 'set-msg small muted'
        note.hidden = false
        drawList()
      })()
    })
    card.append(now, ...(keep ? [keep] : []), note, list)
    out.push(card)
  }
  for (const row of rest) out.push(settingRow(row, view, host))
  return out
}

// ---- The whole tab ----

/** Everything under the page title: the banner, Reset all, the groups. The filter box redraws only this. */
export function drawGroups(data: SettingsData, view: SettingsView, host: SettingsHost): HTMLElement[] {
  const out: HTMLElement[] = []
  const rows = filterRows(data.settings, data.groups, view.filter)
  const matching = view.filter.trim() !== ''
  for (const group of data.groups) {
    const inGroup = rows.filter(row => row.group === group.id)
    if (inGroup.length === 0) continue
    const card = el('section', undefined, 'card set-group')
    card.setAttribute('aria-label', group.label)
    card.append(el('h2', group.label, 'card-title'))
    if (group.id === 'setup') {
      card.append(...drawSetup(inGroup, view, host))
    } else {
      const plain = inGroup.filter(row => row.advanced !== true)
      const advanced = inGroup.filter(row => row.advanced === true)
      for (const row of plain) card.append(settingRow(row, view, host))
      if (advanced.length > 0) {
        const details = el('details', undefined, 'set-advanced')
        details.open = matching
        details.append(el('summary', `Advanced (${advanced.length})`, 'set-adv-summary'))
        for (const row of advanced) details.append(settingRow(row, view, host))
        card.append(details)
      }
    }
    out.push(card)
  }
  // Rows of a group the server did not name still show, under their own heading.
  const known = new Set(data.groups.map(group => group.id))
  const stray = rows.filter(row => !known.has(row.group))
  if (stray.length > 0) {
    const card = el('section', undefined, 'card set-group')
    card.append(el('h2', 'Other', 'card-title'), ...stray.map(row => settingRow(row, view, host)))
    out.push(card)
  }
  if (!matching && host.browser.length > 0) {
    const card = el('section', undefined, 'card set-group')
    card.setAttribute('aria-label', BROWSER_GROUP.label)
    card.append(el('h2', BROWSER_GROUP.label, 'card-title'), ...drawBrowserRows(host))
    out.push(card)
  }
  if (out.length === 0) out.push(el('p', matching ? 'No setting matches that filter.' : 'The server listed no settings.', 'muted small'))
  return out
}

/** The banner lines drawn into the banner box; the box is hidden when there are none. */
function fillBanner(banner: HTMLElement, data: SettingsData, view: SettingsView) {
  const lines = bannerLines(data, view)
  banner.replaceChildren(...lines.map(line => el('p', line, 'small')))
  banner.hidden = lines.length === 0
}

/** The banner and the Reset all control, above the groups. */
export function drawTop(data: SettingsData, view: SettingsView, host: SettingsHost, redraw: () => void): HTMLElement[] {
  const out: HTMLElement[] = []
  const banner = el('div', undefined, 'set-banner')
  banner.setAttribute('role', 'status')
  view.banner = { node: banner, data, view }
  fillBanner(banner, data, view)
  out.push(banner)
  const all = el('div', undefined, 'set-resetall')
  if (!view.resetAll) {
    all.append(button('Reset all', 'danger-outline', () => {
      view.resetAll = true
      redraw()
    }))
  } else {
    const input = el('input', undefined, 'input')
    input.type = 'text'
    const status = el('p', 'This puts every Mnemosyne setting in config.json back at its default (the old file is kept as config.json.bak). Plugin options are not changed.', 'small muted')
    const fail = el('p', '', 'set-msg warn')
    fail.hidden = true
    const go = button('Reset all settings', 'danger', () => {
      if (input.value.trim() !== 'reset') {
        fail.textContent = 'Type reset to confirm.'
        fail.hidden = false
        return
      }
      if (view.busy) {
        fail.textContent = BUSY_TEXT
        fail.hidden = false
        return
      }
      view.busy = true
      go.disabled = true
      void (async () => {
        try {
          const reply = await host.post('/api/settings/reset', { all: true, confirm: 'reset' })
          if (reply.status >= 200 && reply.status < 300 && isObject(reply.body) && reply.body.ok === true) {
            view.notice = text(reply.body.note, 'Every Mnemosyne setting is back at its default.')
            view.resetAll = false
            view.busy = false
            host.reload()
            return
          }
          fail.textContent = failureText(reply.status, reply.body)
        } catch (err) {
          fail.textContent = `The request failed: ${err instanceof Error ? err.message : String(err)}`
        }
        fail.hidden = false
        view.busy = false
        go.disabled = false
      })()
    })
    const cancel = button('Cancel', '', () => {
      view.resetAll = false
      redraw()
    })
    const buttons = el('div', undefined, 'buttons')
    buttons.append(go, cancel)
    all.append(status, labelled('Type reset to confirm', input), buttons, fail)
  }
  out.push(all)
  return out
}
