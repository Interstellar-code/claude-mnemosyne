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
  GALAXY_LIMIT,
  MEANING_CACHE,
  MEANING_VERSION,
  MIN_MEANING_VECTORS,
  MeaningRunner,
  meaningKey,
  meaningLevel,
  scaleMeaning,
  meaningRadius,
  readVectorIndex,
  readVectorInputs,
  startServer,
} from '../../ui/server'
import type { ServerOptions, Started } from '../../ui/server'
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

/**
 * A temp store with the real schema and `rows` in it, one model. A row's vector may be
 * raw text, as a corrupt stored row would be; `createdAt` stamps the embedding row.
 */
function makeStore(dir: string, rows: readonly { id: string; vector: number[] | string }[], model = MODEL, createdAt = '2026-01-01T00:00:00Z') {
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
      const json = typeof row.vector === 'string' ? row.vector : JSON.stringify(row.vector)
      db.run('INSERT INTO memory_embeddings (memory_id, embedding_json, model, created_at) VALUES (?, ?, ?, ?)', [row.id, json, model, createdAt])
    })
  } finally {
    db.close()
  }
}

const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

/** The server's own read of a store's vector index, read-only, as the key builder sees it. */
function indexOf(store: string) {
  const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
  try {
    return readVectorIndex(db)
  } finally {
    db.close()
  }
}
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0))
const clusterOf = (id: string) => id.slice(1, id.indexOf('-'))

type Star = { id: string; owner: string; tags: string[]; position?: number[]; similar?: { id: string; score: number }[] }
type Reply = { meaning: boolean; memories: Star[]; projects: unknown[]; total: number; shown: number }

function start(store: string, dir: string, activityLog = '', options: ServerOptions = {}) {
  return startServer({ root: join(dir, 'root'), store, cli: '', activityLog, pluginRoot: ROOT }, options)
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

  test('the first call writes meaning.json 0600 under the dashboard root, keyed by the model, the newest vector and the ids', async () => {
    const cache = join(root, MEANING_CACHE)
    rmSync(cache, { force: true })
    const first = await getJson(started, '/api/galaxy')
    expect(first.body.meaning).toBe(true)
    expect(existsSync(cache)).toBe(true)
    // Owner-only, on unix: the same rule the server's own ui.json follows.
    if (process.platform !== 'win32') expect(statSync(cache).mode & 0o777).toBe(0o600)
    const stored = JSON.parse(readFileSync(cache, 'utf8')) as { key: string; meaning: { meaning: boolean; positions: Record<string, number[]> } }
    // The ids in the order the galaxy reply shows them (newest first), which is the run's order.
    const index = indexOf(store)
    expect(index.ids).toHaveLength(rows.length)
    expect(stored.key).toBe(meaningKey(MODEL, index.ids, index.newest))
    expect(stored.meaning.meaning).toBe(true)
    expect(Object.keys(stored.meaning.positions).sort()).toEqual([...index.ids].sort())
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

  test('a changed set of ids recomputes; a newer vector row does too', async () => {
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
    const index = indexOf(store)
    expect(index.ids).toContain('m9-extra')
    expect(stored.key).toBe(meaningKey(MODEL, index.ids, index.newest))
  }, 60_000)

  test('a re-embedded memory keeps its id but changes the key, so the layout is recomputed (LOW-1)', async () => {
    const cache = join(root, MEANING_CACHE)
    const before = JSON.parse(readFileSync(cache, 'utf8')) as { key: string }
    const beforeIds = indexOf(store).ids
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      // Same memory, same id, same model: a newer embedding row, as a re-embed would write.
      const vector = Array.from({ length: DIMS }, () => 0.02)
      db.run('UPDATE memory_embeddings SET embedding_json = ?, created_at = ? WHERE memory_id = ?', [JSON.stringify(vector), '2026-06-01T00:00:00Z', beforeIds[0]!])
    } finally {
      db.close()
    }
    const after = indexOf(store)
    expect(after.ids).toEqual(beforeIds)
    expect(after.newest).toBe('2026-06-01T00:00:00Z')
    expect(meaningKey(MODEL, after.ids, after.newest)).not.toBe(before.key)
    const reply = await getJson(started, '/api/galaxy')
    expect(reply.body.meaning).toBe(true)
    const stored = JSON.parse(readFileSync(cache, 'utf8')) as { key: string }
    expect(stored.key).toBe(meaningKey(MODEL, after.ids, after.newest))
    expect(stored.key).not.toBe(before.key)
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

describe('SEMX.1.a4, LOW-1 and a5: the pieces directly — the key, the scale, the vector reader', () => {
  test('the key follows the layout version, the model, the newest vector row and the id order', () => {
    expect(meaningKey('a', ['1', '2'])).toBe(meaningKey('a', ['1', '2']))
    expect(meaningKey('a', ['1', '2'])).not.toBe(meaningKey('b', ['1', '2']))
    expect(meaningKey('a', ['1', '2'])).not.toBe(meaningKey('a', ['2', '1']))
    // LOW-1: a re-embedded memory (a newer row) or a changed layout recomputes.
    expect(meaningKey('a', ['1', '2'], '2026-01-01T00:00:00Z')).not.toBe(meaningKey('a', ['1', '2'], '2026-02-01T00:00:00Z'))
    expect(meaningKey('a', ['1', '2'], '', MEANING_VERSION + 1)).not.toBe(meaningKey('a', ['1', '2'], '', MEANING_VERSION))
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

  test('readVectorIndex takes the model most rows name, the newest vector, and the reply’s order and limit', () => {
    const temp = tempDir('semantic-vectors')
    try {
      makeStore(join(temp.dir, 'store'), fixture(2), MODEL, '2026-03-04T00:00:00Z')
      const db = new Database(join(temp.dir, 'store', 'mnemopi.db'))
      try {
        const index = readVectorIndex(db)
        expect(index.model).toBe(MODEL)
        expect(index.ids).toHaveLength(6)
        expect(index.newest).toBe('2026-03-04T00:00:00Z')
        // MEDIUM-2: the same rows, order and limit as the galaxy reply (newest timestamp first).
        expect(readVectorIndex(db, 4).ids).toEqual(index.ids.slice(0, 4))
        const inputs = readVectorInputs(db, index.ids)
        expect(inputs.map(input => input.id)).toEqual(index.ids)
        expect(JSON.parse(inputs[0]?.json ?? 'null')).toHaveLength(DIMS)
      } finally {
        db.close()
      }
      const bare = new Database(join(temp.dir, 'bare.db'))
      try {
        bare.run(SCHEMA[0]!)
        expect(readVectorIndex(bare)).toEqual({ model: '', ids: [], newest: '' })
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


// ---- The FIX round's findings: a dead or hung worker, a herd of cold requests, an unbounded
// store, corrupt rows, and the cache's staleness and eviction (review HIGH-1, MEDIUM-1 to 3,
// LOW-1, LOW-2). Each spec runs the real server or the real runner; only the worker script the
// runner loads is swapped, because a worker that fails to load is what these findings are about.

/** A runner that counts its runs, so a spec can tell one UMAP run from many. */
class CountingRunner extends MeaningRunner {
  runs = 0
  override run(inputs: readonly { id: string; json: string }[]) {
    this.runs++
    return super.run(inputs)
  }
}

/** A worker script that throws as it loads: a partial vendor install, or a broken update. */
function brokenWorkerScript(dir: string): string {
  const file = join(dir, 'broken-worker.ts')
  writeFileSync(file, 'throw new Error("the semantic worker failed to load")\n')
  return file
}

/** A worker script that takes a message and never answers: a hung UMAP run. */
function silentWorkerScript(dir: string): string {
  const file = join(dir, 'silent-worker.ts')
  writeFileSync(file, 'declare var self: Worker\nself.onmessage = () => {}\n')
  return file
}

describe('HIGH-1: a worker that fails never breaks /api/galaxy', () => {
  const temp = tempDir('semantic-dead')
  const store = join(temp.dir, 'store')
  const rows = fixture(5)
  let started: Started
  let runner: CountingRunner

  beforeAll(async () => {
    makeStore(store, rows)
    runner = new CountingRunner({ worker: brokenWorkerScript(temp.dir) })
    started = await start(store, temp.dir, '', { meaningRunner: runner })
  }, 60_000)

  afterAll(() => {
    started?.stop()
    runner?.stop()
    temp.dispose()
  })

  test('two requests in a row both answer promptly with meaning false, and both carry the galaxy', async () => {
    for (const attempt of [1, 2]) {
      const at = Date.now()
      const { status, body } = await getJson(started, '/api/galaxy')
      const elapsed = Date.now() - at
      expect({ attempt, status }).toEqual({ attempt, status: 200 })
      expect({ attempt, meaning: body.meaning }).toEqual({ attempt, meaning: false })
      // The topic map itself is intact: every star of the reply is still there, with no layout.
      expect(body.memories.map(star => star.id)).toEqual(indexOf(store).ids)
      expect(body.shown).toBe(rows.length)
      for (const star of body.memories) {
        expect({ attempt, id: star.id, position: star.position }).toEqual({ attempt, id: star.id, position: undefined })
        expect({ attempt, id: star.id, similar: star.similar }).toEqual({ attempt, id: star.id, similar: undefined })
      }
      // Bun cuts a request at 10 s: a dead worker must never come near it.
      expect({ attempt, quick: elapsed < 5_000 }).toEqual({ attempt, quick: true })
    }
    // Each request started a fresh worker instead of posting to the dead one.
    expect(runner.runs).toBe(2)
  }, 60_000)
})

describe('HIGH-1: a run that hangs is cut by the timeout, and the worker replaced', () => {
  const temp = tempDir('semantic-hang')
  const store = join(temp.dir, 'store')
  const root = join(temp.dir, 'root')
  const runners: MeaningRunner[] = []

  beforeAll(() => {
    makeStore(store, fixture(4))
  }, 60_000)

  afterAll(() => {
    for (const runner of runners) runner.stop()
    temp.dispose()
  })

  test('a run over the timeout rejects instead of hanging, and a fresh worker still answers', async () => {
    const hung = new MeaningRunner({ worker: silentWorkerScript(temp.dir), timeoutMs: 150 })
    runners.push(hung)
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      const at = Date.now()
      const outcome = await meaningLevel(db, root, hung, { waitMs: 5_000 }).then(
        () => null,
        (err: Error) => err,
      )
      const elapsed = Date.now() - at
      // The run timeout rejects the shared run: the caller gets an error well inside its budget.
      expect(outcome instanceof Error).toBe(true)
      expect(outcome instanceof Error ? outcome.message : '').toContain('did not answer')
      expect({ quick: elapsed < 3_000 }).toEqual({ quick: true })
      // A fresh worker answers, with the layout this store deserves.
      const fresh = new MeaningRunner()
      runners.push(fresh)
      const meaning = await meaningLevel(db, root, fresh, { waitMs: 30_000 })
      expect(meaning.meaning).toBe(true)
      expect(Object.keys(meaning.positions).sort()).toEqual([...indexOf(store).ids].sort())
    } finally {
      db.close()
    }
  }, 60_000)

  test('a run that misses the wait budget answers NO_MEANING now, and its work still lands in the cache', async () => {
    const dir = join(temp.dir, 'budget')
    makeStore(dir, fixture(40))
    const db = new Database(join(dir, 'mnemopi.db'), { readonly: true })
    const runner = new CountingRunner()
    runners.push(runner)
    try {
      // 1 ms is below any real UMAP run: the first request cannot have a layout yet.
      const at = Date.now()
      const first = await meaningLevel(db, join(dir, 'root'), runner, { waitMs: 1 })
      const elapsed = Date.now() - at
      expect(first).toEqual({ meaning: false, positions: {}, similar: {} })
      expect({ quick: elapsed < 1_000 }).toEqual({ quick: true })
      // The run it started finishes into the cache: the next request reads it, with no second run.
      const second = await meaningLevel(db, join(dir, 'root'), runner, { waitMs: 30_000 })
      expect(second.meaning).toBe(true)
      expect(Object.keys(second.positions).sort()).toEqual([...indexOf(dir).ids].sort())
      expect(runner.runs).toBe(1)
    } finally {
      db.close()
    }
  }, 60_000)
})

describe('MEDIUM-1: four concurrent cold requests cause one UMAP run', () => {
  const temp = tempDir('semantic-herd')
  const store = join(temp.dir, 'store')
  const rows = fixture(70)
  let started: Started
  let runner: CountingRunner

  beforeAll(async () => {
    makeStore(store, rows)
    runner = new CountingRunner()
    started = await start(store, temp.dir, '', { meaningRunner: runner })
  }, 120_000)

  afterAll(() => {
    started?.stop()
    runner?.stop()
    temp.dispose()
  })

  test('all four answer with the layout, and the runner ran once', async () => {
    // Cold: no cache file, so each of the four misses on its own first look.
    expect(existsSync(join(temp.dir, 'root', MEANING_CACHE))).toBe(false)
    const replies = await Promise.all([1, 2, 3, 4].map(() => getJson(started, '/api/galaxy')))
    for (const reply of replies) {
      expect(reply.status).toBe(200)
      expect(reply.body.meaning).toBe(true)
      expect(reply.body.memories.filter(star => star.position !== undefined)).toHaveLength(rows.length)
    }
    // Four callers, one shared run: the id-keyed single flight, not four stacked UMAP runs.
    expect(runner.runs).toBe(1)
  }, 120_000)
})

describe('MEDIUM-2: the layout covers exactly the stars the reply shows', () => {
  const temp = tempDir('semantic-bound')
  const store = join(temp.dir, 'store')
  const total = GALAXY_LIMIT + 200
  let started: Started
  let runner: CountingRunner

  beforeAll(async () => {
    // More memories than one reply shows, each with a vector. The run is real UMAP over
    // GALAXY_LIMIT of them, and the route waits only `meaningWaitMs` for it.
    makeStore(store, fixture(Math.ceil(total / CLUSTERS)).slice(0, total))
    runner = new CountingRunner()
    started = await start(store, temp.dir, '', { meaningRunner: runner, meaningWaitMs: 300 })
  }, 240_000)

  afterAll(() => {
    started?.stop()
    runner?.stop()
    temp.dispose()
  })

  test('the cold request answers inside Bun’s timeout, and the layout names no star the reply dropped', async () => {
    const at = Date.now()
    const first = await getJson(started, '/api/galaxy')
    const elapsed = Date.now() - at
    expect(first.status).toBe(200)
    expect(first.body.shown).toBe(GALAXY_LIMIT)
    expect(first.body.total).toBe(total)
    // The budget holds: the answer arrives well inside Bun's 10 s cut, whatever the layout does.
    expect({ quick: elapsed < 9_000 }).toEqual({ quick: true })

    // The run finishes into the cache; the next request reads it. Polling here is the client's
    // own retry, one request per try, each bounded by the same budget.
    let laidOut = first.body
    for (let tries = 0; tries < 120 && !laidOut.meaning; tries++) {
      await Bun.sleep(500)
      laidOut = (await getJson(started, '/api/galaxy')).body
    }
    expect(laidOut.meaning).toBe(true)
    const shown = new Set(laidOut.memories.map(star => star.id))
    expect(shown.size).toBe(GALAXY_LIMIT)
    const positioned = laidOut.memories.filter(star => star.position !== undefined)
    expect(positioned.length).toBeGreaterThan(0)
    expect(positioned.length).toBeLessThanOrEqual(GALAXY_LIMIT)
    for (const star of positioned) expect({ id: star.id, shown: shown.has(star.id) }).toEqual({ id: star.id, shown: true })
    // `similar` never names a star that is not in this reply: the ids are the reply's own.
    for (const star of laidOut.memories) {
      for (const similar of star.similar ?? []) expect({ id: star.id, known: shown.has(similar.id) }).toEqual({ id: star.id, known: true })
    }
    // The work itself was bounded: the cached layout holds the reply's stars and no others,
    // never every vector of the store (the store has 200 more than the reply shows).
    const cached = JSON.parse(readFileSync(join(temp.dir, 'root', MEANING_CACHE), 'utf8')) as {
      meaning: { meaning: boolean; positions: Record<string, number[]>; similar: Record<string, { id: string; score: number }[]> }
    }
    const laidIds = Object.keys(cached.meaning.positions)
    expect(laidIds).toHaveLength(GALAXY_LIMIT)
    for (const id of laidIds) expect({ id, shown: shown.has(id) }).toEqual({ id, shown: true })
    for (const neighbours of Object.values(cached.meaning.similar)) {
      for (const neighbour of neighbours) expect({ id: neighbour.id, shown: shown.has(neighbour.id) }).toEqual({ id: neighbour.id, shown: true })
    }
    // One layout for the whole store, not one per request: the cache carried it.
    expect(runner.runs).toBe(1)
  }, 240_000)
})

describe('MEDIUM-3: the floor counts usable vectors, not rows', () => {
  const temp = tempDir('semantic-corrupt')
  const store = join(temp.dir, 'store')
  const root = join(temp.dir, 'root')
  // Twelve rows, three of them real vectors: the review's P3, exactly.
  const rows = [
    ...fixture(1).map(row => ({ id: row.id, vector: row.vector })),
    { id: 'bad-1', vector: 'not json' },
    { id: 'bad-2', vector: '[1,"x"]' },
    { id: 'bad-3', vector: '{}' },
    { id: 'bad-4', vector: '[]' },
    { id: 'bad-5', vector: '[1]' },
    { id: 'bad-6', vector: 'null' },
    { id: 'bad-7', vector: '[1,2,"3"]' },
    { id: 'bad-8', vector: '{"x":1}' },
    // A well-formed vector of another width: the width most rows share wins, so it is dropped.
    { id: 'bad-9', vector: '[1,2]' },
  ]
  let started: Started

  beforeAll(async () => {
    makeStore(store, rows)
    started = await start(store, temp.dir)
  }, 60_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  test('twelve rows of which three parse: meaning false, no positions, and no cache file', async () => {
    expect(rows).toHaveLength(12)
    const { status, body } = await getJson(started, '/api/galaxy')
    expect(status).toBe(200)
    expect(body.meaning).toBe(false)
    expect(body.memories).toHaveLength(rows.length)
    for (const star of body.memories) {
      expect({ id: star.id, position: star.position }).toEqual({ id: star.id, position: undefined })
      expect({ id: star.id, similar: star.similar }).toEqual({ id: star.id, similar: undefined })
    }
    // A result under the floor is never cached: no stale layout outlives the bad rows.
    expect(existsSync(join(root, MEANING_CACHE))).toBe(false)
  }, 60_000)
})

describe('LOW-2: the layout file goes when the store falls below the floor', () => {
  const temp = tempDir('semantic-evict')
  const store = join(temp.dir, 'store')
  const cache = join(temp.dir, 'root', MEANING_CACHE)
  let started: Started

  beforeAll(async () => {
    makeStore(store, fixture(4))
    started = await start(store, temp.dir)
  }, 60_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  test('a layout for twelve vectors is removed once the store drops under the floor', async () => {
    expect((await getJson(started, '/api/galaxy')).body.meaning).toBe(true)
    expect(existsSync(cache)).toBe(true)
    // Forget three memories, vector and all: nine vectors left, one short of the floor.
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      for (const id of ['m2-01', 'm2-02', 'm2-03']) {
        db.run('DELETE FROM memory_embeddings WHERE memory_id = ?', [id])
        db.run('DELETE FROM working_memory WHERE id = ?', [id])
      }
      expect((db.query('SELECT COUNT(*) AS n FROM memory_embeddings').get() as { n: number }).n).toBe(MIN_MEANING_VECTORS - 1)
    } finally {
      db.close()
    }
    const { body } = await getJson(started, '/api/galaxy')
    expect(body.meaning).toBe(false)
    // The file named ids and scores of memories that are gone: it goes with them.
    expect(existsSync(cache)).toBe(false)
  }, 60_000)
})
