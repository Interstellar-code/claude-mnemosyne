// Claude Mnemosyne — type declarations.

/** session id -> true once that session's first prompt has had its recall */
export type Recalled = Readonly<Record<string, true>>

declare module 'claude-code' {
  interface PluginState {
    mnemosyne: { recalled: Recalled }
  }
}
