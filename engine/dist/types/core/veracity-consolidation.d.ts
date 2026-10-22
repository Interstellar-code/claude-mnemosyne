import type { Database } from "bun:sqlite";
import { type DatabasePath } from "../db.js";
export declare const VERACITY_WEIGHTS: Readonly<{
    stated: 1;
    inferred: 0.7;
    tool: 0.5;
    imported: 0.6;
    unknown: 0.8;
}>;
export type Veracity = keyof typeof VERACITY_WEIGHTS;
export declare const VERACITY_ALLOWED: Record<Veracity, true>;
/**
 * Relations that legitimately hold for many objects at once ("Alice uses Rust" and
 * "Alice uses Go" are both true). A second object for them is not a contradiction, so
 * no conflict is recorded; otherwise every pair of objects would be one (quadratic).
 */
export declare const MULTI_VALUED_PREDICATES: Readonly<Record<string, true>>;
export interface ConsolidatedFact {
    readonly subject: string;
    readonly predicate: string;
    readonly object: string;
    readonly confidence: number;
    readonly mention_count: number;
    readonly first_seen: string | null;
    readonly last_seen: string | null;
    readonly sources: string[];
    readonly veracity: string;
    readonly superseded: boolean;
    readonly id: string | null;
}
export interface Conflict {
    readonly id: number;
    readonly fact_a_id: string;
    readonly fact_b_id: string;
    readonly type: string | null;
    readonly created_at: string | null;
}
export interface ConsolidationStats {
    readonly active_facts: number;
    readonly superseded_facts: number;
    readonly unresolved_conflicts: number;
    readonly avg_confidence: number;
    readonly avg_mentions: number;
}
export declare function computeFactId(subject: string, predicate: string, object: string): string;
export declare function clampVeracity(raw: unknown, context?: string): Veracity;
export declare function aggregateVeracity(sourceVeracities: readonly string[] | null | undefined): Veracity;
export declare class VeracityConsolidator {
    readonly conn: Database;
    readonly dbPath: DatabasePath;
    readonly ownsConnection: boolean;
    constructor(dbPath?: DatabasePath, conn?: Database);
    initTables(): void;
    serializedWrite<T>(body: () => T): T;
    bayesianUpdate(currentConfidence: number, veracity: string): number;
    consolidateFact(subject: string, predicate: string, object: string, veracity?: string, source?: string | null): ConsolidatedFact;
    recordConflict(factAId: string, factBId: string, conflictType: string, commit?: boolean): void;
    resolveConflict(conflictId: number, winningFactId: string): void;
    getConflicts(): Conflict[];
    getConsolidatedFacts(subject?: string | null, minConfidence?: number): ConsolidatedFact[];
    /**
     * Active facts whose subject equals one of `subjects`, ignoring ASCII case, so a
     * lower-case query word finds `PostgreSQL` or `Alice`.
     */
    getConsolidatedFactsBySubjects(subjects: readonly string[], minConfidence?: number): ConsolidatedFact[];
    getHighConfidenceSummary(subject: string, threshold?: number): string;
    runConsolidationPass(): void;
    resolveConflictByFacts(winningId: string, losingId: string): void;
    getStats(): ConsolidationStats;
    close(): void;
}
