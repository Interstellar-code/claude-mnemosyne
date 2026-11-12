import { describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cmdWrapper, shellQuote, shWrapper } from '../../hooks/launcher'
import type { LauncherOptions } from '../../hooks/launcher'
import { EMBEDDINGS_CACHE_DIR } from '../../hooks/engine'
import { isolatedEnv } from './helpers'

// The launcher bytes the plugin wrote before the templates left hooks/register.ts
// (SA.1), captured once from register.ts over a stub host. Byte equality here
// proves the move changed nothing the plugin writes.
const BASE = {
  store: "/h/o'b/.claude/mnemosyne/store",
  cli: '/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts',
  proxy: '/p/plugin/bin/mcp-proxy.ts',
  activity: '/h/o/.claude/mnemosyne/activity.jsonl',
  vocabulary: '/h/o/.claude/mnemosyne/vocabulary.json',
  root: '/h/o/.claude/mnemosyne',
  modelCacheDir: EMBEDDINGS_CACHE_DIR,
}

const GOLDEN: Record<string, string> = {
  "sh-emb-strict-log": [
    "#!/bin/sh",
    "# Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "# serving only remember / recall / update / forget / stats / get.",
    "# MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "# MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "# MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "# MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "# MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "export MNEMOPI_DATA_DIR='/h/o'\\''b/.claude/mnemosyne/store'",
    "export MNEMOPI_SESSION_ID=\"${MNEMOSYNE_OWNER:-global}\"",
    "export MNEMOPI_CHANNEL_ID=\"$MNEMOPI_SESSION_ID\"",
    "export MNEMOPI_OWNER_PER_CALL=",
    "unset MNEMOPI_NO_EMBEDDINGS",
    "export MNEMOPI_MCP_BANK=default",
    "export MNEMOPI_LLM_BASE_URL=",
    "export MNEMOPI_HOST_LLM_ENABLED=",
    "export MNEMOPI_AUTHOR_ID=",
    "export MNEMOPI_AUTHOR_TYPE=",
    "export MNEMOPI_POLYPHONIC_RECALL=0",
    "export MNEMOPI_EMBEDDING_API_URL=",
    "export MNEMOPI_EMBEDDINGS_VIA_API=",
    "export MNEMOPI_EMBEDDING_API_KEY=",
    "export MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5",
    "export MNEMOPI_EMBEDDING_DIM=",
    "export OPENROUTER_BASE_URL=",
    "export OPENROUTER_API_KEY=",
    "export OPENAI_API_KEY=",
    "export MNEMOPI_EMBEDDINGS_API_OPT_IN=0",
    "export HF_ENDPOINT=https://huggingface.co",
    "export PI_CONFIG_DIR=.claude/mnemosyne/model-cache",
    "export MNEMOSYNE_CLI='/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts'",
    "export MNEMOSYNE_ACTIVITY_LOG='/h/o/.claude/mnemosyne/activity.jsonl'",
    "export MNEMOSYNE_GUARD_MODE=strict",
    "export MNEMOSYNE_VOCABULARY='/h/o/.claude/mnemosyne/vocabulary.json'",
    "export MNEMOSYNE_ROOT='/h/o/.claude/mnemosyne'",
    "exec bun '/p/plugin/bin/mcp-proxy.ts'",
  ].join("\n") + "\n",
  "sh-emb-warn-log": [
    "#!/bin/sh",
    "# Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "# serving only remember / recall / update / forget / stats / get.",
    "# MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "# MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "# MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "# MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "# MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "export MNEMOPI_DATA_DIR='/h/o'\\''b/.claude/mnemosyne/store'",
    "export MNEMOPI_SESSION_ID=\"${MNEMOSYNE_OWNER:-global}\"",
    "export MNEMOPI_CHANNEL_ID=\"$MNEMOPI_SESSION_ID\"",
    "export MNEMOPI_OWNER_PER_CALL=",
    "unset MNEMOPI_NO_EMBEDDINGS",
    "export MNEMOPI_MCP_BANK=default",
    "export MNEMOPI_LLM_BASE_URL=",
    "export MNEMOPI_HOST_LLM_ENABLED=",
    "export MNEMOPI_AUTHOR_ID=",
    "export MNEMOPI_AUTHOR_TYPE=",
    "export MNEMOPI_POLYPHONIC_RECALL=0",
    "export MNEMOPI_EMBEDDING_API_URL=",
    "export MNEMOPI_EMBEDDINGS_VIA_API=",
    "export MNEMOPI_EMBEDDING_API_KEY=",
    "export MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5",
    "export MNEMOPI_EMBEDDING_DIM=",
    "export OPENROUTER_BASE_URL=",
    "export OPENROUTER_API_KEY=",
    "export OPENAI_API_KEY=",
    "export MNEMOPI_EMBEDDINGS_API_OPT_IN=0",
    "export HF_ENDPOINT=https://huggingface.co",
    "export PI_CONFIG_DIR=.claude/mnemosyne/model-cache",
    "export MNEMOSYNE_CLI='/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts'",
    "export MNEMOSYNE_ACTIVITY_LOG='/h/o/.claude/mnemosyne/activity.jsonl'",
    "export MNEMOSYNE_GUARD_MODE=warn",
    "export MNEMOSYNE_VOCABULARY='/h/o/.claude/mnemosyne/vocabulary.json'",
    "export MNEMOSYNE_ROOT='/h/o/.claude/mnemosyne'",
    "exec bun '/p/plugin/bin/mcp-proxy.ts'",
  ].join("\n") + "\n",
  "sh-noemb-strict-log": [
    "#!/bin/sh",
    "# Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "# serving only remember / recall / update / forget / stats / get.",
    "# MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "# MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "# MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "# MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "# MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "export MNEMOPI_DATA_DIR='/h/o'\\''b/.claude/mnemosyne/store'",
    "export MNEMOPI_SESSION_ID=\"${MNEMOSYNE_OWNER:-global}\"",
    "export MNEMOPI_CHANNEL_ID=\"$MNEMOPI_SESSION_ID\"",
    "export MNEMOPI_OWNER_PER_CALL=",
    "export MNEMOPI_NO_EMBEDDINGS=1",
    "export MNEMOPI_MCP_BANK=default",
    "export MNEMOPI_LLM_BASE_URL=",
    "export MNEMOPI_HOST_LLM_ENABLED=",
    "export MNEMOPI_AUTHOR_ID=",
    "export MNEMOPI_AUTHOR_TYPE=",
    "export MNEMOPI_POLYPHONIC_RECALL=0",
    "export MNEMOPI_EMBEDDING_API_URL=",
    "export MNEMOPI_EMBEDDINGS_VIA_API=",
    "export MNEMOPI_EMBEDDING_API_KEY=",
    "export MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5",
    "export MNEMOPI_EMBEDDING_DIM=",
    "export OPENROUTER_BASE_URL=",
    "export OPENROUTER_API_KEY=",
    "export OPENAI_API_KEY=",
    "export MNEMOPI_EMBEDDINGS_API_OPT_IN=0",
    "export HF_ENDPOINT=https://huggingface.co",
    "export PI_CONFIG_DIR=.claude/mnemosyne/model-cache",
    "export MNEMOSYNE_CLI='/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts'",
    "export MNEMOSYNE_ACTIVITY_LOG='/h/o/.claude/mnemosyne/activity.jsonl'",
    "export MNEMOSYNE_GUARD_MODE=strict",
    "export MNEMOSYNE_VOCABULARY='/h/o/.claude/mnemosyne/vocabulary.json'",
    "export MNEMOSYNE_ROOT='/h/o/.claude/mnemosyne'",
    "exec bun '/p/plugin/bin/mcp-proxy.ts'",
  ].join("\n") + "\n",
  "sh-noemb-warn-log": [
    "#!/bin/sh",
    "# Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "# serving only remember / recall / update / forget / stats / get.",
    "# MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "# MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "# MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "# MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "# MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "export MNEMOPI_DATA_DIR='/h/o'\\''b/.claude/mnemosyne/store'",
    "export MNEMOPI_SESSION_ID=\"${MNEMOSYNE_OWNER:-global}\"",
    "export MNEMOPI_CHANNEL_ID=\"$MNEMOPI_SESSION_ID\"",
    "export MNEMOPI_OWNER_PER_CALL=",
    "export MNEMOPI_NO_EMBEDDINGS=1",
    "export MNEMOPI_MCP_BANK=default",
    "export MNEMOPI_LLM_BASE_URL=",
    "export MNEMOPI_HOST_LLM_ENABLED=",
    "export MNEMOPI_AUTHOR_ID=",
    "export MNEMOPI_AUTHOR_TYPE=",
    "export MNEMOPI_POLYPHONIC_RECALL=0",
    "export MNEMOPI_EMBEDDING_API_URL=",
    "export MNEMOPI_EMBEDDINGS_VIA_API=",
    "export MNEMOPI_EMBEDDING_API_KEY=",
    "export MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5",
    "export MNEMOPI_EMBEDDING_DIM=",
    "export OPENROUTER_BASE_URL=",
    "export OPENROUTER_API_KEY=",
    "export OPENAI_API_KEY=",
    "export MNEMOPI_EMBEDDINGS_API_OPT_IN=0",
    "export HF_ENDPOINT=https://huggingface.co",
    "export PI_CONFIG_DIR=.claude/mnemosyne/model-cache",
    "export MNEMOSYNE_CLI='/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts'",
    "export MNEMOSYNE_ACTIVITY_LOG='/h/o/.claude/mnemosyne/activity.jsonl'",
    "export MNEMOSYNE_GUARD_MODE=warn",
    "export MNEMOSYNE_VOCABULARY='/h/o/.claude/mnemosyne/vocabulary.json'",
    "export MNEMOSYNE_ROOT='/h/o/.claude/mnemosyne'",
    "exec bun '/p/plugin/bin/mcp-proxy.ts'",
  ].join("\n") + "\n",
  "sh-noemb-warn-nolog": [
    "#!/bin/sh",
    "# Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "# serving only remember / recall / update / forget / stats / get.",
    "# MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "# MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "# MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "# MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "# MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "export MNEMOPI_DATA_DIR='/h/o'\\''b/.claude/mnemosyne/store'",
    "export MNEMOPI_SESSION_ID=\"${MNEMOSYNE_OWNER:-global}\"",
    "export MNEMOPI_CHANNEL_ID=\"$MNEMOPI_SESSION_ID\"",
    "export MNEMOPI_OWNER_PER_CALL=",
    "export MNEMOPI_NO_EMBEDDINGS=1",
    "export MNEMOPI_MCP_BANK=default",
    "export MNEMOPI_LLM_BASE_URL=",
    "export MNEMOPI_HOST_LLM_ENABLED=",
    "export MNEMOPI_AUTHOR_ID=",
    "export MNEMOPI_AUTHOR_TYPE=",
    "export MNEMOPI_POLYPHONIC_RECALL=0",
    "export MNEMOPI_EMBEDDING_API_URL=",
    "export MNEMOPI_EMBEDDINGS_VIA_API=",
    "export MNEMOPI_EMBEDDING_API_KEY=",
    "export MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5",
    "export MNEMOPI_EMBEDDING_DIM=",
    "export OPENROUTER_BASE_URL=",
    "export OPENROUTER_API_KEY=",
    "export OPENAI_API_KEY=",
    "export MNEMOPI_EMBEDDINGS_API_OPT_IN=0",
    "export HF_ENDPOINT=https://huggingface.co",
    "export PI_CONFIG_DIR=.claude/mnemosyne/model-cache",
    "export MNEMOSYNE_CLI='/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts'",
    "export MNEMOSYNE_ACTIVITY_LOG=",
    "export MNEMOSYNE_GUARD_MODE=warn",
    "export MNEMOSYNE_VOCABULARY='/h/o/.claude/mnemosyne/vocabulary.json'",
    "export MNEMOSYNE_ROOT='/h/o/.claude/mnemosyne'",
    "exec bun '/p/plugin/bin/mcp-proxy.ts'",
  ].join("\n") + "\n",
  "cmd-emb-strict-log": [
    "@echo off",
    "rem Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "rem serving only remember / recall / update / forget / stats / get.",
    "rem MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "rem MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "rem MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "rem MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "rem MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "set \"MNEMOPI_DATA_DIR=/h/o'b/.claude/mnemosyne/store\"",
    "if not defined MNEMOSYNE_OWNER set \"MNEMOSYNE_OWNER=global\"",
    "set \"MNEMOPI_SESSION_ID=%MNEMOSYNE_OWNER%\"",
    "set \"MNEMOPI_CHANNEL_ID=%MNEMOSYNE_OWNER%\"",
    "set \"MNEMOPI_OWNER_PER_CALL=\"",
    "set \"MNEMOPI_NO_EMBEDDINGS=\"",
    "set \"MNEMOPI_MCP_BANK=default\"",
    "set \"MNEMOPI_LLM_BASE_URL=\"",
    "set \"MNEMOPI_HOST_LLM_ENABLED=\"",
    "set \"MNEMOPI_AUTHOR_ID=\"",
    "set \"MNEMOPI_AUTHOR_TYPE=\"",
    "set \"MNEMOPI_POLYPHONIC_RECALL=0\"",
    "set \"MNEMOPI_EMBEDDING_API_URL=\"",
    "set \"MNEMOPI_EMBEDDINGS_VIA_API=\"",
    "set \"MNEMOPI_EMBEDDING_API_KEY=\"",
    "set \"MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5\"",
    "set \"MNEMOPI_EMBEDDING_DIM=\"",
    "set \"OPENROUTER_BASE_URL=\"",
    "set \"OPENROUTER_API_KEY=\"",
    "set \"OPENAI_API_KEY=\"",
    "set \"MNEMOPI_EMBEDDINGS_API_OPT_IN=0\"",
    "set \"HF_ENDPOINT=https://huggingface.co\"",
    "set \"PI_CONFIG_DIR=.claude/mnemosyne/model-cache\"",
    "set \"MNEMOSYNE_CLI=/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts\"",
    "set \"MNEMOSYNE_ACTIVITY_LOG=/h/o/.claude/mnemosyne/activity.jsonl\"",
    "set \"MNEMOSYNE_GUARD_MODE=strict\"",
    "set \"MNEMOSYNE_VOCABULARY=/h/o/.claude/mnemosyne/vocabulary.json\"",
    "set \"MNEMOSYNE_ROOT=/h/o/.claude/mnemosyne\"",
    "bun \"/p/plugin/bin/mcp-proxy.ts\"",
  ].join("\r\n") + "\r\n",
  "cmd-emb-warn-log": [
    "@echo off",
    "rem Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "rem serving only remember / recall / update / forget / stats / get.",
    "rem MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "rem MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "rem MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "rem MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "rem MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "set \"MNEMOPI_DATA_DIR=/h/o'b/.claude/mnemosyne/store\"",
    "if not defined MNEMOSYNE_OWNER set \"MNEMOSYNE_OWNER=global\"",
    "set \"MNEMOPI_SESSION_ID=%MNEMOSYNE_OWNER%\"",
    "set \"MNEMOPI_CHANNEL_ID=%MNEMOSYNE_OWNER%\"",
    "set \"MNEMOPI_OWNER_PER_CALL=\"",
    "set \"MNEMOPI_NO_EMBEDDINGS=\"",
    "set \"MNEMOPI_MCP_BANK=default\"",
    "set \"MNEMOPI_LLM_BASE_URL=\"",
    "set \"MNEMOPI_HOST_LLM_ENABLED=\"",
    "set \"MNEMOPI_AUTHOR_ID=\"",
    "set \"MNEMOPI_AUTHOR_TYPE=\"",
    "set \"MNEMOPI_POLYPHONIC_RECALL=0\"",
    "set \"MNEMOPI_EMBEDDING_API_URL=\"",
    "set \"MNEMOPI_EMBEDDINGS_VIA_API=\"",
    "set \"MNEMOPI_EMBEDDING_API_KEY=\"",
    "set \"MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5\"",
    "set \"MNEMOPI_EMBEDDING_DIM=\"",
    "set \"OPENROUTER_BASE_URL=\"",
    "set \"OPENROUTER_API_KEY=\"",
    "set \"OPENAI_API_KEY=\"",
    "set \"MNEMOPI_EMBEDDINGS_API_OPT_IN=0\"",
    "set \"HF_ENDPOINT=https://huggingface.co\"",
    "set \"PI_CONFIG_DIR=.claude/mnemosyne/model-cache\"",
    "set \"MNEMOSYNE_CLI=/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts\"",
    "set \"MNEMOSYNE_ACTIVITY_LOG=/h/o/.claude/mnemosyne/activity.jsonl\"",
    "set \"MNEMOSYNE_GUARD_MODE=warn\"",
    "set \"MNEMOSYNE_VOCABULARY=/h/o/.claude/mnemosyne/vocabulary.json\"",
    "set \"MNEMOSYNE_ROOT=/h/o/.claude/mnemosyne\"",
    "bun \"/p/plugin/bin/mcp-proxy.ts\"",
  ].join("\r\n") + "\r\n",
  "cmd-noemb-strict-log": [
    "@echo off",
    "rem Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "rem serving only remember / recall / update / forget / stats / get.",
    "rem MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "rem MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "rem MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "rem MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "rem MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "set \"MNEMOPI_DATA_DIR=/h/o'b/.claude/mnemosyne/store\"",
    "if not defined MNEMOSYNE_OWNER set \"MNEMOSYNE_OWNER=global\"",
    "set \"MNEMOPI_SESSION_ID=%MNEMOSYNE_OWNER%\"",
    "set \"MNEMOPI_CHANNEL_ID=%MNEMOSYNE_OWNER%\"",
    "set \"MNEMOPI_OWNER_PER_CALL=\"",
    "set \"MNEMOPI_NO_EMBEDDINGS=1\"",
    "set \"MNEMOPI_MCP_BANK=default\"",
    "set \"MNEMOPI_LLM_BASE_URL=\"",
    "set \"MNEMOPI_HOST_LLM_ENABLED=\"",
    "set \"MNEMOPI_AUTHOR_ID=\"",
    "set \"MNEMOPI_AUTHOR_TYPE=\"",
    "set \"MNEMOPI_POLYPHONIC_RECALL=0\"",
    "set \"MNEMOPI_EMBEDDING_API_URL=\"",
    "set \"MNEMOPI_EMBEDDINGS_VIA_API=\"",
    "set \"MNEMOPI_EMBEDDING_API_KEY=\"",
    "set \"MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5\"",
    "set \"MNEMOPI_EMBEDDING_DIM=\"",
    "set \"OPENROUTER_BASE_URL=\"",
    "set \"OPENROUTER_API_KEY=\"",
    "set \"OPENAI_API_KEY=\"",
    "set \"MNEMOPI_EMBEDDINGS_API_OPT_IN=0\"",
    "set \"HF_ENDPOINT=https://huggingface.co\"",
    "set \"PI_CONFIG_DIR=.claude/mnemosyne/model-cache\"",
    "set \"MNEMOSYNE_CLI=/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts\"",
    "set \"MNEMOSYNE_ACTIVITY_LOG=/h/o/.claude/mnemosyne/activity.jsonl\"",
    "set \"MNEMOSYNE_GUARD_MODE=strict\"",
    "set \"MNEMOSYNE_VOCABULARY=/h/o/.claude/mnemosyne/vocabulary.json\"",
    "set \"MNEMOSYNE_ROOT=/h/o/.claude/mnemosyne\"",
    "bun \"/p/plugin/bin/mcp-proxy.ts\"",
  ].join("\r\n") + "\r\n",
  "cmd-noemb-warn-log": [
    "@echo off",
    "rem Written by the Mnemosyne plugin (externalMcp). A stdio MCP server over its store,",
    "rem serving only remember / recall / update / forget / stats / get.",
    "rem MNEMOSYNE_OWNER picks the owner: global (default) or a project-... id.",
    "rem MNEMOSYNE_ACTIVITY_LOG is the activity log each call is recorded in; empty when activityLog is off.",
    "rem MNEMOSYNE_GUARD_MODE is the guardMode option: strict refuses a warned save unless the call passes confirm: true, warn saves it.",
    "rem MNEMOSYNE_VOCABULARY is the tag vocabulary file its tags are cleaned with (aliases folded).",
    "rem MNEMOSYNE_ROOT is the folder holding config.json, the settings it reads at each call (guard limits, tag count, tools served).",
    "set \"MNEMOPI_DATA_DIR=/h/o'b/.claude/mnemosyne/store\"",
    "if not defined MNEMOSYNE_OWNER set \"MNEMOSYNE_OWNER=global\"",
    "set \"MNEMOPI_SESSION_ID=%MNEMOSYNE_OWNER%\"",
    "set \"MNEMOPI_CHANNEL_ID=%MNEMOSYNE_OWNER%\"",
    "set \"MNEMOPI_OWNER_PER_CALL=\"",
    "set \"MNEMOPI_NO_EMBEDDINGS=1\"",
    "set \"MNEMOPI_MCP_BANK=default\"",
    "set \"MNEMOPI_LLM_BASE_URL=\"",
    "set \"MNEMOPI_HOST_LLM_ENABLED=\"",
    "set \"MNEMOPI_AUTHOR_ID=\"",
    "set \"MNEMOPI_AUTHOR_TYPE=\"",
    "set \"MNEMOPI_POLYPHONIC_RECALL=0\"",
    "set \"MNEMOPI_EMBEDDING_API_URL=\"",
    "set \"MNEMOPI_EMBEDDINGS_VIA_API=\"",
    "set \"MNEMOPI_EMBEDDING_API_KEY=\"",
    "set \"MNEMOPI_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5\"",
    "set \"MNEMOPI_EMBEDDING_DIM=\"",
    "set \"OPENROUTER_BASE_URL=\"",
    "set \"OPENROUTER_API_KEY=\"",
    "set \"OPENAI_API_KEY=\"",
    "set \"MNEMOPI_EMBEDDINGS_API_OPT_IN=0\"",
    "set \"HF_ENDPOINT=https://huggingface.co\"",
    "set \"PI_CONFIG_DIR=.claude/mnemosyne/model-cache\"",
    "set \"MNEMOSYNE_CLI=/h/o/.claude/mnemosyne/engine/node_modules/@oh-my-pi/pi-mnemopi/src/cli.ts\"",
    "set \"MNEMOSYNE_ACTIVITY_LOG=/h/o/.claude/mnemosyne/activity.jsonl\"",
    "set \"MNEMOSYNE_GUARD_MODE=warn\"",
    "set \"MNEMOSYNE_VOCABULARY=/h/o/.claude/mnemosyne/vocabulary.json\"",
    "set \"MNEMOSYNE_ROOT=/h/o/.claude/mnemosyne\"",
    "bun \"/p/plugin/bin/mcp-proxy.ts\"",
  ].join("\r\n") + "\r\n",
}

const CASES = [
  { key: 'emb-strict-log', embeddings: true, guardMode: 'strict', activity: BASE.activity },
  { key: 'emb-warn-log', embeddings: true, guardMode: 'warn', activity: BASE.activity },
  { key: 'noemb-strict-log', embeddings: false, guardMode: 'strict', activity: BASE.activity },
  { key: 'noemb-warn-log', embeddings: false, guardMode: 'warn', activity: BASE.activity },
]
const options = (c: { embeddings: boolean; guardMode: string; activity: string }): LauncherOptions => ({ ...BASE, ...c })

// Every variable the launcher blanks or pins so an inherited one cannot route memory text out (C1, C1b).
const BLANKED = [
  'MNEMOPI_EMBEDDING_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENAI_API_KEY',
  'MNEMOPI_EMBEDDING_API_URL',
  'MNEMOPI_EMBEDDINGS_VIA_API',
  'MNEMOPI_EMBEDDING_DIM',
  'OPENROUTER_BASE_URL',
  'MNEMOPI_LLM_BASE_URL',
  'MNEMOPI_HOST_LLM_ENABLED',
  'MNEMOPI_AUTHOR_ID',
  'MNEMOPI_AUTHOR_TYPE',
]

describe('launcher templates match the pre-move plugin output (SA.1)', () => {
  for (const c of CASES) {
    test(`sh ${c.key}`, () => expect(shWrapper(options(c))).toBe(GOLDEN[`sh-${c.key}`]!))
    test(`cmd ${c.key}`, () => expect(cmdWrapper(options(c))).toBe(GOLDEN[`cmd-${c.key}`]!))
  }
  test('sh with the activity log off', () => {
    expect(shWrapper(options({ embeddings: false, guardMode: 'warn', activity: '' }))).toBe(GOLDEN['sh-noemb-warn-nolog']!)
  })

  test('cmd lines end in exactly one \\r\\n, whatever the source file uses', () => {
    for (const c of CASES) {
      const text = cmdWrapper(options(c))
      expect(text).not.toMatch(/\r\r\n/)
      expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
      expect(text.endsWith('\r\n')).toBe(true)
    }
  })

  test('both launchers set every API and author variable blank, and pin the opt-in to 0', () => {
    for (const c of CASES) {
      const sh = shWrapper(options(c)).split('\n')
      const cmd = cmdWrapper(options(c)).split('\r\n')
      for (const name of BLANKED) {
        expect(sh).toContain(`export ${name}=`)
        expect(cmd).toContain(`set "${name}="`)
      }
      expect(sh).toContain('export MNEMOPI_EMBEDDINGS_API_OPT_IN=0')
      expect(cmd).toContain('set "MNEMOPI_EMBEDDINGS_API_OPT_IN=0"')
    }
  })

  test('modelCacheDir sets PI_CONFIG_DIR, absolute or relative', () => {
    const abs = { ...options(CASES[0]!), modelCacheDir: '/s/memory/model-cache' }
    expect(shWrapper(abs)).toContain(`\nexport PI_CONFIG_DIR='/s/memory/model-cache'\n`)
    expect(cmdWrapper(abs)).toContain('\r\nset "PI_CONFIG_DIR=/s/memory/model-cache"\r\n')
    expect(shWrapper(options(CASES[0]!))).toContain(`\nexport PI_CONFIG_DIR=${EMBEDDINGS_CACHE_DIR}\n`)
  })

  test('sh: a cache folder with a space, a $ and $( ) reaches PI_CONFIG_DIR exactly and runs nothing', () => {
    const work = mkdtempSync(join(tmpdir(), 'mnemosyne-launcher-'))
    try {
      for (const dir of [`${work}/my memory/model-cache`, `${work}/$HOME/$(touch pwned)/model-cache`, `${work}/it's \`touch pwned\`/cache`]) {
        // The launcher up to its exec line, then print what sh exported.
        const text = shWrapper({ ...options(CASES[0]!), modelCacheDir: dir }).replace(/^exec bun .*$/m, 'printf %s "$PI_CONFIG_DIR"')
        const ran = Bun.spawnSync(['sh', '-c', text], { cwd: work, env: { ...(process.env as Record<string, string>), ...isolatedEnv('launcher-sh') }, stdout: 'pipe', stderr: 'pipe' })
        expect([dir, ran.exitCode, ran.stdout.toString()]).toEqual([dir, 0, dir])
        expect(existsSync(join(work, 'pwned'))).toBe(false)
      }
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  })

  test('the plugin default PI_CONFIG_DIR stays bare (0.9.0 bytes), any other folder is quoted', () => {
    expect(shWrapper(options(CASES[0]!))).toContain(`\nexport PI_CONFIG_DIR=${EMBEDDINGS_CACHE_DIR}\n`)
    expect(shWrapper({ ...options(CASES[0]!), modelCacheDir: '/a b/c' })).toContain(`\nexport PI_CONFIG_DIR='/a b/c'\n`)
  })

  test('shellQuote survives a single quote', () => {
    expect(shellQuote("a'b")).toBe(`'a'\\''b'`)
  })
})
