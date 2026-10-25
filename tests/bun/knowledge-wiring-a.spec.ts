// KNOWX R2 (set A): register-level specs for the knowledge extraction wiring.
// The hooks are the real hooks/register.ts; bin/memories.ts, bin/activity.ts and
// the engine are the real ones over a temp HOME; only the model call is a
// stand-in (see knowledge-host.ts).
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { body, engineCall, isolatedEnv, ROOT, toolCall } from './helpers'
import { ENGINE_BUILD, GOOD_REPLY, makeHost, until } from './knowledge-host'
import type { Host, ModelAnswer } from './knowledge-host'

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

const MEMORIES = join(ROOT, 'bin', 'memories.ts')
const KNOWLEDGE_TABLES = ['memoria_facts', 'memoria_preferences', 'memoria_instructions', 'memoria_timelines', 'memoria_kg']
const cliOf = (host: Host) => join(host.root, 'engine', 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'src', 'cli.ts')

/** Runs `fn` on a read-only handle to the temp store. */
function withDb<T>(host: Host, fn: (db: Database) => T): T {
  const db = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}
/** Knowledge rows (all five tables) naming the memory as their source, with the owner they were written under. */
const knowledgeRows = (host: Host, id: string) =>
  withDb(host, db => {
    const rows: { table: string; owner: string }[] = []
    for (const table of KNOWLEDGE_TABLES) {
      for (const row of db.query(`SELECT session_id AS owner FROM ${table} WHERE source_memory_id = ?`).all(id) as { owner: string }[]) rows.push({ table, owner: row.owner })
    }
    return rows
  })
const memoryCount = (host: Host, id: string) => withDb(host, db => (db.query('SELECT count(*) AS n FROM working_memory WHERE id = ?').get(id) as { n: number }).n)
const savedId = (saved: { result?: string; deny?: string }) => {
  expect(saved.deny).toBeUndefined()
  return JSON.parse(saved.result!).memory_id as string
}
/** A model that stays open until released. */
function held() {
  let release!: (answer: ModelAnswer) => void
  const open = new Promise<ModelAnswer>(resolve => (release = resolve))
  return { model: () => open, release }
}

describe('another owner (KNOWX: extraction runs as the row owner)', () => {
  test('KNOWX owner isolation: a live save extracts only its own memory, as its own owner; apply finishes the other owner as that owner', async () => {
    const host = await open({ options: { scope: 'per-project' }, model: () => ({ isAnswered: true, text: GOOD_REPLY }) })
    // The other owner's memory goes in through the real engine, as 'other-project'.
    const stranger = body((await engineCall(cliOf(host), host.store, 'other-project', [toolCall(1, 'mnemopi_remember', { content: 'Other project ships on Mondays' })])).get(1)).memory_id as string
    expect(typeof stranger).toBe('string')

    const idA = savedId(await host.tool('memory_remember', { kind: 'fact', content: 'We deploy on Fridays' }))
    const live = await until('the live extract line', () => host.extractLines()[0])
    const ownerA = live.owner as string
    expect(ownerA).toMatch(/^project-My-Repo-/)
    expect(live).toMatchObject({ origin: 'tool', ok: true, ids: [idA] })
    // Project A's save touched only A's memory: the model saw one prompt, the stranger has no knowledge rows.
    expect(host.model.length).toBe(1)
    expect(knowledgeRows(host, idA).length).toBeGreaterThan(0)
    expect(knowledgeRows(host, idA).every(row => row.owner === ownerA)).toBe(true)
    expect(knowledgeRows(host, stranger)).toEqual([])

    // Project A cannot even ask for the other owner's prompt: the engine answers "gone" for a row that is not its own.
    const cross = body((await engineCall(cliOf(host), host.store, ownerA, [toolCall(1, 'mnemopi_knowledge_prompt', { memory_id: stranger })])).get(1))
    expect(cross).toMatchObject({ refused: 'gone' })
    expect(knowledgeRows(host, stranger)).toEqual([])

    // The backfill finds the stranger's memory and extracts it AS other-project, never as project A.
    const dry = await host.command('mnemosyne-knowledge', '')
    expect(dry.text).toContain('- other-project: 1 memory with no knowledge')
    expect(dry.text).not.toContain(`- ${ownerA}:`)
    const applied = await host.command('mnemosyne-knowledge', 'apply')
    expect(applied.text).toContain('Extracted knowledge for 1 of 1 memory')
    const backfill = host.extractLines().filter(line => line.origin === 'backfill')
    expect(backfill).toHaveLength(1)
    expect(backfill[0]).toMatchObject({ owner: 'other-project', ids: [stranger], ok: true })
    const rows = knowledgeRows(host, stranger)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every(row => row.owner === 'other-project')).toBe(true)
    // Project A's own rows were not redone or reassigned.
    expect(knowledgeRows(host, idA).every(row => row.owner === ownerA)).toBe(true)
    expect(host.model.length).toBe(2)
  })
})

describe('a memory forgotten mid-flight', () => {
  test('KNOWX gone mid-flight: forget while the model call is open -> a gone extract line, no knowledge rows, no pending file', async () => {
    const gate = held()
    const host = await open({ model: gate.model })
    const id = savedId(await host.tool('memory_remember', { kind: 'fact', content: 'A fact that will be forgotten' }))
    await until('the model call', () => host.model.length > 0)
    expect(host.pending()).toEqual([`${id}.json`])
    const forgotten = await host.tool('memory_forget', { memory_id: id })
    expect(forgotten.deny).toBeUndefined()
    expect(memoryCount(host, id)).toBe(0)
    gate.release({ isAnswered: true, text: GOOD_REPLY })
    const line = await until('the extract line', () => host.extractLines()[0])
    expect(line).toMatchObject({ action: 'extract', origin: 'tool', ok: false, error: 'gone', ids: [id], count: 0 })
    expect(knowledgeRows(host, id)).toEqual([])
    await until('the pending file to go', () => host.pending().length === 0)
  })
})

describe('a stale engine', () => {
  test('UPGRADE.1 (was KNOWX stale engine): a save on a not-current engine is refused with /mnemosyne-setup: no row, no pending file, no model call, no extract line', async () => {
    const host = await open({ model: () => ({ isAnswered: true, text: GOOD_REPLY }) })
    // The host's fake engine (engineBuild) has an empty cli.ts. To drive a save on a not-current engine, put a
    // package.json of an old build next to the REAL engine sources (so a save would work if it were not refused).
    const scope = join(host.root, 'engine', 'node_modules', '@oh-my-pi')
    rmSync(join(scope, 'pi-mnemopi'), { recursive: true, force: true })
    mkdirSync(join(scope, 'pi-mnemopi'), { recursive: true })
    writeFileSync(join(scope, 'pi-mnemopi', 'package.json'), JSON.stringify({ name: '@oh-my-pi/pi-mnemopi', version: '0.0.1' }))
    expect('0.0.1').not.toBe(ENGINE_BUILD)
    symlinkSync(join(ROOT, 'engine', 'src'), join(scope, 'pi-mnemopi', 'src'), 'dir')

    // An older engine's 24 h trim would delete the save, so it is refused before any engine process.
    const refused = await host.tool('memory_remember', { kind: 'fact', content: 'Saved on an old engine' })
    expect(refused.deny).toContain('/mnemosyne-setup')
    expect(refused.deny).toContain('out of date')
    expect(refused.result).toBeUndefined()
    expect(host.engineRuns()).toEqual([])
    expect(existsSync(join(host.store, 'mnemopi.db'))).toBe(false)
    expect(host.extractLines()).toEqual([])
    expect(host.model.length).toBe(0)
    expect(host.pending()).toEqual([])
    expect(host.memoriesRuns().filter(run => run.argv.includes('pending'))).toEqual([])
    expect(existsSync(host.pendingDir)).toBe(false)
  })
})

describe('extractionModel off', () => {
  test('KNOWX off: a live save still saves, with no model call, no pending file and no extract line', async () => {
    const host = await open({ options: { extractionModel: 'off' }, model: () => ({ isAnswered: true, text: GOOD_REPLY }) })
    const id = savedId(await host.tool('memory_remember', { kind: 'fact', content: 'Saved with extraction off' }))
    expect(memoryCount(host, id)).toBe(1)
    // The remember line is written before the tool replies; the extraction (if any) would follow at once.
    await Bun.sleep(400)
    expect(host.activity().some(line => line.action === 'remember')).toBe(true)
    expect(host.extractLines()).toEqual([])
    expect(host.model.length).toBe(0)
    expect(host.pending()).toEqual([])
    expect(existsSync(host.pendingDir)).toBe(false)
    expect(host.memoriesRuns().filter(run => run.argv.includes('pending'))).toEqual([])
    // Only the save reached the engine: no knowledge tool ran.
    expect(host.engineRuns()).toHaveLength(1)
    expect(knowledgeRows(host, id)).toEqual([])
  })
})

describe('a failed model call', () => {
  const cases: [string, (() => ModelAnswer | Promise<ModelAnswer>), string][] = [
    ['an unanswered call (api-error)', () => ({ isAnswered: false, reason: 'api-error' }), 'api-error'],
    ['a rejected promise', () => Promise.reject(new Error('model blocked')), 'model blocked'],
  ]
  for (const [name, model, reason] of cases) {
    test(`KNOWX failed model: ${name} -> the memory stays saved, the pending file stays, one failed extract line with the reason`, async () => {
      const host = await open({ model })
      const id = savedId(await host.tool('memory_remember', { kind: 'fact', content: 'Saved while the model is down' }))
      const line = await until('the extract line', () => host.extractLines()[0])
      expect(line).toMatchObject({ action: 'extract', origin: 'tool', ok: false, error: reason, ids: [id], count: 0 })
      expect(host.extractLines()).toHaveLength(1)
      expect(host.model.length).toBe(1)
      expect(memoryCount(host, id)).toBe(1)
      expect(host.pending()).toEqual([`${id}.json`])
      expect(knowledgeRows(host, id)).toEqual([])
    })
  }
})

describe('a lost call finished by the backfill', () => {
  test('KNOWX backfill finishes a lost call: dry run counts the pending entry with no model call; apply stores, removes the file, logs a backfill line', async () => {
    const host = await open({ model: (_request, n) => (n === 0 ? { isAnswered: false, reason: 'timeout' } : { isAnswered: true, text: GOOD_REPLY }) })
    const id = savedId(await host.tool('memory_remember', { kind: 'fact', content: 'We deploy on Fridays' }))
    const first = await until('the first extract line', () => host.extractLines()[0])
    expect(first).toMatchObject({ origin: 'tool', ok: false, error: 'timeout', ids: [id] })
    expect(host.pending()).toEqual([`${id}.json`])
    expect(host.model.length).toBe(1)

    const dry = await host.command('mnemosyne-knowledge', '')
    expect(dry.text).toContain('no model call')
    expect(dry.text).toContain('1 pending entry')
    expect(host.model.length).toBe(1)
    expect(host.pending()).toEqual([`${id}.json`])
    expect(knowledgeRows(host, id)).toEqual([])

    const applied = await host.command('mnemosyne-knowledge', 'apply')
    expect(applied.text).toContain('Extracted knowledge for 1 of 1 memory')
    expect(host.model.length).toBe(2)
    expect(host.pending()).toEqual([])
    expect(knowledgeRows(host, id).length).toBeGreaterThan(0)
    const lines = host.extractLines()
    expect(lines).toHaveLength(2)
    expect(lines[1]).toMatchObject({ action: 'extract', origin: 'backfill', ok: true, ids: [id], owner: 'global' })
    expect(lines[1]!.count).toBeGreaterThan(0)
  })
})

describe('non-ASCII text through the whole path', () => {
  test('KNOWX sha256 round trip: the pending file hash equals what bin/memories.ts get returns, and the hash of the UTF-8 text', async () => {
    const text = 'Café naïve 日本語 🚀 ñ — “quotes”'
    const gate = held()
    const host = await open({ model: gate.model })
    const id = savedId(await host.tool('memory_remember', { kind: 'fact', content: text }))
    await until('the model call', () => host.model.length > 0)
    const pending = host.pendingEntry(id)
    // The prompt the model saw carries the text.
    expect(host.model[0]!.request.prompt).toContain('日本語')

    const child = Bun.spawn([process.execPath, MEMORIES, '--store', host.store, 'get', id], { env: { ...(process.env as Record<string,string>), ...isolatedEnv() }, stdout: 'pipe', stderr: 'pipe' })
    const [stdout, , exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(exitCode).toBe(0)
    const [row] = JSON.parse(stdout) as { id: string; content: string; sha256: string }[]
    expect(row!.id).toBe(id)
    expect(row!.content).toBe(text)
    expect(pending.sha256).toBe(row!.sha256)
    expect(pending.sha256).toBe(createHash('sha256').update(text, 'utf8').digest('hex'))

    gate.release({ isAnswered: true, text: GOOD_REPLY })
    const line = await until('the extract line', () => host.extractLines()[0])
    // A matching hash is what lets the store accept the reply (a mismatch would be "stale").
    expect(line).toMatchObject({ ok: true, ids: [id] })
    expect(host.pending()).toEqual([])
  })
})
