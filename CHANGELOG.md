# Changelog

Newest first. Each release is tagged `vX.Y.Z` on GitHub; the README and DESIGN.md describe the contracts.

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
