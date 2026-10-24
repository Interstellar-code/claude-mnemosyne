// H1 (EMB round 2): the model cache must stay under the plugin's root even when
// a hostile shell exports XDG_CACHE_HOME (with an existing `omp` subdir),
// OMP_PROFILE or PI_PROFILE. The engine now resolves the fastembed cache from the
// plugin-pinned PI_CONFIG_DIR directly (change 11), never through pi-utils'
// XDG/profile resolver, so an inherited XDG/profile variable cannot move it.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { EMBEDDINGS_CACHE_DIR, engineEnv } from "../../hooks/engine";

const EMBEDDINGS = join(import.meta.dir, "..", "src", "core", "embeddings.ts");

const roots: string[] = [];
function temp(prefix: string) {
	const dir = mkdtempSync(join(tmpdir(), `mnemosyne-${prefix}-`));
	roots.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

/** The engine's own cache resolution in a fresh subprocess under the given env. */
async function engineCacheDir(home: string, env: Record<string, string>): Promise<string> {
	const child = Bun.spawn(
		[process.execPath, "-e", `import { resolveFastembedCacheDir } from ${JSON.stringify(EMBEDDINGS)}; console.log(resolveFastembedCacheDir());`],
		{
			cwd: home,
			env: { ...(process.env as Record<string, string>), ...env, HOME: home },
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(`${exitCode}:${stderr}`).toBe(`0:${stderr}`);
	return stdout.trim();
}

describe("the engine resolves the cache from PI_CONFIG_DIR, ignoring inherited XDG/profile (H1)", () => {
	test("hostile inherited XDG_CACHE_HOME/OMP_PROFILE/PI_PROFILE leave the cache pinned", async () => {
		const home = temp("cache-pin");
		// A real XDG omp dir: pi-utils would redirect the cache here if it read XDG.
		mkdirSync(join(home, "xdg", "omp"), { recursive: true });
		const hostile: Record<string, string> = {
			XDG_CACHE_HOME: join(home, "xdg"),
			OMP_PROFILE: "work",
			PI_PROFILE: "work",
			PI_CODING_AGENT_DIR: join(home, "agent"),
			OPENROUTER_BASE_URL: "http://127.0.0.1:4000/v1",
			OPENROUTER_API_KEY: "sk-openrouter",
			OPENAI_API_KEY: "sk-openai",
		};
		// engineEnv is laid OVER the hostile env, as the hooks and server do.
		const pinned = { ...hostile, ...engineEnv(join(home, "store"), "global", { embeddings: true }) };
		const expected = `${home}/${EMBEDDINGS_CACHE_DIR}/cache/fastembed`;
		expect(await engineCacheDir(home, pinned)).toBe(expected);
	});
});
