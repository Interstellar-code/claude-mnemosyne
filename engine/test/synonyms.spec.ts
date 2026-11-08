// Issue #12: a word listed in several synonym groups expands to every group it belongs to, not only the last.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { getSynonyms, normalizeQuery } from "../src/core/synonyms";
import { mcp, remember, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

test("getSynonyms('token') includes the password group and the key group, deduped, in group order", () => {
	const words = getSynonyms("token");
	expect(words).toContain("password");
	expect(words).toContain("pwd");
	expect(words).toContain("key");
	expect(words).toContain("api_key");
	expect(new Set(words).size).toBe(words.length);
	expect(words.indexOf("password")).toBeLessThan(words.indexOf("key"));
	expect(getSynonyms("push")).toEqual(expect.arrayContaining(["deploy", "rollout", "git", "commit"]));
});

test("a single-group word and an unknown word keep their expansion", () => {
	expect(getSynonyms("DB")).toEqual(["database", "db", "datastore", "data_store"]);
	expect(getSynonyms("heron")).toEqual(["heron"]);
});

test("normalizeQuery still maps to one canonical", () => {
	expect(normalizeQuery("token")).toBe("key");
});

test("a recall for 'token' finds a memory that uses only a password-group word", async () => {
	const id = await remember(store.dir, "o1", "the staging pwd lives in the vault");
	const [reply] = await mcp(store.dir, "o1", [["mnemopi_recall", { query: "token", update_recall_counts: false }]]);
	expect((reply!.body.results as { id: string }[]).map(r => r.id)).toContain(id);
});
