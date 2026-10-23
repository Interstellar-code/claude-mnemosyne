// VIEW.4: memory text is always rendered inert.
//
// 1. A scan of every page file (ui/**/*.ts but server.ts and ui/vendor/): no
//    innerHTML, outerHTML, insertAdjacentHTML, document.write, eval or new
//    Function. It runs on every test:bun, so it holds for files MAP adds.
// 2. The real render helpers of ui/app.ts, run against a DOM-free stand-in
//    document whose elements throw on any HTML setter: a memory holding
//    <script> and <img onerror> comes out as text, and no script or img
//    element is ever made.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT } from './helpers'

const UI = join(ROOT, 'ui')
const HTML_SINKS = /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|document\s*\.\s*write(?:ln)?\b|\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/

/** The page's TypeScript files: every .ts under ui/ but server.ts and ui/vendor/. */
function pageFiles(dir = UI): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (path !== join(UI, 'vendor')) out.push(...pageFiles(path))
    } else if (entry.name.endsWith('.ts') && path !== join(UI, 'server.ts')) {
      out.push(path)
    }
  }
  return out
}

describe('VIEW.4.a1: no page file parses HTML', () => {
  test('ui/app.ts is among the files scanned, server.ts is not', () => {
    const files = pageFiles().map(file => relative(ROOT, file))
    expect(files).toContain(join('ui', 'app.ts'))
    expect(files).not.toContain(join('ui', 'server.ts'))
  })

  test('no innerHTML, outerHTML, insertAdjacentHTML, document.write, eval or new Function', () => {
    const hits: string[] = []
    for (const file of pageFiles()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (HTML_SINKS.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
        })
    }
    expect(hits).toEqual([])
  })

  test('the scan catches each sink (so an empty result means something)', () => {
    for (const line of ['a.innerHTML = x', 'a.outerHTML=x', "a.insertAdjacentHTML('beforeend', x)", 'document.write(x)', 'document . writeln(x)', 'eval(x)', 'new Function(x)']) {
      expect({ line, caught: HTML_SINKS.test(line) }).toEqual({ line, caught: true })
    }
  })
})

// ---- A DOM-free stand-in document ----

const FORBIDDEN = new Set(['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'srcdoc', 'setHTMLUnsafe'])

class FakeText {
  constructor(public data: string) {}
  get textContent() {
    return this.data
  }
}

class FakeElement {
  children: (FakeElement | FakeText)[] = []
  attributes = new Map<string, string>()
  dataset: Record<string, string> = {}
  className = ''
  hidden = false
  disabled = false
  title = ''
  type = ''
  tabIndex = -1
  value = ''
  listeners = new Map<string, ((event: unknown) => void)[]>()
  classList = {
    toggle: (name: string, on?: boolean) => {
      const names = new Set(this.className.split(' ').filter(Boolean))
      if (on ?? !names.has(name)) names.add(name)
      else names.delete(name)
      this.className = [...names].join(' ')
    },
    add: (name: string) => this.classList.toggle(name, true),
    contains: (name: string) => this.className.split(' ').includes(name),
  }
  constructor(public tagName: string) {}
  get textContent(): string {
    return this.children.map(child => child.textContent).join('')
  }
  set textContent(value: string) {
    this.children = value === '' ? [] : [new FakeText(String(value))]
  }
  append(...nodes: (FakeElement | FakeText | string)[]) {
    for (const node of nodes) this.children.push(typeof node === 'string' ? new FakeText(node) : node)
  }
  replaceChildren(...nodes: (FakeElement | FakeText | string)[]) {
    this.children = []
    this.append(...nodes)
  }
  setAttribute(name: string, value: string) {
    if (/^on/i.test(name) || name.toLowerCase() === 'style' || name.toLowerCase() === 'srcdoc') throw new Error(`setAttribute(${name}) on a page element`)
    this.attributes.set(name, String(value))
  }
  removeAttribute(name: string) {
    this.attributes.delete(name)
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  focus() {}
  /** Every element under this one, itself included. */
  all(): FakeElement[] {
    return [this, ...this.children.flatMap(child => (child instanceof FakeElement ? child.all() : []))]
  }
  /** Every text node's data under this one. */
  texts(): string[] {
    return this.children.flatMap(child => (child instanceof FakeElement ? child.texts() : [child.data]))
  }
}

// Any HTML setter or method on an element throws.
const guarded = (element: FakeElement) =>
  new Proxy(element, {
    set(target, key, value, receiver) {
      if (typeof key === 'string' && FORBIDDEN.has(key)) throw new Error(`${key} set on a page element`)
      return Reflect.set(target, key, value, receiver)
    },
    get(target, key, receiver) {
      if (typeof key === 'string' && FORBIDDEN.has(key)) throw new Error(`${key} read on a page element`)
      return Reflect.get(target, key, receiver)
    },
  })

const made: FakeElement[] = []
const fakeDocument = {
  createElement(tag: string) {
    const element = guarded(new FakeElement(tag.toLowerCase()))
    made.push(element)
    return element
  },
  createTextNode: (data: string) => new FakeText(String(data)),
  write() {
    throw new Error('document.write')
  },
}

const MARKUP = '<script>alert(1)</script> and <img src=x onerror=alert(1)>'
const TAGS = ['<b>bold</b>', '<img src=x onerror=alert(2)>']

// The page's own tags; anything else (script, img, iframe...) would mean HTML was made from data.
const PAGE_TAGS = new Set(['tr', 'td', 'div', 'span', 'dl', 'dt', 'dd', 'p', 'button', 'li', 'mark', 'ol', 'ul', 'option'])

describe('VIEW.4: the real render helpers keep markup as text', () => {
  let app: Record<string, any>
  let saved: unknown

  beforeAll(async () => {
    // Loaded by a path tsc does not follow: ui/app.ts is DOM code, checked by ui/tsconfig.json.
    app = await import(join(UI, 'app.ts'))
    saved = (globalThis as Record<string, unknown>).document
    ;(globalThis as Record<string, unknown>).document = fakeDocument
  })
  afterAll(() => {
    ;(globalThis as Record<string, unknown>).document = saved
  })

  const memory = {
    id: 'abc123',
    owner: 'project-x-1a2b',
    preview: MARKUP,
    content: `${MARKUP}\nsecond line`,
    importance: 0.5,
    recall_count: 3,
    last_recalled: null,
    timestamp: '2026-10-22T10:00:00.000Z',
    scope: 'global',
    source: '<i>mcp</i>',
    metadata: { tags: TAGS },
  }

  function expectInert(root: FakeElement, ...wanted: string[]) {
    const tags = root.all().map(element => element.tagName)
    expect(tags.filter(tag => !PAGE_TAGS.has(tag))).toEqual([])
    const texts = root.texts()
    for (const text of wanted) expect(texts.some(data => data.includes(text))).toBe(true)
    expect(root.all().every(element => [...element.attributes.keys()].every(name => !/^on/i.test(name)))).toBe(true)
  }

  test('a Memories row', () => {
    made.length = 0
    const row = app.memoryRow(memory, () => {}) as FakeElement
    expect(row.tagName).toBe('tr')
    expectInert(row, MARKUP, TAGS[0]!, TAGS[1]!)
    expect(made.some(element => element.tagName === 'script' || element.tagName === 'img')).toBe(false)
  })

  test('the detail panel, with its forget confirm naming the first line and id', () => {
    made.length = 0
    const panel = app.memoryDetail(memory, () => {}) as FakeElement
    expectInert(panel, `${MARKUP}\nsecond line`, `“${MARKUP}”`, ' · abc123', '<i>mcp</i>', TAGS[0]!)
    expect(made.some(element => element.tagName === 'script' || element.tagName === 'img')).toBe(false)
    // The confirm stays hidden until Forget… is pressed; Keep it deletes nothing.
    const buttons = panel.all().filter(element => element.tagName === 'button')
    expect(buttons.map(button => button.textContent)).toEqual(['Forget…', 'Keep it', 'Forget'])
    let forgot = 0
    const live = app.memoryDetail(memory, () => forgot++) as FakeElement
    const [ask, keep, yes] = live.all().filter(element => element.tagName === 'button')
    const confirm = live.all().find(element => element.className === 'confirm')!
    expect(confirm.hidden).toBe(true)
    for (const listener of ask!.listeners.get('click')!) listener({})
    expect(confirm.hidden).toBe(false)
    for (const listener of keep!.listeners.get('click')!) listener({})
    expect(confirm.hidden).toBe(true)
    expect(forgot).toBe(0)
    for (const listener of ask!.listeners.get('click')!) listener({})
    for (const listener of yes!.listeners.get('click')!) listener({})
    expect(forgot).toBe(1)
  })

  test('an Activity line', () => {
    made.length = 0
    const item = app.activityItem({ t: '2026-10-22T10:00:00.000Z', action: 'remember', origin: 'tool', owner: '<img src=x onerror=alert(3)>', text: MARKUP, ids: [], count: 1, ok: true }) as FakeElement
    expectInert(item, MARKUP, '<img src=x onerror=alert(3)>')
    // An action name from the log never becomes a class of its own choosing.
    const odd = app.activityItem({ action: 'x" onclick="alert(1)', ok: false, error: '<b>e</b>' }) as FakeElement
    expect(odd.all().some(element => element.className.includes('onclick'))).toBe(false)
    expectInert(odd, 'x" onclick="alert(1)')
  })

  test('an Activity line for an all-owner search shows "all projects (n)", not the global project', () => {
    made.length = 0
    const search = { t: '2026-10-22T10:00:00.000Z', action: 'recall', origin: 'ui', owner: 'global', text: 'apples', ids: [], count: 0, ok: true }
    const all = app.activityItem({ ...search, owners: 3 }) as FakeElement
    expect(all.texts()).toContain('all projects (3)')
    expect(all.texts()).not.toContain('global')
    expect(all.all().some(element => element.title === 'all projects (3)')).toBe(true)
    // One owner searched, or no count: the owner's own name.
    for (const line of [{ ...search, owners: 1 }, search]) {
      const single = app.activityItem(line) as FakeElement
      expect(single.texts()).toContain('global')
      expect(single.texts().some(text => text.startsWith('all projects'))).toBe(false)
    }
  })

  test('TAGS.4: a row\'s tag chips are buttons with the tag as text; a click picks the tag and does not open the row', () => {
    made.length = 0
    const opened: string[] = []
    const picked: string[] = []
    const row = app.memoryRow({ ...memory, tags: ['fruit', '<b>x</b>'] }, (id: string) => opened.push(id), (tag: string) => picked.push(tag)) as FakeElement
    const chips = row.all().filter(element => element.tagName === 'button')
    expect(chips.map(chip => chip.textContent)).toEqual(['fruit', '<b>x</b>'])
    expectInert(row, 'fruit', '<b>x</b>')
    let stopped = 0
    const event = { stopPropagation: () => stopped++ }
    for (const listener of chips[1]!.listeners.get('click')!) listener(event)
    expect(picked).toEqual(['<b>x</b>'])
    expect(stopped).toBe(1)
    expect(opened).toEqual([])
    // Enter on a chip must not reach the row's own keydown handler.
    for (const listener of chips[0]!.listeners.get('keydown')!) listener(event)
    expect(stopped).toBe(2)
    // The row itself still opens it.
    for (const listener of row.listeners.get('click')!) listener({})
    expect(opened).toEqual([memory.id])
    // Without a picker, or in the metadata only, chips are plain text.
    const plain = app.memoryRow(memory, () => {}) as FakeElement
    expect(plain.all().some(element => element.tagName === 'button')).toBe(false)
    expect(app.tagsOfMemory({ metadata: { tags: ['m'] } })).toEqual(['m'])
    expect(app.tagsOfMemory({ metadata: { tags: ['m'] }, tags: ['s'] })).toEqual(['s'])
  })

  test('a Search hit, with the query words marked as text', () => {
    made.length = 0
    const hit = app.searchHit({ ...memory, content: MARKUP, score: 0.42 }, 1, 'script onerror', () => {}) as FakeElement
    expectInert(hit, '0.42', '#1')
    expect(hit.all().filter(element => element.tagName === 'mark').map(element => element.textContent)).toEqual(['script', 'script', 'onerror'])
    // The marked parts and the text between them give back the memory exactly.
    const paragraph = hit.all().find(element => element.tagName === 'p')!
    expect(paragraph.textContent).toBe(MARKUP)
  })

  test('markParts gives back the text exactly, and a query of regex characters is taken as text', () => {
    expect(app.markParts(MARKUP, '<script> (.*)').map((part: { text: string }) => part.text).join('')).toBe(MARKUP)
    expect(app.markParts('a+b (c)', '(c) a+b')).toEqual([
      { text: 'a+b', mark: true },
      { text: ' ', mark: false },
      { text: '(c)', mark: true },
    ])
    expect(app.firstLine('\n  first\nsecond')).toBe('first')
    expect(app.ownerName('project-claude-mnemosyne-1x2y3')).toBe('claude-mnemosyne')
    expect(app.tagsOf({ tags: ['a', 3, null, 'b'] })).toEqual(['a', 'b'])
  })
})
