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
  // The hash keeps /a/b-c and /a/b/c apart; the name keeps it readable.
  return `project-${path.split('/').filter(Boolean).at(-1)?.replace(/[^A-Za-z0-9]+/g, '-') ?? 'root'}-${djb2(path).toString(36)}`
}

function djb2(text: string) {
  let hash = 5381
  for (const char of text) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0
  return hash
}

// Hosts that treat owner and repo names as case-insensitive: Org/Repo and org/repo are one project there.
const CASE_INSENSITIVE_HOSTS = new Set(['github.com', 'gitlab.com', 'bitbucket.org'])

/**
 * A git remote as `host/owner/repo` (issue #3), or null when it names no network
 * host (a local path, a file:// URL, a drive letter) or no path. Drops the
 * protocol, any user, password or token, the port and `.git`; lowercases the
 * host, and the whole path on hosts that ignore case. So
 * `git@github.com:Org/Repo.git`, `https://user:tok@github.com/org/repo` and
 * `ssh://git@github.com:22/org/repo.git` all give `github.com/org/repo`.
 * Used only as hash input: the text itself is never stored.
 */
export function normalizeRemote(remote: unknown): string | null {
  if (typeof remote !== 'string') return null
  const text = remote.trim()
  if (text === '') return null
  let host: string
  let path: string
  const url = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/i.exec(text)
  if (url !== null) {
    if (url[1]!.toLowerCase() === 'file') return null
    const authority = url[2]!.slice(url[2]!.lastIndexOf('@') + 1)
    host = authority.startsWith('[') ? authority.slice(1, Math.max(1, authority.indexOf(']'))) : (authority.split(':')[0] ?? '')
    path = url[3]!
  } else {
    // scp-like [user@]host:path; the colon must come before any slash, or it is a local path.
    const head = text.split('/', 1)[0] ?? ''
    const colon = head.indexOf(':')
    if (colon < 0) return null
    const authority = head.slice(0, colon)
    host = authority.slice(authority.lastIndexOf('@') + 1)
    // 'C:\repo' or 'C:/repo' is a drive letter, not a host.
    if (host.length <= 1) return null
    path = text.slice(colon + 1)
  }
  host = host.toLowerCase().replace(/\.+$/, '')
  if (!/^[a-z0-9.-]+$/.test(host) && !/^[0-9a-f:.]+$/.test(host)) return null
  path = path.replace(/\\/g, '/').split('/').filter(Boolean).join('/').replace(/\.git$/i, '')
  if (path === '') return null
  return `${host}/${CASE_INSENSITIVE_HOSTS.has(host) ? path.toLowerCase() : path}`
}

/** A short hash of a normalized remote: what the project registry records instead of the remote. */
export function remoteKey(normalized: string) {
  // The prefix keeps a remote's hash apart from a path's.
  return djb2(`remote:${normalized}`).toString(36)
}

/** The owner id a project with this normalized remote gets the first time it is seen anywhere: project-<repo>-<remote hash>. */
export function remoteOwnerId(normalized: string) {
  const name = (normalized.split('/').at(-1) ?? '').replace(/[^A-Za-z0-9]+/g, '-')
  return `project-${name === '' ? 'root' : name}-${remoteKey(normalized)}`
}
