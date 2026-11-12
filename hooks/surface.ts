// What a person or Claude sees of the engine: the engine's own names (Mnemopi)
// are renamed to Mnemosyne. Shared by the hooks module and the stdio proxy.

// The engine names stats with its provider, bank and a duplicate `stats` block.
// Keeps the counts, renames the provider; errors and text that is not JSON pass through.
export function mnemosyneStats(text: string) {
  try {
    const { status, working, episodic, memoria } = JSON.parse(text)
    if (status !== 'ok') return text
    return JSON.stringify({ status, provider: 'mnemosyne', working, episodic, memoria })
  } catch {
    return text
  }
}

// memory_remember <-> mnemopi_remember: the engine's tool name for ours.
export const engineTool = (name: string) => name.replace(/^memory_/, 'mnemopi_')
export const publicTool = (name: string) => name.replace(/^mnemopi_/, 'memory_')

// ---- memory_get (GET.1) and recall's cut rows (GET.2) ----

/** What the store says about a row besides its text: whose it is, its scope, its kind and whether it is live. Read-only (bin/row-info.ts). */
export type RowInfo = { id: string; owner: string; scope: string | null; kind: string | null; live: boolean }

/** A memory id as memory_get accepts it: letters, digits, _ and -, never starting with - (it would read as an option), at most 64. */
export const MEMORY_ID = /^[A-Za-z0-9_][A-Za-z0-9_-]{0,63}$/

/**
 * Whether a memory_get may show a row. A row is shown to its own owner (live or not: the owner can restore it), and a live
 * global row to every owner, as recall shows it; a retired or expired global row of another owner is not. `asOwner` is the
 * owner the call reads as: the call's own `owner` where the caller may name one (Claude Code, as update and forget do),
 * else the caller's own owner. Unknown rows are not shown.
 */
export const visibleTo = (info: RowInfo | undefined, asOwner: string) => info !== undefined && (info.owner === asOwner || (info.scope === 'global' && info.live))

/** The reply for a memory that does not exist or may not be shown: the same either way, so it says nothing about other owners' rows. */
export const getNotFound = (id: unknown) => JSON.stringify({ status: 'not_found', memory_id: typeof id === 'string' ? id : String(id ?? '') })

/**
 * The engine's mnemopi_get reply as a client sees it: the full text with its id, owner, kind, tags, pinned, importance and
 * timestamps. Kind and scope come from `info` (the engine's get leaves them out). A reply that is not an ok JSON row passes through.
 */
export function mnemosyneGet(text: string, info: RowInfo | undefined) {
  try {
    const reply = JSON.parse(text) as { status?: unknown; memory?: Record<string, unknown> }
    if (reply?.status !== 'ok' || reply.memory === null || typeof reply.memory !== 'object') return text
    const row = reply.memory
    let metadata: Record<string, unknown> = {}
    const raw = row.metadata ?? row.metadata_json
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>
    } catch {
      // metadata that is not JSON: no tags, not pinned
    }
    const tags = Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === 'string') : []
    const pinned = metadata.pinned === true || metadata.pinned === 1 || metadata.pinned === 'true'
    const content = typeof row.content === 'string' ? row.content : ''
    return JSON.stringify({
      status: 'ok',
      id: row.id,
      owner: row.session_id ?? info?.owner ?? null,
      kind: info?.kind ?? null,
      scope: info?.scope ?? null,
      content,
      length: Array.from(content).length,
      tags,
      pinned,
      importance: row.importance ?? null,
      source: row.source ?? null,
      created_at: row.created_at ?? null,
      timestamp: row.timestamp ?? null,
      valid_until: row.valid_until ?? null,
      superseded_by: row.superseded_by ?? null,
    })
  } catch {
    return text
  }
}

/** True when a recall row's text was cut by the engine's preview (its `truncated` flag, or a full length longer than the text). */
export function isCut(row: Record<string, unknown>) {
  if (row.truncated === true) return true
  return typeof row.full_length === 'number' && typeof row.content === 'string' && row.full_length > row.content.length
}

/** The note a cut row carries in a recall reply, naming the call that gives its full text. */
export const cutNote = (id: unknown, owner?: unknown) =>
  `Cut to a preview. Call memory_get with memory_id ${String(id)}${typeof owner === 'string' && owner !== '' ? ` and owner ${owner}` : ''} for the full text.`

/** The recall tool's description: says that long memories come back cut, and how to read them whole. */
export const RECALL_DESCRIPTION_CUT =
  'A long memory comes back cut to a 500-character preview ending in …, marked truncated: true with its full_length; call memory_get with its id (and owner) for the full text.'
