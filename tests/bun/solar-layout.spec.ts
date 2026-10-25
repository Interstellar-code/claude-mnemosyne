// MAPX.4: the solar-system map's rules (ui/solar-layout.ts). The reply of GET /api/galaxy
// goes in (tests/bun/fixtures/galaxy-c11.json holds the mockup's 11 bodies in C11's shape);
// plain numbers and words come out. The EXPECTED numbers below were produced by running the
// approved mockup's own functions (docs/plans/mapx-design/solar-scene.js) on its own data.
import { describe, expect, test } from 'bun:test'
import fixture from './fixtures/galaxy-c11.json'
import {
  buildBodies,
  describe as describeBody,
  dotColour,
  extent,
  fnv,
  hashOf,
  labelName,
  linkInfos,
  linksOf,
  metric,
  noduleSpot,
  orbitSeconds,
  orbitSpeed,
  orbitTilt,
  planetR,
  projectLabel,
  searchResults,
  sizeClass,
  startAngle,
  styleOf,
  sunBelt,
  tagColour,
  targets,
  writerColour,
  writerInfos,
  WRITER_PALETTE,
} from '../../ui/solar-layout'
import type { Arrange, Body, SolarGalaxy, SolarProject, StyleId } from '../../ui/solar-layout'

const NOW = Date.parse('2026-10-25T12:00:00Z')
const DAY = 86400000
const galaxy = fixture as unknown as SolarGalaxy
const ARRANGES: Arrange[] = ['activity', 'size', 'age', 'recalls']

const bodiesOf = (g: Pick<SolarGalaxy, 'projects'> = galaxy): Body[] => buildBodies(g, NOW)
const byLabel = (bodies: Body[]): Record<string, Body> => Object.fromEntries(bodies.map(b => [b.label, b]))
const must = <T>(value: T | undefined): T => {
  if (value === undefined) throw new Error('missing')
  return value
}

/** A project in the reply's shape, with only what a test cares about set. */
function project(owner: string, over: Partial<SolarProject> = {}): SolarProject {
  const liveCount = over.liveCount ?? 10
  return {
    owner, label: projectLabel(owner), count: liveCount, recalls: 0, liveCount, kinds: [{ kind: 'fact', count: liveCount }], unknown: 0, global: 0,
    lastActive: new Date(NOW - DAY).toISOString(), activity30: liveCount, activitySource: 'lifetime', recallsTotal: 0, medianAgeDays: 1,
    firstSaved: new Date(NOW - 9 * DAY).toISOString(), tags: [], tagsTotal: 0, projectKind: 'repo', remoteHost: 'github.com', ...over,
  }
}
const galaxyOf = (projects: SolarProject[], over: Partial<SolarGalaxy> = {}): SolarGalaxy => ({ projects, memories: [], writers: [], globalLive: 0, ...over })
/** A repeatable shuffle: reversed, then rotated. */
const shuffled = <T>(list: T[]): T[] => list.slice().reverse().map((_, i, all) => all[(i + 3) % all.length] as T)

// What the mockup produced for its 11 bodies (ids are the labels).
const MOCKUP_STYLES = { matrixkoder: 'saturn', 'hermes-switchui': 'jupiter', 'cc-workflows': 'pluto', 'claude-mnemosyne': 'mars', 'orca-matrixkoder': 'mercury' }
const MOCKUP_ANGLE = { matrixkoder: 5.221, 'hermes-switchui': 1.333, 'cc-workflows': 3.031, 'claude-mnemosyne': 3.573, 'orca-matrixkoder': 0.12, cowork: 2.92, notes: 5.69, research: 5.001, scratch: 5.467, sandbox: 5.791, downloads: 5.128 }
const MOCKUP_MINUTES = { matrixkoder: 9.8, 'hermes-switchui': 10.7, 'cc-workflows': 2.6, 'claude-mnemosyne': 5.5, 'orca-matrixkoder': 4.8 }
const MOCKUP_RINGS: Record<Arrange, { groups: string[][]; radii: number[] }> = {
  activity: {
    groups: [['matrixkoder'], ['hermes-switchui'], ['cc-workflows'], ['claude-mnemosyne'], ['cowork'], ['notes'], ['research'], ['sandbox'], ['orca-matrixkoder'], ['scratch', 'downloads']],
    radii: [231.932, 440.732, 575.802, 661.464, 788.122, 916.507, 1033.286, 1115.077, 1194.637, 1298.825],
  },
  size: {
    groups: [['hermes-switchui'], ['matrixkoder'], ['cowork'], ['notes'], ['claude-mnemosyne'], ['research'], ['orca-matrixkoder'], ['scratch'], ['cc-workflows'], ['sandbox', 'downloads']],
    radii: [240.869, 449.67, 616.798, 745.182, 865.833, 980.886, 1089.837, 1194.025, 1271.053, 1323.453],
  },
  age: {
    groups: [['orca-matrixkoder'], ['sandbox'], ['claude-mnemosyne'], ['scratch'], ['downloads'], ['cc-workflows'], ['hermes-switchui'], ['matrixkoder'], ['cowork'], ['notes', 'research']],
    radii: [185.36, 264.92, 350.582, 460.873, 537.9, 590.3, 725.37, 934.171, 1101.298, 1229.682],
  },
  recalls: {
    groups: [['matrixkoder'], ['hermes-switchui'], ['cc-workflows'], ['claude-mnemosyne'], ['cowork'], ['notes'], ['research'], ['sandbox'], ['scratch'], ['orca-matrixkoder', 'downloads']],
    radii: [231.932, 440.732, 575.802, 661.464, 788.122, 916.507, 1033.286, 1115.077, 1192.105, 1296.293],
  },
}

describe('the fixture is the C11 reply for the mockup\'s 11 bodies', () => {
  test('every field of C11.1 to C11.3 is there', () => {
    const projectKeys = ['owner', 'label', 'count', 'recalls', 'liveCount', 'kinds', 'unknown', 'global', 'lastActive', 'activity30', 'activitySource', 'recallsTotal', 'medianAgeDays', 'firstSaved', 'tags', 'tagsTotal', 'projectKind', 'remoteHost']
    for (const p of galaxy.projects) expect(Object.keys(p).sort()).toEqual(projectKeys.slice().sort())
    const memoryKeys = ['id', 'owner', 'tags', 'recalls', 'lastRecalled', 'created', 'label', 'source', 'sourceInferred', 'kind', 'scope', 'importance', 'pinned', 'state', 'validUntil']
    for (const m of galaxy.memories) expect(Object.keys(m).sort()).toEqual(memoryKeys.slice().sort())
    expect(galaxy.writers.map(w => Object.keys(w).sort())).toEqual([['count', 'inferred', 'source'], ['count', 'inferred', 'source']])
    expect(galaxy.globalLive).toBe(6)
    expect(galaxy.links?.length).toBe(3)
    expect(galaxy.projects).toHaveLength(11)
  })
})

describe('orbit rings', () => {
  test.each(ARRANGES)('11 bodies give 10 rings with one shared pair, as the mockup does (%s)', arrange => {
    const bodies = bodiesOf()
    const orbits = targets(bodies, arrange)
    const label = (owner: string) => must(bodies.find(b => b.owner === owner)).label
    expect(orbits.rings).toHaveLength(10)
    expect(orbits.rings.filter(r => r.owners.length > 1)).toHaveLength(1)
    const want = MOCKUP_RINGS[arrange]
    // A shared ring lists its largest body first, so compare as sets within a ring.
    expect(orbits.rings.map(r => r.owners.map(label).sort())).toEqual(want.groups.map(g => g.slice().sort()))
    orbits.rings.forEach((ring, i) => expect(ring.radius).toBeCloseTo(must(want.radii[i]), 2))
    for (const body of bodies) expect(orbits.radius[body.owner]).toBe(must(orbits.rings[must(orbits.ringOf[body.owner])]).radius)
  })

  test('the shared pair is evenly spaced at the speed of its largest body, with one tilt', () => {
    const bodies = bodiesOf()
    const orbits = targets(bodies, 'activity')
    const ring = must(orbits.rings[9])
    expect(ring.owners.map(o => must(bodies.find(b => b.owner === o)).label)).toEqual(['scratch', 'downloads'])
    expect(ring.phases).toEqual([0, Math.PI])
    expect(ring.speed).toBe(orbitSpeed(must(byLabel(bodies).scratch)))
    expect(orbits.rings[0]?.tilt).not.toEqual(orbits.rings[1]?.tilt)
    expect(Math.abs(ring.tilt.x)).toBeLessThanOrEqual(0.06)
    expect(Math.abs(ring.tilt.z)).toBeLessThanOrEqual(0.06)
  })

  test('rings keep their order and every ring clears the one inside it', () => {
    const bodies = bodiesOf()
    for (const arrange of ARRANGES) {
      const { rings } = targets(bodies, arrange)
      for (let i = 1; i < rings.length; i++) expect(must(rings[i]).radius).toBeGreaterThan(must(rings[i - 1]).radius)
    }
  })

  test('25 bodies: 10 rings, rank i of n goes to ring 9 - floor((n-1-i)*10/n)', () => {
    const projects = Array.from({ length: 25 }, (_, i) => project(`project-body${String(i).padStart(2, '0')}-aa`, { liveCount: 100 - i, activity30: 100 - i }))
    const bodies = bodiesOf(galaxyOf(projects))
    const orbits = targets(bodies, 'size')
    expect(bodies).toHaveLength(25)
    expect(orbits.rings).toHaveLength(10)
    const n = 25
    const expected: string[][] = []
    for (let i = 0; i < n; i++) (expected[9 - Math.floor(((n - 1 - i) * 10) / n)] ??= []).push(`project-body${String(i).padStart(2, '0')}-aa`)
    // Rank follows the live count, so body00 is rank 0.
    orbits.rings.forEach((ring, i) => expect(ring.owners.slice().sort()).toEqual(must(expected[i]).slice().sort()))
    expect(orbits.rings.reduce((sum, r) => sum + r.owners.length, 0)).toBe(25)
    expect(orbits.rings.filter(r => r.owners.length > 1).length).toBeGreaterThan(0)
    // Each shared ring turns at the speed of its largest body, and its bodies are evenly spaced.
    for (const ring of orbits.rings) {
      const lead = must(bodies.find(b => b.owner === ring.owners[0]))
      expect(ring.speed).toBe(orbitSpeed(lead))
      ring.phases.forEach((phase, k) => expect(phase).toBeCloseTo((k * Math.PI * 2) / ring.owners.length, 10))
    }
  })

  test('10 bodies or fewer get a ring each; one project gets one ring', () => {
    const ten = bodiesOf(galaxyOf(Array.from({ length: 10 }, (_, i) => project(`project-p${i}-aa`, { liveCount: i + 1, activity30: i + 1 }))))
    expect(targets(ten, 'activity').rings.map(r => r.owners.length)).toEqual(Array(10).fill(1))
    const one = bodiesOf(galaxyOf([project('project-solo-aa', { liveCount: 12 })]))
    const orbits = targets(one, 'activity')
    expect(orbits.rings).toHaveLength(1)
    expect(must(orbits.rings[0]).radius).toBeCloseTo(140 + extent({ count: 12 }), 6)
    expect(targets([], 'activity').rings).toEqual([])
  })

  test('Arrange by moves the orbits: activity, size, age (younger closer) and recalls', () => {
    const bodies = bodiesOf()
    const m = byLabel(bodies)
    expect(metric(must(m.matrixkoder), 'activity')).toBe(416)
    expect(metric(must(m.matrixkoder), 'size')).toBe(48)
    expect(metric(must(m.matrixkoder), 'age')).toBe(-8.8)
    expect(metric(must(m.matrixkoder), 'recalls')).toBe(368)
  })

  test('an equal metric breaks by label, then owner', () => {
    const projects = [project('project-b-1', { liveCount: 5 }), project('project-a-2', { liveCount: 5 }), project('project-a-1', { liveCount: 5 })]
    expect(targets(bodiesOf(galaxyOf(projects)), 'size').rings.map(r => r.owners[0])).toEqual(['project-a-1', 'project-a-2', 'project-b-1'])
  })
})

describe('size, speed and style', () => {
  test('orbit times of about 11, 10, 5.5, 5 and 2.6 minutes (big bodies crawl)', () => {
    const m = byLabel(bodiesOf())
    for (const [label, minutes] of Object.entries(MOCKUP_MINUTES)) expect(orbitSeconds(orbitSpeed(must(m[label]))) / 60).toBeCloseTo(minutes, 1)
    expect(orbitSpeed({ count: 2 })).toBeCloseTo(0.04, 12)
    expect(orbitSpeed({ count: 62 })).toBeLessThan(orbitSpeed({ count: 7 }))
  })

  test('planetR, extent and the size classes', () => {
    expect(planetR({ count: 2 })).toBeCloseTo(9.1, 10)
    expect(planetR({ count: 62 })).toBeCloseTo((7 + Math.sqrt(62) * 2.5) * 1.4, 10)
    expect(extent({ count: 2 })).toBeCloseTo(planetR({ count: 2 }) * 2, 10)
    expect(extent({ count: 3 })).toBeCloseTo(planetR({ count: 3 }) * 2.7, 10)
    expect([0, 2, 3, 9, 10, 29, 30, 500].map(count => sizeClass({ count }))).toEqual([
      'dwarf (under 3 memories)', 'dwarf (under 3 memories)', 'rocky world (under 10)', 'rocky world (under 10)',
      'ice giant (10 to 29)', 'ice giant (10 to 29)', 'gas giant (30 or more)', 'gas giant (30 or more)',
    ])
  })

  test('the mockup\'s five real bodies get Saturn, Jupiter, Mars, Mercury and Pluto', () => {
    const m = byLabel(bodiesOf())
    for (const [label, style] of Object.entries(MOCKUP_STYLES)) expect(styleOf(must(m[label]))).toBe(style as StyleId)
    // A craft has no planet look.
    expect(styleOf(must(m.cowork))).toBeNull()
  })

  test('neighbours in a size class differ while the class has looks left', () => {
    const gas = bodiesOf(galaxyOf(['a', 'b'].map(n => project(`project-${n}-aa`, { liveCount: 40 }))))
    expect(new Set(gas.map(styleOf)).size).toBe(2)
    const rocky = bodiesOf(galaxyOf(['a', 'b', 'c', 'd'].map(n => project(`project-${n}-aa`, { liveCount: 6 }))))
    expect(new Set(rocky.map(styleOf)).size).toBe(4)
    for (const body of rocky) expect(['earth', 'mars', 'venus', 'mercury']).toContain(styleOf(body) as string)
  })

  test('the real owners project-<name>-<hash> give the same styles and angles as the mockup names', () => {
    const bodies = bodiesOf()
    for (const body of bodies) {
      expect(body.owner).toMatch(/^project-.+-[0-9a-f]{6}$/)
      expect(body.seed).toBe(body.label)
      expect(startAngle(body)).toBeCloseTo(must(MOCKUP_ANGLE[body.label as keyof typeof MOCKUP_ANGLE]), 3)
      expect(startAngle(body)).toBe((fnv(body.label) % 6283) / 1000)
    }
    // And no draw hashes the owner: the hash suffix of the owner changes nothing.
    const renamed = bodiesOf(galaxyOf(galaxy.projects.map(p => ({ ...p, owner: p.owner.replace(/-[0-9a-f]{6}$/, '-ffffff') }))))
    expect(renamed.map(b => [b.label, b.style, startAngle(b)])).toEqual(bodies.map(b => [b.label, b.style, startAngle(b)]))
  })

  test('every seeded draw hashes the label: tilt, tags and the start angle', () => {
    const body = must(byLabel(bodiesOf()).matrixkoder)
    expect(hashOf(body, 'orbit')).toBe(fnv('matrixkoderorbit'))
    expect(hashOf(body, '|workflow-rules')).toBe(fnv('matrixkoder|workflow-rules'))
    const tilt = orbitTilt(body)
    expect(Math.abs(tilt.x)).toBeLessThanOrEqual(0.06)
    expect(tilt.axis).toBeGreaterThanOrEqual(0.1)
    expect(tilt.axis).toBeLessThan(0.45)
    expect(orbitTilt(body)).toEqual(tilt)
  })
})

describe('plain folders and unregistered owners', () => {
  test('a plain folder: station at 5 or more memories, else a starship', () => {
    const m = byLabel(bodiesOf())
    expect(['cowork', 'notes', 'research'].map(l => must(m[l]).craft)).toEqual(['station', 'station', 'station'])
    expect(['scratch', 'sandbox', 'downloads'].map(l => must(m[l]).craft)).toEqual(['ship', 'ship', 'ship'])
    expect(['matrixkoder', 'hermes-switchui', 'cc-workflows'].map(l => must(m[l]).craft)).toEqual([null, null, null])
    const edge = bodiesOf(galaxyOf([project('project-four-aa', { projectKind: 'folder', liveCount: 4 }), project('project-five-aa', { projectKind: 'folder', liveCount: 5 })]))
    expect(edge.map(b => [b.label, b.craft])).toEqual([['five', 'station'], ['four', 'ship']])
  })

  test('an owner with no projects.json record is a planet marked "kind unknown"', () => {
    const [body] = bodiesOf(galaxyOf([project('project-fresh-aa', { projectKind: 'unknown', remoteHost: null, liveCount: 12 })]))
    expect(must(body).craft).toBeNull()
    expect(must(body).kindUnknown).toBe(true)
    expect(must(body).noRemote).toBe(false)
    expect(describeBody(must(body))).toContain('kind unknown')
    expect(describeBody(must(body))).not.toContain('no remote')
  })

  test('a local-only repo is a planet with the "no remote" mark', () => {
    const [body] = bodiesOf(galaxyOf([project('project-local-aa', { projectKind: 'repo', remoteHost: null, liveCount: 12 })]))
    expect(must(body).craft).toBeNull()
    expect(must(body).noRemote).toBe(true)
    expect(describeBody(must(body))).toMatch(/^(Neptune|Uranus)-like ice giant \(10 to 29\) · no remote \(local-only repo\)$/)
    // A remote with no network host records 'local': a repo, but not the "no remote" mark.
    const [local] = bodiesOf(galaxyOf([project('project-pathy-aa', { projectKind: 'repo', remoteHost: 'local', liveCount: 12 })]))
    expect(must(local).noRemote).toBe(false)
    expect(describeBody(must(local))).toContain('local remote')
  })

  test('describe and labelName', () => {
    const m = byLabel(bodiesOf())
    expect(describeBody(must(m.matrixkoder))).toBe('Saturn-like gas giant (30 or more) · repo on github.com')
    expect(describeBody(must(m.cowork))).toBe('Space station: a plain folder, no git repo')
    expect(describeBody(must(m.scratch))).toBe('Starship: a plain folder, no git repo')
    expect(labelName(must(m.matrixkoder))).toBe('matrixkoder')
    expect(labelName(must(m['cc-workflows']))).toBe('cc-workflows (dwarf)')
    expect(labelName(must(m.cowork))).toBe('cowork · station')
    expect(labelName(must(m.sandbox))).toBe('sandbox · starship')
  })
})

describe('labels, duplicates and the owner global', () => {
  test('the label is the owner without project- and the hash', () => {
    expect(projectLabel('project-matrixkoder-1a2b3c')).toBe('matrixkoder')
    expect(projectLabel('project-hermes-switchui-4d5e6f')).toBe('hermes-switchui')
    expect(projectLabel('plain')).toBe('plain')
  })

  test('two projects with the same label both hash label|owner, and a unique label hashes the label', () => {
    const projects = [project('project-api-aaaa', { liveCount: 8 }), project('project-api-bbbb', { liveCount: 8 }), project('project-web-cccc', { liveCount: 8 })]
    const bodies = bodiesOf(galaxyOf(projects))
    expect(bodies.map(b => b.seed)).toEqual(['api|project-api-aaaa', 'api|project-api-bbbb', 'web'])
    expect(bodies.map(b => b.label)).toEqual(['api', 'api', 'web'])
    expect(startAngle(must(bodies[0]))).not.toBe(startAngle(must(bodies[1])))
    expect(startAngle(must(bodies[0]))).toBe((fnv('api|project-api-aaaa') % 6283) / 1000)
    // Order does not matter; the tie breaks by label, then owner.
    expect(bodiesOf(galaxyOf(shuffled(projects)))).toEqual(bodies)
    expect(targets(bodies, 'size').rings.map(r => r.owners[0])).toEqual(['project-api-aaaa', 'project-api-bbbb', 'project-web-cccc'])
  })

  test('the owner global is never a planet, craft or chip; its rows feed the sun belt', () => {
    const withGlobal = galaxyOf([...galaxy.projects, project('global', { liveCount: 4, global: 4 })], { globalLive: 10 })
    const bodies = bodiesOf(withGlobal)
    expect(bodies).toHaveLength(11)
    expect(bodies.some(b => b.owner === 'global')).toBe(false)
    expect(Object.keys(targets(bodies, 'activity').radius)).not.toContain('global')
    expect(searchResults(bodies, 'global').match).toEqual({})
    // The six scope-global rows plus the four owner-global rows.
    const belt = sunBelt(withGlobal, bodies)
    expect(belt).toHaveLength(10)
    expect(belt.filter(item => item.owner === null)).toHaveLength(4)
    expect(sunBelt(galaxy, bodiesOf())).toHaveLength(6)
    expect(sunBelt(galaxy, bodiesOf()).filter(i => i.owner === 'project-matrixkoder-1a2b3c')).toHaveLength(3)
    expect(sunBelt(galaxyOf([]), [])).toEqual([])
  })

  test('a scope-global row still counts toward its own project\'s size', () => {
    const m = byLabel(bodiesOf())
    expect(must(m.matrixkoder).global).toBe(3)
    expect(must(m.matrixkoder).count).toBe(48)
    expect(sizeClass(must(m.matrixkoder))).toContain('gas giant')
  })

  test('sizes come from liveCount, not the count of all rows', () => {
    const m = must(byLabel(bodiesOf()).matrixkoder)
    expect(galaxy.projects[0]?.count).toBe(50)
    expect(m.count).toBe(48)
    expect(planetR(m)).toBeCloseTo(planetR({ count: 48 }), 10)
  })
})

describe('writers', () => {
  test('the real two writers take the mockup\'s colours', () => {
    const infos = writerInfos(galaxy.writers)
    expect(infos.map(w => [w.source, w.colour])).toEqual([['claude-code', '#56B4E9'], ['imported', '#CC79A7']])
    expect(writerColour(infos, 'imported')).toBe('#CC79A7')
    expect(writerColour(infos, 'nobody')).toBe('#56B4E9')
  })

  test('writers sort by count then name and wrap the palette after six', () => {
    const counts: Record<string, number> = { a: 17, b: 16, c: 15, d: 14, e: 13, f: 5, g: 5 }
    const infos = writerInfos(shuffled(Object.entries(counts).map(([source, count]) => ({ source, count, inferred: 0 }))))
    expect(infos.map(w => w.source)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'])
    expect(infos.map(w => w.colour)).toEqual([...WRITER_PALETTE, WRITER_PALETTE[0]])
    expect(writerInfos([{ source: 'x', count: 3, inferred: 0 }, { source: 'a', count: 3, inferred: 0 }]).map(w => w.source)).toEqual(['a', 'x'])
  })

  test('a nodule\'s place comes from a hash of the name', () => {
    const a = noduleSpot('claude-code')
    expect(noduleSpot('claude-code')).toEqual(a)
    expect(noduleSpot('imported')).not.toEqual(a)
    expect(noduleSpot('mcp:cursor')).not.toEqual(a)
    expect(Math.hypot(...a.dir)).toBeCloseTo(1, 10)
    expect(Math.abs(a.lat)).toBeLessThanOrEqual(0.6)
    expect(a.lon).toBeGreaterThanOrEqual(0)
    expect(a.lon).toBeLessThan(6.284)
    expect(writerInfos(galaxy.writers).map(w => w.dir)).toEqual([noduleSpot('claude-code').dir, noduleSpot('imported').dir])
  })
})

describe('surface: land masses, moons, ice cap, clouds', () => {
  test('at most 12 land masses; the rest of the tags are small islands', () => {
    const tags = Array.from({ length: 40 }, (_, i) => ({ tag: `tag-${String(i).padStart(2, '0')}`, count: 40 - i }))
    const [body] = bodiesOf(galaxyOf([project('project-big-aa', { liveCount: 60, tags, tagsTotal: 55 })]))
    expect(must(body).land).toHaveLength(12)
    expect(must(body).land[0]?.tag).toBe('tag-00')
    expect(must(body).islands).toBe(43)
    const [few] = bodiesOf(galaxyOf([project('project-few-aa', { tags: tags.slice(0, 5), tagsTotal: 5 })]))
    expect([must(few).land.length, must(few).islands]).toEqual([5, 0])
    // The mockup's matrixkoder: 12 listed of 27 tags.
    const m = must(byLabel(bodiesOf()).matrixkoder)
    expect([m.land.length, m.islands]).toEqual([12, 15])
  })

  test('at most 8 moons, one per kind except unknown; a dwarf or a craft has none', () => {
    const kinds = ['fact', 'decision', 'preference', 'instruction', 'context', 'error', 'artifact', 'event', 'custom', 'unknown'].map((kind, i) => ({ kind, count: 20 - i }))
    const [body] = bodiesOf(galaxyOf([project('project-moony-aa', { liveCount: 150, kinds })]))
    expect(must(body).moons).toHaveLength(8)
    expect(must(body).moons.map(k => k.kind)).not.toContain('unknown')
    expect(must(body).moons[0]?.kind).toBe('fact')
    const m = byLabel(bodiesOf())
    expect(must(m['cc-workflows']).moons).toEqual([])
    expect(must(m.cowork).moons).toEqual([])
    expect(must(m.matrixkoder).moons.map(k => k.kind)).toEqual(['instruction', 'decision', 'preference', 'context', 'fact'])
    expect(must(m['orca-matrixkoder']).moons.map(k => k.kind)).toEqual(['decision'])
  })

  test('the ice cap: the newest live memory saved or recalled 30 or more days ago', () => {
    const at = (days: number | null) => must(bodiesOf(galaxyOf([project('project-ice-aa', { lastActive: days === null ? null : new Date(NOW - days * DAY).toISOString() })]))[0]).iceCap
    expect([at(29.9), at(30), at(31), at(400), at(0), at(null)]).toEqual([false, true, true, true, false, false])
    expect(must(byLabel(bodiesOf()).notes).iceCap).toBe(true)
    expect(bodiesOf().filter(b => b.iceCap).map(b => b.label)).toEqual(['notes'])
  })

  test('the clouds: more than a quarter of the live memories are kind unknown', () => {
    const at = (unknown: number, liveCount = 8) => must(bodiesOf(galaxyOf([project('project-cloud-aa', { liveCount, unknown })]))[0]).clouds
    expect([at(0), at(2), at(3), at(8), at(0, 0)]).toEqual([false, false, true, true, false])
    const m = byLabel(bodiesOf())
    expect(must(m['orca-matrixkoder']).clouds).toBe(true)
    expect(bodiesOf().filter(b => b.clouds)).toHaveLength(1)
  })
})

describe('colours and words', () => {
  test('tagColour is the mockup\'s, by namespace', () => {
    expect(tagColour('workflow-rules')).toBe('hsl(80, 40%, 58%)')
    expect(tagColour('agent:codex')).toBe('hsl(290, 55%, 68%)')
    expect(tagColour('entity:x')).toBe('hsl(186, 55%, 60%)')
    expect(tagColour('asset:y')).toBe('hsl(32, 70%, 62%)')
  })

  test('dotColour: grey for unknown, writer colour, recalls, or age', () => {
    expect(dotColour('writer', 5, 'fact')).toBe('#56B4E9')
    expect(dotColour('writer', 5, 'fact', '#CC79A7')).toBe('#CC79A7')
    expect(dotColour('recalls', 5, 'fact')).toBe('hsl(48, 95%, 72%)')
    expect(dotColour('age', 5, 'fact')).toBe('hsl(255, 70%, 66%)')
    expect(dotColour('age', 5, 'unknown')).toBe('#8b93a3')
    expect(dotColour('writer', 5, 'unknown', '#CC79A7')).toBe('#8b93a3')
  })
})

describe('black holes', () => {
  test('links become older/newer pairs with a count and the best score', () => {
    const bodies = bodiesOf()
    const links = linkInfos(galaxy, bodies)
    const label = (o: string) => must(bodies.find(b => b.owner === o)).label
    expect(links.map(l => [label(l.older), label(l.newer), l.pairs, l.best])).toEqual([
      ['hermes-switchui', 'claude-mnemosyne', 3, 0.82],
      ['hermes-switchui', 'matrixkoder', 3, 0.81],
      ['matrixkoder', 'claude-mnemosyne', 2, 0.81],
    ])
    const mk = must(byLabel(bodies).matrixkoder).owner
    expect(linksOf(links, mk)).toHaveLength(2)
    expect(linksOf(links, must(byLabel(bodies).cowork).owner)).toEqual([])
  })

  test('no vectors means no links; a link to the owner global or an unknown owner is dropped', () => {
    const bodies = bodiesOf()
    expect(linkInfos({}, bodies)).toEqual([])
    const odd = { links: [{ a: 'global', b: bodies[0]?.owner ?? '', pairs: [{ older: 'x', newer: 'y', score: 0.9 }] }, { a: 'project-ghost-aa', b: bodies[0]?.owner ?? '', pairs: [{ older: 'x', newer: 'y', score: 0.9 }] }] }
    expect(linkInfos(odd, bodies)).toEqual([])
  })
})

describe('Find', () => {
  test('a project, a moon and a tag match; at most 10 results; short queries match nothing', () => {
    const bodies = bodiesOf()
    const hit = searchResults(bodies, 'matrix')
    expect(hit.results.map(r => [r.type, r.label])).toEqual([['Planet', 'matrixkoder'], ['Planet', 'orca-matrixkoder'], ['Tag', 'matrixkoder']])
    expect(Object.keys(hit.match).sort()).toEqual(['project-matrixkoder-1a2b3c', 'project-orca-matrixkoder-3a4b5c'])
    expect(hit.results[0]?.target).toEqual({ level: 'planet', owner: 'project-matrixkoder-1a2b3c' })

    const moon = searchResults(bodies, 'decision')
    expect(moon.results.some(r => r.type === 'Moon' && r.label === 'Decisions of matrixkoder')).toBe(true)
    expect(moon.results.find(r => r.label === 'Decisions of matrixkoder')?.target).toEqual({ level: 'moon', owner: 'project-matrixkoder-1a2b3c', kind: 'decision' })

    const station = searchResults(bodies, 'cowork')
    expect(station.results[0]?.type).toBe('Station')
    expect(searchResults(bodies, 'scratch').results[0]?.type).toBe('Starship')

    expect(searchResults(bodies, 'plan').results.length).toBeLessThanOrEqual(10)
    expect(searchResults(bodies, 'p').results).toEqual([])
    expect(searchResults(bodies, '  ').results).toEqual([])
    expect(searchResults(bodies, 'zzzz')).toEqual({ results: [], match: {} })
  })

  test('tags sort by use, a dwarf and a craft have no moons to find, and it ignores case', () => {
    const bodies = bodiesOf()
    const tags = searchResults(bodies, 'PLAN').results.filter(r => r.type === 'Tag')
    expect(tags.map(r => r.n)).toEqual(tags.map(r => r.n).slice().sort((a, b) => b - a))
    expect(tags[0]?.sub).toBe('20× on matrixkoder')
    // cc-workflows is a dwarf and cowork a station: their kinds are not moons.
    expect(searchResults(bodies, 'artifact').results.some(r => r.type === 'Moon' && /cc-workflows|cowork/.test(r.label))).toBe(false)
  })
})

describe('any order, same answer', () => {
  test('shuffling the projects changes no body, ring, style or search result', () => {
    const base = bodiesOf()
    const mixed = bodiesOf(galaxyOf(shuffled(galaxy.projects)))
    expect(mixed).toEqual(base)
    for (const arrange of ARRANGES) expect(targets(mixed, arrange)).toEqual(targets(base, arrange))
    expect(searchResults(mixed, 'plan')).toEqual(searchResults(base, 'plan'))
    expect(linkInfos({ links: shuffled(galaxy.links ?? []) }, mixed)).toEqual(linkInfos(galaxy, base))
    expect(writerInfos(shuffled(galaxy.writers))).toEqual(writerInfos(galaxy.writers))
  })

  test('one project and no global memories: one body, an empty sun belt, nothing breaks', () => {
    const only = galaxyOf([project('project-solo-aa', { liveCount: 3, tags: [{ tag: 'a', count: 1 }], tagsTotal: 1 })])
    const bodies = bodiesOf(only)
    expect(bodies).toHaveLength(1)
    expect(sunBelt(only, bodies)).toEqual([])
    expect(linkInfos(only, bodies)).toEqual([])
    expect(styleOf(must(bodies[0]))).toBe(must(bodies[0]).style)
    expect(targets(bodies, 'age').rings).toHaveLength(1)
    expect(searchResults(bodies, 'solo').results).toHaveLength(1)
  })

  test('a project with no live memories still has a body and an age that sorts oldest', () => {
    const bodies = bodiesOf(galaxyOf([project('project-empty-aa', { liveCount: 0, kinds: [], medianAgeDays: null, lastActive: null, firstSaved: null }), project('project-full-aa', { liveCount: 4 })]))
    expect(targets(bodies, 'age').rings.map(r => r.owners[0])).toEqual(['project-full-aa', 'project-empty-aa'])
    expect(must(bodies[0]).iceCap).toBe(false)
  })
})
