import { type Env, envBool, envDisabled, envFloat, envInt, envOneOf, envOptionalString, envString, envTruthy } from "./util/env.js";
export type { Env };
export { envBool, envDisabled, envFloat, envInt, envOneOf, envOptionalString, envString, envTruthy };
export declare const DEFAULT_DATA_DIR: string;
export declare const DEFAULT_DB_FILENAME = "mnemopi.db";
export declare const FASTEMBED_CACHE_DIR: string;
export declare const MODEL_CACHE_DIR: string;
export declare const DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
export declare const DEFAULT_EMBEDDING_API_URL = "https://openrouter.ai/api/v1";
export declare const DEFAULT_LLM_MODEL_REPO = "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF";
export declare const DEFAULT_LLM_MODEL_FILE = "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf";
export declare const HOST_LLM_TIMEOUT_SECONDS = 15;
export type VecType = "float32" | "int8" | "bit";
export declare const EMBEDDING_DIMS: Readonly<Record<string, number>>;
export declare const VERACITY_WEIGHT_DEFAULTS: {
    readonly stated: 1;
    readonly inferred: 0.7;
    readonly tool: 0.5;
    readonly imported: 0.6;
    readonly unknown: 0.8;
};
export declare function dataDir(env?: Env): string;
export declare function dbPath(env?: Env): string;
export declare function beamOptimizationsEnabled(env?: Env): boolean;
export declare function embeddingModel(env?: Env): string;
export declare function embeddingDim(env?: Env): number;
export declare function embeddingApiKey(env?: Env): string;
export declare function embeddingApiUrl(env?: Env): string;
export declare function embeddingsViaApi(env?: Env): boolean;
export declare function embeddingsDisabled(env?: Env): boolean;
/**
 * Per-input character cap applied inside `embed()` before any provider sees the text.
 *
 * Long retention transcripts (full multi-turn session windows) routinely outgrow
 * embedding model context windows: BGE/E5 defaults are 512 tokens, bge-m3 is
 * 8192, and OpenAI's text-embedding-3-* is 8192. llama.cpp's `/embeddings`
 * server rejects oversized requests with `request (N tokens) exceeds the
 * available context size`; OpenAI silently right-truncates. Capping at the
 * source gives both backends deterministic behavior and prevents the silent
 * recall degradation we saw in issue #3126.
 *
 * Default `8192` chars is intentionally conservative for 8192-token embedding
 * contexts (bge-m3, OpenAI text-embedding-3) and CJK-heavy transcripts. Raise
 * it for larger local contexts (for example Qwen3-Embedding with 32k ctx).
 * `0` disables the cap.
 */
export declare function embeddingMaxInputChars(env?: Env): number;
export declare function isApiEmbeddingModel(model?: string, env?: Env): boolean;
export declare function apiEmbeddingsAvailable(env?: Env): boolean;
export declare function workingMemoryMaxItems(env?: Env): number;
export declare function workingMemoryTtlHours(env?: Env): number;
export declare function episodicRecallLimit(env?: Env): number;
export declare function maxEpisodeChars(env?: Env): number;
export declare function sleepBatchSize(env?: Env): number;
export declare function scratchpadMaxItems(env?: Env): number;
export declare function recencyHalflifeHours(env?: Env): number;
export declare function tier2Days(env?: Env): number;
export declare function tier3Days(env?: Env): number;
/** Recall-time score multiplier for an episodic row still at degradation tier 1. */
export declare function tier1Weight(env?: Env): number;
/** Recall-time score multiplier for an episodic row degraded to tier 2. */
export declare function tier2Weight(env?: Env): number;
/** Recall-time score multiplier for an episodic row degraded to tier 3 or beyond. */
export declare function tier3Weight(env?: Env): number;
export declare function degradeBatchSize(env?: Env): number;
export declare function smartCompressEnabled(env?: Env): boolean;
export declare function tier3MaxChars(env?: Env): number;
export declare function statedWeight(env?: Env): number;
export declare function inferredWeight(env?: Env): number;
export declare function toolWeight(env?: Env): number;
export declare function importedWeight(env?: Env): number;
export declare function unknownWeight(env?: Env): number;
export declare function veracityWeightOverrides(env?: Env): string[];
export declare function vecType(env?: Env): VecType;
export declare function vectorWeight(env?: Env): number;
export declare function ftsWeight(env?: Env): number;
export declare function importanceWeight(env?: Env): number;
export declare function normalizedRecallWeights(vec?: number, fts?: number, importance?: number): readonly [number, number, number];
export declare function autoMigrateEnabled(env?: Env): boolean;
export interface RecallFeatureFlags {
    polyphonicRecall?: boolean;
    enhancedRecall?: boolean;
    proactiveLinking?: boolean;
}
/**
 * Sets process-wide defaults for the env-gated recall features. Hosts that open
 * several memories with different policies should pass the per-instance
 * `polyphonicRecall` / `enhancedRecall` / `proactiveLinking` options instead
 * (`Mnemopi` / `BeamMemory` constructors), which take precedence over these
 * defaults. The `MNEMOPI_POLYPHONIC_RECALL` / `MNEMOPI_ENHANCED_RECALL` /
 * `MNEMOPI_PROACTIVE_LINKING` environment variables still win whenever they are set.
 */
export declare function configureRecallFeatures(flags: RecallFeatureFlags): void;
/**
 * Resolves the polyphonic recall gate: the env var wins when set, then the
 * per-instance `configured` value, then the process-wide default.
 */
export declare function polyphonicRecallEnabled(env?: Env, configured?: boolean): boolean;
export declare function temporalHalflifeHours(env?: Env): number;
/**
 * Resolves the enhanced recall (query result cache) gate: the env var wins when
 * set, then the per-instance `configured` value, then the process-wide default.
 */
export declare function enhancedRecallEnabled(env?: Env, configured?: boolean): boolean;
export declare function proactiveLinkingEnabled(env?: Env): boolean;
export declare function llmEnabled(env?: Env): boolean;
export declare function llmMaxTokens(env?: Env): number;
export declare function llmThreads(env?: Env): number;
export declare function llmContext(env?: Env): number;
export declare function llmRepo(env?: Env): string;
export declare function llmFile(env?: Env): string;
export declare function llmModelFiles(env?: Env): readonly [repo: string, file: string];
export declare function llmBaseUrl(env?: Env): string;
export declare function llmApiKey(env?: Env): string;
export declare function llmModel(env?: Env): string;
export declare function hostLlmEnabled(env?: Env): boolean;
export declare function hostLlmProvider(env?: Env): string | undefined;
export declare function hostLlmModel(env?: Env): string | undefined;
export declare function hostLlmContext(env?: Env): number;
export declare function sleepPrompt(env?: Env): string;
