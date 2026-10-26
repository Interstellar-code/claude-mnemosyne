// /mnemosyne-ui: start the dashboard server (ui/server.ts), or reuse the one
// running, open its link in the default browser and show it in the reply
// (DESIGN.md §3.3, "The dashboard server").
//
// One server is shared: any session's later call pings the server ui.json
// names and reuses it while it answers. Every session that opens or reuses it
// is listed in <root>/ui-users.json (bin/ui-users.ts, with its Claude process id),
// and the server stays up until the last of them is gone. A session's
// session.end (any reason, /clear included) runs one `bin/ui-users.ts leave`:
// it takes the session off the list and, when no live user is left, sends the
// server SIGTERM. At the same time the session ends the spawn loops of the
// servers it started, which kills their holder processes (whose pipe was the
// server's stdin); a server that loses its holder stays while the list names a
// live session. Whenever the list cannot be read or changed, nothing is killed:
// the server's own backstops (stdin closing, its parent vanishing, and its poll
// of the list) end it once no listed session's process runs.
import type { EngineInterface } from 'claude-code'
import { CLAUDE_PID_SCRIPT, claudeFromChain } from './ui-pid'

export const UI_STATE = 'ui.json'
// The sessions using the server (bin/ui-users.ts writes it; ui/server.ts reads it).
export const UI_USERS = 'ui-users.json'
// What the running dashboard started with. ui.json is the server's own file ({port, token, pid}),
// so the hook keeps the extraction setting beside it: { pid, extraction } for the server it started.
export const EXTRACTION_STATE = 'ui-extraction.json'
export const PING_TIMEOUT_MS = 3_000
export const READY_TIMEOUT_MS = 20_000
// Waiting for a spawn loop to end; a `kill` of a server this session started and no longer wants.
export const STOP_WAIT_MS = 600
export const KILL_TIMEOUT_MS = 500
export const ALIVE_TIMEOUT_MS = 1_000
export const OPEN_TIMEOUT_MS = 5_000
// Listing a session (`add`, when /mnemosyne-ui answers): a cold `bun` start can take a few hundred
// ms on a busy machine, so each try gets USERS_TIMEOUT_MS and a failed one is tried once more.
export const USERS_TIMEOUT_MS = 3_000
export const USERS_TRIES = 2
// session.end has 1.5 s in all (SessionEndInput). Its path is one fs.read of the list and one
// `leave` run (bounded by LEAVE_TIMEOUT_MS), with the spawn loops ending (STOP_WAIT_MS) beside it.
export const SESSION_END_BUDGET_MS = 1_500
export const LEAVE_TIMEOUT_MS = 1_000

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
// The sessions this process listed in ui-users.json, with the plugin and root they used and the Claude pid last read for them.
const joined = new Map<string, { plugin: string; root: string; pid?: number }>()

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

// The Claude process this hook runs under: the nearest `claude` above a shell we start (hooks/ui-pid.ts),
// or null when there is none or it cannot be read.
async function claudePid($: EngineInterface) {
  try {
    const ran = await $.process.run(['sh', '-c', CLAUDE_PID_SCRIPT], { timeoutMs: ALIVE_TIMEOUT_MS })
    return ran.exitCode === 0 ? claudeFromChain(ran.stdout) : null
  } catch {
    return null
  }
}

type UsersAnswer = { live: number; listed?: boolean; stopped?: number[] }

// Runs bin/ui-users.ts; its answer, or undefined when every try failed (no answer is never "no users").
async function usersOp($: EngineInterface, plugin: string, args: string[], timeoutMs: number, tries: number): Promise<UsersAnswer | undefined> {
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const ran = await $.process.run(['bun', `${plugin}/bin/ui-users.ts`, ...args], { timeoutMs })
      if (ran.exitCode !== 0) continue
      const answer = JSON.parse(ran.stdout) as Partial<UsersAnswer>
      if (typeof answer.live === 'number') return answer as UsersAnswer
    } catch {
      // timed out or could not start: try again while tries are left
    }
  }
  return undefined
}

// This session uses the server from now on: it is listed (again, with a fresh time) with its Claude
// process id. Whether that worked: a session that could not be listed is told so in the reply.
// A lookup that fails this time (a slow `ps`) keeps the pid read before: a session is never relisted as unknown
// for it (and bin/ui-users.ts keeps a listed pid and start time on a `-` too, for a reloaded module).
async function join($: EngineInterface, paths: UiPaths, session: string) {
  const pid = (await claudePid($)) ?? joined.get(session)?.pid ?? null
  joined.set(session, { plugin: paths.plugin, root: paths.root, ...(pid === null ? {} : { pid }) })
  const answer = await usersOp($, paths.plugin, ['add', `${paths.root}/${UI_USERS}`, session, pid === null ? '-' : String(pid)], USERS_TIMEOUT_MS, USERS_TRIES)
  return answer !== undefined
}

const NOT_LISTED = ' (this session could not be listed as one using the dashboard, so it may stop when another session ends; run /mnemosyne-ui again to retry)'

// Whether ui-users.json lists `session`: the lookup that survives a reload of this module (its maps start empty).
async function listedIn($: EngineInterface, root: string, session: string) {
  try {
    const users = (JSON.parse(await $.fs.read(`${root}/${UI_USERS}`)) as { users?: unknown }).users
    return Array.isArray(users) && users.some(user => (user as { session?: unknown } | null)?.session === session)
  } catch {
    return false
  }
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
      const listed = await join($, paths, session)
      return handOver($, known, 'running', `${await restartNote($, paths, known)}${listed ? '' : NOT_LISTED}`)
    }
    // This session's own server, still running, is never killed for a missed ping.
    const own = [...(running.get(session) ?? [])].find(entry => entry.pid === known.pid)
    if (own !== undefined && (await isAlive($, known.pid))) {
      const listed = await join($, paths, session)
      return handOver(
        $,
        known,
        'running',
        `${await restartNote($, paths, known)} (it did not answer a health check just now; if the page does not load, run /mnemosyne-ui again)${listed ? '' : NOT_LISTED}`,
      )
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
    // A plain add, never a reset: a session that reused this server between its ui.json and this
    // line is already listed and must stay listed. Users left from an earlier server are live
    // sessions (dead ones are dropped on every change), and each leaves at its own session.end.
    const listed = await join($, paths, session)
    return handOver($, state, 'started', listed ? '' : NOT_LISTED)
  }
  // Another start won ui.json in the meantime: hand its server over and stop ours.
  if (state !== undefined && state.pid !== up.pid && (await answers($, paths.plugin, state))) {
    await stopEntry($, session, entry)
    const listed = await join($, paths, session)
    return handOver($, state, 'running', `${await restartNote($, paths, state)}${listed ? '' : NOT_LISTED}`)
  }
  await stopEntry($, session, entry)
  return { text: `Mnemosyne dashboard did not start: ${paths.root}/${UI_STATE} does not name the new server.` }
}

// Ends one spawn loop (which kills its holder) and waits for it, at most STOP_WAIT_MS; the server itself is not signalled.
async function endLoop($: EngineInterface, session: string, entry: Entry) {
  entry.stop()
  await Promise.race([entry.ended, wait($, STOP_WAIT_MS)])
  forget(session, entry)
}

/**
 * session.end: this session stops using the server, which stops with its last user. One `bin/ui-users.ts leave`
 * takes the session off the list and, when no live user is left, sends SIGTERM to the server (the ones this
 * session started and the one ui.json names); beside it, the spawn loops this session started end. `where` is
 * the plugin and root for this session, read from the settings, so a session is found in ui-users.json even
 * after this module was reloaded and its maps are empty. No answer from `leave` kills nothing: the server's own
 * poll of the list ends it once no listed session's process runs.
 */
export async function stopDashboard($: EngineInterface, session: string, where?: { plugin: string; root: string }) {
  const mine = [...(running.get(session) ?? [])]
  const known = joined.get(session)
  joined.delete(session)
  const used = known ?? where
  const loops = Promise.all(mine.map(entry => endLoop($, session, entry)))
  if (used === undefined) return void (await loops)
  // Only a session that used the dashboard runs a process here: every other session.end is one fs.read.
  if (known === undefined && mine.length === 0 && !(await listedIn($, used.root, session))) return void (await loops)
  const servers = mine.flatMap(entry => (entry.pid === undefined ? [] : [String(entry.pid)]))
  await Promise.all([usersOp($, used.plugin, ['leave', `${used.root}/${UI_USERS}`, session, ...servers], LEAVE_TIMEOUT_MS, 1), loops])
}
