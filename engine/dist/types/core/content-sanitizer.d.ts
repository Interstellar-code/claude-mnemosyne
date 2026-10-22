export declare const SIZE_HARD_CAP = 1000000;
export declare const SIZE_BASE64_CHECK = 100000;
export declare const ENTROPY_THRESHOLD = 5;
export interface BlobMetadata {
    blob_ref?: string;
    original_size?: number;
    mime?: string;
    extraction_reason?: "data_uri" | "size_cap" | "high_entropy";
    entropy?: number;
}
export declare function blobRoot(env?: NodeJS.ProcessEnv): string;
export declare function computeSha256(data: Uint8Array | string): string;
export declare function isDataUri(content: string): boolean;
export declare function parseDataUri(content: string): [mimeType: string, raw: Buffer] | null;
export declare function shannonEntropy(text: string): number;
export declare function looksLikeBase64Blob(content: string): boolean;
export declare function storeBlob(rawBytes: Uint8Array): string;
export declare function sanitizeContent(content: string): [sanitizedContent: string, blobMetadata: BlobMetadata];
