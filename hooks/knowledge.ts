// Knowledge extraction for one memory (plan KNOWX.2, C12).
//
// The flow, all of it through parameters so this file imports nothing (needed:
// it loads in an installed plugin with no engine node_modules):
//   engine([["mnemopi_knowledge_prompt", { memory_id }]...]) -> { prompt, sha256 } | { refused: "gone" } each
//   memories(["pending", "write", root], JSON)          -> the pending files on disk
//   model({ model, prompt, ... })                       -> the reply text, or a reason
//   engine([["mnemopi_knowledge_store", { memory_id, reply, sha256 }]...]) -> { stored } | { refused } each
//   memories(["pending", "remove-many", root], JSON)    -> the pending files gone
//
// The pending file is written BEFORE the model call and removed after the store
// answers stored, empty or gone (or at the prompt step when the memory is gone),
// so a cut call (Esc, a session end) leaves one file for /mnemosyne-knowledge to
// finish, and a newer update's entry is never removed.

/** One engine request: [tool, arguments]. */
export type KnowledgeRequest = readonly [name: string, args: Record<string, unknown>]
/** The engine call: requests, answered in order by one engine process, as an owner. Per request, the tool's text or its error. */
export type KnowledgeEngine = (requests: readonly KnowledgeRequest[], owner: string) => Promise<(string | Error)[]>
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
/** Runs `work` on each item, a few at once; no new item starts once the run is aborted. */
export type KnowledgePool = <T>(items: readonly T[], work: (item: T, index: number) => Promise<void>) => Promise<unknown>

export const KNOWLEDGE_MAX_TOKENS = 2000
export const KNOWLEDGE_TIMEOUT_MS = 60_000
export const KNOWLEDGE_EFFORT = 'low' as const

export type ExtractOutcome =
  | { kind: 'stored'; counts: Record<string, number> }
  | { kind: 'empty'; reason: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'stale' }
  | { kind: 'gone' }
  | { kind: 'off' }
  /** The run was stopped before this memory's model call started; its pending entry stays. */
  | { kind: 'notReached' }

export type ExtractRequest = {
  id: string
  owner: string
  root: string
  model: string
  engine: KnowledgeEngine
  memories: KnowledgeMemories
  modelCall: KnowledgeModel
  /** The sha256 the backfill read in the pending entry; removed too once the memory is done. */
  pendingSha?: string
}

/** One owner's memories, extracted together: the same flow as extractOne, with batched processes. */
export type ExtractBatch = {
  items: readonly { id: string; pendingSha?: string }[]
  owner: string
  root: string
  model: string
  engine: KnowledgeEngine
  memories: KnowledgeMemories
  modelCall: KnowledgeModel
  /** The model calls run through this (default: one at a time). */
  pool?: KnowledgePool
  /** A model call finished (answered or not): for a progress line. */
  onModelDone?: () => void
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
 * extractMany(batch): the whole extraction for one owner's memories, in as few
 * processes as the steps allow: ONE engine process for all the prompts, ONE
 * memories call writing all the pending entries (before any model call), the
 * model calls through the pool, ONE engine process for all the stores, ONE
 * memories call removing the finished entries. Never throws: every failure comes
 * back as an outcome, in the order of `items`.
 */
export async function extractMany(batch: ExtractBatch): Promise<ExtractOutcome[]> {
  const { items, owner, root, model, engine, memories, modelCall } = batch
  const outcomes: (ExtractOutcome | undefined)[] = items.map(() => undefined)
  const prompts = new Map<number, { text: string; sha256: string }>()
  const failAll = (reason: string, at: readonly number[]) => {
    for (const i of at) outcomes[i] ??= { kind: 'failed', reason }
  }
  const everyIndex = items.map((_, i) => i)
  // Entries whose file is removed at the end: [id, sha256 | undefined (any content)].
  const removals: { id: string; sha256?: string }[] = []

  // 1. The engine's prompts and the content hashes; gone means the row is not this owner's or is gone.
  let answers: (string | Error)[]
  try {
    answers = await engine(items.map(item => ['mnemopi_knowledge_prompt', { memory_id: item.id }] as const), owner)
  } catch (err) {
    failAll(reasonText(err), everyIndex)
    return outcomes as ExtractOutcome[]
  }
  items.forEach((item, i) => {
    const answer = answers[i]
    if (answer instanceof Error || answer === undefined) return void (outcomes[i] = { kind: 'failed', reason: answer === undefined ? 'unparseable' : reasonText(answer) })
    const reply = parse(answer)
    if (reply === null) return void (outcomes[i] = { kind: 'failed', reason: 'unparseable' })
    if (reply.refused === 'gone') {
      // A memory that is gone has nothing to finish: any entry for it goes, whatever it holds.
      removals.push({ id: item.id })
      return void (outcomes[i] = { kind: 'gone' })
    }
    if (typeof reply.prompt !== 'string' || typeof reply.sha256 !== 'string') return void (outcomes[i] = { kind: 'failed', reason: 'unparseable' })
    prompts.set(i, { text: reply.prompt, sha256: reply.sha256 })
  })

  // 2. The pending entries, before any model call: a cut call is recoverable.
  const live = [...prompts.keys()]
  if (live.length > 0) {
    try {
      await memories(['pending', 'write', root], JSON.stringify(live.map(i => ({ id: items[i]!.id, owner, sha256: prompts.get(i)!.sha256 }))))
    } catch (err) {
      failAll(reasonText(err), live)
      live.length = 0
      prompts.clear()
    }
  }

  // 3. The model calls, pooled. A rejection (a blocked model) is caught like an unanswered result.
  const replies = new Map<number, string>()
  const run: KnowledgePool = batch.pool ?? (async (list, work) => {
    for (let i = 0; i < list.length; i++) await work(list[i]!, i)
  })
  await run(live, async i => {
    const prompt = prompts.get(i)!
    let answer: { text?: string; reason?: string } | undefined
    try {
      answer = await modelCall({ model, prompt: prompt.text, maxTokens: KNOWLEDGE_MAX_TOKENS, timeoutMs: KNOWLEDGE_TIMEOUT_MS, effort: KNOWLEDGE_EFFORT })
    } catch (err) {
      answer = { reason: reasonText(err) }
    }
    const text = typeof answer?.text === 'string' ? answer.text : ''
    if (text.trim() === '') outcomes[i] = { kind: 'failed', reason: reasonOf(answer) }
    else replies.set(i, text)
    batch.onModelDone?.()
  })
  // A memory the pool never started (the run was stopped) keeps its pending entry for the next run.
  for (const i of live) if (outcomes[i] === undefined && !replies.has(i)) outcomes[i] = { kind: 'notReached' }

  // 4. The stores, as the same owner: one engine process. Each reply goes in unchanged, with its prompt's sha256.
  const storing = [...replies.keys()]
  if (storing.length > 0) {
    let stored: (string | Error)[] = []
    let storeError: string | undefined
    try {
      stored = await engine(storing.map(i => ['mnemopi_knowledge_store', { memory_id: items[i]!.id, reply: replies.get(i)!, sha256: prompts.get(i)!.sha256 }] as const), owner)
    } catch (err) {
      storeError = reasonText(err)
    }
    storing.forEach((i, at) => {
      const answer = stored[at]
      if (storeError !== undefined) return void (outcomes[i] = { kind: 'failed', reason: storeError })
      if (answer instanceof Error || answer === undefined) return void (outcomes[i] = { kind: 'failed', reason: answer === undefined ? 'unparseable' : reasonText(answer) })
      const reply = parse(answer)
      if (reply === null) return void (outcomes[i] = { kind: 'failed', reason: 'unparseable' })
      const finished = (sha256: string) => {
        // The entry is removed only while it still holds this run's sha256 (and the one the backfill read).
        removals.push({ id: items[i]!.id, sha256 })
        const read = items[i]!.pendingSha
        if (read !== undefined && read !== sha256) removals.push({ id: items[i]!.id, sha256: read })
      }
      const sha256 = prompts.get(i)!.sha256
      if (reply.refused === 'gone') {
        finished(sha256)
        return void (outcomes[i] = { kind: 'gone' })
      }
      if (reply.refused === 'stale') return void (outcomes[i] = { kind: 'stale' })
      if (reply.refused === 'unparseable' || reply.refused === 'invalid') return void (outcomes[i] = { kind: 'failed', reason: String(reply.refused) })
      const counts = reply.stored !== null && typeof reply.stored === 'object' && !Array.isArray(reply.stored) ? (reply.stored as Record<string, number>) : {}
      const total = Object.values(counts).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0)
      finished(sha256)
      outcomes[i] = total === 0 ? { kind: 'empty', reason: 'no items' } : { kind: 'stored', counts }
    })
  }

  // 5. The finished entries go, in one call.
  if (removals.length > 0) {
    try {
      await memories(['pending', 'remove-many', root], JSON.stringify(removals))
    } catch {
      // a pending file that cannot be removed is finished again by the backfill
    }
  }
  return outcomes.map(outcome => outcome ?? { kind: 'failed', reason: 'no result' })
}

/**
 * extractOne(request): the whole extraction for one memory (a live save). The same
 * flow as extractMany over one item. Never throws.
 */
export async function extractOne(request: ExtractRequest): Promise<ExtractOutcome> {
  const { id, pendingSha, ...rest } = request
  const [outcome] = await extractMany({ ...rest, items: [{ id, ...(pendingSha === undefined ? {} : { pendingSha }) }] })
  return outcome ?? { kind: 'failed', reason: 'no result' }
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
    case 'notReached':
      return 'not reached'
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
