// Knowledge extraction for one memory (plan KNOWX.2, C12).
//
// The flow, all of it through parameters so this file imports nothing (needed:
// it loads in an installed plugin with no engine node_modules):
//   engine("mnemopi_knowledge_prompt", { memory_id })  -> { prompt, sha256 } | { refused: "gone" }
//   memories(["pending", "write", root], JSON)          -> the pending file on disk
//   model({ model, prompt, ... })                       -> the reply text, or a reason
//   engine("mnemopi_knowledge_store", { memory_id, reply, sha256 }) -> { stored } | { refused }
//   memories(["pending", "remove", root, id, sha256])   -> the pending file gone
//
// The pending file is written BEFORE the model call and removed after the store
// answers stored or gone, so a cut call (Esc, a session end) leaves one file for
// /mnemosyne-knowledge to finish, and a newer update's entry is never removed.

/** The engine call: (tool, args, owner) -> the tool's text, rejecting with its message. */
export type KnowledgeEngine = (name: string, args: Record<string, unknown>, owner: string) => Promise<string>
/** The bin/memories.ts call: (args, stdin?) -> stdout. */
export type KnowledgeMemories = (args: readonly string[], stdin?: string) => Promise<string>
/** The model call: a resolved reply, an unanswered result, or a rejection (caught here). */
export type KnowledgeModel = (request: {
  model: string
  prompt: string
  maxTokens: number
  timeoutMs: number
  effort: 'low'
}) => Promise<{ text?: string; reason?: string } | undefined>

export const KNOWLEDGE_MAX_TOKENS = 2000
export const KNOWLEDGE_TIMEOUT_MS = 60_000
export const KNOWLEDGE_EFFORT = 'low' as const
// One extraction per session at a time; a later save queues behind it.
export const KNOWLEDGE_CONCURRENCY = 1

export type ExtractOutcome =
  | { kind: 'stored'; counts: Record<string, number> }
  | { kind: 'empty'; reason: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'stale' }
  | { kind: 'gone' }
  | { kind: 'off' }

export type ExtractRequest = {
  id: string
  owner: string
  root: string
  model: string
  engine: KnowledgeEngine
  memories: KnowledgeMemories
  modelCall: KnowledgeModel
}

const parse = (text: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(text)
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** A short reason from a model result that carried none. */
const reasonOf = (result: { text?: string; reason?: string } | undefined) =>
  result === undefined ? 'empty-reply' : (result.reason ?? (result.text === undefined || result.text.trim() === '' ? 'empty-reply' : 'rejected'))

/**
 * extractOne(request): the whole extraction for one memory. Never throws: every
 * failure comes back as an outcome the caller logs and counts.
 */
export async function extractOne(request: ExtractRequest): Promise<ExtractOutcome> {
  const { id, owner, root, model, engine, memories, modelCall } = request
  // 1. The engine's prompt and the content's sha256; gone means the row is not this owner's or is gone.
  let promptText: string
  let sha256: string
  try {
    const reply = parse(await engine('mnemopi_knowledge_prompt', { memory_id: id }, owner))
    if (reply === null) return { kind: 'failed', reason: 'unparseable' }
    if (reply.refused === 'gone') return { kind: 'gone' }
    if (typeof reply.prompt !== 'string' || typeof reply.sha256 !== 'string') return { kind: 'failed', reason: 'unparseable' }
    promptText = reply.prompt
    sha256 = reply.sha256
  } catch (err) {
    return { kind: 'failed', reason: reasonText(err) }
  }
  // 2. The pending file, before the model call: a cut call is recoverable.
  try {
    await memories(['pending', 'write', root], JSON.stringify({ id, owner, sha256 }))
  } catch (err) {
    return { kind: 'failed', reason: reasonText(err) }
  }
  // 3. The model call. A rejection (a blocked model) is caught like an unanswered result.
  let answer: { text?: string; reason?: string } | undefined
  try {
    answer = await modelCall({ model, prompt: promptText, maxTokens: KNOWLEDGE_MAX_TOKENS, timeoutMs: KNOWLEDGE_TIMEOUT_MS, effort: KNOWLEDGE_EFFORT })
  } catch (err) {
    answer = { reason: reasonText(err) }
  }
  const text = typeof answer?.text === 'string' ? answer.text : ''
  if (text.trim() === '') {
    return { kind: 'failed', reason: reasonOf(answer) }
  }
  // 4. The store, as the same owner. The reply goes in unchanged, with the prompt's sha256.
  try {
    const stored = parse(await engine('mnemopi_knowledge_store', { memory_id: id, reply: text, sha256 }, owner))
    if (stored === null) return { kind: 'failed', reason: 'unparseable' }
    if (stored.refused === 'gone') {
      await removeQuietly(memories, root, id, sha256)
      return { kind: 'gone' }
    }
    if (stored.refused === 'stale') return { kind: 'stale' }
    if (stored.refused === 'unparseable' || stored.refused === 'invalid') return { kind: 'failed', reason: String(stored.refused) }
    const counts = stored.stored !== null && typeof stored.stored === 'object' && !Array.isArray(stored.stored) ? (stored.stored as Record<string, number>) : {}
    const total = Object.values(counts).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0)
    // 5. The entry is removed only while it still holds this run's sha256.
    await removeQuietly(memories, root, id, sha256)
    return total === 0 ? { kind: 'empty', reason: 'no items' } : { kind: 'stored', counts }
  } catch (err) {
    return { kind: 'failed', reason: reasonText(err) }
  }
}

async function removeQuietly(memories: KnowledgeMemories, root: string, id: string, sha256: string) {
  try {
    await memories(['pending', 'remove', root, id, sha256])
  } catch {
    // a pending file that cannot be removed is finished again by the backfill
  }
}

const reasonText = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** The item count of a stored outcome, for the activity line. */
export const storedCount = (outcome: ExtractOutcome) =>
  outcome.kind === 'stored' ? Object.values(outcome.counts).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0) : 0

/** A one-line reason for a failed extract activity line. */
export function reasonLine(outcome: ExtractOutcome): string | undefined {
  switch (outcome.kind) {
    case 'stored':
      return undefined
    case 'empty':
      return 'empty-reply'
    default:
      return outcome.kind === 'failed' ? outcome.reason : outcome.kind
  }
}

/** The knowledge-empty record: a memory whose extraction yielded nothing, so the backfill skips it. */
export const EMPTY_FILE = 'knowledge-empty.json'

export type EmptyEntry = { id: string; sha256: string }

/** The stored empty list, from the file's text; anything broken is an empty list. */
export function parseEmpty(text: string): EmptyEntry[] {
  const value = parse(text)
  const list = value?.empty
  if (!Array.isArray(list)) return []
  return list.filter((item): item is EmptyEntry => item !== null && typeof item === 'object' && typeof (item as EmptyEntry).id === 'string' && typeof (item as EmptyEntry).sha256 === 'string')
}
