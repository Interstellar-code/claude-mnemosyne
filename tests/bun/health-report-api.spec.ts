// KAPI.2: GET /api/health-report, with /api/health unchanged.
// Tests against a real server and a real temp store with known fixture data.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MOST_RECALLED_LIST, NEVER_RECALLED_LIST, ping, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

type HealthMemory = {
  id: string
  owner: string
  created: string | null
  lastRecalled: string | null
  label: string
  tags: string[]
  recalls: number
}

type HealthReport = {
  ok: boolean
  total: number
  global: number
  projects: { owner: string; label: string; count: number }[]
  owners: { owner: string; label: string; count: number }[]
  neverRecalled: { count: number; list: HealthMemory[] }
  neverRecalledCount: number
  neverRecalledList: HealthMemory[]
  mostRecalled: (HealthMemory & { recalls: number })[]
  recallsPerDay: { date: string; count: number }[]
  recallsByDay: Record<string, number>
  otherRecallsPerDay: { date: string; count: number }[]
  daysCovered: number
  sizes: { store: number; log: number }
  tables: Record<string, number>
  coverage: {
    total: number
    tagged: number
    knowledge: number
    embeddings: number
    vectors: number
    provenance: number
    author_type: number
  }
}

async function remember(store: string, owner: string, content: string, metadata?: Record<string, unknown>) {
  const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...(metadata ? { metadata } : {}) })])).get(1))
  if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  return reply.memory_id as string
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

/** /api/health-report from a real server over a hand-built store (a legacy or large shape). */
async function reportOf(name: string, setup: (db: Database) => void): Promise<HealthReport> {
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
  try {
    const res = await get(`http://127.0.0.1:${started.port}`, '/api/health-report', started.token)
    expect(res.status).toBe(200)
    return (await res.json()) as HealthReport
  } finally {
    started.stop()
    temp.dispose()
  }
}

/** The QA's log mix, today: 9 Claude Code recalls (hook, tool, trigger), 2 codex-mcp-client recalls, 4 dashboard searches, 1 failed hook recall. The Activity spec (ui-views) feeds the same lines. */
function recallMix(): Record<string, unknown>[] {
  const t = new Date().toISOString()
  const recall = (origin: string, extra: Record<string, unknown> = {}) => ({ t, action: 'recall', origin, owner: 'global', text: 'q', ids: [], count: 0, ok: true, ...extra })
  return [
    ...[1, 2, 3, 4].map(() => recall('hook', { client: 'claude-code' })),
    ...[1, 2, 3].map(() => recall('tool', { client: 'claude-code' })),
    ...[1, 2].map(() => recall('trigger', { client: 'claude-code' })),
    recall('external', { client: 'codex-mcp-client' }),
    recall('external', { client: 'codex-mcp-client' }),
    ...[1, 2, 3, 4].map(() => recall('ui', { client: 'dashboard' })),
    recall('hook', { client: 'claude-code', ok: false }),
  ]
}

describe('KAPI.2: GET /api/health and /api/health-report', () => {
  const temp = tempDir('health-report-api')
  const store = join(temp.dir, 'store')
  const log = join(temp.dir, 'activity.jsonl')
  const ids = {} as Record<'g1' | 'g2' | 'a1' | 'a2' | 'a3' | 'b1', string>
  let started: Started
  let url = ''

  const open = () => new Database(join(store, 'mnemopi.db'))

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })

    // Seed activity.jsonl spanning 3 days with recall and remember events
    const logLines = [
      JSON.stringify({ t: '2026-10-21T10:00:00.000Z', action: 'recall', origin: 'hook', owner: 'global', text: 'q1', ids: ['m1'], count: 1, ok: true }),
      JSON.stringify({ t: '2026-10-21T11:00:00.000Z', action: 'recall', origin: 'hook', owner: 'project-alpha-1a2b', text: 'q2', ids: ['m2'], count: 1, ok: true }),
      JSON.stringify({ t: '2026-10-22T09:00:00.000Z', action: 'remember', origin: 'tool', owner: 'project-alpha-1a2b', text: 'note', ids: ['m3'], count: 1, ok: true }),
      JSON.stringify({ t: '2026-10-22T14:00:00.000Z', action: 'recall', origin: 'hook', owner: 'project-alpha-1a2b', text: 'q3', ids: ['m2'], count: 1, ok: true }),
      JSON.stringify({ t: '2026-10-23T08:30:00.000Z', action: 'recall', origin: 'ui', owner: 'project-beta-9z8y', text: 'q4', ids: ['m4'], count: 1, ok: true }),
    ]
    writeFileSync(log, `${logLines.join('\n')}\n`)

    // Create fixture memories via real engine
    ids.g1 = await remember(store, 'global', 'global note 1', { tags: ['global-tag'] })
    ids.g2 = await remember(store, 'global', 'global note 2 without tags')
    ids.a1 = await remember(store, 'project-alpha-1a2b', 'alpha note 1', { tags: ['alpha', 'core'] })
    ids.a2 = await remember(store, 'project-alpha-1a2b', 'alpha note 2', { tags: ['alpha'] })
    ids.a3 = await remember(store, 'project-alpha-1a2b', 'alpha note 3 untagged')
    ids.b1 = await remember(store, 'project-beta-9z8y', 'beta note 1', { tags: ['beta'] })

    const db = open()
    try {
      // Update recall counts and last_recalled
      // a1: recalled 10 times, most recalled
      db.run("UPDATE working_memory SET recall_count = 10, last_recalled = '2026-10-23T12:00:00.000Z' WHERE id = ?", [ids.a1])
      // g1: recalled 3 times
      db.run("UPDATE working_memory SET recall_count = 3, last_recalled = '2026-10-22T12:00:00.000Z' WHERE id = ?", [ids.g1])
      // b1: recalled 1 time
      db.run("UPDATE working_memory SET recall_count = 1, last_recalled = '2026-10-21T12:00:00.000Z' WHERE id = ?", [ids.b1])
      // a2, a3, g2: never recalled (recall_count = 0 / NULL)
      db.run('UPDATE working_memory SET recall_count = 0 WHERE id IN (?, ?)', [ids.a2, ids.a3])
      db.run('UPDATE working_memory SET recall_count = NULL WHERE id = ?', [ids.g2])

      // author_type provenance: set on a1 and b1
      db.run("UPDATE working_memory SET author_type = 'human' WHERE id = ?", [ids.a1])
      db.run("UPDATE working_memory SET author_type = 'agent' WHERE id = ?", [ids.b1])

      // Embeddings: insert vector for a1
      db.run("CREATE TABLE IF NOT EXISTS memory_embeddings (memory_id TEXT PRIMARY KEY, embedding_json TEXT, model TEXT)")
      db.run("INSERT INTO memory_embeddings (memory_id, embedding_json, model) VALUES (?, '[]', 'test-model')", [ids.a1])

      // Memoria knowledge: link a1 and g1
      db.run("INSERT INTO memoria_facts (session_id, fact_type, key, value, source_memory_id) VALUES ('project-alpha-1a2b', 'fact', NULL, 'alpha fact', ?)", [ids.a1])
      db.run("INSERT INTO memoria_preferences (session_id, preference, source_memory_id) VALUES ('global', 'dark mode', ?)", [ids.g1])
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

  test('KAPI.2.a1: /api/health keeps exact shape and answers launcher ping within timeout', async () => {
    // 1. Check launcher ping helper
    const pingOk = await ping(started.port, process.pid, started.token)
    expect(pingOk).toBe(true)

    // 2. Direct HTTP fetch timing
    const t0 = performance.now()
    const response = await get(url, '/api/health', started.token)
    const elapsed = performance.now() - t0
    expect(response.status).toBe(200)
    expect(elapsed).toBeLessThan(1000)

    const health = (await response.json()) as Record<string, unknown>
    expect(health.ok).toBe(true)
    expect(health.pid).toBe(process.pid)
    expect(health.store).toBe(store)
    expect(health.activity).toBe(true)
    expect(health.total).toBe(6)
    expect(Array.isArray(health.owners)).toBe(true)
  })

  test('KAPI.2.a2: /api/health-report is token-guarded and read-only', async () => {
    // Without token -> 401
    const unauth = await get(url, '/api/health-report', started.token, false)
    expect(unauth.status).toBe(401)

    // With token -> 200, and the file bytes and SQLite's data_version (one held connection) stay the same.
    const watcher = open()
    try {
      const version = () => (watcher.query('PRAGMA data_version').get() as { data_version: number }).data_version
      const beforeVersion = version()
      const beforeHash = storeHash(store)
      const res = await get(url, '/api/health-report', started.token)
      expect(res.status).toBe(200)
      await res.json()
      expect(storeHash(store)).toBe(beforeHash)
      expect(version()).toBe(beforeVersion)
    } finally {
      watcher.close()
    }
  })

  test('KAPI.2.a2 & a3: /api/health-report numbers match fixture data', async () => {
    const res = await get(url, '/api/health-report', started.token)
    expect(res.status).toBe(200)
    const report = (await res.json()) as HealthReport

    // 1. Total and global counts
    expect(report.total).toBe(6)
    expect(report.global).toBe(2)

    // 2. Per-project split (alpha: 3, beta: 1)
    const alphaProj = report.projects.find(p => p.owner === 'project-alpha-1a2b')
    expect(alphaProj?.count).toBe(3)
    const betaProj = report.projects.find(p => p.owner === 'project-beta-9z8y')
    expect(betaProj?.count).toBe(1)

    // 3. Never-recalled: 3 memories (a2, a3, g2)
    expect(report.neverRecalled.count).toBe(3)
    expect(report.neverRecalled.list).toHaveLength(3)
    const neverIds = report.neverRecalled.list.map(m => m.id)
    expect(neverIds).toContain(ids.a2)
    expect(neverIds).toContain(ids.a3)
    expect(neverIds).toContain(ids.g2)

    // 4. Most recalled (top 10): a1 (10), g1 (3), b1 (1)
    expect(report.mostRecalled.length).toBeGreaterThanOrEqual(3)
    expect(report.mostRecalled[0]!.id).toBe(ids.a1)
    expect(report.mostRecalled[0]!.recalls).toBe(10)
    expect(report.mostRecalled[1]!.id).toBe(ids.g1)
    expect(report.mostRecalled[1]!.recalls).toBe(3)
    expect(report.mostRecalled[2]!.id).toBe(ids.b1)
    expect(report.mostRecalled[2]!.recalls).toBe(1)

    // 5. Recalls per day & days covered
    // 2026-10-21: 2 recalls
    // 2026-10-22: 1 recall
    // 2026-10-23: 1 line, origin ui (a dashboard search): in the log, but not Claude recalling, so not counted
    // Total span: 3 days
    expect(report.daysCovered).toBe(3)
    const day21 = report.recallsPerDay.find(d => d.date === '2026-10-21')
    expect(day21?.count).toBe(2)
    const day22 = report.recallsPerDay.find(d => d.date === '2026-10-22')
    expect(day22?.count).toBe(1)
    expect(report.recallsPerDay.find(d => d.date === '2026-10-23')).toBeUndefined()
    expect(report.recallsPerDay.reduce((sum, day) => sum + day.count, 0)).toBe(3)

    // 6. Sizes in bytes
    expect(report.sizes.store).toBeGreaterThan(0)
    expect(report.sizes.log).toBeGreaterThan(0)
    expect('storeSize' in report || 'logSize' in report).toBe(false)

    // 7. Table counts
    expect(report.tables.working_memory).toBe(6)
    expect(report.tables.memoria_facts).toBe(1)
    expect(report.tables.memoria_preferences).toBe(1)

    // 8. Coverage:
    // Tagged: g1, a1, a2, b1 (4 tagged, g2 and a3 untagged)
    expect(report.coverage.tagged).toBe(4)
    // Memories with knowledge: a1 (fact), g1 (preference) -> 2
    expect(report.coverage.knowledge).toBe(2)
    // Memories with vector: a1 -> 1
    expect(report.coverage.embeddings).toBe(1)
    // vectors is the same number under the name the Health tab's mock used.
    expect(report.coverage.vectors).toBe(1)
    // Memories with author_type set: a1 ('human'), b1 ('agent') -> 2
    expect(report.coverage.provenance).toBe(2)
  })

  test('QAPAGE R2 item 1: the QA mix (9 Claude Code recalls, 2 other-app recalls, some dashboard searches) gives 9, with the 2 counted apart', async () => {
    const mixTemp = tempDir('recall-mix')
    const mixStore = join(mixTemp.dir, 'store')
    mkdirSync(mixStore, { recursive: true })
    const mixLog = join(mixTemp.dir, 'activity.jsonl')
    const lines = recallMix().map(line => JSON.stringify(line))
    writeFileSync(mixLog, `${lines.join('\n')}\n`)
    const mixStarted = await startServer({ root: join(mixTemp.dir, 'root'), store: mixStore, cli: CLI, activityLog: mixLog, pluginRoot: ROOT })
    try {
      const res = await get(`http://127.0.0.1:${mixStarted.port}`, '/api/health-report', mixStarted.token)
      const report = (await res.json()) as HealthReport
      const sum = (days: { count: number }[]) => days.reduce((total, day) => total + day.count, 0)
      expect(sum(report.recallsPerDay)).toBe(9)
      expect(sum(report.otherRecallsPerDay)).toBe(2)
      expect(Object.values(report.recallsByDay).reduce((total, n) => total + n, 0)).toBe(9)
    } finally {
      mixStarted.stop()
      mixTemp.dispose()
    }
  })

  test('KAPI.2: Empty store or missing database returns empty report without throwing', async () => {
    const emptyTemp = tempDir('empty-health-report')
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
      const res = await get(`http://127.0.0.1:${emptyStarted.port}`, '/api/health-report', emptyStarted.token)
      expect(res.status).toBe(200)
      const report = (await res.json()) as HealthReport
      expect(report.total).toBe(0)
      expect(report.global).toBe(0)
      expect(report.projects).toEqual([])
      expect(report.neverRecalled.count).toBe(0)
      expect(report.neverRecalled.list).toEqual([])
      expect(report.mostRecalled).toEqual([])
      expect(report.recallsPerDay).toEqual([])
      expect(report.daysCovered).toBe(0)
      expect(report.sizes.log).toBe(0)
      expect(report.coverage.total).toBe(0)
      expect(report.coverage.tagged).toBe(0)
    } finally {
      emptyStarted.stop()
      emptyTemp.dispose()
    }
  })

  test('KAPI.2: working_memory without last_recalled still counts and lists its never-recalled memories', async () => {
    const report = await reportOf('legacy-health', db => {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER DEFAULT 0, metadata_json TEXT)')
      db.run("INSERT INTO working_memory (id, session_id, content, timestamp) VALUES ('m1', 'p1', 'x', '2026-10-01'), ('m2', 'p1', 'y', '2026-10-02')")
      db.run("INSERT INTO working_memory (id, session_id, content, timestamp, recall_count) VALUES ('m3', 'p1', 'z', '2026-10-03', 5)")
    })
    expect(report.total).toBe(3)
    expect(report.neverRecalled.count).toBe(2)
    expect(report.neverRecalled.list.map(m => m.id)).toEqual(['m2', 'm1'])
    expect(report.mostRecalled.map(m => [m.id, m.recalls, m.lastRecalled])).toEqual([['m3', 5, null]])
  })

  test('KAPI.2: a table whose name needs quoting is counted', async () => {
    const report = await reportOf('odd-table-health', db => {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER, last_recalled TEXT, metadata_json TEXT)')
      db.run('CREATE TABLE "odd name" (x)')
      db.run('INSERT INTO "odd name" VALUES (1), (2)')
    })
    expect(report.tables['odd name']).toBe(2)
  })

  test('KAPI.2: the never-recalled list stops at 50 (newest first) and most recalled at 10', async () => {
    expect([NEVER_RECALLED_LIST, MOST_RECALLED_LIST]).toEqual([50, 10])
    const report = await reportOf('capped-health', db => {
      db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, timestamp TEXT, recall_count INTEGER, last_recalled TEXT, metadata_json TEXT)')
      const insert = db.prepare('INSERT INTO working_memory VALUES (?, ?, ?, ?, ?, NULL, NULL)')
      db.transaction(() => {
        for (let i = 0; i < 60; i++) insert.run(`n${String(i).padStart(2, '0')}`, 'p1', 'never', `2026-10-01T00:00:${String(i).padStart(2, '0')}Z`, 0)
        for (let i = 1; i <= 12; i++) insert.run(`r${String(i).padStart(2, '0')}`, 'p1', 'recalled', '2026-09-01T00:00:00Z', i)
      })()
    })
    expect(report.neverRecalled.count).toBe(60)
    expect(report.neverRecalled.list).toHaveLength(50)
    expect(report.neverRecalled.list[0]!.id).toBe('n59')
    expect(report.neverRecalled.list.at(-1)!.id).toBe('n10')
    expect(report.mostRecalled.map(m => m.recalls)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3])
  })
})
