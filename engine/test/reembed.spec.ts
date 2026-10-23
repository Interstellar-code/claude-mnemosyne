// EMB.4: the `reembed` command fills vectors through the engine's own backfill
// (reconcileEmbeddingModel), is a dry run with no argument, adds nothing on a
// second run, never edits or deletes a working_memory row, and refuses a model
// change unless `rebuild` is passed. Real SQLite stores, real `bun cli.ts` runs;
// only the network edge is a local embeddings-API stub, so `test:bun` stays
// offline and never loads the model (that is tests/embed's job).
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const ENGINE = join(import.meta.dir, "..");
const CLI = join(ENGINE, "src", "cli.ts");
const DIMS = 384;

/** A local OpenAI-compatible /v1/embeddings: the only thing mocked. */
let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(request) {
			const body = (await request.json()) as { input?: string[] };
			const data = (body.input ?? []).map((text, row) => ({
				embedding: Array.from({ length: DIMS }, (_, i) => (text.length + row + i) % 5 === 0 ? 0.2 : 0.1),
			}));
			return Response.json({ data });
		},
	});
	baseUrl = `http://127.0.0.1:${server.port}/v1`;
});
afterAll(() => {
	server.stop(true);
	for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

const roots: string[] = [];
function temp(prefix: string) {
	const dir = mkdtempSync(join(tmpdir(), `mnemosyne-${prefix}-`));
	roots.push(dir);
	return dir;
}

const MODEL = "BAAI/bge-small-en-v1.5";

/** Env that routes embeddings to the stub (no fastembed, no model download). */
function env(store: string, overrides: Record<string, string> = {}) {
	return {
		...(process.env as Record<string, string>),
		MNEMOPI_DATA_DIR: store,
		MNEMOPI_SESSION_ID: "reembed",
		MNEMOPI_CHANNEL_ID: "reembed",
		MNEMOPI_NO_EMBEDDINGS: "",
		MNEMOPI_MCP_BANK: "",
		MNEMOPI_LLM_BASE_URL: "",
		MNEMOPI_HOST_LLM_ENABLED: "",
		MNEMOPI_EMBEDDING_API_URL: baseUrl,
		MNEMOPI_EMBEDDINGS_VIA_API: "",
		MNEMOPI_EMBEDDING_API_KEY: "local",
		MNEMOPI_EMBEDDING_DIM: String(DIMS),
		MNEMOPI_EMBEDDING_MODEL: MODEL,
		PI_CONFIG_DIR: ".claude/mnemosyne/model-cache",
		...overrides,
	};
}

function cli(store: string, args: string[], overrides: Record<string, string> = {}) {
	const child = Bun.spawn([process.execPath, CLI, ...args], {
		cwd: ENGINE,
		env: env(store, overrides),
		stdout: "pipe",
		stderr: "pipe",
	});
	return Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
}

/** Stores two memories with embeddings OFF: the pre-embeddings state. */
async function storeWithoutVectors(store: string) {
	mkdirSync(store, { recursive: true });
	const child = Bun.spawn([process.execPath, CLI, "mcp"], {
		cwd: ENGINE,
		env: env(store, { MNEMOPI_NO_EMBEDDINGS: "1" }),
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});
	const call = (id: number, content: string) =>
		`${JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name: "mnemopi_remember", arguments: { content, source: "imported", scope: "global" } } })}\n`;
	child.stdin.write(call(1, "The user prefers pnpm over npm") + call(2, "Deploys happen on Fridays"));
	child.stdin.end();
	await Promise.all([new Response(child.stdout).text(), child.exited]);
}

function rows(store: string) {
	const db = new Database(join(store, "mnemopi.db"), { readonly: true });
	try {
		return db.query("SELECT id, content, session_id FROM working_memory ORDER BY id").all();
	} finally {
		db.close();
	}
}

function vectors(store: string) {
	const db = new Database(join(store, "mnemopi.db"), { readonly: true });
	try {
		const table = db.query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='memory_embeddings'").get() as { n: number };
		if (table.n === 0) return { n: 0, model: null as string | null };
		return db.query("SELECT COUNT(*) AS n, MAX(model) AS model FROM memory_embeddings").get() as { n: number; model: string | null };
	} finally {
		db.close();
	}
}

describe("mnemopi reembed", () => {
	test("no argument is a dry run: it counts the memories with no vector and writes nothing", async () => {
		const store = join(temp("reembed-dry"), "store");
		await storeWithoutVectors(store);
		const [stdout, , exitCode] = await cli(store, ["reembed"]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("Memories with no vector");
		expect(stdout).toMatch(/:\s*2\b/);
		expect(vectors(store).n).toBe(0);
	}, 60_000);

	test("apply fills them, and a second apply adds nothing", async () => {
		const store = join(temp("reembed-apply"), "store");
		await storeWithoutVectors(store);
		const before = rows(store);
		const first = await cli(store, ["reembed", "apply"]);
		expect(first[2]).toBe(0);
		const after = vectors(store);
		expect(after.n).toBe(2);
		expect(after.model).toBe(MODEL);
		// It never edits or deletes a working_memory row.
		expect(rows(store)).toEqual(before);
		const second = await cli(store, ["reembed", "apply"]);
		expect(second[2]).toBe(0);
		expect(vectors(store).n).toBe(2);
		expect(rows(store)).toEqual(before);
	}, 120_000);

	test("a model change is refused without rebuild, and the stored vectors survive", async () => {
		const store = join(temp("reembed-model"), "store");
		await storeWithoutVectors(store);
		expect((await cli(store, ["reembed", "apply"]))[2]).toBe(0);
		expect(vectors(store).n).toBe(2);
		// A different active model is a mismatch: apply must refuse, leaving the vectors.
		const refused = await cli(store, ["reembed", "apply"], { MNEMOPI_EMBEDDING_MODEL: "BAAI/bge-base-en-v1.5" });
		expect(refused[2]).toBe(1);
		expect(`${refused[0]}${refused[1]}`).toMatch(/rebuild/);
		expect(vectors(store).model).toBe(MODEL);
		expect(vectors(store).n).toBe(2);
	}, 120_000);
});
