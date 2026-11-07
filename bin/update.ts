// Claude Mnemosyne — one-step update for machines that run Mnemosyne through
// Claude Desktop (or any MCP client) without Claude Code, where
// `claude plugin update` does not exist (issue #43).
//
//   bun bin/update.ts [--from <checkout>] [--tag vX.Y.Z] [--wait <seconds>]
//                     [--stop-engines] [--force] [--home <dir>]
//   bun bin/update.ts --install-shortcut      (Windows: the Start Menu entry only)
//
// 1. Without --from: finds the latest release tag (vX.Y.Z) on GitHub, stages it
//    in a folder of this run's own under <root>/update-staging (git clone, or
//    the release tarball and tar when git is missing) and runs the staged
//    copy's own update.ts on it, so the newest updater always does the work.
//    The run's folder is removed after; two runs never share one.
// 2. Plans: what is installed (the plugin copy's version, the engine's build,
//    the launcher text) against the source. Nothing changes when all match
//    (--force reinstalls), and an older source is refused (--force allows it).
// 3. On Windows a running engine or proxy keeps its files locked, so the swap
//    would fail: the updater names the Claude chats' MCP processes and stops.
//    --wait <s> waits for them to end; --stop-engines stops them (only then).
//    The always-on dashboard's own processes are stopped and restarted anyway.
// 4. Engine: bin/install-engine.ts install() (built next to it, checked, then
//    swapped). Plugin copy (<root>/plugin, the proxy and the dashboard): staged
//    in plugin.next and swapped the same way. Launcher (bin/mnemosyne-mcp.cmd):
//    rewritten with hooks/launcher.ts, keeping its store, activity log, guard
//    mode, vocabulary, root, model cache and embeddings values.
// 5. Restarts the "Mnemosyne dashboard" scheduled task (Windows) and prints
//    old -> new plugin version and engine build.
// It never writes the store, config.json, vocabulary.json or the activity log,
// holds <root>/engine.lock while it changes anything, and on failure leaves the
// old engine and plugin copy in place. Exit codes: 0 done or up to date, 1
// failure, 2 refused while engines run, 3 another install holds the lock.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { EMBEDDINGS_CACHE_DIR } from '../hooks/engine'
import { cmdWrapper, type LauncherOptions, shWrapper } from '../hooks/launcher'
import { slashes } from '../hooks/owner'
import { VOCAB_FILE } from '../hooks/vocab'
import { cliOf, install, isInside, LockBusy, lockTimingFromEnv, proxyClosure, windowsPathProblem, withInstallLock } from './install-engine'

export const REPO = 'Interstellar-code/claude-mnemosyne'
export const TASK_NAME = 'Mnemosyne dashboard'
export const SHORTCUT_NAME = 'Update Mnemosyne'
export const EXIT = { ok: 0, failed: 1, blocked: 2, busy: 3 } as const

export class UpdateError extends Error {
  constructor(
    message: string,
    readonly code: number = EXIT.failed,
  ) {
    super(message)
  }
}

// ---------------------------------------------------------------- arguments

export type UpdateOptions = {
  from?: string
  tag?: string
  waitSeconds: number
  stopEngines: boolean
  force: boolean
  home?: string
  installShortcut: boolean
  /** A JSON progress file (the dashboard's Update button reads it): state and the lines printed so far. */
  status?: string
}

export function parseArgs(argv: readonly string[]): UpdateOptions {
  const options: UpdateOptions = { waitSeconds: 0, stopEngines: false, force: false, installShortcut: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const value = () => {
      const next = argv[++i]
      if (next === undefined || next.startsWith('--')) throw new UpdateError(`${arg} needs a value`)
      return next
    }
    if (arg === '--from') options.from = value()
    else if (arg === '--tag') {
      const tag = value()
      if (!RELEASE_TAG.test(tag)) throw new UpdateError(`--tag must look like v1.2.3 (got "${tag}")`)
      options.tag = tag
    } else if (arg === '--wait') {
      const seconds = Number(value())
      if (!Number.isFinite(seconds) || seconds < 0) throw new UpdateError('--wait needs a number of seconds (0 or more)')
      options.waitSeconds = seconds
    } else if (arg === '--home') options.home = value()
    else if (arg === '--status') options.status = value()
    else if (arg === '--stop-engines') options.stopEngines = true
    else if (arg === '--force') options.force = true
    else if (arg === '--install-shortcut') options.installShortcut = true
    else throw new UpdateError(`unknown argument "${arg}" (usage: [--from <checkout>] [--tag vX.Y.Z] [--wait <s>] [--stop-engines] [--force] [--status <file>] [--install-shortcut])`)
  }
  if (options.from !== undefined && options.tag !== undefined) throw new UpdateError('--from and --tag cannot be used together')
  return options
}

// ---------------------------------------------------------------- layout

/** Every path the updater reads or writes under a home folder (the Claude Code plugin's layout). */
export function homeLayout(home: string, appData = process.env.APPDATA) {
  const root = join(home, '.claude', 'mnemosyne')
  const uiDir = join(home, '.claude', 'mnemosyne-ui')
  return {
    home,
    root,
    engine: join(root, 'engine'),
    plugin: join(root, 'plugin'),
    store: join(root, 'store'),
    launcher: join(root, 'bin', `mnemosyne-mcp${process.platform === 'win32' ? '.cmd' : ''}`),
    vocabulary: join(root, VOCAB_FILE),
    activity: join(root, 'activity.jsonl'),
    embeddingsMarker: join(root, 'embeddings.json'),
    lock: join(root, 'engine.lock'),
    staging: join(root, 'update-staging'),
    uiDir,
    startMenu: join(appData ?? join(home, 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  }
}
export type Layout = ReturnType<typeof homeLayout>

/** The dashboard's port and token for its restarted self (written by ui/update-routes.ts, read once by ui/server.ts). */
export const HANDOFF_FILE = 'ui-handoff.json'

/**
 * Replaces the launcher by rename, never in place: a running cmd.exe reads a batch
 * file line by line from its open handle, so rewriting it under that reader would
 * feed it a mix of old and new lines. True, or why it was not replaced (the old one is kept).
 */
export function writeLauncher(file: string, text: string): true | string {
  const temp = `${file}.${process.pid}.next`
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(temp, text, { mode: 0o700 })
    renameSync(temp, file)
    return true
  } catch (error) {
    rmSync(temp, { force: true })
    return (error as NodeJS.ErrnoException).code ?? (error as Error).message
  }
}

/** This run's own download folder under <root>/update-staging: unique per process and start time. */
export const runStagingDir = (staging: string, pid = process.pid, now = Date.now()) => join(staging, `run-${pid}-${now}`)

export const STAGING_STALE_MS = 24 * 60 * 60 * 1000

/** Removes run folders (and tarballs) a killed run left more than a day ago; a younger one may belong to a run still going. */
export function pruneStaging(staging: string, now = Date.now()) {
  let names: string[]
  try {
    names = readdirSync(staging)
  } catch {
    return 0
  }
  let removed = 0
  for (const name of names) {
    if (!/^run-\d+-\d+(\.tar\.gz)?$/.test(name)) continue
    const path = join(staging, name)
    try {
      if (now - statSync(path).mtimeMs < STAGING_STALE_MS) continue
      rmSync(path, { recursive: true, force: true })
      removed++
    } catch {
      // in use or gone: the next run tries again
    }
  }
  return removed
}

// ---------------------------------------------------------------- versions and tags

const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/

/** -1, 0 or 1; missing parts count as 0, a missing version is older than any. */
export function compareVersions(a: string | undefined, b: string | undefined) {
  if (a === b) return 0
  if (a === undefined) return -1
  if (b === undefined) return 1
  const parts = (v: string) => v.replace(/^v/, '').split(/[.-]/).map(p => (/^\d+$/.test(p) ? Number(p) : p))
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const [p, q] = [x[i] ?? 0, y[i] ?? 0]
    if (p === q) continue
    if (typeof p === 'number' && typeof q === 'number') return p < q ? -1 : 1
    return String(p) < String(q) ? -1 : 1
  }
  return 0
}

/** Tag names from `git ls-remote --tags` output (peeled ^{} lines dropped). */
export function parseLsRemoteTags(text: string) {
  return text
    .split('\n')
    .map(line => line.trim().split(/\s+/)[1] ?? '')
    .filter(ref => ref.startsWith('refs/tags/') && !ref.endsWith('^{}'))
    .map(ref => ref.slice('refs/tags/'.length))
}

/** The newest vX.Y.Z tag; anything else (v1.0.0-rc1, nightly) is ignored. */
export function latestReleaseTag(tags: readonly string[]) {
  return tags.filter(tag => RELEASE_TAG.test(tag)).sort(compareVersions).at(-1)
}

// ---------------------------------------------------------------- what is installed / offered

export type InstallState = { pluginVersion?: string; engineBuild?: string; launcherText?: string }
export type SourceState = { dir: string; pluginVersion?: string; engineBuild?: string; hasUpdater: boolean }

const readJson = (file: string): Record<string, unknown> | undefined => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}
const versionIn = (file: string) => {
  const version = readJson(file)?.version
  return typeof version === 'string' ? version : undefined
}

export function readInstalled(layout: Layout): InstallState {
  return {
    pluginVersion: versionIn(join(layout.plugin, '.claude-plugin', 'plugin.json')),
    engineBuild: versionIn(join(layout.engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'package.json')),
    launcherText: existsSync(layout.launcher) ? readFileSync(layout.launcher, 'utf8') : undefined,
  }
}

export function readSource(dir: string): SourceState {
  return {
    dir,
    pluginVersion: versionIn(join(dir, '.claude-plugin', 'plugin.json')),
    engineBuild: versionIn(join(dir, 'engine', 'package.json')),
    hasUpdater: existsSync(join(dir, 'bin', 'update.ts')),
  }
}

// ---------------------------------------------------------------- the launcher

/** The `set "K=V"` (cmd) or `export K=V` (sh) values of an existing launcher, plus `unset` names. */
export function parseLauncher(text: string) {
  const values = new Map<string, string>()
  const unset = new Set<string>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    let match = /^set "([A-Z_]+)=(.*)"$/.exec(line)
    if (match) {
      values.set(match[1]!, match[2]!)
      continue
    }
    match = /^export ([A-Z_]+)=(.*)$/.exec(line)
    if (match) {
      const value = match[2]!
      // Single-quoted by shellQuote ('\'' for a quote inside), or bare.
      values.set(match[1]!, value.startsWith("'") && value.endsWith("'") ? value.slice(1, -1).replace(/'\\''/g, "'") : value)
      continue
    }
    match = /^unset ([A-Z_]+)$/.exec(line)
    if (match) unset.add(match[1]!)
  }
  return { values, unset }
}

/**
 * The launcher this update writes: engine and proxy paths pointed at the
 * layout, every user choice (store, activity log, guard mode, vocabulary, root,
 * model cache, embeddings) kept from the existing one, defaults where it had none.
 */
export function launcherFor(layout: Layout, existing: string | undefined, embeddingsDefault: boolean): LauncherOptions {
  const { values, unset } = parseLauncher(existing ?? '')
  const keep = (key: string, fallback: string) => values.get(key) ?? fallback
  const noEmbeddings = values.get('MNEMOPI_NO_EMBEDDINGS')
  return {
    store: keep('MNEMOPI_DATA_DIR', slashes(layout.store)),
    cli: slashes(cliOf(layout.engine)),
    proxy: slashes(join(layout.plugin, 'bin', 'mcp-proxy.ts')),
    activity: keep('MNEMOSYNE_ACTIVITY_LOG', slashes(layout.activity)),
    embeddings: noEmbeddings !== undefined ? noEmbeddings === '' : unset.has('MNEMOPI_NO_EMBEDDINGS') ? true : embeddingsDefault,
    guardMode: keep('MNEMOSYNE_GUARD_MODE', 'strict'),
    vocabulary: keep('MNEMOSYNE_VOCABULARY', slashes(layout.vocabulary)),
    root: keep('MNEMOSYNE_ROOT', slashes(layout.root)),
    modelCacheDir: keep('PI_CONFIG_DIR', EMBEDDINGS_CACHE_DIR),
  }
}

export const launcherText = (options: LauncherOptions, windows = process.platform === 'win32') => (windows ? cmdWrapper(options) : shWrapper(options))

// ---------------------------------------------------------------- processes

export type Proc = { pid: number; ppid: number; command: string }
export type Classified = {
  /** MCP connections of Claude chats (or other clients): proxies and the engines they run. */
  chats: { proxy?: Proc; engines: Proc[] }[]
  /**
   * The always-on dashboard's whole tree: its keep-alive loop (run-ui.ps1), the cmd.exe of
   * start-ui.cmd (whose current folder is the plugin copy), the holder and server, and
   * everything below them (its engines).
   */
  dashboard: Proc[]
  /** Anything else whose command line names a file in the plugin copy or the engine folder. */
  others: Proc[]
}

/** Sorts running processes into chat connections, the dashboard's tree and other users of the install, by the layout's paths. */
export function classifyProcesses(processes: readonly Proc[], layout: Layout, windows = process.platform === 'win32'): Classified {
  const norm = (text: string) => {
    const s = text.replace(/\\/g, '/')
    return windows ? s.toLowerCase() : s
  }
  const engine = norm(cliOf(layout.engine))
  const proxy = norm(join(layout.plugin, 'bin', 'mcp-proxy.ts'))
  const server = norm(join(layout.plugin, 'ui', 'server.ts'))
  const loop = norm(join(layout.uiDir, 'run-ui.ps1'))
  const starter = norm(join(layout.uiDir, 'start-ui.cmd'))
  const inInstall = [`${norm(layout.plugin)}/`, `${norm(layout.engine)}/`]
  const byPid = new Map(processes.map(p => [p.pid, p]))
  const kind = (p: Proc) => {
    const c = norm(p.command)
    if (c.includes(server) || c.includes(loop) || c.includes(starter)) return 'dashboard'
    if (c.includes(proxy)) return 'proxy'
    if (c.includes(engine)) return 'engine'
    return undefined
  }
  const kinds = new Map(processes.map(p => [p.pid, kind(p)]))
  /** The nearest ancestor (or the process itself) that is a dashboard or proxy process. */
  const owner = (p: Proc, self: boolean) => {
    let current = self ? p : byPid.get(p.ppid)
    for (let depth = 0; current && depth < 64; depth++) {
      const k = kinds.get(current.pid)
      if (k === 'dashboard' || k === 'proxy') return current
      current = current.ppid === current.pid ? undefined : byPid.get(current.ppid)
    }
    return undefined
  }
  const dashboard: Proc[] = []
  const others: Proc[] = []
  const chats = new Map<number, { proxy?: Proc; engines: Proc[] }>()
  for (const p of processes) {
    const k = kinds.get(p.pid)
    const top = owner(p, true)
    // The dashboard's tree, whatever runs in it.
    if (top && kinds.get(top.pid) === 'dashboard') dashboard.push(p)
    else if (k === 'proxy') {
      const chat = chats.get(p.pid) ?? { engines: [] }
      chat.proxy = p
      chats.set(p.pid, chat)
    } else if (k === 'engine') {
      // An engine under a proxy joins that proxy's connection; one with no proxy is a connection of its own.
      const parent = owner(p, false)
      const key = parent?.pid ?? -p.pid
      const chat = chats.get(key) ?? { engines: [] }
      chat.engines.push(p)
      chats.set(key, chat)
    } else if (top === undefined) {
      const c = norm(p.command)
      // The updater itself (and its Start Menu script) only reads its files; Bun keeps no handle on them.
      if (inInstall.some(path => c.includes(path)) && !c.includes('/bin/update.ts') && !c.includes('update-mnemosyne.ps1')) others.push(p)
    }
  }
  return { chats: [...chats.values()], dashboard, others }
}

export const chatPids = (classified: Classified) => classified.chats.flatMap(chat => [...(chat.proxy ? [chat.proxy.pid] : []), ...chat.engines.map(e => e.pid)])

/** A process's program name from its command line, for people: "bun.exe", "cmd.exe". */
const programOf = (command: string) => (/^"([^"]+)"|^(\S+)/.exec(command.trim())?.slice(1).find(Boolean) ?? '?').split(/[\\/]/).pop()!

/**
 * The text for a swap Windows refused: what was found using the install (chat
 * connections, dashboard processes that are still up, other programs), what is
 * installed now, and the ways out. Said only after a swap failed, never
 * predicted: a running engine does not always lock its folder.
 */
export function lockedMessage(classified: Classified, unchanged: boolean, folder = "Mnemosyne's files") {
  const n = classified.chats.length
  const lines: string[] = [`Windows would not let the update replace ${folder}: a program has a file or the folder open.`]
  if (n > 0) {
    lines.push(`${n === 1 ? 'A Claude chat uses' : 'Claude chats use'} Mnemosyne (${n} MCP connection${n === 1 ? '' : 's'} running) and may be holding it:`)
    for (const chat of classified.chats) {
      const engines = chat.engines.map(e => e.pid).join(', ')
      lines.push(chat.proxy ? `  proxy pid ${chat.proxy.pid}${engines ? ` with engine pid ${engines}` : ''}` : `  engine pid ${engines}`)
    }
  }
  if (classified.dashboard.length > 0) lines.push(`Dashboard processes still running: ${classified.dashboard.map(p => `${programOf(p.command)} ${p.pid}`).join(', ')}`)
  if (classified.others.length > 0) lines.push(`Other programs using the install: ${classified.others.map(p => `${programOf(p.command)} ${p.pid}`).join(', ')}`)
  if (n === 0 && classified.dashboard.length === 0 && classified.others.length === 0) {
    lines.push('No Mnemosyne process was found, so another program probably has it open: an Explorer window, an editor or a terminal opened in that folder.')
  }
  lines.push(unchanged ? 'Nothing was changed; the previous version keeps working.' : 'Part of the update is in place; see the versions below.')
  if (n > 0) {
    lines.push('Quit Claude Desktop (and any other app using Mnemosyne), then update again.')
    lines.push('From a terminal, --wait 600 waits up to 10 minutes for them to end, and --stop-engines stops them first (open chats lose Mnemosyne until the app is restarted).')
  } else lines.push('Close what holds it, then update again.')
  return lines.join('\n')
}

/** The folder a swap error names, for the message: the engine or the plugin copy. */
export const swapFolder = (error: unknown, layout: Layout) => (/new plugin copy/.test((error as Error)?.message ?? '') ? layout.plugin : layout.engine)

/** True for the error of a swap that a running process prevented (a rename refused), not for a failed build or check. */
export const isSwapFailure = (error: unknown) => /could not move the new (engine|plugin copy) into place/.test((error as Error)?.message ?? '')

// ---------------------------------------------------------------- the plan

export type Plan =
  | { kind: 'up-to-date'; message: string }
  | { kind: 'refused'; code: number; message: string }
  | { kind: 'update'; engine: boolean; plugin: boolean; launcher: boolean; stopChats: number[]; stopDashboard: Proc[]; notes: string[] }

export function planUpdate(input: {
  installed: InstallState
  source: SourceState
  expectedLauncher: string
  processes: Classified
  windows: boolean
  force: boolean
  stopEngines: boolean
}): Plan {
  const { installed, source, processes, windows, force } = input
  if (source.engineBuild === undefined) return { kind: 'refused', code: EXIT.failed, message: `${source.dir} has no engine/package.json; it is not a claude-mnemosyne checkout` }
  if (source.pluginVersion === undefined) return { kind: 'refused', code: EXIT.failed, message: `${source.dir} has no .claude-plugin/plugin.json; it is not a claude-mnemosyne checkout` }
  if (!force && compareVersions(source.pluginVersion, installed.pluginVersion) < 0) {
    return { kind: 'refused', code: EXIT.failed, message: `the installed plugin ${installed.pluginVersion} is newer than ${source.pluginVersion}; nothing was changed (--force installs the older one)` }
  }
  const engine = force || installed.engineBuild !== source.engineBuild
  const plugin = force || installed.pluginVersion !== source.pluginVersion
  const launcher = force || installed.launcherText !== input.expectedLauncher
  if (!engine && !plugin && !launcher) {
    return { kind: 'up-to-date', message: `Mnemosyne is up to date: plugin ${installed.pluginVersion}, engine ${installed.engineBuild}.` }
  }
  const swaps = engine || plugin
  const notes: string[] = []
  let stopChats: number[] = []
  // Running chats never refuse the plan: a running engine does not always lock its folder on Windows,
  // so the swap is tried and a refused one is reported (lockedMessage). Processes are stopped only with --stop-engines.
  if (swaps && processes.chats.length > 0) {
    if (input.stopEngines) stopChats = chatPids(processes)
    else notes.push(`${processes.chats.length} running MCP connection(s) keep the old version until their app is restarted.`)
  }
  // The dashboard holds the plugin folder and runs its own engine: on Windows it is stopped for the swap and restarted after.
  const stopDashboard = swaps && windows ? processes.dashboard : []
  return { kind: 'update', engine, plugin, launcher, stopChats, stopDashboard, notes }
}

/** What changed, old -> new, for the closing message. */
export function summary(before: InstallState, after: InstallState, plan: Extract<Plan, { kind: 'update' }>) {
  const change = (what: string, a: string | undefined, b: string | undefined) => (a === b ? `${what} ${b} (unchanged)` : `${what} ${a ?? 'none'} -> ${b}`)
  return [
    'Mnemosyne updated:',
    `  ${change('plugin', before.pluginVersion, after.pluginVersion)}`,
    `  ${change('engine', before.engineBuild, after.engineBuild)}`,
    ...(plan.launcher ? ['  launcher rewritten'] : []),
    ...plan.notes.map(note => `  ${note}`),
  ].join('\n')
}

// ---------------------------------------------------------------- the plugin copy

/** Which checkout files go into <root>/plugin: everything but git, packages, tests and the engine's tests. */
export function pluginCopyIncludes(rel: string) {
  const parts = rel.split(/[\\/]/).filter(Boolean)
  if (parts.length === 0) return true
  if (parts.includes('node_modules')) return false
  if (parts[0] === '.git' || parts[0] === 'tests') return false
  if (parts[0] === 'engine' && parts[1] === 'test') return false
  return true
}

/** Files a plugin copy cannot work without: the proxy, the updater, the dashboard, the launcher code, the engine copy's manifest. */
export const REQUIRED_PLUGIN_FILES = [
  '.claude-plugin/plugin.json',
  'bin/mcp-proxy.ts',
  'bin/update.ts',
  'bin/install-engine.ts',
  'hooks/launcher.ts',
  'ui/server.ts',
  'ui/index.html',
  'ui/app.ts',
  'ui/style.css',
  'engine/package.json',
]

/** Every regular file under `dir` that `include` keeps, as forward-slash relative paths with sizes. */
export function fileList(dir: string, include: (rel: string) => boolean = () => true): Map<string, number> {
  const files = new Map<string, number>()
  const walk = (rel: string) => {
    for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name
      if (!include(child)) continue
      if (entry.isDirectory()) walk(child)
      else if (entry.isFile()) files.set(child, statSync(join(dir, child)).size)
    }
  }
  walk('')
  return files
}

/**
 * Why a staged plugin copy must not be swapped in, or an empty list: a required
 * file missing, a file of the source missing or of another size in the copy,
 * a version other than the one planned, or a proxy whose imports do not resolve.
 */
export function pluginCopyProblems(source: string, copy: string, version: string | undefined): string[] {
  const problems: string[] = []
  for (const rel of REQUIRED_PLUGIN_FILES) if (!existsSync(join(source, rel))) problems.push(`the source has no ${rel}`)
  const want = fileList(source, pluginCopyIncludes)
  const have = fileList(copy)
  for (const [rel, size] of want) {
    if (!have.has(rel)) problems.push(`${rel} was not copied`)
    else if (have.get(rel) !== size) problems.push(`${rel} differs from the source`)
  }
  const copied = versionIn(join(copy, '.claude-plugin', 'plugin.json'))
  if (copied !== version) problems.push(`the copy is version ${copied ?? 'none'}, expected ${version ?? 'none'}`)
  try {
    proxyClosure(copy)
  } catch (error) {
    problems.push((error as Error).message)
  }
  return problems.slice(0, 10)
}

function stagePlugin(source: string, layout: Layout, version: string | undefined) {
  const next = `${layout.plugin}.next`
  rmSync(next, { recursive: true, force: true })
  cpSync(source, next, { recursive: true, filter: path => pluginCopyIncludes(relative(source, path)) })
  const problems = pluginCopyProblems(source, next, version)
  if (problems.length > 0) {
    rmSync(next, { recursive: true, force: true })
    throw new UpdateError(`the staged plugin copy is incomplete, nothing was changed: ${problems.join('; ')}`)
  }
  return next
}

function swapPlugin(layout: Layout) {
  const next = `${layout.plugin}.next`
  const old = `${layout.plugin}.old`
  const had = existsSync(layout.plugin)
  try {
    rmSync(old, { recursive: true, force: true })
    if (had) renameSync(layout.plugin, old)
    renameSync(next, layout.plugin)
  } catch (error) {
    try {
      if (had && !existsSync(layout.plugin) && existsSync(old)) renameSync(old, layout.plugin)
    } finally {
      rmSync(next, { recursive: true, force: true })
    }
    throw new UpdateError(`could not move the new plugin copy into place (the old one is kept): ${(error as Error).message}`)
  }
  try {
    rmSync(old, { recursive: true, force: true })
  } catch {
    // The new copy is in place; a leftover plugin.old goes at the next update.
  }
}

// ---------------------------------------------------------------- the Windows shortcut

const psQuote = (text: string) => `'${text.replace(/'/g, "''")}'`

/** update-mnemosyne.ps1: runs the update hidden and shows the result in a message box. */
export function shortcutScript(layout: Layout, bun: string) {
  return `# Updates Mnemosyne (Claude Desktop, no Claude Code) and shows the result.
# Written by bin/update.ts; the Start Menu entry "${SHORTCUT_NAME}" runs it through update-mnemosyne.vbs, with no window.
param([switch]$StopEngines)
$updater = ${psQuote(join(layout.plugin, 'bin', 'update.ts'))}
$bun = ${psQuote(bun)}
if (-not (Test-Path $bun)) { $bun = 'bun' }
$log = Join-Path $PSScriptRoot 'update.log'
Set-Location $PSScriptRoot
Add-Type -AssemblyName PresentationFramework
$arguments = @($updater)
if ($StopEngines) { $arguments += '--stop-engines' }
$output = & $bun @arguments 2>&1 | Out-String
$code = $LASTEXITCODE
Set-Content -Path $log -Value $output -Encoding utf8
$text = ($output.Trim() -split "\`r?\`n" | Select-Object -Last 14) -join "\`n"
if ($code -eq ${EXIT.blocked}) {
  $answer = [System.Windows.MessageBox]::Show("$text\`n\`nStop these Mnemosyne processes now and update? Open chats lose Mnemosyne until Claude is restarted.", '${SHORTCUT_NAME}', 'YesNo', 'Warning')
  if ($answer -eq 'Yes') { & $PSCommandPath -StopEngines }
  exit
}
$icon = if ($code -eq 0) { 'Information' } else { 'Error' }
[System.Windows.MessageBox]::Show("$text\`n\`nFull log: $log", '${SHORTCUT_NAME}', 'OK', $icon) | Out-Null
`
}

/** update-mnemosyne.vbs: starts the script with no console window, as open-dashboard.vbs does. */
export const shortcutVbs = () => `' Runs update-mnemosyne.ps1 (the Mnemosyne update) with no console window. Written by bin/update.ts.
Dim sh, dir
Set sh = CreateObject("WScript.Shell")
dir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\\update-mnemosyne.ps1""", 0, False
`

async function installShortcut(layout: Layout, run: Runner) {
  mkdirSync(layout.uiDir, { recursive: true })
  const bun = join(layout.home, '.bun', 'bin', 'bun.exe')
  writeFileSync(join(layout.uiDir, 'update-mnemosyne.ps1'), shortcutScript(layout, existsSync(bun) ? bun : process.execPath).replace(/\r?\n/g, '\r\n'))
  writeFileSync(join(layout.uiDir, 'update-mnemosyne.vbs'), shortcutVbs().replace(/\r?\n/g, '\r\n'))
  const link = join(layout.startMenu, `${SHORTCUT_NAME}.lnk`)
  const vbs = join(layout.uiDir, 'update-mnemosyne.vbs')
  const ps = [
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${psQuote(link)})`,
    `$s.TargetPath = Join-Path $env:SystemRoot 'System32\\wscript.exe'`,
    `$s.Arguments = ${psQuote(`//B //Nologo "${vbs}"`)}`,
    `$s.WorkingDirectory = ${psQuote(layout.uiDir)}`,
    `$s.Description = 'Update the Mnemosyne memory engine and dashboard'`,
    '$s.Save()',
  ].join('; ')
  const done = await run(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', ps])
  if (done.exitCode !== 0) throw new UpdateError(`could not write the Start Menu shortcut: ${done.stderr.trim()}`)
  return link
}

// ---------------------------------------------------------------- the progress file

export type UpdateState = 'starting' | 'running' | 'done' | 'failed' | 'blocked'
// pid: the updater process that wrote last (absent while the server has only asked for a start), so a run that died can be told from one that is slow.
export type UpdateStatus = { state: UpdateState; lines: string[]; code?: number; pid?: number; started: string; updated: string }
export const FINAL_STATES: readonly UpdateState[] = ['done', 'failed', 'blocked']
const MAX_STATUS_LINES = 200
const isFinal = (state: UpdateState | undefined) => state !== undefined && FINAL_STATES.includes(state)

export function readStatus(file: string): UpdateStatus | undefined {
  const value = readJson(file) as UpdateStatus | undefined
  return value && typeof value.state === 'string' && Array.isArray(value.lines) ? value : undefined
}

/**
 * The next progress file: lines appended (the last 200 kept), the state moved on.
 * A final state is never replaced by another final one, so the staging parent
 * keeps the result its child (the release's own updater) wrote.
 */
export function nextStatus(current: UpdateStatus | undefined, change: { state?: UpdateState; lines?: readonly string[]; code?: number; pid?: number }, now = new Date()): UpdateStatus | undefined {
  if (isFinal(current?.state) && isFinal(change.state)) return undefined
  const stamp = now.toISOString()
  const lines = [...(current?.lines ?? []), ...(change.lines ?? [])].slice(-MAX_STATUS_LINES)
  const state: UpdateState = change.state ?? (current === undefined || !isFinal(current.state) ? 'running' : current.state)
  const pid = change.pid ?? current?.pid
  return { state, lines, ...(change.code === undefined ? {} : { code: change.code }), ...(pid === undefined ? {} : { pid }), started: current?.started ?? stamp, updated: stamp }
}

export function writeStatus(file: string, change: { state?: UpdateState; lines?: readonly string[]; code?: number }) {
  try {
    const next = nextStatus(readStatus(file), { ...change, pid: process.pid })
    if (next === undefined) return
    const temp = `${file}.${process.pid}.tmp`
    writeFileSync(temp, `${JSON.stringify(next)}\n`, { mode: 0o600 })
    renameSync(temp, file)
  } catch {
    // Progress is a convenience: the update goes on without it.
  }
}

// ---------------------------------------------------------------- side effects

export type Runner = (argv: string[], options?: { cwd?: string; timeoutMs?: number }) => Promise<{ stdout: string; stderr: string; exitCode: number }>

const run: Runner = async (argv, options = {}) => {
  let child: ReturnType<typeof Bun.spawn>
  try {
    child = Bun.spawn(argv, { cwd: options.cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', windowsHide: true })
  } catch (error) {
    return { stdout: '', stderr: (error as Error).message, exitCode: 127 }
  }
  const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 120_000)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout as ReadableStream).text(), new Response(child.stderr as ReadableStream).text(), child.exited])
    return { stdout, stderr, exitCode }
  } finally {
    clearTimeout(timer)
  }
}

/** Parses `ps -axo pid=,ppid=,args=` or the PowerShell JSON list into processes. */
export function parseProcessList(text: string, windows: boolean): Proc[] {
  if (windows) {
    if (text.trim() === '') return []
    const parsed = JSON.parse(text) as unknown
    const list = (Array.isArray(parsed) ? parsed : [parsed]) as { ProcessId?: number; ParentProcessId?: number; CommandLine?: string | null }[]
    return list.filter(p => typeof p.ProcessId === 'number').map(p => ({ pid: p.ProcessId!, ppid: p.ParentProcessId ?? 0, command: p.CommandLine ?? '' }))
  }
  return text
    .split('\n')
    .map(line => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(m => ({ pid: Number(m[1]), ppid: Number(m[2]), command: m[3]! }))
}

async function listProcesses(runner: Runner): Promise<Proc[]> {
  const windows = process.platform === 'win32'
  const done = windows
    ? await runner([
        'powershell.exe',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        // Every process with a command line: after a refused swap, any program naming the install may be what holds it.
        'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress',
      ])
    : await runner(['ps', '-axo', 'pid=,ppid=,args='])
  if (done.exitCode !== 0) throw new UpdateError(`could not list running processes: ${done.stderr.trim()}`)
  return parseProcessList(done.stdout, windows).filter(p => p.pid !== process.pid)
}

async function stopProcesses(pids: readonly number[], runner: Runner) {
  for (const pid of pids) {
    try {
      process.kill(pid)
    } catch {
      // already gone
    }
  }
  // Wait until they are gone, so their file handles are released before the swap.
  for (let i = 0; i < 20; i++) {
    const alive = new Set((await listProcesses(runner)).map(p => p.pid))
    if (!pids.some(pid => alive.has(pid))) return
    await Bun.sleep(500)
  }
  throw new UpdateError(`processes ${pids.join(', ')} did not stop`)
}

async function taskExists(runner: Runner) {
  return (await runner(['schtasks.exe', '/Query', '/TN', TASK_NAME])).exitCode === 0
}

/** Starts the always-on dashboard again through its scheduled task (the loop starts the server, hidden). */
async function restartDashboard(layout: Layout, runner: Runner, wasRunning: boolean) {
  if (process.platform !== 'win32') return wasRunning ? 'The dashboard was not restarted; start it again with /mnemosyne-ui.' : ''
  if (!(await taskExists(runner))) return wasRunning ? `The dashboard was stopped; no "${TASK_NAME}" task to restart it, so start it again yourself.` : ''
  const done = await runner(['schtasks.exe', '/Run', '/TN', TASK_NAME])
  if (done.exitCode !== 0) return `Could not start the "${TASK_NAME}" task: ${done.stderr.trim()}`
  for (let i = 0; i < 30; i++) {
    if (classifyProcesses(await listProcesses(runner), layout).dashboard.some(p => p.command.toLowerCase().includes('server.ts'))) return 'Dashboard restarted.'
    await Bun.sleep(1000)
  }
  return `The "${TASK_NAME}" task was started, but no dashboard process appeared within 30 seconds; see ${join(layout.uiDir, 'ui-service.log')}.`
}

/** Stages the latest (or the given) release tag in `dir`: git when it is installed, else the GitHub tarball and tar. */
export async function stageRelease(dir: string, tag: string | undefined, runner: Runner = run, fetcher: typeof fetch = fetch) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dirname(dir), { recursive: true })
  const url = `https://github.com/${REPO}.git`
  const git = (await runner(['git', '--version'])).exitCode === 0
  if (git) {
    if (tag === undefined) {
      const listed = await runner(['git', 'ls-remote', '--tags', '--refs', url], { timeoutMs: 60_000 })
      if (listed.exitCode !== 0) throw new UpdateError(`could not list the releases at ${url}: ${listed.stderr.trim()}`)
      tag = latestReleaseTag(parseLsRemoteTags(listed.stdout))
      if (tag === undefined) throw new UpdateError(`${url} has no vX.Y.Z release tag`)
    }
    const cloned = await runner(['git', '-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', tag, url, dir], { timeoutMs: 300_000 })
    if (cloned.exitCode !== 0) throw new UpdateError(`could not download ${tag}: ${cloned.stderr.trim()}`)
    return tag
  }
  if (tag === undefined) {
    const reply = await fetcher(`https://api.github.com/repos/${REPO}/tags?per_page=100`, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'claude-mnemosyne-update' } })
    if (!reply.ok) throw new UpdateError(`could not list the releases (GitHub answered ${reply.status}); install Git or pass --from <checkout>`)
    tag = latestReleaseTag(((await reply.json()) as { name: string }[]).map(t => t.name))
    if (tag === undefined) throw new UpdateError(`${REPO} has no vX.Y.Z release tag`)
  }
  const tarball = `${dir}.tar.gz`
  const download = await fetcher(`https://codeload.github.com/${REPO}/tar.gz/refs/tags/${tag}`)
  if (!download.ok) throw new UpdateError(`could not download ${tag} (GitHub answered ${download.status})`)
  writeFileSync(tarball, new Uint8Array(await download.arrayBuffer()))
  mkdirSync(dir)
  try {
    const unpacked = await runner(['tar', '-xzf', tarball, '-C', dir, '--strip-components=1'], { timeoutMs: 120_000 })
    if (unpacked.exitCode !== 0) throw new UpdateError(`could not unpack ${tag}: ${unpacked.stderr.trim()}`)
  } finally {
    rmSync(tarball, { force: true })
  }
  return tag
}

// ---------------------------------------------------------------- main

export async function main(argv: readonly string[], log: (line: string) => void = console.log): Promise<number> {
  const options = parseArgs(argv)
  const windows = process.platform === 'win32'
  const layout = homeLayout(resolve(options.home ?? homedir()))
  if (windows) {
    const problem = windowsPathProblem(Object.values(layout))
    if (problem) throw new UpdateError(problem)
  }
  if (options.installShortcut) {
    if (!windows) throw new UpdateError('--install-shortcut is for Windows (the Start Menu)')
    log(`Start Menu shortcut written: ${await installShortcut(layout, run)}`)
    return EXIT.ok
  }
  if (!existsSync(layout.root)) throw new UpdateError(`no Mnemosyne install at ${layout.root}; install it first (README: Install outside Claude Code)`)
  // 1. No checkout given: stage the release, then let its own updater do the rest,
  // so the newest update logic runs (and none of it runs from the plugin copy it replaces).
  if (options.from === undefined) {
    log(options.tag ? `Downloading ${options.tag} ...` : 'Looking for the latest release ...')
    process.chdir(layout.root)
    // A folder of this run's own: two runs at once (the Start Menu entry and the dashboard button, a
    // double click) never download into, read from or delete each other's tree. The changes themselves
    // happen in the staged updater, under engine.lock.
    pruneStaging(layout.staging)
    const staged = runStagingDir(layout.staging)
    try {
      const tag = await stageRelease(staged, options.tag)
      if (!readSource(staged).hasUpdater) throw new UpdateError(`${tag} is older than this updater (it has no bin/update.ts); nothing was changed`)
      log(`Updating to ${tag} ...`)
      const rest = argv.filter((arg, i) => arg !== '--tag' && argv[i - 1] !== '--tag')
      const child = Bun.spawn([process.execPath, join(staged, 'bin', 'update.ts'), '--from', staged, ...rest], { cwd: layout.root, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true })
      return await child.exited
    } finally {
      rmSync(staged, { recursive: true, force: true })
      rmSync(`${staged}.tar.gz`, { force: true })
    }
  }
  const sourceDir = resolve(options.from)
  for (const folder of [layout.engine, layout.plugin, `${layout.plugin}.next`, `${layout.plugin}.old`]) {
    if (isInside(sourceDir, folder)) throw new UpdateError(`the source ${sourceDir} is inside ${folder}; pass a checkout outside the install`)
  }

  return withInstallLock(
    layout.lock,
    async () => {
      // Read under the lock: what is installed and what is offered are what this run acts on.
      const source = readSource(sourceDir)
      const before = readInstalled(layout)
      const launcher = launcherFor(layout, before.launcherText, existsSync(layout.embeddingsMarker))
      if (windows) {
        const problem = windowsPathProblem([launcher.store, launcher.activity, launcher.vocabulary, launcher.root, launcher.modelCacheDir])
        if (problem) throw new UpdateError(problem)
      }
      // The store the launcher serves (memoryDir may move it): neither swap may ever contain it.
      const store = resolve(launcher.store)
      for (const folder of [layout.plugin, `${layout.plugin}.next`, `${layout.plugin}.old`]) {
        if (isInside(store, folder)) throw new UpdateError(`the store ${store} is inside ${folder}; refusing to update`)
      }
      const expectedLauncher = launcherText(launcher, windows)
      const deadline = Date.now() + options.waitSeconds * 1000
      let processes = classifyProcesses(await listProcesses(run), layout, windows)
      // --wait: give running chats time to end before the swap is tried (it may well succeed while they run).
      if (options.waitSeconds > 0 && processes.chats.length > 0 && !options.stopEngines) {
        log(`${processes.chats.length} Mnemosyne MCP connection(s) running; waiting up to ${options.waitSeconds} s for them to end ...`)
        while (processes.chats.length > 0 && Date.now() < deadline) {
          await Bun.sleep(3000)
          processes = classifyProcesses(await listProcesses(run), layout, windows)
        }
      }
      const plan = planUpdate({ installed: before, source, expectedLauncher, processes, windows, force: options.force, stopEngines: options.stopEngines })
      if (plan.kind === 'refused') throw new UpdateError(plan.message, plan.code)
      if (plan.kind === 'up-to-date') {
        log(plan.message)
        if (windows && !existsSync(join(layout.startMenu, `${SHORTCUT_NAME}.lnk`))) log(`Start Menu shortcut: ${await installShortcut(layout, run)}`)
        return EXIT.ok
      }

      if (plan.stopChats.length > 0) {
        log(`Stopping ${plan.stopChats.length} Mnemosyne MCP process(es) (--stop-engines): ${plan.stopChats.join(', ')}`)
        await stopProcesses(plan.stopChats, run)
      }
      if (plan.plugin) stagePlugin(sourceDir, layout, source.pluginVersion)
      let dashboardStopped = false
      // The dashboard is stopped as late as possible (after the new engine passed its check), so an
      // update started from its Update button keeps showing progress through the long build.
      const stopDashboard = async () => {
        if (dashboardStopped || plan.stopDashboard.length === 0) return
        dashboardStopped = true
        log('Stopping the dashboard for the swap ...')
        await stopProcesses(plan.stopDashboard.map(p => p.pid), run)
      }
      const messages: string[] = []
      try {
        if (plan.engine) {
          log(`Installing engine ${source.engineBuild} (this takes a few minutes) ...`)
          await install(sourceDir, layout.engine, store, launcher.embeddings, undefined, { beforeSwap: stopDashboard })
          log(`Engine ${source.engineBuild} is in place.`)
        }
        if (plan.plugin) {
          await stopDashboard()
          swapPlugin(layout)
          log(`Plugin copy ${source.pluginVersion} is in place.`)
        }
        if (plan.launcher) {
          const written = writeLauncher(layout.launcher, expectedLauncher)
          if (written !== true) messages.push(`The launcher was not rewritten (${written}); the old one keeps working. Run the update again once Claude Desktop is closed.`)
        }
      } catch (error) {
        rmSync(`${layout.plugin}.next`, { recursive: true, force: true })
        const after = readInstalled(layout)
        const unchanged = after.pluginVersion === before.pluginVersion && after.engineBuild === before.engineBuild
        const state = `Installed now: plugin ${after.pluginVersion ?? 'none'}, engine ${after.engineBuild ?? 'none'}.`
        if (windows && isSwapFailure(error)) {
          // Detected, not predicted: what holds the folder is looked up only after Windows refused the swap.
          const holding = classifyProcesses(await listProcesses(run).catch(() => []), layout, windows)
          throw new UpdateError(`${lockedMessage(holding, unchanged, swapFolder(error, layout))}\nDetail: ${(error as Error).message}\n${state}`, EXIT.blocked)
        }
        throw new UpdateError(`update failed: ${(error as Error).message}\n${state}`)
      } finally {
        if (windows && (plan.engine || plan.plugin)) {
          const restarted = await restartDashboard(layout, run, dashboardStopped)
          if (restarted) log(restarted)
        }
        // A dashboard that was never stopped keeps its own port and token: the handoff it left is of no use.
        if (!dashboardStopped) rmSync(join(layout.root, HANDOFF_FILE), { force: true })
      }
      if (windows) {
        try {
          messages.push(`Start Menu shortcut: ${await installShortcut(layout, run)}`)
        } catch (error) {
          messages.push((error as Error).message)
        }
      }
      log(summary(before, readInstalled(layout), plan))
      for (const message of messages) log(message)
      log('Restart Claude Desktop (and other MCP clients) to use the new version.')
      return EXIT.ok
    },
    lockTimingFromEnv(process.env.MNEMOSYNE_LOCK_WAIT_MS),
  )
}

if (import.meta.main) {
  const argv = process.argv.slice(2)
  // --status is read before the full parse, so even a bad argument reaches the progress file.
  const at = argv.indexOf('--status')
  const status = at >= 0 ? argv[at + 1] : undefined
  const log = (line: string) => {
    console.log(line)
    if (status) writeStatus(status, { lines: line.split('\n') })
  }
  try {
    const code = await main(argv, log)
    if (status) writeStatus(status, { state: code === EXIT.ok ? 'done' : code === EXIT.blocked ? 'blocked' : 'failed', code })
    process.exit(code)
  } catch (error) {
    const code = error instanceof LockBusy ? EXIT.busy : error instanceof UpdateError ? error.code : EXIT.failed
    const lines = [`update: ${(error as Error).message}`, ...(code === EXIT.failed ? ['The previous install is unchanged unless the lines above say otherwise.'] : [])]
    for (const line of lines) console.error(line)
    if (status) writeStatus(status, { state: code === EXIT.blocked ? 'blocked' : 'failed', code, lines: lines.join('\n').split('\n') })
    process.exit(code)
  }
}

