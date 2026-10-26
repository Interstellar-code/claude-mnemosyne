// IMPORT.3: memory_update takes pinned. The real hooks/register.ts, the real engine and a real store over a
// temp HOME (knowledge-host.ts), and the real external proxy for the "outside agents cannot pin" part.
import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { join } from 'node:path'
import { engineEnv } from '../../hooks/engine'
import { body, engineCall, isolatedEnv, ROOT, toolCall } from './helpers'
import { makeHost } from './knowledge-host'
import type { Host } from './knowledge-host'

setDefaultTimeout(60_000)
const hosts: Host[] = []
const open = async (...args: Parameters<typeof makeHost>) => {
  const host = await makeHost(...args)
  hosts.push(host)
  return host
}
afterEach(() => {
  for (const host of hosts.splice(0)) host.dispose()
})

const cliOf = (host: Host) => join(host.root, 'engine', 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'src', 'cli.ts')
const FACT = 'The release branch is cut from main on the first Monday of the month.'

type Row = { id: string; content: string; importance: number; memory_type: string; valid_until: string | null; superseded_by: string | null; metadata_json: string | null; session_id: string; created_at: string | null }
function row(host: Host, id: string): Row {
  const db = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
  // the save's own background extraction may still be writing: wait for it instead of failing on SQLITE_BUSY
  db.exec('PRAGMA busy_timeout = 10000')
  try {
    return db.query('SELECT id, content, importance, memory_type, valid_until, superseded_by, metadata_json, session_id, created_at FROM working_memory WHERE id = ?').get(id) as Row
  } finally {
    db.close()
  }
}
const metaOf = (host: Host, id: string) => JSON.parse(row(host, id).metadata_json ?? '{}') as { pinned?: unknown; tags?: string[] }

async function save(host: Host, input: Record<string, unknown>) {
  const saved = await host.tool('memory_remember', { content: FACT, kind: 'fact', ...input })
  expect(saved.deny).toBeUndefined()
  return JSON.parse(saved.result!).memory_id as string
}

describe('IMPORT.3: Claude pins and unpins a memory', () => {
  test('pinned: true then false is read back as metadata.pinned, and nothing else about the row changes', async () => {
    const host = await open()
    const id = await save(host, { tags: ['release', 'branching'], importance: 0.7 })
    const before = row(host, id)
    const pinned = await host.tool('memory_update', { memory_id: id, pinned: true })
    expect(pinned.deny).toBeUndefined()
    expect(JSON.parse(pinned.result!).status).toBe('updated')
    expect(metaOf(host, id)).toEqual({ tags: ['release', 'branching'], pinned: true })
    expect(row(host, id)).toEqual({ ...before, metadata_json: row(host, id).metadata_json })
    const unpinned = await host.tool('memory_update', { memory_id: id, pinned: false })
    expect(JSON.parse(unpinned.result!).status).toBe('updated')
    expect(metaOf(host, id)).toEqual({ tags: ['release', 'branching'], pinned: false })
    expect(row(host, id)).toEqual({ ...before, metadata_json: row(host, id).metadata_json })
  })

  test('pinning leaves valid_until alone and unpinning does not clear it', async () => {
    const host = await open()
    const id = await save(host, { kind: 'context', content: 'The release branch freeze is on until the audit is signed off by the team.' })
    const expiry = row(host, id).valid_until
    expect(expiry).not.toBeNull()
    await host.tool('memory_update', { memory_id: id, pinned: true })
    expect(row(host, id).valid_until).toBe(expiry)
    await host.tool('memory_update', { memory_id: id, pinned: false })
    expect(row(host, id).valid_until).toBe(expiry)
  })

  test('pinned goes together with tags in one call, and tags alone keep the pin', async () => {
    const host = await open()
    const id = await save(host, { tags: ['release'] })
    await host.tool('memory_update', { memory_id: id, pinned: true, tags: ['release', 'cadence'] })
    expect(metaOf(host, id)).toEqual({ tags: ['release', 'cadence'], pinned: true })
    await host.tool('memory_update', { memory_id: id, tags: ['cadence'] })
    expect(metaOf(host, id)).toEqual({ tags: ['cadence'], pinned: true })
    await host.tool('memory_update', { memory_id: id, tags: [] })
    expect(metaOf(host, id)).toEqual({ pinned: true })
  })

  test('a pin alone is a valid update; a value that is not true or false is refused before any engine run', async () => {
    const host = await open()
    const id = await save(host, {})
    // the save's own background extraction may still run; only update requests count here
    const updates = () => host.engineRuns().filter(run => String(run.stdin).includes('mnemopi_update')).length
    const engineBefore = updates()
    for (const bad of ['yes', 1, 'true', {}]) {
      const refused = await host.tool('memory_update', { memory_id: id, pinned: bad })
      expect(refused.deny).toBe('Mnemosyne: pinned must be true or false.')
    }
    expect(updates()).toBe(engineBefore)
    const empty = await host.tool('memory_update', { memory_id: id })
    expect(empty.deny).toBe('Mnemosyne: memory_update needs content, importance, tags, kind or pinned.')
    expect((await host.tool('memory_update', { memory_id: id, pinned: true })).deny).toBeUndefined()
  })
})

describe('IMPORT.3: a pinned memory never gets an automatic expiry', () => {
  test('the engine sweep lists the unpinned old note and skips the pinned one', async () => {
    const host = await open()
    const loose = await save(host, { kind: 'context', content: 'The staging cluster is rebuilt every Friday evening by the platform team.' })
    const kept = await save(host, { kind: 'context', content: 'The migration window for the billing database is the second weekend of June.' })
    await host.tool('memory_update', { memory_id: kept, pinned: true })
    // 120 days old, never recalled
    const old = new Date(Date.now() - 120 * 86_400_000).toISOString()
    const db = new Database(join(host.store, 'mnemopi.db'))
    db.exec('PRAGMA busy_timeout = 10000')
    try {
      db.run('UPDATE working_memory SET created_at = ?, valid_until = NULL, last_recalled = NULL WHERE id IN (?, ?)', [old, loose, kept])
    } finally {
      db.close()
    }
    const owner = row(host, loose).session_id
    const swept = body((await engineCall(cliOf(host), host.store, owner, [toolCall(1, 'mnemopi_expire_unused', { days: 30, dry_run: true, kinds: ['context'] })])).get(1)) as { candidates?: { id: string }[]; count?: number }
    const ids = (swept.candidates ?? []).map(candidate => candidate.id)
    expect(ids).toContain(loose)
    expect(ids).not.toContain(kept)
  })
})

describe('IMPORT.3: outside agents cannot pin', () => {
  const PROXY = join(ROOT, 'bin', 'mcp-proxy.ts')
  async function proxy(host: Host, messages: readonly object[]) {
    const child = Bun.spawn([process.execPath, PROXY], {
      env: { ...(process.env as Record<string, string>), ...isolatedEnv(), ...engineEnv(host.store, 'global'), MNEMOSYNE_CLI: cliOf(host), MNEMOSYNE_ACTIVITY_LOG: '' },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    child.stdin.write(messages.map(message => `${JSON.stringify(message)}\n`).join(''))
    child.stdin.end()
    const [stdout] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    const replies = new Map<unknown, any>()
    for (const line of stdout.split('\n')) {
      try {
        const message = JSON.parse(line)
        if (message?.id !== undefined) replies.set(message.id, message)
      } catch {
        // not JSON
      }
    }
    return replies
  }

  test('the proxy offers no pinned or metadata property on memory_update', async () => {
    const host = await open()
    const replies = await proxy(host, [{ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }])
    const tools = replies.get(1).result.tools as { name: string; inputSchema: { properties: Record<string, unknown> } }[]
    const update = tools.find(tool => tool.name === 'memory_update')!
    expect(Object.keys(update.inputSchema.properties)).not.toContain('pinned')
    expect(Object.keys(update.inputSchema.properties)).not.toContain('metadata')
  })

  test('a pinned argument or a metadata.pinned from an outside agent pins nothing', async () => {
    const host = await open()
    const id = await save(host, { tags: ['release'] })
    const owner = row(host, id).session_id
    const replies = await proxy(host, [
      toolCall(1, 'memory_update', { memory_id: id, pinned: true, importance: 0.9 }),
      toolCall(2, 'memory_update', { memory_id: id, metadata: { pinned: true }, importance: 0.8 }),
      toolCall(3, 'memory_update', { memory_id: id, pinned: true }),
    ])
    expect(owner).toBeTruthy()
    // the importance edits go through; the pin does not
    expect(metaOf(host, id)).toEqual({ tags: ['release'] })
    expect(replies.size).toBe(3)
  })
})
