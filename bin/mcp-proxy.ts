// Claude Mnemosyne — stdio MCP proxy for other clients (userConfig externalMcp).
//
// Runs the engine and passes through only the plugin's own six tools, named
// memory_* as in the plugin (the engine calls them mnemopi_*). The
// engine's others leak across owners or lose data (DESIGN §5.6): sleep widens a
// project's facts to global, export writes the whole store anywhere, shared_*
// rows are deleted after 24 hours. The engine's get reads any owner's row, so
// memory_get (GET.1) is served only after a read-only look at the store shows the
// row is this server's owner's or global (what recall shows); any other id is not_found.
//
// Remember is pinned the way C4 says an outside agent writes: source `mcp:<client>`, trust tier
// EXTERNAL_WRITE, veracity unknown (a client never sets how far its save is trusted), and a scope that
// keeps the row out of the engine's 24-hour trim (the trim spares every scope but 'session').
// A client never picks a bank (it would move writes to <store>/banks/<x>) and
// never writes metadata: only `tags`, cleaned by hooks/tags.ts, reach the
// engine, as metadata.tags. A client names a memory's kind as `kind` (hooks/kinds.ts), sent as
// memory_type; an unknown kind is refused, and so is a remember with none (-32602, nothing is
// saved). memory_update needs no kind, and this plugin's engine build.
// Saves (remember, and update with content) pass hooks/guard.ts first: a secret or
// size block is a -32602 error; a warned save is too in strict guard mode (the
// default; MNEMOSYNE_GUARD_MODE, set by mnemosyne-mcp) unless the call passes
// confirm: true, and in warn mode it is stored with metadata.guard.
// Each call of the six tools is recorded in MNEMOSYNE_ACTIVITY_LOG (empty: off)
// as one activity line with origin external, written once its reply is read.
// An update or forget of another owner's memory answers not_found from the engine; the proxy then
// adds whose memory it is (`owner`, `hint`), read-only from the store (OWNERHINT).
// Run by ~/.claude/mnemosyne/bin/mnemosyne-mcp, which sets the environment.
import { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { activityLine, callOutcome, callText, TOOL_ACTIONS } from '../hooks/activity-log'
import type { ActivityAction } from '../hooks/activity-log'
import { ENGINE_BUILD } from '../hooks/engine-build'
import { admit, guardConfigOf } from '../hooks/guard'
import { expiresInDaysProblem, KIND_NAMES, kindProblem, missingKindMessage, validUntilFor } from '../hooks/kinds'
import { cutNote, engineTool, getNotFound, isCut, MEMORY_ID, mnemosyneGet, mnemosyneStats, publicTool, RECALL_DESCRIPTION_CUT, visibleTo } from '../hooks/surface'
import type { RowInfo } from '../hooks/surface'
import { rowInfo } from './row-info'
import { cleanTags } from '../hooks/tags'
import { tagRules } from '../hooks/vocab'
import { appendActivity } from './activity'
import { readConfig } from './settings'
import { parseConfig } from '../hooks/settings'
import type { ResolvedSettings } from '../hooks/settings'

const ALLOWED = new Set(['memory_remember', 'memory_recall', 'memory_update', 'memory_forget', 'memory_stats', 'memory_get'])
const TAGGED = new Set(['memory_remember', 'memory_update'])
// The texts that quote a number follow the settings (C6): the tag count (T1) and the context-note days (E1).
const tagsProperty = (settings: ResolvedSettings) => ({
  type: 'array',
  items: { type: 'string' },
  description: `Short lowercase topic tags, at most ${settings.tags.maxPerMemory}. On update they replace the old ones; [] removes them.`,
})
const KIND_PROPERTY = {
  type: 'string',
  enum: KIND_NAMES,
  description: 'What kind of memory this is. Required on remember: a save without it is refused.',
}
const expiresProperty = (settings: ResolvedSettings) => ({
  type: 'integer',
  description: `Forget this memory after this many days (1 to 365). A context note expires after ${settings.expiry.contextDays} days when this is not given.`,
})
const CONFIRM_PROPERTY = {
  type: 'boolean',
  description: 'Send true to save text the guard warned about (only after a refusal that asked for it). Secrets and size blocks cannot be confirmed.',
}
const cli = process.env.MNEMOSYNE_CLI
if (!cli) throw new Error('MNEMOSYNE_CLI is not set: run this through mnemosyne-mcp.')
const owner = process.env.MNEMOPI_SESSION_ID || 'global'
const isGlobalOwner = owner === 'global'
const activityLog = process.env.MNEMOSYNE_ACTIVITY_LOG ?? ''
// The guardMode option, set by mnemosyne-mcp: strict (default, also when unset) or warn.
// The vocabulary file its tags are cleaned with (set by mnemosyne-mcp; empty: none). Read at each call, never fatal:
// no file or a file that cannot be read gives no aliases. The owner's project name is dropped from every tag list.
const vocabularyFile = process.env.MNEMOSYNE_VOCABULARY ?? ''
// The folder that holds config.json (set by mnemosyne-mcp; an older wrapper sets only the vocabulary file, which sits in the same folder).
// The settings are read at each call and each tools/list, like the vocabulary: a change applies without a restart. Never fatal:
// no folder, no file or a broken file gives the defaults, which are the numbers that were hard-coded before (C3).
const configRoot = process.env.MNEMOSYNE_ROOT || (vocabularyFile === '' ? '' : dirname(vocabularyFile))
const settingsNow = () => (configRoot === '' ? parseConfig(undefined) : readConfig(configRoot))
function tagRulesNow() {
  let text: string | undefined
  try {
    text = vocabularyFile === '' ? undefined : readFileSync(vocabularyFile, 'utf8')
  } catch {
    text = undefined
  }
  return tagRules(text, owner)
}
const strictGuard = (process.env.MNEMOSYNE_GUARD_MODE ?? '').trim().toLowerCase() !== 'warn'
// The client's self-declared name, from its initialize request (CTX.2); unknown until it says.
let client = 'unknown'

// The name is stamped into author_id on every save, so it is bounded here as the activity line bounds
// it (60 code points, hooks/activity-log.ts CLIENT_LIMIT): control characters, bidirectional marks and
// zero-width characters removed (the set activity-log.ts removes), the ends trimmed, the rest cut.
const CLIENT_LIMIT = 60
const CLIENT_CONTROL = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g
const cleanClient = (name: string) => Array.from(name.replace(CLIENT_CONTROL, '').trim()).slice(0, CLIENT_LIMIT).join('').trim()

// The installed engine's build, from <engine>/node_modules/@oh-my-pi/pi-mnemopi/package.json.
function installedBuild(cliPath: string) {
  try {
    return String(JSON.parse(readFileSync(join(dirname(cliPath), '..', 'package.json'), 'utf8')).version)
  } catch {
    return 'unknown'
  }
}
const build = installedBuild(cli)

// OWNERHINT: the engine changes only its own owner's rows, so an update or forget of another
// owner's memory answers not_found although recall shows the memory (every global-scope row is
// recalled by every owner). The proxy then looks the id up, read-only, in the store mnemosyne-mcp
// names (MNEMOPI_DATA_DIR; the bank is always `default`), and says whose it is. Never fatal: no
// store, a locked file or a missing row gives no hint and the reply stays as the engine sent it.
const storeDb = process.env.MNEMOPI_DATA_DIR ? join(process.env.MNEMOPI_DATA_DIR, 'mnemopi.db') : ''
// Read-only, and waiting up to 2 s for the engine's write lock rather than failing at once: the engine may still be
// finishing the write that came just before (a lookup that failed on the lock gave no hint, now and then).
function openStore(dbPath: string) {
  const db = new Database(dbPath, { readonly: true })
  db.exec('PRAGMA busy_timeout = 2000')
  return db
}
function ownerOfMemory(dbPath: string, id: unknown): string | undefined {
  if (dbPath === '' || typeof id !== 'string' || id === '' || id.length > 64) return undefined
  let db: Database | undefined
  try {
    db = openStore(dbPath)
    const row = db.query('SELECT session_id AS owner FROM working_memory WHERE id = ?').get(id) as { owner: unknown } | null
    return typeof row?.owner === 'string' && row.owner !== '' ? row.owner : undefined
  } catch {
    return undefined
  } finally {
    db?.close()
  }
}
// GET.1: whose a row is, its scope and kind, read-only from the same store; undefined on any failure (the get then answers not_found).
function infoOfMemory(dbPath: string, id: unknown): RowInfo | undefined {
  if (dbPath === '' || typeof id !== 'string') return undefined
  let db: Database | undefined
  try {
    db = openStore(dbPath)
    return rowInfo(db, id)
  } catch {
    return undefined
  } finally {
    db?.close()
  }
}
const otherOwnerHint = (memoryOwner: string, ownOwner: string) =>
  `This memory belongs to ${memoryOwner}, not to ${ownOwner}, the owner this MCP server writes as, so it can only be read here. ` +
  `Change it from the Mnemosyne dashboard, from a Claude Code session in that project, or through a server started with MNEMOSYNE_OWNER=${memoryOwner}.`

const engine = Bun.spawn(['bun', cli, 'mcp'], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
const listIds = new Set<unknown>()
const statsIds = new Set<unknown>()
const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`)

// The calls on their way to the engine, by JSON-RPC id: what to log once the reply comes back.
type Pending = { action: ActivityAction; text: string; args: Record<string, unknown>; warnings?: string[]; info?: RowInfo }
const pending = new Map<unknown, Pending>()

// One activity line, written synchronously (so it is on disk before the proxy
// exits); appendActivity never throws, so a log failure never reaches the client.
function log(call: Pending, outcome: { ok: boolean; ids?: readonly string[]; count?: number; error?: string }) {
  if (!activityLog) return
  try {
    appendActivity(activityLog, [activityLine({ action: call.action, origin: 'external', owner, client, text: call.text, ...outcome })])
  } catch {
    // building the line failed: the client's reply is already sent and stays as it was
  }
}

// A refused call of one of the six tools: logged now, as the engine never sees it.
// `logged` replaces the error text in the line (a guard block logs rule ids only).
function refuse(id: unknown, action: ActivityAction | undefined, args: Record<string, unknown>, error: { code: number; message: string; data?: unknown }, logged?: string) {
  send({ jsonrpc: '2.0', id, error })
  if (!action) return
  try {
    log({ action, text: callText(action, args), args }, { ok: false, error: logged ?? error.message })
  } catch {
    // as in log(): never reaches the client
  }
}

async function* lines(stream: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true })
    let end: number
    while ((end = buffer.indexOf('\n')) >= 0) {
      yield buffer.slice(0, end)
      buffer = buffer.slice(end + 1)
    }
  }
  if (buffer.trim()) yield buffer
}

// Client to engine: refuse other tools; drop bank and metadata; clean tags and
// importance; pin remember's source and scope.
void (async () => {
  for await (const line of lines(Bun.stdin.stream())) {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      continue
    }
    if (message?.method === 'initialize') {
      // The client's self-declared app name (CTX.2). No name means unknown: the
      // version is never used as a label (review 2 LOW 3).
      const info = message?.params?.clientInfo
      if (info !== null && typeof info === 'object' && !Array.isArray(info)) {
        const name = typeof info.name === 'string' ? cleanClient(info.name) : ''
        if (name !== '') client = name
      }
      // Forward the initialize request unchanged, byte for byte (CTX.2.a1).
      engine.stdin.write(`${line}\n`)
      continue
    }
    if (message?.method === 'tools/list') listIds.add(message.id)
    if (message?.method === 'tools/call') {
      const name = message.params?.name
      const raw = message.params?.arguments
      const given: Record<string, unknown> = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
      // Tools outside the six are not memory calls and are not logged.
      const settings = settingsNow()
      const action = ALLOWED.has(name) ? TOOL_ACTIONS[name] : undefined
      // M2: a tool outside the allow-list is not served, the same answer as a tool outside the six. Not logged: the line would carry no new fact.
      if (!ALLOWED.has(name) || !(settings.tools.externalAllow as readonly string[]).includes(name)) {
        refuse(message.id, undefined, given, { code: -32601, message: `Tool not available: ${name}` })
        continue
      }
      // GET.1: memory_get reads as this server's owner only. `owner`, when given, must be the row's own; a row that is neither
      // this owner's nor global, or that does not exist, gets the same not_found, answered here without the engine.
      let getInfo: RowInfo | undefined
      if (name === 'memory_get') {
        const id = given.memory_id
        if (typeof id !== 'string' || !MEMORY_ID.test(id)) {
          refuse(message.id, action, given, { code: -32602, message: 'memory_id must be the id of a memory (from memory_recall).' })
          continue
        }
        getInfo = infoOfMemory(storeDb, id)
        const named = typeof given.owner === 'string' && given.owner !== '' ? given.owner : undefined
        if (!visibleTo(getInfo, owner) || (named !== undefined && named !== getInfo?.owner)) {
          const missing = getNotFound(id)
          send({ jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: missing }] } })
          if (action) log({ action, text: callText(action, given), args: given }, callOutcome(action, given, missing))
          continue
        }
      }
      if ((name === 'memory_update' || name === 'memory_remember') && build !== ENGINE_BUILD) {
        // memory_remember too: an older engine's 24 h trim deletes every row whose trust tier is not IMPORTED, which a save of this build's is not.
        const reason = `${name} needs the Mnemosyne engine build ${ENGINE_BUILD}; installed is ${build}. Run /mnemosyne-setup in Claude Code.`
        // A refused save logs no memory text: the line is built from no arguments.
        refuse(message.id, action, name === 'memory_remember' ? {} : given, { code: -32000, message: reason })
        continue
      }
      // GUARD.2: the same admission check as the plugin's own tools, before anything reaches the engine.
      // A block is refused with the rule ids; the line holds the ids only, never the text.
      let warned: ReturnType<typeof admit>['hits'] = []
      if (name === 'memory_remember' || (name === 'memory_update' && typeof given.content === 'string')) {
        const guard = admit({ content: given.content as string, kind: typeof given.kind === 'string' ? given.kind : undefined, origin: 'proxy' }, guardConfigOf(settings))
        const ids = [...new Set(guard.hits.map(hit => hit.rule))]
        if (guard.verdict === 'block') {
          refuse(
            message.id,
            action,
            {},
            { code: -32602, message: `The save guard blocked this save (${ids.join(', ')}). ${guard.hits.map(hit => hit.message).join(' ')}`, data: { rules: ids, verdict: 'block' } },
            `guard:${ids.join(',')}`,
          )
          continue
        }
        if (guard.verdict === 'warn') {
          // Strict mode: a warned save is refused until the call says confirm: true.
          // The chatter check set to strict (G6) asks for the confirm whatever the guard mode.
          if ((strictGuard || guard.mustConfirm === true) && given.confirm !== true) {
            refuse(
              message.id,
              action,
              {},
              { code: -32602, message: `The save guard warns about this save (${ids.join(', ')}). ${guard.hits.map(hit => hit.message).join(' ')} Resend with confirm: true if the save is wanted.`, data: { rules: ids, verdict: 'warn' } },
              `guard:${ids.join(',')}`,
            )
            continue
          }
          warned = guard.hits
        }
      }
      // META.1: `kind` is the client's word for the engine's memory_type. An unknown kind is refused;
      // a missing one on remember is refused too (the line holds no memory text). A client's own
      // memory_type is dropped, so the kind list is the only way in.
      const { bank: _bank, metadata: _metadata, tags, confirm: _confirm, kind, memory_type: _memoryType, valid_until: _validUntil, ...args } = given
      if (TAGGED.has(name)) {
        const badKind = kindProblem(kind)
        if (badKind !== undefined) {
          refuse(message.id, action, given, { code: -32602, message: badKind })
          continue
        }
        if (kind !== undefined && kind !== null) args.memory_type = kind
        else if (name === 'memory_remember') {
          refuse(message.id, action, {}, { code: -32602, message: missingKindMessage('memory_remember') })
          continue
        }
        if (name === 'memory_remember') {
          const badDays = expiresInDaysProblem(args.expires_in_days)
          if (badDays !== undefined) {
            refuse(message.id, action, given, { code: -32602, message: badDays })
            continue
          }
          // A context note fades after 14 days unless the call gives expires_in_days; the engine takes valid_until.
          const validUntil = validUntilFor(kind, args.expires_in_days, Date.now(), settings.expiry.contextDays)
          if (validUntil !== undefined) args.valid_until = validUntil
        }
      }
      if (TAGGED.has(name) && tags !== undefined) {
        if (!Array.isArray(tags)) {
          refuse(message.id, action, given, { code: -32602, message: 'tags must be an array of strings' })
          continue
        }
        const clean = cleanTags(tags, { ...tagRulesNow(), max: settings.tags.maxPerMemory })
        // Tags that all clean away (the project name, punctuation, blanks) must not read as "remove the tags": [] is how those are removed.
        if (name === 'memory_update' && clean.length === 0 && Array.isArray(tags) && tags.length > 0) {
          refuse(message.id, action, {}, { code: -32602, message: 'none of those tags can be stored (a tag may not be the project name, and needs a letter or digit). Send tags: [] to remove the tags.' })
          continue
        }
        // remember: no tags, no metadata; update: [] removes the key.
        if (name === 'memory_update') args.metadata = { tags: clean.length > 0 ? clean : null }
        else if (clean.length > 0) args.metadata = { tags: clean }
      }
      // Importance is 0 to 1, as the plugin's own tools clamp it; anything else is dropped.
      if (TAGGED.has(name) && 'importance' in args) {
        const importance = args.importance
        if (typeof importance === 'number' && Number.isFinite(importance)) args.importance = Math.min(1, Math.max(0, importance))
        else delete args.importance
      }
      // C10.2: the audit trail names the client behind a content change; a client never picks its own validator.
      if (TAGGED.has(name)) {
        delete args.validator
        if (name === 'memory_update' && typeof args.content === 'string') args.validator = `mcp:${client}`.slice(0, 64)
      }
      // A warned save is stored, flagged with the rule ids in metadata.guard; a content update that is clean now clears an old flag.
      if (warned.length > 0) args.metadata = { ...(args.metadata as object | undefined), guard: [...new Set(warned.map(hit => hit.rule))] }
      else if (name === 'memory_update' && typeof args.content === 'string') args.metadata = { ...(args.metadata as object | undefined), guard: null }
      if (action && message.id !== undefined) {
        pending.set(message.id, {
          action,
          text: callText(action, { ...args, tags: Array.isArray(tags) ? cleanTags(tags, { ...tagRulesNow(), max: settings.tags.maxPerMemory }) : undefined }),
          args: { ...args },
          ...(getInfo !== undefined ? { info: getInfo } : {}),
          ...(warned.length > 0 ? { warnings: warned.map(hit => `Mnemosyne guard warning: ${hit.message}`) } : {}),
        })
      }
      // memory_get's owner was checked above; the engine's get takes only the id.
      if (name === 'memory_get') delete args.owner
      message.params.name = engineTool(name)
      message.params.arguments = args
      if (name === 'memory_stats') statsIds.add(message.id)
      // R5: the ranking weights go on every recall call, as the plugin's own tool sends them.
      if (name === 'memory_recall') Object.assign(args, { vec_weight: settings.recall.vectorWeight, fts_weight: settings.recall.keywordWeight, importance_weight: settings.recall.importanceWeight })
      if (name === 'memory_remember') {
        // An outside client never sets how far its save is trusted: its own veracity and trust tier are dropped (the plugin's own trigger save is the only 'stated').
        delete args.veracity
        delete args.trust_tier
        delete args.expires_in_days
        message.params.arguments = {
          ...args,
          // C4: an outside agent's save, named by its client.
          source: `mcp:${client}`,
          trust_tier: 'EXTERNAL_WRITE',
          scope: args.scope === 'global' || isGlobalOwner ? 'global' : 'channel',
          // KNOWX.1.a3: an outside agent's save is an agent's, named by its client.
          author_id: client === 'unknown' ? 'unknown' : client,
          author_type: 'agent',
        }
      }
    }
    engine.stdin.write(`${JSON.stringify(message)}\n`)
  }
  engine.stdin.end()
})()

type Schema = { properties?: Record<string, unknown>; required?: string[] }

const GET_OWNER_PROPERTY = { type: 'string', description: "The row's owner from memory_recall (session_id); must be the row's own. Optional." }
// GET.1 and GET.2: memory_get's and memory_recall's texts, as the plugin's own tools say them.
const GET_DESCRIPTION =
  'Read one memory in full by the id memory_recall gave: its whole text, kind, tags, pinned, importance and timestamps. Use it when a recalled memory is cut (truncated: true, or ending in …). Reads this server\'s own memories and global ones.'
// The recall sentence names memory_get, so it is added only when memory_get is served (M2).
const getServed = (settings: ResolvedSettings) => (settings.tools.externalAllow as readonly string[]).includes('memory_get')
const publicDescription = (name: string, description: string | undefined, settings: ResolvedSettings) =>
  name === 'memory_get' ? GET_DESCRIPTION : name === 'memory_recall' && getServed(settings) ? `${description ?? 'Search memories.'} ${RECALL_DESCRIPTION_CUT}` : description

// What a client sees of a tool's input: no bank, no metadata; tags on remember and update; an owner on get.
function publicSchema(name: string, schema: Schema | undefined, settings: ResolvedSettings): Schema {
  // memory_type is the engine's name for kind: clients see kind only.
  const { bank: _bank, metadata: _metadata, memory_type: _memoryType, ...engineProperties } = schema?.properties ?? {}
  const properties = name === 'memory_get' ? { ...engineProperties, owner: GET_OWNER_PROPERTY } : engineProperties
  return {
    ...schema,
    properties: TAGGED.has(name) ? { ...properties, kind: KIND_PROPERTY, ...(name === 'memory_remember' ? { expires_in_days: expiresProperty(settings) } : {}), tags: tagsProperty(settings), confirm: CONFIRM_PROPERTY } : properties,
    // remember needs a kind, whatever the engine's own schema says.
    ...(schema?.required || name === 'memory_remember'
      ? { required: [...new Set([...(schema?.required ?? []).filter(key => key !== 'bank' && key !== 'metadata'), ...(name === 'memory_remember' ? ['kind'] : [])])] }
      : {}),
  }
}

// Engine to client: list only the allowed tools, under their public names.
for await (const line of lines(engine.stdout)) {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    process.stdout.write(`${line}\n`)
    continue
  }
  if (listIds.delete(message?.id) && Array.isArray(message.result?.tools)) {
    const settings = settingsNow()
    message.result.tools = message.result.tools
      .map((tool: { name: string; description?: string; inputSchema?: Schema }) => ({
        ...tool,
        name: publicTool(tool.name),
        description: publicDescription(publicTool(tool.name), tool.description?.replaceAll('Mnemopi', 'Mnemosyne'), settings),
        inputSchema: publicSchema(publicTool(tool.name), tool.inputSchema, settings),
      }))
      // M2: only the tools on the allow-list are listed (all six, by default).
      .filter((tool: { name: string }) => ALLOWED.has(tool.name) && (settings.tools.externalAllow as readonly string[]).includes(tool.name))
  }
  if (message?.result?.serverInfo?.name === 'mnemopi') message.result.serverInfo.name = 'mnemosyne'
  const text = message?.result?.content?.[0]
  const call = pending.get(message?.id)
  pending.delete(message?.id)
  if (statsIds.delete(message?.id) && typeof text?.text === 'string') text.text = mnemosyneStats(text.text)
  // GET.1: the engine's row as the plugin's memory_get shows it, with kind and scope from the store.
  if (call?.action === 'get' && typeof text?.text === 'string') text.text = mnemosyneGet(text.text, call.info)
  // GET.2: a recall row cut to its preview says so: truncated: true and a note naming the memory_get call.
  if (call?.action === 'recall' && typeof text?.text === 'string') {
    try {
      const reply = JSON.parse(text.text) as { results?: unknown }
      const served = getServed(settingsNow())
      if (Array.isArray(reply?.results) && reply.results.some(row => row !== null && typeof row === 'object' && isCut(row as Record<string, unknown>))) {
        reply.results = reply.results.map(row => {
          const r = row as Record<string, unknown>
          return r !== null && typeof r === 'object' && isCut(r) ? { ...r, truncated: true, ...(served ? { note: cutNote(r.id) } : {}) } : row
        })
        text.text = JSON.stringify(reply)
      }
    } catch {
      // not a JSON reply: left as it is
    }
  }
  const replyText = String(text?.text ?? '')
  const failure = message?.error?.message ?? (message?.result?.isError ? String(text?.text ?? 'failed') : undefined)
  // One warning line per hit, after the engine's reply.
  if (call?.warnings && failure === undefined && typeof text?.text === 'string') text.text = `${text.text}\n${call.warnings.join('\n')}`
  // OWNERHINT: a not_found update or forget of a memory another owner holds says whose it is.
  if ((call?.action === 'update' || call?.action === 'forget') && failure === undefined && typeof text?.text === 'string') {
    try {
      const reply = JSON.parse(text.text) as Record<string, unknown>
      if (reply?.status === 'not_found') {
        const holder = ownerOfMemory(storeDb, call.args.memory_id)
        if (holder !== undefined && holder !== owner) text.text = JSON.stringify({ ...reply, owner: holder, hint: otherOwnerHint(holder, owner) })
      }
    } catch {
      // not a JSON reply: left as it is
    }
  }
  send(message)
  if (call) {
    log(call, failure !== undefined ? { ok: false, error: failure } : callOutcome(call.action, call.args, replyText))
  }
}
// A call the engine never answered still gets its line before the proxy exits.
const exitCode = await engine.exited
for (const call of pending.values()) log(call, { ok: false, error: `engine exited ${exitCode} without a reply` })
process.exit(exitCode)

export {}
