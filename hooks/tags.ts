// Topic tags, as they go into a memory's metadata.tags (v3 plan, C6): a tag is `ns:value` or `value`, where
// ns is entity, agent or asset and value is lowercase kebab-case of 1 to 31 characters ('code review' becomes
// 'code-review'). Aliases from the vocabulary fold into their tag, a tag equal to the owner's readable project
// name is dropped, duplicates and blanks are dropped, and at most 5 are kept. Only what is written goes
// through this: tags already stored are read and shown as they are. No imports, so the hooks, the proxy and
// Bun code can all use it (hooks/vocab.ts builds the alias map and the project-name set it takes).
export const MAX_TAGS = 5
export const MAX_TAG_LENGTH = 31
export const MAX_VALUE_LENGTH = MAX_TAG_LENGTH

/** The namespaces a tag may carry: `ns:value`. A tag with none is a plain topic. */
export const NAMESPACES = ['entity', 'agent', 'asset'] as const
export type Namespace = (typeof NAMESPACES)[number]

/**
 * A tag in the C6 format, or undefined when nothing is left of it. `ns:value` keeps a namespace only when it
 * is entity, agent or asset (any other `x:` is punctuation inside the value); the value is lowercase
 * kebab-case: every run of anything but letters and digits becomes one hyphen, the ends are trimmed of
 * hyphens, and it is cut to 31 characters (code points, so a character is never split).
 */
export function normalizeTag(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const text = raw.replace(/\p{Cc}/gu, '').normalize('NFKC').trim().toLowerCase()
  const colon = text.indexOf(':')
  const prefix = colon > 0 ? text.slice(0, colon).trim() : ''
  const ns = (NAMESPACES as readonly string[]).includes(prefix) ? prefix : undefined
  const value = Array.from((ns === undefined ? text : text.slice(colon + 1)).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, ''))
    .slice(0, MAX_VALUE_LENGTH)
    .join('')
    .replace(/-+$/g, '')
  if (value === '') return undefined
  return ns === undefined ? value : `${ns}:${value}`
}

/** What cleanTags knows beyond the format: the vocabulary's aliases (spelling -> tag) and tags to drop (the owner's project name). */
export interface TagRules {
  aliases?: ReadonlyMap<string, string>
  drop?: ReadonlySet<string>
}

/** The cleaned tags of a list; anything that is not a string, or has nothing left, is dropped. */
export function cleanTags(tags: readonly unknown[], rules: TagRules = {}): string[] {
  const clean: string[] = []
  for (const raw of tags) {
    const normal = normalizeTag(raw)
    if (normal === undefined) continue
    const tag = rules.aliases?.get(normal) ?? normal
    if (rules.drop?.has(normal) || rules.drop?.has(tag)) continue
    if (!clean.includes(tag)) clean.push(tag)
    if (clean.length === MAX_TAGS) break
  }
  return clean
}
