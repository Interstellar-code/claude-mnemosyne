// Issue #10: the number+unit metric regex ended in `\b`, which never holds after `%` unless a word
// character follows, so "40% this week", "40%." and a trailing "40%" produced no pct fact.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { BeamMemory } from "../src/core/beam";
import { tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

function metrics(content: string): { key: string; value: string }[] {
	const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "mnemopi.db") });
	try {
		beam.extractAndStoreFacts(content);
		return beam.db
			.query("SELECT key, value FROM memoria_facts WHERE fact_type = 'metric' ORDER BY id")
			.all() as { key: string; value: string }[];
	} finally {
		beam.close();
	}
}

describe("#10: percent metrics", () => {
	test.each([
		["40% this week", "pct", "40%"],
		["conversion is 40%.", "conversion_pct", "40%"],
		["ends at 95%", "ends_pct", "95%"],
		["95% of users", "pct", "95%"],
	])("%p yields the pct fact", (content, key, value) => {
		expect(metrics(content)).toContainEqual({ key, value });
	});

	test.each([
		["latency 200 ms", "latency_ms", "200ms"],
		["took 3 days", "took_day", "3days"],
		["payload 12KB", "payload_kb", "12KB"],
	])("%p keeps its existing unit match", (content, key, value) => {
		expect(metrics(content)).toEqual([{ key, value }]);
	});

	test.each([["sent 5 msgs"], ["about 5 msecs"], ["3 daysago"]])("%p is still not a metric", content => {
		expect(metrics(content)).toEqual([]);
	});
});
