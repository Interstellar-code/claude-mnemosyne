// Plain text labels for the 3D map (plan MAP.3). Pure: no DOM, no three.js.
//
// The map never makes HTML from data: the library's HTML tooltip is off
// (NO_TOOLTIP in ui/map-state.ts), hover text goes into an app-owned element
// with textContent, and 3D labels are drawn on a canvas. So a label only needs
// to be short and free of control characters; it is never HTML-escaped,
// because nothing parses it as HTML (escaping would show `&lt;` as text).

// C0 and C1 control characters and DEL, and the bidirectional marks,
// overrides and isolates (U+061C, U+200E/F, U+202A-E, U+2066-9), which could
// make a label read as something else.
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it removes
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g
// Line and paragraph breaks of every kind (U+0085, U+2028, U+2029 included) and tabs.
const SPACES = /[\t\n\r\u000b\u000c\u0085\u2028\u2029]+/g

/**
 * `text` as a one-line plain label of at most `max` characters: line breaks
 * and tabs become one space, other control characters are removed, the ends
 * are trimmed, and a longer label is cut to `max - 1` characters and an ellipsis.
 * Markup stays exactly as written: `<img src=x>` comes back as `<img src=x>`.
 */
export function plainLabel(text: string, max: number): string {
  const limit = Math.max(1, Math.floor(max))
  const clean = String(text).replace(SPACES, ' ').replace(CONTROL, '').trim()
  const chars = Array.from(clean)
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : clean
}
