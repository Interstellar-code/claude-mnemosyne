export interface ExactVectorSearchHit<TId> {
    id: TId;
    score: number;
}
export interface ExactVectorIndex<TId> {
    readonly ids: readonly TId[];
    readonly matrix: Float32Array;
    readonly dimensions: number;
    readonly count: number;
}
export interface VectorIndexRow<TId> {
    id: TId;
    vector: readonly number[] | null | undefined;
}
export declare function buildExactVectorIndex<TId>(rows: readonly VectorIndexRow<TId>[]): ExactVectorIndex<TId>;
export declare function searchExactVectorIndex<TId>(index: ExactVectorIndex<TId>, query: readonly number[], limit: number): ExactVectorSearchHit<TId>[];
