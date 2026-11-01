// Claude Mnemosyne — prints the owner id Mnemosyne uses for a folder (issue #43),
// so another program (Switch) can ask instead of copying the formula.
//   bun bin/owner.ts <path>      prints project-<name>-<hash>
//   bun bin/owner.ts --global    prints global
// Nothing else goes to stdout; a bad or missing path exits 1 with one line on stderr.
//
// The root: the parent of `git rev-parse --path-format=absolute --git-common-dir`
// run in <path>, i.e. the main worktree, so a linked worktree shares its repo's
// owner. Git reports that path symlink-resolved (on macOS /tmp is /private/tmp),
// and it is hashed as git reports it. A path outside any git repo is hashed as
// given, resolved against the cwd lexically and never canonicalised. The formula
// itself is hooks/owner.ts, the one register.ts uses.
import { statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { GLOBAL_OWNER, ownerId } from '../hooks/owner'

class OwnerError extends Error {}

/** The main worktree of the repo holding `dir`, as git reports it; undefined outside a repo. */
export function repoRoot(dir: string) {
  // An inherited GIT_DIR or GIT_WORK_TREE would answer for another repo.
  const env = { ...(process.env as Record<string, string>) }
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) delete env[name]
  let ran: ReturnType<typeof Bun.spawnSync>
  try {
    ran = Bun.spawnSync(['git', 'rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: dir, env, stdout: 'pipe', stderr: 'pipe' })
  } catch {
    // Without git a repo cannot be told from a plain folder, and a guessed id would be silently wrong.
    throw new OwnerError('git is not installed or not on PATH')
  }
  if (ran.exitCode !== 0) return undefined
  const common = (ran.stdout?.toString() ?? '').trim()
  return common ? dirname(common) : undefined
}

/** The owner id for the folder at `path` (per-project scope). */
export function ownerOf(path: string) {
  const dir = resolve(path)
  let isDir = false
  try {
    isDir = statSync(dir).isDirectory()
  } catch {
    // missing or unreadable
  }
  if (!isDir) throw new OwnerError(`not a folder: ${path}`)
  return ownerId('per-project', repoRoot(dir) ?? dir)
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  try {
    if (args.length !== 1 || args[0] === '') throw new OwnerError('usage: bun bin/owner.ts <path> | --global')
    console.log(args[0] === '--global' ? GLOBAL_OWNER : ownerOf(args[0]!))
  } catch (error) {
    console.error(`owner: ${(error as Error).message}`)
    process.exit(1)
  }
}
