// Claude Mnemosyne — the recall evaluation harness (0.26.0, gbrain step 1).
//
// Every later ranking change (the graph arm, RRF fusion, a reranker) is measured with this before it ships:
//   bun bin/eval.ts capture    [--root R] [--log F]                      real recall queries from the activity log → <root>/eval/queries.jsonl
//   bun bin/eval.ts gold-draft [--root R] [--store S] [--mode M] [--top N]  a draft labelled set: each query with today's top hits → <root>/eval/gold.draft.json
//   bun bin/eval.ts run        [--root R] [--store S] [--mode M] [--k K] [--weights V,K,I] [--name N] [--gold F]
//                                                                         replays every query (captured and gold) → <root>/eval/runs/<name>.json
//   bun bin/eval.ts compare    <a.json> <b.json> [--gold F]               top-1 stability, overlap@k, and recall@k / MRR on the gold set
//   bun bin/eval.ts report     <run.json> [--gold F]                      one run's gold scores
//
// Safety: `run` and `gold-draft` replay against a snapshot copy of the store (VACUUM INTO a temp folder), never the live one,
// and every recall is sent with update_recall_counts false, so nothing in the store changes. The engine runs with the plugin's
// own environment (hooks/engine.ts): local only, the weights pinned. Queries, labels and runs hold your memory ids and query
// text, so they live under the Mnemosyne root (0700 folder, 0600 files), never in the plugin's repository.
import { Database } from 'bun:sqlite'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildRequests, DEFAULT_RECALL_WEIGHTS, engineEnv, parseReplies, type RecallWeights } from '../hooks/engine'
import { engineCliOf } from './memories'

const IS_WINDOWS = process.platform === 'win32'

// ---- Captured queries ----

export type Query = { owner: string; query: string; origin: string; client: string; seen: number; last: string }

/** The key that matches a query across files: its owner and its text. */
export const keyOf = (q: { owner: string; query: string }) => `${q.owner}\u0000${q.query}`

/**
 * The recall queries in activity-log lines (oldest first, as the log is): successful recalls with text, one per owner and
 * text, with how often each was asked and when last. A dashboard search across every project (owners > 1) replays as global.
 * `origins` limits the origins taken (none: all).
 */
export function queriesOf(lines: readonly Record<string, unknown>[], origins: readonly string[] = []): Query[] {
  const found = new Map<string, Query>()
  for (const line of lines) {
    if (line.action !== 'recall' || line.ok === false) continue
    const query = typeof line.text === 'string' ? line.text.trim() : ''
    const origin = typeof line.origin === 'string' ? line.origin : ''
    if (query === '' || (origins.length > 0 && !origins.includes(origin))) continue
    const owner = typeof line.owners === 'number' && line.owners > 1 ? 'global' : typeof line.owner === 'string' && line.owner !== '' ? line.owner : 'global'
    const key = keyOf({ owner, query })
    const t = typeof line.t === 'string' ? line.t : ''
    const seen = found.get(key)
    if (seen) {
      seen.seen++
      if (t > seen.last) seen.last = t
    } else found.set(key, { owner, query, origin, client: typeof line.client === 'string' ? line.client : '', seen: 1, last: t })
  }
  return [...found.values()].sort((a, b) => b.seen - a.seen || b.last.localeCompare(a.last))
}

/** The JSON-object lines of a log text; anything else is skipped. */
export function logLines(text: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    try {
      const value = JSON.parse(line)
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) out.push(value as Record<string, unknown>)
    } catch {
      // not a line
    }
  }
  return out
}

// ---- The labelled set ----

/** One labelled query: the memories a good recall returns for it (any order), and an optional note. */
export type GoldQuery = { owner: string; query: string; expect: string[]; note?: string }
export type Gold = { version: 1; queries: GoldQuery[] }

/** A gold file made safe to use: entries without an owner, a query or any expected id are dropped. */
export function parseGold(body: unknown): Gold {
  const raw = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const list = Array.isArray(raw.queries) ? raw.queries : []
  const queries: GoldQuery[] = []
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue
    const q = item as Record<string, unknown>
    const expect = Array.isArray(q.expect) ? q.expect.filter((id): id is string => typeof id === 'string' && id !== '') : []
    if (typeof q.owner !== 'string' || q.owner === '' || typeof q.query !== 'string' || q.query.trim() === '' || expect.length === 0) continue
    queries.push({ owner: q.owner, query: q.query.trim(), expect, ...(typeof q.note === 'string' ? { note: q.note } : {}) })
  }
  return { version: 1, queries }
}

// ---- Runs ----

export type RunResult = { owner: string; query: string; ids: string[]; scores: number[]; error?: string }
export type Run = { version: 1; name: string; created: string; mode: 'keyword' | 'hybrid'; k: number; weights: RecallWeights; results: RunResult[] }

/** The ids and scores of one engine recall reply (`{status: 'ok', results: [...]}`), best first; an Error for anything else. */
export function recallIds(answer: string | Error): { ids: string[]; scores: number[] } | Error {
  if (answer instanceof Error) return answer
  let body: unknown
  try {
    body = JSON.parse(answer)
  } catch {
    return new Error('the engine reply is not JSON')
  }
  const reply = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  if (reply.status !== 'ok' || !Array.isArray(reply.results)) return new Error(typeof reply.error === 'string' ? reply.error : `the engine answered ${String(reply.status)}`)
  const rows = reply.results.filter((row): row is Record<string, unknown> => row !== null && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string')
  return { ids: rows.map(row => String(row.id)), scores: rows.map(row => (typeof row.score === 'number' && Number.isFinite(row.score) ? row.score : 0)) }
}

// ---- Metrics ----

/** Share of the expected ids found in the top k (0 when nothing is expected). */
export function recallAt(ids: readonly string[], expect: readonly string[], k: number): number {
  if (expect.length === 0) return 0
  const top = new Set(ids.slice(0, k))
  return expect.filter(id => top.has(id)).length / expect.length
}

/** 1 / the rank of the first expected id (1-based), 0 when none is in the list. */
export function reciprocalRank(ids: readonly string[], expect: readonly string[]): number {
  const want = new Set(expect)
  const at = ids.findIndex(id => want.has(id))
  return at === -1 ? 0 : 1 / (at + 1)
}

/** Jaccard overlap of two top-k lists (1 for two empty lists). */
export function overlap(a: readonly string[], b: readonly string[], k: number): number {
  const x = new Set(a.slice(0, k))
  const y = new Set(b.slice(0, k))
  if (x.size === 0 && y.size === 0) return 1
  let both = 0
  for (const id of x) if (y.has(id)) both++
  return both / (x.size + y.size - both)
}

const mean = (values: readonly number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length)
const round = (n: number) => Math.round(n * 1000) / 1000

export type GoldScore = { queries: number; missing: number; recallAt1: number; recallAt5: number; recallAtK: number; hitAtK: number; mrr: number; worst: { query: string; owner: string; recallAtK: number }[] }

/** A run's scores on the gold set: mean recall@1, @5 and @k, the share with any hit in the top k, MRR, and the worst queries. */
export function goldScore(run: Run, gold: Gold): GoldScore {
  const byKey = new Map(run.results.map(result => [keyOf(result), result]))
  const rows = gold.queries.map(q => {
    const result = byKey.get(keyOf(q))
    const ids = result && result.error === undefined ? result.ids : []
    return { q, found: result !== undefined && result.error === undefined, r1: recallAt(ids, q.expect, 1), r5: recallAt(ids, q.expect, 5), rk: recallAt(ids, q.expect, run.k), hit: recallAt(ids, q.expect, run.k) > 0 ? 1 : 0, rr: reciprocalRank(ids, q.expect) }
  })
  return {
    queries: rows.length,
    missing: rows.filter(row => !row.found).length,
    recallAt1: round(mean(rows.map(row => row.r1))),
    recallAt5: round(mean(rows.map(row => row.r5))),
    recallAtK: round(mean(rows.map(row => row.rk))),
    hitAtK: round(mean(rows.map(row => row.hit))),
    mrr: round(mean(rows.map(row => row.rr))),
    worst: rows
      .filter(row => row.rk < 1)
      .sort((a, b) => a.rk - b.rk)
      .slice(0, 5)
      .map(row => ({ query: row.q.query, owner: row.q.owner, recallAtK: round(row.rk) })),
  }
}

export type Comparison = {
  shared: number
  onlyA: number
  onlyB: number
  top1Same: number
  overlapAt5: number
  overlapAtK: number
  changedTop1: { query: string; owner: string; a: string; b: string }[]
  gold?: { a: GoldScore; b: GoldScore }
}

/** Two runs side by side: on the queries both answered, how often the top hit is the same and how much the top 5 and top k overlap. */
export function compareRuns(a: Run, b: Run, gold?: Gold): Comparison {
  const bByKey = new Map(b.results.filter(r => r.error === undefined).map(r => [keyOf(r), r]))
  const aOk = a.results.filter(r => r.error === undefined)
  const pairs = aOk.flatMap(r => {
    const other = bByKey.get(keyOf(r))
    return other ? [[r, other] as const] : []
  })
  const k = Math.min(a.k, b.k)
  return {
    shared: pairs.length,
    onlyA: aOk.length - pairs.length,
    onlyB: bByKey.size - pairs.length,
    top1Same: round(mean(pairs.map(([x, y]) => (x.ids[0] === y.ids[0] ? 1 : 0)))),
    overlapAt5: round(mean(pairs.map(([x, y]) => overlap(x.ids, y.ids, 5)))),
    overlapAtK: round(mean(pairs.map(([x, y]) => overlap(x.ids, y.ids, k)))),
    changedTop1: pairs
      .filter(([x, y]) => x.ids[0] !== y.ids[0])
      .slice(0, 10)
      .map(([x, y]) => ({ query: x.query, owner: x.owner, a: x.ids[0] ?? '', b: y.ids[0] ?? '' })),
    ...(gold !== undefined && gold.queries.length > 0 ? { gold: { a: goldScore(a, gold), b: goldScore(b, gold) } } : {}),
  }
}

/** The weights from "0.5,0.3,0.2" (vector, keyword, importance); each 0 to 1. */
export function parseWeights(text: string): RecallWeights {
  const parts = text.split(',').map(part => Number(part.trim()))
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n) || n < 0 || n > 1)) throw new Error('--weights needs three numbers from 0 to 1: vector,keyword,importance (for example 0.5,0.3,0.2)')
  return { vector: parts[0]!, keyword: parts[1]!, importance: parts[2]! }
}

// ---- Files ----

export const evalDirOf = (root: string) => join(root, 'eval')

/** Writes a file 0600 inside a 0700 folder, by rename, so a reader never sees half of it. */
export function writePrivate(file: string, text: string) {
  const dir = join(file, '..')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  const temp = `${file}.${process.pid}.tmp`
  writeFileSync(temp, text, { mode: 0o600 })
  if (!IS_WINDOWS) chmodSync(temp, 0o600)
  renameSync(temp, file)
}

/** A copy of the store's database in a new temp folder (VACUUM INTO, the store untouched); the folder, for the engine and for removal. */
export function snapshotStore(store: string): string {
  const db = join(store, 'mnemopi.db')
  if (!existsSync(db)) throw new Error(`no store at ${db}`)
  const dir = mkdtempSync(join(tmpdir(), 'mnemosyne-eval-'))
  const source = new Database(db, { readonly: true })
  try {
    source.run(`VACUUM INTO '${join(dir, 'mnemopi.db').replace(/'/g, "''")}'`)
  } finally {
    source.close()
  }
  return dir
}

// ---- Replaying ----

export type ReplayOptions = { cli: string; store: string; mode: 'keyword' | 'hybrid'; k: number; weights: RecallWeights; modelCacheDir?: string; timeoutMs?: number }

/** One engine process per owner, all of that owner's queries in turn: each recall's ids and scores, or its error. */
export async function replay(queries: readonly { owner: string; query: string }[], options: ReplayOptions): Promise<RunResult[]> {
  const byOwner = new Map<string, { owner: string; query: string }[]>()
  for (const q of queries) byOwner.set(q.owner, [...(byOwner.get(q.owner) ?? []), q])
  const out: RunResult[] = []
  for (const [owner, list] of byOwner) {
    const requests = list.map(q => ['mnemopi_recall', { query: q.query, limit: options.k, update_recall_counts: false }] as const)
    const child = Bun.spawn([process.execPath, options.cli, 'mcp'], {
      env: { ...(process.env as Record<string, string>), ...engineEnv(options.store, owner, { embeddings: options.mode === 'hybrid', weights: options.weights, ...(options.modelCacheDir ? { modelCacheDir: options.modelCacheDir } : {}) }) },
      stdin: new Blob([buildRequests(requests)]),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 300_000)
    let answers: (string | Error)[]
    try {
      const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      answers = parseReplies(requests.length, stdout, exitCode, stderr)
    } finally {
      clearTimeout(timer)
    }
    list.forEach((q, i) => {
      const got = recallIds(answers[i] ?? new Error('no reply'))
      out.push(got instanceof Error ? { owner: q.owner, query: q.query, ids: [], scores: [], error: got.message.slice(0, 200) } : { owner: q.owner, query: q.query, ...got })
    })
  }
  return out
}

/** The memories' first lines, for a draft a person labels (from the snapshot, read-only). */
function previews(store: string, ids: readonly string[]): Map<string, string> {
  const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
  try {
    const out = new Map<string, string>()
    for (const id of new Set(ids)) {
      const row = db.query('SELECT substr(content, 1, 200) AS head FROM working_memory WHERE id = ?').get(id) as { head: string | null } | null
      if (row?.head) out.set(id, row.head.split('\n')[0]!.slice(0, 160))
    }
    return out
  } finally {
    db.close()
  }
}

// ---- The command line ----

type Args = { cmd: string; rest: string[]; flags: Map<string, string> }

function parseArgs(argv: readonly string[]): Args {
  const [cmd = '', ...tail] = argv
  const flags = new Map<string, string>()
  const rest: string[] = []
  for (let i = 0; i < tail.length; i++) {
    const arg = tail[i]!
    if (arg.startsWith('--')) {
      const value = tail[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`)
      flags.set(arg.slice(2), value)
      i++
    } else rest.push(arg)
  }
  return { cmd, rest, flags }
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))

function readQueries(file: string): Query[] {
  if (!existsSync(file)) return []
  return logLines(readFileSync(file, 'utf8')).flatMap(row => (typeof row.owner === 'string' && typeof row.query === 'string' ? [row as unknown as Query] : []))
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`

function scoreLines(label: string, s: GoldScore): string[] {
  return [`${label}: ${s.queries} gold queries${s.missing > 0 ? ` (${s.missing} not in the run)` : ''} · recall@1 ${pct(s.recallAt1)} · recall@5 ${pct(s.recallAt5)} · recall@k ${pct(s.recallAtK)} · hit@k ${pct(s.hitAtK)} · MRR ${s.mrr.toFixed(3)}`]
}

async function main(argv: readonly string[]) {
  const { cmd, rest, flags } = parseArgs(argv)
  const root = flags.get('root') ?? join(homedir(), '.claude', 'mnemosyne')
  const store = flags.get('store') ?? join(root, 'store')
  const dir = evalDirOf(root)
  const mode = (flags.get('mode') ?? 'keyword') as 'keyword' | 'hybrid'
  if (mode !== 'keyword' && mode !== 'hybrid') throw new Error('--mode is keyword or hybrid')
  if (mode === 'hybrid' && !existsSync(join(root, 'embeddings.json'))) throw new Error('hybrid needs embeddings: run /mnemosyne-setup (no embeddings.json in the root)')
  const cli = flags.get('cli') ?? engineCliOf(root)
  const k = Math.min(50, Math.max(1, Math.trunc(Number(flags.get('k') ?? 10)) || 10))
  const weights = flags.has('weights') ? parseWeights(flags.get('weights')!) : DEFAULT_RECALL_WEIGHTS
  const goldFile = flags.get('gold') ?? join(dir, 'gold.json')
  const gold = existsSync(goldFile) ? parseGold(readJson(goldFile)) : undefined

  if (cmd === 'capture') {
    const log = flags.get('log') ?? join(root, 'activity.jsonl')
    const text = [`${log}.1`, log].filter(existsSync).map(file => readFileSync(file, 'utf8')).join('\n')
    const origins = (flags.get('origins') ?? '').split(',').filter(Boolean)
    const queries = queriesOf(logLines(text), origins)
    const out = join(dir, 'queries.jsonl')
    writePrivate(out, queries.map(q => JSON.stringify(q)).join('\n') + (queries.length > 0 ? '\n' : ''))
    console.log(`${queries.length} distinct recall queries → ${out}`)
    return
  }

  if (cmd === 'run' || cmd === 'gold-draft') {
    if (!existsSync(cli)) throw new Error(`the engine is not installed at ${cli}: run /mnemosyne-setup`)
    const captured = readQueries(join(dir, 'queries.jsonl'))
    const top = cmd === 'gold-draft' ? Math.max(1, Math.trunc(Number(flags.get('top') ?? 30)) || 30) : Infinity
    const wanted = new Map<string, { owner: string; query: string }>()
    for (const q of captured.slice(0, top)) wanted.set(keyOf(q), { owner: q.owner, query: q.query })
    if (cmd === 'run') for (const q of gold?.queries ?? []) wanted.set(keyOf(q), { owner: q.owner, query: q.query })
    if (wanted.size === 0) throw new Error(`no queries: run "capture" first${cmd === 'run' ? ' or add a gold set' : ''}`)
    const snapshot = snapshotStore(store)
    try {
      const results = await replay([...wanted.values()], { cli, store: snapshot, mode, k, weights })
      if (cmd === 'gold-draft') {
        const heads = previews(snapshot, results.flatMap(r => r.ids))
        const draft = {
          version: 1,
          help: 'Copy the right ids of each query into "expect" (best first is not needed), delete queries you cannot judge, save as gold.json beside this file.',
          queries: results.map(r => ({ owner: r.owner, query: r.query, expect: [] as string[], candidates: r.ids.map((id, i) => ({ id, score: r.scores[i], text: heads.get(id) ?? '' })) })),
        }
        const out = join(dir, 'gold.draft.json')
        writePrivate(out, `${JSON.stringify(draft, null, 2)}\n`)
        console.log(`${results.length} queries with their top ${k} → ${out}`)
        return
      }
      const name = (flags.get('name') ?? `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}-${mode}`).replace(/[^\w.-]+/g, '-')
      const run: Run = { version: 1, name, created: new Date().toISOString(), mode, k, weights, results }
      const out = join(dir, 'runs', `${name}.json`)
      writePrivate(out, `${JSON.stringify(run, null, 2)}\n`)
      const failed = results.filter(r => r.error !== undefined).length
      console.log(`${results.length} queries replayed (${mode}, k=${k}, weights ${weights.vector}/${weights.keyword}/${weights.importance})${failed > 0 ? `, ${failed} failed` : ''} → ${out}`)
      if (gold && gold.queries.length > 0) for (const line of scoreLines('gold', goldScore(run, gold))) console.log(line)
    } finally {
      rmSync(snapshot, { recursive: true, force: true })
    }
    return
  }

  if (cmd === 'compare' || cmd === 'report') {
    const files = rest
    if (files.length !== (cmd === 'compare' ? 2 : 1)) throw new Error(cmd === 'compare' ? 'compare needs two run files' : 'report needs one run file')
    const runs = files.map(file => readJson(file) as Run)
    if (cmd === 'report') {
      if (!gold || gold.queries.length === 0) throw new Error(`no gold set at ${goldFile}: label one from gold.draft.json`)
      for (const line of scoreLines(runs[0]!.name, goldScore(runs[0]!, gold))) console.log(line)
      return
    }
    const c = compareRuns(runs[0]!, runs[1]!, gold)
    console.log(`${c.shared} shared queries${c.onlyA + c.onlyB > 0 ? ` (${c.onlyA} only in A, ${c.onlyB} only in B)` : ''} · top-1 same ${pct(c.top1Same)} · overlap@5 ${pct(c.overlapAt5)} · overlap@k ${pct(c.overlapAtK)}`)
    if (c.gold) for (const line of [...scoreLines(`A ${runs[0]!.name}`, c.gold.a), ...scoreLines(`B ${runs[1]!.name}`, c.gold.b)]) console.log(line)
    if (flags.get('json') === 'yes') console.log(JSON.stringify(c, null, 2))
    return
  }

  throw new Error('usage: bun bin/eval.ts capture | gold-draft | run | compare <a> <b> | report <run> [--root R] [--store S] [--mode keyword|hybrid] [--k K] [--weights V,K,I] [--gold F]')
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch(err => {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  })
}
