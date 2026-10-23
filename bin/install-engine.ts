// Claude Mnemosyne — installs the plugin's own engine copy (engine/) into the
// engine folder, without ever removing a working engine first.
//
//   bun bin/install-engine.ts <plugin root> <engine dir> <store dir>
//
// 1. Builds <engine dir>.next: engine/ (no node_modules, no test) copied whole
//    to <engine dir>.next/pi-mnemopi, a package.json naming it as
//    @oh-my-pi/pi-mnemopi = file:./pi-mnemopi, then `bun install` there
//    (production, no peers).
// 2. Checks the new cli answers tools/list with our build's mnemopi_update.
// 3. Only then renames <engine dir> to <engine dir>.old, <engine dir>.next to
//    <engine dir>, and deletes <engine dir>.old.
// On any failure it deletes <engine dir>.next, leaves <engine dir> as it was
// and exits 1 with the reason. It writes nothing outside the three folders,
// and refuses a store inside any of them, compared as real paths (symlinks
// followed, case-folded on macOS and Windows). The cli path stays
// <engine dir>/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { INSTALL_CHECK_TIMEOUT_MS, INSTALL_STEP_TIMEOUT_MS } from '../hooks/engine-build'

const PACKAGE = '@oh-my-pi/pi-mnemopi'
// The default file systems of macOS and Windows ignore case: Engine/ is engine/.
const FOLDS_CASE = process.platform === 'darwin' || process.platform === 'win32'

class InstallError extends Error {}

/**
 * The real path of `path`: the nearest part that exists, symlinks followed
 * (a dangling link by its target), plus the parts that do not exist yet.
 * Case-folded where the file system ignores case.
 */
export function canonical(path: string, depth = 0): string {
  let current = resolve(path)
  const rest: string[] = []
  for (;;) {
    let exists = true
    try {
      lstatSync(current)
    } catch {
      exists = false
    }
    if (exists) {
      let real: string
      try {
        real = realpathSync.native(current)
      } catch {
        // A dangling symlink: follow its target, which may be created later.
        real = depth < 32 ? canonical(resolve(dirname(current), readlinkSync(current)), depth + 1) : current
      }
      const full = join(real, ...rest)
      return FOLDS_CASE ? full.toLowerCase() : full
    }
    const parent = dirname(current)
    if (parent === current) break
    rest.unshift(basename(current))
    current = parent
  }
  const full = join(current, ...rest)
  return FOLDS_CASE ? full.toLowerCase() : full
}

/** True when `path` is `folder` or inside it, compared as real paths. */
export function isInside(path: string, folder: string) {
  const rel = relative(canonical(folder), canonical(path))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

export const cliOf = (engineDir: string) => join(engineDir, 'node_modules', ...PACKAGE.split('/'), 'src', 'cli.ts')

async function run(argv: string[], cwd: string, input: string | undefined, timeoutMs: number, env?: Record<string, string>) {
  const child = Bun.spawn(argv, {
    cwd,
    env: env ?? (process.env as Record<string, string>),
    stdin: input === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (input !== undefined && child.stdin) {
    child.stdin.write(input)
    child.stdin.end()
  }
  const timer = setTimeout(() => child.kill(), timeoutMs)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    return { stdout, stderr, exitCode }
  } finally {
    clearTimeout(timer)
  }
}

/** The new engine answers tools/list, and its mnemopi_update takes metadata (our build). */
async function check(next: string, build: string, embeddings: boolean) {
  const installed = join(next, 'node_modules', ...PACKAGE.split('/'), 'package.json')
  if (!existsSync(installed)) throw new InstallError(`bun install left no ${PACKAGE} in ${next}`)
  const version = JSON.parse(readFileSync(installed, 'utf8')).version
  if (version !== build) throw new InstallError(`installed ${PACKAGE} is ${version}, expected ${build}`)
  // A throwaway data dir inside .next: the check writes nothing outside the three folders.
  const data = join(next, '.check-store')
  mkdirSync(data, { recursive: true })
  // With embeddings on, the check also proves the native stack works on this
  // machine: it remembers, recalls and exits cleanly, which downloads the model
  // once into <root>'s pinned cache. The embedding settings are pinned local-only
  // exactly as engineEnv pins them (hooks/engine.ts), so this is the real path.
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    MNEMOPI_DATA_DIR: data,
    MNEMOPI_SESSION_ID: 'install-check',
    MNEMOPI_NO_EMBEDDINGS: embeddings ? '' : '1',
    MNEMOPI_MCP_BANK: '',
    MNEMOPI_LLM_BASE_URL: '',
    MNEMOPI_HOST_LLM_ENABLED: '',
    MNEMOPI_EMBEDDING_API_URL: '',
    MNEMOPI_EMBEDDINGS_VIA_API: '',
    MNEMOPI_EMBEDDING_API_KEY: '',
    MNEMOPI_EMBEDDING_MODEL: 'BAAI/bge-small-en-v1.5',
    PI_CONFIG_DIR: '.claude/mnemosyne/model-cache',
  }
  const request = (id: number, name: string, args: Record<string, unknown>) =>
    `${JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })}\n`
  // tools/list first; then, with embeddings on, one remember and one recall.
  const stdin = embeddings
    ? `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n` +
      request(2, 'mnemopi_remember', { content: 'The install check prefers dark mode.', source: 'imported', scope: 'global' }) +
      request(3, 'mnemopi_recall', { query: 'dark mode' })
    : `${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })}\n`
  const ran = await run([process.execPath, cliOf(next), 'mcp'], next, stdin, INSTALL_CHECK_TIMEOUT_MS, env)
  rmSync(data, { recursive: true, force: true })
  const replies = new Map<number, { result?: { content?: { text?: string }[]; isError?: boolean }; error?: { message?: string } }>()
  for (const line of ran.stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (typeof message?.id === 'number') replies.set(message.id, message)
    } catch {
      // engine chatter
    }
  }
  const tools = (replies.get(1)?.result as { tools?: { name: string; inputSchema?: { properties?: Record<string, unknown> } }[] } | undefined)?.tools
  if (!Array.isArray(tools)) throw new InstallError(`the new engine did not answer tools/list (exit ${ran.exitCode}): ${ran.stderr.trim().slice(-400)}`)
  const update = tools.find(tool => tool.name === 'mnemopi_update')
  if (!update?.inputSchema?.properties?.metadata) throw new InstallError('the new engine has no mnemopi_update with metadata')
  if (!embeddings) return
  // A clean embeddings run: remember and recall reply, the process exits 0, and
  // no ORT exit panic is on stderr. Any failure refuses the swap (EMB.3.a4).
  if (ran.exitCode !== 0) throw new InstallError(`embeddings check failed: engine exited ${ran.exitCode}: ${ran.stderr.trim().slice(-400)}`)
  if (/panic: A C\+\+ exception occurred|oh no: Bun has crashed/i.test(ran.stderr)) {
    throw new InstallError(`embeddings check failed: the engine crashed on exit (onnxruntime): ${ran.stderr.trim().slice(-400)}`)
  }
  for (const [id, what] of [[2, 'remember'], [3, 'recall']] as const) {
    const reply = replies.get(id)
    if (reply === undefined || reply.error !== undefined || reply.result?.isError === true) {
      const detail = reply?.error?.message ?? reply?.result?.content?.[0]?.text ?? 'no reply'
      throw new InstallError(`embeddings check failed: ${what} did not succeed (${detail})`)
    }
  }
}

export async function install(pluginRoot: string, engineDir: string, storeDir: string, embeddings = false) {
  for (const [name, path] of [['plugin root', pluginRoot], ['engine dir', engineDir], ['store dir', storeDir]] as const) {
    if (!path || !isAbsolute(path)) throw new InstallError(`${name} must be an absolute path (got "${path}")`)
  }
  const engine = resolve(engineDir)
  const next = `${engine}.next`
  const old = `${engine}.old`
  for (const folder of [engine, next, old]) {
    if (isInside(storeDir, folder)) throw new InstallError(`the store ${storeDir} is inside ${folder}; refusing to install there`)
  }
  const source = join(resolve(pluginRoot), 'engine')
  const sourcePackage = join(source, 'package.json')
  if (!existsSync(sourcePackage)) throw new InstallError(`no engine copy at ${source}`)
  if (isInside(engine, source) || isInside(source, engine)) throw new InstallError(`the engine dir ${engine} overlaps the plugin's engine copy`)
  if (!existsSync(dirname(engine))) throw new InstallError(`the folder ${dirname(engine)} does not exist`)
  const build = JSON.parse(readFileSync(sourcePackage, 'utf8')).version as string

  // A swap cut short last time: <engine> gone, <engine>.old whole. Put it back first.
  if (!existsSync(engine) && existsSync(old)) renameSync(old, engine)
  rmSync(next, { recursive: true, force: true })

  try {
    mkdirSync(next)
    cpSync(source, join(next, 'pi-mnemopi'), {
      recursive: true,
      filter: path => {
        const rel = relative(source, path).split(sep)
        return rel[0] !== 'node_modules' && rel[0] !== 'test'
      },
    })
    writeFileSync(
      join(next, 'package.json'),
      `${JSON.stringify(
        {
          name: 'mnemosyne-engine',
          private: true,
          dependencies: { [PACKAGE]: 'file:./pi-mnemopi' },
          // `overrides` only apply from the install root, so the engine's own
          // manifest cannot fix fastembed's onnxruntime-node here: it must be
          // restated on this root package.json. 1.26.0 is a fastembed 3.0.0
          // install with ORT's exit crash (ORT #24579) fixed; @anush008/tokenizers
          // 0.6.0 adds the linux-arm64 bindings fastembed's ^0.0.0 lacks.
          overrides: { 'onnxruntime-node': '1.26.0', '@anush008/tokenizers': '0.6.0' },
          trustedDependencies: ['onnxruntime-node'],
        },
        null,
        2,
      )}\n`,
    )
    // --production --omit=peer installs the engine's dependencies (now including
    // fastembed at the root overrides above) and skips dev and peer dependencies,
    // so the ~500 MB the engine's own tests pull in is not installed.
    // No lockfile: Bun saves none under --production, so the pinned 18.12.3
    // packages and their dependencies resolve fresh, through Bun's global cache.
    const installed = await run([process.execPath, 'install', '--production', '--omit=peer'], next, undefined, INSTALL_STEP_TIMEOUT_MS)
    if (installed.exitCode !== 0) {
      throw new InstallError(`bun install failed (exit ${installed.exitCode}): ${`${installed.stderr}\n${installed.stdout}`.trim().slice(-800)}`)
    }
    await check(next, build, embeddings)
  } catch (error) {
    rmSync(next, { recursive: true, force: true })
    throw error
  }

  // The new engine answers: swap it in. Any step here can fail (on Windows a
  // running engine holds its folder open): put the old engine back, drop .next.
  const hadEngine = existsSync(engine)
  try {
    rmSync(old, { recursive: true, force: true })
    if (hadEngine) renameSync(engine, old)
    renameSync(next, engine)
  } catch (error) {
    try {
      if (hadEngine && !existsSync(engine) && existsSync(old)) renameSync(old, engine)
    } finally {
      rmSync(next, { recursive: true, force: true })
    }
    throw new InstallError(`could not move the new engine into place: ${(error as Error).message}`)
  }
  try {
    rmSync(old, { recursive: true, force: true })
  } catch {
    // The new engine is in place; a leftover .old is removed by the next install.
  }
  return { engine, build, cli: cliOf(engine) }
}

if (import.meta.main) {
  const [pluginRoot = '', engineDir = '', storeDir = '', embeddingsArg = ''] = process.argv.slice(2)
  try {
    // The 4th argument is "embeddings" when /mnemosyne-setup's option is on:
    // the check then also downloads the model once and proves a clean exit.
    const done = await install(pluginRoot, engineDir, storeDir, embeddingsArg === 'embeddings')
    console.log(JSON.stringify({ ok: true, ...done }))
  } catch (error) {
    console.error(`install-engine: ${(error as Error).message}`)
    process.exit(1)
  }
}
