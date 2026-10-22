import type { Database } from "bun:sqlite";
import { cosineSimilarity } from "./vector-math.js";
export { cosineSimilarity };
export declare const SHMR_BATCH_SIZE: number;
export declare const SHMR_MAX_ITERATIONS: number;
export declare const SHMR_SIMILARITY_THRESHOLD: number;
export declare const SHMR_HARMONY_THRESHOLD: number;
export declare const SHMR_MIN_CLUSTER_SIZE: number;
export declare const EMBEDDING_DIM = 384;
export type Vector = Float32Array;
export interface ShmrItem {
    readonly fact_id?: string;
    readonly subject?: string;
    readonly predicate?: string;
    readonly object?: string;
    readonly content?: string;
    readonly confidence?: number;
    readonly timestamp?: string;
    readonly source?: string;
    readonly embedding?: Vector;
}
export interface Belief {
    readonly subject: string;
    readonly predicate: string;
    readonly object: string;
    readonly confidence: number;
    readonly action?: "create" | "update" | "dampen";
    readonly target_fact_id?: string | null;
    readonly rationale?: string;
}
export interface HarmonizeStats {
    readonly clusters_found: number;
    readonly beliefs_generated: number;
    readonly contradictions_resolved: number;
    readonly harmony_score_avg: number;
    readonly duration_ms: number;
    readonly status: "insufficient_candidates" | "harmonized" | "no_convergence";
}
type BeamLike = {
    readonly conn?: Database;
    readonly db?: Database;
    readonly session_id?: string;
    readonly sessionId?: string;
};
export declare const FACTS_SCHEMA_SQL = "\nCREATE TABLE IF NOT EXISTS harmonic_beliefs (\n\tbelief_id TEXT PRIMARY KEY,\n\tsubject TEXT,\n\tpredicate TEXT,\n\tobject TEXT NOT NULL,\n\tconfidence REAL DEFAULT 0.5,\n\tprovenance TEXT,\n\tcluster_id TEXT,\n\titeration INTEGER DEFAULT 0,\n\tcreated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n\tupdated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\nCREATE TABLE IF NOT EXISTS memory_resonance_log (\n\tid INTEGER PRIMARY KEY AUTOINCREMENT,\n\tsession_id TEXT,\n\tcluster_count INTEGER,\n\tbeliefs_generated INTEGER,\n\tcontradictions_resolved INTEGER,\n\tharmony_score_avg REAL,\n\tduration_ms INTEGER,\n\tcreated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\nCREATE INDEX IF NOT EXISTS idx_beliefs_subject ON harmonic_beliefs(subject);\nCREATE INDEX IF NOT EXISTS idx_beliefs_predicate ON harmonic_beliefs(predicate);\nCREATE INDEX IF NOT EXISTS idx_beliefs_confidence ON harmonic_beliefs(confidence);\n";
export declare function initSchema(db: Database): void;
/**
 * Embed a batch of texts with the configured embedding provider. Falls back to the
 * deterministic SHA1 bag-of-words hash for the entire batch when no provider is
 * available or the provider fails, so every returned vector shares one space.
 */
export declare function embedBatch(texts: readonly string[]): Promise<Vector[]>;
export declare function embed(text: string): Promise<Vector>;
export declare function clusterBySimilarity(items: readonly ShmrItem[], threshold: number): Promise<ShmrItem[][]>;
export declare function formatClusterForLlm(cluster: readonly ShmrItem[]): string;
export declare function extractJsonFromLlmOutput(text: string): Belief[];
export declare function computeHarmonyScore(beliefs: readonly Belief[], cluster: readonly ShmrItem[]): Promise<number>;
export declare function applyBeliefs(db: Database, beliefs: readonly Belief[], cluster: readonly ShmrItem[], clusterId: string): void;
export declare function harmonize(beam: BeamLike, batchSize?: number, maxIterations?: number, similarityThreshold?: number): Promise<HarmonizeStats>;
export declare function recallBeliefs(beam: BeamLike, query: string, topK?: number): Promise<Array<Record<string, unknown>>>;
export declare function reflect(_beam: BeamLike | null, _question: string, facts?: Array<Record<string, unknown>> | null, topK?: number): string | null;
export declare function getResonanceLog(beam: BeamLike, limit?: number): Array<Record<string, unknown>>;
