// The externalMcp launcher: a script other MCP clients (Cursor, Codex, `claude
// mcp add`, Switch) start as a stdio server against one store. The plugin writes
// it at each session start (register.ts syncWrapper) and `install-engine.ts
// --root` writes it under a standalone root. This file imports nothing from
// claude-code, so a plain script can load it.
import { EMBEDDINGS_CACHE_DIR, EMBEDDINGS_MODEL } from './engine'

export type LauncherOptions = {
  store: string
  cli: string
  proxy: string
  // The activity log; empty when activityLog is off.
  activity: string
  embeddings: boolean
  guardMode: string
  vocabulary: string
  root: string
  // PI_CONFIG_DIR: relative to $HOME (the plugin's EMBEDDINGS_CACHE_DIR) or absolute.
  modelCacheDir: string
}

// Single-quoted for sh: the store path comes from settings and may hold anything.
export const shellQuote = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`

// The plugin's default PI_CONFIG_DIR is written bare, as 0.9.0 wrote it (its bytes
// stay the same); any other folder is quoted, since a --root may hold a space or a $.
const shCacheDir = (dir: string) => (dir === EMBEDDINGS_CACHE_DIR ? dir : shellQuote(dir))

export const WRAPPER_NOTE = `Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,
serving only remember / recall / update / forget / stats.
MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.
MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.
MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.
MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).
MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).`

export const shWrapper = ({ store, cli, proxy, activity, embeddings, guardMode, vocabulary, root, modelCacheDir }: LauncherOptions) => `#!/bin/sh
${WRAPPER_NOTE.replace(/^/gm, '# ')}
export MNEMOPI_DATA_DIR=${shellQuote(store)}
export MNEMOPI_SESSION_ID="\${MNEMOSYNE_OWNER:-global}"
export MNEMOPI_CHANNEL_ID="$MNEMOPI_SESSION_ID"
${embeddings ? 'unset MNEMOPI_NO_EMBEDDINGS' : 'export MNEMOPI_NO_EMBEDDINGS=1'}
export MNEMOPI_MCP_BANK=default
export MNEMOPI_LLM_BASE_URL=
export MNEMOPI_HOST_LLM_ENABLED=
export MNEMOPI_AUTHOR_ID=
export MNEMOPI_AUTHOR_TYPE=
export MNEMOPI_POLYPHONIC_RECALL=0
export MNEMOPI_EMBEDDING_API_URL=
export MNEMOPI_EMBEDDINGS_VIA_API=
export MNEMOPI_EMBEDDING_API_KEY=
export MNEMOPI_EMBEDDING_MODEL=${EMBEDDINGS_MODEL}
export MNEMOPI_EMBEDDING_DIM=
export OPENROUTER_BASE_URL=
export OPENROUTER_API_KEY=
export OPENAI_API_KEY=
export MNEMOPI_EMBEDDINGS_API_OPT_IN=0
export HF_ENDPOINT=https://huggingface.co
export PI_CONFIG_DIR=${shCacheDir(modelCacheDir)}
export MNEMOSYNE_CLI=${shellQuote(cli)}
export MNEMOSYNE_ACTIVITY_LOG=${activity ? shellQuote(activity) : ''}
export MNEMOSYNE_GUARD_MODE=${guardMode}
export MNEMOSYNE_VOCABULARY=${shellQuote(vocabulary)}
export MNEMOSYNE_ROOT=${shellQuote(root)}
exec bun ${shellQuote(proxy)}
`

// cmd has no safe quoting for " or %; callers refuse paths holding either.
// Lines are joined with an explicit \r\n, so the source file's own line endings never reach the .cmd.
export const cmdWrapper = ({ store, cli, proxy, activity, embeddings, guardMode, vocabulary, root, modelCacheDir }: LauncherOptions) =>
  `${[
    '@echo off',
    ...WRAPPER_NOTE.split('\n').map(line => `rem ${line}`),
    `set "MNEMOPI_DATA_DIR=${store}"`,
    'if not defined MNEMOSYNE_OWNER set "MNEMOSYNE_OWNER=global"',
    'set "MNEMOPI_SESSION_ID=%MNEMOSYNE_OWNER%"',
    'set "MNEMOPI_CHANNEL_ID=%MNEMOSYNE_OWNER%"',
    embeddings ? 'set "MNEMOPI_NO_EMBEDDINGS="' : 'set "MNEMOPI_NO_EMBEDDINGS=1"',
    'set "MNEMOPI_MCP_BANK=default"',
    'set "MNEMOPI_LLM_BASE_URL="',
    'set "MNEMOPI_HOST_LLM_ENABLED="',
    'set "MNEMOPI_AUTHOR_ID="',
    'set "MNEMOPI_AUTHOR_TYPE="',
    'set "MNEMOPI_POLYPHONIC_RECALL=0"',
    'set "MNEMOPI_EMBEDDING_API_URL="',
    'set "MNEMOPI_EMBEDDINGS_VIA_API="',
    'set "MNEMOPI_EMBEDDING_API_KEY="',
    `set "MNEMOPI_EMBEDDING_MODEL=${EMBEDDINGS_MODEL}"`,
    'set "MNEMOPI_EMBEDDING_DIM="',
    'set "OPENROUTER_BASE_URL="',
    'set "OPENROUTER_API_KEY="',
    'set "OPENAI_API_KEY="',
    'set "MNEMOPI_EMBEDDINGS_API_OPT_IN=0"',
    'set "HF_ENDPOINT=https://huggingface.co"',
    `set "PI_CONFIG_DIR=${modelCacheDir}"`,
    `set "MNEMOSYNE_CLI=${cli}"`,
    `set "MNEMOSYNE_ACTIVITY_LOG=${activity}"`,
    `set "MNEMOSYNE_GUARD_MODE=${guardMode}"`,
    `set "MNEMOSYNE_VOCABULARY=${vocabulary}"`,
    `set "MNEMOSYNE_ROOT=${root}"`,
    `bun "${proxy}"`,
  ].join('\r\n')}\r\n`
