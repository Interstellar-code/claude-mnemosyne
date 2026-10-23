// TAGS.3: bin/memories.ts (the read-only list/get and the proposals writer) and
// the backfill's apply-time re-check, run for real: a temporary store made by
// the real engine (engine/src/cli.ts), the real script as a child process, and
// hooks/backfill.ts's own functions. No model is called: the tags are made up here.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { getRows } from '../../bin/memories'
import { BACKFILL_TEXT_LIMIT, hasTags, judge, parseProposals, parseRows, PROPOSALS_FILE } from '../../hooks/backfill'
import type { Proposal } from '../../hooks/backfill'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const SCRIPT = join(ROOT, 'bin', 'memories.ts')

/** Runs bin/memories.ts as the hook does. */
async function memories(args: readonly string[], stdin?: string) {
  const child = Bun.spawn([process.execPath, SCRIPT, ...args], { stdin: stdin === undefined ? 'ignore' : new Blob([stdin]), stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

const evilDir = () => '/nonexistent/evil-store'
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

describe('bin/memories.ts on a real store', () => {
  const temp = tempDir('memories')
  const store = join(temp.dir, 'store')
  type Name = 'plain' | 'emptyObject' | 'tagged' | 'realUntagged' | 'broken' | 'emptyList' | 'stringTags' | 'junkTags' | 'otherKey' | 'projectNull' | 'unicode'
  const ids = {} as Record<Name, string>

  async function remember(owner: string, name: Name, content: string, metadata?: Record<string, unknown>) {
    const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, ...(metadata ? { metadata } : {}) })])).get(1))
    if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
    ids[name] = reply.memory_id
    await Bun.sleep(10)
  }

  /** Sets a row's metadata_json to exact text (or NULL), as a store written by an older engine might hold it. */
  function setMetadata(id: string, text: string | null) {
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      db.run('UPDATE working_memory SET metadata_json = ? WHERE id = ?', [text, id])
    } finally {
      db.close()
    }
  }

  /** The rule, written again here in JS: a row is untagged unless metadata.tags is an array holding a non-empty string. */
  function expectedUntagged(): string[] {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      const rows = db.query('SELECT id, metadata_json FROM working_memory').all() as { id: string; metadata_json: string | null }[]
      return rows
        .filter(row => {
          try {
            const value = row.metadata_json ? JSON.parse(row.metadata_json) : null
            return !(Array.isArray(value?.tags) && value.tags.some((tag: unknown) => typeof tag === 'string' && tag !== ''))
          } catch {
            return true
          }
        })
        .map(row => row.id)
        .sort()
    } finally {
      db.close()
    }
  }

  const bytes = () =>
    ['mnemopi.db', 'mnemopi.db-wal']
      .map(name => join(store, name))
      .map(file => (existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : 'none'))
      .join(' ')

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    await remember('global', 'plain', 'plain fact with no metadata at all')
    await remember('global', 'emptyObject', 'fact whose metadata is an empty object')
    await remember('global', 'tagged', 'fact with real tags', { tags: ['alpha', 'beta'] })
    await remember('project-a', 'realUntagged', 'fact carrying a tag that is literally named untagged', { tags: ['untagged'] })
    await remember('project-a', 'broken', 'fact whose metadata is broken json')
    await remember('project-a', 'emptyList', 'fact with an empty tag list')
    await remember('project-b', 'stringTags', 'fact whose tags is a string, not a list')
    await remember('project-b', 'junkTags', 'fact whose tags hold only junk')
    await remember('project-b', 'otherKey', 'fact with other metadata and one real tag', { x: 1, tags: ['k'] })
    await remember('project-b', 'projectNull', 'fact with null metadata')
    await remember('project-b', 'unicode', 'Zażółć gęślą jaźń: ünïcödé ✓ fact')
    setMetadata(ids.emptyObject, '{}')
    setMetadata(ids.broken, '{broken')
    setMetadata(ids.emptyList, '{"tags":[]}')
    setMetadata(ids.stringTags, '{"tags":"alpha"}')
    setMetadata(ids.junkTags, '{"tags":[1,null,"",{"a":1}]}')
    setMetadata(ids.projectNull, null)
  }, 120_000)
  afterAll(() => temp.dispose())

  test('TAGS.3.a2: list --untagged prints id, owner, metadata and content as JSON; NULL, {} , broken, [] and junk all count as untagged', async () => {
    const ran = await memories(['--store', store, 'list', '--untagged'])
    expect(ran.exitCode).toBe(0)
    const rows = parseRows(ran.stdout)
    // Counted against the store, never a fixed number.
    expect(rows.map(row => row.id).sort()).toEqual(expectedUntagged())
    expect(rows.length).toBeGreaterThan(5)
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['content', 'id', 'metadata', 'owner', 'sha256', 'taggable'])
    const plain = rows.find(row => row.id === ids.plain)!
    expect(plain).toMatchObject({ owner: 'global', content: 'plain fact with no metadata at all', metadata: null })
    expect(rows.find(row => row.id === ids.emptyObject)!.metadata).toEqual({})
    expect(rows.find(row => row.id === ids.broken)!.metadata).toBeNull()
    expect(rows.find(row => row.id === ids.unicode)!.sha256).toBe(sha('Zażółć gęślą jaźń: ünïcödé ✓ fact'))
    for (const row of rows) expect(row.sha256).toBe(sha(row.content))
  })

  test('a row with a real tag, even one named "untagged", or with other keys plus a tag, is not listed', async () => {
    const rows = parseRows((await memories(['--store', store, 'list', '--untagged'])).stdout)
    const listed = new Set(rows.map(row => row.id))
    for (const name of ['tagged', 'realUntagged', 'otherKey'] as const) expect(listed.has(ids[name])).toBe(false)
    for (const name of ['plain', 'emptyObject', 'broken', 'emptyList', 'stringTags', 'junkTags', 'projectNull'] as const) expect(listed.has(ids[name])).toBe(true)
    // hasTags (the apply-time check) agrees with the SQL on every row.
    const all = parseRows((await memories(['--store', store, 'get', ...Object.values(ids)])).stdout)
    expect(all.length).toBe(Object.keys(ids).length)
    for (const row of all) expect({ id: row.id, tagged: hasTags(row.metadata) }).toEqual({ id: row.id, tagged: !listed.has(row.id) })
  })

  test('get <id>... prints those rows, tagged ones too; unknown and badly shaped ids are skipped', async () => {
    const ran = await memories(['--store', store, 'get', ids.tagged, 'nosuchid', ids.plain, 'bad\nid', 'x'.repeat(65), ids.plain])
    expect(ran.exitCode).toBe(0)
    const rows = parseRows(ran.stdout)
    expect(rows.map(row => row.id).sort()).toEqual([ids.tagged, ids.plain].sort())
    expect(rows.find(row => row.id === ids.tagged)!.metadata).toEqual({ tags: ['alpha', 'beta'] })
    expect(parseRows((await memories(['--store', store, 'get'])).stdout)).toEqual([])
  })

  test('list and get leave the database and its WAL byte for byte unchanged', async () => {
    const before = bytes()
    await memories(['--store', store, 'list', '--untagged'])
    await memories(['--store', store, 'get', ...Object.values(ids)])
    expect(bytes()).toBe(before)
  })

  test('a store with no database yet lists nothing', async () => {
    const empty = join(temp.dir, 'empty-store')
    mkdirSync(empty)
    expect((await memories(['--store', empty, 'list', '--untagged'])).stdout.trim()).toBe('[]')
    expect((await memories(['--store', empty, 'get', 'abc'])).stdout.trim()).toBe('[]')
  })

  test('bad usage exits 1 with a message and prints no rows', async () => {
    for (const args of [['list', '--untagged'], ['--store', store, 'list'], ['--store', store, 'list', '--untagged', 'extra'], ['get', 'x'], ['frobnicate'], []]) {
      const ran = await memories(args)
      expect({ args, exitCode: ran.exitCode, stdout: ran.stdout }).toEqual({ args, exitCode: 1, stdout: '' })
      expect(ran.stderr).toContain('mnemosyne memories:')
    }
  })


  test('TAGS r2 MED 1: an id or argument can never redirect the read to another store', async () => {
    const evil = join(temp.dir, 'evil-store')
    mkdirSync(evil)
    // A second --store anywhere after the command is refused, whatever the ids around it.
    for (const args of [
      ['get', '--store', evil, ids.plain, '--store', store],
      ['--store', store, 'get', '--store', evil, ids.plain],
      ['--store', store, 'get', ids.plain, '--store', evil],
      ['--store', store, 'list', '--untagged', '--store', evil],
      ['--store', store, 'get', '--', ids.plain],
      ['--store', store, 'get', '-x', ids.plain],
      ['--store', store, '--store', evil, 'get', ids.plain],
    ]) {
      const ran = await memories(args)
      expect({ args, exitCode: ran.exitCode, stdout: ran.stdout }).toEqual({ args, exitCode: 1, stdout: '' })
    }
    // The real store is still read from the one --store, ahead of the command.
    expect(parseRows((await memories(['--store', store, 'get', ids.plain])).stdout).map(row => row.id)).toEqual([ids.plain])
  })

  test('ids that start with - or break the id shape are never read (getRows), and save refuses them', async () => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      expect(getRows(db, ['--store', evilDir(), ids.plain]).map(row => row.id)).toEqual([ids.plain])
      expect(getRows(db, ['-' + ids.plain])).toEqual([])
    } finally {
      db.close()
    }
    const file = join(temp.dir, 'root-ids', PROPOSALS_FILE)
    for (const id of ['--store', '-x', '', 'a'.repeat(65), 'bad\nid']) {
      const ran = await memories(['save', file], JSON.stringify({ proposals: [{ id, owner: 'global', tags: ['a'], sha256: sha('x') }] }))
      expect({ id, exitCode: ran.exitCode }).toEqual({ id, exitCode: 1 })
    }
    expect(existsSync(file)).toBe(false)
    // parseProposals rejects the same ids on the way back in.
    for (const id of ['--store', '-x', '', 'a'.repeat(65)]) {
      expect(() => parseProposals(JSON.stringify({ proposals: [{ id, owner: 'global', tags: ['a'], sha256: 'a'.repeat(64) }] }))).toThrow()
    }
  })

  test('TAGS r2 LOW 4: a row whose metadata is not a JSON object is listed with taggable false; objects and NULL are taggable', async () => {
    const rows = parseRows((await memories(['--store', store, 'list', '--untagged'])).stdout)
    const taggable = (name: Name) => rows.find(row => row.id === ids[name])!.taggable
    expect(taggable('broken')).toBe(false)
    for (const name of ['plain', 'emptyObject', 'emptyList', 'stringTags', 'junkTags', 'projectNull', 'unicode'] as const) expect({ name, taggable: taggable(name) }).toEqual({ name, taggable: true })
    // A list or a bare string as metadata is not an object either.
    setMetadata(ids.junkTags, '["x"]')
    setMetadata(ids.stringTags, '"just text"')
    const again = parseRows((await memories(['--store', store, 'list', '--untagged'])).stdout)
    expect(again.find(row => row.id === ids.junkTags)!.taggable).toBe(false)
    expect(again.find(row => row.id === ids.stringTags)!.taggable).toBe(false)
    setMetadata(ids.junkTags, '{"tags":[1,null,"",{"a":1}]}')
    setMetadata(ids.stringTags, '{"tags":"alpha"}')
  })

  test('TAGS r2 LOW 6: list and get print at most BACKFILL_TEXT_LIMIT code points of a memory, with the hash of the whole text', async () => {
    const long = `${'é😀x'.repeat(BACKFILL_TEXT_LIMIT)} end`
    const id = body((await engineCall(CLI, store, 'global', [toolCall(1, 'mnemopi_remember', { content: long })])).get(1)).memory_id as string
    for (const args of [['--store', store, 'list', '--untagged'], ['--store', store, 'get', id]]) {
      const row = parseRows((await memories(args)).stdout).find(r => r.id === id)!
      expect(Array.from(row.content).length).toBe(BACKFILL_TEXT_LIMIT)
      expect(long.startsWith(row.content)).toBe(true)
      expect(row.sha256).toBe(sha(long))
    }
  })

  describe('save', () => {
    const file = () => join(temp.dir, 'root', PROPOSALS_FILE)
    const good: Proposal = { id: 'abc', owner: 'global', tags: ['git', 'ci'], sha256: sha('x') }

    test('TAGS.3.a3: writes id, owner, tags and sha256 only, mode 0600, never the content', async () => {
      const input = JSON.stringify({ proposals: [{ ...good, tags: [' Git ', 'CI', 'git'], content: 'SECRET MEMORY TEXT', metadata: { a: 1 } }] })
      const ran = await memories(['save', file()], input)
      expect(ran.exitCode).toBe(0)
      const text = readFileSync(file(), 'utf8')
      expect(text).not.toContain('SECRET MEMORY TEXT')
      expect(text).not.toContain('metadata')
      expect(JSON.parse(text).proposals).toEqual([good])
      expect(parseProposals(text)).toEqual([good])
      expect(statSync(file()).mode & 0o777).toBe(0o600)
      expect(statSync(join(temp.dir, 'root')).mode & 0o777).toBe(0o700)
      // A new run replaces it whole and leaves no temp file behind.
      await memories(['save', file()], JSON.stringify({ proposals: [{ ...good, id: 'zzz' }] }))
      expect(parseProposals(readFileSync(file(), 'utf8')).map(p => p.id)).toEqual(['zzz'])
      expect(readdirSync(join(temp.dir, 'root')).filter(name => name.endsWith('.tmp'))).toEqual([])
      expect(statSync(file()).mode & 0o777).toBe(0o600)
    })

    test('a looser existing file is replaced by a 0600 one', async () => {
      writeFileSync(file(), 'old', { mode: 0o644 })
      await memories(['save', file()], JSON.stringify({ proposals: [good] }))
      expect(statSync(file()).mode & 0o777).toBe(0o600)
    })

    test('refuses a file with another name, and input that is not proposals; nothing is written', async () => {
      const other = join(temp.dir, 'root', 'other.json')
      expect((await memories(['save', other], JSON.stringify({ proposals: [good] }))).exitCode).toBe(1)
      expect(existsSync(other)).toBe(false)
      const before = readFileSync(file(), 'utf8')
      for (const input of ['not json', '[]', '{}', '{"proposals":[{"id":"a"}]}', JSON.stringify({ proposals: [{ ...good, sha256: 'short' }] }), JSON.stringify({ proposals: [{ ...good, tags: [] }] }), JSON.stringify({ proposals: [{ ...good, tags: ['', ' '] }] })]) {
        expect({ input, exitCode: (await memories(['save', file()], input)).exitCode }).toEqual({ input, exitCode: 1 })
      }
      expect(readFileSync(file(), 'utf8')).toBe(before)
    })
  })
})

describe('the backfill apply path on a real store: only rows that did not change are written', () => {
  const temp = tempDir('memories-apply')
  const store = join(temp.dir, 'store')
  const root = join(temp.dir, 'root')
  const file = join(root, PROPOSALS_FILE)
  const ids = {} as Record<'a' | 'b' | 'gone' | 'tagged' | 'edited' | 'c', string>

  async function remember(owner: string, name: keyof typeof ids, content: string) {
    const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content })])).get(1))
    ids[name] = reply.memory_id
    await Bun.sleep(10)
  }
  const rowsOf = () => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      return db.query('SELECT id, session_id AS owner, content, recall_count, last_recalled, metadata_json FROM working_memory ORDER BY id').all() as Record<string, any>[]
    } finally {
      db.close()
    }
  }

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    await remember('o1', 'a', 'alpha fact about git commits')
    await remember('o1', 'b', 'beta fact about deploys')
    await remember('o1', 'gone', 'gamma fact that will be forgotten')
    await remember('o1', 'tagged', 'delta fact that Claude tags meanwhile')
    await remember('o2', 'edited', 'epsilon fact that is edited meanwhile')
    await remember('o2', 'c', 'zeta fact about ci pipelines')
    // Recalls that count, so recall_count is something to keep.
    for (let i = 0; i < 2; i++) await engineCall(CLI, store, 'o1', [toolCall(1, 'mnemopi_recall', { query: 'commits' })])
  }, 120_000)
  afterAll(() => temp.dispose())

  test('TAGS.3.a4/a5: apply skips gone, already-tagged and changed rows, writes the rest by owner, and keeps ids and recall counts', async () => {
    // The dry run: every untagged row gets made-up tags and is saved.
    const listed = parseRows((await memories(['--store', store, 'list', '--untagged'])).stdout)
    expect(listed.length).toBe(6)
    const proposals: Proposal[] = listed.map(row => ({ id: row.id, owner: row.owner, tags: [`topic-${row.content.split(' ')[0]}`, 'backfill'], sha256: row.sha256 }))
    expect((await memories(['save', file], JSON.stringify({ proposals }))).exitCode).toBe(0)
    const before = new Map(rowsOf().map(row => [row.id, row]))
    expect(before.get(ids.a)!.recall_count).toBe(2)

    // Time passes: one row is forgotten, one gains tags, one has its text edited.
    await engineCall(CLI, store, 'o1', [toolCall(1, 'mnemopi_forget', { memory_id: ids.gone })])
    await engineCall(CLI, store, 'o1', [toolCall(1, 'mnemopi_update', { memory_id: ids.tagged, metadata: { tags: ['by-claude'] } })])
    await engineCall(CLI, store, 'o2', [toolCall(1, 'mnemopi_update', { memory_id: ids.edited, content: 'epsilon fact, edited after the dry run' })])

    // Apply, as the hook does: re-read, judge, group by owner, one engine process per owner.
    const saved = parseProposals(readFileSync(file, 'utf8'))
    const now = new Map(parseRows((await memories(['--store', store, 'get', ...saved.map(p => p.id)])).stdout).map(row => [row.id, row]))
    const verdicts = Object.fromEntries(saved.map(p => [p.id, judge(p, now.get(p.id))]))
    expect(verdicts).toEqual({ [ids.a]: 'write', [ids.b]: 'write', [ids.gone]: 'gone', [ids.tagged]: 'tagged', [ids.edited]: 'changed', [ids.c]: 'write' })
    const owners = new Set(saved.filter(p => verdicts[p.id] === 'write').map(p => p.owner))
    for (const owner of owners) {
      const list = saved.filter(p => p.owner === owner && verdicts[p.id] === 'write')
      const replies = await engineCall(CLI, store, owner, list.map((p, i) => toolCall(i + 1, 'mnemopi_update', { memory_id: p.id, metadata: { tags: p.tags } })))
      for (let i = 0; i < list.length; i++) expect(body(replies.get(i + 1)).status).toBe('updated')
    }

    const after = new Map(rowsOf().map(row => [row.id, row]))
    for (const name of ['a', 'b', 'c'] as const) {
      const row = after.get(ids[name])!
      expect(JSON.parse(row.metadata_json)).toEqual({ tags: saved.find(p => p.id === ids[name])!.tags })
      // Same id, same text, same recall history.
      expect(row.recall_count).toBe(before.get(ids[name])!.recall_count)
      expect(row.last_recalled).toBe(before.get(ids[name])!.last_recalled)
      expect(row.content).toBe(before.get(ids[name])!.content)
    }
    expect(after.has(ids.gone)).toBe(false)
    expect(JSON.parse(after.get(ids.tagged)!.metadata_json)).toEqual({ tags: ['by-claude'] })
    expect(after.get(ids.edited)!.metadata_json).toBeNull()
    // Nothing of the three written rows is untagged any more.
    const left = parseRows((await memories(['--store', store, 'list', '--untagged'])).stdout).map(row => row.id)
    expect(left).toEqual([ids.edited])
  })
})

// ---- KNOWX.2.a4 / KNOWX.3.a2: the pending entries and the no-knowledge list ----

describe('bin/memories.ts pending and --no-knowledge', () => {
  const temp = tempDir('memories-knowledge')
  const store = join(temp.dir, 'store')
  const root = join(temp.dir, 'root')
  const ID = 'a1b2c3d4e5f60718'
  const OTHER = '0011223344556677'

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    const reply = body((await engineCall(CLI, store, 'global', [toolCall(1, 'mnemopi_remember', { content: 'a fact with known knowledge' })])).get(1))
    if (typeof reply?.memory_id !== 'string') throw new Error('remember failed')
    expect(reply.memory_id).toMatch(/^[0-9a-f]{16}$/)
  }, 60_000)
  afterAll(() => temp.dispose())

  const pendingDir = join(root, 'knowledge-pending')

  test('KNOWX.2.a4: pending write makes a 0600 file, list names it, remove drops it', async () => {
    const written = await memories(['pending', 'write', root], JSON.stringify({ id: ID, owner: 'global', sha256: sha('x') }))
    expect(written.exitCode).toBe(0)
    const file = join(pendingDir, `${ID}.json`)
    expect(existsSync(file)).toBe(true)
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
    const listed = await memories(['pending', 'list', root])
    expect(JSON.parse(listed.stdout)).toEqual([{ id: ID, owner: 'global', sha256: sha('x') }])
  })

  test('KNOWX.2.a4: remove keeps a newer entry (different sha) and drops the matching one', async () => {
    await memories(['pending', 'write', root], JSON.stringify({ id: OTHER, owner: 'global', sha256: sha('old') }))
    // A newer update's entry replaced it; this run's sha must not remove it.
    await memories(['pending', 'write', root], JSON.stringify({ id: OTHER, owner: 'global', sha256: sha('new') }))
    const kept = await memories(['pending', 'remove', root, OTHER, sha('old')])
    expect(kept.exitCode).toBe(0)
    const keptEntries = JSON.parse((await memories(['pending', 'list', root])).stdout) as { id: string; sha256: string }[]
    expect(keptEntries.map(entry => [entry.id, entry.sha256])).toContainEqual([OTHER, sha('new')])
    await memories(['pending', 'remove', root, OTHER, sha('new')])
    const gone = JSON.parse((await memories(['pending', 'list', root])).stdout) as { id: string }[]
    expect(gone.some(entry => entry.id === OTHER)).toBe(false)
  })

  test('KNOWX R2: pending write takes a list and remove-many drops each entry like remove, in one process', async () => {
    const A = '1111111111111111'
    const B = '2222222222222222'
    const C = '3333333333333333'
    const written = await memories(['pending', 'write', root], JSON.stringify([A, B, C].map((id, i) => ({ id, owner: i === 2 ? 'other' : 'global', sha256: sha(id) }))))
    expect(written.exitCode).toBe(0)
    for (const id of [A, B, C]) if (process.platform !== 'win32') expect(statSync(join(pendingDir, `${id}.json`)).mode & 0o777).toBe(0o600)
    // A holds its own sha (removed), B is asked with a stale sha (kept), C with no sha (removed whatever it holds).
    const removed = await memories(['pending', 'remove-many', root], JSON.stringify([{ id: A, sha256: sha(A) }, { id: B, sha256: sha('stale') }, { id: C }]))
    expect(removed.exitCode).toBe(0)
    const left = (JSON.parse((await memories(['pending', 'list', root])).stdout) as { id: string }[]).map(entry => entry.id)
    expect(left).toContain(B)
    expect(left).not.toContain(A)
    expect(left).not.toContain(C)
    await memories(['pending', 'remove-many', root], JSON.stringify([{ id: B }]))
  })

  test('KNOWX R2: a bad list is refused whole: pending write writes nothing, remove-many removes nothing', async () => {
    const GOOD = '4444444444444444'
    const bad = await memories(['pending', 'write', root], JSON.stringify([{ id: GOOD, owner: 'global', sha256: sha('x') }, { id: 'nope', owner: 'global' }]))
    expect(bad.exitCode).toBe(1)
    expect(existsSync(join(pendingDir, `${GOOD}.json`))).toBe(false)
    await memories(['pending', 'write', root], JSON.stringify({ id: GOOD, owner: 'global', sha256: sha('x') }))
    const refused = await memories(['pending', 'remove-many', root], JSON.stringify([{ id: GOOD }, { id: 7 }]))
    expect(refused.exitCode).toBe(1)
    expect(existsSync(join(pendingDir, `${GOOD}.json`))).toBe(true)
    expect((await memories(['pending', 'remove-many', root], '{"id":"x"}')).exitCode).toBe(1)
    await memories(['pending', 'remove', root, GOOD])
  })

  test('KNOWX R2 finding 1: pending refuses --store, which is why the hook must not send one', async () => {
    const refused = await memories(['--store', store, 'pending', 'list', root])
    expect(refused.exitCode).toBe(1)
    expect(refused.stderr).toContain('pending does not take --store')
  })

  test('KNOWX.2.a4: a non-hex id is refused, never joined into a path', async () => {
    for (const id of ['../../etc/passwd', 'ABCDEF', '../x', '']) {
      const wrote = await memories(['pending', 'write', root], JSON.stringify({ id, owner: 'global', sha256: sha('x') }))
      expect({ id, exitCode: wrote.exitCode }).toEqual({ id, exitCode: 1 })
    }
    const removed = await memories(['pending', 'remove', root, '../x'])
    expect(removed.exitCode).toBe(1)
  })

  test('KNOWX.3.a2: list --no-knowledge names every memory with no memoria row', async () => {
    const listed = await memories(['--store', store, 'list', '--no-knowledge'])
    expect(listed.exitCode).toBe(0)
    const rows = JSON.parse(listed.stdout) as { id: string; owner: string; sha256: string }[]
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(row.owner).toBe('global')
    }
    // Once knowledge rows exist for a memory, it leaves the list.
    const id = rows[0]!.id
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      db.run("INSERT INTO memoria_facts (session_id, fact_type, key, value, source_memory_id) VALUES ('global', 'fact', NULL, 'f', ?)", [id])
    } finally {
      db.close()
    }
    const after = await memories(['--store', store, 'list', '--no-knowledge'])
    const left = JSON.parse(after.stdout) as { id: string }[]
    expect(left.some(row => row.id === id)).toBe(false)
  })

  test('KNOWX.3.a2: the sha256 is of the stored content, the same bytes knowledge_prompt hashes', async () => {
    // A non-ASCII memory: the engine hashes utf-8 content; so must bin/memories.ts.
    const text = 'naïve café — ünïcode fact'
    const reply = body((await engineCall(CLI, store, 'global', [toolCall(1, 'mnemopi_remember', { content: text })])).get(1))
    const id = reply.memory_id as string
    const got = parseRows((await memories(['--store', store, 'get', id])).stdout)[0]!
    const promptReply = body((await engineCall(CLI, store, 'global', [toolCall(1, 'mnemopi_knowledge_prompt', { memory_id: id })])).get(1))
    expect(got.sha256).toBe(promptReply.sha256)
    expect(got.sha256).toBe(sha(text))
  })
})
