// Claude Mnemosyne — a read-only look at the store, for the tag backfill (plan
// phase TAGS). A hook cannot read SQLite, so /mnemosyne-tags runs this file:
//   bun bin/memories.ts --store <dir> list --untagged   untagged memories, as JSON
//   bun bin/memories.ts --store <dir> list --all        every memory, as JSON (what a retag proposes for)
//   bun bin/memories.ts --store <dir> get <id>...       those memories, as JSON
//   bun bin/memories.ts save <root>/tags-proposed.json  the proposals on stdin, saved 0600
//   bun bin/memories.ts --store <dir> backup [<root>]    a VACUUM INTO copy of the store in <root>/backups (C9)
// and, for the session work (plan phase SESSION):
//   bun bin/memories.ts --store <dir> first-prompt <owner> [<pins>]   the newest session summary and the pinned memories, as JSON (read-only)
//   bun bin/memories.ts --store <dir> summarised <session id>...      which of those sessions already have a summary, as JSON (read-only)
//   bun bin/memories.ts session-pending write|list|claim|release|remove <root> ...  the markers session.end leaves (an id, an owner and a path; never text); claim takes one for a summary, release puts it back
//   bun bin/memories.ts sweep-claim <root>                           whether the daily unused-expiry sweep is due; if so, marks it taken
//   bun bin/memories.ts --store <dir> expire [--apply] [--days N] [--owner O] [--root R] [--limit N] [--json]
//                                                                     the unused-expiry sweep: a dry run unless --apply, which backs the store up first
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
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statfsSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { BACKFILL_TEXT_LIMIT, isProposalId } from '../hooks/backfill'
import { isKind } from '../hooks/kinds'
import { buildRequests, engineEnv, parseReplies } from '../hooks/engine'
import { BLOCK_PINNED_MAX, EXPIRE_DEFAULT_DAYS, expireRequest, expireSetting, parseExpireReply, parsePending, SESSION_CLAIM_STALE_MS, SESSION_CLAIM_SUFFIX, SESSION_ID, SESSION_PENDING_DIR, SWEEP_LIMIT, SWEEP_LOCK, SWEEP_LOCK_STALE_MS, SWEEP_MARKER, sweepDue, sweepMarkerText } from '../hooks/session'
import type { BlockRead, ExpiredRow, PendingSession } from '../hooks/session'
import { cleanTags, MAX_TAGS, normalizeTag } from '../hooks/tags'
import { readConfig } from './settings'

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

export type StoredRow = {
  id: string
  owner: string
  metadata: Record<string, unknown> | null
  content: string
  sha256: string
  taggable: boolean
  /** The row's memory_type ('unknown' when none was ever given), so a retag can fill a kind but never overwrite one. */
  kind: string | null
  /** sha256 of the row's tags as stored (JSON of the list; `[]` when none), so a retag can tell that the tags changed after its dry run. */
  tagsSha256: string
}

export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** The store's database, read-only; null while the engine has not made it. */
export function openReadOnly(store: string): Database | null {
  const file = join(store, 'mnemopi.db')
  if (!existsSync(file)) return null
  const db = new Database(file, { readonly: true })
  db.exec('PRAGMA query_only = ON')
  // A writer (the engine) may hold the file for a moment: wait for it rather than fail the read.
  db.exec('PRAGMA busy_timeout = 5000')
  return db
}

type Raw = { id: string; owner: string | null; content: string | null; metadata_json: string | null; memory_type: string | null }

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
  const stored = Array.isArray(metadata?.tags) ? (metadata.tags as unknown[]).filter((tag): tag is string => typeof tag === 'string') : []
  return {
    id: raw.id,
    owner: raw.owner ?? '',
    metadata,
    content: Array.from(content).slice(0, BACKFILL_TEXT_LIMIT).join(''),
    sha256: sha256(content),
    taggable,
    kind: raw.memory_type,
    tagsSha256: sha256(JSON.stringify(stored)),
  }
}

const COLUMNS = 'id, session_id AS owner, content, metadata_json, memory_type'

/** Every memory with no tags, in a steady order (owner, saved time, id). */
export function listUntagged(db: Database | null): StoredRow[] {
  if (db === null) return []
  const rows = db.query(`SELECT ${COLUMNS} FROM working_memory WHERE ${untaggedSql()} ORDER BY session_id, timestamp, id`).all() as Raw[]
  return rows.map(shape)
}

/** Every memory, tagged or not, in the same steady order: what a retag proposes for. */
export function listAll(db: Database | null): StoredRow[] {
  if (db === null) return []
  const rows = db.query(`SELECT ${COLUMNS} FROM working_memory ORDER BY session_id, timestamp, id`).all() as Raw[]
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
 * The proposals file's text, from stdin's JSON: only id, owner, tags (cleaned),
 * kind, the one proposed new tag and sha256 of each proposal are kept, so a
 * memory's text can never reach it.
 */
export function proposalsText(input: string, maxTags: number = MAX_TAGS): string {
  const value = JSON.parse(input)
  const list = value?.proposals
  if (!Array.isArray(list)) throw new Error('stdin must be {"proposals":[...]}')
  const proposals = list.map((item: Record<string, unknown>, i: number) => {
    const tags = Array.isArray(item?.tags) ? cleanTags(item.tags, { max: maxTags }) : []
    if (!isProposalId(item?.id) || typeof item.owner !== 'string' || typeof item.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(item.sha256) || tags.length === 0) {
      throw new Error(`proposal ${i} needs id, owner, sha256 and tags`)
    }
    // The kind (one of hooks/kinds.ts) and the one proposed new tag travel with the proposal; never any text.
    const kind = isKind(item.kind) ? item.kind : undefined
    const candidates = Array.isArray(item.candidates) ? [...new Set(item.candidates.map(normalizeTag).filter((tag): tag is string => tag !== undefined))].slice(0, 1) : []
    // A retag proposal also holds the hash of the tags the row had at the dry run (never the tags' text).
    const prior = typeof item.prior === 'string' && /^[0-9a-f]{64}$/.test(item.prior) ? item.prior : undefined
    return { id: item.id, owner: item.owner, tags, sha256: item.sha256, ...(kind === undefined ? {} : { kind }), ...(candidates.length === 0 ? {} : { candidates }), ...(prior === undefined ? {} : { prior }) }
  })
  return `${JSON.stringify({ version: 1, ...(value?.mode === 'retag' ? { mode: 'retag' } : {}), created: new Date().toISOString(), proposals }, null, 2)}\n`
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

// ---- C9: the store backup every apply command runs first ----

export const BACKUPS_DIR = 'backups'
export const BACKUP_KEEP = 10
const BACKUP_NAME = /^mnemopi-\d{8}T\d{9}Z\.db$/

/** `mnemopi-<UTC stamp>.db`, the stamp YYYYMMDDTHHMMSSmmmZ: names sort in time order. */
export function backupName(now: Date = new Date()) {
  return `mnemopi-${now.toISOString().replace(/[-:]/g, '').replace('.', '')}.db`
}

/** The bytes the store holds on disk: the database and its write-ahead log. */
function storeBytes(store: string) {
  let total = 0
  for (const name of ['mnemopi.db', 'mnemopi.db-wal']) {
    try {
      total += statSync(join(store, name)).size
    } catch {
      // no such file
    }
  }
  return total
}

export type BackupResult = { path: string; rows: number; pruned: number }
export type BackupOptions = {
  /** How many of the newest backups to keep; defaults to setting S5 in <root>/config.json (10 when there is none). */
  keep?: number
  /** Free bytes on the backups folder's disk; defaults to statfs. A spec injects a full disk. */
  freeBytes?: (dir: string) => number
  now?: Date
}

const freeBytesOf = (dir: string) => {
  const stats = statfsSync(dir)
  return Number(stats.bavail) * Number(stats.bsize)
}

/** Setting S5, backups to keep, from <root>/config.json: the default (BACKUP_KEEP) when there is no file or it is not usable. Never throws. */
function keepFor(root: string) {
  try {
    return readConfig(root).storage.backupsKeep
  } catch {
    return BACKUP_KEEP
  }
}

/**
 * Copies the store's database to <root>/backups/mnemopi-<UTC stamp>.db with VACUUM INTO, mode 0600,
 * then keeps the newest `keep` (setting S5, BACKUP_KEEP = 10 by default). Refuses, before copying, when the disk has less free space than
 * twice the store. Throws on any failure and leaves no partial file; the caller stops on a throw.
 */
export function backupStore(store: string, root: string, options: BackupOptions = {}): BackupResult {
  const source = join(store, 'mnemopi.db')
  if (!existsSync(source)) throw new Error(`there is no store database at ${source} to back up`)
  const folder = join(root, BACKUPS_DIR)
  // Only a folder made here is set to 0700; one that already exists is the user's and is left as it is.
  const made = !existsSync(folder)
  mkdirSync(folder, { recursive: true, mode: 0o700 })
  if (made && !IS_WINDOWS) chmodSync(folder, 0o700)
  const needed = 2 * storeBytes(store)
  const free = (options.freeBytes ?? freeBytesOf)(folder)
  if (free < needed) throw new Error(`not enough disk space for a backup: ${free} bytes free, ${needed} needed (twice the store)`)
  const file = join(folder, backupName(options.now))
  if (existsSync(file)) throw new Error(`${file} already exists`)
  let rows = 0
  // VACUUM INTO makes the file itself (it refuses an existing one), so a tight umask keeps it 0600 from the start.
  const umask = IS_WINDOWS ? 0 : process.umask(0o077)
  try {
    try {
      const db = new Database(source, { readonly: true })
      try {
        // A writer (the engine) may hold the file for a moment: wait for it rather than fail the backup.
        db.exec('PRAGMA busy_timeout = 10000')
        db.query('VACUUM INTO ?').run(file)
      } finally {
        db.close()
      }
    } finally {
      if (!IS_WINDOWS) process.umask(umask)
    }
    if (!IS_WINDOWS) chmodSync(file, 0o600)
    // Read the copy back: it must open, pass a quick check and hold the rows.
    const copy = new Database(file, { readonly: true })
    try {
      const check = copy.query('PRAGMA quick_check').get() as { quick_check: string } | null
      if (check?.quick_check !== 'ok') throw new Error('the backup failed its integrity check')
      rows = (copy.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n
    } finally {
      copy.close()
    }
  } catch (err) {
    rmSync(file, { force: true })
    throw err
  }
  const keep = options.keep ?? keepFor(root)
  const old = readdirSync(folder).filter(name => BACKUP_NAME.test(name)).sort().reverse().slice(keep)
  for (const name of old) rmSync(join(folder, name), { force: true })
  return { path: file, rows, pruned: old.length }
}

// ---- SESSION: the first-prompt read, the summary markers and the unused-expiry sweep ----

const columnsOf = (db: Database) => new Set((db.query('PRAGMA table_info(working_memory)').all() as { name: string }[]).map(column => column.name))

/**
 * SESSION.2: what the first prompt shows, read-only: the owner's newest live session summary (kind event, saved by the
 * summary run, so it carries metadata.session), then pinned memories (metadata.pinned) the owner can see, as recall can:
 * its own rows and every scope 'global' row. Live means not retired and not past its valid_until. At most `pins` pinned rows,
 * the most important first. No model, no network, no write.
 */
export function firstPromptRead(db: Database | null, owner: string, pins: number, now: string = new Date().toISOString()): BlockRead {
  const none: BlockRead = { summary: null, pinned: [] }
  if (db === null) return none
  const columns = columnsOf(db)
  if (!columns.has('memory_type') || !columns.has('metadata_json') || !columns.has('source')) return none
  const live = `${columns.has('superseded_by') ? 'superseded_by IS NULL AND ' : ''}${columns.has('valid_until') ? '(valid_until IS NULL OR valid_until > ?)' : '1 = 1'}`
  const liveArgs = columns.has('valid_until') ? [now] : []
  const summary =
    (db
      .query(
        `SELECT id, session_id AS owner, content FROM working_memory
         WHERE session_id = ? AND memory_type = 'event' AND source = 'import:session'
           AND json_valid(metadata_json) AND json_extract(metadata_json, '$.session') IS NOT NULL AND ${live}
         ORDER BY timestamp DESC, id DESC LIMIT 1`,
      )
      .get(owner, ...liveArgs) as { id: string; owner: string; content: string } | null) ?? null
  const limit = Math.min(BLOCK_PINNED_MAX, Math.max(0, Math.trunc(pins)))
  const pinned =
    limit === 0
      ? []
      : (db
          .query(
            `SELECT id, session_id AS owner, content FROM working_memory
             WHERE (session_id = ? OR scope = 'global')
               AND json_valid(metadata_json) AND json_extract(metadata_json, '$.pinned') IN (1, 'true') AND ${live}
             ORDER BY importance DESC, timestamp DESC, id DESC LIMIT ?`,
          )
          .all(owner, ...liveArgs, limit) as { id: string; owner: string; content: string }[])
  return { summary, pinned }
}

/** SESSION.1: which of these session ids already have a summary row (live or not: a retired or expired summary is not made again). */
export function summarisedIds(db: Database | null, ids: readonly string[]): string[] {
  if (db === null) return []
  const wanted = [...new Set(ids.filter(id => SESSION_ID.test(id)))]
  if (wanted.length === 0 || !columnsOf(db).has('memory_type')) return []
  const rows = db
    .query(`SELECT DISTINCT json_extract(metadata_json, '$.session') AS session FROM working_memory WHERE memory_type = 'event' AND json_valid(metadata_json) AND json_extract(metadata_json, '$.session') IN (${wanted.map(() => '?').join(',')})`)
    .all(...wanted) as { session: string }[]
  return rows.map(row => row.session)
}

const sessionPendingDir = (root: string) => join(root, SESSION_PENDING_DIR)

/** Writes one session marker: a new 0600 file renamed over the old one. */
export function writeSessionPending(root: string, entry: PendingSession) {
  const folder = sessionPendingDir(root)
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true, mode: 0o700 })
    if (!IS_WINDOWS) chmodSync(folder, 0o700)
  }
  const file = join(folder, `${entry.sessionId}.json`)
  const temp = `${file}.${process.pid}.tmp`
  rmSync(temp, { force: true })
  writeFileSync(temp, `${JSON.stringify({ sessionId: entry.sessionId, owner: entry.owner, transcript: entry.transcript })}\n`, { mode: 0o600, flag: 'wx' })
  if (!IS_WINDOWS) chmodSync(temp, 0o600)
  renameSync(temp, file)
}

const claimFileOf = (root: string, sessionId: string) => join(sessionPendingDir(root), `${sessionId}${SESSION_CLAIM_SUFFIX}`)

/** The marker and any claim on it are gone: the summary is saved, or the session needs none. */
export function removeSessionPending(root: string, sessionId: string) {
  if (!SESSION_ID.test(sessionId)) throw new Error('a session marker needs a plain session id')
  rmSync(join(sessionPendingDir(root), `${sessionId}.json`), { force: true })
  rmSync(claimFileOf(root, sessionId), { force: true })
}

/**
 * SESSION.1: takes the marker for the one session that will summarise it, by renaming <id>.json to <id>.claim. Two sessions
 * starting together both list the marker, but only one rename of the same file succeeds, so true goes to one caller and false
 * to the rest (and to a marker that is already gone). The marker is stamped with the time first, so a claim looks fresh to
 * listSessionPending from the moment it exists.
 */
export function claimSessionPending(root: string, sessionId: string, now: number = Date.now()): boolean {
  if (!SESSION_ID.test(sessionId)) throw new Error('a session marker needs a plain session id')
  const marker = join(sessionPendingDir(root), `${sessionId}.json`)
  try {
    utimesSync(marker, now / 1000, now / 1000)
    renameSync(marker, claimFileOf(root, sessionId))
    return true
  } catch {
    return false
  }
}

/** Puts a claimed marker back for the next first prompt (a lost call, a failed save). Nothing claimed is nothing to do. */
export function releaseSessionPending(root: string, sessionId: string) {
  if (!SESSION_ID.test(sessionId)) throw new Error('a session marker needs a plain session id')
  try {
    renameSync(claimFileOf(root, sessionId), join(sessionPendingDir(root), `${sessionId}.json`))
  } catch {
    // no claim: nothing to put back
  }
}

/** Every session marker, newest file first (the latest sessions are summarised first); a torn or foreign file is skipped. */
export function listSessionPending(root: string, now: number = Date.now()): PendingSession[] {
  const folder = sessionPendingDir(root)
  if (!existsSync(folder)) return []
  // A claim left by a session that died is put back as a marker, so its summary is not lost.
  for (const name of readdirSync(folder)) {
    if (!name.endsWith(SESSION_CLAIM_SUFFIX)) continue
    const id = name.slice(0, -SESSION_CLAIM_SUFFIX.length)
    try {
      if (SESSION_ID.test(id) && now - statSync(join(folder, name)).mtimeMs >= SESSION_CLAIM_STALE_MS) renameSync(join(folder, name), join(folder, `${id}.json`))
    } catch {
      // gone or taken in the meantime
    }
  }
  const files = readdirSync(folder)
    .filter(name => name.endsWith('.json'))
    .map(name => ({ name, mtime: statSync(join(folder, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime || (a.name < b.name ? -1 : 1))
  const out: PendingSession[] = []
  for (const { name } of files) {
    try {
      const entry = parsePending(readFileSync(join(folder, name), 'utf8'))
      if (entry !== undefined && `${entry.sessionId}.json` === name) out.push(entry)
    } catch {
      // unreadable: not an entry
    }
  }
  return out
}

/** Makes the lock with an exclusive create, so one caller gets it; a lock left by a claimant that died is taken over. */
function takeSweepLock(lock: string): boolean {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      closeSync(openSync(lock, 'wx', 0o600))
      return true
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }
    let age: number
    try {
      age = Date.now() - statSync(lock).mtimeMs
    } catch {
      continue // it went in the meantime: try the create again
    }
    if (age < SWEEP_LOCK_STALE_MS) return false // a live claimant is checking the marker right now
    // Stale: moved aside by a rename (one caller's rename wins), and only a lock that is still old is thrown away.
    const aside = `${lock}.${process.pid}.stale`
    try {
      renameSync(lock, aside)
    } catch {
      continue
    }
    const fresh = Date.now() - statSync(aside).mtimeMs < SWEEP_LOCK_STALE_MS
    rmSync(aside, { force: true })
    if (fresh) return false // that was a live claimant's new lock
  }
  return false
}

/**
 * SESSION.4: true (and the 24-hour marker written, 0600) when the sweep is due; false while the last one is under 24 hours old.
 * Two sessions starting together must not both sweep, so the marker is checked and written under a lock made with an exclusive
 * create: one caller gets it, reads the marker again (another claimant may have written it since the first look) and writes it.
 * Every other caller finds the lock taken, or the marker fresh, and gets false.
 */
export function claimSweep(root: string, now: number = Date.now()): boolean {
  const file = join(root, SWEEP_MARKER)
  const read = () => {
    try {
      return readFileSync(file, 'utf8')
    } catch {
      return undefined
    }
  }
  if (!sweepDue(read(), now)) return false
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const lock = join(root, SWEEP_LOCK)
  if (!takeSweepLock(lock)) return false
  try {
    if (!sweepDue(read(), now)) return false
    const temp = `${file}.${process.pid}.tmp`
    rmSync(temp, { force: true })
    writeFileSync(temp, sweepMarkerText(now), { mode: 0o600, flag: 'wx' })
    if (!IS_WINDOWS) chmodSync(temp, 0o600)
    renameSync(temp, file)
    return true
  } finally {
    rmSync(lock, { force: true })
  }
}

const ENGINE_TIMEOUT_MS = 120_000

/** One engine process answering the requests in turn (the same call the hooks make): each reply's text, or an Error. */
async function engineRun(cli: string, store: string, owner: string, requests: readonly (readonly [string, Record<string, unknown>])[]): Promise<(string | Error)[]> {
  const child = Bun.spawn([process.execPath, cli, 'mcp'], {
    env: { ...(process.env as Record<string, string>), ...engineEnv(store, owner) },
    stdin: new Blob([buildRequests(requests)]),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const timer = setTimeout(() => child.kill(), ENGINE_TIMEOUT_MS)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    return parseReplies(requests.length, stdout, exitCode, stderr)
  } finally {
    clearTimeout(timer)
  }
}

export type ExpireOptions = { store: string; root: string; owner: string; days: number; apply: boolean; limit?: number }
export type ExpireReport = { dryRun: boolean; days: number; owner: string; count: number; rows: ExpiredRow[]; limit: number; backup?: { path: string; rows: number } }

export const engineCliOf = (root: string) => join(root, 'engine', 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'src', 'cli.ts')

/**
 * SESSION.4: the unused-expiry sweep for one owner. It only ever expires (sets valid_until; the engine deletes nothing, and
 * update with restore brings a row back) the kinds in EXPIRE_KINDS, never a pinned row, never one that has an expiry already.
 * A dry run lists the candidates and changes nothing. With `apply`, a dry run comes first and, only when it found something,
 * the store is backed up (C9) and the sweep runs for real; a failed backup stops it before any change.
 */
export async function expireUnused(options: ExpireOptions): Promise<ExpireReport> {
  const days = expireSetting(options.days)
  if (days.mode !== 'on') throw new Error(days.mode === 'refused' ? days.reason : 'a sweep needs a number of days (30 or more); 0 means off')
  const limit = Math.min(200, Math.max(1, Math.trunc(options.limit ?? SWEEP_LIMIT)))
  const report: ExpireReport = { dryRun: !options.apply, days: days.days, owner: options.owner, count: 0, rows: [], limit }
  if (!existsSync(join(options.store, 'mnemopi.db'))) return report
  const cli = engineCliOf(options.root)
  if (!existsSync(cli)) throw new Error(`the engine is not installed at ${cli}: run /mnemosyne-setup`)
  const ask = async (apply: boolean) => {
    const [answer] = await engineRun(cli, options.store, options.owner, [['mnemopi_expire_unused', expireRequest(days.days, apply, limit)]])
    if (answer instanceof Error) throw new Error(`the engine refused the sweep: ${answer.message.slice(0, 200)}`)
    const parsed = parseExpireReply(answer ?? '')
    if (parsed === undefined) throw new Error('the engine gave no usable answer to the sweep')
    return parsed
  }
  const dry = await ask(false)
  if (!options.apply || dry.count === 0) return { ...report, count: dry.count, rows: dry.rows }
  let backup: BackupResult
  try {
    backup = backupStore(options.store, options.root)
  } catch (err) {
    throw new Error(`the backup before the sweep failed (${(err as Error).message.slice(0, 200)}); nothing was expired`)
  }
  const done = await ask(true)
  return { ...report, dryRun: false, count: done.count, rows: done.rows, backup: { path: backup.path, rows: backup.rows } }
}

const oneLinePreview = (text: string) => Array.from(text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').trim()).slice(0, 80).join('')

/** The sweep's report as a person reads it. A memory's first 80 characters are shown on purpose (Rohit previews with this). */
export function expireText(report: ExpireReport, store: string, root: string): string {
  const plural = (n: number) => `${n} ${n === 1 ? 'memory' : 'memories'}`
  const lines = report.rows.map(row => `  ${row.id}  ${row.kind.padEnd(9)} last used ${row.last_used.slice(0, 10)}  ${oneLinePreview(row.preview)}`)
  if (report.dryRun) {
    const apply = `bun bin/memories.ts --store ${store} expire --apply --days ${report.days} --owner ${report.owner} --root ${root}`
    return [
      'Dry run: nothing was changed.',
      report.count === 0
        ? `No memory of owner ${report.owner} (kinds context, event, error, artifact) has gone ${report.days} days without being recalled.`
        : `${plural(report.count)} of owner ${report.owner} (kinds context, event, error, artifact; not pinned) have gone ${report.days} days without being recalled and would expire${report.count >= report.limit ? ` (the ${report.limit} unused longest; more may follow on a later run)` : ''}. Expiring only sets an end date: nothing is deleted, and each one can be restored from the dashboard's Review tab.`,
      ...lines,
      ...(report.count === 0 ? [] : [`To run it for real (the store is backed up first, and the sweep stops if that fails): ${apply}`]),
    ].join('\n')
  }
  return [
    report.count === 0 ? `Nothing to expire for owner ${report.owner}.` : `Expired ${plural(report.count)} of owner ${report.owner}: each has an end date now, none was deleted, and each can be restored from the dashboard's Review tab.`,
    ...lines,
    ...(report.backup === undefined ? [] : [`The store was backed up first: ${report.backup.path} (${report.backup.rows} rows).`]),
  ].join('\n')
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
  if (command === 'backup') {
    if (!store) throw new Error('--store <dir> required')
    if (rest.length > 1 || rest[0]?.startsWith('-')) throw new Error('usage: --store <dir> backup [<root>]')
    // The data root is the store's parent unless the caller names it (a custom memoryDir lives elsewhere).
    process.stdout.write(`${JSON.stringify(backupStore(store, rest[0] ?? dirname(resolve(store))))}\n`)
    return
  }
  if (command === 'list') {
    if (rest.length === 1 && rest[0] === '--untagged') {
      if (!store) throw new Error('--store <dir> is required')
      process.stdout.write(`${JSON.stringify(listUntagged(openReadOnly(store)))}\n`)
    } else if (rest.length === 1 && rest[0] === '--all') {
      if (!store) throw new Error('--store <dir> is required')
      process.stdout.write(`${JSON.stringify(listAll(openReadOnly(store)))}\n`)
    } else if (rest.length === 1 && rest[0] === '--no-knowledge') {
      if (!store) throw new Error('--store <dir> is required')
      process.stdout.write(`${JSON.stringify(listNoKnowledge(openReadOnly(store)))}\n`)
    } else {
      throw new Error('usage: --store <dir> list --untagged | --store <dir> list --all | --store <dir> list --no-knowledge')
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
  } else if (command === 'first-prompt') {
    if (!store) throw new Error('--store <dir> is required')
    const owner = rest[0] ?? ''
    if (!SESSION_ID.test(owner) || rest.length > 2) throw new Error('usage: --store <dir> first-prompt <owner> [<pins>]')
    const pins = rest[1] === undefined ? BLOCK_PINNED_MAX : Number(rest[1])
    if (!Number.isInteger(pins) || pins < 0) throw new Error('<pins> must be a whole number')
    const db = openReadOnly(store)
    try {
      process.stdout.write(`${JSON.stringify(firstPromptRead(db, owner, pins))}\n`)
    } finally {
      db?.close()
    }
  } else if (command === 'summarised') {
    if (!store) throw new Error('--store <dir> is required')
    const bad = rest.find(id => !SESSION_ID.test(id))
    if (bad !== undefined) throw new Error('a session id has only letters, digits, hyphens and underscores')
    const db = openReadOnly(store)
    try {
      process.stdout.write(`${JSON.stringify({ done: summarisedIds(db, rest) })}\n`)
    } finally {
      db?.close()
    }
  } else if (command === 'session-pending') {
    if (store) throw new Error('session-pending does not take --store')
    const [action, root = '', ...more] = rest
    if (!root || root.startsWith('-')) throw new Error('usage: session-pending write|list|claim|release|remove <root> ...')
    if (action === 'write') {
      const entry = parsePending(await Bun.stdin.text())
      if (entry === undefined || more.length > 0) throw new Error('session-pending write needs { sessionId, owner, transcript } on stdin')
      writeSessionPending(root, entry)
    } else if (action === 'list') {
      process.stdout.write(`${JSON.stringify(listSessionPending(root))}\n`)
    } else if (action === 'remove') {
      if (more.length !== 1) throw new Error('usage: session-pending remove <root> <session id>')
      removeSessionPending(root, more[0]!)
    } else if (action === 'claim') {
      if (more.length !== 1) throw new Error('usage: session-pending claim <root> <session id>')
      process.stdout.write(`${JSON.stringify({ claimed: claimSessionPending(root, more[0]!) })}\n`)
    } else if (action === 'release') {
      if (more.length !== 1) throw new Error('usage: session-pending release <root> <session id>')
      releaseSessionPending(root, more[0]!)
    } else {
      throw new Error('usage: session-pending write|list|claim|release|remove <root> ...')
    }
  } else if (command === 'sweep-claim') {
    if (store || rest.length !== 1 || !rest[0] || rest[0].startsWith('-')) throw new Error('usage: sweep-claim <root>')
    process.stdout.write(`${JSON.stringify({ due: claimSweep(rest[0]) })}\n`)
  } else if (command === 'expire') {
    if (!store) throw new Error('--store <dir> is required')
    const given: { apply: boolean; json: boolean; days: number; owner: string; root: string; limit?: number } = { apply: false, json: false, days: EXPIRE_DEFAULT_DAYS, owner: 'global', root: dirname(resolve(store)) }
    for (let i = 0; i < rest.length; i++) {
      const word = rest[i]!
      if (word === '--apply') given.apply = true
      else if (word === '--json') given.json = true
      else if (word === '--days' || word === '--owner' || word === '--root' || word === '--limit') {
        const value = rest[++i]
        if (value === undefined || value.startsWith('-')) throw new Error(`${word} needs a value`)
        if (word === '--days') given.days = Number(value)
        else if (word === '--limit') given.limit = Number(value)
        else if (word === '--owner') {
          if (!SESSION_ID.test(value)) throw new Error('--owner needs a plain owner id')
          given.owner = value
        } else given.root = value
      } else throw new Error(`unknown option ${word}`)
    }
    if (given.limit !== undefined && (!Number.isInteger(given.limit) || given.limit < 1 || given.limit > 200)) throw new Error('--limit is a whole number from 1 to 200')
    const report = await expireUnused({ store, root: given.root, owner: given.owner, days: given.days, apply: given.apply, ...(given.limit === undefined ? {} : { limit: given.limit }) })
    // --json is for programs (the hook's sweep): ids, kinds and dates only, so no memory text can reach a log through it.
    process.stdout.write(given.json ? `${JSON.stringify({ ...report, rows: report.rows.map(({ preview: _preview, ...row }) => row) })}\n` : `${expireText(report, store, given.root)}\n`)
  } else if (command === 'save') {
    if (store || rest.length !== 1 || !rest[0] || rest[0].startsWith('-')) throw new Error('usage: save <file>  (the proposals JSON on stdin)')
    // The most tags a proposal keeps is setting T1, from the config.json beside the proposals file (the data root).
    saveProposals(rest[0], proposalsText(await Bun.stdin.text(), readConfig(dirname(resolve(rest[0]))).tags.maxPerMemory))
  } else {
    throw new Error('usage: memories.ts --store <dir> list --untagged|--no-knowledge | --store <dir> get <id>... | pending write|remove|list <root> ... | save <file> | first-prompt | summarised | session-pending | sweep-claim | expire')
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
