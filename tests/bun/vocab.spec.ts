// VOCAB.1 (C5): bin/vocab.ts, the shared tag vocabulary's one writer, run as a child process against a
// temporary store made by the real engine (engine/src/cli.ts): init seeds it read-only from the store,
// admit and alias change it, the file is mode 0600 and written by rename.
import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { admitTag, aliasTag, countTags, listVocabulary, projectNames, readVocabulary, writeVocabulary } from '../../bin/vocab'
import { AGENT_SEEDS, parseVocabulary } from '../../hooks/vocab'
import { body, engineCall, engineEnv, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const SCRIPT = join(ROOT, 'bin', 'vocab.ts')

/** Runs bin/vocab.ts as the hooks do. */
async function vocab(args: readonly string[]) {
  const child = Bun.spawn([process.execPath, SCRIPT, ...args], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

describe('bin/vocab.ts', () => {
  const temp = tempDir('vocab')
  const root = join(temp.dir, 'data')
  const store = join(root, 'store')
  const file = join(root, 'vocabulary.json')
  const mode = (path: string) => (statSync(path).mode & 0o777).toString(8)
  const read = () => JSON.parse(readFileSync(file, 'utf8')) as { version: number; tags: Record<string, any>; candidates: Record<string, any> }
  const rows = () => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      return JSON.stringify(db.query('SELECT * FROM working_memory ORDER BY id').all())
    } finally {
      db.close()
    }
  }

  async function remember(owner: string, content: string, tags: string[], scope = 'global') {
    const reply = body((await engineCall(CLI, store, owner, [toolCall(1, 'mnemopi_remember', { content, scope, metadata: { tags } })])).get(1))
    if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
  }

  beforeAll(async () => {
    await remember('global', 'the first note about reviewing a change', ['Code Review', 'git'])
    await remember('global', 'the second note about reviewing a change', ['code-review', 'git', 'solo-tag'])
    await remember('global', 'a note that names the codex agent here', ['agent:codex', 'my-repo'])
    await remember('project-My-Repo-1a2b', 'a project note kept in its own repository', ['my-repo', 'git'], 'channel')
    await remember('project-My-Repo-1a2b', 'another project note about code review', ['Code  Review', 'my repo'], 'channel')
  }, 120_000)
  afterAll(() => temp.dispose())

  test('VOCAB.1.a2: init seeds tags used on 2+ memories after folding, the agent seeds, and no project names; the store is only read', async () => {
    const before = rows()
    const ran = await vocab(['--store', store, 'init'])
    expect(ran.exitCode).toBe(0)
    expect(ran.stderr).toBe('')
    expect(JSON.parse(ran.stdout)).toMatchObject({ file, admitted: 2, seeded: 4, dropped: 1, kept: 0 })
    expect(rows()).toBe(before)

    const { version, tags, candidates } = read()
    expect(version).toBe(1)
    expect(candidates).toEqual({})
    // The agent seeds, then the two tags with 3 memories each (Code Review and code-review and "Code  Review" fold).
    expect(Object.keys(tags).sort()).toEqual(['agent:agy', 'agent:claude-code', 'agent:codex', 'agent:opencode', 'code-review', 'git'])
    expect(tags['code-review']).toEqual({ ns: null, description: '', aliases: [], admitted: 'init', count: 3 })
    expect(tags.git).toMatchObject({ ns: null, admitted: 'init', count: 3 })
    for (const seed of AGENT_SEEDS) expect(tags[seed.tag]).toMatchObject({ ns: 'agent', description: seed.description, aliases: [], admitted: 'seed' })
    // The codex seed counts the one memory that carries it.
    expect(tags['agent:codex'].count).toBe(1)
    expect(tags['agent:claude-code'].count).toBe(0)
    // Used once: not a tag. The project name, in either spelling: not a tag.
    expect(tags['solo-tag']).toBeUndefined()
    expect(tags['my-repo']).toBeUndefined()
    // No memory text reaches the file.
    expect(readFileSync(file, 'utf8')).not.toMatch(/note|repository|reviewing/)
  })

  test('VOCAB.1.a1: the file is 0600, written by rename (no temp file left), and parses as the C5 shape', () => {
    expect(mode(file)).toBe('600')
    expect(readdirSync(root).filter(name => name.includes('.tmp'))).toEqual([])
    expect(readFileSync(file, 'utf8').endsWith('\n')).toBe(true)
    const parsed = parseVocabulary(readFileSync(file, 'utf8'))
    expect(Object.keys(parsed).sort()).toEqual(['candidates', 'tags', 'version'])
    for (const entry of Object.values(parsed.tags)) expect(Object.keys(entry).sort()).toEqual(['admitted', 'aliases', 'count', 'description', 'ns'])
  })

  test('VOCAB.1.a1: a write keeps 0600 whatever the umask, and replaces the file by rename (same bytes for the same content)', () => {
    const vocabulary = readVocabulary(root)
    const before = readFileSync(file, 'utf8')
    const old = process.umask(0)
    try {
      writeVocabulary(root, vocabulary)
    } finally {
      process.umask(old)
    }
    expect(mode(file)).toBe('600')
    expect(readFileSync(file, 'utf8')).toBe(before)
    expect(readdirSync(root).filter(name => name.includes('.tmp'))).toEqual([])
  })

  test('VOCAB.1.a3: init refuses to overwrite an existing file without --force, and leaves it untouched', async () => {
    const before = readFileSync(file, 'utf8')
    const ran = await vocab(['--store', store, 'init'])
    expect(ran.exitCode).toBe(1)
    expect(ran.stderr).toContain('already exists')
    expect(ran.stderr).toContain('--force')
    expect(ran.stdout).toBe('')
    expect(readFileSync(file, 'utf8')).toBe(before)
  })

  test('VOCAB.1.a2: admit adds a tag in the C6 format with its namespace, from a candidate when it is one; admitting again changes nothing', async () => {
    const ran = await vocab(['--root', root, 'admit', 'Asset: Build Server', '--description', 'the CI box'])
    expect(ran.exitCode).toBe(0)
    expect(JSON.parse(ran.stdout)).toEqual({ tag: 'asset:build-server', status: 'admitted' })
    expect(read().tags['asset:build-server']).toEqual({ ns: 'asset', description: 'the CI box', aliases: [], admitted: 'manual', count: 0 })
    expect(mode(file)).toBe('600')

    const again = await vocab(['--root', root, 'admit', 'asset:build-server'])
    expect(JSON.parse(again.stdout)).toEqual({ tag: 'asset:build-server', status: 'already admitted' })
    expect(read().tags['asset:build-server'].description).toBe('the CI box')

    // A candidate moves out of the candidates, its count carried.
    const vocabulary = readVocabulary(root)
    vocabulary.candidates['new-idea'] = { count: 2, firstSeen: '2026-10-24T00:00:00.000Z' }
    writeVocabulary(root, vocabulary)
    const fromCandidate = await vocab(['--root', root, 'admit', 'New Idea'])
    expect(JSON.parse(fromCandidate.stdout).status).toBe('admitted')
    expect(read().tags['new-idea']).toMatchObject({ ns: null, admitted: 'manual', count: 2 })
    expect(read().candidates['new-idea']).toBeUndefined()

    // With --store the count is read from the store (a tag used once is still a tag when a person admits it).
    const counted = await vocab(['--store', store, 'admit', 'solo-tag'])
    expect(counted.exitCode).toBe(0)
    expect(read().tags['solo-tag'].count).toBe(1)
  })

  test('VOCAB.1.a2: admit refuses an unusable tag, an option-looking one, and a spelling that is an alias', async () => {
    for (const tag of ['!!!', '   ']) {
      const ran = await vocab(['--root', root, 'admit', tag])
      expect(ran.exitCode).toBe(1)
      expect(ran.stderr).toContain('not a usable tag')
    }
    expect((await vocab(['--root', root, 'admit', '--force'])).exitCode).toBe(1)
    expect((await vocab(['--root', root, 'admit', 'a', 'b'])).exitCode).toBe(1)
    expect((await vocab(['--root', root, 'admit', 'a', '--description'])).exitCode).toBe(1)
  })

  test('VOCAB.1.a2: alias makes a spelling fold into an admitted tag, dropping it from the candidates', async () => {
    const vocabulary = readVocabulary(root)
    vocabulary.candidates.review = { count: 1, firstSeen: '2026-10-24T00:00:00.000Z' }
    writeVocabulary(root, vocabulary)
    const ran = await vocab(['--root', root, 'alias', 'Review', 'Code Review'])
    expect(ran.exitCode).toBe(0)
    expect(JSON.parse(ran.stdout)).toEqual({ from: 'review', to: 'code-review' })
    expect(read().tags['code-review'].aliases).toEqual(['review'])
    expect(read().candidates.review).toBeUndefined()
    expect(mode(file)).toBe('600')
    // An alias of an alias lands on the tag itself.
    const chained = await vocab(['--root', root, 'alias', 'pr-review', 'review'])
    expect(JSON.parse(chained.stdout)).toEqual({ from: 'pr-review', to: 'code-review' })
    expect(read().tags['code-review'].aliases).toEqual(['pr-review', 'review'])
    // Admitting a spelling that is an alias is refused.
    const admit = await vocab(['--root', root, 'admit', 'review'])
    expect(admit.exitCode).toBe(1)
    expect(admit.stderr).toContain('alias of code-review')
    // Pointing a spelling elsewhere moves it.
    const moved = await vocab(['--root', root, 'alias', 'review', 'git'])
    expect(JSON.parse(moved.stdout)).toEqual({ from: 'review', to: 'git', moved: 'code-review' })
    expect(read().tags.git.aliases).toEqual(['review'])
    expect(read().tags['code-review'].aliases).toEqual(['pr-review'])
  })

  test('VOCAB.1.a2: alias refuses an unadmitted target, an admitted tag as the spelling, itself, and bad input', async () => {
    const before = readFileSync(file, 'utf8')
    const cases: [string[], string][] = [
      [['alias', 'x-thing', 'not-admitted'], 'not an admitted tag'],
      [['alias', 'git', 'code-review'], 'admitted tag, not a spelling'],
      [['alias', 'git', 'git'], 'itself'],
      [['alias', '!!!', 'git'], 'not a usable tag'],
      [['alias', 'a-thing', '!!!'], 'not a usable tag'],
    ]
    for (const [args, message] of cases) {
      const ran = await vocab(['--root', root, ...args])
      expect(ran.exitCode).toBe(1)
      expect(ran.stderr).toContain(message)
    }
    expect((await vocab(['--root', root, 'alias', 'only-one'])).exitCode).toBe(1)
    expect((await vocab(['--root', root, 'alias', '--x', 'git'])).exitCode).toBe(1)
    expect(readFileSync(file, 'utf8')).toBe(before)
  })

  test('VOCAB.1.a2: list prints the admitted tags and the candidates, most used first', async () => {
    const vocabulary = readVocabulary(root)
    vocabulary.candidates['maybe-a'] = { count: 1, firstSeen: '2026-10-24T00:00:00.000Z' }
    vocabulary.candidates['maybe-b'] = { count: 2, firstSeen: '2026-10-25T00:00:00.000Z' }
    writeVocabulary(root, vocabulary)
    const ran = await vocab(['--root', root, 'list'])
    expect(ran.exitCode).toBe(0)
    const listed = JSON.parse(ran.stdout) as { file: string; tags: { tag: string; count: number; aliases: string[] }[]; candidates: { tag: string; count: number }[] }
    expect(listed.file).toBe(file)
    expect(listed.tags.map(tag => tag.count)).toEqual([...listed.tags.map(tag => tag.count)].sort((a, b) => b - a))
    expect(listed.tags.find(tag => tag.tag === 'git')).toMatchObject({ count: 3, aliases: ['review'] })
    expect(listed.candidates.map(candidate => candidate.tag)).toEqual(['maybe-b', 'maybe-a'])
    expect(listVocabulary(root).tags.length).toBe(listed.tags.length)
    expect((await vocab(['--root', root, 'list', 'extra'])).exitCode).toBe(1)
  })

  test('VOCAB.1.a3: init --force rebuilds from the store but keeps hand-admitted tags, their text, and the aliases whose tag survives', async () => {
    const ran = await vocab(['--store', store, 'init', '--force'])
    expect(ran.exitCode).toBe(0)
    const result = JSON.parse(ran.stdout)
    expect(result.kept).toBeGreaterThan(0)
    const { tags, candidates } = read()
    // The curated state is still there ...
    expect(tags['asset:build-server']).toMatchObject({ admitted: 'manual', description: 'the CI box' })
    expect(tags['new-idea']).toMatchObject({ admitted: 'manual' })
    expect(tags.git.aliases).toEqual(['review'])
    expect(tags['code-review'].aliases).toEqual(['pr-review'])
    // ... the counts are the store's again (and the 'review' spelling folds into git, so the folded counts follow it) ...
    expect(tags.git.count).toBe(3)
    expect(tags['solo-tag']).toMatchObject({ admitted: 'manual', count: 1 })
    // ... and candidates are rebuilt empty.
    expect(candidates).toEqual({})
    expect(mode(file)).toBe('600')
  })

  test('VOCAB.1: init --force over a damaged file rebuilds it; init over nothing creates the root folder', async () => {
    writeFileSync(file, 'not json')
    expect((await vocab(['--store', store, 'init'])).exitCode).toBe(1)
    const forced = await vocab(['--store', store, 'init', '--force'])
    expect(forced.exitCode).toBe(0)
    expect(read().version).toBe(1)
    // A store whose parent does not exist yet: init creates the root, 0700, and seeds only the agents.
    const fresh = join(temp.dir, 'fresh', 'store')
    const made = await vocab(['--store', fresh, 'init'])
    expect(made.exitCode).toBe(0)
    expect(Object.keys(JSON.parse(readFileSync(join(temp.dir, 'fresh', 'vocabulary.json'), 'utf8')).tags).sort()).toEqual(['agent:agy', 'agent:claude-code', 'agent:codex', 'agent:opencode'])
    expect(mode(join(temp.dir, 'fresh'))).toBe('700')
    expect(existsSync(fresh)).toBe(false)
  })

  test('VOCAB.1: the other commands refuse a missing file, a missing root and a bad command line', async () => {
    const none = join(temp.dir, 'nowhere')
    const missing = await vocab(['--root', none, 'list'])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr).toContain('run init first')
    expect((await vocab(['list'])).stderr).toContain('needs --root')
    expect((await vocab(['--store', store])).exitCode).toBe(1)
    expect((await vocab(['--store', store, 'frobnicate'])).exitCode).toBe(1)
    expect((await vocab(['init'])).stderr).toContain('--store')
    expect((await vocab(['--store', store, '--store', store, 'list'])).exitCode).toBe(1)
    expect((await vocab(['--store', '--root', 'list'])).exitCode).toBe(1)
    expect((await vocab(['--store', store, 'init', '--bogus'])).exitCode).toBe(1)
    expect((await vocab(['--store', store, 'list', '--root', root])).exitCode).toBe(1)
  })

  test('VOCAB.1: countTags and projectNames, the pure parts of init', () => {
    const counts = countTags([['Code Review', 'code-review', 'git'], ['git'], ['Code  Review', 'x']], new Map([['x', 'git']]))
    expect(Object.fromEntries(counts)).toEqual({ 'code-review': 2, git: 3 })
    expect(Object.fromEntries(countTags([['a', 'b']], new Map(), new Set(['a'])))).toEqual({ b: 1 })
    expect([...projectNames(['global', 'project-My-Repo-1a2b', 'project-x-9z', 'project--'])].sort()).toEqual(['my-repo', 'x'])
  })

  test('VOCAB.1: admitTag and aliasTag are the same code the commands run', () => {
    const local = tempDir('vocab-fn')
    try {
      const home = join(local.dir, 'data')
      writeVocabulary(home, { version: 1, tags: { git: { ns: null, description: '', aliases: [], admitted: 'init', count: 4 } }, candidates: {} })
      expect(admitTag(home, 'GitHub')).toEqual({ tag: 'github', status: 'admitted' })
      expect(aliasTag(home, 'gh', 'github')).toEqual({ from: 'gh', to: 'github' })
      expect(readVocabulary(home).tags.github!.aliases).toEqual(['gh'])
    } finally {
      local.dispose()
    }
  })
})

// VOCAB.2 (C6): the proxy cleans tags with the vocabulary (aliases folded, the owner's project name dropped), and
// tags already stored are read as they are. The real proxy and the real engine; no model.
describe('VOCAB.2: tags through the real proxy and the real store', () => {
  const temp = tempDir('vocab-proxy')
  const root = join(temp.dir, 'data')
  const store = join(root, 'store')
  const file = join(root, 'vocabulary.json')
  const PROXY = join(ROOT, 'bin', 'mcp-proxy.ts')
  afterAll(() => temp.dispose())

  /** One proxy process for `owner`: sends the calls, returns the replies by id. */
  async function proxy(owner: string, calls: readonly [string, Record<string, unknown>][], env: Record<string, string> = {}) {
    const child = Bun.spawn([process.execPath, PROXY], {
      env: { ...(process.env as Record<string, string>), ...engineEnv(store, owner), MNEMOSYNE_CLI: CLI, MNEMOSYNE_ACTIVITY_LOG: '', MNEMOSYNE_VOCABULARY: file, ...env },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    child.stdin.write(calls.map(([name, args], i) => `${JSON.stringify(toolCall(i + 1, name, args))}\n`).join(''))
    child.stdin.end()
    const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    const replies = new Map<unknown, any>()
    for (const line of stdout.split('\n')) {
      try {
        const message = JSON.parse(line)
        if (message?.id !== undefined) replies.set(message.id, message)
      } catch {
        // not JSON
      }
    }
    if (replies.size === 0) throw new Error(`proxy gave no replies: ${stderr.slice(-400)}`)
    return replies
  }
  const idOf = (reply: any) => JSON.parse(String(reply.result.content[0].text).split('\nMnemosyne')[0]!).memory_id as string
  const tagsOf = (id: string) => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      const row = db.query('SELECT metadata_json FROM working_memory WHERE id = ?').get(id) as { metadata_json: string | null }
      return row.metadata_json === null ? null : (JSON.parse(row.metadata_json).tags as string[] | undefined)
    } finally {
      db.close()
    }
  }

  test('VOCAB.2.a3: remember and update through the proxy fold aliases, put tags in the C6 format and drop the owner\'s project name', async () => {
    writeVocabulary(root, {
      version: 1,
      tags: { 'code-review': { ns: null, description: '', aliases: ['review', 'pr-review'], admitted: 'init', count: 3 } },
      candidates: {},
    })
    const owner = 'project-My-Repo-1a2b'
    const saved = await proxy(owner, [['memory_remember', { content: 'A note saved through the proxy with tags.', kind: 'fact', tags: ['PR Review', 'My Repo', 'Build Server', 'entity: Rohit'] }]])
    const id = idOf(saved.get(1))
    expect(tagsOf(id)).toEqual(['code-review', 'build-server', 'entity:rohit'])
    const updated = await proxy(owner, [['memory_update', { memory_id: id, tags: ['Review', 'my repo', 'Asset: CI Box'] }]])
    expect(JSON.parse(updated.get(1).result.content[0].text)).toMatchObject({ status: 'updated' })
    expect(tagsOf(id)).toEqual(['code-review', 'asset:ci-box'])
  })

  test('VOCAB.2.a3: a vocabulary the proxy cannot read, or none set, gives the format only and the call still works', async () => {
    writeFileSync(file, 'not json')
    const bad = await proxy('global', [['memory_remember', { content: 'A note saved while the vocabulary is broken.', kind: 'fact', tags: ['Review', 'Code Review'] }]])
    expect(tagsOf(idOf(bad.get(1)))).toEqual(['review', 'code-review'])
    const unset = await proxy('global', [['memory_remember', { content: 'A note saved while no vocabulary is set.', kind: 'fact', tags: ['Git Commit'] }]], { MNEMOSYNE_VOCABULARY: '' })
    expect(tagsOf(idOf(unset.get(1)))).toEqual(['git-commit'])
  })

  test('VOCAB.2.a3: tags already stored are read and shown as they were written, not cleaned', async () => {
    // Written the old way, straight through the engine: spaces, capitals, a project name, an emoji.
    const reply = body((await engineCall(CLI, store, 'global', [toolCall(1, 'mnemopi_remember', { content: 'An older note with free-form tags on it.', scope: 'global', metadata: { tags: ['Old Style Tag', 'my repo', '🚀 launch', 'abcdefghijklmnopqrstuvwxyz0123456789'] } })])).get(1))
    const id = reply!.memory_id as string
    const ran = Bun.spawn([process.execPath, join(ROOT, 'bin', 'memories.ts'), '--store', store, 'get', id], { stdout: 'pipe', stderr: 'pipe' })
    const out = JSON.parse(await new Response(ran.stdout).text()) as { metadata: { tags: string[] } }[]
    await ran.exited
    expect(out[0]!.metadata.tags).toEqual(['Old Style Tag', 'my repo', '🚀 launch', 'abcdefghijklmnopqrstuvwxyz0123456789'])
    expect(tagsOf(id)).toEqual(['Old Style Tag', 'my repo', '🚀 launch', 'abcdefghijklmnopqrstuvwxyz0123456789'])
  })
})
