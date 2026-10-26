// Claude Mnemosyne — a read-only audit of a store against the save guard (plan
// phase GUARD): how many stored memories the guard would allow, warn about or
// block today.
//   bun bin/guard-audit.ts --store <dir>
// Opens <dir>/mnemopi.db read-only, runs hooks/guard.ts admit() over every
// working_memory row and prints only counts: rows per verdict, and per rule the
// rows it hit, split by the row's verdict. Never a memory's text, id or owner.
// Exits 0 whatever the counts (a block on a real row is a false positive to
// read, not a failure of the audit), 1 when the store cannot be read.
import { dirname, resolve } from 'node:path'
import { admit, guardConfigOf } from '../hooks/guard'
import type { GuardConfig, GuardRule, GuardVerdict } from '../hooks/guard'
import { openReadOnly } from './memories'
import { readConfig } from './settings'

const RULES: readonly GuardRule[] = ['G1', 'G2', 'G4']
// G7 (the never-save words) has a line only when the config holds words, so the report is the 0.8.4 one with none.
const VERDICTS: readonly GuardVerdict[] = ['allow', 'warn', 'block']

/** The guard as it is set today: the config.json in the store's parent folder (the data root), the defaults when there is none. */
function configFor(store: string): GuardConfig {
  try {
    return guardConfigOf(readConfig(dirname(resolve(store))))
  } catch {
    return {}
  }
}

/** The audit's report for the store at `store`, or null while the engine has not made its database. */
export function auditReport(store: string, config: GuardConfig = configFor(store)): string | null {
  const db = openReadOnly(store)
  if (db === null) return null
  try {
    const rules: readonly GuardRule[] = (config.neverSave?.length ?? 0) > 0 ? [...RULES, 'G7'] : RULES
    const verdicts: Record<GuardVerdict, number> = { allow: 0, warn: 0, block: 0 }
    const hits = Object.fromEntries(rules.map(rule => [rule, { allow: 0, warn: 0, block: 0 }])) as Record<GuardRule, Record<GuardVerdict, number>>
    let rows = 0
    // The kind decides G4, as on a save; a store without the memory_type column (an older engine) has none.
    const hasKind = (db.query("SELECT 1 FROM pragma_table_info('working_memory') WHERE name = 'memory_type'").get() ?? null) !== null
    const sql = hasKind ? 'SELECT content, memory_type FROM working_memory' : 'SELECT content, NULL AS memory_type FROM working_memory'
    // One row at a time: the text lives only in this loop and is never kept or printed.
    for (const row of db.query(sql).iterate() as Iterable<{ content: string | null; memory_type: string | null }>) {
      const kind = row.memory_type === null || row.memory_type === 'unknown' ? undefined : row.memory_type
      const { verdict, hits: found } = admit({ content: row.content ?? '', kind, origin: 'audit' }, config)
      rows += 1
      verdicts[verdict] += 1
      for (const rule of new Set(found.map(hit => hit.rule))) hits[rule][verdict] += 1
    }
    return [
      'Guard audit (read only)',
      `rows: ${rows}`,
      ...VERDICTS.map(verdict => `verdict ${verdict}: ${verdicts[verdict]}`),
      'rows hit by rule, by the row\'s verdict:',
      ...rules.map(rule => `${rule}: allow ${hits[rule].allow}, warn ${hits[rule].warn}, block ${hits[rule].block}`),
    ].join('\n')
  } finally {
    db.close()
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.length !== 2 || args[0] !== '--store' || !args[1] || args[1].startsWith('-')) {
    console.error('Usage: bun bin/guard-audit.ts --store <dir>')
    process.exit(1)
  }
  try {
    const report = auditReport(args[1])
    if (report === null) {
      console.error(`No database at ${args[1]}/mnemopi.db: nothing to audit.`)
      process.exit(1)
    }
    console.log(report)
  } catch (err) {
    // the SQLite message names no memory text
    console.error(`The guard audit could not read the store: ${(err as Error).message}`)
    process.exit(1)
  }
}
