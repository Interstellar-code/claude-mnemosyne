// MODEL.1: the 24 h trim never deletes a row whose scope is not 'session'
// engine/UPSTREAM.md change 12: trimWorkingMemory spares channel and global rows.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mcp, openDb, row, tempStore } from "./helpers";

process.env.MNEMOPI_NO_EMBEDDINGS = "1";

let store: ReturnType<typeof tempStore>;
beforeEach(() => {
	store = tempStore();
});
afterEach(() => store.dispose());

const HOURS_48 = () => new Date(Date.now() - 48 * 3_600_000).toISOString().replace(/\.\d+Z$/, "Z");

/** Saves one memory as owner `o1` and returns its id. */
async function save(content: string, extra: Record<string, unknown>): Promise<string> {
	const [reply] = await mcp(store.dir, "o1", [["mnemopi_remember", { content, ...extra }]]);
	const id = reply?.body.memory_id;
	if (typeof id !== "string") throw new Error(`remember failed: ${reply?.text}`);
	return id;
}

/** Makes the row `age` old with the given tier, as the stored state the trim sees. */
function age(id: string, tier: string): void {
	const db = openDb(store.dir);
	try {
		db.run("UPDATE working_memory SET timestamp = ?, trust_tier = ?, consolidated_at = NULL WHERE id = ?", [
			HOURS_48(),
			tier,
			id,
		]);
	} finally {
		db.close();
	}
}

describe("MODEL.1: trim spares non-session scopes", () => {
	test("MODEL.1.a1: STATED channel and global rows 48 h old survive a remember that triggers the trim", async () => {
		const channel = await save("channel row", { source: "mcp", scope: "channel" });
		const global = await save("global row", { source: "mcp", scope: "global" });
		age(channel, "STATED");
		age(global, "STATED");
		expect(row(store.dir, channel)?.scope).toBe("channel");
		expect(row(store.dir, global)?.scope).toBe("global");

		await save("trigger one", { source: "mcp" });

		expect(row(store.dir, channel)).not.toBeNull();
		expect(row(store.dir, global)).not.toBeNull();
	});

	test("MODEL.1.a2: a STATED session row older than 24 h is still trimmed; IMPORTED rows are still spared", async () => {
		const session = await save("session row", { source: "mcp", scope: "session" });
		const importedSession = await save("imported session row", { source: "imported", scope: "session" });
		const channel = await save("channel row", { source: "mcp", scope: "channel" });
		age(session, "STATED");
		age(importedSession, "IMPORTED");
		age(channel, "STATED");

		await save("trigger two", { source: "mcp" });

		expect(row(store.dir, session)).toBeNull();
		expect(row(store.dir, importedSession)).not.toBeNull();
		expect(row(store.dir, channel)).not.toBeNull();
	});

	test("MODEL.1.a3: a NULL scope is not 'session', so the row is spared", async () => {
		const id = await save("null scope row", { source: "mcp" });
		age(id, "STATED");
		const db = openDb(store.dir);
		try {
			db.run("UPDATE working_memory SET scope = NULL WHERE id = ?", [id]);
		} finally {
			db.close();
		}
		expect(row(store.dir, id)?.scope).toBeNull();

		await save("trigger three", { source: "mcp" });

		expect(row(store.dir, id)).not.toBeNull();
	});
});

// MODEL.7 (review note NB3): the full tier x scope matrix and the 1000-per-owner cap branch.
const TIERS = ["STATED", "DERIVED", "EXTERNAL_WRITE", "IMPORTED"] as const;
const SCOPES = ["session", "channel", "global", null] as const;

describe("MODEL.7: the trim over every tier and scope, and the per-owner cap", () => {
	test("MODEL.7.a6: 48 h-old rows of every tier x scope: only a non-IMPORTED session row is trimmed", async () => {
		const cells: { id: string; tier: string; scope: string | null }[] = [];
		for (const tier of TIERS) {
			for (const scope of SCOPES) {
				const id = await save(`matrix row ${tier} ${scope ?? "null"}`, { source: "mcp", scope: scope ?? "global" });
				age(id, tier);
				if (scope === null) {
					const db = openDb(store.dir);
					try {
						db.run("UPDATE working_memory SET scope = NULL WHERE id = ?", [id]);
					} finally {
						db.close();
					}
				}
				cells.push({ id, tier, scope });
			}
		}
		expect(cells.length).toBe(16);

		await save("matrix trigger", { source: "mcp" });

		const wrong = cells.filter(({ id, tier, scope }) => {
			const trimmed = row(store.dir, id) === null;
			return trimmed !== (scope === "session" && tier !== "IMPORTED");
		});
		expect(wrong.map(({ tier, scope }) => `${tier}/${scope}`)).toEqual([]);
	});

	test("MODEL.7.a7: over the 1000-row cap only session-scope rows that are not IMPORTED are trimmed, oldest first", async () => {
		await save("cap seed row", { source: "mcp", scope: "global" }); // makes the database and its schema
		const now = Date.now();
		const stamp = (secondsAgo: number) => new Date(now - secondsAgo * 1000).toISOString();
		const db = openDb(store.dir);
		const insert = db.prepare(
			`INSERT INTO working_memory (id, content, source, timestamp, session_id, importance, scope, trust_tier, memory_type, veracity)
			 VALUES (?, ?, 'mcp', ?, 'o1', 0.5, ?, ?, 'unknown', 'unknown')`,
		);
		try {
			db.transaction(() => {
				// 4 EXTERNAL_WRITE session rows, the oldest of all, then 1005 STATED session rows, all under 24 h old
				for (let i = 0; i < 4; i++) insert.run(`cap-ext-${i}`, `cap external ${i}`, stamp(5000 - i), "session", "EXTERNAL_WRITE");
				for (let i = 0; i < 1005; i++) insert.run(`cap-ses-${i}`, `cap session ${i}`, stamp(3000 - i), "session", "STATED");
				// rows the cap must not count: IMPORTED session rows (older than the rest), channel, global and a NULL scope
				for (let i = 0; i < 5; i++) insert.run(`cap-imp-${i}`, `cap imported ${i}`, stamp(8000 - i), "session", "IMPORTED");
				for (let i = 0; i < 1005; i++) insert.run(`cap-chn-${i}`, `cap channel ${i}`, stamp(2500 - i), "channel", "STATED");
				for (let i = 0; i < 3; i++) insert.run(`cap-glb-${i}`, `cap global ${i}`, stamp(9000 - i), "global", "DERIVED");
				insert.run("cap-null", "cap null scope", stamp(9500), null, "STATED");
			})();
		} finally {
			db.close();
		}

		await save("cap trigger row", { source: "mcp" });

		const check = openDb(store.dir);
		try {
			const count = (where: string) => (check.query(`SELECT COUNT(*) AS n FROM working_memory WHERE ${where}`).get() as { n: number }).n;
			expect(count("id LIKE 'cap-imp-%'")).toBe(5);
			expect(count("id LIKE 'cap-chn-%'")).toBe(1005);
			expect(count("id LIKE 'cap-glb-%'")).toBe(3);
			expect(count("id = 'cap-null'")).toBe(1);
			expect(count("content = 'cap seed row'")).toBe(1);
			expect(count("session_id = 'o1' AND scope = 'session' AND trust_tier IS NOT 'IMPORTED' AND consolidated_at IS NULL")).toBe(1000);
			// the oldest eligible rows went: the 4 EXTERNAL_WRITE rows first, then the oldest STATED ones
			expect(count("id LIKE 'cap-ext-%'")).toBe(0);
			expect(count("id = 'cap-ses-0'")).toBe(0);
			expect(count("id = 'cap-ses-1004'")).toBe(1);
			expect(count("content = 'cap trigger row'")).toBe(1);
		} finally {
			check.close();
		}
	});
});
