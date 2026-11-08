// Issue #25: the optional article in the is / has / uses fact patterns matches only as a whole word
// followed by whitespace, so it no longer clips the start of the next word ("amazing" -> "mazing").
import { expect, test } from "bun:test";
import { EpisodicGraph } from "../src/core/episodic-graph";

const cases: [string, string, string][] = [
	["Paris is amazing", "is", "amazing"],
	["Tom has another car", "has", "another"],
	["Bob uses Atom", "uses", "Atom"],
	["Paris is a city", "is", "city"],
	["Tom has the keys", "has", "keys"],
];

test.each(cases)("extractFacts(%p): the %s object starts with %p", (content, predicate, object) => {
	const graph = new EpisodicGraph();
	const fact = graph.extractFacts(content, "m1").find(f => f.predicate === predicate);
	graph.db.close();
	expect(fact?.object.slice(0, object.length)).toBe(object);
});
