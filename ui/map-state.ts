// The memory galaxy's logic (plan GAL), with no DOM and no three.js, so a Bun
// spec tests all of it: the galaxy built from GET /api/galaxy, colour modes,
// star and core sizes, the dimming rules, hover text, Find, the path bar, the
// camera flights, the rail lists, the inspector, and WebGL detection.
// ui/map.ts draws what this returns and sends every click and key here.
//
// Positions come from ui/map-layout.ts (galaxyLayout) and are never changed here.
// The mockup this follows is design/MapGalaxy.dc.html (colourOf, recolour, frame,
// pick, hover, focusProject, focusTopic, selectMemory, search, flyTo).
//
// Every transition returns a new state; none changes the one it is given.
import { plainLabel } from './escape'
import { gauss, galaxyLayout, placeOne, randomOf, rangeDays, seedOf, ticks, timelinePosition, LANE_SPAN, TIMELINE_DAYS_X, TIMELINE_TODAY_X, type GalaxyInputMemory, type GalaxyLayout, type GalaxyStar, type Tick, type TimelineRange, type Vec3 } from './map-layout'
import type { MapEvent, MapEventKind } from './map-live'

// ---- What the server sends ----

type GalaxyProject = { owner: string; label: string; count: number; recalls: number }
type GalaxyMemory = { id: string; owner: string; tags: string[]; recalls: number; lastRecalled: string | null; created: string | null; label: string }
/** The five kinds of knowledge a memory is mined into, in the order the chips show them. */
export const KNOWLEDGE_KINDS = ['fact', 'preference', 'instruction', 'timeline', 'relation'] as const
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number]
/** One knowledge row of /api/galaxy: its id (`<kind>:<rowid>`), kind, text (the API cuts it to 80) and the memory it came from. */
type KnowledgeRow = { id: string; kind: KnowledgeKind; text: string; memory: string }
export type GalaxyReply = { projects: GalaxyProject[]; memories: GalaxyMemory[]; knowledge: KnowledgeRow[]; meaning: boolean; total: number; shown: number }

const LABEL_CHARS = 80
// Knowledge text is shown as the API gives it (a KSTORE item can be 500 characters, the route cuts it to 80); this only bounds a bad reply.
const KNOWLEDGE_CHARS = 500
const isKind = (value: unknown): value is KnowledgeKind => (KNOWLEDGE_KINDS as readonly unknown[]).includes(value)

const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)
const stamp = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null)

/** A /api/galaxy reply made safe to use: a field of the wrong type is replaced, a row without an id is dropped; null when it is no object at all. */
export function parseGalaxy(body: unknown): GalaxyReply | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const raw = body as Record<string, unknown>
  const rows = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object') : [])
  const memories = rows(raw.memories)
    .filter(row => typeof row.id === 'string' && row.id !== '')
    .map(row => ({
      id: text(row.id),
      owner: text(row.owner, 'global'),
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string' && tag !== '') : [],
      recalls: count(row.recalls),
      lastRecalled: stamp(row.lastRecalled),
      created: stamp(row.created),
      label: plainLabel(text(row.label), LABEL_CHARS),
    }))
  const projects = rows(raw.projects)
    .filter(row => typeof row.owner === 'string' && row.owner !== '')
    .map(row => ({ owner: text(row.owner), label: plainLabel(text(row.label, text(row.owner)), 60), count: count(row.count), recalls: count(row.recalls) }))
  const seenIds = new Set<string>()
  const knowledge = rows(raw.knowledge)
    .filter(row => typeof row.id === 'string' && row.id !== '' && isKind(row.kind) && typeof row.memory === 'string' && row.memory !== '')
    .filter(row => !seenIds.has(row.id as string) && seenIds.add(row.id as string))
    .map(row => ({ id: text(row.id), kind: row.kind as KnowledgeKind, text: plainLabel(text(row.text), KNOWLEDGE_CHARS), memory: text(row.memory) }))
  return { projects, memories, knowledge, meaning: raw.meaning === true, total: Math.max(count(raw.total), memories.length), shown: memories.length }
}

// ---- WebGL, and the library's tooltip ----

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

// ---- Colours ----

type ColourBy = 'project' | 'recalls' | 'age'
const COLOUR_BY: readonly ColourBy[] = ['project', 'recalls', 'age']

/** The project palette (design/Main.dc.html first, then more); global is grey. */
const PALETTE: readonly string[] = ['#4C8DDB', '#F0773A', '#9B7BE3', '#2FB3AE', '#E3B341', '#E05D8C', '#7BC86C', '#5FA8D3']
export const GLOBAL_COLOUR = '#A9B4B2'
export const BACKGROUND = '#04060B'
export const BRIDGE_COLOUR = '#E8B04A'
export const CLAUDE_COLOUR = '#FFFFFF'
const RECALL_LOW = '#2C5C7A'
const RECALL_HIGH = '#FFD978'
const AGE_NEW = '#7DF4FF'
const AGE_OLD = '#5B3F9A'

const channels = (colour: string): [number, number, number] => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour)
  return match ? [Number.parseInt(match[1]!, 16), Number.parseInt(match[2]!, 16), Number.parseInt(match[3]!, 16)] : [255, 255, 255]
}
const clamp01 = (t: number) => Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0))

/** `a` moved `t` of the way toward `b`, as #RRGGBB. */
export function mixColour(a: string, b: string, t: number): string {
  const [ar, ag, ab] = channels(a)
  const [br, bg, bb] = channels(b)
  const k = clamp01(t)
  const part = (x: number, y: number) =>
    Math.round(x + (y - x) * k)
      .toString(16)
      .padStart(2, '0')
  return `#${part(ar, br)}${part(ag, bg)}${part(ab, bb)}`.toUpperCase()
}

/** #RRGGBB as 0..1 channels for a shader or a THREE colour. */
export const rgb01 = (colour: string): Vec3 => channels(colour).map(c => c / 255) as Vec3

/** The colour with an alpha, as the rgba() text the library reads for a link. */
export function rgba(colour: string, alpha: number): string {
  const [r, g, b] = channels(colour)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** A topic hub's colour: its project's, 45% toward white. */
export const hubColour = (project: string) => mixColour(project, '#FFFFFF', 0.45)

/** Recalls on the ramp #2C5C7A to #FFD978 by the square root of the share of the most recalled. */
export const recallColour = (recalls: number, maxRecalls: number) => mixColour(RECALL_LOW, RECALL_HIGH, maxRecalls > 0 ? Math.sqrt(Math.max(0, recalls) / maxRecalls) : 0)

/** Age on the ramp #7DF4FF (new) to #5B3F9A (the oldest memory). */
export const ageColour = (ageDays: number, oldestDays: number) => mixColour(AGE_NEW, AGE_OLD, oldestDays > 0 ? ageDays / oldestDays : 0)

// ---- Sizes and brightness ----

/** A memory's glow size: 7 + sqrt(recalls) * 3.4. */
export const starSize = (recalls: number) => 7 + Math.sqrt(Math.max(0, recalls)) * 3.4
/** A project core's glow size: 26 + sqrt(count) * 4. */
export const coreSize = (memories: number) => 26 + Math.sqrt(Math.max(0, memories)) * 4
export const HUB_SIZE = 11
export const CLAUDE_SIZE = 30
/** Brightness: 0.4 for the oldest memory up to 1.0 for the newest. */
export const starBrightness = (ageDays: number, oldestDays: number) => 0.4 + 0.6 * (1 - (oldestDays > 0 ? clamp01(ageDays / oldestDays) : 0))
/** A memory never recalled is drawn as a hollow ring. */
export const isHollow = (recalls: number) => recalls === 0
/** A label shrinks as the camera comes close: clamp(distance / 520, 0.2, 1). */
export const labelScale = (distance: number) => Math.min(1, Math.max(0.2, distance / 520))
/** The selected star's pulse. */
export const selectedPulse = (seconds: number) => 0.22 + 0.14 * Math.sin(seconds * 4)

/** The original, strong glow (0.6.0 shipped with it as the only setting). Now the "full" level. */
export const BLOOM = { strength: 0.95, radius: 0.55, threshold: 0.12 } as const

// ---- Glow: how strong the bloom is (off, soft, full) ----

export type GlowLevel = 'off' | 'soft' | 'full'
export const GLOW_LEVELS: readonly GlowLevel[] = ['off', 'soft', 'full']
export const GLOW_KEY = 'mnemosyne.map.glow'
/** Soft is the default: a higher threshold so ordinary stars do not bloom at all, only the brightest cores, and a gentler strength. */
export const BLOOM_SOFT = { strength: 0.35, radius: 0.3, threshold: 0.35 } as const

/** The bloom pass settings for a level. Off keeps the soft numbers but the pass is switched off. */
export function bloomFor(level: GlowLevel): { enabled: boolean; strength: number; radius: number; threshold: number } {
  if (level === 'full') return { enabled: true, ...BLOOM }
  if (level === 'off') return { enabled: false, ...BLOOM_SOFT }
  return { enabled: true, ...BLOOM_SOFT }
}

/** A stored glow value as a valid level: anything unknown (or no value) is the soft default. */
export function glowLevel(stored: string | null | undefined): GlowLevel {
  return GLOW_LEVELS.find(level => level === stored) ?? 'soft'
}

/** The stored glow level, or null when there is none or storage throws (private windows, blocked storage). */
export function readGlow(storage: Pick<Storage, 'getItem'> | undefined): string | null {
  try {
    return storage?.getItem(GLOW_KEY) ?? null
  } catch {
    return null
  }
}

/** Remembers the glow level picked; failure is ignored. */
export function saveGlow(storage: Pick<Storage, 'setItem'> | undefined, level: GlowLevel): void {
  try {
    storage?.setItem(GLOW_KEY, level)
  } catch {
    // storage is a convenience only
  }
}
const THREAD_OPACITY = 0.16
const THREAD_OPACITY_FOCUSED = 0.3
export const BRIDGE_OPACITY = 0.55
export const BRIDGE_PARTICLES = 4
export const STARFIELD_COUNT = 2400
const STARFIELD_INNER = 1600
const STARFIELD_OUTER = 2800

/** Topic threads: 0.16, or 0.3 while a project is focused. */
export const threadOpacity = (focused: boolean) => (focused ? THREAD_OPACITY_FOCUSED : THREAD_OPACITY)

/** The background stars: x, y, z for each, on a shell from 1600 to 2800 units out, the same on every call. */
export function starfield(n = STARFIELD_COUNT): Float32Array {
  const random = randomOf(seedOf('mnemosyne-starfield'))
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const u = random() * 2 - 1
    const theta = random() * Math.PI * 2
    const r = STARFIELD_INNER + random() * (STARFIELD_OUTER - STARFIELD_INNER)
    const q = Math.sqrt(1 - u * u)
    out[i * 3] = Math.cos(theta) * q * r
    out[i * 3 + 1] = u * r
    out[i * 3 + 2] = Math.sin(theta) * q * r
  }
  return out
}

// ---- The galaxy: the reply laid out ----

export type Galaxy = {
  layout: GalaxyLayout
  meaning: boolean
  total: number
  shown: number
  /** Days since each star was saved, by star index. Ages are rolling from the load time (or a memory's last update): they are not advanced while the page stays open. */
  ages: number[]
  /** The age of the oldest memory still on the map; kept current by touchMemory and forgetMemory. */
  oldestAge: number
  /** Ids of memories with no usable save date: drawn in Galaxy, left off the Timeline axis. */
  undated: Set<string>
  maxRecalls: number
  /** Project colour by owner. */
  colours: Map<string, string>
  /** Memories forgotten while the page is open: their stars fade out and no count holds them. */
  gone: Set<string>
  /** The knowledge rows of each memory (by memory id), in the order the server sent them; a Map so an id named like an Object member is safe. */
  knowledge: Map<string, KnowledgeRow[]>
  /** The same rows by their own id. */
  knowledgeById: Map<string, KnowledgeRow>
}

const DAY_MS = 86_400_000

/** The reply laid out with galaxyLayout, and the numbers every colour and brightness needs. */
export function buildGalaxy(reply: GalaxyReply, now = Date.now()): Galaxy {
  const input: GalaxyInputMemory[] = reply.memories
  const layout = galaxyLayout({ projects: reply.projects, memories: input })
  const undated = new Set<string>()
  const ages = layout.stars.map(star => {
    const saved = star.created ? Date.parse(star.created) : Number.NaN
    if (!Number.isFinite(saved)) {
      // No usable date: age 0 keeps its Galaxy brightness and colour, but the Timeline leaves it off the axis.
      undated.add(star.id)
      return 0
    }
    // A date in the future counts as today.
    return Math.max(0, Math.floor((now - saved) / DAY_MS))
  })
  const colours = new Map<string, string>()
  layout.cores.forEach((core, i) => {
    colours.set(core.owner, core.owner === 'global' ? GLOBAL_COLOUR : PALETTE[i % PALETTE.length]!)
  })
  return {
    layout,
    meaning: reply.meaning,
    total: reply.total,
    shown: reply.shown,
    ages,
    oldestAge: ages.reduce((a, b) => Math.max(a, b), 0),
    undated,
    maxRecalls: layout.stars.reduce((a, star) => Math.max(a, star.recalls), 0),
    colours,
    gone: new Set(),
    ...knowledgeIndex(reply.knowledge, input),
  }
}

/** The knowledge rows grouped by their memory; a row whose memory is not in the reply (cut by the 2000 limit) is dropped. */
function knowledgeIndex(rows: readonly KnowledgeRow[], memories: readonly { id: string }[]): Pick<Galaxy, 'knowledge' | 'knowledgeById'> {
  const known = new Set(memories.map(memory => memory.id))
  const knowledge = new Map<string, KnowledgeRow[]>()
  const knowledgeById = new Map<string, KnowledgeRow>()
  for (const row of rows) {
    if (!known.has(row.memory)) continue
    const list = knowledge.get(row.memory) ?? []
    list.push(row)
    knowledge.set(row.memory, list)
    knowledgeById.set(row.id, row)
  }
  return { knowledge, knowledgeById }
}

/** The stars still in the galaxy: all but the memories forgotten while the page was open. */
export const liveStars = (galaxy: Galaxy) => galaxy.layout.stars.filter(star => !galaxy.gone.has(star.id))

/** A project's colour (grey for one the galaxy does not hold). */
export const projectColour = (galaxy: Galaxy, owner: string) => galaxy.colours.get(owner) ?? GLOBAL_COLOUR

/** A star's colour in a mode. */
export function starColour(galaxy: Galaxy, index: number, mode: ColourBy): string {
  const star = galaxy.layout.stars[index]
  if (star === undefined) return GLOBAL_COLOUR
  if (mode === 'recalls') return recallColour(star.recalls, galaxy.maxRecalls)
  if (mode === 'age') return ageColour(galaxy.ages[index] ?? 0, galaxy.oldestAge)
  return projectColour(galaxy, star.owner)
}

/** The topic name a star belongs to (its hub's). */
function topicName(galaxy: Galaxy, star: GalaxyStar): string {
  return galaxy.layout.hubs[slotOf(galaxy.layout.hubByKey, star.topic)]?.name ?? 'Untagged'
}

/** The index a layout map holds for a key, or -1: an owner or id named like an Object member (constructor, toString) has no slot unless it was given one. */
export const slotOf = (map: Record<string, number>, key: string): number => (Object.hasOwn(map, key) ? (map[key] as number) : -1)

const coreLabel = (galaxy: Galaxy, owner: string) => galaxy.layout.cores[slotOf(galaxy.layout.coreByOwner, owner)]?.label ?? owner

/** Topics two projects share, by hub key: the other end of every bridge. */
export function sharedWith(galaxy: Galaxy, hubKey: string): string[] {
  const owners = new Set<string>()
  for (const bridge of galaxy.layout.bridges) {
    const other = bridge.a === hubKey ? bridge.b : bridge.b === hubKey ? bridge.a : null
    const hub = other === null ? undefined : galaxy.layout.hubs[slotOf(galaxy.layout.hubByKey, other)]
    if (hub !== undefined) owners.add(hub.project)
  }
  return [...owners].map(owner => coreLabel(galaxy, owner)).sort((a, b) => a.localeCompare(b))
}

// ---- Settings and focus: the state ----

export type LayoutName = 'galaxy' | 'meaning' | 'timeline'
const LAYOUTS: readonly LayoutName[] = ['galaxy', 'meaning', 'timeline']
export const LAYOUT_KEY = 'mnemosyne.map.layout'

export type MapState = {
  layout: LayoutName
  range: TimelineRange
  colourBy: ColourBy
  spokes: boolean
  bridges: boolean
  layerRecall: boolean
  layerWrite: boolean
  live: boolean
  rotating: boolean
  /** Whether auto-rotate was on when Timeline was entered, so leaving Timeline can turn it back on (TIME.1). */
  rotateBefore: boolean
  reducedMotion: boolean
  /** Owners whose stars are hidden (a Set: an owner may be named like an Object member). */
  hidden: ReadonlySet<string>
  /** The focused project (owner), topic (hub key) and selected memory (id). */
  project: string | null
  topic: string | null
  selected: string | null
  query: string
  /** Knowledge moons on (MOON.1): the knowledge rows of the selected memory orbit its star. */
  moons: boolean
  /** The selected knowledge row (its id) of the selected memory, or null. */
  moon: string | null
  /** The Knowledge chips picked (MOON.2): only memories with one of these kinds stay lit. */
  kinds: ReadonlySet<KnowledgeKind>
}

export function initialState(options: { reducedMotion: boolean; layout?: LayoutName }): MapState {
  const timeline = options.layout === 'timeline'
  return {
    layout: options.layout ?? 'galaxy',
    range: 'all',
    colourBy: 'project',
    spokes: true,
    bridges: true,
    layerRecall: true,
    layerWrite: true,
    live: !options.reducedMotion,
    // Opening on Timeline starts as a switch to it would: no auto-rotate, remembered for the way back.
    rotating: !options.reducedMotion && !timeline,
    rotateBefore: !options.reducedMotion && timeline,
    reducedMotion: options.reducedMotion,
    hidden: new Set<string>(),
    project: null,
    topic: null,
    selected: null,
    query: '',
    moons: true,
    moon: null,
    kinds: new Set<KnowledgeKind>(),
  }
}

/** The layout to open on: the one stored, else Galaxy; Galaxy too when Meaning is stored but unavailable. */
export function initialLayout(stored: string | null | undefined, meaningAvailable: boolean): LayoutName {
  const layout = LAYOUTS.find(name => name === stored)
  if (layout === undefined || (layout === 'meaning' && !meaningAvailable)) return 'galaxy'
  return layout
}

/** The stored layout, or null when there is none or storage throws (private windows, blocked storage). */
export function readLayout(storage: Pick<Storage, 'getItem'> | undefined): string | null {
  try {
    return storage?.getItem(LAYOUT_KEY) ?? null
  } catch {
    return null
  }
}

/** Remembers the layout picked; failure is ignored. */
export function saveLayout(storage: Pick<Storage, 'setItem'> | undefined, layout: LayoutName): void {
  try {
    storage?.setItem(LAYOUT_KEY, layout)
  } catch {
    // storage is a convenience only
  }
}

/** Switch layout. Entering Timeline pauses auto-rotate (a time axis seen end-on reads as nothing) and remembers whether it was on; leaving turns it back on only if it was. */
export function setLayout(state: MapState, layout: LayoutName, meaningAvailable: boolean): MapState {
  if (!LAYOUTS.includes(layout) || (layout === 'meaning' && !meaningAvailable)) return state
  if (layout === state.layout) return state
  if (layout === 'timeline') return { ...state, layout, rotating: false, rotateBefore: state.rotating }
  if (state.layout === 'timeline') return { ...state, layout, rotating: state.rotateBefore || state.rotating, rotateBefore: false }
  return { ...state, layout }
}
export const setRange = (state: MapState, range: TimelineRange): MapState => (range === state.range || ![7, 30, 'all'].includes(range) ? state : { ...state, range })
export const setColourBy = (state: MapState, colourBy: ColourBy): MapState => (COLOUR_BY.includes(colourBy) && colourBy !== state.colourBy ? { ...state, colourBy } : state)
export const toggleSpokes = (state: MapState): MapState => ({ ...state, spokes: !state.spokes })
export const toggleBridges = (state: MapState): MapState => ({ ...state, bridges: !state.bridges })
export const toggleRotation = (state: MapState): MapState => ({ ...state, rotating: !state.rotating })
export const toggleLayer = (state: MapState, layer: 'recall' | 'write'): MapState => (layer === 'recall' ? { ...state, layerRecall: !state.layerRecall } : { ...state, layerWrite: !state.layerWrite })
export const setQuery = (state: MapState, query: string): MapState => (query === state.query ? state : { ...state, query })

/** Focus a project: its stars stay bright, the others dim; no topic or memory is picked. */
export const focusProject = (state: MapState, owner: string): MapState => ({ ...state, project: owner, topic: null, selected: null, moon: null })

/** Focus a topic (a hub key `<owner>/<tag>`): its project comes into focus too. */
export function focusTopic(state: MapState, galaxy: Galaxy, key: string): MapState {
  const hub = galaxy.layout.hubs[slotOf(galaxy.layout.hubByKey, key)]
  return hub === undefined ? state : { ...state, project: hub.project, topic: key, selected: null, moon: null }
}

/** Select a memory: its project and topic come into focus. */
export function selectStar(state: MapState, galaxy: Galaxy, id: string): MapState {
  const star = galaxy.layout.stars[slotOf(galaxy.layout.starById, id)]
  return star === undefined || galaxy.gone.has(id) ? state : { ...state, project: star.owner, topic: star.topic, selected: id, moon: state.selected === id ? state.moon : null }
}

/** Reset view: no focus, no memory, no Find, and no Knowledge chips. */
export const resetView = (state: MapState): MapState => ({ ...state, project: null, topic: null, selected: null, moon: null, query: '', kinds: state.kinds.size === 0 ? state.kinds : new Set() })

/** Hide or show a project's stars; hiding the focused project clears the focus. */
export function toggleProject(state: MapState, owner: string): MapState {
  const hidden = new Set(state.hidden)
  if (hidden.has(owner)) hidden.delete(owner)
  else hidden.add(owner)
  const hiding = hidden.has(owner)
  return hiding && state.project === owner ? { ...state, hidden, project: null, topic: null, selected: null, moon: null } : { ...state, hidden }
}

// ---- The path bar ----

type PathLevel = 'all' | 'project' | 'topic'
type Crumb = { label: string; level: PathLevel; current: boolean }

/** All memories > project > topic; the deepest part is current unless a memory is selected. */
export function pathBar(state: MapState, galaxy: Galaxy): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'All memories', level: 'all', current: state.project === null }]
  if (state.project !== null) crumbs.push({ label: coreLabel(galaxy, state.project), level: 'project', current: state.topic === null })
  if (state.topic !== null) {
    const hub = galaxy.layout.hubs[slotOf(galaxy.layout.hubByKey, state.topic)]
    crumbs.push({ label: hub?.name ?? state.topic, level: 'topic', current: state.selected === null })
  }
  return crumbs
}

/** What a crumb does: All is Reset view; a project or topic crumb goes back to it (clearing what is deeper). */
export function goTo(state: MapState, level: PathLevel): MapState {
  if (level === 'all') return resetView(state)
  if (level === 'project') return state.project === null ? state : focusProject(state, state.project)
  return state.topic === null ? state : { ...state, selected: null, moon: null }
}

// ---- Find ----

/** Whether a star matches a Find query: a tag, the project, or its 80-character label contains it (case aside); never the full text. */
export function matchesQuery(galaxy: Galaxy, star: GalaxyStar, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '' || galaxy.gone.has(star.id)) return false
  return star.tags.some(tag => tag.toLowerCase().includes(q)) || star.owner.toLowerCase().includes(q) || coreLabel(galaxy, star.owner).toLowerCase().includes(q) || star.label.toLowerCase().includes(q)
}

export type Found = { ids: Set<string>; count: number; centre: Vec3 | null; distance: number }

/** The stars a query finds, the centre of them, and how far the camera stands: 520 above 20 matches, else 260. */
export function find(galaxy: Galaxy, query: string): Found {
  const ids = new Set<string>()
  const centre: Vec3 = [0, 0, 0]
  for (const star of galaxy.layout.stars) {
    if (!matchesQuery(galaxy, star, query)) continue
    ids.add(star.id)
    for (let i = 0; i < 3; i++) centre[i] = centre[i]! + star.position[i]!
  }
  const n = ids.size
  return { ids, count: n, centre: n === 0 ? null : (centre.map(v => v / n) as Vec3), distance: n > 20 ? 520 : 260 }
}

export const FIND_FLY_DELAY_MS = 250

/** Whether Find should fly the camera: only to a match centre it has not already flown to (a keystroke that leaves the centre where it was does not restart the flight). */
export function shouldFlyToFound(found: Found, lastFlown: Vec3 | null): boolean {
  if (found.centre === null) return false
  if (lastFlown === null) return true
  return Math.hypot(found.centre[0] - lastFlown[0], found.centre[1] - lastFlown[1], found.centre[2] - lastFlown[2]) > 1
}

/** The Find box's count: '' for an empty query, else 'n found'. */
export const foundText = (query: string, found: Found) => (query.trim() === '' ? '' : `${found.count} found`)

// ---- What dims, and by how much ----

const DIM_OTHER_PROJECT = 0.14
const DIM_OTHER_TOPIC = 0.4
const DIM_NO_MATCH = 0.08
/** A memory without any of the picked kinds keeps a tenth of its brightness (MOON.2). */
export const DIM_NO_KNOWLEDGE = 0.1

/** The opacity a star settles at: brightness by age, 0 hidden, 0 older than the Timeline range or without a save date, 0.14 outside the focused project, 0.4 in its other topics, 0.08 off a Find, a tenth without a picked kind of knowledge, 1 when selected. */
export function starTarget(galaxy: Galaxy, index: number, state: MapState, found: Found | null): number {
  const star = galaxy.layout.stars[index]
  if (star === undefined) return 0
  if (state.hidden.has(star.owner) || galaxy.gone.has(star.id)) return 0
  if (state.selected === star.id) return 1
  if (state.layout === 'timeline' && !onTimelineAxis(galaxy, index, timelineDays(galaxy, state.range))) return 0
  let a = starBrightness(galaxy.ages[index] ?? 0, galaxy.oldestAge)
  if (!passesKnowledgeFilter(galaxy, star.id, state)) a *= DIM_NO_KNOWLEDGE
  if (state.project !== null && star.owner !== state.project) a *= DIM_OTHER_PROJECT
  if (state.topic !== null && star.topic !== state.topic && star.owner === state.project) a *= DIM_OTHER_TOPIC
  if (found !== null && state.query.trim() !== '' && !found.ids.has(star.id)) a *= DIM_NO_MATCH
  return a
}

/** A project core's opacity: 0 hidden, 0.35 beside the focused project, else 1. */
export const coreTarget = (state: MapState, owner: string) => (state.hidden.has(owner) ? 0 : state.project !== null && state.project !== owner ? 0.35 : 1)

/** A topic hub's opacity: 0 hidden; 1 in the focused project (0.5 beside the focused topic), 0.1 in another, 0.55 with no focus. */
export function hubTarget(state: MapState, project: string, key: string): number {
  if (state.hidden.has(project)) return 0
  if (state.project === null) return 0.55
  if (state.project !== project) return 0.1
  return state.topic !== null && state.topic !== key ? 0.5 : 1
}

/** Topic labels show only for the focused project. */
export const hubLabelTarget = (state: MapState, project: string) => (state.project === project && !state.hidden.has(project) ? 0.95 : 0)

// ---- Knowledge moons (MOON.1) and the knowledge filter (MOON.2) ----
//
// Every knowledge row names the memory it was mined from. The selected star shows
// its rows (at most 8) as moons on a circle of radius 18; the Knowledge chips
// count the memories that have each kind and, when picked, dim the others. The
// numbers below are the mockup's (design/MapGalaxy.dc.html: moonHex, moonRgb,
// frame's moons block, knowChips, knowFilter). The data is whatever /api/galaxy
// held at page load: an `extract` activity line does not refetch it, so knowledge
// mined later shows after a reload (stated limit).

export const MOON_LIMIT = 8
export const MOON_RADIUS = 18
/** Orbit speed in radians per second; 0 under prefers-reduced-motion (the moons stand still). */
export const MOON_SPEED = 0.45
export const MOON_SIZE = 6.5
export const MOON_SIZE_SELECTED = 9
/** The thin line from the star to each moon. */
export const MOON_LINE_OPACITY = 0.35
export const MOON_LINE_COLOUR = '#CFE3FF'
export const MOON_PICK_RADIUS = 12
export const MOON_COLOURS: Readonly<Record<KnowledgeKind, string>> = { fact: '#9ED1FF', preference: '#FF9EC7', instruction: '#9EF0A8', timeline: '#FFD17A', relation: '#C7A6FF' }
/** What the chips and the moon labels call a kind. */
export const KIND_LABELS: Readonly<Record<KnowledgeKind, string>> = { fact: 'Fact', preference: 'Preference', instruction: 'Instruction', timeline: 'Timeline event', relation: 'Relation' }
export const CHIP_LABELS: Readonly<Record<KnowledgeKind, string>> = { fact: 'Facts', preference: 'Preferences', instruction: 'Instructions', timeline: 'Timeline', relation: 'Relations' }
export const moonColour = (kind: KnowledgeKind) => MOON_COLOURS[kind]

/** The knowledge rows of a memory in the order sent (all of them; the inspector lists every row, the moons take the first 8); none for a forgotten memory. */
export function knowledgeOf(galaxy: Galaxy, id: string): KnowledgeRow[] {
  return galaxy.gone.has(id) ? [] : (galaxy.knowledge.get(id) ?? [])
}

/** Whether the page holds any knowledge of a live memory: the controls stay disabled until it does (a forgotten memory's rows do not count). */
export function hasKnowledge(galaxy: Galaxy): boolean {
  for (const row of galaxy.knowledgeById.values()) if (!galaxy.gone.has(row.memory)) return true
  return false
}

/** How many looks at the library's scene (afterData runs) are enough to say it drew no line to copy. */
export const LINE_CHECKS = 2

/** The plain-words status when the moons cannot get their lines: no Line class was found after the library had been looked at. Null otherwise. */
export function moonLinesProblem(lineClassFound: boolean, checks: number, moonsShown: boolean): string | null {
  if (lineClassFound || checks < LINE_CHECKS || !moonsShown) return null
  return 'The knowledge moons are drawn without their thin lines to the star: the map library has not drawn any line to copy yet.'
}

/** The rows that orbit the selected memory: at most 8, and none while Knowledge moons is off or nothing is selected. */
export function moonRows(galaxy: Galaxy, state: MapState): KnowledgeRow[] {
  if (!state.moons || state.selected === null) return []
  return knowledgeOf(galaxy, state.selected).slice(0, MOON_LIMIT)
}

/** The selected knowledge row, only while it belongs to the selected memory and is one of the moons shown or listed. */
export function selectedMoon(galaxy: Galaxy, state: MapState): string | null {
  if (state.moon === null || state.selected === null) return null
  return knowledgeOf(galaxy, state.selected).some(row => row.id === state.moon) ? state.moon : null
}

/** Picks a knowledge row (a moon or a list item): the other one follows. A row of another memory is ignored. */
export function selectMoon(state: MapState, galaxy: Galaxy, id: string): MapState {
  if (state.selected === null || state.moon === id) return state
  return knowledgeOf(galaxy, state.selected).some(row => row.id === id) ? { ...state, moon: id } : state
}

export const toggleMoons = (state: MapState): MapState => ({ ...state, moons: !state.moons })

/**
 * Where moon i of n is: on a circle of radius 18 around the star, flattened to 0.45 in height, turning at 0.45 rad/s.
 * Under reduced motion the moons STAND STILL (speed 0): orchestrator decision, matching the mockup
 * (MapGalaxy.dc.html: `this.reduced ? 0 : 0.45`) and accessibility. The plan's words "(still under reduced motion)"
 * meant this; they are corrected in REL.
 */
export function moonPosition(centre: Vec3, i: number, n: number, seconds: number, reducedMotion: boolean): Vec3 {
  const angle = seconds * (reducedMotion ? 0 : MOON_SPEED) + (i * Math.PI * 2) / Math.max(1, n)
  return [centre[0] + Math.cos(angle) * MOON_RADIUS, centre[1] + Math.sin(angle) * MOON_RADIUS * 0.45, centre[2] + Math.sin(angle) * MOON_RADIUS]
}

/** The camera distance a flight to a star ends at: where a moon label has its full size. */
export const MOON_LABEL_REF = 170
/** A moon label's size factor: it shrinks as the camera comes close, so it keeps one size on screen (clamp(distance / 170, 0.25, 1)); star labels do the same with labelScale. */
export const moonLabelScale = (distance: number) => Math.min(1, Math.max(0.25, distance / MOON_LABEL_REF))
/** The pixels one world unit covers at `distance` from a camera of `fovDegrees` over a view `viewHeight` px tall. */
export const pixelsPerUnit = (viewHeight: number, fovDegrees: number, distance: number) => viewHeight / (2 * Math.tan((fovDegrees * Math.PI) / 360) * Math.max(1, distance))
/** A moon's pick radius in px: never under MOON_PICK_RADIUS, and at least the radius of the glow as drawn (`size` world units), so the whole drawn moon can be hovered. */
export const moonPickRadius = (size: number, pxPerUnit: number) => Math.max(MOON_PICK_RADIUS, (size * pxPerUnit) / 2)
export const MOON_LABEL_GAP = 3.5
export const MOON_LABEL_ROW = 4.8
/** The row of a moon's label: neighbours on the orbit alternate rows 0 and 1, and the last of an odd count takes row 2 (its neighbours are the first, row 0, and the one before it, row 1). */
export const moonLabelRow = (i: number, n: number) => (n > 1 && n % 2 === 1 && i === n - 1 ? 2 : i % 2)
/** How far above its moon a label sits: clear of the glow, one label height more for each row, at the label's own scale `k` (moonLabelScale). */
export const moonLabelLift = (i: number, n: number, k: number) => MOON_LABEL_GAP + moonLabelRow(i, n) * MOON_LABEL_ROW * k
/** Drawn after the stars' glows: lines, then moons, then labels, none hidden by depth; moons use normal blending so a bright bloom cannot wash them out. */
export const MOON_RENDER_ORDER = { line: 20, sprite: 21, label: 22 } as const

/** A moon's glow size: 6.5, and 9 for the selected one. */
export const moonSize = (selected: boolean) => (selected ? MOON_SIZE_SELECTED : MOON_SIZE)
/** The selected moon's pulse: 0.4 + 0.3 sin(5t); the others do not pulse. */
export const moonPulse = (selected: boolean, seconds: number) => (selected ? 0.4 + 0.3 * Math.sin(seconds * 5) : 0)

/** The kinds a memory has knowledge of. */
function kindsOf(galaxy: Galaxy, id: string): Set<KnowledgeKind> {
  return new Set(knowledgeOf(galaxy, id).map(row => row.kind))
}

/** How many live memories have each kind (the chips' numbers). */
export function knowledgeCounts(galaxy: Galaxy): Record<KnowledgeKind, number> {
  const counts: Record<KnowledgeKind, number> = { fact: 0, preference: 0, instruction: 0, timeline: 0, relation: 0 }
  for (const star of liveStars(galaxy)) for (const kind of kindsOf(galaxy, star.id)) counts[kind]++
  return counts
}

/** Picks or drops a chip. */
export function toggleKind(state: MapState, kind: KnowledgeKind): MapState {
  if (!KNOWLEDGE_KINDS.includes(kind)) return state
  const kinds = new Set(state.kinds)
  if (kinds.has(kind)) kinds.delete(kind)
  else kinds.add(kind)
  return { ...state, kinds }
}

const KIND_CHIP_NAMES: Readonly<Record<KnowledgeKind, string>> = { fact: 'Facts', preference: 'Preferences', instruction: 'Instructions', timeline: 'Timeline', relation: 'Relations' }
/** The Overview's note while chips dim the map ("Dimmed by: Facts. Click to clear."); null with no chip picked. */
export function dimNote(state: MapState): string | null {
  const names = KNOWLEDGE_KINDS.filter(kind => state.kinds.has(kind)).map(kind => KIND_CHIP_NAMES[kind])
  return names.length === 0 ? null : `Dimmed by: ${names.join(', ')}. Click to clear.`
}
/** Drops every picked chip. */
export const clearKinds = (state: MapState): MapState => (state.kinds.size === 0 ? state : { ...state, kinds: new Set() })

/** The one-line note under the chips. */
export const knowledgeNote = (state: MapState) =>
  state.kinds.size > 0 ? 'Showing only memories with the chosen knowledge; the rest are dimmed.' : 'Pick a kind to light up only the memories it was mined from.'

/** The filter's rule: with no kind picked every memory passes; with some, a memory passes when it has at least one of them. */
export function passesKnowledgeFilter(galaxy: Galaxy, id: string, state: MapState): boolean {
  if (state.kinds.size === 0) return true
  return knowledgeOf(galaxy, id).some(row => state.kinds.has(row.kind))
}

/** The hover text of a moon: its kind and its text. */
export function moonTooltip(galaxy: Galaxy, id: string): { title: string; sub: string } | null {
  const row = galaxy.knowledgeById.get(id)
  return row === undefined ? null : { title: KIND_LABELS[row.kind], sub: row.text }
}

/** "its memory recalled 3 times, last 2 days ago" (the KAPI usage of the memory a row came from). */
export function usageText(recalls: number, lastRecalled: string | null, now = Date.now()): string {
  if (recalls <= 0) return 'its memory was never recalled'
  const last = lastRecalled === null ? Number.NaN : Date.parse(lastRecalled)
  if (!Number.isFinite(last)) return `its memory recalled ${plural(recalls, 'time')}`
  const days = Math.max(0, Math.floor((now - last) / DAY_MS))
  return `its memory recalled ${plural(recalls, 'time')}, last ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}`
}

// ---- Picking and the tooltip ----

export type Hit = { kind: 'star' | 'hub' | 'core' | 'moon' | 'claude'; id: string; sx: number; sy: number }
export type Candidate = Hit & { radius: number; alpha: number }
export const PICK_RADIUS = { star: 10, hub: 12, core: 22, claude: 22, moon: MOON_PICK_RADIUS } as const
const PICK_MIN_ALPHA = 0.2

/** The nearest candidate whose screen distance is inside its radius; a faint one (opacity under 0.2) cannot be picked. */
export function pickNearest(candidates: readonly Candidate[], mx: number, my: number): Hit | null {
  let best: Hit | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    if (candidate.alpha < PICK_MIN_ALPHA) continue
    const distance = Math.hypot(candidate.sx - mx, candidate.sy - my)
    if (distance < candidate.radius && distance < bestDistance) {
      bestDistance = distance
      best = { kind: candidate.kind, id: candidate.id, sx: candidate.sx, sy: candidate.sy }
    }
  }
  return best
}

/** Only the main button picks or flies: a right or middle click is not a click on a star. */
export const isPrimary = (event: { button: number }) => event.button === 0

/** A press that moved over 3 px, or was held over 250 ms, was a drag (an orbit), never a click; `t` is the event time in ms. A drag that ends on the pixel it began on is told by its time. */
export const CLICK_MAX_MOVE = 3
export const CLICK_MAX_HELD_MS = 250
export const isClick = (down: { x: number; y: number; t?: number }, up: { x: number; y: number; t?: number }) => Math.hypot(up.x - down.x, up.y - down.y) <= CLICK_MAX_MOVE && (up.t ?? 0) - (down.t ?? 0) <= CLICK_MAX_HELD_MS

/** A date as YYYY-MM-DD, local time; '' when there is none. */
function savedDay(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The tooltip for a hit: a memory says topic · project, recalls, saved date and label; a hub or core says how many memories and 'Click to fly in'. */
/** The Claude core's tooltip: it is not a project, so no click hint. */
export const CLAUDE_TOOLTIP = { title: 'Claude', sub: 'Recalls start here — gold sparks fly from this core to the memories a recall finds' } as const

export function tooltip(galaxy: Galaxy, hit: Hit): { title: string; sub: string } | null {
  if (hit.kind === 'claude') return CLAUDE_TOOLTIP
  const layout = galaxy.layout
  if (hit.kind === 'moon') return moonTooltip(galaxy, hit.id)
  if (hit.kind === 'star') {
    const star = layout.stars[slotOf(layout.starById, hit.id)]
    if (star === undefined || galaxy.gone.has(star.id)) return null
    const saved = savedDay(star.created)
    return { title: `${topicName(galaxy, star)} · ${coreLabel(galaxy, star.owner)}`, sub: `${plural(star.recalls, 'recall')}${saved ? ` · saved ${saved}` : ''}${star.label ? ` — ${star.label}` : ''}` }
  }
  if (hit.kind === 'hub') {
    const hub = layout.hubs[slotOf(layout.hubByKey, hit.id)]
    return hub === undefined ? null : { title: `Topic: ${hub.name}`, sub: `${plural(hub.count, 'memory').replace('memorys', 'memories')} in ${coreLabel(galaxy, hub.project)}. Click to fly in.` }
  }
  const core = layout.cores[slotOf(layout.coreByOwner, hit.id)]
  const topics = layout.hubs.filter(hub => hub.project === hit.id).length
  return core === undefined ? null : { title: core.label, sub: `${core.count} ${core.count === 1 ? 'memory' : 'memories'}, ${plural(topics, 'topic')}. Click to fly in.` }
}

// ---- Camera flights ----

const FLY_SECONDS = 1.2
const RESET_DISTANCE = 720
const HUB_DISTANCE = 150
const STAR_DISTANCE = 170
const CORE_DISTANCE_FACTOR = 4.2

type Flight = { target: Vec3; distance: number }

/** Where to fly: a core at 4.2 R, a hub at 150, a star at 170, Reset view to the centre at 720. */
export function flightTo(galaxy: Galaxy, kind: 'core' | 'hub' | 'star' | 'reset', id = ''): Flight | null {
  const layout = galaxy.layout
  if (kind === 'reset') return { target: [0, 0, 0], distance: RESET_DISTANCE }
  if (kind === 'core') {
    const core = layout.cores[slotOf(layout.coreByOwner, id)]
    return core === undefined ? null : { target: core.position, distance: core.radius * CORE_DISTANCE_FACTOR }
  }
  if (kind === 'hub') {
    const hub = layout.hubs[slotOf(layout.hubByKey, id)]
    return hub === undefined ? null : { target: hub.position, distance: HUB_DISTANCE }
  }
  const star = layout.stars[slotOf(layout.starById, id)]
  return star === undefined ? null : { target: star.position, distance: STAR_DISTANCE }
}

/** Cubic ease in and out. */
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** A flight's length in seconds: 1.2, none under prefers-reduced-motion. */
export const flightSeconds = (reducedMotion: boolean) => (reducedMotion ? 0 : FLY_SECONDS)

/** Progress after `dt` more seconds, 0..1; a zero-length flight is done at once. */
export const flightProgress = (t: number, dt: number, seconds: number) => (seconds <= 0 ? 1 : Math.min(1, t + dt / seconds))

/** The camera for a flight: it looks at the target from `distance`, from the side it already is on. */
export function flightPose(cameraAt: Vec3, lookingAt: Vec3, flight: Flight): { position: Vec3; target: Vec3 } {
  const dir: Vec3 = [cameraAt[0] - lookingAt[0], cameraAt[1] - lookingAt[1], cameraAt[2] - lookingAt[2]]
  const length = Math.hypot(...dir) || 1
  const position = flight.target.map((v, i) => v + (dir[i]! / length) * flight.distance) as Vec3
  return { position, target: [...flight.target] as Vec3 }
}

/** A point between two, `k` of the way. */
export const lerp3 = (a: Vec3, b: Vec3, k: number): Vec3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

// ---- The Timeline layout (TIME.1, TIME.2) ----
//
// The same stars move onto a time axis at LAYOUT.2's positions (timelinePosition):
// x is age, one lane per project. The numbers below are the mockup's
// (design/MapGalaxy.dc.html: syncSettings, posOf, tl, flyPose, the axis and grid
// in frame). ui/map.ts holds only the timers; every curve, target and place is here.

export const TIMELINE_HINT = 'Newest on the right; each lane is one project'
/** The morph between Galaxy and Timeline takes this long, with cubic ease; none under prefers-reduced-motion. */
export const MORPH_SECONDS = 1.4
export const morphSeconds = (reducedMotion: boolean) => (reducedMotion ? 0 : MORPH_SECONDS)
/** Where the morph is heading: 1 in Timeline, 0 in the other layouts. */
export const morphTarget = (layout: LayoutName): 0 | 1 => (layout === 'timeline' ? 1 : 0)
/** The morph's weight after `dt` more seconds: it moves linearly toward `target` and arrives at once when `seconds` is 0; the drawn blend is `ease(weight)`. A switch mid-morph turns around from where it is. */
export function stepMorph(weight: number, target: number, dt: number, seconds: number): number {
  if (seconds <= 0) return target
  const step = Math.max(0, dt) / seconds
  return weight < target ? Math.min(target, weight + step) : Math.max(target, weight - step)
}
/** The drawn blend of a morph weight: 0 Galaxy, 1 Timeline. */
export const morphBlend = (weight: number) => ease(Math.min(1, Math.max(0, weight)))
/** Project cores and the Claude core shrink to half size in Timeline. */
export const TIMELINE_CORE_SCALE = 0.5
export const coreScale = (blend: number) => 1 - (1 - TIMELINE_CORE_SCALE) * blend
/** Topic hubs, threads, bridges and their particles fade out in Timeline: what is left of them at a blend. */
export const galaxyOnlyFade = (blend: number) => Math.max(0, 1 - blend)
/** The links leave faster than the stars move: gone by the first 30% of the morph (and back in during the last 30%), so no streaks trail the glide. */
export const LINK_FADE_SPAN = 0.3
export const linkFadeAt = (blend: number) => Math.max(0, 1 - blend / LINK_FADE_SPAN)
/** Straight-on view of the axis: the camera 800 in front of it, the middle of the axis in view. */
export const TIMELINE_POSE: { position: Vec3; target: Vec3 } = { position: [-20, 10, 800], target: [-20, 0, 0] }
/** How fast the range follows a new choice, per second: 1 - e^(-4t) of the way. */
export const RANGE_FOLLOW = 4
/** The days the axis shows now, moving toward the range's days; at once under reduced motion or when close. */
export function stepDays(shown: number, target: number, dt: number, reducedMotion: boolean): number {
  if (reducedMotion || Math.abs(target - shown) < 0.01) return target
  return shown + (target - shown) * (1 - Math.exp(-RANGE_FOLLOW * Math.max(0, dt)))
}
/** The days a range spans for a galaxy: 7, 30, or the oldest memory plus two days. */
export const timelineDays = (galaxy: Galaxy, range: TimelineRange) => rangeDays(range, galaxy.oldestAge)
/** A star older than the range fades out. */
export const inTimelineRange = (age: number, days: number) => age <= days
/** The left edge of the axis: where the oldest age the range shows sits (x = 280 - 560 = -280). */
export const TIMELINE_LEFT_X = TIMELINE_TODAY_X - TIMELINE_DAYS_X
/** Whether a star is on the Timeline axis for `days`: it has a save date and is no older than the range. */
export const onTimelineAxis = (galaxy: Galaxy, index: number, days: number): boolean => {
  const star = galaxy.layout.stars[index]
  return star !== undefined && !galaxy.undated.has(star.id) && inTimelineRange(galaxy.ages[index] ?? 0, days)
}

/** Where every drawn thing sits in Timeline, in the layout's own order. */
export type TimelinePlaces = { claude: Vec3; cores: Vec3[]; hubs: Vec3[]; stars: Vec3[] }

/** Timeline places for `days` of axis: cores head their lanes, a topic sits at its memories' average age, a star at its age with a seeded jitter and its topic's depth (never left of the axis). */
export function timelinePlaces(galaxy: Galaxy, days: number): TimelinePlaces {
  const { cores, hubs, stars } = galaxy.layout
  const lanes = cores.length
  const laneOf = (owner: string) => Math.max(0, slotOf(galaxy.layout.coreByOwner, owner))
  // A topic's depth is its place among its project's topics, 6 apart around the middle; its age the average of its memories'.
  const perProject = new Map<string, number>()
  const depthOf = hubs.map(hub => {
    const n = perProject.get(hub.project) ?? 0
    perProject.set(hub.project, n + 1)
    return (n - 3) * 6
  })
  const sums = hubs.map(() => 0)
  const counts = hubs.map(() => 0)
  stars.forEach((star, i) => {
    const h = slotOf(galaxy.layout.hubByKey, star.topic)
    if (h < 0 || galaxy.undated.has(star.id)) return
    sums[h] = sums[h]! + (galaxy.ages[i] ?? 0)
    counts[h] = counts[h]! + 1
  })
  return {
    claude: timelinePosition({ kind: 'claude' }, days),
    cores: cores.map((core, lane) => timelinePosition({ kind: 'project', lane, lanes }, days)),
    hubs: hubs.map((hub, h) => timelinePosition({ kind: 'topic', id: hub.key, lane: laneOf(hub.project), lanes, age: sums[h]! / Math.max(1, counts[h]!), depth: depthOf[h]! }, days)),
    stars: stars.map((star, i) => {
      const h = slotOf(galaxy.layout.hubByKey, star.topic)
      const depth = (h < 0 ? 0 : depthOf[h]!) + gauss(randomOf(seedOf(`${star.id}:depth`))) * 3
      const at = timelinePosition({ kind: 'memory', id: star.id, lane: laneOf(star.owner), lanes, age: galaxy.ages[i] ?? 0, depth }, days)
      // A star past the range, or with no save date, is held at the left edge of the axis: only a selected one is lit there, and it must stay on screen.
      return [galaxy.undated.has(star.id) ? TIMELINE_LEFT_X : Math.max(at[0], TIMELINE_LEFT_X), at[1], at[2]] as Vec3
    }),
  }
}

/** A place between Galaxy and Timeline. */
export const blendPlace = (galaxyAt: Vec3, timelineAt: Vec3, blend: number): Vec3 => (blend <= 0 ? [...galaxyAt] : blend >= 1 ? [...timelineAt] : lerp3(galaxyAt, timelineAt, blend))

// Furniture: tick labels with a faint gridline each, and a faint baseline per lane (mockup axis, grid, lanes).
export const TICK_LABEL_Y = -178
export const TICK_LABEL_HEIGHT = 14
export const TICK_LABEL_COLOUR = '#A9B8C8'
export const TICK_LABEL_OPACITY = 0.95
export const GRID_Y: [number, number] = [-160, 160]
export const GRID_Z = -20
export const GRID_COLOUR = '#5A6B7D'
export const GRID_OPACITY = 0.3
export const LANE_X: [number, number] = [-310, 300]
export const LANE_Z = -12
export const LANE_OPACITY = 0.4

/** The ticks of a range from LAYOUT.2's ticks(), for the days it spans. */
export const rangeTicks = (range: TimelineRange, days: number): Tick[] => ticks(range, days)
/** A tick's x while the axis shows `shownDays`: today stays at 280, older ticks slide as the range rescales. */
export const tickX = (tickDays: number, shownDays: number) => TIMELINE_TODAY_X - (tickDays * TIMELINE_DAYS_X) / Math.max(1, shownDays)
/** A gridline's two ends: from y -160 to 160 at the tick's x, behind the stars. */
export const gridLine = (x: number): [Vec3, Vec3] => [
  [x, GRID_Y[0], GRID_Z],
  [x, GRID_Y[1], GRID_Z],
]
/** How far above its lane's line a project label sits: just above its own core, and never nearer to a neighbouring lane than to its own line (under 40% of the lane spacing). */
export const LANE_LABEL_LIFT = 22
export function laneLabelLift(lanes: number): number {
  return lanes <= 1 ? LANE_LABEL_LIFT : Math.min(LANE_LABEL_LIFT, (LANE_SPAN / (lanes - 1)) * 0.4)
}
/** A project label's height above its core at a blend: the Galaxy offset in Galaxy, the lane lift in Timeline, between while it morphs. */
export const coreLabelOffset = (galaxyOffset: number, lanes: number, blend: number): number => galaxyOffset + (laneLabelLift(lanes) - galaxyOffset) * blend
/** A lane's baseline: its project's colour, at the lane's y, from the cores to just past today. */
export function laneLines(galaxy: Galaxy): { owner: string; colour: string; from: Vec3; to: Vec3 }[] {
  const lanes = galaxy.layout.cores.length
  return galaxy.layout.cores.map((core, lane) => {
    const y = timelinePosition({ kind: 'project', lane, lanes }, 1)[1]
    return { owner: core.owner, colour: projectColour(galaxy, core.owner), from: [LANE_X[0], y, LANE_Z], to: [LANE_X[1], y, LANE_Z] }
  })
}

// ---- Timeline: the per-frame decisions (TIME R2) ----
//
// ui/map.ts only carries these out; every choice of what to do this frame is a pure function here, tested with real values.

type VisualKind = 'core' | 'hub' | 'star' | 'claude'

/** Where a visual goes in Timeline: its slot in the places lists (the Claude core has none). */
export function awayPlace(places: TimelinePlaces, kind: VisualKind, slot: number): Vec3 | undefined {
  return kind === 'star' ? places.stars[slot] : kind === 'hub' ? places.hubs[slot] : kind === 'core' ? places.cores[slot] : places.claude
}

/** A visual's place at a blend: its home when there is no Timeline place or no blend. */
export const visualPlace = (home: Vec3, away: Vec3 | null | undefined, blend: number): Vec3 => (away == null ? [...home] : blendPlace(home, away, blend))

export const samePlace = (a: Vec3, b: Vec3): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

/** The Timeline places kept from one frame to the next: the same galaxy and days give the same places, until `stale` (a move, a new star, an update). */
export type PlacesCache = { galaxy: Galaxy; days: number; places: TimelinePlaces } | null
export function placesFor(cache: PlacesCache, galaxy: Galaxy, days: number, stale: boolean): { cache: NonNullable<PlacesCache>; places: TimelinePlaces } {
  if (cache !== null && !stale && cache.galaxy === galaxy && cache.days === days) return { cache, places: cache.places }
  const made = { galaxy, days, places: timelinePlaces(galaxy, days) }
  return { cache: made, places: made.places }
}

/** One frame of the layout: the morph and the shown days move toward the state; `place` says whether any visual has to be written again. Days only matter once some Timeline is blended in. */
type LayoutStep = { morph: number; days: number; place: boolean }
export function layoutStep(morph: number, days: number, layout: LayoutName, targetDays: number, dt: number, reducedMotion: boolean, dirty: boolean): LayoutStep {
  const next = stepMorph(morph, morphTarget(layout), dt, morphSeconds(reducedMotion))
  const shown = stepDays(days, targetDays, dt, reducedMotion)
  return { morph: next, days: shown, place: dirty || next !== morph || (shown !== days && morphBlend(next) > 0) }
}

/** The middle of the on-axis, still living stars among `ids`, at their Timeline places; null when none is on the axis. */
export function timelineCentre(galaxy: Galaxy, places: TimelinePlaces, ids: Iterable<string>, days: number): Vec3 | null {
  const sum: Vec3 = [0, 0, 0]
  let n = 0
  for (const id of ids) {
    const slot = slotOf(galaxy.layout.starById, id)
    const at = places.stars[slot]
    if (at === undefined || galaxy.gone.has(id) || !onTimelineAxis(galaxy, slot, days)) continue
    n++
    for (let i = 0; i < 3; i++) sum[i] = sum[i]! + at[i]!
  }
  return n === 0 ? null : [sum[0] / n, sum[1] / n, sum[2] / n]
}

/** The middle of the lane (the baseline's middle): where a topic flight lands when the topic has no star on the axis. */
export const LANE_CENTRE_X = (LANE_X[0] + LANE_X[1]) / 2

/** What a flight aims at in Timeline. A topic hub is invisible there, so a topic flight aims at its project's lane and the average x of its on-axis stars (the lane centre when it has none). */
export function timelineAim(galaxy: Galaxy, places: TimelinePlaces, kind: 'core' | 'hub' | 'star', id: string, days: number): Vec3 | null {
  if (kind === 'core') return places.cores[slotOf(galaxy.layout.coreByOwner, id)] ?? null
  if (kind === 'star') return places.stars[slotOf(galaxy.layout.starById, id)] ?? null
  const hub = galaxy.layout.hubs[slotOf(galaxy.layout.hubByKey, id)]
  const lane = hub === undefined ? undefined : places.cores[slotOf(galaxy.layout.coreByOwner, hub.project)]
  if (lane === undefined) return null
  const middle = timelineCentre(galaxy, places, galaxy.layout.stars.filter(star => star.topic === id).map(star => star.id), days)
  return [middle === null ? LANE_CENTRE_X : middle[0], lane[1], 0]
}

/** The fade to write to the links this frame, or null when nothing changed: fully visible links need nothing, and the same fade needs nothing unless the links were rebuilt (`dirty`). */
export function linkFadeToApply(fade: number, applied: number, dirty: boolean): number | null {
  if (fade >= 1 && applied >= 1) return null
  if (fade === applied && !dirty) return null
  return fade
}

// ---- Label de-overlap ----

/** A label's screen rectangle (top-left corner and size, in pixels) and who wins a clash: a higher rank keeps its place. */
export type LabelRect = { x: number; y: number; w: number; h: number; rank: number }
/** Pixels kept free between two labels that were nudged apart. */
export const LABEL_GAP = 2

const overlapsX = (a: LabelRect, b: LabelRect) => a.x < b.x + b.w && b.x < a.x + a.w
const overlapsY = (a: LabelRect, b: LabelRect) => a.y < b.y + b.h && b.y < a.y + a.h

/**
 * Pushes overlapping labels apart, vertically: the higher rank (the Claude label over project labels over topic labels, then the
 * earlier in the list) stays put and each lower one moves away from the ones already placed by just the height of the overlap.
 * The same input always gives the same output; labels that do not overlap are returned as they were.
 */
export function separateLabels(rects: readonly LabelRect[]): LabelRect[] {
  const out = rects.map(rect => ({ ...rect }))
  const order = out.map((_, i) => i).sort((a, b) => out[b]!.rank - out[a]!.rank || a - b)
  const placed: LabelRect[] = []
  for (const i of order) {
    const rect = out[i]!
    // Each pass moves clear of one blocker; a nudge can land on another, so go again (bounded).
    for (let pass = 0; pass <= placed.length; pass++) {
      const blocker = placed.find(other => overlapsX(rect, other) && overlapsY(rect, other))
      if (blocker === undefined) break
      rect.y = rect.y + rect.h / 2 >= blocker.y + blocker.h / 2 ? blocker.y + blocker.h + LABEL_GAP : blocker.y - rect.h - LABEL_GAP
    }
    placed.push(rect)
  }
  return out
}

/** Where a spark starts: the Claude core's place now (it sits above today in Timeline), the origin before it is drawn. */
export const sparkOrigin = (claude: Vec3 | null | undefined): Vec3 => claude ?? [0, 0, 0]

/** The camera move a layout switch asks for: the straight-on view when Timeline is entered, the Galaxy view when it is left, none otherwise. */
export const layoutFlight = (before: LayoutName, after: LayoutName): 'timeline' | 'galaxy' | null => (before === after ? null : after === 'timeline' ? 'timeline' : before === 'timeline' ? 'galaxy' : null)

/** What the hubs' (and their labels') own fade is: only hubs leave in Timeline. */
export const visualFade = (kind: VisualKind, galaxyFade: number): number => (kind === 'hub' ? galaxyFade : 1)

/** A visual's drawn size: cores and the Claude core shrink with the blend; every one grows with its pulse. */
export const visualScale = (kind: VisualKind, size: number, blend: number, pulse: number): number => size * (kind === 'core' || kind === 'claude' ? coreScale(blend) : 1) * (1 + pulse * 1.6)

/** An opacity this close to its target snaps onto it, so a faded-out thing really reaches 0 and the furniture can go idle. */
export const FURNITURE_EPSILON = 0.003
export const easeToward = (value: number, target: number, follow: number): number => (Math.abs(target - value) <= FURNITURE_EPSILON ? target : value + (target - value) * follow)

/** The ticks the axis wants at a blend: none while no Timeline is blended in. The list of the last range and days asked is kept, so a frame makes none. */
const NO_TICKS: Tick[] = []
let lastTicks: { range: TimelineRange; days: number; list: Tick[] } | null = null
export function wantedTicks(range: TimelineRange, days: number, blend: number): Tick[] {
  if (!(blend > 0)) return NO_TICKS
  if (lastTicks === null || lastTicks.range !== range || lastTicks.days !== days) lastTicks = { range, days, list: rangeTicks(range, days) }
  return lastTicks.list
}
/** Whether a tick of `days` is among the wanted ones. */
export const tickWanted = (list: readonly Tick[], days: number): boolean => list.some(tick => tick.days === days)
/** A tick label's opacity target, and its lane baseline's: they come in with the blend. */
export const tickTarget = (wanted: boolean, blend: number): number => (wanted ? blend * TICK_LABEL_OPACITY : 0)
export const laneTarget = (blend: number, hidden: boolean): number => (blend > 0 && !hidden ? blend * LANE_OPACITY : 0)
/** A gridline's opacity follows its label's. */
export const gridOpacity = (labelAlpha: number): number => (labelAlpha / TICK_LABEL_OPACITY) * GRID_OPACITY
/** A gridline is made only once its tick is visible. */
export const needsGridLine = (hasLine: boolean, labelAlpha: number): boolean => !hasLine && labelAlpha > FURNITURE_EPSILON
/** A tick no longer wanted is let go once it has faded out. */
export const tickReleased = (wanted: boolean, labelAlpha: number): boolean => !wanted && labelAlpha <= FURNITURE_EPSILON
/** Nothing of the axis to draw or fade this frame: no Timeline blended in, no tick left, every lane baseline at 0. */
export function furnitureIdle(blend: number, tickCount: number, lanes: Iterable<{ alpha: number }>): boolean {
  if (blend > 0 || tickCount > 0) return false
  for (const lane of lanes) if (lane.alpha > 0) return false
  return true
}

// ---- The rail ----

type ProjectRow = { owner: string; label: string; colour: string; count: number; shown: boolean; focused: boolean }
type TopicRow = { key: string; name: string; count: number; shared: boolean; focused: boolean }

/** One row per project: name, colour, memory count, whether its stars show and whether it is the focus. */
export function projectRows(galaxy: Galaxy, state: MapState): ProjectRow[] {
  return galaxy.layout.cores.map(core => ({
    owner: core.owner,
    label: core.label,
    colour: projectColour(galaxy, core.owner),
    count: liveStars(galaxy).filter(star => star.owner === core.owner).length,
    shown: !state.hidden.has(core.owner),
    focused: state.project === core.owner,
  }))
}

/** The focused project's topics, with a 'shared' mark for those a bridge joins to another project. */
export function topicRows(galaxy: Galaxy, state: MapState): TopicRow[] {
  if (state.project === null) return []
  return galaxy.layout.hubs
    .filter(hub => hub.project === state.project)
    .map(hub => ({ key: hub.key, name: hub.name, count: hub.count, shared: sharedWith(galaxy, hub.key).length > 0, focused: state.topic === hub.key }))
}

// ---- The inspector ----

type Inspector = {
  kind: 'Overview' | 'Project' | 'Topic' | 'Memory'
  title: string
  colour: string
  sub: string
  /** A memory's label, its tags and the id Open in Memories takes. */
  memory?: { text: string; tags: string[]; id: string }
  stats: { label: string; value: string }[]
  hint: string
  /** The two sections of a memory: what was mined from it (MOON.1), and the similar memories (empty until embeddings are built). */
  knowledge?: { note: string; items: KnowledgeItem[] }
  similar?: { note: string }
}

/** One line of the inspector's "Knowledge from this memory". */
type KnowledgeItem = { id: string; kind: KnowledgeKind; label: string; colour: string; text: string; usage: string; selected: boolean }

/** Shown when a memory has no knowledge rows; the second sentence is the stated limit (an `extract` line does not refetch the galaxy). */
export const NO_KNOWLEDGE_NOTE = 'Nothing extracted from this memory yet. Reload to see new knowledge.'

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0)

function knowledgeSection(galaxy: Galaxy, state: MapState, star: GalaxyStar, now: number): { note: string; items: KnowledgeItem[] } {
  const rows = knowledgeOf(galaxy, star.id)
  if (rows.length === 0) return { note: NO_KNOWLEDGE_NOTE, items: [] }
  const picked = selectedMoon(galaxy, state)
  // The galaxy memory's own recall fields: the same numbers KAPI's usage counts give for this memory, so no second source.
  const usage = usageText(star.recalls, star.lastRecalled, now)
  const more = rows.length > MOON_LIMIT ? ` Only the first ${MOON_LIMIT} orbit the star.` : ''
  return {
    note: `${state.moons ? 'Shown as moons around the star.' : 'Turn on Knowledge moons to see them around the star.'} Each item is also in the Knowledge tab.${more}`,
    items: rows.map(row => ({ id: row.id, kind: row.kind, label: KIND_LABELS[row.kind], colour: MOON_COLOURS[row.kind], text: row.text, usage, selected: row.id === picked })),
  }
}

export function inspector(galaxy: Galaxy, state: MapState, now = Date.now()): Inspector {
  const layout = galaxy.layout
  const star = state.selected === null || galaxy.gone.has(state.selected) ? undefined : layout.stars[slotOf(layout.starById, state.selected)]
  if (star !== undefined) {
    const saved = savedDay(star.created)
    return {
      kind: 'Memory',
      title: topicName(galaxy, star),
      colour: projectColour(galaxy, star.owner),
      sub: coreLabel(galaxy, star.owner),
      memory: { text: star.label === '' ? '(no text)' : star.label, tags: star.tags, id: star.id },
      stats: [
        { label: 'Project', value: coreLabel(galaxy, star.owner) },
        { label: 'Recalls', value: String(star.recalls) },
        { label: 'Saved', value: saved === '' ? 'unknown' : saved },
        { label: 'Tags', value: star.tags.length === 0 ? 'none' : star.tags.join(', ') },
      ],
      hint: star.recalls === 0 ? 'Never recalled: a candidate to review or forget.' : 'Its star grows each time Claude recalls it.',
      knowledge: knowledgeSection(galaxy, state, star, now),
      similar: { note: 'Similar memories need embeddings.' },
    }
  }
  const hub = state.topic === null ? undefined : layout.hubs[slotOf(layout.hubByKey, state.topic)]
  if (hub !== undefined) {
    const members = liveStars(galaxy).filter(s => s.topic === hub.key)
    const shared = sharedWith(galaxy, hub.key)
    return {
      kind: 'Topic',
      title: hub.name,
      colour: projectColour(galaxy, hub.project),
      sub: coreLabel(galaxy, hub.project),
      stats: [
        { label: 'Memories', value: String(members.length) },
        { label: 'Recalls', value: String(sum(members.map(m => m.recalls))) },
        { label: 'Project', value: coreLabel(galaxy, hub.project) },
        { label: 'Shared with', value: shared.length > 0 ? shared.join(', ') : 'none' },
      ],
      hint: 'Click a star to read that memory.',
    }
  }
  const core = state.project === null ? undefined : layout.cores[slotOf(layout.coreByOwner, state.project)]
  if (core !== undefined) {
    const members = liveStars(galaxy).filter(s => s.owner === core.owner)
    return {
      kind: 'Project',
      title: core.label,
      colour: projectColour(galaxy, core.owner),
      sub: '',
      stats: [
        { label: 'Memories', value: String(members.length) },
        { label: 'Topics', value: String(layout.hubs.filter(h => h.project === core.owner).length) },
        { label: 'Recalls', value: String(sum(members.map(m => m.recalls))) },
        { label: 'Never recalled', value: String(members.filter(m => m.recalls === 0).length) },
      ],
      hint: 'Click a topic in the map or the list to fly closer.',
    }
  }
  return {
    kind: 'Overview',
    title: `${galaxy.total} ${galaxy.total === 1 ? 'memory' : 'memories'}`,
    colour: '#0B6665',
    sub: galaxy.shown < galaxy.total ? `showing ${galaxy.shown} of ${galaxy.total}` : '',
    stats: [
      { label: 'Memories', value: String(liveStars(galaxy).length) },
      { label: 'Recalls, all time', value: String(sum(liveStars(galaxy).map(s => s.recalls))) },
      { label: 'Never recalled', value: String(liveStars(galaxy).filter(s => s.recalls === 0).length) },
      { label: 'Topics', value: String(layout.hubs.length) },
      { label: 'Bridges', value: String(layout.bridges.length) },
    ],
    hint: state.layout === 'timeline' ? TIMELINE_HINT : 'Every star is one memory. Click a project core to fly in.',
  }
}

/** What a screen reader hears after a focus change. */
export function announcement(galaxy: Galaxy, state: MapState): string {
  const view = inspector(galaxy, state)
  return view.kind === 'Overview' ? `All memories: ${view.title}` : `${view.kind}: ${view.title}`
}


// ---- Live events (plan LIVE): what an event does to the galaxy ----
//
// The page applies a real event's change to the galaxy it holds, so every count
// and the inspector agree with the store without a reload: a save places one new
// star (placeOne moves no other), a recall raises a count, an update resets an
// age, a forget removes a star. A demo event changes nothing: it only plays.

/** A /api/memories/<id> reply as the galaxy's lean row (label cut to 80 characters); null when it is not a memory. */
export function leanRow(detail: unknown): GalaxyMemory | null {
  if (detail === null || typeof detail !== 'object' || Array.isArray(detail)) return null
  const raw = detail as Record<string, unknown>
  if (typeof raw.id !== 'string' || raw.id === '') return null
  const firstLine = text(raw.content).split('\n').find(part => part.trim() !== '') ?? ''
  const metadataTags = raw.metadata !== null && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, unknown>).tags : undefined
  const tags = [raw.tags, metadataTags].find(Array.isArray) as unknown[] | undefined
  return {
    id: raw.id,
    owner: text(raw.owner, 'global') || 'global',
    tags: (tags ?? []).filter((tag): tag is string => typeof tag === 'string' && tag !== ''),
    recalls: count(raw.recall_count),
    lastRecalled: stamp(raw.last_recalled),
    created: stamp(raw.timestamp),
    label: plainLabel(firstLine, LABEL_CHARS),
  }
}

/** The ids of an event that are stars of the galaxy now (a forgotten one is not). */
export const eventStars = (galaxy: Galaxy, event: MapEvent): string[] => event.ids.filter(id => slotOf(galaxy.layout.starById, id) >= 0 && !galaxy.gone.has(id))

/** Places one new star by the layout's rule and counts it everywhere; its index, or -1 when the memory is already on the map. */
export function addMemory(galaxy: Galaxy, row: GalaxyMemory): number {
  if (slotOf(galaxy.layout.starById, row.id) >= 0) return -1
  const star = placeOne(galaxy.layout, row)
  const core = galaxy.layout.cores[slotOf(galaxy.layout.coreByOwner, star.owner)]
  if (core) core.count++
  galaxy.ages.push(0)
  galaxy.total++
  galaxy.shown++
  galaxy.maxRecalls = Math.max(galaxy.maxRecalls, star.recalls)
  if (!galaxy.colours.has(star.owner)) galaxy.colours.set(star.owner, PALETTE[(galaxy.layout.cores.length - 1) % PALETTE.length]!)
  return slotOf(galaxy.layout.starById, row.id)
}

/** A recall raises the star's count (its size and colour follow); false when it is not on the map. */
export function recallMemory(galaxy: Galaxy, id: string): boolean {
  const star = galaxy.layout.stars[slotOf(galaxy.layout.starById, id)]
  if (star === undefined || galaxy.gone.has(id)) return false
  star.recalls++
  galaxy.maxRecalls = Math.max(galaxy.maxRecalls, star.recalls)
  return true
}

/** The age of the oldest memory still on the map (not forgotten). */
export function liveOldestAge(galaxy: Galaxy): number {
  let oldest = 0
  galaxy.layout.stars.forEach((star, i) => {
    if (!galaxy.gone.has(star.id)) oldest = Math.max(oldest, galaxy.ages[i] ?? 0)
  })
  return oldest
}

/** An update makes the memory new again: age 0, with a save date from now on. */
export function touchMemory(galaxy: Galaxy, id: string): boolean {
  const index = slotOf(galaxy.layout.starById, id)
  if (index < 0 || galaxy.gone.has(id)) return false
  galaxy.ages[index] = 0
  galaxy.undated.delete(id)
  // The range All is the oldest memory plus two days: it narrows when the oldest memory is updated.
  galaxy.oldestAge = liveOldestAge(galaxy)
  return true
}

/** A forget removes the star from every count; false when it is not on the map. */
export function forgetMemory(galaxy: Galaxy, id: string): boolean {
  const star = galaxy.layout.stars[slotOf(galaxy.layout.starById, id)]
  if (star === undefined || galaxy.gone.has(id)) return false
  galaxy.gone.add(id)
  const hub = galaxy.layout.hubs[slotOf(galaxy.layout.hubByKey, star.topic)]
  if (hub) hub.count = Math.max(0, hub.count - 1)
  const core = galaxy.layout.cores[slotOf(galaxy.layout.coreByOwner, star.owner)]
  if (core) core.count = Math.max(0, core.count - 1)
  galaxy.total = Math.max(0, galaxy.total - 1)
  galaxy.shown = Math.max(0, galaxy.shown - 1)
  galaxy.oldestAge = liveOldestAge(galaxy)
  return true
}

/** What a Simulate button's event needs from the galaxy: projects with their counts, and memories with owner and tags. */
export function simulationInput(galaxy: Galaxy) {
  return {
    projects: galaxy.layout.cores.map(core => ({ owner: core.owner, count: core.count })),
    memories: liveStars(galaxy).map(star => ({ id: star.id, owner: star.owner, tags: star.tags })),
  }
}

// ---- The live strip ----

export const STRIP_KEEP = 4
export const STRIP_STORE = 12
type Layer = 'recall' | 'write'
export const layerOf = (kind: MapEventKind): Layer => (kind === 'recall' ? 'recall' : 'write')
export const layerOn = (state: MapState, kind: MapEventKind) => (layerOf(kind) === 'recall' ? state.layerRecall : state.layerWrite)
export const toggleLive = (state: MapState): MapState => ({ ...state, live: !state.live })

/** The strip lists the events since the page was opened, not the log: its empty line says so. */
export const STRIP_EMPTY_TEXT = 'No new activity since you opened this page.'
/** The Live pill switches live updates (and the demo timer) on or off. */
export const LIVE_PILL_TITLE = 'Press to switch live updates on or off'

/** A frame re-picks under the pointer when it moved, or while it rests on the map with moons shown (they orbit under it). */
export const needsHover = (moved: boolean, inside: boolean, moonsShown: boolean): boolean => moved || (inside && moonsShown)

/** The Live pill: On only while the page's stream is connected and Live is on; otherwise Paused, so it never says On over a feed that cannot fill. */
export const liveLabel = (state: MapState, connected: boolean): 'On' | 'Paused' => (state.live && connected ? 'On' : 'Paused')

/** The app a client name stands for: Codex, Cursor, Claude Code, a demo, else the name itself ('' when unknown). */
export function appName(client: string): string {
  const name = client.trim()
  if (name === '' || name === 'unknown') return ''
  if (name === 'demo') return 'Demo'
  if (/codex/i.test(name)) return 'Codex'
  if (/cursor/i.test(name)) return 'Cursor'
  if (/^claude[-_ ]?code/i.test(name)) return 'Claude Code'
  return plainLabel(name, 40)
}

export type StripRow = { kind: MapEventKind; time: string; badge: string; text: string; app: string; demo: boolean }

const BADGE: Record<MapEventKind, string> = { recall: 'recall', save: 'save', update: 'update', forget: 'forget' }

const clockOf = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** One row of the strip: time, kind badge, a sentence naming the topic and project, the app, and whether it is a demo. */
export function stripRow(galaxy: Galaxy, event: MapEvent, hits: number): StripRow {
  const first = galaxy.layout.stars[slotOf(galaxy.layout.starById, event.ids[0] ?? '')]
  const topic = first ? topicName(galaxy, first) : (event.topic ?? '')
  const owner = first?.owner ?? event.owner ?? ''
  const where = [topic, owner === '' ? '' : coreLabel(galaxy, owner)].filter(part => part !== '').join(' · ')
  const tail = where === '' ? '' : ` · ${where}`
  const text =
    event.kind === 'recall'
      ? `Recalled ${hits}${tail}`
      : event.kind === 'save'
        ? `Saved a new memory${tail}`
        : event.kind === 'update'
          ? `Updated a memory in place${tail}`
          : `Forgot ${hits === 1 ? 'a memory' : `${hits} memories`}${tail}`
  return { kind: event.kind, time: clockOf(event.t), badge: BADGE[event.kind], text: plainLabel(text, 120), app: appName(event.client), demo: event.demo === true }
}

/** The rows the strip shows: the last four of the layers that are on, newest first (`rows` is newest first). */
export const stripRows = (rows: readonly StripRow[], state: MapState): StripRow[] => rows.filter(row => layerOn(state, row.kind)).slice(0, STRIP_KEEP)

/** A new row at the front, the store capped at 12. */
export const pushRow = (rows: readonly StripRow[], row: StripRow): StripRow[] => [row, ...rows].slice(0, STRIP_STORE)

/** Whether a demo event plays on its own now: Live is On and a Simulate button was pressed in this page load. */
export const demoTimerOn = (state: MapState, pressed: boolean) => state.live && pressed
export const DEMO_EVERY_MS = 3400

/** The demo timer's draw: recall three times in five, write two, among the layers that are on; null when both are off. */
export function demoKind(state: MapState, random: () => number): 'recall' | 'write' | null {
  const kinds: ('recall' | 'write')[] = []
  if (state.layerRecall) kinds.push('recall', 'recall', 'recall')
  if (state.layerWrite) kinds.push('write', 'write')
  return kinds.length === 0 ? null : kinds[Math.floor(random() * kinds.length)]!
}

// ---- Sparks: our own glow points, flying from the Claude core to a star ----

export const SPARK_POOL = 48
export const SPARK_SECONDS = 1.1
export const SPARK_STAGGER = 0.12
export const SPARK_COLOURS: Record<MapEventKind, Vec3> = { recall: [1, 0.82, 0.45], save: [0.37, 0.95, 0.85], update: [0.37, 0.95, 0.85], forget: [1, 0.42, 0.42] }
/** The pulse a star gets when a spark lands. */
export const PULSE: Record<MapEventKind, number> = { recall: 1.4, save: 2, update: 1.6, forget: 1.2 }

export type Spark = {
  /** What it flies to: a star's memory id, or a topic hub's key (a demo save has no star). */
  to: string
  toKind: 'star' | 'hub'
  kind: MapEventKind
  /** Seconds to wait before it leaves. */
  delay: number
  /** -1..1: which way its curve bows. */
  curve: number
  /** Seconds since it was started, delay included. */
  age: number
  /** True for a demo event: it plays and changes nothing. */
  demo: boolean
}
type SparkPool = { active: (Spark | null)[]; queue: Spark[] }

export const newSparkPool = (size = SPARK_POOL): SparkPool => ({ active: Array.from({ length: size }, () => null), queue: [] })

/** The sparks an event sends: one per target, staggered 0.12 s; none under prefers-reduced-motion (the stars still pulse). */
export function sparksFor(event: MapEvent, targets: readonly { to: string; toKind: 'star' | 'hub' }[], reducedMotion: boolean, random: () => number): Spark[] {
  if (reducedMotion) return []
  return targets.map((target, i) => ({ ...target, kind: event.kind, delay: i * SPARK_STAGGER, curve: random() * 2 - 1, age: 0, demo: event.demo === true }))
}

/** Adds sparks to the queue; the next step starts them as slots free up (an extra event waits, it is never dropped). */
export function enqueueSparks(pool: SparkPool, sparks: readonly Spark[]): void {
  for (const spark of sparks) pool.queue.push({ ...spark, age: 0 })
}

/** Moves every spark on by `dt` seconds, fills free slots from the queue, and returns the sparks that landed (their slot is free again). */
export function stepSparks(pool: SparkPool, dt: number): Spark[] {
  const landed: Spark[] = []
  for (let i = 0; i < pool.active.length; i++) {
    const spark = pool.active[i]
    if (spark) {
      spark.age += dt
      if (spark.age - spark.delay >= SPARK_SECONDS) {
        landed.push(spark)
        pool.active[i] = null
      }
    }
    if (!pool.active[i] && pool.queue.length > 0) pool.active[i] = pool.queue.shift()!
  }
  return landed
}

/** How far along a spark is, 0..1 (0 while it still waits). */
export const sparkProgress = (spark: Spark) => Math.min(1, Math.max(0, (spark.age - spark.delay) / SPARK_SECONDS))

/** Where a spark is: a curve from `from` to `to`, bowing sideways and up, eased. */
export function sparkAt(from: Vec3, to: Vec3, curve: number, u: number): Vec3 {
  const mid: Vec3 = [(from[0] + to[0]) / 2 + curve * 60, (from[1] + to[1]) / 2 + 70, (from[2] + to[2]) / 2 - curve * 40]
  const k = ease(Math.min(1, Math.max(0, u)))
  const at = (i: 0 | 1 | 2) => (1 - k) * (1 - k) * from[i] + 2 * (1 - k) * k * mid[i] + k * k * to[i]
  return [at(0), at(1), at(2)]
}

/** A spark's brightness: 0 while it waits, then 1 fading a little as it lands. */
export const sparkAlpha = (spark: Spark) => (spark.age < spark.delay ? 0 : 1 - sparkProgress(spark) * 0.3)
