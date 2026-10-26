// IMPORT.1: /mnemosyne-import doc and apply, run for real. The hooks are the real hooks/register.ts;
// bin/import.ts, bin/memories.ts, bin/activity.ts and the engine are the real ones over a temp HOME
// (see knowledge-host.ts). No model is called, and nothing here touches the real ~/.claude.
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
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
    expect(again).toContain('3 unchanged since the last import')
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
    expect(dry).toContain('2 unchanged')
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
