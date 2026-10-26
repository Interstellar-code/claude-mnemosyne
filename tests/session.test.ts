// SESSION: the summary of the last session (SESSION.1), the first-prompt block (SESSION.2) and the unused-expiry sweep
// (SESSION.4). The pure rules (hooks/session.ts) are checked directly; the hooks run in the plugin test sandbox, where every
// host call is a stand-in (bin/memories.ts, bin/import.ts, the engine and the model). The same code over a real engine, store
// and temp HOME is specced in tests/bun/session.spec.ts.
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, ProcessRunInit } from 'claude-code'
import { ENGINE_BUILD } from '../hooks/register'
import {
  BLOCK_PINNED_CHARS,
  BLOCK_PINNED_MAX,
  buildSessionBlock,
  EXPIRE_DEFAULT_DAYS,
  EXPIRE_KINDS,
  expireRequest,
  expireSetting,
  parseBlockRead,
  parseExpireReply,
  parsePending,
  parseSummary,
  pendingSession,
  SUMMARY_MAX_CHARS,
  sessionSummaryOn,
  summaryPrompt,
  summarySystemPrompt,
  sweepDue,
  sweepMarkerText,
  transcriptFolder,
  transcriptPath,
} from '../hooks/session'

// ---- the pure rules ----

test('sessionSummary is off unless it says on', () => {
  expect(sessionSummaryOn({})).toBe(false)
  expect(sessionSummaryOn({ sessionSummary: 'off' })).toBe(false)
  expect(sessionSummaryOn({ sessionSummary: true })).toBe(false)
  expect(sessionSummaryOn({ sessionSummary: 'on' })).toBe(true)
  expect(sessionSummaryOn({ sessionSummary: ' ON ' })).toBe(true)
})

test('SESSION.4.a1: expireUnusedDays is 90 by default, 0 is off, 1-29 and nonsense are refused', () => {
  expect(expireSetting(undefined)).toEqual({ mode: 'on', days: EXPIRE_DEFAULT_DAYS })
  expect(expireSetting('')).toEqual({ mode: 'on', days: 90 })
  expect(expireSetting(90)).toEqual({ mode: 'on', days: 90 })
  expect(expireSetting(0)).toEqual({ mode: 'off' })
  expect(expireSetting('0')).toEqual({ mode: 'off' })
  expect(expireSetting(30)).toEqual({ mode: 'on', days: 30 })
  expect(expireSetting('45')).toEqual({ mode: 'on', days: 45 })
  expect(expireSetting(3650)).toEqual({ mode: 'on', days: 3650 })
  for (const bad of [1, 7, 29, -1, -90, 3651, 45.5, 'abc', 'NaN', true, [], {}]) {
    const got = expireSetting(bad)
    expect(got.mode).toBe('refused')
    expect((got as { reason: string }).reason).toContain('expireUnusedDays')
    expect((got as { reason: string }).reason).toContain('No memory was expired')
  }
})

test('SESSION.4.a4: the sweep asks for the four kinds only, a dry run unless applying, and names itself in the audit trail', () => {
  expect(EXPIRE_KINDS).toEqual(['context', 'event', 'error', 'artifact'])
  const dry = expireRequest(90, false)
  expect(dry).toEqual({ days: 90, kinds: ['context', 'event', 'error', 'artifact'], dry_run: true, limit: 50, validator: 'expire-sweep' })
  expect(expireRequest(120, true)).toEqual({ days: 120, kinds: ['context', 'event', 'error', 'artifact'], dry_run: false, limit: 50, validator: 'expire-sweep' })
  // none of the protected kinds can be named, and the list is a copy: changing the request never changes the constant
  for (const protectedKind of ['fact', 'preference', 'instruction', 'decision', 'unknown']) expect(expireRequest(90, true).kinds).not.toContain(protectedKind)
  ;(expireRequest(90, true).kinds as string[]).push('fact')
  expect(EXPIRE_KINDS).toHaveLength(4)
})

test('SESSION.4: the engine\'s answer is read as a dry run or an expiry, and nothing else is taken for one', () => {
  const rows = [{ id: 'a1', kind: 'context', last_used: '2026-05-01T00:00:00.000Z', preview: 'x' }]
  expect(parseExpireReply(JSON.stringify({ status: 'ok', dry_run: true, count: 1, candidates: rows }))).toEqual({ dryRun: true, count: 1, rows })
  expect(parseExpireReply(JSON.stringify({ status: 'ok', dry_run: false, count: 1, expired: rows }))).toEqual({ dryRun: false, count: 1, rows })
  expect(parseExpireReply(JSON.stringify({ status: 'ok', dry_run: false, count: 1, candidates: rows }))).toBeUndefined()
  expect(parseExpireReply('{"error":"nope"}')).toBeUndefined()
  expect(parseExpireReply('not json')).toBeUndefined()
})

test('SESSION.4.a2: the sweep is due with no marker, a bad one, one over 24 hours old or far in the future, and not within the day', () => {
  const now = Date.parse('2026-10-26T12:00:00.000Z')
  expect(sweepDue(undefined, now)).toBe(true)
  expect(sweepDue('', now)).toBe(true)
  expect(sweepDue('not json', now)).toBe(true)
  expect(sweepDue('{"at":"yesterday"}', now)).toBe(true)
  expect(sweepDue(sweepMarkerText(now), now)).toBe(false)
  expect(sweepDue(sweepMarkerText(now - 23 * 3_600_000), now)).toBe(false)
  expect(sweepDue(sweepMarkerText(now - 24 * 3_600_000), now)).toBe(true)
  expect(sweepDue(sweepMarkerText(now - 3 * 86_400_000), now)).toBe(true)
  // a clock moved back: a marker more than a day ahead does not block the sweep for good
  expect(sweepDue(sweepMarkerText(now + 10 * 86_400_000), now)).toBe(true)
  expect(sweepDue(sweepMarkerText(now + 3_600_000), now)).toBe(false)
})

test('SESSION.1.a2: a marker holds the session id, the owner and the transcript path, and refuses an unsafe id or owner', () => {
  const path = transcriptPath('/home/u', '/work/My Repo', 'abc-123')
  expect(path).toBe('/home/u/.claude/projects/-work-My-Repo/abc-123.jsonl')
  const entry = pendingSession('abc-123', 'project-My-Repo-1x', path)!
  expect(entry).toEqual({ sessionId: 'abc-123', owner: 'project-My-Repo-1x', transcript: path })
  expect(Object.keys(entry).sort()).toEqual(['owner', 'sessionId', 'transcript'])
  expect(parsePending(JSON.stringify(entry))).toEqual(entry)
  for (const [id, owner] of [['../x', 'global'], ['a b', 'global'], ['', 'global'], ['abc', 'a/b'], ['abc', ''], [5, 'global'], ['abc', 5]] as const) {
    expect(pendingSession(id, owner, path)).toBeUndefined()
  }
  expect(parsePending('{"sessionId":"abc","owner":"global"}')).toBeUndefined()
  expect(parsePending('nope')).toBeUndefined()
  expect(parsePending('null')).toBeUndefined()
})

test('SESSION.1: a marker\'s transcript must be the exact project path; any other path names no file', () => {
  const ok = pendingSession('s9', 'global', '/home/u/.claude/projects/-work-My-Repo/s9.jsonl')!
  expect(transcriptFolder(ok, '/home/u')).toBe('-work-My-Repo')
  const elsewhere = [
    '/etc/passwd',
    '/home/u/.claude/projects/../../.ssh/s9.jsonl',
    '/home/u/.claude/projects/-a/-b/s9.jsonl',
    '/home/u/.claude/projects/-a b/s9.jsonl',
    '/home/other/.claude/projects/-work/s9.jsonl',
    '/home/u/.claude/projects/-work/other.jsonl',
    '/home/u/.claude/projects//s9.jsonl',
  ]
  for (const transcript of elsewhere) expect(transcriptFolder({ ...ok, transcript }, '/home/u')).toBeUndefined()
})

test('SESSION.1.a3: the summary is plain text of at most 600 characters; NONE, junk and too-short replies give nothing', () => {
  expect(parseSummary('We moved the dashboard server to a random port and left the Windows path open.')).toBe('We moved the dashboard server to a random port and left the Windows path open.')
  expect(parseSummary('```\nWe moved the dashboard server to a random port.\n```')).toBe('We moved the dashboard server to a random port.')
  expect(parseSummary('"We moved the dashboard server\nto a random port."')).toBe('We moved the dashboard server to a random port.')
  expect(parseSummary('NONE')).toBeUndefined()
  expect(parseSummary(' none. ')).toBeUndefined()
  expect(parseSummary('')).toBeUndefined()
  expect(parseSummary('ok')).toBeUndefined()
  const long = parseSummary('word '.repeat(400))!
  expect(Array.from(long).length).toBeLessThanOrEqual(SUMMARY_MAX_CHARS)
  expect(SUMMARY_MAX_CHARS).toBe(600)
})

test('SESSION.1: the summary prompt quotes the transcript as data and asks for plain text', () => {
  expect(summarySystemPrompt()).toContain('quoted data')
  expect(summarySystemPrompt()).toContain('600')
  const prompt = summaryPrompt('User: hi "there"\nAssistant: ok')
  expect(prompt).toContain(JSON.stringify('User: hi "there"\nAssistant: ok'))
})

const row = (id: string, content: string, owner = 'global') => ({ id, owner, content })

test('SESSION.2.a1: the block shows the summary first, then the pinned memories, each with id and owner', () => {
  const block = buildSessionBlock({ summary: row('s1', 'Last time we fixed the sweep.'), pinned: [row('p1', 'Rohit prefers short replies.'), row('p2', 'Never push to main.', 'project-x')] })!
  expect(block.text.split('\n')).toEqual([
    'Mnemosyne: what we were doing last time, and pinned memories:',
    '- Last session [s1 owner=global] Last time we fixed the sweep.',
    '- Pinned [p1 owner=global] Rohit prefers short replies.',
    '- Pinned [p2 owner=project-x] Never push to main.',
  ])
  expect(block.ids).toEqual(['s1', 'p1', 'p2'])
})

test('SESSION.2.a2: nothing to show gives no block; the summary alone or the pins alone are enough', () => {
  expect(buildSessionBlock({ summary: null, pinned: [] })).toBeUndefined()
  expect(buildSessionBlock({ summary: row('s1', 'Only a summary here.'), pinned: [] })!.ids).toEqual(['s1'])
  expect(buildSessionBlock({ summary: null, pinned: [row('p1', 'Only a pin here.')] })!.ids).toEqual(['p1'])
})

test('SESSION.2.a3: at most 5 pinned memories, at most the first-prompt count, and 2000 characters of them in all', () => {
  const many = Array.from({ length: 9 }, (_, i) => row(`p${i}`, `pinned memory number ${i}`))
  expect(buildSessionBlock({ summary: null, pinned: many })!.ids).toHaveLength(BLOCK_PINNED_MAX)
  expect(buildSessionBlock({ summary: null, pinned: many }, 2)!.ids).toEqual(['p0', 'p1'])
  expect(buildSessionBlock({ summary: null, pinned: many }, 99)!.ids).toHaveLength(5)
  expect(buildSessionBlock({ summary: row('s1', 'A summary.'), pinned: many }, 3)!.ids).toEqual(['s1', 'p0', 'p1', 'p2'])
  const wide = Array.from({ length: 5 }, (_, i) => row(`w${i}`, `${'x'.repeat(900)}${i}`))
  const capped = buildSessionBlock({ summary: null, pinned: wide })!
  const shown = capped.text.split('\n').slice(1).map(line => line.replace(/^- Pinned \[[^\]]*\] /, ''))
  expect(shown.reduce((sum, text) => sum + Array.from(text).length, 0)).toBeLessThanOrEqual(BLOCK_PINNED_CHARS)
  // the third one crosses the cap and is cut with an ellipsis; the rest do not fit
  expect(capped.ids).toEqual(['w0', 'w1', 'w2'])
  expect(shown[2]!.endsWith('…')).toBe(true)
})

test('SESSION.2.a2: a pin that is also the summary is shown once; a read that is not the expected shape is empty', () => {
  expect(buildSessionBlock({ summary: row('s1', 'Summary text here.'), pinned: [row('s1', 'Summary text here.'), row('p1', 'A pin.')] })!.ids).toEqual(['s1', 'p1'])
  expect(parseBlockRead('not json')).toEqual({ summary: null, pinned: [] })
  expect(parseBlockRead('{"summary":{"id":1},"pinned":[{"id":"p"},{"id":"p2","owner":"global","content":"ok"},{"id":"p3","owner":"global","content":"  "}]}')).toEqual({ summary: null, pinned: [row('p2', 'ok')] })
})

// ---- the hooks, over stand-ins ----

type Run = { argv: readonly string[]; init?: ProcessRunInit }
type Reply = { stdout?: string; exitCode?: number; stderr?: string }
type ModelAnswer = { isAnswered: true; text: string } | { isAnswered: false; reason: 'api-error'; status: number; error: string }

const ROOT = '/home/u/.claude/mnemosyne'
const PACKAGE = `${ROOT}/engine/node_modules/@oh-my-pi/pi-mnemopi/package.json`
const CONFIG = `${ROOT}/config.json`
const SESSION_COMMANDS = ['first-prompt', 'summarised', 'session-pending', 'sweep-claim', 'expire'] as const
const QUIET: Record<string, string> = {
  'first-prompt': '{"summary":null,"pinned":[]}\n',
  summarised: '{"done":[]}\n',
  'session-pending': '[]\n',
  'sweep-claim': '{"due":false}\n',
  expire: '{"dryRun":false,"count":0,"rows":[]}\n',
}
const START = { cwd: '/w', surface: null, isInteractive: false } as never
const isAppend = (argv: readonly string[]) => (argv[1] ?? '').endsWith('/bin/activity.ts')
const SAVED = '{"status":"stored","memory_id":"a1b2c3d4e5f60718"}'

type RigOptions = {
  installed?: boolean
  files?: Record<string, string>
  memories?: (argv: readonly string[], stdin: string) => Reply | undefined
  importer?: (argv: readonly string[]) => Reply
  model?: (prompt: string, n: number) => ModelAnswer
  engine?: (name: string, args: Record<string, unknown>) => string | undefined
}

/** The world under the hooks: what ran, kept apart by program, and the session id, which a test can change (a /clear). */
function rig(on: On, options: RigOptions = {}) {
  const state = {
    sessionId: 's1',
    engine: [] as Run[],
    memories: [] as Run[],
    imports: [] as Run[],
    appends: [] as Run[],
    models: [] as { model: string; system?: string; prompt: string }[],
    toasts: [] as string[],
  }
  const installed = options.installed !== false
  on('env.get', () => ({ value: '/home/u' }))
  on('fs.stat', () => (installed ? { value: { kind: 'file' } } : { deny: 'ENOENT' }) as never)
  on('fs.read', (_$, e) => (e.path === PACKAGE && installed ? { value: JSON.stringify({ name: '@oh-my-pi/pi-mnemopi', version: ENGINE_BUILD }) } : options.files?.[e.path] !== undefined ? { value: options.files[e.path] } : { deny: 'ENOENT' }) as never)
  on('session.id', () => ({ value: state.sessionId }))
  on('session.repo', () => ({ value: { root: '/work/scratch', remote: null } }) as never)
  on('session.cwd', () => ({ value: '/work/scratch' }) as never)
  on('process.run', (_$, e) => {
    if (isAppend(e.argv)) {
      state.appends.push({ ...e })
      return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
    }
    const script = e.argv[1] ?? ''
    const reply = (given: Reply | undefined, fallback: string) => ({ value: { exitCode: given?.exitCode ?? 0, stdout: given?.stdout ?? fallback, stderr: given?.stderr ?? '' } }) as never
    if (script.endsWith('/bin/memories.ts')) {
      const command = SESSION_COMMANDS.find(name => e.argv.includes(name))
      state.memories.push({ ...e })
      return reply(options.memories?.(e.argv, e.init?.stdin ?? ''), command === undefined ? '' : command === 'session-pending' && e.argv.includes('claim') ? '{"claimed":true}\n' : QUIET[command]!)
    }
    if (script.endsWith('/bin/import.ts')) {
      state.imports.push({ ...e })
      return reply(options.importer?.(e.argv), '')
    }
    state.engine.push({ ...e })
    const sent = (e.init?.stdin ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line))
    const stdout = sent
      .map(({ id, params }) => `${JSON.stringify({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: options.engine?.(params.name, params.arguments) ?? SAVED }] } })}\n`)
      .join('')
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
  on('process.spawn', async function* (_$: unknown, e: { argv: readonly string[]; input?: string }) {
    state.appends.push({ argv: e.argv, init: { stdin: e.input } })
    return { value: { code: 0, signal: null } }
  } as never)
  on('model.complete', (_$, e) => {
    const n = state.models.length
    state.models.push({ model: e.model, system: e.system, prompt: e.prompt })
    const answer: ModelAnswer = options.model?.(e.prompt, n) ?? { isAnswered: true, text: 'We reworked the sweep and left the Windows path open for later.' }
    return { value: answer.isAnswered ? { ...answer, usage: {} } : { ...answer, usage: {} } } as never
  })
  on('clock.sleep', () => ({ value: undefined }) as never)
  on('tool.register', () => ({ value: {} }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('ui.toast', (_$, e) => {
    state.toasts.push((e as { text: string }).text)
    return { value: undefined } as never
  })
  on('ui.log', () => ({ value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  on('turn.complete', (_$, e) => ({ text: e.answer }) as never)
  return state
}

// The kit's world has no timers: a wait is a number of turns of the microtask queue.
const ticks = async (n = 6000) => {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

const sessionRuns = (state: ReturnType<typeof rig>, command: string) => state.memories.filter(run => run.argv.includes(command))
const sessionArgs = (run: Run) => run.argv.slice(2)
const firstPrompt = ($: Engine, text = 'How do I run the build? Then deploy it.') => $.prompt.submit({ text, origin: { kind: 'composer' } } as never) as Promise<{ context?: readonly string[] }>
const endTurn = ($: Engine) => $.turn.complete({ answer: 'done', turnId: 't1', durationMs: 1, isAborted: false } as never)
const activityLines = (state: ReturnType<typeof rig>) => state.appends.flatMap(run => (run.init?.stdin ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, any>))

// SESSION.1: the marker at session.end

test('SESSION.1.a1: with the option off (the default) session.end leaves no marker', async ($, on) => {
  const state = rig(on)
  await $.session.end({ sessionId: 's1', reason: 'other' } as never)
  expect(sessionRuns(state, 'session-pending')).toHaveLength(0)
})

test('SESSION.1.a2: with the option on, session.end leaves a marker of the id, the owner and the transcript path, and no text', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on)
  await $.session.end({ sessionId: 's1', reason: 'prompt_input_exit' } as never)
  const runs = sessionRuns(state, 'session-pending')
  expect(runs).toHaveLength(1)
  expect(sessionArgs(runs[0]!)).toEqual(['session-pending', 'write', ROOT])
  expect(JSON.parse(runs[0]!.init!.stdin!)).toEqual({ sessionId: 's1', owner: 'global', transcript: '/home/u/.claude/projects/-work-scratch/s1.jsonl' })
  // quick on exit: a short wait for the one process, no model call, no engine run
  expect(runs[0]!.init!.timeoutMs).toBeLessThanOrEqual(1_000)
  expect(state.models).toHaveLength(0)
  expect(state.engine).toHaveLength(0)
})

test('SESSION.1.a2: a /clear is an end with no start: the marker is left for the old id, and the new session finishes it', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const pending = { sessionId: 's1', owner: 'global', transcript: '/home/u/.claude/projects/-work-scratch/s1.jsonl' }
  const state = rig(on, {
    memories: argv => (argv.includes('session-pending') && argv.includes('list') ? { stdout: `${JSON.stringify([pending])}\n` } : undefined),
    importer: () => ({ stdout: `${JSON.stringify({ sessionId: 's1', turns: 6, totalTurns: 6, truncated: false, text: 'User: fix the sweep\n\nAssistant: done' })}\n` }),
  })
  await $.session.end({ sessionId: 's1', reason: 'clear' } as never)
  expect(sessionRuns(state, 'session-pending').map(run => sessionArgs(run)[1])).toEqual(['write'])
  // no session.start for the new id: its first prompt and the end of the first reply carry the work
  state.sessionId = 's2'
  await firstPrompt($)
  expect(state.models).toHaveLength(0)
  await endTurn($)
  await ticks()
  expect(state.models).toHaveLength(1)
  expect(state.models[0]!.model).toBe('haiku')
  expect(state.imports).toHaveLength(1)
  expect(sessionArgs(state.imports[0]!)).toEqual(['session', '--projects', '/home/u/.claude/projects', '--cwd', '/work-scratch', 's1'])
})

// SESSION.1: the background summary

const pendingOf = (...ids: string[]) => ids.map(id => ({ sessionId: id, owner: 'global', transcript: `/home/u/.claude/projects/-work-scratch/${id}.jsonl` }))
const readOf = (turns = 6) => ({ stdout: `${JSON.stringify({ sessionId: 'x', turns, totalTurns: turns, truncated: false, text: 'User: fix the sweep\n\nAssistant: done' })}\n` })
const withPending = (ids: string[], extra: Partial<RigOptions> = {}): RigOptions => ({
  importer: () => readOf(),
  ...extra,
  memories: (argv, stdin) => (argv.includes('session-pending') && argv.includes('list') ? { stdout: `${JSON.stringify(pendingOf(...ids))}\n` } : extra.memories?.(argv, stdin)),
})
const saves = (state: ReturnType<typeof rig>) => state.engine.flatMap(run => (run.init?.stdin ?? '').split('\n').filter(Boolean).map(line => JSON.parse(line).params as { name: string; arguments: Record<string, any> })).filter(call => call.name === 'mnemopi_remember')
const removed = (state: ReturnType<typeof rig>) => sessionRuns(state, 'session-pending').filter(run => run.argv.includes('remove')).map(run => run.argv.at(-1))

async function firstReply($: Engine) {
  await firstPrompt($)
  await endTurn($)
  await ticks()
}

test('SESSION.1.a1: with the option off the first reply does no summary work at all', async ($, on) => {
  const state = rig(on, withPending(['old1']))
  await firstReply($)
  expect(sessionRuns(state, 'session-pending')).toHaveLength(0)
  expect(state.models).toHaveLength(0)
  expect(saves(state)).toHaveLength(0)
})

test('SESSION.1.a3: one Haiku call per pending session; the summary is saved as an event, import:session, expiring in 30 days, with metadata.session; the marker goes', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, withPending(['old1']))
  const before = Date.now()
  await firstReply($)
  expect(state.models).toHaveLength(1)
  expect(state.models[0]!.prompt).toContain('fix the sweep')
  const [save] = saves(state)
  expect(save!.arguments).toMatchObject({
    content: 'We reworked the sweep and left the Windows path open for later.',
    memory_type: 'event',
    source: 'import:session',
    trust_tier: 'IMPORTED',
    veracity: 'imported',
    scope: 'global',
    metadata: { session: 'old1' },
  })
  const days = (Date.parse(save!.arguments.valid_until) - before) / 86_400_000
  expect(days).toBeGreaterThan(29.99)
  expect(days).toBeLessThan(30.01)
  expect(removed(state)).toEqual(['old1'])
  // the activity line: ids and counts, never the summary text
  const line = activityLines(state).find(entry => entry.action === 'remember' && entry.origin === 'session')!
  expect(line).toMatchObject({ ids: ['a1b2c3d4e5f60718'], count: 1, ok: true })
  expect(JSON.stringify(line)).not.toContain('Windows path')
})

test('SESSION.1.a3: a per-project summary is saved as the marker\'s owner, in channel scope', { options: { sessionSummary: 'on', scope: 'per-project' } }, async ($, on) => {
  const owner = 'project-scratch-1abc'
  const state = rig(on, {
    memories: argv => (argv.includes('session-pending') && argv.includes('list') ? { stdout: `${JSON.stringify([{ sessionId: 'old1', owner, transcript: '/home/u/.claude/projects/-work-scratch/old1.jsonl' }])}\n` } : undefined),
    importer: () => readOf(),
  })
  await firstReply($)
  expect(saves(state)[0]!.arguments.scope).toBe('channel')
  const run = state.engine.find(r => (r.init?.stdin ?? '').includes('mnemopi_remember'))!
  expect(run.init!.env!.MNEMOPI_SESSION_ID).toBe(owner)
})

test('SESSION.1.a4: at most 3 sessions a run, never the running session, and the rest wait', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, withPending(['s1', 'a', 'b', 'c', 'd']))
  await firstReply($)
  expect(state.models).toHaveLength(3)
  expect(removed(state)).toEqual(['a', 'b', 'c'])
})

test('SESSION.1.a4: a lost call leaves the marker for the next first prompt; the next one is still tried', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, { ...withPending(['a', 'b']), model: (_prompt, n) => (n === 0 ? { isAnswered: false, reason: 'api-error', status: 500, error: 'server error' } : { isAnswered: true, text: 'We settled the retry rule for the rate limit and moved on.' }) })
  await firstReply($)
  expect(state.models).toHaveLength(2)
  // 'a' got no answer: nothing saved, its marker stays; 'b' was saved and its marker removed
  expect(removed(state)).toEqual(['b'])
  expect(saves(state)).toHaveLength(1)
  expect(saves(state)[0]!.arguments.metadata.session).toBe('b')
})

test('SESSION.1.a4: a session already summarised is dropped without a model call', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, withPending(['done1', 'new1'], { memories: argv => (argv.includes('summarised') ? { stdout: '{"done":["done1"]}\n' } : undefined) }))
  await firstReply($)
  expect(state.models).toHaveLength(1)
  expect(removed(state)).toEqual(['done1', 'new1'])
  expect(saves(state)).toHaveLength(1)
  expect(saves(state)[0]!.arguments.metadata.session).toBe('new1')
})

test('SESSION.1.a4: a session with no transcript is dropped; a read that failed some other way keeps its marker', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, {
    ...withPending(['gone', 'broken', 'tiny']),
    importer: argv => {
      const id = argv.at(-1)
      if (id === 'gone') return { exitCode: 1, stderr: 'mnemosyne import: there is no transcript for that session id in this project\'s folder (-work-scratch)\n' }
      if (id === 'broken') return { exitCode: 1, stderr: 'mnemosyne import: out of memory\n' }
      return readOf(1)
    },
  })
  await firstReply($)
  expect(state.models).toHaveLength(0)
  // gone and tiny (one turn: nothing to carry over) are dropped; broken stays
  expect(removed(state)).toEqual(['gone', 'tiny'])
})

test('SESSION.1: a marker with an odd transcript path is dropped and no file is read', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, {
    memories: argv => (argv.includes('session-pending') && argv.includes('list') ? { stdout: `${JSON.stringify([{ sessionId: 'odd', owner: 'global', transcript: '/etc/passwd' }])}\n` } : undefined),
    importer: () => readOf(),
  })
  await firstReply($)
  expect(state.imports).toHaveLength(0)
  expect(state.models).toHaveLength(0)
  expect(removed(state)).toEqual(['odd'])
})

for (const [name, text] of [
  ['a reply of NONE', 'NONE'],
  ['a summary the guard blocks (a secret)', 'We rotated the key AKIAABCDEFGHIJKLMNOP and then retried the deploy step.'],
] as const) {
  test(`SESSION.1.a3: ${name} saves nothing and drops the marker`, { options: { sessionSummary: 'on' } }, async ($, on) => {
    const state = rig(on, { ...withPending(['x1']), model: () => ({ isAnswered: true, text }) })
    await firstReply($)
    expect(state.models).toHaveLength(1)
    expect(saves(state)).toHaveLength(0)
    expect(removed(state)).toEqual(['x1'])
    expect(JSON.stringify(activityLines(state))).not.toContain('AKIAABCDEFGHIJKLMNOP')
  })
}

test('SESSION.1.a3: a warned summary is not saved in strict mode (nobody to confirm it) and is saved with its flags in warn mode', { options: { sessionSummary: 'on', guardMode: 'warn' } }, async ($, on) => {
  const long = `${'We changed the build and the release steps again. '.repeat(40)}`.slice(0, 590)
  const state = rig(on, { ...withPending(['w1']), files: { [CONFIG]: JSON.stringify({ version: 1, guard: { warnLength: 200 } }) }, model: () => ({ isAnswered: true, text: long }) })
  await firstReply($)
  expect(saves(state)).toHaveLength(1)
  expect(saves(state)[0]!.arguments.metadata).toEqual({ session: 'w1', guard: ['G2'] })
})

test('SESSION.1.a3: in strict mode (the default) a warned summary is dropped, not saved', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const long = `${'We changed the build and the release steps again. '.repeat(40)}`.slice(0, 590)
  const state = rig(on, { ...withPending(['w1']), files: { [CONFIG]: JSON.stringify({ version: 1, guard: { warnLength: 200 } }) }, model: () => ({ isAnswered: true, text: long }) })
  await firstReply($)
  expect(saves(state)).toHaveLength(0)
  expect(removed(state)).toEqual(['w1'])
})

const claimsOf = (state: ReturnType<typeof rig>) => sessionRuns(state, 'session-pending').filter(run => run.argv.includes('claim')).map(run => run.argv.at(-1))
const releasesOf = (state: ReturnType<typeof rig>) => sessionRuns(state, 'session-pending').filter(run => run.argv.includes('release')).map(run => run.argv.at(-1))

test('SESSION.1.a4: every marker is claimed before its transcript is read; a marker another session claimed is left alone', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, withPending(['taken', 'mine'], { memories: argv => (argv.includes('claim') && argv.at(-1) === 'taken' ? { stdout: '{"claimed":false}\n' } : undefined) }))
  await firstReply($)
  expect(claimsOf(state)).toEqual(['taken', 'mine'])
  // only the claimed one is read, called on, saved and removed
  expect(state.imports).toHaveLength(1)
  expect(state.models).toHaveLength(1)
  expect(saves(state).map(call => call.arguments.metadata.session)).toEqual(['mine'])
  expect(removed(state)).toEqual(['mine'])
  expect(releasesOf(state)).toEqual([])
})

test('SESSION.1.a4: a claim that is not finished (a lost call, a read that failed) is released for the next first prompt; a finished one is not', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, {
    ...withPending(['lost', 'broken', 'done']),
    importer: argv => (argv.at(-1) === 'broken' ? { exitCode: 1, stderr: 'mnemosyne import: out of memory\n' } : readOf()),
    model: (_prompt, n) => (n === 0 ? { isAnswered: false, reason: 'api-error', status: 500, error: 'server error' } : { isAnswered: true, text: 'We settled the retry rule for the rate limit and moved on.' }),
  })
  await firstReply($)
  expect(releasesOf(state)).toEqual(['lost', 'broken'])
  expect(removed(state)).toEqual(['done'])
})

test('SESSION.1.a4: the check for an existing summary is made again just before the save, so a summary made meanwhile is not saved twice', { options: { sessionSummary: 'on' } }, async ($, on) => {
  let checks = 0
  const state = rig(on, withPending(['x1'], { memories: argv => (argv.includes('summarised') ? { stdout: `${JSON.stringify({ done: ++checks >= 2 ? ['x1'] : [] })}\n` } : undefined) }))
  await firstReply($)
  expect(checks).toBe(2)
  // the model was asked (the first check said no), but nothing is saved and the marker goes
  expect(state.models).toHaveLength(1)
  expect(saves(state)).toHaveLength(0)
  expect(removed(state)).toEqual(['x1'])
  expect(releasesOf(state)).toEqual([])
})

test('SESSION.1: extractionModel off means no summary and the markers stay', { options: { sessionSummary: 'on', extractionModel: 'off' } }, async ($, on) => {
  const state = rig(on, withPending(['x1']))
  await firstReply($)
  expect(state.models).toHaveLength(0)
  expect(removed(state)).toEqual([])
})

test('SESSION.1: the summary work runs after the reply, not before it, and only once per session', { options: { sessionSummary: 'on' } }, async ($, on) => {
  const state = rig(on, withPending(['x1']))
  await firstPrompt($)
  await ticks()
  expect(state.models).toHaveLength(0)
  expect(sessionRuns(state, 'session-pending').filter(run => run.argv.includes('list'))).toHaveLength(0)
  await endTurn($)
  await ticks()
  expect(state.models).toHaveLength(1)
  await firstPrompt($, 'a second prompt in the same session')
  await endTurn($)
  await ticks()
  expect(state.models).toHaveLength(1)
})

// SESSION.2: the first-prompt block

const blockRead = {
  summary: row('sum1', 'Last time we fixed the sweep and left the Windows path open.'),
  pinned: [row('pin1', 'Rohit prefers short replies.'), row('pin2', 'Never push to main.')],
}
const withBlock = (extra: Partial<RigOptions> = {}): RigOptions => ({
  memories: argv => (argv.includes('first-prompt') ? { stdout: `${JSON.stringify(blockRead)}\n` } : undefined),
  engine: name => (name === 'mnemopi_recall' ? JSON.stringify({ results: [{ id: 'r1', session_id: 'global', content: 'use pnpm' }, { id: 'pin1', session_id: 'global', content: 'Rohit prefers short replies.' }] }) : undefined),
  ...extra,
})

test('SESSION.2.a1: the first prompt gets the block ahead of the recall; a pin the recall also found is shown once', async ($, on) => {
  const state = rig(on, withBlock())
  const out = await firstPrompt($)
  expect(out.context).toHaveLength(2)
  expect(out.context![0]).toBe(
    ['Mnemosyne: what we were doing last time, and pinned memories:', '- Last session [sum1 owner=global] Last time we fixed the sweep and left the Windows path open.', '- Pinned [pin1 owner=global] Rohit prefers short replies.', '- Pinned [pin2 owner=global] Never push to main.'].join('\n'),
  )
  expect(out.context![1]).toContain('- [r1 owner=global] use pnpm')
  expect(out.context![1]).not.toContain('pin1')
  // the store read: owner, and the pin count from the settings (the default first-prompt count, 5)
  expect(sessionArgs(sessionRuns(state, 'first-prompt')[0]!)).toEqual(['--store', '/home/u/.claude/mnemosyne/store', 'first-prompt', 'global', '5'])
  // the prompt waits for that one read a few seconds at most
  expect(sessionRuns(state, 'first-prompt')[0]!.init!.timeoutMs).toBeLessThanOrEqual(3_000)
})

test('SESSION.2.a2: nothing pinned and no summary adds nothing', async ($, on) => {
  rig(on, { engine: name => (name === 'mnemopi_recall' ? JSON.stringify({ results: [{ id: 'r1', session_id: 'global', content: 'use pnpm' }] }) : undefined) })
  const out = await firstPrompt($)
  expect(out.context).toHaveLength(1)
  expect(out.context![0]).toContain('use pnpm')
})

test('SESSION.2.a3: a later prompt in the same session adds nothing', async ($, on) => {
  const state = rig(on, withBlock())
  await firstPrompt($)
  const second = await firstPrompt($, 'and now the second prompt of the session')
  expect(second.context).toBeUndefined()
  expect(sessionRuns(state, 'first-prompt')).toHaveLength(1)
})

test('SESSION.2: the first-prompt recall switch, count and sentences rule the block', async ($, on) => {
  // the switch off: no block and no store read
  const off = rig(on, { ...withBlock(), files: { [CONFIG]: JSON.stringify({ version: 1, recall: { firstPrompt: false } }) } })
  expect((await firstPrompt($)).context).toBeUndefined()
  expect(sessionRuns(off, 'first-prompt')).toHaveLength(0)
})

test('SESSION.2: the first-prompt count caps the pinned memories', async ($, on) => {
  const state = rig(on, { ...withBlock(), files: { [CONFIG]: JSON.stringify({ version: 1, recall: { firstPromptCount: 1 } }) } })
  const out = await firstPrompt($)
  expect(sessionArgs(sessionRuns(state, 'first-prompt')[0]!).at(-1)).toBe('1')
  expect(out.context![0]).toContain('pin1')
  expect(out.context![0]).not.toContain('pin2')
})

test('SESSION.2: the block does not wait on the model, the engine or a summary: it is one read of the store', async ($, on) => {
  const state = rig(on, withBlock())
  await firstPrompt($)
  expect(state.models).toHaveLength(0)
  // the only engine run of the prompt is the recall; the block's read is bin/memories.ts
  expect(state.engine.every(run => (run.init?.stdin ?? '').includes('mnemopi_recall'))).toBe(true)
})

test('SESSION.2: a failed store read costs the prompt nothing: the recall still goes in', async ($, on) => {
  rig(on, { ...withBlock(), memories: () => ({ exitCode: 1, stderr: 'boom' }) })
  const out = await firstPrompt($)
  expect(out.context).toHaveLength(1)
  expect(out.context![0]).toContain('use pnpm')
})

// SESSION.4: the sweep

const sweepRuns = (state: ReturnType<typeof rig>) => sessionRuns(state, 'expire')
const dueClaim = (extra: Partial<RigOptions> = {}): RigOptions => ({
  memories: argv => (argv.includes('sweep-claim') ? { stdout: '{"due":true}\n' } : extra.memories?.(argv, '')),
  ...extra,
})

test('SESSION.4.a2: a due sweep at session start runs bin/memories.ts expire --apply for this owner, and the activity line holds ids and counts', async ($, on) => {
  const state = rig(
    on,
    dueClaim({
      memories: argv => (argv.includes('sweep-claim') ? { stdout: '{"due":true}\n' } : argv.includes('expire') ? { stdout: `${JSON.stringify({ dryRun: false, count: 2, rows: [{ id: 'old1', kind: 'context', last_used: '2026-01-01T00:00:00.000Z', preview: 'secret preview text' }, { id: 'old2', kind: 'error', last_used: '2026-01-02T00:00:00.000Z', preview: 'more text' }] })}\n` } : undefined),
    }),
  )
  await $.session.start(START)
  await ticks()
  expect(sessionRuns(state, 'sweep-claim')).toHaveLength(1)
  expect(sessionArgs(sessionRuns(state, 'sweep-claim')[0]!)).toEqual(['sweep-claim', ROOT])
  const runs = sweepRuns(state)
  expect(runs).toHaveLength(1)
  expect(sessionArgs(runs[0]!)).toEqual(['--store', `${ROOT}/store`, 'expire', '--apply', '--json', '--days', '90', '--owner', 'global', '--root', ROOT])
  const line = activityLines(state).find(entry => entry.action === 'expire')!
  expect(line).toMatchObject({ origin: 'session', owner: 'global', ids: ['old1', 'old2'], count: 2, ok: true })
  expect(JSON.stringify(line)).not.toContain('preview text')
})

test('SESSION.4.a2: a sweep that is not due (the 24-hour marker) runs nothing further', async ($, on) => {
  const state = rig(on)
  await $.session.start(START)
  await ticks()
  expect(sessionRuns(state, 'sweep-claim')).toHaveLength(1)
  expect(sweepRuns(state)).toHaveLength(0)
  expect(activityLines(state).filter(entry => entry.action === 'expire')).toHaveLength(0)
})

test('SESSION.4.a2: the first prompt of a session triggers the sweep too, after the reply (a process that only sees /clear)', async ($, on) => {
  const state = rig(on, dueClaim())
  await firstPrompt($)
  await ticks()
  expect(sessionRuns(state, 'sweep-claim')).toHaveLength(0)
  await endTurn($)
  await ticks()
  expect(sessionRuns(state, 'sweep-claim')).toHaveLength(1)
  expect(sweepRuns(state)).toHaveLength(1)
  // a second prompt of the same session does not claim again
  await firstPrompt($, 'another prompt')
  await endTurn($)
  await ticks()
  expect(sessionRuns(state, 'sweep-claim')).toHaveLength(1)
})

test('SESSION.4.a1: expireUnusedDays 0 turns the sweep off: no claim, no run', { options: { expireUnusedDays: 0 } }, async ($, on) => {
  const state = rig(on, dueClaim())
  await $.session.start(START)
  await firstReply($)
  expect(sessionRuns(state, 'sweep-claim')).toHaveLength(0)
  expect(sweepRuns(state)).toHaveLength(0)
  expect(state.toasts).toHaveLength(0)
})

test('SESSION.4.a1: a value of 1-29 is refused: it says so at session start and runs no sweep', { options: { expireUnusedDays: 7 } }, async ($, on) => {
  const state = rig(on, dueClaim())
  await $.session.start(START)
  await firstReply($)
  expect(state.toasts.some(text => text.includes('expireUnusedDays 7 is not allowed'))).toBe(true)
  expect(sessionRuns(state, 'sweep-claim')).toHaveLength(0)
  expect(sweepRuns(state)).toHaveLength(0)
})

test('SESSION.4.a1: the days of the option go to the sweep', { options: { expireUnusedDays: 45 } }, async ($, on) => {
  const state = rig(on, dueClaim())
  await $.session.start(START)
  await ticks()
  expect(sessionArgs(sweepRuns(state)[0]!)).toContain('45')
  expect(sessionArgs(sweepRuns(state)[0]!)[sessionArgs(sweepRuns(state)[0]!).indexOf('--days') + 1]).toBe('45')
})

test('SESSION.4.a4: the plugin gives the sweep no way to name kinds, and never runs a delete', async ($, on) => {
  const state = rig(on, dueClaim())
  await $.session.start(START)
  await ticks()
  const args = sessionArgs(sweepRuns(state)[0]!)
  expect(args).not.toContain('--kinds')
  expect(args.filter(word => word.startsWith('--')).sort()).toEqual(['--apply', '--days', '--json', '--owner', '--root', '--store'])
  // nothing but bin/memories.ts ran: no engine process, so no engine call that could delete
  expect(state.engine.filter(run => run.init?.stdin !== undefined)).toHaveLength(0)
})

test('SESSION.4.a5: a failed sweep (a failed backup stops it) is a failed activity line and never breaks the session', async ($, on) => {
  const state = rig(
    on,
    dueClaim({
      memories: argv => (argv.includes('sweep-claim') ? { stdout: '{"due":true}\n' } : argv.includes('expire') ? { exitCode: 1, stderr: 'mnemosyne memories: the backup before the sweep failed (not enough disk space); nothing was expired\n' } : undefined),
    }),
  )
  await $.session.start(START)
  await ticks()
  const line = activityLines(state).find(entry => entry.action === 'expire')!
  expect(line).toMatchObject({ origin: 'session', ok: false, count: 0 })
  expect(line.error).toContain('the backup before the sweep failed')
})

test('SESSION.4.a5: no memory text can reach the failed line: the line is one fixed sentence, whatever the command printed', async ($, on) => {
  const words = 'The staging cluster is rebuilt every Friday evening by the platform team.'
  const state = rig(
    on,
    dueClaim({
      memories: argv => (argv.includes('sweep-claim') ? { stdout: '{"due":true}\n' } : argv.includes('expire') ? { exitCode: 1, stderr: `mnemosyne memories: the engine refused the sweep: ${words}\n`, stdout: `${words}\n` } : undefined),
    }),
  )
  await $.session.start(START)
  await ticks()
  const line = activityLines(state).find(entry => entry.action === 'expire')!
  expect(line).toMatchObject({ origin: 'session', ok: false })
  expect(line.error).toBe('the engine refused the sweep')
  expect(JSON.stringify(activityLines(state))).not.toContain('staging cluster')
  expect(JSON.stringify(activityLines(state))).not.toContain('Friday')
})

test('SESSION.4: an engine that is not installed, or out of date, does no sweep', async ($, on) => {
  const state = rig(on, { ...dueClaim(), installed: false })
  await $.session.start(START)
  await ticks()
  expect(state.memories).toHaveLength(0)
})

test('SESSION.4.a2: two triggers close together run one sweep (the marker is taken by the first)', async ($, on) => {
  let taken = false
  const state = rig(on, {
    memories: argv => {
      if (!argv.includes('sweep-claim')) return undefined
      const due = !taken
      taken = true
      return { stdout: `{"due":${due}}\n` }
    },
  })
  await $.session.start(START)
  await firstPrompt($)
  await endTurn($)
  await ticks()
  expect(sessionRuns(state, 'sweep-claim').length).toBeGreaterThanOrEqual(1)
  expect(sweepRuns(state)).toHaveLength(1)
})
