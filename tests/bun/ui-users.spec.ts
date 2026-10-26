// SHARE: the dashboard server stays up until every session that opened or reused it has ended.
// bin/ui-users.ts (the list in <root>/ui-users.json) on its own, then the real server (as ui-server.spec.ts
// runs it, over a temp root) with real processes standing in for the Claude sessions. The hooks' side
// (listing a session, session.end) is in tests/ui-launch.test.ts.
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { liveUsers, readUsers, UI_USERS, UNKNOWN_PID_MAX_MS, updateUsers } from '../../bin/ui-users'
import { isolatedEnv, ROOT, tempDir } from './helpers'

const SERVER = join(ROOT, 'ui', 'server.ts')
const SCRIPT = join(ROOT, 'bin', 'ui-users.ts')
const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

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

describe('bin/ui-users.ts: the list of sessions using the server', () => {
  const temp = tempDir('ui-users')
  const file = join(temp.dir, 'root', UI_USERS)
  const NOW = 1_000_000_000_000
  const user = (session: string, pid: number | null = 100, at = NOW) => ({ session, pid, at })

  test('add lists a session, a second add of it replaces it, remove drops it; the file is 0600', () => {
    expect(updateUsers(file, { add: user('a', 100) }, NOW, () => true).map(u => u.session)).toEqual(['a'])
    expect(updateUsers(file, { add: user('b', 200) }, NOW, () => true).map(u => u.session)).toEqual(['a', 'b'])
    expect(updateUsers(file, { add: user('a', 101) }, NOW, () => true)).toEqual([user('b', 200), user('a', 101)])
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(updateUsers(file, { remove: 'a' }, NOW, () => true)).toEqual([user('b', 200)])
    expect(existsSync(`${file}.${process.pid}.tmp`)).toBe(false)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ users: [user('b', 200)] })
  })

  test('a user whose process is gone is dropped at the next change and by liveUsers', () => {
    updateUsers(file, { add: user('a', 100), only: true }, NOW, () => true)
    updateUsers(file, { add: user('b', 200) }, NOW, () => true)
    const alive = (pid: number) => pid === 200
    expect(liveUsers(file, NOW, alive).map(u => u.session)).toEqual(['b'])
    // The file still names both until something changes it.
    expect(readUsers(file).map(u => u.session)).toEqual(['a', 'b'])
    expect(updateUsers(file, { add: user('c', 200) }, NOW, alive).map(u => u.session)).toEqual(['b', 'c'])
  })

  test('reset starts the list again with the one session', () => {
    updateUsers(file, { add: user('a', 100) }, NOW, () => true)
    expect(updateUsers(file, { add: user('z', 300), only: true }, NOW, () => true).map(u => u.session)).toEqual(['z'])
  })

  test('a user with no pid counts for 12 hours only', () => {
    updateUsers(file, { add: user('u', null, NOW), only: true }, NOW, () => false)
    expect(liveUsers(file, NOW + UNKNOWN_PID_MAX_MS - 1, () => false).length).toBe(1)
    expect(liveUsers(file, NOW + UNKNOWN_PID_MAX_MS, () => false).length).toBe(0)
  })

  test('a missing, broken or malformed file is no users', () => {
    expect(liveUsers(join(temp.dir, 'nothing.json'))).toEqual([])
    writeFileSync(file, 'not json')
    expect(readUsers(file)).toEqual([])
    writeFileSync(file, JSON.stringify({ users: [{ session: '', pid: 5, at: 1 }, { session: 'x', pid: 1, at: 1 }, { session: 'ok', pid: 5, at: 1 }, 7] }))
    expect(readUsers(file).map(u => u.session)).toEqual(['ok'])
  })

  test('as a script (what the hooks run): add, reset and remove print how many are live', () => {
    const run = (...args: string[]) => {
      const ran = Bun.spawnSync([process.execPath, SCRIPT, ...args], { env: { ...(process.env as Record<string, string>), ...isolatedEnv() } })
      return { code: ran.exitCode, out: ran.stdout.toString().trim() }
    }
    const scripted = join(temp.dir, 'scripted', UI_USERS)
    // This test's own process stands in for the Claude session.
    expect(run('reset', scripted, 's1', String(process.pid))).toEqual({ code: 0, out: '{"live":1}' })
    expect(run('add', scripted, 's2', String(process.pid))).toEqual({ code: 0, out: '{"live":2}' })
    expect(run('add', scripted, 's3', '-')).toEqual({ code: 0, out: '{"live":3}' })
    expect(readUsers(scripted).find(u => u.session === 's3')?.pid).toBeNull()
    expect(run('remove', scripted, 's1')).toEqual({ code: 0, out: '{"live":2}' })
    expect(run('bogus', scripted, 's1').code).toBe(1)
    temp.dispose()
  })
})

describe('the server stays up while a listed session lives (real processes)', () => {
  const sessions: Bun.Subprocess[] = []
  const stand = () => {
    // A process that lives until killed: a Claude session.
    const child = Bun.spawn(['sleep', '120'], { env: { ...(process.env as Record<string, string>), ...isolatedEnv() }, stdout: 'ignore', stderr: 'ignore' })
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
})
