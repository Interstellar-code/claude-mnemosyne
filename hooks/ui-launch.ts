// /mnemosyne-ui: start the dashboard server (ui/server.ts), or reuse the one
// running, open its link in the default browser and show it in the reply
// (DESIGN.md §3.3, "The dashboard server").
//
// One server is shared: any session's later call pings the server ui.json
// names and reuses it while it answers. Every session that opens or reuses it
// is listed in <root>/ui-users.json (bin/ui-users.ts, with its Claude process id),
// and the server stays up until the last of them is gone. The session that
// started it ends its spawn loop from its session.end (any reason, /clear
// included): with no other session listed, that kills the holder process, whose
// pipe was the server's stdin, and then also sends the server a plain `kill`;
// with others listed it only leaves, and the server (its stdin closed) sees them
// and stays. The server's own backstops are stdin closing, its parent vanishing
// and the users file: it ends when no listed session's process runs.
import type { EngineInterface } from 'claude-code'

export const UI_STATE = 'ui.json'
// The sessions using the server (bin/ui-users.ts writes it; ui/server.ts reads it).
export const UI_USERS = 'ui-users.json'
// What the running dashboard started with. ui.json is the server's own file ({port, token, pid}),
// so the hook keeps the extraction setting beside it: { pid, extraction } for the server it started.
export const EXTRACTION_STATE = 'ui-extraction.json'
export const PING_TIMEOUT_MS = 3_000
export const READY_TIMEOUT_MS = 20_000
// session.end has 1.5 s in all: ending the loop waits at most STOP_WAIT_MS,
// then the `kill` of the server gets at most KILL_TIMEOUT_MS.
export const STOP_WAIT_MS = 600
export const KILL_TIMEOUT_MS = 500
export const ALIVE_TIMEOUT_MS = 1_000
export const OPEN_TIMEOUT_MS = 5_000

// The ping must never go through a proxy: the proxy would see the token.
export const PING_ENV: Readonly<Record<string, string>> = {
  NO_PROXY: '127.0.0.1',
  no_proxy: '127.0.0.1',
  HTTP_PROXY: '',
  http_proxy: '',
  HTTPS_PROXY: '',
  https_proxy: '',
  ALL_PROXY: '',
  all_proxy: '',
}

export type UiPaths = {
  /** The plugin folder, holding ui/server.ts. */
  plugin: string
  /** <root>: ~/.claude/mnemosyne, where ui.json lives. */
  root: string
  store: string
  cli: string
  /** The activity log, or '' when activityLog is off. */
  activity: string
  /** The extractionModel setting, or 'off' (C11). */
  extraction?: string
  /** Whether embeddings are on for this server ('on'/'off'), or 'unknown' (C11). */
  embeddings?: string
  /** The plugin's id (`name@marketplace`) the settings page asks `claude plugin configure` about; defaults to `<name>@<name>`. */
  pluginId?: string
  /** The claude CLI the settings page runs; the server uses `claude` when absent. */
  claudeCli?: string
}

type State = { port: number; token: string; pid: number }
type Ready = { port: number; pid: number }
// One started server: ending its loop stops it; `pid` (the server's, from its ready line) once known.
type Entry = { stop: () => void; ended: Promise<void>; pid?: number }

// The servers each session started; that session's session.end stops them.
const running = new Map<string, Set<Entry>>()
// The sessions this process listed in ui-users.json, with the plugin and root they used.
const joined = new Map<string, { plugin: string; root: string }>()

const isState = (value: unknown): value is State => {
  const state = value as Partial<State> | null
  return (
    typeof state?.port === 'number' &&
    Number.isInteger(state.port) &&
    state.port > 0 &&
    state.port < 65_536 &&
    typeof state.pid === 'number' &&
    Number.isInteger(state.pid) &&
    state.pid > 0 &&
    typeof state.token === 'string' &&
    /^[A-Za-z0-9_-]{32,}$/.test(state.token)
  )
}

async function readState($: EngineInterface, root: string): Promise<State | undefined> {
  try {
    const state = JSON.parse(await $.fs.read(`${root}/${UI_STATE}`))
    return isState(state) ? state : undefined
  } catch {
    return undefined
  }
}

// `bun ui/server.ts --ping <port> <pid>`: GET /api/health with the token,
// no proxy, no redirect, and only a reply naming <pid> counts. The token goes
// in on stdin, so it is never in a process list.
async function answers($: EngineInterface, plugin: string, state: State) {
  try {
    const ran = await $.process.run(['bun', `${plugin}/ui/server.ts`, '--ping', String(state.port), String(state.pid)], {
      stdin: state.token,
      env: { ...PING_ENV },
      timeoutMs: PING_TIMEOUT_MS,
    })
    return ran.exitCode === 0
  } catch {
    return false
  }
}

// Whether a process still runs (`kill -0`); any failure reads as gone.
async function isAlive($: EngineInterface, pid: number) {
  try {
    return (await $.process.run(['kill', '-0', String(pid)], { timeoutMs: ALIVE_TIMEOUT_MS })).exitCode === 0
  } catch {
    return false
  }
}

// The default browser's opener on macOS, Linux and Windows; the first that
// exits 0 wins. A hook cannot read the platform, so each is tried in turn.
const OPENERS = [['open'], ['xdg-open'], ['cmd', '/c', 'start', '']]

async function openBrowser($: EngineInterface, link: string) {
  for (const opener of OPENERS) {
    try {
      if ((await $.process.run([...opener, link], { timeoutMs: OPEN_TIMEOUT_MS })).exitCode === 0) return true
    } catch {
      // Not on this platform: try the next one.
    }
  }
  return false
}

// The default browser opens the link, the clipboard gets it, and the reply
// shows it in full (the key is good only on 127.0.0.1, until the server stops).
async function handOver($: EngineInterface, state: State, verb: 'started' | 'running', note = '') {
  const link = `http://127.0.0.1:${state.port}/#token=${state.token}`
  const [opened, copied] = await Promise.all([
    openBrowser($, link),
    $.ui.copy({ text: link }).catch(() => ({ isCopied: false as const })),
  ])
  $.ui.toast(opened ? 'Mnemosyne dashboard opened in your browser.' : 'Mnemosyne dashboard: open its link from the reply.')
  const how = [opened ? 'Opened in your default browser' : 'Could not open a browser: open the link yourself', copied.isCopied ? 'the link is also on the clipboard' : '']
  return { text: `Mnemosyne dashboard ${verb}${note}.\n${how.filter(Boolean).join('; ')}.\nLink: ${link}` }
}

// Starts the holder (ui/server.ts --hold) in a spawn loop that keeps running
// after the command returns. Returns its entry at once, and `ready`: the
// first full JSON line of its output, or why there is none.
function start($: EngineInterface, paths: UiPaths, session: string) {
  let stopLoop = () => {}
  const stopped = new Promise<'stop'>(resolve => {
    stopLoop = () => resolve('stop')
  })
  let settle: (ready: Ready | Error) => void = () => {}
  const ready = new Promise<Ready | Error>(resolve => {
    settle = resolve
  })
  const entry: Entry = { stop: () => stopLoop(), ended: Promise.resolve() }
  // The settings page asks the claude CLI about the plugin's options by this id (a --plugin-dir install has none that answers).
  const pluginId = paths.pluginId ?? `${$.plugin.name}@${$.plugin.name}`
  const loop = (async () => {
    const stream = $.process.spawn({
      argv: ['bun', `${paths.plugin}/ui/server.ts`, '--hold'],
      env: {
        MNEMOSYNE_PLUGIN_ROOT: paths.plugin,
        MNEMOSYNE_ROOT: paths.root,
        MNEMOSYNE_STORE: paths.store,
        MNEMOSYNE_CLI: paths.cli,
        MNEMOSYNE_ACTIVITY_LOG: paths.activity,
        // C11: the dashboard shows the extraction setting it started with.
        MNEMOSYNE_EXTRACTION: paths.extraction ?? 'unknown',
        // C11: and the embeddings setting it started with ('on'/'off'/'unknown').
        MNEMOSYNE_EMBEDDINGS: paths.embeddings ?? 'unknown',
        ...(pluginId ? { MNEMOSYNE_PLUGIN_ID: pluginId } : {}),
        ...(paths.claudeCli ? { MNEMOSYNE_CLAUDE_CLI: paths.claudeCli } : {}),
      },
    })
    const pieces = stream[Symbol.asyncIterator]()
    let line = ''
    let errors = ''
    let isReady = false
    try {
      while (true) {
        const step = await Promise.race([pieces.next(), stopped])
        if (step === 'stop' || step.done) break
        const { stream: pipe, text } = step.value
        if (pipe === 'stderr') errors = `${errors}${text}`.slice(-600)
        else if (!isReady) {
          // Pieces are not lines: buffer up to the first newline.
          line += text
          const end = line.indexOf('\n')
          if (end >= 0) {
            isReady = true
            try {
              const parsed = JSON.parse(line.slice(0, end)) as Partial<Ready>
              if (typeof parsed.port !== 'number' || typeof parsed.pid !== 'number') throw new Error('no port or pid')
              entry.pid = parsed.pid
              settle({ port: parsed.port, pid: parsed.pid })
            } catch {
              settle(new Error(`its first line was not a ready line: ${line.slice(0, end).slice(0, 200)}`))
              break
            }
          }
        }
        // Later output is drained and dropped: the loop is the server's life.
      }
    } finally {
      settle(new Error(`it stopped before it was ready${errors.trim() ? `: ${errors.trim()}` : '.'}`))
      // Leaving the loop kills the child; return() makes sure of it when we left by stop.
      await Promise.race([Promise.resolve(pieces.return?.(undefined as never)).catch(() => undefined), wait($, STOP_WAIT_MS)])
    }
  })().catch((err: unknown) => settle(new Error((err as Error)?.message ?? String(err))))
  entry.ended = loop
  const mine = running.get(session) ?? new Set<Entry>()
  mine.add(entry)
  running.set(session, mine)
  void loop.finally(() => forget(session, entry))
  // A no-op once ready (the promise has settled), and when the host refuses the wait.
  $.clock.sleep(READY_TIMEOUT_MS).then(
    () => settle(new Error(`it was not ready within ${READY_TIMEOUT_MS / 1000} s.`)),
    () => undefined,
  )
  return { entry, ready }
}

function forget(session: string, entry: Entry) {
  const mine = running.get(session)
  mine?.delete(entry)
  if (mine?.size === 0) running.delete(session)
}

// The host's clock (hooks have no timers of their own); a refused wait ends at once.
function wait($: EngineInterface, ms: number) {
  return $.clock.sleep(ms).catch(() => undefined)
}

// Ends one server: leaves its loop (which kills the holder), waits for that,
// then sends the server itself a `kill` in case the host has not yet.
async function stopEntry($: EngineInterface, session: string, entry: Entry) {
  entry.stop()
  await Promise.race([entry.ended, wait($, STOP_WAIT_MS)])
  if (entry.pid !== undefined) await $.process.run(['kill', String(entry.pid)], { timeoutMs: KILL_TIMEOUT_MS }).catch(() => undefined)
  forget(session, entry)
}

// The Claude process this hook runs under: the parent of a shell we start (null when it cannot be read).
async function claudePid($: EngineInterface) {
  try {
    const ran = await $.process.run(['sh', '-c', 'echo $PPID'], { timeoutMs: ALIVE_TIMEOUT_MS })
    const pid = Number(ran.stdout.trim())
    return ran.exitCode === 0 && Number.isInteger(pid) && pid > 1 && (await isAlive($, pid)) ? pid : null
  } catch {
    return null
  }
}

// Runs bin/ui-users.ts; the number of live users left, or undefined when it failed.
async function usersOp($: EngineInterface, plugin: string, args: string[]) {
  try {
    const ran = await $.process.run(['bun', `${plugin}/bin/ui-users.ts`, ...args], { timeoutMs: ALIVE_TIMEOUT_MS })
    if (ran.exitCode !== 0) return undefined
    const live = (JSON.parse(ran.stdout) as { live?: unknown }).live
    return typeof live === 'number' ? live : undefined
  } catch {
    return undefined
  }
}

// This session uses the server from now on: it is listed with its Claude process id.
// `fresh`: a server just started, so no earlier list belongs to it and this session is the only user.
async function join($: EngineInterface, paths: UiPaths, session: string, fresh = false) {
  joined.set(session, { plugin: paths.plugin, root: paths.root })
  const pid = await claudePid($)
  await usersOp($, paths.plugin, [fresh ? 'reset' : 'add', `${paths.root}/${UI_USERS}`, session, pid === null ? '-' : String(pid)])
}

type StartedWith = { extraction?: string; embeddings?: string }

/** The settings the server `pid` was started with, or undefined when none is recorded for it. */
async function startedWith($: EngineInterface, root: string, pid: number): Promise<StartedWith | undefined> {
  try {
    const recorded = JSON.parse(await $.fs.read(`${root}/${EXTRACTION_STATE}`)) as {
      pid?: unknown
      extraction?: unknown
      embeddings?: unknown
    }
    if (recorded?.pid !== pid) return undefined
    return {
      extraction: typeof recorded.extraction === 'string' ? recorded.extraction : undefined,
      embeddings: typeof recorded.embeddings === 'string' ? recorded.embeddings : undefined,
    }
  } catch {
    return undefined
  }
}

// A reused dashboard keeps the settings it started with (C11, KNOWX.2.a9, EMB.3.a2): when a setting
// differs now, the reply says the dashboard must be restarted. A server with no record predates it.
async function restartNote($: EngineInterface, paths: UiPaths, state: State) {
  if (paths.extraction === undefined && paths.embeddings === undefined) return ''
  const was = await startedWith($, paths.root, state.pid)
  const changed: string[] = []
  if (paths.extraction !== undefined && was?.extraction !== paths.extraction) {
    const before = was?.extraction === undefined ? 'no extraction setting' : `extractionModel "${was.extraction}"`
    changed.push(`started with ${before}, and extractionModel is "${paths.extraction}" now`)
  }
  if (paths.embeddings !== undefined && was?.embeddings !== paths.embeddings) {
    const before = was?.embeddings === undefined ? 'no embeddings setting' : `embeddings "${was.embeddings}"`
    changed.push(`started with ${before}, and embeddings is "${paths.embeddings}" now`)
  }
  if (changed.length === 0) return ''
  return ` (this dashboard ${changed.join('; ')}. A running dashboard keeps what it started with: end the session that started it, then run /mnemosyne-ui again to restart it)`
}

// Records, mode 0600 and renamed into place, the settings the server `pid` started with.
async function recordStartedWith($: EngineInterface, paths: UiPaths, pid: number) {
  if (paths.extraction === undefined && paths.embeddings === undefined) return
  const code =
    'const fs = require("fs"); const a = process.argv.slice(1); const t = a[0] + ".tmp"; fs.rmSync(t, { force: true }); fs.writeFileSync(t, a[1], { mode: 0o600, flag: "wx" }); fs.chmodSync(t, 0o600); fs.renameSync(t, a[0]);'
  const record = JSON.stringify({ pid, extraction: paths.extraction, embeddings: paths.embeddings })
  // run() resolves on a non-zero exit, so the exit code is checked too: a failed write must not pass as done.
  await $.process
    .run(['bun', '-e', code, `${paths.root}/${EXTRACTION_STATE}`, `${record}\n`], { timeoutMs: ALIVE_TIMEOUT_MS })
    .then(ran => (ran.exitCode === 0 ? undefined : Promise.reject(new Error(ran.stderr))))
    .catch(() => undefined)
}

/** The command's answer: reuse the server ui.json names while it answers, else start one for `session`. */
export async function openDashboard($: EngineInterface, paths: UiPaths, session: string) {
  const known = await readState($, paths.root)
  if (known !== undefined) {
    // Asked twice: one slow answer does not replace a working server.
    if ((await answers($, paths.plugin, known)) || (await answers($, paths.plugin, known))) {
      await join($, paths, session)
      return handOver($, known, 'running', await restartNote($, paths, known))
    }
    // This session's own server, still running, is never killed for a missed ping.
    const own = [...(running.get(session) ?? [])].find(entry => entry.pid === known.pid)
    if (own !== undefined && (await isAlive($, known.pid))) {
      await join($, paths, session)
      return handOver($, known, 'running', `${await restartNote($, paths, known)} (it did not answer a health check just now; if the page does not load, run /mnemosyne-ui again)`)
    }
  }
  // This session's servers whose process is gone make way for the new one (one
  // still starting has no pid yet and is left to its own call).
  for (const entry of [...(running.get(session) ?? [])]) {
    if (entry.pid !== undefined && !(await isAlive($, entry.pid))) await stopEntry($, session, entry)
  }

  const { entry, ready } = start($, paths, session)
  const up = await ready
  if (up instanceof Error) {
    await stopEntry($, session, entry)
    return { text: `Mnemosyne dashboard did not start: ${up.message}` }
  }
  const state = await readState($, paths.root)
  if (state !== undefined && state.pid === up.pid && state.port === up.port) {
    await recordStartedWith($, paths, up.pid)
    await join($, paths, session, true)
    return handOver($, state, 'started')
  }
  // Another start won ui.json in the meantime: hand its server over and stop ours.
  if (state !== undefined && state.pid !== up.pid && (await answers($, paths.plugin, state))) {
    await stopEntry($, session, entry)
    await join($, paths, session)
    return handOver($, state, 'running', await restartNote($, paths, state))
  }
  await stopEntry($, session, entry)
  return { text: `Mnemosyne dashboard did not start: ${paths.root}/${UI_STATE} does not name the new server.` }
}

/**
 * session.end: this session stops using the server. The server stops with its last user: the servers this session
 * started are stopped when no other live session uses the dashboard (they only lose their holder otherwise, and
 * keep running for the others), and a server it only reused is stopped when it was the last user.
 */
export async function stopDashboard($: EngineInterface, session: string) {
  const mine = [...(running.get(session) ?? [])]
  const used = joined.get(session)
  joined.delete(session)
  // Failing to update the list reads as "no one else": the server stops with its session, as it always did.
  const others = used === undefined ? 0 : ((await usersOp($, used.plugin, ['remove', `${used.root}/${UI_USERS}`, session])) ?? 0)
  if (others > 0) {
    // The holder ends; the server, its stdin closed, sees the others in the list and stays.
    await Promise.all(
      mine.map(async entry => {
        entry.stop()
        await Promise.race([entry.ended, wait($, STOP_WAIT_MS)])
        forget(session, entry)
      }),
    )
    return
  }
  await Promise.all(mine.map(entry => stopEntry($, session, entry)))
  // A server this session only reused (its starter has ended), and it was the last user: stop it, if it is ours.
  if (mine.length === 0 && used !== undefined) {
    const state = await readState($, used.root)
    if (state !== undefined && (await answers($, used.plugin, state))) {
      await $.process.run(['kill', String(state.pid)], { timeoutMs: KILL_TIMEOUT_MS }).catch(() => undefined)
    }
  }
}
