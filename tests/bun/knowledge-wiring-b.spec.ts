// KNOWX R2 (part B): more register-level specs over the real wiring. The hooks are
// the real hooks/register.ts; the engine, bin/memories.ts and bin/activity.ts are the
// real ones over a temp HOME (see knowledge-host.ts); only the model call is a
// stand-in. Memories that must NOT start an extraction are stored straight through
// the real engine (`seed`, owner 'global'), because the extraction setting is fixed
// per host.
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { GOOD_REPLY, makeHost, until } from './knowledge-host'
import type { Host, ModelAnswer, Ran } from './knowledge-host'
import { body, engineCall, engineEnv, isolatedEnv, ROOT, tempDir, toolCall } from './helpers'

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
const TRIGGER = { rememberTerms: 'remember that' }
const good = (): ModelAnswer => ({ isAnswered: true, text: GOOD_REPLY })
const failed = (): ModelAnswer => ({ isAnswered: false, reason: 'api-error', status: 500, error: 'boom' })

/** Stores memories straight through the real engine (no hook, so no extraction); the new ids in order. */
async function seed(host: Host, contents: readonly string[], owner = 'global') {
  mkdirSync(host.store, { recursive: true })
  const replies = await engineCall(
    CLI,
    host.store,
    owner,
    contents.map((content, i) => toolCall(i + 1, 'mnemopi_remember', { content, source: 'imported', scope: 'global', author_id: 'claude-code', author_type: 'agent' })),
  )
  return contents.map((_, i) => body(replies.get(i + 1)).memory_id as string)
}

/** Runs `fn` on the host's store; read-only unless asked otherwise. */
function withDb<T>(host: Host, fn: (db: Database) => T, writable = false): T {
  const db = new Database(join(host.store, 'mnemopi.db'), writable ? undefined : { readonly: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
const rowsOf = (host: Host) =>
  withDb(host, db => db.query('SELECT id, content, author_id, author_type, veracity, trust_tier FROM working_memory ORDER BY timestamp, id').all() as Record<string, string>[])
const factsOf = (host: Host, id: string) =>
  withDb(host, db => (db.query('SELECT value FROM memoria_facts WHERE source_memory_id = ? ORDER BY id').all(id) as { value: string }[]).map(row => row.value))
const countFacts = (host: Host) => withDb(host, db => (db.query('SELECT COUNT(*) AS n FROM memoria_facts').get() as { n: number }).n)

/** A child process's subcommand for bin/memories.ts, after the optional `--store <dir>` pair. */
const sub = (run: Ran) => {
  const rest = run.argv.slice(2)
  return rest[0] === '--store' ? rest.slice(2) : rest
}
const memoriesOf = (runs: readonly Ran[], ...words: string[]) =>
  runs.filter(run => String(run.argv[1] ?? '').endsWith('/bin/memories.ts') && words.every((word, i) => sub(run)[i] === word))
const enginesOf = (runs: readonly Ran[]) => runs.filter(run => run.argv[2] === 'mcp')
const requestNames = (run: Ran) =>
  (run.stdin ?? '')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line).params.name as string)
const activityRuns = (runs: readonly Ran[]) => runs.filter(run => String(run.argv[1] ?? '').endsWith('/bin/activity.ts'))

/** A model whose calls stay open until the test releases them, in order. */
function heldModel() {
  const waiting: ((answer: ModelAnswer) => void)[] = []
  return { waiting, model: () => new Promise<ModelAnswer>(resolve => waiting.push(resolve)) }
}

/** Waits a moment for something that must NOT happen (there is nothing to wait for). */
const settle = () => Bun.sleep(500)

describe('spec 1: process counts of /mnemosyne-knowledge apply', () => {
  test('spec 1a: 5 memories, one owner: 5 model calls, ONE prompt engine + ONE store engine, ONE pending write, ONE remove-many, ONE activity append', async () => {
    const host = await open({ model: good })
    await seed(host, ['alpha fact', 'bravo fact', 'charlie fact', 'delta fact', 'echo fact'])
    const before = host.runs.length
    const out = await host.command('mnemosyne-knowledge', 'apply')
    expect(out.text).toContain('Extracted knowledge for 5 of 5 memories')
    const runs = host.runs.slice(before)
    expect(host.model.length).toBe(5)
    const engines = enginesOf(runs)
    expect(engines.length).toBe(2)
    expect(requestNames(engines[0]!)).toEqual(Array(5).fill('mnemopi_knowledge_prompt'))
    expect(requestNames(engines[1]!)).toEqual(Array(5).fill('mnemopi_knowledge_store'))
    expect(memoriesOf(runs, 'pending', 'write').length).toBe(1)
    expect(memoriesOf(runs, 'pending', 'remove-many').length).toBe(1)
    // The pending entries are written before the first model call and removed after the last store.
    expect(memoriesOf(runs, 'pending', 'write')[0]!.endedAt!).toBeLessThanOrEqual(Math.min(...host.model.map(m => m.startedAt)))
    expect(memoriesOf(runs, 'pending', 'remove-many')[0]!.startedAt).toBeGreaterThanOrEqual(engines[1]!.endedAt!)
    expect(activityRuns(runs).length).toBe(1)
    expect(host.extractLines().filter(line => line.origin === 'backfill').length).toBe(5)
    expect(host.pending()).toEqual([])
  })

  test('spec 1b: 45 memories, one owner: 2 prompt batches (40 + 5) and 2 store batches, 2 pending writes, 2 remove-manys, 2 activity appends', async () => {
    const host = await open({ model: good })
    await seed(host, Array.from({ length: 45 }, (_, i) => `memory number ${i} about topic${i}`))
    const before = host.runs.length
    const out = await host.command('mnemosyne-knowledge', 'apply')
    expect(out.text).toContain('Extracted knowledge for 45 of 45 memories')
    const runs = host.runs.slice(before)
    expect(host.model.length).toBe(45)
    const engines = enginesOf(runs)
    const prompts = engines.filter(run => requestNames(run)[0] === 'mnemopi_knowledge_prompt')
    const stores = engines.filter(run => requestNames(run)[0] === 'mnemopi_knowledge_store')
    expect(prompts.map(run => requestNames(run).length)).toEqual([40, 5])
    expect(stores.map(run => requestNames(run).length)).toEqual([40, 5])
    expect(engines.length).toBe(4)
    expect(memoriesOf(runs, 'pending', 'write').length).toBe(2)
    expect(memoriesOf(runs, 'pending', 'remove-many').length).toBe(2)
    expect(activityRuns(runs).length).toBe(2)
    expect(host.extractLines().filter(line => line.origin === 'backfill').length).toBe(45)
    expect(host.pending()).toEqual([])
  })
})

describe('finding 2: one extraction per session at a time', () => {
  test('finding 2a: the second save\'s model call does not start until the first one resolves', async () => {
    const held = heldModel()
    const host = await open({ model: held.model })
    await host.tool('memory_remember', { content: 'first quick save' })
    await until('the first model call', () => host.model.length === 1)
    await host.tool('memory_remember', { content: 'second quick save' })
    await settle()
    // The first call is still open: the second extraction is waiting behind it.
    expect(host.model.length).toBe(1)
    held.waiting[0]!(good())
    await until('the second model call', () => host.model.length === 2)
    expect(host.model[0]!.endedAt).toBeDefined()
    expect(host.model[0]!.endedAt!).toBeLessThanOrEqual(host.model[1]!.startedAt)
    held.waiting[1]!(good())
    await until('both extract lines', () => host.extractLines().length === 2)
    expect(host.extractLines().every(line => line.ok === true)).toBe(true)
    expect(host.pending()).toEqual([])
  })

  test('finding 2b: 10 quick saves never have more than one model call open at once', async () => {
    let open_ = 0
    let peak = 0
    const host = await open({
      model: async () => {
        peak = Math.max(peak, ++open_)
        await Bun.sleep(25)
        open_--
        return good()
      },
    })
    for (let i = 0; i < 10; i++) await host.tool('memory_remember', { content: `quick save number ${i}` })
    await until('ten extract lines', () => host.extractLines().length === 10, 60_000)
    expect(host.model.length).toBe(10)
    expect(peak).toBe(1)
    // The intervals never overlap: each call ends before the next one starts.
    for (let i = 1; i < host.model.length; i++) expect(host.model[i - 1]!.endedAt!).toBeLessThanOrEqual(host.model[i]!.startedAt)
    expect(host.pending()).toEqual([])
  }, 60_000)
})

describe('spec 3: two quick updates of one memory', () => {
  test('spec 3: no stale pending file; the store holds knowledge for the second text only; pending folder empty', async () => {
    const held = heldModel()
    let calls = 0
    // The first call is held open; later ones answer at once, with a fact named for the text they were shown.
    const reply = (prompt: string) => JSON.stringify({ facts: [prompt.includes('OMEGA') ? 'omega fact' : 'alpha fact'], preferences: [], instructions: [], timelines: [], kg: [] })
    const host = await open({
      model: request => (calls++ === 0 ? held.model().then(() => ({ isAnswered: true as const, text: reply(request.prompt) })) : { isAnswered: true as const, text: reply(request.prompt) }),
    })
    const [id] = await seed(host, ['zero text before any update'])
    await host.tool('memory_update', { memory_id: id, content: 'first update text ALPHA' })
    await until('the first model call', () => host.model.length === 1)
    // The first extraction is mid-flight (pending file holds the ALPHA sha) when the second update lands.
    expect(host.pending()).toEqual([`${id}.json`])
    const shaAlpha = host.pendingEntry(id!).sha256
    await host.tool('memory_update', { memory_id: id, content: 'second update text OMEGA' })
    held.waiting[0]!(good())
    await until('both extract lines', () => host.extractLines().length === 2)
    const [first, second] = host.extractLines()
    // The first reply was for text that has changed: refused as stale; the second one stored.
    expect(first).toMatchObject({ ok: false, error: 'stale' })
    expect(second).toMatchObject({ ok: true, count: 1 })
    expect(host.model[1]!.request.prompt).toContain('OMEGA')
    expect(factsOf(host, id!)).toEqual(['omega fact'])
    expect(host.pending()).toEqual([])
    expect(shaAlpha).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('finding 3: the backfill and pending entries', () => {
  test('finding 3a: a pending entry of a forgotten memory is dropped by apply with no model call', async () => {
    // The first model call fails, so the save leaves its pending file behind.
    const host = await open({ model: (_request, n) => (n === 0 ? failed() : good()) })
    const saved = await host.tool('memory_remember', { content: 'a fact about to be forgotten' })
    const id = JSON.parse(saved.result!).memory_id as string
    await until('the failed extract line', () => host.extractLines()[0])
    expect(host.extractLines()[0]).toMatchObject({ ok: false })
    expect(host.pending()).toEqual([`${id}.json`])
    const forgotten = await host.tool('memory_forget', { memory_id: id })
    expect(forgotten.result).toBeDefined()
    const calls = host.model.length

    const out = await host.command('mnemosyne-knowledge', 'apply')
    expect(host.model.length).toBe(calls)
    expect(host.pending()).toEqual([])
    expect(out.text).toContain('1 gone')
  })

  // R2 finding 3: the dry run does not count the pending entry of a forgotten memory (apply only drops it).
  test('finding 3a (dry run): a dry run does not count the pending entry of a forgotten memory', async () => {
    const host = await open({ model: (_request, n) => (n === 0 ? failed() : good()) })
    const saved = await host.tool('memory_remember', { content: 'a fact about to be forgotten' })
    const id = JSON.parse(saved.result!).memory_id as string
    await until('the failed extract line', () => host.extractLines()[0])
    expect(host.pending()).toEqual([`${id}.json`])
    await host.tool('memory_forget', { memory_id: id })
    const dry = await host.command('mnemosyne-knowledge')
    expect(dry.text).not.toMatch(/[1-9]\d* pending entr/)
    expect(dry.text).toContain('1 entry of forgotten memories (apply drops them)')
  })

  test('finding 3b: a pending entry holding an OLD sha of changed text is finished by apply from the current text; a second apply has nothing to do', async () => {
    const host = await open({ model: (_request, n) => (n === 0 ? failed() : good()) })
    const saved = await host.tool('memory_remember', { content: 'the original text of the fact' })
    const id = JSON.parse(saved.result!).memory_id as string
    await until('the failed extract line', () => host.extractLines()[0])
    const oldSha = host.pendingEntry(id).sha256
    // The text changes behind the plugin's back (no hook runs, so the old entry stays).
    withDb(host, db => db.run('UPDATE working_memory SET content = ? WHERE id = ?', ['the rewritten text of the fact', id]), true)
    expect(host.pendingEntry(id).sha256).toBe(oldSha)
    const calls = host.model.length

    const out = await host.command('mnemosyne-knowledge', 'apply')
    expect(out.text).toContain('Extracted knowledge for 1 of 1 memory')
    expect(host.model.length).toBe(calls + 1)
    expect(host.model[calls]!.request.prompt).toContain('rewritten text')
    expect(host.pending()).toEqual([])
    expect(factsOf(host, id).length).toBe(1)

    const again = await host.command('mnemosyne-knowledge', 'apply')
    expect(again.text).toContain('Nothing to extract')
    expect(host.model.length).toBe(calls + 1)
    expect(host.pending()).toEqual([])
  })
})

describe('finding 8: abort mid-apply', () => {
  test('finding 8: the reply says Stopped early with the not-reached count; the unreached memories\' pending entries stay and a dry run lists them', async () => {
    const controller = new AbortController()
    const host = await open({
      model: (_request, n) => {
        if (n === 0) controller.abort()
        return good()
      },
    })
    await seed(host, ['one to stop on', 'two to stop on', 'three to stop on', 'four to stop on', 'five to stop on', 'six to stop on'])
    const out = await host.command('mnemosyne-knowledge', 'apply', controller.signal)
    const reached = host.model.length
    const left = 6 - reached
    expect(reached).toBeGreaterThanOrEqual(1)
    expect(left).toBeGreaterThanOrEqual(1)
    expect(out.text).toContain('Stopped early')
    expect(out.text).toContain(`${left} memories not reached`)
    // The pending entries were written before any call: the unreached ones are still there.
    expect(host.pending().length).toBe(left)
    const dry = await host.command('mnemosyne-knowledge')
    expect(dry.text).toMatch(new RegExp(`${left} pending entr`))
    expect(dry.text).toMatch(new RegExp(`${left} memories with no knowledge`))
    // A second, unaborted apply finishes them.
    const rest = await host.command('mnemosyne-knowledge', 'apply')
    expect(rest.text).not.toContain('Stopped early')
    expect(host.pending()).toEqual([])
    expect(host.model.length).toBe(6)
  })
})

describe('finding 9: extractionModel off in any spelling', () => {
  for (const spelling of ['off', 'Off', 'OFF', ' off ']) {
    test(`finding 9: extractionModel ${JSON.stringify(spelling)}: a live save makes no model call, pending file or extract line; apply and the dry run say it is off`, async () => {
      const host = await open({ options: { extractionModel: spelling }, model: good })
      const saved = await host.tool('memory_remember', { content: 'a fact saved while extraction is off' })
      expect(saved.result).toContain('memory_id')
      await settle()
      expect(host.model.length).toBe(0)
      expect(host.pending()).toEqual([])
      expect(host.extractLines()).toEqual([])
      // The save itself was logged and was the only engine process: the silence is real.
      expect(host.activity().some(line => line.action === 'remember')).toBe(true)
      expect(host.engineRuns().length).toBe(1)
      expect(memoriesOf(host.runs).length).toBe(0)
      expect((await host.command('mnemosyne-knowledge', 'apply')).text).toContain('Knowledge extraction is off')
      expect((await host.command('mnemosyne-knowledge')).text).toContain('Knowledge extraction is off')
      expect(host.model.length).toBe(0)
    })
  }
})

describe('finding 10: only a content update extracts', () => {
  test('finding 10: tags-only and importance-only updates start nothing; a content update does', async () => {
    const host = await open({ model: good })
    const [id] = await seed(host, ['a fact to tag and edit'])
    const tags = await host.tool('memory_update', { memory_id: id, tags: ['deploy', 'friday'] })
    expect(JSON.parse(tags.result!)).toMatchObject({ status: 'updated' })
    const importance = await host.tool('memory_update', { memory_id: id, importance: 0.9 })
    expect(JSON.parse(importance.result!)).toMatchObject({ status: 'updated' })
    await settle()
    expect(host.model.length).toBe(0)
    expect(host.pending()).toEqual([])
    expect(host.extractLines()).toEqual([])
    expect(host.engineRuns().length).toBe(2)
    expect(memoriesOf(host.runs).length).toBe(0)
    // The same memory, with new text: now it extracts.
    await host.tool('memory_update', { memory_id: id, content: 'a fact to tag and edit, edited' })
    await until('the extract line', () => host.extractLines()[0])
    expect(host.extractLines()).toHaveLength(1)
    expect(host.extractLines()[0]).toMatchObject({ ok: true, ids: [id] })
    expect(host.model.length).toBe(1)
  })
})

describe('provenance through the real engine', () => {
  test('finding 7: two parallel saves after one trigger: exactly ONE is human + stated, the other is an agent save', async () => {
    const host = await open({ options: TRIGGER, model: good })
    await host.prompt('remember that we deploy on fridays')
    await Promise.all([host.tool('memory_remember', { content: 'first plain fact' }), host.tool('memory_remember', { content: 'second plain fact' })])
    await until('two extract lines', () => host.extractLines().length === 2)
    const rows = rowsOf(host)
    expect(rows).toHaveLength(2)
    expect(rows.filter(row => row.author_type === 'human' && row.veracity === 'stated')).toHaveLength(1)
    const agent = rows.filter(row => row.author_type === 'agent')
    expect(agent).toHaveLength(1)
    expect(agent[0]!.veracity).not.toBe('stated')
    // The activity log tells the same story.
    const saves = host.activity().filter(line => line.action === 'remember' && line.origin === 'tool')
    expect(saves).toHaveLength(2)
    expect(saves.filter(line => line.author_type === 'human' && line.veracity === 'stated')).toHaveLength(1)
    expect(saves.filter(line => line.veracity === 'stated')).toHaveLength(1)
  })

  test('spec 10a: apply never changes a working_memory row (every column compared before and after)', async () => {
    const host = await open({ model: good })
    const ids = await seed(host, ['alpha fact one', 'bravo fact two', 'charlie fact three'])
    // One row with tags in its metadata, one updated by hand: the rows are not all alike.
    await engineCall(CLI, host.store, 'global', [toolCall(1, 'mnemopi_update', { memory_id: ids[0], metadata: { tags: ['x', 'y'] } })])
    const snapshot = () => JSON.stringify(withDb(host, db => db.query('SELECT * FROM working_memory ORDER BY id').all()))
    const before = snapshot()
    expect(JSON.parse(before)).toHaveLength(3)
    const knowledgeBefore = countFacts(host)
    const out = await host.command('mnemosyne-knowledge', 'apply')
    expect(out.text).toContain('Extracted knowledge for 3 of 3 memories')
    // The run really wrote knowledge (so "unchanged" is not because nothing ran) ...
    expect(countFacts(host)).toBeGreaterThan(knowledgeBefore)
    // ... and left every working_memory column exactly as it was.
    expect(snapshot()).toBe(before)
  })

  test('spec 10b: the engine keeps veracity in the veracity column; trust_tier is STATED for a human-stated save and DERIVED for an agent save', async () => {
    const host = await open({ options: TRIGGER, model: good })
    await host.prompt('remember that we deploy on fridays')
    await host.tool('memory_remember', { content: 'the human stated this' })
    await host.tool('memory_remember', { content: 'the agent decided this' })
    await until('two extract lines', () => host.extractLines().length === 2)
    const rows = rowsOf(host)
    const human = rows.find(row => row.content === 'the human stated this')!
    const agent = rows.find(row => row.content === 'the agent decided this')!
    expect(human).toMatchObject({ author_type: 'human', veracity: 'stated' })
    expect(agent).toMatchObject({ author_type: 'agent', veracity: 'unknown' })
    // C4: trust_tier follows the save path: the trigger save is STATED, Claude's own save is DERIVED.
    expect(human.trust_tier).toBe('STATED')
    expect(agent.trust_tier).toBe('DERIVED')
  })

  test('spec 11: a content memory_update keeps the row human + stated', async () => {
    const host = await open({ options: TRIGGER, model: good })
    await host.prompt('remember that we deploy on fridays')
    const saved = await host.tool('memory_remember', { content: 'we deploy on fridays' })
    const id = JSON.parse(saved.result!).memory_id as string
    await until('the first extract line', () => host.extractLines().length === 1)
    const before = rowsOf(host)[0]!
    expect(before).toMatchObject({ author_type: 'human', veracity: 'stated' })
    await host.tool('memory_update', { memory_id: id, content: 'we deploy on fridays and mondays' })
    await until('the second extract line', () => host.extractLines().length === 2)
    const after = rowsOf(host)
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id, content: 'we deploy on fridays and mondays', author_type: 'human', veracity: 'stated', trust_tier: before.trust_tier, author_id: before.author_id })
  })

  test('spec 12: a hostile inherited environment cannot make a plain save look human or evil', async () => {
    const host = await open({ model: good, parentEnv: { MNEMOPI_AUTHOR_ID: 'evil', MNEMOPI_AUTHOR_TYPE: 'human', MNEMOPI_POLYPHONIC_RECALL: '1' } })
    await host.tool('memory_remember', { content: 'a plain save under a hostile shell' })
    await until('the extract line', () => host.extractLines()[0])
    const rows = rowsOf(host)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ author_id: 'claude-code', author_type: 'agent', veracity: 'unknown' })
    expect(JSON.stringify(rows)).not.toContain('evil')
  })
})

describe('finding 6: the real proxy never accepts veracity or a trust tier from a client', () => {
  test('finding 6: a memory_remember carrying veracity "stated" and trust_tier 1 stores neither; the author is the agent client', async () => {
    const temp = tempDir('proxy-b')
    try {
      const store = join(temp.dir, 'store')
      mkdirSync(store, { recursive: true })
      const args = { content: 'a client claims it is stated', veracity: 'stated', trust_tier: 1, author_id: 'evil', author_type: 'human' }
      // Control: straight to the engine the same arguments DO land as stated (so the assertion below is not vacuous).
      const direct = await engineCall(CLI, join(temp.dir, 'direct'), 'global', [toolCall(1, 'mnemopi_remember', { ...args, source: 'imported', scope: 'global' })])
      expect(body(direct.get(1)).status).toBe('stored')
      const control = new Database(join(temp.dir, 'direct', 'mnemopi.db'), { readonly: true })
      expect((control.query('SELECT veracity, author_type FROM working_memory').get() as { veracity: string; author_type: string })).toEqual({ veracity: 'stated', author_type: 'human' })
      control.close()

      const child = Bun.spawn([process.execPath, join(ROOT, 'bin', 'mcp-proxy.ts')], {
        env: { ...(process.env as Record<string, string>), ...isolatedEnv(), ...engineEnv(store, 'global'), MNEMOSYNE_CLI: CLI, MNEMOSYNE_ACTIVITY_LOG: '' },
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const messages = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'cursor', version: '1' } } },
        toolCall(2, 'memory_remember', args),
      ]
      child.stdin.write(messages.map(message => `${JSON.stringify(message)}\n`).join(''))
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
      expect(body(replies.get(2)), stderr).toMatchObject({ status: 'stored' })
      const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
      try {
        const row = db.query('SELECT veracity, trust_tier, author_id, author_type FROM working_memory').get() as Record<string, string>
        expect(row.veracity).toBe('unknown')
        expect(row.trust_tier).toBe('EXTERNAL_WRITE')
        expect(row.author_type).toBe('agent')
        expect(row.author_id).toBe('cursor')
      } finally {
        db.close()
      }
    } finally {
      temp.dispose()
    }
  })
})
