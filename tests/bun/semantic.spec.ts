// SEMX.1: the meaning layout. Once the store has vectors, GET /api/galaxy
// carries a UMAP position per memory with a vector and that memory's closest
// neighbours, and says `meaning: true`. The maths runs in ui/semantic-worker.ts,
// never on the server's loop, and its result is cached in a 0600 file under the
// dashboard's root.
//
// The store here is a temporary mnemosopi.db with the engine's own schema for
// working_memory and memory_embeddings (engine/src/core/beam/schema.ts:21 and
// :275), filled with deterministic 384-number vectors in three clusters: the
// real server and the real UMAP run against it, as production would.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MEANING_CACHE,
  MIN_MEANING_VECTORS,
  MeaningRunner,
  meaningKey,
  meaningLevel,
  scaleMeaning,
  meaningRadius,
  readVectors,
  startServer,
} from '../../ui/server'
import type { Started } from '../../ui/server'
import { MIN_COSINE, TOP_K, neighboursOf, parseVectors } from '../../ui/semantic-worker'
import { ROOT, tempDir } from './helpers'

const MODEL = 'bge-small-en-v1.5'
const DIMS = 384
const CLUSTERS = 3
// A route the worker does not block answers far inside this; a route held by a run on the
// server's own loop cannot answer inside the run at all (its ~1 s of UMAP).
const PING_BOUND_MS = 250

// The engine's CREATE statements, copied: working_memory and memory_embeddings
// (engine/src/core/beam/schema.ts:21-50 and :274-281). A legacy column set is
// not what this phase tests.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS working_memory (
     id TEXT PRIMARY KEY,
     content TEXT NOT NULL,
     embed_text TEXT DEFAULT NULL,
     source TEXT,
     timestamp TEXT,
     session_id TEXT DEFAULT 'default',
     importance REAL DEFAULT 0.5,
     metadata_json TEXT,
     veracity TEXT DEFAULT 'unknown',
     memory_type TEXT DEFAULT 'unknown',
     consolidated_at TEXT,
     recall_count INTEGER DEFAULT 0,
     last_recalled TIMESTAMP DEFAULT NULL,
     valid_until TIMESTAMP DEFAULT NULL,
     superseded_by TEXT DEFAULT NULL,
     scope TEXT DEFAULT 'global',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS memory_embeddings (
     memory_id TEXT PRIMARY KEY,
     embedding_json TEXT NOT NULL,
     model TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
]

/** A mulberry32 stream: the same seed gives the same vectors on every run. */
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
 * `perCluster` vectors around each of three fixed centres, in 384 dimensions:
 * the members of one cluster sit near each other (cosine ~0.999) and any two
 * clusters are near-orthogonal, so the layout and the neighbour cut are both
 * checkable. The id says the cluster: `m<cluster>-<n>`.
 */
function fixture(perCluster: number, seed = 11) {
  const random = randomOf(seed)
  const centres = Array.from({ length: CLUSTERS }, () => Array.from({ length: DIMS }, () => random() - 0.5))
  const rows: { id: string; cluster: number; vector: number[] }[] = []
  for (let cluster = 0; cluster < CLUSTERS; cluster++) {
    for (let i = 0; i < perCluster; i++) {
      const centre = centres[cluster] ?? []
      rows.push({ id: `m${cluster}-${String(i).padStart(2, '0')}`, cluster, vector: centre.map(value => value + (random() - 0.5) * 0.05) })
    }
  }
  return rows
}

/** A temp store with the real schema and `rows` in it, one model. */
function makeStore(dir: string, rows: readonly { id: string; vector: number[] }[], model = MODEL) {
  mkdirSync(dir, { recursive: true })
  const db = new Database(join(dir, 'mnemopi.db'))
  try {
    for (const statement of SCHEMA) db.run(statement)
    rows.forEach((row, index) => {
      db.run('INSERT INTO working_memory (id, content, session_id, timestamp) VALUES (?, ?, ?, ?)', [
        row.id,
        `memory ${row.id}`,
        index % 2 === 0 ? 'global' : 'project-alpha-1a2b',
        `2026-01-${String((index % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      ])
      db.run('INSERT INTO memory_embeddings (memory_id, embedding_json, model) VALUES (?, ?, ?)', [row.id, JSON.stringify(row.vector), model])
    })
  } finally {
    db.close()
  }
}

const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0))
const clusterOf = (id: string) => id.slice(1, id.indexOf('-'))

type Star = { id: string; owner: string; tags: string[]; position?: number[]; similar?: { id: string; score: number }[] }
type Reply = { meaning: boolean; memories: Star[]; projects: unknown[]; total: number; shown: number }

function start(store: string, dir: string, activityLog = '') {
  return startServer({ root: join(dir, 'root'), store, cli: '', activityLog, pluginRoot: ROOT })
}

const getJson = async (started: Started, path: string) => {
  const response = await fetch(`http://127.0.0.1:${started.port}${path}`, { headers: { Authorization: `Bearer ${started.token}` } })
  return { status: response.status, body: (await response.json()) as Reply }
}

describe('SEMX.1.a1 and a5: positions and neighbours, through the real server', () => {
  const temp = tempDir('semantic')
  const store = join(temp.dir, 'store')
  const rows = fixture(12)
  const root = join(temp.dir, 'root')
  let started: Started

  beforeAll(async () => {
    makeStore(store, rows)
    started = await start(store, temp.dir)
  }, 60_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  test('a1: every memory with a vector carries a finite 3-vector position and three similar memories', async () => {
    const { status, body } = await getJson(started, '/api/galaxy')
    expect(status).toBe(200)
    expect(body.meaning).toBe(true)
    expect(body.memories).toHaveLength(rows.length)
    const radius = meaningRadius(body.projects.length)
    for (const star of body.memories) {
      expect({ id: star.id, shape: star.position?.length }).toEqual({ id: star.id, shape: 3 })
      for (const value of star.position ?? []) expect({ id: star.id, finite: Number.isFinite(value) }).toEqual({ id: star.id, finite: true })
      // Scaled to the 0.6.1 layout's own extent: no star lands outside the core sphere.
      expect(distanceToOrigin(star.position ?? [])).toBeLessThanOrEqual(radius + 1e-6)
      // The top three above the cosine floor, best first, and never the memory itself.
      expect(star.similar).toHaveLength(TOP_K)
      const scores = (star.similar ?? []).map(similar => similar.score)
      expect(scores).toEqual([...scores].sort((a, b) => b - a))
      for (const similar of star.similar ?? []) {
        expect({ id: star.id, score: similar.score >= MIN_COSINE }).toEqual({ id: star.id, score: true })
        expect({ id: star.id, self: similar.id === star.id }).toEqual({ id: star.id, self: false })
        expect({ id: star.id, cluster: clusterOf(similar.id) }).toEqual({ id: star.id, cluster: clusterOf(star.id) })
      }
    }
  }, 60_000)

  test('a1: same-cluster stars sit closer together than stars of different clusters', async () => {
    const { body } = await getJson(started, '/api/galaxy')
    expect(body.meaning).toBe(true)
    const stars = body.memories.filter(star => star.position !== undefined)
    let same = 0
    let sameCount = 0
    let other = 0
    let otherCount = 0
    for (let i = 0; i < stars.length; i++) {
      for (let j = i + 1; j < stars.length; j++) {
        const a = stars[i]!
        const b = stars[j]!
        const apart = distance(a.position ?? [], b.position ?? [])
        if (clusterOf(a.id) === clusterOf(b.id)) {
          same += apart
          sameCount++
        } else {
          other += apart
          otherCount++
        }
      }
    }
    expect(sameCount).toBeGreaterThan(0)
    expect(otherCount).toBeGreaterThan(0)
    // Three tight clusters in the input, three tight clusters out: the means are an order apart.
    expect(same / sameCount).toBeLessThan((other / otherCount) / 3)
  }, 60_000)

  test('a1: the layout is seeded — a fresh run over the same vectors gives the same positions', async () => {
    const first = (await getJson(started, '/api/galaxy')).body
    expect(first.meaning).toBe(true)
    const positions = Object.fromEntries(first.memories.map(star => [star.id, star.position]))
    // The cache file is what an ordinary second request reads; remove it so the worker runs again.
    rmSync(join(root, MEANING_CACHE), { force: true })
    const again = (await getJson(started, '/api/galaxy')).body
    expect(again.meaning).toBe(true)
    expect(Object.fromEntries(again.memories.map(star => [star.id, star.position]))).toEqual(positions)
  }, 60_000)
})

/** The distance of a 3-vector from the origin (the galaxy's centre). */
function distanceToOrigin(point: readonly number[]): number {
  return Math.hypot(point[0] ?? 0, point[1] ?? 0, point[2] ?? 0)
}

describe('SEMX.1.a1: the neighbour rule, on the worker’s own functions', () => {
  const unit = (values: number[]) => {
    const norm = Math.hypot(...values)
    return values.map(value => value / norm)
  }

  test('top 3 above 0.65, best first; a vector with none above the floor gets no neighbours', () => {
    // The first vector at cosine 1 with four others and below 0.65 with two more.
    const vectors = [
      unit([1, 0, 0, 0]),
      unit([1, 0.1, 0, 0]),
      unit([1, 0.2, 0, 0]),
      unit([1, 0.3, 0, 0]),
      unit([1, 0.4, 0, 0]),
      unit([0, 1, 0, 0]),
      unit([0, 0, 1, 0]),
    ]
    const found = neighboursOf(vectors)
    expect(found[0]).toHaveLength(TOP_K)
    expect(found[0]?.map(n => n.index)).toEqual([1, 2, 3])
    for (const n of found[0] ?? []) expect(n.score).toBeGreaterThanOrEqual(MIN_COSINE)
    // Orthogonal to everything: the 0.65 floor leaves it empty.
    expect(found[5]).toEqual([])
    // The floor is the rule, not the count: a pair just under it is dropped.
    const edge = neighboursOf([unit([1, 0]), unit([MIN_COSINE - 0.001, Math.sqrt(1 - (MIN_COSINE - 0.001) ** 2)])])
    expect(edge[0]).toEqual([])
  })

  test('a stored row that is not a usable vector is skipped, not fatal', () => {
    const { ids, vectors } = parseVectors([
      { id: 'a', json: '[1,0,0]' },
      { id: 'b', json: 'not json' },
      { id: 'c', json: '{"x":1}' },
      { id: 'd', json: '[1,"two",3]' },
      { id: 'e', json: '[0,1,0]' },
      { id: 'f', json: '[1,0]' },
    ])
    expect(ids).toEqual(['a', 'e'])
    expect(vectors).toEqual([
      [1, 0, 0],
      [0, 1, 0],
    ])
  })
})

describe('SEMX.1.a5: fewer than 10 vectors means no meaning', () => {
  const temp = tempDir('semantic-few')
  let below: Started
  let exactly: Started
  let belowRows: ReturnType<typeof fixture> = []

  beforeAll(async () => {
    belowRows = fixture(3) // 9 vectors: one short of the floor
    expect(belowRows.length).toBe(MIN_MEANING_VECTORS - 1)
    makeStore(join(temp.dir, 'below'), belowRows)
    makeStore(join(temp.dir, 'exactly'), fixture(4).slice(0, MIN_MEANING_VECTORS)) // exactly 10
    below = await start(join(temp.dir, 'below'), join(temp.dir, 'below-root'))
    exactly = await start(join(temp.dir, 'exactly'), join(temp.dir, 'exactly-root'))
  }, 60_000)

  afterAll(() => {
    below?.stop()
    exactly?.stop()
    temp.dispose()
  })

  test('nine vectors: meaning false, no positions, no similar, and no cache file', async () => {
    const { status, body } = await getJson(below, '/api/galaxy')
    expect(status).toBe(200)
    expect(body.meaning).toBe(false)
    expect(body.memories).toHaveLength(belowRows.length)
    for (const star of body.memories) {
      expect({ id: star.id, position: star.position }).toEqual({ id: star.id, position: undefined })
      expect({ id: star.id, similar: star.similar }).toEqual({ id: star.id, similar: undefined })
    }
    expect(existsSync(join(temp.dir, 'below-root', MEANING_CACHE))).toBe(false)
  })

  test('exactly ten vectors: meaning true, with positions', async () => {
    const { body } = await getJson(exactly, '/api/galaxy')
    expect(body.meaning).toBe(true)
    expect(body.memories.filter(star => star.position !== undefined)).toHaveLength(MIN_MEANING_VECTORS)
  }, 60_000)
})

describe('SEMX.1.a2: the server keeps answering while UMAP runs', () => {
  const temp = tempDir('semantic-live')
  const store = join(temp.dir, 'store')
  const log = join(temp.dir, 'activity.jsonl')
  let started: Started

  beforeAll(async () => {
    // Large enough that a run on the server's own loop would show: 600 vectors take about a
    // second of UMAP, so a blocking implementation pushes every ping past PING_BOUND_MS.
    makeStore(store, fixture(200))
    writeFileSync(log, '')
    started = await start(store, temp.dir, log)
  }, 120_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  test('the activity stream opens and /api/health answers quickly, repeatedly, while the run is in flight', async () => {
    const auth = { Authorization: `Bearer ${started.token}` }
    const opened = Date.now()
    const galaxy = fetch(`http://127.0.0.1:${started.port}/api/galaxy`, { headers: auth }).then(async response => {
      const body = (await response.json()) as Reply
      return { ms: Date.now() - opened, body }
    })
    // The activity stream's first line goes out at once (a blank keep-alive line).
    const streamOpened = Date.now()
    const stream = await fetch(`http://127.0.0.1:${started.port}/api/activity/stream`, { headers: auth })
    expect(stream.status).toBe(200)
    const reader = stream.body?.getReader()
    const first = await reader?.read()
    expect(first?.done).toBe(false)
    expect(Date.now() - streamOpened).toBeLessThan(PING_BOUND_MS)
    void reader?.cancel()
    // Health, while the galaxy request is still pending: the worker holds the maths, not the loop.
    const health: number[] = []
    let settled = false
    galaxy.then(() => {
      settled = true
    })
    while (!settled) {
      const at = Date.now()
      const response = await fetch(`http://127.0.0.1:${started.port}/api/health`, { headers: auth })
      const body = (await response.json()) as { ok?: unknown }
      expect({ status: response.status, ok: body.ok }).toEqual({ status: 200, ok: true })
      health.push(Date.now() - at)
    }
    const answer = await galaxy
    expect(answer.body.meaning).toBe(true)
    // The run was real work, and the loop answered several times inside it.
    expect(answer.ms).toBeGreaterThan(400)
    expect(health.length).toBeGreaterThan(2)
    // A run on the server's own loop would have held each of these until it finished.
    for (const ms of health) expect({ ms, under: ms < PING_BOUND_MS }).toEqual({ ms, under: true })
  }, 120_000)
})

describe('SEMX.1.a4: the cache — 0600, a hit on the second call, a recompute when the ids change', () => {
  const temp = tempDir('semantic-cache')
  const store = join(temp.dir, 'store')
  const rows = fixture(8)
  const root = join(temp.dir, 'root')
  let started: Started

  beforeAll(async () => {
    makeStore(store, rows)
    started = await start(store, temp.dir)
  }, 60_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  test('the first call writes meaning.json 0600 under the dashboard root, keyed by the model and the ids', async () => {
    const cache = join(root, MEANING_CACHE)
    rmSync(cache, { force: true })
    const first = await getJson(started, '/api/galaxy')
    expect(first.body.meaning).toBe(true)
    expect(existsSync(cache)).toBe(true)
    // Owner-only, on unix: the same rule the server's own ui.json follows.
    if (process.platform !== 'win32') expect(statSync(cache).mode & 0o777).toBe(0o600)
    const stored = JSON.parse(readFileSync(cache, 'utf8')) as { key: string; meaning: { meaning: boolean; positions: Record<string, number[]> } }
    const ids = [...rows.map(row => row.id)].sort()
    expect(stored.key).toBe(meaningKey(MODEL, ids))
    expect(stored.meaning.meaning).toBe(true)
    expect(Object.keys(stored.meaning.positions).sort()).toEqual(ids)
  }, 60_000)

  test('the second call is a cache read: instant, and the same numbers', async () => {
    const first = await getJson(started, '/api/galaxy')
    const at = Date.now()
    const second = await getJson(started, '/api/galaxy')
    const elapsed = Date.now() - at
    expect(second.body.meaning).toBe(true)
    expect(second.body.memories.map(star => star.position)).toEqual(first.body.memories.map(star => star.position))
    // A worker run over 24 vectors takes hundreds of milliseconds; a warm read does not.
    expect(elapsed).toBeLessThan(250)
  }, 60_000)

  test('a changed set of ids recomputes; a changed model does too', async () => {
    const cache = join(root, MEANING_CACHE)
    const before = digest(cache)
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      // One more vector: a different key, so a new run and a rewritten cache.
      db.run('INSERT INTO working_memory (id, content, session_id, timestamp) VALUES (?, ?, ?, ?)', ['m9-extra', 'late memory', 'global', '2026-02-01T00:00:00Z'])
      const vector = Array.from({ length: DIMS }, () => 0.01)
      db.run('INSERT INTO memory_embeddings (memory_id, embedding_json, model) VALUES (?, ?, ?)', ['m9-extra', JSON.stringify(vector), MODEL])
    } finally {
      db.close()
    }
    const grown = await getJson(started, '/api/galaxy')
    expect(grown.body.meaning).toBe(true)
    expect(grown.body.memories.map(star => star.id)).toContain('m9-extra')
    expect(digest(cache)).not.toBe(before)
    const stored = JSON.parse(readFileSync(cache, 'utf8')) as { key: string }
    const ids = [...rows.map(row => row.id), 'm9-extra'].sort()
    expect(stored.key).toBe(meaningKey(MODEL, ids))
  }, 60_000)

  test('the vectors are read read-only: the store is byte-identical after a run, and so is its data version', async () => {
    const file = join(store, 'mnemopi.db')
    const before = digest(file)
    const versionOf = (): number => {
      const probe = new Database(file)
      try {
        const row = probe.query('PRAGMA data_version').get()
        return typeof row === 'object' && row !== null && 'data_version' in row && typeof row.data_version === 'number' ? row.data_version : -1
      } finally {
        probe.close()
      }
    }
    const version = versionOf()
    rmSync(join(root, MEANING_CACHE), { force: true })
    const reply = await getJson(started, '/api/galaxy')
    expect(reply.body.meaning).toBe(true)
    expect(digest(file)).toBe(before)
    expect(versionOf()).toBe(version)
  }, 60_000)
})

describe('SEMX.1.a4 and a5: the pieces directly — the key, the scale, the vector reader', () => {
  test('the key follows the model and the id order, and nothing else', () => {
    expect(meaningKey('a', ['1', '2'])).toBe(meaningKey('a', ['1', '2']))
    expect(meaningKey('a', ['1', '2'])).not.toBe(meaningKey('b', ['1', '2']))
    expect(meaningKey('a', ['1', '2'])).not.toBe(meaningKey('a', ['2', '1']))
    expect(meaningKey('', [])).toMatch(/^[0-9a-f]{64}$/)
  })

  test('scaleMeaning multiplies the unit positions, leaving similar and the flag alone', () => {
    const unit = { meaning: true, positions: { a: [1, 0, -0.5] as [number, number, number] }, similar: { a: [{ id: 'b', score: 0.9 }] } }
    expect(scaleMeaning(unit, 100)).toEqual({ meaning: true, positions: { a: [100, 0, -50] }, similar: unit.similar })
    const none = { meaning: false, positions: {}, similar: {} }
    expect(scaleMeaning(none, 100)).toBe(none)
  })

  test('the radius is the 0.6.1 core sphere, so Meaning and Topic share a scale', () => {
    expect(meaningRadius(1)).toBe(360)
    expect(meaningRadius(0)).toBe(360)
    expect(meaningRadius(4)).toBeCloseTo(360 * (2 / Math.sqrt(4 * Math.PI)), 6)
  })

  test('readVectors takes the model most rows name, and a store without the table gives nothing', () => {
    const temp = tempDir('semantic-vectors')
    try {
      makeStore(join(temp.dir, 'store'), fixture(2))
      const db = new Database(join(temp.dir, 'store', 'mnemopi.db'))
      try {
        const found = readVectors(db)
        expect(found.model).toBe(MODEL)
        expect(found.inputs).toHaveLength(6)
        expect(found.inputs[0]?.id).toBe('m0-00')
      } finally {
        db.close()
      }
      const bare = new Database(join(temp.dir, 'bare.db'))
      try {
        bare.run(SCHEMA[0]!)
        expect(readVectors(bare)).toEqual({ model: '', inputs: [] })
      } finally {
        bare.close()
      }
    } finally {
      temp.dispose()
    }
  })

  test('meaningLevel on no database is no meaning, without a worker', async () => {
    const runner = new MeaningRunner()
    try {
      expect(await meaningLevel(null, '/nonexistent-root', runner)).toEqual({ meaning: false, positions: {}, similar: {} })
    } finally {
      runner.stop()
    }
  })
})
