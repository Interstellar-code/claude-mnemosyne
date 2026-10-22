type ExtractionRate = {
    total: number;
    survived: number;
    dropped: number;
    rate: number;
    dropped_samples: string[];
};
export declare function normalizeChat(text: string, options?: {
    add_implicit_subjects?: boolean;
}): string | null;
export declare function normalizeBatch(messages: string[]): (string | null)[];
export declare function extractionRate(messages: string[]): ExtractionRate;
export {};
