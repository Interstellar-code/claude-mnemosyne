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
      expect(Object.keys(memory).sort()).toEqual(['id', 'importance', 'last_recalled', 'metadata', 'owner', 'preview', 'recall_count', 'scope', 'tags', 'timestamp', 'truncated'])
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
    expect(Object.keys(across[0]).sort()).toEqual(['action', 'client', 'count', 'ids', 'ok', 'origin', 'owner', 'owners', 't', 'text'])
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

  test('ACT.1.a1/a3, ACT.2: the served Activity page has the header row, the key, the App drop-down and the session chip; header and rows share one CSS rule', async () => {
    const html = await (await fetch(`${base}/`)).text()
    const css = await (await fetch(`${base}/style.css`)).text()
    const view = html.slice(html.indexOf('id="view-activity"'), html.indexOf('id="view-search"'))
    const head = /<div class="feed-head">([\s\S]*?)<\/div>/.exec(view)?.[1] ?? ''
    expect([...head.matchAll(/<span>([^<]*)<\/span>/g)].map(m => m[1])).toEqual(['Time', 'Action', 'Source', 'Project', 'What', 'Result'])
    // The header sits above the rows inside one box, and the key under it.
    expect(view.indexOf('class="feed-head"')).toBeLessThan(view.indexOf('id="act-list"'))
    expect(view.indexOf('id="act-list"')).toBeLessThan(view.indexOf('id="act-key"'))
    const key = view.slice(view.indexOf('id="act-key"'), view.indexOf('</dl>', view.indexOf('id="act-key"')))
    // The mockup's words (design/Activity.dc.html), term by term.
    expect([...key.matchAll(/<dt class="mono">([^<]*)<\/dt><dd>([^<]*)<\/dd>/g)].map(m => [m[1], m[2]])).toEqual([
      ['hook', 'automatic recall on a first prompt or after a compaction'],
      ['tool', 'Claude called a memory tool in Claude Code'],
      ['trigger', 'you typed a trigger phrase, such as \u201cremember that\u201d'],
      ['external', 'another MCP client, through mnemosyne-mcp'],
      ['ui', 'this dashboard (search or forget)'],
      ['backfill', 'the one-time tagging run, /mnemosyne-tags'],
    ])
    expect([...view.matchAll(/<option value="([^"]*)"/g)].map(m => m[1])).toEqual(['all', 'Claude Code', 'Codex', 'Cursor', 'Dashboard'])
    expect(/<option value="all">All<\/option>/.test(view)).toBe(true)
    expect(view).toContain('id="act-session"')
    // One rule gives the header and the rows the same columns, and one rule inside one media query changes both.
    const columns = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{[^{}]*grid-template-columns[^{}]*\}/g)].map(m => m[1]!.replace(/@media[^{]*\{/, '').trim())
    expect(columns.filter(selector => /\.(feed-head|event)\b/.test(selector))).toEqual(['.feed-head, .event', '.feed-head, .event'])
    // The header and the rows change together: both rules sit inside one media query, and the stylesheet may hold more.
    expect(css.match(/@media \([^)]*\)/g)?.length).toBeGreaterThan(0)
    const phone = /@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g
    const together = [...css.matchAll(phone)].filter(m => /\.feed-head, \.event\s*\{[^}]*grid-template-columns/.test(m[1]!))
    expect(together.length).toBe(1)
    // The header is uppercase with spaced letters, like the mockup.
    expect(/\.feed-head \{[^}]*text-transform: uppercase;[^}]*letter-spacing: 0\.06em/.test(css)).toBe(true)
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

// ---- VIEWS.3: the Activity tab shows who wrote each memory ----

describe('VIEWS.3: provenance badges on saved memories in the Activity tab', () => {
  let app: Record<string, any>
  let saved: unknown

  class Node {
    children: (Node | { data: string; textContent: string })[] = []
    attributes = new Map<string, string>()
    className = ''
    hidden = false
    title = ''
    type = ''
    constructor(public tagName: string) {}
    get textContent(): string {
      return this.children.map(child => child.textContent).join('')
    }
    set textContent(value: string) {
      this.children = value === '' ? [] : [{ data: String(value), textContent: String(value) }]
    }
    append(...nodes: (Node | string)[]) {
      for (const node of nodes) this.children.push(typeof node === 'string' ? { data: node, textContent: node } : node)
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value)
    }
    addEventListener() {}
    all(): Node[] {
      return [this, ...this.children.flatMap(child => (child instanceof Node ? child.all() : []))]
    }
    style = {}
  }

  beforeAll(async () => {
    // A path tsc does not follow: ui/app.ts is DOM code, checked by ui/tsconfig.json.
    app = await import(join(ROOT, 'ui', 'app.ts'))
    saved = (globalThis as Record<string, unknown>).document
    ;(globalThis as Record<string, unknown>).document = { createElement: (tag: string) => new Node(tag), createTextNode: (data: string) => ({ data, textContent: data }) }
  })
  afterAll(() => {
    ;(globalThis as Record<string, unknown>).document = saved
  })

  // Real-shaped save lines of the CTX format with the KNOWX.1 fields.
  const save = { t: '2026-10-23T10:00:00.000Z', action: 'remember', origin: 'trigger', owner: 'project-x-1a2b', text: 'always use bun', ids: ['m1'], count: 1, ok: true, client: 'claude-code', session: 'a1b2c3d4-0000-4000-8000-aaaaaaaaaaaa', veracity: 'stated' }

  test('VIEWS.3.a1: you said (human), Claude (agent in Claude Code), Codex or the outside app\'s name (agent), nothing without author_type', () => {
    expect(app.provenanceBadge({ ...save, author_type: 'human' })).toBe('you said')
    expect(app.provenanceBadge({ ...save, origin: 'tool', author_type: 'agent' })).toBe('Claude')
    expect(app.provenanceBadge({ ...save, origin: 'external', client: 'codex-mcp-client', author_type: 'agent' })).toBe('Codex')
    expect(app.provenanceBadge({ ...save, origin: 'external', client: 'cursor-vscode', author_type: 'agent' })).toBe('Cursor')
    expect(app.provenanceBadge({ ...save, origin: 'external', client: 'zed', author_type: 'agent' })).toBe('zed')
    expect(app.provenanceBadge({ ...save, origin: 'external', client: undefined, author_type: 'agent' })).toBe('agent')
    expect(app.provenanceBadge({ ...save, author_type: 'system' })).toBe('system')
    // No author_type, or a value the engine does not use: no badge.
    expect(app.provenanceBadge(save)).toBe('')
    expect(app.provenanceBadge({ ...save, author_type: 'robot' })).toBe('')
    // Only a save has an author.
    expect(app.provenanceBadge({ ...save, action: 'recall', author_type: 'human' })).toBe('')
    expect(app.provenanceBadge({ ...save, action: 'update', author_type: 'agent' })).toBe('')
  })

  test('VIEWS.3.a1: a save row shows the badge before its text, the other rows show none, and the row keeps its six cells', () => {
    const row = (line: unknown) => app.activityItem(line, () => {}) as Node
    const human = row({ ...save, author_type: 'human' })
    expect(human.children).toHaveLength(6)
    const what = human.children[4] as Node
    expect(what.className).toBe('what')
    expect((what.children[0] as Node).textContent).toBe('you said')
    expect((what.children[0] as Node).className).toContain('prov-human')
    expect(what.textContent).toBe('you saidalways use bun')
    const agent = row({ ...save, origin: 'tool', author_type: 'agent' })
    expect(((agent.children[4] as Node).children[0] as Node).className).toContain('prov-agent')
    // An old save and a recall have no badge, and the text is alone in the cell.
    for (const line of [save, { ...save, action: 'recall', author_type: 'human' }]) {
      const plain = row(line)
      expect(plain.children).toHaveLength(6)
      expect((plain.children[4] as Node).textContent).toBe('always use bun')
      expect((plain.children[4] as Node).all().filter(n => n.className.includes('prov'))).toEqual([])
    }
  })

  test('VIEWS.3.a1: an outside app\'s name in the badge is text, never markup', () => {
    const MARKUP = '<img src=x onerror=alert(1)>'
    const line = { ...save, origin: 'external', client: MARKUP, author_type: 'agent' }
    expect(app.provenanceBadge(line)).toBe(MARKUP)
    const what = (app.activityItem(line, () => {}) as Node).children[4] as Node
    expect(what.all().map(n => n.tagName).filter(tag => tag !== 'span')).toEqual([])
    expect((what.children[0] as Node).textContent).toBe(MARKUP)
    expect(what.all().some(n => [...n.attributes.keys()].some(name => /^on/i.test(name)))).toBe(false)
  })

  test('VIEWS.3.a2: the key under the list explains the badges, and the original key is still there', () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const view = html.slice(html.indexOf('id="view-activity"'), html.indexOf('id="view-search"'))
    const prov = view.slice(view.indexOf('id="act-prov-key"'), view.indexOf('</dl>', view.indexOf('id="act-prov-key"')))
    expect(prov).toContain('you said')
    expect(prov).toContain('Claude')
    expect(prov).toContain('Codex')
    expect(prov).toContain('no badge')
    expect(view.indexOf('id="act-key"')).toBeLessThan(view.indexOf('id="act-prov-key"'))
    expect(view.indexOf('id="act-list"')).toBeLessThan(view.indexOf('id="act-prov-key"'))
    expect(readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')).toMatch(/\.prov-human \{/)
  })
})

// VIEWS R2: the app.ts glue of the Knowledge and Health tabs (loadKnowledge, loadHealthReport,
// drawKnowledge, drawHealth, forgetById), run without a browser: a stand-in document whose
// elements are the ids of the real index.html, and fetch routed to a real server over a real
// engine store. Only the network edge (the token and Origin the page would send) and the DOM are faked.
describe('VIEWS R2: the Knowledge and Health glue in app.ts', () => {
  const temp = tempDir('ui-views-glue')
  const store = join(temp.dir, 'store')
  const ids: string[] = []
  let server: Started
  let app: Record<string, any>
  let saved: unknown
  const realFetch = globalThis.fetch
  let mode: 'real' | 'fail500' | 'throw' = 'real'
  const calls: { path: string; method: string; body: string }[] = []
  const focused: AppNode[] = []

  class AppText {
    constructor(public data: string) {}
    get textContent() {
      return this.data
    }
  }
  class AppNode {
    children: (AppNode | AppText)[] = []
    attributes = new Map<string, string>()
    dataset: Record<string, string> = {}
    style: Record<string, string> = {}
    className = ''
    hidden = false
    disabled = false
    type = ''
    title = ''
    colSpan = 1
    listeners = new Map<string, ((event: unknown) => void)[]>()
    constructor(public tagName: string) {}
    get textContent(): string {
      return this.children.map(child => child.textContent).join('')
    }
    set textContent(value: string) {
      this.children = value === '' ? [] : [new AppText(String(value))]
    }
    append(...nodes: (AppNode | AppText | string)[]) {
      for (const node of nodes) this.children.push(typeof node === 'string' ? new AppText(node) : node)
    }
    replaceChildren(...nodes: (AppNode | AppText | string)[]) {
      this.children = []
      this.append(...nodes)
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, String(value))
    }
    removeAttribute(name: string) {
      this.attributes.delete(name)
    }
    addEventListener(type: string, listener: (event: unknown) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
    }
    fire(type: string) {
      for (const listener of this.listeners.get(type) ?? []) listener({})
    }
    // The focus spy.
    focus() {
      focused.push(this)
    }
    querySelector(selector: string) {
      return this.all().find(node => node !== this && node.tagName === selector) ?? null
    }
    querySelectorAll() {
      return []
    }
    all(): AppNode[] {
      return [this, ...this.children.flatMap(child => (child instanceof AppNode ? child.all() : []))]
    }
    buttons() {
      return this.all().filter(node => node.tagName === 'button')
    }
  }

  // One node per id of the real page, hidden as the markup has it.
  const page = new Map<string, AppNode>()
  const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
  for (const tag of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = new AppNode(tag[1]!)
    node.hidden = /\shidden[\s>]/.test(tag[0])
    page.set(tag[2]!, node)
  }
  const byId = (id: string) => page.get(id)!

  /** Waits until `check` holds (the page's forget and reload run in the background). */
  async function until(check: () => boolean, what: string) {
    for (let i = 0; i < 200 && !check(); i++) await Bun.sleep(10)
    if (!check()) throw new Error(`timed out waiting for ${what}`)
  }

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    for (const [i, content] of ['first never recalled note', 'second never recalled note', 'third never recalled note', 'fourth note, forgotten from Memories'].entries()) {
      const reply = body((await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(1, 'mnemopi_remember', { content })])).get(1)) as { memory_id: string }
      ids[i] = reply.memory_id
      await Bun.sleep(15)
    }
    const prompt = body((await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(2, 'mnemopi_knowledge_prompt', { memory_id: ids[3] })])).get(2)) as { sha256: string }
    const reply = JSON.stringify({ facts: ['Glue fact'], preferences: [], instructions: ['Always glue'], timelines: [], kg: [{ subject: 'glue', predicate: 'holds', object: 'tabs' }] })
    await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(3, 'mnemopi_knowledge_store', { memory_id: ids[3], reply, sha256: prompt.sha256 })])
    server = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    app = await import(join(ROOT, 'ui', 'app.ts'))
    const g = globalThis as Record<string, unknown>
    saved = g.document
    g.document = { createElement: (tag: string) => new AppNode(tag.toLowerCase()), createTextNode: (data: string) => new AppText(data), getElementById: (id: string) => page.get(id) ?? null }
    g.fetch = async (path: string, init: RequestInit = {}) => {
      calls.push({ path, method: init.method ?? 'GET', body: typeof init.body === 'string' ? init.body : '' })
      if (mode === 'fail500') return new Response(JSON.stringify({ error: 'boom' }), { status: 500 })
      if (mode === 'throw') throw new TypeError('network down')
      const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${server.token}`, Origin: `http://127.0.0.1:${server.port}` }
      return realFetch(`http://127.0.0.1:${server.port}${path}`, { ...init, headers })
    }
  }, 180_000)

  afterAll(() => {
    const g = globalThis as Record<string, unknown>
    g.document = saved
    g.fetch = realFetch
    server?.stop()
    temp.dispose()
  })

  test('item 3: a failed load writes the error in the tab\'s own status line with Try again; the body stays hidden; Try again loads it', async () => {
    const globalStatus = byId('status').textContent
    mode = 'fail500'
    await app.loadKnowledge()
    expect(byId('know-status').textContent).toBe('Could not load the knowledge: the server answered 500')
    expect(byId('know-status').className).toContain('is-error')
    expect(byId('know-status').hidden).toBe(false)
    expect(byId('know-retry').hidden).toBe(false)
    expect(byId('know-body').hidden).toBe(true)
    mode = 'throw'
    await app.loadHealthReport()
    expect(byId('health-status').textContent).toBe('Could not load the health report: network down')
    expect(byId('health-status').className).toContain('is-error')
    expect(byId('health-status').hidden).toBe(false)
    expect(byId('health-retry').hidden).toBe(false)
    expect(byId('health-body').hidden).toBe(true)
    // The page's global status line is left alone.
    expect(byId('status').textContent).toBe(globalStatus)

    mode = 'real'
    app.wireKnowledgeHealth()
    byId('know-retry').fire('click')
    byId('health-retry').fire('click')
    await until(() => !byId('know-body').hidden && !byId('health-body').hidden, 'both tabs to load')
    expect(byId('know-retry').hidden).toBe(true)
    expect(byId('know-status').className).not.toContain('is-error')
    expect(byId('know-status').textContent).toContain('cannot say whether extraction is on')
    expect(byId('health-retry').hidden).toBe(true)
    expect(byId('health-status').hidden).toBe(true)
  })

  test('drawKnowledge: the real reply drawn, the kind buttons are aria-pressed toggles, picking Instructions shows its status', async () => {
    await app.loadKnowledge()
    const tabs = byId('know-tabs').children as AppNode[]
    expect(tabs.map(tab => tab.attributes.get('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false'])
    expect(tabs.map(tab => tab.textContent)).toEqual(['Facts1', 'Preferences0', 'Instructions1', 'Timeline0', 'Relations1'])
    expect((byId('know-rows').children[0] as AppNode).textContent).toContain('Glue fact')
    tabs[2]!.fire('click')
    expect(byId('know-item-head').textContent).toBe('Instruction')
    const row = byId('know-rows').children[0] as AppNode
    expect((row.children[4] as AppNode).textContent).toBe('active')
    expect((byId('know-tabs').children as AppNode[]).map(tab => tab.attributes.get('aria-pressed'))).toEqual(['false', 'false', 'true', 'false', 'false'])
  })

  test('items 6 and 7: a Health forget goes through the shared forget; the focus moves to the next row, the new last row, then the heading', async () => {
    await app.loadHealthReport()
    const rows = () => byId('health-never').children as AppNode[]
    const label = (row: AppNode) => (row.children[0] as AppNode).textContent
    const lastFocus = () => focused.at(-1)
    // Three memories never recalled; the fourth too (its knowledge does not count as a recall).
    expect(rows().map(label)).toEqual(['fourth note, forgotten from Memories', 'third never recalled note', 'second never recalled note', 'first never recalled note'])
    const forget = async (index: number) => {
      const before = rows().length
      const target = rows()[index]!
      const [, ask, yes] = target.buttons()
      ask!.fire('click')
      yes!.fire('click')
      await until(() => rows().length === before - 1 && !rows().includes(target), 'the list to redraw')
    }
    const forgets = () => calls.filter(call => call.path === '/api/forget' && call.method === 'POST')

    // The second row: focus goes to the row that took its place.
    await forget(1)
    expect(rows().map(label)).toEqual(['fourth note, forgotten from Memories', 'second never recalled note', 'first never recalled note'])
    expect(lastFocus()).toBe(rows()[1]!.buttons()[0]!)
    expect(lastFocus()!.textContent).toBe('Review')
    expect(JSON.parse(forgets().at(-1)!.body)).toEqual({ memory_id: ids[2] })

    // The last row: focus goes to the new last row.
    await forget(2)
    expect(lastFocus()).toBe(rows()[1]!.buttons()[0]!)

    // The Memories tab's Forget goes through the same function and the same call.
    const before = forgets().length
    let result: string | undefined = 'pending'
    app.forgetMemory({ id: ids[3] }, (error?: string) => {
      result = error
    })
    await until(() => result !== 'pending', 'the Memories forget')
    expect(result).toBeUndefined()
    expect(forgets()).toHaveLength(before + 1)
    expect(JSON.parse(forgets().at(-1)!.body)).toEqual({ memory_id: ids[3] })
    expect((await realFetch(`http://127.0.0.1:${server.port}/api/memories/${ids[3]}`, { headers: { Authorization: `Bearer ${server.token}` } })).status).toBe(404)
    await app.loadHealthReport()
    expect(rows().map(label)).toEqual(['second never recalled note'])

    // The only row: the list is empty, so the heading takes the focus.
    await forget(0)
    expect(byId('health-never-box').hidden).toBe(true)
    expect(lastFocus()).toBe(byId('health-title'))
    // The page has one /api/forget call, and both tabs' forgets are it.
    const source = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    expect(source.match(/'\/api\/forget'/g)).toHaveLength(1)
    expect(source).toMatch(/forgetMemory = \(memory: Memory, done: \(error\?: string\) => void\) => forgetById\(memory\.id, done\)/)
    expect(source).toMatch(/const healthHost: HealthHost = \{[^}]*forget: forgetById/)
    expect(html).toMatch(/<h1 id="health-title" tabindex="-1">/)
  })

  test('item 3: a forget whose reload fails puts the focus on Try again, not the body', async () => {
    // A failed forget keeps the row and says why; nothing is redrawn.
    const fresh = body((await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(1, 'mnemopi_remember', { content: 'fifth note' })])).get(1)) as { memory_id: string }
    await app.loadHealthReport()
    const row = byId('health-never').children[0] as AppNode
    const [, ask, yes] = row.buttons()
    ask!.fire('click')
    mode = 'fail500'
    yes!.fire('click')
    await until(() => row.all().some(node => node.textContent === 'Forget failed: boom'), 'the failure text')
    mode = 'real'
    // A forget that succeeds but whose reload fails: the focus goes to Try again.
    const calledBefore = calls.length
    const original = globalThis.fetch
    ;(globalThis as Record<string, unknown>).fetch = async (path: string, init: RequestInit = {}) => {
      if (path === '/api/health-report') {
        calls.push({ path, method: 'GET', body: '' })
        return new Response('{}', { status: 503 })
      }
      return original(path, init)
    }
    try {
      yes!.fire('click')
      await until(() => byId('health-status').textContent === 'Could not load the health report: the server answered 503', 'the reload failure')
      expect(focused.at(-1)).toBe(byId('health-retry'))
      expect(calls.length).toBeGreaterThan(calledBefore)
    } finally {
      ;(globalThis as Record<string, unknown>).fetch = original
    }
    expect((await realFetch(`http://127.0.0.1:${server.port}/api/memories/${fresh.memory_id}`, { headers: { Authorization: `Bearer ${server.token}` } })).status).toBe(404)
  })
})
