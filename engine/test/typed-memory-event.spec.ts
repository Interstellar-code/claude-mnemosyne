import { describe, expect, test } from "bun:test";
import { classifyMemory, MemoryType, TYPE_PATTERNS } from "../src/core/typed-memory";

// The launched/released/shipped/deployed EVENT rule (#24).
const launchRule = TYPE_PATTERNS.find(([pattern]) => pattern.includes("launched"))?.[0] as string;

describe("typed-memory launched/released EVENT rule", () => {
	test.each([
		"launched on Monday",
		"- launched at 9am",
		"(launched on Friday)",
		"We launched on Monday",
		"released on Tuesday",
	])("%p is an EVENT by the launched rule", content => {
		const match = classifyMemory(content);
		expect(match.memory_type).toBe(MemoryType.EVENT);
		expect(match.matched_pattern).toBe(launchRule);
	});

	test.each(["unlaunched on Monday", "prereleased on Tuesday"])("%p does not match the launched rule", content => {
		expect(classifyMemory(content).matched_pattern).not.toBe(launchRule);
	});
});
