// Claude Mnemosyne — installs the plugin's own engine copy (engine/) into the
// engine folder, without ever removing a working engine first.
//
//   bun bin/install-engine.ts <plugin root> <engine dir> <store dir> [embeddings]
//   bun bin/install-engine.ts --root <abs dir> [--store <abs dir>] [--embeddings]
//
// The second form installs outside Claude Code, everything under one root (for
// Switch): see installRoot below. Both forms hold <engine dir>.lock while they
// run (the only file written beside the engine folder); a second install waits
// for it up to LOCK_WAIT_MS, then exits 3 with `another install holds <path>`.
//
// 1. Builds <engine dir>.next: engine/ (no node_modules, no test) copied whole
//    to <engine dir>.next/pi-mnemopi, a package.json naming it as
//    @oh-my-pi/pi-mnemopi = file:./pi-mnemopi, then `bun install` there
//    (production, no peers).
// 2. Checks the new cli answers initialize and tools/list with our build's
//    mnemopi_update.
// 3. Only then renames <engine dir> to <engine dir>.old, <engine dir>.next to
//    <engine dir>, and deletes <engine dir>.old.
// On any failure it deletes <engine dir>.next, leaves <engine dir> as it was
// and exits 1 with the reason. It writes nothing outside the three folders,
// and refuses a store inside any of them, compared as real paths (symlinks
// followed, case-folded on macOS and Windows). The cli path stays
// <engine dir>/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts.
import { chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { Database } from 'bun:sqlite'
import { EMBEDDINGS_CACHE_DIR, EMBEDDINGS_MODEL } from '../hooks/engine'
import { INSTALL_CHECK_TIMEOUT_MS, INSTALL_LOCK_WAIT_MS, INSTALL_STEP_TIMEOUT_MS } from '../hooks/engine-build'
import { cmdWrapper, shWrapper } from '../hooks/launcher'
import { slashes } from '../hooks/owner'
import { configText, emptyConfig } from '../hooks/settings'
import { VOCAB_FILE } from '../hooks/vocab'
import { takeLock } from './lockfile'
import { configFile } from './settings'
import { initVocabulary } from './vocab'

const PACKAGE = '@oh-my-pi/pi-mnemopi'
// The default file systems of macOS and Windows ignore case: Engine/ is engine/.
const FOLDS_CASE = process.platform === 'darwin' || process.platform === 'win32'
const IS_WINDOWS = process.platform === 'win32'

class InstallError extends Error {}
/** Another install held the lock for the whole wait: the CLI exits 3. */
export class LockBusy extends InstallError {}

/**
 * The real path of `path`: the nearest part that exists, symlinks followed
 * (a dangling link by its target), plus the parts that do not exist yet.
 * Case-folded where the file system ignores case.
 */
export function canonical(path: string, depth = 0): string {
  let current = resolve(path)
  const rest: string[] = []
  for (;;) {
    let exists = true
    try {
      lstatSync(current)
    } catch {
      exists = false
    }
    if (exists) {
      let real: string
      try {
        real = realpathSync.native(current)
      } catch {
        // A dangling symlink: follow its target, which may be created later.
        real = depth < 32 ? canonical(resolve(dirname(current), readlinkSync(current)), depth + 1) : current
      }
      const full = join(real, ...rest)
      return FOLDS_CASE ? full.toLowerCase() : full
    }
    const parent = dirname(current)
    if (parent === current) break
    rest.unshift(basename(current))
    current = parent
  }
  const full = join(current, ...rest)
  return FOLDS_CASE ? full.toLowerCase() : full
}

/** True when `path` is `folder` or inside it, compared as real paths. */
export function isInside(path: string, folder: string) {
  const rel = relative(canonical(folder), canonical(path))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export const cliOf = (engineDir: string) => join(engineDir, 'node_modules', ...PACKAGE.split('/'), 'src', 'cli.ts')

// H1: onnxruntime-node 1.26.0's postinstall downloads the CUDA package on
// linux/x64 from api.nuget.org (hundreds of MB, every setup) and fails the
// whole install when that host is unreachable (offline, proxy, firewall). Its
// script reads ONNXRUNTIME_NODE_INSTALL and exits early on `skip`
// (script/install-utils.js `parseInstallFlag`); only the CUDA/TensorRT `.so`
// download is skipped, the CPU runtime ships inside the package.
export function installStepEnv(base = process.env as Record<string, string>): Record<string, string> {
  return { ...base, ONNXRUNTIME_NODE_INSTALL: 'skip' }
}

export type Runner = typeof run

/** The `bun install` step that fetches the engine's dependencies, with H1's env. */
export function installStep(next: string, runner: Runner = run) {
  return runner([process.execPath, 'install', '--production', '--omit=peer'], next, undefined, INSTALL_STEP_TIMEOUT_MS, installStepEnv())
}

async function run(argv: string[], cwd: string, input: string | undefined, timeoutMs: number, env?: Record<string, string>) {
  const child = Bun.spawn(argv, {
    cwd,
    env: env ?? (process.env as Record<string, string>),
    stdin: input === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (input !== undefined && child.stdin) {
    child.stdin.write(input)
    child.stdin.end()
  }
  const timer = setTimeout(() => child.kill(), timeoutMs)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, exitCode }
  } finally {
    clearTimeout(timer)
  }
}

/** The new engine answers initialize and tools/list, and its mnemopi_update takes metadata (our build). */
async function check(next: string, build: string, embeddings: boolean, modelCacheDir: string) {
  const installed = join(next, 'node_modules', ...PACKAGE.split('/'), 'package.json')
  if (!existsSync(installed)) throw new InstallError(`bun install left no ${PACKAGE} in ${next}`)
  const version = JSON.parse(readFileSync(installed, 'utf8')).version
  if (version !== build) throw new InstallError(`installed ${PACKAGE} is ${version}, expected ${build}`)
  // A throwaway data dir inside .next: the check writes nothing outside the three folders.
  const data = join(next, '.check-store')
  mkdirSync(data, { recursive: true })
  // With embeddings on, the check also proves the native stack works on this
  // machine: it remembers, recalls and exits cleanly, which downloads the model
  // once into <root>'s pinned cache. The embedding settings are pinned local-only
  // exactly as engineEnv pins them (hooks/engine.ts), so this is the real path.
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    MNEMOPI_DATA_DIR: data,
    MNEMOPI_SESSION_ID: 'install-check',
    MNEMOPI_NO_EMBEDDINGS: embeddings ? '' : '1',
    MNEMOPI_MCP_BANK: 'default',
    MNEMOPI_LLM_BASE_URL: '',
    MNEMOPI_HOST_LLM_ENABLED: '',
    MNEMOPI_EMBEDDING_API_URL: '',
    MNEMOPI_EMBEDDINGS_VIA_API: '',
    MNEMOPI_EMBEDDING_API_KEY: '',
    MNEMOPI_EMBEDDING_MODEL: EMBEDDINGS_MODEL,
    MNEMOPI_EMBEDDING_DIM: '',
    OPENROUTER_BASE_URL: '',
    OPENROUTER_API_KEY: '',
    OPENAI_API_KEY: '',
    MNEMOPI_EMBEDDINGS_API_OPT_IN: '0',
    HF_ENDPOINT: 'https://huggingface.co',
    PI_CONFIG_DIR: modelCacheDir,
  }
  const request = (id: number, name: string, args: Record<string, unknown>) =>
    `${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`
  // initialize (id 0) and its notification, as an MCP client starts; then
  // tools/list; then, with embeddings on, one remember and one recall.
  const handshake =
    `${JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'install-engine', version: build } } })}\n` +
    `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n` +
    `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n`
  const stdin = embeddings
    ? handshake +
      request(2, 'mnemopi_remember', { content: 'The install check prefers dark mode.', source: 'imported', scope: 'global' }) +
      request(3, 'mnemopi_recall', { query: 'dark mode' })
    : handshake
  const ran = await run([process.execPath, cliOf(next), 'mcp'], next, stdin, INSTALL_CHECK_TIMEOUT_MS, env)
  const replies = new Map<number, { result?: { content?: { text?: string }[]; isError?: boolean }; error?: { message?: string } }>()
  for (const line of ran.stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (typeof message?.id === 'number') replies.set(message.id, message)
    } catch {
      // engine chatter
    }
  }
  if (replies.get(0)?.result === undefined) throw new InstallError(`the new engine did not answer initialize (exit ${ran.exitCode}): ${ran.stderr.trim().slice(-400)}`)
  const tools = (replies.get(1)?.result as { tools?: { name: string; inputSchema?: { properties?: Record<string, unknown> } }[] } | undefined)?.tools
  if (!Array.isArray(tools)) throw new InstallError(`the new engine did not answer tools/list (exit ${ran.exitCode}): ${ran.stderr.trim().slice(-400)}`)
  const update = tools.find(tool => tool.name === 'mnemopi_update')
  if (!update?.inputSchema?.properties?.metadata) throw new InstallError('the new engine has no mnemopi_update with metadata')
  if (!embeddings) {
    rmSync(data, { recursive: true, force: true })
    return
  }
  // A clean embeddings run: remember and recall reply, the process exits 0, and
  // no ORT exit panic is on stderr. Any failure refuses the swap (EMB.3.a4).
  if (ran.exitCode !== 0) throw new InstallError(`embeddings check failed: engine exited ${ran.exitCode}: ${ran.stderr.trim().slice(-400)}`)
  if (/panic: A C\+\+ exception occurred|oh no: Bun has crashed/i.test(ran.stderr)) {
    throw new InstallError(`embeddings check failed: the engine crashed on exit (onnxruntime): ${ran.stderr.trim().slice(-400)}`)
  }
  for (const [id, what] of [[2, 'remember'], [3, 'recall']] as const) {
    const reply = replies.get(id)
    if (reply === undefined || reply.error !== undefined || reply.result?.isError === true) {
      const detail = reply?.error?.message ?? reply?.result?.content?.[0]?.text ?? 'no reply'
      throw new InstallError(`embeddings check failed: ${what} did not succeed (${detail})`)
    }
  }
  // M2 (EMB review round 2): prove the embedding path really ran, not a silent
  // full-text fallback. A model that fails to load still answers remember/recall
  // (full text), so a clean exit alone is not proof: the check store must hold a
  // memory_embeddings row for the remembered memory.
  const vectorRows = (() => {
    // A check store that never opened the engine's DB (or a fallback-to-full-text
    // run that wrote no vector) leaves no mnemopi.db / no memory_embeddings row.
    if (!existsSync(join(data, 'mnemopi.db'))) return 0
    const db = new Database(join(data, 'mnemopi.db'), { readonly: true })
    try {
      const table = db.query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='memory_embeddings'").get() as { n: number }
      return table.n > 0 ? (db.query('SELECT COUNT(*) AS n FROM memory_embeddings').get() as { n: number }).n : 0
    } finally {
      db.close()
    }
  })()
  rmSync(data, { recursive: true, force: true })
  if (vectorRows === 0) {
    throw new InstallError('embeddings check failed: the check store has no memory_embeddings row, so the model did not load')
  }
}

export async function install(pluginRoot: string, engineDir: string, storeDir: string, embeddings = false, modelCacheDir = EMBEDDINGS_CACHE_DIR) {
  for (const [name, path] of [['plugin root', pluginRoot], ['engine dir', engineDir], ['store dir', storeDir]] as const) {
    if (!path || !isAbsolute(path)) throw new InstallError(`${name} must be an absolute path (got "${path}")`)
  }
  const engine = resolve(engineDir)
  const next = `${engine}.next`
  const old = `${engine}.old`
  for (const folder of [engine, next, old]) {
    if (isInside(storeDir, folder)) throw new InstallError(`the store ${storeDir} is inside ${folder}; refusing to install there`)
  }
  const source = join(resolve(pluginRoot), 'engine')
  const sourcePackage = join(source, 'package.json')
  if (!existsSync(sourcePackage)) throw new InstallError(`no engine copy at ${source}`)
  if (isInside(engine, source) || isInside(source, engine)) throw new InstallError(`the engine dir ${engine} overlaps the plugin's engine copy`)
  if (!existsSync(dirname(engine))) throw new InstallError(`the folder ${dirname(engine)} does not exist`)
  const build = JSON.parse(readFileSync(sourcePackage, 'utf8')).version as string

  // A swap cut short last time: <engine> gone, <engine>.old whole. Put it back first.
  if (!existsSync(engine) && existsSync(old)) renameSync(old, engine)
  rmSync(next, { recursive: true, force: true })

  try {
    mkdirSync(next)
    cpSync(source, join(next, 'pi-mnemopi'), {
      recursive: true,
      filter: path => {
        const rel = relative(source, path).split(sep)
        return rel[0] !== 'node_modules' && rel[0] !== 'test'
      },
    })
    writeFileSync(
      join(next, 'package.json'),
      `${JSON.stringify(
        {
          name: 'mnemosyne-engine',
          private: true,
          dependencies: { [PACKAGE]: 'file:./pi-mnemopi' },
          // `overrides` only apply from the install root, so the engine's own
          // manifest cannot fix fastembed's onnxruntime-node here: it must be
          // restated on this root package.json. 1.26.0 is a fastembed 3.0.0
          // install with ORT's exit crash (ORT #24579) fixed; @anush008/tokenizers
          // 0.6.0 adds the linux-arm64 bindings fastembed's ^0.0.0 lacks.
          overrides: { 'onnxruntime-node': '1.26.0', '@anush008/tokenizers': '0.6.0' },
          trustedDependencies: ['onnxruntime-node'],
        },
        null,
        2,
      )}\n`,
    )
    // --production --omit=peer installs the engine's dependencies (now including
    // fastembed at the root overrides above) and skips dev and peer dependencies,
    // so the ~500 MB the engine's own tests pull in is not installed.
    // No lockfile: Bun saves none under --production, so the pinned 18.12.3
    // packages and their dependencies resolve fresh, through Bun's global cache.
    const installed = await installStep(next)
    if (installed.exitCode !== 0) {
      throw new InstallError(`bun install failed (exit ${installed.exitCode}): ${`${installed.stderr}\n${installed.stdout}`.trim().slice(-800)}`)
    }
    await check(next, build, embeddings, modelCacheDir)
  } catch (error) {
    rmSync(next, { recursive: true, force: true })
    throw error
  }

  // The new engine answers: swap it in. Any step here can fail (on Windows a
  // running engine holds its folder open): put the old engine back, drop .next.
  const hadEngine = existsSync(engine)
  try {
    rmSync(old, { recursive: true, force: true })
    if (hadEngine) renameSync(engine, old)
    renameSync(next, engine)
  } catch (error) {
    try {
      if (hadEngine && !existsSync(engine) && existsSync(old)) renameSync(old, engine)
    } finally {
      rmSync(next, { recursive: true, force: true })
    }
    throw new InstallError(`could not move the new engine into place: ${(error as Error).message}`)
  }
  try {
    rmSync(old, { recursive: true, force: true })
  } catch {
    // The new engine is in place; a leftover .old is removed by the next install.
  }
  return { engine, build, cli: cliOf(engine) }
}

// The install lock: <engine dir>.lock, taken with bin/lockfile.ts. mtime is the
// only stale test (older than LOCK_STALE_MS); the pid and time inside are for
// people, so a dead pid alone never frees a lock. The holder touches it every
// LOCK_REFRESH_MS, so a healthy long install is never stale, and removes it in a
// finally, after a failed install too. A second install polls every
// LOCK_POLL_MS for up to LOCK_WAIT_MS (longer than the 240 s install step plus
// the 300 s check), then gives up with LockBusy. /mnemosyne-setup passes a
// shorter wait (SETUP_LOCK_WAIT_MS) through MNEMOSYNE_LOCK_WAIT_MS. SIGTERM and
// SIGINT remove a held lock before the process exits.
export const LOCK_STALE_MS = 30 * 60_000
export const LOCK_WAIT_MS = INSTALL_LOCK_WAIT_MS
export const LOCK_POLL_MS = 1_000
export const LOCK_REFRESH_MS = 60_000
export type LockTiming = { waitMs?: number; pollMs?: number; staleMs?: number; refreshMs?: number }

export async function withInstallLock<T>(file: string, work: () => Promise<T>, timing: LockTiming = {}): Promise<T> {
  const { waitMs = LOCK_WAIT_MS, pollMs = LOCK_POLL_MS, staleMs = LOCK_STALE_MS, refreshMs = LOCK_REFRESH_MS } = timing
  const note = `${JSON.stringify({ pid: process.pid, started: new Date().toISOString() })}\n`
  const deadline = Date.now() + waitMs
  let missing = 0
  while (takeLock(file, staleMs, note) === undefined) {
    // takeLock also fails when the file cannot be made at all (a read-only
    // folder): with no lock there to wait for, stop after a few tries.
    missing = existsSync(file) ? 0 : missing + 1
    if (missing >= 3) throw new InstallError(`could not create the lock ${file}`)
    if (Date.now() >= deadline) throw new LockBusy(`another install holds ${file}`)
    await Bun.sleep(pollMs)
  }
  // A killed installer (the host's timeout, Ctrl-C) removes the lock it holds,
  // so the next setup need not wait out the 30-minute stale time. SIGKILL cannot
  // be caught; that lock goes stale as before.
  const onSignal = (signal: NodeJS.Signals) => {
    rmSync(file, { force: true })
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }
  process.once('SIGTERM', onSignal)
  process.once('SIGINT', onSignal)
  const refresh = setInterval(() => {
    try {
      const now = new Date()
      utimesSync(file, now, now)
    } catch {
      // gone or unreachable: the install goes on, the finally still removes it
    }
  }, refreshMs)
  try {
    return await work()
  } finally {
    clearInterval(refresh)
    process.off('SIGTERM', onSignal)
    process.off('SIGINT', onSignal)
    rmSync(file, { force: true })
  }
}

// The proxy's import closure: bin/mcp-proxy.ts and every file it reaches by a
// relative runtime import (`import type` is erased, so not followed); any other
// runtime import must be a node: or bun: built-in. Paths are
// relative to the plugin root, with forward slashes. Each file must be under
// bin/ or hooks/, so <root>/plugin keeps the ../hooks layout, and none may
// import claude-code at runtime: such a root would fail at its first call.
const IMPORT = /^[ \t]*(?:import|export)[ \t]+(type[ \t]+)?(?:[^'";]*?[ \t\n]from[ \t]+)?['"]([^'"]+)['"]/gm
export function proxyClosure(pluginRoot: string, entry = 'bin/mcp-proxy.ts') {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const rel = queue.pop()!
    if (seen.has(rel)) continue
    const file = join(pluginRoot, rel)
    if (!existsSync(file)) throw new InstallError(`the proxy imports ${rel}, which does not exist`)
    if (!/^(bin|hooks)\/[^/]+\.ts$/.test(rel)) throw new InstallError(`the proxy imports ${rel}, outside bin/ and hooks/`)
    seen.add(rel)
    const text = readFileSync(file, 'utf8')
    if (/\bimport\s*\(/.test(text) || /\brequire\s*\(/.test(text)) throw new InstallError(`${rel} loads a module at run time; the closure cannot follow it`)
    for (const match of text.matchAll(IMPORT)) {
      const [, typeOnly, spec] = match as unknown as [string, string | undefined, string]
      if (typeOnly) continue
      if (spec === 'claude-code' || spec.startsWith('claude-code/')) throw new InstallError(`${rel} imports ${spec}, which only the Claude Code host has`)
      // Built-ins only: <root>/plugin has no node_modules, so a package import would fail at the first call.
      if (spec.startsWith('node:') || spec.startsWith('bun:')) continue
      if (!spec.startsWith('.')) throw new InstallError(`${rel} imports the package ${spec}; the proxy may import only relative files, node: and bun: modules`)
      const target = slashes(relative(pluginRoot, join(dirname(file), spec)))
      queue.push(/\.[a-z]+$/.test(target) ? target : `${target}.ts`)
    }
  }
  return [...seen].sort()
}

// Marks a folder as a root this installer made: a non-empty --root without it
// is refused, so a typo cannot fill an unrelated folder (or a home) with files.
export const ROOT_MARKER = '.mnemosyne-root'

/** Every path under a standalone root (`--root`). */
export function rootLayout(root: string, store = join(root, 'store')) {
  return {
    root,
    engine: join(root, 'engine'),
    store,
    modelCache: join(root, 'model-cache'),
    plugin: join(root, 'plugin'),
    bin: join(root, 'bin'),
    launcher: join(root, 'bin', `mnemosyne-mcp${IS_WINDOWS ? '.cmd' : ''}`),
    config: configFile(root),
    vocabulary: join(root, VOCAB_FILE),
    activity: join(root, 'activity.jsonl'),
    lock: join(root, 'engine.lock'),
    marker: join(root, ROOT_MARKER),
  }
}

/** cmd has no safe quoting for ", % or !: a Windows root or derived path holding one is refused (as register.ts refuses memoryDir). */
export function windowsPathProblem(paths: readonly string[]) {
  const bad = paths.find(path => /["%!]/.test(path))
  return bad === undefined ? undefined : `on Windows a path must not contain ", % or ! (got "${bad}")`
}

const secureDir = (dir: string) => {
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  if (!IS_WINDOWS) chmodSync(dir, 0o700)
}

// Writes `text` to `file` only when there is no file: an existing one is kept byte for byte.
const createOnly = (file: string, text: string) => {
  if (existsSync(file)) return false
  writeFileSync(file, text, { mode: 0o600, flag: 'wx' })
  if (!IS_WINDOWS) chmodSync(file, 0o600)
  return true
}

/**
 * The standalone install (issue #43): everything under one root, nothing under
 * $HOME/.claude or ~/.omp read or written. Creates what is missing:
 *   engine/              the engine, staged and swapped in as install() does
 *   store/               (or --store) the memory store
 *   model-cache/         PI_CONFIG_DIR, absolute, so the engine never looks under $HOME
 *   plugin/{bin,hooks}/  the proxy's import closure, replaced whole at each install
 *   bin/mnemosyne-mcp    the launcher (.cmd on Windows), rewritten at each install, 0700
 *   config.json, vocabulary.json, activity.jsonl   created once, 0600; existing ones are kept
 *   .mnemosyne-root      the marker, 0600; a non-empty root without it is refused
 * Folders are 0700 on POSIX. A same-build rerun is a full reinstall.
 */
export async function installRoot(pluginRoot: string, rootDir: string, options: { store?: string; embeddings?: boolean; lock?: LockTiming } = {}) {
  if (!rootDir || !isAbsolute(rootDir)) throw new InstallError(`--root must be an absolute path (got "${rootDir}")`)
  if (options.store !== undefined && !isAbsolute(options.store)) throw new InstallError(`--store must be an absolute path (got "${options.store}")`)
  const layout = rootLayout(resolve(rootDir), options.store === undefined ? undefined : resolve(options.store))
  const { root, engine, store } = layout
  if (IS_WINDOWS) {
    const problem = windowsPathProblem(Object.values(layout))
    if (problem) throw new InstallError(problem)
  }
  for (const folder of [engine, `${engine}.next`, `${engine}.old`]) {
    if (isInside(root, folder)) throw new InstallError(`the root ${root} is inside ${folder}; refusing to install there`)
  }
  // Each install replaces these folders whole: a store inside one would be deleted.
  for (const folder of [layout.plugin, `${layout.plugin}.next`, `${layout.plugin}.old`]) {
    if (isInside(store, folder)) throw new InstallError(`the store ${store} is inside ${folder}; refusing to install there`)
  }
  if (existsSync(root) && !existsSync(layout.marker) && readdirSync(root).length > 0) {
    throw new InstallError(`${root} is not empty and has no ${ROOT_MARKER} from an earlier install; pass an empty or new folder`)
  }
  const closure = proxyClosure(resolve(pluginRoot))
  secureDir(root)
  // Before the lock, so a second install that starts now finds the root marked.
  try {
    createOnly(layout.marker, `${JSON.stringify({ by: 'claude-mnemosyne bin/install-engine.ts --root', created: new Date().toISOString() })}\n`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  return withInstallLock(
    layout.lock,
    async () => {
      for (const dir of [store, layout.modelCache, layout.bin]) secureDir(dir)
      const done = await install(pluginRoot, engine, store, options.embeddings === true, layout.modelCache)
      // install() leaves the swapped-in folder at the default mode; under a root every folder is owner-only.
      secureDir(engine)

      // The proxy's files, staged and swapped like the engine, so a crash leaves the old copy or the new one.
      const next = `${layout.plugin}.next`
      const old = `${layout.plugin}.old`
      rmSync(next, { recursive: true, force: true })
      for (const rel of closure) {
        mkdirSync(join(next, dirname(rel)), { recursive: true, mode: 0o700 })
        copyFileSync(join(resolve(pluginRoot), rel), join(next, rel))
      }
      for (const dir of [next, join(next, 'bin'), join(next, 'hooks')]) secureDir(dir)
      rmSync(old, { recursive: true, force: true })
      if (existsSync(layout.plugin)) renameSync(layout.plugin, old)
      renameSync(next, layout.plugin)
      rmSync(old, { recursive: true, force: true })

      const launcher = launcherOptions(layout, options.embeddings === true)
      writeFileSync(layout.launcher, IS_WINDOWS ? cmdWrapper(launcher) : shWrapper(launcher))
      if (!IS_WINDOWS) chmodSync(layout.launcher, 0o700)

      createOnly(layout.config, configText(emptyConfig()))
      // Seeded from the store, which must exist first (bin/vocab.ts).
      if (!existsSync(layout.vocabulary)) {
        initVocabulary(store, root)
        if (!IS_WINDOWS) chmodSync(layout.vocabulary, 0o600)
      }
      createOnly(layout.activity, '')
      return { ...done, root, store, launcher: layout.launcher, proxy: join(layout.plugin, 'bin', 'mcp-proxy.ts') }
    },
    options.lock,
  )
}

/** The launcher's options for a standalone root: forward slashes on every OS, as the plugin writes them. */
export function launcherOptions(layout: ReturnType<typeof rootLayout>, embeddings: boolean) {
  return {
    store: slashes(layout.store),
    cli: slashes(cliOf(layout.engine)),
    proxy: slashes(join(layout.plugin, 'bin', 'mcp-proxy.ts')),
    activity: slashes(layout.activity),
    embeddings,
    guardMode: 'strict',
    vocabulary: slashes(layout.vocabulary),
    root: slashes(layout.root),
    modelCacheDir: slashes(layout.modelCache),
  }
}

// HARDEN.3: the engine writes one omp.*.log per run into <model cache>/logs and
// never trims them. Pruning removes only regular files named omp.*.log directly in
// that folder, older than `maxAgeDays`, and always keeps the newest `keep`. It
// follows no symlink (a linked folder is skipped, a linked file is left alone),
// touches nothing else, and stops after `limit` deletions so one run stays short.
export const LOG_KEEP = 20
export const LOG_MAX_AGE_DAYS = 7
const LOG_NAME = /^omp\..*\.log$/
export function pruneEngineLogs(dir: string, now = Date.now(), keep = LOG_KEEP, maxAgeDays = LOG_MAX_AGE_DAYS, limit = 1000): number {
  try {
    if (!lstatSync(dir).isDirectory()) return 0
    const logs: { path: string; mtime: number }[] = []
    for (const name of readdirSync(dir)) {
      if (!LOG_NAME.test(name)) continue
      const path = join(dir, name)
      const stat = lstatSync(path)
      if (stat.isFile()) logs.push({ path, mtime: stat.mtimeMs })
    }
    logs.sort((a, b) => b.mtime - a.mtime)
    const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000
    let removed = 0
    for (const log of logs.slice(keep)) {
      if (removed >= limit) break
      if (log.mtime >= cutoff) continue
      try {
        unlinkSync(log.path)
        removed++
      } catch {
        // Held open or already gone: leave it for the next run.
      }
    }
    return removed
  } catch {
    return 0
  }
}

if (import.meta.main && process.argv[2] === 'prune-logs') {
  // bun bin/install-engine.ts prune-logs <logs dir>: prints the number removed, never fails.
  console.log(pruneEngineLogs(process.argv[3] ?? ''))
} else if (import.meta.main) {
  const args = process.argv.slice(2)
  // A script that would rather not wait can shorten the lock wait (milliseconds).
  const waitMs = Number(process.env.MNEMOSYNE_LOCK_WAIT_MS)
  const lock: LockTiming = Number.isFinite(waitMs) && waitMs >= 0 && process.env.MNEMOSYNE_LOCK_WAIT_MS !== '' ? { waitMs } : {}
  try {
    if (args.includes('--root')) {
      const flags: { root?: string; store?: string; embeddings?: boolean } = {}
      for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg === '--embeddings') flags.embeddings = true
        else if (arg === '--root' || arg === '--store') {
          const value = args[++i]
          if (value === undefined || value.startsWith('--')) throw new InstallError(`${arg} needs a folder`)
          flags[arg === '--root' ? 'root' : 'store'] = value
        } else throw new InstallError(`unknown argument "${arg}" (usage: --root <abs dir> [--store <abs dir>] [--embeddings])`)
      }
      // The plugin root is the checkout this script runs from.
      const done = await installRoot(join(import.meta.dir, '..'), flags.root ?? '', { store: flags.store, embeddings: flags.embeddings, lock })
      console.log(JSON.stringify({ ok: true, ...done }))
    } else {
      const [pluginRoot = '', engineDir = '', storeDir = '', embeddingsArg = ''] = args
      // The 4th argument is "embeddings" when /mnemosyne-setup's option is on:
      // the check then also downloads the model once and proves a clean exit.
      const run = () => install(pluginRoot, engineDir, storeDir, embeddingsArg === 'embeddings')
      // The lock sits beside the engine folder; a path install() will refuse anyway takes none.
      const engine = isAbsolute(engineDir) ? resolve(engineDir) : ''
      const done = engine && existsSync(dirname(engine)) ? await withInstallLock(`${engine}.lock`, run, lock) : await run()
      console.log(JSON.stringify({ ok: true, ...done }))
    }
  } catch (error) {
    console.error(`install-engine: ${(error as Error).message}`)
    process.exit(error instanceof LockBusy ? 3 : 1)
  }
}
