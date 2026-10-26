// SHARE: the dashboard server stays up until every session that opened or reused it has ended.
// bin/ui-users.ts (the list in <root>/ui-users.json, its lock, `leave`) on its own and as the script the
// hooks run, hooks/ui-pid.ts (finding the Claude process), then the real server (as ui-server.spec.ts
// runs it, over a temp root) with real processes standing in for the Claude sessions. The hooks' side
// (listing a session, session.end) is in tests/ui-launch.test.ts. Review r1 findings 1-6 have tests here.
import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ADD_LOCK_WAIT_MS,
  LOCK_STALE_MS,
  LOCK_WAIT_MS,
  leaveUsers,
  liveUsers,
  lockIsStale,
  processStart,
  readUsers,
  UI_USERS,
  UNKNOWN_PID_MAX_MS,
  updateUsers,
  withLock,
} from '../../bin/ui-users'
import { CLAUDE_PID_SCRIPT, claudeFromChain, isClaude, parseChain } from '../../hooks/ui-pid'
import { isolatedEnv, ROOT, tempDir } from './helpers'

const SERVER = join(ROOT, 'ui', 'server.ts')
const SCRIPT = join(ROOT, 'bin', 'ui-users.ts')
const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
// hooks/ui-launch.ts: what the hook gives one `leave` run at session.end (its 1.5 s budget in all).
const LEAVE_TIMEOUT_MS = 1_000

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
const env = () => ({ ...(process.env as Record<string, string>), ...isolatedEnv() })
/** The script as the hooks run it. */
const run = (...args: string[]) => {
  const ran = Bun.spawnSync([process.execPath, SCRIPT, ...args], { env: env() })
  return { code: ran.exitCode, out: ran.stdout.toString().trim(), err: ran.stderr.toString().trim() }
}
/** A pid that is certainly gone: a process that ran and was reaped. */
const deadPid = () => {
  const gone = Bun.spawnSync(['true'], { env: { ...(process.env as Record<string, string>), ...isolatedEnv() } })
  return gone.pid
}

describe('bin/ui-users.ts: the list of sessions using the server', () => {
  const temp = tempDir('ui-users')
  let n = 0
  const fresh = () => join(temp.dir, `root${++n}`, UI_USERS)
  const NOW = 1_000_000_000_000
  const user = (session: string, pid: number | null = 100, at = NOW) => ({ session, pid, at })

  test('add lists a session, a second add of it replaces it, remove drops it; the file is 0600', () => {
    const file = fresh()
    expect(updateUsers(file, { add: user('a', 100) }, NOW, () => true).map(u => u.session)).toEqual(['a'])
    expect(updateUsers(file, { add: user('b', 200) }, NOW, () => true).map(u => u.session)).toEqual(['a', 'b'])
    expect(updateUsers(file, { add: user('a', 101) }, NOW, () => true)).toEqual([user('b', 200), user('a', 101)])
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(updateUsers(file, { remove: 'a' }, NOW, () => true)).toEqual([user('b', 200)])
    expect(existsSync(`${file}.${process.pid}.tmp`)).toBe(false)
    expect(existsSync(`${file}.lock`)).toBe(false)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ users: [user('b', 200)] })
  })

  test('add drops every user whose process is gone; liveUsers leaves them out', () => {
    const file = fresh()
    updateUsers(file, { add: user('a', 100) }, NOW, () => true)
    updateUsers(file, { add: user('b', 200) }, NOW, () => true)
    const alive = (pid: number) => pid === 200
    expect(liveUsers(file, NOW, alive).map(u => u.session)).toEqual(['b'])
    // The file still names both until something changes it.
    expect(readUsers(file).map(u => u.session)).toEqual(['a', 'b'])
    expect(updateUsers(file, { add: user('c', 200) }, NOW, alive).map(u => u.session)).toEqual(['b', 'c'])
  })

  test('review r1 finding 3: a session that reused a just-started server before its starter listed itself stays listed', () => {
    const file = fresh()
    // B pings the new server (its ui.json is written) and lists itself; then A, the starter, lists itself.
    updateUsers(file, { add: user('b', 200, NOW) }, NOW, () => true)
    updateUsers(file, { add: user('a', 100, NOW + 5) }, NOW + 5, () => true)
    expect(readUsers(file).map(u => u.session)).toEqual(['b', 'a'])
    // A ends: B is still a live user, so nothing is stopped.
    const stopped: number[] = []
    const left = leaveUsers(file, 'a', [901], NOW + 9, () => true, pid => (stopped.push(pid), true))
    expect(left).toEqual({ live: 1, listed: true, stopped: [] })
    expect(stopped).toEqual([])
  })

  test('review r1 finding 5: a user with no pid counts for 2 hours from its last listing, and listing again refreshes it', () => {
    const file = fresh()
    expect(UNKNOWN_PID_MAX_MS).toBe(2 * 60 * 60 * 1000)
    updateUsers(file, { add: user('u', null, NOW) }, NOW, () => false)
    expect(liveUsers(file, NOW + UNKNOWN_PID_MAX_MS - 1, () => false).length).toBe(1)
    expect(liveUsers(file, NOW + UNKNOWN_PID_MAX_MS, () => false).length).toBe(0)
    // The session reuses the dashboard after 90 minutes: it is listed again with a fresh `at`.
    const later = NOW + 90 * 60 * 1000
    updateUsers(file, { add: user('u', null, later) }, later, () => false)
    expect(liveUsers(file, NOW + UNKNOWN_PID_MAX_MS + 1, () => false).length).toBe(1)
    expect(liveUsers(file, later + UNKNOWN_PID_MAX_MS, () => false).length).toBe(0)
  })

  test('a missing, broken or malformed file is no users', () => {
    const file = fresh()
    expect(liveUsers(join(temp.dir, 'nothing.json'))).toEqual([])
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, 'not json')
    expect(readUsers(file)).toEqual([])
    writeFileSync(file, JSON.stringify({ users: [{ session: '', pid: 5, at: 1 }, { session: 'x', pid: 1, at: 1 }, { session: 'ok', pid: 5, at: 1 }, 7] }))
    expect(readUsers(file).map(u => u.session)).toEqual(['ok'])
  })

  test('leave: a listed session leaves; with no live user left, only dashboard servers among the pids and ui.json\'s are signalled', () => {
    const file = fresh()
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(join(file, '..', 'ui.json'), JSON.stringify({ port: 1, token: 't', pid: 4242 }))
    updateUsers(file, { add: user('a', 100) }, NOW, () => true)
    const asked: number[] = []
    // 901 is not a dashboard server (reused pid, say), so it is not signalled; 4242 (ui.json) is asked about too.
    const left = leaveUsers(file, 'a', [901], NOW, () => true, pid => (asked.push(pid), false))
    expect(left).toEqual({ live: 0, listed: true, stopped: [] })
    expect(asked).toEqual([901, 4242])
    expect(readUsers(file)).toEqual([])
    // A session that was never listed: listed false, and it still answers who is live.
    expect(leaveUsers(file, 'nobody', [], NOW, () => true, () => false)).toEqual({ live: 0, listed: false, stopped: [] })
  })

  test('as a script (what the hooks run): add and leave print their answer; reset and remove are gone', () => {
    const scripted = fresh()
    // This test's own process stands in for the Claude session.
    expect(run('add', scripted, 's1', String(process.pid))).toMatchObject({ code: 0, out: '{"live":1}' })
    expect(run('add', scripted, 's2', String(process.pid))).toMatchObject({ code: 0, out: '{"live":2}' })
    expect(run('add', scripted, 's3', '-')).toMatchObject({ code: 0, out: '{"live":3}' })
    expect(readUsers(scripted).find(u => u.session === 's3')?.pid).toBeNull()
    expect(run('leave', scripted, 's1')).toMatchObject({ code: 0, out: '{"live":2,"listed":true,"stopped":[]}' })
    for (const gone of ['reset', 'remove', 'bogus']) expect(run(gone, scripted, 's1', '-').code).toBe(1)
  })

  test('review r1 finding 5: the script lists a session again with a fresh time', async () => {
    const scripted = fresh()
    run('add', scripted, 's1', '-')
    const first = readUsers(scripted)[0]!.at
    await Bun.sleep(20)
    run('add', scripted, 's1', '-')
    const users = readUsers(scripted)
    expect(users.length).toBe(1)
    expect(users[0]!.at).toBeGreaterThan(first)
  })

  test('review r1 finding 3: concurrent adds from many processes all land (no lost update)', async () => {
    const file = fresh()
    const count = 12
    const children = Array.from({ length: count }, (_, i) =>
      Bun.spawn([process.execPath, SCRIPT, 'add', file, `s${i}`, String(process.pid)], { env: env(), stdout: 'pipe', stderr: 'pipe' }),
    )
    const codes = await Promise.all(children.map(child => child.exited))
    expect(codes).toEqual(Array(count).fill(0))
    expect(readUsers(file).map(u => u.session).sort()).toEqual(Array.from({ length: count }, (_, i) => `s${i}`).sort())
    expect(existsSync(`${file}.lock`)).toBe(false)
  }, 30_000)

  test('cleanup', () => temp.dispose())
})

describe('bin/ui-users.ts: review r2 (pid reuse, leave under the lock, a kept pid)', () => {
  const temp = tempDir('ui-users-r2')
  let n = 0
  const fresh = () => {
    const file = join(temp.dir, `root${++n}`, UI_USERS)
    mkdirSync(join(file, '..'), { recursive: true })
    return file
  }
  const children: Bun.Subprocess[] = []
  const sleeper = () => {
    const child = Bun.spawn(['sleep', '60'], { env: { ...(process.env as Record<string, string>), ...isolatedEnv() }, stdout: 'ignore', stderr: 'ignore' })
    children.push(child)
    return child
  }

  test('item 1: add records the real start time of the pid (ps lstart), and the user is live while it matches', () => {
    const file = fresh()
    const session = sleeper()
    const start = processStart(session.pid)
    expect(start).toMatch(/\d{4}$/)
    expect(run('add', file, 'a', String(session.pid)).code).toBe(0)
    expect(readUsers(file)).toEqual([{ session: 'a', pid: session.pid, at: expect.any(Number), start }])
    expect(liveUsers(file).map(u => u.session)).toEqual(['a'])
  })

  test('item 1: a pid that now belongs to another process (another start time) is not a live user, and the next change drops it', () => {
    const file = fresh()
    const reused = sleeper()
    // The listing names this pid with the start time of the crashed session that had it before.
    writeFileSync(file, JSON.stringify({ users: [{ session: 'crashed', pid: reused.pid, at: Date.now(), start: 'Thu Jan  1 00:00:00 1970' }] }))
    expect(liveUsers(file)).toEqual([])
    expect(run('leave', file, 'other').out).toBe('{"live":0,"listed":false,"stopped":[]}')
    expect(readUsers(file)).toEqual([])
    expect(isAlive(reused.pid)).toBe(true)
  })

  test('item 1: where ps cannot give a start time, the pid alone counts; a record with no start time is pid-only', () => {
    const file = fresh()
    const session = sleeper()
    writeFileSync(file, JSON.stringify({ users: [{ session: 'a', pid: session.pid, at: 1, start: 'Thu Jan  1 00:00:00 1970' }, { session: 'b', pid: session.pid, at: 1 }] }))
    expect(liveUsers(file, Date.now(), undefined, () => undefined).map(u => u.session)).toEqual(['a', 'b'])
    expect(liveUsers(file).map(u => u.session)).toEqual(['b'])
    // The null-pid window is unchanged.
    writeFileSync(file, JSON.stringify({ users: [{ session: 'u', pid: null, at: Date.now() }] }))
    expect(liveUsers(file).length).toBe(1)
  })

  test('item 2: leave decides and signals while holding the lock; an add made meanwhile cannot land until it is done', () => {
    const file = fresh()
    run('add', file, 'a', '-')
    const during: { lock: boolean; add: number }[] = []
    const left = leaveUsers(file, 'a', [4242], Date.now(), undefined, () => {
      // A real add from another process while leave is deciding: it waits for the lock and gives up.
      const started = Date.now()
      const add = run('add', file, 'b', '-')
      during.push({ lock: existsSync(`${file}.lock`), add: add.code })
      expect(Date.now() - started).toBeGreaterThanOrEqual(ADD_LOCK_WAIT_MS - 50)
      return false
    })
    expect(during).toEqual([{ lock: true, add: 1 }])
    expect(left).toEqual({ live: 0, listed: true, stopped: [] })
    expect(existsSync(`${file}.lock`)).toBe(false)
    // Once leave is done, the add lands.
    expect(run('add', file, 'b', '-').code).toBe(0)
  }, 30_000)

  test('item 3: an add with no pid keeps the pid and start time a live listing of that session has, with a fresh time', async () => {
    const file = fresh()
    const session = sleeper()
    run('add', file, 'a', String(session.pid))
    const before = readUsers(file)[0]!
    await Bun.sleep(20)
    expect(run('add', file, 'a', '-').code).toBe(0)
    const after = readUsers(file)[0]!
    expect(after.pid).toBe(session.pid)
    expect(after.start).toBe(before.start)
    expect(after.at).toBeGreaterThan(before.at)
  })

  test('item 3: once that pid is gone, an add with no pid lists the session as unknown', () => {
    const file = fresh()
    const gone = deadPid()
    writeFileSync(file, JSON.stringify({ users: [{ session: 'a', pid: gone, at: Date.now() }] }))
    run('add', file, 'a', '-')
    expect(readUsers(file).map(u => u.pid)).toEqual([null])
  })

  test('cleanup', () => {
    for (const child of children.splice(0)) child.kill('SIGKILL')
    temp.dispose()
  })
})

describe('bin/ui-users.ts: the lock around each change (review r1 finding 3)', () => {
  const temp = tempDir('ui-users-lock')
  let n = 0
  const fresh = () => {
    const file = join(temp.dir, `root${++n}`, UI_USERS)
    mkdirSync(join(file, '..'), { recursive: true })
    return file
  }

  test('a lock held by a live change makes another wait, then fail (exit 1) without touching the list', () => {
    const file = fresh()
    writeFileSync(`${file}.lock`, `${process.pid} held`)
    const started = Date.now()
    expect(() => updateUsers(file, { add: { session: 'a', pid: process.pid, at: Date.now() } })).toThrow('held by another change')
    expect(Date.now() - started).toBeGreaterThanOrEqual(LOCK_WAIT_MS - 20)
    expect(existsSync(file)).toBe(false)
    // The other change's lock is left alone.
    expect(readFileSync(`${file}.lock`, 'utf8')).toBe(`${process.pid} held`)
    const scripted = run('add', file, 'a', '-')
    expect(scripted.code).toBe(1)
    expect(scripted.err).toContain('held by another change')
  })

  test('a lock whose holder is gone is broken at once', () => {
    const file = fresh()
    writeFileSync(`${file}.lock`, `${deadPid()} gone`)
    const started = Date.now()
    expect(updateUsers(file, { add: { session: 'a', pid: null, at: Date.now() } }).length).toBe(1)
    expect(Date.now() - started).toBeLessThan(LOCK_WAIT_MS)
    expect(existsSync(`${file}.lock`)).toBe(false)
  })

  test('a lock older than LOCK_STALE_MS is broken even when its holder still runs', () => {
    const file = fresh()
    writeFileSync(`${file}.lock`, `${process.pid} hung`)
    const old = (Date.now() - LOCK_STALE_MS - 1_000) / 1000
    utimesSync(`${file}.lock`, old, old)
    expect(lockIsStale({ token: `${process.pid} hung`, age: LOCK_STALE_MS + 1 })).toBe(true)
    expect(lockIsStale({ token: `${process.pid} fresh`, age: 10 })).toBe(false)
    expect(lockIsStale({ token: 'garbage', age: 10 })).toBe(true)
    expect(updateUsers(file, { add: { session: 'a', pid: null, at: Date.now() } }).length).toBe(1)
  })

  test('the body runs under the lock, and the lock goes with it, even when the body throws', () => {
    const file = fresh()
    expect(withLock(file, () => existsSync(`${file}.lock`))).toBe(true)
    expect(existsSync(`${file}.lock`)).toBe(false)
    expect(() =>
      withLock(file, () => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(existsSync(`${file}.lock`)).toBe(false)
  })

  test('a change lets go only of its own lock (one broken as stale and taken by another stays)', () => {
    const file = fresh()
    withLock(file, () => {
      // Another change judged ours stale, broke it and holds the place now.
      writeFileSync(`${file}.lock`, `${process.pid} theirs`)
    })
    expect(readFileSync(`${file}.lock`, 'utf8')).toBe(`${process.pid} theirs`)
  })

  test('cleanup', () => temp.dispose())
})

describe('hooks/ui-pid.ts: the Claude process above the hook (review r1 finding 4)', () => {
  // Shapes seen on this machine (macOS, 2026-10-26): hook code runs inside `claude` itself, so the
  // walk's first step is Claude; `comm` is `claude`, or the binary's full path for one not started from a shell.
  const observed = [
    '53208 53199 claude\tclaude --dangerously-skip-permissions',
    '',
  ].join('\n')
  const viaShell = [
    '53587 53584 bun\tbun /private/tmp/claude-501/-Users-u-claude-mnemosyne/walk.ts',
    '53584 53208 /bin/zsh\t/bin/zsh -c source snapshot.sh',
    '53208 53199 claude\tclaude --dangerously-skip-permissions',
  ].join('\n')

  test('the first claude in the chain wins; a path that only contains "claude" does not count', () => {
    expect(claudeFromChain(observed)).toBe(53208)
    expect(claudeFromChain(viaShell)).toBe(53208)
    expect(claudeFromChain('48190 1 /Users/u/Library/PhpWebStudy/env/node/bin/claude\t/Users/u/.../claude')).toBe(48190)
    expect(claudeFromChain('7 1 C:\\Program Files\\Claude\\claude.exe\tclaude.exe')).toBe(7)
  })

  test('node or bun running Claude Code counts; running anything else does not', () => {
    expect(claudeFromChain('300 1 node\tnode /usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js')).toBe(300)
    expect(claudeFromChain('301 1 node\tnode /opt/bin/claude --resume')).toBe(301)
    expect(claudeFromChain('302 1 node\tnode /x/claude-mnemosyne/server.js')).toBeNull()
    expect(isClaude({ pid: 5, ppid: 1, comm: 'bun', args: 'bun /tmp/claude-501/x.ts' })).toBe(false)
    expect(isClaude({ pid: 5, ppid: 1, comm: '/usr/bin/claude-helper', args: 'claude-helper' })).toBe(false)
  })

  test('no claude, an empty answer or garbage is null', () => {
    expect(claudeFromChain('700 1 /sbin/launchd\tlaunchd\n')).toBeNull()
    expect(claudeFromChain('')).toBeNull()
    expect(claudeFromChain('ps: no such process\nnot a line\n')).toBeNull()
    expect(parseChain('  12   1 /bin/zsh\t-zsh\n')).toEqual([{ pid: 12, ppid: 1, comm: '/bin/zsh', args: '-zsh' }])
  })

  test('real processes: the script, run by a process named claude, finds that process', () => {
    const temp = tempDir('ui-pid')
    try {
      // `claude` here is Bun under that name: `comm` then ends in /claude, as the real binary's does.
      const claude = join(temp.dir, 'claude')
      symlinkSync(process.execPath, claude)
      const code = `const r = Bun.spawnSync(["sh", "-c", ${JSON.stringify(CLAUDE_PID_SCRIPT)}]); process.stdout.write(JSON.stringify({ me: process.pid, out: r.stdout.toString() }))`
      const ran = Bun.spawnSync([claude, '-e', code], { env: env() })
      const { me, out } = JSON.parse(ran.stdout.toString()) as { me: number; out: string }
      expect(claudeFromChain(out)).toBe(me)
      // It stopped at that process: one line only.
      expect(parseChain(out).length).toBe(1)
    } finally {
      temp.dispose()
    }
  })

  test('real processes: from a process that is not claude, the walk goes up past it', () => {
    const ran = Bun.spawnSync(['sh', '-c', CLAUDE_PID_SCRIPT], { env: { ...(process.env as Record<string, string>), ...isolatedEnv() } })
    const steps = parseChain(ran.stdout.toString())
    expect(ran.exitCode).toBe(0)
    // The first step is this test process (the shell's parent), and it is not taken for Claude.
    expect(steps[0]?.pid).toBe(process.pid)
    const found = claudeFromChain(ran.stdout.toString())
    expect(found === null || steps.some(step => step.pid === found && isClaude(step))).toBe(true)
    expect(found).not.toBe(process.pid)
  })
})

describe('the server stays up while a listed session lives (real processes)', () => {
  const sessions: Bun.Subprocess[] = []
  const stand = () => {
    // A process that lives until killed: a Claude session.
    const child = Bun.spawn(['sleep', '120'], { env: env(), stdout: 'ignore', stderr: 'ignore' })
    sessions.push(child)
    return child
  }

  /** The holder as the host runs it, its server, and the temp root. */
  async function start() {
    const temp = tempDir('ui-share')
    const root = join(temp.dir, 'root')
    const holder = Bun.spawn([process.execPath, SERVER, '--hold'], {
      env: {
        ...(process.env as Record<string, string>),
        ...isolatedEnv(),
        MNEMOSYNE_ROOT: root,
        MNEMOSYNE_STORE: join(temp.dir, 'store'),
        MNEMOSYNE_CLI: CLI,
        MNEMOSYNE_ACTIVITY_LOG: '',
        MNEMOSYNE_PLUGIN_ROOT: ROOT,
        MNEMOSYNE_UI_PARENT_CHECK_MS: '200',
      },
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'inherit',
    })
    const reader = (holder.stdout as ReadableStream<Uint8Array>).getReader()
    let text = ''
    while (!text.includes('\n')) {
      const { value, done } = await reader.read()
      if (done) throw new Error(`no ready line; got: ${text}`)
      text += new TextDecoder().decode(value)
    }
    const ready = JSON.parse(text.slice(0, text.indexOf('\n'))) as { port: number; pid: number }
    const users = join(root, UI_USERS)
    const answers = async () => (await fetch(`http://127.0.0.1:${ready.port}/favicon.ico`).catch(() => null))?.status === 204
    const stop = () => {
      if (isAlive(ready.pid)) process.kill(ready.pid, 'SIGKILL')
      holder.kill('SIGKILL')
      for (const child of sessions.splice(0)) child.kill('SIGKILL')
      temp.dispose()
    }
    return { holder, ready, users, root, answers, stop }
  }

  test('SHARE.1-2: the starter ends, the server stays for the other session; when that one ends too, the server stops', async () => {
    const a = stand()
    const b = stand()
    const s = await start()
    try {
      updateUsers(s.users, { add: { session: 'a', pid: a.pid, at: Date.now() } })
      updateUsers(s.users, { add: { session: 'b', pid: b.pid, at: Date.now() } })
      // A ends: its holder goes (and the session itself, which session.end has already taken off the list).
      updateUsers(s.users, { remove: 'a' })
      s.holder.kill('SIGKILL')
      a.kill('SIGKILL')
      await Bun.sleep(1_000)
      expect(isAlive(s.ready.pid)).toBe(true)
      expect(await s.answers()).toBe(true)
      expect(existsSync(join(s.root, 'ui.json'))).toBe(true)
      // B ends too (session.end takes it off the list): the server stops by itself, and removes its ui.json.
      updateUsers(s.users, { remove: 'b' })
      expect(await until(() => !isAlive(s.ready.pid), 5_000)).toBe(true)
      expect(existsSync(join(s.root, 'ui.json'))).toBe(false)
    } finally {
      s.stop()
    }
  }, 30_000)

  test('SHARE.3: a session that crashed (its process gone, no session.end) does not keep the server up', async () => {
    const a = stand()
    const b = stand()
    const s = await start()
    try {
      updateUsers(s.users, { add: { session: 'a', pid: a.pid, at: Date.now() } })
      updateUsers(s.users, { add: { session: 'b', pid: b.pid, at: Date.now() } })
      // A's holder is killed with its session at once (a crash); B is alive, so the server stays.
      s.holder.kill('SIGKILL')
      a.kill('SIGKILL')
      await Bun.sleep(1_000)
      expect(isAlive(s.ready.pid)).toBe(true)
      // B crashes as well: nobody ran session.end, the list still names both, and the server ends anyway.
      b.kill('SIGKILL')
      expect(readUsers(s.users).length).toBe(2)
      expect(await until(() => !isAlive(s.ready.pid), 5_000)).toBe(true)
    } finally {
      s.stop()
    }
  }, 30_000)

  test('a holder that ends with no live user in the list takes the server down, as before', async () => {
    const a = stand()
    const s = await start()
    try {
      updateUsers(s.users, { add: { session: 'a', pid: a.pid, at: Date.now() } })
      updateUsers(s.users, { remove: 'a' })
      s.holder.kill('SIGKILL')
      expect(await until(() => !isAlive(s.ready.pid), 5_000)).toBe(true)
    } finally {
      s.stop()
    }
  }, 30_000)

  test('a SIGTERM to the server still stops it at once, listed users or not', async () => {
    const a = stand()
    const s = await start()
    try {
      updateUsers(s.users, { add: { session: 'a', pid: a.pid, at: Date.now() } })
      process.kill(s.ready.pid, 'SIGTERM')
      expect(await until(() => !isAlive(s.ready.pid), 5_000)).toBe(true)
    } finally {
      s.stop()
    }
  }, 30_000)

  test('review r1 finding 2: the last user\'s one `leave` run stops the server well inside its timeout (measured)', async () => {
    const a = stand()
    const s = await start()
    try {
      expect(run('add', s.users, 'a', String(a.pid)).code).toBe(0)
      // A reuse-only last user: no server pid of its own, so `leave` reads ui.json's and checks it is a dashboard server.
      const started = performance.now()
      const left = run('leave', s.users, 'a')
      const took = performance.now() - started
      expect(left.code).toBe(0)
      expect(JSON.parse(left.out)).toEqual({ live: 0, listed: true, stopped: [s.ready.pid] })
      expect(took).toBeLessThan(LEAVE_TIMEOUT_MS)
      expect(await until(() => !isAlive(s.ready.pid), 3_000)).toBe(true)
      console.log(`leave (spawn to exit, server signalled): ${took.toFixed(0)} ms`)
    } finally {
      s.stop()
    }
  }, 30_000)

  test('review r1 finding 2: a `leave` with another live user signals nothing, and the server stays', async () => {
    const a = stand()
    const b = stand()
    const s = await start()
    try {
      run('add', s.users, 'a', String(a.pid))
      run('add', s.users, 'b', String(b.pid))
      expect(JSON.parse(run('leave', s.users, 'a', String(s.ready.pid)).out)).toEqual({ live: 1, listed: true, stopped: [] })
      await Bun.sleep(500)
      expect(isAlive(s.ready.pid)).toBe(true)
      expect(await s.answers()).toBe(true)
    } finally {
      s.stop()
    }
  }, 30_000)

  test('a `leave` never signals a pid that is not a dashboard server (a stale ui.json naming a reused pid)', async () => {
    const temp = tempDir('ui-stale')
    const other = stand()
    try {
      const users = join(temp.dir, UI_USERS)
      writeFileSync(join(temp.dir, 'ui.json'), JSON.stringify({ port: 1, token: 'x'.repeat(43), pid: other.pid }))
      run('add', users, 'a', '-')
      expect(JSON.parse(run('leave', users, 'a', String(other.pid)).out)).toEqual({ live: 0, listed: true, stopped: [] })
      await Bun.sleep(200)
      expect(isAlive(other.pid)).toBe(true)
    } finally {
      other.kill('SIGKILL')
      temp.dispose()
    }
  }, 30_000)

  test('review r1 finding 3: B reuses the new server before its starter A lists itself; A ends; the server stays for B', async () => {
    const a = stand()
    const b = stand()
    const s = await start()
    try {
      // ui.json is written: B pings it and lists itself first, then A (the starter) lists itself.
      run('add', s.users, 'b', String(b.pid))
      run('add', s.users, 'a', String(a.pid))
      expect(readUsers(s.users).map(u => u.session)).toEqual(['b', 'a'])
      // A's session.end: its leave (with its own server pid) and its holder going.
      expect(JSON.parse(run('leave', s.users, 'a', String(s.ready.pid)).out)).toEqual({ live: 1, listed: true, stopped: [] })
      s.holder.kill('SIGKILL')
      await Bun.sleep(1_000)
      expect(isAlive(s.ready.pid)).toBe(true)
      expect(await s.answers()).toBe(true)
    } finally {
      s.stop()
    }
  }, 30_000)
})
