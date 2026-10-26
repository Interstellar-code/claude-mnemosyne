// Claude Mnemosyne — the importers' file and store reader (plan phase IMPORT). A hook
// cannot read SQLite and `$.fs.read` refuses files over 4 MiB, so /mnemosyne-import runs this file:
//   bun bin/import.ts doc <path>                  a .md or .txt file under 1 MB, split into chunks, as JSON
//   bun bin/import.ts --store <dir> origins <path>  the live rows an earlier import made from <path>, as JSON
//   bun bin/import.ts save <root>/import-proposed.json  the proposal on stdin, saved 0600
//
// Nothing here changes the store. `doc` prints the chunks' text on stdout for the hook to
// check and save; every error message names a cause, never a piece of the file (C8). save
// keeps only the path, headings (redacted and cut), sha256 values, rule ids, verdicts and
// row ids of a proposal, so no memory text can reach the proposals file.
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { redact } from '../hooks/activity-log'
import { DOC_MAX_BYTES, IMPORT_MAX_CHUNKS, IMPORT_PROPOSALS_FILE, isImportableDoc, splitDocument } from '../hooks/import'
import type { DocRead, ExistingChunk } from '../hooks/import'
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

/** The live rows an earlier doc import made from `path`: not retired, not expired. */
export function originRows(store: string, path: string, now: Date = new Date()): ExistingChunk[] {
  const db = openReadOnly(store)
  if (db === null) return []
  try {
    const rows = db
      .query(
        `SELECT id, session_id AS owner, metadata_json FROM working_memory
         WHERE source = 'import:doc' AND json_valid(metadata_json) AND json_extract(metadata_json, '$.origin.path') = ?
           AND superseded_by IS NULL AND (valid_until IS NULL OR valid_until > ?)
         ORDER BY timestamp, id`,
      )
      .all(path, now.toISOString()) as { id: string; owner: string | null; metadata_json: string }[]
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

const HEX64 = /^[0-9a-f]{64}$/
const HEX_ID = /^[0-9a-f]{1,64}$/
const VERDICTS = new Set(['allow', 'warn', 'block', 'unchanged'])
const RULE_ID = /^G\d{1,2}$/

const heading = (value: unknown) => Array.from(redact(String(value ?? '')).replace(/\s+/g, ' ').trim()).slice(0, HEADING_LIMIT).join('')

/** The proposals file's text, from stdin's JSON: paths, headings (redacted), hashes, rule ids, verdicts and row ids only. */
export function proposalText(input: string): string {
  const value = JSON.parse(input) as Record<string, unknown>
  if (value?.kind !== 'doc' || typeof value.path !== 'string' || typeof value.fileSha256 !== 'string' || !HEX64.test(value.fileSha256) || !Array.isArray(value.chunks)) {
    throw new Error('stdin must be {"kind":"doc","path":...,"fileSha256":...,"chunks":[...]}')
  }
  const chunks = (value.chunks as Record<string, unknown>[]).map((item, i) => {
    if (typeof item?.sha256 !== 'string' || !HEX64.test(item.sha256) || typeof item.verdict !== 'string' || !VERDICTS.has(item.verdict)) throw new Error(`chunk ${i} needs sha256 and verdict`)
    const rules = Array.isArray(item.rules) ? item.rules.filter((rule): rule is string => typeof rule === 'string' && RULE_ID.test(rule)) : []
    const replaces = typeof item.replaces === 'string' && HEX_ID.test(item.replaces) ? item.replaces : undefined
    return { heading: heading(item.heading), sha256: item.sha256, verdict: item.verdict, rules, ...(replaces === undefined ? {} : { replaces }) }
  })
  return `${JSON.stringify({ version: 1, kind: 'doc', created: new Date().toISOString(), path: value.path, fileSha256: value.fileSha256, chunks }, null, 2)}\n`
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
    if (!store || rest.length !== 1 || !rest[0] || rest[0].startsWith('-')) throw new Error('usage: --store <dir> origins <path>')
    process.stdout.write(`${JSON.stringify(originRows(store, rest[0]))}\n`)
  } else if (command === 'save') {
    if (store || rest.length !== 1 || !rest[0] || rest[0].startsWith('-')) throw new Error('usage: save <file>  (the proposal JSON on stdin)')
    saveProposal(rest[0], proposalText(await Bun.stdin.text()))
  } else {
    throw new Error('usage: import.ts doc <path> | --store <dir> origins <path> | save <file>')
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
