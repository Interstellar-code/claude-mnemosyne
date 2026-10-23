// KNOWX.2.a2–a4: the extraction flow in hooks/knowledge.ts, driven through its
// parameters. The engine, the memories CLI and the model are fakes here; the
// real ones are exercised by tests/bun/knowledge-cross.spec.ts-style checks in
// tests/register.test.ts and tests/bun/memories.spec.ts.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { extractMany, extractOne, reasonLine, storedCount } from '../../hooks/knowledge'
import { ROOT } from './helpers'

const SHA = 'a'.repeat(64)
const GOOD_REPLY = JSON.stringify({
  facts: ['Mnemosyne is a memory engine', 'Works with Claude Code'],
  preferences: ['User prefers tabs over spaces'],
  instructions: ['Always run typecheck before commit'],
  timelines: ['Release v0.6 on 2026-11-02'],
  kg: [{ subject: 'Mnemosyne', predicate: 'supports', object: 'Bun' }],
})

/** A fake set of the three calls, recording what each saw. */
function harness(options: { promptRefused?: boolean; storeRefused?: string; model?: { text?: string; reason?: string } | 'reject'; modelThrows?: boolean } = {}) {
  const seen = { engine: [] as { name: string; args: Record<string, unknown>; owner: string }[], memories: [] as { args: readonly string[]; stdin?: string }[], model: [] as Record<string, unknown>[] }
  const engine = async (requests: readonly (readonly [string, Record<string, unknown>])[], owner: string) =>
    requests.map(([name, args]) => {
      seen.engine.push({ name, args, owner })
      if (name === 'mnemopi_knowledge_prompt') {
        return options.promptRefused === true ? JSON.stringify({ refused: 'gone' }) : JSON.stringify({ prompt: 'extract from: the text', sha256: SHA })
      }
      if (options.storeRefused !== undefined) return JSON.stringify({ refused: options.storeRefused })
      return JSON.stringify({ stored: { facts: 2, preferences: 1, instructions: 1, timelines: 1, kg: 1 } })
    })
  const memories = async (args: readonly string[], stdin?: string) => {
    seen.memories.push({ args, stdin })
    if (args[0] === 'pending' && args[1] === 'list') return '[]'
    return ''
  }
  const modelCall = async (request: Record<string, unknown>) => {
    seen.model.push(request)
    if (options.modelThrows === true) throw new Error('model blocked')
    if (options.model === 'reject') return { reason: 'api-error' }
    if (options.model !== undefined) return options.model
    return { text: GOOD_REPLY }
  }
  return { seen, engine, memories, modelCall }
}

describe('KNOWX.2: extractOne', () => {
  test('KNOWX.2.a2 and a4: prompt, pending write, model, store, pending remove, in that order', async () => {
    const fake = harness()
    const outcome = await extractOne({ id: 'a1b2c3d4e5f60718', owner: 'global', root: '/root', model: 'haiku', engine: fake.engine, memories: fake.memories, modelCall: fake.modelCall })
    expect(outcome).toEqual({ kind: 'stored', counts: { facts: 2, preferences: 1, instructions: 1, timelines: 1, kg: 1 } })
    expect(storedCount(outcome)).toBe(6)
    // The prompt tool ran as the row's owner; the store too, with the reply unchanged and the prompt's sha.
    expect(fake.seen.engine.map(call => [call.name, call.owner])).toEqual([
      ['mnemopi_knowledge_prompt', 'global'],
      ['mnemopi_knowledge_store', 'global'],
    ])
    expect(fake.seen.engine[1]!.args).toEqual({ memory_id: 'a1b2c3d4e5f60718', reply: GOOD_REPLY, sha256: SHA })
    // The pending file is written BEFORE the model call and removed AFTER the store.
    expect(fake.seen.memories).toEqual([
      { args: ['pending', 'write', '/root'], stdin: JSON.stringify([{ id: 'a1b2c3d4e5f60718', owner: 'global', sha256: SHA }]) },
      { args: ['pending', 'remove-many', '/root'], stdin: JSON.stringify([{ id: 'a1b2c3d4e5f60718', sha256: SHA }]) },
    ])
    // The model request: the engine's prompt, 2000 tokens, 60 s, effort low.
    expect(fake.seen.model[0]).toEqual({ model: 'haiku', prompt: 'extract from: the text', maxTokens: 2000, timeoutMs: 60_000, effort: 'low' })
  })

  test('KNOWX.2.a4: a rejected model call leaves the pending entry and stores nothing', async () => {
    const fake = harness({ modelThrows: true })
    const outcome = await extractOne({ id: 'aa', owner: 'global', root: '/r', model: 'haiku', engine: fake.engine, memories: fake.memories, modelCall: fake.modelCall })
    expect(outcome.kind).toBe('failed')
    expect(fake.seen.engine.map(call => call.name)).toEqual(['mnemopi_knowledge_prompt'])
    expect(fake.seen.memories.map(entry => entry.args[1])).toEqual(['write'])
  })

  test('KNOWX.2.a5: an unanswered result and an empty reply fail without a store call', async () => {
    for (const model of [{ reason: 'api-error' }, { text: '   ' }] as const) {
      const fake = harness({ model })
      const outcome = await extractOne({ id: 'bb', owner: 'global', root: '/r', model: 'haiku', engine: fake.engine, memories: fake.memories, modelCall: fake.modelCall })
      expect(outcome.kind).toBe('failed')
      expect(fake.seen.engine).toHaveLength(1)
      expect(reasonLine(outcome)).toBe(model.reason ?? 'empty-reply')
    }
  })

  test('KNOWX.2.a4: a gone prompt and a stale store each leave the right state', async () => {
    const gone = harness({ promptRefused: true })
    expect((await extractOne({ id: 'cc', owner: 'global', root: '/r', model: 'haiku', engine: gone.engine, memories: gone.memories, modelCall: gone.modelCall })).kind).toBe('gone')
    // A memory gone at the prompt step has no pending file written, and any entry it had is removed whatever it holds.
    expect(gone.seen.memories).toEqual([{ args: ['pending', 'remove-many', '/r'], stdin: JSON.stringify([{ id: 'cc' }]) }])
    const stale = harness({ storeRefused: 'stale' })
    expect((await extractOne({ id: 'dd', owner: 'global', root: '/r', model: 'haiku', engine: stale.engine, memories: stale.memories, modelCall: stale.modelCall })).kind).toBe('stale')
    // A stale store leaves the pending entry for the backfill to redo.
    expect(stale.seen.memories.map(entry => entry.args[1])).toEqual(['write'])
    const unparseable = harness({ storeRefused: 'unparseable' })
    expect((await extractOne({ id: 'ee', owner: 'global', root: '/r', model: 'haiku', engine: unparseable.engine, memories: unparseable.memories, modelCall: unparseable.modelCall })).kind).toBe('failed')
  })

  test('KNOWX.2.a4: a gone store removes the pending entry', async () => {
    const fake = harness({ storeRefused: 'gone' })
    expect((await extractOne({ id: 'ff', owner: 'global', root: '/r', model: 'haiku', engine: fake.engine, memories: fake.memories, modelCall: fake.modelCall })).kind).toBe('gone')
    expect(fake.seen.memories.map(entry => entry.args[1])).toEqual(['write', 'remove-many'])
  })

  test('KNOWX R2: extractMany writes all pending entries in one call before any model call, and removes the finished ones in one call', async () => {
    const fake = harness()
    const order: string[] = []
    const memories = async (args: readonly string[], stdin?: string) => {
      order.push(`memories:${args[1]}`)
      return fake.memories(args, stdin)
    }
    const modelCall = async (request: Record<string, unknown>) => {
      order.push('model')
      return fake.modelCall(request)
    }
    const outcomes = await extractMany({ items: [{ id: 'aa' }, { id: 'bb' }, { id: 'cc' }], owner: 'global', root: '/r', model: 'haiku', engine: fake.engine, memories, modelCall })
    expect(outcomes.map(outcome => outcome.kind)).toEqual(['stored', 'stored', 'stored'])
    expect(order).toEqual(['memories:write', 'model', 'model', 'model', 'memories:remove-many'])
    // One engine process for the three prompts and one for the three stores: the fake sees them as two batches.
    expect(fake.seen.engine.map(call => call.name)).toEqual(Array(3).fill('mnemopi_knowledge_prompt').concat(Array(3).fill('mnemopi_knowledge_store')))
    expect(JSON.parse(fake.seen.memories[0]!.stdin!)).toHaveLength(3)
  })

  test('KNOWX R2 finding 3: a gone memory drops its entry whatever it holds; a backfill entry is removed under the sha it read too', async () => {
    const gone = harness({ promptRefused: true })
    await extractMany({ items: [{ id: 'cc', pendingSha: 'b'.repeat(64) }], owner: 'global', root: '/r', model: 'haiku', engine: gone.engine, memories: gone.memories, modelCall: gone.modelCall })
    expect(gone.seen.memories).toEqual([{ args: ['pending', 'remove-many', '/r'], stdin: JSON.stringify([{ id: 'cc' }]) }])
    const fake = harness()
    await extractMany({ items: [{ id: 'dd', pendingSha: 'b'.repeat(64) }], owner: 'global', root: '/r', model: 'haiku', engine: fake.engine, memories: fake.memories, modelCall: fake.modelCall })
    expect(JSON.parse(fake.seen.memories.at(-1)!.stdin!)).toEqual([{ id: 'dd', sha256: SHA }, { id: 'dd', sha256: 'b'.repeat(64) }])
  })

  test('KNOWX R2 finding 8: a pool that never starts a call leaves notReached outcomes and their pending entries', async () => {
    const fake = harness()
    const outcomes = await extractMany({ items: [{ id: 'aa' }, { id: 'bb' }], owner: 'global', root: '/r', model: 'haiku', engine: fake.engine, memories: fake.memories, modelCall: fake.modelCall, pool: async () => undefined })
    expect(outcomes).toEqual([{ kind: 'notReached' }, { kind: 'notReached' }])
    expect(fake.seen.model).toEqual([])
    expect(fake.seen.engine.map(call => call.name)).toEqual(['mnemopi_knowledge_prompt', 'mnemopi_knowledge_prompt'])
    // Written before the model call, never removed: the next run finishes them.
    expect(fake.seen.memories.map(entry => entry.args[1])).toEqual(['write'])
  })

  test('KNOWX.2.a3: hooks/knowledge.ts imports nothing outside hooks/ and no node: module', () => {
    const source = readFileSync(join(ROOT, 'hooks', 'knowledge.ts'), 'utf8')
    const specifiers = [...source.matchAll(/^\s*import[^\n]*from\s+['"]([^'"]+)['"]/gm)].map(match => match[1]!)
    // It imports nothing at all: every outside call is a parameter.
    expect(specifiers).toEqual([])
    expect(source).not.toMatch(/from\s+['"]node:/)
  })
})
