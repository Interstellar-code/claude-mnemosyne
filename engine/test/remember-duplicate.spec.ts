// engine/UPSTREAM.md change 19: mnemopi_remember says when the text was already stored.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcp, openDb, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

describe("change 19: the duplicate flag", () => {
	test("a new text is not a duplicate, the same text again is, with the same id and status stored", async () => {
		const text = "the staging database lives on port 5433";
		const [first] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: text }]]);
		const [second] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: text }]]);
		expect(first?.body.status).toBe("stored");
		expect(first?.body.duplicate).toBe(false);
		expect(second?.body.status).toBe("stored");
		expect(second?.body.duplicate).toBe(true);
		expect(second?.body.memory_id).toBe(first?.body.memory_id);
	});

	test("the same text under another owner is not a duplicate", async () => {
		const text = "release notes go in docs/changes";
		await mcp(store.dir, "o1", [["mnemopi_remember", { content: text }]]);
		const [other] = await mcp(store.dir, "o2", [["mnemopi_remember", { content: text }]]);
		expect(other?.body.duplicate).toBe(false);
	});
});

// Issue #16: re-saving the text of a retired or expired memory leaves it retired/expired and says so.
describe("issue 16: re-saving retired or expired content", () => {
	async function resave(text: string, id: string, expected: "retired" | "expired") {
		const before = row(store.dir, id);
		const [again, recall] = await mcp(store.dir, "o1", [
			["mnemopi_remember", { content: text, importance: 0.9, scope: "global" }],
			["mnemopi_recall", { query: text, limit: 10, update_recall_counts: false }],
		]);
		expect(again?.isError).toBe(false);
		expect(again?.body.status).toBe(expected);
		expect(again?.body.memory_id).toBe(id);
		expect(again?.body.duplicate).toBe(true);
		expect(String(again?.body.hint)).toContain("restore");
		expect(row(store.dir, id)).toEqual(before);
		expect(recall?.text).not.toContain(id);
	}

	test("a retired row stays retired and unchanged", async () => {
		const text = "the deploy key lives in vault path ops/deploy";
		const [first] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: text }]]);
		const id = first?.body.memory_id as string;
		// Retired = superseded_by set (a plain invalidate only ends valid_until, which reads as expired).
		const [next] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: "the deploy key moved to ops/keys" }]]);
		await mcp(store.dir, "o1", [["mnemopi_invalidate", { memory_id: id, replacement_id: next?.body.memory_id }]]);
		await resave(text, id, "retired");
	});

	test("an expired row stays expired and unchanged", async () => {
		const text = "the nightly build runs at 02:00 utc";
		const [first] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: text }]]);
		const id = first?.body.memory_id as string;
		const db = openDb(store.dir);
		db.run("UPDATE working_memory SET valid_until = '2000-01-01T00:00:00Z' WHERE id = ?", [id]);
		db.close();
		await resave(text, id, "expired");
	});

	test("a live duplicate still reports stored and is refreshed", async () => {
		const text = "the api gateway times out after 30 seconds";
		const [first] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: text }]]);
		const [second] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: text, importance: 0.9 }]]);
		expect(second?.body.status).toBe("stored");
		expect(second?.body.duplicate).toBe(true);
		expect(second?.body.memory_id).toBe(first?.body.memory_id);
		expect(second?.body.hint).toBeUndefined();
		expect(row(store.dir, first?.body.memory_id as string)?.importance).toBe(0.9);
	});
});
