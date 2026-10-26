// SRV.1, SRV.2 and SRV.3: the dashboard's settings routes (ui/settings-routes.ts), run for real on
// 127.0.0.1. Every test uses a temp HOME, a temp root and the stub claude CLI
// (tests/bun/fixtures/claude-stub.ts), so nothing here can reach the real ~/.claude/settings.json or
// the real store; the stub writes only the temp HOME's settings.json.
import { afterAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { configFromEnv, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { ENGINE_TOOLS, GROUPS, SECRET_RULE_NAMES } from '../../ui/settings-routes'
import type { SettingsDeps } from '../../ui/settings-routes'
import { ROOT, tempDir } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const STUB = join(ROOT, 'tests', 'bun', 'fixtures', 'claude-stub.ts')
const PLUGIN_ID = 'mnemosyne@mnemosyne'

type World = {
  dir: string
  root: string
  store: string
  home: string
  stubLog: string
  activity: string
  started: Started
  base: string
  claude: string
  get: (path: string, headers?: Record<string, string>) => Promise<{ status: number; body: any; headers: Headers }>
  post: (path: string, body: unknown, headers?: Record<string, string>) => Promise<{ status: number; body: any; headers: Headers }>
  settingsFile: string
  config: () => any
  stubCalls: () => { argv: string[]; home: string; keys: string[] }[]
  row: (id: string) => Promise<any>
}

const worlds: (() => void)[] = []
afterAll(() => {
  for (const dispose of worlds) dispose()
})

/** A server on a temp root with the stub CLI. `mode` and `extra` go to the stub; `noPluginId` is a --plugin-dir install. */
async function boot(options: { mode?: string; extra?: object; noPluginId?: boolean; settings?: SettingsDeps; seed?: boolean; started?: Record<string, string> } = {}): Promise<World> {
  const temp = tempDir('settings-routes')
  const dir = temp.dir
  const root = join(dir, 'root')
  const store = join(root, 'store')
  const home = join(dir, 'home')
  mkdirSync(store, { recursive: true })
  mkdirSync(join(home, '.claude'), { recursive: true })
  const settingsFile = join(home, '.claude', 'settings.json')
  if (options.seed !== false) {
    // The temp HOME's settings.json holds other keys the CLI must leave alone.
    writeFileSync(settingsFile, `${JSON.stringify({ permissions: { allow: ['Bash(ls)'] }, pluginConfigs: { [PLUGIN_ID]: { options: { guardMode: 'strict', memoryDir: '/tmp/somewhere' } } } }, null, 2)}\n`)
  }
  const stubLog = join(dir, 'stub-calls.jsonl')
  const claude = join(dir, 'claude')
  writeFileSync(claude, `#!/bin/sh\nexec "${process.execPath}" "${STUB}" "$@"\n`)
  chmodSync(claude, 0o755)
  const activity = join(root, 'activity.jsonl')
  const env = {
    ...(process.env as Record<string, string>),
    HOME: home,
    CLAUDE_STUB_LOG: stubLog,
    CLAUDE_STUB_MODE: options.mode ?? 'ok',
    CLAUDE_STUB_SCHEMA_EXTRA: JSON.stringify(options.extra ?? {}),
  }
  const saved: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(options.started ?? {})) {
    saved[key] = process.env[key]
    process.env[key] = value
  }
  const started = await startServer(
    { root, store, cli: CLI, activityLog: activity, pluginRoot: ROOT, ...(options.noPluginId ? {} : { pluginId: PLUGIN_ID }), claudeCli: claude },
    { settings: { env, ...options.settings } },
  )
  worlds.push(() => {
    started.stop()
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    temp.dispose()
  })
  const base = `http://127.0.0.1:${started.port}`
  const auth = { Authorization: `Bearer ${started.token}` }
  const answer = async (response: Response) => ({ status: response.status, body: await response.json().catch(() => null), headers: response.headers })
  const world: World = {
    dir, root, store, home, stubLog, activity, started, base, claude, settingsFile,
    get: async (path, headers = auth) => answer(await fetch(`${base}${path}`, { headers })),
    post: async (path, body, headers = { ...auth, Origin: base, 'Content-Type': 'application/json' }) =>
      answer(await fetch(`${base}${path}`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })),
    config: () => {
      try {
        return JSON.parse(readFileSync(join(root, 'config.json'), 'utf8'))
      } catch {
        return undefined
      }
    },
    stubCalls: () => (existsSync(stubLog) ? readFileSync(stubLog, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : []),
    row: async () => undefined,
  }
  world.row = async (id: string) => (await world.get('/api/settings')).body.settings.find((row: any) => row.id === id)
  return world
}

const writes = (world: World) => world.stubCalls().filter(call => call.argv.includes('--values-stdin'))

describe('GET /api/settings', () => {
  test('every setting with value, default, home and applies; no memory text', async () => {
    const world = await boot()
    const { status, body, headers } = await world.get('/api/settings')
    expect(status).toBe(200)
    expect(headers.get('content-security-policy')).toContain("default-src 'none'")
    const rows: any[] = body.settings
    const byId = (id: string) => rows.find(row => row.id === id)
    // A config setting: the default, no file yet.
    expect(byId('guard.maxLength')).toMatchObject({ home: 'config', value: 4000, default: 4000, applies: 'now', group: 'guard', ref: 'G3', type: 'integer', min: 201, max: 8000 })
    expect(byId('tools.memory_forget')).toMatchObject({ home: 'config', value: true, applies: 'next session' })
    expect(byId('recall.vectorWeight')).toMatchObject({ advanced: true })
    expect(byId('guard.neverSave')).toMatchObject({ type: 'words', value: [], maxItems: 100 })
    // The missing config.json is one warning, not a failure.
    expect(body.warnings.map((warning: any) => warning.key)).toEqual(['config.json'])
    // A plugin option, from the stub CLI's schema and the temp HOME's stored value.
    expect(byId('guardMode')).toMatchObject({ home: 'option', value: 'strict', default: 'strict', applies: 'after restart', group: 'guard', ref: 'G1', choices: ['strict', 'warn'], configured: true })
    expect(byId('rememberTerms')).toMatchObject({ type: 'terms', home: 'option', configured: false })
    expect(byId('rememberTerms').value).toEqual(['remember:', 'remember that', 'note that', 'save to memory'])
    expect(byId('externalMcp')).toMatchObject({ type: 'boolean', value: false })
    expect(byId('memoryDir')).toMatchObject({ confirm: true, value: '/tmp/somewhere' })
    expect(byId('scope')).toMatchObject({ confirm: true })
    expect(body.plugin).toEqual({ id: PLUGIN_ID, optionsEditable: true })
    // expireUnusedDays is not in the schema yet.
    expect(byId('expireUnusedDays')).toMatchObject({ home: 'read-only', note: 'arrives in 0.9.0', ref: 'E2' })
    // Read-only facts.
    expect(byId('guard.secretRules').value).toEqual([...SECRET_RULE_NAMES])
    expect(byId('tools.engineTools').value).toHaveLength(27)
    expect(byId('tags.format').value).toMatchObject({ maxLength: 31, namespaces: ['entity', 'agent', 'asset'], vocabulary: { present: false, admitted: 0 } })
    expect(byId('setup.status').value).toMatchObject({ engine: { installed: false, expected: expect.any(String) }, embeddings: { marker: false, modelReady: false }, wrapper: false })
    expect(byId('setup.backups')).toMatchObject({ value: [], action: 'backup', keep: 10 })
    // Rows come grouped in the group order, each group named.
    expect(body.groups.map((group: any) => group.id)).toEqual(GROUPS.map(group => group.id))
    const order = rows.map(row => body.groups.findIndex((group: any) => group.id === row.group))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(rows.every(row => typeof row.label === 'string' && typeof row.help === 'string' && ['config', 'option', 'read-only'].includes(row.home))).toBe(true)
    expect(JSON.stringify(body)).not.toContain(world.dir)
  })

  test('an option the schema adds later appears with no code change', async () => {
    const extra = { expireUnusedDays: { title: 'Expire unused', type: 'number', default: 30, min: 1, max: 365, description: 'Days.' }, sessionSummary: { title: 'Session summary', type: 'boolean', default: true, description: 'x' } }
    const world = await boot({ extra })
    const days = await world.row('expireUnusedDays')
    expect(days).toMatchObject({ home: 'option', group: 'expiry', ref: 'E2', type: 'number', value: 30, min: 1, max: 365, label: 'Expire unused' })
    expect(days.note).toBeUndefined()
    // One with no place in the list goes to "other".
    expect(await world.row('sessionSummary')).toMatchObject({ home: 'option', group: 'other', value: true })
    // And it can be changed, within the schema's range.
    expect((await world.post('/api/settings/update', { id: 'expireUnusedDays', value: 400 })).status).toBe(400)
    const ok = await world.post('/api/settings/update', { id: 'expireUnusedDays', value: 60 })
    expect(ok.status).toBe(200)
    expect(JSON.parse(readFileSync(world.settingsFile, 'utf8')).pluginConfigs[PLUGIN_ID].options.expireUnusedDays).toBe('60')
  })

  test('config warnings come with the reply', async () => {
    const world = await boot()
    writeFileSync(join(world.root, 'config.json'), JSON.stringify({ version: 1, guard: { maxLength: 'lots', minLength: 20 } }))
    const { body } = await world.get('/api/settings')
    expect(body.warnings.map((warning: any) => warning.key)).toEqual(['guard.maxLength'])
    expect(body.settings.find((row: any) => row.id === 'guard.maxLength').value).toBe(4000)
    expect(body.settings.find((row: any) => row.id === 'guard.minLength')).toMatchObject({ value: 20, isDefault: false })
  })

  test('a --plugin-dir install shows the options read-only: change them in /config', async () => {
    const world = await boot({ noPluginId: true })
    const { body } = await world.get('/api/settings')
    expect(body.plugin).toMatchObject({ id: null, optionsEditable: false })
    expect(body.plugin.note).toContain('/config')
    const guardMode = body.settings.find((row: any) => row.id === 'guardMode')
    expect(guardMode).toMatchObject({ home: 'read-only', default: 'strict', note: 'change it in /config' })
    // Config settings still work.
    expect(body.settings.find((row: any) => row.id === 'guard.maxLength').home).toBe('config')
    const refused = await world.post('/api/settings/update', { id: 'guardMode', value: 'warn' })
    expect(refused.status).toBe(409)
    expect(world.stubCalls()).toEqual([])
  })

  test('a CLI that fails or answers nonsense leaves the options read-only, not a 500', async () => {
    const world = await boot({ mode: 'garbage' })
    const { status, body } = await world.get('/api/settings')
    expect(status).toBe(200)
    expect(body.plugin.optionsEditable).toBe(false)
    expect(body.plugin.reason).toContain('JSON')
    expect(body.settings.find((row: any) => row.id === 'guardMode').home).toBe('read-only')
  })

  test('says when the dashboard started with other extraction or embeddings values', async () => {
    const world = await boot({ started: { MNEMOSYNE_EXTRACTION: 'sonnet', MNEMOSYNE_EMBEDDINGS: 'on' } })
    // extractionModel is unset (default haiku) against a server that started with sonnet; embeddings auto never flags.
    let { body } = await world.get('/api/settings')
    expect(body.restartNeeded).toEqual(['extractionModel'])
    expect(body.settings.find((row: any) => row.id === 'extractionModel').restartNeeded).toBe(true)
    const off = await world.post('/api/settings/update', { id: 'embeddings', value: 'off' })
    expect(off.body.restartNeeded).toBe(true)
    ;({ body } = await world.get('/api/settings'))
    expect(body.restartNeeded.sort()).toEqual(['embeddings', 'extractionModel'])
  })

  test('reads the backups and the vocabulary counts, names and numbers only', async () => {
    const world = await boot()
    mkdirSync(join(world.root, 'backups'))
    writeFileSync(join(world.root, 'backups', 'mnemopi-20261026T101010123Z.db'), 'x'.repeat(10))
    writeFileSync(join(world.root, 'backups', 'mnemopi-20261027T101010123Z.db'), 'x'.repeat(20))
    writeFileSync(join(world.root, 'backups', 'notes.txt'), 'not a backup')
    writeFileSync(
      join(world.root, 'vocabulary.json'),
      JSON.stringify({ version: 1, tags: { 'entity:acme': { ns: 'entity', description: 'secret-ish text', aliases: ['acme-corp'], admitted: 'manual', count: 2 } }, candidates: { foo: { count: 1, firstSeen: '2026-10-01' } } }),
    )
    const { body } = await world.get('/api/settings')
    const backups = body.settings.find((row: any) => row.id === 'setup.backups').value
    expect(backups.map((item: any) => [item.name, item.size])).toEqual([['mnemopi-20261027T101010123Z.db', 20], ['mnemopi-20261026T101010123Z.db', 10]])
    expect(body.settings.find((row: any) => row.id === 'tags.format').value.vocabulary).toEqual({ present: true, admitted: 1, candidates: 1, aliases: 1 })
    expect(JSON.stringify(body)).not.toContain('secret-ish text')
  })
})

describe('the server takes the plugin id and the CLI from its environment', () => {
  test('MNEMOSYNE_PLUGIN_ID and MNEMOSYNE_CLAUDE_CLI reach the settings routes; blank means a --plugin-dir install', () => {
    const base = { MNEMOSYNE_ROOT: '/r', MNEMOSYNE_STORE: '/r/store' }
    expect(configFromEnv({ ...base, MNEMOSYNE_PLUGIN_ID: PLUGIN_ID, MNEMOSYNE_CLAUDE_CLI: '/bin/claude' })).toMatchObject({ pluginId: PLUGIN_ID, claudeCli: '/bin/claude' })
    expect(configFromEnv({ ...base, MNEMOSYNE_PLUGIN_ID: '' }).pluginId).toBeUndefined()
    expect(configFromEnv(base).claudeCli).toBeUndefined()
  })
})

describe('the constants match the code they describe', () => {
  test('the engine tools are the 27 the engine registers', () => {
    const source = readFileSync(join(ROOT, 'engine', 'src', 'mcp-tools.ts'), 'utf8')
    const names = [...source.matchAll(/name:\s*['"](mnemopi_[a-z_]+)['"]/g)].map(match => match[1]!)
    expect([...new Set(names)].sort()).toEqual([...ENGINE_TOOLS].sort())
    expect(ENGINE_TOOLS).toHaveLength(27)
  })

  test('the secret rule names are the guard\'s own', () => {
    const source = readFileSync(join(ROOT, 'hooks', 'guard.ts'), 'utf8')
    for (const name of SECRET_RULE_NAMES.slice(0, -1)) expect(source).toContain(`name: '${name}'`)
    expect(source).toContain('password, secret, api_key or token')
  })

  test('the module never reads or writes a settings file itself', () => {
    const source = readFileSync(join(ROOT, 'ui', 'settings-routes.ts'), 'utf8')
    expect(source).not.toMatch(/homedir\s*\(|writeFileSync|appendFileSync|\.claude['"/\\]/)
  })
})

describe('POST /api/settings/update: config settings', () => {
  test('saves a checked value, says when it applies, and logs the key only', async () => {
    const world = await boot()
    const saved = await world.post('/api/settings/update', { id: 'guard.maxLength', value: 5000 })
    expect(saved.status).toBe(200)
    expect(saved.body).toMatchObject({ ok: true, id: 'guard.maxLength', value: 5000, default: 4000, applies: 'now', changed: true })
    expect(world.config()).toEqual({ version: 1, guard: { maxLength: 5000 } })
    expect(statSync(join(world.root, 'config.json')).mode & 0o777).toBe(0o600)
    expect((await world.row('guard.maxLength')).value).toBe(5000)
    const tools = await world.post('/api/settings/update', { id: 'tools.memory_forget', value: false })
    expect(tools.body).toMatchObject({ ok: true, applies: 'next session', value: false })
    const lines = readFileSync(world.activity, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    expect(lines.map(line => line.action)).toEqual(['settings', 'settings'])
    expect(lines[0]).toMatchObject({ origin: 'ui', text: 'guard.maxLength default>number', ok: true })
  })

  test('refuses a bad value with the key and the reason, writing nothing', async () => {
    const world = await boot()
    const tooBig = await world.post('/api/settings/update', { id: 'guard.maxLength', value: 9000 })
    expect(tooBig.status).toBe(400)
    expect(tooBig.body.error).toContain('guard.maxLength')
    const wrongType = await world.post('/api/settings/update', { id: 'guard.nearDuplicate', value: 'yes' })
    expect(wrongType.status).toBe(400)
    // warn length must stay below max length
    const cross = await world.post('/api/settings/update', { id: 'guard.warnLength', value: 4200 })
    expect(cross.status).toBe(400)
    expect(world.config()).toBeUndefined()
    expect(existsSync(world.activity)).toBe(false)
  })

  test('list settings add and remove one item at a time; the log never holds the item', async () => {
    const world = await boot()
    const secretWord = 'Project Bluebird codename'
    const added = await world.post('/api/settings/update', { id: 'guard.neverSave', add: secretWord })
    expect(added.status).toBe(200)
    expect(added.body.value).toEqual([secretWord])
    expect(world.config().guard.neverSave).toEqual([secretWord])
    // The same word in other letters is a repeat: nothing changes.
    const repeat = await world.post('/api/settings/update', { id: 'guard.neverSave', add: secretWord.toUpperCase() })
    expect(repeat.body).toMatchObject({ ok: true, changed: false })
    expect((await world.post('/api/settings/update', { id: 'guard.neverSave', add: 'ab' })).status).toBe(400)
    expect((await world.post('/api/settings/update', { id: 'guard.neverSave', remove: 'not there at all' })).status).toBe(404)
    const text = readFileSync(world.activity, 'utf8')
    expect(text).toContain('guard.neverSave')
    expect(text.toLowerCase()).not.toContain('bluebird')
    const removed = await world.post('/api/settings/update', { id: 'guard.neverSave', remove: secretWord })
    expect(removed.body).toMatchObject({ ok: true, value: [] })
    expect(world.config()).toEqual({ version: 1 })
    // A pick list: the outside-agent allow-list.
    const allow = await world.post('/api/settings/update', { id: 'tools.externalAllow', remove: 'memory_forget' })
    expect(allow.body.value).toEqual(['memory_remember', 'memory_recall', 'memory_update', 'memory_stats'])
    expect((await world.post('/api/settings/update', { id: 'tools.externalAllow', add: 'mnemopi_sleep' })).status).toBe(400)
    // add on a plain setting is refused
    expect((await world.post('/api/settings/update', { id: 'guard.maxLength', add: 5 })).status).toBe(400)
  })

  test('only a setting id is taken; a read-only row or an unknown id is not', async () => {
    const world = await boot()
    for (const id of ['guard.secretRules', 'guard.nope', 'tools.engineTools', '__proto__', 'a.b.c']) {
      const result = await world.post('/api/settings/update', { id, value: 1 })
      expect([400, 404]).toContain(result.status)
    }
    expect(world.config()).toBeUndefined()
    expect(world.stubCalls()).toEqual([])
  })

  test('send exactly one of value, add or remove, and nothing else', async () => {
    const world = await boot()
    expect((await world.post('/api/settings/update', { id: 'guard.maxLength' })).status).toBe(400)
    expect((await world.post('/api/settings/update', { id: 'guard.maxLength', value: 5000, add: 'x' })).status).toBe(400)
    expect((await world.post('/api/settings/update', { id: 'guard.maxLength', value: 5000, sneaky: true })).status).toBe(400)
    expect((await world.post('/api/settings/update', { value: 5000 })).status).toBe(400)
    expect((await world.post('/api/settings/update', '[1]')).status).toBe(400)
    expect((await world.post('/api/settings/update', 'not json')).status).toBe(400)
  })
})

describe('POST /api/settings/update: plugin options go through the CLI only', () => {
  test('one key per call, after the schema check, read back, and the rest of settings.json untouched', async () => {
    const world = await boot()
    const done = await world.post('/api/settings/update', { id: 'guardMode', value: 'warn' })
    expect(done.status).toBe(200)
    expect(done.body).toMatchObject({ ok: true, id: 'guardMode', value: 'warn', default: 'strict', applies: 'after restart', changed: true })
    expect(done.body.note).toContain('restart')
    expect(writes(world).map(call => call.keys)).toEqual([['guardMode']])
    const settings = JSON.parse(readFileSync(world.settingsFile, 'utf8'))
    expect(settings.pluginConfigs[PLUGIN_ID].options).toEqual({ guardMode: 'warn', memoryDir: '/tmp/somewhere' })
    expect(settings.permissions).toEqual({ allow: ['Bash(ls)'] })
    // Booleans go as "true"/"false" strings.
    expect((await world.post('/api/settings/update', { id: 'externalMcp', value: true })).body.value).toBe(true)
    expect(JSON.parse(readFileSync(world.settingsFile, 'utf8')).pluginConfigs[PLUGIN_ID].options.externalMcp).toBe('true')
    // The activity line holds the key and kinds only.
    const lines = readFileSync(world.activity, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    expect(lines[0]).toMatchObject({ action: 'settings', text: 'guardMode text>text' })
  })

  test('a value outside the schema is refused before the CLI is called', async () => {
    const world = await boot()
    const calls = () => writes(world).length
    for (const body of [
      { id: 'guardMode', value: 'loud' },
      { id: 'guardMode', value: 3 },
      { id: 'externalMcp', value: 'true' },
      { id: 'extractionModel', value: 'line one\nline two' },
      { id: 'extractionModel', value: 'x'.repeat(1001) },
      { id: 'rememberTerms', value: 'one, two' },
      { id: 'rememberTerms', add: 'has,comma' },
      { id: 'rememberTerms', add: '' },
      { id: 'guardMode', add: 'warn' },
    ]) {
      const result = await world.post('/api/settings/update', body)
      expect(result.status).toBe(400)
    }
    expect((await world.post('/api/settings/update', { id: 'noSuchOption', value: 'x' })).status).toBe(404)
    expect(calls()).toBe(0)
  })

  test('term lists add and remove one item at a time; none switches them off', async () => {
    const world = await boot()
    const added = await world.post('/api/settings/update', { id: 'recallTerms', add: 'look up' })
    expect(added.body.value).toEqual(['recall:', 'what do you remember about', 'check memory', 'look up'])
    expect(JSON.parse(readFileSync(world.settingsFile, 'utf8')).pluginConfigs[PLUGIN_ID].options.recallTerms).toBe('recall:, what do you remember about, check memory, look up')
    expect((await world.post('/api/settings/update', { id: 'recallTerms', remove: 'nothing like it' })).status).toBe(404)
    const off = await world.post('/api/settings/update', { value: [], id: 'recallTerms' })
    expect(off.body.value).toEqual([])
    expect(JSON.parse(readFileSync(world.settingsFile, 'utf8')).pluginConfigs[PLUGIN_ID].options.recallTerms).toBe('none')
  })

  test('memoryDir and scope need the new value typed again, and warn that rows are not moved', async () => {
    const world = await boot()
    const before = writes(world).length
    const noConfirm = await world.post('/api/settings/update', { id: 'scope', value: 'per-project' })
    expect(noConfirm.status).toBe(400)
    expect(noConfirm.body).toMatchObject({ needsConfirm: true })
    expect((await world.post('/api/settings/update', { id: 'scope', value: 'per-project', confirm: 'global' })).status).toBe(400)
    expect(writes(world).length).toBe(before)
    const confirmed = await world.post('/api/settings/update', { id: 'scope', value: 'per-project', confirm: 'per-project' })
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.warning).toContain('not moved')
    // memoryDir keeps its own rules.
    expect((await world.post('/api/settings/update', { id: 'memoryDir', value: 'relative/path', confirm: 'relative/path' })).status).toBe(400)
    const inside = join(world.root, 'engine', 'x')
    expect((await world.post('/api/settings/update', { id: 'memoryDir', value: inside, confirm: inside })).status).toBe(400)
    // Everything hooks/register.ts paths() refuses is refused here too, read against the temp HOME.
    const refusedPaths = [
      join(world.home, '.omp'),
      join(world.home, '.omp', 'x'),
      '~/.omp/x',
      '~/.claude/mnemosyne/Engine/s',
      '~/.claude/mnemosyne/engine.next/s',
      join(world.root, 'ENGINE.old', 's'),
    ]
    for (const value of refusedPaths) {
      const refused = await world.post('/api/settings/update', { id: 'memoryDir', value, confirm: value })
      expect([value, refused.status]).toEqual([value, 400])
    }
    expect(writes(world).length).toBe(before + 1)
    const dir = join(world.dir, 'elsewhere')
    const moved = await world.post('/api/settings/update', { id: 'memoryDir', value: dir, confirm: dir })
    expect(moved.status).toBe(200)
    expect(moved.body.warning).toContain('not moved')
  })

  test('a CLI that refuses is reported, not hidden', async () => {
    const world = await boot({ mode: 'refuse' })
    const seeded = readFileSync(world.settingsFile, 'utf8')
    const result = await world.post('/api/settings/update', { id: 'guardMode', value: 'warn' })
    expect(result.status).toBe(502)
    expect(result.body.error).toContain('refused')
    expect(existsSync(world.activity)).toBe(false)
    expect(readFileSync(world.settingsFile, 'utf8')).toBe(seeded)
  })

  test('a write the read-back does not show is a mismatch, not a success', async () => {
    const world = await boot({ mode: 'drop' })
    const result = await world.post('/api/settings/update', { id: 'guardMode', value: 'warn' })
    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ readBack: 'mismatch' })
    expect(existsSync(world.activity)).toBe(false)
  })

  test('every CLI call runs with the temp HOME; the real settings.json is never named', async () => {
    const world = await boot()
    await world.get('/api/settings')
    await world.post('/api/settings/update', { id: 'showActivity', value: 'status' })
    await world.post('/api/settings/reset', { id: 'showActivity' })
    const calls = world.stubCalls()
    expect(calls.length).toBeGreaterThanOrEqual(5)
    for (const call of calls) {
      expect(call.home).toBe(world.home)
      expect(call.argv.slice(0, 3)).toEqual(['plugin', 'configure', PLUGIN_ID])
      expect(call.argv.length).toBe(4)
    }
    expect(calls.every(call => call.argv.every(arg => !arg.includes('settings.json')))).toBe(true)
  })
})

describe('POST /api/settings/reset', () => {
  test('resets one config setting; the key leaves the file', async () => {
    const world = await boot()
    await world.post('/api/settings/update', { id: 'tags.maxPerMemory', value: 3 })
    await world.post('/api/settings/update', { id: 'expiry.contextDays', value: 30 })
    const reset = await world.post('/api/settings/reset', { id: 'tags.maxPerMemory' })
    expect(reset.body).toMatchObject({ ok: true, id: 'tags.maxPerMemory', value: 5, default: 5, applies: 'now' })
    expect(world.config()).toEqual({ version: 1, expiry: { contextDays: 30 } })
  })

  test('resets one plugin option to its schema default through the CLI', async () => {
    const world = await boot()
    const reset = await world.post('/api/settings/reset', { id: 'guardMode' })
    expect(reset.status).toBe(200)
    expect(reset.body).toMatchObject({ value: 'strict', applies: 'after restart' })
    expect(writes(world).map(call => call.keys)).toEqual([['guardMode']])
    // memoryDir asks for the default typed again.
    const refused = await world.post('/api/settings/reset', { id: 'memoryDir' })
    expect(refused.status).toBe(400)
    expect(refused.body.needsConfirm).toBe(true)
    const ok = await world.post('/api/settings/reset', { id: 'memoryDir', confirm: '~/.claude/mnemosyne/store' })
    expect(ok.status).toBe(200)
  })

  test('reset all needs the typed word and keeps the old file as config.json.bak', async () => {
    const world = await boot()
    await world.post('/api/settings/update', { id: 'guard.maxLength', value: 5000 })
    for (const body of [{ all: true }, { all: true, confirm: 'yes' }, { all: false, confirm: 'reset' }, { all: true, confirm: 'reset', id: 'guard.maxLength' }, {}]) {
      expect((await world.post('/api/settings/reset', body)).status).toBe(400)
    }
    expect(world.config().guard.maxLength).toBe(5000)
    const done = await world.post('/api/settings/reset', { all: true, confirm: 'reset' })
    expect(done.status).toBe(200)
    expect(done.body).toMatchObject({ ok: true, all: true, changed: true, scope: 'config' })
    expect(world.config()).toEqual({ version: 1 })
    expect(JSON.parse(readFileSync(join(world.root, 'config.json.bak'), 'utf8')).guard.maxLength).toBe(5000)
    // Plugin options were left alone.
    expect(writes(world)).toEqual([])
    // A second reset keeps the first one's backup.
    await world.post('/api/settings/reset', { all: true, confirm: 'reset' })
    expect(JSON.parse(readFileSync(join(world.root, 'config.json.bak'), 'utf8')).guard.maxLength).toBe(5000)
  })
})

describe('the routes keep the server\'s protections', () => {
  const routes = ['/api/settings/update', '/api/settings/reset', '/api/backup']

  test('token, method, Origin, JSON only and the 4096-byte body cap', async () => {
    const world = await boot()
    const auth = { Authorization: `Bearer ${world.started.token}` }
    for (const path of ['/api/settings', ...routes]) {
      const none = await fetch(`${world.base}${path}`, { method: path === '/api/settings' ? 'GET' : 'POST', headers: { Origin: world.base, 'Content-Type': 'application/json' }, body: path === '/api/settings' ? undefined : '{}' })
      expect(none.status).toBe(401)
      const wrong = await fetch(`${world.base}${path}`, { headers: { Authorization: 'Bearer wrong' } })
      expect(wrong.status).toBe(401)
    }
    expect((await world.post('/api/settings', {})).status).toBe(405)
    for (const path of routes) {
      expect((await world.get(path)).status).toBe(405)
      const origin = await world.post(path, {}, { ...auth, Origin: 'http://evil.example', 'Content-Type': 'application/json' })
      expect(origin.status).toBe(403)
      const noOrigin = await world.post(path, {}, { ...auth, 'Content-Type': 'application/json' })
      expect(noOrigin.status).toBe(403)
      const type = await world.post(path, '{}', { ...auth, Origin: world.base, 'Content-Type': 'text/plain' })
      expect(type.status).toBe(415)
      const big = await world.post(path, JSON.stringify({ id: 'guard.neverSave', add: 'x'.repeat(5000) }))
      expect(big.status).toBe(413)
    }
    expect(world.config()).toBeUndefined()
    expect(world.stubCalls().filter(call => call.argv.includes('--values-stdin'))).toEqual([])
  })

  test('the token is never in a reply, a log line or an error', async () => {
    const world = await boot()
    const replies = [
      await world.get('/api/settings'),
      await world.post('/api/settings/update', { id: 'guard.maxLength', value: 5000 }),
      await world.post('/api/settings/update', { id: 'guard.maxLength', value: 'bad' }),
      await world.post('/api/settings/update', { id: 'guardMode', value: 'warn' }),
    ]
    for (const reply of replies) expect(JSON.stringify(reply.body)).not.toContain(world.started.token)
    expect(readFileSync(world.activity, 'utf8')).not.toContain(world.started.token)
    expect(readFileSync(world.stubLog, 'utf8')).not.toContain(world.started.token)
  })
})

/** A store database the backup can copy: the engine's table, three rows. */
function makeStore(store: string) {
  const db = new Database(join(store, 'mnemopi.db'))
  db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT)')
  for (const id of ['a', 'b', 'c']) db.query('INSERT INTO working_memory VALUES (?, ?, ?)').run(id, 'global', `memory ${id}`)
  db.close()
}

describe('POST /api/backup', () => {
  test('backs up the store with bin/memories.ts and returns the new file', async () => {
    const world = await boot()
    makeStore(world.store)
    const done = await world.post('/api/backup', {})
    expect(done.status).toBe(200)
    expect(done.body).toMatchObject({ ok: true, rows: 3, keep: 10 })
    expect(done.body.name).toMatch(/^mnemopi-\d{8}T\d{9}Z\.db$/)
    expect(done.body.size).toBeGreaterThan(0)
    const file = join(world.root, 'backups', done.body.name)
    expect(statSync(file).size).toBe(done.body.size)
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(done.body.backups.map((item: any) => item.name)).toEqual([done.body.name])
    // No memory text in the reply.
    expect(JSON.stringify(done.body)).not.toContain('memory a')
    // The settings reply lists it.
    expect((await world.row('setup.backups')).value[0].name).toBe(done.body.name)
  })

  test('keeps the number of files backupsKeep says', async () => {
    const world = await boot()
    makeStore(world.store)
    expect((await world.post('/api/settings/update', { id: 'storage.backupsKeep', value: 3 })).status).toBe(200)
    let last = ''
    for (let i = 0; i < 5; i++) {
      const done = await world.post('/api/backup', {})
      expect(done.status).toBe(200)
      last = done.body.name
      await Bun.sleep(5)
    }
    const kept = readdirSync(join(world.root, 'backups')).sort()
    expect(kept).toHaveLength(3)
    expect(kept[2]).toBe(last)
  })

  test('refuses on a full disk, with no file made', async () => {
    const world = await boot({
      settings: {
        runBackup: async () => {
          throw new Error('not enough disk space for a backup: 100 bytes free, 5000 needed (twice the store)')
        },
      },
    })
    makeStore(world.store)
    const refused = await world.post('/api/backup', {})
    expect(refused.status).toBe(507)
    expect(refused.body.error).toContain('not enough disk space')
    expect(existsSync(join(world.root, 'backups'))).toBe(false)
  })

  test('with no store database yet, says so', async () => {
    const world = await boot()
    const refused = await world.post('/api/backup', {})
    expect(refused.status).toBe(409)
    expect(refused.body.error).toContain('no store database')
  })

  test('one write at a time: an overlapping backup or settings change is refused', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>(resolve => {
      release = resolve
    })
    const world = await boot({ settings: { runBackup: async () => (await gate, { name: 'mnemopi-20261026T101010123Z.db', size: 1, rows: 0 }) } })
    const first = world.post('/api/backup', {})
    await Bun.sleep(100)
    expect((await world.post('/api/backup', {})).status).toBe(429)
    expect((await world.post('/api/settings/update', { id: 'guard.maxLength', value: 5000 })).status).toBe(429)
    expect((await world.post('/api/settings/reset', { all: true, confirm: 'reset' })).status).toBe(429)
    release()
    expect((await first).status).toBe(200)
    expect((await world.post('/api/settings/update', { id: 'guard.maxLength', value: 5000 })).status).toBe(200)
  })

  test('takes an empty object and nothing else', async () => {
    const world = await boot()
    expect((await world.post('/api/backup', { store: '/etc' })).status).toBe(400)
    expect((await world.post('/api/backup', 'nope')).status).toBe(400)
    expect(existsSync(join(world.root, 'backups'))).toBe(false)
  })
})
