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
import { CLAUDE_CORE, galaxyLayout, LANE_SPAN, PROJECT_CORE_X, ticks, TIMELINE_DAYS_X, TIMELINE_TODAY_X, type Vec3 } from '../../ui/map-layout'
import { simulate, toMapEvent, type MapEvent } from '../../ui/map-live'
import {
  FIND_FLY_DELAY_MS,
  isPrimary,
  liveLabel,
  shouldFlyToFound,
  slotOf,
  addMemory,
  ageColour,
  announcement,
  BLOOM,
  BLOOM_SOFT,
  bloomFor,
  BRIDGE_PARTICLES,
  GLOW_KEY,
  glowLevel,
  readGlow,
  saveGlow,
  buildGalaxy,
  type Candidate,
  coreSize,
  appName,
  coreTarget,
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
  PICK_RADIUS,
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
  DIM_NO_KNOWLEDGE,
  hasKnowledge,
  knowledgeMarked,
  KNOWLEDGE_MARK_OPACITY,
  linksHint,
  LINE_CHECKS,
  KIND_LABELS,
  CHIP_LABELS,
  KNOWLEDGE_KINDS,
  knowledgeCounts,
  knowledgeNote,
  knowledgeOf,
  type KnowledgeKind,
  MOON_COLOURS,
  MOON_LIMIT,
  MOON_LINE_COLOUR,
  MOON_LINE_OPACITY,
  MOON_PICK_RADIUS,
  MOON_RADIUS,
  MOON_SIZE,
  MOON_SIZE_SELECTED,
  MOON_SPEED,
  moonColour,
  moonLinesProblem,
  moonPosition,
  moonPulse,
  moonRows,
  moonSize,
  moonTooltip,
  NO_KNOWLEDGE_NOTE,
  passesKnowledgeFilter,
  selectedMoon,
  selectMoon,
  toggleKind,
  toggleMoons,
  usageText,
  blendPlace,
  coreScale,
  galaxyOnlyFade,
  linkFadeAt,
  LINK_FADE_SPAN,
  separateLabels,
  LABEL_GAP,
  CLAUDE_TOOLTIP,
  GRID_COLOUR,
  GRID_OPACITY,
  gridLine,
  inTimelineRange,
  LANE_OPACITY,
  laneLines,
  MORPH_SECONDS,
  morphBlend,
  morphSeconds,
  morphTarget,
  RANGE_FOLLOW,
  rangeTicks,
  stepDays,
  stepMorph,
  TICK_LABEL_OPACITY,
  tickX,
  TIMELINE_CORE_SCALE,
  TIMELINE_HINT,
  TIMELINE_POSE,
  timelineDays,
  timelinePlaces,
  TICK_LABEL_Y,
  TICK_LABEL_HEIGHT,
  TICK_LABEL_COLOUR,
  GRID_Y,
  GRID_Z,
  LANE_X,
  LANE_Z,
  awayPlace,
  easeToward,
  FURNITURE_EPSILON,
  furnitureIdle,
  gridOpacity,
  LANE_CENTRE_X,
  laneTarget,
  layoutFlight,
  layoutStep,
  linkFadeToApply,
  liveOldestAge,
  needsGridLine,
  onTimelineAxis,
  placesFor,
  samePlace,
  sparkOrigin,
  tickReleased,
  tickTarget,
  tickWanted,
  TIMELINE_LEFT_X,
  timelineAim,
  timelineCentre,
  visualFade,
  visualPlace,
  visualScale,
  wantedTicks,
  type PlacesCache,
} from '../../ui/map-state'
import { laneY, rangeDays, tickStep, TICK_MIN_SPACING } from '../../ui/map-layout'
import {
  clearKinds,
  CLICK_MAX_HELD_MS,
  CLICK_MAX_MOVE,
  coreLabelOffset,
  dimNote,
  LANE_LABEL_LIFT,
  laneLabelLift,
  LIVE_PILL_TITLE,
  MOON_LABEL_GAP,
  MOON_LABEL_REF,
  MOON_LABEL_ROW,
  moonLabelLift,
  moonLabelRow,
  moonLabelScale,
  moonPickRadius,
  MOON_RENDER_ORDER,
  needsHover,
  pixelsPerUnit,
  STRIP_EMPTY_TEXT,
} from '../../ui/map-state'
import {
  CLUSTER_LABEL_LIMIT,
  CLUSTER_MIN,
  EMBEDDINGS_HINT,
  layoutPlace,
  layoutWeights,
  meaningAway,
  meaningClusters,
  MEANING_HINT,
  meaningPlaces,
  meaningStep,
  meaningTarget,
  NOT_EMBEDDED_LABEL,
  NOT_EMBEDDED_MIN_RADIUS,
  NOT_EMBEDDED_RING_FACTOR,
  notEmbeddedIds,
  projectDim,
  ringLabel,
  SIMILAR_COLOUR,
  SIMILAR_MEANING_MIN,
  SIMILAR_NOTE,
  SIMILAR_PER_STAR,
  similarOpacity,
  similarPairs,
  toggleSimilar,
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

// The page asks `activeElement instanceof HTMLElement`: the stand-in's nodes share this base, which a spec installs as HTMLElement.
class FakeBase {}

class FakeNode extends FakeBase {
  static focused: FakeNode | null = null
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
  constructor(public tagName: string) {
    super()
  }
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
  removeAttribute(name: string) {
    this.attributes.delete(name)
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  fire(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
  focus() {
    FakeNode.focused = this
  }
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
  // Selectors: `tag[data-key]`, `tag[data-key="value"]` or `[data-key]`.
  querySelectorAll(selector: string): FakeNode[] {
    const match = /^(\w+)?\[data-([\w-]+)(?:="([^"]*)")?\]/.exec(selector)
    const tag = match?.[1]
    const key = match?.[2]?.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())
    const value = match?.[3]
    const from = this.groups.length > 0 ? this.groups : this.all().filter(n => n.tagName === 'button' || n.tagName === 'input')
    return from.filter(n => (tag === undefined || n.tagName === tag) && (key === undefined || (n.dataset[key] !== undefined && (value === undefined || n.dataset[key] === value))))
  }
  contains(node: unknown): boolean {
    return this.all().includes(node as FakeNode)
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
  for (const group of ['map-layout', 'map-range', 'map-colour', 'map-know']) {
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
    activeElement: null as FakeNode | null,
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

  test('GAL.2.a5: a drag over 3 px is an orbit, never a click; the nearest star under the pointer is picked, faint ones are not', () => {
    expect(isClick({ x: 10, y: 10 }, { x: 12, y: 12 })).toBe(true)
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
    expect(Object.keys(s).sort()).toEqual(['bridges', 'colourBy', 'hidden', 'kinds', 'layerRecall', 'layerWrite', 'layout', 'live', 'moon', 'moons', 'project', 'query', 'range', 'reducedMotion', 'rotateBefore', 'rotating', 'selected', 'similar', 'spokes', 'topic'].sort())
    expect(setColourBy(s, 'age').colourBy).toBe('age')
    expect(setColourBy(s, 'nope' as never)).toBe(s)
    expect(setRange(s, 7).range).toBe(7)
    expect(setRange(s, 'all')).toBe(s)
    expect(toggleRotation(s).rotating).toBe(!s.rotating)
    expect(s).toEqual(base())
    // The scene file reads its state in one place per frame.
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    expect(map).toMatch(/function syncSettings\(\)/)
    expect(map).toMatch(/syncSettings\(\)\s*\n\s*stepLayout\(dt, galaxy\)\s*\n\s*stepFlight/)
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
    expect(memory.knowledge?.note).toBe(NO_KNOWLEDGE_NOTE)
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
    expect(toggleProject(hidden, alpha).hidden).toEqual(new Set())
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
    g.HTMLElement = FakeBase
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

  test('GAL R2 / 1 (GAL.3.a5): activating a project name with the keyboard keeps focus on the re-rendered name button', async () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const fake = fakeDom(html)
    const g = globalThis as Record<string, unknown>
    const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement }
    g.document = fake.document
    g.CSS = { escape: (v: string) => v }
    g.HTMLElement = FakeBase
    try {
      const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => unknown }
      createMap({ api: async () => new Response(JSON.stringify(rawBody), { status: 200 }), openMemory: () => {}, status: () => {} })
      await Bun.sleep(30)
      const rows = () => fake.nodes.get('map-toggles')!.children as FakeNode[]
      const nameOf = (owner: string) => rows().flatMap(row => row.all()).find(n => n.tagName === 'button' && n.dataset.project === owner)!
      const boxOf = (owner: string) => rows().flatMap(row => row.all()).find(n => n.tagName === 'input' && n.dataset.project === owner)!
      // The name button carries the project, as the checkbox does, so a redraw can find it again.
      const before = nameOf(alpha)
      expect(before.dataset.fly).toBeUndefined()
      fake.document.activeElement = before
      before.fire('click', { preventDefault() {} })
      const after = nameOf(alpha)
      expect(after).not.toBe(before)
      expect(FakeNode.focused).toBe(after)
      expect(after.tagName).toBe('button')
      // Enter again, and the checkbox keeps its own focus on a redraw.
      fake.document.activeElement = after
      after.fire('click', { preventDefault() {} })
      expect(FakeNode.focused).toBe(nameOf(alpha))
      const box = boxOf(beta)
      fake.document.activeElement = box
      box.fire('change')
      expect(FakeNode.focused?.tagName).toBe('input')
      expect(FakeNode.focused?.dataset.project).toBe(beta)
    } finally {
      g.document = saved.document
      g.CSS = saved.CSS
      g.HTMLElement = saved.HTMLElement
    }
  })

  test('GAL R2 / 6: a stored Meaning layout is kept when the reply says meaning, and falls back to Galaxy when it does not', async () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const g = globalThis as Record<string, unknown>
    const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement, localStorage: g.localStorage }
    const run = async (meaning: boolean) => {
      const fake = fakeDom(html)
      g.document = fake.document
      g.CSS = { escape: (v: string) => v }
      g.HTMLElement = FakeBase
      g.localStorage = { getItem: () => 'meaning', setItem: () => {} }
      const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => unknown }
      createMap({ api: async () => new Response(JSON.stringify({ ...(rawBody as object), meaning }), { status: 200 }), openMemory: () => {}, status: () => {} })
      await Bun.sleep(30)
      const pressed = (name: string) => fake.nodes.get('map-layout')!.querySelectorAll('button[data-layout]').find(b => b.dataset.layout === name)!.attributes.get('aria-pressed')
      return { meaning: pressed('meaning'), galaxy: pressed('galaxy') }
    }
    try {
      expect(await run(true)).toEqual({ meaning: 'true', galaxy: 'false' })
      expect(await run(false)).toEqual({ meaning: 'false', galaxy: 'true' })
    } finally {
      g.document = saved.document
      g.CSS = saved.CSS
      g.HTMLElement = saved.HTMLElement
      g.localStorage = saved.localStorage
    }
  })

  test('LIVE: real activity lines play on the map: a save adds a star, a recall and an update count, a forget removes one; failed, extract and unknown lines draw nothing; demo events change nothing and ask nothing', async () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const fake = fakeDom(html)
    const g = globalThis as Record<string, unknown>
    const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement }
    g.document = fake.document
    g.CSS = { escape: (v: string) => v }
    g.HTMLElement = FakeBase
    try {
      const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => { visible: (shown: boolean) => void; show: (id: string) => void } }
      const asked: string[] = []
      let push: (line: Record<string, unknown>) => void = () => {}
      let stopped = 0
      let setStream: (status: string) => void = () => {}
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
        streamStatus: (watcher: (status: string) => void) => {
          setStream = watcher
          return () => {}
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
      expect(strip()).toEqual([STRIP_EMPTY_TEXT])
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
      // The Live pill says On only while the stream is connected and Live is on.
      expect(node('map-live-state').textContent).toBe('Paused')
      setStream('live')
      expect(node('map-live-state').textContent).toBe('On')
      node('map-live-state').parentElement!.fire('click')
      expect(node('map-live-state').textContent).toBe('Paused')
      node('map-live-state').parentElement!.fire('click')
      expect(node('map-live-state').textContent).toBe('On')
      setStream('reconnecting')
      expect(node('map-live-state').textContent).toBe('Paused')
      setStream('off')
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
  knowledge: [],
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
    expect(g.colours.has('project-z-9')).toBe(true)
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

describe('LIVE.3: the live strip and the layers', () => {
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

  test('LIVE.3.a3: the Live pill toggles live updates, and two presses restore the state', () => {
    const on = calm()
    expect(toggleLive(toggleLive(on))).toEqual(on)
    expect(toggleLive(on).live).toBe(false)
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

// ---- GAL R2: review fixes ----

describe('GAL R2: review fixes', () => {
  test('2: only the main button picks or flies, in both pointer handlers', () => {
    expect(isPrimary({ button: 0 })).toBe(true)
    expect(isPrimary({ button: 1 })).toBe(false)
    expect(isPrimary({ button: 2 })).toBe(false)
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const handler = (name: string) => map.slice(map.indexOf(`canvasBox.addEventListener('${name}'`), map.indexOf('})', map.indexOf(`canvasBox.addEventListener('${name}'`)))
    expect(handler('pointerdown')).toContain('isPrimary(event)')
    expect(handler('pointerup')).toContain('isPrimary(event)')
  })

  test('3: a project named like an Object member hides, colours and indexes like any other', () => {
    const owners = ['constructor', 'toString', 'hasOwnProperty', '__proto__']
    const g = buildGalaxy(reply(owners.map((owner, i) => memory(`id${i}`, owner, { tags: ['t'], recalls: i })), { projects: owners.map(owner => ({ owner, label: owner, count: 1, recalls: 0 })) }), LIVE_NOW)
    const start = initialState({ reducedMotion: false })
    for (const owner of owners) {
      expect(start.hidden.has(owner)).toBe(false)
      const hidden = toggleProject(start, owner)
      expect(hidden.hidden.has(owner)).toBe(true)
      expect([...hidden.hidden]).toEqual([owner])
      // Only that owner's stars are hidden.
      for (const [i, other] of owners.entries()) {
        const index = g.layout.starById[`id${i}`]!
        expect(starTarget(g, index, hidden, null) === 0).toBe(other === owner)
      }
      expect(toggleProject(hidden, owner).hidden.size).toBe(0)
    }
    // A colour for an owner the galaxy does not hold is the grey one, never a member of Object.
    expect(projectColour(g, 'valueOf')).toBe(GLOBAL_COLOUR)
    expect(projectColour(g, 'toString')).toMatch(/^#[0-9A-F]{6}$/)
    // The layout's index maps: a key it never stored has no slot, even if Object has a member of that name.
    for (const absent of ['valueOf', 'isPrototypeOf', 'nope']) expect(slotOf(g.layout.coreByOwner, absent)).toBe(-1)
    expect(slotOf(g.layout.coreByOwner, 'constructor')).toBeGreaterThanOrEqual(0)
    expect(slotOf(g.layout.coreByOwner, 'toString')).toBeGreaterThanOrEqual(0)
    expect(projectRows(g, start).map(row => row.owner)).toEqual(expect.arrayContaining(['constructor', 'toString', 'hasOwnProperty']))
    // A memory of an owner named like a member finds its core, and a missing one finds none.
    expect(tooltip(g, { kind: 'core', id: 'constructor', sx: 0, sy: 0 })!.title).toBe('constructor')
    expect(tooltip(g, { kind: 'core', id: 'valueOf', sx: 0, sy: 0 })).toBeNull()
    expect(flightTo(g, 'core', 'valueOf')).toBeNull()
    expect(focusProject(start, 'toString').project).toBe('toString')
    expect(inspector(g, focusProject(start, 'valueOf')).kind).toBe('Overview')
  })

  test('4: the stage hint says "click to fly in"', () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    expect(html).toContain('click to fly in')
    expect(html).not.toContain('drill in')
  })

  test('5: the Live pill says On only while the stream is connected and Live is on', () => {
    const on = initialState({ reducedMotion: false })
    expect(liveLabel(on, true)).toBe('On')
    expect(liveLabel(on, false)).toBe('Paused')
    expect(liveLabel(toggleLive(on), true)).toBe('Paused')
    expect(liveLabel(initialState({ reducedMotion: true }), true)).toBe('Paused')
  })

  test('7: a bloom that fails is reported in plain words, and the catch names the error', () => {
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const block = map.slice(map.indexOf('postProcessingComposer?.()') - 120, map.indexOf("host.status(`The glow effect") + 160)
    expect(block).toContain('catch (err)')
    expect(block).toContain('The glow effect could not start')
    expect(block).not.toMatch(/catch\s*\{/)
  })

  test('8: a redraw lets go of the old sprites and label textures, and a hidden map asks for no frames', () => {
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const draw = map.slice(map.indexOf('function drawGalaxy('), map.indexOf('function growGalaxy('))
    expect(draw.indexOf('disposeVisuals()')).toBeGreaterThan(0)
    expect(draw.indexOf('disposeVisuals()')).toBeLessThan(draw.indexOf('visuals = []'))
    const dispose = map.slice(map.indexOf('function disposeVisuals()'), map.indexOf('function drawGalaxy('))
    expect(dispose).toContain('material?.dispose')
    expect(dispose).toContain('material?.map?.dispose')
    const visible = map.slice(map.indexOf('visible(next: boolean)'), map.indexOf('show(memoryId'))
    expect(visible).toContain('cancelAnimationFrame(raf)')
    expect(visible).toContain('requestAnimationFrame(frame)')
    expect(map).toMatch(/raf = shown \? requestAnimationFrame\(frame\) : 0/)
  })

  test('9: the v1-era CSS nobody uses is gone; the vendored library CSS and what the page uses stay', () => {
    const css = readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')
    for (const gone of ['.rail-items', '.insp-items', '.insp-item ', '.insp-item-kind', '.insp-item-text']) expect(css).not.toContain(gone)
    // The page uses .mini-badge (the live strip), and the package CSS the CSP made us carry is in the file.
    expect(readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')).toContain('mini-badge')
    expect(css).toContain('.mini-badge')
    for (const kept of ['.graph-info-msg', '.scene-container .clickable', '.scene-container .grabbable', '.scene-nav-info', '.float-tooltip-kap']) expect(css).toContain(kept)
    // Activity's rules are untouched.
    for (const rule of ['.feed-head', '.event', '.key', '.act-bar']) expect(css).toContain(rule)
  })

  test('10: Find flies once typing settles, and only to a centre it has not flown to', () => {
    expect(FIND_FLY_DELAY_MS).toBe(250)
    const found = { ids: new Set(['a']), count: 1, centre: [10, 20, 30] as [number, number, number], distance: 260 }
    expect(shouldFlyToFound(found, null)).toBe(true)
    expect(shouldFlyToFound(found, [10, 20, 30])).toBe(false)
    expect(shouldFlyToFound(found, [10.3, 20, 30])).toBe(false)
    expect(shouldFlyToFound(found, [40, 20, 30])).toBe(true)
    expect(shouldFlyToFound({ ...found, centre: null, count: 0 }, null)).toBe(false)
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const search = map.slice(map.indexOf('function search('), map.indexOf('// ---- Drawing the page ----'))
    expect(search).toContain('setTimeout')
    expect(search).toContain('FIND_FLY_DELAY_MS')
    expect(search).toContain('shouldFlyToFound(found, lastFound)')
    // The count and the dimming are not delayed: the query is dispatched at once.
    expect(search.indexOf('dispatch(setQuery')).toBeLessThan(search.indexOf('setTimeout'))
  })
})

// ---- MOON: knowledge moons and the knowledge filter, on a real /api/galaxy reply ----
//
// The rows are written by the real engine tool mnemopi_knowledge_store (as in
// tests/bun/knowledge-api.spec.ts) into a real temporary store, and read back by the
// real server's /api/galaxy; only the page's network edge is a stand-in.

describe('MOON: moons on a clicked star and the knowledge filter', () => {
  const temp = tempDir('map-moon')
  const store = join(temp.dir, 'store')
  let started: Started
  let galaxy: Galaxy
  let rawBody: { knowledge: { id: string; kind: KnowledgeKind; text: string; memory: string }[] } & Record<string, unknown>
  const ids: Record<string, string> = {}
  const alpha = 'project-alpha-1a2b'
  const beta = 'project-beta-9z8y'
  const now = Date.parse('2026-10-23T12:00:00Z')
  const LONG = `${'long fact '.repeat(49)}end`
  const MARKUP_FACT = '<img src=x onerror=alert(1)> fact'

  async function remember(owner: string, key: string, content: string, tags: string[]) {
    const answer = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, metadata: { tags } })])).get(1))
    if (typeof answer?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(answer)}`)
    ids[key] = answer.memory_id as string
  }
  async function mine(owner: string, key: string, reply: Record<string, unknown>) {
    const prompt = body((await engineCall(CLI, store, owner, [toolCall(10, 'mnemopi_knowledge_prompt', { memory_id: ids[key] })])).get(10)) as { sha256: string }
    const stored = body((await engineCall(CLI, store, owner, [toolCall(11, 'mnemopi_knowledge_store', { memory_id: ids[key], reply: JSON.stringify(reply), sha256: prompt.sha256 })])).get(11))
    if (stored?.error || stored?.ok === false || stored?.stored === 0) throw new Error(`knowledge_store failed: ${JSON.stringify(stored)}`)
  }

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    await remember(alpha, 'few', 'Alpha standards note', ['standards'])
    await remember(alpha, 'many', 'Alpha long list of facts', ['standards'])
    await remember(beta, 'mixed', 'Beta release note', ['release'])
    await remember(beta, 'bare', 'Beta note nothing was mined from', ['release'])
    await remember('global', 'markup', 'Global note with markup knowledge', ['misc'])
    await mine(alpha, 'few', { facts: ['Mnemosyne needs Bun', 'Standards apply to all lanes'], preferences: ['Prefers tabs'], instructions: [], timelines: ['Release on 2026-11-01'], kg: [] })
    await mine(alpha, 'many', {
      facts: Array.from({ length: 10 }, (_, i) => `Fact number ${i + 1}`),
      preferences: [],
      instructions: [],
      timelines: [],
      kg: [{ subject: 'Alpha', predicate: 'lists', object: 'facts' }],
    })
    await mine(beta, 'mixed', { facts: [LONG], preferences: [], instructions: ['Always run typecheck'], timelines: [], kg: [{ subject: 'Beta', predicate: 'ships', object: 'Mnemosyne' }] })
    await mine('global', 'markup', { facts: [MARKUP_FACT], preferences: [], instructions: [], timelines: [], kg: [] })
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      db.run("UPDATE working_memory SET recall_count = 7, last_recalled = '2026-10-21T09:00:00.000Z' WHERE id = ?", [ids.few!])
      db.run("UPDATE working_memory SET recall_count = 1, last_recalled = '2026-10-23T08:00:00.000Z' WHERE id = ?", [ids.many!])
      db.run('UPDATE working_memory SET recall_count = 0, last_recalled = NULL WHERE id = ?', [ids.bare!])
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: join(temp.dir, 'activity.jsonl'), pluginRoot: ROOT })
    const response = await fetch(`http://127.0.0.1:${started.port}/api/galaxy`, { headers: { Authorization: `Bearer ${started.token}` } })
    expect(response.status).toBe(200)
    rawBody = (await response.json()) as typeof rawBody
    const reply = parseGalaxy(rawBody)
    if (reply === null) throw new Error('not a galaxy')
    galaxy = buildGalaxy(reply, now)
  }, 180_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  const base = (): MapState => initialState({ reducedMotion: false })
  const select = (key: string, state = base()) => selectStar(state, galaxy, ids[key]!)
  const indexOfStar = (key: string) => galaxy.layout.starById[ids[key]!]!

  test('the real reply carries the knowledge, and the page keeps it as the API gave it', () => {
    expect(rawBody.knowledge.length).toBe(2 + 1 + 1 + 10 + 1 + 1 + 1 + 1 + 1)
    expect(hasKnowledge(galaxy)).toBe(true)
    expect(knowledgeOf(galaxy, ids.few!).map(row => row.kind)).toEqual(['fact', 'fact', 'preference', 'timeline'])
    // Item text can be 500 characters in the store; the route cuts it to 80 and the page shows exactly that (no extra fetch).
    const long = knowledgeOf(galaxy, ids.mixed!).find(row => row.kind === 'fact')!
    expect(Array.from(long.text).length).toBeLessThanOrEqual(80)
    expect(long.text).toBe(rawBody.knowledge.find(row => row.id === long.id)!.text)
    expect(knowledgeOf(galaxy, ids.bare!)).toEqual([])
  })

  test('parseGalaxy keeps only well-formed knowledge rows, and an id named like an Object member is safe', () => {
    const good = { id: 'fact:1', kind: 'fact' as const, text: 'a fact', memory: 'constructor' }
    const parsed = parseGalaxy({
      memories: [{ id: 'constructor', owner: 'global' }],
      knowledge: [good, good, { ...good, id: 'x:2', kind: 'mood' }, { ...good, id: 'fact:3', memory: '' }, { ...good, id: 'fact:4', memory: 7 }, { kind: 'fact', text: 'no id', memory: 'constructor' }, 'junk', null],
    })!
    expect(parsed.knowledge).toEqual([good])
    const built = buildGalaxy(parsed, now)
    expect(knowledgeOf(built, 'constructor')).toEqual([good])
    expect(knowledgeOf(built, 'toString')).toEqual([])
    // Knowledge of a memory the reply does not hold (cut by the 2000 limit) is dropped.
    const cut = buildGalaxy(parseGalaxy({ memories: [{ id: 'm1', owner: 'global' }], knowledge: [{ ...good, memory: 'gone-from-reply' }] })!, now)
    expect(hasKnowledge(cut)).toBe(false)
    // An old reply with no knowledge at all still parses.
    expect(parseGalaxy({ memories: [{ id: 'm1', owner: 'global' }] })!.knowledge).toEqual([])
  })

  test('MOON.1.a1: a selected star with Knowledge moons on shows its rows, at most 8, none otherwise', () => {
    expect(base().moons).toBe(true)
    expect(moonRows(galaxy, base())).toEqual([])
    const few = moonRows(galaxy, select('few'))
    expect(few.map(row => row.text)).toEqual(['Mnemosyne needs Bun', 'Standards apply to all lanes', 'Prefers tabs', 'Release on 2026-11-01'])
    // More than 8 rows: only 8 moons; the inspector still lists all 11.
    const many = select('many')
    expect(knowledgeOf(galaxy, ids.many!).length).toBe(11)
    expect(MOON_LIMIT).toBe(8)
    expect(moonRows(galaxy, many).length).toBe(8)
    expect(moonRows(galaxy, many).map(row => row.id)).toEqual(knowledgeOf(galaxy, ids.many!).slice(0, 8).map(row => row.id))
    expect(inspector(galaxy, many, now).knowledge!.items.length).toBe(11)
    expect(inspector(galaxy, many, now).knowledge!.note).toContain('Only the first 8 orbit the star')
    // Moons off, or the memory forgotten: none.
    expect(moonRows(galaxy, toggleMoons(select('few')))).toEqual([])
    expect(toggleMoons(toggleMoons(select('few'))).moons).toBe(true)
    // 0 knowledge rows: none.
    expect(moonRows(galaxy, select('bare'))).toEqual([])
  })

  test('MOON.hint: a faint ring marks the stars with knowledge, and a line under Links says to click a star', () => {
    expect(KNOWLEDGE_MARK_OPACITY).toBeGreaterThan(0)
    expect(KNOWLEDGE_MARK_OPACITY).toBeLessThan(0.5)
    // Ringed: a star with knowledge, while moons are on and it is not the selected one.
    expect(knowledgeMarked(galaxy, base(), ids.few!)).toBe(true)
    expect(knowledgeMarked(galaxy, base(), ids.bare!)).toBe(false)
    expect(knowledgeMarked(galaxy, select('few'), ids.few!)).toBe(false)
    expect(knowledgeMarked(galaxy, select('few'), ids.many!)).toBe(true)
    expect(knowledgeMarked(galaxy, toggleMoons(base()), ids.few!)).toBe(false)
    // The line: moons only, both, Meaning (its similar links show anyway), a selected star, everything off.
    expect(linksHint({ ...galaxy, meaning: false }, base())).toBe('Click a star to see its knowledge moons. A faint ring marks the stars that have knowledge.')
    const embedded = { ...galaxy, meaning: true }
    expect(linksHint(embedded, base())).toBe('Click a star to see its similar links and knowledge moons. A faint ring marks the stars that have knowledge.')
    expect(linksHint(embedded, { ...base(), layout: 'meaning' })).toBe('Click a star to see its knowledge moons. A faint ring marks the stars that have knowledge.')
    expect(linksHint(embedded, toggleMoons(base()))).toBe('Click a star to see its similar links.')
    expect(linksHint(embedded, select('few'))).toBe('')
    expect(linksHint({ ...galaxy, meaning: false }, toggleMoons(base()))).toBe('')
  })

  test('MOON.1.a1: orbit radius 18, 0.45 rad/s, still under reduced motion; MOON.1.a2: colours, sizes and pulse are constants', () => {
    expect([MOON_RADIUS, MOON_SPEED]).toEqual([18, 0.45])
    const centre: [number, number, number] = [100, 50, -20]
    const flat = (at: number[]) => Math.hypot(at[0]! - centre[0], at[2]! - centre[2])
    for (const t of [0, 1.3, 7]) for (let i = 0; i < 5; i++) expect(flat(moonPosition(centre, i, 5, t, false))).toBeCloseTo(18, 9)
    // Evenly spread: 8 moons are 45 degrees apart.
    const angle = (at: number[]) => Math.atan2(at[2]! - centre[2], at[0]! - centre[0])
    expect(angle(moonPosition(centre, 1, 8, 0, false)) - angle(moonPosition(centre, 0, 8, 0, false))).toBeCloseTo(Math.PI / 4, 9)
    // 0.45 rad/s: after 2 s the first moon has turned 0.9 rad.
    expect(angle(moonPosition(centre, 0, 8, 2, false)) - angle(moonPosition(centre, 0, 8, 0, false))).toBeCloseTo(0.9, 9)
    // Reduced motion: the moons STAND STILL (orchestrator decision: the mockup's `this.reduced ? 0 : 0.45`, and accessibility;
    // the plan's words "(still under reduced motion)" meant this and are corrected in REL).
    // Reduced motion: the same place at any time.
    for (const t of [0.5, 3, 100]) expect(moonPosition(centre, 2, 5, t, true)).toEqual(moonPosition(centre, 2, 5, 0, true))
    // The mockup's flattening: height swing is 0.45 of the radius.
    expect(Math.max(...[0, 1, 2, 3, 4, 5, 6, 7].map(i => moonPosition(centre, i, 8, 0.2, false)[1] - centre[1]))).toBeLessThanOrEqual(18 * 0.45 + 1e-9)
    expect(MOON_COLOURS).toEqual({ fact: '#9ED1FF', preference: '#FF9EC7', instruction: '#9EF0A8', timeline: '#FFD17A', relation: '#C7A6FF' })
    for (const kind of KNOWLEDGE_KINDS) expect(moonColour(kind)).toBe(MOON_COLOURS[kind])
    expect([MOON_SIZE, MOON_SIZE_SELECTED]).toEqual([6.5, 9])
    expect(moonSize(true)).toBeGreaterThan(moonSize(false))
    expect(moonPulse(false, 1.7)).toBe(0)
    const pulses = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map(t => moonPulse(true, t))
    expect(new Set(pulses).size).toBeGreaterThan(3)
    expect(Math.min(...pulses)).toBeGreaterThanOrEqual(0.1 - 1e-9)
    expect(Math.max(...pulses)).toBeLessThanOrEqual(0.7 + 1e-9)
    expect([MOON_LINE_COLOUR, MOON_LINE_OPACITY, MOON_PICK_RADIUS]).toEqual(['#CFE3FF', 0.35, 12])
  })

  test('MOON.1.a3: the inspector lists the same items as the moons, with the memory usage; a list item and a moon select each other', () => {
    const state = select('few')
    const view = inspector(galaxy, state, now)
    expect(view.knowledge!.items.map(item => item.id)).toEqual(moonRows(galaxy, state).map(row => row.id))
    expect(view.knowledge!.items.map(item => [item.label, item.text])).toEqual([
      ['Fact', 'Mnemosyne needs Bun'],
      ['Fact', 'Standards apply to all lanes'],
      ['Preference', 'Prefers tabs'],
      ['Timeline event', 'Release on 2026-11-01'],
    ])
    expect(view.knowledge!.items.every(item => item.usage === 'its memory recalled 7 times, last 2 days ago')).toBe(true)
    expect(view.knowledge!.items.map(item => item.colour)).toEqual([MOON_COLOURS.fact, MOON_COLOURS.fact, MOON_COLOURS.preference, MOON_COLOURS.timeline])
    expect(view.knowledge!.note).toContain('moons')
    // Nothing picked yet.
    expect(selectedMoon(galaxy, state)).toBeNull()
    expect(view.knowledge!.items.some(item => item.selected)).toBe(false)
    // Clicking a list item (or a moon: the same call with the moon's row id) picks it; both sides show it.
    const rows = moonRows(galaxy, state)
    const picked = selectMoon(state, galaxy, rows[2]!.id)
    expect(selectedMoon(galaxy, picked)).toBe(rows[2]!.id)
    expect(inspector(galaxy, picked, now).knowledge!.items.map(item => item.selected)).toEqual([false, false, true, false])
    expect(selectMoon(picked, galaxy, rows[0]!.id).moon).toBe(rows[0]!.id)
    // A row of another memory is ignored; a pick never survives a change of star or a reset.
    expect(selectMoon(state, galaxy, knowledgeOf(galaxy, ids.many!)[0]!.id)).toBe(state)
    expect(selectStar(picked, galaxy, ids.many!).moon).toBeNull()
    expect(resetView(picked).moon).toBeNull()
    expect(focusProject(picked, alpha).moon).toBeNull()
    expect(selectStar(picked, galaxy, ids.few!).moon).toBe(rows[2]!.id)
    // The usage wording.
    expect(usageText(0, null, now)).toBe('its memory was never recalled')
    expect(usageText(1, '2026-10-23T08:00:00.000Z', now)).toBe('its memory recalled 1 time, last today')
    expect(usageText(3, '2026-10-22T08:00:00.000Z', now)).toBe('its memory recalled 3 times, last yesterday')
    expect(usageText(2, null, now)).toBe('its memory recalled 2 times')
    // Hovering a moon shows its kind and its text.
    const hit = { kind: 'moon' as const, id: rows[2]!.id, sx: 0, sy: 0 }
    expect(tooltip(galaxy, hit)).toEqual({ title: 'Preference', sub: 'Prefers tabs' })
    expect(moonTooltip(galaxy, 'fact:99999')).toBeNull()
    expect(tooltip(galaxy, { ...hit, id: 'nope' })).toBeNull()
    // A moon is picked like a star: nearest inside its radius.
    expect(pickNearest([{ ...hit, sx: 100, sy: 100, radius: MOON_PICK_RADIUS, alpha: 0.9 }], 105, 103)?.kind).toBe('moon')
  })

  test('MOON.1.a4: a star with no knowledge says so, tells to reload, and has no moons', () => {
    const state = select('bare')
    const view = inspector(galaxy, state, now)
    expect(view.knowledge!.items).toEqual([])
    expect(view.knowledge!.note).toBe(NO_KNOWLEDGE_NOTE)
    expect(NO_KNOWLEDGE_NOTE).toContain('Nothing extracted from this memory yet.')
    expect(NO_KNOWLEDGE_NOTE.toLowerCase()).toContain('reload to see new knowledge')
    expect(moonRows(galaxy, state)).toEqual([])
    // Without any knowledge in the page the controls stay disabled.
    const empty = buildGalaxy(parseGalaxy({ memories: [{ id: 'm1', owner: 'global' }] })!, now)
    expect(hasKnowledge(empty)).toBe(false)
  })

  /** Runs the real createMap on the page markup with a real /api/galaxy reply and an `events` host; restores the globals after. */
  async function onPage(run: (page: { asked: string[]; push: (line: Record<string, unknown>) => void; node: (id: string) => FakeNode; show: (id: string) => void }) => Promise<void>) {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const fake = fakeDom(html)
    const g = globalThis as Record<string, unknown>
    const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement }
    g.document = fake.document
    g.CSS = { escape: (v: string) => v }
    g.HTMLElement = FakeBase
    try {
      const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => { show: (id: string) => void } }
      const asked: string[] = []
      let push: (line: Record<string, unknown>) => void = () => {
        throw new Error('the page never subscribed to the activity lines')
      }
      const view = createMap({
        api: async (path: string) => {
          asked.push(path)
          return path === '/api/galaxy' ? new Response(JSON.stringify(rawBody), { status: 200 }) : new Response('{"error":"not found"}', { status: 404 })
        },
        openMemory: () => {},
        status: () => {},
        events: (listener: (line: Record<string, unknown>) => void) => {
          push = listener
          return () => {}
        },
      })
      await Bun.sleep(40)
      await run({
        asked,
        push: line => {
          push(line)
        },
        node: id => fake.nodes.get(id)!,
        show: id => view.show(id),
      })
    } finally {
      g.document = saved.document
      g.CSS = saved.CSS
      g.HTMLElement = saved.HTMLElement
    }
  }

  const activity = (action: string, owner: string, memories: string[]) => ({ t: new Date().toISOString(), action, origin: 'hook', owner, text: 'x', ids: memories, count: memories.length, ok: true, client: 'claude-code', session: 'a1b2c3d4-0000-4000-8000-aaaaaaaaaaaa' })

  test('MOON.1.a5: an extract activity line through the page does not refetch the galaxy, and the chips, moons and inspector do not change (knowledge extracted after the page loaded shows after a reload)', async () => {
    // The pure edge: an extract line is not a map event at all; a save is.
    const line = activity('extract', beta, [ids.bare!])
    expect(toMapEvent(line)).toBeNull()
    expect(toMapEvent({ ...line, action: 'remember' })).not.toBeNull()
    await onPage(async ({ asked, push, node, show }) => {
      show(ids.bare!)
      const chips = node('map-know').groups
      const picture = () =>
        JSON.stringify({
          chips: chips.map(chip => [chip.textContent, chip.attributes.get('aria-disabled') ?? null, chip.attributes.get('aria-pressed') ?? null]),
          moons: [node('map-moons').disabled, node('map-moons').checked],
          note: node('map-know-note').textContent,
          inspector: node('map-inspector').texts(),
        })
      const feed = () => (node('map-feed').children as FakeNode[]).map(row => row.texts().join(' | '))
      const before = picture()
      expect(asked).toEqual(['/api/galaxy'])
      expect(chips.map(chip => chip.textContent)).toEqual(['4', '1', '1', '1', '2'])
      expect(node('map-inspector').texts().join(' ')).toContain(NO_KNOWLEDGE_NOTE)
      // The extract line arrives (the hook mined three items for this very memory).
      push(line)
      await Bun.sleep(40)
      expect(asked).toEqual(['/api/galaxy'])
      expect(picture()).toBe(before)
      expect(feed()).toEqual([STRIP_EMPTY_TEXT])
      // Control: the page IS listening, and a recall line from the same stream does reach it.
      push(activity('recall', beta, [ids.mixed!]))
      await Bun.sleep(40)
      expect(feed()[0]).toContain('Recalled 1')
      expect(asked).toEqual(['/api/galaxy'])
    })
  })

  test('a forgotten memory takes its knowledge out of the controls: forget the only memory with knowledge and the chips and the moons toggle go disabled, counts 0', async () => {
    // Pure: a page holding one memory with knowledge and one without.
    const one = () => buildGalaxy(parseGalaxy({ memories: [{ id: 'm1', owner: 'global' }, { id: 'm2', owner: 'global' }], knowledge: [{ id: 'fact:1', kind: 'fact', text: 'a fact', memory: 'm1' }] })!, now)
    const g = one()
    expect(hasKnowledge(g)).toBe(true)
    expect(forgetMemory(g, 'm2')).toBe(true)
    expect(hasKnowledge(g)).toBe(true)
    expect(forgetMemory(g, 'm1')).toBe(true)
    expect(hasKnowledge(g)).toBe(false)
    expect(knowledgeCounts(g)).toEqual({ fact: 0, preference: 0, instruction: 0, timeline: 0, relation: 0 })
    // On the real reply: forgetting every memory that has knowledge leaves none.
    const all = buildGalaxy(parseGalaxy(rawBody)!, now)
    for (const key of ['few', 'many', 'mixed']) forgetMemory(all, ids[key]!)
    expect(hasKnowledge(all)).toBe(true)
    forgetMemory(all, ids.markup!)
    expect(hasKnowledge(all)).toBe(false)
    // Through the page: the forget lines arrive, and the controls follow.
    await onPage(async ({ push, node }) => {
      const chips = node('map-know').groups
      expect(node('map-moons').disabled).toBe(false)
      for (const [key, owner] of [['few', alpha], ['many', alpha], ['mixed', beta], ['markup', 'global']] as const) {
        push(activity('forget', owner, [ids[key]!]))
        await Bun.sleep(30)
      }
      expect(node('map-moons').disabled).toBe(true)
      expect(chips.map(chip => chip.attributes.get('aria-disabled'))).toEqual(['true', 'true', 'true', 'true', 'true'])
      expect(chips.map(chip => chip.textContent)).toEqual(['0', '0', '0', '0', '0'])
      expect(node('map-know-note').textContent).toContain('No knowledge extracted yet')
    })
  })

  test('the moons say so once in plain words when the library has drawn no line to copy for their thin lines', () => {
    // Nothing to say while a line class exists, while the library has not been looked at enough, or while no moons are shown.
    expect(moonLinesProblem(true, LINE_CHECKS, true)).toBeNull()
    expect(moonLinesProblem(false, LINE_CHECKS - 1, true)).toBeNull()
    expect(moonLinesProblem(false, LINE_CHECKS, false)).toBeNull()
    const problem = moonLinesProblem(false, LINE_CHECKS, true)!
    expect(problem).toContain('without their thin lines')
    expect(problem).not.toMatch(/undefined|null|Error/)
    // The page says it through the status line, and only once.
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const lines = map.slice(map.indexOf('function makeMoonLines'), map.indexOf('/** The look of the label of a kind'))
    expect(lines).toContain('moonLinesProblem(false, sceneChecks, shown)')
    expect(lines).toContain("host.status(problem, 'error')")
    expect(lines).toContain('!moonLinesTold')
    expect(lines).toContain('moonLinesTold = true')
  })

  test('MOON.2.a1: the chips count the memories that have each kind', () => {
    // few: fact, preference, timeline. many: fact, relation. mixed: fact, instruction, relation. markup: fact. bare: none.
    expect(knowledgeCounts(galaxy)).toEqual({ fact: 4, preference: 1, instruction: 1, timeline: 1, relation: 2 })
    expect(CHIP_LABELS).toEqual({ fact: 'Facts', preference: 'Preferences', instruction: 'Instructions', timeline: 'Timeline', relation: 'Relations' })
    expect(KIND_LABELS.timeline).toBe('Timeline event')
    // A memory forgotten while the page is open leaves the counts.
    const copy = buildGalaxy(parseGalaxy(rawBody)!, now)
    expect(forgetMemory(copy, ids.many!)).toBe(true)
    expect(knowledgeCounts(copy)).toEqual({ fact: 3, preference: 1, instruction: 1, timeline: 1, relation: 1 })
    expect(knowledgeOf(copy, ids.many!)).toEqual([])
  })

  test('MOON.2.a1/a2: picking kinds dims every memory without one of them to a tenth; the note changes', () => {
    expect(DIM_NO_KNOWLEDGE).toBe(0.1)
    const target = (state: MapState, key: string) => starTarget(galaxy, indexOfStar(key), state, null)
    const none = base()
    const keys = ['few', 'many', 'mixed', 'bare', 'markup']
    // No kind picked: nothing dims, so every star keeps its plain brightness.
    const plain = Object.fromEntries(keys.map(key => [key, target(none, key)]))
    expect(knowledgeNote(none)).toBe('Pick a kind to light up only the memories it was mined from.')
    // One kind: preference. Only 'few' has it.
    const pref = toggleKind(none, 'preference')
    expect([...pref.kinds]).toEqual(['preference'])
    expect(knowledgeNote(pref)).toBe('Showing only memories with the chosen knowledge; the rest are dimmed.')
    expect(target(pref, 'few')).toBe(plain.few!)
    for (const key of ['many', 'mixed', 'bare', 'markup']) expect(target(pref, key)).toBeCloseTo(plain[key]! * 0.1, 12)
    // Two kinds: preference or instruction. few and mixed stay lit.
    const two = toggleKind(pref, 'instruction')
    expect(target(two, 'few')).toBe(plain.few!)
    expect(target(two, 'mixed')).toBe(plain.mixed!)
    for (const key of ['many', 'bare', 'markup']) expect(target(two, key)).toBeCloseTo(plain[key]! * 0.1, 12)
    expect(passesKnowledgeFilter(galaxy, ids.mixed!, two)).toBe(true)
    expect(passesKnowledgeFilter(galaxy, ids.bare!, two)).toBe(false)
    expect(passesKnowledgeFilter(galaxy, ids.bare!, none)).toBe(true)
    // Dropping a chip, an unknown kind, and a selected star (always fully lit).
    expect([...toggleKind(two, 'preference').kinds]).toEqual(['instruction'])
    expect(toggleKind(none, 'mood' as KnowledgeKind)).toBe(none)
    expect(target(select('bare', pref), 'bare')).toBe(1)
    // Dimming composes with the other rules (a focused project) instead of replacing them.
    const focused = focusProject(pref, beta)
    expect(target(focused, 'mixed')).toBeCloseTo(starTarget(galaxy, indexOfStar('mixed'), focusProject(none, beta), null) * 0.1, 12)
  })

  test('knowledge text is untrusted: the markup stays plain text in the state and is only ever set with textContent', () => {
    const row = knowledgeOf(galaxy, ids.markup!)[0]!
    expect(row.text).toBe(rawBody.knowledge.find(r => r.id === row.id)!.text)
    expect(row.text).toContain('<img src=x onerror=alert(1)>')
    const view = inspector(galaxy, select('markup'), now)
    expect(view.knowledge!.items[0]!.text).toBe(row.text)
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    expect(map).not.toMatch(/\binnerHTML\b|insertAdjacentHTML|outerHTML/)
  })

  test('the page: a star selected on the real reply lists its knowledge, a list item picks, the chips count and dim, moons toggle', async () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const fake = fakeDom(html)
    const g = globalThis as Record<string, unknown>
    const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement }
    g.document = fake.document
    g.CSS = { escape: (v: string) => v }
    g.HTMLElement = FakeBase
    try {
      const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => { show: (id: string) => void } }
      const view = createMap({ api: async () => new Response(JSON.stringify(rawBody), { status: 200 }), openMemory: () => {}, status: () => {} })
      await Bun.sleep(40)
      const node = (id: string) => fake.nodes.get(id)!
      const items = () => node('map-inspector').all().filter(n => n.dataset.knowledge !== undefined)
      // The chips: enabled by the knowledge, with the counts.
      const chips = node('map-know').groups
      expect(chips.map(chip => chip.attributes.get('aria-disabled'))).toEqual([undefined, undefined, undefined, undefined, undefined])
      expect(chips.map(chip => chip.textContent)).toEqual(['4', '1', '1', '1', '2'])
      expect(node('map-moons').disabled).toBe(false)
      expect(node('map-know-note').textContent).toBe('Pick a kind to light up only the memories it was mined from.')
      node('map-know').groups[1]!.fire('click')
      expect(chips.map(chip => chip.attributes.get('aria-pressed'))).toEqual(['false', 'true', 'false', 'false', 'false'])
      expect(node('map-know-note').textContent).toBe('Showing only memories with the chosen knowledge; the rest are dimmed. Clear')
      // QAMAP R2: the note carries its own Clear button, made by the map; it clears the chips.
      const clearButton = () => node('map-know-note').all().find(n => n.tagName === 'button' && n.textContent === 'Clear')
      expect(clearButton()).toBeDefined()
      clearButton()!.fire('click')
      expect(chips.map(chip => chip.attributes.get('aria-pressed'))).toEqual(['false', 'false', 'false', 'false', 'false'])
      expect(node('map-know-note').textContent).toBe('Pick a kind to light up only the memories it was mined from.')
      expect(clearButton()).toBeUndefined()
      // Reset view clears the chips too.
      node('map-know').groups[1]!.fire('click')
      expect(chips.map(chip => chip.attributes.get('aria-pressed'))).toEqual(['false', 'true', 'false', 'false', 'false'])
      node('map-reset').fire('click')
      expect(chips.map(chip => chip.attributes.get('aria-pressed'))).toEqual(['false', 'false', 'false', 'false', 'false'])
      expect(node('map-know-note').textContent).toBe('Pick a kind to light up only the memories it was mined from.')
      // A star with knowledge: the list has one button per row, text as plain text.
      view.show(ids.markup!)
      expect(items().length).toBe(1)
      expect(items()[0]!.texts()).toContain(MARKUP_FACT)
      expect(items()[0]!.children.every(child => !(child instanceof FakeNode) || child.tagName !== 'img')).toBe(true)
      view.show(ids.many!)
      expect(items().length).toBe(11)
      expect(items().every(item => item.attributes.get('aria-pressed') === 'false')).toBe(true)
      items()[4]!.fire('click')
      expect(items().map(item => item.attributes.get('aria-pressed'))).toEqual(items().map((_, i) => String(i === 4)))
      expect(items()[4]!.className).toContain('is-selected')
      // Moons off: the list stays, the note says how to bring the moons back.
      node('map-moons').checked = false
      node('map-moons').fire('change')
      expect(items().length).toBe(11)
      expect(node('map-inspector').texts().join(' ')).toContain('Turn on Knowledge moons')
      // A star with none: the empty text.
      view.show(ids.bare!)
      expect(items().length).toBe(0)
      expect(node('map-inspector').texts().join(' ')).toContain(NO_KNOWLEDGE_NOTE)
    } finally {
      g.document = saved.document
      g.CSS = saved.CSS
      g.HTMLElement = saved.HTMLElement
    }
  })

  test('the scene file draws what the state says: eight sprites, a line and a kind label per moon, the state functions for place, size and pulse', () => {
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const moons = map.slice(map.indexOf('// ---- Knowledge moons'), map.indexOf('/** A spark lands'))
    expect(moons).toContain('MOON_LIMIT')
    expect(moons).toContain('moonRows(g, state)')
    expect(moons).toContain('moonPosition(star.position, i, rows.length, clock, state.reducedMotion)')
    expect(moons).toContain('moonSize(chosen)')
    expect(moons).toContain('moonPulse(chosen, clock)')
    expect(moons).toContain('makeLabel(kind')
    expect(moons).toContain('array.set(star.position, 0)')
    // Per frame work: updateMoons only reads the cached plan and sets numbers; the rows, the joined key, the colours and the label textures are made when the galaxy or the selection changes.
    const frameWork = map.slice(map.indexOf('function updateMoons'), map.indexOf('/** A spark lands'))
    expect(frameWork).toContain('moonPlanFor(g)')
    expect(frameWork).not.toMatch(/rgb01\(|makeLabel\(|\.join\(|moonRows\(|new T\./)
    const plan = map.slice(map.indexOf('function moonPlanFor'), map.indexOf('/** Per frame: the moons'))
    expect(plan).toContain('moonRows(g, state)')
    expect(plan).toContain('p.galaxy === g')
    // One label look per kind, made once and shared: the render loop never makes a texture.
    const labels = map.slice(map.indexOf('function moonLabelLook'), map.indexOf('/** The moons\' data'))
    expect(labels).toContain('moonLabelStyle.get(kind)')
    expect(labels).toContain('moonLabelStyle.set(kind, look)')
    expect(labels).not.toContain('makeLabel(row')
    expect(map).toContain('const moonLabelStyle = new Map<KnowledgeKind')
    // Picking and clicking go through the state: a moon click selects its row, never flies.
    expect(map).toContain("kind: 'moon'")
    expect(map).toContain('selectMoon(state, galaxy, hit.id)')
    expect(map).toContain('toggleKind(state')
  })
})

// ---- TIME: the Timeline layout, on a real /api/galaxy reply ----
//
// Memories are written by the real engine into a real temporary store, their save
// dates are set in that store (as the specs above set recall counts), and the real
// server's /api/galaxy is read back; the positions are LAYOUT.2's real timelinePosition
// and ticks. Only the browser (the drawing, the flights, the look) is the orchestrator's QA.

describe('TIME: the Timeline layout', () => {
  const temp = tempDir('map-time')
  const store = join(temp.dir, 'store')
  let started: Started
  let galaxy: Galaxy
  let rawBody: unknown
  const ids: Record<string, string> = {}
  const alpha = 'project-alpha-1a2b'
  const beta = 'project-beta-9z8y'
  const old = 'project-old-77aa'
  const now = Date.parse('2026-10-23T12:00:00Z')
  const DAY = 86_400_000
  const daysAgo = (n: number) => new Date(now - n * DAY).toISOString()

  async function remember(owner: string, key: string, tags: string[]) {
    const answer = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content: `note ${key}`, metadata: { tags } })])).get(1))
    if (typeof answer?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(answer)}`)
    ids[key] = answer.memory_id as string
  }

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    // alpha: today, 3 days, 10 days; beta: 6 days, 40 days; old: only a memory 40 days old (nothing in 7 days or 30 days).
    for (const [owner, key, tag, age] of [
      [alpha, 'a0', 'fruit', 0],
      [alpha, 'a3', 'fruit', 3],
      [alpha, 'a10', 'veg', 10],
      [beta, 'b6', 'fruit', 6],
      [beta, 'b40', 'veg', 40],
      [old, 'o40', 'misc', 40],
    ] as [string, string, string, number][]) {
      await remember(owner, key, [tag])
      ages[key] = age
    }
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      for (const [key, age] of Object.entries(ages)) db.run('UPDATE working_memory SET timestamp = ? WHERE id = ?', [daysAgo(age), ids[key]!])
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: join(temp.dir, 'activity.jsonl'), pluginRoot: ROOT })
    const response = await fetch(`http://127.0.0.1:${started.port}/api/galaxy`, { headers: { Authorization: `Bearer ${started.token}` } })
    expect(response.status).toBe(200)
    rawBody = await response.json()
    const reply = parseGalaxy(rawBody)
    if (reply === null) throw new Error('not a galaxy')
    galaxy = buildGalaxy(reply, now)
  }, 180_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  const ages: Record<string, number> = {}
  const base = (layout: 'galaxy' | 'timeline' = 'galaxy'): MapState => initialState({ reducedMotion: false, layout })
  const slot = (key: string) => galaxy.layout.starById[ids[key]!]!
  const timeline = (range: MapState['range'] = 'all'): MapState => ({ ...base('timeline'), range })
  const target = (key: string, state: MapState) => starTarget(galaxy, slot(key), state, null)

  test('the real reply has the ages the spec set, and three project lanes', () => {
    expect(galaxy.layout.stars.length).toBe(6)
    for (const [key, age] of Object.entries(ages)) expect(galaxy.ages[slot(key)]).toBe(age)
    expect(galaxy.oldestAge).toBe(40)
    expect(galaxy.layout.cores.length).toBe(3)
  })

  // ---- TIME.1.a1: the morph ----

  test('TIME.1.a1: the morph takes 1.4 s with a cubic ease, and none under prefers-reduced-motion', () => {
    expect(MORPH_SECONDS).toBe(1.4)
    expect(morphSeconds(false)).toBe(1.4)
    expect(morphSeconds(true)).toBe(0)
    // The weight moves linearly; the drawn blend is the cubic ease of it: 0 at t=0, 0.5 at t=0.5, 1 at t=1.
    expect(morphBlend(0)).toBe(0)
    expect(morphBlend(0.5)).toBeCloseTo(0.5)
    expect(morphBlend(1)).toBe(1)
    expect(morphBlend(0.25)).toBeCloseTo(0.0625)
    expect(morphBlend(0.75)).toBeCloseTo(0.9375)
    expect(morphBlend(-3)).toBe(0)
    expect(morphBlend(9)).toBe(1)
    expect(stepMorph(0, 1, 0.7, 1.4)).toBeCloseTo(0.5)
    expect(stepMorph(0, 1, 1.4, 1.4)).toBe(1)
    expect(stepMorph(0, 1, 5, 1.4)).toBe(1)
    // 84 frames of 1/60 s end exactly on the target; a frame of 0 or less moves nothing.
    let weight = 0
    for (let i = 0; i < 84; i++) weight = stepMorph(weight, 1, 1 / 60, 1.4)
    expect(weight).toBeCloseTo(1, 6)
    expect(stepMorph(0.3, 1, 0, 1.4)).toBe(0.3)
    expect(stepMorph(0.3, 1, -1, 1.4)).toBe(0.3)
    // A switch back mid-morph turns around from where it is, at the same speed.
    expect(stepMorph(0.6, 0, 0.14, 1.4)).toBeCloseTo(0.5)
    expect(stepMorph(0.05, 0, 1, 1.4)).toBe(0)
  })

  test('TIME.1.a1: under reduced motion the morph is instant, both ways', () => {
    expect(stepMorph(0, 1, 0.016, morphSeconds(true))).toBe(1)
    expect(stepMorph(1, 0, 0.016, morphSeconds(true))).toBe(0)
    expect(stepMorph(0.4, 1, 0, morphSeconds(true))).toBe(1)
    expect(stepDays(30, 7, 0.016, true)).toBe(7)
  })

  test('TIME.1.a1: the morph aims at 1 in Timeline and 0 in the other layouts', () => {
    expect(morphTarget('timeline')).toBe(1)
    expect(morphTarget('galaxy')).toBe(0)
    expect(morphTarget('meaning')).toBe(0)
  })

  test('TIME.1.a1: cores shrink to half in Timeline; hubs, threads, bridges and particles fade out', () => {
    expect(TIMELINE_CORE_SCALE).toBe(0.5)
    expect(coreScale(0)).toBe(1)
    expect(coreScale(1)).toBe(0.5)
    expect(coreScale(0.5)).toBeCloseTo(0.75)
    expect(galaxyOnlyFade(0)).toBe(1)
    expect(galaxyOnlyFade(1)).toBe(0)
    expect(galaxyOnlyFade(0.25)).toBeCloseTo(0.75)
    expect(galaxyOnlyFade(1.5)).toBe(0)
  })

  test('TIME.1.a1: the places are the Galaxy ones at blend 0 and LAYOUT.2’s at blend 1, halfway between in the middle', () => {
    const places = timelinePlaces(galaxy, 42)
    galaxy.layout.stars.forEach((star, i) => {
      expect(blendPlace(star.position, places.stars[i]!, 0)).toEqual(star.position)
      expect(blendPlace(star.position, places.stars[i]!, 1)).toEqual(places.stars[i]!)
    })
    const mid = blendPlace([0, 0, 0], [10, 20, 30], 0.5)
    expect(mid).toEqual([5, 10, 15])
  })

  test('TIME.1.a1: every drawn thing has a Timeline place: stars by age and lane, cores heading lanes, the Claude core above today', () => {
    const days = timelineDays(galaxy, 'all')
    expect(days).toBe(42)
    const places = timelinePlaces(galaxy, days)
    expect(places.stars.length).toBe(galaxy.layout.stars.length)
    expect(places.hubs.length).toBe(galaxy.layout.hubs.length)
    expect(places.cores.length).toBe(3)
    expect(places.claude).toEqual(CLAUDE_CORE)
    for (const key of Object.keys(ages)) {
      const at = places.stars[slot(key)]!
      // x = 280 - age * 560 / days: today on the right.
      expect(at[0]).toBeCloseTo(TIMELINE_TODAY_X - (ages[key]! * TIMELINE_DAYS_X) / days)
    }
    expect(places.stars[slot('a0')]![0]).toBeGreaterThan(places.stars[slot('a10')]![0])
    // One lane per project, centred, 120 apart for three, lane 0 on top; each core heads its lane at x = -340.
    expect(places.cores.map(c => c[0])).toEqual([PROJECT_CORE_X, PROJECT_CORE_X, PROJECT_CORE_X])
    expect(places.cores.map(c => c[1])).toEqual([LANE_SPAN / 2, 0, -LANE_SPAN / 2])
    galaxy.layout.stars.forEach((star, i) => {
      const lane = galaxy.layout.coreByOwner[star.owner]!
      // A star sits within the seeded jitter (9 units, a few sigma) of its lane.
      expect(Math.abs(places.stars[i]![1] - places.cores[lane]![1])).toBeLessThan(9 * 5)
    })
    // The same galaxy gives the same places on every call.
    expect(timelinePlaces(galaxy, days)).toEqual(places)
    // A topic sits at its memories' average age: alpha's 'fruit' topic holds ages 0 and 3.
    const fruit = galaxy.layout.hubByKey[`${alpha}/fruit`]!
    expect(places.hubs[fruit]![0]).toBeCloseTo(TIMELINE_TODAY_X - (1.5 * TIMELINE_DAYS_X) / days)
  })

  test('TIME.1.a1: moons still orbit the selected star, wherever the morph has put it', () => {
    const places = timelinePlaces(galaxy, 42)
    const centre = places.stars[slot('a3')]!
    const orbit = (i: number) => moonPosition(centre, i, 3, 0, true)
    for (let i = 0; i < 3; i++) expect(Math.hypot(orbit(i)[0] - centre[0], orbit(i)[2] - centre[2])).toBeCloseTo(MOON_RADIUS)
  })

  // ---- TIME.1.a2: the camera and auto-rotate ----

  test('TIME.1.a2: Timeline has a straight-on pose facing the axis; leaving it flies to the Galaxy reset view', () => {
    expect(TIMELINE_POSE).toEqual({ position: [-20, 10, 800], target: [-20, 0, 0] })
    // Straight on: the camera looks along -z at the axis, its x equal to the target's.
    expect(TIMELINE_POSE.position[0]).toBe(TIMELINE_POSE.target[0])
    expect(flightTo(galaxy, 'reset')).toEqual({ target: [0, 0, 0], distance: 720 })
  })

  test('TIME.1.a2: entering Timeline pauses auto-rotate; leaving it restores it if it was on', () => {
    const on = base()
    expect(on.rotating).toBe(true)
    const entered = setLayout(on, 'timeline', true)
    expect(entered.layout).toBe('timeline')
    expect(entered.rotating).toBe(false)
    expect(entered.rotateBefore).toBe(true)
    const left = setLayout(entered, 'galaxy', true)
    expect(left.layout).toBe('galaxy')
    expect(left.rotating).toBe(true)
    expect(left.rotateBefore).toBe(false)
  })

  test('TIME.1.a2: auto-rotate that was off stays off after Timeline', () => {
    const off = toggleRotation(base())
    expect(off.rotating).toBe(false)
    const entered = setLayout(off, 'timeline', true)
    expect(entered.rotating).toBe(false)
    expect(entered.rotateBefore).toBe(false)
    const left = setLayout(entered, 'galaxy', true)
    expect(left.rotating).toBe(false)
    // Reduced motion starts with it off, so it stays off.
    const calm = initialState({ reducedMotion: true })
    expect(setLayout(setLayout(calm, 'timeline', true), 'galaxy', true).rotating).toBe(false)
  })

  test('TIME.1.a2: leaving Timeline for Meaning restores it too; one the person turned on inside Timeline is kept', () => {
    const entered = setLayout(base(), 'timeline', true)
    expect(setLayout(entered, 'meaning', true).rotating).toBe(true)
    const chosen = toggleRotation(setLayout(toggleRotation(base()), 'timeline', true))
    expect(chosen.rotating).toBe(true)
    expect(setLayout(chosen, 'galaxy', true).rotating).toBe(true)
    // A switch to the layout already showing, and one to Meaning without it, change nothing.
    expect(setLayout(entered, 'timeline', true)).toBe(entered)
    expect(setLayout(base(), 'meaning', false)).toEqual(base())
    // A switch between Galaxy and Meaning never touches the rotation.
    const meaning = setLayout(base(), 'meaning', true)
    expect(meaning.rotating).toBe(true)
    expect(meaning.rotateBefore).toBe(false)
  })

  test('TIME.1.a2: opening on a stored Timeline layout starts as a switch to it would: rotation paused, remembered for the way back', () => {
    const opened = base('timeline')
    expect(opened).toMatchObject({ layout: 'timeline', rotating: false, rotateBefore: true })
    expect(setLayout(opened, 'galaxy', true).rotating).toBe(true)
    expect(initialState({ reducedMotion: true, layout: 'timeline' })).toMatchObject({ rotating: false, rotateBefore: false })
    expect(base('galaxy')).toMatchObject({ rotating: true, rotateBefore: false })
  })

  // ---- TIME.1.a3: the range ----

  test('TIME.1.a3: the range spans 7 days, 30 days, or the oldest memory plus two days', () => {
    expect(timelineDays(galaxy, 7)).toBe(7)
    expect(timelineDays(galaxy, 30)).toBe(30)
    expect(timelineDays(galaxy, 'all')).toBe(42)
    expect(inTimelineRange(7, 7)).toBe(true)
    expect(inTimelineRange(8, 7)).toBe(false)
  })

  test('TIME.1.a3: stars older than the range fade out in Timeline, and in no other layout', () => {
    const seven = timeline(7)
    expect(target('a0', seven)).toBeGreaterThan(0)
    expect(target('a3', seven)).toBeGreaterThan(0)
    expect(target('b6', seven)).toBeGreaterThan(0)
    expect(target('a10', seven)).toBe(0)
    expect(target('b40', seven)).toBe(0)
    const thirty = timeline(30)
    expect(target('a10', thirty)).toBeGreaterThan(0)
    expect(target('b40', thirty)).toBe(0)
    for (const key of Object.keys(ages)) expect(target(key, timeline('all'))).toBeGreaterThan(0)
    // Galaxy and Meaning ignore the range.
    for (const layout of ['galaxy', 'meaning'] as const) expect(target('b40', { ...base(), layout, range: 7 })).toBeGreaterThan(0)
    // A star the person has selected stays lit, so it can be found.
    expect(target('b40', { ...seven, selected: ids.b40! })).toBe(1)
  })

  test('TIME.1.a3: a range change rescales smoothly toward the new days, never past them', () => {
    let days = 30
    const trail: number[] = []
    for (let i = 0; i < 120; i++) {
      days = stepDays(days, 7, 1 / 60, false)
      trail.push(days)
    }
    expect(trail.every((d, i) => d <= (trail[i - 1] ?? 30) && d >= 7)).toBe(true)
    expect(trail[0]).toBeGreaterThan(7)
    expect(trail[0]).toBeLessThan(30)
    expect(trail.at(-1)).toBe(7)
    // The other way, and the rate: 1 - e^(-RANGE_FOLLOW t) of the gap in t seconds.
    expect(stepDays(7, 30, 0.5, false)).toBeCloseTo(7 + 23 * (1 - Math.exp(-RANGE_FOLLOW * 0.5)))
    expect(stepDays(7, 7, 1, false)).toBe(7)
    expect(stepDays(30, 42, 0, false)).toBe(30)
  })

  test('TIME.1.a3: tick marks slide with the shown days; today stays put', () => {
    expect(tickX(0, 7)).toBe(TIMELINE_TODAY_X)
    expect(tickX(0, 42)).toBe(TIMELINE_TODAY_X)
    expect(tickX(7, 7)).toBeCloseTo(TIMELINE_TODAY_X - TIMELINE_DAYS_X)
    expect(tickX(7, 30)).toBeCloseTo(TIMELINE_TODAY_X - (7 * TIMELINE_DAYS_X) / 30)
    expect(tickX(5, 0)).toBe(TIMELINE_TODAY_X - 5 * TIMELINE_DAYS_X)
  })

  test('TIME.1.a3: the real galaxy at 7, 30 and All: stars land on the scale of the range showing', () => {
    for (const range of [7, 30, 'all'] as const) {
      const days = timelineDays(galaxy, range)
      const at = timelinePlaces(galaxy, days).stars[slot('b6')]!
      expect(at[0]).toBeCloseTo(TIMELINE_TODAY_X - (6 * TIMELINE_DAYS_X) / days)
    }
    // A star at exactly the range’s age sits on the left edge.
    expect(timelinePlaces(galaxy, 6).stars[slot('b6')]![0]).toBeCloseTo(-TIMELINE_TODAY_X)
  })

  test('TIME.1.a3: a project with nothing in the range keeps its lane and its core, with every star faded', () => {
    for (const range of [7, 30] as const) {
      const state = timeline(range)
      const own = galaxy.layout.stars.filter(star => star.owner === old)
      expect(own.length).toBe(1)
      expect(own.every(star => starTarget(galaxy, galaxy.layout.starById[star.id]!, state, null) === 0)).toBe(true)
      expect(coreTarget(state, old)).toBe(1)
    }
    const lanes = laneLines(galaxy)
    expect(lanes.map(lane => lane.owner).sort()).toEqual([alpha, beta, old].sort())
    expect(new Set(lanes.map(lane => lane.from[1])).size).toBe(3)
  })

  test('TIME.1.a3: a galaxy with 0 memories has the 2-day All range, only the Claude core, no lanes, and no star to fade', () => {
    const empty = buildGalaxy({ memories: [], projects: [], knowledge: [], meaning: false, total: 0, shown: 0 } as unknown as GalaxyReply, now)
    expect(timelineDays(empty, 'all')).toBe(2)
    expect(timelineDays(empty, 7)).toBe(7)
    const places = timelinePlaces(empty, 2)
    expect(places).toEqual({ claude: CLAUDE_CORE, cores: [], hubs: [], stars: [] })
    expect(laneLines(empty)).toEqual([])
    expect(inspector(empty, timeline()).title).toBe('0 memories')
    expect(inspector(empty, timeline()).hint).toBe(TIMELINE_HINT)
  })

  test('TIME.1.a3: a store with one project puts its lane in the middle', () => {
    const one = buildGalaxy(
      parseGalaxy({ ...(rawBody as Record<string, unknown>), projects: [(rawBody as { projects: unknown[] }).projects.find(p => (p as { owner: string }).owner === alpha)], memories: (rawBody as { memories: { owner: string }[] }).memories.filter(m => m.owner === alpha), knowledge: [] })!,
      now,
    )
    expect(one.layout.cores.length).toBe(1)
    expect(timelinePlaces(one, 30).cores[0]).toEqual([PROJECT_CORE_X, 0, 0])
  })

  // ---- TIME.1.a4: the hint ----

  test('TIME.1.a4: the overview hint in Timeline reads "Newest on the right; each lane is one project"', () => {
    expect(TIMELINE_HINT).toBe('Newest on the right; each lane is one project')
    expect(inspector(galaxy, timeline()).hint).toBe('Newest on the right; each lane is one project')
    expect(inspector(galaxy, base()).hint).toBe('Every star is one memory. Click a project core to fly in.')
    // A selected star keeps its own hint in Timeline.
    expect(inspector(galaxy, selectStar(timeline(), galaxy, ids.a0!)).hint).toBe('Never recalled: a candidate to review or forget.')
  })

  // ---- TIME.2: ticks, gridlines and lane baselines ----

  test('TIME.2.a1: tick labels are LAYOUT.2’s ticks(), with a faint gridline each', () => {
    expect(rangeTicks(7, 7)).toEqual(ticks(7, 7))
    expect(rangeTicks(7, 7).map(t => t.label)).toEqual(['today', '1 day ago', '2 days ago', '3 days ago', '4 days ago', '5 days ago', '6 days ago', '7 days ago'])
    expect(rangeTicks(30, 30).map(t => t.days)).toEqual([0, 7, 14, 21, 28])
    expect(rangeTicks('all', 42).map(t => t.days)).toEqual([0, 7, 14, 21, 28, 35, 42])
    // A gridline runs from y -160 to 160 at the tick, behind the stars, faint.
    expect(gridLine(100)).toEqual([[100, GRID_Y[0], GRID_Z], [100, GRID_Y[1], GRID_Z]])
    expect(GRID_Y).toEqual([-160, 160])
    expect(GRID_Z).toBeLessThan(0)
    expect(GRID_OPACITY).toBeLessThan(0.5)
    expect(GRID_COLOUR).toBe('#5A6B7D')
    // The labels sit under the lanes, large enough to read at the default view (camera 800 away).
    expect(TICK_LABEL_Y).toBeLessThan(-LANE_SPAN / 2)
    expect(TICK_LABEL_HEIGHT).toBeGreaterThanOrEqual(12)
    expect(TICK_LABEL_OPACITY).toBeGreaterThan(0.8)
    expect(TICK_LABEL_COLOUR).toMatch(/^#[0-9A-F]{6}$/)
  })

  test('TIME.2.a2: a faint baseline per lane in its project colour, from the cores to just past today', () => {
    const lanes = laneLines(galaxy)
    expect(lanes.length).toBe(galaxy.layout.cores.length)
    galaxy.layout.cores.forEach((core, i) => {
      const lane = lanes[i]!
      expect(lane.owner).toBe(core.owner)
      expect(lane.colour).toBe(projectColour(galaxy, core.owner))
      expect(lane.from).toEqual([LANE_X[0], timelinePlaces(galaxy, 30).cores[i]![1], LANE_Z])
      expect(lane.to).toEqual([LANE_X[1], lane.from[1], LANE_Z])
    })
    expect(LANE_X[0]).toBeLessThan(PROJECT_CORE_X + 40)
    expect(LANE_X[1]).toBeGreaterThan(TIMELINE_TODAY_X)
    expect(LANE_OPACITY).toBeLessThan(0.5)
    // Every lane has its own colour.
    expect(new Set(lanes.map(l => l.colour)).size).toBe(lanes.length)
  })

  test('TIME.2.a3: sparks fly from the Claude core, which sits above today in Timeline', () => {
    const claude = timelinePlaces(galaxy, 42).claude
    expect(claude).toEqual(CLAUDE_CORE)
    expect(claude[0]).toBeGreaterThan(TIMELINE_TODAY_X)
    expect(claude[1]).toBeGreaterThan(LANE_SPAN / 2)
    const to = timelinePlaces(galaxy, 42).stars[slot('a0')]!
    expect(sparkAt(claude, to, 0, 0)).toEqual(claude)
    expect(sparkAt(claude, to, 0, 1)).toEqual(to)
    // Every spark starts at the Claude visual's place (not at the origin) once it is drawn.
    expect(sparkOrigin(claude)).toEqual(claude)
    expect(sparkOrigin(visualPlace([0, 0, 0], claude, 0.5))).toEqual([claude[0] / 2, claude[1] / 2, claude[2] / 2])
    expect(sparkOrigin(undefined)).toEqual([0, 0, 0])
    expect(sparkOrigin(null)).toEqual([0, 0, 0])
  })

  test('GUARD (source text, not behaviour): the frame calls each helper that decides its work, and the scene never makes markup from a label', () => {
    // The behaviour of every helper below is tested with real values elsewhere in this file; this only guards that the scene file still calls them.
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const timelinePart = map.slice(map.indexOf('function flyToPose('), map.indexOf('// ---- Live: events become sparks'))
    for (const call of ['layoutStep(', 'placesFor(', 'visualPlace(', 'awayPlace(', 'samePlace(', 'linkFadeToApply(', 'furnitureIdle(', 'wantedTicks(', 'easeToward(', 'tickTarget(', 'laneTarget(', 'gridOpacity(', 'needsGridLine(', 'tickReleased(', 'visualFade(', 'visualScale(', 'sparkOrigin(', 'layoutFlight(', 'timelineAim(', 'timelineCentre(', 'disposeTicks()']) expect(timelinePart).toContain(call)
    // The node a visual writes to is its own; an update event moves its star to today.
    expect(timelinePart).toContain('const node = v.node as Any')
    expect(map).toMatch(/touchMemory\(g, id\)\) return\s*\n\s*\/\/ In Timeline an updated memory jumps to today\.\s*\n\s*placeDirty = true/)
    expect(map).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/)
  })

  test('the Timeline code keeps GAL’s and MOON’s fixes: no Object-key collisions, one primary button, disposal of old visuals', () => {
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    expect(map).toContain('disposeVisuals()')
    expect(map).toContain('isPrimary(event)')
    expect(map).toContain('slotOf(g.layout.starById')
    // A project named like an Object member still gets a lane.
    const odd = buildGalaxy({ projects: [{ owner: 'constructor', label: 'constructor', count: 1, recalls: 0 }, { owner: 'toString', label: 'toString', count: 1, recalls: 0 }], memories: [{ id: 'x1', owner: 'constructor', tags: [], recalls: 0, lastRecalled: null, created: daysAgo(1), label: 'x' }, { id: 'x2', owner: 'toString', tags: ['t'], recalls: 0, lastRecalled: null, created: daysAgo(2), label: 'y' }], knowledge: [], meaning: false, total: 2, shown: 2 } as unknown as GalaxyReply, now)
    const places = timelinePlaces(odd, 30)
    expect(places.cores.length).toBe(2)
    expect(places.stars.length).toBe(2)
    expect(new Set(places.stars.map(s => s[1] > 0)).size).toBe(2)
  })

  // ---- R2: the fixes the review asked for ----

  const fresh = () => buildGalaxy(parseGalaxy(rawBody)!, now)
  /** The real reply with some memories' save dates replaced. */
  const withDates = (dates: Record<string, string | null>) => {
    const raw = structuredClone(rawBody) as { memories: { id: string; created: string | null }[] }
    for (const m of raw.memories) for (const [key, value] of Object.entries(dates)) if (m.id === ids[key]) m.created = value
    return buildGalaxy(parseGalaxy(raw)!, now)
  }
  const laneY = (owner: string, g = galaxy) => timelinePlaces(g, 30).cores[g.layout.coreByOwner[owner]!]![1]

  test('R2.1: a selected star older than the range stays lit and is held at the left edge of the axis, with its moons', () => {
    expect(TIMELINE_LEFT_X).toBe(-280)
    const seven = { ...timeline(7), selected: ids.b40! }
    expect(target('b40', seven)).toBe(1)
    const places = timelinePlaces(galaxy, 7)
    // Unclamped it would be at 280 - 40 * 560 / 7 = -2920.
    expect(places.stars[slot('b40')]![0]).toBe(-280)
    expect(places.stars[slot('a10')]![0]).toBe(-280)
    // A star inside the range is where its age puts it, and one at exactly the range's age is on the edge.
    expect(places.stars[slot('b6')]![0]).toBeCloseTo(TIMELINE_TODAY_X - (6 * TIMELINE_DAYS_X) / 7)
    expect(places.stars[slot('a0')]![0]).toBe(TIMELINE_TODAY_X)
    // At every range no star is left of the axis.
    for (const range of [7, 30, 'all'] as const) for (const at of timelinePlaces(galaxy, timelineDays(galaxy, range)).stars) expect(at[0]).toBeGreaterThanOrEqual(-280)
    // Its moons orbit the held place, so they stay on screen too.
    const held = places.stars[slot('b40')]!
    for (let i = 0; i < 3; i++) expect(moonPosition(held, i, 3, 0, true)[0]).toBeGreaterThan(-280 - 2 * MOON_RADIUS)
    // The flight a rail or Find click starts aims at the held place.
    expect(timelineAim(galaxy, places, 'star', ids.b40!, 7)).toEqual(held)
    // Not selected, it is faded out as before.
    expect(target('b40', timeline(7))).toBe(0)
  })

  test('R2.2: a topic flight in Timeline aims at its project lane and the average x of its stars on the axis', () => {
    const days = 7
    const places = timelinePlaces(galaxy, days)
    const aim = (key: string) => timelineAim(galaxy, places, 'hub', key, days)!
    // beta/fruit holds b6 (in range): its x, on beta's lane.
    expect(aim(`${beta}/fruit`)).toEqual([places.stars[slot('b6')]![0], laneY(beta), 0])
    // alpha/fruit holds a0 and a3: the average of their x.
    expect(aim(`${alpha}/fruit`)[0]).toBeCloseTo((places.stars[slot('a0')]![0] + places.stars[slot('a3')]![0]) / 2)
    expect(aim(`${alpha}/fruit`)[1]).toBe(laneY(alpha))
    // alpha/veg holds only a10, past the 7 days: no star on the axis, so the lane centre.
    expect(aim(`${alpha}/veg`)).toEqual([LANE_CENTRE_X, laneY(alpha), 0])
    expect(LANE_CENTRE_X).toBe(-5)
    // The hub itself is where the old flight went: past the left edge of a lane's baseline for a topic of old memories.
    const hub = places.hubs[galaxy.layout.hubByKey[`${alpha}/veg`]!]!
    expect(hub[0]).toBeLessThan(aim(`${alpha}/veg`)[0])
    // With All every star counts; the middle is the average of the topic's stars.
    const all = timelinePlaces(galaxy, 42)
    expect(timelineAim(galaxy, all, 'hub', `${beta}/veg`, 42)![0]).toBeCloseTo(all.stars[slot('b40')]![0])
    // A forgotten star no longer pulls it; unknown topics have no aim; cores aim at their place.
    const g = fresh()
    forgetMemory(g, ids.b6!)
    expect(timelineAim(g, timelinePlaces(g, 7), 'hub', `${beta}/fruit`, 7)![0]).toBe(LANE_CENTRE_X)
    expect(timelineAim(galaxy, places, 'hub', 'nobody/none', days)).toBeNull()
    expect(timelineAim(galaxy, places, 'core', beta, days)).toEqual(places.cores[galaxy.layout.coreByOwner[beta]!]!)
  })

  test('R2.2: Find in Timeline centres on the stars on the axis only', () => {
    const places = timelinePlaces(galaxy, 7)
    expect(timelineCentre(galaxy, places, [ids.a0!, ids.b40!], 7)).toEqual(places.stars[slot('a0')]!)
    expect(timelineCentre(galaxy, places, [ids.b40!, ids.a10!], 7)).toBeNull()
    expect(timelineCentre(galaxy, places, [], 7)).toBeNull()
    expect(timelineCentre(galaxy, places, ['no-such-id'], 7)).toBeNull()
  })

  test('R2.4: a memory with no usable save date is left off the Timeline axis, and a future date counts as today', () => {
    const g = withDates({ a0: null, a3: 'not a date', a10: new Date(now + 5 * DAY).toISOString() })
    expect(g.undated.has(ids.a0!)).toBe(true)
    expect(g.undated.has(ids.a3!)).toBe(true)
    expect(g.undated.has(ids.a10!)).toBe(false)
    expect(g.undated.size).toBe(2)
    expect(g.ages[g.layout.starById[ids.a10!]!]).toBe(0)
    const at = (key: string, state: MapState) => starTarget(g, g.layout.starById[ids[key]!]!, state, null)
    // Timeline: no alpha for the undated ones at any range; the future one is lit like a memory from today.
    for (const range of [7, 30, 'all'] as const) {
      expect(at('a0', timeline(range))).toBe(0)
      expect(at('a3', timeline(range))).toBe(0)
      expect(at('a10', timeline(range))).toBeGreaterThan(0)
    }
    // Galaxy and Meaning still draw them.
    for (const layout of ['galaxy', 'meaning'] as const) expect(at('a0', { ...base(), layout })).toBeGreaterThan(0)
    // Their Timeline place is the left edge (never "today"); the future one sits on today.
    const places = timelinePlaces(g, 30)
    expect(places.stars[g.layout.starById[ids.a0!]!]![0]).toBe(-280)
    expect(places.stars[g.layout.starById[ids.a3!]!]![0]).toBe(-280)
    expect(places.stars[g.layout.starById[ids.a10!]!]![0]).toBe(TIMELINE_TODAY_X)
    expect(onTimelineAxis(g, g.layout.starById[ids.a0!]!, 30)).toBe(false)
    expect(onTimelineAxis(g, g.layout.starById[ids.a10!]!, 30)).toBe(true)
    // A selected one stays lit (and held at the edge); an update makes it dated, today.
    expect(at('a0', { ...timeline(30), selected: ids.a0! })).toBe(1)
    expect(touchMemory(g, ids.a0!)).toBe(true)
    expect(g.undated.has(ids.a0!)).toBe(false)
    expect(at('a0', timeline(30))).toBeGreaterThan(0)
    expect(timelinePlaces(g, 30).stars[g.layout.starById[ids.a0!]!]![0]).toBe(TIMELINE_TODAY_X)
    // The topic average and the centre ignore an undated star.
    expect(timelineCentre(g, timelinePlaces(g, 30), [ids.a3!], 30)).toBeNull()
  })

  test('R2.9: the oldest age follows updates and forgets, so All is no wider than needed', () => {
    const g = fresh()
    expect(g.oldestAge).toBe(40)
    expect(timelineDays(g, 'all')).toBe(42)
    expect(forgetMemory(g, ids.b40!)).toBe(true)
    expect(g.oldestAge).toBe(40)
    expect(forgetMemory(g, ids.o40!)).toBe(true)
    expect(g.oldestAge).toBe(10)
    expect(timelineDays(g, 'all')).toBe(12)
    expect(touchMemory(g, ids.a10!)).toBe(true)
    expect(g.oldestAge).toBe(6)
    expect(timelineDays(g, 'all')).toBe(8)
    expect(liveOldestAge(g)).toBe(6)
    // Everything forgotten or updated: the range is the 2-day minimum.
    for (const key of ['a0', 'a3', 'b6']) forgetMemory(g, ids[key]!)
    expect(g.oldestAge).toBe(0)
    expect(timelineDays(g, 'all')).toBe(2)
  })

  test('R2.5/R2.7: the layout step places only when something moves, and not for a range change in Galaxy', () => {
    // Galaxy at rest: a range change moves the shown days but never asks for a placement (the old code placed every frame for about a second).
    let days = 30
    let places = 0
    for (let i = 0; i < 150; i++) {
      const step = layoutStep(0, days, 'galaxy', 7, 1 / 60, false, false)
      expect(step.morph).toBe(0)
      days = step.days
      if (step.place) places++
    }
    expect(places).toBe(0)
    expect(days).toBe(7)
    // Timeline settled: nothing moves, nothing is placed.
    expect(layoutStep(1, 7, 'timeline', 7, 1 / 60, false, false)).toEqual({ morph: 1, days: 7, place: false })
    // Timeline: a range change places every frame until it arrives.
    expect(layoutStep(1, 30, 'timeline', 7, 1 / 60, false, false).place).toBe(true)
    // A morph places, a dirty flag places once, reduced motion lands at once.
    expect(layoutStep(0, 30, 'timeline', 30, 1 / 60, false, false)).toMatchObject({ place: true })
    expect(layoutStep(0, 30, 'galaxy', 30, 1 / 60, false, true).place).toBe(true)
    expect(layoutStep(0, 30, 'timeline', 7, 0.016, true, false)).toEqual({ morph: 1, days: 7, place: true })
    // The way back ends exactly on Galaxy and places on the way.
    let morph = 1
    let count = 0
    for (let i = 0; i < 100; i++) {
      const step = layoutStep(morph, 30, 'galaxy', 30, 1 / 60, false, false)
      if (step.place) count++
      morph = step.morph
    }
    expect(morph).toBe(0)
    // About 1.4 s of frames at 60 per second, then nothing more.
    expect(count).toBeGreaterThanOrEqual(84)
    expect(count).toBeLessThanOrEqual(85)
  })

  test('R2.7: the Timeline places are kept for the same galaxy and days, and made again when stale', () => {
    let cache: PlacesCache = null
    const first = placesFor(cache, galaxy, 30, false)
    cache = first.cache
    expect(first.places).toEqual(timelinePlaces(galaxy, 30))
    const again = placesFor(cache, galaxy, 30, false)
    expect(again.places).toBe(first.places)
    expect(placesFor(cache, galaxy, 29.5, false).places).not.toBe(first.places)
    expect(placesFor(cache, galaxy, 30, true).places).not.toBe(first.places)
    expect(placesFor(cache, fresh(), 30, false).places).not.toBe(first.places)
  })

  test('R2.5: a visual is at its home at blend 0, at the Timeline place at 1, and its moons follow it in between', () => {
    const places = timelinePlaces(galaxy, 30)
    const star = galaxy.layout.stars[slot('a3')]!
    const away = awayPlace(places, 'star', slot('a3'))!
    expect(away).toBe(places.stars[slot('a3')]!)
    expect(awayPlace(places, 'hub', 0)).toBe(places.hubs[0]!)
    expect(awayPlace(places, 'core', 1)).toBe(places.cores[1]!)
    expect(awayPlace(places, 'claude', 0)).toBe(places.claude)
    expect(awayPlace(places, 'star', 999)).toBeUndefined()
    // Home at 0 (a copy, not the layout's own array), no away place: home.
    const home = visualPlace(star.position, away, 0)
    expect(home).toEqual(star.position)
    expect(home).not.toBe(star.position)
    expect(visualPlace(star.position, undefined, 0.5)).toEqual(star.position)
    expect(visualPlace(star.position, away, 1)).toEqual(away)
    // Halfway through the ease the moons orbit the point between, not the Galaxy place.
    const mid = visualPlace(star.position, away, morphBlend(0.5))
    for (let i = 0; i < 3; i++) {
      const moon = moonPosition(mid, i, 3, 0, true)
      expect(Math.hypot(moon[0] - mid[0], moon[2] - mid[2])).toBeCloseTo(MOON_RADIUS)
    }
    expect(samePlace(mid, [...mid] as Vec3)).toBe(true)
    expect(samePlace(mid, away)).toBe(false)
    // At rest in Galaxy a second write moves nothing (so no reheat of the engine).
    expect(samePlace(visualPlace(star.position, away, 0), visualPlace(star.position, away, 0))).toBe(true)
  })

  test('R2.5/R2.6: the links are written when the fade changes or the links were rebuilt, and never while fully visible', () => {
    // Fully visible stays untouched, even when the links were rebuilt (fresh links are at full opacity).
    expect(linkFadeToApply(1, 1, false)).toBeNull()
    expect(linkFadeToApply(1, 1, true)).toBeNull()
    // A fade that moved is written; the same fade is not, unless the links were rebuilt.
    expect(linkFadeToApply(0.6, 1, false)).toBe(0.6)
    expect(linkFadeToApply(0, 0.2, false)).toBe(0)
    expect(linkFadeToApply(0, 0, false)).toBeNull()
    expect(linkFadeToApply(0, 0, true)).toBe(0)
    // Coming back to Galaxy: the last step to 1 is written once.
    expect(linkFadeToApply(1, 0.9, false)).toBe(1)
    // A Timeline held for 600 frames writes the links once.
    let applied = 1
    let dirty = true
    let writes = 0
    for (let frame = 0; frame < 600; frame++) {
      const fade = galaxyOnlyFade(morphBlend(Math.min(1, frame / 84)))
      const to = linkFadeToApply(fade, applied, dirty)
      if (to !== null) {
        applied = to
        dirty = false
        writes++
      }
    }
    expect(applied).toBe(0)
    expect(writes).toBeLessThanOrEqual(85)
    const before = writes
    for (let frame = 0; frame < 300; frame++) if (linkFadeToApply(0, applied, dirty) !== null) writes++
    expect(writes).toBe(before)
  })

  test('R2.5: what is drawn each frame: hubs alone fade, cores and the Claude core shrink, every thing grows with its pulse', () => {
    expect(visualFade('hub', 0.25)).toBe(0.25)
    for (const kind of ['star', 'core', 'claude'] as const) expect(visualFade(kind, 0.25)).toBe(1)
    expect(visualScale('core', 10, 1, 0)).toBe(5)
    expect(visualScale('claude', 10, 1, 0)).toBe(5)
    expect(visualScale('core', 10, 0.5, 0)).toBeCloseTo(7.5)
    expect(visualScale('star', 10, 1, 0)).toBe(10)
    expect(visualScale('hub', 10, 1, 0)).toBe(10)
    expect(visualScale('star', 10, 0, 0.5)).toBeCloseTo(18)
    expect(visualScale('core', 10, 0, 0)).toBe(10)
  })

  test('R2.5: layout switches ask for the straight-on view into Timeline and the Galaxy view out of it', () => {
    expect(layoutFlight('galaxy', 'timeline')).toBe('timeline')
    expect(layoutFlight('meaning', 'timeline')).toBe('timeline')
    expect(layoutFlight('timeline', 'galaxy')).toBe('galaxy')
    expect(layoutFlight('timeline', 'meaning')).toBe('galaxy')
    expect(layoutFlight('galaxy', 'meaning')).toBeNull()
    expect(layoutFlight('timeline', 'timeline')).toBeNull()
  })

  test('R2.5: the ticks the axis wants for a range, one gridline each, and their fade', () => {
    // None while no Timeline is blended in; LAYOUT.2's ticks otherwise, the same list on every frame.
    expect(wantedTicks(7, 7, 0)).toEqual([])
    expect(wantedTicks(7, 7, 0.01).map(t => t.days)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(wantedTicks(30, 30, 1).map(t => t.days)).toEqual([0, 7, 14, 21, 28])
    const all = wantedTicks('all', 42, 1)
    expect(all.map(t => t.days)).toEqual([0, 7, 14, 21, 28, 35, 42])
    expect(wantedTicks('all', 42, 0.5)).toBe(all)
    // A tick of the old range that the new one does not have is not wanted (and gets released once faded); one both have stays.
    const seven = wantedTicks(7, 7, 1)
    expect(tickWanted(seven, 0)).toBe(true)
    expect(tickWanted(seven, 14)).toBe(false)
    expect(tickWanted(wantedTicks(30, 30, 1), 14)).toBe(true)
    expect(tickWanted([], 0)).toBe(false)
    // Opacity: labels come in with the blend, lanes too, and a hidden project's lane stays out.
    expect(tickTarget(true, 1)).toBe(TICK_LABEL_OPACITY)
    expect(tickTarget(true, 0.5)).toBeCloseTo(TICK_LABEL_OPACITY / 2)
    expect(tickTarget(false, 1)).toBe(0)
    expect(laneTarget(1, false)).toBe(LANE_OPACITY)
    expect(laneTarget(0, false)).toBe(0)
    expect(laneTarget(1, true)).toBe(0)
    // A gridline follows its label: at the label's full opacity it is GRID_OPACITY, made only once the label shows.
    expect(gridOpacity(TICK_LABEL_OPACITY)).toBeCloseTo(GRID_OPACITY)
    expect(gridOpacity(0)).toBe(0)
    expect(needsGridLine(false, 0)).toBe(false)
    expect(needsGridLine(false, FURNITURE_EPSILON)).toBe(false)
    expect(needsGridLine(false, 0.2)).toBe(true)
    expect(needsGridLine(true, 0.9)).toBe(false)
    // Released only when no longer wanted and faded out.
    expect(tickReleased(false, 0)).toBe(true)
    expect(tickReleased(false, 0.4)).toBe(false)
    expect(tickReleased(true, 0)).toBe(false)
  })

  test('R2.3: the furniture goes idle once faded out in Galaxy, so a frame there does no work', () => {
    // An opacity within the epsilon snaps onto its target, so a fade-out really reaches 0.
    expect(easeToward(0.002, 0, 0.1)).toBe(0)
    expect(easeToward(0.5, 0, 0.5)).toBeCloseTo(0.25)
    expect(easeToward(0, 0.4, 1)).toBeCloseTo(0.4)
    let alpha = TICK_LABEL_OPACITY
    let frames = 0
    while (alpha !== 0 && frames < 1000) {
      alpha = easeToward(alpha, 0, 0.1)
      frames++
    }
    expect(alpha).toBe(0)
    expect(frames).toBeLessThan(100)
    // Idle only with no blend, no tick left and every lane at 0.
    expect(furnitureIdle(0, 0, [{ alpha: 0 }, { alpha: 0 }])).toBe(true)
    expect(furnitureIdle(0, 0, [])).toBe(true)
    expect(furnitureIdle(0.001, 0, [{ alpha: 0 }])).toBe(false)
    expect(furnitureIdle(0, 1, [{ alpha: 0 }])).toBe(false)
    expect(furnitureIdle(0, 0, [{ alpha: 0 }, { alpha: 0.2 }])).toBe(false)
  })

  test('R2.8: nothing of the Timeline drawing is left behind: disposal exists beside the lanes and runs on every redraw', () => {
    // A source-text check (the drawing needs a browser): drawGalaxy disposes the lanes AND the ticks; the orchestrator's QA covers the scene.
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    const draw = map.slice(map.indexOf('function drawGalaxy('), map.indexOf('function growGalaxy('))
    expect(draw).toContain('disposeLanes()')
    expect(draw).toContain('disposeTicks()')
    const dispose = map.slice(map.indexOf('function disposeTicks()'), map.indexOf('function updateFurniture('))
    expect(dispose).toContain('tickItems.clear()')
  })
})

// ---- QAMAP R1: what the real-browser QA found on the map (138 memories, ages up to 300 days) ----

describe('QAMAP: timeline ticks, lane labels, moons, drag and strings, with the QA numbers', () => {
  // A tick label's width in world units: SpriteText letters are about 0.55 of the label height wide.
  const widthOf = (text: string) => text.length * TICK_LABEL_HEIGHT * 0.55
  const overlaps = (list: { x: number; label: string }[]) => {
    const sorted = [...list].sort((a, b) => a.x - b.x)
    return sorted.slice(1).filter((tick, i) => tick.x - sorted[i]!.x < (widthOf(tick.label) + widthOf(sorted[i]!.label)) / 2)
  }

  test('QAMAP.1: tickStep is 1 for 7 days and 7 for 30 (the plan), and grows round with the range', () => {
    expect(tickStep(7)).toBe(1)
    expect(tickStep(30)).toBe(7)
    expect(tickStep(90)).toBe(14)
    expect(tickStep(302)).toBe(30)
    expect(tickStep(1000)).toBe(90)
    expect(tickStep(3000)).toBe(365)
    // The axis width is a parameter: a narrower axis takes a larger step.
    expect(tickStep(30, 200)).toBe(14)
  })

  test('QAMAP.1: for ranges 7, 30, 90, 300 and All = oldest + 2 days, no two tick labels touch and there are at most 12', () => {
    for (const [range, days] of [[7, 7], [30, 30], ['all', 90], ['all', 300], ['all', rangeDays('all', 300)], ['all', rangeDays('all', 12)], ['all', rangeDays('all', 0)], ['all', 1500]] as const) {
      const list = rangeTicks(range, days)
      expect(list.length).toBeLessThanOrEqual(12)
      expect(overlaps(list)).toEqual([])
      // Neighbours are never closer than the minimum spacing (the plan's 7 and 30 day rules are looser than it, so only All is held to it).
      if (range === 'all') {
        const xs = list.map(tick => tick.x).sort((a, b) => a - b)
        for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(TICK_MIN_SPACING - 1e-9)
      }
    }
  })

  test('QAMAP.1: All with the oldest memory 300 days old: round steps, short labels, and the oldest edge says the range', () => {
    const days = rangeDays('all', 300)
    expect(days).toBe(302)
    const list = rangeTicks('all', days)
    expect(list.map(tick => tick.days)).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 302])
    expect(list.map(tick => tick.label)).toEqual(['today', '30d', '2mo', '3mo', '4mo', '5mo', '6mo', '7mo', '8mo', '9mo', '302d'])
    expect(list[0]!.x).toBe(TIMELINE_TODAY_X)
    expect(list.at(-1)!.x).toBeCloseTo(TIMELINE_TODAY_X - TIMELINE_DAYS_X, 9)
    // The 7 and 30 day ranges are unchanged.
    expect(rangeTicks(7, 7).map(tick => tick.label)).toEqual(['today', '1 day ago', '2 days ago', '3 days ago', '4 days ago', '5 days ago', '6 days ago', '7 days ago'])
    expect(rangeTicks(30, 30).map(tick => tick.days)).toEqual([0, 7, 14, 21, 28])
  })

  test('QAMAP.2: each project label sits on its own lane, never nearer another lane than its own (2, 3 and 4 lanes, and 10)', () => {
    for (const lanes of [1, 2, 3, 4, 10]) {
      const lift = coreLabelOffset(60, lanes, 1)
      expect(lift).toBeCloseTo(laneLabelLift(lanes), 9)
      expect(lift).toBeGreaterThan(0)
      expect(lift).toBeLessThanOrEqual(LANE_LABEL_LIFT)
      for (let lane = 0; lane < lanes; lane++) {
        const labelY = laneY(lane, lanes) + lift
        const own = Math.abs(labelY - laneY(lane, lanes))
        for (let other = 0; other < lanes; other++) {
          if (other !== lane) expect(Math.abs(labelY - laneY(other, lanes))).toBeGreaterThan(own * 1.4)
        }
      }
    }
    // The Galaxy offset (the core's radius, 60 here) was the old Timeline offset: with 4 lanes (80 apart) it put the label nearer the lane above.
    expect(60).toBeGreaterThan(80 / 2)
    // In Galaxy the label keeps its offset; between the two layouts it moves with the blend.
    expect(coreLabelOffset(60, 4, 0)).toBe(60)
    expect(coreLabelOffset(60, 4, 0.5)).toBeCloseTo((60 + laneLabelLift(4)) / 2)
  })

  test('QAMAP.3a: a moon is picked within its drawn size at the camera it is drawn from (zoomed in, zoomed out)', () => {
    // 620 px tall view, 40 degree camera: at the flight distance 170 a 6.5 glow is about 24 px across; zoomed in to 50 it is about 80 px.
    const far = pixelsPerUnit(620, 40, 170)
    const near = pixelsPerUnit(620, 40, 50)
    expect(far).toBeCloseTo(5.0, 1)
    expect(near).toBeGreaterThan(far * 3)
    expect(moonPickRadius(6.5, 1)).toBe(MOON_PICK_RADIUS)
    expect(moonPickRadius(6.5, far)).toBeCloseTo((6.5 * far) / 2, 9)
    expect(moonPickRadius(6.5, near)).toBeCloseTo((6.5 * near) / 2, 9)
    expect(moonPickRadius(6.5, near)).toBeGreaterThan(MOON_PICK_RADIUS * 4)
    // The picked moon at 50 units: a pointer at its drawn edge hits, a pointer 3 radii away does not.
    const radius = moonPickRadius(MOON_SIZE_SELECTED, near)
    const moon: Candidate = { kind: 'moon', id: 'k1', sx: 300, sy: 300, radius, alpha: 0.95 }
    expect(pickNearest([moon], 300 + radius * 0.9, 300)).toMatchObject({ kind: 'moon', id: 'k1' })
    expect(pickNearest([moon], 300 + radius * 3, 300)).toBeNull()
    // A moon orbits under a resting pointer, so a frame re-picks while moons are shown.
    expect(needsHover(false, true, true)).toBe(true)
    expect(needsHover(false, true, false)).toBe(false)
    expect(needsHover(false, false, true)).toBe(false)
    expect(needsHover(true, false, false)).toBe(true)
  })

  test('QAMAP.3b: a moon label keeps one size on screen when zoomed in, and neighbours take different rows', () => {
    expect(moonLabelScale(MOON_LABEL_REF)).toBe(1)
    expect(moonLabelScale(900)).toBe(1)
    expect(moonLabelScale(50)).toBeCloseTo(50 / MOON_LABEL_REF, 9)
    expect(moonLabelScale(1)).toBe(0.25)
    // Its size on screen (world size times scale over distance) is the same from 170 down to 43.
    const onScreen = (distance: number) => moonLabelScale(distance) / distance
    expect(onScreen(60)).toBeCloseTo(onScreen(170), 9)
    expect(onScreen(43)).toBeCloseTo(onScreen(170), 9)
    // Rows: neighbours differ, in the 8-moon ring and the 7-moon ring (where the last meets the first).
    for (const n of [2, 3, 5, 7, 8]) {
      for (let i = 0; i < n; i++) expect(moonLabelRow(i, n)).not.toBe(moonLabelRow((i + 1) % n, n))
    }
    // Two rows are a label height apart at every scale, so labels of neighbours never share height.
    for (const k of [0.25, 0.5, 1]) {
      const lift0 = moonLabelLift(0, 8, k)
      const lift1 = moonLabelLift(1, 8, k)
      expect(lift0).toBe(MOON_LABEL_GAP)
      expect(lift1 - lift0).toBeGreaterThan(4.4 * k)
      expect(lift1 - lift0).toBeCloseTo(MOON_LABEL_ROW * k, 9)
    }
  })

  test('QAMAP.3c: moons, their lines and labels are drawn after everything else', () => {
    expect(MOON_RENDER_ORDER.line).toBeGreaterThan(0)
    expect(MOON_RENDER_ORDER.sprite).toBeGreaterThan(MOON_RENDER_ORDER.line)
    expect(MOON_RENDER_ORDER.label).toBeGreaterThan(MOON_RENDER_ORDER.sprite)
  })

  test('QAMAP.4: only a quick, still press is a click: a long hold or a move over 3 px is a drag, even back on the same pixel', () => {
    expect(CLICK_MAX_MOVE).toBe(3)
    expect(CLICK_MAX_HELD_MS).toBe(250)
    expect(isClick({ x: 50, y: 50, t: 1000 }, { x: 50, y: 50, t: 1120 })).toBe(true)
    expect(isClick({ x: 50, y: 50, t: 1000 }, { x: 52, y: 51, t: 1200 })).toBe(true)
    // Pointer down and up on the same pixel after a drag: held 900 ms.
    expect(isClick({ x: 50, y: 50, t: 1000 }, { x: 50, y: 50, t: 1900 })).toBe(false)
    expect(isClick({ x: 50, y: 50, t: 1000 }, { x: 50, y: 50, t: 1000 + CLICK_MAX_HELD_MS + 1 })).toBe(false)
    expect(isClick({ x: 50, y: 50, t: 1000 }, { x: 54, y: 50, t: 1100 })).toBe(false)
  })

  test('QAMAP.5: the strip, the Live pill and the dim note say what they do', () => {
    expect(STRIP_EMPTY_TEXT).toBe('No new activity since you opened this page.')
    expect(LIVE_PILL_TITLE).toBe('Press to switch live updates on or off')
    const none = initialState({ reducedMotion: false })
    expect(dimNote(none)).toBeNull()
    const facts = toggleKind(none, 'fact')
    expect(dimNote(facts)).toBe('Dimmed by: Facts. Click to clear.')
    expect(dimNote(toggleKind(toggleKind(facts, 'relation'), 'preference'))).toBe('Dimmed by: Preferences, Relations. Click to clear.'.replace('Preferences, Relations', 'Facts, Preferences, Relations'))
    expect(clearKinds(facts).kinds.size).toBe(0)
    expect(dimNote(clearKinds(facts))).toBeNull()
    expect(clearKinds(none)).toBe(none)
  })

  // QAMAP R2: the second browser QA's polish items.
  test('QAMAP.R2.1: the Claude core has a tooltip in plain words and no click hint', () => {
    const none = tooltip(null as unknown as Galaxy, { kind: 'claude', id: '', sx: 702, sy: 425 })
    expect(none).toEqual(CLAUDE_TOOLTIP)
    expect(none!.title).toBe('Claude')
    expect(none!.sub).toBe('Recalls start here — gold sparks fly from this core to the memories a recall finds')
    expect(none!.sub).not.toContain('Click')
    // At the 22 px core pick radius: the cursor on the Claude core at (702, 425) picks it.
    const hit = pickNearest([{ kind: 'claude', id: '', sx: 702, sy: 425, radius: PICK_RADIUS.claude, alpha: 1 }], 710, 430)
    expect(hit?.kind).toBe('claude')
  })

  test('QAMAP.R2.2: the Claude label and a project label at the same spot end up apart; labels that do not touch stay', () => {
    // The QA at 1440x900: the Claude label (about 46x18 px) and the borealis label (about 62x18 px) printed on each other.
    const claude = { x: 677, y: 399, w: 46, h: 18, rank: 3 }
    const borealis = { x: 690, y: 397, w: 62, h: 18, rank: 2 }
    const [c, b] = separateLabels([borealis, claude]).reverse() as [typeof claude, typeof borealis]
    // The Claude label keeps its place; the project label (its middle 2 px above Claude's) moves up, clear of it with the 2 px gap.
    expect(c).toEqual(claude)
    expect(b.x).toBe(borealis.x)
    expect(b.y).toBe(claude.y - borealis.h - LABEL_GAP)
    // Its middle below Claude's: it moves down instead.
    expect(separateLabels([claude, { ...borealis, y: 403 }])[1]!.y).toBe(claude.y + claude.h + LABEL_GAP)
    const clear = b.y >= c.y + c.h || c.y >= b.y + b.h
    expect(clear).toBe(true)
    // A topic label under a project label under Claude: all three apart, in rank order, the same every time.
    const topic = { x: 680, y: 405, w: 50, h: 18, rank: 1 }
    const three = separateLabels([topic, borealis, claude])
    const again = separateLabels([topic, borealis, claude])
    expect(three).toEqual(again)
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]] as const) {
      const a = three[i]!
      const z = three[j]!
      expect(a.x < z.x + z.w && z.x < a.x + a.w && a.y < z.y + z.h && z.y < a.y + a.h).toBe(false)
    }
    // Labels far apart do not move, and nothing in the input is changed.
    const far = [{ x: 100, y: 100, w: 40, h: 18, rank: 1 }, { x: 500, y: 300, w: 40, h: 18, rank: 2 }, { x: 100, y: 130, w: 40, h: 18, rank: 1 }]
    expect(separateLabels(far)).toEqual(far)
    expect(borealis.y).toBe(397)
  })

  test('QAMAP.R2.3: Reset view clears the Knowledge chips along with focus and Find, and Clear leaves the rest alone', () => {
    const base = initialState({ reducedMotion: false })
    const picked = toggleKind(toggleKind(base, 'fact'), 'preference')
    const reset = resetView({ ...picked, query: 'tabs' })
    expect(reset.kinds.size).toBe(0)
    expect(reset.query).toBe('')
    expect(dimNote(reset)).toBeNull()
    // Nothing chosen: the very same kinds set, no needless change.
    expect(resetView(base).kinds).toBe(base.kinds)
    // The All crumb is Reset view too.
    expect(goTo(picked, 'all').kinds.size).toBe(0)
    // Clear keeps the layout and range.
    const timeline = { ...picked, layout: 'timeline' as const }
    expect(clearKinds(timeline).layout).toBe('timeline')
    expect(clearKinds(timeline).kinds.size).toBe(0)
  })

  test('QAMAP.R2.4: the links are gone in the first 30% of the glide, so no streaks trail the stars', () => {
    expect(LINK_FADE_SPAN).toBe(0.3)
    expect(linkFadeAt(0)).toBe(1)
    expect(linkFadeAt(0.15)).toBeCloseTo(0.5, 5)
    expect(linkFadeAt(LINK_FADE_SPAN)).toBe(0)
    expect(linkFadeAt(1)).toBe(0)
    // On the real glide curve the fade never rises while the morph advances, and is out before it ends.
    const along = [0, 0.1, 0.2, 0.3, 0.5, 0.8, 1].map(weight => linkFadeAt(morphBlend(weight)))
    for (let i = 1; i < along.length; i++) expect(along[i]!).toBeLessThanOrEqual(along[i - 1]!)
    expect(along[along.length - 1]).toBe(0)
    expect(linkFadeAt(morphBlend(0.5))).toBe(0)
    // Faster than the old fade, which tracked the positions.
    for (const blend of [0.1, 0.2, 0.25]) expect(linkFadeAt(blend)).toBeLessThan(galaxyOnlyFade(blend))
  })
})


// ---- GLOW: a softer bloom, and a Glow control (Off, Soft, Full) ----

describe('GLOW: the bloom levels and the Glow control', () => {
  test('soft is the default, glows less than full, and only the brightest things bloom', () => {
    const soft = bloomFor('soft')
    const full = bloomFor('full')
    expect(glowLevel(null)).toBe('soft')
    expect(glowLevel(undefined)).toBe('soft')
    expect(glowLevel('garbage')).toBe('soft')
    expect(glowLevel('')).toBe('soft')
    expect(glowLevel('off')).toBe('off')
    expect(glowLevel('full')).toBe('full')
    expect(soft.enabled).toBe(true)
    expect(soft.strength).toBeLessThan(full.strength)
    expect(soft.radius).toBeLessThan(full.radius)
    // A higher threshold means fewer pixels bloom: ordinary stars no longer glow.
    expect(soft.threshold).toBeGreaterThan(full.threshold)
    expect(soft).toEqual({ enabled: true, ...BLOOM_SOFT })
  })

  test('full is exactly the 0.6.0 glow, and off switches the pass off', () => {
    expect(bloomFor('full')).toEqual({ enabled: true, strength: 0.95, radius: 0.55, threshold: 0.12 })
    expect(bloomFor('off').enabled).toBe(false)
  })

  test('the level is read and saved through storage, and a throwing storage is ignored', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
    expect(readGlow(storage)).toBeNull()
    saveGlow(storage, 'off')
    expect(data.get(GLOW_KEY)).toBe('off')
    expect(glowLevel(readGlow(storage))).toBe('off')
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(readGlow(throwing)).toBeNull()
    expect(() => saveGlow(throwing, 'full')).not.toThrow()
    expect(readGlow(undefined)).toBeNull()
  })

  test('createMap builds the Glow control after the Colour card: soft is pressed, a click saves the level and moves the pressed button', async () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const fake = fakeDom(html)
    const g = globalThis as Record<string, unknown>
    const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement, localStorage: g.localStorage }
    const data = new Map<string, string>()
    g.document = fake.document
    g.HTMLElement = FakeBase
    g.localStorage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
    ;(globalThis as Record<string, unknown>).CSS = { escape: (v: string) => v }
    const added: FakeNode[] = []
    const section = new FakeNode('section')
    ;(section as unknown as { after: (node: FakeNode) => void }).after = node => void added.push(node)
    ;(fake.nodes.get('map-colour') as unknown as { closest: () => FakeNode }).closest = () => section
    try {
      const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => unknown }
      createMap({ api: async () => new Response(JSON.stringify({ projects: [], memories: [], knowledge: [], meaning: false, total: 0, shown: 0 }), { status: 200 }), openMemory: () => {}, status: () => {} })
      await Bun.sleep(30)
      expect(added.length).toBe(1)
      const buttons = added[0]!.all().filter(n => n.tagName === 'button')
      expect(buttons.map(b => b.textContent)).toEqual(['Off', 'Soft', 'Full'])
      const pressed = () => buttons.filter(b => b.attributes.get('aria-pressed') === 'true').map(b => b.dataset.glow)
      expect(pressed()).toEqual(['soft'])
      buttons[0]!.fire('click')
      expect(data.get(GLOW_KEY)).toBe('off')
      expect(pressed()).toEqual(['off'])
      buttons[2]!.fire('click')
      expect(data.get(GLOW_KEY)).toBe('full')
      expect(pressed()).toEqual(['full'])
    } finally {
      g.document = saved.document
      g.CSS = saved.CSS
      g.HTMLElement = saved.HTMLElement
      g.localStorage = saved.localStorage
    }
  })
})


// ---- SEM: the Meaning layout, similar-memory links, the inspector list, and Meaning off cleanly ----
//
// The reply is the 0.6.1 /api/galaxy field set (projects, memories with id/owner/tags/recalls/lastRecalled/created/label,
// knowledge, meaning, total, shown) plus SEMX's contract: per memory with a vector `position` [x, y, z] and `similar`
// [{ id, score }] (top 3, cosine at least 0.65); memories without a vector have neither. Everything goes through the
// production path parseGalaxy -> buildGalaxy -> the layout functions; only the network edge is faked.

describe('SEM: Meaning layout, similar links, inspector list', () => {
  const NOW = Date.parse('2026-10-23T12:00:00Z')
  const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()
  const ALPHA = 'project-alpha-1a2b'
  const BETA = 'project-beta-3c4d'
  type Raw = Record<string, unknown>
  const row = (id: string, owner: string, tag: string | null, age: number, extra: Raw = {}): Raw => ({ id, owner, tags: tag === null ? [] : [tag], recalls: 1, lastRecalled: daysAgo(1), created: daysAgo(age), label: `memory ${id}`, ...extra })
  const near = (at: [number, number, number], d: number): [number, number, number] => [at[0] + d, at[1] + d / 2, at[2] - d]
  const ROUTING: [number, number, number] = [200, 10, 0]
  const DEPLOY: [number, number, number] = [-100, 100, -150]
  const REVIEW: [number, number, number] = [-100, -100, 150]
  // Three clusters of stars across projects, with positions and neighbours; two memories without a vector; one lone tagged star.
  const memories = (): Raw[] => [
    row('r1', ALPHA, 'routing', 1, { position: near(ROUTING, 0), similar: [{ id: 'r2', score: 0.88 }, { id: 'r3', score: 0.85 }, { id: 'd1', score: 0.66 }] }),
    row('r2', BETA, 'routing', 2, { position: near(ROUTING, 6), similar: [{ id: 'r1', score: 0.88 }, { id: 'r3', score: 0.8 }] }),
    row('r3', BETA, 'routing', 40, { position: near(ROUTING, -6), similar: [{ id: 'r1', score: 0.85 }] }),
    row('d1', ALPHA, 'deploy', 3, { position: near(DEPLOY, 0), similar: [{ id: 'd2', score: 0.9 }, { id: 'd3', score: 0.8 }] }),
    row('d2', ALPHA, 'deploy', 4, { position: near(DEPLOY, 8), similar: [{ id: 'd1', score: 0.9 }] }),
    row('d3', 'global', 'deploy', 5, { position: near(DEPLOY, -8), similar: [{ id: 'd1', score: 0.8 }] }),
    row('v1', BETA, 'review', 6, { position: near(REVIEW, 0), similar: [{ id: 'v2', score: 0.77 }] }),
    row('v2', ALPHA, 'review', 7, { position: near(REVIEW, 5), similar: [{ id: 'v1', score: 0.77 }] }),
    row('solo', BETA, 'solo', 8, { position: [0, 300, 0], similar: [] }),
    row('n1', ALPHA, 'routing', 9),
    row('n2', BETA, null, 10),
  ]
  const raw = (extra: Raw = {}, rows: Raw[] = memories()): Raw => ({
    projects: [
      { owner: ALPHA, label: 'alpha', count: rows.filter(r => r.owner === ALPHA).length, recalls: 5 },
      { owner: BETA, label: 'beta', count: rows.filter(r => r.owner === BETA).length, recalls: 5 },
      { owner: 'global', label: 'Global', count: rows.filter(r => r.owner === 'global').length, recalls: 1 },
    ],
    memories: rows,
    knowledge: [],
    meaning: true,
    total: rows.length,
    shown: rows.length,
    ...extra,
  })
  const make = (body: Raw = raw()): Galaxy => buildGalaxy(parseGalaxy(body)!, NOW)
  const state = (layout: 'galaxy' | 'meaning' | 'timeline' = 'galaxy') => setLayout(initialState({ reducedMotion: false }), layout, true)
  const idx = (g: Galaxy, id: string) => slotOf(g.layout.starById, id)
  const at = (g: Galaxy, id: string): Vec3 => g.meaningAt.get(id)!

  test('SEM.1.a1: parseGalaxy keeps position and similar only for memories that carry a vector, and nothing at all when the reply says meaning: false', () => {
    const g = make()
    expect([...g.meaningAt.keys()].sort()).toEqual(['d1', 'd2', 'd3', 'r1', 'r2', 'r3', 'solo', 'v1', 'v2'])
    expect(g.meaning).toBe(true)
    expect(at(g, 'r2')).toEqual(near(ROUTING, 6))
    expect(g.similar.get('r1')).toEqual([{ id: 'r2', score: 0.88 }, { id: 'r3', score: 0.85 }, { id: 'd1', score: 0.66 }])
    expect(g.meaningAt.has('n1')).toBe(false)
    expect(g.similar.has('n1')).toBe(false)
    // meaning: false (0.6.x, no vectors): whatever the rows carry is not read.
    const off = make(raw({ meaning: false }))
    expect(off.meaning).toBe(false)
    expect(off.meaningAt.size).toBe(0)
    expect(off.similar.size).toBe(0)
    // A bad position (not three finite numbers) drops the vector; similar keeps three well-formed neighbours, scores between 0 and 1.
    const messy = make(
      raw(
        {},
        [
          row('a', ALPHA, 't', 1, { position: [1, 2], similar: [{ id: 'b', score: 0.9 }] }),
          row('b', ALPHA, 't', 1, { position: [1, Number.NaN, 3] }),
          row('c', ALPHA, 't', 1, { position: [1, 2, 3], similar: [{ id: 'a', score: 1.4 }, { id: '', score: 0.7 }, { id: 'a' }, null, { id: 'b', score: -2 }, { id: 'x', score: 0.7 }, { id: 'y', score: 0.7 }, { id: 'z', score: 0.7 }] }),
          row('d', ALPHA, 't', 1, { position: 'north', similar: 7 }),
          row('e', ALPHA, 't', 1, { position: [4, 5, 6], similar: 'none' }),
        ],
      ),
    )
    expect([...messy.meaningAt.keys()]).toEqual(['c', 'e'])
    expect(messy.similar.get('c')).toEqual([{ id: 'a', score: 1 }, { id: 'b', score: 0 }, { id: 'x', score: 0.7 }])
    expect(messy.similar.get('e')).toEqual([])
  })

  test('SEM.1.a1: every star moves to its position: the target of an embedded star is its position, the Meaning morph runs 1.4 s like Timeline, and Galaxy and Timeline are untouched', () => {
    const g = make()
    const places = meaningPlaces(g)
    for (const id of ['r1', 'd2', 'v1', 'solo']) expect(places.stars[idx(g, id)]).toEqual(at(g, id))
    // Same stars, same slots as the layout's own order.
    expect(places.stars).toHaveLength(g.layout.stars.length)
    // The morph weight: 0 outside Meaning, 1 in it; stepped by Timeline's own stepMorph over 1.4 s, none under reduced motion.
    expect(meaningTarget('meaning')).toBe(1)
    expect(meaningTarget('galaxy')).toBe(0)
    expect(meaningTarget('timeline')).toBe(0)
    expect(meaningStep(0, 'meaning', 0.7, false)).toBeCloseTo(0.5)
    expect(meaningStep(0, 'meaning', 1.4, false)).toBe(1)
    expect(meaningStep(0, 'meaning', 0.016, true)).toBe(1)
    expect(meaningStep(1, 'galaxy', 0.7, false)).toBeCloseTo(0.5)
    expect(meaningStep(1, 'timeline', 5, false)).toBe(0)
    expect(meaningStep(0.3, 'meaning', 0.35, false)).toBeCloseTo(stepMorph(0.3, 1, 0.35, morphSeconds(false)))
    let w = 0
    let seconds = 0
    while (w < 1 && seconds < 5) {
      w = meaningStep(w, 'meaning', 1 / 60, false)
      seconds += 1 / 60
    }
    expect(seconds).toBeGreaterThan(1.39)
    expect(seconds).toBeLessThan(1.42)
    // The three layouts' weights always add up to 1 and a pure layout takes it all.
    expect(layoutWeights(0, 0)).toEqual({ galaxy: 1, meaning: 0, timeline: 0 })
    expect(layoutWeights(0, 1)).toEqual({ galaxy: 0, meaning: 1, timeline: 0 })
    expect(layoutWeights(1, 0)).toEqual({ galaxy: 0, meaning: 0, timeline: 1 })
    for (const [t, m] of [[0.2, 0.3], [0.5, 0.5], [0.9, 0.8], [1, 1], [0, 0.4], [0.7, 0]]) {
      const x = layoutWeights(t!, m!)
      expect(x.galaxy + x.meaning + x.timeline).toBeCloseTo(1)
    }
    // A place at weight 1 is the layout's own; between them it is the blend; a place a visual lacks stays home.
    const home: Vec3 = [10, 20, 30]
    const target = at(g, 'r1')
    expect(layoutPlace(home, target, null, layoutWeights(0, 1))).toEqual(target)
    expect(layoutPlace(home, target, null, layoutWeights(0, 0))).toEqual(home)
    expect(layoutPlace(home, null, null, layoutWeights(0, 1))).toEqual(home)
    const timelineAt: Vec3 = [-280, 5, 0]
    expect(layoutPlace(home, target, timelineAt, layoutWeights(1, 0))).toEqual(timelineAt)
    const half = layoutPlace(home, target, timelineAt, { galaxy: 0, meaning: 0.5, timeline: 0.5 })
    expect(half[0]).toBeCloseTo((target[0] + timelineAt[0]) / 2)
    // Only stars have a Meaning place; cores, hubs and the Claude core stay where they are.
    expect(meaningAway(places, 'star', idx(g, 'r1'))).toEqual(at(g, 'r1'))
    for (const kind of ['core', 'hub', 'claude', 'cluster'] as const) expect(meaningAway(places, kind, 0)).toBeUndefined()
  })

  test('SEM.1.a1: project colours stay; cores, hubs, threads and bridges fade out; a cluster label fades in', () => {
    const g = make()
    const meaningState = state('meaning')
    const colours = [ALPHA, BETA, 'global'].map(owner => projectColour(g, owner))
    expect(new Set(colours).size).toBe(3)
    for (const id of ['r1', 'r2', 'd3']) expect(starColour(g, idx(g, id), 'project')).toBe(projectColour(g, g.layout.stars[idx(g, id)]!.owner))
    expect(meaningState.colourBy).toBe('project')
    const inMeaning = layoutWeights(0, 1)
    const inGalaxy = layoutWeights(0, 0)
    expect(visualFade('core', inMeaning.galaxy, inMeaning.meaning)).toBe(0)
    expect(visualFade('core', inGalaxy.galaxy, inGalaxy.meaning)).toBe(1)
    expect(visualFade('core', 1, 0.25)).toBeCloseTo(0.75)
    expect(visualFade('hub', inMeaning.galaxy, inMeaning.meaning)).toBe(0)
    expect(visualFade('hub', inGalaxy.galaxy, inGalaxy.meaning)).toBe(1)
    expect(visualFade('cluster', inMeaning.galaxy, inMeaning.meaning)).toBe(1)
    expect(visualFade('cluster', inGalaxy.galaxy, inGalaxy.meaning)).toBe(0)
    expect(visualFade('star', 0, 1)).toBe(1)
    expect(visualFade('claude', 0, 1)).toBe(1)
    // Threads and bridges leave in the first 30% of the morph, with the hubs.
    expect(linkFadeAt(1 - inMeaning.galaxy)).toBe(0)
    expect(linkFadeAt(1 - inGalaxy.galaxy)).toBe(1)
    expect(linkFadeAt(1 - layoutWeights(0, 0.5).galaxy)).toBe(0)
  })

  test('SEM.1.a1: a focused project dims the others only lightly in Meaning: 0.14 + 0.6 x the meaning weight', () => {
    expect(projectDim(0)).toBeCloseTo(0.14)
    expect(projectDim(1)).toBeCloseTo(0.74)
    expect(projectDim(0.5)).toBeCloseTo(0.44)
    expect(projectDim(2)).toBeCloseTo(0.74)
    expect(projectDim(-1)).toBeCloseTo(0.14)
    const g = make()
    const focused = (layout: 'galaxy' | 'meaning' | 'timeline') => focusProject(state(layout), ALPHA)
    const other = idx(g, 'r2')
    const own = idx(g, 'r1')
    const galaxyOther = starTarget(g, other, focused('galaxy'), null)
    const meaningOther = starTarget(g, other, focused('meaning'), null)
    const timelineOther = starTarget(g, other, focused('timeline'), null)
    const plain = starTarget(g, other, state('galaxy'), null)
    expect(galaxyOther).toBeCloseTo(plain * 0.14)
    expect(meaningOther).toBeCloseTo(plain * 0.74)
    expect(timelineOther).toBeCloseTo(plain * 0.14)
    // The focused project's own stars keep their brightness in every layout.
    expect(starTarget(g, own, focused('meaning'), null)).toBeCloseTo(starTarget(g, own, state('meaning'), null))
  })

  test('SEM.1.a1: one label per cluster, at the middle of its stars across projects; no label for Untagged or a lone star; at most 24', () => {
    const g = make()
    const clusters = meaningClusters(g)
    expect(clusters.map(c => [c.name, c.count])).toEqual([['deploy', 3], ['routing', 3], ['review', 2]])
    const routing = clusters.find(c => c.name === 'routing')!
    // r1, r2, r3 only: n1 is tagged routing but has no vector, so it is not at the centre.
    const ids = ['r1', 'r2', 'r3']
    for (let i = 0; i < 3; i++) expect(routing.centre[i]).toBeCloseTo(ids.reduce((a, id) => a + at(g, id)[i]!, 0) / 3)
    // The deploy cluster spans two projects and global: one label, not three.
    expect(clusters.filter(c => c.name === 'deploy')).toHaveLength(1)
    expect(CLUSTER_MIN).toBe(2)
    expect(clusters.some(c => c.name === 'solo' || c.name.toLowerCase() === 'untagged')).toBe(false)
    // A forgotten star leaves its cluster; a cluster down to one star loses its label.
    const forgotten = make()
    forgetMemory(forgotten, 'v2')
    expect(meaningClusters(forgotten).some(c => c.name === 'review')).toBe(false)
    // No Meaning, no clusters.
    expect(meaningClusters(make(raw({ meaning: false })))).toEqual([])
    // 30 clusters of two (three of them of three): the 24 biggest, the rest dropped, in a fixed order.
    const rows: Raw[] = []
    for (let c = 0; c < 30; c++) for (let k = 0; k < 2 + (c < 3 ? 1 : 0); k++) rows.push(row(`c${c}-${k}`, ALPHA, `t${String(c).padStart(2, '0')}`, 1, { position: [c * 10, k, 0], similar: [] }))
    const many = meaningClusters(make(raw({}, rows)))
    expect(many).toHaveLength(CLUSTER_LABEL_LIMIT)
    expect(many.slice(0, 3).every(c => c.count === 3)).toBe(true)
    expect(many.map(c => c.name)).toEqual(meaningClusters(make(raw({}, rows))).map(c => c.name))
  })

  test('SEM.1.a4: stars without a vector sit on a "Not embedded" ring at the edge of the Meaning layout, evenly spaced, with a count', () => {
    const g = make()
    const places = meaningPlaces(g)
    expect(places.ring.ids).toEqual(['n1', 'n2'])
    expect(notEmbeddedIds(g)).toEqual(['n1', 'n2'])
    const reach = Math.max(...[...g.meaningAt.values()].map(p => Math.hypot(p[0], p[2])))
    expect(places.ring.radius).toBeCloseTo(Math.max(NOT_EMBEDDED_MIN_RADIUS, reach * NOT_EMBEDDED_RING_FACTOR))
    // The ring lies outside every embedded star.
    expect(places.ring.radius).toBeGreaterThan(reach)
    const ring = places.ring.ids.map(id => places.stars[idx(g, id)]!)
    for (const p of ring) {
      expect(Math.hypot(p[0], p[2])).toBeCloseTo(places.ring.radius)
      expect(p[1]).toBe(0)
    }
    // Two stars: opposite each other (spaced 2π/2); the first at the top (x 0, z -radius).
    expect(ring[0]![0]).toBeCloseTo(0)
    expect(ring[0]![2]).toBeCloseTo(-places.ring.radius)
    expect(ring[1]![2]).toBeCloseTo(places.ring.radius)
    expect(ringLabel(2)).toBe(`${NOT_EMBEDDED_LABEL} · 2`)
    expect(ringLabel(1)).toBe('Not embedded · 1')
    expect(places.ring.labelAt[2]).toBeCloseTo(places.ring.radius)
    // Four stars: a quarter turn apart.
    const four = make(raw({}, [...memories(), row('n3', ALPHA, null, 11), row('n4', BETA, null, 12)]))
    const fourPlaces = meaningPlaces(four)
    const quarter = fourPlaces.ring.ids.map(id => fourPlaces.stars[idx(four, id)]!)
    expect(quarter).toHaveLength(4)
    for (let i = 0; i < 4; i++) {
      const a = quarter[i]!
      const b = quarter[(i + 1) % 4]!
      expect(Math.hypot(a[0] - b[0], a[2] - b[2])).toBeCloseTo(fourPlaces.ring.radius * Math.SQRT2)
    }
    // A forgotten one leaves the ring and the count; a new memory (it has no vector) joins it.
    const live = make()
    forgetMemory(live, 'n1')
    expect(notEmbeddedIds(live)).toEqual(['n2'])
    addMemory(live, { id: 'new1', owner: ALPHA, tags: [], recalls: 0, lastRecalled: null, created: daysAgo(0), label: 'fresh' })
    expect(notEmbeddedIds(live)).toEqual(['n2', 'new1'])
    expect(meaningPlaces(live).ring.ids).toEqual(['n2', 'new1'])
    // With no vector at all the ring still has a place to stand (the minimum radius).
    const bare = make(raw({}, [row('x', ALPHA, 't', 1), row('y', BETA, 't', 2)]))
    expect(meaningPlaces(bare).ring.radius).toBe(NOT_EMBEDDED_MIN_RADIUS)
    // The Overview in Meaning says how many wait on the ring.
    expect(inspector(g, state('meaning')).hint).toBe(`${MEANING_HINT} 2 memories are not embedded yet, on the outer ring.`)
    expect(inspector(make(raw({}, memories().slice(0, 9))), state('meaning')).hint).toBe(MEANING_HINT)
    expect(inspector(g, state('galaxy')).hint).toBe('Every star is one memory. Click a project core to fly in.')
  })

  test('SEM.1.a2: the Similar memories toggle: in Meaning every star links to its neighbours (a pair once); in Galaxy and Timeline only the selected star', () => {
    const g = make()
    const days = timelineDays(g, 'all')
    const key = (p: { from: string; to: string }) => [p.from, p.to].sort().join('-')
    const inMeaning = similarPairs(g, state('meaning'), days)
    // Two links per star (the third, r1-d1 at 0.66, is the selected star's alone), each pair once.
    expect(SIMILAR_PER_STAR).toBe(2)
    expect(inMeaning.map(key).sort()).toEqual(['d1-d2', 'd1-d3', 'r1-r2', 'r1-r3', 'r2-r3', 'v1-v2'])
    expect(new Set(inMeaning.map(key)).size).toBe(inMeaning.length)
    expect(inMeaning.find(p => key(p) === 'r1-r2')!.score).toBe(0.88)
    // Galaxy with nothing selected: no links; with a star selected: all of its (up to 3) links.
    expect(similarPairs(g, state('galaxy'), days)).toEqual([])
    const picked = selectStar(state('galaxy'), g, 'r1')
    expect(similarPairs(g, picked, days).map(key).sort()).toEqual(['d1-r1', 'r1-r2', 'r1-r3'])
    expect(similarPairs(g, selectStar(state('galaxy'), g, 'r2'), days).map(key).sort()).toEqual(['r1-r2', 'r2-r3'])
    // A selected star with no vector has no links; in Meaning the selected star adds its third link.
    expect(similarPairs(g, selectStar(state('galaxy'), g, 'n1'), days)).toEqual([])
    expect(similarPairs(g, selectStar(state('meaning'), g, 'r1'), days).map(key).sort()).toEqual(['d1-r1', ...inMeaning.map(key)].sort())
    // Switched off, or no Meaning: nothing.
    expect(similarPairs(g, { ...picked, similar: false }, days)).toEqual([])
    const noMeaning = make(raw({ meaning: false }))
    expect(similarPairs(noMeaning, selectStar(state('galaxy'), noMeaning, 'r1'), days)).toEqual([])
    // A hidden project, a forgotten memory and a neighbour that is not in the reply are not linked.
    expect(similarPairs(g, toggleProject(state('meaning'), BETA), days).map(key).sort()).toEqual(['d1-d2', 'd1-d3'])
    const forgot = make()
    forgetMemory(forgot, 'd1')
    expect(similarPairs(forgot, state('meaning'), days).map(key).sort()).toEqual(['r1-r2', 'r1-r3', 'r2-r3', 'v1-v2'])
    const cut = make(raw({}, memories().filter(m => m.id !== 'r3')))
    expect(similarPairs(cut, state('meaning'), days).map(key).sort()).toEqual(['d1-d2', 'd1-d3', 'r1-r2', 'v1-v2'])
    // Timeline: only the selected star's links, and only to stars on the axis (r3 is 40 days old, off a 7-day axis).
    expect(similarPairs(g, selectStar(state('timeline'), g, 'r1'), 7).map(key).sort()).toEqual(['d1-r1', 'r1-r2'])
    expect(similarPairs(g, selectStar(state('timeline'), g, 'r1'), days).map(key).sort()).toEqual(['d1-r1', 'r1-r2', 'r1-r3'])
    expect(similarPairs(g, state('timeline'), days)).toEqual([])
    // Leaving Meaning the links hold until the weight drops under 0.3, then only the selected star's remain.
    expect(similarPairs(g, state('galaxy'), days, 0.5)).toHaveLength(inMeaning.length)
    expect(similarPairs(g, state('galaxy'), days, SIMILAR_MEANING_MIN)).toEqual([])
    expect(similarPairs(g, picked, days, 0.1)).toHaveLength(3)
  })

  test('SEM.1.a2: the links are faint cyan #7DE3F4, brightest in Meaning, a little brighter with a star selected, and off with the toggle', () => {
    expect(SIMILAR_COLOUR).toBe('#7DE3F4')
    const g = make()
    expect(similarOpacity(state('galaxy'), 0)).toBeCloseTo(0.12)
    expect(similarOpacity(state('meaning'), 1)).toBeCloseTo(0.3)
    expect(similarOpacity(state('meaning'), 0.5)).toBeCloseTo(0.21)
    expect(similarOpacity(selectStar(state('galaxy'), g, 'r1'), 0)).toBeCloseTo(0.22)
    expect(similarOpacity(selectStar(state('meaning'), g, 'r1'), 1)).toBeCloseTo(0.4)
    expect(similarOpacity({ ...state('meaning'), similar: false }, 1)).toBe(0)
    // The toggle flips only where there are vectors; otherwise the state is returned as it is.
    const s = state('galaxy')
    expect(s.similar).toBe(true)
    expect(toggleSimilar(s, true).similar).toBe(false)
    expect(toggleSimilar(toggleSimilar(s, true), true).similar).toBe(true)
    expect(toggleSimilar(s, false)).toBe(s)
  })

  test('SEM.1.a3: the Memory inspector lists the similar memories (label, project, score as a percentage) and the line from embeddings; each item opens that star', () => {
    const g = make()
    const view = inspector(g, selectStar(state('galaxy'), g, 'r1'))
    expect(view.kind).toBe('Memory')
    const similar = view.similar!
    expect(similar.items.map(i => [i.id, i.text, i.project, i.percent, i.score])).toEqual([
      ['r2', 'memory r2', 'beta', 88, '88% similar'],
      ['r3', 'memory r3', 'beta', 85, '85% similar'],
      ['d1', 'memory d1', 'alpha', 66, '66% similar'],
    ])
    expect(similar.note).toBe('From embeddings, made on this machine.')
    expect(SIMILAR_NOTE).toBe('From embeddings, made on this machine.')
    // The item carries the colour of its project and the id the page opens (selectStar is what flyToStar ends in).
    expect(similar.items[0]!.colour).toBe(projectColour(g, BETA))
    const opened = selectStar(selectStar(state('galaxy'), g, 'r1'), g, similar.items[0]!.id)
    expect(opened.selected).toBe('r2')
    expect(inspector(g, opened).title).toBe('routing')
    // A neighbour forgotten since the page loaded is not listed; a rounding of 0.655 is 66.
    const forgot = make()
    forgetMemory(forgot, 'r3')
    expect(inspector(forgot, selectStar(state('galaxy'), forgot, 'r1')).similar!.items.map(i => i.id)).toEqual(['r2', 'd1'])
    const rounded = make(raw({}, [row('p', ALPHA, 't', 1, { position: [1, 1, 1], similar: [{ id: 'q', score: 0.655 }] }), row('q', ALPHA, 't', 1, { position: [2, 2, 2], similar: [] })]))
    expect(inspector(rounded, selectStar(state('galaxy'), rounded, 'p')).similar!.items[0]!.percent).toBe(66)
    // An embedded star with no close neighbour says so.
    expect(inspector(g, selectStar(state('galaxy'), g, 'solo')).similar).toEqual({ note: 'No other memory is close enough in meaning yet.', items: [] })
    // A star with no vector in a galaxy that has Meaning says how to get one.
    const none = inspector(g, selectStar(state('galaxy'), g, 'n1')).similar!
    expect(none.items).toEqual([])
    expect(none.note).toContain('/mnemosyne-embed apply')
    // No Meaning at all: the 0.6.x note, no items.
    const off = make(raw({ meaning: false }))
    expect(inspector(off, selectStar(state('galaxy'), off, 'r1')).similar).toEqual({ note: 'Similar memories need embeddings.', items: [] })
  })

  test('SEM.2.a1 / SEM.2.a2: with meaning: false the Meaning button and the Similar memories toggle are disabled with the hint, and no request or error comes of the missing data', async () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    expect(EMBEDDINGS_HINT).toBe('Turn on embeddings, then run /mnemosyne-embed apply')
    // The static page already says it (before any reply), on the button, the toggle and as a line under the layout buttons.
    expect(html).toContain(`data-layout="meaning" aria-pressed="false" disabled title="${EMBEDDINGS_HINT}"`)
    expect(html).toContain('id="map-meaning-hint"')
    // Builds the Map tab on the page markup, with the document stand-in installed for as long as `use` runs.
    const run = async <T,>(meaning: boolean, use: (page: { calls: string[]; statuses: string[]; node: (id: string) => FakeNode; layout: (name: string) => FakeNode }) => T): Promise<T> => {
      const fake = fakeDom(html)
      const g = globalThis as Record<string, unknown>
      const saved = { document: g.document, CSS: g.CSS, HTMLElement: g.HTMLElement, localStorage: g.localStorage }
      g.document = fake.document
      g.HTMLElement = FakeBase
      g.CSS = { escape: (v: string) => v }
      g.localStorage = { getItem: () => null, setItem: () => {} }
      const calls: string[] = []
      const statuses: string[] = []
      const rows = meaning ? memories() : memories().map(({ position: _position, similar: _similar, ...rest }) => rest)
      try {
        const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => unknown }
        createMap({
          api: async (path: string) => {
            calls.push(path)
            return new Response(JSON.stringify(raw(meaning ? {} : { meaning: false }, rows)), { status: 200 })
          },
          openMemory: () => {},
          status: (text: string) => void statuses.push(text),
        })
        await Bun.sleep(30)
        const node = (id: string) => fake.nodes.get(id)!
        return use({ calls, statuses, node, layout: name => node('map-layout').groups.find(b => b.dataset.layout === name)! })
      } finally {
        g.document = saved.document
        g.CSS = saved.CSS
        g.HTMLElement = saved.HTMLElement
        g.localStorage = saved.localStorage
      }
    }
    await run(false, off => {
      expect(off.calls).toEqual(['/api/galaxy'])
      expect(off.statuses).toEqual([])
      expect(off.layout('meaning').disabled).toBe(true)
      expect(off.layout('meaning').title).toBe(EMBEDDINGS_HINT)
      expect(off.node('map-similar').disabled).toBe(true)
      expect(off.node('map-similar').checked).toBe(false)
      expect(off.node('map-meaning-hint').hidden).toBe(false)
      expect(off.node('map-meaning-hint').textContent).toBe(EMBEDDINGS_HINT)
      // Pressing them does nothing and breaks nothing.
      off.layout('meaning').fire('click')
      expect(off.layout('meaning').attributes.get('aria-pressed')).toBe('false')
      off.node('map-similar').fire('change')
      expect(off.node('map-similar').checked).toBe(false)
      expect(off.statuses).toEqual([])
      expect(off.calls).toEqual(['/api/galaxy'])
    })
    // With vectors both are live, the hint is gone and the toggle is on by default.
    await run(true, on => {
      expect(on.calls).toEqual(['/api/galaxy'])
      expect(on.statuses).toEqual([])
      expect(on.layout('meaning').disabled).toBe(false)
      expect(on.node('map-similar').disabled).toBe(false)
      expect(on.node('map-similar').checked).toBe(true)
      expect(on.node('map-meaning-hint').hidden).toBe(true)
      on.node('map-similar').fire('change')
      expect(on.node('map-similar').checked).toBe(false)
      on.layout('meaning').fire('click')
      expect(on.layout('meaning').attributes.get('aria-pressed')).toBe('true')
      expect(on.statuses).toEqual([])
    })
  })

  test('GUARD (source text, not behaviour): the scene blends the three layouts with the pure helpers, draws the links and labels from them, and never picks a label', () => {
    // The behaviour of every helper below is tested with real values above; this only guards that the scene file still calls them.
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    for (const call of ['layoutWeights(', 'layoutPlace(', 'meaningPlaces(', 'meaningAway(', 'meaningStep(', 'meaningClusters(', 'ringLabel(', 'similarPairs(', 'similarOpacity(', 'toggleSimilar(', 'visualFade(v.kind, galaxyFade, weights.meaning)']) expect(map).toContain(call)
    expect(map).toContain("if (v.kind === 'cluster') continue")
    expect(map).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/)
  })
})
