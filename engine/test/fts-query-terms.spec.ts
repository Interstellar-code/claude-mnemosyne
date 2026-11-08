// Issue #26: the FTS query keeps every distinct query word; synonyms only fill
// the room left under the 12-term cap. Real temporary store, real engine process.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mcp, remember, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const ids = (body: Record<string, unknown>) => ((body.results ?? []) as { id: string }[]).map(r => r.id);

test("a later query word is still matched when earlier words have many synonyms", async () => {
	// "error" and "fix" expand to 8 + 7 terms, which used to push "heron" past the 12-term cap.
	// The "error" memory gives the FTS query a hit, so the recall does not fall back to scanning every row.
	await remember(store.dir, "o1", "an error showed up in the nightly build");
	const id = await remember(store.dir, "o1", "the heron nests by the quiet lake");
	const [reply] = await mcp(store.dir, "o1", [["mnemopi_recall", { query: "error fix heron" }]]);
	expect(ids(reply!.body)).toContain(id);
});
