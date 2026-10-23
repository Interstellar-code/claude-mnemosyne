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

Restart Claude Code afterwards. The plugin carries its own copy of the engine; when an update brings a new engine build, session start shows a notice, and `/mnemosyne-setup` installs it. Until then the older engine keeps working, and only `memory_update` asks for the setup.

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

This installs the Mnemosyne Memory engine into `~/.claude/mnemosyne/engine/` (about 135 MB) and creates the store at `~/.claude/mnemosyne/store/`. The engine comes from the plugin's own copy (the `engine/` folder of this repo: the `@oh-my-pi/pi-mnemopi` 18.12.3 source with a few changes, listed in [engine/UPSTREAM.md](engine/UPSTREAM.md)); only its four `@oh-my-pi` dependencies are downloaded from npm. Setup builds the new engine next to the old one and swaps it in only once it answers, so a failed setup leaves the old engine working.

If you use the memory from other MCP clients (see below), restart them after setup: a client keeps the engine it started with.

## Use

| You type | What happens |
|---|---|
| `remember that we deploy on Fridays` | Claude saves the fact. |
| `what do you remember about deploys?` | Matching memories are looked up and shown to Claude. |
| the first prompt of a session, and the first after a compaction | Memories matching it are looked up automatically. |
| `we now deploy on Thursdays` | Claude updates the saved fact in place (`memory_update`). |
| `forget the memory about deploys` | Claude finds it and deletes it. |

Claude also saves and recalls on its own: lasting preferences, conventions, decisions. To change a fact, or give it topic tags, Claude updates it in place with `memory_update`; it keeps its id and recall history, and no duplicate is saved.

Recall matches words, not meaning: "deploy Fridays" finds the fact above, "release schedule" does not.

## Dashboard

```
/mnemosyne-ui
```

Starts a small local web page for your memories and opens it in your default browser. The reply shows the full link, with its key after `#`, and the link is on the clipboard too, so you can open it in another browser. The page has four tabs:

- **Map:** a 3D map of your memories (see below).
- **Memories:** every memory, with a project filter, sorting (newest, most recalled, never recalled), a text and tag filter, and a detail panel with a Forget button that asks before it deletes.
- **Activity:** the activity log, live.
- **Search:** the same recall Claude uses, with scores. Searching here does not change any memory's recall count.

One dashboard runs at a time: running `/mnemosyne-ui` again, in this session or another, hands over the same link. It stops when the session that started it ends; `/clear` in that session counts as an end. Run `/mnemosyne-ui` again for a fresh one.

**Security.** The server binds `127.0.0.1` only, so nothing outside your machine can reach it. It makes a new random token each time it starts; the link carries it after `#`, which a browser never sends, and the page sends it only in a request header. Without it, every data route answers 401. The page loads no outside files, and a strict content security policy blocks inline script and style. The server reads the database read-only: a forget or a search goes through the engine, as Claude's would. Anyone who can run programs as your user can read the token from `~/.claude/mnemosyne/ui.json`, as they could read the database itself.

The dashboard and the activity log are tested on macOS and Linux, not on Windows.

### The 3D map

The Map tab shows your projects as spheres, sized by how many memories each holds. Click a project to fly in: its topics (from tags, plus an Untagged group) orbit it, and the other projects move aside. Click a topic to see its memories, and a memory to read it in the inspector, with its tags, recall count, saved date and "Open in Memories". The path bar above the map goes back up; Reset view returns to all projects. The map rotates on its own while the Auto-rotate button is pressed; press it to stop or start rotation (it starts off when your system asks for reduced motion). The left rail colours the map by project, recalls or age, hides or shows projects, and sets a minimum recall count.

The rail's list holds exactly what the map shows, and choosing an item there does the same as clicking it in the map: it is the keyboard and screen-reader route through the map. The map needs WebGL; without it the map area says so and the list still drills down. The map's 3D library (three.js and `3d-force-graph`, about 800 KB) loads only when you first open the Map tab.

### Topic tags: /mnemosyne-tags

Claude is asked to add 2 to 5 topic tags when it saves a new memory. To tag the memories you saved before, run:

```
/mnemosyne-tags
```

This is a dry run: it sends the text of each untagged memory to Claude's Haiku model, shows the tags it proposes, and saves the proposals (ids, tags and a hash of each text, never the text) to `~/.claude/mnemosyne/tags-proposed.json`. It changes no memory. Read the proposals, then write them:

```
/mnemosyne-tags apply
```

`apply` makes no model call. It writes the saved tags through `memory_update`, and skips any memory that was deleted, already got tags, or whose text changed since the dry run.

### Activity log

With `activityLog` on (the default), each memory call adds one line to `~/.claude/mnemosyne/activity.jsonl`: recalls, saves, updates, forgets and stats, from Claude, from the plugin's own lookups, from the dashboard and from other MCP clients. The Activity tab reads it.

Privacy: a line holds the query or the start of the memory text (at most 200 characters). Text that looks like a secret (API keys, tokens, `password=` values, long hex or base64 runs) is replaced by `[redacted]` before it is written, by pattern, so an unusual secret can slip through. The file is owner-only, capped at 1 MB with one older copy kept. Set `activityLog` to `off` to write nothing.

## Settings

Change any time from `/plugin` → Mnemosyne → configure.

| Setting | Default | What it does |
|---|---|---|
| `scope` | `global` | `global`: one memory for every repo. `per-project`: each repo keeps its own; ask for "global" to share a fact. |
| `rememberTerms` | `remember:`, `remember that`, `note that`, `save to memory` | A prompt that starts with one of these is saved. `none` turns it off. |
| `recallTerms` | `recall:`, `what do you remember about`, `check memory` | A prompt that starts with one of these looks up memories. `none` turns it off. |
| `showActivity` | `on` | `on`: a dim line in the conversation when Mnemosyne recalls, plus a status line under the prompt. `status`: the status line only. `off`: silent. |
| `activityLog` | `on` | `on`: each memory call adds one line to `~/.claude/mnemosyne/activity.jsonl` (see [Activity log](#activity-log)). `off`: nothing is written. |
| `memoryDir` | `~/.claude/mnemosyne/store` | Where memories are stored. |
| `externalMcp` | off | Lets other MCP clients use the same memory (see below). |

## Use the memory from other tools

Turn on `externalMcp`, start a new session, and the plugin writes `~/.claude/mnemosyne/bin/mnemosyne-mcp`: the engine as a stdio MCP server, with the right store and settings baked in. Add it to any MCP client:

```sh
claude mcp add mnemosyne-memory -- ~/.claude/mnemosyne/bin/mnemosyne-mcp
```

On Windows the file is `%USERPROFILE%\.claude\mnemosyne\bin\mnemosyne-mcp.cmd`.

For Cursor, Codex and others, use the same path as the server command. It offers the same five tools as the plugin (`memory_remember`, `memory_recall`, `memory_update`, `memory_forget`, `memory_stats`) and nothing else of the engine's. Remember and update take topic `tags`; a client cannot pick an engine bank or write other metadata. `memory_update` needs the engine build this plugin ships, so after a plugin update run `/mnemosyne-setup` once, then restart your other MCP clients: a server that is already running keeps the engine it started with. It reads and writes `global` memories by default; set `MNEMOSYNE_OWNER` to a `project-…` owner to use a project's. Turning the option off deletes the file.

**Security.** There is no token because there is no network port: the client starts the server itself over stdin/stdout, and nothing listens on the network. Access is whoever can run programs as your user, the same people who could read the database file directly. To keep other accounts on the machine out, the plugin sets `~/.claude/mnemosyne` and the store to owner-only (`700`) on macOS and Linux; on Windows your user profile's permissions already do. Don't wrap the server in an HTTP bridge without adding authentication there.

## How it works

The plugin hooks into Claude Code at four points:

- **Session start:** adds the memory tools and the `/mnemosyne-setup`, `/mnemosyne-ui` and `/mnemosyne-tags` commands, and says so if the installed engine is older than the plugin's.
- **System prompt:** adds a short, fixed set of rules telling Claude when to save and recall.
- **Your prompt:** on the first prompt (again after a compaction), or one starting with a term above, looks up memories and attaches them to that prompt.
- **Tool calls:** when Claude calls a memory tool, runs the engine once and returns the answer.

Mnemosyne shows a dim line in the conversation when it recalls and a status line under the prompt; `showActivity` quiets them.

Where an organization manages Claude Code, the system-prompt rules are skipped unless the organization lists this plugin in its managed settings; the tools and trigger terms still work.

Memories live in a local SQLite file. Mnemosyne runs on its own private copy of the Mnemosyne Memory engine, built from the plugin's `engine/` folder. Design notes: [DESIGN.md](DESIGN.md).

## License

MIT
