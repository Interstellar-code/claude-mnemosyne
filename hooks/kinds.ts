// The kinds of memory (v3 plan, META.1): the engine's `memory_type` names the plugin saves with,
// each with a plain label. No imports, so the hooks, the proxy and the Bun specs can all read it.
// A save names its kind as `kind`; it is forwarded to the engine as `memory_type`. 'unknown' is what
// the engine stores when no kind is given: it is not a kind a caller can choose.
export const KINDS = [
  { name: 'fact', label: 'fact' },
  { name: 'preference', label: 'preference' },
  { name: 'instruction', label: 'rule or runbook' },
  { name: 'decision', label: 'decision' },
  { name: 'context', label: 'project state' },
  { name: 'error', label: 'bug note' },
  { name: 'artifact', label: 'reference' },
  { name: 'event', label: 'session summary' },
] as const

export type Kind = (typeof KINDS)[number]['name']

export const KIND_NAMES: readonly Kind[] = KINDS.map(kind => kind.name)

export const isKind = (value: unknown): value is Kind => typeof value === 'string' && (KIND_NAMES as readonly string[]).includes(value)

/** The plain label of a kind name, or the name itself when it is not one of the eight. */
export const kindLabel = (name: string) => KINDS.find(kind => kind.name === name)?.label ?? name

/** `fact, preference, instruction (rule or runbook), ...`: the list as a person reads it. */
export const KIND_LIST = KINDS.map(kind => (kind.label === kind.name ? kind.name : `${kind.name} (${kind.label})`)).join(', ')

/**
 * Why a `kind` argument cannot be used, or undefined when it is fine. A missing kind (undefined or null)
 * is fine: the save goes through as 'unknown' with a warning, never a refusal.
 */
export function kindProblem(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (isKind(value)) return undefined
  const shown = typeof value === 'string' ? `"${Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')).slice(0, 40).join('')}"` : typeof value
  return `unknown kind ${shown}: use one of ${KIND_LIST}.`
}

/** The one-line warning for a save that named no kind. */
export const NO_KIND_WARNING = `no kind given, saved as 'unknown'. Pass kind (${KIND_LIST}) so the memory can be found and expired correctly.`

/**
 * The engine's reply with the missing-kind warning in it. The reply is JSON, so the warning goes in as a
 * `warning` key and the reply stays parseable; text that is not a JSON object gets it as a last line.
 */
export function withNoKindWarning(reply: string): string {
  try {
    const value: unknown = JSON.parse(reply)
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return JSON.stringify({ ...value, warning: NO_KIND_WARNING }, null, reply.includes('\n') ? 2 : 0)
    }
  } catch {
    // not JSON: the warning follows as a line
  }
  return `${reply}\nMnemosyne: ${NO_KIND_WARNING}`
}
