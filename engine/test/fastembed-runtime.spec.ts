// EMB.2.a2 and EMB.2.a3: a spawned engine with embeddings on exits 0 without an
// ORT panic, and a failed fastembed import turns embeddings off (full-text only,
// the command still answers) instead of `bun install`ing fastembed at runtime.
//
// The "import fails" case uses a copy of the engine whose node_modules links every
// real dependency except fastembed (and onnxruntime-node), so
// `createRequire.resolve('fastembed')` throws the way a stripped install does.
// A runtime install (the old behaviour) would leave
// <home>/.claude/mnemosyne/model-cache/cache/fastembed-runtime behind.
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { afterAll, describe, expect, test } from "bun:test";

const ENGINE = join(import.meta.dir, "..");

const roots: string[] = [];
function temp(prefix: string) {
	const dir = mkdtempSync(join(tmpdir(), `mnemosyne-${prefix}-`));
	roots.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

/** Env with embeddings on: the pins engineEnv sets, plus a HOME whose cache is empty. */
function embedEnv(store: string, home: string) {
	// Drop NODE_ENV/BUN_ENV=test: under `bun test` the engine's embeddings.ts would
	// short-circuit (`inTestRuntime`) and never touch fastembed, hiding the real path.
	const base = { ...(process.env as Record<string, string>) };
	delete base.NODE_ENV;
	delete base.BUN_ENV;
	return {
		...base,
		HOME: home,
		MNEMOPI_DATA_DIR: store,
		MNEMOPI_SESSION_ID: "emb",
		MNEMOPI_CHANNEL_ID: "emb",
		MNEMOPI_NO_EMBEDDINGS: "",
		MNEMOPI_MCP_BANK: "",
		MNEMOPI_LLM_BASE_URL: "",
		MNEMOPI_HOST_LLM_ENABLED: "",
		MNEMOPI_EMBEDDING_API_URL: "",
		MNEMOPI_EMBEDDINGS_VIA_API: "",
		MNEMOPI_EMBEDDING_API_KEY: "",
		MNEMOPI_EMBEDDING_MODEL: "BAAI/bge-small-en-v1.5",
		PI_CONFIG_DIR: ".claude/mnemosyne/model-cache",
	};
}

/** The 2-call stdin: remember then recall, ids 1 and 2. */
const STDIN =
	`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "mnemopi_remember", arguments: { content: "hello world", source: "imported", scope: "global" } } })}\n` +
	`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "mnemopi_recall", arguments: { query: "hello" } } })}\n`;

function run(cli: string, cwd: string, env: Record<string, string>) {
	const child = Bun.spawn([process.execPath, cli, "mcp"], { cwd, env, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
	child.stdin.write(STDIN);
	child.stdin.end();
	return Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
}

/** Vectors in the store; a missing table counts as 0. */
function vectorCount(store: string): number {
	const db = new Database(join(store, "mnemopi.db"), { readonly: true });
	try {
		const table = db.query("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='memory_embeddings'").get() as { n: number };
		return table.n > 0 ? (db.query("SELECT COUNT(*) AS n FROM memory_embeddings").get() as { n: number }).n : 0;
	} finally {
		db.close();
	}
}

describe("a failed fastembed import means embeddings off, never an install (EMB.2.a3)", () => {
	test("the engine answers both calls, exits 0, and installs nothing", async () => {
		const root = temp("nofe");
		const copy = join(root, "engine");
		mkdirSync(join(copy, "node_modules"), { recursive: true });
		await Bun.$`cp -R ${join(ENGINE, "src")} ${join(copy, "src")}`.quiet();
		copyFileSync(join(ENGINE, "package.json"), join(copy, "package.json"));
		for (const entry of readdirSync(join(ENGINE, "node_modules"))) {
			if (entry === "fastembed" || entry === "onnxruntime-node" || entry === ".bin") continue;
			symlinkSync(join(ENGINE, "node_modules", entry), join(copy, "node_modules", entry));
		}
		// The copy really cannot resolve fastembed: the "failed import" precondition.
		expect(() => createRequire(join(copy, "src", "cli.ts")).resolve("fastembed")).toThrow();

		const home = join(root, "home");
		const store = join(root, "store");
		mkdirSync(store, { recursive: true });
		const [stdout, stderr, exitCode] = await run(join(copy, "src", "cli.ts"), copy, embedEnv(store, home));
		const ids = stdout
			.split("\n")
			.filter(Boolean)
			.map(line => JSON.parse(line).id);
		expect(exitCode).toBe(0);
		expect(ids).toEqual([1, 2]);
		expect(stderr).not.toMatch(/panic: A C\+\+ exception occurred|oh no: Bun has crashed/i);
		// The old fallback `bun install`ed fastembed into cache/fastembed-runtime.
		expect(existsSync(join(home, ".claude/mnemosyne/model-cache/cache/fastembed-runtime"))).toBe(false);
		// No vector was written: recall is full-text only.
		expect(vectorCount(store)).toBe(0);
	}, 60_000);
});

// The clean-run case (a model is present, the run exits 0 and stores a vector)
// needs the model, so it lives in tests/embed/embed.spec.ts, which test:bun
// never runs.
