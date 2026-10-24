// H1 (EMB review round 2): the model cache must stay under the plugin's root even
// when a hostile shell exports XDG_CACHE_HOME (pointing at a directory with an
// `omp` subdir that exists), OMP_PROFILE or PI_PROFILE. pi-utils dirs.ts redirects
// the fastembed cache to $XDG_CACHE_HOME/omp (or the profile subdir) when those
// are set, so the readiness check and the engine disagree and the engine downloads
// the model lazily outside setup. engineEnv pins them to '', which must win when
// laid over the inherited env.
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { EMBEDDINGS_CACHE_DIR, engineEnv } from "../../hooks/engine";

const roots: string[] = [];
function temp(prefix: string) {
	const dir = mkdtempSync(join(tmpdir(), `mnemosyne-${prefix}-`));
	roots.push(dir);
	return dir;
}
afterAll(() => {
	for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

// getFastembedCacheDir() is computed once at pi-utils module load from process.env,
// so it is read in a fresh subprocess per env, exactly as the engine does. The
// import is an absolute path so the probe can run from a throwaway cwd and never
// leave Bun's `bun/@t@` transpile cache in the engine tree.
const PI_UTILS = join(import.meta.dir, "..", "node_modules", "@oh-my-pi", "pi-utils", "src", "index.ts");

async function fastembedCacheDir(home: string, extra: Record<string, string>): Promise<string> {
	const child = Bun.spawn(
		[process.execPath, "-e", `import { getFastembedCacheDir } from ${JSON.stringify(PI_UTILS)}; console.log(getFastembedCacheDir());`],
		{
			// Run from a throwaway cwd so Bun's transpile cache never lands in the
			// engine tree (pi-utils resolves paths from env, not cwd).
			cwd: home,
			env: { ...(process.env as Record<string, string>), ...extra, HOME: home },
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	expect(`${exitCode}:${stderr}`).toBe(`0:`);
	return stdout.trim();
}

describe("the pinned model cache survives hostile XDG/profile env (H1)", () => {
	test("engineEnv laid over XDG_CACHE_HOME/OMP_PROFILE/PI_PROFILE keeps the plugin's cache dir", async () => {
		const home = temp("cache-pin");
		// A real XDG omp dir: pi-utils redirects only when <xdg>/omp exists.
		mkdirSync(join(home, "xdg", "omp"), { recursive: true });
		const hostile: Record<string, string> = {
			XDG_CACHE_HOME: join(home, "xdg"),
			OMP_PROFILE: "work",
			PI_PROFILE: "work",
			OPENROUTER_BASE_URL: "http://127.0.0.1:4000/v1",
			OPENROUTER_API_KEY: "sk-openrouter",
			OPENAI_API_KEY: "sk-openai",
		};
		// engineEnv is laid OVER the hostile env, as the hooks and server do.
		const pinned = { ...hostile, ...engineEnv(join(home, "store"), "global", { embeddings: true }) };
		const expected = `${home}/${EMBEDDINGS_CACHE_DIR}/cache/fastembed`;
		expect(await fastembedCacheDir(home, pinned)).toBe(expected);
		// Without the pins the bug reproduces: the cache escapes to the XDG omp dir.
		expect(await fastembedCacheDir(home, { ...hostile, PI_CONFIG_DIR: EMBEDDINGS_CACHE_DIR })).not.toBe(expected);
	});
});
