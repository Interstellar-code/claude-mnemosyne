import { Database } from "bun:sqlite";
export type SqlitePageSize = number | "os";
export type DatabasePath = string | ":memory:";
export interface OpenDatabaseOptions {
    readonly create?: boolean;
    readonly readwrite?: boolean;
    readonly strict?: boolean;
    readonly loadExtension?: string | readonly string[];
    readonly pragmas?: boolean;
    readonly pageSize?: SqlitePageSize;
}
export declare function openDatabase(path?: DatabasePath, options?: OpenDatabaseOptions): Database;
export declare function enablePragmas(db: Database, path?: DatabasePath, pageSize?: SqlitePageSize): void;
export declare function loadExtensions(db: Database, extensions: string | readonly string[]): void;
export declare function transaction<T>(db: Database, fn: () => T): T;
export declare const deferredTransaction: typeof transaction;
export declare function transactionAsync<T>(db: Database, fn: () => Promise<T>): Promise<T>;
export declare function closeQuietly(db: Database | undefined | null): void;
