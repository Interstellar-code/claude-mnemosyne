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
// The Map tab lives in ui/map.ts (its rules in ui/map-state.ts) and loads its
// library from /vendor/ only when that tab first opens.
// Styles live in style.css: the CSP refuses inline ones.

import { createMap, type MapView } from './map'
import { fragmentAfterToken } from './map-state'
import { createSolarScene } from './solar'
import { extractionState, hasStatus, itemHead, NO_FILTER, neverUsedText, ownersOf, summaryLine, kindTabs, notice as knowledgeNotice, dotClass, ownerColour, ownerColours, parseKnowledge, tableRows, total as knowledgeTotal, type KnowledgeData, type KnowledgeFilter, type KnowledgeSort, type KnowledgeHost, type KnowledgeKind } from './knowledge'
import { chartBars, chartText, coverageRows, dayBars, kpiTiles as healthKpiTiles, parseHealth, projectRows as healthProjectRows, storageList, storageSummary, tableFilterButtons, type HealthData, type HealthHost, type TableFilter } from './health'
import { filterButtons, parseReview, reviewCounts, reviewList, reviewRow, reviewText, type ReviewData, type ReviewFilter, type ReviewHost } from './review'
import { isClaudeRecall } from './recalls'
import { startTheme } from './theme'
import { closeSheet, openSheet, wireSheet } from './sheet'
import { chooseMode, countNote, matchLabel, MEANING_OFF_HINT, readMode, saveMode, SHOW_FIRST, type SearchMode } from './search-mode'
import { createStream, type StreamApi, type StreamHandle, type StreamListener, type StreamStatus } from './stream'

const TOKEN_KEY = 'mnemosyne.token'
const VIEWS = ['map', 'memories', 'activity', 'search', 'knowledge', 'review', 'health'] as const
type View = (typeof VIEWS)[number]
const VIEW_NAMES: Record<View, string> = { map: 'Map', memories: 'Memories', activity: 'Activity', search: 'Search', knowledge: 'Knowledge', review: 'Review', health: 'Health' }
const FEED_KEEP = 1000
const FEED_SHOW = 300
const CONNECTED = 'Connected to the local Mnemosyne server.'

type Owner = { owner: string; count: number }

type Health = {
  ok: boolean
  pid: number
  store: string
  engine: string | null
  /** The plugin version of the running server; absent from servers before 0.7.5. */
  plugin?: string | null
  /** True only for `bun run dev:ui`: the page then reloads when a file in ui/ changes. */
  dev?: boolean
  activity: boolean
  /** True when the server's embeddings are on, so a search can match by meaning; absent from older servers. */
  embeddings?: boolean
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
  // The server sends the cleaned tags beside metadata; older replies have only metadata.
  tags?: string[]
}

// `matched` is absent from servers before the match modes.
export type Hit = Memory & { content: string; score: number; matched?: 'keyword' | 'meaning' | 'both' }

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
  // The calling app's clientInfo name, and the Claude Code session (written from v0.6; older lines have neither).
  client?: string
  session?: string
  // Who wrote a saved memory (from v0.6: 'human', 'agent' or 'system') and how sure the engine is of it.
  author_type?: string
  veracity?: string
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

const textOf = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

const EXTERNAL_KNOWN = ['Codex', 'Cursor', 'Claude Code']

/** The app a clientInfo name belongs to when it is a known one, else undefined. */
function knownApp(client: string): string | undefined {
  if (/codex/i.test(client)) return 'Codex'
  if (/cursor/i.test(client)) return 'Cursor'
  if (/^claude[-_ ]?code/i.test(client)) return 'Claude Code'
  return undefined
}

/** The app an activity line came from: 'Claude Code', 'Codex', 'Cursor', 'Dashboard', another client's own name, or '' when unknown. */
export function appOf(line: ActivityLine): string {
  const client = textOf(line.client)
  // An outside client names itself, so its name may not pass for the dashboard or a fixed group of the filter (see appKey).
  if (line.origin === 'external') return client ? (knownApp(client) ?? firstLine(client, 40)) : ''
  if (line.origin === 'ui') return 'Dashboard'
  if (client) return knownApp(client) ?? firstLine(client, 40)
  // Hook, tool and trigger lines are Claude Code's; a backfill line names its own client or none.
  return line.origin === 'hook' || line.origin === 'tool' || line.origin === 'trigger' ? 'Claude Code' : ''
}

/** The badge on a saved memory's row: 'you said' (a human, by a trigger phrase), 'Claude' (an agent in Claude Code), 'Codex' or the outside app's own name (an agent), 'system'; none for a row without author_type or one that is not a save. */
export function provenanceBadge(line: ActivityLine): string {
  if (line.action !== 'remember') return ''
  const author = textOf(line.author_type)
  if (author === 'human') return 'you said'
  if (author === 'system') return 'system'
  if (author !== 'agent') return ''
  const app = appOf(line)
  return app === 'Claude Code' ? 'Claude' : app || 'agent'
}

/** What the App filter compares: an outside client's raw name is namespaced, so "Dashboard" from an MCP client is never the dashboard. */
export function appKey(line: ActivityLine): string {
  const app = appOf(line)
  return line.origin === 'external' && app !== '' && !EXTERNAL_KNOWN.includes(app) ? `ext:${app}` : app
}

/** A session id cut to its first 8 characters. */
export const shortSession = (session: string) => Array.from(session).slice(0, 8).join('')

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
      return appName(appKey(line)) || 'outside agent'
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
  if (line.action === 'extract') {
    if (line.ok === false) return textOf(line.error) ? `failed: ${firstLine(textOf(line.error), 60)}` : 'failed'
    return `${line.count ?? 0} ${line.count === 1 ? 'item' : 'items'}`
  }
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

/** An action in words: 'rearm' shows as 're-arm', 'extract' (knowledge learned from a save) as 'learn'. */
export const actionLabel = (action: string | undefined) => (action === 'rearm' ? 're-arm' : action === 'extract' ? 'learn' : (action ?? ''))

// The bar's width, in twentieths (style.css has .w0 … .w20).
const barClass = (score: number) => `w${Math.round(Math.min(1, Math.max(0, score)) * 20)}`

// ---- Elements: createElement and textContent only ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  if (className) element.className = className
  return element
}

// Every tab draws a project in its Map colour (ownerColours, ui/knowledge.ts): set when the page learns the owners.
let colours = new Map<string, string>()

/** Takes the store's owners: from now on every project dot has its Map colour. */
export function useOwners(list: readonly string[]) {
  colours = ownerColours(list)
}

/** A project's name with its colour dot; `label` stands for a group of projects (grey). */
export function project(owner: string | undefined, className = 'project', label?: string) {
  const span = el('span', undefined, className)
  span.title = label ?? owner ?? ''
  const dot = el('span', undefined, `dot ${dotClass(label ? ownerColour(colours, undefined) : ownerColour(colours, owner))}`)
  span.append(dot, el('span', label ?? ownerName(owner)))
  return span
}

/** A memory's tags: the server's list, else the ones in its metadata. */
export function tagsOfMemory(memory: Pick<Memory, 'metadata' | 'tags'>): string[] {
  return Array.isArray(memory.tags) ? memory.tags.filter((tag): tag is string => typeof tag === 'string' && tag !== '') : tagsOf(memory.metadata)
}

/** Tag chips, text only. With `pick` each chip is a button that filters the table to its tag (and does not open the row it sits in). */
function chips(tags: readonly string[], pick?: (tag: string) => void) {
  const span = el('span', undefined, 'tag-list')
  for (const tag of tags) {
    if (pick === undefined) {
      span.append(el('span', tag, 'tag'))
      continue
    }
    const chip = el('button', tag, 'tag tag-btn')
    chip.type = 'button'
    chip.title = `Show only memories tagged ${tag}`
    chip.addEventListener('click', event => {
      event.stopPropagation()
      pick(tag)
    })
    // Enter and Space on a chip must not also open the row.
    chip.addEventListener('keydown', event => event.stopPropagation())
    span.append(chip)
  }
  return span
}

/** One row of the Memories table. */
export function memoryRow(memory: Memory, open: (id: string) => void, pickTag?: (tag: string) => void) {
  const row = el('tr', undefined, 'row')
  row.tabIndex = 0
  row.dataset.id = memory.id
  const text = el('td')
  // Two lines at most (the CSS clamps it); the id and the full text are in the sheet. A cut-short preview ends in an ellipsis.
  const shown = memory.preview ?? memory.content ?? ''
  text.append(el('span', memory.truncated === true && !shown.endsWith('…') ? `${shown}…` : shown, 'row-text'))
  const owner = el('td', undefined, 'nowrap')
  owner.append(project(memory.owner))
  const tags = el('td')
  tags.append(chips(tagsOfMemory(memory), pickTag))
  // Recalls: "never" (muted) for 0; the tooltip says when it was last recalled.
  const recalls = memory.recall_count ?? 0
  const recalled = el('td', recalls === 0 ? 'never' : String(recalls), recalls === 0 ? 'num muted' : 'num mono')
  recalled.title = `Last recalled: ${day(memory.last_recalled) || 'never'}`
  row.append(text, owner, tags, el('td', day(memory.timestamp), 'muted nowrap'), recalled)
  row.addEventListener('click', () => open(memory.id))
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      open(memory.id)
    }
  })
  return row
}

/** The sheet's content for one memory (see openMemory); `forget` runs after the confirm. */
export function memoryDetail(memory: Memory, forget: (memory: Memory, done: (error?: string) => void) => void, pickTag?: (tag: string) => void) {
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
  const tags = tagsOfMemory(memory)
  tagBox.append(el('span', 'Tags', 'muted small'), tags.length > 0 ? chips(tags, pickTag) : el('span', 'No tags yet.', 'muted small'))

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

  // Two columns on a wide screen: the memory itself on the left, what is known about it on the right.
  const main = el('div', undefined, 'detail-main')
  main.append(head, el('p', content, 'detail-text'))
  const side = el('div', undefined, 'detail-side')
  side.append(facts, tagBox, danger)
  panel.append(main, side)
  return panel
}

/** The Source cell's words: "<App> · <origin word>", such as "Claude Code · tool". */
export function sourceLabel(line: ActivityLine): string {
  const app = line.origin === 'external' ? originLabel(line) : appOf(line) || originLabel(line)
  return line.origin ? `${app} · ${line.origin}` : app
}

/** What an origin word means, for the Source cell's tooltip. */
export const ORIGIN_HELP: Record<string, string> = {
  hook: 'hook: automatic recall on a first prompt or after a compaction',
  tool: 'tool: Claude called a memory tool in Claude Code',
  trigger: 'trigger: you typed a trigger phrase, such as “remember that”',
  external: 'external: another MCP client, through mnemosyne-mcp',
  ui: 'ui: this dashboard (search or forget)',
  backfill: 'backfill: the one-time tagging run, /mnemosyne-tags',
}

/**
 * One activity line as a plain sentence, for the What cell. `preview` is the first line of the line's
 * memory when the log did not keep one (older learn lines); '' or none falls back to the short id.
 */
export function sentenceOf(line: ActivityLine, preview = ''): string {
  const text = textOf(line.text)
  const ids = (line.ids ?? []).filter((id): id is string => typeof id === 'string')
  const count = line.count ?? 0
  const failed = line.ok === false
  switch (line.action) {
    case 'remember':
      return text ? `${failed ? 'Could not save' : 'Saved'}: ${text}` : failed ? 'Could not save a memory' : 'Saved a memory'
    case 'update':
      return text ? `${failed ? 'Could not update' : 'Updated'}: ${text}` : failed ? 'Could not update a memory' : 'Updated a memory'
    case 'recall': {
      const found = count === 0 ? 'nothing' : String(count)
      if (failed) return text ? `Could not recall for “${text}”` : 'Could not recall'
      return text ? `Recalled ${found} for “${text}”` : `Recalled ${found}`
    }
    case 'forget':
      return failed ? `Could not forget ${ids.map(shortSession).join(', ')}`.trim() : `Forgot ${ids.map(shortSession).join(', ') || 'a memory'}`
    case 'rearm':
      return 'Re-armed: will recall on the next prompt'
    case 'stats':
      return 'Checked memory stats'
    case 'extract': {
      const from = text || textOf(preview)
      const source = from ? `from: ${from}` : ids[0] ? `from memory ${shortSession(ids[0])}` : 'from a memory'
      if (failed) return `Could not learn ${source}`
      if (count === 0) return `Learned nothing ${source}`
      return `Learned ${count} ${count === 1 ? 'item' : 'items'} ${source}`
    }
    default:
      return text
  }
}

/** What the Activity page needs beyond the line itself: the open row, the memory previews and how to open a memory. */
export type ActivityCtx = {
  expanded?: boolean
  toggle?: () => void
  /** The first line of a memory the log did not keep text for. */
  preview?: (id: string) => string | undefined
  open?: (id: string) => void
}

/** A line's identity in the list (the log has no row id): the open row is found again by it after a redraw. */
export const lineKey = (line: ActivityLine) => `${line.t ?? ''}|${line.action ?? ''}|${(line.ids ?? [])[0] ?? ''}|${textOf(line.session)}|${textOf(line.text).slice(0, 20)}`

/** The detail line under an open row: full text, memory ids as links, the result, the client, the session and the date and time. */
function activityDetail(line: ActivityLine, ctx: ActivityCtx, sentence: string) {
  const box = el('div', undefined, 'event-detail')
  box.append(el('p', sentence, 'detail-sentence'))
  const facts = el('div', undefined, 'detail-facts')
  const fact = (label: string, value: string | HTMLElement) => {
    const row = el('span', undefined, 'fact')
    row.append(el('span', label, 'muted'), typeof value === 'string' ? el('span', value, 'mono') : value)
    facts.append(row)
  }
  const ids = (line.ids ?? []).filter((id): id is string => typeof id === 'string')
  if (ids.length > 0) {
    const links = el('span', undefined, 'id-links')
    for (const id of ids) {
      const link = el('button', shortSession(id), 'link mono')
      link.type = 'button'
      link.title = `Open memory ${id}`
      link.setAttribute('aria-label', `Open memory ${shortSession(id)}`)
      link.addEventListener('click', event => {
        event.stopPropagation?.()
        ctx.open?.(id)
      })
      links.append(link)
    }
    fact(ids.length === 1 ? 'Memory' : 'Memories', links)
  }
  const result = resultLabel(line)
  fact('Result', line.ok === false && line.error ? `${result || 'failed'} (${textOf(line.error)})` : result || 'ok')
  if (typeof line.count === 'number') fact('Count', String(line.count))
  const client = textOf(line.client)
  if (client) fact('Client', client)
  const session = textOf(line.session)
  if (session) fact('Session', session)
  const date = day(line.t)
  if (date) fact('Time', `${date} ${clock(line.t)}`)
  box.append(facts)
  return box
}

/**
 * One line of the Activity feed; `pickSession` is called with the full session id when its chip is pressed.
 * Pressing the row (or Enter or Space on it) opens its detail line when `ctx.toggle` is given.
 */
export function activityItem(line: ActivityLine, pickSession: (session: string) => void, ctx: ActivityCtx = {}) {
  const item = el('li', undefined, 'event')
  const action = line.action ?? ''
  const first = (line.ids ?? [])[0]
  const sentence = sentenceOf(line, action === 'extract' && !textOf(line.text) && first ? (ctx.preview?.(first) ?? '') : '')
  const result = el('span', resultLabel(line), line.ok === false ? 'result is-failed' : 'result')
  if (line.ok === false && line.error) result.title = line.error
  const source = el('span', undefined, 'source')
  const origin = el('span', sourceLabel(line), 'muted origin')
  if (line.origin) origin.title = ORIGIN_HELP[line.origin] ?? String(line.origin)
  source.append(origin)
  const session = textOf(line.session)
  if (session) {
    const chip = el('button', `session ${shortSession(session)}`, 'link mono session')
    chip.type = 'button'
    chip.title = 'Show only this session'
    chip.setAttribute('aria-label', `Show only session ${shortSession(session)}`)
    chip.addEventListener('click', event => {
      event.stopPropagation?.()
      pickSession(session)
    })
    source.append(chip)
  }
  const badge = provenanceBadge(line)
  const whatCell = el('span', undefined, 'what')
  if (badge !== '') whatCell.append(el('span', badge, line.author_type === 'human' ? 'prov prov-human' : 'prov prov-agent'))
  whatCell.append(document.createTextNode(sentence))
  item.append(
    el('span', clock(line.t), 'mono muted time'),
    el('span', actionLabel(action), `badge a-${/^[a-z]+$/.test(action) ? action : 'other'}`),
    source,
    project(line.owner, 'project owner-col', typeof line.owners === 'number' && line.owners > 1 ? `all projects (${line.owners})` : undefined),
    whatCell,
    result,
  )
  const toggle = ctx.toggle
  if (toggle) {
    item.dataset.key = lineKey(line)
    item.setAttribute('tabindex', '0')
    item.setAttribute('aria-expanded', String(ctx.expanded === true))
    item.addEventListener('click', () => toggle())
    item.addEventListener('keydown', event => {
      // Only the row's own keys: Enter on the session chip or a memory link presses that button.
      if (event.target !== item || (event.key !== 'Enter' && event.key !== ' ')) return
      event.preventDefault?.()
      toggle()
    })
    if (ctx.expanded) {
      item.className = 'event is-open'
      item.append(activityDetail(line, ctx, sentence))
    }
  }
  return item
}

/** One Search hit: rank, project, score, text with the query words marked, tags and Open. */
export function searchHit(hit: Hit, rank: number, query: string, open: (id: string, from?: HTMLElement) => void) {
  const item = el('li', undefined, 'hit')
  const head = el('div', undefined, 'hit-head')
  const score = el('span', 'score ', 'score push-right muted small')
  const bar = el('span', undefined, 'bar')
  bar.append(el('span', undefined, `bar-fill ${barClass(hit.score)}`))
  score.append(bar, el('span', hit.score.toFixed(2), 'mono'))
  head.append(el('span', `#${rank}`, 'mono muted small'), project(hit.owner))
  const how = matchLabel(hit.matched)
  if (how !== '') head.append(el('span', how, `match-badge m-${hit.matched}`))
  head.append(score)
  const text = el('p', undefined, 'hit-text')
  for (const part of markParts(hit.content, query)) text.append(part.mark ? el('mark', part.text) : document.createTextNode(part.text))
  if (hit.truncated) text.append(el('span', ' …', 'muted'))
  const foot = el('div', undefined, 'hit-foot')
  const openButton = el('button', 'Open', 'link push-right')
  openButton.type = 'button'
  openButton.addEventListener('click', () => open(hit.id, openButton))
  // The whole card opens the memory too; its tag chips keep their own job.
  item.addEventListener('click', event => {
    if ((event.target as HTMLElement | null)?.closest?.('button')) return
    open(hit.id, openButton)
  })
  foot.append(chips(tagsOfMemory(hit)), el('span', `${hit.recall_count} recalls`, 'muted small'), openButton)
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
  // A #token= link is cleared from the address bar; a #level= (the Galaxy's place) stays.
  if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}${fragmentAfterToken(location.hash)}`)
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

let current: View = 'map'
const opened = new Set<View>()

function drawTabs() {
  const tabs = byId('tabs')
  for (const view of VIEWS) {
    const tab = el('button', VIEW_NAMES[view], 'tab')
    tab.type = 'button'
    tab.dataset.view = view
    tab.addEventListener('click', () => show(view))
    tabs.append(tab)
  }
}

export function show(view: View) {
  // A message about the last tab (Forgot memory …) does not follow the page to another one, and neither does the bottom sheet.
  if (view !== current && !expired) setStatus(CONNECTED, 'ok')
  if (view !== current) closeSheet()
  current = view
  for (const name of VIEWS) byId(`view-${name}`).hidden = name !== view
  for (const tab of byId('tabs').querySelectorAll<HTMLButtonElement>('button.tab')) {
    if (tab.dataset.view === view) tab.setAttribute('aria-current', 'page')
    else tab.removeAttribute('aria-current')
  }
  if (!opened.has(view)) {
    opened.add(view)
    if (view === 'memories') void loadMemories()
    if (view === 'activity') startActivity()
    if (view === 'search') byId<HTMLInputElement>('search-query').focus()
    // The map (and its library, under /vendor/) loads only when the Map tab first opens.
    if (view === 'map') map = createMap({ api: path => api(path), openMemory: openInMemories, status: setStatus, events: listener => useEvents().subscribe(listener), streamStatus: watcher => useEvents().onStatus(status => watcher(status)), solar: { createScene: options => createSolarScene({ canvas: options.canvas, three: options.three as Parameters<typeof createSolarScene>[0]['three'], onHover: options.onHover, onPick: options.onPick, onLevel: options.onLevel }), post: (path, body) => api(path, { method: 'POST', body }), embeddings: () => embeddingsOn, searchMode: () => searchMode } })
  }
  if (view === 'activity' && feedDirty) {
    feedDirty = false
    drawFeed()
  }
  // Knowledge, Review and Health read fresh numbers every time they are opened.
  if (view === 'knowledge') void loadKnowledge()
  if (view === 'review') void loadReview()
  if (view === 'health') void loadHealthReport()
  map?.visible(view === 'map')
}

// ---- Map ----

let map: MapView | null = null

const NARROW = '(max-width: 900px)'

/** The selection card sits under the canvas: a newly selected star (a new title in it) brings it into view when it is on a phone or below the fold on a wide screen; a refresh of the same star does not. */
export const revealNeeded = (shown: string, next: string, narrow: boolean) => narrow && next !== '' && next !== shown

function wireInspectorReveal() {
  if (typeof MutationObserver === 'undefined' || typeof matchMedia !== 'function') return
  const inspector = byId('map-inspector')
  const back = byId('map-back')
  // The link to the canvas shows only with something in the inspector (the CSS shows it on narrow screens alone).
  back.addEventListener('click', () => byId('map-stage').scrollIntoView({ block: 'start', behavior: 'smooth' }))
  let shown = ''
  new MutationObserver(() => {
    back.hidden = inspector.childElementCount === 0
    const next = inspector.querySelector('.insp-title')?.textContent ?? ''
    // Wide screens: only when the card starts in the last stretch of the window (below the fold).
    const belowFold = typeof innerHeight === 'number' && inspector.getBoundingClientRect().top > innerHeight - 140
    if (revealNeeded(shown, next, matchMedia(NARROW).matches || belowFold)) inspector.scrollIntoView({ block: 'start', behavior: 'smooth' })
    shown = next
  }).observe(inspector, { childList: true, subtree: true })
}

/** The map inspector's Open in Memories: the Memories view, with that memory open. */
function openInMemories(id: string) {
  show('memories')
  void openMemory(id)
}

// ---- Knowledge and Health ----

/** Show on map: the Map tab, with that memory's star selected. */
function showOnMap(id: string) {
  show('map')
  map?.show(id)
}

const knowledgeView = { kind: 'fact' as KnowledgeKind, data: null as KnowledgeData | null, filter: { ...NO_FILTER } as KnowledgeFilter }

/** A tab's own status line (Knowledge, Review and Health): the text, as an error or not, and its Try again button. */
function tabStatus(name: 'know' | 'review' | 'health', text: string, error = false) {
  const line = byId(`${name}-status`)
  line.textContent = text
  line.className = error ? 'notice-line small is-error' : 'notice-line small muted'
  line.hidden = text === ''
  byId(`${name}-retry`).hidden = !error
}
const knowledgeHost: KnowledgeHost = { project: owner => project(owner, 'project'), showOnMap, open: (id, row) => void openMemory(id, row), now: () => Date.now() }

/** Only the table body: the find box redraws it per keystroke. */
function drawKnowledgeRows() {
  const data = knowledgeView.data
  if (data !== null) byId('know-rows').replaceChildren(...tableRows(data, knowledgeView.kind, knowledgeHost, knowledgeView.filter))
}

export function drawKnowledge() {
  const data = knowledgeView.data
  if (data === null) return
  // With items in the table, extraction has plainly run: the 'cannot say' sentence only shows for off, or with no items.
  const state = extractionState(data.extraction)
  tabStatus('know', state.mode === 'unknown' && knowledgeTotal(data) > 0 ? '' : state.status)
  const note = knowledgeNotice(data)
  const box = byId('know-notice')
  box.hidden = note === null
  box.replaceChildren(...(note === null ? [] : [el('strong', note.title), el('span', note.body)]))
  byId('know-tabs').replaceChildren(
    ...kindTabs(data, knowledgeView.kind, kind => {
      knowledgeView.kind = kind
      drawKnowledge()
    }),
  )
  byId('know-summary').replaceChildren(...summaryLine(data, Date.now()))
  byId('know-never').textContent = neverUsedText(data, Date.now())
  // The toolbar: the project select lists the owners present (the choice is kept while it is still there).
  const filter = knowledgeView.filter
  const ownerSelect = byId<HTMLSelectElement>('know-owner')
  const present = ownersOf(data)
  if (filter.owner !== '' && !present.includes(filter.owner)) filter.owner = ''
  ownerSelect.replaceChildren(Object.assign(el('option', 'All projects'), { value: '' }), ...present.map(owner => Object.assign(el('option', ownerName(owner)), { value: owner, title: owner })))
  ownerSelect.value = filter.owner
  byId<HTMLSelectElement>('know-sort').value = filter.sort
  byId<HTMLInputElement>('know-find').value = filter.text
  byId('know-never').setAttribute('aria-pressed', String(filter.neverUsed))
  byId('know-item-head').textContent = itemHead(knowledgeView.kind)
  byId('know-status-head').hidden = !hasStatus(knowledgeView.kind)
  byId('know-rows').replaceChildren(...tableRows(data, knowledgeView.kind, knowledgeHost, filter))
  byId('know-body').hidden = false
}

export async function loadKnowledge() {
  if (knowledgeView.data === null) tabStatus('know', 'Loading…')
  try {
    const response = await api('/api/knowledge')
    if (!response.ok) throw new Error(`the server answered ${response.status}`)
    const data = parseKnowledge(await readJson<unknown>(response))
    if (data === null) throw new Error('the reply was not a knowledge list')
    knowledgeView.data = data
    drawKnowledge()
  } catch (err) {
    if (!(err instanceof Expired)) tabStatus('know', `Could not load the knowledge: ${failure(err)}`, true)
  }
}

/**
 * The guarded forget, the one /api/forget call of the page: the Memories tab's button
 * (forgetMemory) and the Review tab's list both go through it. `done()`
 * on success or when the memory was already gone, `done(error)` on failure.
 */
export function forgetById(id: string, done: (error?: string) => void) {
  void (async () => {
    try {
      const response = await api('/api/forget', { method: 'POST', body: { memory_id: id } })
      const body = await readJson<{ status?: string; error?: string; note?: string }>(response)
      const deleted = response.ok && body.status === 'deleted'
      if (!deleted && response.status !== 404) {
        done(`Forget failed: ${body.error ?? `the server answered ${response.status}`}`)
        return
      }
      memories.rows = memories.rows.filter(row => row.id !== id)
      if (memories.selected === id) {
        memories.selected = ''
        closeSheet()
      }
      drawRows()
      if (deleted) setStatus(`Forgot memory ${id}.${body.note ? ` ${body.note}` : ''}`, 'ok')
      else setStatus(`Memory ${id} is already gone; nothing was deleted.`, 'error')
      if (deleted) void loadHealth().catch(() => undefined)
      if (opened.has('memories')) void loadMemories()
      if (opened.has('knowledge')) void loadKnowledge()
      // Search: the forgotten hit leaves the list.
      if (searchHits.some(hit => hit.id === id)) {
        searchHits = searchHits.filter(hit => hit.id !== id)
        drawHits(false)
      }
      done()
    } catch (err) {
      if (!(err instanceof Expired)) done(`Forget failed: ${failure(err)}`)
    }
  })()
}

const healthView = { data: null as HealthData | null, tables: 'all' as TableFilter }
const healthHost: HealthHost = { project: owner => project(owner, 'project'), openReview: () => show('review') }

export function drawHealth() {
  const data = healthView.data
  if (data === null) return
  const now = Date.now()
  byId('health-kpis').replaceChildren(...healthKpiTiles(data, healthHost.openReview))
  byId('health-coverage').replaceChildren(...coverageRows(data))
  const days = dayBars(data, now)
  const words = chartText(days, data)
  const chart = byId('health-chart')
  chart.setAttribute('aria-label', words.label)
  chart.replaceChildren(...chartBars(days))
  byId('health-chart-text').textContent = words.summary
  byId('health-projects').replaceChildren(...healthProjectRows(data, healthHost))
  // Storage is a collapsed <details>; its filter redraws only the list, so the open state stays.
  byId('health-storage-summary').textContent = storageSummary(data)
  drawStorage()
  tabStatus('health', '')
  byId('health-body').hidden = false
}

function drawStorage() {
  const data = healthView.data
  if (data === null) return
  byId('health-storage-filter').replaceChildren(
    ...tableFilterButtons(healthView.tables, filter => {
      healthView.tables = filter
      drawStorage()
    }),
  )
  byId('health-storage').replaceChildren(...storageList(data, healthView.tables))
}

export async function loadHealthReport() {
  if (healthView.data === null) tabStatus('health', 'Loading…')
  try {
    const response = await api('/api/health-report')
    if (!response.ok) throw new Error(`the server answered ${response.status}`)
    const data = parseHealth(await readJson<unknown>(response))
    if (data === null) throw new Error('the reply was not a health report')
    healthView.data = data
    drawHealth()
  } catch (err) {
    if (err instanceof Expired) return
    tabStatus('health', `Could not load the health report: ${failure(err)}`, true)
  }
}

// ---- Review ----

// After a forget, the row index whose successor gets the focus once the list is redrawn.
const reviewView = { data: null as ReviewData | null, filter: 'never' as ReviewFilter, refocus: null as number | null }
const reviewHost: ReviewHost = { project: owner => project(owner, 'project'), open: id => openInMemories(id), forget: forgetById, now: () => Date.now() }

export function drawReview() {
  const data = reviewView.data
  if (data === null) return
  const now = Date.now()
  byId('review-filters').replaceChildren(
    ...filterButtons(reviewCounts(data.rows, now), reviewView.filter, filter => {
      reviewView.filter = filter
      drawReview()
    }),
  )
  const list = reviewList(data.rows, reviewView.filter, now)
  byId('review-text').textContent = reviewText(reviewView.filter, list.length, data.rows.length, data.total)
  const rows = list.map((memory, index) =>
    reviewRow(memory, reviewHost, () => {
      reviewView.refocus = index
      void loadReview()
    }),
  )
  byId('review-rows').replaceChildren(...rows)
  byId('review-box').hidden = list.length === 0
  tabStatus('review', '')
  byId('review-body').hidden = false
  // The redrawn list lost the focused button: the next row's Open (the new last row's when the
  // last was forgotten), else the tab's heading when the list is now empty.
  if (reviewView.refocus !== null) {
    const row = rows[Math.min(reviewView.refocus, rows.length - 1)]
    reviewView.refocus = null
    ;(row?.querySelector<HTMLButtonElement>('button') ?? byId('review-title')).focus()
  }
}

export async function loadReview() {
  if (reviewView.data === null) tabStatus('review', 'Loading…')
  try {
    // The newest memories (the server's list limit); the filters work on them here, since one request cannot ask for all four.
    const response = await api('/api/memories?sort=newest')
    if (!response.ok) throw new Error(`the server answered ${response.status}`)
    const data = parseReview(await readJson<unknown>(response))
    if (data === null) throw new Error('the reply was not a memory list')
    reviewView.data = data
    drawReview()
  } catch (err) {
    if (err instanceof Expired) return
    tabStatus('review', `Could not load the memories: ${failure(err)}`, true)
    if (reviewView.refocus !== null) {
      reviewView.refocus = null
      byId('review-retry').focus()
    }
  }
}

/** The Try again buttons of the Knowledge, Review and Health status lines. */
export function wireKnowledgeHealth() {
  byId('review-retry').addEventListener('click', () => void loadReview())
  byId('know-retry').addEventListener('click', () => void loadKnowledge())
  byId('know-owner').addEventListener('change', () => {
    knowledgeView.filter.owner = byId<HTMLSelectElement>('know-owner').value
    drawKnowledge()
  })
  byId('know-sort').addEventListener('change', () => {
    knowledgeView.filter.sort = byId<HTMLSelectElement>('know-sort').value as KnowledgeSort
    drawKnowledge()
  })
  byId('know-find').addEventListener('input', () => {
    knowledgeView.filter.text = byId<HTMLInputElement>('know-find').value
    // Redraw only the table, so the find box keeps focus while typing.
    drawKnowledgeRows()
  })
  byId('know-never').addEventListener('click', () => {
    knowledgeView.filter.neverUsed = !knowledgeView.filter.neverUsed
    drawKnowledge()
  })
  byId('health-retry').addEventListener('click', () => void loadHealthReport())
}

// ---- Header and footer ----

let owners: Owner[] = []

async function loadHealth() {
  const health = await readJson<Health>(await api('/api/health'))
  owners = health.owners ?? []
  useOwners(owners.map(row => row.owner))
  setEmbeddings(health.embeddings === true)
  const projects = owners.length
  byId('summary').textContent = `${health.total} ${health.total === 1 ? 'memory' : 'memories'} · ${projects} ${projects === 1 ? 'project' : 'projects'}`
  // The plugin version beside the engine's, on every tab (the footer with the rest is on Health).
  byId('engine').textContent = [health.plugin ? `v${health.plugin}` : '', health.engine ? `engine ${health.engine}` : ''].filter(Boolean).join(' · ')
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
  if (health.plugin) fact('Version', `Mnemosyne v${health.plugin}`)
  fact('Store', health.store)
  fact('Server', `running, process ${health.pid}`)
  fact('Activity log', health.activity ? 'on' : 'off')
  if (health.note) fact('Note', health.note)
  if (health.dev) fact('Mode', 'dev: reloads when ui/ changes')
  byId('foot').hidden = false
  if (health.dev) watchDev()
}

// Dev mode: ask for the stamp of ui/ every second and reload when it changes (a restart under --watch changes it too).
let devTimer: ReturnType<typeof setInterval> | 0 = 0
function watchDev() {
  if (devTimer !== 0) return
  let seen = ''
  devTimer = setInterval(async () => {
    try {
      const { stamp } = await readJson<{ stamp: string }>(await api('/api/dev-stamp'))
      if (seen !== '' && stamp !== seen) location.reload()
      seen = stamp
    } catch {
      // the server is restarting: the next tick tries again
    }
  }, 1000)
}

// ---- Memories ----

const memories = { selected: '' as string, rows: [] as Memory[], timer: 0 as ReturnType<typeof setTimeout> | 0, tag: '' }

/** Filters the table to one tag ('' clears it), and shows which. */
function setTagFilter(tag: string) {
  memories.tag = tag
  const button = byId('mem-tag')
  button.hidden = tag === ''
  button.textContent = tag === '' ? '' : `Tag: ${tag} ×`
  button.title = tag === '' ? '' : `Showing only memories tagged ${tag}. Press to show all.`
  button.setAttribute('aria-label', tag === '' ? 'Clear tag filter' : `Clear tag filter: ${tag}`)
  void loadMemories()
}

async function loadMemories() {
  const params = new URLSearchParams()
  const owner = byId<HTMLSelectElement>('mem-owner').value
  const sort = byId<HTMLSelectElement>('mem-sort').value
  const q = byId<HTMLInputElement>('mem-filter').value.trim()
  if (owner) params.set('owner', owner)
  params.set('sort', sort)
  if (q) params.set('q', q)
  if (memories.tag) params.set('tag', memories.tag)
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
  body.replaceChildren(...memories.rows.map(memory => memoryRow(memory, id => void openMemory(id), setTagFilter)))
  markSelected()
}

function markSelected() {
  for (const row of byId('mem-rows').querySelectorAll<HTMLTableRowElement>('tr.row')) {
    row.classList.toggle('is-selected', row.dataset.id === memories.selected)
    row.setAttribute('aria-selected', String(row.dataset.id === memories.selected))
  }
}

/** Opens one memory in the bottom sheet: the sheet comes up at once, with the memory filled in when it arrives. */
async function openMemory(id: string, from?: HTMLElement) {
  memories.selected = id
  markSelected()
  // Focus goes back on close to the element that opened it (Knowledge, Search), else the
  // Memories row (looked up then: the rows get redrawn).
  const sheet = {
    title: 'Memory',
    returnFocus: from ?? (() => [...byId('mem-rows').querySelectorAll<HTMLElement>('tr.row')].find(row => row.dataset.id === id) ?? null),
    onClose: () => {
      if (memories.selected === id) memories.selected = ''
      markSelected()
    },
  }
  openSheet({ ...sheet, body: el('p', 'Loading…', 'muted') })
  try {
    const response = await api(`/api/memories/${encodeURIComponent(id)}`)
    // Another memory was picked, or the tab changed, while this one loaded.
    if (memories.selected !== id) return
    if (response.status === 404) {
      memories.selected = ''
      closeSheet()
      setStatus('That memory is gone.', 'error')
      return
    }
    const memory = await readJson<Memory & { error?: string }>(response)
    if (!response.ok) throw new Error(memory.error ?? `the server answered ${response.status}`)
    if (memories.selected !== id) return
    openSheet({ ...sheet, body: memoryDetail(memory, forgetMemory, pickTagFromSheet) })
  } catch (err) {
    if (memories.selected === id) closeSheet()
    if (!(err instanceof Expired)) setStatus(`Could not open the memory: ${failure(err)}`, 'error')
  }
}

/** The memory panel's Forget: the shared guarded forget. */
export const forgetMemory = (memory: Memory, done: (error?: string) => void) => forgetById(memory.id, done)

/** A tag in the sheet: the Memories list filtered by it, from whichever tab the sheet is on. */
function pickTagFromSheet(tag: string) {
  if (current !== 'memories') show('memories')
  setTagFilter(tag)
}

function wireMemories() {
  byId('mem-owner').addEventListener('change', () => void loadMemories())
  byId('mem-sort').addEventListener('change', () => void loadMemories())
  byId('mem-tag').addEventListener('click', () => setTagFilter(''))
  byId('mem-filter').addEventListener('input', () => {
    if (memories.timer) clearTimeout(memories.timer)
    memories.timer = setTimeout(() => void loadMemories(), 250)
  })
  wireSheet()
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

/** The Activity filters; they combine: a line must pass all three. */
export type FeedFilter = { action: string; app: string; session: string }

export const newFilter = (): FeedFilter => ({ action: 'all', app: 'all', session: '' })

/** Whether a line passes the action chip ('all', 'external' or an action), the App drop-down ('all' or an app) and the clicked session ('' for any). */
export function showLine(line: ActivityLine, filter: FeedFilter): boolean {
  if (filter.action === 'external' ? line.origin !== 'external' : filter.action !== 'all' && line.action !== filter.action) return false
  if (filter.app !== 'all' && appKey(line) !== filter.app) return false
  return filter.session === '' || textOf(line.session) === filter.session
}

const FIXED_APPS = ['Claude Code', 'Codex', 'Cursor', 'Dashboard']

/** The App drop-down's values (appKey): the four fixed apps, then any other client seen (and the one picked), by name. */
export function appOptions(lines: readonly ActivityLine[], picked = 'all'): string[] {
  const others = new Set<string>()
  for (const key of [...lines.map(appKey), picked]) if (key !== '' && key !== 'all' && !FIXED_APPS.includes(key)) others.add(key)
  const name = (key: string) => key.replace(/^ext:/, '')
  return [...FIXED_APPS, ...[...others].sort((a, b) => name(a).localeCompare(name(b)))]
}

/** An outside client that calls itself like one of the fixed apps (a client named "Dashboard") is told apart by this suffix. */
export function externalName(name: string): string {
  return FIXED_APPS.some(fixed => fixed.toLowerCase() === name.toLowerCase()) ? `${name} (external)` : name
}

/** The words an App drop-down value shows. */
export const appName = (key: string) => (key.startsWith('ext:') ? externalName(key.slice(4)) : key)

export const feed = newFeed()
export const feedView = { filter: newFilter(), started: false, live: 'Connecting', apps: '', open: '' }

const isToday = (t: string | undefined) => day(t) === day(new Date().toISOString())

/** Picks one session ('' clears it): the chip shows it and the list narrows to it. */
function setSessionFilter(session: string) {
  feedView.filter.session = session
  const chip = byId('act-session')
  chip.hidden = session === ''
  chip.textContent = session === '' ? '' : `Showing one session (${shortSession(session)}) · Show all`
  chip.title = session === '' ? '' : 'Showing only this session. Press to show all.'
  chip.setAttribute('aria-label', session === '' ? 'Clear session filter' : `Clear session filter: ${shortSession(session)}`)
  drawFeed()
}

/** Keeps the App drop-down's entries current without resetting it while the stream adds lines. */
function drawApps() {
  const names = appOptions(feed.lines, feedView.filter.app)
  const key = names.join('\n')
  if (key === feedView.apps) return
  feedView.apps = key
  const select = byId<HTMLSelectElement>('act-app')
  const all = el('option', 'All')
  all.value = 'all'
  select.replaceChildren(
    all,
    ...names.map(name => {
      const option = el('option', appName(name))
      option.value = name
      return option
    }),
  )
  select.value = feedView.filter.app
}

export function drawFeed() {
  const today = feed.lines.filter(line => isToday(line.t))
  const count = (test: (line: ActivityLine) => boolean) => String(today.filter(test).length)
  // Claude's recalls only (ui/recalls.ts, the same rule as the Health tab): a dashboard search or another app's recall is not one.
  byId('tile-recall').textContent = count(isClaudeRecall)
  byId('tile-remember').textContent = count(line => line.action === 'remember' && line.ok !== false)
  byId('tile-update').textContent = count(line => line.action === 'update' && line.ok !== false)
  byId('tile-failed').textContent = count(line => line.ok === false)
  drawApps()
  const list = feed.lines.filter(line => showLine(line, feedView.filter)).slice(0, FEED_SHOW)
  const none = feed.lines.length > 0 ? 'No activity matches these filters.' : 'No activity yet.'
  const ctx = (line: ActivityLine): ActivityCtx => {
    const key = lineKey(line)
    return { expanded: feedView.open === key, toggle: () => toggleRow(key), preview: id => previews.get(id), open: openInMemories }
  }
  byId('act-list').replaceChildren(...(list.length > 0 ? list.map(line => activityItem(line, setSessionFilter, ctx(line))) : [el('li', none, 'event empty muted')]))
  void wantPreviews(list)
}

/** Opens a row's detail line (one at a time) or closes it, and gives the row the focus again after the redraw. */
function toggleRow(key: string) {
  feedView.open = feedView.open === key ? '' : key
  drawFeed()
  const row = Array.from(byId('act-list').children).find(child => (child as HTMLElement).dataset?.key === key)
  ;(row as HTMLElement | undefined)?.focus?.()
}

// The first line of the memory an older learn line points to (the log kept no text for it), by memory id; '' when it is gone.
const previews = new Map<string, string>()
const PREVIEW_BATCH = 20

/** Fetches the previews the shown learn lines miss, a small batch at a time, and redraws once when any arrived. */
async function wantPreviews(lines: readonly ActivityLine[]) {
  const ids: string[] = []
  for (const line of lines) {
    const id = (line.ids ?? [])[0]
    if (line.action === 'extract' && !textOf(line.text) && typeof id === 'string' && !previews.has(id) && !ids.includes(id)) ids.push(id)
    if (ids.length >= PREVIEW_BATCH) break
  }
  if (ids.length === 0) return
  // Marked at once, so the redraw that follows does not ask again; a failure stays '' and shows the short id.
  for (const id of ids) previews.set(id, '')
  let found = false
  await Promise.all(
    ids.map(async id => {
      try {
        const response = await api(`/api/memories/${encodeURIComponent(id)}`)
        if (!response.ok) return
        const memory = await readJson<Memory>(response)
        const text = firstLine(textOf(memory.content) || textOf(memory.preview), 120)
        if (text !== '') {
          previews.set(id, text)
          found = true
        }
      } catch {
        // The short id stays on the line.
      }
    }),
  )
  if (found && current === 'activity') drawFeed()
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

// ---- The one activity stream, shared by the Activity tab and the Map tab ----

/** How many delivered lines a reader remembers to recognise a replay. */
const REPLAY_KEEP = 20_000

/**
 * Drops the lines a reconnect sends again. The shared reader restarts from the cursor it
 * began at, so after a drop it first repeats what this page already took in: `reconnecting()`
 * starts the comparison and `accept()` skips each repeated line, then lets the first new one through.
 */
export function replayFilter() {
  const seen: string[] = []
  let at = -1
  return {
    reconnecting() {
      at = 0
    },
    accept(line: Record<string, unknown>): boolean {
      const key = JSON.stringify(line)
      if (at >= 0) {
        if (at < seen.length && seen[at] === key) {
          at++
          return false
        }
        at = -1
      }
      if (seen.length < REPLAY_KEEP) seen.push(key)
      return true
    },
  }
}

/**
 * The page's one stream: `prepare` runs once, when the first tab needs lines, and answers the cursor to follow
 * from (the Activity tab reads its history there); then ONE createStream reader serves every subscriber.
 */
export function shareStream(api: StreamApi, prepare: () => Promise<string>) {
  const listeners = new Set<StreamListener>()
  const watchers = new Set<(status: StreamStatus) => void>()
  let handle: StreamHandle | null = null
  let starting: Promise<StreamHandle> | null = null
  const ensure = () =>
    (starting ??= prepare()
      .catch(() => '')
      .then(cursor => {
        const reader = createStream({ api, cursor })
        const filter = replayFilter()
        reader.onStatus(status => {
          if (status === 'reconnecting') filter.reconnecting()
          for (const watcher of watchers) watcher(status)
        })
        reader.subscribe(line => {
          if (!filter.accept(line)) return
          for (const listener of listeners) listener(line)
        })
        handle = reader
        return reader
      }))
  return {
    /** Every new line goes to the listener; returns the way to stop. */
    subscribe(listener: StreamListener) {
      listeners.add(listener)
      void ensure()
      return () => void listeners.delete(listener)
    },
    onStatus(watcher: (status: StreamStatus) => void) {
      watchers.add(watcher)
      if (handle !== null) watcher(handle.status())
      return () => void watchers.delete(watcher)
    },
    /** The reader once it exists (a spec counts its polls). */
    reader: () => handle,
  }
}

const LIVE_WORDS: Record<StreamStatus, string> = { idle: 'Connecting', connecting: 'Connecting', live: 'Live', off: 'Log off', reconnecting: 'Reconnecting', expired: 'Connecting' }

// The reader calls api() for the token; a link that stopped working ends it quietly (api() has already said so).
const streamApi: StreamApi = async (path, init) => {
  if (expired) return new Response(null, { status: 401 })
  try {
    return await api(path, init)
  } catch (err) {
    if (err instanceof Expired) return new Response(null, { status: 401 })
    throw err
  }
}

const events = shareStream(streamApi, async () => {
  try {
    await loadActivity()
  } catch (err) {
    if (!(err instanceof Expired)) setStatus(`Could not load the activity log: ${failure(err)}`, 'error')
  }
  return feed.cursor
})

let eventsWired = false
let feedDirty = false
let drawQueued = false

// Lines of one chunk are drawn once, after the whole chunk is in; a hidden tab draws when it is shown.
function scheduleDraw() {
  if (drawQueued) return
  drawQueued = true
  queueMicrotask(() => {
    drawQueued = false
    if (current === 'activity') drawFeed()
    else feedDirty = true
  })
}

/** Starts the shared stream for the first tab that needs it, with the Activity feed listening from the first line. */
function useEvents() {
  if (!eventsWired) {
    eventsWired = true
    events.onStatus(status => setLive(LIVE_WORDS[status]))
    events.subscribe(line => {
      if (feedAdd(feed, [line as ActivityLine])) scheduleDraw()
    })
  }
  return events
}

function startActivity() {
  if (feedView.started) return
  feedView.started = true
  useEvents()
}

export function wireActivity() {
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
      feedView.filter.action = button.dataset.filter ?? 'all'
      for (const other of filters.querySelectorAll<HTMLButtonElement>('button[data-filter]')) other.setAttribute('aria-pressed', String(other === button))
      drawFeed()
    })
  }
  byId<HTMLSelectElement>('act-app').addEventListener('change', event => {
    feedView.filter.app = (event.target as HTMLSelectElement).value || 'all'
    drawFeed()
  })
  byId('act-session').addEventListener('click', () => setSessionFilter(''))
}

// ---- Search: one at a time ----

const SEARCH_TIMEOUT_MS = 60_000
let searching: AbortController | null = null

// The match mode: the server's capability (from /api/health, refreshed by each search reply),
// the choice (remembered in this browser) and the hits of the last search, shown SHOW_FIRST at a time.
let embeddingsOn = false
let searchMode: SearchMode = 'keyword'
let searchHits: Hit[] = []
let searchShown = 0
let searchQuery = ''

function prefStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

// The two Match by buttons: the chosen one pressed; Keyword + meaning disabled while embeddings are off.
function drawMode() {
  for (const button of byId('search-mode').querySelectorAll<HTMLButtonElement>('.seg-btn')) {
    const hybrid = button.dataset.mode === 'hybrid'
    button.setAttribute('aria-pressed', String(button.dataset.mode === searchMode))
    button.disabled = hybrid && !embeddingsOn
    button.title = hybrid && !embeddingsOn ? MEANING_OFF_HINT : ''
  }
}

// Called with /api/health and with each search reply. The mode is picked again only when the capability is first
// learned or changes (off forces keyword); otherwise the choice made on the page stands.
let embeddingsKnown = false
function setEmbeddings(on: boolean) {
  const picked = !embeddingsKnown || on !== embeddingsOn
  embeddingsKnown = true
  embeddingsOn = on
  if (picked) searchMode = chooseMode(readMode(prefStorage()), on)
  if (document.getElementById('search-mode') !== null) drawMode()
}

// The first SHOW_FIRST hits, then SHOW_FIRST more for each press of Show more.
function drawHits(more: boolean) {
  const results = byId('search-results')
  // A hit opens in the bottom sheet, on this tab.
  const open = (id: string, from?: HTMLElement) => void openMemory(id, from)
  const from = more ? searchShown : 0
  searchShown = Math.min(searchHits.length, more ? searchShown + SHOW_FIRST : SHOW_FIRST)
  const rows = searchHits.slice(from, searchShown).map((hit, i) => searchHit(hit, from + i + 1, searchQuery, open))
  if (more) results.append(...rows)
  else results.replaceChildren(...rows)
  byId('search-more').hidden = searchShown >= searchHits.length
}

function wireSearch() {
  const form = byId<HTMLFormElement>('search-form')
  form.addEventListener('submit', event => {
    event.preventDefault()
    void runSearch()
  })
  for (const button of byId('search-mode').querySelectorAll<HTMLButtonElement>('.seg-btn')) {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode
      if (mode !== 'keyword' && mode !== 'hybrid') return
      if (mode === 'hybrid' && !embeddingsOn) return
      searchMode = mode
      saveMode(prefStorage(), mode)
      drawMode()
    })
  }
  byId('search-more').addEventListener('click', () => {
    drawHits(true)
    const total = searchHits.length
    byId('search-note').textContent = countNote(searchShown, total, noteMode, noteSkipped)
  })
  drawMode()
}

// The mode and skipped count of the last reply, for the note that Show more rewrites.
let noteMode: string | undefined
let noteSkipped = 0

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
    const response = await api('/api/search', { method: 'POST', body: { query, ...(owner ? { owner } : {}), mode: searchMode }, signal: controller.signal })
    const body = await readJson<{ results?: Hit[]; skipped?: number; mode?: string; embeddings?: boolean; error?: string }>(response)
    if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`)
    if (typeof body.embeddings === 'boolean') setEmbeddings(body.embeddings)
    searchHits = body.results ?? []
    searchQuery = query
    noteMode = body.mode
    noteSkipped = body.skipped ?? 0
    drawHits(false)
    note.textContent = countNote(searchShown, searchHits.length, noteMode, noteSkipped)
  } catch (err) {
    if (err instanceof Expired) return
    searchHits = []
    searchShown = 0
    byId('search-more').hidden = true
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
  // The theme first, so the page is not drawn in the wrong colours while it loads.
  startTheme(byId('theme'), document.documentElement, (() => {
    try {
      return typeof localStorage === 'undefined' ? undefined : localStorage
    } catch {
      return undefined
    }
  })())
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
  setStatus(CONNECTED, 'ok')
  wireMemories()
  wireActivity()
  wireSearch()
  wireKnowledgeHealth()
  wireInspectorReveal()
  show(current)
}

if (typeof document !== 'undefined' && typeof location !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void main())
  else void main()
}
