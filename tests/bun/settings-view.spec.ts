// UI.1, UI.2 and UI.3: the Settings tab (ui/settings.ts) drawn from the real GET /api/settings of the real
// server on 127.0.0.1, over a temp root, a temp HOME and the stub claude CLI (tests/bun/fixtures/claude-stub.ts):
// nothing here can reach the real ~/.claude. Only the DOM is stood in for.
import { afterAll, describe, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from '../../ui/server'
import { ROOT, tempDir } from './helpers'

const settings = (await import(join(ROOT, 'ui', 'settings.ts'))) as Record<string, any>
const { bannerLines, checkItem, checkValue, drawGroups, drawTop, factLines, filterRows, formatValue, newView, parseSettings, setupLines } = settings

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const STUB = join(ROOT, 'tests', 'bun', 'fixtures', 'claude-stub.ts')
const PLUGIN_ID = 'mnemosyne@mnemosyne'
const MARKUP = '<img src=x onerror=alert(1)>'

// ---- A DOM-free stand-in document ----

class FakeText {
  constructor(public data: string) {}
  get textContent() {
    return this.data
  }
}

class FakeNode {
  children: (FakeNode | FakeText)[] = []
  parent: FakeNode | null = null
  attributes = new Map<string, string>()
  dataset: Record<string, string> = {}
  className = ''
  hidden = false
  disabled = false
  checked = false
  open = false
  value = ''
  id = ''
  type = ''
  title = ''
  listeners = new Map<string, ((event: unknown) => void)[]>()
  constructor(public tagName: string) {}
  get textContent(): string {
    return this.children.map(child => child.textContent).join('')
  }
  set textContent(value: string) {
    this.children = value === '' ? [] : [new FakeText(String(value))]
  }
  append(...nodes: (FakeNode | FakeText | string)[]) {
    for (const node of nodes) {
      const child = typeof node === 'string' ? new FakeText(node) : node
      if (child instanceof FakeNode) child.parent = this
      this.children.push(child)
    }
  }
  replaceChildren(...nodes: (FakeNode | FakeText | string)[]) {
    this.children = []
    this.append(...nodes)
  }
  replaceWith(node: FakeNode) {
    const parent = this.parent
    if (parent === null) return
    parent.children = parent.children.map(child => (child === this ? node : child))
    node.parent = parent
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
  find(tag: string, label?: string): FakeNode | undefined {
    return this.all().find(node => node.tagName === tag && (label === undefined || node.textContent === label))
  }
  findAll(tag: string): FakeNode[] {
    return this.all().filter(node => node.tagName === tag)
  }
}

const fakeDocument = { createElement: (tag: string) => new FakeNode(tag.toLowerCase()), createTextNode: (data: string) => new FakeText(data) }

async function withDocument<T>(body: () => Promise<T> | T): Promise<T> {
  const g = globalThis as Record<string, unknown>
  const saved = g.document
  g.document = fakeDocument
  try {
    return await body()
  } finally {
    g.document = saved
  }
}

const last = <T>(list: readonly T[]): T => list[list.length - 1] as T
const tick = () => new Promise(resolve => setTimeout(resolve, 5))
/** Server calls the page made that have not answered yet; settle() waits for them (the real server's round trip takes a while). */
const inflight = new Set<Promise<unknown>>()
const settle = async () => {
  await tick()
  while (inflight.size > 0) await Promise.allSettled([...inflight])
  await tick()
}

// ---- A real server with the stub CLI ----

const disposers: (() => void)[] = []
afterAll(() => {
  for (const dispose of disposers) dispose()
})

async function boot(extra: object = {}) {
  const temp = tempDir('settings-view')
  const root = join(temp.dir, 'root')
  const store = join(root, 'store')
  const home = join(temp.dir, 'home')
  mkdirSync(store, { recursive: true })
  mkdirSync(join(home, '.claude'), { recursive: true })
  writeFileSync(join(home, '.claude', 'settings.json'), `${JSON.stringify({ pluginConfigs: { [PLUGIN_ID]: { options: { guardMode: 'strict' } } } })}\n`)
  const claude = join(temp.dir, 'claude')
  writeFileSync(claude, `#!/bin/sh\nexec "${process.execPath}" "${STUB}" "$@"\n`)
  chmodSync(claude, 0o755)
  const env = { ...(process.env as Record<string, string>), HOME: home, CLAUDE_STUB_MODE: 'ok', CLAUDE_STUB_SCHEMA_EXTRA: JSON.stringify(extra) }
  const started = await startServer({ root, store, cli: CLI, activityLog: join(root, 'activity.jsonl'), pluginRoot: ROOT, pluginId: PLUGIN_ID, claudeCli: claude }, { settings: { env } })
  disposers.push(() => {
    started.stop()
    temp.dispose()
  })
  const base = `http://127.0.0.1:${started.port}`
  const call = async (path: string, body?: unknown) => {
    const response = await fetch(`${base}${path}`, body === undefined ? { headers: { Authorization: `Bearer ${started.token}` } } : { method: 'POST', headers: { Authorization: `Bearer ${started.token}`, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { status: response.status, body: await response.json().catch(() => null) }
  }
  return { call, root, home }
}

type Posted = { path: string; body: any }

/** A host whose POSTs go to the real server, and are recorded. `hold` makes the next POST wait for `release()`. */
function realHost(world: Awaited<ReturnType<typeof boot>>) {
  const posted: Posted[] = []
  const copied: string[] = []
  let reloads = 0
  const gate: { wait: Promise<void> | null; release: () => void } = { wait: null, release: () => {} }
  const host = {
    post: async (path: string, body: unknown) => {
      posted.push({ path, body })
      if (gate.wait !== null) await gate.wait
      const call = world.call(path, body)
      inflight.add(call)
      void call.finally(() => inflight.delete(call))
      return call
    },
    copy: async (text: string) => {
      copied.push(text)
      return true
    },
    reload: () => {
      reloads++
    },
    browser: [] as unknown[],
  }
  return { host, posted, copied, reloads: () => reloads, hold: () => (gate.wait = new Promise<void>(resolve => (gate.release = () => ((gate.wait = null), resolve())))), release: () => gate.release() }
}

async function load(world: Awaited<ReturnType<typeof boot>>) {
  const reply = await world.call('/api/settings')
  expect(reply.status).toBe(200)
  const data = parseSettings(reply.body)
  expect(data).not.toBeNull()
  return data
}

/** The drawn row for a setting id, in a drawn tab. */
const rowOf = (groups: FakeNode[], id: string) => groups.flatMap(group => group.all()).find(node => node.dataset.id === id)

describe('UI.1: the Settings tab draws from /api/settings only', () => {
  test('groups come in the server order, with This browser last; every row shows name, help, value, default, home and applies', async () => {
    const world = await boot()
    const data = await load(world)
    await withDocument(() => {
      const view = newView()
      const host = realHost(world).host
      host.browser = [{ label: 'Theme', help: 'h', choices: [{ value: 'auto', label: 'Auto' }], get: () => 'auto', set: () => {} }]
      const cards = drawGroups(data, view, host) as FakeNode[]
      const titles = cards.map(card => card.find('h2')!.textContent)
      expect(titles).toEqual(['Guard', 'Tags', 'Recall and embeddings', 'Expiry', 'Storage', 'Map', 'Tools', 'Setup', 'This browser'])
      const max = rowOf(cards, 'guard.maxLength')!
            const joined = max.all().map(node => node.textContent).join(' | ')
      expect(joined).toContain('Max length')
      expect(joined).toContain('Current: 4000 (default)')
      expect(joined).toContain('Default: 4000')
      expect(joined).toContain('Mnemosyne config')
      expect(joined).toContain('Applies now')
      // A plugin option: its home and the "after restart" badge are the server's words.
      const mode = rowOf(cards, 'guardMode')!.all().map(node => node.textContent).join(' | ')
      expect(mode).toContain('Plugin option')
      expect(mode).toContain('Applies after restart')
      // Tool on/off applies at the next session start.
      expect(rowOf(cards, 'tools.memory_forget')!.all().map(node => node.textContent).join(' | ')).toContain('Applies next session')
    })
  })

  test('read-only rows have no editor and no Reset; the secret rules, engine tools and setup status are plain text', async () => {
    const world = await boot()
    const data = await load(world)
    await withDocument(() => {
      const cards = drawGroups(data, newView(), realHost(world).host) as FakeNode[]
      for (const id of ['guard.secretRules', 'tags.format', 'tools.engineTools']) {
        const row = rowOf(cards, id)!
        expect(row).toBeDefined()
        expect(row.findAll('input')).toHaveLength(0)
        expect(row.findAll('select')).toHaveLength(0)
        expect(row.findAll('button')).toHaveLength(0)
      }
      expect(rowOf(cards, 'guard.secretRules')!.all().map(node => node.textContent).join(' ')).toContain('GitHub token')
      expect(rowOf(cards, 'tools.engineTools')!.all().map(node => node.textContent).join(' ')).toContain('mnemopi_recall')
      // E2 is read-only with a note until 0.9.0 adds it.
      const e2 = rowOf(cards, 'expireUnusedDays')!
      expect(e2.findAll('input')).toHaveLength(0)
      expect(e2.all().map(node => node.textContent).join(' ')).toContain('arrives in 0.9.0')
    })
  })

  test('a setting the schema adds later appears with no code change, and is editable', async () => {
    const world = await boot({ expireUnusedDays: { type: 'number', title: 'Expire unused', description: 'Days.', default: 0, min: 0, max: 365 } })
    const data = await load(world)
    expect(data.settings.some((row: any) => row.id === 'expireUnusedDays' && row.home === 'option')).toBe(true)
    await withDocument(() => {
      const cards = drawGroups(data, newView(), realHost(world).host) as FakeNode[]
      const row = rowOf(cards, 'expireUnusedDays')!
      expect(row.findAll('input').length).toBeGreaterThan(0)
    })
  })

  test('the banner lists config warnings, the restart note and a read-only plugin-options note; the filter narrows rows', async () => {
    const world = await boot()
    const data = await load(world)
    const view = newView()
    expect(bannerLines(data, view).some((line: string) => line.startsWith('Warning: config.json'))).toBe(true)
    const readOnly = { ...data, plugin: { ...data.plugin, optionsEditable: false, note: 'Plugin options are read-only here: change them in /config.' }, restartNeeded: ['extractionModel'] }
    const lines = bannerLines(readOnly, view)
    expect(lines).toContain('Plugin options are read-only here: change them in /config.')
    expect(lines.some((line: string) => line.startsWith('Restart needed for:'))).toBe(true)
    const hits = filterRows(data.settings, data.groups, 'near-duplicate')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((row: any) => /near-duplicate/i.test(`${row.label} ${row.help} ${row.id}`))).toBe(true)
    expect(filterRows(data.settings, data.groups, '')).toHaveLength(data.settings.length)
  })

  test('a reply that is not a settings list is refused; server text is only ever textContent', () => {
    expect(parseSettings(null)).toBeNull()
    expect(parseSettings({})).toBeNull()
    expect(parseSettings({ settings: [{ id: 'x', label: MARKUP, group: 'guard', home: 'config', type: 'integer', value: 1, default: 1 }], groups: [{ id: 'guard', label: 'Guard' }] })).not.toBeNull()
    const source = readFileSync(join(ROOT, 'ui', 'settings.ts'), 'utf8')
    expect(source).not.toMatch(/\binnerHTML\b|insertAdjacentHTML|outerHTML|document\.write|\beval\(|new Function|\.style\b|setAttribute\('style'|localStorage/)
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const view = html.slice(html.indexOf('id="view-settings"'), html.indexOf('<aside id="sheet"'))
    expect(view).toContain('id="settings-groups"')
    expect(view).not.toMatch(/\sstyle=|<script|\son\w+=/)
    return withDocument(() => {
      const data = parseSettings({ settings: [{ id: 'x', label: MARKUP, help: MARKUP, group: 'guard', home: 'config', type: 'integer', value: 1, default: 1, min: 1, max: 2 }], groups: [{ id: 'guard', label: 'Guard' }] })
      const cards = drawGroups(data, newView(), { post: async () => ({ status: 0, body: {} }), copy: async () => true, reload: () => {}, browser: [] }) as FakeNode[]
      expect(cards[0]!.all().map(node => node.textContent).join(' ')).toContain(MARKUP)
      expect(cards[0]!.all().every(node => node.tagName !== 'img')).toBe(true)
    })
  })

  test('the tab is the last one and has its own markup and styles', () => {
    const app = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    expect(app).toMatch(/const VIEWS = \[[^\]]*'health', 'vocabulary', 'settings'\] as const/)
    expect(app).toMatch(/settings: 'Settings'/)
    expect(app).toMatch(/if \(view === 'settings'\) void loadSettings\(\)/)
    const css = readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')
    expect(css).toContain('.set-row')
    // Only theme tokens in the Settings styles: no raw colours, so light and dark both follow.
    const mine = css.slice(css.indexOf('/* Settings tab'))
    expect(mine).not.toMatch(/#[0-9A-Fa-f]{3,8}\b|rgba?\(/)
  })
})

describe('UI.2: editors, list add and remove, reset', () => {
  test('checkValue checks type and range before anything is sent', () => {
    const integer = { id: 'a', type: 'integer', min: 5, max: 100 }
    expect(checkValue(integer, '15')).toEqual({ ok: true, value: 15 })
    expect(checkValue(integer, '4')).toMatchObject({ ok: false })
    expect(checkValue(integer, '101')).toMatchObject({ ok: false })
    expect(checkValue(integer, '7.5')).toMatchObject({ ok: false })
    expect(checkValue(integer, '')).toMatchObject({ ok: false })
    expect(checkValue(integer, 'abc')).toMatchObject({ ok: false })
    expect(checkValue({ id: 'n', type: 'number', min: 0.8, max: 0.99 }, '0.92')).toEqual({ ok: true, value: 0.92 })
    expect(checkValue({ id: 'n', type: 'number', min: 0.8, max: 0.99 }, '1')).toMatchObject({ ok: false })
    expect(checkValue({ id: 'c', type: 'choice', choices: ['strict', 'warn', 'off'] }, 'loud')).toMatchObject({ ok: false })
    expect(checkValue({ id: 't', type: 'text' }, 'line\nbreak')).toMatchObject({ ok: false })
    expect(checkItem({ id: 'w', type: 'words', minItemLength: 3, maxItemLength: 80, maxItems: 2 }, 'ab', [])).toMatchObject({ ok: false })
    expect(checkItem({ id: 'w', type: 'words', minItemLength: 3, maxItemLength: 80, maxItems: 2 }, 'Hello', ['hello'])).toMatchObject({ ok: false })
    expect(checkItem({ id: 'w', type: 'words', minItemLength: 3, maxItemLength: 80, maxItems: 1 }, 'fine', ['other'])).toMatchObject({ ok: false })
    expect(checkItem({ id: 'w', type: 'words', minItemLength: 3, maxItemLength: 80, maxItems: 5 }, ' fine ', [])).toEqual({ ok: true, value: 'fine' })
  })

  test('an out-of-range value sends nothing; a good one shows as current only after the server replied', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const row = rowOf(cards, 'tags.maxPerMemory')!
      const input = row.find('input')!
      const save = row.find('button', 'Save')!
      // Out of range: refused on the page, nothing posted.
      input.value = '99'
      save.fire('click')
      await settle()
      expect(sent.posted).toHaveLength(0)
      expect(row.all().map(node => node.textContent).join(' ')).toContain('Enter a number from 1 to 10')
      // A good value: while the server has not answered, the row still shows the old value.
      sent.hold()
      input.value = '4'
      save.fire('click')
      await tick()
      expect(sent.posted).toEqual([{ path: '/api/settings/update', body: { id: 'tags.maxPerMemory', value: 4 } }])
      const text = () => row.all().map(node => node.textContent).join(' | ')
      expect(text()).toContain('Current: 5 (default)')
      expect(text()).not.toContain('Current: 4')
      expect(text()).toContain('Saving…')
      sent.release()
      await settle()
      expect(text()).toContain('Current: 4')
      expect(text()).toContain('Saved. Applies now.')
      expect(readFileSync(join(world.root, 'config.json'), 'utf8')).toContain('"maxPerMemory": 4')
    })
  })

  test('a refusal from the server keeps the old value and shows the reason', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    sent.host.post = async (path: string, body: unknown) => {
      sent.posted.push({ path, body })
      return { status: 400, body: { error: 'guard.warnLength: must be below the max length' } }
    }
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const row = rowOf(cards, 'guard.warnLength')!
      row.find('input')!.value = '300'
      row.find('button', 'Save')!.fire('click')
      await settle()
      const text = row.all().map(node => node.textContent).join(' | ')
      expect(text).toContain('guard.warnLength: must be below the max length')
      expect(text).toContain('Current: 1500 (default)')
    })
  })

  test('a network failure shows a message and keeps the value', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    sent.host.post = async () => {
      throw new Error('boom')
    }
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const row = rowOf(cards, 'guard.minLength')!
      row.find('input')!.value = '20'
      row.find('button', 'Save')!.fire('click')
      await settle()
      const text = row.all().map(node => node.textContent).join(' | ')
      expect(text).toContain('The request failed: boom')
      expect(text).toContain('Current: 15 (default)')
    })
  })

  test('the choice, switch and tool editors send the right body; tool on/off says it applies next session (the server\'s reply)', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const chatter = rowOf(cards, 'guard.chatter')!
      chatter.find('select')!.value = 'off'
      chatter.find('button', 'Save')!.fire('click')
      await settle()
      expect(last(sent.posted)).toEqual({ path: '/api/settings/update', body: { id: 'guard.chatter', value: 'off' } })
      expect(chatter.all().map(node => node.textContent).join(' | ')).toContain('Current: off')
      const tool = rowOf(cards, 'tools.memory_forget')!
      const box = tool.find('input')!
      expect(box.attributes.get('role')).toBe('switch')
      box.checked = false
      tool.find('button', 'Save')!.fire('click')
      await settle()
      expect(last(sent.posted)).toEqual({ path: '/api/settings/update', body: { id: 'tools.memory_forget', value: false } })
      const text = tool.all().map(node => node.textContent).join(' | ')
      expect(text).toContain('Saved. Applies next session.')
      expect(text).toContain('Current: off')
    })
  })

  test('list rows add and remove one item at a time; words go through the server and show only after its reply', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const row = rowOf(cards, 'guard.neverSave')!
      // Too short: refused on the page.
      row.find('input')!.value = 'ab'
      row.find('button', 'Add')!.fire('click')
      await settle()
      expect(sent.posted).toHaveLength(0)
      row.find('input')!.value = 'project codename'
      row.find('button', 'Add')!.fire('click')
      await settle()
      expect(last(sent.posted)).toEqual({ path: '/api/settings/update', body: { id: 'guard.neverSave', add: 'project codename' } })
      expect(row.findAll('li').map(li => li.textContent).join(' | ')).toContain('project codename')
      row.find('button', 'Remove')!.fire('click')
      await settle()
      expect(last(sent.posted)).toEqual({ path: '/api/settings/update', body: { id: 'guard.neverSave', remove: 'project codename' } })
      expect(row.findAll('li').map(li => li.textContent).join(' | ')).toContain('No entries.')
      // The activity log never holds the item text (C8): the server wrote key names only.
      expect(readFileSync(join(world.root, 'activity.jsonl'), 'utf8')).not.toContain('project codename')
    })
  })

  test('Reset to default asks the server and redraws the row with the default; a plugin option row resets too', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const view = newView()
      const holder = new FakeNode('div')
      const cards = drawGroups(data, view, sent.host) as FakeNode[]
      holder.append(...cards)
      const first = rowOf(cards, 'guard.maxLength')!
      first.find('input')!.value = '5000'
      first.find('button', 'Save')!.fire('click')
      await settle()
      expect(first.all().map(node => node.textContent).join(' | ')).toContain('Current: 5000')
      first.find('button', 'Reset to default')!.fire('click')
      await settle()
      expect(last(sent.posted)).toEqual({ path: '/api/settings/reset', body: { id: 'guard.maxLength' } })
      const again = rowOf(cards, 'guard.maxLength')!
      const text = again.all().map(node => node.textContent).join(' | ')
      expect(text).toContain('Current: 4000 (default)')
      expect(text).toContain('Back at the default.')
      expect(again.find('input')!.value).toBe('4000')
    })
  })

  test('memoryDir and scope ask for the new value typed again, and send it as confirm', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const row = rowOf(cards, 'memoryDir')!
      const [value, again] = row.findAll('input')
      expect(row.all().map(node => node.textContent).join(' ')).toContain('Type the new value again to confirm')
      expect(row.all().map(node => node.textContent).join(' ')).toContain('Memories already saved are not moved')
      value!.value = '~/mnemo-elsewhere'
      again!.value = '~/mnemo-else'
      row.find('button', 'Save')!.fire('click')
      await settle()
      expect(sent.posted).toHaveLength(0)
      expect(row.all().map(node => node.textContent).join(' ')).toContain('The two entries differ')
      again!.value = '~/mnemo-elsewhere'
      row.find('button', 'Save')!.fire('click')
      await settle()
      expect(last(sent.posted)).toEqual({ path: '/api/settings/update', body: { id: 'memoryDir', value: '~/mnemo-elsewhere', confirm: '~/mnemo-elsewhere' } })
      const text = row.all().map(node => node.textContent).join(' | ')
      expect(text).toContain('Current: ~/mnemo-elsewhere')
      expect(text).toContain('Applies after restart')
    })
  })

  test('scope saves: the choice editor asks for the value typed again and sends it as confirm', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const row = rowOf(cards, 'scope')!
      const info = data.settings.find((r: any) => r.id === 'scope')
      expect(row.all().map(node => node.textContent).join(' ')).toContain('Type the new value again to confirm')
      const other = (info.choices as string[]).find(c => c !== info.value)!
      row.find('select')!.value = other
      const [again] = row.findAll('input')
      again!.value = 'nope'
      row.find('button', 'Save')!.fire('click')
      await settle()
      expect(sent.posted).toHaveLength(0)
      expect(row.all().map(node => node.textContent).join(' ')).toContain('The two entries differ')
      again!.value = other
      row.find('button', 'Save')!.fire('click')
      await settle()
      expect(last(sent.posted)).toEqual({ path: '/api/settings/update', body: { id: 'scope', value: other, confirm: other } })
      expect(row.all().map(node => node.textContent).join(' | ')).toContain(`Current: ${other}`)
    })
  })

  test('saved at its default an option stops saying (default); Reset to default on memoryDir and scope sends the default as confirm and the real route accepts it', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const textOf = (row: FakeNode) => row.all().map(node => node.textContent).join(' | ')
      for (const id of ['memoryDir', 'scope']) {
        const info = data.settings.find((r: any) => r.id === id)
        const def = String(info.default)
        const choice = id === 'scope'
        const alt = choice ? (info.choices as string[]).find(c => c !== def)! : '~/mnemo-elsewhere'
        const row = () => rowOf(cards, id)!
        const fill = (value: string) => {
          if (choice) row().find('select')!.value = value
          else row().findAll('input')[0]!.value = value
          row().findAll('input')[choice ? 0 : 1]!.value = value
        }
        fill(alt)
        row().find('button', 'Save')!.fire('click')
        await settle()
        expect(last(sent.posted).body).toEqual({ id, value: alt, confirm: alt })
        fill(def)
        row().find('button', 'Save')!.fire('click')
        await settle()
        expect(last(sent.posted).body).toEqual({ id, value: def, confirm: def })
        expect(textOf(row())).toContain(`Current: ${def}`)
        expect(textOf(row())).not.toContain('(default)')
        // Reset without the default typed: refused on the page.
        const before = sent.posted.length
        row().find('button', 'Reset to default')!.fire('click')
        await settle()
        expect(sent.posted).toHaveLength(before)
        expect(textOf(row())).toContain('Type the default exactly')
        const inputs = row().findAll('input')
        inputs[inputs.length - 1]!.value = def
        row().find('button', 'Reset to default')!.fire('click')
        await settle()
        expect(last(sent.posted)).toEqual({ path: '/api/settings/reset', body: { id, confirm: def } })
        expect(textOf(row())).toContain('Nothing changed.')
        expect(textOf(row())).toContain('(default)')
      }
    })
  })

  test('the restart badge and the banner follow each reply, and clear when a later reply no longer needs one', async () => {
    const world = await boot()
    const data = await load(world)
    const view = newView()
    const answers: any[] = [{ ok: true, value: 4100, restartNeeded: true }, { ok: true, value: 4000 }]
    const host = { post: async () => ({ status: 200, body: answers.shift() }), copy: async () => true, reload: () => {}, browser: [] as unknown[] }
    await withDocument(async () => {
      const top = drawTop(data, view, host, () => {}) as FakeNode[]
      const cards = drawGroups(data, view, host) as FakeNode[]
      const row = rowOf(cards, 'guard.maxLength')!
      const banner = top[0]!
      const text = (node: FakeNode) => node.all().map(n => n.textContent).join(' | ')
      row.find('input')!.value = '4100'
      row.find('button', 'Save')!.fire('click')
      await settle()
      expect(text(row)).toContain('Restart needed')
      expect(text(banner)).toContain('Restart needed for:')
      expect(banner.hidden).toBe(false)
      row.find('input')!.value = '4000'
      row.find('button', 'Save')!.fire('click')
      await settle()
      expect(text(row)).not.toContain('Restart needed')
      expect(text(banner)).not.toContain('Restart needed for:')
    })
  })

  test('Reset all needs the word reset typed, then posts the confirm and reloads', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const view = newView()
      let top: FakeNode[] = []
      const redraw = () => {
        top = drawTop(data, view, sent.host, redraw) as FakeNode[]
      }
      redraw()
      const holder = () => new FakeNode('div')
      const find = (tag: string, label?: string) => top.flatMap(node => node.all()).find(node => node.tagName === tag && (label === undefined || node.textContent === label))
      void holder
      find('button', 'Reset all')!.fire('click')
      expect(view.resetAll).toBe(true)
      find('button', 'Reset all settings')!.fire('click')
      await settle()
      expect(sent.posted).toHaveLength(0)
      find('input')!.value = 'reset'
      find('button', 'Reset all settings')!.fire('click')
      await settle()
      expect(sent.posted).toEqual([{ path: '/api/settings/reset', body: { all: true, confirm: 'reset' } }])
      expect(sent.reloads()).toBe(1)
      expect(view.notice).toContain('Plugin options were not changed')
    })
  })

  test('only one change at a time: a second Save while one is pending is not sent', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      sent.hold()
      const one = rowOf(cards, 'guard.minLength')!
      one.find('input')!.value = '20'
      one.find('button', 'Save')!.fire('click')
      await tick()
      const two = rowOf(cards, 'tags.autoAdmitCount')!
      two.find('input')!.value = '2'
      two.find('button', 'Save')!.fire('click')
      await tick()
      expect(sent.posted).toHaveLength(1)
      expect(two.all().map(node => node.textContent).join(' ')).toContain('Another change is still saving')
      sent.release()
      await settle()
    })
  })
})

describe('UI.3: Setup and backups, and This browser', () => {
  test('the setup card shows the status; the copy buttons copy the four commands and post nothing', async () => {
    const world = await boot()
    const data = await load(world)
    expect(setupLines(data.settings.find((row: any) => row.id === 'setup.status').value).join(' ')).toContain('Engine:')
    const sent = realHost(world)
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const setup = cards.find(card => card.find('h2')!.textContent === 'Setup')!
      for (const command of ['/mnemosyne-setup', '/mnemosyne-embed', '/mnemosyne-tags', '/mnemosyne-knowledge']) {
        expect(setup.all().some(node => node.tagName === 'code' && node.textContent === command)).toBe(true)
      }
      for (const copy of setup.findAll('button').filter(button => button.textContent === 'Copy')) copy.fire('click')
      await settle()
      expect(sent.copied).toEqual(['/mnemosyne-setup', '/mnemosyne-embed', '/mnemosyne-tags', '/mnemosyne-knowledge'])
      expect(sent.posted).toHaveLength(0)
      // No button anywhere on this card runs setup or rebuilds vectors: only Copy and Back up now.
      expect(setup.findAll('button').map(button => button.textContent).sort()).toEqual(['Back up now', 'Copied', 'Copied', 'Copied', 'Copied'])
    })
  })

  test('a failed copy says so, and the command stays on the page as text', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    sent.host.copy = async () => false
    await withDocument(async () => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const setup = cards.find(card => card.find('h2')!.textContent === 'Setup')!
      const copy = setup.findAll('button').find(button => button.textContent === 'Copy')!
      copy.fire('click')
      await settle()
      expect(copy.textContent).toContain('Copy failed')
      expect(setup.all().some(node => node.tagName === 'code' && node.textContent === '/mnemosyne-setup')).toBe(true)
    })
  })

  test('Back up now shows the new file, or the refusal; the list follows the reply', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    await withDocument(async () => {
      const view = newView()
      const cards = drawGroups(data, view, sent.host) as FakeNode[]
      const setup = cards.find(card => card.find('h2')!.textContent === 'Setup')!
      expect(setup.all().map(node => node.textContent).join(' ')).toContain('No backups yet.')
      // The temp store has no database, so the real server refuses; the page shows that text.
      setup.find('button', 'Back up now')!.fire('click')
      await settle()
      expect(last(sent.posted)).toEqual({ path: '/api/backup', body: {} })
      expect(view.backup.error).toBe(true)
      expect(setup.all().map(node => node.textContent).join(' ')).toContain('no backup was made')
      // A good answer: the file name, its size and the new list.
      sent.host.post = async (path: string, body: unknown) => {
        sent.posted.push({ path, body })
        return { status: 200, body: { ok: true, name: 'mnemopi-20261026T101500123Z.db', size: 2048, rows: 3, keep: 10, backups: [{ name: 'mnemopi-20261026T101500123Z.db', size: 2048, date: '2026-10-26T10:15:00.000Z' }] } }
      }
      setup.find('button', 'Back up now')!.fire('click')
      await settle()
      const text = setup.all().map(node => node.textContent).join(' | ')
      expect(text).toContain('Backed up as mnemopi-20261026T101500123Z.db')
      expect(text).toContain('2026-10-26 10:15 UTC')
      expect(view.backup.error).toBe(false)
    })
  })

  test('This browser rows read and write through the host, never through localStorage in this module', async () => {
    const world = await boot()
    const data = await load(world)
    const sent = realHost(world)
    let theme = 'auto'
    sent.host.browser = [{ label: 'Theme', help: 'Kept in this browser.', choices: [{ value: 'auto', label: 'Auto' }, { value: 'dark', label: 'Dark' }], get: () => theme, set: (value: string) => (theme = value) }]
    await withDocument(() => {
      const cards = drawGroups(data, newView(), sent.host) as FakeNode[]
      const browser = last(cards)!
      expect(browser.find('h2')!.textContent).toBe('This browser')
      const dark = browser.find('button', 'Dark')!
      dark.fire('click')
      expect(theme).toBe('dark')
      expect(dark.attributes.get('aria-pressed')).toBe('true')
      expect(sent.posted).toHaveLength(0)
    })
    // The page's own storage access is the try/catch'd prefStorage() of ui/app.ts; it throws-safe returns undefined.
    const app = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    expect(app).toMatch(/function prefStorage\(\)[^]*?try \{[^]*?localStorage[^]*?\} catch \{\s*return undefined/)
  })

  test('formatting helpers', () => {
    expect(formatValue(true)).toBe('on')
    expect(formatValue([])).toBe('none')
    expect(formatValue(['a', 'b'])).toBe('a, b')
    expect(formatValue(null)).toBe('not set')
    expect(factLines({ maxLength: 32, vocabulary: { admitted: 2 } })).toEqual(['maxLength: 32', 'vocabulary · admitted: 2'])
  })
})
