// MODEL.2: mnemopi_remember and mnemopi_update store memory_type, trust_tier and valid_until; update can restore
// engine/UPSTREAM.md change 13.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcp, openDb, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

async function save(owner: string, content: string, extra: Record<string, unknown> = {}): Promise<string> {
	const [reply] = await mcp(store.dir, owner, [["mnemopi_remember", { content, ...extra }]]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	return id;
}

async function update(owner: string, args: Record<string, unknown>) {
	const [reply] = await mcp(store.dir, owner, [["mnemopi_update", args]]);
	return reply!;
}

function sql(statement: string, params: (string | null)[]): void {
	const db = openDb(store.dir);
	try {
		db.run(statement, params);
	} finally {
		db.close();
	}
}

const PAST = "2020-01-01T00:00:00.000Z";

describe("MODEL.2: remember stores kind, tier and expiry", () => {
	test("MODEL.2.a1: memory_type, trust_tier and valid_until are stored as given", async () => {
		const id = await save("o1", "kind fact", {
			source: "mcp",
			scope: "global",
			memory_type: "decision",
			trust_tier: "DERIVED",
			valid_until: "2099-01-02",
		});
		const r = row(store.dir, id);
		expect(r?.memory_type).toBe("decision");
		expect(r?.trust_tier).toBe("DERIVED");
		expect(r?.valid_until).toBe("2099-01-02T00:00:00.000Z");
	});

	test("MODEL.2.a2: each of the four tiers is accepted", async () => {
		for (const tier of ["STATED", "DERIVED", "EXTERNAL_WRITE", "IMPORTED"]) {
			const id = await save("o1", `tier ${tier}`, { source: "mcp", trust_tier: tier });
			expect(row(store.dir, id)?.trust_tier).toBe(tier);
		}
	});

	test("MODEL.2.a3: a bad trust tier is ignored and the tier comes from the source", async () => {
		const bad = await save("o1", "bad tier", { source: "imported", trust_tier: "OBSERVED" });
		expect(row(store.dir, bad)?.trust_tier).toBe("IMPORTED");
		const none = await save("o1", "no tier", { source: "conversation" });
		expect(row(store.dir, none)?.trust_tier).toBe("STATED");
		const wrongType = await save("o1", "number tier", { source: "conversation", trust_tier: 7 });
		expect(row(store.dir, wrongType)?.trust_tier).toBe("STATED");
	});

	test("MODEL.2.a4: without the new fields a save stores memory_type unknown and no expiry, as before", async () => {
		const id = await save("o1", "plain");
		const r = row(store.dir, id);
		expect(r?.memory_type).toBe("unknown");
		expect(r?.valid_until).toBeNull();
	});

	test("MODEL.2.a5: a valid_until that is not a date is refused and nothing is stored", async () => {
		const [reply] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: "bad date", valid_until: "soon" }]]);
		expect(reply?.body.error).toBe("valid_until must be a date or timestamp");
		const db = openDb(store.dir);
		try {
			expect(db.query("SELECT COUNT(*) AS n FROM working_memory").get()).toEqual({ n: 0 });
		} catch {
			// no table yet: nothing was stored either
		} finally {
			db.close();
		}
	});
});

describe("MODEL.2: the dedupe path", () => {
	test("MODEL.2.a6: a re-save keeps the first author, never lowers veracity, and keeps the stored kind", async () => {
		const id = await save("o1", "dedupe fact", {
			author_type: "human",
			author_id: "rohit",
			veracity: "stated",
			memory_type: "preference",
		});
		await mcp(store.dir, "o1", [
			["mnemopi_remember", { content: "dedupe fact", author_type: "agent", author_id: "claude-code" }],
		]);
		const r = row(store.dir, id);
		expect(r?.author_id).toBe("rohit");
		expect(r?.author_type).toBe("human");
		expect(r?.veracity).toBe("stated");
		expect(r?.memory_type).toBe("preference");
	});

	test("MODEL.2.a7: a re-save that names a kind or an expiry sets them", async () => {
		const id = await save("o1", "dedupe fact two");
		await mcp(store.dir, "o1", [
			["mnemopi_remember", { content: "dedupe fact two", memory_type: "decision", valid_until: "2099-05-05" }],
		]);
		const r = row(store.dir, id);
		expect(r?.memory_type).toBe("decision");
		expect(r?.valid_until).toBe("2099-05-05T00:00:00.000Z");
	});
});

describe("MODEL.2: update stores kind and expiry", () => {
	test("MODEL.2.a8: memory_type and valid_until are set; valid_until null clears the expiry", async () => {
		const id = await save("o1", "update me");
		let reply = await update("o1", { memory_id: id, memory_type: "fact", valid_until: "2099-03-03T10:00:00Z" });
		expect(reply.body.status).toBe("updated");
		expect(row(store.dir, id)?.memory_type).toBe("fact");
		expect(row(store.dir, id)?.valid_until).toBe("2099-03-03T10:00:00.000Z");
		reply = await update("o1", { memory_id: id, valid_until: null });
		expect(reply.body.status).toBe("updated");
		expect(row(store.dir, id)?.valid_until).toBeNull();
		expect(row(store.dir, id)?.memory_type).toBe("fact");
	});

	test("MODEL.2.a9: a bad valid_until or an empty memory_type is an error and the row is unchanged", async () => {
		const id = await save("o1", "stay put", { memory_type: "fact" });
		const before = row(store.dir, id);
		const badDate = await update("o1", { memory_id: id, valid_until: "tomorrow-ish" });
		expect(badDate.body.error).toBe("valid_until must be a date or timestamp");
		const emptyType = await update("o1", { memory_id: id, memory_type: "  " });
		expect(emptyType.body.error).toBe("memory_type must be a non-empty string");
		expect(row(store.dir, id)).toEqual(before);
	});

	test("MODEL.2.a10: another owner's row is not updated", async () => {
		const id = await save("o1", "mine", { scope: "global" });
		const reply = await update("o2", { memory_id: id, memory_type: "stolen" });
		expect(reply.body.status).toBe("not_found");
		expect(row(store.dir, id)?.memory_type).toBe("unknown");
	});
});

describe("MODEL.2: restore", () => {
	test("MODEL.2.a11: restore clears valid_until and superseded_by on the caller's retired row", async () => {
		const id = await save("o1", "retired fact", { memory_type: "decision", trust_tier: "STATED" });
		sql("UPDATE working_memory SET valid_until = ?, superseded_by = ? WHERE id = ?", [PAST, "other-id", id]);
		const reply = await update("o1", { memory_id: id, restore: true });
		expect(reply.body.status).toBe("restored");
		const r = row(store.dir, id);
		expect(r?.valid_until).toBeNull();
		expect(r?.superseded_by).toBeNull();
		expect(r?.memory_type).toBe("decision");
	});

	test("MODEL.2.a12: restore also works when only the expiry has passed", async () => {
		const id = await save("o1", "expired fact", { valid_until: "2099-01-01" });
		sql("UPDATE working_memory SET valid_until = ? WHERE id = ?", [PAST, id]);
		expect((await update("o1", { memory_id: id, restore: true })).body.status).toBe("restored");
		expect(row(store.dir, id)?.valid_until).toBeNull();
	});

	test("MODEL.2.a13: restore of another owner's row, global or not, is refused and the row is unchanged", async () => {
		for (const scope of ["global", "session"]) {
			const id = await save("o1", `owner one ${scope}`, { scope });
			sql("UPDATE working_memory SET valid_until = ?, superseded_by = ? WHERE id = ?", [PAST, "other-id", id]);
			const before = row(store.dir, id);
			const reply = await update("o2", { memory_id: id, restore: true });
			expect(reply.body.status).toBe("not_found");
			expect(row(store.dir, id)).toEqual(before);
		}
	});

	test("MODEL.2.a14: restore of a live row changes nothing, even one with a future expiry", async () => {
		const live = await save("o1", "live fact");
		const future = await save("o1", "future fact", { valid_until: "2099-01-01" });
		for (const id of [live, future]) {
			const before = row(store.dir, id);
			const reply = await update("o1", { memory_id: id, restore: true });
			expect(reply.body.status).toBe("unchanged");
			expect(row(store.dir, id)).toEqual(before);
		}
	});

	test("MODEL.2.a15: restore cannot be combined with other fields, and an unknown id is not_found", async () => {
		const id = await save("o1", "combine");
		const combined = await update("o1", { memory_id: id, restore: true, memory_type: "x" });
		expect(combined.body.error).toBe("restore cannot be combined with other fields");
		expect((await update("o1", { memory_id: "nope", restore: true })).body.status).toBe("not_found");
	});
});
