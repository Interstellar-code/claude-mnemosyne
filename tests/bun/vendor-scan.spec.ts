// MAP.2: the vendored 3D library. The scan of every ui/vendor/*.js against the
// reviewed allowlist, the notices for every bundled package, the patches and
// the CSS they moved, the pins and the single copy of three, and how the real
// files are served (type, CSP, no path escape, nothing loaded until the Map tab).
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PATCHES, SCAN_RULES, scan } from '../../scripts/vendor-map'
import { buildApp, CSP, startServer } from '../../ui/server'
import { ROOT, tempDir } from './helpers'

const VENDOR = join(ROOT, 'ui', 'vendor')
const read = (name: string) => readFileSync(join(VENDOR, name), 'utf8')

type Allow = { files: Record<string, Record<string, { count: number; why: string }>> }
type Inputs = {
  bundle: string
  bytes: number
  sha256: string
  exports?: string[]
  packages: { name: string; version: string; license: string }[]
  patches: { id: string; package: string; file: string; find: string; replace: string; count: number; css?: string }[]
}

const vendorJs = () => readdirSync(VENDOR).filter(name => name.endsWith('.js'))
const inputs = () => JSON.parse(read('map-lib.inputs.json')) as Inputs
const semanticInputs = () => JSON.parse(read('semantic-lib.inputs.json')) as Inputs

/** Each file's scan hits that differ from the allowlist: a hit not listed, a listed hit not found, or a count that moved. */
export function scanDiff(files: Record<string, string>, allow: Allow): string[] {
  const out: string[] = []
  for (const [name, text] of Object.entries(files)) {
    const found = scan(text)
    const allowed = allow.files[name]
    if (allowed === undefined) {
      out.push(`${name}: not in scan-allow.json`)
      continue
    }
    for (const key of new Set([...Object.keys(found), ...Object.keys(allowed)])) {
      const want = allowed[key]?.count ?? 0
      const got = found[key] ?? 0
      if (want !== got) out.push(`${name}: ${key}: found ${got}, allowed ${want}`)
    }
  }
  return out
}

/** Packages of map-lib.inputs.json whose name, version and licence text are not in the notices. */
export function missingNotices(packages: Inputs['packages'], notices: string): string[] {
  const blocks = notices.split(/^==== /m).slice(1)
  return packages
    .filter(pkg => {
      const block = blocks.find(text => text.startsWith(`${pkg.name} ${pkg.version} `))
      // A heading alone is not a notice: the licence text must follow it.
      return block === undefined || block.split('\n').slice(1).join('\n').trim().length < 100
    })
    .map(pkg => `${pkg.name} ${pkg.version}`)
}

describe('MAP.2.a4: the vendored code scan', () => {
  const allow = JSON.parse(read('scan-allow.json')) as Allow

  test('every ui/vendor/*.js file has exactly the allowlisted hits', () => {
    const files = Object.fromEntries(vendorJs().map(name => [name, read(name)]))
    expect(Object.keys(files)).toContain('map-lib.js')
    expect(scanDiff(files, allow)).toEqual([])
  })

  test('every allowlist entry says why the hit is inert, and names a file that exists', () => {
    for (const [file, entries] of Object.entries(allow.files)) {
      expect(vendorJs()).toContain(file)
      for (const [key, entry] of Object.entries(entries)) {
        expect({ key, count: entry.count > 0, why: entry.why.length > 40 }).toEqual({ key, count: true, why: true })
      }
    }
  })

  test('the bundle holds no style element injection, eval, Worker, object URL or importScripts at all', () => {
    const hits = scan(read('map-lib.js'))
    for (const rule of ['createElement style', 'styleInject', 'setAttribute style', 'eval(', 'new Function', 'new Worker', 'createObjectURL', 'importScripts', 'import(']) {
      expect({ rule, hits: hits[rule] ?? 0 }).toEqual({ rule, hits: 0 })
    }
  })

  test('the scan catches each pattern, and a new hit or a moved count fails the allowlist check', () => {
    const samples: Record<string, string> = {
      'createElement style': "document.createElement('style')",
      styleInject: 'styleInject(css)',
      'setAttribute style': 'el.setAttribute("style", x)',
      'eval(': 'eval(code)',
      'new Function': 'new Function("return 1")',
      'Function(': 'Function("return this")()',
      'new Worker': 'new Worker(url)',
      createObjectURL: 'URL.createObjectURL(blob)',
      importScripts: 'importScripts(x)',
      innerHTML: 'a.innerHTML = b',
      'fetch(': 'fetch(url)',
      'import(': 'import("./x.js")',
    }
    expect(Object.keys(samples).sort()).toEqual(SCAN_RULES.map(rule => rule.name).sort())
    for (const [rule, sample] of Object.entries(samples)) expect({ rule, hit: (scan(sample)[rule] ?? 0) > 0 }).toEqual({ rule, hit: true })
    // `new Function(` counts once, as new Function, not again as Function(.
    expect(scan('new Function(x)')).toEqual({ 'new Function': 1 })
    expect(scan('x.Function(1); myFunction(2); evaluate(3); a.fetch(1); refetch(2); x.import(3)')).toEqual({})
    expect(scan('fetch("https://evil.example/x")')).toEqual({ 'fetch(': 1, 'url https://evil.example/x': 1 })
    const text = read('map-lib.js')
    expect(scanDiff({ 'map-lib.js': `${text};eval(1)` }, allow)).toEqual(['map-lib.js: eval(: found 1, allowed 0'])
    expect(scanDiff({ 'map-lib.js': `${text};"http://w.example"` }, allow)).toEqual(['map-lib.js: url http://w.example: found 1, allowed 0'])
    expect(scanDiff({ 'other.js': '' }, allow)).toEqual(['other.js: not in scan-allow.json'])
  })
})

describe('MAP.2.a3: notices cover every bundled package', () => {
  test('THIRD-PARTY-NOTICES.txt holds the version and licence text of each package in map-lib.inputs.json', () => {
    const notices = read('THIRD-PARTY-NOTICES.txt')
    const { packages } = inputs()
    expect(packages.map(pkg => pkg.name)).toEqual(expect.arrayContaining(['3d-force-graph', 'three', 'three-spritetext', 'd3-force-3d', 'three-forcegraph', 'three-render-objects']))
    expect(missingNotices(packages, notices)).toEqual([])
  })

  test('the check fails when a notice is missing or has no licence text', () => {
    const notices = read('THIRD-PARTY-NOTICES.txt')
    const { packages } = inputs()
    const three = packages.find(pkg => pkg.name === 'three')!
    const without = notices.replace(`==== three ${three.version} `, '==== removed ')
    expect(missingNotices(packages, without)).toEqual([`three ${three.version}`])
    expect(missingNotices([...packages, { name: 'left-pad', version: '1.0.0', license: 'MIT' }], notices)).toEqual(['left-pad 1.0.0'])
    expect(missingNotices([{ name: 'a', version: '1.0.0', license: 'MIT' }], '==== a 1.0.0 (MIT) ====\n\n')).toEqual(['a 1.0.0'])
  })
})

describe('MAP.2.a1 and a2: pins, one copy of three, the patches and their CSS', () => {
  test('package.json pins 3d-force-graph, three and three-spritetext exactly, as devDependencies, and umap-js as a dependency', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies: Record<string, string> }
    // SEMX.1: the one runtime dependency is the meaning layout's library, pinned exactly.
    expect(pkg.dependencies).toEqual({ 'umap-js': '1.4.0' })
    expect(pkg.dependencies?.['umap-js']).toMatch(/^\d+\.\d+\.\d+$/)
    for (const name of ['3d-force-graph', 'three', 'three-spritetext']) expect(pkg.devDependencies[name]).toMatch(/^\d+\.\d+\.\d+$/)
    // The bundle was built from exactly those versions.
    const { packages } = inputs()
    for (const name of ['3d-force-graph', 'three', 'three-spritetext']) expect(packages.find(p => p.name === name)?.version).toBe(pkg.devDependencies[name]!)
    expect(semanticInputs().packages.find(p => p.name === 'umap-js')?.version).toBe(pkg.dependencies?.['umap-js'])
  })

  test('map-lib.js is one ESM file with one copy of three, and its sha256 and size are recorded', () => {
    const text = read('map-lib.js')
    const meta = inputs()
    expect(Buffer.byteLength(text)).toBe(meta.bytes)
    expect(new Bun.CryptoHasher('sha256').update(text).digest('hex')).toBe(meta.sha256)
    expect(text).toMatch(/export\s*\{[^}]*\bForceGraph3D\b[^}]*\}/)
    expect(text).not.toMatch(/\brequire\(\s*["']three["']\)/)
    expect(meta.packages.filter(pkg => pkg.name === 'three')).toHaveLength(1)
    // Each copy of three's core registers itself once as window.__THREE__: one copy, one registration.
    expect(text.match(/__THREE__\s*=/g)).toHaveLength(1)
  })

  test('the five patches, by name, are each applied and recorded', () => {
    const wanted = ['no-style-3d-force-graph', 'no-style-three-render-objects', 'no-style-float-tooltip', 'tooltip-as-text', 'no-webgpu']
    expect(PATCHES.map(patch => patch.id)).toEqual(wanted)
    expect(inputs().patches.map(patch => patch.id)).toEqual(wanted)
    const text = read('map-lib.js')
    // tooltip-as-text: no d3 selection's .html() call is left in the bundle (float-tooltip's was its only one).
    expect(text.match(/\.html\(/g)).toBeNull()
    // no-webgpu: no WebGPU renderer is bundled.
    expect(text).not.toContain('isWebGPURenderer')
  })

  test('every patch is recorded with its package and file; the style patches carry the CSS, which is in style.css', () => {
    const meta = inputs()
    expect(meta.patches.map(patch => patch.id)).toEqual(PATCHES.map(patch => patch.id))
    const style = readFileSync(join(ROOT, 'ui', 'style.css'), 'utf8')
    const styled = meta.patches.filter(patch => patch.id.startsWith('no-style-'))
    expect(styled.map(patch => patch.package).sort()).toEqual(['3d-force-graph', 'float-tooltip', 'three-render-objects'])
    for (const patch of styled) {
      expect(patch.css).toBeDefined()
      const selectors = [...(patch.css ?? '').matchAll(/([^{}]+)\{/g)].map(match => match[1]!.trim())
      expect(selectors.length).toBeGreaterThan(0)
      for (const selector of selectors) expect({ selector, inStyle: style.includes(`${selector} {`) }).toEqual({ selector, inStyle: true })
    }
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8')
    for (const patch of meta.patches) expect({ id: patch.id, listed: design.includes(patch.id) }).toEqual({ id: patch.id, listed: true })
  })

  test('the type declarations exist and declare the two exports', () => {
    const dts = read('map-lib.d.ts')
    expect(dts).toContain('export declare const ForceGraph3D')
    expect(dts).toContain('export declare class SpriteText')
  })

  test('GDATA.2.a1 and a2: the bundle exports the bloom passes, typed in map-lib.d.ts', () => {
    const text = read('map-lib.js')
    for (const name of ['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass']) {
      expect({ name, exported: new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(text) || new RegExp(`\\b${name}\\s+as\\s+${name}\\b`).test(text) }).toEqual({ name, exported: true })
    }
    const dts = read('map-lib.d.ts')
    for (const name of ['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass']) {
      expect({ name, typed: new RegExp(`export declare class ${name}\\b`).test(dts) }).toEqual({ name, typed: true })
    }
    // The bloom passes are three's own, from the one copy already in the bundle.
    expect(inputs().packages.filter(pkg => pkg.name === 'three')).toHaveLength(1)
    expect(inputs().exports).toEqual(expect.arrayContaining(['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass']))
  })
})

describe('SEMX.1.a3: the second bundle, semantic-lib.js', () => {
  test('the scan finds nothing in it, and the allowlist records it explicitly', () => {
    // The one vendored file with no hits at all: umap-js and its three dependencies are plain arithmetic.
    expect(scan(read('semantic-lib.js'))).toEqual({})
    const allow = JSON.parse(read('scan-allow.json')) as Allow
    expect(allow.files['semantic-lib.js']).toEqual({})
  })

  test('it is one ESM file exporting UMAP, with its size and sha256 recorded', () => {
    const text = read('semantic-lib.js')
    const meta = semanticInputs()
    expect(meta.bundle).toBe('semantic-lib.js')
    expect(meta.exports).toEqual(['UMAP'])
    expect(meta.patches).toEqual([])
    expect(Buffer.byteLength(text)).toBe(meta.bytes)
    expect(new Bun.CryptoHasher('sha256').update(text).digest('hex')).toBe(meta.sha256)
    expect(text).toMatch(/export\s*\{[^}]*\bUMAP\b[^}]*\}/)
  })

  test('the packages it bundles are umap-js and its arithmetic dependencies, each with a notice', () => {
    const { packages } = semanticInputs()
    expect(packages.map(pkg => pkg.name)).toEqual(['is-any-array', 'ml-levenberg-marquardt', 'ml-matrix', 'umap-js'])
    expect(missingNotices(packages, read('THIRD-PARTY-NOTICES.txt'))).toEqual([])
    // umap-js declares MIT and ships the Apache-2.0 text: the heading names the text, not the field.
    expect(read('THIRD-PARTY-NOTICES.txt')).toContain('==== umap-js 1.4.0 (Apache-2.0) ====')
  })

  test('its type declarations cover the surface ui/semantic-worker.ts uses', () => {
    const dts = read('semantic-lib.d.ts')
    expect(dts).toContain('export declare class UMAP')
    for (const member of ['fit(', 'fitAsync(', 'getEmbedding(']) expect({ member, typed: dts.includes(member) }).toEqual({ member, typed: true })
    const worker = readFileSync(join(ROOT, 'ui', 'semantic-worker.ts'), 'utf8')
    expect(worker).toContain("from './vendor/semantic-lib.js'")
  })

  test('the notices cover both bundles in one file, and a package in both is listed once', () => {
    const notices = read('THIRD-PARTY-NOTICES.txt')
    expect(missingNotices(inputs().packages, notices)).toEqual([])
    for (const name of ['map-lib.js', 'semantic-lib.js']) expect({ name, named: notices.includes(`ui/vendor/${name} bundles:`) }).toEqual({ name, named: true })
  })
})

describe('MAP.2.a6: the page and the vendored files as the server sends them', () => {
  const temp = tempDir('vendor-serve')
  let stop = () => {}
  let port = 0

  beforeAll(async () => {
    const started = await startServer({ root: join(temp.dir, 'root'), store: join(temp.dir, 'store'), cli: '', activityLog: '', pluginRoot: ROOT })
    stop = started.stop
    port = started.port
  })
  afterAll(() => {
    stop()
    temp.dispose()
  })

  test('index.html has only same-origin src and href', () => {
    const html = readFileSync(join(ROOT, 'ui', 'index.html'), 'utf8')
    const refs = [...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']*)["']/gi)].map(match => match[1]!)
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) expect({ ref, sameOrigin: /^\/(?!\/)/.test(ref) }).toEqual({ ref, sameOrigin: true })
    expect(html).not.toMatch(/https?:\/\/|\/\/[a-z]/i)
    expect(html).not.toContain('/vendor/')
  })

  test('app.js and every vendor .js are text/javascript with the strict CSP', async () => {
    for (const path of ['/app.js', ...vendorJs().map(name => `/vendor/${name}`)]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`)
      expect({ path, status: response.status }).toEqual({ path, status: 200 })
      expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8')
      expect(response.headers.get('content-security-policy')).toBe(CSP)
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(CSP).not.toContain('unsafe-')
      await response.arrayBuffer()
    }
    const lib = await (await fetch(`http://127.0.0.1:${port}/vendor/map-lib.js`)).text()
    expect(lib).toBe(read('map-lib.js'))
    // SEMX.1: the meaning layout's bundle goes out the same way.
    const semantic = await (await fetch(`http://127.0.0.1:${port}/vendor/semantic-lib.js`)).text()
    expect(semantic).toBe(read('semantic-lib.js'))
  })

  test('/vendor/../server.ts and /vendor/..%2fserver.ts are 404', async () => {
    const { connect } = await import('node:net')
    // Only .js is served from ui/vendor/: its types, inputs list, notices and allowlist are 404.
    for (const path of [
      '/vendor/../server.ts',
      '/vendor/..%2fserver.ts',
      '/vendor/map-lib.d.ts',
      '/vendor/map-lib.inputs.json',
      '/vendor/THIRD-PARTY-NOTICES.txt',
      '/vendor/scan-allow.json',
      '/vendor/semantic-lib.d.ts',
      '/vendor/semantic-lib.inputs.json',
    ]) {
      // Raw bytes, so no client folds the dot segments first.
      const status = await new Promise<number>((resolve, reject) => {
        const socket = connect(port, '127.0.0.1')
        let data = ''
        socket.setEncoding('utf8')
        socket.on('data', chunk => {
          data += chunk
        })
        socket.on('error', reject)
        socket.on('end', () => resolve(Number(data.split(' ')[1])))
        socket.write(`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`)
      })
      expect({ path, status }).toEqual({ path, status: 404 })
    }
  })

  test('the page asks for /vendor/ only through import() in the map, reached only when the Map tab opens', async () => {
    const app = await buildApp()
    // No static import of anything: the page is one file until the Map tab asks for its library.
    expect(app).not.toMatch(/(?:^|[;\n}])\s*import\s*(?:[\w${},*\s]+from\s*)?["']/)
    expect(app.match(/\/vendor\//g)).toHaveLength(1)
    expect(app).toMatch(/import\(\w+\)/)
    const source = readFileSync(join(ROOT, 'ui', 'app.ts'), 'utf8')
    const calls = source.split('\n').filter(line => line.includes('createMap('))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatch(/if \(view === 'map'\) map = createMap\(/)
    const map = readFileSync(join(ROOT, 'ui', 'map.ts'), 'utf8')
    expect(map.match(/await import\(LIB_URL\)/g)).toHaveLength(1)
    expect(map).toContain("const LIB_URL = '/vendor/map-lib.js'")
  })
})
