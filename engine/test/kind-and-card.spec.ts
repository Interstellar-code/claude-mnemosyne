// mnemosyne changes 22 and 23 (engine/UPSTREAM.md, issue #56 part 2): a query that names a memory kind finds
// the memories of that kind, and an entity question gets the extracted facts about what it names. The rules are
// general (kind words, subject names, visibility); the store here is made up.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { entityName, kindQuery, kindWordsOf, subjectNames } from "../src/core/beam/recall";
import { mcp, openDb, remember, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const ids = (body: Record<string, unknown>) => (body.results as { id: string }[]).map(r => r.id);

test("kind words: the kinds a query names, and owner words next to them are not searched", () => {
	expect(kindQuery("user preferences")).toEqual({ kinds: ["preference"], text: "preferences" });
	expect(kindQuery("my SAP decisions")).toEqual({ kinds: ["decision"], text: "sap decisions" });
	expect(kindQuery("preferences and instructions")).toEqual({ kinds: ["preference", "instruction"], text: "preferences instructions" });
	// No kind word: the query is searched as it is, owner words included.
	expect(kindQuery("user guide for the cockpit")).toEqual({ kinds: [], text: "user guide for the cockpit" });
	expect(kindWordsOf("preference")).toEqual(["preference", "preferences"]);
});

test("entity names and subjects: a near name counts, a thing named after it does not", () => {
	expect(entityName("who is Mira")).toEqual(["mira"]);
	expect(entityName("tell me about Mira Kovacs?")).toEqual(["mira", "kovacs"]);
	expect(entityName("who is")).toBeNull();
	expect(subjectNames("Mira", ["mira", "kovacs"])).toBe(true);
	expect(subjectNames("Mira Kovacs", ["mira"])).toBe(true);
	expect(subjectNames("Mira's boat", ["mira"])).toBe(false);
	expect(subjectNames("Mira Kovacs Survey Team", ["mira"])).toBe(false);
	expect(subjectNames("Lisbon", ["mira"])).toBe(false);
});

test("a query naming a kind finds that kind's memories, whose text never says the word", async () => {
	const short = await remember(store.dir, "o1", "Answer style: short and direct, no long background.", { memory_type: "preference", importance: 0.8 });
	const links = await remember(store.dir, "o1", "Always include clickable links when listing resources.", { memory_type: "preference", importance: 0.7 });
	const note = await remember(store.dir, "o1", "The user guide for the survey boat is in the shared folder.", { memory_type: "context", importance: 0.5 });
	const [reply] = await mcp(store.dir, "o1", [["mnemopi_recall", { query: "user preferences", limit: 5, update_recall_counts: false }]]);
	const order = ids(reply!.body);
	expect(order.slice(0, 2).sort()).toEqual([short, links].sort());
	// "user" is not searched next to a kind word, so the note that only says "user" is not a match.
	expect(order).not.toContain(note);
}, 120_000);

test("an entity question gets the facts about what it names; other questions and other owners' facts do not", async () => {
	const profile = await remember(store.dir, "o1", "Mira Kovacs is a marine biologist based in Lisbon.", { importance: 0.9, memory_type: "fact" });
	const boat = await remember(store.dir, "o1", "Mira's boat needs a new engine before the survey.", { importance: 0.5 });
	const mine = await remember(store.dir, "o1", "Mira leads the coastal survey team.", { importance: 0.8, memory_type: "fact" });
	// o2's own (non-global) memory: its facts are not o1's to see.
	const other = await remember(store.dir, "o2", "Mira owes o2 a report.", { importance: 0.9, scope: "session" });
	const db = openDb(store.dir);
	try {
		db.exec(`CREATE TABLE IF NOT EXISTS memoria_kg (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, subject TEXT, predicate TEXT, object TEXT, message_idx INTEGER, confidence REAL, source_memory_id TEXT)`);
		const add = db.query("INSERT INTO memoria_kg (session_id, subject, predicate, object, message_idx, confidence, source_memory_id) VALUES (?, ?, ?, ?, 0, 0.7, ?)");
		add.run("o1", "Mira Kovacs", "is", "marine biologist", profile);
		add.run("o1", "Mira", "is based in", "Lisbon", profile);
		add.run("o1", "Mira", "leads", "the coastal survey team", mine);
		add.run("o1", "Mira's boat", "needs", "a new engine", boat);
		add.run("o2", "Mira", "owes a report to", "o2", other);
	} finally {
		db.close();
	}
	const [who, about, topic] = await mcp(store.dir, "o1", [
		["mnemopi_recall", { query: "who is mira", limit: 3, update_recall_counts: false }],
		["mnemopi_recall", { query: "tell me about Mira Kovacs", limit: 3, update_recall_counts: false }],
		["mnemopi_recall", { query: "survey engine", limit: 3, update_recall_counts: false }],
	]);
	for (const reply of [who!, about!]) {
		const card = reply.body.entity as { name: string; facts: { predicate: string; object: string; source: string }[] };
		expect(card.name).toBe("Mira Kovacs");
		const said = card.facts.map(f => `${f.predicate} ${f.object}`);
		// From the most important memory first; the boat is not Mira, and o2's private fact is not o1's.
		expect(said.slice(0, 2).sort()).toEqual(["is based in Lisbon", "is marine biologist"]);
		expect(said).toContain("leads the coastal survey team");
		expect(said.some(s => s.includes("engine") || s.includes("report"))).toBe(false);
		expect(card.facts.find(f => f.object === "Lisbon")?.source).toBe(profile);
	}
	expect(topic!.body.entity).toBeUndefined();
	// use_intent false gives the plain reply, no card.
	const [plain] = await mcp(store.dir, "o1", [["mnemopi_recall", { query: "who is mira", limit: 3, use_intent: false, update_recall_counts: false }]]);
	expect(plain!.body.entity).toBeUndefined();
}, 120_000);
