// MAPX.8 / C12: bin/projects.ts writes <root>/projects.json. Real files in a temp
// folder, real Bun processes for the script. The hook side is in tests/register.test.ts,
// the pure parts in tests/projects.test.ts. Every path here is under a temp folder and
// every spawned script gets a temp HOME: the real Mnemosyne root is never reached.
import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { writeProjects } from '../../bin/projects'
import { ROOT, tempDir, isolatedEnv } from './helpers'

const SCRIPT = join(ROOT, 'bin', 'projects.ts')
const isPosix = process.platform !== 'win32'
const temp = tempDir('projects')
afterAll(() => temp.dispose())

const OWNER = 'project-My-Repo-apu5fc'
const input = (over: Record<string, unknown> = {}) => ({ owner: OWNER, name: 'My Repo', kind: 'repo', remoteHost: 'github.com', ...over })

let n = 0
/** A path for a registry in a folder of its own. */
const fresh = () => join(temp.dir, `case-${++n}`, 'projects.json')
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as { version: number; projects: Record<string, Record<string, unknown>> }
const mode = (path: string) => statSync(path).mode & 0o777

/** Runs the writer as the hook does: `bun bin/projects.ts <args>`, the record on stdin. */
async function script(args: string[], stdin: string) {
  const child = Bun.spawn([process.execPath, SCRIPT, ...args], { env: { ...(process.env as Record<string, string>), ...isolatedEnv() }, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  child.stdin.write(stdin)
  child.stdin.end()
  const [stderr, exitCode] = await Promise.all([new Response(child.stderr).text(), child.exited])
  return { exitCode, stderr }
}

describe('writeProjects', () => {
  test('creates the registry owner-only: folder 0700, file 0600, no temp or lock file left', () => {
    const path = fresh()
    expect(writeProjects(path, input(), '2026-10-25')).toBe(true)
    expect(read(path)).toEqual({ version: 1, projects: { [OWNER]: { name: 'My Repo', kind: 'repo', remoteHost: 'github.com', firstSeen: '2026-10-25', lastSeen: '2026-10-25' } } })
    if (isPosix) {
      expect(mode(path)).toBe(0o600)
      expect(mode(dirname(path))).toBe(0o700)
    }
    expect(readdirSync(dirname(path))).toEqual(['projects.json'])
  })

  test('keeps firstSeen across writes, moves lastSeen, and keeps the other owners', () => {
    const path = fresh()
    writeProjects(path, input(), '2026-10-20')
    writeProjects(path, input({ owner: 'project-other-9z', name: 'other', kind: 'folder', remoteHost: null }), '2026-10-21')
    writeProjects(path, input({ remoteHost: 'gitlab.com' }), '2026-10-25')
    const { projects } = read(path)
    expect(projects[OWNER]).toEqual({ name: 'My Repo', kind: 'repo', remoteHost: 'gitlab.com', firstSeen: '2026-10-20', lastSeen: '2026-10-25' })
    expect(projects['project-other-9z']).toEqual({ name: 'other', kind: 'folder', remoteHost: null, firstSeen: '2026-10-21', lastSeen: '2026-10-21' })
  })

  test('defaults lastSeen to today in UTC', () => {
    const path = fresh()
    writeProjects(path, input())
    expect(read(path).projects[OWNER]?.lastSeen).toBe(new Date().toISOString().slice(0, 10))
  })

  test('rebuilds a corrupt registry, keeping only what is valid in it, and sets it owner-only', () => {
    const path = fresh()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '{"version":1,"projects":{"project-x-1": ', { mode: 0o644 })
    expect(writeProjects(path, input(), '2026-10-25')).toBe(true)
    expect(Object.keys(read(path).projects)).toEqual([OWNER])
    if (isPosix) expect(mode(path)).toBe(0o600) // the old file's looser mode does not carry over

    writeFileSync(path, JSON.stringify({ version: 1, projects: { 'project-keep-1': { name: 'keep', kind: 'folder', remoteHost: null, firstSeen: '2026-10-01', lastSeen: '2026-10-02' }, 'project-bad-1': { name: 7 } } }))
    writeProjects(path, input(), '2026-10-25')
    expect(Object.keys(read(path).projects).sort()).toEqual([OWNER, 'project-keep-1'])
  })

  test('never writes a remote URL, user name or token', () => {
    const path = fresh()
    // A full remote in the host field is refused whole.
    for (const host of ['https://user:token@github.com/o/r.git', 'git@github.com:o/r.git', 'user:token@github.com', 'github.com:22']) {
      expect(writeProjects(path, input({ remoteHost: host }), '2026-10-25')).toBe(false)
    }
    expect(existsSync(path)).toBe(false)
    // Extra fields on the record, a remote among them, are not copied.
    const crowded = { ...input(), remote: 'https://hunter2user:ghp_sEcReT@github.com/o/r.git', token: 'ghp_sEcReT', user: 'hunter2user' }
    expect(writeProjects(path, crowded, '2026-10-25')).toBe(true)
    const text = readFileSync(path, 'utf8')
    for (const secret of ['hunter2user', 'ghp_', 'sEcReT', 'https://', 'git@', '.git', '/o/r']) expect(text).not.toContain(secret)
    expect(Object.keys(read(path).projects[OWNER] ?? {}).sort()).toEqual(['firstSeen', 'kind', 'lastSeen', 'name', 'remoteHost'])
  })

  test('refuses the global owner and a path not named projects.json, creating nothing', () => {
    const path = fresh()
    const dir = dirname(path)
    expect(writeProjects(path, input({ owner: 'global' }), '2026-10-25')).toBe(false)
    expect(writeProjects(join(dir, 'activity.jsonl'), input(), '2026-10-25')).toBe(false)
    expect(writeProjects(join(dir, 'other.json'), input(), '2026-10-25')).toBe(false)
    expect(writeProjects('', input(), '2026-10-25')).toBe(false)
    expect(existsSync(dir)).toBe(false)
  })

  test('leaves a registry it cannot read alone (a folder in its place), rather than rebuilding over it', () => {
    const path = fresh()
    mkdirSync(path, { recursive: true })
    expect(writeProjects(path, input(), '2026-10-25')).toBe(false)
    expect(statSync(path).isDirectory()).toBe(true)
    expect(readdirSync(dirname(path))).toEqual(['projects.json'])
  })

  test('takes over a stale lock', () => {
    const path = fresh()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(`${path}.lock`, '')
    const old = new Date(Date.now() - 60_000)
    utimesSync(`${path}.lock`, old, old)
    expect(writeProjects(path, input(), '2026-10-25')).toBe(true)
    expect(existsSync(`${path}.lock`)).toBe(false)
    expect(readdirSync(dirname(path))).toEqual(['projects.json']) // the stale lock was renamed away and removed, not left behind
  })

  test('a stale lock taken over by several writers at once leaves a valid registry, no debris and no wedged lock', async () => {
    const path = fresh()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(`${path}.lock`, '')
    const old = new Date(Date.now() - 60_000)
    utimesSync(`${path}.lock`, old, old)
    const owners = ['a', 'b', 'c', 'd', 'e'].map(c => `project-${c}-1`)
    const write = (owner: string) => script(['write', path], JSON.stringify(input({ owner, name: owner })))
    const runs = await Promise.all(owners.map(write))
    expect(runs.map(run => run.exitCode)).toEqual(owners.map(() => 0))
    expect(readdirSync(dirname(path))).toEqual(['projects.json']) // no .lock.<pid> leftover from the rename, no temp file
    // A writer on a loaded machine may give up its 2 s wait (by design: its next session start records it), so
    // what must hold is that the registry parses and a second round completes it: the takeover left no wedged lock.
    expect(Object.keys(read(path).projects).length).toBeGreaterThan(0)
    const missing = owners.filter(owner => read(path).projects[owner] === undefined)
    for (const owner of missing) await write(owner)
    expect(Object.keys(read(path).projects).sort()).toEqual(owners)
  })

  test('a stale lock that another writer has just replaced with a fresh one is linked back, not stolen', () => {
    const path = fresh()
    mkdirSync(dirname(path), { recursive: true })
    const lock = `${path}.lock`
    writeFileSync(lock, '')
    const inode = statSync(lock).ino
    // The rival's takeover lands between our staleness check and our rename: the first check sees a stale lock, the file we
    // then rename away is fresh. The clock reads 60 s ahead once, then true.
    const realNow = Date.now
    let reads = 0
    Date.now = () => (reads++ === 0 ? realNow() + 60_000 : realNow())
    try {
      // Without the link-back the renamed lock would be gone and the next attempt would take it and write (true).
      expect(writeProjects(path, input(), '2026-10-25')).toBe(false)
    } finally {
      Date.now = realNow
    }
    expect(reads).toBeGreaterThan(1)
    expect(existsSync(path)).toBe(false)
    expect(statSync(lock).ino).toBe(inode) // the same lock file, linked back
    expect(readdirSync(dirname(path)).sort()).toEqual(['projects.json.lock']) // no .lock.<pid> leftover
  })

  test('gives up on a fresh lock without writing, and leaves that lock alone', () => {
    const path = fresh()
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(`${path}.lock`, '')
    expect(writeProjects(path, input(), '2026-10-25')).toBe(false)
    expect(existsSync(path)).toBe(false)
    expect(existsSync(`${path}.lock`)).toBe(true)
  })
})

describe('the script (bun bin/projects.ts write <path>)', () => {
  test('writes the record from stdin to the path it is given, and exits 0', async () => {
    const path = fresh()
    const ran = await script(['write', path], JSON.stringify(input()))
    expect(ran.exitCode).toBe(0)
    expect(Object.keys(read(path).projects)).toEqual([OWNER])
  })

  test('has no default path: with none, or the wrong command, it writes nothing and exits 0', async () => {
    const dir = dirname(fresh())
    mkdirSync(dir, { recursive: true })
    for (const args of [['write'], [], ['read', join(dir, 'projects.json')]]) {
      const ran = await script(args, JSON.stringify(input()))
      expect(ran.exitCode).toBe(0)
    }
    expect(readdirSync(dir)).toEqual([])
  })

  test('exits 0 and writes nothing for bad stdin or a refused record', async () => {
    const path = fresh()
    for (const stdin of ['not json', '', JSON.stringify(input({ remoteHost: 'https://u:t@github.com/o/r' })), JSON.stringify(input({ owner: 'global' }))]) {
      const ran = await script(['write', path], stdin)
      expect(ran.exitCode).toBe(0)
    }
    expect(existsSync(path)).toBe(false)
  })
})
