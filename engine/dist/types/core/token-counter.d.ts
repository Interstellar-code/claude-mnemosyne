export interface CostEstimate {
    tokens: number;
    model: string;
    cost_usd: number;
    rate_per_1m: number;
}
export declare function estimateTokens(text: string, _model?: string): number;
export declare function estimateCost(tokens: number, model?: string): CostEstimate;
