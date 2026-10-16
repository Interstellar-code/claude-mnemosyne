# Claude Mnemopi

Shared long-term memory for Claude Code, backed by [Mnemopi](https://github.com/can1357/oh-my-pi/tree/main/packages/mnemopi) — the Bun/TypeScript port of the [Mnemosyne](https://github.com/mnemosyne-oss/mnemosyne) memory engine.

> **Status: scaffold.** `v0.0.1` ships **no behavior**. It installs, loads and validates cleanly, and does nothing else. See [DESIGN.md](DESIGN.md) for what the implementing version does, the constraints it must honour, and the questions still open.

## Why

Claude Code's own memory is per-repository (`~/.claude/projects/<repo>/memory/`). A fact learned in one repo is invisible in the next, which is wrong for knowledge that is not repo-specific — a runbook, a tool convention, a machine-wide preference.

Meanwhile [omp](https://omp.sh) already keeps a memory store at `~/.omp/agent/memories/mnemopi/`. This plugin's goal is to read and write **that same store**, so a fact learned in a Claude Code session in one repo is available to omp, and to Claude Code in every other repo.

## Relationship to MatrixKoder

This is a **standalone plugin**. It has no dependency on [MatrixKoder](https://github.com/Interstellar-code/matrixkoder) and does not require it.

MatrixKoder is listed as one *consumer*: its `/mk setup` wizard can offer to switch this memory on, and its settings tab can expose the two keys below. That integration is optional and lives in MatrixKoder's repo, not here.

## What ships today

| File | Contents |
|---|---|
| `.claude-plugin/plugin.json` | manifest; `defaultEnabled: false` |
| `.claude-plugin/marketplace.json` | single-plugin marketplace, so the repo can be added as a marketplace |
| `hooks/hooks.json` | points at the hooks module |
| `hooks/register.ts` | `register()` that registers nothing |
| `types/index.d.ts` | empty contract; the shape the implementation will need is commented |

## Configuration

Both keys are declared and inert until the implementation lands.

| Key | Type | Default | Purpose |
|---|---|---|---|
| `memory` | boolean | `false` | master switch; the implementation gates every hook and tool on it |
| `memoryDir` | string | `~/.omp/agent/memories/mnemopi` | the store. Default is omp's, so both agents share one memory |

## Prerequisites (for the implementing version)

Not needed to install the scaffold. These are what the real thing will require, and they are not optional:

- **Bun.** The Mnemopi package publishes TypeScript only — `exports.import` points at `./src/*.ts` and `dist/` holds type declarations alone. Node refuses those files outright (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so `bun` must be on `PATH`.
- **The engine.** `@oh-my-pi/pi-mnemopi`, installed by omp. Expected at `~/.bun/install/global/node_modules/@oh-my-pi/pi-mnemopi`.
- **A store.** `memoryDir` must point at a real Mnemopi data dir. Mnemopi's built-in default is `~/.hermes/mnemopi/data`, which is empty on most machines — the default above avoids it.

## Install

Once the implementation lands:

```sh
claude plugin marketplace add Interstellar-code/claude-mnemopi
claude plugin install mnemopi@mnemopi
```

For v0.0.1 there is nothing to install — loading this plugin changes nothing.

## License

MIT — see [LICENSE](LICENSE).
