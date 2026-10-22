import type { Database } from "bun:sqlite";
import { sha256Hex16 } from "../../util/ids.js";
import { cjkFtsTerms, containsSpacelessCjk, ftsQueryTerms, recallTokens } from "../../util/regex.js";
import type { BeamMemoryState, Metadata } from "./types.js";
export type Vector = number[];
export type HybridWeights = readonly [vecWeight: number, ftsWeight: number, importanceWeight: number];
export interface VectorDistanceResult {
    rowid: number;
    distance: number;
}
export interface WorkingVectorResult {
    id: string;
    sim: number;
}
export interface FtsRankResult {
    rowid: number;
    rank: number;
}
export interface WorkingFtsRankResult {
    id: string;
    rank: number;
}
export declare function generateId(content: string, now?: Date): string;
export declare function generateStableId(content: string, source?: string): string;
export declare function normalizeWeights(vecWeight: number | null | undefined, ftsWeight: number | null | undefined, importanceWeight: number | null | undefined): HybridWeights;
export declare function normalizeImportance(importance: number | null | undefined, fallback?: number): number;
export declare function normalizeDateUtc(dt: Date): Date;
export declare function parseIsoDateTimeUtc(value: string): Date;
export declare function parseQueryTime(queryTime?: string | Date | null): Date;
export declare function parseTimestampFast(ts: string | null | undefined, beam?: Pick<BeamMemoryState, "caches"> | null): Date | null;
export declare function recencyDecay(timestamp: string | null | undefined, halflifeHours?: number, now?: Date): number;
export declare function temporalBoost(memoryTimestamp: string | null | undefined, queryTime: Date | string, halflifeHours?: number, beam?: Pick<BeamMemoryState, "caches"> | null): number;
export declare function buildFtsQuery(query: string): string;
export declare function cjkLikeSearch(db: Database, query: string, k?: number, working?: boolean): Array<FtsRankResult | WorkingFtsRankResult>;
export declare function ftsSearch(db: Database, query: string, k?: number): FtsRankResult[];
export declare function ftsSearchWorking(db: Database, query: string, k?: number): WorkingFtsRankResult[];
export declare function encodeVector(embedding: readonly number[]): string;
export declare function decodeVector(value: string | null | undefined): Vector | null;
export declare function vecAvailable(db: Database): boolean;
export declare function effectiveVecType(db: Database): "float32" | "int8" | "bit";
export declare function vecInsert(db: Database, rowid: number, embedding: readonly number[]): void;
export declare function vecSearch(db: Database, embedding: readonly number[], k?: number): VectorDistanceResult[];
export declare function inMemoryVecSearch(db: Database, queryEmbedding: readonly number[], k?: number): VectorDistanceResult[];
export declare function workingMemoryVecSearch(db: Database, queryEmbedding: readonly number[], k?: number, now?: Date): WorkingVectorResult[];
export declare function normalizeMetadata(input: unknown): Metadata;
export declare function metadataJson(input: unknown): string;
export declare function detectLanguage(text: string): string;
export declare function memoryRowMetadata(row: unknown): Metadata;
export { cosineSimilarity, hammingDistance, informationTheoreticScore, maximallyInformativeBinarization, quantizeInt8, } from "../binary-vectors.js";
export { cjkFtsTerms, containsSpacelessCjk, ftsQueryTerms, recallTokens, sha256Hex16 };
/** Identifies one freshly stored memory whose embedding still needs to be derived. */
export interface EmbedItem {
    readonly memoryId: string;
    readonly content: string;
}
/**
 * Schedule background embedding generation for one or more freshly stored memories.
 *
 * Mirrors the `scheduleFactExtraction` pattern in `beam/store.ts`: `remember()`,
 * `rememberBatch()`, and `consolidateToEpisodic()` are synchronous, but `embed()` is
 * async (it may hit an HTTP provider), so the task is fired-and-forgotten and tracked
 * on `beam.pendingExtractions` so tests and graceful shutdown can drain it via
 * `flushExtractions()`. The active runtime options (provider, model, API URL/key) are
 * captured here and re-entered inside the task because the `AsyncLocalStorage` scope
 * set by `Mnemopi.#withRuntimeOptions` has already exited by the time the task runs.
 */
export declare function scheduleEmbedding(beam: BeamMemoryState, items: readonly EmbedItem[]): void;
