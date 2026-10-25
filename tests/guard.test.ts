import { expect, test } from 'claude-code/testing'
import { admit, MAX_LENGTH, MIN_LENGTH, WARN_LENGTH } from '../hooks/guard'

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
