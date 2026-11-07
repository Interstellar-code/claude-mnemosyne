// mnemosyne change 20 (engine/UPSTREAM.md, issue #56): an entity question ("who is X", "tell me about X")
// finds the memories about X, not the newest ones that mention X. The rules are general (how a question
// is phrased, where a memory names its subject, how much recency counts); the store here is made up.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { recencyFactor, namesSubject, searchTextOf } from "../src/core/beam/recall";
import { classifyIntent } from "../src/core/query-intent";
import { RECALL_SCHEMA } from "../src/mcp-tools";
import { mcp, openDb, remember, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const ids = (body: Record<string, unknown>) => (body.results as { id: string }[]).map(r => r.id);

test("intent: a question that names something is an entity question; other intents are unchanged", () => {
	expect(classifyIntent("who is mira").category).toBe("entity");
	expect(classifyIntent("Who is Mira Kovacs?").category).toBe("entity");
	expect(classifyIntent("tell me about the lisbon office").category).toBe("entity");
	expect(classifyIntent("what is a heron").category).toBe("factual");
	expect(classifyIntent("how to deploy the build").category).toBe("procedural");
	expect(classifyIntent("what did we decide last week").category).toBe("temporal");
	expect(classifyIntent("sonar report").category).toBe("general");
});

test("the question's opening phrase is not searched; the same words inside a question still are", () => {
	expect(searchTextOf("tell me about mira")).toBe("mira");
	expect(searchTextOf("Can you tell me more about the Lisbon office?")).toBe("the Lisbon office");
	expect(searchTextOf("what do you know about mira kovacs")).toBe("mira kovacs");
	expect(searchTextOf("do you remember anything about the sonar report")).toBe("the sonar report");
	expect(searchTextOf("remind me of the deploy steps")).toBe("the deploy steps");
	expect(searchTextOf("known issues with the build")).toBe("known issues with the build");
	expect(searchTextOf("remember to tell mira")).toBe("remember to tell mira");
	// Nothing left after the phrase: the query is searched as it is.
	expect(searchTextOf("tell me about")).toBe("tell me about");
});

test("recency: a near tie-break for entity and factual questions, full weight otherwise or when time is asked", () => {
	expect(recencyFactor(1, "entity", false)).toBeCloseTo(1);
	expect(recencyFactor(0, "entity", false)).toBeCloseTo(0.9);
	expect(recencyFactor(0, "factual", false)).toBeCloseTo(0.9);
	expect(recencyFactor(0, "general", false)).toBeCloseTo(0.7);
	expect(recencyFactor(0, undefined, false)).toBeCloseTo(0.7);
	expect(recencyFactor(0, "entity", true)).toBeCloseTo(0.7);
});

test("a memory names its subject when its opening words hold every query word", () => {
	expect(namesSubject([["mira"]], "Mira Kovacs is a marine biologist")).toBe(true);
	expect(namesSubject([["mira"]], "Mira: prefers email over calls")).toBe(true);
	expect(namesSubject([["mira"], ["kovacs"]], "Mira Kovacs is a marine biologist")).toBe(true);
	expect(namesSubject([["mira"]], "Backup copied to /home/mira/projects/mira/exports")).toBe(false);
	expect(namesSubject([["mira"], ["kovacs"]], "Mira prefers email")).toBe(false);
	expect(namesSubject([], "Mira")).toBe(false);
});

test("RECALL_SCHEMA has use_intent, a boolean defaulting to true", () => {
	expect(RECALL_SCHEMA.properties.use_intent).toMatchObject({ type: "boolean", default: true });
});

test("who is / tell me about X ranks the memories about X above newer ones that mention X", async () => {
	const profile = await remember(store.dir, "o1", "Mira Kovacs is a marine biologist based in Lisbon, leading the coastal survey.", { importance: 0.9, memory_type: "fact" });
	const habits = await remember(store.dir, "o1", "Mira: prefers email over calls and answers in the morning.", { importance: 0.8, memory_type: "preference" });
	const mention = await remember(store.dir, "o1", "Remember to tell the team the sonar report is due; Mira will review it with me.");
	const path = await remember(store.dir, "o1", "Backup copied to /home/mira/projects/mira/exports/mira-survey for the night run.");
	const told = await remember(store.dir, "o1", "Tell the client the invoice is late and ask about the new contract.");
	// The profile is a month old; the rest was saved today.
	const db = openDb(store.dir);
	try {
		const old = new Date(Date.now() - 30 * 86_400_000).toISOString();
		db.query("UPDATE working_memory SET timestamp = ? WHERE id IN (?, ?)").run(old, profile, habits);
	} finally {
		db.close();
	}
	const asks = ["who is mira", "tell me about mira", "what do you know about Mira?"];
	const replies = await mcp(
		store.dir,
		"o1",
		asks.map(query => ["mnemopi_recall", { query, limit: 5, update_recall_counts: false }] as const),
	);
	for (const reply of replies) {
		const order = ids(reply!.body);
		expect(order.slice(0, 2).sort()).toEqual([profile, habits].sort());
		// The opening phrase no longer matches memories that only say "tell".
		expect(order).not.toContain(told);
		expect(order).toContain(mention);
		expect(order.indexOf(path)).toBeGreaterThan(1);
	}
	// A plain topic search is not an entity question: the newest matching note keeps its place.
	const [topic] = await mcp(store.dir, "o1", [["mnemopi_recall", { query: "sonar report", limit: 3, update_recall_counts: false }]]);
	expect(ids(topic!.body)[0]).toBe(mention);
}, 120_000);
