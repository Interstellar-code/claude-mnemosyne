export declare const ENTITY_EXTRACTION_STOP_WORDS: ReadonlySet<string>;
/** Maximum raw text size for regex-only entity extraction. */
export declare const REGEX_EXTRACTION_MAX_INPUT_CHARS = 50000;
export declare function levenshteinDistance(s1: string, s2: string): number;
export declare function similarity(s1: string, s2: string): number;
export declare function extractEntitiesRegex(text: string): string[];
export type SimilarEntity = readonly [entity: string, score: number];
export declare function findSimilarEntities(entity: string, knownEntities: readonly string[], threshold?: number): SimilarEntity[];
export declare function entityExtractionPerformance(text: string, iterations?: number): number;
