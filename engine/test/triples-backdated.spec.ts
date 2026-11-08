// Issue #15: a backdated add() must be stored as closed history, not close the current row into a negative range.
import { describe, expect, test } from "bun:test";
import { TripleStore } from "../src/core/triples";

describe("TripleStore.add with an older valid_from", () => {
	test("keeps the current row open and stores the older fact as closed history", () => {
		const store = new TripleStore(":memory:");
		try {
			store.add("alice", "works_at", "Acme", { validFrom: "2026-01-01" });
			store.add("alice", "works_at", "Initech", { validFrom: "2024-01-01" });

			const now = store.query({ subject: "alice", predicate: "works_at" });
			expect(now.map(r => r.object)).toEqual(["Acme"]);

			const past = store.query({ subject: "alice", predicate: "works_at", asOf: "2025-06-01" });
			expect(past.map(r => r.object)).toEqual(["Initech"]);

			const rows = store.exportAll();
			for (const row of rows) {
				if (row.valid_until !== null) expect(row.valid_until >= row.valid_from).toBe(true);
			}
			expect(rows.find(r => r.object === "Acme")?.valid_until).toBeNull();
			expect(rows.find(r => r.object === "Initech")?.valid_until).toBe("2026-01-01");
		} finally {
			store.close();
		}
	});

	test("a later valid_from still closes the open row", () => {
		const store = new TripleStore(":memory:");
		try {
			store.add("bob", "lives_in", "Oslo", { validFrom: "2024-01-01" });
			store.add("bob", "lives_in", "Bergen", { validFrom: "2025-01-01" });
			const rows = store.exportAll();
			expect(rows.find(r => r.object === "Oslo")?.valid_until).toBe("2025-01-01");
			expect(rows.find(r => r.object === "Bergen")?.valid_until).toBeNull();
		} finally {
			store.close();
		}
	});
});
