import { type ToolArguments, type ToolDefinition } from "./mcp-tools.js";
export interface JsonRpcRequest {
    readonly jsonrpc?: string;
    readonly id?: string | number | null;
    readonly method?: string;
    readonly params?: Record<string, unknown>;
}
export interface JsonRpcResponse {
    readonly jsonrpc: "2.0";
    readonly id: string | number | null;
    readonly result?: unknown;
    readonly error?: {
        readonly code: number;
        readonly message: string;
    };
}
export interface ListToolsResponse {
    readonly tools: readonly ToolDefinition[];
}
export interface CallToolContent {
    readonly type: "text";
    readonly text: string;
}
export interface CallToolResponse {
    readonly content: readonly CallToolContent[];
    readonly isError?: boolean;
}
export interface WritableOutput {
    write(chunk: string): unknown;
}
export declare function listToolsJson(): ListToolsResponse;
export declare function callToolJson(name: string, args?: ToolArguments): Promise<CallToolResponse>;
export declare function handleJsonRpc(request: JsonRpcRequest): Promise<JsonRpcResponse | null>;
export declare function runStdio(input?: ReadableStream<Uint8Array>, output?: WritableOutput): Promise<void>;
export declare function runMcpServer(transport?: string, options?: {
    port?: number;
    bank?: string;
    host?: string;
}): Promise<void>;
export declare function main(argv?: readonly string[]): Promise<void>;
