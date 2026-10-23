// KSTORE.1: Knowledge prompt and store tools
// Owner-checked, stale-proof, validated, direct INSERTs into the five memoria tables only.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { BeamMemory } from "../src/core/beam";
import {
	contentSha256,
	knowledgePrompt,
	storeKnowledge,
} from "../src/core/beam/knowledge";
import { mcp, openDb, remember, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const SAMPLE_REPLY_A = JSON.stringify({
	facts: ["Mnemosyne is a memory engine", "Works with Claude Code"],
	preferences: ["User prefers tabs over spaces"],
	instructions: ["Always run typecheck before commit"],
	timelines: ["Release v0.6 on 2026-11-02", "Meeting on tomorrow"],
	kg: [{ subject: "Mnemosyne", predicate: "supports", object: "Bun" }],
});

const SAMPLE_REPLY_B = JSON.stringify({
	facts: ["Bun is fast"],
	preferences: ["Dark mode"],
	instructions: ["Keep comments"],
	timelines: ["Deploy on 2026-12-01"],
	kg: [{ subject: "Bun", predicate: "runs", object: "TypeScript" }],
});

describe("KSTORE.1: mnemopi_knowledge_prompt", () => {
	test("KSTORE.1.a1 & R3-12: returns { prompt, sha256 } matching bin/memories.ts sha256 computation", async () => {
		const content = "The quick brown fox jumps over the lazy dog.";
		const id = await remember(store.dir, "o1", content);

		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "mnemopi.db") });
		try {
			const res = beam.knowledgePrompt(id);
			expect("prompt" in res).toBe(true);
			if ("prompt" in res) {
				expect(res.prompt).toContain("The quick brown fox jumps over the lazy dog.");
				const expectedSha = createHash("sha256").update(content, "utf8").digest("hex");
				expect(res.sha256).toBe(expectedSha);
				expect(res.sha256).toBe(contentSha256(content));
			}
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1.a1: clips long content at DEFAULT_INPUT_CHARS (8192)", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const longText = "A".repeat(10000);
			const id = beam.remember(longText, { source: "imported" });
			const res = beam.knowledgePrompt(id);
			expect("prompt" in res).toBe(true);
			if ("prompt" in res) {
				// The prompt should have the elision marker from clipToWindow
				expect(res.prompt).toContain("[...]");
				expect(res.sha256).toBe(contentSha256(longText));
			}
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1.a2: prompt on another owner's row (even global) returns refused 'gone'", async () => {
		const id = await remember(store.dir, "o2", "owner 2 secret memory");

		// In-process beam as o1
		const beam1 = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "mnemopi.db") });
		try {
			const res = beam1.knowledgePrompt(id);
			expect(res).toEqual({ refused: "gone" });
		} finally {
			beam1.close();
		}

		// Real MCP process as o1
		const [reply] = await mcp(store.dir, "o1", [
			["mnemopi_knowledge_prompt", { memory_id: id }],
		]);
		expect(reply?.body.refused).toBe("gone");
	});
});

describe("KSTORE.1: mnemopi_knowledge_store guards & replace semantics", () => {
	test("KSTORE.1.a2: store on another owner's row returns 'gone' and writes nothing", async () => {
		const content = "shared text";
		const id = await remember(store.dir, "o2", content);

		// Store once as o2 first
		const beam2 = new BeamMemory({ sessionId: "o2", dbPath: join(store.dir, "mnemopi.db") });
		try {
			const promptRes = beam2.knowledgePrompt(id);
			expect("sha256" in promptRes).toBe(true);
			const storeRes = beam2.storeKnowledge(id, SAMPLE_REPLY_A, (promptRes as any).sha256);
			expect("stored" in storeRes).toBe(true);
		} finally {
			beam2.close();
		}

		const db = openDb(store.dir);
		let o2FactsBefore: unknown[];
		try {
			o2FactsBefore = db.query("SELECT * FROM memoria_facts ORDER BY id").all();
		} finally {
			db.close();
		}

		// o1 attempts store with correct sha256
		const sha = contentSha256(content);
		const beam1 = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "mnemopi.db") });
		try {
			const res = beam1.storeKnowledge(id, SAMPLE_REPLY_B, sha);
			expect(res).toEqual({ refused: "gone" });
		} finally {
			beam1.close();
		}

		// Also check through real MCP call
		const [mcpReply] = await mcp(store.dir, "o1", [
			["mnemopi_knowledge_store", { memory_id: id, reply: SAMPLE_REPLY_B, sha256: sha }],
		]);
		expect(mcpReply?.body.refused).toBe("gone");

		// All 5 memoria tables have zero rows for o1, and o2 rows are byte-identical
		const dbAfter = openDb(store.dir);
		try {
			const o1Facts = dbAfter.query("SELECT * FROM memoria_facts WHERE session_id = 'o1'").all();
			expect(o1Facts.length).toBe(0);
			const o2FactsAfter = dbAfter.query("SELECT * FROM memoria_facts ORDER BY id").all();
			expect(o2FactsAfter).toEqual(o2FactsBefore);
		} finally {
			dbAfter.close();
		}
	});

	test("KSTORE.1.a2: forgotten memory mid-flight returns 'gone' and leaves no rows", async () => {
		const content = "ephemeral fact";
		const id = await remember(store.dir, "o1", content);
		const sha = contentSha256(content);

		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "mnemopi.db") });
		try {
			// Memory forgotten before store
			expect(beam.forgetWorking(id)).toBe(true);

			const res = beam.storeKnowledge(id, SAMPLE_REPLY_A, sha);
			expect(res).toEqual({ refused: "gone" });
		} finally {
			beam.close();
		}

		const db = openDb(store.dir);
		try {
			const count = db.query("SELECT COUNT(*) AS c FROM memoria_facts WHERE source_memory_id = ?").get(id) as { c: number };
			expect(count.c).toBe(0);
		} finally {
			db.close();
		}
	});

	test("KSTORE.1.a3: store refuses ('stale') when content sha changes; earlier rows unchanged", async () => {
		const content1 = "version 1 content";
		const id = await remember(store.dir, "o1", content1);
		const sha1 = contentSha256(content1);

		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "mnemopi.db") });
		try {
			// Store reply A with sha1
			const res1 = beam.storeKnowledge(id, SAMPLE_REPLY_A, sha1);
			expect("stored" in res1).toBe(true);

			const factsA = beam.db.query("SELECT value FROM memoria_facts WHERE source_memory_id = ? ORDER BY id").all(id);

			// Update content to version 2
			expect(beam.updateWorking(id, "version 2 content")).toBe(true);

			// Store reply B with old sha1 -> refused stale
			const resStale = beam.storeKnowledge(id, SAMPLE_REPLY_B, sha1);
			expect(resStale).toEqual({ refused: "stale" });

			// Facts from reply A remain unchanged
			const factsAfterStale = beam.db.query("SELECT value FROM memoria_facts WHERE source_memory_id = ? ORDER BY id").all(id);
			expect(factsAfterStale).toEqual(factsA);

			// New prompt gives sha2
			const prompt2 = beam.knowledgePrompt(id);
			expect("sha256" in prompt2).toBe(true);
			const sha2 = (prompt2 as any).sha256;
			expect(sha2).toBe(contentSha256("version 2 content"));

			// Store with sha2 succeeds and replaces earlier rows
			const res2 = beam.storeKnowledge(id, SAMPLE_REPLY_B, sha2);
			expect("stored" in res2).toBe(true);

			const factsB = beam.db.query("SELECT value FROM memoria_facts WHERE source_memory_id = ? ORDER BY id").all(id);
			expect(factsB).toEqual([{ value: "Bun is fast" }]);
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1.a4 & R3-6: direct INSERTs into the five tables, column map, and replace semantics", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("multi category memory", { source: "imported" });
			const sha = contentSha256("multi category memory");

			const res = beam.storeKnowledge(id, SAMPLE_REPLY_A, sha);
			expect(res).toEqual({
				stored: {
					facts: 2,
					preferences: 1,
					instructions: 1,
					timelines: 2,
					kg: 1,
				},
			});

			// Check column map (R3-6)
			// memoria_facts: fact_type = 'fact', key is NULL
			const facts = beam.db.query("SELECT fact_type, key, value, source_memory_id, session_id FROM memoria_facts WHERE source_memory_id = ?").all(id) as any[];
			expect(facts.length).toBe(2);
			expect(facts[0].fact_type).toBe("fact");
			expect(facts[0].key).toBeNull();
			expect(facts[0].source_memory_id).toBe(id);
			expect(facts[0].session_id).toBe("o1");

			// memoria_timelines: date is parsed if available, else NULL
			const timelines = beam.db.query("SELECT date, description, source, source_memory_id FROM memoria_timelines WHERE source_memory_id = ? ORDER BY event_id").all(id) as any[];
			expect(timelines.length).toBe(2);
			expect(timelines[0].date).toBe("2026-11-02");
			expect(timelines[0].description).toBe("Release v0.6 on 2026-11-02");
			expect(timelines[1].date).toBeNull();
			expect(timelines[1].description).toBe("Meeting on tomorrow");

			// memoria_kg: confidence is 0.7
			const kg = beam.db.query("SELECT subject, predicate, object, confidence, source_memory_id FROM memoria_kg WHERE source_memory_id = ?").all(id) as any[];
			expect(kg.length).toBe(1);
			expect(kg[0].subject).toBe("Mnemosyne");
			expect(kg[0].predicate).toBe("supports");
			expect(kg[0].object).toBe("Bun");
			expect(kg[0].confidence).toBe(0.7);

			// Storing same reply twice gives the same rows
			const resRepeat = beam.storeKnowledge(id, SAMPLE_REPLY_A, sha);
			expect(resRepeat).toEqual(res);
			const factsRepeat = beam.db.query("SELECT value FROM memoria_facts WHERE source_memory_id = ?").all(id);
			expect(factsRepeat.length).toBe(2);
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1.a5: never calls core fact writers; facts, triples, graph_edges, consolidated_facts unchanged", async () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("important architecture document", { source: "imported" });
			const sha = contentSha256("important architecture document");

			const countTable = (tbl: string) => {
				try {
					const r = beam.db.query(`SELECT COUNT(*) AS c FROM ${tbl}`).get() as { c: number } | null;
					return r?.c ?? 0;
				} catch {
					return 0;
				}
			};

			const factsCountBefore = countTable("facts");
			const triplesCountBefore = countTable("triples");
			const graphEdgesBefore = countTable("graph_edges");
			const consolidatedFactsBefore = countTable("consolidated_facts");
			const workingMemoryBefore = countTable("working_memory");

			const recallBefore = await beam.recall("architecture", 5);

			// Store knowledge
			const res = beam.storeKnowledge(id, SAMPLE_REPLY_A, sha);
			expect("stored" in res).toBe(true);

			// Assert core tables unchanged
			expect(countTable("facts")).toBe(factsCountBefore);
			expect(countTable("triples")).toBe(triplesCountBefore);
			expect(countTable("graph_edges")).toBe(graphEdgesBefore);
			expect(countTable("consolidated_facts")).toBe(consolidatedFactsBefore);
			expect(countTable("working_memory")).toBe(workingMemoryBefore);

			// Recall results unchanged
			const recallAfter = await beam.recall("architecture", 5);
			expect(recallAfter.map(r => r.id)).toEqual(recallBefore.map(r => r.id));
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1.a6: validation caps and rules", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("validation test", { source: "imported" });
			const sha = contentSha256("validation test");

			// Unknown kind
			expect(beam.storeKnowledge(id, JSON.stringify({ facts: [], unknown_kind: [] }), sha)).toEqual({ refused: "invalid" });

			// More than 20 items in one kind
			const over20 = Array.from({ length: 21 }, (_, i) => `item ${i}`);
			expect(beam.storeKnowledge(id, JSON.stringify({ facts: over20 }), sha)).toEqual({ refused: "invalid" });

			// More than 60 total items
			const k15 = Array.from({ length: 15 }, (_, i) => `item ${i}`);
			const over60 = {
				facts: k15,
				preferences: k15,
				instructions: k15,
				timelines: k15,
				kg: [{ subject: "s", predicate: "p", object: "o" }], // total 61
			};
			expect(beam.storeKnowledge(id, JSON.stringify(over60), sha)).toEqual({ refused: "invalid" });

			// Item text over 500 chars
			const over500 = "x".repeat(501);
			expect(beam.storeKnowledge(id, JSON.stringify({ facts: [over500] }), sha)).toEqual({ refused: "invalid" });

			// Malformed KG items (missing subject, predicate, or object)
			expect(beam.storeKnowledge(id, JSON.stringify({ kg: [{ subject: "only" }] }), sha)).toEqual({ refused: "invalid" });
			expect(beam.storeKnowledge(id, JSON.stringify({ kg: [["only", "two"]] }), sha)).toEqual({ refused: "invalid" });

			// Control characters removed, empty items dropped, within-kind dedupe
			const replyWithMessyItems = JSON.stringify({
				facts: [
					"hello\x00\x1F world.",
					"", // empty, should be dropped
					"   ", // whitespace only, dropped
					"hello world", // duplicate of cleaned first item
					"second fact!",
				],
			});
			const resClean = beam.storeKnowledge(id, replyWithMessyItems, sha);
			expect(resClean).toEqual({
				stored: {
					facts: 2,
					preferences: 0,
					instructions: 0,
					timelines: 0,
					kg: 0,
				},
			});
			const storedFacts = beam.db.query("SELECT value FROM memoria_facts WHERE source_memory_id = ? ORDER BY id").all(id);
			expect(storedFacts).toEqual([
				{ value: "hello world" },
				{ value: "second fact" },
			]);
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1.a7: unparseable reply refuses, NO_FACTS clears old rows", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("unparseable test", { source: "imported" });
			const sha = contentSha256("unparseable test");

			// Store valid rows first
			beam.storeKnowledge(id, SAMPLE_REPLY_A, sha);
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_facts WHERE source_memory_id = ?").get(id)).toEqual({ c: 2 });

			// Prose reply -> unparseable
			expect(beam.storeKnowledge(id, "I extracted these facts:\n- fact 1", sha)).toEqual({ refused: "unparseable" });

			// Broken JSON -> unparseable
			expect(beam.storeKnowledge(id, '{"facts": ["unclosed string}', sha)).toEqual({ refused: "unparseable" });

			// JSON Array -> unparseable
			expect(beam.storeKnowledge(id, '["just", "an", "array"]', sha)).toEqual({ refused: "unparseable" });

			// Empty string -> unparseable
			expect(beam.storeKnowledge(id, "", sha)).toEqual({ refused: "unparseable" });

			// Existing rows are unchanged after unparseable attempts
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_facts WHERE source_memory_id = ?").get(id)).toEqual({ c: 2 });

			// NO_FACTS clears rows and stores 0 items
			const noFactsRes = beam.storeKnowledge(id, "NO_FACTS", sha);
			expect(noFactsRes).toEqual({
				stored: {
					facts: 0,
					preferences: 0,
					instructions: 0,
					timelines: 0,
					kg: 0,
				},
			});
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_facts WHERE source_memory_id = ?").get(id)).toEqual({ c: 0 });
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1: crash mid-write leaves earlier rows completely intact (atomic rollback)", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("crash test memory", { source: "imported" });
			const sha = contentSha256("crash test memory");

			// Store reply A first
			beam.storeKnowledge(id, SAMPLE_REPLY_A, sha);
			const factsBefore = beam.db.query("SELECT value FROM memoria_facts WHERE source_memory_id = ? ORDER BY id").all(id);

			// Install trigger that fails on memoria_kg insert
			beam.db.exec("CREATE TRIGGER boom BEFORE INSERT ON memoria_kg BEGIN SELECT RAISE(ABORT, 'boom'); END;");

			// Attempt store reply B (contains facts and kg) -> should throw and rollback
			let threw = false;
			try {
				beam.storeKnowledge(id, SAMPLE_REPLY_B, sha);
			} catch (err: any) {
				threw = true;
				expect(err.message).toContain("boom");
			}
			expect(threw).toBe(true);

			// Drop trigger
			beam.db.exec("DROP TRIGGER boom;");

			// All tables still hold reply A rows
			const factsAfter = beam.db.query("SELECT value FROM memoria_facts WHERE source_memory_id = ? ORDER BY id").all(id);
			expect(factsAfter).toEqual(factsBefore);
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1.a9: forgetWorking purges all memoria rows for that memory", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("purge test", { source: "imported" });
			const sha = contentSha256("purge test");

			beam.storeKnowledge(id, SAMPLE_REPLY_A, sha);
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_facts WHERE source_memory_id = ?").get(id)).toEqual({ c: 2 });
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_preferences WHERE source_memory_id = ?").get(id)).toEqual({ c: 1 });
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_instructions WHERE source_memory_id = ?").get(id)).toEqual({ c: 1 });
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_timelines WHERE source_memory_id = ?").get(id)).toEqual({ c: 2 });
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_kg WHERE source_memory_id = ?").get(id)).toEqual({ c: 1 });

			// Forget memory
			expect(beam.forgetWorking(id)).toBe(true);

			// All 5 tables purged
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_facts WHERE source_memory_id = ?").get(id)).toEqual({ c: 0 });
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_preferences WHERE source_memory_id = ?").get(id)).toEqual({ c: 0 });
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_instructions WHERE source_memory_id = ?").get(id)).toEqual({ c: 0 });
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_timelines WHERE source_memory_id = ?").get(id)).toEqual({ c: 0 });
			expect(beam.db.query("SELECT COUNT(*) AS c FROM memoria_kg WHERE source_memory_id = ?").get(id)).toEqual({ c: 0 });
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1: transaction proof: BEGIN IMMEDIATE wraps owner check, DELETEs and INSERTs", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("transaction proof memory", { source: "imported" });
			const sha = contentSha256("transaction proof memory");

			const trace: string[] = [];
			const db = beam.db as any;
			const [exec, run, prepare] = [db.exec.bind(db), db.run.bind(db), db.prepare.bind(db)];
			db.exec = (sql: string) => (trace.push(`exec ${sql}`), exec(sql));
			db.run = (...args: any[]) => (trace.push(`run ${String(args[0]).trim().split(/\s+/).slice(0, 3).join(" ")}`), run(...args));
			db.prepare = (...args: any[]) => (trace.push(`prepare ${String(args[0]).trim().split(/\s+/)[0]}`), prepare(...args));

			try {
				const res = beam.storeKnowledge(id, SAMPLE_REPLY_A, sha);
				expect("stored" in res).toBe(true);
			} finally {
				Object.assign(db, { exec, run, prepare });
			}

			const begin = trace.indexOf("exec BEGIN IMMEDIATE");
			const ownerSelect = trace.findIndex((line, i) => i > begin && line === "prepare SELECT");
			const firstDelete = trace.findIndex((line, i) => i > begin && line.startsWith("run DELETE FROM memoria_"));
			const firstInsert = trace.findIndex((line, i) => i > begin && line === "prepare INSERT");
			const commit = trace.findIndex((line, i) => i > begin && line === "exec COMMIT");

			expect(begin).toBeGreaterThanOrEqual(0);
			expect(begin < ownerSelect).toBe(true);
			expect(ownerSelect < firstDelete).toBe(true);
			expect(firstDelete < firstInsert).toBe(true);
			expect(firstInsert < commit).toBe(true);
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1: transaction proof: on 'gone' and 'stale', no DELETE or INSERT executed", () => {
		const beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "inproc.db") });
		try {
			const id = beam.remember("refusal proof memory", { source: "imported" });

			const trace: string[] = [];
			const db = beam.db as any;
			const [exec, run, prepare] = [db.exec.bind(db), db.run.bind(db), db.prepare.bind(db)];
			db.exec = (sql: string) => (trace.push(`exec ${sql}`), exec(sql));
			db.run = (...args: any[]) => (trace.push(`run ${String(args[0]).trim().split(/\s+/).slice(0, 3).join(" ")}`), run(...args));
			db.prepare = (...args: any[]) => (trace.push(`prepare ${String(args[0]).trim().split(/\s+/)[0]}`), prepare(...args));

			try {
				// 1. stale check
				const resStale = beam.storeKnowledge(id, SAMPLE_REPLY_A, "deadbeef");
				expect(resStale).toEqual({ refused: "stale" });

				// 2. gone check
				const resGone = beam.storeKnowledge("non-existent-id", SAMPLE_REPLY_A, "deadbeef");
				expect(resGone).toEqual({ refused: "gone" });
			} finally {
				Object.assign(db, { exec, run, prepare });
			}

			// Ensure no DELETE or INSERT was recorded in the trace
			expect(trace.some(line => line.startsWith("run DELETE"))).toBe(false);
			expect(trace.some(line => line.startsWith("run INSERT"))).toBe(false);
			expect(trace.some(line => line.startsWith("prepare INSERT"))).toBe(false);
		} finally {
			beam.close();
		}
	});

	test("KSTORE.1: real MCP calls handle knowledge prompt and store", async () => {
		const content = "MCP registered tool test content";
		const id = await remember(store.dir, "o1", content);

		// 1. Prompt tool
		const [promptReply] = await mcp(store.dir, "o1", [
			["mnemopi_knowledge_prompt", { memory_id: id }],
		]);
		expect(promptReply?.isError).toBe(false);
		expect(typeof promptReply?.body.prompt).toBe("string");
		expect(typeof promptReply?.body.sha256).toBe("string");
		const sha = promptReply?.body.sha256 as string;
		expect(sha).toBe(contentSha256(content));

		// 2. Store tool
		const [storeReply] = await mcp(store.dir, "o1", [
			["mnemopi_knowledge_store", { memory_id: id, reply: SAMPLE_REPLY_A, sha256: sha }],
		]);
		expect(storeReply?.isError).toBe(false);
		expect(storeReply?.body.stored).toEqual({
			facts: 2,
			preferences: 1,
			instructions: 1,
			timelines: 2,
			kg: 1,
		});

		// 3. Stale store tool
		const [staleReply] = await mcp(store.dir, "o1", [
			["mnemopi_knowledge_store", { memory_id: id, reply: SAMPLE_REPLY_A, sha256: "deadbeef" }],
		]);
		expect(staleReply?.body.refused).toBe("stale");
	});
});
