// Claude Mnemosyne - who is using the dashboard server.
//
// <root>/ui-users.json beside ui.json lists the Claude sessions that opened or reused the server:
//   { "users": [ { "session": "<id>", "pid": <the session's Claude process, or null>, "at": <ms>, "start": "<its ps lstart>" } ] }
// The server stays up while at least one of them is live, whichever session started it. A user is
// live when its process still runs (`kill -0`) and still has the start time recorded with it (so a pid
// reused after a crash does not count), so a session that crashed without a session.end
// cannot keep the server up; a user whose pid could not be read is kept for UNKNOWN_PID_MAX_MS after
// it last opened or reused the dashboard (each /mnemosyne-ui call lists it again with a fresh `at`).
//
// The hooks cannot write files atomically, so they run this file as a script:
//   bun bin/ui-users.ts add <file> <session> <pid|->        prints {"live":<n>}
//   bun bin/ui-users.ts leave <file> <session> [<pid>...]   prints {"live":<n>,"listed":<bool>,"stopped":[<pid>...]}
// `add` lists (or lists again) a session; `leave` takes it off and, when no live user is left, sends
// SIGTERM to the server: the pids given (the servers this session started) and the one ui.json names,
// each only while its command line is a dashboard server's. Both drop dead users as they go. The
// server imports liveUsers().
//
// Every change is one read-modify-write under <file>.lock (created with O_EXCL), so two sessions
// changing the list at once both land. A lock whose holder process is gone, or older than
// LOCK_STALE_MS, is broken; a change that cannot get the lock in time (ADD_LOCK_WAIT_MS for add,
// LOCK_WAIT_MS for leave) fails (exit 1): the hook tries an add again, and a failed leave kills nothing. There is no reset: a list left by an earlier server only names
// sessions still running (or not yet past UNKNOWN_PID_MAX_MS), and each of them leaves at its end.
// The file is written owner-only (0600) through a temp file and a rename, so readers never see half.
import { chmodSync, closeSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'

export const UI_USERS = 'ui-users.json'
export const UI_STATE = 'ui.json'
// A user with no pid is kept this long after it last joined: long enough for a working session that
// keeps the page open, short enough that a crashed one does not hold the server up for half a day.
export const UNKNOWN_PID_MAX_MS = 2 * 60 * 60 * 1000
// A change takes a few milliseconds; a lock this old was left by a holder that hung or died.
export const LOCK_STALE_MS = 5_000
// How long `leave` waits for another change's lock (kept well under the hook's 1 s leave timeout).
export const LOCK_WAIT_MS = 500
// How long `add` waits (the hook gives each add run 3 s): many sessions opening the dashboard at once
// queue up here instead of failing (a stress run of 40 at once saw some exceed 500 ms).
export const ADD_LOCK_WAIT_MS = 2_000

// `start`: when the process `pid` started (`ps -o lstart=`), so a pid the system hands to another process
// after a crash is not taken for the session; absent when it could not be read (then the pid alone counts).
export type User = { session: string; pid: number | null; at: number; start?: string }
export type Alive = (pid: number) => boolean
export type StartOf = (pid: number) => string | undefined

/** Whether a process runs: a signal 0 that is refused for permission still means it exists. */
export const processAlive: Alive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** When `pid` started, as `ps -o lstart=` prints it (C locale, UTC, so a zone change never makes a live user look dead); undefined when it is gone or ps cannot run. */
export const processStart: StartOf = pid => {
  try {
    const ran = Bun.spawnSync(['ps', '-o', 'lstart=', '-p', String(pid)], { env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' }, stdout: 'pipe', stderr: 'ignore' })
    const start = ran.stdout.toString().trim()
    return ran.exitCode === 0 && start !== '' ? start : undefined
  } catch {
    return undefined
  }
}

const isUser = (value: unknown): value is User => {
  const user = value as Partial<User> | null
  return (
    typeof user?.session === 'string' &&
    user.session !== '' &&
    (user.pid === null || (typeof user.pid === 'number' && Number.isInteger(user.pid) && user.pid > 1)) &&
    typeof user.at === 'number' &&
    Number.isFinite(user.at) &&
    (user.start === undefined || (typeof user.start === 'string' && user.start !== ''))
  )
}

/** The users the file holds (any that is malformed is left out); none when it is missing or broken. */
export function readUsers(file: string): User[] {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { users?: unknown }
    return Array.isArray(parsed?.users) ? parsed.users.filter(isUser) : []
  } catch {
    return []
  }
}

// Live: an unknown pid within its window; a known one while it runs and, when its start time was
// recorded, still started then (a reused pid has another start time). No start time now (ps cannot
// run) falls back to the pid alone.
function live(user: User, now: number, alive: Alive, startOf: StartOf) {
  if (user.pid === null) return now - user.at < UNKNOWN_PID_MAX_MS
  if (!alive(user.pid)) return false
  if (user.start === undefined) return true
  const start = startOf(user.pid)
  return start === undefined || start === user.start
}

/** The users whose process still runs. */
export function liveUsers(file: string, now = Date.now(), alive: Alive = processAlive, startOf: StartOf = processStart): User[] {
  return readUsers(file).filter(user => live(user, now, alive, startOf))
}

function writeUsers(file: string, users: User[]) {
  const temp = `${file}.${process.pid}.tmp`
  rmSync(temp, { force: true })
  const fd = openSync(temp, 'wx', 0o600)
  try {
    writeSync(fd, `${JSON.stringify({ users })}\n`)
  } finally {
    closeSync(fd)
  }
  chmodSync(temp, 0o600)
  renameSync(temp, file)
}

// ---- The lock: <file>.lock holds "<pid> <random>" of the change that holds it ----

const holderPid = (token: string) => Number(token.split(' ')[0])

function readLock(path: string): { token: string; age: number } | undefined {
  try {
    return { token: readFileSync(path, 'utf8'), age: Date.now() - statSync(path).mtimeMs }
  } catch {
    return undefined
  }
}

/** Whether a lock was left behind: its holder is gone, or it is older than any change takes. */
export function lockIsStale(lock: { token: string; age: number }, alive: Alive = processAlive) {
  const pid = holderPid(lock.token)
  return !(Number.isInteger(pid) && pid > 1 && alive(pid)) || lock.age > LOCK_STALE_MS
}

// Breaks a stale lock: moves it aside (only one breaker's rename succeeds) and deletes it when it is
// the one judged stale; a fresh lock moved aside by a late breaker is put back when the place is free.
function breakLock(path: string, stale: string) {
  const aside = `${path}.${process.pid}.${randomBytes(4).toString('hex')}`
  try {
    renameSync(path, aside)
  } catch {
    return
  }
  let moved = ''
  try {
    moved = readFileSync(aside, 'utf8')
  } catch {
    // gone already
  }
  if (moved !== stale) {
    try {
      linkSync(aside, path)
    } catch {
      // another change holds the place now
    }
  }
  rmSync(aside, { force: true })
}

/** Takes <file>.lock (waiting up to `waitMs` for another change), runs `body`, and lets go of it. */
export function withLock<T>(file: string, body: () => T, waitMs = LOCK_WAIT_MS, alive: Alive = processAlive): T {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  const path = `${file}.lock`
  const token = `${process.pid} ${randomBytes(8).toString('hex')}`
  // The token is written to a file of our own first and then linked into place (a link fails when the
  // name exists, as O_EXCL does), so the lock never exists without its holder: a lock read empty in the
  // instant between create and write would look stale and be broken under its live holder.
  const mine = `${path}.${process.pid}.${randomBytes(4).toString('hex')}`
  const fd = openSync(mine, 'wx', 0o600)
  try {
    writeSync(fd, token)
  } finally {
    closeSync(fd)
  }
  const deadline = Date.now() + waitMs
  try {
    while (true) {
      try {
        linkSync(mine, path)
        break
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
      }
      const held = readLock(path)
      if (held !== undefined && lockIsStale(held, alive)) {
        breakLock(path, held.token)
        continue
      }
      if (Date.now() >= deadline) throw new Error(`${path} is held by another change`)
      Bun.sleepSync(5)
    }
  } finally {
    rmSync(mine, { force: true })
  }
  try {
    return body()
  } finally {
    // Let go only of our own lock (one broken as stale and taken by another is theirs now).
    if (readLock(path)?.token === token) rmSync(path, { force: true })
  }
}

/**
 * Adds (or lists again, with a fresh `at`) `add`, drops `remove`'s session and every dead user, writes the file, and
 * answers who is left. An add with no pid (the hook's lookup failed this time) keeps the pid and start time a live
 * listing of the same session already has.
 */
export function updateUsers(
  file: string,
  change: { add?: User; remove?: string },
  now = Date.now(),
  alive: Alive = processAlive,
  waitMs = LOCK_WAIT_MS,
  startOf: StartOf = processStart,
): User[] {
  return withLock(
    file,
    () => {
      const before = liveUsers(file, now, alive, startOf)
      let add = change.add
      const known = add?.pid === null ? before.find(user => user.session === add?.session && user.pid !== null) : undefined
      if (add !== undefined && known !== undefined) add = { ...add, pid: known.pid, ...(known.start === undefined ? {} : { start: known.start }) }
      const users = before.filter(user => user.session !== change.add?.session && user.session !== change.remove)
      if (add !== undefined) users.push(add)
      writeUsers(file, users)
      return users
    },
    waitMs,
    alive,
  )
}

/** Whether `pid` runs the dashboard server (ui/server.ts itself, not its holder or a ping); false when it cannot be read. */
export function isDashboardServer(pid: number) {
  try {
    const ran = Bun.spawnSync(['ps', '-o', 'args=', '-p', String(pid)], { stdout: 'pipe', stderr: 'ignore' })
    const args = ran.stdout.toString().trim()
    return ran.exitCode === 0 && /[\\/]ui[\\/]server\.ts(\s|$)/.test(args) && !/\s--(hold|ping)(\s|$)/.test(args)
  } catch {
    return false
  }
}

/** The server pid ui.json beside `file` names, if any. */
function statePid(file: string): number | undefined {
  try {
    const pid = (JSON.parse(readFileSync(join(dirname(file), UI_STATE), 'utf8')) as { pid?: unknown }).pid
    return typeof pid === 'number' && Number.isInteger(pid) && pid > 1 ? pid : undefined
  } catch {
    return undefined
  }
}

export type Left = { live: number; listed: boolean; stopped: number[] }

/**
 * session.end, in one process: takes `session` off the list and, when no live user is left, sends
 * SIGTERM to `servers` and the server ui.json names (each only while it runs ui/server.ts). The decision
 * and the signals happen under the lock, so an `add` waits until the server is signalled and then sees
 * it stopping (its ping fails and it starts a new one), rather than joining a server about to stop.
 */
export function leaveUsers(
  file: string,
  session: string,
  servers: number[],
  now = Date.now(),
  alive: Alive = processAlive,
  isServer: (pid: number) => boolean = isDashboardServer,
  startOf: StartOf = processStart,
): Left {
  return withLock(
    file,
    () => {
      const before = readUsers(file)
      const listed = before.some(user => user.session === session)
      const left = before.filter(user => user.session !== session && live(user, now, alive, startOf))
      writeUsers(file, left)
      const stopped: number[] = []
      if (left.length === 0) {
        const named = statePid(file)
        for (const pid of new Set([...servers, ...(named === undefined ? [] : [named])])) {
          if (!isServer(pid)) continue
          try {
            process.kill(pid, 'SIGTERM')
            stopped.push(pid)
          } catch {
            // gone already
          }
        }
      }
      return { live: left.length, listed, stopped }
    },
    LOCK_WAIT_MS,
    alive,
  )
}

const USAGE = 'usage: ui-users.ts add <file> <session> <pid|-> | leave <file> <session> [<server pid>...]'

if (import.meta.main) {
  const [action, file, session, ...rest] = process.argv.slice(2)
  try {
    if (!file || !session || (action !== 'add' && action !== 'leave')) throw new Error(USAGE)
    if (action === 'add') {
      const number = Number(rest[0])
      const pid = Number.isInteger(number) && number > 1 ? number : null
      const start = pid === null ? undefined : processStart(pid)
      const now = Date.now()
      const add: User = { session, pid, at: now, ...(start === undefined ? {} : { start }) }
      const users = updateUsers(file, { add }, now, processAlive, ADD_LOCK_WAIT_MS)
      process.stdout.write(`${JSON.stringify({ live: users.length })}\n`)
    } else {
      const servers = rest.map(Number).filter(pid => Number.isInteger(pid) && pid > 1)
      process.stdout.write(`${JSON.stringify(leaveUsers(file, session, servers))}\n`)
    }
  } catch (err) {
    process.stderr.write(`ui-users: ${(err as Error).message}\n`)
    process.exit(1)
  }
}
