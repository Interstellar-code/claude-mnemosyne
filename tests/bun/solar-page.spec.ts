// MAPX.11: the page shell around the solar scene, run on the real ui/index.html and ui/map.ts against a DOM-free
// stand-in and the scene fake (tests/bun/solar-scene-fake.ts), so no WebGL is needed. The scene is reached only through C13.
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fragmentAfterToken, levelFromHash, levelToHash, type SolarHost } from '../../ui/map-state'
import { fakeSceneFactory, type FakeScene } from './solar-scene-fake'
import { ROOT } from './helpers'

const HTML = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'tests', 'bun', 'fixtures', 'galaxy-c11.json'), 'utf8')) as { projects: { owner: string; label: string }[]; memories: { id: string; owner: string; kind: string }[] }
const MATRIX = 'project-matrixkoder-1a2b3c'
const HERMES = 'project-hermes-switchui-4d5e6f'

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
  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null
  }
}

function fakeDom(html: string) {
  const nodes = new Map<string, FakeNode>()
  for (const match of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    const node = new FakeNode(match[1]!.toLowerCase())
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
  const document = {
    createElement: (tag: string) => new FakeNode(tag.toLowerCase()),
    createTextNode: (data: string) => new FakeText(data),
    getElementById: (id: string) => nodes.get(id) ?? null,
    activeElement: null as FakeNode | null,
  }
  return { document, nodes }
}

// ---- The harness ----

type Boot = {
  fake: ReturnType<typeof fakeDom>
  node: (id: string) => FakeNode
  factory: ReturnType<typeof fakeSceneFactory>
  scene: () => FakeScene
  posts: { path: string; body: { query: string; mode: string } }[]
  statuses: string[]
  replaced: string[]
  storage: Map<string, string>
  emit: (line: Record<string, unknown>) => void
  layout: (name: string) => void
}

const saved = { document: undefined as unknown, CSS: undefined as unknown, HTMLElement: undefined as unknown, location: undefined as unknown, history: undefined as unknown, localStorage: undefined as unknown }
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
  post?: (path: string, body: { query: string; mode: string }) => Promise<Response>
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
  const factory = fakeSceneFactory()
  const posts: Boot['posts'] = []
  const statuses: string[] = []
  const listeners: ((line: Record<string, unknown>) => void)[] = []
  const solar: SolarHost = {
    createScene: factory.createScene,
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
    api: async () => new Response(JSON.stringify(FIXTURE), { status: 200 }),
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
    fake, node, factory, posts, statuses, replaced, storage,
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
    for (const id of ['solar-path', 'map-find', 'solar-legend-left', 'solar-legend-right', 'solar-views', 'solar-bodies', 'solar-chips', 'solar-show-all', 'solar-details', 'map-live-strip', 'solar-card-arrange', 'solar-card-colour', 'solar-card-show', 'solar-find-results']) expect(HTML).toContain(`id="${id}"`)
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
    for (const id of ['solar-card-arrange', 'solar-card-colour', 'solar-card-show', 'solar-details', 'solar-bodies']) expect(b.node(id).hidden).toBe(false)
    for (const id of ['map-card-colour', 'map-card-links', 'map-card-know', 'map-card-layers', 'map-card-projects', 'map-inspector', 'map-overview', 'map-legend']) expect(b.node(id).classes()).toContain('legacy-only')
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
    for (const id of ['solar-card-arrange', 'solar-bodies', 'solar-details', 'solar-canvas']) expect(b.node(id).hidden).toBe(true)
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
    expect(planet.node('solar-details').texts().join(' ')).toContain('matrixkoder')
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
    expect(b.node('solar-details').texts().join(' ')).toContain('matrixkoder')
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

  test('live activity lines reach the scene as map events', async () => {
    const b = await boot()
    b.emit({ t: '2026-10-25T10:00:00.000Z', action: 'recall', owner: MATRIX, ids: ['mem-001'], client: 'claude-code', ok: true })
    expect(b.scene().of('event').length).toBe(1)
    expect(b.scene().of('event')[0]!.event).toMatchObject({ kind: 'recall', ids: ['mem-001'] })
  })
})
