// MODEL.7: a re-save (same content, same owner) never lowers a stored scope, keeps the stored trust tier
// unless the call names one, and never relabels a fact, preference, instruction or decision or gives it an expiry.
// engine/UPSTREAM.md change 17.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcp, openDb, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const HOURS_48 = () => new Date(Date.now() - 48 * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");

/** One mnemopi_remember as owner `o1`; returns the memory id. */
async function save(content: string, extra: Record<string, unknown> = {}): Promise<string> {
	const [reply] = await mcp(store.dir, "o1", [["mnemopi_remember", { content, ...extra }]]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	return id;
}

/** Makes only the timestamp 48 h old, leaving scope and tier as the last save left them. */
function makeOld(id: string): void {
	const db = openDb(store.dir);
	try {
		db.run("UPDATE working_memory SET timestamp = ?, consolidated_at = NULL WHERE id = ?", [HOURS_48(), id]);
	} finally {
		db.close();
	}
}

describe("MODEL.7: a re-save never lowers scope or relabels a protected kind", () => {
	test("MODEL.7.a1: a global IMPORTED row re-saved with default args stays global and IMPORTED, and survives a 48 h-old trim", async () => {
		const id = await save("a durable global fact about deploys", { scope: "global", source: "imported" });
		expect(row(store.dir, id)?.scope).toBe("global");
		expect(row(store.dir, id)?.trust_tier).toBe("IMPORTED");

		// the engine defaults: source 'mcp', scope 'session', no trust_tier
		const again = await save("a durable global fact about deploys");
		expect(again).toBe(id);
		expect(row(store.dir, id)?.scope).toBe("global");
		expect(row(store.dir, id)?.trust_tier).toBe("IMPORTED");

		makeOld(id);
		await save("a trigger save that runs the trim");
		expect(row(store.dir, id)).not.toBeNull();
	}, 60_000);

	test("MODEL.7.a1b: a STATED global row re-saved with default args survives the trim too", async () => {
		const id = await save("a stated global fact about reviews", { scope: "global", source: "mcp" });
		await save("a stated global fact about reviews");
		expect(row(store.dir, id)?.scope).toBe("global");
		makeOld(id);
		await save("another trigger save that runs the trim");
		expect(row(store.dir, id)).not.toBeNull();
	});

	test("MODEL.7.a2: a fact re-saved as context with an expiry stays a fact with no expiry", async () => {
		const id = await save("we deploy on fridays only after review", { memory_type: "fact", scope: "global" });
		await save("we deploy on fridays only after review", { memory_type: "context", valid_until: "2099-01-01" });
		const r = row(store.dir, id);
		expect(r?.memory_type).toBe("fact");
		expect(r?.valid_until).toBeNull();
	});

	test("MODEL.7.a2b: preference, instruction and decision are protected the same way", async () => {
		for (const kind of ["preference", "instruction", "decision"]) {
			const text = `a stored ${kind} that a re-save must not relabel`;
			const id = await save(text, { memory_type: kind, scope: "global" });
			await save(text, { memory_type: "event", valid_until: "2099-01-01" });
			const r = row(store.dir, id);
			expect([kind, r?.memory_type, r?.valid_until]).toEqual([kind, kind, null]);
		}
	}, 60_000);

	test("MODEL.7.a2c: other kinds keep today's behaviour: the explicit kind and expiry win", async () => {
		const id = await save("a note about the current sprint work", { memory_type: "context", valid_until: "2098-01-01" });
		await save("a note about the current sprint work", { memory_type: "event", valid_until: "2099-01-01" });
		const r = row(store.dir, id);
		expect(r?.memory_type).toBe("event");
		expect(r?.valid_until).toBe("2099-01-01T00:00:00.000Z");
		// a re-save that names neither keeps both
		await save("a note about the current sprint work");
		expect(row(store.dir, id)?.memory_type).toBe("event");
		expect(row(store.dir, id)?.valid_until).toBe("2099-01-01T00:00:00.000Z");
		// a stored 'unknown' kind can still be named
		const unknown = await save("an unlabelled note from an old import");
		await save("an unlabelled note from an old import", { memory_type: "fact" });
		expect(row(store.dir, unknown)?.memory_type).toBe("fact");
	}, 60_000);

	test("MODEL.7.a3: an explicit wider scope on a re-save still widens; a narrower one never lowers", async () => {
		const session = await save("a row that starts in the session scope");
		await save("a row that starts in the session scope", { scope: "channel" });
		expect(row(store.dir, session)?.scope).toBe("channel");
		await save("a row that starts in the session scope", { scope: "global" });
		expect(row(store.dir, session)?.scope).toBe("global");
		await save("a row that starts in the session scope", { scope: "channel" });
		expect(row(store.dir, session)?.scope).toBe("global");
		await save("a row that starts in the session scope", { scope: "session" });
		expect(row(store.dir, session)?.scope).toBe("global");

		const channel = await save("a row that starts in the channel scope", { scope: "channel" });
		await save("a row that starts in the channel scope");
		expect(row(store.dir, channel)?.scope).toBe("channel");
		await save("a row that starts in the channel scope", { scope: "global" });
		expect(row(store.dir, channel)?.scope).toBe("global");
	}, 60_000);

	test("MODEL.7.a4: a re-save keeps the stored trust tier, even when the call names another (MODEL.8)", async () => {
		const id = await save("a row with an imported trust tier", { source: "imported", scope: "global" });
		await save("a row with an imported trust tier", { source: "mcp" });
		expect(row(store.dir, id)?.trust_tier).toBe("IMPORTED");
		await save("a row with an imported trust tier", { source: "mcp", trust_tier: "DERIVED" });
		expect(row(store.dir, id)?.trust_tier).toBe("IMPORTED");
	});

	test("MODEL.7.a5: the first author is kept and the veracity is never lowered by a default re-save", async () => {
		const id = await save("a row with an author and a veracity", { author_id: "rohit", author_type: "human", veracity: "stated" });
		await save("a row with an author and a veracity", { author_id: "someone", author_type: "agent" });
		const r = row(store.dir, id);
		expect(r?.author_id).toBe("rohit");
		expect(r?.author_type).toBe("human");
		expect(r?.veracity).toBe("stated");
	});
});
