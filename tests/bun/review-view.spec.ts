// The Review tab (ui/review.ts): the filters, the counts and the rows, on the real
// /api/memories of the real server over a temporary store (memories saved by the real
// engine). Only the DOM is stood in for.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

// ui/review.ts is DOM code (checked by ui/tsconfig.json): loaded by a path tsc does not follow.
const review = (await import(join(ROOT, 'ui', 'review.ts'))) as Record<string, any>
const { filterButtons, LOW_IMPORTANCE, matchesReview, parseReview, reviewCounts, reviewList, reviewRow, reviewText } = review

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const MARKUP = '<img src=x onerror=alert(1)>'
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()

class FakeText {
  constructor(public data: string) {}
  get textContent() {
    return this.data
  }
}
class FakeNode {
  children: (FakeNode | FakeText)[] = []
  attributes = new Map<string, string>()
  dataset: Record<string, string> = {}
  className = ''
  hidden = false
  disabled = false
  type = ''
  listeners = new Map<string, ((event: unknown) => void)[]>()
  constructor(public tagName: string) {}
  get textContent(): string {
    return this.children.map(child => child.textContent).join('')
  }
  set textContent(value: string) {
    this.children = value === '' ? [] : [new FakeText(String(value))]
  }
  append(...nodes: (FakeNode | FakeText | string)[]) {
    for (const node of nodes) this.children.push(typeof node === 'string' ? new FakeText(node) : node)
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value))
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }
  fire(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener({})
  }
  focus() {}
  all(): FakeNode[] {
    return [this, ...this.children.flatMap(child => (child instanceof FakeNode ? child.all() : []))]
  }
  texts(): string[] {
    return this.children.flatMap(child => (child instanceof FakeNode ? child.texts() : [child.data]))
  }
}
const fakeDocument = { createElement: (tag: string) => new FakeNode(tag.toLowerCase()), createTextNode: (data: string) => new FakeText(data) }
function withDocumentSync(run: () => void) {
  const g = globalThis as Record<string, unknown>
  const saved = g.document
  g.document = fakeDocument
  try {
    run()
  } finally {
    g.document = saved
  }
}

describe('The Review tab on a real store', () => {
  const temp = tempDir('review-view')
  const store = join(temp.dir, 'store')
  const ids = {} as Record<'never' | 'untagged' | 'cold' | 'low' | 'fine', string>
  let started: Started
  let now = 0
  let data: any

  async function remember(call: number, content: string, tags?: string[]) {
    const reply = body((await engineCall(CLI, store, 'project-alpha-1a2b', [toolCall(call, 'mnemopi_remember', { content, ...(tags ? { metadata: { tags } } : {}) })])).get(call)) as { memory_id: string }
    return reply.memory_id
  }

  beforeAll(async () => {
    now = Date.now()
    mkdirSync(store, { recursive: true })
    ids.never = await remember(1, `${MARKUP} never recalled`, ['a'])
    ids.untagged = await remember(2, 'untagged but recalled')
    ids.cold = await remember(3, 'recalled long ago', ['a'])
    ids.low = await remember(4, 'low importance', ['a'])
    ids.fine = await remember(5, 'recalled and tagged', ['a'])
    const db = new Database(join(store, 'mnemopi.db'))
    try {
      db.run('UPDATE working_memory SET recall_count = 2, last_recalled = ? WHERE id = ?', [iso(now - DAY), ids.untagged])
      db.run('UPDATE working_memory SET recall_count = 3, last_recalled = ?, timestamp = ? WHERE id = ?', [iso(now - 45 * DAY), iso(now - 90 * DAY), ids.cold])
      db.run('UPDATE working_memory SET recall_count = 1, last_recalled = ?, importance = 0.2 WHERE id = ?', [iso(now - DAY), ids.low])
      db.run('UPDATE working_memory SET recall_count = 5, last_recalled = ?, importance = 0.9 WHERE id = ?', [iso(now - DAY), ids.fine])
    } finally {
      db.close()
    }
    started = await startServer({ root: join(temp.dir, 'root'), store, cli: CLI, activityLog: '', pluginRoot: ROOT })
    const response = await fetch(`http://127.0.0.1:${started.port}/api/memories?sort=newest`, { headers: { Authorization: `Bearer ${started.token}` } })
    expect(response.status).toBe(200)
    data = parseReview(await response.json())
  }, 180_000)

  afterAll(() => {
    started?.stop()
    temp.dispose()
  })

  const idsOf = (filter: string) => reviewList(data.rows, filter, now).map((m: { id: string }) => m.id).sort()

  test('parseReview keeps what the page needs; a bad reply is null or empty', () => {
    expect(data.total).toBe(5)
    expect(data.rows).toHaveLength(5)
    const never = data.rows.find((m: { id: string }) => m.id === ids.never)
    expect(never).toMatchObject({ owner: 'project-alpha-1a2b', recalls: 0, lastRecalled: null, tags: ['a'], text: `${MARKUP} never recalled` })
    expect(typeof never.created).toBe('string')
    expect(parseReview(null)).toBeNull()
    expect(parseReview([])).toBeNull()
    expect(parseReview({})).toEqual({ total: 0, rows: [] })
    expect(parseReview({ memories: [{ id: 5 }, { id: '' }, { id: 'x', recall_count: -3, importance: 'high', tags: ['t', 7, ''] }] })).toEqual({
      total: 1,
      rows: [{ id: 'x', owner: '', text: '', created: null, lastRecalled: null, recalls: 0, importance: null, tags: ['t'] }],
    })
  })

  test('each filter picks its memories, and the counts agree', () => {
    // Never recalled: recall_count 0. No tags: no tag. Not recalled in 30 days: the last recall (else the save) is 30+ days old. Low importance: under 0.4.
    expect(idsOf('never')).toEqual([ids.never])
    expect(idsOf('untagged')).toEqual([ids.untagged])
    expect(idsOf('stale')).toEqual([ids.cold])
    expect(idsOf('low')).toEqual([ids.low])
    expect(reviewCounts(data.rows, now)).toEqual({ never: 1, untagged: 1, stale: 1, low: 1 })
    expect(LOW_IMPORTANCE).toBe(0.4)
  })

  test('the 30 day and 0.4 edges, and the unknowns', () => {
    const base = { id: 'm', owner: '', text: '', created: iso(now - 100 * DAY), lastRecalled: null, recalls: 0, importance: null, tags: ['t'] }
    // 30 days is cold, 29 is not; a recall resets the clock, whatever the save date; with no recall the save date counts.
    expect(matchesReview({ ...base, lastRecalled: iso(now - 30 * DAY), recalls: 1 }, 'stale', now)).toBe(true)
    expect(matchesReview({ ...base, lastRecalled: iso(now - 29 * DAY), recalls: 1 }, 'stale', now)).toBe(false)
    expect(matchesReview({ ...base }, 'stale', now)).toBe(true)
    expect(matchesReview({ ...base, created: iso(now - 2 * DAY) }, 'stale', now)).toBe(false)
    expect(matchesReview({ ...base, created: null }, 'stale', now)).toBe(false)
    // 0.4 is not low; no importance is not low.
    expect(matchesReview({ ...base, importance: 0.4 }, 'low', now)).toBe(false)
    expect(matchesReview({ ...base, importance: 0.39 }, 'low', now)).toBe(true)
    expect(matchesReview({ ...base, importance: null }, 'low', now)).toBe(false)
    expect(matchesReview({ ...base, importance: 0 }, 'low', now)).toBe(true)
  })

  test('reviewText says what the list is, that it is empty, and when the page saw only the newest', () => {
    expect(reviewText('never', 2, 5, 5)).toBe('2 memories have never come back in a recall: candidates to review or forget.')
    expect(reviewText('untagged', 1, 5, 5)).toBe('1 memory has no tag: candidates to review or forget.')
    expect(reviewText('stale', 3, 5, 5)).toContain('not come back in a recall for 30 days or more')
    expect(reviewText('low', 1, 5, 5)).toContain('an importance under 0.4')
    expect(reviewText('never', 0, 5, 5)).toBe('Every memory has come back in a recall at least once.')
    expect(reviewText('untagged', 0, 5, 5)).toBe('Every memory has a tag.')
    expect(reviewText('never', 2, 1000, 1500)).toEndWith('Looking at the newest 1000 of 1500 memories.')
  })

  test('the filter buttons are aria-pressed toggles with their counts', () => {
    withDocumentSync(() => {
      const picked: string[] = []
      const buttons = filterButtons({ never: 4, untagged: 3, stale: 2, low: 1 }, 'stale', (f: string) => picked.push(f)) as FakeNode[]
      expect(buttons.map(b => b.texts().join(''))).toEqual(['Never recalled 4', 'No tags 3', 'Not recalled in 30 days 2', 'Low importance (under 0.4) 1'])
      expect(buttons.map(b => b.attributes.get('aria-pressed'))).toEqual(['false', 'false', 'true', 'false'])
      expect(buttons.every(b => b.className === 'seg-btn' && b.type === 'button')).toBe(true)
      buttons[1]!.fire('click')
      expect(picked).toEqual(['untagged'])
    })
  })

  const host = (calls: string[] = [], failWith?: string) => ({
    project: (owner: string) => {
      const span = fakeDocument.createElement('span')
      span.textContent = owner
      return span
    },
    open: (id: string) => void calls.push(`open ${id}`),
    forget: (id: string, done: (error?: string) => void) => {
      calls.push(`forget ${id}`)
      done(failWith)
    },
    now: () => now,
  })

  test('a row has the memory, project, saved, recalls, Open and a two-step Forget; hostile text stays text', () => {
    withDocumentSync(() => {
      const calls: string[] = []
      const memory = data.rows.find((m: { id: string }) => m.id === ids.never)
      const row = reviewRow(memory, host(calls), () => calls.push('removed')) as unknown as FakeNode
      expect(row.texts()).toContain(`${MARKUP} never recalled`)
      expect(row.all().map(n => n.tagName).filter(tag => !['tr', 'td', 'span', 'button'].includes(tag))).toEqual([])
      const cells = row.children as FakeNode[]
      expect(cells).toHaveLength(5)
      expect(cells[1]!.texts()).toEqual(['project-alpha-1a2b'])
      expect(cells[2]!.texts()).toEqual(['today'])
      expect(cells[3]!.texts()).toEqual(['never'])
      const buttons = row.all().filter(n => n.tagName === 'button')
      const [open, ask, yes, keep] = buttons
      expect(buttons.map(b => b.textContent)).toEqual(['Open', 'Forget…', 'Forget', 'Keep'])
      open!.fire('click')
      expect(calls).toEqual([`open ${ids.never}`])
      // The confirm is hidden until Forget… is pressed; Keep puts it away again and calls nothing.
      const confirm = row.all().find(n => n.className === 'confirm-inline')!
      expect(confirm.hidden).toBe(true)
      ask!.fire('click')
      expect(confirm.hidden).toBe(false)
      expect(ask!.hidden).toBe(true)
      keep!.fire('click')
      expect(confirm.hidden).toBe(true)
      expect(calls).toEqual([`open ${ids.never}`])
      // Forget asks the guarded forget with the memory's id, then the row is removed.
      ask!.fire('click')
      yes!.fire('click')
      expect(calls).toEqual([`open ${ids.never}`, `forget ${ids.never}`, 'removed'])
      // A recalled memory shows how often and when.
      const cold = reviewRow(data.rows.find((m: { id: string }) => m.id === ids.cold), host(), () => {}) as unknown as FakeNode
      expect((cold.children as FakeNode[])[3]!.texts()).toEqual(['3, last 45 days ago'])
    })
    withDocumentSync(() => {
      // A failed forget keeps the row and says why.
      const calls: string[] = []
      const row = reviewRow(data.rows[0], host(calls, 'Forget failed: the server answered 500'), () => calls.push('removed')) as unknown as FakeNode
      row.all().find(n => n.textContent === 'Forget' && n.tagName === 'button')!.fire('click')
      expect(calls).toEqual([`forget ${data.rows[0].id}`])
      expect(row.texts()).toContain('Forget failed: the server answered 500')
    })
  })
})
