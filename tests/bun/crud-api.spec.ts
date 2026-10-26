// CRUDX.1 and CRUDX.2: the dashboard's write routes (POST /api/memory/create, /update, /retire and /restore),
// run for real on 127.0.0.1 against a temporary store made by the real engine. Every test uses a temp HOME,
// a temp <root> and a temp store; the real ~/.claude is never named. The G3 tests use a stand-in engine that
// answers mnemopi_similar with canned matches, because the real one needs the embedding model.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'
import { writeConfig } from '../../bin/settings'
import { MAX_BODY_BYTES, MAX_WRITE_BODY_BYTES, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, isolatedEnv, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const OWNER = 'project-alpha-1a2b'
const WRITE_ROUTES = ['/api/memory/create', '/api/memory/update', '/api/memory/retire', '/api/memory/restore']
const AWS_KEY = 'AKIAABCDEFGHIJKLMNOP'

/** Runs with a temp HOME and embeddings off for the whole describe; restores both afterwards. */
function useTempHome() {
  const saved = { HOME: process.env.HOME, EMBEDDINGS: process.env.MNEMOSYNE_EMBEDDINGS }
  return {
    enter(embeddings?: string) {
      process.env.HOME = isolatedEnv('crud-api').HOME
      if (embeddings === undefined) delete process.env.MNEMOSYNE_EMBEDDINGS
      else process.env.MNEMOSYNE_EMBEDDINGS = embeddings
    },
    leave() {
      if (saved.HOME === undefined) delete process.env.HOME
      else process.env.HOME = saved.HOME
      if (saved.EMBEDDINGS === undefined) delete process.env.MNEMOSYNE_EMBEDDINGS
      else process.env.MNEMOSYNE_EMBEDDINGS = saved.EMBEDDINGS
    },
  }
}

async function seed(store: string, owner: string, content: string, extra: Record<string, unknown> = {}) {
  const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...extra })])).get(1))
  if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  return reply.memory_id as string
}

type Row = Record<string, any>
const rowOf = (store: string, id: string) => {
  const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
  try {
    return db.query('SELECT * FROM working_memory WHERE id = ?').get(id) as Row | null
  } finally {
    db.close()
  }
}
const countRows = (store: string) => {
  const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
  try {
    return (db.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n
  } finally {
    db.close()
  }
}
const trailOf = (store: string, id: string) => {
  const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
  try {
    return db.query('SELECT action, validator, new_content, note FROM memory_validations WHERE memory_id = ? ORDER BY validation_id').all(id) as Row[]
  } finally {
    db.close()
  }
}
const metaOf = (row: Row | null) => JSON.parse(String(row?.metadata_json ?? '{}')) as Record<string, any>

/** One raw HTTP/1.1 POST with any Host header; the status line's code. */
function rawPost(port: number, path: string, token: string, host: string) {
  return new Promise<number>((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    let data = ''
    socket.setEncoding('utf8')
    socket.on('data', chunk => {
      data += chunk
    })
    socket.on('error', reject)
    socket.on('end', () => resolve(Number(data.split(' ')[1])))
    const payload = '{}'
    socket.write(
      `POST ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\nAuthorization: Bearer ${token}\r\nContent-Type: application/json\r\nOrigin: http://${host}\r\nContent-Length: ${payload.length}\r\n\r\n${payload}`,
    )
  })
}

describe('CRUDX.1 and CRUDX.2: write routes on a real store', () => {
  const temp = tempDir('crud-api')
  const store = join(temp.dir, 'store')
  const root = join(temp.dir, 'root')
  const log = join(temp.dir, 'activity.jsonl')
  const home = useTempHome()
  let started: Started
  let url = ''
  let seeded: string
  let other: string

  const send = (path: string, payload: unknown, headers: Record<string, string> = {}) =>
    fetch(`${url}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${started.token}`, 'Content-Type': 'application/json', Origin: url, ...headers },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    })
  const post = async (path: string, payload: unknown) => {
    const response = await send(path, payload)
    return { status: response.status, json: (await response.json()) as Row }
  }
  const lines = () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as Row) : [])

  beforeAll(async () => {
    home.enter()
    mkdirSync(store, { recursive: true })
    seeded = await seed(store, OWNER, 'The alpha service keeps its settings in a TOML file', { memory_type: 'fact', metadata: { tags: ['old-tag', 'second'], guard: ['G2'] } })
    other = await seed(store, 'global', 'Rohit prefers short commit messages in this repo', { memory_type: 'preference' })
    started = await startServer({ root, store, cli: CLI, activityLog: log, pluginRoot: ROOT })
    url = `http://127.0.0.1:${started.port}`
  }, 120_000)

  afterAll(() => {
    started?.stop()
    home.leave()
    temp.dispose()
  })

  describe('every write route keeps the token, Host, Origin, JSON and size checks', () => {
    for (const path of WRITE_ROUTES) {
      test(`${path}: no token is 401, a foreign or missing Origin is 403, a wrong Host is 403, non-JSON is 415, GET is 405`, async () => {
        const count = countRows(store)
        const payload = { memory_id: other, owner: 'global', content: 'A text long enough to pass', kind: 'fact' }
        expect((await fetch(`${url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url }, body: JSON.stringify(payload) })).status).toBe(401)
        expect((await send(path, payload, { Origin: 'http://evil.example' })).status).toBe(403)
        expect((await send(path, payload, { Origin: `http://localhost:${started.port}` })).status).toBe(403)
        expect((await fetch(`${url}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${started.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).status).toBe(403)
        expect(await rawPost(started.port, path, started.token, 'evil.example')).toBe(403)
        expect((await send(path, 'memory_id=1', { 'Content-Type': 'text/plain' })).status).toBe(415)
        expect((await fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${started.token}` } })).status).toBe(405)
        // None of those reached the engine.
        expect(countRows(store)).toBe(count)
        expect(rowOf(store, other)?.valid_until ?? null).toBeNull()
      })
    }

    test('create and update take a body up to 24 KB; every other route keeps 4096 bytes', async () => {
      expect(MAX_WRITE_BODY_BYTES).toBe(24 * 1024)
      expect(MAX_BODY_BYTES).toBe(4096)
      const big = 'y'.repeat(MAX_WRITE_BODY_BYTES + 1)
      expect((await send('/api/memory/create', { owner: 'global', content: big, kind: 'fact' })).status).toBe(413)
      expect((await send('/api/memory/update', { memory_id: other, content: big })).status).toBe(413)
      // retire, restore and forget stay at 4096 bytes: a body of 5000 bytes is too large for each.
      for (const path of ['/api/memory/retire', '/api/memory/restore', '/api/forget']) {
        expect((await send(path, { memory_id: other, pad: 'z'.repeat(5000) })).status).toBe(413)
      }
      expect(rowOf(store, other)).not.toBeNull()
    })
  })

  describe('POST /api/memory/create', () => {
    test('400: not JSON, an extra key, no or unknown kind, a bad owner, a non-string text, bad tags, importance or days', async () => {
      const ok = { owner: 'global', content: 'A plain fact worth keeping around', kind: 'fact' }
      expect((await send('/api/memory/create', '{nope')).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, extra: 1 })).json.error).toMatch(/unexpected field: extra/)
      expect((await post('/api/memory/create', { owner: 'global', content: ok.content })).json.error).toMatch(/kind is required/)
      expect((await post('/api/memory/create', { ...ok, kind: 'unknown' })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, kind: 'gossip' })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, owner: 'project-nobody-0000' })).json.error).toMatch(/no such owner/)
      expect((await post('/api/memory/create', { ...ok, owner: '' })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, owner: 7 })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, content: 7 })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, tags: 'a' })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, tags: [1] })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, importance: 'high' })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, expires_in_days: 0 })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, expires_in_days: 400 })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, confirm: 'yes' })).status).toBe(400)
      expect((await post('/api/memory/create', { ...ok, pinned: true })).json.error).toMatch(/unexpected field: pinned/)
    })

    test('200: stored as the dashboard (C4), with the kind, tags cleaned, and one activity line of ids only', async () => {
      const text = 'The alpha build script runs from the repository root directory'
      const before = lines().length
      const { status, json } = await post('/api/memory/create', { owner: OWNER, content: text, kind: 'fact', tags: ['Code Review', 'agent:Codex', 'alpha', 'Code Review'], importance: 0.9 })
      expect(status).toBe(200)
      expect(json).toMatchObject({ status: 'stored', owner: OWNER, kind: 'fact' })
      const row = rowOf(store, json.memory_id)!
      expect(row).toMatchObject({ content: text, session_id: OWNER, source: 'dashboard', trust_tier: 'STATED', veracity: 'stated', author_type: 'human', author_id: 'dashboard', memory_type: 'fact', scope: 'channel', importance: 0.9 })
      expect(row.valid_until).toBeNull()
      // the project name is dropped, the spelling folds to the C6 format, duplicates go
      expect(metaOf(row).tags).toEqual(['code-review', 'agent:codex'])
      expect(metaOf(row).guard).toBeUndefined()
      const added = lines().slice(before)
      expect(added).toHaveLength(1)
      expect(added[0]).toMatchObject({ action: 'remember', origin: 'ui', owner: OWNER, ids: [json.memory_id], count: 1, ok: true, client: 'dashboard', author_type: 'human', veracity: 'stated', text: '' })
      expect(JSON.stringify(added[0])).not.toContain('build script')
    })

    test('a global save is scope global; tags are optional', async () => {
      const { status, json } = await post('/api/memory/create', { owner: 'global', content: 'Rohit reads the weekly summary on Mondays', kind: 'preference' })
      expect(status).toBe(200)
      const row = rowOf(store, json.memory_id)!
      expect(row).toMatchObject({ scope: 'global', memory_type: 'preference', importance: 0.5 })
      expect(metaOf(row).tags).toBeUndefined()
    })

    test('the context default expiry is 14 days, expires_in_days overrides it, and other kinds do not expire', async () => {
      const days = (id: string) => (Date.parse(rowOf(store, id)!.valid_until) - Date.now()) / 86_400_000
      const note = await post('/api/memory/create', { owner: OWNER, content: 'The alpha migration is waiting on the new schema review', kind: 'context' })
      expect(note.status).toBe(200)
      expect(days(note.json.memory_id)).toBeGreaterThan(13.99)
      expect(days(note.json.memory_id)).toBeLessThan(14.01)
      const three = await post('/api/memory/create', { owner: OWNER, content: 'The alpha demo is set up on the staging cluster', kind: 'context', expires_in_days: 3 })
      expect(days(three.json.memory_id)).toBeGreaterThan(2.99)
      expect(days(three.json.memory_id)).toBeLessThan(3.01)
      const fact = await post('/api/memory/create', { owner: OWNER, content: 'The alpha demo cluster has four worker nodes', kind: 'fact', expires_in_days: 30 })
      expect(days(fact.json.memory_id)).toBeGreaterThan(29.99)
      const plain = await post('/api/memory/create', { owner: OWNER, content: 'The alpha demo cluster uses the standard region', kind: 'decision' })
      expect(rowOf(store, plain.json.memory_id)!.valid_until).toBeNull()
    })

    test('422: a secret is blocked with its rule id, no override, nothing saved, and neither the reply nor the log holds the secret', async () => {
      const count = countRows(store)
      const before = lines().length
      const payload = { owner: OWNER, content: `The deploy key is ${AWS_KEY} for the bucket`, kind: 'fact' }
      for (const confirm of [undefined, true]) {
        const response = await send('/api/memory/create', { ...payload, ...(confirm ? { confirm } : {}) })
        expect(response.status).toBe(422)
        const text = await response.text()
        expect(text).not.toContain(AWS_KEY)
        expect(JSON.parse(text)).toMatchObject({ verdict: 'block', hits: [{ rule: 'G1' }] })
      }
      expect(countRows(store)).toBe(count)
      const added = lines().slice(before)
      expect(added.map(line => [line.action, line.origin, line.ok, line.error])).toEqual([['remember', 'ui', false, 'guard:G1'], ['remember', 'ui', false, 'guard:G1']])
      expect(JSON.stringify(added)).not.toContain(AWS_KEY)
      // too short is blocked too
      expect((await post('/api/memory/create', { owner: OWNER, content: 'too short', kind: 'fact' })).status).toBe(422)
    })

    test('409: a warning needs confirm: true, and then it is saved with metadata.guard', async () => {
      const count = countRows(store)
      const payload = { owner: OWNER, content: 'Merged the alpha release on 2026-10-24 and it is done', kind: 'fact' }
      const warned = await post('/api/memory/create', payload)
      expect(warned.status).toBe(409)
      expect(warned.json).toMatchObject({ verdict: 'warn', hits: [{ rule: 'G4' }] })
      expect(countRows(store)).toBe(count)
      const confirmed = await post('/api/memory/create', { ...payload, confirm: true })
      expect(confirmed.status).toBe(200)
      expect(confirmed.json.guard).toEqual(['G4'])
      expect(metaOf(rowOf(store, confirmed.json.memory_id)).guard).toEqual(['G4'])
      // a context note is where dated progress belongs: no warning
      expect((await post('/api/memory/create', { ...payload, kind: 'context' })).status).toBe(200)
    })

    test('a text of exactly 4000 characters is accepted (with confirm, it warns for size), and one character more is blocked', async () => {
      const content = 'x'.repeat(4000)
      expect(JSON.stringify({ owner: OWNER, content, kind: 'fact', confirm: true }).length).toBeLessThan(MAX_WRITE_BODY_BYTES)
      const warned = await post('/api/memory/create', { owner: OWNER, content, kind: 'fact' })
      expect(warned.status).toBe(409)
      expect(warned.json.hits[0].rule).toBe('G2')
      const stored = await post('/api/memory/create', { owner: OWNER, content, kind: 'fact', confirm: true })
      expect(stored.status).toBe(200)
      expect(rowOf(store, stored.json.memory_id)!.content).toHaveLength(4000)
      const over = await post('/api/memory/create', { owner: OWNER, content: `${content}x`, kind: 'fact', confirm: true })
      expect(over.status).toBe(422)
    })

    test('the save follows the resolved settings: tag count, context days and guard length from <root>/config.json', async () => {
      expect(writeConfig(root, { 'tags.maxPerMemory': 2, 'expiry.contextDays': 30, 'guard.maxLength': 7000, 'guard.neverSave': ['pineapple'] }).ok).toBe(true)
      try {
        const note = await post('/api/memory/create', { owner: OWNER, content: 'The alpha rollout waits on the platform team', kind: 'context', tags: ['one', 'two', 'three'] })
        expect(note.status).toBe(200)
        const row = rowOf(store, note.json.memory_id)!
        expect(metaOf(row).tags).toEqual(['one', 'two'])
        expect(Date.parse(row.valid_until) - Date.now()).toBeGreaterThan(29.99 * 86_400_000)
        const long = await post('/api/memory/create', { owner: OWNER, content: 'z'.repeat(6000), kind: 'fact', confirm: true })
        expect(long.status).toBe(200)
        const never = await post('/api/memory/create', { owner: OWNER, content: 'The team lunch order is always a pineapple pizza', kind: 'fact' })
        expect(never.status).toBe(422)
        expect(never.json.hits[0].rule).toBe('G7')
      } finally {
        writeConfig(root, { 'tags.maxPerMemory': null, 'expiry.contextDays': null, 'guard.maxLength': null, 'guard.neverSave': null })
      }
    })
  })

  describe('POST /api/memory/update', () => {
    test('400: not JSON, an extra key, a bad id, a bad field, or nothing to change', async () => {
      expect((await send('/api/memory/update', '{nope')).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: seeded, owner: OWNER, content: 'A text long enough to pass' })).json.error).toMatch(/unexpected field: owner/)
      expect((await post('/api/memory/update', { content: 'A text long enough to pass' })).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: '', content: 'A text long enough to pass' })).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: seeded, kind: 'gossip' })).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: seeded, kind: 'unknown' })).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: seeded, content: 5 })).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: seeded, pinned: 'yes' })).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: seeded, importance: 'x' })).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: seeded, expires_in_days: 1.5 })).status).toBe(400)
      expect((await post('/api/memory/update', { memory_id: seeded, tags: ['!!!'] })).json.error).toMatch(/none of those tags can be stored/)
      expect((await post('/api/memory/update', { memory_id: seeded })).json.error).toMatch(/give at least one/)
      expect((await post('/api/memory/update', { memory_id: seeded, confirm: true })).status).toBe(400)
      expect(rowOf(store, seeded)!.content).toBe('The alpha service keeps its settings in a TOML file')
    })

    test('404 for a missing row, with nothing created', async () => {
      const count = countRows(store)
      const { status, json } = await post('/api/memory/update', { memory_id: 'no-such-id', importance: 0.2 })
      expect(status).toBe(404)
      expect(json.status).toBe('not_found')
      expect(countRows(store)).toBe(count)
    })

    test('409 for a row with no owner', async () => {
      const db = new Database(join(store, 'mnemopi.db'))
      try {
        db.run("INSERT INTO working_memory (id, content, session_id, source, importance, timestamp) VALUES ('ownerless-1', 'a row that belongs to nobody', '', 'test', 0.5, '2026-01-01T00:00:00.000Z')")
      } finally {
        db.close()
      }
      expect((await post('/api/memory/update', { memory_id: 'ownerless-1', importance: 0.2 })).status).toBe(409)
      expect(rowOf(store, 'ownerless-1')!.importance).toBe(0.5)
    })

    test('200: new text, kind and importance go through the engine as the owner; the trail names the dashboard and holds no text', async () => {
      const before = lines().length
      const text = 'The alpha service keeps its settings in a YAML file now'
      const { status, json } = await post('/api/memory/update', { memory_id: seeded, content: text, kind: 'decision', importance: 0.8 })
      expect(status).toBe(200)
      expect(json).toEqual({ status: 'updated', memory_id: seeded, owner: OWNER })
      expect(rowOf(store, seeded)).toMatchObject({ content: text, memory_type: 'decision', importance: 0.8, session_id: OWNER })
      // a clean content change clears the old guard flag; tags are untouched
      expect(metaOf(rowOf(store, seeded)).guard).toBeUndefined()
      expect(metaOf(rowOf(store, seeded)).tags).toEqual(['old-tag', 'second'])
      expect(trailOf(store, seeded)).toEqual([{ action: 'update', validator: 'dashboard', new_content: null, note: null }])
      const added = lines().slice(before)
      expect(added).toHaveLength(1)
      expect(added[0]).toMatchObject({ action: 'update', origin: 'ui', owner: OWNER, ids: [seeded], count: 1, ok: true, client: 'dashboard', text: '' })
      expect(JSON.stringify(added[0])).not.toContain('YAML')
    })

    test('tags replace the old ones and are cleaned; [] removes them', async () => {
      expect((await post('/api/memory/update', { memory_id: seeded, tags: ['Code Review', 'alpha', 'entity:Rohit'] })).status).toBe(200)
      expect(metaOf(rowOf(store, seeded)).tags).toEqual(['code-review', 'entity:rohit'])
      expect((await post('/api/memory/update', { memory_id: seeded, tags: [] })).status).toBe(200)
      expect(metaOf(rowOf(store, seeded)).tags).toBeUndefined()
    })

    test('pin and unpin merge into the metadata and leave the tags alone', async () => {
      await post('/api/memory/update', { memory_id: seeded, tags: ['keep-me'] })
      expect((await post('/api/memory/update', { memory_id: seeded, pinned: true })).status).toBe(200)
      expect(metaOf(rowOf(store, seeded))).toMatchObject({ pinned: true, tags: ['keep-me'] })
      expect((await post('/api/memory/update', { memory_id: seeded, pinned: false })).status).toBe(200)
      expect(metaOf(rowOf(store, seeded))).toMatchObject({ pinned: false, tags: ['keep-me'] })
    })

    test('expires_in_days sets the expiry from now and null clears it', async () => {
      expect((await post('/api/memory/update', { memory_id: seeded, expires_in_days: 10 })).status).toBe(200)
      const left = (Date.parse(rowOf(store, seeded)!.valid_until) - Date.now()) / 86_400_000
      expect(left).toBeGreaterThan(9.99)
      expect(left).toBeLessThan(10.01)
      expect((await post('/api/memory/update', { memory_id: seeded, expires_in_days: null })).status).toBe(200)
      expect(rowOf(store, seeded)!.valid_until).toBeNull()
    })

    test('422 and 409 apply to new text; the row is unchanged', async () => {
      const before = rowOf(store, seeded)!.content
      const blocked = await post('/api/memory/update', { memory_id: seeded, content: `Rotate the key ${AWS_KEY} before Friday` })
      expect(blocked.status).toBe(422)
      expect(JSON.stringify(blocked.json)).not.toContain(AWS_KEY)
      // the row is a decision now, a kind G4 leaves alone; as a fact the dated progress note warns
      const dated = { memory_id: seeded, content: 'Merged the alpha release on 2026-10-24 and it is done', kind: 'fact' }
      const warned = await post('/api/memory/update', dated)
      expect(warned.status).toBe(409)
      expect(rowOf(store, seeded)!.content).toBe(before)
      expect(rowOf(store, seeded)!.memory_type).toBe('decision')
      const confirmed = await post('/api/memory/update', { ...dated, confirm: true })
      expect(confirmed.status).toBe(200)
      expect(metaOf(rowOf(store, seeded)).guard).toEqual(['G4'])
      expect(lines().filter(line => line.error === 'guard:G1').every(line => !JSON.stringify(line).includes(AWS_KEY))).toBe(true)
    })

    test('a change with no new text skips the guard (an old long text can still have its tags edited)', async () => {
      const long = await seed(store, OWNER, 'q'.repeat(3000), { memory_type: 'fact' })
      expect((await post('/api/memory/update', { memory_id: long, tags: ['edited'] })).status).toBe(200)
      expect(metaOf(rowOf(store, long)).tags).toEqual(['edited'])
    })
  })

  describe('POST /api/memory/retire and /api/memory/restore', () => {
    test('400 for a bad id or an extra key; 404 for a missing row; 409 for a row with no owner', async () => {
      for (const path of ['/api/memory/retire', '/api/memory/restore']) {
        expect((await send(path, '{nope')).status).toBe(400)
        expect((await post(path, {})).status).toBe(400)
        expect((await post(path, { memory_id: 7 })).status).toBe(400)
        expect((await post(path, { memory_id: other, confirm: true })).json.error).toMatch(/unexpected field/)
        const gone = await post(path, { memory_id: 'no-such-id' })
        expect(gone.status).toBe(404)
        expect(gone.json.status).toBe('not_found')
        expect((await post(path, { memory_id: 'ownerless-1' })).status).toBe(409)
      }
      expect(rowOf(store, 'ownerless-1')!.valid_until ?? null).toBeNull()
    })

    test('retire sets valid_until and the trail, deletes nothing, and a second retire is 409', async () => {
      const id = await seed(store, OWNER, 'The alpha wiki page about onboarding is out of date', { memory_type: 'fact' })
      const count = countRows(store)
      const before = lines().length
      const { status, json } = await post('/api/memory/retire', { memory_id: id })
      expect(status).toBe(200)
      expect(json).toEqual({ status: 'retired', memory_id: id, owner: OWNER })
      expect(countRows(store)).toBe(count)
      const row = rowOf(store, id)!
      expect(row.content).toBe('The alpha wiki page about onboarding is out of date')
      expect(Date.parse(row.valid_until)).toBeLessThanOrEqual(Date.now())
      expect(row.superseded_by).toBeNull()
      expect(trailOf(store, id)).toEqual([{ action: 'retire', validator: 'dashboard', new_content: null, note: null }])
      const added = lines().slice(before)
      expect(added).toHaveLength(1)
      expect(added[0]).toMatchObject({ action: 'retire', origin: 'ui', owner: OWNER, ids: [id], count: 1, ok: true, client: 'dashboard', text: '' })
      // already not live
      const again = await post('/api/memory/retire', { memory_id: id })
      expect(again.status).toBe(409)
      expect(trailOf(store, id)).toHaveLength(1)
    })

    test('retire with replaced_by stores the replacement id (the engine argument is replacement_id)', async () => {
      const old = await seed(store, OWNER, 'The alpha deploy runs on the old pipeline', { memory_type: 'fact' })
      const fresh = await seed(store, OWNER, 'The alpha deploy runs on the new pipeline', { memory_type: 'fact' })
      expect((await post('/api/memory/retire', { memory_id: old, replaced_by: fresh })).status).toBe(200)
      expect(rowOf(store, old)!.superseded_by).toBe(fresh)
      expect(rowOf(store, fresh)!.superseded_by).toBeNull()
      // a replacement that is the row itself, or does not exist, is refused and retires nothing
      const keep = await seed(store, OWNER, 'The alpha logs go to the shared bucket', { memory_type: 'fact' })
      expect((await post('/api/memory/retire', { memory_id: keep, replaced_by: keep })).status).toBe(400)
      expect((await post('/api/memory/retire', { memory_id: keep, replaced_by: 'no-such-id' })).status).toBe(400)
      expect((await post('/api/memory/retire', { memory_id: keep, replaced_by: 7 })).status).toBe(400)
      expect(rowOf(store, keep)!.valid_until ?? null).toBeNull()
    })

    test('restore brings a retired row back, writes the trail, and a live row is unchanged', async () => {
      const id = await seed(store, OWNER, 'The alpha cache is cleared nightly by cron', { memory_type: 'fact' })
      const fresh = await seed(store, OWNER, 'The alpha cache is cleared hourly by cron', { memory_type: 'fact' })
      await post('/api/memory/retire', { memory_id: id, replaced_by: fresh })
      const before = lines().length
      const restored = await post('/api/memory/restore', { memory_id: id })
      expect(restored.status).toBe(200)
      expect(restored.json).toEqual({ status: 'restored', memory_id: id, owner: OWNER })
      expect(rowOf(store, id)).toMatchObject({ valid_until: null, superseded_by: null })
      expect(trailOf(store, id).map(entry => [entry.action, entry.validator])).toEqual([['retire', 'dashboard'], ['restore', 'dashboard']])
      expect(lines().slice(before)).toHaveLength(1)
      expect(lines().slice(-1)[0]).toMatchObject({ action: 'restore', origin: 'ui', owner: OWNER, ids: [id], count: 1, ok: true, text: '' })
      // restoring a live row changes nothing
      const unchanged = await post('/api/memory/restore', { memory_id: id })
      expect(unchanged.status).toBe(200)
      expect(unchanged.json.status).toBe('unchanged')
      expect(trailOf(store, id)).toHaveLength(2)
    })

    test('restore brings back a row whose own expiry passed', async () => {
      const id = await seed(store, OWNER, 'The alpha preview site is up for the review', { memory_type: 'context', valid_until: '2020-01-01T00:00:00.000Z' })
      expect((await post('/api/memory/restore', { memory_id: id })).json.status).toBe('restored')
      expect(rowOf(store, id)!.valid_until).toBeNull()
    })

    test('no route retires or deletes more than the memory it names', async () => {
      const ids = [await seed(store, OWNER, 'The alpha repo uses trunk based development', { memory_type: 'fact' }), await seed(store, OWNER, 'The alpha repo squashes every merge', { memory_type: 'fact' })]
      const count = countRows(store)
      expect((await post('/api/memory/retire', { memory_id: ids[0] })).status).toBe(200)
      expect(countRows(store)).toBe(count)
      expect(rowOf(store, ids[1]!)!.valid_until ?? null).toBeNull()
      // a list, a wildcard or an owner is not a memory id the route takes
      expect((await post('/api/memory/retire', { memory_ids: ids })).status).toBe(400)
      expect((await post('/api/memory/retire', { owner: OWNER })).status).toBe(400)
      expect((await post('/api/memory/retire', { memory_id: '*' })).status).toBe(404)
      expect(rowOf(store, ids[1]!)!.valid_until ?? null).toBeNull()
    })

    test('create, update, retire, restore and forget share one write lane', async () => {
      const ids = await Promise.all(Array.from({ length: 4 }, (_, i) => seed(store, OWNER, `The alpha concurrency probe number ${i} is a fact`, { memory_type: 'fact' })))
      const results = await Promise.all([
        post('/api/memory/update', { memory_id: ids[0], importance: 0.3 }),
        post('/api/memory/retire', { memory_id: ids[1] }),
        post('/api/memory/create', { owner: OWNER, content: 'The alpha concurrency probe made by create', kind: 'fact' }),
        post('/api/forget', { memory_id: ids[2] }),
      ])
      expect(results.map(result => result.status)).toEqual([200, 200, 200, 200])
      expect(rowOf(store, ids[2]!)).toBeNull()
    })
  })

  test('no test left the real home alone: the activity log and the store are temp files', () => {
    expect(log.startsWith(temp.dir)).toBe(true)
    expect(store.startsWith(temp.dir)).toBe(true)
    expect(process.env.HOME).not.toBe(undefined)
  })
})

// G3: the near-duplicate check, with a stand-in engine. It answers mnemopi_similar with canned matches and records every
// call (tool, owner, arguments) in a file; remember and update answer 'stored' and 'updated' without a store.
describe('CRUDX.1: G3 near-duplicates on a dashboard save', () => {
  const temp = tempDir('crud-g3')
  const store = join(temp.dir, 'store')
  const calls = join(temp.dir, 'calls.jsonl')
  const cli = join(temp.dir, 'stand-in-cli.ts')
  const home = useTempHome()
  let started: Started
  let url = ''
  let target: string

  const post = async (path: string, payload: unknown) => {
    const response = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${started.token}`, 'Content-Type': 'application/json', Origin: url },
      body: JSON.stringify(payload),
    })
    return { status: response.status, json: (await response.json()) as Row }
  }
  const recorded = () => (existsSync(calls) ? readFileSync(calls, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as Row) : [])

  beforeAll(async () => {
    home.enter('on')
    mkdirSync(store, { recursive: true })
    target = await seed(store, OWNER, 'The alpha service keeps its settings in a TOML file', { memory_type: 'fact' })
    writeFileSync(
      cli,
      `import { appendFileSync, readFileSync } from 'node:fs'
const calls = ${JSON.stringify(calls)}
const lines = (await Bun.stdin.text()).split('\\n').filter(Boolean)
for (const line of lines) {
  const { id, params } = JSON.parse(line)
  const { name, arguments: args } = params
  appendFileSync(calls, JSON.stringify({ name, owner: process.env.MNEMOPI_SESSION_ID, args, noEmbeddings: process.env.MNEMOPI_NO_EMBEDDINGS ?? '' }) + '\\n')
  const matches = JSON.parse(readFileSync(${JSON.stringify(join(temp.dir, 'matches.json'))}, 'utf8'))
  const reply =
    name === 'mnemopi_similar' ? { matches, embeddings: true }
    : name === 'mnemopi_remember' ? { status: 'stored', memory_id: 'made-1' }
    : { status: 'updated', memory_id: args.memory_id }
  console.log(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(reply) }] } }))
}
`,
    )
    writeFileSync(join(temp.dir, 'matches.json'), '[]')
    started = await startServer({ root: join(temp.dir, 'root'), store, cli, activityLog: '', pluginRoot: ROOT })
    url = `http://127.0.0.1:${started.port}`
  }, 120_000)

  afterAll(() => {
    started?.stop()
    home.leave()
    temp.dispose()
  })

  const setMatches = (matches: unknown[]) => writeFileSync(join(temp.dir, 'matches.json'), JSON.stringify(matches))
  const close = { id: 'close-1', owner: 'global', score: 0.93, preview: 'The alpha service stores its config in TOML' }

  test('a create asks mnemopi_similar as the owner with the setting’s score (0.88) and top 3, with embeddings on', async () => {
    setMatches([])
    writeFileSync(calls, '')
    const text = 'The alpha service keeps its configuration in a TOML document'
    const { status } = await post('/api/memory/create', { owner: OWNER, content: text, kind: 'fact' })
    expect(status).toBe(200)
    expect(recorded().map(call => call.name)).toEqual(['mnemopi_similar', 'mnemopi_remember'])
    expect(recorded()[0]).toMatchObject({ owner: OWNER, noEmbeddings: '', args: { content: text, top_k: 3, min_score: 0.88 } })
  })

  test('a near-duplicate is a 409 of its own, nothing is saved, and confirm: true saves it flagged', async () => {
    setMatches([close])
    writeFileSync(calls, '')
    const payload = { owner: OWNER, content: 'The alpha service keeps its configuration in a TOML document', kind: 'fact' }
    const warned = await post('/api/memory/create', payload)
    expect(warned.status).toBe(409)
    expect(warned.json.near).toEqual([close])
    expect(warned.json.hits[0].rule).toBe('G3')
    expect(recorded().map(call => call.name)).toEqual(['mnemopi_similar'])
    writeFileSync(calls, '')
    const confirmed = await post('/api/memory/create', { ...payload, confirm: true })
    expect(confirmed.status).toBe(200)
    expect(confirmed.json.guard).toEqual(['near-duplicate:close-1'])
    expect(recorded().map(call => call.name)).toEqual(['mnemopi_similar', 'mnemopi_remember'])
    expect(recorded()[1]!.args.metadata).toEqual({ guard: ['near-duplicate:close-1'] })
    expect(recorded()[1]!.args).toMatchObject({ source: 'dashboard', trust_tier: 'STATED', veracity: 'stated', author_type: 'human', memory_type: 'fact', scope: 'channel' })
  })

  test('a match below the score is not a near-duplicate', async () => {
    setMatches([{ ...close, score: 0.7 }])
    expect((await post('/api/memory/create', { owner: OWNER, content: 'The alpha service keeps its configuration in a TOML document', kind: 'fact' })).status).toBe(200)
  })

  test('an update never counts the row itself as its own near-duplicate, and the other match still warns', async () => {
    setMatches([{ id: target, owner: OWNER, score: 0.99, preview: 'itself' }])
    writeFileSync(calls, '')
    const text = 'The alpha service keeps its settings in a TOML file, edited'
    expect((await post('/api/memory/update', { memory_id: target, content: text })).status).toBe(200)
    expect(recorded().map(call => call.name)).toEqual(['mnemopi_similar', 'mnemopi_update'])
    expect(recorded()[0]).toMatchObject({ owner: OWNER })
    expect(recorded()[1]!.args).toMatchObject({ memory_id: target, validator: 'dashboard', content: text })
    setMatches([{ id: target, owner: OWNER, score: 0.99, preview: 'itself' }, close])
    const warned = await post('/api/memory/update', { memory_id: target, content: text })
    expect(warned.status).toBe(409)
    expect(warned.json.near).toEqual([close])
  })

  test('a block never reaches the engine, and an update with no new text asks nothing', async () => {
    writeFileSync(calls, '')
    expect((await post('/api/memory/create', { owner: OWNER, content: `Key ${AWS_KEY} lives in the vault`, kind: 'fact' })).status).toBe(422)
    expect((await post('/api/memory/update', { memory_id: target, importance: 0.4 })).status).toBe(200)
    expect(recorded().map(call => call.name)).toEqual(['mnemopi_update'])
  })

  test('the check is skipped with the near-duplicate setting off', async () => {
    const root = join(temp.dir, 'root')
    expect(writeConfig(root, { 'guard.nearDuplicate': false }).ok).toBe(true)
    try {
      setMatches([close])
      writeFileSync(calls, '')
      expect((await post('/api/memory/create', { owner: OWNER, content: 'The alpha service keeps its configuration in a TOML document', kind: 'fact' })).status).toBe(200)
      expect(recorded().map(call => call.name)).toEqual(['mnemopi_remember'])
    } finally {
      writeConfig(root, { 'guard.nearDuplicate': null })
    }
  })
})
