# Claude Mnemosyne

Long-term memory for Claude Code. A fact you save in one session is there in the next one, in any repo.

![How memory flows](docs/architecture.png)

## Install

You need [Bun](https://bun.sh) on your `PATH`.

```sh
claude plugin marketplace add Interstellar-code/claude-mnemosyne
claude plugin install mnemosyne@mnemosyne
```

The install asks for the settings below; the defaults are fine.

## Setup

In a Claude Code session, run once:

```
/mnemosyne-setup
```

This installs the memory engine into `~/.claude/mnemosyne/engine/` (about 130 MB) and creates the store at `~/.claude/mnemosyne/store/`.

## Use

| You type | What happens |
|---|---|
| `remember that we deploy on Fridays` | Claude saves the fact. |
| `what do you remember about deploys?` | Matching memories are looked up and shown to Claude. |
| any first prompt of a session | Memories matching it are looked up automatically. |
| `forget the memory about deploys` | Claude finds it and deletes it. |

Claude also saves and recalls on its own: lasting preferences, conventions, decisions. To change a fact, ask Claude to forget the old one and remember the new one.

Recall matches words, not meaning: "deploy Fridays" finds the fact above, "release schedule" does not.

## Settings

Change any time from `/plugin` → Mnemosyne → configure.

| Setting | Default | What it does |
|---|---|---|
| `scope` | `global` | `global`: one memory for every repo. `per-project`: each repo keeps its own; ask for "global" to share a fact. |
| `rememberTerms` | `remember:`, `remember that`, `note that`, `save to memory` | A prompt that starts with one of these is saved. Empty turns it off. |
| `recallTerms` | `recall:`, `what do you remember about`, `check memory` | A prompt that starts with one of these looks up memories. Empty turns it off. |
| `memoryDir` | `~/.claude/mnemosyne/store` | Where memories are stored. |

## How it works

The plugin hooks into Claude Code at four points:

- **Session start:** adds the memory tools and `/mnemosyne-setup`.
- **System prompt:** adds a short, fixed set of rules telling Claude when to save and recall.
- **Your prompt:** on the first prompt, or one starting with a term above, looks up memories and attaches them to that prompt.
- **Tool calls:** when Claude calls a memory tool, runs the engine once and returns the answer.

Memories live in a local SQLite file. Mnemosyne uses its own copy of the [Mnemopi](https://github.com/can1357/oh-my-pi/tree/main/packages/mnemopi) engine and never touches omp's memory. Design notes: [DESIGN.md](DESIGN.md).

## License

MIT
