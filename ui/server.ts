// The Mnemosyne dashboard server (DESIGN.md, "The dashboard server").
//
// Runs under Bun on 127.0.0.1, on a port the OS picks, behind a random token
// it makes itself. The page shell, its script and its style load without the
// token and hold no data; every /api route wants `Authorization: Bearer
// <token>`. Every reply carries a strict CSP and no CORS allow header. SQLite
// is opened read-only; every change goes through the engine (hooks/engine.ts).
//
// The map's route: GET /api/galaxy, every memory at once (the v1 drill-down
// GET /api/map was removed in OLDMAP). /vendor/ serves the map's library.
//
// The views' routes (plan phase VIEW): GET /api/memories (owner, sort, q),
// GET /api/memories/<id>, GET /api/activity, GET /api/activity/stream (NDJSON),
// POST /api/search (the engine's recall with update_recall_counts false, once
// per owner, merged by id) and POST /api/forget (the engine's forget, as the
// owner the database names). Both POSTs want the page's own Origin and a JSON
// body, and each one that reaches the engine leaves an activity line, origin ui.
//
// Two modes:
//   bun ui/server.ts --hold   what /mnemosyne-ui starts. The host's spawn closes
//                             a child's stdin from the start, so this holder
//                             starts the server below with stdin as a pipe it
//                             keeps open, and passes its output through.
//   bun ui/server.ts --ping <port> <pid>
//                             the hook's health check: reads the token on stdin,
//                             asks 127.0.0.1:<port>/api/health with no proxy and
//                             no redirect, exits 0 only when the reply names <pid>.
//   bun ui/server.ts          the server. It prints one ready line
//                             {"port","pid"} (never the token), writes
//                             <root>/ui.json {port, token, pid} with mode 0600,
//                             and exits when its stdin closes, when its parent
//                             is gone, or on a signal.
//
// Environment: MNEMOSYNE_ROOT (<root>, where ui.json lives), MNEMOSYNE_STORE,
// MNEMOSYNE_CLI, MNEMOSYNE_ACTIVITY_LOG (empty when the log is off),
// MNEMOSYNE_PLUGIN_ROOT; MNEMOSYNE_UI_PARENT_CHECK_MS (default 10000, held to
// 100 ms - 10 s) sets how often the parent is checked.
import { Database } from 'bun:sqlite'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { appendActivity } from '../bin/activity'
import { hasTagSql, untaggedSql } from '../bin/memories'
import { activityEntry, preview } from '../hooks/activity-log'
import type { ActivityFields } from '../hooks/activity-log'
import { buildRequests, engineEnv, parseReplies } from '../hooks/engine'
import type { EngineRequest } from '../hooks/engine'

const UI_DIR = import.meta.dir
const VENDOR_DIR = join(UI_DIR, 'vendor')
const IS_WINDOWS = process.platform === 'win32'

export const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

// On every reply, whatever its status.
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CSP,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
}

// What /vendor/ serves, by extension: the map's script only; anything else
// (its notices, inputs list, scan allowlist and types) is 404.
const VENDOR_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
}

export const DEFAULT_PARENT_CHECK_MS = 10_000
export const MIN_PARENT_CHECK_MS = 100
export const PING_FETCH_TIMEOUT_MS = 2_500
// A proxy would see the token: the ping never uses one, whatever the environment says.
export const PROXY_VARIABLES = ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy'] as const
export const ENGINE_TIMEOUT_MS = 20_000

// The views (plan phase VIEW).
// GET /api/memories: at most this many rows, each with this much of its text.
export const LIST_LIMIT = 1000
export const PREVIEW_CHARS = 240
// POST /api/search: the engine's top hits, as the first-prompt recall takes them;
// across owners, at most this many owners (the largest), once each.
export const SEARCH_LIMIT = 5
export const SEARCH_OWNERS = 10
export const MAX_QUERY_CHARS = 500
// A POST body past this is refused unread.
export const MAX_BODY_BYTES = 4096
// GET /api/activity: the last lines, newest first.
export const ACTIVITY_DEFAULT = 200
export const ACTIVITY_MAX = 1000
// GET /api/activity/stream: polled, a blank keep-alive line when quiet, closed
// after a while (the page reconnects), and only so many at once.
export const STREAM_POLL_MS = 500
export const STREAM_HEARTBEAT_MS = 5_000
export const STREAM_MAX_MS = 10 * 60_000
export const MAX_STREAMS = 8
// Engine processes alive at once, across every route; the rest wait their turn.
// One search runs at a time: an overlapping one gets 429.
export const MAX_ENGINES = 4

export type Config = {
  root: string
  store: string
  cli: string
  activityLog: string
  pluginRoot: string
}

export type State = { port: number; token: string; pid: number }

export function configFromEnv(env: Record<string, string | undefined>): Config {
  const root = env.MNEMOSYNE_ROOT ?? ''
  const store = env.MNEMOSYNE_STORE ?? ''
  if (!root || !store) throw new Error('MNEMOSYNE_ROOT and MNEMOSYNE_STORE must be set.')
  return {
    root,
    store,
    cli: env.MNEMOSYNE_CLI ?? '',
    activityLog: env.MNEMOSYNE_ACTIVITY_LOG ?? '',
    pluginRoot: env.MNEMOSYNE_PLUGIN_ROOT ?? join(UI_DIR, '..'),
  }
}

export const statePath = (root: string) => join(root, 'ui.json')

// ui.json, owner-only: written to a fresh 0600 file, then renamed over the old one.
export function writeState(root: string, state: State) {
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const temp = join(root, `ui.json.${state.pid}.tmp`)
  rmSync(temp, { force: true })
  writeFileSync(temp, `${JSON.stringify(state)}\n`, { mode: 0o600, flag: 'wx' })
  if (!IS_WINDOWS) chmodSync(temp, 0o600)
  renameSync(temp, statePath(root))
}

// Removes ui.json only while it still names this process: a newer server's stays.
export function removeState(root: string, pid: number) {
  try {
    const state = JSON.parse(readFileSync(statePath(root), 'utf8'))
    if (state?.pid === pid) rmSync(statePath(root), { force: true })
  } catch {
    // gone or unreadable: nothing of ours to remove
  }
}

// The store's database, read-only: the server never writes it. Null while the
// engine has not made it yet.
export function openStore(store: string): Database | null {
  const file = join(store, 'mnemopi.db')
  if (!existsSync(file)) return null
  const db = new Database(file, { readonly: true })
  db.exec('PRAGMA query_only = ON')
  return db
}

// One engine process for `requests`, as `owner`: the server's own environment
// with engineEnv laid over it, as the hooks send it.
export async function runEngine(
  config: Pick<Config, 'cli' | 'store'>,
  requests: readonly EngineRequest[],
  owner: string,
  baseEnv: Record<string, string | undefined> = process.env,
  timeoutMs = ENGINE_TIMEOUT_MS,
): Promise<(string | Error)[]> {
  const child = Bun.spawn([process.execPath, config.cli, 'mcp'], {
    env: { ...baseEnv, ...engineEnv(config.store, owner) },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const timer = setTimeout(() => child.kill(), timeoutMs)
  try {
    child.stdin.write(buildRequests(requests))
    await child.stdin.end()
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return parseReplies(requests.length, stdout, exitCode, stderr)
  } finally {
    clearTimeout(timer)
  }
}

// ui/app.ts, built into memory once at start and served as /app.js.
export async function buildApp() {
  // The map's library stays a separate file, loaded with import() when the Map tab first opens.
  const built = await Bun.build({ entrypoints: [join(UI_DIR, 'app.ts')], target: 'browser', format: 'esm', minify: true, external: ['/vendor/*'] })
  const output = built.outputs[0]
  if (!built.success || output === undefined) {
    throw new Error(`ui/app.ts did not build: ${built.logs.map(log => String(log)).join('\n')}`)
  }
  return output.text()
}

function reply(body: ConstructorParameters<typeof Response>[0], status: number, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers: { ...SECURITY_HEADERS, ...headers } })
}

const json = (value: unknown, status = 200) => reply(JSON.stringify(value), status, { 'Content-Type': 'application/json; charset=utf-8' })
const notFound = () => json({ error: 'not found' }, 404)
const notAllowed = (allow = 'GET') => reply(null, 405, { Allow: allow })

// Constant time; a missing or malformed header never matches.
function hasToken(request: Request, token: string) {
  const match = /^Bearer ([A-Za-z0-9_-]+)$/.exec(request.headers.get('authorization') ?? '')
  if (!match?.[1]) return false
  const given = Buffer.from(match[1])
  const wanted = Buffer.from(token)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

type Store = { db: Database | null }

// The installed engine's version, from the package.json beside its src/cli.ts.
export function engineVersion(cli: string): string | undefined {
  try {
    const version = JSON.parse(readFileSync(join(dirname(cli), '..', 'package.json'), 'utf8'))?.version
    return typeof version === 'string' ? version : undefined
  } catch {
    return undefined
  }
}

function health(config: Config, store: Store, engine: string | undefined) {
  store.db ??= openStore(config.store)
  const base = { ok: true, pid: process.pid, store: config.store, engine: engine ?? null, activity: config.activityLog !== '' }
  if (store.db === null) return { ...base, total: 0, owners: [], note: 'The store has no database yet.' }
  try {
    const owners = store.db
      .query('SELECT session_id AS owner, COUNT(*) AS count FROM working_memory GROUP BY session_id ORDER BY count DESC, owner')
      .all() as { owner: string; count: number }[]
    return { ...base, total: owners.reduce((sum, row) => sum + row.count, 0), owners }
  } catch (err) {
    return { ...base, total: 0, owners: [], note: `The store could not be read: ${(err as Error).message}` }
  }
}

/**
 * GET /api/health-report: token-guarded and read-only.
 * Returns memory counts, per-project split, global count, never-recalled (newest 50),
 * most recalled (top 10), recalls per day with coverage days from activity log,
 * file sizes, table row counts, and coverage numbers.
 */
export function healthReport(config: Config, store: Store, _engine: string | undefined): Answer {
  store.db ??= openStore(config.store)
  const db = store.db

  // Sizes in bytes
  let logSize = 0
  if (config.activityLog && existsSync(config.activityLog)) {
    try {
      logSize = statSync(config.activityLog).size
    } catch {
      logSize = 0
    }
  }

  let storeSize = 0
  const dbFile = join(config.store, 'mnemopi.db')
  if (existsSync(dbFile)) {
    try {
      storeSize = statSync(dbFile).size
    } catch {
      storeSize = 0
    }
  }

  // Recalls per day & days covered from activity.jsonl
  const logLines = config.activityLog
    ? [
        ...(existsSync(`${config.activityLog}.1`) ? objectLines(readText(`${config.activityLog}.1`)) : []),
        ...(existsSync(config.activityLog) ? objectLines(readText(config.activityLog)) : []),
      ]
    : []

  const recallsByDay: Record<string, number> = {}
  let minDay: string | null = null
  let maxDay: string | null = null
  for (const line of logLines) {
    if (typeof line.t === 'string') {
      const day = line.t.slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        if (minDay === null || day < minDay) minDay = day
        if (maxDay === null || day > maxDay) maxDay = day
        if (line.action === 'recall') {
          recallsByDay[day] = (recallsByDay[day] ?? 0) + 1
        }
      }
    }
  }

  let daysCovered = 0
  if (minDay !== null && maxDay !== null) {
    const tMin = new Date(`${minDay}T00:00:00.000Z`).getTime()
    const tMax = new Date(`${maxDay}T00:00:00.000Z`).getTime()
    daysCovered = Math.max(1, Math.round((tMax - tMin) / (24 * 60 * 60 * 1000)) + 1)
  }
  const recallsPerDay = Object.keys(recallsByDay)
    .sort()
    .map(date => ({ date, count: recallsByDay[date] }))

  if (db === null) {
    return {
      status: 200,
      body: {
        ok: true,
        total: 0,
        global: 0,
        projects: [],
        owners: [],
        neverRecalled: { count: 0, list: [] },
        neverRecalledCount: 0,
        neverRecalledList: [],
        mostRecalled: [],
        recallsPerDay,
        recallsByDay,
        daysCovered,
        sizes: { store: storeSize, log: logSize },
        storeSize,
        logSize,
        tables: {},
        coverage: {
          total: 0,
          tagged: 0,
          knowledge: 0,
          embeddings: 0,
          vectors: 0,
          provenance: 0,
          author_type: 0,
        },
      },
    }
  }

  const present = new Set(
    (db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map(row => row.name),
  )

  const tables: Record<string, number> = {}
  for (const name of present) {
    try {
      tables[name] = (db.query(`SELECT COUNT(*) AS n FROM ${name}`).get() as { n: number })?.n ?? 0
    } catch {
      tables[name] = 0
    }
  }

  let total = 0
  let global = 0
  let owners: { owner: string; label: string; count: number }[] = []
  let projects: { owner: string; label: string; count: number }[] = []
  let neverCount = 0
  let neverList: { id: string; owner: string; created: string | null; lastRecalled: string | null; label: string; tags: string[]; recalls: number }[] = []
  let mostRecalled: { id: string; owner: string; created: string | null; lastRecalled: string | null; label: string; tags: string[]; recalls: number }[] = []
  let tagged = 0
  let knowledge = 0
  let embeddings = 0
  let provenance = 0

  if (present.has('working_memory')) {
    const wmCols = tableColumns(db, 'working_memory')
    total = tables.working_memory ?? 0

    try {
      global = (db.query("SELECT COUNT(*) AS n FROM working_memory WHERE session_id = 'global'").get() as { n: number })?.n ?? 0
    } catch {
      global = 0
    }

    try {
      const rawOwners = db
        .query('SELECT session_id AS owner, COUNT(*) AS count FROM working_memory GROUP BY session_id ORDER BY count DESC, owner')
        .all() as { owner: string; count: number }[]
      owners = rawOwners.map(r => ({ owner: r.owner, label: projectLabel(r.owner), count: r.count }))
      projects = rawOwners
        .filter(r => r.owner !== 'global' && r.owner !== '')
        .map(r => ({ owner: r.owner, label: projectLabel(r.owner), count: r.count }))
    } catch {
      owners = []
      projects = []
    }

    try {
      neverCount = (db.query('SELECT COUNT(*) AS n FROM working_memory WHERE COALESCE(recall_count, 0) = 0').get() as { n: number })?.n ?? 0
      const neverRows = db
        .query(
          `SELECT id, session_id AS owner, timestamp AS created, last_recalled AS lastRecalled,
                  substr(content, 1, 4000) AS head, metadata_json, COALESCE(recall_count, 0) AS recalls
           FROM working_memory WHERE COALESCE(recall_count, 0) = 0 ORDER BY timestamp DESC, id LIMIT 50`,
        )
        .all() as { id: string; owner: string; created: string | null; lastRecalled: string | null; head: string | null; metadata_json: string | null; recalls: number }[]
      neverList = neverRows.map(r => ({
        id: r.id,
        owner: r.owner,
        created: r.created,
        lastRecalled: r.lastRecalled,
        label: galaxyLabel(r.head),
        tags: tagsOf(parseMetadata(r.metadata_json)),
        recalls: r.recalls,
      }))
    } catch {
      neverCount = 0
      neverList = []
    }

    try {
      const mostRows = db
        .query(
          `SELECT id, session_id AS owner, timestamp AS created, last_recalled AS lastRecalled,
                  substr(content, 1, 4000) AS head, metadata_json, COALESCE(recall_count, 0) AS recalls
           FROM working_memory WHERE COALESCE(recall_count, 0) > 0 ORDER BY COALESCE(recall_count, 0) DESC, last_recalled DESC, timestamp DESC, id LIMIT 10`,
        )
        .all() as { id: string; owner: string; created: string | null; lastRecalled: string | null; head: string | null; metadata_json: string | null; recalls: number }[]
      mostRecalled = mostRows.map(r => ({
        id: r.id,
        owner: r.owner,
        created: r.created,
        lastRecalled: r.lastRecalled,
        label: galaxyLabel(r.head),
        tags: tagsOf(parseMetadata(r.metadata_json)),
        recalls: r.recalls,
      }))
    } catch {
      mostRecalled = []
    }

    if (wmCols.has('metadata_json')) {
      try {
        tagged = (db.query(`SELECT COUNT(*) AS n FROM working_memory WHERE NOT (${untaggedSql()})`).get() as { n: number })?.n ?? 0
      } catch {
        tagged = 0
      }
    }

    const kSubqueries: string[] = []
    for (const source of KNOWLEDGE_TABLES) {
      if (present.has(source.table)) {
        const cols = tableColumns(db, source.table)
        if (cols.has('source_memory_id')) {
          kSubqueries.push(`SELECT source_memory_id FROM ${source.table} WHERE source_memory_id IS NOT NULL AND source_memory_id <> ''`)
        }
      }
    }
    if (kSubqueries.length > 0) {
      try {
        knowledge = (db.query(`SELECT COUNT(*) AS n FROM working_memory WHERE id IN (${kSubqueries.join(' UNION ')})`).get() as { n: number })?.n ?? 0
      } catch {
        knowledge = 0
      }
    }

    if (present.has('memory_embeddings')) {
      const cols = tableColumns(db, 'memory_embeddings')
      if (cols.has('memory_id')) {
        try {
          embeddings = (db.query('SELECT COUNT(*) AS n FROM working_memory WHERE id IN (SELECT memory_id FROM memory_embeddings)').get() as { n: number })?.n ?? 0
        } catch {
          embeddings = 0
        }
      }
    }

    if (wmCols.has('author_type')) {
      try {
        provenance = (db.query("SELECT COUNT(*) AS n FROM working_memory WHERE author_type IS NOT NULL AND author_type <> ''").get() as { n: number })?.n ?? 0
      } catch {
        provenance = 0
      }
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      total,
      global,
      projects,
      owners,
      neverRecalled: { count: neverCount, list: neverList },
      neverRecalledCount: neverCount,
      neverRecalledList: neverList,
      mostRecalled,
      recallsPerDay,
      recallsByDay,
      daysCovered,
      sizes: { store: storeSize, log: logSize },
      storeSize,
      logSize,
      tables,
      coverage: {
        total,
        tagged,
        knowledge,
        embeddings,
        vectors: embeddings,
        provenance,
        author_type: provenance,
      },
    },
  }
}

// ---- Memories (VIEW.1): read-only queries through the read-only handle ----

type Answer = { status: number; body: unknown }

const SORTS: Readonly<Record<string, { where?: string; order: string }>> = {
  newest: { order: 'timestamp DESC, id' },
  recalled: { order: 'COALESCE(recall_count, 0) DESC, last_recalled DESC, timestamp DESC, id' },
  never: { where: 'COALESCE(recall_count, 0) = 0', order: 'timestamp DESC, id' },
}

/** A memory id as the API takes it: a non-empty string of at most 64 characters, no control characters. */
export function isMemoryId(value: unknown): value is string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it refuses
  return typeof value === 'string' && /^[^\u0000-\u001f\u007f]{1,64}$/.test(value)
}

/** The tags in a parsed metadata object: non-empty strings only, as the SQL filters count them. */
export function tagsOf(metadata: Record<string, unknown> | null | undefined): string[] {
  const tags = metadata?.tags
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string' && tag !== '') : []
}

/** A row's metadata_json as a plain object; null when empty, broken or not an object. */
export function parseMetadata(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string' || text === '') return null
  try {
    const value = JSON.parse(text)
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

type ListRow = {
  id: string
  preview: string
  length: number
  owner: string
  importance: number | null
  recall_count: number | null
  last_recalled: string | null
  timestamp: string | null
  scope: string | null
  metadata_json: string | null
}

/** GET /api/memories?owner=&sort=newest|recalled|never&q=&tag=&untagged=1&limit= */
export function listMemories(db: Database | null, params: URLSearchParams): Answer {
  const owner = params.get('owner') ?? ''
  const sortName = params.get('sort') || 'newest'
  const q = params.get('q') ?? ''
  const limitText = params.get('limit')
  const limit = limitText === null ? LIST_LIMIT : Number(limitText)
  const sort = SORTS[sortName]
  if (sort === undefined || !Object.hasOwn(SORTS, sortName)) return { status: 400, body: { error: 'sort must be newest, recalled or never' } }
  if (!Number.isInteger(limit) || limit < 1 || limit > LIST_LIMIT) return { status: 400, body: { error: `limit must be 1 to ${LIST_LIMIT}` } }
  if (owner.length > 200 || q.length > 200) return { status: 400, body: { error: 'owner and q are at most 200 characters' } }
  // Trimmed first, so a tag of only spaces is empty (refused), as a stored tag never has spaces around it.
  const tag = params.get('tag')?.trim() ?? null
  const untaggedText = params.get('untagged')
  if (tag !== null && (tag === '' || tag.length > 200)) return { status: 400, body: { error: 'tag must be 1 to 200 characters' } }
  if (untaggedText !== null && untaggedText !== '1') return { status: 400, body: { error: 'untagged must be 1' } }
  if (tag !== null && untaggedText !== null) return { status: 400, body: { error: 'tag and untagged cannot be combined' } }
  if (db === null) return { status: 200, body: { total: 0, count: 0, memories: [] } }
  const where: string[] = []
  const args: (string | number)[] = []
  if (owner) {
    where.push('session_id = ?')
    args.push(owner)
  }
  if (q) {
    where.push("(instr(lower(content), lower(?)) > 0 OR instr(lower(COALESCE(metadata_json, '')), lower(?)) > 0)")
    args.push(q, q)
  }
  // A tag named "untagged" is a tag like any other; only untagged=1 asks for rows with none.
  if (tag !== null) {
    where.push(hasTagSql())
    args.push(tag.toLowerCase())
  }
  if (untaggedText !== null) where.push(untaggedSql())
  if (sort.where) where.push(sort.where)
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const total = (db.query(`SELECT COUNT(*) AS n FROM working_memory ${clause}`).get(...args) as { n: number }).n
  const rows = db
    .query(
      `SELECT id, substr(content, 1, ?) AS preview, length(content) AS length, session_id AS owner, importance,
        recall_count, last_recalled, timestamp, scope, metadata_json
       FROM working_memory ${clause} ORDER BY ${sort.order} LIMIT ?`,
    )
    .all(PREVIEW_CHARS, ...args, limit) as ListRow[]
  const memories = rows.map(({ metadata_json, length, ...row }) => {
    const metadata = parseMetadata(metadata_json)
    return { ...row, recall_count: row.recall_count ?? 0, truncated: length > PREVIEW_CHARS, metadata, tags: tagsOf(metadata) }
  })
  return { status: 200, body: { total, count: memories.length, memories } }
}

/** GET /api/memories/<id>: one row in full, or 404. */
export function getMemory(db: Database | null, id: string): Answer {
  if (db === null || !isMemoryId(id)) return { status: 404, body: { error: 'not found' } }
  const row = db
    .query(
      `SELECT id, content, session_id AS owner, importance, recall_count, last_recalled, timestamp, scope,
        metadata_json, source, memory_type, veracity, created_at
       FROM working_memory WHERE id = ?`,
    )
    .get(id) as (Omit<ListRow, 'preview' | 'length'> & { content: string; source: string | null; memory_type: string | null; veracity: string | null; created_at: string | null }) | null
  if (row === null) return { status: 404, body: { error: 'not found' } }
  const { metadata_json, ...rest } = row
  const metadata = parseMetadata(metadata_json)
  return { status: 200, body: { ...rest, recall_count: rest.recall_count ?? 0, metadata, tags: tagsOf(metadata) } }
}

// ---- Labels shared by the galaxy and the stats ----

export const MAP_LABEL_CHARS = 80

/** A project's label: Global for the global owner, `<name>` for `project-<name>-<hash>`, else the owner. */
export function projectLabel(owner: string): string {
  if (owner === 'global') return 'Global'
  return /^project-(.+)-[0-9a-z]+$/.exec(owner)?.[1] ?? owner
}

const RECALLS = 'COALESCE(recall_count, 0)'

/** The store's owners, the largest first. */
function storeOwners(db: Database | null): string[] {
  if (db === null) return []
  const rows = db.query('SELECT session_id AS owner, COUNT(*) AS n FROM working_memory GROUP BY session_id ORDER BY n DESC, owner').all() as { owner: string | null }[]
  return rows.map(row => row.owner).filter((owner): owner is string => typeof owner === 'string' && owner !== '')
}

// ---- Galaxy (GDATA.1): every memory at once, with the knowledge mined from each ----

// At most this many memories in one galaxy reply; `total` and `shown` say how many were cut.
export const GALAXY_LIMIT = 2000
// C0 and C1 control characters and DEL, and the bidirectional marks: a label must not
// reflow or read as something else (the same set ui/escape.ts removes).
const GALAXY_CONTROL = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

/** A galaxy label: the first non-empty line, control characters removed, cut to MAP_LABEL_CHARS. */
export function galaxyLabel(text: unknown): string {
  const raw = typeof text === 'string' ? text : ''
  const line = raw
    .split('\n')
    .map(part => part.replace(GALAXY_CONTROL, '').trim())
    .find(part => part !== '') ?? ''
  const chars = Array.from(line)
  return chars.length > MAP_LABEL_CHARS ? `${chars.slice(0, MAP_LABEL_CHARS - 1).join('')}…` : line
}

// The five memoria tables (C6): the rowid column, the display text each row
// carries, and the columns the query needs beyond `source_memory_id`.
const KNOWLEDGE_TABLES = [
  { table: 'memoria_facts', kind: 'fact', id: 'id', text: 'value', needs: ['value'] },
  { table: 'memoria_preferences', kind: 'preference', id: 'id', text: 'preference', needs: ['preference'] },
  { table: 'memoria_instructions', kind: 'instruction', id: 'id', text: 'instruction', needs: ['instruction'] },
  { table: 'memoria_timelines', kind: 'timeline', id: 'event_id', text: 'description', needs: ['description'] },
  { table: 'memoria_kg', kind: 'relation', id: 'id', text: "trim(coalesce(subject, '') || ' ' || coalesce(predicate, '') || ' ' || coalesce(object, ''))", needs: ['subject', 'predicate', 'object'] },
] as const

export type GalaxyKnowledge = { id: string; kind: string; text: string; memory: string }
export type GalaxyMemory = { id: string; owner: string; tags: string[]; recalls: number; lastRecalled: string | null; created: string | null; label: string }
export type GalaxyProject = { owner: string; label: string; count: number; recalls: number }

/**
 * The columns a table actually has: a legacy store may predate `source_memory_id`
 * (and the other memoria columns) even though the table exists (review 2 LOW 1).
 */
function tableColumns(db: Database, table: string): Set<string> {
  return new Set((db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(row => row.name))
}

/**
 * GET /api/galaxy: every memory (newest first, at most `limit`), its project and the
 * knowledge rows mined from it, read-only. A missing store or a missing memoria table
 * gives empty lists; nothing here writes.
 */
export function galaxyLevel(db: Database | null, limit = GALAXY_LIMIT): Answer {
  if (db === null) return { status: 200, body: { projects: [], memories: [], knowledge: [], meaning: false, total: 0, shown: 0 } }
  const present = new Set(
    (db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(row => row.name),
  )
  const where = "session_id IS NOT NULL AND session_id <> ''"
  const total = (db.query(`SELECT COUNT(*) AS n FROM working_memory WHERE ${where}`).get() as { n: number }).n
  const projects: GalaxyProject[] = (
    db
      .query(`SELECT session_id AS owner, COUNT(*) AS count, SUM(${RECALLS}) AS recalls FROM working_memory WHERE ${where} GROUP BY session_id ORDER BY count DESC, owner`)
      .all() as { owner: string; count: number; recalls: number | null }[]
  ).map(row => ({ owner: row.owner, label: projectLabel(row.owner), count: row.count, recalls: row.recalls ?? 0 }))

  const rows = db
    .query(
      `SELECT id, session_id AS owner, ${RECALLS} AS recalls, last_recalled AS lastRecalled,
              timestamp AS created, substr(content, 1, 4000) AS head, metadata_json
       FROM working_memory WHERE ${where} ORDER BY timestamp DESC, id LIMIT ?`,
    )
    .all(limit) as { id: string; owner: string; recalls: number; lastRecalled: string | null; created: string | null; head: string | null; metadata_json: string | null }[]
  const memories: GalaxyMemory[] = rows.map(row => ({
    id: row.id,
    owner: row.owner,
    tags: tagsOf(parseMetadata(row.metadata_json)),
    recalls: row.recalls,
    lastRecalled: row.lastRecalled,
    created: row.created,
    label: galaxyLabel(row.head),
  }))

  const knowledge: GalaxyKnowledge[] = []
  if (memories.length > 0) {
    const ids = memories.map(memory => memory.id)
    const marks = ids.map(() => '?').join(', ')
    for (const source of KNOWLEDGE_TABLES) {
      if (!present.has(source.table)) continue
      // A legacy table can exist without the column the join needs: skip it, never throw.
      const columns = tableColumns(db, source.table)
      if (!columns.has(source.id) || !columns.has('source_memory_id') || !source.needs.every(column => columns.has(column))) continue
      let found: { rowid: number; text: string | null; memory: string }[]
      try {
        found = db
          .query(`SELECT ${source.id} AS rowid, ${source.text} AS text, source_memory_id AS memory FROM ${source.table} WHERE source_memory_id IN (${marks}) ORDER BY ${source.id}`)
          .all(...ids) as { rowid: number; text: string | null; memory: string }[]
      } catch {
        continue
      }
      for (const row of found) {
        knowledge.push({ id: `${source.kind}:${row.rowid}`, kind: source.kind, text: galaxyLabel(row.text), memory: row.memory })
      }
    }
  }
  return { status: 200, body: { projects, memories, knowledge, meaning: false, total, shown: memories.length } }
}

export type KnowledgeItem = {
  id: string
  kind: string
  text: string
  item: string
  owner: string
  source_memory_id: string
  topic: string | null
  recalls: number
  lastRecalled: string | null
  usage: {
    recalls: number
    lastRecalled: string | null
  }
}

/**
 * GET /api/knowledge: every mined item from the five memoria tables, token-guarded and read-only.
 * Returns items mapped by kind with source memory topic and usage, plus extraction status.
 */
export function knowledgeList(db: Database | null): Answer {
  const extraction = process.env.MNEMOSYNE_EXTRACTION || 'unknown'
  if (db === null) {
    return {
      status: 200,
      body: {
        extraction,
        facts: [],
        preferences: [],
        instructions: [],
        timelines: [],
        relations: [],
        kg: [],
        items: [],
      },
    }
  }

  const present = new Set(
    (db.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(row => row.name),
  )
  const wmPresent = present.has('working_memory')

  const result: Record<'facts' | 'preferences' | 'instructions' | 'timelines' | 'relations', KnowledgeItem[]> = {
    facts: [],
    preferences: [],
    instructions: [],
    timelines: [],
    relations: [],
  }

  for (const source of KNOWLEDGE_TABLES) {
    if (!present.has(source.table)) continue
    const columns = tableColumns(db, source.table)
    if (!columns.has(source.id) || !columns.has('source_memory_id') || !source.needs.every(col => columns.has(col))) continue

    const listKey =
      source.table === 'memoria_facts'
        ? 'facts'
        : source.table === 'memoria_preferences'
          ? 'preferences'
          : source.table === 'memoria_instructions'
            ? 'instructions'
            : source.table === 'memoria_timelines'
              ? 'timelines'
              : 'relations'

    let query: string
    if (wmPresent) {
      query = `SELECT t.${source.id} AS rowid,
                      ${source.text} AS text,
                      t.session_id AS owner,
                      t.source_memory_id AS source_memory_id,
                      wm.recall_count AS recalls,
                      wm.last_recalled AS lastRecalled,
                      wm.metadata_json AS metadata_json
               FROM ${source.table} t
               LEFT JOIN working_memory wm ON wm.id = t.source_memory_id
               ORDER BY t.${source.id}`
    } else {
      query = `SELECT t.${source.id} AS rowid,
                      ${source.text} AS text,
                      t.session_id AS owner,
                      t.source_memory_id AS source_memory_id,
                      0 AS recalls,
                      NULL AS lastRecalled,
                      NULL AS metadata_json
               FROM ${source.table} t
               ORDER BY t.${source.id}`
    }

    let rows: {
      rowid: number
      text: string | null
      owner: string | null
      source_memory_id: string | null
      recalls: number | null
      lastRecalled: string | null
      metadata_json: string | null
    }[]
    try {
      rows = db.query(query).all() as {
        rowid: number
        text: string | null
        owner: string | null
        source_memory_id: string | null
        recalls: number | null
        lastRecalled: string | null
        metadata_json: string | null
      }[]
    } catch {
      continue
    }

    for (const r of rows) {
      const cleaned = galaxyLabel(r.text)
      const topic = tagsOf(parseMetadata(r.metadata_json))[0] ?? null
      const recalls = r.recalls ?? 0
      const lastRecalled = r.lastRecalled ?? null
      const item: KnowledgeItem = {
        id: `${source.kind}:${r.rowid}`,
        kind: source.kind,
        text: cleaned,
        item: cleaned,
        owner: r.owner ?? '',
        source_memory_id: r.source_memory_id ?? '',
        topic,
        recalls,
        lastRecalled,
        usage: {
          recalls,
          lastRecalled,
        },
      }
      result[listKey].push(item)
    }
  }

  const allItems = [
    ...result.facts,
    ...result.preferences,
    ...result.instructions,
    ...result.timelines,
    ...result.relations,
  ]

  return {
    status: 200,
    body: {
      extraction,
      facts: result.facts,
      preferences: result.preferences,
      instructions: result.instructions,
      timelines: result.timelines,
      relations: result.relations,
      kg: result.relations,
      items: allItems,
    },
  }
}

// ---- Activity (VIEW.2): the log, read; and its tail, streamed ----

// The JSON object lines of a log file's text; anything else is skipped.
function objectLines(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    const value = parseMetadata(line)
    if (value !== null) out.push(value)
  }
  return out
}

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

/**
 * Where a read of the log stopped: `<inode>:<byte offset>` of the current file,
 * just past its last whole line. The stream started from it sends every line
 * after it, so nothing falls between a catch-up read and the live tail.
 * Empty when the file does not exist yet (the stream then reads it from its start).
 */
export type ActivityRead = { lines: Record<string, unknown>[]; cursor: string }

// The current file's whole lines and the cursor past them, from one open file.
function readCurrent(path: string): { text: string; cursor: string } {
  let fd: number
  try {
    fd = openSync(path, 'r')
  } catch {
    return { text: '', cursor: '' }
  }
  try {
    const { ino, size } = fstatSync(fd)
    const buffer = Buffer.alloc(size)
    let read = 0
    while (read < size) {
      const n = readSync(fd, buffer, read, size - read, read)
      if (n <= 0) break
      read += n
    }
    const end = buffer.subarray(0, read).lastIndexOf(0x0a) + 1
    return { text: buffer.subarray(0, end).toString('utf8'), cursor: `${ino}:${end}` }
  } finally {
    closeSync(fd)
  }
}

/** The last `limit` lines of the log (the backup first when the log holds fewer), newest first, and the cursor. A missing file is no lines. */
export function readActivity(path: string, limit = ACTIVITY_DEFAULT): ActivityRead {
  if (!path) return { lines: [], cursor: '' }
  const current = readCurrent(path)
  let lines = objectLines(current.text)
  if (lines.length < limit) lines = [...objectLines(readText(`${path}.1`)), ...lines]
  return { lines: lines.slice(-limit).reverse(), cursor: current.cursor }
}

/** A cursor from readActivity, or undefined when it is not one. */
export function parseCursor(text: string | null): { ino: number; offset: number } | undefined {
  const match = /^(\d{1,20}):(\d{1,15})$/.exec(text ?? '')
  if (!match) return undefined
  const ino = Number(match[1])
  const offset = Number(match[2])
  return Number.isSafeInteger(offset) && Number.isFinite(ino) ? { ino, offset } : undefined
}

/**
 * Follows the log, from `from` (a cursor) or else from its current end.
 * poll() gives the whole lines added since the last poll. A rotation (the
 * file now has another inode) first finishes the old file, now <path>.1, then
 * reads the new one from its start; a missing file is waited for; a file that
 * shrank is read again from 0.
 */
export function tailActivity(path: string, from?: { ino: number; offset: number }) {
  let ino: number | undefined
  let offset = 0
  let pending = Buffer.alloc(0)
  if (from !== undefined) {
    ino = from.ino
    offset = from.offset
  } else {
    try {
      const stat = statSync(path)
      ino = stat.ino
      offset = stat.size
    } catch {
      // not there yet: read it from its start once it is
    }
  }
  const take = (file: string, out: string[]) => {
    let fd: number
    try {
      fd = openSync(file, 'r')
    } catch {
      return
    }
    try {
      const size = fstatSync(fd).size
      while (offset < size) {
        const chunk = Buffer.alloc(Math.min(size - offset, 1024 * 1024))
        const read = readSync(fd, chunk, 0, chunk.length, offset)
        if (read <= 0) break
        offset += read
        pending = Buffer.concat([pending, chunk.subarray(0, read)])
      }
    } finally {
      closeSync(fd)
    }
    // Whole lines only; a line still being written waits for its newline.
    let at = pending.indexOf(0x0a)
    while (at !== -1) {
      const value = parseMetadata(pending.subarray(0, at).toString('utf8'))
      if (value !== null) out.push(JSON.stringify(value))
      pending = pending.subarray(at + 1)
      at = pending.indexOf(0x0a)
    }
  }
  return {
    poll(): string[] {
      const out: string[] = []
      let stat: ReturnType<typeof statSync>
      try {
        stat = statSync(path)
      } catch {
        return out
      }
      if (ino === undefined) {
        ino = stat.ino
        offset = 0
      } else if (stat.ino !== ino) {
        try {
          if (statSync(`${path}.1`).ino === ino) take(`${path}.1`, out)
        } catch {
          // no backup: the old file's tail is gone
        }
        ino = stat.ino
        offset = 0
        pending = Buffer.alloc(0)
      } else if (stat.size < offset) {
        offset = 0
        pending = Buffer.alloc(0)
      }
      take(path, out)
      return out
    },
  }
}

// ---- Search and forget (VIEW.3): through the engine, as the row's owner ----

type Hit = {
  id: string
  owner: string
  content: string
  truncated: boolean
  scope: string | null
  score: number
  recall_count: number
  last_recalled: string | null
  timestamp: string | null
  importance: number | null
  metadata: Record<string, unknown> | null
  tags: string[]
}

// A JSON body that is one plain object holding only `allowed` keys; else the reason.
function plainBody(text: string, allowed: readonly string[]): Record<string, unknown> | string {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return 'the body is not JSON'
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'the body must be a JSON object'
  const extra = Object.keys(value).filter(key => !allowed.includes(key))
  if (extra.length > 0) return `unexpected field: ${extra[0]}`
  return value as Record<string, unknown>
}

/** Recall hits merged by id, each kept once with its best score, best first. */
export function mergeHits(runs: readonly (readonly Record<string, unknown>[])[], limit = SEARCH_LIMIT): Hit[] {
  const best = new Map<string, Hit>()
  for (const results of runs) {
    for (const row of results) {
      if (typeof row?.id !== 'string') continue
      const score = typeof row.score === 'number' && Number.isFinite(row.score) ? row.score : 0
      const seen = best.get(row.id)
      if (seen !== undefined && seen.score >= score) continue
      const metadata = parseMetadata(row.metadata_json)
      best.set(row.id, {
        id: row.id,
        owner: String(row.session_id ?? ''),
        content: String(row.content ?? ''),
        truncated: row.truncated === true,
        scope: typeof row.scope === 'string' ? row.scope : null,
        score,
        recall_count: typeof row.recall_count === 'number' ? row.recall_count : 0,
        last_recalled: typeof row.last_recalled === 'string' ? row.last_recalled : null,
        timestamp: typeof row.timestamp === 'string' ? row.timestamp : null,
        importance: typeof row.importance === 'number' ? row.importance : null,
        metadata,
        tags: tagsOf(metadata),
      })
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit)
}

// The engine reply's results, or the reason it failed.
function recallResults(answer: string | Error | undefined): Record<string, unknown>[] | Error {
  if (answer === undefined) return new Error('the engine gave no reply')
  if (answer instanceof Error) return answer
  const body = parseMetadata(answer)
  if (body === null) return new Error('the engine reply is not JSON')
  if (typeof body.error === 'string') return new Error(body.error)
  if (body.status !== 'ok' || !Array.isArray(body.results)) return new Error(`the engine answered ${String(body.status)}`)
  return body.results as Record<string, unknown>[]
}

type Views = {
  config: Config
  store: Store
  // An activity line, origin ui; `extra` adds keys after the C3 ones.
  log: (fields: ActivityFields, extra?: Record<string, unknown>) => void
  // One engine process, within the server's cap on live engine processes.
  run: (config: Pick<Config, 'cli' | 'store'>, requests: readonly EngineRequest[], owner: string) => Promise<(string | Error)[]>
  // True while a search runs: one at a time.
  searching: boolean
  // Forgets reach the engine one at a time: two engine processes deleting at once can fail with "database is locked".
  forgets: ReturnType<typeof limiter>
}

// What the page gets when the engine fails: the detail goes to the activity log only.
const ENGINE_FAILED = 'The engine failed; the activity log has the detail.'

/**
 * At most `max` jobs at once; the rest wait in order. `live()` is how many run.
 */
export function limiter(max: number) {
  let live = 0
  const waiting: (() => void)[] = []
  return {
    live: () => live,
    async run<T>(job: () => Promise<T>): Promise<T> {
      while (live >= max) await new Promise<void>(resolve => waiting.push(resolve))
      live++
      try {
        return await job()
      } finally {
        live--
        waiting.shift()?.()
      }
    },
  }
}

/** POST /api/search {query, owner?}: the engine's recall with recall counts left alone. */
async function search(views: Views, text: string): Promise<Answer> {
  const body = plainBody(text, ['query', 'owner'])
  if (typeof body === 'string') return { status: 400, body: { error: body } }
  const { query, owner } = body
  if (typeof query !== 'string' || query.trim() === '' || query.length > MAX_QUERY_CHARS) {
    return { status: 400, body: { error: `query must be a non-empty string of at most ${MAX_QUERY_CHARS} characters` } }
  }
  if (owner !== undefined && (typeof owner !== 'string' || owner === '')) return { status: 400, body: { error: 'owner must be a non-empty string' } }
  views.store.db ??= openStore(views.config.store)
  const all = storeOwners(views.store.db)
  if (owner !== undefined && !all.includes(owner)) return { status: 400, body: { error: 'no such owner in the store' } }
  const owners = owner !== undefined ? [owner] : all.slice(0, SEARCH_OWNERS)
  // An empty store: nothing to search, no engine run, no activity line.
  if (owners.length === 0) return { status: 200, body: { query, owners, skipped: 0, count: 0, results: [] } }
  if (views.searching) return { status: 429, body: { error: 'A search is already running; try again when it ends.' } }
  views.searching = true
  try {
    const request: EngineRequest = ['mnemopi_recall', { query, limit: SEARCH_LIMIT, update_recall_counts: false }]
    const runs = await Promise.all(owners.map(async as => recallResults((await views.run(views.config, [request], as))[0])))
    const failed = runs.find((run): run is Error => run instanceof Error)
    // One owner: that owner. Across owners: the C3 default owner, and `owners` says how many were searched.
    const logged = { action: 'recall', origin: 'ui', owner: (owners.length === 1 ? owners[0] : undefined) ?? 'global', text: query } as const
    const extra = { owners: owners.length, client: 'dashboard' }
    if (failed !== undefined) {
      views.log({ ...logged, ok: false, error: failed.message }, extra)
      return { status: 502, body: { error: ENGINE_FAILED } }
    }
    const hits = mergeHits(runs as Record<string, unknown>[][])
    views.log({ ...logged, ok: true, ids: hits.map(hit => hit.id), count: hits.length }, extra)
    return { status: 200, body: { query, owners, skipped: owner !== undefined ? 0 : all.length - owners.length, count: hits.length, results: hits } }
  } finally {
    views.searching = false
  }
}

// A forget the engine answered with SQLite's "database is locked" (an Error, or an error reply).
export const LOCK_RETRY_MS = 250
const isLocked = (answer: string | Error | undefined) => /database is locked/i.test(answer instanceof Error ? answer.message : (answer ?? ''))

/** POST /api/forget {memory_id}: the engine's forget, as the owner the database names. */
async function forget(views: Views, text: string): Promise<Answer> {
  const body = plainBody(text, ['memory_id'])
  if (typeof body === 'string') return { status: 400, body: { error: body } }
  const id = body.memory_id
  if (!isMemoryId(id)) return { status: 400, body: { error: 'memory_id must be a non-empty string of at most 64 characters' } }
  views.store.db ??= openStore(views.config.store)
  const ownerOf = () => views.store.db?.query('SELECT session_id AS owner FROM working_memory WHERE id = ?').get(id) as { owner: string | null } | null | undefined
  const row = ownerOf()
  const gone = { status: 404, body: { status: 'not_found', memory_id: id, error: 'That memory is already gone; nothing was deleted.' } }
  if (row === null || row === undefined) return gone
  const owner = row.owner
  if (typeof owner !== 'string' || owner === '') return { status: 409, body: { error: 'this memory has no owner to forget it as' } }
  // One at a time (and once more if the store was busy with a write from outside this server).
  const forgetOnce = () => views.forgets.run(async () => (await views.run(views.config, [['mnemopi_forget', { memory_id: id }]], owner))[0])
  let answer = await forgetOnce()
  if (isLocked(answer)) {
    await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_MS))
    answer = await forgetOnce()
  }
  const logged = { action: 'forget', origin: 'ui', owner, ids: [id] } as const
  const extra = { client: 'dashboard' }
  const reply = typeof answer === 'string' ? parseMetadata(answer) : null
  if (reply?.status === 'deleted') {
    views.log({ ...logged, count: 1, ok: true }, extra)
    return { status: 200, body: { status: 'deleted', memory_id: id, owner } }
  }
  if (reply?.status === 'not_found') {
    views.log({ ...logged, count: 0, ok: false, error: 'not_found' }, extra)
    return gone
  }
  const message =
    answer === undefined
      ? 'the engine gave no reply'
      : answer instanceof Error
        ? answer.message
        : typeof reply?.error === 'string'
          ? reply.error
          : `the engine answered ${String(reply?.status ?? answer.slice(0, 100))}`
  // The engine failed or timed out, maybe after its delete committed: the row says what happened.
  if (ownerOf() == null) {
    views.log({ ...logged, count: 1, ok: true }, { ...extra, note: preview(`engine reply lost: ${message}`) })
    return { status: 200, body: { status: 'deleted', memory_id: id, owner, note: 'The engine reply was lost, but the memory is gone.' } }
  }
  views.log({ ...logged, count: 0, ok: false, error: message }, extra)
  return { status: 502, body: { error: `${ENGINE_FAILED} Nothing was deleted.` } }
}

export type Started = { port: number; token: string; stop: () => void }

// Starts the HTTP server; the caller writes ui.json and the ready line.
// Limits a test can lower; the defaults are the exported constants.
export type ServerOptions = {
  vendorDir?: string
  maxEngines?: number
  maxStreams?: number
  streamMaxMs?: number
  engineTimeoutMs?: number
}

export async function startServer(config: Config, options: ServerOptions = {}): Promise<Started> {
  const vendorDir = options.vendorDir ?? VENDOR_DIR
  const maxStreams = options.maxStreams ?? MAX_STREAMS
  const streamMaxMs = options.streamMaxMs ?? STREAM_MAX_MS
  const engines = limiter(options.maxEngines ?? MAX_ENGINES)
  const engineTimeoutMs = options.engineTimeoutMs ?? ENGINE_TIMEOUT_MS
  const token = randomBytes(32).toString('base64url')
  const page = readFileSync(join(UI_DIR, 'index.html'))
  const style = readFileSync(join(UI_DIR, 'style.css'))
  const app = await buildApp()
  const store: Store = { db: null }
  const engine = engineVersion(config.cli)
  let host = ''
  // Every search and forget that reaches the engine leaves one line, origin ui (C3).
  const log = (fields: ActivityFields, extra: Record<string, unknown> = {}) => {
    if (config.activityLog) appendActivity(config.activityLog, [{ ...activityEntry(fields), ...extra }])
  }
  const views: Views = {
    config,
    store,
    log,
    run: (cfg, requests, owner) => engines.run(() => runEngine(cfg, requests, owner, process.env, engineTimeoutMs)),
    searching: false,
    forgets: limiter(1),
  }
  const streams = new Set<() => void>()

  // The two POST routes: the page's own origin, JSON, a small body; then the handler.
  async function post(request: Request, handle: (views: Views, text: string) => Promise<Answer>) {
    if (request.method !== 'POST') return notAllowed('POST')
    if (request.headers.get('origin') !== `http://${host}`) return json({ error: 'forbidden origin' }, 403)
    const type = (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase()
    if (type !== 'application/json') return json({ error: 'the body must be application/json' }, 415)
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return json({ error: 'the body is too large' }, 413)
    const text = await request.text()
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) return json({ error: 'the body is too large' }, 413)
    const answer = await handle(views, text)
    return json(answer.body, answer.status)
  }

  // NDJSON: one log line per line, a blank line to keep a quiet stream open.
  function stream(cursor: string | null) {
    if (!config.activityLog) return json({ error: 'the activity log is off' }, 404)
    const from = parseCursor(cursor)
    if (cursor !== null && cursor !== '' && from === undefined) return json({ error: 'cursor must be <inode>:<offset> from /api/activity' }, 400)
    if (streams.size >= maxStreams) return json({ error: 'too many activity streams' }, 429)
    const tail = tailActivity(config.activityLog, from)
    const encoder = new TextEncoder()
    let finish = () => {}
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const opened = Date.now()
        let sent = opened
        const timer = setInterval(() => {
          try {
            const lines = tail.poll()
            const now = Date.now()
            if (lines.length > 0) {
              controller.enqueue(encoder.encode(lines.map(line => `${line}\n`).join('')))
              sent = now
            } else if (now - sent >= STREAM_HEARTBEAT_MS) {
              controller.enqueue(encoder.encode('\n'))
              sent = now
            }
            if (now - opened >= streamMaxMs) finish()
          } catch {
            finish()
          }
        }, STREAM_POLL_MS)
        finish = () => {
          clearInterval(timer)
          streams.delete(finish)
          try {
            controller.close()
          } catch {
            // already closed or cancelled
          }
        }
        streams.add(finish)
        // A first blank line, so the reply's headers go out at once.
        controller.enqueue(encoder.encode('\n'))
      },
      cancel() {
        finish()
      },
    })
    return reply(body, 200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' })
  }

  function api(request: Request, url: URL, server: { timeout(request: Request, seconds: number): void }): Response | Promise<Response> {
    const path = url.pathname
    const get = (answer: () => Answer | Response) => {
      if (request.method !== 'GET') return notAllowed()
      const out = answer()
      return out instanceof Response ? out : json(out.body, out.status)
    }
    if (path === '/api/health') return get(() => ({ status: 200, body: health(config, store, engine) }))
    if (path === '/api/health-report') return get(() => healthReport(config, store, engine))
    if (path === '/api/knowledge') return get(() => knowledgeList((store.db ??= openStore(config.store))))
    if (path === '/api/memories') {
      return get(() => listMemories((store.db ??= openStore(config.store)), url.searchParams))
    }
    if (path.startsWith('/api/memories/')) {
      return get(() => {
        let id: string
        try {
          id = decodeURIComponent(path.slice('/api/memories/'.length))
        } catch {
          return { status: 404, body: { error: 'not found' } }
        }
        return getMemory((store.db ??= openStore(config.store)), id)
      })
    }
    if (path === '/api/galaxy') return get(() => galaxyLevel((store.db ??= openStore(config.store))))
    if (path === '/api/activity') {
      return get(() => {
        const asked = url.searchParams.get('limit')
        const limit = asked === null ? ACTIVITY_DEFAULT : Number(asked)
        if (!Number.isInteger(limit) || limit < 1 || limit > ACTIVITY_MAX) return { status: 400, body: { error: `limit must be 1 to ${ACTIVITY_MAX}` } }
        return { status: 200, body: { off: !config.activityLog, ...readActivity(config.activityLog, limit) } }
      })
    }
    if (path === '/api/activity/stream') {
      return get(() => {
        // Bun's idle timeout would cut a quiet stream; the keep-alive line covers it too.
        server.timeout(request, 0)
        return stream(url.searchParams.get('cursor'))
      })
    }
    if (path === '/api/search') return post(request, search)
    if (path === '/api/forget') return post(request, forget)
    return notFound()
  }

  const statics: Record<string, () => Response> = {
    '/': () => reply(page, 200, { 'Content-Type': 'text/html; charset=utf-8' }),
    '/index.html': () => reply(page, 200, { 'Content-Type': 'text/html; charset=utf-8' }),
    '/app.js': () => reply(app, 200, { 'Content-Type': 'text/javascript; charset=utf-8' }),
    '/style.css': () => reply(style, 200, { 'Content-Type': 'text/css; charset=utf-8' }),
    // No icon: an empty answer, so a browser logs no failed request.
    '/favicon.ico': () => reply(null, 204),
  }

  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    maxRequestBodySize: 64 * 1024,
    fetch(request, server) {
      // DNS rebinding: a page on another name that resolves here is refused.
      if (request.headers.get('host') !== host) return json({ error: 'forbidden' }, 403)
      if (request.method === 'OPTIONS') return notAllowed()
      const url = new URL(request.url)
      const path = url.pathname
      if (path === '/api' || path.startsWith('/api/')) {
        // The token only ever counts in the header: never in the query string.
        if (!hasToken(request, token)) return json({ error: 'unauthorized' }, 401)
        return api(request, url, server)
      }
      if (request.method !== 'GET') return notAllowed()
      const fixed = statics[path]
      if (fixed) return fixed()
      if (path.startsWith('/vendor/')) return vendor(vendorDir, path.slice('/vendor/'.length))
      return notFound()
    },
    error() {
      return json({ error: 'server error' }, 500)
    },
  })
  const port = server.port
  if (port === undefined) throw new Error('the server has no port')
  host = `127.0.0.1:${port}`
  return {
    port,
    token,
    stop() {
      for (const finish of [...streams]) finish()
      void server.stop(true)
      store.db?.close()
    },
  }
}

// One file straight under ui/vendor/, by a plain name: no slash, no dot
// segment, no escape (URL parsing already folds `..`; `%2f` stays and fails here).
function vendor(dir: string, name: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) return notFound()
  const type = VENDOR_TYPES[name.slice(name.lastIndexOf('.'))]
  if (type === undefined) return notFound()
  const file = join(dir, name)
  try {
    // A regular file, not a link, whose real path is inside the vendor folder.
    if (!lstatSync(file).isFile()) return notFound()
    const real = realpathSync(file)
    if (!real.startsWith(`${realpathSync(dir)}${sep}`)) return notFound()
    return reply(readFileSync(real), 200, { 'Content-Type': type })
  } catch {
    return notFound()
  }
}

// How often the parent is checked: MNEMOSYNE_UI_PARENT_CHECK_MS held to 100 ms - 10 s, else 10 s.
export function parentCheckMs(value: string | undefined = process.env.MNEMOSYNE_UI_PARENT_CHECK_MS) {
  const ms = Number(value)
  if (!value || !Number.isFinite(ms)) return DEFAULT_PARENT_CHECK_MS
  return Math.min(DEFAULT_PARENT_CHECK_MS, Math.max(MIN_PARENT_CHECK_MS, Math.round(ms)))
}

// Calls `gone` once the process that started this one has exited (it is then
// re-parented, so its parent id changes).
function watchParent(gone: () => void) {
  const parent = process.ppid
  const timer = setInterval(() => {
    if (process.ppid !== parent) gone()
  }, parentCheckMs())
  timer.unref()
}

async function serve() {
  const config = configFromEnv(process.env)
  const started = await startServer(config)
  let stopping = false
  const stop = (code = 0) => {
    if (stopping) return
    stopping = true
    started.stop()
    removeState(config.root, process.pid)
    process.exit(code)
  }
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.on(signal, () => stop(0))
  process.on('exit', () => removeState(config.root, process.pid))
  writeState(config.root, { port: started.port, token: started.token, pid: process.pid })
  // The ready line: port and pid only; the hook reads the token from ui.json.
  process.stdout.write(`${JSON.stringify({ port: started.port, pid: process.pid })}\n`)
  watchParent(() => stop(0))
  // stdin is the holder's pipe: it closes when the holder (or whatever started us) ends.
  void (async () => {
    try {
      for await (const _ of Bun.stdin.stream()) {
        // nothing is read from stdin; it only says the parent is alive
      }
    } catch {
      // a broken pipe is a closed one
    }
    stop(0)
  })()
}

// What /mnemosyne-ui spawns: holds the server's stdin open, passes its output
// through, and takes it down when this process is stopped or orphaned.
async function hold() {
  const child = Bun.spawn([process.execPath, import.meta.path], {
    stdin: 'pipe',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  })
  const end = () => {
    child.kill()
    process.exit(0)
  }
  for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.on(signal, end)
  watchParent(end)
  process.exit(await child.exited)
}

// The hook's health check (hooks/ui-launch.ts): 0 only when the server on
// <port> answers /api/health with the token and names <pid>. No proxy (the
// token would reach it), no redirect followed.
export async function ping(port: number, pid: number, token: string) {
  for (const name of PROXY_VARIABLES) delete process.env[name]
  process.env.NO_PROXY = '127.0.0.1'
  process.env.no_proxy = '127.0.0.1'
  if (!Number.isInteger(port) || port <= 0 || port >= 65_536 || !Number.isInteger(pid) || !/^[A-Za-z0-9_-]+$/.test(token)) return false
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'manual',
      signal: AbortSignal.timeout(PING_FETCH_TIMEOUT_MS),
    })
    if (response.status !== 200) return false
    const health = (await response.json()) as { pid?: unknown }
    return health?.pid === pid
  } catch {
    return false
  }
}

async function pingMain() {
  const at = process.argv.indexOf('--ping')
  const token = (await Bun.stdin.text()).trim()
  process.exit((await ping(Number(process.argv[at + 1]), Number(process.argv[at + 2]), token)) ? 0 : 1)
}

if (import.meta.main) {
  const run = process.argv.includes('--ping') ? pingMain : process.argv.includes('--hold') ? hold : serve
  run().catch(err => {
    process.stderr.write(`mnemosyne ui: ${(err as Error).message}\n`)
    process.exit(1)
  })
}
