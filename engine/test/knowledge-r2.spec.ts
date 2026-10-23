// KSTORE round 2: review findings 1-7 on the knowledge store (engine/UPSTREAM.md changes 4 and 5).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { BeamMemory } from "../src/core/beam";
import { contentSha256, validateKnowledgeReply } from "../src/core/beam/knowledge";
import { mcp, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
let beam: BeamMemory;
beforeEach(() => {
	store = tempStore();
	beam = new BeamMemory({ sessionId: "o1", dbPath: join(store.dir, "r2.db") });
});
afterEach(() => {
	beam.close();
	store.dispose();
});

const REPLY_CAP = 256 * 1024;
const MEMORIA_TABLES = ["memoria_facts", "memoria_preferences", "memoria_instructions", "memoria_timelines", "memoria_kg"] as const;
const REPLY = JSON.stringify({
	facts: ["Mnemosyne is a memory engine"],
	preferences: ["Tabs"],
	instructions: ["Run typecheck"],
	timelines: ["Release on 2026-11-02"],
	kg: [{ subject: "Mnemosyne", predicate: "supports", object: "Bun" }],
});

const count = (table: string, where = "1=1", ...args: string[]) =>
	(beam.db.query(`SELECT COUNT(*) AS c FROM ${table} WHERE ${where}`).get(...args) as { c: number }).c;
const allCounts = () => Object.fromEntries(MEMORIA_TABLES.map(t => [t, count(t)]));

describe("KSTORE R2: finding 1, the engine parser normalises the accepted reply", () => {
	test("a fenced reply is stored", () => {
		const id = beam.remember("fenced", { source: "imported" });
		const res = beam.storeKnowledge(id, "```json\n" + REPLY + "\n```", contentSha256("fenced"));
		expect(res).toEqual({ stored: { facts: 1, preferences: 1, instructions: 1, timelines: 1, kg: 1 } });
	});

	test("object items are read through the parser's field keys (value, rule, preference)", () => {
		const reply = JSON.stringify({
			facts: [{ value: "Uses Bun." }],
			instructions: [{ rule: "Never force-push" }],
			preferences: [{ preference: "Dark mode!" }],
		});
		const r = validateKnowledgeReply(reply);
		expect(r.ok && r.data).toMatchObject({ facts: ["Uses Bun"], instructions: ["Never force-push"], preferences: ["Dark mode"] });
	});

	test("a fact object is read with the parser's fact keys only: {description} is not one", () => {
		expect(validateKnowledgeReply('{"facts":[{"description":"x"}]}')).toEqual({ ok: false, refusal: "invalid" });
		expect(validateKnowledgeReply('{"timelines":[{"description":"x"}]}')).toMatchObject({ ok: true });
	});

	test("an object with no readable text field, or a non-object item, is invalid", () => {
		for (const item of [{ unknown: "x" }, { fact: "  " }, 7, [["x"]], null, true]) {
			expect(validateKnowledgeReply(JSON.stringify({ facts: [item] }))).toEqual({ ok: false, refusal: "invalid" });
		}
	});
});

describe("KSTORE R2: finding 2, timeline objects keep their date", () => {
	test("{date, event} stores the date", () => {
		const id = beam.remember("timeline obj", { source: "imported" });
		const reply = '{"timelines":[{"date":"2024-12-01","event":"release"}]}';
		expect(beam.storeKnowledge(id, reply, contentSha256("timeline obj"))).toMatchObject({ stored: { timelines: 1 } });
		const t = beam.db.query("SELECT date, description FROM memoria_timelines WHERE source_memory_id = ?").get(id) as any;
		expect(t.date).toBe("2024-12-01");
		expect(t.description).toContain("release");
	});
});

describe("KSTORE R2: finding 3, control characters become a space", () => {
	test("newline, tab and NUL separate words; zero-width and bidi marks are removed", () => {
		const reply = JSON.stringify({ facts: ["line one\nline two", "a\tb\u0000c", "zero​width‮bidi", "  spaced   out  "] });
		const r = validateKnowledgeReply(reply);
		expect(r.ok && r.data.facts).toEqual(["line one line two", "a b c", "zerowidthbidi", "spaced out"]);
	});
});

describe("KSTORE R2: finding 4, the author pair merges as one unit", () => {
	test("a first save with type only and a re-save with id and type keeps type only, never mixes", () => {
		const id = beam.remember("pair fact", { source: "imported", authorType: "human" });
		beam.remember("pair fact", { source: "imported", authorType: "agent", authorId: "claude" });
		const r = beam.db.query("SELECT author_id, author_type FROM working_memory WHERE id = ?").get(id) as any;
		expect(r).toEqual({ author_id: null, author_type: "human" });
	});

	test("a first save with id only keeps id only", () => {
		const id = beam.remember("pair fact two", { source: "imported", authorId: "rohit" });
		beam.remember("pair fact two", { source: "imported", authorType: "agent", authorId: "claude" });
		const r = beam.db.query("SELECT author_id, author_type FROM working_memory WHERE id = ?").get(id) as any;
		expect(r).toEqual({ author_id: "rohit", author_type: null });
	});
});

describe("KSTORE R2: finding 5, the replace DELETE is scoped to the owner", () => {
	test("a memoria row of another session with the same source_memory_id survives a store", () => {
		const id = beam.remember("scoped delete", { source: "imported" });
		beam.db.run(
			"INSERT INTO memoria_facts (session_id, message_idx, fact_type, key, value, context_snippet, importance, timestamp, source_memory_id) VALUES ('other', 0, 'fact', NULL, 'theirs', 'theirs', 0.7, 't', ?)",
			[id],
		);
		beam.storeKnowledge(id, REPLY, contentSha256("scoped delete"));
		expect(count("memoria_facts", "session_id = 'other' AND source_memory_id = ?", id)).toBe(1);
		expect(count("memoria_facts", "session_id = 'o1' AND source_memory_id = ?", id)).toBe(1);
	});
});

describe("KSTORE R2: finding 6, prompt is a plain read and the reply is capped", () => {
	test("knowledgePrompt takes no write lock", () => {
		const id = beam.remember("read only prompt", { source: "imported" });
		const db = beam.db as any;
		const trace: string[] = [];
		const exec = db.exec.bind(db);
		db.exec = (sql: string) => (trace.push(sql), exec(sql));
		try {
			expect("prompt" in beam.knowledgePrompt(id)).toBe(true);
		} finally {
			db.exec = exec;
		}
		expect(trace.filter(s => /BEGIN/i.test(s))).toEqual([]);
	});

	test("a reply over 256 KB is invalid and writes nothing, even when padding is whitespace", () => {
		const id = beam.remember("big reply", { source: "imported" });
		const sha = contentSha256("big reply");
		expect(beam.storeKnowledge(id, REPLY, sha)).toHaveProperty("stored");
		const before = allCounts();
		const padded = REPLY + " ".repeat(REPLY_CAP);
		expect(beam.storeKnowledge(id, padded, sha)).toEqual({ refused: "invalid" });
		expect(beam.storeKnowledge(id, "NO_FACTS" + " ".repeat(REPLY_CAP), sha)).toEqual({ refused: "invalid" });
		expect(allCounts()).toEqual(before);
	});
});

describe("KSTORE R2: finding 7, extra guards", () => {
	test("(a) non-ASCII content: the tool's sha256 equals bin/memories.ts:46 (sha256 of the utf-8 text)", () => {
		const content = "Zażółć gęślą jaźń — 日本語のメモ 🚀 café";
		const id = beam.remember(content, { source: "imported" });
		const res = beam.knowledgePrompt(id);
		const binMemories = createHash("sha256").update(content, "utf8").digest("hex");
		expect("sha256" in res && res.sha256).toBe(binMemories);
		expect(beam.storeKnowledge(id, REPLY, binMemories)).toHaveProperty("stored");
	});

	test("(c) prototype keys are refused and write nothing", () => {
		const id = beam.remember("proto", { source: "imported" });
		const sha = contentSha256("proto");
		beam.storeKnowledge(id, REPLY, sha);
		const before = allCounts();
		for (const reply of [
			'{"__proto__":{"facts":["x"]}}',
			'{"facts":["ok"],"__proto__":["y"]}',
			'{"facts":[{"__proto__":{"fact":"x"}}]}',
			'{"facts":[{"constructor":"x"}]}',
			'{"kg":[{"__proto__":"a","predicate":"b","object":"c"}]}',
		]) {
			expect(beam.storeKnowledge(id, reply, sha)).toEqual({ refused: "invalid" });
		}
		expect(allCounts()).toEqual(before);
		expect(({} as any).facts).toBeUndefined();
	});

	test("(d) kg triples dedupe across object and array forms", () => {
		const id = beam.remember("kg dedupe", { source: "imported" });
		const reply = JSON.stringify({
			kg: [{ subject: "A", predicate: "b", object: "C" }, ["A", "b", "C"], { subject: " A. ", predicate: "b", object: "C" }, ["A", "b", "D"]],
		});
		expect(beam.storeKnowledge(id, reply, contentSha256("kg dedupe"))).toMatchObject({ stored: { kg: 2 } });
		expect(count("memoria_kg", "source_memory_id = ?", id)).toBe(2);
	});

	test("(e) storing the same reply again leaves every memoria table the same size", () => {
		const id = beam.remember("idempotent", { source: "imported" });
		const sha = contentSha256("idempotent");
		beam.storeKnowledge(id, REPLY, sha);
		const first = allCounts();
		expect(Object.values(first).every(n => n === 1)).toBe(true);
		beam.storeKnowledge(id, REPLY, sha);
		expect(allCounts()).toEqual(first);
	});

	test("(f) recall is unchanged over several queries after a store", async () => {
		const a = beam.remember("architecture document for the memory engine", { source: "imported" });
		beam.remember("grocery list with bread and milk", { source: "imported" });
		beam.remember("release checklist for v0.6", { source: "imported" });
		const queries = ["architecture", "grocery", "release", "memory engine", "nothing matches this"];
		const ids = async () => Promise.all(queries.map(async q => (await beam.recall(q, 5)).map(r => r.id)));
		const before = await ids();
		expect(beam.storeKnowledge(a, REPLY, contentSha256("architecture document for the memory engine"))).toHaveProperty("stored");
		expect(await ids()).toEqual(before);
	});

	test("(b) through the registered MCP tool: fenced reply, then NO_FACTS clears", async () => {
		const [rem] = await mcp(store.dir, "o1", [["mnemopi_remember", { content: "mcp r2", source: "imported", scope: "global", importance: 0.5 }]]);
		const id = rem?.body.memory_id as string;
		const [prompt] = await mcp(store.dir, "o1", [["mnemopi_knowledge_prompt", { memory_id: id }]]);
		const sha = prompt?.body.sha256 as string;
		expect(sha).toBe(contentSha256("mcp r2"));
		const [stored] = await mcp(store.dir, "o1", [["mnemopi_knowledge_store", { memory_id: id, reply: "```json\n" + REPLY + "\n```", sha256: sha }]]);
		expect(stored?.isError).toBe(false);
		expect(JSON.stringify(stored?.body)).toContain('"facts":1');
	});
});
