import { type ExtractedFactCategories } from "../extraction.js";
import { VeracityConsolidator } from "../veracity-consolidation.js";
import type { BeamMemoryState, BeamStats, JsonValue, MemoriaRetrieveResult, Metadata, SleepResult } from "./types.js";
type Row = Record<string, unknown>;
type FactCounts = {
    metric: number;
    date: number;
    version: number;
    entity: number;
    sequence: number;
    timeline: number;
    negation: number;
    decision: number;
};
type ConsolidateOptions = {
    metadata?: Metadata | null;
    validUntil?: string | null;
    scope?: string;
    veracity?: string | null;
};
/**
 * This beam's veracity consolidator, created on first use so `consolidated_facts` /
 * `conflicts` DDL only runs once polyphonic recall needs them.
 */
export declare function ensureVeracityConsolidator(beam: BeamMemoryState): VeracityConsolidator;
/**
 * Consolidate every extracted KG fact (`memoria_kg`) whose source memory is not yet
 * among that fact's `consolidated_facts` sources, e.g. facts written while polyphonic
 * recall was off. Idempotent: a (fact, source) pair is only ever counted once.
 * Facts without a source memory are skipped; the fact voice could not return them.
 */
export declare function backfillConsolidatedFacts(beam: BeamMemoryState, consolidator: VeracityConsolidator): number;
export declare function consolidateToEpisodic(beam: BeamMemoryState, summary: string, sourceWmIds: readonly string[], source?: string, importance?: number, options?: ConsolidateOptions): string;
export declare function detectLanguage(_beam: BeamMemoryState, text: string): string;
type StoreFactStringOptions = {
    routeHeuristicCategories?: boolean;
};
export declare function storeFactStrings(beam: BeamMemoryState, facts: readonly string[], messageIdx?: number, sourceMemoryId?: string | null, importance?: number, options?: StoreFactStringOptions): number;
/** Store category-preserving LLM extraction output in MEMORIA and KG tables. */
export declare function storeExtractedFactCategories(beam: BeamMemoryState, extracted: ExtractedFactCategories, messageIdx?: number, sourceMemoryId?: string | null, importance?: number): number;
export declare function extractAndStoreFacts(beam: BeamMemoryState, content: string, messageIdx?: number, sourceMemoryId?: string | null): FactCounts;
export declare function memoriaRetrieve(beam: BeamMemoryState, query: string, ability?: string | null, topK?: number): MemoriaRetrieveResult;
export declare function getEpisodicStats(beam: BeamMemoryState, authorId?: string | null, authorType?: string | null, channelId?: string | null): BeamStats;
export declare function getMemoriaStats(beam: BeamMemoryState): BeamStats;
export declare function degradeEpisodic(beam: BeamMemoryState, dryRun?: boolean): Record<string, JsonValue>;
export declare function getContaminated(beam: BeamMemoryState, limit?: number, minImportance?: number): Row[];
export declare function health(beam: BeamMemoryState, staleThresholdHours?: number): Record<string, JsonValue | Record<string, JsonValue>>;
export declare function sleep(beam: BeamMemoryState, dryRun?: boolean): SleepResult;
export declare function sleepAllSessions(beam: BeamMemoryState, dryRun?: boolean): SleepResult;
export declare function getConsolidationLog(beam: BeamMemoryState, limit?: number): Row[];
export {};
