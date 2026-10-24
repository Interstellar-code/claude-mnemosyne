// Test helpers for the mnemosyne engine changes (engine/UPSTREAM.md): a real
// temporary store and real `bun src/cli.ts mcp` processes, as the plugin runs them.
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const CLI = join(import.meta.dir, "..", "src", "cli.ts");

let home: string | undefined;

/**
 * A fresh HOME for the engine processes a spec spawns, removed when the test process exits. Without it the
 * engine writes its omp.*.log files under the real ~/.claude/mnemosyne/model-cache/logs.
 */
export function testHome(): string {
	if (home === undefined) {
		const dir = mkdtempSync(join(tmpdir(), "mnemosyne-engine-home-"));
		home = dir;
		process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
	}
	return home;
}

/** HOME and PI_CONFIG_DIR (a path under HOME, as the plugin sets it) for a spawned engine process. */
export function homeEnv(): Record<string, string> {
	return { HOME: testHome(), PI_CONFIG_DIR: ".claude/mnemosyne/model-cache" };
}

export type Reply = { isError: boolean; body: Record<string, unknown>; text: string };

export function tempStore(): { dir: string; dispose(): void } {
	const dir = mkdtempSync(join(tmpdir(), "mnemosyne-engine-test-"));
	return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

export function engineEnv(dir: string, owner: string): Record<string, string> {
	return {
		...(process.env as Record<string, string>),
		MNEMOPI_DATA_DIR: dir,
		MNEMOPI_SESSION_ID: owner,
		MNEMOPI_CHANNEL_ID: owner,
		MNEMOPI_NO_EMBEDDINGS: "1",
		MNEMOPI_MCP_BANK: "",
		MNEMOPI_LLM_BASE_URL: "",
		MNEMOPI_HOST_LLM_ENABLED: "",
		...homeEnv(),
	};
}

/** Starts one engine process for `calls`; resolve the returned promise for the replies, in order. */
export function startMcp(
	dir: string,
	owner: string,
	calls: readonly (readonly [string, Record<string, unknown>])[],
): Promise<Reply[]> {
	const child = Bun.spawn([process.execPath, CLI, "mcp"], {
		env: engineEnv(dir, owner),
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});
	child.stdin.write(
		calls
			.map(
				([name, args], i) =>
					`${JSON.stringify({ jsonrpc: "2.0", id: i + 1, method: "tools/call", params: { name, arguments: args } })}\n`,
			)
			.join(""),
	);
	child.stdin.end();
	return (async () => {
		const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
		await child.exited;
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
			if (reply === undefined) throw new Error(`no reply ${i + 1}; exit ${child.exitCode}; stderr: ${stderr.slice(-500)}`);
			const text = reply.result?.content?.[0]?.text ?? "";
			let body: Record<string, unknown> = {};
			try {
				body = JSON.parse(text);
			} catch {
				body = { text };
			}
			return { isError: reply.result?.isError === true, body, text };
		});
	})();
}

export const mcp = startMcp;

/** Stores one durable memory as `owner` and returns its id. */
export async function remember(
	dir: string,
	owner: string,
	content: string,
	extra: Record<string, unknown> = {},
): Promise<string> {
	const [reply] = await mcp(dir, owner, [
		["mnemopi_remember", { content, source: "imported", scope: "global", importance: 0.5, ...extra }],
	]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	return id;
}

export function openDb(dir: string): Database {
	return new Database(join(dir, "mnemopi.db"));
}

export function row(dir: string, id: string): Record<string, unknown> | null {
	const db = openDb(dir);
	try {
		return db.query("SELECT * FROM working_memory WHERE id = ?").get(id) as Record<string, unknown> | null;
	} finally {
		db.close();
	}
}

export function metadataOf(dir: string, id: string): unknown {
	const value = row(dir, id)?.metadata_json;
	return typeof value === "string" ? JSON.parse(value) : value;
}
