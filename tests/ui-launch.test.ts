// SRV.3: /mnemosyne-ui starts one shared dashboard server, opens its link in
// the default browser and shows it in the reply, reuses a live server, replaces a stale
// one, and its starting session's session.end ends the spawn loop and kills
// the server. Review r1 findings 1, 2, 3 and 8 have their tests here.
import { expect, mock, test } from 'claude-code/testing'
import type { On, ProcessRunInit } from 'claude-code'
import { ENGINE_BUILD } from '../hooks/register'
import {
  KILL_TIMEOUT_MS,
  LEAVE_TIMEOUT_MS,
  PING_TIMEOUT_MS,
  SESSION_END_BUDGET_MS,
  STOP_WAIT_MS,
  USERS_TIMEOUT_MS,
  USERS_TRIES,
} from '../hooks/ui-launch'
import { CLAUDE_PID_SCRIPT } from '../hooks/ui-pid'

const ROOT = '/home/u/.claude/mnemosyne'
const UI_JSON = `${ROOT}/ui.json`
const INSTALLED_PACKAGE = `${ROOT}/engine/node_modules/@oh-my-pi/pi-mnemopi/package.json`
const TOKEN_A = 'A'.repeat(43)
const TOKEN_B = 'B'.repeat(43)

type Spawned = { argv: readonly string[]; env?: Record<string, string>; input?: string; ended: boolean }
type Options = {
  bun?: boolean
  installed?: boolean
  build?: string
  copies?: boolean
  // The browser openers found on this machine (default: macOS `open`).
  openers?: string[]
  // What ui.json holds before any server of the test starts.
  state?: { port: number; token: string; pid: number }
  // What ui-extraction.json holds before any server of the test starts (the settings the running dashboard started with).
  startedWith?: { pid: number; extraction: string; embeddings?: string }
  // Exit code of the health ping.
  ping?: number
  // What the spawned holder does: print a ready line (in two pieces) and run, or fail first.
  server?: 'ready' | 'fails' | 'garbage'
  // The Claude pid the hook reads for its session (default 4242; 0: no claude above the hook's shell).
  claudePid?: number
  // How bin/ui-users.ts runs fail, per action: 'timeout' rejects as a timed-out run does, 'exit' exits 1;
  // a number fails that many runs of it and then succeeds.
  usersFail?: Partial<Record<'add' | 'leave', 'timeout' | 'exit' | number>>
  // What ui.json holds once a server of the test started (default: that server's own state).
  afterStart?: (pid: number) => { port: number; token: string; pid: number }
}

const isPing = (argv: readonly string[]) => argv[2] === '--ping'
const isKill = (argv: readonly string[]) => argv[0] === 'kill' && argv[1] !== '-0'
const OPENERS = ['open', 'xdg-open', 'cmd']

// The world beneath the plugin: Bun, an engine, ui.json in a variable, a
// clipboard, and a spawned server that writes ui.json then prints its ready
// line and runs until its loop ends.
function world(on: On, o: Options = {}) {
  const seen = {
    session: 's1',
    state: o.state as Options['state'],
    // The text of ui-extraction.json, as the hook last wrote it.
    startedWith: o.startedWith === undefined ? undefined : JSON.stringify(o.startedWith),
    // The script the hook ran to write it.
    startedWithScript: undefined as string | undefined,
    runs: [] as { argv: readonly string[]; init?: ProcessRunInit }[],
    // The ping's exit code, and whether `kill -0` finds a process.
    ping: o.ping ?? 0,
    alive: true,
    spawned: [] as Spawned[],
    copied: [] as string[],
    toasts: [] as string[],
    logs: [] as string[],
    registered: [] as string[],
    // ui-users.json as bin/ui-users.ts keeps it: session -> the Claude pid it was listed with ('-' when unknown).
    users: new Map<string, string>(),
    userCalls: [] as string[][],
    // The server pids `leave` sent SIGTERM to (it does so itself, when no live user is left).
    signalled: [] as number[],
    // Whether fs.read can read ui-users.json.
    usersReadable: true,
    // Whether the walk up the process tree times out this time.
    walkTimesOut: false,
  }
  const failures = new Map<string, number>()
  on('env.get', () => ({ value: '/home/u' }))
  on('session.id', () => ({ value: seen.session }))
  on('session.repo', () => ({ value: { root: '/w' } }) as never)
  on('fs.stat', (_$, e) =>
    o.installed === false || (e as { path: string }).path.endsWith('/embeddings.json') || (e as { path: string }).path.includes('/model-cache/')
      ? ({ deny: 'ENOENT' } as never)
      : ({ value: { kind: 'file' } } as never),
  )
  on('fs.read', (_$, e) => {
    if (e.path === INSTALLED_PACKAGE && o.installed !== false) return { value: JSON.stringify({ version: o.build ?? ENGINE_BUILD }) } as never
    if (e.path === UI_JSON && seen.state) return { value: JSON.stringify(seen.state) } as never
    if (e.path === `${ROOT}/ui-extraction.json` && seen.startedWith !== undefined) return { value: seen.startedWith } as never
    if (e.path === `${ROOT}/ui-users.json` && seen.usersReadable && seen.users.size > 0) {
      const users = [...seen.users].map(([session, pid]) => ({ session, pid: pid === '-' ? null : Number(pid), at: 1 }))
      return { value: JSON.stringify({ users }) } as never
    }
    return { deny: 'ENOENT' } as never
  })
  on('process.run', (_$, e) => {
    seen.runs.push(e)
    if (e.argv[0] === 'bun' && e.argv[1] === '--version') {
      if (o.bun === false) throw new Error('spawn bun ENOENT')
      return { value: { exitCode: 0, stdout: '1.4.3\n', stderr: '' } } as never
    }
    if (e.argv[0] === 'bun' && e.argv[1] === '-e' && e.argv[3] === `${ROOT}/ui-extraction.json`) {
      seen.startedWithScript = e.argv[2]
      seen.startedWith = e.argv[4]
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    }
    if (e.argv[0] === 'sh' && e.argv[2] === CLAUDE_PID_SCRIPT) {
      if (seen.walkTimesOut) throw new Error('process.run: timed out')
      // The walk as the real tree prints it: the hook host (Claude, comm a full path), then its shell.
      const pid = o.claudePid ?? 4242
      const chain = pid === 0 ? '700 1 /sbin/launchd\tlaunchd\n' : `${pid} 600 /Users/u/.local/bin/claude\tclaude --resume\n`
      return { value: { exitCode: 0, stdout: chain, stderr: '' } } as never
    }
    if (e.argv[0] === 'bun' && e.argv[1]?.endsWith('/bin/ui-users.ts')) {
      const [action, file, session, ...rest] = e.argv.slice(2) as [string, string, string, ...string[]]
      seen.userCalls.push([action, file, session, ...rest])
      const fail = o.usersFail?.[action as 'add' | 'leave']
      const failed = failures.get(action) ?? 0
      if (fail === 'timeout' || (typeof fail === 'number' && failed < fail)) {
        failures.set(action, failed + 1)
        throw new Error('process.run: timed out')
      }
      if (fail === 'exit') return { value: { exitCode: 1, stdout: '', stderr: 'ui-users: locked\n' } } as never
      if (action === 'add') {
        seen.users.set(session, rest[0]!)
        return { value: { exitCode: 0, stdout: `${JSON.stringify({ live: seen.users.size })}\n`, stderr: '' } } as never
      }
      const listed = seen.users.delete(session)
      const stopped: number[] = []
      if (seen.users.size === 0) for (const pid of new Set([...rest.map(Number), ...(seen.state ? [seen.state.pid] : [])])) stopped.push(pid)
      seen.signalled.push(...stopped)
      return { value: { exitCode: 0, stdout: `${JSON.stringify({ live: seen.users.size, listed, stopped })}\n`, stderr: '' } } as never
    }
    if (isPing(e.argv)) return { value: { exitCode: seen.ping, stdout: '', stderr: '' } } as never
    if (e.argv[0] === 'kill' && e.argv[1] === '-0') return { value: { exitCode: seen.alive ? 0 : 1, stdout: '', stderr: '' } } as never
    if (OPENERS.includes(e.argv[0]!)) {
      if (!(o.openers ?? ['open']).includes(e.argv[0]!)) throw new Error(`spawn ${e.argv[0]} ENOENT`)
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    }
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('process.spawn', async function* (_$: unknown, e: { argv: readonly string[]; env?: Record<string, string>; input?: string }, next: { signal?: AbortSignal }) {
    const child: Spawned = { argv: e.argv, env: e.env, input: e.input, ended: false }
    seen.spawned.push(child)
    try {
      if (o.server === 'fails') {
        yield { stream: 'stderr', text: 'mnemosyne ui: address in use\n' }
        return { value: { code: 1, signal: null } }
      }
      if (o.server === 'garbage') {
        yield { stream: 'stdout', text: 'not json\n' }
        await new Promise<void>(resolve => next.signal?.addEventListener('abort', () => resolve()))
        return { value: { code: 0, signal: null } }
      }
      const pid = 900 + seen.spawned.length
      // The server writes ui.json (with the token) before its ready line.
      seen.state = o.afterStart?.(pid) ?? { port: 4321, token: TOKEN_B, pid }
      yield { stream: 'stdout', text: '{"port":4321,' }
      yield { stream: 'stdout', text: `"pid":${pid}}\n` }
      // The child runs until the host kills it: the host aborts this signal when the loop is left.
      await new Promise<void>(resolve => next.signal?.addEventListener('abort', () => resolve()))
      return { value: { code: 0, signal: null } }
    } finally {
      child.ended = true
    }
  } as never)
  on('ui.copy', (_$, e) => {
    seen.copied.push((e as { text: string }).text)
    return { value: o.copies === false ? { isCopied: false, reason: 'no-clipboard' } : { isCopied: true } } as never
  })
  on('ui.toast', (_$, e) => {
    seen.toasts.push((e as { text: string }).text)
    return { value: undefined }
  })
  on('ui.log', (_$, e) => {
    seen.logs.push(JSON.stringify(e))
    return { value: undefined } as never
  })
  on('ui.status', () => ({ value: undefined }) as never)
  on('command.register', (_$, e) => {
    seen.registered.push((e as { name: string }).name)
    return { value: {} } as never
  })
  on('tool.register', () => ({ value: {} }) as never)
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }) as never)
  return seen
}

const textOf = (ran: unknown) => (ran as { text?: string }).text ?? ''
const pings = (seen: ReturnType<typeof world>) => seen.runs.filter(r => isPing(r.argv))
const kills = (seen: ReturnType<typeof world>) => seen.runs.filter(r => isKill(r.argv)).map(r => r.argv.join(' '))
const openUi = ($: { command: { run: (e: never) => Promise<unknown> } }) => $.command.run({ command: 'mnemosyne-ui', args: '' } as never)
const end = (sessionId: string, reason: string) => ({ reason, sessionId, resume: { id: sessionId } }) as never

test('/mnemosyne-ui appears in the command list after session start', async ($, on) => {
  const seen = world(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)
  expect(seen.registered).toContain('mnemosyne-ui')
  expect(seen.registered).toContain('mnemosyne-setup')
})

for (const [why, options, needle] of [
  ['without Bun', { bun: false }, 'Bun on PATH'],
  ['without the engine', { installed: false }, '/mnemosyne-setup'],
  ['with an engine that is not current', { build: '18.12.3' }, '/mnemosyne-setup'],
] as const) {
  test(`${why} the command says what to do and starts nothing`, async ($, on) => {
    const seen = world(on, options)
    const text = textOf(await openUi($))
    expect(text).toContain(needle)
    expect(seen.spawned.length).toBe(0)
    expect(seen.copied.length).toBe(0)
  })
}

test('the first call starts one server, reads the ready line in pieces and the token from ui.json, and copies the link', async ($, on) => {
  const seen = world(on)
  const text = textOf(await openUi($))

  expect(seen.spawned.length).toBe(1)
  const child = seen.spawned[0]!
  // The holder: it starts the server with stdin as a pipe it keeps open.
  expect(child.argv.slice(2)).toEqual(['--hold'])
  expect(child.argv[0]).toBe('bun')
  expect(child.argv[1]).toMatch(/\/ui\/server\.ts$/)
  expect(child.input).toBeUndefined()
  expect(child.env).toEqual({
    MNEMOSYNE_PLUGIN_ROOT: expect.any(String),
    MNEMOSYNE_ROOT: ROOT,
    MNEMOSYNE_STORE: `${ROOT}/store`,
    MNEMOSYNE_CLI: `${ROOT}/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts`,
    MNEMOSYNE_ACTIVITY_LOG: `${ROOT}/activity.jsonl`,
    MNEMOSYNE_EXTRACTION: 'haiku',
    // EMB.3.a2: this host is not macOS arm64, so the dashboard starts with embeddings off.
    MNEMOSYNE_EMBEDDINGS: 'off',
    // SRV: the settings page asks `claude plugin configure` about the plugin's options by this id.
    MNEMOSYNE_PLUGIN_ID: 'mnemosyne@mnemosyne',
  })
  expect(`${child.env?.MNEMOSYNE_PLUGIN_ROOT}/ui/server.ts`).toBe(child.argv[1]!)
  // No ui.json at first: nothing to ping.
  expect(pings(seen).length).toBe(0)

  expect(seen.copied).toEqual([`http://127.0.0.1:4321/#token=${TOKEN_B}`])
  // The default browser opens the full link, and the reply shows it.
  expect(seen.runs.filter(r => OPENERS.includes(r.argv[0]!)).map(r => r.argv)).toEqual([['open', `http://127.0.0.1:4321/#token=${TOKEN_B}`]])
  expect(seen.toasts).toEqual(['Mnemosyne dashboard opened in your browser.'])
  expect(text).toContain('Opened in your default browser')
  expect(text).toContain(`Link: http://127.0.0.1:4321/#token=${TOKEN_B}`)
  expect(seen.logs.some(line => line.includes(TOKEN_B))).toBe(false)
  // The loop runs on after the command returned.
  expect(child.ended).toBe(false)
  await $.session.end(end('s1', 'other'))
})

test('with activityLog off the server gets an empty MNEMOSYNE_ACTIVITY_LOG', { options: { activityLog: 'off' } }, async ($, on) => {
  const seen = world(on)
  await openUi($)
  expect(seen.spawned[0]?.env?.MNEMOSYNE_ACTIVITY_LOG).toBe('')
  await $.session.end(end('s1', 'other'))
})

test('on Linux the second opener opens the link, and a failed copy still leaves it in the reply', async ($, on) => {
  const seen = world(on, { copies: false, openers: ['xdg-open'] })
  const text = textOf(await openUi($))
  expect(seen.runs.filter(r => OPENERS.includes(r.argv[0]!)).map(r => r.argv[0])).toEqual(['open', 'xdg-open'])
  expect(text).toContain('Opened in your default browser')
  expect(text).not.toContain('clipboard')
  expect(text).toContain(`Link: http://127.0.0.1:4321/#token=${TOKEN_B}`)
  await $.session.end(end('s1', 'other'))
})

test('when no opener works the reply says so and still shows the link', async ($, on) => {
  const seen = world(on, { openers: [] })
  const text = textOf(await openUi($))
  expect(seen.runs.filter(r => OPENERS.includes(r.argv[0]!)).map(r => r.argv[0])).toEqual(OPENERS)
  expect(seen.toasts).toEqual(['Mnemosyne dashboard: open its link from the reply.'])
  expect(text).toContain('Could not open a browser')
  expect(text).toContain('the link is also on the clipboard')
  expect(text).toContain(`Link: http://127.0.0.1:4321/#token=${TOKEN_B}`)
  expect(seen.logs.some(line => line.includes(TOKEN_B))).toBe(false)
  await $.session.end(end('s1', 'other'))
})

test('a later call, from another session, pings the running server with the token and reuses it', async ($, on) => {
  const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 }, ping: 0 })
  seen.session = 's2'
  const text = textOf(await openUi($))

  const ping = pings(seen)[0]
  expect(ping?.argv[0]).toBe('bun')
  expect(ping?.argv[1]).toMatch(/\/ui\/server\.ts$/)
  // The port and the pid ui.json names (the reply must name that pid); never the token.
  expect(ping?.argv.slice(2)).toEqual(['--ping', '5555', '42'])
  // The token goes in on stdin, never on the command line.
  expect(ping?.init?.stdin).toBe(TOKEN_A)
  expect(ping?.argv.join(' ')).not.toContain(TOKEN_A)
  expect(ping?.init?.timeoutMs).toBe(PING_TIMEOUT_MS)
  expect(PING_TIMEOUT_MS).toBe(3_000)
  // Review r1 finding 1: the ping never goes through a proxy, which would see the token.
  expect(ping?.init?.env).toEqual({
    NO_PROXY: '127.0.0.1',
    no_proxy: '127.0.0.1',
    HTTP_PROXY: '',
    http_proxy: '',
    HTTPS_PROXY: '',
    https_proxy: '',
    ALL_PROXY: '',
    all_proxy: '',
  })
  expect(pings(seen).length).toBe(1)
  expect(seen.spawned.length).toBe(0)
  expect(seen.copied).toEqual([`http://127.0.0.1:5555/#token=${TOKEN_A}`])
  expect(text).toContain(`Link: http://127.0.0.1:5555/#token=${TOKEN_A}`)
})

test('a ui.json whose server does not answer (asked twice) is replaced by a new server', async ($, on) => {
  const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 }, ping: 1 })
  const text = textOf(await openUi($))
  expect(pings(seen).length).toBe(2)
  // Not this session's server: nothing of it is killed here.
  expect(kills(seen)).toEqual([])
  expect(seen.spawned.length).toBe(1)
  expect(seen.copied).toEqual([`http://127.0.0.1:4321/#token=${TOKEN_B}`])
  expect(text).toContain('http://127.0.0.1:4321/')
  await $.session.end(end('s1', 'other'))
})

test('a server that stops before its ready line is reported, and nothing is copied', async ($, on) => {
  const seen = world(on, { server: 'fails' })
  const text = textOf(await openUi($))
  expect(text).toContain('did not start')
  expect(text).toContain('address in use')
  expect(seen.copied.length).toBe(0)
})

for (const reason of ['clear', 'other', 'prompt_input_exit', 'logout', 'resume'] as const) {
  test(`the starting session's session.end (${reason}) ends the spawn loop at once; another session's does not`, async ($, on) => {
    const clock = mock.clock(on)
    const seen = world(on)
    await openUi($)
    const child = seen.spawned[0]!
    expect(child.ended).toBe(false)

    // Another session ends: the server stays.
    void $.session.end(end('s2', reason))
    await clock.settle()
    expect(child.ended).toBe(false)

    expect(kills(seen)).toEqual([])

    // The starter ends: the loop ends with the clock standing still, well inside the 1.5 s bound,
    // and the server (the ready line's pid) also gets a SIGTERM from `leave` (review r1 finding 8).
    const ending = $.session.end(end('s1', reason))
    await clock.settle()
    expect(child.ended).toBe(true)
    await ending
    expect(kills(seen)).toEqual([])
    expect(seen.signalled).toEqual([901])
    expect(seen.userCalls.at(-1)).toEqual(['leave', `${ROOT}/ui-users.json`, 's1', '901'])
  })
}

// Review r1 finding 2.
test('a missed ping does not kill this session\'s own server while its process is alive', async ($, on) => {
  const seen = world(on)
  await openUi($)
  const child = seen.spawned[0]!
  seen.ping = 1
  seen.alive = true
  const text = textOf(await openUi($))

  expect(pings(seen).length).toBe(2)
  expect(seen.runs.some(r => r.argv.join(' ') === 'kill -0 901')).toBe(true)
  expect(child.ended).toBe(false)
  expect(kills(seen)).toEqual([])
  expect(seen.spawned.length).toBe(1)
  // The same link again; the reply says the check was missed.
  expect(seen.copied).toEqual([`http://127.0.0.1:4321/#token=${TOKEN_B}`, `http://127.0.0.1:4321/#token=${TOKEN_B}`])
  expect(text).toContain('did not answer')
  await $.session.end(end('s1', 'other'))
})

test('this session\'s own server whose process is gone is stopped and replaced', async ($, on) => {
  const seen = world(on)
  await openUi($)
  const first = seen.spawned[0]!
  seen.ping = 1
  seen.alive = false
  await openUi($)

  expect(first.ended).toBe(true)
  expect(kills(seen)).toEqual(['kill 901'])
  expect(seen.spawned.length).toBe(2)
  expect(seen.spawned[1]!.ended).toBe(false)
  await $.session.end(end('s1', 'other'))
  expect(seen.spawned[1]!.ended).toBe(true)
})

test('this session\'s own live server is kept when ui.json names another, dead one', async ($, on) => {
  const seen = world(on)
  await openUi($)
  const first = seen.spawned[0]!
  // Another start overwrote ui.json, and that server is gone.
  seen.state = { port: 6000, token: TOKEN_A, pid: 77 }
  seen.ping = 1
  seen.alive = true
  await openUi($)

  expect(seen.runs.some(r => r.argv.join(' ') === 'kill -0 901')).toBe(true)
  expect(first.ended).toBe(false)
  expect(kills(seen)).toEqual([])
  expect(seen.spawned.length).toBe(2)
  await $.session.end(end('s1', 'other'))
  expect(first.ended).toBe(true)
  expect(seen.spawned[1]!.ended).toBe(true)
})

// Review r1 finding 3.
test('when ui.json names another live server once ours is ready, that one is handed over and ours is stopped', async ($, on) => {
  const other = { port: 6000, token: TOKEN_A, pid: 77 }
  const seen = world(on, { afterStart: () => other })
  const text = textOf(await openUi($))

  expect(seen.spawned.length).toBe(1)
  expect(seen.spawned[0]!.ended).toBe(true)
  expect(kills(seen)).toEqual(['kill 901'])
  expect(pings(seen).map(r => r.argv.slice(3))).toEqual([['6000', '77']])
  expect(seen.copied).toEqual([`http://127.0.0.1:6000/#token=${TOKEN_A}`])
  expect(text).toContain('http://127.0.0.1:6000/')
})

test('when ui.json names another server that does not answer, the start fails and only our own server is stopped', async ($, on) => {
  const seen = world(on, { afterStart: () => ({ port: 6000, token: TOKEN_A, pid: 77 }), ping: 1 })
  const text = textOf(await openUi($))

  expect(text).toContain('does not name the new server')
  expect(seen.spawned[0]!.ended).toBe(true)
  // The kill goes to our server only (901), never to the pid ui.json names (77).
  expect(kills(seen)).toEqual(['kill 901'])
  expect(seen.copied).toEqual([])
})

test('a ready line that is not JSON fails the start and ends its loop, with no kill (no pid known)', async ($, on) => {
  const seen = world(on, { server: 'garbage' })
  const text = textOf(await openUi($))
  expect(text).toContain('not a ready line')
  expect(seen.spawned[0]!.ended).toBe(true)
  expect(kills(seen)).toEqual([])
  expect(seen.copied).toEqual([])
})

// ---- KNOWX.2.a9 (R2 finding 11): a reused dashboard keeps the setting it started with ----

test('a started dashboard records the extraction and embeddings settings it started with, in a 0600 file written over a fresh temp', async ($, on) => {
  const seen = world(on)
  await openUi($)
  expect(JSON.parse(seen.startedWith ?? 'null')).toEqual({ pid: 901, extraction: 'haiku', embeddings: 'off' })
  // The temp file is removed first and written with mode 0600, as the other plugin files are.
  expect(seen.startedWithScript).toContain('rmSync')
  expect(seen.startedWithScript).toContain('0o600')
  await $.session.end(end('s1', 'other'))
})

test('a reused dashboard that started with the same setting says nothing about a restart', async ($, on) => {
  const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 }, startedWith: { pid: 42, extraction: 'haiku', embeddings: 'off' } })
  seen.session = 's2'
  const text = textOf(await openUi($))
  expect(text).toContain('Mnemosyne dashboard running')
  expect(text).not.toContain('restart')
})

test('a reused dashboard that started with another extractionModel says it must be restarted, and still gives the link', async ($, on) => {
  const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 }, startedWith: { pid: 42, extraction: 'off', embeddings: 'off' } })
  seen.session = 's2'
  const text = textOf(await openUi($))
  expect(text).toContain('started with extractionModel "off"')
  expect(text).toContain('extractionModel is "haiku" now')
  expect(text).toContain('end the session that started it, then run /mnemosyne-ui again')
  expect(text).toContain(`Link: http://127.0.0.1:5555/#token=${TOKEN_A}`)
})

test('EMB.3.a2: a reused dashboard whose embeddings setting differs says it must be restarted', async ($, on) => {
  const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 }, startedWith: { pid: 42, extraction: 'haiku', embeddings: 'on' } })
  seen.session = 's2'
  const text = textOf(await openUi($))
  // This test host is not macOS arm64, so the dashboard now starts with embeddings 'off'.
  expect(text).toContain('embeddings')
  expect(text).toContain('restart')
  expect(text).toContain(`Link: http://127.0.0.1:5555/#token=${TOKEN_A}`)
})

for (const [why, startedWith] of [
  ['no record', undefined],
  ['a record for another pid', { pid: 7, extraction: 'haiku' }],
] as const) {
  test(`a reused dashboard with ${why} is told to restart`, async ($, on) => {
    const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 }, ...(startedWith === undefined ? {} : { startedWith }) })
    seen.session = 's2'
    expect(textOf(await openUi($))).toContain('restart')
  })
}

// ---- The server stays up until every session that opened or reused it has ended ----

// The process runs made since `from` (fs.read is not a process run).
const runsSince = (seen: ReturnType<typeof world>, from: number) => seen.runs.slice(from).map(r => r.argv)
const USERS = `${ROOT}/ui-users.json`

test('the starter lists itself with a plain add (never a reset) and its Claude pid; a reusing session is listed too, again on each reuse', async ($, on) => {
  const seen = world(on)
  await openUi($)
  expect(seen.userCalls).toEqual([['add', USERS, 's1', '4242']])
  // The pid comes from the walk up the process tree, run as one shell.
  const walk = seen.runs.find(r => r.argv[0] === 'sh')
  expect(walk?.argv).toEqual(['sh', '-c', CLAUDE_PID_SCRIPT])
  seen.session = 's2'
  await openUi($)
  await openUi($)
  expect(seen.spawned.length).toBe(1)
  // Each reuse lists s2 again: bin/ui-users.ts gives it a fresh `at` (tests/bun/ui-users.spec.ts).
  expect(seen.userCalls.slice(1)).toEqual([
    ['add', USERS, 's2', '4242'],
    ['add', USERS, 's2', '4242'],
  ])
  expect([...seen.users.keys()]).toEqual(['s1', 's2'])
})

test('review r2 item 3: a pid lookup that times out on a reuse keeps the pid read before, never relists the session as unknown', async ($, on) => {
  const seen = world(on)
  await openUi($)
  seen.walkTimesOut = true
  await openUi($)
  expect(seen.userCalls).toEqual([
    ['add', USERS, 's1', '4242'],
    ['add', USERS, 's1', '4242'],
  ])
})

test('a pid that cannot be read (no claude above the hook) is listed as unknown, not guessed', async ($, on) => {
  const seen = world(on, { claudePid: 0 })
  await openUi($)
  expect(seen.userCalls).toEqual([['add', USERS, 's1', '-']])
})

test('review r1 finding 1: a slow first add is tried again, with a 3 s timeout each, so the session is listed', async ($, on) => {
  const seen = world(on, { usersFail: { add: 1 } })
  const text = textOf(await openUi($))
  const adds = seen.runs.filter(r => r.argv[1]?.endsWith('/bin/ui-users.ts'))
  expect(adds.length).toBe(2)
  expect(adds.map(r => r.init?.timeoutMs)).toEqual([USERS_TIMEOUT_MS, USERS_TIMEOUT_MS])
  expect(USERS_TIMEOUT_MS).toBeGreaterThanOrEqual(3_000)
  expect(USERS_TRIES).toBe(2)
  expect([...seen.users.keys()]).toEqual(['s1'])
  expect(text).not.toContain('could not be listed')
})

for (const fail of ['timeout', 'exit'] as const) {
  test(`review r1 finding 1: an add that fails every try (${fail}) is said in the reply`, async ($, on) => {
    const seen = world(on, { usersFail: { add: fail } })
    const text = textOf(await openUi($))
    expect(seen.userCalls.filter(call => call[0] === 'add').length).toBe(USERS_TRIES)
    expect(text).toContain('could not be listed')
    expect(text).toContain('Link: http://127.0.0.1:4321/')
  })
}

for (const fail of ['timeout', 'exit'] as const) {
  test(`review r1 finding 1: a leave with no answer (${fail}) is never read as "no one else": nothing is killed`, async ($, on) => {
    const clock = mock.clock(on)
    const seen = world(on, { usersFail: { leave: fail } })
    await openUi($)
    const child = seen.spawned[0]!
    const ending = $.session.end(end('s1', 'other'))
    await clock.settle()
    await ending
    // The holder goes; the server is left to its own poll of the list (it still names s1 while Claude runs).
    expect(child.ended).toBe(true)
    expect(kills(seen)).toEqual([])
    expect(seen.signalled).toEqual([])
    expect(seen.userCalls.filter(call => call[0] === 'leave').length).toBe(1)
  })

  test(`review r1 finding 1: a reusing last user whose leave has no answer (${fail}) kills nothing`, async ($, on) => {
    const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 }, usersFail: { leave: fail } })
    seen.session = 's2'
    await openUi($)
    await $.session.end(end('s2', 'other'))
    expect(kills(seen)).toEqual([])
    expect(seen.signalled).toEqual([])
  })
}

test('SHARE.1: the starter ends while another session still uses the server: its loop ends, the server is not signalled', async ($, on) => {
  const clock = mock.clock(on)
  const seen = world(on)
  await openUi($)
  const child = seen.spawned[0]!
  seen.session = 's2'
  await openUi($)

  const ending = $.session.end(end('s1', 'clear'))
  await clock.settle()
  expect(child.ended).toBe(true)
  await ending
  expect(kills(seen)).toEqual([])
  expect(seen.signalled).toEqual([])
  expect(seen.userCalls.at(-1)).toEqual(['leave', USERS, 's1', '901'])
  expect([...seen.users.keys()]).toEqual(['s2'])
})

test('SHARE.2: the last session ends, whoever started the server: its one leave stops the server ui.json names', async ($, on) => {
  const clock = mock.clock(on)
  const seen = world(on)
  await openUi($)
  seen.session = 's2'
  await openUi($)
  const first = $.session.end(end('s1', 'other'))
  await clock.settle()
  await first
  expect(seen.signalled).toEqual([])

  // s2 only reused the server and is the last user: `leave` (no server pid of its own) signals the one ui.json names.
  const from = seen.runs.length
  await $.session.end(end('s2', 'other'))
  expect(runsSince(seen, from)).toEqual([['bun', expect.stringMatching(/\/bin\/ui-users\.ts$/), 'leave', USERS, 's2']])
  expect(seen.signalled).toEqual([901])
  expect(seen.users.size).toBe(0)
})

test('review r1 finding 2: session.end is one leave run (no ping, no separate kill), bounded well inside the 1.5 s budget', async ($, on) => {
  const clock = mock.clock(on)
  const seen = world(on)
  await openUi($)
  seen.session = 's2'
  await openUi($)

  // The starter: one leave beside its loop's end.
  let from = seen.runs.length
  const starter = $.session.end(end('s1', 'other'))
  await clock.settle()
  await starter
  const starterRuns = seen.runs.slice(from)
  expect(starterRuns.length).toBe(1)
  expect(starterRuns[0]!.argv.slice(2)).toEqual(['leave', USERS, 's1', '901'])
  expect(starterRuns[0]!.init?.timeoutMs).toBe(LEAVE_TIMEOUT_MS)

  // The reusing last user: one leave, nothing else.
  from = seen.runs.length
  await $.session.end(end('s2', 'other'))
  const reuserRuns = seen.runs.slice(from)
  expect(reuserRuns.length).toBe(1)
  expect(reuserRuns[0]!.init?.timeoutMs).toBe(LEAVE_TIMEOUT_MS)
  expect(reuserRuns.some(r => isPing(r.argv) || isKill(r.argv))).toBe(false)

  // The loop's wait and the leave run side by side: the slower of the two, plus a margin for the fs.read.
  expect(SESSION_END_BUDGET_MS).toBe(1_500)
  expect(Math.max(LEAVE_TIMEOUT_MS, STOP_WAIT_MS)).toBeLessThanOrEqual(SESSION_END_BUDGET_MS - 400)
  expect(KILL_TIMEOUT_MS).toBeLessThan(SESSION_END_BUDGET_MS)
})

test('review r1 finding 6: a session listed in ui-users.json but unknown to this module (it was reloaded) still leaves and stops the server', async ($, on) => {
  const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 } })
  // An earlier load of this module listed s9; this one never saw it.
  seen.users.set('s9', '777')
  await $.session.end(end('s9', 'other'))
  expect(seen.userCalls).toEqual([['leave', USERS, 's9']])
  expect(seen.signalled).toEqual([42])
  expect(seen.users.size).toBe(0)
})

test('review r1 finding 6: with others still listed, a reloaded session only leaves', async ($, on) => {
  const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 } })
  seen.users.set('s9', '777')
  seen.users.set('s10', '778')
  await $.session.end(end('s9', 'other'))
  expect(seen.userCalls).toEqual([['leave', USERS, 's9']])
  expect(seen.signalled).toEqual([])
  expect([...seen.users.keys()]).toEqual(['s10'])
})

test('SHARE.4: /clear in the only session stops the server as before, and the next /mnemosyne-ui starts a new one', async ($, on) => {
  const clock = mock.clock(on)
  const seen = world(on)
  await openUi($)
  const ending = $.session.end(end('s1', 'clear'))
  await clock.settle()
  await ending
  expect(seen.signalled).toEqual([901])
  seen.session = 's1b'
  seen.state = undefined
  await openUi($)
  expect(seen.spawned.length).toBe(2)
  expect([...seen.users.keys()]).toEqual(['s1b'])
})

test('a session that never opened the dashboard ends with no process run at all', async ($, on) => {
  const clock = mock.clock(on)
  const seen = world(on)
  await openUi($)
  const from = seen.runs.length
  const ending = $.session.end(end('other-session', 'other'))
  await clock.settle()
  await ending
  expect(runsSince(seen, from)).toEqual([])
})

test('an unreadable ui-users.json, with nothing in memory, runs nothing and kills nothing', async ($, on) => {
  const seen = world(on, { state: { port: 5555, token: TOKEN_A, pid: 42 } })
  seen.users.set('s9', '777')
  seen.usersReadable = false
  await $.session.end(end('s9', 'other'))
  expect(seen.runs).toEqual([])
  expect(seen.signalled).toEqual([])
})
