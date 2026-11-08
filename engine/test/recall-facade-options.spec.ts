// Issue #7: the memory facade's recall()/recallEnhanced() forwarded a fresh
// options object to beam recall that dropped useSynonyms, useIntent, useMmr
// and mmrLambda. Real temporary store, no embeddings.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";
import { Mnemopi } from "../src/core/memory";
import { tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
let memory: Mnemopi;
beforeEach(() => {
	store = tempStore();
	memory = new Mnemopi({ dbPath: join(store.dir, "m.db"), noEmbeddings: true });
});
afterEach(() => {
	memory.close();
	store.dispose();
});

test("useSynonyms:false through the facade disables a synonym-only match", async () => {
	memory.remember("the team prefers tabs over spaces");
	const byDefault = await memory.recall("preference", 5);
	expect(byDefault.map(r => r.content)).toContain("the team prefers tabs over spaces");
	const noSynonyms = await memory.recall("preference", 5, { useSynonyms: false });
	expect(noSynonyms.map(r => r.content)).not.toContain("the team prefers tabs over spaces");
});

test("recall and recallEnhanced forward useSynonyms, useIntent, useMmr and mmrLambda; unset stays undefined", async () => {
	const seen: { name: string; options: Record<string, unknown> }[] = [];
	const beam = memory.beam as unknown as Record<string, (...args: unknown[]) => unknown>;
	for (const name of ["recall", "recallEnhanced"]) {
		const original = beam[name]!.bind(memory.beam);
		beam[name] = (query: unknown, topK: unknown, options: unknown) => {
			seen.push({ name, options: options as Record<string, unknown> });
			return original(query, topK, options);
		};
	}
	const flags = { useSynonyms: false, useIntent: true, useMmr: true, mmrLambda: 0.3 };
	await memory.recall("anything", 5, flags);
	expect(seen[0]).toMatchObject({ name: "recall", options: flags });

	seen.length = 0;
	await memory.recallEnhanced("anything", 5, flags);
	expect(seen[0]).toMatchObject({ name: "recallEnhanced", options: flags });

	seen.length = 0;
	await memory.recall("anything", 5);
	for (const key of Object.keys(flags)) expect(seen[0]!.options[key]).toBeUndefined();
});
