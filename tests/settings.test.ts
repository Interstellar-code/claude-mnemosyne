// CFG.1 and CFG.2 (0.8.5 settings plan): the schema and resolver in hooks/settings.ts, its pure patch
// logic and the `settings` activity action. The file reader and writer (bin/settings.ts) are in tests/bun/settings.spec.ts.
import { expect, test } from 'claude-code/testing'
import { activityEntry, activityLine, settingsFields } from '../hooks/activity-log'
import { MAX_LENGTH, MIN_LENGTH, NEAR_DUPLICATE_SCORE, WARN_LENGTH } from '../hooks/guard'
import { CONTEXT_EXPIRY_DAYS } from '../hooks/kinds'
import {
  applyPatch, checkValue, CONFIG_FILE, configText, defaults, emptyConfig, findSetting, GROUPS, GUARD_MAX_CEILING, MAX_CONFIG_BYTES, NEVER_SAVE_MAX_ITEMS,
  parseConfig, resolve, SETTING_KEYS, SETTINGS, settingValue, TOOL_NAMES, validate,
} from '../hooks/settings'
import { MAX_TAGS } from '../hooks/tags'
import { AUTO_ADMIT_COUNT } from '../hooks/vocab'

const keysOf = (warnings: readonly { key: string }[]) => warnings.map(warning => warning.key)

test('CFG.1.a1: every default equals the number that was hard-coded before (C3)', () => {
  const d = defaults()
  // imported from the code that still holds them
  expect(d.guard.minLength).toBe(MIN_LENGTH)
  expect(d.guard.warnLength).toBe(WARN_LENGTH)
  expect(d.guard.maxLength).toBe(MAX_LENGTH)
  expect(d.guard.nearDuplicateScore).toBe(NEAR_DUPLICATE_SCORE)
  expect(d.tags.maxPerMemory).toBe(MAX_TAGS)
  expect(d.tags.autoAdmitCount).toBe(AUTO_ADMIT_COUNT)
  expect(d.expiry.contextDays).toBe(CONTEXT_EXPIRY_DAYS)
  // literals for the ones that are not exported (hooks/register.ts, bin/*.ts): RECALL_LIMIT 5, limit clamp 1 to 50,
  // sentences(...).slice(0, 4), the engine's 0.5/0.3/0.2 weights, the on-by-default switches
  expect(d.recall).toEqual({ defaultLimit: 5, maxLimit: 50, firstPrompt: true, firstPromptCount: 5, firstPromptSentences: 4, vectorWeight: 0.5, keywordWeight: 0.3, importanceWeight: 0.2 })
  expect(d.guard.nearDuplicate).toBe(true)
  expect(d.guard.chatter).toBe('warn')
  expect(d.guard.neverSave).toEqual([])
  expect(d.storage).toEqual({ activityLogMaxBytes: 1024 * 1024, backupsKeep: 10 })
  for (const tool of TOOL_NAMES) expect(d.tools[tool]).toBe(true)
  expect(d.tools.externalAllow).toEqual([...TOOL_NAMES])
})

test('CFG.1.a1: the schema holds every setting of the plan, each once, with a default that passes its own check', () => {
  expect(new Set(SETTING_KEYS).size).toBe(SETTING_KEYS.length)
  const refs = new Set(SETTINGS.map(setting => setting.ref))
  for (const ref of ['G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'T1', 'T2', 'R2', 'R3', 'R5', 'E1', 'S4', 'S5', 'M1', 'M2']) expect(refs.has(ref)).toBe(true)
  for (const setting of SETTINGS) {
    expect((GROUPS as readonly string[]).includes(setting.group)).toBe(true)
    expect(setting.key.startsWith(`${setting.group}.`)).toBe(true)
    expect(setting.label.length).toBeGreaterThan(0)
    expect(setting.help.length).toBeGreaterThan(0)
    expect(checkValue(setting, setting.default)).toEqual({ ok: true, value: setting.default })
    if (setting.type === 'integer' || setting.type === 'number') {
      expect(setting.min).toBeLessThanOrEqual(setting.default)
      expect(setting.default).toBeLessThanOrEqual(setting.max)
    }
  }
  // the help text quotes the numbers the checks use
  expect(findSetting('guard.maxLength')!.help).toContain(String(GUARD_MAX_CEILING))
  expect(findSetting('guard.neverSave')!.help).toContain(String(NEVER_SAVE_MAX_ITEMS))
  // a tool switch is applied at the next session start; the file's other settings are read per call
  for (const tool of TOOL_NAMES) expect(findSetting(`tools.${tool}`)!.applies).toBe('next session')
  expect(findSetting('guard.maxLength')!.applies).toBe('now')
})

test('CFG.1.a2: resolve({}) returns every default with no warning; a call gets its own copy', () => {
  const first = resolve({})
  expect(first.warnings).toEqual([])
  const { warnings: _w, ...values } = first
  expect(values).toEqual(defaults())
  expect(resolve(undefined).warnings).toEqual([])
  first.guard.neverSave.push('changed here')
  first.tools.externalAllow.length = 0
  expect(resolve({}).guard.neverSave).toEqual([])
  expect(resolve({}).tools.externalAllow).toEqual([...TOOL_NAMES])
})

test('CFG.1.a2: stored values are read; an unknown key, group or version-less file is ignored with no warning', () => {
  const r = resolve({ version: 1, guard: { maxLength: 6000, mystery: 3 }, tags: { maxPerMemory: 4 }, nonsense: { a: 1 }, extra: true })
  expect(r.guard.maxLength).toBe(6000)
  expect(r.tags.maxPerMemory).toBe(4)
  expect(r.warnings).toEqual([])
  expect(resolve({ guard: { maxLength: 6000 } }).guard.maxLength).toBe(6000)
})

test('CFG.1.a2: a wrong-typed or out-of-range value gives its default and a warning naming the key', () => {
  const bad: Record<string, unknown> = {
    'guard.warnLength': 100, // under 200
    'guard.maxLength': 8001,
    'guard.minLength': 4,
    'guard.nearDuplicate': 'yes',
    'guard.nearDuplicateScore': 0.5,
    'guard.chatter': 'loud',
    'guard.neverSave': 'not a list',
    'tags.maxPerMemory': 11,
    'tags.autoAdmitCount': 0,
    'recall.defaultLimit': 21,
    'recall.maxLimit': 101,
    'recall.firstPrompt': 1,
    'recall.firstPromptCount': 2.5,
    'recall.firstPromptSentences': 7,
    'recall.vectorWeight': 1.5,
    'recall.keywordWeight': -0.1,
    'recall.importanceWeight': Number.NaN,
    'expiry.contextDays': 366,
    'tools.memory_remember': 'on',
    'tools.externalAllow': ['memory_remember', 'engine_shell'],
    'storage.activityLogMaxBytes': 100,
    'storage.backupsKeep': 2,
  }
  for (const [key, value] of Object.entries(bad)) {
    const [group, name] = key.split('.') as [string, string]
    const r = resolve({ [group]: { [name]: value } })
    expect(keysOf(r.warnings)).toEqual([key])
    expect(settingValue(r, key)).toEqual(findSetting(key)!.default)
  }
  // one bad value does not spoil its neighbours
  const mixed = resolve({ guard: { maxLength: 'big', minLength: 20 } })
  expect(mixed.guard.maxLength).toBe(MAX_LENGTH)
  expect(mixed.guard.minLength).toBe(20)
  expect(keysOf(mixed.warnings)).toEqual(['guard.maxLength'])
  // a warning never carries the value
  const text = JSON.stringify(resolve({ guard: { warnLength: 'SECRET-LOOKING-VALUE-123' } }).warnings)
  expect(text).not.toContain('SECRET-LOOKING')
})

test('CFG.1.a2: input that is not an object, and a version this code does not know, give defaults and a config.json warning', () => {
  for (const raw of [[], 'text', 5, null, true]) {
    const r = resolve(raw)
    expect(keysOf(r.warnings)).toEqual([CONFIG_FILE])
    expect(settingValue(r, 'guard.maxLength')).toBe(MAX_LENGTH)
  }
  const odd = resolve({ version: 2, guard: { maxLength: 5000 } })
  expect(keysOf(odd.warnings)).toEqual([CONFIG_FILE])
  expect(odd.guard.maxLength).toBe(5000)
})

test('CFG.1.a2: __proto__ and constructor keys in the input reach nothing', () => {
  const raw = JSON.parse('{"__proto__":{"polluted":true},"guard":{"__proto__":{"maxLength":1},"constructor":{"x":1}},"constructor":{"prototype":{"polluted":true}}}')
  const r = resolve(raw)
  expect(r.guard.maxLength).toBe(MAX_LENGTH)
  expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  expect(applyPatch(raw, { 'guard.__proto__': 1 }).ok).toBe(false)
  expect(applyPatch(raw, { constructor: 1 }).ok).toBe(false)
})

test('CFG.1.a3: min < warn < max and max <= 8000 hold; a broken pair gives back the defaults of the keys that were set', () => {
  expect(resolve({ guard: { warnLength: 3000, maxLength: 3000 } }).guard).toMatchObject({ warnLength: WARN_LENGTH, maxLength: MAX_LENGTH })
  expect(resolve({ guard: { warnLength: 3000, maxLength: 2000 } }).warnings.map(w => w.key).sort()).toEqual(['guard.maxLength', 'guard.warnLength'])
  // only max set, under the default warn: max goes back, warn is untouched
  const lowMax = resolve({ guard: { maxLength: 1000 } })
  expect(lowMax.guard).toMatchObject({ warnLength: 1500, maxLength: 4000 })
  expect(keysOf(lowMax.warnings)).toEqual(['guard.maxLength'])
  // min must stay under warn
  expect(keysOf(resolve({ guard: { minLength: 100, warnLength: 200 } }).warnings)).toEqual([])
  expect(keysOf(resolve({ guard: { warnLength: 200 }, tags: {} }).warnings)).toEqual([])
  expect(resolve({ guard: { maxLength: 8000, warnLength: 7999, minLength: 100 } }).guard).toMatchObject({ maxLength: 8000, warnLength: 7999, minLength: 100 })
  expect(resolve({ guard: { maxLength: 8001 } }).guard.maxLength).toBe(MAX_LENGTH)
  // the recall count cannot be above its most
  const recall = resolve({ recall: { defaultLimit: 20, maxLimit: 20 } })
  expect(recall.warnings).toEqual([])
  expect(resolve({ recall: { maxLimit: 20, defaultLimit: 20 } }).recall).toMatchObject({ defaultLimit: 20, maxLimit: 20 })
})

test('CFG.1.a3: each weight is 0 to 1 and they cannot all be 0', () => {
  expect(resolve({ recall: { vectorWeight: 0, keywordWeight: 1, importanceWeight: 0 } }).warnings).toEqual([])
  expect(keysOf(resolve({ recall: { vectorWeight: 1.01 } }).warnings)).toEqual(['recall.vectorWeight'])
  const zero = resolve({ recall: { vectorWeight: 0, keywordWeight: 0, importanceWeight: 0 } })
  expect(zero.warnings.map(w => w.key).sort()).toEqual(['recall.importanceWeight', 'recall.keywordWeight', 'recall.vectorWeight'])
  expect([zero.recall.vectorWeight, zero.recall.keywordWeight, zero.recall.importanceWeight]).toEqual([0.5, 0.3, 0.2])
})

test('CFG.1.a4: the never-save words are plain text, at most 100, each 3 to 80 characters', () => {
  const ok = resolve({ guard: { neverSave: ['staging db host', '  C++ internal ', 'STAGING DB HOST'] } })
  expect(ok.warnings).toEqual([])
  // trimmed, and a repeat in any letter case is dropped
  expect(ok.guard.neverSave).toEqual(['staging db host', 'C++ internal'])
  expect(checkValue(findSetting('guard.neverSave')!, ['a.*b+'])).toEqual({ ok: true, value: ['a.*b+'] }) // stored as text; matching treats it as text (WIRE.1)
  const strict = (list: unknown) => checkValue(findSetting('guard.neverSave')!, list)
  expect(strict(['ab']).ok).toBe(false)
  expect(strict(['x'.repeat(81)]).ok).toBe(false)
  expect(strict(['x'.repeat(80)]).ok).toBe(true)
  expect(strict(['line\nbreak here']).ok).toBe(false)
  expect(strict(['tab\there']).ok).toBe(false)
  expect(strict([5]).ok).toBe(false)
  expect(strict(Array.from({ length: 101 }, (_, i) => `word number ${i}`)).ok).toBe(false)
  expect(strict(Array.from({ length: 100 }, (_, i) => `word number ${i}`)).ok).toBe(true)
  // a refusal names the entry's place, never its text
  const refused = strict(['fine words', 'no']) as { ok: false; reason: string }
  expect(refused.reason).toContain('entry 2')
  expect(refused.reason).not.toContain('fine words')
  // reading is forgiving: the bad entries go, the good ones stay, one warning names the key
  const mixed = resolve({ guard: { neverSave: ['good phrase', 'no', 7, 'x'.repeat(200), 'another phrase'] } })
  expect(mixed.guard.neverSave).toEqual(['good phrase', 'another phrase'])
  expect(keysOf(mixed.warnings)).toEqual(['guard.neverSave'])
  expect(JSON.stringify(mixed.warnings)).not.toContain('good phrase')
  const many = resolve({ guard: { neverSave: Array.from({ length: 130 }, (_, i) => `word number ${i}`) } })
  expect(many.guard.neverSave).toHaveLength(100)
  expect(keysOf(many.warnings)).toEqual(['guard.neverSave'])
})

test('CFG.1.a5: no setting can name, remove or weaken a built-in secret rule (C4)', () => {
  const words = SETTINGS.filter(setting => setting.type === 'words').map(setting => setting.key)
  expect(words).toEqual(['guard.neverSave']) // the one list that touches the guard, and it only adds
  for (const key of SETTING_KEYS) {
    expect(/secret|credential|password|token|pattern|regex|builtin|built-in|override|allow-?secret|empty|g1/i.test(key)).toBe(false)
  }
  // the guard group holds exactly these keys: a size, a duplicate, a chatter and a words setting; nothing about the secret rules
  expect(SETTING_KEYS.filter(key => key.startsWith('guard.'))).toEqual([
    'guard.warnLength', 'guard.maxLength', 'guard.minLength', 'guard.nearDuplicate', 'guard.nearDuplicateScore', 'guard.chatter', 'guard.neverSave',
  ])
  // the least a text may hold is 5 characters, so empty text can never be allowed, and the chatter choices have no "allow a secret"
  expect(findSetting('guard.minLength')).toMatchObject({ min: 5 })
  expect(findSetting('guard.chatter')).toMatchObject({ choices: ['strict', 'warn', 'off'] })
  // an attempt to set such a key is refused as "not a setting"
  for (const key of ['guard.secrets', 'guard.secretRules', 'guard.allowSecrets', 'guard.builtinRules', 'guard.extraPatterns', 'guard.allowEmpty']) {
    expect(validate(key, false)).toEqual({ ok: false, key, reason: 'not a setting' })
    expect(applyPatch({}, { [key]: false }).ok).toBe(false)
  }
})

test('CFG.1: the tool list for outside agents is a set of the five tools, kept in the tools order', () => {
  const def = findSetting('tools.externalAllow')!
  expect(checkValue(def, ['memory_stats', 'memory_recall', 'memory_recall'])).toEqual({ ok: true, value: ['memory_recall', 'memory_stats'] })
  expect(checkValue(def, [])).toEqual({ ok: true, value: [] })
  expect(checkValue(def, ['mnemopi_export']).ok).toBe(false)
  expect(checkValue(def, 'memory_recall').ok).toBe(false)
  expect(resolve({ tools: { externalAllow: ['memory_stats', 'memory_recall'] } }).tools.externalAllow).toEqual(['memory_recall', 'memory_stats'])
})

test('CFG.1: parseConfig reads the file text and never throws: missing, unreadable, broken, oversize and non-object all give defaults and one config.json warning', () => {
  const clean = parseConfig('{"version":1,"expiry":{"contextDays":30}}')
  expect(clean.expiry.contextDays).toBe(30)
  expect(clean.warnings).toEqual([])
  for (const [text, unreadable] of [[undefined, false], ['{ not json', false], ['', false], ['[1,2]', false], ['x'.repeat(MAX_CONFIG_BYTES + 1), false], ['{"version":1}', true]] as const) {
    const r = parseConfig(text, unreadable)
    expect(r.warnings.filter(w => w.key === CONFIG_FILE)).toHaveLength(1)
    expect(r.guard.maxLength).toBe(MAX_LENGTH)
    expect(r.expiry.contextDays).toBe(CONTEXT_EXPIRY_DAYS)
  }
})

// ---- CFG.2: the pure patch logic ----

test('CFG.2.a1: a patch is checked first; a refusal names the key and the reason and applies nothing', () => {
  const start = { version: 1, guard: { maxLength: 5000 } }
  const copy = JSON.stringify(start)
  const refused = applyPatch(start, { 'tags.maxPerMemory': 4, 'guard.minLength': 3 })
  expect(refused).toEqual({ ok: false, key: 'guard.minLength', reason: 'must be a whole number from 5 to 100' })
  expect(JSON.stringify(start)).toBe(copy) // the input is never changed
  expect(applyPatch(start, { 'nope.key': 1 })).toEqual({ ok: false, key: 'nope.key', reason: 'not a setting' })
  expect(applyPatch(start, { 'guard.neverSave': ['ok phrase', 'x'] })).toMatchObject({ ok: false, key: 'guard.neverSave' })
  // a rule between keys: raising warn over the file's max is refused naming the key
  const cross = applyPatch(start, { 'guard.warnLength': 6000 })
  expect(cross).toMatchObject({ ok: false, key: 'guard.warnLength' })
  expect(applyPatch(start, { 'guard.warnLength': 4999 }).ok).toBe(true)
  expect(applyPatch({}, { 'guard.maxLength': 1000 })).toMatchObject({ ok: false, key: 'guard.maxLength' })
  expect(applyPatch({}, { 'recall.vectorWeight': 0 }).ok).toBe(true)
  expect(applyPatch({ recall: { keywordWeight: 0, importanceWeight: 0 } }, { 'recall.vectorWeight': 0 })).toMatchObject({ ok: false })
  const bad = applyPatch({}, { 'guard.neverSave': ['sneaky word', 'x'] }) as { ok: false; key: string; reason: string }
  expect(JSON.stringify(bad)).not.toContain('sneaky')
})

test('CFG.2.a2: only values that differ from the default are stored; resetting a key deletes it; an emptied group goes', () => {
  const set = applyPatch({}, { 'guard.maxLength': 5000, 'tags.maxPerMemory': 5, 'guard.chatter': 'off' })
  if (!set.ok) throw new Error('refused')
  // 5 is the default: not stored
  expect(set.config).toEqual({ version: 1, guard: { maxLength: 5000, chatter: 'off' } })
  expect(set.changes).toEqual([
    { key: 'guard.maxLength', old: 'default', new: 'number' },
    { key: 'guard.chatter', old: 'default', new: 'text' },
  ])
  // setting a stored key back to its default removes it
  const back = applyPatch(set.config, { 'guard.maxLength': 4000 })
  if (!back.ok) throw new Error('refused')
  expect(back.config).toEqual({ version: 1, guard: { chatter: 'off' } })
  // reset (null) removes it, the group goes when it is empty
  const reset = applyPatch(back.config, { 'guard.chatter': null })
  if (!reset.ok) throw new Error('refused')
  expect(reset.config).toEqual({ version: 1 })
  expect(reset.changes).toEqual([{ key: 'guard.chatter', old: 'text', new: 'default' }])
  // resetting what is not stored changes nothing
  const nothing = applyPatch({ version: 1 }, { 'guard.chatter': null, 'tags.maxPerMemory': null })
  expect(nothing).toEqual({ ok: true, config: { version: 1 }, changes: [] })
  // a list is a list change; the words are stored trimmed
  const list = applyPatch({}, { 'guard.neverSave': ['  staging db host '] })
  expect(list).toMatchObject({ ok: true, config: { version: 1, guard: { neverSave: ['staging db host'] } }, changes: [{ key: 'guard.neverSave', old: 'default', new: 'list' }] })
  // the default list is empty, so an empty list is the default and is not stored
  expect(applyPatch(list.ok ? list.config : {}, { 'guard.neverSave': [] })).toMatchObject({ ok: true, config: { version: 1 } })
  // reset-all is `{ "version": 1 }`
  expect(emptyConfig()).toEqual({ version: 1 })
})

test('CFG.2.a2: keys this version does not know are kept, a damaged group is replaced, and a bad stored value can be reset', () => {
  const kept = applyPatch({ version: 1, future: { x: 1 }, guard: { later: true, maxLength: 5000 } }, { 'guard.maxLength': 6000 })
  expect(kept).toMatchObject({ ok: true, config: { version: 1, future: { x: 1 }, guard: { maxLength: 6000, later: true } } })
  const replaced = applyPatch({ guard: 'nonsense' }, { 'guard.minLength': 20 })
  expect(replaced).toMatchObject({ ok: true, config: { version: 1, guard: { minLength: 20 } } })
  const fixed = applyPatch({ guard: { maxLength: 99999 } }, { 'guard.maxLength': null })
  expect(fixed).toMatchObject({ ok: true, config: { version: 1 } })
  // a stored value that is already wrong does not stop a patch of another key
  expect(applyPatch({ guard: { maxLength: 99999 } }, { 'tags.maxPerMemory': 4 }).ok).toBe(true)
})

test('CFG.2.a2: configText is the same bytes for the same config, in a fixed key order, with one trailing newline', () => {
  const a = applyPatch({}, { 'expiry.contextDays': 30, 'guard.chatter': 'off', 'guard.maxLength': 5000 })
  const b = applyPatch({}, { 'guard.maxLength': 5000, 'guard.chatter': 'off', 'expiry.contextDays': 30 })
  if (!a.ok || !b.ok) throw new Error('refused')
  expect(configText(a.config)).toBe(configText(b.config))
  expect(configText(a.config)).toBe('{\n  "version": 1,\n  "guard": {\n    "maxLength": 5000,\n    "chatter": "off"\n  },\n  "expiry": {\n    "contextDays": 30\n  }\n}\n')
  expect(configText(emptyConfig())).toBe('{\n  "version": 1\n}\n')
  // what is written reads back to the same settings
  expect(parseConfig(configText(a.config)).guard).toMatchObject({ maxLength: 5000, chatter: 'off' })
})

// ---- the `settings` activity action ----

test('CFG.2.a5: a settings change is logged by key and kind of value, never by value', () => {
  const fields = settingsFields([{ key: 'guard.neverSave', old: 'default', new: 'list' }, { key: 'guard.maxLength', old: 'number', new: 'default' }], { origin: 'ui', t: '2026-10-26T00:00:00.000Z' })
  expect(fields).toMatchObject({ action: 'settings', origin: 'ui', owner: 'global', count: 2, ok: true, text: 'guard.neverSave default>list · guard.maxLength number>default' })
  const entry = JSON.parse(activityLine(fields)) as Record<string, unknown>
  expect(entry).toMatchObject({ action: 'settings', origin: 'ui', owner: 'global', ids: [], count: 2, ok: true, text: 'guard.neverSave default>list · guard.maxLength number>default' })
  // a key or kind that is not one of ours (a list item, a value) is shown as ?
  const odd = settingsFields([{ key: 'staging db host', old: 'secret-value-12345', new: 'list' }], { origin: 'ui' })
  expect(odd.text).toBe('? ?>list')
  expect(settingsFields([{ key: 'all', old: 'various', new: 'default' }], { origin: 'ui' }).text).toBe('all various>default')
  // a failed change carries its error text through the usual redaction
  expect(activityEntry(settingsFields([{ key: 'guard.chatter', old: 'default', new: 'text' }], { origin: 'ui', ok: false, error: 'refused' }))).toMatchObject({ ok: false, error: 'refused' })
  // every real key and every change kind the patch logic produces survives as written
  for (const key of SETTING_KEYS) expect(settingsFields([{ key, old: 'default', new: 'number' }], { origin: 'ui' }).text).toBe(`${key} default>number`)
})
