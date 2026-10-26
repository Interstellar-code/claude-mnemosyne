// IMPORT.1: /mnemosyne-import doc and apply, run for real. The hooks are the real hooks/register.ts;
// bin/import.ts, bin/memories.ts, bin/activity.ts and the engine are the real ones over a temp HOME
// (see knowledge-host.ts). No model is called, and nothing here touches the real ~/.claude.
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { body, engineCall, toolCall } from './helpers'
import { makeHost } from './knowledge-host'
import type { Host } from './knowledge-host'

setDefaultTimeout(60_000)
const hosts: Host[] = []
// /mnemosyne-setup opens the store once (mnemopi_stats), which is what creates mnemopi.db; the backup needs that file.
const open = async (...args: Parameters<typeof makeHost>) => {
  const host = await makeHost(...args)
  hosts.push(host)
  await engineCall(cliOf(host), host.store, 'global', [toolCall(1, 'mnemopi_stats', {})])
  return host
}
afterEach(() => {
  for (const host of hosts.splice(0)) {
    try {
      chmodSync(join(host.root, 'backups'), 0o700)
    } catch {
      // no such folder
    }
    host.dispose()
  }
})

// Joined from pieces so no secret-shaped literal sits in the source.
const SECRET = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'
const cliOf = (host: Host) => join(host.root, 'engine', 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'src', 'cli.ts')
const sentence = (n: number) => `Section ${n} says the build output goes to the dist folder and the cache is cleared first.`

/** A document of `count` sections, each a heading and one sentence. */
const doc = (count: number, edit: Record<number, string> = {}) =>
  `# Guide\n\n${Array.from({ length: count }, (_, i) => `## Part ${i + 1}\n\n${edit[i + 1] ?? sentence(i + 1)}\n`).join('\n')}`

function writeDoc(host: Host, name: string, text: string) {
  const dir = join(host.home, 'docs')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, text)
  return path
}

type Row = { id: string; content: string; source: string | null; trust_tier: string; veracity: string; memory_type: string; scope: string; valid_until: string | null; superseded_by: string | null; metadata_json: string | null; session_id: string }
function rows(host: Host): Row[] {
  const db = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
  db.exec('PRAGMA busy_timeout = 10000')
  try {
    return db.query('SELECT id, content, source, trust_tier, veracity, memory_type, scope, valid_until, superseded_by, metadata_json, session_id FROM working_memory ORDER BY timestamp, id').all() as Row[]
  } catch {
    return []
  } finally {
    db.close()
  }
}
const live = (host: Host) => rows(host).filter(row => row.valid_until === null && row.superseded_by === null)
const meta = (row: Row) => JSON.parse(row.metadata_json ?? '{}') as { origin?: { path: string; sha256: string; heading: string }; guard?: string[] }
const backups = (host: Host) => (existsSync(join(host.root, 'backups')) ? readdirSync(join(host.root, 'backups')).filter(name => name.endsWith('.db')) : [])
const proposalPath = (host: Host) => join(host.root, 'import-proposed.json')
const setConfig = (host: Host, config: object) => {
  mkdirSync(host.root, { recursive: true })
  writeFileSync(join(host.root, 'config.json'), JSON.stringify({ version: 1, ...config }))
}

describe('IMPORT.1: the dry run', () => {
  test('shows the counts and writes the proposal, but no memory and no backup', async () => {
    const host = await open()
    const path = writeDoc(host, 'guide.md', doc(4))
    const reply = (await host.command('mnemosyne-import', `doc ${path}`)).text
    expect(reply).toContain('Dry run for guide.md: 4 chunks')
    expect(reply).toContain('No memory was changed')
    expect(reply).toContain('Would save 4 clean')
    expect(rows(host)).toHaveLength(0)
    expect(backups(host)).toHaveLength(0)
    expect(host.engineRuns().some(run => String(run.stdin).includes('mnemopi_remember'))).toBe(false)
    // the proposal: 0600, paths, headings, hashes and verdicts, never a chunk's text
    expect(host.mode(proposalPath(host))).toBe('600')
    const text = readFileSync(proposalPath(host), 'utf8')
    const proposal = JSON.parse(text) as { kind: string; path: string; chunks: { heading: string; sha256: string; verdict: string }[] }
    expect(proposal.kind).toBe('doc')
    expect(proposal.path).toBe(path)
    expect(proposal.chunks.map(chunk => chunk.heading)).toEqual(['Guide > Part 1', 'Guide > Part 2', 'Guide > Part 3', 'Guide > Part 4'])
    expect(proposal.chunks.every(chunk => chunk.verdict === 'allow' && /^[0-9a-f]{64}$/.test(chunk.sha256))).toBe(true)
    expect(text).not.toContain('build output')
  })

  test('a relative path is read under the session folder and ~ is the home folder', async () => {
    const host = await open()
    writeDoc(host, 'home.md', doc(1))
    const reply = (await host.command('mnemosyne-import', 'doc ~/docs/home.md')).text
    expect(reply).toContain('Dry run for home.md: 1 chunk ')
    const relative = (await host.command('mnemosyne-import', 'doc ../nothing/here.md')).text
    expect(relative).toContain('Mnemosyne import failed: there is no such file')
  })

  test('refuses what is not importable, and names the cause', async () => {
    const host = await open()
    const script = writeDoc(host, 'notes.ts', doc(1))
    expect((await host.command('mnemosyne-import', `doc ${script}`)).text).toContain('only .md and .txt files are imported')
    const big = writeDoc(host, 'big.md', `# Big\n\n${'word '.repeat(220_000)}`)
    expect((await host.command('mnemosyne-import', `doc ${big}`)).text).toContain('must be under 1048576 bytes')
    const binary = join(host.home, 'docs', 'bin.md')
    writeFileSync(binary, Buffer.from([0x23, 0x20, 0x68, 0x00, 0x69]))
    expect((await host.command('mnemosyne-import', `doc ${binary}`)).text).toContain('binary data')
    const link = join(host.home, 'docs', 'link.md')
    symlinkSync(writeDoc(host, 'real.md', doc(1)), link)
    expect((await host.command('mnemosyne-import', `doc ${link}`)).text).toContain('a link is not imported')
    const bad = join(host.home, 'docs', 'latin.txt')
    writeFileSync(bad, Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x20, 0x61, 0x6e, 0x64]))
    expect((await host.command('mnemosyne-import', `doc ${bad}`)).text).toContain('not valid UTF-8')
    expect(existsSync(proposalPath(host))).toBe(false)
    expect(rows(host)).toHaveLength(0)
  })

  test('a big document cannot flood the store: over the chunk limit it is refused with its count', async () => {
    const host = await open()
    const path = writeDoc(host, 'huge.md', doc(201))
    const reply = (await host.command('mnemosyne-import', `doc ${path}`)).text
    expect(reply).toContain('splits into 201 chunks, over the limit of 200')
    expect(reply).toContain('Nothing was imported')
    expect(existsSync(proposalPath(host))).toBe(false)
    // and an apply has nothing to apply
    expect((await host.command('mnemosyne-import', 'apply')).text).toContain('There is no dry run to apply')
    expect(rows(host)).toHaveLength(0)
  })

  test('the settings decide: a lower maximum length blocks a chunk, as for every other save path', async () => {
    const host = await open()
    setConfig(host, { guard: { warnLength: 250, maxLength: 300 } })
    const long = `${'The cache lives in the build folder and is cleared first. '.repeat(8)}`
    const path = writeDoc(host, 'sized.md', `# Sized\n\n## Short\n\n${sentence(1)}\n\n## Long\n\n${long}\n`)
    const reply = (await host.command('mnemosyne-import', `doc ${path}`)).text
    expect(reply).toContain('1 blocked')
    expect(reply).toContain('G2')
    const proposal = JSON.parse(readFileSync(proposalPath(host), 'utf8')) as { chunks: { verdict: string; rules: string[] }[] }
    expect(proposal.chunks.map(chunk => chunk.verdict)).toEqual(['allow', 'block'])
  })
})

describe('IMPORT.1: apply', () => {
  test('backs the store up, then saves every chunk with honest provenance, a kind and its origin', async () => {
    const host = await open()
    const path = writeDoc(host, 'guide.md', doc(3))
    await host.command('mnemosyne-import', `doc ${path}`)
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain('Imported 3 chunks of guide.md')
    expect(backups(host)).toHaveLength(1)
    const saved = live(host)
    expect(saved).toHaveLength(3)
    for (const row of saved) {
      expect(row.source).toBe('import:doc')
      expect(row.trust_tier).toBe('IMPORTED')
      expect(row.veracity).toBe('imported')
      expect(row.memory_type).toBe('artifact')
      expect(row.scope).toBe('global')
      expect(row.valid_until).toBeNull()
      expect(meta(row).origin?.path).toBe(path)
      expect(meta(row).origin?.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(meta(row).guard).toBeUndefined()
    }
    expect(saved.map(row => meta(row).origin?.heading)).toEqual(['Guide > Part 1', 'Guide > Part 2', 'Guide > Part 3'])
    expect(saved[0]!.content).toBe(`Guide > Part 1\n\n${sentence(1)}`)
    // the backup was taken before the first save
    const order = host.runs.filter(run => String(run.argv[1] ?? '').endsWith('/bin/memories.ts') && run.argv.includes('backup') || (run.argv[2] === 'mcp' && String(run.stdin).includes('mnemopi_remember')))
    expect(order[0]!.argv.includes('backup')).toBe(true)
  })

  test('stops, and changes nothing, when the backup fails', async () => {
    const host = await open()
    const path = writeDoc(host, 'guide.md', doc(2))
    await host.command('mnemosyne-import', `doc ${path}`)
    // a first apply makes the store; the second run is the one whose backup fails
    mkdirSync(join(host.root, 'backups'), { recursive: true })
    await host.command('mnemosyne-import', 'apply')
    const before = rows(host).length
    writeFileSync(path, doc(3))
    await host.command('mnemosyne-import', `doc ${path}`)
    chmodSync(join(host.root, 'backups'), 0o500)
    const engineBefore = host.engineRuns().length
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain('Stopped: the backup before the change failed')
    expect(reply).toContain('No memory was changed')
    expect(rows(host)).toHaveLength(before)
    expect(host.engineRuns()).toHaveLength(engineBefore)
  })

  test('importing an unchanged file again adds nothing', async () => {
    const host = await open()
    const path = writeDoc(host, 'guide.md', doc(3))
    await host.command('mnemosyne-import', `doc ${path}`)
    await host.command('mnemosyne-import', 'apply')
    const before = rows(host)
    const again = (await host.command('mnemosyne-import', `doc ${path}`)).text
    expect(again).toContain('3 already in the store')
    expect(again).toContain('Nothing to import')
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain('Imported 0 chunks')
    expect(rows(host)).toEqual(before)
  })

  test('a changed chunk replaces its old row: the old one is retired, not deleted, and can be restored', async () => {
    const host = await open()
    const path = writeDoc(host, 'guide.md', doc(3))
    await host.command('mnemosyne-import', `doc ${path}`)
    await host.command('mnemosyne-import', 'apply')
    const first = rows(host)
    const oldPart2 = first.find(row => meta(row).origin?.heading === 'Guide > Part 2')!
    writeFileSync(path, doc(3, { 2: 'Section 2 now says the output goes to the build folder and nothing is cleared.' }))
    const dry = (await host.command('mnemosyne-import', `doc ${path}`)).text
    expect(dry).toContain('1 of the chunks replace a row from an earlier import')
    expect(dry).toContain('2 already in the store')
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain('Imported 1 chunk of guide.md')
    expect(reply).toContain('Replaced 1 of 1 earlier chunk')
    const after = rows(host)
    expect(after).toHaveLength(4)
    const retired = after.find(row => row.id === oldPart2.id)!
    expect(retired.content).toBe(oldPart2.content)
    expect(retired.valid_until).not.toBeNull()
    const fresh = after.find(row => row.id === retired.superseded_by)!
    expect(fresh.content).toContain('nothing is cleared')
    expect(live(host)).toHaveLength(3)
    // restore brings it back
    const restored = body((await engineCall(cliOf(host), host.store, retired.session_id, [toolCall(1, 'mnemopi_update', { memory_id: oldPart2.id, restore: true })])).get(1))
    expect(restored).toBeTruthy()
    expect(rows(host).find(row => row.id === oldPart2.id)!.valid_until).toBeNull()
    // and the import is logged with ids, no text
    const lines = host.activity().filter(line => line.action === 'import' || line.action === 'retire')
    expect(lines.map(line => `${line.action}:${line.origin}`)).toEqual(['import:import', 'import:import', 'retire:import'])
  })

  test('a blocked chunk is never saved and its text is never logged', async () => {
    const host = await open()
    const path = writeDoc(host, 'keys.md', `# Keys\n\n## Deploy\n\nThe deploy job pushes the release with the token ${SECRET} to the registry.\n\n## Build\n\n${sentence(2)}\n`)
    const dry = (await host.command('mnemosyne-import', `doc ${path}`)).text
    expect(dry).toContain('1 blocked (never saved)')
    expect(dry).toContain('G1')
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain('Imported 1 chunk of keys.md')
    expect(reply).toContain('1 blocked')
    const stored = rows(host)
    expect(stored).toHaveLength(1)
    expect(stored[0]!.content).not.toContain(SECRET)
    // nowhere it could have been written: the replies, the proposal, the activity log, a process's stdin, the database
    const where = [dry, reply, readFileSync(proposalPath(host), 'utf8'), readFileSync(join(host.root, 'activity.jsonl'), 'utf8'), host.runs.map(run => run.stdin ?? '').join('\n'), readFileSync(join(host.store, 'mnemopi.db')).toString('latin1')]
    for (const text of where) expect(text).not.toContain(SECRET)
    expect(where[2]).not.toContain('deploy job')
  })

  test('a warning needs confirm in strict mode and is flagged when saved', async () => {
    const host = await open()
    const warned = 'Released on 2026-10-01, done and merged, and the build output goes to the dist folder.'
    const path = writeDoc(host, 'log.md', `# Log\n\n## Clean\n\n${sentence(1)}\n\n## Dated\n\n${warned}\n`)
    const dry = (await host.command('mnemosyne-import', `doc ${path}`)).text
    expect(dry).toContain('1 with a warning (guard mode strict')
    const plain = (await host.command('mnemosyne-import', 'apply')).text
    expect(plain).toContain('Imported 1 chunk of log.md')
    expect(plain).toContain('1 with a warning')
    expect(live(host)).toHaveLength(1)
    const confirmed = (await host.command('mnemosyne-import', 'apply confirm')).text
    expect(confirmed).toContain('Imported 1 chunk of log.md')
    const dated = live(host).find(row => row.content.includes('Released on'))!
    expect(meta(dated).guard).toEqual(['G4'])
    expect(dated.source).toBe('import:doc')
  })

  test('in warn mode a warned chunk is saved and flagged without confirm', async () => {
    const host = await open({ options: { guardMode: 'warn' } })
    const path = writeDoc(host, 'log.md', `# Log\n\n## Dated\n\nReleased on 2026-10-01, done and merged, and the build output goes to the dist folder.\n`)
    await host.command('mnemosyne-import', `doc ${path}`)
    expect((await host.command('mnemosyne-import', 'apply')).text).toContain('Imported 1 chunk')
    expect(meta(live(host)[0]!).guard).toEqual(['G4'])
  })

  test('a chunk edited between the dry run and the apply is not saved', async () => {
    const host = await open()
    const path = writeDoc(host, 'guide.md', doc(2))
    await host.command('mnemosyne-import', `doc ${path}`)
    writeFileSync(path, doc(2, { 2: 'Section 2 was rewritten after the dry run, so it was never checked.' }))
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain('Imported 1 chunk of guide.md')
    expect(reply).toContain('1 edited since the dry run')
    expect(live(host).map(row => meta(row).origin?.heading)).toEqual(['Guide > Part 1'])
  })

  test('an apply without a dry run, and a bad subcommand, do nothing', async () => {
    const host = await open()
    expect((await host.command('mnemosyne-import', 'apply')).text).toContain('There is no dry run to apply')
    expect((await host.command('mnemosyne-import', 'tags')).text).toContain('Usage: /mnemosyne-import')
    expect((await host.command('mnemosyne-import', '')).text).toContain('Usage: /mnemosyne-import')
    expect(rows(host)).toHaveLength(0)
    expect(backups(host)).toHaveLength(0)
  })
})

describe('IMPORT: no test touches the real home', () => {
  test('the temp host keeps every file under its own HOME', async () => {
    const host = await open()
    const path = writeDoc(host, 'guide.md', doc(1))
    await host.command('mnemosyne-import', `doc ${path}`)
    await host.command('mnemosyne-import', 'apply')
    expect(host.root.startsWith(host.home)).toBe(true)
    expect(statSync(join(host.root, 'backups')).isDirectory()).toBe(true)
    expect(host.home).not.toBe(process.env.HOME)
  })
})

// ---- IMPORT.2: /mnemosyne-import session ----
//
// The transcript is a fixture in Claude Code's real line format (see the IMPORT.0 report): one JSON object a line, user turns
// as a string or text/tool_result blocks, assistant turns as thinking/text/tool_use blocks, and lines that are no conversation
// at all. The model is a stand-in that answers with a recorded reply; everything else is the real thing over a temp HOME.

const PROJECT = '-work-My-Repo' // the slug of the host's fake working folder, '/work/My Repo'
const SID = '3f2a9c10-aaaa-4bbb-8ccc-0123456789ab'
const ID2 = '9d8c7b60-bbbb-4ccc-9ddd-ba9876543210'
const TOKEN = 'ghp_' + 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3Ss2Rr1Qq0Pp9Oo8Nn7'
let uuid = 0
const base = (type: string, extra: Record<string, unknown> = {}) => ({ parentUuid: null, isSidechain: false, userType: 'external', cwd: '/work/My Repo', sessionId: SID, version: '2.1.0', uuid: `u-${++uuid}`, timestamp: '2026-10-25T10:00:00.000Z', type, ...extra })
const userTurn = (text: string, extra: Record<string, unknown> = {}) => base('user', { message: { role: 'user', content: text }, ...extra })
const assistantTurn = (blocks: object[], extra: Record<string, unknown> = {}) => base('assistant', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude', content: blocks, stop_reason: 'end_turn', usage: {} }, ...extra })
const say = (text: string) => assistantTurn([{ type: 'text', text }])

/** A transcript as Claude Code writes it, with every kind of line that is not conversation mixed in. */
function transcript(turns: object[] = []): string {
  const lines: object[] = [
    { type: 'mode', mode: 'default', sessionId: SID },
    { type: 'file-history-snapshot', messageId: 'm0', snapshot: { trackedFileBackups: {} }, isSnapshotUpdate: false },
    base('attachment', { attachment: { type: 'hook_success', content: 'HOOK-OUTPUT-NOT-CONVERSATION' } }),
    userTurn('<system-reminder>REMINDER-NOT-SPOKEN: the user email is somebody@example.com</system-reminder>I prefer tabs over spaces in every repo, and please always run the linter before a commit.'),
    assistantTurn([{ type: 'thinking', thinking: 'THINKING-NOT-CONVERSATION', signature: 'x' }, { type: 'text', text: 'Understood: tabs, and the linter runs before each commit.' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'TOOL-INPUT-NOT-CONVERSATION' } }]),
    base('user', { message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'TOOL-RESULT-NOT-CONVERSATION' }] } }),
    userTurn('<command-name>/clear</command-name>'),
    userTurn('META-NOT-CONVERSATION', { isMeta: true }),
    say('SIDECHAIN-NOT-CONVERSATION'),
    base('system', { subtype: 'info', content: 'SYSTEM-NOT-CONVERSATION' }),
    { type: 'last-prompt', lastPrompt: 'x', sessionId: SID },
    { type: 'api-request-blob', blob: 'B'.repeat(50) },
    ...turns,
  ]
  // the sidechain line must carry the flag
  return `${lines.map(line => JSON.stringify((line as { uuid?: string }).uuid && JSON.stringify(line).includes('SIDECHAIN-NOT') ? { ...line, isSidechain: true } : line)).join('\n')}\n`
}

function writeTranscript(host: Host, id: string, text: string, mtime?: Date) {
  const dir = join(host.home, '.claude', 'projects', PROJECT)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${id}.jsonl`)
  writeFileSync(path, text)
  if (mtime !== undefined) utimesSync(path, mtime, mtime)
  return path
}

const REPLY = JSON.stringify({
  memories: [
    { content: 'The user prefers tabs over spaces in every repository.', kind: 'preference', tags: ['formatting', 'style'] },
    { content: 'Always run the linter before making a commit.', kind: 'instruction', tags: ['git'] },
    { content: `The deploy token for the registry is ${TOKEN} and must be used for every push.`, kind: 'fact', tags: ['deploy'] },
    { content: 'Released on 2026-10-01, merged and done: the formatter change is next.', kind: 'fact', tags: [] },
  ],
})
const answers = (text: string) => () => ({ isAnswered: true as const, text })

describe('IMPORT.2: the dry run', () => {
  test('sends only the redacted conversation text to the model, and shows the checked memories', async () => {
    const host = await open({ model: answers(REPLY) })
    writeTranscript(host, SID, transcript([userTurn(`my token is ${TOKEN} please keep it safe`), say('I will not store it.')]))
    const reply = (await host.command('mnemosyne-import', `session ${SID}`)).text
    expect(host.model).toHaveLength(1)
    const { system, prompt } = host.model[0]!.request
    // the conversation, and nothing but the conversation
    expect(prompt).toContain('I prefer tabs over spaces')
    expect(prompt).toContain('Understood: tabs')
    for (const noise of ['REMINDER-NOT-SPOKEN', 'somebody@example.com', 'HOOK-OUTPUT-NOT', 'THINKING-NOT', 'TOOL-INPUT-NOT', 'TOOL-RESULT-NOT', 'META-NOT', 'SIDECHAIN-NOT', 'SYSTEM-NOT', '/clear']) expect(prompt).not.toContain(noise)
    // key and token shapes never leave the machine
    expect(prompt).not.toContain(TOKEN)
    expect(prompt).toContain('[redacted]')
    expect(system).toContain('at most 5 items')
    // the reply: four proposed, one blocked (its text hidden), one warned
    expect(reply).toContain(`Dry run for session ${SID}: 4 memories proposed`)
    expect(reply).toContain('No memory was changed')
    expect(reply).toContain('Would save 2 clean; 1 with a warning')
    expect(reply).toContain('1 blocked (never saved)')
    expect(reply).toContain('The user prefers tabs')
    expect(reply).toContain('(text hidden: blocked)')
    expect(reply).not.toContain(TOKEN)
    expect(rows(host)).toHaveLength(0)
    expect(backups(host)).toHaveLength(0)
  })

  test('the proposals file holds the session id, hashes and verdicts, never a memory\'s text', async () => {
    const host = await open({ model: answers(REPLY) })
    writeTranscript(host, SID, transcript())
    await host.command('mnemosyne-import', `session ${SID}`)
    expect(host.mode(proposalPath(host))).toBe('600')
    const text = readFileSync(proposalPath(host), 'utf8')
    const proposal = JSON.parse(text) as { kind: string; sessionId: string; chunks: { sha256: string; verdict: string; rules: string[]; heading: string }[] }
    expect(proposal.kind).toBe('session')
    expect(proposal.sessionId).toBe(SID)
    expect(proposal.chunks.map(chunk => chunk.verdict)).toEqual(['allow', 'allow', 'block', 'warn'])
    expect(proposal.chunks.every(chunk => /^[0-9a-f]{64}$/.test(chunk.sha256))).toBe(true)
    expect(proposal.chunks[2]!.rules).toEqual(['G1'])
    for (const hidden of ['tabs', 'linter', TOKEN, 'formatter']) expect(text).not.toContain(hidden)
  })

  test('junk from the model gives nothing and writes nothing', async () => {
    const host = await open({ model: answers('Sure! I could not find anything {{ nope') })
    writeTranscript(host, SID, transcript())
    const reply = (await host.command('mnemosyne-import', `session ${SID}`)).text
    expect(reply).toContain('found nothing durable worth remembering')
    expect(rows(host)).toHaveLength(0)
    expect((await host.command('mnemosyne-import', 'apply')).text).toContain('Imported 0 memories')
    expect(rows(host)).toHaveLength(0)
  })

  test('a failed model call and a switched-off extraction model change nothing', async () => {
    const failing = await open({ model: () => ({ isAnswered: false as const, reason: 'api-error', status: 500, error: 'overloaded' }) })
    writeTranscript(failing, SID, transcript())
    const reply = (await failing.command('mnemosyne-import', `session ${SID}`)).text
    expect(reply).toContain('The model call failed (api-error 500 overloaded)')
    expect(existsSync(proposalPath(failing))).toBe(false)
    const off = await open({ model: answers(REPLY), options: { extractionModel: 'off' } })
    writeTranscript(off, SID, transcript())
    expect((await off.command('mnemosyne-import', `session ${SID}`)).text).toContain('extractionModel')
    expect(off.model).toHaveLength(0)
  })

  test('a session id that does not exist, or is not an id, is refused before any model call', async () => {
    const host = await open({ model: answers(REPLY) })
    writeTranscript(host, SID, transcript())
    expect((await host.command('mnemosyne-import', `session ${ID2}`)).text).toContain('there is no transcript for that session id')
    expect((await host.command('mnemosyne-import', 'session ../../etc/passwd')).text).toContain('only letters, digits, hyphens and underscores')
        expect(host.model).toHaveLength(0)
  })

  test('"last" is the newest earlier transcript of the project, never the running session', async () => {
    const host = await open({ model: answers(REPLY) })
    writeTranscript(host, ID2, transcript(), new Date(Date.now() - 3_600_000))
    // the running session is 's1' in this host, and its file is the newest
    writeTranscript(host, 's1', transcript([userTurn('RUNNING-SESSION-TURN')]), new Date())
    const reply = (await host.command('mnemosyne-import', 'session last')).text
    expect(reply).toContain(`Dry run for session ${ID2}`)
    expect(host.model[0]!.request.prompt).not.toContain('RUNNING-SESSION-TURN')
  })

  test('a transcript over 4 MiB is read by the script, and the text is cut to 30,000 characters keeping the newest turns', async () => {
    const host = await open({ model: answers(REPLY) })
    const turns: object[] = []
    for (let i = 0; i < 400; i++) turns.push(userTurn(`OLD-${i} ${'q'.repeat(1700)}`), say(`ANSWER-${i} ${'r'.repeat(1700)}`))
    // one huge tool result line, the shape that makes real transcripts big
    turns.splice(100, 0, base('user', { message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't9', content: 'Z'.repeat(5 * 1024 * 1024) }] } }))
    const path = writeTranscript(host, SID, transcript(turns))
    expect(statSync(path).size).toBeGreaterThan(4 * 1024 * 1024)
    const reply = (await host.command('mnemosyne-import', `session ${SID}`)).text
    expect(reply).toContain('the text is capped')
    const prompt = host.model[0]!.request.prompt
    expect(prompt).toContain('ANSWER-399')
    expect(prompt).not.toContain('OLD-0 ')
    expect(prompt).not.toContain('ZZZZZZZZ')
    // the quoted text is at most 30,000 characters plus the JSON quoting and the fixed words around it
    expect(prompt.length).toBeLessThan(30_000 + 1_500)
  })
})

describe('IMPORT.2: apply', () => {
  async function dryRun(host: Host) {
    writeTranscript(host, SID, transcript())
    return (await host.command('mnemosyne-import', `session ${SID}`)).text
  }

  test('backs the store up, then saves the clean memories with source import:session, IMPORTED, imported, their kind and tags', async () => {
    const host = await open({ model: answers(REPLY) })
    await dryRun(host)
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain(`Imported 2 memories of session ${SID}`)
    expect(reply).toContain('1 blocked')
    expect(reply).toContain('1 with a warning')
    expect(backups(host)).toHaveLength(1)
    const saved = rows(host)
    expect(saved).toHaveLength(2)
    expect(saved.map(row => row.memory_type).sort()).toEqual(['instruction', 'preference'])
    for (const row of saved) {
      expect(row.source).toBe('import:session')
      expect(row.trust_tier).toBe('IMPORTED')
      expect(row.veracity).toBe('imported')
      expect(row.scope).toBe('global')
      expect(row.valid_until).toBeNull()
      expect((meta(row) as { origin?: { session: string; sha256: string } }).origin?.session).toBe(SID)
    }
    const tabs = saved.find(row => row.content.includes('tabs'))!
    expect((JSON.parse(tabs.metadata_json!) as { tags: string[] }).tags).toEqual(['formatting', 'style'])
    // the backup came first
    const order = host.runs.filter(run => (String(run.argv[1] ?? '').endsWith('/bin/memories.ts') && run.argv.includes('backup')) || (run.argv[2] === 'mcp' && String(run.stdin).includes('mnemopi_remember')))
    expect(order[0]!.argv.includes('backup')).toBe(true)
    // the blocked memory is in no file, no log, no stdin to the engine, no row
    const where = [reply, readFileSync(proposalPath(host), 'utf8'), readFileSync(join(host.root, 'activity.jsonl'), 'utf8'), host.runs.map(run => run.stdin ?? '').join('\n'), readFileSync(join(host.store, 'mnemopi.db')).toString('latin1')]
    for (const text of where) expect(text).not.toContain(TOKEN)
    const lines = host.activity().filter(line => line.action === 'import')
    expect(lines).toHaveLength(1)
    expect(lines[0]!.origin).toBe('session')
    expect(lines[0]!.count).toBe(2)
  })

  test('a warning is saved only with confirm, and flagged; text already saved is not saved twice', async () => {
    const host = await open({ model: answers(REPLY) })
    await dryRun(host)
    const first = (await host.command('mnemosyne-import', 'apply')).text
    expect(first).toContain('Imported 2 memories')
    expect(first).toContain('1 with a warning (resend as /mnemosyne-import apply confirm')
    // the message says to resend with confirm, so that must work on the same dry run: the two saved ones are skipped as already stored
    const confirmed = (await host.command('mnemosyne-import', 'apply confirm')).text
    expect(confirmed).toContain('Imported 1 memory of session')
    expect(confirmed).toContain('2 already in the store')
    const warned = rows(host).find(row => row.content.includes('formatter'))!
    expect(meta(warned).guard).toEqual(['G4'])
    expect(warned.source).toBe('import:session')
    expect(rows(host)).toHaveLength(3)
    // and a third apply adds nothing at all
    const third = (await host.command('mnemosyne-import', 'apply confirm')).text
    expect(third).toContain('Imported 0 memories')
    expect(rows(host)).toHaveLength(3)
  })

  test('stops, and changes nothing, when the backup fails', async () => {
    const host = await open({ model: answers(REPLY) })
    await dryRun(host)
    mkdirSync(join(host.root, 'backups'), { recursive: true })
    chmodSync(join(host.root, 'backups'), 0o500)
    const engineBefore = host.engineRuns().length
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain('Stopped: the backup before the change failed')
    expect(rows(host)).toHaveLength(0)
    expect(host.engineRuns()).toHaveLength(engineBefore)
  })

  test('uses the settings of this call: the guard length and the tags per memory are read again at apply', async () => {
    const host = await open({ model: answers(REPLY) })
    await dryRun(host)
    // a minimum length of 60 makes the two short sentences (54 and 45 characters) too short, though the dry run let them through
    setConfig(host, { guard: { minLength: 60 } })
    const blocked = (await host.command('mnemosyne-import', 'apply')).text
    expect(blocked).toContain('Imported 0 memories')
    expect(blocked).toContain('3 blocked')
    expect(rows(host)).toHaveLength(0)
    // one tag per memory, set after the dry run, applies to what is saved now
    setConfig(host, { tags: { maxPerMemory: 1 } })
    const saved = (await host.command('mnemosyne-import', 'apply')).text
    expect(saved).toContain('Imported 2 memories')
    const tabs = rows(host).find(row => row.content.includes('tabs'))!
    expect((JSON.parse(tabs.metadata_json!) as { tags: string[] }).tags).toEqual(['formatting'])
  })

  test('the memories of a dry run that this process no longer holds are not applied', async () => {
    const host = await open()
    // a session proposal file left by another process: its text exists nowhere
    mkdirSync(host.root, { recursive: true })
    writeFileSync(proposalPath(host), JSON.stringify({ version: 1, kind: 'session', created: 'x', sessionId: SID, chunks: [{ heading: 'memory 1', sha256: 'a'.repeat(64), verdict: 'allow', rules: [] }] }))
    const reply = (await host.command('mnemosyne-import', 'apply')).text
    expect(reply).toContain('no longer in this Claude Code process')
    expect(backups(host)).toHaveLength(0)
    expect(rows(host)).toHaveLength(0)
  })
})
