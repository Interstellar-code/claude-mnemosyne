// EMB.2.a5: the one test that really loads the model. It spawns the real engine
// cli with embeddings ON against a temporary store and a given model cache, and
// proves the ORT fix under Bun: 3 of 3 runs exit 0 with a vector stored, no ORT
// exit panic. It needs the network on its first run (the ~63 MB model download)
// and is kept out of `bun run test:bun`, which stays offline.
//
// The cache is under a fixed temp home, not the user's real ~/.omp or
// ~/.claude: reruns reuse the downloaded model instead of fetching it again.
// CI or a lane that already downloaded it points MNEMOSYNE_EMBED_CACHE_HOME at
// that home to skip the download; the store is always a fresh temp dir.
import { afterAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineEnv } from '../../hooks/engine'

const ROOT = join(import.meta.dir, '..', '..')
const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const MODEL = 'BAAI/bge-small-en-v1.5'

// The model cache home, stable across runs: <home>/.claude/mnemosyne/model-cache/cache/fastembed.
const CACHE_HOME = process.env.MNEMOSYNE_EMBED_CACHE_HOME ?? join(tmpdir(), 'mnemosyne-embed-cache-home')
mkdirSync(CACHE_HOME, { recursive: true })
const stores: string[] = []

function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), 'mnemosyne-embed-store-'))
  stores.push(dir)
  return dir
}

// The production engineEnv (hooks/engine.ts): this gate uses it instead of
// restating the variables, so drift in engineEnv (e.g. a new pin) is caught by
// the one real-model gate (L3). Embeddings are ON: MNEMOPI_NO_EMBEDDINGS empty.
function embedEnv(store: string) {
  // Drop NODE_ENV/BUN_ENV=test: the engine's embeddings.ts short-circuits under a
  // test runtime and would never load fastembed; this gate must use the real path.
  const base = { ...(process.env as Record<string, string>) }
  delete base.NODE_ENV
  delete base.BUN_ENV
  return {
    ...base,
    HOME: CACHE_HOME,
    ...engineEnv(store, 'embed-gate', { embeddings: true }),
  }
}

function runEngine(store: string) {
  const child = Bun.spawn([process.execPath, CLI, 'mcp'], {
    env: embedEnv(store),
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const call = (id: number, name: string, args: Record<string, unknown>) =>
    `${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`
  child.stdin.write(
    call(1, 'mnemopi_remember', { content: 'The embed gate prefers dark mode in editors.', source: 'imported', scope: 'global' }) +
      call(2, 'mnemopi_recall', { query: 'theme preference' }),
  )
  child.stdin.end()
  return (async () => {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    const replies = new Map<number, unknown>()
    for (const line of stdout.split('\n')) {
      try {
        const message = JSON.parse(line)
        if (typeof message?.id === 'number') replies.set(message.id, message)
      } catch {
        // engine chatter
      }
    }
    return { exitCode, stderr, replies }
  })()
}

afterAll(() => {
  for (const dir of stores) rmSync(dir, { recursive: true, force: true })
})

describe('embeddings under Bun, 3 of 3 runs', () => {
  test(
    '3 of 3 runs exit 0 with a vector stored and no ORT exit panic',
    async () => {
      const store = tempStore()
      const results = []
      for (let run = 0; run < 3; run++) results.push(await runEngine(store))

      for (const [run, result] of results.entries()) {
        expect(`${run}:${result.exitCode}`).toBe(`${run}:0`)
        expect(result.stderr).not.toMatch(/panic: A C\+\+ exception occurred|oh no: Bun has crashed/i)
        expect(result.replies.get(1)).toBeDefined()
        expect(result.replies.get(2)).toBeDefined()
      }

      const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
      try {
        const vectors = db.query('SELECT COUNT(*) AS n, model FROM memory_embeddings').get() as {
          n: number
          model: string | null
        }
        expect(vectors.n).toBeGreaterThanOrEqual(1)
        expect(vectors.model).toBe(MODEL)
      } finally {
        db.close()
      }
    },
    300_000,
  )

  test(
    'the recall reply carries a dense score: the stored vector is used, not only full text',
    async () => {
      const store = tempStore()
      const result = await runEngine(store)
      const recall = result.replies.get(2) as { result?: { content?: { text?: string }[] } } | undefined
      const body = JSON.parse(recall?.result?.content?.[0]?.text ?? 'null') as {
        results?: { dense_score?: number }[]
      } | null
      const dense = body?.results?.map(row => row.dense_score ?? 0) ?? []
      expect(dense.some(score => score > 0)).toBe(true)
    },
    300_000,
  )

  test(
    'L1/EMB.2.a2: a one-shot run (remember then recall) exits within 5 s',
    async () => {
      const store = tempStore()
      const started = performance.now()
      const result = await runEngine(store)
      const elapsed = performance.now() - started
      expect(result.exitCode).toBe(0)
      expect(result.replies.get(1)).toBeDefined()
      expect(result.replies.get(2)).toBeDefined()
      expect(elapsed).toBeLessThan(5_000)
    },
    60_000,
  )
})
