# Claude Mnemosyne

Long-term memory for Claude Code. A fact you save in one session is there in the next one, in any repo.

![How memory flows](docs/architecture.png)

## Install

You need [Bun](https://bun.sh) on your `PATH`. At the prompt of a Claude Code session:

```
/plugin install mnemosyne --marketplace Interstellar-code/claude-mnemosyne
```

Or from a shell:

```sh
claude plugin install mnemosyne --marketplace Interstellar-code/claude-mnemosyne
```

Answer `y` to add the marketplace, then pick a scope (user scope for every project). The install then asks for the settings below; leave the empty ones empty. Claude Code's install screen shows values only for the scope picker and the on/off switch, so `/mnemosyne-setup` saves the defaults into any empty setting, and after a restart `/plugin` → Mnemosyne → configure shows them, ready to edit.

Works on macOS, Linux and Windows. On Windows, `~` means `%USERPROFILE%`.

> The marketplace install has not been tested end to end yet. Every test so far loaded the plugin from a checkout (`claude --plugin-dir <repo>`). If the install fails, use that instead and [open an issue](https://github.com/Interstellar-code/claude-mnemosyne/issues).

## Update

```sh
claude plugin update mnemosyne@mnemosyne
```

Restart Claude Code afterwards. The engine version is pinned; updating the plugin does not update the engine.

## Uninstall

```sh
claude plugin uninstall mnemosyne@mnemosyne
```

This leaves the engine and your memories in `~/.claude/mnemosyne/`. To delete them too (this erases every memory, permanently):

```sh
rm -rf ~/.claude/mnemosyne
```

## Setup

In a Claude Code session, run once:

```
/mnemosyne-setup
```

This installs the Mnemosyne Memory engine into `~/.claude/mnemosyne/engine/` (about 130 MB) and creates the store at `~/.claude/mnemosyne/store/`.

## Use

| You type | What happens |
|---|---|
| `remember that we deploy on Fridays` | Claude saves the fact. |
| `what do you remember about deploys?` | Matching memories are looked up and shown to Claude. |
| the first prompt of a session, and the first after a compaction | Memories matching it are looked up automatically. |
| `forget the memory about deploys` | Claude finds it and deletes it. |

Claude also saves and recalls on its own: lasting preferences, conventions, decisions. To change a fact, ask Claude to forget the old one and remember the new one.

Recall matches words, not meaning: "deploy Fridays" finds the fact above, "release schedule" does not.

## Settings

Change any time from `/plugin` → Mnemosyne → configure.

| Setting | Default | What it does |
|---|---|---|
| `scope` | `global` | `global`: one memory for every repo. `per-project`: each repo keeps its own; ask for "global" to share a fact. |
| `rememberTerms` | `remember:`, `remember that`, `note that`, `save to memory` | A prompt that starts with one of these is saved. `none` turns it off. |
| `recallTerms` | `recall:`, `what do you remember about`, `check memory` | A prompt that starts with one of these looks up memories. `none` turns it off. |
| `showActivity` | `on` | `on`: a dim line in the conversation when Mnemosyne recalls, plus a status line under the prompt. `status`: the status line only. `off`: silent. |
| `memoryDir` | `~/.claude/mnemosyne/store` | Where memories are stored. |
| `externalMcp` | off | Lets other MCP clients use the same memory (see below). |

## Use the memory from other tools

Turn on `externalMcp`, start a new session, and the plugin writes `~/.claude/mnemosyne/bin/mnemosyne-mcp`: the engine as a stdio MCP server, with the right store and settings baked in. Add it to any MCP client:

```sh
claude mcp add mnemosyne-memory -- ~/.claude/mnemosyne/bin/mnemosyne-mcp
```

On Windows the file is `%USERPROFILE%\.claude\mnemosyne\bin\mnemosyne-mcp.cmd`.

For Cursor, Codex and others, use the same path as the server command. It offers the same four tools as the plugin (`memory_remember`, `memory_recall`, `memory_forget`, `memory_stats`) and nothing else of the engine's. It reads and writes `global` memories by default; set `MNEMOSYNE_OWNER` to a `project-…` owner to use a project's. Turning the option off deletes the file.

**Security.** There is no token because there is no network port: the client starts the server itself over stdin/stdout, and nothing listens on the network. Access is whoever can run programs as your user, the same people who could read the database file directly. To keep other accounts on the machine out, the plugin sets `~/.claude/mnemosyne` and the store to owner-only (`700`) on macOS and Linux; on Windows your user profile's permissions already do. Don't wrap the server in an HTTP bridge without adding authentication there.

## How it works

The plugin hooks into Claude Code at four points:

- **Session start:** adds the memory tools and `/mnemosyne-setup`.
- **System prompt:** adds a short, fixed set of rules telling Claude when to save and recall.
- **Your prompt:** on the first prompt (again after a compaction), or one starting with a term above, looks up memories and attaches them to that prompt.
- **Tool calls:** when Claude calls a memory tool, runs the engine once and returns the answer.

Mnemosyne shows a dim line in the conversation when it recalls and a status line under the prompt; `showActivity` quiets them.

Where an organization manages Claude Code, the system-prompt rules are skipped unless the organization lists this plugin in its managed settings; the tools and trigger terms still work.

Memories live in a local SQLite file. Mnemosyne runs on its own private copy of the Mnemosyne Memory engine. Design notes: [DESIGN.md](DESIGN.md).

## License

MIT
