// The dashboard's settings routes (0.8.5 settings plan, phase SRV; C5, C7, C8):
//   GET  /api/settings          every setting with its value, default, home and "applies" badge
//   POST /api/settings/update   { id, value } or { id, add } / { id, remove } (+ confirm for memoryDir and scope)
//   POST /api/settings/reset    { id } or { all: true, confirm: "reset" }
//   POST /api/backup            {} : a store backup now (bin/memories.ts backup)
//
// ui/server.ts registers these four routes behind its usual protections (token, Host, Origin, JSON only,
// body cap, CSP); this module holds the logic. Two homes (plan, "Two homes for settings"):
//   1. config settings live in <root>/config.json and go through bin/settings.ts (checked, temp file and rename).
//   2. plugin options live in Claude Code's own settings; they are read and written only through
//      `claude plugin configure <id> --json` and `--values-stdin` with exactly one key per call, after the
//      value passed the schema the CLI itself gave, then read back. Nothing here opens settings.json.
// Nothing here logs a token, a list item or a memory: the activity log gets setting ids and kinds of value.
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve as resolvePath, sep } from 'node:path'
import { readConfig, resetAll, writeConfig } from '../bin/settings'
import type { WriteResult } from '../bin/settings'
import { BACKUPS_DIR } from '../bin/memories'
import { settingsFields } from '../hooks/activity-log'
import type { ActivityFields } from '../hooks/activity-log'
import { ENGINE_BUILD } from '../hooks/engine-build'
import { findSetting, SETTINGS, settingValue, valueKind } from '../hooks/settings'
import type { SettingChange, SettingDef, ValueKind } from '../hooks/settings'
import { MAX_TAG_LENGTH, NAMESPACES } from '../hooks/tags'
import { parseVocabulary, VOCAB_FILE } from '../hooks/vocab'

type Answer = { status: number; body: unknown }

/** What the routes need of the server's Config. */
export type SettingsConfig = {
  root: string
  store: string
  pluginRoot: string
  /** The installed plugin's id (`name@marketplace`); empty or absent for a --plugin-dir install. */
  pluginId?: string
  /** The claude CLI to run; `claude` when absent. */
  claudeCli?: string
}

/** Test hooks; production passes none. */
export type SettingsDeps = {
  /** The environment spawned processes (claude, the backup) start with. */
  env?: Record<string, string | undefined>
  /** Makes one backup of the store: its file name and size. Defaults to `bun bin/memories.ts backup`. */
  runBackup?: (store: string, root: string) => Promise<{ name: string; size: number; rows: number }>
}

export const CLAUDE_TIMEOUT_MS = 20_000
export const BACKUP_TIMEOUT_MS = 120_000
const BACKUP_NAME = /^mnemopi-\d{8}T\d{9}Z\.db$/
const OPTION_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/
const CONTROL = /[\p{Cc}\u2028\u2029]/u
export const OPTION_ITEM_MAX = 80
export const OPTION_TEXT_MAX = 1000

export const GROUPS = [
  { id: 'guard', label: 'Guard' },
  { id: 'tags', label: 'Tags' },
  { id: 'recall', label: 'Recall and embeddings' },
  { id: 'expiry', label: 'Expiry' },
  { id: 'storage', label: 'Storage' },
  { id: 'tools', label: 'Tools' },
  { id: 'setup', label: 'Setup' },
  { id: 'other', label: 'Other plugin options' },
] as const

// The order the plan's settings table lists them in.
const REF_ORDER = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'T1', 'T2', 'T3', 'R1', 'R2', 'R3', 'R4', 'R5', 'E1', 'E2', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'M1', 'M2', 'M3', 'D1', 'D2']

// Where a known plugin option sits in the settings list. An option the schema adds later has no entry and lands in "other".
const OPTION_PLACE: Readonly<Record<string, { ref: string; group: string; confirm?: boolean }>> = {
  guardMode: { ref: 'G1', group: 'guard' },
  embeddings: { ref: 'R1', group: 'recall' },
  rememberTerms: { ref: 'R4', group: 'recall' },
  recallTerms: { ref: 'R4', group: 'recall' },
  expireUnusedDays: { ref: 'E2', group: 'expiry' },
  memoryDir: { ref: 'S1', group: 'storage', confirm: true },
  scope: { ref: 'S2', group: 'storage', confirm: true },
  activityLog: { ref: 'S3', group: 'storage' },
  showActivity: { ref: 'S3', group: 'storage' },
  extractionModel: { ref: 'S6', group: 'storage' },
  externalMcp: { ref: 'M2', group: 'tools' },
}

// The built-in secret rules (hooks/guard.ts SECRET_PATTERNS and the assignment check): shown, never editable (C4).
export const SECRET_RULE_NAMES: readonly string[] = [
  'AWS access key',
  'GitHub token',
  'API key (sk-)',
  'Slack token',
  'JWT',
  'private key header',
  'Bearer token',
  'URL with credentials',
  'password, secret, api_key or token assigned a value',
]

// The engine's own tools: hidden from Claude and from outside agents, listed read-only (M3).
export const ENGINE_TOOLS: readonly string[] = [
  'mnemopi_diagnose', 'mnemopi_expire_unused', 'mnemopi_export', 'mnemopi_forget', 'mnemopi_get', 'mnemopi_graph_link', 'mnemopi_graph_query',
  'mnemopi_import', 'mnemopi_invalidate', 'mnemopi_knowledge_prompt', 'mnemopi_knowledge_store', 'mnemopi_recall', 'mnemopi_remember',
  'mnemopi_scratchpad_clear', 'mnemopi_scratchpad_read', 'mnemopi_scratchpad_write', 'mnemopi_shared_forget', 'mnemopi_shared_recall',
  'mnemopi_shared_remember', 'mnemopi_shared_stats', 'mnemopi_similar', 'mnemopi_sleep', 'mnemopi_stats', 'mnemopi_triple_add',
  'mnemopi_triple_query', 'mnemopi_update', 'mnemopi_validate',
]

const EMBEDDINGS_MODEL_DIR = 'Qdrant_bge-small-en-v1.5-onnx-Q'
const EMBEDDINGS_MODEL_FILES = ['model_optimized.onnx', 'tokenizer.json', 'tokenizer_config.json', 'config.json', 'special_tokens_map.json']
const ENGINE_PACKAGE = '@oh-my-pi/pi-mnemopi'

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
/** The environment as a spawn takes it: no undefined values. */
const cleanEnv = (env: Record<string, string | undefined>) => Object.fromEntries(Object.entries(env).filter((pair): pair is [string, string] => pair[1] !== undefined))
const short = (text: string, max = 200) => text.replace(/\s+/g, ' ').trim().slice(0, max)

// ---- the claude CLI ----

type Ran = { ok: true; stdout: string } | { ok: false; reason: string }

/** Runs the claude CLI. `stdin` goes in on the pipe, never on the command line. A failure returns a short reason that holds no stdin. */
async function runClaude(cli: string, args: readonly string[], env: Record<string, string | undefined>, stdin?: string): Promise<Ran> {
  let child: ReturnType<typeof Bun.spawn>
  try {
    child = Bun.spawn([cli, ...args], { env: cleanEnv(env), stdin: stdin === undefined ? 'ignore' : 'pipe', stdout: 'pipe', stderr: 'pipe' })
  } catch {
    return { ok: false, reason: 'the claude CLI could not be started' }
  }
  const timer = setTimeout(() => child.kill(), CLAUDE_TIMEOUT_MS)
  try {
    if (stdin !== undefined) {
      const sink = child.stdin as { write: (text: string) => unknown; end: () => unknown }
      sink.write(stdin)
      await sink.end()
    }
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout as ReadableStream).text(), new Response(child.stderr as ReadableStream).text(), child.exited])
    return code === 0 ? { ok: true, stdout } : { ok: false, reason: short(stderr || stdout) || `the claude CLI exited with ${code}` }
  } catch {
    return { ok: false, reason: 'the claude CLI did not finish' }
  } finally {
    clearTimeout(timer)
  }
}

// ---- plugin options, from the CLI's schema ----

type OptionField = {
  key: string
  title: string
  description: string
  type: 'string' | 'boolean' | 'number'
  default: unknown
  options?: string[]
  multiple: boolean
  min?: number
  max?: number
}

type Options = { fields: OptionField[]; inputs: Record<string, string> }

/** The schema fields in a `claude plugin configure --json` object (or a plugin.json userConfig): unknown shapes give no fields. */
function fieldsOf(schema: unknown): OptionField[] {
  const map = isObject(schema) && isObject(schema.properties) ? schema.properties : schema
  if (!isObject(map)) return []
  const out: OptionField[] = []
  for (const [key, def] of Object.entries(map)) {
    if (!OPTION_KEY.test(key) || !isObject(def)) continue
    const type = def.type === 'boolean' ? 'boolean' : def.type === 'number' ? 'number' : 'string'
    const list = Array.isArray(def.options) ? def.options : Array.isArray(def.enum) ? def.enum : undefined
    const options = list?.filter((item): item is string => typeof item === 'string')
    out.push({
      key,
      title: typeof def.title === 'string' ? def.title : key,
      description: typeof def.description === 'string' ? def.description : '',
      type,
      default: def.default,
      ...(options !== undefined && options.length > 0 ? { options } : {}),
      multiple: def.multiple === true,
      ...(typeof def.min === 'number' ? { min: def.min } : {}),
      ...(typeof def.max === 'number' ? { max: def.max } : {}),
    })
  }
  return out
}

async function readOptions(config: SettingsConfig, env: Record<string, string | undefined>): Promise<{ ok: true; options: Options } | { ok: false; reason: string }> {
  if (!config.pluginId) return { ok: false, reason: 'this install has no plugin id' }
  const ran = await runClaude(config.claudeCli || 'claude', ['plugin', 'configure', config.pluginId, '--json'], env)
  if (!ran.ok) return ran
  let parsed: unknown
  try {
    parsed = JSON.parse(ran.stdout)
  } catch {
    return { ok: false, reason: 'the claude CLI did not answer with JSON' }
  }
  if (!isObject(parsed)) return { ok: false, reason: 'the claude CLI did not answer with a JSON object' }
  const fields = fieldsOf(parsed.schema)
  if (fields.length === 0) return { ok: false, reason: 'the claude CLI gave no option schema' }
  const inputs: Record<string, string> = {}
  if (isObject(parsed.inputs)) {
    for (const [key, value] of Object.entries(parsed.inputs)) if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') inputs[key] = String(value)
  }
  return { ok: true, options: { fields, inputs } }
}

/** The plugin's own declared options (plugin.json userConfig): the read-only fallback when the CLI cannot be asked. */
function declaredFields(pluginRoot: string): OptionField[] {
  try {
    return fieldsOf(JSON.parse(readFileSync(join(pluginRoot, '.claude-plugin', 'plugin.json'), 'utf8'))?.userConfig)
  } catch {
    return []
  }
}

const listOf = (text: string) => text.split(',').map(item => item.trim()).filter(item => item !== '')

/** A value as the CLI keeps it (a string) or the schema declares it, turned into the value the page works with. */
function typed(field: OptionField, source: unknown): unknown {
  if (field.multiple) {
    const items = Array.isArray(source) ? source.map(String) : typeof source === 'string' ? listOf(source) : []
    // "none" is how a term list is switched off: an empty list to the page.
    return items.length === 1 && items[0]!.toLowerCase() === 'none' ? [] : items
  }
  if (field.type === 'boolean') return source === true || source === 'true'
  if (field.type === 'number') return typeof source === 'number' ? source : Number(source)
  return source === undefined || source === null ? '' : String(source)
}

function optionState(field: OptionField, inputs: Record<string, string>) {
  const raw = inputs[field.key]
  const configured = raw !== undefined && raw.trim() !== ''
  return { configured, value: typed(field, configured ? raw : field.default), default: typed(field, field.default) }
}

/** The text the CLI is given for a value (it takes single-line strings). */
function written(field: OptionField, value: unknown): string {
  if (field.multiple) return (value as string[]).length === 0 ? 'none' : (value as string[]).join(', ')
  return String(value)
}

/** memoryDir's own rules, rule for rule as hooks/register.ts paths() (a value it refuses throws on every save and recall): absolute or ~/..., no control characters, not inside ~/.omp or the engine folders (case ignored, as the macOS and Windows file systems do). */
function memoryDirProblem(value: string, root: string, home: string): string | undefined {
  if (!(value.startsWith('/') || value === '~' || value.startsWith('~/') || /^[A-Za-z]:[\\/]/.test(value))) return 'must be an absolute path or start with ~/'
  if (process.platform === 'win32' && /["%]/.test(value)) return 'must not hold " or %'
  if (value.startsWith('/') || value === '~' || value.startsWith('~/')) {
    const full = resolvePath(value === '~' || value.startsWith('~/') ? join(home, value.slice(2)) : value).toLowerCase()
    const inside = (folder: string) => full === folder || full.startsWith(`${folder}${sep}`)
    if (inside(resolvePath(home, '.omp').toLowerCase())) return 'must not be inside ~/.omp'
    // The configured root and the default root under the home (what paths() checks) are both guarded.
    for (const base of [root, join(home, `.${'claude'}`, 'mnemosyne')]) {
      for (const name of ['engine', 'engine.next', 'engine.old']) {
        if (inside(resolvePath(base, name).toLowerCase())) return 'must not be inside the engine folder'
      }
    }
  }
  return undefined
}

type Prepared = { ok: true; value: unknown } | { ok: false; status: number; error: string }

/** Checks a new value (or list change) for an option against the schema; the page's value (string, boolean, number or list). */
function prepareOption(field: OptionField, current: unknown, body: { value?: unknown; add?: unknown; remove?: unknown }, has: { value: boolean; add: boolean; remove: boolean }, root: string, home: string): Prepared {
  const refuse = (error: string): Prepared => ({ ok: false, status: 400, error: `${field.key}: ${error}` })
  const wantsList = has.add || has.remove
  if (wantsList && !field.multiple) return refuse('is not a list; send value')
  if (field.multiple) {
    let list: unknown
    if (has.value) list = body.value
    else if (has.add) list = [...(current as string[]), body.add]
    else list = (current as string[]).filter(item => item !== body.remove)
    if (has.remove && !(current as string[]).includes(body.remove as string)) return { ok: false, status: 404, error: `${field.key}: that item is not in the list` }
    if (!Array.isArray(list)) return refuse('must be a list of words or phrases')
    const items: string[] = []
    for (const item of list) {
      if (typeof item !== 'string') return refuse('every entry must be text')
      const text = item.trim()
      if (text === '' || Array.from(text).length > OPTION_ITEM_MAX || CONTROL.test(text) || text.includes(',')) return refuse(`each entry must be 1 to ${OPTION_ITEM_MAX} characters on one line with no comma`)
      if (field.options !== undefined && !field.options.includes(text)) return refuse(`each entry must be one of ${field.options.join(', ')}`)
      if (!items.some(seen => seen.toLowerCase() === text.toLowerCase())) items.push(text)
    }
    return { ok: true, value: items }
  }
  const value = body.value
  if (field.type === 'boolean') return typeof value === 'boolean' ? { ok: true, value } : refuse('must be true or false')
  if (field.type === 'number') {
    const fine = typeof value === 'number' && Number.isFinite(value) && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max)
    return fine ? { ok: true, value } : refuse(`must be a number${field.min !== undefined ? ` from ${field.min}` : ''}${field.max !== undefined ? ` to ${field.max}` : ''}`)
  }
  if (typeof value !== 'string') return refuse('must be text')
  const text = value.trim()
  if (field.options !== undefined) return field.options.includes(text) ? { ok: true, value: text } : refuse(`must be one of ${field.options.join(', ')}`)
  if (Array.from(text).length > OPTION_TEXT_MAX || CONTROL.test(text)) return refuse(`must be one line of at most ${OPTION_TEXT_MAX} characters`)
  if (field.key === 'memoryDir') {
    const problem = memoryDirProblem(text, root, home)
    if (problem !== undefined) return refuse(problem)
  }
  return { ok: true, value: text }
}

// ---- the read-only facts ----

function vocabularyFacts(root: string) {
  const file = join(root, VOCAB_FILE)
  const empty = { present: false, admitted: 0, candidates: 0, aliases: 0 }
  try {
    if (!existsSync(file)) return empty
    const vocab = parseVocabulary(readFileSync(file, 'utf8'))
    const tags = Object.values(vocab.tags)
    return { present: true, admitted: tags.length, candidates: Object.keys(vocab.candidates).length, aliases: tags.reduce((sum, entry) => sum + entry.aliases.length, 0) }
  } catch {
    return { ...empty, present: true, unreadable: true }
  }
}

function setupFacts(root: string) {
  const fileExists = (path: string) => {
    try {
      return statSync(path).isFile()
    } catch {
      return false
    }
  }
  let build: string | null = null
  try {
    const version = JSON.parse(readFileSync(join(root, 'engine', 'node_modules', ENGINE_PACKAGE, 'package.json'), 'utf8'))?.version
    if (typeof version === 'string') build = version
  } catch {
    // no engine installed there
  }
  const modelDir = join(root, 'model-cache', 'cache', 'fastembed', EMBEDDINGS_MODEL_DIR)
  const present = EMBEDDINGS_MODEL_FILES.filter(name => fileExists(join(modelDir, name))).length
  return {
    engine: { installed: build !== null, build, expected: ENGINE_BUILD, current: build === ENGINE_BUILD },
    embeddings: { marker: fileExists(join(root, 'embeddings.json')), modelFiles: present, modelFilesExpected: EMBEDDINGS_MODEL_FILES.length, modelReady: present === EMBEDDINGS_MODEL_FILES.length },
    wrapper: fileExists(join(root, 'bin', 'mnemosyne-mcp')) || fileExists(join(root, 'bin', 'mnemosyne-mcp.cmd')),
    bun: Bun.version,
  }
}

type BackupInfo = { name: string; size: number; date: string }

function listBackups(root: string): BackupInfo[] {
  const folder = join(root, BACKUPS_DIR)
  try {
    return readdirSync(folder)
      .filter(name => BACKUP_NAME.test(name))
      .sort()
      .reverse()
      .flatMap(name => {
        try {
          const info = statSync(join(folder, name))
          return info.isFile() ? [{ name, size: info.size, date: info.mtime.toISOString() }] : []
        } catch {
          return []
        }
      })
  } catch {
    return []
  }
}

// ---- request bodies ----

function parseBody(text: string, allowed: readonly string[]): Record<string, unknown> | string {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return 'the body is not JSON'
  }
  if (!isObject(value)) return 'the body must be a JSON object'
  const extra = Object.keys(value).filter(key => !allowed.includes(key))
  if (extra.length > 0) return `unexpected field: ${extra[0]!.slice(0, 40)}`
  return value
}

const bad = (error: string, status = 400): Answer => ({ status, body: { error } })

function optionKinds(field: OptionField, before: { configured: boolean; value: unknown }, after: unknown): SettingChange {
  const kind = (value: unknown): ValueKind => (field.multiple ? 'list' : valueKind(value))
  const isDefault = sameJson(after, typed(field, field.default))
  return { key: field.key, old: before.configured ? kind(before.value) : 'default', new: isDefault ? 'default' : kind(after) }
}

// ---- the routes ----

export function settingsRoutes(config: SettingsConfig, log: (fields: ActivityFields) => void, deps: SettingsDeps = {}) {
  const env = deps.env ?? process.env
  // What this dashboard process started with (hooks/ui-launch.ts), to say when a changed option needs a restart.
  const started = { extraction: process.env.MNEMOSYNE_EXTRACTION, embeddings: process.env.MNEMOSYNE_EMBEDDINGS }
  // One write at a time (a settings change, a reset or a backup); an overlapping one is refused, not queued.
  let busy = false
  const exclusive = async (job: () => Promise<Answer>): Promise<Answer> => {
    if (busy) return bad('another settings change is running; try again when it ends', 429)
    busy = true
    try {
      return await job()
    } finally {
      busy = false
    }
  }
  const logChanges = (changes: readonly SettingChange[]) => {
    if (changes.length === 0) return
    try {
      log(settingsFields(changes, { origin: 'ui' }))
    } catch {
      // a log that cannot be written never fails a settings change
    }
  }

  function restartNeeded(field: OptionField, value: unknown): boolean {
    if (field.key === 'extractionModel' && started.extraction !== undefined && started.extraction !== 'unknown') {
      const now = typeof value === 'string' && value.trim() !== '' ? value.trim() : 'haiku'
      return now.toLowerCase() !== started.extraction.toLowerCase()
    }
    if (field.key === 'embeddings' && (started.embeddings === 'on' || started.embeddings === 'off')) {
      if (value === 'on' || value === 'off') return value !== started.embeddings
    }
    return false
  }

  function optionRow(field: OptionField, state: { configured: boolean; value: unknown; default: unknown } | null) {
    const place = OPTION_PLACE[field.key]
    const type = field.multiple ? 'terms' : field.type === 'boolean' ? 'boolean' : field.type === 'number' ? 'number' : field.options !== undefined ? 'choice' : 'text'
    const editable = state !== null
    return {
      id: field.key,
      ref: place?.ref ?? '',
      group: place?.group ?? 'other',
      label: field.title,
      help: field.description,
      type,
      home: editable ? 'option' : 'read-only',
      applies: 'after restart',
      default: typed(field, field.default),
      value: state?.value ?? null,
      configured: state?.configured ?? false,
      ...(field.options !== undefined ? { choices: field.options } : {}),
      ...(field.min !== undefined ? { min: field.min } : {}),
      ...(field.max !== undefined ? { max: field.max } : {}),
      ...(place?.confirm === true ? { confirm: true } : {}),
      ...(editable ? {} : { note: 'change it in /config' }),
      ...(state !== null && restartNeeded(field, state.value) ? { restartNeeded: true } : {}),
    }
  }

  function configRow(def: SettingDef, value: unknown) {
    return {
      id: def.key,
      ref: def.ref,
      group: def.group,
      label: def.label,
      help: def.help,
      type: def.type,
      home: 'config',
      applies: def.applies,
      default: def.default,
      value,
      isDefault: sameJson(value, def.default),
      ...(def.advanced === true ? { advanced: true } : {}),
      ...(def.type === 'integer' || def.type === 'number' ? { min: def.min, max: def.max } : {}),
      ...(def.type === 'choice' || def.type === 'pick' ? { choices: def.choices } : {}),
      ...(def.type === 'words' ? { maxItems: def.maxItems, minItemLength: def.minItemLength, maxItemLength: def.maxItemLength } : {}),
    }
  }

  const fact = (id: string, ref: string, group: string, label: string, help: string, value: unknown, extra: Record<string, unknown> = {}) => ({
    id, ref, group, label, help, type: 'facts', home: 'read-only', applies: 'now', default: null, value, ...extra,
  })

  /** GET /api/settings */
  async function read(): Promise<Answer> {
    const resolved = readConfig(config.root)
    const { warnings } = resolved
    const rows: Record<string, unknown>[] = []
    for (const def of SETTINGS) rows.push(configRow(def, settingValue(resolved, def.key)))

    const asked = await readOptions(config, env)
    const restart: string[] = []
    let plugin: Record<string, unknown>
    if (asked.ok) {
      plugin = { id: config.pluginId, optionsEditable: true }
      for (const field of asked.options.fields) {
        const state = optionState(field, asked.options.inputs)
        const row = optionRow(field, state)
        if ('restartNeeded' in row) restart.push(field.key)
        rows.push(row)
      }
    } else {
      plugin = { id: config.pluginId || null, optionsEditable: false, note: 'Plugin options are read-only here: change them in /config.', reason: asked.reason }
      for (const field of declaredFields(config.pluginRoot)) rows.push(optionRow(field, null))
    }
    // The option 0.9.0 adds: until the schema has it, say when it arrives.
    if (!rows.some(row => row.id === 'expireUnusedDays')) {
      rows.push(fact('expireUnusedDays', 'E2', 'expiry', 'Expire unused memories', 'Memories nobody recalls for a set number of days are retired.', null, { note: 'arrives in 0.9.0' }))
    }

    rows.push(fact('guard.secretRules', 'G8', 'guard', 'Built-in secret rules', 'These always block a save and cannot be changed or switched off by any setting.', [...SECRET_RULE_NAMES]))
    rows.push(fact('tags.format', 'T3', 'tags', 'Tag format and vocabulary', 'Tag length and namespaces are fixed. Admitting tags and aliases comes in 0.9.0.', { maxLength: MAX_TAG_LENGTH, namespaces: [...NAMESPACES], vocabulary: vocabularyFacts(config.root) }))
    rows.push(fact('tools.engineTools', 'M3', 'tools', 'Engine tools', 'The engine has these tools; they are hidden from Claude and from outside agents.', [...ENGINE_TOOLS]))
    rows.push(fact('setup.status', 'D1', 'setup', 'Setup status', 'What /mnemosyne-setup installed. Run that command to install or repair.', setupFacts(config.root)))
    const backups = listBackups(config.root)
    rows.push(fact('setup.backups', 'D2', 'setup', 'Backups', 'Copies of the store. Use "Back up now" to make one.', backups, { action: 'backup', keep: resolved.storage.backupsKeep }))

    const rank = (row: Record<string, unknown>) => {
      const at = REF_ORDER.indexOf(String(row.ref))
      return at < 0 ? REF_ORDER.length : at
    }
    const groupRank = (row: Record<string, unknown>) => GROUPS.findIndex(group => group.id === row.group)
    const sorted = rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => groupRank(a.row) - groupRank(b.row) || rank(a.row) - rank(b.row) || a.index - b.index)
      .map(item => item.row)
    return { status: 200, body: { plugin, groups: GROUPS, settings: sorted, warnings, restartNeeded: restart } }
  }

  // ---- changing one setting ----

  const configReply = (id: string, result: WriteResult, extra: Record<string, unknown> = {}): Answer => {
    if (!result.ok) return bad(`${result.key}: ${result.reason}`)
    logChanges(result.changes)
    const def = findSetting(id)!
    const now = readConfig(config.root)
    return {
      status: 200,
      body: { ok: true, id, value: settingValue(now, id), default: def.default, applies: def.applies, changed: result.changes.length > 0, ...extra },
    }
  }

  async function changeConfig(id: string, def: SettingDef, body: Record<string, unknown>, reset: boolean): Promise<Answer> {
    if (reset) return configReply(id, writeConfig(config.root, { [id]: null }))
    const hasValue = 'value' in body
    const hasAdd = 'add' in body
    const hasRemove = 'remove' in body
    let value: unknown = body.value
    if (hasAdd || hasRemove) {
      if (def.type !== 'words' && def.type !== 'pick') return bad(`${id}: is not a list; send value`)
      const items = settingValue(readConfig(config.root), id) as string[]
      if (hasAdd) {
        if (typeof body.add !== 'string') return bad(`${id}: add must be text`)
        value = [...items, body.add]
      } else {
        if (typeof body.remove !== 'string') return bad(`${id}: remove must be text`)
        const gone = body.remove.trim().toLowerCase()
        const kept = items.filter(item => item.toLowerCase() !== gone)
        if (kept.length === items.length) return bad(`${id}: that item is not in the list`, 404)
        value = kept
      }
    } else if (!hasValue) {
      return bad('send value, add or remove')
    }
    return configReply(id, writeConfig(config.root, { [id]: value }))
  }

  async function changeOption(id: string, body: Record<string, unknown>, reset: boolean): Promise<Answer> {
    if (!config.pluginId) return bad('plugin options are read-only for this install: change them in /config', 409)
    const before = await readOptions(config, env)
    if (!before.ok) return bad(`the plugin options could not be read: ${before.reason}`, 502)
    const field = before.options.fields.find(item => item.key === id)
    if (field === undefined) return bad(`${id}: not a setting`, 404)
    const state = optionState(field, before.options.inputs)
    const has = { value: 'value' in body, add: 'add' in body, remove: 'remove' in body }
    if (!reset && [has.value, has.add, has.remove].filter(Boolean).length !== 1) return bad('send exactly one of value, add or remove')
    let next: unknown
    if (reset) {
      next = state.default
    } else {
      const prepared = prepareOption(field, state.value, body, has, config.root, env.HOME ?? '')
      if (!prepared.ok) return bad(prepared.error, prepared.status)
      next = prepared.value
    }
    const text = written(field, next)
    // memoryDir and scope move which rows are seen: the person types the new value again first.
    const place = OPTION_PLACE[id]
    if (place?.confirm === true && body.confirm !== text) {
      return { status: 400, body: { error: `${id}: type the new value again to confirm`, needsConfirm: true, warning: 'Memories already saved are not moved to the new place.' } }
    }
    const wrote = await runClaude(config.claudeCli || 'claude', ['plugin', 'configure', config.pluginId, '--values-stdin'], env, JSON.stringify({ [id]: text }))
    if (!wrote.ok) return bad(`the claude CLI refused the change: ${wrote.reason}`, 502)
    // Read it back: a mismatch is reported, never hidden.
    const after = await readOptions(config, env)
    const seen = after.ok ? after.options.fields.find(item => item.key === id) : undefined
    const readBack = after.ok && seen !== undefined ? optionState(seen, after.options.inputs) : undefined
    if (readBack === undefined || !sameJson(readBack.value, next)) {
      return { status: 502, body: { error: `${id}: the claude CLI accepted the change but reading it back does not show it`, readBack: 'mismatch' } }
    }
    logChanges([optionKinds(field, state, next)])
    return {
      status: 200,
      body: {
        ok: true,
        id,
        value: readBack.value,
        default: readBack.default,
        applies: 'after restart',
        note: 'Takes effect after the plugin reloads or Claude Code restarts.',
        changed: !sameJson(state.value, next) || !state.configured,
        ...(place?.confirm === true ? { warning: 'Memories already saved are not moved to the new place.' } : {}),
        ...(restartNeeded(field, readBack.value) ? { restartNeeded: true } : {}),
      },
    }
  }

  /** POST /api/settings/update */
  function update(text: string): Promise<Answer> {
    const body = parseBody(text, ['id', 'value', 'add', 'remove', 'confirm'])
    if (typeof body === 'string') return Promise.resolve(bad(body))
    const id = body.id
    if (typeof id !== 'string' || id.length > 64) return Promise.resolve(bad('id must be a setting id'))
    const def = findSetting(id)
    if (def === undefined && (id.includes('.') || !OPTION_KEY.test(id))) return Promise.resolve(bad(`${id.slice(0, 64)}: not a setting`, 404))
    const given = ['value', 'add', 'remove'].filter(name => name in body)
    if (given.length !== 1) return Promise.resolve(bad('send exactly one of value, add or remove'))
    return exclusive(() => (def !== undefined ? changeConfig(id, def, body, false) : changeOption(id, body, false)))
  }

  /** POST /api/settings/reset */
  function reset(text: string): Promise<Answer> {
    const body = parseBody(text, ['id', 'all', 'confirm'])
    if (typeof body === 'string') return Promise.resolve(bad(body))
    if ('all' in body) {
      if ('id' in body || body.all !== true || body.confirm !== 'reset') return Promise.resolve(bad('reset all needs { all: true, confirm: "reset" }'))
      return exclusive(async () => {
        const result = resetAll(config.root)
        logChanges(result.ok ? result.changes : [])
        if (!result.ok) return bad(`${result.key}: ${result.reason}`)
        return {
          status: 200,
          body: { ok: true, all: true, scope: 'config', changed: result.changes.length > 0, applies: 'now', note: 'Every Mnemosyne setting in config.json is back at its default; the old file is kept as config.json.bak. Plugin options were not changed: reset them one at a time.' },
        }
      })
    }
    const id = body.id
    if (typeof id !== 'string' || id.length > 64) return Promise.resolve(bad('send { id } or { all: true, confirm: "reset" }'))
    const def = findSetting(id)
    if (def === undefined && (id.includes('.') || !OPTION_KEY.test(id))) return Promise.resolve(bad(`${id.slice(0, 64)}: not a setting`, 404))
    return exclusive(() => (def !== undefined ? changeConfig(id, def, body, true) : changeOption(id, body, true)))
  }

  // ---- backup ----

  async function defaultBackup(store: string, root: string) {
    const child = Bun.spawn([process.execPath, join(config.pluginRoot, 'bin', 'memories.ts'), '--store', store, 'backup', root], { env: cleanEnv(env), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
    const timer = setTimeout(() => child.kill(), BACKUP_TIMEOUT_MS)
    try {
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      if (code !== 0) throw new Error(short(stderr.replace(/^mnemosyne[^:]*:\s*/, '')) || `the backup exited with ${code}`)
      const reply = JSON.parse(stdout.trim().split('\n').pop() ?? '') as { path?: unknown; rows?: unknown }
      if (typeof reply.path !== 'string') throw new Error('the backup gave no file')
      const name = reply.path.split(/[\\/]/).pop() ?? ''
      return { name, size: statSync(reply.path).size, rows: typeof reply.rows === 'number' ? reply.rows : 0 }
    } finally {
      clearTimeout(timer)
    }
  }

  /** POST /api/backup */
  function backup(text: string): Promise<Answer> {
    const body = parseBody(text, [])
    if (typeof body === 'string') return Promise.resolve(bad(body))
    return exclusive(async () => {
      const keep = readConfig(config.root).storage.backupsKeep
      let made: { name: string; size: number; rows: number }
      try {
        made = await (deps.runBackup ?? defaultBackup)(config.store, config.root)
      } catch (err) {
        const message = short((err as Error).message)
        const status = /not enough disk space/.test(message) ? 507 : /no store database/.test(message) ? 409 : 502
        return bad(`no backup was made: ${message}`, status)
      }
      // Keep the newest S5 files (the 10 the backup itself keeps is the most it ever leaves).
      const folder = join(config.root, BACKUPS_DIR)
      try {
        for (const name of readdirSync(folder).filter(item => BACKUP_NAME.test(item)).sort().reverse().slice(keep)) rmSync(join(folder, name), { force: true })
      } catch {
        // an unreadable folder leaves the list as it is
      }
      return { status: 200, body: { ok: true, name: made.name, size: made.size, rows: made.rows, keep, backups: listBackups(config.root) } }
    })
  }

  return { read, update, reset, backup }
}
