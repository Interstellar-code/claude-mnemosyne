import type { Database } from "bun:sqlite";
export declare const ALLOWED_DELTA_TABLES: Set<"episodic_memory" | "working_memory">;
export type DeltaTable = "working_memory" | "episodic_memory";
export declare enum EventType {
    MEMORY_ADDED = "MEMORY_ADDED",
    MEMORY_RECALLED = "MEMORY_RECALLED",
    MEMORY_INVALIDATED = "MEMORY_INVALIDATED",
    MEMORY_CONSOLIDATED = "MEMORY_CONSOLIDATED",
    MEMORY_UPDATED = "MEMORY_UPDATED"
}
export interface MemoryEventInit {
    readonly eventType?: string;
    readonly event_type?: string;
    readonly memoryId?: string;
    readonly memory_id?: string;
    readonly timestamp?: string;
    readonly sessionId?: string | null;
    readonly session_id?: string | null;
    readonly content?: string | null;
    readonly source?: string | null;
    readonly importance?: number | null;
    readonly metadata?: Record<string, unknown> | null;
    readonly delta?: Record<string, unknown> | null;
}
export type MemoryEventDict = {
    event_type: string;
    memory_id: string;
    timestamp: string;
    session_id?: string | null;
    content?: string | null;
    source?: string | null;
    importance?: number | null;
    metadata?: Record<string, unknown> | null;
    delta?: Record<string, unknown> | null;
};
export declare class MemoryEvent {
    readonly eventType: EventType;
    readonly memoryId: string;
    readonly timestamp: string;
    readonly sessionId: string | null;
    readonly content: string | null;
    readonly source: string | null;
    readonly importance: number | null;
    readonly metadata: Record<string, unknown> | null;
    readonly delta: Record<string, unknown> | null;
    constructor(init: MemoryEventInit);
    toDict(): MemoryEventDict;
    toJSON(): string;
    static fromDict(data: MemoryEventDict | MemoryEventInit): MemoryEvent;
}
export type MemoryEventHandler = (event: MemoryEvent) => void;
export declare class StreamIterator implements AsyncIterable<MemoryEvent>, AsyncIterator<MemoryEvent> {
    private readonly stream;
    private readonly eventTypes;
    private readonly queue;
    private readonly waiters;
    private closed;
    constructor(stream: MemoryStream, eventTypes?: readonly EventType[] | null);
    push(event: MemoryEvent): void;
    next(): Promise<IteratorResult<MemoryEvent>>;
    return(): Promise<IteratorResult<MemoryEvent>>;
    [Symbol.asyncIterator](): AsyncIterator<MemoryEvent>;
}
export declare class MemoryStream {
    private readonly maxBuffer;
    private readonly callbacks;
    private readonly anyCallbacks;
    private readonly buffer;
    private readonly iterators;
    constructor(maxBuffer?: number);
    on(eventType: EventType, callback: MemoryEventHandler): void;
    onAny(callback: MemoryEventHandler): void;
    off(eventType: EventType, callback: MemoryEventHandler): void;
    offAny(callback: MemoryEventHandler): void;
    emit(event: MemoryEvent): void;
    listen(eventTypes?: readonly EventType[] | null): StreamIterator;
    removeIterator(iterator: StreamIterator): void;
    getBuffer(eventTypes?: readonly EventType[] | null, since?: string | null): MemoryEvent[];
    clearBuffer(): void;
}
export interface SyncCheckpointInit {
    readonly peerId?: string;
    readonly peer_id?: string;
    readonly lastSyncAt?: string;
    readonly last_sync_at?: string;
    readonly lastRowid?: number;
    readonly last_rowid?: number;
    readonly checksum?: string;
}
export declare class SyncCheckpoint {
    readonly peerId: string;
    readonly lastSyncAt: string;
    readonly lastRowid: number;
    readonly checksum: string | null;
    constructor(init: SyncCheckpointInit);
    toDict(): Record<string, unknown>;
    toJson(): string;
    static fromJSON(text: string): SyncCheckpoint;
}
type MemoryHost = {
    readonly conn?: Database;
    readonly db?: Database;
    readonly dbPath?: string;
    readonly db_path?: string;
};
export declare class DeltaSync {
    readonly mnemopi: MemoryHost;
    readonly checkpointDir: string;
    private readonly db;
    constructor(mnemopi: MemoryHost, checkpointDir?: string);
    private checkpointPath;
    private legacyCheckpointPath;
    getCheckpoint(peerId: string, table?: DeltaTable): SyncCheckpoint | null;
    saveCheckpoint(checkpoint: SyncCheckpoint, table?: DeltaTable): void;
    setCheckpoint(peerId: string, checkpoint: SyncCheckpoint, table?: DeltaTable): void;
    computeDelta(peerId: string, table?: DeltaTable): Record<string, unknown>[];
    applyDelta(peerId: string, delta: readonly Record<string, unknown>[], table?: DeltaTable): {
        inserted: number;
        updated: number;
        skipped: number;
        filtered_keys: number;
    };
    syncTo(peerId: string, table?: DeltaTable): {
        delta: Record<string, unknown>[];
        count: number;
    };
    syncFrom(peerId: string, delta: readonly Record<string, unknown>[], table?: DeltaTable): {
        stats: {
            inserted: number;
            updated: number;
            skipped: number;
            filtered_keys: number;
        };
    };
}
export {};
