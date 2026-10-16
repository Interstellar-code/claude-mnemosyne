# Claude Mnemosyne

Long-term memory for Claude Code across sessions and repos, backed by [Mnemopi](https://github.com/can1357/oh-my-pi/tree/main/packages/mnemopi) — the Bun/TypeScript port of the [Mnemosyne](https://github.com/mnemosyne-oss/mnemosyne) memory engine.

## Why

Claude Code's own memory is per-repository (`~/.claude/projects/<repo>/memory/`). A fact learned in one repo is invisible in the next, which is wrong for knowledge that is not repo-specific — a runbook, a tool convention, a machine-wide preference.

## Its own home, not omp's

Mnemosyne installs and uses **its own copy** of the engine and **its own store**. It never reads or writes omp's engine or memory, so the two cannot conflict:

| | omp | Mnemosyne |
|---|---|---|
| Engine | `~/.bun/install/global/node_modules/@oh-my-pi/pi-mnemopi` | `~/.claude/mnemosyne/engine/` (pinned `18.11.0`) |
| Store | `~/.omp/agent/memories/mnemopi/` | `~/.claude/mnemosyne/store/` |

The trade-off: memories saved in omp are not visible here, and the reverse.

## What it does

- **Four tools** the model can call: `memory_remember`, `memory_recall`, `memory_forget`, `memory_stats`.
- **Recall on the first prompt** of each session: up to 5 memories matching its sentences ride along beside it. Once per session, so the prompt cache holds.
- **Saves only what the model chooses** to `memory_remember` — no transcript capture, no noise. Saved facts stay until `memory_forget` deletes them.
- Recall is full-text only (see [DESIGN.md](DESIGN.md) §2.5).

## How it works

One hooks module (`hooks/register.ts`), no settings-file hooks. Every memory operation is one short-lived `bun cli.ts mcp` process against `~/.claude/mnemosyne/store/mnemopi.db`; no server stays running.

| Hook | Fires | Does |
|---|---|---|
| `session.start` | once per session | registers `/mnemosyne-setup` and the four tools; toasts if the engine is missing |
| `command.run` | `/mnemosyne-setup` | checks Bun, installs the engine, runs a stats call |
| `tool.call` | the model calls a `memory_*` tool | runs the engine, returns its answer as the tool result |
| `prompt.submit` | every prompt; acts once per session | first real prompt: recalls per sentence, attaches up to 5 hits as hidden context |

### Memory lifecycle

- **Add.** The model calls `memory_remember`. The fact is stored as one row with `source: 'imported'`, the engine's durable tier; any other source is deleted by the engine after 24 hours. Owner is `global`, or `project-<repo>-<hash>` in per-project mode; `scope` is `global`, or `channel` for a project-only fact.
- **Recall.** Automatically on the first prompt of a session, or whenever the model calls `memory_recall`. It searches the current owner's rows plus every `global` row, by keywords: "ferry Varn" finds "The ferry to Varn leaves at 06:40", "boat schedule" does not.
- **Update.** No update tool: forget the old fact, remember the new one.
- **Remove.** The model calls `memory_forget` with the id and owner a recall returned. Nothing expires on its own.

### When it is used

Apart from the first-prompt recall, the model decides when to save or recall, from the tool descriptions alone. There is no keyword trigger and no skill yet. Saying "remember …" or "what do you remember about …" works in practice, but it is the model's judgement, not a rule.

### Planned

- A fixed system-prompt section telling the model when to save and recall.
- Term triggers, configurable per install (`rememberTerms`, `recallTerms`): a prompt starting with a remember term is stored directly; a recall term recalls on that prompt.
- Later, a small `/mnemosyne` skill for manual review.

## Prerequisites

- **Bun** on `PATH` ([bun.sh](https://bun.sh)). The engine ships TypeScript only; Node cannot run it.

## Install

```sh
claude plugin marketplace add Interstellar-code/claude-mnemosyne
claude plugin install mnemosyne@mnemosyne
```

The install asks for the two settings below. Then, in a session:

```
/mnemosyne-setup
```

That installs the engine into `~/.claude/mnemosyne/engine/` (about 130 MB) and creates the store. Until it runs, the tools refuse and a toast says to run it.

## Configuration

| Key | Options | Default | Purpose |
|---|---|---|---|
| `scope` | `global`, `per-project` | `global` | `global`: one memory for every repo. `per-project`: each repo (by git root; worktrees share their repo's) keeps its own, and `memory_remember` with `global: true` saves a fact every repo sees. |
| `memoryDir` | path | `~/.claude/mnemosyne/store` | Where the database lives: absolute or `~/…`. A path inside `~/.omp` is refused: one store, one writer. |

Change either later from `/plugin` → Mnemosyne → configure.

## Development

```sh
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

`tsc -p .` needs the engine's API types in `.claude-plugin/types/` (gitignored). The engine lays them there the first time it loads the plugin from this folder, for example with `claude --plugin-dir .`.

## Relationship to MatrixKoder

Standalone. MatrixKoder may offer to switch it on from its setup wizard; that integration lives in MatrixKoder's repo.

## License

MIT — see [LICENSE](LICENSE).
