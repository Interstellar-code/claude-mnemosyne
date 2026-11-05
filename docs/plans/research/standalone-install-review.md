# Review: `docs/plans/standalone-install.md` (issue #43) — 2026-10-31

Read-only review. Baseline `main` at `8dfb382`, plugin 0.9.0, `ENGINE_BUILD` `18.12.3-mnemosyne.10` (`hooks/engine-build.ts:4`).

Verified by reading the code and by running: `bun run typecheck` (clean), `bun test ./tests/bun/engine-build.spec.ts` (4 pass), `bun test ./tests/bun/engine-env.spec.ts` (2 pass), `bun test ./tests/register.test.ts` and `bun test ./tests/*.test.ts` (both fail at module resolution, see F1), a real closure copy of the proxy run from a foreign cwd (F-answers, Q2), and the engine's cache resolver in isolation. The full suite was **not** run.

## Findings, most severe first

### F1 (HIGH) — Gate 2 item 3 (`bun test ./tests/*.test.ts`) is red on `main`, and the plan's explanation for a red baseline is wrong

```
$ bun test ./tests/*.test.ts
error: Cannot find module 'claude-code/testing' from '.../tests/vocab.test.ts'
 0 pass, 11 fail, 11 errors / Ran 11 tests across 11 files
$ bun test ./tests/register.test.ts
error: Cannot find module 'claude-code/testing' from '.../tests/register.test.ts'
```

`tests/register.test.ts:1-4` imports `claude-code/testing`, `claude-code`; `.claude-plugin/types/claude-code/index.d.ts:15590` only *declares* those modules — there is no runtime package (`node_modules/claude-code` absent, nothing in `bun.lock`). The host supplies it. So the gate the plan needs for SA.1 ("the existing `project-...` expectations in `tests/register.test.ts` still pass", SA.1.4) cannot run in this checkout, and SA.1.1 ("Record the baseline") is undefined until that is settled. The plan defers this to the builder ("how `tests/register.test.ts` is run is confirmed by the builder", Gates §2) — that is the one gate that decides whether SA.1 changed plugin behaviour.

Fact 7's cause is also wrong: "caused by this machine having no installed engine". `tests/bun/knowledge-host.ts:71-76` symlinks `ROOT/engine` into the temp HOME's engine scope, so these specs never need an installed engine. My contended `session.spec.ts` run (11 tests failed, all 90 s timeouts) does not support "2 fail, 2 errors" either; see Q6.

**Fix.** Gates = `bun run typecheck` + `bun test ./tests/bun ./engine/test` only, and state that `tests/*.test.ts` needs the Claude Code host to run (or add a documented `claude-code`/`claude-code/testing` stub as a separate, Rohit-approved decision — I confirmed a 3-export stub (`atom`, `read`, `update`) lets `hooks/register.ts` load, so a stub is feasible). Drop the "no installed engine" explanation from fact 7.

### F2 (HIGH) — The lock's stale takeover is a TOCTOU check, weaker than the pattern this repo already has

Plan SA.3.3: "re-read the file immediately before removing a stale lock, and remove it only if still the same". A read-then-`rmSync` is still racy: between the re-read and the unlink another process can create the lock, and the unlink then deletes a live lock. Comparing content cannot make that atomic.

The repo already has the race-free pattern twice — `bin/activity.ts:71-103` (rename to a pid-unique aside, then `linkSync` the aside back if it turned out fresh, because `link` never replaces, then `unlinkSync`), and `bin/memories.ts:510-537` (rename-aside). The second one is the bug in issue #37: `bin/memories.ts:532` computes `fresh`, `:533` `rmSync(aside)`, `:534` tests `fresh` — the file is deleted before the freshness check, exactly what the plan says must not be repeated. So the plan names the right rule but prescribes a mechanism (`rmSync` after re-read) that can still lose a live lock, instead of the `linkSync`-back pattern that cannot.

**Fix.** Reuse `lock()` from `bin/activity.ts:76-103` verbatim (rename-aside + `linkSync` back + `unlinkSync`), wrapped in the installer's poll loop. Say so by citation; do not write a third variant.

### F3 (HIGH) — `--root` would write the launcher 0600, but it must be executable

SA.3.1: "folders 0700, files 0600 on POSIX". Today the plugin chmods the launcher 0700 (`hooks/register.ts:507`; the installed `~/.claude/mnemosyne/bin/mnemosyne-mcp` is `-rwx------`). Switch spawns the launcher path directly — `SWITCH_MEMORY_LAUNCHER`, default `~/.switch/memory/bin/mnemosyne-mcp` (switch-agent epic decision 9, lane-1 brief §Decisions). A 0600 launcher gives `EACCES` on spawn, which fails #43 done-when 1 ("a working engine, proxy and launcher").

**Fix.** Launcher 0700 (POSIX), `config.json`/`vocabulary.json`/`activity.jsonl` 0600, folders 0700. Add an assertion on the mode to SA.3.5(b).

### F4 (HIGH) — `config.json` and `vocabulary.json` are never created, though both issues require them under the root

Issue #43 item 1: "with `--root`, the model cache, store, config, vocabulary and activity log all live under that root". Switch S4 item 2.4: "`store/`, `config.json`, `vocabulary.json`, created 0700 / 0600 if absent; existing ones are kept". SA.3.1 only assigns *paths* ("`vocabulary.json` path, `activity.jsonl` path") and says "existing `store/`, `config.json` and `vocabulary.json` are kept" — nothing creates them. The proxy tolerates both being absent (`bin/settings.ts:38`, `hooks/vocab.ts:118-128`) so nothing fails loudly; tags just stay free-form, and the S4 contract is unmet. A vocabulary needs the store first (`bin/vocab.ts:102`, `initVocabulary(store, root)`).

**Fix.** Add to SA.3: after the engine is swapped in, create `config.json` (defaults, 0600) and run the existing `initVocabulary(store, root)` (0600), skipping both when present; test that a second run does not rewrite either.

### F5 (MEDIUM) — The proxy copy list is hardcoded with no test that it matches the real closure

Decision 2 copies "exactly the proxy's import closure ... computed by a script, not by hand", but no task commits that script or asserts the copy set. A future import added to any of the 11 files silently produces a broken standalone root (the launcher would `Module not found` at first call, in Switch's product, not in this repo's tests).

**Fix.** In the spec: compute the closure (the same walk that produced the list below) and assert the copied file set equals it. That single test covers both drift and the `claude-code` check decision 2 asks for.

### F6 (MEDIUM) — "succeeds as a no-op" is not achievable with today's `install()`

SA.3.5(c) expects the second of two concurrent installs to "wait then succeed as a no-op or exit 3". `install()` (`bin/install-engine.ts:208-232`) has no same-build early return: it always deletes `.next`, re-copies, and re-runs `bun install`. A same-tag rerun is therefore a full reinstall, not a no-op — and adding a skip would change `/mnemosyne-setup` behaviour (a setup after an engine change would stop rebuilding).

**Fix.** Either drop "no-op" from (c) (the issue only asks one to win, the other to wait or exit cleanly), or add an explicit `--skip-if-current` flag used only by `--root`, and let Switch's `install.rs` decide no-op from `memory.json` (S4 item 3 puts that on Switch).

### F7 (MEDIUM) — Windows: only the *store* is validated for `"`/`%`; a `--root` holding them breaks the `.cmd`

`hooks/register.ts:303` refuses `"`/`%` in `memoryDir` because "cmd has no safe quoting for `"` or `%`" (`:549`). `cmdWrapper` interpolates `store`, `cli`, `proxy`, `activity`, `vocabulary`, `root` unquoted-ish (`:551-578`). In `--root` mode the root comes from the command line and is interpolated into all of those, plus `%` triggers cmd variable expansion and `!` breaks under delayed expansion.

**Fix.** Apply the same refusal to `--root` and every derived path on Windows, in the task text, with a test.

### F8 (MEDIUM) — `bin/owner.ts` repo-root detection produces a *real* path where the plugin hashes the *lexical* one

Measured on this machine (linked worktree under `/tmp`):

```
git rev-parse --path-format=absolute --git-common-dir  ->  /private/tmp/wt-test/main-repo/.git
owner formula on /tmp/wt-test/main-repo      ->  project-main-repo-1mb8axh
owner formula on /private/tmp/wt-test/main-repo -> project-main-repo-3hboqf
```

`--git-common-dir` is symlink-resolved by git on macOS, so the CLI's id for a repo reached through a symlink differs from the id the plugin computes from `$.session.repo().root` if the host reports a lexical path. Switch epic §3.5.5 is explicit that the `cwd` is "used as received (lexically normalised, never canonicalised)", and §3.5.2 defines the root as the parent of `--git-common-dir` — those two rules disagree for a symlinked cwd, and the golden fixture would bake whichever one the fixture machine produced.

**Fix.** State it in SA.4.1 (it is a real decision, not a guess): generate the golden fixture with *real* paths, and add one fixture row that reaches a repo through a symlinked path so the divergence is visible rather than silent. Escalate to Rohit/Switch if the fixture cannot satisfy both rules.

### F9 (MEDIUM) — The golden launcher test has no host-free place to live

SA.1.1 wants "a test that captures today's `shWrapper` and `cmdWrapper` output ... before changing anything". `hooks/register.ts:15` imports `atom, read, update` from `claude-code` at load (`:147`, `:150` call `atom()`), so a spec in `tests/bun/` cannot import it (verified: `Cannot find module 'claude-code'`), and `tests/register.test.ts` cannot run here at all (F1). Without a defined home the builder will either skip the golden or write it inside the host harness that does not run.

**Fix.** Capture the golden once with a throwaway script over a stub host (I confirmed a 3-export stub loads `register.ts`: 26 exports), commit the strings as literals in `tests/bun/launcher.spec.ts` which imports the new host-free `hooks/launcher.ts`. Note in SA.1.4 that byte equality is then proven by `tests/bun`, i.e. inside a gate that actually runs.

### F10 (MEDIUM) — `cmdWrapper`'s bytes depend on the *source file's* line endings

`hooks/register.ts:550-578` writes each cmd line as `\r` followed by a real source newline (`set "...="\r` then EOL). There is no `.gitattributes` in the repo. Move that template into `hooks/launcher.ts` written with CRLF (a Windows checkout, a builder that "fixes" endings) and every `.cmd` line becomes `\r\r\n` — a silent behaviour change that only a byte-exact golden catches.

**Fix.** Build the cmd text with explicit `\r\n` (e.g. `lines.join('\r\n')`) instead of relying on source endings, assert `!/\r\r\n/` in the golden test, and add `.gitattributes` with `*.ts text eol=lf`.

### F11 (LOW) — Fact 3 miscounts the `PI_CONFIG_DIR` sites

One literal, four consumers, plus one independent literal: `EMBEDDINGS_CACHE_DIR = '.claude/mnemosyne/model-cache'` (`hooks/engine.ts:15`) feeding `engineEnv` (`:81`), `shWrapper` (`hooks/register.ts:540`) and `cmdWrapper` (`:573`), and a separate hardcoded string in `bin/install-engine.ts:145`. The plan says "three places" and cites two. The conclusion (an absolute path needs no engine change) is correct — I verified the resolver: absolute → `<dir>/cache/fastembed`, relative → `<HOME>/<dir>/cache/fastembed`, unset → `<HOME>/.omp/cache/fastembed` (`engine/src/core/embeddings.ts:74-81`).

### F12 (LOW) — Fact 7's line range for the wrapper test is off; the test spans `:814-841`

`:835` asserts `PI_CONFIG_DIR=.claude/mnemosyne/model-cache`, `:840` asserts the chmod; only the first is inside the cited `:814-833`.

### F13 (LOW) — Moving `owner()` also needs `GLOBAL_OWNER` and must not fork `slashes`

`owner()` reads `GLOBAL_OWNER` (`hooks/register.ts:110`) and `slashes` (`:281`, used at 24 sites in the file). SA.1.3 mentions only "the `slashes` helper it needs". If `slashes` is copied rather than imported, two implementations drift; `GLOBAL_OWNER` is simply missing from the task.

**Fix.** `hooks/owner.ts` exports `ownerId`, `GLOBAL_OWNER`, `slashes`; `register.ts` imports all three and deletes its local `slashes`/`GLOBAL_OWNER`.

### F14 (LOW) — Standalone roots get a wrong remedy in the proxy's build refusal

`bin/mcp-proxy.ts:187`: "… Run /mnemosyne-setup in Claude Code." For a Switch install that command does not exist. Not a blocker (the mismatch cannot happen for a matched tag), but Switch's provider maps the text to `provider_refused` and shows it.

**Fix.** Either leave it (and say so in SA.6's Switch note) or make the trailing sentence come from an env var the launcher sets.

### F15 (LOW) — New `hooks/*.ts` files are not in `tsconfig.bun.json`

`tsconfig.bun.json:9` lists hooks files individually (`surface`, `engine-build`, `tags`, `vocab`, `guard`, `import`, `settings`, `backfill`, `knowledge`, `activity-log`, `ui-pid`, `engine`). `bin/` is wholesale, so `bin/owner.ts` is covered; `hooks/launcher.ts` and `hooks/owner.ts` would only be checked by `tsconfig.json`'s host-flavoured `hooks` include.

**Fix.** Add both to `tsconfig.bun.json`'s include in SA.1 or SA.6.

### F16 (LOW) — A 120 s lock wait is shorter than a worst-case install

`INSTALL_STEP_TIMEOUT_MS` 240 s + `INSTALL_CHECK_TIMEOUT_MS` 300 s = 540 s (`hooks/engine-build.ts:10,13`, below `SETUP_TIMEOUT_MS` 600 s at `:9`). A second install that waits only 120 s exits 3 in the middle of a perfectly healthy first install. Allowed by the issue ("waits or exits cleanly") but worth stating as a deliberate choice; Switch's first-run path treats exit 3 as "someone else is doing it".

### F17 (LOW) — The positional form gets no lock, so two `/mnemosyne-setup` runs still collide

Issue item 3 says "a lock file in the target root". In positional mode there is no root; the natural target is the engine dir. As written, only `--root` is protected, so the plugin's own concurrent-setup race (two sessions, same engine) stays open.

**Fix.** Lock `<engine>.lock` in both modes (the `--root` root's engine is `<root>/engine`, so one file covers both).

## Answers

### Q1 — Is any task missing a step that would make #43's "done when" fail?

Yes, four:

1. **Done-when 3, "typecheck and the existing suite pass"** — the only gate that reaches the plugin's behaviour (`tests/register.test.ts`) cannot run in this checkout (F1). Without a stated runner the builder reports red.
2. **Done-when 1, "a working … launcher"** — the launcher would be 0600 (F3), which Switch cannot spawn.
3. **Done-when 1, "nothing under `~/.claude` is read or written"** — SA.3.5(a) hashes a fake `~/.claude` tree, which proves *no writes*. Add the read proof cheaply: run the whole `--root` install and one launcher `initialize` with `HOME` pointing at a directory that does not exist, and require success (the engine's only `$HOME` fallbacks are `.omp`/`.hermes`/`.mnemopi`, `engine/src/core/embeddings.ts:79`, `config.ts:19-22`, and none is reached once `PI_CONFIG_DIR`/`MNEMOPI_DATA_DIR` are pinned).
4. **Issue item 1's "config, vocabulary … under that root"** — never created (F4).

Everything else in the done-when list is covered: the exported template comparison (SA.1), staged swap (existing code, `bin/install-engine.ts:225-290`), and the lock/`owner`/`data.verdict` tests (SA.3, SA.4, SA.5). One nuance for SA.3.4: the check **does not** send `initialize` (`bin/install-engine.ts:150-156` sends `tools/list` as id 1, then remember/recall). The engine answers `tools/list` with no prior `initialize` (`engine/src/mcp-server.ts:72-85`; verified live), so adding `initialize` is behaviourally a no-op but is required by issue item 2's wording — the plan's "confirm … if it does not, add it" is right, and this is the answer, so the builder does not need a cycle to discover it.

### Q2 — Is decision 2's import-closure claim true, including transitive imports?

**Yes.** Closure of `bin/mcp-proxy.ts`, computed by walking relative imports and confirmed by running a copy:

| file | imports |
|---|---|
| `bin/mcp-proxy.ts` | `node:fs`, `node:path`, `../hooks/{activity-log,engine-build,guard,kinds,surface,tags,vocab,settings}`, `./activity`, `./settings` |
| `bin/activity.ts` | `node:fs`, `node:path`, `./settings` |
| `bin/settings.ts` | `node:fs`, `node:path`, `../hooks/settings` |
| `hooks/vocab.ts` | `./tags` |
| `hooks/activity-log.ts`, `hooks/engine-build.ts`, `hooks/guard.ts`, `hooks/kinds.ts`, `hooks/settings.ts`, `hooks/surface.ts`, `hooks/tags.ts` | none |

11 files, no dynamic `import()`, no `require()`, no `claude-code` anywhere in the set. `hooks/settings.ts` really does import nothing (`:18` states the rule; `grep '^import'` finds none — an earlier regex of mine matched a string literal, not an import).

Verified end to end: copied exactly those 11 files to `/tmp/clos-check/{bin,hooks}` (no `package.json`), then from `/` ran `bun /tmp/clos-check/bin/mcp-proxy.ts` with `MNEMOSYNE_CLI` pointing at the installed engine — `initialize`, `tools/list`, `memory_remember` (stored), `memory_recall` (1 result), two activity lines written. So "the proxy runs from any folder that holds those files" holds, and `<root>/plugin/{bin,hooks}` preserves the `../hooks/x` layout.

One correction to the fact's wording: `hooks/ui-launch.ts:17` also names `claude-code`, but as `import type`, which is erased — so `register.ts:15` is the only *runtime* host import in `hooks/`+`bin/`. That does not widen the closure (nothing imports `ui-launch.ts` from the proxy), but the fact's "only … register.ts and ui-launch.ts do" is imprecise.

### Q3 — Are the lock rules safe (races, stale takeover, Windows)?

Not yet.

- **Race:** read-then-`rmSync` is TOCTOU (F2). Use the `linkSync`-back rename pattern already at `bin/activity.ts:76-103`.
- **Stale takeover:** "pid is gone" is advisory at best — pid reuse, containers sharing a root, `EPERM` for another user's pid, a clock jump backwards making "older than 30 minutes" false. Make mtime the authoritative rule and pid only a comment in the file; do not delete on "pid gone" alone.
- **Release:** `finally` is right, but the lock file must be closed immediately after `openSync(..., 'wx')` (the existing helpers do) — on Windows an open handle blocks `renameSync`/`rmSync`, so a held handle turns every stale takeover into a wait.
- **Windows:** `'wx'` is fine; rename-aside to a pid-unique name is fine (a plain `renameSync` over an existing file would fail). Refuse `%`/`!`/`"` in the root (F7).
- **Coverage:** positional mode is unprotected (F17), and 120 s < 540 s worst case (F16).

### Q4 — Does moving `shWrapper`/`owner` out of `register.ts` risk changing plugin output?

Mechanically, no — **if** four things hold, and the plan only states one of them:

1. The templates move verbatim, including `WRAPPER_NOTE` and both `.replace()` chains (`hooks/register.ts:511`, `:551`), and the launcher still receives `guardModeOf(options)` and `${root}/${VOCAB_FILE}` (`:505-506`). Stated (SA.1.2) and covered by the golden test.
2. The new `modelCacheDir` parameter defaults at the plugin call site to `EMBEDDINGS_CACHE_DIR`, so `PI_CONFIG_DIR=.claude/mnemosyne/model-cache` is unchanged (`:540`, `:573`; asserted at `tests/register.test.ts:835`). Stated.
3. **CRLF:** the `.cmd` template's bytes come from the source file's newlines today (F10). Not stated.
4. **`GLOBAL_OWNER` and `slashes`:** both must move or be imported, not duplicated (F13). Not stated.

Two further shape notes: the function already takes 8 positional parameters (`:518`); exposing it as Switch-facing API with a 9th positional invites an argument-order mistake — prefer an options object. And the golden test needs a host-free home (F9), otherwise the "byte equality" proof lives in a suite that cannot run here.

`owner()` itself is pure once given a root (`:457-464`), so its move cannot change output; only the two host calls stay behind (`$.session.repo()`, `$.session.cwd()`).

### Q5 — Is the task order and test plan sufficient; what to cut or add?

Order is right: SA.1 → SA.2 → SA.3 → SA.4 → SA.5 → SA.6. SA.1 must precede SA.3 (the installer consumes the launcher module); SA.2 must precede SA.3 (the launcher needs the cache parameter). SA.4 and SA.5 are independent of each other and of SA.3 and can run in parallel with it.

**Cut / merge**
- Merge **SA.2 into SA.3**. Both touch `hooks/engine.ts`, `hooks/register.ts`, `bin/install-engine.ts`; SA.2 alone is three small edits and one spec, and splitting it guarantees one extra round-trip and one extra commit on the same files. Keep its test (absolute `PI_CONFIG_DIR` → `<dir>/cache/fastembed`; verified true) inside SA.3.
- Drop `--source <checkout>` from SA.3.1 (the default "the checkout the script runs from" is the only case Switch has), unless Switch's `install.rs` needs it — nothing in the lane-1 brief or issue #5 asks for it.
- Drop the "Windows `.cmd` generated but not tested" ambition to a one-line changelog note (already decision 5) and do not spend a test on it.

**Add**
- The lock mechanism by citation (F2), the launcher mode 0700 (F3), `config.json`/`vocabulary.json` creation (F4), the closure-drift test (F5), the `--root`/derived-path `"`/`%`/`!` refusal (F7), the symlink/real-path fixture row (F8), the host-free golden home (F9), the `\r\r\n` assertion and `.gitattributes` (F10), `tsconfig.bun.json` entries (F15), and the `HOME`-absent read proof (Q1.3).
- The `lock` tests should include: dead-pid takeover, a *fresh* lock that must not be taken, `exit 3` message text `another install holds <path>`, and the lock removed after a **failed** install (SA.3.5 has the first three; the last is only implied by "released in a `finally`").

### Q6 — What I could not verify

1. **The baseline counts in fact 7** (1005 s, 1418 pass, 2 fail, 2 errors across 70 files). Not reproduced: I did not run the full suite, and my `session.spec.ts` runs were contended (two runs overlapped, 11 failures, all 90 s timeouts, `engine exited 143` and `SQLITE_CANTOPEN` mixed in). The stated *cause* is wrong regardless (F1). The arithmetic does check out: 53 `tests/bun/*.spec.ts` + 17 `engine/test/*.spec.ts` = 70.
2. **Whether `tests/register.test.ts` can be run outside the Claude Code host.** Verified only that it cannot run in this checkout as-is; how Rohit runs it is unknown to me.
3. **The host's `session.repo().root`** — lexical or resolved, and whether `session.cwd()` is normalised. Not in this repo (`hooks/register.ts:459` calls it; no `rev-parse` anywhere in `hooks/`, `bin/`, `ui/`, `scripts/`). This is what F8 turns on.
4. **Windows behaviour** — `cmdWrapper`, `chmodSync` skips, lock file semantics. Never run on Windows; the plan says so too.
5. **Switch's `install.rs` / `switchctl` side** — out of scope here; read only the lane-1 brief and issue #5. In particular whether `switchctl memory setup` treats exit 3 as "another run is doing it" is unverified.
6. **`engine/src` modules that would touch `$HOME` outside the pinned dirs** — `content-sanitizer.ts:23` (`.hermes/mnemopi/blobs`), `cost-log.ts:5` (`.mnemopi/data`), `plugins.ts:5` (`.hermes/mnemopi/plugins`) all derive from `homedir()`, but I found no importer for any of them in this build (`sanitizeContent`/`storeBlob`/`PluginManager` have no call sites outside their own files), so they are unreachable on the MCP path. "Nothing in `engine/src` needs `.claude`" is verified: the only occurrence is the comment at `engine/src/core/embeddings.ts:65`.
7. **The `.cmd` golden strings** — not captured; no Windows host here.

## Fact check against the source

| # | Claim | Verdict |
|---|---|---|
| 1 | `register.ts` imports `atom, read, update` at `:15`, calls `atom()` at `:147`, `:150`; `shWrapper`:518, `cmdWrapper`:550, `shellQuote`:476, `WRAPPER_NOTE`:510, `owner()`:457 all unexported; a plain script cannot import it | **True.** Import fails without the host (`Cannot find module 'claude-code'`); loads with a stub. All five symbols confirmed unexported at those lines. Nuance: `ui-launch.ts:17` is `import type` only |
| 2 | Proxy imports only `bin/{activity,settings}` + `hooks/{activity-log,engine-build,guard,kinds,surface,tags,vocab,settings}`; none imports `claude-code`; build check at `:185` | **True.** 11-file closure listed in Q2, run end to end from a foreign cwd. `:185` exact |
| 3 | `PI_CONFIG_DIR` hardcoded in "three places": `engine.ts:15`, `install-engine.ts:145`; resolver at `embeddings.ts:78`; absolute paths work unchanged | **True conclusion, wrong count/citation.** One literal at `engine.ts:15` consumed at `:81`, `register.ts:540`, `:573`, plus a second literal at `install-engine.ts:145`. Resolver verified for absolute/relative/unset |
| 4 | `install-engine.ts` stages to `.next`, checks `tools/list` + remember/recall with embeddings, swaps with `.old` rollback, restores after a crash; positional paths; no lock, no `--root` | **True.** `:225-227` restore, `:150-156` check, `:273-290` swap, `:336-340` CLI, no lock anywhere. **Add:** the check does **not** send `initialize` (SA.3.4's question, answered) |
| 5 | Owner formula `:457-464`; repo root from the host; djb2 per char; `project-<name>-<base36>` | **True.** Also: the loop iterates **code points** and takes the first UTF-16 unit, so astral chars hash differently from a naive per-unit loop — verified: `😀` gives `yhodqn` (code point) vs `pk60f` (unit); `naïve`/`日本語` agree. The epic's §3.5.3 wording matches the code |
| 6 | Guard errors `-32602` + `data:{rules}` at `:203` (block) and `:216` (warn, strict or chatter, no confirm); other `-32602` at `:231,:236,:242,:252,:258` carry no data | **True.** All seven lines exact |
| 7 | Test files `{install-engine,mcp-proxy,engine-env,engine-build}.spec.ts`, `register.test.ts` wrapper at `:814-833`; no test calls `shWrapper`/`owner()`; baseline 1418/2/2 | **Partly.** Files exist; no direct calls to either symbol (true). Range is `:814-841`, not `:833`. Baseline counts **unverified**, and the stated cause is wrong (`tests/bun/knowledge-host.ts:71-76` symlinks the repo engine). See F1 |

Also verified as stated in the Summary: `engine/UPSTREAM.md:3-5` (vendored `@oh-my-pi/pi-mnemopi` 18.12.3, installed from `engine/` not npm); the four `@oh-my-pi` deps pinned to `18.12.3` with `fastembed 3.0.0` (`engine/package.json`, asserted by `tests/bun/engine-build.spec.ts:17-23`); `install-engine.ts` restates the four via `file:./pi-mnemopi` (`:244-250`); `bun.lock` exists at the repo root and in `engine/`, but the *installed* engine has none (`bun install --production` saves none, `:260-262`), so "there is no lockfile" is true of what ships, false of the repo.
