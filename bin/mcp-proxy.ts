// Claude Mnemosyne — stdio MCP proxy for other clients (userConfig externalMcp).
//
// Runs the engine and passes through only the plugin's own four tools. The
// engine's others leak across owners or lose data (DESIGN §5.6): sleep widens a
// project's facts to global, get reads any owner's row, export writes the whole
// store anywhere, shared_* rows are deleted after 24 hours.
//
// Remember is pinned the way the plugin writes it: `source: 'imported'`, the
// durable tier (any other source is deleted after 24 hours, DESIGN §5.2).
// Run by ~/.claude/mnemosyne/bin/mnemosyne-mcp, which sets the environment.
const ALLOWED = new Set(['mnemopi_remember', 'mnemopi_recall', 'mnemopi_forget', 'mnemopi_stats'])
const cli = process.env.MNEMOSYNE_CLI
if (!cli) throw new Error('MNEMOSYNE_CLI is not set: run this through mnemosyne-mcp.')
const isGlobalOwner = (process.env.MNEMOPI_SESSION_ID ?? 'global') === 'global'

const engine = Bun.spawn(['bun', cli, 'mcp'], { stdin: 'pipe', stdout: 'pipe', stderr: 'inherit' })
const listIds = new Set<unknown>()
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

// Client to engine: refuse other tools, pin remember's source and scope.
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
      if (name === 'mnemopi_remember') {
        const args = message.params.arguments ?? {}
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

// Engine to client: list only the allowed tools.
for await (const line of lines(engine.stdout)) {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    process.stdout.write(`${line}\n`)
    continue
  }
  if (listIds.delete(message?.id) && Array.isArray(message.result?.tools)) {
    message.result.tools = message.result.tools.filter((tool: { name: string }) => ALLOWED.has(tool.name))
  }
  send(message)
}
process.exit(await engine.exited)

export {}
