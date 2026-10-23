import { createHash } from "node:crypto";
import { toUtcIso } from "../../util/datetime";
import { buildExtractionPrompt, stripFence } from "../extraction";
import { clipToWindow, DEFAULT_INPUT_CHARS } from "../text-window";
import { immediateTransaction } from "./store";
import type { BeamMemoryState } from "./types";

export const KNOWLEDGE_KINDS = ["facts", "preferences", "instructions", "timelines", "kg"] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export const KNOWLEDGE_LIMITS = {
	perKind: 20,
	total: 60,
	chars: 500,
} as const;

export type KnowledgeCounts = {
	facts: number;
	preferences: number;
	instructions: number;
	timelines: number;
	kg: number;
};

export type KnowledgeRefusal = "gone" | "stale" | "unparseable" | "invalid";

export type KnowledgePromptResult = { prompt: string; sha256: string } | { refused: "gone" };
export type KnowledgeStoreResult = { stored: KnowledgeCounts } | { refused: KnowledgeRefusal };

export interface CleanedKgTriple {
	subject: string;
	predicate: string;
	object: string;
}

export interface CleanedKnowledge {
	facts: string[];
	preferences: string[];
	instructions: string[];
	timelines: string[];
	kg: CleanedKgTriple[];
}

/** SHA-256 over the stored utf-8 content bytes, matching bin/memories.ts:46. */
export function contentSha256(content: string): string {
	return createHash("sha256").update(content, "utf8").digest("hex");
}

function cleanText(text: string): string {
	return text
		.replace(/[\x00-\x1F\x7F]/g, "")
		.trim()
		.replace(/[.!?]+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

const FACT_FIELD_KEYS = ["fact", "text", "content", "value", "statement", "instruction", "rule", "preference", "description", "event", "timeline", "date"] as const;

function extractStringItem(item: unknown): string | null {
	if (typeof item === "string") return item;
	if (isRecord(item)) {
		for (const key of FACT_FIELD_KEYS) {
			const val = item[key];
			if (typeof val === "string" && val.trim().length > 0) {
				return val;
			}
		}
	}
	return null;
}

/**
 * Validates extraction reply before acquiring any write lock.
 * Fails ('unparseable' | 'invalid') without touching the store.
 */
export function validateKnowledgeReply(
	reply: string,
): { ok: true; data: CleanedKnowledge } | { ok: false; refusal: "unparseable" | "invalid" } {
	if (typeof reply !== "string") {
		return { ok: false, refusal: "unparseable" };
	}
	const trimmed = reply.trim();
	if (trimmed.toUpperCase() === "NO_FACTS") {
		return {
			ok: true,
			data: { facts: [], preferences: [], instructions: [], timelines: [], kg: [] },
		};
	}

	const cleaned = stripFence(trimmed);
	if (!cleaned.startsWith("{")) {
		return { ok: false, refusal: "unparseable" };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(cleaned);
	} catch {
		return { ok: false, refusal: "unparseable" };
	}

	if (!isRecord(parsed)) {
		return { ok: false, refusal: "unparseable" };
	}

	// Validate top-level keys: only known kinds allowed
	for (const key of Object.keys(parsed)) {
		if (!KNOWLEDGE_KINDS.includes(key as KnowledgeKind)) {
			return { ok: false, refusal: "invalid" };
		}
	}

	// Validate kinds: must be arrays, <= 20 per kind, <= 60 total
	let totalItems = 0;
	for (const kind of KNOWLEDGE_KINDS) {
		const items = parsed[kind];
		if (items !== undefined && items !== null) {
			if (!Array.isArray(items)) {
				return { ok: false, refusal: "invalid" };
			}
			if (items.length > KNOWLEDGE_LIMITS.perKind) {
				return { ok: false, refusal: "invalid" };
			}
			totalItems += items.length;
		}
	}
	if (totalItems > KNOWLEDGE_LIMITS.total) {
		return { ok: false, refusal: "invalid" };
	}

	const result: CleanedKnowledge = {
		facts: [],
		preferences: [],
		instructions: [],
		timelines: [],
		kg: [],
	};

	// Clean and validate string categories
	for (const kind of ["facts", "preferences", "instructions", "timelines"] as const) {
		const rawItems = parsed[kind];
		if (!Array.isArray(rawItems)) continue;

		for (const raw of rawItems) {
			const str = extractStringItem(raw);
			if (str === null) {
				return { ok: false, refusal: "invalid" };
			}
			const cleanedStr = cleanText(str);
			if (cleanedStr.length > KNOWLEDGE_LIMITS.chars) {
				return { ok: false, refusal: "invalid" };
			}
			if (cleanedStr.length === 0) {
				// Empty item: dropped
				continue;
			}
			// Within-kind dedupe
			if (!result[kind].includes(cleanedStr)) {
				result[kind].push(cleanedStr);
			}
		}
	}

	// Clean and validate KG items
	const rawKg = parsed.kg;
	if (Array.isArray(rawKg)) {
		for (const item of rawKg) {
			let subject = "";
			let predicate = "";
			let object = "";

			if (isRecord(item)) {
				if (typeof item.subject === "string") subject = item.subject;
				if (typeof item.predicate === "string") predicate = item.predicate;
				if (typeof item.object === "string") object = item.object;
			} else if (Array.isArray(item) && item.length >= 3) {
				if (typeof item[0] === "string") subject = item[0];
				if (typeof item[1] === "string") predicate = item[1];
				if (typeof item[2] === "string") object = item[2];
			} else {
				return { ok: false, refusal: "invalid" };
			}

			const cleanSubj = cleanText(subject);
			const cleanPred = cleanText(predicate);
			const cleanObj = cleanText(object);

			if (cleanSubj.length === 0 || cleanPred.length === 0 || cleanObj.length === 0) {
				return { ok: false, refusal: "invalid" };
			}
			if (
				cleanSubj.length > KNOWLEDGE_LIMITS.chars ||
				cleanPred.length > KNOWLEDGE_LIMITS.chars ||
				cleanObj.length > KNOWLEDGE_LIMITS.chars
			) {
				return { ok: false, refusal: "invalid" };
			}

			// Within-kind dedupe
			const exists = result.kg.some(
				t => t.subject === cleanSubj && t.predicate === cleanPred && t.object === cleanObj,
			);
			if (!exists) {
				result.kg.push({ subject: cleanSubj, predicate: cleanPred, object: cleanObj });
			}
		}
	}

	return { ok: true, data: result };
}

/**
 * Read-only: builds extraction prompt and returns content sha256 for one owned memory.
 * Returns { refused: "gone" } if the memory does not exist or belongs to another owner.
 */
export function knowledgePrompt(beam: BeamMemoryState, memoryId: string): KnowledgePromptResult {
	return immediateTransaction(beam.db, () => {
		using stmt = beam.db.prepare("SELECT content FROM working_memory WHERE id = ? AND session_id = ?");
		const row = stmt.get(memoryId, beam.sessionId) as { content: string } | null;
		if (!row) {
			return { refused: "gone" };
		}
		const sha = contentSha256(row.content);
		const clipped = clipToWindow(row.content, DEFAULT_INPUT_CHARS);
		const prompt = buildExtractionPrompt(clipped);
		return { prompt, sha256: sha };
	});
}

function parseTimelineDate(description: string): string | null {
	return /\b\d{4}-\d{2}-\d{2}\b/.exec(description)?.[0] ?? null;
}

/**
 * Stores extracted knowledge for one owned memory.
 * Atomically checks owner, checks sha256 staleness, deletes previous rows for memory,
 * and direct-inserts into the five memoria tables only.
 */
export function storeKnowledge(
	beam: BeamMemoryState,
	memoryId: string,
	reply: string,
	sha256: string,
): KnowledgeStoreResult {
	const validation = validateKnowledgeReply(reply);
	if (!validation.ok) {
		return { refused: validation.refusal };
	}
	const items = validation.data;

	return immediateTransaction(beam.db, () => {
		using checkStmt = beam.db.prepare("SELECT content FROM working_memory WHERE id = ? AND session_id = ?");
		const row = checkStmt.get(memoryId, beam.sessionId) as { content: string } | null;
		if (!row) {
			return { refused: "gone" };
		}

		if (contentSha256(row.content) !== sha256) {
			return { refused: "stale" };
		}

		// Delete existing rows for this memory in the five memoria tables
		for (const table of [
			"memoria_facts",
			"memoria_preferences",
			"memoria_instructions",
			"memoria_timelines",
			"memoria_kg",
		] as const) {
			beam.db.run(`DELETE FROM ${table} WHERE source_memory_id = ?`, [memoryId]);
		}

		const timestamp = toUtcIso();

		if (items.facts.length > 0) {
			using insertFact = beam.db.prepare(`
				INSERT INTO memoria_facts
				(session_id, message_idx, fact_type, key, value, context_snippet, importance, timestamp, source_memory_id)
				VALUES (?, 0, 'fact', NULL, ?, ?, 0.7, ?, ?)
			`);
			for (const fact of items.facts) {
				insertFact.run(beam.sessionId, fact, fact, timestamp, memoryId);
			}
		}

		if (items.preferences.length > 0) {
			using insertPref = beam.db.prepare(`
				INSERT INTO memoria_preferences
				(session_id, message_idx, preference, topic, evolution, context_snippet, source_memory_id)
				VALUES (?, 0, ?, NULL, NULL, ?, ?)
			`);
			for (const pref of items.preferences) {
				insertPref.run(beam.sessionId, pref, pref, memoryId);
			}
		}

		if (items.instructions.length > 0) {
			using insertInst = beam.db.prepare(`
				INSERT INTO memoria_instructions
				(session_id, message_idx, instruction, active, topic, context_snippet, source_memory_id)
				VALUES (?, 0, ?, 1, NULL, ?, ?)
			`);
			for (const inst of items.instructions) {
				insertInst.run(beam.sessionId, inst, inst, memoryId);
			}
		}

		if (items.timelines.length > 0) {
			using insertTimeline = beam.db.prepare(`
				INSERT INTO memoria_timelines
				(session_id, date, message_idx, description, source, source_memory_id)
				VALUES (?, ?, 0, ?, 'extraction', ?)
			`);
			for (const timeline of items.timelines) {
				const date = parseTimelineDate(timeline);
				insertTimeline.run(beam.sessionId, date, timeline, memoryId);
			}
		}

		if (items.kg.length > 0) {
			using insertKg = beam.db.prepare(`
				INSERT INTO memoria_kg
				(session_id, subject, predicate, object, message_idx, confidence, source_memory_id)
				VALUES (?, ?, ?, ?, 0, 0.7, ?)
			`);
			for (const triple of items.kg) {
				insertKg.run(beam.sessionId, triple.subject, triple.predicate, triple.object, memoryId);
			}
		}

		beam.caches.queryCache?.invalidate();

		return {
			stored: {
				facts: items.facts.length,
				preferences: items.preferences.length,
				instructions: items.instructions.length,
				timelines: items.timelines.length,
				kg: items.kg.length,
			},
		};
	});
}
