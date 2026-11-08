// Issue #3: one project id across clones, moves, worktrees and cloud checkouts.
// The pure rule (normalizeRemote, remoteOwnerId, resolveOwner) and the script
// (`bun bin/projects.ts resolve <projects.json> <store>`) against real files: a
// registry, a SQLite store shaped like the engine's, and real git repos, clones and
// worktrees in a temp folder. The real Mnemosyne root is never reached.
import { afterAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { resolveProjectOwner, storeHasOwner, writeProjects } from '../../bin/projects'
import { normalizeRemote, ownerId, remoteKey, remoteOwnerId } from '../../hooks/owner'
import { mergeProject, parseProjects, resolveOwner, sanitizeInput, sanitizeResolve } from '../../hooks/projects'
import type { ProjectsFile } from '../../hooks/projects'
import { isolatedEnv, ROOT, tempDir } from './helpers'

const SCRIPT = join(ROOT, 'bin', 'projects.ts')
const temp = tempDir('project-identity')
afterAll(() => temp.dispose())

describe('normalizeRemote', () => {
  test('https, scp-like and ssh forms of one GitHub repo agree, whatever the case, user, token, port or .git', () => {
    for (const remote of [
      'git@github.com:Org/Repo.git',
      'https://github.com/org/repo',
      'https://user:token@github.com/ORG/Repo.git/',
      'ssh://git@GitHub.com:22/org/repo.git',
      'ssh://git@github.com/org/repo',
      '  git@github.com:org/repo  ',
    ]) {
      expect(normalizeRemote(remote)).toBe('github.com/org/repo')
    }
  })

  test('GitLab subgroups and Bitbucket fold case; another host keeps the path as written', () => {
    expect(normalizeRemote('https://gitlab.com/Group/Sub/Repo.git')).toBe('gitlab.com/group/sub/repo')
    expect(normalizeRemote('git@bitbucket.org:Team/Repo.git')).toBe('bitbucket.org/team/repo')
    expect(normalizeRemote('ssh://git@Git.Example.com:2222/Team/Repo.git')).toBe('git.example.com/Team/Repo')
  })

  test('a remote with no network host, or no path, is null', () => {
    for (const remote of [null, undefined, '', '   ', '/srv/git/repo.git', './repo', '../x:y', 'file:///srv/repo', 'C:\\repos\\x', 'C:/repos/x', 'https://github.com', 'https://github.com/', 42]) {
      expect(normalizeRemote(remote)).toBeNull()
    }
  })
})

describe('remoteOwnerId', () => {
  test('keeps the project-<name>-<hash> shape the registry, the dashboard and the vocabulary read', () => {
    const id = remoteOwnerId('github.com/org/my.repo')
    expect(id).toMatch(/^project-[A-Za-z0-9_-]{1,300}$/)
    expect(/^project-(.+)-[0-9a-z]+$/.exec(id)?.[1]).toBe('my-repo')
    expect(id.endsWith(`-${remoteKey('github.com/org/my.repo')}`)).toBe(true)
  })

  test('is the same for every spelling of one remote, and apart from a path of the same text', () => {
    const a = remoteOwnerId(normalizeRemote('git@github.com:Org/Repo.git')!)
    expect(remoteOwnerId(normalizeRemote('https://github.com/org/repo')!)).toBe(a)
    expect(remoteOwnerId(normalizeRemote('https://github.com/org/other')!)).not.toBe(a)
    expect(a).not.toBe(ownerId('per-project', '/github.com/org/repo'))
  })

  test('names no org and carries no part of the remote but the repo name', () => {
    expect(remoteOwnerId('github.com/acme-client/secret-migration')).not.toContain('acme')
  })
})

const DAY = '2026-11-01'
const registry = (projects: Record<string, { remoteKey?: string; firstSeen?: string }>): ProjectsFile => ({
  version: 1,
  projects: Object.fromEntries(Object.entries(projects).map(([owner, r]) => [owner, { name: 'x', kind: 'repo' as const, remoteHost: 'github.com', ...(r.remoteKey ? { remoteKey: r.remoteKey } : {}), firstSeen: r.firstSeen ?? DAY, lastSeen: DAY }])),
})

describe('resolveOwner', () => {
  const remote = 'github.com/org/repo'
  const ask = (legacy: string) => ({ legacy, remoteKey: remoteKey(remote), remoteOwner: remoteOwnerId(remote) })
  const never = () => {
    throw new Error('the store was read although the registry knew the folder')
  }

  test('a folder the registry knows keeps its path id, without reading the store', () => {
    expect(resolveOwner(registry({ 'project-a-1': {} }), ask('project-a-1'), never)).toBe('project-a-1')
  })

  test('a folder with memories under its path id keeps it, even when another clone is registered', () => {
    const file = registry({ 'project-a-1': { remoteKey: remoteKey(remote) } })
    expect(resolveOwner(file, ask('project-b-2'), () => true)).toBe('project-b-2')
  })

  test('a new folder of a registered remote joins the oldest owner of that remote', () => {
    const file = registry({ 'project-new-9': { remoteKey: remoteKey(remote), firstSeen: '2026-11-05' }, 'project-old-1': { remoteKey: remoteKey(remote), firstSeen: '2026-10-01' }, 'project-other-3': { remoteKey: 'zz' } })
    expect(resolveOwner(file, ask('project-c-4'), () => false)).toBe('project-old-1')
  })

  test('a remote seen nowhere yet gets the remote id; a folder without a remote keeps the path id', () => {
    expect(resolveOwner(registry({}), ask('project-c-4'), () => false)).toBe(remoteOwnerId(remote))
    expect(resolveOwner(registry({}), { legacy: 'project-c-4', remoteKey: null, remoteOwner: null }, () => false)).toBe('project-c-4')
  })
})

describe('the registry keeps the remote hash', () => {
  test('records it, keeps it when a later session reports no remote, and drops a bad one', () => {
    const base = { owner: 'project-r-1', name: 'r', kind: 'repo', remoteHost: 'github.com' }
    let file = mergeProject(parseProjects(''), sanitizeInput({ ...base, remoteKey: 'abc12' })!, DAY)
    expect(file.projects['project-r-1']?.remoteKey).toBe('abc12')
    file = mergeProject(file, sanitizeInput({ ...base, remoteKey: null })!, '2026-11-02')
    expect(file.projects['project-r-1']?.remoteKey).toBe('abc12')
    expect(sanitizeInput({ ...base, remoteKey: 'https://github.com/o/r' })).toBeNull()
    expect(parseProjects(JSON.stringify({ projects: { 'project-r-1': { name: 'r', kind: 'repo', remoteHost: null, remoteKey: 'NOT A KEY', firstSeen: DAY, lastSeen: DAY } } })).projects['project-r-1']).toEqual({ name: 'r', kind: 'repo', remoteHost: null, firstSeen: DAY, lastSeen: DAY })
  })

  test('a folder never records one', () => {
    expect(sanitizeInput({ owner: 'project-f-1', name: 'f', kind: 'folder', remoteHost: null, remoteKey: 'abc' })?.remoteKey).toBeUndefined()
  })

  test('the resolve input is checked: owners only, a hash only, both remote fields or neither', () => {
    expect(sanitizeResolve({ legacy: 'project-a-1', remoteKey: 'abc', remoteOwner: 'project-r-abc' })).not.toBeNull()
    expect(sanitizeResolve({ legacy: 'project-a-1' })).toEqual({ legacy: 'project-a-1', remoteKey: null, remoteOwner: null })
    for (const bad of [{ legacy: 'global' }, { legacy: 'project-a-1', remoteKey: 'abc' }, { legacy: 'project-a-1', remoteKey: 'github.com/o/r', remoteOwner: 'project-r-1' }, { legacy: 'project-a-1', remoteKey: 'abc', remoteOwner: 'global' }, 'nope']) {
      expect(sanitizeResolve(bad)).toBeNull()
    }
  })
})

/** A store shaped like the engine's: working_memory with a session_id per row. */
function makeStore(dir: string, owners: string[]) {
  mkdirSync(dir, { recursive: true })
  const db = new Database(join(dir, 'mnemopi.db'))
  db.exec('CREATE TABLE working_memory (id TEXT PRIMARY KEY, content TEXT, session_id TEXT DEFAULT \'default\')')
  owners.forEach((owner, i) => db.query('INSERT INTO working_memory (id, content, session_id) VALUES (?, ?, ?)').run(`m${i}`, 'a memory', owner))
  db.close()
}

describe('storeHasOwner', () => {
  test('reads rows by owner; no store, or a store without the table, has none', () => {
    const store = join(temp.dir, 'store-rows')
    makeStore(store, ['project-a-1'])
    expect(storeHasOwner(store, 'project-a-1')).toBe(true)
    expect(storeHasOwner(store, 'project-b-2')).toBe(false)
    expect(storeHasOwner(join(temp.dir, 'no-store'), 'project-a-1')).toBe(false)
    const empty = join(temp.dir, 'store-empty')
    mkdirSync(empty, { recursive: true })
    new Database(join(empty, 'mnemopi.db')).close()
    expect(storeHasOwner(empty, 'project-a-1')).toBe(false)
  })
})

// --- End to end: real git repos, the script as the hook runs it ---

const git = (cwd: string, ...args: string[]) => {
  const ran = Bun.spawnSync(['git', ...args], { cwd, env: { ...(process.env as Record<string, string>), ...isolatedEnv(), GIT_CONFIG_NOSYSTEM: '1', LC_ALL: 'C' }, stdout: 'pipe', stderr: 'pipe' })
  if (ran.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${ran.stderr.toString()}`)
  return ran.stdout.toString().trim()
}

/** What the hook sends for a folder: its path id and, from its origin remote, the remote's hash and id. */
function sessionAt(root: string) {
  let origin: string | null = null
  try {
    origin = git(root, 'remote', 'get-url', 'origin')
  } catch {
    // no origin
  }
  const remote = normalizeRemote(origin)
  return { legacy: ownerId('per-project', root), remoteKey: remote === null ? null : remoteKey(remote), remoteOwner: remote === null ? null : remoteOwnerId(remote), remote }
}

/** One session start: resolve through the script, then register the owner it got, as the hook does. */
async function startSession(registryPath: string, store: string, root: string) {
  const s = sessionAt(root)
  const child = Bun.spawn([process.execPath, SCRIPT, 'resolve', registryPath, store], { env: { ...(process.env as Record<string, string>), ...isolatedEnv() }, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  child.stdin.write(JSON.stringify({ legacy: s.legacy, remoteKey: s.remoteKey, remoteOwner: s.remoteOwner }))
  child.stdin.end()
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  if (exitCode !== 0) throw new Error(`resolve failed: ${stderr}`)
  const owner = stdout.trim()
  expect(writeProjects(registryPath, { owner, name: root.split('/').at(-1), kind: 'repo', remoteHost: 'github.com', remoteKey: s.remoteKey })).toBe(true)
  return owner
}

describe('end to end: one memory per project', () => {
  const base = join(temp.dir, 'e2e')
  const registryPath = join(base, 'root', 'projects.json')
  const store = join(base, 'store')
  mkdirSync(base, { recursive: true })

  // A repo in use before issue #3: its memories live under its path id.
  const first = join(base, 'dev', 'Client-App')
  mkdirSync(first, { recursive: true })
  git(first, 'init', '-q')
  git(first, 'remote', 'add', 'origin', 'git@github.com:Acme/Client-App.git')
  git(first, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'init')
  const existing = ownerId('per-project', first)
  makeStore(store, [existing])

  test('an existing project keeps its owner, so every stored memory stays where it is', async () => {
    expect(await startSession(registryPath, store, first)).toBe(existing)
    expect((JSON.parse(readFileSync(registryPath, 'utf8')) as ProjectsFile).projects[existing]?.remoteKey).toBe(sessionAt(first).remoteKey!)
  })

  test('a second clone (https, other case, other folder) shares it', async () => {
    const clone = join(base, 'elsewhere', 'client-app-copy')
    mkdirSync(clone, { recursive: true })
    git(clone, 'init', '-q')
    git(clone, 'remote', 'add', 'origin', 'https://github.com/acme/client-app')
    expect(sessionAt(clone).legacy).not.toBe(existing)
    expect(await startSession(registryPath, store, clone)).toBe(existing)
  })

  test('a worktree shares it, even when the host reports the worktree folder as the root', async () => {
    const worktree = join(base, 'wt', 'feature-x')
    git(first, 'worktree', 'add', '-q', worktree)
    expect(await startSession(registryPath, store, worktree)).toBe(existing)
  })

  test('the repo moved to another folder shares it', async () => {
    const moved = join(base, 'moved', 'Client-App')
    mkdirSync(join(base, 'moved'), { recursive: true })
    const spare = join(base, 'spare-clone')
    git(base, 'clone', '-q', first, spare)
    git(spare, 'remote', 'set-url', 'origin', 'git@github.com:Acme/Client-App.git')
    renameSync(spare, moved)
    expect(await startSession(registryPath, store, moved)).toBe(existing)
  })

  test('a repo seen nowhere before gets the remote id, the same on any machine', async () => {
    const fresh = join(base, 'dev', 'new-thing')
    mkdirSync(fresh, { recursive: true })
    git(fresh, 'init', '-q')
    git(fresh, 'remote', 'add', 'origin', 'git@github.com:acme/new-thing.git')
    const id = await startSession(registryPath, store, fresh)
    expect(id).toBe(remoteOwnerId('github.com/acme/new-thing'))
    // A cloud session: an empty registry and store on another machine, another path.
    const cloud = join(base, 'cloud', 'home', 'user', 'new-thing')
    mkdirSync(cloud, { recursive: true })
    git(cloud, 'init', '-q')
    git(cloud, 'remote', 'add', 'origin', 'https://github.com/Acme/New-Thing.git')
    expect(await startSession(join(base, 'cloud-root', 'projects.json'), join(base, 'cloud-store'), cloud)).toBe(id)
  })

  test('a repo without a remote keeps the path id, as before', async () => {
    const local = join(base, 'dev', 'scratch')
    mkdirSync(local, { recursive: true })
    git(local, 'init', '-q')
    expect(await startSession(registryPath, store, local)).toBe(ownerId('per-project', local))
  })

  test('the registry holds hashes and names, never a remote or an org', () => {
    const text = readFileSync(registryPath, 'utf8')
    expect(text.toLowerCase()).not.toContain('acme')
    expect(text).not.toContain('git@')
  })

  test('a bad input or registry name fails (the hook then keeps the path id)', () => {
    expect(() => resolveProjectOwner(registryPath, store, 'not json')).toThrow()
    expect(() => resolveProjectOwner(join(base, 'other.json'), store, { legacy: 'project-a-1' })).toThrow()
  })
})
