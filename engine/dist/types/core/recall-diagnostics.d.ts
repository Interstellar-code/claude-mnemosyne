export declare const RECALL_TIERS: readonly ["wm_fts", "wm_vec", "wm_fallback", "em_fts", "em_vec", "em_fallback"];
export type RecallTier = (typeof RECALL_TIERS)[number];
export interface TierStatsSnapshot {
    readonly calls_with_hits: number;
    readonly total_hits: number;
}
export interface RecallDiagnosticsSnapshot {
    readonly created_at: string;
    readonly snapshot_at: string;
    readonly totals: {
        readonly calls: number;
        readonly calls_using_wm_fallback: number;
        readonly calls_using_em_fallback: number;
        readonly calls_truly_empty: number;
        readonly wm_fallback_rate: number;
        readonly em_fallback_rate: number;
    };
    readonly by_tier: Record<RecallTier, TierStatsSnapshot>;
}
export declare class RecallDiagnostics {
    private tierStats;
    private totalCalls;
    private callsUsingWmFallback;
    private callsUsingEmFallback;
    private callsTrulyEmpty;
    private createdAt;
    constructor();
    private static validateTier;
    recordTierHits(tier: RecallTier | string, hitCount: number): void;
    recordFallbackUsed(options?: {
        readonly wm?: boolean;
        readonly em?: boolean;
    }): void;
    recordCall(options?: {
        readonly trulyEmpty?: boolean;
        readonly truly_empty?: boolean;
    }): void;
    fallbackRate(): {
        readonly wm: number;
        readonly em: number;
    };
    snapshot(): RecallDiagnosticsSnapshot;
    reset(): void;
}
export declare function getDiagnostics(): RecallDiagnostics;
export declare function getRecallDiagnostics(): RecallDiagnosticsSnapshot;
export declare function resetRecallDiagnostics(): void;
export declare function explainRecallDiagnostics(snapshot: RecallDiagnosticsSnapshot): string[];
