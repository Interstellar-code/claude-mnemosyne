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
import { initVocabulary, recordCandidates } from '../../bin/vocab'
import { CSP, mergeHits, PREVIEW_CHARS, startServer } from '../../ui/server'
import { buildGalaxy, GLOBAL_COLOUR } from '../../ui/map-state'
import type { Started } from '../../ui/server'
import { body, engineCall, isolatedEnv, ROOT, tempDir, toolCall } from './helpers'

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
      expect(Object.keys(memory).sort()).toEqual(['id', 'importance', 'last_recalled', 'metadata', 'owner', 'preview', 'recall_count', 'scope', 'state', 'tags', 'timestamp', 'truncated'])
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
    value = ''
    checked = false
    placeholder = ''
    maxLength = 0
    rows = 0
    min = ''
    max = ''
    step = ''
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

  test('items 6 and 7: a Review retire asks the server once per confirm; the focus moves to the next row, the new last row, then the heading; the Memories forget is still the one /api/forget', async () => {
    await app.loadReview()
    const rows = () => byId('review-rows').children as AppNode[]
    const label = (row: AppNode) => (row.children[0] as AppNode).textContent
    const lastFocus = () => focused.at(-1)
    // Three memories never recalled; the fourth too (its knowledge does not count as a recall).
    expect(rows().map(label)).toEqual(['fourth note, forgotten from Memories', 'third never recalled note', 'second never recalled note', 'first never recalled note'])
    const retires = () => calls.filter(call => call.path === '/api/memory/retire' && call.method === 'POST')
    expect(retires()).toHaveLength(0)
    const retire = async (index: number) => {
      const before = rows().length
      const target = rows()[index]!
      const [, ask, yes] = target.buttons()
      expect(ask!.textContent).toBe('Retire…')
      ask!.fire('click')
      // Opening the confirm asks nothing.
      expect(retires().length).toBe(0 + retiredSoFar)
      yes!.fire('click')
      await until(() => rows().length === before - 1 && !rows().includes(target), 'the list to redraw')
      retiredSoFar += 1
    }
    let retiredSoFar = 0

    // The second row: one call for that memory, no replacement; focus goes to the row that took its place.
    await retire(1)
    expect(rows().map(label)).toEqual(['fourth note, forgotten from Memories', 'second never recalled note', 'first never recalled note'])
    expect(lastFocus()).toBe(rows()[1]!.buttons()[0]!)
    expect(lastFocus()!.textContent).toBe('Open')
    expect(retires()).toHaveLength(1)
    expect(JSON.parse(retires().at(-1)!.body)).toEqual({ memory_id: ids[2] })

    // The last row: focus goes to the new last row.
    await retire(2)
    expect(lastFocus()).toBe(rows()[1]!.buttons()[0]!)
    expect(retires()).toHaveLength(2)

    // The Memories tab's Forget goes through the shared function and the one /api/forget call.
    const forgets = () => calls.filter(call => call.path === '/api/forget' && call.method === 'POST')
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
    // The two retired rows are not live, so the four filters leave them out.
    await app.loadReview()
    expect(rows().map(label)).toEqual(['second never recalled note'])

    // The only row: the list is empty, so the heading takes the focus.
    await retire(0)
    expect(byId('review-box').hidden).toBe(true)
    expect(byId('review-text').textContent).toBe('Every memory has come back in a recall at least once.')
    expect(lastFocus()).toBe(byId('review-title'))
    expect(retires()).toHaveLength(3)

    // The page has one /api/forget call and one /api/memory/retire call; Forget is no longer in the Review host.
    const source = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    expect(source.match(/'\/api\/forget'/g)).toHaveLength(1)
    expect(source.match(/'\/api\/memory\/retire'/g)).toHaveLength(1)
    expect(source).toMatch(/forgetMemory = \(memory: Memory, done: \(error\?: string\) => void\) => forgetById\(memory\.id, done\)/)
    expect(source).toMatch(/const reviewHost: ReviewHost = \{[^}]*retire: \(id, replacedBy, done\) => retireById\(id, replacedBy, done\)/)
    expect(source).not.toMatch(/const reviewHost: ReviewHost = \{[^}]*forget/)
    expect(html).toMatch(/<h1 id="review-title" tabindex="-1">/)
    expect(html).toMatch(/<h1 id="health-title" tabindex="-1">/)
  })

  test('the Retire candidates and Not live lists: /api/review is read once per tab open, a filter change asks nothing, retire moves a row to Not live, Restore moves it back', async () => {
    const reviews = () => calls.filter(call => call.path === '/api/review')
    const before = reviews().length
    await app.loadReview()
    expect(reviews()).toHaveLength(before + 1)
    const buttons = () => (byId('review-filters').children as AppNode[]).map(button => button)
    const pick = (name: string) => buttons().find(button => button.dataset.filter === name)!.fire('click')
    pick('retire')
    pick('notlive')
    pick('never')
    pick('retire')
    // Changing the filter drew from the page's copy: no second call.
    expect(reviews()).toHaveLength(before + 1)
    // The earlier test retired three rows, so Not live lists them, each with its mark and one audit line.
    pick('notlive')
    const notLive = () => byId('review-notlive-rows').children as AppNode[]
    expect(notLive().length).toBeGreaterThanOrEqual(3)
    expect(byId('review-notlive-box').hidden).toBe(false)
    expect(byId('review-box').hidden).toBe(true)
    const mark = (row: AppNode) => (row.children[2] as AppNode).textContent
    expect(notLive().every(row => mark(row).startsWith('retired'))).toBe(true)
    expect((notLive()[0]!.children[3] as AppNode).textContent).toMatch(/^retired by dashboard, \d{4}-\d{2}-\d{2}$/)
    expect(byId('review-text').textContent).toContain('not live')
    // Restore: one call for that memory; after the server's answer the row is gone from Not live and live again in the four filters.
    const target = notLive()[0]!
    const restoreId = target.dataset.id!
    const restores = () => calls.filter(call => call.path === '/api/memory/restore' && call.method === 'POST')
    const count = restores().length
    target.all().find(node => node.textContent === 'Restore')!.fire('click')
    await until(() => !notLive().includes(target), 'the row to leave Not live')
    expect(restores()).toHaveLength(count + 1)
    expect(JSON.parse(restores().at(-1)!.body)).toEqual({ memory_id: restoreId })
    expect(reviews()).toHaveLength(before + 1)
    const live = (await (await realFetch(`http://127.0.0.1:${server.port}/api/memories/${restoreId}`, { headers: { Authorization: `Bearer ${server.token}` } })).json()) as { state: string }
    expect(live.state).toBe('live')
    pick('never')
    expect((byId('review-rows').children as AppNode[]).some(row => row.dataset.id === restoreId)).toBe(true)
    // A new tab open reads the queue again.
    await app.loadReview()
    expect(reviews()).toHaveLength(before + 2)
  })

  test('item 3: a failed retire keeps the row and says why (the server\'s words); the retry succeeds and the row leaves', async () => {
    const fresh = body((await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(1, 'mnemopi_remember', { content: 'fifth note' })])).get(1)) as { memory_id: string }
    await app.loadReview()
    const pickNever = () => (byId('review-filters').children as AppNode[]).find(button => button.dataset.filter === 'never')!.fire('click')
    pickNever()
    const row = (byId('review-rows').children as AppNode[]).find(node => node.dataset.id === fresh.memory_id)!
    const [, ask, yes] = row.buttons()
    ask!.fire('click')
    mode = 'fail500'
    yes!.fire('click')
    await until(() => row.all().some(node => node.textContent === 'Retire failed: boom'), 'the failure text')
    mode = 'real'
    // Nothing changed on the server: the memory is still live, and still in the list.
    const state = async () => ((await (await realFetch(`http://127.0.0.1:${server.port}/api/memories/${fresh.memory_id}`, { headers: { Authorization: `Bearer ${server.token}` } })).json()) as { state: string }).state
    expect(await state()).toBe('live')
    expect((byId('review-rows').children as AppNode[]).includes(row)).toBe(true)
    // A refusal from the server shows its own message.
    yes!.fire('click')
    await until(() => !(byId('review-rows').children as AppNode[]).includes(row), 'the row to leave after the retry')
    expect(await state()).toBe('retired')
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

  test('QAPAGE item 7b: the "Retired memory" status goes when the tab changes', async () => {
    await memoryWithKnowledge('status check memory')
    await app.loadReview()
    ;(byId('review-filters').children as AppNode[]).find(button => button.dataset.filter === 'never')!.fire('click')
    const row = byId('review-rows').children[0] as AppNode
    const [, ask, yes] = row.buttons()
    ask!.fire('click')
    yes!.fire('click')
    await until(() => byId('status').textContent.startsWith('Retired memory'), 'the retire status')
    app.show('search')
    expect(byId('status').textContent).toBe('Connected to the local Mnemosyne server.')
    expect(byId('status').className).toBe('status is-ok')
    // The same tab again leaves a message alone.
    ;(byId('status') as AppNode).textContent = 'something on search'
    app.show('search')
    expect(byId('status').textContent).toBe('something on search')
  })

  test('CRUD.2: the Memories tab hides retired rows by default; Show retired shows them dimmed with their state; the toggle is this viewer\'s setting', async () => {
    const made = body((await engineCall(CLI, store, 'project-glue-1a2b', [toolCall(1, 'mnemopi_remember', { content: 'retired for the toggle test' })])).get(1)) as { memory_id: string }
    const retired = await realFetch(`http://127.0.0.1:${server.port}/api/memory/retire`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}`, 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${server.port}` },
      body: JSON.stringify({ memory_id: made.memory_id }),
    })
    expect(retired.status).toBe(200)
    // The viewer's own storage: a stand-in that remembers, and then one that throws.
    const stored = new Map<string, string>()
    const g = globalThis as Record<string, unknown>
    const savedStorage = g.localStorage
    g.localStorage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => void stored.set(key, value) }
    try {
      app.wireShowRetired()
      expect((byId('mem-retired') as AppNode).checked).toBe(false)
      await app.loadMemories()
      const shown = () => (byId('mem-rows').children as AppNode[]).map(row => row.dataset.id)
      expect(shown()).not.toContain(made.memory_id)
      expect(byId('mem-count').textContent).toMatch(/^Showing \d+ of \d+ \(\d+ not live, hidden: turn on Show retired to see (it|them)\)$/)
      // On: the row shows, dimmed, with its state in words in front of its text.
      const toggle = byId('mem-retired') as AppNode
      toggle.checked = true
      toggle.fire('change')
      expect(shown()).toContain(made.memory_id)
      const row = (byId('mem-rows').children as AppNode[]).find(node => node.dataset.id === made.memory_id)!
      expect(row.className).toBe('row is-dim')
      expect((row.children[0] as AppNode).textContent).toStartWith('retired retired for the toggle test')
      expect(byId('mem-count').textContent).not.toContain('hidden')
      expect(stored.get('mnemosyne.memories.showRetired')).toBe('1')
      // A live row has neither the dimming nor a state word.
      const live = (byId('mem-rows').children as AppNode[]).find(node => node.className === 'row')
      expect(live).toBeDefined()
      // Off again: hidden, and remembered as off.
      toggle.checked = false
      toggle.fire('change')
      expect(shown()).not.toContain(made.memory_id)
      expect(stored.get('mnemosyne.memories.showRetired')).toBe('0')
      // A storage that throws is only a lost convenience.
      g.localStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
      toggle.checked = true
      expect(() => toggle.fire('change')).not.toThrow()
      expect(shown()).toContain(made.memory_id)
      toggle.checked = false
      toggle.fire('change')
    } finally {
      g.localStorage = savedStorage
    }
  })

  test('CRUD.2: a not-live row says its state; the detail sheet has Edit and keeps Forget (the only place that deletes); an older reply with no state reads as live', () => {
    const note = (state?: string) => ({ id: 'm1', owner: 'project-glue-1a2b', preview: 'a note', importance: 0.5, recall_count: 0, last_recalled: null, timestamp: null, scope: null, metadata: null, ...(state === undefined ? {} : { state }) })
    for (const state of ['retired', 'expired', 'lapsed']) {
      const row = app.memoryRow(note(state), () => {}) as AppNode
      expect(row.className).toBe('row is-dim')
      expect((row.children[0] as AppNode).textContent).toBe(`${state} a note`)
    }
    for (const state of [undefined, 'live']) expect((app.memoryRow(note(state), () => {}) as AppNode).className).toBe('row')
    expect(app.isGone(note())).toBe(false)
    const calls: string[] = []
    const detail = app.memoryDetail({ ...note('retired'), content: 'a note in full' }, () => calls.push('forget'), undefined, (memory: { id: string }) => calls.push(`edit ${memory.id}`)) as AppNode
    const labels = detail.all().filter(node => node.tagName === 'button').map(node => node.textContent)
    expect(labels).toContain('Edit')
    expect(labels.filter(label => label.startsWith('Forget'))).toEqual(['Forget…', 'Forget'])
    expect(detail.all().some(node => node.tagName === 'dd' && node.textContent === 'retired')).toBe(true)
    detail.all().find(node => node.tagName === 'button' && node.textContent === 'Edit')!.fire('click')
    expect(calls).toEqual(['edit m1'])
    // Without the callback (an older caller) there is no Edit button.
    const plain = app.memoryDetail({ ...note(), content: 'x' }, () => {}) as AppNode
    expect(plain.all().some(node => node.tagName === 'button' && node.textContent === 'Edit')).toBe(false)
  })

  test('CRUD.2: the activity lines for retire, restore, import and expire read as plain sentences', () => {
    const line = (action: string, extra: Record<string, unknown> = {}) => ({ action, origin: 'ui', ok: true, ...extra })
    expect(app.sentenceOf(line('restore', { ids: ['abcdefghijkl'], count: 1 }))).toBe('Restored abcdefgh')
    expect(app.sentenceOf(line('restore', { ids: ['abcdefghijkl'], count: 0 }))).toBe('abcdefgh was already live; nothing to restore')
    expect(app.sentenceOf(line('restore', { ids: ['abcdefghijkl'], ok: false }))).toBe('Could not restore abcdefgh')
    expect(app.sentenceOf(line('retire', { ids: ['abcdefghijkl'], count: 1 }))).toBe('Retired abcdefgh')
    expect(app.sentenceOf(line('import', { origin: 'import', text: 'import notes.md: 3 memories saved', count: 3 }))).toBe('import notes.md: 3 memories saved')
    expect(app.sentenceOf(line('import', { origin: 'import', count: 1 }))).toBe('Imported 1 memory')
    expect(app.sentenceOf(line('import', { origin: 'import', count: 4 }))).toBe('Imported 4 memories')
    expect(app.sentenceOf(line('import', { origin: 'import', ok: false, text: 'import a.md: 1 saved' }))).toBe('Import had failures: import a.md: 1 saved')
    expect(app.sentenceOf(line('expire', { origin: 'session', count: 2 }))).toBe('Expired 2 unused memories')
    expect(app.sentenceOf(line('expire', { origin: 'session', count: 1 }))).toBe('Expired 1 unused memory')
    expect(app.sentenceOf(line('expire', { origin: 'session', count: 0 }))).toBe('Checked for unused memories; none expired')
    expect(app.sentenceOf(line('expire', { origin: 'session', ok: false }))).toBe('Could not expire unused memories')
    // Their origins have words too.
    expect(app.ORIGIN_HELP.import).toContain('import')
    expect(app.ORIGIN_HELP.session).toContain('session')
    expect(app.resultLabel(line('restore', { count: 1 }))).toBe('restored')
    expect(app.resultLabel(line('import', { count: 3 }))).toBe('3 saved')
    expect(app.resultLabel(line('expire', { count: 2 }))).toBe('2 expired')
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

// ---- CRUD.1, CRUD.2 (Memories) and CRUD.3: the New memory and Edit form and the vocabulary panel ----
// The form and the panel are ui/form.ts and ui/vocabulary.ts (DOM code, loaded by a path tsc does not follow).
// The pure parts run as they are; the elements run on a stand-in document; the answers come from canned replies
// (every case of the plan) and from the real write routes of ui/server.ts over a temporary store and root.
describe('CRUD.1 and CRUD.3: the form and the vocabulary panel', () => {
  const form = {} as Record<string, any>
  const vocab = {} as Record<string, any>
  let saved: unknown

  class FText {
    constructor(public data: string) {}
    get textContent() {
      return this.data
    }
  }
  class FNode {
    children: (FNode | FText)[] = []
    attributes = new Map<string, string>()
    dataset: Record<string, string> = {}
    className = ''
    hidden = false
    disabled = false
    type = ''
    value = ''
    checked = false
    placeholder = ''
    maxLength = 0
    rows = 0
    min = ''
    max = ''
    step = ''
    listeners = new Map<string, ((event: unknown) => void)[]>()
    constructor(public tagName: string) {}
    get textContent(): string {
      return this.children.map(child => child.textContent).join('')
    }
    set textContent(value: string) {
      this.children = value === '' ? [] : [new FText(String(value))]
    }
    append(...nodes: (FNode | FText | string)[]) {
      for (const node of nodes) this.children.push(typeof node === 'string' ? new FText(node) : node)
    }
    replaceChildren(...nodes: (FNode | FText | string)[]) {
      this.children = []
      this.append(...nodes)
    }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, String(value))
    }
    addEventListener(type: string, listener: (event: unknown) => void) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
    }
    fire(type: string) {
      for (const listener of this.listeners.get(type) ?? []) listener({})
    }
    focus() {}
    all(): FNode[] {
      return [this, ...this.children.flatMap(child => (child instanceof FNode ? child.all() : []))]
    }
    texts(): string[] {
      return this.children.flatMap(child => (child instanceof FNode ? child.texts() : [child.data]))
    }
  }
  const flush = () => Bun.sleep(5)
  /** Waits until `check` holds: a click that asks the real server answers in its own time. */
  async function settle(check: () => boolean, what: string) {
    for (let i = 0; i < 300 && !check(); i++) await Bun.sleep(10)
    if (!check()) throw new Error(`timed out waiting for ${what}`)
  }

  beforeAll(async () => {
    const g = globalThis as Record<string, unknown>
    saved = g.document
    g.document = { createElement: (tag: string) => new FNode(tag.toLowerCase()), createTextNode: (data: string) => new FText(data) }
    Object.assign(form, await import(join(ROOT, 'ui', 'form.ts')))
    Object.assign(vocab, await import(join(ROOT, 'ui', 'vocabulary.ts')))
  })
  afterAll(() => {
    ;(globalThis as Record<string, unknown>).document = saved
  })

  const VOCAB = {
    exists: true,
    tags: [
      { tag: 'entity:alice', ns: 'entity', description: 'A person', aliases: [], count: 2 },
      { tag: 'agent:claude-code', ns: 'agent', description: 'Claude Code', aliases: ['cc'], count: 0 },
      { tag: 'plain-tag', ns: null, description: '', aliases: [], count: 1 },
    ],
    candidates: [{ tag: 'cand-one', count: 1 }],
  }

  /** A form on the stand-in document, with a host that records its posts and answers from a queue. */
  async function open(memory?: Record<string, unknown>, vocabulary: unknown = VOCAB) {
    const posts: { path: string; body: Record<string, any> }[] = []
    const events: string[] = []
    const answers: { status: number; body: unknown }[] = []
    const host = {
      post: async (path: string, body: Record<string, any>) => {
        posts.push({ path, body })
        return answers.shift() ?? { status: 500, body: {} }
      },
      vocabulary: async () => (vocabulary === null ? null : vocab.parseVocabulary(vocabulary)),
      owners: () => ['project-alpha-1a2b', 'global'],
      owner: () => 'project-alpha-1a2b',
      ownerName: (owner: string) => owner,
      done: (message: string, id: string) => void events.push(`done ${message} ${id}`),
      cancel: () => void events.push('cancel'),
    }
    const built = form.buildForm(host, memory)
    await built.ready
    const root = built.element as FNode
    const find = (test: (node: FNode) => boolean) => root.all().find(test)!
    const parts = {
      root,
      posts,
      events,
      answers,
      content: find(n => n.tagName === 'textarea'),
      selects: root.all().filter(n => n.tagName === 'select'),
      numbers: root.all().filter(n => n.tagName === 'input' && n.type === 'number'),
      boxes: root.all().filter(n => n.tagName === 'input' && n.type === 'checkbox'),
      save: find(n => n.tagName === 'button' && n.type === 'submit'),
      cancel: find(n => n.textContent === 'Cancel'),
      buttons: () => root.all().filter(n => n.tagName === 'button').map(n => n.textContent),
      status: () => find(n => n.tagName === 'p' && n.attributes.get('role') === 'status'),
      notes: () => find(n => n.className === 'confirm'),
      box: (value: string) => root.all().find(n => n.tagName === 'input' && n.type === 'checkbox' && n.value === value)!,
      pinned: () => root.all().find(n => n.tagName === 'label' && n.texts().join('').startsWith('Pinned'))?.all().find(n => n.tagName === 'input'),
    }
    return parts
  }
  const kindOf = (parts: Awaited<ReturnType<typeof open>>) => parts.selects[0]!

  test('the kind picker has the eight plain labels, and the tag picker is grouped by namespace from /api/vocabulary', async () => {
    const parts = await open()
    const kinds = kindOf(parts).children as FNode[]
    expect(kinds.map(option => option.textContent)).toEqual(['Choose a kind…', 'fact', 'preference', 'rule or runbook', 'decision', 'project state', 'bug note', 'reference', 'session summary'])
    expect(kinds.slice(1).map(option => option.value)).toEqual(['fact', 'preference', 'instruction', 'decision', 'context', 'error', 'artifact', 'event'])
    const groups = parts.root.all().filter(n => n.tagName === 'fieldset')
    expect(groups.map(group => group.dataset.ns)).toEqual(['entity', 'agent', 'other'])
    expect(groups.map(group => group.texts()[0])).toEqual(['Entities', 'Agents', 'Other tags'])
    expect(parts.boxes.map(box => box.value)).toEqual(['entity:alice', 'agent:claude-code', 'plain-tag'])
    // Owner is a New-form field: existing owners, and global.
    expect((parts.selects[1]!.children as FNode[]).map(option => option.value)).toEqual(['global', 'project-alpha-1a2b'])
    expect(parts.selects[1]!.value).toBe('project-alpha-1a2b')
    expect(parts.pinned()).toBeUndefined()
    // No vocabulary (none yet, or unreadable): the picker says so and offers no tag.
    const none = await open(undefined, { exists: false, tags: [], candidates: [] })
    expect(none.boxes).toHaveLength(0)
    expect(none.root.texts().join(' ')).toContain('There is no tag vocabulary yet')
    const unreadable = await open(undefined, null)
    expect(unreadable.root.texts().join(' ')).toContain('could not be read')
  })

  test('the expiry starts at 14 for kind project state, empty for the rest, and a typed value stays', async () => {
    expect(form.defaultExpiry('context')).toBe('14')
    expect(form.defaultExpiry('fact')).toBe('')
    const parts = await open()
    const expires = parts.numbers[1]!
    expect(expires.value).toBe('')
    kindOf(parts).value = 'context'
    kindOf(parts).fire('change')
    expect(expires.value).toBe('14')
    kindOf(parts).value = 'fact'
    kindOf(parts).fire('change')
    expect(expires.value).toBe('')
    // A value the person typed is kept when the kind changes.
    expires.value = '30'
    expires.fire('input')
    kindOf(parts).value = 'context'
    kindOf(parts).fire('change')
    expect(expires.value).toBe('30')
  })

  test('the create request: kind and text are required, pinned is never sent, expiry and importance are checked', async () => {
    const values = { owner: 'global', content: 'A note', kind: 'fact', tags: ['plain-tag'], importance: '0.7', expires: '', removeExpiry: false, pinned: true }
    expect(form.createRequest(values)).toEqual({ body: { owner: 'global', content: 'A note', kind: 'fact', tags: ['plain-tag'], importance: 0.7 } })
    // Even with pinned set in the values, a create never sends it.
    expect(Object.keys(form.createRequest(values).body)).not.toContain('pinned')
    expect(form.createRequest({ ...values, expires: '14' }).body.expires_in_days).toBe(14)
    expect(form.createRequest({ ...values, content: '   ' }).error).toBe('Write the memory first.')
    expect(form.createRequest({ ...values, kind: '' }).error).toBe('Pick a kind.')
    expect(form.createRequest({ ...values, kind: 'unknown' }).error).toBe('Pick a kind.')
    expect(form.createRequest({ ...values, importance: '2' }).error).toContain('0 to 1')
    expect(form.createRequest({ ...values, expires: '0' }).error).toContain('1 to 365')
    expect(form.createRequest({ ...values, expires: '1.5' }).error).toContain('1 to 365')
    expect(form.createRequest({ ...values, expires: '366' }).error).toContain('1 to 365')
    // Through the form: the posted body has no pinned key, and the checkbox is not there at all.
    const parts = await open()
    parts.content.value = 'Plain note'
    kindOf(parts).value = 'fact'
    parts.answers.push({ status: 200, body: { status: 'stored', memory_id: 'mem-1' } })
    parts.save.fire('click')
    await flush()
    expect(parts.posts).toHaveLength(1)
    expect(parts.posts[0]!.path).toBe('/api/memory/create')
    expect('pinned' in parts.posts[0]!.body).toBe(false)
    expect(parts.posts[0]!.body).toEqual({ owner: 'project-alpha-1a2b', content: 'Plain note', kind: 'fact', tags: [], importance: 0.5 })
  })

  test('the edit request sends only what changed, and pinned only when it changed', async () => {
    const memory = { id: 'm1', owner: 'project-alpha-1a2b', content: 'old text', importance: 0.5, memory_type: 'fact', valid_until: null, metadata: { tags: ['plain-tag'], pinned: false } }
    const same = { owner: 'project-alpha-1a2b', content: 'old text', kind: 'fact', tags: ['plain-tag'], importance: '0.5', expires: '', removeExpiry: false, pinned: false }
    expect(form.updateRequest(memory, same)).toEqual({ error: 'Nothing has changed.' })
    expect(form.updateRequest(memory, { ...same, pinned: true })).toEqual({ body: { memory_id: 'm1', pinned: true } })
    expect(form.updateRequest(memory, { ...same, content: 'new text' })).toEqual({ body: { memory_id: 'm1', content: 'new text' } })
    expect(form.updateRequest(memory, { ...same, kind: 'decision' })).toEqual({ body: { memory_id: 'm1', kind: 'decision' } })
    expect(form.updateRequest(memory, { ...same, tags: [] })).toEqual({ body: { memory_id: 'm1', tags: [] } })
    expect(form.updateRequest(memory, { ...same, importance: '0.9', expires: '7' })).toEqual({ body: { memory_id: 'm1', importance: 0.9, expires_in_days: 7 } })
    expect(form.updateRequest(memory, { ...same, removeExpiry: true })).toEqual({ body: { memory_id: 'm1', expires_in_days: null } })
    expect(form.updateRequest(memory, { ...same, content: '  ' }).error).toBe('The memory cannot be empty.')
    // An older row with no kind: leaving the kind alone is fine, and the other changes go through.
    const old = { ...memory, memory_type: 'unknown' }
    expect(form.updateRequest(old, { ...same, kind: '', content: 'edited' })).toEqual({ body: { memory_id: 'm1', content: 'edited' } })
    // Through the form: the fields start from the memory, and pinned is the one change posted.
    const parts = await open({ ...memory, valid_until: '2026-11-01T00:00:00.000Z' })
    expect(parts.content.value).toBe('old text')
    expect(kindOf(parts).value).toBe('fact')
    expect(parts.selects).toHaveLength(1)
    expect(parts.box('plain-tag').checked).toBe(true)
    expect(parts.box('entity:alice').checked).toBe(false)
    expect(parts.root.texts().join(' ')).toContain('Now expires 2026-11-01')
    parts.save.fire('click')
    await flush()
    expect(parts.posts).toHaveLength(0)
    expect(parts.status().textContent).toBe('Nothing has changed.')
    parts.pinned()!.checked = true
    parts.answers.push({ status: 200, body: { status: 'updated', memory_id: 'm1' } })
    parts.save.fire('click')
    await flush()
    expect(parts.posts).toEqual([{ path: '/api/memory/update', body: { memory_id: 'm1', pinned: true } }])
    // A tag the memory has that the vocabulary does not offer stays on the form, checked.
    const odd = await open({ ...memory, metadata: { tags: ['not-in-vocab'] } })
    expect(odd.box('not-in-vocab').checked).toBe(true)
  })

  test('answerOf: saved, warned, blocked, too long and failed, in the words the form shows', () => {
    expect(form.answerOf(200, { status: 'stored', memory_id: 'mem-1' }, true)).toEqual({ kind: 'saved', id: 'mem-1', text: 'Saved memory mem-1.' })
    expect(form.answerOf(200, { status: 'updated', memory_id: 'mem-2' }, false).text).toBe('Updated memory mem-2.')
    const warn = form.answerOf(409, { verdict: 'warn', hits: [{ rule: 'G4', message: 'Looks like a dated status note.' }, { rule: 'G3', message: 'Close to 1 memory.' }], near: [{ id: 'abc123', score: 0.9312, preview: 'The older copy' }] }, true)
    expect(warn.kind).toBe('warn')
    // Each warning with its rule; G3 is told as each near-duplicate with its id and score.
    expect(form.answerLines(warn)).toEqual(['G4: Looks like a dated status note.', 'Near-duplicate of abc123 (score 0.93): The older copy'])
    const noNear = form.answerOf(409, { verdict: 'warn', hits: [{ rule: 'G2', message: 'Long text.' }] }, true)
    expect(form.answerLines(noNear)).toEqual(['G2: Long text.'])
    const blocked = form.answerOf(422, { verdict: 'block', hits: [{ rule: 'G1', message: 'Looks like a secret.' }] }, true)
    expect(blocked.kind).toBe('blocked')
    expect(form.answerLines(blocked)).toEqual(['G1: Looks like a secret.'])
    expect(form.answerOf(413, {}, true)).toEqual({ kind: 'toolong', text: 'That text is too long to save. Shorten it and try again.' })
    expect(form.answerOf(400, { error: 'kind is required' }, true)).toEqual({ kind: 'failed', text: 'Save failed: kind is required' })
    expect(form.answerOf(404, { error: 'That memory is gone; nothing was changed.' }, false).text).toBe('Update failed: That memory is gone; nothing was changed.')
    expect(form.answerOf(0, { error: 'Could not reach the server: down' }, true).text).toBe('Could not reach the server: down')
    // A 200 with no stored status is not a save; a 409 that is not a warning is a failure.
    expect(form.answerOf(200, {}, true).kind).toBe('failed')
    expect(form.answerOf(409, { error: 'this memory has no owner' }, false).kind).toBe('failed')
  })

  test('409 lists each warning and Save anyway resends the same request with confirm: true; any edit withdraws the warning; the save shows as done only after the 200', async () => {
    const parts = await open()
    parts.content.value = 'Merged the release on 2026-10-24 and it is done'
    kindOf(parts).value = 'fact'
    parts.box('entity:alice').checked = true
    parts.box('plain-tag').checked = true
    parts.answers.push({ status: 409, body: { verdict: 'warn', hits: [{ rule: 'G4', message: 'Dated note.' }, { rule: 'G3', message: 'Close.' }], near: [{ id: 'abc123', score: 0.93, preview: 'older' }] } })
    parts.save.fire('click')
    await flush()
    const body = parts.posts[0]!.body
    expect(body).toEqual({ owner: 'project-alpha-1a2b', content: 'Merged the release on 2026-10-24 and it is done', kind: 'fact', tags: ['entity:alice', 'plain-tag'], importance: 0.5 })
    expect(parts.notes().hidden).toBe(false)
    expect(parts.notes().texts()).toEqual(['G4: Dated note.', 'Near-duplicate of abc123 (score 0.93): older', 'Save anyway'])
    expect(parts.buttons()).toContain('Save anyway')
    // Nothing is shown as saved yet.
    expect(parts.events).toEqual([])
    // An edit withdraws the warning: Save anyway would otherwise send text the guard has not seen.
    parts.content.value += ' (edited)'
    parts.content.fire('input')
    expect(parts.notes().hidden).toBe(true)
    expect(parts.buttons()).not.toContain('Save anyway')
    // Warn again, then Save anyway: the same body plus confirm.
    parts.answers.push({ status: 409, body: { verdict: 'warn', hits: [{ rule: 'G4', message: 'Dated note.' }], near: [] } })
    parts.save.fire('click')
    await flush()
    const warned = parts.posts[1]!.body
    parts.answers.push({ status: 200, body: { status: 'stored', memory_id: 'mem-9' } })
    parts.root.all().find(n => n.textContent === 'Save anyway')!.fire('click')
    await flush()
    expect(parts.posts[2]!.body).toEqual({ ...warned, confirm: true })
    expect(parts.events).toEqual(['done Saved memory mem-9. mem-9'])
  })

  test('422 names the rules and has no save button; 413 says the text is too long; a failure says why; Cancel closes', async () => {
    const parts = await open()
    parts.content.value = 'The key is AKIA...'
    kindOf(parts).value = 'fact'
    parts.answers.push({ status: 422, body: { verdict: 'block', hits: [{ rule: 'G1', message: 'Looks like a secret.' }, { rule: 'G2', message: 'Too short.' }] } })
    parts.save.fire('click')
    await flush()
    expect(parts.status().textContent).toBe('The save guard refused this text. It cannot be saved as it is.')
    expect(parts.notes().texts()).toEqual(['G1: Looks like a secret.', 'G2: Too short.'])
    expect(parts.buttons()).not.toContain('Save anyway')
    expect(parts.events).toEqual([])
    parts.answers.push({ status: 413, body: { error: 'too big' } })
    parts.save.fire('click')
    await flush()
    expect(parts.status().textContent).toBe('That text is too long to save. Shorten it and try again.')
    expect(parts.notes().hidden).toBe(true)
    parts.answers.push({ status: 0, body: { error: 'Could not reach the server: down' } })
    parts.save.fire('click')
    await flush()
    expect(parts.status().textContent).toBe('Could not reach the server: down')
    expect(parts.events).toEqual([])
    // Hostile text from the server stays text.
    parts.answers.push({ status: 422, body: { verdict: 'block', hits: [{ rule: 'G1', message: MARKUP }] } })
    parts.save.fire('click')
    await flush()
    expect(parts.notes().texts()).toEqual([`G1: ${MARKUP}`])
    expect(parts.root.all().map(n => n.tagName).filter(tag => !['form', 'h3', 'label', 'span', 'textarea', 'select', 'option', 'input', 'div', 'fieldset', 'legend', 'p', 'button'].includes(tag))).toEqual([])
    parts.cancel.fire('click')
    expect(parts.events).toEqual(['cancel'])
  })

  // ---- against the real write routes ----

  describe('on a real server', () => {
    const temp = tempDir('ui-crud-form')
    const store = join(temp.dir, 'store')
    const root = join(temp.dir, 'root')
    const OWNER = 'project-alpha-1a2b'
    const AWS_KEY = 'AKIAABCDEFGHIJKLMNOP'
    let server: Started
    let savedHome: string | undefined
    let savedEmbeddings: string | undefined
    const url = (path: string) => `http://127.0.0.1:${server.port}${path}`
    const authed = () => ({ Authorization: `Bearer ${server.token}` })
    const post = async (path: string, payload: unknown) => {
      const response = await fetch(url(path), { method: 'POST', headers: { ...authed(), 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${server.port}` }, body: JSON.stringify(payload) })
      return { status: response.status, body: (await response.json()) as unknown }
    }
    const read = async (id: string) => (await (await fetch(url(`/api/memories/${id}`), { headers: authed() })).json()) as Record<string, any>

    beforeAll(async () => {
      savedHome = process.env.HOME
      savedEmbeddings = process.env.MNEMOSYNE_EMBEDDINGS
      process.env.HOME = isolatedEnv('ui-crud-form').HOME
      delete process.env.MNEMOSYNE_EMBEDDINGS
      mkdirSync(store, { recursive: true })
      await engineCall(CLI, store, OWNER, [toolCall(1, 'mnemopi_remember', { content: 'a first memory so the owner exists in the store' })])
      initVocabulary(store, root)
      recordCandidates(root, ['cand-one', 'cand-two'])
      server = await startServer({ root, store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    }, 120_000)
    afterAll(() => {
      server?.stop()
      if (savedHome === undefined) delete process.env.HOME
      else process.env.HOME = savedHome
      if (savedEmbeddings === undefined) delete process.env.MNEMOSYNE_EMBEDDINGS
      else process.env.MNEMOSYNE_EMBEDDINGS = savedEmbeddings
      temp.dispose()
    })

    test('a secret is refused with its rule id; a warned text saves only after Save anyway; a context note gets the 14 day expiry', async () => {
      const real = { post, vocabulary: async () => vocab.parseVocabulary((await (await fetch(url('/api/vocabulary'), { headers: authed() })).json()) as unknown), owners: () => [OWNER], owner: () => OWNER, ownerName: (o: string) => o, done: () => {}, cancel: () => {} }
      expect((await real.vocabulary())!.tags.length).toBeGreaterThan(0)
      const send = async (values: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
        const request = form.createRequest({ owner: OWNER, content: '', kind: 'fact', tags: [], importance: '0.5', expires: '', removeExpiry: false, pinned: false, ...values })
        expect(request.error).toBeUndefined()
        const reply = await post('/api/memory/create', { ...request.body, ...extra })
        return { reply, answer: form.answerOf(reply.status, reply.body, true) }
      }
      const secret = await send({ content: `The deploy key is ${AWS_KEY} for the bucket` })
      expect(secret.answer.kind).toBe('blocked')
      expect(form.answerLines(secret.answer)[0]).toStartWith('G1:')
      const warned = await send({ content: 'Merged the alpha release on 2026-10-24 and it is done' })
      expect(warned.answer.kind).toBe('warn')
      expect(form.answerLines(warned.answer)[0]).toStartWith('G4:')
      const confirmed = await send({ content: 'Merged the alpha release on 2026-10-24 and it is done' }, { confirm: true })
      expect(confirmed.answer.kind).toBe('saved')
      const row = await read(confirmed.answer.id)
      expect(row.memory_type).toBe('fact')
      expect(row.metadata.guard).toEqual(['G4'])
      // Project state: the form's default (14) is what the server stores.
      const note = await send({ content: 'The alpha build is waiting on the review', kind: 'context', expires: form.defaultExpiry('context') })
      const days = (Date.parse((await read(note.answer.id)).valid_until) - Date.now()) / 86_400_000
      expect(days).toBeGreaterThan(13.9)
      expect(days).toBeLessThan(14.1)
      // Edit: the request from the memory as the server describes it; pinned goes in as a change, and a refusal shows its rule.
      const memory = await read(confirmed.answer.id)
      const pin = form.updateRequest(memory, { owner: OWNER, content: memory.content, kind: memory.memory_type, tags: form.tagsOf(memory), importance: String(memory.importance), expires: '', removeExpiry: false, pinned: true })
      expect(pin.body).toEqual({ memory_id: confirmed.answer.id, pinned: true })
      const updated = await post('/api/memory/update', pin.body)
      expect(form.answerOf(updated.status, updated.body, false).kind).toBe('saved')
      expect((await read(confirmed.answer.id)).metadata.pinned).toBe(true)
      const refused = await post('/api/memory/update', { memory_id: confirmed.answer.id, content: `now the key is ${AWS_KEY}` })
      expect(form.answerOf(refused.status, refused.body, false).kind).toBe('blocked')
      expect(form.answerLines(form.answerOf(refused.status, refused.body, false))[0]).toStartWith('G1:')
    })

    test('the vocabulary panel: tags by namespace with counts (an unused one shows 0), candidates with Admit and Alias to, the server\'s answer decides', async () => {
      const get = async () => vocab.parseVocabulary((await (await fetch(url('/api/vocabulary'), { headers: authed() })).json()) as unknown)
      const data = await get()
      expect(data.exists).toBe(true)
      expect(data.candidates.map((c: { tag: string }) => c.tag).sort()).toEqual(['cand-one', 'cand-two'])
      const groups = vocab.tagGroups(data) as FNode[]
      expect(groups.map(group => group.dataset.ns)).toContain('agent')
      const agent = groups.find(group => group.dataset.ns === 'agent')!
      expect(agent.texts()[0]).toBe('Agents (4)')
      // An admitted tag nothing uses shows 0 memories.
      expect(agent.texts().join('|')).toContain('0 memories')
      expect(vocab.vocabularyText(data)).toBe(`${data.tags.length} tags in the vocabulary, 2 candidates waiting.`)
      const reloads: string[] = []
      const host = { post, reload: (message: string) => void reloads.push(message) }
      const rows = (vocab.candidateList(data, host) as FNode[])[0]!.all().filter(n => n.className === 'list-row vocab-candidate')
      expect(rows.map(row => row.dataset.tag)).toEqual(['cand-one', 'cand-two'])
      // Admit: a call for that tag; the page reloads from the server with the server's sentence.
      const buttonOf = (row: FNode, label: string) => row.all().find(n => n.tagName === 'button' && n.textContent === label)!
      buttonOf(rows[0]!, 'Admit').fire('click')
      await settle(() => reloads.length === 1, 'the admit to reload the lists')
      expect(reloads).toEqual(['cand-one is now in the vocabulary.'])
      expect((await get()).tags.some((t: { tag: string }) => t.tag === 'cand-one')).toBe(true)
      expect((await get()).candidates.map((c: { tag: string }) => c.tag)).toEqual(['cand-two'])
      // Alias: nothing is sent until a target is picked; then the server folds the spelling in.
      const fresh = await get()
      const second = (vocab.candidateList(fresh, host) as FNode[])[0]!.all().find(n => n.dataset.tag === 'cand-two')!
      buttonOf(second, 'Alias').fire('click')
      expect(second.texts()).toContain('Pick the tag it should count as.')
      expect(reloads).toHaveLength(1)
      const target = second.all().find(n => n.tagName === 'select')!
      expect((target.children as FNode[]).map(option => option.value)).toContain('cand-one')
      target.value = 'cand-one'
      buttonOf(second, 'Alias').fire('click')
      await settle(() => reloads.length === 2, 'the alias to reload the lists')
      expect(reloads.at(-1)).toBe('cand-two now counts as cand-one.')
      expect((await get()).tags.find((t: { tag: string }) => t.tag === 'cand-one').aliases).toContain('cand-two')
    })

    test('a refusal (400 for a tag that cannot be used, 409 for a rule of the vocabulary) is shown as a message and nothing reloads', async () => {
      const reloads: string[] = []
      const data = vocab.parseVocabulary({ exists: true, tags: [{ tag: 'agent:codex', ns: 'agent', description: '', aliases: [], count: 0 }], candidates: [{ tag: '!!!', count: 1 }] })
      const refuse = (status: number, error: string) => ({ post: async () => ({ status, body: { error } }), reload: (message: string) => void reloads.push(message) })
      const row400 = (vocab.candidateList(data, refuse(400, 'tag is not a usable tag: it needs a letter or digit')) as FNode[])[0]!.all().find(n => n.dataset.tag === '!!!')!
      row400.all().find(n => n.textContent === 'Admit')!.fire('click')
      await settle(() => row400.texts().includes('tag is not a usable tag: it needs a letter or digit'), 'the refusal text')
      expect(row400.texts()).toContain('tag is not a usable tag: it needs a letter or digit')
      // The real server: admitting a spelling that is an alias is a 409 with its own words.
      const real = await post('/api/vocabulary/admit', { tag: 'cand-two' })
      expect(real.status).toBe(409)
      expect(vocab.vocabularyFailure(real.status, real.body)).toContain('is an alias of cand-one')
      const bad = await post('/api/vocabulary/alias', { from: '!!!', to: 'cand-one' })
      expect(bad.status).toBe(400)
      expect(vocab.vocabularyFailure(bad.status, bad.body)).toContain('not a usable tag')
      const row409 = (vocab.candidateList(data, refuse(409, 'cand-two is an alias of cand-one: admit that tag instead')) as FNode[])[0]!.all().find(n => n.dataset.tag === '!!!')!
      row409.all().find(n => n.textContent === 'Admit')!.fire('click')
      await settle(() => row409.texts().includes('cand-two is an alias of cand-one: admit that tag instead'), 'the refusal text')
      expect(row409.texts()).toContain('cand-two is an alias of cand-one: admit that tag instead')
      expect(reloads).toEqual([])
      expect(vocab.vocabularyFailure(0, { error: 'Could not reach the server: down' })).toBe('Could not reach the server: down')
      expect(vocab.vocabularyFailure(500, {})).toBe('The server answered 500.')
      // No vocabulary file: the sentence says how to make one, and the panel has no candidates card.
      const none = vocab.parseVocabulary({ exists: false, tags: [], candidates: [] })
      expect(vocab.vocabularyText(none)).toContain('Run /mnemosyne-tags')
      expect(vocab.candidateList(none, refuse(200, ''))).toEqual([])
      expect(vocab.parseVocabulary(null)).toBeNull()
      expect(vocab.parseVocabulary({}).tags).toEqual([])
    })
  })
})
