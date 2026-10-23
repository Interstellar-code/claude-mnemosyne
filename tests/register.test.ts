import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ProcessRunInit, SessionCompactResult } from 'claude-code'
import { afterTerm, ENGINE_BUILD, ENGINE_VERSION } from '../hooks/register'
import { ENGINE_BUILD as BUILD_FILE, INSTALL_CHECK_TIMEOUT_MS, INSTALL_STEP_TIMEOUT_MS, SETUP_TIMEOUT_MS } from '../hooks/engine-build'
import { engineTool, mnemosyneStats, publicTool } from '../hooks/surface'

type Run = { argv: readonly string[]; init?: ProcessRunInit; via?: 'run' | 'spawn' }

const INSTALLED_PACKAGE = '/home/u/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/package.json'

const ACTIVITY_LOG = '/home/u/.claude/mnemosyne/activity.jsonl'
const isAppend = (argv: readonly string[]) => (argv[1] ?? '').endsWith('/bin/activity.ts')

// The world beneath the plugin: an installed engine of build `build` whose
// every call answers `reply`, and a record of each process run. Activity log
// appends (`bun bin/activity.ts <log>`, by $.process.spawn or $.process.run) are
// kept apart, in `runs.appends`, with `via` and the lines as `init.stdin`;
// `extra.append` makes each append hang forever or throw, `extra.env` sets variables.
type Extra = { append?: 'ok' | 'hang' | 'throw'; env?: Record<string, string> }
function world(on: On, reply: string, isInstalled = true, exitCode = 0, build: string = ENGINE_BUILD, extra: Extra = {}) {
  const runs: Run[] & { appends: Run[] } = Object.assign([] as Run[], { appends: [] as Run[] })
  on('env.get', (_$, e) => ({ value: extra.env?.[(e as { name: string }).name] ?? '/home/u' }))
  on('fs.stat', () => (isInstalled ? { value: { kind: 'file' } } : { deny: 'ENOENT' }) as never)
  on('fs.read', (_$, e) => (e.path === INSTALLED_PACKAGE && isInstalled ? { value: JSON.stringify({ name: '@oh-my-pi/pi-mnemopi', version: build }) } : { deny: 'ENOENT' }) as never)
  on('session.id', () => ({ value: 's1' }))
  on('session.repo', () => ({ value: { root: '/work/My Repo' } }) as never)
  on('process.run', (_$, e) => {
    if (isAppend(e.argv)) {
      runs.appends.push({ ...e, via: 'run' })
      if (extra.append === 'hang') return new Promise(() => {}) as never
      if (extra.append === 'throw') throw new Error('append failed')
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    }
    runs.push(e)
    const ids = (e.init?.stdin ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line).id)
    const stdout = exitCode !== 0 ? '' : ids.map(id => `${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: reply }] } })}\n`).join('')
    return { value: { exitCode, stdout, stderr: '' } } as never
  })
  on('process.spawn', async function* (_$: unknown, e: { argv: readonly string[]; input?: string }) {
    runs.appends.push({ argv: e.argv, init: { stdin: e.input }, via: 'spawn' })
    if (extra.append === 'hang') await new Promise(() => {})
    if (extra.append === 'throw') throw new Error('append failed')
    return { value: { code: 0, signal: null } }
  } as never)
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

// The UI lines a prompt and a compaction raise, for each showActivity mode.
function activityWorld(on: On, exitCode = 0) {
  const logs: string[] = []
  const statuses: (string | undefined)[] = []
  world(on, JSON.stringify({ results: [{ id: 'm1', session_id: 'global', content: 'use pnpm' }] }), true, exitCode)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  on('ui.log', (_$, e) => { logs.push(e.text); return { value: undefined } })
  on('ui.status', (_$, e) => { statuses.push(e.text); return { value: undefined } })
  return { logs, statuses }
}

test('showActivity on: a dim line with the count, and a status line', async ($, on) => {
  const { logs, statuses } = activityWorld(on)
  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  expect(logs).toEqual(['Mnemosyne: recalled 1 memory for this prompt'])
  expect(statuses).toEqual(['Mnemosyne · recalled 1'])
})

test('showActivity status: the status line only', { options: { showActivity: 'status' } }, async ($, on) => {
  const { logs, statuses } = activityWorld(on)
  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  expect(logs).toEqual([])
  expect(statuses).toEqual(['Mnemosyne · recalled 1'])
})

test('showActivity off: silent', { options: { showActivity: 'off' } }, async ($, on) => {
  const { logs, statuses } = activityWorld(on)
  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  expect(logs).toEqual([])
  expect(statuses).toEqual([])
})

test('a compaction says it will recall again', async ($, on) => {
  const { logs } = activityWorld(on)
  on('session.compact', () => ({ messages: [summary] }))
  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  await $.session.compact({ trigger: 'manual', messages: [summary] } as never)
  expect(logs.at(-1)).toBe('Mnemosyne: conversation compacted; will recall again on the next prompt')
})

test('session start says memory is ready', async ($, on) => {
  const { logs, statuses } = activityWorld(on)
  on('command.register', () => ({ value: {} }) as never)
  on('tool.register', () => ({ value: {} }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)
  expect(logs).toEqual(['Mnemosyne: memory ready'])
  expect(statuses).toEqual(['Mnemosyne · ready'])
})

test('a recall term logs the topic, singular for one memory', async ($, on) => {
  const { logs, statuses } = activityWorld(on)
  await $.prompt.submit({ text: 'what do you remember about pnpm? and more', origin: { kind: 'composer' } } as never)
  expect(logs).toEqual(['Mnemosyne: recalled 1 memory for "pnpm"'])
  expect(statuses).toEqual(['Mnemosyne · recalled 1'])
})

test('an engine failure says recall failed, not found nothing', async ($, on) => {
  const { logs, statuses } = activityWorld(on, 1)
  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  expect(logs).toEqual(['Mnemosyne: recall failed'])
  expect(statuses).toEqual(['Mnemosyne · recall failed'])
})

// ENG.5 / ENG.6: the engine build, the staged setup, memory_update.

test('register.ts re-exports ENGINE_BUILD and keeps ENGINE_VERSION', () => {
  expect(ENGINE_BUILD).toBe(BUILD_FILE)
  expect(ENGINE_VERSION).toBe('18.12.3')
})

test('memory_update runs mnemopi_update as the given owner, tags cleaned into metadata', { options: { scope: 'per-project' } }, async ($, on) => {
  const runs = world(on, '{"status":"updated"}')
  const ran = await $.tool.call({
    tool: 'mcp__mnemosyne__memory_update',
    memory_id: 'm1',
    owner: 'project-Other-abc',
    content: 'new text',
    importance: 7,
    tags: [' Build ', 'build', 'CI', '', 'a-very-long-tag-name-that-goes-past-24', 'x', 'y', 'z'],
  })

  expect(ran.result).toBe('{"status":"updated"}')
  expect(runs[0]!.init?.env?.MNEMOPI_SESSION_ID).toBe('project-Other-abc')
  expect(request(runs[0]!)).toEqual({
    name: 'mnemopi_update',
    arguments: {
      memory_id: 'm1',
      content: 'new text',
      importance: 1,
      metadata: { tags: ['build', 'ci', 'a-very-long-tag-name-tha', 'x', 'y'] },
    },
  })
})

test('memory_update without tags sends no metadata; tags [] sends tags null', async ($, on) => {
  const runs = world(on, '{"status":"updated"}')
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_update', memory_id: 'm1', content: 'only text' })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_update', memory_id: 'm1', tags: [] })

  expect(request(runs[0]!).arguments).toEqual({ memory_id: 'm1', content: 'only text' })
  expect(request(runs[1]!).arguments).toEqual({ memory_id: 'm1', metadata: { tags: null } })
  // no owner given: this project's (global here)
  expect(runs[0]!.init?.env?.MNEMOPI_SESSION_ID).toBe('global')
})

test('memory_update with nothing to change, or tags that are not an array, is denied without an engine run', async ($, on) => {
  const runs = world(on, '{"status":"updated"}')
  const empty = await $.tool.call({ tool: 'mcp__mnemosyne__memory_update', memory_id: 'm1' })
  const bad = await $.tool.call({ tool: 'mcp__mnemosyne__memory_update', memory_id: 'm1', tags: 'build' })

  expect(empty.deny).toBe('Mnemosyne: memory_update needs content, importance or tags.')
  expect(bad.deny).toBe('Mnemosyne: tags must be an array of strings.')
  expect(runs.length).toBe(0)
})

test('on a stale engine memory_update is denied with /mnemosyne-setup, and the four other tools still run', async ($, on) => {
  const runs = world(on, '{"results":[]}', true, 0, '18.12.3')
  const update = await $.tool.call({ tool: 'mcp__mnemosyne__memory_update', memory_id: 'm1', tags: ['a'] })
  expect(update.deny).toContain('/mnemosyne-setup')
  expect(update.deny).toContain('out of date')
  expect(runs.length).toBe(0)

  await $.tool.call({ tool: 'mcp__mnemosyne__memory_recall', query: 'x' })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content: 'fact' })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_forget', memory_id: 'm1' })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_stats' })
  expect(runs.map(run => request(run).name)).toEqual(['mnemopi_recall', 'mnemopi_remember', 'mnemopi_forget', 'mnemopi_stats'])
})

// Session start in a world whose installed engine is `build`; the toasts it raised.
async function startWith($: Engine, on: On, build: string) {
  const toasts: string[] = []
  const tools: string[] = []
  world(on, '{}', true, 0, build)
  on('command.register', () => ({ value: {} }) as never)
  on('tool.register', (_$, e) => {
    tools.push((e as { name: string }).name)
    return { value: {} } as never
  })
  on('ui.toast', (_$, e) => {
    toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)
  return { toasts, tools }
}

test('session start: a stale engine gets a toast asking for /mnemosyne-setup, and all five tools register', async ($, on) => {
  const stale = await startWith($, on, '18.12.3')
  expect(stale.toasts.length).toBe(1)
  expect(stale.toasts[0]).toContain('/mnemosyne-setup')
  expect(stale.tools).toEqual(['memory_remember', 'memory_recall', 'memory_update', 'memory_forget', 'memory_stats'])
})

test('session start with the current engine raises no toast', async ($, on) => {
  const current = await startWith($, on, ENGINE_BUILD)
  expect(current.toasts).toEqual([])
})

test('setup installs the plugin\'s engine copy through install-engine.ts, never bun add', async ($, on) => {
  const runs = world(on, '{}')
  on('fs.write', () => ({ value: undefined }))
  const ran = await $.command.run({ command: 'mnemosyne-setup', args: '' } as never)

  const install = runs.find(r => (r.argv[1] ?? '').endsWith('/bin/install-engine.ts'))
  expect(install?.argv[0]).toBe('bun')
  expect(install?.argv[1]).toBe(`${install?.argv[2]}/bin/install-engine.ts`)
  expect(install?.argv.slice(3)).toEqual(['/home/u/.claude/mnemosyne/engine', '/home/u/.claude/mnemosyne/store'])
  expect(runs.some(r => r.argv.includes('add'))).toBe(false)
  // <root> and the store exist before the installer runs
  const secured = runs.findIndex(r => r.argv[1] === '-e' && (r.argv[2] ?? '').includes('mkdirSync(d'))
  expect(secured).toBeGreaterThanOrEqual(0)
  expect(secured).toBeLessThan(runs.indexOf(install!))
  expect((ran as { text?: string }).text).toContain('Mnemosyne ready. Engine: /home/u/.claude/mnemosyne/engine.')
})

test('a failed install says so and that the installed engine is unchanged', async ($, on) => {
  on('env.get', () => ({ value: '/home/u' }))
  on('process.run', (_$, e) => {
    if ((e.argv[1] ?? '').endsWith('/bin/install-engine.ts')) {
      return { value: { exitCode: 1, stdout: '', stderr: 'install-engine: bun install failed (exit 1): ConnectionRefused' } } as never
    }
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  const ran = await $.command.run({ command: 'mnemosyne-setup', args: '' } as never)

  expect((ran as { text?: string }).text).toContain('Engine install failed; the engine already installed (if any) is unchanged')
  expect((ran as { text?: string }).text).toContain('ConnectionRefused')
})

test('the rules text names memory_update: update by id and owner, forget only to delete, never a duplicate', async ($, on) => {
  const base = { model: 'm', promptModel: 'm', surfaces: [], outputStyle: null }
  on('prompt.compose', () => ({ sections: [] }))
  const composed = await $.prompt.compose({ ...base, tools: ['mcp__mnemosyne__memory_remember'], traits: [] } as never)
  const rules = composed.sections.find(s => s.id === 'mnemosyne:rules')?.text ?? ''

  expect(rules).toContain('memory_update')
  expect(rules).toContain('To change or tag a fact, update it by id and owner')
  expect(rules).toContain('memory_forget only to delete')
  expect(rules).toContain('Never save a duplicate')
  expect(rules).not.toContain('forget the old id and owner, then remember')
})

// Review r1 HIGH 1 and MED 3.

for (const memoryDir of ['~/.claude/mnemosyne/Engine/store', '~/.claude/mnemosyne/engine', '~/.claude/mnemosyne/ENGINE.old/s', '~/.claude/mnemosyne/store/../engine.next/x']) {
  test(`a store inside the engine folder (${memoryDir}) is refused, case ignored, before any engine run`, { options: { memoryDir } }, async ($, on) => {
    const runs = world(on, '{}')
    const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_stats' })

    expect(ran.deny).toBe('Mnemosyne: memoryDir must not be inside the engine folder (/home/u/.claude/mnemosyne/engine).')
    expect(runs.length).toBe(0)
  })
}

test('setup refuses a store inside the engine folder before running the installer', { options: { memoryDir: '~/.claude/mnemosyne/Engine/store' } }, async ($, on) => {
  const runs = world(on, '{}')
  const ran = await $.command.run({ command: 'mnemosyne-setup', args: '' } as never)

  expect((ran as { text?: string }).text).toBe('Mnemosyne setup failed: memoryDir must not be inside the engine folder (/home/u/.claude/mnemosyne/engine).')
  expect(runs.some(r => (r.argv[1] ?? '').endsWith('/bin/install-engine.ts'))).toBe(false)
})

test('a store next to the engine folder is still fine', { options: { memoryDir: '~/.claude/mnemosyne/engines-store' } }, async ($, on) => {
  const runs = world(on, '{}')
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_stats' })
  expect(runs[0]!.init?.env?.MNEMOPI_DATA_DIR).toBe('/home/u/.claude/mnemosyne/engines-store')
})

test('setup gives the installer the host limit, and the installer\'s own limits stay well below it', async ($, on) => {
  const runs = world(on, '{}')
  on('fs.write', () => ({ value: undefined }))
  await $.command.run({ command: 'mnemosyne-setup', args: '' } as never)

  const install = runs.find(r => (r.argv[1] ?? '').endsWith('/bin/install-engine.ts'))
  expect(install?.init?.timeoutMs).toBe(SETUP_TIMEOUT_MS)
  expect(INSTALL_STEP_TIMEOUT_MS + INSTALL_CHECK_TIMEOUT_MS).toBeLessThanOrEqual(SETUP_TIMEOUT_MS - 30_000)
})

// LOG.2 / LOG.3 / LOG.4: every memory call hands one activity line to `bun bin/activity.ts <log>`.

/** The activity lines each append carried, one array per append. */
const appended = (runs: { appends: Run[] }) => runs.appends.map(run => (run.init?.stdin ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line)))
const lines = (runs: { appends: Run[] }) => appended(runs).flat()

const RECALL_REPLY = JSON.stringify({ results: [{ id: 'm1', session_id: 'global', content: 'use pnpm' }, { id: 'm2', session_id: 'global', content: 'use bun' }] })

test('the first-prompt recall logs action recall, origin hook, its queries and result ids, through one detached spawn (the default)', async ($, on) => {
  const runs = world(on, RECALL_REPLY)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  await $.prompt.submit({ text: 'How do I install deps? Then run the build.' } as never)

  expect(runs.appends.length).toBe(1)
  const append = runs.appends[0]!
  expect(append.via).toBe('spawn')
  expect(append.argv[0]).toBe('bun')
  expect(append.argv[1]?.endsWith('/bin/activity.ts')).toBe(true)
  expect(append.argv[2]).toBe(ACTIVITY_LOG)
  const [line] = lines(runs)
  expect(line).toMatchObject({ action: 'recall', origin: 'hook', owner: 'global', text: 'How do I install deps? | Then run the build.', ids: ['m1', 'm2'], count: 2, ok: true })
  expect(line.error).toBeUndefined()
  expect(Number.isNaN(Date.parse(line.t))).toBe(false)
})

test('a recall term and a remember term log origin trigger', async ($, on) => {
  const runs = world(on, RECALL_REPLY)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as never) // first prompt: hook
  await $.prompt.submit({ text: 'recall: pnpm? and more', origin: { kind: 'composer' } } as never)
  await $.prompt.submit({ text: 'remember that we deploy on Fridays', origin: { kind: 'composer' } } as never)

  expect(lines(runs).map(l => [l.action, l.origin, l.text])).toEqual([
    ['recall', 'hook', 'hello'],
    ['recall', 'trigger', 'pnpm'],
    ['remember', 'trigger', 'we deploy on Fridays'],
  ])
})

test('a recall the engine fails logs ok false with the error', async ($, on) => {
  const runs = world(on, RECALL_REPLY, true, 1)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  expect(lines(runs)).toMatchObject([{ action: 'recall', origin: 'hook', ok: false, error: 'engine exited 1:', ids: [], count: 0 }])
})

test('each of the five tools logs origin tool, with its owner, ids and count', { options: { scope: 'per-project' } }, async ($, on) => {
  const runs = world(on, RECALL_REPLY)
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_recall', query: 'pnpm' })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content: 'we use pnpm' })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_update', memory_id: 'm1', owner: 'project-Other-abc', tags: ['Build', 'CI'] })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_forget', memory_id: 'm2', owner: 'project-Other-abc' })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_stats' })

  const got = lines(runs)
  expect(got.map(l => [l.action, l.origin, l.ok])).toEqual([
    ['recall', 'tool', true],
    ['remember', 'tool', true],
    ['update', 'tool', true],
    ['forget', 'tool', true],
    ['stats', 'tool', true],
  ])
  expect(got[0]).toMatchObject({ text: 'pnpm', ids: ['m1', 'm2'], count: 2 })
  expect(got[0].owner).toMatch(/^project-My-Repo-/)
  expect(got[1]).toMatchObject({ text: 'we use pnpm' })
  // tags as the engine gets them: cleaned, as the proxy logs them
  expect(got[2]).toMatchObject({ owner: 'project-Other-abc', ids: ['m1'], count: 1, text: 'tags: build, ci' })
  expect(got[3]).toMatchObject({ owner: 'project-Other-abc', ids: ['m2'], count: 1, text: '' })
})

test('a tool call the engine fails logs ok false and the error text', async ($, on) => {
  const failing = world(on, '{}', true, 1)
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content: 'fact' })
  expect(ran.deny).toContain('engine exited 1')
  expect(lines(failing)).toMatchObject([{ action: 'remember', origin: 'tool', ok: false, error: 'Mnemosyne: engine exited 1:' }])
})

test('an engine reply with an error, or not_found, logs ok false while the tool result is unchanged', async ($, on) => {
  const runs = world(on, '{"status":"not_found","memory_id":"m9","bank":"default"}')
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_forget', memory_id: 'm9' })
  expect(ran.result).toBe('{"status":"not_found","memory_id":"m9","bank":"default"}')
  expect(lines(runs)).toMatchObject([{ action: 'forget', ok: false, error: 'not_found' }])
})

test('a refused tool call logs ok false with the refusal', async ($, on) => {
  const runs = world(on, '{}', true, 0, '18.12.3')
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_update', memory_id: 'm1', tags: ['a'] })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_update', memory_id: 'm1' })
  const got = lines(runs)
  expect(got.map(l => [l.action, l.origin, l.ok])).toEqual([
    ['update', 'tool', false],
    ['update', 'tool', false],
  ])
  expect(got[0].error).toContain('Mnemosyne Memory engine is out of date')
  expect(got[1].error).toBe('Mnemosyne: memory_update needs content, importance or tags.')
})

test('a compaction logs action rearm, origin hook', async ($, on) => {
  const runs = world(on, RECALL_REPLY)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  on('session.compact', () => ({ messages: [summary] }))
  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  await $.session.compact({ trigger: 'manual', messages: [summary] } as never)
  expect(lines(runs).at(-1)).toMatchObject({ action: 'rearm', origin: 'hook', owner: 'global', ok: true })
})

const SECRETS = [
  'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz012345',
  'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  'AKIAIOSFODNN7EXAMPLE',
  'hunter2-Very-Secret',
  '0123456789abcdef0123456789abcdef01234567',
  'QmFzZTY0U2VjcmV0VmFsdWVUaGF0SXNMb25nRW5vdWdo',
]

test('text is redacted, then cut to 200 characters: no credential-shaped string reaches the line', async ($, on) => {
  const runs = world(on, '{"status":"stored","memory_id":"m7"}')
  const content = `deploy key ${SECRETS[0]} and token ${SECRETS[1]}, aws ${SECRETS[2]}, password=${SECRETS[3]}, sha ${SECRETS[4]}, blob ${SECRETS[5]}. ${'tail '.repeat(80)}`
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content })

  const line = runs.appends[0]!.init!.stdin!
  for (const secret of SECRETS) expect(line).not.toContain(secret)
  const [entry] = lines(runs)
  expect(entry.text).toContain('[redacted]')
  expect(entry.text.startsWith('deploy key [redacted] and token [redacted], aws [redacted], password=[redacted]')).toBe(true)
  expect(entry.text.length).toBeLessThanOrEqual(200)
})

// The default (spawn) and the run fallback: neither ever holds up or changes a hook.
for (const mode of ['spawn', 'run'] as const) {
  test(`${mode}: an append that never resolves leaves every hook result unchanged`, async ($, on) => {
    const runs = world(on, RECALL_REPLY, true, 0, ENGINE_BUILD, { append: 'hang', env: { MNEMOSYNE_ACTIVITY_APPEND: mode } })
    const seen: (readonly string[] | undefined)[] = []
    on('prompt.submit', (_$, e) => {
      seen.push(e.context)
      return { text: e.text, context: e.context }
    })
    on('session.compact', () => ({ messages: [summary] }))

    await $.prompt.submit({ text: 'How do I install deps?' } as never)
    const recall = await $.tool.call({ tool: 'mcp__mnemosyne__memory_recall', query: 'pnpm' })
    const compacted = await $.session.compact({ trigger: 'manual', messages: [summary] } as never)

    expect(seen[0]?.at(-1)).toContain('- [m1 owner=global] use pnpm')
    expect(JSON.parse(recall.result as string).map((r: { id: string }) => r.id)).toEqual(['m1', 'm2'])
    expect(compacted.messages).toEqual([summary])
    expect(runs.appends.map(a => a.via)).toEqual([mode, mode, mode]) // each append was started, none waited on
  })

  test(`${mode}: an append that throws leaves every hook result unchanged`, async ($, on) => {
    const runs = world(on, RECALL_REPLY, true, 0, ENGINE_BUILD, { append: 'throw', env: { MNEMOSYNE_ACTIVITY_APPEND: mode } })
    const seen: (readonly string[] | undefined)[] = []
    on('prompt.submit', (_$, e) => {
      seen.push(e.context)
      return { text: e.text, context: e.context }
    })
    await $.prompt.submit({ text: 'How do I install deps?' } as never)
    const recall = await $.tool.call({ tool: 'mcp__mnemosyne__memory_recall', query: 'pnpm' })

    expect(seen[0]?.at(-1)).toContain('- [m1 owner=global] use pnpm')
    expect(JSON.parse(recall.result as string).map((r: { id: string }) => r.id)).toEqual(['m1', 'm2'])
    expect(recall.deny).toBeUndefined()
    expect(runs.appends.map(a => a.via)).toEqual([mode, mode])
  })
}

test('activityLog off: no hook starts an append', { options: { activityLog: 'off' } }, async ($, on) => {
  const runs = world(on, RECALL_REPLY)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  on('session.compact', () => ({ messages: [summary] }))
  await $.prompt.submit({ text: 'How do I install deps?' } as never)
  await $.prompt.submit({ text: 'recall: pnpm', origin: { kind: 'composer' } } as never)
  await $.prompt.submit({ text: 'remember that x', origin: { kind: 'composer' } } as never)
  for (const tool of ['memory_recall', 'memory_remember', 'memory_update', 'memory_forget', 'memory_stats']) {
    await $.tool.call({ tool: `mcp__mnemosyne__${tool}`, query: 'q', content: 'c', memory_id: 'm1' })
  }
  await $.session.compact({ trigger: 'manual', messages: [summary] } as never)

  expect(runs.length).toBeGreaterThan(0) // the memory calls themselves still ran
  expect(runs.appends).toEqual([])
})

test('MNEMOSYNE_ACTIVITY_APPEND=await awaits the append, capped at 1 s', async ($, on) => {
  const runs = world(on, '{"status":"stored","memory_id":"m7"}', true, 0, ENGINE_BUILD, { env: { MNEMOSYNE_ACTIVITY_APPEND: 'await' } })
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content: 'fact' })
  expect(runs.appends.length).toBe(1)
  expect(runs.appends[0]!.init?.timeoutMs).toBe(1000)
})

test('MNEMOSYNE_ACTIVITY_APPEND=run starts an un-awaited $.process.run with a 5 s timeout instead', async ($, on) => {
  const runs = world(on, '{"status":"stored","memory_id":"m7"}', true, 0, ENGINE_BUILD, { env: { MNEMOSYNE_ACTIVITY_APPEND: 'run' } })
  const ran = await $.tool.call({ tool: 'mcp__mnemosyne__memory_remember', content: 'fact' })

  expect(ran.result).toBe('{"status":"stored","memory_id":"m7"}')
  expect(runs.appends.map(a => a.via)).toEqual(['run'])
  expect(runs.appends[0]!.argv[2]).toBe(ACTIVITY_LOG)
  expect(runs.appends[0]!.init?.timeoutMs).toBe(5000)
  expect(lines(runs)).toMatchObject([{ action: 'remember', origin: 'tool', ids: ['m7'], ok: true }])
})

test('a memory_* tool outside the five is not logged', async ($, on) => {
  const runs = world(on, '{}')
  await $.tool.call({ tool: 'mcp__mnemosyne__memory_sleep' })
  expect(runs.appends).toEqual([])
})

// LOG.3.a1 / LOG.4.a2: the wrapper hands the proxy the log path, or nothing when off.

async function wrapperText($: Engine, on: On) {
  const runs = world(on, '{}')
  on('command.register', () => ({ value: {} }) as never)
  on('tool.register', () => ({ value: {} }) as never)
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/w', surface: null, isInteractive: false } as never)
  return runs.find(r => r.argv[2]?.includes('writeFileSync'))?.argv[4] ?? ''
}

test('the sh wrapper exports MNEMOSYNE_ACTIVITY_LOG as <root>/activity.jsonl', { options: { externalMcp: true } }, async ($, on) => {
  expect(await wrapperText($, on)).toContain(`export MNEMOSYNE_ACTIVITY_LOG='${ACTIVITY_LOG}'\n`)
})

test('activityLog off: the wrapper\'s MNEMOSYNE_ACTIVITY_LOG is empty', { options: { externalMcp: true, activityLog: 'off' } }, async ($, on) => {
  const text = await wrapperText($, on)
  expect(text).toContain('export MNEMOSYNE_ACTIVITY_LOG=\n')
  expect(text).not.toContain('activity.jsonl')
})

for (const activityLog of ['on', 'off']) {
  test(`on Windows the cmd wrapper sets MNEMOSYNE_ACTIVITY_LOG (activityLog ${activityLog})`, { options: { externalMcp: true, activityLog } }, async ($, on) => {
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

    const text = runs.find(r => r.argv[2]?.includes('writeFileSync'))?.argv[4] ?? ''
    expect(text).toContain(activityLog === 'on' ? 'set "MNEMOSYNE_ACTIVITY_LOG=C:/Users/u/.claude/mnemosyne/activity.jsonl"\r\n' : 'set "MNEMOSYNE_ACTIVITY_LOG="\r\n')
  })
}
