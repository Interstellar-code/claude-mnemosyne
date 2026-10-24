// Claude Mnemosyne — the hooks module.
//
// Long-term memory on the Mnemosyne Memory engine, in a home of its own: the
// engine is a private copy under ~/.claude/mnemosyne/engine (installed by
// /mnemosyne-setup) and the store defaults to ~/.claude/mnemosyne/store. See
// DESIGN.md.
//
// Every call is one `bun cli.ts mcp` process answering bare `tools/call`
// requests, built and read by hooks/engine.ts (shared with the dashboard server).
// The owner id (global, or the repo's) rides on MNEMOPI_SESSION_ID: recall
// reads that owner's rows plus every `scope: 'global'` row, and forget deletes
// only the owner's. Embeddings are off until /mnemosyne-setup downloads the
// model and engineEnv turns them on; MNEMOPI_NO_EMBEDDINGS=1 keeps recall
// full-text only otherwise (DESIGN §2.5).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import type { PendingTrigger, Recalled } from '../types'
import { activityLine, callOutcome, callText, TOOL_ACTIONS } from './activity-log'
import type { ActivityFields } from './activity-log'
import {
  BACKFILL_CALL_TIMEOUT_MS,
  BACKFILL_CONCURRENCY,
  BACKFILL_MAX_TOKENS,
  extractionModelOf,
  extractionOff,
  GET_BATCH,
  judge,
  parseProposals,
  parseRows,
  parseTags,
  pool,
  PROPOSALS_FILE,
  SYSTEM_PROMPT,
  tagPrompt,
} from './backfill'
import type { Proposal, Row } from './backfill'
import { extractMany, extractOne, reasonLine, storedCount } from './knowledge'
import type { ExtractOutcome, KnowledgeEngine } from './knowledge'
import { buildRequests, EMBEDDINGS_CACHE_DIR, EMBEDDINGS_MODEL, engineEnv, parseReplies } from './engine'
import type { EngineRequest } from './engine'
import { ENGINE_BUILD, SETUP_TIMEOUT_MS } from './engine-build'
import { mnemosyneStats } from './surface'
import { admit } from './guard'
import type { GuardResult } from './guard'
import { expiresInDaysProblem, KIND_NAMES, kindProblem, validUntilFor, withNoKindWarning } from './kinds'
import { cleanTags } from './tags'
import { openDashboard, stopDashboard } from './ui-launch'

export { ENGINE_BUILD } from './engine-build'
// The upstream base version; the plugin's own build of it is ENGINE_BUILD (engine/UPSTREAM.md).
export const ENGINE_VERSION = '18.12.3'
const ENGINE_PACKAGE = '@oh-my-pi/pi-mnemopi'
const GLOBAL_OWNER = 'global'
const RECALL_LIMIT = 5
const NOT_INSTALLED = 'Mnemosyne Memory engine not installed: ask the user to run /mnemosyne-setup.'
const NOT_CURRENT = `Mnemosyne Memory engine is out of date (memory_update needs build ${ENGINE_BUILD}): ask the user to run /mnemosyne-setup.`

// Where a person typed the prompt; another plugin's or session's text never triggers a save.
const PERSON_ORIGINS = new Set(['composer', 'bridge', 'sdk', 'slack-ping'])

const RULES_SECTION = {
  id: 'mnemosyne:rules',
  scope: 'session',
  text: `# Long-term memory (Mnemosyne)
mcp__mnemosyne__memory_remember / _recall / _update / _forget keep facts across sessions and repos.
- Remember: lasting preferences, conventions, decisions, runbooks the user states. One self-contained fact per call.
- With each fact, pass kind: fact, preference, instruction (a rule or runbook), decision, context (project state), error (a bug note), artifact (a reference) or event (a session summary).
- With each fact, pass tags: 2 to 5 short lowercase topic words (for example ["git", "ci"]).
- Never remember secrets, credentials, or one-off task details.
- Recall before answering about past decisions or preferences ("what did we…", "how do I usually…").
- To change or tag a fact, update it by id and owner with memory_update. Use memory_forget only to delete. Never save a near-duplicate: recall first, and if a close memory exists, update it (or replace it with the new fact) instead of saving another.`,
} as const

const recalled = atom({ plugin: 'mnemosyne', key: 'recalled' } as const, {} as Recalled)
// A remember phrase matched this turn: the first MAIN-THREAD save of the turn is
// the human's, and consumes it (KNOWX.1). A subagent's save never does.
const pendingTrigger = atom({ plugin: 'mnemosyne', key: 'pendingTrigger' } as const, {} as PendingTrigger)

const CONFIRM_PROPERTY = {
  type: 'boolean',
  description: 'Send true to save text the guard warned about (only after a refusal that asked for it). Secrets and size blocks cannot be confirmed.',
} as const

// The guardMode option: strict (the default) refuses a warned save unless the call passes confirm: true; warn saves it with the warnings.
export const guardModeOf = (options: PluginOptions): 'strict' | 'warn' => (typeof options.guardMode === 'string' && options.guardMode.trim().toLowerCase() === 'warn' ? 'warn' : 'strict')

const KIND_PROPERTY = {
  type: 'string',
  enum: KIND_NAMES,
  description: 'What kind of memory this is. Without it the memory is saved as unknown.',
} as const

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
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '2 to 5 short lowercase topic tags for the fact, e.g. ["git", "ci"].',
        },
        kind: KIND_PROPERTY,
        expires_in_days: {
          type: 'integer',
          description: 'Forget this memory after this many days (1 to 365). A context note expires after 14 days when this is not given.',
        },
        confirm: CONFIRM_PROPERTY,
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
    name: 'memory_update',
    description:
      'Change a memory in place, by the id and owner memory_recall returned: its content, importance, kind or topic tags. Keeps its id and recall history. Use this rather than forgetting and saving again.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string' },
        content: { type: 'string', description: 'The new text of the fact, self-contained.' },
        importance: { type: 'number', description: '0 to 1.' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Short lowercase topic tags (at most 5); replaces the old ones. [] removes them.',
        },
        kind: { ...KIND_PROPERTY, description: 'Change what kind of memory this is.' },
        confirm: CONFIRM_PROPERTY,
        owner: { type: 'string', description: "The row's owner from memory_recall; default this project's." },
      },
      required: ['memory_id'],
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
  // `claude plugin configure` stores a list as one comma-joined string.
  const list = (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).flatMap(t => String(t).split(','))
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
// `.` and `..` resolved, so a/b/../c compares as a/c (forward slashes, as slashes() gives).
function normalize(path: string) {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (part === '..') parts.pop()
    else if (part !== '.' && part !== '') parts.push(part)
  }
  return `${path.startsWith('/') ? '/' : ''}${parts.join('/')}`
}

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
  // One store, one writer: the ~/.omp database must never get a second one (DESIGN §2.6).
  const omp = `${home}/.omp`
  const fold = (path: string) => (windows ? path.toLowerCase() : path)
  if (fold(store) === fold(omp) || fold(store).startsWith(`${fold(omp)}/`)) throw new Error('memoryDir must not be inside ~/.omp.')
  // Setup replaces these folders whole: a store inside one would be deleted.
  // Case is ignored, as the macOS and Windows file systems do (Engine/ is engine/).
  const lower = normalize(store).toLowerCase()
  for (const folder of [engine, `${engine}.next`, `${engine}.old`].map(f => f.toLowerCase())) {
    if (lower === folder || lower.startsWith(`${folder}/`)) throw new Error(`memoryDir must not be inside the engine folder (${engine}).`)
  }
  return {
    windows,
    root,
    engine,
    cli: `${engine}/node_modules/${ENGINE_PACKAGE}/src/cli.ts`,
    store,
    wrapper: `${root}/bin/mnemosyne-mcp${windows ? '.cmd' : ''}`,
    activity: `${root}/activity.jsonl`,
  }
}

// ---- Embeddings (EMB): local only, downloaded once by /mnemosyne-setup ----------

// The setup marker /mnemosyne-setup writes after downloading the model; its
// presence plus the model files is what lets an engine run turn embeddings on.
export const EMBEDDINGS_MARKER = 'embeddings.json'
// The 5 files fastembed writes under <cache>/<repo with / -> _>/ for bge-small.
export const EMBEDDINGS_MODEL_DIR = 'Qdrant_bge-small-en-v1.5-onnx-Q'
export const EMBEDDINGS_MODEL_FILES = [
  'model_optimized.onnx',
  'tokenizer.json',
  'tokenizer_config.json',
  'config.json',
  'special_tokens_map.json',
] as const

/** The model cache folder under <root>: matches engineEnv's PI_CONFIG_DIR + /cache/fastembed. */
export const embeddingsCacheDir = (root: string) => `${root}/model-cache/cache/fastembed`

// The embeddings option, resolved: 'on' only when set to on, or 'auto' (the
// default) on macOS arm64 — the one platform the fix is tested on. Elsewhere it
// is off unless the user turns it on. EMB.3.a3.
export function embeddingsSetting(options: { embeddings?: unknown }): 'on' | 'off' | 'auto' {
  const value = typeof options.embeddings === 'string' ? options.embeddings.trim().toLowerCase() : ''
  if (value === 'on') return 'on'
  if (value === 'off') return 'off'
  return 'auto'
}

// Whether the host is macOS on Apple Silicon (a hook cannot read process.arch, so it asks uname).
const isMacArm64 = async ($: EngineInterface) => {
  try {
    const [system, machine] = await Promise.all([
      $.process.run(['uname', '-s'], { timeoutMs: 2_000 }),
      $.process.run(['uname', '-m'], { timeoutMs: 2_000 }),
    ])
    return system.exitCode === 0 && system.stdout.trim() === 'Darwin' && machine.exitCode === 0 && machine.stdout.trim() === 'arm64'
  } catch {
    return false
  }
}

/**
 * Whether the model is downloaded: /mnemosyne-setup wrote its marker AND every
 * model file is present. /mnemosyne-setup only downloads when the option is on
 * (by 'on', or 'auto' on macOS arm64), so the marker's presence already encodes
 * that decision — including the platform one. No platform probe runs here, so
 * this stays a cheap check on every engine call.
 */
async function embeddingsReady($: EngineInterface, root: string): Promise<boolean> {
  if (!(await fileExists($, `${root}/${EMBEDDINGS_MARKER}`))) return false
  const dir = `${embeddingsCacheDir(root)}/${EMBEDDINGS_MODEL_DIR}`
  return (await Promise.all(EMBEDDINGS_MODEL_FILES.map(file => fileExists($, `${dir}/${file}`)))).every(Boolean)
}

/**
 * Whether an engine run may turn embeddings on: the option is not off AND the
 * model is downloaded. An option turned off after setup keeps them off even with
 * the marker in place. Without both the engine keeps MNEMOPI_NO_EMBEDDINGS=1, so
 * it never downloads the model mid-call (EMB.2.a4).
 */
async function embeddingsOn($: EngineInterface, options: PluginOptions, root?: string): Promise<boolean> {
  if (embeddingsSetting(options) === 'off') return false
  const base = root ?? (await paths($, options)).root
  return embeddingsReady($, base)
}

async function fileExists($: EngineInterface, path: string): Promise<boolean> {
  return $.fs.stat(path).then((stat: { kind: string }) => stat.kind === 'file', () => false)
}

/**
 * Writes <root>/embeddings.json (0600), the setup marker: it names the model
 * /mnemosyne-setup downloaded, and engineEnv checks it plus the model files
 * before turning embeddings on. A new file renamed over the old one, so a
 * half-written marker never counts.
 */
async function writeEmbeddingsMarker($: EngineInterface, root: string) {
  const text = `${JSON.stringify({ model: EMBEDDINGS_MODEL, cache: EMBEDDINGS_CACHE_DIR })}\n`
  const code =
    'const fs = require("fs"); const a = process.argv.slice(1); const t = a[0] + ".tmp"; fs.rmSync(t, { force: true }); fs.writeFileSync(t, a[1], { mode: 0o600, flag: "wx" }); fs.chmodSync(t, 0o600); fs.renameSync(t, a[0]);'
  const ran = await $.process.run(['bun', '-e', code, `${root}/${EMBEDDINGS_MARKER}`, text], { timeoutMs: 5_000 })
  if (ran.exitCode !== 0) throw new Error(`could not write ${EMBEDDINGS_MARKER}: ${ran.stderr.trim().slice(0, 300)}`)
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
const bunFs = async ($: EngineInterface, code: string, ...args: string[]) => {
  const ran = await $.process.run(['bun', '-e', `const fs = require('fs'); const a = process.argv.slice(1); ${code}`, ...args])
  // run() resolves on a non-zero exit; a script that failed (a syntax error, a full disk) must not pass as done.
  if (ran.exitCode !== 0) throw new Error(`bun -e failed (exit ${ran.exitCode}): ${ran.stderr.trim().slice(0, 300)}`)
  return ran
}

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
  const { root, cli, store, wrapper, windows, activity: log } = await paths($, options)
  // Rewritten at each session start, so an updated plugin's proxy path stays current.
  const proxy = `${slashes($.plugin.root)}/bin/mcp-proxy.ts`
  if (options.externalMcp !== true) {
    await bunFs($, 'fs.rmSync(a[0], { force: true })', wrapper)
    return
  }
  await bunFs($, `fs.mkdirSync(a[0], { recursive: true }); ${windows ? '' : 'fs.chmodSync(a[0], 0o700);'}`, `${root}/bin`)
  // The proxy logs to activity.jsonl unless activityLog is off; it reads this at its next start.
  const activity = options.activityLog === 'off' ? '' : log
  // The same env the hooks send: local-only embedding pins, embeddings on only
  // when the model is downloaded (EMB.3.a2).
  const embeddings = await embeddingsOn($, options)
  const text = windows
    ? cmdWrapper(store, cli, proxy, activity, embeddings, guardModeOf(options))
    : shWrapper(store, cli, proxy, activity, embeddings, guardModeOf(options))
  await bunFs($, `fs.writeFileSync(a[0], a[1]); ${windows ? '' : 'fs.chmodSync(a[0], 0o700);'}`, wrapper, text)
}

const WRAPPER_NOTE = `Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,
serving only remember / recall / update / forget / stats.
MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.
MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.
MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.`

const shWrapper = (store: string, cli: string, proxy: string, activity: string, embeddings: boolean, guardMode: string) => `#!/bin/sh
${WRAPPER_NOTE.replace(/^/gm, '# ')}
export MNEMOPI_DATA_DIR=${shellQuote(store)}
export MNEMOPI_SESSION_ID="\${MNEMOSYNE_OWNER:-global}"
export MNEMOPI_CHANNEL_ID="$MNEMOPI_SESSION_ID"
${embeddings ? 'unset MNEMOPI_NO_EMBEDDINGS' : 'export MNEMOPI_NO_EMBEDDINGS=1'}
export MNEMOPI_MCP_BANK=default
export MNEMOPI_LLM_BASE_URL=
export MNEMOPI_HOST_LLM_ENABLED=
export MNEMOPI_AUTHOR_ID=
export MNEMOPI_AUTHOR_TYPE=
export MNEMOPI_POLYPHONIC_RECALL=0
export MNEMOPI_EMBEDDING_API_URL=
export MNEMOPI_EMBEDDINGS_VIA_API=
export MNEMOPI_EMBEDDING_API_KEY=
export MNEMOPI_EMBEDDING_MODEL=${EMBEDDINGS_MODEL}
export MNEMOPI_EMBEDDING_DIM=
export OPENROUTER_BASE_URL=
export OPENROUTER_API_KEY=
export OPENAI_API_KEY=
export MNEMOPI_EMBEDDINGS_API_OPT_IN=0
export HF_ENDPOINT=https://huggingface.co
export PI_CONFIG_DIR=${EMBEDDINGS_CACHE_DIR}
export MNEMOSYNE_CLI=${shellQuote(cli)}
export MNEMOSYNE_ACTIVITY_LOG=${activity ? shellQuote(activity) : ''}
export MNEMOSYNE_GUARD_MODE=${guardMode}
exec bun ${shellQuote(proxy)}
`

// cmd has no safe quoting for " or %; paths() refuses a store holding either.
const cmdWrapper = (store: string, cli: string, proxy: string, activity: string, embeddings: boolean, guardMode: string) => `@echo off\r
${WRAPPER_NOTE.replace(/^/gm, 'rem ').replace(/\n/g, '\r\n')}\r
set "MNEMOPI_DATA_DIR=${store}"\r
if not defined MNEMOSYNE_OWNER set "MNEMOSYNE_OWNER=global"\r
set "MNEMOPI_SESSION_ID=%MNEMOSYNE_OWNER%"\r
set "MNEMOPI_CHANNEL_ID=%MNEMOSYNE_OWNER%"\r
${embeddings ? 'set "MNEMOPI_NO_EMBEDDINGS="' : 'set "MNEMOPI_NO_EMBEDDINGS=1"'}\r
set "MNEMOPI_MCP_BANK=default"\r
set "MNEMOPI_LLM_BASE_URL="\r
set "MNEMOPI_HOST_LLM_ENABLED="\r
set "MNEMOPI_AUTHOR_ID="\r
set "MNEMOPI_AUTHOR_TYPE="\r
set "MNEMOPI_POLYPHONIC_RECALL=0"\r
set "MNEMOPI_EMBEDDING_API_URL="\r
set "MNEMOPI_EMBEDDINGS_VIA_API="\r
set "MNEMOPI_EMBEDDING_API_KEY="\r
set "MNEMOPI_EMBEDDING_MODEL=${EMBEDDINGS_MODEL}"\r
set "MNEMOPI_EMBEDDING_DIM="\r
set "OPENROUTER_BASE_URL="\r
set "OPENROUTER_API_KEY="\r
set "OPENAI_API_KEY="\r
set "MNEMOPI_EMBEDDINGS_API_OPT_IN=0"\r
set "HF_ENDPOINT=https://huggingface.co"\r
set "PI_CONFIG_DIR=${EMBEDDINGS_CACHE_DIR}"\r
set "MNEMOSYNE_CLI=${cli}"\r
set "MNEMOSYNE_ACTIVITY_LOG=${activity}"\r
set "MNEMOSYNE_GUARD_MODE=${guardMode}"\r
bun "${proxy}"\r
`

async function isInstalled($: EngineInterface, options: PluginOptions) {
  try {
    return (await $.fs.stat((await paths($, options)).cli)).kind === 'file'
  } catch {
    return false
  }
}

// The one "engine is current" check: the installed engine is this plugin's
// build (ENGINE_BUILD), so it has the metadata update and the recall flag.
async function isCurrent($: EngineInterface, options: PluginOptions) {
  try {
    const { engine } = await paths($, options)
    const installed = JSON.parse(await $.fs.read(`${engine}/node_modules/${ENGINE_PACKAGE}/package.json`))
    return installed?.version === ENGINE_BUILD
  } catch {
    return false
  }
}

// memory_update's engine arguments, or the reason it is refused before any engine run.
function updateArgs(input: Record<string, unknown>): Record<string, unknown> | string {
  const hasContent = typeof input.content === 'string'
  const hasImportance = typeof input.importance === 'number' && Number.isFinite(input.importance)
  if (input.tags !== undefined && !Array.isArray(input.tags)) return 'tags must be an array of strings.'
  const hasKind = input.kind !== undefined && input.kind !== null
  const refused = kindProblem(input.kind)
  if (refused !== undefined) return refused
  if (!hasContent && !hasImportance && input.tags === undefined && !hasKind) return 'memory_update needs content, importance, tags or kind.'
  const tags = Array.isArray(input.tags) ? cleanTags(input.tags) : undefined
  return {
    memory_id: input.memory_id,
    ...(hasContent ? { content: input.content } : {}),
    ...(hasImportance ? { importance: clamp(input.importance, 0, 1, 0.5) } : {}),
    // The kind goes to the engine as memory_type.
    ...(hasKind ? { memory_type: input.kind } : {}),
    // An empty list removes the key (C7).
    ...(tags !== undefined ? { metadata: { tags: tags.length > 0 ? tags : null } } : {}),
    // C10.2: a content change names Claude in the audit trail.
    ...(hasContent ? { validator: 'claude-code' } : {}),
  }
}

// One engine process answering each request in turn; per request, its text or
// the engine's error.
async function runAll(
  $: EngineInterface,
  options: PluginOptions,
  requests: readonly EngineRequest[],
  as?: string,
  timeoutMs = 20_000,
) {
  const [id, { cli, store }] = await Promise.all([as ?? owner($, options), paths($, options)])
  const embeddings = await embeddingsOn($, options)
  const ran = await $.process.run(['bun', cli, 'mcp'], {
    stdin: buildRequests(requests),
    env: engineEnv(store, id, { embeddings }),
    timeoutMs,
  })
  return parseReplies(requests.length, ran.stdout, ran.exitCode, ran.stderr)
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

// What /mnemosyne-setup saves into blank settings, so the settings screen shows
// a value to edit: it draws text and list fields only once they hold one.
const DEFAULTS: Readonly<Record<string, string>> = {
  memoryDir: '~/.claude/mnemosyne/store',
  rememberTerms: 'remember:, remember that, note that, save to memory',
  recallTerms: 'recall:, what do you remember about, check memory',
}

// Fills blank settings through Claude Code's own `plugin configure`, never by
// editing settings.json; a plugin loaded from a folder (--plugin-dir) has no
// installed id and is left alone. Resolves to the keys it filled.
async function fillDefaults($: EngineInterface) {
  const id = `${$.plugin.name}@${$.plugin.name}`
  const shown = await $.process.run(['claude', 'plugin', 'configure', id, '--json'])
  if (shown.exitCode !== 0) return []
  const inputs: Record<string, string> = JSON.parse(shown.stdout).inputs ?? {}
  const blank = Object.fromEntries(Object.entries(DEFAULTS).filter(([key]) => !inputs[key]?.trim()))
  if (Object.keys(blank).length === 0) return []
  const saved = await $.process.run(['claude', 'plugin', 'configure', id, '--values-stdin'], { stdin: JSON.stringify(blank) })
  return saved.exitCode === 0 ? Object.keys(blank) : []
}

// Shows what Mnemosyne just did: a dim transcript line (`on`) and a status line
// under the prompt (`on`, `status`). Not sent to the model; never throws.
function activity($: EngineInterface, options: PluginOptions, line: string, status?: string) {
  const mode = options.showActivity === 'off' || options.showActivity === 'status' ? options.showActivity : 'on'
  try {
    if (mode === 'on') $.ui.log(`Mnemosyne: ${line}`)
    if (mode !== 'off') $.ui.status(`Mnemosyne · ${status ?? line}`)
  } catch {
    // a UI failure must not break a hook
  }
}

// How a hook hands its activity lines to `bun bin/activity.ts <log>` (DESIGN
// §3.2). A hook cannot append to a file, so one short Bun process per memory
// event does it.
//   spawn  a $.process.spawn loop drained in a detached task; the script caps itself at 5 s (default)
//   run    $.process.run with a 5 s timeout, not awaited
//   await  $.process.run awaited, capped at 1 s
// `spawn` is the default because the host documents that a spawned child's loop
// runs on after the hook returns; it says nothing either way about an
// un-awaited run. MNEMOSYNE_ACTIVITY_APPEND in Claude Code's environment picks
// a fallback; DEFAULT_APPEND otherwise.
export const APPEND_MODES = ['run', 'spawn', 'await'] as const
type AppendMode = (typeof APPEND_MODES)[number]
const DEFAULT_APPEND: AppendMode = 'spawn'
export const APPEND_TIMEOUT_MS = 5_000
export const APPEND_AWAIT_CAP_MS = 1_000

type Activity = Omit<ActivityFields, 'owner'> & { owner?: string }

// Records memory calls in activity.jsonl unless activityLog is off. Waits only
// for the paths (host calls), never for the write, and never throws.
async function record($: EngineInterface, options: PluginOptions, entries: readonly Activity[]) {
  if (options.activityLog === 'off' || entries.length === 0) return
  try {
    const [{ activity: log }, asked, me] = await Promise.all([
      paths($, options),
      $.env.get('MNEMOSYNE_ACTIVITY_APPEND').catch(() => undefined),
      entries.every(entry => entry.owner) ? undefined : owner($, options).catch(() => GLOBAL_OWNER),
    ])
    // The session id is best-effort: a failure to read it must never drop the line (CTX.3.a3).
    let session: string | undefined
    try {
      session = await $.session.id()
    } catch {
      session = undefined
    }
    const mode = APPEND_MODES.find(m => m === asked) ?? DEFAULT_APPEND
    const argv = ['bun', `${slashes($.plugin.root)}/bin/activity.ts`, log]
    const stdin = entries
      .map(entry => `${activityLine({ ...entry, owner: entry.owner ?? me ?? GLOBAL_OWNER, client: entry.client ?? 'claude-code', session: entry.session ?? session })}\n`)
      .join('')
    if (mode === 'spawn') {
      void (async () => {
        for await (const _piece of $.process.spawn({ argv, input: stdin })) {
          // drained only: the script writes nothing worth reading
        }
      })().catch(() => undefined)
    } else if (mode === 'await') {
      await $.process.run(argv, { stdin, timeoutMs: APPEND_AWAIT_CAP_MS }).catch(() => undefined)
    } else {
      void $.process.run(argv, { stdin, timeoutMs: APPEND_TIMEOUT_MS }).catch(() => undefined)
    }
  } catch {
    // a log failure must not break a hook
  }
}

// ---- /mnemosyne-tags: the one-time tag backfill (hooks/backfill.ts, bin/memories.ts) ----

const TAGS_USAGE = 'Usage: /mnemosyne-tags (a dry run: Haiku proposes tags, nothing is written) or /mnemosyne-tags apply (writes the saved proposals).'
// apply's one engine process per owner may carry every proposal of that owner.
const APPLY_TIMEOUT_MS = 120_000
const MEMORIES_TIMEOUT_MS = 60_000
// The C9 backup copies the whole store (VACUUM INTO), so it gets longer than a listing.
const BACKUP_TIMEOUT_MS = 300_000

/**
 * C9: every apply command backs the store up first and stops if that fails. Returns the stop message, or
 * undefined when the backup was made. The message names the cause and says nothing was changed.
 */
async function backupFirst($: EngineInterface, options: PluginOptions, command: string): Promise<string | undefined> {
  try {
    const { root } = await paths($, options)
    // The data root is named, because a custom memoryDir does not sit under it.
    const made = JSON.parse(await memoriesCli($, options, ['backup', root], undefined, BACKUP_TIMEOUT_MS)) as { path?: unknown; rows?: unknown }
    if (typeof made.path !== 'string') throw new Error('the backup reported no file')
    progress($, `backed up ${typeof made.rows === 'number' ? plural(made.rows, 'memory', 'memories') : 'the store'}`)
    return undefined
  } catch (err) {
    return `Stopped: the backup before the change failed (${(err as Error).message.slice(0, 300)}). No memory was changed. Fix that, then run ${command} again.`
  }
}

// bin/memories.ts: lists and reads rows from a read-only handle, and saves the proposals file.
async function memoriesCli($: EngineInterface, options: PluginOptions, args: readonly string[], stdin?: string, timeoutMs = MEMORIES_TIMEOUT_MS) {
  const { store } = await paths($, options)
  // --store goes first, before the command: the script refuses a second one, so no id can redirect the read.
  // save and pending name their own folder (the data root) and refuse --store.
  const ran = await $.process.run(['bun', `${slashes($.plugin.root)}/bin/memories.ts`, ...(args[0] === 'save' || args[0] === 'pending' ? [] : ['--store', store]), ...args], {
    ...(stdin === undefined ? {} : { stdin }),
    timeoutMs,
  })
  if (ran.exitCode !== 0) throw new Error(`bin/memories.ts ${args[0]} failed: ${`${ran.stderr}\n${ran.stdout}`.trim().slice(-300)}`)
  // The host keeps 4 MiB of stdout; a cut listing would be broken JSON and a misleading error.
  if (ran.isStdoutTruncated) throw new Error(`the output of bin/memories.ts ${args[0]} was cut at 4 MiB: too many memories for one run`)
  return ran.stdout
}

// A progress line under the prompt; a UI failure must not stop the run.
function progress($: EngineInterface, text: string) {
  try {
    $.ui.status(`Mnemosyne · ${text}`)
  } catch {
    // no status line
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// The dry run: one Haiku call per untagged memory, saved as proposals; no memory changes.
export async function tagsDryRun($: EngineInterface, options: PluginOptions, signal: AbortSignal) {
  const { root } = await paths($, options)
  const listed = parseRows(await memoriesCli($, options, ['list', '--untagged']))
  // A row whose metadata is not a JSON object cannot take a metadata merge: no model call for it, and it is named below.
  const rows = listed.filter(row => row.taggable)
  const blocked = listed.filter(row => !row.taggable)
  const blockedNote = blocked.length === 0 ? '' : `${plural(blocked.length, 'memory', 'memories')} cannot be tagged (their metadata is not a JSON object): ${blocked.slice(0, 10).map(row => row.id).join(', ')}${blocked.length > 10 ? ', …' : ''}.`
  if (rows.length === 0) return [blocked.length === 0 ? 'Every memory already has tags; nothing to propose.' : 'No memory can be tagged; nothing to propose.', blockedNote].filter(Boolean).join('\n')
  const proposed: (Proposal | undefined)[] = rows.map(() => undefined)
  const skipped = { failed: 0, empty: 0, aborted: 0 }
  let firstError = ''
  let done = 0
  const model = extractionModelOf(options)
  if (extractionOff(model)) return 'Knowledge extraction is off (extractionModel in the plugin settings is "off"): no tags proposed. Set extractionModel, then try again.'
  progress($, `tagging 0/${rows.length}`)
  await pool(rows, BACKFILL_CONCURRENCY, signal, async (row, i) => {
    try {
      // The memory's text goes in the prompt as a quoted string, to a model that is told it is data.
      const reply = await $.model.complete(
        { model, system: SYSTEM_PROMPT, prompt: tagPrompt(row.content), maxTokens: BACKFILL_MAX_TOKENS, timeoutMs: BACKFILL_CALL_TIMEOUT_MS },
        { signal },
      )
      if (!reply.isAnswered) {
        if (reply.reason === 'aborted') skipped.aborted++
        else {
          skipped.failed++
          firstError ||= reply.reason === 'api-error' ? `api-error ${reply.status ?? 'no response'} ${reply.error}` : reply.reason
        }
      } else {
        const tags = parseTags(reply.text)
        if (tags.length === 0) skipped.empty++
        else proposed[i] = { id: row.id, owner: row.owner, tags, sha256: row.sha256 }
      }
    } catch (err) {
      skipped.failed++
      firstError ||= (err as Error).message
    }
    progress($, `tagging ${++done}/${rows.length}`)
  })
  if (signal.aborted) {
    progress($, 'tagging stopped')
    return `Stopped after ${done} of ${rows.length} memories. Nothing was saved and no memory was changed; run /mnemosyne-tags again.`
  }
  const proposals = proposed.filter((p): p is Proposal => p !== undefined)
  const byId = new Map(rows.map(row => [row.id, row]))
  const lines = proposals.map(p => `${p.id}  ${p.owner}  [${p.tags.join(', ')}]  ${Array.from(byId.get(p.id)?.content ?? '').slice(0, 60).join('').replace(/\s+/g, ' ')}`)
  const notes = [
    skipped.empty > 0 ? `${plural(skipped.empty, 'memory', 'memories')} got no usable tags` : '',
    skipped.failed > 0 ? `${plural(skipped.failed, 'call')} failed (${firstError})` : '',
    skipped.aborted > 0 ? `${plural(skipped.aborted, 'call')} ${skipped.aborted === 1 ? 'was' : 'were'} cut short` : '',
  ].filter(Boolean)
  if (proposals.length === 0) {
    progress($, 'tagging found nothing')
    return `No tags were proposed for ${plural(rows.length, 'memory', 'memories')}${notes.length > 0 ? `: ${notes.join('; ')}` : ''}. Nothing was saved.${blockedNote ? `\n${blockedNote}` : ''}`
  }
  await memoriesCli($, options, ['save', `${root}/${PROPOSALS_FILE}`], JSON.stringify({ proposals }))
  progress($, `${proposals.length} tag proposals saved`)
  return [
    `Proposed tags for ${proposals.length} of ${plural(rows.length, 'untagged memory', 'untagged memories')}; no memory was changed.`,
    ...lines,
    ...(notes.length > 0 ? [`Skipped: ${notes.join('; ')}.`] : []),
    ...(blockedNote ? [blockedNote] : []),
    `Saved to ${root}/${PROPOSALS_FILE} (ids, owners, tags and a hash of each text; never the text). Run /mnemosyne-tags apply to write them.`,
  ].join('\n')
}

// ---- Knowledge extraction (KNOWX.2, hooks/knowledge.ts) ----

// One engine process answers a batch of prompts or stores; the longest wait is the batch's.
const KNOWLEDGE_ENGINE_TIMEOUT_MS = 120_000

// The memory id a remember/update reply names, or undefined when it names none.
function savedId(reply: string): string | undefined {
  try {
    const value = JSON.parse(reply) as Record<string, unknown>
    // remember answers memory_id; update echoes it for any change, so the caller also checks the content changed.
    const id = typeof value?.memory_id === 'string' ? value.memory_id : undefined
    return id !== undefined && /^[0-9a-f]{1,64}$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

/** The engine call for knowledge: requests -> per request its text or its error, in one engine process, as the owner. */
function knowledgeEngine($: EngineInterface, options: PluginOptions): KnowledgeEngine {
  return (requests, owner) => runAll($, options, requests.map(([name, args]) => [name, args] as const), owner, KNOWLEDGE_ENGINE_TIMEOUT_MS)
}

/** The learn line's `text`: the source memory's first line, about 120 characters (the log writer masks secrets). Nothing when unknown. */
function sourceText(source: string | undefined): { text?: string } {
  const line = (source ?? '').split('\n').map(part => part.trim()).find(part => part !== '')
  return line === undefined ? {} : { text: Array.from(line).slice(0, 120).join('') }
}

/**
 * One extraction for one memory, run after the tool reply (KNOWX.2). Never throws:
 * every outcome - stored, empty, failed, stale, gone - is one 'extract' activity
 * line, and nothing runs while the engine is stale or extraction is off.
 */
export async function extraction($: EngineInterface, options: PluginOptions, id: string, as: string, queue?: <T>(work: () => Promise<T>) => Promise<T>, source?: string) {
  const model = extractionModelOf(options)
  if (extractionOff(model)) return
  if (!(await isCurrent($, options))) {
    await record($, options, [{ action: 'extract', origin: 'tool', owner: as, ok: false, error: 'engine out of date', ids: [id], count: 0, ...sourceText(source) }])
    return
  }
  const { root } = await paths($, options)
  let outcome: ExtractOutcome
  try {
    outcome = await extractOne({
      id,
      owner: as,
      root,
      model,
      ...(queue === undefined ? {} : { queue }),
      engine: knowledgeEngine($, options),
      memories: (args, stdin) => memoriesCli($, options, args as string[], stdin),
      modelCall: async request => {
        try {
          const reply = await $.model.complete(request, {})
          return reply.isAnswered ? { text: reply.text } : { reason: reply.reason }
        } catch (err) {
          return { reason: (err as Error)?.message ?? 'rejected' }
        }
      },
    })
  } catch (err) {
    outcome = { kind: 'failed', reason: (err as Error)?.message ?? 'failed' }
  }
  const failed = reasonLine(outcome)
  await record($, options, [
    {
      action: 'extract',
      origin: 'tool',
      owner: as,
      ids: [id],
      count: storedCount(outcome),
      ok: failed === undefined,
      ...(failed === undefined ? {} : { error: failed }),
      ...sourceText(source),
    },
  ])
}

// ---- /mnemosyne-knowledge: the backfill (KNOWX.3) ----

export const KNOWLEDGE_USAGE =
  'Usage: /mnemosyne-knowledge (a dry run: counts pending entries and memories with no knowledge; nothing is written) or /mnemosyne-knowledge apply (extracts for them).'

// /mnemosyne-embed: fills vectors for memories saved before embeddings were on.
export const EMBED_USAGE =
  'Usage: /mnemosyne-embed (a dry run: how many memories have no vector), /mnemosyne-embed apply (fills the missing vectors) or /mnemosyne-embed rebuild (also allows a model change, which wipes and rebuilds every vector).'
// One engine process embeds every missing memory; the model is loaded once.
export const REEMBED_TIMEOUT_MS = 600_000

// The empty records file: a memory whose extraction yielded nothing, so apply skips it.
const EMPTY_NAME = 'knowledge-empty.json'

/** The empty-record list, read from <root>/knowledge-empty.json; a missing or broken file is empty. */
async function readEmptyFile($: EngineInterface, root: string): Promise<Record<string, string>> {
  try {
    const parsed = JSON.parse(await $.fs.read(`${root}/${EMPTY_NAME}`)) as { empty?: unknown }
    const out: Record<string, string> = {}
    if (Array.isArray(parsed?.empty)) {
      for (const entry of parsed.empty as { id?: unknown; sha256?: unknown }[]) {
        if (typeof entry?.id === 'string' && typeof entry.sha256 === 'string') out[entry.id] = entry.sha256
      }
    }
    return out
  } catch {
    return {}
  }
}

async function writeEmptyFile($: EngineInterface, root: string, empty: Record<string, string>) {
  const list = Object.entries(empty).map(([id, sha256]) => ({ id, sha256 }))
  // The same atomic 0600 write bunFs gives the other plugin files; fs.chmod is a no-op on Windows.
  await bunFs(
    $,
    'const t = a[0] + ".tmp"; fs.rmSync(t, { force: true }); fs.writeFileSync(t, a[1], { mode: 0o600, flag: "wx" }); fs.chmodSync(t, 0o600); fs.renameSync(t, a[0]);',
    `${root}/${EMPTY_NAME}`,
    `${JSON.stringify({ empty: list }, null, 2)}\n`,
  )
}

/** The pending entries and the memories with no knowledge, grouped by owner. */
async function knowledgeSurvey($: EngineInterface, options: PluginOptions) {
  const { root } = await paths($, options)
  const pending = JSON.parse(await memoriesCli($, options, ['pending', 'list', root])) as { id: string; owner: string; sha256: string }[]
  const rows = parseRows(await memoriesCli($, options, ['list', '--no-knowledge']))
  return { root, pending, rows }
}

/**
 * /mnemosyne-knowledge with no argument: per owner, how many memories have no
 * knowledge and how many pending entries wait. No model call, no write.
 */
export async function knowledgeDryRun($: EngineInterface, options: PluginOptions) {
  const model = extractionModelOf(options)
  if (extractionOff(model)) return 'Knowledge extraction is off (extractionModel is "off"): set it, then try again.'
  if (!(await isCurrent($, options))) return 'The Mnemosyne engine is out of date (the backfill needs the knowledge tools): run /mnemosyne-setup, then try again.'
  const { root, pending, rows } = await knowledgeSurvey($, options)
  const empty = await readEmptyFile($, root)
  const perOwner = new Map<string, { missing: number; pending: number; empty: number; forgotten: number }>()
  const bump = (owner: string, field: 'missing' | 'pending' | 'empty' | 'forgotten') => {
    const entry = perOwner.get(owner) ?? { missing: 0, pending: 0, empty: 0, forgotten: 0 }
    entry[field]++
    perOwner.set(owner, entry)
  }
  for (const row of rows) {
    // A memory whose extraction yielded nothing is not "missing": it is done.
    if (empty[row.id] === row.sha256) bump(row.owner, 'empty')
    else bump(row.owner, 'missing')
  }
  // A pending entry whose memory is gone (or is not that owner's) waits for nothing: apply only drops it.
  const alive = new Map<string, string>()
  const pendingIds = [...new Set(pending.map(entry => entry.id))]
  for (let at = 0; at < pendingIds.length; at += GET_BATCH) {
    for (const row of parseRows(await memoriesCli($, options, ['get', ...pendingIds.slice(at, at + GET_BATCH)]))) alive.set(row.id, row.owner)
  }
  for (const entry of pending) bump(entry.owner, alive.get(entry.id) === entry.owner ? 'pending' : 'forgotten')
  if (perOwner.size === 0) return 'Every memory has knowledge, and no pending entry waits. Nothing to do.'
  const lines = [...perOwner].map(
    ([owner, counts]) =>
      `- ${owner}: ${plural(counts.missing, 'memory', 'memories')} with no knowledge, ${plural(counts.pending, 'pending entry', 'pending entries')}, ${plural(counts.empty, 'memory', 'memories')} already tried (nothing found)${counts.forgotten > 0 ? `, ${plural(counts.forgotten, 'entry', 'entries')} of forgotten memories (apply drops them)` : ''}`,
  )
  return [
    'Knowledge extraction dry run: no model call, nothing written.',
    ...lines,
    'Run /mnemosyne-knowledge apply to extract. Try apply on a copy of the store first.',
  ].join('\n')
}

/**
 * /mnemosyne-knowledge apply: finishes the pending entries first (each from its
 * current content and current sha256, so a changed memory is redone), then the
 * older memories with no knowledge. Per owner, in batches of GET_BATCH memories:
 * one engine process for the prompts, one memories call writing the pending
 * entries, the model calls in a pool, one engine process for the stores, one
 * memories call removing the finished entries. Never edits or deletes a
 * working_memory row.
 */
export async function knowledgeApply($: EngineInterface, options: PluginOptions, signal: AbortSignal) {
  const model = extractionModelOf(options)
  if (extractionOff(model)) return 'Knowledge extraction is off (extractionModel is "off"): set it, then try again.'
  if (!(await isCurrent($, options))) return 'The Mnemosyne engine is out of date (the backfill needs the knowledge tools): run /mnemosyne-setup, then try again.'
  const { root, pending, rows } = await knowledgeSurvey($, options)
  const empty = await readEmptyFile($, root)
  const counts = { stored: 0, empty: 0, failed: 0, stale: 0, gone: 0, notReached: 0 }
  let items = 0

  // Pending entries first (a gone memory drops its entry), then the memories with no knowledge.
  const seen = new Set<string>()
  const targets: { id: string; owner: string; pendingSha?: string }[] = []
  for (const entry of pending) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    targets.push({ id: entry.id, owner: entry.owner, pendingSha: entry.sha256 })
  }
  for (const row of rows) {
    if (seen.has(row.id)) continue
    if (empty[row.id] === row.sha256) continue
    seen.add(row.id)
    targets.push({ id: row.id, owner: row.owner })
  }
  if (targets.length === 0) return 'Nothing to extract: every memory has knowledge, and no pending entry waits.'

  // Per owner, in the order found, GET_BATCH memories to a batch.
  const byOwner = new Map<string, typeof targets>()
  for (const target of targets) byOwner.set(target.owner, [...(byOwner.get(target.owner) ?? []), target])
  const batches: { owner: string; list: typeof targets }[] = []
  for (const [who, list] of byOwner) for (let at = 0; at < list.length; at += GET_BATCH) batches.push({ owner: who, list: list.slice(at, at + GET_BATCH) })

  progress($, `extracting 0/${targets.length}`)
  let called = 0
  for (const { owner: who, list } of batches) {
    if (signal.aborted) break
    const outcomes = await extractMany({
      items: list.map(({ id, pendingSha }) => ({ id, ...(pendingSha === undefined ? {} : { pendingSha }) })),
      owner: who,
      root,
      model,
      engine: knowledgeEngine($, options),
      memories: (args, stdin) => memoriesCli($, options, args as string[], stdin),
      pool: (work, run) => pool(work, BACKFILL_CONCURRENCY, signal, run),
      onModelDone: () => progress($, `extracting ${++called}/${targets.length}`),
      modelCall: async request => {
        try {
          const reply = await $.model.complete(request, { signal })
          return reply.isAnswered ? { text: reply.text } : { reason: reply.reason }
        } catch (err) {
          return { reason: (err as Error)?.message ?? 'rejected' }
        }
      },
    })
    const logged: Activity[] = []
    outcomes.forEach((outcome, i) => {
      const target = list[i]!
      if (outcome.kind === 'notReached') return
      items++
      if (outcome.kind === 'empty') {
        // A memory whose extraction yields nothing is recorded and skipped while its sha is unchanged.
        const row = rows.find(candidate => candidate.id === target.id)
        if (row !== undefined) empty[row.id] = row.sha256
      }
      if (outcome.kind === 'stored') counts.stored++
      else if (outcome.kind === 'empty') counts.empty++
      else if (outcome.kind === 'stale') counts.stale++
      else if (outcome.kind === 'gone') counts.gone++
      else counts.failed++
      const failed = reasonLine(outcome)
      logged.push({
        action: 'extract',
        origin: 'backfill',
        owner: who,
        client: 'mnemosyne-knowledge',
        ids: [target.id],
        count: storedCount(outcome),
        ok: failed === undefined,
        ...(failed === undefined ? {} : { error: failed }),
      })
    })
    // One append process for the batch.
    await record($, options, logged)
  }
  // What the run did not reach: the pool stops starting calls once aborted, so this is counted, not tallied as it goes.
  counts.notReached = targets.length - items
  if (Object.keys(empty).length > 0) await writeEmptyFile($, root, empty).catch(() => undefined)
  progress($, `${counts.stored} extracted`)
  return [
    `Extracted knowledge for ${counts.stored} of ${plural(targets.length, 'memory', 'memories')}.`,
    `Outcomes: ${counts.empty} found nothing (noted, skipped while the text is unchanged), ${counts.stale} changed mid-run (run apply again), ${counts.gone} gone, ${counts.failed} failed.`,
    ...(counts.notReached > 0 ? [`Stopped early: ${plural(counts.notReached, 'memory', 'memories')} not reached; run /mnemosyne-knowledge apply again to finish.`] : []),
  ].join('\n')
}

// apply: re-reads each owner's proposed rows just before writing that owner's tags and writes only where
// nothing changed since the dry run. No model call.
// The remaining window: a row can still gain tags between its re-read and the engine's update (a few
// hundred milliseconds, within one owner). The update replaces metadata.tags, so a tag Claude added in that
// window would be overwritten. The window is not closed, only kept small.
export async function tagsApply($: EngineInterface, options: PluginOptions, signal: AbortSignal) {
  const { root } = await paths($, options)
  const file = `${root}/${PROPOSALS_FILE}`
  if (!(await $.fs.stat(file).then(() => true, () => false))) return 'No saved proposals: run /mnemosyne-tags (the dry run) first.'
  let proposals: Proposal[]
  try {
    proposals = parseProposals(await $.fs.read(file))
  } catch (err) {
    return `The saved proposals cannot be used (${(err as Error).message}): run /mnemosyne-tags again.`
  }
  if (proposals.length === 0) return 'The saved proposals list is empty: run /mnemosyne-tags again.'
  // C9: the backup comes before the first write; a failed backup stops the run.
  const stopped = await backupFirst($, options, '/mnemosyne-tags apply')
  if (stopped !== undefined) return stopped
  const byOwner = new Map<string, Proposal[]>()
  for (const proposal of proposals) byOwner.set(proposal.owner, [...(byOwner.get(proposal.owner) ?? []), proposal])
  const counts = { gone: 0, tagged: 0, untaggable: 0, changed: 0 }
  let written = 0
  let failed = 0
  let notReached = 0
  let checked = 0
  let firstError = ''
  for (const [id, proposed] of byOwner) {
    if (signal.aborted) {
      notReached += proposed.length
      continue
    }
    progress($, `writing tags ${checked}/${proposals.length}`)
    // Re-read this owner's rows now, not before the earlier owners' writes: Claude may have tagged one meanwhile.
    const current = new Map<string, Row>()
    for (let at = 0; at < proposed.length; at += GET_BATCH) {
      const ids = proposed.slice(at, at + GET_BATCH).map(p => p.id)
      for (const row of parseRows(await memoriesCli($, options, ['get', ...ids]))) current.set(row.id, row)
    }
    const list: Proposal[] = []
    for (const proposal of proposed) {
      const verdict = judge(proposal, current.get(proposal.id))
      if (verdict === 'write') list.push(proposal)
      else counts[verdict]++
    }
    checked += proposed.length
    if (list.length === 0) continue
    let ownerError = ''
    const requests: EngineRequest[] = list.map(p => ['mnemopi_update', { memory_id: p.id, metadata: { tags: p.tags } }])
    const answers = await runAll($, options, requests, id, APPLY_TIMEOUT_MS).catch(err => requests.map(() => err as Error))
    const done = list.filter((_, i) => {
      const answer = answers[i]
      if (typeof answer === 'string' && callOutcome('update', {}, answer).ok) return true
      ownerError ||= answer instanceof Error ? answer.message : (callOutcome('update', {}, answer ?? '').error ?? 'the engine gave no reply')
      return false
    })
    written += done.length
    failed += list.length - done.length
    firstError ||= ownerError
    // One error per owner: another owner's failure does not show up on this owner's line.
    await record($, options, [
      {
        action: 'update',
        origin: 'backfill',
        owner: id,
        client: 'mnemosyne-tags',
        text: `tag backfill: ${plural(list.length, 'memory', 'memories')}`,
        ids: done.map(p => p.id),
        count: done.length,
        ok: done.length === list.length,
        error: ownerError,
      },
    ])
  }
  progress($, `${plural(written, 'memory', 'memories')} tagged`)
  return [
    `Tagged ${plural(written, 'memory', 'memories')} of ${proposals.length} proposed.`,
    `Skipped: ${counts.gone} gone, ${counts.tagged} already tagged, ${counts.untaggable} cannot be tagged (metadata is not a JSON object), ${counts.changed} changed since the dry run.`,
    ...(failed > 0 ? [`${plural(failed, 'update')} failed (${firstError}).`] : []),
    ...(notReached > 0 ? [`Stopped early: ${plural(notReached, 'memory', 'memories')} not reached; run /mnemosyne-tags apply again to finish.`] : []),
  ].join('\n')
}

export const register: Register = (on, options) => {
  const isPerProject = options.scope === 'per-project'
  // Per session, the tail of its extraction chain (one at a time).
  const extractions = new Map<string, Promise<unknown>>()

  const engineArgs = (tool: string, input: Record<string, unknown>) => {
    switch (tool) {
      case 'memory_remember': {
        const isGlobal = !isPerProject || input.global === true
        // Tags are cleaned as the engine stores them (hooks/tags.ts); none left, no metadata.
        const tags = Array.isArray(input.tags) ? cleanTags(input.tags) : []
        const validUntil = validUntilFor(input.kind, input.expires_in_days)
        return [
          'mnemopi_remember',
          {
            content: input.content,
            importance: clamp(input.importance, 0, 1, 0.5),
            // C4: Claude's own save. source and trust_tier say who wrote it; the trim spares it by scope
            // (always explicit, so a re-save of the same text never lands as 'session'), not by a label.
            source: 'claude-code',
            trust_tier: 'DERIVED',
            // veracity is left to the engine's default, 'unknown'.
            scope: isGlobal ? 'global' : 'channel',
            // Claude's own save: an agent wrote it (KNOWX.1.a3). A trigger save
            // overrides this with human + 'stated' in tool.call.
            author_id: 'claude-code',
            author_type: 'agent',
            // The kind goes to the engine as memory_type; none given, the engine stores 'unknown'.
            ...(typeof input.kind === 'string' ? { memory_type: input.kind } : {}),
            // A context note fades after 14 days unless the call gives expires_in_days.
            ...(validUntil === undefined ? {} : { valid_until: validUntil }),
            ...(tags.length > 0 ? { metadata: { tags } } : {}),
          },
        ] as const
      }
      case 'memory_recall':
        return ['mnemopi_recall', { query: input.query, limit: clamp(input.limit, 1, 50, RECALL_LIMIT) }] as const
      case 'memory_forget':
        return ['mnemopi_forget', { memory_id: input.memory_id }] as const
      case 'memory_update': {
        const args = updateArgs(input)
        // tool.call refuses a bad update before any engine run; this only narrows the type.
        if (typeof args === 'string') throw new Error(args)
        return ['mnemopi_update', args] as const
      }
      default:
        return ['mnemopi_stats', {}] as const
    }
  }

  on('session.start', { cwd: /.*/ }, async ($, e, next) => {
    await $.command.register({
      name: 'mnemosyne-setup',
      description: `Install the Mnemosyne Memory engine (${ENGINE_PACKAGE} ${ENGINE_BUILD}, the plugin's own copy) into ~/.claude/mnemosyne`,
    })
    await $.command.register({
      name: 'mnemosyne-tags',
      description: 'Tag the existing memories once: a dry run lets Haiku propose topic tags; "apply" writes them (no new model calls)',
    })
    await $.command.register({
      name: 'mnemosyne-ui',
      description: 'Open the Mnemosyne dashboard: a local page on 127.0.0.1, opened in your default browser',
    })
    await $.command.register({
      name: 'mnemosyne-knowledge',
      description: 'Extract knowledge from older memories and finish pending ones: a dry run counts them; "apply" extracts',
    })
    await $.command.register({
      name: 'mnemosyne-embed',
      description: 'Fill embeddings for memories saved before embeddings were on: a dry run counts them; "apply" fills them; "rebuild" also allows a model change',
    })
    for (const tool of TOOLS) await $.tool.register({ ...tool, isDeferred: false })
    if (!(await isInstalled($, options))) $.ui.toast('Mnemosyne Memory engine not installed. Run /mnemosyne-setup.')
    else {
      // A stale engine keeps the four older tools working; only memory_update refuses.
      if (!(await isCurrent($, options))) $.ui.toast('Mnemosyne Memory engine is out of date. Run /mnemosyne-setup to update it.')
      await Promise.all([secure($, options), syncWrapper($, options)]).catch(() => undefined)
      activity($, options, 'memory ready', 'ready')
    }

    return next(e)
  })

  on('command.run', { command: 'mnemosyne-setup' }, async $ => {
    const bun = await $.process.run(['bun', '--version']).catch(() => null)
    if (bun?.exitCode !== 0) return { text: 'Mnemosyne needs Bun on PATH: https://bun.sh' }

    try {
      const { engine, store, root: pluginRoot } = await paths($, options)
      // Creates <root> and the store first: the installer writes only <engine>, <engine>.next and <engine>.old.
      await secure($, options)
      const root = slashes($.plugin.root)
      // Embeddings: decide from the option (on / off / auto on macOS arm64). When
      // on, the install check downloads the model once; tell the person where it
      // comes from and how big it is before that download starts (EMB.3.a4).
      const setting = embeddingsSetting(options)
      const embeddings = setting === 'on' || (setting === 'auto' && (await isMacArm64($)))
      if (embeddings) {
        progress($, 'downloading the embedding model from huggingface.co (about 63 MB)')
        $.ui.log('Mnemosyne: /mnemosyne-setup downloads the embedding model BAAI/bge-small-en-v1.5 from huggingface.co (Qdrant/bge-small-en-v1.5-onnx-Q, about 63 MB), once.')
      }
      // Builds <engine>.next from the plugin's engine/ and swaps it in only once it answers (bin/install-engine.ts).
      const installed = await $.process.run(
        ['bun', `${root}/bin/install-engine.ts`, root, engine, store, ...(embeddings ? ['embeddings'] : [])],
        { timeoutMs: SETUP_TIMEOUT_MS },
      )
      if (installed.exitCode !== 0) {
        // M2: when embeddings were requested but the install check could not prove
        // the model loaded (no memory_embeddings row in the check store), the swap
        // was refused and no marker is written: report "embeddings off", not a
        // generic install failure.
        if (embeddings && /no memory_embeddings row|model did not load/i.test(`${installed.stderr}${installed.stdout}`)) {
          await bunFs($, 'fs.rmSync(a[0], { force: true })', `${pluginRoot}/${EMBEDDINGS_MARKER}`)
          return { text: 'Embeddings are off: the model did not load, so no memory_embeddings row was written, the engine was not swapped and no marker was written. Set the embeddings option to off and re-run /mnemosyne-setup, or re-run /mnemosyne-setup when online.' }
        }
        return { text: `Engine install failed; the engine already installed (if any) is unchanged:\n${`${installed.stderr}\n${installed.stdout}`.trim().slice(-800)}` }
      }
      // The model is on disk now (or embeddings are off): record which model, so
      // engine runs turn embeddings on only once setup has downloaded it. An off
      // setup removes a stale marker so an old download never re-enables them.
      if (embeddings) await writeEmbeddingsMarker($, pluginRoot)
      else await bunFs($, 'fs.rmSync(a[0], { force: true })', `${pluginRoot}/${EMBEDDINGS_MARKER}`)

      await syncWrapper($, options)
      const filled = await fillDefaults($).catch(() => [])
      const stats = mnemosyneStats(await call($, options, 'mnemopi_stats', {}))
      const { wrapper } = await paths($, options)
      const external =
        options.externalMcp === true ? `\nOther MCP clients: claude mcp add mnemosyne-memory -- ${wrapper}` : ''
      const saved = filled.length > 0 ? `\nSaved defaults for ${filled.join(', ')}; restart Claude Code to see them in /plugin.` : ''
      // M2: embeddings are reported on only after the install check proved the
      // model loaded (the marker is written above).
      const embeddingsNote = embeddings ? '\nEmbeddings on: the model is downloaded and local only.' : ''
      return { text: `Mnemosyne ready. Engine: ${engine}. Store: ${store}.${external}${saved}${embeddingsNote}\n${stats}` }
    } catch (err) {
      return { text: `Mnemosyne setup failed: ${(err as Error).message}` }
    }
  })

  // The dashboard: one shared server on 127.0.0.1 (hooks/ui-launch.ts, ui/server.ts).
  on('command.run', { command: 'mnemosyne-ui' }, async $ => {
    const bun = await $.process.run(['bun', '--version']).catch(() => null)
    if (bun?.exitCode !== 0) return { text: 'The Mnemosyne dashboard needs Bun on PATH: https://bun.sh' }
    try {
      if (!(await isInstalled($, options))) return { text: 'The Mnemosyne dashboard needs the engine: run /mnemosyne-setup first.' }
      if (!(await isCurrent($, options))) return { text: 'The Mnemosyne engine is out of date: run /mnemosyne-setup, then /mnemosyne-ui again.' }
      const { root, store, cli, activity: log } = await paths($, options)
      const activityLog = options.activityLog === 'off' ? '' : log
      const session = await $.session.id()
      const extraction = extractionModelOf(options)
      // C11: the server keeps the embeddings setting it starts with; 'on' only when
      // the model is downloaded, matching what engineEnv sends (EMB.3.a2).
      const embeddings = (await embeddingsOn($, options)) ? 'on' : 'off'
      return await openDashboard($, { plugin: slashes($.plugin.root), root, store, cli, activity: activityLog, extraction, embeddings }, session)
    } catch (err) {
      return { text: `Mnemosyne dashboard failed: ${(err as Error).message}` }
    }
  })

  // The tag backfill: no argument is a dry run (the only mode that calls a model); apply writes the saved proposals.
  on('command.run', { command: 'mnemosyne-tags' }, async ($, e, next) => {
    const mode = e.args.trim().toLowerCase()
    if (mode !== '' && mode !== 'apply') return { text: TAGS_USAGE }
    const bun = await $.process.run(['bun', '--version']).catch(() => null)
    if (bun?.exitCode !== 0) return { text: 'The tag backfill needs Bun on PATH: https://bun.sh' }
    try {
      if (!(await isInstalled($, options))) return { text: 'The tag backfill needs the engine: run /mnemosyne-setup first.' }
      if (!(await isCurrent($, options))) return { text: 'The Mnemosyne engine is out of date (the backfill needs memory_update): run /mnemosyne-setup, then try again.' }
      return { text: mode === 'apply' ? await tagsApply($, options, next.signal) : await tagsDryRun($, options, next.signal) }
    } catch (err) {
      return { text: `Mnemosyne tag backfill failed: ${(err as Error).message}` }
    }
  }).catch(() => ({ text: 'Mnemosyne: the tag backfill failed.' }))

  // The knowledge backfill: no argument is a dry run; apply extracts pending and older memories.
  on('command.run', { command: 'mnemosyne-knowledge' }, async ($, e, next) => {
    const mode = e.args.trim().toLowerCase()
    if (mode !== '' && mode !== 'apply') return { text: KNOWLEDGE_USAGE }
    const bun = await $.process.run(['bun', '--version']).catch(() => null)
    if (bun?.exitCode !== 0) return { text: 'The knowledge backfill needs Bun on PATH: https://bun.sh' }
    try {
      if (!(await isInstalled($, options))) return { text: 'The knowledge backfill needs the engine: run /mnemosyne-setup first.' }
      return { text: mode === 'apply' ? await knowledgeApply($, options, next.signal) : await knowledgeDryRun($, options) }
    } catch (err) {
      return { text: `Mnemosyne knowledge backfill failed: ${(err as Error).message}` }
    }
  }).catch(() => ({ text: 'Mnemosyne: the knowledge backfill failed.' }))

  // The embeddings backfill: no argument is a dry run, "apply" fills the vectors,
  // "rebuild" also allows a model change (which wipes and rebuilds every vector).
  on('command.run', { command: 'mnemosyne-embed' }, async ($, e) => {
    const mode = e.args.trim().toLowerCase()
    if (mode !== '' && mode !== 'apply' && mode !== 'rebuild') return { text: EMBED_USAGE }
    const bun = await $.process.run(['bun', '--version']).catch(() => null)
    if (bun?.exitCode !== 0) return { text: 'The embeddings backfill needs Bun on PATH: https://bun.sh' }
    try {
      if (!(await isInstalled($, options))) return { text: 'The embeddings backfill needs the engine: run /mnemosyne-setup first.' }
      if (!(await isCurrent($, options))) return { text: 'The Mnemosyne engine is out of date (the backfill needs the reembed command): run /mnemosyne-setup, then try again.' }
      const { cli, store } = await paths($, options)
      if (!(await embeddingsOn($, options))) {
        return { text: 'Embeddings are off: set the embeddings option to on (or run /mnemosyne-setup on macOS arm64 to download the model), then try again.' }
      }
      // Run the engine's own reembed command with the same local-only pins the hooks send.
      const ran = await $.process.run(['bun', cli, 'reembed', ...(mode === '' ? [] : [mode])], {
        env: engineEnv(store, GLOBAL_OWNER, { embeddings: true }),
        timeoutMs: REEMBED_TIMEOUT_MS,
      })
      const output = `${ran.stdout}${ran.stderr}`.trim()
      if (ran.exitCode !== 0 && output === '') return { text: `Mnemosyne embeddings backfill failed (exit ${ran.exitCode}).` }
      return { text: output.split('\n').slice(-6).join('\n') }
    } catch (err) {
      return { text: `Mnemosyne embeddings backfill failed: ${(err as Error).message}` }
    }
  }).catch(() => ({ text: 'Mnemosyne: the embeddings backfill failed.' }))

  // The session that started the dashboard ends (exit, /clear, resume...): its server stops.
  on('session.end', async ($, e, next) => {
    await stopDashboard($, e.sessionId).catch(() => undefined)
    return next(e)
  }).catch((_$, e, next) => next(e))

  on('tool.call', { tool: /^mcp__mnemosyne__memory_/ }, async ($, e) => {
    const tool = e.tool.replace('mcp__mnemosyne__', '')
    const input = e as unknown as Record<string, unknown>
    // A row is changed or deleted as its owner: a global fact from another project names its own.
    const ownsRow = tool === 'memory_forget' || tool === 'memory_update'
    const as = ownsRow && typeof input.owner === 'string' && input.owner ? input.owner : undefined
    // A memory_* name outside the five is not a memory call: not logged.
    const action = TOOL_ACTIONS[tool]
    // GUARD.2: the text of a save is checked before anything else. A block never starts an
    // engine process and never consumes the remember trigger, so the retry is still the human's.
    const saves = tool === 'memory_remember' || (tool === 'memory_update' && typeof input.content === 'string')
    const guard: GuardResult | undefined = saves
      ? admit({ content: input.content as string, kind: typeof input.kind === 'string' ? input.kind : undefined, origin: 'tool' })
      : undefined
    const guardIds = guard === undefined ? [] : [...new Set(guard.hits.map(hit => hit.rule))]
    const warnIds = guard?.verdict === 'warn' ? guardIds : []
    // Strict mode: a warned save is refused until the call says confirm: true. A block has no override.
    const needsConfirm = guard?.verdict === 'warn' && guardModeOf(options) === 'strict' && input.confirm !== true
    const refusedByGuard = guard?.verdict === 'block' || needsConfirm
    // KNOWX.1: only the main thread's first save after a remember phrase is the
    // human's. A subagent's event carries an agentId and never consumes the trigger.
    let provenance: { author_type: 'human'; veracity: 'stated' } | undefined
    if (tool === 'memory_remember' && e.agentId === undefined && !refusedByGuard) {
      const session = await $.session.id().catch(() => undefined)
      if (session !== undefined) {
        // Consumed inside the updater, which sees the value as it is when the update lands: of two saves at once only one takes it.
        let took = false
        await update($, pendingTrigger, seen => {
          if (!seen[session]) return seen
          took = true
          const { [session]: _consumed, ...rest } = seen
          return rest
        })
        if (took) provenance = { author_type: 'human', veracity: 'stated' }
      }
    }
    const answer = await (async (): Promise<{ result: string; reply: string } | { deny: string }> => {
      try {
        if (guard?.verdict === 'block') {
          return { deny: `Mnemosyne: the save guard blocked this save (${guardIds.join(', ')}). ${guard.hits.map(hit => hit.message).join(' ')}` }
        }
        if (needsConfirm) {
          return { deny: `Mnemosyne: the save guard warns about this save (${guardIds.join(', ')}). ${guard!.hits.map(hit => hit.message).join(' ')} Resend with confirm: true if the save is wanted.` }
        }
        if (tool === 'memory_remember') {
          const badKind = kindProblem(input.kind)
          if (badKind !== undefined) return { deny: `Mnemosyne: ${badKind}` }
          const badDays = expiresInDaysProblem(input.expires_in_days)
          if (badDays !== undefined) return { deny: `Mnemosyne: ${badDays}` }
        }
        if (tool === 'memory_update') {
          const refused = updateArgs(input)
          if (typeof refused === 'string') return { deny: `Mnemosyne: ${refused}` }
        }
        if (!(await isInstalled($, options))) {
          await paths($, options) // a bad HOME or memoryDir says so rather than "not installed"
          return { deny: NOT_INSTALLED }
        }
        if (tool === 'memory_update' && !(await isCurrent($, options))) return { deny: NOT_CURRENT }
        const [name, args] = engineArgs(tool, input)
        // The trigger save is the person's: human, with veracity 'stated'.
        // C4: source 'user' and trust tier STATED besides the human author and veracity 'stated'.
        const withProvenance = provenance === undefined ? args : { ...args, ...provenance, source: 'user', trust_tier: 'STATED' }
        // A warned save is stored, flagged with the rule ids in metadata.guard.
        // A content update that now passes the guard clean clears an old flag (null removes the key through the metadata merge).
        const clearsGuard = tool === 'memory_update' && typeof input.content === 'string' && warnIds.length === 0
        const sent: Record<string, unknown> =
          warnIds.length > 0
            ? { ...withProvenance, metadata: { ...(withProvenance as { metadata?: object }).metadata, guard: warnIds } }
            : clearsGuard
              ? { ...withProvenance, metadata: { ...(withProvenance as { metadata?: object }).metadata, guard: null } }
              : withProvenance
        const text = await call($, options, name, sent, as)
        // One warning line per hit, after the engine's reply; `reply` stays the engine's own text.
        const warnings = warnIds.length > 0 ? guard!.hits.map(hit => `\nMnemosyne guard warning: ${hit.message}`).join('') : ''
        // A remember that named no kind is saved as 'unknown', with one warning in the reply; never a refusal.
        const noKind = tool === 'memory_remember' && (input.kind === undefined || input.kind === null)
        return { reply: text, result: name === 'mnemopi_recall' ? JSON.stringify(compact(text)) : name === 'mnemopi_stats' ? mnemosyneStats(text) : `${noKind ? withNoKindWarning(text) : text}${warnings}` }
      } catch (err) {
        return { deny: `Mnemosyne: ${(err as Error).message}` }
      }
    })()
    if (action !== undefined) {
      const blocked = refusedByGuard
      // A refused call logs its rule ids only: no content text, in the line or the error.
      const outcome = blocked ? { ok: false, error: `guard:${guardIds.join(',')}` } : 'deny' in answer ? { ok: false, error: answer.deny } : callOutcome(action, input, answer.reply)
      // Tags as the engine gets them, cleaned, as the proxy logs them.
      const shown = Array.isArray(input.tags) ? { ...input, tags: cleanTags(input.tags) } : input
      await record($, options, [{ action, origin: 'tool', owner: as, text: blocked ? '' : callText(action, shown), ...outcome, ...(provenance ?? {}) }])
    }
    // A successful save (or a content update) starts extraction after the reply.
    // A tags-only or importance-only update changes no text, so it extracts nothing.
    if (!('deny' in answer) && (tool === 'memory_remember' || (tool === 'memory_update' && typeof input.content === 'string'))) {
      const id = savedId(answer.reply)
      if (id !== undefined) {
        const who = as ?? (await owner($, options).catch(() => GLOBAL_OWNER))
        const session = (await $.session.id().catch(() => undefined)) ?? ''
        // The prompt and pending-file steps run at once, so every save has its pending file even when the session ends
        // first. Only the model and store steps wait: one per session at a time, in the order of the saves.
        const before = extractions.get(session) ?? Promise.resolve()
        let release!: () => void
        const turn = new Promise<void>(resolve => (release = resolve))
        const tail = before.then(() => turn)
        extractions.set(session, tail)
        const queue = async <T,>(work: () => Promise<T>) => {
          await before
          return work()
        }
        // The slot opens when the extraction ends, whatever happened (an early return never reaches the queue).
        const queued = extraction($, options, id, who, queue, typeof input.content === 'string' ? input.content : undefined)
          .catch(() => undefined)
          .finally(() => {
            release()
            void tail.then(() => {
              if (extractions.get(session) === tail) extractions.delete(session)
            })
          })
        // KNOWX.2: background by default. The await fallback (KNOWX.0) changes only this line.
        void queued
      }
    }
    return 'deny' in answer ? { deny: answer.deny } : { result: answer.result }
  }).catch(() => ({ deny: 'Mnemosyne: its tool failed.' }))

  const rememberTerms = terms(options.rememberTerms)
  const recallTerms = terms(options.recallTerms)

  // Fixed text, appended last on the session side, so the prompt cache holds.
  on('prompt.compose', async (_$, e, next) => {
    const composed = await next(e)
    if (e.traits.includes('bare') || !e.tools.includes('mcp__mnemosyne__memory_remember')) return composed
    return { ...composed, sections: [...composed.sections, RULES_SECTION] }
  }).catch((_$, e, next) => next(e))

  // A main-conversation compaction summarises the recalled memories away: let the next prompt recall again.
  on('session.compact', { trigger: ['manual', 'auto', 'plugin'] }, async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && result.skip === undefined) {
      const session = await $.session.id()
      await update($, recalled, ({ [session]: _, ...rest }) => rest)
      activity($, options, 'conversation compacted; will recall again on the next prompt', 'recalls again next prompt')
      await record($, options, [{ action: 'rearm', origin: 'hook', text: 'will recall again on the next prompt', ok: true }])
    }
    return result
  }).catch((_$, e, next) => next(e))

  // A main-conversation turn ends: its remember trigger is spent either way (KNOWX.1.a2).
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const session = await $.session.id().catch(() => undefined)
      if (session !== undefined && (await read($, pendingTrigger))[session]) {
        await update($, pendingTrigger, ({ [session]: _spent, ...rest }) => rest)
      }
    }
    return next(e)
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
    const logged: Activity[] = []
    if (remember) {
      // KNOWX.1: the first main-thread save of this turn is the human's. Cleared
      // at turn end, so a turn that saves nothing leaves the next turn an agent save.
      await update($, pendingTrigger, seen => ({ ...seen, [session]: true as const }))
      activity($, options, 'remember term matched; asking Claude to save it')
      // The save itself is Claude's memory_remember call, logged with origin tool.
      logged.push({ action: 'remember', origin: 'trigger', text: remember, ok: true })
      context.push(
        `The user invoked a Mnemosyne remember trigger. Call mcp__mnemosyne__memory_remember exactly once with a self-contained version of:\n${remember}\nIf it is a secret or credential, do not save it; say so.`,
      )
    }
    // A recall term is the reason for the recall, even on a first prompt.
    const origin = asked !== undefined ? 'trigger' : 'hook'
    let queries: string[] = []
    try {
      // The engine drops a row matching under ~22% of the query's words, so a long
      // prompt recalls nothing as one query: ask per sentence, in one process.
      const sentences = (text: string) => text.split(/(?<=[.?!])\s+|\n+/).map(t => t.trim()).filter(Boolean)
      // A recall term's query is the first sentence after it: "recall: heron? and then…" asks for heron.
      const topic = asked ? sentences(asked)[0]?.replace(/[?.!]+$/, '') : undefined
      // Each query as the engine gets it: at most 300 characters.
      queries = [...new Set([...(topic ? [topic] : []), ...(isFirst ? sentences(e.text).slice(0, 4) : [])])].map(query => query.slice(0, 300))
      const answers = queries.length === 0 ? [] : await runAll($, options, queries.map(query => ['mnemopi_recall', { query, limit: RECALL_LIMIT }] as const))
      const byId = new Map<string, { id: string; owner: string; content: string }>()
      for (const answer of answers) if (typeof answer === 'string') for (const row of compact(answer)) byId.set(row.id, row)
      const found = [...byId.values()].slice(0, RECALL_LIMIT)
      const n = found.length
      const noun = n === 1 ? 'memory' : 'memories'
      const where = asked !== undefined ? `"${topic ?? asked}"` : 'this prompt'
      // runAll hands back an Error per failed request: all of them failing is a failure, not "nothing".
      const failed = answers.length > 0 && answers.every(answer => answer instanceof Error)
      if (queries.length > 0) {
        const error = failed ? (answers.find(answer => answer instanceof Error) as Error).message : undefined
        logged.push({ action: 'recall', origin, text: queries.join(' | '), ids: found.map(r => r.id), count: n, ok: !failed, error })
      }
      if (failed) activity($, options, 'recall failed')
      else if (asked !== undefined) activity($, options, n > 0 ? `recalled ${n} ${noun} for ${where}` : `found nothing for ${where}`, n > 0 ? `recalled ${n}` : 'found nothing')
      else if (isFirst) activity($, options, n > 0 ? `recalled ${n} ${noun} for ${where}` : `recall found nothing for ${where}`, n > 0 ? `recalled ${n}` : 'found nothing')
      if (found.length > 0) {
        const lines = found.map(r => `- [${r.id} owner=${r.owner}] ${r.content}`)
        context.push(`Long-term memories that may be relevant (Mnemosyne; mcp__mnemosyne__memory_update and _forget take the id and owner):\n${lines.join('\n')}`)
      } else if (asked !== undefined) {
        context.push(`Mnemosyne recall for "${topic ?? asked}" found nothing.`)
      }
    } catch (err) {
      // recall is best effort; the prompt goes on without it
      activity($, options, 'recall failed')
      logged.push({ action: 'recall', origin, text: queries.join(' | '), ok: false, error: (err as Error)?.message })
    }
    await record($, options, logged)
    return context.length > 0 ? next({ ...e, context: [...(e.context ?? []), ...context] }) : next(e)
  }).catch((_$, e, next) => next(e))
}
