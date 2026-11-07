// bin/update.ts (issue #43): the one-step update for Claude Desktop machines.
// Planning, refusals, process sorting, launcher and staging logic only: no real
// network, no process listing, no install. Release staging runs against a fake
// runner and a fake fetch in a temp folder.
import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EMBEDDINGS_CACHE_DIR } from '../../hooks/engine'
import { cmdWrapper } from '../../hooks/launcher'
import { slashes } from '../../hooks/owner'
import { cliOf } from '../../bin/install-engine'
import {
  isSwapFailure,
  lockedMessage,
  nextStatus,
  classifyProcesses,
  compareVersions,
  EXIT,
  homeLayout,
  type InstallState,
  latestReleaseTag,
  launcherFor,
  launcherText,
  main,
  parseArgs,
  parseLauncher,
  parseLsRemoteTags,
  parseProcessList,
  planUpdate,
  pluginCopyIncludes,
  type Proc,
  type Runner,
  readInstalled,
  readSource,
  shortcutScript,
  shortcutVbs,
  type SourceState,
  stageRelease,
  summary,
  UpdateError,
} from '../../bin/update'
import { tempDir } from './helpers'

const HOME = join(tempDir('update-home').dir, 'home')
const layout = homeLayout(HOME, join(HOME, 'AppData', 'Roaming'))
const NONE = { chats: [], dashboard: [] }

describe('parseArgs', () => {
  test('defaults and flags', () => {
    expect(parseArgs([])).toEqual({ waitSeconds: 0, stopEngines: false, force: false, installShortcut: false })
    expect(parseArgs(['--from', '/x', '--wait', '600', '--stop-engines', '--force'])).toMatchObject({ from: '/x', waitSeconds: 600, stopEngines: true, force: true })
    expect(parseArgs(['--tag', 'v0.28.0']).tag).toBe('v0.28.0')
    expect(parseArgs(['--install-shortcut']).installShortcut).toBe(true)
  })
  test('refuses bad input', () => {
    expect(() => parseArgs(['--tag', 'latest'])).toThrow('--tag must look like v1.2.3')
    expect(() => parseArgs(['--from'])).toThrow('--from needs a value')
    expect(() => parseArgs(['--from', '--force'])).toThrow('--from needs a value')
    expect(() => parseArgs(['--wait', '-1'])).toThrow('--wait needs a number')
    expect(() => parseArgs(['--from', '/x', '--tag', 'v1.0.0'])).toThrow('cannot be used together')
    expect(() => parseArgs(['--kill'])).toThrow('unknown argument "--kill"')
  })
})

describe('versions and tags', () => {
  test('compareVersions is numeric', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1)
    expect(compareVersions('0.27.0', '0.27.0')).toBe(0)
    expect(compareVersions('v0.11.0', '0.27.0')).toBe(-1)
    expect(compareVersions(undefined, '0.1.0')).toBe(-1)
    expect(compareVersions('0.1.0', undefined)).toBe(1)
  })
  test('latest release tag from ls-remote output, ignoring peeled refs and pre-releases', () => {
    const text = ['aaa\trefs/tags/v0.9.0', 'bbb\trefs/tags/v0.10.0', 'ccc\trefs/tags/v0.10.0^{}', 'ddd\trefs/tags/v0.11.0-rc1', 'eee\trefs/tags/nightly', 'fff\trefs/heads/main', ''].join('\n')
    expect(parseLsRemoteTags(text)).toEqual(['v0.9.0', 'v0.10.0', 'v0.11.0-rc1', 'nightly'])
    expect(latestReleaseTag(parseLsRemoteTags(text))).toBe('v0.10.0')
    expect(latestReleaseTag(['nightly'])).toBeUndefined()
  })
})

// Shaped like the real Windows process list: Claude Desktop's proxies and engines,
// the always-on dashboard (loop, holder, server, its engine), a repo dev server.
function processes(): Proc[] {
  const engine = `bun ${slashes(cliOf(layout.engine))} mcp`
  const proxy = `bun  "${slashes(join(layout.plugin, 'bin', 'mcp-proxy.ts'))}"`
  return [
    { pid: 10, ppid: 1, command: proxy },
    { pid: 11, ppid: 10, command: engine },
    { pid: 20, ppid: 2, command: proxy },
    { pid: 21, ppid: 20, command: engine },
    { pid: 30, ppid: 3, command: `powershell.exe -WindowStyle Hidden -File "${join(layout.uiDir, 'run-ui.ps1')}"` },
    { pid: 31, ppid: 4, command: `bun.exe "${join(layout.plugin, 'ui', 'server.ts')}" --hold` },
    { pid: 32, ppid: 31, command: `bun.exe ${join(layout.plugin, 'ui', 'server.ts')}` },
    { pid: 33, ppid: 32, command: engine },
    { pid: 40, ppid: 5, command: engine },
    { pid: 50, ppid: 6, command: 'bun --watch C:\\code\\claude-mnemosyne\\ui\\server.ts' },
    { pid: 60, ppid: 7, command: `bun ${slashes(cliOf(`${layout.engine}.next`))} mcp` },
  ]
}

describe('classifyProcesses', () => {
  const sorted = classifyProcesses(processes(), layout)
  test('chats: one per proxy with its engine, an engine with no proxy alone', () => {
    expect(sorted.chats.map(chat => [chat.proxy?.pid, chat.engines.map(e => e.pid)])).toEqual([
      [10, [11]],
      [20, [21]],
      [undefined, [40]],
    ])
  })
  test('the dashboard: loop, holder, server and the engine it runs', () => {
    expect(sorted.dashboard.map(p => p.pid).sort()).toEqual([30, 31, 32, 33])
  })
  test('a repo dev server and the install check engine are not ours', () => {
    const pids = [...sorted.dashboard.map(p => p.pid), ...sorted.chats.flatMap(chat => [chat.proxy?.pid, ...chat.engines.map(e => e.pid)])]
    expect(pids).not.toContain(50)
    expect(pids).not.toContain(60)
  })
  test('Windows paths match case-insensitively and with either slash', () => {
    const upper: Proc = { pid: 70, ppid: 1, command: `BUN ${cliOf(layout.engine).toUpperCase().replace(/\//g, '\\')} mcp` }
    expect(classifyProcesses([upper], layout, true).chats).toHaveLength(1)
  })
})

describe('parseProcessList', () => {
  test('PowerShell JSON: an array, a single object, empty output', () => {
    expect(parseProcessList('[{"ProcessId":1,"ParentProcessId":0,"CommandLine":"a"},{"ProcessId":2,"ParentProcessId":1,"CommandLine":null}]', true)).toEqual([
      { pid: 1, ppid: 0, command: 'a' },
      { pid: 2, ppid: 1, command: '' },
    ])
    expect(parseProcessList('{"ProcessId":5,"ParentProcessId":4,"CommandLine":"b"}', true)).toEqual([{ pid: 5, ppid: 4, command: 'b' }])
    expect(parseProcessList('', true)).toEqual([])
  })
  test('ps output', () => {
    expect(parseProcessList('  12   1 bun /x/cli.ts mcp\n13 12 sh -c a b\n', false)).toEqual([
      { pid: 12, ppid: 1, command: 'bun /x/cli.ts mcp' },
      { pid: 13, ppid: 12, command: 'sh -c a b' },
    ])
  })
})

describe('planUpdate', () => {
  const source: SourceState = { dir: '/src', pluginVersion: '0.28.0', engineBuild: '18.12.3-mnemosyne.12', hasUpdater: true }
  const installed: InstallState = { pluginVersion: '0.11.0', engineBuild: '18.12.3-mnemosyne.11', launcherText: 'old' }
  const base = { installed, source, expectedLauncher: 'new', processes: NONE, windows: true, force: false, stopEngines: false }

  test('everything that differs is updated; nothing running, nothing stopped', () => {
    expect(planUpdate(base)).toEqual({ kind: 'update', engine: true, plugin: true, launcher: true, stopChats: [], stopDashboard: [], notes: [] })
  })
  test('up to date when versions and launcher match; --force reinstalls', () => {
    const current = { ...base, installed: { pluginVersion: '0.28.0', engineBuild: '18.12.3-mnemosyne.12', launcherText: 'new' } }
    expect(planUpdate(current).kind).toBe('up-to-date')
    expect(planUpdate({ ...current, force: true })).toMatchObject({ kind: 'update', engine: true, plugin: true, launcher: true })
  })
  test('the engine is left alone when its build matches', () => {
    expect(planUpdate({ ...base, installed: { ...installed, engineBuild: source.engineBuild } })).toMatchObject({ engine: false, plugin: true })
  })
  test('an older source is refused unless forced', () => {
    const older = { ...base, source: { ...source, pluginVersion: '0.10.0' } }
    expect(planUpdate(older)).toMatchObject({ kind: 'refused', code: EXIT.failed })
    expect(planUpdate({ ...older, force: true }).kind).toBe('update')
  })
  test('a folder that is not a checkout is refused', () => {
    expect(planUpdate({ ...base, source: { ...source, engineBuild: undefined } })).toMatchObject({ kind: 'refused', message: expect.stringContaining('not a claude-mnemosyne checkout') })
    expect(planUpdate({ ...base, source: { ...source, pluginVersion: undefined } })).toMatchObject({ kind: 'refused', message: expect.stringContaining('not a claude-mnemosyne checkout') })
  })
  test('Windows: running chats do not refuse the plan (the swap is tried; a running engine does not always lock it)', () => {
    const plan = planUpdate({ ...base, processes: classifyProcesses(processes(), layout) })
    expect(plan).toMatchObject({ kind: 'update', engine: true, plugin: true, stopChats: [] })
    expect((plan as { notes: string[] }).notes[0]).toBe('3 running MCP connection(s) keep the old version until their app is restarted.')
  })
  test('a refused swap is reported with each connection, how many, and whether anything changed', () => {
    const sorted = classifyProcesses(processes(), layout)
    const message = lockedMessage(sorted, true)
    expect(message).toContain('(3 MCP connections running)')
    expect(message).toContain('proxy pid 10 with engine pid 11')
    expect(message).toContain('proxy pid 20 with engine pid 21')
    expect(message).toContain('engine pid 40')
    expect(message).toContain('Nothing was changed; the previous version keeps working.')
    expect(message).toContain('Quit Claude Desktop')
    expect(lockedMessage(sorted, false)).toContain('Part of the update is in place')
    expect(lockedMessage({ chats: [{ engines: [{ pid: 9, ppid: 1, command: '' }] }], dashboard: [] }, true)).toContain('while a Claude chat uses them (1 MCP connection running)')
  })
  test('only a refused rename counts as a locked swap, not a failed build or check', () => {
    expect(isSwapFailure(new Error('could not move the new engine into place: EBUSY'))).toBe(true)
    expect(isSwapFailure(new Error('could not move the new plugin copy into place (the old one is kept): EPERM'))).toBe(true)
    expect(isSwapFailure(new Error('bun install failed (exit 1)'))).toBe(false)
    expect(isSwapFailure(undefined)).toBe(false)
  })
  test('Windows: --stop-engines stops the chats only; the dashboard is stopped for the swap', () => {
    const plan = planUpdate({ ...base, stopEngines: true, processes: classifyProcesses(processes(), layout) })
    expect(plan).toMatchObject({ kind: 'update', stopChats: [10, 11, 20, 21, 40] })
    expect((plan as { stopDashboard: Proc[] }).stopDashboard.map(p => p.pid).sort()).toEqual([30, 31, 32, 33])
  })
  test('processes are never stopped without --stop-engines', () => {
    for (const windows of [true, false]) {
      const plan = planUpdate({ ...base, windows, processes: classifyProcesses(processes(), layout) })
      if (plan.kind === 'update') expect(plan.stopChats).toEqual([])
    }
  })
  test('elsewhere running chats do not block: they keep the old version until restarted', () => {
    const plan = planUpdate({ ...base, windows: false, processes: classifyProcesses(processes(), layout) })
    expect(plan).toMatchObject({ kind: 'update', stopChats: [], stopDashboard: [] })
    expect((plan as { notes: string[] }).notes[0]).toContain('keep the old version')
  })
  test('a launcher-only rewrite neither blocks nor stops anything', () => {
    const plan = planUpdate({ ...base, installed: { pluginVersion: '0.28.0', engineBuild: source.engineBuild, launcherText: 'old' }, processes: classifyProcesses(processes(), layout) })
    expect(plan).toEqual({ kind: 'update', engine: false, plugin: false, launcher: true, stopChats: [], stopDashboard: [], notes: [] })
  })
})

describe('the progress file (--status)', () => {
  const at = (iso: string) => new Date(iso)
  test('lines append, the state moves to running, then to a final state with the exit code', () => {
    const begun = nextStatus(undefined, { state: 'starting', lines: ['Starting'] }, at('2026-11-07T10:00:00Z'))!
    expect(begun).toEqual({ state: 'starting', lines: ['Starting'], started: '2026-11-07T10:00:00.000Z', updated: '2026-11-07T10:00:00.000Z' })
    const mid = nextStatus(begun, { lines: ['Installing'] }, at('2026-11-07T10:01:00Z'))!
    expect(mid).toMatchObject({ state: 'running', lines: ['Starting', 'Installing'], started: '2026-11-07T10:00:00.000Z' })
    expect(nextStatus(mid, { state: 'blocked', code: EXIT.blocked })).toMatchObject({ state: 'blocked', code: 2 })
  })
  test('a final state is not replaced by another (the staging parent keeps its child result)', () => {
    const done = nextStatus(undefined, { state: 'done', code: 0 })!
    expect(nextStatus(done, { state: 'failed', code: 1 })).toBeUndefined()
    expect(nextStatus(done, { lines: ['late line'] })).toMatchObject({ state: 'done', lines: ['late line'] })
  })
  test('only the last 200 lines are kept', () => {
    const many = Array.from({ length: 250 }, (_, i) => `line ${i}`)
    const status = nextStatus(undefined, { lines: many })!
    expect(status.lines).toHaveLength(200)
    expect(status.lines[0]).toBe('line 50')
  })
  test('--status is an option', () => {
    expect(parseArgs(['--status', '/x/update-status.json']).status).toBe('/x/update-status.json')
  })
})

describe('the launcher', () => {
  // The launcher 0.9.0 wrote on the author's machine (paths made up), with embeddings on and the bare default cache dir.
  const existing = cmdWrapper({
    store: 'D:/memory/store',
    cli: 'C:/old/engine/cli.ts',
    proxy: 'C:/old/plugin/bin/mcp-proxy.ts',
    activity: '',
    embeddings: true,
    guardMode: 'warn',
    vocabulary: 'D:/memory/vocabulary.json',
    root: 'D:/memory',
    modelCacheDir: EMBEDDINGS_CACHE_DIR,
  })
  test('keeps every user choice, points engine and proxy at the install', () => {
    expect(launcherFor(layout, existing, false)).toEqual({
      store: 'D:/memory/store',
      cli: slashes(cliOf(layout.engine)),
      proxy: slashes(join(layout.plugin, 'bin', 'mcp-proxy.ts')),
      activity: '',
      embeddings: true,
      guardMode: 'warn',
      vocabulary: 'D:/memory/vocabulary.json',
      root: 'D:/memory',
      modelCacheDir: EMBEDDINGS_CACHE_DIR,
    })
  })
  test('the rewrite uses the current templates (0.27.2 clears MNEMOPI_OWNER_PER_CALL)', () => {
    expect(launcherText(launcherFor(layout, existing, false), true)).toContain('set "MNEMOPI_OWNER_PER_CALL="')
    expect(launcherText(launcherFor(layout, existing, false), false)).toContain('export MNEMOPI_OWNER_PER_CALL=\n')
  })
  test('no launcher yet: the default layout, embeddings from the marker', () => {
    expect(launcherFor(layout, undefined, true)).toMatchObject({ store: slashes(layout.store), activity: slashes(layout.activity), embeddings: true, guardMode: 'strict', root: slashes(layout.root) })
    expect(launcherFor(layout, undefined, false).embeddings).toBe(false)
  })
  test('sh launchers: quoted values and unset embeddings', () => {
    const sh = "#!/bin/sh\nexport MNEMOPI_DATA_DIR='/home/o'\\''neil/store'\nunset MNEMOPI_NO_EMBEDDINGS\nexport MNEMOSYNE_GUARD_MODE=strict\n"
    expect(parseLauncher(sh).values.get('MNEMOPI_DATA_DIR')).toBe("/home/o'neil/store")
    expect(launcherFor(layout, sh, false)).toMatchObject({ store: "/home/o'neil/store", embeddings: true })
  })
  test('rewriting a current launcher gives the same bytes, so no rewrite is planned', () => {
    const current = launcherText(launcherFor(layout, existing, false), true)
    expect(launcherText(launcherFor(layout, current, false), true)).toBe(current)
  })
})

describe('the plugin copy', () => {
  test('leaves out git, packages, tests and the engine tests', () => {
    for (const rel of ['', 'bin/mcp-proxy.ts', 'ui/server.ts', 'engine/src/cli.ts', '.claude-plugin/plugin.json', 'ui/vendor/x.js']) expect(pluginCopyIncludes(rel)).toBe(true)
    for (const rel of ['.git', '.git/config', 'node_modules', 'engine/node_modules/a', 'ui/node_modules/x', 'tests/bun/a.spec.ts', 'engine\\test\\a.ts']) expect(pluginCopyIncludes(rel)).toBe(false)
  })
})

describe('reading versions', () => {
  test('installed and source state from their files', () => {
    const { dir } = tempDir('update-read')
    const home = homeLayout(dir)
    mkdirSync(join(home.plugin, '.claude-plugin'), { recursive: true })
    writeFileSync(join(home.plugin, '.claude-plugin', 'plugin.json'), '{"version":"0.11.0"}')
    mkdirSync(join(home.engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi'), { recursive: true })
    writeFileSync(join(home.engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'package.json'), '{"version":"18.12.3-mnemosyne.11"}')
    expect(readInstalled(home)).toEqual({ pluginVersion: '0.11.0', engineBuild: '18.12.3-mnemosyne.11', launcherText: undefined })
    expect(readInstalled(homeLayout(join(dir, 'nobody')))).toEqual({ pluginVersion: undefined, engineBuild: undefined, launcherText: undefined })
    const repo = join(import.meta.dir, '..', '..')
    const self = readSource(repo)
    expect(self.hasUpdater).toBe(true)
    expect(self.pluginVersion).toBe(JSON.parse(readFileSync(join(repo, '.claude-plugin', 'plugin.json'), 'utf8')).version)
    expect(self.engineBuild).toBe(JSON.parse(readFileSync(join(repo, 'engine', 'package.json'), 'utf8')).version)
  })
})

describe('summary', () => {
  test('old -> new, unchanged parts said so', () => {
    const plan = { kind: 'update' as const, engine: false, plugin: true, launcher: true, stopChats: [], stopDashboard: [], notes: [] }
    const text = summary({ pluginVersion: '0.11.0', engineBuild: 'b12' }, { pluginVersion: '0.28.0', engineBuild: 'b12' }, plan)
    expect(text).toContain('plugin 0.11.0 -> 0.28.0')
    expect(text).toContain('engine b12 (unchanged)')
    expect(text).toContain('launcher rewritten')
  })
})

describe('the Windows shortcut scripts', () => {
  test('run the installed updater hidden, offer --stop-engines only after asking', () => {
    const script = shortcutScript(homeLayout("C:\\Users\\o'neil"), 'C:\\bun.exe')
    expect(script).toContain("$updater = 'C:\\Users\\o''neil\\.claude\\mnemosyne\\plugin\\bin\\update.ts'")
    expect(script).toContain(`if ($code -eq ${EXIT.blocked})`)
    expect(script).toContain("'YesNo'")
    expect(script).toContain("if ($answer -eq 'Yes') { & $PSCommandPath -StopEngines }")
    expect(script).toContain('"`r?`n"')
    expect(shortcutVbs()).toContain('update-mnemosyne.ps1""", 0, False')
  })
})

describe('stageRelease (fake runner and fetch, no network)', () => {
  test('with git: lists tags and clones the newest release', async () => {
    const { dir } = tempDir('update-stage')
    const calls: string[][] = []
    const runner: Runner = async argv => {
      calls.push(argv)
      if (argv[1] === 'ls-remote') return { stdout: 'a\trefs/tags/v0.9.0\nb\trefs/tags/v0.27.0\nc\trefs/tags/v0.28.0-rc1\n', stderr: '', exitCode: 0 }
      return { stdout: '', stderr: '', exitCode: 0 }
    }
    const fetcher = (() => {
      throw new Error('no network in tests')
    }) as unknown as typeof fetch
    expect(await stageRelease(join(dir, 'staging'), undefined, runner, fetcher)).toBe('v0.27.0')
    expect(calls.at(-1)).toEqual(['git', '-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', 'v0.27.0', 'https://github.com/Interstellar-code/claude-mnemosyne.git', join(dir, 'staging')])
  })
  test('with git and --tag: no listing', async () => {
    const { dir } = tempDir('update-stage')
    const calls: string[][] = []
    const runner: Runner = async argv => (calls.push(argv), { stdout: '', stderr: '', exitCode: 0 })
    expect(await stageRelease(join(dir, 'staging'), 'v0.20.0', runner)).toBe('v0.20.0')
    expect(calls.some(argv => argv[1] === 'ls-remote')).toBe(false)
  })
  test('a failed clone is an UpdateError naming the tag', async () => {
    const { dir } = tempDir('update-stage')
    const runner: Runner = async argv => ({ stdout: '', stderr: 'fatal: unreachable', exitCode: argv[1] === 'clone' || argv[3] === 'clone' ? 128 : 0 })
    await expect(stageRelease(join(dir, 'staging'), 'v0.20.0', runner)).rejects.toThrow('could not download v0.20.0: fatal: unreachable')
  })
  test('without git: the tags API, the tarball and tar', async () => {
    const { dir } = tempDir('update-stage')
    const staging = join(dir, 'staging')
    const urls: string[] = []
    const fetcher = (async (url: string) => {
      urls.push(url)
      if (url.includes('/tags?')) return Response.json([{ name: 'v0.26.1' }, { name: 'v0.27.0' }, { name: 'junk' }])
      return new Response(new Uint8Array([1, 2, 3]))
    }) as unknown as typeof fetch
    const calls: string[][] = []
    let tarballSeen = false
    const runner: Runner = async argv => {
      calls.push(argv)
      if (argv[0] === 'git') return { stdout: '', stderr: 'not found', exitCode: 127 }
      tarballSeen = existsSync(argv[2]!)
      return { stdout: '', stderr: '', exitCode: 0 }
    }
    expect(await stageRelease(staging, undefined, runner, fetcher)).toBe('v0.27.0')
    expect(urls[1]).toBe('https://codeload.github.com/Interstellar-code/claude-mnemosyne/tar.gz/refs/tags/v0.27.0')
    expect(calls.at(-1)).toEqual(['tar', '-xzf', `${staging}.tar.gz`, '-C', staging, '--strip-components=1'])
    expect(tarballSeen).toBe(true)
    expect(existsSync(`${staging}.tar.gz`)).toBe(false)
  })
})

describe('main refusals before anything runs', () => {
  test('no install under the home', async () => {
    const { dir } = tempDir('update-main')
    const error = await main(['--from', dir, '--home', join(dir, 'nobody')], () => {}).catch(e => e)
    expect(error).toBeInstanceOf(UpdateError)
    expect((error as UpdateError).message).toContain('no Mnemosyne install at')
    expect((error as UpdateError).code).toBe(EXIT.failed)
  })
  test('a source inside the install is refused', async () => {
    const { dir } = tempDir('update-main')
    const home = homeLayout(dir)
    mkdirSync(join(home.plugin, 'x'), { recursive: true })
    await expect(main(['--from', join(home.plugin, 'x'), '--home', dir], () => {})).rejects.toThrow('inside')
  })
})
