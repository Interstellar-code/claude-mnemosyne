import type { Database } from "bun:sqlite";
import { type VecType } from "../config.js";
import { type DatabasePath } from "../db.js";
export { cosineSimilarity } from "./vector-math.js";
export declare const BITS_PER_BYTE = 8;
export declare const EMBEDDING_DIM: number;
export declare const BYTES_PER_VECTOR: number;
export interface BinaryVectorSearchResult {
    memory_id: string;
    distance: number;
    score: number;
}
export interface BinaryVectorStats {
    total_vectors: number;
    avg_bytes_per_vector: number;
    max_bytes: number;
    min_bytes: number;
    compression_ratio: number;
    theoretical_size_mb: number;
}
export interface BinaryVectorStoreOptions {
    dbPath?: DatabasePath;
    tableName?: string;
    conn?: Database;
}
export declare function getVecType(env?: NodeJS.ProcessEnv): VecType;
export declare const VEC_TYPE: VecType;
export declare function quantizeInt8(embedding: readonly number[]): Int8Array;
export declare function maximallyInformativeBinarization(embedding: readonly number[]): Uint8Array;
export declare function hammingDistance(binaryA: Uint8Array | ArrayBuffer, binaryB: Uint8Array | ArrayBuffer): number;
export declare function informationTheoreticScore(distance: number, dim?: number): number;
export declare class BinaryVectorStore {
    readonly conn: Database;
    readonly dbPath: DatabasePath;
    readonly tableName: string;
    private readonly ownsConnection;
    constructor(options?: BinaryVectorStoreOptions);
    private initTable;
    static maximallyInformativeBinarization(embedding: readonly number[]): Uint8Array;
    static hammingDistance(binaryA: Uint8Array | ArrayBuffer, binaryB: Uint8Array | ArrayBuffer): number;
    static informationTheoreticScore(distance: number, dim?: number): number;
    storeVector(memoryId: string, embedding: readonly number[]): void;
    search(queryEmbedding: readonly number[], topK?: number): BinaryVectorSearchResult[];
    searchBatch(queryEmbeddings: readonly (readonly number[])[], topK?: number): BinaryVectorSearchResult[][];
    deleteVector(memoryId: string): void;
    getStats(): BinaryVectorStats;
    close(): void;
}
export declare class FastBinarySearch {
    private readonly memoryIds;
    private readonly vectors;
    constructor(binaryVectors: ReadonlyMap<string, Uint8Array | ArrayBuffer> | Record<string, Uint8Array | ArrayBuffer>);
    search(queryBinary: Uint8Array | ArrayBuffer, topK?: number): BinaryVectorSearchResult[];
}
