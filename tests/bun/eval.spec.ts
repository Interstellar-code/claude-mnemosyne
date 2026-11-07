// The recall evaluation harness (bin/eval.ts, 0.26.0): the metrics, the capture from the activity log, the gold set, and a
// real replay against a snapshot of a temp store that leaves the store (and its recall counts) unchanged.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { compareRuns, goldScore, keyOf, logLines, overlap, parseGold, parseWeights, queriesOf, recallAt, recallIds, reciprocalRank, replay, snapshotStore, writePrivate, type Run } from '../../bin/eval'
import { DEFAULT_RECALL_WEIGHTS } from '../../hooks/engine'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

describe('EVAL: metrics', () => {
  test('recall@k, reciprocal rank and overlap', () => {
    expect(recallAt(['a', 'b', 'c'], ['b', 'z'], 1)).toBe(0)
    expect(recallAt(['a', 'b', 'c'], ['b', 'z'], 2)).toBe(0.5)
    expect(recallAt(['a'], [], 5)).toBe(0)
    expect(reciprocalRank(['a', 'b', 'c'], ['c', 'b'])).toBe(0.5)
    expect(reciprocalRank(['a'], ['z'])).toBe(0)
    expect(overlap(['a', 'b'], ['b', 'c'], 5)).toBeCloseTo(1 / 3)
    expect(overlap([], [], 5)).toBe(1)
    expect(overlap(['a', 'b', 'c'], ['a', 'b', 'x'], 2)).toBe(1)
  })

  test('a run scored on the gold set, and two runs compared', () => {
    const run = (name: string, lists: Record<string, string[]>): Run => ({
      version: 1,
      name,
      created: '',
      mode: 'keyword',
      k: 5,
      weights: DEFAULT_RECALL_WEIGHTS,
      results: Object.entries(lists).map(([query, ids]) => ({ owner: 'p', query, ids, scores: ids.map(() => 1) })),
    })
    const gold = parseGold({ queries: [{ owner: 'p', query: 'q1', expect: ['a'] }, { owner: 'p', query: 'q2', expect: ['x', 'y'] }, { owner: 'p', query: 'gone', expect: ['a'] }] })
    const a = run('A', { q1: ['a', 'b'], q2: ['y', 'z', 'x'], q3: ['m'] })
    const b = run('B', { q1: ['b', 'a'], q2: ['y', 'z', 'x'], q4: ['n'] })
    const s = goldScore(a, gold)
    expect(s).toMatchObject({ queries: 3, missing: 1, recallAt1: 0.5, recallAtK: 0.667, hitAtK: 0.667, mrr: 0.667 })
    expect(s.worst.map(w => w.query)).toEqual(['gone'])
    const c = compareRuns(a, b, gold)
    expect(c).toMatchObject({ shared: 2, onlyA: 1, onlyB: 1, top1Same: 0.5, overlapAt5: 1 })
    expect(c.changedTop1).toEqual([{ query: 'q1', owner: 'p', a: 'a', b: 'b' }])
    // B: q1 misses at 1 (b first), q2 finds 1 of 2 at 1, "gone" is not in the run: (0 + 0.5 + 0) / 3.
    expect(c.gold!.b.recallAt1).toBe(0.167)
  })

  test('weights, gold parsing and recall replies are checked', () => {
    expect(parseWeights('0.6, 0.3 ,0.1')).toEqual({ vector: 0.6, keyword: 0.3, importance: 0.1 })
    expect(() => parseWeights('0.5,0.3')).toThrow('three numbers')
    expect(() => parseWeights('2,0,0')).toThrow()
    expect(parseGold({ queries: [{ owner: 'p', query: ' q ', expect: ['a', 3, ''] }, { owner: '', query: 'x', expect: ['a'] }, { owner: 'p', query: 'none', expect: [] }, null] }).queries).toEqual([{ owner: 'p', query: 'q', expect: ['a'] }])
    expect(parseGold('nonsense').queries).toEqual([])
    expect(recallIds(JSON.stringify({ status: 'ok', results: [{ id: 'a', score: 0.9 }, { id: 'b' }, { nope: 1 }] }))).toEqual({ ids: ['a', 'b'], scores: [0.9, 0] })
    expect(recallIds('not json')).toBeInstanceOf(Error)
    expect(recallIds(JSON.stringify({ status: 'error', error: 'boom' }))).toEqual(new Error('boom'))
  })
})

describe('EVAL: capture', () => {
  test('successful recalls with text, one per owner and text, most asked first; a cross-project search is global', () => {
    const lines = logLines(
      [
        { t: '2026-11-01T10:00:00Z', action: 'recall', origin: 'hook', owner: 'p1', text: 'build steps', ok: true },
        { t: '2026-11-02T10:00:00Z', action: 'recall', origin: 'tool', owner: 'p1', text: ' build steps ', ok: true },
        { t: '2026-11-03T10:00:00Z', action: 'recall', origin: 'ui', owner: 'global', owners: 10, text: 'who is rohit', ok: true },
        { t: '2026-11-03T11:00:00Z', action: 'recall', origin: 'external', owner: 'p2', text: 'failed one', ok: false },
        { t: '2026-11-03T12:00:00Z', action: 'remember', origin: 'tool', owner: 'p1', text: 'not a recall', ok: true },
        { t: '2026-11-03T13:00:00Z', action: 'recall', origin: 'external', owner: 'p2', client: 'codex', text: 'codex question', ok: true },
      ]
        .map(line => JSON.stringify(line))
        .join('\n') + '\nnot json\n',
    )
    const all = queriesOf(lines)
    expect(all.map(q => `${q.owner}|${q.query}|${q.seen}`)).toEqual(['p1|build steps|2', 'p2|codex question|1', 'global|who is rohit|1'])
    expect(all[0]!.last).toBe('2026-11-02T10:00:00Z')
    expect(queriesOf(lines, ['external']).map(q => q.query)).toEqual(['codex question'])
    expect(keyOf({ owner: 'p', query: 'q' })).toBe('p\u0000q')
  })
})

describe('EVAL: replay on a snapshot of a real temp store', () => {
  const temp = tempDir('eval-replay')
  const store = join(temp.dir, 'store')
  const ids: string[] = []

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    const texts = ['Deploy steps: run the build, then push the image to the registry.', 'The coffee machine on floor two is broken.', 'Deploy rollback: revert the image tag and redeploy.']
    for (const [i, content] of texts.entries()) {
      const reply = body((await engineCall(CLI, store, 'project-eval-1a2b', [toolCall(i + 1, 'mnemopi_remember', { content })])).get(i + 1)) as { memory_id: string }
      ids.push(reply.memory_id)
    }
  }, 120_000)
  afterAll(() => temp.dispose())

  test('the replay finds the deploy memories, twice the same, and the live store and its recall counts are untouched', async () => {
    const counts = () => {
      const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
      try {
        return (db.query('SELECT id, recall_count FROM working_memory ORDER BY id').all() as { id: string; recall_count: number }[]).map(r => `${r.id}:${r.recall_count}`)
      } finally {
        db.close()
      }
    }
    const before = counts()
    const snapshot = snapshotStore(store)
    expect(existsSync(join(snapshot, 'mnemopi.db'))).toBe(true)
    const options = { cli: CLI, store: snapshot, mode: 'keyword' as const, k: 5, weights: DEFAULT_RECALL_WEIGHTS }
    const queries = [
      { owner: 'project-eval-1a2b', query: 'deploy' },
      { owner: 'project-eval-1a2b', query: 'coffee machine' },
    ]
    const first = await replay(queries, options)
    const second = await replay(queries, options)
    expect(first.every(r => r.error === undefined)).toBe(true)
    expect(new Set(first[0]!.ids)).toEqual(new Set([ids[0]!, ids[2]!]))
    expect(first[1]!.ids[0]).toBe(ids[1]!)
    expect(second.map(r => r.ids)).toEqual(first.map(r => r.ids))
    // Nothing changed in the live store: no recall was counted.
    expect(counts()).toEqual(before)
  }, 120_000)

  test('private files: written by rename, 0600 on POSIX', () => {
    const file = join(temp.dir, 'eval', 'runs', 'x.json')
    writePrivate(file, '{"a":1}\n')
    expect(readFileSync(file, 'utf8')).toBe('{"a":1}\n')
    if (process.platform !== 'win32') expect(statSync(file).mode & 0o777).toBe(0o600)
  })
})
