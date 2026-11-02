// engine/UPSTREAM.md change 19: mnemopi_remember says when the text was already stored.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcp, tempStore } from "./helpers";

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
