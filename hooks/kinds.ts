// The kinds of memory (v3 plan, META.1): the engine's `memory_type` names the plugin saves with,
// each with a plain label. No imports, so the hooks, the proxy and the Bun specs can all read it.
// A save names its kind as `kind`, which a remember requires; it is forwarded to the engine as `memory_type`.
// 'unknown' is what memories saved before 0.8.0 hold (and the engine's default): it is not a kind a caller can choose.
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
 * is fine here: memory_update needs none. A remember refuses it on its own (missingKindMessage).
 */
export function kindProblem(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (isKind(value)) return undefined
  const shown = typeof value === 'string' ? `"${Array.from(value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')).slice(0, 40).join('')}"` : typeof value
  return `unknown kind ${shown}: use one of ${KIND_LIST}.`
}

/** Why a remember with no kind is refused: it names the eight kinds and says to resend. Holds no memory text. */
export const missingKindMessage = (tool: string) => `no kind given, nothing was saved. Resend ${tool} with kind: one of ${KIND_LIST}.`

// ---- expiry of a save (META.2) ----

/** A 'context' note (project state) fades after this many days unless the call says otherwise. */
export const CONTEXT_EXPIRY_DAYS = 14

/** Why `expires_in_days` cannot be used (a whole number from 1 to 365), or undefined when it is fine or missing. */
export function expiresInDaysProblem(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 365) return undefined
  return 'expires_in_days must be a whole number from 1 to 365.'
}

/**
 * The `valid_until` a save gets: `expires_in_days` from now when the call gives it, else 14 days for kind
 * 'context', else none (undefined). Assumes expiresInDaysProblem found nothing wrong.
 */
export function validUntilFor(kind: unknown, expiresInDays: unknown, now: number = Date.now()): string | undefined {
  const days = typeof expiresInDays === 'number' ? expiresInDays : kind === 'context' ? CONTEXT_EXPIRY_DAYS : undefined
  return days === undefined ? undefined : new Date(now + days * 86_400_000).toISOString()
}
