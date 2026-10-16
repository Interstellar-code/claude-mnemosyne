// Claude Mnemosyne — type declarations.
//
// The mods reference says this file is required when a mod uses `$.state` or
// adds a namespace to the mods API. This scaffold does neither, so the file
// declares nothing today; it exists so the manifest's `types` path resolves and
// so the shape the implementation will need is written down where a reader
// looks for it.
//
// The implementing version stores its recall cache here — the block injected on
// the first prompt of a conversation, keyed by conversation id, so a re-render
// does not recompute it. Declaring it now would add a state key with no writer,
// so it stays commented until there is one.
//
// declare module 'claude-code' {
//   interface PluginState {
//     mnemopi: {
//       /** conversation id -> the recall text injected at its start */
//       recallBlock: Readonly<Record<string, string>>
//       /** memory ids this session retained, so a stop hook can report them */
//       retained: readonly string[]
//     }
//   }
// }
