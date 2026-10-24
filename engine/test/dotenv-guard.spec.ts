// H1b + C1b (EMB re-review round 2): the pi-utils dotenv pass (env.ts:288-314)
// re-reads `~/.env`, `<configRoot>/.env`, `<agentDir>/.env` and `<cwd>/.env` and
// fills every FALSY key, then rebuilds the dirs resolver. So an empty-string pin
// is not a pin: an `XDG_CACHE_HOME` line in `~/.env` still moves the model cache
// (H1b), and an `MNEMOPI_EMBEDDINGS_API_OPT_IN=1` line still reopens the API
// route (C1b).
//
// The fix: engineEnv pins `MNEMOPI_EMBEDDINGS_API_OPT_IN='0'` (non-empty, so the
// dotenv pass cannot fill it), and the engine resolves the fastembed cache from
// the plugin-pinned, non-empty `PI_CONFIG_DIR` directly — never through pi-utils'
// XDG/profile resolver. This spec runs the engine module in a fresh subprocess
// whose HOME and cwd hold a hostile `.env`, and asserts both hold.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { engineEnv } from "../../hooks/engine";

const EMBEDDINGS = join(import.meta.dir, "..", "src", "core", "embeddings.ts");
const PI_UTILS = join(import.meta.dir, "..", "node_modules", "@oh-my-pi", "pi-utils", "src", "index.ts");

const roots: string[] = [];
function temp(prefix: string) {
	const dir = mkdtempSync(join(tmpdir(), `mnemosyne-${prefix}-`));
	roots.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

/** Run `body` in a fresh subprocess with HOME+cwd = home, engineEnv laid over the env, and a hostile `.env`. */
async function probe(home: string, body: string, dotenv: string): Promise<string> {
	writeFileSync(join(home, ".env"), `${dotenv}\n`);
	const child = Bun.spawn([process.execPath, "-e", body], {
		cwd: home,
		env: { ...(process.env as Record<string, string>), ...engineEnv(join(home, "store"), "global", { embeddings: true }), HOME: home },
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(`${exitCode}:${stderr}`).toBe(`0:${stderr}`);
	return stdout.trim();
}

describe("the dotenv pass cannot move the cache or reopen the API route (H1b, C1b)", () => {
	test("C1b: an opt-in + URL in ~/.env / cwd .env still leaves the API route off", async () => {
		const home = temp("dotenv-api");
		const hostile = [
			`MNEMOPI_EMBEDDING_API_URL=http://127.0.0.1:47123/v1`,
			`MNEMOPI_EMBEDDINGS_API_OPT_IN=1`,
			`OPENROUTER_BASE_URL=http://127.0.0.1:47123/v1`,
		].join("\n");
		const result = await probe(
			home,
			`import { isApiModel } from ${JSON.stringify(EMBEDDINGS)}; console.log(isApiModel("BAAI/bge-small-en-v1.5"));`,
			hostile,
		);
		expect(result).toBe("false");
	});

	test("H1b: an XDG_CACHE_HOME + profile in ~/.env / cwd .env leaves the cache pinned", async () => {
		const home = temp("dotenv-cache");
		mkdirSync(join(home, "xdgdot", "omp"), { recursive: true });
		const hostile = [
			`XDG_CACHE_HOME=${join(home, "xdgdot")}`,
			`OMP_PROFILE=work`,
			`PI_PROFILE=work`,
			`PI_CODING_AGENT_DIR=${join(home, "agent")}`,
		].join("\n");
		const body =
			`import { resolveFastembedCacheDir } from ${JSON.stringify(EMBEDDINGS)}; ` +
			`import { getFastembedCacheDir } from ${JSON.stringify(PI_UTILS)}; ` +
			`console.log(JSON.stringify({ pinned: resolveFastembedCacheDir(), pi: getFastembedCacheDir() }));`;
		const result = JSON.parse(await probe(home, body, hostile)) as { pinned: string; pi: string };
		// The engine's own resolution stays on the plugin-pinned path.
		expect(result.pinned).toBe(`${home}/.claude/mnemosyne/model-cache/cache/fastembed`);
		// The pi-utils path (what the old code used) escapes to the XDG dir, so the
		// control documents the bug this change closes.
		expect(result.pi).not.toBe(result.pinned);
	});
});
