// Search match modes: the pure classifier, mergeHits keeping the per-signal scores,
// POST /api/search `mode` validation and its reply fields (against a stand-in engine that
// records whether it ran with embeddings), and the page's mode helpers (ui/search-mode.ts).
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { classifyMatch, MATCH_EPSILON, mergeHits, SEARCH_LIMIT, startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { chooseMode, countNote, matchLabel, MODE_KEY, modeLabel, readMode, saveMode, SHOW_FIRST } from '../../ui/search-mode'
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
