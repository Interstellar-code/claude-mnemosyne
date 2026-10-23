// GDATA.1: GET /api/galaxy returns every memory and its knowledge in one lean reply.
// The real server on 127.0.0.1 against a temporary store made by the real engine;
// the memoria rows are inserted straight into that temporary database (the server
// reads it read-only), as tests/bun/map-api.spec.ts does for recall counts.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GALAXY_LIMIT, galaxyLabel, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
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
    expect(Object.keys(reply).sort()).toEqual(['knowledge', 'meaning', 'memories', 'projects', 'shown', 'total'])
    expect(reply.meaning).toBe(false)
    const alpha = reply.projects.find(project => project.owner === 'project-alpha-1a2b')!
    expect(alpha).toEqual({ owner: 'project-alpha-1a2b', label: 'alpha', count: 4, recalls: 10 })
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

  test('GDATA.1.a5: /api/map stays for now, beside the galaxy route', async () => {
    const map = await get(url, '/api/map', started.token)
    expect(map.status).toBe(200)
    const level = (await map.json()) as { level: string; nodes: { id: string }[] }
    expect(level.level).toBe('projects')
    expect(level.nodes.map(node => node.id)).toContain('project-alpha-1a2b')
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
