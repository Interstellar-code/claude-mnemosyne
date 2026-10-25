// MAPX.8 / C12: the project registry's pure parts, hooks/projects.ts: the remote's host
// and the registry file's parse, merge and format. The hook side (what a session start
// hands to the writer) is in tests/register.test.ts; the writer's real-file cases (modes,
// firstSeen kept across writes, a corrupt file rebuilt, no URL or token written, exit 0)
// are in tests/bun/projects.spec.ts, because this folder is typed and run without Node or
// Bun (no file work, no dynamic import).
import { expect, test } from 'claude-code/testing'
import { formatProjects, MAX_NAME, mergeProject, parseProjects, projectName, remoteHostOf, sanitizeInput } from '../hooks/projects'

const OWNER = 'project-My-Repo-apu5fc'
const input = (over: Record<string, unknown> = {}) => ({ owner: OWNER, name: 'My Repo', kind: 'repo', remoteHost: 'github.com', ...over })

// ---- remoteHostOf ----

test('MAPX.8: every remote form gives its host alone: lower-case, no user, password, token or port', () => {
  const hosts: Record<string, string> = {
    'git@github.com:o/r.git': 'github.com',
    'github.com:o/r.git': 'github.com',
    'https://user:token@github.com/o/r.git': 'github.com',
    'https://ghp_abcdef0123456789@GitHub.com/o/r.git': 'github.com',
    'https://user:p@ss@github.com/o/r.git': 'github.com',
    'https://github.com:8443/o/r.git': 'github.com',
    'ssh://git@host:22/o/r': 'host',
    'ssh://git@Host.Example.ORG:22/o/r': 'host.example.org',
    'git://example.org/o/r.git': 'example.org',
    'git+ssh://git@example.org/o/r': 'example.org',
    'http://[::1]:3000/o/r': '::1',
    'https://github.com./o/r': 'github.com',
    '  git@gitlab.com:o/r.git  ': 'gitlab.com',
  }
  for (const [remote, host] of Object.entries(hosts)) expect(remoteHostOf(remote)).toBe(host)
})

test('MAPX.8: a password with a raw slash in it still gives the host: everything up to the last @ is user info', () => {
  expect(remoteHostOf('https://user:12/34@host/r')).toBe('host')
  expect(remoteHostOf('https://user:12/34@Host.Example.org:8443/o/r.git')).toBe('host.example.org')
  expect(remoteHostOf('https://u:p/a/b@c@github.com/o/r.git')).toBe('github.com')
  expect(remoteHostOf('ssh://git:s3/cret@git.example.org/o/r')).toBe('git.example.org')
})

test('MAPX.8: an @ in the path is not user info: the host is read from the authority, with or without a port', () => {
  expect(remoteHostOf('https://github.com/o/r@x')).toBe('github.com')
  expect(remoteHostOf('https://host.com/path/with@at')).toBe('host.com')
  expect(remoteHostOf('https://user@Host.com/path/with@at')).toBe('host.com')
  expect(remoteHostOf('https://github.com:8443/o/r.git')).toBe('github.com')
  expect(remoteHostOf('https://github.com/o/r.git?ref=a@b#c@d')).toBe('github.com')
})

test("MAPX.8: a remote with no network host gives 'local'", () => {
  for (const remote of ['/srv/git/r.git', '../r.git', './r', '~/code/r', 'r', 'file:///srv/git/r.git', 'file://localhost/srv/r', 'C:\\code\\r', 'C:/code/r', '/a/b:c', 'https:///o/r']) {
    expect(remoteHostOf(remote)).toBe('local')
  }
})

test('MAPX.8: no remote gives null', () => {
  for (const remote of [null, undefined, '', '   ']) expect(remoteHostOf(remote)).toBeNull()
})

test('MAPX.8: what remoteHostOf returns holds no user, token, port or path, whatever the remote looks like', () => {
  const remotes = ['https://user:token@github.com/o/r.git', 'ssh://git@host:22/o/r', 'https://user:to/ken@github.com/o/r.git', 'https://u:t@h:notaport/x', 'git@bad host:o/r']
  for (const remote of remotes) {
    const host = remoteHostOf(remote)
    expect(host === 'local' || /^[a-z0-9.:-]+$/.test(host ?? '')).toBe(true)
    expect(host).not.toMatch(/token|user|ghp_|\/|@/)
  }
})

test('MAPX.8: projectName is the last segment of the folder', () => {
  expect(projectName('/work/My Repo')).toBe('My Repo')
  expect(projectName('C:\\Users\\u\\code\\app')).toBe('app')
  expect(projectName('/')).toBe('root')
  expect(projectName('/a/b/')).toBe('b')
})

// ---- parse, merge, format ----

test('MAPX.8: parseProjects gives an empty registry for text that is missing, corrupt or the wrong shape', () => {
  const empty = { version: 1, projects: {} }
  for (const text of [undefined, '', '  ', '{not json', '[]', 'null', '"x"', '{}', '{"projects":[]}', '{"projects":null}']) expect(parseProjects(text)).toEqual(empty)
})

test('MAPX.8: parseProjects keeps the records that check out and drops the rest', () => {
  const good = { name: 'My Repo', kind: 'repo', remoteHost: 'github.com', firstSeen: '2026-10-01', lastSeen: '2026-10-25' }
  // JSON.parse makes '__proto__' an own key, as a file on disk would.
  const proto = JSON.parse(`{"version":1,"projects":{"__proto__":${JSON.stringify(good)}}}`)
  expect(Object.keys(parseProjects(JSON.stringify(proto)).projects)).toEqual([])
  const file = parseProjects(
    JSON.stringify({
      version: 1,
      projects: {
        [OWNER]: good,
        global: good,
        'project-a-1': { ...good, kind: 'planet' },
        'project-b-1': { ...good, remoteHost: 'https://u:t@github.com/o/r' },
        'project-c-1': { ...good, lastSeen: 'yesterday' },
        'project-d-1': 'x',
        'project-e-1': { ...good, remoteHost: null, kind: 'folder' },
      },
    }),
  )
  expect(Object.keys(file.projects).sort()).toEqual(['project-My-Repo-apu5fc', 'project-e-1'])
  expect(file.projects[OWNER]).toEqual(good)
})

test('MAPX.8: mergeProject keeps firstSeen, moves lastSeen, and follows the latest name, kind and host', () => {
  const first = mergeProject(parseProjects(undefined), sanitizeInput(input({ remoteHost: null }))!, '2026-10-20')
  expect(first.projects[OWNER]).toEqual({ name: 'My Repo', kind: 'repo', remoteHost: null, firstSeen: '2026-10-20', lastSeen: '2026-10-20' })
  const second = mergeProject(first, sanitizeInput(input({ name: 'Renamed', remoteHost: 'github.com' }))!, '2026-10-25')
  expect(second.projects[OWNER]).toEqual({ name: 'Renamed', kind: 'repo', remoteHost: 'github.com', firstSeen: '2026-10-20', lastSeen: '2026-10-25' })
  expect(first.projects[OWNER]!.lastSeen).toBe('2026-10-20') // the earlier registry is not changed
})

test('MAPX.8: formatProjects sorts the owners, ends with a newline and round-trips through parseProjects', () => {
  let file = parseProjects(undefined)
  for (const owner of ['project-b-2', 'project-a-1']) file = mergeProject(file, sanitizeInput(input({ owner }))!, '2026-10-25')
  const text = formatProjects(file)
  expect(text.endsWith('\n')).toBe(true)
  expect(Object.keys(JSON.parse(text).projects)).toEqual(['project-a-1', 'project-b-2'])
  expect(parseProjects(text)).toEqual(file)
})

test('MAPX.8: a long folder name is kept: the display name is cut, the owner is not', () => {
  const long = 'x'.repeat(250)
  const owner = `project-${long}-1a2b3c4`
  expect(projectName(`/work/${long}`)).toBe('x'.repeat(MAX_NAME))
  const input = { owner, name: projectName(`/work/${long}`), kind: 'folder', remoteHost: null }
  expect(sanitizeInput(input)).toEqual(input)
  expect(sanitizeInput({ ...input, name: long })?.name).toBe('x'.repeat(MAX_NAME)) // a long name in the input is cut, not refused
  const file = mergeProject(parseProjects(undefined), sanitizeInput(input)!, '2026-10-25')
  expect(parseProjects(formatProjects(file)).projects[owner]?.name).toBe('x'.repeat(MAX_NAME))
})

test('MAPX.8: sanitizeInput refuses the global owner, a bad kind and any host that is not a bare host', () => {
  expect(sanitizeInput(input())).toEqual(input())
  expect(sanitizeInput(JSON.stringify(input({ remoteHost: 'local' })))).toEqual(input({ remoteHost: 'local' }))
  expect(sanitizeInput(input({ kind: 'folder', remoteHost: 'github.com' }))).toEqual(input({ kind: 'folder', remoteHost: null })) // a folder has no remote
  for (const bad of [
    input({ owner: 'global' }),
    input({ owner: '__proto__' }),
    input({ kind: 'planet' }),
    input({ name: '  ' }),
    input({ remoteHost: 'https://user:token@github.com/o/r.git' }),
    input({ remoteHost: 'git@github.com:o/r.git' }),
    input({ remoteHost: 'github.com:22' }),
    input({ remoteHost: 'user@github.com' }),
    input({ remoteHost: 7 }),
    '{not json',
    'null',
    [],
  ]) {
    expect(sanitizeInput(bad)).toBeNull()
  }
})
