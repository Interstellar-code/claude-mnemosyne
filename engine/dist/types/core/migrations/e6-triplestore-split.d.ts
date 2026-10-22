import type { Database } from "bun:sqlite";
import { type DatabasePath } from "../../db.js";
export declare const ANNOTATION_KINDS: readonly ["mentions", "fact", "occurred_on", "has_source"];
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];
export interface MigrationOptions {
    readonly dbPath: DatabasePath;
    readonly dryRun?: boolean;
    readonly backup?: boolean;
    readonly logFn?: (line: string) => void;
}
export interface PendingConnection {
    query<T = unknown>(sql: string): {
        get(...params: unknown[]): T | null;
    };
}
export declare function hasPendingMigration(db: Database): boolean;
export declare function migrate(dbPathOrOptions: DatabasePath | MigrationOptions, dryRun?: boolean, backup?: boolean, logFn?: (line: string) => void): number;
