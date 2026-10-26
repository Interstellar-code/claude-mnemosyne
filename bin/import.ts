// Claude Mnemosyne — the importers' file and store reader (plan phase IMPORT). A hook
// cannot read SQLite and `$.fs.read` refuses files over 4 MiB, so /mnemosyne-import runs this file:
//   bun bin/import.ts doc <path>                  a .md or .txt file under 1 MB, split into chunks, as JSON
//   bun bin/import.ts --store <dir> origins <path> [--owner <owner>]  the live rows an earlier import made from <path> (only <owner>'s when given), as JSON
//   bun bin/import.ts save <root>/import-proposed.json  the proposal on stdin, saved 0600
//   bun bin/import.ts session --projects <dir> --cwd <dir> [--current <id>] <id | last>  one session's conversation text, as JSON
//   bun bin/import.ts hash                        {"texts":[...]} on stdin: the sha256 of each text, as JSON
//   bun bin/import.ts --store <dir> exact <owner>  {"texts":[...]} on stdin: whether <owner> already holds each text exactly, as JSON
//
// Nothing here changes the store. `doc` prints the chunks' text on stdout for the hook to
// check and save; every error message names a cause, never a piece of the file (C8). save
// keeps only the path, headings (redacted and cut), sha256 values, rule ids, verdicts and
// row ids of a proposal, so no memory text can reach the proposals file.
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { redact } from '../hooks/activity-log'
import { DOC_MAX_BYTES, IMPORT_MAX_CHUNKS, IMPORT_PROPOSALS_FILE, isImportableDoc, SESSION_ID, SESSION_TEXT_LIMIT, splitDocument } from '../hooks/import'
import type { DocRead, ExistingChunk, SessionRead } from '../hooks/import'
import { openReadOnly } from './memories'

const IS_WINDOWS = process.platform === 'win32'
const HEADING_LIMIT = 120

export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

/** Reads and splits one document; throws a plain reason when it cannot be imported. */
export function readDocument(path: string): DocRead {
  if (!isImportableDoc(path)) throw new Error('only .md and .txt files are imported')
  let info
  try {
    info = lstatSync(path)
  } catch {
    throw new Error('there is no such file')
  }
  if (info.isSymbolicLink()) throw new Error('a link is not imported: name the file itself')
  if (!info.isFile()) throw new Error('that is not a file')
  if (info.size >= DOC_MAX_BYTES) throw new Error(`the file is ${info.size} bytes; a document must be under ${DOC_MAX_BYTES} bytes (1 MB)`)
  const bytes = readFileSync(path)
  if (bytes.includes(0)) throw new Error('the file holds binary data, not text')
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('the file is not valid UTF-8 text')
  }
  const { chunks, skippedEmpty } = splitDocument(text)
  const tooMany = chunks.length > IMPORT_MAX_CHUNKS
  return {
    path,
    bytes: bytes.length,
    fileSha256: createHash('sha256').update(bytes).digest('hex'),
    total: chunks.length,
    skippedEmpty,
    tooMany,
    chunks: tooMany ? [] : chunks.map(chunk => ({ ...chunk, sha256: sha256(chunk.text) })),
  }
}

/**
 * The live rows an earlier doc import made from `path`: not retired, not expired. With an `owner` (per-project scope) only
 * that owner's rows, so an import never sees, and never retires, another project's copy; without one (global scope, where
 * the owner is shared anyway) every owner's.
 */
export function originRows(store: string, path: string, owner?: string, now: Date = new Date()): ExistingChunk[] {
  const db = openReadOnly(store)
  if (db === null) return []
  try {
    const rows = db
      .query(
        `SELECT id, session_id AS owner, metadata_json FROM working_memory
         WHERE source = 'import:doc' AND json_valid(metadata_json) AND json_extract(metadata_json, '$.origin.path') = ?
           AND superseded_by IS NULL AND (valid_until IS NULL OR valid_until > ?)${owner === undefined ? '' : ' AND session_id = ?'}
         ORDER BY timestamp, id`,
      )
      .all(...([path, now.toISOString(), ...(owner === undefined ? [] : [owner])] as string[])) as { id: string; owner: string | null; metadata_json: string }[]
    const out: ExistingChunk[] = []
    for (const row of rows) {
      const origin = (JSON.parse(row.metadata_json) as { origin?: { heading?: unknown; sha256?: unknown } }).origin
      if (typeof origin?.heading === 'string' && typeof origin.sha256 === 'string') out.push({ id: row.id, owner: row.owner ?? '', heading: origin.heading, sha256: origin.sha256 })
    }
    return out
  } finally {
    db.close()
  }
}

/** Per text: whether `owner` already has a row (live or retired) with exactly that text; the engine would answer a save of it with that row's id. */
export function holdsText(store: string, owner: string, texts: readonly string[]): boolean[] {
  const db = openReadOnly(store)
  if (db === null) return texts.map(() => false)
  try {
    const query = db.query('SELECT 1 FROM working_memory WHERE content = ? AND session_id = ? LIMIT 1')
    return texts.map(text => query.get(text, owner) !== null)
  } finally {
    db.close()
  }
}

const HEX64 = /^[0-9a-f]{64}$/
const HEX_ID = /^[0-9a-f]{1,64}$/
const VERDICTS = new Set(['allow', 'warn', 'block', 'unchanged'])
const RULE_ID = /^G\d{1,2}$/

const heading = (value: unknown) => Array.from(redact(String(value ?? '')).replace(/\s+/g, ' ').trim()).slice(0, HEADING_LIMIT).join('')

/** The proposals file's text, from stdin's JSON: paths, headings (redacted), hashes, rule ids, verdicts and row ids only. */
export function proposalText(input: string): string {
  const value = JSON.parse(input) as Record<string, unknown>
  const isDoc = value?.kind === 'doc' && typeof value.path === 'string' && typeof value.fileSha256 === 'string' && HEX64.test(value.fileSha256)
  const isSession = value?.kind === 'session' && typeof value.sessionId === 'string' && SESSION_ID.test(value.sessionId)
  if ((!isDoc && !isSession) || !Array.isArray(value.chunks)) {
    throw new Error('stdin must be {"kind":"doc","path":...,"fileSha256":...,"chunks":[...]} or {"kind":"session","sessionId":...,"chunks":[...]}')
  }
  const chunks = (value.chunks as Record<string, unknown>[]).map((item, i) => {
    if (typeof item?.sha256 !== 'string' || !HEX64.test(item.sha256) || typeof item.verdict !== 'string' || !VERDICTS.has(item.verdict)) throw new Error(`chunk ${i} needs sha256 and verdict`)
    const rules = Array.isArray(item.rules) ? item.rules.filter((rule): rule is string => typeof rule === 'string' && RULE_ID.test(rule)) : []
    const replaces = typeof item.replaces === 'string' && HEX_ID.test(item.replaces) ? item.replaces : undefined
    return { heading: heading(item.heading), sha256: item.sha256, verdict: item.verdict, rules, ...(replaces === undefined ? {} : { replaces }) }
  })
  const subject = isDoc ? { path: value.path, fileSha256: value.fileSha256 } : { sessionId: value.sessionId }
  return `${JSON.stringify({ version: 1, kind: value.kind, created: new Date().toISOString(), ...subject, chunks }, null, 2)}\n`
}

/** Saves `text` at `file` (named import-proposed.json): a new 0600 file renamed over the old one. */
export function saveProposal(file: string, text: string) {
  if (basename(file) !== IMPORT_PROPOSALS_FILE) throw new Error(`only a file named ${IMPORT_PROPOSALS_FILE} is written`)
  const folder = dirname(file)
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true, mode: 0o700 })
    if (!IS_WINDOWS) chmodSync(folder, 0o700)
  }
  const temp = `${file}.${process.pid}.tmp`
  rmSync(temp, { force: true })
  writeFileSync(temp, text, { mode: 0o600, flag: 'wx' })
  if (!IS_WINDOWS) chmodSync(temp, 0o600)
  renameSync(temp, file)
}

// ---- Session transcripts (IMPORT.2; the IMPORT.0 spike) ----

/** Claude Code's folder name for a project: the working folder with every character outside A-Z, a-z, 0-9 turned into '-'. */
export const slugOf = (cwd: string) => cwd.replace(/[^A-Za-z0-9]/g, '-')

export type SessionTarget = { projects: string; cwd: string; current?: string; target: string }

/** The transcript of a session id, or of the newest earlier session of this project (`last`, never the running one). */
export function findTranscript({ projects, cwd, current, target }: SessionTarget): { id: string; path: string } {
  const folder = join(projects, slugOf(cwd))
  if (target === 'last') {
    const found = existsSync(folder)
      ? readdirSync(folder)
          .filter(name => name.endsWith('.jsonl') && name !== `${current}.jsonl` && SESSION_ID.test(name.slice(0, -'.jsonl'.length)))
          .map(name => ({ name, mtime: statSync(join(folder, name)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime || (a.name < b.name ? 1 : -1))[0]
      : undefined
    if (found === undefined) throw new Error('there is no earlier session transcript for this project')
    return { id: found.name.slice(0, -'.jsonl'.length), path: join(folder, found.name) }
  }
  if (!SESSION_ID.test(target)) throw new Error('a session id has only letters, digits, hyphens and underscores')
  // Only this project's folder: another project's conversation is never read, nor sent to the model.
  const direct = join(folder, `${target}.jsonl`)
  if (existsSync(direct)) return { id: target, path: direct }
  throw new Error(`there is no transcript for that session id in this project's folder (${slugOf(cwd)}); a session of another project is not imported from here`)
}

// A line longer than this is skipped unread (a huge attachment or a tool result, never the conversation).
const MAX_LINE_CHARS = 8_000_000
// One turn's text is cut to this many characters before the total is cut.
const TURN_LIMIT = 2000

/** The lines of a file, streamed: the file is never held whole. A line over MAX_LINE_CHARS is skipped. */
async function* linesOf(path: string): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  let skipping = false
  for await (const chunk of Bun.file(path).stream()) {
    let text = decoder.decode(chunk, { stream: true })
    if (skipping) {
      const nl = text.indexOf('\n')
      if (nl === -1) continue
      text = text.slice(nl + 1)
      skipping = false
    }
    buffer += text
    let start = 0
    for (let nl = buffer.indexOf('\n', start); nl !== -1; nl = buffer.indexOf('\n', start)) {
      yield buffer.slice(start, nl)
      start = nl + 1
    }
    buffer = buffer.slice(start)
    if (buffer.length > MAX_LINE_CHARS) {
      buffer = ''
      skipping = true
    }
  }
  buffer += decoder.decode()
  if (buffer !== '' && buffer.length <= MAX_LINE_CHARS) yield buffer
}

// Text the host put in a user turn that the person did not write: reminders, command echoes, interrupts.
const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g
const NOT_SPOKEN = /^(?:<command-|<local-command-|<task-notification|Caveat:|\[Request interrupted)/

function turnText(line: { type?: unknown; message?: { content?: unknown } }): string {
  const content = line.message?.content
  const blocks = typeof content === 'string' ? [content] : Array.isArray(content) ? content.filter((b): b is { type: string; text: string } => b?.type === 'text' && typeof b.text === 'string').map(b => b.text) : []
  const joined = blocks.join('\n')
  const cleaned = line.type === 'user' ? joined.replace(REMINDER, '').trim() : joined.trim()
  return line.type === 'user' && NOT_SPOKEN.test(cleaned) ? '' : cleaned
}

/**
 * The conversation of one transcript as plain text: user and assistant text blocks only (no tool calls or results, no
 * thinking, no sub-agent or meta turns), each turn cut and run through redact() so key and token shapes never leave
 * the machine, and the whole cut to SESSION_TEXT_LIMIT characters keeping the newest turns.
 */
export async function readSession(path: string, id: string, limit: number = SESSION_TEXT_LIMIT): Promise<SessionRead> {
  const turns: string[] = []
  for await (const line of linesOf(path)) {
    if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) continue
    let parsed: { type?: unknown; isSidechain?: unknown; isMeta?: unknown; message?: { content?: unknown } }
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }
    if ((parsed.type !== 'user' && parsed.type !== 'assistant') || parsed.isSidechain === true || parsed.isMeta === true) continue
    const text = turnText(parsed)
    if (text === '') continue
    const cut = Array.from(redact(text)).slice(0, TURN_LIMIT).join('')
    turns.push(`${parsed.type === 'user' ? 'User' : 'Assistant'}: ${cut}`)
  }
  const kept: string[] = []
  let size = 0
  for (let i = turns.length - 1; i >= 0; i--) {
    const add = turns[i]!.length + (kept.length > 0 ? 2 : 0)
    if (size + add > limit) break
    kept.unshift(turns[i]!)
    size += add
  }
  return { sessionId: id, turns: kept.length, totalTurns: turns.length, truncated: kept.length < turns.length, text: kept.join('\n\n') }
}

async function main(argv: readonly string[]) {
  const args = [...argv]
  let store = ''
  if (args[0] === '--store') {
    store = args[1] ?? ''
    if (!store || store.startsWith('-')) throw new Error('--store needs a folder')
    args.splice(0, 2)
  }
  if (args.includes('--store')) throw new Error('--store may be given once, before the command')
  const [command, ...rest] = args
  if (command === 'doc') {
    if (store || rest.length !== 1 || !rest[0] || rest[0].startsWith('-')) throw new Error('usage: doc <path>')
    process.stdout.write(`${JSON.stringify(readDocument(rest[0]))}\n`)
  } else if (command === 'origins') {
    const owner = rest[1] === '--owner' ? rest[2] : undefined
    if (!store || !rest[0] || rest[0].startsWith('-') || (rest.length !== 1 && (rest.length !== 3 || !owner || owner.startsWith('-')))) throw new Error('usage: --store <dir> origins <path> [--owner <owner>]')
    process.stdout.write(`${JSON.stringify(originRows(store, rest[0], owner))}\n`)
  } else if (command === 'save') {
    if (store || rest.length !== 1 || !rest[0] || rest[0].startsWith('-')) throw new Error('usage: save <file>  (the proposal JSON on stdin)')
    saveProposal(rest[0], proposalText(await Bun.stdin.text()))
  } else if (command === 'session') {
    if (store) throw new Error('session does not take --store')
    const options: Record<string, string> = {}
    const positional: string[] = []
    for (let i = 0; i < rest.length; i++) {
      const word = rest[i]!
      if (word === '--projects' || word === '--cwd' || word === '--current') {
        const value = rest[++i]
        if (value === undefined || value.startsWith('-')) throw new Error(`${word} needs a value`)
        options[word.slice(2)] = value
      } else if (word.startsWith('-')) throw new Error(`unknown option ${word}`)
      else positional.push(word)
    }
    if (positional.length !== 1 || options.projects === undefined || options.cwd === undefined) throw new Error('usage: session --projects <dir> --cwd <dir> [--current <id>] <id | last>')
    const found = findTranscript({ projects: options.projects, cwd: options.cwd, ...(options.current === undefined ? {} : { current: options.current }), target: positional[0]! })
    process.stdout.write(`${JSON.stringify(await readSession(found.path, found.id))}\n`)
  } else if (command === 'exact') {
    if (!store || rest.length !== 1 || !rest[0] || rest[0].startsWith('-')) throw new Error('usage: --store <dir> exact <owner>  ({"texts":[...]} on stdin)')
    const value = JSON.parse(await Bun.stdin.text()) as { texts?: unknown }
    if (!Array.isArray(value?.texts) || value.texts.some(text => typeof text !== 'string')) throw new Error('stdin must be {"texts":[...]}')
    process.stdout.write(`${JSON.stringify({ present: holdsText(store, rest[0], value.texts as string[]) })}\n`)
  } else if (command === 'hash') {
    if (store || rest.length !== 0) throw new Error('usage: hash  ({"texts":[...]} on stdin)')
    const value = JSON.parse(await Bun.stdin.text()) as { texts?: unknown }
    if (!Array.isArray(value?.texts) || value.texts.some(text => typeof text !== 'string')) throw new Error('stdin must be {"texts":[...]}')
    process.stdout.write(`${JSON.stringify({ sha256: (value.texts as string[]).map(sha256) })}\n`)
  } else {
    throw new Error('usage: import.ts doc <path> | --store <dir> origins <path> [--owner <owner>] | save <file> | session ... | hash | --store <dir> exact <owner>')
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    () => process.exit(0),
    err => {
      process.stderr.write(`mnemosyne import: ${(err as Error).message}\n`)
      process.exit(1)
    },
  )
}
