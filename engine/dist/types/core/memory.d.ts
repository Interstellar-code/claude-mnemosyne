import type { Database } from "bun:sqlite";
import type { Api, ApiKey, Model } from "@oh-my-pi/pi-ai";
import type { MemoryInput, Metadata } from "../types.js";
import { BeamMemory } from "./beam/index.js";
import type { RecallEnhancedOptions, RecallOptions, RecallResult, SleepResult } from "./beam/types.js";
import { type MnemopiEmbeddingRuntimeOptions, type MnemopiLlmCompletion, type MnemopiLlmRuntimeOptions, type ResolvedMnemopiRuntimeOptions } from "./runtime-options.js";
export interface MnemopiOptions {
    readonly db?: Database;
    readonly dbPath?: string;
    readonly db_path?: string;
    readonly sessionId?: string;
    readonly session_id?: string;
    readonly bank?: string | null;
    readonly authorId?: string | null;
    readonly author_id?: string | null;
    readonly authorType?: string | null;
    readonly author_type?: string | null;
    readonly channelId?: string | null;
    readonly channel_id?: string | null;
    readonly noEmbeddings?: boolean;
    readonly embeddingModel?: string;
    readonly embeddingApiUrl?: string;
    readonly embeddingApiKey?: ApiKey;
    readonly embeddings?: false | MnemopiEmbeddingRuntimeOptions;
    readonly llmEnabled?: boolean;
    readonly llmBaseUrl?: string;
    readonly llmApiKey?: ApiKey;
    readonly llmModel?: string | Model<Api>;
    readonly llm?: false | MnemopiLlmRuntimeOptions | Model<Api> | MnemopiLlmCompletion;
    readonly proactiveLinking?: boolean;
    /**
     * Route `recallEnhanced` through polyphonic recall for this instance. Unset
     * defers to `configureRecallFeatures`; `MNEMOPI_POLYPHONIC_RECALL` wins when set.
     */
    readonly polyphonicRecall?: boolean;
    /**
     * Cache `recallEnhanced` results for this instance. Unset defers to
     * `configureRecallFeatures`; `MNEMOPI_ENHANCED_RECALL` wins when set.
     */
    readonly enhancedRecall?: boolean;
    /** Escalate best-effort failure logs (embedding pipeline) from debug to warn. */
    readonly debug?: boolean;
    /**
     * When `false`, skip the embedding-model reconcile (wipe-and-rebuild) on open.
     * Read-only / ephemeral consumers (e.g. a stats snapshot) set this so an open
     * never triggers a destructive migration whose background rebuild the process
     * would exit before completing. Defaults to `true`.
     */
    readonly reconcile?: boolean;
}
export interface RememberInput extends MemoryInput {
    readonly extract?: boolean;
    readonly extractEntities?: boolean;
    readonly extract_entities?: boolean;
    readonly extractText?: string | null;
    readonly extract_text?: string | null;
    readonly embedText?: string | null;
    readonly embed_text?: string | null;
    readonly trustTier?: string | null;
    readonly trust_tier?: string | null;
    readonly memoryType?: string | null;
    readonly memory_type?: string | null;
}
export interface RememberFacadeOptions {
    readonly source?: string | null;
    readonly importance?: number;
    readonly metadata?: Metadata | null;
    readonly validUntil?: string | Date | null;
    readonly valid_until?: string | Date | null;
    readonly scope?: string | null;
    readonly extractEntities?: boolean;
    readonly extract_entities?: boolean;
    readonly extract?: boolean;
    /**
     * Override the text passed to fact/entity extraction. When unset, the
     * stored content is used. See {@link RememberOptions.extractText}.
     */
    readonly extractText?: string | null;
    readonly extract_text?: string | null;
    /**
     * Override the text passed to embeddings and FTS indexing. Stored content
     * remains unchanged; when unset, embeddings and FTS use stored content.
     */
    readonly embedText?: string | null;
    readonly embed_text?: string | null;
    readonly trustTier?: string | null;
    readonly trust_tier?: string | null;
    readonly timestamp?: string | Date | null;
    readonly veracity?: string | null;
    readonly memoryType?: string | null;
    readonly memory_type?: string | null;
}
export interface RecallFacadeOptions extends Omit<RecallOptions, "temporalHalflife" | "vecWeight" | "ftsWeight" | "importanceWeight"> {
    readonly from_date?: string | null;
    readonly to_date?: string | null;
    readonly source?: string | null;
    readonly topic?: string | null;
    readonly temporalWeight?: number;
    readonly temporal_weight?: number;
    readonly query_time?: string | Date | null;
    readonly temporalHalflife?: number | null;
    readonly temporal_halflife?: number | null;
    readonly vecWeight?: number | null;
    readonly vec_weight?: number | null;
    readonly ftsWeight?: number | null;
    readonly fts_weight?: number | null;
    readonly importanceWeight?: number | null;
    readonly importance_weight?: number | null;
}
export interface MemoryFacadeStats {
    total_memories: number;
    total_sessions: number;
    sources: Record<string, number>;
    last_memory: string | null;
    database: string;
    mode: "beam";
    banks: string[];
    beam: {
        working_memory: unknown;
        episodic_memory: unknown;
        triples: {
            total: number;
        };
    };
}
type ModuleRememberOptions = RememberFacadeOptions & {
    readonly bank?: string | null;
};
type ModuleRecallOptions = RecallFacadeOptions & {
    readonly bank?: string | null;
};
type ModuleRecallEnhancedOptions = RecallFacadeOptions & RecallEnhancedOptions & {
    readonly bank?: string | null;
};
export declare class Mnemopi {
    #private;
    readonly sessionId: string;
    readonly bank: string;
    readonly dbPath?: string;
    readonly authorId: string | null;
    readonly authorType: string | null;
    readonly channelId: string;
    readonly beam: BeamMemory;
    readonly conn: Database;
    readonly db: Database;
    readonly runtimeOptions?: ResolvedMnemopiRuntimeOptions;
    constructor(options?: MnemopiOptions);
    close(): void;
    flushExtractions(): Promise<void>;
    remember(memory: string | RememberInput, options?: RememberFacadeOptions): string;
    recall(query: string, topK?: number, options?: RecallFacadeOptions): Promise<RecallResult[]>;
    recallEnhanced(query: string, topK?: number, options?: RecallFacadeOptions & RecallEnhancedOptions): Promise<RecallResult[]>;
    getContext(limit?: number): unknown[];
    getStats(authorId?: string | null, authorType?: string | null, channelId?: string | null): MemoryFacadeStats;
    get(memoryId: string): unknown | null;
    forget(memoryId: string): boolean;
    update(memoryId: string, content?: string | null, importance?: number | null): boolean;
    sleep(dryRun?: boolean): SleepResult;
    sleepAllSessions(dryRun?: boolean): SleepResult;
    scratchpadWrite(content: string): string;
    scratchpadRead(): unknown[];
    scratchpadClear(): void;
    addMemory(memory: string | RememberInput, options?: RememberFacadeOptions): string;
    saveMemory(memory: string | RememberInput, options?: RememberFacadeOptions): string;
    storeMemory(memory: string | RememberInput, options?: RememberFacadeOptions): string;
    search(query: string, topK?: number, options?: RecallFacadeOptions): Promise<RecallResult[]>;
    query(query: string, topK?: number, options?: RecallFacadeOptions): Promise<RecallResult[]>;
    consolidate(dryRun?: boolean): SleepResult;
}
export declare function setBank(bank: string): void;
export declare function getBank(): string;
export declare function getDefaultInstance(bank?: string | null): Mnemopi;
export declare function remember(content: string | RememberInput, options?: ModuleRememberOptions): string;
export declare function recall(query: string, topK?: number, options?: ModuleRecallOptions): Promise<RecallResult[]>;
export declare function recallEnhanced(query: string, topK?: number, options?: ModuleRecallEnhancedOptions): Promise<RecallResult[]>;
export declare function getContext(limit?: number, bank?: string | null): unknown[];
export declare function getStats(bank?: string | null): MemoryFacadeStats;
export declare function get(memoryId: string, bank?: string | null): unknown | null;
export declare function forget(memoryId: string, bank?: string | null): boolean;
export declare function update(memoryId: string, content?: string | null, importance?: number | null, bank?: string | null): boolean;
export declare function sleep(dryRun?: boolean, bank?: string | null): SleepResult;
export declare function sleepAllSessions(dryRun?: boolean, bank?: string | null): SleepResult;
export declare function flushExtractions(bank?: string | null): Promise<void>;
export declare function scratchpadWrite(content: string, bank?: string | null): string;
export declare function scratchpadRead(bank?: string | null): unknown[];
export declare function scratchpadClear(bank?: string | null): void;
export declare function addMemory(memory: string | RememberInput, options?: ModuleRememberOptions): string;
export declare function saveMemory(memory: string | RememberInput, options?: ModuleRememberOptions): string;
export declare function storeMemory(memory: string | RememberInput, options?: ModuleRememberOptions): string;
export declare function search(query: string, topK?: number, options?: ModuleRecallOptions): Promise<RecallResult[]>;
export declare function query(query: string, topK?: number, options?: ModuleRecallOptions): Promise<RecallResult[]>;
export declare function resetDefaultInstanceForTests(): void;
export declare function resetMemoryForTests(): void;
export declare function resetModuleStateForTests(): void;
export type { MemoryInput, MemoryStats } from "../types.js";
export default Mnemopi;
