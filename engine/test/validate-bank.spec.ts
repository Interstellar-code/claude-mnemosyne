// Issue #13: mnemopi_validate offers bank 'private' or 'surface'. 'private' is the main store (the bank the
// other tools use by default) and 'surface' is the shared surface store (mnemopi_shared_*); neither may open
// a stray banks/<name> folder. Real temporary stores, real engine processes.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mcp, remember, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";
delete process.env.MNEMOPI_SHARED_SURFACE_DB;

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

test("bank 'private' validates a memory in the main store", async () => {
	const id = await remember(store.dir, "o1", "private fact");
	const [reply] = await mcp(store.dir, "o1", [
		["mnemopi_validate", { memory_id: id, action: "update", new_content: "private fact, corrected", bank: "private" }],
	]);
	expect(reply?.body.status).toBe("validation_update");
	expect(row(store.dir, id)?.content).toBe("private fact, corrected");
	expect(existsSync(join(store.dir, "banks", "private"))).toBe(false);
});

test("bank 'surface' validates a memory in the shared surface store", async () => {
	const [stored] = await mcp(store.dir, "o1", [["mnemopi_shared_remember", { content: "use tabs", kind: "preference" }]]);
	const id = stored?.body.memory_id as string;
	expect(typeof id).toBe("string");
	const [reply] = await mcp(store.dir, "o1", [
		["mnemopi_validate", { memory_id: id, action: "update", new_content: "Surface preference: use spaces", bank: "surface" }],
	]);
	expect(reply?.body.status).toBe("validation_update");
	const db = new Database(join(store.dir, "shared", "mnemopi.db"));
	try {
		const r = db.query("SELECT content FROM working_memory WHERE id = ?").get(id) as { content: string } | null;
		expect(r?.content).toBe("Surface preference: use spaces");
	} finally {
		db.close();
	}
	expect(existsSync(join(store.dir, "banks", "surface"))).toBe(false);
});
