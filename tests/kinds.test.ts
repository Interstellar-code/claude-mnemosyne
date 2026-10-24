import { expect, test } from 'claude-code/testing'
import { isKind, KIND_LIST, KIND_NAMES, KINDS, kindLabel, kindProblem, NO_KIND_WARNING } from '../hooks/kinds'

test('META.1.a1: the eight kinds, by engine name, each with a plain label', () => {
  expect(KINDS.map(kind => [kind.name, kind.label])).toEqual([
    ['fact', 'fact'],
    ['preference', 'preference'],
    ['instruction', 'rule or runbook'],
    ['decision', 'decision'],
    ['context', 'project state'],
    ['error', 'bug note'],
    ['artifact', 'reference'],
    ['event', 'session summary'],
  ])
  expect([...KIND_NAMES]).toEqual(['fact', 'preference', 'instruction', 'decision', 'context', 'error', 'artifact', 'event'])
  expect(kindLabel('context')).toBe('project state')
  expect(kindLabel('anything')).toBe('anything')
})

test('META.1.a1: unknown is not a kind a caller can choose, and names are exact', () => {
  expect(isKind('unknown')).toBe(false)
  expect(isKind('FACT')).toBe(false)
  expect(isKind(undefined)).toBe(false)
  expect(isKind(7)).toBe(false)
  for (const name of KIND_NAMES) expect(isKind(name)).toBe(true)
})

test('META.1.a2: kindProblem lets a missing kind through and names the choices for any other value', () => {
  expect(kindProblem(undefined)).toBeUndefined()
  expect(kindProblem(null)).toBeUndefined()
  expect(kindProblem('decision')).toBeUndefined()
  for (const bad of ['unknown', 'Decision', '', 'x'.repeat(100), 7, {}, ['fact']]) {
    const problem = kindProblem(bad)
    expect(problem).toContain('unknown kind')
    expect(problem).toContain(KIND_LIST)
    expect(problem!.length).toBeLessThan(KIND_LIST.length + 80)
  }
  expect(kindProblem('bad\nkind')).not.toContain('\n')
})

test('META.1.a2: the missing-kind warning is one line', () => {
  expect(NO_KIND_WARNING).not.toContain('\n')
  expect(NO_KIND_WARNING).toContain("'unknown'")
})
