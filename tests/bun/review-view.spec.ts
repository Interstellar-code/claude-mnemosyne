// The Review tab (ui/review.ts): the filters, the counts and the rows, on the real
// /api/memories of the real server over a temporary store (memories saved by the real
// engine). Only the DOM is stood in for.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { startServer } from '../../ui/server'
import type { Started } from '../../ui/server'
import { body, engineCall, ROOT, tempDir, toolCall } from './helpers'

// ui/review.ts is DOM code (checked by ui/tsconfig.json): loaded by a path tsc does not follow.
const review = (await import(join(ROOT, 'ui', 'review.ts'))) as Record<string, any>
const { candidateRow, filterButtons, historyLine, liveRows, LOW_IMPORTANCE, matchesReview, nearPartner, notLiveRow, parseQueue, parseReview, queueText, reviewCounts, reviewList, reviewRow, reviewText, stateMark } = review

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
  value = ''
  placeholder = ''
  maxLength = 0
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
      rows: [{ id: 'x', owner: '', text: '', created: null, lastRecalled: null, recalls: 0, importance: null, tags: ['t'], state: 'live' }],
    })
  })

  test('each filter picks its memories, and the counts agree', () => {
    // Never recalled: recall_count 0. No tags: no tag. Not recalled in 30 days: the last recall (else the save) is 30+ days old. Low importance: under 0.4.
    expect(idsOf('never')).toEqual([ids.never])
    expect(idsOf('untagged')).toEqual([ids.untagged])
    expect(idsOf('stale')).toEqual([ids.cold])
    expect(idsOf('low')).toEqual([ids.low])
    expect(reviewCounts(data.rows, now)).toEqual({ never: 1, untagged: 1, stale: 1, low: 1, retire: 0, notlive: 0 })
    expect(reviewCounts(data.rows, now, { retire: 3, notlive: 2 })).toMatchObject({ never: 1, retire: 3, notlive: 2 })
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
    expect(reviewText('never', 2, 5, 5)).toBe('2 memories have never come back in a recall: candidates to review or retire.')
    expect(reviewText('untagged', 1, 5, 5)).toBe('1 memory has no tag: candidates to review or retire.')
    expect(reviewText('stale', 3, 5, 5)).toContain('not come back in a recall for 30 days or more')
    expect(reviewText('low', 1, 5, 5)).toContain('an importance under 0.4')
    expect(reviewText('never', 0, 5, 5)).toBe('Every memory has come back in a recall at least once.')
    expect(reviewText('untagged', 0, 5, 5)).toBe('Every memory has a tag.')
    expect(reviewText('never', 2, 1000, 1500)).toEndWith('Looking at the newest 1000 of 1500 memories.')
  })

  test('the filter buttons are aria-pressed toggles with their counts', () => {
    withDocumentSync(() => {
      const picked: string[] = []
      const buttons = filterButtons({ never: 4, untagged: 3, stale: 2, low: 1, retire: 5, notlive: 6 }, 'stale', (f: string) => picked.push(f)) as FakeNode[]
      expect(buttons.map(b => b.texts().join(''))).toEqual(['Never recalled 4', 'No tags 3', 'Not recalled in 30 days 2', 'Low importance (under 0.4) 1', 'Retire candidates 5', 'Not live 6'])
      expect(buttons.map(b => b.attributes.get('aria-pressed'))).toEqual(['false', 'false', 'true', 'false', 'false', 'false'])
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
    retire: (id: string, replacedBy: string | undefined, done: (error?: string) => void) => {
      calls.push(`retire ${id}${replacedBy === undefined ? '' : ` by ${replacedBy}`}`)
      done(failWith)
    },
    restore: (id: string, done: (error?: string) => void) => {
      calls.push(`restore ${id}`)
      done(failWith)
    },
    lastUsed: (id: string) => (id === ids.cold ? iso(now - 45 * DAY) : null),
    now: () => now,
  })

  test('a row has the memory, project, saved, recalls, Open and a two-step Retire that names the memory; hostile text stays text', () => {
    withDocumentSync(() => {
      const calls: string[] = []
      const memory = data.rows.find((m: { id: string }) => m.id === ids.never)
      const row = reviewRow(memory, host(calls), () => calls.push('removed')) as unknown as FakeNode
      expect(row.texts()).toContain(`${MARKUP} never recalled`)
      expect(row.all().map(n => n.tagName).filter(tag => !['tr', 'td', 'span', 'button', 'input'].includes(tag))).toEqual([])
      const cells = row.children as FakeNode[]
      expect(cells).toHaveLength(5)
      expect(cells[1]!.texts()).toEqual(['project-alpha-1a2b'])
      expect(cells[2]!.texts()).toEqual(['today'])
      expect(cells[3]!.texts()).toEqual(['never'])
      const buttons = row.all().filter(n => n.tagName === 'button')
      const [open, ask, yes, keep] = buttons
      // Forget is gone from the row (it stays in the memory sheet): Retire takes its place.
      expect(buttons.map(b => b.textContent)).toEqual(['Open', 'Retire…', 'Retire', 'Keep'])
      expect(row.texts().join(' ')).not.toContain('Forget')
      open!.fire('click')
      expect(calls).toEqual([`open ${ids.never}`])
      // The confirm is hidden until Retire… is pressed; it names the memory's first line and id and offers "replaced by"; Keep puts it away and calls nothing.
      const confirm = row.all().find(n => n.className === 'confirm-inline')!
      expect(confirm.hidden).toBe(true)
      ask!.fire('click')
      expect(confirm.hidden).toBe(false)
      expect(ask!.hidden).toBe(true)
      expect(confirm.texts().join('')).toContain(`“${MARKUP} never recalled” · ${ids.never}`)
      const replaced = confirm.all().find(n => n.tagName === 'input')!
      expect(replaced.placeholder).toContain('Replaced by')
      keep!.fire('click')
      expect(confirm.hidden).toBe(true)
      expect(calls).toEqual([`open ${ids.never}`])
      // Retire asks for this one memory, with the typed replacement, then the row is removed.
      ask!.fire('click')
      replaced.value = '  abc123  '
      yes!.fire('click')
      expect(calls).toEqual([`open ${ids.never}`, `retire ${ids.never} by abc123`, 'removed'])
      // No replacement typed: none is sent.
      const plain = reviewRow(memory, host(calls), () => {}) as unknown as FakeNode
      plain.all().find(n => n.textContent === 'Retire' && n.tagName === 'button')!.fire('click')
      expect(calls.at(-1)).toBe(`retire ${ids.never}`)
      // A recalled memory shows how often and when.
      const cold = reviewRow(data.rows.find((m: { id: string }) => m.id === ids.cold), host(), () => {}) as unknown as FakeNode
      expect((cold.children as FakeNode[])[3]!.texts()).toEqual(['3, last 45 days ago'])
    })
    withDocumentSync(() => {
      // A failed retire keeps the row and says why.
      const calls: string[] = []
      const row = reviewRow(data.rows[0], host(calls, 'Retire failed: the server answered 500'), () => calls.push('removed')) as unknown as FakeNode
      row.all().find(n => n.textContent === 'Retire' && n.tagName === 'button')!.fire('click')
      expect(calls).toEqual([`retire ${data.rows[0].id}`])
      expect(row.texts()).toContain('Retire failed: the server answered 500')
    })
  })

  test('nothing is bulk: one Retire button per row asks for that memory only, and no row or list has a select-all or a checkbox', () => {
    withDocumentSync(() => {
      const calls: string[] = []
      const rows: FakeNode[] = data.rows.map((memory: unknown) => reviewRow(memory, host(calls), () => {}) as unknown as FakeNode)
      expect(rows).toHaveLength(5)
      for (const row of rows) expect(row.all().filter(n => n.tagName === 'button' && n.textContent === 'Retire')).toHaveLength(1)
      for (const row of rows) expect(row.all().filter(n => n.tagName === 'input').every(n => n.type === 'text')).toBe(true)
      // Retiring the third row calls the host once, for the third row's memory.
      rows[2]!.all().find((n: FakeNode) => n.tagName === 'button' && n.textContent === 'Retire')!.fire('click')
      expect(calls).toEqual([`retire ${data.rows[2].id}`])
      const labels = (filterButtons({ never: 0, untagged: 0, stale: 0, low: 0, retire: 0, notlive: 0 }, 'never', () => {}) as FakeNode[]).map(b => b.texts().join('').toLowerCase())
      expect(labels.some(label => /\b(all|select)\b/.test(label))).toBe(false)
    })
    // The page has no bulk markup and no loop that retires more than one memory per confirm.
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    expect(html).not.toMatch(/select-all|retire-all|type="checkbox"[^>]*review/i)
  })

  test('parseQueue keeps what the page needs; a bad or older reply is null or empty', () => {
    expect(parseQueue(null)).toBeNull()
    expect(parseQueue([])).toBeNull()
    expect(parseQueue({})).toEqual({ candidates: [], candidateTotal: 0, notLive: [], notLiveTotal: 0 })
    const queue = parseQueue({
      candidates: [{ id: 'a', owner: 'p', preview: 'text', reasons: ['marked superseded', 7, ''] }, { id: '' }, { nope: 1 }],
      candidateTotal: 9,
      notLive: [{ id: 'b', owner: 'p', preview: 'old', state: 'weird', since: '2026-10-01T00:00:00.000Z' }, { id: 'c', state: 'expired', history: [{ action: 'expire', validator: 'expire-sweep', at: '2026-10-02T00:00:00.000Z' }, { nope: 1 }] }],
    })!
    expect(queue.candidates).toEqual([{ id: 'a', owner: 'p', text: 'text', reasons: ['marked superseded'] }])
    expect(queue.candidateTotal).toBe(9)
    // An unknown state reads as lapsed; a missing history is empty.
    expect(queue.notLive[0]).toMatchObject({ id: 'b', state: 'lapsed', history: [] })
    expect(queue.notLive[1]).toMatchObject({ id: 'c', state: 'expired', history: [{ action: 'expire', validator: 'expire-sweep' }] })
    expect(queue.notLiveTotal).toBe(2)
  })

  test('queueText and the three state marks', () => {
    expect(queueText('retire', 0, 0)).toBe('Nothing looks like it needs retiring.')
    expect(queueText('retire', 2, 2)).toContain('2 memories are worth a second look. Retire one at a time')
    expect(queueText('retire', 200, 350)).toEndWith('Showing the first 200 of 350.')
    expect(queueText('notlive', 0, 0)).toBe('Every memory is live.')
    expect(queueText('notlive', 1, 1)).toContain('1 memory is not live')
    const day = (ms: number) => {
      const d = new Date(ms)
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    expect(stateMark({ state: 'retired' })).toBe('retired')
    expect(stateMark({ state: 'expired' }, iso(now - 45 * DAY))).toBe(`expired as unused (last used ${day(now - 45 * DAY)})`)
    expect(stateMark({ state: 'expired' })).toBe('expired as unused')
    expect(stateMark({ state: 'lapsed' })).toBe('lapsed (its expiry date passed)')
    expect(historyLine({ action: 'retire', validator: 'dashboard', at: iso(now) })).toBe(`retired by dashboard, ${day(now)}`)
    expect(historyLine({ action: 'expire', validator: 'expire-sweep', at: null })).toBe('expired by expire-sweep')
    expect(historyLine({ action: 'restore', validator: 'unknown', at: iso(now) })).toBe(`restored, ${day(now)}`)
  })

  test('a near-duplicate candidate reads "keep one of these" and its confirm names the other one', () => {
    expect(nearPartner('near-duplicate of abc123 (0.93)')).toBe('abc123')
    expect(nearPartner('marked superseded')).toBeNull()
    withDocumentSync(() => {
      const calls: string[] = []
      const pair = { id: 'aaa', owner: 'p', text: 'first copy', reasons: ['near-duplicate of bbb (0.95)', 'dated status note'] }
      const row = candidateRow(pair, host(calls), () => calls.push('removed')) as unknown as FakeNode
      const text = row.texts().join(' ')
      expect(text).toContain('near-duplicate of bbb (0.95)')
      expect(text).toContain('Keep one of these: retire only one of this pair (the other is bbb).')
      const confirm = row.all().find(n => n.className === 'confirm-inline')!
      expect(confirm.texts().join(' ')).toContain('Retire only one: the other is bbb.')
      expect(row.all().filter(n => n.tagName === 'button').map(b => b.textContent)).toEqual(['Open', 'Retire…', 'Retire', 'Keep'])
      row.all().find(n => n.textContent === 'Retire' && n.tagName === 'button')!.fire('click')
      expect(calls).toEqual(['retire aaa', 'removed'])
      // A plain candidate has no pair note.
      const plain = candidateRow({ id: 'ccc', owner: 'p', text: '', reasons: ['marked superseded'] }, host(), () => {}) as unknown as FakeNode
      expect(plain.texts().join(' ')).not.toContain('Keep one of these')
      expect(plain.texts()).toContain('(no text)')
    })
  })

  test('the Not live list shows each row with its state mark, date, last audit rows and Restore; no audit rows, no lines', () => {
    withDocumentSync(() => {
      const calls: string[] = []
      const retired = { id: 'r1', owner: 'p', text: MARKUP, state: 'retired', since: iso(now), history: [{ action: 'retire', validator: 'dashboard', at: iso(now) }] }
      const row = notLiveRow(retired, host(calls), () => calls.push('restored')) as unknown as FakeNode
      expect(row.texts()).toContain(MARKUP)
      expect(row.all().map(n => n.tagName).filter(tag => !['tr', 'td', 'span', 'button', 'div'].includes(tag))).toEqual([])
      const cells = row.children as FakeNode[]
      expect(cells).toHaveLength(5)
      expect(cells[2]!.texts()[0]).toBe('retired')
      expect(cells[3]!.texts()).toEqual([historyLine(retired.history[0])])
      expect(cells[4]!.all().filter(n => n.tagName === 'button').map(b => b.textContent)).toEqual(['Open', 'Restore'])
      cells[4]!.all().find(n => n.textContent === 'Restore')!.fire('click')
      expect(calls).toEqual(['restore r1', 'restored'])
      // Expired as unused names its last-used day when the page has it; lapsed with no history shows no history line.
      const expired = notLiveRow({ id: ids.cold, owner: 'p', text: 'x', state: 'expired', since: iso(now), history: [] }, host(), () => {}) as unknown as FakeNode
      expect((expired.children as FakeNode[])[2]!.texts()[0]).toContain('expired as unused (last used ')
      const lapsed = notLiveRow({ id: 'l1', owner: 'p', text: 'x', state: 'lapsed', since: null, history: [] }, host(), () => {}) as unknown as FakeNode
      expect((lapsed.children as FakeNode[])[2]!.texts()).toEqual(['lapsed (its expiry date passed)'])
      expect((lapsed.children as FakeNode[])[3]!.children).toEqual([])
    })
    withDocumentSync(() => {
      // A failed restore keeps the row and says why.
      const calls: string[] = []
      const row = notLiveRow({ id: 'r2', owner: 'p', text: 'x', state: 'retired', since: null, history: [] }, host(calls, 'Restore failed: boom'), () => calls.push('restored')) as unknown as FakeNode
      row.all().find(n => n.textContent === 'Restore')!.fire('click')
      expect(calls).toEqual(['restore r2'])
      expect(row.texts()).toContain('Restore failed: boom')
    })
  })

  test('the real /api/review: a SUPERSEDED row is a candidate with its reason; retiring it moves it to Not live with its audit line', async () => {
    const superseded = await remember(10, 'SUPERSEDED: the old plan, replaced by the new one', ['a'])
    const answer = async (path: string, payload?: unknown) =>
      fetch(`http://127.0.0.1:${started.port}${path}`, {
        method: payload === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${started.token}`, ...(payload === undefined ? {} : { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${started.port}` }) },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      })
    const before = parseQueue(await (await answer('/api/review')).json())!
    const found = before.candidates.find((c: { id: string }) => c.id === superseded)
    expect(found?.reasons).toContain('marked superseded')
    expect(before.notLive.some((n: { id: string }) => n.id === superseded)).toBe(false)
    const retire = await answer('/api/memory/retire', { memory_id: superseded })
    expect(retire.status).toBe(200)
    const after = parseQueue(await (await answer('/api/review')).json())!
    expect(after.candidates.some((c: { id: string }) => c.id === superseded)).toBe(false)
    const gone = after.notLive.find((n: { id: string }) => n.id === superseded)
    expect(gone).toMatchObject({ state: 'retired', history: [{ action: 'retire', validator: 'dashboard' }] })
    expect(historyLine(gone.history[0])).toMatch(/^retired by dashboard, \d{4}-\d{2}-\d{2}$/)
    // /api/memories now says the row is not live, and the four filters leave it out.
    const list = parseReview(await (await answer('/api/memories?sort=newest')).json())
    expect(list.rows.find((m: { id: string }) => m.id === superseded)?.state).toBe('retired')
    expect(liveRows(list.rows).some((m: { id: string }) => m.id === superseded)).toBe(false)
    // Restore brings it back.
    expect((await answer('/api/memory/restore', { memory_id: superseded })).status).toBe(200)
    const back = parseQueue(await (await answer('/api/review')).json())!
    expect(back.notLive.some((n: { id: string }) => n.id === superseded)).toBe(false)
  })

  test('the real /api/memory/retire with replaced_by: the server names the replacement, and the row is retired', async () => {
    const old = await remember(11, 'the old way of doing it', ['a'])
    const fresh = await remember(12, 'the new way of doing it', ['a'])
    const post = async (payload: unknown) =>
      fetch(`http://127.0.0.1:${started.port}/api/memory/retire`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${started.token}`, 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${started.port}` },
        body: JSON.stringify(payload),
      })
    // A replacement that is not in the store is refused, and nothing is retired.
    expect((await post({ memory_id: old, replaced_by: 'no-such-memory' })).status).toBe(400)
    const retire = await post({ memory_id: old, replaced_by: fresh })
    expect(retire.status).toBe(200)
    expect(await retire.json()).toMatchObject({ status: 'retired', memory_id: old, replaced_by: fresh })
    const list = parseReview(await (await fetch(`http://127.0.0.1:${started.port}/api/memories?sort=newest`, { headers: { Authorization: `Bearer ${started.token}` } })).json())
    expect(list.rows.find((m: { id: string }) => m.id === old)?.state).toBe('retired')
    expect(list.rows.find((m: { id: string }) => m.id === fresh)?.state).not.toBe('retired')
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      expect((db.query('SELECT superseded_by FROM working_memory WHERE id = ?').get(old) as { superseded_by: string | null }).superseded_by).toBe(fresh)
    } finally {
      db.close()
    }
  })
})
