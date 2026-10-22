export type QueryIntentCategory = "temporal" | "factual" | "entity" | "preference" | "procedural" | "general";
export interface QueryIntent {
    readonly category: QueryIntentCategory;
    readonly confidence: number;
    readonly signals: QueryIntentCategory[];
    readonly vec_bias: number;
    readonly fts_bias: number;
    readonly importance_bias: number;
}
export interface IntentWeights {
    readonly vec_bias: number;
    readonly fts_bias: number;
    readonly importance_bias: number;
}
type IntentPatternGroup = readonly [QueryIntentCategory, readonly RegExp[]];
export declare const INTENT_PATTERNS: readonly IntentPatternGroup[];
export declare const INTENT_WEIGHTS: Record<QueryIntentCategory, IntentWeights>;
export declare function classifyIntent(query: string): QueryIntent;
export declare function adjustWeights(baseVec?: number, baseFts?: number, baseImportance?: number, intent?: QueryIntent | null): [number, number, number];
export {};
