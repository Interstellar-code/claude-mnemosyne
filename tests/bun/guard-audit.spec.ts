import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Plugin tests (tests/*.test.ts) cannot read files, so the C1 "imports nothing" rule is checked here.
test('hooks/guard.ts imports nothing (C1)', () => {
  const source = readFileSync(join(import.meta.dir, '..', '..', 'hooks', 'guard.ts'), 'utf8')
  const importLines = source.split('\n').filter((line) => /^\s*(import\b|export\b.*\bfrom\b)|\brequire\(|\bimport\(/.test(line))
  expect(importLines).toEqual([])
})

// GUARD.3: bun bin/guard-audit.ts --store <dir> prints counts only, from a read-only handle.
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { ROOT, tempDir } from './helpers'

const AUDIT = join(ROOT, 'bin', 'guard-audit.ts')
const AWS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'

async function audit(...args: string[]) {
  const child = Bun.spawn([process.execPath, AUDIT, ...args], { stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

describe('the guard audit of a temp store', () => {
  const temp = tempDir('guard-audit')
  const store = join(temp.dir, 'store')
  const file = join(store, 'mnemopi.db')
  const ROWS: [string, string][] = [
    ['a1', 'The plugin keeps its memories in one local SQLite file.'], // allow
    ['a2', 'Rohit prefers short answers with the result first.'], // allow
    ['a3', '/Users/rohits/Development/claude-mnemosyne/hooks/register.ts holds the hooks'], // allow (a path)
    ['w1', 'Today the importer was rewired to use the guard module'], // warn G4
    ['w2', '2026-10-24 released 0.7.6 with the dashboard polish'], // warn G4
    ['w3', `${'a long fact '.repeat(150)}`], // warn G2 (1800 chars)
    ['b1', `the bucket key is ${AWS_KEY} for the deploy`], // block G1
    ['b2', 'tiny'], // block G2
    ['b3', `${'x'.repeat(4001)}`], // block G2
  ]
  const sha = () => createHash('sha256').update(readFileSync(file)).digest('hex')

  beforeAll(() => {
    mkdirSync(store, { recursive: true })
    const db = new Database(file)
    db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, session_id TEXT, content TEXT, metadata_json TEXT, timestamp TEXT)')
    for (const [id, content] of ROWS) db.run('INSERT INTO working_memory VALUES (?, ?, ?, NULL, ?)', [id, 'global', content, '2026-10-24'])
    db.run("INSERT INTO working_memory VALUES ('n1', 'global', NULL, NULL, '2026-10-24')") // a null text counts as empty
    db.close()
  })
  afterAll(() => temp.dispose())

  test('prints the rows per verdict and the rows each rule hit, by verdict', async () => {
    const out = await audit('--store', store)
    expect(out.exitCode).toBe(0)
    expect(out.stderr).toBe('')
    expect(out.stdout.trim().split('\n')).toEqual([
      'Guard audit (read only)',
      'rows: 10',
      'verdict allow: 3',
      'verdict warn: 3',
      'verdict block: 4',
      "rows hit by rule, by the row's verdict:",
      'G1: allow 0, warn 0, block 1',
      'G2: allow 0, warn 1, block 3',
      'G4: allow 0, warn 2, block 0',
    ])
  })

  test('prints no memory text, id or owner, and leaves the database file byte for byte as it was', async () => {
    const before = sha()
    const out = await audit('--store', store)
    for (const piece of [AWS_KEY, 'bucket', 'tiny', 'plugin keeps', 'Rohit', 'importer', 'a long fact', 'xxxx', 'a1', 'b1', 'global', '/Users']) {
      expect([piece, out.stdout.includes(piece), out.stderr.includes(piece)]).toEqual([piece, false, false])
    }
    expect(sha()).toBe(before)
  })

  test('a store with no database, no --store or an extra argument is refused with exit 1 and a usage or reason line', async () => {
    const empty = join(temp.dir, 'empty')
    mkdirSync(empty, { recursive: true })
    const missing = await audit('--store', empty)
    expect(missing.exitCode).toBe(1)
    expect(missing.stdout).toBe('')
    expect(missing.stderr).toContain('nothing to audit')
    for (const args of [[], ['--store'], ['--store', store, 'extra'], ['--store', '--other'], [store]]) {
      const out = await audit(...args)
      expect([args, out.exitCode, out.stdout]).toEqual([args, 1, ''])
      expect(out.stderr).toContain('Usage: bun bin/guard-audit.ts --store <dir>')
    }
  })

  test("G4 reads each row's kind, as a save does: a dated rule is allowed, the same text as a fact or unknown warns", async () => {
    const kinded = join(temp.dir, 'kinded')
    mkdirSync(kinded, { recursive: true })
    const db = new Database(join(kinded, 'mnemopi.db'))
    db.run('CREATE TABLE working_memory (id TEXT PRIMARY KEY, content TEXT, memory_type TEXT)')
    const rule = 'Merge small changes to main once scoped tests pass. Why: user 2026-10-13 said review rounds are done too slowly.'
    for (const [id, kind] of [['k1', 'instruction'], ['k2', 'decision'], ['k3', 'fact'], ['k4', 'unknown']] as const) db.run('INSERT INTO working_memory VALUES (?, ?, ?)', [id, rule, kind])
    db.close()
    const out = await audit('--store', kinded)
    expect(out.exitCode).toBe(0)
    expect(out.stdout).toContain('verdict allow: 2')
    expect(out.stdout).toContain('G4: allow 0, warn 2, block 0')
  })
})
