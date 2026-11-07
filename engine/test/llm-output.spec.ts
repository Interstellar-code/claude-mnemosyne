import { afterEach, describe, expect, test } from "bun:test";
import { extractFactCategories } from "../src/core/extraction";
import { cleanOutput, complete } from "../src/core/local-llm";

const originalBaseUrl = process.env.MNEMOPI_LLM_BASE_URL;
const originalHostEnabled = process.env.MNEMOPI_HOST_LLM_ENABLED;
const originalEnabled = process.env.MNEMOPI_LLM_ENABLED;

afterEach(() => {
  for (const [name, value] of Object.entries({
    MNEMOPI_LLM_BASE_URL: originalBaseUrl,
    MNEMOPI_HOST_LLM_ENABLED: originalHostEnabled,
    MNEMOPI_LLM_ENABLED: originalEnabled,
  })) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("LLM output", () => {
  test("preserves list and source lines while removing model markers", () => {
    expect(
      cleanOutput(
        "<|assistant|><think>reasoning</think>\nSource: project notes\n- The server uses port 8080\n* The user prefers dark mode\n</s>",
      ),
    ).toBe("Source: project notes\n- The server uses port 8080\n* The user prefers dark mode");
  });

  test("preserves lists in remote completions and fact extraction", async () => {
    process.env.MNEMOPI_LLM_ENABLED = "1";
    process.env.MNEMOPI_HOST_LLM_ENABLED = "0";
    process.env.MNEMOPI_LLM_BASE_URL = "https://example.test";
    const output = "- The server uses port 8080\n- The user prefers dark mode\n";
    const fetch = async () => Response.json({ choices: [{ message: { content: output } }] });
    expect(await complete("List facts", 0, { fetch })).toBe(output.trim());
    expect((await extractFactCategories("Extract the facts", { fetch })).facts).toEqual([
      "The server uses port 8080",
      "The user prefers dark mode",
    ]);
  });
});
