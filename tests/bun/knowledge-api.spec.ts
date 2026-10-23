// KAPI.1: GET /api/knowledge returns mined items with source memory topic and usage.
// Tests against a real server with rows written by the real engine tools
// (mnemopi_remember, mnemopi_knowledge_prompt, mnemopi_knowledge_store).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

type KnowledgeItem = {
  id: string
  kind: string
  text: string
  item?: string
  owner: string
  source_memory_id: string
  topic: string | null
  recalls: number
  lastRecalled: string | null
  usage?: { recalls: number; lastRecalled: string | null }
}

type KnowledgeReply = {
  extraction: string
  facts: KnowledgeItem[]
  preferences: KnowledgeItem[]
  instructions: KnowledgeItem[]
  timelines: KnowledgeItem[]
  relations: KnowledgeItem[]
  kg?: KnowledgeItem[]
}

const get = (url: string, path: string, token: string, auth = true) =>
  fetch(`${url}${path}`, { headers: auth ? { Authorization: `Bearer ${token}` } : {} })

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

    // DB row counts stay identical before and after
    const db = open()
    const beforeCount = (db.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n
    db.close()

    const res = await get(url, '/api/knowledge', started.token)
    expect(res.status).toBe(200)

    const db2 = open()
    const afterCount = (db2.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n
    db2.close()
    expect(afterCount).toBe(beforeCount)
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
    // When unset / empty -> 'unknown'
    delete process.env.MNEMOSYNE_EXTRACTION
    const resUnknown = await get(url, '/api/knowledge', started.token)
    expect(resUnknown.status).toBe(200)
    expect(((await resUnknown.json()) as KnowledgeReply).extraction).toBe('unknown')

    // When set to 'off'
    process.env.MNEMOSYNE_EXTRACTION = 'off'
    const resOff = await get(url, '/api/knowledge', started.token)
    expect(resOff.status).toBe(200)
    expect(((await resOff.json()) as KnowledgeReply).extraction).toBe('off')

    // When set to a model id
    process.env.MNEMOSYNE_EXTRACTION = 'claude-3-5-haiku-20241022'
    const resModel = await get(url, '/api/knowledge', started.token)
    expect(resModel.status).toBe(200)
    expect(((await resModel.json()) as KnowledgeReply).extraction).toBe('claude-3-5-haiku-20241022')
    delete process.env.MNEMOSYNE_EXTRACTION
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
})
