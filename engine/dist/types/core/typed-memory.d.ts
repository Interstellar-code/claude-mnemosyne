export declare const MemoryType: {
    readonly FACT: "fact";
    readonly PREFERENCE: "preference";
    readonly DECISION: "decision";
    readonly COMMITMENT: "commitment";
    readonly GOAL: "goal";
    readonly EVENT: "event";
    readonly INSTRUCTION: "instruction";
    readonly RELATIONSHIP: "relationship";
    readonly CONTEXT: "context";
    readonly LEARNING: "learning";
    readonly OBSERVATION: "observation";
    readonly ERROR: "error";
    readonly ARTIFACT: "artifact";
    readonly UNKNOWN: "unknown";
};
export type MemoryType = (typeof MemoryType)[keyof typeof MemoryType];
export type TypePriority = "stable" | "moderate" | "high" | "time_critical" | "decaying" | "accumulating" | "evolving" | "persistent" | "reference";
export interface TypeMatch {
    memory_type: MemoryType;
    memoryType: MemoryType;
    confidence: number;
    matched_pattern: string;
    matchedPattern: string;
    priority: TypePriority;
}
export type TypePattern = readonly [
    pattern: string,
    memoryType: MemoryType,
    baseConfidence: number,
    priority: TypePriority
];
export declare const TYPE_PATTERNS: readonly TypePattern[];
export declare const CONFIDENCE_BOOSTERS: Readonly<Record<MemoryType, readonly string[]>>;
export declare function classifyMemory(content: string): TypeMatch;
export declare function classifyBatch(contents: readonly string[]): TypeMatch[];
export declare function getTypePriority(memoryType: MemoryType | string): number;
export declare function shouldConsolidate(memoryType: MemoryType | string): boolean;
export declare function getDecayRate(memoryType: MemoryType | string): number;
