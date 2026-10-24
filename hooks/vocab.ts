// The shared tag vocabulary (v3 plan, C5 and C6): the file's shape, the tag format and alias folding.
// The file is <root>/vocabulary.json, mode 0600, written only by bin/vocab.ts; the tagger, the cleaner
// and the dashboard read it. No imports, so the hooks, the proxy, the dashboard server and the Bun
// specs can all use it.

export const VOCAB_VERSION = 1
export const VOCAB_FILE = 'vocabulary.json'

/** The namespaces a tag may carry: `ns:value`. A tag with none is a plain topic. */
export const NAMESPACES = ['entity', 'agent', 'asset'] as const
export type Namespace = (typeof NAMESPACES)[number]

/** The agents the vocabulary starts with (the `agent:` seeds), each with a plain description. */
export const AGENT_SEEDS: readonly { tag: string; description: string }[] = [
  { tag: 'agent:claude-code', description: 'Claude Code' },
  { tag: 'agent:codex', description: 'Codex' },
  { tag: 'agent:opencode', description: 'OpenCode' },
  { tag: 'agent:agy', description: 'AGY' },
]

/** How a tag came to be admitted: seeded with the file, taken from the store at init, by a person, or by the tagger's rule. */
export type Admitted = 'seed' | 'init' | 'manual' | 'auto'
const ADMITTED: ReadonlySet<string> = new Set(['seed', 'init', 'manual', 'auto'])

export interface VocabTag {
  /** The namespace, or null for a plain topic tag. */
  ns: Namespace | null
  description: string
  /** Other spellings that fold into this tag (normalised). */
  aliases: string[]
  admitted: Admitted
  /** How many memories carry the tag (after folding), as of the last count. */
  count: number
}
export interface VocabCandidate {
  count: number
  /** ISO time the tag was first proposed. */
  firstSeen: string
}
export interface Vocabulary {
  version: number
  tags: Record<string, VocabTag>
  candidates: Record<string, VocabCandidate>
}

export const MAX_VALUE_LENGTH = 31

/**
 * A tag in the C6 format, or undefined when nothing is left of it. `ns:value` keeps a namespace only when it
 * is entity, agent or asset (any other `x:` is punctuation inside the value); the value is lowercase
 * kebab-case: every run of anything but letters and digits becomes one hyphen ('code review' -> 'code-review'),
 * the ends are trimmed of hyphens, and it is cut to 31 characters (code points).
 */
export function normalizeTag(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const text = raw.replace(/\p{Cc}/gu, '').normalize('NFKC').trim().toLowerCase()
  const colon = text.indexOf(':')
  const prefix = colon > 0 ? text.slice(0, colon).trim() : ''
  const ns = (NAMESPACES as readonly string[]).includes(prefix) ? prefix : undefined
  const value = Array.from((ns === undefined ? text : text.slice(colon + 1)).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, ''))
    .slice(0, MAX_VALUE_LENGTH)
    .join('')
    .replace(/-+$/g, '')
  if (value === '') return undefined
  return ns === undefined ? value : `${ns}:${value}`
}

/** The namespace of a normalised tag, or null. */
export function nsOf(tag: string): Namespace | null {
  const prefix = tag.includes(':') ? tag.slice(0, tag.indexOf(':')) : ''
  return (NAMESPACES as readonly string[]).includes(prefix) ? (prefix as Namespace) : null
}

export const emptyVocabulary = (): Vocabulary => ({ version: VOCAB_VERSION, tags: {}, candidates: {} })

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

/** Reads the file's text into a Vocabulary; throws a message naming what is wrong. Own keys only, so no key can reach a prototype. */
export function parseVocabulary(text: string): Vocabulary {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('vocabulary.json is not JSON')
  }
  if (!isObject(value) || value.version !== VOCAB_VERSION) throw new Error(`vocabulary.json needs version ${VOCAB_VERSION}`)
  if (!isObject(value.tags) || !isObject(value.candidates)) throw new Error('vocabulary.json needs tags and candidates objects')
  const vocab = emptyVocabulary()
  for (const [tag, entry] of Object.entries(value.tags)) {
    if (normalizeTag(tag) !== tag || !isObject(entry)) throw new Error(`vocabulary.json has a bad tag entry "${tag.slice(0, 40)}"`)
    const { ns, description, aliases, admitted, count } = entry
    if (ns !== nsOf(tag) || typeof description !== 'string' || !Array.isArray(aliases) || !aliases.every(alias => typeof alias === 'string' && normalizeTag(alias) === alias) || typeof admitted !== 'string' || !ADMITTED.has(admitted) || typeof count !== 'number' || !Number.isInteger(count) || count < 0)
      throw new Error(`vocabulary.json has a bad tag entry "${tag}"`)
    vocab.tags[tag] = { ns: ns as Namespace | null, description, aliases: [...new Set(aliases as string[])], admitted: admitted as Admitted, count }
  }
  for (const [tag, entry] of Object.entries(value.candidates)) {
    if (normalizeTag(tag) !== tag || !isObject(entry) || typeof entry.count !== 'number' || !Number.isInteger(entry.count) || entry.count < 0 || typeof entry.firstSeen !== 'string')
      throw new Error(`vocabulary.json has a bad candidate "${tag.slice(0, 40)}"`)
    vocab.candidates[tag] = { count: entry.count, firstSeen: entry.firstSeen }
  }
  return vocab
}

/** The file's text: keys sorted, so two writes of the same vocabulary are the same bytes. */
export function vocabularyText(vocab: Vocabulary): string {
  const sorted = <T,>(record: Record<string, T>) => Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]!]))
  const tags = Object.fromEntries(Object.entries(sorted(vocab.tags)).map(([tag, entry]) => [tag, { ...entry, aliases: [...entry.aliases].sort() }]))
  return `${JSON.stringify({ version: vocab.version, tags, candidates: sorted(vocab.candidates) }, null, 2)}\n`
}

/** alias -> the tag it folds into. */
export function aliasMap(vocab: Vocabulary): Map<string, string> {
  const map = new Map<string, string>()
  for (const [tag, entry] of Object.entries(vocab.tags)) for (const alias of entry.aliases) map.set(alias, tag)
  return map
}

/** A tag in the C6 format with its alias folded to the admitted tag it stands for; undefined when nothing is left of it. */
export function foldTag(vocab: Vocabulary | Map<string, string>, raw: unknown): string | undefined {
  const tag = normalizeTag(raw)
  if (tag === undefined) return undefined
  const map = vocab instanceof Map ? vocab : aliasMap(vocab)
  return map.get(tag) ?? tag
}
