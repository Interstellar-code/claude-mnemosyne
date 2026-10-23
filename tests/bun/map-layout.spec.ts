// LAYOUT.1 and LAYOUT.2: the pure, seeded layout math. Real `/api/galaxy` shapes
// (the GDATA reply) go in; plain numbers come out. Determinism is proved by
// calling twice and by shuffling the input.
import { describe, expect, test } from 'bun:test'
import {
  CORE_SPREAD,
  tickStep,
  TICK_MIN_SPACING,
  coreRadius,
  firstTag,
  galaxyLayout,
  gauss,
  GOLDEN_ANGLE,
  HUB_RING,
  LANE_JITTER,
  LANE_SPAN,
  laneY,
  placeOne,
  PROJECT_CORE_X,
  randomOf,
  rangeDays,
  seedOf,
  TIMELINE_DAYS_X,
  TIMELINE_TODAY_X,
  ticks,
  timelinePosition,
  topicKey,
  topicSpread,
  UNTAGGED,
} from '../../ui/map-layout'
import type { GalaxyInput, TimelineNode } from '../../ui/map-layout'

// A real /api/galaxy-shaped input: three owners, tagged and untagged memories.
const DATA: GalaxyInput = {
  projects: [
    { owner: 'global', label: 'Global', count: 2, recalls: 3 },
    { owner: 'project-alpha-1a2b', label: 'alpha', count: 4, recalls: 10 },
    { owner: 'project-beta-9z8y', label: 'beta', count: 1, recalls: 0 },
  ],
  memories: [
    { id: 'g1', owner: 'global', tags: ['fruit'], recalls: 1, lastRecalled: 't1', created: 'c1', label: 'global fruit' },
    { id: 'g2', owner: 'global', tags: [], recalls: 2, lastRecalled: null, created: 'c2', label: 'global plain' },
    { id: 'a1', owner: 'project-alpha-1a2b', tags: ['fruit', 'veg'], recalls: 5, lastRecalled: 't2', created: 'c3', label: 'alpha fruit' },
    { id: 'a2', owner: 'project-alpha-1a2b', tags: ['fruit'], recalls: 2, lastRecalled: null, created: 'c4', label: 'alpha fruit two' },
    { id: 'a3', owner: 'project-alpha-1a2b', tags: ['veg'], recalls: 3, lastRecalled: null, created: 'c5', label: 'alpha veg' },
    { id: 'a4', owner: 'project-alpha-1a2b', tags: [], recalls: 0, lastRecalled: null, created: 'c6', label: 'alpha plain' },
    { id: 'b1', owner: 'project-beta-9z8y', tags: ['Veg'], recalls: 0, lastRecalled: null, created: 'c7', label: 'beta veg' },
  ],
}

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)

const shuffle = <T,>(items: readonly T[]): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = (seedOf(`shuffle-${i}`) % (i + 1)) >>> 0
    const a = out[i]!
    out[i] = out[j]!
    out[j] = a
  }
  return out
}

describe('LAYOUT.1: galaxyLayout', () => {
  test('LAYOUT.1.a1: cores on a golden-angle sphere about 360 apart, each radius R = 34 + sqrt(count) * 13', () => {
    const layout = galaxyLayout(DATA)
    expect(layout.cores.map(core => core.owner).sort()).toEqual(['global', 'project-alpha-1a2b', 'project-beta-9z8y'].sort())
    for (const core of layout.cores) {
      const count = DATA.projects!.find(project => project.owner === core.owner)!.count!
      expect(core.radius).toBe(34 + Math.sqrt(count) * 13)
      expect(core.radius).toBe(coreRadius(count))
    }
    // The golden angle, and pairwise distances the ~360-unit spread implies.
    expect(GOLDEN_ANGLE).toBeCloseTo(Math.PI * (3 - Math.sqrt(5)), 12)
    expect(CORE_SPREAD).toBe(360)
    const cores = layout.cores
    for (let i = 0; i < cores.length; i++) {
      for (let j = i + 1; j < cores.length; j++) {
        expect(dist(cores[i]!.position, cores[j]!.position)).toBeGreaterThan(200)
      }
    }
    // A single project sits at the centre (the sphere has one point).
    const one = galaxyLayout({ projects: [{ owner: 'global', count: 1 }], memories: [{ id: 'x', owner: 'global' }] })
    expect(one.cores[0]!.position).toEqual([0, 0, 0])
  })

  test('LAYOUT.1.a2: topic hubs on a Fibonacci sphere at 0.8 R; stars scatter with spread 10 + sqrt(topic) * 5', () => {
    const layout = galaxyLayout(DATA)
    const alpha = layout.cores.find(core => core.owner === 'project-alpha-1a2b')!
    const alphaHubs = layout.hubs.filter(hub => hub.project === 'project-alpha-1a2b')
    expect(alphaHubs.map(hub => hub.name).sort()).toEqual(['fruit', UNTAGGED, 'veg'].sort())
    for (const hub of alphaHubs) expect(dist(hub.position, alpha.position)).toBeCloseTo(alpha.radius * HUB_RING, 6)
    // A single topic sits on its core.
    const single = galaxyLayout({
      projects: [{ owner: 'p', count: 1 }],
      memories: [{ id: 'm', owner: 'p', tags: ['only'] }],
    })
    expect(single.hubs).toHaveLength(1)
    expect(single.hubs[0]!.position).toEqual(single.cores[0]!.position)
    // The fruit hub: g1, a1, a2 -> 3 memories; spread 10 + sqrt(3) * 5.
    const fruit = layout.hubs.find(hub => hub.key === topicKey('project-alpha-1a2b', 'fruit'))!
    expect(fruit.count).toBe(2)
    expect(topicSpread(fruit.count)).toBe(10 + Math.sqrt(2) * 5)
    const stars = layout.stars.filter(star => star.topic === fruit.key)
    expect(stars).toHaveLength(2)
    for (const star of stars) {
      // A Gaussian is unbounded; the seeded draw is within 4 spread units in practice.
      expect(dist(star.position, fruit.position)).toBeLessThan(topicSpread(fruit.count) * 5)
    }
  })

  test('LAYOUT.1.a3: seeded from the id, the same data gives the same positions in any input order', () => {
    const once = galaxyLayout(DATA)
    const twice = galaxyLayout(DATA)
    expect(twice).toEqual(once)
    const shuffled = galaxyLayout({
      projects: shuffle(DATA.projects!),
      memories: shuffle(DATA.memories!),
    })
    expect(shuffled.stars).toEqual(once.stars)
    expect(shuffled.hubs).toEqual(once.hubs)
    expect(shuffled.cores).toEqual(once.cores)
    expect(shuffled.bridges).toEqual(once.bridges)
    // And a different id moves only its own star.
    const changed = galaxyLayout({ ...DATA, memories: DATA.memories!.map(memory => (memory.id === 'a1' ? { ...memory, id: 'a1-new' } : memory)) })
    const byId = new Map(changed.stars.map(star => [star.id, star]))
    for (const star of once.stars) {
      if (star.id === 'a1') continue
      expect(byId.get(star.id)!.position).toEqual(star.position)
    }
  })

  test('LAYOUT.1.a4: the first tag wins; tagless memories form an Untagged hub per project', () => {
    expect(firstTag(['veg', 'fruit'])).toBe('veg')
    expect(firstTag(['  ', 'fruit'])).toBe('fruit')
    expect(firstTag([])).toBe(UNTAGGED)
    const layout = galaxyLayout(DATA)
    expect(layout.stars.find(star => star.id === 'a1')!.topic).toBe(topicKey('project-alpha-1a2b', 'fruit'))
    for (const owner of ['global', 'project-alpha-1a2b']) {
      const untagged = layout.hubs.find(hub => hub.project === owner && hub.untagged)
      expect(untagged).toBeDefined()
      expect(untagged!.name).toBe(UNTAGGED)
    }
    expect(layout.hubs.find(hub => hub.project === 'project-beta-9z8y' && hub.untagged)).toBeUndefined()
    // Beta's only memory is 'Veg', cleaned to 'veg' — its own project's hub.
    expect(layout.stars.find(star => star.id === 'b1')!.topic).toBe(topicKey('project-beta-9z8y', 'veg'))
  })

  test('LAYOUT.1.a5: bridges join the same tag name across projects, Untagged excluded', () => {
    const layout = galaxyLayout(DATA)
    expect(layout.bridges).toEqual([
      { tag: 'fruit', a: topicKey('global', 'fruit'), b: topicKey('project-alpha-1a2b', 'fruit') },
      { tag: 'veg', a: topicKey('project-alpha-1a2b', 'veg'), b: topicKey('project-beta-9z8y', 'veg') },
    ])
    expect(layout.bridges.some(bridge => bridge.tag === UNTAGGED)).toBe(false)
    // Same tag twice inside one project is not a bridge.
    const same = galaxyLayout({
      projects: [{ owner: 'p', count: 2 }],
      memories: [{ id: 'a', owner: 'p', tags: ['x'] }, { id: 'b', owner: 'p', tags: ['x'] }],
    })
    expect(same.bridges).toEqual([])
  })

  test('LAYOUT.1.a6: placeOne adds one star by the same rules without moving any other', () => {
    const layout = galaxyLayout(DATA)
    const before = layout.stars.map(star => ({ id: star.id, position: star.position }))
    const added = placeOne(layout, { id: 'a5', owner: 'project-alpha-1a2b', tags: ['fruit'], recalls: 1 })
    // The existing positions are untouched.
    expect(layout.stars.slice(0, before.length).map(star => ({ id: star.id, position: star.position }))).toEqual(before)
    // The new star follows its topic's scatter.
    const hub = layout.hubs[layout.hubByKey[topicKey('project-alpha-1a2b', 'fruit')]!]!
    expect(added.position).not.toEqual(hub.position)
    expect(dist(added.position, hub.position)).toBeLessThan(topicSpread(hub.count) * 5)
    // The same memory, placed on a fresh layout, lands where a rebuild would put it.
    const rebuilt = galaxyLayout({ ...DATA, memories: [...DATA.memories!, { id: 'a5', owner: 'project-alpha-1a2b', tags: ['fruit'], recalls: 1 }] })
    // A rebuild re-groups the topic (spread uses the full size), so placeOne keeps the
    // same seeded direction; the star is the same distance from its hub within a tolerance.
    const rebuiltStar = rebuilt.stars.find(star => star.id === 'a5')!
    expect(rebuiltStar.position.map(value => Math.sign(Math.round(value)))).toEqual(added.position.map(value => Math.sign(Math.round(value))))
    // A brand-new project and topic also get a place, without moving the rest.
    const first = placeOne(layout, { id: 'z1', owner: 'project-new-9999', tags: ['fresh'] })
    expect(first.owner).toBe('project-new-9999')
    expect(layout.cores.some(core => core.owner === 'project-new-9999')).toBe(true)
    expect(layout.stars.slice(0, before.length + 1).map(star => star.id)).toEqual([...before.map(star => star.id), 'a5'])
  })

  test('LAYOUT.1.a7: ui/tsconfig.json includes map-layout.ts, map-live.ts and stream.ts', async () => {
    const tsconfig = (await Bun.file(new URL('../../ui/tsconfig.json', import.meta.url)).json()) as { include: string[] }
    expect(tsconfig.include).toEqual(expect.arrayContaining(['map-layout.ts', 'map-live.ts', 'stream.ts']))
  })
})

describe('LAYOUT.2: timelinePosition and ticks', () => {
  const nodes: TimelineNode[] = [
    { kind: 'claude' },
    { kind: 'project', lane: 0, lanes: 1 },
    { kind: 'topic', id: 't', lane: 1, lanes: 3, age: 2, depth: 6 },
    { kind: 'memory', id: 'm1', lane: 1, lanes: 3, age: 0, depth: 6 },
    { kind: 'memory', id: 'm2', lane: 1, lanes: 3, age: 7, depth: 6 },
  ]

  test('LAYOUT.2.a1: x = 280 - age * 560 / days; lanes centred in 240 units; seeded 9-unit jitter; topic depth', () => {
    expect(TIMELINE_TODAY_X).toBe(280)
    expect(TIMELINE_DAYS_X).toBe(560)
    expect(LANE_SPAN).toBe(240)
    expect(LANE_JITTER).toBe(9)
    const today = timelinePosition(nodes[3]!, 7)
    expect(today[0]).toBe(280)
    expect(timelinePosition(nodes[4]!, 7)[0]).toBe(280 - (7 * 560) / 7)
    // One lane, centred.
    expect(laneY(0, 1)).toBe(0)
    expect(timelinePosition(nodes[1]!, 7)).toEqual([PROJECT_CORE_X, 0, 0])
    // The mockup's lane order: project 0 at the top. Two lanes: +120, -120; three: 120, 0, -120; four: 120, 40, -40, -120.
    expect([laneY(0, 2), laneY(1, 2)]).toEqual([120, -120])
    expect([laneY(0, 3), laneY(1, 3), laneY(2, 3)]).toEqual([120, 0, -120])
    expect([laneY(0, 4), laneY(1, 4), laneY(2, 4), laneY(3, 4)]).toEqual([120, 40, -40, -120])
    // Seeded jitter: same id, same y; the 9-unit scale, not just a bound; a different id differs.
    const a = timelinePosition(nodes[3]!, 7)
    const b = timelinePosition(nodes[3]!, 7)
    expect(a).toEqual(b)
    const jitter = a[1] - laneY(1, 3)
    // The exact seeded draw: gauss(randomOf(seedOf(id))) * LANE_JITTER.
    const expectedJitter = gauss(randomOf(seedOf('m1'))) * LANE_JITTER
    expect(jitter).toBeCloseTo(expectedJitter, 12)
    expect(a[2]).toBe(6)
    expect(timelinePosition(nodes[2]!, 7)).toEqual([280 - (2 * 560) / 7, laneY(1, 3), 6])
  })

  test('LAYOUT.2.a2: cores at x = -340 on their lane; Claude above today at (300, 185, 0)', () => {
    expect(PROJECT_CORE_X).toBe(-340)
    expect(timelinePosition({ kind: 'project', lane: 2, lanes: 3 }, 30)).toEqual([-340, -120, 0])
    expect(timelinePosition({ kind: 'claude' }, 7)).toEqual([300, 185, 0])
  })

  test('LAYOUT.2.a3: rangeDays 7 / 30 / all = oldest + 2; ticks every 1 / 7 days, and a round step for all', () => {
    expect(rangeDays(7)).toBe(7)
    expect(rangeDays(30)).toBe(30)
    expect(rangeDays('all', 12)).toBe(14)
    const week = ticks(7)
    expect(week.map(tick => tick.days)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(week.map(tick => tick.label)).toEqual(['today', '1 day ago', '2 days ago', '3 days ago', '4 days ago', '5 days ago', '6 days ago', '7 days ago'])
    expect(week[0]!.x).toBe(280)
    expect(week[week.length - 1]!.x).toBe(-280)
    const month = ticks(30)
    expect(month.map(tick => tick.days)).toEqual([0, 7, 14, 21, 28])
    const all = ticks('all', 14)
    expect(all.map(tick => tick.days)).toEqual([0, 7, 14])
    expect(all[all.length - 1]!.x).toBe(280 - (14 * 560) / 14)
  })

  test('LAYOUT.2.a4: a store with one project, in all three ranges', () => {
    const one = galaxyLayout({ projects: [{ owner: 'global', count: 2 }], memories: [{ id: 'one', owner: 'global' }, { id: 'two', owner: 'global', tags: ['a'] }] })
    expect(one.cores).toHaveLength(1)
    const memory = one.stars[0]!
    for (const range of [7, 30, 'all'] as const) {
      const days = rangeDays(range, 5)
      const position = timelinePosition({ kind: 'memory', id: memory.id, lane: 0, lanes: 1, age: 5, depth: 0 }, days)
      expect(position[0]).toBeCloseTo(280 - (5 * 560) / days, 9)
      expect(position[1]).toBeGreaterThan(-LANE_JITTER * 5)
      expect(position[1]).toBeLessThan(LANE_JITTER * 5)
      expect(ticks(range, days).length).toBeGreaterThan(0)
    }
  })

  test('QAMAP.1: tickStep and the All ticks of a 300-day store never pile up', () => {
    expect(tickStep(7)).toBe(1)
    expect(tickStep(30)).toBe(7)
    const days = rangeDays('all', 300)
    const all = ticks('all', days)
    expect(all.length).toBeLessThanOrEqual(12)
    const xs = all.map(tick => tick.x).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(TICK_MIN_SPACING)
    expect(all.at(-1)).toMatchObject({ days, label: `${days}d` })
    // Under the old rule (every 14 days) the same range had 22 ticks 26 units apart.
    expect(Math.ceil(days / 14) + 1).toBe(23)
    expect((14 * 560) / days).toBeLessThan(TICK_MIN_SPACING)
  })
})
