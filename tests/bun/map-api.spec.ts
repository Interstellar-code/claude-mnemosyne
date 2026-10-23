// OLDMAP.1: the v1 drill-down route GET /api/map and its mapLevel are gone, run
// for real: the server from ui/server.ts on 127.0.0.1 and a temporary store made
// by the real engine. /api/map now answers 404 like any unknown route, still
// behind the token; /api/galaxy (the replacement) keeps serving the same store.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as server from '../../ui/server'
import { projectLabel, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const ALPHA = 'project-alpha-1a2b'
// The v1 route's levels: projects, a project's topics, a topic's memories.
const OLD_QUERIES = ['', `?project=${ALPHA}`, `?project=${ALPHA}&tag=fruit`, `?project=${ALPHA}&untagged=1`, '?min_recalls=2']

async function remember(store: string, owner: string, content: string, metadata?: Record<string, unknown>) {
  const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...(metadata ? { metadata } : {}) })])).get(1))
  if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  return reply.memory_id as string
}

describe('OLDMAP.1: GET /api/map is deleted', () => {
  const temp = tempDir('map-api')
  const store = join(temp.dir, 'store')
  let started: Started
  let url = ''

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    await remember(store, ALPHA, 'alpha fruit only', { tags: ['fruit'] })
    await remember(store, 'global', 'global plain note')
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    url = `http://127.0.0.1:${started.port}`
  }, 120_000)
  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  const get = (path: string, auth = true) => fetch(`${url}${path}`, { headers: auth ? { Authorization: `Bearer ${started.token}` } : {} })

  test('OLDMAP.1.a1: with a valid token every old level answers 404, the same as an unknown route', async () => {
    const unknown = await get('/api/no-such-route')
    expect(unknown.status).toBe(404)
    const unknownBody = await unknown.text()
    for (const query of OLD_QUERIES) {
      const response = await get(`/api/map${query}`)
      const text = await response.text()
      expect({ query, status: response.status, body: text }).toEqual({ query, status: 404, body: unknownBody })
      expect(text).not.toContain('alpha')
    }
    const post = await fetch(`${url}/api/map`, { method: 'POST', headers: { Authorization: `Bearer ${started.token}` } })
    expect(post.status).not.toBe(200)
    expect(await post.text()).not.toContain('alpha')
  })

  test('OLDMAP.1.a1: without a valid token /api/map is still refused before routing', async () => {
    for (const query of OLD_QUERIES) {
      const bare = await get(`/api/map${query}`, false)
      expect({ query, status: bare.status }).toEqual({ query, status: 401 })
      const wrong = await fetch(`${url}/api/map${query}`, { headers: { Authorization: 'Bearer wrong' } })
      expect({ query, status: wrong.status }).toEqual({ query, status: 401 })
      const inQuery = await fetch(`${url}/api/map${query}${query ? '&' : '?'}token=${started.token}`)
      expect({ query, status: inQuery.status }).toEqual({ query, status: 401 })
    }
  })

  test('OLDMAP.1.a1: mapLevel and its helpers are no longer exported; the galaxy route still serves the store', async () => {
    for (const name of ['mapLevel', 'MAP_MEMORY_LIMIT', 'firstLineOf']) expect({ name, exported: name in server }).toEqual({ name, exported: false })
    const galaxy = await get('/api/galaxy')
    expect(galaxy.status).toBe(200)
    const reply = (await galaxy.json()) as { projects: { owner: string; label: string }[] }
    expect(reply.projects.map(project => project.owner).sort()).toEqual([ALPHA, 'global'].sort())
    expect(projectLabel('global')).toBe('Global')
    expect(projectLabel(ALPHA)).toBe('alpha')
    expect(projectLabel('odd owner')).toBe('odd owner')
  })
})
