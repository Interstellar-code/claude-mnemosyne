// MODEL.3: mnemopi_similar returns the closest live memories by cosine, read-only
// engine/UPSTREAM.md change 14. Fixture vectors come from a local embeddings-API stub
// (the only thing mocked), so test:bun stays offline; the real model is tests/embed's job.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { engineEnv, openDb, tempStore, type Reply } from "./helpers";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");
const DIMS = 384;
const MODEL = "BAAI/bge-small-en-v1.5";

/** A unit-ish vector: weight w[i] on axis i, zero elsewhere. */
function axes(weights: Record<number, number>): number[] {
	const v = new Array<number>(DIMS).fill(0);
	for (const [i, w] of Object.entries(weights)) v[Number(i)] = w;
	return v;
}

// The fixture: text -> vector. Cosine to QUERY: NEAR 0.995, EDGE 0.912, MID 0.800, UNRELATED 0.
const QUERY = "the deploy runs on fridays";
const FIXTURE: Record<string, number[]> = {
	[QUERY]: axes({ 0: 1 }),
	"deploys happen every friday": axes({ 0: 1, 1: 0.1 }), // NEAR
	"friday is deploy day, mostly": axes({ 0: 1, 1: 0.45 }), // EDGE
	"releases are sometimes on fridays": axes({ 0: 1, 1: 0.75 }), // MID
	"the user likes dark mode": axes({ 2: 1 }), // UNRELATED
};

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;
beforeAll(() => {
	server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(request) {
			const body = (await request.json()) as { input?: string[] };
			const data = (body.input ?? []).map(text => ({ embedding: FIXTURE[text] ?? axes({ 3: 1 }) }));
			return Response.json({ data });
		},
	});
	baseUrl = `http://127.0.0.1:${server.port}/v1`;
});
afterAll(() => server.stop(true));

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

/** One engine process with embeddings routed to the stub (or off). */
async function run(
	owner: string,
	calls: readonly (readonly [string, Record<string, unknown>])[],
	embeddings = true,
): Promise<Reply[]> {
	const child = Bun.spawn([process.execPath, CLI, "mcp"], {
		env: {
			...engineEnv(store.dir, owner),
			MNEMOPI_NO_EMBEDDINGS: embeddings ? "" : "1",
			MNEMOPI_EMBEDDING_API_URL: baseUrl,
			MNEMOPI_EMBEDDINGS_VIA_API: "",
			MNEMOPI_EMBEDDING_API_KEY: "local",
			MNEMOPI_EMBEDDING_DIM: String(DIMS),
			MNEMOPI_EMBEDDING_MODEL: MODEL,
			PI_CONFIG_DIR: ".claude/mnemosyne/model-cache",
			MNEMOPI_EMBEDDINGS_API_OPT_IN: "1",
		},
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});
	child.stdin.write(
		calls
			.map(([name, args], i) => `${JSON.stringify({ jsonrpc: "2.0", id: i + 1, method: "tools/call", params: { name, arguments: args } })}\n`)
			.join(""),
	);
	child.stdin.end();
	const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
	const byId = new Map<number, { result?: { content?: { text?: string }[]; isError?: boolean } }>();
	for (const line of stdout.split("\n")) {
		try {
			const message = JSON.parse(line);
			if (typeof message?.id === "number") byId.set(message.id, message);
		} catch {
			// engine chatter
		}
	}
	return calls.map((_, i) => {
		const reply = byId.get(i + 1);
		if (reply === undefined) throw new Error(`no reply ${i + 1}; stderr: ${stderr.slice(-400)}`);
		const text = reply.result?.content?.[0]?.text ?? "";
		let body: Record<string, unknown> = {};
		try {
			body = JSON.parse(text);
		} catch {
			body = { text };
		}
		return { isError: reply.result?.isError === true, body, text };
	});
}

async function save(owner: string, content: string, extra: Record<string, unknown> = {}): Promise<string> {
	const [reply] = await run(owner, [["mnemopi_remember", { content, source: "mcp", scope: "global", ...extra }]]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	return id;
}

async function similar(owner: string, args: Record<string, unknown> = {}) {
	const [reply] = await run(owner, [["mnemopi_similar", { content: QUERY, ...args }]]);
	return reply!;
}

type Match = { id: string; owner: string; score: number; preview: string };
const matchesOf = (reply: Reply) => reply.body.matches as Match[];

/** Everything a read must not change. */
function snapshot(): unknown {
	const db = new Database(join(store.dir, "mnemopi.db"), { readonly: true });
	try {
		const count = (table: string) => (db.query(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
		return {
			working_memory: count("working_memory"),
			memory_embeddings: count("memory_embeddings"),
			annotations: count("annotations"),
			recalls: db.query("SELECT id, recall_count, last_recalled FROM working_memory ORDER BY id").all(),
		};
	} finally {
		db.close();
	}
}

describe("MODEL.3: mnemopi_similar", () => {
	test("MODEL.3.a1: only rows at or above min_score come back, best first, with owner, score and an 80-char preview", async () => {
		const near = await save("o1", "deploys happen every friday");
		const edge = await save("o1", "friday is deploy day, mostly");
		await save("o1", "releases are sometimes on fridays");
		await save("o1", "the user likes dark mode");

		const reply = await similar("o1", { top_k: 10 });
		expect(reply.isError).toBe(false);
		expect(reply.body.embeddings).toBe(true);
		const matches = matchesOf(reply);
		expect(matches.map(m => m.id)).toEqual([near, edge]);
		expect(matches[0]!.owner).toBe("o1");
		expect(matches[0]!.score).toBeCloseTo(0.995, 2);
		expect(matches[1]!.score).toBeCloseTo(0.912, 2);
		expect(matches[0]!.preview).toBe("deploys happen every friday");

		const lower = matchesOf(await similar("o1", { top_k: 10, min_score: 0.7 }));
		expect(lower).toHaveLength(3);
		const capped = matchesOf(await similar("o1", { top_k: 1, min_score: 0.7 }));
		expect(capped.map(m => m.id)).toEqual([near]);
	});

	test("MODEL.3.a2: top_k defaults to 3 and is held to 1-10; the preview is cut at 80 chars", async () => {
		const long = "deploys happen every friday";
		FIXTURE[`${long} ${"x".repeat(100)}`] = axes({ 0: 1, 1: 0.1 });
		await save("o1", `${long} ${"x".repeat(100)}`);
		for (let i = 0; i < 4; i += 1) {
			FIXTURE[`near copy ${i}`] = axes({ 0: 1, 1: 0.05 * (i + 1) });
			await save("o1", `near copy ${i}`);
		}
		expect(matchesOf(await similar("o1"))).toHaveLength(3);
		expect(matchesOf(await similar("o1", { top_k: 0 }))).toHaveLength(1);
		expect(matchesOf(await similar("o1", { top_k: 99 }))).toHaveLength(5);
		const [first] = matchesOf(await similar("o1", { top_k: 10, min_score: 0.99 }));
		expect(first!.preview.length).toBeLessThanOrEqual(80);
	});

	test("MODEL.3.a3: the caller's own rows and global rows count; another owner's session row does not", async () => {
		const mine = await save("o1", "deploys happen every friday", { scope: "session" });
		const theirGlobal = await save("o2", "friday is deploy day, mostly", { scope: "global" });
		await save("o2", "deploys happen every friday and more", { scope: "session" }); // unknown text -> axis 3
		FIXTURE["o2 private near"] = axes({ 0: 1, 1: 0.05 });
		const theirPrivate = await save("o2", "o2 private near", { scope: "session" });

		const matches = matchesOf(await similar("o1", { top_k: 10 }));
		expect(matches.map(m => m.id).sort()).toEqual([mine, theirGlobal].sort());
		expect(matches.find(m => m.id === theirGlobal)?.owner).toBe("o2");
		expect(matches.map(m => m.id)).not.toContain(theirPrivate);
	});

	test("MODEL.3.a4: superseded, expired and vectorless rows are left out; a future expiry stays in", async () => {
		const superseded = await save("o1", "deploys happen every friday");
		const expired = await save("o1", "friday is deploy day, mostly");
		FIXTURE["future near"] = axes({ 0: 1, 1: 0.05 });
		const future = await save("o1", "future near", { valid_until: "2099-01-01" });
		FIXTURE["no vector near"] = axes({ 0: 1, 1: 0.02 });
		const vectorless = await save("o1", "no vector near");
		const db = openDb(store.dir);
		try {
			db.run("UPDATE working_memory SET superseded_by = 'x' WHERE id = ?", [superseded]);
			db.run("UPDATE working_memory SET valid_until = '2020-01-01T00:00:00.000Z' WHERE id = ?", [expired]);
			db.run("DELETE FROM memory_embeddings WHERE memory_id = ?", [vectorless]);
		} finally {
			db.close();
		}
		const matches = matchesOf(await similar("o1", { top_k: 10 }));
		expect(matches.map(m => m.id)).toEqual([future]);
	});

	test("MODEL.3.a5: with embeddings off it returns no matches, embeddings false, and no error", async () => {
		await save("o1", "deploys happen every friday");
		const [reply] = await run("o1", [["mnemopi_similar", { content: QUERY }]], false);
		expect(reply!.isError).toBe(false);
		expect(reply!.body).toEqual({ matches: [], embeddings: false });
	});

	test("MODEL.3.a6: an empty store and a missing content argument", async () => {
		const empty = await similar("o1");
		expect(empty.body).toEqual({ matches: [], embeddings: true });
		const [missing] = await run("o1", [["mnemopi_similar", {}]]);
		expect(missing!.body.error).toBe("content is required");
	});

	test("MODEL.3.a7: it writes nothing: row counts of working_memory, memory_embeddings, annotations and every recall_count stay", async () => {
		await save("o1", "deploys happen every friday");
		await save("o1", "friday is deploy day, mostly");
		await save("o1", "the user likes dark mode");
		const before = snapshot();
		for (let i = 0; i < 2; i += 1) {
			const reply = await similar("o1", { top_k: 10, min_score: 0.1 });
			expect(matchesOf(reply).length).toBeGreaterThan(0);
		}
		await run("o1", [["mnemopi_similar", { content: QUERY }]], false);
		expect(snapshot()).toEqual(before);
	});

	test("MODEL.3.a8: it is a plugin-private engine tool: not in bin/mcp-proxy.ts's allow-list", () => {
		const proxy = readFileSync(join(import.meta.dir, "..", "..", "bin", "mcp-proxy.ts"), "utf8");
		const allowed = /const ALLOWED = new Set\(\[([^\]]*)\]\)/.exec(proxy)?.[1] ?? "";
		expect(allowed).toContain("memory_recall");
		expect(allowed).not.toMatch(/similar/);
		expect(proxy).not.toMatch(/mnemopi_similar/);
	});
});
