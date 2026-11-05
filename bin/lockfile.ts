// Claude Mnemosyne — the one try-lock (moved from bin/activity.ts, SA.2).
//
// takeLock(file, staleMs) creates `file` with O_EXCL and closes it at once (on
// Windows an open handle would block a later rename). It never waits: it
// returns the file when this caller holds the lock, undefined otherwise.
// Imports nothing from the host, so the proxy and the installer can load it.
import { closeSync, linkSync, openSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs'

const isStale = (file: string, staleMs: number) => Date.now() - statSync(file).mtimeMs > staleMs

// A lock older than staleMs (by mtime, the only stale test) is first renamed to
// a name of this caller's own: of two callers that both saw it stale, only one
// rename succeeds. If what was renamed is fresh, it was a lock another caller
// had just taken, so it is linked back (link, like O_EXCL, never replaces) and
// this caller does not hold the lock. `note` (a pid and a time, for people) is
// written before the file is closed; nothing ever reads it.
export function takeLock(file: string, staleMs: number, note = '') {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx', 0o600)
      try {
        if (note) writeSync(fd, note)
      } finally {
        closeSync(fd)
      }
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
        // another caller moved it first: the next attempt finds its lock or none
      }
    }
  }
  return undefined
}
