// Map events from the activity stream, and the Simulate buttons' demo source
// (plan EVT, C5).
//
// toMapEvent turns one activity line into the event the map draws: a recall
// lights the ids it found, a save adds a star, an update pulses one, a forget
// fades them out. Lines that draw nothing (stats, rearm, extract) and failed
// lines give null.
//
// simulate makes one realistic event for the Simulate buttons, from the galaxy
// the page already holds. It is demo-only: it never calls the server, never
// writes the store and never reaches activity.jsonl (EVT.2).

export type MapEventKind = 'recall' | 'save' | 'update' | 'forget'

export type MapEvent = {
  kind: MapEventKind
  // The memories this event touches: found (recall), written (save), changed
  // (update) or deleted (forget).
  ids: string[]
  // The app that caused it (CTX's client field), or 'unknown' for an old line.
  client: string
  // The line's timestamp, or now for a demo event.
  t: string
  // The project (owner) and topic (first tag) the event belongs to, when known.
  owner?: string
  topic?: string
  // A Simulate button made it: the page may animate it and never persist it.
  demo?: true
}

export type GalaxyMemoryLike = {
  id: string
  owner?: string
  tags?: readonly unknown[]
  label?: string
}
export type GalaxyProjectLike = { owner: string; count?: number }
export type GalaxyLike = {
  projects?: readonly GalaxyProjectLike[]
  memories?: readonly GalaxyMemoryLike[]
}

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)
const first = (ids: unknown) => (Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])

/** One activity line as the map needs it; null when the line draws nothing. */
export function toMapEvent(line: Record<string, unknown>): MapEvent | null {
  // A failed call touched nothing the map can show.
  if (line.ok === false) return null
  const action = str(line.action)
  if (action === undefined) return null
  const t = str(line.t) ?? ''
  const client = str(line.client) ?? 'unknown'
  const owner = str(line.owner)
  const ids = first(line.ids)
  switch (action) {
    case 'recall':
      return { kind: 'recall', ids, client, t, ...(owner !== undefined ? { owner } : {}) }
    case 'remember':
      return { kind: 'save', ids, client, t, ...(owner !== undefined ? { owner } : {}) }
    case 'update':
      return { kind: 'update', ids, client, t, ...(owner !== undefined ? { owner } : {}) }
    case 'forget':
      return { kind: 'forget', ids, client, t, ...(owner !== undefined ? { owner } : {}) }
    // stats, rearm, extract and any unknown action draw nothing.
    default:
      return null
  }
}

/**
 * The writer nodule an event's client belongs to (plan MAPX.5, risk 9): the source that
 * equals the client, else `mcp:<client>`, else null, which the scene draws from the sun's centre.
 */
export function noduleFor(client: string, sources: readonly string[]): string | null {
  if (sources.includes(client)) return client
  const outside = `mcp:${client}`
  return sources.includes(outside) ? outside : null
}

/**
 * Whether the map draws an event at all. The dashboard's own Find logs a recall (client
 * 'dashboard'); searching must not light the map, so that line draws nothing (risk 10).
 */
export const drawsOnMap = (event: Pick<MapEvent, 'kind' | 'client'>): boolean => !(event.kind === 'recall' && event.client === 'dashboard')

/** A topic's name as the galaxy groups it: the first non-empty string tag, else Untagged. */
export function topicOf(memory: GalaxyMemoryLike): string {
  for (const tag of memory.tags ?? []) {
    if (typeof tag !== 'string') continue
    const text = tag.trim()
    if (text !== '') return text
  }
  return 'Untagged'
}

/** A client-side id for a demo save: never a stored id, so nothing can collide with one. */
export function demoId(random: () => number = Math.random): string {
  const part = () => Math.floor(random() * 0x100000000).toString(16).padStart(8, '0')
  return `demo-${part()}${part()}`
}

// The write mix: a save 50%, an update 32%, a forget 18%.
export const WRITE_MIX: readonly { kind: MapEventKind; upTo: number }[] = [
  { kind: 'save', upTo: 0.5 },
  { kind: 'update', upTo: 0.82 },
  { kind: 'forget', upTo: 1 },
]
// A recall lights at most this many memories.
export const RECALL_HITS = 3

/** The project a draw lands on, weighted by its memory count, or undefined when the galaxy is empty. */
export function pickProject(projects: readonly GalaxyProjectLike[], random: () => number): GalaxyProjectLike | undefined {
  const total = projects.reduce((sum, project) => sum + Math.max(0, project.count ?? 0), 0)
  if (projects.length === 0 || total <= 0) return undefined
  let point = random() * total
  for (const project of projects) {
    point -= Math.max(0, project.count ?? 0)
    if (point <= 0) return project
  }
  return projects[projects.length - 1]
}

/**
 * simulate(kind, galaxy): one demo event for the Simulate buttons.
 * 'recall' picks a project weighted by its count, one of its topics and up to
 * RECALL_HITS memories; 'write' picks a save, an update or a forget. A save
 * carries a client-side id and the topic of a real memory. Returns undefined
 * when the galaxy holds nothing to draw on.
 */
export function simulate(kind: 'recall' | 'write', galaxy: GalaxyLike, random: () => number = Math.random): MapEvent | undefined {
  const memories = galaxy.memories ?? []
  // Only projects with memories in the list: another owner's ids never get this project's label.
  const listed = new Set(memories.map(memory => memory.owner))
  const projects = (galaxy.projects ?? []).filter(project => (project.count ?? 0) > 0 && listed.has(project.owner))
  const project = pickProject(projects, random)
  if (project === undefined) return undefined
  const pool = memories.filter(memory => memory.owner === project.owner)
  if (pool.length === 0) return undefined
  const t = new Date().toISOString()
  let action: MapEventKind = kind === 'recall' ? 'recall' : 'save'
  if (kind === 'write') {
    const point = random()
    action = WRITE_MIX.find(mix => point < mix.upTo)?.kind ?? 'save'
  }
  const topic = topicOf(pool[Math.floor(random() * pool.length)] ?? pool[0]!)
  if (action === 'recall' || action === 'save') {
    // The topic constrains the picks; the pool always holds the memory it came from.
    const sameTopic = pool.filter(memory => topicOf(memory) === topic)
    const shuffled = [...(sameTopic.length > 0 ? sameTopic : pool)]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      const a = shuffled[i]!
      shuffled[i] = shuffled[j]!
      shuffled[j] = a
    }
    const picks = action === 'recall' ? shuffled.slice(0, Math.min(RECALL_HITS, shuffled.length)) : shuffled.slice(0, 1)
    const ids = action === 'save' ? [demoId(random)] : picks.map(memory => memory.id)
    return { kind: action, ids, client: 'demo', t, owner: project.owner, topic, demo: true }
  }
  const memory = pool[Math.floor(random() * pool.length)] ?? pool[0]!
  return { kind: action, ids: [memory.id], client: 'demo', t, owner: project.owner, topic: topicOf(memory), demo: true }
}
