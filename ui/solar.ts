// The solar-system scene of the Galaxy view (plan MAPX.5, contract C13), ported from the
// approved mockup (docs/plans/mapx-design/solar-scene.js) onto the real data.
//
// `createSolarScene(options)` is the only export a page needs. It draws into one canvas
// with the three.js classes it is handed (the module from ui/vendor/map-lib.js; there is
// no global THREE) and talks to the page through the three callbacks and the seven methods
// of C13: setData, setView, flyTo, showView, zoom, event and dispose. The page never
// reaches into the scene's objects, and the scene never touches the DOM outside its canvas
// (it makes off-screen canvases for textures, nothing else).
//
// The rules (which body a project is, how far, how fast, Find's matching) live in
// ui/solar-layout.ts and are shared with the page; this file is the picture and the motion.
// Renderer and composer are injected (`createRenderer`, `createComposer`) and so is the
// frame clock, so a spec can run the scene on the vendored three.js without WebGL.

import { drawsOnMap, noduleFor } from './map-live'
import type { MapEvent } from './map-live'
import {
  buildBodies,
  describe,
  dotColour,
  EVENT_COLOUR,
  hashOf,
  kindLabel,
  kindOne,
  labelName,
  linkInfos,
  linksOf,
  metricText,
  orbitSeconds,
  orbitSpeed,
  orbitTilt,
  planetR,
  bodyR,
  projectLabel,
  rng,
  fnv,
  searchResults,
  sharedCount,
  startAngle,
  STYLES,
  sunBelt as beltOf,
  tagColour,
  tagHash,
  targets,
  writerColour,
  writerInfos,
} from './solar-layout'
import type { Arrange, Body, ColourMode, LinkInfo, Orbits, PlanetStyle, SolarGalaxy, SolarMemory, StyleId, Target, WriterInfo } from './solar-layout'

type Three = typeof import('./vendor/map-lib.js')
// three.js objects are handled as plain objects here: the vendored declarations are loose on purpose.
type O3 = any

// ---- The interface (C13) -------------------------------------------------------------

/** What the scene reads in the `GET /api/galaxy` reply beyond C11: the mined knowledge items (the satellites). */
export type SolarKnowledge = { id: string; kind: string; text: string; memory: string }
export type SceneGalaxy = SolarGalaxy & { knowledge?: readonly SolarKnowledge[] }

/** The page's choices. `legend` is the page's own card: the scene ignores it. */
export type SolarView = {
  arrange: Arrange
  colour: ColourMode
  /**
   * An owner set to true is hidden (label, orbit line when alone, black holes and live events go with it).
   * flyTo into a hidden owner shows it first, as the mockup did, and reports it through `onLevel`: the page shows that owner's chip.
   */
  hidden: Record<string, boolean>
  query: string
  /** Auto-rotate: off by default; a turning camera cancels out the planets' own slow orbits. */
  rotate: boolean
  /** The outer belt of retired, expired and lapsed memories is drawn. */
  sample: boolean
  legend: boolean
}

export type ViewName = 'top' | 'below' | 'side' | 'reset'

/** The frame loop's source: requestAnimationFrame by default. */
export type SolarClock = { request(callback: (ms: number) => void): number; cancel(handle: number): void }

/** The part of the three.js renderer the scene calls. */
export type SolarRenderer = {
  setPixelRatio(ratio: number): void
  setClearColor(colour: number, alpha?: number): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  dispose(): void
  forceContextLoss?(): void
}
/** The post-processing chain: the scene sets the approved bloom on `bloom` and calls render once per frame. */
export type SolarComposer = {
  bloom: { strength: number; radius: number; threshold: number }
  render(): void
  setSize(width: number, height: number): void
  dispose?(): void
}

export type SolarOptions = {
  canvas: any
  three: Three
  createRenderer?: (canvas: any, three: Three) => SolarRenderer
  createComposer?: (renderer: SolarRenderer, scene: O3, camera: O3, three: Three) => SolarComposer
  clock?: SolarClock
  /** `tip` is a list of lines, the first the title; null hides the tooltip. x and y are canvas pixels. */
  onHover?: (tip: string[] | null, x: number, y: number) => void
  onPick?: (target: Target) => void
  onLevel?: (level: Target) => void
}

export type SolarScene = {
  setData(galaxy: SceneGalaxy): void
  setView(view: Partial<SolarView>): void
  flyTo(target: Target): void
  showView(name: ViewName): void
  zoom(factor: number): void
  event(event: MapEvent): void
  dispose(): void
}

/** The method names C13 fixes; a spec checks the returned object against this list. */
export const SCENE_METHODS = ['setData', 'setView', 'flyTo', 'showView', 'zoom', 'event', 'dispose'] as const

export const DEFAULT_VIEW: SolarView = { arrange: 'activity', colour: 'writer', hidden: {}, query: '', rotate: false, sample: true, legend: true }

// ---- Constants (the approved look) -----------------------------------------------------

export const CLEAR_COLOUR = 0x010205
export const BLOOM = { strength: 0.375, radius: 0.3, threshold: 0.6 } as const
const SUN_R = 34
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const FLIGHT_SECONDS = 1.4
const MAX_STEP = 0.05
const HOVER_SLOW = 0.15
// A port choice, not in the mockup: at most this many live events are drawn at once; the oldest end early.
const MAX_EVENTS = 40
// A port choice, not in the mockup: an opened memory shows at most this many knowledge satellites.
const MAX_SATELLITES = 12
const FADE_DAYS = 7
// A forgotten memory's dot keeps this share of its colour.
const FORGET_DIM = 0.1
const DAY_MS = 86400000
const PULSE_EVERY = 30

// ---- What a memory looks like (beyond the mockup, items 1 to 5) -------------------------

/**
 * A memory's look as an asteroid: bigger with importance, brighter with recalls (0.7 with none
 * up to 1.0, the mockup's own brightness, at 20 or more), a little fainter when its writer was
 * inferred, dim in its last 7 days before expiry. A slot with no listed memory (the list holds
 * the newest 2000) gets the middle of every range.
 */
export function memoryLook(memory: SolarMemory | null, now: number): { size: number; brightness: number; pinned: boolean; fading: boolean } {
  if (memory === null) return { size: 1, brightness: 0.85, pinned: false, fading: false }
  const left = memory.validUntil === null ? Number.NaN : Date.parse(memory.validUntil) - now
  const fading = left > 0 && left <= FADE_DAYS * DAY_MS
  const importance = Math.max(0, Math.min(1, memory.importance))
  let brightness = 0.7 + 0.3 * Math.min(1, Math.log1p(Math.max(0, memory.recalls)) / Math.log1p(20))
  if (memory.sourceInferred) brightness *= 0.75
  if (fading) brightness *= 0.45
  return { size: 0.6 + 0.8 * importance, brightness, pinned: memory.pinned, fading }
}

// ---- Small helpers ------------------------------------------------------------------------

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const text = (value: string | null | undefined, fallback: string): string => (value === null || value === undefined || value === '' ? fallback : value)

type Blob = { u: number; v: number; ru: number; rv: number; name: string; cnt: number; band?: boolean }
type Item = {
  kind: string
  i: number
  planet: string
  id: string | null
  tip: string[]
  mem: SolarMemory | null
  seed: number
}
type Hit = { x: number; y: number; obj: O3; tip: string[]; item?: Item; planet?: string }
type Flight = { p0: O3; t0: O3; p1: O3; t1: O3; start: number; dur: number; after?: () => void }
type Level = { level: 'galaxy' | 'planet' | 'moon' | 'memory'; planet: string | null; kind: string | null; mem: number | null; memId: string | null }
type MoonRec = { kind: string; c: number; pivot: O3; mesh: O3; label: O3; swarm: O3; speed: number }
type PlanetRec = {
  body: Body
  R: number
  orbitG: O3
  line: O3
  pG: O3
  mesh: O3
  ring: O3
  moons: MoonRec[]
  label: O3
  tagLabels: O3[]
  blobs: Blob[]
  r: number
  angle: number
  craft: boolean
}
type HoleRec = { L: LinkInfo; pair: { g: O3; disc: O3 }[]; line: O3; pulse: O3[]; phase: number }
type Fade = { obj: O3; index: number; rgb: [number, number, number] }
type EventRec = {
  type: 'recall' | 'save' | 'update' | 'forget' | 'pulse'
  owner: string | null
  source: string | null
  start: number
  dur: number
  bend: number
  objs: O3[]
  trail?: O3[]
  beam?: O3
  flash?: O3
  fade?: Fade[]
}

const defaultClock = (): SolarClock => ({
  request: callback => globalThis.requestAnimationFrame(callback),
  cancel: handle => globalThis.cancelAnimationFrame(handle),
})

function defaultRenderer(canvas: any, T: Three): SolarRenderer {
  return new T.WebGLRenderer({ canvas, antialias: true }) as unknown as SolarRenderer
}

function defaultComposer(renderer: SolarRenderer, scene: O3, camera: O3, T: Three): SolarComposer {
  const composer = new T.EffectComposer(renderer as never)
  composer.addPass(new T.RenderPass(scene, camera))
  const bloom = new T.UnrealBloomPass(new T.Vector2(512, 512), BLOOM.strength, BLOOM.radius, BLOOM.threshold)
  composer.addPass(bloom)
  composer.addPass(new T.OutputPass())
  return { bloom, render: () => composer.render(), setSize: (w, h) => composer.setSize(w, h), dispose: () => composer.dispose() }
}

/**
 * The scene. Create one per canvas; `dispose()` frees it. Throws when the renderer cannot be made (no WebGL).
 * Give each scene a fresh canvas; dispose() ends this canvas's WebGL context (a later scene on the same canvas can draw black).
 */
export function createSolarScene(options: SolarOptions): SolarScene {
  const impl = new SolarImpl(options)
  return {
    setData: galaxy => impl.setData(galaxy),
    setView: view => impl.setView(view),
    flyTo: target => impl.flyTo(target),
    showView: name => impl.showView(name),
    zoom: factor => impl.zoom(factor),
    event: event => impl.event(event),
    dispose: () => impl.dispose(),
  }
}

class SolarImpl {
  private readonly T: Three
  private readonly canvas: any
  private readonly opts: SolarOptions
  private readonly clockSource: SolarClock
  private readonly renderer: SolarRenderer
  private readonly composer: SolarComposer
  private readonly scene: O3
  private readonly camera: O3
  private readonly controls: O3
  private readonly ray: O3
  private readonly glowTex: O3
  private readonly dotTex: O3
  private readonly sharedTextures: O3[] = []
  private readonly sky: O3
  /** Everything the data decides: rebuilt by setData. */
  private world: O3
  /** Comets, beams, pulses and satellites: they outlive a rebuild. */
  private readonly fx: O3
  private pickables: O3[] = []
  private sats: O3[] = []

  private galaxy: SceneGalaxy | null = null
  private view: SolarView = { ...DEFAULT_VIEW, hidden: {} }
  private bodies: Body[] = []
  private orbits: Orbits = { radius: {}, ringOf: {}, rings: [] }
  private links: LinkInfo[] = []
  private writers: WriterInfo[] = []
  private knowledge = new Map<string, SolarKnowledge[]>()
  private P: Record<string, PlanetRec> = {}
  private holes: HoleRec[] = []
  private nodules = new Map<string, O3>()
  private flares = new Map<string, number>()
  private events: EventRec[] = []
  private byId = new Map<string, { obj: O3; index: number }[]>()
  private speedOf: Record<string, number> = {}
  private sunG: O3 = null
  private sunR = SUN_R
  private sunBeltObj: O3 = null
  private outer: O3 = null
  private outerLabel: O3 = null
  private now = Date.now()
  private maxR = 700
  private homePos: O3
  private homeTarget: O3
  private lastLabelArrange: Arrange | null = null
  private lastColour: ColourMode | null = null
  private lastQuery: string | null = null
  private memTarget: { obj: O3; i: number } | null = null
  private satKey = ''
  /** Forgotten ids: their dots stay dim over a setData while the reply still lists them live. */
  private forgotten = new Set<string>()
  /** A flyTo that came before the first setData: applied once data arrives. */
  private pendingFly: Target | null = null

  private S: Level = { level: 'galaxy', planet: null, kind: null, mem: null, memId: null }
  private reduced = false
  private clock = 0
  private last: number | null = null
  private flight: Flight | null = null
  private down: { x: number; y: number } | null = null
  private tipShown = false
  private w = 0
  private h = 0
  private handle: number | null = null
  private disposed = false
  private framed = false
  private mediaQuery: any = null
  private readonly onMedia = (event: { matches: boolean }): void => {
    this.reduced = event.matches
    // Plan 2.5: a flight running when reduced motion turns on finishes at once.
    if (this.reduced) this.finishFlight()
  }
  private readonly onDown = (e: any): void => {
    this.down = { x: e.clientX, y: e.clientY }
  }
  private readonly onMove = (e: any): void => {
    if (this.down && Math.abs(e.clientX - this.down.x) + Math.abs(e.clientY - this.down.y) > 4) {
      this.hideTip()
      return
    }
    const hit = this.pick(e)
    if (hit) {
      this.tipShown = true
      this.opts.onHover?.(hit.tip, hit.x, hit.y)
    } else this.hideTip()
  }
  private readonly onLeave = (): void => {
    this.down = null
    this.hideTip()
  }
  private readonly onClick = (e: any): void => {
    const d = this.down
    this.down = null
    if (d && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) return
    this.act(this.pick(e))
  }
  private readonly loop = (ms: number): void => {
    this.handle = null
    if (this.disposed) return
    try {
      this.frame(ms)
    } catch (err) {
      // As the mockup did, a frame that throws stops the loop; it is reported once, not every frame.
      console.error('solar scene: a frame threw and the loop has stopped', err)
      return
    }
    if (!this.disposed) this.handle = this.clockSource.request(this.loop)
  }

  constructor(opts: SolarOptions) {
    this.opts = opts
    const T = (this.T = opts.three)
    const canvas = (this.canvas = opts.canvas)
    this.clockSource = opts.clock ?? defaultClock()
    try {
      this.renderer = (opts.createRenderer ?? defaultRenderer)(canvas, T)
    } catch (err) {
      throw new Error(`WebGL is not available: ${err instanceof Error ? err.message : String(err)}`)
    }
    const renderer = this.renderer
    try {
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
      renderer.setClearColor(CLEAR_COLOUR, 1)
      this.scene = new T.Scene()
      this.camera = new T.PerspectiveCamera(50, 1, 0.5, 9000)
      this.controls = new T.OrbitControls(this.camera, canvas)
      this.controls.enableDamping = true
      this.controls.dampingFactor = 0.08
      this.controls.autoRotateSpeed = 0.3
      this.controls.minDistance = 6
      this.controls.maxDistance = 4000
      this.composer = (opts.createComposer ?? defaultComposer)(renderer, this.scene, this.camera, T)
      this.applyBloom()
      this.ray = new T.Raycaster()
      this.glowTex = this.glowTexture()
      this.sharedTextures.push(this.glowTex)
      this.dotTex = this.dotTexture()
      this.sharedTextures.push(this.dotTex)
      this.world = new T.Group()
      this.fx = new T.Group()
      this.scene.add(this.world, this.fx)
      this.scene.add(new T.PointLight(0xfff2d6, 3.2, 0, 0))
      this.scene.add(new T.AmbientLight(0x8090c0, 0.22))
      this.sky = this.makeSky()
      this.scene.add(this.sky)
      this.home()
      this.camera.position.copy(this.homePos)
      this.controls.target.copy(this.homeTarget)

      const media = globalThis.matchMedia?.(REDUCED_MOTION)
      if (media) {
        this.mediaQuery = media
        this.reduced = !!media.matches
        media.addEventListener?.('change', this.onMedia)
      }
      canvas.addEventListener('pointerdown', this.onDown)
      canvas.addEventListener('pointermove', this.onMove)
      canvas.addEventListener('pointerleave', this.onLeave)
      canvas.addEventListener('click', this.onClick)
      this.handle = this.clockSource.request(this.loop)
    } catch (err) {
      // Free everything made so far (listeners, controls, textures, composer, the context), then fail.
      this.disposed = true
      try {
        this.release()
      } catch {
        // the set-up error below is the one to report
      }
      throw err
    }
  }

  // ---------- the C13 methods ----------

  setData(galaxy: SceneGalaxy): void {
    if (this.disposed) return
    this.galaxy = galaxy
    this.rebuild()
  }

  setView(patch: Partial<SolarView>): void {
    if (this.disposed) return
    this.view = { ...this.view, ...patch, hidden: { ...(patch.hidden ?? this.view.hidden) } }
    if (this.galaxy === null) return
    this.applyView()
  }

  flyTo(target: Target): void {
    if (this.disposed) return
    if (this.galaxy === null) {
      this.pendingFly = target
      return
    }
    if (target.level === 'galaxy') this.flyHome()
    else if (target.level === 'planet') this.flyPlanet(target.owner)
    else if (target.level === 'moon') this.flyMoon(target.owner, target.kind)
    else this.flyMemoryById(target.owner, target.kind, target.id)
  }

  showView(name: ViewName): void {
    if (this.disposed) return
    const T = this.T
    const m = this.maxR || 700
    const t = this.controls.target.clone()
    if (name === 'top') this.fly(new T.Vector3(t.x, t.y + m * 2.2, t.z + 0.01), t)
    else if (name === 'below') this.fly(new T.Vector3(t.x, t.y - m * 2.0, t.z + 0.01), t)
    else if (name === 'side') this.fly(new T.Vector3(t.x, t.y + 30, t.z + m * 2.1), t)
    else this.flyHome()
  }

  zoom(factor: number): void {
    if (this.disposed || !(factor > 0)) return
    const t = this.controls.target
    this.camera.position.sub(t).multiplyScalar(factor).add(t)
  }

  event(event: MapEvent): void {
    if (this.disposed || this.galaxy === null) return
    this.spawn(event)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.hideTip()
    this.release()
  }

  /** Frees what exists, so it also serves a constructor that failed half way. The renderer goes last, whatever fails before. */
  private release(): void {
    try {
      if (this.handle !== null) this.clockSource.cancel(this.handle)
      this.handle = null
      const canvas = this.canvas
      canvas.removeEventListener('pointerdown', this.onDown)
      canvas.removeEventListener('pointermove', this.onMove)
      canvas.removeEventListener('pointerleave', this.onLeave)
      canvas.removeEventListener('click', this.onClick)
      this.mediaQuery?.removeEventListener?.('change', this.onMedia)
      this.controls?.dispose?.()
      if (this.world) this.clearWorld()
      this.clearFx()
      this.forgotten.clear()
      this.disposeTree(this.sky)
      for (const texture of this.sharedTextures) texture.dispose?.()
      this.scene?.remove(...[this.world, this.fx, this.sky].filter(Boolean))
      this.composer?.dispose?.()
    } finally {
      this.renderer.dispose()
      this.renderer.forceContextLoss?.()
    }
  }

  // ---------- textures and sprites ----------

  private canvas2d(w: number, h: number): O3 {
    const doc = this.canvas.ownerDocument ?? globalThis.document
    const c = doc.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  private texture(c: O3): O3 {
    const t = new this.T.CanvasTexture(c)
    t.colorSpace = this.T.SRGBColorSpace
    return t
  }

  private glowTexture(): O3 {
    const c = this.canvas2d(128, 128)
    const g = c.getContext('2d')
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 128, 128)
    return this.texture(c)
  }

  private dotTexture(): O3 {
    const c = this.canvas2d(64, 64)
    const g = c.getContext('2d')
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    r.addColorStop(0, 'rgba(255,255,255,1)')
    r.addColorStop(0.55, 'rgba(255,255,255,0.9)')
    r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r
    g.fillRect(0, 0, 64, 64)
    return this.texture(c)
  }

  private glow(colour: string, size: number, opacity = 1): O3 {
    const T = this.T
    const s = new T.Sprite(new T.SpriteMaterial({ map: this.glowTex, color: new T.Color(colour), transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending }))
    s.scale.set(size, size, 1)
    return s
  }

  private label(content: string, sub: string | null, colour: string, h: number): O3 {
    const T = this.T
    const c = this.canvas2d(8, 8)
    let g = c.getContext('2d')
    const f1 = '600 28px Inter, system-ui, sans-serif'
    const f2 = '400 22px Inter, system-ui, sans-serif'
    g.font = f1
    let w = g.measureText(content).width
    if (sub) {
      g.font = f2
      w = Math.max(w, g.measureText(sub).width)
    }
    c.width = Math.ceil(w) + 24
    c.height = sub ? 72 : 44
    g = c.getContext('2d')
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineJoin = 'round'
    g.font = f1
    g.lineWidth = 6
    g.strokeStyle = 'rgba(4, 6, 11, 0.9)'
    g.strokeText(content, c.width / 2, 22)
    g.fillStyle = colour
    g.fillText(content, c.width / 2, 22)
    if (sub) {
      g.font = f2
      g.strokeText(sub, c.width / 2, 54)
      g.fillStyle = '#a9b8cd'
      g.fillText(sub, c.width / 2, 54)
    }
    const s = new T.Sprite(new T.SpriteMaterial({ map: this.texture(c), transparent: true, depthWrite: false, depthTest: false }))
    s.renderOrder = 10
    s.scale.set((h * c.width) / c.height, h, 1)
    return s
  }

  private planetTexture(b: Body): { tex: O3; blobs: Blob[] } {
    const W = 512
    const H = 256
    const c = this.canvas2d(W, H)
    const g = c.getContext('2d')
    const st: PlanetStyle = STYLES[(b.style ?? 'earth') as StyleId]
    const blobs: Blob[] = []
    const maxC = b.land[0]?.count || 1
    const all: { name: string; cnt: number }[] = b.land.map(t => ({ name: t.tag, cnt: t.count }))
    for (let k = 0; k < b.islands; k++) all.push({ name: `island-${b.land.length + k}`, cnt: 0 })
    if (st.kind === 'gas') {
      const n = 14
      for (let j = 0; j < n; j++) {
        g.fillStyle = st.bands[j % st.bands.length]
        g.beginPath()
        g.moveTo(0, (j * H) / n)
        for (let x = 0; x <= W; x += 16) g.lineTo(x, (j * H) / n + Math.sin(x * 0.05 + j) * 3)
        g.lineTo(W, H)
        g.lineTo(0, H)
        g.closePath()
        g.fill()
      }
      for (let i = 0; i < all.length; i++) {
        const { name, cnt } = all[i] as { name: string; cnt: number }
        const h = tagHash(b, name)
        const v = 0.12 + ((h >>> 10) % 760) / 1000
        if (cnt > 0 && i < 6) {
          const th = H * (0.03 + 0.07 * Math.sqrt(cnt / maxC))
          g.globalAlpha = 0.82
          g.fillStyle = tagColour(name)
          g.beginPath()
          g.moveTo(0, v * H - th / 2)
          for (let x1 = 0; x1 <= W; x1 += 16) g.lineTo(x1, v * H - th / 2 + Math.sin(x1 * 0.04 + i) * th * 0.3)
          for (let x2 = W; x2 >= 0; x2 -= 16) g.lineTo(x2, v * H + th / 2 + Math.sin(x2 * 0.05 + i + 1) * th * 0.3)
          g.closePath()
          g.fill()
          g.globalAlpha = 1
          blobs.push({ u: 0.5, v, ru: 0.5, rv: th / H / 2 + 0.01, name, cnt, band: true })
        } else {
          const u = (h % 1000) / 1000
          const sz = cnt === 0 ? 3 : H * (0.03 + 0.06 * Math.sqrt(cnt / maxC))
          g.fillStyle = cnt === 0 ? 'rgba(255,255,255,0.4)' : tagColour(name)
          for (let wv = -1; wv <= 1; wv++) {
            g.beginPath()
            g.ellipse(u * W + wv * W, v * H, sz * 1.8, sz, 0, 0, Math.PI * 2)
            g.fill()
          }
          if (cnt > 0) blobs.push({ u, v, ru: (sz * 1.8) / W, rv: sz / H, name, cnt })
        }
      }
      if (st.extra === 'spot') {
        g.fillStyle = tagColour(b.land[0]?.tag ?? b.label)
        g.strokeStyle = 'rgba(60,25,10,0.5)'
        g.lineWidth = 3
        g.beginPath()
        g.ellipse(W * 0.3, H * 0.64, 30, 14, 0, 0, Math.PI * 2)
        g.fill()
        g.stroke()
      }
    } else {
      g.fillStyle = st.a
      g.fillRect(0, 0, W, H)
      const r = rng(hashOf(b, 'noise'))
      for (let i = 0; i < 260; i++) {
        g.globalAlpha = 0.12 + r() * 0.25
        g.fillStyle = st.b
        g.beginPath()
        g.ellipse(r() * W, r() * H, 4 + r() * 18, 2 + r() * 8, 0, 0, Math.PI * 2)
        g.fill()
      }
      g.globalAlpha = 1
      if (st.extra === 'craters') {
        for (let i = 0; i < 40; i++) {
          g.strokeStyle = 'rgba(30,25,20,0.45)'
          g.lineWidth = 2
          g.beginPath()
          g.arc(r() * W, r() * H, 2 + r() * 7, 0, Math.PI * 2)
          g.stroke()
        }
      }
      for (let i = 0; i < all.length; i++) {
        const { name, cnt } = all[i] as { name: string; cnt: number }
        const h = tagHash(b, name)
        const u2 = (h % 1000) / 1000
        const lat = ((h >>> 10) % 110) - 55
        const v2 = 0.5 - lat / 180
        const size = cnt === 0 ? 4 : H * (0.05 + 0.15 * Math.sqrt(cnt / maxC))
        const r2 = rng(h)
        g.fillStyle = cnt === 0 ? 'rgba(255,255,255,0.35)' : tagColour(name)
        const blobsN = cnt === 0 ? 1 : 5
        const offs: number[][] = []
        for (let k = 0; k < blobsN; k++) offs.push([(r2() - 0.5) * size * 1.6, (r2() - 0.5) * size * 0.8, size * (0.5 + r2() * 0.5)])
        for (let wv = -1; wv <= 1; wv++) {
          for (const o of offs) {
            g.beginPath()
            g.ellipse(u2 * W + wv * W + (o[0] as number), v2 * H + (o[1] as number), (o[2] as number) * 1.6, o[2] as number, 0, 0, Math.PI * 2)
            g.fill()
          }
        }
        if (cnt > 0) blobs.push({ u: u2, v: v2, ru: (size * 1.6) / W, rv: (size * 0.8) / H, name, cnt })
      }
      if (st.extra === 'cap') {
        g.fillStyle = 'rgba(250,250,255,0.9)'
        g.fillRect(0, 0, W, H * 0.07)
        g.fillRect(0, H * 0.95, W, H * 0.05)
      }
      if (st.extra === 'haze') {
        g.fillStyle = 'rgba(245,225,180,0.3)'
        g.fillRect(0, 0, W, H)
      }
      if (st.extra === 'clouds') {
        g.fillStyle = 'rgba(255,255,255,0.28)'
        for (let i = 0; i < 18; i++) {
          g.beginPath()
          g.ellipse(r() * W, r() * H, 20 + r() * 40, 3 + r() * 4, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
    // Beyond the mockup: an idle project (30 days) gets polar ice; a project to review gets clouds.
    if (b.iceCap && !(st.kind === 'rock' && st.extra === 'cap')) {
      g.fillStyle = 'rgba(244,248,255,0.85)'
      g.fillRect(0, 0, W, H * 0.07)
      g.fillRect(0, H * 0.94, W, H * 0.06)
    }
    if (b.clouds) {
      const cr = rng(hashOf(b, 'untidy'))
      g.fillStyle = 'rgba(236,241,250,0.55)'
      for (let i = 0; i < 26; i++) {
        g.beginPath()
        g.ellipse(cr() * W, cr() * H, 18 + cr() * 36, 4 + cr() * 6, 0, 0, Math.PI * 2)
        g.fill()
      }
    }
    return { tex: this.texture(c), blobs }
  }

  private sunTexture(): O3 {
    const W = 512
    const H = 256
    const c = this.canvas2d(W, H)
    const g = c.getContext('2d')
    const lin = g.createLinearGradient(0, 0, 0, H)
    lin.addColorStop(0, '#c9631c')
    lin.addColorStop(0.5, '#e8942e')
    lin.addColorStop(1, '#c4601a')
    g.fillStyle = lin
    g.fillRect(0, 0, W, H)
    const r = rng(5)
    for (let i = 0; i < 2200; i++) {
      g.globalAlpha = 0.18 + r() * 0.3
      g.fillStyle = r() < 0.5 ? '#a8480f' : '#ffc062'
      g.beginPath()
      g.ellipse(r() * W, r() * H, 2 + r() * 5, 1.5 + r() * 3.5, r() * 3, 0, Math.PI * 2)
      g.fill()
    }
    for (let i = 0; i < 14; i++) {
      g.globalAlpha = 0.5
      g.fillStyle = '#ffd88a'
      g.beginPath()
      g.ellipse(r() * W, H * (0.2 + r() * 0.6), 10 + r() * 22, 2 + r() * 3, r() * 0.6 - 0.3, 0, Math.PI * 2)
      g.fill()
    }
    for (let i = 0; i < 5; i++) {
      const x = r() * W
      const y = H * (0.3 + r() * 0.4)
      const sz = 4 + r() * 7
      g.globalAlpha = 0.55
      g.fillStyle = '#7a3208'
      g.beginPath()
      g.arc(x, y, sz * 1.7, 0, Math.PI * 2)
      g.fill()
      g.globalAlpha = 0.9
      g.fillStyle = '#3a1404'
      g.beginPath()
      g.arc(x, y, sz, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    return this.texture(c)
  }

  // ---------- building the scene ----------

  private applyBloom(): void {
    const bloom = this.composer.bloom
    bloom.strength = BLOOM.strength
    bloom.radius = BLOOM.radius
    bloom.threshold = BLOOM.threshold
  }

  /**
   * Dots as a Points object. `sizes` (a per-dot scale from importance) rides in an attribute the
   * point material reads; `pinned` indexes get a halo that shares the dots' positions.
   */
  private pointsObject(positions: number[], colours: number[], size: number, items: unknown[], opacity: number, soft: boolean, sizes?: number[], pinned?: number[]): O3 {
    const T = this.T
    const gm = new T.BufferGeometry()
    gm.setAttribute('position', new T.BufferAttribute(new Float32Array(positions), 3))
    gm.setAttribute('color', new T.BufferAttribute(new Float32Array(colours), 3))
    const material = new T.PointsMaterial({ size, map: this.dotTex, vertexColors: true, transparent: true, opacity, depthWrite: false, sizeAttenuation: true, blending: soft ? T.NormalBlending : T.AdditiveBlending })
    if (sizes) {
      gm.setAttribute('aSize', new T.BufferAttribute(new Float32Array(sizes), 1))
      material.onBeforeCompile = (shader: { vertexShader: string }): void => {
        shader.vertexShader = shader.vertexShader.replace('uniform float size;', 'uniform float size;\nattribute float aSize;').replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;')
      }
    }
    const pts = new T.Points(gm, material)
    pts.userData = { kind: 'points', items }
    pts.frustumCulled = false
    if (pinned && pinned.length > 0) {
      const hg = new T.BufferGeometry()
      hg.setAttribute('position', gm.attributes.position)
      hg.setIndex(pinned)
      const halo = new T.Points(hg, new T.PointsMaterial({ size: size * 3.4, map: this.glowTex, color: new T.Color('#F0E442'), transparent: true, opacity: 0.6, depthWrite: false, sizeAttenuation: true, blending: T.AdditiveBlending }))
      halo.frustumCulled = false
      halo.userData = { kind: 'halo' }
      pts.add(halo)
      pts.userData.halo = halo
    }
    return pts
  }

  private circle(r: number, colour: number, opacity: number): O3 {
    const T = this.T
    const pts: O3[] = []
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2
      pts.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
    }
    return new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false }))
  }

  private makeSky(): O3 {
    const sky: number[] = []
    const skyC: number[] = []
    const rs = rng(77)
    for (let i = 0; i < 1000; i++) {
      const u = rs() * 2 - 1
      const th = rs() * Math.PI * 2
      const rr = 3000 + rs() * 2000
      const q = Math.sqrt(1 - u * u)
      const b = rs() < 0.07 ? 0.55 + rs() * 0.3 : 0.07 + rs() * 0.16
      sky.push(Math.cos(th) * q * rr, u * rr, Math.sin(th) * q * rr)
      skyC.push(b * 0.8, b * 0.88, b)
    }
    const pts = this.pointsObject(sky, skyC, 6, [], 0.8, true)
    pts.userData = {}
    return pts
  }

  /** The listed live memories of one kind of one owner, newest first; slots past the list hold no memory. */
  private slotsOf(owner: string, kind: string, count: number): (SolarMemory | null)[] {
    const out: (SolarMemory | null)[] = []
    for (const memory of this.galaxy?.memories ?? []) {
      if (out.length >= count) break
      if (memory.owner === owner && memory.kind === kind && memory.state === 'live') out.push(memory)
    }
    while (out.length < count) out.push(null)
    return out
  }

  private writerOf(memory: SolarMemory | null): string {
    return writerColour(this.writers, memory?.source ?? this.writers[0]?.source ?? '')
  }

  private rgb(item: Item, mode: ColourMode): [number, number, number] {
    const c = new this.T.Color(this.colourOf(item, mode))
    const k = memoryLook(item.mem, this.now).brightness * (item.id !== null && this.forgotten.has(item.id) ? FORGET_DIM : 1)
    return [c.r * k, c.g * k, c.b * k]
  }

  /**
   * A dot's colour. A listed memory colours by its own recalls (Recalls) or age (Age); a slot with
   * no listed memory takes the seeded stand-in of the layout rules.
   */
  private colourOf(item: Item, mode: ColourMode): string {
    const memory = item.mem
    if (memory === null || item.kind === 'unknown' || mode === 'writer') return dotColour(mode, item.seed, item.kind, this.writerOf(memory))
    if (mode === 'recalls') return `hsl(48, 95%, ${Math.round(38 + Math.min(1, Math.log1p(Math.max(0, memory.recalls)) / Math.log1p(20)) * 50)}%)`
    const created = memory.created === null ? Number.NaN : Date.parse(memory.created)
    const days = Number.isFinite(created) ? Math.max(0, (this.now - created) / DAY_MS) : 90
    // Newest memories are the warmest blue-violet; a quarter-year old and older are the coolest.
    return `hsl(${Math.round(280 - Math.min(1, days / 90) * 80)}, 70%, 66%)`
  }

  private firstLine(memory: SolarMemory | null): string {
    return memory === null ? 'an older memory (the map lists the newest 2000)' : text(memory.label, '(no text)')
  }

  private writerLine(memory: SolarMemory | null): string {
    if (memory === null) return 'writer unknown · recalls unknown'
    return `writer ${memory.source}${memory.sourceInferred ? ' (inferred)' : ''} · ${memory.recalls} recalls${memory.pinned ? ' · pinned' : ''}`
  }

  /** Dots for a list of items: positions are given; colours, sizes, halo and the id lookup come from the items. */
  private dots(items: Item[], positions: number[], size: number, opacity: number): O3 {
    const colours: number[] = []
    const sizes: number[] = []
    const pinned: number[] = []
    items.forEach((item, j) => {
      const [r, g, bl] = this.rgb(item, this.view.colour)
      colours.push(r, g, bl)
      const look = memoryLook(item.mem, this.now)
      sizes.push(look.size)
      if (look.pinned) pinned.push(j)
    })
    return this.pointsObject(positions, colours, size, items, opacity, true, sizes, pinned)
  }

  private register(obj: O3, items: Item[]): void {
    items.forEach((item, index) => {
      if (item.id === null) return
      const list = this.byId.get(item.id) ?? []
      list.push({ obj, index })
      this.byId.set(item.id, list)
    })
  }

  /** The ring of a body's memories seen from afar (kind 'unknown' rows grey: the planet belt). */
  private memoryRing(b: Body, pG: O3, R: number, inner: number): O3 {
    const T = this.T
    const ringG = new T.Group()
    ringG.rotation.x = 0.35
    pG.add(ringG)
    const items: Item[] = []
    const positions: number[] = []
    const rr = rng(hashOf(b, 'ring'))
    let j = 0
    for (const { kind, count } of b.kinds) {
      const slots = this.slotsOf(b.owner, kind, count)
      for (let n = 0; n < count; n++, j++) {
        const a = rr() * Math.PI * 2
        const d = R * (inner + rr() * 0.4)
        positions.push(Math.cos(a) * d, (rr() - 0.5) * 0.8, Math.sin(a) * d)
        const memory = slots[n] ?? null
        items.push({
          kind,
          i: j,
          planet: b.owner,
          id: memory?.id ?? null,
          mem: memory,
          seed: hashOf(b, String(j)),
          tip: [
            `${b.label} · ${kindOne(kind)} memory`,
            b.craft !== null ? (b.craft === 'station' ? 'docked at the station' : 'carried by the starship') : kind === 'unknown' ? 'saved before kinds: the planet belt' : b.count < 3 ? 'a dwarf planet has no moons' : `in the ${kindLabel(kind)} moon's swarm`,
            this.firstLine(memory),
          ],
        })
      }
    }
    const ring = this.dots(items, positions, 1.7, 0.55)
    ring.userData.ringOf = b.owner
    ringG.add(ring)
    this.pickables.push(ring)
    return ring
  }

  private makePlanet(b: Body, r: number, previous: PlanetRec | undefined): PlanetRec {
    if (b.craft !== null) return this.makeCraft(b, r, previous)
    const T = this.T
    const R = planetR(b)
    const tilt = orbitTilt(b)
    const orbitG = new T.Group()
    // A ring's bodies share one tilt: start on it, so a rebuild does not make them wobble.
    const shared = this.orbits.rings[this.orbits.ringOf[b.owner] ?? -1]?.tilt ?? tilt
    orbitG.rotation.x = shared.x
    orbitG.rotation.z = shared.z
    this.world.add(orbitG)
    const line = this.circle(1, 0x8caadc, 0.09)
    line.scale.set(r, 1, r)
    orbitG.add(line)
    const pG = new T.Group()
    orbitG.add(pG)
    const tiltG = new T.Group()
    tiltG.rotation.z = tilt.axis
    pG.add(tiltG)
    const pt = this.planetTexture(b)
    const style = STYLES[(b.style ?? 'earth') as StyleId]
    const mesh = new T.Mesh(new T.SphereGeometry(R, 48, 32), new T.MeshStandardMaterial({ map: pt.tex, roughness: 0.85, metalness: 0 }))
    mesh.userData = { kind: 'planet', id: b.owner }
    tiltG.add(mesh)
    this.pickables.push(mesh)
    pG.add(this.glow(style.kind === 'gas' ? '#ffe6c0' : '#9cc8ff', R * 2.6, 0.06))
    if (style.kind === 'gas' && style.extra === 'rings') {
      const rings = [
        [1.25, 1.55, 0xe8dab4, 0.32],
        [1.6, 1.95, 0xcdb385, 0.22],
      ]
      for (const ringDef of rings) {
        const rm = new T.Mesh(
          new T.RingGeometry(R * (ringDef[0] as number), R * (ringDef[1] as number), 96),
          new T.MeshBasicMaterial({ color: ringDef[2], side: T.DoubleSide, transparent: true, opacity: ringDef[3], depthWrite: false }),
        )
        rm.rotation.x = -Math.PI / 2
        tiltG.add(rm)
      }
    }
    // Tag labels on the surface, shown at Planet level.
    const tagLabels: O3[] = []
    for (let k = 0; k < pt.blobs.length && tagLabels.length < 12; k++) {
      const bl = pt.blobs[k] as Blob
      const phi = bl.u * Math.PI * 2
      const theta = bl.v * Math.PI
      const sp = this.label(`${bl.name} ${bl.cnt}`, null, '#ffffff', R * 0.16)
      const dir = new T.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
      sp.position.copy(dir.clone().multiplyScalar(R * 1.04))
      sp.userData.dir = dir
      sp.visible = false
      mesh.add(sp)
      tagLabels.push(sp)
    }
    this.addMarks(b, pG, R)
    const ring = this.memoryRing(b, pG, R, 1.3)
    // Moons: one per kind, each with its swarm.
    const moons: MoonRec[] = []
    b.moons.forEach((mk, m) => {
      const c = mk.count
      const pivot = new T.Group()
      pivot.rotation.y = (hashOf(b, mk.kind) % 628) / 100
      pivot.rotation.x = (rng(fnv(mk.kind))() - 0.5) * 0.4
      pG.add(pivot)
      const mr = Math.max(1.3, ((1.2 + Math.sqrt(c) * 0.45) * R) / 25)
      const md = R * 1.95 + m * R * 0.2
      const moon = new T.Mesh(new T.SphereGeometry(mr, 20, 14), new T.MeshStandardMaterial({ color: 0xe9edf3, emissive: 0x2a2f38, roughness: 0.7 }))
      moon.position.set(md, 0, 0)
      moon.userData = { kind: 'moon', planet: b.owner, id: mk.kind, tip: [`${kindLabel(mk.kind)} moon of ${b.label}`, `${c} memories · click to open its swarm`] }
      const mg = this.glow('#dfe6f2', mr * 6, 0.45)
      mg.position.copy(moon.position)
      const lh = Math.max(2.2, R * 0.12)
      const ml = this.label(`${kindLabel(mk.kind)} · ${c}`, null, '#ffffff', lh)
      ml.position.set(md, mr + lh * 0.9, 0)
      ml.visible = false
      pivot.add(moon, mg, ml)
      this.pickables.push(moon)
      const swarmG = new T.Group()
      swarmG.position.copy(moon.position)
      pivot.add(swarmG)
      const slots = this.slotsOf(b.owner, mk.kind, c)
      const sr = rng(hashOf(b, `${mk.kind}swarm`))
      const base: number[] = []
      const ringPos: number[] = []
      const items: Item[] = []
      for (let j = 0; j < c; j++) {
        const v3 = new T.Vector3(sr() - 0.5, (sr() - 0.5) * 0.5, sr() - 0.5).normalize().multiplyScalar(mr + 1.5 + sr() * mr * 1.8)
        base.push(v3.x, v3.y, v3.z)
        const ra = (j / c) * Math.PI * 2
        ringPos.push(Math.cos(ra) * Math.max(10, mr * 4), 0, Math.sin(ra) * Math.max(10, mr * 4))
        const memory = slots[j] ?? null
        items.push({
          kind: mk.kind,
          i: j,
          planet: b.owner,
          id: memory?.id ?? null,
          mem: memory,
          seed: hashOf(b, mk.kind + j),
          tip: [`${kindLabel(mk.kind)} · memory ${j + 1} of ${c}`, this.firstLine(memory), this.writerLine(memory)],
        })
      }
      const swarm = this.dots(items, base.slice(), Math.max(0.9, mr * 0.5), 0.85)
      swarm.userData.base = base
      swarm.userData.ringPos = ringPos
      swarm.visible = false
      swarmG.add(swarm)
      this.pickables.push(swarm)
      this.register(swarm, items)
      moons.push({ kind: mk.kind, c, pivot, mesh: moon, label: ml, swarm, speed: 0.6 / (m + 1) })
    })
    this.register(ring, ring.userData.items)
    const lab = this.label(labelName(b), metricText(b, this.view.arrange), '#e6edf7', 14)
    this.world.add(lab)
    return { body: b, R, orbitG, line, pG, mesh, ring, moons, label: lab, tagLabels, blobs: pt.blobs, r: previous?.r ?? r, angle: previous?.angle ?? startAngle(b), craft: false }
  }

  /** The "no remote" and "kind unknown" marks: a small word under the body, kept at every level. */
  private addMarks(b: Body, pG: O3, R: number): void {
    const mark = b.kindUnknown ? 'kind unknown' : b.noRemote ? 'no remote' : null
    if (mark === null) return
    const sp = this.label(mark, null, b.kindUnknown ? '#e6b450' : '#9fb0c8', Math.max(3, R * 0.2))
    sp.position.set(0, -R * 1.45, 0)
    sp.userData = { kind: 'mark' }
    pG.add(sp)
  }

  /** A plain folder (no git repo): a space station when it is a lasting workspace (map.stationMin memories, 50 by default), else a starship. */
  private makeCraft(b: Body, r: number, previous: PlanetRec | undefined): PlanetRec {
    const T = this.T
    const craft = b.craft
    const R = bodyR(b)
    const tilt = orbitTilt(b)
    const orbitG = new T.Group()
    // A ring's bodies share one tilt: start on it, so a rebuild does not make them wobble.
    const shared = this.orbits.rings[this.orbits.ringOf[b.owner] ?? -1]?.tilt ?? tilt
    orbitG.rotation.x = shared.x
    orbitG.rotation.z = shared.z
    this.world.add(orbitG)
    const line = this.circle(1, 0x8caadc, 0.09)
    line.scale.set(r, 1, r)
    orbitG.add(line)
    const pG = new T.Group()
    orbitG.add(pG)
    const body = new T.Group()
    pG.add(body)
    const hull = new T.MeshStandardMaterial({ color: 0xc3ccd8, metalness: 0.55, roughness: 0.38 })
    const dark = new T.MeshStandardMaterial({ color: 0x5d6878, metalness: 0.6, roughness: 0.5 })
    const parts: O3[] = []
    const lights: { tag: string; count: number; x: number; y: number; z: number }[] = []
    const add = (geo: O3, mat: O3, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): O3 => {
      const m = new T.Mesh(geo, mat)
      m.position.set(x, y, z)
      m.rotation.set(rx, ry, rz)
      body.add(m)
      parts.push(m)
      return m
    }
    const top = b.tags.slice(0, 8)
    if (craft === 'station') {
      add(new T.TorusGeometry(R, R * 0.12, 12, 64), hull, 0, 0, 0, Math.PI / 2)
      add(new T.CylinderGeometry(R * 0.24, R * 0.24, R * 0.62, 20), hull, 0, 0, 0)
      add(new T.BoxGeometry(R * 2, R * 0.07, R * 0.07), dark, 0, 0, 0)
      add(new T.BoxGeometry(R * 0.07, R * 0.07, R * 2), dark, 0, 0, 0)
      const panel = new T.MeshStandardMaterial({ color: 0x1d3f7a, metalness: 0.3, roughness: 0.4, emissive: 0x0a1630 })
      add(new T.BoxGeometry(R * 0.32, R * 0.02, R * 1.4), panel, 0, R * 0.44, 0)
      add(new T.BoxGeometry(R * 0.32, R * 0.02, R * 1.4), panel, 0, -R * 0.44, 0)
      for (const t of top) {
        const a = (hashOf(b, t.tag) % 628) / 100
        lights.push({ tag: t.tag, count: t.count, x: Math.cos(a) * R * 1.13, y: 0, z: Math.sin(a) * R * 1.13 })
      }
    } else {
      add(new T.CylinderGeometry(R, R, R * 0.14, 40), hull, R * 0.55, R * 0.28, 0)
      add(new T.SphereGeometry(R * 0.28, 16, 10), hull, R * 0.55, R * 0.36, 0).scale.set(1, 0.35, 1)
      add(new T.BoxGeometry(R * 0.55, R * 0.3, R * 0.15), hull, -R * 0.02, R * 0.08, 0, 0, 0, -0.5)
      add(new T.CylinderGeometry(R * 0.2, R * 0.15, R * 1.3, 18), hull, -R * 0.45, -R * 0.12, 0, 0, 0, Math.PI / 2)
      add(new T.SphereGeometry(R * 0.08, 12, 8), new T.MeshBasicMaterial({ color: 0xffb35c }), R * 0.22, -R * 0.12, 0)
      for (let side = -1; side <= 1; side += 2) {
        add(new T.BoxGeometry(R * 0.1, R * 0.62, R * 0.05), dark, -R * 0.7, R * 0.14, side * R * 0.27, side * -0.75, 0, 0)
        add(new T.CylinderGeometry(R * 0.09, R * 0.09, R * 1.25, 14), hull, -R * 0.72, R * 0.38, side * R * 0.5, 0, 0, Math.PI / 2)
        add(new T.BoxGeometry(R * 1.0, R * 0.04, R * 0.04), new T.MeshBasicMaterial({ color: 0x6fb8ff }), -R * 0.74, R * 0.38, side * R * 0.41)
        add(new T.SphereGeometry(R * 0.09, 12, 8), new T.MeshBasicMaterial({ color: 0xff4a3a }), -R * 0.1, R * 0.38, side * R * 0.5)
        const ng = this.glow('#6fb8ff', R * 0.9, 0.35)
        ng.position.set(-R * 0.74, R * 0.38, side * R * 0.5)
        body.add(ng)
      }
      top.forEach((t, i) => {
        const a = -1.3 + ((i + 0.5) * 2.6) / top.length
        lights.push({ tag: t.tag, count: t.count, x: R * 0.55 + Math.cos(a) * R * 1.01, y: R * 0.28, z: Math.sin(a) * R * 1.01 })
      })
    }
    for (const part of parts) {
      part.userData = { kind: 'planet', id: b.owner }
      this.pickables.push(part)
    }
    for (const L of lights) {
      const sh = sharedCount(this.bodies, L.tag, b.owner)
      const lm = new T.Mesh(new T.BoxGeometry(R * 0.17, R * 0.1, R * 0.1), new T.MeshBasicMaterial({ color: new T.Color(tagColour(L.tag)) }))
      lm.position.set(L.x, L.y, L.z)
      lm.userData = {
        kind: 'tag',
        tip: [`Tag: ${L.tag}`, `used ${L.count} times here${sh ? ` · also on ${sh} other bod${sh > 1 ? 'ies' : 'y'}` : ''}`, craft === 'station' ? 'a lit panel on the station' : 'a lit window on the starship'],
      }
      body.add(lm)
      this.pickables.push(lm)
    }
    this.addMarks(b, pG, R)
    const ring = this.memoryRing(b, pG, R, 1.35)
    this.register(ring, ring.userData.items)
    const lab = this.label(labelName(b), metricText(b, this.view.arrange), '#e6edf7', 14)
    this.world.add(lab)
    return { body: b, R, orbitG, line, pG, mesh: body, ring, moons: [], label: lab, tagLabels: [], blobs: [], r: previous?.r ?? r, angle: previous?.angle ?? startAngle(b), craft: true }
  }

  private makeHoles(L: LinkInfo, i: number): void {
    const T = this.T
    const size = 2.2 + L.pairs * 0.6
    const labelOf = (owner: string): string => this.P[owner]?.body.label ?? projectLabel(owner)
    const pair: { g: O3; disc: O3 }[] = []
    for (let k = 0; k < 2; k++) {
      const g = new T.Group()
      const core = new T.Mesh(new T.SphereGeometry(size, 20, 14), new T.MeshBasicMaterial({ color: 0x000000 }))
      const disc = new T.Mesh(new T.RingGeometry(size * 1.4, size * 2.4, 48), new T.MeshBasicMaterial({ color: 0xe8b8ff, side: T.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false, blending: T.AdditiveBlending }))
      disc.rotation.x = -Math.PI / 2 + 0.4
      const partner = k === 0 ? L.newer : L.older
      const tip = [
        `Black hole: ${L.pairs} similar memories`,
        `${labelOf(L.older)} (older) → ${labelOf(L.newer)} (newer) · best ${L.best}`,
        'a pulse of energy runs older → newer every 30 s',
        `click to fly to ${labelOf(partner)}`,
      ]
      core.userData = { kind: 'hole', partner, tip }
      const catcher = new T.Mesh(new T.SphereGeometry(size * 3, 12, 8), new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
      catcher.userData = core.userData
      g.add(core, disc, catcher, this.glow('#e8b8ff', size * 4, 0.25))
      this.world.add(g)
      this.pickables.push(catcher)
      pair.push({ g, disc })
    }
    const geo = new T.BufferGeometry()
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(61 * 3), 3))
    const line = new T.Line(geo, new T.LineBasicMaterial({ color: 0xe8b8ff, transparent: true, opacity: 0.2, depthWrite: false, blending: T.AdditiveBlending }))
    line.frustumCulled = false
    this.world.add(line)
    const pulse: O3[] = []
    for (let t = 0; t < 8; t++) {
      const sp = this.glow('#fff0ff', t === 0 ? 14 : 10 * (1 - t / 8) + 2, t === 0 ? 1 : 0.6 * (1 - t / 8))
      sp.visible = false
      sp.userData = { kind: 'pulse' }
      this.world.add(sp)
      pulse.push(sp)
    }
    this.holes.push({ L, pair, line, pulse, phase: 26 - i * 8 })
  }

  private makeSun(): void {
    const T = this.T
    const g = this.galaxy as SceneGalaxy
    const live = this.bodies.reduce((sum, b) => sum + b.count, 0)
    this.sunR = Math.max(26, Math.min(52, 26 + Math.sqrt(live) * 0.75))
    const sunR = this.sunR
    const k = sunR / SUN_R
    const sunG = new T.Group()
    this.world.add(sunG)
    this.sunG = sunG
    const sunMesh = new T.Mesh(new T.SphereGeometry(sunR, 48, 32), new T.MeshBasicMaterial({ map: this.sunTexture(), color: new T.Color(0.95, 0.9, 0.85) }))
    sunMesh.userData = {
      kind: 'sun',
      tip: ['Memory store (the sun)', `${live} live memories · ${this.bodies.length} projects · ${this.writers.length} writers`, 'it turns; the writer nodules turn with it'],
    }
    sunG.add(sunMesh)
    this.pickables.push(sunMesh)
    this.world.add(this.glow('#ff9a3c', 190 * k, 0.16), this.glow('#ffd28a', 92 * k, 0.14))
    this.nodules = new Map()
    for (const w of this.writers) {
      const nr = 2.2 + Math.sqrt(w.count) * 0.5
      const pos = new T.Vector3(w.dir[0], w.dir[1], w.dir[2]).multiplyScalar(sunR * 1.015)
      const nm = new T.Mesh(new T.SphereGeometry(nr, 20, 14), new T.MeshBasicMaterial({ color: new T.Color(w.colour) }))
      nm.position.copy(pos)
      nm.userData = {
        kind: 'nodule',
        tip: [`${w.source} (writer nodule)`, `wrote ${w.count} memories`, w.inferred > 0 ? `${w.inferred} of them backfilled: drawn a little fainter` : 'all written under its own name'],
      }
      const ng = this.glow(w.colour, nr * 7, 0.9)
      ng.position.copy(pos)
      const nl = this.label(`${w.source} · ${w.count}`, null, w.colour, 7)
      nl.position.copy(pos.clone().multiplyScalar(1.35))
      sunG.add(nm, ng, nl)
      this.pickables.push(nm)
      this.nodules.set(w.source, nm)
    }

    // The sun belt: global memories.
    const belt = beltOf(g, this.bodies)
    if (belt.length > 0) {
      const beltR = (72 * sunR) / SUN_R
      const globals = new Map<string | null, SolarMemory[]>()
      for (const memory of g.memories) {
        if (memory.state !== 'live' || (memory.scope !== 'global' && memory.owner !== 'global')) continue
        const key = memory.owner === 'global' ? null : memory.owner
        const list = globals.get(key) ?? []
        list.push(memory)
        globals.set(key, list)
      }
      const pos: number[] = []
      const col: number[] = []
      const items: unknown[] = []
      belt.forEach((entry, i) => {
        const ga = (i * Math.PI * 2) / belt.length
        pos.push(Math.cos(ga) * beltR, Math.sin(ga * 3) * 3, Math.sin(ga) * beltR)
        col.push(1, 0.89, 0.64)
        const memory = globals.get(entry.owner)?.shift() ?? null
        const where = entry.owner === null ? 'saved for every project' : `saved in ${this.P[entry.owner]?.body.label ?? this.bodies.find(b => b.owner === entry.owner)?.label ?? entry.owner}, seen by every project`
        items.push({ tip: ['Global memory (scope global)', where, this.firstLine(memory)] })
      })
      this.sunBeltObj = this.pointsObject(pos, col, 6, items, 1, false)
      this.world.add(this.sunBeltObj)
      this.pickables.push(this.sunBeltObj)
      this.world.add(this.circle(beltR, 0xffd27a, 0.12))
      const sbl = this.label(`Sun belt · ${belt.length} global memories`, null, '#e9c98a', 7)
      sbl.position.set(0, -14 * k, 84 * k)
      this.world.add(sbl)
    }
  }

  /** The outer belt: the memories that are retired, expired or lapsed. Nothing is drawn when there are none. */
  private makeOuter(): void {
    const dead = (this.galaxy?.memories ?? []).filter(memory => memory.state !== 'live')
    if (dead.length === 0) return
    const ro = rng(11)
    const pos: number[] = []
    const col: number[] = []
    const items: unknown[] = []
    for (const memory of dead) {
      const oa = ro() * Math.PI * 2
      const oj = 1 + (ro() - 0.5) * 0.1
      pos.push(Math.cos(oa) * oj, (ro() - 0.5) * 0.02, Math.sin(oa) * oj)
      col.push(0.66, 0.6, 0.84)
      const when = (memory.validUntil ?? memory.created ?? '').slice(0, 10) || 'an unknown date'
      const what = memory.state === 'retired' ? `retired: ${when}` : memory.state === 'expired' ? `expired by the sweep: unused 90 days, ${when}` : `its own expiry date passed: ${when}`
      const owner = this.bodies.find(b => b.owner === memory.owner)?.label ?? projectLabel(memory.owner)
      items.push({ tip: [`Outer belt · ${memory.state === 'expired' ? 'an expired' : `a ${memory.state}`} memory`, what, `from ${owner} · ${this.firstLine(memory)}`, 'Restore it in the Review tab'] })
    }
    // A port choice, not in the mockup: the outer belt's dots are 3 wide (the mockup's belt has no size of its own to match).
    this.outer = this.pointsObject(pos, col, 3, items, 0.45, true)
    this.world.add(this.outer)
    this.pickables.push(this.outer)
    this.outerLabel = this.label(`Outer belt · retired, expired, lapsed (${dead.length})`, null, '#b9addf', 9)
    this.world.add(this.outerLabel)
  }

  private rebuild(): void {
    const galaxy = this.galaxy as SceneGalaxy
    const before = this.P
    const sunTurn = this.sunG ? this.sunG.rotation.y : 0
    const pivots = new Map<string, number>()
    for (const owner in before) for (const m of (before[owner] as PlanetRec).moons) pivots.set(`${owner}|${m.kind}`, m.pivot.rotation.y)
    // A tooltip over the old world would keep the orbits slowed; the new world has none yet.
    this.hideTip()
    this.clearWorld()
    this.now = Date.now()
    // A forget's dimming survives while the reply still lists the memory live; once it does not, it is let go.
    const live = new Set(galaxy.memories.filter(memory => memory.state === 'live').map(memory => memory.id))
    for (const id of [...this.forgotten]) if (!live.has(id)) this.forgotten.delete(id)
    this.bodies = buildBodies(galaxy, this.now)
    this.orbits = targets(this.bodies, this.view.arrange)
    this.links = linkInfos(galaxy, this.bodies)
    this.writers = writerInfos(galaxy.writers ?? [])
    this.knowledge = new Map()
    for (const item of galaxy.knowledge ?? []) {
      const list = this.knowledge.get(item.memory) ?? []
      list.push(item)
      this.knowledge.set(item.memory, list)
    }
    this.maxR = 0
    for (const owner in this.orbits.radius) this.maxR = Math.max(this.maxR, this.orbits.radius[owner] as number)
    this.P = {}
    this.makeSun()
    this.sunG.rotation.y = sunTurn
    for (const b of this.bodies) this.P[b.owner] = this.makePlanet(b, this.orbits.radius[b.owner] as number, before[b.owner])
    for (const owner in this.P) for (const m of (this.P[owner] as PlanetRec).moons) m.pivot.rotation.y = pivots.get(`${owner}|${m.kind}`) ?? m.pivot.rotation.y
    // Place the bodies now, so a flyTo straight after setData flies to where each one is, not to the origin.
    for (const owner in this.P) {
      const P = this.P[owner] as PlanetRec
      P.pG.position.set(Math.cos(P.angle) * P.r, 0, Math.sin(P.angle) * P.r)
    }
    this.makeOuter()
    this.holes = []
    this.links.forEach((link, i) => this.makeHoles(link, i))
    this.lastLabelArrange = this.view.arrange
    this.lastColour = this.view.colour
    this.lastQuery = null
    this.satKey = ''
    if (!this.framed && this.bodies.length > 0) {
      this.framed = true
      this.home()
      this.camera.position.copy(this.homePos)
      this.controls.target.copy(this.homeTarget)
    }
    // A place that is gone (the body, the opened moon or the opened memory) takes the camera home:
    // it flies there, or jumps under reduced motion, and onLevel reports the Galaxy.
    const S = this.S
    if (S.level !== 'galaxy') {
      const P = S.planet === null ? undefined : this.P[S.planet]
      if (!P || ((S.level === 'moon' || S.level === 'memory') && !P.moons.some(m => m.kind === S.kind))) this.flyHome()
    }
    // The opened memory keeps its satellites if it is still there.
    this.memTarget = null
    if (this.S.level === 'memory' && this.S.planet !== null && this.S.kind !== null && this.S.memId !== null) {
      const mo = this.P[this.S.planet]?.moons.find(m => m.kind === this.S.kind)
      const item = (mo?.swarm.userData.items as Item[] | undefined)?.find(x => x.id === this.S.memId)
      if (mo && item) {
        this.S.mem = item.i
        this.memTarget = { obj: mo.swarm, i: item.i }
      } else this.flyHome()
    }
    this.applyView()
    // A flyTo that came before the data is applied now that the bodies exist.
    const pending = this.pendingFly
    this.pendingFly = null
    if (pending !== null) this.flyTo(pending)
  }

  /** Applies everything in `view` that is not read each frame: labels, colours, Find's dimming. */
  private applyView(): void {
    const v = this.view
    if (this.lastLabelArrange !== v.arrange) {
      this.lastLabelArrange = v.arrange
      this.orbits = targets(this.bodies, v.arrange)
      this.maxR = 0
      for (const owner in this.orbits.radius) this.maxR = Math.max(this.maxR, this.orbits.radius[owner] as number)
      for (const id in this.P) {
        const Q = this.P[id] as PlanetRec
        this.world.remove(Q.label)
        this.disposeTree(Q.label)
        Q.label = this.label(labelName(Q.body), metricText(Q.body, v.arrange), '#e6edf7', 14)
        this.world.add(Q.label)
      }
    }
    if (this.lastColour !== v.colour) {
      this.lastColour = v.colour
      this.recolour(v.colour)
    }
    if (this.lastQuery !== v.query) {
      this.lastQuery = v.query
      const found = searchResults(this.bodies, v.query)
      const searching = (v.query ?? '').trim().length >= 2
      for (const owner in this.P) {
        const Q = this.P[owner] as PlanetRec
        const dim = searching && !found.match[owner]
        Q.mesh.traverse((o: O3) => {
          if (o.material && !o.isSprite) {
            o.material.transparent = true
            o.material.opacity = dim ? 0.15 : 1
          }
        })
        Q.label.material.opacity = dim ? 0.2 : 1
        Q.ring.material.opacity = dim ? 0.08 : 0.55
        if (Q.ring.userData.halo) Q.ring.userData.halo.material.opacity = dim ? 0.1 : 0.6
      }
    }
    // Hiding the body you are inside leaves it.
    const S = this.S
    if (S.level !== 'galaxy' && S.planet !== null && v.hidden[S.planet]) this.flyHome()
    this.controls.autoRotate = this.autoRotates()
  }

  private recolour(mode: ColourMode): void {
    for (const owner in this.P) {
      const P = this.P[owner] as PlanetRec
      this.paint(P.ring, mode)
      for (const moon of P.moons) this.paint(moon.swarm, mode)
    }
  }

  private paint(obj: O3, mode: ColourMode): void {
    const items = obj.userData.items as Item[]
    const col = obj.geometry.attributes.color
    items.forEach((item, i) => {
      const [r, g, b] = this.rgb(item, mode)
      col.setXYZ(i, r, g, b)
    })
    col.needsUpdate = true
  }

  // ---------- clearing ----------

  private disposeTree(root: O3): void {
    if (!root) return
    root.traverse?.((o: O3) => {
      o.geometry?.dispose?.()
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
      for (const m of mats) {
        if (m.map && !this.sharedTextures.includes(m.map)) m.map.dispose?.()
        m.dispose?.()
      }
    })
  }

  private clearWorld(): void {
    for (const child of this.world.children.slice()) {
      this.world.remove(child)
      this.disposeTree(child)
    }
    this.pickables = []
    this.byId = new Map()
    this.holes = []
    this.nodules = new Map()
    this.sunG = null
    this.sunBeltObj = null
    this.outer = null
    this.outerLabel = null
    this.P = {}
    this.clearSats()
  }

  private clearFx(): void {
    for (const ev of this.events) this.endEvent(ev)
    this.events = []
    this.clearSats()
  }

  private endEvent(ev: EventRec): void {
    if (ev.fade) this.setFade(ev.fade, 1)
    for (const o of ev.objs) {
      this.fx.remove(o)
      this.disposeTree(o)
    }
  }

  // ---------- camera ----------

  private home(): void {
    const T = this.T
    const m = this.maxR || 700
    this.homePos = new T.Vector3(0, m * 0.72, m * 1.45)
    this.homeTarget = new T.Vector3(0, 0, 0)
  }

  private worldOf(obj: O3): O3 {
    const v = new this.T.Vector3()
    obj.getWorldPosition(v)
    return v
  }

  private fly(pos: O3, target: O3, after?: () => void): void {
    if (this.reduced) {
      this.camera.position.copy(pos)
      this.controls.target.copy(target)
      this.flight = null
      this.controls.enabled = true
      this.camera.fov = 50
      this.camera.updateProjectionMatrix()
      if (after) after()
      return
    }
    this.flight = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: this.clock, dur: FLIGHT_SECONDS, after }
  }

  /** Ends a running flight where it was going (reduced motion turned on, or the flight arrived). */
  private finishFlight(): void {
    const f = this.flight
    if (f === null) return
    this.flight = null
    this.camera.position.copy(f.p1)
    this.controls.target.copy(f.t1)
    this.controls.enabled = true
    this.camera.fov = 50
    this.camera.updateProjectionMatrix()
    f.after?.()
  }

  private hiddenOwner(owner: string): boolean {
    return this.view.hidden[owner] === true
  }

  /**
   * Flying to a hidden owner shows it first, as the mockup did. The page learns of it through the
   * `onLevel` that follows (it names the owner), and shows that owner's chip.
   */
  private reveal(owner: string): void {
    if (!this.hiddenOwner(owner)) return
    const hidden = { ...this.view.hidden }
    delete hidden[owner]
    this.view = { ...this.view, hidden }
  }

  private setLevel(level: Level['level'], planet: string | null, kind: string | null, mem: number | null, memId: string | null): void {
    const was = this.S
    this.S = { level, planet, kind, mem, memId }
    this.hideTip()
    if (was.level === level && was.planet === planet && was.kind === kind && was.memId === memId) return
    const target: Target =
      level === 'planet' && planet !== null
        ? { level, owner: planet }
        : level === 'moon' && planet !== null && kind !== null
          ? { level, owner: planet, kind }
          : level === 'memory' && planet !== null && kind !== null && memId !== null
            ? { level, owner: planet, kind, id: memId }
            : { level: 'galaxy' }
    this.opts.onLevel?.(target)
  }

  private flyPlanet(owner: string): void {
    const P = this.P[owner]
    if (!P) return
    const T = this.T
    this.reveal(owner)
    this.setLevel('planet', owner, null, null, null)
    const c = this.worldOf(P.pG)
    const out = c.clone().setY(0)
    if (out.length() < 1) out.set(0, 0, 1)
    out.normalize()
    const side = new T.Vector3(-out.z, 0, out.x)
    const pos = c.clone().add(out.multiplyScalar(0.55).add(side.multiplyScalar(0.75)).add(new T.Vector3(0, 0.5, 0)).normalize().multiplyScalar(P.R * 6.5 + 30))
    this.fly(pos, c)
  }

  private flyMoon(owner: string, kind: string): void {
    const P = this.P[owner]
    if (!P) return
    const mo = P.moons.find(m => m.kind === kind)
    if (!mo) return
    const T = this.T
    this.reveal(owner)
    this.setLevel('moon', owner, kind, null, null)
    const c = this.worldOf(mo.mesh)
    const dir = this.camera.position.clone().sub(c).normalize()
    const reach = Math.max(10, mo.mesh.geometry.parameters.radius * 4) * 3.2
    this.fly(c.clone().add(dir.multiplyScalar(reach)).add(new T.Vector3(0, reach * 0.6, 0)), c)
  }

  /** Fly to a dot of a swarm where it is now (a click on it). */
  private flyMemory(item: Item, obj: O3): void {
    if (item.id === null) return
    const T = this.T
    const a = obj.geometry.attributes.position
    const v = new T.Vector3(a.getX(item.i), a.getY(item.i), a.getZ(item.i))
    obj.localToWorld(v)
    this.setLevel('memory', item.planet, item.kind, item.i, item.id)
    this.memTarget = { obj, i: item.i }
    const dir = this.camera.position.clone().sub(v).normalize()
    this.fly(v.clone().add(dir.multiplyScalar(16)).add(new T.Vector3(0, 6, 0)), v)
  }

  /** Fly to a memory by id, to where its dot will sit once the swarm has spread into a ring. */
  private flyMemoryById(owner: string, kind: string, id: string): void {
    const P = this.P[owner]
    if (!P) return
    const mo = P.moons.find(m => m.kind === kind)
    const items = mo ? (mo.swarm.userData.items as Item[]) : []
    const item = items.find(x => x.id === id)
    if (!mo || !item) {
      if (mo) this.flyMoon(owner, kind)
      else this.flyPlanet(owner)
      return
    }
    const T = this.T
    const rp = mo.swarm.userData.ringPos as number[]
    const v = new T.Vector3(rp[item.i * 3], rp[item.i * 3 + 1], rp[item.i * 3 + 2])
    mo.swarm.updateWorldMatrix(true, false)
    mo.swarm.localToWorld(v)
    this.reveal(owner)
    this.setLevel('memory', owner, kind, item.i, id)
    this.memTarget = { obj: mo.swarm, i: item.i }
    const dir = this.camera.position.clone().sub(v).normalize()
    this.fly(v.clone().add(dir.multiplyScalar(16)).add(new T.Vector3(0, 6, 0)), v)
  }

  private flyHome(): void {
    this.setLevel('galaxy', null, null, null, null)
    this.memTarget = null
    this.home()
    this.fly(this.homePos, this.homeTarget)
  }

  // ---------- live events ----------

  private spawn(e: MapEvent): void {
    if (!drawsOnMap(e)) return
    const T = this.T
    const owner = e.owner !== undefined && e.owner !== 'global' && this.P[e.owner] ? e.owner : null
    if (owner !== null && this.hiddenOwner(owner)) return
    const source = noduleFor(e.client, this.writers.map(w => w.source))
    const col = EVENT_COLOUR[e.kind]
    const P = owner === null ? null : (this.P[owner] as PlanetRec)
    const ev: EventRec = {
      type: P === null ? 'pulse' : e.kind,
      owner,
      source,
      start: this.clock,
      dur: P === null || e.kind === 'update' || e.kind === 'forget' ? 1.1 : 1.8,
      bend: Math.random() < 0.5 ? 1 : -1,
      objs: [],
    }
    if (P === null) {
      // No planet to go to (an outside agent with no project, the dashboard's multi-project search): a pulse on the sun and the nodule.
      const sun = this.glow(col, this.sunR * 5, 0)
      const nod = this.glow(col, 16, 0)
      this.fx.add(sun, nod)
      ev.objs.push(sun, nod)
      ev.flash = sun
      ev.trail = [nod]
    } else if (e.kind === 'update' || e.kind === 'forget') {
      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3))
      ev.beam = new T.Line(geo, new T.LineBasicMaterial({ color: new T.Color(col), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }))
      ev.beam.frustumCulled = false
      ev.flash = this.glow(col, P.R * 4, 0)
      this.fx.add(ev.beam, ev.flash)
      ev.objs.push(ev.beam, ev.flash)
      if (e.kind === 'forget') ev.fade = this.fadesOf(e.ids)
    } else {
      ev.trail = []
      for (let k = 0; k < 14; k++) {
        const sp = this.glow(k === 0 ? '#ffffff' : col, k === 0 ? 9 : 7 * (1 - k / 14) + 2, k === 0 ? 1 : 0.8 * (1 - k / 14))
        this.fx.add(sp)
        ev.trail.push(sp)
        ev.objs.push(sp)
      }
    }
    this.events.push(ev)
    while (this.events.length > MAX_EVENTS) this.endEvent(this.events.shift() as EventRec)
    if (e.kind !== 'recall') this.flares.set(source ?? '', this.clock)
  }

  /** The dots of the listed ids, with the colour each has now (a forgotten memory fades out of it). */
  private fadesOf(ids: readonly string[]): Fade[] {
    const out: Fade[] = []
    for (const id of ids) {
      // Already dimmed by an earlier forget: not dimmed twice.
      if (this.forgotten.has(id)) continue
      this.forgotten.add(id)
      for (const { obj, index } of this.byId.get(id) ?? []) {
        const col = obj.geometry.attributes.color
        out.push({ obj, index, rgb: [col.getX(index), col.getY(index), col.getZ(index)] })
      }
    }
    return out
  }

  private noduleAt(source: string | null): O3 {
    const mesh = source === null ? undefined : this.nodules.get(source)
    return mesh ? this.worldOf(mesh) : new this.T.Vector3(0, 0, 0)
  }

  private stepEvents(): void {
    const T = this.T
    const keep: EventRec[] = []
    for (const ev of this.events) {
      const u = (this.clock - ev.start) / ev.dur
      const P = ev.owner === null ? undefined : this.P[ev.owner]
      // An event bound for a body that is gone or hidden since it started stops drawing.
      if (u >= 1 || (ev.owner !== null && (!P || this.hiddenOwner(ev.owner)))) {
        this.endEvent(ev)
        if (u >= 1 && ev.type === 'recall') this.flares.set(ev.source ?? '', this.clock)
        continue
      }
      keep.push(ev)
      // Reduced motion: beams, pulses and flashes are drawn at full strength for their time, not faded in and out.
      const al = this.reduced ? 1 : Math.sin(Math.PI * u)
      const nod = this.noduleAt(ev.source)
      if (ev.type === 'pulse') {
        ;(ev.flash as O3).position.set(0, 0, 0)
        ;(ev.flash as O3).material.opacity = 0.35 * al
        const n = (ev.trail as O3[])[0]
        n.position.copy(nod)
        n.material.opacity = 0.9 * al
        continue
      }
      const pp = this.worldOf((P as PlanetRec).pG)
      if (ev.type === 'update' || ev.type === 'forget') {
        const ba = ev.beam.geometry.attributes.position.array
        ba[0] = nod.x
        ba[1] = nod.y
        ba[2] = nod.z
        ba[3] = pp.x
        ba[4] = pp.y
        ba[5] = pp.z
        ev.beam.geometry.attributes.position.needsUpdate = true
        ev.beam.material.opacity = al
        ev.flash.position.copy(pp)
        ev.flash.material.opacity = 0.7 * al
        if (ev.fade) this.setFade(ev.fade, this.reduced ? 1 : u)
        continue
      }
      const from = ev.type === 'recall' ? pp : nod
      const to = ev.type === 'recall' ? nod : pp
      const mid = from.clone().add(to).multiplyScalar(0.5).add(new T.Vector3(0, from.distanceTo(to) * 0.18 * ev.bend, 0))
      const trail = ev.trail as O3[]
      for (let k = 0; k < trail.length; k++) {
        const v = this.reduced ? 1 : Math.max(0, u - k * 0.016)
        trail[k].position.copy(from.clone().multiplyScalar((1 - v) * (1 - v)).add(mid.clone().multiplyScalar(2 * (1 - v) * v)).add(to.clone().multiplyScalar(v * v)))
      }
    }
    this.events = keep
  }

  /** A forgotten memory's dots dim to a tenth of their colour as the laser lands. */
  private setFade(fades: Fade[], u: number): void {
    const f = 1 - (1 - FORGET_DIM) * Math.min(1, u)
    const touched = new Set<O3>()
    for (const { obj, index, rgb } of fades) {
      obj.geometry.attributes.color.setXYZ(index, rgb[0] * f, rgb[1] * f, rgb[2] * f)
      touched.add(obj)
    }
    for (const obj of touched) obj.geometry.attributes.color.needsUpdate = true
  }

  // ---------- satellites ----------

  private clearSats(): void {
    for (const s of this.sats) {
      this.fx.remove(s)
      this.disposeTree(s)
    }
    this.sats = []
    this.satKey = ''
  }

  /** The knowledge items mined from the opened memory orbit it as small gold lights. */
  private satellites(): void {
    const S = this.S
    if (S.level !== 'memory' || !this.memTarget || S.memId === null) {
      if (this.sats.length > 0) this.clearSats()
      return
    }
    if (this.satKey !== S.memId) {
      this.clearSats()
      this.satKey = S.memId
      for (const item of (this.knowledge.get(S.memId) ?? []).slice(0, MAX_SATELLITES)) {
        const g = this.glow('#F0E442', 2.2, 1)
        g.userData = { kind: 'satellite', tip: [`Knowledge · ${item.kind}`, text(item.text, '(no text)'), 'mined from this memory'] }
        this.fx.add(g)
        this.sats.push(g)
      }
    }
    const o = this.memTarget.obj
    const a = o.geometry.attributes.position
    const v = new this.T.Vector3(a.getX(this.memTarget.i), a.getY(this.memTarget.i), a.getZ(this.memTarget.i))
    o.localToWorld(v)
    const n = this.sats.length
    for (let i = 0; i < n; i++) {
      const ang = (i * Math.PI * 2) / n + (this.reduced ? 0 : this.clock * 0.6)
      this.sats[i].position.set(v.x + Math.cos(ang) * 3.2, v.y + Math.sin(ang * 2) * 0.6, v.z + Math.sin(ang) * 3.2)
    }
  }

  // ---------- the frame ----------

  private autoRotates(): boolean {
    return this.view.rotate && !this.reduced && !this.flight && this.S.level === 'galaxy' && !this.tipShown
  }

  private frame(ms: number): void {
    const T = this.T
    const c = this.canvas
    const s = this.view
    const dt = this.last === null ? 0 : Math.max(0, Math.min(MAX_STEP, (ms - this.last) / 1000))
    this.last = ms
    this.clock += dt
    const w = c.clientWidth
    const h = c.clientHeight
    if (w > 0 && h > 0 && (this.w !== w || this.h !== h)) {
      this.w = w
      this.h = h
      this.renderer.setSize(w, h, false)
      this.composer.setSize(w, h)
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    const motion = this.reduced ? 0 : 1
    if (this.sunG) this.sunG.rotation.y += dt * 0.12 * motion
    for (const [source, mesh] of this.nodules) {
      const at = this.flares.get(source)
      mesh.scale.setScalar(1 + (at === undefined || this.reduced ? 0 : Math.max(0, 1 - (this.clock - at) * 1.5)) * 0.8)
    }

    // Arrange: planets glide to their rings; they orbit only in the Galaxy view.
    const hoverSlow = this.tipShown ? HOVER_SLOW : 1
    this.speedOf = {}
    const S = this.S
    for (const ring of this.orbits.rings) {
      const members = ring.owners.map(o => this.P[o]).filter((x): x is PlanetRec => x !== undefined)
      const lead = members[0]
      if (!lead) continue
      const speed = ring.speed
      if (S.level === 'galaxy') lead.angle += dt * speed * motion * hoverSlow
      members.forEach((member, mi) => {
        const og = member.orbitG
        og.rotation.x += (ring.tilt.x - og.rotation.x) * Math.min(1, dt * 3)
        og.rotation.z += (ring.tilt.z - og.rotation.z) * Math.min(1, dt * 3)
        member.line.visible = mi === 0 && members.some(q => !s.hidden[q.body.owner])
        this.speedOf[member.body.owner] = speed
        if (mi === 0) return
        const want = lead.angle + (ring.phases[mi] ?? 0)
        const diff = Math.atan2(Math.sin(want - member.angle), Math.cos(want - member.angle))
        member.angle += diff * Math.min(1, dt * 2)
      })
    }
    for (const id in this.P) {
      const P = this.P[id] as PlanetRec
      P.r += ((this.orbits.radius[id] ?? P.r) - P.r) * Math.min(1, dt * 3)
      P.line.scale.set(P.r, 1, P.r)
      P.pG.position.set(Math.cos(P.angle) * P.r, 0, Math.sin(P.angle) * P.r)
      if (P.body.craft === 'ship') P.mesh.rotation.y = -(P.angle + Math.PI / 2)
      else P.mesh.rotation.y += dt * (P.craft ? 0.2 : 0.15) * motion
      P.ring.parent.rotation.y += dt * 0.25 * motion
      const here = S.planet === id && S.level !== 'galaxy'
      P.pG.visible = !s.hidden[id]
      P.ring.visible = !here
      const wp = this.worldOf(P.pG)
      P.label.position.set(wp.x, wp.y + P.R * 1.9 + 10, wp.z)
      P.label.visible = !here && !s.hidden[id]
      for (const mo of P.moons) {
        const frozen = here && (S.level === 'moon' || S.level === 'memory')
        if (!frozen) mo.pivot.rotation.y += dt * mo.speed * motion
        mo.label.visible = here
        mo.swarm.visible = here
        const spreadOn = here && S.kind === mo.kind && (S.level === 'moon' || S.level === 'memory')
        this.spreadSwarm(mo.swarm, spreadOn, dt)
      }
      const camDir = this.camera.position.clone()
      for (const tl of P.tagLabels) {
        if (!here || S.level !== 'planet') {
          tl.visible = false
          continue
        }
        const wpos = this.worldOf(tl)
        const facing = wpos.clone().sub(wp).normalize().dot(camDir.clone().sub(wp).normalize())
        tl.visible = facing > 0.25
      }
    }
    const outerR = this.maxR + 70
    if (this.outer) {
      this.outer.scale.set(outerR, 1, outerR)
      this.outer.rotation.y += dt * 0.004 * motion
      this.outer.visible = s.sample
      this.outerLabel.position.set(0, 30, -outerR)
      this.outerLabel.visible = s.sample
    }
    if (this.sunBeltObj) this.sunBeltObj.rotation.y += dt * 0.06 * motion

    // Black holes: a calm line from the older planet through both holes to the newer; one pulse every 30 s.
    for (let i = 0; i < this.holes.length; i++) {
      const H = this.holes[i] as HoleRec
      const A = this.P[H.L.older]
      const B = this.P[H.L.newer]
      if (!A || !B) continue
      const gone = !!(s.hidden[H.L.older] || s.hidden[H.L.newer])
      H.pair[0]!.g.visible = H.pair[1]!.g.visible = H.line.visible = !gone
      const a = this.worldOf(A.pG)
      const b = this.worldOf(B.pG)
      const dir = b.clone().sub(a)
      const len = dir.length()
      dir.normalize()
      const ha = a.clone().add(dir.clone().multiplyScalar(A.R * 2.4 + 6))
      const hb = b.clone().sub(dir.clone().multiplyScalar(B.R * 2.4 + 6))
      H.pair[0]!.g.position.copy(ha)
      H.pair[1]!.g.position.copy(hb)
      H.pair[0]!.disc.rotation.z += dt * 0.15 * motion
      H.pair[1]!.disc.rotation.z += dt * 0.15 * motion
      const ctl = ha.clone().add(hb).multiplyScalar(0.5).add(new T.Vector3(0, len * 0.16 + 10, 0))
      const ea = a.clone().add(dir.clone().multiplyScalar(A.R))
      const eb = b.clone().sub(dir.clone().multiplyScalar(B.R))
      const arr = H.line.geometry.attributes.position.array
      const pts: O3[] = []
      for (let k = 0; k <= 60; k++) {
        const u = k / 60
        let q: O3
        if (u < 0.12) q = ea.clone().lerp(ha, u / 0.12)
        else if (u > 0.88) q = hb.clone().lerp(eb, (u - 0.88) / 0.12)
        else {
          const tt = (u - 0.12) / 0.76
          q = ha.clone().multiplyScalar((1 - tt) * (1 - tt)).add(ctl.clone().multiplyScalar(2 * (1 - tt) * tt)).add(hb.clone().multiplyScalar(tt * tt))
        }
        arr[k * 3] = q.x
        arr[k * 3 + 1] = q.y
        arr[k * 3 + 2] = q.z
        pts.push(q)
      }
      H.line.geometry.attributes.position.needsUpdate = true
      H.line.material.opacity = 0.14 + 0.06 * (this.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(this.clock * 0.5 + H.phase))
      const local = (((this.clock + H.phase) % PULSE_EVERY) + PULSE_EVERY) % PULSE_EVERY
      const on = local < 7 && !this.reduced && !gone
      for (let k = 0; k < H.pulse.length; k++) {
        H.pulse[k].visible = on
        if (on) {
          const e = ease(local / 7)
          const idx = Math.max(0, Math.min(60, Math.round((e - k * 0.012) * 60)))
          H.pulse[k].position.copy(pts[idx])
        }
      }
    }

    this.stepEvents()
    this.satellites()

    // Camera flight.
    if (this.flight) {
      const f = this.flight
      const uf = Math.min(1, (this.clock - f.start) / f.dur)
      const ef = ease(uf)
      this.camera.position.lerpVectors(f.p0, f.p1, ef)
      this.controls.target.lerpVectors(f.t0, f.t1, ef)
      this.camera.fov = 50 + 14 * Math.sin(Math.PI * uf)
      this.camera.updateProjectionMatrix()
      this.controls.enabled = false
      if (uf >= 1) this.finishFlight()
    }
    this.controls.autoRotate = this.autoRotates()
    this.controls.update()
    this.applyBloom()
    this.composer.render()
  }

  private spreadSwarm(swarm: O3, on: boolean, dt: number): void {
    const target = on ? 1 : 0
    let cur = swarm.userData.spread || 0
    if (Math.abs(target - cur) < 0.001) return
    cur += (target - cur) * Math.min(1, dt * 3)
    if (Math.abs(target - cur) < 0.002) cur = target
    swarm.userData.spread = cur
    const a = swarm.geometry.attributes.position.array
    const b = swarm.userData.base as number[]
    const r = swarm.userData.ringPos as number[]
    for (let i = 0; i < a.length; i++) a[i] = (b[i] as number) + ((r[i] as number) - (b[i] as number)) * cur
    swarm.geometry.attributes.position.needsUpdate = true
    swarm.geometry.computeBoundingSphere()
  }

  // ---------- picking ----------

  private hideTip(): void {
    if (!this.tipShown) return
    this.tipShown = false
    this.opts.onHover?.(null, 0, 0)
  }

  private shown(o: O3): boolean {
    while (o) {
      if (!o.visible) return false
      o = o.parent
    }
    return true
  }

  private pick(e: { clientX: number; clientY: number }): Hit | null {
    const T = this.T
    const rect = this.canvas.getBoundingClientRect()
    if (!(rect.width > 0) || !(rect.height > 0)) return null
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const ndc = new T.Vector2((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1)
    this.ray.setFromCamera(ndc, this.camera)
    this.ray.params.Points.threshold = Math.max(0.6, this.camera.position.distanceTo(this.controls.target) * 0.006)
    const all: O3[] = this.ray.intersectObjects([...this.pickables, ...this.sats], false)
    let firstSolid: O3 = null
    let firstDot: O3 = null
    for (const hit of all) {
      if (!this.shown(hit.object)) continue
      if (hit.object.userData.kind === 'points') {
        if (!firstDot) firstDot = hit
      } else if (!firstSolid) firstSolid = hit
    }
    const hits: O3[] = firstSolid && (!firstDot || firstSolid.distance <= firstDot.distance + 40) ? [firstSolid] : all
    for (const hit of hits) {
      const o = hit.object
      if (!this.shown(o)) continue
      if (o.userData.kind === 'points') {
        const item = o.userData.items[hit.index]
        if (!item) continue
        return { x, y, obj: o, item, tip: item.tip }
      }
      if (o.userData.kind === 'planet') {
        const P = this.P[o.userData.id]
        if (!P) continue
        const b = P.body
        if (!P.craft && this.S.planet === b.owner && this.S.level === 'planet' && hit.uv) {
          const u = hit.uv.x
          const v = 1 - hit.uv.y
          let best: Blob | null = null
          for (const bl of P.blobs) {
            let du = Math.abs(u - bl.u)
            du = Math.min(du, 1 - du)
            if ((bl.band || du <= bl.ru) && Math.abs(v - bl.v) <= bl.rv) {
              if (!best || bl.rv < best.rv) best = bl
            }
          }
          if (best) {
            const sh = sharedCount(this.bodies, best.name, b.owner)
            return {
              x,
              y,
              obj: o,
              tip: [`Tag: ${best.name}`, `used ${best.cnt} times here${sh ? ` · also on ${sh} other planet${sh > 1 ? 's' : ''}` : ' · only on this planet'}`, 'click: light its memories'],
            }
          }
        }
        const labelOf = (owner: string): string => this.P[owner]?.body.label ?? projectLabel(owner)
        const ls = linksOf(this.links, b.owner).map(L => `${L.older === b.owner ? `to ${labelOf(L.newer)}` : `from ${labelOf(L.older)}`} (${L.pairs})`)
        const ring = this.orbits.rings[this.orbits.ringOf[b.owner] ?? -1]
        const shared = !!ring && ring.owners.length > 1
        const minutes = Math.round(orbitSeconds(this.speedOf[b.owner] ?? orbitSpeed(b)) / 60)
        return {
          x,
          y,
          obj: o,
          planet: b.owner,
          tip: [
            labelName(b),
            `${describe(b)} · one orbit every ${minutes} min${shared ? ' (shared orbit)' : ''}`,
            `${b.count} memories · ${b.tagsTotal} tags · ${b.kinds.length} kinds`,
            `activity ${b.activity}${b.activitySource === 'lifetime' ? ' (lifetime so far)' : ' (30 days)'} · recalls ${b.recalls} · median age ${b.age === null ? 'unknown' : `${Math.round(b.age * 10) / 10} d`}`,
            `top tags: ${b.tags.slice(0, 3).map(t => t.tag).join(', ') || 'none'}`,
            ls.length ? `similar memories: ${ls.join(', ')}` : 'no black holes',
            'click to fly in',
          ],
        }
      }
      return { x, y, obj: o, tip: o.userData.tip }
    }
    return null
  }

  /** What a click on a hit means as a C13 target, or null when it opens nothing. */
  private targetOf(hit: Hit): Target | null {
    const o = hit.obj
    const k = o.userData.kind
    const S = this.S
    if (k === 'planet') return { level: 'planet', owner: o.userData.id }
    if (k === 'moon') return { level: 'moon', owner: o.userData.planet, kind: o.userData.id }
    if (k === 'hole') return { level: 'planet', owner: o.userData.partner }
    if (k === 'sun' || k === 'nodule') return { level: 'galaxy' }
    if (k === 'points' && hit.item) {
      if (o.userData.ringOf) return { level: 'planet', owner: o.userData.ringOf }
      if (hit.item.kind && hit.item.planet && S.level === 'planet') return { level: 'moon', owner: hit.item.planet, kind: hit.item.kind }
      if (hit.item.kind && hit.item.planet && hit.item.id !== null) return { level: 'memory', owner: hit.item.planet, kind: hit.item.kind, id: hit.item.id }
    }
    return null
  }

  private act(hit: Hit | null): void {
    if (!hit || this.flight) return
    const target = this.targetOf(hit)
    if (target === null) return
    const S = this.S
    const o = hit.obj
    if (target.level === 'planet' && o.userData.kind === 'planet' && S.planet === target.owner && S.level === 'planet') return
    this.opts.onPick?.(target)
    if (target.level === 'galaxy') this.flyHome()
    else if (target.level === 'planet') this.flyPlanet(target.owner)
    else if (target.level === 'moon') this.flyMoon(target.owner, target.kind)
    else if (hit.item) this.flyMemory(hit.item, o)
  }
}

export type { Arrange, ColourMode, Target }
