import type { BeamMemoryState, BeamStats, ImportStats, RememberBatchItem, RememberBatchOptions, RememberOptions } from "./types.js";
type Row = Record<string, unknown>;
type StoreRememberOptions = RememberOptions & {
    memoryId?: string;
    memory_id?: string;
    validUntil?: string | null;
    valid_until?: string | null;
    authorId?: string | null;
    author_id?: string | null;
    authorType?: string | null;
    author_type?: string | null;
    extractEntities?: boolean;
    extract_entities?: boolean;
    extract_text?: string;
    embed_text?: string;
    channelId?: string | null;
    channel_id?: string | null;
};
type StoreRememberBatchOptions = RememberBatchOptions & {
    forceVeracity?: boolean;
    force_veracity?: boolean;
};
/**
 * Reconcile stored embeddings against the active embedding model at store open.
 *
 * Every `memory_embeddings` row is stamped with the model that produced it (see
 * `runEmbedding` in `helpers.ts`). When the configured embedding model changes,
 * its vector dimension changes too, so the previously-stored vectors are no
 * longer comparable. On a mismatch we wipe every stored vector — the
 * `memory_embeddings` table, the `episodic_memory.binary_vector` column, and the
 * sqlite-vec `vec_episodes` index — then enqueue all live memories for
 * background re-embedding under the new model via `scheduleEmbedding`.
 *
 * Runs once per store open; a fresh store (no embeddings) or an already-current
 * store is a no-op. The destructive wipe is skipped whenever it could not be
 * rebuilt — embeddings disabled via the runtime option OR the
 * `MNEMOPI_NO_EMBEDDINGS` env, or an unresolved (empty) active model — so a
 * stale-but-valid corpus is never destroyed without a replacement. MUST run
 * inside the active runtime-options scope so `currentEmbeddingModel()` /
 * `embeddingsDisabled()` reflect the per-instance configuration.
 */
export declare function reconcileEmbeddingModel(beam: BeamMemoryState): void;
export declare function remember(beam: BeamMemoryState, content: string, options?: StoreRememberOptions): string;
export declare function rememberBatch(beam: BeamMemoryState, items: readonly RememberBatchItem[], options?: StoreRememberBatchOptions): string[];
export declare function getContext(beam: BeamMemoryState, limit?: number): Row[];
export declare function invalidate(beam: BeamMemoryState, memoryId: string, replacementId?: string | null): boolean;
export declare function getWorkingStats(beam: BeamMemoryState, authorId?: string | null, authorType?: string | null, channelId?: string | null): BeamStats;
export declare function getGlobalWorkingStats(beam: BeamMemoryState): BeamStats;
export declare function updateWorking(beam: BeamMemoryState, memoryId: string, content?: string | null, importance?: number | null): boolean;
export declare function get(beam: BeamMemoryState, memoryId: string): Row | null;
export declare function forgetWorking(beam: BeamMemoryState, memoryId: string): boolean;
export declare function scratchpadWrite(beam: BeamMemoryState, content: string): string;
export declare function scratchpadRead(beam: BeamMemoryState): Row[];
export declare function scratchpadClear(beam: BeamMemoryState): void;
export declare function exportToDict(beam: BeamMemoryState): Record<string, unknown>;
export declare function importFromDict(beam: BeamMemoryState, data: Record<string, unknown>, force?: boolean): ImportStats;
export {};
