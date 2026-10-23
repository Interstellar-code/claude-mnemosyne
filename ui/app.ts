// The Mnemosyne dashboard page. Built by ui/server.ts with Bun.build at server
// start and served as /app.js.
//
// The link from /mnemosyne-ui carries the token in the URL fragment
// (#token=...), which no request sends. The page takes it from there, removes
// it from the address bar with history.replaceState, and keeps it in this
// tab's sessionStorage for reloads. Every /api call sends it as an
// Authorization header, never in a URL. The activity feed reads its stream
// with fetch and a ReadableStream, so it can send that header too.
//
// Every element is built with createElement and textContent: no HTML is ever
// parsed from data (tests/bun/inert.spec.ts checks this file on every run).
// Styles live in style.css: the CSP refuses inline ones.

const TOKEN_KEY = 'mnemosyne.token'
const VIEWS = ['map', 'memories', 'activity', 'search'] as const
type View = (typeof VIEWS)[number]
const VIEW_NAMES: Record<View, string> = { map: 'Map', memories: 'Memories', activity: 'Activity', search: 'Search' }
const FEED_KEEP = 1000
const FEED_SHOW = 300
const OWNER_COLOURS = 8

type Owner = { owner: string; count: number }

type Health = {
  ok: boolean
  pid: number
  store: string
  engine: string | null
  activity: boolean
  total: number
  owners: Owner[]
  note?: string
}

export type Memory = {
  id: string
  owner: string
  preview?: string
  content?: string
  truncated?: boolean
  importance: number | null
  recall_count: number
  last_recalled: string | null
  timestamp: string | null
  scope: string | null
  source?: string | null
  metadata: Record<string, unknown> | null
}

export type Hit = Memory & { content: string; score: number }

export type ActivityLine = {
  t?: string
  action?: string
  origin?: string
  owner?: string
  text?: string
  ids?: string[]
  count?: number
  ok?: boolean
  error?: string
  // A dashboard search across owners: how many it searched.
  owners?: number
}

// ---- Pure helpers (exported for tests/bun/inert.spec.ts) ----

/** The token in a `#token=<value>` fragment, or undefined. */
export function tokenFromHash(hash: string): string | undefined {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  return value && /^[A-Za-z0-9_-]+$/.test(value) ? value : undefined
}

/** A readable owner name: `project-<name>-<hash>` shows as <name>. */
export function ownerName(owner: string | undefined): string {
  if (!owner) return 'unknown'
  if (owner === 'all') return 'all projects'
  const match = /^project-(.+)-[0-9a-z]+$/.exec(owner)
  return match?.[1] ?? owner
}

/** The first non-empty line of a text, cut to `max` characters. */
export function firstLine(text: string, max = 80): string {
  const line = text.split('\n').find(part => part.trim() !== '')?.trim() ?? ''
  const chars = Array.from(line)
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : line
}

/** The tags in a memory's metadata: strings only. */
export function tagsOf(metadata: Record<string, unknown> | null | undefined): string[] {
  const tags = metadata?.tags
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string' && tag !== '') : []
}

/** The text cut into parts, `mark` where a query word (2+ characters) matches, case aside. */
export function markParts(text: string, query: string): { text: string; mark: boolean }[] {
  const words = [...new Set(query.toLowerCase().split(/\s+/).filter(word => word.length >= 2))]
  if (words.length === 0 || text === '') return [{ text, mark: false }]
  const pattern = new RegExp(`(${words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return text
    .split(pattern)
    .filter(part => part !== '')
    .map(part => ({ text: part, mark: words.includes(part.toLowerCase()) }))
}

/** A date as YYYY-MM-DD, local time; '' when there is none. */
export function day(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A time as HH:MM:SS, local time. */
export function clock(value: string | undefined): string {
  const date = new Date(value ?? '')
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Where an activity line came from, in words. */
export function originLabel(line: ActivityLine): string {
  switch (line.origin) {
    case 'hook':
      return line.action === 'rearm' ? 'compaction' : line.action === 'recall' ? 'first prompt' : 'hook'
    case 'trigger':
      return 'trigger'
    case 'tool':
      return 'Claude tool'
    case 'external':
      return 'outside agent'
    case 'ui':
      return 'dashboard'
    case 'backfill':
      return 'backfill'
    default:
      return line.origin ?? ''
  }
}

/** What an activity line's call came to, in words. */
export function resultLabel(line: ActivityLine): string {
  if (line.ok === false) return 'failed'
  switch (line.action) {
    case 'recall':
      return line.count ? `${line.count} found` : 'nothing found'
    case 'remember':
      return 'saved'
    case 'update':
      return 'updated'
    case 'forget':
      return 'deleted'
    case 'stats':
      return 'stats'
    default:
      return ''
  }
}

const actionLabel = (action: string | undefined) => (action === 'rearm' ? 're-arm' : (action ?? ''))

// The bar's width, in twentieths (style.css has .w0 … .w20).
const barClass = (score: number) => `w${Math.round(Math.min(1, Math.max(0, score)) * 20)}`

// ---- Elements: createElement and textContent only ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  if (className) element.className = className
  return element
}

const ownerColour = new Map<string, string>()

/** A colour class per owner: global grey, the others in the order the server lists them. */
function colourOf(owner: string | undefined) {
  if (!owner || owner === 'global' || owner === 'all') return 'c-global'
  let colour = ownerColour.get(owner)
  if (colour === undefined) {
    colour = `c${ownerColour.size % OWNER_COLOURS}`
    ownerColour.set(owner, colour)
  }
  return colour
}

function project(owner: string | undefined, className = 'project', label?: string) {
  const span = el('span', undefined, className)
  span.title = label ?? owner ?? ''
  span.append(el('span', undefined, `dot ${label ? 'c-global' : colourOf(owner)}`), el('span', label ?? ownerName(owner)))
  return span
}

function chips(tags: readonly string[]) {
  const span = el('span', undefined, 'tag-list')
  for (const tag of tags) span.append(el('span', tag, 'tag'))
  return span
}

/** One row of the Memories table. */
export function memoryRow(memory: Memory, open: (id: string) => void) {
  const row = el('tr', undefined, 'row')
  row.tabIndex = 0
  row.dataset.id = memory.id
  const text = el('td')
  const stack = el('div', undefined, 'stack')
  stack.append(el('span', memory.preview ?? memory.content ?? ''), el('span', memory.id, 'mono muted id'))
  text.append(stack)
  const owner = el('td', undefined, 'nowrap')
  owner.append(project(memory.owner))
  const tags = el('td')
  tags.append(chips(tagsOf(memory.metadata)))
  row.append(text, owner, tags, el('td', day(memory.timestamp), 'muted nowrap'), el('td', String(memory.recall_count ?? 0), 'num mono'))
  row.addEventListener('click', () => open(memory.id))
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      open(memory.id)
    }
  })
  return row
}

/** The detail panel's content for one memory; `forget` runs after the confirm. */
export function memoryDetail(memory: Memory, forget: (memory: Memory, done: (error?: string) => void) => void) {
  const panel = el('div', undefined, 'detail-body')
  const head = el('div', undefined, 'detail-head')
  head.append(project(memory.owner, 'project muted'), el('span', memory.id, 'mono muted push-right'))
  const content = memory.content ?? memory.preview ?? ''
  const facts = el('dl', undefined, 'grid-facts')
  const fact = (label: string, value: string) => {
    const box = el('div')
    box.append(el('dt', label), el('dd', value))
    facts.append(box)
  }
  fact('Saved', day(memory.timestamp) || 'unknown')
  fact('Recalls', String(memory.recall_count ?? 0))
  fact('Last recalled', day(memory.last_recalled) || 'never')
  fact('Source', memory.source ?? 'unknown')
  fact('Importance', memory.importance === null || memory.importance === undefined ? 'unknown' : memory.importance.toFixed(2))
  fact('Scope', memory.scope ?? 'unknown')
  const tagBox = el('div', undefined, 'detail-tags')
  const tags = tagsOf(memory.metadata)
  tagBox.append(el('span', 'Tags', 'muted small'), tags.length > 0 ? chips(tags) : el('span', 'No tags yet.', 'muted small'))

  // Forget: a first button, then a confirm that names the memory's first line and id.
  const danger = el('div', undefined, 'danger-zone')
  const ask = el('button', 'Forget…', 'btn danger-outline')
  ask.type = 'button'
  const confirm = el('div', undefined, 'confirm')
  confirm.hidden = true
  const warning = el('p', 'Forget this memory for good? This cannot be undone.', 'warn')
  const naming = el('p', undefined, 'small')
  naming.append(el('span', `“${firstLine(content)}”`), el('span', ` · ${memory.id}`, 'mono'))
  const buttons = el('div', undefined, 'buttons')
  const keep = el('button', 'Keep it', 'btn')
  keep.type = 'button'
  const yes = el('button', 'Forget', 'btn danger')
  yes.type = 'button'
  buttons.append(keep, yes)
  const problem = el('p', undefined, 'warn small')
  problem.hidden = true
  confirm.append(warning, naming, buttons, problem)
  ask.addEventListener('click', () => {
    ask.hidden = true
    confirm.hidden = false
    keep.focus()
  })
  keep.addEventListener('click', () => {
    confirm.hidden = true
    problem.hidden = true
    ask.hidden = false
    ask.focus()
  })
  yes.addEventListener('click', () => {
    yes.disabled = true
    keep.disabled = true
    forget(memory, error => {
      yes.disabled = false
      keep.disabled = false
      if (error) {
        problem.textContent = error
        problem.hidden = false
      }
    })
  })
  danger.append(ask, confirm)

  panel.append(head, el('p', content, 'detail-text'), facts, tagBox, danger)
  return panel
}

/** One line of the Activity feed. */
export function activityItem(line: ActivityLine) {
  const item = el('li', undefined, 'event')
  const action = line.action ?? ''
  const what = line.text || (action === 'forget' ? (line.ids ?? []).join(', ') : action === 'rearm' ? 'will recall on next prompt' : '')
  const result = el('span', resultLabel(line), line.ok === false ? 'result is-failed' : 'result')
  if (line.ok === false && line.error) result.title = line.error
  item.append(
    el('span', clock(line.t), 'mono muted time'),
    el('span', actionLabel(action), `badge a-${/^[a-z]+$/.test(action) ? action : 'other'}`),
    el('span', originLabel(line), 'muted origin'),
    project(line.owner, 'project owner-col', typeof line.owners === 'number' && line.owners > 1 ? `all projects (${line.owners})` : undefined),
    el('span', what, 'what'),
    result,
  )
  return item
}

/** One Search hit: rank, project, score, text with the query words marked, tags and Open. */
export function searchHit(hit: Hit, rank: number, query: string, open: (id: string) => void) {
  const item = el('li', undefined, 'hit')
  const head = el('div', undefined, 'hit-head')
  const score = el('span', 'score ', 'score push-right muted small')
  const bar = el('span', undefined, 'bar')
  bar.append(el('span', undefined, `bar-fill ${barClass(hit.score)}`))
  score.append(bar, el('span', hit.score.toFixed(2), 'mono'))
  head.append(el('span', `#${rank}`, 'mono muted small'), project(hit.owner), score)
  const text = el('p', undefined, 'hit-text')
  for (const part of markParts(hit.content, query)) text.append(part.mark ? el('mark', part.text) : document.createTextNode(part.text))
  if (hit.truncated) text.append(el('span', ' …', 'muted'))
  const foot = el('div', undefined, 'hit-foot')
  const openButton = el('button', 'Open', 'link push-right')
  openButton.type = 'button'
  openButton.addEventListener('click', () => open(hit.id))
  foot.append(chips(tagsOf(hit.metadata)), el('span', `${hit.recall_count} recalls`, 'muted small'), openButton)
  item.append(head, text, foot)
  return item
}

// ---- The page ----

function byId<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`#${id} is missing from index.html`)
  return element as T
}

function setStatus(text: string, kind: 'ok' | 'error' | 'plain' = 'plain') {
  const status = byId('status')
  status.textContent = text
  status.className = kind === 'plain' ? 'status' : `status is-${kind}`
}

// Takes the token from the fragment (then drops the fragment), else from this tab's storage.
function takeToken(): string | undefined {
  const fromLink = tokenFromHash(location.hash)
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`)
  if (fromLink) {
    sessionStorage.setItem(TOKEN_KEY, fromLink)
    return fromLink
  }
  return sessionStorage.getItem(TOKEN_KEY) ?? undefined
}

let token = ''
let expired = false

class Expired extends Error {}

// The link stopped working (the server restarted): say so and show no data.
function expire() {
  if (expired) return
  expired = true
  sessionStorage.removeItem(TOKEN_KEY)
  for (const view of VIEWS) byId(`view-${view}`).hidden = true
  byId('foot').hidden = true
  setStatus('This link no longer works (the server was restarted). Run /mnemosyne-ui again for a fresh link.', 'error')
}

/** An /api call with the token in the Authorization header; JSON bodies as JSON. */
async function api(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}) {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal,
    cache: 'no-store',
  })
  if (response.status === 401) {
    expire()
    throw new Expired('expired')
  }
  return response
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

const failure = (err: unknown) => (err instanceof Error ? err.message : String(err))

// ---- Tabs ----

let current: View = 'memories'
const opened = new Set<View>()

function drawTabs() {
  const tabs = byId('tabs')
  for (const view of VIEWS) {
    const tab = el('button', VIEW_NAMES[view], 'tab')
    tab.type = 'button'
    tab.dataset.view = view
    if (view === 'map') {
      tab.disabled = true
      tab.title = 'The map arrives in a later build'
    }
    tab.addEventListener('click', () => show(view))
    tabs.append(tab)
  }
}

function show(view: View) {
  current = view
  for (const name of VIEWS) byId(`view-${name}`).hidden = name !== view
  for (const tab of byId('tabs').querySelectorAll<HTMLButtonElement>('button.tab')) {
    if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page')
    else tab.removeAttribute('aria-current')
  }
  if (!opened.has(view)) {
    opened.add(view)
    if (view === 'memories') void loadMemories()
    if (view === 'activity') void startActivity()
    if (view === 'search') byId<HTMLInputElement>('search-query').focus()
  }
}

// ---- Header and footer ----

let owners: Owner[] = []

async function loadHealth() {
  const health = await readJson<Health>(await api('/api/health'))
  owners = health.owners ?? []
  for (const { owner } of owners) colourOf(owner)
  const projects = owners.length
  byId('summary').textContent = `${health.total} ${health.total === 1 ? 'memory' : 'memories'} · ${projects} ${projects === 1 ? 'project' : 'projects'}`
  byId('engine').textContent = health.engine ? `engine ${health.engine}` : ''
  for (const id of ['mem-owner', 'search-owner']) {
    const select = byId<HTMLSelectElement>(id)
    const chosen = select.value
    select.replaceChildren(el('option', 'All projects'))
    select.options[0]!.value = ''
    for (const { owner, count } of owners) {
      const option = el('option', `${ownerName(owner)} (${count})`)
      option.value = owner
      option.title = owner
      select.append(option)
    }
    select.value = owners.some(o => o.owner === chosen) ? chosen : ''
  }
  const facts = byId('facts')
  facts.replaceChildren()
  const fact = (label: string, value: string) => facts.append(el('dt', label), el('dd', value))
  fact('Store', health.store)
  fact('Server', `running, process ${health.pid}`)
  fact('Activity log', health.activity ? 'on' : 'off')
  if (health.note) fact('Note', health.note)
  byId('foot').hidden = false
}

// ---- Memories ----

const memories = { selected: '' as string, rows: [] as Memory[], timer: 0 as ReturnType<typeof setTimeout> | 0 }

async function loadMemories() {
  const params = new URLSearchParams()
  const owner = byId<HTMLSelectElement>('mem-owner').value
  const sort = byId<HTMLSelectElement>('mem-sort').value
  const q = byId<HTMLInputElement>('mem-filter').value.trim()
  if (owner) params.set('owner', owner)
  params.set('sort', sort)
  if (q) params.set('q', q)
  try {
    const response = await api(`/api/memories?${params}`)
    const body = await readJson<{ total?: number; count?: number; memories?: Memory[]; error?: string }>(response)
    if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`)
    memories.rows = body.memories ?? []
    drawRows()
    const total = body.total ?? memories.rows.length
    byId('mem-count').textContent = memories.rows.length === 0 ? 'No memories match.' : `Showing ${memories.rows.length} of ${total}`
  } catch (err) {
    if (!(err instanceof Expired)) setStatus(`Could not load memories: ${failure(err)}`, 'error')
  }
}

function drawRows() {
  const body = byId('mem-rows')
  body.replaceChildren(...memories.rows.map(memory => memoryRow(memory, id => void openMemory(id))))
  markSelected()
}

function markSelected() {
  for (const row of byId('mem-rows').querySelectorAll<HTMLTableRowElement>('tr.row')) {
    row.classList.toggle('is-selected', row.dataset.id === memories.selected)
    row.setAttribute('aria-selected', String(row.dataset.id === memories.selected))
  }
}

function emptyDetail(text = 'Pick a memory to see it in full.') {
  byId('detail').replaceChildren(el('p', text, 'muted'))
}

async function openMemory(id: string) {
  memories.selected = id
  markSelected()
  try {
    const response = await api(`/api/memories/${encodeURIComponent(id)}`)
    if (response.status === 404) {
      emptyDetail('That memory is gone.')
      return
    }
    const memory = await readJson<Memory & { error?: string }>(response)
    if (!response.ok) throw new Error(memory.error ?? `the server answered ${response.status}`)
    byId('detail').replaceChildren(memoryDetail(memory, forgetMemory))
  } catch (err) {
    if (!(err instanceof Expired)) setStatus(`Could not open the memory: ${failure(err)}`, 'error')
  }
}

function forgetMemory(memory: Memory, done: (error?: string) => void) {
  void (async () => {
    try {
      const response = await api('/api/forget', { method: 'POST', body: { memory_id: memory.id } })
      const body = await readJson<{ status?: string; error?: string; note?: string }>(response)
      if (response.ok && body.status === 'deleted') {
        memories.rows = memories.rows.filter(row => row.id !== memory.id)
        memories.selected = ''
        drawRows()
        emptyDetail()
        setStatus(`Forgot memory ${memory.id}.${body.note ? ` ${body.note}` : ''}`, 'ok')
        void loadHealth().catch(() => undefined)
        void loadMemories()
        return
      }
      if (response.status === 404) {
        emptyDetail('That memory is already gone.')
        setStatus(`Memory ${memory.id} is already gone; nothing was deleted.`, 'error')
        void loadMemories()
        return
      }
      done(`Forget failed: ${body.error ?? `the server answered ${response.status}`}`)
    } catch (err) {
      if (!(err instanceof Expired)) done(`Forget failed: ${failure(err)}`)
    }
  })()
}

function wireMemories() {
  byId('mem-owner').addEventListener('change', () => void loadMemories())
  byId('mem-sort').addEventListener('change', () => void loadMemories())
  byId('mem-filter').addEventListener('input', () => {
    if (memories.timer) clearTimeout(memories.timer)
    memories.timer = setTimeout(() => void loadMemories(), 250)
  })
  emptyDetail()
}

// ---- Activity: the recent lines, then the live tail read with fetch ----

/**
 * The feed's state. `lines` is what the view shows, newest first. While
 * paused, streamed lines wait in `queued` and a reload waits in `snapshot`, so
 * neither redraws the view; Resume puts them in. `cursor` is where the last
 * read of /api/activity stopped: the stream starts there, so no line falls
 * between the read and the live tail.
 */
export type Feed = { lines: ActivityLine[]; queued: ActivityLine[]; snapshot: ActivityLine[] | null; paused: boolean; cursor: string }

export const newFeed = (): Feed => ({ lines: [], queued: [], snapshot: null, paused: false, cursor: '' })

/** Streamed lines, oldest first as the log has them; true when the view must redraw. */
export function feedAdd(feed: Feed, batch: readonly ActivityLine[]): boolean {
  if (batch.length === 0) return false
  const newest = [...batch].reverse()
  if (feed.paused) {
    feed.queued = [...newest, ...feed.queued].slice(0, FEED_KEEP)
    return false
  }
  feed.lines = [...newest, ...feed.lines].slice(0, FEED_KEEP)
  return true
}

/** A fresh read of /api/activity (newest first) and its cursor; true when the view must redraw. */
export function feedReload(feed: Feed, lines: readonly ActivityLine[], cursor: string): boolean {
  feed.cursor = cursor
  feed.queued = []
  if (feed.paused) {
    feed.snapshot = lines.slice(0, FEED_KEEP)
    return false
  }
  feed.snapshot = null
  feed.lines = lines.slice(0, FEED_KEEP)
  return true
}

/** Pause or resume; true when the view must redraw. */
export function feedPause(feed: Feed, paused: boolean): boolean {
  feed.paused = paused
  if (paused) return false
  const changed = feed.snapshot !== null || feed.queued.length > 0
  feed.lines = [...feed.queued, ...(feed.snapshot ?? feed.lines)].slice(0, FEED_KEEP)
  feed.queued = []
  feed.snapshot = null
  return changed
}

/** The whole NDJSON lines at the start of `buffer` (blank and broken ones skipped), and the rest. */
export function takeLines(buffer: string): { lines: ActivityLine[]; rest: string } {
  const lines: ActivityLine[] = []
  const at = buffer.lastIndexOf('\n')
  for (const text of buffer.slice(0, at + 1).split('\n')) {
    if (text.trim() === '') continue
    try {
      const line = JSON.parse(text)
      if (line !== null && typeof line === 'object' && !Array.isArray(line)) lines.push(line as ActivityLine)
    } catch {
      // not a line: skipped
    }
  }
  return { lines, rest: buffer.slice(at + 1) }
}

/** One chunk of the stream: every whole line in it goes in, then the view is drawn once at most. The rest of the buffer. */
export function receiveChunk(feed: Feed, buffer: string, draw: () => void): string {
  const { lines, rest } = takeLines(buffer)
  if (feedAdd(feed, lines)) draw()
  return rest
}

const feed = newFeed()
const feedView = { filter: 'all', started: false, live: 'Connecting' }

const isToday = (t: string | undefined) => day(t) === day(new Date().toISOString())

function shown(line: ActivityLine) {
  if (feedView.filter === 'all') return true
  if (feedView.filter === 'external') return line.origin === 'external'
  return line.action === feedView.filter
}

function drawFeed() {
  const today = feed.lines.filter(line => isToday(line.t))
  const count = (test: (line: ActivityLine) => boolean) => String(today.filter(test).length)
  byId('tile-recall').textContent = count(line => line.action === 'recall' && line.ok !== false)
  byId('tile-remember').textContent = count(line => line.action === 'remember' && line.ok !== false)
  byId('tile-update').textContent = count(line => line.action === 'update' && line.ok !== false)
  byId('tile-failed').textContent = count(line => line.ok === false)
  const list = feed.lines.filter(shown).slice(0, FEED_SHOW)
  byId('act-list').replaceChildren(...(list.length > 0 ? list.map(activityItem) : [el('li', 'No activity yet.', 'event muted')]))
}

function setLive(text: string) {
  feedView.live = text
  byId('live-text').textContent = feed.paused && text === 'Live' ? 'Paused' : text
  byId('live').classList.toggle('is-off', text !== 'Live' || feed.paused)
}

async function loadActivity() {
  const response = await api(`/api/activity?limit=${FEED_KEEP}`)
  const body = await readJson<{ off?: boolean; lines?: ActivityLine[]; cursor?: string }>(response)
  if (!response.ok) throw new Error(`the server answered ${response.status}`)
  if (feedReload(feed, body.lines ?? [], typeof body.cursor === 'string' ? body.cursor : '')) drawFeed()
  return body.off === true
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function follow() {
  let attempt = 0
  for (;;) {
    try {
      const from = feed.cursor ? `?cursor=${encodeURIComponent(feed.cursor)}` : ''
      const response = await api(`/api/activity/stream${from}`)
      if (response.status === 404) {
        setLive('Log off')
        return
      }
      if (!response.ok || response.body === null) throw new Error(`the server answered ${response.status}`)
      setLive('Live')
      attempt = 0
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer = receiveChunk(feed, buffer + decoder.decode(value, { stream: true }), drawFeed)
      }
    } catch (err) {
      if (err instanceof Expired) return
    }
    // The stream ended (the server's time cap, a restart, the network): catch up, then follow again from the new cursor.
    setLive('Reconnecting')
    await sleep(Math.min(30_000, 1_000 * 2 ** attempt++))
    if (expired) return
    try {
      await loadActivity()
    } catch (err) {
      if (err instanceof Expired) return
    }
  }
}

async function startActivity() {
  if (feedView.started) return
  feedView.started = true
  try {
    const off = await loadActivity()
    if (off) {
      setLive('Log off')
      return
    }
  } catch (err) {
    if (err instanceof Expired) return
    setStatus(`Could not load the activity log: ${failure(err)}`, 'error')
  }
  void follow()
}

function wireActivity() {
  const pause = byId<HTMLButtonElement>('pause')
  pause.addEventListener('click', () => {
    const redraw = feedPause(feed, !feed.paused)
    pause.textContent = feed.paused ? 'Resume' : 'Pause'
    if (redraw) drawFeed()
    setLive(feedView.live)
  })
  const filters = byId('act-filters')
  for (const button of filters.querySelectorAll<HTMLButtonElement>('button[data-filter]')) {
    button.addEventListener('click', () => {
      feedView.filter = button.dataset.filter ?? 'all'
      for (const other of filters.querySelectorAll<HTMLButtonElement>('button[data-filter]')) other.setAttribute('aria-pressed', String(other === button))
      drawFeed()
    })
  }
}

// ---- Search: one at a time ----

const SEARCH_TIMEOUT_MS = 60_000
let searching: AbortController | null = null

function wireSearch() {
  const form = byId<HTMLFormElement>('search-form')
  form.addEventListener('submit', event => {
    event.preventDefault()
    void runSearch()
  })
}

async function runSearch() {
  // A submit while a search is pending is ignored (the button is disabled too).
  if (searching !== null) return
  const query = byId<HTMLInputElement>('search-query').value.trim()
  const owner = byId<HTMLSelectElement>('search-owner').value
  const results = byId('search-results')
  const note = byId('search-note')
  const button = byId<HTMLFormElement>('search-form').querySelector<HTMLButtonElement>('button[type="submit"]')
  if (query === '') return
  const controller = new AbortController()
  searching = controller
  // A search that hangs frees the form after a while.
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
  if (button) button.disabled = true
  note.hidden = false
  note.textContent = 'Searching…'
  try {
    const response = await api('/api/search', { method: 'POST', body: owner ? { query, owner } : { query }, signal: controller.signal })
    const body = await readJson<{ results?: Hit[]; skipped?: number; error?: string }>(response)
    if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`)
    const hits = body.results ?? []
    const open = (id: string) => {
      show('memories')
      void openMemory(id)
    }
    results.replaceChildren(...hits.map((hit, i) => searchHit(hit, i + 1, query, open)))
    const skipped = body.skipped ? ` The ${body.skipped} smallest projects were not searched.` : ''
    note.textContent = hits.length === 0 ? `Nothing found.${skipped}` : `${hits.length} ${hits.length === 1 ? 'memory' : 'memories'} found.${skipped}`
  } catch (err) {
    if (err instanceof Expired) return
    results.replaceChildren()
    note.textContent = controller.signal.aborted ? 'Search took too long and was stopped.' : `Search failed: ${failure(err)}`
  } finally {
    clearTimeout(timer)
    searching = null
    if (button) button.disabled = false
  }
}

// ---- Start ----

async function main() {
  drawTabs()
  const found = takeToken()
  if (found === undefined) {
    setStatus('Open this dashboard with the link from /mnemosyne-ui in Claude Code: it carries the key this page needs.', 'error')
    return
  }
  token = found
  try {
    await loadHealth()
  } catch (err) {
    if (!(err instanceof Expired)) setStatus(`Could not reach the Mnemosyne server: ${failure(err)}. Run /mnemosyne-ui again.`, 'error')
    return
  }
  setStatus('Connected to the local Mnemosyne server.', 'ok')
  wireMemories()
  wireActivity()
  wireSearch()
  show(current)
}

if (typeof document !== 'undefined' && typeof location !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void main())
  else void main()
}
