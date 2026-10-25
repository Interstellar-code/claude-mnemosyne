// The meaning layout's maths, in a Worker so the dashboard server keeps
// answering (plan SEMX.1; research/embeddings.md, "A galaxy laid by meaning").
//
// UMAP over 1000 memories takes about 1.1 s and 2000 about 2.3 s: on the
// server's one event loop that stalls /api/health and the activity stream, so
// the reduction runs here and the server awaits the reply. The vectors arrive
// as the store's own JSON text, so the parse is off the server's loop too.
//
// One message in, one reply out. The worker is started by ui/server.ts the
// first time /api/galaxy has enough vectors to lay out, and terminated when
// the server stops.
//   in   { id, inputs: [{ id, owner, json }] }
//   out  { id, count, positions, similar, pairs }   or { id, error }
// The library is the vendored bundle (ui/vendor/semantic-lib.js), never a
// node_modules import, so what runs here is the reviewed, scanned build.
//
// The layout is seeded (SEED), so the same vectors in the same order always
// give the same numbers: the server caches on the set of ids and the model.
declare var self: Worker

import { UMAP } from './vendor/semantic-lib.js'

export type Vec3 = [number, number, number]
// `owner` is the memory's project (MAPX.2): the pairs below cross two owners.
export type MeaningInput = { id: string; owner?: string; json: string }
export type MeaningRequest = { id: number; inputs: MeaningInput[] }
export type MeaningNeighbour = { id: string; score: number }
/** Two memories of different owners with a cosine at or above LINK_COSINE (MAPX.2, C11.3 `links`). */
export type MeaningPair = { a: string; b: string; score: number }
/**
 * The worker's first word on a request: it has taken the job off its queue and is about to
 * work. The server starts that run's clock here, not at post time, so a request queued
 * behind another run does not spend its budget waiting (review L1).
 */
export type MeaningStarted = { id: number; started: true }
export type MeaningReply =
  | { id: number; count: number; positions: Record<string, Vec3>; similar: Record<string, MeaningNeighbour[]>; pairs: MeaningPair[] }
  | { id: number; error: string }

// umap-js's own defaults, from the plan: 3 components, 15 neighbours, minDist 0.1.
export const COMPONENTS = 3
export const NEIGHBORS = 15
// The fixed seed of the layout: every run over the same vectors repeats it.
export const SEED = 0x5eed1a7
// "Similar memories": the top neighbours at or above this cosine.
export const TOP_K = 3
export const MIN_COSINE = 0.65
// MAPX.2: two projects' memories this close are a black hole's pair; at most this many
// per pair of owners leave the worker, best first (the server keeps 50 after dropping the dead).
export const LINK_COSINE = 0.8
export const LINK_PAIRS_PER_OWNERS = 200

/** A mulberry32 stream from SEED: umap-js's `random`, so the embedding is reproducible. */
function randomOf(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The usable vectors: each stored JSON array of finite numbers, of the length
 * most rows share (a mixed-dimension store would otherwise not embed), ids in
 * the order given. A row that does not parse is skipped, never fatal.
 */
export function parseVectors(inputs: readonly MeaningInput[]): { ids: string[]; vectors: number[][] } {
  const parsed: { id: string; vector: number[] }[] = []
  for (const input of inputs) {
    let value: unknown
    try {
      value = JSON.parse(input.json)
    } catch {
      continue
    }
    if (!Array.isArray(value) || value.length < 2) continue
    if (!value.every(item => typeof item === 'number' && Number.isFinite(item))) continue
    parsed.push({ id: input.id, vector: value as number[] })
  }
  const lengths = new Map<number, number>()
  for (const row of parsed) lengths.set(row.vector.length, (lengths.get(row.vector.length) ?? 0) + 1)
  let width = 0
  let best = 0
  for (const [length, count] of lengths) {
    if (count > best || (count === best && length > width)) {
      width = length
      best = count
    }
  }
  const kept = parsed.filter(row => row.vector.length === width)
  return { ids: kept.map(row => row.id), vectors: kept.map(row => row.vector) }
}

/** Each vector at unit length: the cosine the neighbours take, and one scale for UMAP's euclidean metric. */
function unit(vec: readonly number[]): number[] {
  let sum = 0
  for (const value of vec) sum += value * value
  const norm = Math.sqrt(sum)
  return norm > 0 ? vec.map(value => value / norm) : vec.map(() => 0)
}

/** The cosine of two rows already at unit length: a plain dot product. */
function cosine(a: readonly number[], b: readonly number[]): number {
  let sum = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) sum += (a[i] ?? 0) * (b[i] ?? 0)
  return sum > 1 ? 1 : sum < -1 ? -1 : sum
}

/**
 * The one pass over every pair of vectors. Per vector: its top TOP_K neighbours at or
 * above MIN_COSINE, best first, ties by index, as vector indices. The best few are kept
 * in place, never a sort of the whole row: at GALAXY_LIMIT points the full sort is most
 * of the work (review MEDIUM-2).
 *
 * MAPX.2: the same cosine also feeds `pairs`, every two vectors of different `owners`
 * (one entry per vector, by index) at or above LINK_COSINE, at most
 * LINK_PAIRS_PER_OWNERS per pair of owners, best first, ties by the earlier index.
 * Without `owners` there are no pairs.
 */
export function neighbourPass(
  vectors: readonly number[][],
  owners: readonly (string | undefined)[] = [],
): { neighbours: { index: number; score: number }[][]; pairs: { i: number; j: number; score: number }[] } {
  const buckets = new Map<string, { i: number; j: number; score: number }[]>()
  const neighbours = vectors.map((vector, i) => {
    const best: { index: number; score: number }[] = []
    const owner = owners[i]
    for (let j = 0; j < vectors.length; j++) {
      if (j === i) continue
      const score = cosine(vector, vectors[j] ?? [])
      if (j > i && score >= LINK_COSINE) {
        const other = owners[j]
        if (owner !== undefined && other !== undefined && owner !== other) {
          const key = owner < other ? `${owner}\u0000${other}` : `${other}\u0000${owner}`
          const bucket = buckets.get(key) ?? []
          buckets.set(key, bucket)
          if (bucket.length < LINK_PAIRS_PER_OWNERS || score > (bucket[bucket.length - 1]?.score ?? 0)) {
            let at = bucket.length
            while (at > 0 && (bucket[at - 1]?.score ?? 0) < score) at--
            bucket.splice(at, 0, { i, j, score })
            if (bucket.length > LINK_PAIRS_PER_OWNERS) bucket.length = LINK_PAIRS_PER_OWNERS
          }
        }
      }
      if (score < MIN_COSINE) continue
      // A row already full drops anything that does not beat its weakest entry; an equal
      // score keeps the earlier index, the order a full sort gave.
      if (best.length === TOP_K && score <= (best[TOP_K - 1]?.score ?? 0)) continue
      let at = best.length
      while (at > 0 && (best[at - 1]?.score ?? 0) < score) at--
      best.splice(at, 0, { index: j, score })
      if (best.length > TOP_K) best.length = TOP_K
    }
    return best
  })
  return { neighbours, pairs: [...buckets.values()].flat() }
}

/** Each vector's top TOP_K neighbours at or above MIN_COSINE (see neighbourPass). */
export function neighboursOf(vectors: readonly number[][]): { index: number; score: number }[][] {
  return neighbourPass(vectors).neighbours
}

/**
 * One embedding in the galaxy's world box: centred on its centroid and scaled
 * so its furthest point sits at 1. The server multiplies by the extent the
 * 0.6.1 layout's own positions occupy (meaningRadius, ui/map-layout.ts), so
 * Meaning and Topic stars share a scale and the cache is scale-free.
 */
export function place(embedding: readonly (readonly number[])[]): Vec3[] {
  const n = embedding.length
  if (n === 0) return []
  const centre = new Array<number>(COMPONENTS).fill(0)
  for (const point of embedding) for (let c = 0; c < COMPONENTS; c++) centre[c] = (centre[c] ?? 0) + (point[c] ?? 0) / n
  const centred = embedding.map(point => Array.from({ length: COMPONENTS }, (_, c) => (point[c] ?? 0) - (centre[c] ?? 0)))
  let far = 0
  for (const point of centred) far = Math.max(far, Math.hypot(point[0] ?? 0, point[1] ?? 0, point[2] ?? 0))
  const scale = far > 0 && Number.isFinite(far) ? 1 / far : 1
  return centred.map(point => [(point[0] ?? 0) * scale, (point[1] ?? 0) * scale, (point[2] ?? 0) * scale])
}

/** The whole answer for one request: each memory's position and its neighbours, keyed by memory id. */
export function meaningOf(inputs: readonly MeaningInput[]): {
  count: number
  positions: Record<string, Vec3>
  similar: Record<string, MeaningNeighbour[]>
  pairs: MeaningPair[]
} {
  const { ids, vectors } = parseVectors(inputs)
  const ownerOf = new Map(inputs.map(input => [input.id, input.owner]))
  const unitVectors = vectors.map(unit)
  // umap-js refuses fewer points than nNeighbors + 1: the clamp keeps 10 to 15 points working.
  const k = Math.max(2, Math.min(NEIGHBORS, unitVectors.length - 1))
  const umap = new UMAP({ nComponents: COMPONENTS, nNeighbors: k, minDist: 0.1, random: randomOf(SEED) })
  const embedding = umap.fit(unitVectors)
  const placed = place(embedding)
  const { neighbours, pairs: found } = neighbourPass(unitVectors, ids.map(id => ownerOf.get(id)))
  const positions: Record<string, Vec3> = {}
  const similar: Record<string, MeaningNeighbour[]> = {}
  ids.forEach((id, index) => {
    const position = placed[index]
    if (position !== undefined) positions[id] = position
    similar[id] = (neighbours[index] ?? []).flatMap(neighbour => {
      const other = ids[neighbour.index]
      return other === undefined ? [] : [{ id: other, score: neighbour.score }]
    })
  })
  const pairs = found.flatMap(pair => {
    const a = ids[pair.i]
    const b = ids[pair.j]
    return a === undefined || b === undefined ? [] : [{ a, b, score: pair.score }]
  })
  return { count: ids.length, positions, similar, pairs }
}

self.onmessage = (event: MessageEvent) => {
  const request = event.data as MeaningRequest
  try {
    // The clock for this run starts here, not when the server posted it (review L1).
    const started: MeaningStarted = { id: request.id, started: true }
    self.postMessage(started)
    const answer = meaningOf(request.inputs)
    const reply: MeaningReply = { id: request.id, ...answer }
    self.postMessage(reply)
  } catch (err) {
    const reply: MeaningReply = { id: request.id, error: (err as Error).message }
    self.postMessage(reply)
  }
}
