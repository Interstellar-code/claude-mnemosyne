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
