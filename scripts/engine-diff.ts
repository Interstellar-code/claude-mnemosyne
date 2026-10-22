// Proves engine/ is the upstream pi-mnemopi tarball plus only the changes
// engine/UPSTREAM.md lists, and that the engine/src hash recorded there for
// the current build is the real one.
//
//   bun scripts/engine-diff.ts
//
// It downloads the tarball named in UPSTREAM.md, checks its sha512 integrity,
// and compares every file with engine/ (node_modules/, test/, UPSTREAM.md and
// bun.lock aside). Exit 0 only when every differing file is named on a
// "Files:" line of the change list and the hash matches; exit 1 otherwise.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = join(import.meta.dir, '..')
const ENGINE = join(ROOT, 'engine')
const IGNORED = (path: string) =>
  path === 'UPSTREAM.md' || path === 'bun.lock' || path.startsWith('node_modules/') || path.startsWith('test/')

/** Every file under `dir`, as forward-slash paths relative to `base`. */
export function walk(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path, base)
    return entry.isFile() ? [relative(base, path).split(sep).join('/')] : []
  })
}

/**
 * The engine/src hash: sha256 over the sorted lines `<path>\0<sha256 of file>\n`,
 * paths relative to src/. UPSTREAM.md records one per build.
 */
export function sourceHash(src: string) {
  const hash = createHash('sha256')
  for (const path of walk(src).sort()) {
    hash.update(`${path}\0${createHash('sha256').update(readFileSync(join(src, path))).digest('hex')}\n`)
  }
  return hash.digest('hex')
}

/** The files of a gzipped npm tarball, `package/` prefix removed (ustar, with pax path records). */
export function untar(gz: Uint8Array<ArrayBuffer>) {
  const tar = Bun.gunzipSync(gz)
  const files = new Map<string, Uint8Array>()
  const text = (from: number, length: number) => {
    const bytes = tar.subarray(from, from + length)
    const end = bytes.indexOf(0)
    return new TextDecoder().decode(end < 0 ? bytes : bytes.subarray(0, end))
  }
  let offset = 0
  let paxPath: string | undefined
  while (offset + 512 <= tar.length) {
    const name = text(offset, 100)
    if (!name) break
    const size = Number.parseInt(text(offset + 124, 12).trim() || '0', 8)
    const type = text(offset + 156, 1) || '0'
    const prefix = text(offset + 345, 155)
    const body = tar.subarray(offset + 512, offset + 512 + size)
    if (type === 'x') {
      const match = /\d+ path=([^\n]*)\n/.exec(new TextDecoder().decode(body))
      paxPath = match?.[1]
    } else {
      const path = paxPath ?? (prefix ? `${prefix}/${name}` : name)
      paxPath = undefined
      if (type === '0') files.set(path.replace(/^package\//, ''), body)
    }
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return files
}

/** What UPSTREAM.md declares: tarball, integrity, the files of the change list, the hash per build. */
export function readRegistry(text: string) {
  const tarball = /https:\/\/registry\.npmjs\.org\/\S+?\.tgz/.exec(text)?.[0]
  const integrity = /sha512-[A-Za-z0-9+/]+=*/.exec(text)?.[0]
  const changed = new Set<string>()
  for (const line of text.split('\n')) {
    if (!/^\s*[-*]?\s*Files:/.test(line)) continue
    for (const match of line.matchAll(/`([^`]+)`/g)) changed.add(match[1]!.replace(/^engine\//, ''))
  }
  const builds = new Map<string, string>()
  for (const match of text.matchAll(/^\|\s*([0-9][^|\s]*)\s*\|\s*`?([0-9a-f]{64})`?\s*\|/gm)) builds.set(match[1]!, match[2]!)
  return { tarball, integrity, changed, builds }
}

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((byte, i) => byte === b[i])

if (import.meta.main) {
  const problems: string[] = []
  const registry = readRegistry(readFileSync(join(ENGINE, 'UPSTREAM.md'), 'utf8'))
  if (!registry.tarball || !registry.integrity) {
    console.error('engine-diff: UPSTREAM.md names no tarball URL or sha512 integrity')
    process.exit(1)
  }

  const response = await fetch(registry.tarball)
  if (!response.ok) {
    console.error(`engine-diff: download failed: ${response.status} ${registry.tarball}`)
    process.exit(1)
  }
  const gz = new Uint8Array(await response.arrayBuffer())
  const integrity = `sha512-${createHash('sha512').update(gz).digest('base64')}`
  if (integrity !== registry.integrity) {
    console.error(`engine-diff: tarball integrity ${integrity} is not the recorded ${registry.integrity}`)
    process.exit(1)
  }

  const upstream = untar(gz)
  const local = new Set(walk(ENGINE).filter(path => !IGNORED(path)))
  const differing: string[] = []
  for (const [path, bytes] of upstream) {
    if (IGNORED(path)) continue
    if (!local.has(path)) differing.push(`${path} (removed)`)
    else if (!same(bytes, new Uint8Array(readFileSync(join(ENGINE, path))))) differing.push(path)
  }
  for (const path of local) if (!upstream.has(path)) differing.push(`${path} (added)`)

  for (const entry of differing) {
    const path = entry.replace(/ \((added|removed)\)$/, '')
    if (!registry.changed.has(path)) problems.push(`${entry} differs from the tarball but no change in UPSTREAM.md lists it`)
  }
  for (const path of registry.changed) {
    if (!differing.some(entry => entry.replace(/ \((added|removed)\)$/, '') === path) && !IGNORED(path)) {
      console.log(`note: ${path} is listed in UPSTREAM.md but matches the tarball`)
    }
  }

  const version = JSON.parse(readFileSync(join(ENGINE, 'package.json'), 'utf8')).version as string
  const recorded = registry.builds.get(version)
  const actual = sourceHash(join(ENGINE, 'src'))
  if (!recorded) problems.push(`UPSTREAM.md records no engine/src hash for build ${version} (actual ${actual})`)
  else if (recorded !== actual) problems.push(`engine/src hash for build ${version} is ${actual}, UPSTREAM.md records ${recorded}: bump the build and record the new hash`)

  if (statSync(join(ENGINE, 'LICENSE')).size === 0) problems.push('engine/LICENSE is empty')

  for (const problem of problems) console.error(`engine-diff: ${problem}`)
  if (problems.length > 0) process.exit(1)
  console.log(
    `engine-diff: ok — build ${version}, ${differing.length} changed file(s), all listed; engine/src sha256 ${actual}; tarball ${integrity.slice(0, 20)}…`,
  )
}
