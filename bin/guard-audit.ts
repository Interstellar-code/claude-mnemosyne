// Claude Mnemosyne — a read-only audit of a store against the save guard (plan
// phase GUARD): how many stored memories the guard would allow, warn about or
// block today.
//   bun bin/guard-audit.ts --store <dir>
// Opens <dir>/mnemopi.db read-only, runs hooks/guard.ts admit() over every
// working_memory row and prints only counts: rows per verdict, and per rule the
// rows it hit, split by the row's verdict. Never a memory's text, id or owner.
// Exits 0 whatever the counts (a block on a real row is a false positive to
// read, not a failure of the audit), 1 when the store cannot be read.
import { admit } from '../hooks/guard'
import type { GuardRule, GuardVerdict } from '../hooks/guard'
import { openReadOnly } from './memories'

const RULES: readonly GuardRule[] = ['G1', 'G2', 'G4']
const VERDICTS: readonly GuardVerdict[] = ['allow', 'warn', 'block']

/** The audit's report for the store at `store`, or null while the engine has not made its database. */
export function auditReport(store: string): string | null {
  const db = openReadOnly(store)
  if (db === null) return null
  try {
    const verdicts: Record<GuardVerdict, number> = { allow: 0, warn: 0, block: 0 }
    const hits = Object.fromEntries(RULES.map(rule => [rule, { allow: 0, warn: 0, block: 0 }])) as Record<GuardRule, Record<GuardVerdict, number>>
    let rows = 0
    // One row at a time: the text lives only in this loop and is never kept or printed.
    for (const row of db.query('SELECT content FROM working_memory').iterate() as Iterable<{ content: string | null }>) {
      const { verdict, hits: found } = admit({ content: row.content ?? '', origin: 'audit' })
      rows += 1
      verdicts[verdict] += 1
      for (const rule of new Set(found.map(hit => hit.rule))) hits[rule][verdict] += 1
    }
    return [
      'Guard audit (read only)',
      `rows: ${rows}`,
      ...VERDICTS.map(verdict => `verdict ${verdict}: ${verdicts[verdict]}`),
      'rows hit by rule, by the row\'s verdict:',
      ...RULES.map(rule => `${rule}: allow ${hits[rule].allow}, warn ${hits[rule].warn}, block ${hits[rule].block}`),
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
