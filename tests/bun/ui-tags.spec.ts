// TAGS.2 and the forget fix carried from the VIEW review, run for real: the
// server from ui/server.ts on 127.0.0.1, a temporary store made by the real
// engine, and (where the engine must misbehave) stand-in engine scripts.
//   TAGS.2   tags in the memory list, detail and search; ?tag= and ?untagged=1
//   VIEW low forgets reach the engine one at a time, and once more on "database is locked"
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOCK_RETRY_MS, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

async function remember(store: string, owner: string, content: string, metadata?: Record<string, unknown>) {
  const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...(metadata ? { metadata } : {}) })])).get(1))
  if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  return reply.memory_id as string
}

function setMetadata(store: string, id: string, text: string | null) {
  const db = new Database(join(store, 'mnemopi.db'))
  try {
    db.run('UPDATE working_memory SET metadata_json = ? WHERE id = ?', [text, id])
  } finally {
    db.close()
  }
}

async function serve(dir: string, store: string, cli = CLI) {
  const log = join(dir, 'root', 'activity.jsonl')
  const started: Started = await startServer({ root: join(dir, 'root'), store, cli, activityLog: log, pluginRoot: ROOT })
  const url = `http://127.0.0.1:${started.port}`
  const auth = { Authorization: `Bearer ${started.token}` }
  return {
    started,
    get: (path: string) => fetch(`${url}${path}`, { headers: auth }),
    post: (path: string, payload: unknown) => fetch(`${url}${path}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify(payload) }),
    lines: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : []),
  }
}

type Listed = { total: number; count: number; memories: { id: string; owner: string; tags: string[]; metadata: Record<string, unknown> | null }[] }

describe('tags in the API, on a real store', () => {
  const temp = tempDir('ui-tags')
  const store = join(temp.dir, 'store')
  type Name = 'fruit' | 'veg' | 'realUntagged' | 'nullMeta' | 'emptyObject' | 'broken' | 'stringTags' | 'junkTags' | 'emptyList' | 'upper' | 'other'
  const ids = {} as Record<Name, string>
  let server: Awaited<ReturnType<typeof serve>>

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    ids.fruit = await remember(store, 'global', 'apple orchard notes', { tags: ['fruit', 'red'] })
    ids.veg = await remember(store, 'project-a', 'carrot garden notes', { tags: ['veg', 'fruit'] })
    ids.realUntagged = await remember(store, 'project-a', 'a note carrying the tag named untagged', { tags: ['untagged'] })
    ids.nullMeta = await remember(store, 'global', 'note with null metadata')
    ids.emptyObject = await remember(store, 'project-a', 'note with empty object metadata')
    ids.broken = await remember(store, 'project-b', 'note with broken metadata')
    ids.stringTags = await remember(store, 'project-b', 'note whose tags is a string')
    ids.junkTags = await remember(store, 'project-b', 'note whose tags hold junk')
    ids.emptyList = await remember(store, 'project-b', 'note with an empty tag list')
    ids.upper = await remember(store, 'project-b', 'note stored with an upper case tag')
    ids.other = await remember(store, 'project-b', 'note with other metadata only', { x: 1 })
    setMetadata(store, ids.emptyObject, '{}')
    setMetadata(store, ids.broken, '{"tags": [')
    setMetadata(store, ids.stringTags, '{"tags":"fruit"}')
    setMetadata(store, ids.junkTags, '{"tags":[1,null,"",{"fruit":1}]}')
    setMetadata(store, ids.emptyList, '{"tags":[]}')
    setMetadata(store, ids.upper, '{"tags":["FRUIT"]}')
    setMetadata(store, ids.nullMeta, null)
    server = await serve(temp.dir, store)
  }, 120_000)
  afterAll(() => {
    server?.started.stop()
    temp.dispose()
  })

  const list = async (query = '') => {
    const response = await server.get(`/api/memories${query}`)
    expect(response.status).toBe(200)
    return (await response.json()) as Listed
  }
  const idsOf = (listed: Listed) => listed.memories.map(memory => memory.id).sort()
  const sorted = (...names: Name[]) => names.map(name => ids[name]).sort()

  test('TAGS.2.a1: a row with metadata.tags returns those tags in the list and in the detail', async () => {
    const listed = await list()
    expect(listed.memories.find(memory => memory.id === ids.fruit)!.tags).toEqual(['fruit', 'red'])
    expect(listed.memories.find(memory => memory.id === ids.veg)!.tags).toEqual(['veg', 'fruit'])
    // metadata still rides along unchanged.
    expect(listed.memories.find(memory => memory.id === ids.fruit)!.metadata).toEqual({ tags: ['fruit', 'red'] })
    const detail = (await (await server.get(`/api/memories/${ids.fruit}`)).json()) as { tags: string[]; metadata: unknown }
    expect(detail.tags).toEqual(['fruit', 'red'])
    expect(detail.metadata).toEqual({ tags: ['fruit', 'red'] })
  })

  test('TAGS.2.a2: NULL, empty, broken or odd metadata gives no tags and no error, in list, detail and filters', async () => {
    const listed = await list()
    for (const name of ['nullMeta', 'emptyObject', 'broken', 'stringTags', 'junkTags', 'emptyList', 'other'] as const) {
      expect({ name, tags: listed.memories.find(memory => memory.id === ids[name])!.tags }).toEqual({ name, tags: [] })
      const response = await server.get(`/api/memories/${ids[name]}`)
      expect(response.status).toBe(200)
      expect(((await response.json()) as { tags: string[] }).tags).toEqual([])
    }
    // The broken row does not break a filtered list either.
    expect((await server.get('/api/memories?tag=fruit')).status).toBe(200)
    expect((await server.get('/api/memories?untagged=1')).status).toBe(200)
  })

  test('TAGS.2.a3: ?tag=x returns only memories carrying x, with a matching total; case is ignored', async () => {
    const fruit = await list('?tag=fruit')
    // The upper case tag counts as fruit; a string, a junk list and a nested key do not.
    expect(idsOf(fruit)).toEqual(sorted('fruit', 'veg', 'upper'))
    expect(fruit.total).toBe(3)
    expect(idsOf(await list('?tag=FRUIT'))).toEqual(sorted('fruit', 'veg', 'upper'))
    expect(idsOf(await list('?tag=red'))).toEqual(sorted('fruit'))
    expect(idsOf(await list('?tag=nosuch'))).toEqual([])
    // With the other filters.
    expect(idsOf(await list('?tag=fruit&owner=project-a'))).toEqual(sorted('veg'))
    expect(idsOf(await list('?tag=fruit&q=orchard'))).toEqual(sorted('fruit'))
    expect(idsOf(await list('?tag=fruit&sort=never'))).toEqual(sorted('fruit', 'veg', 'upper'))
  })

  test('?untagged=1 returns rows with no tag: NULL, {}, broken, a string, junk and [] all count, a real tag named "untagged" does not', async () => {
    const untagged = await list('?untagged=1')
    expect(idsOf(untagged)).toEqual(sorted('nullMeta', 'emptyObject', 'broken', 'stringTags', 'junkTags', 'emptyList', 'other'))
    expect(untagged.total).toBe(7)
    expect(untagged.memories.every(memory => memory.tags.length === 0)).toBe(true)
    // The tag named "untagged" is a separate tag: found by ?tag=, never by ?untagged=1.
    expect(idsOf(await list('?tag=untagged'))).toEqual(sorted('realUntagged'))
    expect(idsOf(untagged)).not.toContain(ids.realUntagged)
    expect(idsOf(await list('?untagged=1&owner=project-b'))).toEqual(sorted('broken', 'stringTags', 'junkTags', 'emptyList', 'other'))
  })

  test('bad tag filters are refused with 400, and a tag is never run as SQL', async () => {
    for (const query of ['?tag=', '?tag=%20', '?tag=%20%09%20', '?untagged=0', '?untagged=', '?untagged=true', '?tag=fruit&untagged=1', `?tag=${'x'.repeat(201)}`]) {
      expect({ query, status: (await server.get(`/api/memories${query}`)).status }).toEqual({ query, status: 400 })
    }
    // Spaces around a tag are trimmed first.
    expect(idsOf(await list('?tag=%20fruit%20'))).toEqual(sorted('fruit', 'veg', 'upper'))
    const injected = await list(`?tag=${encodeURIComponent("' OR 1=1 --")}`)
    expect(injected.memories).toEqual([])
    const total = (await list()).total
    expect(total).toBe(Object.keys(ids).length)
  })

  test('search hits carry tags too', async () => {
    const response = await server.post('/api/search', { query: 'orchard' })
    expect(response.status).toBe(200)
    const found = (await response.json()) as { results: { id: string; tags: string[] }[] }
    const hit = found.results.find(result => result.id === ids.fruit)!
    expect(hit.tags).toEqual(['fruit', 'red'])
    const bare = (await (await server.post('/api/search', { query: 'null metadata' })).json()) as { results: { id: string; tags: string[] }[] }
    expect(bare.results.find(result => result.id === ids.nullMeta)!.tags).toEqual([])
  })

  test('an all-owner search leaves one line, owner global with owners = how many were searched (the page shows it as "all projects (n)")', async () => {
    const before = server.lines().length
    await server.post('/api/search', { query: 'notes' })
    const added = server.lines().slice(before)
    expect(added.length).toBe(1)
    expect(added[0]).toMatchObject({ action: 'recall', origin: 'ui', owner: 'global', owners: 3 })
  })
})

test('r2 LOW 10: the tag filter button is a plain button labelled "Clear tag filter", not a toggle', () => {
  const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
  const button = /<button id="mem-tag"[^>]*>/.exec(html)?.[0] ?? ''
  expect(button).toContain('aria-label="Clear tag filter"')
  expect(button).not.toContain('aria-pressed')
})

describe('forgets reach the engine one at a time', () => {
  const temp = tempDir('ui-tags-forget')
  const store = join(temp.dir, 'store')
  const owners = ['f1', 'f2', 'f3']
  const rows: { id: string; owner: string }[] = []

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    for (let i = 0; i < 12; i++) {
      const owner = owners[i % 3]!
      rows.push({ id: await remember(store, owner, `forget fact ${i} of ${owner}`), owner })
    }
  }, 120_000)
  afterAll(() => temp.dispose())

  const present = () => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      return (db.query('SELECT id FROM working_memory').all() as { id: string }[]).map(row => row.id)
    } finally {
      db.close()
    }
  }

  /** The most engine processes that ever ran together, from a start/end mark file. */
  const most = (marks: string) => {
    let live = 0
    let top = 0
    for (const mark of marks.split('\n').filter(Boolean)) {
      live += mark === '+' ? 1 : -1
      top = Math.max(top, live)
    }
    return { top, live, starts: marks.split('\n').filter(mark => mark === '+').length }
  }

  test('concurrent forgets run through the engine one at a time, all succeed, and the rows are gone', async () => {
    const marks = join(temp.dir, 'marks.txt')
    writeFileSync(marks, '')
    // A stand-in engine that marks its start and end and takes 120 ms; it deletes the row as the real one does.
    const cli = join(temp.dir, 'slow-forget.ts')
    writeFileSync(
      cli,
      `import { appendFileSync } from 'node:fs'
import { Database } from 'bun:sqlite'
appendFileSync(${JSON.stringify(marks)}, '+\\n')
const lines = (await Bun.stdin.text()).split('\\n').filter(Boolean)
await Bun.sleep(120)
for (const line of lines) {
  const { id, params } = JSON.parse(line)
  const db = new Database(process.env.MNEMOPI_DATA_DIR + '/mnemopi.db')
  db.run('DELETE FROM working_memory WHERE id = ? AND session_id = ?', [params.arguments.memory_id, process.env.MNEMOPI_SESSION_ID])
  db.close()
  console.log(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ status: 'deleted', memory_id: params.arguments.memory_id }) }] } }))
}
appendFileSync(${JSON.stringify(marks)}, '-\\n')
`,
    )
    const server = await serve(temp.dir, store, cli)
    try {
      const targets = rows.slice(0, 6)
      const responses = await Promise.all(targets.map(row => server.post('/api/forget', { memory_id: row.id })))
      expect(responses.map(response => response.status)).toEqual(targets.map(() => 200))
      const seen = most(readFileSync(marks, 'utf8'))
      expect(seen).toEqual({ top: 1, live: 0, starts: 6 })
      expect(present().filter(id => targets.some(row => row.id === id))).toEqual([])
      expect(server.lines().filter(line => line.action === 'forget' && line.ok === true).length).toBe(6)
    } finally {
      server.started.stop()
    }
  }, 30_000)

  test('an engine that answers "database is locked" once is tried once more, and two refusals in a row give 502', async () => {
    expect(LOCK_RETRY_MS).toBeLessThan(2000)
    const marks = join(temp.dir, 'locked.txt')
    writeFileSync(marks, '')
    const cli = join(temp.dir, 'locked-cli.ts')
    // Locked on the first call for an id, deleted-looking on the second; ids ending in "never" stay locked.
    writeFileSync(
      cli,
      `import { appendFileSync, readFileSync } from 'node:fs'
const [line] = (await Bun.stdin.text()).split('\\n').filter(Boolean)
const { id, params } = JSON.parse(line)
const memory = params.arguments.memory_id
appendFileSync(${JSON.stringify(marks)}, memory + '\\n')
const calls = readFileSync(${JSON.stringify(marks)}, 'utf8').split('\\n').filter(entry => entry === memory).length
const locked = calls === 1 || process.env.MNEMOPI_SESSION_ID === 'f3'
const result = locked
  ? { content: [{ type: 'text', text: JSON.stringify({ error: 'database is locked' }) }], isError: true }
  : { content: [{ type: 'text', text: JSON.stringify({ status: 'deleted', memory_id: memory }) }] }
console.log(JSON.stringify({ jsonrpc: '2.0', id, result }))
`,
    )
    const server = await serve(temp.dir, store, cli)
    try {
      const retried = rows.find(row => row.owner === 'f1' && present().includes(row.id))!
      const ok = await server.post('/api/forget', { memory_id: retried.id })
      expect(ok.status).toBe(200)
      expect(await ok.json()).toMatchObject({ status: 'deleted', memory_id: retried.id })
      const stuck = rows.find(row => row.owner === 'f3' && present().includes(row.id))!
      const refused = await server.post('/api/forget', { memory_id: stuck.id })
      expect(refused.status).toBe(502)
      // The row is still there, and the engine was asked exactly twice for each.
      expect(present()).toContain(stuck.id)
      const asked = readFileSync(marks, 'utf8').split('\n').filter(Boolean)
      expect(asked.filter(id => id === retried.id).length).toBe(2)
      expect(asked.filter(id => id === stuck.id).length).toBe(2)
    } finally {
      server.started.stop()
    }
  }, 30_000)

  test('with the real engine, concurrent forgets across owners all succeed', async () => {
    const server = await serve(temp.dir, store)
    try {
      const targets = rows.filter(row => present().includes(row.id))
      expect(targets.length).toBeGreaterThan(3)
      const responses = await Promise.all(targets.map(row => server.post('/api/forget', { memory_id: row.id })))
      expect(responses.map(response => response.status)).toEqual(targets.map(() => 200))
      expect(present()).toEqual([])
    } finally {
      server.started.stop()
    }
  }, 60_000)
})
