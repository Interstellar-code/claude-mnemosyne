// The shared bottom sheet (ui/sheet.ts): open, close, Esc, focus, replace.
// Run against a tiny stand-in document (no real DOM), like inert.spec.ts.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './helpers'

class Fake {
  hidden = false
  scrollTop = 0
  offsetHeight = 0
  text = ''
  body: unknown[] = []
  classes = new Set<string>()
  attributes = new Map<string, string>()
  listeners = new Map<string, ((event: unknown) => void)[]>()
  focused = 0
  classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name), contains: (name: string) => this.classes.has(name) }
  set textContent(value: string) {
    this.text = value
  }
  get textContent() {
    return this.text
  }
  replaceChildren(...nodes: unknown[]) {
    this.body = nodes
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value)
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  fire(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
  focus() {
    this.focused++
    fakeDocument.activeElement = this
  }
}

const parts: Record<string, Fake> = { sheet: new Fake(), 'sheet-title': new Fake(), 'sheet-body': new Fake(), 'sheet-close': new Fake() }
parts.sheet!.hidden = true
const fakeDocument = {
  body: new Fake(),
  activeElement: null as Fake | null,
  listeners: new Map<string, ((event: unknown) => void)[]>(),
  getElementById: (id: string) => parts[id] ?? null,
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  },
  press(key: string) {
    for (const listener of this.listeners.get('keydown') ?? []) listener({ key, defaultPrevented: false })
  },
}

describe('the bottom sheet', () => {
  let sheet: Record<string, any>
  let saved: unknown

  beforeAll(async () => {
    saved = (globalThis as Record<string, unknown>).document
    ;(globalThis as Record<string, unknown>).document = fakeDocument
    sheet = await import(join(ROOT, 'ui', 'sheet.ts'))
    sheet.wireSheet()
  })
  afterAll(() => {
    ;(globalThis as Record<string, unknown>).document = saved
  })

  test('open shows the title and body, moves focus to the title, and slides up', () => {
    const row = new Fake()
    const body = {}
    expect(sheet.sheetOpen()).toBe(false)
    sheet.openSheet({ title: 'Memory', body, returnFocus: row })
    expect(sheet.sheetOpen()).toBe(true)
    expect(parts.sheet!.hidden).toBe(false)
    expect(parts.sheet!.classes.has('is-open')).toBe(true)
    expect(parts['sheet-title']!.text).toBe('Memory')
    expect(parts['sheet-body']!.body).toEqual([body])
    expect(parts['sheet-title']!.focused).toBe(1)
  })

  test('Close closes: runs onClose once, gives focus back, hides after the slide', async () => {
    sheet.closeSheet()
    const row = new Fake()
    let closed = 0
    sheet.openSheet({ title: 'A', body: {}, returnFocus: row, onClose: () => closed++ })
    parts['sheet-close']!.fire('click')
    expect(sheet.sheetOpen()).toBe(false)
    expect(closed).toBe(1)
    expect(row.focused).toBe(1)
    expect(parts.sheet!.classes.has('is-open')).toBe(false)
    sheet.closeSheet()
    expect(closed).toBe(1)
    await Bun.sleep(300)
    expect(parts.sheet!.hidden).toBe(true)
  })

  test('Esc closes it, other keys and a closed sheet do nothing', () => {
    let closed = 0
    fakeDocument.press('Escape')
    sheet.openSheet({ title: 'B', body: {}, onClose: () => closed++ })
    fakeDocument.press('Enter')
    expect(sheet.sheetOpen()).toBe(true)
    fakeDocument.press('Escape')
    expect(sheet.sheetOpen()).toBe(false)
    expect(closed).toBe(1)
  })

  test('opening again replaces the content without running the old onClose; returnFocus may be a function', () => {
    const row = new Fake()
    let first = 0
    let second = 0
    sheet.openSheet({ title: 'One', body: { n: 1 }, onClose: () => first++ })
    sheet.openSheet({ title: 'Two', body: { n: 2 }, returnFocus: () => row, onClose: () => second++ })
    expect(parts['sheet-title']!.text).toBe('Two')
    expect(first).toBe(0)
    sheet.closeSheet()
    expect(first).toBe(0)
    expect(second).toBe(1)
    expect(row.focused).toBe(1)
  })

  test('without returnFocus, focus returns to what had it when the sheet opened', () => {
    const opener = new Fake()
    fakeDocument.activeElement = opener
    sheet.openSheet({ title: 'C', body: {} })
    expect(opener.focused).toBe(0)
    sheet.closeSheet()
    expect(opener.focused).toBe(1)
  })
})

describe('the sheet markup', () => {
  const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
  const css = readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')

  test('one dialog aside outside every view, named by its title, with a Close button; the old right panel is gone', () => {
    const aside = /<aside id="sheet"[^>]*>/.exec(html)?.[0] ?? ''
    expect(aside).toContain('role="dialog"')
    expect(aside).toContain('aria-modal="false"')
    expect(aside).toContain('aria-labelledby="sheet-title"')
    expect(aside).toContain('hidden')
    expect(html).toMatch(/<h2 id="sheet-title"[^>]*tabindex="-1"/)
    expect(html).toMatch(/<button id="sheet-close"[^>]*aria-label="Close"/)
    expect(html.indexOf('id="sheet"')).toBeGreaterThan(html.lastIndexOf('</main>'))
    expect(html).not.toContain('id="detail"')
  })

  test('it slides with a transform, and not at all under prefers-reduced-motion', () => {
    expect(css).toMatch(/\.sheet \{[^}]*transform: translateY\(100%\)[^}]*transition: transform/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.sheet \{ transition: none; \} \}/)
  })
})
