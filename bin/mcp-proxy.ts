// Claude Mnemosyne — stdio MCP proxy for other clients (userConfig externalMcp).
//
// Runs the engine and passes through only the plugin's own five tools, named
// memory_* as in the plugin (the engine calls them mnemopi_*). The
// engine's others leak across owners or lose data (DESIGN §5.6): sleep widens a
// project's facts to global, get reads any owner's row, export writes the whole
// store anywhere, shared_* rows are deleted after 24 hours.
//
// Remember is pinned the way the plugin writes it: `source: 'imported'`, the
// durable tier (any other source is deleted after 24 hours, DESIGN §5.2).
// A client never picks a bank (it would move writes to <store>/banks/<x>) and
// never writes metadata: only `tags`, cleaned by hooks/tags.ts, reach the
// engine, as metadata.tags. memory_update needs this plugin's engine build.
// Each call of the five tools is recorded in MNEMOSYNE_ACTIVITY_LOG (empty: off)
// as one activity line with origin external, written once its reply is read.
// Run by ~/.claude/mnemosyne/bin/mnemosyne-mcp, which sets the environment.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { activityLine, callOutcome, callText, TOOL_ACTIONS } from '../hooks/activity-log'
import type { ActivityAction } from '../hooks/activity-log'
import { ENGINE_BUILD } from '../hooks/engine-build'
import { engineTool, mnemosyneStats, publicTool } from '../hooks/surface'
import { cleanTags } from '../hooks/tags'
import { appendActivity } from './activity'

const ALLOWED = new Set(['memory_remember', 'memory_recall', 'memory_update', 'memory_forget', 'memory_stats'])
const TAGGED = new Set(['memory_remember', 'memory_update'])
const TAGS_PROPERTY = {
  type: 'array',
  items: { type: 'string' },
  description: 'Short lowercase topic tags, at most 5. On update they replace the old ones; [] removes them.',
}
const cli = process.env.MNEMOSYNE_CLI
if (!cli) throw new Error('MNEMOSYNE_CLI is not set: run this through mnemosyne-mcp.')
const owner = process.env.MNEMOPI_SESSION_ID || 'global'
const isGlobalOwner = owner === 'global'
const activityLog = process.env.MNEMOSYNE_ACTIVITY_LOG ?? ''
// The client's self-declared name, from its initialize request (CTX.2); unknown until it says.
let client = 'unknown'

// The installed engine's build, from <engine>/node_modules/@oh-my-pi/pi-mnemopi/package.json.
function installedBuild(cliPath: string) {
  try {
    return String(JSON.parse(readFileSync(join(dirname(cliPath), '..', 'package.json'), 'utf8')).version)
  } catch {
    return 'unknown'
  }
}
const build = installedBuild(cli)

const engine = Bun.spawn(['bun', cli, 'mcp'], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
const listIds = new Set<unknown>()
const statsIds = new Set<unknown>()
const send = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`)

// The calls on their way to the engine, by JSON-RPC id: what to log once the reply comes back.
type Pending = { action: ActivityAction; text: string; args: Record<string, unknown> }
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

// A refused call of one of the five tools: logged now, as the engine never sees it.
function refuse(id: unknown, action: ActivityAction | undefined, args: Record<string, unknown>, error: { code: number; message: string }) {
  send({ jsonrpc: '2.0', id, error })
  if (!action) return
  try {
    log({ action, text: callText(action, args), args }, { ok: false, error: error.message })
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
        const name = typeof info.name === 'string' ? info.name.trim() : ''
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
      // Tools outside the five are not memory calls and are not logged.
      const action = ALLOWED.has(name) ? TOOL_ACTIONS[name] : undefined
      if (!ALLOWED.has(name)) {
        refuse(message.id, undefined, given, { code: -32601, message: `Tool not available: ${name}` })
        continue
      }
      if (name === 'memory_update' && build !== ENGINE_BUILD) {
        const reason = `memory_update needs the Mnemosyne engine build ${ENGINE_BUILD}; installed is ${build}. Run /mnemosyne-setup in Claude Code.`
        refuse(message.id, action, given, { code: -32000, message: reason })
        continue
      }
      const { bank: _bank, metadata: _metadata, tags, ...args } = given
      if (TAGGED.has(name) && tags !== undefined) {
        if (!Array.isArray(tags)) {
          refuse(message.id, action, given, { code: -32602, message: 'tags must be an array of strings' })
          continue
        }
        const clean = cleanTags(tags)
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
      if (action && message.id !== undefined) pending.set(message.id, { action, text: callText(action, { ...args, tags: Array.isArray(tags) ? cleanTags(tags) : undefined }), args: { ...args } })
      message.params.name = engineTool(name)
      message.params.arguments = args
      if (name === 'memory_stats') statsIds.add(message.id)
      if (name === 'memory_remember') {
        message.params.arguments = {
          ...args,
          source: 'imported',
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

// What a client sees of a tool's input: no bank, no metadata; tags on remember and update.
function publicSchema(name: string, schema: Schema | undefined): Schema {
  const { bank: _bank, metadata: _metadata, ...properties } = schema?.properties ?? {}
  return {
    ...schema,
    properties: TAGGED.has(name) ? { ...properties, tags: TAGS_PROPERTY } : properties,
    ...(schema?.required ? { required: schema.required.filter(key => key !== 'bank' && key !== 'metadata') } : {}),
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
    message.result.tools = message.result.tools
      .map((tool: { name: string; description?: string; inputSchema?: Schema }) => ({
        ...tool,
        name: publicTool(tool.name),
        description: tool.description?.replaceAll('Mnemopi', 'Mnemosyne'),
        inputSchema: publicSchema(publicTool(tool.name), tool.inputSchema),
      }))
      .filter((tool: { name: string }) => ALLOWED.has(tool.name))
  }
  if (message?.result?.serverInfo?.name === 'mnemopi') message.result.serverInfo.name = 'mnemosyne'
  const text = message?.result?.content?.[0]
  const call = pending.get(message?.id)
  pending.delete(message?.id)
  if (statsIds.delete(message?.id) && typeof text?.text === 'string') text.text = mnemosyneStats(text.text)
  send(message)
  if (call) {
    const failure = message?.error?.message ?? (message?.result?.isError ? String(text?.text ?? 'failed') : undefined)
    log(call, failure !== undefined ? { ok: false, error: failure } : callOutcome(call.action, call.args, String(text?.text ?? '')))
  }
}
// A call the engine never answered still gets its line before the proxy exits.
const exitCode = await engine.exited
for (const call of pending.values()) log(call, { ok: false, error: `engine exited ${exitCode} without a reply` })
process.exit(exitCode)

export {}
