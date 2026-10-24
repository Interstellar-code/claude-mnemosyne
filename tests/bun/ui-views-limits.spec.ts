// VIEW review r1 fixes: the server's limits and the edges of forget and the
// live feed, run for real against ui/server.ts, temporary stores made by the
// real engine, and (where the engine must misbehave) stand-in engine scripts.
//   MED 1   at most MAX_ENGINES engine processes at once; one search at a time (429)
//   LOW 2   a forget whose engine reply is lost after the delete is reported deleted
//   LOW 3   the stream starts at the cursor /api/activity gave: no line is missed
//   LOW 8   the 9th stream gets 429, a stream closes after its time cap, a big body gets 413,
//           and list, detail and search leave the whole database (every table) unchanged
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { appendActivity } from '../../bin/activity'
import { MAX_ENGINES, MAX_STREAMS, startServer } from '../../ui/server'
import type { ServerOptions, Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

/** Saves one memory through the real engine; its id. */
async function remember(store: string, owner: string, content: string) {
  const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content })])).get(1))
  if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  return reply.memory_id as string
}

/** A running server on `store` with its own root and log; the caller stops it. */
async function serve(dir: string, store: string, cli = CLI, options: ServerOptions = {}) {
  const log = join(dir, 'root', 'activity.jsonl')
  const started: Started = await startServer({ root: join(dir, 'root'), store, cli, activityLog: log, pluginRoot: ROOT }, options)
  const url = `http://127.0.0.1:${started.port}`
  const auth = { Authorization: `Bearer ${started.token}` }
  const post = (path: string, payload: unknown) =>
    fetch(`${url}${path}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', Origin: url }, body: typeof payload === 'string' ? payload : JSON.stringify(payload) })
  const lines = () => {
    try {
      return readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
    } catch {
      return []
    }
  }
  return { started, url, auth, post, log, lines }
}

/** Every row of every table, as text: the whole database's content. */
function dump(store: string) {
  const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
  try {
    const tables = db.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]
    return tables.map(({ name }) => {
      const rows = db.query(`SELECT * FROM "${name.replace(/"/g, '""')}"`).all()
      return `${name}:${JSON.stringify(rows.map(row => JSON.stringify(row)).sort())}`
    })
  } finally {
    db.close()
  }
}

/** Reads NDJSON lines from a streamed reply; blank keep-alive lines are skipped. */
function readLines(response: Response) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const ready: Record<string, any>[] = []
  let pending: ReturnType<typeof reader.read> | undefined
  return {
    async next(count: number, ms: number) {
      const end = Date.now() + ms
      while (ready.length < count) {
        const left = end - Date.now()
        if (left <= 0) throw new Error(`only ${ready.length} of ${count} lines in ${ms} ms`)
        pending ??= reader.read()
        const chunk = await Promise.race([pending, Bun.sleep(left).then(() => 'timeout' as const)])
        if (chunk === 'timeout') continue
        pending = undefined
        if (chunk.done) throw new Error('the stream ended')
        buffer += decoder.decode(chunk.value, { stream: true })
        let at = buffer.indexOf('\n')
        while (at !== -1) {
          const line = buffer.slice(0, at).trim()
          buffer = buffer.slice(at + 1)
          if (line) ready.push(JSON.parse(line))
          at = buffer.indexOf('\n')
        }
      }
      return ready.splice(0, count)
    },
    /** Resolves true when the stream ends within `ms`. */
    async ends(ms: number) {
      const end = Date.now() + ms
      while (Date.now() < end) {
        pending ??= reader.read()
        const chunk = await Promise.race([pending, Bun.sleep(end - Date.now()).then(() => 'timeout' as const)])
        if (chunk === 'timeout') return false
        pending = undefined
        if (chunk.done) return true
      }
      return false
    },
  }
}

describe('review r1 MED 1: engine processes are capped and searches do not overlap', () => {
  const temp = tempDir('ui-limits-engine')
  const store = join(temp.dir, 'store')
  const counter = join(temp.dir, 'live.txt')
  const OWNERS = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6']
  const ids: string[] = []

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    for (const owner of OWNERS) ids.push(await remember(store, owner, `fact of ${owner}`))
  }, 120_000)
  afterAll(() => temp.dispose())

  test(`overlapping searches and forgets never run more than ${MAX_ENGINES} engine processes, and a second search gets 429`, async () => {
    expect(MAX_ENGINES).toBe(4)
    // A stand-in engine that marks its start and end in a shared file and takes 400 ms.
    const cli = join(temp.dir, 'slow-cli.ts')
    writeFileSync(
      cli,
      `import { appendFileSync } from 'node:fs'
appendFileSync(${JSON.stringify(counter)}, '+\\n')
const lines = (await Bun.stdin.text()).split('\\n').filter(Boolean)
await Bun.sleep(400)
for (const line of lines) {
  const { id, params } = JSON.parse(line)
  const text = params.name === 'mnemopi_recall' ? { status: 'ok', results: [] } : { status: 'deleted', memory_id: params.arguments.memory_id }
  console.log(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(text) }] } }))
}
appendFileSync(${JSON.stringify(counter)}, '-\\n')
`,
    )
    writeFileSync(counter, '')
    const server = await serve(temp.dir, store, cli)
    try {
      // One search across the six owners (six engine runs), a second search at once, and three forgets.
      const first = server.post('/api/search', { query: 'fact' })
      await Bun.sleep(50)
      const second = await server.post('/api/search', { query: 'fact' })
      expect(second.status).toBe(429)
      expect(await second.json()).toEqual({ error: 'A search is already running; try again when it ends.' })
      const forgets = ids.slice(0, 3).map(id => server.post('/api/forget', { memory_id: id }))
      expect((await first).status).toBe(200)
      for (const response of await Promise.all(forgets)) expect(response.status).toBe(200)
      // Once the first search ends, the next one runs.
      expect((await server.post('/api/search', { query: 'fact', owner: 'o1' })).status).toBe(200)
      let live = 0
      let most = 0
      const marks = readFileSync(counter, 'utf8').split('\n').filter(Boolean)
      for (const mark of marks) {
        live += mark === '+' ? 1 : -1
        most = Math.max(most, live)
      }
      expect(marks.filter(mark => mark === '+').length).toBe(6 + 3 + 1)
      expect(live).toBe(0)
      // The cap was reached (there was more work than room) and never passed.
      expect(most).toBe(MAX_ENGINES)
    } finally {
      server.started.stop()
    }
  }, 30_000)
})

describe('review r1 LOW 2: a forget whose engine reply is lost after the delete reports deleted', () => {
  const temp = tempDir('ui-limits-forget')
  const store = join(temp.dir, 'store')
  let crashId = ''
  let hangId = ''
  let keepId = ''

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    crashId = await remember(store, 'p', 'deleted then the engine crashed')
    hangId = await remember(store, 'p', 'deleted then the engine hung')
    keepId = await remember(store, 'p', 'never touched')
  }, 120_000)
  afterAll(() => temp.dispose())

  // A stand-in engine that deletes the row as the real one would, then fails to answer.
  const deletesThen = (end: string) => `import { Database } from 'bun:sqlite'
const [line] = (await Bun.stdin.text()).split('\\n').filter(Boolean)
const { params } = JSON.parse(line)
const db = new Database(process.env.MNEMOPI_DATA_DIR + '/mnemopi.db')
db.run('DELETE FROM working_memory WHERE id = ? AND session_id = ?', [params.arguments.memory_id, process.env.MNEMOPI_SESSION_ID])
db.close()
process.stderr.write('lost reply detail')
${end}
`
  const ids = () => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      return (db.query('SELECT id FROM working_memory ORDER BY id').all() as { id: string }[]).map(row => row.id)
    } finally {
      db.close()
    }
  }

  for (const [what, end, options, row] of [
    ['crashes', 'process.exit(3)', {}, () => crashId],
    ['hangs past its timeout', 'await Bun.sleep(60_000)', { engineTimeoutMs: 1_000 }, () => hangId],
  ] as const) {
    test(`the engine deletes, then ${what}: 200 deleted with a note, one ok line`, async () => {
      const cli = join(temp.dir, `cli-${what.split(' ')[0]}.ts`)
      writeFileSync(cli, deletesThen(end))
      const server = await serve(temp.dir, store, cli, options)
      try {
        const id = row()
        const before = ids()
        const response = await server.post('/api/forget', { memory_id: id })
        expect(response.status).toBe(200)
        const text = await response.text()
        expect(JSON.parse(text)).toEqual({ status: 'deleted', memory_id: id, owner: 'p', note: 'The engine reply was lost, but the memory is gone.' })
        expect(text).not.toContain('lost reply detail')
        expect(ids()).toEqual(before.filter(other => other !== id))
        const last = server.lines().at(-1)
        expect(last).toMatchObject({ action: 'forget', origin: 'ui', owner: 'p', ids: [id], count: 1, ok: true })
        expect(last.note).toContain('engine reply lost')
      } finally {
        server.started.stop()
      }
    }, 30_000)
  }

  test('the engine fails without deleting: 502, nothing deleted', async () => {
    const cli = join(temp.dir, 'cli-broken.ts')
    writeFileSync(cli, 'process.exit(3)\n')
    const server = await serve(temp.dir, store, cli)
    try {
      const before = ids()
      const response = await server.post('/api/forget', { memory_id: keepId })
      expect(response.status).toBe(502)
      expect(ids()).toEqual(before)
      expect(server.lines().at(-1)).toMatchObject({ action: 'forget', ok: false })
    } finally {
      server.started.stop()
    }
  })
})

describe('the live feed and the server limits on a real store', () => {
  const temp = tempDir('ui-limits-feed')
  const store = join(temp.dir, 'store')
  let server: Awaited<ReturnType<typeof serve>>
  let memoryId = ''
  const line = (text: string) => ({ t: new Date().toISOString(), action: 'recall', origin: 'hook', owner: 'global', text, ok: true })

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    memoryId = await remember(store, 'global', 'durian smell, recalled for the dump test')
    await remember(store, 'project-a', 'apple orchard for the dump test')
    server = await serve(temp.dir, store)
  }, 120_000)
  afterAll(() => {
    server?.started.stop()
    temp.dispose()
  })

  test('review r1 LOW 3: lines written between the catch-up read and the stream are sent, rotation included', async () => {
    appendActivity(server.log, [line('already read')])
    const read = (await (await fetch(`${server.url}/api/activity`, { headers: server.auth })).json()) as { lines: { text: string }[]; cursor: string }
    expect(read.lines[0]?.text).toBe('already read')
    expect(read.cursor).toMatch(/^\d+:\d+$/)
    // The gap: two lines before the stream opens.
    appendActivity(server.log, [line('gap one'), line('gap two')])
    const controller = new AbortController()
    try {
      const response = await fetch(`${server.url}/api/activity/stream?cursor=${encodeURIComponent(read.cursor)}`, { headers: server.auth, signal: controller.signal })
      expect(response.status).toBe(200)
      const reader = readLines(response)
      expect((await reader.next(2, 5_000)).map(got => got.text)).toEqual(['gap one', 'gap two'])
    } finally {
      controller.abort()
    }
    // A gap that holds a rotation: the old file's tail, then the new file.
    const again = (await (await fetch(`${server.url}/api/activity`, { headers: server.auth })).json()) as { cursor: string }
    appendActivity(server.log, [line('old file tail')])
    renameSync(server.log, `${server.log}.1`)
    appendActivity(server.log, [line('new file head')])
    const second = new AbortController()
    try {
      const response = await fetch(`${server.url}/api/activity/stream?cursor=${encodeURIComponent(again.cursor)}`, { headers: server.auth, signal: second.signal })
      expect((await readLines(response).next(2, 5_000)).map(got => got.text)).toEqual(['old file tail', 'new file head'])
    } finally {
      second.abort()
    }
    // A cursor that is not one is refused.
    for (const bad of ['x', '1:', ':2', '1:2:3', '-1:5']) {
      const response = await fetch(`${server.url}/api/activity/stream?cursor=${encodeURIComponent(bad)}`, { headers: server.auth })
      expect({ bad, status: response.status }).toEqual({ bad, status: 400 })
    }
  })

  test(`review r1 LOW 8: the ${MAX_STREAMS + 1}th stream gets 429, and a closed one frees its place`, async () => {
    expect(MAX_STREAMS).toBe(8)
    const controllers = Array.from({ length: MAX_STREAMS }, () => new AbortController())
    try {
      const open = await Promise.all(controllers.map(controller => fetch(`${server.url}/api/activity/stream`, { headers: server.auth, signal: controller.signal })))
      for (const response of open) expect(response.status).toBe(200)
      // Each stream's first blank line has gone out, so each is counted.
      await Promise.all(open.map(response => response.body!.getReader().read()))
      const ninth = await fetch(`${server.url}/api/activity/stream`, { headers: server.auth })
      expect(ninth.status).toBe(429)
      controllers[0]!.abort()
      // The server sees the closed connection on its next poll.
      let status = 0
      for (let i = 0; i < 20 && status !== 200; i++) {
        await Bun.sleep(250)
        const retry = new AbortController()
        const response = await fetch(`${server.url}/api/activity/stream`, { headers: server.auth, signal: retry.signal })
        status = response.status
        retry.abort()
      }
      expect(status).toBe(200)
    } finally {
      for (const controller of controllers) controller.abort()
    }
  })

  test('review r1 LOW 8: a stream closes after its time cap (lowered here), so the page reconnects', async () => {
    const other = tempDir('ui-limits-cap')
    const short = await serve(other.dir, store, CLI, { streamMaxMs: 1_000 })
    try {
      const response = await fetch(`${short.url}/api/activity/stream`, { headers: short.auth })
      expect(response.status).toBe(200)
      expect(await readLines(response).ends(4_000)).toBe(true)
    } finally {
      short.started.stop()
      other.dispose()
    }
  })

  test('review r1 LOW 8: a POST body past 4096 bytes gets 413 and changes nothing', async () => {
    const before = dump(store)
    const big = JSON.stringify({ memory_id: memoryId, pad: 'x'.repeat(5_000) })
    expect((await server.post('/api/forget', big)).status).toBe(413)
    expect((await server.post('/api/search', JSON.stringify({ query: 'x'.repeat(5_000) }))).status).toBe(413)
    expect(dump(store)).toEqual(before)
  })

  test('review r1 LOW 6: an empty store searches nothing and writes no activity line', async () => {
    const other = tempDir('ui-limits-empty')
    const empty = join(other.dir, 'store')
    mkdirSync(empty, { recursive: true })
    const blank = await serve(other.dir, empty)
    try {
      const response = await blank.post('/api/search', { query: 'anything' })
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ query: 'anything', owners: [], skipped: 0, count: 0, mode: 'keyword', embeddings: false, results: [] })
      expect(blank.lines()).toEqual([])
    } finally {
      blank.started.stop()
      other.dispose()
    }
  })

  test('review r1 LOW 8: list, detail and search leave every table of the database unchanged', async () => {
    const before = dump(store)
    expect(before.length).toBeGreaterThan(1)
    for (const path of ['/api/memories', '/api/memories?sort=recalled', '/api/memories?q=durian', `/api/memories/${memoryId}`]) {
      expect((await fetch(`${server.url}${path}`, { headers: server.auth })).status).toBe(200)
    }
    expect((await server.post('/api/search', { query: 'durian' })).status).toBe(200)
    expect((await server.post('/api/search', { query: 'apple', owner: 'project-a' })).status).toBe(200)
    expect(dump(store)).toEqual(before)
  })
})
