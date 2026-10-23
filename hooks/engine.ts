// One engine call, shared by the hooks (register.ts runs it through
// $.process.run) and the dashboard server (ui/server.ts spawns it itself).
//
// Every call is one `bun <cli> mcp` process answering bare `tools/call`
// requests, one per line on its stdin. This file imports nothing, so hook
// code, the server and the specs can all load it (contract C4).

export type EngineRequest = readonly [name: string, args: Record<string, unknown>]

// The variables every engine process gets, laid over the caller's own
// environment. The owner id rides on MNEMOPI_SESSION_ID: recall reads that
// owner's rows plus every `scope: 'global'` row, and forget deletes only the
// owner's. MNEMOPI_NO_EMBEDDINGS=1 because a spawned bun panics on fastembed
// (DESIGN §2.5), so recall is full-text only.
export function engineEnv(store: string, owner: string): Record<string, string> {
  return {
    MNEMOPI_DATA_DIR: store,
    MNEMOPI_SESSION_ID: owner,
    MNEMOPI_CHANNEL_ID: owner,
    MNEMOPI_NO_EMBEDDINGS: '1',
    // Inherited from the shell this would move writes to <store>/banks/<x>; empty falls back to `default`.
    MNEMOPI_MCP_BANK: '',
    // The env is layered over the caller's: an exported LLM URL would let the engine call out.
    MNEMOPI_LLM_BASE_URL: '',
    MNEMOPI_HOST_LLM_ENABLED: '',
  }
}

// The engine's stdin: one JSON-RPC `tools/call` per request, ids 1, 2, ...
export function buildRequests(requests: readonly EngineRequest[]) {
  return requests
    .map(([name, args], i) => `${JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name, arguments: args } })}\n`)
    .join('')
}

type Reply = { error?: { message: string }; result?: { content?: { text?: string }[]; isError?: boolean } }

// Per request, in order: the tool's text, or an Error with the engine's
// message (or how the process ended, when it gave no reply).
export function parseReplies(count: number, stdout: string, exitCode: number | null, stderr: string): (string | Error)[] {
  const replies = new Map<unknown, Reply>()
  for (const line of stdout.split('\n')) {
    try {
      const message = JSON.parse(line)
      if (message?.id !== undefined) replies.set(message.id, message)
    } catch {
      // not a reply: engine chatter
    }
  }
  return Array.from({ length: count }, (_, i) => {
    const reply = replies.get(i + 1)
    if (reply === undefined) return new Error(`engine exited ${exitCode}: ${stderr.trim().slice(-300)}`)
    if (reply.error) return new Error(reply.error.message)
    const text = reply.result?.content?.[0]?.text ?? ''
    return reply.result?.isError ? new Error(text) : text
  })
}
