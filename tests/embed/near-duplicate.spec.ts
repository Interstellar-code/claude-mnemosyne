// META.3.a4: the G3 warning with real vectors. The real hooks/register.ts runs over the real
// engine with the real embedding model (the host of tests/bun/knowledge-host.ts, only the model
// call of extraction is off): two near-identical notes and one unrelated note are saved through
// memory_remember. The second note is refused in strict mode with the first one named, saved with
// confirm: true and flagged near-duplicate:<id>; the unrelated note gets no warning. Needs the
// network on its first run (the ~63 MB model download), so it lives here and not in `test:bun`;
// the model cache home is shared with embed.spec.ts.
import { Database } from 'bun:sqlite'
import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineEnv } from '../../hooks/engine'
import { makeHost } from '../bun/knowledge-host'
import type { Host } from '../bun/knowledge-host'

setDefaultTimeout(300_000)
const ROOT = join(import.meta.dir, '..', '..')
const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const CACHE_HOME = process.env.MNEMOSYNE_EMBED_CACHE_HOME ?? join(tmpdir(), 'mnemosyne-embed-cache-home')
mkdirSync(CACHE_HOME, { recursive: true })
const dirs: string[] = []
const hosts: Host[] = []

/** Makes sure the model is in the shared cache: one real embedding run against a throwaway store. */
async function warmUp() {
  const store = mkdtempSync(join(tmpdir(), 'mnemosyne-near-warm-'))
  dirs.push(store)
  const base = { ...(process.env as Record<string, string>) }
  delete base.NODE_ENV
  delete base.BUN_ENV
  const child = Bun.spawn([process.execPath, CLI, 'mcp'], {
    env: { ...base, HOME: CACHE_HOME, ...engineEnv(store, 'near-warm', { embeddings: true }) },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'mnemopi_remember', arguments: { content: 'The warm-up note loads the embedding model.', scope: 'global' } } })}\n`)
  child.stdin.end()
  const [stderr, code] = await Promise.all([new Response(child.stderr).text(), child.exited])
  if (code !== 0) throw new Error(`model warm-up failed (exit ${code}): ${stderr.slice(-400)}`)
}

afterAll(() => {
  for (const host of hosts.splice(0)) host.dispose()
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

/** A host whose engine runs have embeddings on: the setup marker, and the model cache linked in. */
async function embeddingHost(options: Record<string, unknown> = {}) {
  await warmUp()
  // The test runtime would stop the engine from loading the model; the engine's own HOME is the host's.
  const parentEnv: Record<string, string> = { NODE_ENV: '', BUN_ENV: '' }
  const host = await makeHost({ options: { extractionModel: 'off', ...options }, parentEnv })
  hosts.push(host)
  parentEnv.HOME = host.home
  symlinkSync(join(CACHE_HOME, '.claude', 'mnemosyne', 'model-cache'), join(host.root, 'model-cache'), 'dir')
  writeFileSync(join(host.root, 'embeddings.json'), '{}')
  return host
}

const rowsOf = (host: Host) => {
  const db = new Database(join(host.store, 'mnemopi.db'), { readonly: true })
  try {
    return db.query('SELECT id, content, metadata_json FROM working_memory ORDER BY timestamp, id').all() as { id: string; content: string; metadata_json: string | null }[]
  } finally {
    db.close()
  }
}
const idOf = (reply: { result?: string }) => JSON.parse(String(reply.result).split('\nMnemosyne')[0]!).memory_id as string

describe('G3 near-duplicate warning under the real model', () => {
  test('META.3.a4: a near-identical note is refused and named in strict mode, flagged when confirmed; an unrelated note is not warned about', async () => {
    const host = await embeddingHost()
    const first = await host.tool('memory_remember', { content: 'Rohit prefers dark mode in his code editors.', kind: 'preference' })
    expect(first.deny).toBeUndefined()
    const firstId = idOf(first)

    // The near-identical note: strict mode refuses it and names the first one; nothing new is stored.
    const second = { content: 'Rohit prefers dark mode in code editors.', kind: 'preference' }
    const refused = await host.tool('memory_remember', second)
    expect(refused.deny).toContain('G3')
    expect(refused.deny).toContain(firstId)
    expect(refused.deny).toContain('owner global')
    expect(refused.deny).toContain('Rohit prefers dark mode in his code editors.')
    expect(refused.deny).toMatch(/score 0\.(8[89]|9\d)|score 1\.00/)
    expect(refused.deny).toContain('Update one of these instead')
    expect(rowsOf(host)).toHaveLength(1)

    // Confirmed, it is saved and flagged; the reply carries the warning line.
    const confirmed = await host.tool('memory_remember', { ...second, confirm: true })
    expect(confirmed.deny).toBeUndefined()
    expect(String(confirmed.result)).toContain(firstId)
    const stored = rowsOf(host).find(row => row.content === second.content)!
    expect(JSON.parse(stored.metadata_json!)).toEqual({ guard: [`near-duplicate:${firstId}`] })

    // The unrelated note: no warning, no flag, saved.
    const unrelated = await host.tool('memory_remember', { content: 'The quarterly invoice for the Hamburg office is due on the 14th of March.', kind: 'fact' })
    expect(unrelated.deny).toBeUndefined()
    expect(String(unrelated.result)).not.toContain('G3')
    const invoice = rowsOf(host).find(row => row.content.startsWith('The quarterly invoice'))!
    expect(invoice.metadata_json).toBeNull()
  })

  test('META.3.a4: in warn mode the near-identical note is saved at once with the flag and the warning', async () => {
    const host = await embeddingHost({ guardMode: 'warn' })
    const first = await host.tool('memory_remember', { content: 'The deploy script lives in the ops folder of the repository.', kind: 'fact' })
    const firstId = idOf(first)
    const second = await host.tool('memory_remember', { content: 'The deploy script lives in the ops folder of this repository.', kind: 'fact' })
    expect(second.deny).toBeUndefined()
    expect(String(second.result)).toContain(`Mnemosyne guard warning: G3`)
    expect(String(second.result)).toContain(firstId)
    const stored = rowsOf(host).find(row => row.content.endsWith('of this repository.'))!
    expect(JSON.parse(stored.metadata_json!).guard).toEqual([`near-duplicate:${firstId}`])
  })

  test('META.3.a4: saving the very same text again is a dedupe, not a near-duplicate', async () => {
    const host = await embeddingHost()
    const text = { content: 'Backups of the store are kept for ten runs, newest first.', kind: 'fact' }
    const first = await host.tool('memory_remember', text)
    const again = await host.tool('memory_remember', text)
    expect(again.deny).toBeUndefined()
    expect(idOf(again)).toBe(idOf(first))
    expect(rowsOf(host)).toHaveLength(1)
  })
})
