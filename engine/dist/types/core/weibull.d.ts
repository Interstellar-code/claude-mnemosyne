export type MemoryType = keyof typeof WEIBULL_PARAMS;
export interface WeibullParams {
    readonly k: number;
    readonly eta: number;
}
export declare const WEIBULL_PARAMS: {
    readonly profile: {
        readonly k: 0.3;
        readonly eta: 8760;
    };
    readonly preference: {
        readonly k: 0.4;
        readonly eta: 4380;
    };
    readonly relationship: {
        readonly k: 0.35;
        readonly eta: 8760;
    };
    readonly learning: {
        readonly k: 0.7;
        readonly eta: 1440;
    };
    readonly fact: {
        readonly k: 0.8;
        readonly eta: 720;
    };
    readonly entity: {
        readonly k: 0.5;
        readonly eta: 4380;
    };
    readonly setup: {
        readonly k: 0.6;
        readonly eta: 2160;
    };
    readonly pattern: {
        readonly k: 0.6;
        readonly eta: 1680;
    };
    readonly context: {
        readonly k: 0.85;
        readonly eta: 360;
    };
    readonly observation: {
        readonly k: 0.9;
        readonly eta: 480;
    };
    readonly artifact: {
        readonly k: 0.75;
        readonly eta: 2160;
    };
    readonly project: {
        readonly k: 0.85;
        readonly eta: 1080;
    };
    readonly goal: {
        readonly k: 0.9;
        readonly eta: 720;
    };
    readonly decision: {
        readonly k: 1;
        readonly eta: 336;
    };
    readonly commitment: {
        readonly k: 1;
        readonly eta: 240;
    };
    readonly event: {
        readonly k: 1.2;
        readonly eta: 168;
    };
    readonly instruction: {
        readonly k: 0.9;
        readonly eta: 480;
    };
    readonly error: {
        readonly k: 1.1;
        readonly eta: 336;
    };
    readonly issue: {
        readonly k: 1.1;
        readonly eta: 336;
    };
    readonly request: {
        readonly k: 1.5;
        readonly eta: 72;
    };
    readonly general: {
        readonly k: 1;
        readonly eta: 168;
    };
};
export declare const DEFAULT_HALFLIFE_HOURS = 168;
type TimestampInput = string | Date | null | undefined;
export declare function weibullBoost(timestamp: TimestampInput, queryTime?: Date | null, memoryType?: string, halflifeHours?: number | null): number;
export declare function weibullDecayFactor(ageHours: number, memoryType?: string): number;
export {};
