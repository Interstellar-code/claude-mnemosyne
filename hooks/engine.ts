// One engine call, shared by the hooks (register.ts runs it through
// $.process.run) and the dashboard server (ui/server.ts spawns it itself).
//
// Every call is one `bun <cli> mcp` process answering bare `tools/call`
// requests, one per line on its stdin. This file imports nothing, so hook
// code, the server and the specs can all load it (contract C4).

export type EngineRequest = readonly [name: string, args: Record<string, unknown>]

// Where the local model lives, relative to $HOME: the plugin pins PI_CONFIG_DIR
// and the engine reads it directly (never through pi-utils' XDG/profile
// resolver), so the fastembed cache is <PI_CONFIG_DIR>/cache/fastembed =
// <HOME>/.claude/mnemosyne/model-cache/cache/fastembed (EMB.1, H1b).
export const EMBEDDINGS_MODEL = 'BAAI/bge-small-en-v1.5'
export const EMBEDDINGS_CACHE_DIR = '.claude/mnemosyne/model-cache'

export type EngineEnvOptions = {
  // True only when the option is on AND the model is downloaded: setup wrote its
  // marker and the model files are there. Otherwise the engine keeps embeddings
  // off so it never downloads the model behind the user's back (EMB.2.a4).
  embeddings?: boolean
}

// The variables every engine process gets, laid over the caller's own
// environment. The owner id rides on MNEMOPI_SESSION_ID: recall reads that
// owner's rows plus every `scope: 'global'` row, and forget deletes only the
// owner's.
//
// Embeddings are off unless `options.embeddings` is true. When off,
// MNEMOPI_NO_EMBEDDINGS=1 keeps recall full-text only. When on, the embedding
// settings are pinned to local-only, fixed values: an inherited shell variable
// can neither send memory text to an API nor change the model (which would wipe
// the vectors). The engine treats an empty value as unset, so an empty string
// clears an inherited one (EMB.3.a1).
export function engineEnv(store: string, owner: string, options: EngineEnvOptions = {}): Record<string, string> {
  const embeddings = options.embeddings === true
  return {
    MNEMOPI_DATA_DIR: store,
    MNEMOPI_SESSION_ID: owner,
    MNEMOPI_CHANNEL_ID: owner,
    // Inherited from the shell this would move writes to <store>/banks/<x>; empty falls back to `default`.
    MNEMOPI_MCP_BANK: 'default',
    // The env is layered over the caller's: an exported LLM URL would let the engine call out.
    MNEMOPI_LLM_BASE_URL: '',
    MNEMOPI_HOST_LLM_ENABLED: '',
    // Empty counts as unset in the engine; the plugin sets the author per call instead.
    MNEMOPI_AUTHOR_ID: '',
    MNEMOPI_AUTHOR_TYPE: '',
    // Polyphonic recall writes consolidated_facts, which a forget does not purge.
    MNEMOPI_POLYPHONIC_RECALL: '0',
    // Local only, always: no text to an API, no inherited key, one fixed model.
    MNEMOPI_EMBEDDING_API_URL: '',
    MNEMOPI_EMBEDDINGS_VIA_API: '',
    MNEMOPI_EMBEDDING_API_KEY: '',
    MNEMOPI_EMBEDDING_MODEL: EMBEDDINGS_MODEL,
    // The dimension is fixed by the model (384 for bge-small); an inherited
    // MNEMOPI_EMBEDDING_DIM must not change it.
    MNEMOPI_EMBEDDING_DIM: '',
    // The engine's API-route fallback: an empty MNEMOPI_EMBEDDING_API_URL would
    // otherwise fall back to these, routing memory text to a remote API (C1).
    OPENROUTER_BASE_URL: '',
    OPENROUTER_API_KEY: '',
    OPENAI_API_KEY: '',
    // The opt-in that reopens the API route is pinned '0' (non-empty, so the
    // engine's dotenv pass cannot fill it from a `~/.env` or project `.env`
    // line), keeping local-only the only route (C1b).
    MNEMOPI_EMBEDDINGS_API_OPT_IN: '0',
    // fastembed reads this when it downloads; pinning it keeps the download on
    // the host setup prints (L6).
    HF_ENDPOINT: 'https://huggingface.co',
    // The model cache under the plugin's root, never the shared ~/.omp one.
    // Read directly by the engine (not through pi-utils' XDG/profile resolver),
    // so a `~/.env`/project `.env` line cannot move it (H1b).
    PI_CONFIG_DIR: EMBEDDINGS_CACHE_DIR,
    // On only when the caller proved the model is downloaded. Off blocks the
    // engine's lazy model download outside /mnemosyne-setup; on clears an
    // inherited MNEMOPI_NO_EMBEDDINGS (empty counts as unset in the engine).
    MNEMOPI_NO_EMBEDDINGS: embeddings ? '' : '1',
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
