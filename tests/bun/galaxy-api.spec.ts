// GDATA.1: GET /api/galaxy returns every memory and its knowledge in one lean reply.
// The real server on 127.0.0.1 against a temporary store made by the real engine;
// the memoria rows are inserted straight into that temporary database (the server
// reads it read-only), as tests/bun/map-api.spec.ts does for recall counts.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { initBeam } from '../../engine/src/core/beam/schema'
import { GALAXY_LIMIT, NO_MEANING, galaxyLabel, galaxyLevel, getMemory, memoryState, startServer } from '../../ui/server'
import type { Meaning, Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

type Memory = { id: string; owner: string; tags: string[]; recalls: number; lastRecalled: string | null; created: string | null; label: string }
type Knowledge = { id: string; kind: string; text: string; memory: string }
type Reply = {
  projects: { owner: string; label: string; count: number; recalls: number }[]
  memories: Memory[]
  knowledge: Knowledge[]
  meaning: boolean
  total: number
  shown: number
}

async function remember(store: string, owner: string, content: string, metadata?: Record<string, unknown>) {
  const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...(metadata ? { metadata } : {}) })])).get(1))
  if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  return reply.memory_id as string
}

const get = (url: string, path: string, token: string, auth = true) =>
  fetch(`${url}${path}`, { headers: auth ? { Authorization: `Bearer ${token}` } : {} })

describe('GET /api/galaxy on a real store', () => {
  const temp = tempDir('galaxy-api')
  const store = join(temp.dir, 'store')
  const log = join(temp.dir, 'activity.jsonl')
  const ids = {} as Record<'g1' | 'a1' | 'a2' | 'a3' | 'a4' | 'b1', string>
  let started: Started
  let url = ''

  const open = () => new Database(join(store, 'mnemopi.db'))

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    ids.g1 = await remember(store, 'global', 'global fruit note', { tags: ['fruit'] })
    ids.a1 = await remember(store, 'project-alpha-1a2b', 'alpha fruit and veg', { tags: ['fruit', 'veg'] })
    ids.a2 = await remember(store, 'project-alpha-1a2b', '\n\n  alpha plain note\nsecond line')
    ids.a3 = await remember(store, 'project-alpha-1a2b', `${'x'.repeat(100)} tail`, { tags: ['fruit'] })
    ids.a4 = await remember(store, 'project-alpha-1a2b', 'alpha control\u0007chars\u001fhere')
    ids.b1 = await remember(store, 'project-beta-9z8y', '<img src=x onerror=alert(1)> beta markup', { tags: ['Veg'] })
    const db = open()
    try {
      for (const [id, n] of [[ids.g1, 1], [ids.a1, 5], [ids.a2, 2], [ids.a3, 3]] as [string, number][]) {
        db.run('UPDATE working_memory SET recall_count = ? WHERE id = ?', [n, id])
      }
      // The five memoria tables, as KSTORE.1 will fill them (C6). Two memories, all five kinds.
      db.run("INSERT INTO memoria_facts (session_id, fact_type, key, value, source_memory_id) VALUES ('global', 'fact', NULL, 'the sky is blue', ?)", [ids.g1])
      db.run("INSERT INTO memoria_preferences (session_id, preference, source_memory_id) VALUES ('project-alpha-1a2b', 'prefers tabs', ?)", [ids.a1])
      db.run("INSERT INTO memoria_instructions (session_id, instruction, active, source_memory_id) VALUES ('project-alpha-1a2b', 'always run tests', 1, ?)", [ids.a1])
      db.run("INSERT INTO memoria_timelines (session_id, date, description, source_memory_id) VALUES ('project-alpha-1a2b', NULL, 'shipped 0.6.0', ?)", [ids.a1])
      db.run("INSERT INTO memoria_kg (session_id, subject, predicate, object, confidence, source_memory_id) VALUES ('project-alpha-1a2b', 'Alice', 'uses', 'Rust', 0.7, ?)", [ids.a1])
      // A row for a memory outside the reply's set must not appear.
      db.run("INSERT INTO memoria_facts (session_id, fact_type, key, value, source_memory_id) VALUES ('global', 'fact', NULL, 'orphan fact', 'not-in-the-store')")
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: log, pluginRoot: ROOT })
    url = `http://127.0.0.1:${started.port}`
  }, 120_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  const galaxy = async () => {
    const response = await get(url, '/api/galaxy', started.token)
    expect(response.status).toBe(200)
    return (await response.json()) as Reply
  }

  test('GDATA.1.a1: token-guarded like every data route, and read-only on the database', async () => {
    expect((await get(url, '/api/galaxy', started.token, false)).status).toBe(401)
    const counts = () => {
      const db = open()
      try {
        const tables = ['working_memory', 'memoria_facts', 'memoria_preferences', 'memoria_instructions', 'memoria_timelines', 'memoria_kg']
        return Object.fromEntries(tables.map(table => [table, (db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n]))
      } finally {
        db.close()
      }
    }
    const before = counts()
    await galaxy()
    expect(counts()).toEqual(before)
  })

  test('GDATA.1.a2: the reply shape, with labels and text cut to 80 and control characters removed', async () => {
    const reply = await galaxy()
    // no vectors in this store: `links` is absent (MAPX.2)
    expect(Object.keys(reply).sort()).toEqual(['globalLive', 'knowledge', 'meaning', 'memories', 'projects', 'shown', 'total', 'writers'])
    expect(reply.meaning).toBe(false)
    const alpha = reply.projects.find(project => project.owner === 'project-alpha-1a2b')!
    expect(alpha).toMatchObject({ owner: 'project-alpha-1a2b', label: 'alpha', count: 4, recalls: 10 })
    expect(reply.projects.find(project => project.owner === 'global')?.label).toBe('Global')
    expect(reply.memories).toHaveLength(6)
    expect(reply.total).toBe(6)
    expect(reply.shown).toBe(6)
    const a3 = reply.memories.find(memory => memory.id === ids.a3)!
    expect(Array.from(a3.label).length).toBe(80)
    expect(a3.label.endsWith('…')).toBe(true)
    const a4 = reply.memories.find(memory => memory.id === ids.a4)!
    expect(a4.label).toBe('alpha controlcharshere')
    expect(galaxyLabel('  line one  \nline two')).toBe('line one')
    expect(galaxyLabel('bad\u0000\u001f\u202e text')).toBe('bad text')
    for (const memory of reply.memories) expect(memory.label).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/)
  })

  test('GDATA.1.a3: knowledge comes from the five memoria tables, ids never collide, only reply memories', async () => {
    const reply = await galaxy()
    expect(reply.knowledge.map(row => [row.kind, row.id, row.text, row.memory])).toEqual([
      ['fact', `fact:1`, 'the sky is blue', ids.g1],
      ['preference', 'preference:1', 'prefers tabs', ids.a1],
      ['instruction', 'instruction:1', 'always run tests', ids.a1],
      ['timeline', 'timeline:1', 'shipped 0.6.0', ids.a1],
      ['relation', 'relation:1', 'Alice uses Rust', ids.a1],
    ])
    expect(reply.knowledge.some(row => row.text === 'orphan fact')).toBe(false)
    expect(new Set(reply.knowledge.map(row => row.id)).size).toBe(reply.knowledge.length)
    // A store whose memoria tables were never created: empty knowledge, not an error.
    const bare = tempDir('galaxy-bare')
    try {
      const bareStore = join(bare.dir, 'store')
      mkdirSync(bareStore, { recursive: true })
      await remember(bareStore, 'global', 'a bare store memory')
      const db = new Database(join(bareStore, 'mnemopi.db'))
      try {
        for (const table of ['memoria_facts', 'memoria_preferences', 'memoria_instructions', 'memoria_timelines', 'memoria_kg']) db.run(`DROP TABLE ${table}`)
      } finally {
        db.close()
      }
      const bareServer = await startServer({ root: join(bare.dir, 'root'), store: bareStore, cli: CLI, activityLog: '', pluginRoot: ROOT })
      try {
        const response = await fetch(`http://127.0.0.1:${bareServer.port}/api/galaxy`, { headers: { Authorization: `Bearer ${bareServer.token}` } })
        expect(response.status).toBe(200)
        const body = (await response.json()) as Reply
        expect(body.knowledge).toEqual([])
        expect(body.memories).toHaveLength(1)
      } finally {
        bareServer.stop()
      }
    } finally {
      bare.dispose()
    }
  })

  test('GDATA.1.a4: newest first, at most GALAXY_LIMIT, with total and shown; untagged memories carry tags []', async () => {
    const reply = await galaxy()
    expect(GALAXY_LIMIT).toBe(2000)
    // The reply is newest first: created timestamps do not increase left to right.
    for (let i = 1; i < reply.memories.length; i++) {
      const previous = reply.memories[i - 1]!.created ?? ''
      const current = reply.memories[i]!.created ?? ''
      expect(previous >= current).toBe(true)
    }
    const a2 = reply.memories.find(memory => memory.id === ids.a2)!
    expect(a2.tags).toEqual([])
    expect(reply.memories.find(memory => memory.id === ids.a1)!.tags).toEqual(['fruit', 'veg'])
    // A limit below the count: shown is the page size, total stays the whole store.
    const db = open()
    try {
      const total = (db.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n
      expect(total).toBe(reply.total)
    } finally {
      db.close()
    }
  })

  test('GDATA.1.a5 (OLDMAP.1): GET /api/map is 404 beside /api/galaxy', async () => {
    expect((await get(url, '/api/galaxy', started.token)).status).toBe(200)
    expect((await get(url, '/api/map', started.token)).status).toBe(404)
    expect((await fetch(`${url}/api/map`)).status).toBe(401)
  })

  test('review 2 LOW 1: no database and a store with only working_memory both give empty lists', async () => {
    // galaxyLevel(null): the server's store file is absent.
    const none = galaxyLevel(null)
    expect(none.status).toBe(200)
    expect(none.body).toEqual({ projects: [], memories: [], knowledge: [], writers: [], globalLive: 0, meaning: false, total: 0, shown: 0 })

    // A store that has only working_memory: every memoria table is missing.
    const bare = tempDir('galaxy-only-memory')
    try {
      const bareStore = join(bare.dir, 'store')
      mkdirSync(bareStore, { recursive: true })
      await remember(bareStore, 'global', 'one memory only')
      const db = new Database(join(bareStore, 'mnemopi.db'))
      try {
        for (const table of ['memoria_facts', 'memoria_preferences', 'memoria_instructions', 'memoria_timelines', 'memoria_kg']) db.run(`DROP TABLE IF EXISTS ${table}`)
      } finally {
        db.close()
      }
      const openDb = new Database(join(bareStore, 'mnemopi.db'), { readonly: true })
      try {
        const reply = galaxyLevel(openDb)
        expect(reply.status).toBe(200)
        const body = reply.body as Reply
        expect(body.knowledge).toEqual([])
        expect(body.memories).toHaveLength(1)
      } finally {
        openDb.close()
      }
    } finally {
      bare.dispose()
    }
  })

  test('review 2 LOW 1: a legacy memoria_facts without source_memory_id is skipped, not a 500', async () => {
    const legacy = tempDir('galaxy-legacy')
    try {
      const legacyStore = join(legacy.dir, 'store')
      mkdirSync(legacyStore, { recursive: true })
      await remember(legacyStore, 'global', 'a memory beside a legacy table')
      const db = new Database(join(legacyStore, 'mnemopi.db'))
      try {
        db.run('DROP TABLE IF EXISTS memoria_facts')
        db.run('CREATE TABLE memoria_facts (id INTEGER PRIMARY KEY AUTOINCREMENT, fact_type TEXT, key TEXT, value TEXT)')
        db.run("INSERT INTO memoria_facts (fact_type, key, value) VALUES ('fact', NULL, 'legacy row')")
        db.run("INSERT INTO memoria_preferences (session_id, preference, source_memory_id) VALUES ('global', 'still works', (SELECT id FROM working_memory LIMIT 1))")
      } finally {
        db.close()
      }
      const legacyServer = await startServer({ root: join(legacy.dir, 'root'), store: legacyStore, cli: CLI, activityLog: '', pluginRoot: ROOT })
      try {
        const response = await fetch(`http://127.0.0.1:${legacyServer.port}/api/galaxy`, { headers: { Authorization: `Bearer ${legacyServer.token}` } })
        expect(response.status).toBe(200)
        const body = (await response.json()) as Reply
        // The legacy fact table is skipped; the table that has the column still answers.
        expect(body.knowledge.map(row => row.text)).toEqual(['still works'])
        expect(body.memories).toHaveLength(1)
      } finally {
        legacyServer.stop()
      }
    } finally {
      legacy.dispose()
    }
  })

  test('GDATA.3: the dashboard’s search and forget lines carry client dashboard', async () => {
    const readLog = () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [])
    const before = readLog().length
    const origin = { Origin: url, 'Content-Type': 'application/json', Authorization: `Bearer ${started.token}` }
    const search = await fetch(`${url}/api/search`, { method: 'POST', headers: origin, body: JSON.stringify({ query: 'fruit' }) })
    expect(search.status).toBe(200)
    const forget = await fetch(`${url}/api/forget`, { method: 'POST', headers: origin, body: JSON.stringify({ memory_id: ids.g1 }) })
    expect(forget.status).toBe(200)
    const added = readLog().slice(before)
    expect(added.map(line => [line.action, line.origin, line.client])).toEqual([
      ['recall', 'ui', 'dashboard'],
      ['forget', 'ui', 'dashboard'],
    ])
  })
})

// ---- MAPX.2 (C11, C12): what the solar-system map reads ----

const DAY = 86_400_000
const NOW = new Date('2026-10-25T12:00:00.000Z')
const daysBefore = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString()
const dayKey = (n: number) => daysBefore(n).slice(0, 10)

type Seed = {
  id: string
  owner: string
  ts?: string
  source?: string | null
  kind?: string | null
  scope?: string
  importance?: number
  metadata?: unknown
  recalls?: number
  lastRecalled?: string | null
  validUntil?: string | null
  supersededBy?: string | null
}

/** A temp store with the engine's own schema (initBeam) and these rows; no engine process runs. */
function seedStore(dir: string, rows: readonly Seed[], options: { noValidations?: boolean } = {}): Database {
  mkdirSync(dir, { recursive: true })
  const db = new Database(join(dir, 'mnemopi.db'))
  initBeam(db)
  for (const row of rows) {
    db.run(
      `INSERT INTO working_memory (id, content, session_id, timestamp, source, memory_type, scope, importance, metadata_json, recall_count, last_recalled, valid_until, superseded_by)
       VALUES (?, ?, ?, ?, ?, COALESCE(?, 'unknown'), ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        `text of ${row.id}`,
        row.owner,
        row.ts ?? daysBefore(1),
        row.source === undefined ? 'claude-code' : row.source,
        row.kind ?? null,
        row.scope ?? 'project',
        row.importance ?? 0.5,
        row.metadata === undefined ? null : typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata),
        row.recalls ?? 0,
        row.lastRecalled ?? null,
        row.validUntil ?? null,
        row.supersededBy ?? null,
      ],
    )
  }
  if (options.noValidations) db.run('DROP TABLE memory_validations')
  return db
}

const audit = (db: Database, id: string, action: string, validator = 'dashboard') =>
  db.run('INSERT INTO memory_validations (memory_id, validator, action) VALUES (?, ?, ?)', [id, validator, action])

type Project = {
  owner: string
  label: string
  count: number
  recalls: number
  liveCount: number
  kinds: { kind: string; count: number }[]
  unknown: number
  global: number
  lastActive: string | null
  activity30: number
  activitySource: 'tally' | 'lifetime'
  recallsTotal: number
  medianAgeDays: number | null
  firstSaved: string | null
  tags: { tag: string; count: number }[]
  tagsTotal: number
  projectKind: string
  remoteHost: string | null
}
type Galaxy = {
  projects: Project[]
  memories: (Memory & { source: string; sourceInferred: boolean; kind: string; scope: string; importance: number; pinned: boolean; state: string; validUntil: string | null })[]
  writers: { source: string; count: number; inferred: number }[]
  globalLive: number
  links?: { a: string; b: string; pairs: { older: string; newer: string; score: number }[] }[]
}

/** galaxyLevel over `db` as the server calls it, with a fixed clock. */
function level(db: Database, root?: string, meaning: Meaning = NO_MEANING): Galaxy {
  const reply = galaxyLevel(db, GALAXY_LIMIT, meaning, { now: NOW, ...(root === undefined ? {} : { root }) })
  expect(reply.status).toBe(200)
  return reply.body as Galaxy
}

const projectOf = (reply: Galaxy, owner: string) => reply.projects.find(project => project.owner === owner)!

describe('MAPX.2.a1: each project carries the C11.2 fields, over live rows only', () => {
  const temp = tempDir('mapx2-projects')
  let db: Database
  const A = 'project-alpha-1a2b'
  const B = 'project-beta-9z8y'

  beforeAll(() => {
    const manyTags = Array.from({ length: 45 }, (_, i) => `t${String(i).padStart(2, '0')}`)
    db = seedStore(join(temp.dir, 'store'), [
      // alpha: four live rows, a retired one, an expired one, one that expires in the future
      { id: 'a1', owner: A, ts: daysBefore(10), kind: 'fact', scope: 'global', recalls: 4, lastRecalled: daysBefore(2), metadata: { tags: ['fruit', 'veg', 'fruit'] } },
      { id: 'a2', owner: A, ts: daysBefore(20), kind: 'fact', recalls: 1, metadata: { tags: ['fruit'] } },
      { id: 'a3', owner: A, ts: daysBefore(30), kind: 'preference', recalls: 0, metadata: { tags: manyTags } },
      { id: 'a4', owner: A, ts: daysBefore(40), kind: null, recalls: 0 },
      { id: 'a5', owner: A, ts: daysBefore(50), kind: 'fact', recalls: 9, supersededBy: 'a1', validUntil: daysBefore(5), metadata: { tags: ['retired-only'] } },
      { id: 'a6', owner: A, ts: daysBefore(60), kind: 'fact', recalls: 7, validUntil: daysBefore(3), metadata: { tags: ['expired-only'] } },
      { id: 'a7', owner: A, ts: daysBefore(5), kind: 'instruction', recalls: 2, validUntil: '2099-01-01T00:00:00.000Z' },
      // beta: a single live row; a corrupt metadata row
      { id: 'b1', owner: B, ts: daysBefore(3), kind: 'fact', metadata: '{not json' },
      // the global owner
      { id: 'g1', owner: 'global', ts: daysBefore(7), kind: 'fact', scope: 'project' },
    ])
  })
  afterAll(() => {
    db.close()
    temp.dispose()
  })

  test('liveCount, kinds, unknown, global, recallsTotal: live rows only; count and recalls keep counting all rows', () => {
    const alpha = projectOf(level(db), A)
    expect(alpha.count).toBe(7)
    expect(alpha.recalls).toBe(23)
    expect(alpha.liveCount).toBe(5)
    expect(alpha.kinds).toEqual([
      { kind: 'fact', count: 2 },
      { kind: 'instruction', count: 1 },
      { kind: 'preference', count: 1 },
      { kind: 'unknown', count: 1 },
    ])
    expect(alpha.unknown).toBe(1)
    expect(alpha.global).toBe(1)
    expect(alpha.recallsTotal).toBe(7)
  })

  test('lastActive is the newest of timestamp and last_recalled; firstSaved the oldest timestamp; medianAgeDays the median of live ages', () => {
    const alpha = projectOf(level(db), A)
    // a7 saved 5 days ago, a1 recalled 2 days ago: the recall is the newest
    expect(alpha.lastActive).toBe(daysBefore(2))
    expect(alpha.firstSaved).toBe(daysBefore(40))
    // live ages 10, 20, 30, 40, 5
    expect(alpha.medianAgeDays).toBe(20)
    const beta = projectOf(level(db), B)
    expect(beta.lastActive).toBe(daysBefore(3))
    expect(beta.firstSaved).toBe(daysBefore(3))
    expect(beta.medianAgeDays).toBe(3)
  })

  test('tags: counted once per memory, over live rows, at most 40 by count then name, with tagsTotal', () => {
    const alpha = projectOf(level(db), A)
    expect(alpha.tags).toHaveLength(40)
    // 'fruit' is on two live memories; every other tag on one, so they follow by name and the cut
    // falls on the last names: 'veg' sorts after t00..t44 and is the first to go
    expect(alpha.tags[0]).toEqual({ tag: 'fruit', count: 2 })
    expect(alpha.tags[1]).toEqual({ tag: 't00', count: 1 })
    expect(alpha.tags[39]).toEqual({ tag: 't38', count: 1 })
    expect(alpha.tags.some(entry => entry.tag === 'veg')).toBe(false)
    // a retired or expired row's tag is not counted
    expect(alpha.tags.some(entry => entry.tag === 'retired-only' || entry.tag === 'expired-only')).toBe(false)
    expect(alpha.tagsTotal).toBe(47)
    // broken metadata JSON: no tags, no failure
    expect(projectOf(level(db), B).tags).toEqual([])
    expect(projectOf(level(db), B).tagsTotal).toBe(0)
  })

  test('the owner global stays in projects, marked by its owner id only; globalLive counts scope global or owner global', () => {
    const reply = level(db)
    const global = projectOf(reply, 'global')
    expect(global.label).toBe('Global')
    expect(global.liveCount).toBe(1)
    expect(Object.keys(global).sort()).toEqual(Object.keys(projectOf(reply, A)).sort())
    // a1 (scope global) + g1 (owner global)
    expect(reply.globalLive).toBe(2)
  })

  test('a project whose rows are all retired has zero live numbers and null dates', () => {
    const gone = tempDir('mapx2-allgone')
    const only = seedStore(join(gone.dir, 'store'), [{ id: 'x1', owner: A, supersededBy: 'x2' }, { id: 'x2', owner: B }])
    try {
      const reply = level(only)
      expect(projectOf(reply, A)).toMatchObject({ count: 1, liveCount: 0, kinds: [], unknown: 0, global: 0, recallsTotal: 0, lastActive: null, firstSaved: null, medianAgeDays: null, tags: [], tagsTotal: 0 })
    } finally {
      only.close()
      gone.dispose()
    }
  })

  test('the numbers are over every live row, not the capped list', () => {
    const big = tempDir('mapx2-cap')
    const rows: Seed[] = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, owner: A, kind: 'fact', metadata: { tags: ['all'] } }))
    const capped = seedStore(join(big.dir, 'store'), rows)
    try {
      const reply = galaxyLevel(capped, 5, NO_MEANING, { now: NOW }).body as Galaxy
      expect(reply.memories).toHaveLength(5)
      expect(projectOf(reply, A)).toMatchObject({ count: 12, liveCount: 12, tags: [{ tag: 'all', count: 12 }] })
    } finally {
      capped.close()
      big.dispose()
    }
  })
})

describe('MAPX.2.a1 (C12): projectKind and remoteHost come from <root>/projects.json', () => {
  const temp = tempDir('mapx2-registry')
  let db: Database
  const A = 'project-alpha-1a2b'
  const B = 'project-beta-9z8y'
  const C = 'project-gamma-5c5c'
  const root = join(temp.dir, 'root')
  const file = join(root, 'projects.json')

  beforeAll(() => {
    db = seedStore(join(temp.dir, 'store'), [{ id: 'a1', owner: A }, { id: 'b1', owner: B }, { id: 'c1', owner: C }])
    mkdirSync(root, { recursive: true })
  })
  afterAll(() => {
    db.close()
    temp.dispose()
  })

  const kinds = (reply: Galaxy) => reply.projects.map(project => [project.owner, project.projectKind, project.remoteHost]).sort()

  test('a recorded repo, a folder and an unrecorded project', () => {
    writeFileSync(
      file,
      JSON.stringify({ version: 1, projects: { [A]: { name: 'alpha', kind: 'repo', remoteHost: 'github.com', firstSeen: '2026-10-01', lastSeen: '2026-10-24' }, [B]: { name: 'beta', kind: 'folder', remoteHost: null } } }),
    )
    expect(kinds(level(db, root))).toEqual([
      [A, 'repo', 'github.com'],
      [B, 'folder', null],
      [C, 'unknown', null],
    ])
  })

  test('a bad kind is unknown and a remote that is not a bare host is dropped', () => {
    writeFileSync(file, JSON.stringify({ version: 1, projects: { [A]: { kind: 'planet', remoteHost: 'github.com' }, [B]: { kind: 'repo', remoteHost: 'https://user:token@github.com/o/r.git' }, [C]: { kind: 'repo', remoteHost: 'local' } } }))
    expect(kinds(level(db, root))).toEqual([
      [A, 'unknown', 'github.com'],
      [B, 'repo', null],
      [C, 'repo', 'local'],
    ])
  })

  test('a missing, empty or corrupt file gives unknown and null for every project', () => {
    const unknownAll = [[A, 'unknown', null], [B, 'unknown', null], [C, 'unknown', null]]
    expect(kinds(level(db, join(temp.dir, 'no-such-root')))).toEqual(unknownAll)
    expect(kinds(level(db))).toEqual(unknownAll)
    writeFileSync(file, '')
    expect(kinds(level(db, root))).toEqual(unknownAll)
    writeFileSync(file, '{not json')
    expect(kinds(level(db, root))).toEqual(unknownAll)
    writeFileSync(file, '[]')
    expect(kinds(level(db, root))).toEqual(unknownAll)
    writeFileSync(file, JSON.stringify({ version: 1, projects: 'nope' }))
    expect(kinds(level(db, root))).toEqual(unknownAll)
  })
})

describe('MAPX.2.a4: activity30 and activitySource, one choice for the whole reply', () => {
  const temp = tempDir('mapx2-tally')
  let db: Database
  const A = 'project-alpha-1a2b'
  const B = 'project-beta-9z8y'
  const root = join(temp.dir, 'root')
  const file = join(root, 'activity-daily.json')

  beforeAll(() => {
    db = seedStore(join(temp.dir, 'store'), [
      { id: 'a1', owner: A, recalls: 5 },
      { id: 'a2', owner: A, recalls: 1 },
      { id: 'b1', owner: B, recalls: 0 },
    ])
    mkdirSync(root, { recursive: true })
  })
  afterAll(() => {
    db.close()
    temp.dispose()
  })

  const tally = (days: Record<string, Record<string, { writes: number; recalls: number }>>) => writeFileSync(file, JSON.stringify({ version: 1, days }))
  const read = (reply: Galaxy) => reply.projects.map(project => [project.owner, project.activitySource, project.activity30]).sort()

  test('30 or more days of history: tally for every project, summing the last 30 days only', () => {
    tally({
      [A]: { [dayKey(45)]: { writes: 50, recalls: 50 }, [dayKey(30)]: { writes: 7, recalls: 7 }, [dayKey(29)]: { writes: 2, recalls: 1 }, [dayKey(0)]: { writes: 1, recalls: 4 } },
      [B]: { [dayKey(3)]: { writes: 0, recalls: 2 } },
    })
    // the 30-day-old day and older are out of the sum; day 29 and today are in
    expect(read(level(db, root))).toEqual([
      [A, 'tally', 8],
      [B, 'tally', 2],
    ])
  })

  test('the oldest day decides for every project, whoever it belongs to', () => {
    tally({ [A]: { [dayKey(31)]: { writes: 1, recalls: 1 } }, [B]: { [dayKey(0)]: { writes: 3, recalls: 0 } } })
    // B has no old day of its own and still reads from the tally; A has nothing inside the window
    expect(read(level(db, root))).toEqual([
      [A, 'tally', 0],
      [B, 'tally', 3],
    ])
  })

  test('fewer than 30 days of history: lifetime for every project, liveCount + recallsTotal', () => {
    tally({ [A]: { [dayKey(29)]: { writes: 9, recalls: 9 } }, [B]: { [dayKey(0)]: { writes: 9, recalls: 9 } } })
    expect(read(level(db, root))).toEqual([
      [A, 'lifetime', 8],
      [B, 'lifetime', 1],
    ])
  })

  test('no file, an empty file and a corrupt file: lifetime', () => {
    const lifetime = [[A, 'lifetime', 8], [B, 'lifetime', 1]]
    expect(read(level(db, join(temp.dir, 'no-such-root')))).toEqual(lifetime)
    expect(read(level(db))).toEqual(lifetime)
    writeFileSync(file, '')
    expect(read(level(db, root))).toEqual(lifetime)
    writeFileSync(file, '{broken')
    expect(read(level(db, root))).toEqual(lifetime)
    writeFileSync(file, JSON.stringify({ version: 1, days: { [A]: { 'not-a-day': { writes: 1, recalls: 1 }, [dayKey(40)]: 'nope' } } }))
    expect(read(level(db, root))).toEqual(lifetime)
  })
})

describe('MAPX.2.a2: each memory carries source, kind, scope, importance, pinned, state and validUntil', () => {
  const temp = tempDir('mapx2-memories')
  let db: Database
  const A = 'project-alpha-1a2b'

  beforeAll(() => {
    db = seedStore(join(temp.dir, 'store'), [
      { id: 'live', owner: A, source: 'claude-code', kind: 'fact', scope: 'project', importance: 0.9 },
      { id: 'inferred', owner: A, source: 'mcp:codex', metadata: { source_backfill: 'inferred', tags: ['x'] } },
      { id: 'author', owner: A, source: 'dashboard', metadata: { source_backfill: 'author' } },
      { id: 'nosrc', owner: A, source: null },
      { id: 'pinned', owner: A, metadata: { pinned: true } },
      { id: 'pinned-text', owner: A, metadata: { pinned: 'yes' } },
      { id: 'retired', owner: A, validUntil: daysBefore(2), supersededBy: 'live' },
      { id: 'retired-audit', owner: A, validUntil: daysBefore(2) },
      { id: 'expired', owner: A, validUntil: daysBefore(2) },
      { id: 'lapsed', owner: A, validUntil: daysBefore(2) },
      { id: 'retire-update', owner: A, validUntil: daysBefore(2) },
      { id: 'restored', owner: A },
      { id: 'future', owner: A, validUntil: '2099-01-01T00:00:00.000Z' },
      { id: 'broken', owner: A, metadata: '{nope' },
    ])
    audit(db, 'retired-audit', 'retire')
    audit(db, 'expired', 'expire', 'cleaner')
    // a retire, then an update: the update is skipped, the state stays retired
    audit(db, 'retire-update', 'retire')
    audit(db, 'retire-update', 'update')
    // a retire and a restore: the columns say live, the audit rows are not read
    audit(db, 'restored', 'retire')
    audit(db, 'restored', 'restore')
  })
  afterAll(() => {
    db.close()
    temp.dispose()
  })

  const byId = () => Object.fromEntries(level(db).memories.map(memory => [memory.id, memory]))

  test('source, sourceInferred, kind, scope, importance, validUntil', () => {
    const m = byId()
    expect(m.live).toMatchObject({ source: 'claude-code', kind: 'fact', scope: 'project', importance: 0.9, validUntil: null, sourceInferred: false, pinned: false })
    expect(m.inferred).toMatchObject({ source: 'mcp:codex', sourceInferred: true, kind: 'unknown', tags: ['x'] })
    // 'author' and a missing flag are not inferred
    expect(m.author!.sourceInferred).toBe(false)
    expect(m.live!.sourceInferred).toBe(false)
    expect(m.nosrc!.source).toBe('unknown')
    expect(m.retired!.validUntil).toBe(daysBefore(2))
    expect(m.future!.validUntil).toBe('2099-01-01T00:00:00.000Z')
  })

  test('pinned is metadata.pinned === true; a missing flag and a broken row are false', () => {
    const m = byId()
    expect(m.pinned!.pinned).toBe(true)
    expect(m['pinned-text']!.pinned).toBe(false)
    expect(m.live!.pinned).toBe(false)
    expect(m.broken!.pinned).toBe(false)
  })

  test('state: live, retired, expired, lapsed, restored, a retire then an update, a future expiry', () => {
    const m = byId()
    expect(m.live!.state).toBe('live')
    expect(m.future!.state).toBe('live')
    expect(m.retired!.state).toBe('retired') // names a replacement, no audit rows
    expect(m['retired-audit']!.state).toBe('retired') // audit retire, no replacement
    expect(m.expired!.state).toBe('expired')
    expect(m.lapsed!.state).toBe('lapsed') // its expiry passed, nothing else on record
    expect(m['retire-update']!.state).toBe('retired')
    expect(m.restored!.state).toBe('live')
  })

  test('a retire with no validator and no replacement reads lapsed (a known limit)', () => {
    // the engine writes the audit row only when a validator was passed: columns alone say lapsed
    expect(memoryState({ valid_until: daysBefore(1), superseded_by: null }, [], NOW.toISOString())).toBe('lapsed')
    expect(memoryState({ valid_until: daysBefore(1), superseded_by: 'r' }, [], NOW.toISOString())).toBe('retired')
    expect(memoryState({ valid_until: null, superseded_by: null }, [{ action: 'retire' }], NOW.toISOString())).toBe('live')
    // the newest retire or expire row wins; update, attest and restore rows are skipped
    expect(memoryState({ valid_until: daysBefore(1), superseded_by: null }, [{ action: 'update' }, { action: 'expire' }, { action: 'retire' }], NOW.toISOString())).toBe('expired')
    expect(memoryState({ valid_until: daysBefore(1), superseded_by: null }, [{ action: 'attest' }, { action: 'retire' }], NOW.toISOString())).toBe('retired')
    // exactly now is expired: the engine's recall keeps only valid_until > now
    expect(memoryState({ valid_until: NOW.toISOString(), superseded_by: null }, [], NOW.toISOString())).toBe('lapsed')
  })

  test('a store without memory_validations still answers, from the columns', () => {
    const bare = tempDir('mapx2-novalidations')
    const plain = seedStore(join(bare.dir, 'store'), [{ id: 'r1', owner: A, supersededBy: 'x' }, { id: 'l1', owner: A, validUntil: daysBefore(1) }, { id: 'ok', owner: A }], { noValidations: true })
    try {
      const m = Object.fromEntries(level(plain).memories.map(memory => [memory.id, memory.state]))
      expect(m).toEqual({ r1: 'retired', l1: 'lapsed', ok: 'live' })
    } finally {
      plain.close()
      bare.dispose()
    }
  })

  test('the audit rows of the non-live rows are read in one query, not one per row', () => {
    const queries: string[] = []
    const spy = new Proxy(db, {
      get(target, property) {
        if (property === 'query') return (sql: string) => (queries.push(sql), target.query(sql))
        const value = Reflect.get(target, property, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as Database
    galaxyLevel(spy, GALAXY_LIMIT, NO_MEANING, { now: NOW })
    expect(queries.filter(sql => sql.includes('memory_validations'))).toHaveLength(1)
  })

  test('writers: live rows per source, and how many are inferred', () => {
    const { writers } = level(db)
    const find = (source: string) => writers.find(writer => writer.source === source)
    // retired, expired and lapsed rows are not counted: claude-code has live, pinned, pinned-text, retire... only live ones
    expect(find('mcp:codex')).toEqual({ source: 'mcp:codex', count: 1, inferred: 1 })
    expect(find('dashboard')).toEqual({ source: 'dashboard', count: 1, inferred: 0 })
    expect(find('unknown')).toEqual({ source: 'unknown', count: 1, inferred: 0 })
    // live: live, pinned, pinned-text, restored, future, broken (claude-code)
    expect(find('claude-code')).toEqual({ source: 'claude-code', count: 6, inferred: 0 })
    expect(writers.map(writer => writer.count)).toEqual([...writers.map(writer => writer.count)].sort((a, b) => b - a))
  })
})

describe('MAPX.2.a5: links come from the worker’s pairs, kept when live, limited and oriented', () => {
  const temp = tempDir('mapx2-links')
  let db: Database
  const OLD = 'project-old-0001'
  const NEW = 'project-new-0002'
  const THIRD = 'project-third-0003'

  const meaning = (pairs: { a: string; b: string; score: number }[]): Meaning => ({ meaning: true, positions: {}, similar: {}, pairs })

  beforeAll(() => {
    const rows: Seed[] = []
    // OLD saved first (a year ago), NEW three months ago, THIRD last week
    for (let i = 0; i < 60; i++) rows.push({ id: `o${i}`, owner: OLD, ts: daysBefore(400 - i) })
    for (let i = 0; i < 60; i++) rows.push({ id: `n${i}`, owner: NEW, ts: daysBefore(90 - i) })
    rows.push({ id: 't0', owner: THIRD, ts: daysBefore(7) }, { id: 't1', owner: THIRD, ts: daysBefore(6) })
    rows.push({ id: 'dead', owner: NEW, ts: daysBefore(80), supersededBy: 'n0', validUntil: daysBefore(1) })
    rows.push({ id: 'twin', owner: OLD, ts: daysBefore(300) })
    db = seedStore(join(temp.dir, 'store'), rows)
  })
  afterAll(() => {
    db.close()
    temp.dispose()
  })

  test('links are absent without a meaning layout (no vectors, or fewer than 10)', () => {
    const reply = level(db)
    expect('links' in reply).toBe(false)
    expect(Object.keys(reply)).not.toContain('links')
  })

  test('a meaning layout with no pairs gives an empty list, not an absent one', () => {
    expect(level(db, undefined, meaning([])).links).toEqual([])
  })

  test('a pair of projects needs at least 2 pairs; the older memory comes first; best score first; `a` is the project saved first', () => {
    // given the NEW memory first, so the server has to turn it round
    const reply = level(
      db,
      undefined,
      meaning([
        { a: 'n3', b: 'o3', score: 0.91 },
        { a: 'o4', b: 'n4', score: 0.95 },
        { a: 'o5', b: 'n5', score: 0.85 },
        // one pair only between OLD and THIRD: dropped
        { a: 'o6', b: 't0', score: 0.99 },
      ]),
    )
    expect(reply.links).toEqual([
      {
        a: OLD,
        b: NEW,
        pairs: [
          { older: 'o4', newer: 'n4', score: 0.95 },
          { older: 'o3', newer: 'n3', score: 0.91 },
          { older: 'o5', newer: 'n5', score: 0.85 },
        ],
      },
    ])
  })

  test('a project saved first leads even when the pair order puts it second', () => {
    const reply = level(db, undefined, meaning([{ a: 't0', b: 'n1', score: 0.9 }, { a: 't1', b: 'n2', score: 0.85 }]))
    expect(reply.links).toHaveLength(1)
    expect(reply.links![0]!.a).toBe(NEW) // NEW's first memory is older than THIRD's
    expect(reply.links![0]!.b).toBe(THIRD)
    // the older memory of each pair is the one with the older timestamp, whichever project it is in
    expect(reply.links![0]!.pairs).toEqual([
      { older: 'n1', newer: 't0', score: 0.9 },
      { older: 'n2', newer: 't1', score: 0.85 },
    ])
  })

  test('pairs naming a retired memory or an unknown id are dropped; fewer than 2 left drops the link', () => {
    const reply = level(db, undefined, meaning([{ a: 'o1', b: 'dead', score: 0.9 }, { a: 'o2', b: 'n2', score: 0.88 }, { a: 'o3', b: 'ghost', score: 0.9 }]))
    expect(reply.links).toEqual([])
  })

  test('a pair of two memories of one project is never a link', () => {
    const reply = level(db, undefined, meaning([{ a: 'o1', b: 'twin', score: 0.99 }, { a: 'o2', b: 'twin', score: 0.99 }]))
    expect(reply.links).toEqual([])
  })

  test('at most 50 pairs per link, the best 50', () => {
    const pairs = Array.from({ length: 60 }, (_, i) => ({ a: `o${i}`, b: `n${i}`, score: 0.8 + i / 1000 }))
    const reply = level(db, undefined, meaning(pairs))
    const link = reply.links![0]!
    expect(link.pairs).toHaveLength(50)
    expect(link.pairs[0]!.score).toBe(0.859)
    expect(link.pairs[49]!.score).toBe(0.81)
  })
})

describe('MAPX.2.a6: GET /api/memories/<id> gains trust_tier, valid_until, superseded_by, state and history', () => {
  const temp = tempDir('mapx2-getmemory')
  const store = join(temp.dir, 'store')
  const ids = {} as Record<'live' | 'retired' | 'lapsed' | 'restored' | 'edited', string>
  let started: Started
  let url = ''

  const call = async (owner: string, name: string, args: Record<string, unknown>) => body((await engineCall(CLI, store, owner, [toolCall(1, name, args)])).get(1))
  const one = async (id: string) => {
    const response = await get(url, `/api/memories/${id}`, started.token)
    expect(response.status).toBe(200)
    return (await response.json()) as Record<string, any>
  }

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    const owner = 'project-alpha-1a2b'
    for (const key of ['live', 'retired', 'lapsed', 'restored', 'edited'] as const) ids[key] = await remember(store, owner, `memory ${key}`, { tags: [key] })
    // the real engine: a retire with a validator, a retire then an update, a retire then a restore
    await call(owner, 'mnemopi_invalidate', { memory_id: ids.retired, validator: 'dashboard' })
    await call(owner, 'mnemopi_invalidate', { memory_id: ids.edited, validator: 'dashboard' })
    await call(owner, 'mnemopi_update', { memory_id: ids.edited, content: 'memory edited, again', validator: 'dashboard' })
    await call(owner, 'mnemopi_invalidate', { memory_id: ids.restored, validator: 'dashboard' })
    await call(owner, 'mnemopi_update', { memory_id: ids.restored, restore: true, validator: 'dashboard' })
    // a lapsed row: its expiry date passed, no audit row
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      db.run("UPDATE working_memory SET valid_until = '2020-01-01T00:00:00.000Z' WHERE id = ?", [ids.lapsed])
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    url = `http://127.0.0.1:${started.port}`
  }, 120_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  test('the existing fields do not change and the new ones are added', async () => {
    const live = await one(ids.live)
    expect(Object.keys(live).sort()).toEqual(
      ['content', 'created_at', 'history', 'id', 'importance', 'last_recalled', 'memory_type', 'metadata', 'owner', 'recall_count', 'scope', 'source', 'state', 'superseded_by', 'tags', 'timestamp', 'trust_tier', 'valid_until', 'veracity'].sort(),
    )
    expect(live).toMatchObject({ id: ids.live, content: 'memory live', owner: 'project-alpha-1a2b', tags: ['live'], trust_tier: 'STATED', valid_until: null, superseded_by: null, state: 'live', history: [] })
  })

  test('a retire reads retired and the history names the validator, newest first, never any text', async () => {
    const retired = await one(ids.retired)
    expect(retired.state).toBe('retired')
    expect(retired.valid_until).not.toBeNull()
    expect(retired.history).toEqual([{ action: 'retire', validator: 'dashboard', at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) }])
    for (const entry of retired.history) expect(Object.keys(entry).sort()).toEqual(['action', 'at', 'validator'])
  })

  test('a retire followed by an update is still retired, with both rows, newest first', async () => {
    const edited = await one(ids.edited)
    expect(edited.state).toBe('retired')
    expect(edited.history.map((entry: { action: string }) => entry.action)).toEqual(['update', 'retire'])
  })

  test('a restored row is live again whatever its history says', async () => {
    const restored = await one(ids.restored)
    expect(restored.state).toBe('live')
    expect(restored.valid_until).toBeNull()
    expect(restored.history.map((entry: { action: string }) => entry.action)).toEqual(['restore', 'retire'])
  })

  test('a row whose expiry passed with no audit row is lapsed', async () => {
    const lapsed = await one(ids.lapsed)
    expect(lapsed.state).toBe('lapsed')
    expect(lapsed.history).toEqual([])
  })

  test('the newest 3 rows only, and a store without the table answers with an empty history', () => {
    const trail = tempDir('mapx2-trail')
    const plain = seedStore(join(trail.dir, 'store'), [{ id: 'm1', owner: 'project-alpha-1a2b' }])
    try {
      for (const action of ['attest', 'update', 'retire', 'restore']) audit(plain, 'm1', action, `v-${action}`)
      const memory = getMemory(plain, 'm1').body as { history: { action: string }[] }
      // the table keeps 3 (its trigger); the answer is newest first
      expect(memory.history.map(entry => entry.action)).toEqual(['restore', 'retire', 'update'])
      plain.run('DROP TABLE memory_validations')
      expect((getMemory(plain, 'm1').body as { history: unknown[]; state: string }).history).toEqual([])
      expect((getMemory(plain, 'm1').body as { state: string }).state).toBe('live')
      expect(getMemory(plain, 'nope').status).toBe(404)
    } finally {
      plain.close()
      trail.dispose()
    }
  })
})

describe('MAPX.2: the real server passes the dashboard root through to the galaxy', () => {
  const temp = tempDir('mapx2-server')
  let started: Started

  beforeAll(async () => {
    const db = seedStore(join(temp.dir, 'store'), [{ id: 'a1', owner: 'project-alpha-1a2b' }, { id: 'a2', owner: 'project-alpha-1a2b', recalls: 2 }])
    db.close()
    const root = join(temp.dir, 'root')
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'projects.json'), JSON.stringify({ version: 1, projects: { 'project-alpha-1a2b': { name: 'alpha', kind: 'repo', remoteHost: 'github.com' } } }))
    writeFileSync(join(root, 'activity-daily.json'), JSON.stringify({ version: 1, days: { 'project-alpha-1a2b': { [dayKey(40)]: { writes: 1, recalls: 1 }, [dayKey(0)]: { writes: 3, recalls: 4 } } } }))
    started = await startServer({ root, store: join(temp.dir, 'store'), cli: CLI, activityLog: '', pluginRoot: ROOT })
  }, 60_000)
  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  test('projectKind, remoteHost and the tally reach the reply; the store stays read-only', async () => {
    const response = await get(`http://127.0.0.1:${started.port}`, '/api/galaxy', started.token)
    const reply = (await response.json()) as Galaxy
    expect(reply.projects[0]).toMatchObject({ owner: 'project-alpha-1a2b', projectKind: 'repo', remoteHost: 'github.com', activitySource: 'tally', activity30: 7, liveCount: 2, recallsTotal: 2 })
    expect(reply.links).toBeUndefined()
    expect(reply.writers).toEqual([{ source: 'claude-code', count: 2, inferred: 0 }])
  })
})

/** Every key path of `value` with the value types seen there; arrays add `[]` to the path. Values are never compared. */
function shapeOf(value: unknown, path = '', into = new Map<string, Set<string>>()): Map<string, Set<string>> {
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  const seen = into.get(path) ?? new Set<string>()
  seen.add(type)
  into.set(path, seen)
  if (Array.isArray(value)) for (const item of value) shapeOf(item, `${path}[]`, into)
  else if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) shapeOf(item, `${path}.${key}`, into)
  return into
}

/** Fixture paths the reply lacks, fixture types the reply never shows, and reply paths or types the fixture does not know. */
function shapeGaps(fixture: Map<string, Set<string>>, reply: Map<string, Set<string>>, skip: (path: string) => boolean = () => false): string[] {
  const gaps: string[] = []
  for (const [path, types] of fixture) {
    if (skip(path)) continue
    for (const type of types) if (!reply.get(path)?.has(type)) gaps.push(`missing ${path}: ${type}`)
  }
  for (const [path, types] of reply) {
    if (skip(path)) continue
    for (const type of types) if (!fixture.get(path)?.has(type)) gaps.push(`extra ${path}: ${type}`)
  }
  return gaps
}

describe('MAPX.2b: the real reply has the shape of tests/bun/fixtures/galaxy-c11.json', () => {
  const temp = tempDir('mapx2-shape')
  const fixture = shapeOf(JSON.parse(readFileSync(join(import.meta.dir, 'fixtures', 'galaxy-c11.json'), 'utf8')))
  const A = 'project-alpha-1a2b'
  const B = 'project-beta-9z8y'
  let db: Database
  let root: string

  beforeAll(() => {
    root = join(temp.dir, 'root')
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'projects.json'), JSON.stringify({ version: 1, projects: { [A]: { name: 'alpha', kind: 'repo', remoteHost: 'github.com' }, [B]: { name: 'beta', kind: 'folder', remoteHost: null } } }))
    writeFileSync(join(root, 'activity-daily.json'), JSON.stringify({ version: 1, days: { [A]: { [dayKey(40)]: { writes: 1, recalls: 1 }, [dayKey(0)]: { writes: 3, recalls: 4 } }, [B]: { [dayKey(0)]: { writes: 1, recalls: 0 } } } }))
    db = seedStore(join(temp.dir, 'store'), [
      { id: 'a1', owner: A, ts: daysBefore(10), kind: 'instruction', scope: 'global', importance: 0.9, recalls: 4, lastRecalled: daysBefore(2), validUntil: '2099-01-01T00:00:00.000Z', metadata: { tags: ['fruit', 'veg'] } },
      { id: 'a2', owner: A, ts: daysBefore(20), kind: 'fact', recalls: 0 },
      { id: 'a3', owner: A, ts: daysBefore(30), kind: 'fact', source: null },
      { id: 'b1', owner: B, ts: daysBefore(5), kind: 'decision', recalls: 1, lastRecalled: daysBefore(1), metadata: { tags: ['veg'], source: 'imported' } },
      { id: 'b2', owner: B, ts: daysBefore(3), kind: 'fact' },
    ])
  })
  afterAll(() => {
    db.close()
    temp.dispose()
  })

  test('MAPX.2 reply matches the C11 fixture shape: galaxyLevel, every key path and value type, no values compared', () => {
    const meaning: Meaning = {
      meaning: true,
      positions: {},
      similar: {},
      pairs: [
        { a: 'a1', b: 'b1', score: 0.9 },
        { a: 'a2', b: 'b2', score: 0.8 },
      ],
    }
    const reply = galaxyLevel(db, GALAXY_LIMIT, meaning, { now: NOW, root })
    expect(reply.status).toBe(200)
    const body = reply.body as Galaxy
    // the seed really fills the fields the check relies on
    expect(body.links!.length).toBe(1)
    expect(body.links![0]!.pairs.length).toBe(2)
    expect(body.projects.map(project => project.activitySource)).toEqual(['tally', 'tally'])
    // `knowledge` is an empty array in the fixture, so nothing under it is compared
    const gaps = shapeGaps(fixture, shapeOf(JSON.parse(JSON.stringify(body))), path => path.startsWith('.knowledge[]'))
    expect(gaps).toEqual([])
  })

  test('MAPX.2 GET /api/galaxy matches the C11 fixture shape too (no vectors in the store, so no links)', async () => {
    const dir = tempDir('mapx2-shape-server')
    const store = join(dir.dir, 'store')
    seedStore(store, [{ id: 'a1', owner: A, metadata: { tags: ['fruit'] }, recalls: 2, lastRecalled: daysBefore(1) }, { id: 'a2', owner: A, validUntil: '2099-01-01T00:00:00.000Z' }]).close()
    const started = await startServer({ root, store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    try {
      const response = await get(`http://127.0.0.1:${started.port}`, '/api/galaxy', started.token)
      expect(response.status).toBe(200)
      const reply = shapeOf(await response.json())
      // paths absent here by design: links (needs vectors), and values the one project cannot show as both null and set
      const gaps = shapeGaps(fixture, reply, path => path.startsWith('.links') || path.startsWith('.knowledge[]'))
      expect(gaps.filter(gap => gap.startsWith('extra'))).toEqual([])
      expect(gaps.filter(gap => /missing \.(projects\[\]\.(?!remoteHost)|memories\[\]\.(?!validUntil|lastRecalled)|writers|globalLive|total|shown|meaning)/.test(gap))).toEqual([])
    } finally {
      started.stop()
      dir.dispose()
    }
  }, 60_000)
})
