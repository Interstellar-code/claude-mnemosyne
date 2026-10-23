// Types for ui/vendor/semantic-lib.js: only the surface ui/semantic-worker.ts uses.
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
