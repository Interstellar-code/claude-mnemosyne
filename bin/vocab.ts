// Claude Mnemosyne — the shared tag vocabulary's one writer (v3 plan, C5).
//   bun bin/vocab.ts --store <dir> init [--force]        seed <root>/vocabulary.json from the store
//   bun bin/vocab.ts [--root <dir> | --store <dir>] admit <tag> [--description <text>]
//   bun bin/vocab.ts [--root <dir> | --store <dir>] alias <from> <to>
//   bun bin/vocab.ts [--root <dir> | --store <dir>] list
//
// <root> is the data folder (the one that holds store/, backups/ and tags-proposed.json): --root names it,
// else it is the parent of --store. The store is only ever read, through a read-only handle. The file is
// mode 0600 and written by rename, so a reader never sees half a file. init refuses to overwrite a file
// that exists unless --force, and --force keeps what a person curated: every alias whose tag survives, and
// every tag admitted by hand. Only tags and counts are read from the store, never a memory's text.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { AGENT_SEEDS, aliasMap, emptyVocabulary, foldTag, normalizeTag, nsOf, parseVocabulary, projectNameOf, VOCAB_FILE, vocabularyText } from '../hooks/vocab'
import type { Vocabulary } from '../hooks/vocab'
import { openReadOnly, tagsSql } from './memories'

const IS_WINDOWS = process.platform === 'win32'

/** The tags of every memory (distinct per memory, as stored) and the owners the store holds. Read-only. */
export function readTagUse(store: string): { tagLists: string[][]; owners: string[] } {
  const db = openReadOnly(store)
  if (db === null) return { tagLists: [], owners: [] }
  try {
    const rows = db.query(`SELECT session_id AS owner, ${tagsSql()} AS tags FROM working_memory`).all() as { owner: string | null; tags: string }[]
    const tagLists = rows.map(row => {
      try {
        const parsed = JSON.parse(row.tags) as unknown
        return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
      } catch {
        return []
      }
    })
    return { tagLists, owners: [...new Set(rows.map(row => row.owner ?? '').filter(Boolean))] }
  } finally {
    db.close()
  }
}

/** The readable project names behind per-project owners (`project-<Name>-<hash>`), normalised, for dropping. */
export function projectNames(owners: readonly string[]): Set<string> {
  const names = new Set<string>()
  for (const owner of owners) {
    const name = projectNameOf(owner)
    if (name !== undefined) names.add(name)
  }
  return names
}

/** How many memories carry each tag once names are folded (a memory counts a tag once). */
export function countTags(tagLists: readonly (readonly string[])[], aliases: Map<string, string>, skip: ReadonlySet<string> = new Set()): Map<string, number> {
  const counts = new Map<string, number>()
  for (const list of tagLists) {
    const seen = new Set<string>()
    for (const raw of list) {
      const tag = foldTag(aliases, raw)
      if (tag === undefined || skip.has(tag)) continue
      seen.add(tag)
    }
    for (const tag of seen) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return counts
}

const fileOf = (root: string) => join(root, VOCAB_FILE)

/** The vocabulary file, parsed; throws when it is missing or wrong. */
export function readVocabulary(root: string): Vocabulary {
  const file = fileOf(root)
  if (!existsSync(file)) throw new Error(`there is no ${VOCAB_FILE} in ${root}: run init first`)
  return parseVocabulary(readFileSync(file, 'utf8'))
}

/** Writes the file 0600 by rename: a new file next to it, then moved over the old one. */
export function writeVocabulary(root: string, vocab: Vocabulary) {
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true, mode: 0o700 })
    if (!IS_WINDOWS) chmodSync(root, 0o700)
  }
  const file = fileOf(root)
  const temp = `${file}.${process.pid}.tmp`
  rmSync(temp, { force: true })
  try {
    writeFileSync(temp, vocabularyText(vocab), { mode: 0o600, flag: 'wx' })
    if (!IS_WINDOWS) chmodSync(temp, 0o600)
    renameSync(temp, file)
  } catch (err) {
    rmSync(temp, { force: true })
    throw err
  }
}

export type InitResult = { file: string; admitted: number; seeded: number; dropped: number; kept: number }

/**
 * Seeds the vocabulary from the store: the agent seeds, then every tag used on two or more memories after
 * folding (project names left out). Refuses to overwrite a file that exists unless `force`; forced, it keeps
 * the aliases whose tag still exists and the tags admitted by hand.
 */
export function initVocabulary(store: string, root: string, force = false): InitResult {
  const file = fileOf(root)
  if (existsSync(file) && !force) throw new Error(`${file} already exists: use --force to rebuild it (aliases and hand-admitted tags are kept)`)
  let previous = emptyVocabulary()
  if (existsSync(file)) {
    try {
      previous = parseVocabulary(readFileSync(file, 'utf8'))
    } catch {
      // an unreadable file has nothing to keep
    }
  }
  const { tagLists, owners } = readTagUse(store)
  const names = projectNames(owners)
  const counts = countTags(tagLists, aliasMap(previous), names)
  const vocab = emptyVocabulary()
  for (const seed of AGENT_SEEDS) vocab.tags[seed.tag] = { ns: 'agent', description: seed.description, aliases: [], admitted: 'seed', count: counts.get(seed.tag) ?? 0 }
  let admitted = 0
  for (const [tag, count] of counts) {
    if (count < 2 || vocab.tags[tag] !== undefined) continue
    vocab.tags[tag] = { ns: nsOf(tag), description: '', aliases: [], admitted: 'init', count }
    admitted++
  }
  let kept = 0
  // Tags a person admitted by hand stay, with what was written about them.
  for (const [tag, entry] of Object.entries(previous.tags)) {
    if (entry.admitted !== 'manual' || names.has(tag)) continue
    vocab.tags[tag] = { ...entry, count: counts.get(tag) ?? 0 }
    kept++
  }
  // Curated spellings and descriptions survive a rebuild, unless a spelling became a tag of its own.
  for (const [tag, entry] of Object.entries(previous.tags)) {
    const rebuilt = vocab.tags[tag]
    if (rebuilt === undefined) continue
    rebuilt.aliases = entry.aliases.filter(alias => vocab.tags[alias] === undefined)
    if (entry.description !== '') rebuilt.description = entry.description
    kept += rebuilt.aliases.length
  }
  writeVocabulary(root, vocab)
  return { file, admitted, seeded: AGENT_SEEDS.length, dropped: names.size, kept }
}

/** Admits a tag (from the candidates, if it is one), optionally with a description. Admitting an admitted tag changes nothing. */
export function admitTag(root: string, raw: string, description = '', store?: string): { tag: string; status: 'admitted' | 'already admitted' } {
  const tag = normalizeTag(raw)
  if (tag === undefined) throw new Error(`"${raw.slice(0, 40)}" is not a usable tag`)
  const vocab = readVocabulary(root)
  if (vocab.tags[tag] !== undefined) return { tag, status: 'already admitted' }
  if (aliasMap(vocab).has(tag)) throw new Error(`${tag} is an alias of ${aliasMap(vocab).get(tag)}: admit that tag instead`)
  const candidate = vocab.candidates[tag]
  const count = store === undefined ? (candidate?.count ?? 0) : (countTags(readTagUse(store).tagLists, aliasMap(vocab)).get(tag) ?? candidate?.count ?? 0)
  vocab.tags[tag] = { ns: nsOf(tag), description: description.trim(), aliases: [], admitted: 'manual', count }
  delete vocab.candidates[tag]
  writeVocabulary(root, vocab)
  return { tag, status: 'admitted' }
}

/** Makes `from` fold into the admitted tag `to`. `to` may itself be an alias (it resolves to its tag); `from` may not be an admitted tag. */
export function aliasTag(root: string, rawFrom: string, rawTo: string): { from: string; to: string; moved?: string } {
  const from = normalizeTag(rawFrom)
  const wanted = normalizeTag(rawTo)
  if (from === undefined) throw new Error(`"${rawFrom.slice(0, 40)}" is not a usable tag`)
  if (wanted === undefined) throw new Error(`"${rawTo.slice(0, 40)}" is not a usable tag`)
  const vocab = readVocabulary(root)
  const map = aliasMap(vocab)
  const to = map.get(wanted) ?? wanted
  if (vocab.tags[to] === undefined) throw new Error(`${to} is not an admitted tag: admit it first`)
  if (from === to) throw new Error('a tag cannot be an alias of itself')
  if (vocab.tags[from] !== undefined) throw new Error(`${from} is an admitted tag, not a spelling: it cannot become an alias`)
  const moved = map.get(from)
  if (moved !== undefined && moved !== to) vocab.tags[moved]!.aliases = vocab.tags[moved]!.aliases.filter(alias => alias !== from)
  if (!vocab.tags[to]!.aliases.includes(from)) vocab.tags[to]!.aliases.push(from)
  delete vocab.candidates[from]
  writeVocabulary(root, vocab)
  return { from, to, ...(moved !== undefined && moved !== to ? { moved } : {}) }
}

/** The vocabulary as the list command prints it: admitted tags then candidates, most used first. */
export function listVocabulary(root: string) {
  const vocab = readVocabulary(root)
  const order = (a: { tag: string; count: number }, b: { tag: string; count: number }) => b.count - a.count || (a.tag < b.tag ? -1 : 1)
  return {
    file: fileOf(root),
    tags: Object.entries(vocab.tags).map(([tag, entry]) => ({ tag, ...entry })).sort(order),
    candidates: Object.entries(vocab.candidates).map(([tag, entry]) => ({ tag, ...entry })).sort(order),
  }
}

const USAGE = 'usage: vocab.ts --store <dir> init [--force] | [--root <dir> | --store <dir>] admit <tag> [--description <text>] | alias <from> <to> | list'

async function main(argv: readonly string[]) {
  const args = [...argv]
  let store = ''
  let rootArg = ''
  // --store and --root come first, once each; a tag or text that starts with `-` is never read as an option.
  while (args[0] === '--store' || args[0] === '--root') {
    const flag = args.shift()!
    const value = args.shift() ?? ''
    if (!value || value.startsWith('-')) throw new Error(`${flag} needs a folder`)
    if (flag === '--store') {
      if (store) throw new Error('--store may be given once')
      store = value
    } else {
      if (rootArg) throw new Error('--root may be given once')
      rootArg = value
    }
  }
  if (args.includes('--store') || args.includes('--root')) throw new Error('--store and --root go before the command')
  const root = rootArg ? resolve(rootArg) : store ? dirname(resolve(store)) : ''
  const [command, ...rest] = args
  const out = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`)
  if (command === 'init') {
    if (!store) throw new Error('init needs --store <dir>')
    const flags = rest.filter(arg => arg !== '--force')
    if (flags.length > 0) throw new Error(USAGE)
    return out(initVocabulary(store, root, rest.includes('--force')))
  }
  if (!root) throw new Error(`${command ?? 'a command'} needs --root <dir> or --store <dir>`)
  if (command === 'admit') {
    const at = rest.indexOf('--description')
    const tag = rest[0]
    if (!tag || tag.startsWith('-')) throw new Error(USAGE)
    let description = ''
    if (at >= 0) {
      if (at !== 1 || rest.length !== 3 || rest[2]!.startsWith('-')) throw new Error(USAGE)
      description = rest[2]!
    } else if (rest.length !== 1) throw new Error(USAGE)
    return out(admitTag(root, tag, description, store || undefined))
  }
  if (command === 'alias') {
    if (rest.length !== 2 || rest.some(arg => arg.startsWith('-'))) throw new Error(USAGE)
    return out(aliasTag(root, rest[0]!, rest[1]!))
  }
  if (command === 'list') {
    if (rest.length > 0) throw new Error(USAGE)
    return out(listVocabulary(root))
  }
  throw new Error(USAGE)
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    () => process.exit(0),
    err => {
      process.stderr.write(`mnemosyne vocab: ${(err as Error).message}\n`)
      process.exit(1)
    },
  )
}
