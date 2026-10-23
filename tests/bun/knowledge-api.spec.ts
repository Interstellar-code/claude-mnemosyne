// KAPI.1: GET /api/knowledge returns mined items with source memory topic and usage.
// Tests against a real server with rows written by the real engine tools
// (mnemopi_remember, mnemopi_knowledge_prompt, mnemopi_knowledge_store).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GALAXY_LIMIT, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

type KnowledgeItem = {
  id: string
  kind: string
  text: string
  owner: string
  source_memory_id: string
  topic: string | null
  recalls: number
  lastRecalled: string | null
  active?: boolean | null
  confidence?: number | null
}

type Lists = 'facts' | 'preferences' | 'instructions' | 'timelines' | 'relations'

type KnowledgeReply = {
  extraction: string
  facts: KnowledgeItem[]
  preferences: KnowledgeItem[]
  instructions: KnowledgeItem[]
  timelines: KnowledgeItem[]
  relations: KnowledgeItem[]
  kg?: KnowledgeItem[]
  total: Record<Lists, number>
  shown: Record<Lists, number>
}

const get = (url: string, path: string, token: string, auth = true) =>
  fetch(`${url}${path}`, { headers: auth ? { Authorization: `Bearer ${token}` } : {} })

/** The sha256 of the store's database file and its WAL: unchanged bytes prove nothing was written. */
function storeHash(store: string): string {
  const hash = createHash('sha256')
  for (const file of ['mnemopi.db', 'mnemopi.db-wal']) {
    const path = join(store, file)
    hash.update(file).update(existsSync(path) ? readFileSync(path) : Buffer.alloc(0))
  }
  return hash.digest('hex')
}

/** A real server over a hand-built store (a legacy or oversized shape the engine no longer writes). */
async function handStore(name: string, setup: (db: Database) => void) {
  const temp = tempDir(name)
  const store = join(temp.dir, 'store')
  mkdirSync(store, { recursive: true })
  const db = new Database(join(store, 'mnemopi.db'))
  try {
    setup(db)
  } finally {
    db.close()
  }
  const started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
  return {
    knowledge: async () => {
      const res = await get(`http://127.0.0.1:${started.port}`, '/api/knowledge', started.token)
      expect(res.status).toBe(200)
      return (await res.json()) as KnowledgeReply
    },
    stop: () => {
      started.stop()
      temp.dispose()
    },
  }
}

describe('KAPI.1: GET /api/knowledge on a real store', () => {
  const temp = tempDir('knowledge-api')
  const store = join(temp.dir, 'store')
  const ids = {} as Record<'m1' | 'm2' | 'm3', string>
  let started: Started
  let url = ''

  const open = () => new Database(join(store, 'mnemopi.db'))

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })

    // 1. Remember memories via real engine
    const resA = await engineCall(CLI, store, 'project-alpha-1a2b', [
      toolCall(1, 'mnemopi_remember', {
        content: 'Alpha documentation on code standards and conventions.\nAlways run typecheck.\nUser prefers tabs.',
        metadata: { tags: ['standards', 'tooling'] },
      }),
    ])
    ids.m1 = (body(resA.get(1)) as { memory_id: string }).memory_id

    const resB = await engineCall(CLI, store, 'project-beta-9z8y', [
      toolCall(2, 'mnemopi_remember', {
        content: 'Beta project release timeline note.\nMilestone v1 on 2026-11-01.\nAntigravity powers Mnemosyne.',
        metadata: { tags: ['milestone'] },
      }),
    ])
    ids.m2 = (body(resB.get(2)) as { memory_id: string }).memory_id

    // Untagged memory
    const resC = await engineCall(CLI, store, 'project-alpha-1a2b', [
      toolCall(3, 'mnemopi_remember', {
        content: 'Untagged general note with raw control\u0007char\u001finside.',
      }),
    ])
    ids.m3 = (body(resC.get(3)) as { memory_id: string }).memory_id

    // 2. Extract and store knowledge using real engine knowledge tools
    // m1 prompt and store
    const promptCallA = await engineCall(CLI, store, 'project-alpha-1a2b', [
      toolCall(10, 'mnemopi_knowledge_prompt', { memory_id: ids.m1 }),
    ])
    const promptA = body(promptCallA.get(10)) as { prompt: string; sha256: string }

    const replyA = JSON.stringify({
      facts: ['Mnemosyne requires TypeScript and Bun', 'Code standards apply to all lanes'],
      preferences: ['User prefers tabs over spaces'],
      instructions: ['Always run typecheck before commit'],
      timelines: [],
      kg: [],
    })
    await engineCall(CLI, store, 'project-alpha-1a2b', [
      toolCall(11, 'mnemopi_knowledge_store', { memory_id: ids.m1, reply: replyA, sha256: promptA.sha256 }),
    ])

    // m2 prompt and store
    const promptCallB = await engineCall(CLI, store, 'project-beta-9z8y', [
      toolCall(20, 'mnemopi_knowledge_prompt', { memory_id: ids.m2 }),
    ])
    const promptB = body(promptCallB.get(20)) as { prompt: string; sha256: string }

    const replyB = JSON.stringify({
      facts: [],
      preferences: [],
      instructions: [],
      timelines: ['Milestone v1 on 2026-11-01'],
      kg: [{ subject: 'Antigravity', predicate: 'powers', object: 'Mnemosyne' }],
    })
    await engineCall(CLI, store, 'project-beta-9z8y', [
      toolCall(21, 'mnemopi_knowledge_store', { memory_id: ids.m2, reply: replyB, sha256: promptB.sha256 }),
    ])

    // m3 prompt and store (untagged memory with control char)
    const promptCallC = await engineCall(CLI, store, 'project-alpha-1a2b', [
      toolCall(30, 'mnemopi_knowledge_prompt', { memory_id: ids.m3 }),
    ])
    const promptC = body(promptCallC.get(30)) as { prompt: string; sha256: string }

    const replyC = JSON.stringify({
      facts: ['Fact with control\u0007chars\u001fcleaned'],
      preferences: [],
      instructions: [],
      timelines: [],
      kg: [],
    })
    await engineCall(CLI, store, 'project-alpha-1a2b', [
      toolCall(31, 'mnemopi_knowledge_store', { memory_id: ids.m3, reply: replyC, sha256: promptC.sha256 }),
    ])

    // Set usage numbers (recall_count, last_recalled) on working_memory
    const db = open()
    try {
      db.run("UPDATE working_memory SET recall_count = 7, last_recalled = '2026-10-23T11:00:00.000Z' WHERE id = ?", [ids.m1])
      db.run("UPDATE working_memory SET recall_count = 2, last_recalled = '2026-10-22T08:00:00.000Z' WHERE id = ?", [ids.m2])
      db.run("UPDATE working_memory SET recall_count = 0, last_recalled = NULL WHERE id = ?", [ids.m3])
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

  test('KAPI.1.a1: token-guarded and read-only on the database', async () => {
    // 401 without auth header
    const unauth = await get(url, '/api/knowledge', started.token, false)
    expect(unauth.status).toBe(401)

    // The file bytes and SQLite's data_version (seen from one held connection) stay the same.
    const watcher = open()
    try {
      const version = () => (watcher.query('PRAGMA data_version').get() as { data_version: number }).data_version
      const beforeVersion = version()
      const beforeHash = storeHash(store)
      const res = await get(url, '/api/knowledge', started.token)
      expect(res.status).toBe(200)
      await res.json()
      expect(storeHash(store)).toBe(beforeHash)
      expect(version()).toBe(beforeVersion)
    } finally {
      watcher.close()
    }
  })

  test('KAPI.1.a1: every id is <kind>:<rowid> of the real row, and items carry one name per field', async () => {
    const data = (await (await get(url, '/api/knowledge', started.token)).json()) as KnowledgeReply
    const db = open()
    let expected: string[]
    try {
      expected = (
        db
          .query(
            `SELECT 'fact:' || id AS id FROM memoria_facts UNION ALL SELECT 'preference:' || id FROM memoria_preferences
             UNION ALL SELECT 'instruction:' || id FROM memoria_instructions UNION ALL SELECT 'timeline:' || event_id FROM memoria_timelines
             UNION ALL SELECT 'relation:' || id FROM memoria_kg`,
          )
          .all() as { id: string }[]
      ).map(row => row.id)
      // Each item's text is the row its id names.
      for (const fact of data.facts) {
        const row = db.query('SELECT value FROM memoria_facts WHERE id = ?').get(Number(fact.id.split(':')[1])) as { value: string }
        expect(fact.text).toBe(row.value.replace(/[\u0000-\u001f]/g, ''))
      }
    } finally {
      db.close()
    }
    const got = [...data.facts, ...data.preferences, ...data.instructions, ...data.timelines, ...data.relations].map(item => item.id)
    expect(got.sort()).toEqual(expected.sort())
    for (const item of data.facts) {
      expect(Object.keys(item).sort()).toEqual(['id', 'kind', 'lastRecalled', 'owner', 'recalls', 'source_memory_id', 'text', 'topic'])
    }
  })

  test('KAPI.1.a1: returns per-kind rows with mapped fields, id shape, owner, topic and cleaned text', async () => {
    const res = await get(url, '/api/knowledge', started.token)
    expect(res.status).toBe(200)
    const data = (await res.json()) as KnowledgeReply

    // Check facts
    expect(data.facts.length).toBeGreaterThanOrEqual(3)
    const fact1 = data.facts.find(f => f.text.includes('Mnemosyne requires TypeScript'))
    expect(fact1).toBeDefined()
    expect(fact1?.id).toMatch(/^fact:\d+$/)
    expect(fact1?.owner).toBe('project-alpha-1a2b')
    expect(fact1?.source_memory_id).toBe(ids.m1)
    expect(fact1?.topic).toBe('standards') // first tag of m1

    // Fact from untagged memory has topic null or untagged
    const factClean = data.facts.find(f => f.text.includes('Fact with control'))
    expect(factClean).toBeDefined()
    expect(factClean?.topic).toBeNull()
    expect(factClean?.text).not.toContain('\u0007')
    expect(factClean?.text).not.toContain('\u001f')

    // Check preferences
    expect(data.preferences.length).toBe(1)
    const pref = data.preferences[0]!
    expect(pref.id).toMatch(/^preference:\d+$/)
    expect(pref.text).toBe('User prefers tabs over spaces')
    expect(pref.owner).toBe('project-alpha-1a2b')
    expect(pref.source_memory_id).toBe(ids.m1)
    expect(pref.topic).toBe('standards')

    // Check instructions
    expect(data.instructions.length).toBe(1)
    const inst = data.instructions[0]!
    expect(inst.id).toMatch(/^instruction:\d+$/)
    expect(inst.text).toBe('Always run typecheck before commit')
    expect(inst.owner).toBe('project-alpha-1a2b')
    expect(inst.source_memory_id).toBe(ids.m1)

    // Check timelines
    expect(data.timelines.length).toBe(1)
    const time = data.timelines[0]!
    expect(time.id).toMatch(/^timeline:\d+$/)
    expect(time.text).toBe('Milestone v1 on 2026-11-01')
    expect(time.owner).toBe('project-beta-9z8y')
    expect(time.source_memory_id).toBe(ids.m2)
    expect(time.topic).toBe('milestone')

    // Check relations / kg
    const rels = data.relations || data.kg || []
    expect(rels.length).toBe(1)
    const rel = rels[0]!
    expect(rel.id).toMatch(/^relation:\d+$/)
    expect(rel.text).toContain('Antigravity')
    expect(rel.owner).toBe('project-beta-9z8y')
    expect(rel.source_memory_id).toBe(ids.m2)
  })

  test('KAPI.1.a1: an instruction carries active and a relation its confidence, as the real engine stored them', async () => {
    const data = (await (await get(url, '/api/knowledge', started.token)).json()) as KnowledgeReply
    const db = open()
    let stored: { active: number; confidence: number }
    try {
      stored = {
        active: (db.query('SELECT active FROM memoria_instructions').get() as { active: number }).active,
        confidence: (db.query('SELECT confidence FROM memoria_kg').get() as { confidence: number }).confidence,
      }
    } finally {
      db.close()
    }
    // mnemopi_knowledge_store writes instructions active and kg rows at confidence 0.7 (C6).
    expect(stored).toEqual({ active: 1, confidence: 0.7 })
    expect(data.instructions.map(item => item.active)).toEqual([true])
    expect(data.relations.map(item => item.confidence)).toEqual([0.7])
    // Only the kind that has the column carries the field.
    expect(Object.keys(data.instructions[0]!)).not.toContain('confidence')
    expect(Object.keys(data.relations[0]!)).not.toContain('active')
    for (const item of [...data.facts, ...data.preferences, ...data.timelines]) {
      expect(Object.keys(item)).not.toContain('active')
      expect(Object.keys(item)).not.toContain('confidence')
    }
  })

  test('KAPI.1.a2: usage per item reflects source memory recall_count and last_recalled', async () => {
    const res = await get(url, '/api/knowledge', started.token)
    expect(res.status).toBe(200)
    const data = (await res.json()) as KnowledgeReply

    // Item from m1 (recall_count = 7, last_recalled set)
    const itemA = data.facts.find(f => f.source_memory_id === ids.m1)
    expect(itemA).toBeDefined()
    expect(itemA?.recalls).toBe(7)
    expect(itemA?.lastRecalled).toBe('2026-10-23T11:00:00.000Z')

    // Item from m2 (recall_count = 2)
    const itemB = data.timelines.find(t => t.source_memory_id === ids.m2)
    expect(itemB).toBeDefined()
    expect(itemB?.recalls).toBe(2)
    expect(itemB?.lastRecalled).toBe('2026-10-22T08:00:00.000Z')

    // Item from m3 (recall_count = 0, last_recalled = null)
    const itemC = data.facts.find(f => f.source_memory_id === ids.m3)
    expect(itemC).toBeDefined()
    expect(itemC?.recalls).toBe(0)
    expect(itemC?.lastRecalled).toBeNull()
  })

  test('KAPI.1.a3: extraction reflects MNEMOSYNE_EXTRACTION environment setting', async () => {
    const saved = process.env.MNEMOSYNE_EXTRACTION
    const extraction = async () => {
      const res = await get(url, '/api/knowledge', started.token)
      expect(res.status).toBe(200)
      return ((await res.json()) as KnowledgeReply).extraction
    }
    try {
      // Unset -> 'unknown'
      delete process.env.MNEMOSYNE_EXTRACTION
      expect(await extraction()).toBe('unknown')
      process.env.MNEMOSYNE_EXTRACTION = 'off'
      expect(await extraction()).toBe('off')
      process.env.MNEMOSYNE_EXTRACTION = 'claude-3-5-haiku-20241022'
      expect(await extraction()).toBe('claude-3-5-haiku-20241022')
    } finally {
      if (saved === undefined) delete process.env.MNEMOSYNE_EXTRACTION
      else process.env.MNEMOSYNE_EXTRACTION = saved
    }
  })

  test('KAPI.1: Empty store returns empty lists without error', async () => {
    const emptyTemp = tempDir('empty-knowledge-store')
    const emptyStore = join(emptyTemp.dir, 'store')
    mkdirSync(emptyStore, { recursive: true })
    const emptyStarted = await startServer({
      root: join(emptyTemp.dir, 'root'),
      store: emptyStore,
      cli: CLI,
      activityLog: '',
      pluginRoot: ROOT,
    })
    try {
      const res = await get(`http://127.0.0.1:${emptyStarted.port}`, '/api/knowledge', emptyStarted.token)
      expect(res.status).toBe(200)
      const data = (await res.json()) as KnowledgeReply
      expect(data.extraction).toBe('unknown')
      expect(data.facts).toEqual([])
      expect(data.preferences).toEqual([])
      expect(data.instructions).toEqual([])
      expect(data.timelines).toEqual([])
      expect(data.relations).toEqual([])
    } finally {
      emptyStarted.stop()
      emptyTemp.dispose()
    }
  })

  test('KAPI.1: Legacy table without source_memory_id is safely skipped, never 500', async () => {
    const legacyTemp = tempDir('legacy-knowledge-store')
    const legacyStore = join(legacyTemp.dir, 'store')
    mkdirSync(legacyStore, { recursive: true })

    // Create a legacy database where memoria_facts exists but has no source_memory_id column
    const dbPath = join(legacyStore, 'mnemopi.db')
    const ldb = new Database(dbPath)
    try {
      ldb.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT)')
      ldb.run('CREATE TABLE memoria_facts (id INTEGER PRIMARY KEY, value TEXT)') // missing source_memory_id!
    } finally {
      ldb.close()
    }

    const legacyStarted = await startServer({
      root: join(legacyTemp.dir, 'root'),
      store: legacyStore,
      cli: CLI,
      activityLog: '',
      pluginRoot: ROOT,
    })
    try {
      const res = await get(`http://127.0.0.1:${legacyStarted.port}`, '/api/knowledge', legacyStarted.token)
      expect(res.status).toBe(200)
      const data = (await res.json()) as KnowledgeReply
      expect(data.facts).toEqual([])
    } finally {
      legacyStarted.stop()
      legacyTemp.dispose()
    }
  })

  test('KAPI.1: a legacy working_memory without metadata_json and last_recalled still lists its items', async () => {
    const server = await handStore('legacy-wm-knowledge', db => {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER DEFAULT 0)')
      db.run("INSERT INTO working_memory VALUES ('m1', 'project-old-1a2b', 'hello', '2026-10-01', 4)")
      db.run('CREATE TABLE memoria_preferences (id INTEGER PRIMARY KEY, session_id TEXT, preference TEXT, source_memory_id TEXT)')
      db.run("INSERT INTO memoria_preferences (session_id, preference, source_memory_id) VALUES ('project-old-1a2b', 'tabs', 'm1')")
      // A fact table older still: no session_id either.
      db.run('CREATE TABLE memoria_facts (id INTEGER PRIMARY KEY, value TEXT, source_memory_id TEXT)')
      db.run("INSERT INTO memoria_facts (value, source_memory_id) VALUES ('fact one', 'm1')")
    })
    try {
      const data = await server.knowledge()
      expect(data.preferences).toEqual([
        { id: 'preference:1', kind: 'preference', text: 'tabs', owner: 'project-old-1a2b', source_memory_id: 'm1', topic: null, recalls: 4, lastRecalled: null },
      ])
      expect(data.facts.map(fact => [fact.id, fact.text, fact.owner, fact.recalls])).toEqual([['fact:1', 'fact one', '', 4]])
    } finally {
      server.stop()
    }
  })

  test('KAPI.1: legacy instruction and kg tables without active or confidence give null, never 500; a retired instruction reads false', async () => {
    const server = await handStore('legacy-state-knowledge', db => {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER)')
      db.run("INSERT INTO working_memory VALUES ('m1', 'p1', 'x', '2026-10-01', 0)")
      db.run('CREATE TABLE memoria_instructions (id INTEGER PRIMARY KEY, session_id TEXT, instruction TEXT, source_memory_id TEXT)')
      db.run("INSERT INTO memoria_instructions (session_id, instruction, source_memory_id) VALUES ('p1', 'old rule', 'm1')")
      db.run('CREATE TABLE memoria_kg (id INTEGER PRIMARY KEY, session_id TEXT, subject TEXT, predicate TEXT, object TEXT, source_memory_id TEXT)')
      db.run("INSERT INTO memoria_kg (session_id, subject, predicate, object, source_memory_id) VALUES ('p1', 'a', 'b', 'c', 'm1')")
    })
    try {
      const data = await server.knowledge()
      expect(data.instructions.map(item => [item.text, item.active])).toEqual([['old rule', null]])
      expect(data.relations.map(item => [item.text, item.confidence])).toEqual([['a b c', null]])
    } finally {
      server.stop()
    }
    const retired = await handStore('retired-knowledge', db => {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER)')
      db.run('CREATE TABLE memoria_instructions (id INTEGER PRIMARY KEY, session_id TEXT, instruction TEXT, active INTEGER, source_memory_id TEXT)')
      db.run("INSERT INTO memoria_instructions (session_id, instruction, active, source_memory_id) VALUES ('p1', 'retired', 0, 'm1'), ('p1', 'unset', NULL, 'm1')")
    })
    try {
      const data = await retired.knowledge()
      expect(data.instructions.map(item => [item.text, item.active])).toEqual([['unset', null], ['retired', false]])
    } finally {
      retired.stop()
    }
  })

  test('KAPI.1: each kind is capped at GALAXY_LIMIT, newest first, with total and shown', async () => {
    const server = await handStore('big-knowledge', db => {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER, last_recalled TEXT, metadata_json TEXT)')
      db.run("INSERT INTO working_memory VALUES ('m1', 'p1', 'x', '2026-10-01', 0, NULL, NULL)")
      db.run('CREATE TABLE memoria_facts (id INTEGER PRIMARY KEY, session_id TEXT, value TEXT, source_memory_id TEXT)')
      const insert = db.prepare("INSERT INTO memoria_facts (session_id, value, source_memory_id) VALUES ('p1', ?, 'm1')")
      db.transaction(() => {
        for (let i = 1; i <= GALAXY_LIMIT + 5; i++) insert.run(`fact ${i}`)
      })()
    })
    try {
      const data = await server.knowledge()
      expect(data.facts).toHaveLength(GALAXY_LIMIT)
      expect(data.total.facts).toBe(GALAXY_LIMIT + 5)
      expect(data.shown.facts).toBe(GALAXY_LIMIT)
      expect(data.facts[0]!.id).toBe(`fact:${GALAXY_LIMIT + 5}`)
      expect(data.facts.at(-1)!.id).toBe('fact:6')
      expect(data.total.preferences).toBe(0)
    } finally {
      server.stop()
    }
  })

  test('KAPI.1: item text keeps up to 500 characters on one line; a blank first tag is not the topic', async () => {
    const long = `${'a'.repeat(300)}\nsecond line\u200b ${'b'.repeat(300)}`
    const kept = `kept whole ${'k'.repeat(400)}`
    const server = await handStore('text-knowledge', db => {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER, last_recalled TEXT, metadata_json TEXT)')
      db.run(`INSERT INTO working_memory VALUES ('m1', 'p1', 'x', '2026-10-01', 0, NULL, '{"tags":["  ", " veg "]}')`)
      db.run('CREATE TABLE memoria_facts (id INTEGER PRIMARY KEY, session_id TEXT, value TEXT, source_memory_id TEXT)')
      db.run("INSERT INTO memoria_facts (session_id, value, source_memory_id) VALUES ('p1', ?, 'm1')", [long])
      db.run("INSERT INTO memoria_facts (session_id, value, source_memory_id) VALUES ('p1', ?, 'm1')", [kept])
    })
    try {
      const data = await server.knowledge()
      const [second, first] = data.facts
      expect(second!.text).toBe(kept)
      expect(Array.from(first!.text)).toHaveLength(500)
      expect(first!.text).toStartWith(`${'a'.repeat(300)} second line ${'b'}`)
      expect(first!.text).toEndWith('…')
      expect(first!.text).not.toMatch(/[\n\u200b]/)
      expect(first!.topic).toBe('veg')
    } finally {
      server.stop()
    }
  })
})
