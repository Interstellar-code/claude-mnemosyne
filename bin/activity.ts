// Claude Mnemosyne — the activity log writer (C3 in the mnemosyne-ui plan).
//
// appendActivity(path, lines) appends one JSON object per line to
// <root>/activity.jsonl. The proxy and the dashboard server import it; the
// hooks cannot append to a file, so they run this file as a script:
//   bun bin/activity.ts <path>   (the lines on stdin)
//
// Only a file whose name ends in .jsonl is written. The folder is created
// owner-only (0700) and the file is set to 0600 at every open, the backup too
// (no chmod on Windows). Past MAX_BYTES the file is renamed to <path>.1, one
// backup kept; only the writer that creates <path>.lock with O_EXCL rotates, and
// it checks the size again under the lock, so two writers never rotate twice. A
// lock older than LOCK_STALE_MS is taken over. Every error is swallowed: a log
// must never break the call it records.
//
// MAPX.3: appendActivity also maintains <root>/activity-daily.json beside the
// log: per owner, per UTC day, writes/recalls counts. The log is written first;
// a tally failure never stops or throws.
import { chmodSync, closeSync, existsSync, fchmodSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

export const MAX_BYTES = 1024 * 1024
export const LOCK_STALE_MS = 10_000
// A line past this is dropped rather than written: entries are built capped (hooks/activity-log.ts).
export const MAX_LINE = 16 * 1024
// The script's own cap: a hook's detached append (spawn mode) has no host timeout.
export const SCRIPT_TIMEOUT_MS = 5_000

export type Limits = { maxBytes?: number; staleMs?: number }

export const tallyPath = (path: string) => join(dirname(path), 'activity-daily.json')

const isWindows = process.platform === 'win32'

const sizeOf = (path: string) => {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

// One JSON object per line, whole: a string must parse to an object and is
// written back compact (so it holds no newline); an object is serialized.
function normalize(line: unknown) {
  try {
    const value = typeof line === 'string' ? JSON.parse(line) : line
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    const text = JSON.stringify(value)
    return text.length <= MAX_LINE ? text : undefined
  } catch {
    return undefined
  }
}

const isStale = (file: string, staleMs: number) => Date.now() - statSync(file).mtimeMs > staleMs

// Takes <path>.lock with O_EXCL. A lock older than staleMs is first renamed to a
// name of this writer's own: of two writers that both saw it stale, only one
// rename succeeds. If what was renamed is fresh, it was a lock another writer
// had just taken, so it is linked back (link, like O_EXCL, never replaces) and
// this writer does not rotate.
function lock(path: string, staleMs: number) {
  const file = `${path}.lock`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      closeSync(openSync(file, 'wx', 0o600))
      return file
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') return undefined
      try {
        if (!isStale(file, staleMs)) return undefined
        const mine = `${file}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
        renameSync(file, mine)
        if (!isStale(mine, staleMs)) {
          try {
            linkSync(mine, file)
          } finally {
            unlinkSync(mine)
          }
          return undefined
        }
        unlinkSync(mine)
      } catch {
        // another writer moved it first: the next attempt finds its lock or none
      }
    }
  }
  return undefined
}

/**
 * Renames <path> to <path>.1 when it is past maxBytes, under the lock. Returns
 * true only when this call rotated. A writer that cannot take the lock does not
 * rotate; a writer that takes it after another rotated sees a small file and
 * leaves it.
 */
export function rotate(path: string, limits: Limits = {}) {
  const maxBytes = limits.maxBytes ?? MAX_BYTES
  const held = lock(path, limits.staleMs ?? LOCK_STALE_MS)
  if (held === undefined) return false
  try {
    // Checked again under the lock: another writer may have rotated since this one looked.
    if (sizeOf(path) <= maxBytes) return false
    renameSync(path, `${path}.1`)
    // The backup keeps the log's owner-only mode, even when the log predates it.
    if (!isWindows) chmodSync(`${path}.1`, 0o600)
    return true
  } catch {
    return false
  } finally {
    try {
      unlinkSync(held)
    } catch {
      // a stale-lock takeover by another writer already removed it
    }
  }
}

/** Appends each line as one JSON line at the end of `path`. Never throws. */
export function appendActivity(path: string, lines: readonly unknown[], limits: Limits = {}) {
  try {
    const normalized = (Array.isArray(lines) ? lines : []).map(normalize).filter((line): line is string => line !== undefined)
    if (typeof path !== 'string' || !basename(path).endsWith('.jsonl')) return
    const text = normalized.map(line => `${line}\n`).join('')
    if (text === '') return
    const folder = dirname(path)
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true, mode: 0o700 })
      if (!isWindows) chmodSync(folder, 0o700)
    }
    if (sizeOf(path) > (limits.maxBytes ?? MAX_BYTES)) rotate(path, limits)
    const fd = openSync(path, 'a', 0o600)
    try {
      // Owner-only at every open: the umask may have taken bits off a new file, and an old one may be looser.
      if (!isWindows) fchmodSync(fd, 0o600)
      // One write of the whole batch with O_APPEND: other writers' lines never land inside it.
      writeSync(fd, text)
    } finally {
      closeSync(fd)
    }
    // Tally is derived from the lines that were actually written. A tally
    // failure must never undo or stop the log write above.
    try {
      updateTally(path, normalized, limits)
    } catch {
      // swallowed: the log line is already on disk
    }
  } catch {
    // never throws: a log write must not break a memory call
  }
}

function updateTally(logPath: string, normalizedLines: readonly string[], limits: Limits) {
  const tally = tallyPath(logPath)
  const folder = dirname(logPath)
  const held = lock(tally, limits.staleMs ?? LOCK_STALE_MS)
  if (held === undefined) return
  try {
    if (!existsSync(folder)) {
      mkdirSync(folder, { recursive: true, mode: 0o700 })
      if (!isWindows) chmodSync(folder, 0o700)
    }
    const data = readTally(tally)
    if (!data.days || typeof data.days !== 'object' || Array.isArray(data.days)) data.days = Object.create(null)
    const now = new Date()
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 90))
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    for (const line of normalizedLines) {
      let entry: any
      try { entry = JSON.parse(line) } catch { continue }
      if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue
      if (entry.ok !== true) continue
      const action = entry.action
      const isWrite = action === 'remember' || action === 'update'
      const isRecall = action === 'recall'
      if (!isWrite && !isRecall) continue
      if (isRecall && entry.origin === 'ui') continue
      const owner = (typeof entry.owner === 'string' && entry.owner !== '') ? entry.owner : 'global'
      const day = utcDay(entry.t)
      const count = (typeof entry.count === 'number' && Number.isInteger(entry.count) && entry.count > 0) ? entry.count : 1
      if (!data.days[owner] || typeof data.days[owner] !== 'object' || Array.isArray(data.days[owner])) data.days[owner] = Object.create(null)
      const days = data.days[owner] as Record<string, any>
      if (!days[day] || typeof days[day] !== 'object' || Array.isArray(days[day])) days[day] = { writes: 0, recalls: 0 }
      if (typeof days[day].writes !== 'number') days[day].writes = 0
      if (typeof days[day].recalls !== 'number') days[day].recalls = 0
      if (isWrite) days[day].writes += count
      else days[day].recalls += count
    }
    // drop days older than 90
    for (const owner of Object.keys(data.days)) {
      const days = data.days[owner]
      if (!days || typeof days !== 'object' || Array.isArray(days)) { delete data.days[owner]; continue }
      for (const day of Object.keys(days)) {
        if (day < cutoffStr) delete days[day]
      }
      if (Object.keys(days).length === 0) delete data.days[owner]
    }
    const tmp = `${tally}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2)}.tmp`
    try {
      const tfd = openSync(tmp, 'w', 0o600)
      try {
        if (!isWindows) fchmodSync(tfd, 0o600)
        writeSync(tfd, JSON.stringify(data))
      } finally {
        closeSync(tfd)
      }
      renameSync(tmp, tally)
      if (!isWindows) chmodSync(tally, 0o600)
    } finally {
      try { unlinkSync(tmp) } catch {}
    }
  } finally {
    try { unlinkSync(held) } catch {}
  }
}

function readTally(path: string): { version: number; days: Record<string, any> } {
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { version: 1, days: Object.create(null) }
    const version = (typeof parsed.version === 'number') ? parsed.version : 1
    const rawDays = (parsed.days !== null && typeof parsed.days === 'object' && !Array.isArray(parsed.days)) ? parsed.days : {}
    const days = Object.create(null)
    for (const owner of Object.keys(rawDays)) {
      const rawOwnerDays = rawDays[owner]
      if (rawOwnerDays === null || typeof rawOwnerDays !== 'object' || Array.isArray(rawOwnerDays)) { days[owner] = Object.create(null); continue }
      const ownerDays = Object.create(null)
      for (const day of Object.keys(rawOwnerDays)) ownerDays[day] = rawOwnerDays[day]
      days[owner] = ownerDays
    }
    return { version, days }
  } catch {
    return { version: 1, days: Object.create(null) }
  }
}

function utcDay(t: unknown): string {
  if (typeof t !== 'string' || t.trim() === '') return new Date().toISOString().slice(0, 10)
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
  return d.toISOString().slice(0, 10)
}

if (import.meta.main) {
  // The hooks wait on nothing, so the script caps itself and always exits 0.
  setTimeout(() => process.exit(0), SCRIPT_TIMEOUT_MS).unref()
  try {
    const input = await Bun.stdin.text()
    appendActivity(process.argv[2] ?? '', input.split('\n').filter(line => line.trim() !== ''))
  } catch {
    // stdin unreadable: nothing to write
  }
  process.exit(0)
}
