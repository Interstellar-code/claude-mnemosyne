import { expect, test } from 'claude-code/testing'
import { admit } from '../hooks/guard'
import type { NearMatch } from '../hooks/guard'
import {
  CHUNK_MAX_CHARS,
  classifyChunks,
  countEntries,
  docOrigin,
  docProposalInput,
  entryLines,
  IMPORT_MAX_CHUNKS,
  importProvenance,
  isImportableDoc,
  parseDocProposal,
  parseImportArgs,
  savesEntry,
  splitDocument,
} from '../hooks/import'
import type { ChunkEntry } from '../hooks/import'

const sha = (n: number) => n.toString(16).padStart(64, '0')
const near = (id: string): NearMatch => ({ id, owner: 'global', score: 0.93, preview: 'close text' })
const sentence = 'The dashboard server listens on a random free port and prints it once.'

// ---- arguments ----

test('parseImportArgs reads doc, session and apply, and refuses everything else', () => {
  expect(parseImportArgs('doc notes/plan.md')).toEqual({ mode: 'doc', path: 'notes/plan.md' })
  expect(parseImportArgs('  DOC   "/tmp/My Notes/plan.md"  ')).toEqual({ mode: 'doc', path: '/tmp/My Notes/plan.md' })
  expect(parseImportArgs("doc 'a b.txt'")).toEqual({ mode: 'doc', path: 'a b.txt' })
  expect(parseImportArgs('session last')).toEqual({ mode: 'session', target: 'last' })
  expect(parseImportArgs('apply')).toEqual({ mode: 'apply', confirm: false })
  expect(parseImportArgs('apply confirm')).toEqual({ mode: 'apply', confirm: true })
  for (const bad of ['', 'doc', 'session', 'session a b', 'apply now', 'apply confirm yes', 'tags', 'apply-all']) {
    expect(parseImportArgs(bad)).toEqual({ mode: 'usage' })
  }
})

test('only .md and .txt documents are importable', () => {
  expect(isImportableDoc('/a/b/notes.md')).toBe(true)
  expect(isImportableDoc('/a/b/NOTES.TXT')).toBe(true)
  for (const no of ['/a/b/notes.markdown', '/a/b/script.ts', '/a/b/id_rsa', '/a/b/notes.md.bak', '/a/b/notes']) expect(isImportableDoc(no)).toBe(false)
})

// ---- splitting ----

test('a document splits at headings, with the heading path in front of each chunk', () => {
  const { chunks, skippedEmpty } = splitDocument(['Intro text before any heading, long enough to keep.', '', '# Setup', '', sentence, '', '## Install', '', `${sentence} Install it.`, '', '# Usage', '', `${sentence} Use it.`].join('\n'))
  expect(chunks.map(chunk => chunk.heading)).toEqual(['(start)', 'Setup', 'Setup > Install', 'Usage'])
  expect(chunks[0]!.text).toBe('Intro text before any heading, long enough to keep.')
  expect(chunks[2]!.text).toBe(`Setup > Install\n\n${sentence} Install it.`)
  expect(skippedEmpty).toBe(0)
})

test('a heading with no text under it makes no chunk and is counted', () => {
  const { chunks, skippedEmpty } = splitDocument(`# Title\n\n## Empty\n\n## Real\n\n${sentence}`)
  expect(chunks.map(chunk => chunk.heading)).toEqual(['Title > Real'])
  expect(skippedEmpty).toBe(2)
})

test('a # line inside a fenced code block is text, not a heading', () => {
  const { chunks } = splitDocument(['# Doc', '', 'Run this:', '', '```sh', '# not a heading', 'echo hi', '```', '', 'Done with the example block here.'].join('\n'))
  expect(chunks).toHaveLength(1)
  expect(chunks[0]!.text).toContain('# not a heading')
})

test('every chunk is at most CHUNK_MAX_CHARS characters, the heading path included, and no text is lost', () => {
  const paragraph = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} of a long paragraph with enough words in it.`).join(' ')
  const body = Array.from({ length: 8 }, () => paragraph).join('\n\n')
  const { chunks } = splitDocument(`# Big section\n\n${body}`)
  expect(chunks.length).toBeGreaterThan(5)
  for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS)
  const joined = chunks.map(chunk => chunk.text.replace('Big section\n\n', '')).join(' ').replace(/\s+/g, ' ')
  for (const n of [0, 30, 59]) expect(joined).toContain(`Sentence number ${n} of`)
  expect(chunks[0]!.heading).toBe(`Big section (part 1/${chunks.length})`)
})

test('one unbroken run longer than the limit is still cut', () => {
  const { chunks } = splitDocument(`# Blob\n\n${'x'.repeat(4000)}`)
  expect(chunks.length).toBeGreaterThanOrEqual(3)
  for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(CHUNK_MAX_CHARS)
})

test('the same heading twice gets distinct keys, and the split is stable', () => {
  const text = `# Notes\n\n${sentence} First.\n\n# Notes\n\n${sentence} Second.`
  const first = splitDocument(text).chunks
  expect(first.map(chunk => chunk.heading)).toEqual(['Notes', 'Notes #2'])
  expect(splitDocument(text).chunks).toEqual(first)
})

test('line endings and a byte-order mark do not change the chunks', () => {
  const unix = `# A\n\n${sentence}\n\n# B\n\n${sentence} Two.`
  expect(splitDocument(`﻿${unix.replace(/\n/g, '\r\n')}`)).toEqual(splitDocument(unix))
})

test('a text file with no headings is one chunk per paragraph run', () => {
  const { chunks } = splitDocument(`${sentence}\n\n${sentence} Again.`)
  expect(chunks).toHaveLength(1)
  expect(chunks[0]!.heading).toBe('(start)')
})

test('the flood cap is a fixed number', () => {
  expect(IMPORT_MAX_CHUNKS).toBe(200)
})

// ---- verdicts ----

const clean = admit({ content: sentence, kind: 'artifact', origin: 'import' })
const blocked = admit({ content: 'short', kind: 'artifact', origin: 'import' })
const warned = admit({ content: `Released on 2026-10-01, done and merged. ${sentence}`, kind: 'artifact', origin: 'import' })

test('classifyChunks: clean, blocked, warned, unchanged and replacing chunks', () => {
  const chunks = [
    { heading: 'A', sha256: sha(1) },
    { heading: 'B', sha256: sha(2) },
    { heading: 'C', sha256: sha(3) },
    { heading: 'D', sha256: sha(4) },
    { heading: 'E', sha256: sha(5) },
  ]
  const existing = [
    { id: 'aa01', owner: 'global', heading: 'D', sha256: sha(4) },
    { id: 'aa02', owner: 'global', heading: 'E', sha256: sha(99) },
  ]
  const entries = classifyChunks(chunks, existing, [clean, blocked, warned, clean, clean], [[], [], [], [], []])
  expect(entries.map(entry => entry.verdict)).toEqual(['allow', 'block', 'warn', 'unchanged', 'allow'])
  expect(entries[2]!.rules).toContain('G4')
  expect(entries[4]!.replaces).toEqual({ id: 'aa02', owner: 'global' })
  expect(entries[0]!.replaces).toBeUndefined()
  expect(countEntries(entries)).toEqual({ total: 5, allow: 2, warn: 1, block: 1, unchanged: 1, replace: 1 })
})

test('a near-duplicate is a warning, except the row the chunk replaces', () => {
  const chunks = [{ heading: 'A', sha256: sha(1) }, { heading: 'B', sha256: sha(2) }]
  const existing = [{ id: 'aa02', owner: 'global', heading: 'B', sha256: sha(98) }]
  const entries = classifyChunks(chunks, existing, [clean, clean], [[near('bb01')], [near('aa02')]])
  expect(entries[0]!.verdict).toBe('warn')
  expect(entries[0]!.rules).toEqual(['G3'])
  expect(entries[0]!.near.map(match => match.id)).toEqual(['bb01'])
  // the replaced row is close to its own new version on purpose
  expect(entries[1]!.verdict).toBe('allow')
  expect(entries[1]!.replaces?.id).toBe('aa02')
})

test('a blocked chunk replaces nothing and an unchanged chunk is never checked', () => {
  const entries = classifyChunks([{ heading: 'A', sha256: sha(1) }, { heading: 'B', sha256: sha(2) }], [{ id: 'aa01', owner: 'global', heading: 'A', sha256: sha(77) }, { id: 'aa02', owner: 'global', heading: 'B', sha256: sha(2) }], [blocked, blocked], [[], []])
  expect(entries[0]!.verdict).toBe('block')
  expect(entries[0]!.replaces).toBeUndefined()
  expect(entries[1]!.verdict).toBe('unchanged')
})

test('savesEntry: clean always, warned in warn mode or with confirm, a must-confirm warning only with confirm, blocked never', () => {
  const entry = (verdict: ChunkEntry['verdict'], mustConfirm = false): ChunkEntry => ({ heading: 'A', sha256: sha(1), verdict, rules: [], near: [], ...(mustConfirm ? { mustConfirm: true as const } : {}) })
  expect(savesEntry(entry('allow'), 'strict', false)).toBe(true)
  expect(savesEntry(entry('warn'), 'strict', false)).toBe(false)
  expect(savesEntry(entry('warn'), 'strict', true)).toBe(true)
  expect(savesEntry(entry('warn'), 'warn', false)).toBe(true)
  expect(savesEntry(entry('warn', true), 'warn', false)).toBe(false)
  expect(savesEntry(entry('warn', true), 'warn', true)).toBe(true)
  for (const never of ['block', 'unchanged'] as const) {
    expect(savesEntry(entry(never), 'warn', true)).toBe(false)
    expect(savesEntry(entry(never), 'strict', true)).toBe(false)
  }
})

// ---- provenance and proposals ----

test('imported rows carry the C4 provenance of their kind', () => {
  expect(importProvenance('doc')).toEqual({ source: 'import:doc', trust_tier: 'IMPORTED', veracity: 'imported', author_id: 'import', author_type: 'system' })
  expect(importProvenance('session').source).toBe('import:session')
  expect(docOrigin('/a/b.md', { heading: 'A > B', sha256: sha(1) })).toEqual({ path: '/a/b.md', sha256: sha(1), heading: 'A > B' })
})

test('the proposal input holds paths, headings, hashes, rule ids, verdicts and row ids, never chunk text', () => {
  const entries = classifyChunks([{ heading: 'A', sha256: sha(1) }, { heading: 'B', sha256: sha(2) }], [{ id: 'aa02', owner: 'global', heading: 'B', sha256: sha(9) }], [warned, clean], [[], []])
  const input = docProposalInput('/a/b.md', sha(7), entries)
  expect(input).toEqual({
    kind: 'doc',
    path: '/a/b.md',
    fileSha256: sha(7),
    chunks: [
      { heading: 'A', sha256: sha(1), verdict: 'warn', rules: ['G4'] },
      { heading: 'B', sha256: sha(2), verdict: 'allow', rules: [], replaces: 'aa02' },
    ],
  })
  const text = JSON.stringify(input)
  expect(text).not.toContain('dashboard')
  expect(text).not.toContain('Released')
})

test('parseDocProposal accepts what bin/import.ts writes and refuses anything else', () => {
  const file = JSON.stringify({ version: 1, kind: 'doc', created: '2026-10-26T00:00:00.000Z', path: '/a/b.md', fileSha256: sha(7), chunks: [{ heading: 'A', sha256: sha(1), verdict: 'allow', rules: ['G4', 'bad rule'] }] })
  expect(parseDocProposal(file)).toEqual({ kind: 'doc', path: '/a/b.md', fileSha256: sha(7), created: '2026-10-26T00:00:00.000Z', chunks: [{ heading: 'A', sha256: sha(1), verdict: 'allow', rules: ['G4'] }] })
  for (const bad of ['', 'nope', '{}', JSON.stringify({ version: 2, kind: 'doc' }), JSON.stringify({ version: 1, kind: 'session' }), JSON.stringify({ version: 1, kind: 'doc', path: '/a', fileSha256: 'x', chunks: [] }), JSON.stringify({ version: 1, kind: 'doc', path: '/a', fileSha256: sha(1), chunks: [{ sha256: sha(1), verdict: 'maybe' }] })]) {
    expect(parseDocProposal(bad)).toBeUndefined()
  }
})

test('entryLines hides the heading of a blocked chunk, cuts long headings and shortens a long list', () => {
  const entries = classifyChunks(
    Array.from({ length: 45 }, (_, i) => ({ heading: i === 1 ? 'Secret heading text' : 'H'.repeat(80), sha256: sha(i + 1) })),
    [],
    Array.from({ length: 45 }, (_, i) => (i === 1 ? blocked : clean)),
    Array.from({ length: 45 }, () => []),
  )
  const lines = entryLines(entries)
  expect(lines).toHaveLength(41)
  expect(lines[1]).toContain('blocked')
  expect(lines[1]).toContain('(heading hidden)')
  expect(lines[1]).not.toContain('Secret')
  expect(lines[0]).toContain('H'.repeat(50))
  expect(lines[0]).not.toContain('H'.repeat(51))
  expect(lines[40]).toBe('… and 5 more')
})
