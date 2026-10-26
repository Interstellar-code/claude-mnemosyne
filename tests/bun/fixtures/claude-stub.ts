// A stand-in for `claude plugin configure <id> --json | --values-stdin` (settings plan SRV): the
// dashboard's settings routes run it instead of the real CLI, so no spec reaches the real
// ~/.claude/settings.json. Its "settings.json" is $HOME/.claude/settings.json of the temp HOME the
// spec gives it; it keeps the file's other keys, as the real CLI does, and writes only
// pluginConfigs["<id>"].options. The option schema is this plugin's own userConfig (plugin.json).
//   CLAUDE_STUB_ID            the installed plugin id (default mnemosyne@mnemosyne); any other id is "not installed"
//   CLAUDE_STUB_SCHEMA_EXTRA  JSON object of extra schema fields, for example {"expireUnusedDays":{...}}
//   CLAUDE_STUB_LOG           a file that gets one JSON line per call: { argv, home, keys }
//   CLAUDE_STUB_MODE          ok (default) | refuse (a write exits 1) | drop (a write says ok and stores nothing) | garbage (--json is not JSON)
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const home = process.env.HOME ?? ''
const id = process.env.CLAUDE_STUB_ID ?? 'mnemosyne@mnemosyne'
const mode = process.env.CLAUDE_STUB_MODE ?? 'ok'
const settingsFile = join(home, '.claude', 'settings.json')

const log = (keys: string[]) => {
  if (process.env.CLAUDE_STUB_LOG) appendFileSync(process.env.CLAUDE_STUB_LOG, `${JSON.stringify({ argv, home, keys })}\n`)
}

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

const schema = (): Record<string, unknown> => {
  const own = JSON.parse(readFileSync(join(import.meta.dir, '..', '..', '..', '.claude-plugin', 'plugin.json'), 'utf8')).userConfig
  return { ...own, ...JSON.parse(process.env.CLAUDE_STUB_SCHEMA_EXTRA ?? '{}') }
}

const readSettings = (): Record<string, any> => {
  try {
    return JSON.parse(readFileSync(settingsFile, 'utf8'))
  } catch {
    return {}
  }
}

const [group, verb, target, flag] = argv
if (group !== 'plugin' || verb !== 'configure' || !target) fail('stub: only `plugin configure <id> --json|--values-stdin`')
if (target !== id) fail(`No installed plugin has the id "${target}". Use its full id (name@marketplace), as \`claude plugin list\` shows it.`)

const fields = schema()
const stored = (): Record<string, string> => readSettings().pluginConfigs?.[id]?.options ?? {}

if (flag === '--json') {
  log([])
  if (mode === 'garbage') {
    process.stdout.write('not json at all\n')
    process.exit(0)
  }
  const options = stored()
  const inputs = Object.fromEntries(Object.keys(fields).map(key => [key, options[key] ?? '']))
  const configured = Object.keys(fields).filter(key => (options[key] ?? '').trim() !== '')
  process.stdout.write(`${JSON.stringify({ schema: fields, inputs, configured, unconfigured: Object.keys(fields).filter(key => !configured.includes(key)) })}\n`)
  process.exit(0)
}

if (flag === '--values-stdin') {
  const text = await Bun.stdin.text()
  let values: unknown
  try {
    values = JSON.parse(text)
  } catch {
    fail('stub: stdin is not JSON')
  }
  const entries = Object.entries(values as Record<string, unknown>)
  log(entries.map(([key]) => key))
  if (mode === 'refuse') fail('stub: the value is not valid for this option')
  for (const [key, value] of entries) {
    if (!(key in fields)) fail(`stub: unknown option ${key}`)
    if (typeof value !== 'string' || /[\r\n]/.test(value)) fail(`stub: ${key} must be a single-line string`)
  }
  if (mode !== 'drop') {
    const settings = readSettings()
    settings.pluginConfigs ??= {}
    settings.pluginConfigs[id] ??= {}
    settings.pluginConfigs[id].options = { ...(settings.pluginConfigs[id].options ?? {}), ...Object.fromEntries(entries) }
    mkdirSync(join(home, '.claude'), { recursive: true })
    writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)
  }
  process.exit(0)
}

fail('stub: pass --json or --values-stdin')
