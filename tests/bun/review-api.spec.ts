// CRUDX.3 and CRUDX.5: GET /api/review (the live candidates with their reasons, the not-live rows with their state and
// last audit rows) and the `state` on GET /api/memories. The real server on 127.0.0.1 against a temporary store made
// by the real engine; fixture rows and vectors are written straight into that temporary database (the server reads it
// read-only). Every test uses a temp HOME and a temp store; the real ~/.claude is never named.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, isolatedEnv, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const OWNER = 'project-alpha-1a2b'
const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString()

type Row = Record<string, any>

async function seed(store: string, owner: string, content: string, extra: Record<string, unknown> = {}) {
  const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...extra })])).get(1))
  if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  return reply.memory_id as string
}

/** Every working_memory row and table count that a read must not change. */
function snapshot(store: string) {
  const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
  try {
    return JSON.stringify({
      rows: db.query('SELECT * FROM working_memory ORDER BY id').all(),
      trail: db.query('SELECT * FROM memory_validations ORDER BY validation_id').all(),
    })
  } finally {
    db.close()
  }
}

function useTempHome() {
  const saved = process.env.HOME
  return {
    enter: () => {
      process.env.HOME = isolatedEnv('review-api').HOME
    },
    leave: () => {
      if (saved === undefined) delete process.env.HOME
      else process.env.HOME = saved
    },
  }
}

describe('GET /api/review on a real store', () => {
  const temp = tempDir('review-api')
  const store = join(temp.dir, 'store')
  const home = useTempHome()
  const ids = {} as Record<string, string>
  let started: Started
  let url = ''

  const open = () => new Database(join(store, 'mnemopi.db'))
  const get = async (path: string) => {
    const response = await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${started.token}` } })
    return { status: response.status, json: (await response.json()) as Row }
  }
  const review = async () => (await get('/api/review')).json
  const candidate = (reply: Row, id: string) => (reply.candidates as Row[]).find(row => row.id === id) as Row

  beforeAll(async () => {
    home.enter()
    mkdirSync(store, { recursive: true })
    ids.superseded = await seed(store, OWNER, 'SUPERSEDED: the old deploy flow used the Jenkins pipeline', { memory_type: 'fact' })
    ids.lowercase = await seed(store, OWNER, 'The historical record of builds is kept for a year', { memory_type: 'fact' })
    ids.stale = await seed(store, OWNER, 'This note about the queue is Possibly Stale after the move', { memory_type: 'fact' })
    ids.dated = await seed(store, OWNER, 'Merged the alpha release on 2026-10-24 and it is done', { memory_type: 'fact' })
    ids.datedContext = await seed(store, OWNER, 'Merged the beta release on 2026-10-24 and it is done', { memory_type: 'context' })
    ids.flagged = await seed(store, OWNER, 'A long text that was saved after a warning was shown', { memory_type: 'fact', metadata: { guard: ['G2'] } })
    ids.neverOld = await seed(store, OWNER, 'The alpha build cache lives under the temp folder', { memory_type: 'fact' })
    ids.recalledOld = await seed(store, OWNER, 'The alpha linter config sits beside the package file', { memory_type: 'fact' })
    ids.fresh = await seed(store, OWNER, 'The alpha release notes are written by hand each week', { memory_type: 'fact' })
    ids.pinned = await seed(store, OWNER, 'SUPERSEDED but pinned: the first design of the router', { memory_type: 'fact', metadata: { pinned: true } })
    ids.dupA = await seed(store, 'global', 'Rohit likes short answers with the result first', { memory_type: 'preference' })
    ids.dupB = await seed(store, OWNER, 'Rohit wants brief replies that lead with the result', { memory_type: 'preference' })
    ids.far = await seed(store, 'global', 'The staging cluster has three worker nodes', { memory_type: 'fact' })
    ids.retired = await seed(store, OWNER, 'The alpha wiki page about onboarding is out of date', { memory_type: 'fact' })
    ids.expired = await seed(store, OWNER, 'The alpha preview site is up for the review week', { memory_type: 'context' })
    ids.lapsed = await seed(store, OWNER, 'The alpha demo account is shared with the sales team', { memory_type: 'context' })
    ids.replaced = await seed(store, OWNER, 'The alpha deploy runs on the old pipeline', { memory_type: 'fact' })
    ids.futureExpiry = await seed(store, OWNER, 'The alpha sprint board is open for planning', { memory_type: 'context' })
    const db = open()
    try {
      db.run('UPDATE working_memory SET timestamp = ? WHERE id IN (?, ?)', [ago(40), ids.neverOld!, ids.recalledOld!])
      db.run('UPDATE working_memory SET recall_count = 3 WHERE id = ?', [ids.recalledOld!])
      // Not live: a retire with a replacement, an expiry by the sweep, and a row whose own date passed.
      db.run('UPDATE working_memory SET valid_until = ? WHERE id = ?', [ago(2), ids.retired!])
      db.run('UPDATE working_memory SET valid_until = ? WHERE id = ?', [ago(5), ids.expired!])
      db.run('UPDATE working_memory SET valid_until = ? WHERE id = ?', [ago(9), ids.lapsed!])
      db.run('UPDATE working_memory SET valid_until = ?, superseded_by = ? WHERE id = ?', [ago(1), ids.fresh!, ids.replaced!])
      db.run('UPDATE working_memory SET valid_until = ? WHERE id = ?', [ahead(5), ids.futureExpiry!])
      const audit = (id: string, validator: string, action: string, at: string) =>
        db.run('INSERT INTO memory_validations (memory_id, validator, action, validated_at) VALUES (?, ?, ?, ?)', [id, validator, action, at.replace('T', ' ').slice(0, 19)])
      audit(ids.retired!, 'dashboard', 'retire', ago(2))
      audit(ids.expired!, 'expire-sweep', 'expire', ago(5))
      // newest 3 are kept by the engine's own trigger; the oldest of four goes
      audit(ids.replaced!, 'claude-code', 'retire', ago(4))
      audit(ids.replaced!, 'dashboard', 'update', ago(3))
      audit(ids.replaced!, 'claude-code', 'attest', ago(2))
      audit(ids.replaced!, 'dashboard', 'update', ago(1))
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    url = `http://127.0.0.1:${started.port}`
  }, 180_000)

  afterAll(() => {
    started?.stop()
    home.leave()
    temp.dispose()
  })

  test('token-guarded and GET only', async () => {
    expect((await fetch(`${url}/api/review`)).status).toBe(401)
    expect((await fetch(`${url}/api/review`, { method: 'POST', headers: { Authorization: `Bearer ${started.token}`, Origin: url, 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(405)
  })

  test('CRUDX.3.a1: candidates carry id, owner, preview and reasons; only the reasons listed exist', async () => {
    const reply = await review()
    expect(Object.keys(reply).sort()).toEqual(['candidateTotal', 'candidates', 'notLive', 'notLiveTotal'])
    for (const row of reply.candidates as Row[]) {
      expect(Object.keys(row).sort()).toEqual(['id', 'owner', 'preview', 'reasons'])
      expect(row.reasons.length).toBeGreaterThan(0)
    }
    expect(candidate(reply, ids.superseded!)).toMatchObject({ owner: OWNER, preview: 'SUPERSEDED: the old deploy flow used the Jenkins pipeline', reasons: ['marked superseded'] })
    expect(reply.candidateTotal).toBe(reply.candidates.length)
  })

  test('the reasons: marked superseded (capital words or "possibly stale"), dated status note, guard flag, never recalled', async () => {
    const reply = await review()
    expect(candidate(reply, ids.stale!).reasons).toEqual(['marked superseded'])
    expect(candidate(reply, ids.dated!).reasons).toEqual(['dated status note'])
    expect(candidate(reply, ids.flagged!).reasons).toEqual(['guard flag'])
    expect(candidate(reply, ids.neverOld!).reasons).toEqual(['never recalled, older than 30 days'])
    // not candidates: a lowercase "historical", a dated note of kind context, a recalled old row, a new row, a pinned row
    for (const id of [ids.lowercase!, ids.datedContext!, ids.recalledOld!, ids.fresh!, ids.pinned!]) expect(candidate(reply, id)).toBeUndefined()
  })

  test('only live rows are candidates; a row whose expiry is still ahead is live', async () => {
    const reply = await review()
    for (const id of [ids.retired!, ids.expired!, ids.lapsed!, ids.replaced!]) expect(candidate(reply, id)).toBeUndefined()
    expect(reply.notLive.map((row: Row) => row.id)).not.toContain(ids.futureExpiry)
  })

  test('with no vectors the near-duplicate reason is simply absent', async () => {
    const reply = await review()
    for (const row of reply.candidates as Row[]) for (const reason of row.reasons) expect(reason).not.toMatch(/^near-duplicate/)
  })

  test('CRUDX.3.a5: near-duplicates (cosine 0.88 or more) name the closest other memory and score; far ones, other models and retired rows are not', async () => {
    const db = open()
    try {
      const put = (id: string, vector: number[], model = 'bge-small') => db.run('INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding_json, model) VALUES (?, ?, ?)', [id, JSON.stringify(vector), model])
      put(ids.dupA!, [1, 0, 0])
      put(ids.dupB!, [0.95, 0.31, 0])
      put(ids.far!, [0, 1, 0])
      // a retired row's vector is never a partner, and a vector of another model is not comparable
      put(ids.retired!, [1, 0.01, 0])
      put(ids.neverOld!, [1, 0, 0.02], 'another-model')
    } finally {
      db.close()
    }
    const reply = await review()
    const a = candidate(reply, ids.dupA!)
    const b = candidate(reply, ids.dupB!)
    expect(a.reasons).toEqual([`near-duplicate of ${ids.dupB} (0.95)`])
    expect(b.reasons).toEqual([`near-duplicate of ${ids.dupA} (0.95)`])
    expect(candidate(reply, ids.far!)).toBeUndefined()
    expect(candidate(reply, ids.neverOld!).reasons).toEqual(['never recalled, older than 30 days'])
  })

  test('candidates are ordered by number of reasons, then oldest first', async () => {
    const db = open()
    try {
      // two reasons: a dated note that is also old and never recalled
      db.run('UPDATE working_memory SET timestamp = ? WHERE id = ?', [ago(60), ids.dated!])
    } finally {
      db.close()
    }
    const reply = await review()
    expect(reply.candidates[0]).toMatchObject({ id: ids.dated, reasons: ['dated status note', 'never recalled, older than 30 days'] })
    const counts = (reply.candidates as Row[]).map(row => row.reasons.length)
    expect([...counts].sort((x, y) => y - x)).toEqual(counts)
  })

  test('CRUDX.3.a2: not-live rows are listed apart with state, the date they stopped and their last audit rows (CRUDX.5)', async () => {
    const reply = await review()
    const byId = new Map((reply.notLive as Row[]).map(row => [row.id, row]))
    expect([...byId.keys()].sort()).toEqual([ids.retired, ids.expired, ids.lapsed, ids.replaced].sort())
    expect(reply.notLiveTotal).toBe(4)
    expect(byId.get(ids.retired!)).toMatchObject({ owner: OWNER, preview: 'The alpha wiki page about onboarding is out of date', state: 'retired' })
    expect(byId.get(ids.expired!)).toMatchObject({ state: 'expired' })
    expect(byId.get(ids.lapsed!)).toMatchObject({ state: 'lapsed' })
    expect(byId.get(ids.replaced!)).toMatchObject({ state: 'retired' })
    for (const row of byId.values()) {
      expect(Object.keys(row).sort()).toEqual(['history', 'id', 'owner', 'preview', 'since', 'state'])
      expect(Number.isNaN(Date.parse(row.since))).toBe(false)
    }
    // the date a row stopped being live is its valid_until
    expect(Math.abs(Date.parse(byId.get(ids.retired!)!.since) - Date.parse(ago(2)))).toBeLessThan(2000)
    // the list is ordered by when each stopped, newest first
    const since = (reply.notLive as Row[]).map(row => Date.parse(row.since))
    expect([...since].sort((x, y) => y - x)).toEqual(since)
  })

  test('CRUDX.5.a2: history is the newest audit rows first (3 at most), action, validator and time, never text; empty when there is none', async () => {
    const reply = await review()
    const byId = new Map((reply.notLive as Row[]).map(row => [row.id, row]))
    expect(byId.get(ids.retired!)!.history).toEqual([{ action: 'retire', validator: 'dashboard', at: expect.any(String) }])
    expect(byId.get(ids.expired!)!.history.map((entry: Row) => [entry.action, entry.validator])).toEqual([['expire', 'expire-sweep']])
    expect(byId.get(ids.lapsed!)!.history).toEqual([])
    // four were written; the engine's trigger kept the newest three, and the newest is first
    expect(byId.get(ids.replaced!)!.history.map((entry: Row) => entry.action)).toEqual(['update', 'attest', 'update'])
    const times = byId.get(ids.replaced!)!.history.map((entry: Row) => Date.parse(entry.at))
    expect([...times].sort((x, y) => y - x)).toEqual(times)
    expect(JSON.stringify(reply.notLive)).not.toContain('new_content')
  })

  test('a later update or attest is not read as the state: the newest retire or expire decides', async () => {
    const reply = await review()
    expect((reply.notLive as Row[]).find(row => row.id === ids.replaced)).toMatchObject({ state: 'retired' })
  })

  test('CRUDX.3.a4: the routes never change a row, the trail or recall_count', async () => {
    const before = snapshot(store)
    await review()
    await get('/api/memories')
    await get(`/api/memories/${ids.retired}`)
    expect(snapshot(store)).toBe(before)
  })

  test('CRUDX.3.a3: /api/memories rows gain state (live for the rest); nothing else in the reply changes', async () => {
    const { status, json } = await get('/api/memories')
    expect(status).toBe(200)
    expect(Object.keys(json).sort()).toEqual(['count', 'memories', 'total'])
    const rows = new Map((json.memories as Row[]).map(row => [row.id, row]))
    expect(rows.get(ids.fresh!)!.state).toBe('live')
    expect(rows.get(ids.futureExpiry!)!.state).toBe('live')
    expect(rows.get(ids.retired!)!.state).toBe('retired')
    expect(rows.get(ids.expired!)!.state).toBe('expired')
    expect(rows.get(ids.lapsed!)!.state).toBe('lapsed')
    expect(rows.get(ids.replaced!)!.state).toBe('retired')
    // the row keys are the old ones plus state: no valid_until or superseded_by leaks into the list
    expect(Object.keys(rows.get(ids.fresh!)!).sort()).toEqual(['id', 'importance', 'last_recalled', 'metadata', 'owner', 'preview', 'recall_count', 'scope', 'state', 'tags', 'timestamp', 'truncated'])
    // a filter still works with the state
    const owned = await get(`/api/memories?owner=${OWNER}&q=onboarding`)
    expect(owned.json.memories.map((row: Row) => [row.id, row.state])).toEqual([[ids.retired, 'retired']])
  })
})

describe('GET /api/review on other stores', () => {
  const temp = tempDir('review-api-other')
  const home = useTempHome()
  const started: Started[] = []

  beforeAll(() => home.enter())
  afterAll(() => {
    for (const server of started) server.stop()
    home.leave()
    temp.dispose()
  })

  const serve = async (store: string) => {
    mkdirSync(store, { recursive: true })
    const server = await startServer({ root: join(temp.dir, `root-${started.length}`), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    started.push(server)
    return (path: string) => fetch(`http://127.0.0.1:${server.port}${path}`, { headers: { Authorization: `Bearer ${server.token}` } })
  }

  test('a store with no database yet answers empty lists', async () => {
    const get = await serve(join(temp.dir, 'empty'))
    const response = await get('/api/review')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ candidates: [], candidateTotal: 0, notLive: [], notLiveTotal: 0 })
  })

  test('CRUDX.5.a3: a store without memory_validations answers history [] and no error, and the state falls back to the columns', async () => {
    const store = join(temp.dir, 'no-trail')
    mkdirSync(store, { recursive: true })
    const lapsed = await seed(store, OWNER, 'The alpha demo account is shared with the sales team', { memory_type: 'context' })
    const replaced = await seed(store, OWNER, 'The alpha deploy runs on the old pipeline', { memory_type: 'fact' })
    const keep = await seed(store, OWNER, 'The alpha release notes are written by hand each week', { memory_type: 'fact' })
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      db.run('UPDATE working_memory SET valid_until = ? WHERE id = ?', [ago(3), lapsed])
      db.run('UPDATE working_memory SET valid_until = ?, superseded_by = ? WHERE id = ?', [ago(1), keep, replaced])
      db.run('DROP TABLE memory_validations')
    } finally {
      db.close()
    }
    const get = await serve(store)
    const response = await get('/api/review')
    expect(response.status).toBe(200)
    const reply = (await response.json()) as Row
    const byId = new Map((reply.notLive as Row[]).map(row => [row.id, row]))
    expect(byId.get(lapsed)).toMatchObject({ state: 'lapsed', history: [] })
    expect(byId.get(replaced)).toMatchObject({ state: 'retired', history: [] })
    const memories = (await (await get('/api/memories')).json()) as Row
    expect(new Map((memories.memories as Row[]).map(row => [row.id, row.state])).get(lapsed)).toBe('lapsed')
    // one memory's detail (the existing route) also answers without the table
    expect((await get(`/api/memories/${lapsed}`)).status).toBe(200)
  })
})
