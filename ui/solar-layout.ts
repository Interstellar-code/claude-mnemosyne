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
}

export type SolarWriter = { source: string; count: number; inferred: number }
export type SolarLink = { a: string; b: string; pairs: { older: string; newer: string; score: number }[] }

export type SolarGalaxy = {
  projects: SolarProject[]
  memories: SolarMemory[]
  writers: SolarWriter[]
  globalLive: number
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
/** A plain folder with this many live memories is a space station, else a starship. */
export const STATION_MIN = 5
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
export function buildBodies(galaxy: Pick<SolarGalaxy, 'projects'>, now: number): Body[] {
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
    project.projectKind === 'folder' ? (project.liveCount >= STATION_MIN ? 'station' : 'ship') : null
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

/** The hash of anything that belongs to a body: its seed, then `suffix` (the mockup hashed the project id). */
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
  for (const body of bodies) {
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
