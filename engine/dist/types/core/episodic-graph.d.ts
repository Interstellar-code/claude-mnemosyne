import type { Database } from "bun:sqlite";
import { type DatabasePath } from "../db.js";
export interface Gist {
    readonly id: string;
    readonly text: string;
    readonly timestamp: string;
    readonly participants: readonly string[];
    readonly location: string | null;
    readonly emotion: string | null;
    readonly timeScope: string | null;
}
export interface Fact {
    readonly id: string;
    readonly subject: string;
    readonly predicate: string;
    readonly object: string;
    readonly timestamp: string;
    readonly confidence: number;
    readonly temporalQualifier?: string | null;
    /** Memory the fact was extracted from (`facts.source_msg_id`), when stored. */
    readonly memoryId?: string | null;
}
export interface GraphEdge {
    readonly source: string;
    readonly target: string;
    readonly edgeType: string;
    readonly weight: number;
    readonly timestamp: string;
}
export interface RelatedMemory {
    readonly memoryId: string;
    readonly edgeType: string;
    readonly weight: number;
    readonly depth: number;
}
export interface GraphStats {
    readonly gists: number;
    readonly facts: number;
    readonly edges: number;
    readonly totalNodes: number;
}
export interface IngestOptions {
    readonly sessionId?: string;
    readonly linkExisting?: boolean;
    readonly minLinkScore?: number;
    readonly extractEntities?: boolean;
}
export interface IngestResult {
    readonly memoryId: string;
    readonly gist: Gist;
    readonly facts: readonly Fact[];
    readonly edges: readonly GraphEdge[];
}
export interface EpisodicGraphOptions {
    readonly db?: Database;
    readonly dbPath?: DatabasePath;
}
export declare class EpisodicGraph {
    readonly db: Database;
    readonly dbPath: DatabasePath;
    readonly ownsConnection: boolean;
    constructor(options?: EpisodicGraphOptions);
    private initTables;
    extractGist(content: string, memoryId: string): Gist;
    extractFacts(content: string, memoryId: string): Fact[];
    storeGist(gist: Gist, memoryId: string): void;
    getGist(id: string): Gist | null;
    storeFact(fact: Fact, memoryId: string, sessionId?: string): void;
    getFact(id: string): Fact | null;
    addEdge(edge: GraphEdge): void;
    getEdges(source?: string | null): GraphEdge[];
    findRelatedMemories(memoryId: string, depth?: number, edgeType?: string, minWeight?: number): RelatedMemory[];
    /**
     * Edges touching any of `nodeIds` in one query, strongest first, at most `limit` rows.
     * Batched frontier expansion for bounded traversals; see {@link findRelatedMemories}
     * for the per-node walk.
     */
    findEdgesTouching(nodeIds: readonly string[], edgeType: string, minWeight: number, limit: number): GraphEdge[];
    findFactsBySubject(subject: string): Fact[];
    findGistsByParticipant(participant: string): Gist[];
    scoreMemoryLink(sourceMemoryId: string, targetMemoryId: string): number;
    ingestMemory(content: string, memoryId: string, options?: IngestOptions): IngestResult;
    getStats(): GraphStats;
    close(): void;
    private count;
    private extractParticipants;
    private extractTemporalScope;
    private extractLocation;
    private extractEmotion;
    private createSummary;
    private knownMemoryIds;
    private memoryContent;
    private entityOverlapScore;
    private memoryFeatures;
    private scoreFeatures;
}
