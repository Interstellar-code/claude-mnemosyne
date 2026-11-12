// GET.1: rowInfo, the read-only look memory_get's owner check is made from (bin/row-info.ts), and visibleTo.
import { expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { rowInfo } from '../../bin/row-info'
import { MEMORY_ID, visibleTo } from '../../hooks/surface'

const COLUMNS = 'id TEXT PRIMARY KEY, content TEXT, session_id TEXT, scope TEXT, memory_type TEXT, valid_until TEXT, superseded_by TEXT'
function store() {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE working_memory (${COLUMNS}); CREATE TABLE episodic_memory (${COLUMNS})`)
  const add = db.prepare('INSERT INTO working_memory VALUES (?, ?, ?, ?, ?, ?, ?)')
  add.run('own1', 'text', 'project-a', 'channel', 'decision', null, null)
  add.run('glob1', 'text', 'project-b', 'global', 'fact', null, null)
  add.run('retired1', 'text', 'project-b', 'global', 'fact', '2020-01-01T00:00:00Z', 'glob1')
  add.run('expired1', 'text', 'project-b', 'global', 'context', '2020-01-01T00:00:00Z', null)
  add.run('later1', 'text', 'project-b', 'global', 'context', '2999-01-01T00:00:00Z', null)
  db.prepare('INSERT INTO episodic_memory VALUES (?, ?, ?, ?, ?, ?, ?)').run('epi1', 'text', 'project-a', 'channel', 'event', null, null)
  return db
}

test('GET.1: rowInfo gives owner, scope, kind and live, from working then episodic memory, never the text', () => {
  const db = store()
  expect(rowInfo(db, 'own1')).toEqual({ id: 'own1', owner: 'project-a', scope: 'channel', kind: 'decision', live: true })
  expect(rowInfo(db, 'epi1')).toEqual({ id: 'epi1', owner: 'project-a', scope: 'channel', kind: 'event', live: true })
  expect(rowInfo(db, 'retired1')?.live).toBe(false)
  expect(rowInfo(db, 'expired1')?.live).toBe(false)
  expect(rowInfo(db, 'later1')?.live).toBe(true)
  expect(rowInfo(db, 'missing')).toBeUndefined()
  expect(rowInfo(null, 'own1')).toBeUndefined()
  expect(Object.keys(rowInfo(db, 'own1')!)).not.toContain('content')
})

test('GET.1: rowInfo fails closed: a bad id, or a table it cannot read, gives undefined rather than a look at the next table', () => {
  const db = store()
  for (const id of ['--x', '-own1', '../x', '', 'a'.repeat(65), "own1' OR 1=1"]) expect(rowInfo(db, id)).toBeUndefined()
  expect(MEMORY_ID.test('e4179d6e69920923')).toBe(true)
  // An old working_memory without the columns: the episodic row with the same id is not used.
  const old = new Database(':memory:')
  old.exec(`CREATE TABLE working_memory (id TEXT, content TEXT, session_id TEXT); CREATE TABLE episodic_memory (${COLUMNS})`)
  old.prepare('INSERT INTO working_memory VALUES (?, ?, ?)').run('dup', 'private', 'project-x')
  old.prepare('INSERT INTO episodic_memory VALUES (?, ?, ?, ?, ?, ?, ?)').run('dup', 'shared', 'project-y', 'global', 'fact', null, null)
  expect(rowInfo(old, 'dup')).toBeUndefined()
})

test('GET.1: visibleTo shows a row to its owner (live or not) and a live global row to everyone; nothing else', () => {
  const db = store()
  expect(visibleTo(rowInfo(db, 'own1'), 'project-a')).toBe(true)
  expect(visibleTo(rowInfo(db, 'own1'), 'project-b')).toBe(false)
  expect(visibleTo(rowInfo(db, 'glob1'), 'project-a')).toBe(true)
  // A retired or expired global row stays hidden from other owners, as recall hides it; its owner still reads it.
  expect(visibleTo(rowInfo(db, 'retired1'), 'project-a')).toBe(false)
  expect(visibleTo(rowInfo(db, 'expired1'), 'project-a')).toBe(false)
  expect(visibleTo(rowInfo(db, 'retired1'), 'project-b')).toBe(true)
  expect(visibleTo(undefined, 'project-a')).toBe(false)
})
