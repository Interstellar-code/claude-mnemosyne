# Changelog

Newest first. Each release is tagged `vX.Y.Z` on GitHub; the README and DESIGN.md describe the contracts.

## 0.13.0 (global memories tied to their projects)

1. The sun belt tells two things apart that it used to draw alike: a gold dot is a true global memory (saved for every project), a blue dot is a project's memory shared with every project (scope global; it also sits on its own planet). The store card's "Global (sun belt)" reads "N global · M shared from projects".
2. Gold tethers: each true global memory draws a faint line to every project whose memories it is close to in meaning (up to 3, brighter for a closer pair), following the planet as it orbits. The pairs are the black holes' own, so `map.linkScore` decides what counts; a hidden project's tethers hide with it. Its tooltip names the projects with their pair counts.
3. Each belt dot is now its own memory (before, a dot took the next memory of its group, so the tooltip could not be trusted to name a fixed memory). Legend rows for the blue dot and the gold tether. No server, setting or engine change.

## 0.12.1 (whose memory it is)

1. The outside-agent server (`mnemosyne-mcp`) recalls every global-scope memory but changes only its own owner's, so `memory_update` and `memory_forget` of a project's memory from a server that runs as `global` answered a bare `not_found` for a memory recall had just shown. The reply now adds `owner` (the memory's owner) and a `hint` naming where it can be changed. The proxy reads the owner from the store, read-only; a missing id, an unreadable store or a memory of its own owner keeps the engine's reply as it was. The activity line still records the engine's own answer. The engine is unchanged.

## 0.12.0 (black-hole settings)

1. The map's black holes follow two settings instead of fixed numbers: `map.linkScore` (how close a cross-project pair must be, 0.65 to 0.95, default 0.80) and `map.linkMinPairs` (how many such pairs two projects need, 1 to 50, default 2). The defaults draw what 0.11.0 drew. A small store often has no two projects with two pairs at 0.80 and so shows no black hole at all; `map.linkMinPairs` 1 or a lower `map.linkScore` brings them in. Both apply on the next map load.
2. The semantic worker now reports cross-project pairs down to 0.65 (`LINK_FLOOR`, the lowest `map.linkScore`), and the server applies the setting to the cached layout, so changing it needs no new layout run. `MEANING_VERSION` is 3: the first map load after the update lays out once more and rewrites `meaning.json`.
3. Links to and from global memories are still not drawn (global has no planet). The engine is unchanged; no `/mnemosyne-setup` is needed.

## 0.11.0 (duplicate flag on memory_remember)

1. The `memory_remember` reply carries `duplicate` (claude-mnemosyne#44, for Switch): `true` when this owner already held exactly the same text, `false` for a new memory. `status` stays `stored` and `memory_id` is the existing id, so nothing that reads the reply today changes.
2. New engine build `18.12.3-mnemosyne.11` (change 19 in `engine/UPSTREAM.md`). Run `/mnemosyne-setup` once after updating. Until then the plugin treats the engine as out of date and refuses `memory_remember` and `memory_update` (the plugin's `NOT_CURRENT` denial, the proxy's `-32000`), and their message gives the old 24-hour-trim reason, which does not apply to this build. Recall is unaffected. Outside Claude Code, run the `--root` install again.
3. `duplicate: true` means a row with exactly that text exists for the owner, including a retired or expired one (a re-save does not bring it back). The check and the save are two steps, so a save of the same text by another process in between can report `false` for an existing id.

## 0.10.1 (install fixes)

1. A killed installer (SIGTERM, Ctrl-C) now also stops the `bun install` and engine-check processes it started (not anything those start in turn), so they no longer run on and race the next setup.
2. A blank `MNEMOSYNE_LOCK_WAIT_MS` (spaces) keeps the default wait instead of meaning no wait.
3. `--root` pointing at a file is refused with `--root <path> is a file, not a folder` instead of a raw `ENOTDIR`.
4. The README's layout table lists `activity-daily.json`.

## 0.10.0 (install outside Claude Code, owner CLI, guard verdict)

1. `bun bin/install-engine.ts --root <dir> [--store <dir>] [--embeddings]` installs the engine, the proxy and its launcher under one folder, outside Claude Code (issue #43, for Switch): `engine/`, `store/`, `model-cache/`, `plugin/{bin,hooks}`, `bin/mnemosyne-mcp`, `config.json`, `vocabulary.json`, `activity.jsonl` and the marker `.mnemosyne-root`. Folders and the launcher are 0700; `config.json`, `vocabulary.json`, `activity.jsonl` and the marker are 0600; the copied proxy files keep 0644 inside the 0700 `plugin/` folder. A non-empty root without the marker is refused, and so is a `--store` inside `<root>/plugin`. The installer and the launcher read and write nothing under `~/.claude` or `~/.omp` (tested with a fake home and with a missing one). Existing settings, vocabulary and log are kept; the rest is replaced at each run. See the README's "Install outside Claude Code".
2. The install check sends `initialize` before `tools/list`; the new engine is swapped in only after it answers both, as before.
3. An install lock, in both forms: `<engine dir>.lock` (under `--root`, `<root>/engine.lock`). A second install waits up to 10 minutes (`/mnemosyne-setup`: 30 seconds, through `MNEMOSYNE_LOCK_WAIT_MS`) and then exits 3 with `another install holds <path>`; a lock older than 30 minutes is taken over, a running install keeps its lock fresh, and SIGTERM or SIGINT removes the lock before the installer exits. The lock code is the one the activity log already used, now in `bin/lockfile.ts`.
4. `bun bin/owner.ts <path>` prints the owner id for a folder (`--global` prints `global`; a git failure other than "not a git repository" exits 1; submodules and `--separate-git-dir` repos get an id from the wrong folder, a known limit), and `tests/fixtures/owner-golden.json` lists paths and ids for another implementation to check.
5. The proxy's save-guard errors carry `data.verdict`, `block` or `warn`, next to `data.rules`.
6. The launcher template and the owner formula moved out of `hooks/register.ts` into `hooks/launcher.ts` and `hooks/owner.ts`, which import nothing from Claude Code. The plugin's own launcher is byte for byte what 0.9.0 wrote (a golden test), and owner ids are unchanged.

The engine is unchanged: `ENGINE_BUILD` stays `18.12.3-mnemosyne.10`, so no `/mnemosyne-setup` is needed after the update. Known limits of `--root`: Bun writes its own caches under `$HOME` unless `BUN_INSTALL_CACHE_DIR` and `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0` are set, and the engine's logger (pi-utils) puts its logs under `$HOME/<root path>/model-cache/logs` (or `$XDG_STATE_HOME/omp/logs`) when it logs at all; pi-utils has no setting to move them, and a normal install, remember and recall wrote none in the tests. The Windows launcher of `--root` is generated but untested on Windows. The specs in `tests/*.test.ts` need the Claude Code host and run only there; `bun test ./tests/bun ./engine/test` runs anywhere.

## 0.9.0 (dashboard writes and review, importers, session summaries)

1. Dashboard writes. The Memories tab has New memory and Edit (text, kind, tags from the vocabulary, importance, expiry, Pinned, project). A dashboard save passes the same save guard as every other save: a block cannot be overridden, a warning (or a near-duplicate) offers "Save anyway". Rows are saved as source `dashboard`, trust tier STATED. Routes: `POST /api/memory/create`, `/update`, `/retire`, `/restore`; create and update take bodies up to 24 KB, every other route 4096 bytes.
2. Review tab. Retire candidates (with their reasons) and a Not live list with Restore and each row's last audit rows. Retire is one memory at a time, never deletes, and can be restored. Forget stays in the memory detail sheet only. Every memory has one of four states: live, retired, expired (by the sweep) or lapsed (its own expiry passed); Memories shows non-live rows only behind "Show retired".
3. Vocabulary tab. The shared tags by namespace with counts, and the candidates with Admit and "Alias to" (`POST /api/vocabulary/admit` and `/alias`, `GET /api/vocabulary`, `GET /api/review`). The Health tab labels the engine's empty-on-purpose tables "unused by design".
4. `/mnemosyne-import doc <path>` and `/mnemosyne-import session <id | last>`: a dry run, then `apply` after a backup, every candidate checked again by the guard, in the current project only. A session import sends the redacted conversation to the `extractionModel` (Haiku by default); a document import sends nothing.
5. Pinned memories. `memory_update` takes `pinned`; a pinned memory is never a retirement candidate and never expires on its own. Outside agents cannot pin.
6. Session summaries (`sessionSummary`, off by default) and the first-prompt block: the newest summary and up to 5 pinned memories go into a session's first prompt. When on, the redacted conversation of an ended session goes to the `extractionModel` (Haiku by default) in the background.
7. Unused-memory sweep (`expireUnusedDays`, 90 by default, `0` off, 30 minimum): once a day, in the background, memories of the kinds context, event, error and artifact that were neither saved nor recalled for that many days get an end date. Pinned memories and the other kinds are never touched, nothing is deleted, the store is backed up first, and at most 50 per run. Preview: `bun bin/memories.ts --store <store> expire`.
8. Engine log pruning: `omp.*.log` files older than 7 days in the model cache's logs folder are removed (the newest 20 are kept) at session start and by `/mnemosyne-setup`. Setup now names the platforms: embeddings are tested on macOS Apple Silicon only, and an Intel Mac is told they are unsupported.
9. The map's space station threshold is a setting, `map.stationMin` (default 50, 2 to 1000).
10. Activity log: new actions `restore`, `import` and `expire`, and origins `import` and `session`.

No change to `engine/`.

## 0.8.5 (Settings tab)

1. Settings tab. The dashboard has an eighth tab, Settings, where every setting of the memory system shows its value, its default, where it is stored and when a change takes effect. You can change a value (checked against its range first), add or remove list items, reset one setting or all of them (with a confirm), and make a backup now. See the README's Settings section.
2. `config.json`. Every number that was fixed in the code is now a setting in `~/.claude/mnemosyne/config.json` (owner-only, written safely, the old file kept as `config.json.bak`): the guard's warn, max and min lengths, the near-duplicate check and its threshold, the chatter check, extra "never save" words, tags per memory and the auto-admit count, recall counts, the first-prompt recall, the ranking weights, the context-note days, the activity-log size and the backups kept. With no file, every save, recall and tag result is the same as in 0.8.4.
3. The hooks and the outside-agent proxy read the settings on every call, so a change in `config.json` applies on the next save or recall with no restart. Texts that quote a number (the rules block, the tool descriptions) follow the values.
4. Per-tool on/off. Each of the five memory tools can be switched off; the change shows from the next session. Switching `memory_remember` off also removes the remember trigger and the rules block, so Claude is never told to call a missing tool. The outside-agent wrapper serves the tools in `tools.externalAllow`.
5. Plugin options are changed from the tab only through `claude plugin configure`, one option at a time and read back, and take effect after the plugin reloads or Claude Code restarts. Changing `memoryDir` or `scope` asks you to type the new value again.
6. The built-in secret rules, the empty-text block and "no override for a secret" cannot be changed by any setting; extra "never save" words can only add.
7. Four dashboard routes back the tab: `GET /api/settings`, `POST /api/settings/update`, `POST /api/settings/reset` and `POST /api/backup`, behind the same token, Host, Origin, JSON and body-size checks as the others. A settings change adds a `settings` line to the activity log with the setting's name and the kind of value, never the value.
8. The dashboard stays running until the last session that opened or reused it has ended, so one session ending no longer takes the dashboard away from another. A session that crashed does not hold it up.
9. Fix (tests): the refused-swap tests left a 400 MB copy of the engine in the temp folder on every run. They are removed after each run.

No change to `engine/`.
