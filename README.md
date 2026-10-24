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

After updating to 0.6.0, run `/mnemosyne-setup` once: it installs engine build `18.12.3-mnemosyne.4`, which has the knowledge tools. Without it, extraction, `/mnemosyne-knowledge` and the dashboard stay off and say so (see [What 0.6.0 does not do yet](#what-060-does-not-do-yet)).

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

## Embeddings (meaning-based recall)

Since 0.7.0 the engine can also compare memories by meaning, using a small local model, BAAI/bge-small-en-v1.5 (384 dimensions, about 63 MB). It runs on your machine only: no memory text ever leaves it for an embedding API, and every embedding setting is pinned by the plugin (empty API URL and key, fixed model).

- **Where it comes from.** `/mnemosyne-setup` downloads the model once from `huggingface.co` (the `Qdrant/bge-small-en-v1.5-onnx-Q` repository; setup prints the host and size first). The model is cached under `~/.claude/mnemosyne/model-cache/`, not the shared `~/.omp` cache, and is only ever downloaded during setup. After updating to this version, run `/mnemosyne-setup` once to install the engine build `18.12.3-mnemosyne.5` and fetch the model; until then embeddings stay off and recall is keyword-only. A later update also needs a fresh `/mnemosyne-setup`.
- **The option.** `embeddings` in the plugin settings is `auto` by default: on only on macOS on Apple Silicon (the tested platform), off elsewhere unless you set it to `on`. `off` keeps recall keyword-only. Changing it needs `/mnemosyne-setup` (to download the model) and a dashboard restart.
- **The cost.** Embedding a memory is about 0.3 s per engine call, and each engine process that embeds uses about 0.4 GB of memory. The engine install grows by about 280 MB (fastembed and its ONNX runtime, which overrides onnxruntime-node to 1.26.0 so the process no longer aborts on exit under Bun).
- **How recall changes.** A memory's keyword score is blended with its meaning score: the working-memory tiers add `0.2 × similarity`, and a candidate with too little word overlap still surfaces when its similarity is at least 0.65. Recall still answers within its timeout.
- **Older memories.** Memories saved before embeddings were on have no vector until you fill them:

```
/mnemosyne-embed
```

That is a dry run: it counts the memories with no vector. Then `/mnemosyne-embed apply` fills them, in one engine process, and changes no memory text (only its vector). Running it again adds nothing. If you changed the model the vectors are refused unless you pass `/mnemosyne-embed rebuild`, which wipes and rebuilds every vector.

## Dashboard

```
/mnemosyne-ui
```

Starts a small local web page for your memories and opens it in your default browser. The reply shows the full link, with its key after `#`, and the link is on the clipboard too, so you can open it in another browser. The page has six tabs and opens on Memories:

- **Map:** every memory as a star in a glowing 3D galaxy, with what was learned from each as moons, a Timeline layout and live sparks (see [The galaxy](#the-galaxy)).
- **Memories:** every memory, with a project filter, sorting (newest, most recalled, never recalled), a text and tag filter, and a detail panel with a Forget button that asks before it deletes.
- **Activity:** the activity log, live, with the app and the session that made each call (see [Activity log](#activity-log)).
- **Search:** the same recall Claude uses, with scores. Searching here does not change any memory's recall count.
- **Knowledge:** the facts, preferences, instructions, dated events and relations that extraction pulled out of your memories (see [The Knowledge and Health tabs](#the-knowledge-and-health-tabs)).
- **Health:** how much of your memory is used, how much has never been recalled, and which features are switched on.

The Theme button in the header switches the whole dashboard between Auto (follows your system), Light and Dark, and remembers your choice.

One dashboard runs at a time: running `/mnemosyne-ui` again, in this session or another, hands over the same link. It stops when the session that started it ends; `/clear` in that session counts as an end. Run `/mnemosyne-ui` again for a fresh one.

**Security.** The server binds `127.0.0.1` only, so nothing outside your machine can reach it. It makes a new random token each time it starts; the link carries it after `#`, which a browser never sends, and the page sends it only in a request header. Without it, every data route answers 401. The page loads no outside files, and a strict content security policy blocks inline script and style. The server reads the database read-only: a forget or a search goes through the engine, as Claude's would. Anyone who can run programs as your user can read the token from `~/.claude/mnemosyne/ui.json`, as they could read the database itself.

The dashboard and the activity log are tested on macOS and Linux, not on Windows.

### The galaxy

The Map tab draws every memory as a star in a glowing galaxy (the newest 2000; past that the inspector says "showing 2000 of N"). Each project is a bright core, and a memory sits in a cluster around it for its topic: its first tag, or Untagged. A star grows with each recall, newer stars are brighter, and a hollow ring marks a memory that was never recalled. A soft bloom (a glow pass) makes it shine. The white star in the middle is Claude: recalls and saves start there.

1. Links. Topic threads join each project core to its topics and each topic to its stars. Gold bridges join the same topic name in two different projects; Untagged never bridges. Both can be switched off in the left rail.
2. Moving around. Drag to orbit, scroll to zoom, click a project, a topic or a star to fly in. The path bar above the map (All memories › project › topic) goes back up and Reset view returns to everything. Find dims every star except those whose tag, project or label holds the text. Colour by switches between project, recalls and age, and the project toggles hide a project. Auto-rotate turns the map on its own; it starts off when your system asks for reduced motion, and in the Timeline.
3. The inspector. A star shows its text, project, recalls, saved date and tags, what was learned from it, and "Open in Memories". A project or topic shows its totals.
4. Knowledge moons. The knowledge mined from the selected memory (at most 8 items) orbits its star as small moons, coloured by kind: blue facts, pink preferences, green instructions, amber dated events, violet relations. A moon is clickable, and the inspector lists every item. Under reduced motion the moons stand still. The "Knowledge moons" switch turns them off.
5. The knowledge filter. The Knowledge chips (Facts, Preferences, Instructions, Timeline, Relations) count the memories that have each kind. Pick one or more and every memory without any of them dims to a tenth, so you see what was learned where. The chips and the moons stay disabled until the store holds extracted knowledge.
6. Layouts. Galaxy is the default. Timeline lines the memories up by saved date: today on the right, one lane per project, with a range of 7 days, 30 days or All (the oldest memory) and an axis of day marks. Memories older than the range, or with no saved date, are hidden. Switching morphs the stars into place; the layout you last used is remembered in your browser. Meaning (a layout by what memories say) and the Similar memories links are in the rail but disabled: they arrive in 0.7.0.
7. Live. Recalls and saves from the activity log light the map as they happen: a gold spark flies from the Claude core to each recalled star, a teal one to a saved or updated star, a red one to a forgotten star. A memory saved while the page is open is added to the map as a new star. The Recall and Write layer switches turn each kind off, the Live pill pauses the whole stream (it starts paused under reduced motion), and the live strip under the map lists the last few events.
8. Simulate. "Simulate a recall" and "Simulate a write" play demo sparks on the map so you can see the live view on a quiet day. They are demo only: they make no request, never touch the store and never write a line to the activity log. After the first press the demo repeats every few seconds while Live is on.

The Glow control in the rail sets how strongly stars glow: Soft (the default), Full (the 0.6.0 look) or Off; your choice is remembered. The map needs WebGL; without it the map area says so, and the other tabs still work. Its 3D library (three.js, `3d-force-graph` and the bloom passes, about 830 KB) loads only when you first open the Map tab.

### The Knowledge and Health tabs

Knowledge lists what extraction pulled out of your memories (see [Knowledge extraction](#knowledge-extraction-what-claude-learned)), one table per kind: Facts, Preferences, Instructions, Timeline and Relations. A row shows the item, its topic (the memory's first tag), its project, the memory it came from, its status (an instruction is active or retired, a relation shows its confidence), how many times that memory was recalled and when it was last used. Show on map selects the source star on the Map tab. A notice at the top says when extraction is off, or when the store holds no items yet.

Health shows four numbers (memories, never recalled, recalls in the log, store size), the share of memories that have topic tags, knowledge, a recorded author and at least one recall, recalls per day over the last 14 days, the projects, the 50 newest memories never recalled with Review and Forget (which asks again before deleting) and the 10 most recalled. The "Embeddings" bar always reads 0 in 0.6.0, because embeddings arrive in 0.7.0.

### Topic tags: /mnemosyne-tags

Claude is asked to add 2 to 5 topic tags when it saves a new memory. To tag the memories you saved before, run:

```
/mnemosyne-tags
```

This is a dry run: it sends the text of each untagged memory to the `extractionModel` (Haiku by default), shows the tags it proposes, and saves the proposals (ids, tags and a hash of each text, never the text) to `~/.claude/mnemosyne/tags-proposed.json`. It changes no memory. Read the proposals, then write them:

```
/mnemosyne-tags apply
```

`apply` makes no model call. It writes the saved tags through `memory_update`, and skips any memory that was deleted, already got tags, or whose text changed since the dry run.

### Knowledge extraction: what Claude learned

After each save, and after an update that changes a memory's text, Mnemosyne asks the `extractionModel` (Haiku by default) to pull out the facts, preferences, instructions, dated events and relations in that memory. The save returns at once; the call runs in the background. The engine's own prompt builds the request, and the engine checks and stores the answer. Every run is one line in the activity log, action `extract`.

Only the memory's text goes to the model, through Claude Code's own model channel; nothing leaves your machine for another service. One model call per save is the cost. The setting `extractionModel` picks the model (a short name such as `haiku`, the default, or a full model id). It also drives `/mnemosyne-tags`. Set it to `off` and nothing is extracted, no model call is made, and `/mnemosyne-tags` and `/mnemosyne-knowledge` say that extraction is off.

If Claude Code cancels the background call (Esc on that turn, or the session ends), a small pending file under `~/.claude/mnemosyne/knowledge-pending/` usually records which memory needs it. The file is written by two background steps that start after the save's reply, so a save made right before the session ends may leave no pending file and no `extract` line at all. Nothing is lost for good: `/mnemosyne-knowledge` also lists every memory with no knowledge, whether or not it has a pending file, and its dry run is the check. Finish the pending ones, and extract the older memories, with:

```
/mnemosyne-knowledge
```

That is a dry run: it counts, per project, the memories with no knowledge and the pending entries, and changes nothing. Then:

```
/mnemosyne-knowledge apply
```

`apply` finishes the pending entries first (each from its current text and hash, so a memory you edited is redone, never stored stale), then extracts the older memories with no knowledge. It makes one model call per memory (a few at a time), batches the engine work per project, 40 memories at a time, and never edits or deletes a memory. A memory whose extraction found nothing is noted in `~/.claude/mnemosyne/knowledge-empty.json` and skipped while its text is unchanged. Only `apply` makes that note: a live extraction that finds nothing is not recorded as tried, so the first `apply` after many such saves may make one more model call for each of those memories. Saving text that already exists (a dedupe) starts a fresh extraction for the same memory and replaces its knowledge rows with equal ones; that costs one model call and changes nothing you see.

Outside agents' saves (Codex, Cursor and other clients, through the MCP proxy) get no automatic extraction: the proxy has no model channel. Run `/mnemosyne-knowledge apply` to cover them.

Try `apply` on a copy of the store first.

The extracted items are stored in the engine's own tables (facts, preferences, instructions, timelines, relations), replaced whenever a memory is extracted again, and deleted with the memory when you forget it. The Map and Knowledge tabs show them.

### What 0.6.0 does not do yet

1. Meaning layout and Similar memories arrive in 0.7.0, with embeddings. Until then recall matches words only, the Meaning button and the Similar memories switch are disabled, and the Health tab's embeddings bar reads 0.
2. Moons for a memory saved or extracted after the page loaded show only after you reload the dashboard page: the map reads the knowledge once, when the page loads.
3. The dashboard keeps the `extractionModel` it started with. After you change the setting, `/mnemosyne-ui` on the running dashboard says it must be restarted: end the session that started it, then run `/mnemosyne-ui` again.
4. Saves by outside agents (Codex, Cursor and others, through the proxy) get no automatic extraction. They need `/mnemosyne-knowledge apply`.
5. This update needs the plugin's newer engine build (`18.12.3-mnemosyne.4`, which has the knowledge tools): run `/mnemosyne-setup` once after updating. Until then extraction stays off and says so in the activity log (`engine out of date`).

### Who wrote a memory

A save records who wrote it. When a prompt starts with a remember term, the first save that turn is yours: it is stored with `author_type` `human` and veracity `stated`. Claude's own saves are `agent`; so are outside agents' saves, named by their MCP client. `stated` ranks a little higher in recall than the default `unknown` (1.0 against 0.8), which is why a fact you asked for is found first.

### Activity log

With `activityLog` on (the default), each memory call adds one line to `~/.claude/mnemosyne/activity.jsonl`: recalls, saves, updates, forgets and stats, from Claude, from the plugin's own lookups, from the dashboard and from other MCP clients, plus one `extract` line for every knowledge extraction run. Since 0.6.0 a line also names the app that made the call (`client`, for example Claude Code, or the name an MCP client gave when it connected) and the Claude Code session (`session`), and a save records who wrote it (`author_type` and `veracity`, see above). Older lines have none of these.

The Activity tab reads the log and follows it live. Its list has column headers (Time, Action, Source, Project, What, Result) and a key under the list that says what each Source means (`hook`, `tool`, `trigger`, `external`, `ui`, `backfill`). The filter chips pick one action, or Outside agents; the App drop-down picks one app (Claude Code, Codex, Cursor, Dashboard, or another client by its own name); pressing the short session id on a line shows only that session, and a chip clears it. A saved memory carries a badge for who wrote it: "you said" for a save you asked for with a remember term, "Claude" for Claude's own save, the app's name for another agent's, and no badge for a save that does not say. An older memory takes the author of the first save after the update: after any re-save of the same text, a memory from 0.5.1 reads "Claude" or the app's name, even if you wrote it. Four tiles count today's recalls, saves, updates and failed calls.

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
| `extractionModel` | `haiku` | The model that pulls facts, preferences, instructions, dated events and relations out of each saved memory in the background (an alias or a full model id). It also drives `/mnemosyne-tags`. `off` turns extraction off: no model call, and `/mnemosyne-tags` and `/mnemosyne-knowledge` say so. |
| `embeddings` | `auto` | `auto`: meaning-based recall on only on macOS on Apple Silicon, off elsewhere. `on`: always on. `off`: keyword-only recall. Local only; `/mnemosyne-setup` downloads the model once (see [Embeddings](#embeddings-meaning-based-recall)). |

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

- **Session start:** adds the memory tools and the `/mnemosyne-setup`, `/mnemosyne-ui`, `/mnemosyne-tags` and `/mnemosyne-knowledge` commands, and says so if the installed engine is older than the plugin's.
- **System prompt:** adds a short, fixed set of rules telling Claude when to save and recall.
- **Your prompt:** on the first prompt (again after a compaction), or one starting with a term above, looks up memories and attaches them to that prompt.
- **Tool calls:** when Claude calls a memory tool, runs the engine once and returns the answer.

Mnemosyne shows a dim line in the conversation when it recalls and a status line under the prompt; `showActivity` quiets them.

Where an organization manages Claude Code, the system-prompt rules are skipped unless the organization lists this plugin in its managed settings; the tools and trigger terms still work.

Memories live in a local SQLite file. Mnemosyne runs on its own private copy of the Mnemosyne Memory engine, built from the plugin's `engine/` folder. Design notes: [DESIGN.md](DESIGN.md).

## License

MIT
