// VIEW.1 - VIEW.4: the dashboard's memories, activity, search and forget
// routes, run for real: the server from ui/server.ts on 127.0.0.1, a temporary
// WAL store made by the real engine (engine/src/cli.ts), and a temporary
// activity log. Every server a test starts is stopped by that test or afterAll.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { appendActivity } from '../../bin/activity'
import { CSP, mergeHits, PREVIEW_CHARS, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const MARKUP = '<script>alert(1)</script> and <img src=x onerror=alert(1)>'
const LONG = `long ${'word '.repeat(100)}end`

type Row = { id: string; recall_count: number; last_recalled: string | null }

describe('the dashboard views on a real store', () => {
  const temp = tempDir('ui-views')
  const store = join(temp.dir, 'store')
  const log = join(temp.dir, 'root', 'activity.jsonl')
  type Name = 'globalApple' | 'markup' | 'aApple' | 'aCherry' | 'bApple' | 'bDurian' | 'bLong'
  const ids = {} as Record<Name, string>
  let server: Started
  let base = ''

  /** Saves one memory through the real engine as `owner`; its id. */
  async function remember(owner: string, name: Name, args: Record<string, unknown>) {
    const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', args)])).get(1))
    if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
    ids[name] = reply.memory_id
    // Distinct timestamps, so newest-first has one answer.
    await Bun.sleep(15)
  }

  const db = () => new Database(join(store, 'mnemopi.db'), { readonly: true })
  /** Every row's id, recall count and last recall, and the row count. */
  const snapshot = () => {
    const handle = db()
    try {
      return handle.query('SELECT id, recall_count, last_recalled, content, session_id, metadata_json FROM working_memory ORDER BY id').all() as Row[]
    } finally {
      handle.close()
    }
  }
  /** The bytes of the database and its WAL. */
  const bytes = () =>
    ['mnemopi.db', 'mnemopi.db-wal']
      .map(name => join(store, name))
      .map(file => (existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : 'none'))
      .join(' ')

  const auth = () => ({ Authorization: `Bearer ${server.token}` })
  const get = (path: string) => fetch(`${base}${path}`, { headers: auth() })
  const origin = () => `http://127.0.0.1:${server.port}`
  const post = (path: string, payload: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json', Origin: origin(), ...headers },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    })
  const logLines = () =>
    existsSync(log)
      ? readFileSync(log, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line))
      : []

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    await remember('global', 'globalApple', { content: 'apple pie recipe from grandma', scope: 'global', importance: 0.7 })
    await remember('global', 'markup', { content: MARKUP, metadata: { tags: ['<b>bold</b>', 'safe'] } })
    await remember('project-a', 'aApple', { content: 'apple orchard notes for project a', scope: 'global' })
    await remember('project-a', 'aCherry', { content: 'cherry tart for project a' })
    await remember('project-b', 'bApple', { content: 'apple cider plan for project b' })
    await remember('project-b', 'bDurian', { content: 'durian smell for project b', metadata: { tags: ['fruit'] } })
    await remember('project-b', 'bLong', { content: LONG })
    // Two recalls that count: durian is the most recalled row.
    for (let i = 0; i < 2; i++) await engineCall(CLI, store, 'project-b', [toolCall(1, 'mnemopi_recall', { query: 'durian' })])
    server = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: log, pluginRoot: ROOT })
    base = `http://127.0.0.1:${server.port}`
  }, 120_000)

  afterAll(() => {
    server?.stop()
    temp.dispose()
  })

  test('the seeded store: durian was recalled twice, every other row never', () => {
    const rows = snapshot()
    expect(rows.length).toBe(7)
    const durian = rows.find(row => row.id === ids.bDurian)
    expect(durian?.recall_count).toBe(2)
    expect(rows.filter(row => row.recall_count > 0).length).toBe(1)
  })

  test('VIEW.1.a1: GET /api/memories returns id, preview, owner, importance, recall_count, last_recalled, timestamp, scope and metadata', async () => {
    const response = await get('/api/memories')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    const list = (await response.json()) as { total: number; count: number; memories: Record<string, unknown>[] }
    expect(list.total).toBe(7)
    expect(list.count).toBe(7)
    for (const memory of list.memories) {
      expect(Object.keys(memory).sort()).toEqual(['id', 'importance', 'last_recalled', 'metadata', 'owner', 'preview', 'recall_count', 'scope', 'timestamp', 'truncated'])
    }
    const apple = list.memories.find(memory => memory.id === ids.globalApple)!
    expect(apple).toMatchObject({ owner: 'global', preview: 'apple pie recipe from grandma', importance: 0.7, recall_count: 0, last_recalled: null, scope: 'global', metadata: null, truncated: false })
    const durian = list.memories.find(memory => memory.id === ids.bDurian)!
    expect(durian).toMatchObject({ owner: 'project-b', recall_count: 2, metadata: { tags: ['fruit'] } })
    expect(typeof durian.last_recalled).toBe('string')
    const long = list.memories.find(memory => memory.id === ids.bLong)!
    expect(long.truncated).toBe(true)
    expect(Array.from(long.preview as string).length).toBe(PREVIEW_CHARS)
  })

  test('VIEW.1.a2: the owner filter and the sort change the set and the order as asked', async () => {
    const list = async (query: string) => ((await (await get(`/api/memories?${query}`)).json()) as { total: number; memories: { id: string; owner: string; recall_count: number; timestamp: string }[] })
    const a = await list('owner=project-a')
    expect(a.total).toBe(2)
    expect(new Set(a.memories.map(m => m.owner))).toEqual(new Set(['project-a']))
    expect(a.memories.map(m => m.id)).toEqual([ids.aCherry, ids.aApple])
    expect((await list('owner=nobody')).memories).toEqual([])

    const newest = await list('sort=newest')
    expect(newest.memories.map(m => m.id)).toEqual([ids.bLong, ids.bDurian, ids.bApple, ids.aCherry, ids.aApple, ids.markup, ids.globalApple])
    const recalled = await list('sort=recalled')
    expect(recalled.memories[0]?.id).toBe(ids.bDurian)
    expect(recalled.memories.map(m => m.id).slice(1)).toEqual(newest.memories.map(m => m.id).filter(id => id !== ids.bDurian))
    const never = await list('sort=never')
    expect(never.memories.map(m => m.id)).toEqual(newest.memories.map(m => m.id).filter(id => id !== ids.bDurian))
    const both = await list('owner=project-b&sort=recalled')
    expect(both.memories.map(m => m.id)).toEqual([ids.bDurian, ids.bLong, ids.bApple])
    // q matches text or metadata, case aside.
    expect((await list('q=APPLE')).memories.map(m => m.id).sort()).toEqual([ids.globalApple, ids.aApple, ids.bApple].sort())
    expect((await list('q=fruit')).memories.map(m => m.id)).toEqual([ids.bDurian])
    expect((await list('limit=2')).memories.length).toBe(2)
    for (const bad of ['sort=oldest', 'sort=constructor', 'limit=0', 'limit=1001', 'limit=x']) {
      expect({ bad, status: (await get(`/api/memories?${bad}`)).status }).toEqual({ bad, status: 400 })
    }
  })

  test('VIEW.1.a3: GET /api/memories/<id> returns the full content and metadata, and 404 for an unknown id', async () => {
    const response = await get(`/api/memories/${ids.bLong}`)
    expect(response.status).toBe(200)
    const memory = (await response.json()) as Record<string, unknown>
    expect(memory).toMatchObject({ id: ids.bLong, content: LONG, owner: 'project-b', recall_count: 0, metadata: null })
    const durian = (await (await get(`/api/memories/${ids.bDurian}`)).json()) as Record<string, unknown>
    expect(durian).toMatchObject({ content: 'durian smell for project b', metadata: { tags: ['fruit'] }, recall_count: 2 })
    for (const path of ['/api/memories/0000000000000000', '/api/memories/%E0%A4%A', `/api/memories/${'x'.repeat(65)}`, '/api/memories/']) {
      const missing = await get(path)
      expect({ path, status: missing.status }).toEqual({ path, status: 404 })
    }
  })

  test('VIEW.1.a4: POST, PUT and DELETE on the read endpoints get 405 and leave the database byte-identical', async () => {
    const before = bytes()
    const rows = snapshot()
    for (const path of ['/api/memories', `/api/memories/${ids.aCherry}`, '/api/activity', '/api/activity/stream']) {
      for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
        const response = await fetch(`${base}${path}`, { method, headers: { ...auth(), 'Content-Type': 'application/json', Origin: origin() }, body: '{}' })
        expect({ path, method, status: response.status }).toEqual({ path, method, status: 405 })
        expect(response.headers.get('allow')).toBe('GET')
      }
    }
    expect(bytes()).toBe(before)
    expect(snapshot()).toEqual(rows)
  })

  test('the read routes want the token like every /api route', async () => {
    for (const path of ['/api/memories', `/api/memories/${ids.aCherry}`, '/api/activity', '/api/activity/stream']) {
      const response = await fetch(`${base}${path}`)
      expect({ path, status: response.status }).toEqual({ path, status: 401 })
      expect(await response.text()).not.toContain('apple')
    }
  })

  test('read-only: list, detail and search change no row count and no recall count', async () => {
    const before = snapshot()
    await get('/api/memories?sort=recalled')
    await get(`/api/memories/${ids.bDurian}`)
    expect((await post('/api/search', { query: 'durian' })).status).toBe(200)
    expect((await post('/api/search', { query: 'apple', owner: 'project-b' })).status).toBe(200)
    expect(snapshot()).toEqual(before)
  })

  test('VIEW.3.a1: POST /api/search runs the engine recall as the given owner with recall counts left alone, and returns rows with scores', async () => {
    const before = snapshot()
    const response = await post('/api/search', { query: 'durian', owner: 'project-b' })
    expect(response.status).toBe(200)
    const found = (await response.json()) as { owners: string[]; results: { id: string; score: number; owner: string; content: string; recall_count: number }[] }
    expect(found.owners).toEqual(['project-b'])
    expect(found.results[0]).toMatchObject({ id: ids.bDurian, owner: 'project-b', content: 'durian smell for project b', recall_count: 2 })
    expect(found.results[0]!.score).toBeGreaterThan(0)
    // The recall count and last recall of the hit are what they were.
    expect(snapshot()).toEqual(before)
    // As project-a, project-b's own row is not seen; the global-scope apples are.
    const asA = (await (await post('/api/search', { query: 'apple', owner: 'project-a' })).json()) as { results: { id: string }[] }
    expect(asA.results.map(r => r.id).sort()).toEqual([ids.globalApple, ids.aApple].sort())
    expect(snapshot()).toEqual(before)
  })

  test('VIEW.3.a2: a search across owners returns each memory once, keeping its best score', async () => {
    const response = await post('/api/search', { query: 'apple' })
    expect(response.status).toBe(200)
    const found = (await response.json()) as { owners: string[]; results: { id: string; score: number; owner: string }[] }
    expect(found.owners.sort()).toEqual(['global', 'project-a', 'project-b'])
    const got = found.results.map(r => r.id)
    expect(new Set(got).size).toBe(got.length)
    expect(got.sort()).toEqual([ids.globalApple, ids.aApple, ids.bApple].sort())
    // Each owner's own recall (no counts), straight from the engine: the best score per id.
    const best = new Map<string, number>()
    let seen = 0
    for (const owner of ['global', 'project-a', 'project-b']) {
      const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_recall', { query: 'apple', limit: 5, update_recall_counts: false })])).get(1))
      for (const row of reply.results as { id: string; score: number }[]) {
        seen++
        best.set(row.id, Math.max(best.get(row.id) ?? -1, row.score))
      }
    }
    // The global-scope apples come back in every owner's recall: there was something to merge.
    expect(seen).toBeGreaterThan(best.size)
    for (const hit of found.results) expect({ id: hit.id, score: hit.score }).toEqual({ id: hit.id, score: best.get(hit.id)! })
    const scores = found.results.map(r => r.score)
    expect(scores).toEqual([...scores].sort((x, y) => y - x))
  })

  test('mergeHits keeps one row per id with its best score, best first', () => {
    const merged = mergeHits([
      [
        { id: 'a', score: 0.2, session_id: 'x', content: 'a' },
        { id: 'b', score: 0.5, session_id: 'x', content: 'b' },
      ],
      [
        { id: 'a', score: 0.9, session_id: 'y', content: 'a' },
        { id: 'b', score: 0.1, session_id: 'y', content: 'b' },
      ],
    ])
    expect(merged.map(hit => [hit.id, hit.score, hit.owner])).toEqual([
      ['a', 0.9, 'y'],
      ['b', 0.5, 'x'],
    ])
  })

  test('search refuses a bad body, an unknown owner, and a request from another origin', async () => {
    for (const payload of [{}, { query: '' }, { query: '   ' }, { query: 3 }, { query: 'x'.repeat(501) }, { query: 'a', owner: 'nobody' }, { query: 'a', owner: 5 }, { query: 'a', extra: 1 }, ['a'], 'nope']) {
      const response = await post('/api/search', payload)
      expect({ payload, status: response.status }).toEqual({ payload, status: 400 })
    }
    expect((await post('/api/search', { query: 'apple' }, { Origin: 'http://evil.example' })).status).toBe(403)
    expect((await post('/api/search', { query: 'apple' }, { 'Content-Type': 'text/plain' })).status).toBe(415)
    expect((await get('/api/search')).status).toBe(405)
  })

  test('VIEW.3.a4: forget refuses no token, GET, a wrong content type, a missing or foreign Origin, a bad id shape, extra fields and an unknown id', async () => {
    const before = snapshot()
    const good = { memory_id: ids.aCherry }
    const cases: [string, Promise<Response>, number][] = [
      ['no token', fetch(`${base}/api/forget`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin() }, body: JSON.stringify(good) }), 401],
      ['GET', fetch(`${base}/api/forget`, { headers: { ...auth(), Origin: origin() } }), 405],
      ['PUT', fetch(`${base}/api/forget`, { method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json', Origin: origin() }, body: JSON.stringify(good) }), 405],
      ['text/plain', post('/api/forget', good, { 'Content-Type': 'text/plain' }), 415],
      ['form', post('/api/forget', 'memory_id=x', { 'Content-Type': 'application/x-www-form-urlencoded' }), 415],
      ['json-ish type', post('/api/forget', good, { 'Content-Type': 'application/jsonx' }), 415],
      ['foreign Origin', post('/api/forget', good, { Origin: 'http://evil.example' }), 403],
      ['localhost Origin', post('/api/forget', good, { Origin: `http://localhost:${server.port}` }), 403],
      ['other port Origin', post('/api/forget', good, { Origin: `http://127.0.0.1:${server.port + 1}` }), 403],
      ['null Origin', post('/api/forget', good, { Origin: 'null' }), 403],
      ['empty id', post('/api/forget', { memory_id: '' }), 400],
      ['65 characters', post('/api/forget', { memory_id: 'a'.repeat(65) }), 400],
      ['number id', post('/api/forget', { memory_id: 7 }), 400],
      ['array id', post('/api/forget', { memory_id: [ids.aCherry] }), 400],
      ['array body', post('/api/forget', [ids.aCherry]), 400],
      ['control character', post('/api/forget', { memory_id: `${ids.aCherry}\n` }), 400],
      ['extra field', post('/api/forget', { memory_id: ids.aCherry, extra: true }), 400],
      ['owner in the body', post('/api/forget', { memory_id: ids.aCherry, owner: 'global' }), 400],
      ['not JSON', post('/api/forget', '{memory_id:'), 400],
      ['missing id', post('/api/forget', {}), 400],
      ['unknown id', post('/api/forget', { memory_id: '0000000000000000' }), 404],
    ]
    // Missing Origin: fetch adds none to a request made here, so the header is left out.
    cases.push(['missing Origin', fetch(`${base}/api/forget`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(good) }), 403])
    for (const [what, pending, status] of cases) {
      const response = await pending
      expect({ what, status: response.status }).toEqual({ what, status })
    }
    expect(snapshot()).toEqual(before)
  })

  test('VIEW.3.a3: forget runs the engine forget as the owner the database names, and deletes exactly that row', async () => {
    const before = snapshot()
    const linesBefore = logLines().length
    // project-b's row; the request names no owner and the server never asked for one.
    const response = await post('/api/forget', { memory_id: ids.bApple })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'deleted', memory_id: ids.bApple, owner: 'project-b' })
    expect(snapshot()).toEqual(before.filter(row => row.id !== ids.bApple))
    // VIEW.3.a6: one activity line, origin ui, for the forget.
    const added = logLines().slice(linesBefore)
    expect(added.length).toBe(1)
    expect(added[0]).toMatchObject({ action: 'forget', origin: 'ui', owner: 'project-b', ids: [ids.bApple], count: 1, ok: true })
    // Again: the row is gone, so it is not found, and nothing else changes.
    const again = await post('/api/forget', { memory_id: ids.bApple })
    expect(again.status).toBe(404)
    expect(await again.json()).toMatchObject({ status: 'not_found' })
    expect(snapshot()).toEqual(before.filter(row => row.id !== ids.bApple))
  }, 30_000)

  test('VIEW.3.a6: a search writes one activity line with origin ui', async () => {
    const linesBefore = logLines().length
    const found = (await (await post('/api/search', { query: 'cherry', owner: 'project-a' })).json()) as { results: { id: string }[] }
    const added = logLines().slice(linesBefore)
    expect(added.length).toBe(1)
    expect(added[0]).toMatchObject({ action: 'recall', origin: 'ui', owner: 'project-a', text: 'cherry', ids: found.results.map(r => r.id), ok: true, owners: 1 })
    const all = logLines().length
    await post('/api/search', { query: 'apple' })
    // Across owners: the C3 default owner, and `owners` records how many were searched (review r1 LOW 6).
    const across = logLines().slice(all)
    expect(across).toMatchObject([{ action: 'recall', origin: 'ui', owner: 'global', text: 'apple', ok: true, owners: 3 }])
    expect(Object.keys(across[0]).sort()).toEqual(['action', 'count', 'ids', 'ok', 'origin', 'owner', 'owners', 't', 'text'])
  })

  test('VIEW.4.a2: a memory holding <script> and <img onerror> comes back as a JSON string, with the CSP on the page', async () => {
    const response = await get(`/api/memories/${ids.markup}`)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(response.headers.get('content-security-policy')).toBe(CSP)
    const raw = await response.text()
    const memory = JSON.parse(raw) as { content: string; metadata: { tags: string[] } }
    expect(memory.content).toBe(MARKUP)
    expect(memory.metadata.tags).toEqual(['<b>bold</b>', 'safe'])
    expect(raw).toContain(JSON.stringify(MARKUP))
    const list = (await (await get('/api/memories?q=onerror')).json()) as { memories: { preview: string }[] }
    expect(list.memories.map(m => m.preview)).toEqual([MARKUP])
    const page = await fetch(`${base}/`)
    expect(page.headers.get('content-security-policy')).toBe(CSP)
    expect(CSP).toContain("script-src 'self'")
    expect(CSP).not.toContain('unsafe-')
  })

  test('VIEW.2.a1: GET /api/activity returns the last N lines, newest first', async () => {
    appendActivity(log, [1, 2, 3].map(n => ({ t: new Date().toISOString(), action: 'recall', origin: 'hook', owner: 'global', text: `line ${n}`, ids: [], count: 0, ok: true })))
    const response = await get('/api/activity?limit=3')
    expect(response.status).toBe(200)
    const { off, lines } = (await response.json()) as { off: boolean; lines: { text: string }[] }
    expect(off).toBe(false)
    expect(lines.map(line => line.text)).toEqual(['line 3', 'line 2', 'line 1'])
    expect(((await (await get('/api/activity')).json()) as { lines: unknown[] }).lines.length).toBe(logLines().length)
    for (const bad of ['limit=0', 'limit=1001', 'limit=x']) expect((await get(`/api/activity?${bad}`)).status).toBe(400)
  })

  test('VIEW.2.a2: the stream needs the token and sends each appended line as one NDJSON line', async () => {
    expect((await fetch(`${base}/api/activity/stream`)).status).toBe(401)
    expect((await fetch(`${base}/api/activity/stream?token=${server.token}`)).status).toBe(401)
    const controller = new AbortController()
    const response = await fetch(`${base}/api/activity/stream`, { headers: auth(), signal: controller.signal })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/x-ndjson; charset=utf-8')
    expect(response.headers.get('content-security-policy')).toBe(CSP)
    const reader = readLines(response)
    try {
      // Lines already in the file are not sent again; new ones are, one per line.
      appendActivity(log, [{ t: 't1', action: 'remember', origin: 'tool', owner: 'global', text: 'streamed one', ids: ['x'], count: 1, ok: true }])
      appendActivity(log, [{ t: 't2', action: 'forget', origin: 'ui', owner: 'global', text: 'streamed two', ids: ['y'], count: 1, ok: true }])
      const got = await reader.next(2, 5_000)
      expect(got.map(line => line.text)).toEqual(['streamed one', 'streamed two'])
      expect(got[0]).toEqual({ t: 't1', action: 'remember', origin: 'tool', owner: 'global', text: 'streamed one', ids: ['x'], count: 1, ok: true })
    } finally {
      controller.abort()
    }
  })

  test('VIEW.2.a4: after a rotation the stream carries on with the new file', async () => {
    const controller = new AbortController()
    const response = await fetch(`${base}/api/activity/stream`, { headers: auth(), signal: controller.signal })
    const reader = readLines(response)
    try {
      appendActivity(log, [{ t: 't', action: 'recall', origin: 'hook', owner: 'global', text: 'before rotation', ok: true }])
      expect((await reader.next(1, 5_000)).map(line => line.text)).toEqual(['before rotation'])
      // A line lands in the old file just before it is rotated, then the new file gets one.
      appendActivity(log, [{ t: 't', action: 'recall', origin: 'hook', owner: 'global', text: 'last of the old file', ok: true }])
      renameSync(log, `${log}.1`)
      appendActivity(log, [{ t: 't', action: 'recall', origin: 'hook', owner: 'global', text: 'first of the new file', ok: true }])
      expect((await reader.next(2, 5_000)).map(line => line.text)).toEqual(['last of the old file', 'first of the new file'])
      // And a rotation by the writer itself (past its size limit).
      appendActivity(log, [{ t: 't', action: 'recall', origin: 'hook', owner: 'global', text: 'rotated by the writer', ok: true }], { maxBytes: 10 })
      expect((await reader.next(1, 5_000)).map(line => line.text)).toEqual(['rotated by the writer'])
    } finally {
      controller.abort()
    }
  })

  test('VIEW.2.a3: a missing file returns an empty list, not an error, and the stream waits for it', async () => {
    const other = tempDir('ui-views-nolog')
    const missing = join(other.dir, 'root', 'activity.jsonl')
    const started = await startServer({ root: join(other.dir, 'root'), store, cli: CLI, activityLog: missing, pluginRoot: ROOT })
    const controller = new AbortController()
    try {
      const url = `http://127.0.0.1:${started.port}`
      const headers = { Authorization: `Bearer ${started.token}` }
      const response = await fetch(`${url}/api/activity`, { headers })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ off: false, lines: [], cursor: '' })
      const stream = await fetch(`${url}/api/activity/stream`, { headers, signal: controller.signal })
      expect(stream.status).toBe(200)
      const reader = readLines(stream)
      appendActivity(missing, [{ t: 't', action: 'stats', origin: 'tool', owner: 'global', text: 'the file appears', ok: true }])
      expect((await reader.next(1, 5_000)).map(line => line.text)).toEqual(['the file appears'])
    } finally {
      controller.abort()
      started.stop()
      other.dispose()
    }
  })

  test('with the log off, /api/activity says so and the stream is 404', async () => {
    const other = tempDir('ui-views-off')
    const started = await startServer({ root: join(other.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    try {
      const url = `http://127.0.0.1:${started.port}`
      const headers = { Authorization: `Bearer ${started.token}` }
      expect(await (await fetch(`${url}/api/activity`, { headers })).json()).toEqual({ off: true, lines: [], cursor: '' })
      expect((await fetch(`${url}/api/activity/stream`, { headers })).status).toBe(404)
    } finally {
      started.stop()
      other.dispose()
    }
  })

  describe('VIEW.3.a5: an engine not_found or failure reaches the page as such and changes nothing', () => {
    async function withEngine(script: string, check: (url: string, headers: Record<string, string>) => Promise<void>) {
      const other = tempDir('ui-views-engine')
      const cli = join(other.dir, 'cli.ts')
      writeFileSync(cli, script)
      const otherLog = join(other.dir, 'activity.jsonl')
      const started = await startServer({ root: join(other.dir, 'root'), store, cli, activityLog: otherLog, pluginRoot: ROOT })
      try {
        const url = `http://127.0.0.1:${started.port}`
        await check(url, { Authorization: `Bearer ${started.token}`, 'Content-Type': 'application/json', Origin: url })
        return readFileSync(otherLog, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
      } finally {
        started.stop()
        other.dispose()
      }
    }
    // A stand-in engine that answers every call with `text`.
    const answering = (text: unknown) =>
      `for (const line of (await Bun.stdin.text()).split('\\n').filter(Boolean)) console.log(JSON.stringify({ jsonrpc: '2.0', id: JSON.parse(line).id, result: { content: [{ type: 'text', text: ${JSON.stringify(JSON.stringify(text))} }] } }))\n`

    test('the engine says not_found: 404 not found', async () => {
      const before = snapshot()
      const lines = await withEngine(answering({ status: 'not_found', memory_id: ids.aCherry }), async (url, headers) => {
        const response = await fetch(`${url}/api/forget`, { method: 'POST', headers, body: JSON.stringify({ memory_id: ids.aCherry }) })
        expect(response.status).toBe(404)
        expect(await response.json()).toMatchObject({ status: 'not_found', error: 'That memory is already gone; nothing was deleted.' })
      })
      expect(lines).toMatchObject([{ action: 'forget', origin: 'ui', owner: 'project-a', ok: false, error: 'not_found' }])
      expect(snapshot()).toEqual(before)
    })

    test('the engine fails: 502 with a plain message, for forget and for search; the detail goes only to the activity log (review r1 LOW 5)', async () => {
      const before = snapshot()
      const lines = await withEngine('process.stderr.write("engine broke at /secret/path"); process.exit(3)\n', async (url, headers) => {
        const forget = await fetch(`${url}/api/forget`, { method: 'POST', headers, body: JSON.stringify({ memory_id: ids.aCherry }) })
        expect(forget.status).toBe(502)
        const forgetText = await forget.text()
        expect(JSON.parse(forgetText)).toEqual({ error: 'The engine failed; the activity log has the detail. Nothing was deleted.' })
        expect(forgetText).not.toContain('/secret/path')
        const search = await fetch(`${url}/api/search`, { method: 'POST', headers, body: JSON.stringify({ query: 'apple' }) })
        expect(search.status).toBe(502)
        const searchText = await search.text()
        expect(JSON.parse(searchText)).toEqual({ error: 'The engine failed; the activity log has the detail.' })
        expect(searchText).not.toContain('/secret/path')
      })
      expect(lines).toMatchObject([
        { action: 'forget', origin: 'ui', ok: false },
        { action: 'recall', origin: 'ui', ok: false },
      ])
      for (const line of lines) expect(line.error).toContain('engine broke at /secret/path')
      expect(snapshot()).toEqual(before)
    })

    test('an engine error reply is an error, not a delete, and its text stays in the log', async () => {
      const before = snapshot()
      const lines = await withEngine(answering({ error: 'database is locked' }), async (url, headers) => {
        const response = await fetch(`${url}/api/forget`, { method: 'POST', headers, body: JSON.stringify({ memory_id: ids.aCherry }) })
        expect(response.status).toBe(502)
        expect(await response.text()).not.toContain('database is locked')
      })
      expect(lines).toMatchObject([{ action: 'forget', ok: false, error: 'database is locked' }])
      expect(snapshot()).toEqual(before)
    })
  })
})

/** Reads NDJSON lines from a streamed reply; blank keep-alive lines are skipped. */
function readLines(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const ready: Record<string, unknown>[] = []
  // A read that a timeout outran is kept for the next call, so no chunk is lost.
  let pending: ReturnType<typeof reader.read> | undefined
  return {
    async next(count: number, ms: number): Promise<Record<string, any>[]> {
      const end = Date.now() + ms
      while (ready.length < count) {
        const left = end - Date.now()
        if (left <= 0) throw new Error(`only ${ready.length} of ${count} lines in ${ms} ms`)
        pending ??= reader.read()
        const chunk = await Promise.race([pending, Bun.sleep(left).then(() => 'timeout' as const)])
        if (chunk === 'timeout') continue
        pending = undefined
        if (chunk.done) throw new Error('the stream ended')
        buffer += decoder.decode(chunk.value, { stream: true })
        let at = buffer.indexOf('\n')
        while (at !== -1) {
          const line = buffer.slice(0, at).trim()
          buffer = buffer.slice(at + 1)
          if (line) ready.push(JSON.parse(line))
          at = buffer.indexOf('\n')
        }
      }
      return ready.splice(0, count)
    },
  }
}
