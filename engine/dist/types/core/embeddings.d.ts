import type { EmbeddingModel } from "fastembed";
import { type EmbeddingOutput } from "./runtime-options.js";
export type { EmbeddingOutput } from "./runtime-options.js";
export { cosineSimilarity } from "./vector-math.js";
export type Vector = Float32Array;
export type EmbeddingMatrix = Vector[];
export interface EmbeddingProvider {
    embed(texts: readonly string[]): EmbeddingOutput | Promise<EmbeddingOutput>;
    available?(): boolean | Promise<boolean>;
}
export type StandardEmbeddingModel = Exclude<EmbeddingModel, EmbeddingModel.CUSTOM>;
export interface LocalEmbeddingModel {
    embed(texts: string[], batchSize?: number): EmbeddingOutput;
    queryEmbed?(query: string): Promise<number[]>;
}
export type LocalModelInitOptions = {
    model: StandardEmbeddingModel;
    cacheDir?: string;
    showDownloadProgress?: boolean;
};
export type LocalModelInitializer = (options: LocalModelInitOptions) => Promise<LocalEmbeddingModel>;
/**
 * Quarantine the exact ONNX file named by a "Protobuf parsing failed" init
 * error. A truncated cached model blocks local embeddings forever: the
 * downloader treats the existing file as complete, so every init re-parses
 * the same broken bytes. The extracted path is error-message CONTENT, so it
 * is only honored when it resolves inside the fastembed cache directory —
 * never rename an arbitrary file a dependency happens to mention. Atomic
 * rename; losing a concurrent-heal race (file already renamed/removed)
 * still returns true because a retry is safe either way.
 * @internal exported for tests
 */
export declare function quarantineCorruptModelFile(message: string, cacheDir?: string): Promise<boolean>;
/**
 * Shared local-model initializer: FlagEmbedding.init with a corrupt-cache heal.
 * A corrupt model blob (Protobuf parse failure) quarantines the file and
 * retries once; fastembed re-downloads any file missing from the model's
 * cache directory. Also the initializer the embed worker uses in its
 * subprocess; the in-process seam stays {@link setLocalModelInitializer}.
 */
export declare function defaultLocalModelInitializer(options: LocalModelInitOptions): Promise<LocalEmbeddingModel>;
export declare function embeddingsDisabled(): boolean;
/**
 * Resolve the embedding model name for the currently active runtime scope.
 *
 * Reads (in order): the active provider's `model` from `withMnemopiRuntimeOptions`,
 * the `MNEMOPI_EMBEDDING_MODEL` env var, then the bundled fastembed default. Stored
 * alongside each row in `memory_embeddings.model` so migrations can re-embed when
 * the active model changes.
 */
export declare function currentEmbeddingModel(): string;
export declare function isApiModel(modelName: string): boolean;
export declare function embeddingDimFor(modelName: string): number;
export declare function setEmbeddingProviderForTests(provider: EmbeddingProvider | null | undefined): void;
export declare const setEmbeddingProvider: typeof setEmbeddingProviderForTests;
export declare function setLocalModelInitializerForTests(initializer: LocalModelInitializer | null | undefined): void;
/**
 * Override the function used to construct the local fastembed model the next
 * time `embed()` is called. Lets a host (e.g. the agent CLI) keep
 * `onnxruntime-node` out of its own address space by routing every fastembed
 * load + inference through a dedicated subprocess. Same wipe semantics as the
 * `*ForTests` form: clears the cached model promise and the query cache so
 * subsequent embeds run through the new initializer immediately.
 */
export declare const setLocalModelInitializer: typeof setLocalModelInitializerForTests;
export declare function resetEmbeddingProviderForTests(): void;
export declare const resetEmbeddingStateForTests: typeof resetEmbeddingProviderForTests;
export declare function available(): Promise<boolean>;
export declare function availableApi(): boolean;
export declare function embedQuery(text: string): Promise<Vector | null>;
export declare function embed(texts: readonly string[]): Promise<EmbeddingMatrix | null>;
export declare function getEmbeddingApiCallCountForTests(): number;
export declare const DEFAULT_MODEL: string;
export declare const EMBEDDING_DIM: number;
