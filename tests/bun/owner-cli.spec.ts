// `bun bin/owner.ts <path>` (issue #43, SA.3): the owner id for a folder, the
// same as ownerId() over the root the plan's decision 2 picks. Real folders,
// git repos, a linked worktree and a symlink into a repo, in a temp dir.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ownerId } from '../../hooks/owner'
import { isolatedEnv, ROOT, tempDir } from './helpers'

const OWNER_CLI = join(ROOT, 'bin', 'owner.ts')
const GOLDEN = join(ROOT, 'tests', 'fixtures', 'owner-golden.json')

function owner(...args: string[]) {
  const ran = Bun.spawnSync([process.execPath, OWNER_CLI, ...args], { env: { ...(process.env as Record<string, string>), ...isolatedEnv('owner-cli') }, stdout: 'pipe', stderr: 'pipe' })
  return { stdout: ran.stdout.toString(), stderr: ran.stderr.toString(), exitCode: ran.exitCode }
}

function git(cwd: string, ...args: string[]) {
  const ran = Bun.spawnSync(['git', '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'init.defaultBranch=main', ...args], {
    cwd,
    env: { ...(process.env as Record<string, string>), ...isolatedEnv('owner-git') },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (ran.exitCode !== 0) throw new Error(`git ${args.join(' ')} failed: ${ran.stderr.toString()}`)
}

describe('bun bin/owner.ts <path>', () => {
  const temp = tempDir('owner-cli')
  // tmpdir() on macOS is itself under a symlink (/var is /private/var): git reports the real path.
  const base = temp.dir
  const repo = join(base, 'switch-agent')
  const worktree = join(base, 'workspaces', 'bridge')
  const link = join(base, 'switch-link')
  beforeAll(() => {
    mkdirSync(join(repo, 'crates', 'switch-store'), { recursive: true })
    git(repo, 'init', '-q')
    writeFileSync(join(repo, 'README.md'), 'x\n')
    git(repo, 'add', 'README.md')
    git(repo, 'commit', '-q', '-m', 'init')
    mkdirSync(join(base, 'workspaces'))
    git(repo, 'worktree', 'add', '-q', '-b', 'bridge', worktree)
    symlinkSync(repo, link, 'dir')
  })
  afterAll(() => temp.dispose())

  test('--global prints global and nothing else', () => {
    expect(owner('--global')).toEqual({ stdout: 'global\n', stderr: '', exitCode: 0 })
  })

  test('a plain folder is hashed as given, never canonicalised', () => {
    const plain = join(base, 'notes')
    mkdirSync(plain)
    expect(owner(plain)).toEqual({ stdout: `${ownerId('per-project', plain)}\n`, stderr: '', exitCode: 0 })
    expect(owner(`${plain}/`).stdout).toBe(`${ownerId('per-project', plain)}\n`)
  })

  test('a folder inside a git repo gets the repo root, as git reports it', () => {
    const expected = `${ownerId('per-project', realpathSync(repo))}\n`
    expect(owner(repo).stdout).toBe(expected)
    expect(owner(join(repo, 'crates', 'switch-store')).stdout).toBe(expected)
  })

  test('a linked worktree resolves to the main worktree', () => {
    expect(owner(worktree)).toEqual({ stdout: `${ownerId('per-project', realpathSync(repo))}\n`, stderr: '', exitCode: 0 })
  })

  test('non-ASCII and astral folder names', () => {
    for (const name of ['naïve 日本語', 'emoji-😀']) {
      const dir = join(base, name)
      mkdirSync(dir)
      expect(owner(dir).stdout).toBe(`${ownerId('per-project', dir)}\n`)
    }
  })

  test('the symlink row: a path into a repo through a symlink gets the real root, not the lexical one', () => {
    const got = owner(join(link, 'crates')).stdout.trim()
    expect(got).toBe(ownerId('per-project', realpathSync(repo)))
    expect(got).not.toBe(ownerId('per-project', link))
  })

  test('a git failure other than "not a repository" exits 1 with git\'s message instead of hashing the folder', () => {
    const broken = join(base, 'broken-gitfile')
    mkdirSync(broken)
    writeFileSync(join(broken, '.git'), 'gitdir: /nonexistent/mnemosyne-test\n')
    const ran = owner(broken)
    expect([ran.exitCode, ran.stdout]).toEqual([1, ''])
    expect(ran.stderr.trim()).toStartWith(`owner: git rev-parse failed in ${broken}: fatal: not a git repository: `)
    expect(ran.stderr.trim().split('\n')).toHaveLength(1)
  })

  test('a git that fails for another reason (a stand-in on PATH) also exits 1 with its message', () => {
    const bin = join(base, 'fake-git-bin')
    mkdirSync(bin)
    writeFileSync(join(bin, 'git'), '#!/bin/sh\necho "fatal: detected dubious ownership in repository" >&2\nexit 128\n', { mode: 0o755 })
    const plain = join(base, 'plain-for-fake-git')
    mkdirSync(plain)
    const ran = Bun.spawnSync([process.execPath, OWNER_CLI, plain], { env: { ...(process.env as Record<string, string>), ...isolatedEnv('owner-fake-git'), PATH: `${bin}:${process.env.PATH ?? ''}` }, stdout: 'pipe', stderr: 'pipe' })
    expect(ran.exitCode).toBe(1)
    expect(ran.stderr.toString().trim()).toBe(`owner: git rev-parse failed in ${plain}: fatal: detected dubious ownership in repository`)
  })

  test('a missing path, a file, no argument and two arguments exit 1 with one line on stderr', () => {
    const file = join(base, 'file.txt')
    writeFileSync(file, 'x')
    for (const args of [[join(base, 'gone')], [file], [], ['a', 'b'], ['']]) {
      const ran = owner(...args)
      expect([args, ran.exitCode, ran.stdout]).toEqual([args, 1, ''])
      expect(ran.stderr).toStartWith('owner: ')
      expect(ran.stderr.trim().split('\n')).toHaveLength(1)
    }
  })
})

describe('the golden fixture Switch copies (tests/fixtures/owner-golden.json)', () => {
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8')) as {
    rows: { kind: string; scope: string; input: string; root: string | null; expected: string; lexicalRoot?: string; lexicalExpected?: string }[]
  }

  test('every row is ownerId over its root', () => {
    for (const row of golden.rows) {
      expect([row.kind, ownerId(row.scope, row.root ?? row.input)]).toEqual([row.kind, row.expected])
      if (row.lexicalRoot !== undefined) expect([row.kind, ownerId(row.scope, row.lexicalRoot)]).toEqual([row.kind, row.lexicalExpected ?? ''])
    }
  })

  test('it covers the kinds the plan names, and the symlink row records the divergence', () => {
    const kinds = golden.rows.map(row => row.kind)
    for (const kind of ['global', 'plain', 'git-repo', 'git-worktree', 'non-ascii', 'astral', 'symlink-into-repo']) expect(kinds).toContain(kind)
    const symlink = golden.rows.find(row => row.kind === 'symlink-into-repo')!
    expect(symlink.expected).not.toBe(symlink.lexicalExpected)
    for (const row of golden.rows) expect(row.expected).toMatch(/^(global|project-[A-Za-z0-9_-]{1,300})$/)
  })
})
