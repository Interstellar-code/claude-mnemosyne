// Claude Mnemosyne - who is using the dashboard server.
//
// <root>/ui-users.json beside ui.json lists the Claude sessions that opened or reused the server:
//   { "users": [ { "session": "<id>", "pid": <the session's Claude process, or null>, "at": <ms> } ] }
// The server stays up while at least one of them is live, whichever session started it. A user is
// live when its process still runs (`kill -0`), so a session that crashed without a session.end
// cannot keep the server up; a user whose pid could not be read is kept for UNKNOWN_PID_MAX_MS only.
//
// The hooks cannot write files atomically, so they run this file as a script:
//   bun bin/ui-users.ts add|reset <file> <session> <pid|-> | remove <file> <session>
// (`reset` starts the list again with this one user: a server just started has no earlier users)
// which prints {"live":<n>} (the users left, dead ones dropped). The server imports liveUsers().
// The file is written owner-only (0600) through a temp file and a rename. Two sessions changing it
// at the same instant can lose one change; the pid check drops a lost user once its process ends.
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import { dirname } from 'node:path'

export const UI_USERS = 'ui-users.json'
// A user with no pid is kept this long after it joined.
export const UNKNOWN_PID_MAX_MS = 12 * 60 * 60 * 1000

export type User = { session: string; pid: number | null; at: number }
export type Alive = (pid: number) => boolean

/** Whether a process runs: a signal 0 that is refused for permission still means it exists. */
export const processAlive: Alive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'
  }
}

const isUser = (value: unknown): value is User => {
  const user = value as Partial<User> | null
  return (
    typeof user?.session === 'string' &&
    user.session !== '' &&
    (user.pid === null || (typeof user.pid === 'number' && Number.isInteger(user.pid) && user.pid > 1)) &&
    typeof user.at === 'number' &&
    Number.isFinite(user.at)
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

const live = (user: User, now: number, alive: Alive) => (user.pid === null ? now - user.at < UNKNOWN_PID_MAX_MS : alive(user.pid))

/** The users whose process still runs. */
export function liveUsers(file: string, now = Date.now(), alive: Alive = processAlive): User[] {
  return readUsers(file).filter(user => live(user, now, alive))
}

function writeUsers(file: string, users: User[]) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
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

/** Adds (or replaces) `add`, drops `remove`'s session and every dead user, writes the file, and answers who is left. */
export function updateUsers(file: string, change: { add?: User; remove?: string; only?: boolean }, now = Date.now(), alive: Alive = processAlive): User[] {
  const users = (change.only === true ? [] : liveUsers(file, now, alive)).filter(user => user.session !== change.add?.session && user.session !== change.remove)
  if (change.add !== undefined) users.push(change.add)
  writeUsers(file, users)
  return users
}

if (import.meta.main) {
  const [action, file, session, pid] = process.argv.slice(2)
  try {
    if (!file || !session || (action !== 'add' && action !== 'reset' && action !== 'remove')) throw new Error('usage: ui-users.ts add|reset <file> <session> <pid|-> | remove <file> <session>')
    const number = Number(pid)
    const users = updateUsers(file, action === 'remove' ? { remove: session } : { add: { session, pid: Number.isInteger(number) && number > 1 ? number : null, at: Date.now() }, only: action === 'reset' })
    process.stdout.write(`${JSON.stringify({ live: users.length })}\n`)
  } catch (err) {
    process.stderr.write(`ui-users: ${(err as Error).message}\n`)
    process.exit(1)
  }
}
