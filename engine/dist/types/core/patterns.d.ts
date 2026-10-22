export interface CompressionStatsInit {
    readonly originalSize?: number;
    readonly compressedSize?: number;
    readonly ratio?: number;
    readonly method?: string;
    readonly patternsFound?: number;
    readonly memoriesCompressed?: number;
}
export declare class CompressionStats {
    originalSize: number;
    compressedSize: number;
    ratio: number;
    method: string;
    patternsFound: number;
    memoriesCompressed: number;
    constructor(init?: CompressionStatsInit);
    get savingsPercent(): number;
}
export type MemoryRecord = Record<string, unknown> & {
    content?: string;
    timestamp?: string;
    created_at?: string;
    source?: string;
};
export declare class MemoryCompressor {
    readonly dictionary: Readonly<Record<string, string>>;
    constructor(dictionary?: Readonly<Record<string, string>>);
    static buildDefaultDict(): Record<string, string>;
    compress(content: string, method?: string): readonly [string, CompressionStats];
    private dictCompress;
    private rleCompress;
    private semanticCompressSingle;
    compressBatch(memories: readonly MemoryRecord[], method?: string): readonly [MemoryRecord[], CompressionStats];
    decompress(content: string, method?: string): string;
}
export interface DetectedPatternInit {
    readonly patternType?: string;
    readonly pattern_type?: string;
    readonly description: string;
    readonly confidence: number;
    readonly samples?: readonly string[];
    readonly metadata?: Record<string, unknown>;
}
export declare class DetectedPattern {
    patternType: string;
    description: string;
    confidence: number;
    samples: string[];
    metadata: Record<string, unknown>;
    constructor(init: DetectedPatternInit);
    toDict(): Record<string, unknown>;
}
export declare class PatternDetector {
    readonly minConfidence: number;
    constructor(minConfidence?: number);
    detectTemporal(memories: readonly MemoryRecord[]): DetectedPattern[];
    detectContent(memories: readonly MemoryRecord[]): DetectedPattern[];
    detectSequence(memories: readonly MemoryRecord[]): DetectedPattern[];
    detectAll(memories: readonly MemoryRecord[]): DetectedPattern[];
    summarizePatterns(memories: readonly MemoryRecord[]): Record<string, unknown>;
}
