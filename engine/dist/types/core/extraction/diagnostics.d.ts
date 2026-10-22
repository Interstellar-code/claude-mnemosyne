export declare const EXTRACTION_TIERS: readonly ["host", "remote", "local", "cloud", "wrapper"];
export type ExtractionTier = (typeof EXTRACTION_TIERS)[number];
export interface ErrorSample {
    at: string;
    type: string;
    msg: string;
    reason?: string;
}
export interface TierStatsSnapshot {
    attempts: number;
    successes: number;
    no_output: number;
    failures: number;
    error_samples: ErrorSample[];
}
export interface ExtractionStatsSnapshot {
    created_at: string;
    snapshot_at: string;
    totals: {
        calls: number;
        successes: number;
        failures: number;
        empty: number;
        success_rate: number;
    };
    by_tier: Record<ExtractionTier, TierStatsSnapshot>;
}
export declare function safeForLog(value: unknown): string;
export declare class ExtractionDiagnostics {
    private tierStats;
    private totalCalls;
    private totalSuccesses;
    private totalFailures;
    private totalEmpty;
    private createdAt;
    private validateTier;
    recordAttempt(tier: ExtractionTier): void;
    recordSuccess(tier: ExtractionTier, _factCount?: number): void;
    recordNoOutput(tier: ExtractionTier): void;
    recordFailure(tier: ExtractionTier, exc?: unknown, reason?: string): void;
    recordCall(opts: {
        succeeded: boolean;
        allEmpty?: boolean;
    }): void;
    successRate(): number;
    snapshot(): ExtractionStatsSnapshot;
    reset(): void;
}
export declare function getDiagnostics(): ExtractionDiagnostics;
export declare function getExtractionStats(): ExtractionStatsSnapshot;
export declare function resetExtractionStats(): void;
