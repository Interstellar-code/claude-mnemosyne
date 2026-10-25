// Browser stand-ins for plan MAPX.5. `tests/bun/solar-scene.spec.ts` runs the
// solar-system scene (`ui/solar.ts`) on the REAL vendored three.js
// (`ui/vendor/map-lib.js`) with no DOM and no WebGL; these fakes supply the few
// browser pieces the scene touches (canvas, 2d context, document, matchMedia,
// renderer, composer, frame clock). Nothing here touches the real store or the
// network. The file has no DOM types on purpose: tsconfig.bun.json has no `dom` lib.

// A pointer or wheel event as the fakes hand it to listeners.
export type FakeEvent = {
  type: string
  target: unknown
  clientX: number
  clientY: number
  pageX: number
  pageY: number
  button: number
  buttons: number
  pointerId: number
  pointerType: string
  deltaX: number
  deltaY: number
  deltaMode: number
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  preventDefault(): void
  stopPropagation(): void
  [key: string]: unknown
}

export type FakeListener = ((event: FakeEvent) => void) | { handleEvent(event: FakeEvent): void }

// Shared listener bookkeeping used by the canvas and the document.
class Listeners {
  private map = new Map<string, FakeListener[]>()

  add(type: string, fn: FakeListener): void {
    const list = this.map.get(type) ?? []
    // Like the browser: the same function twice for one type is stored once.
    if (!list.includes(fn)) list.push(fn)
    this.map.set(type, list)
  }

  remove(type: string, fn: FakeListener): void {
    const list = this.map.get(type)
    if (!list) return
    const at = list.indexOf(fn)
    if (at >= 0) list.splice(at, 1)
    if (list.length === 0) this.map.delete(type)
  }

  count(type?: string): number {
    if (type !== undefined) return this.map.get(type)?.length ?? 0
    let total = 0
    for (const list of this.map.values()) total += list.length
    return total
  }

  emit(type: string, init: Record<string, unknown>, target: unknown): void {
    const clientX = typeof init.clientX === 'number' ? init.clientX : 0
    const clientY = typeof init.clientY === 'number' ? init.clientY : 0
    const event: FakeEvent = {
      type,
      clientX,
      clientY,
      // three's OrbitControls reads pageX/pageY; with no scroll they equal clientX/Y.
      pageX: clientX,
      pageY: clientY,
      button: 0,
      buttons: 0,
      pointerId: 1,
      pointerType: 'mouse',
      deltaX: 0,
      deltaY: 0,
      deltaMode: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() {},
      stopPropagation() {},
      ...init,
      target,
    }
    // Copy so a listener that removes itself does not skip its neighbour.
    for (const fn of [...(this.map.get(type) ?? [])]) {
      if (typeof fn === 'function') fn(event)
      else fn.handleEvent(event)
    }
  }
}

// A 2d canvas context that draws nothing and remembers which methods were called.
export class FakeContext2d {
  font = ''
  fillStyle: unknown = ''
  strokeStyle: unknown = ''
  lineWidth = 1
  lineJoin = 'miter'
  textAlign = 'start'
  textBaseline = 'alphabetic'
  globalAlpha = 1
  calls: string[] = []
  // The fill style each fillRect was drawn with (a spec reads what a texture painted, e.g. a polar ice cap).
  rectFills: unknown[] = []

  private note(name: string): void {
    this.calls.push(name)
  }

  createRadialGradient(..._args: number[]): { addColorStop(offset: number, color: string): void } {
    this.note('createRadialGradient')
    return { addColorStop() {} }
  }

  createLinearGradient(..._args: number[]): { addColorStop(offset: number, color: string): void } {
    this.note('createLinearGradient')
    return { addColorStop() {} }
  }

  fillRect(..._args: number[]): void {
    this.note('fillRect')
    this.rectFills.push(this.fillStyle)
  }
  clearRect(..._args: number[]): void { this.note('clearRect') }
  beginPath(): void { this.note('beginPath') }
  moveTo(..._args: number[]): void { this.note('moveTo') }
  lineTo(..._args: number[]): void { this.note('lineTo') }
  closePath(): void { this.note('closePath') }
  fill(..._args: unknown[]): void { this.note('fill') }
  stroke(): void { this.note('stroke') }
  ellipse(..._args: unknown[]): void { this.note('ellipse') }
  arc(..._args: unknown[]): void { this.note('arc') }
  strokeText(..._args: unknown[]): void { this.note('strokeText') }
  fillText(..._args: unknown[]): void { this.note('fillText') }
  save(): void { this.note('save') }
  restore(): void { this.note('restore') }

  measureText(text: string): { width: number } {
    this.note('measureText')
    return { width: text.length * 8 }
  }
}

type Rect = {
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
  x: number
  y: number
}

// The fake `document`: makes canvases, and keeps listeners like a real one.
export class FakeDocument {
  canvases: FakeCanvas[] = []
  private listeners = new Listeners()

  createElement(tag: string): FakeCanvas | Record<string, unknown> {
    if (tag === 'canvas') {
      const canvas = new FakeCanvas(this)
      this.canvases.push(canvas)
      return canvas
    }
    return { tagName: tag.toUpperCase(), style: {} as Record<string, string> }
  }

  addEventListener(type: string, fn: FakeListener, _opts?: unknown): void {
    this.listeners.add(type, fn)
  }

  removeEventListener(type: string, fn: FakeListener): void {
    this.listeners.remove(type, fn)
  }

  // Test helpers, same shape as the canvas ones.
  emit(type: string, init: Record<string, unknown> = {}): void {
    this.listeners.emit(type, init, this)
  }

  listenerCount(type?: string): number {
    return this.listeners.count(type)
  }
}

// Serves as the scene's visible canvas and as the off-screen texture canvases.
export class FakeCanvas {
  width = 300
  height = 150
  clientWidth = 800
  clientHeight = 600
  style: Record<string, string> = {}
  tabIndex = 0
  ownerDocument: FakeDocument
  private ctx: FakeContext2d | null = null
  private listeners = new Listeners()

  constructor(doc?: FakeDocument) {
    this.ownerDocument = doc ?? new FakeDocument()
  }

  getContext(kind: string): FakeContext2d | null {
    if (kind !== '2d') return null
    this.ctx ??= new FakeContext2d()
    return this.ctx
  }

  addEventListener(type: string, fn: FakeListener, _opts?: unknown): void {
    this.listeners.add(type, fn)
  }

  removeEventListener(type: string, fn: FakeListener): void {
    this.listeners.remove(type, fn)
  }

  getBoundingClientRect(): Rect {
    return {
      left: 0,
      top: 0,
      width: this.clientWidth,
      height: this.clientHeight,
      right: this.clientWidth,
      bottom: this.clientHeight,
      x: 0,
      y: 0,
    }
  }

  setPointerCapture(_id?: number): void {}
  releasePointerCapture(_id?: number): void {}
  hasPointerCapture(_id?: number): boolean { return false }
  focus(): void {}
  getRootNode(): FakeDocument { return this.ownerDocument }
  contains(_other?: unknown): boolean { return false }

  // Test helper: call every listener registered for `type`.
  emit(type: string, init: Record<string, unknown> = {}): void {
    this.listeners.emit(type, init, this)
  }

  // Listeners on this canvas only (the document counts its own).
  listenerCount(type?: string): number {
    return this.listeners.count(type)
  }
}

// Stub for the three.js WebGLRenderer: records what was asked, draws nothing.
export class FakeRenderer {
  calls: string[] = []
  domElement: FakeCanvas
  info = { render: { calls: 0 } }
  pixelRatio = 1
  clearColor: unknown = null
  clearAlpha = 1
  size: [number, number] = [0, 0]
  renders = 0
  disposed = false
  contextLost = false

  constructor(canvas?: FakeCanvas | { canvas?: FakeCanvas }) {
    // Accept the canvas itself or three's `{ canvas, ... }` parameter object.
    const given = canvas instanceof FakeCanvas ? canvas : canvas?.canvas
    this.domElement = given ?? new FakeCanvas()
  }

  setPixelRatio(n: number): void {
    this.calls.push('setPixelRatio')
    this.pixelRatio = n
  }

  setClearColor(color: unknown, alpha = 1): void {
    this.calls.push('setClearColor')
    this.clearColor = color
    this.clearAlpha = alpha
  }

  setSize(w: number, h: number, _updateStyle?: boolean): void {
    this.calls.push('setSize')
    this.size = [w, h]
  }

  render(_scene?: unknown, _camera?: unknown): void {
    this.calls.push('render')
    this.renders++
    this.info.render.calls++
  }

  dispose(): void {
    this.calls.push('dispose')
    this.disposed = true
  }

  forceContextLoss(): void {
    this.calls.push('forceContextLoss')
    this.contextLost = true
  }
}

// Stub for the post-processing composer (bloom pass settings are plain fields).
export class FakeComposer {
  scene: unknown
  camera: unknown
  renderer: unknown
  bloom = { strength: 0, radius: 0, threshold: 0 }
  renders = 0
  disposed = false
  size: [number, number] | null = null

  constructor(renderer?: unknown, scene?: unknown, camera?: unknown) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
  }

  render(_delta?: number): void {
    this.renders++
  }

  setSize(w: number, h: number): void {
    this.size = [w, h]
  }

  dispose(): void {
    this.disposed = true
  }
}

// Frame loop driver: holds one pending callback, like requestAnimationFrame, and
// advances simulated time only when a test says so (never a real wait).
export class FakeClock {
  now = 0
  frames = 0
  cancelled = false
  private nextHandle = 1
  private pendingCb: ((ms: number) => void) | null = null
  private pendingHandle = 0

  request(cb: (ms: number) => void): number {
    this.pendingCb = cb
    this.pendingHandle = this.nextHandle++
    return this.pendingHandle
  }

  cancel(handle: number): void {
    if (this.pendingCb && handle === this.pendingHandle) {
      this.pendingCb = null
      this.cancelled = true
    }
  }

  pending(): boolean {
    return this.pendingCb !== null
  }

  tick(stepMs = 16): void {
    const cb = this.pendingCb
    if (!cb) return
    this.now += stepMs
    this.pendingCb = null
    cb(this.now)
    this.frames++
  }

  run(seconds: number, stepMs = 16): void {
    const steps = Math.ceil((seconds * 1000) / stepMs)
    for (let i = 0; i < steps; i++) this.tick(stepMs)
  }
}

type ChangeListener = (event: { matches: boolean }) => void

export type InstalledFakeDom = {
  document: FakeDocument
  /** How many reduced-motion change listeners are registered right now. */
  mediaListenerCount(): number
  setReducedMotion(on: boolean): void
  restore(): void
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const GLOBAL_KEYS = ['document', 'matchMedia', 'window', 'devicePixelRatio'] as const

// Puts the fake document, matchMedia, window and devicePixelRatio on globalThis.
// `restore()` puts every one of them back exactly as it was (or deletes it).
export function installFakeDom(options: { reducedMotion?: boolean } = {}): InstalledFakeDom {
  const g = globalThis as unknown as Record<string, unknown>
  const saved = new Map<string, { had: boolean; value: unknown }>()
  for (const key of GLOBAL_KEYS) saved.set(key, { had: key in g, value: g[key] })

  let reduced = options.reducedMotion === true
  const changeListeners = new Set<ChangeListener>()
  const document = new FakeDocument()

  const matchMedia = (query: string) => ({
    get matches(): boolean {
      return query === REDUCED_MOTION ? reduced : false
    },
    media: query,
    addEventListener(type: string, fn: ChangeListener): void {
      if (type === 'change' && query === REDUCED_MOTION) changeListeners.add(fn)
    },
    removeEventListener(type: string, fn: ChangeListener): void {
      if (type === 'change') changeListeners.delete(fn)
    },
  })

  g.document = document
  g.matchMedia = matchMedia
  if (!('window' in g)) g.window = globalThis
  g.devicePixelRatio = 1

  return {
    document,
    mediaListenerCount: () => changeListeners.size,
    setReducedMotion(on: boolean): void {
      reduced = on
      for (const fn of [...changeListeners]) fn({ matches: on })
    },
    restore(): void {
      for (const [key, was] of saved) {
        if (was.had) g[key] = was.value
        else delete g[key]
      }
    },
  }
}
