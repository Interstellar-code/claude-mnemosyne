// MAPX.7: the Details panel on real memories, read-only. panelModel() decides what the panel says for a level; renderPanel()
// builds it with createElement and textContent. Both run here on the C11 fixture against a tiny stand-in for document, so no
// browser is needed. The page wiring (the fetch of /api/memories/<id>, #map-inspector) is run by tests/bun/solar-page.spec.ts.
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildBodies, kindLabel, kindOne, type Body, type SolarGalaxy, type SolarMemory, type Target } from '../../ui/solar-layout'
import { ROOT } from './helpers'

// ui/map.ts is loaded by its path, as the other page specs do: tsconfig.bun.json has no DOM types to check it against.
type MemoryDetail = Record<string, unknown> & { history?: { action?: string; validator?: string | null; at?: string }[] }
type PanelLink = { label: string; target: Target }
type PanelModel = {
  kicker: string
  title: string
  text: string | null
  facts: { label: string; value: string }[]
  tags: { label: string; names: string[] } | null
  holes: { label: string; items: PanelLink[] } | null
  history: { label: string; lines: string[] } | null
  similar: { label: string; lines: PanelLink[]; empty: string } | null
  hint: string
}
const { panelModel, renderPanel } = (await import(join(ROOT, 'ui', 'map.ts'))) as {
  panelModel: (level: Target, bodies: readonly Body[], galaxy: SolarGalaxy, fetched?: MemoryDetail | 'loading' | 'failed' | 'gone' | null) => PanelModel
  renderPanel: (box: unknown, model: PanelModel, on: { tag: (name: string) => void; go: (target: Target) => void }, activeTag: string) => void
}

const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'tests', 'bun', 'fixtures', 'galaxy-c11.json'), 'utf8')) as SolarGalaxy
const MATRIX = 'project-matrixkoder-1a2b3c'
const HERMES = 'project-hermes-switchui-4d5e6f'
const MNEMO = 'project-claude-mnemosyne-0d1e2f'
const NOW = Date.parse('2026-10-25T12:00:00.000Z')

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const bodiesOf = (galaxy: SolarGalaxy): Body[] => buildBodies(galaxy, NOW)
const row = (galaxy: SolarGalaxy, id: string): SolarMemory => galaxy.memories.find(memory => memory.id === id)!
const fact = (model: PanelModel, label: string): string => model.facts.find(item => item.label === label)?.value ?? `(no fact ${label})`
const memoryLevel = (galaxy: SolarGalaxy, id: string): Target => {
  const memory = row(galaxy, id)
  return { level: 'memory', owner: memory.owner, kind: memory.kind, id }
}

// ---- A document stand-in: elements that record text, children, class and listeners; style attributes and innerHTML are refused ----

class Node_ {
  className = ''
  type = ''
  style: Record<string, string> = {}
  children: (Node_ | string)[] = []
  attributes = new Map<string, string>()
  listeners = new Map<string, (() => void)[]>()
  textValue = ''
  constructor(public tag: string) {}
  set textContent(value: string) {
    this.textValue = value
  }
  get textContent(): string {
    return this.textValue + this.children.map(child => (typeof child === 'string' ? child : child.textContent)).join('')
  }
  set innerHTML(_: string) {
    throw new Error('innerHTML is never used')
  }
  setAttribute(name: string, value: string) {
    if (name === 'style') throw new Error('inline style attributes are refused by the page policy')
    this.attributes.set(name, value)
  }
  append(...nodes: (Node_ | string)[]) {
    this.children.push(...nodes)
  }
  replaceChildren(...nodes: (Node_ | string)[]) {
    this.children = [...nodes]
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  click() {
    for (const listener of this.listeners.get('click') ?? []) listener()
  }
  all(): Node_[] {
    return [this, ...this.children.flatMap(child => (typeof child === 'string' ? [] : child.all()))]
  }
  withClass(name: string): Node_[] {
    return this.all().filter(node => node.className.split(/\s+/).includes(name))
  }
}

const original = (globalThis as { document?: unknown }).document
beforeEach(() => {
  ;(globalThis as { document?: unknown }).document = { createElement: (tag: string) => new Node_(tag) }
})
afterEach(() => {
  ;(globalThis as { document?: unknown }).document = original
})

type Calls = { tags: string[]; goes: Target[] }
function paint(model: PanelModel, activeTag = ''): { box: Node_; calls: Calls } {
  const box = new Node_('aside')
  const calls: Calls = { tags: [], goes: [] }
  renderPanel(box, model, { tag: name => calls.tags.push(name), go: target => calls.goes.push(target) }, activeTag)
  return { box, calls }
}
const buttonTexts = (box: Node_) => box.all().filter(node => node.tag === 'button').map(node => node.textContent)

const FULL: MemoryDetail & { content: string } = {
  content: 'Always plan before building.\nThen build in small steps.',
  source: 'claude-code',
  veracity: 'stated',
  trust_tier: 'trusted',
  created_at: '2026-10-24T12:00:00.000Z',
  last_recalled: '2026-10-25T00:00:00.000Z',
  recall_count: 12,
  importance: 0.9,
  valid_until: null,
  superseded_by: null,
  state: 'live',
  tags: ['workflow-rules', 'planning'],
  history: [
    { action: 'update', validator: 'claude-code', at: '2026-10-25T08:30:00.000Z' },
    { action: 'attest', validator: 'rohit', at: '2026-10-24T19:00:00.000Z' },
    { action: 'save', validator: null, at: '2026-10-24T12:00:00.000Z' },
  ],
}

describe('the store summary (Galaxy level)', () => {
  const galaxy = clone(FIXTURE)
  const model = panelModel({ level: 'galaxy' }, bodiesOf(galaxy), galaxy)

  test('names the store and holds the counts the data already has', () => {
    expect(model.kicker).toBe('Solar system')
    expect(model.title).toBe('Your memory store')
    expect(model.text).toBeNull()
    expect(fact(model, 'Memories')).toBe(`${galaxy.projects.reduce((sum, project) => sum + (project as { liveCount: number }).liveCount, 0)} live`)
    expect(fact(model, 'Projects (planets)')).toBe('5')
    expect(fact(model, 'Writers (nodules)')).toBe('claude-code 121 (100 inferred) · imported 2')
    expect(fact(model, 'Global (sun belt)')).toBe('6')
    expect(fact(model, 'Not live (outer belt)')).toBe('3')
    expect(fact(model, 'Busiest planet')).not.toBe('—')
    expect(fact(model, 'Plain folders')).toBe('3 stations · 3 starships')
    expect(fact(model, 'Black-hole pairs')).toMatch(/^\d+ \(\d+ links?\)$/)
  })

  test('a reply without links, writers or states still renders, saying what is missing', () => {
    const old = clone(FIXTURE) as Partial<SolarGalaxy> & Record<string, unknown>
    delete old.links
    delete old.writers
    delete old.globalLive
    for (const memory of old.memories!) delete (memory as Partial<SolarMemory>).state
    const plain = panelModel({ level: 'galaxy' }, bodiesOf(old as SolarGalaxy), old as SolarGalaxy)
    expect(fact(plain, 'Black-hole pairs')).toBe('needs stored vectors')
    expect(fact(plain, 'Writers (nodules)')).toBe('none')
    expect(fact(plain, 'Global (sun belt)')).toBe('0')
    expect(fact(plain, 'Not live (outer belt)')).toBe('—')
  })

  test('an empty store has a summary too', () => {
    const empty: SolarGalaxy = { projects: [], memories: [], writers: [], globalLive: 0 }
    const none = panelModel({ level: 'galaxy' }, [], empty)
    expect(fact(none, 'Memories')).toBe('0 live')
    expect(fact(none, 'Busiest planet')).toBe('—')
    expect(fact(none, 'Plain folders')).toBe('none')
  })
})

describe('every body kind', () => {
  const galaxy = clone(FIXTURE)
  const bodies = bodiesOf(galaxy)
  const body = (owner: string) => bodies.find(candidate => candidate.owner === owner)!

  test('a planet: its facts, the top tags as buttons, and a black hole button per partner that flies to it', () => {
    const model = panelModel({ level: 'planet', owner: MATRIX }, bodies, galaxy)
    expect(model.kicker.startsWith('Planet · ')).toBe(true)
    expect(model.title).toBe('matrixkoder')
    expect(fact(model, 'Memories')).toBe(String(body(MATRIX).count))
    for (const label of ['Tags (land)', 'Kinds (moons)', 'Lifetime recalls', 'Median age', 'Global from here', 'Kind unknown']) expect(model.facts.map(item => item.label)).toContain(label)
    expect(model.facts.map(item => item.label).some(label => label.startsWith('Activity'))).toBe(true)
    expect(model.tags!.names.length).toBeGreaterThan(0)
    expect(model.tags!.names.length).toBeLessThanOrEqual(6)
    const partners = model.holes!.items.map(item => item.target)
    expect(partners).toContainEqual({ level: 'planet', owner: HERMES })
    expect(partners).toContainEqual({ level: 'planet', owner: MNEMO })
    expect(model.holes!.items.every(item => /^(out to|in from) .+ · \d+ similar$/.test(item.label))).toBe(true)
    const { box, calls } = paint(model)
    const hole = box.withClass('solar-hole')[0]!
    hole.click()
    expect(calls.goes).toEqual([model.holes!.items[0]!.target])
  })

  test('a planet with no black holes says none; tags are buttons, the pressed one is the active query', () => {
    const quiet = panelModel({ level: 'planet', owner: 'project-notes-9a0b1c' }, bodies, galaxy)
    expect(quiet.holes!.items).toEqual([])
    expect(paint(quiet).box.textContent).toContain('Black holes')
    const model = panelModel({ level: 'planet', owner: MATRIX }, bodies, galaxy)
    const first = model.tags!.names[0]!
    const { box, calls } = paint(model, first)
    const tags = box.withClass('solar-tag')
    expect(tags.map(tag => tag.textContent)).toEqual(model.tags!.names)
    expect(tags[0]!.attributes.get('aria-pressed')).toBe('true')
    expect(tags[1]?.attributes.get('aria-pressed') ?? 'false').toBe('false')
    tags[0]!.click()
    expect(calls.tags).toEqual([first])
  })

  test('a space station, a starship and a repo planet are told apart in the kicker', () => {
    const station = panelModel({ level: 'planet', owner: 'project-cowork-6d7e8f' }, bodies, galaxy)
    const ship = panelModel({ level: 'planet', owner: 'project-downloads-1b2c3d' }, bodies, galaxy)
    expect(station.kicker).toContain('Space station')
    expect(ship.kicker).toContain('Starship')
    expect(station.kicker.startsWith('Planet')).toBe(false)
    expect(ship.kicker.startsWith('Planet')).toBe(false)
    expect(panelModel({ level: 'planet', owner: MATRIX }, bodies, galaxy).kicker).toContain('repo on')
  })

  test('a moon: its kind, its count, its share of the planet and its writers', () => {
    const kind = body(MATRIX).kinds[0]!
    const model = panelModel({ level: 'moon', owner: MATRIX, kind: kind.kind }, bodies, galaxy)
    expect(model.kicker.startsWith('Moon · ')).toBe(true)
    expect(model.title.endsWith('of matrixkoder')).toBe(true)
    expect(fact(model, 'Memories')).toBe(String(kind.count))
    expect(fact(model, 'Share of the planet')).toBe(`${Math.round((kind.count / body(MATRIX).count) * 100)}%`)
    expect(fact(model, 'Planet')).toBe('matrixkoder')
    expect(fact(model, 'Writers')).toContain('claude-code')
    expect(model.text).toBeNull()
  })

  test('a level whose planet is gone shows the store summary rather than failing', () => {
    expect(panelModel({ level: 'planet', owner: 'project-nowhere-000000' }, bodies, galaxy).title).toBe('Your memory store')
  })
})

describe('a memory', () => {
  const galaxy = clone(FIXTURE)
  // mem-001 is pinned in the fixture; make its writer an inferred one so the "inferred" mark shows.
  row(galaxy, 'mem-001').sourceInferred = true
  const bodies = bodiesOf(galaxy)
  const level = memoryLevel(galaxy, 'mem-001')

  test('every field from the two routes: text, kind, tags, writer, source, trust, veracity, dates, expiry, state, pin, history', () => {
    const model = panelModel(level, bodies, galaxy, FULL)
    expect(model.kicker).toBe(`Memory · ${kindOne('instruction')} · matrixkoder`)
    expect(model.text).toBe(FULL.content)
    expect(fact(model, 'Kind')).toBe(kindLabel('instruction'))
    expect(fact(model, 'Writer')).toBe('claude-code · inferred')
    expect(fact(model, 'Source · trust · veracity')).toBe('claude-code · trusted · stated')
    expect(fact(model, 'State · pinned')).toBe('live · pinned')
    expect(fact(model, 'Created')).toBe('2026-10-24')
    expect(fact(model, 'Last recalled · count')).toBe('2026-10-25 · 12')
    expect(fact(model, 'Expiry')).toBe('none')
    expect(fact(model, 'Importance')).toBe('0.9')
    expect(model.tags).toEqual({ label: 'Tags (click to light the land)', names: ['workflow-rules', 'planning'] })
    expect(model.history!.lines).toEqual(['update by claude-code · 2026-10-25', 'attest by rohit · 2026-10-24', 'save · 2026-10-24'])
  })

  test('the history shows the last 3 actions at most', () => {
    const model = panelModel(level, bodies, galaxy, { ...FULL, history: [...FULL.history!, { action: 'retire', validator: 'x', at: '2026-10-01T00:00:00.000Z' }] })
    expect(model.history!.lines.length).toBe(3)
  })

  test('similar memories are the cross-project pairs; each points at the other project, by its memory when it is live', () => {
    const model = panelModel(level, bodies, galaxy, FULL)
    const lines = model.similar!.lines
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every(item => /black hole to .+ · \d+%$/.test(item.label))).toBe(true)
    // mem-001 pairs with mem-003 (hermes-switchui, live): the button flies to that memory.
    expect(lines.map(item => item.target)).toContainEqual({ level: 'memory', owner: HERMES, kind: row(galaxy, 'mem-003').kind, id: 'mem-003' })
    const { box, calls } = paint(model)
    box.withClass('solar-hole')[0]!.click()
    expect(calls.goes.length).toBe(1)
  })

  test('a partner that is not live, or not in the reply, is reached through its planet', () => {
    const retired = clone(galaxy)
    row(retired, 'mem-003').state = 'retired'
    const model = panelModel(level, bodiesOf(retired), retired, FULL)
    expect(model.similar!.lines.map(item => item.target)).toContainEqual({ level: 'planet', owner: HERMES })
    const missing = clone(galaxy)
    missing.memories = missing.memories.filter(memory => memory.id !== 'mem-003')
    expect(panelModel(level, bodiesOf(missing), missing, FULL).similar!.lines.map(item => item.target)).toContainEqual({ level: 'planet', owner: HERMES })
  })

  test('a memory with no pairs says none across projects; a store without vectors says why', () => {
    const lonely = memoryLevel(galaxy, 'mem-005')
    expect(panelModel(lonely, bodies, galaxy, FULL).similar).toMatchObject({ lines: [], empty: 'none across projects' })
    const noVectors = clone(galaxy) as Partial<SolarGalaxy>
    delete noVectors.links
    expect(panelModel(level, bodies, noVectors as SolarGalaxy, FULL).similar).toMatchObject({ lines: [], empty: 'needs stored vectors' })
  })

  test('an older server: a reply without the new fields, or a galaxy row without them, shows a dash for each', () => {
    const old = clone(galaxy)
    const memory = row(old, 'mem-001') as Partial<SolarMemory>
    for (const key of ['source', 'sourceInferred', 'pinned', 'state', 'validUntil', 'importance', 'created', 'lastRecalled', 'recalls', 'tags'] as const) delete memory[key]
    const model = panelModel(level, bodiesOf(old), old, { content: 'Just the text.' })
    expect(model.text).toBe('Just the text.')
    expect(fact(model, 'Writer')).toBe('—')
    expect(fact(model, 'Source · trust · veracity')).toBe('— · — · —')
    expect(fact(model, 'State · pinned')).toBe('— · —')
    expect(fact(model, 'Created')).toBe('—')
    expect(fact(model, 'Last recalled · count')).toBe('— · —')
    expect(fact(model, 'Expiry')).toBe('—')
    expect(fact(model, 'Importance')).toBe('—')
    expect(model.tags!.names).toEqual([])
    expect(model.history!.lines).toEqual(['—'])
    const { box } = paint(model)
    const said = box.textContent
    expect(said).not.toContain('undefined')
    expect(said).not.toContain('NaN')
    expect(said).not.toContain('null')
    expect(box.withClass('solar-none').map(node => node.textContent)).toContain('—')
  })

  test('while the reply is on its way, and when it fails, the panel says so and still shows what the galaxy reply holds', () => {
    const loading = panelModel(level, bodies, galaxy, 'loading')
    expect(loading.text).toBe('Loading the text…')
    expect(loading.history!.lines).toEqual(['Loading…'])
    expect(fact(loading, 'Writer')).toBe('claude-code · inferred')
    expect(fact(loading, 'State · pinned')).toBe('live · pinned')
    const failed = panelModel(level, bodies, galaxy, 'failed')
    expect(failed.text).toContain('The full text could not be loaded.')
    expect(failed.text).toContain(row(galaxy, 'mem-001').label)
    expect(failed.history!.lines).toEqual(['—'])
    // A 404 (the memory was forgotten) says so plainly, not "could not be loaded".
    const gone = panelModel(level, bodies, galaxy, 'gone')
    expect(gone.text).toContain('This memory no longer exists or was retired.')
    expect(gone.text).not.toContain('could not be loaded')
    expect(gone.text).toContain(row(galaxy, 'mem-001').label)
    expect(panelModel(level, bodies, galaxy).text).toBeNull()
  })

  test('the reply wins over the galaxy row for a field both hold; an expiry date and a replacement show', () => {
    const model = panelModel(level, bodies, galaxy, { ...FULL, valid_until: '2026-12-31T00:00:00.000Z', superseded_by: 'mem-777', state: 'retired', recall_count: 0, last_recalled: null })
    expect(fact(model, 'Expiry')).toBe('2026-12-31')
    expect(fact(model, 'State · pinned')).toBe('retired (replaced by mem-777) · pinned')
    expect(fact(model, 'Last recalled · count')).toBe('never · 0')
    expect(model.hint).toBe('It is in the outer belt. Restore it in the Review tab.')
  })

  test('a not-live memory points to the Review tab; a live one to its satellites', () => {
    const gone = memoryLevel(galaxy, 'mem-006')
    expect(panelModel(gone, bodies, galaxy, null).hint).toContain('Restore it in the Review tab')
    expect(panelModel(level, bodies, galaxy, FULL).hint).toBe('Its knowledge satellites orbit it on the map.')
  })

  test('read only: the panel has no Edit, Pin or Retire button, only tag and black-hole buttons', () => {
    for (const target of [{ level: 'galaxy' } as Target, { level: 'planet', owner: MATRIX } as Target, { level: 'moon', owner: MATRIX, kind: row(galaxy, 'mem-001').kind } as Target, level]) {
      const { box } = paint(panelModel(target, bodies, galaxy, FULL))
      for (const text of buttonTexts(box)) expect(text).not.toMatch(/^(Edit|Pin|Unpin|Retire|Restore|Forget|Delete)/i)
      for (const node of box.all().filter(item => item.tag === 'button')) expect(['solar-tag', 'solar-hole']).toContain(node.className)
    }
  })
})

describe('building the panel', () => {
  const galaxy = clone(FIXTURE)
  const bodies = bodiesOf(galaxy)

  test('memory text and tags go in as text, never as markup, and no style attribute is set', () => {
    const hostile = '<img src=x onerror=alert(1)><script>boom()</script>'
    const model = panelModel(memoryLevel(galaxy, 'mem-001'), bodies, galaxy, { ...FULL, content: hostile, tags: [hostile] })
    // The stand-in throws on innerHTML and on a style attribute, so this paints only if neither is used.
    const { box } = paint(model)
    expect(box.withClass('insp-text')[0]!.textContent).toBe(hostile)
    expect(box.withClass('solar-tag')[0]!.textContent).toBe(hostile)
    expect(box.all().every(node => node.tag !== 'img' && node.tag !== 'script')).toBe(true)
  })

  test('the panel is the head, the text (memories only), the facts, the rows, the two columns (memories only), then the hint', () => {
    const memory = paint(panelModel(memoryLevel(galaxy, 'mem-001'), bodies, galaxy, FULL)).box
    expect(memory.children.map(child => (child as Node_).className)).toEqual(['insp-head', 'insp-text', 'solar-facts', 'solar-row', 'solar-cols', 'insp-hint'])
    const planet = paint(panelModel({ level: 'planet', owner: MATRIX }, bodies, galaxy)).box
    expect(planet.children.map(child => (child as Node_).className)).toEqual(['insp-head', 'solar-facts', 'solar-row', 'solar-row', 'insp-hint'])
    const sun = paint(panelModel({ level: 'galaxy' }, bodies, galaxy)).box
    expect(sun.children.map(child => (child as Node_).className)).toEqual(['insp-head', 'solar-facts', 'insp-hint'])
    expect(memory.withClass('insp-title')[0]!.tag).toBe('h2')
  })

  test('painting again replaces the old content', () => {
    const box = new Node_('aside')
    const on = { tag: () => {}, go: () => {} }
    renderPanel(box, panelModel({ level: 'planet', owner: MATRIX }, bodies, galaxy), on, '')
    renderPanel(box, panelModel({ level: 'galaxy' }, bodies, galaxy), on, '')
    expect(box.withClass('insp-title').map(node => node.textContent)).toEqual(['Your memory store'])
  })

  test('ui/map.ts builds the panel without innerHTML or an inline style attribute', () => {
    const source = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    expect(source).not.toMatch(/\binnerHTML\b|\.outerHTML\b|insertAdjacentHTML/)
    expect(source).not.toMatch(/setAttribute\(\s*['"]style['"]/)
  })

  test('the panel is #map-inspector, the element ui/app.ts watches to bring a new selection into view', () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    expect(html).toMatch(/<aside id="map-inspector" class="inspector insp-card"[^>]*><\/aside>/)
    expect(html).not.toContain('id="solar-details"')
    // revealNeeded reads the .insp-title of #map-inspector.
    expect(readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')).toContain("byId('map-inspector')")
  })
})
