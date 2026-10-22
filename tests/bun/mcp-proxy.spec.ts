// ENG.6: the external MCP proxy offers five memory_* tools, takes only cleaned
// tags from clients, never passes bank or metadata on, and refuses
// memory_update on a stale engine. The real proxy over stdio, against a real
// engine installed by bin/install-engine.ts into a temp folder, and a temp store.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cliOf } from '../../bin/install-engine'
import { ENGINE_BUILD } from '../../hooks/engine-build'
import { engineEnv, ROOT, runInstaller, tempDir, toolCall } from './helpers'

const PROXY = join(ROOT, 'bin', 'mcp-proxy.ts')

/** One proxy process: sends `messages`, closes stdin, returns its replies by id. */
async function proxy(cli: string, store: string, messages: readonly object[], owner = 'global') {
  const child = Bun.spawn([process.execPath, PROXY], {
    env: { ...(process.env as Record<string, string>), ...engineEnv(store, owner), MNEMOSYNE_CLI: cli },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  child.stdin.write(messages.map(message => `${JSON.stringify(message)}\n`).join(''))
  child.stdin.end()
  const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  const replies = new Map<unknown, any>()
  for (const line of stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (message?.id !== undefined) replies.set(message.id, message)
    } catch {
      // not JSON
    }
  }
  if (replies.size === 0) throw new Error(`proxy gave no replies: ${stderr.slice(-500)}`)
  return replies
}

const text = (reply: any) => JSON.parse(reply?.result?.content?.[0]?.text ?? 'null')

describe('the proxy against a real installed engine', () => {
  const temp = tempDir('proxy')
  const engine = join(temp.dir, 'engine')
  const store = join(temp.dir, 'store')
  let cli = ''

  beforeAll(async () => {
    const installed = await runInstaller(engine, store)
    if (installed.exitCode !== 0) throw new Error(`install failed: ${installed.stderr}`)
    cli = cliOf(engine)
    mkdirSync(store, { recursive: true })
  }, 300_000)
  afterAll(() => temp.dispose())

  const metadataOf = (id: string) => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      const row = db.query('SELECT metadata_json FROM working_memory WHERE id = ?').get(id) as { metadata_json: string | null } | null
      return row?.metadata_json == null ? row?.metadata_json : JSON.parse(row.metadata_json)
    } finally {
      db.close()
    }
  }

  test('tools/list returns exactly five memory_* tools; remember and update show tags, none shows metadata or bank', async () => {
    const replies = await proxy(cli, store, [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }])
    const tools = replies.get(1).result.tools as { name: string; inputSchema: { properties: Record<string, unknown>; required?: string[] } }[]
    expect(tools.map(tool => tool.name).sort()).toEqual(['memory_forget', 'memory_recall', 'memory_remember', 'memory_stats', 'memory_update'])
    for (const tool of tools) {
      expect(tool.inputSchema.properties.bank).toBeUndefined()
      expect(tool.inputSchema.properties.metadata).toBeUndefined()
      expect(tool.inputSchema.required ?? []).not.toContain('bank')
    }
    for (const name of ['memory_remember', 'memory_update']) {
      expect(tools.find(tool => tool.name === name)?.inputSchema.properties.tags).toMatchObject({ type: 'array' })
    }
    expect(tools.find(tool => tool.name === 'memory_update')?.inputSchema.required).toEqual(['memory_id'])
  })

  test('remember and update map cleaned tags to metadata.tags; bank and other metadata never reach the engine', async () => {
    const saved = await proxy(cli, store, [
      toolCall(1, 'memory_remember', {
        content: 'the proxy tags this fact',
        tags: [' Proxy ', 'proxy', 'Tags'],
        bank: 'evil',
        metadata: { owner_hack: true },
      }),
    ])
    const { memory_id: id, bank } = text(saved.get(1))
    expect(bank).toBe('default')
    expect(metadataOf(id)).toEqual({ tags: ['proxy', 'tags'] })

    const updated = await proxy(cli, store, [
      toolCall(2, 'memory_update', {
        memory_id: id,
        tags: ['Release', ' release ', 'NOTES'],
        bank: 'evil',
        metadata: { owner_hack: true, tags: ['sneaky'] },
      }),
    ])
    expect(text(updated.get(2))).toMatchObject({ status: 'updated', bank: 'default' })
    expect(metadataOf(id)).toEqual({ tags: ['release', 'notes'] })
    // a bank argument would have opened <store>/banks/evil/mnemopi.db
    expect(existsSync(join(store, 'banks', 'evil'))).toBe(false)

    // metadata without tags is dropped: nothing changes; [] removes the key
    const dropped = await proxy(cli, store, [
      toolCall(3, 'memory_update', { memory_id: id, content: 'the proxy tags this fact, edited', metadata: { tags: null } }),
      toolCall(4, 'memory_update', { memory_id: id, tags: 'not-a-list' }),
    ])
    expect(text(dropped.get(3))).toMatchObject({ status: 'updated' })
    expect(metadataOf(id)).toEqual({ tags: ['release', 'notes'] })
    expect(dropped.get(4).error.message).toBe('tags must be an array of strings')
    await proxy(cli, store, [toolCall(5, 'memory_update', { memory_id: id, tags: [] })])
    expect(metadataOf(id)).toEqual({})
  })

  test('importance is clamped to 0..1 on update and remember; a non-number is dropped (review r1 LOW 4)', async () => {
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'an important proxy fact', importance: 9 })])
    const id = text(saved.get(1)).memory_id
    const importance = () => {
      const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
      try {
        return (db.query('SELECT importance FROM working_memory WHERE id = ?').get(id) as { importance: number }).importance
      } finally {
        db.close()
      }
    }
    expect(importance()).toBe(1)
    await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, importance: -3 })])
    expect(importance()).toBe(0)
    await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, importance: 7 })])
    expect(importance()).toBe(1)
    const bad = await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, importance: 'high', tags: ['x'] })])
    expect(text(bad.get(1))).toMatchObject({ status: 'updated' })
    expect(importance()).toBe(1)
  })

  test('remember without tags sends no metadata', async () => {
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'an untagged proxy fact', metadata: { x: 1 } })])
    expect(metadataOf(text(saved.get(1)).memory_id)).toBeNull()
  })

  test('memory_update is refused with a clear error when the installed engine is not ENGINE_BUILD', async () => {
    const pkgPath = join(engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'package.json')
    const original = readFileSync(pkgPath, 'utf8')
    writeFileSync(pkgPath, original.replace(`"version": "${ENGINE_BUILD}"`, '"version": "18.12.3"'))
    try {
      const replies = await proxy(cli, store, [
        toolCall(1, 'memory_update', { memory_id: 'x', tags: ['a'] }),
        toolCall(2, 'memory_stats', {}),
      ])
      expect(replies.get(1).error.message).toContain(`needs the Mnemosyne engine build ${ENGINE_BUILD}`)
      expect(replies.get(1).error.message).toContain('/mnemosyne-setup')
      expect(text(replies.get(2)).status).toBe('ok') // the other tools still work
    } finally {
      writeFileSync(pkgPath, original)
    }
  })
})
