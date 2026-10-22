import { Database } from "bun:sqlite";
import { type DatabasePath } from "../db.js";
export interface TripleRow {
    id: number;
    subject: string;
    predicate: string;
    object: string;
    valid_from: string;
    valid_until: string | null;
    source: string | null;
    confidence: number | null;
    created_at: string | null;
}
export interface TripleWriteOptions {
    readonly validFrom?: string | null;
    readonly valid_from?: string | null;
    readonly source?: string | null;
    readonly confidence?: number | null;
}
export interface TripleQueryOptions {
    readonly subject?: string | null;
    readonly predicate?: string | null;
    readonly object?: string | null;
    readonly asOf?: string | null;
    readonly as_of?: string | null;
}
export interface TripleImportStats {
    inserted: number;
    skipped: number;
    overwritten: number;
    imported_renumbered: number;
}
export type TripleImportRow = Partial<Omit<TripleRow, "id">> & {
    readonly id?: number | null;
};
type ProcessEnv = Record<string, string | undefined>;
export declare function legacyDataDir(env?: ProcessEnv): string;
export declare function defaultDataDir(env?: ProcessEnv): string;
export declare function defaultTripleDbPath(env?: ProcessEnv): string;
export declare function legacyTripleDbPath(env?: ProcessEnv): string;
export declare function resolveDefaultTripleDb(env?: ProcessEnv): string;
export declare function initTriples(dbOrPath?: Database | DatabasePath | null): void;
export declare class TripleStore {
    #private;
    readonly dbPath: DatabasePath;
    readonly conn: Database;
    constructor(dbPath?: DatabasePath | Database | null);
    close(): void;
    add(subject: string, predicate: string, object: string, options?: TripleWriteOptions | string | null): number;
    query(options?: TripleQueryOptions): TripleRow[];
    query(subject?: string | null, predicate?: string | null, object?: string | null, asOf?: string | null): TripleRow[];
    queryByPredicate(predicate: string, object?: string | null, subject?: string | null): TripleRow[];
    getDistinctObjects(predicate: string): string[];
    exportAll(): TripleRow[];
    importAll(triples: readonly TripleImportRow[], force?: boolean): TripleImportStats;
}
export declare function addTriple(subject: string, predicate: string, object: string, options?: TripleWriteOptions & {
    readonly dbPath?: DatabasePath | null;
}): number;
export declare function queryTriples(options?: TripleQueryOptions & {
    readonly dbPath?: DatabasePath | null;
}): TripleRow[];
export {};
