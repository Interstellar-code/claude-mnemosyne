// Types for ui/vendor/map-lib.js: only the surface ui/map.ts uses.
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
export declare class OutputPass implements PassLike {
  constructor()
  enabled: boolean
  render(renderer: WebGLRendererLike, writeBuffer: RenderTargetLike, readBuffer: RenderTargetLike, deltaTime?: number, maskActive?: boolean): void
  setSize(width: number, height: number): void
  dispose(): void
}
