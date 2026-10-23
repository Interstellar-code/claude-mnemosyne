// LOG.2: the C3 entry the hooks, the proxy and the server all build (hooks/activity-log.ts).
import { expect, test } from 'claude-code/testing'
import { activityEntry, activityLine, callOutcome, callText, IDS_LIMIT, preview, redact, TEXT_LIMIT, TOOL_ACTIONS } from '../hooks/activity-log'

test('known key and token shapes are redacted', () => {
  const shapes = [
    'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz012345',
    'sk-proj-abcdefghijklmnop1234',
    'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    'github_pat_11ABCDEFG0123456789_abcdefghijklmnop',
    'glpat-abcdefghij0123456789',
    'xoxb-1234567890-abcdefghij',
    'AKIAIOSFODNN7EXAMPLE',
    'AIzaSyA-1234567890abcdefghijklmnopqrstu',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
  ]
  for (const shape of shapes) {
    const out = redact(`key ${shape} here`)
    expect(out).toBe('key [redacted] here')
  }
})

test('password=, token: and Bearer values are redacted, the name kept', () => {
  expect(redact('login with password=hunter2 now')).toBe('login with password=[redacted] now')
  expect(redact('DB_PASSWORD: "s3cret!"')).toBe('DB_PASSWORD: "[redacted]"')
  expect(redact('api_key=abc123 and token=xyz')).toBe('api_key=[redacted] and token=[redacted]')
  expect(redact('Authorization: Bearer abc.def-ghi_jkl')).toBe('Authorization: Bearer [redacted]')
  expect(redact('postgres://admin:pa55word@db.local/app')).toBe('[redacted]db.local/app')
})

test('long hex and base64 runs are redacted; ordinary text and paths are not', () => {
  expect(redact('sha 0123456789abcdef0123456789abcdef01234567 ok')).toBe('sha [redacted] ok')
  expect(redact('blob QmFzZTY0U2VjcmV0VmFsdWVUaGF0SXNMb25nRW5vdWdo== end')).toBe('blob [redacted] end')
  const plain = 'We deploy on Fridays from /Users/rohits/Development/claude-mnemosyne with pnpm; see README.md.'
  expect(redact(plain)).toBe(plain)
  expect(redact('a_very_long_identifier_name_without_any_digits_at_all')).toBe('a_very_long_identifier_name_without_any_digits_at_all')
})

test('a preview is redacted before it is cut to 200 characters, whitespace folded', () => {
  const secret = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  // The secret straddles the cut: cut first, then redact, would leave its head behind.
  const text = `${'x '.repeat(88)}${secret} tail`
  const out = preview(text)
  expect(out.length).toBeLessThanOrEqual(TEXT_LIMIT)
  expect(out).not.toContain('ghp_ABCDEF')
  expect(out).toContain('[redacted]')
  expect(preview('a\n\n  b\tc')).toBe('a b c')
  expect(preview(undefined)).toBe('')
  expect(preview('y'.repeat(500)).length).toBe(TEXT_LIMIT)
})

test('an entry has the C3 keys; error only when not ok', () => {
  const ok = activityEntry({ action: 'recall', origin: 'hook', owner: 'global', text: 'q', ids: ['a', 'b'], ok: true, t: '2026-10-23T00:00:00.000Z' })
  expect(ok).toEqual({ t: '2026-10-23T00:00:00.000Z', action: 'recall', origin: 'hook', owner: 'global', text: 'q', ids: ['a', 'b'], count: 2, ok: true })
  const failed = activityEntry({ action: 'remember', origin: 'tool', owner: '', ok: false, error: 'engine said password=hunter2' })
  expect(failed).toMatchObject({ owner: 'global', ids: [], count: 0, ok: false, error: 'engine said password=[redacted]' })
  expect(Number.isNaN(Date.parse(failed.t))).toBe(false)
  expect(activityLine({ action: 'stats', origin: 'external', owner: 'global', ok: true })).not.toContain('\n')
})

test('the five tools map to their actions', () => {
  expect(TOOL_ACTIONS).toEqual({ memory_remember: 'remember', memory_recall: 'recall', memory_update: 'update', memory_forget: 'forget', memory_stats: 'stats' })
})

// CTX.1.a1: client and session are optional, bounded, and control-free; author_type and veracity
// pass only the engine's values; each new field is written only when set.

test('CTX.1.a1: client and session are written bounded and control-free', () => {
  const entry = activityEntry({
    action: 'recall', origin: 'external', owner: 'global', ok: true,
    client: `codex-mcp-client\u0000\t \n`, session: `s\u001f${'x'.repeat(80)}`,
  })
  expect(entry.client).toBe('codex-mcp-client')
  expect(entry.session).toBe(`s${'x'.repeat(63)}`)
  expect(entry.session).toHaveLength(64)
  expect(entry.client).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/)
  expect(entry.session).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/)
  expect(activityEntry({ action: 'stats', origin: 'ui', owner: 'global', ok: true, client: 'x'.repeat(100) }).client).toBe('x'.repeat(60))
})

test('CTX.1.a1: author_type and veracity pass only the engine values, else dropped', () => {
  expect(activityEntry({ action: 'remember', origin: 'tool', owner: 'global', ok: true, author_type: 'human', veracity: 'stated' }))
    .toMatchObject({ author_type: 'human', veracity: 'stated' })
  expect(activityEntry({ action: 'remember', origin: 'tool', owner: 'global', ok: true, author_type: 'AGENT', veracity: 'Inferred' }))
    .toMatchObject({ author_type: 'agent', veracity: 'inferred' })
  const dropped = activityEntry({ action: 'remember', origin: 'tool', owner: 'global', ok: true, author_type: 'robot', veracity: 'maybe' })
  expect(dropped.author_type).toBeUndefined()
  expect(dropped.veracity).toBeUndefined()
  expect(dropped.client).toBeUndefined()
  expect(dropped.session).toBeUndefined()
})

test('CTX.1.a2: the extract action is part of the line format', () => {
  const entry = activityEntry({ action: 'extract', origin: 'hook', owner: 'global', ok: true, text: 'mined 3 items' })
  expect(entry.action).toBe('extract')
  expect(JSON.parse(activityLine({ action: 'extract', origin: 'hook', owner: 'global', ok: true })).action).toBe('extract')
})

test('CTX.1.a3: a line without the new fields parses and renders exactly as before', () => {
  const line = activityLine({ action: 'recall', origin: 'hook', owner: 'global', text: 'q', ids: ['a'], count: 1, ok: true, t: '2026-10-23T00:00:00.000Z' })
  expect(JSON.parse(line)).toEqual({ t: '2026-10-23T00:00:00.000Z', action: 'recall', origin: 'hook', owner: 'global', text: 'q', ids: ['a'], count: 1, ok: true })
})

test('a call preview: the query, the fact, or what an update sets', () => {
  expect(callText('recall', { query: 'pnpm' })).toBe('pnpm')
  expect(callText('remember', { content: 'we use pnpm' })).toBe('we use pnpm')
  expect(callText('update', { content: 'new', tags: ['routing', 'jev'] })).toBe('new · tags: routing, jev')
  expect(callText('update', { importance: 0.8 })).toBe('importance 0.8')
  expect(callText('forget', { memory_id: 'm1' })).toBe('')
  expect(callText('stats', {})).toBe('')
})

test('a reply gives ok, ids and count; an error key or not_found is a failure', () => {
  expect(callOutcome('recall', {}, JSON.stringify({ status: 'ok', results: [{ id: 'a' }, { id: 'b' }] }))).toEqual({ ok: true, ids: ['a', 'b'], count: 2 })
  expect(callOutcome('remember', {}, JSON.stringify({ status: 'stored', memory_id: 'm7' }))).toEqual({ ok: true, ids: ['m7'], count: 1 })
  expect(callOutcome('forget', { memory_id: 'm1' }, '{"status":"deleted"}')).toEqual({ ok: true, ids: ['m1'], count: 1 })
  expect(callOutcome('update', { memory_id: 'm1' }, '{"status":"not_found","memory_id":"m1"}')).toMatchObject({ ok: false, error: 'not_found' })
  expect(callOutcome('update', { memory_id: 'm1' }, '{"error":"metadata must be an object"}')).toMatchObject({ ok: false, error: 'metadata must be an object' })
  expect(callOutcome('stats', {}, 'not json')).toEqual({ ok: true, ids: [], count: 0 })
})

// Review r1 MED 1: redaction is fast on any input.

// Random-looking base64url without Math.random's quality mattering: a fixed LCG.
function base64url(length: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let seed = 12345
  let out = ''
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648
    out += alphabet[seed % 64]
  }
  return out
}

const elapsed = (work: () => unknown) => {
  const start = Date.now()
  work()
  return Date.now() - start
}

test('100 KB of "a-" and 200 KB of random base64url each redact in under 200 ms', () => {
  const dashes = 'a-'.repeat(50_000)
  const blob = base64url(200_000)
  expect(elapsed(() => redact(dashes))).toBeLessThan(200)
  expect(elapsed(() => redact(blob))).toBeLessThan(200)
  expect(elapsed(() => preview(dashes))).toBeLessThan(200)
  expect(elapsed(() => preview(blob))).toBeLessThan(200)
  expect(redact(blob)).toBe('[redacted]')
})

test('a preview cut before redaction drops the cut word, so no half secret is left', () => {
  const secret = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  // A long opaque run shrinks to [redacted], pulling a secret cut at the input limit into the preview.
  const text = `${base64url(1985)} ${secret}`
  const out = preview(text)
  expect(out).toBe('[redacted]')
})

// Review r1 LOW 3: redaction gaps.

test('quoted values are redacted up to the closing quote', () => {
  expect(redact('password="my secret phrase" ok')).toBe('password="[redacted]" ok')
  expect(redact("DB_PASSWORD: 'two words' end")).toBe("DB_PASSWORD: '[redacted]' end")
  expect(redact('{"api_key": "abc def ghi"}')).toBe('{"api_key": "[redacted]"}')
})

test('"password is <word>" phrases are redacted', () => {
  expect(redact('my password is hunter2 ok')).toBe('my password is [redacted] ok')
  expect(redact('the token was abc123')).toBe('the token was [redacted]')
  expect(redact("the secret is 'open sesame' now")).toBe("the secret is '[redacted]' now")
})

test('a run with + or a trailing = is opaque whatever its slashes', () => {
  expect(redact('run ab/cd/ef/gh/ij+kl012345678901234567890123456789 x')).toBe('run [redacted] x')
  expect(redact('blob a/b/c/d0123456789012345678901234567890123== y')).toBe('blob [redacted] y')
  // a path with a hex part: only the hex part goes
  expect(redact('path /repo/0123456789abcdef0123456789abcdef/file ok')).toBe('path /repo/[redacted]/file ok')
})

test('Slack and Discord webhook URLs are redacted', () => {
  expect(redact('post to https://hooks.slack.com/services/T0000000/B0000000/XXXXXXXXXXXXXXXXXXXXXXXX now')).toBe('post to [redacted] now')
  expect(redact('hook https://discord.com/api/webhooks/123456789012/abcdefghijklmnopqrstuvwxyz_ABC end')).toBe('hook [redacted] end')
})

test('scheme://user:password@ is redacted, spaces in the password too', () => {
  expect(redact('db postgres://admin:pa ss word@db.local/app')).toBe('db [redacted]db.local/app')
  expect(redact('see https://example.com/path and mail me')).toBe('see https://example.com/path and mail me')
})

// Review r1 LOW 4 and LOW 11.

test(`ids are capped at ${IDS_LIMIT}; count keeps the full number`, () => {
  const ids = Array.from({ length: 120 }, (_, i) => `m${i}`)
  const entry = activityEntry({ action: 'recall', origin: 'tool', owner: 'global', ids, ok: true })
  expect(entry.ids.length).toBe(IDS_LIMIT)
  expect(entry.ids[0]).toBe('m0')
  expect(entry.count).toBe(120)
  expect(activityEntry({ action: 'recall', origin: 'tool', owner: 'global', ids, count: 7, ok: true }).count).toBe(7)
})

test('the 200-character cut counts code points and never splits an emoji', () => {
  const out = preview(`${'x'.repeat(198)}😀😀😀`)
  expect(Array.from(out).length).toBe(TEXT_LIMIT)
  expect(out).toBe(`${'x'.repeat(198)}😀…`)
  expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false)
  expect(preview('😀'.repeat(150))).toBe('😀'.repeat(150))
})

test('a call preview shows only string tags (review r1 LOW 7)', () => {
  expect(callText('update', { tags: ['a', { toString: 1 }, 'b'] })).toBe('tags: a, b')
})
