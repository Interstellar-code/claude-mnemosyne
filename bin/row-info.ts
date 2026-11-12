// GET.1: whose a memory is, its scope, its kind and whether it is live, for memory_get (the engine's get leaves kind and
// scope out). Shared by bin/memories.ts (row-info, for the plugin's own tool) and bin/mcp-proxy.ts; imports nothing but
// types, so the proxy's install closure stays small. Never reads the text.
import type { Database } from 'bun:sqlite'
import { MEMORY_ID } from '../hooks/surface'
import type { RowInfo } from '../hooks/surface'

type Raw = { id: string; owner: string | null; scope: string | null; kind: string | null; valid_until: string | null; superseded_by: string | null }

// Live as recall counts it: not superseded, and no end date or one still ahead.
const isLive = (row: Raw, now: number) => row.superseded_by === null && (row.valid_until === null || !(Date.parse(row.valid_until) <= now))

/**
 * Working memory first, then episodic, as the engine's get looks. Unknown id, a bad id or no store: undefined. Fails closed:
 * an error on either table (an old schema, a lock held past the wait) gives undefined, never a look at the next table, so the
 * check can never pass on one table's row while the engine answers with the other's. Ids from the facts table are not
 * looked up, so they are not_found.
 */
export function rowInfo(db: Database | null, id: string, now = Date.now()): RowInfo | undefined {
  if (db === null || !MEMORY_ID.test(id)) return undefined
  try {
    for (const table of ['working_memory', 'episodic_memory']) {
      const row = db.query(`SELECT id, session_id AS owner, scope, memory_type AS kind, valid_until, superseded_by FROM ${table} WHERE id = ?`).get(id) as Raw | null
      if (row !== null) return { id: row.id, owner: row.owner ?? '', scope: row.scope ?? null, kind: row.kind ?? null, live: isLive(row, now) }
    }
  } catch {
    return undefined
  }
  return undefined
}
