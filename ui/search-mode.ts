// The Search tab's match mode, kept apart from ui/app.ts so tests can run it without a page:
// the mode choice and its remembered value, the result badge and the count note.

export type SearchMode = 'keyword' | 'hybrid'
export type Matched = 'keyword' | 'meaning' | 'both'

export const MODE_KEY = 'mnemosyne.search.mode'
/** The page shows this many hits, then a "Show more" button for the rest. */
export const SHOW_FIRST = 10

/** The stored mode, or null when there is none, it is not a mode, or storage throws (private windows, blocked storage). */
export function readMode(storage: Pick<Storage, 'getItem'> | undefined): SearchMode | null {
  try {
    const value = storage?.getItem(MODE_KEY)
    return value === 'keyword' || value === 'hybrid' ? value : null
  } catch {
    return null
  }
}

/** Remembers the mode picked; failure is ignored (storage is a convenience only). */
export function saveMode(storage: Pick<Storage, 'setItem'> | undefined, mode: SearchMode): void {
  try {
    storage?.setItem(MODE_KEY, mode)
  } catch {
    // storage is a convenience only
  }
}

/** The mode to search with: the remembered one, else the best this server offers. Without embeddings it is always keyword. */
export function chooseMode(remembered: SearchMode | null, embeddings: boolean): SearchMode {
  if (!embeddings) return 'keyword'
  return remembered ?? 'hybrid'
}

/** The badge text for a hit; empty when the server did not say (older servers). */
export function matchLabel(matched: string | undefined): string {
  if (matched === 'keyword') return 'keyword'
  if (matched === 'meaning') return 'meaning'
  if (matched === 'both') return 'keyword + meaning'
  return ''
}

/** The mode a search ran in, in words for the result note. */
export function modeLabel(mode: string | undefined): string {
  if (mode === 'keyword') return 'by keyword'
  if (mode === 'hybrid') return 'by keyword and meaning'
  return ''
}

/** The pieces of the count note, joined by the page: "12 memories found by keyword." */
export function countNote(shown: number, total: number, mode: string | undefined, skipped = 0): string {
  const skippedNote = skipped > 0 ? ` The ${skipped} smallest projects were not searched.` : ''
  if (total === 0) return `Nothing found${mode ? ` ${modeLabel(mode)}` : ''}.${skippedNote}`
  const how = modeLabel(mode)
  const noun = total === 1 ? 'memory' : 'memories'
  const of = shown < total ? `Showing ${shown} of ${total} ${noun}` : `${total} ${noun} found`
  return `${of}${how ? ` ${how}` : ''}.${skippedNote}`
}

export const MEANING_OFF_HINT = 'Embeddings are off. Run /mnemosyne-setup to turn them on.'

// ---- 0.19.0: recent queries, the result sort, facets and the score ring ----

export const RECENT_KEY = 'mnemosyne.search.recent'
/** How many recent queries the page keeps (in this browser only). */
export const RECENT_MAX = 5

/** The stored recent queries, newest first; [] when there are none or storage throws. */
export function readRecent(storage: Pick<Storage, 'getItem'> | undefined): string[] {
  try {
    const value: unknown = JSON.parse(storage?.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').slice(0, RECENT_MAX) : []
  } catch {
    return []
  }
}

/** The list with `query` first (once, case ignored), at most RECENT_MAX long; it is stored when storage allows. */
export function pushRecent(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, query: string): string[] {
  const text = query.trim().slice(0, 120)
  if (text === '') return readRecent(storage)
  const next = [text, ...readRecent(storage).filter(item => item.toLowerCase() !== text.toLowerCase())].slice(0, RECENT_MAX)
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // storage is a convenience only
  }
  return next
}

/** Below this score a hit is a weak match: Claude still receives it, and the list draws a divider before it. */
export const WEAK_SCORE = 0.5

/** The score ring's class: s0 to s10, the score in tenths (clamped to 0..1). */
export const ringClass = (score: number) => `s${Math.round(Math.min(1, Math.max(0, Number.isFinite(score) ? score : 0)) * 10)}`

/** The score as the ring shows it: ".91", or "1.0" at the top. */
export const ringText = (score: number) => (score >= 1 ? '1.0' : Math.max(0, score).toFixed(2).replace(/^0/, ''))

export type HitSort = 'rank' | 'newest' | 'recalled'
type Sortable = { score: number; timestamp: string | null; recall_count: number; id: string }

/** The hits in the order picked, without a new search: rank (the engine's order), newest first, or most recalled. */
export function sortHits<T extends Sortable>(hits: readonly T[], sort: HitSort): T[] {
  const list = [...hits]
  if (sort === 'newest') return list.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? '') || b.score - a.score)
  if (sort === 'recalled') return list.sort((a, b) => b.recall_count - a.recall_count || b.score - a.score)
  return list
}

export type HitFacet = 'owner' | 'kind' | 'matched'
type Facetable = { owner: string; memory_type?: string | null; matched?: string }

/** The facet value of a hit: its owner, its kind ('unknown' when not known) or how it matched ('keyword' for older servers). */
export function facetValue(hit: Facetable, facet: HitFacet): string {
  if (facet === 'owner') return hit.owner
  if (facet === 'kind') return hit.memory_type ? hit.memory_type : 'unknown'
  return hit.matched ?? 'keyword'
}

/** Hits counted per value of one facet, most first (then by name). */
export function countFacet(hits: readonly Facetable[], facet: HitFacet): [string, number][] {
  const counts = new Map<string, number>()
  for (const hit of hits) counts.set(facetValue(hit, facet), (counts.get(facetValue(hit, facet)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/** The query words (2+ characters) found in a hit's text, in query order, for "Matched …". */
export function matchedWords(text: string, query: string): string[] {
  // 0.28.1: whole words only ("is" no longer matches inside "risks"), and not the small words the engine does not search.
  const words = new Set(text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])
  return [...new Set(query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])].filter(word => word.length >= 2 && !QUERY_STOP_WORDS.has(word) && words.has(word))
}

/** 0.28.1: words a query is phrased with that are not what it searches for (the engine's own stop words and question words). */
export const QUERY_STOP_WORDS: ReadonlySet<string> = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'does', 'for', 'from', 'how', 'in', 'is', 'it', 'me', 'of', 'on', 'or', 'tell', 'that', 'the', 'this', 'to', 'was', 'what', 'when', 'where', 'who', 'with', 'you', 'about', 'know'])

/** 0.28.1: an entity card's facts as rows, one per predicate, its objects in order, opening the first fact's memory. */
export type EntityRow = { predicate: string; objects: string[]; source: string }
export function entityRows(facts: readonly { predicate: string; object: string; source: string }[]): EntityRow[] {
  const rows = new Map<string, EntityRow>()
  for (const fact of facts) {
    const key = fact.predicate.toLowerCase()
    const row = rows.get(key)
    if (row === undefined) rows.set(key, { predicate: fact.predicate, objects: [fact.object], source: fact.source })
    else if (!row.objects.includes(fact.object)) row.objects.push(fact.object)
  }
  return [...rows.values()]
}

/** The result header: "5 results for "q" · keyword + meaning · 38 ms". */
export function resultHead(total: number, query: string, mode: string | undefined, ms: number | undefined): string {
  const how = mode === 'hybrid' ? 'keyword + meaning' : mode === 'keyword' ? 'keyword' : ''
  return [`${total} ${total === 1 ? 'result' : 'results'} for “${query}”`, how, typeof ms === 'number' ? `${ms} ms` : ''].filter(Boolean).join(' · ')
}
