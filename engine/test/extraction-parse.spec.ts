import { describe, expect, test } from "bun:test";
import { parseExtractedFactCategories, parseFacts } from "../src/core/extraction";

// #14: a truncated or malformed JSON reply must not store field names or JSON fragments as facts.
describe("parseExtractedFactCategories broken JSON fallback", () => {
  const cases: Array<{ name: string; raw: string; facts: string[] }> = [
    {
      name: "truncated JSON skips object keys in the quoted-string salvage",
      raw: '{"facts": ["User likes green tea", "User works at Acme Corp"], "instructions": ["Always use tab',
      facts: ["User likes green tea", "User works at Acme Corp"],
    },
    {
      name: "truncated JSON skips long category and custom keys",
      raw: '{"preferences": ["User prefers dark mode"],"timelines_extended": ["x',
      facts: ["User prefers dark mode"],
    },
    {
      name: "JSON lines with no quoted 10+ string drop structural lines and strip quoting",
      raw: '{\n  "facts": [\n    "User likes green tea and coffee',
      facts: ["User likes green tea and coffee"],
    },
    {
      name: "JSON lines carrying a key and opening bracket keep only the value",
      raw: '{\n"facts": ["Tea lover",\n"preferences": {\n],\n"User runs the linter',
      facts: ["User runs the linter"],
    },
  ];

  for (const c of cases) {
    test(c.name, () => {
      const out = parseExtractedFactCategories(c.raw);
      expect(out.facts).toEqual(c.facts);
      expect(out.instructions).toEqual([]);
      expect(out.preferences).toEqual([]);
      expect(out.timelines).toEqual([]);
      expect(out.kg).toEqual([]);
    });
  }

  test("plain bulleted text reply is unchanged", () => {
    const raw = '- The server uses port 8080.\n* The user prefers "dark mode": always\n1. Short\n2. The deploy runs on Fridays!';
    expect(parseFacts(raw)).toEqual([
      "The server uses port 8080",
      'The user prefers "dark mode": always',
      "The deploy runs on Fridays",
    ]);
  });
});
