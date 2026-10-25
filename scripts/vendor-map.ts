// The two libraries the dashboard bundles at dev time (plan MAP.2 and SEMX.1;
// DESIGN.md, "The 3D memory map").
//
//   bun scripts/vendor-map.ts          writes ui/vendor/*.js and their companions
//   bun scripts/vendor-map.ts --check  builds in memory; exit 1 when a committed file differs
//
// Two Bun.builds, each one minified ESM file under ui/vendor/:
//   map-lib.js        the pinned devDependencies 3d-force-graph and
//                     three-spritetext (with one copy of three), which the page
//                     loads with import() the first time the Map tab opens
//   semantic-lib.js   the pinned dependency umap-js, which ui/semantic-worker.ts
//                     loads to lay the memories out by meaning
// Beside each bundle:
//   <name>.d.ts               the types of the surface the importing file uses
//   <name>.inputs.json        every package in the bundle with its version and licence,
//                             the patches applied, the size and a sha256 of the bundle
// and once for both:
//   THIRD-PARTY-NOTICES.txt   the licence text of every package in either bundle
//
// The build plugin applies PATCHES to the library sources as they load and
// fails the build when any patch does not match exactly as often as it says.
// The main one removes the style element injection of three bundled helpers
// (the page's CSP refuses inline style); their CSS is in ui/style.css. The
// scan in tests/bun/vendor-scan.spec.ts uses scan() below.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { BunPlugin } from 'bun'

export const ROOT = join(import.meta.dir, '..')
export const VENDOR = join(ROOT, 'ui', 'vendor')
export const BUNDLE = 'map-lib.js'
export const SEMANTIC_BUNDLE = 'semantic-lib.js'
const NODE_MODULES = join(ROOT, 'node_modules')

// What the page imports from the bundle: nothing else is exported.
const ENTRY = `export { default as ForceGraph3D } from '3d-force-graph'
export { default as SpriteText } from 'three-spritetext'
export {
  Scene, PerspectiveCamera, WebGLRenderer, Group, Mesh, Points, Line, LineLoop, Sprite,
  SphereGeometry, BoxGeometry, CylinderGeometry, TorusGeometry, RingGeometry, BufferGeometry, BufferAttribute,
  MeshBasicMaterial, MeshStandardMaterial, LineBasicMaterial, PointsMaterial, SpriteMaterial,
  CanvasTexture, Color, Vector2, Vector3, Raycaster, PointLight, AmbientLight,
  AdditiveBlending, NormalBlending, DoubleSide, SRGBColorSpace
} from 'three'
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
export { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
export { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
export { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
export { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
`

export type Patch = {
  id: string
  package: string
  file: string
  what: string
  find: string
  replace: string
  count: number
}

const STYLE_INJECTION = 'styleInject(css_248z);'
const NO_STYLE = '/* mnemosyne: style element injection removed (MAP.2); the CSS is in ui/style.css */'

/** Every change made to a library source as it is bundled. DESIGN.md lists each one. */
export const PATCHES: readonly Patch[] = [
  {
    id: 'no-style-3d-force-graph',
    package: '3d-force-graph',
    file: 'dist/3d-force-graph.mjs',
    what: 'removes the call that injects a <style> element (.graph-info-msg, .scene-container .clickable/.grabbable)',
    find: STYLE_INJECTION,
    replace: NO_STYLE,
    count: 1,
  },
  {
    id: 'no-style-three-render-objects',
    package: 'three-render-objects',
    file: 'dist/three-render-objects.mjs',
    what: 'removes the call that injects a <style> element (.scene-nav-info, .scene-container canvas:focus)',
    find: STYLE_INJECTION,
    replace: NO_STYLE,
    count: 1,
  },
  {
    id: 'no-style-float-tooltip',
    package: 'float-tooltip',
    file: 'dist/float-tooltip.mjs',
    what: 'removes the call that injects a <style> element (.float-tooltip-kap)',
    find: STYLE_INJECTION,
    replace: NO_STYLE,
    count: 1,
  },
  {
    id: 'tooltip-as-text',
    package: 'float-tooltip',
    file: 'dist/float-tooltip.mjs',
    what: 'a string tooltip is set as text, never parsed as HTML (a second guard: the map passes NO_TOOLTIP, so the tooltip is always empty)',
    find: 'state.tooltipEl.html(state.content);',
    replace: 'state.tooltipEl.text(state.content);',
    count: 1,
  },
  {
    id: 'no-webgpu',
    package: 'three-render-objects',
    file: 'dist/three-render-objects.mjs',
    what: "drops the import of three/webgpu (a second 2.2 MB build of three's renderers); the map never asks for WebGPU, so the WebGL renderer is always the one made",
    find: "import { WebGPURenderer } from 'three/webgpu';",
    replace: 'const WebGPURenderer = null; /* mnemosyne: three/webgpu not bundled (MAP.2) */',
    count: 1,
  },
]

// ---- The scan (tests/bun/vendor-scan.spec.ts) ----

/** The patterns the vendored code is scanned for; scan-allow.json explains every hit. */
export const SCAN_RULES: readonly { name: string; pattern: RegExp }[] = [
  { name: 'createElement style', pattern: /createElement(?:NS)?\(\s*(?:[^,()]*,\s*)?["'`]style["'`]/g },
  { name: 'styleInject', pattern: /styleInject/g },
  { name: 'setAttribute style', pattern: /setAttribute(?:NS)?\(\s*(?:[^,()]*,\s*)?["'`]style["'`]/g },
  { name: 'eval(', pattern: /(?<![\w$])eval\s*\(/g },
  { name: 'new Function', pattern: /\bnew\s+Function\b/g },
  { name: 'Function(', pattern: /(?<!\bnew\s+)(?<![\w$.])Function\s*\(/g },
  { name: 'new Worker', pattern: /\bnew\s+(?:Shared)?Worker\b/g },
  { name: 'createObjectURL', pattern: /createObjectURL/g },
  { name: 'importScripts', pattern: /importScripts/g },
  { name: 'innerHTML', pattern: /innerHTML/g },
  { name: 'fetch(', pattern: /(?<![\w$.])fetch\s*\(/g },
  { name: 'import(', pattern: /(?<![\w$.])import\s*\(/g },
]

const URL_LITERAL = /https?:\/\/[^\s"'`\\)<>]*/g

/**
 * The scan's hits in a file's text: a count per rule that matched, and one
 * `url <literal>` key per distinct http(s):// literal. Rules with no hit are left out.
 */
export function scan(text: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const { name, pattern } of SCAN_RULES) {
    const n = text.match(new RegExp(pattern.source, pattern.flags))?.length ?? 0
    if (n > 0) counts[name] = n
  }
  for (const url of text.match(URL_LITERAL) ?? []) counts[`url ${url}`] = (counts[`url ${url}`] ?? 0) + 1
  return counts
}

// ---- The bundled packages ----

export type BundledPackage = { name: string; version: string; license: string }

/** The package a bundled input path belongs to, and the folder it was read from; undefined outside node_modules. */
export function packageOf(path: string): { name: string; dir: string } | undefined {
  const parts = path.split(/[\\/]/)
  const at = parts.lastIndexOf('node_modules')
  if (at === -1 || at + 1 >= parts.length) return undefined
  const first = parts[at + 1] ?? ''
  const name = first.startsWith('@') ? `${first}/${parts[at + 2] ?? ''}` : first
  return { name, dir: parts.slice(0, at + 1 + name.split('/').length).join('/') }
}

function licenceFile(dir: string): string {
  const name = readdirSync(dir).find(file => /^licen[cs]e(\.(md|txt))?$/i.test(file))
  if (name === undefined) throw new Error(`${relative(ROOT, dir)} has no licence file`)
  return readFileSync(join(dir, name), 'utf8').trim()
}

const DTS = `// Types for ui/vendor/map-lib.js: only the surface ui/map.ts uses.
// Written by scripts/vendor-map.ts from a fixed text; do not edit by hand.
export type GraphNode = {
  id?: string | number
  x?: number
  y?: number
  z?: number
  fx?: number
  fy?: number
  fz?: number
  [key: string]: unknown
}
export type GraphLink = { source?: string | number | GraphNode; target?: string | number | GraphNode; [key: string]: unknown }
export type Coords = { x: number; y: number; z: number }
export type NodeAccessor<T> = T | ((node: GraphNode) => T)
export type LinkAccessor<T> = T | ((link: GraphLink) => T)
export interface OrbitControlsLike {
  autoRotate: boolean
  autoRotateSpeed: number
  enabled: boolean
}
export interface Object3DLike {
  position: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }
}
export interface ForceGraph3DInstance {
  graphData(data: { nodes: GraphNode[]; links: GraphLink[] }): ForceGraph3DInstance
  forceEngine(engine: 'd3' | 'ngraph'): ForceGraph3DInstance
  nodeLabel(label: NodeAccessor<string>): ForceGraph3DInstance
  linkLabel(label: LinkAccessor<string>): ForceGraph3DInstance
  nodeVal(value: NodeAccessor<number>): ForceGraph3DInstance
  nodeColor(color: NodeAccessor<string>): ForceGraph3DInstance
  nodeOpacity(opacity: number): ForceGraph3DInstance
  nodeRelSize(size: number): ForceGraph3DInstance
  nodeResolution(resolution: number): ForceGraph3DInstance
  nodeThreeObject(object: ((node: GraphNode) => Object3DLike | null | undefined) | null): ForceGraph3DInstance
  nodeThreeObjectExtend(extend: boolean): ForceGraph3DInstance
  linkColor(color: LinkAccessor<string>): ForceGraph3DInstance
  linkOpacity(opacity: number): ForceGraph3DInstance
  linkWidth(width: LinkAccessor<number>): ForceGraph3DInstance
  backgroundColor(color: string): ForceGraph3DInstance
  showNavInfo(show: boolean): ForceGraph3DInstance
  width(width: number): ForceGraph3DInstance
  height(height: number): ForceGraph3DInstance
  enableNodeDrag(enable: boolean): ForceGraph3DInstance
  cooldownTicks(ticks: number): ForceGraph3DInstance
  warmupTicks(ticks: number): ForceGraph3DInstance
  onNodeClick(callback: (node: GraphNode, event: MouseEvent) => void): ForceGraph3DInstance
  onNodeHover(callback: (node: GraphNode | null, previous: GraphNode | null) => void): ForceGraph3DInstance
  onBackgroundClick(callback: (event: MouseEvent) => void): ForceGraph3DInstance
  cameraPosition(position: Partial<Coords>, lookAt?: Coords, transitionMs?: number): ForceGraph3DInstance
  controls(): OrbitControlsLike
  pauseAnimation(): ForceGraph3DInstance
  resumeAnimation(): ForceGraph3DInstance
  _destructor(): void
}
export declare const ForceGraph3D: new (
  element: HTMLElement,
  config?: { controlType?: 'trackball' | 'orbit' | 'fly'; rendererConfig?: Record<string, unknown> },
) => ForceGraph3DInstance
export declare class SpriteText implements Object3DLike {
  constructor(text?: string, textHeight?: number, color?: string)
  text: string
  textHeight: number
  color: string
  backgroundColor: string | false
  padding: number
  borderRadius: number
  fontWeight: string
  fontFace: string
  position: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown }
}
// The three.js postprocessing passes (GDATA.2): the surface ui/map.ts adds to the scene.
export interface WebGLRendererLike {
  domElement: HTMLCanvasElement
  setSize(width: number, height: number): void
  setPixelRatio(ratio: number): void
  dispose(): void
  [key: string]: unknown
}
export interface RenderTargetLike {
  [key: string]: unknown
}
export interface PassLike {
  enabled: boolean
  render(renderer: WebGLRendererLike, writeBuffer: RenderTargetLike, readBuffer: RenderTargetLike, deltaTime?: number, maskActive?: boolean): void
  setSize(width: number, height: number): void
  dispose(): void
}
export declare class EffectComposer {
  constructor(renderer: WebGLRendererLike, renderTarget?: RenderTargetLike)
  renderToScreen: boolean
  addPass(pass: PassLike): void
  removePass(pass: PassLike): void
  insertPass(pass: PassLike, index: number): void
  setSize(width: number, height: number): void
  setPixelRatio(ratio: number): void
  render(deltaTime?: number): void
  dispose(): void
}
export declare class RenderPass implements PassLike {
  constructor(scene: unknown, camera: unknown, overrideMaterial?: unknown, clearColor?: unknown, clearAlpha?: unknown)
  enabled: boolean
  render(renderer: WebGLRendererLike, writeBuffer: RenderTargetLike, readBuffer: RenderTargetLike, deltaTime?: number, maskActive?: boolean): void
  setSize(width: number, height: number): void
  dispose(): void
}
export declare class UnrealBloomPass implements PassLike {
  constructor(resolution: { x: number; y: number }, strength?: number, radius?: number, threshold?: number)
  enabled: boolean
  strength: number
  radius: number
  threshold: number
  render(renderer: WebGLRendererLike, writeBuffer: RenderTargetLike, readBuffer: RenderTargetLike, deltaTime?: number, maskActive?: boolean): void
  setSize(width: number, height: number): void
  dispose(): void
}
export declare class Scene { constructor(...args: any[]); [key: string]: any }
export declare class PerspectiveCamera { constructor(fov?: number, aspect?: number, near?: number, far?: number); [key: string]: any }
export declare class WebGLRenderer { constructor(params?: { canvas?: HTMLCanvasElement; antialias?: boolean; [key: string]: any }); domElement: HTMLCanvasElement; setSize(width: number, height: number, updateStyle?: boolean): void; setPixelRatio(ratio: number): void; setClearColor(color: number, alpha?: number): void; dispose(): void; [key: string]: any }
export declare class Group { constructor(...args: any[]); [key: string]: any }
export declare class Mesh { constructor(geometry?: any, material?: any); [key: string]: any }
export declare class Points { constructor(geometry?: any, material?: any); [key: string]: any }
export declare class Line { constructor(geometry?: any, material?: any); [key: string]: any }
export declare class LineLoop { constructor(geometry?: any, material?: any); [key: string]: any }
export declare class Sprite { constructor(material?: any); [key: string]: any }
export declare class SphereGeometry { constructor(radius?: number, widthSegments?: number, heightSegments?: number); [key: string]: any }
export declare class BoxGeometry { constructor(...args: any[]); [key: string]: any }
export declare class CylinderGeometry { constructor(...args: any[]); [key: string]: any }
export declare class TorusGeometry { constructor(...args: any[]); [key: string]: any }
export declare class RingGeometry { constructor(...args: any[]); [key: string]: any }
export declare class BufferGeometry { constructor(); [key: string]: any; setFromPoints(points: any[]): any; setAttribute(name: string, attr: any): void }
export declare class BufferAttribute { constructor(array: any, itemSize: number); [key: string]: any }
export declare class MeshBasicMaterial { constructor(params?: any); [key: string]: any }
export declare class MeshStandardMaterial { constructor(params?: any); [key: string]: any }
export declare class LineBasicMaterial { constructor(params?: any); [key: string]: any }
export declare class PointsMaterial { constructor(params?: any); [key: string]: any }
export declare class SpriteMaterial { constructor(params?: any); [key: string]: any }
export declare class CanvasTexture { constructor(canvas: any); [key: string]: any }
export declare class Color { constructor(...args: any[]); [key: string]: any; r: number; g: number; b: number }
export declare class Vector2 { constructor(x?: number, y?: number); x: number; y: number; [key: string]: any }
export declare class Vector3 { constructor(x?: number, y?: number, z?: number); clone(): Vector3; multiplyScalar(s: number): Vector3; set(x: number, y: number, z: number): Vector3; add(v: Vector3): Vector3; [key: string]: any }
export declare class Raycaster { constructor(); [key: string]: any; setFromCamera(coords: any, camera: any): void; params: any }
export declare class PointLight { constructor(...args: any[]); [key: string]: any }
export declare class AmbientLight { constructor(...args: any[]); [key: string]: any }
export declare const AdditiveBlending: number
export declare const NormalBlending: number
export declare const DoubleSide: number
export declare const SRGBColorSpace: string
export declare class OrbitControls { constructor(camera: any, domElement: any); [key: string]: any; target: Vector3; enableDamping: boolean; autoRotateSpeed: number; minDistance: number; maxDistance: number }
export declare class OutputPass implements PassLike {
  constructor()
  enabled: boolean
  render(renderer: WebGLRendererLike, writeBuffer: RenderTargetLike, readBuffer: RenderTargetLike, deltaTime?: number, maskActive?: boolean): void
  setSize(width: number, height: number): void
  dispose(): void
}
`

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')

export type Built = {
  files: Record<string, string>
  packages: BundledPackage[]
  dirs: Map<string, Set<string>>
  bytes: number
  gzipBytes: number
}

/** The package each bundled input came from, one folder per package, and each package's version and licence. */
function bundledPackages(result: { metafile?: { inputs?: Record<string, unknown> } }): { dirs: Map<string, Set<string>>; packages: BundledPackage[] } {
  const dirs = new Map<string, Set<string>>()
  for (const input of Object.keys(result.metafile?.inputs ?? {})) {
    const at = packageOf(input)
    if (at === undefined) continue
    dirs.set(at.name, (dirs.get(at.name) ?? new Set()).add(at.dir))
  }
  const doubled = [...dirs].filter(([, found]) => found.size !== 1).map(([name]) => name)
  if (doubled.length > 0) throw new Error(`more than one copy of: ${doubled.join(', ')}`)
  const packages: BundledPackage[] = [...dirs]
    .map(([name, found]) => {
      const dir = join(ROOT, [...found][0] ?? '')
      const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { version: string; license?: string }
      return { name, version: json.version, license: json.license ?? 'see licence text' }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  return { dirs, packages }
}

/**
 * The licence a package's shipped text actually is, when that is unambiguous: two
 * packages declare one licence and ship another (umap-js declares MIT and ships
 * Apache-2.0), and a notices heading must say what the text below it is.
 */
export function licenceId(text: string, declared: string): string {
  if (/Apache License\s*\n?\s*Version 2\.0/i.test(text)) return 'Apache-2.0'
  if (/MIT License|Permission is hereby granted, free of charge/i.test(text)) return 'MIT'
  return declared
}

/** One notices document for every package of every bundle: the shared file both builds compare against. */
export function noticesFile(bundles: readonly { name: string; packages: BundledPackage[]; dirs: Map<string, Set<string>> }[]): string {
  const named = bundles.map(bundle => ({
    bundle: bundle.name,
    packages: bundle.packages.map(pkg => {
      const dir = join(ROOT, [...(bundle.dirs.get(pkg.name) ?? [])][0] ?? '')
      const text = licenceFile(dir)
      return { name: pkg.name, version: pkg.version, license: licenceId(text, pkg.license), text }
    }),
  }))
  const all = named.flatMap(entry => entry.packages)
  const seen = new Set<string>()
  return [
    'Third-party notices for the vendored libraries of the Mnemosyne dashboard',
    '',
    ...named.flatMap(entry => [
      `ui/vendor/${entry.bundle} bundles: ${entry.packages.map(pkg => `${pkg.name} ${pkg.version}`).join(', ')}`,
      '',
    ]),
    'The packages below are bundled unmodified, except for the patches listed in',
    'each bundle\'s .inputs.json and DESIGN.md. Each licence text follows its package',
    'name and version. A package in both bundles is listed once.',
    '',
    ...all
      .filter(pkg => {
        const key = `${pkg.name} ${pkg.version}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .flatMap(pkg => [`==== ${pkg.name} ${pkg.version} (${pkg.license}) ====`, '', pkg.text.trim(), '']),
  ].join('\n')
}

/** Builds the bundle and its companions in memory. Throws when a patch misses, three is not single, or a licence is missing. */
export async function buildMapLib(): Promise<Built> {
  const applied = new Map<string, number>()
  const removedCss: Record<string, string> = {}
  const patchPlugin: BunPlugin = {
    name: 'mnemosyne-map-patches',
    setup(build) {
      build.onLoad({ filter: /[\\/]node_modules[\\/](?:3d-force-graph|three-render-objects|float-tooltip)[\\/]dist[\\/][^\\/]+\.mjs$/ }, args => {
        let text = readFileSync(args.path, 'utf8')
        const where = packageOf(args.path)
        const file = relative(where?.dir ?? '', args.path).split(sep).join('/')
        for (const patch of PATCHES.filter(p => p.package === where?.name && p.file === file)) {
          const found = text.split(patch.find).length - 1
          if (found !== patch.count) throw new Error(`patch ${patch.id}: found ${found} times in ${patch.package}/${patch.file}, expected ${patch.count}`)
          if (patch.find === STYLE_INJECTION) {
            const css = /var css_248z = ("(?:[^"\\]|\\.)*");/.exec(text)?.[1]
            if (css === undefined) throw new Error(`patch ${patch.id}: no css_248z string in ${patch.package}/${patch.file}`)
            removedCss[patch.id] = JSON.parse(css) as string
          }
          text = text.split(patch.find).join(patch.replace)
          applied.set(patch.id, found)
        }
        return { contents: text, loader: 'js' }
      })
    },
  }
  const entry = join(ROOT, 'scripts', 'map-lib-entry.ts')
  const result = await Bun.build({
    entrypoints: [entry],
    files: { [entry]: ENTRY },
    target: 'browser',
    format: 'esm',
    minify: true,
    metafile: true,
    plugins: [patchPlugin],
  })
  const output = result.outputs[0]
  if (!result.success || output === undefined || result.outputs.length !== 1) {
    throw new Error(`the map library did not build: ${result.logs.map(log => String(log)).join('\n')}`)
  }
  const missed = PATCHES.filter(patch => applied.get(patch.id) !== patch.count)
  if (missed.length > 0) throw new Error(`patches not applied: ${missed.map(p => p.id).join(', ')}`)

  // Every input's package, from the folder it was read from: one folder per package.
  const inputs = Object.keys(result.metafile?.inputs ?? {})
  const { dirs, packages } = bundledPackages(result)
  // One copy of three: its ESM build only (three.core.js once), never its CommonJS or WebGPU builds.
  const threeFiles = inputs.filter(input => packageOf(input)?.name === 'three').map(input => input.split(/[\\/]/).slice(-2).join('/'))
  if (threeFiles.filter(file => file === 'build/three.core.js').length !== 1 || threeFiles.some(file => /three\.(cjs|webgpu|tsl)/.test(file))) {
    throw new Error(`three is not bundled once: ${threeFiles.join(', ')}`)
  }

  const js = await output.text()
  const header = '/* ui/vendor/map-lib.js: 3d-force-graph and three-spritetext with three, built by scripts/vendor-map.ts. Do not edit; see map-lib.inputs.json and THIRD-PARTY-NOTICES.txt. */\n'
  const bundle = header + js
  const bytes = Buffer.byteLength(bundle)
  const gzipBytes = Bun.gzipSync(new TextEncoder().encode(bundle)).byteLength
  const meta = {
    bundle: BUNDLE,
    built_by: 'scripts/vendor-map.ts',
    bytes,
    gzip_bytes: gzipBytes,
    sha256: sha256(bundle),
    exports: ['ForceGraph3D', 'SpriteText', 'Scene', 'PerspectiveCamera', 'WebGLRenderer', 'Group', 'Mesh', 'Points', 'Line', 'LineLoop', 'Sprite', 'SphereGeometry', 'BoxGeometry', 'CylinderGeometry', 'TorusGeometry', 'RingGeometry', 'BufferGeometry', 'BufferAttribute', 'MeshBasicMaterial', 'MeshStandardMaterial', 'LineBasicMaterial', 'PointsMaterial', 'SpriteMaterial', 'CanvasTexture', 'Color', 'Vector2', 'Vector3', 'Raycaster', 'PointLight', 'AmbientLight', 'AdditiveBlending', 'NormalBlending', 'DoubleSide', 'SRGBColorSpace', 'OrbitControls', 'EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass'],
    packages,
    patches: PATCHES.map(({ id, package: pkg, file, what, find, replace, count }) => ({
      id,
      package: pkg,
      file,
      what,
      find,
      replace,
      count,
      ...(removedCss[id] !== undefined ? { css: removedCss[id] } : {}),
    })),
  }
  return {
    files: {
      [BUNDLE]: bundle,
      'map-lib.d.ts': DTS,
      'map-lib.inputs.json': `${JSON.stringify(meta, null, 2)}\n`,
    },
    packages,
    dirs,
    bytes,
    gzipBytes,
  }
}

const SEMANTIC_ENTRY = `export { UMAP } from 'umap-js'
`

// Types for ui/vendor/semantic-lib.js: only the surface ui/semantic-worker.ts uses
// (umap-js's own dist/index.d.ts, plus the cosine distance function).
const SEMANTIC_DTS = `// Types for ui/vendor/semantic-lib.js: only the surface ui/semantic-worker.ts uses.
// Written by scripts/vendor-map.ts from a fixed text; do not edit by hand.
export type Vector = number[]
export type Vectors = Vector[]
export type RandomFn = () => number
export type DistanceFn = (x: Vector, y: Vector) => number
export interface UMAPParameters {
  distanceFn?: DistanceFn
  learningRate?: number
  localConnectivity?: number
  minDist?: number
  nComponents?: number
  nEpochs?: number
  nNeighbors?: number
  negativeSampleRate?: number
  repulsionStrength?: number
  random?: RandomFn
  setOpMixRatio?: number
  spread?: number
  transformQueueSize?: number
}
export declare class UMAP {
  constructor(params?: UMAPParameters)
  fit(X: Vectors): number[][]
  fitAsync(X: Vectors, callback?: (epochNumber: number) => void | boolean): Promise<number[][]>
  initializeFit(X: Vectors): number
  step(): number
  getEmbedding(): number[][]
}
`

/** Builds ui/vendor/semantic-lib.js and its companions in memory: umap-js, unpatched. */
export async function buildSemanticLib(): Promise<Built> {
  const entry = join(ROOT, 'scripts', 'semantic-lib-entry.ts')
  const result = await Bun.build({
    entrypoints: [entry],
    files: { [entry]: SEMANTIC_ENTRY },
    target: 'browser',
    format: 'esm',
    minify: true,
    metafile: true,
  })
  const output = result.outputs[0]
  if (!result.success || output === undefined || result.outputs.length !== 1) {
    throw new Error(`the semantic library did not build: ${result.logs.map(log => String(log)).join('\n')}`)
  }
  const { dirs, packages } = bundledPackages(result)
  const js = await output.text()
  const header = '/* ui/vendor/semantic-lib.js: umap-js, built by scripts/vendor-map.ts. Do not edit; see semantic-lib.inputs.json and THIRD-PARTY-NOTICES.txt. */\n'
  const bundle = header + js
  const bytes = Buffer.byteLength(bundle)
  const gzipBytes = Bun.gzipSync(new TextEncoder().encode(bundle)).byteLength
  const meta = {
    bundle: SEMANTIC_BUNDLE,
    built_by: 'scripts/vendor-map.ts',
    bytes,
    gzip_bytes: gzipBytes,
    sha256: sha256(bundle),
    exports: ['UMAP'],
    packages,
    patches: [],
  }
  return {
    files: {
      [SEMANTIC_BUNDLE]: bundle,
      'semantic-lib.d.ts': SEMANTIC_DTS,
      'semantic-lib.inputs.json': `${JSON.stringify(meta, null, 2)}\n`,
    },
    packages,
    dirs,
    bytes,
    gzipBytes,
  }
}

async function main() {
  const check = process.argv.includes('--check')
  if (!existsSync(join(NODE_MODULES, '3d-force-graph'))) throw new Error('run bun install first: 3d-force-graph is a devDependency')
  if (!existsSync(join(NODE_MODULES, 'umap-js'))) throw new Error('run bun install first: umap-js is a dependency')
  const map = await buildMapLib()
  const semantic = await buildSemanticLib()
  const built: Built = {
    files: {
      ...map.files,
      ...semantic.files,
      'THIRD-PARTY-NOTICES.txt': noticesFile([
        { name: BUNDLE, packages: map.packages, dirs: map.dirs },
        { name: SEMANTIC_BUNDLE, packages: semantic.packages, dirs: semantic.dirs },
      ]),
    },
    packages: [...map.packages],
    dirs: new Map([...map.dirs, ...semantic.dirs]),
    bytes: map.bytes + semantic.bytes,
    gzipBytes: map.gzipBytes + semantic.gzipBytes,
  }
  if (check) {
    const stale = Object.entries(built.files)
      .filter(([name, text]) => !existsSync(join(VENDOR, name)) || readFileSync(join(VENDOR, name), 'utf8') !== text)
      .map(([name]) => name)
    if (stale.length > 0) {
      process.stderr.write(`ui/vendor/ differs from a fresh build: ${stale.join(', ')}\n`)
      process.exit(1)
    }
    process.stdout.write(
      `ui/vendor/ matches a fresh build (${map.bytes} + ${semantic.bytes} bytes, ${map.packages.length} + ${semantic.packages.length} packages)\n`,
    )
    return
  }
  mkdirSync(VENDOR, { recursive: true })
  for (const [name, text] of Object.entries(built.files)) writeFileSync(join(VENDOR, name), text)
  for (const one of [map, semantic]) {
    process.stdout.write(
      `${relative(ROOT, join(VENDOR, one === map ? BUNDLE : SEMANTIC_BUNDLE))}: ${one.bytes} bytes (${(one.bytes / 1024).toFixed(1)} KB), ${one.gzipBytes} gzipped; ${one.packages.length} packages\n`,
    )
    for (const pkg of one.packages) process.stdout.write(`  ${pkg.name} ${pkg.version} ${pkg.license}\n`)
    const name = one === map ? BUNDLE : SEMANTIC_BUNDLE
    process.stdout.write(`scan ${name}: ${JSON.stringify(scan(one.files[name] ?? ''), null, 2)}\n`)
  }
}

if (import.meta.main) {
  main().catch(err => {
    process.stderr.write(`vendor-map: ${(err as Error).message}\n`)
    process.exit(1)
  })
}

