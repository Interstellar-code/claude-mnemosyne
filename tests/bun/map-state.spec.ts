// GAL: the memory galaxy's logic, tested without a browser. ui/map-state.ts and
// ui/escape.ts are pure (no DOM, no three.js), so this runs them directly on the
// real /api/galaxy reply of the real server and the real galaxyLayout output;
// ui/map.ts, the DOM side, is held by text gates (its label setters, no HTML
// sinks) and the page structure is read from the files the server serves.
// What needs a browser (bloom, glow look, flights, hover feel, frame time) is
// proved by the orchestrator's QA.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { plainLabel } from '../../ui/escape'
import { galaxyLayout } from '../../ui/map-layout'
import { simulate, toMapEvent, type MapEvent } from '../../ui/map-live'
import {
  addMemory,
  ageColour,
  announcement,
  BLOOM,
  BRIDGE_PARTICLES,
  buildGalaxy,
  type Candidate,
  coreSize,
  appName,
  coreTarget,
  DEMO_EVERY_MS,
  demoKind,
  demoTimerOn,
  enqueueSparks,
  eventStars,
  forgetMemory,
  layerOf,
  layerOn,
  leanRow,
  liveStars,
  newSparkPool,
  PULSE,
  pushRow,
  recallMemory,
  simulationInput,
  SPARK_COLOURS,
  SPARK_POOL,
  SPARK_SECONDS,
  SPARK_STAGGER,
  sparkAlpha,
  sparkAt,
  sparkProgress,
  sparksFor,
  stepSparks,
  STRIP_KEEP,
  STRIP_STORE,
  stripRow,
  stripRows,
  toggleLayer,
  toggleLive,
  touchMemory,
  ease,
  find,
  flightPose,
  flightProgress,
  flightSeconds,
  flightTo,
  foundText,
  focusProject,
  focusTopic,
  type Galaxy,
  GLOBAL_COLOUR,
  goTo,
  hasWebGL,
  HUB_SIZE,
  hubColour,
  hubLabelTarget,
  hubTarget,
  initialLayout,
  initialState,
  inspector,
  isClick,
  isHollow,
  labelScale,
  LAYOUT_KEY,
  matchesQuery,
  mixColour,
  NO_TOOLTIP,
  type MapState,
  pathBar,
  parseGalaxy,
  pickNearest,
  projectColour,
  projectRows,
  readLayout,
  recallColour,
  resetView,
  saveLayout,
  selectStar,
  selectedPulse,
  setColourBy,
  setLayout,
  setQuery,
  setRange,
  sharedWith,
  starBrightness,
  starColour,
  starSize,
  starTarget,
  starfield,
  STARFIELD_COUNT,
  threadOpacity,
  toggleProject,
  toggleRotation,
  tooltip,
  topicRows,
  type GalaxyReply,
} from '../../ui/map-state'
import { startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

// ---- A DOM-free stand-in built from the real index.html ----

class FakeText {
  constructor(public data: string) {}
  get textContent() {
    return this.data
  }
}

class FakeNode {
  children: (FakeNode | FakeText)[] = []
  attributes = new Map<string, string>()
  dataset: Record<string, string> = {}
  className = ''
  hidden = false
  disabled = false
  checked = false
  title = ''
  type = ''
  value = ''
  style: Record<string, string> = {}
  listeners = new Map<string, ((event: unknown) => void)[]>()
  groups: FakeNode[] = []
  parentElement: FakeNode | null = null
  classList = { toggle: () => {}, add: () => {}, contains: () => false }
  constructor(public tagName: string) {}
  get textContent(): string {
    return this.children.map(child => child.textContent).join('')
  }
  set textContent(value: string) {
    this.children = value === '' ? [] : [new FakeText(String(value))]
  }
  append(...nodes: (FakeNode | FakeText | string)[]) {
    for (const node of nodes) this.children.push(typeof node === 'string' ? new FakeText(node) : node)
  }
  replaceChildren(...nodes: (FakeNode | FakeText | string)[]) {
    this.children = []
    this.append(...nodes)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value))
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  fire(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
  focus() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 }
  }
  all(): FakeNode[] {
    return [this, ...this.children.flatMap(child => (child instanceof FakeNode ? child.all() : []))]
  }
  texts(): string[] {
    return this.children.flatMap(child => (child instanceof FakeNode ? child.texts() : [child.data]))
  }
  // Static buttons of a group (data-layout, data-range, data-colour) are made from the markup; the rest is searched in the children.
  querySelectorAll(selector: string): FakeNode[] {
    const attr = /\[(data-[a-z]+)\]/.exec(selector)?.[1]
    const key = attr?.replace('data-', '')
    const from = this.groups.length > 0 ? this.groups : this.all().filter(n => n.tagName === 'button' || n.tagName === 'input')
    return from.filter(n => key === undefined || n.dataset[key] !== undefined)
  }
  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null
  }
}

/** One FakeNode for every id in the markup, and the data- buttons of the three segmented groups. */
function fakeDom(html: string) {
  const nodes = new Map<string, FakeNode>()
  for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = new FakeNode(match[1]!.toLowerCase())
    node.hidden = /\bhidden\b/.test(match[0].replace(/id="[^"]*"/, ''))
    nodes.set(match[2]!, node)
  }
  for (const group of ['map-layout', 'map-range', 'map-colour']) {
    const start = html.indexOf(`id="${group}"`)
    const block = html.slice(start, html.indexOf('</div>', start))
    for (const button of block.matchAll(/<button\b[^>]*data-(\w+)="([^"]+)"[^>]*>/g)) {
      const node = new FakeNode('button')
      node.dataset[button[1]!] = button[2]!
      node.disabled = /\bdisabled\b/.test(button[0])
      nodes.get(group)!.groups.push(node)
    }
  }
  // The Live pill is the parent of the state text.
  nodes.get('map-live-state')!.parentElement = new FakeNode('span')
  const document = {
    createElement: (tag: string) => new FakeNode(tag.toLowerCase()),
    createTextNode: (data: string) => new FakeText(data),
    getElementById: (id: string) => nodes.get(id) ?? null,
    activeElement: null,
  }
  return { document, nodes }
}
const MARKUP = '<img src=x onerror=alert(1)>'

// ---- A real /api/galaxy reply, from the real server over a real temporary store ----

type Reply = GalaxyReply & { memories: { id: string; owner: string }[] }

describe('the galaxy on a real /api/galaxy reply', () => {
  const temp = tempDir('map-state')
  const store = join(temp.dir, 'store')
  let started: Started
  let reply: GalaxyReply
  let galaxy: Galaxy
  let rawBody: unknown
  const ids: Record<string, string> = {}
  const now = Date.parse('2026-10-23T12:00:00Z')

  async function remember(owner: string, name: string, content: string, metadata?: Record<string, unknown>) {
    const answer = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...(metadata ? { metadata } : {}) })])).get(1))
    if (typeof answer?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(answer)}`)
    ids[name] = answer.memory_id as string
  }

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    await remember('global', 'g1', 'global fruit note', { tags: ['fruit'] })
    await remember('project-alpha-1a2b', 'a1', 'alpha fruit and veg', { tags: ['fruit', 'veg'] })
    await remember('project-alpha-1a2b', 'a2', 'alpha plain note')
    await remember('project-alpha-1a2b', 'a3', 'alpha fruit again', { tags: ['fruit'] })
    await remember('project-alpha-1a2b', 'a4', 'alpha veg note', { tags: ['veg'] })
    await remember('project-beta-9z8y', 'b1', `${MARKUP} beta markup`, { tags: ['Fruit'] })
    await remember('project-beta-9z8y', 'b2', 'beta veg', { tags: ['veg'] })
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      for (const [name, n] of [['g1', 1], ['a1', 5], ['a3', 3], ['b1', 9]] as [string, number][]) db.run('UPDATE working_memory SET recall_count = ? WHERE id = ?', [n, ids[name]!])
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: join(temp.dir, 'activity.jsonl'), pluginRoot: ROOT })
    const response = await fetch(`http://127.0.0.1:${started.port}/api/galaxy`, { headers: { Authorization: `Bearer ${started.token}` } })
    expect(response.status).toBe(200)
    rawBody = await response.json()
    const parsed = parseGalaxy(rawBody)
    if (parsed === null) throw new Error('not a galaxy')
    reply = parsed
    galaxy = buildGalaxy(reply, now)
  }, 120_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  const star = (name: string) => galaxy.layout.stars[galaxy.layout.starById[ids[name]!]!]!
  const index = (name: string) => galaxy.layout.starById[ids[name]!]!
  const alpha = 'project-alpha-1a2b'
  const beta = 'project-beta-9z8y'
  const base = (): MapState => initialState({ reducedMotion: false })
  const name = (owner: string) => galaxy.layout.cores[galaxy.layout.coreByOwner[owner]!]!.label

  test('GAL.1.a1: every star sits at its galaxyLayout position, and the layout is the real one', () => {
    expect(reply.memories.length).toBe(7)
    expect(galaxy.layout).toEqual(galaxyLayout({ projects: reply.projects, memories: reply.memories }))
    for (const name of ['g1', 'a1', 'b2']) expect(star(name).position.every(Number.isFinite)).toBe(true)
  })

  test('GAL.1.a3: size 7 + sqrt(recalls) * 3.4, brightness 0.4..1 by age, a hollow ring when never recalled', () => {
    expect(starSize(0)).toBe(7)
    expect(starSize(9)).toBeCloseTo(7 + 3 * 3.4)
    expect(starSize(star('b1').recalls)).toBeCloseTo(7 + 3 * 3.4)
    expect(starBrightness(0, 70)).toBe(1)
    expect(starBrightness(70, 70)).toBeCloseTo(0.4)
    expect(starBrightness(35, 70)).toBeCloseTo(0.7)
    expect(starBrightness(5, 0)).toBe(1)
    expect(isHollow(star('a2').recalls)).toBe(true)
    expect(isHollow(star('a1').recalls)).toBe(false)
    expect(star('a1').recalls).toBe(5)
  })

  test('GAL.1.a4: colour by project, by recalls (#2C5C7A to #FFD978 by sqrt share) and by age (#7DF4FF to #5B3F9A)', () => {
    expect(galaxy.maxRecalls).toBe(9)
    expect(starColour(galaxy, index('a1'), 'project')).toBe(projectColour(galaxy, alpha))
    expect(starColour(galaxy, index('g1'), 'project')).toBe(GLOBAL_COLOUR)
    expect(starColour(galaxy, index('b1'), 'recalls')).toBe('#FFD978')
    expect(starColour(galaxy, index('a2'), 'recalls')).toBe('#2C5C7A')
    expect(recallColour(1, 4)).toBe(mixColour('#2C5C7A', '#FFD978', 0.5))
    expect(ageColour(0, 10)).toBe('#7DF4FF')
    expect(ageColour(10, 10)).toBe('#5B3F9A')
    expect(ageColour(3, 0)).toBe('#7DF4FF')
    // Every colour mode gives a colour, and a new project colour differs from the other.
    expect(projectColour(galaxy, alpha)).not.toBe(projectColour(galaxy, beta))
  })

  test('GAL.1.a5: cores 26 + sqrt(count) * 4, hubs 11 with the project colour 45% toward white', () => {
    expect(coreSize(0)).toBe(26)
    expect(coreSize(9)).toBe(38)
    expect(HUB_SIZE).toBe(11)
    expect(hubColour('#000000')).toBe(mixColour('#000000', '#FFFFFF', 0.45))
    expect(hubColour('#FFFFFF')).toBe('#FFFFFF')
    expect(galaxy.layout.cores.map(core => core.owner).sort()).toEqual(['global', alpha, beta])
  })

  test('GAL.1.a6: threads 0.16 (0.3 focused), bridges are real hub pairs (fruit and veg) with 4 particles', () => {
    expect(threadOpacity(false)).toBe(0.16)
    expect(threadOpacity(true)).toBe(0.3)
    expect(BRIDGE_PARTICLES).toBe(4)
    const pairs = galaxy.layout.bridges.map(b => [b.tag, b.a, b.b].join('|')).sort()
    expect(pairs).toContain(`fruit|${alpha}/fruit|${beta}/fruit`)
    expect(pairs).toContain(`fruit|global/fruit|${alpha}/fruit`)
    expect(pairs).toContain(`veg|${alpha}/veg|${beta}/veg`)
    // alpha's fruit is shared with global's and beta's fruit.
    expect(sharedWith(galaxy, `${alpha}/fruit`)).toEqual([name('global'), name(beta)].sort((x, y) => x.localeCompare(y)))
    expect(sharedWith(galaxy, `${alpha}/Untagged`)).toEqual([])
  })

  test('GAL.1.a7: bloom 0.95 / 0.55 / 0.12; labels shrink with distance, clamp(distance / 520, 0.2, 1)', () => {
    expect(BLOOM).toEqual({ strength: 0.95, radius: 0.55, threshold: 0.12 })
    expect(labelScale(1000)).toBe(1)
    expect(labelScale(260)).toBe(0.5)
    expect(labelScale(10)).toBe(0.2)
  })

  test('GAL.1.a2: the starfield is 2400 points on a shell 1600 to 2800 out, the same every time', () => {
    const sky = starfield()
    expect(sky.length).toBe(STARFIELD_COUNT * 3)
    expect(STARFIELD_COUNT).toBe(2400)
    let min = Infinity
    let max = 0
    for (let i = 0; i < STARFIELD_COUNT; i++) {
      const r = Math.hypot(sky[i * 3]!, sky[i * 3 + 1]!, sky[i * 3 + 2]!)
      min = Math.min(min, r)
      max = Math.max(max, r)
    }
    expect(min).toBeGreaterThanOrEqual(1599.9)
    expect(max).toBeLessThanOrEqual(2800.1)
    expect(Array.from(starfield().slice(0, 12))).toEqual(Array.from(sky.slice(0, 12)))
  })

  test('GAL.2.a1: the tooltip says topic · project, recalls, saved date and label; a hub and a core say how many and "Click to fly in"', () => {
    const s = star('a1')
    const words = tooltip(galaxy, { kind: 'star', id: s.id, sx: 0, sy: 0 })!
    expect(words.title).toBe(`fruit · ${name(alpha)}`)
    expect(words.sub).toMatch(/^5 recalls · saved \d{4}-\d{2}-\d{2} — alpha fruit and veg$/)
    expect(tooltip(galaxy, { kind: 'star', id: star('b1').id, sx: 0, sy: 0 })!.sub).toContain(MARKUP)
    expect(tooltip(galaxy, { kind: 'hub', id: `${alpha}/fruit`, sx: 0, sy: 0 })).toEqual({ title: 'Topic: fruit', sub: `2 memories in ${name(alpha)}. Click to fly in.` })
    expect(tooltip(galaxy, { kind: 'core', id: alpha, sx: 0, sy: 0 })).toEqual({ title: name(alpha), sub: '4 memories, 3 topics. Click to fly in.' })
    expect(tooltip(galaxy, { kind: 'star', id: 'nope', sx: 0, sy: 0 })).toBeNull()
  })

  test('GAL.2.a2: a core focuses its project (others dim to 0.14, topic labels show) and flies to 4.2 R; a hub focuses the topic (siblings 0.4) and flies to 150; a star is selected, pulses, and flies to 170', () => {
    const projectState = focusProject(base(), alpha)
    expect(projectState).toMatchObject({ project: alpha, topic: null, selected: null })
    const bright = (i: number, s: MapState) => starTarget(galaxy, i, s, null)
    const plain = bright(index('a1'), base())
    expect(bright(index('a1'), projectState)).toBeCloseTo(plain)
    expect(bright(index('b1'), projectState)).toBeCloseTo(starTarget(galaxy, index('b1'), base(), null) * 0.14)
    expect(hubLabelTarget(projectState, alpha)).toBe(0.95)
    expect(hubLabelTarget(projectState, beta)).toBe(0)
    expect(hubLabelTarget(base(), alpha)).toBe(0)
    const core = galaxy.layout.cores[galaxy.layout.coreByOwner[alpha]!]!
    expect(flightTo(galaxy, 'core', alpha)).toEqual({ target: core.position, distance: core.radius * 4.2 })

    const topicState = focusTopic(base(), galaxy, `${alpha}/veg`)
    expect(topicState).toMatchObject({ project: alpha, topic: `${alpha}/veg` })
    expect(bright(index('a3'), topicState)).toBeCloseTo(starTarget(galaxy, index('a3'), projectState, null) * 0.4)
    expect(bright(index('a1'), topicState)).toBeCloseTo(starTarget(galaxy, index('a1'), projectState, null) * 0.4)
    expect(flightTo(galaxy, 'hub', `${alpha}/veg`)!.distance).toBe(150)
    expect(focusTopic(base(), galaxy, 'nope/none')).toEqual(base())

    const selected = selectStar(base(), galaxy, star('a3').id)
    expect(selected).toMatchObject({ project: alpha, topic: `${alpha}/fruit`, selected: star('a3').id })
    expect(bright(index('a3'), selected)).toBe(1)
    expect(selectedPulse(0)).toBeCloseTo(0.22)
    expect(selectedPulse(Math.PI / 8)).toBeCloseTo(0.36)
    expect(flightTo(galaxy, 'star', star('a3').id)).toEqual({ target: star('a3').position, distance: 170 })
    expect(selectStar(base(), galaxy, 'nope')).toEqual(base())
  })

  test('GAL.2.a3: the path bar reads All memories > project > topic, each part goes back, Reset view clears focus and Find and flies to 720', () => {
    const deep = selectStar(base(), galaxy, star('a3').id)
    expect(pathBar(deep, galaxy).map(c => [c.label, c.level, c.current])).toEqual([
      ['All memories', 'all', false],
      [name(alpha), 'project', false],
      ['fruit', 'topic', false],
    ])
    expect(pathBar(goTo(deep, 'topic'), galaxy)[2]).toMatchObject({ level: 'topic', current: true })
    expect(goTo(deep, 'topic').selected).toBeNull()
    const project = goTo(deep, 'project')
    expect(project).toMatchObject({ project: alpha, topic: null, selected: null })
    expect(pathBar(project, galaxy).map(c => c.label)).toEqual(['All memories', name(alpha)])
    const searched = setQuery(deep, 'fruit')
    const cleared = goTo(searched, 'all')
    expect(cleared).toMatchObject({ project: null, topic: null, selected: null, query: '' })
    expect(resetView(searched)).toEqual(cleared)
    expect(pathBar(cleared, galaxy)).toEqual([{ label: 'All memories', level: 'all', current: true }])
    expect(flightTo(galaxy, 'reset')).toEqual({ target: [0, 0, 0], distance: 720 })
  })

  test('GAL.2.a4: Find matches a tag, the project or the label (not full text), dims non-matches to 0.08, counts them, flies to the centre at 260 (520 above 20)', () => {
    const fruit = find(galaxy, 'fruit')
    expect([...fruit.ids].sort()).toEqual([ids.a1!, ids.a3!, ids.b1!, ids.g1!].sort())
    expect(fruit.count).toBe(4)
    expect(fruit.distance).toBe(260)
    expect(fruit.centre).not.toBeNull()
    expect(find(galaxy, 'ALPHA').count).toBe(4)
    // The project's label, a tag, and the label text all match; text beyond the label does not.
    expect(find(galaxy, 'onerror').count).toBe(1)
    expect(find(galaxy, 'zzz')).toEqual({ ids: new Set(), count: 0, centre: null, distance: 260 })
    expect(find(galaxy, '   ').count).toBe(0)
    const longLabel = { ...reply.memories[0]!, label: `${'x'.repeat(100)} needle`.slice(0, 80) }
    const cut = buildGalaxy({ ...reply, memories: [longLabel], shown: 1 }, now)
    expect(matchesQuery(cut, cut.layout.stars[0]!, 'needle')).toBe(false)
    expect(foundText('fruit', fruit)).toBe('4 found')
    expect(foundText('', fruit)).toBe('')
    const searching = setQuery(base(), 'fruit')
    expect(starTarget(galaxy, index('a1'), searching, fruit)).toBeCloseTo(starTarget(galaxy, index('a1'), base(), null))
    expect(starTarget(galaxy, index('a2'), searching, fruit)).toBeCloseTo(starTarget(galaxy, index('a2'), base(), null) * 0.08)
    // Many matches: the camera stands further back.
    const many = buildGalaxy({ ...reply, memories: Array.from({ length: 25 }, (_, i) => ({ ...reply.memories[0]!, id: `m${i}`, tags: ['fruit'] })), shown: 25 }, now)
    expect(find(many, 'fruit')).toMatchObject({ count: 25, distance: 520 })
  })

  test('GAL.2.a5: a drag over 5 px is an orbit, never a click; the nearest star under the pointer is picked, faint ones are not', () => {
    expect(isClick({ x: 10, y: 10 }, { x: 13, y: 14 })).toBe(true)
    expect(isClick({ x: 10, y: 10 }, { x: 10, y: 16 })).toBe(false)
    const near: Candidate = { kind: 'star', id: 'a', sx: 100, sy: 100, radius: 10, alpha: 1 }
    const nearer: Candidate = { kind: 'star', id: 'b', sx: 104, sy: 100, radius: 10, alpha: 1 }
    const faint: Candidate = { kind: 'star', id: 'c', sx: 100, sy: 100, radius: 10, alpha: 0.1 }
    expect(pickNearest([near, nearer, faint], 103, 100)).toMatchObject({ id: 'b' })
    expect(pickNearest([faint], 100, 100)).toBeNull()
    expect(pickNearest([near], 120, 100)).toBeNull()
    expect(pickNearest([{ kind: 'core', id: 'p', sx: 50, sy: 50, radius: 22, alpha: 1 }, near], 60, 55)).toMatchObject({ kind: 'core' })
  })

  test('GAL.2.a5: flights take 1.2 s with a cubic ease, and none under prefers-reduced-motion', () => {
    expect(flightSeconds(false)).toBe(1.2)
    expect(flightSeconds(true)).toBe(0)
    expect(flightProgress(0, 0.6, 1.2)).toBeCloseTo(0.5)
    expect(flightProgress(0.9, 1, 1.2)).toBe(1)
    expect(flightProgress(0, 0.016, 0)).toBe(1)
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(0.5)).toBeCloseTo(0.5)
    expect(ease(0.25)).toBeCloseTo(0.0625)
    const pose = flightPose([0, 0, 100], [0, 0, 0], { target: [10, 20, 30], distance: 50 })
    expect(pose.target).toEqual([10, 20, 30])
    expect(pose.position).toEqual([10, 20, 80])
  })

  test('GAL.2.a6: every setting the scene reacts to is plain data in the state, changed by pure functions', () => {
    const s = base()
    expect(Object.keys(s).sort()).toEqual(['bridges', 'colourBy', 'hidden', 'layerRecall', 'layerWrite', 'layout', 'live', 'project', 'query', 'range', 'reducedMotion', 'rotating', 'selected', 'spokes', 'topic'].sort())
    expect(setColourBy(s, 'age').colourBy).toBe('age')
    expect(setColourBy(s, 'nope' as never)).toBe(s)
    expect(setRange(s, 7).range).toBe(7)
    expect(setRange(s, 'all')).toBe(s)
    expect(toggleRotation(s).rotating).toBe(!s.rotating)
    expect(s).toEqual(base())
    // The scene file reads its state in one place per frame.
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    expect(map).toMatch(/function syncSettings\(\)/)
    expect(map).toMatch(/syncSettings\(\)\s*\n\s*stepFlight/)
  })

  test('GAL.3.a2: the inspector: Overview, Project, Topic and Memory as in the mockup', () => {
    const overview = inspector(galaxy, base())
    expect(overview).toMatchObject({ kind: 'Overview', title: '7 memories', sub: '' })
    expect(overview.stats).toEqual([
      { label: 'Memories', value: '7' },
      { label: 'Recalls, all time', value: '18' },
      { label: 'Never recalled', value: '3' },
      { label: 'Topics', value: String(galaxy.layout.hubs.length) },
      { label: 'Bridges', value: String(galaxy.layout.bridges.length) },
    ])
    const project = inspector(galaxy, focusProject(base(), alpha))
    expect(project).toMatchObject({ kind: 'Project', title: name(alpha) })
    expect(project.stats.map(s => s.label)).toEqual(['Memories', 'Topics', 'Recalls', 'Never recalled'])
    expect(project.stats[0]!.value).toBe('4')
    const topic = inspector(galaxy, focusTopic(base(), galaxy, `${alpha}/fruit`))
    expect(topic).toMatchObject({ kind: 'Topic', title: 'fruit' })
    expect(topic.stats.find(s => s.label === 'Shared with')!.value).toContain(name(beta))
    expect(inspector(galaxy, focusTopic(base(), galaxy, `${alpha}/Untagged`)).stats.find(s => s.label === 'Shared with')!.value).toBe('none')
    const memory = inspector(galaxy, selectStar(base(), galaxy, ids.b1!))
    expect(memory).toMatchObject({ kind: 'Memory', title: 'fruit', sub: name(beta) })
    expect(memory.memory).toEqual({ text: plainLabel(star('b1').label, 80), tags: ['Fruit'], id: ids.b1! })
    expect(memory.stats.map(s => s.label)).toEqual(['Project', 'Recalls', 'Saved', 'Tags'])
    // The Knowledge and Similar sections are there and empty until MOON and SEM.
    expect(memory.knowledge?.note).toBe('Nothing extracted from this memory yet.')
    expect(memory.similar?.note).toBe('Similar memories need embeddings.')
    expect(inspector(galaxy, selectStar(base(), galaxy, ids.a2!)).hint).toBe('Never recalled: a candidate to review or forget.')
    expect(announcement(galaxy, base())).toBe('All memories: 7 memories')
    expect(announcement(galaxy, focusProject(base(), alpha))).toBe(`Project: ${name(alpha)}`)
  })

  test('GAL.3.a1: the rail lists the projects (hide, count) and, for a focused project, its topics with a shared mark', () => {
    const rows = projectRows(galaxy, base())
    expect(rows.map(r => [r.owner, r.count, r.shown, r.focused]).sort()).toEqual([['global', 1, true, false], [alpha, 4, true, false], [beta, 2, true, false]].sort())
    const hidden = toggleProject(focusProject(base(), alpha), alpha)
    expect(projectRows(galaxy, hidden).find(r => r.owner === alpha)).toMatchObject({ shown: false, focused: false })
    // Hiding the focused project clears the focus; showing it again keeps none.
    expect(hidden).toMatchObject({ project: null, topic: null, selected: null })
    expect(toggleProject(hidden, alpha).hidden).toEqual({})
    expect(starTarget(galaxy, index('a1'), hidden, null)).toBe(0)
    expect(coreTarget(hidden, alpha)).toBe(0)
    expect(hubTarget(hidden, alpha, `${alpha}/fruit`)).toBe(0)
    // Toggling another project leaves the focus.
    expect(toggleProject(focusProject(base(), alpha), beta).project).toBe(alpha)
    expect(topicRows(galaxy, base())).toEqual([])
    const topics = topicRows(galaxy, focusTopic(base(), galaxy, `${alpha}/fruit`))
    expect(topics.map(t => [t.name, t.count, t.shared, t.focused]).sort()).toEqual([['Untagged', 1, false, false], ['fruit', 2, true, true], ['veg', 1, true, false]])
    expect(coreTarget(focusProject(base(), alpha), beta)).toBe(0.35)
    expect(coreTarget(base(), beta)).toBe(1)
    expect(hubTarget(base(), alpha, `${alpha}/fruit`)).toBe(0.55)
    expect(hubTarget(focusProject(base(), alpha), beta, `${beta}/fruit`)).toBe(0.1)
    expect(hubTarget(focusTopic(base(), galaxy, `${alpha}/fruit`), alpha, `${alpha}/veg`)).toBe(0.5)
  })

  test('createMap on the page markup: the rail, path bar, Find and inspector work from the real reply, with no WebGL in the way', async () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const fake = fakeDom(html)
    const g = globalThis as Record<string, unknown>
    const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement }
    g.document = fake.document
    g.HTMLElement = class {}
    ;(globalThis as Record<string, unknown>).CSS = { escape: (v: string) => v }
    try {
      // A path tsc does not follow: ui/map.ts is DOM code, checked by ui/tsconfig.json.
      const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => { visible: (shown: boolean) => void; show: (id: string) => void } }
      const opened: string[] = []
      const statuses: string[] = []
      const view = createMap({ api: async () => new Response(JSON.stringify(rawBody), { status: 200 }), openMemory: (id: string) => opened.push(id), status: (text: string) => void statuses.push(text) })
      await Bun.sleep(30)
      expect(statuses).toEqual([])
      const node = (id: string) => fake.nodes.get(id)!
      // No WebGL in this runner: the map area says so, and the page still works.
      expect(node('map-message').textContent).toContain('needs WebGL')
      expect(typeof view.visible).toBe('function')
      expect(typeof view.show).toBe('function')
      // Projects: one row each (checkbox, dot, name, count).
      const rows = node('map-toggles').children as FakeNode[]
      expect(rows.length).toBe(3)
      expect(rows.map(row => row.texts().join('|')).sort().join(' ')).toContain('alpha')
      expect(node('map-path').texts()).toEqual(['All memories'])
      expect(node('map-inspector').texts()).toContain('Overview')
      expect(node('map-topics-box').hidden).toBe(true)
      expect(node('map-sim-recall').disabled).toBe(false)
      // Clicking a project's name focuses it: the path, the inspector and the topics list follow.
      const alphaRow = rows.find(row => row.texts().join('').includes('alpha'))!
      alphaRow.all().find(n => n.tagName === 'button')!.fire('click', { preventDefault() {} })
      expect(node('map-path').texts()).toEqual(['All memories', '›', 'alpha'])
      expect(node('map-inspector').texts()).toContain('Project')
      expect(node('map-topics-box').hidden).toBe(false)
      expect(node('map-topics-title').textContent).toBe('Topics in alpha')
      expect((node('map-topics').children as FakeNode[]).length).toBe(3)
      // A topic row selects the topic; the path bar's project crumb goes back to the project.
      ;(node('map-topics').children as FakeNode[])[0]!.fire('click')
      expect(node('map-path').texts().filter(t => t !== '›').length).toBe(3)
      node('map-path').all().filter(n => n.tagName === 'button')[1]!.fire('click')
      expect(node('map-path').texts().filter(t => t !== '›')).toEqual(['All memories', 'alpha'])
      // Find counts the matches; Reset view clears it and the focus.
      node('map-find').value = 'fruit'
      node('map-find').fire('input')
      expect(node('map-found').textContent).toBe('4 found')
      node('map-reset').fire('click')
      expect(node('map-find').value).toBe('')
      expect(node('map-found').textContent).toBe('')
      expect(node('map-path').texts()).toEqual(['All memories'])
      // Hiding a project from the rail.
      rows[0]!.all().find(n => n.tagName === 'input')!.fire('change')
      expect(node('map-toggles').children.length).toBe(3)
      // Layout: Timeline shows the Time range and is remembered; Meaning stays disabled.
      const layout = (name: string) => node('map-layout').querySelectorAll('button[data-layout]').find(b => b.dataset.layout === name)!
      layout('timeline').fire('click')
      expect(node('map-range-box').hidden).toBe(false)
      expect(layout('timeline').attributes.get('aria-pressed')).toBe('true')
      layout('meaning').fire('click')
      expect(layout('meaning').attributes.get('aria-pressed')).toBe('false')
      layout('galaxy').fire('click')
      expect(node('map-range-box').hidden).toBe(true)
      // show(id) selects that star and opens it in the inspector; Open in Memories hands its id to the host.
      view.show(ids.a1!)
      expect(node('map-inspector').texts()).toContain('Memory')
      node('map-inspector').all().find(n => n.textContent === 'Open in Memories')!.fire('click')
      expect(opened).toEqual([ids.a1!])
    } finally {
      g.document = saved.document
      g.CSS = saved.CSS
      g.HTMLElement = saved.HTMLElement
    }
  })

  test('LIVE: real activity lines play on the map: a save adds a star, a recall and an update count, a forget removes one; failed, extract and unknown lines draw nothing; demo events change nothing and ask nothing', async () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const fake = fakeDom(html)
    const g = globalThis as Record<string, unknown>
    const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement }
    g.document = fake.document
    g.CSS = { escape: (v: string) => v }
    g.HTMLElement = class {}
    try {
      const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => { visible: (shown: boolean) => void; show: (id: string) => void } }
      const asked: string[] = []
      let push: (line: Record<string, unknown>) => void = () => {}
      let stopped = 0
      const newId = 'a'.repeat(32)
      createMap({
        api: async (path: string) => {
          asked.push(path)
          if (path === '/api/galaxy') return new Response(JSON.stringify(rawBody), { status: 200 })
          if (path === `/api/memories/${newId}`) {
            return new Response(JSON.stringify({ id: newId, owner: alpha, content: `\n  A brand new note about veg\nsecond line`, recall_count: 0, timestamp: new Date().toISOString(), tags: ['veg'], metadata: { tags: ['veg'] } }), { status: 200 })
          }
          return new Response('{"error":"not found"}', { status: 404 })
        },
        openMemory: () => {},
        status: () => {},
        events: (listener: (line: Record<string, unknown>) => void) => {
          push = listener
          return () => stopped++
        },
      })
      await Bun.sleep(40)
      const node = (id: string) => fake.nodes.get(id)!
      const stat = (label: string) => {
        const texts = node('map-inspector').texts()
        return texts[texts.indexOf(label) + 1]
      }
      const strip = () => (node('map-feed').children as FakeNode[]).map(row => row.texts().join(' | '))
      const line = (action: string, ids: string[], extra: Record<string, unknown> = {}) => ({ t: new Date().toISOString(), action, origin: 'tool', owner: alpha, text: 'x', ids, count: ids.length, ok: true, client: 'claude-code', session: 'a1b2c3d4-0000-4000-8000-aaaaaaaaaaaa', ...extra })
      const play = async (l: Record<string, unknown>) => {
        push(l)
        await Bun.sleep(25)
      }
      const callsBefore = asked.length
      expect(node('map-inspector').texts()).toContain('7 memories')
      expect(strip()).toEqual(['No activity yet.'])
      expect(stat('Memories')).toBe('7')
      expect(stat('Recalls, all time')).toBe('18')

      // A save: the memory is fetched with the existing route, placed, and counted everywhere.
      const before = 0
      await play(line('remember', [newId]))
      expect(asked.slice(callsBefore)).toEqual([`/api/memories/${newId}`])
      expect(node('map-inspector').texts()).toContain('8 memories')
      expect(stat('Memories')).toBe('8')
      expect(strip()[0]).toContain('Saved a new memory')
      expect(strip()[0]).toContain('Claude Code')
      expect(strip()[0]).toContain('save')

      // A recall of two ids, one of them not on the map: one found.
      await play(line('recall', [ids.a1!, 'f'.repeat(32)]))
      expect(strip()[0]).toContain('Recalled 1')
      expect(stat('Recalls, all time')).toBe('19')

      // An update, then a forget of a never-recalled memory.
      await play(line('update', [ids.a3!]))
      expect(strip()[0]).toContain('Updated a memory in place')
      expect(stat('Never recalled')).toBe('4')
      await play(line('forget', [ids.a2!]))
      expect(strip()[0]).toContain('Forgot a memory')
      expect(stat('Memories')).toBe('7')
      expect(stat('Never recalled')).toBe('3')
      expect(node('map-inspector').texts()).toContain('7 memories')
      // The project's count in the rail fell too.
      expect(node('map-toggles').texts().join(' ')).toContain('alpha')

      // Lines that draw nothing: failed, extract, stats, and ids that are not on the map.
      const rows = strip().length
      await play(line('recall', [ids.a1!], { ok: false, error: 'engine down' }))
      await play(line('extract', [ids.a1!], { origin: 'hook', count: 3 }))
      await play(line('stats', []))
      await play(line('recall', ['e'.repeat(32)]))
      await play(line('forget', ['d'.repeat(32)]))
      expect(strip().length).toBe(rows)
      expect(stat('Recalls, all time')).toBe('19')

      // A forgotten memory forgotten again, or recalled, does nothing.
      await play(line('forget', [ids.a2!]))
      await play(line('recall', [ids.a2!]))
      expect(strip()[0]).toContain('Forgot a memory')
      expect(stat('Memories')).toBe('7')

      // The strip holds the last four.
      for (let i = 0; i < 6; i++) await play(line('recall', [ids.b1!]))
      expect(strip().length).toBe(STRIP_KEEP)

      // Layers: with Recall off its rows go; Write rows stay.
      node('map-layer-recall').checked = false
      node('map-layer-recall').fire('change')
      expect(strip().every(row => !row.includes('Recalled'))).toBe(true)
      expect(strip()[0]).toContain('Forgot a memory')
      node('map-layer-recall').checked = true
      node('map-layer-recall').fire('change')
      expect(strip()[0]).toContain('Recalled')

      // Simulate buttons: demo rows with a "demo" badge, nothing asked of the server, no count changed.
      const asking = asked.length
      const total = stat('Memories')
      const recallsAll = stat('Recalls, all time')
      expect(node('map-sim-recall').disabled).toBe(false)
      for (let i = 0; i < 4; i++) {
        node('map-sim-recall').fire('click')
        node('map-sim-write').fire('click')
        await Bun.sleep(15)
      }
      expect(strip().some(row => row.includes('demo'))).toBe(true)
      expect(strip().length).toBe(STRIP_KEEP)
      expect(asked.length).toBe(asking)
      expect(stat('Memories')).toBe(total)
      expect(stat('Recalls, all time')).toBe(recallsAll)
      // Live On is the pill's text; pressing the pill pauses it.
      expect(node('map-live-state').textContent).toBe('On')
      node('map-live-state').parentElement!.fire('click')
      expect(node('map-live-state').textContent).toBe('Paused')
    } finally {
      g.document = saved.document
      g.CSS = saved.CSS
      g.HTMLElement = saved.HTMLElement
    }
  })
})

// ---- Shapes the real store above does not make ----

const reply = (memories: GalaxyReply['memories'], extra: Partial<GalaxyReply> = {}): GalaxyReply => ({
  projects: [],
  memories,
  meaning: false,
  total: memories.length,
  shown: memories.length,
  ...extra,
})
const memory = (id: string, owner = 'global', extra: Partial<GalaxyReply['memories'][number]> = {}) => ({ id, owner, tags: [], recalls: 0, lastRecalled: null, created: null, label: id, ...extra })

describe('GAL.3.a5: the overview, and the layout the map opens on', () => {
  test('when shown < total the overview says "showing n of m"', () => {
    const cut = buildGalaxy(reply([memory('a'), memory('b')], { total: 2000, shown: 2 }))
    expect(inspector(cut, initialState({ reducedMotion: false }))).toMatchObject({ kind: 'Overview', title: '2000 memories', sub: 'showing 2 of 2000' })
    const whole = buildGalaxy(reply([memory('a')]))
    expect(inspector(whole, initialState({ reducedMotion: false })).sub).toBe('')
    expect(inspector(whole, initialState({ reducedMotion: false })).title).toBe('1 memory')
  })

  test('Galaxy the first time, then the last layout picked; Galaxy when Meaning is unavailable', () => {
    expect(initialLayout(null, false)).toBe('galaxy')
    expect(initialLayout('timeline', false)).toBe('timeline')
    expect(initialLayout('meaning', false)).toBe('galaxy')
    expect(initialLayout('meaning', true)).toBe('meaning')
    expect(initialLayout('nonsense', true)).toBe('galaxy')
    const s = initialState({ reducedMotion: false })
    expect(setLayout(s, 'meaning', false)).toBe(s)
    expect(setLayout(s, 'timeline', false).layout).toBe('timeline')
    expect(setLayout(s, 'galaxy', false)).toBe(s)
  })

  test('the layout is kept in storage, and a storage that throws is ignored', () => {
    const kept: Record<string, string> = {}
    const storage = { getItem: (k: string) => kept[k] ?? null, setItem: (k: string, v: string) => void (kept[k] = v) }
    saveLayout(storage, 'timeline')
    expect(kept[LAYOUT_KEY]).toBe('timeline')
    expect(readLayout(storage)).toBe('timeline')
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readLayout(broken)).toBeNull()
    expect(() => saveLayout(broken, 'galaxy')).not.toThrow()
    expect(readLayout(undefined)).toBeNull()
  })

  test('reduced motion starts the map still: no auto-rotate, no live', () => {
    expect(initialState({ reducedMotion: true })).toMatchObject({ rotating: false, live: false, reducedMotion: true })
    expect(initialState({ reducedMotion: false })).toMatchObject({ rotating: true, live: true })
  })
})

describe('the reply is untrusted', () => {
  test('parseGalaxy keeps rows with an id, fixes wrong types, and cuts a label to 80 characters of plain text', () => {
    expect(parseGalaxy(null)).toBeNull()
    expect(parseGalaxy([])).toBeNull()
    const parsed = parseGalaxy({
      projects: [{ owner: 'p', label: 7, count: -4, recalls: 'x' }, { nope: 1 }],
      memories: [{ id: 'a', owner: 'p', tags: ['t', 5, ''], recalls: 'many', label: `${MARKUP}\n${'y'.repeat(200)}` }, { owner: 'p' }, 'junk'],
      meaning: 'yes',
      total: 'lots',
    })!
    expect(parsed.projects).toEqual([{ owner: 'p', label: 'p', count: 0, recalls: 0 }])
    expect(parsed.memories).toHaveLength(1)
    expect(parsed.memories[0]).toMatchObject({ id: 'a', tags: ['t'], recalls: 0, created: null })
    expect(Array.from(parsed.memories[0]!.label).length).toBeLessThanOrEqual(80)
    expect(parsed.memories[0]!.label.startsWith(MARKUP)).toBe(true)
    expect(parsed).toMatchObject({ meaning: false, total: 1, shown: 1 })
  })

  test('an empty galaxy is a valid galaxy', () => {
    const empty = buildGalaxy(reply([]))
    expect(inspector(empty, initialState({ reducedMotion: false })).title).toBe('0 memories')
    expect(projectRows(empty, initialState({ reducedMotion: false }))).toEqual([])
    expect(find(empty, 'x').count).toBe(0)
  })
})

describe('the Find box and the rail on lines with no tags, a global memory and a missing date', () => {
  test('a memory with no tags is in Untagged, saved unknown, and picks no bridge', () => {
    const g = buildGalaxy(reply([memory('a', 'project-x-1', { recalls: 2 }), memory('b', 'project-y-2')]))
    const view = inspector(g, selectStar(initialState({ reducedMotion: false }), g, 'a'))
    expect(view.title).toBe('Untagged')
    expect(view.stats.find(s => s.label === 'Saved')!.value).toBe('unknown')
    expect(g.layout.bridges).toEqual([])
  })
})

// ---- Left from v1 ----

describe('MAP.3.a8: plainLabel', () => {
  test('markup comes back as the same characters, never escaped', () => {
    expect(plainLabel(MARKUP, 80)).toBe(MARKUP)
    expect(plainLabel('<script>alert(1)</script> & "x"', 80)).toBe('<script>alert(1)</script> & "x"')
  })

  test('cuts to max and removes control characters', () => {
    expect(plainLabel('abcdef', 4)).toBe('abc…')
    expect(Array.from(plainLabel('é'.repeat(100), 80))).toHaveLength(80)
    expect(plainLabel('a\u0000b\u0007c\u007fd\u009be', 80)).toBe('abcde')
    expect(plainLabel('one\ntwo\r\n\tthree', 80)).toBe('one two three')
    expect(plainLabel('‮evil‬ txt', 80)).toBe('evil txt')
    expect(plainLabel('a؜b', 80)).toBe('ab')
    expect(plainLabel('one two three\u0085four', 80)).toBe('one two three four')
    expect(plainLabel('  pad  ', 80)).toBe('pad')
  })
})

describe('MAP.3.a9: NO_TOOLTIP is the only label accessor ui/map.ts sets', () => {
  const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')

  test('NO_TOOLTIP returns an empty string', () => {
    expect(NO_TOOLTIP()).toBe('')
  })

  test('map.ts passes NO_TOOLTIP to nodeLabel and linkLabel and to no other label setter, and shows hover text with textContent', () => {
    expect(labelSetters(map)).toEqual(['nodeLabel(NO_TOOLTIP)', 'linkLabel(NO_TOOLTIP)'])
    expect(map).toMatch(/tip\.replaceChildren\(el\('strong', words\.title/)
    expect(map).not.toMatch(/\binnerHTML\b|insertAdjacentHTML|outerHTML/)
  })

  test('the gate fails when a label setter takes anything else', () => {
    expect(labelSetters('g.nodeLabel(n => n.label).linkLabel(NO_TOOLTIP)')).toEqual(['nodeLabel(n => n.label)', 'linkLabel(NO_TOOLTIP)'])
    expect(labelSetters('g.nodeLabel("name")')).not.toEqual(['nodeLabel(NO_TOOLTIP)', 'linkLabel(NO_TOOLTIP)'])
  })
})

/** Every call of the library's label setters (nodeLabel, linkLabel), as written, argument included. */
function labelSetters(source: string): string[] {
  return [...source.matchAll(/\b((?:node|link)Label)\(((?:[^()]|\([^()]*\))*)\)/g)].map(match => `${match[1]}(${match[2]})`)
}

describe('MAP.3.a10: WebGL detection', () => {
  test('hasWebGL is false when getContext gives null or throws, true otherwise', () => {
    expect(hasWebGL(() => ({ getContext: () => null }))).toBe(false)
    expect(
      hasWebGL(() => ({
        getContext: () => {
          throw new Error('blocked')
        },
      })),
    ).toBe(false)
    expect(
      hasWebGL(() => {
        throw new Error('no canvas')
      }),
    ).toBe(false)
    expect(hasWebGL(() => ({ getContext: () => ({}) }))).toBe(true)
    let lost = 0
    expect(hasWebGL(() => ({ getContext: () => ({ getExtension: () => ({ loseContext: () => lost++ }) }) }))).toBe(true)
    expect(lost).toBe(1)
  })
})

describe('MAP.3.a11: the page files are in the inert scan', () => {
  test('ui/map.ts, ui/map-state.ts and ui/escape.ts parse no HTML', () => {
    const sinks = /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\s*\.\s*write|\beval\s*\(|\bnew\s+Function\b/
    for (const file of ['map.ts', 'map-state.ts', 'escape.ts']) {
      const text = readFileSync(join(ROOT, 'ui', file), 'utf8')
      expect({ file, sink: sinks.test(text) }).toEqual({ file, sink: false })
    }
  })
})

// ---- GAL.3: the page structure the server serves ----

describe('GAL.3.a1/a3/a4: the Map page has the rail in order, the overlay controls, the live strip, the legend and an empty inspector', () => {
  const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
  const css = readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')
  const page = html.slice(html.indexOf('id="view-map"'), html.indexOf('id="view-memories"'))
  const at = (needle: string) => page.indexOf(needle)

  test('the rail cards come in the order Layout, Colour by, Links, Knowledge, Activity layers, Projects, Topics', () => {
    const order = ['id="map-layout"', 'id="map-colour"', 'id="map-spokes"', 'id="map-know"', 'id="map-layer-recall"', 'id="map-toggles"', 'id="map-topics-box"']
    const places = order.map(at)
    expect(places.every(place => place > 0)).toBe(true)
    expect([...places].sort((a, b) => a - b)).toEqual(places)
  })

  test('Layout offers Galaxy, Meaning (disabled) and Timeline, the Time range is hidden until Timeline, and the colour modes are the three', () => {
    expect([...page.matchAll(/data-layout="(\w+)"([^>]*)>/g)].map(m => [m[1], /\bdisabled\b/.test(m[2]!)])).toEqual([['galaxy', false], ['meaning', true], ['timeline', false]])
    expect(page).toMatch(/id="map-range-box"[^>]*\bhidden\b/)
    expect([...page.matchAll(/data-range="(\w+)"/g)].map(m => m[1])).toEqual(['7', '30', 'all'])
    expect([...page.matchAll(/data-colour="(\w+)"/g)].map(m => m[1])).toEqual(['project', 'recalls', 'age'])
    // Time range labels are never clipped.
    expect(css).toMatch(/\.seg-btn\s*\{[^}]*white-space:\s*nowrap/)
  })

  test('Links: threads and bridges are on; Similar memories and Knowledge moons are disabled; the five knowledge chips are inert', () => {
    const box = (id: string) => new RegExp(`id="${id}"[^>]*>`).exec(page)![0]
    expect(box('map-spokes')).toMatch(/checked/)
    expect(box('map-bridges')).toMatch(/checked/)
    expect(box('map-similar')).toMatch(/disabled/)
    expect(box('map-moons')).toMatch(/disabled/)
    expect([...page.matchAll(/data-kind="(\w+)"[^>]*aria-disabled="true"/g)].map(m => m[1])).toEqual(['fact', 'preference', 'instruction', 'timeline', 'relation'])
  })

  test('the overlay: path bar, Find, Auto-rotate, Reset view, Simulate a recall and a write; under the map the live strip', () => {
    for (const id of ['map-path', 'map-find', 'map-found', 'map-rotate', 'map-reset', 'map-sim-recall', 'map-sim-write', 'map-live-strip', 'map-live-state', 'map-feed', 'map-tip', 'map-canvas']) expect(page).toContain(`id="${id}"`)
    expect(at('id="map-stage"')).toBeLessThan(at('id="map-live-strip"'))
    expect(page).toMatch(/id="map-find"[^>]*maxlength="80"/)
    expect(page).toContain('No activity yet.')
  })

  test('the Reading the map card explains size, brightness, hollow ring, gold arc, cyan link, Claude core, sparks and moons', () => {
    const legend = page.slice(at('id="map-legend"'))
    for (const word of ['Size', 'Brightness', 'Hollow ring', 'Gold arc', 'Cyan link', 'Claude core', 'Sparks', 'Moons']) expect(legend).toContain(word)
    expect(legend).toContain('Reading the map')
  })

  test('the inspector is filled by the page, and no old v1 control is left', () => {
    expect(page).toMatch(/<aside id="map-inspector"[^>]*><\/aside>/)
    for (const gone of ['map-min', 'map-list', 'map-list-heading']) expect(page).not.toContain(`id="${gone}"`)
  })

  test('every id ui/map.ts looks up is in the markup (a missing one would stop the whole tab)', () => {
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const wanted = [...new Set([...map.matchAll(/byId(?:<[^>]*>)?\('([^']+)'\)/g)].map(m => m[1]!).concat([...map.matchAll(/for \(const id of \[([^\]]+)\]/g)].flatMap(m => [...m[1]!.matchAll(/'([^']+)'/g)].map(x => x[1]!))))]
    expect(wanted.length).toBeGreaterThan(20)
    const have = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]!))
    expect(wanted.filter(id => !have.has(id))).toEqual([])
  })

  test('GAL.3.a7: no inline style or script on the Map page', () => {
    expect(page).not.toMatch(/\sstyle=|<script|\son\w+=/)
  })
})

// ---- GAL.4: v1's drill-down is gone ----

describe('GAL.4: nothing in ui/ is left of the level-by-level map', () => {
  const read = (file: string) => readFileSync(join(ROOT, 'ui', file), 'utf8')
  test('no page file calls /api/map', () => {
    for (const file of ['app.ts', 'map.ts', 'map-state.ts', 'escape.ts', 'map-layout.ts']) expect({ file, uses: /\/api\/map\b/.test(read(file)) }).toEqual({ file, uses: false })
  })

  test('the drill state, its requests and its cached replies are not exported', async () => {
    const state = (await import('../../ui/map-state')) as Record<string, unknown>
    for (const name of ['select', 'needed', 'receive', 'requestPath', 'requestKey', 'railList', 'drawn', 'levelAnnouncement', 'setMinRecalls', 'projectNodeId', 'topicNodeId', 'memoryNodeId', 'layout']) expect(name in state).toBe(false)
    const text = read('map-state.ts') + read('map.ts')
    expect(text).not.toMatch(/MapRequest|min_recalls|minRecalls|Level\b.*'memory'/)
  })

  test('every export of map-state.ts is used by map.ts or a spec', () => {
    const exports = [...read('map-state.ts').matchAll(/^export (?:const|function|type) (\w+)/gm)].map(m => m[1]!)
    const users = read('map.ts') + readFileSync(join(ROOT, 'tests', 'bun', 'map-state.spec.ts'), 'utf8')
    const unused = exports.filter(name => !new RegExp(`\\b${name}\\b`).test(users))
    expect(unused).toEqual([])
  })
})

export type { Reply }

// ---- LIVE: events change the galaxy, the strip, the sparks ----

const LIVE_NOW = Date.parse('2026-10-23T12:00:00Z')
const liveReply = reply(
  [
    memory('m1', 'project-x-1', { tags: ['fruit'], recalls: 2, created: '2026-10-20T12:00:00Z', label: 'apple' }),
    memory('m2', 'project-x-1', { tags: ['fruit'], recalls: 0, created: '2026-10-10T12:00:00Z', label: 'pear' }),
    memory('m3', 'project-y-2', { tags: ['fruit'], recalls: 5, created: '2026-10-22T12:00:00Z', label: 'plum' }),
    memory('m4', 'global', { recalls: 0, created: '2026-09-01T12:00:00Z', label: 'loose note' }),
  ],
  { projects: [{ owner: 'project-x-1', label: 'x', count: 2, recalls: 2 }, { owner: 'project-y-2', label: 'y', count: 1, recalls: 5 }, { owner: 'global', label: 'Global', count: 1, recalls: 0 }] },
)
const freshGalaxy = () => buildGalaxy(liveReply, LIVE_NOW)
const calm = () => initialState({ reducedMotion: false })
const event = (kind: MapEvent['kind'], ids: string[], extra: Partial<MapEvent> = {}): MapEvent => ({ kind, ids, client: 'claude-code', t: '2026-10-23T10:15:30.000Z', owner: 'project-x-1', ...extra })

describe('LIVE.1: what an event does to the galaxy', () => {
  test('LIVE.1.a1: an event keeps only the ids that are stars on the map', () => {
    const g = freshGalaxy()
    expect(eventStars(g, event('recall', ['m1', 'nope', 'm3']))).toEqual(['m1', 'm3'])
    expect(eventStars(g, event('recall', ['nope']))).toEqual([])
    forgetMemory(g, 'm1')
    expect(eventStars(g, event('recall', ['m1', 'm3']))).toEqual(['m3'])
  })

  test('LIVE.1.a2: the lean row of a saved memory: label cut to 80 characters, tags, owner, created', () => {
    const row = leanRow({ id: 'new', owner: 'project-x-1', content: `\n  ${'w'.repeat(200)}\nsecond`, recall_count: 0, timestamp: '2026-10-23T11:00:00Z', tags: ['veg', 4, ''], metadata: { tags: ['other'] } })!
    expect(row).toMatchObject({ id: 'new', owner: 'project-x-1', tags: ['veg'], recalls: 0, created: '2026-10-23T11:00:00Z', lastRecalled: null })
    expect(Array.from(row.label)).toHaveLength(80)
    expect(row.label.endsWith('…')).toBe(true)
    // The tags may come only from the metadata; text is plain even when it is markup.
    expect(leanRow({ id: 'n2', owner: 'global', content: MARKUP, metadata: { tags: ['m'] } })).toMatchObject({ tags: ['m'], label: MARKUP })
    expect(leanRow({ id: 'n3', content: 'x' })!.owner).toBe('global')
    expect(leanRow(null)).toBeNull()
    expect(leanRow({ content: 'no id' })).toBeNull()
    expect(leanRow([])).toBeNull()
  })

  test('LIVE.1.a2: a save places one new star without moving any other, and counts it everywhere', () => {
    const g = freshGalaxy()
    const before = g.layout.stars.map(star => [...star.position])
    const hubBefore = g.layout.hubs.map(hub => [...hub.position])
    const index = addMemory(g, leanRow({ id: 'new', owner: 'project-x-1', content: 'a new fruit', tags: ['fruit'], timestamp: '2026-10-23T11:00:00Z' })!)
    expect(index).toBe(g.layout.starById.new!)
    expect(g.layout.stars.slice(0, before.length).map(star => [...star.position])).toEqual(before)
    expect(g.layout.hubs.slice(0, hubBefore.length).map(hub => [...hub.position])).toEqual(hubBefore)
    expect(g.ages[index]).toBe(0)
    expect(g.total).toBe(5)
    expect(g.shown).toBe(5)
    expect(g.layout.cores[g.layout.coreByOwner['project-x-1']!]!.count).toBe(3)
    expect(g.layout.hubs[g.layout.hubByKey['project-x-1/fruit']!]!.count).toBe(3)
    expect(inspector(g, calm()).title).toBe('5 memories')
    expect(projectRows(g, calm()).find(row => row.owner === 'project-x-1')!.count).toBe(3)
    // The same memory again is not added twice.
    expect(addMemory(g, leanRow({ id: 'new', owner: 'project-x-1', content: 'again' })!)).toBe(-1)
    expect(g.total).toBe(5)
    // A memory of a project and topic the galaxy has not seen makes them.
    const odd = addMemory(g, leanRow({ id: 'odd', owner: 'project-z-9', content: 'z', tags: ['brand-new'] })!)
    expect(odd).toBeGreaterThan(0)
    expect(g.layout.coreByOwner['project-z-9']).toBeDefined()
    expect(g.layout.hubByKey['project-z-9/brand-new']).toBeDefined()
    expect(g.colours['project-z-9']).toBeDefined()
  })

  test('LIVE.1.a3: a recall raises the star\'s count and size (and the most recalled); an update makes it new again', () => {
    const g = freshGalaxy()
    const i = g.layout.starById.m1!
    expect(starSize(g.layout.stars[i]!.recalls)).toBeCloseTo(7 + Math.sqrt(2) * 3.4)
    expect(recallMemory(g, 'm1')).toBe(true)
    expect(g.layout.stars[i]!.recalls).toBe(3)
    expect(starSize(g.layout.stars[i]!.recalls)).toBeGreaterThan(starSize(2))
    expect(recallMemory(g, 'nope')).toBe(false)
    // m3 has the most recalls (5); raising m1 above it moves the colour scale.
    for (let n = 0; n < 4; n++) recallMemory(g, 'm1')
    expect(g.maxRecalls).toBe(7)
    expect(g.ages[i]).toBe(3)
    expect(touchMemory(g, 'm1')).toBe(true)
    expect(g.ages[i]).toBe(0)
    expect(starTarget(g, i, calm(), null)).toBe(1)
    expect(starTarget(g, g.layout.starById.m4!, calm(), null)).toBeLessThan(0.5)
    expect(touchMemory(g, 'nope')).toBe(false)
  })

  test('LIVE.1.a2: a forget removes the star from every count and every list, and a second forget is nothing', () => {
    const g = freshGalaxy()
    expect(forgetMemory(g, 'm2')).toBe(true)
    expect(forgetMemory(g, 'm2')).toBe(false)
    expect(g.total).toBe(3)
    expect(g.shown).toBe(3)
    expect(g.layout.cores[g.layout.coreByOwner['project-x-1']!]!.count).toBe(1)
    expect(g.layout.hubs[g.layout.hubByKey['project-x-1/fruit']!]!.count).toBe(1)
    expect(liveStars(g).map(star => star.id).sort()).toEqual(['m1', 'm3', 'm4'])
    expect(inspector(g, calm()).title).toBe('3 memories')
    expect(inspector(g, calm()).stats.find(stat => stat.label === 'Never recalled')!.value).toBe('1')
    expect(projectRows(g, calm()).find(row => row.owner === 'project-x-1')!.count).toBe(1)
    expect(starTarget(g, g.layout.starById.m2!, calm(), null)).toBe(0)
    expect(find(g, 'pear').count).toBe(0)
    expect(selectStar(calm(), g, 'm2')).toEqual(calm())
    expect(tooltip(g, { kind: 'star', id: 'm2', sx: 0, sy: 0 })).toBeNull()
    expect(inspector(g, { ...calm(), selected: 'm2' }).kind).toBe('Overview')
    expect(tooltip(g, { kind: 'core', id: 'project-x-1', sx: 0, sy: 0 })!.sub).toContain('1 memory')
    expect(forgetMemory(g, 'nope')).toBe(false)
  })
})

describe('LIVE.2: sparks and pulses', () => {
  const random = () => 0.5
  const targets = [{ to: 'm1', toKind: 'star' as const }, { to: 'm2', toKind: 'star' as const }, { to: 'm3', toKind: 'star' as const }]

  test('LIVE.2.a1/a2: colours and pulses by kind, and the flight takes 1.1 s on a curve from the Claude core', () => {
    expect(SPARK_COLOURS).toEqual({ recall: [1, 0.82, 0.45], save: [0.37, 0.95, 0.85], update: [0.37, 0.95, 0.85], forget: [1, 0.42, 0.42] })
    expect(PULSE).toEqual({ recall: 1.4, save: 2, update: 1.6, forget: 1.2 })
    expect(SPARK_SECONDS).toBe(1.1)
    expect(sparkAt([0, 0, 0], [100, 0, 0], 0, 0)).toEqual([0, 0, 0])
    const end = sparkAt([0, 0, 0], [100, 50, -20], 0.4, 1)
    expect(end.map(v => Math.round(v))).toEqual([100, 50, -20])
    // Mid-flight it is off the straight line (bowed up and sideways).
    const mid = sparkAt([0, 0, 0], [100, 0, 0], 1, 0.5)
    expect(mid[1]).toBeGreaterThan(20)
    expect(mid[0]).not.toBeCloseTo(50, 0)
    expect(ease(0.5)).toBeCloseTo(0.5)
  })

  test('LIVE.2.a2: a recall\'s sparks are staggered 0.12 s; none fly under prefers-reduced-motion', () => {
    const sparks = sparksFor(event('recall', ['m1', 'm2', 'm3']), targets, false, random)
    expect(sparks.map(spark => spark.delay)).toEqual([0, SPARK_STAGGER, SPARK_STAGGER * 2])
    expect(sparks.every(spark => spark.kind === 'recall' && spark.demo === false)).toBe(true)
    expect(sparksFor(event('recall', ['m1']), targets, true, random)).toEqual([])
    expect(sparksFor({ ...event('save', ['d']), demo: true }, targets.slice(0, 1), false, random)[0]!.demo).toBe(true)
    expect(SPARK_STAGGER).toBe(0.12)
  })

  test('LIVE.2.a3: a pool of 48; extra sparks wait in the queue and start as slots free up, none dropped', () => {
    expect(SPARK_POOL).toBe(48)
    const pool = newSparkPool()
    expect(pool.active).toHaveLength(48)
    const many = Array.from({ length: 60 }, () => sparksFor(event('recall', ['m1']), targets.slice(0, 1), false, random)[0]!)
    enqueueSparks(pool, many)
    expect(pool.queue).toHaveLength(60)
    let landed = stepSparks(pool, 0.016)
    expect(landed).toHaveLength(0)
    expect(pool.active.filter(Boolean)).toHaveLength(48)
    expect(pool.queue).toHaveLength(12)
    // 1.1 s later the first 48 land, and the 12 that waited take their places.
    landed = stepSparks(pool, SPARK_SECONDS)
    expect(landed).toHaveLength(48)
    expect(pool.active.filter(Boolean)).toHaveLength(12)
    let total = 48
    for (let i = 0; i < 4; i++) total += stepSparks(pool, SPARK_SECONDS).length
    expect(total).toBe(60)
    expect(pool.queue).toHaveLength(0)
  })

  test('LIVE.2: a spark waits out its delay, then flies; its brightness and progress follow', () => {
    const pool = newSparkPool(2)
    const [first, second] = sparksFor(event('recall', ['m1', 'm2']), targets.slice(0, 2), false, random)
    enqueueSparks(pool, [first!, second!])
    stepSparks(pool, 0)
    const waiting = pool.active[1]!
    expect(sparkAlpha(waiting)).toBe(0)
    expect(sparkProgress(waiting)).toBe(0)
    stepSparks(pool, 0.12 + 0.55)
    expect(sparkProgress(pool.active[1]!)).toBeCloseTo(0.5, 1)
    expect(sparkAlpha(pool.active[1]!)).toBeCloseTo(0.85, 1)
    const landed = stepSparks(pool, 1)
    expect(landed.map(spark => spark.to)).toEqual(['m1', 'm2'])
  })
})

describe('LIVE.3: the live strip, the layers and the demo timer', () => {
  test('LIVE.3.a2: a row has the time, the kind badge, a sentence with the topic and project, the app and the demo mark', () => {
    const g = freshGalaxy()
    const row = stripRow(g, event('recall', ['m1', 'm3']), 2)
    expect(row.badge).toBe('recall')
    expect(row.text).toBe('Recalled 2 · fruit · x')
    expect(row.app).toBe('Claude Code')
    expect(row.demo).toBe(false)
    expect(row.time).toMatch(/^\d\d:\d\d:\d\d$/)
    expect(stripRow(g, event('save', ['m4']), 1).text).toBe('Saved a new memory · Untagged · Global')
    expect(stripRow(g, event('update', ['m2']), 1).text).toBe('Updated a memory in place · fruit · x')
    expect(stripRow(g, event('forget', ['m2']), 1).text).toBe('Forgot a memory · fruit · x')
    expect(stripRow(g, event('forget', ['m1', 'm2']), 2).text).toContain('Forgot 2 memories')
    const demo = stripRow(g, { ...event('save', ['demo-1'], { client: 'demo', topic: 'fruit' }), demo: true }, 1)
    expect(demo).toMatchObject({ demo: true, app: 'Demo', text: 'Saved a new memory · fruit · x' })
    expect(stripRow(g, event('recall', ['m1'], { client: 'unknown', t: 'garbage' }), 1)).toMatchObject({ app: '', time: '--:--:--' })
    // The app name is plain text, however it is spelt.
    expect(appName('codex-mcp-client')).toBe('Codex')
    expect(appName('cursor-vscode')).toBe('Cursor')
    expect(appName('Claude-Code')).toBe('Claude Code')
    expect(appName('zed')).toBe('zed')
    expect(appName(MARKUP)).toBe(MARKUP)
    expect(appName('')).toBe('')
  })

  test('LIVE.3.a1: the strip shows the last four of the layers that are on, newest first; the store holds 12', () => {
    const g = freshGalaxy()
    let rows: ReturnType<typeof stripRow>[] = []
    const kinds: MapEvent['kind'][] = ['recall', 'save', 'recall', 'update', 'forget', 'recall', 'recall', 'save']
    kinds.forEach((kind, i) => {
      rows = pushRow(rows, stripRow(g, event(kind, ['m1'], { t: `2026-10-23T10:00:0${i}.000Z` }), 1))
    })
    expect(rows).toHaveLength(8)
    for (let i = 0; i < 10; i++) rows = pushRow(rows, stripRow(g, event('recall', ['m1']), 1))
    expect(rows).toHaveLength(STRIP_STORE)
    expect(STRIP_KEEP).toBe(4)
    const state = calm()
    expect(stripRows(rows, state)).toHaveLength(4)
    const noRecall = toggleLayer(state, 'recall')
    expect(noRecall.layerRecall).toBe(false)
    expect(stripRows(pushRow(rows, stripRow(g, event('save', ['m1']), 1)), noRecall).every(row => row.kind !== 'recall')).toBe(true)
    expect(stripRows([stripRow(g, event('recall', ['m1']), 1)], toggleLayer(toggleLayer(state, 'recall'), 'write'))).toEqual([])
    expect(layerOf('recall')).toBe('recall')
    expect(['save', 'update', 'forget'].map(kind => layerOf(kind as MapEvent['kind']))).toEqual(['write', 'write', 'write'])
    expect(layerOn(noRecall, 'recall')).toBe(false)
    expect(layerOn(noRecall, 'forget')).toBe(true)
  })

  test('LIVE.3.a3: a demo event plays every 3.4 s only while Live is On and a Simulate button was pressed in this page load', () => {
    expect(DEMO_EVERY_MS).toBe(3400)
    const on = calm()
    expect(demoTimerOn(on, false)).toBe(false)
    expect(demoTimerOn(on, true)).toBe(true)
    expect(demoTimerOn(toggleLive(on), true)).toBe(false)
    expect(toggleLive(toggleLive(on))).toEqual(on)
    // Reduced motion starts Live paused.
    expect(demoTimerOn(initialState({ reducedMotion: true }), true)).toBe(false)
    // The draw: recall 3 in 5, write 2 in 5, among the layers that are on.
    const draws = [0, 0.19, 0.59, 0.61, 0.8].map(r => demoKind(on, () => r))
    expect(draws).toEqual(['recall', 'recall', 'recall', 'write', 'write'])
    expect(demoKind(toggleLayer(on, 'recall'), () => 0)).toBe('write')
    expect(demoKind(toggleLayer(on, 'write'), () => 0.99)).toBe('recall')
    expect(demoKind(toggleLayer(toggleLayer(on, 'write'), 'recall'), () => 0)).toBeNull()
  })

  test('LIVE.3.a4: Simulate makes demo events from the galaxy the page holds, with no server in reach', () => {
    const g = freshGalaxy()
    const input = simulationInput(g)
    expect(input.projects.map(p => p.owner).sort()).toEqual(['global', 'project-x-1', 'project-y-2'])
    expect(input.memories.map(m => m.id).sort()).toEqual(['m1', 'm2', 'm3', 'm4'])
    const originalFetch = globalThis.fetch
    globalThis.fetch = (() => {
      throw new Error('a demo event asked the network')
    }) as unknown as typeof fetch
    try {
      for (const kind of ['recall', 'write'] as const) {
        for (let i = 0; i < 40; i++) {
          const made = simulate(kind, input, () => (i * 7919) % 100 / 100)
          expect(made?.demo).toBe(true)
          expect(made?.client).toBe('demo')
        }
      }
    } finally {
      globalThis.fetch = originalFetch
    }
    // A forgotten memory is no longer drawn on for a demo.
    forgetMemory(g, 'm1')
    expect(simulationInput(g).memories.map(m => m.id)).not.toContain('m1')
    // The events a real line makes are not demos.
    expect(toMapEvent({ action: 'recall', ids: ['m1'], ok: true, client: 'cursor-vscode' })).toMatchObject({ kind: 'recall', client: 'cursor-vscode' })
    expect(toMapEvent({ action: 'recall', ids: ['m1'], ok: true })?.demo).toBeUndefined()
  })
})
