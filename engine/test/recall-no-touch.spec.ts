// mnemosyne change 2 (engine/UPSTREAM.md): mnemopi_recall takes
// update_recall_counts, default true; false leaves recall_count and
// last_recalled alone. Real temporary stores, real engine processes.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";
import { BeamMemory } from "../src/core/beam";
import { RECALL_SCHEMA } from "../src/mcp-tools";
import { mcp, remember, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const counts = (dir: string, ids: readonly string[]) =>
	ids.map(id => {
		const r = row(dir, id);
		return { id, recall_count: r?.recall_count, last_recalled: r?.last_recalled };
	});
const ids = (body: Record<string, unknown>) => (body.results as { id: string }[]).map(r => r.id);

test("RECALL_SCHEMA has update_recall_counts, a boolean defaulting to true", () => {
	expect(RECALL_SCHEMA.properties.update_recall_counts).toMatchObject({ type: "boolean", default: true });
});

test("update_recall_counts false returns the same rows and leaves the counts; without it they bump", async () => {
	const stored = [
		await remember(store.dir, "o1", "the heron nests by the quiet lake"),
		await remember(store.dir, "o1", "a heron fishes in the lake at dawn"),
	];
	const [untouched, again] = await mcp(store.dir, "o1", [
		["mnemopi_recall", { query: "heron lake", update_recall_counts: false }],
		["mnemopi_recall", { query: "heron lake", update_recall_counts: false }],
	]);
	expect(ids(untouched!.body).sort()).toEqual([...stored].sort());
	expect(counts(store.dir, stored)).toEqual(stored.map(id => ({ id, recall_count: 0, last_recalled: null })));

	const [counted] = await mcp(store.dir, "o1", [["mnemopi_recall", { query: "heron lake" }]]);
	expect(ids(counted!.body)).toEqual(ids(untouched!.body));
	expect(ids(again!.body)).toEqual(ids(untouched!.body));
	for (const entry of counts(store.dir, stored)) {
		expect(entry.recall_count).toBe(1);
		expect(entry.last_recalled).not.toBeNull();
	}

	const before = counts(store.dir, stored);
	await mcp(store.dir, "o1", [["mnemopi_recall", { query: "heron lake", update_recall_counts: false }]]);
	expect(counts(store.dir, stored)).toEqual(before);
	await mcp(store.dir, "o1", [["mnemopi_recall", { query: "heron lake", update_recall_counts: true }]]);
	expect(counts(store.dir, stored).map(entry => entry.recall_count)).toEqual([2, 2]);
});

test("the enhanced and cached recall paths honour updateRecallCounts false too", async () => {
	const previous = process.env.MNEMOPI_ENHANCED_RECALL;
	process.env.MNEMOPI_ENHANCED_RECALL = "1";
	const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "enhanced.db") });
	try {
		const id = beam.remember("the kestrel hovers over the meadow", { source: "imported", scope: "global" });
		const read = () => beam.db.query("SELECT recall_count, last_recalled FROM working_memory WHERE id = ?").get(id);
		const first = await beam.recallEnhanced("kestrel meadow", 5, { updateRecallCounts: false } as never);
		const cached = await beam.recallEnhanced("kestrel meadow", 5, { updateRecallCounts: false } as never);
		expect(first.map(r => r.id)).toContain(id);
		expect(cached.map(r => r.id)).toEqual(first.map(r => r.id));
		expect(beam.caches.queryCache).toBeDefined(); // the second call could be served from the cache
		expect(read()).toEqual({ recall_count: 0, last_recalled: null });
		await beam.recallEnhanced("kestrel meadow", 5);
		expect((read() as { recall_count: number }).recall_count).toBe(1);
	} finally {
		beam.close();
		if (previous === undefined) delete process.env.MNEMOPI_ENHANCED_RECALL;
		else process.env.MNEMOPI_ENHANCED_RECALL = previous;
	}
});
