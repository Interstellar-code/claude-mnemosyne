// C1 (EMB review round 2): the API embedding route must be refused in this build
// unless a caller explicitly opts in with MNEMOPI_EMBEDDINGS_API_OPT_IN. The
// plugin never sets that flag, so an empty MNEMOPI_EMBEDDING_API_URL can no
// longer fall back to an inherited OPENROUTER_BASE_URL (or OPENROUTER_API_KEY /
// OPENAI_API_KEY) and send memory text to a remote API.
import { afterEach, describe, expect, test } from "bun:test";
import { isApiModel } from "../src/core/embeddings";

const HOSTILE = {
	OPENROUTER_BASE_URL: "http://127.0.0.1:4000/v1",
	OPENROUTER_API_KEY: "sk-openrouter",
	OPENAI_API_KEY: "sk-openai",
};

function setHostile() {
	process.env.OPENROUTER_BASE_URL = HOSTILE.OPENROUTER_BASE_URL;
	process.env.OPENROUTER_API_KEY = HOSTILE.OPENROUTER_API_KEY;
	process.env.OPENAI_API_KEY = HOSTILE.OPENAI_API_KEY;
}

function clearHostile() {
	delete process.env.OPENROUTER_BASE_URL;
	delete process.env.OPENROUTER_API_KEY;
	delete process.env.OPENAI_API_KEY;
	delete process.env.MNEMOPI_EMBEDDING_API_URL;
	delete process.env.MNEMOPI_EMBEDDINGS_VIA_API;
	delete process.env.MNEMOPI_EMBEDDINGS_API_OPT_IN;
}

afterEach(clearHostile);

describe("the API embedding route is refused without an opt-in (C1)", () => {
	test("a hostile OPENROUTER_BASE_URL does not make the local model an API model", () => {
		setHostile();
		// Even an explicit API-shaped model name is refused: the opt-in is required.
		expect(isApiModel("BAAI/bge-small-en-v1.5")).toBe(false);
		expect(isApiModel("openai/text-embedding-3-small")).toBe(false);
	});

	test("the opt-in flag re-enables API routing, as the engine's own escape hatch", () => {
		setHostile();
		process.env.MNEMOPI_EMBEDDINGS_API_OPT_IN = "1";
		expect(isApiModel("openai/text-embedding-3-small")).toBe(true);
		// A non-openrouter base URL is an API model under the opt-in, exactly as before.
		expect(isApiModel("BAAI/bge-small-en-v1.5")).toBe(true);
	});
});
