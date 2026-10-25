// KNOWX R3: specs through the REAL host (knowledge-host.ts: real hooks, real engine,
// real bin/memories.ts; only the model is a stand-in). Each fails on 5daf6b1.
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GOOD_REPLY, makeHost, until } from './knowledge-host'
import type { Host, ModelAnswer } from './knowledge-host'
import { body, engineCall, isolatedEnv, ROOT, tempDir, toolCall } from './helpers'

setDefaultTimeout(30_000)
const hosts: Host[] = []
const open = async (...args: Parameters<typeof makeHost>) => {
  const host = await makeHost(...args)
  hosts.push(host)
  return host
}
afterEach(() => {
  for (const host of hosts.splice(0)) host.dispose()
})

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const MEMORIES = join(ROOT, 'bin', 'memories.ts')
const nothing = (): ModelAnswer => ({ isAnswered: true, text: '{}' })
const good = (): ModelAnswer => ({ isAnswered: true, text: GOOD_REPLY })

/** Stores memories straight through the real engine (no hook, so no extraction); the new ids in order. */
async function seed(host: Host, contents: readonly string[]) {
  mkdirSync(host.store, { recursive: true })
  const replies = await engineCall(
    CLI,
    host.store,
    'global',
    contents.map((content, i) => toolCall(i + 1, 'mnemopi_remember', { content, source: 'imported', scope: 'global', author_id: 'claude-code', author_type: 'agent' })),
  )
  return contents.map((_, i) => body(replies.get(i + 1)).memory_id as string)
}

/** Runs the real bin/memories.ts; the exit code and stderr. */
async function memories(args: string[], stdin?: string) {
  const child = Bun.spawn([process.execPath, MEMORIES, ...args], {
    env: { ...(process.env as Record<string,string>), ...isolatedEnv() },
    stdin: stdin === undefined ? 'ignore' : new Blob([stdin]),
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

describe('fix 1: the empty marker is written', () => {
  test('an empty model reply leaves a 0600 knowledge-empty.json, the dry run counts it, and a second apply makes no model call', async () => {
    const host = await open({ model: nothing })
    const [id] = await seed(host, ['a note that holds no facts'])
    const first = await host.command('mnemosyne-knowledge', 'apply')
    expect(first.text).toContain('1 found nothing')
    expect(host.model.length).toBe(1)
    // The file exists, owner-only, and names the memory.
    const file = join(host.root, 'knowledge-empty.json')
    expect(existsSync(file)).toBe(true)
    expect(host.mode(file)).toBe('600')
    expect(JSON.parse(readFileSync(file, 'utf8')).empty).toMatchObject([{ id }])
    // Every `bun -e` the hooks ran exited 0.
    const scripts = host.runs.filter(run => run.argv[1] === '-e')
    expect(scripts.length).toBeGreaterThan(0)
    expect(scripts.map(run => run.exitCode)).toEqual(scripts.map(() => 0))
    const dry = await host.command('mnemosyne-knowledge')
    expect(dry.text).toContain('1 memory already tried')
    const second = await host.command('mnemosyne-knowledge', 'apply')
    expect(second.text).toContain('Nothing to extract')
    expect(host.model.length).toBe(1)
  })
})

describe('fix 2: the pending file is written before the queue', () => {
  test('5 quick saves, the session ends after the first model call: all 5 have pending files', async () => {
    const waiting: ((answer: ModelAnswer) => void)[] = []
    let open_ = false
    // Calls stay open until released; once released, later calls answer at once.
    const host = await open({ model: () => (open_ ? good() : new Promise<ModelAnswer>(resolve => waiting.push(resolve))) })
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const saved = await host.tool('memory_remember', { kind: 'fact', content: `quick save number ${i} about topic${i}` })
      ids.push(JSON.parse(saved.result!).memory_id as string)
    }
    await until('5 pending files', () => host.pending().length === 5)
    // Only the first save reached the model: the others wait their turn, but are already on disk.
    expect(host.model.length).toBe(1)
    expect(host.pending()).toEqual(ids.map(id => `${id}.json`).sort())
    open_ = true
    for (const release of waiting) release(good())
    // The queue then runs on: each save is extracted in its turn and its file removed.
    await until('every pending file removed', () => host.pending().length === 0 && host.extractLines().length === 5, 20_000)
    expect(host.model.length).toBe(5)
  })
})

describe('fix 3: pending write and remove-many are all or nothing', () => {
  const sha = 'a'.repeat(64)
  test('pending write of [dd, ../x, ee] exits 1 and writes nothing', async () => {
    const root = tempDir('r3-write')
    try {
      const out = await memories(['pending', 'write', root.dir], JSON.stringify([{ id: 'dd', owner: 'global', sha256: sha }, { id: '../x', owner: 'global', sha256: sha }, { id: 'ee', owner: 'global', sha256: sha }]))
      expect(out.exitCode).toBe(1)
      expect(existsSync(join(root.dir, 'knowledge-pending', 'dd.json'))).toBe(false)
      expect(existsSync(join(root.dir, 'knowledge-pending', 'ee.json'))).toBe(false)
      // A bad sha in a later entry stops the whole list too.
      const bad = await memories(['pending', 'write', root.dir], JSON.stringify([{ id: 'dd', owner: 'global', sha256: sha }, { id: 'ee', owner: 'global', sha256: 'nope' }]))
      expect(bad.exitCode).toBe(1)
      expect(existsSync(join(root.dir, 'knowledge-pending', 'dd.json'))).toBe(false)
    } finally {
      root.dispose()
    }
  })

  test('pending remove-many of [aa, ../victim, bb] exits 1 and removes nothing', async () => {
    const root = tempDir('r3-remove')
    try {
      const wrote = await memories(['pending', 'write', root.dir], JSON.stringify([{ id: 'aa', owner: 'global', sha256: sha }, { id: 'bb', owner: 'global', sha256: sha }]))
      expect(wrote.exitCode).toBe(0)
      writeFileSync(join(root.dir, 'victim.json'), '{}')
      const out = await memories(['pending', 'remove-many', root.dir], JSON.stringify([{ id: 'aa' }, { id: '../victim' }, { id: 'bb' }]))
      expect(out.exitCode).toBe(1)
      expect(existsSync(join(root.dir, 'knowledge-pending', 'aa.json'))).toBe(true)
      expect(existsSync(join(root.dir, 'knowledge-pending', 'bb.json'))).toBe(true)
      expect(existsSync(join(root.dir, 'victim.json'))).toBe(true)
    } finally {
      root.dispose()
    }
  })

  test('a batch with one non-hex row id still stores the others', async () => {
    const host = await open({ model: good })
    const [a, b, c] = await seed(host, ['alpha fact one', 'bravo fact two', 'charlie fact three'])
    const db = new Database(join(host.store, 'mnemopi.db'))
    try {
      db.run('UPDATE working_memory SET id = ? WHERE id = ?', ['not-hex-id', b!])
    } finally {
      db.close()
    }
    const out = await host.command('mnemosyne-knowledge', 'apply')
    // The two good rows are stored, whatever happens to the bad one.
    expect(out.text).toContain('Extracted knowledge for 2 of')
    const check = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
    try {
      for (const id of [a!, c!]) {
        const n = (check.query('SELECT COUNT(*) AS n FROM memoria_facts WHERE source_memory_id = ?').get(id) as { n: number }).n
        expect(n).toBeGreaterThan(0)
      }
    } finally {
      check.close()
    }
    expect(host.pending()).toEqual([])
  })
})
