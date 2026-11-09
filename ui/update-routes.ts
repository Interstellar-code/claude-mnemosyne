// The dashboard's Update button (0.28.0): the routes behind the Health tab's
// System panel. Every route sits behind the server's token check (/api/*), and
// the POST also behind its origin and JSON checks.
//
//   GET  /api/update         installed versions, the latest release (cached, at
//                            most one GitHub check a day, a failure is silent;
//                            ?check=now asks again, at most once a minute),
//                            whether an update is offered, and the last run's progress
//   POST /api/update/start   starts bin/update.ts detached and windowless, then 202; for a
//                            Claude Code install (UPDCC.1) runs `claude plugin update <id>` instead
//   GET  /api/update/status  the progress file the updater writes
//
// The dashboard runs from <root>/plugin, the folder the updater replaces, so the
// updater is never its child: on Windows it is created through WMI (as the
// always-on dashboard's loop starts the server), elsewhere through nohup. Before
// it starts, the server leaves <root>/ui-handoff.json (its port and token,
// 0600, valid 30 minutes); the restarted server takes them over once
// (takeHandoff), so the open page reloads into the new version. A run whose
// updater died (its pid gone, or no pid a minute after the start) is reported
// as failed (settle), so the button never waits 30 minutes on a dead start.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { compareVersions, FINAL_STATES, HANDOFF_FILE, latestReleaseTag, nextStatus, readStatus, REPO, type UpdateStatus } from '../bin/update'

export { HANDOFF_FILE }

export const UPDATE_CHECK_FILE = 'update-check.json'
export const UPDATE_STATUS_FILE = 'update-status.json'
export const UPDATE_LOG_FILE = 'update.log'
export const CHECK_EVERY_MS = 24 * 60 * 60 * 1000
export const CHECK_TIMEOUT_MS = 5000
export const HANDOFF_MS = 30 * 60 * 1000
// A run whose progress file has not moved for this long is taken as dead (a new one may start).
export const STALE_RUN_MS = 30 * 60 * 1000
// A start the updater never answered (no pid written) counts as dead after this long.
export const LAUNCH_GRACE_MS = 60 * 1000

export type Latest = { tag: string; plugin: string; engine: string | null }
export type CheckCache = { checked: string; latest: Latest | null }

export type UpdateInfo = {
  current: { plugin: string | null; engine: string | null }
  latest: Latest | null
  available: boolean
  /** Whether the Update button can install here: through bin/update.ts (`via` 'updater') or `claude plugin update` ('claude'). */
  updatable: boolean
  /** UPDCC.1: how the button installs: 'updater' (<root>/plugin), 'claude' (a Claude Code install), or null (neither). */
  via: UpdateVia | null
  status: UpdateStatus | null
}

export type UpdateVia = 'updater' | 'claude'

export type UpdateDeps = {
  fetcher?: typeof fetch
  now?: () => number
  /** Starts the updater detached; resolves once it was handed to the OS. */
  launch?: (command: LaunchCommand) => Promise<void>
  /** Whether an updater pid still runs (tests fake it). */
  alive?: (pid: number) => boolean
  /** UPDCC.1: runs `claude plugin update`; resolves with its exit code and output (tests fake it). */
  claude?: (cli: string, args: string[], onPid: (pid: number) => void) => Promise<{ code: number; output: string }>
}

// UPDCC.1: how long `claude plugin update` may take (it clones or fetches the marketplace and copies the plugin).
export const CLAUDE_UPDATE_TIMEOUT_MS = 5 * 60 * 1000

/** UPDCC.1: whether `pluginRoot` is a Claude Code install: a version folder under <home>/.claude/plugins/cache. */
export function claudeInstall(root: string, pluginRoot: string) {
  const fold = (path: string) => (process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path))
  const cache = join(dirname(resolve(root)), 'plugins', 'cache')
  return fold(pluginRoot).startsWith(`${fold(cache)}${process.platform === 'win32' ? '\\' : '/'}`)
}

/** Runs the claude CLI, its output gathered, killed after CLAUDE_UPDATE_TIMEOUT_MS. */
async function runClaudeUpdate(cli: string, args: string[], onPid: (pid: number) => void): Promise<{ code: number; output: string }> {
  const child = Bun.spawn([cli, ...args], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  onPid(child.pid)
  // A run past its time is asked to stop, then killed outright, so the progress never sits on "running".
  const timer = setTimeout(() => {
    child.kill()
    setTimeout(() => child.kill('SIGKILL'), 5000).unref?.()
  }, CLAUDE_UPDATE_TIMEOUT_MS)
  try {
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    return { code, output: `${stdout}\n${stderr}` }
  } finally {
    clearTimeout(timer)
  }
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

// 0.28.2: "Check now" asks GitHub again, but not more often than this.
export const CHECK_NOW_MIN_MS = 60 * 1000

/**
 * Whether the cached check still holds: younger than a day, and (0.28.2) not older than what runs here (a cache
 * naming a release below the installed plugin is from before an update, so it says nothing about newer ones).
 * `force` ("Check now") lets it hold only for CHECK_NOW_MIN_MS.
 */
export function cacheHolds(cached: CheckCache | undefined, now: number, current: string | null = null, force = false): boolean {
  if (cached === undefined) return false
  const age = now - Date.parse(cached.checked)
  if (!(age >= 0)) return false
  if (age >= (force ? CHECK_NOW_MIN_MS : CHECK_EVERY_MS)) return false
  if (cached.latest && current !== null && compareVersions(cached.latest.plugin, current) < 0) return false
  return true
}

/** The cached check when it still holds (cacheHolds), else one new check (a failure is cached too, so GitHub is asked at most once a day). */
export async function latestRelease(root: string, deps: UpdateDeps = {}, ask: { current?: string | null; force?: boolean } = {}): Promise<Latest | null> {
  const now = deps.now?.() ?? Date.now()
  const file = join(root, UPDATE_CHECK_FILE)
  const cached = readJson(file) as CheckCache | undefined
  if (cacheHolds(cached, now, ask.current ?? null, ask.force === true)) return cached!.latest ?? null
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

/** True when process `pid` exists (EPERM: it exists but is not ours). */
export function pidAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * The progress file as the page should see it: a run that is not final but whose
 * updater is gone (its pid dead, no pid a minute after the start, or no change
 * for 30 minutes) is reported as failed, so the button does not sit on "starting".
 */
export function settle(status: UpdateStatus | undefined, now: number, alive: (pid: number) => boolean = pidAlive): UpdateStatus | undefined {
  if (status === undefined || FINAL_STATES.includes(status.state)) return status
  const quiet = now - Date.parse(status.updated)
  const dead = status.pid !== undefined ? !alive(status.pid) : quiet >= LAUNCH_GRACE_MS
  if (!dead && quiet < STALE_RUN_MS) return status
  return { ...status, state: 'failed', lines: [...status.lines, 'The updater stopped without finishing. Its output is in ~/.claude/mnemosyne/update.log; the previous version keeps working unless the lines above say otherwise.'] }
}

/** True while a run is under way (see settle). */
export function running(status: UpdateStatus | undefined, now: number, alive: (pid: number) => boolean = pidAlive) {
  const settled = settle(status, now, alive)
  return settled !== undefined && !FINAL_STATES.includes(settled.state)
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

export function updateRoutes(
  input: { root: string; pluginRoot: string; plugin: string | null; engine: string | null; port: () => number; token: string; pluginId?: string; claudeCli?: string },
  deps: UpdateDeps = {},
) {
  const { root } = input
  const now = () => deps.now?.() ?? Date.now()
  const statusFile = join(root, UPDATE_STATUS_FILE)
  const home = () => updaterHome(root, input.pluginRoot)
  const via = (): UpdateVia | null => (home() !== undefined ? 'updater' : input.pluginId && claudeInstall(root, input.pluginRoot) ? 'claude' : null)

  /** The progress, settled; a run that ended while this server stayed up leaves no use for the handoff. */
  function current() {
    const status = settle(readStatus(statusFile), now(), deps.alive) ?? null
    if (status && FINAL_STATES.includes(status.state)) rmSync(join(root, HANDOFF_FILE), { force: true })
    return status
  }

  /** `force`: "Check now" (0.28.2), a new GitHub check unless one ran in the last minute. */
  async function info(force = false): Promise<Answer> {
    const latest = await latestRelease(root, deps, { current: input.plugin, force })
    const status = current()
    const body: UpdateInfo = { current: { plugin: input.plugin, engine: input.engine }, latest, available: updateAvailable(input.plugin, latest), updatable: via() !== null, via: via(), status }
    return { status: 200, body }
  }

  function status(): Answer {
    return { status: 200, body: { status: current() } }
  }

  async function start(text: string): Promise<Answer> {
    let body: unknown
    try {
      body = JSON.parse(text || '{}')
    } catch {
      return { status: 400, body: { error: 'the body must be JSON' } }
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return { status: 400, body: { error: 'the body must be an object' } }
    const how = via()
    if (how === null) return { status: 409, body: { error: 'This dashboard is neither the Claude Desktop install under ~/.claude/mnemosyne/plugin nor a Claude Code install; update it by hand.' } }
    if (running(readStatus(statusFile), now(), deps.alive)) return { status: 409, body: { error: 'An update is already running.' } }
    const latest = await latestRelease(root, deps, { current: input.plugin })
    if (!updateAvailable(input.plugin, latest) || latest === null) return { status: 409, body: { error: 'There is no newer release to install.' } }
    // The release check awaited: a start that came in meanwhile has written its progress, so ask again before writing ours.
    if (running(readStatus(statusFile), now(), deps.alive)) return { status: 409, body: { error: 'An update is already running.' } }
    if (how === 'claude') return startClaude(latest)
    const updaterHomeDir = home()!
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

  /**
   * UPDCC.1: a Claude Code install: `claude plugin update <id>` puts the new version beside this one in Claude Code's
   * plugin cache. This dashboard keeps running the old code, so the progress file ends with the restart steps.
   */
  function startClaude(latest: Latest): Answer {
    const command = `claude plugin update ${input.pluginId}`
    let state = nextStatus(undefined, { state: 'starting', lines: [`Running ${command} ...`] }, new Date(now()))!
    writePrivate(statusFile, state)
    const write = (change: Parameters<typeof nextStatus>[1]) => {
      const next = nextStatus(state, change, new Date(now()))
      if (next === undefined) return
      state = next
      try {
        writePrivate(statusFile, state)
      } catch {
        // the page then sees the run settle as failed
      }
    }
    const run = deps.claude ?? runClaudeUpdate
    void run(input.claudeCli || 'claude', ['plugin', 'update', input.pluginId!], pid => write({ state: 'running', pid }))
      .then(({ code, output }) => {
        const lines = output.split('\n').map(line => line.trim()).filter(Boolean).slice(-6)
        // Claude Code installs what its marketplace copy names, which can lag the GitHub tag: claim the install only when it says so.
        const restart = 'Restart Claude Code to load it, then run /mnemosyne-ui: the dashboard restarts on the new version by itself.'
        if (code === 0 && /\bupdated\b/i.test(output)) write({ state: 'done', code, lines: [...lines, `Installed the update. ${restart}`] })
        else if (code === 0) write({ state: 'done', code, lines: [...lines, `Claude Code found no newer version than the one installed yet; try again in a few minutes. If it was already updated, ${restart[0]!.toLowerCase()}${restart.slice(1)}`] })
        else write({ state: 'failed', code, lines: [...lines, `${command} exited with ${code}. Run it in a terminal to see why.`] })
      })
      .catch((error: unknown) => write({ state: 'failed', lines: [`Could not run ${command}: ${(error as Error).message}`] }))
    return { status: 202, body: { started: true, tag: latest.tag } }
  }

  return { info, status, start }
}
