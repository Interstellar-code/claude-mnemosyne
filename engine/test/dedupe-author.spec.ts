// KSTORE.2: The engine keeps the first author and a 'stated' veracity on a re-save
// engine/UPSTREAM.md: dedupe UPDATE keeps old author, empty env unset.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { BeamMemory } from "../src/core/beam";
import { CLI, engineEnv, mcp, openDb, remember, row, startMcp, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

describe("KSTORE.2: dedupe veracity and author", () => {
	test("KSTORE.2.a1: veracity kept when re-saving without veracity, updated when new veracity given", async () => {
		// Save with 'stated'
		const id = await remember(store.dir, "o1", "veracity fact", {
			veracity: "stated",
			author_type: "human",
			author_id: "rohit",
		});
		let r = row(store.dir, id);
		expect(r?.veracity).toBe("stated");

		// Re-save without veracity (engine defaults to 'unknown') -> keeps 'stated'
		const [reply1] = await mcp(store.dir, "o1", [
			["mnemopi_remember", { content: "veracity fact" }],
		]);
		expect(reply1?.body.status).toBe("stored");
		r = row(store.dir, id);
		expect(r?.veracity).toBe("stated");

		// Re-save with 'inferred' -> takes 'inferred' (does not keep higher)
		const [reply2] = await mcp(store.dir, "o1", [
			["mnemopi_remember", { content: "veracity fact", veracity: "inferred" }],
		]);
		expect(reply2?.body.status).toBe("stored");
		r = row(store.dir, id);
		expect(r?.veracity).toBe("inferred");
	});

	test("KSTORE.2.a2: author_id and author_type kept from first author on re-save", async () => {
		// Save as human author
		const id = await remember(store.dir, "o1", "author fact", {
			author_type: "human",
			author_id: "rohit",
		});
		let r = row(store.dir, id);
		expect(r?.author_type).toBe("human");
		expect(r?.author_id).toBe("rohit");

		// Re-save as agent claude-code -> keeps human and rohit
		const [reply] = await mcp(store.dir, "o1", [
			["mnemopi_remember", { content: "author fact", author_type: "agent", author_id: "claude-code" }],
		]);
		expect(reply?.body.status).toBe("stored");
		r = row(store.dir, id);
		expect(r?.author_type).toBe("human");
		expect(r?.author_id).toBe("rohit");

		// Only one row exists
		const db = openDb(store.dir);
		try {
			const count = db.query("SELECT COUNT(*) AS c FROM working_memory WHERE content = ?").get("author fact") as { c: number };
			expect(count.c).toBe(1);
		} finally {
			db.close();
		}
	});

	test("KSTORE.2.a2: a first save with no author (NULL) takes author on re-save", async () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("unattributed fact", { source: "imported" });
			let dbRow = beam.db.query("SELECT author_id, author_type FROM working_memory WHERE id = ?").get(id) as Record<string, unknown> | null;
			expect(dbRow?.author_id).toBeNull();
			expect(dbRow?.author_type).toBeNull();

			// Re-save with author
			beam.remember("unattributed fact", {
				source: "imported",
				authorId: "first-author",
				authorType: "agent",
			});
			dbRow = beam.db.query("SELECT author_id, author_type FROM working_memory WHERE id = ?").get(id) as Record<string, unknown> | null;
			expect(dbRow?.author_id).toBe("first-author");
			expect(dbRow?.author_type).toBe("agent");

			// Further re-save with different author does not overwrite
			beam.remember("unattributed fact", {
				source: "imported",
				authorId: "second-author",
				authorType: "human",
			});
			dbRow = beam.db.query("SELECT author_id, author_type FROM working_memory WHERE id = ?").get(id) as Record<string, unknown> | null;
			expect(dbRow?.author_id).toBe("first-author");
			expect(dbRow?.author_type).toBe("agent");
		} finally {
			beam.close();
		}
	});

	test("KSTORE.2.a3: empty MNEMOPI_AUTHOR_ID or MNEMOPI_AUTHOR_TYPE counts as unset", async () => {
		// Spawn with empty env vars
		const child = Bun.spawn([process.execPath, CLI, "mcp"], {
			env: {
				...engineEnv(store.dir, "o1"),
				MNEMOPI_AUTHOR_ID: "",
				MNEMOPI_AUTHOR_TYPE: "",
			},
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		});
		child.stdin.write(
			`${JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name: "mnemopi_remember", arguments: { content: "empty env test" } },
			})}\n`,
		);
		child.stdin.end();
		const stdout = await new Response(child.stdout).text();
		await child.exited;

		let id = "";
		for (const line of stdout.split("\n")) {
			try {
				const msg = JSON.parse(line);
				if (msg?.id === 1) {
					const body = JSON.parse(msg.result?.content?.[0]?.text ?? "{}");
					id = body.memory_id;
				}
			} catch {}
		}
		expect(id).not.toBe("");
		const r = row(store.dir, id);
		expect(r?.author_id).toBeNull();
		expect(r?.author_type).toBeNull();

		// Spawn with non-empty env vars
		const child2 = Bun.spawn([process.execPath, CLI, "mcp"], {
			env: {
				...engineEnv(store.dir, "o1"),
				MNEMOPI_AUTHOR_ID: "env-bot",
				MNEMOPI_AUTHOR_TYPE: "agent",
			},
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		});
		child2.stdin.write(
			`${JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name: "mnemopi_remember", arguments: { content: "non-empty env test" } },
			})}\n`,
		);
		child2.stdin.end();
		const stdout2 = await new Response(child2.stdout).text();
		await child2.exited;

		let id2 = "";
		for (const line of stdout2.split("\n")) {
			try {
				const msg = JSON.parse(line);
				if (msg?.id === 1) {
					const body = JSON.parse(msg.result?.content?.[0]?.text ?? "{}");
					id2 = body.memory_id;
				}
			} catch {}
		}
		expect(id2).not.toBe("");
		const r2 = row(store.dir, id2);
		expect(r2?.author_id).toBe("env-bot");
		expect(r2?.author_type).toBe("agent");
	});
});
