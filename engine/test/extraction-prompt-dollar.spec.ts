// Issue #11: the extraction user prompt must carry the conversation text verbatim, even when it holds
// String.prototype.replace substitution patterns ($$, $&, $`, $', $1).
import { describe, expect, test } from "bun:test";
import { ExtractionClient } from "../src/core/extraction/client";

const CASES: readonly string[] = [
	"echo $$ is the shell pid",
	"the match was $& here",
	"before $` after",
	"quote $' tail",
	"group $1 and $<name>",
	"mixed $$ $& $` $' $1 end",
];

describe("ExtractionClient.extractFacts prompt", () => {
	for (const content of CASES) {
		test(`keeps ${JSON.stringify(content)} verbatim`, async () => {
			let sent = "";
			const fetchStub = (async (_url: string, init: { body: string }) => {
				const body = JSON.parse(init.body) as { messages: Array<{ role: string; content: string }> };
				sent = body.messages.find(m => m.role === "user")?.content ?? "";
				return new Response(JSON.stringify({ choices: [{ message: { content: "[]" } }] }), { status: 200 });
			}) as unknown as typeof fetch;
			const client = new ExtractionClient({ apiKey: "test", baseUrl: "http://stub.invalid", fetch: fetchStub });
			await client.extractFacts([{ role: "user", content }]);
			expect(sent).toContain(`[0] [user]: ${content}\n`);
		});
	}
});
