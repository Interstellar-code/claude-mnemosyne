// Claude Mnemosyne — the project registry writer (C12 in the solar-map plan).
//
// writeProjects(path, input) records one project in <root>/projects.json: which
// owner it is, its name, whether it is a git repo or a plain folder, and its
// remote's host. The hooks cannot write a file, so they run this file as a script:
//   bun bin/projects.ts write <path>   (one JSON record on stdin)
//
// The path is a required argument with no default, so the script never reaches the
// real Mnemosyne root by itself, and only a file named projects.json is written.
// The folder is created owner-only (0700) and the file is set to 0600 at every
// write. The new text goes to a temp file that is renamed over the old one, under a
// <path>.lock taken with O_EXCL (a lock older than LOCK_STALE_MS is taken over; a
// writer that cannot get it gives up, and the next session start records the
// project). firstSeen is kept, lastSeen is today's UTC date, and a registry that is
// corrupt is rebuilt. Every error is swallowed and the script always exits 0: a
// registry must never break the session that records it.
import { chmodSync, closeSync, existsSync, fchmodSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { formatProjects, mergeProject, parseProjects, PROJECTS_FILE, sanitizeInput } from '../hooks/projects'

// The script's own cap: a hook's detached run (spawn mode) has no host timeout.
export const SCRIPT_TIMEOUT_MS = 5_000
export const LOCK_STALE_MS = 10_000
export const LOCK_WAIT_MS = 50
export const LOCK_TRIES = 40

const isWindows = process.platform === 'win32'

const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** Today's date in UTC, YYYY-MM-DD. */
export const utcToday = () => new Date().toISOString().slice(0, 10)

function lock(path: string): string | undefined {
  const file = `${path}.lock`
  for (let attempt = 0; attempt < LOCK_TRIES; attempt++) {
    try {
      closeSync(openSync(file, 'wx', 0o600))
      return file
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') return undefined
      try {
        // A writer that died holding the lock must not block the registry for good.
        if (Date.now() - statSync(file).mtimeMs > LOCK_STALE_MS) unlinkSync(file)
      } catch {
        // another writer moved it first: the next attempt finds its lock or none
      }
      sleep(LOCK_WAIT_MS)
    }
  }
  return undefined
}

/** The registry's text, '' when there is no file; throws on any other read error (so an unreadable file is never overwritten). */
function readRegistry(path: string) {
  try {
    return readFileSync(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw err
  }
}

/**
 * Records `input` (a ProjectInput, or its JSON text) in the registry at `path`.
 * Returns true when the registry holds it afterwards, false when the record or the
 * path was refused or the write failed. Never throws.
 */
export function writeProjects(path: string, input: unknown, today: string = utcToday()) {
  let temp: string | undefined
  let held: string | undefined
  try {
    const record = sanitizeInput(input)
    if (record === null || typeof path !== 'string' || basename(path) !== PROJECTS_FILE) return false
    const folder = dirname(path)
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true, mode: 0o700 })
      if (!isWindows) chmodSync(folder, 0o700)
    }
    held = lock(path)
    if (held === undefined) return false
    const before = readRegistry(path)
    const text = formatProjects(mergeProject(parseProjects(before), record, today))
    if (text === before) return true
    temp = `${path}.${process.pid}.tmp`
    rmSync(temp, { force: true })
    const fd = openSync(temp, 'wx', 0o600)
    try {
      // Owner-only whatever the umask is.
      if (!isWindows) fchmodSync(fd, 0o600)
      writeSync(fd, text)
    } finally {
      closeSync(fd)
    }
    renameSync(temp, path)
    temp = undefined
    return true
  } catch {
    return false
  } finally {
    if (temp !== undefined) rmSync(temp, { force: true })
    if (held !== undefined) rmSync(held, { force: true })
  }
}

if (import.meta.main) {
  // The hooks wait on nothing, so the script caps itself and always exits 0.
  setTimeout(() => process.exit(0), SCRIPT_TIMEOUT_MS).unref()
  try {
    if (process.argv[2] === 'write' && process.argv[3] !== undefined) writeProjects(process.argv[3], await Bun.stdin.text())
  } catch {
    // stdin unreadable: nothing to write
  }
  process.exit(0)
}
