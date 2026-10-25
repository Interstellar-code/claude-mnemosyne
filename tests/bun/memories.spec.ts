// TAGS.3: bin/memories.ts (the read-only list/get and the proposals writer) and
// the backfill's apply-time re-check, run for real: a temporary store made by
// the real engine (engine/src/cli.ts), the real script as a child process, and
// hooks/backfill.ts's own functions. No model is called: the tags are made up here.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { backupName, backupStore, BACKUP_KEEP, getRows } from '../../bin/memories'
import { BACKFILL_TEXT_LIMIT, hasTags, judge, parseProposals, parseRows, PROPOSALS_FILE } from '../../hooks/backfill'
import type { Proposal } from '../../hooks/backfill'
import { writeVocabulary } from '../../bin/vocab'
import { makeHost } from './knowledge-host'
import type { Host } from './knowledge-host'
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
    for (const row of rows) // VOCAB.4 added the kind and the hash of the tags (a retag fills a kind, and tells that the tags changed).
  expect(Object.keys(row).sort()).toEqual(['content', 'id', 'kind', 'metadata', 'owner', 'sha256', 'taggable', 'tagsSha256'])
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

// META.5 (C9): the backup every apply command runs first, on a store made by the real engine.
describe('bin/memories.ts backup', () => {
  const temp = tempDir('backup')
  const root = join(temp.dir, 'data')
  const store = join(root, 'store')
  const folder = join(root, 'backups')
  const names = () => (existsSync(folder) ? readdirSync(folder).sort() : [])

  beforeAll(async () => {
    for (const [i, content] of ['the first note kept in the backup store', 'the second note kept in the backup store', 'the third note kept in the backup store'].entries()) {
      const reply = body((await engineCall(CLI, store, i === 2 ? 'project-a' : 'global', [toolCall(1, 'mnemopi_remember', { content })])).get(1))
      if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
    }
  })
  afterAll(() => {
    if (existsSync(folder)) chmodSync(folder, 0o700)
    temp.dispose()
  })

  test('META.5.a1: backup writes <root>/backups/mnemopi-<UTC stamp>.db with VACUUM INTO, mode 0600, and prints the path and the row count', async () => {
    const ran = await memories(['--store', store, 'backup'])
    expect(ran.exitCode).toBe(0)
    const out = JSON.parse(ran.stdout) as { path: string; rows: number; pruned: number }
    expect(out.rows).toBe(3)
    expect(out.pruned).toBe(0)
    expect(out.path.startsWith(`${folder}/mnemopi-`)).toBe(true)
    expect(out.path).toMatch(/\/mnemopi-\d{8}T\d{9}Z\.db$/)
    expect(names()).toEqual([out.path.slice(folder.length + 1)])
    expect(statSync(out.path).mode & 0o777).toBe(0o600)
    expect(statSync(folder).mode & 0o777).toBe(0o700)
    // It is a whole database: it opens, passes a check and holds the same rows.
    const copy = new Database(out.path, { readonly: true })
    try {
      expect((copy.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n).toBe(3)
      expect((copy.query('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check).toBe('ok')
    } finally {
      copy.close()
    }
    // The store itself is untouched.
    const live = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      expect((live.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n).toBe(3)
    } finally {
      live.close()
    }
  })

  test('META.5.a1: backup <root> names the data root when the store lives elsewhere', async () => {
    const elsewhere = join(temp.dir, 'elsewhere')
    const ran = await memories(['--store', store, 'backup', elsewhere])
    expect(ran.exitCode).toBe(0)
    expect(JSON.parse(ran.stdout).path.startsWith(`${elsewhere}/backups/mnemopi-`)).toBe(true)
  })

  test('META.5.a2: it refuses, before copying, when the disk has less free space than twice the store', () => {
    const before = names()
    const size = statSync(join(store, 'mnemopi.db')).size
    expect(() => backupStore(store, root, { freeBytes: () => 2 * size - 1 })).toThrow(/not enough disk space for a backup/)
    expect(names()).toEqual(before)
    // Exactly twice the store is enough.
    const result = backupStore(store, root, { freeBytes: () => 2 * size + 4096, now: new Date('2030-01-01T00:00:00.000Z') })
    expect(result.path.endsWith('mnemopi-20300101T000000000Z.db')).toBe(true)
  })

  test('META.5.a2: it keeps the newest 10 backups and removes only older mnemopi-*.db files', () => {
    const stray = join(folder, 'notes.txt')
    writeFileSync(stray, 'not a backup')
    for (let i = 0; i < 14; i++) backupStore(store, root, { now: new Date(Date.UTC(2031, 0, 1, 0, 0, i)) })
    const backups = names().filter(name => name.startsWith('mnemopi-'))
    expect(backups.length).toBe(BACKUP_KEEP)
    // The newest ten: the last ten of the 2031 series, none of the earlier ones.
    expect(backups).toEqual(Array.from({ length: 10 }, (_, i) => backupName(new Date(Date.UTC(2031, 0, 1, 0, 0, i + 4)))))
    expect(existsSync(stray)).toBe(true)
  })

  test('META.5.a3: a read-only backups folder makes it fail with a non-zero exit and leaves no file', async () => {
    if (process.getuid?.() === 0) return // root ignores folder modes
    const before = names()
    chmodSync(folder, 0o500)
    try {
      const ran = await memories(['--store', store, 'backup'])
      expect(ran.exitCode).toBe(1)
      expect(ran.stderr).toContain('mnemosyne memories:')
      expect(ran.stdout).toBe('')
    } finally {
      chmodSync(folder, 0o700)
    }
    expect(names()).toEqual(before)
  })

  test('META.5.a1: a store with no database, a missing --store and extra arguments are refused', async () => {
    const empty = join(temp.dir, 'empty-store')
    mkdirSync(empty, { recursive: true })
    const none = await memories(['--store', empty, 'backup'])
    expect(none.exitCode).toBe(1)
    expect(none.stderr).toContain('there is no store database')
    expect(existsSync(join(temp.dir, 'backups'))).toBe(false)
    expect((await memories(['backup'])).exitCode).toBe(1)
    expect((await memories(['--store', store, 'backup', 'a', 'b'])).exitCode).toBe(1)
    expect((await memories(['--store', store, 'backup', '--evil'])).exitCode).toBe(1)
  })
})

// META.2 (C4): what each save path writes, read back from the row, through the real hooks/register.ts
// over the real engine (the host of the knowledge specs; only the model is a stand-in, and it is off here).
describe('META.2: the save paths write honest source, trust tier and veracity', () => {
  const hosts: Host[] = []
  const open = async (options: Record<string, unknown> = {}) => {
    const host = await makeHost({ options: { extractionModel: 'off', ...options } })
    hosts.push(host)
    return host
  }
  afterAll(() => {
    for (const host of hosts.splice(0)) host.dispose()
  })

  const COLUMNS = 'id, content, source, trust_tier, veracity, memory_type, valid_until, scope, author_type, metadata_json'
  type Saved = { id: string; content: string; source: string; trust_tier: string; veracity: string; memory_type: string; valid_until: string | null; scope: string; author_type: string; metadata_json: string | null }
  const rows = (host: Host) => {
    const db = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
    try {
      return db.query(`SELECT ${COLUMNS} FROM working_memory ORDER BY timestamp, id`).all() as Saved[]
    } finally {
      db.close()
    }
  }
  const rowOf = (host: Host, content: string) => rows(host).find(row => row.content === content)!
  const idOf = (reply: { result?: string }) => JSON.parse(String(reply.result).split('\nMnemosyne')[0]!).memory_id as string
  const DAY = 86_400_000
  /** Within a minute of `days` from now. */
  const inDays = (value: string | null, days: number) => {
    expect(value).not.toBeNull()
    expect(Math.abs(Date.parse(value!) - (Date.now() + days * DAY))).toBeLessThan(60_000)
  }

  test('META.2.a1/a3: Claude\'s save is source claude-code, tier DERIVED, veracity unknown, kind as given, no expiry', async () => {
    const host = await open()
    await host.tool('memory_remember', { content: 'we use bun for every script here', kind: 'decision' })
    expect(rowOf(host, 'we use bun for every script here')).toMatchObject({ source: 'claude-code', trust_tier: 'DERIVED', veracity: 'unknown', memory_type: 'decision', valid_until: null, scope: 'global', author_type: 'agent' })
  })

  test('META.2.a1/a3: a trigger-phrase save is source user, tier STATED, veracity stated; the next save is Claude\'s', async () => {
    const host = await open({ rememberTerms: 'remember that' })
    await host.prompt('remember that we deploy on fridays')
    await host.tool('memory_remember', { content: 'we deploy on fridays only', kind: 'fact' })
    await host.tool('memory_remember', { content: 'the second save of that turn', kind: 'fact' })
    expect(rowOf(host, 'we deploy on fridays only')).toMatchObject({ source: 'user', trust_tier: 'STATED', veracity: 'stated', memory_type: 'fact', author_type: 'human', scope: 'global' })
    expect(rowOf(host, 'the second save of that turn')).toMatchObject({ source: 'claude-code', trust_tier: 'DERIVED', veracity: 'unknown', author_type: 'agent' })
  })

  test('META.2.a2/a3: a context note expires in 14 days; expires_in_days sets it (1-365); other kinds have none; a bad value is refused', async () => {
    const host = await open()
    await host.tool('memory_remember', { content: 'the importer is half done today', kind: 'context' })
    await host.tool('memory_remember', { content: 'the importer wrap up is set for next quarter', kind: 'context', expires_in_days: 30 })
    await host.tool('memory_remember', { content: 'a fact that never expires on its own', kind: 'fact' })
    await host.tool('memory_remember', { content: 'a note with no kind and no expiry' })
    inDays(rowOf(host, 'the importer is half done today').valid_until, 14)
    inDays(rowOf(host, 'the importer wrap up is set for next quarter').valid_until, 30)
    expect(rowOf(host, 'a fact that never expires on its own').valid_until).toBeNull()
    expect(rowOf(host, 'a note with no kind and no expiry').valid_until).toBeNull()
    const before = rows(host).length
    for (const expires_in_days of [0, 366, 1.5, '7', -1]) {
      const refused = await host.tool('memory_remember', { content: 'a context note with a bad expiry', kind: 'context', expires_in_days })
      expect(refused.deny).toContain('expires_in_days must be a whole number from 1 to 365')
    }
    expect(rows(host).length).toBe(before)
    const edge = await host.tool('memory_remember', { content: 'the longest expiry allowed here', kind: 'context', expires_in_days: 365 })
    expect(edge.deny).toBeUndefined()
    inDays(rowOf(host, 'the longest expiry allowed here').valid_until, 365)
  })

  test('MODEL NB1/NB2 (b): re-saving identical text keeps scope and tier: a global row stays global, a per-project row stays channel', async () => {
    for (const [options, input, scope] of [
      [{}, {}, 'global'],
      [{ scope: 'per-project' }, {}, 'channel'],
      [{ scope: 'per-project' }, { global: true }, 'global'],
    ] as const) {
      const host = await open(options)
      const content = `re-saving this note must not change its scope (${scope})`
      await host.tool('memory_remember', { content, kind: 'fact', ...input })
      const first = rowOf(host, content)
      expect(first.scope).toBe(scope)
      await host.tool('memory_remember', { content, kind: 'fact', ...input })
      await host.tool('memory_remember', { content, ...input }) // no kind: the stored kind stays too
      expect(rows(host).filter(row => row.content === content)).toHaveLength(1)
      expect(rowOf(host, content)).toMatchObject({ id: first.id, scope, trust_tier: 'DERIVED', source: 'claude-code', memory_type: 'fact' })
    }
  })

  test('META.2.a4 / (c): rows saved before v3 are not relabelled; only a row whose exact text is saved again takes the new path\'s values', async () => {
    const host = await open()
    // Two rows written the pre-v3 way, straight through the engine.
    const old = async (content: string) => {
      const reply = body((await engineCall(join(ROOT, 'engine', 'src', 'cli.ts'), host.store, 'global', [toolCall(1, 'mnemopi_remember', { content, source: 'imported', scope: 'global' })])).get(1))
      return reply!.memory_id as string
    }
    await old('an older memory that stays exactly as it is')
    await old('an older memory that is saved a second time')
    const snapshot = (content: string) => rowOf(host, content)
    const untouched = snapshot('an older memory that stays exactly as it is')
    expect(untouched).toMatchObject({ source: 'imported', trust_tier: 'IMPORTED' })
    // Other saves, an update of a different row and a kind-less save: none of them relabels it.
    await host.tool('memory_remember', { content: 'a brand new memory saved after the old ones', kind: 'fact' })
    expect(snapshot('an older memory that stays exactly as it is')).toEqual(untouched)
    // Saving the exact text again is the same memory written again: it takes the new path's values.
    await host.tool('memory_remember', { content: 'an older memory that is saved a second time', kind: 'fact' })
    expect(snapshot('an older memory that is saved a second time')).toMatchObject({ source: 'claude-code', trust_tier: 'DERIVED', scope: 'global', memory_type: 'fact' })
    expect(snapshot('an older memory that stays exactly as it is')).toEqual(untouched)
  })

  test('GUARD review finding 3 (a): a content update that is clean clears the old metadata.guard flag, and keeps the tags', async () => {
    const host = await open({ guardMode: 'warn' })
    const saved = await host.tool('memory_remember', { content: 'Today the importer was rewired to use the guard module', kind: 'fact', tags: ['ops'] })
    const id = idOf(saved)
    expect(JSON.parse(rowOf(host, 'Today the importer was rewired to use the guard module').metadata_json!)).toEqual({ tags: ['ops'], guard: ['G4'] })
    const updated = await host.tool('memory_update', { memory_id: id, content: 'The importer uses the guard module for every save path.' })
    expect(updated.deny).toBeUndefined()
    expect(JSON.parse(rowOf(host, 'The importer uses the guard module for every save path.').metadata_json!)).toEqual({ tags: ['ops'] })
    // A content update that is warned again sets the flag again.
    await host.tool('memory_update', { memory_id: id, content: 'Today the importer was rewired to use the guard module again' })
    expect(JSON.parse(rowOf(host, 'Today the importer was rewired to use the guard module again').metadata_json!)).toEqual({ tags: ['ops'], guard: ['G4'] })
  })

  test('META.2.a1: no hooks/ or bin/ file writes source: \'imported\' (bin/install-engine.ts is the one named exception)', async () => {
    const files: string[] = []
    for (const folder of ['hooks', 'bin']) for (const name of readdirSync(join(ROOT, folder))) if (name.endsWith('.ts')) files.push(join(folder, name))
    // bin/install-engine.ts: its install-check probe saves one line to a throwaway temp store that is deleted afterwards; it is not a save path.
    const found = files.filter(file => file !== join('bin', 'install-engine.ts') && /source:\s*['"]imported['"]/.test(readFileSync(join(ROOT, file), 'utf8')))
    expect(found).toEqual([])
    expect(files.length).toBeGreaterThan(10)
  })
})

// META.4: replaces retires the row a save supersedes, through the real hooks/register.ts over the real engine.
describe('META.4: replaces retires, never deletes', () => {
  const hosts: Host[] = []
  const open = async (options: Record<string, unknown> = {}) => {
    const host = await makeHost({ options: { extractionModel: 'off', ...options } })
    hosts.push(host)
    return host
  }
  afterAll(() => {
    for (const host of hosts.splice(0)) host.dispose()
  })
  const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
  type Row = { id: string; content: string; session_id: string; scope: string; valid_until: string | null; superseded_by: string | null }
  const rowOf = (host: Host, id: string) => {
    const db = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
    try {
      return db.query('SELECT id, content, session_id, scope, valid_until, superseded_by FROM working_memory WHERE id = ?').get(id) as Row | null
    } finally {
      db.close()
    }
  }
  const auditOf = (host: Host, id: string) => {
    const db = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
    try {
      return db.query('SELECT validator, action FROM memory_validations WHERE memory_id = ? ORDER BY validation_id').all(id) as { validator: string; action: string }[]
    } finally {
      db.close()
    }
  }
  const first = (reply: { result?: string }) => JSON.parse(String(reply.result).split('\nMnemosyne')[0]!)
  const recalled = async (host: Host, query: string) => (JSON.parse((await host.tool('memory_recall', { query })).result!) as { id: string }[]).map(row => row.id)
  /** A row written straight through the engine as another owner, the way an older project's memory sits in the store. */
  const seed = async (host: Host, owner: string, content: string, scope: string) =>
    (body((await engineCall(CLI, host.store, owner, [toolCall(1, 'mnemopi_remember', { content, scope, source: 'claude-code', trust_tier: 'DERIVED' })])).get(1))!.memory_id as string)

  test('META.4.a1/a3/a4: the old row is retired as claude-code, recall stops returning it, nothing is deleted, restore brings it back, and the log has a retire line', async () => {
    const host = await open()
    const old = first(await host.tool('memory_remember', { content: 'The staging cluster runs on the blue network segment.', kind: 'fact' })).memory_id as string
    expect(await recalled(host, 'staging cluster blue network')).toContain(old)
    const saved = await host.tool('memory_remember', { content: 'The staging cluster now runs on the green network segment.', kind: 'fact', replaces: old })
    expect(saved.deny).toBeUndefined()
    const fresh = first(saved).memory_id as string
    expect(String(saved.result)).toContain(`retired ${old}, replaced by ${fresh}`)

    // Retired, not deleted.
    const retired = rowOf(host, old)!
    expect(retired.content).toBe('The staging cluster runs on the blue network segment.')
    expect(retired.superseded_by).toBe(fresh)
    expect(retired.valid_until).not.toBeNull()
    expect(rowOf(host, fresh)).toMatchObject({ superseded_by: null, valid_until: null })
    // Recall no longer returns it; the new row is found.
    const after = await recalled(host, 'staging cluster network segment')
    expect(after).toContain(fresh)
    expect(after).not.toContain(old)
    // The audit trail names who retired it.
    expect(auditOf(host, old)).toEqual([{ validator: 'claude-code', action: 'retire' }])
    // The activity log has a retire line with both ids and no memory text.
    const retireLine = host.activity().find(line => line.action === 'retire')!
    expect(retireLine).toMatchObject({ action: 'retire', origin: 'tool', ok: true, ids: [old, fresh], count: 1 })
    expect(JSON.stringify(retireLine)).not.toContain('staging')

    // Restore (MODEL.2) brings it back, as its owner: recall returns it again.
    const restored = body((await engineCall(CLI, host.store, 'global', [toolCall(1, 'mnemopi_update', { memory_id: old, restore: true, validator: 'rohit' })])).get(1))
    expect(restored?.status).toBe('restored')
    expect(rowOf(host, old)).toMatchObject({ valid_until: null, superseded_by: null })
    expect(await recalled(host, 'staging cluster blue network')).toContain(old)
    expect(auditOf(host, old)).toEqual([{ validator: 'claude-code', action: 'retire' }, { validator: 'rohit', action: 'restore' }])
  })

  test('META.4.a2: an unknown id leaves the new memory saved and names the failure; nothing else changes', async () => {
    const host = await open()
    const bystander = first(await host.tool('memory_remember', { content: 'The bystander memory must stay exactly as it is.', kind: 'fact' })).memory_id as string
    const before = rowOf(host, bystander)
    const saved = await host.tool('memory_remember', { content: 'A fresh memory that claims to replace a missing one.', kind: 'fact', replaces: 'deadbeefdeadbeef' })
    expect(saved.deny).toBeUndefined()
    expect(rowOf(host, first(saved).memory_id)).not.toBeNull()
    expect(String(saved.result)).toContain('replaces deadbeefdeadbeef did not retire it')
    expect(String(saved.result)).toContain('no memory deadbeefdeadbeef found for this project')
    expect(rowOf(host, bystander)).toEqual(before)
    expect(host.activity().find(line => line.action === 'retire')).toMatchObject({ ok: false, ids: ['deadbeefdeadbeef', first(saved).memory_id] })
  })

  test('META.4.a2: a project-only row of another owner is not retired unless its owner is named; a global row is', async () => {
    const host = await open({ scope: 'per-project' })
    const theirs = await seed(host, 'project-other-9z', 'The other project keeps its release notes in the wiki.', 'channel')
    const theirsGlobal = await seed(host, 'project-other-9z', 'The other project shares its style guide with everyone.', 'global')
    // Without the owner, the row is not this project's to retire: the step fails, the new memory stays.
    const miss = await host.tool('memory_remember', { content: 'This project keeps its release notes in the repository.', kind: 'fact', replaces: theirs })
    expect(String(miss.result)).toContain(`no memory ${theirs} found for this project`)
    expect(rowOf(host, theirs)).toMatchObject({ valid_until: null, superseded_by: null })
    // A global row is another project's too, but visible to all.
    const shared = await host.tool('memory_remember', { content: 'This project follows the shared style guide in its own wiki.', kind: 'fact', replaces: theirsGlobal })
    expect(String(shared.result)).toContain(`retired ${theirsGlobal}`)
    expect(rowOf(host, theirsGlobal)!.superseded_by).toBe(first(shared).memory_id)
    // With the owner named (as memory_recall shows it), the project-only row is retired as that owner.
    const named = await host.tool('memory_remember', { content: 'This project keeps its release notes in the repository wiki.', kind: 'fact', replaces: theirs, owner: 'project-other-9z' })
    expect(String(named.result)).toContain(`retired ${theirs}`)
    expect(rowOf(host, theirs)!.superseded_by).toBe(first(named).memory_id)
    const retireLines = host.activity().filter(line => line.action === 'retire')
    expect(retireLines.map(line => line.ok)).toEqual([false, true, true])
    expect(retireLines[2]!.owner).toBe('project-other-9z')
  })

  test('META.4: saving the same text again with replaces naming its own id retires nothing', async () => {
    const host = await open()
    const text = { content: 'The nightly job runs at three in the morning.', kind: 'fact' }
    const id = first(await host.tool('memory_remember', text)).memory_id as string
    const again = await host.tool('memory_remember', { ...text, replaces: id })
    expect(first(again).memory_id).toBe(id)
    expect(String(again.result)).toContain('nothing to retire')
    expect(rowOf(host, id)).toMatchObject({ valid_until: null, superseded_by: null })
  })
})

// VOCAB.4: /mnemosyne-tags retag through the real hooks/register.ts, bin/memories.ts and engine (only the model is a stand-in).
describe('VOCAB.4: retag on a real store', () => {
  const hosts: Host[] = []
  afterAll(() => {
    for (const host of hosts.splice(0)) host.dispose()
  })
  const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
  const VOCAB = {
    version: 1 as const,
    tags: {
      git: { ns: null, description: '', aliases: ['version-control'], admitted: 'init' as const, count: 9 },
      'code-review': { ns: null, description: '', aliases: ['review'], admitted: 'init' as const, count: 5 },
    },
    candidates: {},
  }
  type Answer = { isAnswered: true; text: string } | { isAnswered: false; reason: string; status?: number | null; error?: string }

  async function open(model: (request: { prompt: string }, n: number) => Answer) {
    const host = await makeHost({ options: { extractionModel: 'haiku' }, model: model as never })
    hosts.push(host)
    writeVocabulary(host.root, VOCAB)
    return host
  }
  /** Writes one row straight through the engine, the way an older store holds it. */
  async function seed(host: Host, content: string, extra: Record<string, unknown>) {
    const reply = body((await engineCall(CLI, host.store, 'global', [toolCall(1, 'mnemopi_remember', { content, scope: 'global', ...extra })])).get(1))
    return reply!.memory_id as string
  }
  const db = <T>(host: Host, fn: (db: Database) => T) => {
    const handle = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
    try {
      return fn(handle)
    } finally {
      handle.close()
    }
  }
  const tables = (host: Host) => db(host, d => (d.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(row => row.name))
  /** Every table but working_memory, row by row: knowledge, embeddings, annotations, the audit trail, everything. */
  const others = (host: Host) =>
    db(host, d => Object.fromEntries(tables(host).filter(name => name !== 'working_memory' && !name.startsWith('fts_') && !/_(data|idx|content|docsize|config)$/.test(name)).map(name => [name, d.query(`SELECT * FROM ${name}`).all()])))
  const memories = (host: Host) => db(host, d => d.query('SELECT * FROM working_memory ORDER BY id').all() as Record<string, unknown>[])
  const reply = '{"tags":["Review","version control","made-up"],"kind":"decision"}'

  test('VOCAB.4.a3: apply changes only metadata.tags and a missing kind: every other column of every memory and every other table is as it was', async () => {
    const host = await open(() => ({ isAnswered: true, text: reply }))
    const a = await seed(host, 'The first older memory, tagged by hand long ago.', { source: 'claude-code', trust_tier: 'DERIVED', importance: 0.7, metadata: { tags: ['Old Style', 'my repo'], pinned: true } })
    const b = await seed(host, 'The second older memory, with a kind it keeps.', { source: 'user', trust_tier: 'STATED', veracity: 'stated', importance: 0.9, memory_type: 'preference', metadata: { tags: ['x'] } })
    const c = await seed(host, 'The third older memory, with no metadata at all.', { source: 'imported', importance: 0.2 })
    // A knowledge row for the first memory, so "no knowledge table changes" is not vacuous.
    db(host, () => undefined)
    const writable = new Database(join(host.store, 'mnemopi.db'))
    writable.run("INSERT INTO memoria_facts (session_id, fact_type, key, value, source_memory_id) VALUES ('global', 'fact', 'k', 'a fact worth keeping', ?)", [a])
    writable.close()

    const before = memories(host)
    const othersBefore = others(host)
    expect(JSON.stringify(othersBefore.memoria_facts)).toContain('a fact worth keeping')

    const dry = await host.command('mnemosyne-tags', 'retag')
    expect(dry.text).toContain('Proposed tags and kinds for 3 of 3 memories')
    // the dry run changes nothing at all
    expect(memories(host)).toEqual(before)
    expect(others(host)).toEqual(othersBefore)

    const applied = await host.command('mnemosyne-tags', 'apply')
    expect(applied.text).toContain('Retagged 3 memories of 3 proposed.')
    const after = memories(host)
    expect(after).toHaveLength(3)
    for (const [i, row] of after.entries()) {
      const old = before[i]!
      expect(row.id).toBe(old.id)
      // every column but the two a retag may change is exactly as it was
      const { metadata_json: newMeta, memory_type: newKind, ...rest } = row
      const { metadata_json: oldMeta, memory_type: oldKind, ...was } = old
      expect(rest).toEqual(was)
      expect(JSON.parse(String(newMeta)).tags).toEqual(['code-review', 'git'])
      if (oldKind === 'unknown' || oldKind === null) expect(newKind).toBe('decision')
      else expect(newKind).toBe(oldKind)
      void oldMeta
    }
    // The hand-set kind stayed; other metadata keys stayed; the old tags were replaced.
    expect(after.find(row => row.id === b)!.memory_type).toBe('preference')
    expect(JSON.parse(String(after.find(row => row.id === a)!.metadata_json))).toEqual({ tags: ['code-review', 'git'], pinned: true })
    expect(after.find(row => row.id === c)!.memory_type).toBe('decision')
    // no other table changed: not the knowledge rows, the embeddings, the annotations or the audit trail
    expect(others(host)).toEqual(othersBefore)
    expect(host.activity().filter(line => line.origin === 'backfill').every(line => line.action === 'update')).toBe(true)
  })

  test('VOCAB.4.a1: apply backs the store up first: a copy of the store as it was before any change is in <root>/backups', async () => {
    const host = await open(() => ({ isAnswered: true, text: reply }))
    const id = await seed(host, 'An older memory whose tags a retag replaces.', { importance: 0.4, metadata: { tags: ['keep-me-in-the-backup'] } })
    await host.command('mnemosyne-tags', 'retag')
    await host.command('mnemosyne-tags', 'apply')
    const folder = join(host.root, 'backups')
    const files = readdirSync(folder).filter(name => /^mnemopi-\d{8}T\d{9}Z\.db$/.test(name))
    expect(files).toHaveLength(1)
    const copy = new Database(join(folder, files[0]!), { readonly: true })
    try {
      const row = copy.query('SELECT metadata_json, memory_type FROM working_memory WHERE id = ?').get(id) as { metadata_json: string; memory_type: string }
      expect(JSON.parse(row.metadata_json).tags).toEqual(['keep-me-in-the-backup'])
      expect(row.memory_type).toBe('unknown')
    } finally {
      copy.close()
    }
    // and the live row has the new tags
    expect(JSON.parse(String(memories(host).find(row => row.id === id)!.metadata_json)).tags).toEqual(['code-review', 'git'])
  })

  test('VOCAB.4.a1: a row edited between the dry run and apply keeps the edit, and so does one whose text changed', async () => {
    const host = await open(() => ({ isAnswered: true, text: reply }))
    const edited = await seed(host, 'An older memory whose tags are edited meanwhile.', { metadata: { tags: ['before'] } })
    const rewritten = await seed(host, 'An older memory whose text is rewritten meanwhile.', { metadata: { tags: ['before'] } })
    const untouched = await seed(host, 'An older memory nobody touches meanwhile at all.', { metadata: { tags: ['before'] } })
    await host.command('mnemosyne-tags', 'retag')
    await engineCall(CLI, host.store, 'global', [
      toolCall(1, 'mnemopi_update', { memory_id: edited, metadata: { tags: ['rohit-chose-this'] } }),
      toolCall(2, 'mnemopi_update', { memory_id: rewritten, content: 'An older memory whose text was rewritten meanwhile.' }),
    ])
    const applied = await host.command('mnemosyne-tags', 'apply')
    expect(applied.text).toContain('Retagged 1 memory of 3 proposed.')
    expect(applied.text).toContain('2 changed since the dry run')
    const tagsOf = (id: string) => JSON.parse(String(memories(host).find(row => row.id === id)!.metadata_json)).tags
    expect(tagsOf(edited)).toEqual(['rohit-chose-this'])
    expect(tagsOf(rewritten)).toEqual(['before'])
    expect(tagsOf(untouched)).toEqual(['code-review', 'git'])
  })

  test('VOCAB.4.a2: a stub model that answers 429 twice is waited for and tried again; the retag still proposes', async () => {
    let calls = 0
    const host = await open(() => (calls++ < 2 ? { isAnswered: false, reason: 'api-error', status: 429, error: 'rate_limit' } : { isAnswered: true, text: reply }))
    await seed(host, 'An older memory the model is slow to answer for.', { metadata: { tags: ['old'] } })
    const dry = await host.command('mnemosyne-tags', 'retag')
    expect(calls).toBe(3)
    expect(dry.text).toContain('Proposed tags and kinds for 1 of 1 memory')
    expect(dry.text).not.toContain('failed')
  })
})
