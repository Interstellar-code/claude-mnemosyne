import type { FetchImpl } from "@oh-my-pi/pi-ai";
export interface CompleteOptions {
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    provider?: string | null;
    model?: string | null;
    fetch?: FetchImpl;
}
export interface LlmBackend {
    name?: string;
    complete(prompt: string, opts?: CompleteOptions): string | null | Promise<string | null>;
}
export declare function setHostLlmBackend(backend: LlmBackend | null | undefined): void;
export declare function getHostLlmBackend(): LlmBackend | null;
export declare function resetHostLlmBackendForTests(): void;
export declare function callHostLlm(prompt: string, opts?: CompleteOptions): Promise<string | null>;
export declare class CallableLlmBackend implements LlmBackend {
    name: string;
    private readonly fn;
    constructor(name: string, fn: (prompt: string, opts?: CompleteOptions) => string | null | Promise<string | null>);
    complete(prompt: string, opts?: CompleteOptions): string | null | Promise<string | null>;
}
