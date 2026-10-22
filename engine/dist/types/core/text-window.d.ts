/** Default character budget for a single embedding or fact-extraction input. */
export declare const DEFAULT_INPUT_CHARS = 8192;
/** Preserve the opening context and newest turns of an oversized chronological input. */
export declare function clipToWindow(text: string, max: number): string;
