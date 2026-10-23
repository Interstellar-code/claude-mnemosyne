// Claude Mnemosyne — a read-only look at the store, for the tag backfill (plan
// phase TAGS). A hook cannot read SQLite, so /mnemosyne-tags runs this file:
//   bun bin/memories.ts --store <dir> list --untagged   untagged memories, as JSON
//   bun bin/memories.ts --store <dir> get <id>...       those memories, as JSON
//   bun bin/memories.ts save <root>/tags-proposed.json  the proposals on stdin, saved 0600
//
// --store comes first and once; `--` and an id starting with `-` are refused, so
// a memory id can never be read as an option. list and get print a JSON array of
// { id, owner, metadata, content, sha256, taggable } from a read-only handle:
// sha256 is of the whole stored content, content is cut to BACKFILL_TEXT_LIMIT
// code points (the model is shown no more, and stdout stays small), taggable is
// false when metadata_json is not a JSON object. Nothing here changes the
// store. save writes only id, owner, tags and sha256 of each proposal, never a
// memory's text, to a file named tags-proposed.json. "Untagged" means no
// non-empty text in metadata.tags: NULL, `{}`, broken JSON and `tags: []` all
// count (the dashboard's untagged filter uses the same SQL).
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { BACKFILL_TEXT_LIMIT, isProposalId } from '../hooks/backfill'
import { cleanTags } from '../hooks/tags'

const IS_WINDOWS = process.platform === 'win32'
export const PROPOSALS_NAME = 'tags-proposed.json'

/**
 * SQL for a row's tags as a JSON array text: `[]` unless metadata_json is valid
 * JSON holding an array at $.tags. Nested CASEs, because SQLite does not promise
 * the order AND evaluates in, and json_type on broken JSON throws.
 */
export function tagsSql(column = 'metadata_json') {
  return `(CASE WHEN json_valid(${column}) THEN (CASE WHEN json_type(${column}, '$.tags') = 'array' THEN json_extract(${column}, '$.tags') ELSE '[]' END) ELSE '[]' END)`
}

/** SQL true when a row carries a tag in metadata.tags whose lower case equals the one `?` parameter (lower-case it first, in JS). */
export const hasTagSql = (column = 'metadata_json') =>
  `EXISTS (SELECT 1 FROM json_each(${tagsSql(column)}) WHERE json_each.type = 'text' AND lower(json_each.value) = ?)`

/** SQL true when a row has no non-empty text tag. */
export const untaggedSql = (column = 'metadata_json') =>
  `NOT EXISTS (SELECT 1 FROM json_each(${tagsSql(column)}) WHERE json_each.type = 'text' AND json_each.value <> '')`

export type StoredRow = { id: string; owner: string; metadata: Record<string, unknown> | null; content: string; sha256: string; taggable: boolean }

export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** The store's database, read-only; null while the engine has not made it. */
export function openReadOnly(store: string): Database | null {
  const file = join(store, 'mnemopi.db')
  if (!existsSync(file)) return null
  const db = new Database(file, { readonly: true })
  db.exec('PRAGMA query_only = ON')
  return db
}

type Raw = { id: string; owner: string | null; content: string | null; metadata_json: string | null }

function shape(raw: Raw): StoredRow {
  let metadata: Record<string, unknown> | null = null
  let taggable = true
  if (typeof raw.metadata_json === 'string' && raw.metadata_json !== '') {
    try {
      const value = JSON.parse(raw.metadata_json)
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) metadata = value
      else taggable = false
    } catch {
      taggable = false
    }
  }
  const content = raw.content ?? ''
  return { id: raw.id, owner: raw.owner ?? '', metadata, content: Array.from(content).slice(0, BACKFILL_TEXT_LIMIT).join(''), sha256: sha256(content), taggable }
}

const COLUMNS = 'id, session_id AS owner, content, metadata_json'

/** Every memory with no tags, in a steady order (owner, saved time, id). */
export function listUntagged(db: Database | null): StoredRow[] {
  if (db === null) return []
  const rows = db.query(`SELECT ${COLUMNS} FROM working_memory WHERE ${untaggedSql()} ORDER BY session_id, timestamp, id`).all() as Raw[]
  return rows.map(shape)
}

/** The rows with these ids that exist; ids of the wrong shape are skipped. */
export function getRows(db: Database | null, ids: readonly string[]): StoredRow[] {
  if (db === null) return []
  const wanted = [...new Set(ids.filter(isProposalId))]
  const out: StoredRow[] = []
  for (let at = 0; at < wanted.length; at += 500) {
    const part = wanted.slice(at, at + 500)
    const rows = db.query(`SELECT ${COLUMNS} FROM working_memory WHERE id IN (${part.map(() => '?').join(',')}) ORDER BY id`).all(...part) as Raw[]
    out.push(...rows.map(shape))
  }
  return out
}

/**
 * The proposals file's text, from stdin's JSON: only id, owner, tags (cleaned)
 * and sha256 of each proposal are kept, so a memory's text can never reach it.
 */
export function proposalsText(input: string): string {
  const value = JSON.parse(input)
  const list = value?.proposals
  if (!Array.isArray(list)) throw new Error('stdin must be {"proposals":[...]}')
  const proposals = list.map((item: Record<string, unknown>, i: number) => {
    const tags = Array.isArray(item?.tags) ? cleanTags(item.tags) : []
    if (!isProposalId(item?.id) || typeof item.owner !== 'string' || typeof item.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(item.sha256) || tags.length === 0) {
      throw new Error(`proposal ${i} needs id, owner, sha256 and tags`)
    }
    return { id: item.id, owner: item.owner, tags, sha256: item.sha256 }
  })
  return `${JSON.stringify({ version: 1, created: new Date().toISOString(), proposals }, null, 2)}\n`
}

/** Saves `text` at `file` (named tags-proposed.json): a new 0600 file renamed over the old one. */
export function saveProposals(file: string, text: string) {
  if (basename(file) !== PROPOSALS_NAME) throw new Error(`only a file named ${PROPOSALS_NAME} is written`)
  const folder = dirname(file)
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true, mode: 0o700 })
    if (!IS_WINDOWS) chmodSync(folder, 0o700)
  }
  const temp = `${file}.${process.pid}.tmp`
  rmSync(temp, { force: true })
  writeFileSync(temp, text, { mode: 0o600, flag: 'wx' })
  if (!IS_WINDOWS) chmodSync(temp, 0o600)
  renameSync(temp, file)
}

// ---- Knowledge pending entries (KNOWX.2.a4) -----------------------------------
//
// A background extraction that is cut (Esc, a session end) leaves one small file
// per memory: <root>/knowledge-pending/<memory id>.json, mode 0600, holding
// { id, owner, sha256 }. /mnemosyne-knowledge finishes them.

export const PENDING_DIR = 'knowledge-pending'

const pendingDir = (root: string) => join(root, PENDING_DIR)

// A memory id names the file, so it must be a plain hex id (engine ids are 16 hex
// chars); anything else is refused rather than joined into a path.
export const isMemoryFileId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{1,64}$/.test(id)

export type PendingEntry = { id: string; owner: string; sha256: string }

/** Writes one pending entry: a new 0600 file renamed over the old one. */
export function writePending(root: string, entry: PendingEntry) {
  if (!isMemoryFileId(entry.id)) throw new Error('a pending entry needs a hex memory id')
  if (!/^[0-9a-f]{64}$/.test(entry.sha256)) throw new Error('a pending entry needs a sha256')
  const folder = pendingDir(root)
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true, mode: 0o700 })
    if (!IS_WINDOWS) chmodSync(folder, 0o700)
  }
  const file = join(folder, `${entry.id}.json`)
  const temp = `${file}.${process.pid}.tmp`
  rmSync(temp, { force: true })
  writeFileSync(temp, `${JSON.stringify({ id: entry.id, owner: entry.owner, sha256: entry.sha256 })}\n`, { mode: 0o600, flag: 'wx' })
  if (!IS_WINDOWS) chmodSync(temp, 0o600)
  renameSync(temp, file)
}

/**
 * Removes one pending entry. With a sha256, only while the file still holds it:
 * a newer update's entry (an extraction for fresher text) stays.
 */
export function removePending(root: string, id: string, sha256?: string) {
  if (!isMemoryFileId(id)) throw new Error('a pending entry needs a hex memory id')
  const file = join(pendingDir(root), `${id}.json`)
  if (sha256 !== undefined) {
    try {
      const held = JSON.parse(readFileSync(file, 'utf8')) as Partial<PendingEntry>
      if (held.sha256 !== sha256) return false
    } catch {
      return false
    }
  }
  const gone = existsSync(file)
  rmSync(file, { force: true })
  return gone
}

/** Every pending entry, oldest file first; a broken file is skipped. */
export function listPending(root: string): PendingEntry[] {
  const folder = pendingDir(root)
  if (!existsSync(folder)) return []
  const out: PendingEntry[] = []
  for (const name of readdirSync(folder).sort()) {
    if (!name.endsWith('.json')) continue
    const id = name.slice(0, -'.json'.length)
    if (!isMemoryFileId(id)) continue
    try {
      const value = JSON.parse(readFileSync(join(folder, name), 'utf8')) as Partial<PendingEntry>
      if (value.id === id && typeof value.owner === 'string' && typeof value.sha256 === 'string') {
        out.push({ id, owner: value.owner, sha256: value.sha256 })
      }
    } catch {
      // a torn file: not an entry
    }
  }
  return out
}

// The five memoria tables, and the SQL true when a memory has no row in any (KNOWX.3.a2).
const KNOWLEDGE_TABLES = ['memoria_facts', 'memoria_preferences', 'memoria_instructions', 'memoria_timelines', 'memoria_kg'] as const

/**
 * Every memory with no knowledge row in any memoria table, in a steady order.
 * A table that does not exist yet simply contributes nothing.
 */
export function listNoKnowledge(db: Database | null): StoredRow[] {
  if (db === null) return []
  const present = new Set((db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(row => row.name))
  const tables = KNOWLEDGE_TABLES.filter(table => present.has(table))
  const absent = tables.length === 0
    ? ''
    : tables.map(table => `NOT EXISTS (SELECT 1 FROM ${table} WHERE ${table}.source_memory_id = working_memory.id)`).map(clause => `AND ${clause}`).join(' ')
  const rows = db.query(`SELECT ${COLUMNS} FROM working_memory WHERE 1 = 1 ${absent} ORDER BY session_id, timestamp, id`).all() as Raw[]
  return rows.map(shape)
}

async function main(argv: readonly string[]) {
  const args = [...argv]
  let store = ''
  if (args[0] === '--store') {
    store = args[1] ?? ''
    if (!store || store.startsWith('-')) throw new Error('--store needs a folder')
    args.splice(0, 2)
  }
  // One --store, before the command: a later one (or a `--`) would let an argument redirect the read.
  if (args.includes('--store')) throw new Error('--store may be given once, before the command')
  if (args.includes('--')) throw new Error('`--` is not accepted')
  const [command, ...rest] = args
  if (command === 'list') {
    if (rest.length === 1 && rest[0] === '--untagged') {
      if (!store) throw new Error('--store <dir> is required')
      process.stdout.write(`${JSON.stringify(listUntagged(openReadOnly(store)))}\n`)
    } else if (rest.length === 1 && rest[0] === '--no-knowledge') {
      if (!store) throw new Error('--store <dir> is required')
      process.stdout.write(`${JSON.stringify(listNoKnowledge(openReadOnly(store)))}\n`)
    } else {
      throw new Error('usage: --store <dir> list --untagged | --store <dir> list --no-knowledge')
    }
  } else if (command === 'get') {
    if (!store) throw new Error('--store <dir> is required')
    const bad = rest.find(id => id.startsWith('-'))
    if (bad !== undefined) throw new Error(`an id may not start with -: ${bad}`)
    process.stdout.write(`${JSON.stringify(getRows(openReadOnly(store), rest))}\n`)
  } else if (command === 'pending') {
    // <root> names the plugin's data root; the store flag does not apply here.
    const [action, ...pending] = rest
    if (store) throw new Error('pending does not take --store')
    const root = pending.shift() ?? ''
    if (!root || root.startsWith('-')) throw new Error('usage: pending write|remove|list <root> [...]')
    if (action === 'write') {
      // One entry, or a list of them (the backfill writes an owner's entries in one process).
      const parsed = JSON.parse(await Bun.stdin.text()) as unknown
      const list = (Array.isArray(parsed) ? parsed : [parsed]) as Partial<PendingEntry>[]
      for (const entry of list) {
        if (typeof entry?.id !== 'string' || typeof entry.owner !== 'string' || typeof entry.sha256 !== 'string') throw new Error('pending write needs { id, owner, sha256 } (or a list of them) on stdin')
        // All or nothing: every entry is checked before the first file is written.
        if (!isMemoryFileId(entry.id)) throw new Error('a pending entry needs a hex memory id')
        if (!/^[0-9a-f]{64}$/.test(entry.sha256)) throw new Error('a pending entry needs a sha256')
      }
      for (const entry of list) writePending(root, { id: entry.id!, owner: entry.owner!, sha256: entry.sha256! })
    } else if (action === 'remove') {
      const id = pending[0] ?? ''
      const sha = pending[1]
      removePending(root, id, sha)
    } else if (action === 'remove-many') {
      // [{ id, sha256? }] on stdin: each removed as `remove` would.
      const parsed = JSON.parse(await Bun.stdin.text()) as unknown
      if (!Array.isArray(parsed)) throw new Error('pending remove-many needs a list of { id, sha256? } on stdin')
      for (const entry of parsed as { id?: unknown; sha256?: unknown }[]) {
        if (typeof entry?.id !== 'string' || (entry.sha256 !== undefined && typeof entry.sha256 !== 'string')) throw new Error('pending remove-many needs a list of { id, sha256? } on stdin')
        // All or nothing: one bad id refuses the whole list before any file is removed.
        if (!isMemoryFileId(entry.id)) throw new Error('a pending entry needs a hex memory id')
      }
      for (const entry of parsed as { id: string; sha256?: string }[]) removePending(root, entry.id, entry.sha256)
    } else if (action === 'list') {
      process.stdout.write(`${JSON.stringify(listPending(root))}\n`)
    } else {
      throw new Error('usage: pending write <root> (JSON on stdin) | pending remove <root> <id> [sha256] | pending remove-many <root> (JSON on stdin) | pending list <root>')
    }
  } else if (command === 'save') {
    if (store || rest.length !== 1 || !rest[0] || rest[0].startsWith('-')) throw new Error('usage: save <file>  (the proposals JSON on stdin)')
    saveProposals(rest[0], proposalsText(await Bun.stdin.text()))
  } else {
    throw new Error('usage: memories.ts --store <dir> list --untagged|--no-knowledge | --store <dir> get <id>... | pending write|remove|list <root> ... | save <file>')
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    () => process.exit(0),
    err => {
      process.stderr.write(`mnemosyne memories: ${(err as Error).message}\n`)
      process.exit(1)
    },
  )
}
