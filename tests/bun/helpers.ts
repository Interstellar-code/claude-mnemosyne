// Shared helpers for the Bun specs: temporary folders, the real installer, and
// one-shot calls to a real engine cli.
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineEnv } from '../../hooks/engine'

const REAL_HOME = homedir()
export const ROOT = join(import.meta.dir, '..', '..')
export const INSTALLER = join(ROOT, 'bin', 'install-engine.ts')

export function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), `mnemosyne-${prefix}-`))
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) }
}

const _isolatedHomes = new Set<string>()
export function isolatedEnv(prefix = 'isolated') {
  const home = mkdtempSync(join(tmpdir(), `mnemosyne-${prefix}-`))
  const piConfig = join(home, '.claude', 'mnemosyne', 'model-cache')
  mkdirSync(piConfig, { recursive: true })
  // Reuse the already-downloaded model cache (a cache, not user data) via a
  // symlink so tests do not re-download it; `logs/` stays a real folder in the
  // temp home and is removed with it. rmSync(home, { recursive: true }) deletes
  // the symlink, never its target.
  const realCache = join(REAL_HOME, '.claude', 'mnemosyne', 'model-cache', 'cache')
  const link = join(piConfig, 'cache')
  try { if (existsSync(realCache)) symlinkSync(realCache, link, 'dir') } catch {}
  _isolatedHomes.add(home)
  return { HOME: home, PI_CONFIG_DIR: piConfig }
}
function _cleanupIsolated() { for (const h of _isolatedHomes) { try { rmSync(h, { recursive: true, force: true }) } catch {} } } // rmSync removes the cache symlink, not its target
process.on('exit', _cleanupIsolated)

export async function runInstaller(engineDir: string, storeDir: string, env: Record<string, string> = {}) {
  const child = Bun.spawn([process.execPath, INSTALLER, ROOT, engineDir, storeDir], {
    env: { ...(process.env as Record<string, string>), ...isolatedEnv(), ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

// The engine variables, from the one place the hooks and the server take them (SRV.1).
export { engineEnv } from '../../hooks/engine'

export async function engineCall(cli: string, store: string, owner: string, messages: readonly object[]) {
  const home = mkdtempSync(join(tmpdir(), 'mnemosyne-enginehome-'))
  const piConfig = join(home, '.claude', 'mnemosyne', 'model-cache')
  mkdirSync(piConfig, { recursive: true })
  const child = Bun.spawn([process.execPath, cli, 'mcp'], {
    env: { ...(process.env as Record<string, string>), ...engineEnv(store, owner), HOME: home, PI_CONFIG_DIR: piConfig },
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
