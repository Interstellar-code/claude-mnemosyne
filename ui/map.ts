// The Map tab: the memory galaxy on 3d-force-graph (plan GAL; the mockup is
// design/MapGalaxy.dc.html). Every memory is a glow sprite pinned at its
// galaxyLayout position (fx, fy, fz, the force engine off); project cores, topic
// hubs and the Claude core are bigger glows; topic threads and gold bridges are
// the library's links; an UnrealBloomPass added to the library's composer makes
// them shine.
//
// ui/map-state.ts holds every rule (colours, sizes, dimming, Find, the path bar,
// flights, the rail and inspector); this file draws its output and sends every
// click and key back to it. The library, ui/vendor/map-lib.js, is loaded with
// import() the first time the Map tab opens. The page reads its settings from
// `state` once per frame and acts on a change; it needs no framework update hook.
//
// No HTML is ever made from data: the library's own tooltip is off (NO_TOOLTIP),
// hover text goes into an app-owned element with textContent, 3D labels are
// drawn on a canvas by SpriteText, and every element is built with createElement
// and textContent.
import type { ForceGraph3DInstance, GraphNode } from './vendor/map-lib.js'
import { plainLabel } from './escape'
import type { GalaxyHub, GalaxyStar, Vec3 } from './map-layout'
import { simulate, toMapEvent, type MapEvent } from './map-live'
import { ARRANGE, buildBodies, COLOURS, searchResults, type Body, type SolarGalaxy, type Target } from './solar-layout'
import {
  addMemory,
  announcement,
  BACKGROUND,
  bloomFor,
  BRIDGE_COLOUR,
  BRIDGE_OPACITY,
  BRIDGE_PARTICLES,
  buildGalaxy,
  CLAUDE_COLOUR,
  CLAUDE_SIZE,
  type Candidate,
  coreSize,
  coreTarget,
  GLOW_LEVELS,
  glowLevel,
  type GlowLevel,
  readGlow,
  saveGlow,
  RAIL_CARDS,
  readRail,
  railOpen,
  saveRail,
  enqueueSparks,
  eventStars,
  forgetMemory,
  GRID_COLOUR,
  gridLine,
  laneLines,
  layerOf,
  layerOn,
  leanRow,
  newSparkPool,
  PULSE,
  pushRow,
  recallMemory,
  simulationInput,
  FIND_FLY_DELAY_MS,
  isPrimary,
  liveLabel,
  morphBlend,
  morphTarget,
  TICK_LABEL_COLOUR,
  TICK_LABEL_HEIGHT,
  TICK_LABEL_Y,
  tickX,
  TIMELINE_POSE,
  timelineDays,
  timelinePlaces,
  type TimelinePlaces,
  awayPlace,
  easeToward,
  furnitureIdle,
  gridOpacity,
  layoutFlight,
  layoutStep,
  linkFadeAt,
  linksHint,
  linkFadeToApply,
  separateLabels,
  type LabelRect,
  needsGridLine,
  placesFor,
  type PlacesCache,
  samePlace,
  sparkOrigin,
  tickReleased,
  tickTarget,
  tickWanted,
  timelineAim,
  timelineCentre,
  laneTarget,
  visualFade,
  visualPlace,
  visualScale,
  wantedTicks,
  shouldFlyToFound,
  slotOf,
  SPARK_COLOURS,
  sparkAlpha,
  sparkAt,
  sparkProgress,
  sparksFor,
  type Spark,
  stepSparks,
  stripRow,
  stripRows,
  type StripRow,
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
  type Found,
  type Galaxy,
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
  hasKnowledge,
  isHollow,
  KNOWLEDGE_KINDS,
  KNOWLEDGE_MARK_COLOUR,
  KNOWLEDGE_MARK_OPACITY,
  KNOWLEDGE_MARK_SCALE,
  knowledgeCounts,
  knowledgeMarked,
  knowledgeOf,
  knowledgeNote,
  type KnowledgeKind,
  labelScale,
  type LayoutName,
  lerp3,
  MOON_LIMIT,
  MOON_LINE_COLOUR,
  MOON_LINE_OPACITY,
  moonColour,
  moonLabelLift,
  moonLabelScale,
  moonPickRadius,
  MOON_RENDER_ORDER,
  pixelsPerUnit,
  coreLabelOffset,
  needsHover,
  dimNote,
  clearKinds,
  STRIP_EMPTY_TEXT,
  LIVE_PILL_TITLE,
  moonLinesProblem,
  moonPosition,
  moonPulse,
  moonRows,
  moonSize,
  type MapState,
  NO_TOOLTIP,
  parseGalaxy,
  PICK_RADIUS,
  pathBar,
  pickNearest,
  projectColour,
  projectRows,
  readLayout,
  resetView,
  rgb01,
  rgba,
  saveLayout,
  selectedPulse,
  selectedMoon,
  selectMoon,
  selectStar,
  setColourBy,
  setLayout,
  setQuery,
  setRange,
  starColour,
  starfield,
  starSize,
  starTarget,
  STARFIELD_COUNT,
  threadOpacity,
  toggleBridges,
  toggleKind,
  toggleLayer,
  toggleMoons,
  toggleProject,
  toggleRotation,
  toggleSpokes,
  tooltip,
  topicRows,
  type Hit,
  EMBEDDINGS_HINT,
  SIMILAR_MEANING_MIN,
  SIMILAR_COLOUR,
  layoutPlace,
  layoutWeights,
  meaningAway,
  meaningClusters,
  meaningPlaces,
  meaningStep,
  meaningTarget,
  ringLabel,
  similarOpacity,
  similarPairs,
  toggleSimilar,
  type LayoutWeights,
  type MeaningPlaces,
  type SimilarPair,
  arrangeHint,
  bodyChips,
  closeFind,
  createMemorySearch,
  detailsFor,
  findMode,
  findRows,
  initialSolarPage,
  LEGEND_LEFT,
  LEGEND_RIGHT,
  solarAnnouncement,
  levelFromHash,
  levelToHash,
  readSolarPage,
  resolveHash,
  saveSolarPage,
  setArrange,
  setColour,
  setSolarLevel,
  setSolarQuery,
  SHOW_TOGGLES,
  showAllBodies,
  shownText,
  solarCrumbs,
  tabOrder,
  toggleBody,
  toggleShow,
  viewOf,
  VIEW_BUTTONS,
  type FindRow,
  type SolarHost,
  type SolarSceneApi,
  type SolarPage,
} from './map-state'

type MapLib = typeof import('./vendor/map-lib.js')

/** What the page gives the map: its /api call, a way to open a memory in the Memories view, and the status line. */
export type MapHost = {
  api: (path: string) => Promise<Response>
  openMemory: (id: string) => void
  status: (text: string, kind?: 'ok' | 'error' | 'plain') => void
  /** The page's one activity stream: calls the listener with every new line; returns the way to stop. */
  events?: (listener: (line: Record<string, unknown>) => void) => () => void
  /** Tells whether that stream is connected ('live'), so the Live pill only says On when lines can arrive. */
  streamStatus?: (watcher: (status: string) => void) => () => void
  /** The solar-system scene and what its Find needs (MAPX.6 fills it). Absent, the Galaxy layout stays the force graph. */
  solar?: SolarHost
}

export type MapView = { visible: (shown: boolean) => void; show: (memoryId: string) => void }

// The library's one URL: same origin, served from ui/vendor/ by ui/server.ts.
const LIB_URL = '/vendor/map-lib.js'
const ROTATE_SPEED = 0.35
const HOME: Vec3 = [0, 160, 700]
const ADDITIVE = 2
const NORMAL = 1

// ---- DOM helpers ----

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) {
  const element = document.createElement(tag)
  if (text !== undefined) element.textContent = text
  if (className) element.className = className
  return element
}

function byId<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id)
  if (element === null) throw new Error(`#${id} is missing from index.html`)
  return element as T
}

// A dot of a computed colour (from map-state's palette, never from data), set through the CSSOM.
function dot(colour: string, className = 'map-dot') {
  const span = el('span', undefined, className)
  span.setAttribute('aria-hidden', 'true')
  span.style.backgroundColor = colour
  return span
}

// ---- The three.js classes the bundle does not export ----
//
// ui/vendor/map-lib.js exports only ForceGraph3D, SpriteText and the post passes.
// The classes the glows need are reached from objects the bundle does make:
// SpriteText extends Sprite, which extends Object3D; a sprite's material is a
// SpriteMaterial whose map is a CanvasTexture; its geometry is a BufferGeometry
// whose index is a typed BufferAttribute. Anything missing returns null and the
// map shows what it can.

/* biome-ignore-start lint/suspicious/noExplicitAny: three.js classes reached by their prototypes have no types */
type Any = any
type Three = {
  Sprite: new (material: Any) => Any
  Object3D: new () => Any
  SpriteMaterial: new (params: Record<string, unknown>) => Any
  CanvasTexture: new (canvas: HTMLCanvasElement) => Any
  BufferGeometry: new () => Any
  BufferAttribute: new (array: Float32Array, itemSize: number) => Any
}

function threeFrom(lib: MapLib): Three | null {
  try {
    const probe = new lib.SpriteText(' ', 1) as Any
    const Sprite = Object.getPrototypeOf(lib.SpriteText)
    const Three: Three = {
      Sprite,
      Object3D: Object.getPrototypeOf(Sprite),
      SpriteMaterial: probe.material.constructor,
      CanvasTexture: probe.material.map.constructor,
      BufferGeometry: probe.geometry.constructor,
      BufferAttribute: Object.getPrototypeOf(probe.geometry.index.constructor),
    }
    return Object.values(Three).every(c => typeof c === 'function') ? Three : null
  } catch {
    return null
  }
}

/** The glow and ring textures: one radial gradient each, as in the mockup's point shader. */
function glowTextures(three: Three): { glow: Any; ring: Any } {
  const size = 128
  const paint = (alphaAt: (d: number) => number) => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const g = canvas.getContext('2d')
    if (g === null) throw new Error('no 2d canvas')
    const image = g.createImageData(size, size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5)
        const i = (y * size + x) * 4
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255
        image.data[i + 3] = d > 0.5 ? 0 : Math.round(255 * Math.min(1, alphaAt(d)))
      }
    }
    g.putImageData(image, 0, 0)
    return new three.CanvasTexture(canvas)
  }
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const halo = (d: number) => Math.exp(-d * d * 9) * 0.35
  return {
    glow: paint(d => Math.exp(-d * d * 30) + halo(d)),
    ring: paint(d => smooth(0.3, 0.36, d) * smooth(0.46, 0.4, d) + halo(d) * 0.4),
  }
}

// ---- The scene's pieces ----

type Visual = {
  kind: 'star' | 'hub' | 'core' | 'claude' | 'cluster'
  /** The id the state uses: a memory id, a hub key, an owner, or ''. */
  key: string
  owner: string
  sprite: Any
  label: Any | null
  labelBase: [number, number]
  labelOffset: number
  position: Vec3
  /** Its place in the Galaxy layout; `position` is this blended toward its Timeline place. */
  home: Vec3
  /** Its index in the layout's cores, hubs or stars (0 for the Claude core). */
  slot: number
  /** The library node this is drawn at (positions are written to it). */
  node: Any
  /** What is left of it in the other layouts: 1, the share a topic hub or project core keeps while it fades, or a Meaning label's weight. */
  fade: number
  size: number
  alpha: number
  target: number
  labelAlpha: number
  labelTarget: number
  pulse: number
  index: number
}

type Loose = Record<string, (...args: Any[]) => Any>
type GraphLinkData = { source: string; target: string; kind: 'spoke' | 'bridge'; owner: string; star?: string }

// ---- The solar page (MAPX.11) ----
//
// The Galaxy layout's page around the solar scene, built like the rest of this file: createElement and
// textContent, no inline style attributes (dynamic values go through element.style), state read from
// map-state.ts. It reaches the scene only through C13 (SolarSceneApi) and never imports ui/solar.ts.

const GALAXY: Target = { level: 'galaxy' }
const SOLAR_ONLY = ['solar-card-arrange', 'solar-card-colour', 'solar-card-show', 'solar-canvas', 'solar-path', 'solar-bodies', 'solar-details', 'solar-legend-left', 'solar-legend-right', 'solar-tour', 'solar-hint', 'solar-views']

type SolarMount = { sync: (layout: string) => void; active: () => boolean }

function mountSolarPage(host: MapHost, solar: SolarHost, storage: Storage | undefined, reducedMotion: boolean): SolarMount {
  const root = byId('view-map')
  const canvas = byId<HTMLCanvasElement>('solar-canvas')
  const find = byId<HTMLInputElement>('map-find')
  const placeholder = find.placeholder
  let page: SolarPage = readSolarPage(storage)
  let galaxy: SolarGalaxy | null = null
  let bodies: Body[] = []
  let scene: SolarSceneApi | null = null
  let active = false
  let loading = false
  // The memories the server found for the query, and whether Enter waits for them.
  let hits: { id: string; owner?: string; content?: string }[] = []
  let enterWaits = false
  let lastLevel = ''

  const send = <T,>(call: (scene: SolarSceneApi) => T) => {
    if (scene !== null) call(scene)
  }
  const sceneView = () => ({ ...viewOf(page), rotate: page.rotate && !reducedMotion })
  const rows = (): FindRow[] => (page.findOpen && galaxy !== null ? findRows(bodies, page.query, hits, galaxy.memories) : [])

  // ---- Find: the memory search ----

  const memorySearch = createMemorySearch({
    post: solar.post,
    mode: () => findMode(solar.embeddings(), solar.searchMode()),
    done: (_query, found) => {
      if (found !== null) hits = found
      renderFind()
      if (enterWaits && rows().length > 0) {
        enterWaits = false
        go(rows()[0]!)
      }
    },
  })

  function go(row: FindRow) {
    page = { ...page, findOpen: false }
    send(scene => scene.flyTo(row.target))
    renderFind()
  }

  // ---- Drawing ----

  const button = (text: string, className: string, pressed?: boolean) => {
    const element = el('button', text, className)
    element.type = 'button'
    if (pressed !== undefined) element.setAttribute('aria-pressed', String(pressed))
    return element
  }

  function remember() {
    saveSolarPage(storage, page)
  }

  function changeView(next: SolarPage) {
    if (next === page) return
    page = next
    remember()
    send(scene => scene.setView(sceneView()))
    renderRail()
    renderChips()
    renderLegend()
  }

  function renderRail() {
    byId('solar-arrange').replaceChildren(
      ...ARRANGE.map(option => {
        const item = button(option.label, 'seg-btn', option.id === page.arrange)
        item.addEventListener('click', () => changeView(setArrange(page, option.id)))
        return item
      }),
    )
    byId('solar-arrange-hint').textContent = `${arrangeHint(page.arrange)} Planet size is always the memory count.`
    byId('solar-colour').replaceChildren(
      ...COLOURS.map(option => {
        const item = button(option.label, 'seg-btn', option.id === page.colour)
        item.addEventListener('click', () => changeView(setColour(page, option.id)))
        return item
      }),
    )
    byId('solar-show').replaceChildren(
      ...SHOW_TOGGLES.map(toggle => {
        const item = button(`${toggle.label}: ${page[toggle.key] ? 'on' : 'off'}`, 'seg-btn', page[toggle.key])
        item.addEventListener('click', () => changeView(toggleShow(page, toggle.key)))
        return item
      }),
    )
  }

  function renderLegend() {
    const card = (id: string, title: string, items: readonly { colour: string; name: string; means: string }[], key: 'legL' | 'legR') => {
      const box = byId(id)
      box.hidden = !active || !page.legend
      const open = page[key]
      const fold = button('', 'legend-fold')
      fold.setAttribute('aria-expanded', String(open))
      fold.append(el('span', title), el('span', open ? '▾' : '▸'))
      fold.addEventListener('click', () => changeView(toggleShow(page, key)))
      box.replaceChildren(fold)
      if (!open) return
      for (const item of items) {
        const row = el('div', undefined, 'legend-row')
        const swatch = dot(item.colour, 'legend-sw')
        row.append(swatch, el('span', item.name, 'legend-name'), el('span', item.means, 'legend-means'))
        box.append(row)
      }
    }
    card('solar-legend-left', 'Bodies', LEGEND_LEFT, 'legL')
    card('solar-legend-right', 'Belts, links and motion', LEGEND_RIGHT, 'legR')
  }

  function renderChips() {
    byId('solar-shown').textContent = shownText(bodies, page.hidden)
    byId('solar-chips').replaceChildren(
      ...bodyChips(bodies, page).map(chip => {
        const item = button('', chip.pressed ? 'body-chip' : 'body-chip is-off', chip.pressed)
        item.dataset.owner = chip.owner
        item.title = chip.title
        item.append(dot(chip.colour, chip.craft ? 'chip-dot is-craft' : 'chip-dot'), el('span', chip.label, 'chip-name'), el('span', chip.value, 'chip-value'))
        item.addEventListener('click', () => {
          const hiding = chip.pressed
          changeView(toggleBody(page, chip.owner))
          if (hiding && page.level.level !== 'galaxy' && page.level.owner === chip.owner) send(scene => scene.flyTo(GALAXY))
        })
        return item
      }),
    )
  }

  function renderViews() {
    byId('solar-views').replaceChildren(
      ...VIEW_BUTTONS.map(spec => {
        const item = button(spec.label, 'stage-btn')
        item.setAttribute('aria-label', spec.aria)
        item.addEventListener('click', () => send(scene => ('zoom' in spec.action ? scene.zoom(spec.action.zoom) : scene.showView(spec.action.view))))
        return item
      }),
    )
  }

  function renderFind() {
    const list = byId('solar-find-results')
    const found = rows()
    const query = page.query.trim()
    byId('map-found').textContent = active && query.length >= 2 && galaxy !== null ? `${Object.keys(searchResults(bodies, query).match).length} bodies` : ''
    list.hidden = !active || !page.findOpen
    if (list.hidden) {
      list.replaceChildren()
      return
    }
    if (found.length === 0) {
      const none = el('li', 'Nothing matches', 'find-empty')
      none.setAttribute('role', 'presentation')
      list.replaceChildren(none)
      return
    }
    list.replaceChildren(
      ...found.map(row => {
        const item = el('li')
        item.setAttribute('role', 'presentation')
        const pick = button('', 'find-row')
        pick.append(el('span', row.type, `find-type is-${row.type.toLowerCase()}`), el('span', row.label, 'find-label'), el('span', row.sub, 'find-sub'))
        pick.addEventListener('click', () => go(row))
        item.append(pick)
        return item
      }),
    )
  }

  function renderPath() {
    byId('solar-path').replaceChildren(
      ...solarCrumbs(page.level, bodies).map((part, i) => {
        const span = el('span', undefined, 'crumb')
        if (i > 0) {
          const sep = el('span', '›', 'crumb-sep')
          sep.setAttribute('aria-hidden', 'true')
          span.append(sep)
        }
        const crumb = button(part.label, part.current ? 'crumb-btn is-current' : 'crumb-btn')
        if (part.current) crumb.setAttribute('aria-current', 'page')
        crumb.addEventListener('click', () => send(scene => scene.flyTo(part.target)))
        span.append(crumb)
        return span
      }),
    )
  }

  function renderDetails() {
    const box = byId('solar-details')
    if (galaxy === null) {
      box.replaceChildren()
      return
    }
    const view = detailsFor(page.level, bodies, galaxy)
    const head = el('div', undefined, 'insp-head')
    head.append(el('span', view.kicker, 'insp-kind'), el('h2', view.title, 'insp-title'))
    const facts = el('dl', undefined, 'solar-facts')
    for (const fact of view.facts) {
      const item = el('div')
      item.append(el('dt', fact.label), el('dd', fact.value))
      facts.append(item)
    }
    box.replaceChildren(head, facts, el('p', view.hint, 'insp-hint'))
  }

  /** The Tab order: sun, planets, moons, memories; a redraw keeps the focus on the stop that had it. */
  function renderTour() {
    const nav = byId('solar-tour')
    const focused = document.activeElement instanceof HTMLElement && nav.contains(document.activeElement) ? document.activeElement.dataset.stop : undefined
    nav.replaceChildren(
      ...(galaxy === null ? [] : tabOrder(page.level, bodies, galaxy.memories, page.hidden)).map(stop => {
        const item = button(stop.label, 'tour-stop')
        item.dataset.stop = levelToHash(stop.target)
        item.addEventListener('click', () => send(scene => scene.flyTo(stop.target)))
        return item
      }),
    )
    if (focused !== undefined) nav.querySelector<HTMLElement>(`button[data-stop="${CSS.escape(focused)}"]`)?.focus()
  }

  function renderLevel() {
    renderPath()
    renderDetails()
    renderTour()
    const said = solarAnnouncement(page.level, bodies)
    if (said !== lastLevel) {
      lastLevel = said
      byId('solar-live').textContent = said
    }
  }

  function writeHash() {
    try {
      if (typeof history !== 'undefined' && typeof location !== 'undefined') history.replaceState(null, '', `${location.pathname}${location.search}${levelToHash(page.level)}`)
    } catch {
      // the URL is a convenience only
    }
  }

  function hover(tip: string[] | null, x: number, y: number) {
    const box = byId('solar-tip')
    if (tip === null || tip.length === 0) {
      box.hidden = true
      return
    }
    box.replaceChildren(el('div', tip[0], 'tip-title'), ...tip.slice(1).map(line => el('div', line, 'tip-line')))
    const width = byId('map-stage').getBoundingClientRect().width || 900
    box.style.left = `${Math.max(120, Math.min(width - 140, x))}px`
    box.style.top = `${Math.max(110, y)}px`
    box.hidden = false
  }

  // ---- The scene ----

  function applyLevel(level: Target) {
    page = setSolarLevel(page, level)
    writeHash()
    renderLevel()
  }

  function makeScene() {
    if (scene !== null) return
    canvas.hidden = false
    scene = solar.createScene({
      canvas,
      onHover: hover,
      onPick: target => send(scene => scene.flyTo(target)),
      onLevel: applyLevel,
    })
    if (galaxy !== null) feed(scene)
  }

  /** Hands the scene the data, the view and the level the URL named. */
  function feed(target: SolarSceneApi) {
    if (galaxy === null) return
    target.setData(galaxy)
    target.setView(sceneView())
    if (page.level.level !== 'galaxy') target.flyTo(page.level)
  }

  async function load() {
    if (loading || galaxy !== null) return
    loading = true
    try {
      const response = await host.api('/api/galaxy')
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : `the server answered ${response.status}`)
      if (!Array.isArray(body.projects) || !Array.isArray(body.memories)) throw new Error('the reply was not a galaxy')
      galaxy = { ...(body as unknown as SolarGalaxy), writers: Array.isArray(body.writers) ? (body.writers as SolarGalaxy['writers']) : [], globalLive: typeof body.globalLive === 'number' ? body.globalLive : 0 }
      bodies = buildBodies(galaxy, Date.now())
      page = setSolarLevel(page, resolveHash(levelFromHash(typeof location === 'undefined' ? '' : location.hash), bodies, galaxy.memories))
      writeHash()
      renderChips()
      renderLevel()
      renderFind()
      if (scene !== null) feed(scene)
    } catch (err) {
      host.status(`Could not load the map: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      loading = false
    }
  }

  // ---- Wiring ----

  byId('solar-show-all').addEventListener('click', () => changeView(showAllBodies(page)))
  find.addEventListener('input', () => {
    if (!active) return
    enterWaits = false
    page = setSolarQuery(page, find.value)
    send(scene => scene.setView(sceneView()))
    memorySearch.type(find.value)
    renderFind()
  })
  find.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!active) return
    if (event.key === 'Escape') {
      find.value = ''
      hits = []
      enterWaits = false
      memorySearch.cancel()
      page = closeFind(page)
      send(scene => scene.setView(sceneView()))
      renderFind()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      page = setSolarQuery(page, find.value)
      const first = rows()[0]
      if (first !== undefined) go(first)
      else enterWaits = true
      memorySearch.enter(find.value)
    }
  })
  host.events?.(line => {
    if (!active) return
    const event = toMapEvent(line)
    if (event !== null) send(scene => scene.event(event))
  })
  renderRail()
  renderViews()
  renderLegend()
  renderChips()

  return {
    active: () => active,
    sync(layout: string) {
      const on = layout === 'galaxy'
      if (on === active) return
      active = on
      root.classList.toggle('solar-on', on)
      for (const id of SOLAR_ONLY) byId(id).hidden = !on
      find.placeholder = on ? 'project, tag, kind or words' : placeholder
      if (on) {
        makeScene()
        void load()
        renderLegend()
        renderFind()
      } else {
        scene?.dispose()
        scene = null
        canvas.hidden = true
        byId('solar-tip').hidden = true
        byId('solar-find-results').hidden = true
      }
    },
  }
}

/** Builds the Map tab once; the page calls visible() on every tab change. */
export function createMap(host: MapHost): MapView {
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const storage = (() => {
    try {
      return typeof localStorage === 'undefined' ? undefined : localStorage
    } catch {
      return undefined
    }
  })()
  let state: MapState = initialState({ reducedMotion, layout: initialLayout(readLayout(storage), true) })
  let galaxy: Galaxy | null = null
  let found: Found | null = null
  let graph: ForceGraph3DInstance | null = null
  let lib: MapLib | null = null
  let three: Three | null = null
  let shown = true
  let failed = false
  // Glow: the bloom strength level (off, soft, full), remembered; the pass is made when the map starts.
  let glow: GlowLevel = glowLevel(readGlow(storage))
  let bloomPass: Any = null
  const applyGlow = () => {
    if (bloomPass === null) return
    const settings = bloomFor(glow)
    bloomPass.enabled = settings.enabled
    bloomPass.strength = settings.strength
    bloomPass.radius = settings.radius
    bloomPass.threshold = settings.threshold
  }
  let pending: string | null = null
  let visuals: Visual[] = []
  const starVisual = new Map<string, Visual>()
  // A faint ring sprite per star that has knowledge, drawn in the star's own group.
  const knowledgeMarks = new Map<string, Any>()
  const hubVisual = new Map<string, Visual>()
  const coreVisual = new Map<string, Visual>()
  let seen: MapState | null = null
  let raf = 0
  let lastFrame = 0
  let clock = 0
  // Timeline: the morph weight (0 Galaxy, 1 Timeline), the days the axis shows, and the furniture.
  let morph: number = morphTarget(state.layout)
  let shownDays = 0
  // Meaning: its own morph weight beside Timeline's (0 elsewhere, 1 in Meaning), the star places it holds, and the cyan links.
  let meaningMorph: number = meaningTarget(state.layout)
  let meaningCache: { galaxy: Galaxy; places: MeaningPlaces } | null = null
  let weights: LayoutWeights = layoutWeights(morph, meaningMorph)
  let similarLines: Any = null
  let similarCapacity = 0
  let similarKey: unknown[] = []
  let similarShown: SimilarPair[] = []
  // Counts the frames some visual moved on, so the links follow the stars they join.
  let moves = 0
  let similarMoves = -1
  let placeDirty = true
  let linkFade = 1
  // The links were rebuilt or restyled since the fade was last written.
  let linksDirty = true
  let placesCache: PlacesCache = null
  let lanesCache: ReturnType<typeof laneLines> | null = null
  let claudeVisual: Visual | null = null
  const tickItems = new Map<number, { label: Any | null; line: Any | null; alpha: number }>()
  let laneItems = new Map<string, { line: Any; alpha: number }>()
  let flight: { t: number; seconds: number; from: { position: Vec3; target: Vec3 }; to: { position: Vec3; target: Vec3 } } | null = null
  let pointer: { x: number; y: number; moved: boolean; inside: boolean } = { x: 0, y: 0, moved: false, inside: false }
  let down: { x: number; y: number; t: number } | null = null
  let hovered = ''
  let starfieldMade = false
  let lastSaid = ''
  // Live: the graph's data, the strip and the sparks.
  let graphNodes: GraphNode[] = []
  let graphLinks: GraphLinkData[] = []
  let strip: StripRow[] = []
  const sparkPool = newSparkPool()
  let sparkSprites: Any[] = []
  let stopEvents: (() => void) | null = null
  let chain: Promise<void> = Promise.resolve()
  const fetching = new Set<string>()
  // Find: the camera flies once the query settles, and only to a centre it has not flown to.
  let findTimer: ReturnType<typeof setTimeout> | 0 = 0
  let lastFound: Vec3 | null = null
  let connected = false
  // Knowledge moons: eight glow sprites, eight lines and their kind labels, kept in the scene and shown for the selected star.
  let moonSprites: Any[] = []
  let moonLines: Any[] = []
  let moonLabels: Any[] = []
  let moonKey = ''
  // What the moons need only when the galaxy or the selection changes (not every frame): rows, colours, the picked row.
  let moonPlan: { galaxy: Galaxy | null; selected: string | null; moons: boolean; moon: string | null; gone: number; key: string; rows: ReturnType<typeof moonRows>; colours: Vec3[]; picked: string | null } | null = null
  // One label look (texture and size) per kind, made once and shared by every moon of that kind.
  const moonLabelStyle = new Map<KnowledgeKind, { map: Any; scale: [number, number] }>()
  // Looks at the library's scene so far (afterData runs), and whether the missing-line status was said.
  let sceneChecks = 0
  let moonLinesTold = false
  let moonSpots: { id: string; position: Vec3; sprite: Any; radius: number }[] = []
  let lineClasses: { Line: new (geometry: Any, material: Any) => Any; Material: new (params: Record<string, unknown>) => Any } | null = null

  const canvasBox = byId('map-canvas')
  const stage = byId('map-stage')
  const message = byId('map-message')
  const tip = byId('map-tip')
  const live = byId('map-live')
  const rotate = byId<HTMLButtonElement>('map-rotate')
  const find$ = byId<HTMLInputElement>('map-find')
  // The solar-system Galaxy page, when the host brings a scene; it takes over the Galaxy layout's page and leaves the others alone.
  const solarPage = host.solar ? mountSolarPage(host, host.solar, storage, reducedMotion) : null

  function say(text: string) {
    message.textContent = text
    message.hidden = false
    canvasBox.hidden = true
  }

  // ---- State changes ----

  function dispatch(next: MapState) {
    if (next === state) return
    if (galaxy !== null && next.query !== state.query) found = find(galaxy, next.query)
    state = next
    solarPage?.sync(state.layout)
    render()
  }

  const loose = () => graph as unknown as Loose

  function fly(target: ReturnType<typeof flightTo>) {
    if (graph === null || target === null) return
    const camera = loose().camera?.()
    const controls = graph.controls() as Any
    if (!camera || !controls) return
    const cam = camera.position
    const look = controls.target
    const to = flightPose([cam.x, cam.y, cam.z], [look.x, look.y, look.z], target)
    const seconds = flightSeconds(state.reducedMotion)
    flight = { t: 0, seconds, from: { position: [cam.x, cam.y, cam.z], target: [look.x, look.y, look.z] }, to }
    if (seconds <= 0) stepFlight(0)
  }

  function stepFlight(dt: number) {
    if (flight === null || graph === null) return
    flight.t = flightProgress(flight.t, dt, flight.seconds)
    const k = ease(flight.t)
    const position = lerp3(flight.from.position, flight.to.position, k)
    const target = lerp3(flight.from.target, flight.to.target, k)
    const camera = loose().camera?.()
    const controls = graph.controls() as Any
    camera?.position.set(position[0], position[1], position[2])
    controls?.target.set(target[0], target[1], target[2])
    if (flight.t >= 1) flight = null
  }

  /** Flies the camera to a pose (position and what it looks at), as the Timeline view does. */
  function flyToPose(pose: { position: Vec3; target: Vec3 }) {
    if (graph === null) return
    const camera = loose().camera?.()
    const controls = graph.controls() as Any
    if (!camera || !controls) return
    const cam = camera.position
    const look = controls.target
    const seconds = flightSeconds(state.reducedMotion)
    flight = { t: 0, seconds, from: { position: [cam.x, cam.y, cam.z], target: [look.x, look.y, look.z] }, to: { position: [...pose.position], target: [...pose.target] } }
    if (seconds <= 0) stepFlight(0)
  }

  /** Where a flight or Find aims in Timeline for the range showing: a core's or star's place, and for a topic (its hub is invisible there) its lane and the average x of its stars. */
  function timelineAt(kind: 'core' | 'hub' | 'star', id: string): Vec3 | null {
    const g = galaxy
    if (g === null) return null
    const days = timelineDays(g, state.range)
    return timelineAim(g, timelinePlaces(g, days), kind, id, days)
  }

  /** A flight to a core, hub or star, or Reset view: to where it is in the layout now (Reset view in Timeline is its straight-on view). */
  function flyHere(kind: 'core' | 'hub' | 'star' | 'reset', id = '') {
    if (galaxy === null) return
    if (state.layout !== 'timeline') return fly(flightTo(galaxy, kind, id))
    if (kind === 'reset') return flyToPose(TIMELINE_POSE)
    const flight = flightTo(galaxy, kind, id)
    if (flight !== null) fly({ target: timelineAt(kind, id) ?? flight.target, distance: flight.distance })
  }

  // Actions the rail, the path bar, the map and Find all share.
  function flyToProject(owner: string) {
    if (galaxy === null) return
    dispatch(focusProject(state, owner))
    flyHere('core', owner)
  }
  function flyToTopic(key: string) {
    if (galaxy === null) return
    dispatch(focusTopic(state, galaxy, key))
    flyHere('hub', key)
  }
  function flyToStar(id: string) {
    if (galaxy === null) return
    dispatch(selectStar(state, galaxy, id))
    flyHere('star', id)
  }
  function reset() {
    if (galaxy === null) return
    find$.value = ''
    if (findTimer) clearTimeout(findTimer)
    findTimer = 0
    lastFound = null
    dispatch(resetView(state))
    flyHere('reset')
  }
  /** The middle of the stars a query found, where they are now: in Timeline their Timeline places. */
  function foundCentre(hit: Found): Vec3 {
    const g = galaxy
    if (g === null || state.layout !== 'timeline' || hit.ids.size === 0) return hit.centre ?? [0, 0, 0]
    const days = timelineDays(g, state.range)
    // Only the stars on the axis count: the others are faded out, and the camera should not fly to an empty place.
    return timelineCentre(g, timelinePlaces(g, days), hit.ids, days) ?? hit.centre ?? [0, 0, 0]
  }
  function search(value: string) {
    if (galaxy === null) return
    dispatch(setQuery(state, value))
    if (findTimer) clearTimeout(findTimer)
    findTimer = 0
    if (value.trim() === '') {
      lastFound = null
      return
    }
    // Not on every keystroke: the camera flies once the typing stops, and not again to the same centre.
    findTimer = setTimeout(() => {
      findTimer = 0
      if (found === null || found.centre === null || !shouldFlyToFound(found, lastFound)) return
      lastFound = found.centre
      fly({ target: foundCentre(found), distance: found.distance })
    }, FIND_FLY_DELAY_MS)
  }

  // ---- Drawing the page ----

  function render() {
    if (galaxy === null) return
    renderPath(galaxy)
    renderRail(galaxy)
    renderInspector(galaxy)
    renderControls(galaxy)
    const said = announcement(galaxy, state)
    if (said !== lastSaid) {
      lastSaid = said
      live.textContent = said
    }
  }

  function renderPath(g: Galaxy) {
    const nav = byId('map-path')
    const active = document.activeElement
    const focusedLevel = active instanceof HTMLElement && nav.contains(active) ? active.dataset.level : undefined
    nav.replaceChildren(
      ...pathBar(state, g).map((part, i) => {
        const span = el('span', undefined, 'crumb')
        if (i > 0) {
          const sep = el('span', '›', 'crumb-sep')
          sep.setAttribute('aria-hidden', 'true')
          span.append(sep)
        }
        const button = el('button', part.label, part.current ? 'crumb-btn is-current' : 'crumb-btn')
        button.type = 'button'
        button.dataset.level = part.level
        if (part.current) button.setAttribute('aria-current', 'page')
        button.addEventListener('click', () => {
          if (part.level === 'all') return reset()
          const next = goTo(state, part.level)
          dispatch(next)
          if (part.level === 'project' && next.project !== null) flyHere('core', next.project)
          if (part.level === 'topic' && next.topic !== null) flyHere('hub', next.topic)
        })
        span.append(button)
        return span
      }),
    )
    if (focusedLevel !== undefined) {
      const buttons = [...nav.querySelectorAll<HTMLButtonElement>('button[data-level]')]
      ;(buttons.find(button => button.dataset.level === focusedLevel) ?? buttons.at(-1))?.focus()
    }
  }

  function renderRail(g: Galaxy) {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusedProject = focused?.dataset.project
    const focusedTag = focused?.tagName.toLowerCase() === 'button' ? 'button' : 'input'
    const focusedTopic = focused?.dataset.topic
    const toggles = byId('map-toggles')
    const rows = projectRows(g, state)
    toggles.replaceChildren(
      ...(rows.length === 0
        ? [el('span', 'No projects.', 'rail-note')]
        : rows.map(row => {
            const label = el('label', undefined, 'toggle')
            const box = el('input')
            box.type = 'checkbox'
            box.dataset.project = row.owner
            box.checked = row.shown
            box.setAttribute('aria-label', `Show ${row.label}`)
            box.addEventListener('change', () => dispatch(toggleProject(state, row.owner)))
            const name = el('button', row.label, row.focused ? 'toggle-name is-selected' : 'toggle-name')
            name.type = 'button'
            name.dataset.project = row.owner
            name.title = `Fly to ${row.label}`
            name.addEventListener('click', event => {
              event.preventDefault()
              flyToProject(row.owner)
            })
            label.append(box, dot(row.colour), name, el('span', String(row.count), 'mono muted'))
            return label
          })),
    )
    const box = byId('map-topics-box')
    const topics = topicRows(g, state)
    // The Topics card opens by itself when it appears (a project was picked); after that it is the reader's to fold.
    const appearing = box.hidden && state.project !== null
    box.hidden = state.project === null
    if (appearing) (box as HTMLDetailsElement).open = true
    if (state.project !== null) {
      byId('map-topics-title').textContent = `Topics in ${projectRows(g, state).find(row => row.owner === state.project)?.label ?? state.project}`
      const colour = projectColour(g, state.project)
      byId('map-topics').replaceChildren(
        ...topics.map(row => {
          const button = el('button', undefined, row.focused ? 'rail-item is-selected' : 'rail-item')
          button.type = 'button'
          button.dataset.topic = row.key
          if (row.focused) button.setAttribute('aria-current', 'true')
          button.append(dot(colour), el('span', row.name, 'rail-name'))
          if (row.shared) button.append(el('span', 'shared', 'rail-mark'))
          button.append(el('span', String(row.count), 'mono muted'))
          button.addEventListener('click', () => flyToTopic(row.key))
          return button
        }),
      )
    }
    // A redraw replaces the rail's controls: the one that had focus keeps it.
    if (focusedProject !== undefined) toggles.querySelector<HTMLElement>(`${focusedTag}[data-project="${CSS.escape(focusedProject)}"]`)?.focus()
    if (focusedTopic !== undefined) byId('map-topics').querySelector<HTMLElement>(`button[data-topic="${CSS.escape(focusedTopic)}"]`)?.focus()
  }

  /** The Overview card (right column) always shows the whole map; the selection card under the graph shows the star, topic or project picked, and is empty otherwise. */
  function renderInspector(g: Galaxy) {
    const view = inspector(g, state)
    const overview = view.kind === 'Overview' ? view : inspector(g, { ...state, selected: null, topic: null, project: null })
    fillInspector(g, byId('map-overview'), overview, true)
    if (view.kind === 'Overview') byId('map-inspector').replaceChildren()
    else fillInspector(g, byId('map-inspector'), view, false)
  }

  /** Fills one card from an inspector view. The Overview is one column; a selection is two: the text on the left, the numbers, knowledge and actions on the right. */
  function fillInspector(g: Galaxy, box: HTMLElement, view: ReturnType<typeof inspector>, overview: boolean) {
    const head = el('div', undefined, 'insp-head')
    const sub = el('span', undefined, 'insp-sub')
    sub.append(dot(view.colour, 'map-dot big'))
    if (view.sub !== '') sub.append(el('span', view.sub))
    head.append(el('span', view.kind, 'insp-kind'), el('h2', view.title, 'insp-title'), sub)
    const parts: HTMLElement[] = [head]
    // What goes in the left column of a selection card (the Overview ignores the split).
    const left = new Set<HTMLElement>([head])
    if (view.memory) {
      const memory = view.memory
      const text = el('p', memory.text, 'insp-text')
      parts.push(text)
      left.add(text)
      const tags = el('div', undefined, 'tag-list')
      for (const tag of memory.tags) tags.append(el('span', plainLabel(tag, 40), 'tag'))
      if (memory.tags.length === 0) tags.append(el('span', 'No tags yet.', 'muted small'))
      parts.push(tags)
      left.add(tags)
    }
    const stats = el('dl', undefined, 'insp-stats')
    for (const stat of view.stats) {
      const item = el('div')
      item.append(el('dt', stat.label), el('dd', stat.value))
      stats.append(item)
    }
    parts.push(stats)
    if (view.knowledge) {
      const section = view.knowledge
      const block = el('section', undefined, 'insp-section')
      block.append(el('h3', 'Knowledge from this memory', 'insp-section-title'), el('p', section.note, 'insp-note'))
      // Knowledge text comes from the store: textContent only (el), never markup.
      if (section.items.length > 0) {
        const list = el('div', undefined, 'rail-list')
        for (const item of section.items) {
          const button = el('button', undefined, item.selected ? 'rail-item is-selected' : 'rail-item')
          button.type = 'button'
          button.dataset.knowledge = item.id
          button.setAttribute('aria-pressed', String(item.selected))
          button.title = `${item.label}: ${item.text}`
          button.append(dot(item.colour), el('span', item.text, 'rail-name'), el('span', item.label, 'rail-mark'))
          button.addEventListener('click', () => dispatch(selectMoon(state, g, item.id)))
          list.append(button, el('p', `${item.label}, ${item.usage}`, 'insp-note'))
        }
        block.append(list)
      }
      parts.push(block)
    }
    if (view.similar) {
      const section = view.similar
      const block = el('section', undefined, 'insp-section')
      block.append(el('h3', 'Similar memories', 'insp-section-title'))
      // Each line opens that star. The text is the other memory's label: textContent only.
      if (section.items.length > 0) {
        const list = el('div', undefined, 'rail-list')
        for (const item of section.items) {
          const button = el('button', undefined, 'rail-item sim-item')
          button.type = 'button'
          button.dataset.similar = item.id
          button.title = `${item.text} (${item.project}, ${item.score})`
          const meta = el('span', undefined, 'sim-meta')
          meta.append(dot(item.colour), el('span', `${item.project} · ${item.score}`, 'small muted'))
          button.append(el('span', item.text, 'sim-text'), meta)
          button.addEventListener('click', () => flyToStar(item.id))
          list.append(button)
        }
        block.append(list)
      }
      block.append(el('p', section.note, 'insp-note'))
      parts.push(block)
    }
    if (view.memory) {
      const open = el('button', 'Open in Memories', 'btn insp-open')
      open.type = 'button'
      const id = view.memory.id
      open.addEventListener('click', () => host.openMemory(id))
      parts.push(open)
    }
    // A knowledge chip dims the map; the Overview says so, with a way to clear it.
    const dimmed = overview ? dimNote(state) : null
    if (dimmed !== null) {
      const clear = el('button', dimmed, 'btn insp-dim')
      clear.type = 'button'
      clear.addEventListener('click', () => dispatch(clearKinds(state)))
      parts.push(clear)
    }
    if (view.hint) {
      const hint = el('p', view.hint, 'insp-hint')
      parts.push(hint)
      left.add(hint)
    }
    if (overview) {
      box.replaceChildren(...parts)
      return
    }
    const main = el('div', undefined, 'insp-main')
    main.append(...parts.filter(part => left.has(part)))
    const side = el('div', undefined, 'insp-side')
    side.append(...parts.filter(part => !left.has(part)))
    box.replaceChildren(main, side)
  }

  function renderControls(g: Galaxy) {
    for (const button of byId('map-layout').querySelectorAll<HTMLButtonElement>('button[data-layout]')) {
      button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout))
      if (button.dataset.layout === 'meaning') {
        button.disabled = !g.meaning
        button.title = g.meaning ? '' : EMBEDDINGS_HINT
      }
    }
    // Meaning and Similar memories need vectors; without them both say how to get them, in words on the page.
    const similar = byId<HTMLInputElement>('map-similar')
    similar.disabled = !g.meaning
    similar.checked = g.meaning && state.similar
    similar.closest?.('label')?.setAttribute('title', g.meaning ? '' : EMBEDDINGS_HINT)
    const hint = byId('map-meaning-hint')
    hint.hidden = g.meaning
    hint.textContent = g.meaning ? '' : EMBEDDINGS_HINT
    byId('map-range-box').hidden = state.layout !== 'timeline'
    for (const button of byId('map-range').querySelectorAll<HTMLButtonElement>('button[data-range]')) button.setAttribute('aria-pressed', String(button.dataset.range === String(state.range)))
    for (const button of byId('map-colour').querySelectorAll<HTMLButtonElement>('button[data-colour]')) button.setAttribute('aria-pressed', String(button.dataset.colour === state.colourBy))
    byId<HTMLInputElement>('map-spokes').checked = state.spokes
    byId<HTMLInputElement>('map-bridges').checked = state.bridges
    byId<HTMLInputElement>('map-layer-recall').checked = state.layerRecall
    byId<HTMLInputElement>('map-layer-write').checked = state.layerWrite
    renderKnowledgeControls(g)
    const linksLine = byId('map-links-hint')
    linksLine.textContent = linksHint(g, state)
    linksLine.hidden = linksLine.textContent === ''
    rotate.setAttribute('aria-pressed', String(state.rotating))
    byId('map-found').textContent = found === null ? '' : foundText(state.query, found)
    const pillText = liveLabel(state, connected)
    byId('map-live-state').textContent = pillText
    byId('map-live-state').parentElement?.classList.toggle('is-on', pillText === 'On')
    byId('map-live-state').parentElement?.setAttribute('aria-pressed', String(state.live))
    renderStrip()
  }

  /** Knowledge moons and the five chips: disabled until the page holds some knowledge, then live. */
  function renderKnowledgeControls(g: Galaxy) {
    const any = hasKnowledge(g)
    const moons = byId<HTMLInputElement>('map-moons')
    moons.disabled = !any
    moons.checked = state.moons
    const counts = knowledgeCounts(g)
    for (const chip of byId('map-know').querySelectorAll<HTMLButtonElement>('button[data-kind]')) {
      const kind = chip.dataset.kind as KnowledgeKind
      if (!KNOWLEDGE_KINDS.includes(kind)) continue
      chip.setAttribute('aria-pressed', String(state.kinds.has(kind)))
      if (any) chip.removeAttribute('aria-disabled')
      else chip.setAttribute('aria-disabled', 'true')
      const number = chip.querySelector('span.mono')
      if (number) number.textContent = String(counts[kind])
    }
    const note = byId('map-know-note')
    note.textContent = any ? knowledgeNote(state) : 'No knowledge extracted yet. Run /mnemosyne-knowledge, then reload.'
    // A chip dims the map: the note carries its own Clear (ui/index.html has none, so it is made here).
    if (any && state.kinds.size > 0) {
      const clear = el('button', 'Clear', 'btn map-know-clear')
      clear.type = 'button'
      clear.addEventListener('click', () => dispatch(clearKinds(state)))
      note.append(' ', clear)
    }
  }

  // ---- The scene ----

  const glowTexture: { glow: Any; ring: Any } = { glow: null, ring: null }

  function makeSprite(kind: 'glow' | 'ring', colour: string) {
    const T = three
    if (T === null) return null
    const [r, g, b] = rgb01(colour)
    const sprite = new T.Sprite(new T.SpriteMaterial({ map: glowTexture[kind], transparent: true, depthWrite: false, blending: ADDITIVE, opacity: 0 }))
    sprite.material.color.setRGB(r, g, b)
    return sprite
  }

  function makeLabel(text: string, height: number, colour: string) {
    if (lib === null) return null
    const label = new lib.SpriteText(text, height, colour) as Any
    label.fontWeight = '600'
    label.material.depthWrite = false
    label.material.opacity = 0
    return label
  }

  const labelFor = (text: string, height: number, colour: string, offset: number) => {
    const sprite = makeLabel(text, height, colour)
    return { label: sprite, labelBase: (sprite ? [sprite.scale.x, sprite.scale.y] : [1, 1]) as [number, number], labelOffset: offset }
  }

  function addVisual(id: string, home: Vec3, slot: number, visual: Omit<Visual, 'position' | 'home' | 'slot' | 'node' | 'fade' | 'index' | 'alpha' | 'target' | 'labelAlpha' | 'labelTarget' | 'pulse'>) {
    const node: GraphNode = { id, vi: visuals.length, fx: home[0], fy: home[1], fz: home[2] }
    const v: Visual = { ...visual, position: home, home, slot, node, fade: 1, index: visuals.length, alpha: 0, target: 0, labelAlpha: 0, labelTarget: 0, pulse: 0 }
    visuals.push(v)
    graphNodes.push(node)
    // Born while Timeline is showing (or on the way): placed where the layout is now, not at its Galaxy place.
    if (morph > 0) placeDirty = true
    return v
  }

  function addCore(g: Galaxy, core: Galaxy['layout']['cores'][number], slot: number) {
    const v = addVisual(`c:${core.owner}`, core.position, slot, { kind: 'core', key: core.owner, owner: core.owner, sprite: makeSprite('glow', projectColour(g, core.owner)), size: coreSize(core.count), ...labelFor(core.label, 16.8, '#E8EEF4', core.radius * 0.55 + 14) })
    coreVisual.set(core.owner, v)
  }

  function addHub(g: Galaxy, hub: GalaxyHub, slot: number) {
    const v = addVisual(`h:${hub.key}`, hub.position, slot, { kind: 'hub', key: hub.key, owner: hub.project, sprite: makeSprite('glow', hubColour(projectColour(g, hub.project))), size: HUB_SIZE, ...labelFor(hub.name, 12.6, '#C4D0DC', 9) })
    hubVisual.set(hub.key, v)
    graphLinks.push({ source: `c:${hub.project}`, target: `h:${hub.key}`, kind: 'spoke', owner: hub.project })
  }

  function addStar(g: Galaxy, star: GalaxyStar, i: number) {
    const v = addVisual(`s:${star.id}`, star.position, i, { kind: 'star', key: star.id, owner: star.owner, sprite: makeSprite(isHollow(star.recalls) ? 'ring' : 'glow', starColour(g, i, state.colourBy)), size: starSize(star.recalls), label: null, labelBase: [1, 1], labelOffset: 0 })
    starVisual.set(star.id, v)
    if (knowledgeOf(g, star.id).length > 0) {
      const mark = makeSprite('ring', KNOWLEDGE_MARK_COLOUR)
      if (mark) knowledgeMarks.set(star.id, mark)
    }
    graphLinks.push({ source: `h:${star.topic}`, target: `s:${star.id}`, kind: 'spoke', owner: star.owner, star: star.id })
  }

  /** Lets go of the sprites' materials and the labels' canvas textures before a redraw makes new ones. */
  function disposeVisuals() {
    for (const v of visuals) {
      if (v.sprite) {
        v.sprite.parent?.remove(v.sprite)
        v.sprite.material?.dispose?.()
      }
      if (v.label) {
        v.label.parent?.remove(v.label)
        v.label.material?.map?.dispose?.()
        v.label.material?.dispose?.()
      }
    }
    for (const mark of knowledgeMarks.values()) {
      mark.parent?.remove(mark)
      mark.material?.dispose?.()
    }
    knowledgeMarks.clear()
  }

  /** The graph data and a visual per node for a galaxy; threads and bridges are the library's links. */
  function drawGalaxy(g: Galaxy) {
    if (graph === null || lib === null || three === null) return
    disposeVisuals()
    disposeLanes()
    disposeTicks()
    placesCache = null
    // Fresh links are fully visible.
    linkFade = 1
    visuals = []
    labelNudge.clear()
    graphNodes = []
    graphLinks = []
    starVisual.clear()
    hubVisual.clear()
    coreVisual.clear()
    // A fresh drawing opens on the layout in state, without a morph.
    morph = morphTarget(state.layout)
    meaningMorph = meaningTarget(state.layout)
    weights = layoutWeights(morph, meaningMorph)
    meaningCache = null
    shownDays = timelineDays(g, state.range)
    placeDirty = true
    const layout = g.layout
    layout.cores.forEach((core, i) => addCore(g, core, i))
    layout.hubs.forEach((hub, i) => addHub(g, hub, i))
    layout.stars.forEach((star, i) => addStar(g, star, i))
    for (const bridge of layout.bridges) graphLinks.push({ source: `h:${bridge.a}`, target: `h:${bridge.b}`, kind: 'bridge', owner: '' })
    claudeVisual = addVisual('claude', [0, 0, 0], 0, { kind: 'claude', key: '', owner: '', sprite: makeSprite('glow', CLAUDE_COLOUR), size: CLAUDE_SIZE, ...labelFor('Claude', 16.8, '#FFFFFF', 18) })
    // Meaning: one label per cluster, and the "Not embedded" ring's own, each a label with no star; they show only in Meaning.
    if (g.meaning) {
      meaningClusters(g).forEach((cluster, i) => addVisual(`m:${cluster.name}`, cluster.centre, i, { kind: 'cluster', key: cluster.name, owner: '', sprite: null, size: 0, ...labelFor(cluster.name, 14, '#E8EEF4', 0) }))
      const ring = meaningPlaces(g).ring
      if (ring.ids.length > 0) addVisual('m:ring', ring.labelAt, 0, { kind: 'cluster', key: '', owner: '', sprite: null, size: 0, ...labelFor(ringLabel(ring.ids.length), 12.6, '#A9B8C8', 0) })
    }
    // One hidden node the library draws as its default sphere: that mesh is where the starfield's classes come from.
    graphNodes.push({ id: 'probe', vi: -1, fx: 0, fy: 0, fz: 0 })

    graph.nodeThreeObject((node: GraphNode) => {
      const v = visuals[Number(node.vi)]
      if (v === undefined || three === null) return null
      const group = new three.Object3D()
      if (v.sprite) group.add(v.sprite)
      const mark = v.kind === 'star' ? knowledgeMarks.get(v.key) : undefined
      if (mark) group.add(mark)
      if (v.label) {
        v.label.position.set(0, v.labelOffset, 0)
        group.add(v.label)
      }
      return group
    })
    setLinkStyle()
    placeVisuals()
    graph.graphData({ nodes: graphNodes, links: graphLinks })
    // The library builds its objects a moment later: the links' look is set, and the starfield made, once they exist.
    setTimeout(afterData, 100)
    setTimeout(afterData, 600)
    recolour()
    retarget()
  }

  /** A new memory joins the drawing: its star, and the topic hub or project core it needs; no other star moves. */
  function growGalaxy(g: Galaxy, index: number) {
    if (graph === null) return
    const layout = g.layout
    layout.cores.forEach((core, i) => {
      if (!coreVisual.has(core.owner)) addCore(g, core, i)
    })
    layout.hubs.forEach((hub, i) => {
      if (!hubVisual.has(hub.key)) addHub(g, hub, i)
    })
    // Lanes are spaced by the project count: a new project moves every lane.
    placeDirty = true
    lanesCache = null
    linksDirty = true
    const star = layout.stars[index]
    if (star) addStar(g, star, index)
    placeVisuals()
    graph.graphData({ nodes: graphNodes, links: graphLinks })
    setTimeout(afterData, 100)
    recolour()
    retarget()
  }

  // The links' look depends on the state: a fresh accessor makes the library read it again.
  function setLinkStyle() {
    if (graph === null) return
    linksDirty = true
    const g = galaxy
    const hidden = (owner: string) => state.hidden.has(owner)
    const ends = (link: Any) => {
      const source = typeof link.source === 'object' ? (link.source as GraphNode) : null
      const target = typeof link.target === 'object' ? (link.target as GraphNode) : null
      return [source, target]
    }
    const hubOwner = (node: GraphNode | null | undefined) => {
      const v = node == null ? undefined : visuals[Number(node.vi)]
      return v?.owner ?? ''
    }
    const l = graph as unknown as Loose
    l.linkOpacity?.(1)
    l.linkWidth?.(0)
    l.linkColor?.((link: Any) => {
      if (link.kind === 'bridge') return rgba(BRIDGE_COLOUR, state.bridges ? BRIDGE_OPACITY : 0)
      const colour = g === null ? '#FFFFFF' : projectColour(g, String(link.owner))
      return rgba(colour, state.spokes && !hidden(String(link.owner)) ? threadOpacity(state.project !== null) : 0)
    })
    l.linkVisibility?.((link: Any) => {
      if (link.kind !== 'bridge') return state.spokes && !hidden(String(link.owner)) && !(link.star !== undefined && g?.gone.has(String(link.star)))
      const [a, b] = ends(link)
      return state.bridges && !hidden(hubOwner(a)) && !hidden(hubOwner(b))
    })
    l.linkCurvature?.((link: Any) => (link.kind === 'bridge' ? 0.3 : 0))
    l.linkDirectionalParticles?.((link: Any) => (link.kind === 'bridge' ? BRIDGE_PARTICLES : 0))
    l.linkDirectionalParticleWidth?.(1.6)
    l.linkDirectionalParticleSpeed?.(0.003)
    l.linkDirectionalParticleColor?.(() => BRIDGE_COLOUR)
  }

  // After the library has made the link lines: they are additive and write no depth, like the mockup's.
  function afterData() {
    if (graph === null) return
    const scene = (graph as unknown as Loose).scene?.() as Any
    if (!scene) return
    // The library has made its link lines by now: the fade is written to them again.
    linksDirty = true
    let mesh: Any = null
    scene.traverse((object: Any) => {
      if (object.isLine && object.material) {
        object.material.blending = ADDITIVE
        object.material.depthWrite = false
        // The library's own Line and its material class make the moons' lines too (the bundle exports neither).
        if (lineClasses === null && typeof object.constructor === 'function' && typeof object.material.constructor === 'function') lineClasses = { Line: object.constructor, Material: object.material.constructor }
      }
      if (mesh === null && object.isMesh && object.geometry && object.material) mesh = object
    })
    sceneChecks++
    if (!starfieldMade && mesh !== null) addStarfield(scene, mesh)
  }

  // The 2400 background stars: one mesh of tiny triangles facing the centre, made with the Mesh class of a node the library drew.
  function addStarfield(scene: Any, probeMesh: Any) {
    const T = three
    if (T === null || lib === null) return
    starfieldMade = true
    try {
      const points = starfield(STARFIELD_COUNT)
      const out = new Float32Array(STARFIELD_COUNT * 9)
      const s = 2.6
      for (let i = 0; i < STARFIELD_COUNT; i++) {
        const p: Vec3 = [points[i * 3]!, points[i * 3 + 1]!, points[i * 3 + 2]!]
        const r = Math.hypot(...p) || 1
        // Two directions across the view of the star from the centre.
        let t1: Vec3 = [p[2], 0, -p[0]]
        let n = Math.hypot(...t1)
        if (n < 1e-6) t1 = [1, 0, 0]
        else t1 = [t1[0] / n, 0, t1[2] / n]
        const t2: Vec3 = [(p[1] * t1[2] - p[2] * t1[1]) / r, (p[2] * t1[0] - p[0] * t1[2]) / r, (p[0] * t1[1] - p[1] * t1[0]) / r]
        n = Math.hypot(...t2) || 1
        const corners = [
          [t1[0] * s, t1[1] * s, t1[2] * s],
          [-t1[0] * s * 0.5 + (t2[0] / n) * s * 0.866, -t1[1] * s * 0.5 + (t2[1] / n) * s * 0.866, -t1[2] * s * 0.5 + (t2[2] / n) * s * 0.866],
          [-t1[0] * s * 0.5 - (t2[0] / n) * s * 0.866, -t1[1] * s * 0.5 - (t2[1] / n) * s * 0.866, -t1[2] * s * 0.5 - (t2[2] / n) * s * 0.866],
        ]
        corners.forEach((c, j) => out.set([p[0] + c[0]!, p[1] + c[1]!, p[2] + c[2]!], i * 9 + j * 3))
      }
      const geometry = new T.BufferGeometry()
      geometry.setAttribute('position', new T.BufferAttribute(out, 3))
      const Material = (bloomPassBasic ?? probeMesh.material.constructor) as new (params: Record<string, unknown>) => Any
      const material = new Material({ color: 0x8fa3b8, transparent: true, opacity: 0.55, depthWrite: false, side: 2 })
      const Mesh = probeMesh.constructor as new (g: Any, m: Any) => Any
      const stars = new Mesh(geometry, material)
      stars.frustumCulled = false
      scene.add(stars)
    } catch {
      // the map is just as usable without its background stars
    }
  }
  let bloomPassBasic: (new (params: Record<string, unknown>) => Any) | null = null

  function recolour() {
    if (galaxy === null) return
    galaxy.layout.stars.forEach((star, i) => {
      const v = starVisual.get(star.id)
      if (v?.sprite) {
        const [r, g, b] = rgb01(starColour(galaxy!, i, state.colourBy))
        v.sprite.material.color.setRGB(r, g, b)
      }
    })
  }

  // The opacity every thing settles at, from the state; the frame eases toward it.
  function retarget() {
    if (galaxy === null) return
    const g = galaxy
    g.layout.stars.forEach((star, i) => {
      const v = starVisual.get(star.id)
      if (v) v.target = starTarget(g, i, state, found)
    })
    for (const [owner, v] of coreVisual) {
      v.target = coreTarget(state, owner)
      v.labelTarget = v.target * 0.95
    }
    for (const [key, v] of hubVisual) {
      v.target = hubTarget(state, v.owner, key)
      v.labelTarget = hubLabelTarget(state, v.owner)
    }
    for (const v of visuals) if (v.kind === 'cluster') v.labelTarget = 0.9
    const claude = visuals.find(v => v.kind === 'claude')
    if (claude) {
      claude.target = 0.9
      claude.labelTarget = 0.85
    }
  }

  /** The state, read once per frame: a change redraws what depends on it. */
  function syncSettings() {
    if (seen === state || galaxy === null) return
    const before = seen
    seen = state
    if (before === null || before.colourBy !== state.colourBy) recolour()
    if (before === null || before.spokes !== state.spokes || before.bridges !== state.bridges || before.hidden !== state.hidden || (before.project === null) !== (state.project === null)) {
      setLinkStyle()
      setTimeout(afterData, 100)
    }
    retarget()
    if (before !== null && before.layout !== state.layout) {
      // Timeline: a straight-on view of the axis (auto-rotate was paused by the state change). Leaving it: the Galaxy view.
      const flightKind = layoutFlight(before.layout, state.layout)
      if (flightKind === 'timeline') flyToPose(TIMELINE_POSE)
      else if (flightKind === 'galaxy') fly(flightTo(galaxy, 'reset'))
    }
    const controls = graph?.controls()
    if (controls) controls.autoRotate = state.rotating && shown
  }

  // ---- Timeline: places, links, furniture ----

  /** Every visual at its place for the morph and the days showing: its Galaxy place blended toward its Timeline place. The library is re-armed only when something moved. */
  function placeVisuals() {
    const g = galaxy
    if (g === null) return
    const blend = morphBlend(morph)
    weights = layoutWeights(morph, meaningMorph)
    let places: TimelinePlaces | null = null
    if (blend > 0) {
      const made = placesFor(placesCache, g, shownDays, placeDirty)
      placesCache = made.cache
      places = made.places
    }
    // Meaning's places are made once per galaxy (and again when a star arrives or goes), only while some Meaning is blended in.
    let meaningAt: MeaningPlaces | null = null
    if (weights.meaning > 0) {
      if (meaningCache === null || meaningCache.galaxy !== g || placeDirty) meaningCache = { galaxy: g, places: meaningPlaces(g) }
      meaningAt = meaningCache.places
    }
    let moved = false
    for (const v of visuals) {
      const timelineAt = places === null ? null : awayPlace(places, v.kind, v.slot)
      const next = meaningAt === null ? visualPlace(v.home, timelineAt, blend) : layoutPlace(v.home, meaningAway(meaningAt, v.kind, v.slot), timelineAt, weights)
      if (!samePlace(next, v.position)) moved = true
      v.position = next
      const node = v.node as Any
      node.x = node.fx = next[0]
      node.y = node.fy = next[1]
      node.z = node.fz = next[2]
    }
    placeDirty = false
    if (moved) moves++
    // The library copies node places to its objects and links only while its engine counts as running (cooldownTicks is 0): this arms one pass, with no d3 tick, so the move shows.
    if (moved) loose().d3ReheatSimulation?.()
  }

  /** Per frame: the morph and the range move toward where the state points, and the visuals follow when they have to. */
  function stepLayout(dt: number, g: Galaxy) {
    const step = layoutStep(morph, shownDays, state.layout, timelineDays(g, state.range), dt, state.reducedMotion, placeDirty)
    morph = step.morph
    shownDays = step.days
    // Meaning's weight moves the same way, at the same speed.
    const meaningNext = meaningStep(meaningMorph, state.layout, dt, state.reducedMotion)
    const meaningMoved = meaningNext !== meaningMorph
    meaningMorph = meaningNext
    weights = layoutWeights(morph, meaningMorph)
    if (step.place || meaningMoved) placeVisuals()
  }

  /** The cyan links between neighbours: one line object drawn as segments, its pairs chosen again only when what they depend on changed, its points written only when a star moved. */
  function updateSimilar(g: Galaxy) {
    const opacity = g.meaning ? similarOpacity(state, weights.meaning) : 0
    let changed = false
    if (opacity <= 0) {
      if (similarShown.length > 0) changed = true
      similarShown = []
      similarKey = []
    } else {
      const key: unknown[] = [g, state.similar, state.layout, state.selected, state.hidden, g.gone.size, shownDays, weights.meaning > SIMILAR_MEANING_MIN]
      if (key.some((value, i) => value !== similarKey[i])) {
        similarKey = key
        similarShown = similarPairs(g, state, shownDays, weights.meaning)
        changed = true
      }
    }
    if (similarShown.length === 0 && similarLines === null) return
    if (similarShown.length > similarCapacity && !makeSimilarLines(Math.max(64, similarShown.length * 2))) return
    if (similarLines === null) return
    if (changed || similarMoves !== moves) {
      similarMoves = moves
      const array = similarLines.geometry.attributes.position.array as Float32Array
      let n = 0
      for (const pair of similarShown) {
        const a = starVisual.get(pair.from)
        const b = starVisual.get(pair.to)
        if (a === undefined || b === undefined) continue
        array.set(a.position, n * 6)
        array.set(b.position, n * 6 + 3)
        n++
      }
      similarLines.geometry.setDrawRange(0, n * 2)
      similarLines.geometry.attributes.position.needsUpdate = true
      similarLines.userData.segments = n
    }
    similarLines.material.opacity = opacity
    similarLines.visible = opacity > 0.003 && (similarLines.userData.segments ?? 0) > 0
  }

  /** The links' line object, made once the library has drawn a line to copy the class from; false while there is none. */
  function makeSimilarLines(segments: number): boolean {
    const scene = (graph as unknown as Loose | null)?.scene?.() as Any
    const T = three
    if (!scene || T === null || lineClasses === null) return false
    releaseParts(similarLines)
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(segments * 6), 3))
    const line = new lineClasses.Line(geometry, new lineClasses.Material({ color: Number.parseInt(SIMILAR_COLOUR.slice(1), 16), transparent: true, opacity: 0, depthWrite: false, blending: ADDITIVE }))
    // The library's Line is one strip; flagged as segments the renderer draws each pair as its own line, as LineSegments does.
    line.isLineSegments = true
    line.frustumCulled = false
    line.visible = false
    scene.add(line)
    similarLines = line
    similarCapacity = segments
    similarKey = []
    similarMoves = -1
    return true
  }

  /** Threads, bridges and their particles fade with the topic hubs: each link's own line material (cloned once) carries the fade. */
  function fadeLinks(wanted: number) {
    const fade = linkFadeToApply(wanted, linkFade, linksDirty)
    if (fade === null) return
    linkFade = fade
    linksDirty = false
    for (const link of graphLinks as Any[]) {
      const line = link.__lineObj
      if (line?.material) {
        if (!line.material.userData.timeFade) {
          const own = line.material.clone()
          own.userData.timeFade = { base: line.material.opacity }
          own.transparent = true
          line.material = own
        }
        line.material.opacity = line.material.userData.timeFade.base * fade
      }
      if (line) line.visible = fade > 0.01
      const photons = link.__photonsObj
      if (photons) {
        photons.visible = fade > 0.01
        for (const particle of photons.children) particle.scale.setScalar(Math.max(fade, 0.001))
      }
    }
  }

  function makeFurnitureLine(colour: string) {
    const scene = (graph as unknown as Loose | null)?.scene?.() as Any
    const T = three
    if (!scene || T === null || lineClasses === null) return null
    const geometry = new T.BufferGeometry()
    geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3))
    const line = new lineClasses.Line(geometry, new lineClasses.Material({ color: Number.parseInt(colour.slice(1), 16), transparent: true, opacity: 0, depthWrite: false, blending: ADDITIVE }))
    line.frustumCulled = false
    line.visible = false
    scene.add(line)
    return line
  }

  function setLine(line: Any, a: Vec3, b: Vec3, opacity: number) {
    const array = line.geometry.attributes.position.array as Float32Array
    array.set(a, 0)
    array.set(b, 3)
    line.geometry.attributes.position.needsUpdate = true
    line.material.opacity = opacity
    line.visible = opacity > 0.003
  }

  /** Takes furniture parts out of the scene and frees what they hold. */
  function releaseParts(...parts: (Any | null)[]) {
    for (const part of parts) {
      part?.parent?.remove(part)
      part?.material?.map?.dispose?.()
      part?.geometry?.dispose?.()
      part?.material?.dispose?.()
    }
  }

  function disposeLanes() {
    for (const { line } of laneItems.values()) releaseParts(line)
    laneItems = new Map()
    lanesCache = null
  }

  function disposeTicks() {
    for (const { label, line } of tickItems.values()) releaseParts(label, line)
    tickItems.clear()
  }

  /** The axis: a tick label with a faint gridline each (ticks() of the range), and a faint baseline per lane in its project colour; all fade in with the morph. At blend 0, with everything faded, a frame does nothing. */
  function updateFurniture(blend: number, follow: number, g: Galaxy) {
    if (furnitureIdle(blend, tickItems.size, laneItems.values())) return
    const scene = (graph as unknown as Loose | null)?.scene?.() as Any
    if (!scene || three === null) return
    const wanted = wantedTicks(state.range, timelineDays(g, state.range), blend)
    for (const tick of wanted) {
      if (!tickItems.has(tick.days)) {
        // Tick text is made by ticks() from numbers; it is drawn on a canvas, never as markup.
        const label = makeLabel(tick.label, TICK_LABEL_HEIGHT, TICK_LABEL_COLOUR)
        if (label !== null) scene.add(label)
        tickItems.set(tick.days, { label, line: null, alpha: 0 })
      }
    }
    for (const [days, item] of tickItems) {
      const isWanted = tickWanted(wanted, days)
      item.alpha = easeToward(item.alpha, tickTarget(isWanted, blend), follow)
      if (needsGridLine(item.line !== null, item.alpha)) item.line = makeFurnitureLine(GRID_COLOUR)
      const x = tickX(days, shownDays)
      if (item.label) {
        item.label.position.set(x, TICK_LABEL_Y, 0)
        item.label.material.opacity = item.alpha
        item.label.visible = item.alpha > 0.003
      }
      if (item.line) {
        const [a, b] = gridLine(x)
        setLine(item.line, a, b, gridOpacity(item.alpha))
      }
      // A tick of a range no longer showing is let go once it has faded out.
      if (tickReleased(isWanted, item.alpha)) {
        releaseParts(item.label, item.line)
        tickItems.delete(days)
      }
    }
    lanesCache ??= laneLines(g)
    for (const lane of lanesCache) {
      let item = laneItems.get(lane.owner)
      if (item === undefined && blend > 0) {
        const line = makeFurnitureLine(lane.colour)
        if (line === null) continue
        item = { line, alpha: 0 }
        laneItems.set(lane.owner, item)
      }
      if (item === undefined) continue
      item.alpha = easeToward(item.alpha, laneTarget(blend, state.hidden.has(lane.owner)), follow)
      setLine(item.line, lane.from, lane.to, item.alpha)
    }
  }

  // ---- Label de-overlap ----

  const LABEL_EVERY = 6
  let labelFrames = 0
  // Per visual index: the world-space lift a label is nudged by to clear another label, and where it is now.
  const labelNudge = new Map<number, { target: number; now: number }>()

  /** A label's own height above its visual, before any nudge. */
  const labelBaseY = (v: Visual, g: Galaxy, blend: number) => (v.kind === 'core' ? coreLabelOffset(v.labelOffset, g.layout.cores.length, blend) : v.labelOffset)

  /** Projects every shown label to a screen rectangle, lets separateLabels move the lower-ranked apart, and stores the nudge in world units. */
  function separateScreenLabels(g: Galaxy, blend: number, cam: Vec3, fov: number) {
    const l = graph as unknown as Loose
    const camera = l.camera?.() as Any
    if (!camera || !l.graph2ScreenCoords) return
    camera.updateMatrixWorld?.()
    const view: number[] = camera.matrixWorldInverse.elements
    const rects: LabelRect[] = []
    const shownVisuals: { v: Visual; scale: number }[] = []
    for (const v of visuals) {
      if (!v.label || v.labelAlpha * v.fade < 0.1) continue
      if (view[2]! * v.position[0] + view[6]! * v.position[1] + view[10]! * v.position[2] + view[14]! >= 0) continue
      const base = labelBaseY(v, g, blend)
      const distance = Math.hypot(v.position[0] - cam[0], v.position[1] + base - cam[1], v.position[2] - cam[2])
      const k = labelScale(distance)
      const perUnit = pixelsPerUnit(canvasBox.clientHeight, fov, distance)
      const w = v.labelBase[0] * k * perUnit
      const h = v.labelBase[1] * k * perUnit
      const at = l.graph2ScreenCoords(v.position[0], v.position[1] + base, v.position[2]) as { x: number; y: number }
      rects.push({ x: at.x - w / 2, y: at.y - h / 2, w, h, rank: v.kind === 'claude' ? 3 : v.kind === 'core' ? 2 : 1 })
      shownVisuals.push({ v, scale: perUnit })
    }
    const apart = separateLabels(rects)
    const seen = new Set<number>()
    apart.forEach((rect, i) => {
      const { v, scale } = shownVisuals[i]!
      seen.add(v.index)
      // Screen y grows downward, world y upward.
      const target = -(rect.y - rects[i]!.y) / scale
      const nudge = labelNudge.get(v.index)
      if (nudge === undefined) {
        if (target !== 0) labelNudge.set(v.index, { target, now: 0 })
      } else nudge.target = target
    })
    // A label that is not shown (or no longer clashes) eases back to its own place.
    for (const [index, nudge] of labelNudge) if (!seen.has(index)) nudge.target = 0
  }

  // ---- Per frame ----

  function frame(now: number) {
    // A hidden map asks for no more frames; visible(true) starts the loop again.
    raf = shown ? requestAnimationFrame(frame) : 0
    const dt = Math.min(0.05, (now - lastFrame) / 1000)
    lastFrame = now
    clock += dt
    if (graph === null || galaxy === null || !shown) return
    syncSettings()
    stepLayout(dt, galaxy)
    stepFlight(dt)
    const blend = morphBlend(morph)
    // Hubs, threads and bridges leave in Timeline and in Meaning alike: what is left of the Galaxy weight.
    const galaxyFade = weights.galaxy
    fadeLinks(linkFadeAt(1 - weights.galaxy))
    updateSimilar(galaxy)
    updateFurniture(blend, state.reducedMotion ? 1 : Math.min(1, dt * 5), galaxy)
    const camera = (graph as unknown as Loose).camera?.() as Any
    const cam: Vec3 = camera ? [camera.position.x, camera.position.y, camera.position.z] : HOME
    const follow = Math.min(1, dt * 5)
    const selectedKey = state.selected
    for (const spark of stepSparks(sparkPool, dt)) arrive(spark)
    updateMoons(follow, cam, (camera?.fov as number | undefined) ?? 40)
    for (const v of visuals) {
      v.fade = visualFade(v.kind, galaxyFade, weights.meaning)
      v.alpha += (v.target - v.alpha) * follow
      v.labelAlpha += (v.labelTarget - v.labelAlpha) * follow
      v.pulse = v.kind === 'star' && v.key === selectedKey ? selectedPulse(clock) : v.kind === 'core' || v.kind === 'claude' ? 0.1 + 0.07 * Math.sin(clock * 1.5 + v.index) : v.pulse * Math.exp(-dt * 2.2)
      if (v.sprite) {
        const scale = visualScale(v.kind, v.size, blend, v.pulse)
        v.sprite.scale.set(scale, scale, 1)
        v.sprite.material.opacity = Math.min(1, v.alpha) * v.fade
        const mark = v.kind === 'star' ? knowledgeMarks.get(v.key) : undefined
        if (mark) {
          mark.scale.set(scale * KNOWLEDGE_MARK_SCALE, scale * KNOWLEDGE_MARK_SCALE, 1)
          mark.material.opacity = knowledgeMarked(galaxy, state, v.key) ? KNOWLEDGE_MARK_OPACITY * Math.min(1, v.alpha) * v.fade : 0
        }
      }
      if (v.label) {
        const base = labelBaseY(v, galaxy, blend)
        const nudge = labelNudge.get(v.index)
        if (nudge !== undefined) nudge.now = easeToward(nudge.now, nudge.target, follow)
        v.label.position.y = base + (nudge?.now ?? 0)
        const k = labelScale(Math.hypot(v.position[0] - cam[0], v.position[1] + base - cam[1], v.position[2] - cam[2]))
        v.label.scale.set(v.labelBase[0] * k, v.labelBase[1] * k, 1)
        v.label.material.opacity = Math.min(1, v.labelAlpha) * v.fade
      }
    }
    // The labels' clashes are worked out every few frames, from their un-nudged places; the nudges ease in per frame above.
    if (++labelFrames % LABEL_EVERY === 0) separateScreenLabels(galaxy, blend, cam, (camera?.fov as number | undefined) ?? 40)
    sparkPool.active.forEach((spark, i) => {
      const sprite = sparkSprites[i]
      if (!sprite) return
      const to = spark ? targetOf(spark) : undefined
      if (!spark || !to || spark.age < spark.delay) {
        sprite.material.opacity = 0
        return
      }
      const at = sparkAt(sparkOrigin(claudeVisual?.position), to.position, spark.curve, sparkProgress(spark))
      const [r, g, b] = SPARK_COLOURS[spark.kind]
      sprite.position.set(at[0], at[1], at[2])
      sprite.material.color.setRGB(r, g, b)
      sprite.material.opacity = sparkAlpha(spark)
    })
    if (needsHover(pointer.moved, pointer.inside, moonSpots.length > 0)) {
      pointer.moved = false
      hover()
    }
  }

  // ---- Live: events become sparks, pulses and changes to the galaxy ----

  const BADGE_CLASS = { recall: 'a-recall', save: 'a-remember', update: 'a-update', forget: 'a-forget' } as const

  const targetOf = (spark: Spark): Visual | undefined => (spark.toKind === 'star' ? starVisual.get(spark.to) : hubVisual.get(spark.to))

  /** The spark pool: our own glow sprites in the library's scene, not links. */
  function makeSparkSprites() {
    const scene = (graph as unknown as Loose | null)?.scene?.() as Any
    if (!scene || three === null) return
    sparkSprites = sparkPool.active.map(() => {
      const sprite = makeSprite('glow', '#FFFFFF')
      if (sprite === null) return null
      sprite.scale.set(9, 9, 1)
      scene.add(sprite)
      return sprite
    })
  }

  // ---- Knowledge moons: the selected star's knowledge rows, orbiting it ----

  /** Eight glow sprites and eight label sprites in the library's scene, one per possible moon; each frame shows as many as the selected star has. */
  function makeMoonSprites() {
    const scene = (graph as unknown as Loose | null)?.scene?.() as Any
    const T = three
    if (!scene || T === null) return
    moonSprites = Array.from({ length: MOON_LIMIT }, () => {
      const sprite = makeSprite('glow', '#FFFFFF')
      if (sprite === null) return null
      sprite.scale.set(moonSize(false), moonSize(false), 1)
      // Normal blending, drawn after the stars and their bloom: a moon keeps its colour over a white glow.
      sprite.material.blending = NORMAL
      sprite.material.depthTest = false
      sprite.renderOrder = MOON_RENDER_ORDER.sprite
      scene.add(sprite)
      return sprite
    })
    // The labels get their texture from the per-kind cache (setMoonLabels); until then they are invisible.
    moonLabels = Array.from({ length: MOON_LIMIT }, () => {
      const label = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, opacity: 0 }))
      label.renderOrder = MOON_RENDER_ORDER.label
      scene.add(label)
      return label
    })
  }

  /** The thin lines, once the library has drawn its own (their classes are where ours come from); says so once when it never does. */
  function makeMoonLines(shown: boolean) {
    const scene = (graph as unknown as Loose | null)?.scene?.() as Any
    const T = three
    if (!scene || T === null || moonLines.length > 0) return
    if (lineClasses === null) {
      const problem = moonLinesProblem(false, sceneChecks, shown)
      if (problem !== null && !moonLinesTold) {
        moonLinesTold = true
        host.status(problem, 'error')
      }
      return
    }
    const { Line, Material } = lineClasses
    moonLines = Array.from({ length: MOON_LIMIT }, () => {
      const geometry = new T.BufferGeometry()
      geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3))
      const line = new Line(geometry, new Material({ color: Number.parseInt(MOON_LINE_COLOUR.slice(1), 16), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: ADDITIVE }))
      line.frustumCulled = false
      line.visible = false
      line.renderOrder = MOON_RENDER_ORDER.line
      scene.add(line)
      return line
    })
  }

  /** The look of the label of a kind: its texture and size, made once (five kinds in all) and shared by every moon of that kind. */
  function moonLabelLook(kind: KnowledgeKind) {
    let look = moonLabelStyle.get(kind)
    if (look === undefined) {
      const source = makeLabel(kind, 4.4, moonColour(kind))
      if (source === null) return null
      look = { map: source.material.map, scale: [source.scale.x, source.scale.y] }
      moonLabelStyle.set(kind, look)
    }
    return look
  }

  /** When the selected star or its moons change: each label sprite takes the cached look of its moon's kind (no new texture). */
  function setMoonLabels(rows: readonly { kind: KnowledgeKind }[], key: string) {
    moonKey = key
    rows.forEach((row, i) => {
      const label = moonLabels[i]
      const look = label ? moonLabelLook(row.kind) : null
      if (!label || look === null) return
      label.material.map = look.map
      label.material.needsUpdate = true
      label.scale.set(look.scale[0], look.scale[1], 1)
    })
  }

  /** The moons' data, recomputed only when the galaxy, the selection, the moons switch, the picked moon or the forgotten set changes. */
  function moonPlanFor(g: Galaxy | null) {
    const gone = g === null ? 0 : g.gone.size
    const p = moonPlan
    if (p !== null && p.galaxy === g && p.selected === state.selected && p.moons === state.moons && p.moon === state.moon && p.gone === gone) return p
    const rows = g === null ? [] : moonRows(g, state)
    moonPlan = {
      galaxy: g,
      selected: state.selected,
      moons: state.moons,
      moon: state.moon,
      gone,
      key: `${state.selected}|${rows.map(row => row.id).join(',')}`,
      rows,
      colours: rows.map(row => rgb01(moonColour(row.kind))),
      picked: g === null ? null : selectedMoon(g, state),
    }
    return moonPlan
  }

  /** Per frame: the moons of the selected star at their orbit places, the lines to the star, the labels and the selected moon's pulse. */
  function updateMoons(follow: number, cam: Vec3, fov: number) {
    const g = galaxy
    const plan = moonPlanFor(g)
    const rows = plan.rows
    const star = state.selected === null ? undefined : starVisual.get(state.selected)
    const key = star === undefined ? '' : plan.key
    if (key !== moonKey) setMoonLabels(star === undefined ? [] : rows, key)
    if (moonLines.length === 0) makeMoonLines(star !== undefined && rows.length > 0)
    moonSpots = []
    moonSprites.forEach((sprite, i) => {
      if (!sprite) return
      const row = star === undefined ? undefined : rows[i]
      const line = moonLines[i]
      const label = moonLabels[i]
      if (row === undefined || star === undefined) {
        sprite.material.opacity += (0 - sprite.material.opacity) * follow
        if (line) line.visible = false
        if (label) label.material.opacity += (0 - label.material.opacity) * follow
        return
      }
      const at = moonPosition(star.position, i, rows.length, clock, state.reducedMotion)
      const chosen = row.id === plan.picked
      const [r, gr, b] = plan.colours[i]!
      sprite.position.set(at[0], at[1], at[2])
      sprite.material.color.setRGB(r, gr, b)
      const size = moonSize(chosen) * (1 + moonPulse(chosen, clock) * 1.6)
      sprite.scale.set(size, size, 1)
      const distance = Math.hypot(at[0] - cam[0], at[1] - cam[1], at[2] - cam[2])
      sprite.material.opacity += (0.95 - sprite.material.opacity) * follow
      if (line) {
        const array = line.geometry.attributes.position.array as Float32Array
        array.set(star.position, 0)
        array.set(at, 3)
        line.geometry.attributes.position.needsUpdate = true
        line.material.opacity = MOON_LINE_OPACITY
        line.visible = true
      }
      if (label) {
        // The label keeps one size on screen as the camera comes close, and alternates rows so neighbours do not overlap.
        const k = moonLabelScale(distance)
        const look = moonLabelLook(row.kind)
        if (look !== null) label.scale.set(look.scale[0] * k, look.scale[1] * k, 1)
        label.position.set(at[0], at[1] + moonLabelLift(i, rows.length, k), at[2])
        label.material.opacity += (0.9 - label.material.opacity) * follow
      }
      // Picked where it is drawn this frame, within the size it is drawn at.
      moonSpots.push({ id: row.id, position: at, sprite, radius: moonPickRadius(size, pixelsPerUnit(canvasBox.clientHeight, fov, distance)) })
    })
  }

  /** A spark lands: the star pulses, and a real event changes the galaxy (a demo one changes nothing). */
  function arrive(spark: Spark) {
    const g = galaxy
    if (g === null) return
    const v = targetOf(spark)
    if (v) v.pulse = Math.max(v.pulse, PULSE[spark.kind])
    if (spark.demo || spark.toKind !== 'star') return
    const id = spark.to
    const star = g.layout.stars[slotOf(g.layout.starById, id)]
    if (star === undefined) return
    if (spark.kind === 'recall') {
      const was = star.recalls
      if (!recallMemory(g, id)) return
      if (v) {
        v.size = starSize(star.recalls)
        // A star that was a hollow ring becomes a glow with its first recall.
        if (was === 0 && v.sprite && glowTexture.glow) {
          v.sprite.material.map = glowTexture.glow
          v.sprite.material.needsUpdate = true
        }
      }
      recolour()
      render()
    } else if (spark.kind === 'update') {
      if (!touchMemory(g, id)) return
      // In Timeline an updated memory jumps to today.
      placeDirty = true
      retarget()
      recolour()
      render()
    } else if (spark.kind === 'forget') {
      if (!forgetMemory(g, id)) return
      if (state.selected === id) dispatch({ ...state, selected: null })
      setLinkStyle()
      retarget()
      render()
    }
  }

  /** Real saves: each new memory is fetched with the existing GET /api/memories/<id>, made a lean row and placed. */
  async function addSaved(g: Galaxy, event: MapEvent) {
    await Promise.all(
      event.ids
        .filter(id => slotOf(g.layout.starById, id) < 0 && !fetching.has(id))
        .map(async id => {
          fetching.add(id)
          try {
            const response = await host.api(`/api/memories/${encodeURIComponent(id)}`)
            if (!response.ok) return
            const row = leanRow(await response.json().catch(() => null))
            if (row === null || row.id !== id) return
            const index = addMemory(g, row)
            if (index < 0) return
            growGalaxy(g, index)
            render()
          } catch {
            // a memory that cannot be fetched stays off the map until the next reload
          } finally {
            fetching.delete(id)
          }
        }),
    )
  }

  async function play(event: MapEvent) {
    const g = galaxy
    if (g === null) return
    if (event.kind === 'save' && event.demo !== true) await addSaved(g, event)
    let targets: { to: string; toKind: 'star' | 'hub' }[]
    if (event.demo && event.kind === 'save') {
      // A demo save has no memory: its spark lands on the topic's hub.
      const key = `${event.owner ?? ''}/${event.topic ?? 'Untagged'}`
      targets = slotOf(g.layout.hubByKey, key) < 0 ? [] : [{ to: key, toKind: 'hub' }]
    } else {
      targets = eventStars(g, event).map(id => ({ to: id, toKind: 'star' as const }))
    }
    // An event whose memories are not on the map draws nothing.
    if (targets.length === 0) return
    strip = pushRow(strip, stripRow(g, event, targets.length))
    renderStrip()
    const sparks = graph !== null && shown && layerOn(state, event.kind) ? sparksFor(event, targets, state.reducedMotion, Math.random) : []
    if (sparks.length === 0) {
      for (const target of targets) arrive({ ...target, kind: event.kind, delay: 0, curve: 0, age: 0, demo: event.demo === true })
      return
    }
    enqueueSparks(sparkPool, sparks)
  }

  // Events play one after another, in the order they came.
  function enqueueEvent(event: MapEvent) {
    chain = chain.then(() => play(event)).catch(() => {})
  }

  /** A layer switched off: its sparks stop at once, and what they carried is applied. */
  function dropLayer(layer: 'recall' | 'write') {
    sparkPool.active.forEach((spark, i) => {
      if (spark && layerOf(spark.kind) === layer) {
        sparkPool.active[i] = null
        arrive(spark)
      }
    })
    const keep: Spark[] = []
    for (const spark of sparkPool.queue) {
      if (layerOf(spark.kind) === layer) arrive(spark)
      else keep.push(spark)
    }
    sparkPool.queue = keep
  }

  function renderStrip() {
    const rows = stripRows(strip, state)
    byId('map-feed').replaceChildren(
      ...(rows.length === 0
        ? [el('li', STRIP_EMPTY_TEXT, 'mini-empty')]
        : rows.map(row => {
            const item = el('li')
            item.append(el('span', row.time, 'mono muted'), el('span', row.badge, `mini-badge ${BADGE_CLASS[row.kind]}`))
            if (row.demo) item.append(el('span', 'demo', 'mini-badge'))
            item.append(el('span', row.text))
            if (row.app !== '') item.append(el('span', row.app, 'muted small'))
            return item
          })),
    )
  }

  function simulateOnce(kind: 'recall' | 'write') {
    if (galaxy === null) return
    const event = simulate(kind, simulationInput(galaxy))
    if (event) enqueueEvent(event)
  }

  // ---- Picking: the star nearest the pointer in screen space ----

  function candidates(): Candidate[] {
    const l = graph as unknown as Loose
    const camera = l.camera?.() as Any
    if (!camera || !l.graph2ScreenCoords) return []
    camera.updateMatrixWorld?.()
    const view: number[] = camera.matrixWorldInverse.elements
    const out: Candidate[] = []
    for (const v of visuals) {
      // A Meaning label is only a label: nothing to pick.
      if (v.kind === 'cluster') continue
      // In front of the camera only.
      if (view[2]! * v.position[0] + view[6]! * v.position[1] + view[10]! * v.position[2] + view[14]! >= 0) continue
      const screen = l.graph2ScreenCoords(v.position[0], v.position[1], v.position[2]) as { x: number; y: number }
      out.push({ kind: v.kind, id: v.key, sx: screen.x, sy: screen.y, radius: PICK_RADIUS[v.kind], alpha: v.alpha * v.fade })
    }
    // The moons of the selected star are picked like stars, in screen space.
    for (const spot of moonSpots) {
      if (view[2]! * spot.position[0] + view[6]! * spot.position[1] + view[10]! * spot.position[2] + view[14]! >= 0) continue
      const screen = l.graph2ScreenCoords(spot.position[0], spot.position[1], spot.position[2]) as { x: number; y: number }
      out.push({ kind: 'moon', id: spot.id, sx: screen.x, sy: screen.y, radius: spot.radius, alpha: spot.sprite.material.opacity })
    }
    return out
  }

  function pick(): Hit | null {
    return pickNearest(candidates(), pointer.x, pointer.y)
  }

  function hover() {
    if (galaxy === null) return
    const hit = pick()
    const id = hit === null ? '' : `${hit.kind}:${hit.id}`
    canvasBox.style.cursor = hit === null ? 'grab' : 'pointer'
    if (id === hovered) {
      if (hit !== null) placeTip(hit.sx, hit.sy)
      return
    }
    hovered = id
    const words = hit === null ? null : tooltip(galaxy, hit)
    if (hit === null || words === null) {
      tip.hidden = true
      tip.replaceChildren()
      return
    }
    tip.replaceChildren(el('strong', words.title, 'tip-title'), el('span', words.sub, 'tip-sub'))
    tip.hidden = false
    placeTip(hit.sx, hit.sy)
  }

  function placeTip(x: number, y: number) {
    tip.style.left = `${Math.round(x + 14)}px`
    tip.style.top = `${Math.round(y + 14)}px`
  }

  function click() {
    const hit = pick()
    // The Claude core has a tooltip but is not a project: nothing to fly to.
    if (hit === null || hit.kind === 'claude') return
    if (hit.kind === 'star') flyToStar(hit.id)
    else if (hit.kind === 'moon') {
      if (galaxy !== null) dispatch(selectMoon(state, galaxy, hit.id))
    }
    else if (hit.kind === 'hub') flyToTopic(hit.id)
    else flyToProject(hit.id)
  }

  // ---- Wiring ----

  for (const button of byId('map-layout').querySelectorAll<HTMLButtonElement>('button[data-layout]')) {
    button.addEventListener('click', () => {
      const layout = button.dataset.layout as LayoutName
      const next = setLayout(state, layout, galaxy?.meaning ?? false)
      if (next !== state) saveLayout(storage, layout)
      dispatch(next)
    })
  }
  for (const button of byId('map-range').querySelectorAll<HTMLButtonElement>('button[data-range]')) {
    button.addEventListener('click', () => {
      const value = button.dataset.range
      dispatch(setRange(state, value === 'all' ? 'all' : value === '7' ? 7 : 30))
    })
  }
  for (const button of byId('map-colour').querySelectorAll<HTMLButtonElement>('button[data-colour]')) {
    button.addEventListener('click', () => dispatch(setColourBy(state, button.dataset.colour as MapState['colourBy'])))
  }
  // Glow control: three buttons built here (index.html has no Glow card), placed after the Colour card.
  {
    const card = el('details', undefined, 'rail-card')
    card.id = 'map-card-glow'
    const title = el('summary', 'Glow', 'rail-title')
    const body = el('div', undefined, 'rail-body')
    const group = el('div', undefined, 'segmented')
    group.id = 'map-glow'
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', 'Glow')
    const names: Record<GlowLevel, string> = { off: 'Off', soft: 'Soft', full: 'Full' }
    const buttons = GLOW_LEVELS.map(level => {
      const button = el('button', names[level], 'seg-btn')
      button.type = 'button'
      button.dataset.glow = level
      group.append(button)
      return button
    })
    const sync = () => {
      for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.glow === glow))
    }
    for (const button of buttons) {
      button.addEventListener('click', () => {
        glow = glowLevel(button.dataset.glow)
        saveGlow(storage, glow)
        applyGlow()
        sync()
      })
    }
    sync()
    body.append(group)
    card.append(title, body)
    byId('map-colour').closest?.('details')?.after?.(card)
  }
  // The rail's cards fold. Each remembers its open state (the same guarded storage as glow and layout); the Topics card is not remembered, it opens when it appears.
  {
    const rail = readRail(storage)
    for (const { name } of RAIL_CARDS) {
      // The Glow card is built above; the other cards are in index.html.
      const card = (name === 'glow' ? document.getElementById('map-card-glow') : byId(`map-card-${name}`)) as HTMLDetailsElement | null
      if (card === null) continue
      card.open = railOpen(rail, name)
      card.addEventListener('toggle', () => {
        rail[name] = card.open
        saveRail(storage, rail)
      })
    }
  }
  byId('map-spokes').addEventListener('change', () => dispatch(toggleSpokes(state)))
  byId('map-bridges').addEventListener('change', () => dispatch(toggleBridges(state)))
  byId('map-moons').addEventListener('change', () => dispatch(toggleMoons(state)))
  byId('map-similar').addEventListener('change', () => dispatch(toggleSimilar(state, galaxy?.meaning ?? false)))
  for (const chip of byId('map-know').querySelectorAll<HTMLButtonElement>('button[data-kind]')) {
    chip.addEventListener('click', () => {
      // A chip is inert until the page holds some knowledge.
      if (galaxy === null || !hasKnowledge(galaxy)) return
      dispatch(toggleKind(state, chip.dataset.kind as KnowledgeKind))
    })
  }
  byId('map-layer-recall').addEventListener('change', () => {
    dispatch(toggleLayer(state, 'recall'))
    if (!state.layerRecall) dropLayer('recall')
  })
  byId('map-layer-write').addEventListener('change', () => {
    dispatch(toggleLayer(state, 'write'))
    if (!state.layerWrite) dropLayer('write')
  })
  rotate.addEventListener('click', () => dispatch(toggleRotation(state)))
  byId('map-reset').addEventListener('click', reset)
  // Simulate a recall / write play demo events: they never call the server and never reach the Activity tab.
  byId<HTMLButtonElement>('map-sim-recall').addEventListener('click', () => simulateOnce('recall'))
  byId<HTMLButtonElement>('map-sim-write').addEventListener('click', () => simulateOnce('write'))
  // The two Simulate buttons hide behind a Demo toggle, closed at the start.
  const demo = byId<HTMLButtonElement>('map-demo')
  demo.addEventListener('click', () => {
    const box = byId('map-demo-box')
    box.hidden = !box.hidden
    demo.setAttribute('aria-expanded', String(!box.hidden))
    demo.textContent = box.hidden ? 'Demo ▾' : 'Demo ▴'
  })
  // The Live pill switches live updates (On / Paused).
  const pill = byId('map-live-state').parentElement
  if (pill) {
    pill.setAttribute('role', 'button')
    pill.setAttribute('tabindex', '0')
    pill.title = LIVE_PILL_TITLE
    pill.style.cursor = 'pointer'
    pill.addEventListener('click', () => dispatch(toggleLive(state)))
    pill.addEventListener('keydown', event => {
      if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
        event.preventDefault()
        dispatch(toggleLive(state))
      }
    })
  }
  find$.addEventListener('input', () => {
    if (!solarPage?.active()) search(find$.value)
  })
  canvasBox.addEventListener('pointerdown', event => {
    // A right or middle press is not a click on a star.
    if (!isPrimary(event)) return
    down = { x: event.clientX, y: event.clientY, t: event.timeStamp }
    flight = null
  })
  canvasBox.addEventListener('pointermove', event => {
    const box = canvasBox.getBoundingClientRect()
    pointer = { x: event.clientX - box.left, y: event.clientY - box.top, moved: true, inside: true }
  })
  canvasBox.addEventListener('pointerleave', () => {
    pointer.moved = false
    pointer.inside = false
    hovered = ''
    tip.hidden = true
    canvasBox.style.cursor = 'grab'
  })
  canvasBox.addEventListener('pointerup', event => {
    const start = down
    down = null
    if (!isPrimary(event) || start === null || !isClick(start, { x: event.clientX, y: event.clientY, t: event.timeStamp })) return
    const box = canvasBox.getBoundingClientRect()
    pointer = { x: event.clientX - box.left, y: event.clientY - box.top, moved: false, inside: true }
    click()
  })

  async function loadGalaxy() {
    try {
      const response = await host.api('/api/galaxy')
      const body = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) throw new Error(body.error ?? `the server answered ${response.status}`)
      const reply = parseGalaxy(body)
      if (reply === null) throw new Error('the reply was not a galaxy')
      galaxy = buildGalaxy(reply)
      failed = false
      if (state.layout === 'meaning' && !galaxy.meaning) state = setLayout(state, 'galaxy', true)
      seen = null
      found = null
      drawGalaxy(galaxy)
      render()
      if (host.events && stopEvents === null) {
        stopEvents = host.events(line => {
          const event = toMapEvent(line)
          if (event !== null) enqueueEvent(event)
        })
      }
      if (pending !== null) {
        const id = pending
        pending = null
        flyToStar(id)
      }
    } catch (err) {
      failed = true
      host.status(`Could not load the map: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  async function start() {
    if (!hasWebGL(() => document.createElement('canvas'))) {
      say('This map needs WebGL, which this browser has turned off or does not offer.')
      return
    }
    try {
      lib = (await import(LIB_URL)) as MapLib
    } catch (err) {
      say(`The map library could not load (${err instanceof Error ? err.message : String(err)}).`)
      return
    }
    try {
      graph = new lib.ForceGraph3D(canvasBox, { controlType: 'orbit' })
      three = threeFrom(lib)
      if (three === null) throw new Error('the 3D classes were not found in the bundle')
      const textures = glowTextures(three)
      glowTexture.glow = textures.glow
      glowTexture.ring = textures.ring
      makeSparkSprites()
      makeMoonSprites()
    } catch (err) {
      graph = null
      say(`The 3D map could not start (${err instanceof Error ? err.message : String(err)}).`)
      return
    }
    const l = graph as unknown as Loose
    graph
      .forceEngine('d3')
      .nodeLabel(NO_TOOLTIP)
      .linkLabel(NO_TOOLTIP)
      .showNavInfo(false)
      .backgroundColor(BACKGROUND)
      .enableNodeDrag(false)
      .cooldownTicks(0)
      .nodeThreeObjectExtend(false)
    // Our own picking reads the sprites in screen space: the library's per-pointer raycast over thousands of objects is off.
    l.enablePointerInteraction?.(false)
    l.nodeVisibility?.((node: GraphNode) => node.id !== 'probe')
    const controls = graph.controls() as Any
    controls.autoRotateSpeed = ROTATE_SPEED
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 40
    controls.maxDistance = 1800
    // Bloom on the library's own composer: its render pass, then bloom, then the output pass.
    let bloom: Any = null
    try {
      const composer = l.postProcessingComposer?.() as Any
      if (!composer) throw new Error('the library has no post-processing composer')
      const settings = bloomFor(glow)
      bloom = new lib.UnrealBloomPass({ x: 512, y: 512 }, settings.strength, settings.radius, settings.threshold)
      bloom.enabled = settings.enabled
      composer.addPass(bloom)
      composer.addPass(new lib.OutputPass())
    } catch (err) {
      bloom = null
      host.status(`The glow effect could not start (${err instanceof Error ? err.message : String(err)}); the map is drawn without it.`, 'error')
    }
    bloomPass = bloom
    if (bloom?.basic && typeof bloom.basic.constructor === 'function') bloomPassBasic = bloom.basic.constructor
    const opening = state.layout === 'timeline' ? TIMELINE_POSE : { position: HOME, target: [0, 0, 0] as Vec3 }
    graph.cameraPosition({ x: opening.position[0], y: opening.position[1], z: opening.position[2] }, { x: opening.target[0], y: opening.target[1], z: opening.target[2] }, 0)
    const fit = () => {
      if (graph === null) return
      const box = stage.getBoundingClientRect()
      graph.width(Math.max(1, Math.floor(box.width))).height(Math.max(1, Math.floor(box.height)))
    }
    fit()
    if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(stage)
    controls.autoRotate = state.rotating && shown
    if (!shown) graph.pauseAnimation()
    lastFrame = performance.now()
    if (shown) raf = requestAnimationFrame(frame)
    if (galaxy !== null) {
      drawGalaxy(galaxy)
      render()
    }
  }

  host.streamStatus?.(status => {
    connected = status === 'live'
    if (galaxy !== null) renderControls(galaxy)
  })
  solarPage?.sync(state.layout)
  void loadGalaxy()
  void start()

  return {
    visible(next: boolean) {
      shown = next
      if (!next && raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      if (next && raf === 0 && graph !== null) {
        lastFrame = performance.now()
        raf = requestAnimationFrame(frame)
      }
      if (graph !== null) {
        if (next) graph.resumeAnimation()
        else graph.pauseAnimation()
        graph.controls().autoRotate = state.rotating && shown
      }
      if (next) {
        lastFrame = performance.now()
        if (failed) void loadGalaxy()
      }
    },
    show(memoryId: string) {
      if (galaxy === null) {
        pending = memoryId
        return
      }
      flyToStar(memoryId)
    },
  }
}
/* biome-ignore-end lint/suspicious/noExplicitAny: three.js classes reached by their prototypes have no types */
