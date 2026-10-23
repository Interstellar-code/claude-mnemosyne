// The Activity feed's page logic, DOM-free: the real exported functions of
// ui/app.ts (review r1 LOW 4: Pause survives a reconnect; LOW 7: one chunk of
// the stream is drawn once).
import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { ROOT } from './helpers'

type Line = { text: string }

describe('the Activity feed state', () => {
  let app: Record<string, any>

  beforeAll(async () => {
    // A path tsc does not follow: ui/app.ts is DOM code, checked by ui/tsconfig.json.
    app = await import(join(ROOT, 'ui', 'app.ts'))
  })

  const texts = (lines: Line[]) => lines.map(line => line.text)
  const ndjson = (...names: string[]) => names.map(text => `${JSON.stringify({ text })}\n`).join('')

  test('LOW 7: every whole line of a chunk goes in, newest first, and the view is drawn once', () => {
    const feed = app.newFeed()
    let draws = 0
    const draw = () => draws++
    // Three whole lines, a blank keep-alive line, a broken one, and half a line.
    const rest = app.receiveChunk(feed, `${ndjson('a', 'b')}\n{not json\n${ndjson('c')}{"text":"d`, draw)
    expect(draws).toBe(1)
    expect(texts(feed.lines)).toEqual(['c', 'b', 'a'])
    expect(rest).toBe('{"text":"d')
    // The rest of the half line arrives: one more draw.
    expect(app.receiveChunk(feed, `${rest}"}\n`, draw)).toBe('')
    expect(draws).toBe(2)
    expect(texts(feed.lines)).toEqual(['d', 'c', 'b', 'a'])
    // Only keep-alive lines: no draw.
    expect(app.receiveChunk(feed, '\n\n', draw)).toBe('')
    expect(draws).toBe(2)
  })

  test('LOW 4: while paused, streamed lines and a reconnect reload wait, and the view is not redrawn; Resume puts them in', () => {
    const feed = app.newFeed()
    let draws = 0
    const draw = () => draws++
    expect(app.feedReload(feed, [{ text: 'old 2' }, { text: 'old 1' }], '7:100')).toBe(true)
    expect(feed.cursor).toBe('7:100')
    expect(app.feedPause(feed, true)).toBe(false)
    app.receiveChunk(feed, ndjson('while paused'), draw)
    expect(draws).toBe(0)
    expect(texts(feed.lines)).toEqual(['old 2', 'old 1'])
    // The stream drops and the page catches up: the read holds the paused line too.
    expect(app.feedReload(feed, [{ text: 'while paused' }, { text: 'old 2' }, { text: 'old 1' }], '7:180')).toBe(false)
    expect(feed.cursor).toBe('7:180')
    expect(texts(feed.lines)).toEqual(['old 2', 'old 1'])
    // The new stream starts at the cursor and sends what came after it.
    app.receiveChunk(feed, ndjson('after reconnect'), draw)
    expect(draws).toBe(0)
    expect(texts(feed.lines)).toEqual(['old 2', 'old 1'])
    // Resume: the reload, then the newer line, each once.
    expect(app.feedPause(feed, false)).toBe(true)
    expect(texts(feed.lines)).toEqual(['after reconnect', 'while paused', 'old 2', 'old 1'])
    // Resume with nothing waiting asks for no redraw.
    app.feedPause(feed, true)
    expect(app.feedPause(feed, false)).toBe(false)
  })

  test('the feed keeps at most 1000 lines', () => {
    const feed = app.newFeed()
    app.feedReload(feed, Array.from({ length: 1000 }, (_, i) => ({ text: `r${i}` })), '')
    app.feedAdd(feed, [{ text: 'new' }])
    expect(feed.lines.length).toBe(1000)
    expect(feed.lines[0].text).toBe('new')
  })
})
