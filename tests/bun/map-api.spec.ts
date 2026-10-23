// MAP.1: GET /api/map, one drill level per call, run for real: the server from
// ui/server.ts on 127.0.0.1 and a temporary store made by the real engine
// (recall counts and odd metadata are then set straight in the temporary
// database, which the server reads read-only).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { firstLineOf, MAP_MEMORY_LIMIT, mapLevel, openStore, projectLabel, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const ALPHA = 'project-alpha-1a2b'
const BETA = 'project-beta-9z8y'
const LONG = `${'x'.repeat(100)} tail`

type Node = Record<string, unknown> & { id: string; label: string; count?: number }
type Reply = { level: string; nodes: Node[]; total?: number }

async function remember(store: string, owner: string, content: string, metadata?: Record<string, unknown>) {
  const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...(metadata ? { metadata } : {}) })])).get(1))
  if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  return reply.memory_id as string
}

describe('GET /api/map on a real store', () => {
  const temp = tempDir('map-api')
  const store = join(temp.dir, 'store')
  const ids = {} as Record<'g1' | 'g2' | 'a1' | 'a2' | 'a3' | 'a4' | 'a5' | 'a6' | 'a7' | 'b1', string>
  let started: Started
  let url = ''

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    ids.g1 = await remember(store, 'global', 'global fruit note', { tags: ['fruit'] })
    ids.g2 = await remember(store, 'global', 'global plain note')
    ids.a1 = await remember(store, ALPHA, 'alpha fruit and veg', { tags: ['fruit', 'veg'] })
    ids.a2 = await remember(store, ALPHA, 'alpha fruit only', { tags: ['fruit'] })
    ids.a3 = await remember(store, ALPHA, 'alpha with the tag named untagged', { tags: ['untagged'] })
    ids.a4 = await remember(store, ALPHA, `\n\n  ${LONG}\nsecond line`)
    ids.a5 = await remember(store, ALPHA, 'alpha quote and percent', { tags: ["it's 50%"] })
    ids.a6 = await remember(store, ALPHA, 'alpha wildcard bait', { tags: ["it's 50x"] })
    ids.a7 = await remember(store, ALPHA, 'alpha no quote', { tags: ['its 50%'] })
    ids.b1 = await remember(store, BETA, '<img src=x onerror=alert(1)> beta markup', { tags: ['Veg'] })
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      const recalls: [string, number][] = [
        [ids.g1!, 1],
        [ids.a1!, 5],
        [ids.a2!, 2],
        [ids.a3!, 0],
        [ids.a4!, 3],
        [ids.b1!, 0],
      ]
      for (const [id, n] of recalls) db.run('UPDATE working_memory SET recall_count = ? WHERE id = ?', [n, id])
      // Broken metadata counts as untagged, as everywhere else.
      db.run("UPDATE working_memory SET metadata_json = '{\"tags\": [' WHERE id = ?", [ids.g2!])
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

  const get = (path: string, auth = true) => fetch(`${url}${path}`, { headers: auth ? { Authorization: `Bearer ${started.token}` } : {} })
  const level = async (query: string) => {
    const response = await get(`/api/map${query}`)
    expect({ query, status: response.status }).toEqual({ query, status: 200 })
    return (await response.json()) as Reply
  }
  const byId = (reply: Reply) => Object.fromEntries(reply.nodes.map(node => [node.id, node]))

  test('MAP.1.a1: the projects, each with count, recall total and newest date; global is labelled Global', async () => {
    const reply = await level('')
    expect(reply.level).toBe('projects')
    expect(reply.nodes.map(node => node.id)).toEqual([ALPHA, 'global', BETA])
    const nodes = byId(reply)
    expect(nodes[ALPHA]).toMatchObject({ label: 'alpha', count: 7, recalls: 10 })
    expect(nodes.global).toMatchObject({ label: 'Global', count: 2, recalls: 1 })
    expect(nodes[BETA]).toMatchObject({ label: 'beta', count: 1, recalls: 0 })
    for (const node of reply.nodes) expect(typeof node.newest).toBe('string')
    expect(projectLabel('global')).toBe('Global')
    expect(projectLabel('odd owner')).toBe('odd owner')
  })

  test('MAP.1.a2: a project\'s topics with counts, plus one Untagged node when any memory has no tag', async () => {
    const reply = await level(`?project=${ALPHA}`)
    expect(reply.level).toBe('topics')
    const nodes = byId(reply)
    expect(nodes['tag:fruit']).toMatchObject({ label: 'fruit', count: 2, tag: 'fruit', untagged: false })
    expect(nodes['tag:veg']).toMatchObject({ label: 'veg', count: 1 })
    expect(nodes.untagged).toMatchObject({ label: 'Untagged', count: 1, untagged: true, tag: null })
    expect(reply.nodes.filter(node => node.untagged === true)).toHaveLength(1)
    // The real tag "untagged" is its own topic, beside the Untagged group.
    expect(nodes['tag:untagged']).toMatchObject({ label: 'untagged', count: 1, untagged: false })
    // Largest first; Untagged last.
    expect(reply.nodes[0]!.id).toBe('tag:fruit')
    expect(reply.nodes.at(-1)!.id).toBe('untagged')
    // Global: broken metadata counts as untagged; tags are grouped lower-cased.
    expect(byId(await level('?project=global')).untagged).toMatchObject({ count: 1 })
    expect(byId(await level(`?project=${BETA}`))['tag:veg']).toMatchObject({ label: 'veg', count: 1 })
    // No Untagged node when every memory has a tag.
    expect(byId(await level(`?project=${BETA}`)).untagged).toBeUndefined()
  })

  test('MAP.1.a3: a topic\'s memories with id, label, tags, recall_count and timestamp; tag=untagged and untagged=1 differ', async () => {
    const fruit = await level(`?project=${ALPHA}&tag=fruit`)
    expect(fruit.level).toBe('memories')
    expect(fruit.nodes.map(node => node.id).sort()).toEqual([ids.a1, ids.a2].sort())
    const a1 = byId(fruit)[ids.a1]!
    expect(a1).toEqual({ id: ids.a1, label: 'alpha fruit and veg', tags: ['fruit', 'veg'], recall_count: 5, timestamp: expect.any(String) })
    const realTag = await level(`?project=${ALPHA}&tag=untagged`)
    expect(realTag.nodes.map(node => node.id)).toEqual([ids.a3])
    const none = await level(`?project=${ALPHA}&untagged=1`)
    expect(none.nodes.map(node => node.id)).toEqual([ids.a4])
    // The label is the first non-empty line, at most 80 characters.
    const label = none.nodes[0]!.label
    expect(Array.from(label)).toHaveLength(80)
    expect(label).toBe(`${'x'.repeat(79)}…`)
    expect(firstLineOf('\n  short  \nnext')).toBe('short')
    // Markup comes back as the same characters, in a JSON string.
    expect((await level(`?project=${BETA}&tag=veg`)).nodes[0]!.label).toBe('<img src=x onerror=alert(1)> beta markup')
    // The tag is matched case aside, as the Memories filter does.
    expect((await level(`?project=${BETA}&tag=VEG`)).nodes.map(node => node.id)).toEqual([ids.b1])
  })

  test('MAP.1.a4: an unknown project or tag is an empty list; every level needs the token', async () => {
    expect((await level('?project=project-nobody-0')).nodes).toEqual([])
    expect((await level('?project=project-nobody-0&tag=fruit')).nodes).toEqual([])
    expect((await level('?project=project-nobody-0&untagged=1')).nodes).toEqual([])
    expect((await level(`?project=${ALPHA}&tag=nosuch`)).nodes).toEqual([])
    for (const query of ['', `?project=${ALPHA}`, `?project=${ALPHA}&tag=fruit`, `?project=${ALPHA}&untagged=1`]) {
      const bare = await get(`/api/map${query}`, false)
      expect({ query, status: bare.status }).toEqual({ query, status: 401 })
      expect(await bare.text()).not.toContain('alpha')
      const wrong = await fetch(`${url}/api/map${query}`, { headers: { Authorization: 'Bearer wrong' } })
      expect(wrong.status).toBe(401)
      const inQuery = await fetch(`${url}/api/map${query}${query ? '&' : '?'}token=${started.token}`)
      expect(inQuery.status).toBe(401)
    }
  })

  test('MAP.1.a5: min_recalls drops memories at every level, counts follow, empty projects and topics go; else 400', async () => {
    const projects = byId(await level('?min_recalls=2'))
    expect(Object.keys(projects)).toEqual([ALPHA])
    expect(projects[ALPHA]).toMatchObject({ count: 3, recalls: 10 })
    const topics = byId(await level(`?project=${ALPHA}&min_recalls=3`))
    expect(Object.keys(topics).sort()).toEqual(['tag:fruit', 'tag:veg', 'untagged'])
    expect(topics['tag:fruit']).toMatchObject({ count: 1 })
    // Untagged goes when its last memory falls below.
    expect(byId(await level(`?project=${ALPHA}&min_recalls=4`)).untagged).toBeUndefined()
    expect((await level(`?project=${ALPHA}&tag=fruit&min_recalls=3`)).nodes.map(node => node.id)).toEqual([ids.a1])
    expect((await level(`?project=${ALPHA}&untagged=1&min_recalls=4`)).nodes).toEqual([])
    expect((await level('?min_recalls=0')).nodes).toHaveLength(3)
    for (const bad of ['-1', '1.5', 'abc', '', ' 2', '2e1', '0x10', '99999999999']) {
      const response = await get(`/api/map?min_recalls=${encodeURIComponent(bad)}`)
      expect({ bad, status: response.status }).toEqual({ bad, status: 400 })
    }
    expect((await get(`/api/map?project=${ALPHA}&tag=fruit&min_recalls=-3`)).status).toBe(400)
  })

  test('MAP.1.a6: project, tag and min_recalls are bound: a quote and a percent sign match only that tag', async () => {
    const topics = byId(await level(`?project=${ALPHA}`))
    expect(topics["tag:it's 50%"]).toMatchObject({ count: 1 })
    const reply = await level(`?project=${ALPHA}&tag=${encodeURIComponent("it's 50%")}`)
    expect(reply.nodes.map(node => node.id)).toEqual([ids.a5])
    // A percent sign is no wildcard, and a quote ends nothing.
    expect((await level(`?project=${ALPHA}&tag=${encodeURIComponent("it's 50")}`)).nodes).toEqual([])
    expect((await level(`?project=${encodeURIComponent("x' OR '1'='1")}`)).nodes).toEqual([])
    expect((await level(`?project=${encodeURIComponent('%')}`)).nodes).toEqual([])
    // Bad shapes are refused, not guessed at.
    for (const query of ['?tag=fruit', '?untagged=1', `?project=${ALPHA}&tag=fruit&untagged=1`, `?project=${ALPHA}&untagged=yes`, '?project=', '?other=1', `?project=${ALPHA}&project=x`]) {
      const response = await get(`/api/map${query}`)
      expect({ query, status: response.status }).toEqual({ query, status: 400 })
    }
  })

  test('the map route is GET only, and an empty store answers empty levels', async () => {
    const post = await fetch(`${url}/api/map`, { method: 'POST', headers: { Authorization: `Bearer ${started.token}` } })
    expect(post.status).toBe(405)
    expect(mapLevel(null, new URLSearchParams())).toEqual({ status: 200, body: { level: 'projects', min_recalls: 0, nodes: [] } })
    expect((mapLevel(null, new URLSearchParams('project=x&untagged=1')).body as Reply).nodes).toEqual([])
  })
})

describe('GET /api/map: non-ASCII tags and the per-topic cap (review r1 findings 3 and 5)', () => {
  const temp = tempDir('map-api-more')
  const store = join(temp.dir, 'store')
  const GAMMA = 'project-gamma-7q'
  let started: Started
  let url = ''

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    // Stored as given (only the hooks clean tags): an upper-case non-ASCII tag, its lower-case twin, and a big topic.
    await remember(store, GAMMA, 'summer upper', { tags: ['ÉTÉ'] })
    await remember(store, GAMMA, 'summer lower', { tags: ['été'] })
    for (const n of [1, 2, 3]) await remember(store, GAMMA, `many ${n}`, { tags: ['many'] })
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    url = `http://127.0.0.1:${started.port}`
  }, 120_000)
  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  const level = async (query: string) => {
    const response = await fetch(`${url}/api/map${query}`, { headers: { Authorization: `Bearer ${started.token}` } })
    expect({ query, status: response.status }).toEqual({ query, status: 200 })
    return (await response.json()) as Reply & { total: number; limit: number }
  }

  test('LOW 5: every topic node, asked for by its own tag, gives back exactly its count of memories', async () => {
    const topics = (await level(`?project=${GAMMA}`)).nodes
    expect(topics.length).toBeGreaterThanOrEqual(3)
    for (const topic of topics) {
      const query = topic.untagged === true ? `?project=${GAMMA}&untagged=1` : `?project=${GAMMA}&tag=${encodeURIComponent(String(topic.tag))}`
      const memories = await level(query)
      expect({ topic: topic.id, found: memories.total }).toEqual({ topic: topic.id, found: topic.count! })
    }
    // The upper-case tag, as typed, finds its memory too.
    expect((await level(`?project=${GAMMA}&tag=${encodeURIComponent('ÉTÉ')}`)).nodes.map(node => node.label)).toEqual(['summer upper'])
  })

  test('LOW 3: a topic is cut at the limit, newest first, and says its total and the limit', async () => {
    const full = await level(`?project=${GAMMA}&tag=many`)
    expect([full.total, full.nodes.length, full.limit]).toEqual([3, 3, MAP_MEMORY_LIMIT])
    const db = openStore(store)
    try {
      const cut = mapLevel(db, new URLSearchParams(`project=${GAMMA}&tag=many`), 2).body as Reply & { total: number; limit: number }
      expect([cut.total, cut.nodes.length, cut.limit]).toEqual([3, 2, 2])
      expect(cut.nodes.map(node => node.id)).toEqual(full.nodes.slice(0, 2).map(node => node.id))
    } finally {
      db?.close()
    }
  })
})
