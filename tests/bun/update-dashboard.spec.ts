// The dashboard's Update button (0.28.0): ui/update-routes.ts (release check,
// handoff, start), its routes on the real server behind the token, origin and
// JSON checks, and ui/update.ts (the version line, the confirm, the progress) on
// a stand-in document. GitHub and the detached start are always faked.
import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pluginVersion, startServer, type Started } from '../../ui/server'
import {
  CHECK_EVERY_MS,
  fetchLatest,
  HANDOFF_FILE,
  type LaunchCommand,
  latestRelease,
  running,
  settle,
  takeHandoff,
  UPDATE_CHECK_FILE,
  UPDATE_STATUS_FILE,
  updateAvailable,
  updaterHome,
  windowsCommandLine,
} from '../../ui/update-routes'
import { ROOT, tempDir } from './helpers'

// ui/update.ts is DOM code (checked by ui/tsconfig.json): loaded by a path tsc does not follow.
/** A reply's JSON, untyped (the tests check its shape). */
const j = (response: Response): Promise<any> => response.json()

const view = (await import(join(ROOT, 'ui', 'update.ts'))) as Record<string, any>

const CURRENT = pluginVersion()!
const bump = (version: string) => version.replace(/^(\d+)\.(\d+)\..*$/, (_, a, b) => `${a}.${Number(b) + 1}.0`)
const NEWER = bump(CURRENT)

/** A fetch that answers GitHub's tags list and the engine package.json, counting calls; never the network. */
function fakeGitHub(tags: string[], engine = '18.12.3-mnemosyne.99', fail = false) {
  const calls: string[] = []
  const fetcher = (async (url: string) => {
    calls.push(String(url))
    if (fail) throw new Error('offline')
    if (String(url).includes('/tags?')) return Response.json(tags.map(name => ({ name })))
    return Response.json({ version: engine })
  }) as unknown as typeof fetch
  return { fetcher, calls }
}

describe('the release check', () => {
  test('version comparison: offered only for a newer release', () => {
    const latest = (plugin: string) => ({ tag: `v${plugin}`, plugin, engine: null })
    expect(updateAvailable('0.27.0', latest('0.28.0'))).toBe(true)
    expect(updateAvailable('0.27.0', latest('0.27.0'))).toBe(false)
    expect(updateAvailable('0.28.0', latest('0.27.0'))).toBe(false)
    expect(updateAvailable('0.9.0', latest('0.10.0'))).toBe(true)
    expect(updateAvailable(null, latest('0.28.0'))).toBe(false)
    expect(updateAvailable('0.27.0', null)).toBe(false)
  })
  test('fetchLatest: the newest vX.Y.Z tag and its engine build', async () => {
    const { fetcher, calls } = fakeGitHub(['v0.26.1', 'v0.28.0', 'v0.29.0-rc1', 'nightly'], '18.12.3-mnemosyne.13')
    expect(await fetchLatest(fetcher)).toEqual({ tag: 'v0.28.0', plugin: '0.28.0', engine: '18.12.3-mnemosyne.13' })
    expect(calls[1]).toBe('https://raw.githubusercontent.com/Interstellar-code/claude-mnemosyne/v0.28.0/engine/package.json')
  })
  test('a failed check is silent: undefined, never a throw', async () => {
    expect(await fetchLatest(fakeGitHub([], '', true).fetcher)).toBeUndefined()
    expect(await fetchLatest(fakeGitHub(['junk']).fetcher)).toBeUndefined()
  })
  test('at most one GitHub check a day, a failure cached too', async () => {
    const { dir } = tempDir('update-check')
    let now = Date.UTC(2026, 10, 7, 12)
    const ok = fakeGitHub(['v0.28.0'])
    expect(await latestRelease(dir, { fetcher: ok.fetcher, now: () => now })).toMatchObject({ tag: 'v0.28.0' })
    now += CHECK_EVERY_MS - 1000
    expect(await latestRelease(dir, { fetcher: ok.fetcher, now: () => now })).toMatchObject({ tag: 'v0.28.0' })
    expect(ok.calls.filter(url => url.includes('/tags?'))).toHaveLength(1)
    // A day later: asked again; offline now, so null, and that is cached as well.
    now += 2000
    const down = fakeGitHub([], '', true)
    expect(await latestRelease(dir, { fetcher: down.fetcher, now: () => now })).toBeNull()
    expect(await latestRelease(dir, { fetcher: down.fetcher, now: () => now + 60_000 })).toBeNull()
    expect(down.calls).toHaveLength(1)
    expect(JSON.parse(readFileSync(join(dir, UPDATE_CHECK_FILE), 'utf8'))).toMatchObject({ latest: null })
  })
})

describe('the handoff and the guards', () => {
  test('takeHandoff: a fresh, well-formed handoff once; anything else is dropped', () => {
    const { dir } = tempDir('update-handoff')
    const now = Date.UTC(2026, 10, 7, 12)
    const token = 'a'.repeat(43)
    const put = (value: unknown) => writeFileSync(join(dir, HANDOFF_FILE), JSON.stringify(value))
    put({ port: 50123, token, until: new Date(now + 60_000).toISOString() })
    expect(takeHandoff(dir, now)).toEqual({ port: 50123, token })
    expect(existsSync(join(dir, HANDOFF_FILE))).toBe(false)
    expect(takeHandoff(dir, now)).toBeUndefined()
    for (const bad of [
      { port: 50123, token, until: new Date(now - 1).toISOString() },
      { port: 50123, token, until: new Date(now + 31 * 60_000).toISOString() },
      { port: 80, token, until: new Date(now + 60_000).toISOString() },
      { port: 50123, token: 'short', until: new Date(now + 60_000).toISOString() },
      { port: 50123, token: `${token}"`, until: new Date(now + 60_000).toISOString() },
    ]) {
      put(bad)
      expect(takeHandoff(dir, now)).toBeUndefined()
      expect(existsSync(join(dir, HANDOFF_FILE))).toBe(false)
    }
  })
  test('updaterHome: only <home>/.claude/mnemosyne served from its own plugin copy with an updater', () => {
    const { dir } = tempDir('update-home')
    const root = join(dir, '.claude', 'mnemosyne')
    mkdirSync(join(root, 'plugin', 'bin'), { recursive: true })
    expect(updaterHome(root, join(root, 'plugin'))).toBeUndefined()
    writeFileSync(join(root, 'plugin', 'bin', 'update.ts'), '')
    expect(updaterHome(root, join(root, 'plugin'))).toBe(dir)
    expect(updaterHome(root, ROOT)).toBeUndefined()
    expect(updaterHome(join(dir, 'elsewhere'), join(dir, 'elsewhere', 'plugin'))).toBeUndefined()
  })
  test('running: not final, its updater alive, moved within 30 minutes', () => {
    const now = Date.UTC(2026, 10, 7, 12)
    const alive = (pid: number) => pid === 42
    const status = (state: string, minutes: number, pid?: number) => ({ state, lines: [], ...(pid === undefined ? {} : { pid }), started: '', updated: new Date(now - minutes * 60_000).toISOString() }) as never
    expect(running(status('running', 1, 42), now, alive)).toBe(true)
    expect(running(status('starting', 0.5), now, alive)).toBe(true)
    expect(running(status('running', 31, 42), now, alive)).toBe(false)
    expect(running(status('done', 1, 42), now, alive)).toBe(false)
    expect(running(undefined, now, alive)).toBe(false)
  })
  test('a launch that died is settled as failed, not left on "starting" for 30 minutes', () => {
    const now = Date.UTC(2026, 10, 7, 12)
    const alive = (pid: number) => pid === 42
    const at = (seconds: number) => new Date(now - seconds * 1000).toISOString()
    // The server asked for a start a minute ago and no updater ever wrote: dead.
    const never = settle({ state: 'starting', lines: ['Starting'], started: at(61), updated: at(61) }, now, alive)!
    expect(never.state).toBe('failed')
    expect(never.lines.at(-1)).toContain('The updater stopped without finishing')
    expect(running({ state: 'starting', lines: [], started: at(61), updated: at(61) }, now, alive)).toBe(false)
    // Its pid is gone: dead at once.
    expect(settle({ state: 'running', lines: [], pid: 7, started: at(5), updated: at(5) }, now, alive)!.state).toBe('failed')
    // Alive and recent: untouched; final: untouched.
    const live = { state: 'running' as const, lines: ['x'], pid: 42, started: at(5), updated: at(5) }
    expect(settle(live, now, alive)).toBe(live)
    const done = { state: 'done' as const, lines: [], pid: 7, started: at(5), updated: at(5) }
    expect(settle(done, now, alive)).toBe(done)
  })
  test('the Windows command line quotes paths with spaces and sends all output to the log', () => {
    const line = windowsCommandLine({ bun: 'C:\\Users\\a b\\bun.exe', script: 'C:/x/update.ts', args: ['--tag', 'v0.28.0'], cwd: 'C:/x', log: 'C:\\x\\update.log' }, 'C:\\Windows')
    expect(line).toBe('"C:\\Windows\\System32\\cmd.exe" /d /c ""C:\\Users\\a b\\bun.exe" C:/x/update.ts --tag v0.28.0 > "C:\\x\\update.log" 2>&1"')
  })
})

// ---- the routes on the real server ----

const servers: Started[] = []
afterAll(() => {
  for (const server of servers) server.stop()
})

/** A server whose root is <home>/.claude/mnemosyne and whose plugin root is <root>/plugin (with an updater), or the repo. */
async function world(options: { updatable: boolean; tags?: string[] }) {
  const { dir } = tempDir('update-world')
  const root = join(dir, '.claude', 'mnemosyne')
  const pluginRoot = options.updatable ? join(root, 'plugin') : ROOT
  mkdirSync(join(root, 'plugin', 'bin'), { recursive: true })
  if (options.updatable) writeFileSync(join(root, 'plugin', 'bin', 'update.ts'), '')
  const launched: LaunchCommand[] = []
  const github = fakeGitHub(options.tags ?? [`v${NEWER}`])
  const started = await startServer(
    { root, store: join(root, 'store'), cli: join(ROOT, 'engine', 'src', 'cli.ts'), activityLog: '', pluginRoot },
    { update: { fetcher: github.fetcher, launch: async command => void launched.push(command) } },
  )
  servers.push(started)
  const base = `http://127.0.0.1:${started.port}`
  const call = (path: string, init: { method?: string; token?: string | null; origin?: string; body?: string; type?: string } = {}) => {
    const headers: Record<string, string> = {}
    const token = init.token === undefined ? started.token : init.token
    if (token !== null) headers.Authorization = `Bearer ${token}`
    if (init.origin !== undefined) headers.Origin = init.origin
    if (init.body !== undefined) headers['Content-Type'] = init.type ?? 'application/json'
    return fetch(`${base}${path}`, { method: init.method ?? 'GET', headers, body: init.body })
  }
  return { dir, root, started, base, call, launched, github }
}

describe('the update routes', () => {
  test('every route wants the token; the start also the page origin and JSON', async () => {
    const w = await world({ updatable: true })
    expect((await w.call('/api/update', { token: null })).status).toBe(401)
    expect((await w.call('/api/update/status', { token: 'x'.repeat(43) })).status).toBe(401)
    expect((await w.call('/api/update/start', { method: 'POST', token: null, origin: w.base, body: '{}' })).status).toBe(401)
    expect((await w.call('/api/update/start', { method: 'POST', origin: 'http://evil.example', body: '{}' })).status).toBe(403)
    expect((await w.call('/api/update/start', { method: 'POST', origin: w.base, body: '{}', type: 'text/plain' })).status).toBe(415)
    expect((await w.call('/api/update/start', { origin: w.base })).status).toBe(405)
    expect(w.launched).toHaveLength(0)
  })

  test('GET /api/update: current, latest, offered, updatable', async () => {
    const w = await world({ updatable: true })
    const body = await j(await w.call('/api/update'))
    expect(body).toMatchObject({ current: { plugin: CURRENT }, latest: { tag: `v${NEWER}`, plugin: NEWER, engine: '18.12.3-mnemosyne.99' }, available: true, updatable: true, status: null })
  })

  test('POST /api/update/start: launches the plugin copy updater detached with the offered tag, leaves the handoff, refuses a second run', async () => {
    const w = await world({ updatable: true })
    const reply = await w.call('/api/update/start', { method: 'POST', origin: w.base, body: '{}' })
    expect(reply.status).toBe(202)
    expect(await j(reply)).toEqual({ started: true, tag: `v${NEWER}` })
    expect(w.launched).toHaveLength(1)
    const command = w.launched[0]!
    expect(command.script).toBe(join(w.root, 'plugin', 'bin', 'update.ts'))
    expect(command.args).toEqual(['--home', w.dir, '--tag', `v${NEWER}`, '--status', join(w.root, UPDATE_STATUS_FILE)])
    expect(command.log).toBe(join(w.root, 'update.log'))
    const handoff = JSON.parse(readFileSync(join(w.root, HANDOFF_FILE), 'utf8'))
    expect(handoff).toMatchObject({ port: w.started.port, token: w.started.token })
    if (process.platform !== 'win32') expect(statSync(join(w.root, HANDOFF_FILE)).mode & 0o777).toBe(0o600)
    const status = await j(await w.call('/api/update/status'))
    expect(status.status).toMatchObject({ state: 'starting', lines: [`Starting the update to v${NEWER} ...`] })
    const again = await w.call('/api/update/start', { method: 'POST', origin: w.base, body: '{}' })
    expect(again.status).toBe(409)
    expect((await j(again)).error).toBe('An update is already running.')
    expect(w.launched).toHaveLength(1)
  })

  test('nothing to install, or not this install: 409 and no launch', async () => {
    const current = await world({ updatable: true, tags: [`v${CURRENT}`] })
    const none = await current.call('/api/update/start', { method: 'POST', origin: current.base, body: '{}' })
    expect(none.status).toBe(409)
    expect((await j(none)).error).toBe('There is no newer release to install.')
    const claudeCode = await world({ updatable: false })
    expect(await j(await claudeCode.call('/api/update'))).toMatchObject({ available: true, updatable: false })
    const refused = await claudeCode.call('/api/update/start', { method: 'POST', origin: claudeCode.base, body: '{}' })
    expect(refused.status).toBe(409)
    expect((await j(refused)).error).toContain('claude plugin update')
    expect([...current.launched, ...claudeCode.launched]).toHaveLength(0)
  })

  test('a launch that fails is reported, the handoff removed, the run marked failed', async () => {
    const { dir } = tempDir('update-world')
    const root = join(dir, '.claude', 'mnemosyne')
    mkdirSync(join(root, 'plugin', 'bin'), { recursive: true })
    writeFileSync(join(root, 'plugin', 'bin', 'update.ts'), '')
    const started = await startServer(
      { root, store: join(root, 'store'), cli: '', activityLog: '', pluginRoot: join(root, 'plugin') },
      {
        update: {
          fetcher: fakeGitHub([`v${NEWER}`]).fetcher,
          launch: async () => {
            throw new Error('no WMI')
          },
        },
      },
    )
    servers.push(started)
    const base = `http://127.0.0.1:${started.port}`
    const reply = await fetch(`${base}/api/update/start`, { method: 'POST', headers: { Authorization: `Bearer ${started.token}`, Origin: base, 'Content-Type': 'application/json' }, body: '{}' })
    expect(reply.status).toBe(500)
    expect((await j(reply)).error).toBe('Could not start the updater: no WMI')
    expect(existsSync(join(root, HANDOFF_FILE))).toBe(false)
    expect(JSON.parse(readFileSync(join(root, UPDATE_STATUS_FILE), 'utf8'))).toMatchObject({ state: 'failed' })
  })
})

// ---- ui/update.ts on a stand-in document ----

class FakeText {
  constructor(public data: string) {}
  get textContent() {
    return this.data
  }
}

class FakeNode {
  children: (FakeNode | FakeText)[] = []
  attributes = new Map<string, string>()
  className = ''
  hidden = false
  disabled = false
  type = ''
  focused = 0
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
  replaceChildren(...nodes: (FakeNode | FakeText | string)[]) {
    this.children = []
    this.append(...nodes)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value))
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  fire(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
  focus() {
    this.focused++
  }
  all(): FakeNode[] {
    return [this, ...this.children.flatMap(child => (child instanceof FakeNode ? child.all() : []))]
  }
  button(label: string) {
    return this.all().find(node => node.tagName === 'button' && node.textContent === label)
  }
}

async function withDocument<T>(body: () => Promise<T> | T): Promise<T> {
  const g = globalThis as Record<string, unknown>
  const saved = g.document
  g.document = { createElement: (tag: string) => new FakeNode(tag.toLowerCase()), createTextNode: (data: string) => new FakeText(data) }
  try {
    return await body()
  } finally {
    g.document = saved
  }
}

const info = (over: Record<string, unknown> = {}) =>
  view.parseUpdateInfo({
    current: { plugin: '0.27.0', engine: '18.12.3-mnemosyne.12' },
    latest: { tag: 'v0.28.0', plugin: '0.28.0', engine: '18.12.3-mnemosyne.13' },
    available: true,
    updatable: true,
    status: null,
    ...over,
  })

describe('the version line and the confirm (ui/update.ts)', () => {
  test('parseUpdateInfo refuses what is not one, and never offers without a release', () => {
    expect(view.parseUpdateInfo(null)).toBeNull()
    expect(view.parseUpdateInfo({ latest: null })).toBeNull()
    expect(view.parseUpdateInfo({ current: { plugin: '0.27.0' }, latest: null, available: true })).toMatchObject({ available: false, latest: null })
  })
  test('the three states of the line', () => {
    expect(view.versionText(info())).toBe('Mnemosyne v0.27.0 · v0.28.0 available')
    expect(view.versionText(info({ available: false, latest: { tag: 'v0.27.0', plugin: '0.27.0', engine: null } }))).toBe('Mnemosyne v0.27.0 · up to date')
    expect(view.versionText(info({ available: false, latest: null }))).toBe('Mnemosyne v0.27.0')
  })
  test('the confirm says what changes and what does not', () => {
    expect(view.confirmLines(info())).toEqual([
      'Plugin v0.27.0 → v0.28.0',
      'Engine 18.12.3-mnemosyne.12 → 18.12.3-mnemosyne.13',
      'Your memories, settings and tags are not touched.',
      'Open Claude Desktop chats keep the old engine until Claude Desktop restarts.',
      'The dashboard restarts during the update; this page reloads when it is back.',
    ])
    expect(view.confirmLines(info({ latest: { tag: 'v0.28.0', plugin: '0.28.0', engine: '18.12.3-mnemosyne.12' } }))[1]).toBe('Engine 18.12.3-mnemosyne.12 (unchanged)')
    expect(view.confirmLines(info({ latest: { tag: 'v0.28.0', plugin: '0.28.0', engine: null } }))[1]).toBe('Engine 18.12.3-mnemosyne.12 → the build that ships with v0.28.0')
  })
  test('a blocked run says so in plain words and that nothing was stopped', () => {
    const summary = view.statusSummary({ state: 'blocked', lines: ['Windows would not let ...'], started: '', updated: '' })
    expect(summary.title).toContain('files that are in use')
    expect(summary.title).toContain('Nothing was stopped.')
  })
})

describe('the Version cell on a stand-in document', () => {
  const host = () => {
    const calls = { start: 0, started: 0 }
    let answer: string | undefined
    return {
      calls,
      answer: (value: string | undefined) => void (answer = value),
      host: {
        start: async () => (calls.start++, answer),
        started: () => void calls.started++,
      },
    }
  }

  test('newer release, this install: Update… opens a confirm whose default is Cancel; Cancel closes it', async () => {
    await withDocument(() => {
      const h = host()
      const cell = view.versionCell(info(), h.host) as FakeNode
      expect(cell.textContent).toContain('Mnemosyne v0.27.0 · v0.28.0 available')
      const ask = cell.button('Update…')!
      const confirm = cell.all().find(node => node.className === 'confirm')!
      expect(ask.hidden).toBe(false)
      expect(confirm.hidden).toBe(true)
      ask.fire('click')
      expect(confirm.hidden).toBe(false)
      expect(ask.hidden).toBe(true)
      expect(cell.button('Cancel')!.focused).toBe(1)
      expect(cell.button('Update')!.focused).toBe(0)
      expect(confirm.textContent).toContain('Your memories, settings and tags are not touched.')
      cell.button('Cancel')!.fire('click')
      expect(confirm.hidden).toBe(true)
      expect(ask.hidden).toBe(false)
      ask.fire('click')
      confirm.fire('keydown', { key: 'Escape' })
      expect(confirm.hidden).toBe(true)
      expect(h.calls.start).toBe(0)
    })
  })

  test('Update starts the run and hands the progress box over; a refusal shows its text', async () => {
    await withDocument(async () => {
      const h = host()
      const cell = view.versionCell(info(), h.host) as FakeNode
      cell.button('Update…')!.fire('click')
      h.answer('An update is already running.')
      cell.button('Update')!.fire('click')
      await Bun.sleep(0)
      expect(h.calls.start).toBe(1)
      expect(h.calls.started).toBe(0)
      expect(cell.all().find(node => node.className === 'warn' && node.textContent === 'An update is already running.')?.hidden).toBe(false)
      h.answer(undefined)
      cell.button('Update')!.fire('click')
      await Bun.sleep(0)
      expect(h.calls.started).toBe(1)
      const progress = cell.all().find(node => node.className === 'update-progress')!
      expect(progress.hidden).toBe(false)
      expect(progress.textContent).toContain('Starting the update to v0.28.0')
    })
  })

  test('up to date, or no check: the line only, no button', async () => {
    await withDocument(() => {
      for (const state of [info({ available: false, latest: { tag: 'v0.27.0', plugin: '0.27.0', engine: null } }), info({ available: false, latest: null })]) {
        const cell = view.versionCell(state, host().host) as FakeNode
        expect(cell.all().some(node => node.tagName === 'button')).toBe(false)
      }
    })
  })

  test('a Claude Code install: the newer release is named, the update is left to claude plugin update', async () => {
    await withDocument(() => {
      const cell = view.versionCell(info({ updatable: false }), host().host) as FakeNode
      expect(cell.all().some(node => node.tagName === 'button')).toBe(false)
      expect(cell.textContent).toContain('claude plugin update')
    })
  })

  test('a run under way: its progress shows, no Update button, and it is followed', async () => {
    await withDocument(() => {
      const h = host()
      const status = { state: 'running', lines: ['Installing engine ...'], started: new Date().toISOString(), updated: new Date().toISOString() }
      const cell = view.versionCell(info({ status }), h.host) as FakeNode
      expect(cell.button('Update…')!.hidden).toBe(true)
      expect(cell.textContent).toContain('Installing engine ...')
      expect(h.calls.started).toBe(1)
    })
  })
})
