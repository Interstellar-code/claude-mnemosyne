import { type QueryTime } from "../util/datetime.js";
export type DatePrecision = "day" | "week" | "month" | "year" | "relative" | "unknown";
export type ParsedNaturalDate = [eventDate: Date, precision: Exclude<DatePrecision, "unknown">, temporalTags: string[]];
export interface TemporalInfo {
    event_date: string | null;
    event_date_precision: DatePrecision;
    temporal_tags: string[];
    primary_signal: string | null;
}
export declare const DAY_MAP: Readonly<Record<string, number>>;
export declare const MONTH_MAP: Readonly<Record<string, number>>;
export declare const NAMED_TIMES: Readonly<Record<string, readonly [startHour: number, endHour: number]>>;
export declare function resolveRelativeDay(reference: Date, dayNameText: string, qualifier?: string): Date;
export declare function parseNlDate(text: string, reference?: QueryTime): ParsedNaturalDate | null;
export declare function extractTemporal(text: string, reference?: QueryTime): TemporalInfo;
export declare function extractDateFromText(text: string, reference?: QueryTime): string | null;
