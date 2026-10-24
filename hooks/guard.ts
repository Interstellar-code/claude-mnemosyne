// The admission guard: one check that every memory write goes through before it
// reaches the engine. admit() blocks known secret formats (G1) and empty,
// too-short or oversize text (G2), and warns about oversize-ish text (G2) and
// dated task chatter (G4). A message names the rule, never the matched text, so a
// caller can log or show it without leaking what it caught. No imports, so the
// hooks, the proxy, the dashboard server and the importers can all use it.
export type GuardRule = 'G1' | 'G2' | 'G4'
export type GuardVerdict = 'allow' | 'warn' | 'block'
export interface GuardHit {
  rule: GuardRule
  message: string
}
export interface GuardInput {
  content: string
  kind?: string
  /** Who is saving: 'hook', 'proxy', 'dashboard', 'import', ... Not used by the rules yet. */
  origin: string
}
export interface GuardResult {
  verdict: GuardVerdict
  hits: GuardHit[]
}

export const MIN_LENGTH = 15
export const WARN_LENGTH = 1500
export const MAX_LENGTH = 4000

// Known secret shapes only. High-entropy runs alone are not secrets: the store is
// full of file paths and hashes.
const SECRET_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'AWS access key', pattern: /(?<![A-Za-z0-9])AKIA[0-9A-Z]{16}(?![A-Za-z0-9])/ },
  { name: 'GitHub token', pattern: /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{20,}/ },
  // sk-<20+ unbroken characters>, or sk-proj- / sk-ant-... style; a kebab slug that happens to start with sk- has hyphens too soon
  { name: 'API key (sk-)', pattern: /(?<![A-Za-z0-9_-])sk-(?:[A-Za-z0-9]{20,}|(?:proj|ant|svcacct|admin)[A-Za-z0-9-]*-[A-Za-z0-9_-]{20,})/ },
  { name: 'Slack token', pattern: /(?<![A-Za-z0-9])xox[abp]-[A-Za-z0-9-]{10,}/ },
  { name: 'JWT', pattern: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: 'private key header', pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/ },
  // a long token that holds a digit; plain words after "Bearer" are prose
  { name: 'Bearer token', pattern: /\bBearer\s+(?=[A-Za-z0-9._~+/=-]*\d)[A-Za-z0-9._~+/=-]{20,}/i },
  { name: 'URL with credentials', pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s/]+/i },
]

// password / secret / api_key / token, then = or :, then 12+ non-space characters
const ASSIGNMENT = /(?:password|passwd|secret|api[_-]?key|token)["']?[ \t]*[=:][ \t]*["']?([^\s"']{12,})/gi
// values that point at something else instead of being a secret: paths, env references, placeholders
const NOT_A_VALUE = /^(?:[/~$<{%]|\.{1,2}\/|process\.env|os\.environ|env\.|https?:)/i

function holdsAssignedSecret(content: string): boolean {
  for (const match of content.matchAll(ASSIGNMENT)) {
    if (!NOT_A_VALUE.test(match[1] ?? '')) return true
  }
  return false
}

function secretHits(content: string): GuardHit[] {
  const hits: GuardHit[] = []
  for (const { name, pattern } of SECRET_PATTERNS) {
    if (pattern.test(content)) hits.push({ rule: 'G1', message: `G1 secret: text looks like a ${name}; remove it and save the fact without the credential` })
  }
  if (holdsAssignedSecret(content)) {
    hits.push({ rule: 'G1', message: 'G1 secret: text assigns a value to password, secret, api_key or token; remove the value and save the fact without it' })
  }
  return hits
}

/** G2: empty, too short and too long text blocks; long text only warns. */
function sizeCheck(content: string): { block?: GuardHit; warn?: GuardHit } {
  const length = content.trim().length
  if (length === 0) return { block: { rule: 'G2', message: 'G2 size: text is empty' } }
  if (length < MIN_LENGTH) return { block: { rule: 'G2', message: `G2 size: text is under ${MIN_LENGTH} characters; say what the fact is in a full sentence` } }
  if (length > MAX_LENGTH) return { block: { rule: 'G2', message: `G2 size: text is over ${MAX_LENGTH} characters; split it into one fact per call` } }
  if (length > WARN_LENGTH) return { warn: { rule: 'G2', message: `G2 size: text is over ${WARN_LENGTH} characters; one fact per call is easier to find again` } }
  return {}
}

const MONTHS = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const DATE = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}[/.]\\d{1,2}[/.]\\d{4}\\b|\\b(?:${MONTHS})\\.? \\d{1,2}\\b|\\b\\d{1,2} (?:${MONTHS})\\b`, 'i')
const STATUS = /\b(?:released|merged|done|next|overnight|round)\b/i
const NOW_WORDS = /\b(?:today|tonight|this session)\b/i

function chatterHits(content: string, kind: string | undefined): GuardHit[] {
  if (kind === 'context') return [] // already saved as short-lived project state
  if (!(DATE.test(content) && STATUS.test(content)) && !NOW_WORDS.test(content)) return []
  return [{ rule: 'G4', message: "G4 task chatter: text reads like dated progress; save it as kind 'context' with an expiry (valid_until, about 14 days) instead" }]
}

/** Checks text before it is saved: block (never reaches the engine), warn (saved, with the hits shown) or allow. */
export function admit(input: GuardInput): GuardResult {
  const content = typeof input.content === 'string' ? input.content : ''
  const size = sizeCheck(content)
  const blocks = [...(size.block ? [size.block] : []), ...secretHits(content)]
  const warnings = [...(size.warn ? [size.warn] : []), ...chatterHits(content, input.kind)]
  if (blocks.length > 0) return { verdict: 'block', hits: [...blocks, ...warnings] }
  if (warnings.length > 0) return { verdict: 'warn', hits: warnings }
  return { verdict: 'allow', hits: [] }
}
