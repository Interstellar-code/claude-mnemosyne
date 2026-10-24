// MODEL.6: retire, restore, update, attest and expire leave one memory_validations row; forget purges them
// engine/UPSTREAM.md change 16. Real SQLite stores and real `bun cli.ts mcp` runs, embeddings off.
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

const SECRET = "the-secret-memory-text-that-must-not-reach-the-audit-trail";

async function save(owner: string, extra: Record<string, unknown> = {}): Promise<string> {
	const [reply] = await mcp(store.dir, owner, [
		["mnemopi_remember", { content: `${SECRET} ${Math.random()}`, source: "mcp", scope: "global", ...extra }],
	]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	return id;
}

async function call(owner: string, name: string, args: Record<string, unknown>) {
	const [reply] = await mcp(store.dir, owner, [[name, args]]);
	return reply!;
}

type Audit = {
	validation_id: number;
	memory_id: string;
	validator: string;
	validated_at: string;
	action: string;
	new_content: string | null;
	note: string | null;
};

function audit(memoryId?: string): Audit[] {
	const db = new Database(join(store.dir, "mnemopi.db"), { readonly: true });
	try {
		return (
			memoryId === undefined
				? db.query("SELECT * FROM memory_validations ORDER BY validation_id").all()
				: db.query("SELECT * FROM memory_validations WHERE memory_id = ? ORDER BY validation_id").all(memoryId)
		) as Audit[];
	} finally {
		db.close();
	}
}

function sql(statement: string, params: (string | null)[] = []): void {
	const db = openDb(store.dir);
	try {
		db.run(statement, params);
	} finally {
		db.close();
	}
}

const actions = (rows: Audit[]) => rows.map(r => `${r.action}:${r.validator}`);

describe("MODEL.6: one audit row per change", () => {
	test("MODEL.6.a1: invalidate writes 'retire'; an unknown id writes nothing", async () => {
		const id = await save("o1");
		expect((await call("o1", "mnemopi_invalidate", { memory_id: id, validator: "claude" })).body.status).toBe("invalidated");
		expect(actions(audit(id))).toEqual(["retire:claude"]);
		expect((await call("o1", "mnemopi_invalidate", { memory_id: "nope", validator: "claude" })).body.status).toBe("not_found");
		expect(audit()).toHaveLength(1);
	});

	test("MODEL.6.a2: update with new content writes 'update'; other fields, a refused or a missing-row update write nothing", async () => {
		const id = await save("o1");
		await call("o1", "mnemopi_update", { memory_id: id, content: "new text", validator: "dashboard" });
		expect(actions(audit(id))).toEqual(["update:dashboard"]);
		// importance / metadata / kind / expiry only: no row.
		await call("o1", "mnemopi_update", { memory_id: id, importance: 0.9, validator: "dashboard" });
		await call("o1", "mnemopi_update", { memory_id: id, metadata: { a: 1 }, memory_type: "fact", validator: "dashboard" });
		// Another owner's row and an unknown id: not_found, no row. An empty content is refused.
		expect((await call("o2", "mnemopi_update", { memory_id: id, content: "hijack", validator: "x" })).body.status).toBe("not_found");
		expect((await call("o1", "mnemopi_update", { memory_id: "nope", content: "x", validator: "x" })).body.status).toBe("not_found");
		expect((await call("o1", "mnemopi_update", { memory_id: id, content: "  ", validator: "x" })).body.error).toBe("content is required");
		expect(actions(audit())).toEqual(["update:dashboard"]);
	});

	test("MODEL.6.a3: restore writes 'restore' only when a retired row came back", async () => {
		const id = await save("o1");
		const live = await save("o1");
		await call("o1", "mnemopi_invalidate", { memory_id: id, validator: "claude" });
		expect((await call("o1", "mnemopi_update", { memory_id: id, restore: true, validator: "rohit" })).body.status).toBe("restored");
		expect(actions(audit(id))).toEqual(["retire:claude", "restore:rohit"]);
		// A live row (unchanged), another owner's row (not_found) and an unknown id write nothing.
		expect((await call("o1", "mnemopi_update", { memory_id: live, restore: true, validator: "rohit" })).body.status).toBe("unchanged");
		await call("o1", "mnemopi_invalidate", { memory_id: id });
		const before = audit().length;
		expect((await call("o2", "mnemopi_update", { memory_id: id, restore: true, validator: "rohit" })).body.status).toBe("not_found");
		expect((await call("o1", "mnemopi_update", { memory_id: "nope", restore: true })).body.status).toBe("not_found");
		expect(audit()).toHaveLength(before);
		expect(audit(live)).toEqual([]);
	});

	test("MODEL.6.a4: validate attest writes 'attest' for the caller's own row and changes nothing else; a missing or foreign row writes nothing", async () => {
		const id = await save("o1");
		const rowBefore = row(store.dir, id);
		const reply = await call("o1", "mnemopi_validate", { memory_id: id, action: "attest", validator: "claude-review" });
		expect(reply.body.status).toBe("validation_attest");
		expect(reply.body.validator).toBe("claude-review");
		expect(actions(audit(id))).toEqual(["attest:claude-review"]);
		expect(row(store.dir, id)).toEqual(rowBefore);
		expect((await call("o2", "mnemopi_validate", { memory_id: id, action: "attest", validator: "x" })).body.status).toBe("not_found");
		expect((await call("o1", "mnemopi_validate", { memory_id: "nope", action: "attest", validator: "x" })).body.error).toBe("memory_not_found");
		expect(audit()).toHaveLength(1);
	});

	test("MODEL.6.a5: validate update and invalidate write 'update' and 'retire'; validate delete purges the trail", async () => {
		const a = await save("o1");
		const b = await save("o1");
		const c = await save("o1");
		await call("o1", "mnemopi_validate", { memory_id: a, action: "update", new_content: "changed", validator: "v" });
		await call("o1", "mnemopi_validate", { memory_id: b, action: "invalidate", validator: "v" });
		expect(actions(audit(a))).toEqual(["update:v"]);
		expect(actions(audit(b))).toEqual(["retire:v"]);
		await call("o1", "mnemopi_validate", { memory_id: c, action: "attest", validator: "v" });
		expect(audit(c)).toHaveLength(1);
		expect((await call("o1", "mnemopi_validate", { memory_id: c, action: "delete", validator: "v" })).body.status).toBe("validation_delete");
		expect(audit(c)).toEqual([]);
	});

	test("MODEL.6.b1: expire writes one 'expire' row per expired memory; a dry run and untouched rows write nothing", async () => {
		const a = await save("o1", { memory_type: "context" });
		const b = await save("o1", { memory_type: "event" });
		const kept = await save("o1", { memory_type: "fact" });
		const other = await save("o2", { memory_type: "context" });
		sql("UPDATE working_memory SET created_at = '2020-01-01 00:00:00'");
		await call("o1", "mnemopi_expire_unused", { validator: "expire-sweep" }); // dry run
		expect(audit()).toEqual([]);
		const reply = await call("o1", "mnemopi_expire_unused", { dry_run: false, validator: "expire-sweep" });
		expect(reply.body.count).toBe(2);
		expect(actions(audit(a))).toEqual(["expire:expire-sweep"]);
		expect(actions(audit(b))).toEqual(["expire:expire-sweep"]);
		expect(audit(kept)).toEqual([]);
		expect(audit(other)).toEqual([]);
		// A second run finds nothing and writes nothing.
		await call("o1", "mnemopi_expire_unused", { dry_run: false, validator: "expire-sweep" });
		expect(audit()).toHaveLength(2);
	});
});

describe("MODEL.6: the validator argument", () => {
	test("MODEL.6.c1: it defaults to 'unknown'; 64 characters pass; 65, a non-string and a long one on any tool are refused and write nothing", async () => {
		const id = await save("o1");
		await call("o1", "mnemopi_update", { memory_id: id, content: "one" });
		await call("o1", "mnemopi_update", { memory_id: id, content: "two", validator: "" });
		await call("o1", "mnemopi_update", { memory_id: id, content: "three", validator: "v".repeat(64) });
		expect(audit(id).map(r => r.validator)).toEqual(["unknown", "unknown", "v".repeat(64)]);

		const tooLong = "v".repeat(65);
		const error = "validator must be at most 64 characters";
		const other = await save("o1", { memory_type: "context" });
		sql("UPDATE working_memory SET created_at = '2020-01-01 00:00:00' WHERE id = ?", [other]);
		const before = audit().length;
		for (const [name, args] of [
			["mnemopi_invalidate", { memory_id: other }],
			["mnemopi_update", { memory_id: other, content: "x" }],
			["mnemopi_update", { memory_id: other, restore: true }],
			["mnemopi_validate", { memory_id: other, action: "attest" }],
			["mnemopi_expire_unused", { dry_run: false }],
		] as const) {
			expect((await call("o1", name, { ...args, validator: tooLong })).body.error).toBe(error);
		}
		expect((await call("o1", "mnemopi_invalidate", { memory_id: other, validator: 7 })).body.error).toBe("validator must be a string");
		expect(audit()).toHaveLength(before);
		expect(row(store.dir, other)?.valid_until).toBeNull();
	});
});

describe("MODEL.6: the trail keeps 3 rows, holds no memory text, and forget purges it", () => {
	test("MODEL.6.d1: the trigger keeps the last 3 rows per memory", async () => {
		const id = await save("o1");
		for (const validator of ["v1", "v2", "v3", "v4", "v5"]) {
			await call("o1", "mnemopi_validate", { memory_id: id, action: "attest", validator });
		}
		expect(audit(id).map(r => r.validator)).toEqual(["v3", "v4", "v5"]);
		const other = await save("o1");
		await call("o1", "mnemopi_validate", { memory_id: other, action: "attest", validator: "solo" });
		expect(audit(other)).toHaveLength(1);
		const db = new Database(join(store.dir, "mnemopi.db"), { readonly: true });
		try {
			const trigger = db.query("SELECT sql FROM sqlite_master WHERE name = 'trim_validations_to_3'").get() as { sql: string };
			expect(trigger.sql).toContain("LIMIT 3");
		} finally {
			db.close();
		}
	});

	test("MODEL.6.d2: no column of any audit row holds memory text; new_content and note are NULL", async () => {
		const id = await save("o1", { memory_type: "context" });
		await call("o1", "mnemopi_update", { memory_id: id, content: `${SECRET} edited`, validator: "v" });
		await call("o1", "mnemopi_validate", { memory_id: id, action: "attest", validator: "v", note: SECRET });
		await call("o1", "mnemopi_validate", { memory_id: id, action: "update", new_content: `${SECRET} again`, validator: "v", note: SECRET });
		await call("o1", "mnemopi_invalidate", { memory_id: id, validator: "v" });
		await call("o1", "mnemopi_update", { memory_id: id, restore: true, validator: "v" });
		const rows = audit();
		expect(rows.length).toBeGreaterThan(0);
		for (const r of rows) {
			expect(r.new_content).toBeNull();
			expect(r.note).toBeNull();
			expect(JSON.stringify(r)).not.toContain("secret");
		}
	});

	test("MODEL.6.d3: forget deletes the memory's audit rows in the same call; other memories' rows stay", async () => {
		const gone = await save("o1");
		const kept = await save("o1");
		for (const id of [gone, kept]) {
			await call("o1", "mnemopi_validate", { memory_id: id, action: "attest", validator: "v" });
			await call("o1", "mnemopi_invalidate", { memory_id: id, validator: "v" });
		}
		expect(audit(gone)).toHaveLength(2);
		expect((await call("o1", "mnemopi_forget", { memory_id: gone })).body.status).toBe("deleted");
		expect(row(store.dir, gone)).toBeNull();
		expect(audit(gone)).toEqual([]);
		expect(audit(kept)).toHaveLength(2);
		// Another owner's forget deletes nothing, so the trail stays.
		expect((await call("o2", "mnemopi_forget", { memory_id: kept })).body.status).toBe("not_found");
		expect(audit(kept)).toHaveLength(2);
	});

	test("MODEL.6.d4: the 24 h trim purges the trail of the rows it deletes", async () => {
		const old = await save("o1", { scope: "session", trust_tier: "STATED" });
		await call("o1", "mnemopi_validate", { memory_id: old, action: "attest", validator: "v" });
		sql("UPDATE working_memory SET timestamp = '2020-01-01T00:00:00.000Z' WHERE id = ?", [old]);
		await save("o1", { scope: "session" }); // triggers the trim
		expect(row(store.dir, old)).toBeNull();
		expect(audit(old)).toEqual([]);
	});

	test("MODEL.6.e1: none of the tools is in bin/mcp-proxy.ts's allow-list", () => {
		const proxy = readFileSync(join(import.meta.dir, "..", "..", "bin", "mcp-proxy.ts"), "utf8");
		const allowed = /const ALLOWED = new Set\(\[([^\]]*)\]\)/.exec(proxy)?.[1] ?? "";
		for (const tool of ["invalidate", "validate", "expire", "similar"]) expect(allowed).not.toContain(tool);
		expect(proxy).not.toMatch(/mnemopi_(invalidate|validate|expire_unused)/);
	});
});
