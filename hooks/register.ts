// Claude Mnemosyne — the hooks module.
//
// Long-term memory on the Mnemopi engine, in a home of its own: the engine is
// a private copy under ~/.claude/mnemosyne/engine (installed by
// /mnemosyne-setup) and the store defaults to ~/.claude/mnemosyne/store. omp's
// engine and store are never read or written. See DESIGN.md.
//
// Every call is one `bun cli.ts mcp` process answering one bare `tools/call`.
// The owner id (global, or the repo's) rides on MNEMOPI_SESSION_ID: recall
// reads that owner's rows plus every `scope: 'global'` row, and forget deletes
// only the owner's. MNEMOPI_NO_EMBEDDINGS=1 because a spawned bun panics on
// fastembed (DESIGN §2.5), so recall is full-text only.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { Recalled } from '../types'

export const ENGINE_VERSION = '18.11.0'
const ENGINE_PACKAGE = '@oh-my-pi/pi-mnemopi'
const GLOBAL_OWNER = 'global'
const RECALL_LIMIT = 5
const NOT_INSTALLED = 'Mnemosyne engine not installed: ask the user to run /mnemosyne-setup.'

// Where a person typed the prompt; another plugin's or session's text never triggers a save.
const PERSON_ORIGINS = new Set(['composer', 'bridge', 'sdk', 'slack-ping'])

const RULES_SECTION = {
  id: 'mnemosyne:rules',
  scope: 'session',
  text: `# Long-term memory (Mnemosyne)
mcp__mnemosyne__memory_remember / _recall / _forget keep facts across sessions and repos.
- Remember: lasting preferences, conventions, decisions, runbooks the user states. One self-contained fact per call.
- Never remember secrets, credentials, or one-off task details.
- Recall before answering about past decisions or preferences ("what did we…", "how do I usually…").
- To change a fact: forget the old id and owner, then remember the new one.`,
} as const

const recalled = atom({ plugin: 'mnemosyne', key: 'recalled' } as const, {} as Recalled)

const TOOLS = [
  {
    name: 'memory_remember',
    description:
      'Save a durable fact to long-term memory, recalled in later sessions. Use for knowledge worth keeping across conversations: preferences, conventions, runbooks, decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact, self-contained.' },
        importance: { type: 'number', description: '0 to 1; default 0.5.' },
        global: {
          type: 'boolean',
          description: 'Per-project mode only: true shares the fact with every project.',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'memory_recall',
    description: 'Search long-term memory by keywords (full-text).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', description: '1 to 50; default 5.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_forget',
    description: 'Permanently delete a memory, by the id and owner memory_recall returned.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string' },
        owner: { type: 'string', description: "The row's owner from memory_recall; default this project's." },
      },
      required: ['memory_id'],
    },
  },
  {
    name: 'memory_stats',
    description: 'Show long-term memory statistics.',
    inputSchema: { type: 'object' },
  },
] as const

// Configured trigger terms: normalized, blanks dropped (a blank would match every
// prompt), longest first so the remainder after the match is right.
function terms(value: unknown) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  if (list.length === 1 && String(list[0]).trim().toLowerCase() === 'none') return []
  return [...new Set(list.map(t => String(t).normalize('NFKC').trim().toLocaleLowerCase()).filter(Boolean))].sort(
    (x, y) => y.length - x.length,
  )
}

// The text after a term the prompt opens with, or undefined. A term ending in a
// letter or digit must end a word there: "remember" does not match "remembering".
export function afterTerm(text: string, list: readonly string[]) {
  const prompt = text.normalize('NFKC').trim().replace(/^(please|hey claude)[,\s]+/i, '')
  const lower = prompt.toLocaleLowerCase()
  const term = list.find(t => lower.startsWith(t) && (!/[\p{L}\p{N}]$/u.test(t) || !/^[\p{L}\p{N}]/u.test(lower.slice(t.length))))
  return term === undefined ? undefined : prompt.slice(term.length).replace(/^[\s:,]+/, '').trim()
}

const clamp = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback

const isWindows = async ($: EngineInterface) => (await $.env.get('OS')) === 'Windows_NT'

// Forward slashes on every OS: Bun and Windows both accept them.
const slashes = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '')
const isAbsolute = (path: string) => /^(\/|[A-Za-z]:\/)/.test(path)

// Rejects with a message the person can act on; every caller turns it into text.
async function paths($: EngineInterface, options: PluginOptions) {
  const windows = await isWindows($)
  const home = slashes((await $.env.get('HOME')) || (windows ? ((await $.env.get('USERPROFILE')) ?? '') : ''))
  if (!isAbsolute(home)) throw new Error(`${windows ? 'USERPROFILE' : 'HOME'} is not set to an absolute path.`)
  const root = `${home}/.claude/mnemosyne`
  const engine = `${root}/engine`
  const dir = slashes(typeof options.memoryDir === 'string' && options.memoryDir.trim() ? options.memoryDir.trim() : '~/.claude/mnemosyne/store')
  const store = dir === '~' || dir.startsWith('~/') ? `${home}${dir.slice(1)}` : dir
  if (!isAbsolute(store)) throw new Error(`memoryDir must be absolute or start with ~/ (got "${dir}").`)
  if (windows && /["%]/.test(store)) throw new Error('memoryDir must not contain " or % on Windows.')
  // One store, one writer: omp's database must never get a second one (DESIGN §2.6).
  const omp = `${home}/.omp`
  const fold = (path: string) => (windows ? path.toLowerCase() : path)
  if (fold(store) === fold(omp) || fold(store).startsWith(`${fold(omp)}/`)) throw new Error('memoryDir must not be inside ~/.omp.')
  return {
    windows,
    root,
    engine,
    cli: `${engine}/node_modules/${ENGINE_PACKAGE}/src/cli.ts`,
    store,
    wrapper: `${root}/bin/mnemosyne-mcp${windows ? '.cmd' : ''}`,
  }
}

async function owner($: EngineInterface, options: PluginOptions) {
  if (options.scope !== 'per-project') return GLOBAL_OWNER
  const root = slashes((await $.session.repo())?.root ?? (await $.session.cwd()))
  let hash = 5381
  for (const char of root) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0
  // The hash keeps /a/b-c and /a/b/c apart; the name keeps it readable.
  return `project-${root.split('/').filter(Boolean).at(-1)?.replace(/[^A-Za-z0-9]+/g, '-') ?? 'root'}-${hash.toString(36)}`
}

// Folder work runs through Bun, which every install has: mkdir, rm and chmod
// are not commands on Windows.
const bunFs = ($: EngineInterface, code: string, ...args: string[]) =>
  $.process.run(['bun', '-e', `const fs = require('fs'); const a = process.argv.slice(1); ${code}`, ...args])

// Single-quoted for sh: the store path comes from settings and may hold anything.
const shellQuote = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`

// Memories are private: owner-only folders on macOS and Linux, so other
// accounts cannot read the store or run the wrapper. On Windows the user
// profile's own permissions already keep other non-admin accounts out.
async function secure($: EngineInterface, options: PluginOptions) {
  const { root, store, windows } = await paths($, options)
  await bunFs($, `for (const d of a) { fs.mkdirSync(d, { recursive: true }); ${windows ? '' : 'fs.chmodSync(d, 0o700);'} }`, root, store)
}

// externalMcp: a wrapper other MCP clients (Cursor, Codex, `claude mcp add`)
// launch as a stdio server against the same store and owner rules. stdio has no
// port, so no token: access is whoever can run files as this user, guarded by
// the folder modes above.
async function syncWrapper($: EngineInterface, options: PluginOptions) {
  const { root, cli, store, wrapper, windows } = await paths($, options)
  // Rewritten at each session start, so an updated plugin's proxy path stays current.
  const proxy = `${slashes($.plugin.root)}/bin/mcp-proxy.ts`
  if (options.externalMcp !== true) {
    await bunFs($, 'fs.rmSync(a[0], { force: true })', wrapper)
    return
  }
  await bunFs($, `fs.mkdirSync(a[0], { recursive: true }); ${windows ? '' : 'fs.chmodSync(a[0], 0o700);'}`, `${root}/bin`)
  const text = windows ? cmdWrapper(store, cli, proxy) : shWrapper(store, cli, proxy)
  await bunFs($, `fs.writeFileSync(a[0], a[1]); ${windows ? '' : 'fs.chmodSync(a[0], 0o700);'}`, wrapper, text)
}

const WRAPPER_NOTE = `Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,
serving only remember / recall / forget / stats.
MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.`

const shWrapper = (store: string, cli: string, proxy: string) => `#!/bin/sh
${WRAPPER_NOTE.replace(/^/gm, '# ')}
export MNEMOPI_DATA_DIR=${shellQuote(store)}
export MNEMOPI_SESSION_ID="\${MNEMOSYNE_OWNER:-global}"
export MNEMOPI_CHANNEL_ID="$MNEMOPI_SESSION_ID"
export MNEMOPI_NO_EMBEDDINGS=1
export MNEMOPI_MCP_BANK=
export MNEMOPI_LLM_BASE_URL=
export MNEMOPI_HOST_LLM_ENABLED=
export MNEMOSYNE_CLI=${shellQuote(cli)}
exec bun ${shellQuote(proxy)}
`

// cmd has no safe quoting for " or %; paths() refuses a store holding either.
const cmdWrapper = (store: string, cli: string, proxy: string) => `@echo off\r
${WRAPPER_NOTE.replace(/^/gm, 'rem ').replace(/\n/g, '\r\n')}\r
set "MNEMOPI_DATA_DIR=${store}"\r
if not defined MNEMOSYNE_OWNER set "MNEMOSYNE_OWNER=global"\r
set "MNEMOPI_SESSION_ID=%MNEMOSYNE_OWNER%"\r
set "MNEMOPI_CHANNEL_ID=%MNEMOSYNE_OWNER%"\r
set "MNEMOPI_NO_EMBEDDINGS=1"\r
set "MNEMOPI_MCP_BANK="\r
set "MNEMOPI_LLM_BASE_URL="\r
set "MNEMOPI_HOST_LLM_ENABLED="\r
set "MNEMOSYNE_CLI=${cli}"\r
bun "${proxy}"\r
`

async function isInstalled($: EngineInterface, options: PluginOptions) {
  try {
    return (await $.fs.stat((await paths($, options)).cli)).kind === 'file'
  } catch {
    return false
  }
}

// One engine process answering each request in turn; per request, its text or
// the engine's error.
async function runAll(
  $: EngineInterface,
  options: PluginOptions,
  requests: readonly (readonly [string, Record<string, unknown>])[],
  as?: string,
) {
  const [id, { cli, store }] = await Promise.all([as ?? owner($, options), paths($, options)])
  const ran = await $.process.run(['bun', cli, 'mcp'], {
    stdin: requests
      .map(([name, args], i) => `${JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name, arguments: args } })}\n`)
      .join(''),
    env: {
      MNEMOPI_DATA_DIR: store,
      MNEMOPI_SESSION_ID: id,
      MNEMOPI_CHANNEL_ID: id,
      MNEMOPI_NO_EMBEDDINGS: '1',
      // Inherited from an omp shell this would move writes to <store>/banks/<x>; empty falls back to `default`.
      MNEMOPI_MCP_BANK: '',
      // The env is layered over the host's: an exported LLM URL would let the engine call out.
      MNEMOPI_LLM_BASE_URL: '',
      MNEMOPI_HOST_LLM_ENABLED: '',
    },
    timeoutMs: 20_000,
  })
  const replies = new Map<unknown, { error?: { message: string }; result?: { content?: { text?: string }[]; isError?: boolean } }>()
  for (const line of ran.stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (message?.id !== undefined) replies.set(message.id, message)
    } catch {
      // not a reply: engine chatter
    }
  }
  return requests.map((_, i) => {
    const reply = replies.get(i + 1)
    if (reply === undefined) return new Error(`engine exited ${ran.exitCode}: ${ran.stderr.trim().slice(-300)}`)
    if (reply.error) return new Error(reply.error.message)
    const text = reply.result?.content?.[0]?.text ?? ''
    return reply.result?.isError ? new Error(text) : text
  })
}

// One engine call; resolves the tool's text, rejects with the engine's message.
async function call($: EngineInterface, options: PluginOptions, name: string, args: Record<string, unknown>, as?: string) {
  const [answer] = await runAll($, options, [[name, args]], as)
  if (answer instanceof Error) throw answer
  return answer ?? ''
}

// Recall rows carry a dozen scoring fields; the model needs only these.
function compact(recall: string) {
  const { results = [] } = JSON.parse(recall)
  return results.map((r: Record<string, unknown>) => ({
    id: r.id,
    owner: r.session_id,
    content: r.content,
    scope: r.scope,
    timestamp: r.timestamp,
  }))
}

export const register: Register = (on, options) => {
  const isPerProject = options.scope === 'per-project'

  const engineArgs = (tool: string, input: Record<string, unknown>) => {
    switch (tool) {
      case 'memory_remember': {
        const isGlobal = !isPerProject || input.global === true
        return [
          'mnemopi_remember',
          {
            content: input.content,
            importance: clamp(input.importance, 0, 1, 0.5),
            // `imported` is the engine's durable trust tier: any other source lands
            // as STATED working memory, which the engine deletes after 24 hours.
            source: 'imported',
            scope: isGlobal ? 'global' : 'channel',
          },
        ] as const
      }
      case 'memory_recall':
        return ['mnemopi_recall', { query: input.query, limit: clamp(input.limit, 1, 50, RECALL_LIMIT) }] as const
      case 'memory_forget':
        return ['mnemopi_forget', { memory_id: input.memory_id }] as const
      default:
        return ['mnemopi_stats', {}] as const
    }
  }

  on('session.start', { cwd: /.*/ }, async ($, e, next) => {
    await $.command.register({
      name: 'mnemosyne-setup',
      description: `Install the Mnemosyne memory engine (${ENGINE_PACKAGE}@${ENGINE_VERSION}) into ~/.claude/mnemosyne`,
    })
    for (const tool of TOOLS) await $.tool.register({ ...tool, isDeferred: false })
    if (!(await isInstalled($, options))) $.ui.toast('Mnemosyne: memory engine not installed. Run /mnemosyne-setup.')
    else await Promise.all([secure($, options), syncWrapper($, options)]).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: 'mnemosyne-setup' }, async $ => {
    const bun = await $.process.run(['bun', '--version']).catch(() => null)
    if (bun?.exitCode !== 0) return { text: 'Mnemosyne needs Bun on PATH: https://bun.sh' }

    try {
      const { engine, store } = await paths($, options)
      await $.fs.write(`${engine}/package.json`, '{ "name": "mnemosyne-engine", "private": true }\n')
      const added = await $.process.run(['bun', 'add', `${ENGINE_PACKAGE}@${ENGINE_VERSION}`], {
        cwd: engine,
        timeoutMs: 300_000,
      })
      if (added.exitCode !== 0) return { text: `Engine install failed:\n${added.stderr.trim().slice(-800)}` }

      await secure($, options)
      await syncWrapper($, options)
      const stats = await call($, options, 'mnemopi_stats', {})
      const { wrapper } = await paths($, options)
      const external =
        options.externalMcp === true ? `\nOther MCP clients: claude mcp add mnemosyne-store -- ${wrapper}` : ''
      return { text: `Mnemosyne ready. Engine: ${engine}. Store: ${store}.${external}\n${stats}` }
    } catch (err) {
      return { text: `Mnemosyne setup failed: ${(err as Error).message}` }
    }
  })

  on('tool.call', { tool: /^mcp__mnemosyne__memory_/ }, async ($, e) => {
    const tool = e.tool.replace('mcp__mnemosyne__', '')
    const input = e as unknown as Record<string, unknown>
    try {
      if (!(await isInstalled($, options))) {
        await paths($, options) // a bad HOME or memoryDir says so rather than "not installed"
        return { deny: NOT_INSTALLED }
      }
      const [name, args] = engineArgs(tool, input)
      // A row is deleted as its owner: a global fact from another project names its own.
      const as = tool === 'memory_forget' && typeof input.owner === 'string' && input.owner ? input.owner : undefined
      const text = await call($, options, name, args, as)
      return { result: name === 'mnemopi_recall' ? JSON.stringify(compact(text)) : text }
    } catch (err) {
      return { deny: `Mnemosyne: ${(err as Error).message}` }
    }
  }).catch(() => ({ deny: 'Mnemosyne: its tool failed.' }))

  const rememberTerms = terms(options.rememberTerms)
  const recallTerms = terms(options.recallTerms)

  // Fixed text, appended last on the session side, so the prompt cache holds.
  on('prompt.compose', async (_$, e, next) => {
    const composed = await next(e)
    if (e.traits.includes('bare') || !e.tools.includes('mcp__mnemosyne__memory_remember')) return composed
    return { ...composed, sections: [...composed.sections, RULES_SECTION] }
  }).catch((_$, e, next) => next(e))

  // On the first prompt of a session, recall per sentence. On any prompt the
  // person typed that opens with a configured term: a remember term asks the
  // model to save once (so the never-secrets rule and its wording apply); a
  // recall term recalls now, for that prompt only.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    const isPerson = PERSON_ORIGINS.has(e.origin?.kind ?? 'composer')
    const remember = isPerson ? afterTerm(e.text, rememberTerms) : undefined
    const asked = isPerson && remember === undefined ? afterTerm(e.text, recallTerms) : undefined
    const session = await $.session.id()
    const isFirst = !(await read($, recalled))[session]
    if (!isFirst && !remember && asked === undefined) return next(e)
    if (!(await isInstalled($, options))) return next(e)
    if (isFirst) await update($, recalled, seen => ({ ...seen, [session]: true as const }))

    const context: string[] = []
    if (remember) {
      context.push(
        `The user invoked a Mnemosyne remember trigger. Call mcp__mnemosyne__memory_remember exactly once with a self-contained version of:\n${remember}\nIf it is a secret or credential, do not save it; say so.`,
      )
    }
    try {
      // The engine drops a row matching under ~22% of the query's words, so a long
      // prompt recalls nothing as one query: ask per sentence, in one process.
      const sentences = (text: string) => text.split(/(?<=[.?!])\s+|\n+/).map(t => t.trim()).filter(Boolean)
      // A recall term's query is the first sentence after it: "recall: heron? and then…" asks for heron.
      const topic = asked ? sentences(asked)[0]?.replace(/[?.!]+$/, '') : undefined
      const queries = [...(topic ? [topic] : []), ...(isFirst ? sentences(e.text).slice(0, 4) : [])]
      const answers = queries.length === 0 ? [] : await runAll($, options, [...new Set(queries)].map(query => ['mnemopi_recall', { query: query.slice(0, 300), limit: RECALL_LIMIT }] as const))
      const byId = new Map<string, { id: string; owner: string; content: string }>()
      for (const answer of answers) if (typeof answer === 'string') for (const row of compact(answer)) byId.set(row.id, row)
      const found = [...byId.values()].slice(0, RECALL_LIMIT)
      if (found.length > 0) {
        const lines = found.map(r => `- [${r.id} owner=${r.owner}] ${r.content}`)
        context.push(`Long-term memories that may be relevant (Mnemosyne; mcp__mnemosyne__memory_forget takes the id and owner):\n${lines.join('\n')}`)
      } else if (asked !== undefined) {
        context.push(`Mnemosyne recall for "${topic ?? asked}" found nothing.`)
      }
    } catch {
      // recall is best effort; the prompt goes on without it
    }
    return context.length > 0 ? next({ ...e, context: [...(e.context ?? []), ...context] }) : next(e)
  }).catch((_$, e, next) => next(e))
}
