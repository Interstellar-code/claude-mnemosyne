// Claude Mnemosyne — one activity log entry (C3 in the mnemosyne-ui plan).
//
// Imports nothing (no claude-code, no Bun), so the hooks, the external proxy
// and the dashboard server build the same line. The writer is bin/activity.ts.
//
// A line: { t, action, origin, owner, text, ids, count, ok, error? }. `text` is
// the call's preview (query, fact, tags): secret-shaped strings are replaced by
// [redacted] first, then it is cut to TEXT_LIMIT characters.

export type ActivityAction = 'recall' | 'remember' | 'update' | 'forget' | 'stats' | 'rearm' | 'extract' | 'retire'
export type ActivityOrigin = 'hook' | 'trigger' | 'tool' | 'external' | 'ui' | 'backfill'

export type ActivityEntry = {
  t: string
  action: ActivityAction
  origin: ActivityOrigin
  owner: string
  text: string
  ids: string[]
  count: number
  ok: boolean
  client?: string
  session?: string
  author_type?: string
  veracity?: string
  error?: string
}

export type ActivityFields = {
  action: ActivityAction
  origin: ActivityOrigin
  owner: string
  text?: unknown
  ids?: readonly unknown[]
  count?: number
  ok: boolean
  client?: unknown
  session?: unknown
  author_type?: unknown
  veracity?: unknown
  error?: unknown
  t?: string
}

export const TEXT_LIMIT = 200
// Text is cut to this many code points before redaction, so a huge input costs little.
export const REDACT_INPUT_LIMIT = 2000
export const IDS_LIMIT = 50
export const REDACTED = '[redacted]'
// The line-format bounds for the new fields (CTX.1): client 60, session 64.
export const CLIENT_LIMIT = 60
export const SESSION_LIMIT = 64
// The engine's veracity labels, and its author_type values (human, agent, system).
const VERACITY_VALUES = new Set(['true', 'false', 'stated', 'inferred', 'tool', 'imported', 'unknown'])
const AUTHOR_TYPE_VALUES = new Set(['human', 'agent', 'system'])
// C0 and C1 control characters and DEL, plus the bidirectional marks (U+061C,
// U+200E/F, U+202A-E, U+2066-9) and zero-width characters (U+200B-D, U+FEFF), the
// same set ui/server.ts's GALAXY_CONTROL removes: a client or session name must
// never make a dashboard row read as something else.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g
const codePointsOf = (text: string, limit: number) => Array.from(text).slice(0, limit).join('')

// A bounded string for the client (60) or session (64) field: control characters
// removed, the ends trimmed, and the rest cut to `limit` code points.
const bounded = (value: unknown, limit: number) => {
  const s = str(value)
  if (s === undefined) return undefined
  const clean = s.replace(CONTROL, '').trim()
  return clean === '' ? undefined : codePointsOf(clean, limit)
}

// `author_type` and `veracity`: only the engine's values pass through, else dropped.
const oneOf = (value: unknown, allowed: ReadonlySet<string>) => {
  const s = str(value)
  if (s === undefined) return undefined
  const normalized = s.trim().toLowerCase()
  return allowed.has(normalized) ? normalized : undefined
}

// The public tool name of each action the five memory tools stand for.
export const TOOL_ACTIONS: Readonly<Record<string, ActivityAction>> = {
  memory_remember: 'remember',
  memory_recall: 'recall',
  memory_update: 'update',
  memory_forget: 'forget',
  memory_stats: 'stats',
}

// Pattern-based, so a secret of an unknown shape can get through. Every
// quantifier that can backtrack is bounded, so each pattern stays fast on any
// input (tests time 100 KB and 200 KB inputs).
const SECRET_SHAPES: readonly RegExp[] = [
  /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----[\s\S]{0,8000}?(?:-----END [A-Z ]{0,40}PRIVATE KEY-----|$)/g,
  /https?:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9/_-]{8,}/gi,
  /https?:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/[0-9]{5,30}\/[A-Za-z0-9_-]{20,}/gi,
  /\b(?:sk|pk|rk)-(?:ant-|proj-|live-|test-)?[A-Za-z0-9_-]{16,}/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bglpat-[A-Za-z0-9_-]{16,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  /\beyJ[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{8,4096}\.[A-Za-z0-9_-]{8,4096}/g,
  // scheme://user:password@ — the password may hold spaces, never / or @
  /\b[a-z][a-z0-9+.-]{0,30}:\/\/[^\s:/@]{1,128}:[^@/\n]{1,128}@/gi,
]
const SECRET_NAME = '(?:password|passwd|passphrase|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|auth|credential)s?'
// A secret's value: quoted up to its closing quote, or one bare word.
const SECRET_VALUE = `("[^"\\n]{0,256}"|'[^'\\n]{0,256}'|[^\\s"',;]{1,256})`
// `name=value`, `name: value`, `"name": "value"`; the name keeps any prefix (DB_PASSWORD).
const NAMED_SECRET = new RegExp(`(${SECRET_NAME})(["']?[ \\t]{0,5}[:=][ \\t]{0,5})${SECRET_VALUE}`, 'gi')
// `password is value`, `the token was value`.
const PHRASED_SECRET = new RegExp(`(${SECRET_NAME}[ \\t]{1,5}(?:is|was|are)[ \\t]{1,5})${SECRET_VALUE}`, 'gi')
const BEARER = /\b(bearer|basic)[ \t]{1,5}[A-Za-z0-9._~+/=-]{8,}/gi
const LONG_RUN = /[A-Za-z0-9+/_-]{32,}={0,2}/g
const HEX_PART = /(^|[/_+-])([0-9a-fA-F]{32,})(?=$|[/_+=-])/g

// A long run is secret-shaped when it mixes letters and digits and is not a
// path: a run with + or a trailing = is base64 whatever its slashes.
const isOpaque = (run: string) =>
  /[0-9]/.test(run) && /[A-Za-z]/.test(run) && (/[+]|=$/.test(run) || (run.match(/\//g)?.length ?? 0) <= 2)

const quoted = (value: string) => (/^["']/.test(value) ? `${value[0]}${REDACTED}${value[0]}` : REDACTED)

/** Replaces secret-shaped strings (API keys, tokens, webhook URLs, password= values, long hex or base64 runs) by [redacted]. */
export function redact(text: string) {
  let out = text
  for (const shape of SECRET_SHAPES) out = out.replace(shape, REDACTED)
  out = out.replace(BEARER, (_m, kind: string) => `${kind} ${REDACTED}`)
  out = out.replace(NAMED_SECRET, (_m, name: string, sep: string, value: string) => `${name}${sep}${quoted(value)}`)
  out = out.replace(PHRASED_SECRET, (_m, lead: string, value: string) => `${lead}${quoted(value)}`)
  // One pass over each long run (no backtracking): opaque runs go whole, hex parts of a path go alone.
  out = out.replace(LONG_RUN, run => (isOpaque(run) ? REDACTED : run.replace(HEX_PART, (_m, sep: string) => `${sep}${REDACTED}`)))
  return out
}

/** The first `limit` code points of `text`, never half a surrogate pair. */
const codePoints = (text: string, limit: number) => Array.from(text.slice(0, limit * 2)).slice(0, limit)

/**
 * A preview: cut to REDACT_INPUT_LIMIT code points (a cut word dropped, so no
 * half secret is left), whitespace folded, secrets redacted, then cut to
 * TEXT_LIMIT code points.
 */
export function preview(value: unknown) {
  if (value === undefined || value === null) return ''
  const raw = String(value)
  const head = codePoints(raw, REDACT_INPUT_LIMIT)
  const isCut = head.join('').length < raw.length
  const input = (isCut ? head.join('').replace(/\S*$/, '') : raw).replace(/\s+/g, ' ').trim()
  const text = Array.from(redact(input))
  return text.length > TEXT_LIMIT ? `${text.slice(0, TEXT_LIMIT - 1).join('')}…` : text.join('')
}

/** One C3 entry: ids capped at IDS_LIMIT, count the full number. */
export function activityEntry(fields: ActivityFields): ActivityEntry {
  const all = (fields.ids ?? []).filter(id => id !== undefined && id !== null && id !== '').map(String)
  const client = bounded(fields.client, CLIENT_LIMIT)
  const session = bounded(fields.session, SESSION_LIMIT)
  const author_type = oneOf(fields.author_type, AUTHOR_TYPE_VALUES)
  const veracity = oneOf(fields.veracity, VERACITY_VALUES)
  return {
    t: fields.t ?? new Date().toISOString(),
    action: fields.action,
    origin: fields.origin,
    owner: String(fields.owner || 'global'),
    text: preview(fields.text),
    ids: all.slice(0, IDS_LIMIT),
    count: typeof fields.count === 'number' && Number.isFinite(fields.count) ? fields.count : all.length,
    ok: fields.ok,
    ...(fields.ok ? {} : { error: preview(fields.error ?? 'failed') || 'failed' }),
    ...(client !== undefined ? { client } : {}),
    ...(session !== undefined ? { session } : {}),
    ...(author_type !== undefined ? { author_type } : {}),
    ...(veracity !== undefined ? { veracity } : {}),
  }
}

/** One C3 line, as the writer appends it. */
export const activityLine = (fields: ActivityFields) => JSON.stringify(activityEntry(fields))

const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

/** What a call's preview shows: the query, the fact, or the tags it sets. */
export function callText(action: ActivityAction, args: Record<string, unknown>) {
  switch (action) {
    case 'remember':
      return str(args.content) ?? ''
    case 'recall':
      return str(args.query) ?? ''
    case 'update': {
      // Only strings: a client's tag of another type must not make the preview throw.
      const tags = Array.isArray(args.tags) ? args.tags.filter(tag => typeof tag === 'string') : undefined
      const parts = [str(args.content), tags ? `tags: ${tags.join(', ')}` : undefined, typeof args.importance === 'number' ? `importance ${args.importance}` : undefined]
      return parts.filter(Boolean).join(' · ')
    }
    // forget names only an id, which goes in `ids` (an id-shaped run would read as [redacted] here)
    default:
      return ''
  }
}

/**
 * What an engine reply says about a call: ok, the ids it touched and how many.
 * `reply` is the tool's text (JSON from the engine); an `error` key or a
 * not_found status is a failure.
 */
export function callOutcome(action: ActivityAction, args: Record<string, unknown>, reply: string) {
  let body: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(reply)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed
  } catch {
    // a plain-text reply: nothing to read, and not a failure
  }
  if (typeof body.error === 'string') return { ok: false, ids: [] as string[], count: 0, error: body.error }
  if (body.status === 'not_found' || body.status === 'error') {
    return { ok: false, ids: [] as string[], count: 0, error: str(body.message) ?? String(body.status) }
  }
  if (action === 'recall') {
    const results = Array.isArray(body.results) ? (body.results as Record<string, unknown>[]) : []
    return { ok: true, ids: results.map(r => String(r?.id ?? '')).filter(Boolean), count: results.length }
  }
  const id = str(body.memory_id) ?? (action === 'update' || action === 'forget' ? str(args.memory_id) : undefined)
  return { ok: true, ids: id ? [id] : [], count: id ? 1 : 0 }
}
