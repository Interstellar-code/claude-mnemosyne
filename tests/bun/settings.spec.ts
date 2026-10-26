// CFG.1 and CFG.2 (0.8.5 settings plan): bin/settings.ts, the reader and the one writer of <root>/config.json,
// on real files in a temp folder, and run as a child process the way the server and a person call it.
import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_BYTES } from '../../bin/activity'
import { BACKUP_KEEP } from '../../bin/memories'
import { backupFile, configFile, readConfig, resetAll, writeConfig } from '../../bin/settings'
import { CONFIG_FILE, defaults, MAX_CONFIG_BYTES } from '../../hooks/settings'
import { isolatedEnv, ROOT, tempDir } from './helpers'

const SCRIPT = join(ROOT, 'bin', 'settings.ts')
const isPosix = process.platform !== 'win32'
const temp = tempDir('settings')
afterAll(() => temp.dispose())

let n = 0
/** A fresh data folder that does not exist yet (the writer makes it). */
const fresh = () => join(temp.dir, `case-${++n}`, 'data')
const mode = (path: string) => (statSync(path).mode & 0o777).toString(8)
const text = (root: string) => readFileSync(configFile(root), 'utf8')
const json = (root: string) => JSON.parse(text(root)) as Record<string, any>
const leftovers = (root: string) => (existsSync(root) ? readdirSync(root).filter(name => name.endsWith('.tmp')) : [])
const keysOf = (warnings: readonly { key: string }[]) => warnings.map(warning => warning.key)

/** Runs bin/settings.ts as a person (or a script) would. */
async function run(args: readonly string[]) {
  const child = Bun.spawn([process.execPath, SCRIPT, ...args], { env: { ...(process.env as Record<string, string>), ...isolatedEnv('settings') }, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

describe('hooks/settings.ts', () => {
  test('CFG.1.a6: the module imports nothing', () => {
    const source = readFileSync(join(ROOT, 'hooks', 'settings.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/\bimport\s*\(/)
    expect(source).not.toMatch(/\brequire\s*\(/)
    expect(source).not.toMatch(/^\s*export\s+.*\sfrom\s+['"]/m)
  })

  test('CFG.1.a1: the defaults for the activity log and the backups equal the numbers bin/activity.ts and bin/memories.ts still hold', () => {
    expect(defaults().storage.activityLogMaxBytes).toBe(MAX_BYTES)
    expect(defaults().storage.backupsKeep).toBe(BACKUP_KEEP)
  })
})

describe('readConfig', () => {
  test('CFG.2.a3: a missing file is all defaults plus one config.json warning, and nothing is created', () => {
    const root = fresh()
    const r = readConfig(root)
    expect(r.guard.maxLength).toBe(4000)
    expect(keysOf(r.warnings)).toEqual([CONFIG_FILE])
    expect(existsSync(root)).toBe(false)
  })

  test('CFG.2.a3: an unreadable file, a file that is not JSON, one that is not an object and an oversize one never throw', () => {
    const root = fresh()
    mkdirSync(join(root, CONFIG_FILE), { recursive: true }) // config.json is a folder: reading it fails
    const unreadable = readConfig(root)
    expect(keysOf(unreadable.warnings)).toEqual([CONFIG_FILE])
    expect(unreadable.tags.maxPerMemory).toBe(5)

    for (const body of ['{ nope', '', '"text"', '[1]', 'x'.repeat(MAX_CONFIG_BYTES + 10)]) {
      const dir = fresh()
      mkdirSync(dir, { recursive: true })
      writeFileSync(configFile(dir), body)
      const r = readConfig(dir)
      expect(keysOf(r.warnings)).toEqual([CONFIG_FILE])
      expect(r.expiry.contextDays).toBe(14)
    }
  })

  test('CFG.2: a good file reads back, with its bad value named by key', () => {
    const root = fresh()
    mkdirSync(root, { recursive: true })
    writeFileSync(configFile(root), JSON.stringify({ version: 1, guard: { maxLength: 5000, minLength: 2 }, tags: { maxPerMemory: 3 } }))
    const r = readConfig(root)
    expect(r.guard.maxLength).toBe(5000)
    expect(r.guard.minLength).toBe(15)
    expect(r.tags.maxPerMemory).toBe(3)
    expect(keysOf(r.warnings)).toEqual(['guard.minLength'])
  })
})

describe('writeConfig', () => {
  test('CFG.2.a1: a write validates, makes the folder 0700, writes the file 0600 and leaves no temp file', () => {
    const root = fresh()
    const done = writeConfig(root, { 'guard.maxLength': 5000, 'tags.maxPerMemory': 4 })
    expect(done).toEqual({ ok: true, file: configFile(root), changes: [{ key: 'guard.maxLength', old: 'default', new: 'number' }, { key: 'tags.maxPerMemory', old: 'default', new: 'number' }] })
    expect(json(root)).toEqual({ version: 1, guard: { maxLength: 5000 }, tags: { maxPerMemory: 4 } })
    expect(text(root).endsWith('}\n')).toBe(true)
    if (isPosix) {
      expect(mode(configFile(root))).toBe('600')
      expect(mode(root)).toBe('700')
    }
    expect(leftovers(root)).toEqual([])
    expect(readConfig(root).warnings).toEqual([])
    expect(readConfig(root).guard.maxLength).toBe(5000)
  })

  test('CFG.2.a1: the file a write replaces is kept as config.json.bak, 0600; the first write has none to keep', () => {
    const root = fresh()
    writeConfig(root, { 'guard.maxLength': 5000 })
    expect(existsSync(backupFile(root))).toBe(false)
    const first = text(root)
    writeConfig(root, { 'guard.maxLength': 6000 })
    expect(readFileSync(backupFile(root), 'utf8')).toBe(first)
    expect(json(root).guard.maxLength).toBe(6000)
    if (isPosix) expect(mode(backupFile(root))).toBe('600')
    writeConfig(root, { 'tags.maxPerMemory': 2 })
    expect(JSON.parse(readFileSync(backupFile(root), 'utf8')).guard.maxLength).toBe(6000)
    expect(leftovers(root)).toEqual([])
  })

  test('CFG.2.a1: a value that fails validation is refused with the key and the reason, and nothing is written', () => {
    const root = fresh()
    writeConfig(root, { 'guard.maxLength': 5000 })
    const before = text(root)
    const before2 = readdirSync(root).sort()
    expect(writeConfig(root, { 'guard.minLength': 3 })).toEqual({ ok: false, key: 'guard.minLength', reason: 'must be a whole number from 5 to 100' })
    expect(writeConfig(root, { 'guard.warnLength': 6000 })).toMatchObject({ ok: false, key: 'guard.warnLength' })
    expect(writeConfig(root, { 'tags.maxPerMemory': 4, 'guard.chatter': 'loud' })).toMatchObject({ ok: false, key: 'guard.chatter' })
    expect(writeConfig(root, { 'not.a.setting': 1 })).toMatchObject({ ok: false, reason: 'not a setting' })
    expect(writeConfig(root, 'text' as unknown as Record<string, unknown>)).toMatchObject({ ok: false })
    expect(text(root)).toBe(before)
    expect(readdirSync(root).sort()).toEqual(before2) // no .bak, no temp file made by a refusal
    // and on a folder with no file at all
    const empty = fresh()
    expect(writeConfig(empty, { 'guard.minLength': 3 }).ok).toBe(false)
    expect(existsSync(empty)).toBe(false)
  })

  test('CFG.2.a2: only non-default keys are stored; reset key deletes the key and an emptied group', () => {
    const root = fresh()
    writeConfig(root, { 'guard.maxLength': 5000, 'guard.chatter': 'off', 'tags.maxPerMemory': 5 })
    expect(json(root)).toEqual({ version: 1, guard: { maxLength: 5000, chatter: 'off' } })
    writeConfig(root, { 'guard.maxLength': 4000 }) // back to the default: removed
    expect(json(root)).toEqual({ version: 1, guard: { chatter: 'off' } })
    expect(writeConfig(root, { 'guard.chatter': null })).toMatchObject({ ok: true, changes: [{ key: 'guard.chatter', old: 'text', new: 'default' }] })
    expect(json(root)).toEqual({ version: 1 })
  })

  test('CFG.2.a2: a reset of what is not stored creates no file and keeps the old backup', () => {
    const root = fresh()
    expect(writeConfig(root, { 'guard.chatter': null })).toEqual({ ok: true, changes: [], file: configFile(root) })
    expect(existsSync(root)).toBe(false)
    writeConfig(root, { 'guard.chatter': 'off' })
    writeConfig(root, { 'tags.maxPerMemory': 3 })
    const bak = readFileSync(backupFile(root), 'utf8')
    writeConfig(root, { 'guard.minLength': null }) // nothing stored there
    expect(readFileSync(backupFile(root), 'utf8')).toBe(bak)
  })

  test('CFG.2.a2: reset all keeps the old file as config.json.bak and writes { "version": 1 }', () => {
    const root = fresh()
    writeConfig(root, { 'guard.maxLength': 5000, 'guard.neverSave': ['staging db host'], 'tools.memory_forget': false })
    const old = text(root)
    expect(resetAll(root)).toEqual({ ok: true, file: configFile(root), changes: [{ key: 'all', old: 'various', new: 'default' }] })
    expect(text(root)).toBe('{\n  "version": 1\n}\n')
    expect(readFileSync(backupFile(root), 'utf8')).toBe(old)
    if (isPosix) expect(mode(configFile(root))).toBe('600')
    expect(readConfig(root).warnings).toEqual([])
    expect(readConfig(root).tools.memory_forget).toBe(true)
    // resetting again changes nothing, and the backup is now the empty file
    expect(resetAll(root)).toMatchObject({ ok: true, changes: [] })
  })

  test('CFG.2: keys a newer version wrote are kept through a write', () => {
    const root = fresh()
    mkdirSync(root, { recursive: true })
    writeFileSync(configFile(root), JSON.stringify({ version: 1, future: { flag: true }, guard: { chatter: 'off', later: 1 } }))
    writeConfig(root, { 'guard.maxLength': 5000 })
    expect(json(root)).toEqual({ version: 1, guard: { maxLength: 5000, chatter: 'off', later: 1 }, future: { flag: true } })
  })

  test('CFG.2: a file that is not JSON is replaced by a write (the old one kept as .bak), and left alone by a write that sets nothing', () => {
    const root = fresh()
    mkdirSync(root, { recursive: true })
    writeFileSync(configFile(root), '{ half a file')
    expect(writeConfig(root, { 'guard.chatter': null })).toMatchObject({ ok: true, changes: [] })
    expect(text(root)).toBe('{ half a file')
    expect(writeConfig(root, { 'guard.chatter': 'off' })).toMatchObject({ ok: true })
    expect(json(root)).toEqual({ version: 1, guard: { chatter: 'off' } })
    expect(readFileSync(backupFile(root), 'utf8')).toBe('{ half a file')
  })

  test('CFG.2.a1: a write that fails part way leaves no temp file and the old file whole', () => {
    const root = fresh()
    writeConfig(root, { 'guard.maxLength': 5000 })
    const before = text(root)
    // the backup's path is a folder, so keeping the backup fails before the file is touched
    mkdirSync(backupFile(root), { recursive: true })
    expect(() => writeConfig(root, { 'guard.maxLength': 6000 })).toThrow()
    expect(text(root)).toBe(before)
    expect(leftovers(root)).toEqual([])
  })
})

describe('bun bin/settings.ts', () => {
  test('CFG.2.a4: get, set, reset and reset-all work on a temp root', async () => {
    const root = fresh()
    const all = await run(['get', '--root', root])
    expect(all.exitCode).toBe(0)
    expect(all.stderr).toBe('')
    const parsed = JSON.parse(all.stdout)
    expect(parsed.settings.guard.maxLength).toBe(4000)
    expect(parsed.warnings.map((w: { key: string }) => w.key)).toEqual([CONFIG_FILE])
    expect(parsed.settings.warnings).toBeUndefined()

    const set = await run(['set', 'guard.maxLength', '5000', '--root', root])
    expect(set.exitCode).toBe(0)
    expect(JSON.parse(set.stdout)).toMatchObject({ ok: true, changes: [{ key: 'guard.maxLength', old: 'default', new: 'number' }] })
    expect(json(root)).toEqual({ version: 1, guard: { maxLength: 5000 } })

    // --root may come first, last, or between
    const one = await run(['--root', root, 'get', 'guard.maxLength'])
    expect(JSON.parse(one.stdout)).toMatchObject({ key: 'guard.maxLength', value: 5000, default: 4000 })

    // JSON values: a boolean, a text, a list
    expect((await run(['set', 'guard.nearDuplicate', 'false', '--root', root])).exitCode).toBe(0)
    expect((await run(['set', 'guard.chatter', 'off', '--root', root])).exitCode).toBe(0)
    expect((await run(['set', 'guard.neverSave', '["staging db host","other phrase"]', '--root', root])).exitCode).toBe(0)
    expect(json(root).guard).toEqual({ maxLength: 5000, nearDuplicate: false, chatter: 'off', neverSave: ['staging db host', 'other phrase'] })

    const reset = await run(['reset', 'guard.maxLength', '--root', root])
    expect(reset.exitCode).toBe(0)
    expect(json(root).guard.maxLength).toBeUndefined()

    const resetEverything = await run(['reset-all', '--root', root])
    expect(resetEverything.exitCode).toBe(0)
    expect(json(root)).toEqual({ version: 1 })
    expect(existsSync(backupFile(root))).toBe(true)
    expect(isPosix ? mode(configFile(root)) : '600').toBe('600')
  })

  test('CFG.2.a4: a bad value exits 1 with the key and the reason on stderr, never the list text, and writes nothing', async () => {
    const root = fresh()
    await run(['set', 'guard.maxLength', '5000', '--root', root])
    const before = text(root)
    const refused = await run(['set', 'guard.minLength', '3', '--root', root])
    expect(refused.exitCode).toBe(1)
    expect(refused.stderr).toBe('mnemosyne settings: guard.minLength: must be a whole number from 5 to 100\n')
    expect(refused.stdout).toBe('')
    const words = await run(['set', 'guard.neverSave', '["fine phrase here","no"]', '--root', root])
    expect(words.exitCode).toBe(1)
    expect(words.stderr).toContain('guard.neverSave: entry 2')
    expect(words.stderr).not.toContain('fine phrase here')
    expect((await run(['set', 'nope.key', '1', '--root', root])).stderr).toContain('nope.key: not a setting')
    expect((await run(['get', 'nope.key', '--root', root])).exitCode).toBe(1)
    expect((await run(['set', 'guard.chatter', 'loud', '--root', root])).exitCode).toBe(1)
    expect((await run(['set', 'guard.chatter', '--root', root])).exitCode).toBe(1) // value missing
    expect((await run(['frobnicate', '--root', root])).exitCode).toBe(1)
    expect(text(root)).toBe(before)
  })

  test('CFG.2.a4: --root is required, so a call can never fall back to the real folder', async () => {
    const none = await run(['set', 'guard.maxLength', '5000'])
    expect(none.exitCode).toBe(1)
    expect(none.stderr).toContain('--root <dir> is required')
    const bare = await run(['get', '--root'])
    expect(bare.exitCode).toBe(1)
    const twice = await run(['get', '--root', fresh(), '--root', fresh()])
    expect(twice.exitCode).toBe(1)
  })
})
