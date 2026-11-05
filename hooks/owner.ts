// The owner id formula, host-free: register.ts asks the host for the repo root
// (or the cwd) and hands it here; bin/owner.ts prints the same id for Switch.
// This file imports nothing.

export const GLOBAL_OWNER = 'global'

// Forward slashes on every OS: Bun and Windows both accept them.
export const slashes = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '')

// `global` unless the scope is per-project; else an id from the root folder.
// The hash walks code points and takes each one's first UTF-16 unit, so an
// astral character hashes differently from a per-unit loop: keep it that way,
// every stored owner id depends on it.
export function ownerId(scope: unknown, root: string) {
  if (scope !== 'per-project') return GLOBAL_OWNER
  const path = slashes(root)
  let hash = 5381
  for (const char of path) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0
  // The hash keeps /a/b-c and /a/b/c apart; the name keeps it readable.
  return `project-${path.split('/').filter(Boolean).at(-1)?.replace(/[^A-Za-z0-9]+/g, '-') ?? 'root'}-${hash.toString(36)}`
}
