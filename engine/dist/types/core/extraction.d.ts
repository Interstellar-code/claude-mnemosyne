import { type RemoteLlmOptions } from "./local-llm.js";
export declare const EXTRACTION_PROMPT_TEMPLATE: string;
export declare function buildExtractionPrompt(text: string, detectedLang?: string): string;
/** Parsed knowledge-graph edge emitted by the extractor LLM. */
export interface ExtractedKgTriple {
    subject: string;
    predicate: string;
    object: string;
}
/** Category-preserving extraction result used by background memory routing. */
export interface ExtractedFactCategories {
    facts: string[];
    instructions: string[];
    preferences: string[];
    timelines: string[];
    kg: ExtractedKgTriple[];
}
/** Flatten extracted string categories for legacy fact callers. */
export declare function flattenExtractedFactCategories(extracted: ExtractedFactCategories): string[];
/** Count string facts plus KG triples in a category-preserving extraction result. */
export declare function countExtractedFactCategories(extracted: ExtractedFactCategories): number;
/** Parse extractor output without discarding MEMORIA categories or KG triples. */
export declare function parseExtractedFactCategories(rawOutput: string | null | undefined): ExtractedFactCategories;
/** Parse extractor output into the legacy flat string fact list. */
export declare function parseFacts(rawOutput: string | null | undefined): string[];
export declare function heuristicExtractFacts(text: string): string[];
/** Extract fact categories from text using configured, host, local, or remote LLMs. */
export declare function extractFactCategories(text: string | null | undefined, options?: RemoteLlmOptions): Promise<ExtractedFactCategories>;
/** Extract legacy flat fact strings from text. */
export declare function extractFacts(text: string | null | undefined, options?: RemoteLlmOptions): Promise<string[]>;
/** Safely extract category-preserving facts, swallowing best-effort failures. */
export declare function extractFactCategoriesSafe(text: string | null | undefined): Promise<ExtractedFactCategories>;
/** Safely extract legacy flat fact strings, swallowing best-effort failures. */
export declare function extractFactsSafe(text: string | null | undefined): Promise<string[]>;
