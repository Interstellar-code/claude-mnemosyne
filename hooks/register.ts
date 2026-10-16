// Claude Mnemopi — the hooks module.
//
// THIS IS A SCAFFOLD. It registers nothing and touches nothing: no tools, no
// hooks, no file reads, no process spawns. It exists so the plugin loads
// cleanly under `claude plugin validate` and `claude plugin test`, proving the
// packaging before any behavior ships. See DESIGN.md for what the implementing
// version does and, more importantly, what it must not do.
//
// The shape it will grow into (kept here so the intent is not lost):
//
//   export function register(on: On, options: PluginOptions): void {
//     // Off by default. The whole feature sits behind one userConfig key, so a
//     // plugin install alone never starts writing a memory store.
//     if (options.memory !== true) return
//     // on('session.start', { cwd: /.*/ }, …)  registers memory_remember/recall/forget/stats
//     // on('prompt.context', …)                recalls into the conversation
//     // on('turn.complete', …)                 retains the finished turn
//   }
//
// Two registration rules learned the hard way, recorded in DESIGN.md §4: the
// engine rejects a SECOND bare `on('session.start')` or `on('tool.call')` across
// hook modules, so both need a matcher; and a standalone bun process panics on
// fastembed, so every call carries MNEMOPI_NO_EMBEDDINGS=1.
import type { On, PluginOptions } from 'claude-code'

export function register(_on: On, _options: PluginOptions): void {
  // no behavior in 0.0.1
}
