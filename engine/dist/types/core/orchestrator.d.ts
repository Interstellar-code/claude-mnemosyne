import type { BeamMemoryState, RecallOptions, RecallResult } from "./beam/types.js";
import { type PolyphonicMemoryResult, type PolyphonicRecallOptions } from "./polyphonic-recall.js";
export interface OrchestratorBeam extends BeamMemoryState {
    recall?: (query: string, topK?: number, options?: RecallOptions) => Promise<RecallResult[]>;
    recallEnhanced?: (query: string, topK?: number, options?: RecallOptions) => Promise<RecallResult[]>;
}
export interface OrchestrateRecallOptions extends Omit<RecallOptions, "queryEmbedding">, Omit<PolyphonicRecallOptions, "queryEmbedding" | "channelId" | "queryTime"> {
    readonly queryEmbedding?: readonly number[] | Float32Array | null;
    readonly enhanced?: boolean;
    readonly forcePolyphonic?: boolean;
    readonly forceLinear?: boolean;
}
/** Linear recall rows, or polyphonic rows that also carry `combined_score`. */
export interface OrchestratedRecallResult extends RecallResult {
    combined_score?: PolyphonicMemoryResult["combined_score"];
}
/**
 * Pick the recall path for one query. Polyphonic recall runs when forced or when
 * the gate is on for this beam (`MNEMOPI_POLYPHONIC_RECALL`, then the beam's
 * `polyphonicRecall` config, then the process-wide default); otherwise the beam's
 * linear `recall` / `recallEnhanced` surface answers.
 */
export declare function orchestrateRecall(beam: OrchestratorBeam, query: string, topK?: number, options?: OrchestrateRecallOptions): Promise<OrchestratedRecallResult[]>;
