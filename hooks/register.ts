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
  judgeRetag,
  kindIsOpen,
  parseProposalsFile,
  parseRows,
  parseTags,
  pool,
  PROPOSALS_FILE,
  withRateLimitRetry,
  systemPrompt,
  tagContext,
  tagPrompt,
  tagsOf,
} from './backfill'
import type { Proposal, Row } from './backfill'
import { extractMany, extractOne, reasonLine, storedCount } from './knowledge'
import type { ExtractOutcome, KnowledgeEngine } from './knowledge'
import { buildRequests, EMBEDDINGS_CACHE_DIR, EMBEDDINGS_MODEL, engineEnv, parseReplies } from './engine'
import type { RecallWeights } from './engine'
import type { EngineRequest } from './engine'
import { ENGINE_BUILD, SETUP_TIMEOUT_MS } from './engine-build'
import { mnemosyneStats } from './surface'
import { admit, guardConfigOf, nearDuplicateFlags, nearDuplicateMessage, nearMatchesOf } from './guard'
import type { GuardResult, NearMatch } from './guard'
import {
  classifyChunks,
  countEntries,
  docOrigin,
  docProposalInput,
  entryLines,
  IMPORT_MAX_CHUNKS,
  IMPORT_PROPOSALS_FILE,
  IMPORT_USAGE,
  importProvenance,
  parseImportArgs,
  parseImportProposal,
  parseSessionMemories,
  savesEntry,
  SESSION_CALL_TIMEOUT_MS,
  SESSION_MAX_TOKENS,
  sessionOrigin,
  sessionPrompt,
  sessionProposalInput,
  sessionSystemPrompt,
  sessionTagContext,
} from './import'
import type { ChunkEntry, DocRead, ExistingChunk, SessionCandidate, SessionRead } from './import'
import { expiresInDaysProblem, KIND_NAMES, kindProblem, missingKindMessage, validUntilFor } from './kinds'
import { CONFIG_FILE, parseConfig, TOOL_NAMES } from './settings'
import {
  BLOCK_PINNED_MAX,
  buildSessionBlock,
  cwdForFolder,
  expireSetting,
  parseBlockRead,
  parsePending,
  parseSummary,
  pendingSession,
  SUMMARY_CALL_TIMEOUT_MS,
  SUMMARY_MAX_PER_RUN,
  SUMMARY_MAX_TOKENS,
  SUMMARY_MIN_TURNS,
  SUMMARY_VALID_DAYS,
  sessionSummaryOn,
  summaryPrompt,
  summarySystemPrompt,
  transcriptFolder,
  transcriptPath,
} from './session'
import type { PendingSession } from './session'
import type { ResolvedSettings, ToolName } from './settings'
import { cleanTags } from './tags'
import type { TagRules } from './tags'
import { parseVocabulary, tagRules, VOCAB_FILE } from './vocab'
import type { Vocabulary } from './vocab'
import { openDashboard, stopDashboard } from './ui-launch'
import { PROJECTS_FILE, projectName, remoteHostOf } from './projects'

export { ENGINE_BUILD } from './engine-build'
// The upstream base version; the plugin's own build of it is ENGINE_BUILD (engine/UPSTREAM.md).
export const ENGINE_VERSION = '18.12.3'
const ENGINE_PACKAGE = '@oh-my-pi/pi-mnemopi'
const GLOBAL_OWNER = 'global'
const NOT_INSTALLED = 'Mnemosyne Memory engine not installed: ask the user to run /mnemosyne-setup.'
// memory_remember is refused on a stale engine too: that engine's 24 h trim deletes every row whose trust tier is not IMPORTED, and a save made with this build's honest provenance is not.
const NOT_CURRENT = `Mnemosyne Memory engine is out of date (memory_remember and memory_update need build ${ENGINE_BUILD}; an older engine would delete this plugin's saves after 24 hours): ask the user to run /mnemosyne-setup.`

// Where a person typed the prompt; another plugin's or session's text never triggers a save.
const PERSON_ORIGINS = new Set(['composer', 'bridge', 'sdk', 'slack-ping'])

// The rules block, built from the settings (C6): the tag count follows T1, and a tool switched off (M1) is not named.
// With every tool on and the default T1 this is the 0.8.4 text, byte for byte. Needs memory_remember on: the block is not added without it.
const tagCountText = (most: number) => (most >= 2 ? `2 to ${most}` : '1')
function rulesSection(settings: ResolvedSettings) {
  const on = (tool: ToolName) => settings.tools[tool]
  const names = [`mcp__mnemosyne__memory_remember`, ...(on('memory_recall') ? ['_recall'] : []), ...(on('memory_update') ? ['_update'] : []), ...(on('memory_forget') ? ['_forget'] : [])]
  const closeMemory = on('memory_update')
    ? `${on('memory_recall') ? 'recall first, and if a close memory exists, ' : 'if a close memory exists, '}update it (or save the new fact with replaces: the old id, which retires the old one) instead of saving another.`
    : `${on('memory_recall') ? 'recall first, and if a close memory exists, ' : 'if a close memory exists, '}save the new fact with replaces: the old id, which retires the old one, instead of saving another.`
  const lines = [
    '# Long-term memory (Mnemosyne)',
    `${names.join(' / ')} keep facts across sessions and repos.`,
    '- Remember: lasting preferences, conventions, decisions, runbooks the user states. One self-contained fact per call.',
    '- With each fact, pass kind (required: a save without it is refused): fact, preference, instruction (a rule or runbook), decision, context (project state), error (a bug note), artifact (a reference) or event (a session summary).',
    `- With each fact, pass tags: ${tagCountText(settings.tags.maxPerMemory)} short lowercase topic words (for example ["git", "ci"]).`,
    '- Never remember secrets, credentials, or one-off task details.',
    ...(on('memory_recall') ? ['- Recall before answering about past decisions or preferences ("what did we…", "how do I usually…").'] : []),
    `- ${[...(on('memory_update') ? ['To change or tag a fact, update it by id and owner with memory_update.'] : []), ...(on('memory_forget') ? ['Use memory_forget only to delete.'] : []), `Never save a near-duplicate: ${closeMemory}`].join(' ')}`,
  ]
  return { id: 'mnemosyne:rules', scope: 'session', text: lines.join('\n') } as const
}

// The heading of the first-prompt recall: names only the tools this session has (M1). With update and forget both on it is the 0.8.4 text, byte for byte.
function recallHeading(has: (tool: ToolName) => boolean) {
  const rowTools = [...(has('memory_update') ? ['mcp__mnemosyne__memory_update'] : []), ...(has('memory_forget') ? [has('memory_update') ? '_forget' : 'mcp__mnemosyne__memory_forget'] : [])]
  const note = rowTools.length === 0 ? '' : `; ${rowTools.join(' and ')} ${rowTools.length === 1 ? 'takes' : 'take'} the id and owner`
  return `Long-term memories that may be relevant (Mnemosyne${note}):`
}

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
  description: 'What kind of memory this is. Required on memory_remember: a save without it is refused.',
} as const

// The five tools' definitions. The numbers their texts quote follow the settings (C6): T1 tags, E1 context days, R2 recall limits.
const toolsFor = (settings: ResolvedSettings) => [
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
          description: `${tagCountText(settings.tags.maxPerMemory)} short lowercase topic tags for the fact, e.g. ["git", "ci"].`,
        },
        kind: KIND_PROPERTY,
        expires_in_days: {
          type: 'integer',
          description: `Forget this memory after this many days (1 to 365). A context note expires after ${settings.expiry.contextDays} days when this is not given.`,
        },
        replaces: {
          type: 'string',
          description: 'The id of an older memory this one supersedes. After the save it is retired (not deleted): recall stops returning it, and it can be restored.',
        },
        owner: { type: 'string', description: "With replaces: the owner of that older memory, from memory_recall; default this project's." },
        confirm: CONFIRM_PROPERTY,
      },
      required: ['content', 'kind'],
    },
  },
  {
    name: 'memory_recall',
    description: 'Search long-term memory by keywords (full-text).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'integer', description: `1 to ${settings.recall.maxLimit}; default ${settings.recall.defaultLimit}.` },
      },
      required: ['query'],
    },
  },
  {
    name: 'memory_update',
    description:
      'Change a memory in place, by the id and owner memory_recall returned: its content, importance, kind, topic tags or pin. Keeps its id and recall history. Use this rather than forgetting and saving again.',
    inputSchema: {
      type: 'object',
      properties: {
        memory_id: { type: 'string' },
        content: { type: 'string', description: 'The new text of the fact, self-contained.' },
        importance: { type: 'number', description: '0 to 1.' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: `Short lowercase topic tags (at most ${settings.tags.maxPerMemory}); replaces the old ones. [] removes them.`,
        },
        kind: { ...KIND_PROPERTY, description: 'Change what kind of memory this is.' },
        pinned: { type: 'boolean', description: 'true pins the memory: it is never a retirement candidate and never expires on its own. false unpins it. Nothing else about it changes.' },
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
    home,
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
 * The settings in <root>/config.json (C1), read per call so a change applies on the next save or recall. Never fails: no file,
 * a file that cannot be read or is not valid, or a bad HOME gives the defaults (and a warning no caller shows). A hook cannot
 * read a file any other way than $.fs.read, so the text is parsed here by the import-free resolver (hooks/settings.ts).
 */
async function settingsFor($: EngineInterface, options: PluginOptions): Promise<ResolvedSettings> {
  let text: string | undefined
  try {
    text = await $.fs.read(`${(await paths($, options)).root}/${CONFIG_FILE}`)
  } catch {
    text = undefined
  }
  return parseConfig(text)
}

/** Whether Claude can call memory_remember in this session: on in the settings AND registered at this session's start (M1). Without a record of the start (no session id) the settings decide. */
async function rememberRegistered($: EngineInterface, registered: ReadonlyMap<string, ReadonlySet<ToolName>>, settings: ResolvedSettings): Promise<boolean> {
  const session = await $.session.id().catch(() => undefined)
  const set = session === undefined ? undefined : registered.get(session)
  return settings.tools.memory_remember && (set === undefined || set.has('memory_remember'))
}

const weightsOf = (settings: ResolvedSettings): RecallWeights => ({ vector: settings.recall.vectorWeight, keyword: settings.recall.keywordWeight, importance: settings.recall.importanceWeight })
// The ranking weights go on every recall call (R5.2), beside the env pin.
const weightArgs = (settings: ResolvedSettings) => ({ vec_weight: settings.recall.vectorWeight, fts_weight: settings.recall.keywordWeight, importance_weight: settings.recall.importanceWeight })

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
    ? cmdWrapper(store, cli, proxy, activity, embeddings, guardModeOf(options), `${root}/${VOCAB_FILE}`, root)
    : shWrapper(store, cli, proxy, activity, embeddings, guardModeOf(options), `${root}/${VOCAB_FILE}`, root)
  await bunFs($, `fs.writeFileSync(a[0], a[1]); ${windows ? '' : 'fs.chmodSync(a[0], 0o700);'}`, wrapper, text)
}

const WRAPPER_NOTE = `Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,
serving only remember / recall / update / forget / stats.
MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.
MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.
MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.
MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).
MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).`

const shWrapper = (store: string, cli: string, proxy: string, activity: string, embeddings: boolean, guardMode: string, vocabulary: string, root: string) => `#!/bin/sh
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
export MNEMOSYNE_VOCABULARY=${shellQuote(vocabulary)}
export MNEMOSYNE_ROOT=${shellQuote(root)}
exec bun ${shellQuote(proxy)}
`

// cmd has no safe quoting for " or %; paths() refuses a store holding either.
const cmdWrapper = (store: string, cli: string, proxy: string, activity: string, embeddings: boolean, guardMode: string, vocabulary: string, root: string) => `@echo off\r
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
set "MNEMOSYNE_VOCABULARY=${vocabulary}"\r
set "MNEMOSYNE_ROOT=${root}"\r
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
function updateArgs(input: Record<string, unknown>, rules: TagRules = {}): Record<string, unknown> | string {
  const hasContent = typeof input.content === 'string'
  const hasImportance = typeof input.importance === 'number' && Number.isFinite(input.importance)
  if (input.tags !== undefined && !Array.isArray(input.tags)) return 'tags must be an array of strings.'
  const hasKind = input.kind !== undefined && input.kind !== null
  const refused = kindProblem(input.kind)
  if (refused !== undefined) return refused
  // IMPORT.3: pin and unpin ride the engine's metadata merge as { pinned }; nothing else of the row changes.
  const hasPinned = input.pinned !== undefined && input.pinned !== null
  if (hasPinned && typeof input.pinned !== 'boolean') return 'pinned must be true or false.'
  if (!hasContent && !hasImportance && input.tags === undefined && !hasKind && !hasPinned) return 'memory_update needs content, importance, tags, kind or pinned.'
  const tags = Array.isArray(input.tags) ? cleanTags(input.tags, rules) : undefined
  // A list whose tags all clean away (the project name, punctuation, blanks) must not read as "remove the tags": [] is how those are removed.
  if (tags !== undefined && tags.length === 0 && Array.isArray(input.tags) && input.tags.length > 0) return 'none of those tags can be stored (a tag may not be the project name, and needs a letter or digit). Send tags: [] to remove the tags.'
  return {
    memory_id: input.memory_id,
    ...(hasContent ? { content: input.content } : {}),
    ...(hasImportance ? { importance: clamp(input.importance, 0, 1, 0.5) } : {}),
    // The kind goes to the engine as memory_type.
    ...(hasKind ? { memory_type: input.kind } : {}),
    // An empty list removes the key (C7); the engine merges the keys given and keeps the others.
    ...(tags !== undefined || hasPinned ? { metadata: { ...(tags !== undefined ? { tags: tags.length > 0 ? tags : null } : {}), ...(hasPinned ? { pinned: input.pinned } : {}) } } : {}),
    // C10.2: a content change names Claude in the audit trail.
    ...(hasContent ? { validator: 'claude-code' } : {}),
  }
}

/**
 * The rules cleanTags takes for a write by `ownerId` (this session's owner by default): the vocabulary's aliases,
 * read from <root>/vocabulary.json, and the owner's project name, which is dropped. Never fails: no file, or one
 * that cannot be read, gives no aliases. `max` is the most tags kept (setting T1).
 */
async function tagRulesFor($: EngineInterface, options: PluginOptions, settings: ResolvedSettings, ownerId?: string): Promise<TagRules> {
  let text: string | undefined
  try {
    text = await $.fs.read(`${(await paths($, options)).root}/${VOCAB_FILE}`)
  } catch {
    text = undefined
  }
  // T1: the most tags a memory keeps.
  return { ...tagRules(text, ownerId ?? (await owner($, options).catch(() => GLOBAL_OWNER))), max: settings.tags.maxPerMemory }
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
  const [id, { cli, store }, settings] = await Promise.all([as ?? owner($, options), paths($, options), settingsFor($, options)])
  const embeddings = await embeddingsOn($, options)
  const ran = await $.process.run(['bun', cli, 'mcp'], {
    stdin: buildRequests(requests),
    // The ranking weights are pinned from the settings (R5.2): a shell variable cannot change recall.
    env: engineEnv(store, id, { embeddings, weights: weightsOf(settings) }),
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

/**
 * G3: the close memories (cosine at the threshold, setting G5, 0.88 by default; the engine's mnemopi_similar) of a text about to be saved.
 * Advisory, so it fails open: embeddings off, an engine that is not installed or too old, or any failure
 * gives none and the save goes on as it would have. Runs as the owner the save will, before it.
 * (Two engine runs, similar then the save: $.process.run takes its whole stdin up front, and the save
 * needs the matches for its metadata.guard and, in strict mode, may have to be refused.)
 */
async function nearDuplicates($: EngineInterface, options: PluginOptions, content: string, settings: ResolvedSettings, as?: string): Promise<NearMatch[]> {
  return (await nearDuplicatesMany($, options, [content], settings, as))[0] ?? []
}

/**
 * G3 for many texts at once: one engine process answers one mnemopi_similar per text, in order. Same rules as
 * nearDuplicates (advisory, fails open to no matches, the owner the saves will use); the importers call it for a
 * whole document's chunks, with a longer wait.
 */
async function nearDuplicatesMany($: EngineInterface, options: PluginOptions, contents: readonly string[], settings: ResolvedSettings, as?: string, timeoutMs = 20_000): Promise<NearMatch[][]> {
  const none = contents.map((): NearMatch[] => [])
  // G5: switched off, no check and no engine run.
  if (!settings.guard.nearDuplicate || contents.length === 0) return none
  const saver = as ?? (await owner($, options).catch(() => GLOBAL_OWNER))
  const threshold = settings.guard.nearDuplicateScore
  try {
    if (!(await isInstalled($, options)) || !(await isCurrent($, options)) || !(await embeddingsOn($, options))) return none
    const answers = await runAll($, options, contents.map(content => ['mnemopi_similar', { content, top_k: 3, min_score: threshold }] as const), as, timeoutMs)
    return contents.map((content, i) => {
      const answer = answers[i]
      if (typeof answer !== 'string') return []
      try {
        const reply = JSON.parse(answer) as { embeddings?: unknown; matches?: unknown }
        return reply.embeddings === true ? nearMatchesOf(reply.matches, content, saver, threshold) : []
      } catch {
        return []
      }
    })
  } catch {
    return none
  }
}

const REPLACES_ID = /^[A-Za-z0-9_-]{1,64}$/

/** Why `replaces` / `owner` on a remember cannot be used, or undefined when fine or missing. */
function replacesProblem(input: Record<string, unknown>): string | undefined {
  if (input.replaces !== undefined && input.replaces !== null && !(typeof input.replaces === 'string' && REPLACES_ID.test(input.replaces)))
    return 'replaces must be the id of a memory (from memory_recall).'
  if (input.owner !== undefined && input.owner !== null && !(typeof input.owner === 'string' && REPLACES_ID.test(input.owner)))
    return 'owner must be the owner of the memory in replaces (from memory_recall).'
  return undefined
}

type Retired = { oldId: string; newId?: string; owner?: string; ok: boolean; line: string; error: string }

/**
 * META.4: after a successful save, retires the memory it supersedes: mnemopi_invalidate(old, replacement = the new
 * id) as the old row's owner, named claude-code in the audit trail. The row is not deleted (valid_until and
 * superseded_by are set; update with restore brings it back). Never throws: a step that cannot be done is a line
 * for the reply and the new memory stays saved. A save that is the old row itself again (the engine's dedupe
 * answered the old id) retires nothing.
 */
async function retireReplaced($: EngineInterface, options: PluginOptions, oldId: string, newId: string | undefined, as?: string): Promise<Retired> {
  const base = { oldId, ...(newId === undefined ? {} : { newId }), ...(as === undefined ? {} : { owner: as }) }
  const failed = (why: string): Retired => ({ ...base, ok: false, line: `\nMnemosyne: replaces ${oldId} did not retire it: ${why} The new memory is saved${newId === undefined ? '' : ` (${newId})`}; the old one was left as it was.`, error: why })
  if (newId === undefined) return failed('the save gave no memory id to point it at.')
  if (newId === oldId) return failed('it is the memory just saved (the same text), so there is nothing to retire.')
  try {
    const [answer] = await runAll($, options, [['mnemopi_invalidate', { memory_id: oldId, replacement_id: newId, validator: 'claude-code' }]], as)
    if (answer instanceof Error) return failed(`${answer.message}.`.replace(/\.\.$/, '.'))
    const status = (JSON.parse(String(answer)) as { status?: unknown }).status
    if (status === 'invalidated') return { ...base, ok: true, line: `\nMnemosyne: retired ${oldId}, replaced by ${newId}. It is not deleted: it can be restored.`, error: '' }
    return failed(`no memory ${oldId} found${as === undefined ? ' for this project' : ` for owner ${as}`}.`)
  } catch (err) {
    return failed(`${(err as Error).message}.`.replace(/\.\.$/, '.'))
  }
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

// The owners already handed to `bun bin/projects.ts` in this plugin instance (at most one write per owner).
const projectsSent = new WeakMap<object, Set<string>>()

// C12: hands the project registry one record, { owner, name, kind, remoteHost }, at
// session start, the way record() hands over activity lines: a detached $.process.spawn
// drained in a task of its own, the script capping itself. The caller does not await
// it (so a slow or hung $.session.repo() delays nothing), and it never throws or rejects, so a registry failure cannot change the
// session start, a save or a recall. The owner is the one owner() gives; 'global'
// (scope not per-project) is never recorded. The remote is cut to its host here, so
// no URL, user name or token leaves the hook.
async function registerProject($: EngineInterface, options: PluginOptions) {
  try {
    const me = await owner($, options)
    const sent = projectsSent.get(options) ?? new Set<string>()
    projectsSent.set(options, sent)
    if (me === GLOBAL_OWNER || sent.has(me)) return
    const repo = await $.session.repo()
    const { root } = await paths($, options)
    const input = {
      owner: me,
      name: projectName(slashes(repo?.root ?? (await $.session.cwd()))),
      kind: repo ? 'repo' : 'folder',
      remoteHost: repo ? remoteHostOf(repo.remote) : null,
    }
    const argv = ['bun', `${slashes($.plugin.root)}/bin/projects.ts`, 'write', `${root}/${PROJECTS_FILE}`]
    sent.add(me)
    void (async () => {
      for await (const _piece of $.process.spawn({ argv, input: JSON.stringify(input) })) {
        // drained only: the script writes nothing worth reading
      }
    })().catch(() => undefined)
  } catch {
    // a registry failure must not break a hook
  }
}

// ---- /mnemosyne-tags: the one-time tag backfill (hooks/backfill.ts, bin/memories.ts) ----

const TAGS_USAGE = 'Usage: /mnemosyne-tags (a dry run: Haiku proposes tags for the untagged memories, nothing is written), /mnemosyne-tags retag (a dry run: tags and a kind for every memory, from the vocabulary, nothing is written) or /mnemosyne-tags apply (backs the store up, then writes the saved proposals).'
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
  // save, pending, session-pending and sweep-claim name their own folder (the data root) and refuse --store.
  const ran = await $.process.run(['bun', `${slashes($.plugin.root)}/bin/memories.ts`, ...(args[0] === 'save' || args[0] === 'pending' || args[0] === 'session-pending' || args[0] === 'sweep-claim' ? [] : ['--store', store]), ...args], {
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

/** The tag vocabulary (<root>/vocabulary.json), or undefined when there is none or it cannot be read: the tagger then goes free-form. */
async function readVocabulary($: EngineInterface, root: string): Promise<Vocabulary | undefined> {
  try {
    return parseVocabulary(await $.fs.read(`${root}/${VOCAB_FILE}`))
  } catch {
    return undefined
  }
}

/**
 * VOCAB.3: counts the new tags the written proposals offered, one more memory for each, through bin/vocab.ts (the
 * vocabulary's one writer). A tag offered for enough memories (setting T2, 3 by default) is admitted. Returns a line for the apply
 * reply, or nothing; never throws: the tags are written, so a failure here is only a note.
 */
async function recordCandidates($: EngineInterface, root: string, tags: readonly string[]): Promise<string[]> {
  if (tags.length === 0) return []
  try {
    const ran = await $.process.run(['bun', `${slashes($.plugin.root)}/bin/vocab.ts`, '--root', root, 'candidates'], { stdin: JSON.stringify({ tags }), timeoutMs: MEMORIES_TIMEOUT_MS })
    if (ran.exitCode !== 0) return [`New tags were not counted: ${`${ran.stderr}\n${ran.stdout}`.trim().slice(-200)}`]
    const result = JSON.parse(ran.stdout) as { recorded?: number; admitted?: string[] }
    return [
      `Counted ${plural(result.recorded ?? 0, 'proposed new tag')}.`,
      ...(result.admitted && result.admitted.length > 0 ? [`Admitted to the vocabulary: ${result.admitted.join(', ')}.`] : []),
    ]
  } catch (err) {
    return [`New tags were not counted: ${(err as Error).message.slice(0, 200)}`]
  }
}

// The dry run: one Haiku call per untagged memory, saved as proposals; no memory changes.
export async function tagsDryRun($: EngineInterface, options: PluginOptions, signal: AbortSignal, retag = false) {
  const { root } = await paths($, options)
  // A retag proposes for every memory, tagged or not (VOCAB.4); the plain dry run only for the untagged.
  const listed = parseRows(await memoriesCli($, options, ['list', retag ? '--all' : '--untagged']))
  // A row whose metadata is not a JSON object cannot take a metadata merge: no model call for it, and it is named below.
  const rows = listed.filter(row => row.taggable)
  const blocked = listed.filter(row => !row.taggable)
  const blockedNote = blocked.length === 0 ? '' : `${plural(blocked.length, 'memory', 'memories')} cannot be tagged (their metadata is not a JSON object): ${blocked.slice(0, 10).map(row => row.id).join(', ')}${blocked.length > 10 ? ', …' : ''}.`
  if (rows.length === 0) return [blocked.length === 0 ? (retag ? 'There are no memories to retag.' : 'Every memory already has tags; nothing to propose.') : 'No memory can be tagged; nothing to propose.', blockedNote].filter(Boolean).join('\n')
  const proposed: (Proposal | undefined)[] = rows.map(() => undefined)
  const skipped = { failed: 0, empty: 0, aborted: 0 }
  let firstError = ''
  let done = 0
  const model = extractionModelOf(options)
  if (extractionOff(model)) return 'Knowledge extraction is off (extractionModel in the plugin settings is "off"): no tags proposed. Set extractionModel, then try again.'
  // VOCAB.3: the tagger chooses from the vocabulary when there is one; without it the tags are free-form.
  const vocabulary = await readVocabulary($, root)
  // A retag exists to bring tags onto the vocabulary; without one it would only swap free-form tags for others.
  if (retag && vocabulary === undefined) return `A retag needs the tag vocabulary (${root}/vocabulary.json): create it once with  bun ${slashes($.plugin.root)}/bin/vocab.ts --store <your store folder> init  and check it with  list , then run /mnemosyne-tags retag again.`
  const system = systemPrompt(vocabulary)
  progress($, `tagging 0/${rows.length}`)
  await pool(rows, BACKFILL_CONCURRENCY, signal, async (row, i) => {
    try {
      // The memory's text goes in the prompt as a quoted string, to a model that is told it is data.
      // A rate-limited call waits and tries again (up to three times) before it counts as failed.
      const reply = await withRateLimitRetry(
        () => $.model.complete({ model, system, prompt: tagPrompt(row.content), maxTokens: BACKFILL_MAX_TOKENS, timeoutMs: BACKFILL_CALL_TIMEOUT_MS }, { signal }),
        ms => $.clock.sleep(ms, { signal }),
      )
      if (!reply.isAnswered) {
        if (reply.reason === 'aborted') skipped.aborted++
        else {
          skipped.failed++
          firstError ||= reply.reason === 'api-error' ? `api-error ${reply.status ?? 'no response'} ${reply.error}` : reply.reason
        }
      } else {
        const { tags, kind, candidates } = parseTags(reply.text, vocabulary === undefined ? {} : tagContext(vocabulary, row.owner))
        if (tags.length === 0) skipped.empty++
        else proposed[i] = { id: row.id, owner: row.owner, tags, sha256: row.sha256, ...(kind === undefined ? {} : { kind }), ...(candidates.length === 0 ? {} : { candidates }), ...(retag && row.tagsSha256 !== undefined ? { prior: row.tagsSha256 } : {}) }
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
  const lines = proposals.map(p => `${p.id}  ${p.owner}  [${p.tags.join(', ')}]${p.kind === undefined ? '' : `  ${p.kind}`}${retag ? `  (was: [${tagsOf(byId.get(p.id)!).join(', ')}]${byId.get(p.id)!.kind && byId.get(p.id)!.kind !== 'unknown' ? `, kind ${byId.get(p.id)!.kind} stays` : ''})` : ''}  ${Array.from(byId.get(p.id)?.content ?? '').slice(0, 60).join('').replace(/\s+/g, ' ')}`)
  const notes = [
    skipped.empty > 0 ? `${plural(skipped.empty, 'memory', 'memories')} got no usable tags` : '',
    skipped.failed > 0 ? `${plural(skipped.failed, 'call')} failed (${firstError})` : '',
    skipped.aborted > 0 ? `${plural(skipped.aborted, 'call')} ${skipped.aborted === 1 ? 'was' : 'were'} cut short` : '',
  ].filter(Boolean)
  if (proposals.length === 0) {
    progress($, 'tagging found nothing')
    return `No tags were proposed for ${plural(rows.length, 'memory', 'memories')}${notes.length > 0 ? `: ${notes.join('; ')}` : ''}. Nothing was saved.${blockedNote ? `\n${blockedNote}` : ''}`
  }
  await memoriesCli($, options, ['save', `${root}/${PROPOSALS_FILE}`], JSON.stringify({ proposals, ...(retag ? { mode: 'retag' } : {}) }))
  progress($, `${proposals.length} tag proposals saved`)
  return [
    retag ? `Proposed tags and kinds for ${proposals.length} of ${plural(rows.length, 'memory', 'memories')} (a retag); no memory was changed.` : `Proposed tags for ${proposals.length} of ${plural(rows.length, 'untagged memory', 'untagged memories')}; no memory was changed.`,
    ...lines,
    ...(notes.length > 0 ? [`Skipped: ${notes.join('; ')}.`] : []),
    ...(blockedNote ? [blockedNote] : []),
    ...(proposals.some(p => p.candidates !== undefined) ? [`New tags proposed (counted when you apply; a tag proposed for ${(await settingsFor($, options)).tags.autoAdmitCount} memories is admitted): ${[...new Set(proposals.flatMap(p => p.candidates ?? []))].join(', ')}.`] : []),
    ...(vocabulary === undefined ? [`No tag vocabulary yet, so these tags are free-form. Create it once with: bun ${slashes($.plugin.root)}/bin/vocab.ts --store <your store folder> init`] : []),
    `Saved to ${root}/${PROPOSALS_FILE} (ids, owners, tags and a hash of each text; never the text). Run /mnemosyne-tags apply to write them.${retag ? ' Apply backs the store up first, replaces tags only on memories unchanged since this run, and fills a kind only where a memory has none.' : ''}`,
  ].join('\n')
}

// ---- Knowledge extraction (KNOWX.2, hooks/knowledge.ts) ----

// One engine process answers a batch of prompts or stores; the longest wait is the batch's.
const KNOWLEDGE_ENGINE_TIMEOUT_MS = 120_000
// The knowledge backfill keeps its own batch size (40 memories to a prompt batch and to a read); VOCAB.4 lowered only the tag backfill's.
const KNOWLEDGE_BATCH = 40

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
  for (let at = 0; at < pendingIds.length; at += KNOWLEDGE_BATCH) {
    for (const row of parseRows(await memoriesCli($, options, ['get', ...pendingIds.slice(at, at + KNOWLEDGE_BATCH)]))) alive.set(row.id, row.owner)
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
 * older memories with no knowledge. Per owner, in batches of KNOWLEDGE_BATCH memories:
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
  // C9: the backup comes before the first model call and write; a failed backup stops the run.
  const stopped = await backupFirst($, options, '/mnemosyne-knowledge apply')
  if (stopped !== undefined) return stopped

  // Per owner, in the order found, KNOWLEDGE_BATCH memories to a batch.
  const byOwner = new Map<string, typeof targets>()
  for (const target of targets) byOwner.set(target.owner, [...(byOwner.get(target.owner) ?? []), target])
  const batches: { owner: string; list: typeof targets }[] = []
  for (const [who, list] of byOwner) for (let at = 0; at < list.length; at += KNOWLEDGE_BATCH) batches.push({ owner: who, list: list.slice(at, at + KNOWLEDGE_BATCH) })

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
  let retag = false
  try {
    const saved = parseProposalsFile(await $.fs.read(file))
    proposals = saved.proposals
    retag = saved.mode === 'retag'
  } catch (err) {
    return `The saved proposals cannot be used (${(err as Error).message}): run /mnemosyne-tags again.`
  }
  if (proposals.length === 0) return 'The saved proposals list is empty: run /mnemosyne-tags again.'
  // C9: the backup comes before the first write; a failed backup stops the run.
  const stopped = await backupFirst($, options, '/mnemosyne-tags apply')
  if (stopped !== undefined) return stopped
  const byOwner = new Map<string, Proposal[]>()
  for (const proposal of proposals) byOwner.set(proposal.owner, [...(byOwner.get(proposal.owner) ?? []), proposal])
  const counts = { gone: 0, tagged: 0, untaggable: 0, changed: 0, same: 0 }
  let written = 0
  let failed = 0
  let notReached = 0
  let checked = 0
  // The new tags offered by the proposals that were written; counted once the owners are done.
  const offered: string[] = []
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
      // A retag replaces tags that exist, so it judges by the tags the row had at the dry run too (VOCAB.4).
      const verdict = (retag ? judgeRetag : judge)(proposal, current.get(proposal.id))
      if (verdict === 'write') list.push(proposal)
      else counts[verdict]++
    }
    checked += proposed.length
    if (list.length === 0) continue
    let ownerError = ''
    // mnemopi_update with metadata.tags and, in a retag, a kind only where the row has none; never content, importance, source or trust tier.
    // T1: a proposal never writes more tags than a memory may keep.
    const tagMax = (await settingsFor($, options)).tags.maxPerMemory
    const requests: EngineRequest[] = list.map(p => ['mnemopi_update', { memory_id: p.id, metadata: { tags: p.tags.slice(0, tagMax) }, ...(retag && p.kind !== undefined && kindIsOpen(current.get(p.id)!) ? { memory_type: p.kind } : {}) }])
    const answers = await runAll($, options, requests, id, APPLY_TIMEOUT_MS).catch(err => requests.map(() => err as Error))
    const done = list.filter((_, i) => {
      const answer = answers[i]
      if (typeof answer === 'string' && callOutcome('update', {}, answer).ok) return true
      ownerError ||= answer instanceof Error ? answer.message : (callOutcome('update', {}, answer ?? '').error ?? 'the engine gave no reply')
      return false
    })
    written += done.length
    offered.push(...done.flatMap(p => p.candidates ?? []))
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
  const counted = await recordCandidates($, root, offered)
  return [
    retag ? `Retagged ${plural(written, 'memory', 'memories')} of ${proposals.length} proposed.` : `Tagged ${plural(written, 'memory', 'memories')} of ${proposals.length} proposed.`,
    retag
      ? `Skipped: ${counts.gone} gone, ${counts.same} already as proposed, ${counts.untaggable} cannot be tagged (metadata is not a JSON object), ${counts.changed} changed since the dry run (text or tags).`
      : `Skipped: ${counts.gone} gone, ${counts.tagged} already tagged, ${counts.untaggable} cannot be tagged (metadata is not a JSON object), ${counts.changed} changed since the dry run.`,
    ...(failed > 0 ? [`${plural(failed, 'update')} failed (${firstError}).`] : []),
    ...(notReached > 0 ? [`Stopped early: ${plural(notReached, 'memory', 'memories')} not reached; run /mnemosyne-tags apply again to finish.`] : []),
    ...counted,
  ].join('\n')
}

// ---- /mnemosyne-import: documents and session logs, through the guard (plan phase IMPORT) ----

const IMPORT_CLI_TIMEOUT_MS = 60_000
// One engine process answers a batch of similar or remember requests; the longest wait is the batch's.
const IMPORT_ENGINE_TIMEOUT_MS = 120_000
const IMPORT_SAVE_BATCH = 25
const basenameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** bin/import.ts. A failure carries its own stderr line (a reason, never a piece of the file), nothing else. */
async function importCli($: EngineInterface, options: PluginOptions, args: readonly string[], stdin?: string, timeoutMs = IMPORT_CLI_TIMEOUT_MS) {
  const { store } = await paths($, options)
  // --store goes first and only for the commands that read the store.
  const ran = await $.process.run(['bun', `${slashes($.plugin.root)}/bin/import.ts`, ...(args[0] === 'origins' || args[0] === 'exact' ? ['--store', store] : []), ...args], {
    ...(stdin === undefined ? {} : { stdin }),
    timeoutMs,
  })
  if (ran.exitCode !== 0) throw new Error(ran.stderr.trim().replace(/^mnemosyne import: /, '').slice(-300) || `bin/import.ts ${args[0]} failed (exit ${ran.exitCode})`)
  if (ran.isStdoutTruncated) throw new Error(`the output of bin/import.ts ${args[0]} was cut at 4 MiB`)
  return ran.stdout
}

/** A document path as the person typed it: ~ is the home, a relative path is under the session's folder. */
async function docPathOf($: EngineInterface, raw: string): Promise<string> {
  let path = slashes(raw)
  if (path === '~' || path.startsWith('~/')) path = `${slashes((await $.env.get('HOME')) ?? '')}${path.slice(1)}`
  if (!isAbsolute(path)) path = `${slashes(await $.session.cwd())}/${path}`
  return normalize(path)
}

/** Guard, then near-duplicates, then the verdicts: the check every importer runs on its candidates, with the settings read now. */
async function checkCandidates(
  $: EngineInterface,
  options: PluginOptions,
  settings: ResolvedSettings,
  items: readonly { heading: string; sha256: string; content: string; kind: string }[],
  existing: readonly ExistingChunk[],
) {
  const config = guardConfigOf(settings)
  const guards = items.map(item => admit({ content: item.content, kind: item.kind, origin: 'import' }, config))
  // Text the owner already holds exactly is not saved again: the engine would answer with the old row's id.
  // A blocked text goes nowhere further: not to this lookup, not to the engine.
  const me = await owner($, options)
  const open = items.map((_item, i) => guards[i]!.verdict !== 'block')
  const present = open.some(Boolean)
    ? (JSON.parse(await importCli($, options, ['exact', me], JSON.stringify({ texts: items.filter((_item, i) => open[i]).map(item => item.content) }))) as { present: boolean[] }).present
    : []
  let seen = 0
  const stored = items.map((_item, i) => (open[i] ? present[seen++] === true : false))
  // The near-duplicate check is for text that could be saved: not for what is already stored, nor a block.
  const known = new Set(existing.map(row => row.sha256))
  const wanted = items.map((item, i) => !known.has(item.sha256) && stored[i] !== true && guards[i]!.verdict !== 'block')
  const answers = await nearDuplicatesMany($, options, items.filter((_item, i) => wanted[i]).map(item => item.content), settings, undefined, IMPORT_ENGINE_TIMEOUT_MS)
  let next = 0
  const near = items.map((_item, i) => (wanted[i] ? answers[next++] ?? [] : []))
  const nearChecked = settings.guard.nearDuplicate && (await embeddingsOn($, options))
  return { entries: classifyChunks(items, existing, guards, near, stored), nearChecked }
}

type DocEvaluation = { read: DocRead; entries: ChunkEntry[]; nearChecked: boolean }

/**
 * Reads the document and decides what every chunk would become (the dry run and the apply both call this, so apply
 * never trusts a verdict from the file): the guard with the settings read now, then the near-duplicate check, then the
 * earlier import's rows. A refusal is a string. Writes nothing.
 */
async function evaluateDoc($: EngineInterface, options: PluginOptions, path: string, settings: ResolvedSettings): Promise<DocEvaluation | string> {
  const read = JSON.parse(await importCli($, options, ['doc', path])) as DocRead
  if (read.tooMany) return `${basenameOf(path)} splits into ${read.total} chunks, over the limit of ${IMPORT_MAX_CHUNKS} per import: split the file, or keep only the part worth remembering. Nothing was imported.`
  if (read.chunks.length === 0) return `${basenameOf(path)} has no text under its headings; nothing to import.`
  // Per-project scope: only this project's earlier rows, so the import never retires another project's copy of the file.
  const existing = JSON.parse(await importCli($, options, ['origins', path, ...(options.scope === 'per-project' ? ['--owner', await owner($, options)] : [])])) as ExistingChunk[]
  const { entries, nearChecked } = await checkCandidates($, options, settings, read.chunks.map(chunk => ({ heading: chunk.heading, sha256: chunk.sha256, content: chunk.text, kind: 'artifact' })), existing)
  return { read, nearChecked, entries }
}

const nearLine = (checked: boolean) => (checked ? 'Near-duplicate check: on (a close match is a warning).' : 'Near-duplicate check: skipped (embeddings are off, or setting G5 is off); exact repeats are still caught per owner.')

/** /mnemosyne-import doc <path>: the dry run. Writes the proposals file (hashes and verdicts, never text) and no memory. */
export async function importDocDryRun($: EngineInterface, options: PluginOptions, rawPath: string) {
  const { root } = await paths($, options)
  const path = await docPathOf($, rawPath)
  const settings = await settingsFor($, options)
  progress($, 'checking the document')
  const done = await evaluateDoc($, options, path, settings)
  if (typeof done === 'string') return done
  const { read, entries, nearChecked } = done
  const counts = countEntries(entries)
  const saveable = counts.allow + counts.warn
  await importCli($, options, ['save', `${root}/${IMPORT_PROPOSALS_FILE}`], JSON.stringify(docProposalInput(path, read.fileSha256, entries)))
  progress($, `${counts.total} chunks checked`)
  const strict = guardModeOf(options) === 'strict'
  return [
    `Dry run for ${basenameOf(path)}: ${plural(counts.total, 'chunk')}${read.skippedEmpty > 0 ? ` (${plural(read.skippedEmpty, 'heading')} with no text under ${read.skippedEmpty === 1 ? 'it was' : 'them were'} skipped)` : ''}. No memory was changed.`,
    `Would save ${counts.allow} clean${counts.replace > 0 ? ` (${counts.replace} of the chunks replace a row from an earlier import of this file: the old row is retired, not deleted, and can be restored)` : ''}; ${counts.warn} with a warning${counts.warn > 0 ? (strict ? ' (guard mode strict: saved only with /mnemosyne-import apply confirm)' : ' (guard mode warn: saved and flagged in metadata.guard)') : ''}; ${counts.unchanged} already in the store (skipped); ${counts.block} blocked (never saved).`,
    ...entryLines(entries),
    nearLine(nearChecked),
    `Saved to ${root}/${IMPORT_PROPOSALS_FILE} (path, headings, hashes and verdicts; never the text).`,
    saveable === 0 ? 'Nothing to import.' : `Run /mnemosyne-import apply to save ${strict && counts.warn > 0 ? `the ${counts.allow} clean chunks (add confirm for the ${counts.warn} with a warning)` : `${saveable} chunks`}. Apply backs the store up first and stops if that fails.`,
  ].join('\n')
}

// IMPORT.2: what a session dry run proposed, kept in this process only. C8: a memory's text is never written to a
// file, so the proposals file holds hashes and verdicts, and apply takes the text from here. A reload or a new process
// empties it, and apply then asks for a new dry run.
const sessionPending = new Map<string, { sessionId: string; items: Map<string, SessionCandidate> }>()

/** /mnemosyne-import session <id | last>: asks Haiku for up to 5 durable memories, checks each, writes a proposals file (hashes only) and no memory. */
export async function importSessionDryRun($: EngineInterface, options: PluginOptions, target: string, signal: AbortSignal) {
  const { root, home } = await paths($, options)
  const model = extractionModelOf(options)
  if (extractionOff(model)) return 'Knowledge extraction is off (extractionModel in the plugin settings is "off"): a session import needs the model. Set extractionModel, then try again.'
  const settings = await settingsFor($, options)
  progress($, 'reading the session')
  // Claude Code keeps transcripts under <home>/.claude/projects, one folder per project.
  const projects = `${home}/.claude/projects`
  const current = await $.session.id().catch(() => undefined)
  // `last` skips the running session; if its id is unknown, the newest file may be the running one.
  if (target === 'last' && !current) return 'The running session\'s id is not known, so "last" could pick the session in progress. Give the session id: /mnemosyne-import session <id>. Nothing was read.'
  const read = JSON.parse(await importCli($, options, ['session', '--projects', projects, '--cwd', slashes(await $.session.cwd()), ...(current === undefined ? [] : ['--current', current]), target])) as SessionRead
  if (read.text === '') return `Session ${read.sessionId} has no conversation text to read; nothing to import.`
  const vocabulary = await readVocabulary($, root)
  const me = await owner($, options)
  progress($, 'asking the model')
  // The conversation text (redacted by bin/import.ts) goes to the extractionModel, Haiku by default, as a quoted string.
  const reply = await withRateLimitRetry(
    () => $.model.complete({ model, system: sessionSystemPrompt(vocabulary, settings.tags.maxPerMemory), prompt: sessionPrompt(read.text), maxTokens: SESSION_MAX_TOKENS, timeoutMs: SESSION_CALL_TIMEOUT_MS }, { signal }),
    ms => $.clock.sleep(ms, { signal }),
  )
  if (!reply.isAnswered) {
    if (reply.reason === 'aborted') return 'Stopped. Nothing was saved and no memory was changed.'
    return `The model call failed (${reply.reason === 'api-error' ? `api-error ${reply.status ?? 'no response'} ${reply.error}` : reply.reason}). Nothing was saved and no memory was changed.`
  }
  const candidates = parseSessionMemories(reply.text, sessionTagContext(vocabulary, me), settings.tags.maxPerMemory)
  // A candidate the guard blocks is hashed as a placeholder: its text goes to no process.
  const config = guardConfigOf(settings)
  const hashed = candidates.map((candidate, i) => (admit({ content: candidate.content, kind: candidate.kind, origin: 'import' }, config).verdict === 'block' ? `blocked ${read.sessionId} ${i}` : candidate.content))
  const hashes = candidates.length === 0 ? [] : (JSON.parse(await importCli($, options, ['hash'], JSON.stringify({ texts: hashed }))) as { sha256: string[] }).sha256
  const items = candidates.map((candidate, i) => ({ heading: `memory ${i + 1}`, sha256: hashes[i]!, content: candidate.content, kind: candidate.kind }))
  const { entries, nearChecked } = await checkCandidates($, options, settings, items, [])
  await importCli($, options, ['save', `${root}/${IMPORT_PROPOSALS_FILE}`], JSON.stringify(sessionProposalInput(read.sessionId, entries)))
  sessionPending.set(root, { sessionId: read.sessionId, items: new Map(candidates.map((candidate, i) => [hashes[i]!, candidate])) })
  progress($, `${plural(candidates.length, 'memory', 'memories')} proposed`)
  if (candidates.length === 0) return `Dry run for session ${read.sessionId}: the model found nothing durable worth remembering (${plural(read.turns, 'turn')} read). No memory was changed.`
  const counts = countEntries(entries)
  const strict = guardModeOf(options) === 'strict'
  const lines = entries.map((entry, i) => {
    const candidate = candidates[i]!
    const text = entry.verdict === 'block' ? '(text hidden: blocked)' : Array.from(candidate.content.replace(/\s+/g, ' ')).slice(0, 160).join('')
    return `${String(i + 1).padStart(3)}  ${entry.verdict}${entry.rules.length > 0 ? ` [${entry.rules.join(',')}]` : ''}  ${candidate.kind}${candidate.tags.length > 0 ? ` [${candidate.tags.join(', ')}]` : ''}  ${text}`
  })
  return [
    `Dry run for session ${read.sessionId}: ${plural(candidates.length, 'memory', 'memories')} proposed from ${plural(read.turns, 'turn')}${read.truncated ? ` (the newest ${read.turns} of ${read.totalTurns}; the text is capped)` : ''}. No memory was changed.`,
    `Would save ${counts.allow} clean; ${counts.warn} with a warning${counts.warn > 0 ? (strict ? ' (guard mode strict: saved only with /mnemosyne-import apply confirm)' : ' (guard mode warn: saved and flagged in metadata.guard)') : ''}; ${counts.unchanged} already in the store (skipped); ${counts.block} blocked (never saved).`,
    ...lines,
    nearLine(nearChecked),
    `Saved to ${root}/${IMPORT_PROPOSALS_FILE} (hashes and verdicts; never the text). The memories themselves are kept in this Claude Code process until another dry run replaces them, so apply can be repeated (for confirm); text already saved is skipped.`,
    counts.allow + counts.warn === 0 ? 'Nothing to import.' : 'Run /mnemosyne-import apply to save them. Apply backs the store up first and stops if that fails.',
  ].join('\n')
}

type SaveItem = { entry: ChunkEntry; content: string; kind: string; metadata: Record<string, unknown> }

/**
 * Saves the items, 25 to an engine process, as the current owner, with the C4 provenance of `kind` and scope by the scope
 * setting. A failed save is counted and the rest go on. Stops between batches when `signal` aborts.
 */
async function saveImported($: EngineInterface, options: PluginOptions, kind: 'doc' | 'session', todo: readonly SaveItem[], signal: AbortSignal) {
  const isGlobal = options.scope !== 'per-project'
  const saved: { id: string; entry: ChunkEntry }[] = []
  let failed = 0
  let firstError = ''
  let notReached = 0
  for (let at = 0; at < todo.length; at += IMPORT_SAVE_BATCH) {
    if (signal.aborted) {
      notReached = todo.length - at
      break
    }
    const batch = todo.slice(at, at + IMPORT_SAVE_BATCH)
    progress($, `saving ${Math.min(at + batch.length, todo.length)}/${todo.length}`)
    const answers = await runAll(
      $,
      options,
      batch.map(
        item =>
          [
            'mnemopi_remember',
            { content: item.content, importance: 0.5, ...importProvenance(kind), scope: isGlobal ? 'global' : 'channel', memory_type: item.kind, metadata: item.metadata },
          ] as const,
      ),
      undefined,
      IMPORT_ENGINE_TIMEOUT_MS,
    ).catch((err: unknown) => batch.map(() => (err instanceof Error ? err : new Error(String(err)))))
    answers.forEach((answer, i) => {
      const id = answer instanceof Error ? undefined : savedId(answer)
      if (id === undefined) {
        failed++
        firstError ||= answer instanceof Error ? answer.message.slice(0, 200) : 'the engine gave no memory id'
      } else saved.push({ id, entry: batch[i]!.entry })
    })
  }
  return { saved, failed, firstError, notReached }
}

/** A changed chunk's old row is retired once its replacement is saved (as the old row's owner); it is not deleted and can be restored. */
async function retireImported($: EngineInterface, options: PluginOptions, saved: readonly { id: string; entry: ChunkEntry }[]) {
  const retired: string[] = []
  let failed = 0
  const pairs = saved.filter(item => item.entry.replaces !== undefined && item.entry.replaces.id !== item.id)
  for (const ownerId of [...new Set(pairs.map(item => item.entry.replaces!.owner))]) {
    const group = pairs.filter(item => item.entry.replaces!.owner === ownerId)
    const answers = await runAll($, options, group.map(item => ['mnemopi_invalidate', { memory_id: item.entry.replaces!.id, replacement_id: item.id }] as const), ownerId || undefined, IMPORT_ENGINE_TIMEOUT_MS).catch(() => group.map(() => new Error('the engine did not answer')))
    answers.forEach((answer, i) => {
      let ok = false
      try {
        ok = !(answer instanceof Error) && (JSON.parse(String(answer)) as { status?: unknown }).status === 'invalidated'
      } catch {
        ok = false
      }
      if (ok) retired.push(group[i]!.entry.replaces!.id, group[i]!.id)
      else failed++
    })
  }
  return { retired, failed, pairs: pairs.length }
}

/**
 * /mnemosyne-import apply: saves what the last dry run checked. The store is backed up first (C9) and nothing is read
 * or written if that fails. Every candidate is checked again with the settings read now: the guard, the near-duplicate
 * check and the rows an earlier import left. Only candidates whose text the dry run saw are saved (a chunk edited since
 * is skipped). A document's chunks are read again from the file; a session's memories come from the dry run in this process.
 */
export async function importApply($: EngineInterface, options: PluginOptions, confirm: boolean, signal: AbortSignal) {
  const { root } = await paths($, options)
  let proposalText: string
  try {
    proposalText = await $.fs.read(`${root}/${IMPORT_PROPOSALS_FILE}`)
  } catch {
    return 'There is no dry run to apply. Run /mnemosyne-import doc <path> or /mnemosyne-import session <id | last> first.'
  }
  const proposal = parseImportProposal(proposalText)
  if (proposal === undefined) return `${root}/${IMPORT_PROPOSALS_FILE} is not a proposal this version can apply; run the dry run again.`
  const pending = proposal.kind === 'session' ? sessionPending.get(root) : undefined
  if (proposal.kind === 'session' && (pending === undefined || pending.sessionId !== proposal.sessionId)) {
    return 'The memories of the last session dry run are no longer in this Claude Code process (their text is never written to a file): run /mnemosyne-import session <id | last> again, then apply.'
  }
  const stopped = await backupFirst($, options, '/mnemosyne-import apply')
  if (stopped !== undefined) return stopped
  const settings = await settingsFor($, options)
  const approved = new Set(proposal.chunks.filter(chunk => chunk.verdict === 'allow' || chunk.verdict === 'warn').map(chunk => chunk.sha256))
  const mode = guardModeOf(options)
  const skipped = { unchanged: 0, blocked: 0, edited: 0, confirm: 0 }
  const todo: SaveItem[] = []
  let label: string
  if (proposal.kind === 'doc') {
    const done = await evaluateDoc($, options, proposal.path, settings)
    if (typeof done === 'string') return done
    label = basenameOf(proposal.path)
    done.entries.forEach((entry, i) => {
      if (entry.verdict === 'unchanged') skipped.unchanged++
      else if (entry.verdict === 'block') skipped.blocked++
      else if (!approved.has(entry.sha256)) skipped.edited++
      else if (!savesEntry(entry, mode, confirm)) skipped.confirm++
      else {
        const chunk = done.read.chunks[i]!
        todo.push({ entry, content: chunk.text, kind: 'artifact', metadata: { origin: docOrigin(proposal.path, chunk), ...(entry.verdict === 'warn' ? { guard: [...entry.rules.filter(rule => rule !== 'G3'), ...nearDuplicateFlags(entry.near)] } : {}) } })
      }
    })
  } else {
    label = `session ${proposal.sessionId}`
    const shas = [...pending!.items.keys()]
    const candidates = shas.map(sha => pending!.items.get(sha)!)
    const { entries } = await checkCandidates($, options, settings, candidates.map((candidate, i) => ({ heading: `memory ${i + 1}`, sha256: shas[i]!, content: candidate.content, kind: candidate.kind })), [])
    const rules = await tagRulesFor($, options, settings)
    entries.forEach((entry, i) => {
      const candidate = candidates[i]!
      if (entry.verdict === 'unchanged') skipped.unchanged++
      else if (entry.verdict === 'block') skipped.blocked++
      else if (!approved.has(entry.sha256)) skipped.edited++
      else if (!savesEntry(entry, mode, confirm)) skipped.confirm++
      else {
        const tags = cleanTags(candidate.tags, rules)
        todo.push({
          entry,
          content: candidate.content,
          kind: candidate.kind,
          metadata: { origin: sessionOrigin(proposal.sessionId, entry.sha256), ...(tags.length > 0 ? { tags } : {}), ...(entry.verdict === 'warn' ? { guard: [...entry.rules.filter(rule => rule !== 'G3'), ...nearDuplicateFlags(entry.near)] } : {}) },
        })
      }
    })
  }
  const me = await owner($, options)
  const { saved, failed, firstError, notReached } = await saveImported($, options, proposal.kind, todo, signal)
  const { retired, failed: retireFailed, pairs } = await retireImported($, options, saved)
  const noun = proposal.kind === 'doc' ? 'chunk' : 'memory'
  const nouns = proposal.kind === 'doc' ? 'chunks' : 'memories'
  await record($, options, [
    { action: 'import', origin: proposal.kind === 'doc' ? 'import' : 'session', owner: me, client: 'mnemosyne-import', text: `import ${label}: ${plural(saved.length, noun, nouns)} saved`, ids: saved.map(item => item.id), count: saved.length, ok: failed === 0, error: firstError },
    ...(retired.length > 0 ? [{ action: 'retire' as const, origin: 'import' as const, owner: me, client: 'mnemosyne-import', text: `import ${label}: ${plural(retired.length / 2, 'earlier chunk')} replaced`, ids: retired, count: retired.length / 2, ok: retireFailed === 0 }] : []),
  ])
  progress($, `${plural(saved.length, noun, nouns)} imported`)
  return [
    `Imported ${plural(saved.length, noun, nouns)} of ${label} (${plural(todo.length, noun, nouns)} ${todo.length === 1 ? 'was' : 'were'} due).`,
    `Skipped: ${skipped.unchanged} already in the store, ${skipped.blocked} blocked, ${skipped.edited} edited since the dry run (run it again), ${skipped.confirm} with a warning (resend as /mnemosyne-import apply confirm to save them).`,
    ...(pairs > 0 ? [`Replaced ${retired.length / 2} of ${plural(pairs, 'earlier chunk')}: each old row is retired, not deleted, and can be restored.${retireFailed > 0 ? ` ${plural(retireFailed, 'retire')} failed; the new chunks are saved and the old rows were left as they were.` : ''}`] : []),
    ...(failed > 0 ? [`${plural(failed, 'save')} failed (${firstError}).`] : []),
    ...(notReached > 0 ? [`Stopped early: ${plural(notReached, noun, nouns)} not reached; run /mnemosyne-import apply again to finish.`] : []),
    'Knowledge is not extracted from imported memories (no model call each): /mnemosyne-knowledge does that when you want it.',
  ].join('\n')
}

// ---- SESSION: the last session's summary, the first-prompt block and the unused-expiry sweep (hooks/session.ts, bin/memories.ts) ----

// A look at the store or a marker is quick; the sweep backs the store up (a VACUUM INTO copy) before it changes anything, so it gets the backup's time.
const SESSION_CLI_TIMEOUT_MS = 20_000
const SWEEP_TIMEOUT_MS = BACKUP_TIMEOUT_MS + 120_000
// session.end shares one short wall-clock bound with every other hook, so the marker gets a small part of it.
const MARKER_TIMEOUT_MS = 1_000
// The first prompt waits for the block's store read at most this long: a stuck read costs the prompt a few seconds, never the 20 s of a slow command.
const BLOCK_TIMEOUT_MS = 3_000

// Per plugin instance: whether a sweep or a summary run is going now, so two triggers close together run one.
const running = new WeakMap<object, { sweep: boolean; summaries: boolean }>()
const runningOf = (options: PluginOptions) => {
  const found = running.get(options) ?? { sweep: false, summaries: false }
  running.set(options, found)
  return found
}

/**
 * SESSION.1: session.end leaves a marker for the session that ended: its id, its owner and where its transcript is, found as
 * IMPORT.0 recorded (<home>/.claude/projects/<slug of the working folder>/<id>.jsonl). No text, no model call, so it is quick on
 * exit. Only with the sessionSummary option on. Never throws.
 */
async function leaveSessionMarker($: EngineInterface, options: PluginOptions, sessionId: string) {
  try {
    if (!sessionSummaryOn(options)) return
    const [{ root, home }, me, cwd] = await Promise.all([paths($, options), owner($, options), $.session.cwd()])
    const entry = pendingSession(sessionId, me, transcriptPath(home, slashes(cwd), sessionId))
    if (entry === undefined) return
    await memoriesCli($, options, ['session-pending', 'write', root], JSON.stringify(entry), MARKER_TIMEOUT_MS)
  } catch {
    // a marker is best effort: the session ends either way
  }
}

/**
 * SESSION.2: the first-prompt block, from the store only (a read-only look through bin/memories.ts: no model, no engine
 * process, no network): the newest live session summary, then pinned memories. The settings decide how many pins: never
 * more than the first-prompt count (R3). Never throws; nothing to show gives undefined.
 */
async function firstPromptBlock($: EngineInterface, options: PluginOptions, settings: ResolvedSettings) {
  try {
    const pins = Math.min(BLOCK_PINNED_MAX, settings.recall.firstPromptCount)
    const read = parseBlockRead(await memoriesCli($, options, ['first-prompt', await owner($, options), String(pins)], undefined, BLOCK_TIMEOUT_MS))
    return buildSessionBlock(read, pins)
  } catch {
    return undefined
  }
}

/**
 * SESSION.1: finishes the pending session summaries, in the background after a session's first reply. For each marker (at most
 * 3 a run, never the running session): a session already summarised, with no transcript or with too little said is dropped;
 * otherwise one Haiku call (the extractionModel) turns the redacted conversation into a note of at most 600 characters, which
 * goes through admit() and is saved as kind 'event', source 'import:session', expiring in 30 days, with metadata.session. A lost
 * call or save leaves the marker for the next first prompt. Memory text is never logged. Never throws.
 */
async function finishSessionSummaries($: EngineInterface, options: PluginOptions) {
  const mine = runningOf(options)
  if (mine.summaries) return
  mine.summaries = true
  try {
    const model = extractionModelOf(options)
    if (!sessionSummaryOn(options) || extractionOff(model)) return
    if (!(await isInstalled($, options)) || !(await isCurrent($, options))) return
    const { root, home } = await paths($, options)
    const current = await $.session.id().catch(() => undefined)
    const pending = (JSON.parse(await memoriesCli($, options, ['session-pending', 'list', root], undefined, SESSION_CLI_TIMEOUT_MS)) as unknown[])
      .map(item => parsePending(JSON.stringify(item)))
      .filter((entry): entry is PendingSession => entry !== undefined && entry.sessionId !== current)
      .slice(0, SUMMARY_MAX_PER_RUN)
    if (pending.length === 0) return
    const settings = await settingsFor($, options)
    const done = new Set((JSON.parse(await memoriesCli($, options, ['summarised', ...pending.map(entry => entry.sessionId)], undefined, SESSION_CLI_TIMEOUT_MS)) as { done: string[] }).done)
    const drop = (entry: PendingSession) => memoriesCli($, options, ['session-pending', 'remove', root, entry.sessionId], undefined, SESSION_CLI_TIMEOUT_MS).catch(() => undefined)
    const never = new AbortController().signal
    for (const entry of pending) {
      const folder = transcriptFolder(entry, home)
      if (done.has(entry.sessionId) || folder === undefined) {
        await drop(entry)
        continue
      }
      let read: SessionRead
      try {
        read = JSON.parse(await importCli($, options, ['session', '--projects', `${home}/.claude/projects`, '--cwd', cwdForFolder(folder), entry.sessionId])) as SessionRead
      } catch (err) {
        // No transcript is final (dropped); any other failure may pass (kept).
        if (/^there is no transcript/.test((err as Error).message)) await drop(entry)
        continue
      }
      if (read.turns < SUMMARY_MIN_TURNS || read.text === '') {
        await drop(entry)
        continue
      }
      const reply = await withRateLimitRetry(
        () => $.model.complete({ model, system: summarySystemPrompt(), prompt: summaryPrompt(read.text), maxTokens: SUMMARY_MAX_TOKENS, timeoutMs: SUMMARY_CALL_TIMEOUT_MS }, { signal: never }),
        ms => $.clock.sleep(ms, { signal: never }),
      ).catch(() => undefined)
      if (reply === undefined || !reply.isAnswered) continue
      const summary = parseSummary(reply.text)
      const guard = summary === undefined ? undefined : admit({ content: summary, kind: 'event', origin: 'import' }, guardConfigOf(settings))
      // Nothing to say, a block, or a warning with nobody to confirm it (strict mode): the marker goes and nothing is saved.
      if (summary === undefined || guard === undefined || guard.verdict === 'block' || (guard.verdict === 'warn' && (guardModeOf(options) === 'strict' || guard.mustConfirm === true))) {
        await drop(entry)
        continue
      }
      const flags = guard.verdict === 'warn' ? [...new Set(guard.hits.map(hit => hit.rule))] : []
      const answers = await runAll(
        $,
        options,
        [
          [
            'mnemopi_remember',
            {
              content: summary,
              importance: 0.5,
              ...importProvenance('session'),
              scope: options.scope === 'per-project' ? 'channel' : 'global',
              memory_type: 'event',
              valid_until: new Date(Date.now() + SUMMARY_VALID_DAYS * 86_400_000).toISOString(),
              metadata: { session: entry.sessionId, ...(flags.length > 0 ? { guard: flags } : {}) },
            },
          ],
        ],
        entry.owner,
      ).catch((err: unknown) => [err instanceof Error ? err : new Error(String(err))])
      const answer = answers[0]
      const id = answer === undefined || answer instanceof Error ? undefined : savedId(answer)
      if (id !== undefined) await drop(entry)
      await record($, options, [
        { action: 'remember', origin: 'session', owner: entry.owner, client: 'mnemosyne-session', text: 'session summary', ids: id === undefined ? [] : [id], count: id === undefined ? 0 : 1, ok: id !== undefined, error: id === undefined ? 'the summary was not saved' : '' },
      ])
    }
  } catch {
    // background work: a failure leaves the markers for the next first prompt
  } finally {
    mine.summaries = false
  }
}

/**
 * SESSION.4: the unused-expiry sweep. At most once a day (bin/memories.ts sweep-claim writes the 24-hour marker), for the
 * owner's own rows, in the background; never from a test or a build against a real store (the specs use a temp HOME).
 * `bin/memories.ts expire --apply` does the work: a dry run first, then, only when something would expire, the C9 backup
 * (a failed backup stops the sweep before any change), then mnemopi_expire_unused with dry_run false and the validator
 * 'expire-sweep'. Rows are only ever expired (valid_until), never deleted. The activity line holds counts and ids, never text.
 */
async function maybeSweep($: EngineInterface, options: PluginOptions) {
  const mine = runningOf(options)
  if (mine.sweep) return
  mine.sweep = true
  try {
    const setting = expireSetting(options.expireUnusedDays)
    if (setting.mode !== 'on') return
    if (!(await isInstalled($, options)) || !(await isCurrent($, options))) return
    const { root } = await paths($, options)
    const me = await owner($, options)
    const claim = JSON.parse(await memoriesCli($, options, ['sweep-claim', root], undefined, SESSION_CLI_TIMEOUT_MS)) as { due?: unknown }
    if (claim.due !== true) return
    let report: { count: number; rows: { id: string }[] }
    try {
      report = JSON.parse(await memoriesCli($, options, ['expire', '--apply', '--json', '--days', String(setting.days), '--owner', me, '--root', root], undefined, SWEEP_TIMEOUT_MS))
    } catch (err) {
      await record($, options, [{ action: 'expire', origin: 'session', owner: me, client: 'mnemosyne-sweep', text: 'unused-expiry sweep failed', ok: false, error: (err as Error).message }])
      return
    }
    if (report.count > 0) {
      await record($, options, [{ action: 'expire', origin: 'session', owner: me, client: 'mnemosyne-sweep', text: `unused-expiry sweep: ${plural(report.count, 'memory', 'memories')} expired`, ids: report.rows.map(row => row.id), count: report.count, ok: true }])
    }
  } catch {
    // background work: the next trigger tries again after the marker's day
  } finally {
    mine.sweep = false
  }
}

export const register: Register = (on, options) => {
  const isPerProject = options.scope === 'per-project'
  // Per session, the tail of its extraction chain (one at a time).
  const extractions = new Map<string, Promise<unknown>>()
  // Per session, the tools registered at its start (M1). A tool switched on in config.json later is not registered until the next
  // session, so the remember trigger and the rules block follow this set, never the file alone: Claude is never told to call a missing tool.
  const registered = new Map<string, Set<ToolName>>()
  // Sessions whose first prompt was seen and whose first reply has not ended yet: the summaries and the sweep run after that reply (SESSION.1, SESSION.4).
  const afterFirstReply = new Set<string>()

  const engineArgs = (tool: string, input: Record<string, unknown>, rules: TagRules, settings: ResolvedSettings) => {
    switch (tool) {
      case 'memory_remember': {
        const isGlobal = !isPerProject || input.global === true
        // Tags are cleaned as the engine stores them (hooks/tags.ts); none left, no metadata.
        const tags = Array.isArray(input.tags) ? cleanTags(input.tags, rules) : []
        const validUntil = validUntilFor(input.kind, input.expires_in_days, Date.now(), settings.expiry.contextDays)
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
            // A context note fades after the context days (setting E1, 14 by default) unless the call gives expires_in_days.
            ...(validUntil === undefined ? {} : { valid_until: validUntil }),
            ...(tags.length > 0 ? { metadata: { tags } } : {}),
          },
        ] as const
      }
      case 'memory_recall':
        // R2: the limit defaults to and is capped by the settings (5 and 50 by default); R5: the ranking weights go on every call.
        return ['mnemopi_recall', { query: input.query, limit: clamp(input.limit, 1, settings.recall.maxLimit, settings.recall.defaultLimit), ...weightArgs(settings) }] as const
      case 'memory_forget':
        return ['mnemopi_forget', { memory_id: input.memory_id }] as const
      case 'memory_update': {
        const args = updateArgs(input, rules)
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
      name: 'mnemosyne-import',
      description: 'Import a .md or .txt document, or boil a past session down to a few memories: a dry run checks everything and writes nothing; "apply" backs the store up, then saves',
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
    // M1: a tool switched off is not registered, so Claude never sees it; the registered set is kept for this session (see `registered`).
    const settings = await settingsFor($, options)
    const enabled = new Set<ToolName>(TOOL_NAMES.filter(name => settings.tools[name]))
    const session = await $.session.id().catch(() => undefined)
    if (session !== undefined) registered.set(session, enabled)
    for (const tool of toolsFor(settings)) if (enabled.has(tool.name)) await $.tool.register({ ...tool, isDeferred: false })
    if (!(await isInstalled($, options))) $.ui.toast('Mnemosyne Memory engine not installed. Run /mnemosyne-setup.')
    else {
      // A stale engine keeps recall, forget and stats working; memory_remember and memory_update refuse (an old engine's 24 h trim would delete the new saves).
      if (!(await isCurrent($, options))) $.ui.toast('Mnemosyne Memory engine is out of date. Run /mnemosyne-setup to update it.')
      await Promise.all([secure($, options), syncWrapper($, options)]).catch(() => undefined)
      activity($, options, 'memory ready', 'ready')
    }
    void registerProject($, options) // fire and forget: no host call it makes (repo, cwd, env) delays the session start
    // SESSION.4: a refused expireUnusedDays says so once here; a sweep that is due runs in the background (it also runs from the first prompt, so a process that only ever sees /clear still sweeps).
    const sweepSetting = expireSetting(options.expireUnusedDays)
    if (sweepSetting.mode === 'refused') $.ui.toast(`Mnemosyne: ${sweepSetting.reason}`)
    void maybeSweep($, options)

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
    if (mode !== '' && mode !== 'apply' && mode !== 'retag') return { text: TAGS_USAGE }
    const bun = await $.process.run(['bun', '--version']).catch(() => null)
    if (bun?.exitCode !== 0) return { text: 'The tag backfill needs Bun on PATH: https://bun.sh' }
    try {
      if (!(await isInstalled($, options))) return { text: 'The tag backfill needs the engine: run /mnemosyne-setup first.' }
      if (!(await isCurrent($, options))) return { text: 'The Mnemosyne engine is out of date (the backfill needs memory_update): run /mnemosyne-setup, then try again.' }
      return { text: mode === 'apply' ? await tagsApply($, options, next.signal) : await tagsDryRun($, options, next.signal, mode === 'retag') }
    } catch (err) {
      return { text: `Mnemosyne tag backfill failed: ${(err as Error).message}` }
    }
  }).catch(() => ({ text: 'Mnemosyne: the tag backfill failed.' }))

  // The importers: doc and session are dry runs (nothing is written); apply backs the store up, then saves what the last dry run checked.
  on('command.run', { command: 'mnemosyne-import' }, async ($, e, next) => {
    const parsed = parseImportArgs(e.args)
    if (parsed.mode === 'usage') return { text: IMPORT_USAGE }
    const bun = await $.process.run(['bun', '--version']).catch(() => null)
    if (bun?.exitCode !== 0) return { text: 'The importers need Bun on PATH: https://bun.sh' }
    try {
      if (!(await isInstalled($, options))) return { text: 'The importers need the engine: run /mnemosyne-setup first.' }
      if (!(await isCurrent($, options))) return { text: 'The Mnemosyne engine is out of date (an import saves with this build\'s provenance): run /mnemosyne-setup, then try again.' }
      if (parsed.mode === 'doc') return { text: await importDocDryRun($, options, parsed.path) }
      if (parsed.mode === 'apply') return { text: await importApply($, options, parsed.confirm, next.signal) }
      return { text: await importSessionDryRun($, options, parsed.target, next.signal) }
    } catch (err) {
      return { text: `Mnemosyne import failed: ${(err as Error).message.slice(0, 300)}` }
    }
  }).catch(() => ({ text: 'Mnemosyne: the import failed.' }))

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
      // C9: apply and rebuild write vectors (rebuild wipes them first), so the store is backed up first; a failed backup stops the run.
      if (mode !== '') {
        const stopped = await backupFirst($, options, `/mnemosyne-embed ${mode}`)
        if (stopped !== undefined) return { text: stopped }
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

  // A session that opened or reused the dashboard ends (exit, /clear, resume...): the server stops with its last user.
  on('session.end', async ($, e, next) => {
    // Where the list is, from the settings rather than this module's memory (a reload empties it).
    const where = await paths($, options).then(
      found => ({ plugin: slashes($.plugin.root), root: found.root }),
      () => undefined,
    )
    // SESSION.1: the marker for this session's summary is written beside the dashboard stop, so neither waits for the other inside the exit's short bound.
    await Promise.all([stopDashboard($, e.sessionId, where).catch(() => undefined), leaveSessionMarker($, options, e.sessionId)])
    registered.delete(e.sessionId)
    afterFirstReply.delete(e.sessionId)
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
    // The settings are read per call (G2-G7 and the rest), so a change in the dashboard applies to the next save.
    const settings = await settingsFor($, options)
    const guard: GuardResult | undefined = saves
      ? admit({ content: input.content as string, kind: typeof input.kind === 'string' ? input.kind : undefined, origin: 'tool' }, guardConfigOf(settings))
      : undefined
    const guardIds = guard === undefined ? [] : [...new Set(guard.hits.map(hit => hit.rule))]
    const warnIds = guard?.verdict === 'warn' ? guardIds : []
    // Strict mode: a warned save is refused until the call says confirm: true. A block has no override.
    // The chatter check set to strict (G6) asks for the confirm whatever the guard mode.
    const needsConfirm = guard?.verdict === 'warn' && (guardModeOf(options) === 'strict' || guard.mustConfirm === true) && input.confirm !== true
    const refusedByGuard = guard?.verdict === 'block' || needsConfirm
    // A remember with no kind is refused before anything runs, and like a guard refusal it leaves the remember trigger for the retry.
    const missingKind = tool === 'memory_remember' && (input.kind === undefined || input.kind === null)
    // UPGRADE.1: a save on an installed engine older than this build is refused below. Computed here so the near-duplicate check runs no engine and a refused save leaves the remember trigger for the retry.
    const staleSave = tool === 'memory_remember' && (await isInstalled($, options).catch(() => false)) && !(await isCurrent($, options))
    // G3 (META.3): close memories of a text about to be saved. Before the trigger is consumed, so a refusal leaves it for the retry.
    const replacesId = tool === 'memory_remember' && typeof input.replaces === 'string' && REPLACES_ID.test(input.replaces) ? input.replaces : undefined
    const replacesOwner = replacesId !== undefined && typeof input.owner === 'string' && REPLACES_ID.test(input.owner) ? input.owner : undefined
    // The memory named in replaces is meant to be superseded, so it is not a near-duplicate to warn about.
    const near = tool === 'memory_remember' && !refusedByGuard && !staleSave && !missingKind ? (await nearDuplicates($, options, input.content as string, settings)).filter(match => match.id !== replacesId) : []
    const nearRefused = near.length > 0 && guardModeOf(options) === 'strict' && input.confirm !== true
    const refused = refusedByGuard || nearRefused || missingKind
    // KNOWX.1: only the main thread's first save after a remember phrase is the
    // human's. A subagent's event carries an agentId and never consumes the trigger.
    let provenance: { author_type: 'human'; veracity: 'stated' } | undefined
    if (tool === 'memory_remember' && e.agentId === undefined && !refused && !staleSave) {
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
    // C6: tags are cleaned with the vocabulary's aliases and without the owner's project name (the row's owner on an update).
    const rules = Array.isArray(input.tags) && (tool === 'memory_remember' || tool === 'memory_update') ? await tagRulesFor($, options, settings, as) : {}
    let retired: Retired | undefined
    const answer = await (async (): Promise<{ result: string; reply: string } | { deny: string }> => {
      try {
        if (guard?.verdict === 'block') {
          return { deny: `Mnemosyne: the save guard blocked this save (${guardIds.join(', ')}). ${guard.hits.map(hit => hit.message).join(' ')}` }
        }
        // Before the warnings, so a warned save without a kind is fixed in one retry, not two.
        if (missingKind) return { deny: `Mnemosyne: ${missingKindMessage('memory_remember')}` }
        if (nearRefused) {
          return { deny: `Mnemosyne: the save guard warns about this save (G3). ${nearDuplicateMessage(near)} Or resend with confirm: true if a new memory is wanted.` }
        }
        if (needsConfirm) {
          return { deny: `Mnemosyne: the save guard warns about this save (${guardIds.join(', ')}). ${guard!.hits.map(hit => hit.message).join(' ')} Resend with confirm: true if the save is wanted.` }
        }
        if (tool === 'memory_remember') {
          const badKind = kindProblem(input.kind)
          if (badKind !== undefined) return { deny: `Mnemosyne: ${badKind}` }
          const badDays = expiresInDaysProblem(input.expires_in_days)
          if (badDays !== undefined) return { deny: `Mnemosyne: ${badDays}` }
          const badReplaces = replacesProblem(input)
          if (badReplaces !== undefined) return { deny: `Mnemosyne: ${badReplaces}` }
        }
        if (tool === 'memory_update') {
          const refused = updateArgs(input, rules)
          if (typeof refused === 'string') return { deny: `Mnemosyne: ${refused}` }
        }
        if (!(await isInstalled($, options))) {
          await paths($, options) // a bad HOME or memoryDir says so rather than "not installed"
          return { deny: NOT_INSTALLED }
        }
        if ((tool === 'memory_update' || tool === 'memory_remember') && !(await isCurrent($, options))) return { deny: NOT_CURRENT }
        const [name, args] = engineArgs(tool, input, rules, settings)
        // The trigger save is the person's: human, with veracity 'stated'.
        // C4: source 'user' and trust tier STATED besides the human author and veracity 'stated'.
        const withProvenance = provenance === undefined ? args : { ...args, ...provenance, source: 'user', trust_tier: 'STATED' }
        // A warned save is stored, flagged with the rule ids in metadata.guard.
        // A content update that now passes the guard clean clears an old flag (null removes the key through the metadata merge).
        const clearsGuard = tool === 'memory_update' && typeof input.content === 'string' && warnIds.length === 0
        const flags = [...warnIds, ...nearDuplicateFlags(near)]
        const sent: Record<string, unknown> =
          flags.length > 0
            ? { ...withProvenance, metadata: { ...(withProvenance as { metadata?: object }).metadata, guard: flags } }
            : clearsGuard
              ? { ...withProvenance, metadata: { ...(withProvenance as { metadata?: object }).metadata, guard: null } }
              : withProvenance
        const text = await call($, options, name, sent, as)
        // META.4: the save went in; now the memory it replaces is retired, as its owner. A failure here is a line, not a denial.
        let retireLine = ''
        if (replacesId !== undefined) {
          retired = await retireReplaced($, options, replacesId, savedId(text), replacesOwner)
          retireLine = retired.line
        }
        // One warning line per hit, after the engine's reply; `reply` stays the engine's own text.
        const warnings = (warnIds.length > 0 ? guard!.hits.map(hit => `\nMnemosyne guard warning: ${hit.message}`).join('') : '') + (near.length > 0 ? `\nMnemosyne guard warning: ${nearDuplicateMessage(near)}` : '')
        return { reply: text, result: name === 'mnemopi_recall' ? JSON.stringify(compact(text)) : name === 'mnemopi_stats' ? mnemosyneStats(text) : `${text}${warnings}${retireLine}` }
      } catch (err) {
        return { deny: `Mnemosyne: ${(err as Error).message}` }
      }
    })()
    if (action !== undefined) {
      const blocked = refusedByGuard || nearRefused
      // A refused call logs its rule ids only: no content text, in the line or the error.
      const outcome = blocked ? { ok: false, error: `guard:${[...guardIds, ...(near.length > 0 ? ['G3'] : [])].join(',')}` } : 'deny' in answer ? { ok: false, error: answer.deny } : callOutcome(action, input, answer.reply)
      // Tags as the engine gets them, cleaned, as the proxy logs them.
      const shown = Array.isArray(input.tags) ? { ...input, tags: cleanTags(input.tags, rules) } : input
      // A retire line follows the save's own line, with both ids and no memory text (META.4).
      const retireEntry = retired === undefined ? [] : [{ action: 'retire' as const, origin: 'tool' as const, owner: retired.owner, text: `retire ${retired.oldId} replaced by ${retired.newId ?? 'unknown'}`, ids: [retired.oldId, ...(retired.newId === undefined ? [] : [retired.newId])], count: retired.ok ? 1 : 0, ok: retired.ok, error: retired.error }]
      await record($, options, [{ action, origin: 'tool', owner: as, text: blocked || staleSave || missingKind ? '' : callText(action, shown), ...outcome, ...(provenance ?? {}) }, ...retireEntry])
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
  on('prompt.compose', async ($, e, next) => {
    const composed = await next(e)
    if (e.traits.includes('bare') || !e.tools.includes('mcp__mnemosyne__memory_remember')) return composed
    // M1 and C6: no block while memory_remember is off or was not registered this session; its numbers follow the settings.
    const settings = await settingsFor($, options)
    if (!(await rememberRegistered($, registered, settings))) return composed
    return { ...composed, sections: [...composed.sections, rulesSection(settings)] }
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
      // The session's first reply is done: the summaries of earlier sessions and the sweep run now, in the background.
      if (session !== undefined && afterFirstReply.delete(session)) {
        void finishSessionSummaries($, options).then(() => maybeSweep($, options))
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
    const settings = await settingsFor($, options)
    // M1: with memory_remember off (or not registered this session) a remember term triggers nothing, so Claude is never asked to call a missing tool.
    const remember = isPerson && (await rememberRegistered($, registered, settings)) ? afterTerm(e.text, rememberTerms) : undefined
    const asked = isPerson && remember === undefined ? afterTerm(e.text, recallTerms) : undefined
    const session = await $.session.id()
    const isFirst = !(await read($, recalled))[session]
    // SESSION.1 and SESSION.4: the first prompt of a session arms the work that runs after its reply.
    if (isFirst) afterFirstReply.add(session)
    // R3: with the first-prompt recall off there is no automatic recall; a recall term still recalls.
    const autoRecall = isFirst && settings.recall.firstPrompt
    if (!autoRecall && !remember && asked === undefined) {
      // The first prompt has passed without a recall: marked, so switching the setting on later waits for the next session instead of recalling on some later prompt.
      if (isFirst) await update($, recalled, seen => ({ ...seen, [session]: true as const }))
      return next(e)
    }
    if (!(await isInstalled($, options))) return next(e)
    if (isFirst) await update($, recalled, seen => ({ ...seen, [session]: true as const }))

    const context: string[] = []
    const logged: Activity[] = []
    // SESSION.2: the last session's summary and the pinned memories, read from the store while the recall runs; only where the first-prompt recall is on (R3), so its switch, count and sentences rule.
    const blockPromise = autoRecall ? firstPromptBlock($, options, settings) : Promise.resolve(undefined)
    if (remember) {
      // KNOWX.1: the first main-thread save of this turn is the human's. Cleared
      // at turn end, so a turn that saves nothing leaves the next turn an agent save.
      await update($, pendingTrigger, seen => ({ ...seen, [session]: true as const }))
      activity($, options, 'remember term matched; asking Claude to save it')
      // The save itself is Claude's memory_remember call, logged with origin tool.
      logged.push({ action: 'remember', origin: 'trigger', text: remember, ok: true })
      context.push(
        `The user invoked a Mnemosyne remember trigger. Call mcp__mnemosyne__memory_remember exactly once, with a kind, with a self-contained version of:\n${remember}\nIf it is a secret or credential, do not save it; say so.`,
      )
    }
    // A recall term is the reason for the recall, even on a first prompt.
    const origin = asked !== undefined ? 'trigger' : 'hook'
    let queries: string[] = []
    // The block goes ahead of the recall in the context: it is inserted here, after the remember entry.
    const blockAt = context.length
    try {
      // The engine drops a row matching under ~22% of the query's words, so a long
      // prompt recalls nothing as one query: ask per sentence, in one process.
      const sentences = (text: string) => text.split(/(?<=[.?!])\s+|\n+/).map(t => t.trim()).filter(Boolean)
      // A recall term's query is the first sentence after it: "recall: heron? and then…" asks for heron.
      const topic = asked ? sentences(asked)[0]?.replace(/[?.!]+$/, '') : undefined
      // Each query as the engine gets it: at most 300 characters.
      queries = [...new Set([...(topic ? [topic] : []), ...(autoRecall ? sentences(e.text).slice(0, settings.recall.firstPromptSentences) : [])])].map(query => query.slice(0, 300))
      const count = settings.recall.firstPromptCount
      const answers = queries.length === 0 ? [] : await runAll($, options, queries.map(query => ['mnemopi_recall', { query, limit: count, ...weightArgs(settings) }] as const))
      const byId = new Map<string, { id: string; owner: string; content: string }>()
      // A memory the block shows is not listed again by the recall (shown once).
      const shown = new Set((await blockPromise)?.ids ?? [])
      for (const answer of answers) if (typeof answer === 'string') for (const row of compact(answer)) if (!shown.has(row.id)) byId.set(row.id, row)
      const found = [...byId.values()].slice(0, count)
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
      else if (autoRecall) activity($, options, n > 0 ? `recalled ${n} ${noun} for ${where}` : `recall found nothing for ${where}`, n > 0 ? `recalled ${n}` : 'found nothing')
      if (found.length > 0) {
        const lines = found.map(r => `- [${r.id} owner=${r.owner}] ${r.content}`)
        // M1: the heading names a tool only when this session has it (the settings decide without a record of the start).
        const tools = registered.get(session)
        context.push(`${recallHeading(tool => (tools === undefined ? settings.tools[tool] : tools.has(tool)))}\n${lines.join('\n')}`)
      } else if (asked !== undefined) {
        context.push(`Mnemosyne recall for "${topic ?? asked}" found nothing.`)
      }
    } catch (err) {
      // recall is best effort; the prompt goes on without it
      activity($, options, 'recall failed')
      logged.push({ action: 'recall', origin, text: queries.join(' | '), ok: false, error: (err as Error)?.message })
    }
    const block = await blockPromise
    if (block !== undefined) {
      context.splice(blockAt, 0, block.text)
      logged.push({ action: 'recall', origin: 'hook', text: 'last session summary and pinned memories', ids: block.ids, count: block.ids.length, ok: true })
    }
    await record($, options, logged)
    return context.length > 0 ? next({ ...e, context: [...(e.context ?? []), ...context] }) : next(e)
  }).catch((_$, e, next) => next(e))
}
