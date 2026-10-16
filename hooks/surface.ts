// What a person or Claude sees of the engine: the engine's own names (Mnemopi)
// are renamed to Mnemosyne. Shared by the hooks module and the stdio proxy.

// The engine names stats with its provider, bank and a duplicate `stats` block.
// Keeps the counts, renames the provider; errors and text that is not JSON pass through.
export function mnemosyneStats(text: string) {
  try {
    const { status, working, episodic, memoria } = JSON.parse(text)
    if (status !== 'ok') return text
    return JSON.stringify({ status, provider: 'mnemosyne', working, episodic, memoria })
  } catch {
    return text
  }
}

// memory_remember <-> mnemopi_remember: the engine's tool name for ours.
export const engineTool = (name: string) => name.replace(/^memory_/, 'mnemopi_')
export const publicTool = (name: string) => name.replace(/^mnemopi_/, 'memory_')
