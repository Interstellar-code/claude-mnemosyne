// The importers (plan phase IMPORT): the pure part. Documents are split into
// chunks and sessions are boiled down to a few memories; bin/import.ts reads the
// files (a hook cannot read a large file or SQLite), hooks/register.ts runs the
// guard, the near-duplicate check, the C9 backup and the saves. Nothing here
// touches a file or a process, so `claude plugin test` runs it.
//
// C8: a proposal file (import-proposed.json) holds paths, headings, sha256 values,
// rule ids and verdicts, never the text of a chunk or of a session.
import type { GuardResult, NearMatch } from './guard'

/** The proposals file in the data root; one pending import at a time. */
export const IMPORT_PROPOSALS_FILE = 'import-proposed.json'
/** A document must be smaller than this (the plan: under 1 MB). */
export const DOC_MAX_BYTES = 1_048_576
/** The most characters in one chunk, its heading path included. */
export const CHUNK_MAX_CHARS = 1500
/**
 * The most chunks one import may hold. A document over it is refused with its chunk count, so a big
 * file cannot flood the store: the person splits it, or keeps only the part worth remembering.
 */
export const IMPORT_MAX_CHUNKS = 200
/** The longest heading path that rides in front of a chunk's text. */
const PREFIX_MAX_CHARS = 300
const HEADING_KEY_MAX = 120

export const IMPORT_USAGE =
  'Usage: /mnemosyne-import doc <path> (a dry run: a .md or .txt file under 1 MB is split at headings and every chunk is checked; nothing is written), /mnemosyne-import session <id | last> (a dry run: Haiku proposes up to 5 durable memories from a past session; nothing is written) or /mnemosyne-import apply [confirm] (backs the store up, then saves what the last dry run checked; confirm also saves the chunks that carry a warning).'

export type ImportArgs =
  | { mode: 'doc'; path: string }
  | { mode: 'session'; target: string }
  | { mode: 'apply'; confirm: boolean }
  | { mode: 'usage' }

/** `/mnemosyne-import doc <path>`, `session <id | last>` or `apply [confirm]`; a path may be quoted. */
export function parseImportArgs(args: string): ImportArgs {
  const text = args.trim()
  const space = text.search(/\s/)
  const word = (space === -1 ? text : text.slice(0, space)).toLowerCase()
  const rest = space === -1 ? '' : text.slice(space).trim()
  if (word === 'apply') {
    if (rest === '') return { mode: 'apply', confirm: false }
    return rest.toLowerCase() === 'confirm' ? { mode: 'apply', confirm: true } : { mode: 'usage' }
  }
  if (word === 'doc') {
    const path = rest.replace(/^(["'])(.*)\1$/, '$2').trim()
    return path === '' ? { mode: 'usage' } : { mode: 'doc', path }
  }
  if (word === 'session') {
    const target = rest.replace(/^(["'])(.*)\1$/, '$2').trim()
    return target === '' || /\s/.test(target) ? { mode: 'usage' } : { mode: 'session', target }
  }
  return { mode: 'usage' }
}

/** Only .md and .txt documents are imported. */
export const isImportableDoc = (path: string) => /\.(?:md|txt)$/i.test(path)

// ---- Splitting a document ----

export type DocChunk = {
  /** The heading path, "Setup > Install", with "(part 2/3)" when the section was cut and " #2" when the same path repeats. Unique in the document. */
  heading: string
  /** What is saved: the heading path, a blank line, then the text. At most CHUNK_MAX_CHARS characters. */
  text: string
}
export type SplitResult = { chunks: DocChunk[]; skippedEmpty: number }

const HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/
const FENCE = /^ {0,3}(```|~~~)/

const cut = (text: string, limit: number) => {
  if (text.length <= limit) return text
  let end = limit
  // never half a surrogate pair
  const last = text.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff) end--
  return text.slice(0, end)
}

/** `text` cut into pieces of at most `limit` characters, at paragraph, then line, then sentence, then word boundaries. */
function pieces(text: string, limit: number): string[] {
  const out: string[] = []
  let current = ''
  const flush = () => {
    if (current.trim() !== '') out.push(current.trim())
    current = ''
  }
  const add = (part: string, joiner: string) => {
    if (current === '') current = part
    else if (current.length + joiner.length + part.length <= limit) current += joiner + part
    else {
      flush()
      current = part
    }
  }
  for (const paragraph of text.split(/\n{2,}/)) {
    const para = paragraph.trim()
    if (para === '') continue
    if (para.length <= limit) {
      add(para, '\n\n')
      continue
    }
    flush()
    // A paragraph over the limit: its lines, then its sentences, then its words, then a hard cut.
    for (const line of para.split('\n')) {
      const l = line.trim()
      if (l === '') continue
      if (l.length <= limit) {
        add(l, '\n')
        continue
      }
      flush()
      for (const sentence of l.split(/(?<=[.!?])\s+/)) {
        let rest = sentence
        while (rest.length > limit) {
          const space = rest.lastIndexOf(' ', limit)
          const at = space > limit / 2 ? space : limit
          const head = cut(rest, at)
          add(head.trim(), ' ')
          flush()
          rest = rest.slice(head.length).trim()
        }
        if (rest !== '') add(rest, ' ')
      }
      flush()
    }
  }
  flush()
  return out
}

/**
 * Splits a document at its headings into chunks of at most CHUNK_MAX_CHARS characters (the heading path
 * included). A heading with no text under it makes no chunk. '#' lines inside a fenced code block are text.
 */
export function splitDocument(raw: string): SplitResult {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const stack: { level: number; title: string }[] = []
  const sections: { path: string; body: string[] }[] = [{ path: '', body: [] }]
  let fence: string | undefined
  for (const line of text.split('\n')) {
    const fenced = FENCE.exec(line)
    if (fenced) {
      if (fence === undefined) fence = fenced[1]
      else if (fenced[1] === fence) fence = undefined
    }
    const heading = fence === undefined && !fenced ? HEADING.exec(line) : null
    if (heading) {
      const level = heading[1]!.length
      while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop()
      stack.push({ level, title: heading[2]!.replace(/\s+/g, ' ').trim() })
      sections.push({ path: stack.map(item => item.title).join(' > '), body: [] })
    } else {
      sections[sections.length - 1]!.body.push(line)
    }
  }
  const chunks: DocChunk[] = []
  const used = new Map<string, number>()
  let skippedEmpty = 0
  for (const section of sections) {
    const body = section.body.join('\n').trim()
    if (body === '') {
      if (section.path !== '') skippedEmpty++
      continue
    }
    const path = cut(section.path, PREFIX_MAX_CHARS)
    const prefix = path === '' ? '' : `${path}\n\n`
    const parts = pieces(body, CHUNK_MAX_CHARS - prefix.length)
    const base = section.path === '' ? '(start)' : section.path
    const repeat = (used.get(base) ?? 0) + 1
    used.set(base, repeat)
    parts.forEach((part, i) => {
      const suffix = `${parts.length > 1 ? ` (part ${i + 1}/${parts.length})` : ''}${repeat > 1 ? ` #${repeat}` : ''}`
      chunks.push({ heading: `${cut(base, HEADING_KEY_MAX - suffix.length)}${suffix}`, text: `${prefix}${part}` })
    })
  }
  return { chunks, skippedEmpty }
}

/** What `bin/import.ts doc` prints: the file's size and hash, and its chunks with their hashes. */
export type DocRead = {
  path: string
  bytes: number
  fileSha256: string
  /** Chunks the document splits into, before the cap. */
  total: number
  skippedEmpty: number
  /** True when `total` is over IMPORT_MAX_CHUNKS: no chunks are listed then. */
  tooMany: boolean
  chunks: { heading: string; text: string; sha256: string }[]
}

// ---- Verdicts ----

/** unchanged: this text is already imported from the file. allow and warn: it can be saved (a warn needs confirm in strict mode). block: never saved. */
export type ImportVerdict = 'allow' | 'warn' | 'block' | 'unchanged'

/** One live row an earlier import made from the same file (bin/import.ts origins). */
export type ExistingChunk = { id: string; owner: string; heading: string; sha256: string }

export type ChunkInput = { heading: string; sha256: string }
export type ChunkEntry = {
  heading: string
  sha256: string
  verdict: ImportVerdict
  /** Rule ids that fired: G1, G2, G3, G4, G7. Never the text they matched. */
  rules: string[]
  /** The earlier row this chunk replaces (same heading, different text), retired once the new row is saved. */
  replaces?: { id: string; owner: string }
  /** A warned chunk needs `confirm` whatever the guard mode (the chatter check set to strict). */
  mustConfirm?: true
  near: NearMatch[]
}

/**
 * Decides what each chunk becomes. `guard` is admit()'s answer for the chunk's text, `near` its near-duplicates
 * (G3). A chunk whose text an earlier import already made is 'unchanged'; one whose heading was imported with other text
 * replaces that row, and that row is not a near-duplicate to warn about. A near-duplicate is a warning.
 */
export function classifyChunks(chunks: readonly ChunkInput[], existing: readonly ExistingChunk[], guards: readonly GuardResult[], near: readonly (readonly NearMatch[])[]): ChunkEntry[] {
  const bySha = new Set(existing.map(row => row.sha256))
  const byHeading = new Map(existing.map(row => [row.heading, row]))
  return chunks.map((chunk, i) => {
    if (bySha.has(chunk.sha256)) return { heading: chunk.heading, sha256: chunk.sha256, verdict: 'unchanged', rules: [], near: [] }
    const old = byHeading.get(chunk.heading)
    const guard = guards[i]!
    const closeOnes = (near[i] ?? []).filter(match => match.id !== old?.id)
    const rules = [...new Set([...guard.hits.map(hit => hit.rule as string), ...(closeOnes.length > 0 ? ['G3'] : [])])]
    const verdict: ImportVerdict = guard.verdict === 'block' ? 'block' : guard.verdict === 'warn' || closeOnes.length > 0 ? 'warn' : 'allow'
    return {
      heading: chunk.heading,
      sha256: chunk.sha256,
      verdict,
      rules,
      ...(old === undefined || verdict === 'block' ? {} : { replaces: { id: old.id, owner: old.owner } }),
      ...(guard.mustConfirm === true ? { mustConfirm: true as const } : {}),
      near: closeOnes,
    }
  })
}

/** Whether apply saves this entry: clean ones always, warned ones in warn mode or with confirm (a must-confirm warning needs confirm in both modes). */
export function savesEntry(entry: ChunkEntry, guardMode: 'strict' | 'warn', confirm: boolean): boolean {
  if (entry.verdict === 'allow') return true
  if (entry.verdict !== 'warn') return false
  if (confirm) return true
  return guardMode === 'warn' && entry.mustConfirm !== true
}

export type ImportCounts = { total: number; allow: number; warn: number; block: number; unchanged: number; replace: number }

export function countEntries(entries: readonly ChunkEntry[]): ImportCounts {
  const counts: ImportCounts = { total: entries.length, allow: 0, warn: 0, block: 0, unchanged: 0, replace: 0 }
  for (const entry of entries) {
    counts[entry.verdict]++
    if (entry.replaces !== undefined) counts.replace++
  }
  return counts
}

/** The provenance every imported row carries (C4), by kind of import. */
export const importProvenance = (kind: 'doc' | 'session') => ({
  source: kind === 'doc' ? 'import:doc' : 'import:session',
  trust_tier: 'IMPORTED',
  veracity: 'imported',
  author_id: 'import',
  author_type: 'system',
})

/** `metadata.origin` of a document chunk: where it came from and which text it was. */
export const docOrigin = (path: string, chunk: ChunkInput) => ({ path, sha256: chunk.sha256, heading: chunk.heading })

// ---- The proposals file (C8) ----

export type ProposalChunk = { heading: string; sha256: string; verdict: ImportVerdict; rules: string[]; replaces?: string }
export type DocProposal = { kind: 'doc'; path: string; fileSha256: string; created: string; chunks: ProposalChunk[] }

const HEX64 = /^[0-9a-f]{64}$/
const VERDICTS = new Set<string>(['allow', 'warn', 'block', 'unchanged'])
const RULE_ID = /^G\d{1,2}$/

/** The saved document proposal, or undefined when the file is not one (anything else is refused, never half-read). */
export function parseDocProposal(text: string): DocProposal | undefined {
  try {
    const value = JSON.parse(text) as Record<string, unknown>
    if (value?.version !== 1 || value.kind !== 'doc' || typeof value.path !== 'string' || typeof value.fileSha256 !== 'string' || !HEX64.test(value.fileSha256) || !Array.isArray(value.chunks)) return undefined
    const chunks: ProposalChunk[] = []
    for (const item of value.chunks as Record<string, unknown>[]) {
      if (typeof item?.sha256 !== 'string' || !HEX64.test(item.sha256) || typeof item.verdict !== 'string' || !VERDICTS.has(item.verdict)) return undefined
      chunks.push({
        heading: typeof item.heading === 'string' ? item.heading : '',
        sha256: item.sha256,
        verdict: item.verdict as ImportVerdict,
        rules: Array.isArray(item.rules) ? item.rules.filter((rule): rule is string => typeof rule === 'string' && RULE_ID.test(rule)) : [],
        ...(typeof item.replaces === 'string' ? { replaces: item.replaces } : {}),
      })
    }
    return { kind: 'doc', path: value.path, fileSha256: value.fileSha256, created: typeof value.created === 'string' ? value.created : '', chunks }
  } catch {
    return undefined
  }
}

/** The stdin of `bin/import.ts save` for a document dry run: nothing but paths, headings, hashes, verdicts and ids. */
export function docProposalInput(path: string, fileSha256: string, entries: readonly ChunkEntry[]) {
  return {
    kind: 'doc',
    path,
    fileSha256,
    chunks: entries.map(entry => ({ heading: entry.heading, sha256: entry.sha256, verdict: entry.verdict, rules: entry.rules, ...(entry.replaces === undefined ? {} : { replaces: entry.replaces.id }) })),
  }
}

/** A short list of the entries for a dry run reply: index, verdict, rules and a heading cut to 50 characters (no heading for a blocked chunk). */
export function entryLines(entries: readonly ChunkEntry[], limit = 40): string[] {
  const lines = entries.slice(0, limit).map((entry, i) => {
    const tag = entry.verdict === 'unchanged' ? 'unchanged' : entry.verdict === 'block' ? 'blocked' : entry.replaces !== undefined ? `${entry.verdict}, replaces ${entry.replaces.id}` : entry.verdict
    const rules = entry.rules.length > 0 ? ` [${entry.rules.join(',')}]` : ''
    const near = entry.near.length > 0 ? ` near ${entry.near.map(match => match.id).join(',')}` : ''
    return `${String(i + 1).padStart(3)}  ${tag}${rules}${near}  ${entry.verdict === 'block' ? '(heading hidden)' : Array.from(entry.heading).slice(0, 50).join('')}`
  })
  if (entries.length > limit) lines.push(`… and ${entries.length - limit} more`)
  return lines
}
