// mnemosyne change 1 (engine/UPSTREAM.md): mnemopi_update merges metadata into
// a memory in one BEGIN IMMEDIATE transaction. Real temporary stores, real
// engine processes.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { BeamMemory } from "../src/core/beam";
import { mergeMetadataJson } from "../src/core/beam/store";
import { UPDATE_SCHEMA } from "../src/mcp-tools";
import { CLI, engineEnv, mcp, metadataOf, openDb, remember, row, startMcp, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const KEPT = ["id", "recall_count", "last_recalled", "timestamp"] as const;
const kept = (r: Record<string, unknown> | null) => Object.fromEntries(KEPT.map(key => [key, r?.[key]]));

describe("schema", () => {
	test("UPDATE_SCHEMA has a metadata object and requires only memory_id", () => {
		expect(UPDATE_SCHEMA.properties.metadata.type).toBe("object");
		expect([...UPDATE_SCHEMA.required]).toEqual(["memory_id"]);
	});

	test("an update with none of content, importance or metadata is an error", async () => {
		const id = await remember(store.dir, "o1", "plain fact");
		const [reply] = await mcp(store.dir, "o1", [["mnemopi_update", { memory_id: id }]]);
		expect(reply?.body.error).toBe("content, importance or metadata is required");
	});
});

describe("merge", () => {
	test("metadata only: named keys replaced, null removes, other keys stay, nested objects replaced whole", async () => {
		const id = await remember(store.dir, "o1", "merge fact", {
			metadata: { keep: "k", replace: "old", drop: "d", nested: { a: 1 } },
		});
		const before = row(store.dir, id);
		const [reply] = await mcp(store.dir, "o1", [
			["mnemopi_update", { memory_id: id, metadata: { replace: "new", drop: null, nested: { b: 2 }, tags: ["x"] } }],
		]);
		expect(reply?.body.status).toBe("updated");
		expect(metadataOf(store.dir, id)).toEqual({ keep: "k", replace: "new", nested: { b: 2 }, tags: ["x"] });
		const after = row(store.dir, id);
		expect(after?.content).toBe(before?.content);
		expect(after?.importance).toBe(before?.importance);
	});

	test("a NULL metadata_json counts as {}", async () => {
		const id = await remember(store.dir, "o1", "no metadata yet");
		expect(row(store.dir, id)?.metadata_json).toBeNull();
		await mcp(store.dir, "o1", [["mnemopi_update", { memory_id: id, metadata: { tags: ["a", "b"] } }]]);
		expect(metadataOf(store.dir, id)).toEqual({ tags: ["a", "b"] });
	});

	test("content, importance and metadata change together in one call", async () => {
		const id = await remember(store.dir, "o1", "old text", { metadata: { a: 1 } });
		const [reply] = await mcp(store.dir, "o1", [
			["mnemopi_update", { memory_id: id, content: "new text", importance: 0.9, metadata: { b: 2 } }],
		]);
		expect(reply?.body.status).toBe("updated");
		const after = row(store.dir, id);
		expect(after?.content).toBe("new text");
		expect(after?.importance).toBe(0.9);
		expect(metadataOf(store.dir, id)).toEqual({ a: 1, b: 2 });
	});
});

describe("transaction", () => {
	test("read, merge and UPDATE (with content and importance) run inside one BEGIN IMMEDIATE", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("in process fact", { source: "imported", scope: "global" });
			const trace: string[] = [];
			const db = beam.db as unknown as {
				exec: (sql: string) => unknown;
				run: (...args: unknown[]) => unknown;
				prepare: (...args: unknown[]) => unknown;
			};
			const [exec, run, prepare] = [db.exec.bind(db), db.run.bind(db), db.prepare.bind(db)];
			db.exec = sql => (trace.push(`exec ${sql}`), exec(sql));
			db.run = (...args) => (trace.push(`run ${String(args[0]).trim().split(/\s+/).slice(0, 3).join(" ")}`), run(...args));
			db.prepare = (...args) => (trace.push(`prepare ${String(args[0]).trim().split(/\s+/)[0]}`), prepare(...args));
			try {
				expect(beam.updateWorking(id, "changed", 0.7, { k: "v" })).toBe(true);
			} finally {
				Object.assign(db, { exec, run, prepare });
			}
			const begin = trace.indexOf("exec BEGIN IMMEDIATE");
			const read = trace.findIndex((line, i) => i > begin && line === "prepare SELECT");
			const write = trace.findIndex((line, i) => i > begin && line.startsWith("run UPDATE working_memory"));
			const commit = trace.findIndex((line, i) => i > begin && line === "exec COMMIT");
			expect(begin).toBeGreaterThanOrEqual(0);
			expect(begin < read && read < write && write < commit).toBe(true);
		} finally {
			beam.close();
		}
	});

	test("two processes updating different keys of one row at the same time keep every key", async () => {
		// Two engine processes, started together, each merge 20 keys of their own
		// into one row. Without one BEGIN IMMEDIATE around read-merge-write, a
		// writer saves a merge read before the other's commit and drops its key
		// (with the transaction removed, this test failed in 6 of 6 runs).
		const id = await remember(store.dir, "o1", "busy fact", { metadata: { base: true } });
		const calls = (prefix: string) =>
			Array.from({ length: 20 }, (_, i) => ["mnemopi_update", { memory_id: id, metadata: { [`${prefix}${i}`]: i } }] as const);
		const [a, b] = await Promise.all([startMcp(store.dir, "o1", calls("a")), startMcp(store.dir, "o1", calls("b"))]);
		expect([...a, ...b].every(reply => reply.body.status === "updated")).toBe(true);
		const metadata = metadataOf(store.dir, id) as Record<string, unknown>;
		const expected = { base: true, ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => [[`a${i}`, i], [`b${i}`, i]]).flat()) };
		expect(metadata).toEqual(expected);
	}, 30_000);
});

describe("guards", () => {
	test("a row whose metadata_json is not a JSON object: error, row unchanged", async () => {
		const id = await remember(store.dir, "o1", "broken metadata row");
		for (const broken of ["[1,2]", "not json", '"a string"', "42", "null"]) {
			const db = openDb(store.dir);
			db.run("UPDATE working_memory SET metadata_json = ? WHERE id = ?", [broken, id]);
			db.close();
			const before = row(store.dir, id);
			const [reply] = await mcp(store.dir, "o1", [
				["mnemopi_update", { memory_id: id, content: "should not land", metadata: { tags: ["x"] } }],
			]);
			expect(reply?.isError).toBe(true);
			expect(reply?.text).toContain("not a JSON object");
			expect(row(store.dir, id)).toEqual(before);
		}
	});

	test("metadata that is not a plain object is an error and changes nothing", async () => {
		const id = await remember(store.dir, "o1", "guarded fact", { metadata: { a: 1 } });
		const before = row(store.dir, id);
		for (const metadata of [["x"], "x", 5, null, true]) {
			const [reply] = await mcp(store.dir, "o1", [["mnemopi_update", { memory_id: id, content: "nope", metadata }]]);
			expect(reply?.body.error).toBe("metadata must be an object");
		}
		expect(row(store.dir, id)).toEqual(before);
	});

	test("an update of another owner's row is not_found and leaves the row unchanged", async () => {
		const id = await remember(store.dir, "owner-a", "a's fact", { metadata: { a: 1 } });
		const before = row(store.dir, id);
		const [reply] = await mcp(store.dir, "owner-b", [
			["mnemopi_update", { memory_id: id, content: "hijack", importance: 1, metadata: { b: 2 } }],
		]);
		expect(reply?.body.status).toBe("not_found");
		expect(row(store.dir, id)).toEqual(before);
	});

	test("after any update the id, recall_count, last_recalled and timestamp stay", async () => {
		const id = await remember(store.dir, "o1", "zanzibar heron fact");
		await mcp(store.dir, "o1", [["mnemopi_recall", { query: "zanzibar heron" }]]);
		const before = row(store.dir, id);
		expect(before?.recall_count).toBe(1);
		expect(before?.last_recalled).not.toBeNull();
		await mcp(store.dir, "o1", [
			["mnemopi_update", { memory_id: id, metadata: { tags: ["a"] } }],
			["mnemopi_update", { memory_id: id, content: "zanzibar heron fact, edited" }],
			["mnemopi_update", { memory_id: id, importance: 0.8 }],
			["mnemopi_update", { memory_id: id, content: "zanzibar heron, all three", importance: 0.2, metadata: { b: 1 } }],
		]);
		expect(kept(row(store.dir, id))).toEqual(kept(before));
	});

	test("a metadata change clears the query caches, as a content change does", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "cache.db") });
		try {
			const id = beam.remember("cached fact", { source: "imported", scope: "global" });
			let invalidated = 0;
			(beam.caches as { queryCache?: unknown }).queryCache = { invalidate: () => invalidated++ };
			beam.updateWorking(id, "cached fact 2");
			expect(invalidated).toBe(1);
			beam.updateWorking(id, null, null, { tags: ["t"] });
			expect(invalidated).toBe(2);
			beam.updateWorking("missing-id", null, null, { tags: ["t"] });
			expect(invalidated).toBe(2);
		} finally {
			beam.close();
		}
	});
});

describe("__proto__ (review r1 LOW 7)", () => {
	test("a __proto__ key is plain data: stored, replaced and removed like any key, never a prototype", async () => {
		const merged = mergeMetadataJson('{"a":1}', JSON.parse('{"__proto__":{"polluted":true},"b":2}'));
		expect(JSON.parse(merged)).toEqual(JSON.parse('{"a":1,"__proto__":{"polluted":true},"b":2}'));
		expect(Object.hasOwn(JSON.parse(merged), "__proto__")).toBe(true);
		expect(({} as Record<string, unknown>).polluted).toBeUndefined();

		const id = await remember(store.dir, "o1", "proto fact");
		const send = (patch: string) =>
			mcp(store.dir, "o1", [["mnemopi_update", { memory_id: id, metadata: JSON.parse(patch) }]]);
		await send('{"__proto__":{"x":1},"keep":true}');
		expect(row(store.dir, id)?.metadata_json).toBe('{"__proto__":{"x":1},"keep":true}');
		await send('{"__proto__":{"y":2}}');
		expect(row(store.dir, id)?.metadata_json).toBe('{"__proto__":{"y":2},"keep":true}');
		await send('{"__proto__":null}');
		expect(row(store.dir, id)?.metadata_json).toBe('{"keep":true}');
	});
});

describe("as before", () => {
	test("content-only and importance-only updates behave as before", async () => {
		const id = await remember(store.dir, "o1", "first text", { metadata: { a: 1 } });
		const [content] = await mcp(store.dir, "o1", [["mnemopi_update", { memory_id: id, content: "second text" }]]);
		expect(content?.body.status).toBe("updated");
		expect(row(store.dir, id)?.content).toBe("second text");
		const [importance] = await mcp(store.dir, "o1", [["mnemopi_update", { memory_id: id, importance: 0.25 }]]);
		expect(importance?.body.status).toBe("updated");
		expect(row(store.dir, id)?.importance).toBe(0.25);
		expect(metadataOf(store.dir, id)).toEqual({ a: 1 });
		const [blank] = await mcp(store.dir, "o1", [["mnemopi_update", { memory_id: id, content: "  " }]]);
		expect(blank?.body.error).toBe("content is required");
	});

	test("mnemopi update <id> --metadata '<json>' in the CLI merges the same way", async () => {
		const id = await remember(store.dir, "default", "cli fact", { metadata: { a: 1, gone: true } });
		const cli = (...args: string[]) =>
			Bun.spawnSync([process.execPath, CLI, "update", ...args], { env: engineEnv(store.dir, "default") });
		const merged = cli(id, "--metadata", '{"b":2,"gone":null}');
		expect(merged.exitCode).toBe(0);
		expect(metadataOf(store.dir, id)).toEqual({ a: 1, b: 2 });
		const both = cli(id, "cli fact, edited", "--metadata", '{"c":3}');
		expect(both.exitCode).toBe(0);
		expect(row(store.dir, id)?.content).toBe("cli fact, edited");
		expect(metadataOf(store.dir, id)).toEqual({ a: 1, b: 2, c: 3 });
		const bad = cli(id, "--metadata", "[1]");
		expect(bad.exitCode).not.toBe(0);
		expect(bad.stderr.toString()).toContain("metadata must be a JSON object");
		const plain = cli(id, "plain content update");
		expect(plain.exitCode).toBe(0);
		expect(row(store.dir, id)?.content).toBe("plain content update");
	});
});
