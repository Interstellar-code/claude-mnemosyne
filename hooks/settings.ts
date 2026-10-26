// The Mnemosyne settings schema (0.8.5 settings plan, C1 and C2): every knob that lives in
// <root>/config.json, with its type, default, range, help text and when a change takes effect, and
// resolve(), the one function that turns raw JSON into a checked Settings object. The hooks, the
// outside-agent proxy and the dashboard server all read their numbers through it.
//
// Rules the module keeps:
//   1. Every default equals the number that was hard-coded before (C3): with no config file nothing
//      about a save, a recall or a tag result changes.
//   2. resolve() never throws. An unknown key is ignored; a wrong-typed or out-of-range value falls
//      back to its default and is reported in `warnings` by key name (never with the value, a list
//      item's text is never echoed).
//   3. No key can name, remove or weaken a built-in secret rule, the empty-text block or "no override
//      for a secret" (C4). The one list that touches the guard (guard.neverSave) can only add.
//   4. No imports, so the hooks, the proxy, the dashboard server and the Bun specs can all use it.
//      The file itself is read by whoever can read files: parseConfig() takes the text (a hook gives
//      it `$.fs.read`'s text), bin/settings.ts reads and writes it for the proxy, the server and the CLI.

export const CONFIG_VERSION = 1
export const CONFIG_FILE = 'config.json'
/** A config file larger than this is not read (a settings file is a few hundred bytes). */
export const MAX_CONFIG_BYTES = 64 * 1024

export const GROUPS = ['guard', 'tags', 'recall', 'expiry', 'tools', 'storage'] as const
export type Group = (typeof GROUPS)[number]

/** When a change takes effect: `now` (the next call reads config.json), `next session` (tools are registered at session start), `after restart`. */
export type Applies = 'now' | 'next session' | 'after restart'

/** The five tools Claude and outside agents are given. */
export const TOOL_NAMES = ['memory_remember', 'memory_recall', 'memory_update', 'memory_forget', 'memory_stats'] as const
export type ToolName = (typeof TOOL_NAMES)[number]

// Bounds, named once so the help texts, the checks and the specs read the same numbers.
export const GUARD_MAX_CEILING = 8000
export const NEVER_SAVE_MAX_ITEMS = 100
export const NEVER_SAVE_MIN_LENGTH = 3
export const NEVER_SAVE_MAX_LENGTH = 80

export interface Settings {
  guard: {
    warnLength: number
    maxLength: number
    minLength: number
    nearDuplicate: boolean
    nearDuplicateScore: number
    chatter: 'strict' | 'warn' | 'off'
    neverSave: string[]
  }
  tags: { maxPerMemory: number; autoAdmitCount: number }
  recall: {
    defaultLimit: number
    maxLimit: number
    firstPrompt: boolean
    firstPromptCount: number
    firstPromptSentences: number
    vectorWeight: number
    keywordWeight: number
    importanceWeight: number
  }
  expiry: { contextDays: number }
  tools: Record<ToolName, boolean> & { externalAllow: ToolName[] }
  storage: { activityLogMaxBytes: number; backupsKeep: number }
}

/** A problem with the config file or one of its keys. `key` is a dotted setting id, or `config.json` for the file itself. The reason never holds a value. */
export interface SettingsWarning {
  key: string
  reason: string
}

/** Settings plus what was wrong with the raw input; every reader uses this. */
export type ResolvedSettings = Settings & { warnings: SettingsWarning[] }

interface Common {
  /** `group.name`, the path inside config.json. */
  key: string
  /** The id in the plan's settings table (G2, T1, R5 ...). */
  ref: string
  group: Group
  label: string
  help: string
  applies: Applies
  /** Shown only under "Advanced". */
  advanced?: boolean
}
export type BooleanDef = Common & { type: 'boolean'; default: boolean }
export type NumberDef = Common & { type: 'integer' | 'number'; default: number; min: number; max: number }
export type ChoiceDef = Common & { type: 'choice'; default: string; choices: readonly string[] }
/** A list of plain words or phrases (matched as text, never as a pattern). */
export type WordsDef = Common & { type: 'words'; default: readonly string[]; maxItems: number; minItemLength: number; maxItemLength: number }
/** A list picked from fixed choices. */
export type PickDef = Common & { type: 'pick'; default: readonly string[]; choices: readonly string[] }
export type SettingDef = BooleanDef | NumberDef | ChoiceDef | WordsDef | PickDef

const toolDef = (name: ToolName, help: string): BooleanDef => ({
  key: `tools.${name}`,
  ref: 'M1',
  group: 'tools',
  label: `Tool ${name}`,
  help: `${help} Off means the tool is not registered at the next session start. Switching memory_remember off also stops the remember trigger and the rules block, so Claude is never told to call a missing tool.`,
  applies: 'next session',
  type: 'boolean',
  default: true,
})

export const SETTINGS: readonly SettingDef[] = [
  // ---- Guard (G2-G7) ----
  { key: 'guard.warnLength', ref: 'G2', group: 'guard', label: 'Warn length', applies: 'now', type: 'integer', default: 1500, min: 200, max: GUARD_MAX_CEILING - 1,
    help: 'Text longer than this many characters is saved with a warning to split it into one fact per call. Must stay below the max length.' },
  { key: 'guard.maxLength', ref: 'G3', group: 'guard', label: 'Max length', applies: 'now', type: 'integer', default: 4000, min: 201, max: GUARD_MAX_CEILING,
    help: `Text longer than this many characters is refused. Up to ${GUARD_MAX_CEILING}: the embedding model reads at most 8192 characters.` },
  { key: 'guard.minLength', ref: 'G4', group: 'guard', label: 'Min length', applies: 'now', type: 'integer', default: 15, min: 5, max: 100,
    help: 'Text shorter than this many characters is refused. Empty text is always refused, whatever this says.' },
  { key: 'guard.nearDuplicate', ref: 'G5', group: 'guard', label: 'Near-duplicate check', applies: 'now', type: 'boolean', default: true,
    help: 'Before a save, look for a stored memory that says almost the same thing. It needs the embeddings; with embeddings off it does nothing.' },
  { key: 'guard.nearDuplicateScore', ref: 'G5', group: 'guard', label: 'Near-duplicate threshold', applies: 'now', type: 'number', default: 0.88, min: 0.8, max: 0.99,
    help: 'How close two memories must be (0.80 to 0.99) to count as near-duplicates. Higher flags fewer.' },
  { key: 'guard.chatter', ref: 'G6', group: 'guard', label: 'Task-chatter check', applies: 'now', type: 'choice', default: 'warn', choices: ['strict', 'warn', 'off'],
    help: 'Dated progress notes ("released today") belong in a context note. warn: flag them, and the guard mode decides whether a flag needs a confirm. strict: always ask for a confirm. off: no check.' },
  { key: 'guard.neverSave', ref: 'G7', group: 'guard', label: 'Extra "never save" words', applies: 'now', type: 'words', default: [], maxItems: NEVER_SAVE_MAX_ITEMS, minItemLength: NEVER_SAVE_MIN_LENGTH, maxItemLength: NEVER_SAVE_MAX_LENGTH,
    help: `Words or phrases (${NEVER_SAVE_MIN_LENGTH} to ${NEVER_SAVE_MAX_LENGTH} characters, at most ${NEVER_SAVE_MAX_ITEMS}) that block a save, like a secret. Plain text, not patterns. This list can only add to the built-in secret rules.` },
  // ---- Tags (T1, T2) ----
  { key: 'tags.maxPerMemory', ref: 'T1', group: 'tags', label: 'Max tags per memory', applies: 'now', type: 'integer', default: 5, min: 1, max: 10,
    help: 'A memory keeps at most this many tags; extra tags are dropped.' },
  { key: 'tags.autoAdmitCount', ref: 'T2', group: 'tags', label: 'Auto-admit count', applies: 'now', type: 'integer', default: 3, min: 1, max: 10,
    help: 'A new tag proposed for this many memories is admitted to the vocabulary on its own.' },
  // ---- Recall (R2, R3, R5) ----
  { key: 'recall.defaultLimit', ref: 'R2', group: 'recall', label: 'Recall results', applies: 'now', type: 'integer', default: 5, min: 1, max: 20,
    help: 'How many memories memory_recall returns when the call gives no limit.' },
  { key: 'recall.maxLimit', ref: 'R2', group: 'recall', label: 'Recall results, most', applies: 'now', type: 'integer', default: 50, min: 20, max: 100,
    help: 'The most a single memory_recall may return, whatever limit the call asks for.' },
  { key: 'recall.firstPrompt', ref: 'R3', group: 'recall', label: 'Recall on the first prompt', applies: 'now', type: 'boolean', default: true,
    help: 'On the first prompt of a session, look up related memories on its own. Off means no automatic recall; the remember and recall terms still work.' },
  { key: 'recall.firstPromptCount', ref: 'R3', group: 'recall', label: 'First-prompt results', applies: 'now', type: 'integer', default: 5, min: 1, max: 10,
    help: 'How many memories the first-prompt recall adds to the context.' },
  { key: 'recall.firstPromptSentences', ref: 'R3', group: 'recall', label: 'First-prompt sentences', applies: 'now', type: 'integer', default: 4, min: 1, max: 6,
    help: 'How many sentences of the first prompt are looked up, one search each.' },
  { key: 'recall.vectorWeight', ref: 'R5', group: 'recall', label: 'Ranking: meaning', applies: 'now', type: 'number', default: 0.5, min: 0, max: 1, advanced: true,
    help: 'How much closeness in meaning counts in a recall ranking (0 to 1). The three weights are scaled to add up to 1; they cannot all be 0.' },
  { key: 'recall.keywordWeight', ref: 'R5', group: 'recall', label: 'Ranking: keywords', applies: 'now', type: 'number', default: 0.3, min: 0, max: 1, advanced: true,
    help: 'How much matching words count in a recall ranking (0 to 1).' },
  { key: 'recall.importanceWeight', ref: 'R5', group: 'recall', label: 'Ranking: importance', applies: 'now', type: 'number', default: 0.2, min: 0, max: 1, advanced: true,
    help: 'How much the importance saved with a memory counts in a recall ranking (0 to 1).' },
  // ---- Expiry (E1) ----
  { key: 'expiry.contextDays', ref: 'E1', group: 'expiry', label: 'Context-note days', applies: 'now', type: 'integer', default: 14, min: 1, max: 365,
    help: 'A context note (project state) stops being recalled this many days after it is saved, unless the save names another number. It is not deleted.' },
  // ---- Tools (M1, M2) ----
  toolDef('memory_remember', 'Saves a memory.'),
  toolDef('memory_recall', 'Looks memories up.'),
  toolDef('memory_update', 'Changes a saved memory.'),
  toolDef('memory_forget', 'Deletes a memory for good.'),
  toolDef('memory_stats', 'Shows counts of what is stored.'),
  { key: 'tools.externalAllow', ref: 'M2', group: 'tools', label: 'Tools for outside agents', applies: 'now', type: 'pick', default: [...TOOL_NAMES], choices: TOOL_NAMES,
    help: 'Which of the five tools the outside-agent MCP wrapper serves. Any other tool answers "Tool not available". Needs the externalMcp option on.' },
  // ---- Storage (S4, S5) ----
  { key: 'storage.activityLogMaxBytes', ref: 'S4', group: 'storage', label: 'Activity log size', applies: 'now', type: 'integer', default: 1024 * 1024, min: 256 * 1024, max: 16 * 1024 * 1024,
    help: 'The activity log rolls over to a single backup file when it passes this many bytes (256 KiB to 16 MiB).' },
  { key: 'storage.backupsKeep', ref: 'S5', group: 'storage', label: 'Backups to keep', applies: 'now', type: 'integer', default: 10, min: 3, max: 50,
    help: 'A backup keeps this many of the newest files and removes the older ones.' },
]

const BY_KEY: ReadonlyMap<string, SettingDef> = new Map(SETTINGS.map(setting => [setting.key, setting]))

/** Every setting id (`group.name`), in the order the settings list shows them. */
export const SETTING_KEYS: readonly string[] = SETTINGS.map(setting => setting.key)

/** The definition of a setting id, or undefined for an id that is not a setting. */
export const findSetting = (key: string): SettingDef | undefined => (typeof key === 'string' ? BY_KEY.get(key) : undefined)

// ---- small helpers ----

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const copyOf = <T,>(value: T): T => (Array.isArray(value) ? ([...value] as unknown as T) : value)
const CONTROL = /[\p{Cc}\u2028\u2029]/u

const splitKey = (key: string): [string, string] => {
  const at = key.indexOf('.')
  return [key.slice(0, at), key.slice(at + 1)]
}

/** The value stored at `key` in a raw config object, or `found: false`. Own keys only, so nothing reaches a prototype. */
function stored(root: Record<string, unknown>, key: string): { found: boolean; value?: unknown } {
  const [group, name] = splitKey(key)
  if (!Object.hasOwn(root, group)) return { found: false }
  const section = root[group]
  if (!isObject(section) || !Object.hasOwn(section, name)) return { found: false }
  return { found: true, value: section[name] }
}

/** What kind of value a setting holds, for the activity log (never the value). */
export type ValueKind = 'boolean' | 'number' | 'text' | 'list'
export const valueKind = (value: unknown): ValueKind => (typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : Array.isArray(value) ? 'list' : 'text')

// ---- checking one value ----

const codePointLength = (text: string) => Array.from(text).length

/** One word or phrase of a words list, trimmed; or a reason it cannot be used. Never echoes the text. */
function wordProblem(def: WordsDef, item: unknown): { value: string } | { reason: string } {
  const reason = `must be text of ${def.minItemLength} to ${def.maxItemLength} characters with no control characters`
  if (typeof item !== 'string') return { reason }
  const text = item.trim()
  const length = codePointLength(text)
  if (length < def.minItemLength || length > def.maxItemLength || CONTROL.test(text)) return { reason }
  return { value: text }
}

/** Trimmed, with a repeat (any letter case) dropped; the first spelling stays. */
function uniqueWords(items: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const folded = item.toLowerCase()
    if (seen.has(folded)) continue
    seen.add(folded)
    out.push(item)
  }
  return out
}

export type Checked = { ok: true; value: unknown } | { ok: false; reason: string }

/** Strict check of one value against its definition: the normalised value, or the reason it is refused. */
export function checkValue(def: SettingDef, value: unknown): Checked {
  switch (def.type) {
    case 'boolean':
      return typeof value === 'boolean' ? { ok: true, value } : { ok: false, reason: 'must be true or false' }
    case 'integer':
    case 'number': {
      const kindText = def.type === 'integer' ? 'a whole number' : 'a number'
      const fine = typeof value === 'number' && Number.isFinite(value) && (def.type === 'number' || Number.isInteger(value)) && value >= def.min && value <= def.max
      return fine ? { ok: true, value } : { ok: false, reason: `must be ${kindText} from ${def.min} to ${def.max}` }
    }
    case 'choice':
      return typeof value === 'string' && def.choices.includes(value) ? { ok: true, value } : { ok: false, reason: `must be one of ${def.choices.join(', ')}` }
    case 'words': {
      if (!Array.isArray(value)) return { ok: false, reason: `must be a list of at most ${def.maxItems} words or phrases` }
      if (value.length > def.maxItems) return { ok: false, reason: `must hold at most ${def.maxItems} entries` }
      const items: string[] = []
      for (let i = 0; i < value.length; i++) {
        const checked = wordProblem(def, value[i])
        if ('reason' in checked) return { ok: false, reason: `entry ${i + 1} ${checked.reason}` }
        items.push(checked.value)
      }
      return { ok: true, value: uniqueWords(items) }
    }
    case 'pick': {
      const fine = Array.isArray(value) && value.every(item => typeof item === 'string' && def.choices.includes(item))
      if (!fine) return { ok: false, reason: `must be a list of: ${def.choices.join(', ')}` }
      // Canonical order and no repeats, so two equal lists are the same bytes.
      const wanted = new Set(value as string[])
      return { ok: true, value: def.choices.filter(choice => wanted.has(choice)) }
    }
  }
}

/** Checks one setting id and value (a single key; rules between keys are checked by applyPatch). */
export function validate(key: string, value: unknown): { ok: true; key: string; value: unknown } | { ok: false; key: string; reason: string } {
  const def = findSetting(key)
  if (def === undefined) return { ok: false, key: typeof key === 'string' ? key.slice(0, 64) : '?', reason: 'not a setting' }
  const checked = checkValue(def, value)
  return checked.ok ? { ok: true, key, value: checked.value } : { ok: false, key, reason: checked.reason }
}

// ---- rules between keys ----

interface Relation {
  keys: readonly string[]
  holds: (settings: Settings) => boolean
  reason: string
}
const RELATIONS: readonly Relation[] = [
  { keys: ['guard.minLength', 'guard.warnLength', 'guard.maxLength'], holds: s => s.guard.minLength < s.guard.warnLength && s.guard.warnLength < s.guard.maxLength, reason: 'the min length must be below the warn length, and the warn length below the max length' },
  { keys: ['recall.defaultLimit', 'recall.maxLimit'], holds: s => s.recall.defaultLimit <= s.recall.maxLimit, reason: 'the default number of recall results cannot be above the most allowed' },
  { keys: ['recall.vectorWeight', 'recall.keywordWeight', 'recall.importanceWeight'], holds: s => s.recall.vectorWeight + s.recall.keywordWeight + s.recall.importanceWeight > 0, reason: 'the three ranking weights cannot all be 0' },
]

// ---- defaults and resolve ----

function set(tree: Record<string, Record<string, unknown>>, key: string, value: unknown) {
  const [group, name] = splitKey(key)
  ;(tree[group] ??= {})[name] = value
}

/** A fresh Settings with every default (arrays are copies, so a caller can change them). */
export function defaults(): Settings {
  const tree: Record<string, Record<string, unknown>> = {}
  for (const def of SETTINGS) set(tree, def.key, copyOf(def.default))
  return tree as unknown as Settings
}

/** The value of a setting id in a Settings object. */
export function settingValue(settings: Settings, key: string): unknown {
  const [group, name] = splitKey(key)
  return (settings as unknown as Record<string, Record<string, unknown>>)[group]?.[name]
}

/**
 * Turns raw JSON (anything: the parsed config file, a request body) into Settings. Never throws.
 * A key it does not know is ignored; a value of the wrong type or outside its range gives the
 * default and a warning naming the key. A words list keeps its good entries and drops the bad
 * ones, so one typo never switches the other words off (the list can only add protection).
 * Rules between keys (min < warn < max, default <= most, weights not all 0) revert the keys that
 * were set and break the rule.
 */
export function resolve(raw: unknown): ResolvedSettings {
  const warnings: SettingsWarning[] = []
  const warn = (key: string, reason: string) => warnings.push({ key, reason })
  let root: Record<string, unknown> = {}
  if (isObject(raw)) {
    root = raw
    if (Object.hasOwn(raw, 'version') && raw.version !== CONFIG_VERSION) warn(CONFIG_FILE, `version is not ${CONFIG_VERSION}; the settings it holds are read as they are`)
  } else if (raw !== undefined) {
    warn(CONFIG_FILE, 'is not a JSON object; every setting is at its default')
  }
  const settings = defaults()
  const tree = settings as unknown as Record<string, Record<string, unknown>>
  const present = new Set<string>()
  for (const def of SETTINGS) {
    const found = stored(root, def.key)
    if (!found.found) continue
    let value = found.value
    if (def.type === 'words' && Array.isArray(value)) {
      const good: string[] = []
      let dropped = 0
      for (const item of value) {
        const checked = wordProblem(def, item)
        if ('value' in checked && good.length < def.maxItems) good.push(checked.value)
        else dropped++
      }
      if (dropped > 0) warn(def.key, `${dropped} ${dropped === 1 ? 'entry was' : 'entries were'} ignored (each must be text of ${def.minItemLength} to ${def.maxItemLength} characters, at most ${def.maxItems} in all)`)
      value = good
    }
    const checked = checkValue(def, value)
    if (!checked.ok) {
      warn(def.key, `${checked.reason}; the default is used`)
      continue
    }
    set(tree, def.key, checked.value)
    present.add(def.key)
  }
  for (const relation of RELATIONS) {
    if (relation.holds(settings)) continue
    for (const key of relation.keys) {
      if (!present.has(key)) continue
      set(tree, key, copyOf(BY_KEY.get(key)!.default))
      warn(key, `${relation.reason}; the default is used`)
    }
  }
  return Object.assign(settings, { warnings })
}

/**
 * The settings in a config file's text. `text` is undefined when there is no file; `unreadable`
 * says the file exists but could not be read. Both, a file that is not JSON and one over
 * MAX_CONFIG_BYTES give all defaults plus one warning about `config.json`; nothing throws.
 */
export function parseConfig(text: string | undefined, unreadable = false): ResolvedSettings {
  const fileProblem = (reason: string): ResolvedSettings => {
    const settings = resolve(undefined)
    settings.warnings.unshift({ key: CONFIG_FILE, reason })
    return settings
  }
  if (unreadable) return fileProblem('could not be read; every setting is at its default')
  if (text === undefined) return fileProblem('does not exist yet; every setting is at its default')
  if (text.length > MAX_CONFIG_BYTES) return fileProblem(`is over ${MAX_CONFIG_BYTES} bytes; every setting is at its default`)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fileProblem('is not valid JSON; every setting is at its default')
  }
  return resolve(raw)
}

// ---- changing the file's content (pure; bin/settings.ts does the file work) ----

/** One setting's change, as the activity log records it: the key and the kind of value before and after, never the value. `default` is "not stored". */
export interface SettingChange {
  key: string
  old: ValueKind | 'default' | 'various'
  new: ValueKind | 'default' | 'various'
}

export type PatchResult = { ok: true; config: Record<string, unknown>; changes: SettingChange[] } | { ok: false; key: string; reason: string }

/** A config with nothing set: what "reset all" writes. */
export const emptyConfig = (): Record<string, unknown> => ({ version: CONFIG_VERSION })

/** The config's keys in a fixed order (version, the groups in GROUPS order, each key in schema order, then anything unknown), so equal configs are equal bytes. */
function canonical(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { version: CONFIG_VERSION }
  for (const group of GROUPS) {
    const section = config[group]
    if (!isObject(section)) continue
    const known = SETTINGS.filter(def => def.group === group).map(def => splitKey(def.key)[1])
    const sorted: Record<string, unknown> = {}
    for (const name of known) if (Object.hasOwn(section, name)) sorted[name] = section[name]
    for (const name of Object.keys(section)) if (!known.includes(name)) sorted[name] = section[name]
    if (Object.keys(sorted).length > 0) out[group] = sorted
  }
  for (const key of Object.keys(config)) if (key !== 'version' && !(GROUPS as readonly string[]).includes(key)) out[key] = config[key]
  return out
}

/** The file's text for a config object: two-space JSON in canonical order, one trailing newline. */
export const configText = (config: Record<string, unknown>) => `${JSON.stringify(canonical(config), null, 2)}\n`

const kindStored = (settings: Settings, def: SettingDef): SettingChange['old'] => {
  const value = settingValue(settings, def.key)
  return sameJson(value, def.default) ? 'default' : valueKind(value)
}

/**
 * Applies a change to a raw config object without touching the original. `patch` maps setting ids to
 * new values; `null` resets the id. The values are checked first (the key and the reason come back
 * on a refusal, nothing is applied), a value equal to its default is not stored, and a group left
 * empty is removed. Keys this version does not know are kept as they are. The result must still
 * satisfy the rules between keys, or the patch is refused naming the key.
 */
export function applyPatch(raw: unknown, patch: Record<string, unknown>): PatchResult {
  const config: Record<string, unknown> = isObject(raw) ? JSON.parse(JSON.stringify(raw)) : {}
  const before = resolve(config)
  const touched: SettingDef[] = []
  for (const key of Object.keys(patch)) {
    const def = findSetting(key)
    if (def === undefined) return { ok: false, key: key.slice(0, 64), reason: 'not a setting' }
    const value = patch[key]
    let keep: unknown
    if (value !== null) {
      const checked = checkValue(def, value)
      if (!checked.ok) return { ok: false, key, reason: checked.reason }
      keep = checked.value
    }
    const [group, name] = splitKey(key)
    let section = config[group]
    if (!isObject(section)) {
      if (value === null || sameJson(keep, def.default)) {
        delete config[group]
        touched.push(def)
        continue
      }
      section = {}
      config[group] = section
    }
    if (value === null || sameJson(keep, def.default)) delete (section as Record<string, unknown>)[name]
    else (section as Record<string, unknown>)[name] = keep
    if (Object.keys(section as Record<string, unknown>).length === 0) delete config[group]
    touched.push(def)
  }
  config.version = CONFIG_VERSION
  // A rule between keys that the patch breaks refuses the patch; one broken by something already in the file does not.
  const after = resolve(config)
  const related = new Set(touched.map(def => def.key))
  for (const relation of RELATIONS) if (relation.keys.some(key => related.has(key))) for (const key of relation.keys) related.add(key)
  const problem = after.warnings.find(warning => related.has(warning.key))
  if (problem !== undefined) return { ok: false, key: problem.key, reason: problem.reason.replace(/; the default is used$/, '') }
  const changes: SettingChange[] = []
  for (const def of touched) {
    if (sameJson(settingValue(before, def.key), settingValue(after, def.key))) continue
    changes.push({ key: def.key, old: kindStored(before, def), new: kindStored(after, def) })
  }
  return { ok: true, config: canonical(config), changes }
}
