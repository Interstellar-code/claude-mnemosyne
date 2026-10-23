// The Mnemosyne dashboard server (DESIGN.md, "The dashboard server").
//
// Runs under Bun on 127.0.0.1, on a port the OS picks, behind a random token
// it makes itself. The page shell, its script and its style load without the
// token and hold no data; every /api route wants `Authorization: Bearer
// <token>`. Every reply carries a strict CSP and no CORS allow header. SQLite
// is opened read-only; every change goes through the engine (hooks/engine.ts).
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
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
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

// What /vendor/ serves, by extension; anything else is 404.
const VENDOR_TYPES: Readonly<Record<string, string>> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

export const DEFAULT_PARENT_CHECK_MS = 10_000
export const MIN_PARENT_CHECK_MS = 100
export const PING_FETCH_TIMEOUT_MS = 2_500
// A proxy would see the token: the ping never uses one, whatever the environment says.
export const PROXY_VARIABLES = ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy'] as const
export const ENGINE_TIMEOUT_MS = 20_000

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
): Promise<(string | Error)[]> {
  const child = Bun.spawn([process.execPath, config.cli, 'mcp'], {
    env: { ...baseEnv, ...engineEnv(config.store, owner) },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const timer = setTimeout(() => child.kill(), ENGINE_TIMEOUT_MS)
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
  const built = await Bun.build({ entrypoints: [join(UI_DIR, 'app.ts')], target: 'browser', format: 'esm', minify: true })
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

function health(config: Config, store: Store) {
  store.db ??= openStore(config.store)
  const base = { ok: true, pid: process.pid, store: config.store }
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

export type Started = { port: number; token: string; stop: () => void }

// Starts the HTTP server; the caller writes ui.json and the ready line.
export async function startServer(config: Config, options: { vendorDir?: string } = {}): Promise<Started> {
  const vendorDir = options.vendorDir ?? VENDOR_DIR
  const token = randomBytes(32).toString('base64url')
  const page = readFileSync(join(UI_DIR, 'index.html'))
  const style = readFileSync(join(UI_DIR, 'style.css'))
  const app = await buildApp()
  const store: Store = { db: null }
  let host = ''

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
    fetch(request) {
      // DNS rebinding: a page on another name that resolves here is refused.
      if (request.headers.get('host') !== host) return json({ error: 'forbidden' }, 403)
      if (request.method === 'OPTIONS') return notAllowed()
      const path = new URL(request.url).pathname
      if (path === '/api' || path.startsWith('/api/')) {
        // The token only ever counts in the header: never in the query string.
        if (!hasToken(request, token)) return json({ error: 'unauthorized' }, 401)
        if (path === '/api/health') return request.method === 'GET' ? json(health(config, store)) : notAllowed()
        return notFound()
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
