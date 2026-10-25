import { expect, test } from 'claude-code/testing'
import { cleanTags, MAX_TAG_LENGTH, MAX_TAGS, NAMESPACES, normalizeTag } from '../hooks/tags'

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

test('VOCAB.2.a1: spaces become hyphens, so a tag is lowercase kebab-case', () => {
  expect(cleanTags(['code review', 'Code  Review', 'Git Commit Style', 'build_server', 'a/b', '--x--'])).toEqual(['code-review', 'git-commit-style', 'build-server', 'a-b', 'x'])
})

test('VOCAB.2.a1: each tag value is at most 31 characters, trimmed of a hyphen left at the cut', () => {
  expect(MAX_TAG_LENGTH).toBe(31)
  expect(cleanTags(['abcdefghijklmnopqrstuvwxyz0123456789'])).toEqual(['abcdefghijklmnopqrstuvwxyz01234'])
  expect(cleanTags([`${'a'.repeat(30)} tail`])).toEqual(['a'.repeat(30)])
  expect(cleanTags(['a'.repeat(31)])).toEqual(['a'.repeat(31)])
  // the namespace is not part of the 31
  expect(cleanTags([`asset:${'b'.repeat(40)}`])).toEqual([`asset:${'b'.repeat(31)}`])
})

test('VOCAB.2.a1: ns:value keeps entity, agent and asset, and a value after it is cleaned the same way', () => {
  expect([...NAMESPACES]).toEqual(['entity', 'agent', 'asset'])
  expect(cleanTags(['Agent:Claude Code', 'ENTITY: Rohit Sharma', 'asset:build_server'])).toEqual(['agent:claude-code', 'entity:rohit-sharma', 'asset:build-server'])
  // any other prefix is just punctuation in the value
  expect(cleanTags(['topic:git', 'new:idea', 'http://x'])).toEqual(['topic-git', 'new-idea', 'http-x'])
  // an empty value leaves no tag; the same tag with and without a namespace stays two tags
  expect(cleanTags(['agent:', 'entity: - ', 'git', 'asset:git'])).toEqual(['git', 'asset:git'])
})

test('VOCAB.2.a1: the cut counts code points, so an astral letter is never split', () => {
  const [cut] = cleanTags(['𠀀'.repeat(40)])
  expect(Array.from(cut ?? '').length).toBe(31)
  expect(cut).toBe('𠀀'.repeat(31))
  expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(cut ?? '')).toBe(false) // no lone high surrogate
})

test('VOCAB.2.a1: letters of any script stay; symbols and emoji are not tag characters', () => {
  expect(cleanTags(['日本語 メモ', 'café', 'Zürich'])).toEqual(['日本語-メモ', 'café', 'zürich'])
  expect(cleanTags(['🚀', '🚀 deploy 🚀', 'c++'])).toEqual(['deploy', 'c'])
})

test('empty tags and non-strings are dropped', () => {
  expect(cleanTags(['', '   ', 'ok', 5, null, { a: 1 }, ['x'], '!!!'])).toEqual(['ok'])
  expect(cleanTags([])).toEqual([])
})

test('control characters are removed', () => {
  expect(cleanTags(['de\u0000ploy\n', '\tops\u001b', '\u0007'])).toEqual(['deploy', 'ops'])
})

test('VOCAB.2.a2: an alias folds to its tag, whatever its spelling, and the folded tag counts once', () => {
  const aliases = new Map([['review', 'code-review'], ['pr-review', 'code-review'], ['openai-codex', 'agent:codex']])
  expect(cleanTags(['Review', 'PR Review', 'code review', 'git'], { aliases })).toEqual(['code-review', 'git'])
  expect(cleanTags(['OpenAI Codex'], { aliases })).toEqual(['agent:codex'])
  // without rules the same spellings stay as they are
  expect(cleanTags(['Review', 'PR Review'])).toEqual(['review', 'pr-review'])
})

test('VOCAB.2.a2: a tag equal to the project name is dropped, in any spelling, and does not use up a place', () => {
  const drop = new Set(['my-repo'])
  expect(cleanTags(['My Repo', 'my-repo', 'MY_REPO', 'git'], { drop })).toEqual(['git'])
  expect(cleanTags(['a', 'b', 'c', 'd', 'my-repo', 'e'], { drop })).toEqual(['a', 'b', 'c', 'd', 'e'])
  // only the whole tag is dropped, never a part of one
  expect(cleanTags(['my-repo-docs', 'asset:my-repo'], { drop })).toEqual(['my-repo-docs', 'asset:my-repo'])
})

test('VOCAB.2.a2: a spelling that folds into the dropped name is dropped too', () => {
  const rules = { aliases: new Map([['the-repo', 'my-repo']]), drop: new Set(['my-repo']) }
  expect(cleanTags(['The Repo', 'git'], rules)).toEqual(['git'])
})

test('VOCAB.2: normalizeTag is the cleaner of one tag', () => {
  expect(normalizeTag(' Code Review ')).toBe('code-review')
  expect(normalizeTag('???')).toBeUndefined()
  expect(normalizeTag(3)).toBeUndefined()
})
