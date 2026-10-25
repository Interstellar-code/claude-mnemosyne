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
import { buildGalaxy, GLOBAL_COLOUR } from '../../ui/map-state'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
/** The Map's project palette in the order buildGalaxy hands it out, read off a galaxy of 24 projects (so it wraps). */
const PALETTE = [
  ...new Set(
    buildGalaxy({ projects: Array.from({ length: 24 }, (_, i) => ({ owner: `p${String(i).padStart(2, '0')}`, label: '', count: 0, recalls: 0 })), memories: [], knowledge: [], meaning: false, total: 0, shown: 0 }).colours.values(),
  ),
]
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


  test('QAPAGE item 5: dashboard searches stay in the log (origin ui) but the health report does not count them as recalls', async () => {
    const total = async () => ((await (await get('/api/health-report')).json()) as { recallsPerDay: { count: number }[] }).recallsPerDay.reduce((sum, day) => sum + day.count, 0)
    const before = await total()
    const linesBefore = logLines().length
    for (const query of ['apple', 'durian', 'cherry', 'apple pie']) expect((await post('/api/search', { query })).status).toBe(200)
    const added = logLines().slice(linesBefore)
    expect(added.map(line => [line.action, line.origin])).toEqual([['recall', 'ui'], ['recall', 'ui'], ['recall', 'ui'], ['recall', 'ui']])
    expect(await total()).toBe(before)
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
    expect(what.textContent).toBe('you saidSaved: always use bun')
    const agent = row({ ...save, origin: 'tool', author_type: 'agent' })
    expect(((agent.children[4] as Node).children[0] as Node).className).toContain('prov-agent')
    // An old save and a recall have no badge, and the text is alone in the cell.
    for (const line of [save, { ...save, action: 'recall', author_type: 'human' }]) {
      const plain = row(line)
      expect(plain.children).toHaveLength(6)
      expect((plain.children[4] as Node).textContent).toBe((line as { action: string }).action === 'recall' ?'Recalled 1 for “always use bun”' : 'Saved: always use bun')
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
      // The server itself still answers /api/health (the page's check on a failed request), so these are tab failures, not a lost server.
      if (mode === 'throw' && path !== '/api/health') throw new TypeError('network down')
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
    await app.loadReview()
    expect(byId('review-status').textContent).toBe('Could not load the memories: network down')
    expect(byId('review-status').className).toContain('is-error')
    expect(byId('review-retry').hidden).toBe(false)
    expect(byId('review-body').hidden).toBe(true)
    // The page's global status line is left alone.
    expect(byId('status').textContent).toBe(globalStatus)

    mode = 'real'
    app.wireKnowledgeHealth()
    byId('know-retry').fire('click')
    byId('health-retry').fire('click')
    byId('review-retry').fire('click')
    await until(() => !byId('know-body').hidden && !byId('health-body').hidden && !byId('review-body').hidden, 'all three tabs to load')
    expect(byId('review-retry').hidden).toBe(true)
    expect(byId('review-status').hidden).toBe(true)
    expect(byId('know-retry').hidden).toBe(true)
    expect(byId('know-status').className).not.toContain('is-error')
    // The reply holds items, so the 'cannot say' sentence is hidden.
    expect(byId('know-status').hidden).toBe(true)
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

  test('items 6 and 7: a Review forget goes through the shared forget; the focus moves to the next row, the new last row, then the heading', async () => {
    await app.loadReview()
    const rows = () => byId('review-rows').children as AppNode[]
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
    expect(lastFocus()!.textContent).toBe('Open')
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
    await app.loadReview()
    expect(rows().map(label)).toEqual(['second never recalled note'])

    // The only row: the list is empty, so the heading takes the focus.
    await forget(0)
    expect(byId('review-box').hidden).toBe(true)
    expect(byId('review-text').textContent).toBe('Every memory has come back in a recall at least once.')
    expect(lastFocus()).toBe(byId('review-title'))
    // The page has one /api/forget call, and both tabs' forgets are it.
    const source = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    expect(source.match(/'\/api\/forget'/g)).toHaveLength(1)
    expect(source).toMatch(/forgetMemory = \(memory: Memory, done: \(error\?: string\) => void\) => forgetById\(memory\.id, done\)/)
    expect(source).toMatch(/const reviewHost: ReviewHost = \{[^}]*forget: forgetById/)
    expect(html).toMatch(/<h1 id="review-title" tabindex="-1">/)
    expect(html).toMatch(/<h1 id="health-title" tabindex="-1">/)
  })

  test('item 3: a forget whose reload fails puts the focus on Try again, not the body', async () => {
    // A failed forget keeps the row and says why; nothing is redrawn.
    const fresh = body((await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(1, 'mnemopi_remember', { content: 'fifth note' })])).get(1)) as { memory_id: string }
    await app.loadReview()
    const row = byId('review-rows').children[0] as AppNode
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
      if (path.startsWith('/api/memories')) {
        calls.push({ path, method: 'GET', body: '' })
        return new Response('{}', { status: 503 })
      }
      return original(path, init)
    }
    try {
      yes!.fire('click')
      await until(() => byId('review-status').textContent === 'Could not load the memories: the server answered 503', 'the reload failure')
      expect(focused.at(-1)).toBe(byId('review-retry'))
      expect(calls.length).toBeGreaterThan(calledBefore)
    } finally {
      ;(globalThis as Record<string, unknown>).fetch = original
    }
    expect((await realFetch(`http://127.0.0.1:${server.port}/api/memories/${fresh.memory_id}`, { headers: { Authorization: `Bearer ${server.token}` } })).status).toBe(404)
  })

  // ---- QAPAGE R1: the glue items, on the same stand-in document ----

  /** A memory of project-glue-1a2b with one fact and one instruction mined from it (real engine tools); its id. */
  async function memoryWithKnowledge(content: string) {
    const made = body((await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(1, 'mnemopi_remember', { content })])).get(1)) as { memory_id: string }
    const prompt = body((await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(2, 'mnemopi_knowledge_prompt', { memory_id: made.memory_id })])).get(2)) as { sha256: string }
    const reply = JSON.stringify({ facts: [`Fact of ${content}`], preferences: [], instructions: [`Rule of ${content}`], timelines: [], kg: [] })
    await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(3, 'mnemopi_knowledge_store', { memory_id: made.memory_id, reply, sha256: prompt.sha256 })])
    ids.push(made.memory_id)
    return made.memory_id
  }

  test('QAPAGE item 4: a project dot has its Map colour on the Knowledge and Health tabs, the same as buildGalaxy gives it', async () => {
    const owners = ['global', 'project-glue-1a2b', 'project-atlas-1a2b', 'project-borealis-3c4d', 'project-cobalt-5e6f']
    const galaxy = buildGalaxy({
      projects: owners.map(owner => ({ owner, label: owner, count: 1, recalls: 0 })),
      memories: owners.map((owner, i) => ({ id: `m${i}`, owner, tags: [], recalls: 0, lastRecalled: null, created: '2026-10-01T00:00:00.000Z', label: owner })),
      knowledge: [],
      meaning: false,
      total: owners.length,
      shown: owners.length,
    })
    await memoryWithKnowledge('colour check memory')
    app.useOwners(owners)
    const dotOf = (owner: string) => ((app.project(owner) as AppNode).children[0] as AppNode).className
    const expected = (owner: string) => (galaxy.colours.get(owner) === GLOBAL_COLOUR ? 'dot c-global' : `dot c${PALETTE.indexOf(galaxy.colours.get(owner)!)}`)
    // The QA's three projects, by the Map's rule: atlas orange (slot 2 of the sorted owners), borealis purple, cobalt teal.
    expect(owners.map(dotOf)).toEqual(owners.map(expected))
    expect(['project-atlas-1a2b', 'project-borealis-3c4d', 'project-cobalt-5e6f'].map(owner => galaxy.colours.get(owner))).toEqual(['#F0773A', '#9B7BE3', '#2FB3AE'])
    expect(dotOf('project-atlas-1a2b')).toBe('dot c1')
    // The tabs draw through the same function.
    await app.loadKnowledge()
    const knowledgeRow = byId('know-rows').children[0] as AppNode
    expect(((knowledgeRow.children[2] as AppNode).children[0] as AppNode).children[0]).toMatchObject({ className: expected('project-glue-1a2b') })
    await app.loadReview()
    const neverRow = byId('review-rows').children[0] as AppNode
    expect(((neverRow.children[1] as AppNode).children[0] as AppNode).children[0]).toMatchObject({ className: expected('project-glue-1a2b') })
    // A group label ("all projects") and an owner the store does not list are grey.
    expect(((app.project('all', 'project', 'all projects (3)') as AppNode).children[0] as AppNode).className).toBe('dot c-global')
    expect(dotOf('project-unlisted-9z9z')).toBe('dot c-global')
  })

  test('QAPAGE item 5: a dashboard search (origin ui) is not counted in Recalls today; Claude recalls are', () => {
    const t = new Date().toISOString()
    const recall = (origin: string, extra: Record<string, unknown> = {}) => ({ t, action: 'recall', origin, owner: 'global', text: 'q', ok: true, ...extra })
    app.feed.lines = [recall('hook'), recall('tool'), recall('external', { client: 'codex-mcp' }), recall('ui'), recall('ui'), recall('ui'), recall('ui'), recall('hook', { ok: false })]
    app.drawFeed()
    expect(byId('tile-recall').textContent).toBe('2')
    // The log lines themselves stay in the feed: the audit trail.
    expect((byId('act-list').children as AppNode[]).length).toBe(8)
    app.feed.lines = []
  })

  test('QAPAGE R2 item 1: the Activity tile counts the QA mix as 9 Claude recalls (the same lines tests/bun/health-report-api.spec.ts gives the server)', () => {
    const t = new Date().toISOString()
    const recall = (origin: string, extra: Record<string, unknown> = {}) => ({ t, action: 'recall', origin, owner: 'global', text: 'q', ids: [], count: 0, ok: true, ...extra })
    app.feed.lines = [
      ...[1, 2, 3, 4].map(() => recall('hook', { client: 'claude-code' })),
      ...[1, 2, 3].map(() => recall('tool', { client: 'claude-code' })),
      ...[1, 2].map(() => recall('trigger', { client: 'claude-code' })),
      recall('external', { client: 'codex-mcp-client' }),
      recall('external', { client: 'codex-mcp-client' }),
      ...[1, 2, 3, 4].map(() => recall('ui', { client: 'dashboard' })),
      recall('hook', { client: 'claude-code', ok: false }),
    ]
    app.drawFeed()
    expect(byId('tile-recall').textContent).toBe('9')
    app.feed.lines = []
  })

  test('QAPAGE item 7a: an outside client called Dashboard is "Dashboard (external)" in the App filter and the Source cell; the real dashboard and Codex keep their names', () => {
    const t = new Date().toISOString()
    const external = { t, action: 'recall', origin: 'external', client: 'Dashboard', owner: 'global', ok: true }
    const own = { t, action: 'recall', origin: 'ui', owner: 'global', ok: true }
    const codex = { t, action: 'recall', origin: 'external', client: 'codex-mcp', owner: 'global', ok: true }
    expect(app.appKey(external)).toBe('ext:Dashboard')
    expect(app.appKey(own)).toBe('Dashboard')
    expect(app.appOptions([external, own, codex]).map(app.appName)).toEqual(['Claude Code', 'Codex', 'Cursor', 'Dashboard', 'Dashboard (external)'])
    expect(app.originLabel(external)).toBe('Dashboard (external)')
    expect(app.originLabel(own)).toBe('dashboard')
    expect(app.originLabel(codex)).toBe('Codex')
    // Drawn: the drop-down has two entries, told apart, and the external line's Source cell says so.
    app.feed.lines = [external, own]
    app.drawFeed()
    expect(byId('act-app').children.map((option: AppNode | AppText) => option.textContent)).toEqual(['All', 'Claude Code', 'Codex', 'Cursor', 'Dashboard', 'Dashboard (external)'])
    expect((byId('act-list').children[0] as AppNode).textContent).toContain('Dashboard (external)')
    app.feed.lines = []
  })

  test('QAPAGE item 7b: the "Forgot memory" status goes when the tab changes', async () => {
    await memoryWithKnowledge('status check memory')
    await app.loadReview()
    const row = byId('review-rows').children[0] as AppNode
    const [, ask, yes] = row.buttons()
    ask!.fire('click')
    yes!.fire('click')
    await until(() => byId('status').textContent.startsWith('Forgot memory'), 'the forget status')
    app.show('search')
    expect(byId('status').textContent).toBe('Connected to the local Mnemosyne server.')
    expect(byId('status').className).toBe('status is-ok')
    // The same tab again leaves a message alone.
    ;(byId('status') as AppNode).textContent = 'something on search'
    app.show('search')
    expect(byId('status').textContent).toBe('something on search')
  })

  test('QAPAGE item 1: a newly selected star brings the inspector into view on a phone, a refresh of the same star and a wide screen do not', () => {
    expect(app.revealNeeded('', 'accessibility', true)).toBe(true)
    expect(app.revealNeeded('accessibility', 'accessibility', true)).toBe(false)
    expect(app.revealNeeded('accessibility', 'style', true)).toBe(true)
    expect(app.revealNeeded('style', '', true)).toBe(false)
    expect(app.revealNeeded('', 'accessibility', false)).toBe(false)
  })
})

// QAPAGE R1: the page itself, without a browser: the served markup read as a tree (Bun's HTMLRewriter),
// the stylesheet parsed into rules and media queries, and the layout rules applied to that tree by a small
// cascade (class/id/tag selectors, specificity, source order). It answers what the rules SAY; only a
// real browser can say how they LOOK (the orchestrator's browser QA re-runs that).
type Rule = { media: string | null; selector: string; decls: Record<string, string> }

function parseCss(css: string): Rule[] {
  const rules: Rule[] = []
  const walk = (text: string, media: string | null) => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf('{', i)
      if (open < 0) break
      const prelude = text.slice(i, open).trim()
      let depth = 1
      let j = open + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        j++
      }
      const inner = text.slice(open + 1, j - 1)
      if (prelude.startsWith('@media')) walk(inner, prelude.slice(6).trim())
      else if (!prelude.startsWith('@')) {
        const decls: Record<string, string> = {}
        for (const part of inner.split(';')) {
          const colon = part.indexOf(':')
          if (colon > 0) decls[part.slice(0, colon).trim()] = part.slice(colon + 1).trim()
        }
        for (const selector of prelude.split(',')) rules.push({ media, selector: selector.trim(), decls })
      }
      i = j
    }
  }
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), null)
  return rules
}

type PageNode = { tag: string; id: string; classes: string[]; open: boolean; children: PageNode[]; parent: PageNode | null }

async function pageTree(html: string): Promise<PageNode> {
  const root: PageNode = { tag: '#root', id: '', classes: [], open: false, children: [], parent: null }
  let at = root
  const VOID = new Set(['meta', 'link', 'input', 'br', 'img', 'hr'])
  await new HTMLRewriter()
    .on('*', {
      element(element) {
        const node: PageNode = { tag: element.tagName, id: element.getAttribute('id') ?? '', classes: (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean), open: element.hasAttribute('open'), children: [], parent: at }
        at.children.push(node)
        if (VOID.has(element.tagName)) return
        at = node
        element.onEndTag(() => {
          at = node.parent!
        })
      },
    })
    .transform(new Response(html))
    .text()
  return root
}

const allNodes = (node: PageNode): PageNode[] => [node, ...node.children.flatMap(allNodes)]
const byIdIn = (root: PageNode, id: string) => allNodes(root).find(node => node.id === id)!
const hasAncestor = (node: PageNode, test: (n: PageNode) => boolean): boolean => node.parent !== null && (test(node.parent) || hasAncestor(node.parent, test))

/** Whether a simple selector (tag, .class and #id parts, no combinators) matches a node; its specificity, or null. */
function specificity(selector: string, node: PageNode): number | null {
  if (/[\s>+~:\[]/.test(selector)) return null
  const parts = selector.match(/[.#]?[A-Za-z0-9_-]+/g) ?? []
  if (parts.join('') !== selector) return null
  let score = 0
  for (const part of parts) {
    if (part.startsWith('#')) {
      if (node.id !== part.slice(1)) return null
      score += 100
    } else if (part.startsWith('.')) {
      if (!node.classes.includes(part.slice(1))) return null
      score += 10
    } else {
      if (node.tag !== part) return null
      score += 1
    }
  }
  return score
}

/** The value of a property on a node: the winning declaration (highest specificity, then latest) among the rules whose media is in `active`. */
function styleOf(node: PageNode, rules: Rule[], property: string, active: string[]): string | undefined {
  let best: { score: number; at: number; value: string } | undefined
  rules.forEach((rule, at) => {
    if (rule.media !== null && !active.includes(rule.media)) return
    const value = rule.decls[property]
    const score = specificity(rule.selector, node)
    if (value === undefined || score === null) return
    if (best === undefined || score > best.score || (score === best.score && at > best.at)) best = { score, at, value }
  })
  return best?.value
}

/** The boxes of a flex container in their visual order: display:contents children give their own children, out-of-flow ones are left out, then `order`, then the page order. */
function flowOf(container: PageNode, rules: Rule[], active: string[]): string[] {
  const items: PageNode[] = []
  const take = (node: PageNode) => {
    for (const child of node.children) {
      if (styleOf(child, rules, 'display', active) === 'contents') take(child)
      else if (styleOf(child, rules, 'display', active) !== 'none' && styleOf(child, rules, 'position', active) !== 'absolute') items.push(child)
    }
  }
  take(container)
  return items
    .map((node, at) => ({ node, at, order: Number(styleOf(node, rules, 'order', active) ?? 0) }))
    .sort((a, b) => a.order - b.order || a.at - b.at)
    .map(({ node }) => node.id || node.classes[0] || node.tag)
}

const PHONE = '(max-width: 900px)'
const SMALL = '(max-width: 760px)'

describe('QAPAGE R1: the page, read as a tree and a stylesheet', () => {
  const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
  const rules = parseCss(readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8'))
  let tree: PageNode
  beforeAll(async () => {
    tree = await pageTree(html)
  })

  test('item 1: on a phone the canvas is first, 60vh tall, with the selection card right under it; wide screens keep the three columns', () => {
    const view = byIdIn(tree, 'view-map')
    // The markup the order rules rely on: the stage and the selection card live in .map-centre; the Overview, Live and the legend in .map-side.
    expect(view.children.map(node => node.id || node.classes[0] || node.tag)).toEqual(['sr-only', 'map-rail', 'map-centre', 'map-side', 'map-back'])
    expect(byIdIn(tree, 'map-stage').parent!.classes).toContain('map-centre')
    expect(byIdIn(tree, 'map-inspector').parent!.classes).toContain('map-centre')
    for (const id of ['map-overview', 'map-live-strip', 'map-legend']) expect(byIdIn(tree, id).parent!.classes).toContain('map-side')
    // The legend and the rail cards fold; the legend starts closed and Layout and Colour by start open.
    expect(byIdIn(tree, 'map-legend').tag).toBe('details')
    expect(byIdIn(tree, 'map-legend').open).toBe(false)
    expect(byIdIn(tree, 'map-card-layout').open).toBe(true)
    expect(byIdIn(tree, 'map-card-colour').open).toBe(true)
    for (const id of ['map-card-links', 'map-card-know', 'map-card-layers', 'map-card-projects']) expect(byIdIn(tree, id).open).toBe(false)
    // 900px and narrower: one column, the canvas first, then the Back link and the selection card, the Overview, the live card, the legend, the rail's controls.
    expect(flowOf(view, rules, [PHONE])).toEqual(['map-stage', 'map-back', 'map-inspector', 'map-overview', 'map-live-strip', 'map-legend', 'map-rail'])
    expect(styleOf(view, rules, 'flex-direction', [PHONE])).toBe('column')
    expect(styleOf(view, rules, 'flex-wrap', [PHONE])).toBe('nowrap')
    const stage = byIdIn(tree, 'map-stage')
    expect(styleOf(stage, rules, 'height', [PHONE])).toBe('60vh')
    expect(styleOf(stage, rules, 'max-height', [PHONE])).toBe('none')
    // On the QA's 390x844 phone: 60vh is 506px, so the canvas ends well above the fold of a 844px screen once the header (about 150px) is counted.
    expect(Math.round(0.6 * 844)).toBe(506)
    // Wide screens: rail, centre (graph, then the selection card) and the side column in a row; the stage fills the window, never under 540px.
    expect(flowOf(view, rules, [])).toEqual(['map-rail', 'map-centre', 'map-side'])
    // The Back link is hidden outside the phone query, and starts hidden in the markup.
    expect(styleOf(byIdIn(tree, 'map-back'), rules, 'display', [])).toBe('none')
    expect(styleOf(view, rules, 'flex-direction', [])).toBeUndefined()
    expect(styleOf(stage, rules, 'height', [])).toBe('max(540px, calc(100vh - 150px))')
    expect(styleOf(byIdIn(tree, 'map-inspector'), rules, 'order', [])).toBeUndefined()
    expect(rules.filter(rule => rule.media === null && 'order' in rule.decls)).toEqual([])
    // Nothing inside the phone query reaches a wide screen: every rule it holds is in that one media query.
    expect(rules.some(rule => rule.media === PHONE && rule.selector === '.map-centre' && rule.decls.display === 'contents')).toBe(true)
  })

  test('item 2: the review table fits its card (min-width 0, the .table 720px is overridden) and the lists in a card size to their rows', () => {
    const never = allNodes(tree).find(node => node.tag === 'table' && node.classes.includes('compact'))!
    expect(hasAncestor(never, node => node.id === 'review-box')).toBe(true)
    expect(styleOf({ ...never, classes: ['table'] }, rules, 'min-width', [])).toBe('720px')
    expect(styleOf(never, rules, 'min-width', [])).toBe('0')
    // The stretched chart card: the Projects and Storage lists are .list inside a .card; .list alone has a 640px flex basis (the Memories list).
    expect(rules.find(rule => rule.selector === '.list' && rule.decls.flex !== undefined)?.decls.flex).toBe('999 1 640px')
    for (const id of ['health-projects', 'health-storage']) {
      const list = byIdIn(tree, id)
      expect(list.classes).toContain('list')
      expect(hasAncestor(list, node => node.classes.includes('card'))).toBe(true)
    }
    expect(rules.find(rule => rule.selector === '.card .list')?.decls.flex).toBe('none')
    // The actions column keeps its two links on one line (nowrap), and only the confirm step wraps.
    expect(rules.find(rule => rule.selector === '.row-actions')?.decls['white-space']).toBe('nowrap')
  })

  test('item 3: on a small screen a Knowledge row is a card: the kind and item, topic and project, then Status, Used and Last used share one line', () => {
    const phone = rules.filter(rule => rule.media === SMALL)
    const of = (selector: string) => phone.find(rule => rule.selector === selector)?.decls
    expect(of('.know-table thead')?.display).toBe('none')
    expect(of('.know-table')?.['min-width']).toBe('0')
    expect(of('.know-table tr')?.display).toBe('grid')
    expect(of('.know-table tr')?.['grid-template-columns']).toBe('repeat(4, minmax(0, 1fr))')
    expect(of('.know-table td')?.display).toBe('block')
    expect(of('.know-table td[data-label]::before')?.content).toBe('attr(data-label)')
    const span = (cell: string) => Number(/^span (\d)$/.exec(of(`.know-table td.k-${cell}`)?.['grid-column'] ?? '')?.[1])
    // Status 1 + Used 2 + Last used 1 = the 4 columns of one grid row; topic 2 + project 2 likewise.
    expect(span('status') + span('used') + span('last')).toBe(4)
    expect(span('topic') + span('project')).toBe(4)
    expect(of('.know-table td.k-text')?.['grid-column']).toBe('1 / -1')
    expect(of('.know-table td.k-from')?.order).toBe('9')
    // Wide screens: no card rule outside the query.
    expect(rules.filter(rule => rule.media === null && rule.selector.includes('.know-table'))).toEqual([])
    // The served table carries the class the rules hang on.
    const table = allNodes(tree).find(node => node.tag === 'table' && node.classes.includes('know-table'))!
    expect(hasAncestor(table, node => node.id === 'know-body')).toBe(true)
  })

  test('item 4: the dot classes paint the Map palette: .c0 to .c7 are PALETTE in order and .c-global is the Map grey', () => {
    // The dot rules use variables now (dark mode): resolve a var(--x) through the plain fallback palette in :root.
    const sheet = readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')
    const tokens = new Map([...sheet.slice(0, sheet.indexOf('@supports')).matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()] as const))
    const colour = (cls: string) => {
      const value = rules.find(rule => rule.selector === `.${cls}`)?.decls.background
      const variable = /^var\(--([\w-]+)\)$/.exec(value ?? '')
      return (variable ? tokens.get(variable[1]!) : value)?.toUpperCase()
    }
    expect(PALETTE).toHaveLength(8)
    expect(PALETTE[0]).toBe('#4C8DDB')
    expect(PALETTE.map((_, i) => colour(`c${i}`))).toEqual(PALETTE.map(hex => hex.toUpperCase()))
    expect(colour('c-global')).toBe(GLOBAL_COLOUR.toUpperCase())
  })

  test('item 7c, 7d: the Overview\'s lone colour dot is hidden, and an inspector field never gets narrower than 120px nor breaks inside a word', () => {
    expect(rules.find(rule => rule.selector === '.insp-sub > .map-dot:only-child')?.decls.display).toBe('none')
    expect(rules.find(rule => rule.selector === '.insp-stats')?.decls['grid-template-columns']).toBe('repeat(auto-fit, minmax(min(100%, 120px), 1fr))')
    expect(rules.find(rule => rule.selector === '.insp-stats dd')?.decls['overflow-wrap']).toBe('break-word')
    // The real numbers: a 252px-wide inspector body holds two 120px fields and a 12px gap (120 + 12 + 120 = 252); a narrower one stacks them.
    const fields = (width: number) => Math.max(1, Math.floor((width + 12) / (120 + 12)))
    expect([fields(264), fields(252), fields(204)]).toEqual([2, 2, 1])
  })

  test('QAPAGE R2 item 2: the content is centred up to 1280px, and the Health project cell keeps its name whole (no wrap, ellipsis when long)', () => {
    const wide = rules.find(rule => rule.selector === '.wide')!.decls
    expect(wide['max-width']).toBe('1280px')
    expect(wide['margin-left']).toBe('auto')
    expect(wide['margin-right']).toBe('auto')
    // Real numbers: at 1440px the 1280px column leaves 80px each side instead of ~240px on the right.
    expect((1440 - 1280) / 2).toBe(80)
    const never = allNodes(tree).find(node => node.tag === 'table' && node.classes.includes('compact'))!
    expect(hasAncestor(never, node => node.classes.includes('wide'))).toBe(true)
    expect(rules.find(rule => rule.selector === '.table.compact .project')?.decls['white-space']).toBe('nowrap')
    expect(rules.find(rule => rule.selector === '.table.compact td.col-project')?.decls['min-width']).toBe('120px')
    expect(rules.find(rule => rule.selector === '.table.compact .project > span:last-child')?.decls['text-overflow']).toBe('ellipsis')
    // No rule lets the project name break inside a word.
    expect(rules.filter(rule => rule.selector.includes('.project') && rule.decls['overflow-wrap'] === 'anywhere')).toEqual([])
  })

  test('QAPAGE R2 item 3: on a phone the Find box sits above the canvas, and the inspector has a Back to the map button', () => {
    // All the phone rules of one selector, merged in order.
    const of = (selector: string) => Object.assign({}, ...rules.filter(rule => rule.media === PHONE && rule.selector === selector).map(rule => rule.decls)) as Record<string, string>
    // The strip is the stage's own margin: the Find box (36px high) is placed 46px above the stage box, so it never covers a star.
    expect(of('.stage')?.['margin-top']).toBe('46px')
    expect(of('.stage')?.overflow).toBe('visible')
    expect(of('.stage-find')?.top).toBe('-46px')
    expect(of('.stage-canvas')?.overflow).toBe('hidden')
    expect(36 + 10).toBe(46)
    // Wide screens keep the Find box over the canvas, top right.
    expect(rules.find(rule => rule.selector === '.stage-find' && rule.media === null)?.decls.top).toBe('14px')
    // The button: in the markup right before the inspector, hidden until it has content (app.ts), shown on a phone only.
    const back = byIdIn(tree, 'map-back')
    expect(back.tag).toBe('button')
    expect(back.parent!.id).toBe('view-map')
    expect(of('.back-to-map')?.display).toBe('inline-flex')
    expect(styleOf(back, rules, 'display', [])).toBe('none')
    expect(styleOf(back, rules, 'display', [PHONE])).toBe('inline-flex')
  })

  test('QAPAGE R2 item 4: on a phone the Knowledge topic and project cells share one centred 20px line', () => {
    const of = (selector: string) => Object.assign({}, ...rules.filter(rule => rule.media === SMALL && rule.selector === selector).map(rule => rule.decls)) as Record<string, string>
    for (const cell of ['.know-table td.k-topic', '.know-table td.k-project']) {
      expect(of(cell).display).toBe('flex')
      expect(of(cell)['align-items']).toBe('center')
      expect(of(cell)['line-height']).toBe('20px')
      expect(of(cell)['min-height']).toBe('20px')
    }
    expect(of('.know-table td.k-project .project')?.['line-height']).toBe('20px')
  })

  test('items 5 and 7a: the Activity tile reads "Claude recalls today" and Health says "Claude recalls"', () => {
    expect(html).toContain('<div class="tile-label">Claude recalls today</div>')
    expect(html).toContain('Claude recalls per day, last 14 days')
    expect(html).toContain('Searching here does not count as a recall.')
  })
})

// ---- DARK: the colour tokens, the contrast of both themes, and the theme switch ----

describe('DARK: ui/style.css tokens and contrast', () => {
  const css = readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const fallbackBlock = /:root \{([\s\S]*?)\n\}/.exec(css)![1]!
  const supportsBlock = css.slice(css.indexOf('@supports'))
  const norm = (value: string) => value.replace(/\s+/g, '').toLowerCase()
  const fallback = new Map([...fallbackBlock.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()] as const))
  const pairs = new Map(
    [...supportsBlock.matchAll(/--([\w-]+):\s*light-dark\(\s*(#[0-9A-Fa-f]{6}|rgba?\([^)]*\))\s*,\s*(#[0-9A-Fa-f]{6}|rgba?\([^)]*\))\s*\);/g)].map(m => [m[1]!, { light: m[2]!, dark: m[3]! }] as const),
  )

  test('the dark palette has one light-dark() pair per themed token, and its light half equals the plain fallback', () => {
    expect(pairs.size).toBeGreaterThanOrEqual(30)
    for (const [name, pair] of pairs) {
      expect(fallback.has(name)).toBe(true)
      expect(norm(fallback.get(name)!)).toBe(norm(pair.light))
    }
    expect(css).toContain('color-scheme: light dark')
    expect(css).toContain(':root[data-theme="light"] { color-scheme: light; }')
    expect(css).toContain(':root[data-theme="dark"] { color-scheme: dark; }')
  })

  test('every var(--x) in the stylesheet is defined, and no literal colour is left outside the token blocks', () => {
    const defined = new Set([...fallback.keys()])
    const used = new Set([...css.matchAll(/var\(--([\w-]+)/g)].map(m => m[1]!))
    expect([...used].filter(name => !defined.has(name))).toEqual([])
    const rest = css.slice(css.indexOf('@supports'))
    const afterTokens = rest.slice(rest.indexOf(':root[data-theme="dark"]'))
    const outside = afterTokens.slice(afterTokens.indexOf('}\n') + 2)
    expect(outside.match(/#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\)/g) ?? []).toEqual([])
  })

  const hex = (colour: string) => [1, 3, 5].map(i => parseInt(colour.slice(i, i + 2), 16))
  const luminance = (colour: string) => {
    const [r, g, b] = hex(colour).map(v => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
    return (hi + 0.05) / (lo + 0.05)
  }
  // text token on the surface it is drawn on
  const TEXT_ON: [string, string][] = [
    ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['accent', 'surface'], ['accent', 'bg'],
    ['accent', 'accent-soft'], ['blue-ink', 'blue-soft'], ['violet-ink', 'violet-soft'], ['amber-ink', 'amber-soft'],
    ['amber-ink', 'surface'], ['danger-ink', 'danger-soft'], ['danger-ink', 'surface'], ['notice-ink', 'notice-bg'],
    ['on-accent', 'accent'], ['on-danger', 'danger'], ['text', 'fill'], ['text', 'hover'], ['muted', 'fill'], ['text', 'mark'],
    ['accent', 'hover'], ['text', 'surface-2'], ['text', 'surface-3'],
  ]
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: every text colour reaches 4.5:1 on the surface it is drawn on`, () => {
      const low = TEXT_ON.map(([fg, bg]) => {
        const get = (name: string) => (pairs.get(name)?.[theme] ?? fallback.get(name)!)
        return { fg, bg, ratio: ratio(get(fg), get(bg)) }
      }).filter(row => row.ratio < 4.5)
      expect(low.map(row => `${row.fg} on ${row.bg}: ${row.ratio.toFixed(2)}`)).toEqual([])
    })
  }
})

describe('DARK: the theme switch', () => {
  const root = () => {
    const attributes = new Map<string, string>()
    return { attributes, setAttribute: (name: string, value: string) => void attributes.set(name, value), removeAttribute: (name: string) => void attributes.delete(name) }
  }
  const button = () => {
    const attributes = new Map<string, string>()
    let click: () => void = () => {}
    return { textContent: '' as string | null, attributes, setAttribute: (name: string, value: string) => void attributes.set(name, value), addEventListener: (_type: 'click', listener: () => void) => void (click = listener), press: () => click() }
  }

  test('modes: garbage and no value are Auto; a press cycles Auto, Light, Dark; the label says what a press does', async () => {
    const { themeMode, nextTheme, themeButtonLabel, themeButtonText } = await import('../../ui/theme')
    expect(themeMode(null)).toBe('auto')
    expect(themeMode('purple')).toBe('auto')
    expect(themeMode('dark')).toBe('dark')
    expect(nextTheme('auto')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('auto')
    expect(themeButtonLabel('auto')).toBe('Theme: Auto. Press for Light.')
    expect(themeButtonLabel('dark')).toBe('Theme: Dark. Press for Auto.')
    expect(themeButtonText('light')).toBe('Theme: Light')
  })

  test('startTheme applies the stored mode, sets and clears data-theme on each press, and saves the choice', async () => {
    const { startTheme, THEME_KEY } = await import('../../ui/theme')
    const data = new Map<string, string>([[THEME_KEY, 'dark']])
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
    const r = root()
    const b = button()
    const mode = startTheme(b, r, storage)
    expect(mode()).toBe('dark')
    expect(r.attributes.get('data-theme')).toBe('dark')
    expect(b.textContent).toBe('Theme: Dark')
    expect(b.attributes.get('aria-label')).toBe('Theme: Dark. Press for Auto.')
    b.press()
    expect(mode()).toBe('auto')
    expect(r.attributes.has('data-theme')).toBe(false)
    expect(data.get(THEME_KEY)).toBe('auto')
    b.press()
    expect(r.attributes.get('data-theme')).toBe('light')
    expect(data.get(THEME_KEY)).toBe('light')
  })

  test('a garbage stored value falls back to Auto, and a throwing or missing storage does not break the switch', async () => {
    const { startTheme, THEME_KEY } = await import('../../ui/theme')
    const garbage = { getItem: () => 'purple', setItem: () => {} }
    const r1 = root()
    expect(startTheme(button(), r1, garbage)()).toBe('auto')
    expect(r1.attributes.has('data-theme')).toBe(false)
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    const r2 = root()
    const b = button()
    const mode = startTheme(b, r2, throwing)
    expect(mode()).toBe('auto')
    b.press()
    expect(mode()).toBe('light')
    expect(r2.attributes.get('data-theme')).toBe('light')
    const r3 = root()
    const b3 = button()
    const m3 = startTheme(b3, r3, undefined)
    b3.press()
    expect(m3()).toBe('light')
    expect(THEME_KEY).toBe('mnemosyne.theme')
  })

  test('the page has the theme button in the header, and the script that starts it is the module the page loads', () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const header = html.slice(html.indexOf('<header class="top">'), html.indexOf('</header>'))
    expect(header).toContain('<button id="theme" type="button" class="theme-btn">')
    expect(readFileSync(join(ROOT, 'ui', 'tsconfig.json'), 'utf8')).toContain('"theme.ts"')
  })
})
