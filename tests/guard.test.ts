import { expect, test } from 'claude-code/testing'
import { admit, guardConfigOf, MAX_LENGTH, MIN_LENGTH, NEAR_DUPLICATE_SCORE, nearMatchesOf, WARN_LENGTH } from '../hooks/guard'
import type { GuardConfig } from '../hooks/guard'
import { defaults, resolve } from '../hooks/settings'

const check = (content: string, kind?: string) => admit({ content, kind, origin: 'test' })

// Fixtures are joined from pieces so no secret-shaped literal sits in the source.
const AWS = 'AKIA' + 'IOSFODNN7EXAMPLE'
const GITHUB = 'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'
const SK = 'sk-' + 'Ab12Cd34Ef56Gh78Ij90Kl12Mn34'
const SK_PROJ = 'sk-proj-' + 'Ab12Cd34Ef56Gh78Ij90Kl12Mn34_Op56'
const SLACK = 'xoxb-' + '1234567890-abcdefghij'
const JWT = 'eyJhbGciOiJIUzI1NiJ9' + '.' + 'eyJzdWIiOiIxMjM0NTY3ODkwIn0' + '.' + 'dBjftJeZ4CVPmB92K27uhbUJU1p1r'
const PEM = '-----BEGIN ' + 'RSA PRIVATE KEY-----'
const BEARER = 'Bearer ' + 'abcdef0123456789abcdef0123456789'

test('clean text is allowed with no hits', () => {
  expect(check('The dashboard server listens on a random free port and prints it once.')).toEqual({ verdict: 'allow', hits: [] })
})

test('G1 blocks each known secret format', () => {
  const secrets: Record<string, string> = {
    'AWS key': `deploy uses ${AWS} for the bucket`,
    'GitHub token': `the CI token is ${GITHUB} for pushes`,
    'sk- key': `the OpenAI key is ${SK} here`,
    'sk-proj key': `the project key ${SK_PROJ} was rotated`,
    'Slack token': `slack bot uses ${SLACK} to post`,
    JWT: `the session cookie holds ${JWT} in prod`,
    'PEM header': `paste of the key ${PEM} then lines`,
    Bearer: `curl with header Authorization: ${BEARER} works`,
    'password =': 'the db password = hunter2hunter2hunter2 on staging',
    'secret :': 'client secret: Zx9Qw8Er7Ty6Ui5 for the app',
    'api_key =': 'config sets api_key="abcd1234efgh5678" always',
    'token :': 'GITHUB_TOKEN: abcdefghijklmnop1234 in env',
    'JSON password': '{"password": "correcthorsebattery"}',
    'URL credentials': 'clone from https://deploy:s3cr3tpass@git.example.com/repo.git daily',
  }
  for (const [name, content] of Object.entries(secrets)) {
    const result = check(content)
    expect([name, result.verdict]).toEqual([name, 'block'])
    expect([name, result.hits.some((hit) => hit.rule === 'G1')]).toEqual([name, true])
  }
})

test('a G1 message names the rule and never the matched text', () => {
  const pieces = [AWS, GITHUB, SK, SLACK, JWT, 'hunter2hunter2hunter2', 's3cr3tpass', 'abcdef0123456789abcdef0123456789']
  const content = pieces.join(' and ')
  const messages = check(content).hits.map((hit) => hit.message).join('\n')
  expect(messages).toContain('G1')
  for (const piece of pieces) expect(messages.includes(piece)).toBe(false)
})

// 40 strings that look like secrets to a careless regex but are not.
const NEGATIVE_CORPUS: string[] = [
  // file paths (10)
  '/Users/rohits/Development/claude-mnemosyne/hooks/register.ts',
  '~/.claude/mnemosyne/store/mnemopi.sqlite',
  '/Users/rohits/orca/workspaces/claude-mnemosyne/v3-lane-b/tests/bun/mcp-proxy.spec.ts',
  'config lives in ~/Library/Application Support/rtk/tee/1792877018_ls-hidden.log',
  '/private/tmp/claude-501/-Users-rohits-orca-workspaces-claude-mnemosyne-v3-lane-b/scratchpad',
  'node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts',
  'the password file is /etc/passwd on linux hosts',
  'secret: /Users/rohits/.claude/mnemosyne/secrets-notes.md',
  'token = ~/.config/gh/hosts.yml is where gh keeps its login',
  'see https://github.com/thedotmack/claude-mem/blob/main/README.md for the design',
  // sha256 hashes and other hex (7)
  'sha256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'content hash 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  'checksum 2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae matches',
  'commit 5ed0190 and merge 247ea75 are on main',
  'full sha 5ed0190c0ffee1234567890abcdef1234567890a for the plan commit',
  'etag W/"33a64df551425fcc55e4d42a148795d9f25f89d4"',
  'uuid 123e4567-e89b-12d3-a456-426614174000 is the run id',
  // memory ids (5)
  'memory 0be4d332c38f676b is the lane C note',
  'memory_id 5c32146458cf95b3 owner project-claude-mnemosyne-13x8a59',
  'owner=project-claude-mnemosyne-13x8a59 holds the v3 notes',
  'forget d40b030e51f425f9 and 269af9e8c519f114 after review',
  'ids 01ab0f80a864ae90 and 0be4d332c38f676b are near-duplicates',
  // kebab slugs (9)
  'branch name interstellar-code-v3-lane-b-guard-module',
  'the sk-learn-pipeline-config-for-the-model-review slug is only a title',
  'tag task-8f66ab6d9496 and dispatch ctx_fcfce6d9a80e',
  'package claude-code-mermaid-renderer-plugin-0-7-6',
  'skill anthropic-skills-built-in-browser-guide covers panes',
  'term_a71fd963-abb7-4896-a991-c5a5fd0ced11 is the coordinator handle',
  'the risk-assessment-and-mitigation-plan-for-guard document',
  'ask-the-coordinator-before-touching-engine rule from the brief',
  'Bearer token authentication is handled by the proxy middleware',
  // model names and version strings (9)
  'routes use claude-opus-5-5 and claude-sonnet-5-5 for builds',
  'the model gpt-6.1-sol runs at high reasoning effort',
  'gemini-3.8-flash-medium is the cheap AGY route',
  'embeddings come from Xenova/all-MiniLM-L6-v2 at 384 dimensions',
  'ENGINE_BUILD is 18.12.3-mnemosyne.8 after the MODEL phase',
  'deepseek-v4.1-flash through OpenCode Go is the fallback',
  'text-embedding-3-small is not used; the plugin embeds locally',
  'token budget: the hooks keep recall under 2k tokens per prompt',
  'password rotation is a manual task for Rohit, not for agents',
]

test('the negative corpus has 40 strings', () => {
  expect(NEGATIVE_CORPUS.length).toBe(40)
})

test('G1 does not fire on paths, hashes, memory ids, kebab slugs or model names', () => {
  for (const text of NEGATIVE_CORPUS) {
    const hits = check(text).hits.filter((hit) => hit.rule === 'G1')
    expect([text, hits]).toEqual([text, []])
  }
})

test('G2 blocks empty and under-15-character text', () => {
  for (const content of ['', '   ', '\n\t ', 'short', 'a'.repeat(MIN_LENGTH - 1), `  ${'a'.repeat(MIN_LENGTH - 1)}  `]) {
    const result = check(content)
    expect([content, result.verdict, result.hits.map((hit) => hit.rule)]).toEqual([content, 'block', ['G2']])
  }
  expect(check('a'.repeat(MIN_LENGTH)).verdict).toBe('allow')
})

test('G2 warns over 1500 characters and blocks over 4000', () => {
  expect(check('a '.repeat(WARN_LENGTH / 2).trim()).verdict).toBe('allow') // 1499
  expect(check('a'.repeat(WARN_LENGTH + 1)).verdict).toBe('warn')
  expect(check('a'.repeat(MAX_LENGTH)).verdict).toBe('warn')
  const over = check('a'.repeat(MAX_LENGTH + 1))
  expect(over.verdict).toBe('block')
  expect(over.hits.map((hit) => hit.rule)).toEqual(['G2'])
})

test('G2 uses the trimmed length', () => {
  expect(check(`${' '.repeat(100)}a long enough fact to keep${' '.repeat(100)}`).verdict).toBe('allow')
})

test('non-string content counts as empty', () => {
  expect(admit({ content: undefined as unknown as string, origin: 'test' }).verdict).toBe('block')
})

test('G4 warns on a date plus a status word', () => {
  for (const text of [
    '2026-10-24 released 0.7.6 with the dashboard polish',
    'On Oct 24 the guard branch was merged into the lane',
    'work is done as of 24 October for the first round',
    '2026-10-23 next step is the CRUD page for the dashboard',
    '10/24/2026 overnight run finished all of the phases',
  ]) {
    const result = check(text)
    expect([text, result.verdict, result.hits.map((hit) => hit.rule)]).toEqual([text, 'warn', ['G4']])
  }
})

test('G4 warns on today, tonight and this session', () => {
  for (const text of [
    'Today the proxy was rewired to the guard module',
    'We will finish the importer tonight after dinner',
    'In this session the audit script was written first',
  ]) {
    expect([text, check(text).verdict]).toEqual([text, 'warn'])
  }
})

test("G4 suggests kind 'context' with an expiry", () => {
  const [hit] = check('2026-10-24 released 0.7.6 with the dashboard polish').hits
  expect(hit?.message).toContain("kind 'context'")
  expect(hit?.message).toContain('expiry')
})

test('G4 stays quiet on durable facts, on a bare date or status word, and for kind context', () => {
  expect(check('The plugin stores memories in a local SQLite file and never leaves the machine.').verdict).toBe('allow')
  expect(check('The 2026-10-24 schema has a memories table with a kind column.').verdict).toBe('allow') // date, no status
  expect(check('Hooks run next to the engine and share one store directory.').verdict).toBe('allow') // status word, no date
  expect(check('2026-10-24 released 0.7.6 with the dashboard polish', 'context').verdict).toBe('allow') // already short-lived
})

test('G4 stays quiet for a rule, preference, decision or session summary that quotes the date it was made', () => {
  const rule = 'Merge small changes to main once scoped tests pass. Why: user 2026-10-13 said review rounds are done too slowly.'
  for (const kind of ['instruction', 'preference', 'decision', 'event']) expect([kind, check(rule, kind).verdict]).toEqual([kind, 'allow'])
  // a dated progress note saved as a fact, a bug note or a reference, or with no kind, still warns
  for (const kind of ['fact', 'error', 'artifact', undefined]) expect([kind, check(rule, kind).hits.map((hit) => hit.rule)]).toEqual([kind, ['G4']])
})

// ---- WIRE.1: the limits and the extra words come from the settings (C3, C4, C6) ----

const checkWith = (content: string, config: GuardConfig, kind?: string) => admit({ content, kind, origin: 'test' }, config)
const sentence = (length: number) => `${'a fact about the build '.repeat(Math.ceil(length / 23))}`.slice(0, length)

test('WIRE.1.a1: the settings defaults give the same verdict and messages as no config (C3)', () => {
  const config = guardConfigOf(defaults())
  const samples = ['The dashboard server listens on a random free port.', sentence(1600), sentence(4100), 'too short', '', 'Today the proxy was rewired to the guard module', `the CI token is ${GITHUB}`]
  for (const text of samples) expect([text.length, checkWith(text, config)]).toEqual([text.length, check(text)])
  expect(guardConfigOf(defaults())).toMatchObject({ warnLength: WARN_LENGTH, maxLength: MAX_LENGTH, minLength: MIN_LENGTH })
})

test('WIRE.1.a2: a raised max length lets longer text in, a lowered warn length warns sooner', () => {
  const long = sentence(5000)
  expect(check(long).verdict).toBe('block')
  expect(checkWith(long, { maxLength: 8000, warnLength: 7000 }).verdict).toBe('allow')
  expect(checkWith(long, { maxLength: 8000, warnLength: 4500 }).hits[0]?.message).toContain('over 4500 characters')
  expect(check(sentence(300)).verdict).toBe('allow')
  const warned = checkWith(sentence(300), { warnLength: 200 })
  expect([warned.verdict, warned.hits[0]?.rule, warned.hits[0]?.message]).toEqual(['warn', 'G2', 'G2 size: text is over 200 characters; one fact per call is easier to find again'])
  expect(checkWith(sentence(5000), { maxLength: 6000 }).verdict).toBe('warn')
})

test('WIRE.1.a2: the min length follows the settings and the message quotes it', () => {
  expect(check(sentence(30)).verdict).toBe('allow')
  const refused = checkWith(sentence(30), { minLength: 40 })
  expect([refused.verdict, refused.hits[0]?.message]).toEqual(['block', 'G2 size: text is under 40 characters; say what the fact is in a full sentence'])
})

test('WIRE.1.a2: the chatter check can be off, warn (default) or strict', () => {
  const dated = '2026-10-24 released 0.7.6 with the dashboard polish'
  expect(checkWith(dated, { chatter: 'off' })).toEqual({ verdict: 'allow', hits: [] })
  const warned = checkWith(dated, { chatter: 'warn' })
  expect(warned).toEqual(check(dated))
  expect(warned.mustConfirm).toBeUndefined()
  const strict = checkWith(dated, { chatter: 'strict' })
  expect([strict.verdict, strict.mustConfirm, strict.hits.map(hit => hit.rule)]).toEqual(['warn', true, ['G4']])
  // strict asks for a confirm only for a chatter hit, not for a length warning
  expect(checkWith(sentence(1600), { chatter: 'strict' }).mustConfirm).toBeUndefined()
})

test('WIRE.1.a5: the chatter message quotes the context-note days from the settings', () => {
  const dated = '2026-10-24 released 0.7.6 with the dashboard polish'
  expect(check(dated).hits[0]?.message).toContain('about 14 days')
  expect(checkWith(dated, { contextDays: 30 }).hits[0]?.message).toContain('about 30 days')
})

test('WIRE.1.a2: a never-save word blocks like a secret and the message never holds the word', () => {
  const word = 'Project Falcon'
  const config = { neverSave: [word] }
  const text = 'The roadmap for project falcon ships in the spring with the new dashboard.'
  expect(check(text).verdict).toBe('allow')
  const blocked = checkWith(text, config)
  expect([blocked.verdict, blocked.hits.map(hit => hit.rule)]).toEqual(['block', ['G7']])
  expect(blocked.hits[0]?.message).toContain('G7')
  for (const piece of ['falcon', 'Falcon', 'Project']) expect(blocked.hits.map(hit => hit.message).join('\n').includes(piece)).toBe(false)
  // a full-width spelling is the same word, a word that is not there does not block, a list that is empty changes nothing
  expect(checkWith('The ＰＲＯＪＥＣＴ ＦＡＬＣＯＮ plan is written down in the shared notes page.', config).verdict).toBe('block')
  expect(checkWith('The roadmap for the new dashboard ships in the spring with polish.', config).verdict).toBe('allow')
  expect(checkWith(text, { neverSave: [] })).toEqual(check(text))
})

test('WIRE.1.a2: a never-save word is plain text, never a pattern', () => {
  const text = 'The build prints a line with a.b and then a-b on the next one for the log.'
  expect(checkWith(text, { neverSave: ['a.*b'] }).verdict).toBe('allow')
  expect(checkWith(text, { neverSave: ['a.b'] }).verdict).toBe('block')
  expect(checkWith(text, { neverSave: ['(((((((((('] }).verdict).toBe('allow')
})

test('WIRE.1.a3: the built-in secret rules and the empty-text block hold under every extreme config', () => {
  const secrets = [`deploy uses ${AWS} for the bucket`, `the CI token is ${GITHUB} for pushes`, `the OpenAI key is ${SK} here`, `slack bot uses ${SLACK} to post`, `the session cookie holds ${JWT} in prod`, `paste of the key ${PEM} then lines`, 'the db password = hunter2hunter2hunter2 on staging', 'clone from https://deploy:s3cr3tpass@git.example.com/repo.git daily']
  const extremes: GuardConfig[] = [
    {},
    { minLength: 5, warnLength: 200, maxLength: 8000, chatter: 'off', neverSave: [] },
    { minLength: 100, warnLength: 7999, maxLength: 8000, chatter: 'strict', neverSave: ['zzz'] },
    guardConfigOf(resolve({ guard: { warnLength: 7000, maxLength: 8000, minLength: 5, chatter: 'off' } })),
    guardConfigOf(resolve({ guard: { neverSave: ['anything'], maxLength: 'nonsense', minLength: -4 } })),
    { minLength: Number.NaN, warnLength: Number.POSITIVE_INFINITY, maxLength: Number.NEGATIVE_INFINITY },
  ]
  for (const [i, config] of extremes.entries()) {
    for (const secret of secrets) {
      const result = checkWith(secret, config)
      expect([i, secret.slice(0, 20), result.verdict, result.hits.some(hit => hit.rule === 'G1')]).toEqual([i, secret.slice(0, 20), 'block', true])
    }
    for (const empty of ['', '   ', '\n\t']) expect([i, checkWith(empty, config).verdict]).toEqual([i, 'block'])
  }
})

test('WIRE.1.a2: the near-duplicate threshold moves what counts as a close memory', () => {
  const close = (score: number) => [{ id: 'm1', owner: 'global', score, preview: 'a different memory entirely' }]
  expect(nearMatchesOf(close(0.9), 'x')).toHaveLength(1)
  expect(nearMatchesOf(close(0.9), 'x', undefined, 0.92)).toHaveLength(0)
  expect(nearMatchesOf(close(0.93), 'x', undefined, 0.92)).toHaveLength(1)
  expect(nearMatchesOf(close(0.85), 'x', undefined, 0.8)).toHaveLength(1)
  expect(nearMatchesOf(close(NEAR_DUPLICATE_SCORE), 'x')).toHaveLength(1)
})
