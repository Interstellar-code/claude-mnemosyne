// Whether the dashboard's server is still there.
//
// The server stops when the Claude session that opened it ends (ui/server.ts), and the page
// is left open. `createWatch({ probe, onChange })` is told by the page when a request failed
// (`suspect()`); it then asks the server a cheap question (`probe`) and says through
// `onChange` when the answer turns the page from "connected" to "lost" and back. While the
// server is gone it asks again after a growing wait (1 s doubling, at most 30 s), never
// faster, and it stops asking the moment the server answers. This module imports nothing
// from ui/app.ts, so a spec drives it with a fake probe and fake timers.

/** What one probe found: the server answered, did not answer, or the link no longer works (a restart). */
export type ProbeResult = 'up' | 'down' | 'expired'
/** The timer pair the waits use; a spec passes its own to fire them by hand. */
export type WatchTimers = { set(run: () => void, ms: number): unknown; clear(handle: unknown): void }

export const PROBE_BACKOFF_MS = 1_000
export const PROBE_BACKOFF_MAX_MS = 30_000

export type Watch = {
  /** A request failed: asks the server once, unless it is already being asked. */
  suspect(): void
  /** The server answered a request (any answer): ends the loss at once. */
  reached(): void
  /** True while the server is thought gone. */
  lost(): boolean
  /** While lost: milliseconds until the next check (0 when one is running now); null when no check is waiting. */
  nextIn(): number | null
  /** While lost: asks now instead of at the end of the wait ("Try now"); the back-off goes on from there. */
  retry(): void
  /** Stops asking. */
  stop(): void
}

const realTimers: WatchTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export function createWatch({ probe, onChange, timers = realTimers, now = () => Date.now() }: { probe: () => Promise<ProbeResult>; onChange: (lost: boolean) => void; timers?: WatchTimers; now?: () => number }): Watch {
  let lost = false
  // When the waiting check runs (for nextIn), or null.
  let dueAt: number | null = null
  let checking = false
  let stopped = false
  let attempt = 0
  let waiting: unknown = null
  // Bumped by each probe and by reached(): a probe's answer counts only if nothing else happened since it was sent.
  let generation = 0

  const set = (next: boolean) => {
    if (lost === next) return
    lost = next
    try {
      onChange(next)
    } catch {
      // a listener's own bug never stops the watch
    }
  }
  const check = async () => {
    if (checking || stopped) return
    checking = true
    waiting = null
    const mine = ++generation
    let found: ProbeResult
    try {
      found = await probe()
    } catch {
      found = 'down'
    }
    checking = false
    // A request got through while this probe was out: its answer is older than what the page knows.
    if (stopped || mine !== generation) return
    if (found === 'down') {
      // The next check is scheduled before the change is announced, so a listener can already read nextIn().
      const wait = Math.min(PROBE_BACKOFF_MAX_MS, PROBE_BACKOFF_MS * 2 ** attempt++)
      dueAt = now() + wait
      waiting = timers.set(() => void check(), wait)
      set(true)
      return
    }
    dueAt = null
    attempt = 0
    set(false)
    // 'expired' is the page's own message (api() has already said it, and the link is dead): the watch ends and has nothing to add.
    if (found === 'expired') stopped = true
  }

  return {
    suspect() {
      // A wait already running is the back-off: a failed request does not cut it short.
      if (waiting === null) void check()
    },
    reached() {
      generation++
      if (!lost) return
      if (waiting !== null) timers.clear(waiting)
      waiting = null
      dueAt = null
      attempt = 0
      set(false)
    },
    lost: () => lost,
    nextIn() {
      if (!lost || stopped) return null
      if (checking) return 0
      return dueAt === null ? null : Math.max(0, dueAt - now())
    },
    retry() {
      if (!lost || stopped || checking) return
      if (waiting !== null) timers.clear(waiting)
      waiting = null
      dueAt = null
      void check()
    },
    stop() {
      stopped = true
      if (waiting !== null) timers.clear(waiting)
      waiting = null
      dueAt = null
    },
  }
}
