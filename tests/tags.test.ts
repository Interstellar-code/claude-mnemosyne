import { expect, test } from 'claude-code/testing'
import { cleanTags, MAX_TAG_LENGTH, MAX_TAGS } from '../hooks/tags'

test('tags are trimmed and lowercased', () => {
  expect(cleanTags(['  Build ', 'CI'])).toEqual(['build', 'ci'])
})

test('tags are unique after cleaning, first one kept', () => {
  expect(cleanTags(['deploy', 'Deploy', ' DEPLOY ', 'ops'])).toEqual(['deploy', 'ops'])
})

test('at most 5 tags', () => {
  expect(MAX_TAGS).toBe(5)
  expect(cleanTags(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual(['a', 'b', 'c', 'd', 'e'])
  // duplicates and blanks do not use up the five
  expect(cleanTags(['a', 'A', '', ' ', 'b', 'c', 'd', 'e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e'])
})

test('each tag is at most 24 characters', () => {
  expect(MAX_TAG_LENGTH).toBe(24)
  expect(cleanTags(['abcdefghijklmnopqrstuvwxyz0123'])).toEqual(['abcdefghijklmnopqrstuvwx'])
  expect(cleanTags(['abcdefghijklmnopqrstuvw  tail'])).toEqual(['abcdefghijklmnopqrstuvw']) // cut, then trimmed
})

test('empty tags and non-strings are dropped', () => {
  expect(cleanTags(['', '   ', 'ok', 5, null, { a: 1 }, ['x']])).toEqual(['ok'])
  expect(cleanTags([])).toEqual([])
})

test('the 24-character cut counts code points, never splitting an emoji', () => {
  const tag = '🚀'.repeat(30)
  const [cut] = cleanTags([tag])
  expect(Array.from(cut ?? '').length).toBe(24)
  expect(cut).toBe('🚀'.repeat(24))
  expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(cut ?? '')).toBe(false) // no lone high surrogate
})

test('control characters are removed', () => {
  expect(cleanTags(['de\u0000ploy\n', '\tops\u001b', '\u0007'])).toEqual(['deploy', 'ops'])
})
