import { type FetchImpl } from "@oh-my-pi/pi-ai";
import { type CompleteOptions } from "./llm-backends.js";
import { type MnemopiLlmCompleteOptions } from "./runtime-options.js";
export interface RemoteLlmOptions {
    fetch?: FetchImpl;
}
export declare const DEFAULT_MODEL_REPO: string;
export declare const DEFAULT_MODEL_FILE: string;
export declare function buildPrompt(memories: readonly string[], source?: string): string;
export declare function callConfiguredCompletion(prompt: string, temperature: number, opts?: MnemopiLlmCompleteOptions): Promise<string | null>;
export declare function buildHostPrompt(memories: readonly string[], source?: string): string;
export declare function configuredLlmWillHandleCall(): boolean;
export declare function cleanOutput(text: string): string;
export declare function chunkMemoriesByBudget(memories: readonly string[], source?: string): string[][];
export declare function llmAvailable(): boolean;
export declare function callRemoteLlm(prompt: string, temperature?: number, options?: RemoteLlmOptions): Promise<string | null>;
export declare function localGgufAvailable(): false;
export declare function callLocalLlm(_prompt: string): Promise<string | null>;
export declare function summarizeMemories(memories: readonly string[], source?: string, options?: RemoteLlmOptions): Promise<string | null>;
export declare function complete(prompt: string, temperature?: number, options?: CompleteOptions): Promise<string | null>;
