import { type ApiKey, type FetchImpl } from "@oh-my-pi/pi-ai";
export declare const DEFAULT_EXTRACTION_MODEL: string;
export declare const OPENROUTER_BASE_URL: string;
export declare const FALLBACK_MODELS: readonly ["google/gemini-flash-latest"];
export interface ChatMessage {
    role: string;
    content: string;
}
export interface ExtractedFact {
    subject?: string;
    predicate?: string;
    object?: string;
    timestamp?: string;
    source?: number;
    confidence?: number;
    [key: string]: unknown;
}
export interface ExtractionClientOptions {
    model?: string | null;
    apiKey?: ApiKey | null;
    baseUrl?: string | null;
    fetch?: FetchImpl;
}
export declare class ExtractionClient {
    model: string;
    apiKey: ApiKey;
    baseUrl: string;
    callCount: number;
    private readonly fetchImpl;
    constructor(opts?: ExtractionClientOptions);
    chat(messages: readonly ChatMessage[], temperature?: number, maxTokens?: number): Promise<string>;
    callApi(model: string, messages: readonly ChatMessage[], temperature: number, maxTokens: number, apiKey?: string): Promise<string>;
    extractFacts(messages: readonly ChatMessage[]): Promise<ExtractedFact[]>;
    xtractFacts(messages: readonly ChatMessage[]): Promise<ExtractedFact[]>;
}
