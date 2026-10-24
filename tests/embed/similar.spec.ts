// MODEL.3.a4: the real model through mnemopi_similar. It spawns the real engine cli with
// embeddings ON against a temporary store: two near-identical notes and one unrelated
// note are saved, and only the near-identical one comes back above 0.88. Needs the
// network on its first run (the ~63 MB model download), so it lives here and not in
// `bun run test:bun`; the model cache home is shared with embed.spec.ts.
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineEnv } from '../../hooks/engine'

const ROOT = join(import.meta.dir, '..', '..')
const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

const CACHE_HOME = process.env.MNEMOSYNE_EMBED_CACHE_HOME ?? join(tmpdir(), 'mnemosyne-embed-cache-home')
mkdirSync(CACHE_HOME, { recursive: true })
const stores: string[] = []

function embedEnv(store: string) {
  // Drop NODE_ENV/BUN_ENV=test: embeddings.ts short-circuits under a test runtime.
  const base = { ...(process.env as Record<string, string>) }
  delete base.NODE_ENV
  delete base.BUN_ENV
  return { ...base, HOME: CACHE_HOME, ...engineEnv(store, 'similar-gate', { embeddings: true }) }
}

type Match = { id: string; owner: string; score: number; preview: string }

async function runEngine(store: string, calls: readonly (readonly [string, Record<string, unknown>])[]) {
  const child = Bun.spawn([process.execPath, CLI, 'mcp'], {
    env: embedEnv(store),
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  child.stdin.write(
    calls
      .map(([name, args], i) => `${JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name, arguments: args } })}\n`)
      .join(''),
  )
  child.stdin.end()
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const replies = new Map<number, Record<string, unknown>>()
  for (const line of stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (typeof message?.id === 'number') {
        replies.set(message.id, JSON.parse(message.result?.content?.[0]?.text ?? 'null') ?? {})
      }
    } catch {
      // engine chatter
    }
  }
  return { exitCode, stderr, replies }
}

afterAll(() => {
  for (const dir of stores) rmSync(dir, { recursive: true, force: true })
})

describe('mnemopi_similar under the real model', () => {
  test(
    'MODEL.3.a4: two near-identical notes and one unrelated note: only the near-identical one is above 0.88',
    async () => {
      const store = mkdtempSync(join(tmpdir(), 'mnemosyne-similar-store-'))
      stores.push(store)
      const save = (content: string) => ['mnemopi_remember', { content, source: 'mcp', scope: 'global' }] as const
      const result = await runEngine(store, [
        save('Rohit prefers dark mode in his code editors.'),
        save('Rohit prefers dark mode in code editors.'),
        save('The quarterly invoice for the Hamburg office is due on the 14th of March.'),
        ['mnemopi_similar', { content: 'Rohit prefers dark mode in his code editors', top_k: 10 }],
      ])
      expect(result.exitCode).toBe(0)
      const ids = [1, 2, 3].map(id => result.replies.get(id)?.memory_id as string)
      expect(ids.every(id => typeof id === 'string')).toBe(true)
      const reply = result.replies.get(4) as { matches: Match[]; embeddings: boolean }
      expect(reply.embeddings).toBe(true)
      const above = reply.matches.filter(match => match.score >= 0.88)
      // Both dark-mode notes are near the query; the invoice note must never be.
      expect(above.map(match => match.id).sort()).toEqual([ids[0]!, ids[1]!].sort())
      expect(reply.matches.map(match => match.id)).not.toContain(ids[2]!)
      for (const match of above) expect(match.preview.length).toBeLessThanOrEqual(80)
    },
    300_000,
  )
})
