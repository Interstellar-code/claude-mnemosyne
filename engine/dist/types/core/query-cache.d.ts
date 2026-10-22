import { type Env } from "../config.js";
export type QueryCacheResult = Record<string, unknown>;
export type QueryEmbedding = readonly number[];
export interface QueryCacheOptions {
    readonly dbPath?: string | null;
    readonly db_path?: string | null;
    readonly maxSize?: number;
    readonly max_size?: number;
    readonly ttlSeconds?: number;
    readonly ttl_seconds?: number;
}
export interface QueryCacheStats {
    readonly hits: number;
    readonly misses: number;
    readonly hit_rate: number;
    readonly tier1_hits: number;
    readonly tier2_hits: number;
    readonly tier3_hits: number;
    readonly tier4_hits: number;
    readonly size: number;
    readonly max_size: number;
    readonly version: number;
}
export declare function isEnhancedRecallEnabled(env?: Env, configured?: boolean): boolean;
export declare function isQueryCacheEnabled(useCache?: boolean, env?: Env, configured?: boolean): boolean;
/**
 * Tiered query result cache. Every entry lives in a `scope`: an opaque string the
 * caller derives from all non-query inputs (result limit, filters, visibility,
 * ranking mode, ...). Lookups only ever consider entries of the same scope, so the
 * fuzzy tiers can match a *similar query* but never a different set of options.
 *
 * - Tier 1: exact normalized query match.
 * - Tiers 2/3: query embedding cosine >= 0.88, or >= 0.78 plus word overlap.
 * - Tier 4: shared distinct words cover at least 70% of the new query and half of the
 *   cached one, so a reworded or trimmed query hits but a short query never lands
 *   inside a long cached prompt that merely contains its words.
 */
export declare class QueryCache<T = QueryCacheResult> {
    #private;
    readonly maxSize: number;
    readonly ttlSeconds: number;
    hits: number;
    misses: number;
    tier1Hits: number;
    tier2Hits: number;
    tier3Hits: number;
    tier4Hits: number;
    constructor(options?: QueryCacheOptions | string | null, maxSize?: number, ttlSeconds?: number);
    invalidate(): void;
    get(query: string, embedding?: QueryEmbedding | null, scope?: string): readonly T[] | null;
    put(query: string, results: readonly T[], embedding?: QueryEmbedding | null, scope?: string): void;
    close(): void;
    get hitRate(): number;
    stats(): QueryCacheStats;
    normalize(query: string): string;
    jaccardWords(queryA: string, queryB: string): number;
}
