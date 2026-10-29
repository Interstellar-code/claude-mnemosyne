import { describe, expect, test } from "bun:test";
import { complete, configuredLlmWillHandleCall } from "../src/core/local-llm";
import { extractFactCategories } from "../src/core/extraction";
import { resetHostLlmBackendForTests, setHostLlmBackend } from "../src/core/llm-backends";
import { Mnemopi, type MnemopiOptions } from "../src/core/memory";
import { withMnemopiRuntimeOptions } from "../src/core/runtime-options";

describe("LLM enablement", () => {
	test.each([[false, 0], [true, 1]])("nested enabled=%s controls host-backed extraction", async (enabled, expectedCalls) => {
		const previous = process.env.MNEMOPI_HOST_LLM_ENABLED;
		process.env.MNEMOPI_HOST_LLM_ENABLED = "1";
		let calls = 0;
		setHostLlmBackend({ complete: () => { calls++; return '{"facts":["host called"]}'; } });
		const memory = new Mnemopi({ dbPath: ":memory:", embeddings: false, llm: { enabled } });
		try {
			await withMnemopiRuntimeOptions(memory.runtimeOptions, () => extractFactCategories("A persistent fact"));
			expect(calls).toBe(expectedCalls);
		} finally {
			memory.close();
			resetHostLlmBackendForTests();
			if (previous === undefined) delete process.env.MNEMOPI_HOST_LLM_ENABLED;
			else process.env.MNEMOPI_HOST_LLM_ENABLED = previous;
		}
	});
	test("nested false blocks a configured completion", async () => {
		let calls = 0;
		const memory = new Mnemopi({
			dbPath: ":memory:",
			embeddings: false,
			llm: { enabled: false, complete: () => { calls++; return "response"; } },
		});
		try {
			expect(memory.runtimeOptions?.llm?.enabled).toBe(false);
			expect(withMnemopiRuntimeOptions(memory.runtimeOptions, configuredLlmWillHandleCall)).toBe(false);
			expect(await withMnemopiRuntimeOptions(memory.runtimeOptions, () => complete("prompt"))).toBeNull();
			expect(calls).toBe(0);
		} finally { memory.close(); }
	});

	test.each([
		[{ llm: { enabled: false } }, false],
		[{ llm: { enabled: false, model: "model" } }, false],
		[{ llm: { enabled: true } }, true],
		[{ llm: { model: "model" } }, true],
		[{ llmEnabled: true, llm: { enabled: false } }, true],
		[{ llmEnabled: false, llm: { enabled: true } }, false],
		[{}, undefined],
	] satisfies [MnemopiOptions, boolean | undefined][])("resolves %o", (options, expected) => {
		const memory = new Mnemopi({ dbPath: ":memory:", embeddings: false, ...options });
		try { expect(memory.runtimeOptions?.llm?.enabled).toBe(expected); }
		finally { memory.close(); }
	});
});
