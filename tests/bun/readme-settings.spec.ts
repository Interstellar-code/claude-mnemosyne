// REL85.1 (0.8.5 settings plan): the README's settings tables say what hooks/settings.ts and
// .claude-plugin/plugin.json say. Every setting in the schema has a row; every row's default, allowed
// values and "applies" badge are the schema's, written the way formatDefault/formatAllowed below write them;
// a row for a setting the schema does not have fails. Docs cannot drift from the code unnoticed.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GROUPS, SETTINGS } from '../../hooks/settings'
import type { SettingDef } from '../../hooks/settings'
import { ROOT } from './helpers'

const README = readFileSync(join(ROOT, 'README.md'), 'utf8')
const PLUGIN = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')) as {
  version: string
  userConfig: Record<string, { type: string; default?: unknown; options?: string[]; multiple?: boolean }>
}

/** The cells of every table row under a `### <heading>` of the README, first cell with its backticks removed. */
function rowsUnder(heading: string): string[][] {
  const start = README.indexOf(`\n### ${heading}\n`)
  if (start < 0) throw new Error(`README has no "### ${heading}" section`)
  const rest = README.slice(start + 1)
  const end = rest.slice(4).search(/\n#{2,3} /)
  const section = end < 0 ? rest : rest.slice(0, end + 4)
  return section
    .split('\n')
    .filter(line => line.startsWith('|'))
    .map(line => line.slice(1, -1).split('|').map(cell => cell.trim()))
    .filter(cells => cells[0] !== undefined && /^`[^`]+`$/.test(cells[0]))
    .map(cells => [cells[0]!.slice(1, -1), ...cells.slice(1)])
}

const onOff = (value: boolean) => (value ? 'on' : 'off')

/** The Default cell for a config setting. */
function formatDefault(def: SettingDef): string {
  switch (def.type) {
    case 'boolean':
      return onOff(def.default)
    case 'integer':
    case 'number':
    case 'choice':
      return String(def.default)
    case 'words':
      return def.default.length === 0 ? 'none' : def.default.join(', ')
    case 'pick':
      return def.default.length === def.choices.length ? `all ${def.choices.length} tools` : def.default.join(', ')
  }
}

/** The Allowed cell for a config setting. */
function formatAllowed(def: SettingDef): string {
  switch (def.type) {
    case 'boolean':
      return 'on, off'
    case 'integer':
    case 'number':
      return `${def.min} to ${def.max}`
    case 'choice':
      return def.choices.join(', ')
    case 'words':
      return `up to ${def.maxItems} entries of ${def.minItemLength} to ${def.maxItemLength} characters`
    case 'pick':
      return `any of the ${def.choices.length} tool names`
  }
}

describe('README settings tables match the schema', () => {
  const rows = rowsUnder('The settings in `config.json`')
  const byKey = new Map(rows.map(cells => [cells[0]!, cells]))

  test('every schema setting has exactly one row, and no row names a setting the schema does not have', () => {
    expect(rows.map(cells => cells[0]).sort()).toEqual(SETTINGS.map(def => def.key).sort())
    expect(byKey.size).toBe(rows.length)
    for (const key of byKey.keys()) expect((GROUPS as readonly string[]).includes(key.split('.')[0]!)).toBe(true)
  })

  for (const def of SETTINGS) {
    test(`${def.key}: default ${formatDefault(def)}, allowed ${formatAllowed(def)}, applies ${def.applies}`, () => {
      const cells = byKey.get(def.key)
      expect(cells).toBeDefined()
      const [, shownDefault, shownAllowed, shownApplies] = cells!
      expect(shownDefault).toBe(formatDefault(def))
      expect(shownAllowed).toBe(formatAllowed(def))
      expect(shownApplies).toBe(def.applies)
    })
  }

  test('the schema is not empty and a setting has a description column', () => {
    expect(SETTINGS.length).toBeGreaterThan(20)
    for (const cells of rows) expect((cells[4] ?? '').length).toBeGreaterThan(10)
  })
})

describe('README plugin options match plugin.json', () => {
  const rows = rowsUnder('The plugin options')
  const byKey = new Map(rows.map(cells => [cells[0]!, cells]))
  const options = Object.entries(PLUGIN.userConfig)

  test('every plugin option has exactly one row, and no row names an option plugin.json does not have', () => {
    expect(rows.map(cells => cells[0]).sort()).toEqual(options.map(([key]) => key).sort())
    expect(byKey.size).toBe(rows.length)
  })

  for (const [key, field] of options) {
    const wantedDefault = Array.isArray(field.default) ? field.default.join(', ') : field.type === 'boolean' ? onOff(field.default === true) : String(field.default)
    const wantedAllowed = field.options !== undefined ? field.options.join(', ') : field.type === 'boolean' ? 'on, off' : field.multiple === true ? 'list of terms' : 'text'
    test(`${key}: default ${wantedDefault}, allowed ${wantedAllowed}`, () => {
      const cells = byKey.get(key)
      expect(cells).toBeDefined()
      expect(cells![1]).toBe(wantedDefault)
      expect(cells![2]).toBe(wantedAllowed)
    })
  }
})

describe('README numbers outside the settings tables', () => {
  const guard = (key: string) => String(SETTINGS.find(def => def.key === key)!.default)

  test('the save-guard table quotes the default limits', () => {
    const start = README.indexOf('| Rule | Looks for | What happens |')
    expect(start).toBeGreaterThan(0)
    const table = README.slice(start, README.indexOf('\n\n', start))
    expect(table).toContain(`under ${guard('guard.minLength')} characters`)
    expect(table).toContain(`over ${guard('guard.maxLength')} characters`)
    expect(table).toContain(`over ${guard('guard.warnLength')} characters`)
    expect(table).toContain(`cosine score ${guard('guard.nearDuplicateScore')} or more`)
  })

  test('the tag and expiry sentences quote the defaults', () => {
    expect(README).toContain(`a memory keeps at most ${guard('tags.maxPerMemory')} tags`)
    expect(README).toContain(`an expiry ${guard('expiry.contextDays')} days after the save`)
  })
})

describe('the version', () => {
  test('the newest CHANGELOG entry is the plugin.json version', () => {
    const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8')
    expect(changelog.match(/^## (\d+\.\d+\.\d+)/m)?.[1]).toBe(PLUGIN.version)
  })
})
