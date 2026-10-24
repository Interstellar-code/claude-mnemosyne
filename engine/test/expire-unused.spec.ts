// MODEL.5: mnemopi_expire_unused sets valid_until on the caller's own unused rows of the expirable kinds
// engine/UPSTREAM.md change 15. Real SQLite stores and real `bun cli.ts mcp` runs, embeddings off.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcp, openDb, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const DAY = 86_400_000;
/** SQLite CURRENT_TIMESTAMP form, `days` ago. */
const sqlAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString().replace("T", " ").slice(0, 19);
const isoAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

let counter = 0;
/** Saves one global row of `kind`, then makes it `idle` days old (created_at). Returns its id. */
async function save(owner: string, kind: string, idle: number, extra: Record<string, unknown> = {}): Promise<string> {
	counter += 1;
	const [reply] = await mcp(store.dir, owner, [
		[
			"mnemopi_remember",
			{ content: `${kind} note number ${counter} for expiry`, source: "mcp", scope: "global", memory_type: kind, ...extra },
		],
	]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	sql("UPDATE working_memory SET created_at = ? WHERE id = ?", [sqlAgo(idle), id]);
	return id;
}

function sql(statement: string, params: (string | null)[] = []): void {
	const db = openDb(store.dir);
	try {
		db.run(statement, params);
	} finally {
		db.close();
	}
}

async function expire(owner: string, args: Record<string, unknown> = {}) {
	const [reply] = await mcp(store.dir, owner, [["mnemopi_expire_unused", args]]);
	return reply!;
}

type Entry = { id: string; kind: string; last_used: string; preview: string };
const listOf = (reply: { body: Record<string, unknown> }, key: "candidates" | "expired") => reply.body[key] as Entry[];

/** Every working_memory row, to prove a call changed nothing. */
function everything(): unknown {
	const db = new Database(join(store.dir, "mnemopi.db"), { readonly: true });
	try {
		return db.query("SELECT * FROM working_memory ORDER BY id").all();
	} finally {
		db.close();
	}
}

describe("MODEL.5: mnemopi_expire_unused", () => {
	test("MODEL.5.a1: a dry run lists the candidates with id, kind, last_used and an 80-char preview, and changes nothing", async () => {
		const id = await save("o1", "context", 120);
		const long = await save("o1", "event", 200, { content: `${"y".repeat(150)} unused` });
		const before = everything();
		const reply = await expire("o1");
		expect(reply.isError).toBe(false);
		expect(reply.body.dry_run).toBe(true);
		expect(reply.body.count).toBe(2);
		const candidates = listOf(reply, "candidates");
		expect(candidates.map(c => c.id)).toEqual([long, id]); // longest unused first
		expect(candidates[1]).toMatchObject({ id, kind: "context" });
		expect(Date.parse(candidates[1]!.last_used)).toBeLessThan(Date.now() - 119 * DAY);
		expect(candidates[0]!.preview.length).toBe(80);
		expect(reply.body.expired).toBeUndefined();
		expect(everything()).toEqual(before);
	});

	test("MODEL.5.a2: dry_run is true unless it is the boolean false", async () => {
		const id = await save("o1", "context", 120);
		for (const dry_run of [undefined, "false", 0, null]) {
			const reply = await expire("o1", dry_run === undefined ? {} : { dry_run });
			expect(reply.body.dry_run).toBe(true);
		}
		expect(row(store.dir, id)?.valid_until).toBeNull();
	});

	test("MODEL.5.a3: a real run sets valid_until to now and writes nothing else; restore brings each row back", async () => {
		const a = await save("o1", "artifact", 100);
		const b = await save("o1", "error", 100);
		const beforeA = row(store.dir, a);
		const beforeB = row(store.dir, b);
		const started = Date.now();
		const reply = await expire("o1", { dry_run: false });
		expect(reply.body.dry_run).toBe(false);
		expect(reply.body.count).toBe(2);
		expect(listOf(reply, "expired").map(e => e.id).sort()).toEqual([a, b].sort());
		expect(reply.body.candidates).toBeUndefined();
		for (const [id, before] of [[a, beforeA], [b, beforeB]] as const) {
			const after = row(store.dir, id)!;
			expect(Date.parse(String(after.valid_until))).toBeGreaterThanOrEqual(started - 1000);
			expect({ ...after, valid_until: null }).toEqual(before!); // nothing but valid_until changed
		}
		// Nothing deleted, and a second run finds nothing: the rows already have a valid_until.
		expect((await expire("o1", { dry_run: false })).body.count).toBe(0);
		// Restore brings each one back, and they are candidates again.
		for (const id of [a, b]) {
			const [restored] = await mcp(store.dir, "o1", [["mnemopi_update", { memory_id: id, restore: true }]]);
			expect(restored?.body.status).toBe("restored");
			expect(row(store.dir, id)?.valid_until).toBeNull();
		}
		expect((await expire("o1")).body.count).toBe(2);
	});

	test("MODEL.5.a4: a row recalled yesterday is kept; a recent row is kept; recalling a row resets its clock", async () => {
		const recalledSql = await save("o1", "context", 300);
		sql("UPDATE working_memory SET last_recalled = ? WHERE id = ?", [isoAgo(1), recalledSql]);
		const fresh = await save("o1", "context", 5);
		const old = await save("o1", "context", 300, { content: "zebra giraffe lemur old note" });
		// A real recall of the old row bumps last_recalled to now.
		await mcp(store.dir, "o1", [["mnemopi_recall", { query: "zebra giraffe lemur" }]]);
		expect(row(store.dir, old)?.last_recalled).not.toBeNull();
		const reply = await expire("o1", { days: 30 });
		expect(reply.body.count).toBe(0);
		expect(listOf(reply, "candidates")).toEqual([]);
		void fresh;
	});

	test("MODEL.5.a5: kinds outside the list, and fact, preference, instruction, decision and unknown, are never touched", async () => {
		const protectedIds: string[] = [];
		for (const kind of ["fact", "preference", "instruction", "decision"]) protectedIds.push(await save("o1", kind, 400));
		protectedIds.push(await save("o1", "unknown", 400));
		const plain = await mcp(store.dir, "o1", [
			["mnemopi_remember", { content: "no kind given at all", source: "mcp", scope: "global" }],
		]);
		const noKind = plain[0]!.body.memory_id as string;
		sql("UPDATE working_memory SET created_at = ? WHERE id = ?", [sqlAgo(400), noKind]);
		const other = await save("o1", "reference", 400); // not in the default kinds
		const expirable = await save("o1", "context", 400);

		const reply = await expire("o1", { dry_run: false });
		expect(listOf(reply, "expired").map(e => e.id)).toEqual([expirable]);
		for (const id of [...protectedIds, noKind, other]) expect(row(store.dir, id)?.valid_until).toBeNull();

		// Naming a protected kind in `kinds` does not unlock it; an unlisted kind can be named.
		const named = await expire("o1", { dry_run: false, kinds: ["fact", "preference", "instruction", "decision", "unknown", "reference"] });
		expect(listOf(named, "expired").map(e => e.id)).toEqual([other]);
		for (const id of [...protectedIds, noKind]) expect(row(store.dir, id)?.valid_until).toBeNull();
	});

	test("MODEL.5.a6: pinned rows, rows that already have a valid_until, session-scope and superseded rows are never touched", async () => {
		const pinned = await save("o1", "context", 400, { metadata: { pinned: true } });
		const unpinned = await save("o1", "context", 400, { metadata: { pinned: false } });
		const withExpiry = await save("o1", "context", 400, { valid_until: "2099-01-01" });
		const session = await save("o1", "context", 400, { scope: "session" });
		const superseded = await save("o1", "context", 400);
		sql("UPDATE working_memory SET superseded_by = 'other' WHERE id = ?", [superseded]);
		const brokenMeta = await save("o1", "context", 400);
		sql("UPDATE working_memory SET metadata_json = '{not json' WHERE id = ?", [brokenMeta]);
		const nullScope = await save("o1", "context", 400);
		sql("UPDATE working_memory SET scope = NULL WHERE id = ?", [nullScope]);

		const reply = await expire("o1", { dry_run: false });
		expect(listOf(reply, "expired").map(e => e.id)).toEqual([unpinned]);
		for (const id of [pinned, session, superseded, brokenMeta, nullScope]) expect(row(store.dir, id)?.valid_until).toBeNull();
		expect(row(store.dir, withExpiry)?.valid_until).toBe("2099-01-01T00:00:00.000Z");
		expect(row(store.dir, pinned)?.metadata_json).toBe(JSON.stringify({ pinned: true }));
	});

	test("MODEL.5.a7: another owner's row is untouched, global scope or not", async () => {
		const theirs = await save("o2", "context", 400);
		const mine = await save("o1", "context", 400);
		const dry = await expire("o1");
		expect(listOf(dry, "candidates").map(c => c.id)).toEqual([mine]);
		await expire("o1", { dry_run: false });
		expect(row(store.dir, theirs)?.valid_until).toBeNull();
		expect(row(store.dir, mine)?.valid_until).not.toBeNull();
	});

	test("MODEL.5.a8: limit caps the rows, oldest first; days is held to at least 30 and the limit to 1-200", async () => {
		const ids: string[] = [];
		for (let i = 0; i < 4; i += 1) ids.push(await save("o1", "event", 100 + i * 10));
		const limited = await expire("o1", { limit: 2, dry_run: false });
		expect(listOf(limited, "expired").map(e => e.id)).toEqual([ids[3]!, ids[2]!]);
		expect(row(store.dir, ids[1]!)?.valid_until).toBeNull();
		expect(row(store.dir, ids[0]!)?.valid_until).toBeNull();
		expect((await expire("o1", { limit: 0 })).body.count).toBe(1); // held to 1, of the 2 left
		expect((await expire("o1", { limit: 9999 })).body.count).toBe(2);

		const young = await save("o1", "event", 20);
		const tooShort = await expire("o1", { days: 1 });
		expect(tooShort.body.days).toBe(30);
		expect(listOf(tooShort, "candidates").map(c => c.id)).not.toContain(young);
	});

	test("MODEL.5.a9: bad kinds are refused and nothing changes", async () => {
		const id = await save("o1", "context", 400);
		const before = everything();
		for (const kinds of ["context", [1, 2], [""], {}]) {
			const reply = await expire("o1", { dry_run: false, kinds });
			expect(reply.body.error).toBe("kinds must be a list of non-empty strings");
		}
		expect(everything()).toEqual(before);
		void id;
	});

	test("MODEL.5.a10: it is a plugin-private engine tool: not in bin/mcp-proxy.ts's allow-list", () => {
		const proxy = readFileSync(join(import.meta.dir, "..", "..", "bin", "mcp-proxy.ts"), "utf8");
		const allowed = /const ALLOWED = new Set\(\[([^\]]*)\]\)/.exec(proxy)?.[1] ?? "";
		expect(allowed).toContain("memory_recall");
		expect(allowed).not.toMatch(/expire/);
		expect(proxy).not.toMatch(/mnemopi_expire_unused/);
	});
});
