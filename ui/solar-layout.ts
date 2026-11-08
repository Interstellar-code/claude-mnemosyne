// The rules of the solar-system map (plan MAPX.4, contract C11): which body a project
// is, how big, how far from the sun and how fast it travels, what its surface shows,
// and how Find matches it.
//
// Pure: no DOM, no three.js, no imports, no clock (the caller passes `now`). The
// rules are ported from the approved mockup (docs/plans/mapx-design/solar-scene.js)
// and read the reply of `GET /api/galaxy` instead of its hard-coded PROJECTS, LINKS
// and WRITERS. The same input in any order gives the same output: bodies are sorted
// by label then owner once, and every random draw is seeded from the project label.

// ---- The reply of GET /api/galaxy (C11), as far as the rules read it ------------

export type KindCount = { kind: string; count: number }
export type TagCount = { tag: string; count: number }

export type SolarProject = {
  owner: string
  label: string
  /** All rows of the owner; the map sizes by `liveCount` instead. */
  count: number
  recalls: number
  liveCount: number
  kinds: KindCount[]
  /** Live rows of kind unknown. */
  unknown: number
  /** Live rows with scope global (they still count toward the size). */
  global: number
  /** The newest of `timestamp` and `last_recalled` over the live rows, ISO, or null. */
  lastActive: string | null
  activity30: number
  activitySource: 'tally' | 'lifetime'
  recallsTotal: number
  medianAgeDays: number | null
  firstSaved: string | null
  /** At most 40, by count then name. */
  tags: TagCount[]
  tagsTotal: number
  projectKind: 'repo' | 'folder' | 'unknown'
  remoteHost: string | null
}

export type SolarMemory = {
  id: string
  owner: string
  tags: string[]
  recalls: number
  lastRecalled: string | null
  created: string | null
  label: string
  source: string
  sourceInferred: boolean
  kind: string
  scope: string
  importance: number
  pinned: boolean
  state: 'live' | 'retired' | 'expired' | 'lapsed'
  validUntil: string | null
  /** 0.29.0: the meaning layout's place (SEMX.1), only for a memory with a vector; the nebula reads it. */
  position?: [number, number, number]
  /** 0.29.0: the memories closest in meaning, best first (SEMX.1). */
  similar?: { id: string; score: number }[]
}

export type SolarWriter = { source: string; count: number; inferred: number }
export type SolarLink = { a: string; b: string; pairs: { older: string; newer: string; score: number }[] }

export type SolarGalaxy = {
  projects: SolarProject[]
  memories: SolarMemory[]
  writers: SolarWriter[]
  globalLive: number
  /** The space station threshold from the map.stationMin setting (absent: STATION_MIN). */
  stationMin?: number
  /** Absent when the store has no vectors (C11.3). */
  links?: SolarLink[]
}

// ---- Where the scene can go (C13) ------------------------------------------------

export type Target =
  | { level: 'galaxy' }
  | { level: 'planet'; owner: string }
  | { level: 'moon'; owner: string; kind: string }
  | { level: 'memory'; owner: string; kind: string; id: string }

// ---- Constants --------------------------------------------------------------------

export const MAX_RINGS = 10
export const MAX_LAND = 12
export const MAX_MOONS = 8
/** A project idle this many days (its newest live memory neither saved nor recalled) gets an ice cap. */
export const ICE_CAP_DAYS = 30
/** Clouds when more than this share of a project's live memories are kind unknown. */
export const CLOUD_SHARE = 0.25
/** A plain folder with this many live memories is a space station, else a starship (the default of the map.stationMin setting; /api/galaxy sends the value in use). */
export const STATION_MIN = 50
/** Under this many live memories a planet is a dwarf. */
export const DWARF_UNDER = 3

/** The colour-blind-safe palette writers take, in order of count (then name). */
export const WRITER_PALETTE = ['#56B4E9', '#CC79A7', '#E69F00', '#009E73', '#0072B2', '#D55E00'] as const
export const EVENT_COLOUR = { recall: '#F0E442', save: '#56B4E9', update: '#3DDC97', forget: '#FF4D4D' } as const

export const KIND_LABEL: Readonly<Record<string, string>> = {
  fact: 'Facts', preference: 'Preferences', instruction: 'Instructions', decision: 'Decisions', context: 'Context',
  error: 'Errors', artifact: 'Artifacts', event: 'Events', unknown: 'Unknown kind',
}
export const KIND_ONE: Readonly<Record<string, string>> = {
  fact: 'fact', preference: 'preference', instruction: 'instruction', decision: 'decision', context: 'context note',
  error: 'error note', artifact: 'artifact', event: 'event', unknown: 'untyped',
}
/** The moon's name for a kind; a kind the table does not know shows as written. */
export const kindLabel = (kind: string): string => KIND_LABEL[kind] ?? kind
export const kindOne = (kind: string): string => KIND_ONE[kind] ?? kind

export const ARRANGE = [
  { id: 'activity', label: 'Activity', hint: 'Closer = more writes and recalls (30 days; lifetime until the tally fills). At most 10 orbits: past 10 bodies, the least active share the outer rings.' },
  { id: 'size', label: 'Size', hint: 'Closer = more memories.' },
  { id: 'age', label: 'Age', hint: 'Closer = younger (median age of live memories).' },
  { id: 'recalls', label: 'Recalls', hint: 'Closer = more lifetime recalls.' },
] as const
export type Arrange = (typeof ARRANGE)[number]['id']

export const COLOURS = [
  { id: 'writer', label: 'Writer' },
  { id: 'recalls', label: 'Recalls' },
  { id: 'age', label: 'Age' },
] as const
export type ColourMode = (typeof COLOURS)[number]['id']

export type StyleId = 'earth' | 'mars' | 'venus' | 'mercury' | 'pluto' | 'jupiter' | 'saturn' | 'neptune' | 'uranus'
export type PlanetStyle =
  | { kind: 'rock'; a: string; b: string; extra: 'clouds' | 'cap' | 'haze' | 'craters'; label: string }
  | { kind: 'gas'; bands: readonly string[]; extra: 'spot' | 'rings' | 'none'; label: string }
export const STYLES: Readonly<Record<StyleId, PlanetStyle>> = {
  earth: { kind: 'rock', a: '#2a6496', b: '#0b2140', extra: 'clouds', label: 'Earth-like' },
  mars: { kind: 'rock', a: '#c8663a', b: '#5a2412', extra: 'cap', label: 'Mars-like' },
  venus: { kind: 'rock', a: '#e8cb92', b: '#9a7a45', extra: 'haze', label: 'Venus-like' },
  mercury: { kind: 'rock', a: '#a39e97', b: '#4a4642', extra: 'craters', label: 'Mercury-like' },
  pluto: { kind: 'rock', a: '#dcc6a8', b: '#7d6650', extra: 'craters', label: 'Pluto-like' },
  jupiter: { kind: 'gas', bands: ['#ead9be', '#c48a5a', '#f4e8d4', '#a8683f', '#dcc2a0', '#b9825a'], extra: 'spot', label: 'Jupiter-like' },
  saturn: { kind: 'gas', bands: ['#f0e3ba', '#d9bf86', '#f6edd2', '#c9a865', '#e4d09c'], extra: 'rings', label: 'Saturn-like' },
  neptune: { kind: 'gas', bands: ['#4f74e8', '#2c4bb8', '#6d8ff0', '#22398f'], extra: 'spot', label: 'Neptune-like' },
  uranus: { kind: 'gas', bands: ['#a8ecef', '#86d6dc', '#c4f4f5', '#94e0e6'], extra: 'none', label: 'Uranus-like' },
}

// ---- Deterministic randomness (the mockup's fnv and rng) ---------------------------

/** A 32-bit FNV-1a hash of a string. */
export function fnv(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** A mulberry32 stream: the same seed gives the same sequence. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Bodies: one per project except the owner 'global' -------------------------------

export type Craft = 'station' | 'ship'

/** What the rules know about one project. `count` is the LIVE count: the size of the body. */
export type Body = {
  owner: string
  /** What the panel, chips and tooltips show (`projectLabel(owner)`). */
  label: string
  /** What every random draw hashes: the label, or `label|owner` when two projects share a label. */
  seed: string
  count: number
  craft: Craft | null
  /** The planet's look; null for a craft. */
  style: StyleId | null
  /** A project no Claude session has registered yet (projectKind 'unknown'). */
  kindUnknown: boolean
  /** A git repo with no remote (remoteHost null). */
  noRemote: boolean
  remoteHost: string | null
  activity: number
  activitySource: 'tally' | 'lifetime'
  recalls: number
  /** Median age of the live memories in days, or null with none. */
  age: number | null
  unknown: number
  global: number
  lastActive: string | null
  /** The newest live memory was saved or recalled 30 or more days ago. */
  iceCap: boolean
  /** More than a quarter of the live memories are kind unknown. */
  clouds: boolean
  /** All kinds, by count then name. */
  kinds: KindCount[]
  /** The kind moons: none for a dwarf or a craft, never 'unknown', at most 8. */
  moons: KindCount[]
  /** The land masses (or bands): the top 12 tags. */
  land: TagCount[]
  /** The tags beyond the land masses: small islands. */
  islands: number
  /** All the tags the reply listed, by count then name. */
  tags: TagCount[]
  tagsTotal: number
}

/** A project's label: `<name>` for `project-<name>-<hash>`, else the owner (the server's rule). */
export function projectLabel(owner: string): string {
  if (owner === 'global') return 'Global'
  return /^project-(.+)-[0-9a-z]+$/.exec(owner)?.[1] ?? owner
}

const before = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const byLabel = (a: { label: string; owner: string }, b: { label: string; owner: string }): number =>
  before(a.label, b.label) || before(a.owner, b.owner)
/** More first, then by name. */
const byCount = (a: { count: number }, b: { count: number }, na: string, nb: string): number => b.count - a.count || before(na, nb)

export const sizeKind = (count: number): 'dwarf' | 'rocky' | 'ice' | 'gas' =>
  count < DWARF_UNDER ? 'dwarf' : count < 10 ? 'rocky' : count < 30 ? 'ice' : 'gas'

const STYLE_CLASS: Readonly<Record<'dwarf' | 'rocky' | 'ice' | 'gas', readonly StyleId[]>> = {
  dwarf: ['pluto', 'mercury'],
  rocky: ['earth', 'mars', 'venus', 'mercury'],
  ice: ['neptune', 'uranus'],
  gas: ['jupiter', 'saturn'],
}

/**
 * The planets' looks: the biggest first (then label, owner), each taking its hashed pick
 * of its size class, or the next one along that no one has, so neighbours differ.
 */
function assignStyles(planets: { owner: string; label: string; seed: string; count: number }[]): Record<string, StyleId> {
  const out: Record<string, StyleId> = {}
  const used = new Set<StyleId>()
  const ordered = planets.slice().sort((a, b) => byCount(a, b, a.label, b.label) || before(a.owner, b.owner))
  for (const planet of ordered) {
    const options = STYLE_CLASS[sizeKind(planet.count)]
    const first = fnv(planet.seed) % options.length
    for (let k = 0; k < options.length; k++) {
      const pick = options[(first + k) % options.length]
      if (pick !== undefined && !used.has(pick)) {
        used.add(pick)
        out[planet.owner] = pick
        break
      }
    }
    // More bodies than looks in the class: share the hashed pick.
    out[planet.owner] ??= options[first] as StyleId
  }
  return out
}

/** A planet's look (a craft has none), chosen once by `buildBodies` so neighbours differ. */
export const styleOf = (body: Pick<Body, 'style'>): StyleId | null => body.style

/** Whole days between two instants; the caller supplies the clock. */
const daysBetween = (now: number, then: number): number => (now - then) / 86400000

/**
 * The bodies of a galaxy reply, sorted by label then owner. The owner 'global' is never
 * a body (its rows feed the sun belt only). `now` (ms) dates the ice cap.
 */
export function buildBodies(galaxy: Pick<SolarGalaxy, 'projects' | 'stationMin'>, now: number): Body[] {
  const stationMin = galaxy.stationMin ?? STATION_MIN
  const projects = galaxy.projects.filter(project => project.owner !== 'global')
  const shared = new Map<string, number>()
  for (const project of projects) shared.set(projectLabel(project.owner), (shared.get(projectLabel(project.owner)) ?? 0) + 1)

  const rows = projects
    .map(project => {
      const label = projectLabel(project.owner)
      const seed = (shared.get(label) ?? 0) > 1 ? `${label}|${project.owner}` : label
      return { project, label, seed }
    })
    .sort((a, b) => before(a.label, b.label) || before(a.project.owner, b.project.owner))
  const craftOf = (project: SolarProject): Craft | null =>
    project.projectKind === 'folder' ? (project.liveCount >= stationMin ? 'station' : 'ship') : null
  const styles = assignStyles(
    rows.filter(row => craftOf(row.project) === null).map(row => ({ owner: row.project.owner, label: row.label, seed: row.seed, count: row.project.liveCount })),
  )

  return rows.map(({ project, label, seed }) => {
    const craft = craftOf(project)
    const count = project.liveCount
    const kinds = project.kinds.slice().sort((a, b) => byCount(a, b, a.kind, b.kind))
    const tags = project.tags.slice().sort((a, b) => byCount(a, b, a.tag, b.tag))
    const idleDays = project.lastActive === null ? Number.NaN : daysBetween(now, Date.parse(project.lastActive))
    return {
      owner: project.owner,
      label,
      seed,
      count,
      craft,
      style: craft === null ? (styles[project.owner] ?? null) : null,
      kindUnknown: project.projectKind === 'unknown',
      noRemote: project.projectKind === 'repo' && project.remoteHost === null,
      remoteHost: project.remoteHost,
      activity: project.activity30,
      activitySource: project.activitySource,
      recalls: project.recallsTotal,
      age: project.medianAgeDays,
      unknown: project.unknown,
      global: project.global,
      lastActive: project.lastActive,
      iceCap: idleDays >= ICE_CAP_DAYS,
      clouds: count > 0 && project.unknown / count > CLOUD_SHARE,
      kinds,
      moons: craft !== null || count < DWARF_UNDER ? [] : kinds.filter(k => k.kind !== 'unknown').slice(0, MAX_MOONS),
      land: tags.slice(0, MAX_LAND),
      islands: Math.max(0, project.tagsTotal - Math.min(tags.length, MAX_LAND)),
      tags,
      tagsTotal: project.tagsTotal,
    }
  })
}

/**
 * The hash of anything that belongs to a body: its seed, then `suffix` (the mockup hashed the project id).
 * MAPX.5: tag lights and moon pivots must use `hashOf(body, tag)` (the mockup's hash had no '|' separator).
 */
export const hashOf = (body: { seed: string }, suffix = ''): number => fnv(body.seed + suffix)
/** Where on its orbit a planet starts, in radians. */
export const startAngle = (body: { seed: string }): number => (hashOf(body) % 6283) / 1000
/** A body's own tilt draws (orbit plane x and z, and the axis lean), from `seed + 'orbit'`. */
export function orbitTilt(body: { seed: string }): { x: number; z: number; axis: number } {
  const next = rng(hashOf(body, 'orbit'))
  return { x: (next() - 0.5) * 0.12, z: (next() - 0.5) * 0.12, axis: 0.1 + next() * 0.35 }
}
/** The hash that places and sizes one tag's land mass on a body. */
export const tagHash = (body: { seed: string }, tag: string): number => hashOf(body, `|${tag}`)

// ---- Size, speed, distance ----------------------------------------------------------

type Sized = { count: number }

export function planetR(body: Sized): number {
  return (body.count < DWARF_UNDER ? 6.5 : 7 + Math.sqrt(body.count) * 2.5) * 1.4
}
/** The drawn radius: a craft is drawn a little bigger than a planet of its count. */
export function bodyR(body: Sized & { craft?: Craft | null }): number {
  return planetR(body) * (body.craft === 'ship' ? 1.5 : body.craft === 'station' ? 1.15 : 1)
}
/** Radians per second: big bodies crawl, small ones move faster (a dwarf's 0.04). */
export function orbitSpeed(body: Sized): number {
  return 0.04 * (planetR({ count: 2 }) / planetR(body))
}
/** The room a body takes on its orbit. */
export function extent(body: Sized): number {
  return planetR(body) * (body.count < DWARF_UNDER ? 2 : 2.7)
}

/** The number a body is ranked by under an Arrange choice (bigger = closer to the sun). */
export function metric(body: Pick<Body, 'activity' | 'count' | 'age' | 'recalls'>, arrange: Arrange): number {
  return arrange === 'activity' ? body.activity : arrange === 'size' ? body.count : arrange === 'age' ? -(body.age ?? 1e9) : body.recalls
}
export function metricText(body: Pick<Body, 'activity' | 'count' | 'age' | 'recalls'>, arrange: Arrange): string {
  if (arrange === 'activity') return `${body.activity} activity`
  if (arrange === 'size') return `${body.count} memories`
  if (arrange === 'age') return body.age === null ? 'no live memories' : `${Math.round(body.age * 10) / 10} d median`
  return `${body.recalls} recalls`
}

export type Ring = {
  index: number
  radius: number
  /** Largest drawn body first, then label, owner. */
  owners: string[]
  /** The ring's one speed: the largest body's, in radians per second. */
  speed: number
  /** Where each owner sits relative to the lead: evenly spaced, in radians. */
  phases: number[]
  /** The ring's one tilt, shared by its bodies. */
  tilt: { x: number; z: number }
}
export type Orbits = { radius: Record<string, number>; ringOf: Record<string, number>; rings: Ring[] }

/**
 * At most MAX_RINGS orbits, ranked by the Arrange metric (ties by label, then owner). Past
 * MAX_RINGS bodies the least significant share the outer rings: rank i of n goes to ring
 * 9 - floor((n-1-i)*10/n). The ring gaps grow with the bodies' extent, so none overlap.
 */
export function targets(bodies: readonly Body[], arrange: Arrange): Orbits {
  const list = bodies.slice().sort((a, b) => metric(b, arrange) - metric(a, arrange) || byLabel(a, b))
  const n = list.length
  const groups: Body[][] = []
  list.forEach((body, i) => {
    const ring = n <= MAX_RINGS ? i : MAX_RINGS - 1 - Math.floor(((n - 1 - i) * MAX_RINGS) / n)
    ;(groups[ring] ??= []).push(body)
  })
  const out: Orbits = { radius: {}, ringOf: {}, rings: [] }
  let radius = 0
  let previous: number | null = null
  for (const group of groups) {
    if (group === undefined) continue
    const reach = Math.max(...group.map(extent))
    radius = previous === null ? 140 + reach : radius + previous + reach + 16
    const members = group.slice().sort((a, b) => bodyR(b) - bodyR(a) || byLabel(a, b))
    const index = out.rings.length
    const draw = rng(fnv(`ring${index}`))
    out.rings.push({
      index,
      radius,
      owners: members.map(m => m.owner),
      speed: orbitSpeed(members[0] as Body),
      phases: members.map((_, k) => (k * Math.PI * 2) / members.length),
      tilt: { x: (draw() - 0.5) * 0.12, z: (draw() - 0.5) * 0.12 },
    })
    for (const member of members) {
      out.radius[member.owner] = radius
      out.ringOf[member.owner] = index
    }
    previous = reach
  }
  return out
}

/** Seconds for one orbit at a speed in radians per second. */
export const orbitSeconds = (speed: number): number => (Math.PI * 2) / speed

// ---- Words --------------------------------------------------------------------------

export function sizeClass(body: Sized): string {
  const kind = sizeKind(body.count)
  return kind === 'dwarf' ? 'dwarf (under 3 memories)' : kind === 'rocky' ? 'rocky world (under 10)' : kind === 'ice' ? 'ice giant (10 to 29)' : 'gas giant (30 or more)'
}

/** The one-line account of what a body is (the planet tooltip's second line). */
export function describe(body: Pick<Body, 'craft' | 'style' | 'count' | 'kindUnknown' | 'noRemote' | 'remoteHost'>): string {
  if (body.craft !== null) return `${body.craft === 'station' ? 'Space station' : 'Starship'}: a plain folder, no git repo`
  const look = body.style === null ? '' : `${STYLES[body.style].label} `
  const where = body.kindUnknown
    ? ' · kind unknown'
    : body.noRemote
      ? ' · no remote (local-only repo)'
      : body.remoteHost === 'local'
        ? ' · repo with a local remote'
        : body.remoteHost !== null
          ? ` · repo on ${body.remoteHost}`
          : ''
  return `${look}${sizeClass(body)}${where}`
}

export function labelName(body: Pick<Body, 'label' | 'craft' | 'count'>): string {
  if (body.craft !== null) return `${body.label} · ${body.craft === 'station' ? 'station' : 'starship'}`
  return body.label + (body.count < DWARF_UNDER ? ' (dwarf)' : '')
}

/** In how many other bodies a tag also appears. */
export function sharedCount(bodies: readonly Body[], tag: string, owner: string): number {
  return bodies.filter(body => body.owner !== owner && body.tags.some(t => t.tag === tag)).length
}

// ---- Colours ------------------------------------------------------------------------

export function tagColour(name: string): string {
  const h = fnv(name)
  if (name.startsWith('agent:')) return `hsl(${275 + (h % 35)}, 55%, 68%)`
  if (name.startsWith('entity:')) return `hsl(${180 + (h % 25)}, 55%, 60%)`
  if (name.startsWith('asset:')) return `hsl(${28 + (h % 18)}, 70%, 62%)`
  return `hsl(${62 + (h % 92)}, 40%, ${44 + ((h >>> 8) % 16)}%)`
}

/** An asteroid's colour: grey when its kind is unknown, else by the Colour-dots-by mode. */
export function dotColour(mode: ColourMode, seed: number, kind: string, writer: string = WRITER_PALETTE[0]): string {
  if (kind === 'unknown') return '#8b93a3'
  if (mode === 'writer') return writer
  const r = rng(seed)()
  if (mode === 'recalls') return `hsl(48, 95%, ${Math.round(38 + r * 50)}%)`
  return `hsl(${Math.round(200 + r * 80)}, 70%, 66%)`
}

export type WriterInfo = SolarWriter & {
  colour: string
  lat: number
  lon: number
  /** The unit vector from the sun's centre to the nodule. */
  dir: [number, number, number]
}

/** Where a writer's nodule sits on the sun: a latitude and longitude from a hash of its name. */
export function noduleSpot(source: string): { lat: number; lon: number; dir: [number, number, number] } {
  const lon = (fnv(`${source}|lon`) % 6283) / 1000
  const lat = ((fnv(`${source}|lat`) % 1201) - 600) / 1000
  return { lat, lon, dir: [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)] }
}

/** Writers by count (then name), taking the palette in order and wrapping after six. */
export function writerInfos(writers: readonly SolarWriter[]): WriterInfo[] {
  return writers
    .slice()
    .sort((a, b) => b.count - a.count || before(a.source, b.source))
    .map((writer, i) => ({ ...writer, colour: WRITER_PALETTE[i % WRITER_PALETTE.length] as string, ...noduleSpot(writer.source) }))
}

/** A writer's colour; a source with no nodule (a retired writer) takes the first palette colour. */
export function writerColour(infos: readonly WriterInfo[], source: string): string {
  return infos.find(info => info.source === source)?.colour ?? WRITER_PALETTE[0]
}

// ---- The sun belt: global memories ----------------------------------------------------

/**
 * One entry per global memory: the project it was saved in, or null for an owner-'global'
 * row. The list is `globalLive` long (rows with scope global or owner global).
 */
export function sunBelt(galaxy: Pick<SolarGalaxy, 'globalLive'>, bodies: readonly Body[]): { owner: string | null }[] {
  const out: { owner: string | null }[] = []
  for (const body of bodies) for (let i = 0; i < body.global; i++) out.push({ owner: body.owner })
  while (out.length < galaxy.globalLive) out.push({ owner: null })
  out.length = Math.min(out.length, Math.max(0, galaxy.globalLive))
  return out
}

/**
 * How many live memories the owner 'global' holds (the true globals): the store's own count from the
 * reply's projects list, else (no such entry) the live owner-'global' rows of the shown list.
 */
export function globalOwnedOf(galaxy: Pick<SolarGalaxy, 'projects' | 'memories'>): number {
  const entry = galaxy.projects.find(project => project.owner === 'global')
  if (entry !== undefined) return Math.max(0, entry.liveCount)
  return galaxy.memories.filter(memory => memory.owner === 'global' && memory.state === 'live').length
}

// ---- Probes: a project's memories shared with every project (0.14.0) ------------------

/** The most probes drawn around one body; the rest are counted in each probe's tooltip. */
export const PROBES_MAX = 48
/** A body's probes: its live memories saved with scope 'global', in the reply's order (newest first), at most PROBES_MAX. */
export type Probes = { memories: SolarMemory[]; total: number }

export function probesOf(galaxy: Pick<SolarGalaxy, 'memories'>, owner: string): Probes {
  if (owner === 'global') return { memories: [], total: 0 }
  const all = galaxy.memories.filter(memory => memory.owner === owner && memory.scope === 'global' && memory.state === 'live')
  return { memories: all.slice(0, PROBES_MAX), total: all.length }
}

/** A global memory's tie to a project: its pairs with that project's memories in the galaxy's links (map.linkScore applies). */
export type BeltRelation = { owner: string; pairs: number; best: number }
/**
 * One dot of the sun belt, keyed to its memory (0.13.0). Since 0.14.0 the belt holds only the true
 * globals (owner 'global'), so `owner` is always null; a project's memory shared with every project is
 * a probe around its own body instead (probesOf). `id` is null for a padding slot (a global row the
 * capped memory list does not carry). `related`: the projects whose memories it is close to, from the
 * links that have 'global' on one side (best first, at most BELT_RELATED_MAX).
 */
export type BeltDot = { id: string | null; owner: string | null; related: BeltRelation[] }
export const BELT_RELATED_MAX = 3

/**
 * The sun belt as dots keyed to memories: one per true global (globalOwnedOf long). Order: those with
 * relations first, grouped by their closest project (so neighbouring dots tie to the same planet), then
 * the rest, then the padding slots. Only live memories count; a relation to a project that is not a body
 * is dropped.
 */
export function beltDots(galaxy: Pick<SolarGalaxy, 'projects' | 'memories' | 'links'>, bodies: readonly Body[]): BeltDot[] {
  const total = globalOwnedOf(galaxy)
  const live = galaxy.memories.filter(memory => memory.state === 'live')
  const ownerOf = new Map(live.map(memory => [memory.id, memory.owner]))
  const bodyOrder = new Map(bodies.map((body, i) => [body.owner, i]))
  // memory id (owner global) -> other owner -> { pairs, best }
  const ties = new Map<string, Map<string, { pairs: number; best: number }>>()
  for (const link of galaxy.links ?? []) {
    if ((link.a === 'global') === (link.b === 'global')) continue
    const other = link.a === 'global' ? link.b : link.a
    if (!bodyOrder.has(other)) continue
    for (const pair of link.pairs) {
      const globalId = ownerOf.get(pair.older) === 'global' ? pair.older : ownerOf.get(pair.newer) === 'global' ? pair.newer : undefined
      if (globalId === undefined) continue
      const perOwner = ties.get(globalId) ?? new Map<string, { pairs: number; best: number }>()
      ties.set(globalId, perOwner)
      const tie = perOwner.get(other) ?? { pairs: 0, best: 0 }
      tie.pairs++
      tie.best = Math.max(tie.best, pair.score)
      perOwner.set(other, tie)
    }
  }
  const relatedOf = (id: string): BeltRelation[] =>
    [...(ties.get(id) ?? new Map()).entries()]
      .map(([owner, tie]) => ({ owner, pairs: tie.pairs, best: Math.round(tie.best * 100) / 100 }))
      .sort((x, y) => y.best - x.best || y.pairs - x.pairs || before(x.owner, y.owner))
      .slice(0, BELT_RELATED_MAX)
  const globals: BeltDot[] = live
    .filter(memory => memory.owner === 'global')
    .map(memory => ({ id: memory.id, owner: null, related: relatedOf(memory.id) }))
    .sort((x, y) => {
      const xo = x.related[0]?.owner
      const yo = y.related[0]?.owner
      if (xo === undefined || yo === undefined) return xo === undefined ? (yo === undefined ? before(x.id ?? '', y.id ?? '') : 1) : -1
      return (bodyOrder.get(xo) ?? 0) - (bodyOrder.get(yo) ?? 0) || before(x.id ?? '', y.id ?? '')
    })
  const out = [...globals]
  while (out.length < total) out.push({ id: null, owner: null, related: [] })
  out.length = Math.min(out.length, total)
  return out
}

// ---- Black holes: similar memories across projects ------------------------------------

export type LinkInfo = { older: string; newer: string; pairs: number; best: number }

/** The galaxy's links between two bodies (never the owner 'global'), older project first. */
export function linkInfos(galaxy: Pick<SolarGalaxy, 'links'>, bodies: readonly Body[]): LinkInfo[] {
  const have = new Set(bodies.map(body => body.owner))
  const label = new Map(bodies.map(body => [body.owner, body.label]))
  return (galaxy.links ?? [])
    .filter(link => link.a !== link.b && have.has(link.a) && have.has(link.b) && link.pairs.length > 0)
    .map(link => ({ older: link.a, newer: link.b, pairs: link.pairs.length, best: Math.round(Math.max(...link.pairs.map(p => p.score)) * 100) / 100 }))
    .sort((x, y) => before(label.get(x.older) ?? '', label.get(y.older) ?? '') || before(label.get(x.newer) ?? '', label.get(y.newer) ?? '') || before(x.older, y.older) || before(x.newer, y.newer))
}

export const linksOf = (links: readonly LinkInfo[], owner: string): LinkInfo[] => links.filter(link => link.older === owner || link.newer === owner)

// ---- Find: bodies, moons and tags (memories come from POST /api/search) ---------------

export type SearchHit = { type: 'Planet' | 'Station' | 'Starship' | 'Moon' | 'Tag'; label: string; sub: string; n: number; target: Target }
export type SearchOutcome = { results: SearchHit[]; match: Record<string, true> }

export const SEARCH_MIN = 2
export const SEARCH_MAX = 10

/** The matches for a typed query: at most 10 results, and the owners to keep lit. */
export function searchResults(bodies: readonly Body[], query: string): SearchOutcome {
  const q = (query ?? '').trim().toLowerCase()
  const out: SearchOutcome = { results: [], match: {} }
  if (q.length < SEARCH_MIN) return out
  const found: SearchHit[] = []
  const moons: SearchHit[] = []
  const tags: SearchHit[] = []
  // Visit the bodies by label, then owner, so the result does not depend on the input order.
  const ordered = bodies.slice().sort((a, b) => before(a.label, b.label) || before(a.owner, b.owner))
  for (const body of ordered) {
    let hit = false
    if (body.label.toLowerCase().includes(q)) {
      hit = true
      found.push({ type: body.craft === null ? 'Planet' : body.craft === 'station' ? 'Station' : 'Starship', label: body.label, sub: `${body.count} memories`, n: body.count, target: { level: 'planet', owner: body.owner } })
    }
    for (const moon of body.moons) {
      if (kindLabel(moon.kind).toLowerCase().includes(q) || moon.kind.includes(q)) {
        hit = true
        moons.push({ type: 'Moon', label: `${kindLabel(moon.kind)} of ${body.label}`, sub: `${moon.count} memories`, n: moon.count, target: { level: 'moon', owner: body.owner, kind: moon.kind } })
      }
    }
    for (const tag of body.tags) {
      if (tag.tag.includes(q)) {
        hit = true
        tags.push({ type: 'Tag', label: tag.tag, sub: `${tag.count}× on ${body.label}`, n: tag.count, target: { level: 'planet', owner: body.owner } })
      }
    }
    if (hit) out.match[body.owner] = true
  }
  tags.sort((a, b) => b.n - a.n || before(a.label, b.label) || before(a.sub, b.sub))
  out.results = found.concat(moons, tags).slice(0, SEARCH_MAX)
  return out
}


// ---- The meaning nebula (0.29.0) ------------------------------------------------------

/** One memory in the nebula: where it sits (scene units, under the orbit plane) and which cloud it belongs to. */
export type NebulaSpeck = { id: string; owner: string; kind: string; position: [number, number, number]; cloud: number }
/** A cloud: a group of memories close in meaning. `name` is from its most used tags (else words); `spread` its radius. */
export type NebulaCloud = { centre: [number, number, number]; count: number; spread: number; name: string }
export type Nebula = { specks: NebulaSpeck[]; clouds: NebulaCloud[] }

/** Below this many placed memories there is no nebula (the meaning layout needs ten too). */
export const NEBULA_MIN = 10
/** At most this many clouds. */
export const NEBULA_MAX_CLOUDS = 8
/** The clouds' colours, in cloud order: soft nebula hues, distinct on the dark sky. */
export const NEBULA_PALETTE: readonly string[] = ['#c77dff', '#4cc9f0', '#ff6fb5', '#7ff0c8', '#ffb347', '#8fa8ff', '#f9f871', '#ff8a7a']
/** How flat the nebula is: the meaning layout's height is scaled by this share of its width. */
export const NEBULA_FLAT = 0.18

const NEBULA_STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'was', 'not', 'use', 'uses', 'used', 'when', 'what', 'which', 'have', 'has', 'should', 'must', 'will', 'can', 'all', 'any', 'one', 'via', 'per', 'its', 'their', 'there', 'then', 'than', 'also', 'only', 'more', 'user', 'memory', 'memories', 'project', 'note', 'notes'])

const sq = (x: number) => x * x
const dist2 = (a: readonly number[], b: readonly number[]) => sq((a[0] ?? 0) - (b[0] ?? 0)) + sq((a[1] ?? 0) - (b[1] ?? 0)) + sq((a[2] ?? 0) - (b[2] ?? 0))

// Tags that say who wrote a memory, not what it is about: never a cloud's name.
const NEBULA_SKIP_TAG = /^agent:/
const tagsOf = (m: SolarMemory) => [...new Set((Array.isArray(m?.tags) ? m.tags : []).map(t => String(t).toLowerCase()).filter(t => !NEBULA_SKIP_TAG.test(t)))]
const wordsOf = (m: SolarMemory) => [...new Set((String(m?.label ?? '').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []).filter(w => !NEBULA_STOP.has(w)))]

/**
 * The cloud's name: its two most telling tags (each on at least two of its memories), else words of its
 * memories' first lines. Telling = used often here and seldom elsewhere: count here × ln(1 + all / count
 * everywhere), so a tag on half the store ("sap") names a cloud only when nothing more particular does.
 */
function cloudName(members: readonly SolarMemory[], everywhere: { tags: Map<string, number>; words: Map<string, number>; total: number }, used: Set<string>): string {
  // Shown without a namespace ("entity:arxada" reads "arxada"); a name a bigger cloud has already taken
  // gives way to the next pair, so two clouds never share one.
  const pick = (ranked: (readonly [string, number])[]) => {
    const names = [...new Set(ranked.map(([v]) => v.replace(/^[a-z]+:/, '')))]
    const pairs: string[][] = []
    for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) pairs.push([names[a]!, names[b]!])
    // Taken is by the set of words, whatever their order.
    const key = (parts: string[]) => [...parts].sort().join('\u0000')
    const chosen = [...pairs, ...names.map(n => [n])].find(parts => !used.has(key(parts)))
    if (chosen === undefined) return ''
    used.add(key(chosen))
    return chosen.join(' · ')
  }
  const best = (values: string[], totals: Map<string, number>) => {
    const m = new Map<string, number>()
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()]
      .filter(([, n]) => n >= 2)
      .map(([v, n]) => [v, n * Math.log(1 + everywhere.total / (totals.get(v) ?? n))] as const)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  }
  const tags = best(members.flatMap(tagsOf), everywhere.tags)
  const byTag = tags.length > 0 ? pick(tags) : ''
  return byTag !== '' ? byTag : pick(best(members.flatMap(wordsOf), everywhere.words))
}

/**
 * The nebula: every live memory with a meaning position, laid flat under the orbit plane, and the
 * clouds they form. The meaning layout's x and z become a disc of `radius` (the 95th percentile of the
 * memories' distances from their middle reaches it), its y a thin layer around `-depth`. Clouds are
 * k-means over those places (k from the count, at most NEBULA_MAX_CLOUDS), seeded deterministically
 * (farthest point from the memory nearest the middle), so the same reply gives the same clouds.
 * Fewer than NEBULA_MIN placed memories: an empty nebula.
 */
export function nebulaOf(memories: readonly SolarMemory[], radius: number, depth: number): Nebula {
  const placed = memories
    .filter(m => m.state === 'live' && Array.isArray(m.position) && m.position.length === 3 && m.position.every(v => Number.isFinite(v)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  if (placed.length < NEBULA_MIN || !(radius > 0)) return { specks: [], clouds: [] }
  const raw = placed.map(m => m.position as [number, number, number])
  const mid = [0, 1, 2].map(k => raw.reduce((s, p) => s + p[k]!, 0) / raw.length) as [number, number, number]
  // The disc is turned so its long side runs along x (across the screen from the default camera): the
  // meaning layout is often twice as long one way as the other. Turning keeps every distance.
  let cxx = 0
  let czz = 0
  let cxz = 0
  for (const p of raw) {
    cxx += sq(p[0] - mid[0])
    czz += sq(p[2] - mid[2])
    cxz += (p[0] - mid[0]) * (p[2] - mid[2])
  }
  const turn = 0.5 * Math.atan2(2 * cxz, cxx - czz)
  const cos = Math.cos(-turn)
  const sin = Math.sin(-turn)
  const reach = raw.map(p => Math.hypot(p[0] - mid[0], p[2] - mid[2])).sort((a, b) => a - b)
  const r95 = reach[Math.min(reach.length - 1, Math.floor(reach.length * 0.95))] || 1
  const s = radius / r95
  const cap = radius * 1.15
  const pos: [number, number, number][] = raw.map(p => {
    const dx = p[0] - mid[0]
    const dz = p[2] - mid[2]
    let x = (dx * cos - dz * sin) * s
    let z = (dx * sin + dz * cos) * s
    const d = Math.hypot(x, z)
    if (d > cap) {
      x *= cap / d
      z *= cap / d
    }
    return [x, -depth + (p[1] - mid[1]) * s * NEBULA_FLAT, z]
  })
  const k = Math.max(2, Math.min(NEBULA_MAX_CLOUDS, Math.round(Math.sqrt(placed.length / 3))))
  // Seeds: the memory nearest the middle, then each next the farthest from every seed so far.
  const centres: [number, number, number][] = []
  let first = 0
  pos.forEach((p, i) => {
    if (Math.hypot(p[0], p[2]) < Math.hypot(pos[first]![0], pos[first]![2])) first = i
  })
  centres.push([...pos[first]!] as [number, number, number])
  while (centres.length < k) {
    let best = 0
    let bestD = -1
    pos.forEach((p, i) => {
      const d = Math.min(...centres.map(c => dist2(p, c)))
      if (d > bestD) {
        bestD = d
        best = i
      }
    })
    centres.push([...pos[best]!] as [number, number, number])
  }
  const cloudOf = new Array<number>(pos.length).fill(0)
  for (let round = 0; round < 15; round++) {
    let moved = false
    pos.forEach((p, i) => {
      let best = 0
      for (let c = 1; c < centres.length; c++) if (dist2(p, centres[c]!) < dist2(p, centres[best]!)) best = c
      if (cloudOf[i] !== best) {
        cloudOf[i] = best
        moved = true
      }
    })
    centres.forEach((c, ci) => {
      const mine = pos.filter((_, i) => cloudOf[i] === ci)
      if (mine.length === 0) return
      for (let a = 0; a < 3; a++) c[a] = mine.reduce((sum, p) => sum + p[a]!, 0) / mine.length
    })
    if (!moved && round > 0) break
  }
  // Clouds biggest first; an empty one is dropped and the rest renumbered.
  const order = centres
    .map((c, ci) => ({ ci, n: cloudOf.filter(x => x === ci).length }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n || a.ci - b.ci)
  const renumber = new Map(order.map((x, i) => [x.ci, i]))
  const tally = (lists: string[][]) => {
    const m = new Map<string, number>()
    for (const list of lists) for (const v of list) m.set(v, (m.get(v) ?? 0) + 1)
    return m
  }
  const everywhere = { tags: tally(placed.map(tagsOf)), words: tally(placed.map(wordsOf)), total: placed.length }
  const used = new Set<string>()
  const clouds: NebulaCloud[] = order.map(({ ci, n }) => {
    const members = placed.filter((_, i) => cloudOf[i] === ci)
    const spots = pos.filter((_, i) => cloudOf[i] === ci)
    const centre = centres[ci]!
    const spread = Math.sqrt(spots.reduce((sum, p) => sum + dist2(p, centre), 0) / spots.length)
    return { centre: [centre[0], centre[1], centre[2]], count: n, spread, name: cloudName(members, everywhere, used) }
  })
  const specks: NebulaSpeck[] = placed.map((m, i) => ({ id: m.id, owner: m.owner, kind: m.kind, position: pos[i]!, cloud: renumber.get(cloudOf[i]!) ?? 0 }))
  return { specks, clouds }
}

/** 0.30.0: a cloud's tie to a project: how many of the cloud's memories it holds, and their share of the cloud. */
export type CloudTie = { cloud: number; owner: string; count: number; share: number }
/** A tie needs at least this many of the cloud's memories in the project: one stray memory draws nothing. */
export const TIE_MIN = 2

/**
 * 0.30.0: the ties from each cloud to the projects its memories live in (owner `global` included: the scene
 * ties it to the sun). Clouds in order, then biggest first, ties by owner on equal counts.
 */
export function cloudTies(nebula: Nebula): CloudTie[] {
  const ties: CloudTie[] = []
  nebula.clouds.forEach((cloud, ci) => {
    const counts = new Map<string, number>()
    for (const sp of nebula.specks) if (sp.cloud === ci) counts.set(sp.owner, (counts.get(sp.owner) ?? 0) + 1)
    const mine = [...counts.entries()]
      .filter(([, n]) => n >= TIE_MIN)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([owner, count]) => ({ cloud: ci, owner, count, share: cloud.count > 0 ? count / cloud.count : 0 }))
    ties.push(...mine)
  })
  return ties
}

/** 0.30.0: the "Topics: …" text of a project (its ties, biggest first), or null when it feeds no cloud. */
export function topicsLine(nebula: Nebula, ties: readonly CloudTie[], owner: string, max = 3): string | null {
  const mine = ties.filter(t => t.owner === owner).sort((a, b) => b.count - a.count || a.cloud - b.cloud)
  if (mine.length === 0) return null
  const named = mine.slice(0, max).map(t => `${nebula.clouds[t.cloud]?.name || `cloud ${t.cloud + 1}`} (${t.count})`)
  return `Topics: ${named.join(', ')}${mine.length > max ? ` +${mine.length - max} more` : ''}`
}