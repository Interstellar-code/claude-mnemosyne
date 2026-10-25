// EVT.1.a2 and EVT.2: activity lines become map events; Simulate makes demo-only
// events with real galaxy shapes and never touches the network.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { demoId, drawsOnMap, noduleFor, RECALL_HITS, simulate, toMapEvent, topicOf, WRITE_MIX } from '../../ui/map-live'
import type { GalaxyLike } from '../../ui/map-live'
import { ROOT } from './helpers'

// Real line shapes, as the hooks, the proxy and the dashboard write them (CTX).
const GALAXY: GalaxyLike = {
  projects: [
    { owner: 'project-alpha-1a2b', count: 4 },
    { owner: 'global', count: 2 },
  ],
  memories: [
    { id: 'a1', owner: 'project-alpha-1a2b', tags: ['fruit', 'veg'], label: 'alpha fruit' },
    { id: 'a2', owner: 'project-alpha-1a2b', tags: ['fruit'], label: 'alpha fruit two' },
    { id: 'a3', owner: 'project-alpha-1a2b', tags: [], label: 'alpha plain' },
    { id: 'a4', owner: 'project-alpha-1a2b', tags: ['veg'], label: 'alpha veg' },
    { id: 'g1', owner: 'global', tags: ['fruit'], label: 'global fruit' },
    { id: 'g2', owner: 'global', tags: [], label: 'global plain' },
  ],
}

// A deterministic stream of numbers in [0, 1), for the demo source.
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('EVT.1.a2: toMapEvent', () => {
  test('each drawing action becomes its event, with client and t', () => {
    expect(toMapEvent({ t: 'T', action: 'recall', ok: true, ids: ['a', 'b'], client: 'claude-code', owner: 'global' })).toEqual({
      kind: 'recall', ids: ['a', 'b'], client: 'claude-code', t: 'T', owner: 'global',
    })
    expect(toMapEvent({ t: 'T', action: 'remember', ok: true, ids: ['m1'], client: 'codex-mcp-client', owner: 'p' })).toEqual({
      kind: 'save', ids: ['m1'], client: 'codex-mcp-client', t: 'T', owner: 'p',
    })
    expect(toMapEvent({ t: 'T', action: 'update', ok: true, ids: ['m1'], client: 'dashboard' })).toEqual({
      kind: 'update', ids: ['m1'], client: 'dashboard', t: 'T',
    })
    expect(toMapEvent({ t: 'T', action: 'forget', ok: true, ids: ['m1'] })).toEqual({
      kind: 'forget', ids: ['m1'], client: 'unknown', t: 'T',
    })
  })

  test('lines with no client (old lines) read unknown; stats, rearm and extract draw nothing', () => {
    expect(toMapEvent({ t: 'T', action: 'recall', ok: true, ids: [] })?.client).toBe('unknown')
    for (const action of ['stats', 'rearm', 'extract', 'nonsense']) {
      expect(toMapEvent({ t: 'T', action, ok: true, ids: ['x'] })).toBeNull()
    }
    expect(toMapEvent({})).toBeNull()
  })

  test('a failed line draws nothing, whatever its action', () => {
    for (const action of ['recall', 'remember', 'update', 'forget']) {
      expect(toMapEvent({ t: 'T', action, ok: false, ids: ['x'], error: 'not_found' })).toBeNull()
    }
  })

  test('ids keeps only strings; a missing t is empty', () => {
    const event = toMapEvent({ action: 'forget', ok: true, ids: ['a', 3, null, 'b'] })!
    expect(event.ids).toEqual(['a', 'b'])
    expect(event.t).toBe('')
  })
})

describe('EVT.2: the demo source', () => {
  test('EVT.2.a1: recall picks a project by weight, a topic, and up to 3 of its memories', () => {
    // seeded(1)'s first draw lands on the heavier project, project-alpha (4 of 6 memories).
    const event = simulate('recall', GALAXY, seeded(1))!
    expect(event.kind).toBe('recall')
    expect(event.demo).toBe(true)
    expect(event.client).toBe('demo')
    expect(event.ids.length).toBeGreaterThan(0)
    expect(event.ids.length).toBeLessThanOrEqual(RECALL_HITS)
    expect(event.owner).toBe('project-alpha-1a2b')
    expect(typeof event.topic).toBe('string')
    for (const id of event.ids) expect(GALAXY.memories!.some(memory => memory.id === id)).toBe(true)
  })

  test('EVT.2.a1: every memory a demo recall picks carries the topic the event names', () => {
    for (let i = 0; i < 300; i++) {
      const event = simulate('recall', GALAXY, seeded(i + 1))!
      const picked = event.ids.map(id => GALAXY.memories!.find(memory => memory.id === id)!)
      for (const memory of picked) {
        expect(memory.owner).toBe(event.owner!)
        expect(topicOf(memory)).toBe(event.topic!)
      }
    }
  })

  test('EVT.2.a3: a project with no memories in the list is never drawn, so no other owner gets its label', () => {
    const galaxy: GalaxyLike = {
      projects: [
        { owner: 'project-unlisted-9f9f', count: 50 },
        { owner: 'global', count: 1 },
      ],
      memories: [{ id: 'g1', owner: 'global', tags: ['fruit'] }],
    }
    for (let i = 0; i < 50; i++) {
      for (const kind of ['recall', 'write'] as const) {
        const event = simulate(kind, galaxy, seeded(i + 1))!
        expect(event.owner).toBe('global')
      }
    }
    expect(simulate('recall', { projects: [{ owner: 'project-unlisted-9f9f', count: 5 }], memories: [{ id: 'g1', owner: 'global' }] })).toBeUndefined()
  })

  test('EVT.2.a1: the write mix is save 50%, update 32%, forget 18%, and save uses a fresh client id', () => {
    expect(WRITE_MIX).toEqual([
      { kind: 'save', upTo: 0.5 },
      { kind: 'update', upTo: 0.82 },
      { kind: 'forget', upTo: 1 },
    ])
    const kinds = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const event = simulate('write', GALAXY, seeded(i + 1))!
      kinds.add(event.kind)
      if (event.kind === 'save') {
        // A save's id is client-side, carries the demo prefix, and names a real topic.
        expect(event.ids).toHaveLength(1)
        expect(event.ids[0]).toMatch(/^demo-[0-9a-f]{16}$/)
        expect(GALAXY.memories!.some(memory => memory.id === event.ids[0])).toBe(false)
        expect(typeof event.topic).toBe('string')
        expect(event.topic!.length).toBeGreaterThan(0)
      } else {
        // Update and forget touch a real memory.
        expect(event.ids).toHaveLength(1)
        expect(GALAXY.memories!.some(memory => memory.id === event.ids[0])).toBe(true)
      }
    }
    expect([...kinds].sort()).toEqual(['forget', 'save', 'update'])
  })

  test('EVT.2.a2: demo events carry demo true and reach nothing', () => {
    // The module imports no network client at all: a read of its import lines proves
    // the demo source cannot fetch, write the store or reach activity.jsonl.
    const source = readFileSync(join(ROOT, 'ui', 'map-live.ts'), 'utf8')
    const specifiers = [...source.matchAll(/^\s*import[^\n]*from\s+['"]([^'"]+)['"]/gm)].map(match => match[1]!)
    expect(specifiers).toEqual([])
    expect(source).not.toMatch(/\bfetch\s*\(/)
    const recall = simulate('recall', GALAXY, seeded(3))!
    const write = simulate('write', GALAXY, seeded(4))!
    expect(recall.demo).toBe(true)
    expect(write.demo).toBe(true)
  })

  test('EVT.2.a3: the shapes hold on an empty galaxy and on one project', () => {
    expect(simulate('recall', { projects: [], memories: [] })).toBeUndefined()
    expect(simulate('write', { projects: [], memories: [] })).toBeUndefined()
    const one = simulate('recall', { projects: [{ owner: 'global', count: 1 }], memories: [{ id: 'only', owner: 'global', tags: ['x'] }] }, seeded(9))!
    expect(one.owner).toBe('global')
    expect(one.ids).toEqual(['only'])
    expect(one.topic).toBe('x')
    // A tagless memory's topic is Untagged, as the galaxy groups it.
    expect(topicOf({ id: 'm' })).toBe('Untagged')
    expect(topicOf({ id: 'm', tags: ['', 3, ' veg '] })).toBe('veg')
    expect(demoId(seeded(5))).toMatch(/^demo-[0-9a-f]{16}$/)
  })
})

test('MAPX.5: an event finds its nodule by exact source, then mcp:<client>, else the sun\'s centre', () => {
  const sources = ['claude-code', 'mcp:cursor', 'import:doc']
  expect(noduleFor('claude-code', sources)).toBe('claude-code')
  expect(noduleFor('cursor', sources)).toBe('mcp:cursor')
  expect(noduleFor('mcp:cursor', sources)).toBe('mcp:cursor')
  expect(noduleFor('dashboard', sources)).toBeNull()
  expect(noduleFor('claude-code', [])).toBeNull()
  // The exact source wins over the mcp: form.
  expect(noduleFor('cursor', ['cursor', 'mcp:cursor'])).toBe('cursor')
})

test('MAPX.5: the dashboard\'s own recall draws nothing, every other event draws', () => {
  expect(drawsOnMap({ kind: 'recall', client: 'dashboard' })).toBe(false)
  expect(drawsOnMap({ kind: 'recall', client: 'claude-code' })).toBe(true)
  expect(drawsOnMap({ kind: 'forget', client: 'dashboard' })).toBe(true)
  expect(drawsOnMap({ kind: 'save', client: 'dashboard' })).toBe(true)
})
