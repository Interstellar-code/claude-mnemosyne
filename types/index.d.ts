// Claude Mnemosyne — type declarations.

/** session id -> true once that session's first prompt has had its recall */
export type Recalled = Readonly<Record<string, true>>

/** session id -> true while the turn's remember trigger awaits its first main-thread save */
export type PendingTrigger = Readonly<Record<string, true>>

declare module 'claude-code' {
  interface PluginState {
    mnemosyne: { recalled: Recalled; pendingTrigger: PendingTrigger }
  }
}
