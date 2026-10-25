// The local project registry (C12 in the solar-map plan): which owners are git
// repos and which are plain folders, so the map can draw a repo as a planet and a
// folder as a station or a starship. This file holds the pure parts: the remote's
// host, and the registry file's parse, merge and format. bin/projects.ts does the
// file work; hooks/register.ts hands it one record at session start.
//
// The registry holds names and hosts only: never a remote URL, a user name, a
// password, a token or a port. remoteHostOf() cuts the host out in the hook, so a
// full remote never leaves it; sanitizeInput() checks again in the script. No
// imports, so the hook, the script and the dashboard server can all use it.
export const PROJECTS_FILE = 'projects.json'
export const PROJECTS_VERSION = 1
/** What a remote with no network host (a local path or a file:// URL) records. */
export const LOCAL_HOST = 'local'
export const MAX_NAME = 200

export type ProjectKind = 'repo' | 'folder'

/** What a session start hands to `bun bin/projects.ts write <path>` on stdin. */
export interface ProjectInput {
  owner: string
  name: string
  kind: ProjectKind
  remoteHost: string | null
}

export interface ProjectRecord {
  name: string
  kind: ProjectKind
  remoteHost: string | null
  /** UTC date, YYYY-MM-DD. */
  firstSeen: string
  /** UTC date, YYYY-MM-DD. */
  lastSeen: string
}

export interface ProjectsFile {
  version: number
  projects: Record<string, ProjectRecord>
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
// A DNS name, an IPv4 address or an IPv6 address, lower-case; nothing that could carry a user, a port or a path.
const HOST = /^(?:[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?|(?:[0-9a-f]{0,4}:){2,7}[0-9a-f.]{0,45})$/
// 'project-<name>-<hash>' as owner() builds it; the prefix keeps 'global' and '__proto__' out of the registry.
// owner() does not cap the folder name (up to 255 on most file systems), so the owner is kept whole; only the display name is cut to MAX_NAME.
const OWNER = /^project-[A-Za-z0-9_-]{1,300}$/

const isHost = (text: string) => text.length <= 253 && HOST.test(text)

/** The host of a validated registry value: a lower-case host, 'local' or null. */
const cleanHost = (value: unknown): string | null | undefined => {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return undefined
  return isHost(value) ? value : undefined
}

/** `[user[:password]@]host[:port]` to the host alone, or LOCAL when there is none. */
function hostOfAuthority(authority: string) {
  let rest = authority.slice(authority.lastIndexOf('@') + 1)
  let host: string
  if (rest.startsWith('[')) {
    // [::1]:22
    const close = rest.indexOf(']')
    if (close < 0) return LOCAL_HOST
    host = rest.slice(1, close)
    rest = rest.slice(close + 1)
    if (rest !== '' && !/^:\d*$/.test(rest)) return LOCAL_HOST
  } else {
    const colon = rest.indexOf(':')
    host = colon < 0 ? rest : rest.slice(0, colon)
    // A port is digits. Anything else means the colon was not a port, so what came before it is not a host to trust.
    if (colon >= 0 && !/^\d*$/.test(rest.slice(colon + 1))) return LOCAL_HOST
  }
  host = host.toLowerCase().replace(/\.+$/, '')
  return host !== '' && isHost(host) ? host : LOCAL_HOST
}

/**
 * The host of a git remote, and nothing else: lower-case, with no user, password,
 * token or port. `git@github.com:o/r.git`, `https://user:token@github.com/o/r.git`
 * and `ssh://git@host:22/o/r` give the host; a remote with no network host (a path,
 * a file:// URL, a Windows drive) gives 'local'; no remote gives null.
 */
export function remoteHostOf(remote: string | null | undefined): string | null {
  if (typeof remote !== 'string') return null
  const text = remote.trim()
  if (text === '') return null
  const url = /^([a-z][a-z0-9+.-]*):\/\/(.*)$/is.exec(text)
  if (url !== null) {
    if (url[1]!.toLowerCase() === 'file') return LOCAL_HOST
    const beforeQuery = url[2]!.split(/[?#]/, 1)[0] ?? ''
    const authority = beforeQuery.split('/', 1)[0] ?? ''
    // User info is read from the authority alone, so an '@' in the path (o/r@x) is never taken for it. The one exception is a
    // password with a raw '/' in it (user:12/34@host, git-invalid but seen): the authority then ends in a 'user:...' with no '@',
    // and the user info runs to the last '@' of the whole URL.
    const from = authority.includes('@') || !authority.includes(':') ? authority : beforeQuery
    const at = from.lastIndexOf('@')
    return hostOfAuthority((at < 0 ? from : from.slice(at + 1)).split('/', 1)[0] ?? '')
  }
  // scp-like: [user@]host:path. The colon must come before any slash, or it is a path (/a/b:c, ./a:b).
  const head = text.split('/', 1)[0] ?? ''
  const afterUser = head.slice(head.lastIndexOf('@') + 1)
  const colon = afterUser.indexOf(':')
  if (colon < 0) return LOCAL_HOST
  const host = hostOfAuthority(afterUser.slice(0, colon))
  // 'C:\repo' or 'C:/repo' is a drive letter, not a host.
  return host.length === 1 ? LOCAL_HOST : host
}

/** The last segment of a folder path, the project's name; 'root' for a path with none (as owner() does). */
export function projectName(root: string): string {
  const last = root.replace(/\\/g, '/').split('/').filter(Boolean).at(-1)
  return (last ?? 'root').slice(0, MAX_NAME)
}

const emptyFile = (): ProjectsFile => ({ version: PROJECTS_VERSION, projects: {} })

function cleanRecord(raw: unknown): ProjectRecord | undefined {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const remoteHost = cleanHost(r.remoteHost)
  if (typeof r.name !== 'string' || r.name === '' || r.name.length > MAX_NAME) return undefined
  if (r.kind !== 'repo' && r.kind !== 'folder') return undefined
  if (remoteHost === undefined) return undefined
  if (typeof r.firstSeen !== 'string' || !DAY.test(r.firstSeen) || typeof r.lastSeen !== 'string' || !DAY.test(r.lastSeen)) return undefined
  return { name: r.name, kind: r.kind, remoteHost, firstSeen: r.firstSeen, lastSeen: r.lastSeen }
}

/**
 * Reads the registry's text. Text that is missing, not JSON or not the right shape
 * gives an empty registry (the writer rebuilds it); a record that does not check out
 * is dropped, the rest kept.
 */
export function parseProjects(text: string | undefined): ProjectsFile {
  if (text === undefined || text.trim() === '') return emptyFile()
  try {
    const raw: unknown = JSON.parse(text)
    const projects = raw !== null && typeof raw === 'object' ? (raw as { projects?: unknown }).projects : undefined
    if (projects === null || typeof projects !== 'object' || Array.isArray(projects)) return emptyFile()
    const file = emptyFile()
    for (const [owner, record] of Object.entries(projects)) {
      const clean = OWNER.test(owner) ? cleanRecord(record) : undefined
      if (clean !== undefined) file.projects[owner] = clean
    }
    return file
  } catch {
    return emptyFile()
  }
}

/**
 * What the script reads from stdin: a JSON object (or its text) that checks out as a
 * ProjectInput, else null. A remoteHost that is not a bare host (a URL, a user, a
 * port) rejects the whole record rather than being written.
 */
export function sanitizeInput(raw: unknown): ProjectInput | null {
  try {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    const r = value as Record<string, unknown>
    if (typeof r.owner !== 'string' || !OWNER.test(r.owner)) return null
    if (typeof r.name !== 'string' || r.name.trim() === '') return null
    if (r.kind !== 'repo' && r.kind !== 'folder') return null
    const remoteHost = cleanHost(r.remoteHost)
    if (remoteHost === undefined) return null
    return { owner: r.owner, name: r.name.trim().slice(0, MAX_NAME), kind: r.kind, remoteHost: r.kind === 'repo' ? remoteHost : null }
  } catch {
    return null
  }
}

/** The registry with `input` recorded as seen on `today` (a UTC date): firstSeen is kept, the rest follows the latest session. */
export function mergeProject(file: ProjectsFile, input: ProjectInput, today: string): ProjectsFile {
  const before = file.projects[input.owner]
  return {
    version: PROJECTS_VERSION,
    projects: {
      ...file.projects,
      [input.owner]: { name: input.name, kind: input.kind, remoteHost: input.remoteHost, firstSeen: before?.firstSeen ?? today, lastSeen: today },
    },
  }
}

/** The file's text: owners in order, two-space indent, a closing newline. */
export function formatProjects(file: ProjectsFile): string {
  const projects: Record<string, ProjectRecord> = {}
  for (const owner of Object.keys(file.projects).sort()) projects[owner] = file.projects[owner]!
  return `${JSON.stringify({ version: PROJECTS_VERSION, projects }, null, 2)}\n`
}
