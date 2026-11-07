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
import {
  columnsOf,
  dotClass,
  extractionState,
  groupedRows,
  groupRows,
  hasStatus,
  itemHead,
  kindCount,
  KINDS as KNOWLEDGE_KINDS,
  kindTabs,
  kpiTiles,
  NO_FILTER,
  notice as knowledgeNotice,
  ownerColour,
  ownerColours,
  ownersOf,
  parseKnowledge,
  quickCounts,
  rowsOf,
  sourcePanel,
  STALE_DAYS,
  stateOf,
  tableRows,
  topTopics,
  total as knowledgeTotal,
  withState,
  type KnowledgeData,
  type KnowledgeFilter,
  type KnowledgeHost,
  type KnowledgeKind,
  type KnowledgeSort,
  type QuickState,
} from './knowledge'
import { chartBars, chartText, coverageRows, dayBars, kpiTiles as healthKpiTiles, parseHealth, projectRows as healthProjectRows, storageList, storageSummary, tableFilterButtons, type HealthData, type HealthHost, type TableFilter } from './health'
import { candidateRow, filterButtons, liveRows, nearPartner, notLiveRow, parseQueue, parseReview, queueText, reviewCounts, reviewList, reviewRow, reviewText, type Queue, type ReviewData, type ReviewFilter, type ReviewHost, type RowFilter } from './review'
import { buildForm, type FormMemory } from './form'
import { candidateList, parseVocabulary, tagGroups, vocabularyText, type VocabData } from './vocabulary'
import { isClaudeRecall } from './recalls'
import { startTheme, type ThemeMode } from './theme'
import { drawGroups, drawTop, newView, parseSettings, type BrowserPrefs, type SettingsData, type SettingsHost } from './settings'
import { closeSheet, openSheet, wireSheet } from './sheet'
import {
  chooseMode,
  countFacet,
  countNote,
  facetValue,
  matchedWords,
  matchLabel,
  MEANING_OFF_HINT,
  pushRecent,
  readMode,
  readRecent,
  resultHead,
  ringClass,
  ringText,
  saveMode,
  SHOW_FIRST,
  sortHits,
  WEAK_SCORE,
  type HitFacet,
  type HitSort,
  type SearchMode,
} from './search-mode'
import { createWatch, type ProbeResult } from './connection'
import { createStream, type StreamApi, type StreamHandle, type StreamListener, type StreamStatus } from './stream'

const TOKEN_KEY = 'mnemosyne.token'
const VIEWS = ['map', 'memories', 'activity', 'search', 'knowledge', 'review', 'health', 'vocabulary', 'settings'] as const
type View = (typeof VIEWS)[number]
const VIEW_NAMES: Record<View, string> = { map: 'Map', memories: 'Memories', activity: 'Activity', search: 'Search', knowledge: 'Knowledge', review: 'Review', health: 'Health', vocabulary: 'Vocabulary', settings: 'Settings' }
const FEED_KEEP = 1000
const FEED_SHOW = 300
const CONNECTED = 'Connected to the local Mnemosyne server.'
export const LOST = 'The Mnemosyne server has stopped (its Claude session ended). Run /mnemosyne-ui in Claude Code to start it again.'

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
  /** live, retired, expired or lapsed; an older server sends none, which reads as live. */
  state?: string
  /** The kind (the engine's memory_type) and the expiry date, on the single-memory reply. */
  memory_type?: string | null
  valid_until?: string | null
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A saved time, short: HH:MM today, "19 Oct" this year, else YYYY-MM-DD; '' when there is none. */
export function savedLabel(value: string | null | undefined, now = new Date()): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  if (day(value) === day(now.toISOString())) return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.getFullYear() === now.getFullYear()) return `${date.getDate()} ${MONTHS[date.getMonth()]}`
  return day(value)
}

/** A day group's heading: Today, Yesterday, else "19 Oct 2026". */
export function dayHeading(value: string | null | undefined, now = new Date()): string {
  const key = day(value)
  if (!key) return 'No date'
  if (key === day(now.toISOString())) return 'Today'
  if (key === day(new Date(now.getTime() - 86_400_000).toISOString())) return 'Yesterday'
  return longDay(value)
}

/** A date as "6 Nov 2026"; '' when there is none. */
export function longDay(value: string | null | undefined): string {
  const date = new Date(value ?? '')
  return Number.isNaN(date.getTime()) ? '' : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
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
    case 'retire':
      return 'retired'
    case 'restore':
      return 'restored'
    case 'import':
      return `${line.count ?? 0} saved`
    case 'expire':
      return `${line.count ?? 0} expired`
    case 'stats':
      return 'stats'
    default:
      return ''
  }
}

/** An action in words: 'rearm' shows as 're-arm', 'extract' (knowledge learned from a save) as 'learn'. */
export const actionLabel = (action: string | undefined) => (action === 'rearm' ? 're-arm' : action === 'extract' ? 'learn' : (action ?? ''))

// The bar's width, in twentieths (style.css has .w0 … .w20).

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

/** A project's name with its colour dot; `label` stands for a group of projects (grey). The class `own` makes it a chip (G1): global is gold. */
export function project(owner: string | undefined, className = 'project', label?: string) {
  const span = el('span', undefined, owner === 'global' && !label && className.includes('own') ? `${className} is-global` : className)
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

/** True for a memory that is retired, expired or lapsed; an older server sends no state, which is live. */
export const isGone = (memory: Pick<Memory, 'state'>) => memory.state !== undefined && memory.state !== 'live'

/** The kinds the engine writes (memory_type); anything else shows as unknown. */
export const KINDS = ['fact', 'decision', 'preference', 'instruction', 'context', 'event', 'error', 'artifact', 'relation'] as const

/** A kind's name as the page shows it: a known kind, else 'unknown'. */
export const kindOf = (kind: string | null | undefined): string => ((KINDS as readonly string[]).includes(kind ?? '') ? (kind as string) : 'unknown')

/** A kind glyph (G2): its shape alone tells the kind (a CSS mask, in the text colour); the name is its label. */
export function kindGlyph(kind: string | null | undefined) {
  const name = kindOf(kind)
  const glyph = el('span', undefined, `kg k-${name}`)
  glyph.title = name
  glyph.setAttribute('role', 'img')
  glyph.setAttribute('aria-label', name)
  return glyph
}

/**
 * How far a memory reaches, as the map draws it: `all` (the global owner: every project reads it), `shared` (a
 * project's memory with global scope: every project can recall it) or `project` (its own project only).
 */
export type Reach = 'all' | 'shared' | 'project'
export function reachOf(memory: Pick<Memory, 'owner' | 'scope'>): Reach {
  if (memory.owner === 'global') return 'all'
  return memory.scope === 'global' ? 'shared' : 'project'
}

export const REACH_WORD: Record<Reach, string> = { all: 'all', shared: 'shared', project: 'project' }
export const REACH_HELP: Record<Reach, string> = {
  all: 'A global memory: every project reads it. On the map it circles the sun.',
  shared: 'Lives in its project and is recalled in every project. On the map it is a probe on the dashed blue ring.',
  project: 'Recalled only in its own project.',
}

/** The reach marker (G3): a gold dot for all, a dashed blue ring for shared, a plain ring for project; with its word. */
export function reachMark(reach: Reach) {
  const mark = el('span', undefined, `reach r-${reach}`)
  mark.title = REACH_HELP[reach]
  mark.append(el('span', undefined, 'reach-dot'), el('span', REACH_WORD[reach]))
  return mark
}

/** Importance as five pips (0 to 5 lit); unknown reads as none lit, with a tooltip saying so. */
export function importancePips(importance: number | null | undefined) {
  const known = typeof importance === 'number' && Number.isFinite(importance)
  const lit = known ? Math.max(0, Math.min(5, Math.round(importance * 5))) : 0
  const pips = el('span', undefined, `imp i${lit}`)
  pips.title = known ? `Importance ${importance.toFixed(2)}` : 'Importance unknown'
  for (let i = 0; i < 5; i++) pips.append(el('span'))
  return pips
}

/** A recall count's bar width, 1 to 5, log-scaled so 2 and 200 both read. */
export const recallWidth = (count: number) => Math.max(1, Math.min(5, Math.ceil(Math.log2(count + 1) / 1.4)))

/** A memory's first line split at its lead: the words up to a colon in the first 80 characters. */
export function leadOf(text: string): { lead: string; rest: string } {
  const at = text.indexOf(':')
  if (at <= 0 || at > 80 || text.slice(0, at).includes('\n')) return { lead: '', rest: text }
  return { lead: text.slice(0, at + 1), rest: text.slice(at + 1) }
}

/** At most this many tags show under a row's text, then "+n". */
export const ROW_TAGS = 3

/** One row of the Memories table: glyph, text over its tags, owner chip, reach, importance, recalls, saved. */
export function memoryRow(memory: Memory, open: (id: string) => void, pickTag?: (tag: string) => void) {
  const gone = isGone(memory)
  const row = el('tr', undefined, gone ? 'row is-dim' : 'row')
  row.tabIndex = 0
  row.dataset.id = memory.id
  const kind = el('td', undefined, 'g-col')
  kind.append(kindGlyph(memory.memory_type))
  const text = el('td', undefined, 'mem-cell')
  // One line (the CSS ends it in an ellipsis), the lead in bold; the id and the full text are in the sheet.
  const shown = memory.preview ?? memory.content ?? ''
  const full = memory.truncated === true && !shown.endsWith('…') ? `${shown}…` : shown
  const line = el('div', undefined, 'l1')
  // A memory that is not live (retired, expired or lapsed) says so, in words, in front of its text.
  if (gone) line.append(el('span', `${memory.state} `, `state-mark is-${memory.state}`))
  const { lead, rest } = leadOf(full.replace(/\s+/g, ' '))
  const words = el('span', undefined, 'row-text')
  if (lead) words.append(el('span', lead, 'lead'))
  words.append(el('span', rest))
  line.append(words)
  text.append(line)
  const tags = tagsOfMemory(memory)
  if (tags.length > 0) {
    const under = el('div', undefined, 'l2')
    under.append(chips(tags.slice(0, ROW_TAGS), pickTag))
    if (tags.length > ROW_TAGS) under.append(el('span', `+${tags.length - ROW_TAGS}`, 'tag-more'))
    text.append(under)
  }
  const owner = el('td', undefined, 'nowrap')
  owner.append(project(memory.owner, 'project own'))
  const reach = el('td', undefined, 'nowrap')
  reach.append(reachMark(reachOf(memory)))
  const imp = el('td')
  imp.append(importancePips(memory.importance))
  // Recalls: "never" (muted) for 0, else a log-scaled bar and the count; the tooltip says when it was last recalled.
  const recalls = memory.recall_count ?? 0
  const recalled = el('td', undefined, recalls === 0 ? 'num rc muted' : 'num rc mono')
  if (recalls === 0) recalled.textContent = 'never'
  else {
    const bar = el('span', undefined, 'rc-bar')
    bar.append(el('span', undefined, `w${recallWidth(recalls)}`))
    recalled.append(bar, el('span', String(recalls)))
  }
  recalled.title = `Last recalled: ${day(memory.last_recalled) || 'never'}`
  const saved = el('td', savedLabel(memory.timestamp), 'num muted nowrap')
  saved.title = memory.timestamp ?? ''
  row.append(kind, text, owner, reach, imp, recalled, saved)
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
export function memoryDetail(memory: Memory, forget: (memory: Memory, done: (error?: string) => void) => void, pickTag?: (tag: string) => void, edit?: (memory: Memory) => void) {
  const panel = el('div', undefined, 'detail-body')
  const head = el('div', undefined, 'detail-head')
  const reach = reachOf(memory)
  head.append(kindGlyph(memory.memory_type), el('span', kindOf(memory.memory_type), 'detail-kind'), project(memory.owner, 'project own'), reachMark(reach), el('span', memory.id, 'mono muted push-right'))
  const content = memory.content ?? memory.preview ?? ''
  // Four numbers at a glance; the full list of facts stays beside it.
  const stats = el('div', undefined, 'stats')
  const stat = (label: string, value: string, note = '') => {
    const cell = el('div', undefined, 'stat')
    cell.append(el('span', label, 'stat-label'), el('span', value, 'stat-value'))
    if (note) cell.append(el('span', note, 'stat-note'))
    stats.append(cell)
  }
  const known = typeof memory.importance === 'number' && Number.isFinite(memory.importance)
  stat('Importance', known ? (memory.importance as number).toFixed(2) : '–', 'of 1')
  stat('Recalls', String(memory.recall_count ?? 0), day(memory.last_recalled) || 'never')
  stat('Saved', savedLabel(memory.timestamp) || 'unknown')
  stat('State', memory.state ?? 'live')
  const explain = el('p', undefined, `reach-note r-${reach}`)
  explain.append(el('span', reach === 'all' ? 'Global. ' : reach === 'shared' ? `Shared from ${ownerName(memory.owner)}. ` : `Only in ${ownerName(memory.owner)}. `, 'lead'), el('span', REACH_HELP[reach]))
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
  if (isGone(memory)) fact('State', memory.state ?? '')
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

  // Edit opens the form in this sheet; Forget stays here and nowhere else.
  const editor = el('div', undefined, 'detail-edit')
  if (edit !== undefined) {
    const change = el('button', 'Edit', 'btn')
    change.type = 'button'
    change.addEventListener('click', () => edit(memory))
    editor.append(change)
  }

  // Two columns on a wide screen: the memory itself on the left, what is known about it on the right.
  const main = el('div', undefined, 'detail-main')
  main.append(head, el('p', content, 'detail-text'), stats)
  const side = el('div', undefined, 'detail-side')
  side.append(explain, facts, tagBox, editor, danger)
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
  ui: 'ui: this dashboard (search, forget, save, retire or restore)',
  backfill: 'backfill: the one-time tagging run, /mnemosyne-tags',
  import: 'import: a document or a session log brought in through the save guard',
  session: 'session: the session summary or the expiry of unused memories, run by the plugin',
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
    case 'retire':
      return failed ? `Could not retire ${ids.map(shortSession).join(', ')}`.trim() : `Retired ${ids.map(shortSession).join(', ') || 'a memory'}`
    case 'restore':
      if (failed) return `Could not restore ${ids.map(shortSession).join(', ')}`.trim()
      return count === 0 ? `${ids.map(shortSession).join(', ') || 'The memory'} was already live; nothing to restore` : `Restored ${ids.map(shortSession).join(', ') || 'a memory'}`
    case 'import':
      if (failed) return text ? `Import had failures: ${text}` : 'Import had failures'
      return text || `Imported ${count} ${count === 1 ? 'memory' : 'memories'}`
    case 'expire':
      if (failed) return 'Could not expire unused memories'
      return count === 0 ? 'Checked for unused memories; none expired' : `Expired ${count} unused ${count === 1 ? 'memory' : 'memories'}`
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

/** The query words marked in `text`, appended to `into` as text and mark nodes. */
function appendMarked(into: HTMLElement, text: string, query: string) {
  for (const part of markParts(text, query)) into.append(part.mark ? el('mark', part.text) : document.createTextNode(part.text))
}

/** "6 Nov 2026 · never recalled" / "· 1 recall" / "· 14 recalls". */
export function hitWhen(hit: Pick<Memory, 'timestamp' | 'recall_count'>): string {
  const recalls = hit.recall_count > 0 ? `${hit.recall_count} ${hit.recall_count === 1 ? 'recall' : 'recalls'}` : 'never recalled'
  return [longDay(hit.timestamp), recalls].filter(Boolean).join(' · ')
}

/**
 * One Search hit (0.19.0): the rank over a score ring; a head with the kind, the owner chip, the reach, how it
 * matched, and the date and recalls; the text with its lead and the query words marked; a foot saying what matched,
 * the tags, Open and Map.
 */
export function searchHit(hit: Hit, rank: number, query: string, open: (id: string, from?: HTMLElement) => void, onMap?: (id: string) => void) {
  const item = el('li', undefined, 'hit sh')
  item.dataset.id = hit.id
  item.setAttribute('tabindex', '0')
  const side = el('div', undefined, 'sh-side')
  const ring = el('span', undefined, `ring ${ringClass(hit.score)}`)
  ring.title = `Score ${hit.score.toFixed(2)}`
  ring.append(el('span', ringText(hit.score), 'ring-n mono'))
  side.append(el('span', String(rank), 'sh-rank mono'), ring)
  const body = el('div', undefined, 'sh-body')
  const head = el('div', undefined, 'hit-head')
  const kind = kindOf(hit.memory_type)
  head.append(kindGlyph(hit.memory_type), el('span', kind === 'unknown' ? 'Memory' : kind[0]!.toUpperCase() + kind.slice(1), 'sh-kind'), project(hit.owner, 'project own'), reachMark(reachOf(hit)))
  const how = matchLabel(hit.matched)
  if (how !== '') head.append(el('span', how, `match-badge m-${hit.matched}`))
  head.append(el('span', hitWhen(hit), 'sh-when muted small'))
  const text = el('p', undefined, 'hit-text')
  const { lead, rest } = leadOf(hit.content)
  if (lead !== '') {
    const strong = el('span', undefined, 'lead')
    appendMarked(strong, lead, query)
    text.append(strong)
  }
  appendMarked(text, rest, query)
  if (hit.truncated) text.append(el('span', ' …', 'muted'))
  const foot = el('div', undefined, 'hit-foot')
  const words = matchedWords(hit.content, query)
  const why = el('span', undefined, 'sh-why muted small')
  if (words.length > 0) {
    why.append(document.createTextNode('Matched '))
    words.forEach((word, i) => {
      if (i > 0) why.append(document.createTextNode(', '))
      why.append(el('span', word, 'sh-word'))
    })
    if (hit.matched === 'both') why.append(document.createTextNode(' · and by meaning'))
  } else why.append(document.createTextNode(hit.matched === 'meaning' ? 'No word match; close in meaning' : 'Matched by keyword'))
  const openButton = el('button', 'Open', 'btn small')
  openButton.type = 'button'
  openButton.addEventListener('click', () => open(hit.id, openButton))
  foot.append(why, chips(tagsOfMemory(hit).slice(0, ROW_TAGS)))
  const actions = el('span', undefined, 'sh-actions')
  actions.append(openButton)
  if (onMap) {
    const mapButton = el('button', 'Map', 'btn small')
    mapButton.type = 'button'
    mapButton.title = 'Show this memory on the map'
    mapButton.addEventListener('click', () => onMap(hit.id))
    actions.append(mapButton)
  }
  foot.append(actions)
  // The whole card opens the memory too; its buttons keep their own job.
  item.addEventListener('click', event => {
    if ((event.target as HTMLElement | null)?.closest?.('button')) return
    open(hit.id, openButton)
  })
  body.append(head, text, foot)
  item.append(side, body)
  return item
}

// ---- The page ----

function byId<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`#${id} is missing from index.html`)
  return element as T
}

function setStatus(text: string, kind: 'ok' | 'error' | 'plain' = 'plain') {
  // While the server is gone the banner says so; no other message (Connected, Could not load…) replaces it. A link that no longer works (a new server) is the exception.
  if (watch.lost() && !expired && text !== LOST) return
  const status = byId('status')
  status.textContent = text
  status.className = kind === 'plain' ? 'status' : `status is-${kind}`
  // 0.17.0 shell: the standing "Connected" line is not shown (the connection pill says it); the lost and expired
  // messages are styled by kind (an amber strip; the expired card says the rest).
  status.hidden = text === CONNECTED
  status.dataset.kind = text === LOST ? 'lost' : expired ? 'expired' : kind
}

// ---- The connection pill and the lost strip (0.17.0) ----

/** The pill in the header: live (teal), lost (amber, reconnecting) or expired (a hollow red ring). */
function setConnection(state: 'live' | 'lost' | 'expired') {
  const pill = byId('conn')
  pill.dataset.state = state
  byId('conn-text').textContent = state === 'live' ? 'Local · live' : state === 'lost' ? 'Reconnecting…' : 'Link expired'
  // While lost, the tab's data is from before: it is dimmed, and the strip says when the page will ask again.
  for (const view of VIEWS) byId(`view-${view}`).classList.toggle('is-stale', state === 'lost')
  byId('lost-extra').hidden = state !== 'lost'
  if (state === 'lost') tickLost()
}

let lostTicking = false
/** The strip's countdown, every half second while lost (under a second, so it never looks like a back-off wait). */
function tickLost() {
  if (lostTicking) return
  lostTicking = true
  const step = () => {
    if (!watch.lost() || expired) {
      lostTicking = false
      return
    }
    const ms = watch.nextIn()
    byId('lost-next').textContent = ms === null ? 'Waiting for the server…' : ms === 0 ? 'Checking now…' : `Next check in ${Math.ceil(ms / 1000)} s.`
    setTimeout(step, 500)
  }
  step()
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
  // 0.17.0: the recovery card (two steps, a Copy button, what this means) and the pill in its expired state.
  setConnection('expired')
  byId('expired').hidden = false
}

type ApiInit = { method?: string; body?: unknown; signal?: AbortSignal }

/** An /api call with the token in the Authorization header; JSON bodies as JSON. A request that fails to reach the server makes the watch check on it. */
async function api(path: string, init: ApiInit = {}) {
  try {
    const response = await send(path, init)
    watch.reached()
    return response
  } catch (err) {
    if (!(err instanceof Expired) && !(err instanceof DOMException && err.name === 'AbortError')) watch.suspect()
    throw err
  }
}

async function send(path: string, init: ApiInit) {
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

/** A POST with the token: the status and the JSON body. Status 0 means the request never got an answer (the body then holds `error`). */
async function postJson(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  try {
    const response = await api(path, { method: 'POST', body })
    return { status: response.status, body: await readJson<unknown>(response) }
  } catch (err) {
    return { status: 0, body: { error: err instanceof Expired ? 'This link no longer works. Run /mnemosyne-ui again.' : `Could not reach the server: ${failure(err)}` } }
  }
}

// ---- The server going away ----

// The server stops with the Claude session that opened it. The watch asks /api/health when a request failed (and while the stream is
// reconnecting), then every 1 s doubling to 30 s until it answers; the banner and the Server line follow it.
const PROBE_TIMEOUT_MS = 5000
let serverPid: number | null = null
let serverLine: HTMLElement | null = null

/** The Server line of the status panel for the current state. */
function serverText(lost: boolean, pid: number | null) {
  return lost ? 'stopped (its Claude session ended)' : `running, process ${pid ?? '?'}`
}

const watch = createWatch({
  probe: async (): Promise<ProbeResult> => {
    try {
      // Any answer means the server is there; a 401 (api's Expired) means it came back as a new one.
      await send('/api/health', { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
      return 'up'
    } catch (err) {
      return err instanceof Expired ? 'expired' : 'down'
    }
  },
  onChange: lost => {
    if (expired) return
    if (serverLine !== null) serverLine.textContent = serverText(lost, serverPid)
    setConnection(lost ? 'lost' : 'live')
    if (lost) setStatus(LOST, 'error')
    else {
      // The first load never finished: the page is not wired yet, so it loads and wires now, and says Connected after.
      if (!booted) {
        void loadHealth().then(() => {
          setStatus(CONNECTED, 'ok')
          finishBoot()
        }, () => undefined)
        return
      }
      setStatus(CONNECTED, 'ok')
      // The tabs that showed "Could not load" read again; the Activity stream reconnects on its own back-off.
      void loadHealth().catch(() => undefined)
      if (current === 'memories') void loadMemories()
      if (current === 'knowledge') void loadKnowledge()
      if (current === 'review') void loadReview()
      if (current === 'vocabulary') void loadVocabulary()
      if (current === 'health') void loadHealthReport()
      if (current === 'settings') void loadSettings()
    }
  },
})

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
  // Knowledge, Review, Vocabulary and Health read fresh numbers every time they are opened.
  if (view === 'knowledge') void loadKnowledge()
  if (view === 'review') void loadReview()
  if (view === 'vocabulary') void loadVocabulary()
  if (view === 'health') void loadHealthReport()
  // Settings reads fresh values every time it opens, so a change made elsewhere shows.
  if (view === 'settings') void loadSettings()
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
function tabStatus(name: 'know' | 'review' | 'vocab' | 'health' | 'settings', text: string, error = false) {
  const line = byId(`${name}-status`)
  line.textContent = text
  line.className = error ? 'notice-line small is-error' : 'notice-line small muted'
  line.hidden = text === ''
  byId(`${name}-retry`).hidden = !error
}
// 0.20.0: the rows grouped by project › topic (the default) or flat, kept in this browser; the folded projects per
// kind (first seen: all but the first three folded); the item whose source panel is open, and the source memories read.
export type KnowledgeGroup = 'project' | 'flat'

/** A value for an attribute selector: CSS.escape where the page has it, else quotes and backslashes escaped. */
const cssValue = (value: string) => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&'))
const KNOW_GROUP_KEY = 'mnemosyne.knowledge.group'
const knowledgeUi = {
  group: 'project' as KnowledgeGroup,
  folded: new Map<KnowledgeKind, Set<string>>(),
  expanded: '',
  sources: new Map<string, Memory | null | 'loading' | 'error'>(),
}

function readKnowledgeGroup(): KnowledgeGroup {
  try {
    return prefStorage()?.getItem(KNOW_GROUP_KEY) === 'flat' ? 'flat' : 'project'
  } catch {
    return 'project'
  }
}

/** The source memory of an expanded row: read once, then from the cache; the panel redraws when it arrives. */
function knowledgeSource(id: string): Memory | null | 'loading' | 'error' {
  const known = knowledgeUi.sources.get(id)
  if (known !== undefined) return known
  knowledgeUi.sources.set(id, 'loading')
  void (async () => {
    try {
      const response = await api(`/api/memories/${encodeURIComponent(id)}`)
      knowledgeUi.sources.set(id, response.status === 404 ? null : response.ok ? await readJson<Memory>(response) : 'error')
    } catch (err) {
      if (err instanceof Expired) return
      knowledgeUi.sources.set(id, 'error')
    }
    if (current === 'knowledge') drawKnowledgeRows()
  })()
  return 'loading'
}

const knowledgeHost: KnowledgeHost & { reachOf: (owner: string, scope: string | null) => HTMLElement | null; saved: (value: string | null | undefined) => string } = {
  project: owner => project(owner, 'project own'),
  showOnMap,
  open: (id, row) => void openMemory(id, row),
  now: () => Date.now(),
  glyph: kind => kindGlyph(kind),
  reach: reach => reachMark(reach),
  reachOf: (owner, scope) => (owner === 'global' ? reachMark('all') : scope === 'global' ? reachMark('shared') : null),
  saved: value => longDay(value),
  toggle: id => {
    knowledgeUi.expanded = knowledgeUi.expanded === id ? '' : id
    drawKnowledgeRows()
    // Keep the keyboard on the row that was toggled.
    const row = byId('know-rows').querySelector?.<HTMLElement>(`tr.row[data-id="${cssValue(id)}"]`)
    row?.focus?.()
  },
  expanded: () => knowledgeUi.expanded,
  detail: row => {
    const data = knowledgeView.data!
    const source = knowledgeSource(row.memory)
    return sourcePanel(row, data, source, knowledgeHost, () => byId('know-rows').querySelector?.<HTMLElement>(`tr.row[data-id="${cssValue(row.id)}"]`) ?? undefined)
  },
}

/** The folded projects of the current kind; the first time, every group after the first three. */
function foldedOf(data: KnowledgeData): Set<string> {
  let set = knowledgeUi.folded.get(knowledgeView.kind)
  if (set === undefined) {
    const owners = groupRows(rowsOf(data, knowledgeView.kind, Date.now(), knowledgeView.filter)).map(group => group.owner)
    set = new Set(owners.slice(3))
    knowledgeUi.folded.set(knowledgeView.kind, set)
  }
  return set
}

/** The table body, the footer count and the empty state; the find box redraws only this, so it keeps focus. */
function drawKnowledgeRows() {
  const data = knowledgeView.data
  if (data === null) return
  const kind = knowledgeView.kind
  const filter = knowledgeView.filter
  const grouped = knowledgeUi.group === 'project'
  const rows = grouped
    ? groupedRows(data, kind, knowledgeHost, filter, foldedOf(data), owner => {
        const set = foldedOf(data)
        if (set.has(owner)) set.delete(owner)
        else set.add(owner)
        drawKnowledgeRows()
        byId('know-rows').querySelector?.<HTMLElement>(`tr.grp[data-owner="${cssValue(owner)}"]`)?.focus?.()
      })
    : tableRows(data, kind, knowledgeHost, filter)
  // A project picked that has nothing of this kind: say so, and offer its memories.
  const shown = rowsOf(data, kind, Date.now(), filter).length
  if (shown === 0 && filter.owner !== '' && data.items[kind].every(item => item.owner !== filter.owner)) {
    const card = el('div', undefined, 'know-empty')
    card.append(el('p', `Nothing mined yet for ${ownerName(filter.owner)}`, 'st-title'))
    card.append(el('p', `Knowledge is mined when a memory is saved. ${ownerName(filter.owner)} has no ${KINDS_OF[kind]} yet.`, 'muted small'))
    const go = el('button', `Show memories in ${ownerName(filter.owner)}`, 'btn small')
    go.type = 'button'
    go.addEventListener('click', () => {
      show('memories')
      byId<HTMLSelectElement>('mem-owner').value = filter.owner
      void loadMemories()
    })
    card.append(go)
    const tr = el('tr')
    const td = el('td')
    td.colSpan = columnsOf(kind)
    td.append(card)
    tr.append(td)
    byId('know-rows').replaceChildren(tr)
  } else byId('know-rows').replaceChildren(...rows)
  const table = byId('know-table')
  table.className = grouped ? 'table know-table kt-grouped' : 'table know-table'
  byId('know-topic-head').hidden = grouped
  byId('know-project-head').hidden = grouped
  const owners = new Set(rowsOf(data, kind, Date.now(), filter).map(row => row.owner)).size
  byId('know-foot').textContent = `${kindCount(kind, shown)} in ${owners} ${owners === 1 ? 'project' : 'projects'}${shown < data.items[kind].length ? ` (of ${data.items[kind].length})` : ''}`
  drawKnowledgeStates(data)
}

const KINDS_OF: Record<KnowledgeKind, string> = { fact: 'facts', preference: 'preferences', instruction: 'instructions', timeline: 'events', relation: 'relations' }

/** The All / Gone quiet / Never used control with counts under the other filters. */
function drawKnowledgeStates(data: KnowledgeData) {
  const counts = quickCounts(data.items[knowledgeView.kind], knowledgeView.filter, Date.now())
  const now = stateOf(knowledgeView.filter)
  const states: [QuickState, string, string][] = [
    ['all', 'All', 'Every item'],
    ['quiet', 'Gone quiet', `Items whose memory was recalled, but not in the last ${STALE_DAYS} days`],
    ['never', 'Never used', 'Items whose memory was never recalled'],
  ]
  byId('know-never').replaceChildren(
    ...states.map(([state, label, title]) => {
      const button = el('button', undefined, 'seg-btn')
      button.type = 'button'
      button.title = title
      button.setAttribute('aria-pressed', String(state === now))
      button.append(el('span', label), el('span', ` ${counts[state]}`, 'n'))
      button.addEventListener('click', () => {
        knowledgeView.filter = withState(knowledgeView.filter, state)
        knowledgeUi.expanded = ''
        drawKnowledgeRows()
      })
      return button
    }),
  )
}

/** The four tiles: items, recalled this week, gone quiet (amber), never used. */
function drawKnowledgeTiles(data: KnowledgeData) {
  const t = kpiTiles(data, Date.now())
  const tile = (label: string, value: string, words: string, help: string, className = '') => {
    const box = el('div', undefined, `kpi ${className}`.trim())
    box.append(el('div', label, 'kpi-label'))
    const line = el('div', undefined, 'kpi-line')
    line.append(el('span', value, 'kpi-n'), el('span', words, 'kpi-words'))
    box.append(line, el('div', help, 'kpi-help'))
    return box
  }
  byId('know-summary').replaceChildren(
    tile('Items', t.items, `from ${t.memories} ${t.memories === 1 ? 'memory' : 'memories'}`, t.perKind),
    tile('Recalled this week', String(t.week), 'items whose memory was recalled', 'In the last 7 days.'),
    tile('Gone quiet', String(t.quiet), `last used ${STALE_DAYS}+ days ago`, 'Recalled before, not lately.', t.quiet > 0 ? 'is-warn' : ''),
    tile('Never used', String(t.never), 'memory never recalled', 'Pick Never used to list them.'),
  )
}

/** The top topics of this kind (under the project filter) as chips; a click filters by that topic. */
function drawKnowledgeTopics(data: KnowledgeData) {
  const box = byId('know-topics')
  const topics = topTopics(data.items[knowledgeView.kind], knowledgeView.filter.owner)
  const picked = knowledgeView.filter.topic ?? ''
  if (topics.length === 0) {
    box.replaceChildren()
    return
  }
  const chip = (topic: string, count: number) => {
    const button = el('button', undefined, 'chip-btn facet')
    button.type = 'button'
    button.setAttribute('aria-pressed', String(topic === picked))
    button.append(el('span', topic), el('span', String(count), 'n'))
    button.addEventListener('click', () => {
      knowledgeView.filter.topic = picked === topic ? '' : topic
      drawKnowledgeTopics(data)
      drawKnowledgeRows()
    })
    return button
  }
  const shown = topics.slice(0, 7)
  // A topic picked from further down stays visible.
  if (picked !== '' && !shown.some(([topic]) => topic === picked)) {
    const at = topics.find(([topic]) => topic === picked)
    if (at) shown.push(at)
  }
  box.replaceChildren(
    el('span', 'Top topics', 'facet-label'),
    ...shown.map(([topic, count]) => chip(topic, count)),
    ...(topics.length > shown.length ? [el('span', `+ ${topics.length - shown.length} more (use Find)`, 'muted small')] : []),
  )
}

/** The Project › topic / Flat control. */
function drawKnowledgeGroup() {
  const choices: [KnowledgeGroup, string][] = [
    ['project', 'Project › topic'],
    ['flat', 'Flat'],
  ]
  byId('know-group').replaceChildren(
    ...choices.map(([group, label]) => {
      const button = el('button', label, 'seg-btn')
      button.type = 'button'
      button.setAttribute('aria-pressed', String(group === knowledgeUi.group))
      button.addEventListener('click', () => {
        knowledgeUi.group = group
        try {
          prefStorage()?.setItem(KNOW_GROUP_KEY, group)
        } catch {
          // storage is a convenience only
        }
        drawKnowledgeGroup()
        drawKnowledgeRows()
      })
      return button
    }),
  )
}

/** Switches the kind (tabs and keys 1 to 5). */
function pickKnowledgeKind(kind: KnowledgeKind) {
  knowledgeView.kind = kind
  knowledgeView.filter.topic = ''
  knowledgeUi.expanded = ''
  drawKnowledge()
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
  byId('know-tabs').replaceChildren(...kindTabs(data, knowledgeView.kind, pickKnowledgeKind, kind => kindGlyph(kind)))
  drawKnowledgeTiles(data)
  // The toolbar: the project select lists the owners present (the choice is kept while it is still there).
  const filter = knowledgeView.filter
  const ownerSelect = byId<HTMLSelectElement>('know-owner')
  const present = ownersOf(data)
  if (filter.owner !== '' && !present.includes(filter.owner)) filter.owner = ''
  ownerSelect.replaceChildren(Object.assign(el('option', 'All projects'), { value: '' }), ...present.map(owner => Object.assign(el('option', ownerName(owner)), { value: owner, title: owner })))
  ownerSelect.value = filter.owner
  byId<HTMLSelectElement>('know-sort').value = filter.sort
  byId<HTMLInputElement>('know-find').value = filter.text
  byId('know-item-head').textContent = itemHead(knowledgeView.kind)
  byId('know-status-head').hidden = !hasStatus(knowledgeView.kind)
  drawKnowledgeGroup()
  drawKnowledgeTopics(data)
  drawKnowledgeRows()
  byId('know-body').hidden = false
}

/** The tab's keys: 1 to 5 switch kind, `/` finds, J/K move over rows and groups, O opens the memory, M the map, Esc closes the source. */
export function knowledgeKey(event: KeyboardEvent) {
  if (current !== 'knowledge' || event.defaultPrevented || typing(event) || knowledgeView.data === null) return
  const key = event.key
  if (/^[1-5]$/.test(key)) {
    event.preventDefault()
    pickKnowledgeKind(KNOWLEDGE_KINDS[Number(key) - 1]!.kind)
    return
  }
  if (key === '/') {
    event.preventDefault()
    byId<HTMLInputElement>('know-find').focus()
    return
  }
  if (key === 'Escape' && knowledgeUi.expanded !== '') {
    const id = knowledgeUi.expanded
    knowledgeUi.expanded = ''
    drawKnowledgeRows()
    byId('know-rows').querySelector?.<HTMLElement>(`tr.row[data-id="${cssValue(id)}"]`)?.focus?.()
    return
  }
  const rows = [...byId('know-rows').querySelectorAll<HTMLElement>('tr.row, tr.grp')]
  if (rows.length === 0) return
  const at = rows.findIndex(row => row === document.activeElement)
  if (key === 'j' || key === 'J' || key === 'k' || key === 'K') {
    event.preventDefault()
    const next = key.toLowerCase() === 'j' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at === -1 ? 0 : at - 1)
    rows[next]!.focus()
    rows[next]!.scrollIntoView?.({ block: 'nearest' })
    return
  }
  const row = at === -1 ? undefined : rows[at]
  const item = row?.dataset.id ? KNOWLEDGE_KINDS.flatMap(({ kind }) => knowledgeView.data!.items[kind]).find(entry => entry.id === row.dataset.id) : undefined
  if (!item || item.memory === '') return
  if (key === 'o' || key === 'O') {
    event.preventDefault()
    void openMemory(item.memory, row)
  } else if (key === 'm' || key === 'M') {
    event.preventDefault()
    showOnMap(item.memory)
  }
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
        drawSearchAside()
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

// ---- Settings ----

const settingsView = newView()
let themeNow: (() => ThemeMode) | null = null

/** The "This browser" rows: the theme (it presses the header button, so the two stay in step) and the search mode. */
function browserPrefs(): BrowserPrefs {
  return [
    {
      label: 'Theme',
      help: 'Auto follows your system. The choice is kept in this browser only.',
      choices: [{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
      get: () => themeNow?.() ?? 'auto',
      set: value => {
        for (let press = 0; press < 3 && themeNow !== null && themeNow() !== value; press++) byId('theme').click()
      },
    },
    {
      label: 'Search mode',
      help: 'How the Search tab matches. Keyword plus meaning needs embeddings turned on. The choice is kept in this browser only.',
      choices: [{ value: 'keyword', label: 'Keyword' }, { value: 'hybrid', label: 'Keyword + meaning', disabled: !embeddingsOn, title: embeddingsOn ? '' : MEANING_OFF_HINT }],
      get: () => searchMode,
      set: value => {
        if (value !== 'keyword' && value !== 'hybrid') return
        if (value === 'hybrid' && !embeddingsOn) return
        searchMode = value
        saveMode(prefStorage(), value)
        drawMode()
      },
    },
  ]
}

const settingsHost: SettingsHost = {
  post: postJson,
  copy: async text => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  },
  reload: () => void loadSettings(),
  get browser() {
    return browserPrefs()
  },
}

export function drawSettings() {
  const data = settingsView.data
  if (data === null) return
  byId('settings-top').replaceChildren(...drawTop(data, settingsView, settingsHost, drawSettings))
  drawSettingsGroups(data)
  tabStatus('settings', '')
  byId('settings-body').hidden = false
}

/** Only the groups: the filter box redraws them per keystroke, so the box keeps focus. */
function drawSettingsGroups(data: SettingsData) {
  byId('settings-groups').replaceChildren(...drawGroups(data, settingsView, settingsHost))
}

export async function loadSettings() {
  if (settingsView.data === null) tabStatus('settings', 'Loading…')
  try {
    const response = await api('/api/settings')
    if (!response.ok) throw new Error(`the server answered ${response.status}`)
    const data = parseSettings(await readJson<unknown>(response))
    if (data === null) throw new Error('the reply was not a settings list')
    settingsView.data = data
    drawSettings()
    // The notice (after Reset all) shows once, with the fresh values.
    settingsView.notice = ''
  } catch (err) {
    if (err instanceof Expired) return
    tabStatus('settings', `Could not load the settings: ${failure(err)}`, true)
  }
}

// ---- Review ----

// After a retire, the row index whose successor gets the focus once the list is redrawn.
// `data` is the newest memories (GET /api/memories); `queue` is GET /api/review, read once each time the tab opens (it compares every pair of vectors on the server, so a filter change never asks again).
const reviewView = { data: null as ReviewData | null, queue: null as Queue | null, queueError: '', filter: 'never' as ReviewFilter, refocus: null as number | null }
const reviewHost: ReviewHost = {
  project: owner => project(owner, 'project'),
  open: id => openInMemories(id),
  retire: (id, replacedBy, done) => retireById(id, replacedBy, done),
  restore: (id, done) => restoreById(id, done),
  lastUsed: id => {
    const row = reviewView.data?.rows.find(item => item.id === id)
    return row === undefined ? null : (row.lastRecalled ?? row.created)
  },
  now: () => Date.now(),
}

/** The sentence under the filters when the review queue is not there (yet): still loading, or why it failed. */
const queueMissing = () => (reviewView.queueError !== '' ? reviewView.queueError : 'Loading the review queue…')

/** Takes a row out of the live lists after the server retired it: the candidates (and the near-duplicate reasons that named it), and it joins the Not live list. */
function applyRetired(id: string) {
  const now = new Date().toISOString()
  const row = reviewView.data?.rows.find(item => item.id === id)
  if (row !== undefined) row.state = 'retired'
  const memory = memories.rows.find(item => item.id === id)
  if (memory !== undefined) memory.state = 'retired'
  const queue = reviewView.queue
  if (queue === null) return
  const found = queue.candidates.find(item => item.id === id)
  queue.candidates = queue.candidates.filter(item => item.id !== id)
  if (found !== undefined) queue.candidateTotal = Math.max(0, queue.candidateTotal - 1)
  // The other half of a near-duplicate pair is no longer one of two: its reason goes, and a row with no reason left goes too.
  for (const other of queue.candidates) other.reasons = other.reasons.filter(reason => nearPartner(reason) !== id)
  const before = queue.candidates.length
  queue.candidates = queue.candidates.filter(item => item.reasons.length > 0)
  queue.candidateTotal = Math.max(0, queue.candidateTotal - (before - queue.candidates.length))
  queue.notLive = [{ id, owner: found?.owner ?? row?.owner ?? memory?.owner ?? '', text: found?.text ?? row?.text ?? firstLine(memory?.preview ?? '', 200), state: 'retired', since: now, history: [{ action: 'retire', validator: 'dashboard', at: now }] }, ...queue.notLive.filter(item => item.id !== id)]
  queue.notLiveTotal += 1
}

/** Puts a restored row back among the live ones in the page's lists. */
function applyRestored(id: string) {
  const row = reviewView.data?.rows.find(item => item.id === id)
  if (row !== undefined) row.state = 'live'
  const memory = memories.rows.find(item => item.id === id)
  if (memory !== undefined) memory.state = 'live'
  const queue = reviewView.queue
  if (queue === null) return
  const before = queue.notLive.length
  queue.notLive = queue.notLive.filter(item => item.id !== id)
  queue.notLiveTotal = Math.max(0, queue.notLiveTotal - (before - queue.notLive.length))
}

/**
 * The one retire call of the page (POST /api/memory/retire), for one memory the person confirmed. The lists change
 * only after the server answers 200; `done()` then, `done(error)` on a refusal or failure.
 */
export function retireById(id: string, replacedBy: string | undefined, done: (error?: string) => void) {
  void (async () => {
    const reply = await postJson('/api/memory/retire', { memory_id: id, ...(replacedBy === undefined ? {} : { replaced_by: replacedBy }) })
    const body = (reply.body ?? {}) as { status?: string; error?: string }
    if (reply.status !== 200 || body.status !== 'retired') {
      done(`Retire failed: ${body.error ?? `the server answered ${reply.status}`}`)
      return
    }
    applyRetired(id)
    drawRows()
    setStatus(`Retired memory ${id}. Restore brings it back.`, 'ok')
    done()
  })()
}

/** The one restore call of the page (POST /api/memory/restore): `done()` once the server confirmed, `done(error)` otherwise. */
export function restoreById(id: string, done: (error?: string) => void) {
  void (async () => {
    const reply = await postJson('/api/memory/restore', { memory_id: id })
    const body = (reply.body ?? {}) as { status?: string; error?: string }
    if (reply.status !== 200 || (body.status !== 'restored' && body.status !== 'unchanged')) {
      done(`Restore failed: ${body.error ?? `the server answered ${reply.status}`}`)
      return
    }
    applyRestored(id)
    drawRows()
    setStatus(`Restored memory ${id}.`, 'ok')
    done()
  })()
}

export function drawReview() {
  const data = reviewView.data
  if (data === null) return
  const now = Date.now()
  const queue = reviewView.queue
  const live = liveRows(data.rows)
  const filter = reviewView.filter
  byId('review-filters').replaceChildren(
    ...filterButtons(reviewCounts(live, now, { retire: queue?.candidates.length ?? 0, notlive: queue?.notLive.length ?? 0 }), filter, pick => {
      reviewView.filter = pick
      drawReview()
    }),
  )
  const again = (index: number) => () => {
    reviewView.refocus = index
    drawReview()
  }
  let rows: HTMLElement[] = []
  if (filter === 'retire') {
    const list = queue?.candidates ?? []
    byId('review-text').textContent = queue === null ? queueMissing() : queueText('retire', list.length, queue.candidateTotal)
    rows = list.map((candidate, index) => candidateRow(candidate, reviewHost, again(index)))
    byId('review-candidate-rows').replaceChildren(...rows)
  } else if (filter === 'notlive') {
    const list = queue?.notLive ?? []
    byId('review-text').textContent = queue === null ? queueMissing() : queueText('notlive', list.length, queue.notLiveTotal)
    rows = list.map((row, index) => notLiveRow(row, reviewHost, again(index)))
    byId('review-notlive-rows').replaceChildren(...rows)
  } else {
    const list = reviewList(live, filter as RowFilter, now)
    byId('review-text').textContent = reviewText(filter as RowFilter, list.length, data.rows.length, data.total)
    rows = list.map((memory, index) => reviewRow(memory, reviewHost, again(index)))
    byId('review-rows').replaceChildren(...rows)
  }
  byId('review-box').hidden = filter === 'retire' || filter === 'notlive' || rows.length === 0
  byId('review-candidates-box').hidden = filter !== 'retire' || rows.length === 0
  byId('review-notlive-box').hidden = filter !== 'notlive' || rows.length === 0
  tabStatus('review', '')
  byId('review-body').hidden = false
  // The redrawn list lost the focused button: the next row's Open (the new last row's when the
  // last was retired or restored), else the tab's heading when the list is now empty.
  if (reviewView.refocus !== null) {
    const row = rows[Math.min(reviewView.refocus, rows.length - 1)]
    reviewView.refocus = null
    ;(row?.querySelector<HTMLButtonElement>('button') ?? byId('review-title')).focus()
  }
}

/** GET /api/review: the queue. It never throws; a failure is a sentence the queue lists show. */
async function loadQueue() {
  try {
    const response = await api('/api/review')
    if (!response.ok) throw new Error(`the server answered ${response.status}`)
    const queue = parseQueue(await readJson<unknown>(response))
    if (queue === null) throw new Error('the reply was not a review queue')
    reviewView.queue = queue
    reviewView.queueError = ''
  } catch (err) {
    if (err instanceof Expired) return
    reviewView.queueError = `Could not load the review queue: ${failure(err)}`
  }
}

export async function loadReview() {
  if (reviewView.data === null) tabStatus('review', 'Loading…')
  try {
    // The newest memories (the server's list limit); the four filters work on them here, since one request cannot ask for all four.
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
    return
  }
  // The queue once per tab open (the memory list above is cheap; this one is not on a big store).
  await loadQueue()
  drawReview()
}

// ---- Vocabulary ----

const vocabView = { data: null as VocabData | null }
const vocabHost = { post: postJson, reload: (message: string) => void loadVocabulary(message) }

/** GET /api/vocabulary, or null when it cannot be read (the form then offers no tags, and says so). */
async function fetchVocabulary(): Promise<VocabData | null> {
  try {
    const response = await api('/api/vocabulary')
    return response.ok ? parseVocabulary(await readJson<unknown>(response)) : null
  } catch {
    return null
  }
}

export function drawVocabulary() {
  const data = vocabView.data
  if (data === null) return
  byId('vocab-text').textContent = vocabularyText(data)
  byId('vocab-tags').replaceChildren(...tagGroups(data))
  byId('vocab-candidates').replaceChildren(...candidateList(data, vocabHost))
  byId('vocab-body').hidden = false
}

/** Reads the vocabulary from the server and draws it; `message` (the reply of a change the server confirmed) shows once the fresh lists are in. */
export async function loadVocabulary(message = '') {
  if (vocabView.data === null) tabStatus('vocab', 'Loading…')
  try {
    const response = await api('/api/vocabulary')
    const body = await readJson<unknown>(response)
    if (!response.ok) throw new Error((body as { error?: string } | null)?.error ?? `the server answered ${response.status}`)
    const data = parseVocabulary(body)
    if (data === null) throw new Error('the reply was not a vocabulary')
    vocabView.data = data
    drawVocabulary()
    tabStatus('vocab', message)
  } catch (err) {
    if (err instanceof Expired) return
    tabStatus('vocab', `Could not load the vocabulary: ${failure(err)}`, true)
  }
}

/** The Try again buttons of the Knowledge, Review and Health status lines. */
export function wireKnowledgeHealth() {
  byId('review-retry').addEventListener('click', () => void loadReview())
  byId('vocab-retry').addEventListener('click', () => void loadVocabulary())
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
  byId('know-find').addEventListener('keydown', event => {
    if ((event as KeyboardEvent).key !== 'Escape') return
    const input = byId<HTMLInputElement>('know-find')
    if (input.value !== '') {
      input.value = ''
      knowledgeView.filter.text = ''
      drawKnowledgeRows()
    } else input.blur()
  })
  knowledgeUi.group = readKnowledgeGroup()
  // Optional call: the test stand-in document has no listeners.
  document.addEventListener?.('keydown', knowledgeKey)
  byId('health-retry').addEventListener('click', () => void loadHealthReport())
  byId('settings-retry').addEventListener('click', () => void loadSettings())
  byId<HTMLInputElement>('settings-filter').addEventListener('input', () => {
    settingsView.filter = byId<HTMLInputElement>('settings-filter').value
    if (settingsView.data !== null) drawSettingsGroups(settingsView.data)
  })
}

// ---- Header and footer ----

let owners: Owner[] = []

async function loadHealth() {
  const health = await readJson<Health>(await api('/api/health'))
  owners = health.owners ?? []
  useOwners(owners.map(row => row.owner))
  setEmbeddings(health.embeddings === true)
  const projects = owners.length
  byId('summary').textContent = `${health.total} ${health.total === 1 ? 'memory' : 'memories'} in ${projects} ${projects === 1 ? 'project' : 'projects'}`
  // The plugin and engine versions live in the About popover (0.17.0; the footer with the rest is on Health).
  byId('engine').textContent = [health.plugin ? `plugin v${health.plugin}` : '', health.engine ? `engine ${health.engine}` : ''].filter(Boolean).join(' · ')
  for (const id of ['mem-owner', 'search-owner']) {
    const select = byId<HTMLSelectElement>(id)
    const chosen = select.value
    select.replaceChildren(el('option', id === 'search-owner' ? 'Every project' : 'All projects'))
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
  serverPid = health.pid
  fact('Server', serverText(watch.lost(), serverPid))
  serverLine = (facts.lastElementChild as HTMLElement | null) ?? null
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

/** Which rows the table shows by state: the live ones, the not-live ones (retired, expired, lapsed), or all. */
export type StateView = 'live' | 'gone' | 'all'
type Facets = { reach: Record<string, number>; kind: Record<string, number> }

const memories = {
  selected: '' as string,
  rows: [] as Memory[],
  total: 0,
  timer: 0 as ReturnType<typeof setTimeout> | 0,
  tag: '',
  state: 'live' as StateView,
  reach: '' as '' | Reach,
  kind: '',
  facets: null as Facets | null,
}

// The state view is a per-viewer setting: this browser's own storage, and the page works without it.
// The old "Show retired" on (key below, '1') reads as All.
const STATE_KEY = 'mnemosyne.memories.state'
const RETIRED_KEY = 'mnemosyne.memories.showRetired'
function readStateView(): StateView {
  try {
    const saved = prefStorage()?.getItem(STATE_KEY)
    if (saved === 'live' || saved === 'gone' || saved === 'all') return saved
    return prefStorage()?.getItem(RETIRED_KEY) === '1' ? 'all' : 'live'
  } catch {
    return 'live'
  }
}
function saveStateView(state: StateView) {
  try {
    prefStorage()?.setItem(STATE_KEY, state)
  } catch {
    // storage is a convenience only
  }
}

/** Filters the table to one tag ('' clears it), and shows which: a token in the filter bar. */
function setTagFilter(tag: string) {
  memories.tag = tag
  const button = byId('mem-tag')
  button.hidden = tag === ''
  button.textContent = tag === '' ? '' : `tag: ${tag} ×`
  button.title = tag === '' ? '' : `Showing only memories tagged ${tag}. Press to show all.`
  button.setAttribute('aria-label', tag === '' ? 'Clear tag filter' : `Clear tag filter: ${tag}`)
  void loadMemories()
}

export async function loadMemories() {
  const params = new URLSearchParams()
  const owner = byId<HTMLSelectElement>('mem-owner').value
  const sort = byId<HTMLSelectElement>('mem-sort').value
  const q = byId<HTMLInputElement>('mem-filter').value.trim()
  if (owner) params.set('owner', owner)
  params.set('sort', sort)
  if (q) params.set('q', q)
  if (memories.tag) params.set('tag', memories.tag)
  if (memories.reach) params.set('reach', memories.reach)
  if (memories.kind) params.set('kind', memories.kind)
  try {
    const response = await api(`/api/memories?${params}`)
    const body = await readJson<{ total?: number; count?: number; memories?: Memory[]; facets?: Facets; error?: string }>(response)
    if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`)
    memories.rows = body.memories ?? []
    memories.total = body.total ?? memories.rows.length
    // An older server sends no facets: the chips then hide.
    memories.facets = body.facets ?? null
    drawFacets()
    drawRows()
  } catch (err) {
    if (!(err instanceof Expired)) setStatus(`Could not load memories: ${failure(err)}`, 'error')
  }
}

const REACH_CHIPS: { reach: Reach; label: string }[] = [
  { reach: 'all', label: 'Every project' },
  { reach: 'shared', label: 'Shared' },
  { reach: 'project', label: 'Project only' },
]

/** One counted filter chip: pressed while it filters; a chip with 0 is disabled unless it is the one on. */
function facetChip(label: string | HTMLElement, count: number, on: boolean, pick: () => void, className: string) {
  const chip = el('button', undefined, `chip-btn facet ${className}`)
  chip.type = 'button'
  chip.setAttribute('aria-pressed', String(on))
  if (typeof label === 'string') chip.append(el('span', label))
  else chip.append(label)
  chip.append(el('span', String(count), 'n'))
  chip.disabled = count === 0 && !on
  chip.addEventListener('click', pick)
  return chip
}

/** The reach and kind chips, with the counts the server took under the other filters. */
export function drawFacets() {
  const reachBox = byId('mem-reach')
  const kindBox = byId('mem-kind')
  const facets = memories.facets
  byId('mem-facets').hidden = facets === null
  if (facets === null) {
    reachBox.replaceChildren()
    kindBox.replaceChildren()
    return
  }
  reachBox.replaceChildren(
    ...REACH_CHIPS.map(({ reach, label }) =>
      facetChip(label, facets.reach[reach] ?? 0, memories.reach === reach, () => {
        memories.reach = memories.reach === reach ? '' : reach
        void loadMemories()
      }, `r-${reach}`),
    ),
  )
  const kinds = Object.entries(facets.kind).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  // The picked kind keeps its chip when another filter leaves it no rows.
  if (memories.kind && !kinds.some(([kind]) => kind === memories.kind)) kinds.push([memories.kind, 0])
  kindBox.replaceChildren(
    ...kinds.map(([kind, count]) => {
      const chip = facetChip(kindGlyph(kind), count, memories.kind === kind, () => {
        memories.kind = memories.kind === kind ? '' : kind
        void loadMemories()
      }, 'kind-chip')
      chip.title = `${kind}: ${count}`
      chip.setAttribute('aria-label', `${kind}, ${count}`)
      return chip
    }),
  )
}

/** The rows the table shows under the state view: live, not live (retired, expired, lapsed), or all. */
function visibleRows() {
  if (memories.state === 'all') return memories.rows
  const gone = memories.state === 'gone'
  return memories.rows.filter(memory => isGone(memory) === gone)
}

/** The rows with a day heading row in front of each new saved day (newest and never-recalled sorts only). */
export function withDays(rows: readonly Memory[], grouped: boolean): ({ day: string; heading: string; count: number } | Memory)[] {
  if (!grouped) return [...rows]
  const out: ({ day: string; heading: string; count: number } | Memory)[] = []
  let head: { day: string; heading: string; count: number } | null = null
  for (const memory of rows) {
    const key = day(memory.timestamp)
    if (head === null || head.day !== key) {
      const heading = dayHeading(memory.timestamp)
      // Today and Yesterday carry their date as well.
      head = { day: key, heading: heading === 'Today' || heading === 'Yesterday' ? `${heading}  ${longDay(memory.timestamp)}` : heading, count: 0 }
      out.push(head)
    }
    head.count++
    out.push(memory)
  }
  return out
}

const STATE_WORD: Record<StateView, string> = { live: 'live', gone: 'not live', all: '' }

export function drawRows() {
  const body = byId('mem-rows')
  const shown = visibleRows()
  const sort = byId<HTMLSelectElement>('mem-sort').value
  body.replaceChildren(
    ...withDays(shown, sort !== 'recalled').map(item => {
      if (!('day' in item)) return memoryRow(item, id => void openMemory(id), setTagFilter)
      const row = el('tr', undefined, 'day-group')
      const cell = el('td')
      cell.colSpan = 7
      cell.append(el('span', item.heading, 'day-name'), el('span', ` · ${item.count} ${item.count === 1 ? 'memory' : 'memories'}`, 'muted'))
      row.append(cell)
      return row
    }),
  )
  const live = memories.rows.filter(memory => !isGone(memory)).length
  const gone = memories.rows.length - live
  for (const { state, button, count } of stateButtons) {
    button.setAttribute('aria-pressed', String(state === memories.state))
    count.textContent = state === 'live' ? String(live) : state === 'gone' ? String(gone) : ''
  }
  drawCounts(live, gone)
  const hidden = memories.rows.length - shown.length
  const word = STATE_WORD[memories.state]
  const note = hidden > 0 && memories.state === 'live' ? ` (${hidden} not live, hidden: pick Not live or All to see ${hidden === 1 ? 'it' : 'them'})` : ''
  byId('mem-count').textContent = shown.length === 0 ? `No ${word ? `${word} ` : ''}memories match.${note}` : `Showing ${shown.length} of ${memories.total}${word ? ` · ${word}` : ''}${note}`
  drawEmpty(shown.length === 0)
  markSelected()
}

/** The title's counts for the rows loaded: live, not live, global (every project), shared, and how many projects. */
function drawCounts(live: number, gone: number) {
  const box = byId('mem-counts')
  const all = memories.rows.filter(memory => reachOf(memory) === 'all').length
  const shared = memories.rows.filter(memory => reachOf(memory) === 'shared').length
  const projects = new Set(memories.rows.map(memory => memory.owner)).size
  const part = (text: string, className = '') => el('span', text, className)
  const dot = () => el('span', ' · ', 'muted')
  box.replaceChildren(
    part(`${live} live`, 'strong'), dot(), part(`${gone} not live`, 'muted'), dot(),
    part(`${all} for every project`, 'r-all-text'), dot(), part(`${shared} shared`, 'r-shared-text'), dot(),
    part(`${projects} ${projects === 1 ? 'project' : 'projects'}`, 'muted'),
  )
}

/** With no rows: what is filtering, and buttons that clear it. */
function drawEmpty(empty: boolean) {
  const box = byId('mem-empty')
  box.hidden = !empty
  if (!empty) {
    box.replaceChildren()
    return
  }
  const owner = byId<HTMLSelectElement>('mem-owner').value
  const q = byId<HTMLInputElement>('mem-filter').value.trim()
  const on: string[] = []
  if (q) on.push(`Text “${q}”`)
  if (memories.tag) on.push(`Tag ${memories.tag}`)
  if (memories.reach) on.push(`Reach ${REACH_WORD[memories.reach]}`)
  if (memories.kind) on.push(`Kind ${memories.kind}`)
  if (owner) on.push(`Project ${ownerName(owner)}`)
  if (memories.state !== 'all') on.push(`State ${STATE_WORD[memories.state]}`)
  const text = el('div', undefined, 'mem-empty-text')
  text.append(el('p', 'No memories match.', 'mem-empty-title'), el('p', on.length > 0 ? `${on.length} ${on.length === 1 ? 'filter is' : 'filters are'} on: ${on.join(' · ')}.` : 'The store is empty: save one with New memory.', 'muted small'))
  const buttons = el('div', undefined, 'buttons')
  if (owner) {
    const clear = el('button', 'Clear project', 'btn')
    clear.type = 'button'
    clear.addEventListener('click', () => {
      byId<HTMLSelectElement>('mem-owner').value = ''
      void loadMemories()
    })
    buttons.append(clear)
  }
  if (on.length > 0) {
    const all = el('button', 'Clear all filters', 'btn')
    all.type = 'button'
    all.addEventListener('click', () => clearMemoryFilters())
    buttons.append(all)
  }
  box.replaceChildren(text, buttons)
}

/** Every filter off; the state view goes to All so nothing is hidden. */
function clearMemoryFilters() {
  byId<HTMLSelectElement>('mem-owner').value = ''
  byId<HTMLInputElement>('mem-filter').value = ''
  memories.reach = ''
  memories.kind = ''
  memories.state = 'all'
  saveStateView('all')
  setTagFilter('')
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
    // On the Memories tab it opens beside the list on a wide screen, so the list stays in view.
    side: current === 'memories' || current === 'search',
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
      setStatus('That memory no longer exists or was retired.', 'error')
      return
    }
    const memory = await readJson<Memory & { error?: string }>(response)
    if (!response.ok) throw new Error(memory.error ?? `the server answered ${response.status}`)
    if (memories.selected !== id) return
    openSheet({ ...sheet, body: memoryDetail(memory, forgetMemory, pickTagFromSheet, picked => openForm(picked, sheet)) })
  } catch (err) {
    if (memories.selected === id) closeSheet()
    if (!(err instanceof Expired)) setStatus(`Could not open the memory: ${failure(err)}`, 'error')
  }
}

// ---- New memory and Edit ----

/**
 * Opens the form in the bottom sheet: a new memory (no `memory`) or the edit of one. The server's answer decides everything:
 * the sheet closes, and the lists reload, only after it confirmed the save.
 */
function openForm(memory: Memory | undefined, sheet: { title: string; returnFocus?: HTMLElement | null | (() => HTMLElement | null); onClose?: () => void }) {
  const built = buildForm(
    {
      post: postJson,
      vocabulary: fetchVocabulary,
      owners: () => owners.map(row => row.owner),
      owner: () => byId<HTMLSelectElement>('mem-owner').value,
      ownerName,
      cancel: () => closeSheet(),
      done: (message, id) => {
        closeSheet()
        setStatus(message, 'ok')
        void loadHealth().catch(() => undefined)
        if (opened.has('memories')) void loadMemories()
        // The review queue is read again the next time the Review tab opens.
        if (memory !== undefined) void openMemory(id)
      },
    },
    memory as FormMemory | undefined,
  )
  openSheet({ ...sheet, title: memory === undefined ? 'New memory' : 'Edit memory', body: built.element })
  built.focus()
}

/** The memory panel's Forget: the shared guarded forget. */
export const forgetMemory = (memory: Memory, done: (error?: string) => void) => forgetById(memory.id, done)

/** A tag in the sheet: the Memories list filtered by it, from whichever tab the sheet is on. */
function pickTagFromSheet(tag: string) {
  if (current !== 'memories') show('memories')
  setTagFilter(tag)
}

/** The Live / Not live / All control (a per-viewer setting) and the New memory button. */
export function wireStateView() {
  memories.state = readStateView()
  stateButtons = (['live', 'gone', 'all'] as const).map(state => {
    const button = el('button', state === 'live' ? 'Live' : state === 'gone' ? 'Not live' : 'All', 'seg-btn')
    button.type = 'button'
    button.dataset.state = state
    const count = el('span', '', 'n')
    button.append(count)
    button.setAttribute('aria-pressed', String(state === memories.state))
    button.addEventListener('click', () => {
      memories.state = state
      saveStateView(state)
      drawRows()
    })
    return { state, button, count }
  })
  byId('mem-state').replaceChildren(...stateButtons.map(item => item.button))
  byId('mem-new').addEventListener('click', () => openNewMemory())
}

let stateButtons: { state: StateView; button: HTMLButtonElement; count: HTMLSpanElement }[] = []

const openNewMemory = () => openForm(undefined, { title: 'New memory', returnFocus: byId('mem-new') })

/** True when a key press is typing: in a field, or with a modifier held. */
const typing = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  const tag = target?.tagName?.toLowerCase() ?? ''
  return event.ctrlKey || event.metaKey || event.altKey || tag === 'input' || tag === 'select' || tag === 'textarea' || target?.isContentEditable === true
}

/** The Memories keys: J/K move between rows, / goes to the filter, N starts a new memory (Enter and Esc are the row's and the sheet's). */
export function memoryKey(event: KeyboardEvent) {
  if (current !== 'memories' || event.defaultPrevented || typing(event)) return
  const key = event.key
  if (key === '/') {
    event.preventDefault()
    byId<HTMLInputElement>('mem-filter').focus()
    return
  }
  if (key === 'n' || key === 'N') {
    event.preventDefault()
    openNewMemory()
    return
  }
  if (key !== 'j' && key !== 'k' && key !== 'J' && key !== 'K') return
  const rows = [...byId('mem-rows').querySelectorAll<HTMLElement>('tr.row')]
  if (rows.length === 0) return
  event.preventDefault()
  const at = rows.findIndex(row => row === document.activeElement || row.dataset.id === memories.selected)
  const next = key.toLowerCase() === 'j' ? Math.min(rows.length - 1, at + 1) : Math.max(0, at === -1 ? 0 : at - 1)
  rows[next]!.focus()
  rows[next]!.scrollIntoView?.({ block: 'nearest' })
}

function wireMemories() {
  wireStateView()
  byId('mem-owner').addEventListener('change', () => void loadMemories())
  byId('mem-sort').addEventListener('change', () => void loadMemories())
  byId('mem-tag').addEventListener('click', () => setTagFilter(''))
  byId('mem-filter').addEventListener('input', () => {
    if (memories.timer) clearTimeout(memories.timer)
    memories.timer = setTimeout(() => void loadMemories(), 250)
  })
  // Esc in the filter box clears it first; a second Esc leaves the box.
  byId('mem-filter').addEventListener('keydown', event => {
    const input = event.target as HTMLInputElement
    if (event.key !== 'Escape') return
    event.preventDefault()
    if (input.value !== '') {
      input.value = ''
      void loadMemories()
    } else input.blur()
  })
  document.addEventListener('keydown', memoryKey)
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

// A stream that is reconnecting may mean the server is gone: the watch asks it (once; it keeps its own back-off).
events.onStatus(status => {
  if (status === 'reconnecting') watch.suspect()
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

// 0.19.0: 120 s (was 60). A cold Keyword + meaning search of every project loads the model once per project and
// took over 60 s on a 117-memory store; the page stopped it before the engine answered.
const SEARCH_TIMEOUT_MS = 120_000
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

// 0.19.0: the sort and the facet filter (both on the page, no new search), the reply's time and the owner searched.
let searchSort: HitSort = 'rank'
let searchFacet: { facet: HitFacet; value: string } | null = null
let searchMs: number | undefined
let searchOwnerAsked = ''
let searchRecent: string[] = []

/** The hits as shown: the facet filter, then the sort. */
function visibleHits(): Hit[] {
  const filtered = searchFacet === null ? searchHits : searchHits.filter(hit => facetValue(hit, searchFacet!.facet) === searchFacet!.value)
  return sortHits(filtered, searchSort)
}

/** The line before the first weak hit (rank order only). */
function weakCut() {
  const cut = el('li', undefined, 'cut')
  cut.setAttribute('role', 'separator')
  cut.append(el('span', `below ${WEAK_SCORE.toFixed(2)}: weak matches Claude still receives`))
  return cut
}

// The first SHOW_FIRST hits, then SHOW_FIRST more for each press of Show more.
function drawHits(more: boolean) {
  const results = byId('search-results')
  // A hit opens on this tab: beside the list on a wide screen, else in the bottom sheet.
  const open = (id: string, from?: HTMLElement) => void openMemory(id, from)
  const list = visibleHits()
  const rank = new Map(searchHits.map((hit, i) => [hit.id, i + 1]))
  const from = more ? searchShown : 0
  searchShown = Math.min(list.length, more ? searchShown + SHOW_FIRST : SHOW_FIRST)
  const rows: HTMLElement[] = []
  list.slice(from, searchShown).forEach((hit, i) => {
    const at = from + i
    const before = list[at - 1]
    if (searchSort === 'rank' && hit.score < WEAK_SCORE && (at === 0 ? false : before !== undefined && before.score >= WEAK_SCORE)) rows.push(weakCut())
    rows.push(searchHit(hit, rank.get(hit.id) ?? at + 1, searchQuery, open, showOnMap))
  })
  if (more) results.append(...rows)
  else results.replaceChildren(...rows)
  byId('search-more').hidden = searchShown >= list.length
  drawSearchHead()
}

/** The result header: count, query, mode and time, and the three sort buttons. */
function drawSearchHead() {
  const head = byId('search-head')
  const note = byId('search-note')
  head.hidden = searchHits.length === 0
  note.hidden = searchHits.length === 0
  if (searchHits.length === 0) return
  const list = visibleHits()
  let text = resultHead(searchHits.length, searchQuery, noteMode, searchMs)
  if (searchFacet !== null) text += ` · ${list.length} shown`
  else if (searchShown < list.length) text += ` · showing ${searchShown}`
  if (noteSkipped > 0) text += ` · the ${noteSkipped} smallest projects were not searched`
  note.textContent = text
  const box = byId('search-sort')
  const sorts: [HitSort, string][] = [
    ['rank', 'Rank'],
    ['newest', 'Newest'],
    ['recalled', 'Most recalled'],
  ]
  box.replaceChildren(
    ...sorts.map(([sort, label]) => {
      const button = el('button', label, 'seg-btn')
      button.type = 'button'
      button.setAttribute('aria-pressed', String(sort === searchSort))
      button.addEventListener('click', () => {
        searchSort = sort
        drawHits(false)
      })
      return button
    }),
  )
}

const KIND_WORD = (kind: string) => (kind === 'unknown' ? 'Unknown' : kind[0]!.toUpperCase() + kind.slice(1))

/** The aside: hits counted by project, kind and how they matched; a click filters the list (a second click clears). */
function drawSearchAside() {
  const aside = byId('search-aside')
  aside.hidden = searchHits.length === 0
  if (searchHits.length === 0) return
  const pick = (facet: HitFacet, value: string) => () => {
    searchFacet = searchFacet?.facet === facet && searchFacet.value === value ? null : { facet, value }
    drawSearchAside()
    drawHits(false)
  }
  const on = (facet: HitFacet, value: string) => searchFacet?.facet === facet && searchFacet.value === value
  const owners = countFacet(searchHits, 'owner')
  const most = owners[0]?.[1] ?? 1
  byId('search-facet-owner').replaceChildren(
    ...owners.map(([owner, count]) => {
      const row = facetChip(project(owner, 'project own'), count, on('owner', owner), pick('owner', owner), 'sr-owner')
      const bar = el('span', undefined, 'sr-bar')
      bar.append(el('span', undefined, `sr-fill w${Math.max(1, Math.round((count / most) * 10))}`))
      row.insertBefore(bar, row.lastChild)
      return row
    }),
  )
  byId('search-facet-kind').replaceChildren(
    ...countFacet(searchHits, 'kind').map(([kind, count]) => {
      const label = el('span', undefined, 'facet-kind')
      label.append(kindGlyph(kind), el('span', KIND_WORD(kind)))
      return facetChip(label, count, on('kind', kind), pick('kind', kind), 'k')
    }),
  )
  const matched = new Map(countFacet(searchHits, 'matched'))
  byId('search-facet-matched').replaceChildren(
    ...(['both', 'meaning', 'keyword'] as const).map(how => facetChip(matchLabel(how), matched.get(how) ?? 0, on('matched', how), pick('matched', how), 'm')),
  )
  byId('search-facet-clear').hidden = searchFacet === null
}

/** The Search tab's states: before a search, nothing found, searching, or a failure. '' clears it. */
function drawSearchState(state: '' | 'before' | 'none' | 'loading' | 'error', message = '') {
  const box = byId('search-state')
  if (state === '') {
    box.replaceChildren()
    return
  }
  const card = el('div', undefined, `st st-${state}`)
  const button = (label: string, act: () => void, primary = false) => {
    const b = el('button', label, primary ? 'btn primary small' : 'btn small')
    b.type = 'button'
    b.addEventListener('click', act)
    return b
  }
  if (state === 'before') {
    card.append(el('p', 'Ask in your own words', 'st-title'))
    card.append(el('p', 'Pick a project under "As seen from" to see what Claude would receive there, or search every project.', 'muted small'))
    const tries = searchRecent.length > 0 ? searchRecent : ['decisions about the setup', 'writing style', 'what is the project about']
    const row = el('div', undefined, 'chips')
    for (const query of tries) row.append(button(query, () => searchFor(query)))
    card.append(row)
  } else if (state === 'none') {
    const where = searchOwnerAsked ? ownerName(searchOwnerAsked) : 'every project'
    card.append(el('p', `Nothing for “${searchQuery}” in ${where}`, 'st-title'))
    const hints: string[] = []
    if (searchMode === 'keyword') hints.push(embeddingsOn ? 'Keyword mode found no word match. Try Keyword + meaning.' : 'Keyword mode found no word match. Try other words.')
    if (searchOwnerAsked) hints.push('Or search every project.')
    if (noteSkipped > 0) hints.push(`The ${noteSkipped} smallest projects were not searched; pick one under "As seen from".`)
    if (hints.length > 0) card.append(el('p', hints.join(' '), 'muted small'))
    const row = el('div', undefined, 'chips')
    if (searchMode === 'keyword' && embeddingsOn)
      row.append(
        button(
          'Switch to Keyword + meaning',
          () => {
            searchMode = 'hybrid'
            saveMode(prefStorage(), 'hybrid')
            drawMode()
            searchFor(searchQuery)
          },
          true,
        ),
      )
    if (searchOwnerAsked)
      row.append(
        button('Every project', () => {
          byId<HTMLSelectElement>('search-owner').value = ''
          drawSeen()
          searchFor(searchQuery)
        }),
      )
    if (row.children.length > 0) card.append(row)
  } else if (state === 'loading') {
    card.setAttribute('aria-busy', 'true')
    card.append(el('p', 'Asking the engine…', 'st-title'), el('p', searchMode === 'hybrid' ? 'Meaning search loads its model on the first query, which can take a while.' : 'Searching each project as itself.', 'muted small'))
    for (const width of ['w9', 'w7', 'w8']) card.append(el('div', undefined, `skel ${width}`))
  } else {
    card.append(el('p', message, 'st-title is-error'))
  }
  box.replaceChildren(card)
}

/** The line under the query: what "As seen from" means for the project picked. */
function drawSeen() {
  const owner = byId<HTMLSelectElement>('search-owner').value
  byId('search-seen').textContent = owner
    ? `What Claude would receive in ${ownerName(owner)}: its own memories, plus the shared and global ones.`
    : 'Every project: each project searched as itself, the best hits merged.'
}

/** The recent-query chips beside the line. */
function drawRecent() {
  const box = byId('search-recent')
  if (searchRecent.length === 0) {
    box.replaceChildren()
    return
  }
  box.replaceChildren(
    el('span', 'Recent:', 'muted small'),
    ...searchRecent.map(query => {
      const chip = el('button', query, 'chip-btn')
      chip.type = 'button'
      chip.addEventListener('click', () => searchFor(query))
      return chip
    }),
  )
}

/** Puts `query` in the box and searches. */
function searchFor(query: string) {
  byId<HTMLInputElement>('search-query').value = query
  void runSearch()
}

/** J/K move through the hits, Enter opens (the card's own key), M shows the focused one on the map; `/` on a tab with no find box of its own opens Search. */
export function searchKey(event: KeyboardEvent) {
  if (event.defaultPrevented || typing(event)) return
  const key = event.key
  if (key === '/' && current !== 'search' && current !== 'memories' && current !== 'map') {
    event.preventDefault()
    show('search')
    byId<HTMLInputElement>('search-query').focus()
    return
  }
  if (current !== 'search') return
  if (key === '/') {
    event.preventDefault()
    byId<HTMLInputElement>('search-query').focus()
    return
  }
  const cards = [...byId('search-results').querySelectorAll<HTMLElement>('li.sh')]
  if (cards.length === 0) return
  const at = cards.findIndex(card => card === document.activeElement)
  if (key === 'j' || key === 'J' || key === 'k' || key === 'K') {
    event.preventDefault()
    const next = key.toLowerCase() === 'j' ? Math.min(cards.length - 1, at + 1) : Math.max(0, at === -1 ? 0 : at - 1)
    cards[next]!.focus()
    cards[next]!.scrollIntoView?.({ block: 'nearest' })
    return
  }
  if (at === -1) return
  const id = cards[at]!.dataset.id
  if (!id) return
  if (key === 'Enter') {
    event.preventDefault()
    void openMemory(id, cards[at])
  } else if (key === 'm' || key === 'M') {
    event.preventDefault()
    showOnMap(id)
  }
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
  byId('search-more').addEventListener('click', () => drawHits(true))
  byId('search-owner').addEventListener('change', drawSeen)
  byId('search-facet-clear').addEventListener('click', () => {
    searchFacet = null
    drawSearchAside()
    drawHits(false)
  })
  searchRecent = readRecent(prefStorage())
  drawMode()
  drawSeen()
  drawRecent()
  drawSearchState('before')
  document.addEventListener('keydown', searchKey)
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
  // The old hits go while the engine works; skeleton rows say it is busy.
  searchHits = []
  searchShown = 0
  searchFacet = null
  results.replaceChildren()
  byId('search-more').hidden = true
  drawSearchHead()
  drawSearchAside()
  drawSearchState('loading')
  note.textContent = 'Searching…'
  searchRecent = pushRecent(prefStorage(), query)
  drawRecent()
  try {
    const response = await api('/api/search', { method: 'POST', body: { query, ...(owner ? { owner } : {}), mode: searchMode }, signal: controller.signal })
    const body = await readJson<{ results?: Hit[]; skipped?: number; mode?: string; embeddings?: boolean; ms?: number; error?: string }>(response)
    if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`)
    if (typeof body.embeddings === 'boolean') setEmbeddings(body.embeddings)
    searchHits = body.results ?? []
    searchQuery = query
    searchOwnerAsked = owner
    noteMode = body.mode
    noteSkipped = body.skipped ?? 0
    searchMs = typeof body.ms === 'number' ? body.ms : undefined
    drawSearchState(searchHits.length === 0 ? 'none' : '')
    drawSearchAside()
    drawHits(false)
    // Screen readers hear the count (the header is the live region).
    if (searchHits.length === 0) note.textContent = countNote(0, 0, noteMode, noteSkipped)
  } catch (err) {
    if (err instanceof Expired) return
    searchHits = []
    searchShown = 0
    byId('search-more').hidden = true
    results.replaceChildren()
    drawSearchHead()
    drawSearchAside()
    drawSearchState('error', controller.signal.aborted ? 'Search took too long and was stopped.' : `Search failed: ${failure(err)}`)
  } finally {
    clearTimeout(timer)
    searching = null
    if (button) button.disabled = false
  }
}

// ---- Start ----

export async function main() {
  // The theme first, so the page is not drawn in the wrong colours while it loads.
  themeNow = startTheme(byId('theme'), document.documentElement, (() => {
    try {
      return typeof localStorage === 'undefined' ? undefined : localStorage
    } catch {
      return undefined
    }
  })())
  drawTabs()
  // The shell's own buttons (0.17.0): "Try now" in the lost strip, and Copy on the expired card.
  byId('lost-retry').addEventListener('click', () => watch.retry())
  byId('expired-copy').addEventListener('click', () => {
    const button = byId<HTMLButtonElement>('expired-copy')
    void navigator.clipboard?.writeText('/mnemosyne-ui').then(
      () => (button.textContent = 'Copied'),
      () => (button.textContent = 'Copy failed'),
    )
  })
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
  finishBoot()
}

// What follows the first successful load; once only, from main() or from the watch when the server answers after a failed first load.
let booted = false
function finishBoot() {
  if (booted) return
  booted = true
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
