// The Vocabulary tab's page helpers (ui/vocabulary.ts, 0.24.0): the Topics / Projects split, find and sort, the tiles and
// the ribbon, the spelling suggestion, and the candidate cards. Only the DOM is stood in for.
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { ROOT } from './helpers'

// ui/vocabulary.ts is DOM code (checked by ui/tsconfig.json): loaded by a path tsc does not follow.
const vocab = (await import(join(ROOT, 'ui', 'vocabulary.ts'))) as Record<string, any>

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
  type = ''
  title = ''
  value = ''
  listeners = new Map<string, ((event: unknown) => void)[]>()
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
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value))
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  fire(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener({})
  }
  all(): FakeNode[] {
    return [this, ...this.children.flatMap(child => (child instanceof FakeNode ? child.all() : []))]
  }
  texts(): string[] {
    return this.children.flatMap(child => (child instanceof FakeNode ? child.texts() : [child.data]))
  }
}

function withDocument<T>(body: () => T): T {
  const g = globalThis as Record<string, unknown>
  const saved = g.document
  g.document = { createElement: (tag: string) => new FakeNode(tag), createTextNode: (data: string) => new FakeText(data) }
  try {
    return body()
  } finally {
    g.document = saved
  }
}

const tag = (name: string, count: number, extra: Record<string, unknown> = {}) => ({ tag: name, ns: name.includes(':') ? name.slice(0, name.indexOf(':')) : null, description: '', aliases: [], count, ...extra })
const PROJECTS = ['NCE-MCS', 'homelab', 'Project-Uno-2025', 'Code-Subshero', 'SAPflow', 'personal-life', 'Nyayasathi']
const data = vocab.parseVocabulary({
  exists: true,
  autoAdmitCount: 3,
  tags: [tag('sap', 43), tag('nce-mcs', 23), tag('personal', 7), tag('uno', 4), tag('subshero', 4), tag('sapflow', 2), tag('entity:arxada', 19), tag('agent:agy', 0, { description: 'AGY' }), tag('webdev', 29, { aliases: ['web-dev'] })],
  candidates: [{ tag: 's4hana', count: 2 }, { tag: 'sapp', count: 1 }, { tag: 'opn-sense', count: 1 }],
})

describe('VOCAB 0.24: the Vocabulary page helpers', () => {
  test('a tag names a project by its whole name or its core; a word inside a name stays a topic', () => {
    expect(vocab.projectCore('Project-Uno-2025')).toBe('uno')
    expect(vocab.projectCore('Code-Subshero')).toBe('subshero')
    expect(['nce-mcs', 'uno', 'subshero', 'sapflow', 'homelab'].every(t => vocab.namesProject(t, PROJECTS))).toBe(true)
    expect(['sap', 'personal', 'webdev', 'x'].some(t => vocab.namesProject(t, PROJECTS))).toBe(false)
    const groups = vocab.groupTags(data.tags, PROJECTS)
    expect(groups.map((g: { id: string; tags: { tag: string }[] }) => `${g.id}:${g.tags.map(t => t.tag).join(',')}`)).toEqual([
      'other:sap,personal,webdev',
      'project:nce-mcs,uno,subshero,sapflow',
      'entity:entity:arxada',
      'agent:agent:agy',
    ])
    // Without project names every bare tag is a topic.
    expect(vocab.groupTags(data.tags).map((g: { id: string }) => g.id)).toEqual(['other', 'entity', 'agent'])
  })

  test('find matches the name, an alias or the description; sort by use or A–Z (the namespace ignored)', () => {
    const names = (q: string, sort?: string) => vocab.findTags(data.tags, q, sort).map((t: { tag: string }) => t.tag)
    expect(names('web-dev')).toEqual(['webdev'])
    expect(names('AGY')).toEqual(['agent:agy'])
    expect(names('  SAP ')).toEqual(['sap', 'sapflow'])
    expect(names('', 'used').slice(0, 3)).toEqual(['sap', 'webdev', 'nce-mcs'])
    expect(names('', 'az').slice(0, 3)).toEqual(['agent:agy', 'entity:arxada', 'nce-mcs'])
    expect(vocab.nameOf('entity:arxada')).toBe('arxada')
  })

  test('tiles and the ribbon: what is admitted, waiting, unused and used, and each group’s share', () => {
    expect(vocab.vocabTiles(data)).toEqual({ admitted: 9, waiting: 3, unused: 1, uses: 131 })
    const bands = vocab.ribbon(data, PROJECTS)
    expect(bands.map((b: { id: string; uses: number; width: number }) => `${b.id}:${b.uses}:${b.width}`)).toEqual(['other:79:12', 'project:33:5', 'entity:19:3', 'agent:0:0'])
    expect(data.autoAdmit).toBe(3)
    expect(vocab.parseVocabulary({ exists: true }).autoAdmit).toBe(3)
  })

  test('the spelling suggestion: the nearest admitted tag within 2 edits, else one that contains it', () => {
    expect(vocab.editDistance('sapp', 'sap')).toBe(1)
    expect(vocab.editDistance('kitten', 'sitting')).toBe(3)
    expect(vocab.spellingOf('sapp', data.tags)?.tag).toBe('sap')
    expect(vocab.spellingOf('s4-hana', [...data.tags, tag('s4hana', 1)])?.tag).toBe('s4hana')
    expect(vocab.spellingOf('webdevelopment', data.tags)?.tag).toBe('webdev')
    expect(vocab.spellingOf('opn-sense', data.tags)).toBeNull()
    expect(vocab.spellingOf('!!!', data.tags)).toBeNull()
  })

  test('a candidate card: ticks toward auto-admit; with a suggestion, "Count as" sends the alias to it', async () => {
    const posts: { path: string; body: unknown }[] = []
    const reloads: string[] = []
    const host = {
      post: async (path: string, body: unknown) => {
        posts.push({ path, body })
        return { status: 200, body: { from: 'sapp', to: 'sap' } }
      },
      reload: (message: string) => void reloads.push(message),
    }
    const card = withDocument(() => vocab.candidateRow(data.candidates[1], data.tags, host, 3)) as FakeNode
    expect(card.className).toBe('list-row vocab-candidate')
    expect(card.all().filter(n => n.className === 'vc-tick' || n.className === 'vc-tick is-on').map(n => n.className)).toEqual(['vc-tick is-on', 'vc-tick', 'vc-tick'])
    expect(card.texts().join('')).toContain('1 of 3 · admitted on its own at 3')
    expect(card.texts().join('')).toContain('Looks like sap (spelling)')
    const buttons = card.all().filter(n => n.tagName === 'button').map(n => n.textContent)
    expect(buttons).toEqual(['Count as sap', 'Admit as new', 'Apply'])
    // The Count as… select starts on the suggestion.
    expect(card.all().find(n => n.tagName === 'select')!.value).toBe('sap')
    card.all().find(n => n.textContent === 'Count as sap' && n.tagName === 'button')!.fire('click')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(posts).toEqual([{ path: '/api/vocabulary/alias', body: { from: 'sapp', to: 'sap' } }])
    expect(reloads).toEqual(['sapp now counts as sap.'])
    // Without a suggestion the first button is Admit.
    const plain = withDocument(() => vocab.candidateRow(data.candidates[2], data.tags, host, 3)) as FakeNode
    expect(plain.all().filter(n => n.tagName === 'button').map(n => n.textContent)).toEqual(['Admit', 'Apply'])
  })

  test('no candidates: an empty state that says how a tag joins on its own, with the setting', () => {
    const opened: string[] = []
    const none = vocab.parseVocabulary({ exists: true, autoAdmitCount: 4, tags: [], candidates: [] })
    const [panel] = withDocument(() => vocab.candidateList(none, { post: async () => ({ status: 200, body: {} }), reload: () => {}, openSettings: () => void opened.push('settings') })) as FakeNode[]
    expect(panel!.texts().join(' ')).toContain('A tag used by 4 memories joins the vocabulary on its own.')
    panel!.all().find(n => n.tagName === 'button')!.fire('click')
    expect(opened).toEqual(['settings'])
  })

  test('tag rows: usage bars against the most used, an unused tag in ash, and Open N memories', () => {
    const opened: string[] = []
    const groups = withDocument(() => vocab.tagGroups(data, { projects: PROJECTS, openTag: (t: string) => void opened.push(t) })) as FakeNode[]
    const rowOf = (name: string) => groups.flatMap(g => g.all()).find(n => n.dataset.tag === name)!
    expect(rowOf('sap').all().some(n => n.className === 'bar-fill w20')).toBe(true)
    expect(rowOf('webdev').all().some(n => n.className === 'bar-fill w13')).toBe(true)
    expect(rowOf('agent:agy').className).toBe('list-row vocab-tag is-unused')
    expect(rowOf('agent:agy').texts()).toContain('unused')
    rowOf('sap').all().find(n => n.tagName === 'button')!.fire('click')
    expect(opened).toEqual(['sap'])
    // A find that matches nothing says so.
    const none = withDocument(() => vocab.tagGroups(data, { query: 'zzz' })) as FakeNode[]
    expect(none[0]!.texts()).toEqual(['No tag matches “zzz”.'])
  })
})
