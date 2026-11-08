// Issue #9: "the day before yesterday" must resolve two days back, not one (the yesterday check
// used to match it first, leaving the two-day branch dead).
import { describe, expect, test } from "bun:test";
import { extractDateFromText, parseNlDate } from "../src/core/temporal-parser";

const REF = "2026-03-11T12:00:00Z"; // a Wednesday

describe("parseNlDate relative days", () => {
	test("'the day before yesterday' is two days back", () => {
		const parsed = parseNlDate("we shipped it the day before yesterday", REF);
		expect(parsed?.[0].toISOString().slice(0, 10)).toBe("2026-03-09");
		expect(parsed?.[1]).toBe("day");
		expect(extractDateFromText("the day before yesterday", REF)).toBe("2026-03-09");
	});

	test("'yesterday' is still one day back", () => {
		const parsed = parseNlDate("we shipped it yesterday", REF);
		expect(parsed?.[0].toISOString().slice(0, 10)).toBe("2026-03-10");
		expect(parsed?.[2]).toContain("yesterday");
	});
});
