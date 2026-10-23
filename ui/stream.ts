// The one reader of /api/activity/stream (plan EVT.1, C5).
//
// The Activity tab and the map share one poll: `createStream({ api })` returns a
// subscription object, and the first subscriber opens the stream while the last
// one closes it. `api` is passed in by the caller because the bearer token lives
// in ui/app.ts's api() closure (ui/app.ts:403-404); this module imports nothing
// from ui/app.ts, so a spec can check that and drive it with a fake api.
//
// The stream's rules mirror ui/app.ts:733 today: the server sends NDJSON lines,
// a blank line keeps it alive, a 404 means the log is off, and when the stream
// ends (its time cap, a restart, the network) the reader reconnects with a
// bounded exponential backoff. A reconnect first re-reads /api/activity for a
// fresh cursor and hands on only the lines after the last one it delivered.

/** What `api` must look like: the page's token-bearing fetch (ui/app.ts:403). */
export type StreamApi = (path: string, init?: { signal?: AbortSignal }) => Promise<Response>
export type StreamListener = (line: Record<string, unknown>) => void
export type StreamStatus = 'idle' | 'connecting' | 'live' | 'off' | 'reconnecting' | 'expired'
/** The timer pair the backoff waits with; a spec passes its own to drive the waits. */
export type StreamTimers = { set(run: () => void, ms: number): unknown; clear(handle: unknown): void }

// The reconnect backoff, as ui/app.ts's follow(): 1 s doubling, at most 30 s.
export const STREAM_BACKOFF_MS = 1_000
export const STREAM_BACKOFF_MAX_MS = 30_000
/** How many recent lines a reconnect re-reads from /api/activity to catch up (the server's most). */
export const STREAM_CATCHUP = 1_000
/** The longest unfinished line the reader buffers before it drops the connection. */
export const STREAM_BUFFER_MAX = 1_000_000

export type StreamHandle = {
  subscribe(listener: StreamListener): () => void
  unsubscribe(listener: StreamListener): void
  /** The current status, for the page to show ("Live", "Log off", "Reconnecting"). */
  status(): StreamStatus
  onStatus(listener: (status: StreamStatus) => void): () => void
  /** Stops the poll now, as the last unsubscribe does; kept for an explicit teardown. */
  close(): void
  /** How many polls this reader has opened (a spec proves two subscribers share one). */
  polls(): number
}

/** One run of the reader: `stop()` ends it by clearing `active`, a new subscriber starts the next. */
type Run = {
  controller: AbortController | null
  // only what stop() needs: Bun's and the DOM's reader types differ
  reader: { cancel(): Promise<void> } | null
  waiter: { handle: unknown; resolve: () => void } | null
}

/** `buffer`'s whole NDJSON lines and the unfinished rest. Blank and broken lines are skipped. */
export function takeLines(buffer: string): { lines: Record<string, unknown>[]; rest: string } {
  const at = buffer.lastIndexOf('\n')
  const lines: Record<string, unknown>[] = []
  if (at < 0) return { lines, rest: buffer }
  for (const text of buffer.slice(0, at + 1).split('\n')) {
    if (text.trim() === '') continue
    try {
      const value: unknown = JSON.parse(text)
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) lines.push(value as Record<string, unknown>)
    } catch {
      // not a line: skipped
    }
  }
  return { lines, rest: buffer.slice(at + 1) }
}

const realTimers: StreamTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/**
 * createStream({ api }): one NDJSON reader of /api/activity/stream, shared by every
 * subscriber. `cursor` is the last `<inode>:<offset>` the server sent (`?cursor=`
 * resumes there); an empty cursor starts from the server's catch-up point.
 */
export function createStream({ api, cursor = '', timers = realTimers }: { api: StreamApi; cursor?: string; timers?: StreamTimers }): StreamHandle {
  const listeners = new Set<StreamListener>()
  const statusListeners = new Set<(status: StreamStatus) => void>()
  let active: Run | null = null
  let current: StreamStatus = 'idle'
  let pollCount = 0
  // The JSON text of the last line handed on, and whether any came since `cursor` was taken.
  let lastKey: string | null = null
  let sinceCursor = false

  const status = (next: StreamStatus) => {
    if (current === next) return
    current = next
    for (const listener of statusListeners) {
      try {
        listener(next)
      } catch {
        // a listener's own bug never stops the reader
      }
    }
  }
  const emit = (line: Record<string, unknown>) => {
    lastKey = JSON.stringify(line)
    sinceCursor = true
    for (const listener of listeners) {
      try {
        listener(line)
      } catch {
        // as above
      }
    }
  }
  const wait = (run: Run, ms: number) =>
    new Promise<void>(resolve => {
      const handle = timers.set(() => {
        run.waiter = null
        resolve()
      }, ms)
      run.waiter = { handle, resolve }
    })
  const stop = () => {
    const run = active
    active = null
    if (run !== null) {
      run.controller?.abort()
      run.controller = null
      run.reader?.cancel().catch(() => {})
      run.reader = null
      if (run.waiter !== null) {
        timers.clear(run.waiter.handle)
        run.waiter.resolve()
        run.waiter = null
      }
    }
    // 'off' and 'expired' are terminal facts a restart must not erase.
    if (current !== 'off' && current !== 'expired') status('idle')
  }

  /**
   * Before a reconnect: the lines written while the reader was away and a fresh cursor.
   * Nothing handed on since the cursor was taken means the old cursor still loses nothing.
   * False when the reader must stop (the log is off, the link expired).
   */
  async function catchUp(run: Run): Promise<boolean> {
    if (!sinceCursor && cursor !== '') return true
    const response = await api(`/api/activity?limit=${STREAM_CATCHUP}`, { signal: run.controller?.signal })
    if (active !== run) return false
    if (response.status === 401) {
      status('expired')
      stop()
      return false
    }
    if (!response.ok) throw new Error(`the server answered ${response.status}`)
    const body = (await response.json()) as { off?: unknown; lines?: unknown; cursor?: unknown }
    if (active !== run) return false
    if (body.off === true) {
      status('off')
      stop()
      return false
    }
    // Newest first: the lines above the last one delivered are new, handed on oldest first.
    const lines = (Array.isArray(body.lines) ? body.lines : []).filter(
      (line): line is Record<string, unknown> => line !== null && typeof line === 'object' && !Array.isArray(line),
    )
    if (lastKey !== null) {
      const at = lines.findIndex(line => JSON.stringify(line) === lastKey)
      const fresh = (at < 0 ? lines : lines.slice(0, at)).reverse()
      for (const line of fresh) emit(line)
    }
    cursor = typeof body.cursor === 'string' ? body.cursor : ''
    sinceCursor = false
    return true
  }

  async function follow(run: Run) {
    let attempt = 0
    while (active === run) {
      try {
        run.controller = new AbortController()
        // Every poll after the reader's first (a reconnect, or a restart for a new subscriber) catches up first.
        if (pollCount > 0) {
          status('connecting')
          if (!(await catchUp(run))) return
        }
        const from = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
        pollCount++
        status('connecting')
        const response = await api(`/api/activity/stream${from}`, { signal: run.controller?.signal })
        if (active !== run) {
          // stopped while the request was out: drop the late body
          response.body?.cancel().catch(() => {})
          return
        }
        if (response.status === 401) {
          status('expired')
          stop()
          return
        }
        if (response.status === 404) {
          status('off')
          stop()
          return
        }
        if (!response.ok || response.body === null) throw new Error(`the server answered ${response.status}`)
        status('live')
        attempt = 0
        const reader = response.body.getReader()
        run.reader = reader
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (active !== run) return
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const taken = takeLines(buffer)
          buffer = taken.rest
          for (const line of taken.lines) emit(line)
          if (buffer.length > STREAM_BUFFER_MAX) {
            reader.cancel().catch(() => {})
            throw new Error('a line longer than the reader keeps')
          }
        }
        run.reader = null
      } catch {
        if (active !== run) return
      }
      if (active !== run) return
      status('reconnecting')
      await wait(run, Math.min(STREAM_BACKOFF_MAX_MS, STREAM_BACKOFF_MS * 2 ** attempt++))
    }
  }

  const start = () => {
    if (active !== null) return
    // A reader stopped by its last subscriber starts again for the next one; 'off' and 'expired' stay stopped.
    if (current === 'off' || current === 'expired') return
    const run: Run = { controller: null, reader: null, waiter: null }
    active = run
    void follow(run)
  }

  const unsubscribe = (listener: StreamListener) => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      start()
      return () => unsubscribe(listener)
    },
    unsubscribe,
    status: () => current,
    onStatus(listener) {
      statusListeners.add(listener)
      return () => {
        statusListeners.delete(listener)
      }
    },
    close: stop,
    polls: () => pollCount,
  }
}
