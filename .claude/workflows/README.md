# Workflows

`fix-issues.js`: reproduce, fix and independently review a batch of GitHub issues, one git worktree per issue, then one more fix round where the review found something. Agents commit in their worktrees and never push; the caller collects the commits.

Args:

```json
{
  "repo": "owner/name",
  "setup": "install command run in each fresh worktree",
  "rules": "extra repo rules for every fix agent (optional)",
  "issues": [{ "number": 15, "title": "...", "location": "file and function", "summary": "what goes wrong", "decision": "intended behaviour, when the owner chose one (optional)", "testHint": "where and what to test" }]
}
```

For this repo, `setup` is `bun install --frozen-lockfile && bun install --cwd engine --frozen-lockfile --production --omit=peer`, and `rules`:

> Do NOT edit engine/UPSTREAM.md, engine/package.json, hooks/engine-build.ts, CHANGELOG.md or .claude-plugin/plugin.json, and do not run scripts/engine-diff.ts: build numbers, change entries and the changelog are added when the fixes are merged. Engine tests go in engine/test/*.spec.ts (see engine/test/helpers.ts), plugin tests in tests/bun/*.spec.ts; run bun test ./engine/test after an engine change.

## Before a run

The worktrees are cut from the local `main` ref, not from the branch you are on, and in a fresh clone that ref can be weeks old. Update it first, or the agents fix old code:

```bash
git fetch origin main && git branch -f main origin/main
```

Then check that a worktree is on the expected commit (`git -C .claude/worktrees/<run>-1 log -1 --oneline`) after the first agent starts. Add `.claude/worktrees/` to `.git/info/exclude` so the runs' checkouts never show as untracked files.
