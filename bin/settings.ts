// Claude Mnemosyne — the settings file's reader and its one writer (0.8.5 settings plan, C1 and C5).
//   bun bin/settings.ts get [<key>] --root <dir>
//   bun bin/settings.ts set <key> <value> --root <dir>      value is JSON (4, true, 0.9, ["two words"]); other text is taken as a string
//   bun bin/settings.ts reset <key> --root <dir>
//   bun bin/settings.ts reset-all --root <dir>
//
// <root> is the data folder (the one that holds store/, backups/ and vocabulary.json); there is no default,
// so a script can never reach the real folder by leaving the flag out. The file is <root>/config.json,
// mode 0600. A write checks first (hooks/settings.ts) and refuses a bad value with its key and reason,
// writing nothing. A good write goes to a temp file next to the file and is moved over it, so a crash
// leaves the old file or the new one, never half of either; the file it replaces is kept as config.json.bak
// (also by rename). Only values that differ from their default are stored. A reader never throws: a missing,
// unreadable or broken file reads as all defaults plus one warning (hooks/settings.ts parseConfig).
// A list item's text is never printed in an error, and nothing is logged here.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { applyPatch, CONFIG_FILE, configText, emptyConfig, findSetting, parseConfig, resolve as resolveSettings, SETTING_KEYS, settingValue, MAX_CONFIG_BYTES } from '../hooks/settings'
import type { PatchResult, ResolvedSettings, SettingChange } from '../hooks/settings'

const IS_WINDOWS = process.platform === 'win32'

export const configFile = (root: string) => join(root, CONFIG_FILE)
export const backupFile = (root: string) => `${configFile(root)}.bak`

/** The file's text: undefined when there is none; `unreadable` when it exists but cannot be read. */
function readText(root: string): { text?: string; unreadable?: boolean } {
  const file = configFile(root)
  try {
    if (!existsSync(file)) return {}
    if (statSync(file).size > MAX_CONFIG_BYTES) return { unreadable: true }
    return { text: readFileSync(file, 'utf8') }
  } catch {
    return { unreadable: true }
  }
}

/** The settings in <root>/config.json, resolved. Read per call. Never throws; a missing or broken file is all defaults plus a `config.json` warning. */
export function readConfig(root: string): ResolvedSettings {
  const { text, unreadable } = readText(root)
  return parseConfig(text, unreadable === true)
}

/** The file's parsed JSON as written (for a patch to build on); `broken` when there is a file that is not JSON, and then the base is {}. */
function readRaw(root: string): { raw: unknown; broken: boolean } {
  const { text, unreadable } = readText(root)
  if (unreadable === true) return { raw: {}, broken: true }
  if (text === undefined) return { raw: {}, broken: false }
  try {
    return { raw: JSON.parse(text), broken: false }
  } catch {
    return { raw: {}, broken: true }
  }
}

function secureRoot(root: string) {
  if (existsSync(root)) return
  mkdirSync(root, { recursive: true, mode: 0o700 })
  if (!IS_WINDOWS) chmodSync(root, 0o700)
}

/** Writes `text` to `file` 0600 by rename: a new file next to it, then moved over the old one. */
function replaceFile(file: string, text: string) {
  const temp = `${file}.${process.pid}.tmp`
  rmSync(temp, { force: true })
  try {
    writeFileSync(temp, text, { mode: 0o600, flag: 'wx' })
    if (!IS_WINDOWS) chmodSync(temp, 0o600)
    renameSync(temp, file)
  } catch (err) {
    rmSync(temp, { force: true })
    throw err
  }
}

/** Keeps the file that is about to be replaced as config.json.bak (copied to a temp file, then moved, so the backup is whole too). */
function keepBackup(root: string) {
  const file = configFile(root)
  if (!existsSync(file)) return
  const bak = backupFile(root)
  const temp = `${bak}.${process.pid}.tmp`
  rmSync(temp, { force: true })
  try {
    copyFileSync(file, temp)
    if (!IS_WINDOWS) chmodSync(temp, 0o600)
    renameSync(temp, bak)
  } catch (err) {
    rmSync(temp, { force: true })
    throw err
  }
}

export type WriteResult = { ok: true; changes: SettingChange[]; file: string } | { ok: false; key: string; reason: string }

function store(root: string, result: PatchResult, current: { text?: string; broken: boolean }): WriteResult {
  if (!result.ok) return result
  const text = configText(result.config)
  const file = configFile(root)
  // Nothing to do: no file and nothing set, a file that is not JSON and nothing set (it is left for the person to look at), or the same bytes.
  if (current.text === undefined && result.changes.length === 0) return { ok: true, changes: [], file }
  if (current.broken && result.changes.length === 0) return { ok: true, changes: [], file }
  if (current.text === text) return { ok: true, changes: result.changes, file }
  secureRoot(root)
  keepBackup(root)
  replaceFile(file, text)
  return { ok: true, changes: result.changes, file }
}

/**
 * Changes settings: `patch` maps setting ids to new values, `null` resets one. Checked before anything is
 * written; a refusal names the key and the reason and leaves the file alone. Keys it does not know are kept.
 */
export function writeConfig(root: string, patch: Record<string, unknown>): WriteResult {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, key: '?', reason: 'a change is an object of setting ids and values' }
  const { raw, broken } = readRaw(root)
  return store(root, applyPatch(raw, patch), { text: readText(root).text, broken })
}

/** Resets every setting: the old file is kept as config.json.bak and the file becomes `{ "version": 1 }`. A file that already is that is left alone, so a second reset keeps the backup of the first. */
export function resetAll(root: string): WriteResult {
  if (readText(root).text === configText(emptyConfig())) return { ok: true, changes: [], file: configFile(root) }
  const before = resolveSettings(readRaw(root).raw)
  const differs = SETTING_KEYS.some(key => JSON.stringify(settingValue(before, key)) !== JSON.stringify(findSetting(key)!.default))
  secureRoot(root)
  keepBackup(root)
  replaceFile(configFile(root), configText(emptyConfig()))
  return { ok: true, changes: differs ? [{ key: 'all', old: 'various', new: 'default' }] : [], file: configFile(root) }
}

// ---- the command line ----

const USAGE = 'usage: settings.ts get [<key>] --root <dir> | set <key> <value> --root <dir> | reset <key> --root <dir> | reset-all --root <dir>'

/** `--root <dir>` taken out of the arguments, wherever it stands. */
function takeRoot(args: string[]): string {
  const at = args.indexOf('--root')
  if (at < 0) throw new Error(`--root <dir> is required\n${USAGE}`)
  const value = args[at + 1]
  if (!value || value.startsWith('-')) throw new Error('--root needs a folder')
  args.splice(at, 2)
  if (args.includes('--root')) throw new Error('--root may be given once')
  return resolve(value)
}

/** A command-line value: JSON when it parses (4, true, 0.9, ["a b c"]), else the text itself. */
function parseValue(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const out = (value: unknown) => process.stdout.write(`${JSON.stringify(value)}\n`)

function failed(result: WriteResult) {
  if (result.ok) return
  throw new Error(`${result.key}: ${result.reason}`)
}

async function main(argv: readonly string[]) {
  const args = [...argv]
  const root = takeRoot(args)
  const [command, ...rest] = args
  if (command === 'get') {
    if (rest.length > 1) throw new Error(USAGE)
    const settings = readConfig(root)
    if (rest.length === 0) {
      const { warnings, ...values } = settings
      return out({ file: configFile(root), settings: values, warnings })
    }
    const key = rest[0]!
    const def = findSetting(key)
    if (def === undefined) throw new Error(`${key.slice(0, 64)}: not a setting`)
    return out({ key, value: settingValue(settings, key), default: def.default, warnings: settings.warnings.filter(warning => warning.key === key || warning.key === CONFIG_FILE) })
  }
  if (command === 'set') {
    if (rest.length !== 2) throw new Error(USAGE)
    const result = writeConfig(root, { [rest[0]!]: parseValue(rest[1]!) })
    failed(result)
    return out(result)
  }
  if (command === 'reset') {
    if (rest.length !== 1) throw new Error(USAGE)
    const result = writeConfig(root, { [rest[0]!]: null })
    failed(result)
    return out(result)
  }
  if (command === 'reset-all') {
    if (rest.length > 0) throw new Error(USAGE)
    return out(resetAll(root))
  }
  throw new Error(USAGE)
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    () => process.exit(0),
    err => {
      process.stderr.write(`mnemosyne settings: ${(err as Error).message}\n`)
      process.exit(1)
    },
  )
}
