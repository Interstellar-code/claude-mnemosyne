import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { engineEnv } from '../../hooks/engine'
import { tempDir } from './helpers'

const ROOT = join(import.meta.dir, '..', '..')
const CLI = join(ROOT, 'engine', 'src', 'cli.ts')

async function engineCallWithCwd(cli: string, cwd: string, env: Record<string, string>) {
  const child = Bun.spawn([process.execPath, cli, 'mcp'], {
    cwd,
    env: { ...(process.env as Record<string, string>), ...env },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'mnemopi_remember', arguments: { content: 'bank env hole probe memory' } } }) + '\n')
  child.stdin.end()
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

describe('MNEMOPI_MCP_BANK cannot be set from a .env (HARDEN.1)', () => {
  const roots: string[] = []
  afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }) })

  test('cwd .env with MNEMOPI_MCP_BANK=evil lands in default bank', async () => {
    const work = tempDir('bank-cwd').dir
    roots.push(work)
    const home = tempDir('bank-home2').dir
    const store = join(home, 'store')
    mkdirSync(store, { recursive: true })
    roots.push(home)
    writeFileSync(join(work, '.env'), 'MNEMOPI_MCP_BANK=evil\n')
    const piConfig = join(home, 'pi-config')
    mkdirSync(piConfig, { recursive: true })
    const env = { ...(process.env as Record<string, string>), HOME: home, PI_CONFIG_DIR: piConfig, ...engineEnv(store, 'global') }
    const { exitCode } = await engineCallWithCwd(CLI, work, env)
    expect(exitCode).toBe(0)
    expect(existsSync(join(store, 'banks', 'evil'))).toBe(false)
  })

  test('HOME .env with MNEMOPI_MCP_BANK=evil lands in default bank', async () => {
    const work = tempDir('bank-work3').dir
    roots.push(work)
    const home = tempDir('bank-home3').dir
    const store = join(home, 'store')
    mkdirSync(store, { recursive: true })
    roots.push(home)
    writeFileSync(join(home, '.env'), 'MNEMOPI_MCP_BANK=evil\n')
    const piConfig = join(home, 'pi-config')
    mkdirSync(piConfig, { recursive: true })
    const env = { ...(process.env as Record<string, string>), HOME: home, PI_CONFIG_DIR: piConfig, ...engineEnv(store, 'global') }
    const { exitCode } = await engineCallWithCwd(CLI, work, env)
    expect(exitCode).toBe(0)
    expect(existsSync(join(store, 'banks', 'evil'))).toBe(false)
  })
})