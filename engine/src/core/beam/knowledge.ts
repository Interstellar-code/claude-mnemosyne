import { createHash } from "node:crypto";
import { toUtcIso } from "../../util/datetime";
import {
	buildExtractionPrompt,
	FACT_TEXT_FIELD_KEYS,
	INSTRUCTION_TEXT_FIELD_KEYS,
	parseExtractedFactCategories,
	PREFERENCE_TEXT_FIELD_KEYS,
	stripFence,
	TIMELINE_TEXT_FIELD_KEYS,
} from "../extraction";
import { clipToWindow, DEFAULT_INPUT_CHARS } from "../text-window";
import { immediateTransaction } from "./store";
import type { BeamMemoryState } from "./types";

export const KNOWLEDGE_KINDS = ["facts", "preferences", "instructions", "timelines", "kg"] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export const KNOWLEDGE_LIMITS = {
	perKind: 20,
	total: 60,
	chars: 500,
	/** Largest reply, in utf-8 bytes, that is parsed at all. */
	replyBytes: 256 * 1024,
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
		.replace(/[\u200B-\u200F\u202A-\u202E]/g, "")
		.replace(/[\x00-\x1F\x7F]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[.!?]+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

const FIELD_KEYS: Record<"facts" | "preferences" | "instructions" | "timelines", readonly string[]> = {
	facts: FACT_TEXT_FIELD_KEYS,
	preferences: PREFERENCE_TEXT_FIELD_KEYS,
	instructions: INSTRUCTION_TEXT_FIELD_KEYS,
	timelines: TIMELINE_TEXT_FIELD_KEYS,
};

/** True for a string item, or an object carrying at least one non-empty text field the parser reads for this kind. */
function isAcceptableItem(item: unknown, keys: readonly string[]): boolean {
	if (typeof item === "string") return true;
	if (!isRecord(item)) return false;
	return keys.some(key => {
		const val = Object.hasOwn(item, key) ? item[key] : undefined;
		return typeof val === "string" && val.trim().length > 0;
	});
}

/**
 * Validates extraction reply before acquiring any write lock.
 * Strict pre-checks first (size, JSON object, known kinds, counts, item shapes),
 * then the accepted reply is normalised by the engine's own parser.
 * Fails ('unparseable' | 'invalid') without touching the store.
 */
export function validateKnowledgeReply(
	reply: string,
): { ok: true; data: CleanedKnowledge } | { ok: false; refusal: "unparseable" | "invalid" } {
	if (typeof reply !== "string") {
		return { ok: false, refusal: "unparseable" };
	}
	if (Buffer.byteLength(reply, "utf8") > KNOWLEDGE_LIMITS.replyBytes) {
		return { ok: false, refusal: "invalid" };
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

	// Only known kinds are allowed (an own "__proto__" key from JSON.parse is refused here too).
	for (const key of Object.keys(parsed)) {
		if (!KNOWLEDGE_KINDS.includes(key as KnowledgeKind)) {
			return { ok: false, refusal: "invalid" };
		}
	}

	// Kinds must be arrays, <= 20 per kind, <= 60 total.
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

	// Item shapes: a string, or an object with a text field the parser reads for that kind.
	for (const kind of ["facts", "preferences", "instructions", "timelines"] as const) {
		const rawItems = parsed[kind];
		if (!Array.isArray(rawItems)) continue;
		for (const raw of rawItems) {
			if (!isAcceptableItem(raw, FIELD_KEYS[kind])) {
				return { ok: false, refusal: "invalid" };
			}
		}
	}
	if (Array.isArray(parsed.kg)) {
		for (const item of parsed.kg) {
			const parts = isRecord(item) ? [item.subject, item.predicate, item.object] : Array.isArray(item) && item.length >= 3 ? item.slice(0, 3) : null;
			if (parts === null) {
				return { ok: false, refusal: "invalid" };
			}
			if (parts.some(part => typeof part !== "string" || cleanText(part).length === 0)) {
				return { ok: false, refusal: "invalid" };
			}
		}
	}

	const extracted = parseExtractedFactCategories(cleaned, { categoryLimit: KNOWLEDGE_LIMITS.perKind });

	const result: CleanedKnowledge = {
		facts: [],
		preferences: [],
		instructions: [],
		timelines: [],
		kg: [],
	};

	for (const kind of ["facts", "preferences", "instructions", "timelines"] as const) {
		for (const item of extracted[kind]) {
			const cleanedStr = cleanText(item);
			if (cleanedStr.length > KNOWLEDGE_LIMITS.chars) {
				return { ok: false, refusal: "invalid" };
			}
			if (cleanedStr.length === 0) continue;
			if (!result[kind].includes(cleanedStr)) {
				result[kind].push(cleanedStr);
			}
		}
	}

	for (const triple of extracted.kg) {
		const subject = cleanText(triple.subject);
		const predicate = cleanText(triple.predicate);
		const object = cleanText(triple.object);
		if (subject.length === 0 || predicate.length === 0 || object.length === 0) {
			return { ok: false, refusal: "invalid" };
		}
		if (
			subject.length > KNOWLEDGE_LIMITS.chars ||
			predicate.length > KNOWLEDGE_LIMITS.chars ||
			object.length > KNOWLEDGE_LIMITS.chars
		) {
			return { ok: false, refusal: "invalid" };
		}
		if (!result.kg.some(t => t.subject === subject && t.predicate === predicate && t.object === object)) {
			result.kg.push({ subject, predicate, object });
		}
	}

	return { ok: true, data: result };
}

/**
 * Read-only: builds extraction prompt and returns content sha256 for one owned memory.
 * Returns { refused: "gone" } if the memory does not exist or belongs to another owner.
 */
export function knowledgePrompt(beam: BeamMemoryState, memoryId: string): KnowledgePromptResult {
	using stmt = beam.db.prepare("SELECT content FROM working_memory WHERE id = ? AND session_id = ?");
	const row = stmt.get(memoryId, beam.sessionId) as { content: string } | null;
	if (!row) {
		return { refused: "gone" };
	}
	const sha = contentSha256(row.content);
	const clipped = clipToWindow(row.content, DEFAULT_INPUT_CHARS);
	const prompt = buildExtractionPrompt(clipped);
	return { prompt, sha256: sha };
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
			beam.db.run(`DELETE FROM ${table} WHERE source_memory_id = ? AND session_id = ?`, [memoryId, beam.sessionId]);
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
