// `install-engine.ts --root` (issue #43, SA.2): the standalone install for Switch.
// Real installs into temp roots, with HOME pointed at a fake home or at a folder
// that does not exist; the lock, closure and launcher checks around them.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { EMBEDDINGS_CACHE_DIR } from '../../hooks/engine'
import { shWrapper } from '../../hooks/launcher'
import { configText, emptyConfig } from '../../hooks/settings'
import { cliOf, installRoot, launcherOptions, LockBusy, proxyClosure, rootLayout, windowsPathProblem, withInstallLock } from '../../bin/install-engine'
import { body, engineCall, INSTALLER, isolatedEnv, ROOT, tempDir, toolCall } from './helpers'

const INSTALL_TIMEOUT = 300_000
const POSIX = process.platform !== 'win32'
const mode = (path: string) => statSync(path).mode & 0o777

// The proxy's closure as the review listed it (11 files), plus bin/lockfile.ts,
// which bin/activity.ts imports since SA.2 moved the lock there.
const EXPECTED_CLOSURE = [
  'bin/activity.ts',
  'bin/lockfile.ts',
  'bin/mcp-proxy.ts',
  'bin/settings.ts',
  'hooks/activity-log.ts',
  'hooks/engine-build.ts',
  'hooks/guard.ts',
  'hooks/kinds.ts',
  'hooks/settings.ts',
  'hooks/surface.ts',
  'hooks/tags.ts',
  'hooks/vocab.ts',
]

// Only what a standalone install needs: PATH, HOME, the download cache (not user
// data) and no Bun transpiler cache, which Bun itself would write under HOME.
// Each spawn lays this over isolatedEnv(), whose PI_CONFIG_DIR the installer and
// the launcher must override (they pin <root>/model-cache).
function rootEnv(home: string, extra: Record<string, string> = {}) {
  return { PATH: process.env.PATH ?? '', HOME: home, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', ...extra }
}

async function runRoot(args: string[], env: Record<string, string>) {
  const child = Bun.spawn([process.execPath, INSTALLER, ...args], { env: { ...isolatedEnv('root-install'), ...env }, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

/** One launcher process answering `messages`; the replies by id. */
async function launch(launcher: string, env: Record<string, string>, messages: readonly object[]) {
  const child = Bun.spawn([launcher], { env: { ...isolatedEnv('root-launch'), ...env }, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  child.stdin.write(messages.map(message => `${JSON.stringify(message)}\n`).join(''))
  child.stdin.end()
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const replies = new Map<unknown, any>()
  for (const line of stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (message?.id !== undefined) replies.set(message.id, message)
    } catch {
      // chatter
    }
  }
  return { replies, stderr, exitCode }
}

const INITIALIZE = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'switch-test', version: '1' } } }
const INITIALIZED = { jsonrpc: '2.0', method: 'notifications/initialized' }

/** Every file and folder under `dir`: relative path, mode, size, mtime and content hash. */
function treeHash(dir: string) {
  const hash = createHash('sha256')
  const walk = (folder: string) => {
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name)
      const stat = statSync(path)
      hash.update(`${relative(dir, path)}\0${stat.mode}\0${stat.size}\0${stat.mtimeMs}\0`)
      if (stat.isDirectory()) walk(path)
      else hash.update(readFileSync(path))
    }
  }
  walk(dir)
  return hash.digest('hex')
}

const importsClaudeCode = (text: string) => /^[ \t]*(?:import|export)(?![ \t]+type\b)[^'";]*?['"]claude-code(?:\/[^'"]*)?['"]/m.test(text)

describe('--root with HOME at a fake home holding a .claude tree (a, c, g, h, i)', () => {
  const temp = tempDir('root-a')
  const home = join(temp.dir, 'home')
  const root = join(temp.dir, 'memory')
  const layout = rootLayout(root)
  let before = ''
  let first: Awaited<ReturnType<typeof runRoot>>

  beforeAll(async () => {
    const fake = join(home, '.claude', 'mnemosyne')
    mkdirSync(join(fake, 'store'), { recursive: true })
    mkdirSync(join(fake, 'engine'), { recursive: true })
    writeFileSync(join(fake, 'config.json'), '{ "version": 1, "guard": { "mode": "warn" } }\n')
    writeFileSync(join(fake, 'vocabulary.json'), '{"version":1,"tags":{}}\n')
    writeFileSync(join(fake, 'store', 'mnemopi.db'), 'not a database')
    mkdirSync(join(home, '.omp'), { recursive: true })
    writeFileSync(join(home, '.omp', 'marker'), 'omp')
    before = treeHash(home)
    first = await runRoot(['--root', root], rootEnv(home))
  }, INSTALL_TIMEOUT)
  afterAll(() => temp.dispose())

  test('the install succeeds and reports the root, store, launcher and proxy', () => {
    expect(first.stderr).toBe('')
    expect(first.exitCode).toBe(0)
    expect(JSON.parse(first.stdout.trim())).toMatchObject({ ok: true, root, store: layout.store, launcher: layout.launcher, cli: cliOf(layout.engine) })
  })

  test('(a) nothing under the fake HOME changed, .claude and .omp included', () => {
    expect(treeHash(home)).toBe(before)
  })

  test('the root holds exactly the planned layout, and no lock, .next or .old', () => {
    expect(readdirSync(root).sort()).toEqual(['activity.jsonl', 'bin', 'config.json', 'engine', 'model-cache', 'plugin', 'store', 'vocabulary.json'])
    expect(readdirSync(layout.bin)).toEqual(['mnemosyne-mcp'])
    expect(readdirSync(layout.plugin).sort()).toEqual(['bin', 'hooks'])
  })

  test.if(POSIX)('(c) folders 0700, the launcher 0700, config, vocabulary and activity log 0600', () => {
    for (const dir of [root, layout.engine, layout.store, layout.modelCache, layout.plugin, layout.bin]) expect([dir, mode(dir)]).toEqual([dir, 0o700])
    expect(mode(layout.launcher)).toBe(0o700)
    for (const file of [layout.config, layout.vocabulary, layout.activity]) expect([file, mode(file)]).toEqual([file, 0o600])
  })

  test('(c) the launcher answers initialize and tools/list through the copied proxy', async () => {
    const { replies } = await launch(layout.launcher, rootEnv(home), [INITIALIZE, INITIALIZED, { jsonrpc: '2.0', id: 2, method: 'tools/list' }])
    expect(replies.get(1)?.result?.serverInfo?.name).toBe('mnemosyne')
    const names = (replies.get(2)?.result?.tools ?? []).map((tool: { name: string }) => tool.name)
    expect(names).toContain('memory_remember')
    expect(names).toContain('memory_recall')
    expect(treeHash(home)).toBe(before)
  }, INSTALL_TIMEOUT)

  test("(h) the copied proxy files are the walker's closure, and none imports claude-code at run time", () => {
    const copied = ['bin', 'hooks'].flatMap(dir => readdirSync(join(layout.plugin, dir)).map(name => `${dir}/${name}`)).sort()
    expect(copied).toEqual(proxyClosure(ROOT))
    expect(copied).toEqual(EXPECTED_CLOSURE)
    for (const rel of copied) {
      const text = readFileSync(join(layout.plugin, rel), 'utf8')
      expect(text).toBe(readFileSync(join(ROOT, rel), 'utf8'))
      expect([rel, importsClaudeCode(text)]).toEqual([rel, false])
    }
  })

  test('(i) the launcher under the root differs from the plugin launcher for the same options only in paths', () => {
    const written = readFileSync(layout.launcher, 'utf8')
    const ours = launcherOptions(layout, false)
    expect(written).toBe(shWrapper(ours))
    // The plugin's launcher for the same settings (embeddings off, strict, log on).
    const pluginRoot = '/home/u/.claude/mnemosyne'
    const plugin = {
      store: `${pluginRoot}/store`,
      cli: `${pluginRoot}/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts`,
      proxy: '/plugins/mnemosyne/bin/mcp-proxy.ts',
      activity: `${pluginRoot}/activity.jsonl`,
      embeddings: false,
      guardMode: 'strict',
      vocabulary: `${pluginRoot}/vocabulary.json`,
      root: pluginRoot,
      modelCacheDir: EMBEDDINGS_CACHE_DIR,
    }
    let mapped = written
    for (const key of ['cli', 'proxy', 'activity', 'vocabulary', 'store', 'modelCacheDir', 'root'] as const) mapped = mapped.split(ours[key]).join(plugin[key])
    expect(mapped).toBe(shWrapper(plugin))
  })

  test('(g) config.json and vocabulary.json are created when absent and kept byte for byte by a second install', async () => {
    expect(readFileSync(layout.config, 'utf8')).toBe(configText(emptyConfig()))
    expect(JSON.parse(readFileSync(layout.vocabulary, 'utf8')).tags['agent:claude-code']).toBeDefined()
    const config = '{ "version": 1, "guard": { "mode": "warn" } }\n'
    const vocabulary = '{"version":1,"tags":{"switch":{"ns":"topic","description":"","aliases":[],"admitted":"manual","count":0}}}\n'
    writeFileSync(layout.config, config)
    writeFileSync(layout.vocabulary, vocabulary)
    writeFileSync(layout.activity, '{"a":1}\n')
    const again = await runRoot(['--root', root], rootEnv(home))
    expect(again.exitCode).toBe(0)
    expect(readFileSync(layout.config, 'utf8')).toBe(config)
    expect(readFileSync(layout.vocabulary, 'utf8')).toBe(vocabulary)
    expect(readFileSync(layout.activity, 'utf8')).toBe('{"a":1}\n')
    expect(treeHash(home)).toBe(before)
  }, INSTALL_TIMEOUT)
})

describe('(b) --root and the launcher with HOME set to a folder that does not exist', () => {
  const temp = tempDir('root-b')
  const home = join(temp.dir, 'no-such-home')
  const root = join(temp.dir, 'memory')
  const layout = rootLayout(root)
  afterAll(() => temp.dispose())

  test('the install, initialize, a remember and a recall all succeed, and HOME is still not there', async () => {
    const ran = await runRoot(['--root', root], rootEnv(home))
    expect(ran.stderr).toBe('')
    expect(ran.exitCode).toBe(0)
    const { replies, exitCode } = await launch(layout.launcher, rootEnv(home), [
      INITIALIZE,
      INITIALIZED,
      toolCall(2, 'memory_remember', { content: 'Switch keeps its memory under its own root.', kind: 'fact', tags: ['switch', 'install'] }),
      toolCall(3, 'memory_recall', { query: 'memory own root' }),
    ])
    expect(exitCode).toBe(0)
    expect(replies.get(1)?.result?.serverInfo?.name).toBe('mnemosyne')
    expect(body(replies.get(2))).toMatchObject({ status: 'stored' })
    expect(body(replies.get(3)).results.map((row: { content: string }) => row.content)).toContain('Switch keeps its memory under its own root.')
    expect(existsSync(join(layout.store, 'mnemopi.db'))).toBe(true)
    expect(existsSync(home)).toBe(false)
  }, INSTALL_TIMEOUT)
})

describe('(d) two installs at once into one root', () => {
  const temp = tempDir('root-d')
  const home = join(temp.dir, 'home')
  const root = join(temp.dir, 'memory')
  const layout = rootLayout(root)
  afterAll(() => temp.dispose())

  test('both finish: the second waits for the first and then installs; no lock is left', async () => {
    mkdirSync(home)
    const [a, b] = await Promise.all([runRoot(['--root', root], rootEnv(home)), runRoot(['--root', root], rootEnv(home))])
    expect([a.exitCode, a.stderr]).toEqual([0, ''])
    expect([b.exitCode, b.stderr]).toEqual([0, ''])
    expect(existsSync(layout.lock)).toBe(false)
    expect(existsSync(`${layout.engine}.next`)).toBe(false)
    expect(existsSync(`${layout.engine}.old`)).toBe(false)
    const { replies } = await launch(layout.launcher, rootEnv(home), [INITIALIZE])
    expect(replies.get(1)?.result).toBeDefined()
  }, INSTALL_TIMEOUT * 2)

  test('an install that cannot get the lock in time exits 3 with the message and leaves the holder alone', async () => {
    const note = '{"pid":1}\n'
    writeFileSync(layout.lock, note)
    const engineBefore = readdirSync(layout.engine).sort()
    const ran = await runRoot(['--root', root], rootEnv(home, { MNEMOSYNE_LOCK_WAIT_MS: '1500' }))
    expect(ran.exitCode).toBe(3)
    expect(ran.stderr.trim()).toBe(`install-engine: another install holds ${layout.lock}`)
    expect(readFileSync(layout.lock, 'utf8')).toBe(note)
    expect(readdirSync(layout.engine).sort()).toEqual(engineBefore)
    rmSync(layout.lock)
  }, INSTALL_TIMEOUT)
})

describe('(e) the install lock', () => {
  const temp = tempDir('root-lock')
  afterAll(() => temp.dispose())
  const fast = { waitMs: 300, pollMs: 50 }

  test('a lock older than 30 minutes is taken over, and removed after the work', async () => {
    const file = join(temp.dir, 'stale.lock')
    writeFileSync(file, '{"pid":1}\n')
    const old = new Date(Date.now() - 31 * 60_000)
    utimesSync(file, old, old)
    let held = ''
    expect(await withInstallLock(file, async () => ((held = readFileSync(file, 'utf8')), 'done'), fast)).toBe('done')
    expect(JSON.parse(held).pid).toBe(process.pid)
    expect(existsSync(file)).toBe(false)
  })

  test('a fresh lock is not taken: LockBusy with the message after the wait', async () => {
    const file = join(temp.dir, 'fresh.lock')
    writeFileSync(file, 'held')
    let ran = false
    const error = await withInstallLock(file, async () => (ran = true), fast).catch(err => err)
    expect(error).toBeInstanceOf(LockBusy)
    expect(error.message).toBe(`another install holds ${file}`)
    expect(ran).toBe(false)
    expect(readFileSync(file, 'utf8')).toBe('held')
  })

  test('a dead pid alone does not make a lock stale', async () => {
    const file = join(temp.dir, 'dead.lock')
    // pid 2^22 + 1 is above every default pid_max, so no process has it.
    writeFileSync(file, `${JSON.stringify({ pid: 4194305, started: new Date(0).toISOString() })}\n`)
    expect(await withInstallLock(file, async () => 'ran', fast).catch(err => err)).toBeInstanceOf(LockBusy)
    expect(existsSync(file)).toBe(true)
  })

  test('the lock is gone after a failed install', async () => {
    const file = join(temp.dir, 'fail.lock')
    const error = await withInstallLock(file, async () => {
      expect(existsSync(file)).toBe(true)
      throw new Error('forced failure')
    }).catch(err => err)
    expect(error.message).toBe('forced failure')
    expect(existsSync(file)).toBe(false)
  })

  test('the holder refreshes the mtime while it works', async () => {
    const file = join(temp.dir, 'refresh.lock')
    let first = 0
    let later = 0
    await withInstallLock(
      file,
      async () => {
        const old = new Date(Date.now() - 10 * 60_000)
        utimesSync(file, old, old)
        first = statSync(file).mtimeMs
        await Bun.sleep(250)
        later = statSync(file).mtimeMs
      },
      { refreshMs: 50 },
    )
    expect(later).toBeGreaterThan(first + 5 * 60_000)
  })

  test('a lock that cannot be created at all fails at once instead of waiting', async () => {
    const file = join(temp.dir, 'missing-folder', 'x.lock')
    const error = await withInstallLock(file, async () => 'ran', { waitMs: 60_000, pollMs: 10 }).catch(err => err)
    expect(error).not.toBeInstanceOf(LockBusy)
    expect(error.message).toBe(`could not create the lock ${file}`)
  })
})

describe('(f) a failed check under --root leaves the previous engine answering', () => {
  const stubRoot = tempDir('root-stub-plugin')
  const temp = tempDir('root-f')
  const home = join(temp.dir, 'home')
  const root = join(temp.dir, 'memory')
  const layout = rootLayout(root)
  afterAll(() => {
    temp.dispose()
    stubRoot.dispose()
  })

  beforeAll(async () => {
    mkdirSync(home)
    expect((await runRoot(['--root', root], rootEnv(home))).exitCode).toBe(0)
    // A stub plugin root: the real proxy closure, and an engine that names our build
    // but has no mnemopi_update with metadata, so the check refuses it.
    for (const rel of proxyClosure(ROOT)) {
      mkdirSync(join(stubRoot.dir, rel, '..'), { recursive: true })
      writeFileSync(join(stubRoot.dir, rel), readFileSync(join(ROOT, rel)))
    }
    const stubEngine = join(stubRoot.dir, 'engine')
    mkdirSync(join(stubEngine, 'src'), { recursive: true })
    writeFileSync(join(stubEngine, 'package.json'), `${JSON.stringify({ name: '@oh-my-pi/pi-mnemopi', version: JSON.parse(readFileSync(join(ROOT, 'engine', 'package.json'), 'utf8')).version, type: 'module' })}\n`)
    writeFileSync(
      join(stubEngine, 'src', 'cli.ts'),
      `for (const line of (await Bun.stdin.text()).split('\\n').filter(Boolean)) {
  const { id } = JSON.parse(line)
  if (id !== undefined) console.log(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: [] } }))
}
`,
    )
  }, INSTALL_TIMEOUT)

  test('the install fails, the engine and launcher still answer, and no lock or .next is left', async () => {
    const listing = readdirSync(layout.engine).sort()
    const error = await installRoot(stubRoot.dir, root).catch(err => err)
    expect(error.message).toBe('the new engine has no mnemopi_update with metadata')
    expect(readdirSync(layout.engine).sort()).toEqual(listing)
    expect(existsSync(layout.lock)).toBe(false)
    expect(existsSync(`${layout.engine}.next`)).toBe(false)
    const replies = await engineCall(cliOf(layout.engine), layout.store, 'global', [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }])
    expect(Array.isArray(replies.get(1)?.result?.tools)).toBe(true)
    const { replies: viaLauncher } = await launch(layout.launcher, rootEnv(home), [INITIALIZE])
    expect(viaLauncher.get(1)?.result).toBeDefined()
  }, INSTALL_TIMEOUT)
})

describe('refusals', () => {
  const temp = tempDir('root-refuse')
  afterAll(() => temp.dispose())

  test('a relative --root, a relative --store, a missing value and an unknown flag exit 1 before anything is written', async () => {
    const env = rootEnv(join(temp.dir, 'home'))
    for (const args of [['--root', 'rel/dir'], ['--root', join(temp.dir, 'r'), '--store', 'rel'], ['--root'], ['--root', join(temp.dir, 'r'), '--force']]) {
      const ran = await runRoot(args, env)
      expect([args, ran.exitCode]).toEqual([args, 1])
      expect(ran.stderr).toStartWith('install-engine: ')
    }
    expect(readdirSync(temp.dir)).toEqual([])
  })

  test('(j) on Windows a root or derived path holding ", % or ! is refused (the check alone)', () => {
    expect(windowsPathProblem(Object.values(rootLayout('C:/Users/a/.switch/memory')))).toBeUndefined()
    for (const bad of ['C:/Users/a"b/memory', 'C:/Users/100%/memory', 'C:/Users/wow!/memory']) {
      expect(windowsPathProblem(Object.values(rootLayout(bad)))).toBe(`on Windows a path must not contain ", % or ! (got "${bad}")`)
    }
    expect(windowsPathProblem(Object.values(rootLayout('C:/ok', 'D:/st%ore')))).toContain('D:/st%ore')
  })
})

describe("the walker refuses a closure the root could not run", () => {
  const temp = tempDir('root-walk')
  afterAll(() => temp.dispose())
  const plugin = (files: Record<string, string>) => {
    const dir = join(temp.dir, String(Math.random()).slice(2))
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(dir, rel, '..'), { recursive: true })
      writeFileSync(join(dir, rel), text)
    }
    return dir
  }

  test('follows runtime imports and re-exports, skips type-only ones', () => {
    const dir = plugin({
      'bin/mcp-proxy.ts': "import { a } from '../hooks/a'\nimport type { T } from '../hooks/typed'\nexport { b } from './b'\nimport {\n  c,\n} from '../hooks/c.ts'\n",
      'hooks/a.ts': "import './side'\n",
      'hooks/side.ts': '',
      'bin/b.ts': '',
      'hooks/c.ts': '',
    })
    expect(proxyClosure(dir)).toEqual(['bin/b.ts', 'bin/mcp-proxy.ts', 'hooks/a.ts', 'hooks/c.ts', 'hooks/side.ts'])
  })

  test('a claude-code import, a missing file, a file outside bin/ and hooks/, and a dynamic import are refused', () => {
    expect(() => proxyClosure(plugin({ 'bin/mcp-proxy.ts': "import { atom } from 'claude-code'\n" }))).toThrow('which only the Claude Code host has')
    expect(() => proxyClosure(plugin({ 'bin/mcp-proxy.ts': "import { x } from './gone'\n" }))).toThrow('bin/gone.ts, which does not exist')
    expect(() => proxyClosure(plugin({ 'bin/mcp-proxy.ts': "import { x } from '../ui/x'\n", 'ui/x.ts': '' }))).toThrow('outside bin/ and hooks/')
    expect(() => proxyClosure(plugin({ 'bin/mcp-proxy.ts': "const m = await import('./x')\n" }))).toThrow('loads a module at run time')
  })
})
