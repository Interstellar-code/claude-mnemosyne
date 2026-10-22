// Topic tags, as they go into a memory's metadata.tags: control characters
// removed, trimmed, lowercased, unique, at most 5, each at most 24 characters
// (code points, so an emoji is never cut in half), empty ones dropped. No
// imports, so the hooks, the proxy and Bun code can all use it.
export const MAX_TAGS = 5
export const MAX_TAG_LENGTH = 24

/** The cleaned tags of a list; anything that is not a string is dropped. */
export function cleanTags(tags: readonly unknown[]): string[] {
  const clean: string[] = []
  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const text = Array.from(tag.replace(/\p{Cc}/gu, '').trim().toLowerCase()).slice(0, MAX_TAG_LENGTH).join('').trim()
    if (text && !clean.includes(text)) clean.push(text)
    if (clean.length === MAX_TAGS) break
  }
  return clean
}
