// LOG.1: bin/activity.ts appends whole JSON lines, owner-only, rotates once past
// 1 MB under an O_EXCL lock (one backup), takes over a stale lock, and never
// throws. Real files in a temp folder, real Bun processes for the races.
import { afterAll, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { appendActivity, LOCK_STALE_MS, MAX_BYTES, rotate } from '../../bin/activity'
import { activityLine } from '../../hooks/activity-log'
import { ROOT, tempDir, isolatedEnv } from './helpers'

const SCRIPT = join(ROOT, 'bin', 'activity.ts')
const isPosix = process.platform !== 'win32'
const temp = tempDir('activity')
afterAll(() => temp.dispose())

let n = 0
const fresh = () => join(temp.dir, `case-${++n}`, 'activity.jsonl')
const entry = (i: number) => activityLine({ action: 'recall', origin: 'tool', owner: 'global', text: `q${i}`, ok: true, t: '2026-10-23T00:00:00.000Z' })
const readLines = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean) : [])

/** Runs the writer as the hooks do: `bun bin/activity.ts <path>`, lines on stdin. */
async function script(path: string, stdin: string) {
  const child = Bun.spawn([process.execPath, SCRIPT, path], { env: { ...(process.env as Record<string,string>), ...isolatedEnv() }, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  child.stdin.write(stdin)
  child.stdin.end()
  const [stderr, exitCode] = await Promise.all([new Response(child.stderr).text(), child.exited])
  return { exitCode, stderr }
}

/** A file just past `size` bytes, made of whole JSON lines. */
function bigFile(path: string, size: number) {
  mkdirSync(join(path, '..'), { recursive: true })
  const line = `${activityLine({ action: 'remember', origin: 'tool', owner: 'global', text: 'p'.repeat(150), ok: true })}\n`
  const text = line.repeat(Math.ceil((size + 1) / line.length))
  writeFileSync(path, text)
  return text
}

describe('appendActivity', () => {
  test('writes each line as one whole JSON line at the end of the file', () => {
    const path = fresh()
    appendActivity(path, [entry(1)])
    appendActivity(path, [entry(2), { action: 'stats', origin: 'ui', owner: 'global', ok: true }, '{"a":"x\\ny"}'])
    const got = readLines(path).map(line => JSON.parse(line))
    expect(got.map(e => e.text ?? e.a ?? e.action)).toEqual(['q1', 'q2', 'stats', 'x\ny'])
    expect(readFileSync(path, 'utf8').endsWith('\n')).toBe(true)
  })

  test('drops what is not one JSON object: plain text, arrays, oversize lines', () => {
    const path = fresh()
    appendActivity(path, ['not json', '[1,2]', '42', JSON.stringify({ big: 'z'.repeat(20_000) }), entry(3)])
    expect(readLines(path)).toEqual([entry(3)])
  })

  test.skipIf(!isPosix)('a new file is 0600 and a new folder 0700, even under a loose umask', () => {
    const before = process.umask(0)
    try {
      const path = fresh()
      appendActivity(path, [entry(1)])
      expect(statSync(path).mode & 0o777).toBe(0o600)
      expect(statSync(join(path, '..')).mode & 0o777).toBe(0o700)
    } finally {
      process.umask(before)
    }
  })

  test.skipIf(!isPosix)('an existing 0644 log is set to 0600 at the next append, and a rotated one becomes a 0600 backup (review r1 LOW 9)', () => {
    const path = fresh()
    appendActivity(path, [entry(1)])
    chmodSync(path, 0o644)
    appendActivity(path, [entry(2)])
    expect(statSync(path).mode & 0o777).toBe(0o600)

    const big = fresh()
    bigFile(big, 1000)
    chmodSync(big, 0o644)
    appendActivity(big, [entry(3)], { maxBytes: 1000 })
    expect(statSync(`${big}.1`).mode & 0o777).toBe(0o600)
    expect(statSync(big).mode & 0o777).toBe(0o600)
  })

  test('a path whose file name does not end in .jsonl is refused (review r1 LOW 13)', () => {
    const folder = join(temp.dir, `refuse-${++n}`)
    mkdirSync(folder)
    for (const name of ['notes.txt', 'activity.jsonl.1', 'activity.json', 'jsonl']) appendActivity(join(folder, name), [entry(1)])
    const big = join(folder, 'big.txt')
    writeFileSync(big, 'x'.repeat(2000))
    appendActivity(big, [entry(1)], { maxBytes: 1000 })
    expect(readdirSync(folder).sort()).toEqual(['big.txt'])
    expect(readFileSync(big, 'utf8')).toBe('x'.repeat(2000))
  })

  test(`past ${MAX_BYTES} bytes, the writer that takes the lock renames the file to .1 and removes the lock`, () => {
    const path = fresh()
    const old = bigFile(path, MAX_BYTES)
    appendActivity(path, [entry(1)])
    expect(readFileSync(`${path}.1`, 'utf8')).toBe(old)
    expect(readLines(path)).toEqual([entry(1)])
    expect(existsSync(`${path}.lock`)).toBe(false)
  })

  test('one backup is kept: a second rotation replaces .1', () => {
    const path = fresh()
    bigFile(path, 1000)
    appendActivity(path, [entry(1)], { maxBytes: 1000 })
    const second = bigFile(path, 1000)
    appendActivity(path, [entry(2)], { maxBytes: 1000 })
    expect(readFileSync(`${path}.1`, 'utf8')).toBe(second)
    expect(readLines(path)).toEqual([entry(2)])
    expect(existsSync(`${path}.2`)).toBe(false)
  })

  test('a writer that cannot take the lock appends without rotating', () => {
    const path = fresh()
    const old = bigFile(path, 1000)
    writeFileSync(`${path}.lock`, '')
    appendActivity(path, [entry(1)], { maxBytes: 1000 })
    expect(existsSync(`${path}.1`)).toBe(false)
    expect(readFileSync(path, 'utf8')).toBe(`${old}${entry(1)}\n`)
    expect(existsSync(`${path}.lock`)).toBe(true) // not ours: left alone
  })

  test(`a lock older than ${LOCK_STALE_MS / 1000} seconds is removed and the file rotates`, () => {
    const path = fresh()
    const old = bigFile(path, 1000)
    writeFileSync(`${path}.lock`, '')
    const past = new Date(Date.now() - LOCK_STALE_MS - 2_000)
    utimesSync(`${path}.lock`, past, past)
    appendActivity(path, [entry(1)], { maxBytes: 1000 })
    expect(readFileSync(`${path}.1`, 'utf8')).toBe(old)
    expect(readLines(path)).toEqual([entry(1)])
    expect(existsSync(`${path}.lock`)).toBe(false)
    // the stale lock was moved aside under a name of the taker's own, then removed (review r1 LOW 8)
    expect(readdirSync(join(path, '..')).filter(name => name.includes('.lock'))).toEqual([])
  })

  test('two writers that both saw the file past the cap rotate it once; .1 keeps the full old file', () => {
    const path = fresh()
    const old = bigFile(path, 1000)
    // Both looked before either rotated; each then rotates in turn, as two processes would.
    expect(rotate(path, { maxBytes: 1000 })).toBe(true)
    appendActivity(path, [entry(1)], { maxBytes: 1000 }) // the first writer's line
    expect(rotate(path, { maxBytes: 1000 })).toBe(false)
    expect(readFileSync(`${path}.1`, 'utf8')).toBe(old)
    expect(readLines(path)).toEqual([entry(1)])
  })

  test('an unwritable folder or a bad path returns quietly', () => {
    const blocked = join(temp.dir, `blocked-${++n}`)
    mkdirSync(blocked)
    if (isPosix) chmodSync(blocked, 0o500)
    try {
      expect(() => appendActivity(join(blocked, 'activity.jsonl'), [entry(1)])).not.toThrow()
      expect(() => appendActivity(join(blocked, 'deeper', 'activity.jsonl'), [entry(1)])).not.toThrow()
    } finally {
      if (isPosix) chmodSync(blocked, 0o700)
    }
    const file = join(temp.dir, `file-${++n}`)
    writeFileSync(file, 'x')
    expect(() => appendActivity(join(file, 'activity.jsonl'), [entry(1)])).not.toThrow() // parent is a file
    expect(() => appendActivity('', [entry(1)])).not.toThrow()
    expect(() => appendActivity(join(temp.dir, 'nul\0byte', 'a.jsonl'), [entry(1)])).not.toThrow()
    expect(() => appendActivity(fresh(), null as never)).not.toThrow()
  })
})

describe('bin/activity.ts as a script', () => {
  test('appends the stdin lines and exits 0', async () => {
    const path = fresh()
    const ran = await script(path, `${entry(1)}\n${entry(2)}\n`)
    expect(ran.exitCode).toBe(0)
    expect(readLines(path)).toEqual([entry(1), entry(2)])
  })

  test('an unwritable folder, a bad path or no path: exit 0, nothing thrown', async () => {
    const file = join(temp.dir, `file-${++n}`)
    writeFileSync(file, 'x')
    for (const path of [join(file, 'activity.jsonl'), '']) {
      const ran = await script(path, `${entry(1)}\n`)
      expect(ran.exitCode).toBe(0)
      expect(ran.stderr).toBe('')
    }
  })

  test('twenty writers appending at once lose no line', async () => {
    const path = fresh()
    const writers = Array.from({ length: 20 }, (_, w) => script(path, Array.from({ length: 50 }, (_, i) => `${entry(w * 1000 + i)}\n`).join('')))
    expect((await Promise.all(writers)).every(ran => ran.exitCode === 0)).toBe(true)
    const got = readLines(path).map(line => JSON.parse(line).text)
    expect(got.length).toBe(1000)
    expect(new Set(got).size).toBe(1000)
  }, 60_000)

  test('writers racing past the cap rotate once: .1 starts with the whole old file, every line lands in one of the two', async () => {
    const path = fresh()
    const old = bigFile(path, MAX_BYTES)
    const writers = Array.from({ length: 12 }, (_, w) => script(path, `${entry(w)}\n`))
    expect((await Promise.all(writers)).every(ran => ran.exitCode === 0)).toBe(true)
    const backup = readFileSync(`${path}.1`, 'utf8')
    expect(backup.startsWith(old)).toBe(true)
    // A line that raced the rotation lands at the end of .1, which is accepted.
    const raced = backup.slice(old.length).split('\n').filter(Boolean)
    const all = [...raced, ...readLines(path)].map(line => JSON.parse(line).text).sort()
    expect(all).toEqual(Array.from({ length: 12 }, (_, w) => `q${w}`).sort())
    expect(existsSync(`${path}.lock`)).toBe(false)
  }, 60_000)
})

describe('activity daily tally (MAPX.3)', () => {
  test('counting: remember/update add count, recall adds recalls, missing/non-positive count is 1, ok:false and other actions count nothing', () => {
    const path = fresh()
    const lines = [
      activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true, count: 2 }),
      activityLine({ action: 'update', origin: 'tool', owner: 'p', text: 'b', ok: true, count: 3 }),
      activityLine({ action: 'recall', origin: 'tool', owner: 'p', text: 'q', ok: true, count: 0 }),
      activityLine({ action: 'recall', origin: 'tool', owner: 'p', text: 'q', ok: true }),
      activityLine({ action: 'forget', origin: 'tool', owner: 'p', text: 'x', ok: true, count: 5 }),
      activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'c', ok: false, count: 7 }),
    ]
    appendActivity(path, lines)
    const tally = JSON.parse(readFileSync(join(dirname(path), 'activity-daily.json'), 'utf8'))
    const day = new Date().toISOString().slice(0, 10)
    expect(tally.days.p[day].writes).toBe(5)
    expect(tally.days.p[day].recalls).toBe(2)
  })

  test('UTC day: a late negative-offset t lands on the UTC day; missing t lands on today UTC', () => {
    const path = fresh()
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const t = `${yesterday.toISOString().slice(0, 10)}T23:30:00-05:00`
    const expected = new Date(t).toISOString().slice(0, 10)
    appendActivity(path, [activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true, t })])
    appendActivity(path, [activityLine({ action: 'recall', origin: 'tool', owner: 'p', text: 'q', ok: true })])
    const tally = JSON.parse(readFileSync(join(dirname(path), 'activity-daily.json'), 'utf8'))
    expect(tally.days.p[expected]).toBeDefined()
    expect(tally.days.p[new Date().toISOString().slice(0, 10)]).toBeDefined()
  })

  test('90-day drop: a day older than 90 days is gone after the next write, a recent one stays', () => {
    const path = fresh()
    const dir = dirname(path)
    mkdirSync(dir, { recursive: true })
    const oldDay = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 100)).toISOString().slice(0, 10)
    const recentDay = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 10)).toISOString().slice(0, 10)
    writeFileSync(join(dir, 'activity-daily.json'), JSON.stringify({ version: 1, days: { p: { [oldDay]: { writes: 1, recalls: 0 }, [recentDay]: { writes: 2, recalls: 0 } } } }))
    appendActivity(path, [activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true, t: new Date().toISOString() })])
    const tally = JSON.parse(readFileSync(join(dir, 'activity-daily.json'), 'utf8'))
    expect(tally.days.p[oldDay]).toBeUndefined()
    expect(tally.days.p[recentDay]).toBeDefined()
  })

  test('corrupt tally file: garbage is rebuilt as valid JSON and the log line is still appended', () => {
    const path = fresh()
    const dir = dirname(path)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'activity-daily.json'), '{garbage')
    const line = activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true })
    appendActivity(path, [line])
    const tally = JSON.parse(readFileSync(join(dir, 'activity-daily.json'), 'utf8'))
    expect(tally.days.p).toBeDefined()
    expect(readLines(path)).toEqual([line])
  })

  test('two writers at once leave a parseable file and both log lines', async () => {
    const path = fresh()
    const lineA = activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true })
    const lineB = activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'b', ok: true })
    const r1 = script(path, `${lineA}\n`)
    const r2 = script(path, `${lineB}\n`)
    const [a, b] = await Promise.all([r1, r2])
    expect(a.exitCode).toBe(0)
    expect(b.exitCode).toBe(0)
    const tally = JSON.parse(readFileSync(join(dirname(path), 'activity-daily.json'), 'utf8'))
    const day = new Date().toISOString().slice(0, 10)
    expect(typeof tally.days?.p?.[day]?.writes).toBe('number')
    expect(tally.days.p[day].writes).toBeLessThanOrEqual(2)
    expect(readLines(path).length).toBe(2)
  }, 60_000)

  test("a recall with origin 'ui' is not counted", () => {
    const path = fresh()
    appendActivity(path, [activityLine({ action: 'recall', origin: 'ui', owner: 'p', text: 'q', ok: true, count: 9 })])
    const tally = JSON.parse(readFileSync(join(dirname(path), 'activity-daily.json'), 'utf8'))
    const day = new Date().toISOString().slice(0, 10)
    expect(tally.days?.p?.[day]?.recalls ?? 0).toBe(0)
  })

  test('no text or id enters the tally file', () => {
    const path = fresh()
    appendActivity(path, [activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'secret text', ok: true, ids: ['id-1', 'id-2'] })])
    const raw = readFileSync(join(dirname(path), 'activity-daily.json'), 'utf8')
    expect(raw).not.toContain('secret text')
    expect(raw).not.toContain('id-1')
    expect(raw).not.toContain('id-2')
    expect(raw).not.toContain('"text"')
    expect(raw).not.toContain('"ids"')
  })

  test.skipIf(!isPosix)('tally file mode is 0600', () => {
    const path = fresh()
    appendActivity(path, [activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true })])
    const st = statSync(join(dirname(path), 'activity-daily.json'))
    expect((st.mode & 0o777).toString(8)).toBe('600')
  })

  test('a line the log drops is not counted; a log path not named activity.jsonl still tallies beside it', () => {
    const path = join(fresh().replace('activity.jsonl', ''), 'other.jsonl')
    mkdirSync(dirname(path), { recursive: true })
    const longLine = JSON.stringify({ t: new Date().toISOString(), action: 'remember', origin: 'tool', owner: 'p', text: 'x'.repeat(20000), ids: [], count: 1, ok: true })
    // ensure dropped by length
    expect(longLine.length).toBeGreaterThan(16 * 1024)
    const valid = activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'ok', ok: true })
    appendActivity(path, ['not an object', longLine, valid])
    const tally = JSON.parse(readFileSync(join(dirname(path), 'activity-daily.json'), 'utf8'))
    const day = new Date().toISOString().slice(0, 10)
    expect(tally.days?.p?.[day]?.writes ?? 0).toBe(1)
    expect(existsSync(join(dirname(path), 'activity-daily.json'))).toBe(true)
  })
  test.skipIf(!isPosix || process.getuid?.() === 0)('tally write failure leaves no tmp file and the log line is still written', () => {
    const path = fresh()
    const dir = dirname(path)
    mkdirSync(dir, { recursive: true })
    const tally = join(dir, 'activity-daily.json')
    mkdirSync(tally) // make rename target a directory -> failure
    try {
      const line = activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true })
      appendActivity(path, [line])
      expect(readLines(path)).toEqual([line])
      const tmps = readdirSync(dir).filter(f => f.endsWith('.tmp'))
      expect(tmps.length).toBe(0)
    } finally {
      rmSync(tally, { recursive: true, force: true })
    }
  })

  test('owner "__proto__" keeps the tally valid and does not pollute Object.prototype', () => {
    const before = Object.keys(Object.prototype).sort()
    const path = fresh()
    appendActivity(path, [activityLine({ action: 'remember', origin: 'tool', owner: '__proto__', text: 'a', ok: true, count: 1 })])
    const after = Object.keys(Object.prototype).sort()
    expect(after).toEqual(before)
    const tally = JSON.parse(readFileSync(join(dirname(path), 'activity-daily.json'), 'utf8'))
    expect(tally).toBeDefined()
    expect(typeof tally.days).toBe('object')
    expect(tally.days['__proto__']).toBeDefined()
  })

  test.skipIf(!isPosix)(`a stale tally lock older than ${LOCK_STALE_MS / 1000}s is taken over and the tally is written`, () => {
    const path = fresh()
    const dir = dirname(path)
    mkdirSync(dir, { recursive: true })
    const tally = join(dir, 'activity-daily.json')
    const lockFile = `${tally}.lock`
    writeFileSync(lockFile, '')
    const old = new Date(Date.now() - LOCK_STALE_MS - 1000)
    utimesSync(lockFile, old, old)
    appendActivity(path, [activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true })])
    const parsed = JSON.parse(readFileSync(tally, 'utf8'))
    const day = new Date().toISOString().slice(0, 10)
    expect(parsed.days?.p?.[day]?.writes).toBe(1)
    expect(existsSync(lockFile)).toBe(false)
  })

  test.skipIf(!isPosix)('skip under contention: a fresh tally lock is not taken, log line written, tally unchanged, no wait', () => {
    const path = fresh()
    const dir = dirname(path)
    mkdirSync(dir, { recursive: true })
    const tally = join(dir, 'activity-daily.json')
    writeFileSync(tally, JSON.stringify({ version: 1, days: {} }))
    const before = readFileSync(tally, 'utf8')
    const lockFile = `${tally}.lock`
    writeFileSync(lockFile, '')
    const line = activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true })
    appendActivity(path, [line])
    const after = readFileSync(tally, 'utf8')
    expect(after).toBe(before)
    expect(readLines(path)).toEqual([line])
    rmSync(lockFile, { force: true })
  })

  test.skipIf(!isPosix)('tally creates its folder with mode 0700', () => {
    const path = join(temp.dir, `case-${++n}`, 'nested', 'activity.jsonl')
    appendActivity(path, [activityLine({ action: 'remember', origin: 'tool', owner: 'p', text: 'a', ok: true })])
    const st = statSync(dirname(path))
    expect((st.mode & 0o777).toString(8)).toBe('700')
  })
})

// WIRE.4: the log rolls at setting S4 (config.json in the log's folder), 1 MiB with none.
describe('the log size follows config.json (S4)', () => {
  const setConfig = (path: string, config: object | string) => writeFileSync(join(dirname(path), 'config.json'), typeof config === 'string' ? config : JSON.stringify(config))

  test('with no config.json the log rolls at 1 MiB, as before (C3)', () => {
    const path = fresh()
    bigFile(path, 300 * 1024)
    appendActivity(path, [entry(1)])
    expect(existsSync(`${path}.1`)).toBe(false)
    const over = fresh()
    bigFile(over, MAX_BYTES)
    appendActivity(over, [entry(1)])
    expect(existsSync(`${over}.1`)).toBe(true)
  })

  test('a lower S4 rolls a smaller log; a higher S4 lets a 1 MiB log grow', () => {
    const small = fresh()
    const old = bigFile(small, 300 * 1024)
    setConfig(small, { version: 1, storage: { activityLogMaxBytes: 256 * 1024 } })
    appendActivity(small, [entry(1)])
    expect(readFileSync(`${small}.1`, 'utf8')).toBe(old)
    expect(readLines(small)).toEqual([entry(1)])

    const big = fresh()
    bigFile(big, MAX_BYTES + 1024)
    setConfig(big, { version: 1, storage: { activityLogMaxBytes: 2 * 1024 * 1024 } })
    appendActivity(big, [entry(1)])
    expect(existsSync(`${big}.1`)).toBe(false)
    expect(readLines(big).at(-1)).toBe(entry(1))
  })

  test('the script the hooks run reads it too', async () => {
    const path = fresh()
    bigFile(path, 300 * 1024)
    setConfig(path, { version: 1, storage: { activityLogMaxBytes: 256 * 1024 } })
    const ran = await script(path, `${entry(1)}\n`)
    expect(ran.exitCode).toBe(0)
    expect(existsSync(`${path}.1`)).toBe(true)
  })

  test('an out-of-range value, a wrong type and a broken file all mean 1 MiB; an explicit limit still wins', () => {
    for (const config of [{ version: 1, storage: { activityLogMaxBytes: 1000 } }, { version: 1, storage: { activityLogMaxBytes: 'big' } }, '{ not json']) {
      const path = fresh()
      bigFile(path, 300 * 1024)
      setConfig(path, config)
      appendActivity(path, [entry(1)])
      expect([JSON.stringify(config), existsSync(`${path}.1`)]).toEqual([JSON.stringify(config), false])
    }
    const path = fresh()
    bigFile(path, 300 * 1024)
    setConfig(path, { version: 1, storage: { activityLogMaxBytes: 2 * 1024 * 1024 } })
    appendActivity(path, [entry(1)], { maxBytes: 100 * 1024 })
    expect(existsSync(`${path}.1`)).toBe(true)
  })
})
