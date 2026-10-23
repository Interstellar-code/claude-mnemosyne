// The 3D map's logic (plan MAP.3), with no DOM and no three.js, so a Bun spec
// tests all of it: the drill level, what each level draws and where, the path
// bar, Reset view, auto-rotate, colour-by, project toggles, min-recalls, the
// rail list, the inspector, the requests each level needs, and WebGL detection.
// ui/map.ts draws what this returns and sends every click and key here.
//
// Every function returns a new state; none changes the one it is given.
import { plainLabel } from './escape'

export type Level = 'all' | 'project' | 'topic' | 'memory'
export type ColourBy = 'project' | 'recalls' | 'age'
export const COLOUR_BY: readonly ColourBy[] = ['project', 'recalls', 'age']
export const COLOUR_BY_NAMES: Readonly<Record<ColourBy, string>> = { project: 'Project', recalls: 'Recalls', age: 'Age' }
export const MIN_RECALLS_MAX = 20
export const LABEL_CHARS = 80

// ---- What /api/map and /api/memories/<id> answer ----

export type ProjectNode = { id: string; label: string; count: number; recalls: number; newest: string | null }
export type TopicNode = { id: string; label: string; count: number; recalls: number; newest: string | null; tag: string | null; untagged: boolean }
export type MemoryNode = { id: string; label: string; tags: string[]; recall_count: number; timestamp: string | null }
export type MemoryDetail = { id: string; content: string; tags: string[]; recall_count: number; timestamp: string | null; owner: string }

export type MapState = {
  readonly level: Level
  readonly project: string | null
  /** A topic node id: `tag:<tag>` or `untagged`. */
  readonly topic: string | null
  readonly memory: string | null
  /** The cached reply of each level; null until it arrives. */
  readonly projects: readonly ProjectNode[] | null
  readonly topics: { readonly project: string; readonly nodes: readonly TopicNode[] } | null
  /** `total` is how many the topic holds; the server sends at most its limit of them. */
  readonly memories: { readonly project: string; readonly topic: string; readonly nodes: readonly MemoryNode[]; readonly total: number } | null
  readonly detail: MemoryDetail | null
  readonly hidden: readonly string[]
  readonly colourBy: ColourBy
  readonly minRecalls: number
  readonly rotating: boolean
  /** Each project's colour slot, given in the order projects first arrive and then kept. */
  readonly slots: Readonly<Record<string, number>>
}

export type MapRequest =
  | { kind: 'projects'; minRecalls: number }
  | { kind: 'topics'; project: string; minRecalls: number }
  | { kind: 'memories'; project: string; topic: string; minRecalls: number }
  | { kind: 'memory'; id: string }

/** The library's label accessor for nodes and links: always empty, so its HTML tooltip never shows. */
export const NO_TOOLTIP = (): string => ''

/**
 * True when the browser can make a WebGL2 context: false when getContext('webgl2')
 * gives null, or when it or making the canvas throws.
 */
export function hasWebGL(makeCanvas: () => { getContext(kind: string): unknown }): boolean {
  try {
    const context = makeCanvas().getContext('webgl2') as { getExtension?: (name: string) => unknown } | null | undefined
    if (context == null) return false
    // The probe's context is let go at once: browsers cap how many live WebGL contexts a page holds.
    try {
      const lose = context.getExtension?.('WEBGL_lose_context') as { loseContext?: () => void } | null | undefined
      lose?.loseContext?.()
    } catch {
      // freeing it is best effort
    }
    return true
  } catch {
    return false
  }
}

export function initialState(options: { reducedMotion: boolean }): MapState {
  return {
    level: 'all',
    project: null,
    topic: null,
    memory: null,
    projects: null,
    topics: null,
    memories: null,
    detail: null,
    hidden: [],
    colourBy: 'project',
    minRecalls: 0,
    rotating: !options.reducedMotion,
    slots: {},
  }
}

// ---- Drawn node ids: one namespace per kind ----

export const projectNodeId = (owner: string) => `p:${owner}`
export const topicNodeId = (topic: string) => `t:${topic}`
export const memoryNodeId = (id: string) => `m:${id}`

function parseNodeId(id: string): { kind: 'project' | 'topic' | 'memory'; key: string } | undefined {
  const kind = id.startsWith('p:') ? 'project' : id.startsWith('t:') ? 'topic' : id.startsWith('m:') ? 'memory' : undefined
  return kind === undefined ? undefined : { kind, key: id.slice(2) }
}

// ---- Lookups ----

const visibleProjects = (state: MapState) => (state.projects ?? []).filter(project => !state.hidden.includes(project.id))
const focusedProject = (state: MapState) => (state.projects ?? []).find(project => project.id === state.project)
const topicsOf = (state: MapState) => (state.topics !== null && state.topics.project === state.project ? state.topics.nodes : [])
const focusedTopic = (state: MapState) => topicsOf(state).find(topic => topic.id === state.topic)
const memoriesOf = (state: MapState) =>
  state.memories !== null && state.memories.project === state.project && state.memories.topic === state.topic ? state.memories.nodes : []
const focusedMemory = (state: MapState) => memoriesOf(state).find(memory => memory.id === state.memory)

const projectName = (state: MapState, owner: string | null) => (owner === null ? '' : (focusedProject(state)?.label ?? owner))
const topicName = (state: MapState, topic: string | null) => {
  if (topic === null) return ''
  return focusedTopic(state)?.label ?? (topic === 'untagged' ? 'Untagged' : topic.replace(/^tag:/, ''))
}

// ---- Moves: a click in the map and a press in the rail list are the same call ----

/** Choose a drawn node by its id: drill into it, switch to it, or go back to it. */
export function select(state: MapState, nodeId: string): MapState {
  const parsed = parseNodeId(nodeId)
  if (parsed === undefined) return state
  if (parsed.kind === 'project') {
    if (state.hidden.includes(parsed.key) || !(state.projects ?? []).some(node => node.id === parsed.key)) return state
    if (state.project === parsed.key && state.level === 'project') return state
    // The focused project (drawn above its topic) goes back to the project level; another switches to it.
    return { ...state, level: 'project', project: parsed.key, topic: null, memory: null, detail: null }
  }
  if (parsed.kind === 'topic') {
    if (state.level === 'all' || state.project === null || !topicsOf(state).some(node => node.id === parsed.key)) return state
    if (state.topic === parsed.key && state.level === 'topic') return state
    return { ...state, level: 'topic', topic: parsed.key, memory: null, detail: null }
  }
  if ((state.level !== 'topic' && state.level !== 'memory') || !memoriesOf(state).some(node => node.id === parsed.key)) return state
  if (state.memory === parsed.key) return state
  return { ...state, level: 'memory', memory: parsed.key, detail: null }
}

/** The path bar's parts: All memories, then the project, then the topic; the last is the current one. */
export function pathBar(state: MapState): { label: string; level: Level; current: boolean }[] {
  const parts: { label: string; level: Level }[] = [{ label: 'All memories', level: 'all' }]
  if (state.level !== 'all' && state.project !== null) parts.push({ label: projectName(state, state.project), level: 'project' })
  if ((state.level === 'topic' || state.level === 'memory') && state.topic !== null) parts.push({ label: topicName(state, state.topic), level: 'topic' })
  return parts.map((part, i) => ({ ...part, label: plainLabel(part.label, LABEL_CHARS), current: i === parts.length - 1 }))
}

/** Back up to an earlier level of the path (or stay); a deeper level than the current one is ignored. */
export function goTo(state: MapState, level: Level): MapState {
  if (level === 'all') return { ...state, level: 'all', project: null, topic: null, memory: null, detail: null }
  if (level === 'project' && state.level !== 'all') return { ...state, level: 'project', topic: null, memory: null, detail: null }
  if (level === 'topic' && (state.level === 'topic' || state.level === 'memory')) return { ...state, level: 'topic', memory: null, detail: null }
  return state
}

/** Reset view: back to All memories. Rotation, colour-by, toggles and min-recalls stay. */
export const reset = (state: MapState): MapState => goTo(state, 'all')

export const toggleRotation = (state: MapState): MapState => ({ ...state, rotating: !state.rotating })

export const setColourBy = (state: MapState, colourBy: ColourBy): MapState => (COLOUR_BY.includes(colourBy) ? { ...state, colourBy } : state)

/** Hide a shown project or show a hidden one; hiding the project in focus goes back to All memories. */
export function toggleProject(state: MapState, owner: string): MapState {
  const hiding = !state.hidden.includes(owner)
  const hidden = hiding ? [...state.hidden, owner] : state.hidden.filter(id => id !== owner)
  const next = { ...state, hidden }
  return hiding && state.project === owner ? goTo(next, 'all') : next
}

/** The min-recalls value (held to 0 - MIN_RECALLS_MAX). Every level is asked again; the focus stays while it still has memories. */
export function setMinRecalls(state: MapState, value: number): MapState {
  const minRecalls = Math.min(MIN_RECALLS_MAX, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)))
  if (minRecalls === state.minRecalls) return state
  return { ...state, minRecalls, projects: null, topics: null, memories: null }
}

// ---- Loading: which reply the state still needs, and taking it in ----

/** The next request the state needs, or null when it has every reply it draws from. */
export function needed(state: MapState): MapRequest | null {
  const minRecalls = state.minRecalls
  if (state.projects === null) return { kind: 'projects', minRecalls }
  if (state.level === 'all' || state.project === null) return null
  if (state.topics === null || state.topics.project !== state.project) return { kind: 'topics', project: state.project, minRecalls }
  if (state.level === 'project' || state.topic === null) return null
  if (state.memories === null || state.memories.project !== state.project || state.memories.topic !== state.topic) {
    return { kind: 'memories', project: state.project, topic: state.topic, minRecalls }
  }
  if (state.level === 'memory' && state.memory !== null && state.detail?.id !== state.memory) return { kind: 'memory', id: state.memory }
  return null
}

export const requestKey = (request: MapRequest | null) => (request === null ? '' : JSON.stringify(request))

/** The URL a request is fetched from (the token goes in a header, never here). */
export function requestPath(request: MapRequest): string {
  if (request.kind === 'memory') return `/api/memories/${encodeURIComponent(request.id)}`
  const params = new URLSearchParams()
  if (request.kind !== 'projects') params.set('project', request.project)
  if (request.kind === 'memories') {
    if (request.topic === 'untagged') params.set('untagged', '1')
    else params.set('tag', request.topic.replace(/^tag:/, ''))
  }
  if (request.minRecalls > 0) params.set('min_recalls', String(request.minRecalls))
  const query = params.toString()
  return query ? `/api/map?${query}` : '/api/map'
}

/**
 * Takes in the reply to `request` (the reply's nodes, or the memory; null for a
 * memory that is gone). A reply the state no longer needs is dropped. A focus
 * the new reply no longer holds (min-recalls rose, a memory was forgotten) is
 * left for the level above.
 */
export function receive(state: MapState, request: MapRequest, reply: unknown): MapState {
  if (requestKey(needed(state)) !== requestKey(request)) return state
  if (request.kind === 'projects') {
    const nodes = Array.isArray(reply) ? (reply as ProjectNode[]) : []
    const slots = { ...state.slots }
    let next = Object.keys(slots).length
    for (const node of nodes) if (slots[node.id] === undefined && node.id !== 'global') slots[node.id] = next++
    const loaded = { ...state, projects: nodes, slots }
    return state.project !== null && !nodes.some(node => node.id === state.project) ? goTo(loaded, 'all') : loaded
  }
  if (request.kind === 'topics') {
    const nodes = Array.isArray(reply) ? (reply as TopicNode[]) : []
    const loaded = { ...state, topics: { project: request.project, nodes } }
    return state.topic !== null && !nodes.some(node => node.id === state.topic) ? goTo(loaded, 'project') : loaded
  }
  if (request.kind === 'memories') {
    // The reply's nodes and total (the server cuts a long topic at its limit), or a bare list.
    const body = reply !== null && typeof reply === 'object' && !Array.isArray(reply) ? (reply as { nodes?: unknown; total?: unknown }) : { nodes: reply }
    const nodes = Array.isArray(body.nodes) ? (body.nodes as MemoryNode[]) : []
    const total = typeof body.total === 'number' && Number.isInteger(body.total) && body.total >= nodes.length ? body.total : nodes.length
    const loaded = { ...state, memories: { project: request.project, topic: request.topic, nodes, total } }
    return state.memory !== null && !nodes.some(node => node.id === state.memory) ? goTo(loaded, 'topic') : loaded
  }
  const detail = reply !== null && typeof reply === 'object' ? (reply as MemoryDetail) : null
  if (detail === null || detail.id !== request.id) return goTo(state, 'topic')
  return { ...state, detail }
}

// ---- Colours ----

/** The project palette (design/Main.dc.html first, then more); global is grey. */
export const PALETTE: readonly { colour: string; dark: string }[] = [
  { colour: '#4C8DDB', dark: '#173A66' },
  { colour: '#F0773A', dark: '#6B2A0A' },
  { colour: '#9B7BE3', dark: '#3B2470' },
  { colour: '#2FB3AE', dark: '#0B4A48' },
  { colour: '#E3B341', dark: '#5E4508' },
  { colour: '#E05D8C', dark: '#5C1630' },
  { colour: '#7BC86C', dark: '#245A1A' },
  { colour: '#5FA8D3', dark: '#16435E' },
]
export const GLOBAL_COLOUR = '#A9B4B2'
const LOW = [0x3a, 0x4a, 0x4e]
const MID = [0x2f, 0xb3, 0xae]
const HIGH = [0xf0, 0x77, 0x3a]

const hex = (rgb: readonly number[]) => `#${rgb.map(c => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`
const mix = (a: readonly number[], b: readonly number[], t: number) => a.map((c, i) => c + ((b[i] ?? c) - c) * t)

export const SELECTED_COLOUR = '#FFFFFF'
const BACKGROUND = [0x0e, 0x14, 0x16]

/** A colour halfway toward the map's background. */
export function dim(colour: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour)
  if (!match) return colour
  return hex(mix([1, 2, 3].map(i => Number.parseInt(match[i] ?? '0', 16)), BACKGROUND, 0.5))
}

/** A colour on the ramp from dim (0) through teal to orange (1). */
export function ramp(t: number): string {
  const v = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))
  return hex(v < 0.5 ? mix(LOW, MID, v * 2) : mix(MID, HIGH, (v - 0.5) * 2))
}

/** A project's own colour: its palette slot, grey for global. */
export function projectColour(state: MapState, owner: string): string {
  if (owner === 'global') return GLOBAL_COLOUR
  const slot = state.slots[owner]
  return PALETTE[(slot ?? 0) % PALETTE.length]?.colour ?? GLOBAL_COLOUR
}

const time = (value: string | null) => {
  const t = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(t) ? t : undefined
}

// ---- What is drawn, and where ----

export type Role = 'focus' | 'child' | 'aside'
export type DrawnNode = {
  id: string
  kind: 'project' | 'topic' | 'memory'
  role: Role
  label: string
  count: number
  colour: string
  radius: number
  selected: boolean
  /** Text for the 3D label under the sphere; empty for none. */
  caption: string
  x: number
  y: number
  z: number
}
export type DrawnLink = { source: string; target: string; colour: string }
export type Drawn = { nodes: DrawnNode[]; links: DrawnLink[] }

type Seed = Omit<DrawnNode, 'colour' | 'x' | 'y' | 'z' | 'caption'> & { owner: string; recalls: number; when: string | null }

/** `n` points around the origin: a ring in the x-z plane for a few, a sphere shell for many. */
export function layout(n: number, radius: number, spacing: number, y = 0): { x: number; y: number; z: number }[] {
  if (n === 0) return []
  if (n === 1 && radius === 0) return [{ x: 0, y, z: 0 }]
  if (n <= 24) {
    const r = Math.max(radius, (n * spacing) / (2 * Math.PI))
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * 2 * Math.PI
      return { x: r * Math.cos(a), y: y + (n > 2 ? 12 * Math.sin(3 * a) : 0), z: r * Math.sin(a) }
    })
  }
  const r = Math.max(radius, (Math.sqrt(n) * spacing) / (2 * Math.sqrt(Math.PI)))
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: n }, (_, i) => {
    const h = 1 - (2 * (i + 0.5)) / n
    const ring = Math.sqrt(1 - h * h)
    return { x: r * ring * Math.cos(golden * i), y: y + r * h, z: r * ring * Math.sin(golden * i) }
  })
}

const placeAt = (seeds: Seed[], points: { x: number; y: number; z: number }[]) => seeds.map((seed, i) => ({ seed, at: points[i] ?? { x: 0, y: 0, z: 0 } }))

/**
 * What the map draws at the state's level, and where:
 *   all     every shown project
 *   project the focused project, its topics, and the other shown projects small aside
 *   topic   the focused project and topic, its memories, and the sibling topics small aside
 *   memory  the topic level, with the chosen memory marked (the inspector shows it)
 * Siblings come from the cached reply of the level above.
 */
export function drawn(state: MapState): Drawn {
  const placed: { seed: Seed; at: { x: number; y: number; z: number } }[] = []
  const links: { source: string; target: string }[] = []
  const project = focusedProject(state)
  const projectSeed = (node: ProjectNode, role: Role, radius: number): Seed => ({
    id: projectNodeId(node.id),
    kind: 'project',
    role,
    label: node.label,
    count: node.count,
    radius,
    selected: false,
    owner: node.id,
    recalls: node.recalls,
    when: node.newest,
  })
  const topicSeed = (node: TopicNode, role: Role, radius: number): Seed => ({
    id: topicNodeId(node.id),
    kind: 'topic',
    role,
    label: node.label,
    count: node.count,
    radius,
    selected: false,
    owner: state.project ?? '',
    recalls: node.recalls,
    when: node.newest,
  })
  if (state.level === 'all' || project === undefined) {
    const shown = visibleProjects(state)
    const seeds = shown.map(node => projectSeed(node, 'child', 8 + 3 * Math.sqrt(node.count)))
    const biggest = Math.max(0, ...seeds.map(seed => seed.radius))
    placed.push(...placeAt(seeds, layout(seeds.length, seeds.length === 1 ? 0 : 140, 2 * biggest + 30)))
  } else if (state.level === 'project') {
    placed.push({ seed: projectSeed(project, 'focus', 26), at: { x: 0, y: 0, z: 0 } })
    const topics = topicsOf(state).map(node => topicSeed(node, 'child', 6 + 2 * Math.sqrt(node.count)))
    const biggest = Math.max(0, ...topics.map(seed => seed.radius))
    placed.push(...placeAt(topics, layout(topics.length, 110, 2 * biggest + 20)))
    for (const topic of topics) links.push({ source: projectNodeId(project.id), target: topic.id })
    const others = visibleProjects(state)
      .filter(node => node.id !== project.id)
      .map(node => projectSeed(node, 'aside', 5))
    const ringOut = Math.max(260, ...placed.map(p => Math.hypot(p.at.x, p.at.z) + 80))
    placed.push(...placeAt(others, layout(others.length, ringOut, 30, 110)))
  } else {
    const topic = focusedTopic(state)
    placed.push({ seed: projectSeed(project, 'focus', 12), at: { x: 0, y: 150, z: 0 } })
    if (topic !== undefined) {
      placed.push({ seed: topicSeed(topic, 'focus', 22), at: { x: 0, y: 0, z: 0 } })
      links.push({ source: projectNodeId(project.id), target: topicNodeId(topic.id) })
      const memories: Seed[] = memoriesOf(state).map(node => ({
        id: memoryNodeId(node.id),
        kind: 'memory',
        role: 'child',
        label: node.label,
        count: node.recall_count,
        radius: Math.min(12, 4 + Math.sqrt(node.recall_count)),
        selected: state.level === 'memory' && node.id === state.memory,
        owner: project.id,
        recalls: node.recall_count,
        when: node.timestamp,
      }))
      placed.push(...placeAt(memories, layout(memories.length, 100, 30)))
      for (const memory of memories) links.push({ source: topicNodeId(topic.id), target: memory.id })
      const siblings = topicsOf(state)
        .filter(node => node.id !== topic.id)
        .map(node => topicSeed(node, 'aside', 4))
      const ringOut = Math.max(240, ...placed.map(p => Math.hypot(p.at.x, p.at.z) + 80))
      placed.push(...placeAt(siblings, layout(siblings.length, ringOut, 24, -90)))
    }
  }
  // Colour: by project, or by recalls or age relative to the drawn nodes of the same kind.
  const seeds = placed.map(p => p.seed)
  const colourOf = (seed: Seed): string => {
    if (state.colourBy === 'project') return projectColour(state, seed.owner)
    const same = seeds.filter(other => other.kind === seed.kind)
    if (state.colourBy === 'recalls') {
      const most = Math.max(0, ...same.map(other => other.recalls))
      return ramp(most === 0 ? 0 : Math.log1p(seed.recalls) / Math.log1p(most))
    }
    const times = same.map(other => time(other.when)).filter((t): t is number => t !== undefined)
    const t = time(seed.when)
    if (t === undefined || times.length === 0) return ramp(0)
    const oldest = Math.min(...times)
    const newest = Math.max(...times)
    return ramp(newest === oldest ? 1 : (t - oldest) / (newest - oldest))
  }
  const nodes = placed.map(({ seed, at }) => {
    const { owner: _owner, recalls: _recalls, when: _when, ...node } = seed
    const caption = seed.role === 'aside' ? '' : seed.kind === 'memory' && !seed.selected ? '' : plainLabel(seed.label, 40)
    // Aside nodes are dimmed toward the map's background; the chosen memory is white.
    const colour = seed.selected ? SELECTED_COLOUR : seed.role === 'aside' ? dim(colourOf(seed)) : colourOf(seed)
    return { ...node, label: plainLabel(seed.label, LABEL_CHARS), caption, colour, x: at.x, y: at.y, z: at.z }
  })
  const colours = new Map(nodes.map(node => [node.id, node.colour]))
  return { nodes, links: links.map(link => ({ ...link, colour: colours.get(link.source) ?? GLOBAL_COLOUR })) }
}

// ---- The rail ----

export type RailItem = { id: string; label: string; count: number; colour: string; selected: boolean }
export type RailGroup = { title: string; items: RailItem[]; note?: string }

/**
 * The rail's list: exactly what drawn() draws, in a stable order. The children
 * first (under the list's heading), then Other projects or Other topics, then
 * In focus (the project, and the topic, at the centre). Each item's id is its
 * drawn node's id, so pressing it is select(state, id), as a click is.
 */
export function railList(state: MapState): { heading: string; groups: RailGroup[] } {
  const { nodes } = drawn(state)
  const item = (node: DrawnNode): RailItem => ({ id: node.id, label: node.label, count: node.count, colour: node.colour, selected: node.selected })
  const children = nodes.filter(node => node.role === 'child').map(item)
  const aside = nodes.filter(node => node.role === 'aside').map(item)
  const focus = nodes.filter(node => node.role === 'focus').map(item)
  let heading = 'Projects to open'
  if (state.level === 'project') heading = `Topics in ${projectName(state, state.project)}`
  if (state.level === 'topic' || state.level === 'memory') heading = `Memories in ${topicName(state, state.topic)}`
  if (state.level !== 'all' && focusedProject(state) === undefined) heading = 'Projects to open'
  const groups: RailGroup[] = [{ title: plainLabel(heading, LABEL_CHARS), items: children }]
  // A topic holding more memories than the server sends says so.
  const total = state.memories !== null && memoriesOf(state).length > 0 ? state.memories.total : 0
  if ((state.level === 'topic' || state.level === 'memory') && total > children.length && groups[0] !== undefined) {
    groups[0].note = `Showing ${children.length} of ${total} memories (the most recent).`
  }
  if (aside.length > 0) groups.push({ title: state.level === 'project' ? 'Other projects' : 'Other topics', items: aside })
  if (focus.length > 0) groups.push({ title: 'In focus', items: focus })
  return { heading: groups[0]?.title ?? '', groups }
}

/** The project toggles: every project the last reply holds, with its count and whether it is shown. */
export function projectToggles(state: MapState): { id: string; label: string; count: number; colour: string; shown: boolean }[] {
  return (state.projects ?? []).map(node => ({
    id: node.id,
    label: plainLabel(node.label, LABEL_CHARS),
    count: node.count,
    colour: projectColour(state, node.id),
    shown: !state.hidden.includes(node.id),
  }))
}

// ---- The inspector, and the words for a screen reader ----

/** A date as YYYY-MM-DD, local time; '' when there is none. */
export function savedDay(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export type Inspector = {
  kind: 'Overview' | 'Project' | 'Topic' | 'Memory'
  title: string
  sub: string
  colour: string
  stats: { label: string; value: string }[]
  hint: string
  /** For a memory: its text, tags, recalls, saved date, and the id Open in Memories opens. */
  memory?: { id: string; text: string; tags: string[]; recalls: number; saved: string; loading: boolean; openInMemories: string }
}

export function inspector(state: MapState): Inspector {
  const project = focusedProject(state)
  if (state.level === 'all' || project === undefined) {
    const shown = visibleProjects(state)
    const total = shown.reduce((sum, node) => sum + node.count, 0)
    const recalls = shown.reduce((sum, node) => sum + node.recalls, 0)
    const biggest = [...shown].sort((a, b) => b.count - a.count)[0]
    return {
      kind: 'Overview',
      title: `${total} ${total === 1 ? 'memory' : 'memories'}`,
      sub: `${shown.length} ${shown.length === 1 ? 'project' : 'projects'}`,
      colour: PALETTE[3]?.colour ?? GLOBAL_COLOUR,
      stats: [
        { label: 'Recalls, all time', value: String(recalls) },
        { label: 'Biggest project', value: biggest ? plainLabel(biggest.label, LABEL_CHARS) : '—' },
      ],
      hint: 'Click a project to fly in. Click a topic, then a memory, to drill down.',
    }
  }
  const colour = projectColour(state, project.id)
  const projectLabel = plainLabel(project.label, LABEL_CHARS)
  if (state.level === 'project') {
    const topics = topicsOf(state)
    return {
      kind: 'Project',
      title: projectLabel,
      sub: `${topics.length} ${topics.length === 1 ? 'topic' : 'topics'}`,
      colour,
      stats: [
        { label: 'Memories', value: String(project.count) },
        { label: 'Recalls', value: String(project.recalls) },
      ],
      hint: 'Topics come from tags. Click one to see its memories.',
    }
  }
  const topic = focusedTopic(state)
  const topicLabel = plainLabel(topicName(state, state.topic), LABEL_CHARS)
  const memory = focusedMemory(state)
  if (state.level === 'topic' || memory === undefined) {
    return {
      kind: 'Topic',
      title: topicLabel,
      sub: projectLabel,
      colour,
      stats: [
        { label: 'Memories', value: String(topic?.count ?? memoriesOf(state).length) },
        { label: 'Recalls', value: String(topic?.recalls ?? 0) },
      ],
      hint: 'Click a memory to read it.',
    }
  }
  const detail = state.detail?.id === memory.id ? state.detail : null
  const recalls = detail?.recall_count ?? memory.recall_count
  const saved = savedDay(detail?.timestamp ?? memory.timestamp) || 'unknown'
  return {
    kind: 'Memory',
    title: plainLabel(memory.label, LABEL_CHARS),
    sub: `${projectLabel} · ${topicLabel}`,
    colour,
    stats: [
      { label: 'Recalls', value: String(recalls) },
      { label: 'Saved', value: saved },
    ],
    hint: '',
    memory: {
      id: memory.id,
      // Shown with textContent, in full: line breaks kept.
      text: detail?.content ?? memory.label,
      tags: detail?.tags ?? memory.tags,
      recalls,
      saved,
      loading: detail === null,
      openInMemories: memory.id,
    },
  }
}

/** What the aria-live region says after a level change. */
export function levelAnnouncement(state: MapState): string {
  const groups = railList(state).groups
  const children = groups[0]?.items.length ?? 0
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  if (state.level === 'all' || focusedProject(state) === undefined) return `All memories: ${plural(children, 'project', 'projects')}.`
  const projectLabel = plainLabel(projectName(state, state.project), LABEL_CHARS)
  if (state.level === 'project') return `Project ${projectLabel}: ${plural(children, 'topic', 'topics')}.`
  const topicLabel = plainLabel(topicName(state, state.topic), LABEL_CHARS)
  if (state.level === 'topic') return `Topic ${topicLabel} in ${projectLabel}: ${plural(children, 'memory', 'memories')}.`
  return `Memory ${plainLabel(focusedMemory(state)?.label ?? '', LABEL_CHARS)}, in ${topicLabel}.`
}

/** The rotate button: one fixed label; aria-pressed says whether rotation is on. */
export const ROTATE_LABEL = 'Auto-rotate'
export const rotateButton = (state: MapState) => ({ label: ROTATE_LABEL, pressed: state.rotating })
