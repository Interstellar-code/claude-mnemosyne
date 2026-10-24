# engine/ — where it comes from and what we changed

`engine/` is the Mnemosyne Memory engine: the npm package `@oh-my-pi/pi-mnemopi`, copied in whole so this plugin can change it. `/mnemosyne-setup` installs it from here (`bin/install-engine.ts`), not from npm. This file is the registry of every change; `bun scripts/engine-diff.ts` proves `engine/` is the tarball plus exactly these changes.

## Upstream

- Repo and path: `can1357/oh-my-pi`, `packages/mnemopi` (https://github.com/can1357/oh-my-pi/tree/v18.12.3/packages/mnemopi)
- Package: `@oh-my-pi/pi-mnemopi`, base version `18.12.3`, MIT (`LICENSE`, by Stencil Labs, Inc.)
- Tarball: https://registry.npmjs.org/@oh-my-pi/pi-mnemopi/-/pi-mnemopi-18.12.3.tgz
- Tarball integrity: `sha512-sb5QvCKTD2Je9/u2HcwHkpvFRQZPJB6SDJnx6U4VRwMQ3phf57nZ3HqNElYRQc/yrs0tQxpFqJ5/LIAn89sEbA==` (npm `dist.integrity`, checked against the downloaded file on 2026-10-23)
- Upstream git tag: `v18.12.3`, commit `53a0377db6845e0dae606146130766ec92d407fd` (found with `gh api repos/can1357/oh-my-pi/git/refs/tags/v18.12.3`; the npm manifest carries no `gitHead`). The copy is the tarball, not a checkout of that commit.
- What the tarball holds and so what `engine/` holds: `src/`, `dist/types/`, `package.json`, `LICENSE`, `README.md`, `CHANGELOG.md`, `THIRD-PARTY-NOTICES.txt`.
- The four `@oh-my-pi` dependencies (`pi-ai`, `pi-catalog`, `pi-natives`, `pi-utils`) stay normal npm downloads pinned at exactly `18.12.3`; they are not copied.

Ours, not upstream's (engine-diff ignores them): `UPSTREAM.md`, `bun.lock` (our lockfile for the engine tests), `test/` (our engine tests, `*.spec.ts`), `node_modules/` (git-ignored).

`engine/bun.lock` only pins the engine tests' install. `/mnemosyne-setup` (`bin/install-engine.ts`) runs `bun install --production --omit=peer` in a staging folder that has no lockfile, and Bun saves none under `--production`: the four `@oh-my-pi` packages are pinned at exactly `18.12.3`, but their own dependencies resolve fresh at each setup, through Bun's global cache (`~/.bun/install/cache`) or the registry.

## Builds

`engine/package.json` `version` is the build. Each build records the sha256 of `engine/src`: sha256 over the sorted lines `<path>\0<sha256 of the file>\n`, paths relative to `src/` (`sourceHash` in `scripts/engine-diff.ts`). `hooks/engine-build.ts` `ENGINE_BUILD` must equal the current build (a Bun spec checks it).

| Build | engine/src sha256 |
| --- | --- |
| 18.12.3 | d0695211df102b64fa729ebb6c403c5167971f661f0fbf1693e1823d4245c72d |
| 18.12.3-mnemosyne.1 | 4d196435eec21c5fc1932baa91e5de3a30da6cf9ed224fac2f247a65cdb17e2d |
| 18.12.3-mnemosyne.2 | b6e40fdcd82f7bb7a96ff5be1609944d684337a1b25351736a24419efbef91b6 |
| 18.12.3-mnemosyne.3 | 68cb174dee8ac991c6594c9f9079ca3830e6371b850ebe75edc84fc1832027ef |
| 18.12.3-mnemosyne.4 | 445e8260986ffeb14737f38ce74a7e48a5cb32b367e484c2ace5e369e74a4803 |
| 18.12.3-mnemosyne.5 | e67c4972b298ce2692bad37b377a423881b53d1141390474782f0ce44f8a9b2f |
| 18.12.3-mnemosyne.6 | 0444615859cc5d26331686a86ce458da92c0df9263423a7d04dd410319e78d14 |

The `18.12.3` row is the untouched upstream source, for reference. `.1` had changes 1 to 3; `.2` makes the change 1 merge keep a `__proto__` key as plain data (it was dropped); `.3` adds the two knowledge tools (change 4) and keeps the first author on dedupe with empty author env unset (change 5); `.4` is the review fix round: the knowledge reply is normalised by `parseExtractedFactCategories` (change 4), and the author pair merges as one unit (change 5); `.5` turns embeddings on: fastembed is a real dependency with an onnxruntime override (change 6), the CLI exits naturally on success (change 7), the on-demand runtime install is gone (change 8), and a `reembed` command backfills vectors (change 9); `.6` is the review fix round: `reembed` recounts after the drain and proves the model before a rebuild (change 9), and the API embedding route is refused without an explicit opt-in (change 10).

## Changes

Status is `open` (ours only) or `merged-upstream` (drop it at the next rebase).

### 1. mnemopi_update merges metadata, in one transaction

- What: `mnemopi_update` takes an optional `metadata` object; `memory_id` is the only required field, and content, importance or metadata must be given. The store's `updateWorking`, `BeamMemory.updateWorking`, `Memory.update` and the CLI (`mnemopi update <id> [content [importance]] --metadata '<json>'`) take it too. It is shallow-merged into the row's `metadata_json`: each named key is replaced, a key set to `null` is removed, other keys stay, a NULL `metadata_json` counts as `{}`. Nested objects are replaced whole, so SQLite `json_patch` (which merges recursively) is not used. The read, the merge and the `UPDATE ... WHERE id = ? AND session_id = ?` run in one `BEGIN IMMEDIATE` transaction, with any content or importance change of the same call. A row whose `metadata_json` is not a JSON object makes the update throw (an MCP `isError` reply) and leaves the row unchanged; metadata that is not a plain object is refused before the store is opened. The merge builds a null-prototype object, so a `__proto__` key is plain data: kept, replaced or removed like any other key, never a prototype change (since build `.2`). A metadata change clears the query caches, as a content change does. The id, `recall_count`, `last_recalled` and `timestamp` never change; the update stays owner-scoped.
- Why: the plugin needs to tag memories that already exist (`metadata.tags`) without deleting and re-saving them, which would lose their id and recall history; upstream can only change content and importance.
- Files: `src/mcp-tools.ts` `src/core/beam/store.ts` `src/core/beam/index.ts` `src/core/memory.ts` `src/cli.ts`
- Tests: `test/update-metadata.spec.ts`
- Upstream issue: placeholder until posted (draft: `~/.matrixkoder/inbox/mnemosyne-ui/upstream-issue.md`)
- Status: open

### 2. mnemopi_recall can leave recall counts alone

- What: `mnemopi_recall` takes an optional `update_recall_counts` boolean, default `true`, passed to the recall code as `updateRecallCounts`. `false` returns the same rows and leaves `recall_count` and `last_recalled` unchanged. The recall code already honoured the option on every path; only the MCP handler could not set it.
- Why: the dashboard's search must look at memories without changing their counts.
- Files: `src/mcp-tools.ts`
- Tests: `test/recall-no-touch.spec.ts`
- Upstream issue: placeholder until posted (a second issue, to be filed once the dashboard uses the flag)
- Status: open

### 3. Packaging: our build number

- What: `package.json` `version` is `18.12.3-mnemosyne.6` (our build number) instead of `18.12.3`, so the plugin can tell its own build from the npm one (`ENGINE_BUILD` in `hooks/engine-build.ts`, the `isCurrent` check in `hooks/register.ts`, the proxy's check in `bin/mcp-proxy.ts`). Nothing else in `package.json` changes here: the dependencies stay pinned at `18.12.3` (the fastembed dependency and the onnxruntime override are change 6).
- Why: a stale engine (the npm one, or an older build of ours) must be spotted and refused for features that need changes 1 and 2.
- Files: `package.json`
- Upstream issue: none (ours only)
- Status: open

### 4. mnemopi_knowledge_prompt and mnemopi_knowledge_store

- What: two engine tools for knowledge extraction. `mnemopi_knowledge_prompt` builds extraction prompt with `buildExtractionPrompt` over content clipped at `DEFAULT_INPUT_CHARS` (8192) via `clipToWindow` and returns `{ prompt, sha256 }` with the sha256 of the stored content. `mnemopi_knowledge_store` first refuses a reply over 256 KB and pre-checks it (JSON object, known kinds only, max 20 per kind, 60 total, item shapes, prototype keys refused), then normalises the accepted reply with `parseExtractedFactCategories(reply, { categoryLimit: 20 })` (the `categoryLimit` option and the exported field-key lists in `src/core/extraction.ts`), then cleans each item (control characters become a space, zero-width and bidi marks removed, whitespace collapsed, max 500 chars, duplicates dropped, kg requires subject, predicate, object; a timeline object keeps all its text fields so its date is found), and in one `BEGIN IMMEDIATE` transaction verifies owner (`session_id = MNEMOPI_SESSION_ID`), verifies content sha256 staleness, deletes prior rows for that memory (`WHERE source_memory_id = ? AND session_id = ?`), and executes direct INSERTs into `memoria_facts`, `memoria_preferences`, `memoria_instructions`, `memoria_timelines`, and `memoria_kg`. Column map: facts have `fact_type = 'fact'` and `key` NULL; timelines have `date` NULL unless the item parses as a date; kg with confidence 0.7. `mnemopi_knowledge_prompt` is a plain read (no write lock). Returns `{ stored: { facts, preferences, instructions, timelines, kg } }` or `{ refused: 'gone' | 'stale' | 'unparseable' | 'invalid' }`.
- Why: the plugin extracts knowledge with Haiku in the background without importing engine code into the hooks; guarded against owner mismatches, stale replies, and invalid outputs.
- Files: `src/mcp-tools.ts` `src/core/beam/knowledge.ts` `src/core/beam/index.ts` `src/core/extraction.ts` `src/core/beam/store.ts`
- Tests: `test/knowledge-guards.spec.ts` `test/knowledge-r2.spec.ts`
- Status: open

### 5. Dedupe keeps first author and veracity; empty author env unset

- What: On a dedupe re-save in `remember()`, `author_id` and `author_type` are kept as one unit: both are set from the new save only when both are NULL on the existing row (`CASE WHEN author_id IS NULL AND author_type IS NULL THEN ? ELSE <column> END`), so a re-save never mixes two authors. `veracity` takes the new veracity unless the new one is 'unknown'. In `mcp-tools.ts`, empty `MNEMOPI_AUTHOR_ID` or `MNEMOPI_AUTHOR_TYPE` environment variables count as unset (`null`).
- Why: a Claude re-save of a user memory must keep the human author and stated veracity; plugin pins author env to empty string.
- Files: `src/core/beam/store.ts` `src/mcp-tools.ts`
- Tests: `test/dedupe-author.spec.ts` `test/knowledge-r2.spec.ts`
- Status: open

### 6. Packaging: fastembed as a dependency, onnxruntime-node overridden to 1.26.0

- What: `fastembed` 3.0.0 moves from an optional peer/dev dependency to a regular `dependencies` entry, so `bun install --production` of the engine installs it. `overrides` pin `onnxruntime-node` to `1.26.0` (fastembed 3.0.0 itself pins 1.21.0, whose `process.exit()` abort after an ONNX session is ORT #24579, fixed from 1.24) and `@anush008/tokenizers` to `0.6.0` (fastembed's `^0.0.0` resolves to a build without the linux-arm64 bindings). `trustedDependencies` lists `onnxruntime-node` so its native postinstall runs. The peer `onnxruntime-node` pin moves to 1.26.0 to match; the dev dependency on it is dropped (the runtime dependency at the override version is the one used). `bin/install-engine.ts` restates the same `overrides` and `trustedDependencies` on the `.next/package.json` it writes, because Bun applies `overrides` only from the install root, and the production install treats the engine as a `file:` dependency.
- Why: the plugin turns local embeddings on; the engine must install an ORT whose exit crash is fixed, so a spawned `bun cli.ts mcp` that embedded does not abort when it exits.
- Files: `package.json`
- Tests: `../../tests/bun/embeddings.spec.ts` (the plugin's spec spawns the installed engine)
- Upstream issue: none (packaging only)
- Status: open

### 7. The CLI exits naturally on success

- What: `src/cli.ts` no longer calls `process.exit(code)` when a command succeeds. A clean run sets `process.exitCode = 0` and lets the event loop drain, so onnxruntime-node's teardown (ORT #24579) does not abort in `process.exit()`. A failing command still calls `process.exit(code)` and exits non-zero.
- Why: a spawned engine that embedded must be able to exit 0; the ORT override alone is not enough on the fastembed path — an explicit `process.exit(0)` after a model session still aborts.
- Files: `src/cli.ts`
- Tests: `../../tests/embed/embed.spec.ts` (a timed < 5 s one-shot run)
- Status: open

### 8. No on-demand fastembed install; a failed import means embeddings off

- What: `src/core/fastembed-runtime.ts` no longer `bun install`s fastembed into a runtime cache when the direct import cannot resolve or its native loader fails. `loadFastembedOnce` throws the resolution error instead; `embeddings.ts` catches it in `getLocalModel`, logs the reason and returns null, so recall is full-text only. The runtime-install plan, `loadFromRuntimeInstall` and the recoverable-error classifier are removed.
- Why: the plugin never installs packages or downloads a model behind the user's back. The old fallback installed fastembed with ORT 1.21.0 (no override), reintroducing the exit crash, over the network, at an arbitrary time.
- Files: `src/core/fastembed-runtime.ts`
- Tests: `test/fastembed-runtime.spec.ts`
- Status: open

### 9. `mnemopi reembed` backfills embeddings

- What: `src/cli.ts` gains a `reembed` command. No argument is a dry run: it counts the live memories with no vector for the active model and writes nothing. `apply` runs the engine's own backfill, `reconcileEmbeddingModel` (`src/core/beam/store.ts`), and drains its background work, so the memories saved before embeddings were on get vectors. `rebuild` is required when the store holds vectors from another model: `reconcileEmbeddingModel` wipes every vector on a model mismatch, which `reembed` refuses without `rebuild`. It never edits or deletes a `working_memory` row; it only writes `memory_embeddings`. After the drain it recounts the still-missing rows and exits non-zero naming how many remain, so a model that failed to load can never report success; `rebuild` first proves the model loads (embeds one probe text) before the wipe.
- Why: the MCP and CLI paths never called the backfill; only the `Mnemopi` library class did. `/mnemosyne-embed` drives this command to fill the older memories' vectors.
- Files: `src/cli.ts` `src/core/beam/store.ts`
- Tests: `test/reembed.spec.ts`
- Status: open

### 10. The API embedding route is refused without an explicit opt-in

- What: `src/core/embeddings.ts` `isApiModel` now returns `false` unless `MNEMOPI_EMBEDDINGS_API_OPT_IN` is a truthy flag. The plugin never sets that flag, so an empty `MNEMOPI_EMBEDDING_API_URL` can no longer fall back to an inherited `OPENROUTER_BASE_URL` (or `OPENROUTER_API_KEY` / `OPENAI_API_KEY`) and route memory text to a remote API. Local-only embeddings are the only route this build takes by default.
- Why: a hostile shell that exports `OPENROUTER_BASE_URL` (which outside agents such as Codex usually carry, with a key) would send every memory and recall query to a remote API despite the plugin's empty `MNEMOPI_EMBEDDING_API_URL` pin, because the engine treated the empty value as unset.
- Files: `src/core/embeddings.ts`
- Tests: `test/embeddings-api-gate.spec.ts`
- Status: open

Not changed: `dist/types/*.d.ts` still describe upstream 18.12.3 (no `metadata` on `updateWorking`). Nothing in the plugin reads them; regenerating them needs upstream's monorepo build.

## Rebase onto a new upstream version

1. Download the new tarball (`https://registry.npmjs.org/@oh-my-pi/pi-mnemopi/-/pi-mnemopi-<version>.tgz`), note its `dist.integrity` from `https://registry.npmjs.org/@oh-my-pi/pi-mnemopi/<version>`, and find its git tag (`gh api repos/can1357/oh-my-pi/git/refs/tags/v<version>`).
2. Copy the new upstream version in: replace everything in `engine/` except `UPSTREAM.md`, `bun.lock`, `test/` and `node_modules/` with the tarball's `package/` contents.
3. For each change above: if upstream merged it, mark it `merged-upstream` and drop it; if it is still open, re-apply it to the new source and update its file list.
4. Bump the build number: `<version>-mnemosyne.1` on a new base, or `.N+1` on the same base, in `engine/package.json` and `hooks/engine-build.ts`; update the tarball URL, integrity and tag above, and add a Builds row with the new `engine/src` hash (`bun -e "import { sourceHash } from './scripts/engine-diff'; console.log(sourceHash('engine/src'))"`).
5. Update the four pinned `@oh-my-pi` dependencies to the new version, run `bun install --lockfile-only` in `engine/` to refresh `bun.lock`.
6. Rerun the engine tests and engine-diff: `bun run test:bun` and `bun scripts/engine-diff.ts`; both must exit 0.
