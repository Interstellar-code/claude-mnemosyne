# Changelog

Newest first. Each release is tagged `vX.Y.Z` on GitHub; the README and DESIGN.md describe the contracts.

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
