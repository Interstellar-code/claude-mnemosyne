// MODEL.1: the 24 h trim never deletes a row whose scope is not 'session'
// engine/UPSTREAM.md change 12: trimWorkingMemory spares channel and global rows.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcp, openDb, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const HOURS_48 = () => new Date(Date.now() - 48 * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");

/** Saves one memory as owner `o1` and returns its id. */
async function save(content: string, extra: Record<string, unknown>): Promise<string> {
	const [reply] = await mcp(store.dir, "o1", [["mnemopi_remember", { content, ...extra }]]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	return id;
}

/** Makes the row `age` old with the given tier, as the stored state the trim sees. */
function age(id: string, tier: string): void {
	const db = openDb(store.dir);
	try {
		db.run("UPDATE working_memory SET timestamp = ?, trust_tier = ?, consolidated_at = NULL WHERE id = ?", [
			HOURS_48(),
			tier,
			id,
		]);
	} finally {
		db.close();
	}
}

describe("MODEL.1: trim spares non-session scopes", () => {
	test("MODEL.1.a1: STATED channel and global rows 48 h old survive a remember that triggers the trim", async () => {
		const channel = await save("channel row", { source: "mcp", scope: "channel" });
		const global = await save("global row", { source: "mcp", scope: "global" });
		age(channel, "STATED");
		age(global, "STATED");
		expect(row(store.dir, channel)?.scope).toBe("channel");
		expect(row(store.dir, global)?.scope).toBe("global");

		await save("trigger one", { source: "mcp" });

		expect(row(store.dir, channel)).not.toBeNull();
		expect(row(store.dir, global)).not.toBeNull();
	});

	test("MODEL.1.a2: a STATED session row older than 24 h is still trimmed; IMPORTED rows are still spared", async () => {
		const session = await save("session row", { source: "mcp", scope: "session" });
		const importedSession = await save("imported session row", { source: "imported", scope: "session" });
		const channel = await save("channel row", { source: "mcp", scope: "channel" });
		age(session, "STATED");
		age(importedSession, "IMPORTED");
		age(channel, "STATED");

		await save("trigger two", { source: "mcp" });

		expect(row(store.dir, session)).toBeNull();
		expect(row(store.dir, importedSession)).not.toBeNull();
		expect(row(store.dir, channel)).not.toBeNull();
	});

	test("MODEL.1.a3: a NULL scope is not 'session', so the row is spared", async () => {
		const id = await save("null scope row", { source: "mcp" });
		age(id, "STATED");
		const db = openDb(store.dir);
		try {
			db.run("UPDATE working_memory SET scope = NULL WHERE id = ?", [id]);
		} finally {
			db.close();
		}
		expect(row(store.dir, id)?.scope).toBeNull();

		await save("trigger three", { source: "mcp" });

		expect(row(store.dir, id)).not.toBeNull();
	});
});
