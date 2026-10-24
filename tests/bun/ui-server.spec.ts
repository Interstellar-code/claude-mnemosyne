// SRV.1, SRV.2 and SRV.3: the dashboard server, run for real on 127.0.0.1
// against a temporary WAL store made by the real engine (engine/src/cli.ts),
// with a temporary <root> for ui.json. Every server a test starts is stopped
// by that test or by afterAll.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { engineEnv } from '../../hooks/engine'
import { buildApp, CSP, DEFAULT_PARENT_CHECK_MS, openStore, parentCheckMs, runEngine, startServer } from '../../ui/server'
import { engineCall, ROOT, tempDir, toolCall, isolatedEnv } from './helpers'

const SERVER = join(ROOT, 'ui', 'server.ts')
const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const FAST_PARENT_CHECK = '200'

type Ready = { port: number; pid: number }
type Child = ReturnType<typeof Bun.spawn>

const serverEnv = (root: string, store: string, extra: Record<string, string> = {}) => ({
  ...(process.env as Record<string, string>),
  ...isolatedEnv(),
  MNEMOSYNE_ROOT: root,
  MNEMOSYNE_STORE: store,
  MNEMOSYNE_CLI: CLI,
  MNEMOSYNE_ACTIVITY_LOG: '',
  MNEMOSYNE_PLUGIN_ROOT: ROOT,
  MNEMOSYNE_UI_PARENT_CHECK_MS: FAST_PARENT_CHECK,
  ...extra,
})

/** The first full line a process prints, parsed; pieces are buffered until a newline. */
async function firstLine(stream: ReadableStream<Uint8Array>): Promise<{ line: string; ready: Ready }> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (!text.includes('\n')) {
    const { value, done } = await reader.read()
    if (done) throw new Error(`no ready line; got: ${text}`)
    text += decoder.decode(value, { stream: true })
  }
  reader.releaseLock()
  const line = text.slice(0, text.indexOf('\n'))
  return { line, ready: JSON.parse(line) as Ready }
}

const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function until(check: () => boolean, ms: number) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (check()) return true
    await Bun.sleep(50)
  }
  return check()
}

/** One raw HTTP/1.1 request, bytes as written (no URL folding, any Host); status and headers. */
function raw(port: number, path: string, headers: Record<string, string> = {}, method = 'GET') {
  return new Promise<{ status: number; headers: Map<string, string>; body: string }>((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    let data = ''
    socket.setEncoding('utf8')
    socket.on('data', chunk => {
      data += chunk
    })
    socket.on('error', reject)
    socket.on('end', () => {
      const [head = '', body = ''] = data.split('\r\n\r\n')
      const [statusLine = '', ...lines] = head.split('\r\n')
      const map = new Map<string, string>()
      for (const line of lines) {
        const at = line.indexOf(':')
        map.set(line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim())
      }
      resolve({ status: Number(statusLine.split(' ')[1]), headers: map, body })
    })
    const all = { Host: `127.0.0.1:${port}`, Connection: 'close', ...headers }
    socket.write(`${method} ${path} HTTP/1.1\r\n${Object.entries(all).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`)
  })
}

function refused(host: string, port: number) {
  return new Promise<boolean>(resolve => {
    const socket = connect({ host, port })
    socket.setTimeout(2_000)
    socket.on('connect', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(true))
  })
}

// What hooks/ui-launch.ts gives the ping's process (PING_ENV; the kit test pins it there).
const HOOK_PING_ENV = {
  NO_PROXY: '127.0.0.1',
  no_proxy: '127.0.0.1',
  HTTP_PROXY: '',
  http_proxy: '',
  HTTPS_PROXY: '',
  https_proxy: '',
  ALL_PROXY: '',
  all_proxy: '',
}

/** The hook's health check, as it runs it: `bun ui/server.ts --ping <port> <pid>`, the token on stdin. */
async function runPing(port: number, pid: number, token: string, env: Record<string, string> = {}) {
  const child = Bun.spawn([process.execPath, SERVER, '--ping', String(port), String(pid)], { env: { ...isolatedEnv(), ...(process.env as Record<string, string>), ...env },
    stdin: new Blob([token]),
    stdout: 'ignore',
    stderr: 'ignore',
  })
  return child.exited
}

/** A listener on 127.0.0.1 that records every request it gets and answers `answer`. */
function listener(answer: (request: Request) => Response) {
  const seen: string[] = []
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      seen.push(`${request.method} ${request.url} ${request.headers.get('authorization') ?? ''}`)
      return answer(request)
    },
  })
  return { seen, port: server.port as number, stop: () => void server.stop(true) }
}

const expectStrictHeaders = (headers: { get(name: string): string | null } | Map<string, string>, what: string) => {
  const get = (name: string) => (headers instanceof Map ? headers.get(name.toLowerCase()) : headers.get(name)) ?? null
  expect({ what, csp: get('Content-Security-Policy') }).toEqual({ what, csp: CSP })
  expect({ what, referrer: get('Referrer-Policy') }).toEqual({ what, referrer: 'no-referrer' })
  expect({ what, nosniff: get('X-Content-Type-Options') }).toEqual({ what, nosniff: 'nosniff' })
  const names = headers instanceof Map ? [...headers.keys()] : [...(headers as Headers).keys()]
  expect({ what, cors: names.filter(name => name.toLowerCase().startsWith('access-control-allow')) }).toEqual({ what, cors: [] })
}

describe('the dashboard server on a real WAL store', () => {
  const temp = tempDir('ui')
  const root = join(temp.dir, 'root')
  const store = join(temp.dir, 'store')
  let child: Child
  let ready: Ready
  let readyLine = ''
  let token = ''
  let base = ''

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    // A store made by the real engine: two owners, one memory each.
    for (const owner of ['global', 'project-x']) {
      const replies = await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content: `fact of ${owner}`, source: 'imported', scope: 'global' })])
      if (replies.get(1)?.result?.isError !== false && replies.get(1)?.result === undefined) throw new Error(`engine remember failed: ${JSON.stringify(replies.get(1))}`)
    }
    child = Bun.spawn([process.execPath, SERVER], { env: serverEnv(root, store), stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
    const first = await firstLine(child.stdout as ReadableStream<Uint8Array>)
    ready = first.ready
    readyLine = first.line
    token = JSON.parse(readFileSync(join(root, 'ui.json'), 'utf8')).token
    base = `http://127.0.0.1:${ready.port}`
  }, 120_000)

  afterAll(async () => {
    child?.kill()
    await child?.exited
    temp.dispose()
  })

  const auth = () => ({ Authorization: `Bearer ${token}` })

  test('the store is a WAL-mode store made by the real engine', () => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      expect((db.query('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode).toBe('wal')
    } finally {
      db.close()
    }
  })

  test('SRV.2.a1: it binds 127.0.0.1 only, on an OS-chosen port, with a 32-byte random token', async () => {
    expect(ready.port).toBeGreaterThan(1024)
    expect(ready.pid).toBe(child.pid)
    expect(Buffer.from(token, 'base64url').length).toBe(32)
    expect((await fetch(`${base}/`)).status).toBe(200)
    expect(await refused('::1', ready.port)).toBe(true)
    const outside = Object.values(networkInterfaces())
      .flat()
      .find(address => address && address.family === 'IPv4' && !address.internal)
    if (outside) expect(await refused(outside.address, ready.port)).toBe(true)
  })

  test('SRV.3.a3: the ready line holds port and pid only, never the token', () => {
    expect(Object.keys(JSON.parse(readyLine)).sort()).toEqual(['pid', 'port'])
    expect(readyLine).not.toContain(token)
  })

  test('SRV.3.a4: ui.json is mode 0600 and holds port, token and pid', () => {
    const file = join(root, 'ui.json')
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ port: ready.port, token, pid: ready.pid })
  })

  test('SRV.2.a2: /api without the token, with a wrong one, or with it only in the query string gets 401 and no data', async () => {
    const wrong = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`
    for (const [what, url, headers] of [
      ['no token', `${base}/api/health`, {}],
      ['wrong token', `${base}/api/health`, { Authorization: `Bearer ${wrong}` }],
      ['short token', `${base}/api/health`, { Authorization: 'Bearer abc' }],
      ['not bearer', `${base}/api/health`, { Authorization: `Basic ${token}` }],
      ['query only', `${base}/api/health?token=${token}`, {}],
      ['fragment-style query', `${base}/api/health?#token=${token}`, {}],
      ['unknown route, no token', `${base}/api/memories`, {}],
    ] as const) {
      const response = await fetch(url, { headers })
      const body = await response.text()
      expect({ what, status: response.status }).toEqual({ what, status: 401 })
      expect({ what, leaks: body.includes(store) || body.includes('owners') }).toEqual({ what, leaks: false })
    }
    const ok = await fetch(`${base}/api/health`, { headers: auth() })
    expect(ok.status).toBe(200)
  })

  test('SRV.2.a3: a Host header other than 127.0.0.1:<port> gets 403', async () => {
    for (const host of ['evil.example', `evil.example:${ready.port}`, `localhost:${ready.port}`, `127.0.0.1:${ready.port + 1}`, '127.0.0.1']) {
      const page = await raw(ready.port, '/', { Host: host })
      expect({ host, status: page.status }).toEqual({ host, status: 403 })
      const api = await raw(ready.port, '/api/health', { Host: host, ...auth() })
      expect({ host, status: api.status }).toEqual({ host, status: 403 })
      expect(api.body).not.toContain(store)
    }
    expect((await raw(ready.port, '/', {})).status).toBe(200)
  })

  test('SRV.2.a4 and a5: every reply has the strict CSP, no-referrer and nosniff, and no CORS allow header', async () => {
    expect(CSP).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    )
    expect(CSP).not.toContain('unsafe-')
    const origin = { Origin: 'http://evil.example' }
    const replies: [string, Response][] = [
      ['page', await fetch(`${base}/`, { headers: origin })],
      ['index.html', await fetch(`${base}/index.html`)],
      ['app.js', await fetch(`${base}/app.js`, { headers: origin })],
      ['style.css', await fetch(`${base}/style.css`)],
      ['favicon', await fetch(`${base}/favicon.ico`)],
      ['health 200', await fetch(`${base}/api/health`, { headers: { ...auth(), ...origin } })],
      ['health 401', await fetch(`${base}/api/health`, { headers: origin })],
      ['404', await fetch(`${base}/nope`)],
      ['api 404', await fetch(`${base}/api/nope`, { headers: auth() })],
      ['POST page 405', await fetch(`${base}/`, { method: 'POST' })],
      ['POST health 405', await fetch(`${base}/api/health`, { method: 'POST', headers: auth() })],
      ['OPTIONS 405', await fetch(`${base}/api/health`, { method: 'OPTIONS', headers: { ...origin, 'Access-Control-Request-Method': 'GET' } })],
    ]
    for (const [what, response] of replies) expectStrictHeaders(response.headers, what)
    const forbidden = await raw(ready.port, '/', { Host: 'evil.example' })
    expectStrictHeaders(forbidden.headers, '403')
  })

  test('SRV.2.a5: OPTIONS gets 405 on every path', async () => {
    for (const path of ['/', '/api/health', '/app.js', '/vendor/x.js']) {
      const response = await fetch(`${base}${path}`, { method: 'OPTIONS', headers: { Origin: 'http://evil.example', ...auth() } })
      expect({ path, status: response.status }).toEqual({ path, status: 405 })
    }
  })

  test('SRV.2.a9: GET /favicon.ico gets 204 with no body', async () => {
    const response = await fetch(`${base}/favicon.ico`)
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  test('SRV.2.a7: index.html has no inline script or style and loads only same-origin files; /app.js is ui/app.ts built by Bun.build', async () => {
    const html = await (await fetch(`${base}/`)).text()
    expect(html).toBe(readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8'))
    expect(html).not.toMatch(/<style|style=|\son[a-z]+=/i)
    for (const [, body] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) expect(body).toBe('')
    const refs = [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)].map(match => match[1]!)
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) expect(ref).toMatch(/^\/(?!\/)/)
    const app = await fetch(`${base}/app.js`)
    expect(app.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expect(await app.text()).toBe(await buildApp())
    expect((await fetch(`${base}/style.css`)).headers.get('content-type')).toBe('text/css; charset=utf-8')
  })

  test('the health route reads the owners from the store through the read-only handle', async () => {
    const health = (await (await fetch(`${base}/api/health`, { headers: auth() })).json()) as { owners: unknown }
    expect(health).toMatchObject({ ok: true, pid: ready.pid, store, total: 2 })
    expect(health.owners).toEqual([
      { owner: 'global', count: 1 },
      { owner: 'project-x', count: 1 },
    ])
  })

  test('SRV.2.a6: the database handle is read-only: a write through it fails and the store is unchanged', () => {
    const db = openStore(store)
    expect(db).not.toBeNull()
    try {
      const before = (db!.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n
      expect(() => db!.run("INSERT INTO working_memory (id, content) VALUES ('x', 'y')")).toThrow()
      expect(() => db!.run('DELETE FROM working_memory')).toThrow()
      expect(() => db!.run("UPDATE working_memory SET content = 'z'")).toThrow()
      expect((db!.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n).toBe(before)
    } finally {
      db!.close()
    }
    expect(openStore(join(temp.dir, 'no-such-store'))).toBeNull()
  })

  test('review r1 finding 1: the ping never goes through a proxy, even when HTTP_PROXY points at one', async () => {
    const proxy = listener(() => new Response('proxied'))
    try {
      const url = `http://127.0.0.1:${proxy.port}`
      const proxies = { HTTP_PROXY: url, http_proxy: url, HTTPS_PROXY: url, https_proxy: url, ALL_PROXY: url, all_proxy: url }
      // The ping on its own (no hook environment), then with the hook's environment laid over.
      expect(await runPing(ready.port, ready.pid, token, proxies)).toBe(0)
      expect(await runPing(ready.port, ready.pid, token, { ...proxies, ...HOOK_PING_ENV })).toBe(0)
      expect(proxy.seen).toEqual([])
    } finally {
      proxy.stop()
    }
  })

  test('review r1 finding 4: the ping counts only a 200 naming the pid ui.json names, and follows no redirect', async () => {
    expect(await runPing(ready.port, ready.pid, token)).toBe(0)
    expect(await runPing(ready.port, ready.pid + 1, token)).toBe(1)
    expect(await runPing(ready.port, ready.pid, `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`)).toBe(1)
    // A foreign server on the port that answers 200 to anything.
    const foreign = listener(() => Response.json({ ok: true, pid: 4242 }))
    const notJson = listener(() => new Response('ok'))
    // One that redirects, on its own origin, to a reply that would pass.
    const redirect = listener(request =>
      new URL(request.url).pathname === '/api/health' ? new Response(null, { status: 302, headers: { Location: '/elsewhere' } }) : Response.json({ ok: true, pid: ready.pid }),
    )
    try {
      expect(await runPing(foreign.port, ready.pid, token)).toBe(1)
      expect(await runPing(notJson.port, ready.pid, token)).toBe(1)
      expect(await runPing(redirect.port, ready.pid, token)).toBe(1)
      expect(redirect.seen.length).toBe(1)
      // Nothing listening: fails rather than hangs.
      expect(await runPing(1, ready.pid, token)).toBe(1)
    } finally {
      foreign.stop()
      notJson.stop()
      redirect.stop()
    }
  })

  test('SRV.3.a9: there is no stop route', async () => {
    for (const path of ['/api/stop', '/api/shutdown', '/api/exit']) {
      for (const method of ['GET', 'POST']) {
        const response = await fetch(`${base}${path}`, { method, headers: auth() })
        expect({ path, method, status: response.status }).toEqual({ path, method, status: 404 })
      }
    }
    expect(isAlive(ready.pid)).toBe(true)
  })
})

describe('/vendor/ serves plain file names only', () => {
  const temp = tempDir('ui-vendor')
  const vendorDir = join(temp.dir, 'ui', 'vendor')
  let stop = () => {}
  let port = 0

  beforeAll(async () => {
    mkdirSync(vendorDir, { recursive: true })
    writeFileSync(join(vendorDir, 'lib.js'), 'export const x = 1\n')
    writeFileSync(join(vendorDir, 'notes.md'), 'not served')
    // Outside ui/vendor/, with an extension /vendor/ serves: only the name check keeps it out.
    writeFileSync(join(temp.dir, 'ui', 'secret.js'), 'secret')
    // Links in the vendor folder: to a file outside it, and to a file inside it.
    symlinkSync(join(temp.dir, 'ui', 'secret.js'), join(vendorDir, 'link.js'))
    symlinkSync(join(vendorDir, 'lib.js'), join(vendorDir, 'alias.js'))
    mkdirSync(join(vendorDir, 'dir.js'))
    const started = await startServer(
      { root: join(temp.dir, 'root'), store: join(temp.dir, 'store'), cli: CLI, activityLog: '', pluginRoot: ROOT },
      { vendorDir },
    )
    stop = started.stop
    port = started.port
  })
  afterAll(() => {
    stop()
    temp.dispose()
  })

  test('a vendor .js file is served as text/javascript with the strict headers', async () => {
    const response = await raw(port, '/vendor/lib.js')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
    expectStrictHeaders(response.headers, 'vendor js')
  })

  test('no path escapes ui/vendor/, and other extensions are 404', async () => {
    for (const path of [
      '/vendor/../server.ts',
      '/vendor/..%2fserver.ts',
      '/vendor/..%2Fsecret.js',
      '/vendor/%2e%2e/secret.js',
      '/vendor/%2e%2e%2fsecret.js',
      '/vendor/..\\secret.js',
      '/vendor/..%5csecret.js',
      '/vendor/./lib.js/..',
      '/vendor/sub/lib.js',
      '/vendor/.hidden.js',
      '/vendor/notes.md',
      '/vendor/',
      '/server.ts',
      '/secret.js',
      // Review r1 finding 5: a link or a folder is never served, wherever it points.
      '/vendor/link.js',
      '/vendor/alias.js',
      '/vendor/dir.js',
    ]) {
      const response = await raw(port, path)
      expect({ path, status: response.status }).toEqual({ path, status: 404 })
      expect(response.body).not.toContain('secret')
    }
  })
})

describe('the server ends with what started it', () => {
  test('SRV.3.a9: it exits when its stdin closes, and removes its own ui.json', async () => {
    const temp = tempDir('ui-stdin')
    const root = join(temp.dir, 'root')
    const child = Bun.spawn([process.execPath, SERVER], { env: serverEnv(root, join(temp.dir, 'store')), stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
    try {
      const { ready } = await firstLine(child.stdout as ReadableStream<Uint8Array>)
      expect(existsSync(join(root, 'ui.json'))).toBe(true)
      await (child.stdin as import('bun').FileSink).end()
      expect(await until(() => !isAlive(ready.pid), 5_000)).toBe(true)
      expect(existsSync(join(root, 'ui.json'))).toBe(false)
      expect(await refused('127.0.0.1', ready.port)).toBe(true)
    } finally {
      child.kill()
      temp.dispose()
    }
  })

  test('review r1 finding 6: MNEMOSYNE_UI_PARENT_CHECK_MS is held to 100 ms - 10 s', () => {
    expect(parentCheckMs(undefined)).toBe(10_000)
    expect(parentCheckMs('')).toBe(10_000)
    expect(parentCheckMs('soon')).toBe(10_000)
    expect(parentCheckMs('0')).toBe(100)
    expect(parentCheckMs('-5')).toBe(100)
    expect(parentCheckMs('5')).toBe(100)
    expect(parentCheckMs('200')).toBe(200)
    expect(parentCheckMs('86400000')).toBe(10_000)
    expect(parentCheckMs('Infinity')).toBe(10_000)
  })

  test('SRV.3.a9: it exits when its parent is gone, with its stdin still open', async () => {
    expect(DEFAULT_PARENT_CHECK_MS).toBe(10_000)
    const temp = tempDir('ui-parent')
    const root = join(temp.dir, 'root')
    // The server's stdin is a FIFO this test holds open (read-write, so it never
    // reads end of file); its parent starts it with that stdin and is killed.
    const fifo = join(temp.dir, 'stdin.fifo')
    expect(Bun.spawnSync(['mkfifo', fifo]).exitCode).toBe(0)
    const held = openSync(fifo, 'r+')
    const parent = Bun.spawn(
      [process.execPath, '-e', `const c = Bun.spawn([process.execPath, ${JSON.stringify(SERVER)}], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }); await c.exited`],
      { env: serverEnv(root, join(temp.dir, 'store')), stdin: held, stdout: 'pipe', stderr: 'inherit' },
    )
    let pid = 0
    try {
      const { ready } = await firstLine(parent.stdout as ReadableStream<Uint8Array>)
      pid = ready.pid
      expect(isAlive(pid)).toBe(true)
      parent.kill('SIGKILL')
      await parent.exited
      // stdin is still open: only the parent check can end it.
      expect(await until(() => !isAlive(pid), 5_000)).toBe(true)
      expect(existsSync(join(root, 'ui.json'))).toBe(false)
    } finally {
      if (pid && isAlive(pid)) process.kill(pid, 'SIGKILL')
      closeSync(held)
      temp.dispose()
    }
  })

  test('SRV.3.a3: the holder, started with stdin closed as the host does, keeps the server up; killing it ends the server', async () => {
    const temp = tempDir('ui-hold')
    const root = join(temp.dir, 'root')
    const holder = Bun.spawn([process.execPath, SERVER, '--hold'], { env: serverEnv(root, join(temp.dir, 'store')), stdin: 'ignore', stdout: 'pipe', stderr: 'inherit' })
    let pid = 0
    try {
      const { ready } = await firstLine(holder.stdout as ReadableStream<Uint8Array>)
      pid = ready.pid
      expect(pid).not.toBe(holder.pid)
      // Its stdin was closed from the start, and the server still runs and answers.
      await Bun.sleep(500)
      expect(isAlive(pid)).toBe(true)
      expect((await fetch(`http://127.0.0.1:${ready.port}/favicon.ico`)).status).toBe(204)
      // The host ends the loop: the holder is killed (SIGKILL: no handler runs), the server's stdin closes.
      holder.kill('SIGKILL')
      expect(await until(() => !isAlive(pid), 5_000)).toBe(true)
      expect(existsSync(join(root, 'ui.json'))).toBe(false)
    } finally {
      if (pid && isAlive(pid)) process.kill(pid, 'SIGKILL')
      holder.kill('SIGKILL')
      temp.dispose()
    }
  })

  test('an orphaned holder takes its server down', async () => {
    const temp = tempDir('ui-orphan')
    const root = join(temp.dir, 'root')
    const parent = Bun.spawn(
      [process.execPath, '-e', `const c = Bun.spawn([process.execPath, ${JSON.stringify(SERVER)}, '--hold'], { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' }); console.error('holder', c.pid); await c.exited`],
      { env: serverEnv(root, join(temp.dir, 'store')), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
    )
    let pid = 0
    try {
      const { ready } = await firstLine(parent.stdout as ReadableStream<Uint8Array>)
      pid = ready.pid
      parent.kill('SIGKILL')
      expect(await until(() => !isAlive(pid), 5_000)).toBe(true)
    } finally {
      if (pid && isAlive(pid)) process.kill(pid, 'SIGKILL')
      temp.dispose()
    }
  })

  test('SRV.3.a4: on exit it leaves a ui.json that names another server', async () => {
    const temp = tempDir('ui-other')
    const root = join(temp.dir, 'root')
    const child = Bun.spawn([process.execPath, SERVER], { env: serverEnv(root, join(temp.dir, 'store')), stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
    try {
      const { ready } = await firstLine(child.stdout as ReadableStream<Uint8Array>)
      const newer = { port: 1, token: 'x'.repeat(43), pid: ready.pid + 100_000 }
      writeFileSync(join(root, 'ui.json'), JSON.stringify(newer))
      child.kill('SIGTERM')
      expect(await until(() => !isAlive(ready.pid), 5_000)).toBe(true)
      expect(JSON.parse(readFileSync(join(root, 'ui.json'), 'utf8'))).toEqual(newer)
    } finally {
      child.kill()
      temp.dispose()
    }
  })
})

describe('SRV.1: the server runs the engine as the hooks do', () => {
  // What the kit test in tests/register.test.ts expects the hooks to send for owner global.
  const HOOK_ENV = (store: string) => ({
    MNEMOPI_DATA_DIR: store,
    MNEMOPI_SESSION_ID: 'global',
    MNEMOPI_CHANNEL_ID: 'global',
    MNEMOPI_NO_EMBEDDINGS: '1',
    MNEMOPI_MCP_BANK: 'default',
    MNEMOPI_LLM_BASE_URL: '',
    MNEMOPI_HOST_LLM_ENABLED: '',
    MNEMOPI_AUTHOR_ID: '',
    MNEMOPI_AUTHOR_TYPE: '',
    MNEMOPI_POLYPHONIC_RECALL: '0',
    // EMB.3.a1: the local-only embedding pins; MNEMOSYNE_EMBEDDINGS absent means off.
    MNEMOPI_EMBEDDING_API_URL: '',
    MNEMOPI_EMBEDDINGS_VIA_API: '',
    MNEMOPI_EMBEDDING_API_KEY: '',
    MNEMOPI_EMBEDDING_MODEL: 'BAAI/bge-small-en-v1.5',
    MNEMOPI_EMBEDDING_DIM: '',
    OPENROUTER_BASE_URL: '',
    OPENROUTER_API_KEY: '',
    OPENAI_API_KEY: '',
    MNEMOPI_EMBEDDINGS_API_OPT_IN: '0',
    HF_ENDPOINT: 'https://huggingface.co',
    PI_CONFIG_DIR: '.claude/mnemosyne/model-cache',
  })

  test('its own environment with engineEnv laid over it; the variables match the hooks for the same owner', async () => {
    const temp = tempDir('ui-env')
    try {
      // A stand-in engine that answers each call with the environment it got.
      const fake = join(temp.dir, 'fake-cli.ts')
      writeFileSync(
        fake,
        `const lines = (await Bun.stdin.text()).split('\\n').filter(Boolean)
const PINNED = new Set(['PI_CONFIG_DIR','HF_ENDPOINT','OPENROUTER_BASE_URL','OPENROUTER_API_KEY','OPENAI_API_KEY','KEEP_ME'])
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('MNEMOPI_') || PINNED.has(k)))
for (const line of lines) {
  const { id } = JSON.parse(line)
  console.log(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify({ argv: process.argv.slice(2), env }) }] } }))
}
`,
      )
      const store = join(temp.dir, 'store')
      const base = { ...(process.env as Record<string, string>), KEEP_ME: 'yes', MNEMOPI_MCP_BANK: 'evil', MNEMOPI_LLM_BASE_URL: 'http://evil.example', MNEMOPI_SESSION_ID: 'someone-else' }
      const [answer] = await runEngine({ cli: fake, store }, [['mnemopi_stats', {}]], 'global', base)
      expect(typeof answer).toBe('string')
      const seen = JSON.parse(answer as string)
      expect(seen.argv).toEqual(['mcp'])
      const { KEEP_ME, ...engineVars } = seen.env
      expect(KEEP_ME).toBe('yes')
      expect(engineVars).toEqual(HOOK_ENV(store))
      expect(engineVars).toEqual(engineEnv(store, 'global'))
      const [project] = await runEngine({ cli: fake, store }, [['mnemopi_stats', {}]], 'project-x', base)
      const { KEEP_ME: _, ...projectVars } = JSON.parse(project as string).env
      expect(projectVars).toEqual(engineEnv(store, 'project-x'))
    } finally {
      temp.dispose()
    }
  })

  test('against the real engine it gets the tool text, and the engine error as an Error', async () => {
    const temp = tempDir('ui-engine')
    try {
      const store = join(temp.dir, 'store')
      mkdirSync(store, { recursive: true })
      const [stats, bad] = await runEngine({ cli: CLI, store }, [['mnemopi_stats', {}], ['mnemopi_no_such_tool', {}]], 'global')
      expect(typeof stats).toBe('string')
      expect(JSON.parse(stats as string)).toHaveProperty('working')
      expect(bad).toBeInstanceOf(Error)
    } finally {
      temp.dispose()
    }
  })
})
