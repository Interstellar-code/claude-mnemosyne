import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Plugin tests (tests/*.test.ts) cannot read files, so the C1 "imports nothing" rule is checked here.
test('hooks/guard.ts imports nothing (C1)', () => {
  const source = readFileSync(join(import.meta.dir, '..', '..', 'hooks', 'guard.ts'), 'utf8')
  const importLines = source.split('\n').filter((line) => /^\s*(import\b|export\b.*\bfrom\b)|\brequire\(|\bimport\(/.test(line))
  expect(importLines).toEqual([])
})
