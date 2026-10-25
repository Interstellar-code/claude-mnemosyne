// ENG.6: the external MCP proxy offers five memory_* tools, takes only cleaned
// tags from clients, never passes bank or metadata on, and refuses
// memory_update on a stale engine. The real proxy over stdio, against a real
// engine installed by bin/install-engine.ts into a temp folder, and a temp store.
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cliOf } from '../../bin/install-engine'
import { ENGINE_BUILD } from '../../hooks/engine-build'
import { engineEnv, isolatedEnv, ROOT, runInstaller, tempDir, toolCall } from './helpers'

const PROXY = join(ROOT, 'bin', 'mcp-proxy.ts')

/** One proxy process: sends `messages`, closes stdin, returns its replies by id. `log` is MNEMOSYNE_ACTIVITY_LOG; `extraEnv` adds variables such as MNEMOSYNE_GUARD_MODE. */
async function proxy(cli: string, store: string, messages: readonly object[], owner = 'global', log = '', extraEnv: Record<string, string> = {}) {
  const child = Bun.spawn([process.execPath, PROXY], {
    env: { ...(process.env as Record<string, string>), ...isolatedEnv(), ...engineEnv(store, owner), MNEMOSYNE_CLI: cli, MNEMOSYNE_ACTIVITY_LOG: log, ...extraEnv },
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
    // KINDREQ.2: remember lists kind as required.
    expect(tools.find(tool => tool.name === 'memory_remember')?.inputSchema.required).toEqual(['content', 'kind'])
  })

  test('remember and update map cleaned tags to metadata.tags; bank and other metadata never reach the engine', async () => {
    const saved = await proxy(cli, store, [
      toolCall(1, 'memory_remember', {
        kind: 'fact',
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
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { kind: 'fact', content: 'an important proxy fact', importance: 9 })])
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

  // META.1: `kind` is the client's word for the engine's memory_type.
  const rowOf = (id: string) => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      return db.query('SELECT memory_type FROM working_memory WHERE id = ?').get(id) as { memory_type: string } | null
    } finally {
      db.close()
    }
  }
  const auditOf = (id: string) => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      return db.query('SELECT validator, action FROM memory_validations WHERE memory_id = ? ORDER BY validation_id').all(id) as { validator: string; action: string }[]
    } finally {
      db.close()
    }
  }

  test('META.1.a4: tools/list shows kind (the eight names) on remember and update, and never memory_type', async () => {
    const replies = await proxy(cli, store, [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }])
    const tools = replies.get(1).result.tools as { name: string; inputSchema: { properties: Record<string, any> } }[]
    for (const name of ['memory_remember', 'memory_update']) {
      const properties = tools.find(tool => tool.name === name)!.inputSchema.properties
      expect(properties.kind.enum).toEqual(['fact', 'preference', 'instruction', 'decision', 'context', 'error', 'artifact', 'event'])
      expect(properties.memory_type).toBeUndefined()
    }
  })

  test('META.1.a4: remember with a kind stores it as memory_type; a client memory_type is dropped', async () => {
    const replies = await proxy(cli, store, [
      toolCall(1, 'memory_remember', { content: 'the proxy saves a decision here', kind: 'decision', tags: ['d'] }),
      toolCall(2, 'memory_remember', { kind: 'fact', content: 'the proxy ignores a memory_type of its own', memory_type: 'decision' }),
    ])
    expect(rowOf(text(replies.get(1)).memory_id)?.memory_type).toBe('decision')
    expect(text(replies.get(1)).warning).toBeUndefined()
    expect(rowOf(text(replies.get(2)).memory_id)?.memory_type).toBe('fact')
  })

  test('KINDREQ.2: remember with no kind is a -32602 error naming the eight kinds, nothing is stored, and the log line holds no memory text', async () => {
    const log = join(temp.dir, 'logs-kindreq', 'activity.jsonl')
    const before = rowCount()
    const replies = await proxy(
      cli,
      store,
      [
        toolCall(1, 'memory_remember', { content: 'the proxy refuses a note with marmalade-zeppelin and no kind' }),
        toolCall(2, 'memory_remember', { content: 'the proxy refuses a null kind too', kind: null }),
        toolCall(3, 'memory_remember', { content: 'the proxy refuses a replacing save with no kind', replaces: 'a1b2c3d4e5f60718' }),
      ],
      'global',
      log,
    )
    for (const id of [1, 2, 3]) {
      expect(replies.get(id).error.code).toBe(-32602)
      expect(replies.get(id).error.message).toContain('no kind given')
      expect(replies.get(id).error.message).toContain('fact, preference, instruction (rule or runbook)')
      expect(replies.get(id).result).toBeUndefined()
    }
    expect(rowCount()).toBe(before)
    const lines = logLines(log)
    expect(lines.map(l => [l.action, l.origin, l.ok])).toEqual([
      ['remember', 'external', false],
      ['remember', 'external', false],
      ['remember', 'external', false],
    ])
    for (const line of lines) {
      expect(line.error).toContain('no kind given')
      expect(line.text).toBe('')
    }
    expect(readFileSync(log, 'utf8')).not.toContain('marmalade-zeppelin')
  })

  test('KINDREQ.2: memory_update still needs no kind', async () => {
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'the proxy updates this without a kind', kind: 'fact' })])
    const id = text(saved.get(1)).memory_id
    const updated = await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, content: 'the proxy updates this without a kind, edited' })])
    expect(updated.get(1).error).toBeUndefined()
    expect(text(updated.get(1))).toMatchObject({ status: 'updated' })
    expect(rowOf(id)?.memory_type).toBe('fact')
  })

  test('META.1.a4: an unknown kind is a -32602 error naming the choices, and nothing is stored', async () => {
    const before = (() => {
      const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
      try {
        return (db.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n
      } finally {
        db.close()
      }
    })()
    const replies = await proxy(cli, store, [
      toolCall(1, 'memory_remember', { content: 'the proxy refuses a bad kind', kind: 'unknown' }),
      toolCall(2, 'memory_remember', { content: 'the proxy refuses another bad kind', kind: 'note' }),
      toolCall(3, 'memory_update', { memory_id: 'x', kind: 'nope' }),
    ])
    for (const id of [1, 2, 3]) {
      expect(replies.get(id).error.code).toBe(-32602)
      expect(replies.get(id).error.message).toContain('unknown kind')
      expect(replies.get(id).error.message).toContain('fact, preference, instruction (rule or runbook)')
    }
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      expect((db.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n).toBe(before)
    } finally {
      db.close()
    }
  })

  test('META.1.a4: update takes kind as memory_type, alone or with content; a content change names the client as validator, whatever the client sends', async () => {
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'the proxy updates the kind of this', kind: 'fact' })])
    const id = text(saved.get(1)).memory_id
    const kindOnly = await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, kind: 'context' })])
    expect(text(kindOnly.get(1))).toMatchObject({ status: 'updated' })
    expect(rowOf(id)?.memory_type).toBe('context')
    expect(auditOf(id)).toEqual([])
    const withContent = await proxy(cli, store, [
      { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'codex', version: '1' } } },
      toolCall(1, 'memory_update', { memory_id: id, content: 'the proxy updates the kind of this, edited', kind: 'event', validator: 'claude-code' }),
    ])
    expect(text(withContent.get(1))).toMatchObject({ status: 'updated' })
    expect(rowOf(id)?.memory_type).toBe('event')
    expect(auditOf(id)).toEqual([{ validator: 'mcp:codex', action: 'update' }])
  })

  // META.2 (C4): what the proxy writes for an outside agent, read back from the row.
  const fullRow = (id: string) => {
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      return db.query('SELECT source, trust_tier, veracity, memory_type, valid_until, scope, author_id, author_type, metadata_json FROM working_memory WHERE id = ?').get(id) as Record<string, string | null>
    } finally {
      db.close()
    }
  }
  const hello = (name: string) => ({ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name, version: '1' } } })
  const DAY = 86_400_000

  test('META.2.a1/a3: an outside agent\'s save is source mcp:<client>, tier EXTERNAL_WRITE, veracity unknown, whatever the client claims', async () => {
    const replies = await proxy(cli, store, [
      hello('cursor'),
      toolCall(1, 'memory_remember', { content: 'the outside agent saves this decision', kind: 'decision', veracity: 'stated', trust_tier: 'STATED', source: 'user', valid_until: '2099-01-01', author_type: 'human' }),
    ])
    expect(fullRow(text(replies.get(1)).memory_id)).toMatchObject({ source: 'mcp:cursor', trust_tier: 'EXTERNAL_WRITE', veracity: 'unknown', memory_type: 'decision', valid_until: null, scope: 'global', author_id: 'cursor', author_type: 'agent' })
    const unnamed = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'an agent that gave no name saves this', kind: 'fact' })])
    expect(fullRow(text(unnamed.get(1)).memory_id)).toMatchObject({ source: 'mcp:unknown', trust_tier: 'EXTERNAL_WRITE', author_id: 'unknown' })
  })

  test('META.2.a2: through the proxy a context note expires in 14 days, expires_in_days sets it, a bad value is a -32602 error and stores nothing', async () => {
    const replies = await proxy(cli, store, [
      hello('cursor'),
      toolCall(1, 'memory_remember', { content: 'the proxy context note, left at the default', kind: 'context' }),
      toolCall(2, 'memory_remember', { content: 'the proxy context note, set to 90 days', kind: 'context', expires_in_days: 90 }),
      toolCall(3, 'memory_remember', { content: 'the proxy fact with no expiry at all', kind: 'fact' }),
      toolCall(4, 'memory_remember', { content: 'the proxy context note with a bad expiry', kind: 'context', expires_in_days: 400 }),
    ])
    const near = (value: string | null | undefined, days: number) => expect(Math.abs(Date.parse(String(value)) - (Date.now() + days * DAY))).toBeLessThan(60_000)
    near(fullRow(text(replies.get(1)).memory_id).valid_until, 14)
    near(fullRow(text(replies.get(2)).memory_id).valid_until, 90)
    expect(fullRow(text(replies.get(3)).memory_id).valid_until).toBeNull()
    expect(replies.get(4).error.code).toBe(-32602)
    expect(replies.get(4).error.message).toContain('expires_in_days must be a whole number from 1 to 365')
  })

  test('MODEL NB1/NB2 (b): re-saving identical text through the proxy keeps the scope: global stays global, a project owner\'s row stays channel', async () => {
    for (const [owner, scope] of [['global', 'global'], ['project-x-1a2b', 'channel']] as const) {
      const save = () => proxy(cli, store, [hello('cursor'), toolCall(1, 'memory_remember', { content: `re-saved through the proxy as ${owner}`, kind: 'fact' })], owner)
      const first = text((await save()).get(1)).memory_id
      expect(fullRow(first).scope).toBe(scope)
      const again = text((await save()).get(1)).memory_id
      expect(again).toBe(first)
      expect(fullRow(first)).toMatchObject({ scope, trust_tier: 'EXTERNAL_WRITE', source: 'mcp:cursor' })
    }
  })

  test('GUARD review finding 3 (a): through the proxy a clean content update clears the old guard flag and keeps the tags', async () => {
    const env = { MNEMOSYNE_GUARD_MODE: 'warn' }
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'Today the proxy importer was rewired to use the guard', kind: 'fact', tags: ['ops'] })], 'global', '', env)
    // A warned save's reply has guard warning lines after the engine's JSON.
    const id = JSON.parse(String(saved.get(1).result.content[0].text).split('\nMnemosyne')[0]!).memory_id
    expect(JSON.parse(fullRow(id).metadata_json!)).toEqual({ tags: ['ops'], guard: ['G4'] })
    const updated = await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, content: 'The proxy importer uses the guard module for each save.' })], 'global', '', env)
    expect(text(updated.get(1))).toMatchObject({ status: 'updated' })
    expect(JSON.parse(fullRow(id).metadata_json!)).toEqual({ tags: ['ops'] })
  })

  test('remember without tags sends no metadata', async () => {
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { kind: 'fact', content: 'an untagged proxy fact', metadata: { x: 1 } })])
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
  // LOG.3: each call through the proxy is one activity line, origin external.

  const logLines = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [])

  test('each allowed tool call logs one line with origin external, the owner, and ok, ids and count from the reply', async () => {
    const log = join(temp.dir, 'logs-1', 'activity.jsonl')
    const owner = 'project-proxylog-1'
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { kind: 'fact', content: 'the heron nests by the proxy log', tags: ['Birds'] })], owner, log)
    const id = text(saved.get(1)).memory_id as string
    const replies = await proxy(
      cli,
      store,
      [
        toolCall(2, 'memory_recall', { query: 'heron nests' }),
        toolCall(3, 'memory_update', { memory_id: id, tags: ['Birds', 'Water'] }),
        toolCall(4, 'memory_sleep', {}),
        toolCall(5, 'memory_stats', {}),
        toolCall(6, 'memory_forget', { memory_id: id }),
      ],
      owner,
      log,
    )
    expect(replies.get(4).error.message).toBe('Tool not available: memory_sleep')

    // the proxy has exited: every write finished before it did
    const lines = logLines(log)
    expect(lines.map(l => [l.action, l.origin, l.owner, l.ok])).toEqual([
      ['remember', 'external', owner, true],
      ['recall', 'external', owner, true],
      ['update', 'external', owner, true],
      ['stats', 'external', owner, true],
      ['forget', 'external', owner, true],
    ])
    expect(lines[0]).toMatchObject({ text: 'the heron nests by the proxy log', ids: [id], count: 1 })
    expect(lines[1].text).toBe('heron nests')
    expect(lines[1].ids).toContain(id)
    expect(lines[1].count).toBe(text(replies.get(2)).results.length)
    expect(lines[2]).toMatchObject({ text: 'tags: birds, water', ids: [id], count: 1 })
    expect(lines[4]).toMatchObject({ ids: [id], count: 1 })
    for (const line of lines) expect(Number.isNaN(Date.parse(line.t))).toBe(false)
    if (process.platform !== 'win32') expect(statSync(log).mode & 0o777).toBe(0o600)
  })

  test('a refused call, or one the engine fails, logs ok false with the error', async () => {
    const log = join(temp.dir, 'logs-2', 'activity.jsonl')
    await proxy(cli, store, [
      toolCall(1, 'memory_update', { memory_id: 'missing', tags: 'not-a-list' }),
      toolCall(2, 'memory_forget', { memory_id: 'no-such-memory' }),
    ], 'global', log)
    expect(logLines(log).map(l => [l.action, l.ok, l.error])).toEqual([
      ['update', false, 'tags must be an array of strings'],
      ['forget', false, 'not_found'],
    ])
  })

  // GUARD.2: the same admission check as the plugin's own tools, before anything reaches the engine.
  const rowCount = () => {
    if (!existsSync(join(store, 'mnemopi.db'))) return 0
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      return (db.query('SELECT COUNT(*) AS n FROM working_memory').get() as { n: number }).n
    } finally {
      db.close()
    }
  }
  const AWS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'

  test('GUARD.2: a blocked remember or content update is a -32602 error with the rule ids, nothing is stored, and the line holds ids only', async () => {
    const log = join(temp.dir, 'logs-guard-block', 'activity.jsonl')
    const before = rowCount()
    const replies = await proxy(cli, store, [
      toolCall(1, 'memory_remember', { kind: 'fact', content: `the bucket key is ${AWS_KEY} for the deploy` }),
      toolCall(2, 'memory_remember', { kind: 'fact', content: 'tiny' }),
      toolCall(3, 'memory_update', { memory_id: 'm1', content: `password=hunter2hunter2hunter2 for the deploy` }),
      toolCall(4, 'memory_stats', {}),
    ], 'global', log)
    for (const [id, rule] of [[1, 'G1'], [2, 'G2'], [3, 'G1']] as const) {
      expect(replies.get(id).error.code).toBe(-32602)
      expect(replies.get(id).error.message).toContain(rule)
      expect(replies.get(id).error.data).toEqual({ rules: [rule] })
      expect(replies.get(id).result).toBeUndefined()
    }
    expect(JSON.stringify([...replies.values()]).includes(AWS_KEY)).toBe(false)
    expect(text(replies.get(4)).status).toBe('ok') // other calls still work
    expect(rowCount()).toBe(before)
    const lines = logLines(log)
    expect(lines.map(l => [l.action, l.origin, l.ok, l.error, l.text])).toEqual([
      ['remember', 'external', false, 'guard:G1', ''],
      ['remember', 'external', false, 'guard:G2', ''],
      ['update', 'external', false, 'guard:G1', ''],
      ['stats', 'external', true, undefined, ''],
    ])
    const written = readFileSync(log, 'utf8')
    for (const piece of [AWS_KEY, 'hunter2', 'bucket', 'tiny']) expect(written.includes(piece)).toBe(false)
  })

  test('GUARD.2: in warn mode a warned remember is stored with metadata.guard beside its tags, and the reply carries one warning line per hit', async () => {
    const log = join(temp.dir, 'logs-guard-warn', 'activity.jsonl')
    const replies = await proxy(cli, store, [
      toolCall(1, 'memory_remember', { kind: 'fact', content: 'Today the importer was rewired to use the guard module', tags: ['Ops'] }),
      toolCall(2, 'memory_remember', { kind: 'fact', content: 'The plugin keeps its memories in one local SQLite file.' }),
    ], 'global', log, { MNEMOSYNE_GUARD_MODE: 'warn' })
    const [reply, ...warnings] = String(replies.get(1).result.content[0].text).split('\nMnemosyne guard warning: ')
    const id = JSON.parse(reply!).memory_id
    expect(warnings.length).toBe(1)
    expect(warnings[0]).toContain('G4')
    expect(metadataOf(id)).toEqual({ tags: ['ops'], guard: ['G4'] })
    // a clean save: no extra lines, no guard key
    expect(replies.get(2).result.content[0].text.includes('guard warning')).toBe(false)
    expect(metadataOf(text(replies.get(2)).memory_id)).toBeNull()
    expect(logLines(log).map(l => [l.action, l.ok])).toEqual([['remember', true], ['remember', true]])
  })

  const WARNED = 'Today the importer was rewired to use the guard module'

  test('GUARD.3: strict is the default: a warned remember or content update is a -32602 error naming the rules and asking for confirm: true; nothing is stored; the line holds ids only', async () => {
    const log = join(temp.dir, 'logs-guard-strict', 'activity.jsonl')
    const before = rowCount()
    for (const env of [{}, { MNEMOSYNE_GUARD_MODE: 'strict' }, { MNEMOSYNE_GUARD_MODE: 'bogus' }] as Record<string, string>[]) {
      const replies = await proxy(cli, store, [
        toolCall(1, 'memory_remember', { kind: 'fact', content: WARNED }),
        toolCall(2, 'memory_update', { memory_id: 'm1', content: WARNED }),
        toolCall(3, 'memory_remember', { kind: 'fact', content: 'a long fact '.repeat(150) }),
      ], 'global', log, env)
      for (const [id, rule] of [[1, 'G4'], [2, 'G4'], [3, 'G2']] as const) {
        expect(replies.get(id).error.code).toBe(-32602)
        expect(replies.get(id).error.message).toContain(rule)
        expect(replies.get(id).error.message).toContain('Resend with confirm: true if the save is wanted.')
        expect(replies.get(id).error.data).toEqual({ rules: [rule] })
        expect(replies.get(id).error.message.includes('importer')).toBe(false)
      }
    }
    expect(rowCount()).toBe(before)
    const lines = logLines(log)
    expect(lines.length).toBe(9)
    expect(lines.slice(0, 3).map(l => [l.action, l.ok, l.error, l.text])).toEqual([
      ['remember', false, 'guard:G4', ''],
      ['update', false, 'guard:G4', ''],
      ['remember', false, 'guard:G2', ''],
    ])
    expect(readFileSync(log, 'utf8').includes('importer')).toBe(false)
  })

  test('GUARD.3: confirm: true stores a warned save with metadata.guard and the warning lines; confirm never reaches the engine; a block has no override', async () => {
    const log = join(temp.dir, 'logs-guard-confirm', 'activity.jsonl')
    const replies = await proxy(cli, store, [
      toolCall(1, 'memory_remember', { kind: 'fact', content: WARNED, confirm: true, tags: ['Ops'] }),
      toolCall(2, 'memory_remember', { kind: 'fact', content: `the bucket key is ${AWS_KEY} for the deploy`, confirm: true }),
      toolCall(3, 'memory_remember', { kind: 'fact', content: 'tiny', confirm: true }),
    ], 'global', log)
    const [reply, ...warnings] = String(replies.get(1).result.content[0].text).split('\nMnemosyne guard warning: ')
    expect(warnings.length).toBe(1)
    expect(metadataOf(JSON.parse(reply!).memory_id)).toEqual({ tags: ['ops'], guard: ['G4'] })
    expect(replies.get(2).error.code).toBe(-32602)
    expect(replies.get(2).error.message).toContain('G1')
    expect(replies.get(3).error.message).toContain('G2')
    expect(replies.get(3).error.message.includes('Resend with confirm')).toBe(false)
    // refused calls are logged at once, the stored one after the engine's reply
    expect(logLines(log).map(l => `${l.ok} ${l.error ?? ''}`).sort()).toEqual(['false guard:G1', 'false guard:G2', 'true '])
  })

  test('GUARD.3: remember and update show a confirm boolean in tools/list', async () => {
    const replies = await proxy(cli, store, [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }])
    const tools = replies.get(1).result.tools as { name: string; inputSchema: { properties: Record<string, unknown> } }[]
    for (const tool of tools) {
      const confirm = tool.inputSchema.properties.confirm
      if (tool.name === 'memory_remember' || tool.name === 'memory_update') expect(confirm).toMatchObject({ type: 'boolean' })
      else expect(confirm).toBeUndefined()
    }
  })

  // UPGRADE.1: an engine older than ENGINE_BUILD still has the 24 h trim that deletes every row whose trust tier is not IMPORTED,
  // and a save of this build is EXTERNAL_WRITE, so a stale engine refuses memory_remember like memory_update.
  test('UPGRADE.1: memory_remember on a stale engine is refused with the same error as memory_update, nothing is stored, and recall, forget and stats still work', async () => {
    const log = join(temp.dir, 'logs-stale-remember', 'activity.jsonl')
    const pkgPath = join(engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'package.json')
    const original = readFileSync(pkgPath, 'utf8')
    const before = rowCount()
    writeFileSync(pkgPath, original.replace(`"version": "${ENGINE_BUILD}"`, '"version": "18.12.3"'))
    try {
      const replies = await proxy(
        cli,
        store,
        [
          toolCall(1, 'memory_remember', { content: 'A note with a distinctive phrase: marmalade-zeppelin.', kind: 'fact', tags: ['ops'] }),
          toolCall(2, 'memory_update', { memory_id: 'x', tags: ['a'] }),
          toolCall(3, 'memory_recall', { query: 'deploy notes' }),
          toolCall(4, 'memory_forget', { memory_id: 'does-not-exist' }),
          toolCall(5, 'memory_stats', {}),
        ],
        'global',
        log,
      )
      expect(replies.get(1).error.code).toBe(-32000)
      expect(replies.get(1).error.message).toContain(`memory_remember needs the Mnemosyne engine build ${ENGINE_BUILD}; installed is 18.12.3`)
      expect(replies.get(1).error.message).toContain('/mnemosyne-setup')
      // the same error as the update refusal, apart from the tool name
      expect(replies.get(1).error.message.replace('memory_remember', 'memory_update')).toBe(replies.get(2).error.message)
      expect(replies.get(1).result).toBeUndefined()
      expect(text(replies.get(3)).status).toBe('ok')
      expect(replies.get(4).error).toBeUndefined()
      expect(text(replies.get(5)).status).toBe('ok')
    } finally {
      writeFileSync(pkgPath, original)
    }
    expect(rowCount()).toBe(before)
    const [line] = logLines(log)
    expect(line).toMatchObject({ action: 'remember', origin: 'external', ok: false, text: '' })
    expect(line.error).toContain(`memory_remember needs the Mnemosyne engine build ${ENGINE_BUILD}`)
    expect(readFileSync(log, 'utf8')).not.toContain('marmalade')
  })

  test('UPGRADE.1: once the engine is current again the same remember is stored', async () => {
    const replies = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'A note the current engine keeps without trouble.', kind: 'fact' })])
    expect(text(replies.get(1)).status).toBe('stored')
  })

  // The review item: tags that all clean away must not read as "remove the tags".
  test('UPGRADE.1: a proxy tag update whose tags all clean away (only the project name) is refused, and the stored tags stay; tags [] still removes them', async () => {
    const owner = 'project-My-Repo-1a2b'
    const saved = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'A note whose tags a client tries to wipe by naming only the project.', kind: 'fact', tags: ['Ops', 'Deploy'] })], owner)
    const id = text(saved.get(1)).memory_id as string
    expect(metadataOf(id)).toEqual({ tags: ['ops', 'deploy'] })

    const log = join(temp.dir, 'logs-tag-wipe', 'activity.jsonl')
    const wipe = await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, tags: ['My Repo', 'my-repo'] })], owner, log)
    expect(wipe.get(1).error.code).toBe(-32602)
    expect(wipe.get(1).error.message).toContain('none of those tags can be stored')
    expect(wipe.get(1).error.message).toContain('tags: []')
    expect(wipe.get(1).result).toBeUndefined()
    expect(metadataOf(id)).toEqual({ tags: ['ops', 'deploy'] })
    expect(logLines(log)[0]).toMatchObject({ action: 'update', ok: false, text: '' })

    // punctuation and blanks clean away too, and are refused the same way
    const punct = await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, tags: ['!!!', '  '] })], owner)
    expect(punct.get(1).error.code).toBe(-32602)
    expect(metadataOf(id)).toEqual({ tags: ['ops', 'deploy'] })

    // a mix keeps the rest; tags [] is the way to remove
    const mix = await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, tags: ['My Repo', 'Release'] })], owner)
    expect(text(mix.get(1)).status).toBe('updated')
    expect(metadataOf(id)).toEqual({ tags: ['release'] })
    const removed = await proxy(cli, store, [toolCall(1, 'memory_update', { memory_id: id, tags: [] })], owner)
    expect(text(removed.get(1)).status).toBe('updated')
    expect(metadataOf(id)).toEqual({})
    // the global owner has no project name to drop, so 'my-repo' is an ordinary tag there
    const globalSaved = await proxy(cli, store, [toolCall(1, 'memory_remember', { content: 'A global note that keeps an ordinary my-repo tag.', kind: 'fact', tags: ['My Repo'] })], 'global')
    expect(metadataOf(text(globalSaved.get(1)).memory_id)).toEqual({ tags: ['my-repo'] })
  })

  test('memory_update refused on a stale engine logs ok false', async () => {
    const log = join(temp.dir, 'logs-3', 'activity.jsonl')
    const pkgPath = join(engine, 'node_modules', '@oh-my-pi', 'pi-mnemopi', 'package.json')
    const original = readFileSync(pkgPath, 'utf8')
    writeFileSync(pkgPath, original.replace(`"version": "${ENGINE_BUILD}"`, '"version": "18.12.3"'))
    try {
      // A tag object whose toString is not a function: String() on it throws.
      const replies = await proxy(
        cli,
        store,
        [toolCall(1, 'memory_update', { memory_id: 'x', tags: ['a'] }), toolCall(2, 'memory_update', { memory_id: 'x', tags: [{ toString: 1 }, 'b'] }), toolCall(3, 'memory_stats', {})],
        'global',
        log,
      )
      // the log never breaks the proxy: every call still gets its reply (review r1 LOW 7)
      expect(replies.get(2).error.message).toContain(`needs the Mnemosyne engine build ${ENGINE_BUILD}`)
      expect(text(replies.get(3)).status).toBe('ok')
    } finally {
      writeFileSync(pkgPath, original)
    }
    const [line, hostile] = logLines(log)
    expect(line).toMatchObject({ action: 'update', origin: 'external', ok: false, text: 'tags: a' })
    expect(line.error).toContain(`needs the Mnemosyne engine build ${ENGINE_BUILD}`)
    expect(hostile).toMatchObject({ action: 'update', ok: false, text: 'tags: b' })
  })

  test('a log that cannot be written never changes what the client receives', async () => {
    const blocker = join(temp.dir, 'not-a-folder')
    writeFileSync(blocker, 'x')
    const messages = [
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      toolCall(2, 'memory_stats', {}),
      toolCall(3, 'memory_forget', { memory_id: 'no-such-memory' }),
      toolCall(4, 'memory_update', { memory_id: 'x', tags: 'bad' }),
      toolCall(5, 'memory_sleep', {}),
    ]
    const off = await proxy(cli, store, messages)
    const broken = await proxy(cli, store, messages, 'global', join(blocker, 'activity.jsonl'))
    const working = await proxy(cli, store, messages, 'global', join(temp.dir, 'logs-4', 'activity.jsonl'))
    const json = (replies: Map<unknown, unknown>) => JSON.stringify([...replies.entries()].sort())
    expect(json(broken)).toBe(json(off))
    expect(json(working)).toBe(json(off))
    expect(logLines(join(temp.dir, 'logs-4', 'activity.jsonl')).length).toBe(3)
  })
})

// CTX.2: the proxy reads clientInfo from initialize, forwards the request byte for byte, and
// stamps the client on every external line. A fake engine records the forwarded bytes; the proxy
// is the real one over stdio.
describe('CTX.2: the client names itself at initialize', () => {
  const temp = tempDir('proxy-client')
  const capture = join(temp.dir, 'forwarded.txt')
  // The proxy reads the installed build from <engine>/package.json beside src/ (a save is refused on any other build), so the stand-in sits where an engine does.
  const fakeEngine = join(temp.dir, 'engine', 'src', 'fake-engine.ts')
  mkdirSync(join(temp.dir, 'engine', 'src'), { recursive: true })
  writeFileSync(join(temp.dir, 'engine', 'package.json'), JSON.stringify({ name: '@oh-my-pi/pi-mnemopi', version: ENGINE_BUILD }))
  // The engine edge: records each forwarded line verbatim and answers so the proxy can exit.
  writeFileSync(fakeEngine, `
import { appendFileSync } from 'node:fs'
const out = process.env.MNEMOSYNE_CAPTURE as string
const decoder = new TextDecoder()
let buffer = ''
for await (const chunk of Bun.stdin.stream()) {
  buffer += decoder.decode(chunk, { stream: true })
  let end: number
  while ((end = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, end)
    buffer = buffer.slice(end + 1)
    appendFileSync(out, line + '\\n')
    let message: any
    try { message = JSON.parse(line) } catch { continue }
    if (message?.id === undefined) continue
    if (message.method === 'initialize') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'mnemopi', version: 'x' } } }) + '\\n')
    } else if (message.method === 'tools/call') {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: '{"results":[]}' }] } }) + '\\n')
    } else if (message.method === 'tools/list') {
      const tool = (name: string) => ({ name: 'mnemopi_' + name, description: 'Mnemopi ' + name, inputSchema: { type: 'object', properties: { content: { type: 'string' } } } })
      const tools = ['remember', 'recall', 'update', 'forget', 'stats', 'get', 'knowledge_prompt', 'knowledge_store'].map(tool)
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools } }) + '\\n')
    }
  }
}
`)
  afterAll(() => temp.dispose())

  const readLog = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) : [])

  /** The real proxy over raw stdin bytes; returns its forwarded lines, its replies to the client, and the activity lines it wrote. */
  async function rawProxy(stdin: string, log: string) {
    writeFileSync(capture, '')
    const child = Bun.spawn([process.execPath, PROXY], {
      env: {
        ...(process.env as Record<string, string>),
        ...isolatedEnv(),
        ...engineEnv(join(temp.dir, 'store'), 'global'),
        MNEMOSYNE_CLI: fakeEngine,
        MNEMOSYNE_ACTIVITY_LOG: log,
        MNEMOSYNE_CAPTURE: capture,
      },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    child.stdin.write(stdin)
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
    return { forwarded: readFileSync(capture, 'utf8'), replies, log: readLog(log) }
  }

  const initialize = (clientInfo?: object) =>
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, ...(clientInfo ? { clientInfo } : {}) } })
  const recall = (id = 2) => JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'memory_recall', arguments: { query: 'heron' } } })

  test('CTX.2.a1: initialize is forwarded byte for byte', async () => {
    const line = '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "codex-mcp-client", "version": "1.0.0"}}}'
    const { forwarded } = await rawProxy(`${line}\n${recall()}\n`, join(temp.dir, 'logs-a1', 'activity.jsonl'))
    const first = forwarded.split('\n')[0]
    expect(first).toBe(line)
  })

  test('CTX.2.a3: clientInfo.name is stamped on the next recall line', async () => {
    const log = join(temp.dir, 'logs-a3', 'activity.jsonl')
    const { log: lines } = await rawProxy(`${initialize({ name: 'codex-mcp-client', version: '1.0.0' })}\n${recall()}\n`, log)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ action: 'recall', origin: 'external', client: 'codex-mcp-client' })
  })

  test('CTX.2.a2: a client that sends no clientInfo is logged as unknown', async () => {
    const log = join(temp.dir, 'logs-a2', 'activity.jsonl')
    const { log: lines } = await rawProxy(`${initialize()}\n${recall()}\n`, log)
    expect(lines[0]).toMatchObject({ action: 'recall', client: 'unknown' })
  })

  test('review 2 LOW 3: an empty name with a version is logged as unknown, never the version', async () => {
    const log = join(temp.dir, 'logs-version', 'activity.jsonl')
    const { log: lines } = await rawProxy(`${initialize({ name: '   ', version: '9.9.9' })}\n${recall()}\n`, log)
    expect(lines[0]).toMatchObject({ action: 'recall', client: 'unknown' })
    const named = join(temp.dir, 'logs-named', 'activity.jsonl')
    const { log: namedLines } = await rawProxy(`${initialize({ name: 'codex-mcp-client', version: '9.9.9' })}\n${recall()}\n`, named)
    expect(namedLines[0]).toMatchObject({ client: 'codex-mcp-client' })
  })

  // KNOWX.2.a8: the proxy offers only the five memory_* tools, so an external agent can never
  // reach the engine's own knowledge extraction, and a remember it forwards is authored by the
  // client that named itself at initialize.
  const remember = (id = 2) =>
    JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'memory_remember', arguments: { content: 'a heron waded here', kind: 'fact' } } })
  /** The params.arguments the engine actually received for the tools/call with `id`. */
  const forwardedCall = (forwarded: string, id: number) =>
    forwarded
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line))
      .find(message => message?.method === 'tools/call' && message?.id === id)?.params?.arguments

  test('KNOWX.2.a8: tools/list through the proxy shows only the five memory_* tools, never the engine knowledge tools', async () => {
    const { replies, forwarded } = await rawProxy(
      `${initialize({ name: 'codex-mcp-client', version: '1.0.0' })}\n${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' })}\n`,
      join(temp.dir, 'logs-a8-list', 'activity.jsonl'),
    )
    const tools = replies.get(2).result.tools as { name: string }[]
    const names = tools.map(tool => tool.name).sort()
    expect(names).toEqual(['memory_forget', 'memory_recall', 'memory_remember', 'memory_stats', 'memory_update'])
    expect(names).not.toContain('mnemopi_knowledge_prompt')
    expect(names).not.toContain('mnemopi_knowledge_store')
    // The list the client saw came from the fake engine's eight tools, knowledge ones included.
    const listed = forwarded
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line))
      .find(message => message?.method === 'tools/list')
    expect(listed).toMatchObject({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  })

  test('KNOWX.2.a8: a forwarded remember is authored by the client, or unknown without clientInfo', async () => {
    const named = await rawProxy(
      `${initialize({ name: 'codex-mcp-client', version: '1.0.0' })}\n${remember()}\n`,
      join(temp.dir, 'logs-a8-author', 'activity.jsonl'),
    )
    expect(forwardedCall(named.forwarded, 2)).toMatchObject({ author_type: 'agent', author_id: 'codex-mcp-client' })

    const anonymous = await rawProxy(`${initialize()}\n${remember()}\n`, join(temp.dir, 'logs-a8-unknown', 'activity.jsonl'))
    expect(forwardedCall(anonymous.forwarded, 2)).toMatchObject({ author_type: 'agent', author_id: 'unknown' })
  })

  // FINAL R1: the self-declared name is stamped into author_id on every save, so it is bounded to 60
  // code points with control characters removed, as the activity line bounds it.
  test('FINAL.2: a 1 MB or control-character client name arrives bounded and clean in author_id', async () => {
    const huge = await rawProxy(
      `${initialize({ name: 'x'.repeat(1_000_000), version: '1' })}\n${remember()}\n`,
      join(temp.dir, 'logs-final-huge', 'activity.jsonl'),
    )
    const hugeAuthor = forwardedCall(huge.forwarded, 2).author_id as string
    expect(hugeAuthor).toBe('x'.repeat(60))
    expect(huge.log[0]).toMatchObject({ action: 'remember', origin: 'external', client: 'x'.repeat(60) })

    const dirty = await rawProxy(
      `${initialize({ name: '\u202ecodex\u0000\n\u200b-client\u007f', version: '1' })}\n${remember()}\n`,
      join(temp.dir, 'logs-final-control', 'activity.jsonl'),
    )
    expect(forwardedCall(dirty.forwarded, 2).author_id).toBe('codex-client')
    expect(dirty.log[0]).toMatchObject({ client: 'codex-client' })

    // 100 emoji (one code point each, two UTF-16 units) are cut on a code point, never mid-pair.
    const wide = await rawProxy(`${initialize({ name: '😀'.repeat(100) })}\n${remember()}\n`, join(temp.dir, 'logs-final-wide', 'activity.jsonl'))
    expect(forwardedCall(wide.forwarded, 2).author_id).toBe('😀'.repeat(60))

    // A name of only control characters names nothing: the client stays unknown.
    const empty = await rawProxy(`${initialize({ name: '\u0000\u202e ' })}\n${remember()}\n`, join(temp.dir, 'logs-final-empty', 'activity.jsonl'))
    expect(forwardedCall(empty.forwarded, 2).author_id).toBe('unknown')
  })
})

// META.1: hooks/kinds.ts is import-free and names engine memory types.
describe('hooks/kinds.ts', () => {
  test('META.1.a1: it imports nothing, and every kind is one of the engine\'s own memory types', async () => {
    const source = readFileSync(join(ROOT, 'hooks', 'kinds.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*import|^\s*export.*\sfrom\s|require\(/m)
    const { KIND_NAMES } = await import('../../hooks/kinds')
    const engine = readFileSync(join(ROOT, 'engine', 'src', 'core', 'typed-memory.ts'), 'utf8')
    for (const name of KIND_NAMES) expect(engine).toContain(`"${name}"`)
    expect(KIND_NAMES.length).toBe(8)
  })
})
