import type { Database } from "bun:sqlite";
import { type Env } from "../config.js";
import { type DatabasePath } from "../db.js";
import type { BeamMemoryState, JsonValue, Metadata, RecallResult, RecallTierLabel } from "./beam/types.js";
import { EpisodicGraph } from "./episodic-graph.js";
import { VeracityConsolidator } from "./veracity-consolidation.js";
export type PolyphonicVoice = "hybrid" | "vector" | "graph" | "fact" | "temporal";
export interface VoiceRecallResult {
    readonly memoryId: string;
    readonly score: number;
    readonly voice: PolyphonicVoice;
    readonly metadata: Metadata;
}
export interface PolyphonicResult {
    readonly memoryId: string;
    combinedScore: number;
    readonly voiceScores: Partial<Record<PolyphonicVoice, number>>;
    readonly metadata: Metadata;
}
/** A hydrated recall row with its fused score and per-voice RRF contributions. */
export interface PolyphonicMemoryResult extends RecallResult {
    score: number;
    combined_score: number;
    voice_scores: Partial<Record<PolyphonicVoice, number>>;
    metadata: Metadata;
    tier: RecallTierLabel;
}
/** Per-call options that shape which memories the voices may surface. */
export interface PolyphonicCallOptions {
    /**
     * Extra visibility channel, mirroring linear recall: rows are visible when they
     * belong to the engine session, are `global`, or carry this `channel_id`.
     */
    readonly channelId?: string | null;
    /** Anchor for the temporal voice ("recent" is measured back from this instant). */
    readonly queryTime?: string | Date | null;
    /** Keep non-memory rows (extracted facts) contributed by the `hybrid` voice. */
    readonly includeFacts?: boolean;
    /**
     * Ranked results of the standard (linear) recall for the same query. They form
     * the `hybrid` voice and are reused verbatim when a fused hit is one of them.
     */
    readonly baseline?: readonly RecallResult[];
}
export interface PolyphonicRecallOptions extends PolyphonicCallOptions {
    readonly queryEmbedding?: readonly number[] | Float32Array | null;
    /**
     * Approximate token budget for the returned rows (default 4000); rows past it are
     * dropped even below `topK`. `Infinity` disables the budget.
     */
    readonly contextBudget?: number;
}
interface PolyphonicEngineOptions {
    readonly dbPath?: DatabasePath;
    readonly db?: Database;
    readonly graph?: EpisodicGraph;
    readonly consolidator?: VeracityConsolidator;
    readonly sessionId?: string | null;
    readonly channelId?: string | null;
}
/** Reciprocal rank fusion constant: a voice's rank-`r` hit contributes `1 / (RRF_K + r)`. */
export declare const POLYPHONIC_RRF_K = 60;
export declare const POLYPHONIC_VOICES: readonly PolyphonicVoice[];
/** Highest possible fused score: rank 1 in every voice. */
export declare const POLYPHONIC_MAX_COMBINED_SCORE: number;
/**
 * Graph voice bounds. Proactive linking makes banks dense (every memory sharing an
 * entity links to every other), so an unbounded walk grows with the cube of the bank.
 * The voice reports at most `MAX_DIRECT` entity matches, expands the `MAX_SEEDS`
 * strongest of them and at most `MAX_FRONTIER` nodes per later hop, reads at most
 * `MAX_EDGE_ROWS` edges per hop, and reports at most `MAX_RESULTS` memories in total.
 */
export declare const GRAPH_VOICE_MAX_DEPTH = 2;
export declare const GRAPH_VOICE_MAX_DIRECT = 32;
export declare const GRAPH_VOICE_MAX_SEEDS = 16;
export declare const GRAPH_VOICE_MAX_FRONTIER = 32;
export declare const GRAPH_VOICE_MAX_EDGE_ROWS = 512;
export declare const GRAPH_VOICE_MAX_RESULTS = 64;
/**
 * Polyphonic recall gate: `MNEMOPI_POLYPHONIC_RECALL` wins when set, then the
 * per-instance `configured` flag, then the process-wide default.
 */
export declare function polyphonicRecallIsEnabled(env?: Env, configured?: boolean): boolean;
export declare class PolyphonicRecallEngine {
    #private;
    readonly dbPath: DatabasePath;
    readonly db: Database;
    readonly ownsConnection: boolean;
    readonly graph: EpisodicGraph;
    readonly consolidator: VeracityConsolidator;
    readonly sessionId: string;
    readonly channelId: string | null;
    readonly voiceWeights: Readonly<Record<PolyphonicVoice, number>>;
    constructor(options?: PolyphonicEngineOptions);
    recall(query: string, queryEmbedding?: readonly number[] | Float32Array | null, topK?: number, contextBudget?: number, options?: PolyphonicCallOptions): PolyphonicMemoryResult[];
    /** The standard recall ranking for the same query, fused as one more voice. */
    hybridVoice(baseline: readonly RecallResult[], options?: PolyphonicCallOptions): VoiceRecallResult[];
    vectorVoice(queryEmbedding: readonly number[] | Float32Array | null, options?: PolyphonicCallOptions): VoiceRecallResult[];
    /**
     * Memories whose gist or KG facts name a query entity (seeds), plus memories reached
     * from the strongest seeds over `ctx` edges. The walk is one multi-source BFS: each
     * node expands at most once, every hop is one batched edge query, and seeds, frontier,
     * edge rows and results are all capped, so dense proactively linked banks cost the
     * same bounded work as sparse ones.
     */
    graphVoice(query: string): VoiceRecallResult[];
    factVoice(query: string): VoiceRecallResult[];
    temporalVoice(query: string, options?: PolyphonicCallOptions): VoiceRecallResult[];
    /**
     * Reciprocal rank fusion. A voice may report the same memory several times (e.g. the
     * graph voice once per matching gist or fact); only its best rank counts, so each
     * voice contributes at most `1 / (RRF_K + 1)` and the fused score stays bounded by
     * {@link POLYPHONIC_MAX_COMBINED_SCORE}.
     */
    combineVoices(...voiceResults: readonly VoiceRecallResult[][]): Map<string, PolyphonicResult>;
    /**
     * Walk fused candidates best-first, hydrating each and skipping rows that are not
     * visible or whose content near-duplicates an already selected row, until `topK`
     * rows are selected.
     */
    diversityRerank(results: ReadonlyMap<string, PolyphonicResult>, topK: number, hydrate: (candidate: PolyphonicResult) => PolyphonicMemoryResult | null): PolyphonicMemoryResult[];
    assembleContext(results: readonly PolyphonicMemoryResult[], budget: number): PolyphonicMemoryResult[];
    getStats(): Record<string, JsonValue>;
    close(): void;
}
/**
 * The beam's polyphonic engine, built on first use. Building it creates the fact voice
 * tables; until it succeeds once, each call also backfills `consolidated_facts` from KG
 * facts extracted while polyphonic recall was off, so enabling the flag on an existing
 * bank starts with a fact voice and a failed backfill (e.g. a busy database) is retried.
 */
export declare function getPolyphonicEngine(beam: BeamMemoryState): PolyphonicRecallEngine;
export declare function polyphonicRecall(beam: BeamMemoryState, query: string, topK?: number, options?: PolyphonicRecallOptions): PolyphonicMemoryResult[];
export {};
