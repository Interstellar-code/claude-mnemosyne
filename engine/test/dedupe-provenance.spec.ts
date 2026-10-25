// MODEL.8: a re-save (same content, same owner) keeps the first writer's source and trust tier, as it already
// keeps the first author and never lowers veracity. engine/UPSTREAM.md change 18.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcp, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

async function save(content: string, extra: Record<string, unknown>): Promise<string> {
	const [reply] = await mcp(store.dir, "o1", [["mnemopi_remember", { content, ...extra }]]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	return id;
}

describe("MODEL.8: a re-save keeps the first writer's source and trust tier", () => {
	test("MODEL.8.a1: a human STATED row re-saved by an outside agent keeps source 'user' and STATED", async () => {
		const text = "we deploy on fridays only after review";
		const id = await save(text, {
			source: "user",
			trust_tier: "STATED",
			author_id: "rohit",
			author_type: "human",
			veracity: "stated",
			scope: "global",
		});
		const again = await save(text, {
			source: "mcp:cursor",
			trust_tier: "EXTERNAL_WRITE",
			author_id: "cursor",
			author_type: "agent",
			scope: "global",
		});
		expect(again).toBe(id);
		const r = row(store.dir, id);
		expect(r?.source).toBe("user");
		expect(r?.trust_tier).toBe("STATED");
		// the pair that already held: first author and veracity
		expect(r?.author_id).toBe("rohit");
		expect(r?.author_type).toBe("human");
		expect(r?.veracity).toBe("stated");
	});

	test("MODEL.8.a2: a DERIVED claude-code row re-saved as STATED user keeps DERIVED and claude-code", async () => {
		const text = "the importer derives kinds from the heading text";
		const id = await save(text, { source: "claude-code", trust_tier: "DERIVED", scope: "global" });
		await save(text, { source: "user", trust_tier: "STATED", scope: "global" });
		const r = row(store.dir, id);
		expect(r?.source).toBe("claude-code");
		expect(r?.trust_tier).toBe("DERIVED");
	});

	test("MODEL.8.a3: a re-save still refreshes the timestamp, raises importance and widens scope", async () => {
		const text = "a note that gets saved twice by two writers";
		const id = await save(text, { source: "user", importance: 0.3, scope: "channel" });
		const first = row(store.dir, id);
		await new Promise(resolve => setTimeout(resolve, 20));
		await save(text, { source: "mcp:cursor", importance: 0.8, scope: "global" });
		const r = row(store.dir, id);
		expect(r?.source).toBe("user");
		expect(r?.importance).toBe(0.8);
		expect(r?.scope).toBe("global");
		expect(String(r?.timestamp) > String(first?.timestamp)).toBe(true);
	});
});
