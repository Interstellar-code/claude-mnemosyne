import { expect, test } from 'claude-code/testing'
import { cleanTags } from '../hooks/tags'
import { AGENT_SEEDS, aliasMap, emptyVocabulary, foldTag, normalizeTag, nsOf, parseVocabulary, projectNameOf, tagRules, VOCAB_VERSION, vocabularyText } from '../hooks/vocab'
import type { Vocabulary } from '../hooks/vocab'

const sample = (): Vocabulary => ({
  version: VOCAB_VERSION,
  tags: {
    'agent:codex': { ns: 'agent', description: 'Codex', aliases: ['openai-codex'], admitted: 'seed', count: 2 },
    'code-review': { ns: null, description: '', aliases: ['review', 'pr-review'], admitted: 'init', count: 5 },
  },
  candidates: { 'new-thing': { count: 1, firstSeen: '2026-10-24T00:00:00.000Z' } },
})

test('VOCAB.1: normalizeTag gives ns:value or value, lowercase kebab-case, 1-31 characters', () => {
  expect(normalizeTag('Code Review')).toBe('code-review')
  expect(normalizeTag('  GIT  ')).toBe('git')
  expect(normalizeTag('agent:Claude Code')).toBe('agent:claude-code')
  expect(normalizeTag('Entity: Rohit')).toBe('entity:rohit')
  expect(normalizeTag('asset:build_server')).toBe('asset:build-server')
  // an unknown namespace is punctuation inside the value
  expect(normalizeTag('topic:git')).toBe('topic-git')
  expect(normalizeTag('--a//b--')).toBe('a-b')
  expect(normalizeTag('x'.repeat(40))).toBe('x'.repeat(31))
  expect(normalizeTag(`${'a'.repeat(30)}-bbb`)).toBe('a'.repeat(30))
  expect(normalizeTag('日本語 メモ')).toBe('日本語-メモ')
  expect(normalizeTag('bad\u0000tag')).toBe('badtag')
})

test('VOCAB.1: normalizeTag finds nothing in empty, punctuation-only, empty-namespace and non-string input', () => {
  for (const bad of ['', '   ', '---', '!!!', 'agent:', 'agent: -', ':', 7, null, undefined, {}]) expect(normalizeTag(bad)).toBeUndefined()
  expect(normalizeTag(':git')).toBe('git')
})

test('VOCAB.1: nsOf reads the namespace of a normalised tag', () => {
  expect(nsOf('agent:codex')).toBe('agent')
  expect(nsOf('asset:db')).toBe('asset')
  expect(nsOf('entity:rohit')).toBe('entity')
  expect(nsOf('code-review')).toBeNull()
  expect(nsOf('topic-git')).toBeNull()
})

test('VOCAB.1: the agent seeds are claude-code, codex, opencode and agy', () => {
  expect(AGENT_SEEDS.map(seed => seed.tag)).toEqual(['agent:claude-code', 'agent:codex', 'agent:opencode', 'agent:agy'])
  for (const seed of AGENT_SEEDS) expect(normalizeTag(seed.tag)).toBe(seed.tag)
})

test('VOCAB.1: vocabularyText round-trips through parseVocabulary, keys sorted', () => {
  const text = vocabularyText(sample())
  expect(text.endsWith('\n')).toBe(true)
  expect(Object.keys(JSON.parse(text).tags)).toEqual(['agent:codex', 'code-review'])
  expect(JSON.parse(text).tags['code-review'].aliases).toEqual(['pr-review', 'review'])
  const parsed = parseVocabulary(text)
  expect(parsed.tags['code-review']!.aliases).toEqual(['pr-review', 'review'])
  expect(parsed.candidates).toEqual(sample().candidates)
  expect(vocabularyText(parseVocabulary(text))).toBe(text)
})

test('VOCAB.1: parseVocabulary refuses a file of the wrong shape and says what is wrong', () => {
  const good = JSON.parse(vocabularyText(sample()))
  const bad = (change: (value: any) => void) => {
    const copy = JSON.parse(JSON.stringify(good))
    change(copy)
    return () => parseVocabulary(JSON.stringify(copy))
  }
  expect(() => parseVocabulary('not json')).toThrow('not JSON')
  expect(() => parseVocabulary('[]')).toThrow('version')
  expect(bad(v => (v.version = 2))).toThrow('version')
  expect(bad(v => delete v.candidates)).toThrow('tags and candidates')
  expect(bad(v => (v.tags['Bad Tag'] = v.tags['code-review']))).toThrow('bad tag entry')
  expect(bad(v => (v.tags['code-review'].ns = 'agent'))).toThrow('bad tag entry')
  expect(bad(v => (v.tags['code-review'].admitted = 'whenever'))).toThrow('bad tag entry')
  expect(bad(v => (v.tags['code-review'].count = -1))).toThrow('bad tag entry')
  expect(bad(v => (v.tags['code-review'].aliases = ['Not Normal']))).toThrow('bad tag entry')
  expect(bad(v => (v.candidates['new-thing'].firstSeen = 5))).toThrow('bad candidate')
  expect(emptyVocabulary()).toEqual({ version: 1, tags: {}, candidates: {} })
})

test('VOCAB.1: foldTag normalises, then maps an alias to its tag', () => {
  const vocab = sample()
  expect(foldTag(vocab, 'Review')).toBe('code-review')
  expect(foldTag(vocab, 'PR Review')).toBe('code-review')
  expect(foldTag(vocab, 'OpenAI Codex')).toBe('agent:codex')
  expect(foldTag(vocab, 'unknown thing')).toBe('unknown-thing')
  expect(foldTag(vocab, '!!!')).toBeUndefined()
  expect(foldTag(aliasMap(vocab), 'review')).toBe('code-review')
})

test('VOCAB.2.a2: projectNameOf reads the readable name from a per-project owner and from nothing else', () => {
  expect(projectNameOf('project-My-Repo-1a2b')).toBe('my-repo')
  expect(projectNameOf('project-claude-mnemosyne-9z')).toBe('claude-mnemosyne')
  expect(projectNameOf('project-x-5')).toBe('x')
  for (const other of ['global', '', 'project--', 'project-1a2b', 'my-repo', undefined, null, 7]) expect(projectNameOf(other)).toBeUndefined()
})

test('VOCAB.2.a2: tagRules gives the vocabulary aliases and the owner\'s project name; either may be missing, and a broken file is not fatal', () => {
  const text = vocabularyText(sample())
  const rules = tagRules(text, 'project-My-Repo-1a2b')
  expect(rules.aliases?.get('review')).toBe('code-review')
  expect([...(rules.drop ?? [])]).toEqual(['my-repo'])
  expect(cleanTags(['Review', 'My Repo', 'git'], rules)).toEqual(['code-review', 'git'])
  // the global owner has no project name; no file means no aliases
  expect(tagRules(text, 'global').drop).toBeUndefined()
  expect(tagRules(undefined, 'project-My-Repo-1a2b')).toEqual({ drop: new Set(['my-repo']) })
  expect(tagRules(undefined)).toEqual({})
  for (const broken of ['', 'not json', '{"version":1}', '{"version":2,"tags":{},"candidates":{}}']) {
    const fallback = tagRules(broken, 'project-My-Repo-1a2b')
    expect(fallback.aliases).toBeUndefined()
    expect(cleanTags(['Review', 'My Repo'], fallback)).toEqual(['review'])
  }
})

test('VOCAB.2.a2: hooks/vocab.ts and hooks/tags.ts still read and fold the same tag from every spelling', () => {
  const vocab = sample()
  for (const spelling of ['Review', 'review', ' REVIEW ', 'PR Review', 'pr_review', 'PR-review']) expect(cleanTags([spelling], { aliases: aliasMap(vocab) })).toEqual(['code-review'])
  expect(foldTag(vocab, 'Code Review')).toBe('code-review')
})
