import type { BeamMemoryState, RecallEnhancedOptions, RecallOptions, RecallResult } from "./types.js";
type RecallOptionsInternal = RecallOptions & {
    source?: string | null;
    topic?: string | null;
    veracity?: string | null;
    memoryType?: string | null;
    temporalWeight?: number;
    temporalHalflife?: number;
    vecWeight?: number;
    ftsWeight?: number;
    importanceWeight?: number;
    queryEmbedding?: readonly number[] | null;
    useSynonyms?: boolean;
    useIntent?: boolean;
    useMmr?: boolean;
    mmrLambda?: number;
    ignoreSessionScope?: boolean;
    currentSensitive?: boolean;
    updateRecallCounts?: boolean;
};
type FactRecallResult = RecallResult & {
    fact_id?: string;
    subject?: string;
    predicate?: string;
};
/**
 * Default per-result content preview cap enforced by {@link recall}. Content
 * longer than this is clipped and the last character replaced with `…` so
 * callers see the truncation; the full row remains reachable via
 * `Mnemopi.get()` (and, in the coding-agent, `memory://<id>`). Overridable per
 * call via {@link RecallOptions.contentPreviewChars}.
 */
export declare const RECALL_CONTENT_PREVIEW_CHARS = 500;
/**
 * Clip `content` to at most `limit` characters, replacing the tail with `…`
 * when truncated so agents can distinguish a preview from a full row. Returns
 * the original string (and `truncated: false`) when the limit is 0/negative or
 * the content already fits. The single `…` occupies one character of the cap,
 * so a 500-char cap yields at most 499 real characters plus the marker.
 */
export declare function clipRecallContent(content: string, limit?: number): {
    content: string;
    truncated: boolean;
    fullLength: number;
};
export declare function parseQueryTime(value: RecallOptionsInternal["queryTime"]): Date;
export declare function temporalBoost(timestamp: unknown, queryTime: Date, halfLifeHours: number): number;
export declare function recall(beam: BeamMemoryState, query: string, topK?: number, options?: RecallOptionsInternal): Promise<RecallResult[]>;
/**
 * Enhanced recall: linear hybrid recall with synonyms, intent weighting and MMR,
 * optionally merged with extracted facts.
 *
 * Two opt-in layers sit on top, each gated per instance (`BeamConfig`) with the
 * `MNEMOPI_POLYPHONIC_RECALL` / `MNEMOPI_ENHANCED_RECALL` env vars winning:
 * - polyphonic recall fuses this ranking with the vector, graph, fact and temporal
 *   voices (see {@link orchestrateRecall});
 * - the enhanced recall cache serves repeated or similar queries whose options all
 *   match, and is dropped by any database write.
 * With both off the linear path runs unchanged.
 */
export declare function recallEnhanced(beam: BeamMemoryState, query: string, topK?: number, options?: RecallEnhancedOptions & RecallOptionsInternal): Promise<RecallResult[]>;
export declare function formatContext(beam: BeamMemoryState, results: readonly RecallResult[], format?: string): string;
export declare function factRecall(beam: BeamMemoryState, query: string, topK?: number): FactRecallResult[];
export {};
