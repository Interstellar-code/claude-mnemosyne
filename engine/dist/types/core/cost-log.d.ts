import type { Database } from "bun:sqlite";
export declare const DEFAULT_LOG_DIR: string;
export declare const DEFAULT_LOG_DB: string;
export interface CostStats {
    total_calls: number;
    total_memories_injected: number;
    total_tokens: number;
    total_estimated_cost_usd: number;
}
export declare function getConn(dbPath?: string): Database;
export declare function initCostLog(dbPath?: string): void;
export declare function logCost(sessionId: string, memoryCount: number, tokenCount: number, estimatedCostUsd: number, model?: string, dbPath?: string): void;
export declare function getCostStats(sessionId?: string, dbPath?: string): CostStats;
