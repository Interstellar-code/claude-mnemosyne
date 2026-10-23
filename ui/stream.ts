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
// bounded exponential backoff.

/** What `api` must look like: the page's token-bearing fetch (ui/app.ts:403). */
export type StreamApi = (path: string, init?: { signal?: AbortSignal }) => Promise<Response>
export type StreamListener = (line: Record<string, unknown>) => void
export type StreamStatus = 'idle' | 'connecting' | 'live' | 'off' | 'reconnecting' | 'expired'

// The reconnect backoff, as ui/app.ts's follow(): 1 s doubling, at most 30 s.
export const STREAM_BACKOFF_MS = 1_000
export const STREAM_BACKOFF_MAX_MS = 30_000

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

type Waiter = { timer: ReturnType<typeof setTimeout>; resolve: () => void }

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

/**
 * createStream({ api }): one NDJSON reader of /api/activity/stream, shared by every
 * subscriber. `cursor` is the last `<inode>:<offset>` the server sent (`?cursor=`
 * resumes there); an empty cursor starts from the server's catch-up point.
 */
export function createStream({ api, cursor = '' }: { api: StreamApi; cursor?: string }): StreamHandle {
  const listeners = new Set<StreamListener>()
  const statusListeners = new Set<(status: StreamStatus) => void>()
  let running = false
  let stopped = false
  let current: StreamStatus = 'idle'
  let pollCount = 0
  let controller: AbortController | null = null
  let waiter: Waiter | null = null

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
    for (const listener of listeners) {
      try {
        listener(line)
      } catch {
        // as above
      }
    }
  }
  const wait = (ms: number) => {
    let resolve = () => {}
    const promise = new Promise<void>(done => {
      resolve = done
    })
    const timer = setTimeout(() => {
      waiter = null
      resolve()
    }, ms)
    waiter = { timer, resolve }
    return promise
  }
  const stop = () => {
    stopped = true
    controller?.abort()
    controller = null
    if (waiter !== null) {
      clearTimeout(waiter.timer)
      waiter.resolve()
      waiter = null
    }
    // 'off' and 'expired' are terminal facts a restart must not erase.
    if (current !== 'off' && current !== 'expired') status('idle')
  }

  async function follow() {
    let attempt = 0
    while (!stopped) {
      try {
        const from = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
        controller = new AbortController()
        pollCount++
        status('connecting')
        const response = await api(`/api/activity/stream${from}`, { signal: controller.signal })
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
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (stopped) return
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const taken = takeLines(buffer)
          buffer = taken.rest
          for (const line of taken.lines) emit(line)
        }
      } catch {
        if (stopped) return
      }
      if (stopped) return
      status('reconnecting')
      await wait(Math.min(STREAM_BACKOFF_MAX_MS, STREAM_BACKOFF_MS * 2 ** attempt++))
    }
  }

  const start = () => {
    if (running) return
    // A reader that stopped because its last subscriber left starts again for the next one.
    if (stopped && current !== 'off' && current !== 'expired') stopped = false
    if (stopped) return
    running = true
    void follow().finally(() => {
      running = false
    })
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
