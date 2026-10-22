export interface MmrResult {
    readonly content?: string;
    readonly score?: number;
    readonly [key: string]: unknown;
}
export type SimilarityFn = (textA: string, textB: string) => number;
export declare function jaccardSimilarity(textA: string, textB: string): number;
export declare function mmrRerank<T extends MmrResult>(results: readonly T[], lambdaParam?: number, topK?: number, similarityFn?: SimilarityFn): T[];
