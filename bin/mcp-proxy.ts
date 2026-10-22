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
// Run by ~/.claude/mnemosyne/bin/mnemosyne-mcp, which sets the environment.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ENGINE_BUILD } from '../hooks/engine-build'
import { engineTool, mnemosyneStats, publicTool } from '../hooks/surface'
import { cleanTags } from '../hooks/tags'

const ALLOWED = new Set(['memory_remember', 'memory_recall', 'memory_update', 'memory_forget', 'memory_stats'])
const TAGGED = new Set(['memory_remember', 'memory_update'])
const TAGS_PROPERTY = {
  type: 'array',
  items: { type: 'string' },
  description: 'Short lowercase topic tags, at most 5. On update they replace the old ones; [] removes them.',
}
const cli = process.env.MNEMOSYNE_CLI
if (!cli) throw new Error('MNEMOSYNE_CLI is not set: run this through mnemosyne-mcp.')
const isGlobalOwner = (process.env.MNEMOPI_SESSION_ID ?? 'global') === 'global'

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
    if (message?.method === 'tools/list') listIds.add(message.id)
    if (message?.method === 'tools/call') {
      const name = message.params?.name
      if (!ALLOWED.has(name)) {
        send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Tool not available: ${name}` } })
        continue
      }
      if (name === 'memory_update' && build !== ENGINE_BUILD) {
        const reason = `memory_update needs the Mnemosyne engine build ${ENGINE_BUILD}; installed is ${build}. Run /mnemosyne-setup in Claude Code.`
        send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: reason } })
        continue
      }
      const raw = message.params.arguments
      const { bank: _bank, metadata: _metadata, tags, ...args } = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : ({} as Record<string, unknown>)
      if (TAGGED.has(name) && tags !== undefined) {
        if (!Array.isArray(tags)) {
          send({ jsonrpc: '2.0', id: message.id, error: { code: -32602, message: 'tags must be an array of strings' } })
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
      message.params.name = engineTool(name)
      message.params.arguments = args
      if (name === 'memory_stats') statsIds.add(message.id)
      if (name === 'memory_remember') {
        message.params.arguments = {
          ...args,
          source: 'imported',
          scope: args.scope === 'global' || isGlobalOwner ? 'global' : 'channel',
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
  if (statsIds.delete(message?.id) && typeof text?.text === 'string') text.text = mnemosyneStats(text.text)
  send(message)
}
process.exit(await engine.exited)

export {}
