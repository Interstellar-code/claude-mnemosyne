// Issue #17: the temporal voice's trigger matches its keywords on word boundaries, so words that
// merely contain one (Chicago, Elasticsearch, plastic, beforehand) do not switch it on.
import { expect, test } from "bun:test";
import { looksTemporal } from "../src/core/polyphonic-recall";

test("looksTemporal ignores keywords embedded in other words", () => {
	for (const q of ["Chicago office", "Elasticsearch plastic", "beforehand", "blast radius", "Atlas lasting"]) {
		expect(looksTemporal(q)).toBe(false);
	}
});

test("looksTemporal still fires on whole keywords and phrases", () => {
	for (const q of [
		"2 days ago",
		"last week",
		"before the release",
		"today",
		"what changed this week?",
		"Latest deploy",
		"Yesterday's notes",
	]) {
		expect(looksTemporal(q)).toBe(true);
	}
});
