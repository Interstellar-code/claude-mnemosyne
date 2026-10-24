// LOG.1: bin/activity.ts appends whole JSON lines, owner-only, rotates once past
// 1 MB under an O_EXCL lock (one backup), takes over a stale lock, and never
// throws. Real files in a temp folder, real Bun processes for the races.
import { afterAll, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
