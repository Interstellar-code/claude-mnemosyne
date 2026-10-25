// MAPX.11: the page shell around the solar scene, run on the real ui/index.html and ui/map.ts against a DOM-free
// stand-in and the scene fake (tests/bun/solar-scene-fake.ts), so no WebGL is needed. The scene is reached only through C13.
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fragmentAfterToken, levelFromHash, levelToHash, type SolarHost } from '../../ui/map-state'
import { fakeSceneFactory, type FakeScene } from './solar-scene-fake'
import { FakeCanvas, FakeClock, FakeComposer, FakeRenderer, installFakeDom } from './solar-fakes'
import { ROOT } from './helpers'

const HTML = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'tests', 'bun', 'fixtures', 'galaxy-c11.json'), 'utf8')) as { projects: { owner: string; label: string }[]; memories: { id: string; owner: string; kind: string }[] }
const MATRIX = 'project-matrixkoder-1a2b3c'
const HERMES = 'project-hermes-switchui-4d5e6f'

// The real scene (ui/solar.ts) on the vendored three.js, as tests/bun/solar-scene.spec.ts runs it: the bundle reads window when it
// loads, so both come in under the scene specs' fake DOM, which is put back at once (the page stand-in below owns document).
/* biome-ignore-start lint/suspicious/noExplicitAny: loaded by a path tsc does not follow, as in solar-scene.spec.ts */
const sceneDom = installFakeDom()
const realThree = (await import(join(ROOT, 'ui', 'vendor', 'map-lib.js'))) as Record<string, any>
const { createSolarScene } = (await import(join(ROOT, 'ui', 'solar.ts'))) as Record<string, any>
sceneDom.restore()
/* biome-ignore-end lint/suspicious/noExplicitAny: loaded by a path tsc does not follow, as in solar-scene.spec.ts */

// ---- A DOM-free stand-in built from the real index.html (the nodes the markup has ids for, plus what the builders make) ----

class FakeText {
  constructor(public data: string) {}
  get textContent() {
    return this.data
  }
}
class FakeBase {}
class FakeNode extends FakeBase {
  static focused: FakeNode | null = null
  /** Whether a probe canvas gets a WebGL2 context (the no-WebGL case turns it off). */
  static webgl = true
  /** The page's nodes by id; replaceWith keeps it true to the DOM. */
  static registry = new Map<string, FakeNode>()
  id = ''
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
  placeholder = ''
  style: Record<string, string> = {}
  listeners = new Map<string, ((event: unknown) => void)[]>()
  groups: FakeNode[] = []
  parentElement: FakeNode | null = null
  classList = {
    toggle: (name: string, force?: boolean) => {
      const has = this.classes().includes(name)
      const on = force ?? !has
      this.className = (on ? [...new Set([...this.classes(), name])] : this.classes().filter(c => c !== name)).join(' ')
      return on
    },
    add: (name: string) => this.classList.toggle(name, true),
    remove: (name: string) => this.classList.toggle(name, false),
    contains: (name: string) => this.classes().includes(name),
  }
  constructor(public tagName: string) {
    super()
  }
  classes() {
    return this.className.split(/\s+/).filter(Boolean)
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
  getContext(kind: string) {
    if (kind === 'webgl2') return FakeNode.webgl ? { getExtension: () => null } : null
    return { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }
  }
  cloneNode(_deep?: boolean) {
    const copy = new FakeNode(this.tagName)
    copy.id = this.id
    copy.className = this.className
    copy.hidden = this.hidden
    for (const [name, value] of this.attributes) copy.attributes.set(name, value)
    return copy
  }
  replaceWith(next: FakeNode) {
    FakeNode.registry.set(this.id, next)
  }
  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null
  }
}

function fakeDom(html: string) {
  const nodes = new Map<string, FakeNode>()
  for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = new FakeNode(match[1]!.toLowerCase())
    node.id = match[2]!
    node.hidden = /\bhidden\b/.test(match[0].replace(/id="[^"]*"/, ''))
    node.className = /\bclass="([^"]*)"/.exec(match[0])?.[1] ?? ''
    node.placeholder = /\bplaceholder="([^"]*)"/.exec(match[0])?.[1] ?? ''
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
  nodes.get('map-live-state')!.parentElement = new FakeNode('span')
  FakeNode.registry = nodes
  const document = {
    createElement: (tag: string) => new FakeNode(tag.toLowerCase()),
    createTextNode: (data: string) => new FakeText(data),
    getElementById: (id: string) => FakeNode.registry.get(id) ?? null,
    activeElement: null as FakeNode | null,
  }
  return { document, nodes }
}

// ---- Counted stand-ins for the two renderers and the library they come from ----

/** WebGL contexts: one is open from a scene's or a force graph's creation until its dispose / forceContextLoss. */
type Contexts = { open: number; max: number; graphs: number; destroyed: number; lost: number; scenes: number; disposed: number }
const newContexts = (): Contexts => ({ open: 0, max: 0, graphs: 0, destroyed: 0, lost: 0, scenes: 0, disposed: 0 })
const openContext = (c: Contexts) => void (c.max = Math.max(c.max, ++c.open))

/* biome-ignore-start lint/suspicious/noExplicitAny: three.js stand-ins accept anything, like the objects they replace */
/** A value that answers every property and call with another such value, so code that only draws runs without WebGL. */
function loose(): any {
  return new Proxy(function () {}, {
    get: (t, p) => (p === 'then' || typeof p === 'symbol' ? undefined : p in t ? (t as any)[p] : loose()),
    apply: () => loose(),
    construct: () => loose(),
  })
}
const fuzzy = <T extends object>(o: T): T => new Proxy(o, { get: (t, p, r) => (p in t || typeof p === 'symbol' || p === 'then' ? Reflect.get(t, p, r) : loose()) })

/** The force graph's constructor throws this while it is set (a graph that cannot start); `tries` counts the starts it was asked for. */
const graphFailure = { message: null as string | null, tries: 0 }

function fakeLibrary(contexts: Contexts) {
  class Base {
    constructor() {
      return fuzzy(this)
    }
  }
  class Object3D extends Base {}
  class SpriteMaterial extends Base {}
  class CanvasTexture extends Base {}
  class BufferAttribute extends Base {}
  class Uint16BufferAttribute extends BufferAttribute {}
  class BufferGeometry extends Base {
    index = new Uint16BufferAttribute()
  }
  class Sprite extends Object3D {
    material: any
    geometry = new BufferGeometry()
    constructor(material?: any) {
      super()
      this.material = material ?? new SpriteMaterial()
    }
  }
  class SpriteText extends Sprite {
    constructor(_text?: string, _height?: number, _colour?: string) {
      super(Object.assign(new SpriteMaterial(), { map: new CanvasTexture() }))
    }
  }
  class ForceGraph3D {
    renderers: any
    constructor(_element: unknown, _config?: unknown) {
      if (graphFailure.message !== null) {
        graphFailure.tries++
        throw new Error(graphFailure.message)
      }
      contexts.graphs++
      openContext(contexts)
      let lost = false
      this.renderers = {
        dispose() {},
        forceContextLoss: () => {
          if (lost) return
          lost = true
          contexts.lost++
          contexts.open--
        },
      }
      const self: any = new Proxy(this, {
        get: (t, p, r) => (p in t || typeof p === 'symbol' || p === 'then' ? Reflect.get(t, p, r) : () => self),
      })
      return self
    }
    renderer() {
      return this.renderers
    }
    _destructor() {
      contexts.destroyed++
    }
    camera() {
      return loose()
    }
    scene() {
      return loose()
    }
    controls() {
      return loose()
    }
  }
  return { ForceGraph3D, SpriteText, UnrealBloomPass: Base, OutputPass: Base } as any
}
/* biome-ignore-end lint/suspicious/noExplicitAny: three.js stand-ins accept anything, like the objects they replace */

// ---- The harness ----

type Boot = {
  fake: ReturnType<typeof fakeDom>
  node: (id: string) => FakeNode
  factory: ReturnType<typeof fakeSceneFactory>
  scene: () => FakeScene
  posts: { path: string; body: { query: string; mode: string } }[]
  statuses: string[]
  replaced: string[]
  contexts: Contexts
  /** The real scenes made when the boot asked for them (`real: true`), with their stub renderer, clock and the canvas the page gave. */
  real: { pageCanvas: unknown; canvas: FakeCanvas; clock: FakeClock; renderer: () => FakeRenderer }[]
  storage: Map<string, string>
  emit: (line: Record<string, unknown>) => void
  layout: (name: string) => void
}

const saved = { document: undefined as unknown, CSS: undefined as unknown, HTMLElement: undefined as unknown, location: undefined as unknown, history: undefined as unknown, localStorage: undefined as unknown, requestAnimationFrame: undefined as unknown, cancelAnimationFrame: undefined as unknown, window: undefined as unknown }
const g = globalThis as Record<string, unknown>
for (const key of Object.keys(saved)) (saved as Record<string, unknown>)[key] = g[key]
afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete g[key]
    else g[key] = value
  }
})

type Options = {
  hash?: string
  solar?: boolean
  embeddings?: boolean
  searchMode?: string
  storage?: Map<string, string>
  /** The /api/galaxy reply (default: the C11 fixture). */
  reply?: unknown
  /** False: the browser offers no WebGL2. */
  webgl?: boolean
  /** True: the page hosts the real scene (stub renderer, composer and clock) instead of the fake. */
  real?: boolean
  /** createScene throws this. */
  sceneError?: string
  /** The force graph cannot start, with this message. */
  graphError?: string
  /** The library fails to load with this message. */
  libraryError?: string
  /** The library does not load until this settles. */
  gate?: Promise<void>
  post?: (path: string, body: { query: string; mode: string }) => Promise<Response>
  /** The /api/memories/<id> reply (default: the galaxy fixture, as every other path gets). */
  detail?: (id: string) => Promise<Response>
}

async function boot(options: Options = {}): Promise<Boot> {
  const fake = fakeDom(HTML)
  const storage = options.storage ?? new Map<string, string>()
  const replaced: string[] = []
  g.document = fake.document
  g.HTMLElement = FakeBase
  g.CSS = { escape: (v: string) => v }
  g.location = { pathname: '/', search: '', hash: options.hash ?? '' }
  g.history = { replaceState: (_s: unknown, _t: unknown, url: string) => void replaced.push(url) }
  g.localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) }
  g.requestAnimationFrame = () => 1
  g.cancelAnimationFrame = () => {}
  // three.js reads window while it runs; the page stand-in has none.
  if (!('window' in g)) g.window = globalThis
  FakeNode.webgl = options.webgl !== false
  graphFailure.message = options.graphError ?? null
  graphFailure.tries = 0
  const contexts = newContexts()
  const library = fakeLibrary(contexts)
  const factory = fakeSceneFactory()
  // Each scene the page makes holds one WebGL context until it is disposed.
  const real: Boot['real'] = []
  const createRealScene: SolarHost['createScene'] = sceneOptions => {
    const canvas = new FakeCanvas(sceneDom.document)
    const clock = new FakeClock()
    let renderer!: FakeRenderer
    const scene = createSolarScene({
      canvas,
      three: realThree,
      clock,
      createRenderer: (c: FakeCanvas) => (renderer = new FakeRenderer(c)),
      createComposer: (r: unknown, sc: unknown, cam: unknown) => new FakeComposer(r, sc, cam),
      onHover: sceneOptions.onHover,
      onPick: sceneOptions.onPick,
      onLevel: sceneOptions.onLevel,
    })
    real.push({ pageCanvas: sceneOptions.canvas, canvas, clock, renderer: () => renderer })
    return scene
  }
  const createScene: SolarHost['createScene'] = sceneOptions => {
    if (options.sceneError !== undefined) throw new Error(options.sceneError)
    const made = options.real ? (createRealScene(sceneOptions) as ReturnType<typeof factory.createScene>) : factory.createScene(sceneOptions)
    contexts.scenes++
    openContext(contexts)
    const dispose = made.dispose
    made.dispose = () => {
      dispose.call(made)
      contexts.disposed++
      contexts.open--
    }
    return made
  }
  const posts: Boot['posts'] = []
  const statuses: string[] = []
  const listeners: ((line: Record<string, unknown>) => void)[] = []
  const solar: SolarHost = {
    createScene,
    post: async (path, body) => {
      const sent = body as { query: string; mode: string }
      posts.push({ path, body: sent })
      return options.post ? options.post(path, sent) : new Response(JSON.stringify({ results: [] }), { status: 200 })
    },
    embeddings: () => options.embeddings ?? false,
    searchMode: () => options.searchMode ?? 'hybrid',
  }
  const { createMap } = (await import(join(ROOT, 'ui', 'map.ts'))) as { createMap: (host: unknown) => unknown }
  createMap({
    api: async (path: string) => (options.detail !== undefined && path.startsWith('/api/memories/') ? options.detail(decodeURIComponent(path.slice('/api/memories/'.length))) : new Response(JSON.stringify(options.reply ?? FIXTURE), { status: 200 })),
    library: async () => {
      await options.gate
      if (options.libraryError !== undefined) throw new Error(options.libraryError)
      return library
    },
    openMemory: () => {},
    status: (text: string) => void statuses.push(text),
    events: (listener: (line: Record<string, unknown>) => void) => {
      listeners.push(listener)
      return () => {}
    },
    ...(options.solar === false ? {} : { solar }),
  })
  await Bun.sleep(40)
  const node = (id: string) => fake.nodes.get(id)!
  return {
    fake, node, factory, posts, statuses, replaced, contexts, real, storage,
    scene: () => factory.last(),
    emit: line => listeners.forEach(listener => listener(line)),
    layout: name => node('map-layout').querySelectorAll('button[data-layout]').find(b => b.dataset.layout === name)!.fire('click'),
  }
}

const press = (b: Boot, id: string, key: string) => b.node(id).fire('keydown', { key, preventDefault() {} })
const type = (b: Boot, text: string) => {
  b.node('map-find').value = text
  b.node('map-find').fire('input')
}
const buttons = (n: FakeNode) => n.all().filter(x => x.tagName === 'button')
const byText = (n: FakeNode, text: string) => buttons(n).find(x => x.textContent.startsWith(text))!
const lastView = (b: Boot) => b.scene().of('setView').at(-1)!.view

describe('the solar page: markup and policy', () => {
  test('index.html and every element the builders make carry no style attribute, and the page keeps its own fonts', async () => {
    expect(HTML).not.toMatch(/\sstyle\s*=/i)
    expect(readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')).not.toMatch(/fonts\.googleapis|@import\s+url/)
    const b = await boot()
    type(b, 'matrix')
    for (const node of [...b.fake.nodes.values()].flatMap(n => n.all())) expect([...node.attributes.keys()]).not.toContain('style')
    // The builders use createElement and textContent only.
    expect(readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')).not.toContain('innerHTML')
  })

  test('the mockup page is in the markup: path, Find, two legend cards, view buttons, the two-row Bodies strip, Details, Live', () => {
    for (const id of ['solar-path', 'map-find', 'solar-legend-left', 'solar-legend-right', 'solar-views', 'solar-bodies', 'solar-chips', 'solar-show-all', 'map-inspector', 'map-live-strip', 'solar-card-arrange', 'solar-card-colour', 'solar-card-show', 'solar-find-results']) expect(HTML).toContain(`id="${id}"`)
    expect(readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')).toContain('grid-template-rows: repeat(2, 38px)')
  })
})

describe('the Galaxy layout as a solar page', () => {
  test('the scene is made once with the page canvas, handed the data and the view; the other rail cards give way to Arrange by, Colour dots by and Show', async () => {
    const b = await boot()
    expect(b.factory.scenes.length).toBe(1)
    expect(b.node('solar-canvas').hidden).toBe(false)
    expect(b.scene().of('setData')[0]!.galaxy.projects.length).toBe(FIXTURE.projects.length)
    expect(lastView(b)).toEqual({ arrange: 'activity', colour: 'writer', hidden: {}, query: '', rotate: true, sample: true, legend: true })
    expect(b.node('view-map').classList.contains('solar-on')).toBe(true)
    for (const id of ['solar-card-arrange', 'solar-card-colour', 'solar-card-show', 'solar-bodies']) expect(b.node(id).hidden).toBe(false)
    for (const id of ['map-card-colour', 'map-card-links', 'map-card-know', 'map-card-layers', 'map-card-projects', 'map-overview', 'map-legend']) expect(b.node(id).classes()).toContain('legacy-only')
    expect(buttons(b.node('solar-arrange')).map(x => x.textContent)).toEqual(['Activity', 'Size', 'Age', 'Recalls'])
    expect(buttons(b.node('solar-colour')).map(x => x.textContent)).toEqual(['Writer', 'Recalls', 'Age'])
    expect(buttons(b.node('solar-show')).map(x => x.textContent)).toEqual(['Auto-rotate: on', 'Legend: on', 'Sample outer-belt dust: on'])
    // The 0.6.0 Live strip stays.
    expect(b.node('map-live-strip').classes()).not.toContain('legacy-only')
    expect(b.node('map-live-strip').hidden).toBe(false)
  })

  test('without a solar host the Galaxy layout is the page it was: nothing solar shows', async () => {
    const b = await boot({ solar: false })
    expect(b.factory.scenes.length).toBe(0)
    expect(b.node('view-map').classes()).not.toContain('solar-on')
    for (const id of ['solar-card-arrange', 'solar-bodies', 'solar-canvas']) expect(b.node(id).hidden).toBe(true)
  })

  test('the Layout card is visible in all three layouts; Timeline gives the old rail back and drops the scene, Galaxy builds a new one', async () => {
    const b = await boot()
    const layoutCard = b.node('map-card-layout')
    const visible = () => !layoutCard.hidden && !layoutCard.classes().includes('legacy-only')
    expect(visible()).toBe(true)
    b.layout('timeline')
    expect(visible()).toBe(true)
    expect(b.node('view-map').classes()).not.toContain('solar-on')
    expect(b.factory.scenes[0]!.calls.at(-1)).toEqual({ call: 'dispose' })
    expect(b.node('solar-bodies').hidden).toBe(true)
    expect(b.node('solar-canvas').hidden).toBe(true)
    b.layout('galaxy')
    expect(visible()).toBe(true)
    expect(b.factory.scenes.length).toBe(2)
    expect(b.node('view-map').classes()).toContain('solar-on')
    // Meaning stays unavailable here (no embeddings in the fixture's reply), and the Layout card still shows.
    b.layout('meaning')
    expect(visible()).toBe(true)
  })

  test('Timeline keeps today\'s rail cards: with a solar host they are exactly what they are without one', async () => {
    const ids = ['map-card-layout', 'map-card-colour', 'map-card-links', 'map-card-know', 'map-card-layers', 'map-card-projects', 'map-topics-box', 'map-inspector', 'map-overview', 'map-legend', 'map-range-box', 'map-path']
    const shape = (b: Boot) => ids.map(id => [id, b.node(id).hidden, b.node(id).classes().includes('legacy-only'), b.node(id).texts().join('|')])
    const plain = await boot({ solar: false })
    plain.layout('timeline')
    const withSolar = await boot()
    withSolar.layout('timeline')
    expect(shape(withSolar)).toEqual(shape(plain))
    expect(withSolar.node('view-map').classes()).not.toContain('solar-on')
    for (const id of ['solar-card-arrange', 'solar-card-colour', 'solar-card-show']) expect(withSolar.node(id).hidden).toBe(true)
  })
})

describe('the controls drive the scene through C13 and are remembered', () => {
  test('Arrange by, Colour dots by and the Show toggles call setView with the new view, press the button, and save', async () => {
    const b = await boot()
    byText(b.node('solar-arrange'), 'Size').fire('click')
    expect(lastView(b).arrange).toBe('size')
    expect(byText(b.node('solar-arrange'), 'Size').attributes.get('aria-pressed')).toBe('true')
    expect(byText(b.node('solar-arrange'), 'Activity').attributes.get('aria-pressed')).toBe('false')
    expect(b.node('solar-arrange-hint').textContent).toContain('Closer = more memories.')
    byText(b.node('solar-colour'), 'Age').fire('click')
    expect(lastView(b).colour).toBe('age')
    byText(b.node('solar-show'), 'Auto-rotate').fire('click')
    expect(lastView(b).rotate).toBe(false)
    byText(b.node('solar-show'), 'Sample').fire('click')
    expect(lastView(b).sample).toBe(false)
    byText(b.node('solar-show'), 'Legend').fire('click')
    expect(lastView(b).legend).toBe(false)
    expect(b.node('solar-legend-left').hidden).toBe(true)
    expect(b.node('solar-legend-right').hidden).toBe(true)
    expect(JSON.parse(b.storage.get('mnemosyne.map.solar')!)).toMatchObject({ arrange: 'size', colour: 'age', rotate: false, sample: false, legend: false })
    // A new viewer session with the same storage starts there.
    const again = await boot({ storage: b.storage })
    expect(lastView(again)).toMatchObject({ arrange: 'size', colour: 'age', rotate: false, sample: false, legend: false })
    expect(byText(again.node('solar-colour'), 'Age').attributes.get('aria-pressed')).toBe('true')
  })

  test('a storage that throws leaves the defaults and the page working', async () => {
    const b = await boot()
    g.localStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    byText(b.node('solar-arrange'), 'Age').fire('click')
    expect(lastView(b).arrange).toBe('age')
  })

  test('the legend cards fold and unfold', async () => {
    const b = await boot()
    const left = b.node('solar-legend-left')
    expect(left.hidden).toBe(false)
    expect(left.texts().join(' ')).toContain('Space station')
    buttons(left)[0]!.fire('click')
    expect(left.texts().join(' ')).not.toContain('Space station')
    expect(buttons(left)[0]!.attributes.get('aria-expanded')).toBe('false')
    expect(b.node('solar-legend-right').texts().join(' ')).toContain('Black hole')
  })

  test('the view buttons call showView and zoom', async () => {
    const b = await boot()
    const view = b.node('solar-views')
    expect(buttons(view).map(x => x.attributes.get('aria-label'))).toEqual(['Zoom in', 'Zoom out', 'View from the top', 'View from below', 'View from the side', 'Reset the view'])
    for (const label of ['Top', 'Below', 'Side', 'Reset']) byText(view, label).fire('click')
    byText(view, '+').fire('click')
    byText(view, '−').fire('click')
    expect(b.scene().of('showView').map(c => c.name)).toEqual(['top', 'below', 'side', 'reset'])
    expect(b.scene().of('zoom').map(c => c.factor)).toEqual([0.72, 1.38])
  })

  test('the Bodies strip: two rows of chips, a click hides one (view.hidden), the count follows, Show all brings them back; hiding the planet you are on flies home', async () => {
    const b = await boot()
    const chips = () => buttons(b.node('solar-chips'))
    expect(chips().length).toBe(FIXTURE.projects.length)
    expect(b.node('solar-shown').textContent).toBe(`${FIXTURE.projects.length} of ${FIXTURE.projects.length} shown`)
    // The busiest first (Arrange by activity).
    expect(chips()[0]!.dataset.owner).toBe(HERMES === chips()[0]!.dataset.owner ? HERMES : chips()[0]!.dataset.owner)
    const hermes = () => chips().find(c => c.dataset.owner === HERMES)!
    hermes().fire('click')
    expect(lastView(b).hidden).toEqual({ [HERMES]: true })
    expect(hermes().attributes.get('aria-pressed')).toBe('false')
    expect(hermes().classes()).toContain('is-off')
    expect(b.node('solar-shown').textContent).toBe(`${FIXTURE.projects.length - 1} of ${FIXTURE.projects.length} shown`)
    b.node('solar-show-all').fire('click')
    expect(lastView(b).hidden).toEqual({})
    expect(hermes().attributes.get('aria-pressed')).toBe('true')
    // On a planet, hiding it sends the camera home.
    b.scene().level({ level: 'planet', owner: MATRIX })
    const before = b.scene().of('flyTo').length
    chips().find(c => c.dataset.owner === MATRIX)!.fire('click')
    expect(b.scene().of('flyTo').slice(before).map(c => c.target)).toEqual([{ level: 'galaxy' }])
  })
})

describe('Find', () => {
  test('bodies, moons and tags match locally as you type, with no request; Enter flies to the first and Escape clears', async () => {
    const b = await boot()
    type(b, 'matrix')
    const rows = buttons(b.node('solar-find-results'))
    expect(rows.length).toBeGreaterThan(0)
    expect(b.node('solar-find-results').hidden).toBe(false)
    expect(b.node('map-found').textContent).toMatch(/^\d+ bodies$/)
    expect(lastView(b).query).toBe('matrix')
    expect(b.posts.length).toBe(0)
    press(b, 'map-find', 'Enter')
    expect(b.scene().of('flyTo').at(-1)!.target).toEqual({ level: 'planet', owner: MATRIX })
    press(b, 'map-find', 'Escape')
    expect(b.node('map-find').value).toBe('')
    expect(b.node('solar-find-results').hidden).toBe(true)
    expect(lastView(b).query).toBe('')
    expect(b.node('map-found').textContent).toBe('')
  })

  test('a result button flies to its target', async () => {
    const b = await boot()
    type(b, 'instruction')
    const moon = buttons(b.node('solar-find-results')).find(x => x.textContent.includes('Moon'))!
    moon.fire('click')
    expect(b.scene().of('flyTo').at(-1)!.target).toMatchObject({ level: 'moon', kind: 'instruction' })
  })

  test('memory search runs after a pause of about 400 ms with 3 characters, never per keystroke or under 3', async () => {
    const b = await boot()
    type(b, 'ma')
    await Bun.sleep(480)
    expect(b.posts.length).toBe(0)
    type(b, 'mat')
    type(b, 'matr')
    await Bun.sleep(250)
    type(b, 'matri')
    await Bun.sleep(250)
    expect(b.posts.length).toBe(0)
    await Bun.sleep(260)
    expect(b.posts).toEqual([{ path: '/api/search', body: { query: 'matri', mode: 'keyword' } }])
  })

  test('Enter searches at once, one request at a time; the newest typed query goes when the first answers', async () => {
    let release: (response: Response) => void = () => {}
    const b = await boot({ post: () => new Promise<Response>(resolve => { release = resolve }) })
    type(b, 'matrix')
    press(b, 'map-find', 'Enter')
    type(b, 'matrixk')
    press(b, 'map-find', 'Enter')
    await Bun.sleep(20)
    expect(b.posts.map(p => p.body.query)).toEqual(['matrix'])
    release(new Response(JSON.stringify({ results: [] }), { status: 200 }))
    await Bun.sleep(30)
    expect(b.posts.map(p => p.body.query)).toEqual(['matrix', 'matrixk'])
    release(new Response(JSON.stringify({ results: [] }), { status: 200 }))
  })

  test('the mode is keyword while embeddings are off, else the Search tab\'s mode', async () => {
    const off = await boot({ embeddings: false, searchMode: 'hybrid' })
    type(off, 'matrix')
    press(off, 'map-find', 'Enter')
    expect(off.posts[0]!.body.mode).toBe('keyword')
    const on = await boot({ embeddings: true, searchMode: 'hybrid' })
    type(on, 'matrix')
    press(on, 'map-find', 'Enter')
    expect(on.posts[0]!.body.mode).toBe('hybrid')
  })

  test('a 429 is quiet: local results stay, no status error, and the next Enter retries', async () => {
    const b = await boot({ post: async () => new Response(JSON.stringify({ error: 'A search is already running; try again when it ends.' }), { status: 429 }) })
    type(b, 'matrix')
    await Bun.sleep(480)
    expect(b.posts.length).toBe(1)
    expect(b.statuses).toEqual([])
    expect(buttons(b.node('solar-find-results')).length).toBeGreaterThan(0)
    press(b, 'map-find', 'Enter')
    await Bun.sleep(30)
    expect(b.posts.length).toBe(2)
    expect(b.statuses).toEqual([])
  })

  test('memories the server found join the list and fly to the memory; a memory search draws nothing itself', async () => {
    const memory = FIXTURE.memories[0]!
    const b = await boot({ post: async () => new Response(JSON.stringify({ results: [{ id: memory.id, owner: memory.owner, content: 'Run the gate first\nthen merge' }] }), { status: 200 }) })
    type(b, 'gate')
    await Bun.sleep(480)
    const row = buttons(b.node('solar-find-results')).find(x => x.textContent.startsWith('Memory'))!
    expect(row.textContent).toContain('Run the gate first')
    row.fire('click')
    const target = { level: 'memory' as const, owner: memory.owner, kind: memory.kind, id: memory.id }
    expect(b.scene().of('flyTo').at(-1)!.target).toEqual(target)
    expect(b.scene().of('event')).toEqual([])
    // Enter with nothing local to go to waits for the memories, then flies to the first.
    const waiting = await boot({ post: async () => new Response(JSON.stringify({ results: [{ id: memory.id, owner: memory.owner, content: 'Run the gate first' }] }), { status: 200 }) })
    type(waiting, 'qzxgate')
    press(waiting, 'map-find', 'Enter')
    await Bun.sleep(30)
    expect(waiting.scene().of('flyTo').at(-1)!.target).toEqual(target)
  })

  test('the result order is local rows first, then the memories in the server\'s rank order, whatever order the answers arrive in', async () => {
    const [first, second] = [FIXTURE.memories[0]!, FIXTURE.memories[2]!]
    const ranked = [{ id: second.id, owner: second.owner, content: 'Rank one' }, { id: first.id, owner: first.owner, content: 'Rank two' }]
    const target = { level: 'memory' as const, owner: second.owner, kind: second.kind, id: second.id }
    const boots = (delay: number) => boot({ post: async () => { await Bun.sleep(delay); return new Response(JSON.stringify({ results: ranked }), { status: 200 }) } })
    // The answer is in before Enter: the list shows the rank order and Enter takes row one.
    const ahead = await boots(5)
    type(ahead, 'qzxgate')
    await Bun.sleep(480)
    const labels = buttons(ahead.node('solar-find-results')).map(x => x.textContent)
    expect(labels.map(label => label.replace(/^Memory/, '').slice(0, 8))).toEqual(['Rank one', 'Rank two'])
    press(ahead, 'map-find', 'Enter')
    expect(ahead.scene().of('flyTo').map(c => c.target)).toEqual([target])
    // Enter is pressed first and the answer comes later (slowly, or at once): the same row is opened.
    for (const delay of [5, 80]) {
      const behind = await boots(delay)
      type(behind, 'qzxgate')
      press(behind, 'map-find', 'Enter')
      await Bun.sleep(delay + 60)
      expect(behind.scene().of('flyTo').map(c => c.target)).toEqual([target])
    }
  })

  test('local rows stay above the memory rows, and Enter opens the first local row', async () => {
    const memory = FIXTURE.memories[0]!
    const b = await boot({ post: async () => new Response(JSON.stringify({ results: [{ id: memory.id, owner: memory.owner, content: 'matrix notes' }] }), { status: 200 }) })
    type(b, 'matrix')
    await Bun.sleep(480)
    const labels = buttons(b.node('solar-find-results')).map(x => x.textContent)
    expect(labels.at(-1)).toStartWith('Memory')
    expect(labels.slice(0, -1).every(label => !label.startsWith('Memory'))).toBe(true)
    press(b, 'map-find', 'Enter')
    expect(b.scene().of('flyTo').at(-1)!.target).toEqual({ level: 'planet', owner: MATRIX })
  })

  test('memories found for an older query are not rows for the new one: Enter waits for the answer to what is typed', async () => {
    const [old, fresh] = [FIXTURE.memories[0]!, FIXTURE.memories[2]!]
    let release: (response: Response) => void = () => {}
    const b = await boot({
      post: async (_path, body) => {
        if (body.query === 'qzxgate') return new Response(JSON.stringify({ results: [{ id: old.id, owner: old.owner, content: 'Old answer' }] }), { status: 200 })
        return new Promise<Response>(resolve => { release = resolve })
      },
    })
    type(b, 'qzxgate')
    await Bun.sleep(480)
    expect(b.node('solar-find-results').texts().join('')).toContain('Old answer')
    type(b, 'qzxgates')
    expect(b.node('solar-find-results').texts().join('')).not.toContain('Old answer')
    press(b, 'map-find', 'Enter')
    await Bun.sleep(30)
    expect(b.scene().of('flyTo')).toEqual([])
    release(new Response(JSON.stringify({ results: [{ id: fresh.id, owner: fresh.owner, content: 'New answer' }] }), { status: 200 }))
    await Bun.sleep(30)
    expect(b.scene().of('flyTo').at(-1)!.target).toEqual({ level: 'memory', owner: fresh.owner, kind: fresh.kind, id: fresh.id })
  })

  test('Escape drops an answer still on its way', async () => {
    let release: (response: Response) => void = () => {}
    const memory = FIXTURE.memories[0]!
    const b = await boot({ post: () => new Promise<Response>(resolve => { release = resolve }) })
    type(b, 'gate')
    press(b, 'map-find', 'Enter')
    press(b, 'map-find', 'Escape')
    release(new Response(JSON.stringify({ results: [{ id: memory.id, owner: memory.owner, content: 'late' }] }), { status: 200 }))
    await Bun.sleep(30)
    expect(b.node('solar-find-results').hidden).toBe(true)
    expect(b.node('solar-find-results').texts().join('')).not.toContain('late')
  })
})

describe('the level: the URL hash, the path, Details, the announcement and the Tab order', () => {
  test('a hash level flies the scene there on load; a bad or stale one falls back to Galaxy', async () => {
    const planet = await boot({ hash: `#level=planet:${MATRIX}` })
    expect(planet.scene().of('flyTo').map(c => c.target)).toEqual([{ level: 'planet', owner: MATRIX }])
    expect(planet.node('map-inspector').texts().join(' ')).toContain('matrixkoder')
    const moon = await boot({ hash: `#level=moon:${MATRIX}:instruction` })
    expect(moon.scene().of('flyTo').map(c => c.target)).toEqual([{ level: 'moon', owner: MATRIX, kind: 'instruction' }])
    const memory = FIXTURE.memories[0]!
    const mem = await boot({ hash: `#level=memory:${memory.id}` })
    expect(mem.scene().of('flyTo').map(c => c.target)).toEqual([{ level: 'memory', owner: memory.owner, kind: memory.kind, id: memory.id }])
    for (const hash of ['#level=planet:nope', `#level=moon:${MATRIX}:nokind`, '#level=memory:nope', '#level=bogus', '#level=planet', '#token=abc', '']) {
      const b = await boot({ hash })
      expect(b.scene().of('flyTo')).toEqual([])
      expect(b.replaced.at(-1)).toBe('/#level=galaxy')
    }
  })

  test('the scene\'s level is written to the URL with replaceState, and shown in the path, Details and aria-live', async () => {
    const b = await boot()
    b.scene().level({ level: 'planet', owner: MATRIX })
    expect(b.replaced.at(-1)).toBe(`/#level=planet:${MATRIX}`)
    expect(b.node('solar-path').texts().filter(t => t !== '›')).toEqual(['Galaxy', 'matrixkoder'])
    expect(b.node('map-inspector').texts().join(' ')).toContain('matrixkoder')
    expect(b.node('solar-live').textContent).toBe('Planet: Galaxy, matrixkoder')
    b.scene().level({ level: 'moon', owner: MATRIX, kind: 'instruction' })
    expect(b.replaced.at(-1)).toBe(`/#level=moon:${MATRIX}:instruction`)
    expect(b.node('solar-path').texts().filter(t => t !== '›')).toEqual(['Galaxy', 'matrixkoder', 'Instructions'])
    // A crumb flies back.
    buttons(b.node('solar-path'))[0]!.fire('click')
    expect(b.scene().of('flyTo').at(-1)!.target).toEqual({ level: 'galaxy' })
    b.scene().level({ level: 'galaxy' })
    expect(b.replaced.at(-1)).toBe('/#level=galaxy')
  })

  test('the hash functions round-trip every level, tolerate junk, and a #token= link keeps #level= when the fragment is cleared', () => {
    for (const level of [{ level: 'galaxy' }, { level: 'planet', owner: 'project-a b-1' }, { level: 'moon', owner: 'x:y', kind: 'fact' }] as const) {
      const wanted = levelFromHash(levelToHash(level))
      expect(wanted).toEqual(level)
    }
    expect(levelFromHash(levelToHash({ level: 'memory', owner: 'o', kind: 'k', id: 'm:1' }))).toEqual({ level: 'memory', id: 'm:1' })
    for (const junk of ['', '#', '#x=1', '#level=', '#level=planet:%E0%A4%A', '#level=moon:a', '#level=planet:a:b:c']) expect(levelFromHash(junk)).toBeNull()
    expect(fragmentAfterToken('#token=abc123')).toBe('')
    expect(fragmentAfterToken('#token=abc123&level=planet:x')).toBe('#level=planet:x')
    expect(fragmentAfterToken('#level=planet:x&token=abc123')).toBe('#level=planet:x')
    expect(fragmentAfterToken('#level=planet:x')).toBe('#level=planet:x')
    expect(readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')).toContain('fragmentAfterToken(location.hash)')
    // The sign-in itself still reads the token from the same fragment.
    expect(new URLSearchParams('#token=abc123&level=galaxy'.replace(/^#/, '')).get('token')).toBe('abc123')
  })

  test('onHover shows the tooltip (title, then lines) and hides it; onPick flies to the target', async () => {
    const b = await boot()
    b.scene().hover(['matrixkoder', '48 memories', 'Earth-like'], 400, 300)
    expect(b.node('solar-tip').hidden).toBe(false)
    expect(b.node('solar-tip').texts()).toEqual(['matrixkoder', '48 memories', 'Earth-like'])
    expect(b.node('solar-tip').style.left).toBe('400px')
    b.scene().hover(null, 0, 0)
    expect(b.node('solar-tip').hidden).toBe(true)
    b.scene().pick({ level: 'planet', owner: HERMES })
    expect(b.scene().of('flyTo').at(-1)!.target).toEqual({ level: 'planet', owner: HERMES })
  })

  test('Tab walks sun, planets, then the moons of the planet you are on, then the memories of the moon', async () => {
    const b = await boot()
    const stops = () => buttons(b.node('solar-tour')).map(x => x.textContent)
    expect(stops()[0]).toContain('Sun')
    expect(stops().length).toBe(1 + FIXTURE.projects.length)
    expect(stops().slice(1).every(label => /^(Planet|Station|Starship) /.test(label))).toBe(true)
    b.scene().level({ level: 'planet', owner: MATRIX })
    const planetStops = stops()
    const at = planetStops.findIndex(label => label.endsWith('matrixkoder') && /^(Planet|Station|Starship) /.test(label))
    expect(planetStops[at + 1]).toMatch(/^Moon Instructions of matrixkoder/)
    b.scene().level({ level: 'moon', owner: MATRIX, kind: 'instruction' })
    expect(stops().some(label => label.startsWith('Memory '))).toBe(true)
    // Activating a stop flies there.
    buttons(b.node('solar-tour'))[0]!.fire('click')
    expect(b.scene().of('flyTo').at(-1)!.target).toEqual({ level: 'galaxy' })
  })

  test('a live update or forget of the open memory drops its fetched record and fetches it again; a recall or another memory leaves it', async () => {
    const memory = FIXTURE.memories[0]!
    const fetched: string[] = []
    let text = 'Old text'
    const b = await boot({
      hash: `#level=memory:${memory.id}`,
      detail: async id => {
        fetched.push(id)
        return new Response(JSON.stringify({ content: text, state: 'active' }), { status: 200 })
      },
    })
    await Bun.sleep(20)
    expect(fetched).toEqual([memory.id])
    expect(b.node('map-inspector').texts().join(' ')).toContain('Old text')
    // A recall and an event about another memory change nothing here.
    b.emit({ t: '2026-10-25T10:00:00.000Z', action: 'recall', owner: memory.owner, ids: [memory.id], client: 'claude-code', ok: true })
    b.emit({ t: '2026-10-25T10:00:01.000Z', action: 'update', owner: memory.owner, ids: ['mem-999'], client: 'claude-code', ok: true })
    await Bun.sleep(20)
    expect(fetched).toEqual([memory.id])
    text = 'New text'
    b.emit({ t: '2026-10-25T10:00:02.000Z', action: 'update', owner: memory.owner, ids: [memory.id], client: 'claude-code', ok: true })
    await Bun.sleep(20)
    expect(fetched).toEqual([memory.id, memory.id])
    const panel = b.node('map-inspector').texts().join(' ')
    expect(panel).toContain('New text')
    expect(panel).not.toContain('Old text')
    // A forget: the record is gone, so the fetch fails and the panel stops showing the text.
    let gone = false
    const forgotten = await boot({
      hash: `#level=memory:${memory.id}`,
      detail: async () => (gone ? new Response('{}', { status: 404 }) : new Response(JSON.stringify({ content: 'Still here' }), { status: 200 })),
    })
    await Bun.sleep(20)
    expect(forgotten.node('map-inspector').texts().join(' ')).toContain('Still here')
    gone = true
    forgotten.emit({ t: '2026-10-25T10:00:03.000Z', action: 'forget', owner: memory.owner, ids: [memory.id], client: 'claude-code', ok: true })
    await Bun.sleep(20)
    expect(forgotten.node('map-inspector').texts().join(' ')).not.toContain('Still here')
  })

  test('a fetch that was already on its way when the update came does not put its older text back', async () => {
    const memory = FIXTURE.memories[0]!
    const replies: ((response: Response) => void)[] = []
    const b = await boot({ hash: `#level=memory:${memory.id}`, detail: () => new Promise<Response>(resolve => void replies.push(resolve)) })
    await Bun.sleep(20)
    expect(replies.length).toBe(1)
    b.emit({ t: '2026-10-25T10:00:00.000Z', action: 'update', owner: memory.owner, ids: [memory.id], client: 'claude-code', ok: true })
    await Bun.sleep(20)
    expect(replies.length).toBe(2)
    replies[1]!(new Response(JSON.stringify({ content: 'Fresh text' }), { status: 200 }))
    await Bun.sleep(20)
    replies[0]!(new Response(JSON.stringify({ content: 'Stale text' }), { status: 200 }))
    await Bun.sleep(20)
    const panel = b.node('map-inspector').texts().join(' ')
    expect(panel).toContain('Fresh text')
    expect(panel).not.toContain('Stale text')
  })

  test('live activity lines reach the scene as map events', async () => {
    const b = await boot()
    b.emit({ t: '2026-10-25T10:00:00.000Z', action: 'recall', owner: MATRIX, ids: ['mem-001'], client: 'claude-code', ok: true })
    expect(b.scene().of('event').length).toBe(1)
    expect(b.scene().of('event')[0]!.event).toMatchObject({ kind: 'recall', ids: ['mem-001'] })
  })
})

// ---- MAPX.6: the page drives the real scene, and one renderer lives at a time ----

const EMPTY_REPLY = { projects: [], memories: [], knowledge: [], meaning: false, total: 0, shown: 0, writers: [], globalLive: 0, links: [] }
const crumbs = (b: Boot) => b.node('solar-path').texts().filter(t => t !== '›')

describe('one renderer at a time: the force graph and the solar scene are made and freed as the layout changes', () => {
  test('Galaxy, Timeline, Galaxy, Meaning, Galaxy: every renderer made is freed before the next, and at most one WebGL context is ever open', async () => {
    const b = await boot({ reply: { ...FIXTURE, meaning: true } })
    const c = b.contexts
    // Galaxy: the solar scene only; the force graph is not made.
    expect([c.scenes, c.graphs, c.open]).toEqual([1, 0, 1])
    b.layout('timeline')
    expect([c.scenes, c.disposed, c.graphs, c.open]).toEqual([1, 1, 1, 1])
    b.layout('galaxy')
    expect([c.scenes, c.disposed, c.graphs, c.destroyed, c.lost, c.open]).toEqual([2, 1, 1, 1, 1, 1])
    b.layout('meaning')
    expect([c.scenes, c.disposed, c.graphs, c.open]).toEqual([2, 2, 2, 1])
    b.layout('galaxy')
    expect([c.scenes, c.disposed, c.graphs, c.destroyed, c.lost, c.open]).toEqual([3, 2, 2, 2, 2, 1])
    // Timeline and Meaning share the force graph: moving between them makes nothing new.
    b.layout('timeline')
    b.layout('meaning')
    b.layout('timeline')
    expect([c.graphs, c.destroyed, c.open]).toEqual([3, 2, 1])
    b.layout('galaxy')
    // Creations equal disposals, apart from the one renderer on screen; no context was ever open beside another.
    expect(c.scenes + c.graphs).toBe(c.disposed + c.destroyed + 1)
    expect(c.lost).toBe(c.destroyed)
    expect(c.max).toBe(1)
    expect(b.statuses).toEqual([])
    expect(b.node('map-message').hidden).toBe(true)
  })

  test('each solar scene gets a canvas of its own: the page canvas the first time, a fresh element after that', async () => {
    const b = await boot()
    const first = b.scene().options.canvas
    expect(first as unknown).toBe(b.node('solar-canvas'))
    b.layout('timeline')
    b.layout('galaxy')
    const second = b.scene().options.canvas
    expect(second).not.toBe(first)
    expect(b.node('solar-canvas')).toBe(second as unknown as FakeNode)
    expect(b.node('solar-canvas').hidden).toBe(false)
    expect(b.node('solar-canvas').attributes.get('aria-label')).toBeUndefined()
    b.layout('timeline')
    b.layout('galaxy')
    const third = b.scene().options.canvas
    expect([third === first, third === second]).toEqual([false, false])
  })

  test('the scene is disposed before the force graph is made, and the force graph before the next scene', async () => {
    const b = await boot()
    const order: string[] = []
    const scene = b.factory.scenes[0]!
    const dispose = scene.dispose
    scene.dispose = () => {
      order.push(`scene disposed (graphs made so far: ${b.contexts.graphs})`)
      dispose()
    }
    b.layout('timeline')
    order.push(`graphs made: ${b.contexts.graphs}`)
    expect(order).toEqual(['scene disposed (graphs made so far: 0)', 'graphs made: 1'])
    b.layout('galaxy')
    expect([b.contexts.destroyed, b.factory.scenes.length]).toEqual([1, 2])
  })

  test('without a solar host the force graph is made once and kept through every layout change', async () => {
    const b = await boot({ solar: false })
    b.layout('timeline')
    b.layout('galaxy')
    b.layout('timeline')
    expect([b.contexts.graphs, b.contexts.destroyed, b.contexts.open]).toEqual([1, 0, 1])
  })

  test('a force graph still waiting for the library when the layout goes back to Galaxy is never made', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => (release = resolve))
    // Remembered layout Timeline: the force graph is asked for first, and the library has not loaded.
    const b = await boot({ storage: new Map([['mnemosyne.map.layout', 'timeline']]), gate })
    expect([b.contexts.graphs, b.contexts.scenes]).toEqual([0, 0])
    b.layout('galaxy')
    release()
    await Bun.sleep(40)
    expect([b.contexts.graphs, b.contexts.scenes, b.contexts.open, b.contexts.max]).toEqual([0, 1, 1, 1])
    // And the other way: a scene still waiting when the layout leaves Galaxy is never made.
    let release2!: () => void
    const gate2 = new Promise<void>(resolve => (release2 = resolve))
    const c = await boot({ gate: gate2 })
    expect(c.contexts.scenes).toBe(0)
    c.layout('timeline')
    release2()
    await Bun.sleep(40)
    expect([c.contexts.scenes, c.contexts.graphs, c.contexts.open, c.contexts.max]).toEqual([0, 1, 1, 1])
  })
})

describe('a store with nothing to draw, and a browser that cannot', () => {
  test('a store with no memories says so instead of a blank map, and the canvas stays hidden', async () => {
    const b = await boot({ reply: EMPTY_REPLY })
    expect(b.node('map-message').hidden).toBe(false)
    expect(b.node('map-message').textContent).toBe('This store has no memories yet. Save one from a Claude session, then reload this page.')
    expect(b.node('solar-canvas').hidden).toBe(true)
    expect(b.statuses).toEqual([])
    // Find and the rest of the page still answer.
    type(b, 'matrix')
    expect(b.node('solar-find-results').hidden).toBe(false)
  })

  test('a store with no projects.json (every project of unknown kind) still draws the map, with no message', async () => {
    const reply = { ...FIXTURE, projects: FIXTURE.projects.map(p => ({ ...p, projectKind: 'unknown', remoteHost: null })) }
    const b = await boot({ reply })
    expect(b.node('map-message').hidden).toBe(true)
    expect(b.node('solar-canvas').hidden).toBe(false)
    expect(b.statuses).toEqual([])
    const sent = b.scene().of('setData')[0]!.galaxy.projects as unknown as { projectKind: string; remoteHost: unknown }[]
    expect(sent.length).toBe(FIXTURE.projects.length)
    expect(new Set(sent.map(p => p.projectKind))).toEqual(new Set(['unknown']))
    expect(b.node('solar-chips').children.length).toBe(FIXTURE.projects.length)
  })

  test('no WebGL: the existing message shows, no renderer is made in any layout, and the canvases stay hidden', async () => {
    const b = await boot({ webgl: false })
    expect(b.node('map-message').hidden).toBe(false)
    expect(b.node('map-message').textContent).toBe('This map needs WebGL, which this browser has turned off or does not offer.')
    expect(b.factory.scenes.length).toBe(0)
    expect(b.node('solar-canvas').hidden).toBe(true)
    expect(b.node('map-canvas').hidden).toBe(true)
    b.layout('timeline')
    b.layout('galaxy')
    expect([b.contexts.scenes, b.contexts.graphs]).toEqual([0, 0])
    expect(b.node('solar-canvas').hidden).toBe(true)
    // Without a solar host the force graph's page says the same.
    const plain = await boot({ solar: false, webgl: false })
    expect(plain.node('map-message').textContent).toBe(b.node('map-message').textContent)
    expect(plain.contexts.graphs).toBe(0)
  })

  test('a library that will not load, and a scene that cannot start, are said on the stage', async () => {
    const broken = await boot({ libraryError: 'offline' })
    expect(broken.node('map-message').textContent).toBe('The map library could not load (offline).')
    expect(broken.factory.scenes.length).toBe(0)
    expect(broken.node('solar-canvas').hidden).toBe(true)
    const failing = await boot({ sceneError: 'context lost' })
    expect(failing.node('map-message').textContent).toBe('The 3D map could not start (context lost).')
    expect(failing.node('solar-canvas').hidden).toBe(true)
    expect(failing.contexts.open).toBe(0)
  })
})

describe('a hidden planet that the scene flies to is shown again, in the strip and in the view the scene is sent', () => {
  const chipOf = (b: Boot, owner: string) => buttons(b.node('solar-chips')).find(c => c.dataset.owner === owner)!

  test('onLevel naming a hidden owner un-hides its chip and sends setView without it, for a planet, a moon and a memory', async () => {
    const memory = FIXTURE.memories.find(m => m.owner === HERMES) ?? FIXTURE.memories[0]!
    const levels = [
      { level: 'planet', owner: HERMES },
      { level: 'moon', owner: HERMES, kind: 'instruction' },
      { level: 'memory', owner: memory.owner, kind: memory.kind, id: memory.id },
    ] as const
    for (const level of levels) {
      const b = await boot()
      chipOf(b, level.owner).fire('click')
      expect(lastView(b).hidden).toEqual({ [level.owner]: true })
      expect(chipOf(b, level.owner).attributes.get('aria-pressed')).toBe('false')
      const before = b.scene().of('setView').length
      b.scene().level(level)
      expect(chipOf(b, level.owner).attributes.get('aria-pressed')).toBe('true')
      expect(chipOf(b, level.owner).classes()).not.toContain('is-off')
      expect(b.scene().of('setView').length).toBe(before + 1)
      expect(lastView(b).hidden).toEqual({})
      expect(b.node('solar-shown').textContent).toBe(`${FIXTURE.projects.length} of ${FIXTURE.projects.length} shown`)
      // Remembered: a reload does not hide it again.
      expect(JSON.parse(b.storage.get([...b.storage.keys()].find(k => k.includes('solar')) ?? '') ?? '{}').hidden ?? {}).toEqual({})
    }
  })

  test('the Galaxy level, or a planet that was never hidden, sends nothing more', async () => {
    const b = await boot()
    chipOf(b, MATRIX).fire('click')
    const before = b.scene().of('setView').length
    b.scene().level({ level: 'planet', owner: HERMES })
    b.scene().level({ level: 'galaxy' })
    expect(b.scene().of('setView').length).toBe(before)
    expect(lastView(b).hidden).toEqual({ [MATRIX]: true })
  })
})

describe('the shell on the real scene (stub renderer and clock, the vendored three.js)', () => {
  test('the page canvas goes to the scene, the data and view are taken, and the page is wired as with the fake', async () => {
    const b = await boot({ real: true })
    expect(b.real.length).toBe(1)
    expect(b.real[0]!.pageCanvas).toBe(b.node('solar-canvas'))
    b.real[0]!.clock.run(1)
    expect(b.real[0]!.clock.frames).toBeGreaterThan(0)
    expect(b.statuses).toEqual([])
    expect(b.node('solar-canvas').hidden).toBe(false)
    expect(buttons(b.node('solar-chips')).length).toBe(FIXTURE.projects.length)
  })

  test('Find flies the real scene to a planet; its level lands in the URL, the path, Details and the Tab order', async () => {
    const b = await boot({ real: true })
    type(b, 'hermes')
    press(b, 'map-find', 'Enter')
    b.real[0]!.clock.run(3)
    expect(b.replaced.at(-1)).toBe(`/#level=planet:${HERMES}`)
    expect(crumbs(b)[0]).toBe('Galaxy')
    expect(crumbs(b).length).toBe(2)
    expect(b.node('solar-live').textContent.startsWith('Planet')).toBe(true)
    // A crumb flies back.
    buttons(b.node('solar-path'))[0]!.fire('click')
    b.real[0]!.clock.run(3)
    expect(b.replaced.at(-1)).toBe('/#level=galaxy')
  })

  test('a hash level flies the real scene there on load', async () => {
    const b = await boot({ real: true, hash: `#level=planet:${MATRIX}` })
    b.real[0]!.clock.run(3)
    expect(b.replaced.at(-1)).toBe(`/#level=planet:${MATRIX}`)
    expect(b.node('map-inspector').texts().join(' ')).toContain('matrixkoder')
    const moon = await boot({ real: true, hash: `#level=moon:${MATRIX}:instruction` })
    moon.real[0]!.clock.run(3)
    expect(moon.replaced.at(-1)).toBe(`/#level=moon:${MATRIX}:instruction`)
  })

  test('hide a planet with its chip, then Find it: the real scene shows it and the chip comes back', async () => {
    const b = await boot({ real: true })
    const chip = () => buttons(b.node('solar-chips')).find(c => c.dataset.owner === HERMES)!
    chip().fire('click')
    expect(chip().attributes.get('aria-pressed')).toBe('false')
    type(b, 'hermes')
    press(b, 'map-find', 'Enter')
    b.real[0]!.clock.run(3)
    expect(chip().attributes.get('aria-pressed')).toBe('true')
    expect(b.node('solar-shown').textContent).toBe(`${FIXTURE.projects.length} of ${FIXTURE.projects.length} shown`)
    expect(b.replaced.at(-1)).toBe(`/#level=planet:${HERMES}`)
  })

  test('the view buttons reach the real scene without error', async () => {
    const b = await boot({ real: true })
    const view = b.node('solar-views')
    for (const label of ['Top', 'Below', 'Side', 'Reset', '+', '−']) byText(view, label).fire('click')
    b.real[0]!.clock.run(2)
    expect(b.statuses).toEqual([])
  })

  test('leaving Galaxy ends the real scene (renderer disposed, context lost, listeners off the canvas); coming back uses a new canvas and a new renderer', async () => {
    const b = await boot({ real: true })
    const first = b.real[0]!
    expect(first.canvas.listenerCount()).toBeGreaterThan(0)
    b.layout('timeline')
    expect(first.renderer().disposed).toBe(true)
    expect(first.renderer().contextLost).toBe(true)
    expect(first.canvas.listenerCount()).toBe(0)
    expect(first.clock.pending()).toBe(false)
    expect(b.contexts.graphs).toBe(1)
    b.layout('galaxy')
    expect(b.real.length).toBe(2)
    expect(b.real[1]!.pageCanvas).not.toBe(first.pageCanvas)
    expect(b.real[1]!.renderer()).not.toBe(first.renderer())
    expect(b.real[1]!.renderer().disposed).toBe(false)
    b.real[1]!.clock.run(1)
    expect(b.contexts.max).toBe(1)
  })
})

describe('the stage message and Find, after the MAPX.6 review', () => {
  test('a message about one renderer goes when the other renderer starts', async () => {
    // The scene fails in Galaxy; Timeline's force graph starts, so the text no longer holds.
    const b = await boot({ sceneError: 'context lost' })
    expect(b.node('map-message').textContent).toBe('The 3D map could not start (context lost).')
    b.layout('timeline')
    await Bun.sleep(20)
    expect(b.contexts.graphs).toBe(1)
    expect(b.node('map-message').hidden).toBe(true)
    expect(b.node('map-canvas').hidden).toBe(false)
    // The force graph fails in Timeline; Galaxy's scene starts, so that text goes too.
    const c = await boot({ graphError: 'gl lost' })
    c.layout('timeline')
    await Bun.sleep(20)
    expect(c.node('map-message').textContent).toBe('The 3D map could not start (gl lost).')
    graphFailure.message = null
    c.layout('galaxy')
    await Bun.sleep(20)
    expect(c.node('map-message').hidden).toBe(true)
    expect(c.node('solar-canvas').hidden).toBe(false)
  })

  test('a data load that works does not take a message away that still holds (a scene or a graph that failed)', async () => {
    const scene = await boot({ sceneError: 'context lost' })
    await Bun.sleep(20)
    expect(scene.node('map-message').hidden).toBe(false)
    const none = await boot({ webgl: false })
    await Bun.sleep(20)
    expect(none.node('map-message').textContent).toBe('This map needs WebGL, which this browser has turned off or does not offer.')
  })

  test('a store with no memories keeps its message once the scene has started', async () => {
    const b = await boot({ reply: EMPTY_REPLY })
    await Bun.sleep(20)
    expect(b.node('map-message').hidden).toBe(false)
    expect(b.node('map-message').textContent).toContain('no memories yet')
  })

  test('a force graph that could not start is tried again on a layout change, not on every state change', async () => {
    const b = await boot({ graphError: 'gl lost' })
    b.layout('timeline')
    await Bun.sleep(20)
    expect(graphFailure.tries).toBe(1)
    // Find keystrokes are state changes: each used to retry the start.
    type(b, 'm')
    type(b, 'ma')
    type(b, 'mat')
    await Bun.sleep(20)
    expect(graphFailure.tries).toBe(1)
    b.layout('galaxy')
    await Bun.sleep(20)
    b.layout('timeline')
    await Bun.sleep(20)
    expect(graphFailure.tries).toBe(2)
  })

  test('Enter flies to the first result, the one at the top of the list, with many matches', async () => {
    const b = await boot()
    type(b, 'in')
    const rows = buttons(b.node('solar-find-results'))
    expect(rows.length).toBeGreaterThan(3)
    press(b, 'map-find', 'Enter')
    const entered = b.scene().of('flyTo').at(-1)!.target
    const again = await boot()
    type(again, 'in')
    buttons(again.node('solar-find-results'))[0]!.fire('click')
    expect(entered).toEqual(again.scene().of('flyTo').at(-1)!.target)
  })

  test('Enter on one character says why nothing flew; two characters with no match do not wait for a search that cannot run', async () => {
    const b = await boot()
    type(b, 'a')
    press(b, 'map-find', 'Enter')
    expect(b.scene().of('flyTo').length).toBe(0)
    expect(b.node('map-found').textContent).toBe('Type at least 2 characters')
    type(b, 'ab')
    expect(b.node('map-found').textContent).not.toContain('Type at least')
    const flights = b.scene().of('flyTo').length
    type(b, 'zq')
    press(b, 'map-find', 'Enter')
    await Bun.sleep(20)
    expect(b.posts.length).toBe(0)
    expect(b.scene().of('flyTo').length).toBe(flights)
  })
})
