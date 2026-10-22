import type { Database } from "bun:sqlite";
declare const ANNOTATION_KIND_VALUES: readonly ["mentions", "fact", "occurred_on", "has_source"];
export type AnnotationKind = (typeof ANNOTATION_KIND_VALUES)[number] | (string & {});
export declare const ENTITY_STOP_WORDS: ReadonlySet<string>;
export declare const ANNOTATION_KINDS: ReadonlySet<string>;
export declare const MIN_FACT_LENGTH = 10;
export interface AnnotationRow {
    readonly id: number;
    readonly memory_id: string;
    readonly kind: string;
    readonly value: string;
    readonly source: string | null;
    readonly confidence: number | null;
    readonly created_at: string | null;
}
export interface AnnotationInput {
    readonly id?: number | bigint | null;
    readonly memory_id: string;
    readonly kind: string;
    readonly value: string;
    readonly source?: string | null;
    readonly confidence?: number | null;
    readonly created_at?: string | null;
}
export interface AnnotationImportStats {
    inserted: number;
    skipped: number;
    overwritten: number;
    imported_renumbered: number;
}
export interface AnnotationStoreOptions {
    readonly dbPath?: string;
    readonly db_path?: string;
    readonly db?: Database;
    readonly conn?: Database;
}
export declare function filterCleanMentions<T extends {
    readonly value?: string | null;
}>(rows: readonly T[]): T[];
export declare function filterFacts(facts: readonly string[] | null | undefined): string[];
export declare function initAnnotations(path?: string): void;
export declare function initAnnotationsWithConn(db: Database): void;
export declare class AnnotationStore {
    readonly dbPath: string;
    readonly db: Database;
    readonly conn: Database;
    private readonly ownsConnection;
    constructor(options?: AnnotationStoreOptions | string);
    close(): void;
    add(memoryId: string, kind: string, value: string, source?: string, confidence?: number): number;
    addMany(memoryId: string, kind: string, values: readonly string[] | null | undefined, source?: string, confidence?: number): number;
    queryByMemory(memoryId: string, kind?: string | null): AnnotationRow[];
    queryByKind(kind: string, options?: {
        readonly value?: string | null;
        readonly memory_id?: string | null;
        readonly memoryId?: string | null;
        readonly filter_noise?: boolean;
        readonly filterNoise?: boolean;
    }): AnnotationRow[];
    getDistinctValues(kind: string): string[];
    exportAll(): AnnotationRow[];
    importAll(annotations: readonly AnnotationInput[], force?: boolean): AnnotationImportStats;
}
export declare function addAnnotation(memoryId: string, kind: string, value: string, source?: string, confidence?: number, path?: string): number;
export interface QueryAnnotationsOptions {
    readonly memory_id?: string | null;
    readonly memoryId?: string | null;
    readonly kind?: string | null;
    readonly value?: string | null;
    readonly db_path?: string | null;
    readonly dbPath?: string | null;
}
export declare function queryAnnotations(options?: QueryAnnotationsOptions): AnnotationRow[];
export declare function queryAnnotations(memoryId?: string | null, kind?: string | null, value?: string | null, dbPath?: string | null): AnnotationRow[];
export {};
