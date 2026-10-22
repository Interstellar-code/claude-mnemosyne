import type { Database } from "bun:sqlite";
export interface DiagnosticEntry {
    readonly ts: string;
    readonly category: string;
    readonly check: string;
    readonly status: string;
    readonly detail?: string;
}
export interface DiagnosticSummary {
    readonly checks_total: number;
    readonly checks_passed: number;
    readonly checks_failed: number;
    readonly key_findings: string[];
    readonly entries: DiagnosticEntry[];
    readonly database: string;
}
export interface DiagnosticOptions {
    readonly db?: Database;
    readonly dbPath?: string;
    readonly dataDir?: string;
    readonly initialize?: boolean;
}
export declare function inspectDatabase(options?: DiagnosticOptions): DiagnosticSummary;
export declare function runDiagnostics(options?: DiagnosticOptions): DiagnosticSummary;
