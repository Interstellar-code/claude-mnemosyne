// Issue #23: confidence boosters must match as whole words/phrases, not raw substrings.
import { describe, expect, test } from "bun:test";
import { classifyMemory, MemoryType } from "../src/core/typed-memory";

describe("confidence boosters match whole words (#23)", () => {
	test("'at'/'on' inside other words give no event boost", () => {
		// "incident 42" -> EVENT 0.8 base, +0.05 for an 11-char match; no real booster words.
		const plain = classifyMemory("incident 42 logged");
		const inside = classifyMemory("incident 42 logged database configuration");
		expect(plain.memoryType).toBe(MemoryType.EVENT);
		expect(plain.confidence).toBeCloseTo(0.85, 5);
		expect(inside.memoryType).toBe(MemoryType.EVENT);
		expect(inside.confidence).toBeCloseTo(0.85, 5);
	});

	test("'at'/'on' as whole words still boost", () => {
		const real = classifyMemory("incident 42 logged at 3pm on friday");
		expect(real.memoryType).toBe(MemoryType.EVENT);
		expect(real.confidence).toBeCloseTo(0.95, 5);
	});

	test("a false event boost no longer beats a better type", () => {
		// LEARNING "turns out" 0.7 * 1.9 = 1.33 beats EVENT 0.85 * 1.5 = 1.275, but a false +0.10 made EVENT 1.425.
		const m = classifyMemory("incident 42 turns out the database configuration");
		expect(m.memoryType).toBe(MemoryType.LEARNING);
	});
});
