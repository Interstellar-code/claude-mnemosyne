// Search match modes: the pure classifier, mergeHits keeping the per-signal scores,
// POST /api/search `mode` validation and its reply fields (against a stand-in engine that
// records whether it ran with embeddings), and the page's mode helpers (ui/search-mode.ts).
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Database } from 'bun:sqlite'
import { classifyMatch, entityCardOf, MATCH_EPSILON, mergeEntityCards, mergeHits, SEARCH_LIMIT, startServer, withKinds } from '../../ui/server'
import type { Started } from '../../ui/server'
import {
  chooseMode,
  countFacet,
  countNote,
  entityRows,
  matchedWords,
  matchLabel,
  MODE_KEY,
  modeLabel,
  pushRecent,
  readMode,
  readRecent,
  RECENT_KEY,
  RECENT_MAX,
  resultHead,
  ringClass,
  ringText,
  saveMode,
  SHOW_FIRST,
  sortHits,
} from '../../ui/search-mode'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

describe('classifyMatch', () => {
  test('meaning when only the vector score counts, both when both pass the epsilon, else keyword', () => {
    expect(classifyMatch(0, 0.6)).toBe('meaning')
    expect(classifyMatch(MATCH_EPSILON / 2, 0.6)).toBe('meaning')
    expect(classifyMatch(0.4, 0.6)).toBe('both')
    expect(classifyMatch(0.4, 0)).toBe('keyword')
    expect(classifyMatch(0, 0)).toBe('keyword')
    // The full-text score counts as a keyword signal too.
    expect(classifyMatch(0, 0.6, 0.5)).toBe('both')
    expect(classifyMatch(0, 0, 0.5)).toBe('keyword')
    // A dense score at the epsilon is still absent.
    expect(classifyMatch(0.4, MATCH_EPSILON)).toBe('keyword')
  })
})

describe('mergeHits keeps the signal scores', () => {
  test('each hit carries keyword, dense and fts scores and a matched label; bad numbers count as 0', () => {
    const hits = mergeHits([
      [
        { id: 'a', score: 0.9, keyword_score: 0.5, dense_score: 0.7, fts_score: 0.4, content: 'a' },
        { id: 'b', score: 0.5, keyword_score: 0, dense_score: 0.6, content: 'b' },
        { id: 'c', score: 0.3, keyword_score: 'x', dense_score: null, content: 'c' },
      ],
    ])
    expect(hits.map(h => [h.id, h.keyword_score, h.dense_score, h.fts_score, h.matched])).toEqual([
      ['a', 0.5, 0.7, 0.4, 'both'],
      ['b', 0, 0.6, 0, 'meaning'],
      ['c', 0, 0, 0, 'keyword'],
    ])
  })

  test('across owners the better-scored copy keeps its own signals', () => {
    const hits = mergeHits([
      [{ id: 'a', score: 0.2, keyword_score: 0.2, dense_score: 0, content: 'a' }],
      [{ id: 'a', score: 0.8, keyword_score: 0, dense_score: 0.8, content: 'a' }],
    ])
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ score: 0.8, dense_score: 0.8, matched: 'meaning' })
  })

  test(`the default cut is ${SEARCH_LIMIT}`, () => {
    expect(SEARCH_LIMIT).toBe(20)
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, score: i / 100, content: 'x' }))
    expect(mergeHits([rows])).toHaveLength(20)
  })
})

describe('POST /api/search mode', () => {
  const temp = tempDir('ui-search-mode')
  const store = join(temp.dir, 'store')
  const seen = join(temp.dir, 'seen.txt')
  const cli = join(temp.dir, 'stand-in-cli.ts')
  let server: Started
  let url = ''
  const saved = process.env.MNEMOSYNE_EMBEDDINGS

  const post = (payload: unknown) =>
    fetch(`${url}/api/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${server.token}`, 'Content-Type': 'application/json', Origin: url },
      body: JSON.stringify(payload),
    })
  /** What MNEMOPI_NO_EMBEDDINGS each engine process of the last searches saw ('' = embeddings on). */
  const flags = () => readFileSync(seen, 'utf8').split('\n').filter(Boolean)

  beforeAll(async () => {
    mkdirSync(store, { recursive: true })
    const reply = body((await engineCall(CLI, store, 'o1', [toolCall(1, 'mnemopi_remember', { content: 'orchard fact' })])).get(1))
    if (typeof reply?.memory_id !== 'string') throw new Error(`remember failed: ${JSON.stringify(reply)}`)
    // A stand-in engine: notes whether embeddings were off for this process, answers with one hit that has all signals.
    writeFileSync(
      cli,
      `import { appendFileSync } from 'node:fs'
appendFileSync(${JSON.stringify(seen)}, (process.env.MNEMOPI_NO_EMBEDDINGS ?? '') + '|x\\n')
const lines = (await Bun.stdin.text()).split('\\n').filter(Boolean)
for (const line of lines) {
  const { id } = JSON.parse(line)
  const text = { status: 'ok', results: [{ id: 'm1', score: 0.8, session_id: 'o1', content: 'orchard fact', keyword_score: 0.5, dense_score: process.env.MNEMOPI_NO_EMBEDDINGS ? 0 : 0.7, fts_score: 0.4 }] }
  console.log(JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(text) }] } }))
}
`,
    )
    writeFileSync(seen, '')
    server = await startServer({ root: join(temp.dir, 'root'), store, cli, activityLog: '', pluginRoot: ROOT })
    url = `http://127.0.0.1:${server.port}`
  }, 120_000)
  afterAll(async () => {
    await server.stop()
    temp.dispose()
  })
  afterEach(() => {
    if (saved === undefined) delete process.env.MNEMOSYNE_EMBEDDINGS
    else process.env.MNEMOSYNE_EMBEDDINGS = saved
    writeFileSync(seen, '')
  })

  test('embeddings off: the default is keyword; hybrid is refused with a plain 400; the reply says what ran', async () => {
    delete process.env.MNEMOSYNE_EMBEDDINGS
    const found = (await (await post({ query: 'orchard' })).json()) as { mode: string; embeddings: boolean; results: { matched: string; dense_score: number }[] }
    expect(found).toMatchObject({ mode: 'keyword', embeddings: false })
    expect(found.results[0]).toMatchObject({ matched: 'keyword', dense_score: 0 })
    const refused = await post({ query: 'orchard', mode: 'hybrid' })
    expect(refused.status).toBe(400)
    expect(((await refused.json()) as { error: string }).error).toContain('/mnemosyne-setup')
    expect(flags()).toEqual(['1|x'])
  })

  test('embeddings on: hybrid is the default and runs with embeddings; keyword runs the engine with them off', async () => {
    process.env.MNEMOSYNE_EMBEDDINGS = 'on'
    const hybrid = (await (await post({ query: 'orchard' })).json()) as { mode: string; embeddings: boolean; results: { matched: string }[] }
    expect(hybrid).toMatchObject({ mode: 'hybrid', embeddings: true })
    expect(hybrid.results[0]!.matched).toBe('both')
    const keyword = (await (await post({ query: 'orchard', mode: 'keyword' })).json()) as { mode: string; embeddings: boolean; results: { matched: string }[] }
    expect(keyword).toMatchObject({ mode: 'keyword', embeddings: true })
    expect(keyword.results[0]!.matched).toBe('keyword')
    // The server's own setting is untouched by the keyword search.
    expect(process.env.MNEMOSYNE_EMBEDDINGS).toBe('on')
    expect(flags()).toEqual(['|x', '1|x'])
  })

  test('a bad mode is a 400', async () => {
    for (const mode of ['meaning', '', 3, null, ['keyword']]) {
      const response = await post({ query: 'orchard', mode })
      expect({ mode, status: response.status }).toEqual({ mode, status: 400 })
    }
    expect(flags()).toEqual([])
  })

  test('an empty store still says the mode and the capability', async () => {
    const bare = join(temp.dir, 'bare')
    mkdirSync(bare, { recursive: true })
    const other = await startServer({ root: join(temp.dir, 'root2'), store: bare, cli, activityLog: '', pluginRoot: ROOT })
    try {
      const response = await fetch(`http://127.0.0.1:${other.port}/api/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${other.token}`, 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${other.port}` },
        body: JSON.stringify({ query: 'x' }),
      })
      expect(await response.json()).toMatchObject({ count: 0, mode: 'keyword', embeddings: false, results: [] })
    } finally {
      await other.stop()
    }
  })

  test('GET /api/health says whether embeddings are on', async () => {
    const health = async () => ((await (await fetch(`${url}/api/health`, { headers: { Authorization: `Bearer ${server.token}` } })).json()) as { embeddings: boolean }).embeddings
    delete process.env.MNEMOSYNE_EMBEDDINGS
    expect(await health()).toBe(false)
    process.env.MNEMOSYNE_EMBEDDINGS = 'on'
    expect(await health()).toBe(true)
  })
})

describe('the page helpers', () => {
  const memory = (initial?: string) => {
    const data = new Map<string, string>(initial === undefined ? [] : [[MODE_KEY, initial]])
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
  }

  test('the remembered mode round-trips, and junk or throwing storage reads as none', () => {
    const store = memory()
    expect(readMode(store)).toBeNull()
    saveMode(store, 'hybrid')
    expect(readMode(store)).toBe('hybrid')
    expect(readMode(memory('meaning'))).toBeNull()
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readMode(broken)).toBeNull()
    expect(() => saveMode(broken, 'keyword')).not.toThrow()
    expect(readMode(undefined)).toBeNull()
  })

  test('without embeddings the mode is keyword whatever was remembered; with them, the remembered one else hybrid', () => {
    expect(chooseMode('hybrid', false)).toBe('keyword')
    expect(chooseMode(null, false)).toBe('keyword')
    expect(chooseMode(null, true)).toBe('hybrid')
    expect(chooseMode('keyword', true)).toBe('keyword')
  })

  test('badge and note words', () => {
    expect(matchLabel('keyword')).toBe('keyword')
    expect(matchLabel('meaning')).toBe('meaning')
    expect(matchLabel('both')).toBe('keyword + meaning')
    expect(matchLabel(undefined)).toBe('')
    expect(modeLabel('hybrid')).toBe('by keyword and meaning')
    expect(countNote(10, 14, 'keyword')).toBe('Showing 10 of 14 memories by keyword.')
    expect(countNote(14, 14, 'hybrid')).toBe('14 memories found by keyword and meaning.')
    expect(countNote(1, 1, 'keyword')).toBe('1 memory found by keyword.')
    expect(countNote(0, 0, 'keyword', 2)).toBe('Nothing found by keyword. The 2 smallest projects were not searched.')
    expect(countNote(3, 3, undefined)).toBe('3 memories found.')
    expect(SHOW_FIRST).toBe(10)
  })
})

describe('SEARCH 0.19: the page helpers', () => {
  const store = () => {
    const map = new Map<string, string>()
    return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), map }
  }

  test('recent queries: newest first, once each (case ignored), at most RECENT_MAX, and storage failures ignored', () => {
    const s = store()
    expect(readRecent(s)).toEqual([])
    pushRecent(s, 'incoterm')
    pushRecent(s, 'return PO')
    expect(pushRecent(s, '  INCOTERM ')).toEqual(['INCOTERM', 'return PO'])
    for (const q of ['a1', 'a2', 'a3', 'a4', 'a5']) pushRecent(s, q)
    expect(readRecent(s)).toEqual(['a5', 'a4', 'a3', 'a2', 'a1'])
    expect(readRecent(s).length).toBe(RECENT_MAX)
    expect(pushRecent(s, '   ')).toEqual(['a5', 'a4', 'a3', 'a2', 'a1'])
    s.map.set(RECENT_KEY, '{not json')
    expect(readRecent(s)).toEqual([])
    s.map.set(RECENT_KEY, JSON.stringify(['ok', 3, '', null]))
    expect(readRecent(s)).toEqual(['ok'])
    const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    // Blocked storage: the query is still listed for this page, just not kept.
    expect(pushRecent(broken, 'x')).toEqual(['x'])
    expect(readRecent(undefined)).toEqual([])
  })

  test('the score ring: tenths, clamped, and its text', () => {
    expect(ringClass(0.91)).toBe('s9')
    expect(ringClass(0.95)).toBe('s10')
    expect(ringClass(-1)).toBe('s0')
    expect(ringClass(7)).toBe('s10')
    expect(ringClass(Number.NaN)).toBe('s0')
    expect(ringText(0.912)).toBe('.91')
    expect(ringText(0.05)).toBe('.05')
    expect(ringText(1.2)).toBe('1.0')
  })

  test('sort without a new search, facet counts, matched words and the result header', () => {
    const hits = [
      { id: 'a', owner: 'p1', score: 0.9, timestamp: '2026-10-01', recall_count: 1, memory_type: 'fact', matched: 'both' },
      { id: 'b', owner: 'p2', score: 0.6, timestamp: '2026-11-01', recall_count: 0, memory_type: null, matched: 'meaning' },
      { id: 'c', owner: 'p1', score: 0.3, timestamp: null, recall_count: 9, memory_type: 'fact', matched: 'keyword' },
    ]
    expect(sortHits(hits, 'rank').map(h => h.id)).toEqual(['a', 'b', 'c'])
    expect(sortHits(hits, 'newest').map(h => h.id)).toEqual(['b', 'a', 'c'])
    expect(sortHits(hits, 'recalled').map(h => h.id)).toEqual(['c', 'a', 'b'])
    expect(hits.map(h => h.id)).toEqual(['a', 'b', 'c'])
    expect(countFacet(hits, 'owner')).toEqual([['p1', 2], ['p2', 1]])
    expect(countFacet(hits, 'kind')).toEqual([['fact', 2], ['unknown', 1]])
    expect(countFacet([{ owner: 'x' }], 'matched')).toEqual([['keyword', 1]])
    // One-letter words are left out; "of" is not in the text.
    expect(matchedWords('Incoterm LOCATION check', 'incoterm location x of')).toEqual(['incoterm', 'location'])
    expect(resultHead(5, 'incoterm', 'hybrid', 38)).toBe('5 results for “incoterm” · keyword + meaning · 38 ms')
    expect(resultHead(1, 'q', undefined, undefined)).toBe('1 result for “q”')
  })

  test('0.28.1: matched words are whole words and never the small question words', () => {
    expect(matchedWords('Protective communication: frame risks to protect Rohit', 'who is rohit')).toEqual(['rohit'])
    expect(matchedWords('This is his risk', 'is risk')).toEqual(['risk'])
    expect(matchedWords('Rohit runs the agency', 'tell me about Rohit')).toEqual(['rohit'])
  })

  test('0.28.1: the entity card, from each project\'s answer to one card, and as rows', () => {
    const answer = (name: string, facts: unknown[]) => JSON.stringify({ status: 'ok', results: [], entity: { name, facts } })
    const a = entityCardOf(answer('Rohit', [{ predicate: 'is based in', object: 'Germany', source: 'm1' }, { predicate: 'runs', object: 'an agency', source: 'm2' }, { bad: 1 }]))
    expect(a).toEqual({ name: 'Rohit', facts: [{ predicate: 'is based in', object: 'Germany', source: 'm1' }, { predicate: 'runs', object: 'an agency', source: 'm2' }] })
    const b = entityCardOf(answer('Rohit Sharma', [{ predicate: 'Is based in', object: 'germany', source: 'm1' }, { predicate: 'specialises in', object: 'SAP SD', source: 'm3' }]))
    expect(entityCardOf(JSON.stringify({ status: 'ok', results: [] }))).toBeNull()
    expect(entityCardOf(new Error('x'))).toBeNull()
    expect(entityCardOf(answer('Rohit', []))).toBeNull()
    // The fullest name; a fact seen twice (case aside) once.
    expect(mergeEntityCards([null, a, b])).toEqual({
      name: 'Rohit Sharma',
      facts: [
        { predicate: 'is based in', object: 'Germany', source: 'm1' },
        { predicate: 'runs', object: 'an agency', source: 'm2' },
        { predicate: 'specialises in', object: 'SAP SD', source: 'm3' },
      ],
    })
    expect(mergeEntityCards([null, null])).toBeNull()
    expect(entityRows([
      { predicate: 'specialises in', object: 'SAP SD', source: 'm3' },
      { predicate: 'is based in', object: 'Germany', source: 'm1' },
      { predicate: 'Specialises in', object: 'cutover', source: 'm4' },
    ])).toEqual([
      { predicate: 'specialises in', objects: ['SAP SD', 'cutover'], source: 'm3' },
      { predicate: 'is based in', objects: ['Germany'], source: 'm1' },
    ])
  })

  test('withKinds adds each hit its memory_type from the store, null when unknown or without a store', () => {
    const db = new Database(':memory:')
    db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, memory_type TEXT)')
    db.run("INSERT INTO working_memory VALUES ('a', 'decision'), ('b', ''), ('c', NULL)")
    const hits = mergeHits([[{ id: 'a', score: 0.5 }, { id: 'b', score: 0.4 }, { id: 'c', score: 0.3 }, { id: 'gone', score: 0.2 }]])
    expect(withKinds(db, hits).map(hit => hit.memory_type)).toEqual(['decision', null, null, null])
    expect(withKinds(undefined, hits).every(hit => hit.memory_type === null)).toBe(true)
    const old = new Database(':memory:')
    old.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY)')
    expect(withKinds(old, hits).every(hit => hit.memory_type === null)).toBe(true)
  })
})