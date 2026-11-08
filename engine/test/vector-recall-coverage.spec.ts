// Issue #19: with a query embedding, vector similarity covers every visible row with a stored
// embedding, not only the 500 newest per tier. Real temporary store; embeddings written directly.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";
import { BeamMemory } from "../src/core/beam";
import { tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const DIMS = 8;
function axes(weights: Record<number, number>): number[] {
	const v = new Array<number>(DIMS).fill(0);
	for (const [i, w] of Object.entries(weights)) v[Number(i)] = w;
	return v;
}

test("the oldest memory, the only close embedding match with no shared keywords, is recalled past 500 rows", async () => {
	const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "vec.db") });
	try {
		const insertEmbedding = beam.db.query(
			"INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding_json, model) VALUES (?, ?, 'test')",
		);
		const setTime = beam.db.query("UPDATE working_memory SET timestamp = ? WHERE id = ?");
		const base = Date.now() - 1000 * 86_400_000;
		const oldest = beam.remember("the kestrel hovers over the quiet meadow at dusk", {
			source: "imported",
			scope: "global",
		});
		setTime.run(new Date(base).toISOString(), oldest);
		insertEmbedding.run(oldest, JSON.stringify(axes({ 0: 1 })));
		for (let i = 0; i < 520; i += 1) {
			const id = beam.remember(`filler note number ${i} about invoice ledger item ${i * 7}`, {
				source: "imported",
				scope: "global",
			});
			setTime.run(new Date(base + (i + 1) * 60_000).toISOString(), id);
			insertEmbedding.run(id, JSON.stringify(axes({ 1: 1 })));
		}
		const results = await beam.recall("zebra xylophone", 10, {
			queryEmbedding: axes({ 0: 1 }),
			updateRecallCounts: false,
		} as never);
		expect(results.map(r => r.id)).toContain(oldest);
	} finally {
		beam.close();
	}
});
