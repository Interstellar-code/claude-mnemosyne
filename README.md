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
