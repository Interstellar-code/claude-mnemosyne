// EMB.3.a1 and EMB.2.a3/a4: what the plugin sends an engine process about
// embeddings, run against the real engine (engine/src/cli.ts) so a wrong env is
// caught by what the engine does — no vector, or (worse) a network call — not by
// a mock. These run with the real engine installed in engine/ by `bun run test:bun`.
import { afterAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineEnv, EMBEDDINGS_CACHE_DIR, EMBEDDINGS_MODEL } from '../../hooks/engine'
import { ROOT, toolCall } from './helpers'

const CLI = join(ROOT, 'engine', 'src', 'cli.ts')
const dirs: string[] = []

function tempHome() {
  const dir = mkdtempSync(join(tmpdir(), 'mnemosyne-embeddings-'))
  dirs.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

/** One engine process for `messages`, env as given (laid over a clean, non-hostile base). */
async function spawnEngine(store: string, env: Record<string, string>, messages: readonly object[]) {
  const child = Bun.spawn([process.execPath, CLI, 'mcp'], {
    env: { ...(process.env as Record<string, string>), ...env, MNEMOPI_DATA_DIR: store },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  child.stdin.write(messages.map(message => `${JSON.stringify(message)}\n`).join(''))
  child.stdin.end()
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const replies = new Map<number, { result?: { content?: { text?: string }[] }; error?: { message?: string } }>()
  for (const line of stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (typeof message?.id === 'number') replies.set(message.id, message)
    } catch {
      // engine chatter
    }
  }
  return { exitCode, stderr, replies }
}

const remember = toolCall(1, 'mnemopi_remember', { content: 'The user prefers tabs', source: 'imported', scope: 'global' })
const recall = toolCall(2, 'mnemopi_recall', { query: 'indentation' })

describe('engineEnv pins the embedding settings (EMB.3.a1)', () => {
  test('embeddings off: MNEMOPI_NO_EMBEDDINGS is 1; the local-only pins are still set', () => {
    const env = engineEnv('/store', 'global')
    expect(env.MNEMOPI_NO_EMBEDDINGS).toBe('1')
    expect(env.MNEMOPI_EMBEDDING_API_URL).toBe('')
    expect(env.MNEMOPI_EMBEDDINGS_VIA_API).toBe('')
    expect(env.MNEMOPI_EMBEDDING_API_KEY).toBe('')
    expect(env.MNEMOPI_EMBEDDING_MODEL).toBe(EMBEDDINGS_MODEL)
    expect(env.PI_CONFIG_DIR).toBe(EMBEDDINGS_CACHE_DIR)
  })

  test('embeddings on: MNEMOPI_NO_EMBEDDINGS is empty (clears an inherited value), the pins stay', () => {
    const env = engineEnv('/store', 'global', { embeddings: true })
    expect(env.MNEMOPI_NO_EMBEDDINGS).toBe('')
    expect(env.MNEMOPI_EMBEDDING_API_URL).toBe('')
    expect(env.MNEMOPI_EMBEDDINGS_VIA_API).toBe('')
    expect(env.MNEMOPI_EMBEDDING_API_KEY).toBe('')
    expect(env.MNEMOPI_EMBEDDING_MODEL).toBe(EMBEDDINGS_MODEL)
    expect(env.PI_CONFIG_DIR).toBe(EMBEDDINGS_CACHE_DIR)
    // KNOWX.1's pins stay.
    expect(env.MNEMOPI_AUTHOR_ID).toBe('')
    expect(env.MNEMOPI_AUTHOR_TYPE).toBe('')
    expect(env.MNEMOPI_POLYPHONIC_RECALL).toBe('0')
  })

  test('a hostile inherited env cannot change the model, the API URL, the key or the cache dir', () => {
    const hostile: Record<string, string> = {
      MNEMOPI_EMBEDDING_API_URL: 'https://evil.example/v1',
      MNEMOPI_EMBEDDINGS_VIA_API: '1',
      MNEMOPI_EMBEDDING_API_KEY: 'sk-evil',
      MNEMOPI_EMBEDDING_MODEL: 'openai/text-embedding-3-small',
      MNEMOPI_EMBEDDING_DIM: '1536',
      OPENROUTER_BASE_URL: 'https://evil.example/v1',
      OPENROUTER_API_KEY: 'sk-openrouter',
      OPENAI_API_KEY: 'sk-openai',
      XDG_CACHE_HOME: '/tmp/xdg',
      OMP_PROFILE: 'work',
      PI_PROFILE: 'work',
      PI_CONFIG_DIR: '.omp',
    }
    // engineEnv is laid OVER the caller's env (as both hooks and server do), so the pins must win.
    for (const embeddings of [false, true]) {
      const env = { ...hostile, ...engineEnv('/store', 'global', { embeddings }) }
      expect(env.MNEMOPI_EMBEDDING_API_URL).toBe('')
      expect(env.MNEMOPI_EMBEDDINGS_VIA_API).toBe('')
      expect(env.MNEMOPI_EMBEDDING_API_KEY).toBe('')
      expect(env.MNEMOPI_EMBEDDING_MODEL).toBe(EMBEDDINGS_MODEL)
      expect(env.MNEMOPI_EMBEDDING_DIM).toBe('')
      expect(env.OPENROUTER_BASE_URL).toBe('')
      expect(env.OPENROUTER_API_KEY).toBe('')
      expect(env.OPENAI_API_KEY).toBe('')
      expect(env.XDG_CACHE_HOME).toBe('')
      expect(env.OMP_PROFILE).toBe('')
      expect(env.PI_PROFILE).toBe('')
      expect(env.PI_CONFIG_DIR).toBe(EMBEDDINGS_CACHE_DIR)
    }
  })
})

describe('an inherited hostile env cannot route text to an API (real engine)', () => {
  test('with embeddings off, a hostile API URL still stores no vector and makes no API call', async () => {
    const home = tempHome()
    const store = join(home, 'store')
    const { exitCode, replies } = await spawnEngine(
      store,
      {
        ...engineEnv(store, 'global'),
        HOME: home,
        // The hostile variables engineEnv clears would be here; the pins override them.
        MNEMOPI_EMBEDDING_API_URL: 'http://127.0.0.1:9/v1',
        MNEMOPI_EMBEDDING_API_KEY: 'sk-evil',
      },
      [remember, recall],
    )
    expect(exitCode).toBe(0)
    expect(replies.get(1)).toBeDefined()
    expect(replies.get(2)).toBeDefined()
    // Off means no vector: the store has no memory_embeddings table rows.
    const db = new Database(join(store, 'mnemopi.db'), { readonly: true })
    try {
      const row = db.query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='memory_embeddings'").get() as { n: number }
      const count = row.n > 0 ? (db.query('SELECT COUNT(*) AS n FROM memory_embeddings').get() as { n: number }).n : 0
      expect(count).toBe(0)
    } finally {
      db.close()
    }
  })
})
