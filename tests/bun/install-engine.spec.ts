// ENG.5: bin/install-engine.ts builds <engine>.next from the plugin's engine/,
// checks it answers, and only then swaps it in. Real installs into temp folders.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cliOf } from '../../bin/install-engine'
import { ENGINE_BUILD } from '../../hooks/engine-build'
import { body, engineCall, runInstaller, tempDir, toolCall } from './helpers'

const INSTALL_TIMEOUT = 300_000

describe('a real install, then one that cannot reach the registry', () => {
  const temp = tempDir('install')
  const engine = join(temp.dir, 'engine')
  const store = join(temp.dir, 'store')
  let first: Awaited<ReturnType<typeof runInstaller>>

  beforeAll(async () => {
    first = await runInstaller(engine, store)
  }, INSTALL_TIMEOUT)
  afterAll(() => temp.dispose())

  test('the install succeeds and lays out the engine with the same cli path', () => {
    expect(first.exitCode).toBe(0)
    expect(JSON.parse(first.stdout.trim())).toMatchObject({ ok: true, build: ENGINE_BUILD })
    expect(existsSync(cliOf(engine))).toBe(true)
    expect(cliOf(engine)).toBe(join(engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'src', 'cli.ts'))
    const pkg = JSON.parse(readFileSync(join(engine, 'package.json'), 'utf8'))
    expect(pkg.dependencies).toEqual({ '@oh-my-pi/pi-mnemopi': 'file:./pi-mnemopi' })
    // engine/ copied whole, without node_modules and test
    expect(existsSync(join(engine, 'pi-mnemopi', 'src', 'cli.ts'))).toBe(true)
    expect(existsSync(join(engine, 'pi-mnemopi', 'LICENSE'))).toBe(true)
    expect(existsSync(join(engine, 'pi-mnemopi', 'UPSTREAM.md'))).toBe(true)
    expect(existsSync(join(engine, 'pi-mnemopi', 'test'))).toBe(false)
    expect(existsSync(join(engine, 'pi-mnemopi', 'node_modules'))).toBe(false)
    // a real copy, not a link back into the plugin folder
    const installed = lstatSync(join(engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi'))
    expect(installed.isSymbolicLink()).toBe(false)
    expect(installed.isDirectory()).toBe(true)
    expect(JSON.parse(readFileSync(join(engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'package.json'), 'utf8')).version).toBe(ENGINE_BUILD)
    // no dev or peer dependencies (onnxruntime) pulled in
    expect(existsSync(join(engine, 'node_modules', 'onnxruntime-node'))).toBe(false)
  })

  test('it wrote nothing outside the engine folder: no .next, no .old, no store', () => {
    expect(readdirSync(temp.dir).sort()).toEqual(['engine'])
  })

  test('the installed cli runs mnemopi_update with metadata', async () => {
    mkdirSync(store, { recursive: true })
    const cli = cliOf(engine)
    const stored = body((await engineCall(cli, store, 'o1', [toolCall(1, 'mnemopi_remember', { content: 'installed engine fact', source: 'imported', scope: 'global' })])).get(1))
    const replies = await engineCall(cli, store, 'o1', [toolCall(1, 'mnemopi_update', { memory_id: stored.memory_id, metadata: { tags: ['install'] } })])
    expect(body(replies.get(1))).toMatchObject({ status: 'updated' })
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    const row = db.query('SELECT metadata_json FROM working_memory WHERE id = ?').get(stored.memory_id) as { metadata_json: string }
    db.close()
    expect(JSON.parse(row.metadata_json)).toEqual({ tags: ['install'] })
  })

  test('an install with an unreachable registry fails and the first engine still answers', async () => {
    const before = readFileSync(join(engine, 'package.json'), 'utf8')
    const listing = readdirSync(engine).sort()
    const cliText = readFileSync(cliOf(engine), 'utf8')
    const failed = await runInstaller(engine, store, { BUN_CONFIG_REGISTRY: 'http://127.0.0.1:9', NPM_CONFIG_REGISTRY: 'http://127.0.0.1:9' })
    expect(failed.exitCode).not.toBe(0)
    expect(failed.stderr).toContain('install-engine: bun install failed')
    expect(existsSync(`${engine}.next`)).toBe(false)
    expect(existsSync(`${engine}.old`)).toBe(false)
    expect(readFileSync(join(engine, 'package.json'), 'utf8')).toBe(before)
    expect(readdirSync(engine).sort()).toEqual(listing)
    expect(readFileSync(cliOf(engine), 'utf8')).toBe(cliText)
    const replies = await engineCall(cliOf(engine), store, 'o1', [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }])
    expect(replies.get(1)?.result?.tools?.some((tool: { name: string }) => tool.name === 'mnemopi_update')).toBe(true)
  }, INSTALL_TIMEOUT)
})

describe('refusals', () => {
  test('a store inside the engine, .next or .old folder is refused before anything is written', async () => {
    const temp = tempDir('refuse')
    try {
      const engine = join(temp.dir, 'engine')
      for (const store of [join(engine, 'store'), `${engine}.next/s`, `${engine}.old`]) {
        const ran = await runInstaller(engine, store)
        expect(ran.exitCode).toBe(1)
        expect(ran.stderr).toContain('is inside')
      }
      expect(readdirSync(temp.dir)).toEqual([])
    } finally {
      temp.dispose()
    }
  })

  test('relative paths are refused', async () => {
    const ran = await runInstaller('engine', '/tmp/store')
    expect(ran.exitCode).toBe(1)
    expect(ran.stderr).toContain('must be an absolute path')
  })
})

const UNREACHABLE = { BUN_CONFIG_REGISTRY: 'http://127.0.0.1:9', NPM_CONFIG_REGISTRY: 'http://127.0.0.1:9' }
const answers = async (engine: string, store: string) => {
  const replies = await engineCall(cliOf(engine), store, 'o1', [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }])
  return replies.get(1)?.result?.tools?.some((tool: { name: string }) => tool.name === 'mnemopi_update') === true
}
const STORE_BYTES = 'not a real database, just bytes that must survive'

describe('the store guard compares real paths (review r1 HIGH 1)', () => {
  const temp = tempDir('guard')
  const engine = join(temp.dir, 'engine')
  let first: Awaited<ReturnType<typeof runInstaller>>

  beforeAll(async () => {
    first = await runInstaller(engine, join(temp.dir, 'store'))
  }, INSTALL_TIMEOUT)
  afterAll(() => temp.dispose())

  test.skipIf(process.platform === 'linux')('a store at <root>/Engine/store (another case of engine/) is refused and keeps its bytes', async () => {
    expect(first.exitCode).toBe(0)
    mkdirSync(join(engine, 'store'))
    writeFileSync(join(engine, 'store', 'mnemopi.db'), STORE_BYTES)
    const ran = await runInstaller(engine, join(temp.dir, 'Engine', 'store'))
    expect(ran.exitCode).toBe(1)
    expect(ran.stderr).toContain('is inside')
    expect(readFileSync(join(engine, 'store', 'mnemopi.db'), 'utf8')).toBe(STORE_BYTES)
    expect(await answers(engine, join(temp.dir, 'store'))).toBe(true)
  }, INSTALL_TIMEOUT)

  test('a store reached through a symlink into the engine folder is refused and keeps its bytes', async () => {
    expect(first.exitCode).toBe(0)
    mkdirSync(join(engine, 'data'))
    writeFileSync(join(engine, 'data', 'mnemopi.db'), STORE_BYTES)
    symlinkSync(join(engine, 'data'), join(temp.dir, 'linked-store'))
    const ran = await runInstaller(engine, join(temp.dir, 'linked-store'))
    expect(ran.exitCode).toBe(1)
    expect(ran.stderr).toContain('is inside')
    expect(readFileSync(join(engine, 'data', 'mnemopi.db'), 'utf8')).toBe(STORE_BYTES)
    // a store path below a symlink, and a dangling link into .next, are refused too
    expect((await runInstaller(engine, join(temp.dir, 'linked-store', 'deeper'))).exitCode).toBe(1)
    symlinkSync(`${engine}.next/later`, join(temp.dir, 'dangling-store'))
    expect((await runInstaller(engine, join(temp.dir, 'dangling-store'))).exitCode).toBe(1)
  }, INSTALL_TIMEOUT)
})

describe('the upgrade path (review r1 MED 2)', () => {
  const temp = tempDir('upgrade')
  const engine = join(temp.dir, 'engine')
  const store = join(temp.dir, 'store')
  afterAll(() => temp.dispose())

  test('an install over a working engine replaces it, leaves no .next or .old, and keeps a sibling store', async () => {
    expect((await runInstaller(engine, store)).exitCode).toBe(0)
    writeFileSync(join(engine, 'marker.txt'), 'old engine')
    mkdirSync(store)
    writeFileSync(join(store, 'mnemopi.db'), STORE_BYTES)
    const again = await runInstaller(engine, store)
    expect(again.exitCode).toBe(0)
    expect(existsSync(join(engine, 'marker.txt'))).toBe(false)
    expect(existsSync(`${engine}.next`)).toBe(false)
    expect(existsSync(`${engine}.old`)).toBe(false)
    expect(readFileSync(join(store, 'mnemopi.db'), 'utf8')).toBe(STORE_BYTES)
    expect(readdirSync(temp.dir).sort()).toEqual(['engine', 'store'])
    expect(await answers(engine, join(temp.dir, 'check'))).toBe(true)
  }, INSTALL_TIMEOUT)

  test('with only <engine>.old present (a swap cut short), the next run puts it back even when the install fails', async () => {
    writeFileSync(join(engine, 'marker.txt'), 'the engine that was cut short')
    renameSync(engine, `${engine}.old`)
    const failed = await runInstaller(engine, store, UNREACHABLE)
    expect(failed.exitCode).toBe(1)
    expect(readFileSync(join(engine, 'marker.txt'), 'utf8')).toBe('the engine that was cut short')
    expect(existsSync(`${engine}.old`)).toBe(false)
    expect(existsSync(`${engine}.next`)).toBe(false)
    expect(await answers(engine, join(temp.dir, 'check'))).toBe(true)
  }, INSTALL_TIMEOUT)

  test('a swap step that fails leaves the engine as it was and no .next (review r1 LOW 9)', async () => {
    // A stale .old that cannot be deleted stands in for Windows refusing a
    // rename of a folder a running engine holds open.
    const locked = join(`${engine}.old`, 'locked')
    mkdirSync(locked, { recursive: true })
    writeFileSync(join(locked, 'file'), 'x')
    chmodSync(locked, 0o500)
    try {
      const listing = readdirSync(engine).sort()
      const ran = await runInstaller(engine, store)
      expect(ran.exitCode).toBe(1)
      expect(ran.stderr).toContain('could not move the new engine into place')
      expect(existsSync(`${engine}.next`)).toBe(false)
      expect(readdirSync(engine).sort()).toEqual(listing)
      expect(await answers(engine, join(temp.dir, 'check'))).toBe(true)
    } finally {
      chmodSync(locked, 0o700)
    }
  }, INSTALL_TIMEOUT)
})
