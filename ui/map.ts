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
import type { GalaxyHub, Vec3 } from './map-layout'
import {
  announcement,
  BACKGROUND,
  BLOOM,
  BRIDGE_COLOUR,
  BRIDGE_OPACITY,
  BRIDGE_PARTICLES,
  buildGalaxy,
  CLAUDE_COLOUR,
  CLAUDE_SIZE,
  type Candidate,
  coreSize,
  coreTarget,
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
  isHollow,
  labelScale,
  type LayoutName,
  lerp3,
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
  toggleLayer,
  toggleProject,
  toggleRotation,
  toggleSpokes,
  tooltip,
  topicRows,
  type Hit,
} from './map-state'

type MapLib = typeof import('./vendor/map-lib.js')

/** What the page gives the map: its /api call, a way to open a memory in the Memories view, and the status line. */
export type MapHost = {
  api: (path: string) => Promise<Response>
  openMemory: (id: string) => void
  status: (text: string, kind?: 'ok' | 'error' | 'plain') => void
}

export type MapView = { visible: (shown: boolean) => void; show: (memoryId: string) => void }

// The library's one URL: same origin, served from ui/vendor/ by ui/server.ts.
const LIB_URL = '/vendor/map-lib.js'
const ROTATE_SPEED = 0.35
const HOME: Vec3 = [0, 160, 700]
const ADDITIVE = 2

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
  kind: 'star' | 'hub' | 'core' | 'claude'
  /** The id the state uses: a memory id, a hub key, an owner, or ''. */
  key: string
  owner: string
  sprite: Any
  label: Any | null
  labelBase: [number, number]
  labelOffset: number
  position: Vec3
  size: number
  alpha: number
  target: number
  labelAlpha: number
  labelTarget: number
  pulse: number
  index: number
}

type Loose = Record<string, (...args: Any[]) => Any>

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
  let state: MapState = initialState({ reducedMotion, layout: initialLayout(readLayout(storage), false) })
  let galaxy: Galaxy | null = null
  let found: Found | null = null
  let graph: ForceGraph3DInstance | null = null
  let lib: MapLib | null = null
  let three: Three | null = null
  let shown = true
  let failed = false
  let pending: string | null = null
  let visuals: Visual[] = []
  const starVisual = new Map<string, Visual>()
  const hubVisual = new Map<string, Visual>()
  const coreVisual = new Map<string, Visual>()
  let seen: MapState | null = null
  let raf = 0
  let lastFrame = 0
  let clock = 0
  let flight: { t: number; seconds: number; from: { position: Vec3; target: Vec3 }; to: { position: Vec3; target: Vec3 } } | null = null
  let pointer: { x: number; y: number; moved: boolean } = { x: 0, y: 0, moved: false }
  let down: { x: number; y: number } | null = null
  let hovered = ''
  let starfieldMade = false
  let lastSaid = ''

  const canvasBox = byId('map-canvas')
  const stage = byId('map-stage')
  const message = byId('map-message')
  const tip = byId('map-tip')
  const live = byId('map-live')
  const rotate = byId<HTMLButtonElement>('map-rotate')
  const find$ = byId<HTMLInputElement>('map-find')

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

  // Actions the rail, the path bar, the map and Find all share.
  function flyToProject(owner: string) {
    if (galaxy === null) return
    dispatch(focusProject(state, owner))
    fly(flightTo(galaxy, 'core', owner))
  }
  function flyToTopic(key: string) {
    if (galaxy === null) return
    dispatch(focusTopic(state, galaxy, key))
    fly(flightTo(galaxy, 'hub', key))
  }
  function flyToStar(id: string) {
    if (galaxy === null) return
    dispatch(selectStar(state, galaxy, id))
    fly(flightTo(galaxy, 'star', id))
  }
  function reset() {
    if (galaxy === null) return
    find$.value = ''
    dispatch(resetView(state))
    fly(flightTo(galaxy, 'reset'))
  }
  function search(value: string) {
    if (galaxy === null) return
    dispatch(setQuery(state, value))
    if (found !== null && found.centre !== null && value.trim() !== '') fly({ target: found.centre, distance: found.distance })
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
          if (part.level === 'project' && next.project !== null) fly(flightTo(g, 'core', next.project))
          if (part.level === 'topic' && next.topic !== null) fly(flightTo(g, 'hub', next.topic))
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
            name.dataset.fly = row.owner
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
    box.hidden = state.project === null
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
    if (focusedProject !== undefined) toggles.querySelector<HTMLElement>(`input[data-project="${CSS.escape(focusedProject)}"]`)?.focus()
    if (focusedTopic !== undefined) byId('map-topics').querySelector<HTMLElement>(`button[data-topic="${CSS.escape(focusedTopic)}"]`)?.focus()
  }

  function renderInspector(g: Galaxy) {
    const box = byId('map-inspector')
    const view = inspector(g, state)
    const head = el('div', undefined, 'insp-head')
    const sub = el('span', undefined, 'insp-sub')
    sub.append(dot(view.colour, 'map-dot big'))
    if (view.sub !== '') sub.append(el('span', view.sub))
    head.append(el('span', view.kind, 'insp-kind'), el('h2', view.title, 'insp-title'), sub)
    const parts: HTMLElement[] = [head]
    if (view.memory) {
      const memory = view.memory
      parts.push(el('p', memory.text, 'insp-text'))
      const tags = el('div', undefined, 'tag-list')
      for (const tag of memory.tags) tags.append(el('span', plainLabel(tag, 40), 'tag'))
      if (memory.tags.length === 0) tags.append(el('span', 'No tags yet.', 'muted small'))
      parts.push(tags)
    }
    const stats = el('dl', undefined, 'insp-stats')
    for (const stat of view.stats) {
      const item = el('div')
      item.append(el('dt', stat.label), el('dd', stat.value))
      stats.append(item)
    }
    parts.push(stats)
    for (const [title, section] of [['Knowledge from this memory', view.knowledge], ['Similar memories', view.similar]] as const) {
      if (!section) continue
      const block = el('section', undefined, 'insp-section')
      block.append(el('h3', title, 'insp-section-title'), el('p', section.note, 'insp-note'))
      parts.push(block)
    }
    if (view.memory) {
      const open = el('button', 'Open in Memories', 'btn insp-open')
      open.type = 'button'
      const id = view.memory.id
      open.addEventListener('click', () => host.openMemory(id))
      parts.push(open)
    }
    if (view.hint) parts.push(el('p', view.hint, 'insp-hint'))
    box.replaceChildren(...parts)
  }

  function renderControls(g: Galaxy) {
    for (const button of byId('map-layout').querySelectorAll<HTMLButtonElement>('button[data-layout]')) {
      button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout))
      if (button.dataset.layout === 'meaning') button.disabled = !g.meaning
    }
    byId('map-range-box').hidden = state.layout !== 'timeline'
    for (const button of byId('map-range').querySelectorAll<HTMLButtonElement>('button[data-range]')) button.setAttribute('aria-pressed', String(button.dataset.range === String(state.range)))
    for (const button of byId('map-colour').querySelectorAll<HTMLButtonElement>('button[data-colour]')) button.setAttribute('aria-pressed', String(button.dataset.colour === state.colourBy))
    byId<HTMLInputElement>('map-spokes').checked = state.spokes
    byId<HTMLInputElement>('map-bridges').checked = state.bridges
    byId<HTMLInputElement>('map-layer-recall').checked = state.layerRecall
    byId<HTMLInputElement>('map-layer-write').checked = state.layerWrite
    rotate.setAttribute('aria-pressed', String(state.rotating))
    byId('map-found').textContent = found === null ? '' : foundText(state.query, found)
    byId('map-live-state').textContent = state.live ? 'On' : 'Paused'
    byId('map-live-state').parentElement?.classList.toggle('is-on', state.live)
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

  /** The graph data and a visual per node for a galaxy; threads and bridges are the library's links. */
  function drawGalaxy(g: Galaxy) {
    if (graph === null || lib === null || three === null) return
    visuals = []
    starVisual.clear()
    hubVisual.clear()
    coreVisual.clear()
    const layout = g.layout
    const nodes: GraphNode[] = []
    const links: { source: string; target: string; kind: 'spoke' | 'bridge'; owner: string }[] = []
    const add = (id: string, position: Vec3, visual: Omit<Visual, 'position' | 'index' | 'alpha' | 'target' | 'labelAlpha' | 'labelTarget' | 'pulse'>) => {
      const v: Visual = { ...visual, position, index: visuals.length, alpha: 0, target: 0, labelAlpha: 0, labelTarget: 0, pulse: 0 }
      visuals.push(v)
      nodes.push({ id, vi: v.index, fx: position[0], fy: position[1], fz: position[2] })
      return v
    }
    const label = (text: string, height: number, colour: string, offset: number) => {
      const sprite = makeLabel(text, height, colour)
      return { label: sprite, labelBase: (sprite ? [sprite.scale.x, sprite.scale.y] : [1, 1]) as [number, number], labelOffset: offset }
    }
    layout.cores.forEach(core => {
      const v = add(`c:${core.owner}`, core.position, { kind: 'core', key: core.owner, owner: core.owner, sprite: makeSprite('glow', projectColour(g, core.owner)), size: coreSize(core.count), ...label(core.label, 16.8, '#E8EEF4', core.radius * 0.55 + 14) })
      coreVisual.set(core.owner, v)
    })
    layout.hubs.forEach((hub: GalaxyHub) => {
      const v = add(`h:${hub.key}`, hub.position, { kind: 'hub', key: hub.key, owner: hub.project, sprite: makeSprite('glow', hubColour(projectColour(g, hub.project))), size: HUB_SIZE, ...label(hub.name, 12.6, '#C4D0DC', 9) })
      hubVisual.set(hub.key, v)
      links.push({ source: `c:${hub.project}`, target: `h:${hub.key}`, kind: 'spoke', owner: hub.project })
    })
    layout.stars.forEach((star, i) => {
      const colour = starColour(g, i, state.colourBy)
      const v = add(`s:${star.id}`, star.position, { kind: 'star', key: star.id, owner: star.owner, sprite: makeSprite(isHollow(star.recalls) ? 'ring' : 'glow', colour), size: starSize(star.recalls), label: null, labelBase: [1, 1], labelOffset: 0 })
      starVisual.set(star.id, v)
      links.push({ source: `h:${star.topic}`, target: `s:${star.id}`, kind: 'spoke', owner: star.owner })
    })
    for (const bridge of layout.bridges) links.push({ source: `h:${bridge.a}`, target: `h:${bridge.b}`, kind: 'bridge', owner: '' })
    add('claude', [0, 0, 0], { kind: 'claude', key: '', owner: '', sprite: makeSprite('glow', CLAUDE_COLOUR), size: CLAUDE_SIZE, ...label('Claude', 16.8, '#FFFFFF', 18) })
    // One hidden node the library draws as its default sphere: that mesh is where the starfield's classes come from.
    nodes.push({ id: 'probe', vi: -1, fx: 0, fy: 0, fz: 0 })

    graph.nodeThreeObject((node: GraphNode) => {
      const v = visuals[Number(node.vi)]
      if (v === undefined || three === null) return null
      const group = new three.Object3D()
      if (v.sprite) group.add(v.sprite)
      if (v.label) {
        v.label.position.set(0, v.labelOffset, 0)
        group.add(v.label)
      }
      return group
    })
    setLinkStyle()
    graph.graphData({ nodes, links })
    // The library builds its objects a moment later: the links' look is set, and the starfield made, once they exist.
    setTimeout(afterData, 100)
    setTimeout(afterData, 600)
    recolour()
    retarget()
  }

  // The links' look depends on the state: a fresh accessor makes the library read it again.
  function setLinkStyle() {
    if (graph === null) return
    const g = galaxy
    const hidden = (owner: string) => state.hidden[owner] === true
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
      if (link.kind !== 'bridge') return state.spokes && !hidden(String(link.owner))
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
    let mesh: Any = null
    scene.traverse((object: Any) => {
      if (object.isLine && object.material) {
        object.material.blending = ADDITIVE
        object.material.depthWrite = false
      }
      if (mesh === null && object.isMesh && object.geometry && object.material) mesh = object
    })
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
    const controls = graph?.controls()
    if (controls) controls.autoRotate = state.rotating && shown
  }

  // ---- Per frame ----

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - lastFrame) / 1000)
    lastFrame = now
    clock += dt
    if (graph === null || galaxy === null || !shown) return
    syncSettings()
    stepFlight(dt)
    const camera = (graph as unknown as Loose).camera?.() as Any
    const cam: Vec3 = camera ? [camera.position.x, camera.position.y, camera.position.z] : HOME
    const follow = Math.min(1, dt * 5)
    const selectedKey = state.selected
    for (const v of visuals) {
      v.alpha += (v.target - v.alpha) * follow
      v.labelAlpha += (v.labelTarget - v.labelAlpha) * follow
      v.pulse = v.kind === 'star' && v.key === selectedKey ? selectedPulse(clock) : v.kind === 'core' || v.kind === 'claude' ? 0.1 + 0.07 * Math.sin(clock * 1.5 + v.index) : v.pulse * Math.exp(-dt * 2.2)
      if (v.sprite) {
        const scale = v.size * (1 + v.pulse * 1.6)
        v.sprite.scale.set(scale, scale, 1)
        v.sprite.material.opacity = Math.min(1, v.alpha)
      }
      if (v.label) {
        const k = labelScale(Math.hypot(v.position[0] - cam[0], v.position[1] + v.labelOffset - cam[1], v.position[2] - cam[2]))
        v.label.scale.set(v.labelBase[0] * k, v.labelBase[1] * k, 1)
        v.label.material.opacity = Math.min(1, v.labelAlpha)
      }
    }
    if (pointer.moved) {
      pointer.moved = false
      hover()
    }
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
      if (v.kind === 'claude') continue
      // In front of the camera only.
      if (view[2]! * v.position[0] + view[6]! * v.position[1] + view[10]! * v.position[2] + view[14]! >= 0) continue
      const screen = l.graph2ScreenCoords(v.position[0], v.position[1], v.position[2]) as { x: number; y: number }
      out.push({ kind: v.kind, id: v.key, sx: screen.x, sy: screen.y, radius: PICK_RADIUS[v.kind], alpha: v.alpha })
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
    if (hit === null) return
    if (hit.kind === 'star') flyToStar(hit.id)
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
  byId('map-spokes').addEventListener('change', () => dispatch(toggleSpokes(state)))
  byId('map-bridges').addEventListener('change', () => dispatch(toggleBridges(state)))
  byId('map-layer-recall').addEventListener('change', () => dispatch(toggleLayer(state, 'recall')))
  byId('map-layer-write').addEventListener('change', () => dispatch(toggleLayer(state, 'write')))
  rotate.addEventListener('click', () => dispatch(toggleRotation(state)))
  byId('map-reset').addEventListener('click', reset)
  // Simulate a recall / write and the live layers are wired by the live phase; here they are drawn and inert.
  for (const id of ['map-sim-recall', 'map-sim-write']) {
    const button = byId<HTMLButtonElement>(id)
    button.disabled = true
    button.title = 'Needs the live layer'
  }
  find$.addEventListener('input', () => search(find$.value))
  canvasBox.addEventListener('pointerdown', event => {
    down = { x: event.clientX, y: event.clientY }
    flight = null
  })
  canvasBox.addEventListener('pointermove', event => {
    const box = canvasBox.getBoundingClientRect()
    pointer = { x: event.clientX - box.left, y: event.clientY - box.top, moved: true }
  })
  canvasBox.addEventListener('pointerleave', () => {
    pointer.moved = false
    hovered = ''
    tip.hidden = true
    canvasBox.style.cursor = 'grab'
  })
  canvasBox.addEventListener('pointerup', event => {
    const start = down
    down = null
    if (start === null || !isClick(start, { x: event.clientX, y: event.clientY })) return
    const box = canvasBox.getBoundingClientRect()
    pointer = { x: event.clientX - box.left, y: event.clientY - box.top, moved: false }
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
    try {
      const composer = l.postProcessingComposer?.() as Any
      const bloom = new lib.UnrealBloomPass({ x: 512, y: 512 }, BLOOM.strength, BLOOM.radius, BLOOM.threshold) as Any
      composer.addPass(bloom)
      composer.addPass(new lib.OutputPass())
      const basic = bloom.basic
      if (basic && typeof basic.constructor === 'function') bloomPassBasic = basic.constructor
    } catch {
      // without bloom the stars are plainer but the map works
    }
    graph.cameraPosition({ x: HOME[0], y: HOME[1], z: HOME[2] }, { x: 0, y: 0, z: 0 }, 0)
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
    raf = requestAnimationFrame(frame)
    if (galaxy !== null) {
      drawGalaxy(galaxy)
      render()
    }
  }

  void loadGalaxy()
  void start()

  return {
    visible(next: boolean) {
      shown = next
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
