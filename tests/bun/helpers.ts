// Shared helpers for the Bun specs: temporary folders, the real installer, and
// one-shot calls to a real engine cli.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineEnv } from '../../hooks/engine'

export const ROOT = join(import.meta.dir, '..', '..')
export const INSTALLER = join(ROOT, 'bin', 'install-engine.ts')

export function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), `mnemosyne-${prefix}-`))
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) }
}

export async function runInstaller(engineDir: string, storeDir: string, env: Record<string, string> = {}) {
  const child = Bun.spawn([process.execPath, INSTALLER, ROOT, engineDir, storeDir], {
    env: { ...(process.env as Record<string, string>), ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

// The engine variables, from the one place the hooks and the server take them (SRV.1).
export { engineEnv } from '../../hooks/engine'

/** One engine process answering raw JSON-RPC messages; the parsed replies by id. */
export async function engineCall(cli: string, store: string, owner: string, messages: readonly object[]) {
  const child = Bun.spawn([process.execPath, cli, 'mcp'], {
    env: { ...(process.env as Record<string, string>), ...engineEnv(store, owner) },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  child.stdin.write(messages.map(message => `${JSON.stringify(message)}\n`).join(''))
  child.stdin.end()
  const [stdout] = await Promise.all([new Response(child.stdout).text(), child.exited])
  const replies = new Map<unknown, any>()
  for (const line of stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (message?.id !== undefined) replies.set(message.id, message)
    } catch {
      // engine chatter
    }
  }
  return replies
}

export const toolCall = (id: number, name: string, args: Record<string, unknown>) => ({
  jsonrpc: '2.0',
  id,
  method: 'tools/call',
  params: { name, arguments: args },
})

/** The JSON body of a tool reply's text. */
export const body = (reply: any) => JSON.parse(reply?.result?.content?.[0]?.text ?? 'null')
