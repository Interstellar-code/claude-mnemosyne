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

The `18.12.3` row is the untouched upstream source, for reference. `.1` had changes 1 to 3; `.2` makes the change 1 merge keep a `__proto__` key as plain data (it was dropped).

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

- What: `package.json` `version` is `18.12.3-mnemosyne.2` (our build number) instead of `18.12.3`, so the plugin can tell its own build from the npm one (`ENGINE_BUILD` in `hooks/engine-build.ts`, the `isCurrent` check in `hooks/register.ts`, the proxy's check in `bin/mcp-proxy.ts`). Nothing else in `package.json` changes: the dependencies stay pinned at `18.12.3`.
- Why: a stale engine (the npm one, or an older build of ours) must be spotted and refused for features that need changes 1 and 2.
- Files: `package.json`
- Upstream issue: none (ours only)
- Status: open

Not changed: `dist/types/*.d.ts` still describe upstream 18.12.3 (no `metadata` on `updateWorking`). Nothing in the plugin reads them; regenerating them needs upstream's monorepo build.

## Rebase onto a new upstream version

1. Download the new tarball (`https://registry.npmjs.org/@oh-my-pi/pi-mnemopi/-/pi-mnemopi-<version>.tgz`), note its `dist.integrity` from `https://registry.npmjs.org/@oh-my-pi/pi-mnemopi/<version>`, and find its git tag (`gh api repos/can1357/oh-my-pi/git/refs/tags/v<version>`).
2. Copy the new upstream version in: replace everything in `engine/` except `UPSTREAM.md`, `bun.lock`, `test/` and `node_modules/` with the tarball's `package/` contents.
3. For each change above: if upstream merged it, mark it `merged-upstream` and drop it; if it is still open, re-apply it to the new source and update its file list.
4. Bump the build number: `<version>-mnemosyne.1` on a new base, or `.N+1` on the same base, in `engine/package.json` and `hooks/engine-build.ts`; update the tarball URL, integrity and tag above, and add a Builds row with the new `engine/src` hash (`bun -e "import { sourceHash } from './scripts/engine-diff'; console.log(sourceHash('engine/src'))"`).
5. Update the four pinned `@oh-my-pi` dependencies to the new version, run `bun install --lockfile-only` in `engine/` to refresh `bun.lock`.
6. Rerun the engine tests and engine-diff: `bun run test:bun` and `bun scripts/engine-diff.ts`; both must exit 0.
