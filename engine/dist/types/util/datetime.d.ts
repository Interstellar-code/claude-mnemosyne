export type QueryTime = string | Date | null | undefined;
export declare function parseIsoDateTimeUtc(value: string): Date;
export declare function normalizeDateTimeUtc(value: Date): Date;
export declare function parseQueryTime(value: QueryTime): Date;
export declare function parseTsFast(value: string): Date | undefined;
export declare function toUtcIso(value?: Date): string;
export declare function recencyDecay(timestamp: string | Date | null | undefined, halflifeHours?: number, now?: Date): number;
export declare function temporalBoost(memoryTimestamp: string, queryTime?: QueryTime, halflifeHours?: number): number;
