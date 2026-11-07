// The dashboard's Update button (0.28.0): the routes behind the Health tab's
// System panel. Every route sits behind the server's token check (/api/*), and
// the POST also behind its origin and JSON checks.
//
//   GET  /api/update         installed versions, the latest release (cached, at
//                            most one GitHub check a day, a failure is silent),
//                            whether an update is offered, and the last run's progress
//   POST /api/update/start   starts bin/update.ts detached and windowless, then 202
//   GET  /api/update/status  the progress file the updater writes
//
// The dashboard runs from <root>/plugin, the folder the updater replaces, so the
// updater is never its child: on Windows it is created through WMI (as the
// always-on dashboard's loop starts the server), elsewhere through nohup. Before
// it starts, the server leaves <root>/ui-handoff.json (its port and token,
// 0600, valid 30 minutes); the restarted server takes them over once
// (takeHandoff), so the open page reloads into the new version.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { compareVersions, FINAL_STATES, latestReleaseTag, nextStatus, readStatus, REPO, type UpdateStatus } from '../bin/update'

export const UPDATE_CHECK_FILE = 'update-check.json'
export const UPDATE_STATUS_FILE = 'update-status.json'
export const UPDATE_LOG_FILE = 'update.log'
export const HANDOFF_FILE = 'ui-handoff.json'
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000
export const CHECK_TIMEOUT_MS = 5000
export const HANDOFF_MS = 30 * 60 * 1000
// A run whose progress file has not moved for this long is taken as dead (a new one may start).
export const STALE_RUN_MS = 30 * 60 * 1000

export type Latest = { tag: string; plugin: string; engine: string | null }
export type CheckCache = { checked: string; latest: Latest | null }

export type UpdateInfo = {
  current: { plugin: string | null; engine: string | null }
  latest: Latest | null
  available: boolean
  /** False when this server does not run from <root>/plugin (a Claude Code install updates with `claude plugin update`). */
  updatable: boolean
  status: UpdateStatus | null
}

export type UpdateDeps = {
  fetcher?: typeof fetch
  now?: () => number
  /** Starts the updater detached; resolves once it was handed to the OS. */
  launch?: (command: LaunchCommand) => Promise<void>
}

export type LaunchCommand = { bun: string; script: string; args: string[]; cwd: string; log: string }

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

const writePrivate = (file: string, value: unknown) => {
  const temp = `${file}.${process.pid}.tmp`
  writeFileSync(temp, `${JSON.stringify(value)}\n`, { mode: 0o600 })
  renameSync(temp, file)
}

/** The newest release and its engine build, from GitHub, within CHECK_TIMEOUT_MS; undefined on any failure. */
export async function fetchLatest(fetcher: typeof fetch = fetch): Promise<Latest | undefined> {
  const signal = AbortSignal.timeout(CHECK_TIMEOUT_MS)
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'claude-mnemosyne-dashboard' }
  try {
    const reply = await fetcher(`https://api.github.com/repos/${REPO}/tags?per_page=100`, { headers, signal })
    if (!reply.ok) return undefined
    const names = ((await reply.json()) as { name?: unknown }[]).map(tag => tag?.name).filter((name): name is string => typeof name === 'string')
    const tag = latestReleaseTag(names)
    if (tag === undefined) return undefined
    let engine: string | null = null
    try {
      const pkg = await fetcher(`https://raw.githubusercontent.com/${REPO}/${tag}/engine/package.json`, { headers, signal })
      const version = pkg.ok ? ((await pkg.json()) as { version?: unknown }).version : undefined
      engine = typeof version === 'string' ? version : null
    } catch {
      // the confirm then says the engine build is unknown
    }
    return { tag, plugin: tag.slice(1), engine }
  } catch {
    return undefined
  }
}

/** The cached check when it is younger than a day, else one new check (a failure is cached too, so GitHub is asked at most once a day). */
export async function latestRelease(root: string, deps: UpdateDeps = {}): Promise<Latest | null> {
  const now = deps.now?.() ?? Date.now()
  const file = join(root, UPDATE_CHECK_FILE)
  const cached = readJson(file) as CheckCache | undefined
  const age = cached ? now - Date.parse(cached.checked) : Infinity
  if (cached && age >= 0 && age < CHECK_EVERY_MS) return cached.latest ?? null
  const latest = (await fetchLatest(deps.fetcher)) ?? null
  try {
    writePrivate(file, { checked: new Date(now).toISOString(), latest } satisfies CheckCache)
  } catch {
    // no cache: the next page load asks again
  }
  return latest
}

/** Offered when the release is newer than the plugin this server runs. */
export const updateAvailable = (current: string | null, latest: Latest | null) => latest !== null && current !== null && compareVersions(latest.plugin, current) > 0

/** The home folder behind <root> when <root> is <home>/.claude/mnemosyne and this server runs from <root>/plugin; else undefined. */
export function updaterHome(root: string, pluginRoot: string) {
  const fold = (path: string) => (process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path))
  const home = dirname(dirname(resolve(root)))
  if (fold(join(home, '.claude', 'mnemosyne')) !== fold(root)) return undefined
  if (fold(pluginRoot) !== fold(join(root, 'plugin'))) return undefined
  if (!existsSync(join(pluginRoot, 'bin', 'update.ts'))) return undefined
  return home
}

/** True while a run is under way: a progress file not final and touched within STALE_RUN_MS. */
export function running(status: UpdateStatus | undefined, now: number) {
  return status !== undefined && !FINAL_STATES.includes(status.state) && now - Date.parse(status.updated) < STALE_RUN_MS
}

// ---- the detached start ----

/** The cmd line WMI runs: bun with the updater, its output to the log. Paths holding " are refused by the caller. */
export function windowsCommandLine(command: LaunchCommand, systemRoot = process.env.SystemRoot ?? 'C:\\Windows') {
  const quoted = [command.bun, command.script, ...command.args].map(part => (/^[A-Za-z0-9._:\\/-]+$/.test(part) ? part : `"${part}"`))
  return `"${systemRoot}\\System32\\cmd.exe" /d /c "${quoted.join(' ')} > "${command.log}" 2>&1"`
}

async function launchDetached(command: LaunchCommand) {
  const parts = [command.bun, command.script, ...command.args, command.cwd, command.log]
  if (parts.some(part => part.includes('"'))) throw new Error('a path holds a double quote')
  if (process.platform === 'win32') {
    // ShowWindow 0: no console window. The command line goes through the environment, so PowerShell never parses it.
    const script =
      "$s = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }; " +
      '$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $env:MNEMOSYNE_UPDATE_CMD; CurrentDirectory = $env:MNEMOSYNE_UPDATE_CWD; ProcessStartupInformation = $s }; ' +
      'exit $r.ReturnValue'
    const child = Bun.spawn(['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', script], {
      env: { ...(process.env as Record<string, string>), MNEMOSYNE_UPDATE_CMD: windowsCommandLine(command), MNEMOSYNE_UPDATE_CWD: command.cwd },
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'pipe',
      windowsHide: true,
    })
    const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited])
    if (code !== 0) throw new Error(`Windows did not start the updater (code ${code}): ${stderr.trim().slice(-200)}`)
    return
  }
  // nohup in a backgrounded shell: the updater outlives this server.
  const child = Bun.spawn(['sh', '-c', 'log="$1"; shift; nohup "$@" >"$log" 2>&1 </dev/null &', 'sh', command.log, command.bun, command.script, ...command.args], {
    cwd: command.cwd,
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  })
  if ((await child.exited) !== 0) throw new Error('the shell did not start the updater')
}

// ---- the handoff to the restarted server ----

export type Handoff = { port: number; token: string; until: string }

/** The port and token an updating server left, once: the file is removed whatever it holds. Only a fresh, well-formed one counts. */
export function takeHandoff(root: string, now = Date.now()): { port: number; token: string } | undefined {
  const file = join(root, HANDOFF_FILE)
  const value = readJson(file) as Partial<Handoff> | undefined
  rmSync(file, { force: true })
  if (!value || typeof value.port !== 'number' || typeof value.token !== 'string' || typeof value.until !== 'string') return undefined
  if (!Number.isInteger(value.port) || value.port < 1024 || value.port > 65535) return undefined
  if (!/^[A-Za-z0-9_-]{32,}$/.test(value.token)) return undefined
  const until = Date.parse(value.until)
  if (!(until > now) || until - now > HANDOFF_MS) return undefined
  return { port: value.port, token: value.token }
}

// ---- the routes ----

type Answer = { status: number; body: unknown }

export function updateRoutes(input: { root: string; pluginRoot: string; plugin: string | null; engine: string | null; port: () => number; token: string }, deps: UpdateDeps = {}) {
  const { root } = input
  const now = () => deps.now?.() ?? Date.now()
  const statusFile = join(root, UPDATE_STATUS_FILE)
  const home = () => updaterHome(root, input.pluginRoot)

  async function info(): Promise<Answer> {
    const latest = await latestRelease(root, deps)
    const status = readStatus(statusFile) ?? null
    // A run that ended while this server stayed up leaves no use for the handoff.
    if (status && FINAL_STATES.includes(status.state)) rmSync(join(root, HANDOFF_FILE), { force: true })
    const body: UpdateInfo = { current: { plugin: input.plugin, engine: input.engine }, latest, available: updateAvailable(input.plugin, latest), updatable: home() !== undefined, status }
    return { status: 200, body }
  }

  function status(): Answer {
    return { status: 200, body: { status: readStatus(statusFile) ?? null } }
  }

  async function start(text: string): Promise<Answer> {
    let body: unknown
    try {
      body = JSON.parse(text || '{}')
    } catch {
      return { status: 400, body: { error: 'the body must be JSON' } }
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return { status: 400, body: { error: 'the body must be an object' } }
    const updaterHomeDir = home()
    if (updaterHomeDir === undefined) return { status: 409, body: { error: 'This dashboard is not the Claude Desktop install under ~/.claude/mnemosyne/plugin; update it with `claude plugin update` instead.' } }
    if (running(readStatus(statusFile), now())) return { status: 409, body: { error: 'An update is already running.' } }
    const latest = await latestRelease(root, deps)
    if (!updateAvailable(input.plugin, latest) || latest === null) return { status: 409, body: { error: 'There is no newer release to install.' } }
    const begun = nextStatus(undefined, { state: 'starting', lines: [`Starting the update to ${latest.tag} ...`] }, new Date(now()))!
    writePrivate(statusFile, begun)
    writePrivate(join(root, HANDOFF_FILE), { port: input.port(), token: input.token, until: new Date(now() + HANDOFF_MS).toISOString() } satisfies Handoff)
    const command: LaunchCommand = {
      bun: process.execPath,
      script: join(input.pluginRoot, 'bin', 'update.ts'),
      args: ['--home', updaterHomeDir, '--tag', latest.tag, '--status', statusFile],
      cwd: root,
      log: join(root, UPDATE_LOG_FILE),
    }
    try {
      await (deps.launch ?? launchDetached)(command)
    } catch (error) {
      rmSync(join(root, HANDOFF_FILE), { force: true })
      writePrivate(statusFile, nextStatus(begun, { state: 'failed', lines: [`Could not start the updater: ${(error as Error).message}`] }, new Date(now()))!)
      return { status: 500, body: { error: `Could not start the updater: ${(error as Error).message}` } }
    }
    return { status: 202, body: { started: true, tag: latest.tag } }
  }

  return { info, status, start }
}
