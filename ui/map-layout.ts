// Pure, seeded layout math for the memory galaxy and its timeline (plan LAYOUT, C4).
//
// Every position is computed, never simulated: the same data gives the same
// numbers on every call and in any input order. A random draw is seeded from the
// memory or topic id it belongs to, never from a shared sequential stream, so a
// shuffle changes nothing and `placeOne` can add one star without moving the rest.
//
// No imports and no three.js: the UI lane draws with these numbers only.
// The mockup this follows is design/MapGalaxy.dc.html (buildData, tl, rangeDays,
// scaleFor, axis).

export type Vec3 = [number, number, number]

// ---- Deterministic randomness -------------------------------------------------

/** A 32-bit FNV-1a hash of a string: the one seed rule for every random draw. */
export function seedOf(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** A mulberry32 stream for one seed: the same seed gives the same sequence. */
export function randomOf(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One standard-normal draw (Box–Muller) from a uniform stream. */
export function gauss(random: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = random()
  while (v === 0) v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ---- Galaxy layout (LAYOUT.1) -------------------------------------------------

// Golden angle: the Fibonacci/golden-angle sphere the mockup uses.
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
// The sphere's spread: cores sit about this far apart.
export const CORE_SPREAD = 360
// The hub ring around a core is this share of the core's radius.
export const HUB_RING = 0.8
// A project core's radius, from its memory count.
export const coreRadius = (count: number) => 34 + Math.sqrt(Math.max(0, count)) * 13
// A topic's scatter around its hub, from its memory count.
export const topicSpread = (count: number) => 10 + Math.sqrt(Math.max(0, count)) * 5
export const UNTAGGED = 'Untagged'

export type GalaxyInputMemory = {
  id: string
  owner?: string
  tags?: readonly unknown[]
  recalls?: number
  lastRecalled?: string | null
  created?: string | null
  label?: string
}

export type GalaxyInputProject = {
  owner: string
  label?: string
  count?: number
  recalls?: number
}

export type GalaxyInput = {
  projects?: readonly GalaxyInputProject[]
  memories?: readonly GalaxyInputMemory[]
}

export type GalaxyCore = {
  owner: string
  label: string
  count: number
  recalls: number
  position: Vec3
  radius: number
}

export type GalaxyHub = {
  key: string
  project: string
  name: string
  count: number
  position: Vec3
  untagged: boolean
}

export type GalaxyStar = {
  id: string
  owner: string
  topic: string
  tags: string[]
  position: Vec3
  recalls: number
  lastRecalled: string | null
  created: string | null
  label: string
}

export type GalaxyBridge = { tag: string; a: string; b: string }

export type GalaxyLayout = {
  cores: GalaxyCore[]
  hubs: GalaxyHub[]
  stars: GalaxyStar[]
  bridges: GalaxyBridge[]
  coreByOwner: Record<string, number>
  hubByKey: Record<string, number>
  starById: Record<string, number>
}

const label = (value: unknown, fallback: string) => (typeof value === 'string' && value !== '' ? value : fallback)

/** A project's label, as GDATA's projectLabel gives it: Global, or the owner. */
const projectLabel = (owner: string) => (owner === 'global' ? 'Global' : owner)

/** The first tag of a memory, normalized, or Untagged. */
export function firstTag(tags: readonly unknown[] | undefined): string {
  for (const tag of tags ?? []) {
    if (typeof tag !== 'string') continue
    const text = tag.trim().toLowerCase()
    if (text !== '') return text
  }
  return UNTAGGED
}

/** A topic's stable key: `<owner>/<tag>`, so two projects never share one. */
export const topicKey = (owner: string, name: string) => `${owner}/${name}`

const isUntagged = (name: string) => name.toLowerCase() === UNTAGGED.toLowerCase()

/** The sphere radius for `n` cores, scaled so the nearest pair sits about CORE_SPREAD apart. */
const coreSphereRadius = (n: number) => (n <= 1 ? 0 : (CORE_SPREAD * Math.sqrt(n)) / Math.sqrt(4 * Math.PI))

/** A point on the golden-angle sphere for index `i` of `n`. */
function goldenPoint(i: number, n: number, radius: number): Vec3 {
  const y = n <= 1 ? 0 : 1 - (2 * i + 1) / n
  const ring = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = i * GOLDEN_ANGLE
  return [Math.cos(theta) * ring * radius, y * radius, Math.sin(theta) * ring * radius]
}

/**
 * galaxyLayout(data): cores, hubs, stars and bridges for a `/api/galaxy` reply.
 * The input is canonicalized (projects by owner, topics by name with Untagged
 * last, stars by id), so a shuffle gives the same numbers. Every scatter is
 * seeded from the memory id (and a new hub from the topic key).
 */
export function galaxyLayout(data: GalaxyInput): GalaxyLayout {
  const memories = [...(data.memories ?? [])]
  const owners = new Set<string>()
  for (const project of data.projects ?? []) owners.add(project.owner)
  for (const memory of memories) owners.add(memory.owner ?? 'global')
  const sortedOwners = [...owners].sort()

  const given = new Map((data.projects ?? []).map(project => [project.owner, project]))
  const perOwner = new Map<string, GalaxyInputMemory[]>()
  for (const memory of memories) {
    const owner = memory.owner ?? 'global'
    const list = perOwner.get(owner) ?? []
    list.push(memory)
    perOwner.set(owner, list)
  }

  const coreRadiusSphere = coreSphereRadius(sortedOwners.length)
  const cores: GalaxyCore[] = []
  const hubs: GalaxyHub[] = []
  const stars: GalaxyStar[] = []
  const coreByOwner: Record<string, number> = {}
  const hubByKey: Record<string, number> = {}
  const starById: Record<string, number> = {}

  sortedOwners.forEach((owner, index) => {
    const project = given.get(owner)
    const members = perOwner.get(owner) ?? []
    const count = project?.count ?? members.length
    const radius = coreRadius(count)
    const position = goldenPoint(index, sortedOwners.length, coreRadiusSphere)
    coreByOwner[owner] = cores.length
    cores.push({ owner, label: label(project?.label, projectLabel(owner)), count, recalls: project?.recalls ?? members.reduce((sum, m) => sum + (m.recalls ?? 0), 0), position, radius })

    // Topic groups: first tag, sorted by name, Untagged last.
    const groups = new Map<string, GalaxyInputMemory[]>()
    for (const memory of members) {
      const name = firstTag(memory.tags)
      const list = groups.get(name) ?? []
      list.push(memory)
      groups.set(name, list)
    }
    const names = [...groups.keys()].sort((a, b) => {
      if (isUntagged(a) && !isUntagged(b)) return 1
      if (!isUntagged(a) && isUntagged(b)) return -1
      return a.localeCompare(b)
    })
    const hubRadius = names.length <= 1 ? 0 : radius * HUB_RING
    names.forEach((name, topicIndex) => {
      const key = topicKey(owner, name)
      const hubPosition = goldenPoint(topicIndex, names.length, hubRadius)
      const hub: GalaxyHub = {
        key,
        project: owner,
        name,
        count: (groups.get(name) ?? []).length,
        position: [position[0] + hubPosition[0], position[1] + hubPosition[1], position[2] + hubPosition[2]],
        untagged: isUntagged(name),
      }
      hubByKey[key] = hubs.length
      hubs.push(hub)
    })
  })

  // Stars: one per memory, seeded by its id, sorted by id so the array is stable too.
  const sortedMemories = [...memories].sort((a, b) => a.id.localeCompare(b.id))
  for (const memory of sortedMemories) {
    const owner = memory.owner ?? 'global'
    const name = firstTag(memory.tags)
    const key = topicKey(owner, name)
    const hubIndex = hubByKey[key]
    if (hubIndex === undefined) continue
    const hub = hubs[hubIndex]
    if (hub === undefined) continue
    const random = randomOf(seedOf(memory.id))
    const spread = topicSpread(hub.count)
    starById[memory.id] = stars.length
    stars.push({
      id: memory.id,
      owner,
      topic: key,
      tags: (memory.tags ?? []).filter((tag): tag is string => typeof tag === 'string' && tag !== ''),
      position: [hub.position[0] + gauss(random) * spread, hub.position[1] + gauss(random) * spread, hub.position[2] + gauss(random) * spread],
      recalls: memory.recalls ?? 0,
      lastRecalled: memory.lastRecalled ?? null,
      created: memory.created ?? null,
      label: label(memory.label, ''),
    })
  }

  // Bridges: hubs in different projects with the same tag name; Untagged never bridges.
  const bridges: GalaxyBridge[] = []
  const byName = new Map<string, GalaxyHub[]>()
  for (const hub of hubs) {
    if (hub.untagged) continue
    const list = byName.get(hub.name) ?? []
    list.push(hub)
    byName.set(hub.name, list)
  }
  const names = [...byName.keys()].sort((a, b) => a.localeCompare(b))
  for (const name of names) {
    const list = byName.get(name) ?? []
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (a === undefined || b === undefined || a.project === b.project) continue
        bridges.push({ tag: name, a: a.key, b: b.key })
      }
    }
  }

  return { cores, hubs, stars, bridges, coreByOwner, hubByKey, starById }
}

/**
 * placeOne(layout, memory): append one new star by the same rules, without moving
 * any existing one. Returns the star (and updates the layout's indexes). A topic
 * or project the layout has not seen is given a deterministic position of its own.
 */
export function placeOne(layout: GalaxyLayout, memory: GalaxyInputMemory): GalaxyStar {
  const owner = memory.owner ?? 'global'
  let core = layout.cores[layout.coreByOwner[owner] ?? -1]
  if (core === undefined) {
    // The same golden-angle rule as galaxyLayout, for this project's index in the
    // sphere of one more core; existing cores stay put.
    const index = layout.cores.length
    const position = goldenPoint(index, index + 1, coreSphereRadius(index + 1))
    core = { owner, label: projectLabel(owner), count: 0, recalls: 0, position, radius: coreRadius(1) }
    layout.coreByOwner[owner] = layout.cores.length
    layout.cores.push(core)
  }
  const name = firstTag(memory.tags)
  const key = topicKey(owner, name)
  let hub = layout.hubs[layout.hubByKey[key] ?? -1]
  if (hub === undefined) {
    // The same Fibonacci-sphere rule, for one more hub on this project's core.
    const index = layout.hubs.filter(existing => existing.project === owner).length
    const offset = goldenPoint(index, index + 1, core.radius * HUB_RING)
    hub = {
      key,
      project: owner,
      name,
      count: 0,
      position: [core.position[0] + offset[0], core.position[1] + offset[1], core.position[2] + offset[2]],
      untagged: isUntagged(name),
    }
    layout.hubByKey[key] = layout.hubs.length
    layout.hubs.push(hub)
  }
  const random = randomOf(seedOf(memory.id))
  // The spread a rebuild would use once this star is in its topic.
  const spread = topicSpread(hub.count + 1)
  const star: GalaxyStar = {
    id: memory.id,
    owner,
    topic: key,
    tags: (memory.tags ?? []).filter((tag): tag is string => typeof tag === 'string' && tag !== ''),
    position: [hub.position[0] + gauss(random) * spread, hub.position[1] + gauss(random) * spread, hub.position[2] + gauss(random) * spread],
    recalls: memory.recalls ?? 0,
    lastRecalled: memory.lastRecalled ?? null,
    created: memory.created ?? null,
    label: label(memory.label, ''),
  }
  hub.count++
  layout.starById[star.id] = layout.stars.length
  layout.stars.push(star)
  return star
}

// ---- Timeline layout (LAYOUT.2) ----------------------------------------------

export type TimelineRange = 7 | 30 | 'all'
export type TimelineNode =
  | { kind: 'claude' }
  | { kind: 'project'; lane: number; lanes: number }
  | { kind: 'topic'; id: string; lane: number; lanes: number; age: number; depth: number }
  | { kind: 'memory'; id: string; lane: number; lanes: number; age: number; depth: number }

// Today on the right at x = 280, the range's oldest day at x = -280.
export const TIMELINE_TODAY_X = 280
export const TIMELINE_DAYS_X = 560
// One lane per project, centred and spaced evenly within this many units.
export const LANE_SPAN = 240
export const PROJECT_CORE_X = -340
export const CLAUDE_CORE: Vec3 = [300, 185, 0]
// A memory's seeded y jitter around its lane.
export const LANE_JITTER = 9

/** The numeric span of a range: 7, 30, or the oldest memory's age plus two days. */
export function rangeDays(range: TimelineRange, oldestDays = 0): number {
  return range === 'all' ? Math.max(0, oldestDays) + 2 : range
}

/** A lane's y: centred on zero, each lane LANE_SPAN / (lanes - 1) from the next. */
export function laneY(lane: number, lanes: number): number {
  if (lanes <= 1) return 0
  return -LANE_SPAN / 2 + (lane * LANE_SPAN) / (lanes - 1)
}

/** Where a node sits in the timeline layout: x from its age, y on its lane, z at its topic's depth. */
export function timelinePosition(node: TimelineNode, days: number): Vec3 {
  if (node.kind === 'claude') return [...CLAUDE_CORE]
  const y = laneY(node.lane, node.lanes)
  if (node.kind === 'project') return [PROJECT_CORE_X, y, 0]
  const scale = TIMELINE_DAYS_X / Math.max(1, days)
  if (node.kind === 'topic') return [TIMELINE_TODAY_X - node.age * scale, y, node.depth]
  const jitter = gauss(randomOf(seedOf(node.id))) * LANE_JITTER
  return [TIMELINE_TODAY_X - node.age * scale, y + jitter, node.depth]
}

export type Tick = { days: number; x: number; label: string }

/** The axis ticks of a range: every day (7), every 7 days (30), every 14 days (all). */
export function ticks(range: TimelineRange, days = range === 'all' ? 0 : range): Tick[] {
  const step = range === 7 ? 1 : range === 30 ? 7 : 14
  const scale = TIMELINE_DAYS_X / Math.max(1, days)
  const out: Tick[] = []
  for (let day = 0; day <= days; day += step) {
    out.push({
      days: day,
      x: TIMELINE_TODAY_X - day * scale,
      label: day === 0 ? 'today' : day === 1 ? '1 day ago' : `${day} days ago`,
    })
  }
  return out
}
