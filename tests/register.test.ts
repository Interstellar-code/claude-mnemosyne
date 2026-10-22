import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ProcessRunInit, SessionCompactResult } from 'claude-code'
import { afterTerm } from '../hooks/register'
import { engineTool, mnemosyneStats, publicTool } from '../hooks/surface'

type Run = { argv: readonly string[]; init?: ProcessRunInit }

// The world beneath the plugin: an installed engine whose every call answers
// `reply`, and a record of each process run.
function world(on: On, reply: string, isInstalled = true) {
  const runs: Run[] = []
  on('env.get', () => ({ value: '/home/u' }))
  on('fs.stat', () => (isInstalled ? { value: { kind: 'file' } } : { deny: 'ENOENT' }) as never)
  on('session.id', () => ({ value: 's1' }))
  on('session.repo', () => ({ value: { root: '/work/My Repo' } }) as never)
  on('process.run', (_$, e) => {
    runs.push(e)
    const ids = (e.init?.stdin ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line).id)
    const stdout = ids.map(id => `${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: reply }] } })}\n`).join('')
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  return runs
}

const request = (run: Run) => JSON.parse(run.init?.stdin ?? '{}').params

test('remember runs the private engine against the private store, global bank', async ($, on) => {
  const runs = world(on, '{"status":"stored"}')
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content: 'fact' })

  expect(ran.result).toBe('{"status":"stored"}')
  const run = runs[0]!
  expect(run.argv).toEqual(['bun', '/home/u/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts', 'mcp'])
  expect(run.init?.env).toEqual({
    MNEMOPI_DATA_DIR: '/home/u/.claude/mnemosyne/store',
    MNEMOPI_SESSION_ID: 'global',
    MNEMOPI_CHANNEL_ID: 'global',
    MNEMOPI_NO_EMBEDDINGS: '1',
    MNEMOPI_MCP_BANK: '',
    MNEMOPI_LLM_BASE_URL: '',
    MNEMOPI_HOST_LLM_ENABLED: '',
  })
  // `imported`: the durable tier the engine's 24h working-memory trim skips.
  expect(request(run)).toEqual({
    name: 'mnemopi_remember',
    arguments: { content: 'fact', importance: 0.5, source: 'imported', scope: 'global' },
  })
})

test('per-project keeps a repo bank and still writes global on request', { options: { scope: 'per-project' } }, async ($, on) => {
  const runs = world(on, '{}')
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content: 'local' })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content: 'shared', global: true })

  expect(runs[0]!.init?.env?.MNEMOPI_SESSION_ID).toMatch(/^project-My-Repo-[0-9a-z]+$/)
  expect(runs[0]!.init?.env?.MNEMOPI_CHANNEL_ID).toBe(runs[0]!.init?.env?.MNEMOPI_SESSION_ID)
  expect(request(runs[0]!).arguments.scope).toBe('channel')
  expect(request(runs[1]!).arguments.scope).toBe('global')
})

test('first prompt of a session gets recalled memories as context, later prompts do not', async ($, on) => {
  const runs = world(on, JSON.stringify({ results: [{ id: 'm1', session_id: 'global', content: 'use pnpm' }] }))
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_$, e) => {
    seen.push(e.context)
    return { text: e.text, context: e.context }
  })

  await $.prompt.submit({ text: 'How do I install deps? Then run the build.' } as never)
  await $.prompt.submit({ text: 'again' } as never)

  // One process, one recall per sentence; the shared row is listed once.
  expect(runs.length).toBe(1)
  const queries = (runs[0]!.init?.stdin ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line).params.arguments.query)
  expect(queries).toEqual(['How do I install deps?', 'Then run the build.'])
  expect(seen[0]?.at(-1)?.match(/use pnpm/g)?.length).toBe(1)
  expect(seen[0]?.at(-1)).toContain('- [m1 owner=global] use pnpm')
  expect(seen[1]).toBeUndefined()
})

const summary = { role: 'user' as const, text: 'summary', toolUses: [] }

// Prompt, compact (the core step beneath answers `core`), prompt: how many recalls ran.
async function recallsAfter($: Engine, on: On, core: SessionCompactResult, args: object = {}, trigger = 'manual') {
  const runs = world(on, JSON.stringify({ results: [{ id: 'm1', session_id: 'global', content: 'use pnpm' }] }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  on('session.compact', () => core)

  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  await $.session.compact({ trigger, messages: [summary], ...args } as never)
  await $.prompt.submit({ text: 'again' } as never)
  return runs.length
}

test('a compaction of the main conversation lets the next prompt recall again', async ($, on) => {
  expect(await recallsAfter($, on, { messages: [summary] })).toBe(2)
})

test('a precompute does not recall again: it installs nothing', async ($, on) => {
  expect(await recallsAfter($, on, { messages: [summary] }, {}, 'precompute')).toBe(1)
})

test('a skipped compaction does not recall again', async ($, on) => {
  expect(await recallsAfter($, on, { skip: 'off' })).toBe(1)
})

test('a subagent\'s compaction does not recall again', async ($, on) => {
  expect(await recallsAfter($, on, { messages: [summary] }, { agentId: 'a1' })).toBe(1)
})

test('recall hands the model only id, owner, content, scope and time, limit clamped', async ($, on) => {
  const row = { id: 'm1', session_id: 'global', content: 'c', scope: 'global', timestamp: 't', score: 0.4, tier: 'working' }
  const runs = world(on, JSON.stringify({ count: 1, results: [row] }))
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_recall', query: 'c', limit: 10_000 })

  expect(JSON.parse(ran.result as string)).toEqual([{ id: 'm1', owner: 'global', content: 'c', scope: 'global', timestamp: 't' }])
  expect(request(runs[0]!).arguments.limit).toBe(50)
})

test('forget deletes as the owner it is given', { options: { scope: 'per-project' } }, async ($, on) => {
  const runs = world(on, '{"status":"deleted"}')
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_forget', memory_id: 'm1', owner: 'project-Other-abc' })

  expect(runs[0]!.init?.env?.MNEMOPI_SESSION_ID).toBe('project-Other-abc')
  expect(request(runs[0]!)).toEqual({ name: 'mnemopi_forget', arguments: { memory_id: 'm1' } })
})

test('a store inside ~/.omp is refused before any engine run', { options: { memoryDir: '~/.omp/agent/memories/store' } }, async ($, on) => {
  const runs = world(on, '{}')
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_stats' })

  expect(ran.deny).toBe('Mnemosyne: memoryDir must not be inside ~/.omp.')
  expect(runs.length).toBe(0)
})

test('a relative store is refused', { options: { memoryDir: 'store' } }, async ($, on) => {
  world(on, '{}')
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_stats' })

  expect(ran.deny).toContain('memoryDir must be absolute')
})

test('without the engine the tools say to run setup', async ($, on) => {
  const runs = world(on, '{}', false)
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_recall', query: 'x' })

  expect(ran.deny).toContain('/mnemosyne-setup')
  expect(runs.length).toBe(0)
})

test('the rules section rides last on the session side, only where the tools are offered', async ($, on) => {
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'engine', scope: 'shared' }] }))
  const base = { model: 'm', promptModel: 'm', surfaces: [], outputStyle: null }
  const offered = await $.prompt.compose({ ...base, tools: ['mcp__mnemosyne__memory_remember'], traits: [] } as never)
  const bare = await $.prompt.compose({ ...base, tools: ['mcp__mnemosyne__memory_remember'], traits: ['bare'] } as never)
  const without = await $.prompt.compose({ ...base, tools: [], traits: [] } as never)

  expect(offered.sections.at(-1)).toMatchObject({ id: 'mnemosyne:rules', scope: 'session' })
  expect(bare.sections.some(s => s.id === 'mnemosyne:rules')).toBe(false)
  expect(without.sections.some(s => s.id === 'mnemosyne:rules')).toBe(false)
})

test('terms match at the start, as whole words, longest first', () => {
  const list = ['remember that', 'remember', 'note that']
  expect(afterTerm('Remember that we use pnpm', list)).toBe('we use pnpm')
  expect(afterTerm('please remember: tabs', list)).toBe(': tabs'.replace(/^[\s:,]+/, ''))
  expect(afterTerm('remembering the past', list)).toBeUndefined()
  expect(afterTerm('I do not remember that', list)).toBeUndefined()
})

test('a remember term asks the model to save once; a recall term recalls on that prompt', async ($, on) => {
  const runs = world(on, JSON.stringify({ results: [{ id: 'm1', session_id: 'global', content: 'use pnpm' }] }))
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_$, e) => {
    seen.push(e.context)
    return { text: e.text, context: e.context }
  })

  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as never) // first prompt: auto-recall
  await $.prompt.submit({ text: 'remember that we deploy on Fridays', origin: { kind: 'composer' } } as never)
  await $.prompt.submit({ text: 'what do you remember about pnpm? answer briefly.', origin: { kind: 'composer' } } as never)
  await $.prompt.submit({ text: 'remember that x', origin: { kind: 'plugin', plugin: 'other' } } as never)

  expect(seen[1]?.at(-1)).toContain('memory_remember exactly once')
  expect(seen[1]?.at(-1)).toContain('we deploy on Fridays')
  expect(runs.length).toBe(2) // first-prompt recall + the recall term; the remember term stores nothing itself
  expect(request(runs[1]!).arguments.query).toBe('pnpm')
  expect(seen[2]?.at(-1)).toContain('- [m1 owner=global] use pnpm')
  expect(seen[3]).toBeUndefined()
})

test('externalMcp writes an owner-only stdio wrapper', { options: { externalMcp: true, memoryDir: "~/it's mine" } }, async ($, on) => {
  const runs = world(on, '{}')
  on('command.register', () => ({ value: {} }) as never)
  on('tool.register', () => ({ value: {} }) as never)
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)

  const write = runs.find(r => r.argv[2]?.includes('writeFileSync'))
  expect(write?.argv[3]).toBe('/home/u/.claude/mnemosyne/bin/mnemosyne-mcp')
  const wrapper = { text: write?.argv[4] }
  expect(wrapper.text).toContain(`export MNEMOPI_DATA_DIR='/home/u/it'\\''s mine'`)
  expect(wrapper.text).toContain('MNEMOPI_NO_EMBEDDINGS=1')
  expect(wrapper.text).toContain('export MNEMOPI_LLM_BASE_URL=')
  expect(wrapper.text).toMatch(/exec bun '.*\/bin\/mcp-proxy\.ts'/)
  // Folder work runs through `bun -e`: the code, then its path arguments.
  const fsRuns = runs.filter(r => r.argv[1] === '-e').map(r => ({ code: r.argv[2]!, args: r.argv.slice(3) }))
  expect(fsRuns.some(r => r.code.includes('chmodSync(d, 0o700)') && r.args.join('|') === "/home/u/.claude/mnemosyne|/home/u/it's mine")).toBe(true)
  expect(write?.argv[2]).toContain('chmodSync(a[0], 0o700)')
})

test('without externalMcp the wrapper is removed', async ($, on) => {
  const runs = world(on, '{}')
  on('command.register', () => ({ value: {} }) as never)
  on('tool.register', () => ({ value: {} }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)

  expect(runs.some(r => r.argv[2]?.includes('rmSync') && r.argv[3] === '/home/u/.claude/mnemosyne/bin/mnemosyne-mcp')).toBe(true)
})

test('on Windows: USERPROFILE home, a .cmd wrapper, no chmod', { options: { externalMcp: true } }, async ($, on) => {
  const runs: { argv: readonly string[] }[] = []
  on('env.get', (_$, e) => ({ value: ({ OS: 'Windows_NT', USERPROFILE: 'C:\\Users\\u' } as Record<string, string>)[(e as { name: string }).name] }))
  on('fs.stat', () => ({ value: { kind: 'file' } }) as never)
  on('process.run', (_$, e) => {
    runs.push(e)
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('command.register', () => ({ value: {} }) as never)
  on('tool.register', () => ({ value: {} }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: 'C:\\w', surface: null, isInteractive: false } as never)

  const write = runs.find(r => r.argv[2]?.includes('writeFileSync'))
  expect(write?.argv[3]).toBe('C:/Users/u/.claude/mnemosyne/bin/mnemosyne-mcp.cmd')
  expect(write?.argv[4]).toContain('set "MNEMOPI_DATA_DIR=C:/Users/u/.claude/mnemosyne/store"')
  expect(write?.argv[4]?.startsWith('@echo off')).toBe(true)
  expect(runs.some(r => (r.argv[2] ?? '').includes('chmodSync'))).toBe(false)
})

test('empty terms use the defaults; none turns them off', { options: { rememberTerms: ['none'] } }, async ($, on) => {
  world(on, '{"results":[]}')
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_$, e) => {
    seen.push(e.context)
    return { text: e.text, context: e.context }
  })
  await $.prompt.submit({ text: 'remember that x', origin: { kind: 'composer' } } as never)

  expect(seen[0]?.some(c => c.includes('memory_remember exactly once')) ?? false).toBe(false)
})

test('a list stored as one comma-joined string still splits into terms', { options: { rememberTerms: ['remember that, note that'] } }, async ($, on) => {
  // `claude plugin configure` stores a list this way.
  world(on, '{"results":[]}')
  const seen: (readonly string[] | undefined)[] = []
  on('prompt.submit', (_$, e) => {
    seen.push(e.context)
    return { text: e.text, context: e.context }
  })
  await $.prompt.submit({ text: 'note that tabs win', origin: { kind: 'composer' } } as never)

  expect(seen[0]?.some(c => c.includes('memory_remember exactly once') && c.includes('tabs win'))).toBe(true)
})

test('setup fills only blank settings, through claude plugin configure', async ($, on) => {
  const runs: { argv: readonly string[]; init?: ProcessRunInit }[] = []
  on('env.get', () => ({ value: '/home/u' }))
  on('fs.stat', () => ({ value: { kind: 'file' } }) as never)
  on('session.id', () => ({ value: 's1' }))
  on('process.run', (_$, e) => {
    runs.push(e)
    const argv = e.argv.join(' ')
    if (argv.endsWith('--json')) {
      return { value: { exitCode: 0, stdout: JSON.stringify({ inputs: { memoryDir: '/mine', rememberTerms: '', recallTerms: ' ' } }), stderr: '' } } as never
    }
    const stdout = `${JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: '{}' }] } })}\n`
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('fs.write', () => ({ value: undefined }))
  const ran = await $.command.run({ command: 'mnemosyne-setup', args: '' } as never)

  const save = runs.find(r => r.argv.includes('--values-stdin'))
  expect(save?.argv.slice(0, 4)).toEqual(['claude', 'plugin', 'configure', 'mnemosyne@mnemosyne'])
  expect(JSON.parse(save?.init?.stdin ?? '{}')).toEqual({
    rememberTerms: 'remember:, remember that, note that, save to memory',
    recallTerms: 'recall:, what do you remember about, check memory',
  })
  expect((ran as { text?: string }).text).toContain('Saved defaults for rememberTerms, recallTerms')
})

test('stats say Mnemosyne, keep the counts, and pass non-JSON through', async ($, on) => {
  world(on, '{"status":"ok","provider":"mnemopi","bank":"default","working":{"n":2},"episodic":{"n":1},"memoria":{},"stats":{}}')
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_stats' })

  expect(JSON.parse(ran.result as string)).toEqual({ status: 'ok', provider: 'mnemosyne', working: { n: 2 }, episodic: { n: 1 }, memoria: {} })
  expect(mnemosyneStats('not json')).toBe('not json')
  expect(mnemosyneStats('{"status":"error","message":"boom"}')).toBe('{"status":"error","message":"boom"}')
})

test('the proxy maps public memory_* names to the engine and back', async () => {
  expect(engineTool('memory_recall')).toBe('mnemopi_recall')
  expect(publicTool('mnemopi_stats')).toBe('memory_stats')
  expect(publicTool('mnemopi_shared_stats')).toBe('memory_shared_stats') // still refused: not in the proxy's allowed set
})
