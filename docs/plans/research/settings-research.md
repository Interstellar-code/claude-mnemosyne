# Settings tab (0.8.5): research

Date 2026-10-25. Repo `/Users/rohits/Development/claude-mnemosyne`, main at `59d1f3e` (0.8.4). Read-only homework: no code was changed. Line refs are to the working tree as read today. "inferred" means read from code or docs but not run. The only commands run were read-only (`claude plugin configure mnemosyne@mnemosyne --json` showed the schema and the current values; no write was tried).

Heads-up: the working tree was not clean while I read it (`git status` showed ` M ui/app.ts`, `tests/bun/solar-page.spec.ts`, `tests/bun/solar-panel.spec.ts`): another lane is editing `ui/app.ts` right now. The branches `map/*` and `Interstellar-code/v3-lane-*` also exist.

---

## 1. Every plugin option today

### 1.1 How Claude Code stores and hands over the options

1. Declared in `.claude-plugin/plugin.json` `userConfig` (10 fields). Plugin type: `claude plugin validate` treats a `userConfig` option as a strict object; the keys used are `type`, `title`, `description`, `default`, `options`, `multiple` (`https://code.claude.com/docs/en/plugins-reference`, "User configuration"). `number` fields may also carry `min`/`max` (docs).
2. Stored by Claude Code in `pluginConfigs["<plugin>@<marketplace>"].options` of the user's `~/.claude/settings.json` (docs: "Non-sensitive values are saved under `pluginConfigs` in the user's `settings.json`"; the settings page lists `pluginConfigs` as valid in "User or managed" only). Verified on this machine: `~/.claude/settings.json` holds `pluginConfigs["mnemosyne@mnemosyne"].options` with only 5 keys (`scope`, `externalMcp`, `memoryDir`, `rememberTerms`, `recallTerms`). The other 5 are unset and fall back to the `plugin.json` default.
3. Handed to the plugin as the second argument of `register(on, options)` (`hooks/register.ts:1273` area, `export const register: Register = (on, options)`). Type comment in `.claude-plugin/types/claude-code/index.d.ts:7805-7822` (`PluginOptions`): "the values of the fields its manifest's `userConfig` declares, defaults filled in ... a stored value outside `options` counts as unset". Index.d.ts:9704-9713: "The options are fixed for this activation: a change to them reloads the plugin and `register` runs again with the new object. Hooks close over it."
4. The docs also export every option to shell-form hook processes as `CLAUDE_PLUGIN_OPTION_<KEY>`. The plugin does not use that: no `CLAUDE_PLUGIN_OPTION` or `pluginConfigs` string exists anywhere in `hooks/`, `bin/`, `ui/` (grep, zero hits). The hooks module gets the object directly; the dashboard server and the MCP proxy get only what the hook copies into their env (below).
5. Official writers of the value: the `/config` panel and `/plugin` dialog (every non-`multiple` option is a `/config` row, docs), the CLI `claude plugin configure <id> --values-stdin` (JSON object of single-line strings; "options left out keep their values", `--help` output), and the hooks API `$.config.set({ key: '<plugin>.<field>', value })` (index.d.ts:3176-3204, "through the other plugins' hooks, this plugin's own skipped"; `{deny}` on a refusal). Verified `claude plugin configure mnemosyne@mnemosyne --json` returns `schema`, `inputs`, `choices`, `configured`, `unconfigured` (Claude Code 2.1.310).
6. The plugin already writes options through the CLI: `fillDefaults` (`hooks/register.ts:632-644`) runs `claude plugin configure <name>@<name> --json` then `--values-stdin` to fill blank `memoryDir`, `rememberTerms`, `recallTerms` (comment: "never by editing settings.json"; a `--plugin-dir` plugin has no installed id and is left alone). After it, the reply says "restart Claude Code to see them in /plugin" (`register.ts` setup handler, near line 1394).
7. A list option is passed as a comma-joined string by the CLI (`inputs.rememberTerms` is `"remember:, remember that, ..."`; the `terms()` helper at `register.ts:~190` comments "`claude plugin configure` stores a list as one comma-joined string" and splits on commas). A boolean is the string `"true"`/`"false"` in `choices`/`inputs`.

### 1.2 Per option

| Option | Type, default, allowed | Read by | When a change takes effect | User-adjustable from the dashboard? |
|---|---|---|---|---|
| `scope` | string, `global`; `global`/`per-project` | `register.ts:346` `owner()` (every call), `:1275` `isPerProject` (closure) | next plugin activation (reload) | risky: changes which owner id every later call uses, so visible memories change at once; old rows are not moved (inferred from `owner()`) |
| `showActivity` | string, `on`; `on`/`status`/`off` | `register.ts:646` `activity()` | next activation | yes (cosmetic) |
| `activityLog` | string, `on`; `on`/`off` | `register.ts:388` (wrapper env), `:676` `record()`, `:1422` (dashboard env) | hooks: next activation; proxy: next wrapper rewrite (session start) AND client restart; dashboard: server restart (env snapshot `MNEMOSYNE_ACTIVITY_LOG`) | yes, with a "restart needed" note |
| `guardMode` | string, `strict`; `strict`/`warn` | `register.ts:96` `guardModeOf`, used in `tool.call` (`:1500+`) twice; `bin/mcp-proxy.ts:74` reads `MNEMOSYNE_GUARD_MODE` once at start | hooks: next activation; proxy: wrapper rewritten at session start (`register.ts:378` `syncWrapper`) then the client must restart | yes |
| `memoryDir` | string, `~/.claude/mnemosyne/store`; absolute or `~/...` | `register.ts:236` `paths()` (every call); also passed to the dashboard at start (`MNEMOSYNE_STORE`) and to the wrapper | hooks: next activation; dashboard: server restart | risky: points everything at another (probably empty) store; nothing is copied. Rules in `paths()`: absolute or `~/`; not inside `~/.omp`; not inside `<root>/engine`, `engine.next`, `engine.old`; on Windows no `"` or `%` |
| `rememberTerms` | string, `multiple`, 4 defaults; `none` turns off | `register.ts:1653` `terms()` (at register) | next activation | yes; list editor, split on commas, `none` |
| `recallTerms` | string, `multiple`, 3 defaults; `none` turns off | `register.ts:1654` | next activation | yes |
| `externalMcp` | boolean, `false` | `register.ts:382` `syncWrapper` (session.start and setup); `:1403` setup reply | next session start (wrapper written or removed); an outside client must be restarted | yes |
| `extractionModel` | string, `haiku`; alias, full id, or `off` | `hooks/backfill.ts:25` `extractionModelOf` (blank counts as `haiku`; today the stored input is `""`), `register.ts:939` `extraction()` per save, `:1359`-ish dashboard env `MNEMOSYNE_EXTRACTION` (`ui/server.ts:1631`) | hooks: next activation; dashboard: shows what it started with until restart | yes; free text, `off` allowed |
| `embeddings` | string, `auto`; `auto`/`on`/`off` | `register.ts:282` `embeddingsSetting`, `:321` `embeddingsOn` (per engine call), setup handler; dashboard env `MNEMOSYNE_EMBEDDINGS` (`ui/server.ts:178`) | `off` takes effect at the next activation; turning it `on` also needs the model downloaded by `/mnemosyne-setup` (marker `embeddings.json` + 5 model files), else it stays off | yes for the value, but "on" must show "needs setup" if the model is missing |

### 1.3 Can the dashboard server write a new value safely, and to which file?

1. The dashboard server (`ui/server.ts`) is a separate Bun process started by the hook (`hooks/ui-launch.ts:136-165`). It knows only its env: `MNEMOSYNE_ROOT`, `STORE`, `CLI`, `ACTIVITY_LOG`, `PLUGIN_ROOT`, `EXTRACTION`, `EMBEDDINGS`. It does not know `scope`, `guardMode`, `showActivity`, `externalMcp`, the terms, or the plugin id. It has no channel to the hooks module (its output after the first ready line is "drained and dropped", `ui-launch.ts` start loop).
2. Writing path A, the CLI: the server spawns `claude plugin configure mnemosyne@mnemosyne --values-stdin` with `{"guardMode":"warn"}`. This is the official, validated route and the one `fillDefaults` already uses. Unverified: that `claude` is on the server's PATH (the server inherits the hook's env, inferred yes), that a value outside `options` is refused by the CLI, and that a running session reloads the plugin after an external CLI write (the plugin's own reply tells the user to restart Claude Code, so assume NOT live).
3. Writing path B, edit `~/.claude/settings.json` directly (`pluginConfigs["mnemosyne@mnemosyne"].options.<key>`). Works in principle, but the file holds the user's permissions, hooks and env, so a bad write is a real risk, and the repo's own comment forbids it. Not recommended.
4. Writing path C, `$.config.set` inside the hook process (live reload, engine-sanctioned). Needs a message from the server to the hook; none exists. A slash command (for example `/mnemosyne-settings key=value`) could call it from inside Claude Code, but that is not "a tab in the dashboard".
5. Reading: `claude plugin configure mnemosyne@mnemosyne --json` returns the full schema (title, description, default, options, multiple, type) plus the current `inputs` and which keys are `configured`. A Settings tab can draw itself from that schema with no hard-coded option list, so the 0.9.0 options (`sessionSummary`, `expireUnusedDays`) appear on their own.
6. Settings that do NOT live in `userConfig` today (thresholds, limits) need a new home: a plugin-owned file `<root>/config.json` (mode 0600, written by tmp + rename), the same pattern as `vocabulary.json`, `projects.json`, `embeddings.json`. Hooks read it with `$.fs.read` per call, the proxy with `readFileSync` per call (as it does the vocabulary, `bin/mcp-proxy.ts:~66`), the server directly. A change then takes effect on the next call with no reload. This is a design choice for Rohit (see open questions).
7. Tests hazard: any test that exercises a write path must not touch the real `~/.claude/settings.json` (`tests/bun/no-real-home.spec.ts` exists for this; v3 plan HARDEN.2). The `claude` CLI call needs a stub.

---

## 2. `/mnemosyne-setup`

### 2.1 What it is

1. A slash command registered at every `session.start` (`hooks/register.ts:1326`, `$.command.register({ name: 'mnemosyne-setup', ... })`) and handled by `on('command.run', { command: 'mnemosyne-setup' })` (`register.ts:1358-1405`). There is no `commands/` or `skills/` folder; `hooks/hooks.json` is `{"modules":["./register.ts"]}`. Sibling commands: `mnemosyne-tags`, `mnemosyne-ui`, `mnemosyne-knowledge`, `mnemosyne-embed`.

### 2.2 Step by step

1. `bun --version` must work, else it says to install Bun.
2. `paths()` resolves root `~/.claude/mnemosyne`, engine `<root>/engine`, store, wrapper (`register.ts:236`).
3. `secure()` creates `<root>` and the store, owner-only (0700 on macOS and Linux).
4. Decides embeddings from the option: `on`, or `auto` and macOS arm64 (`isMacArm64` via `uname`). If yes it tells the user the model comes from huggingface.co (about 63 MB).
5. Runs `bun bin/install-engine.ts <plugin root> <engine> <store> [embeddings]` with a 600 s limit (`SETUP_TIMEOUT_MS`, `hooks/engine-build.ts:9`). The installer (`bin/install-engine.ts`): copies the plugin's own `engine/` (no `node_modules`, no `test`) to `<engine>.next/pi-mnemopi`, writes a package.json naming `@oh-my-pi/pi-mnemopi = file:./pi-mnemopi`, runs `bun install` there (production, no peers, 240 s per step), checks that the new cli answers `tools/list` with `mnemopi_update`; with embeddings it also saves and recalls a test memory in a throwaway store and requires a `memory_embeddings` row (300 s, downloads the model on this run); only then renames `<engine>` to `.old`, `.next` to `<engine>`, deletes `.old`. On any failure `.next` is deleted and the old engine stays.
6. Writes (embeddings on) or removes (off) the marker `<root>/embeddings.json` (`register.ts:~330`, 0600, rename into place). If the check says the model did not load it removes the marker and reports "Embeddings are off".
7. `syncWrapper()` rewrites or deletes `<root>/bin/mnemosyne-mcp` according to `externalMcp`.
8. `fillDefaults()` saves the three defaults through `claude plugin configure` if blank.
9. Calls `mnemopi_stats` and prints "Mnemosyne ready" with engine path, store, wrapper hint, saved defaults, embeddings note.

### 2.3 What it downloads or builds, and the state it writes

1. Engine install about 135 MB, about 280 MB more with embeddings (README Setup). Model `BAAI/bge-small-en-v1.5` (`hooks/engine.ts:14`), repo `Qdrant/bge-small-en-v1.5-onnx-Q`, files in `<root>/model-cache/cache/fastembed/Qdrant_bge-small-en-v1.5-onnx-Q/` (`register.ts:265-280`: `model_optimized.onnx`, `tokenizer.json`, `tokenizer_config.json`, `config.json`, `special_tokens_map.json`). HF host pinned to `https://huggingface.co` (`engine.ts:70`).
2. State: `<root>/engine/` (+ the `engine.next`/`.old` swap folders), `<root>/embeddings.json`, `<root>/bin/mnemosyne-mcp`, `<root>/model-cache/`, store folder, and three `pluginConfigs` values.

### 2.4 What could be a setting or a UI action

| Item | Today | In the UI? |
|---|---|---|
| Status: engine installed, build matches `ENGINE_BUILD` (`18.12.3-mnemosyne.10`), embeddings marker and 5 model files present, wrapper present, Bun version | computable with file stats; `/api/health` already returns `engine` and `plugin` versions (`ui/server.ts:266`) | yes: a read-only "Setup status" card. Cheap; the server already knows `config.cli`, root, store |
| Re-run setup | only inside Claude Code (`$.process.run` in the hook) | show the command `/mnemosyne-setup` with a copy button. A server-side re-run is NOT recommended: steps 6-8 live in `register.ts` and the swap replaces the engine folder while the server's own engine processes may be running (inferred) |
| Download the embeddings model | part of setup, needs the `embeddings` option on or auto on macOS arm64 | status plus "run /mnemosyne-setup"; no separate button |
| Fill vectors (`/mnemosyne-embed apply`) | command; backs up first (C9), up to 600 s, about 3 GB peak memory on a real store (README) | show count of memories with no vector (read-only); the apply stays a command |
| Rebuild vectors (model change) | `/mnemosyne-embed rebuild`; wipes every vector | never a button |
| Backups | `bin/memories.ts backup`: `VACUUM INTO <root>/backups/mnemopi-<stamp>.db`, 0600, keeps `BACKUP_KEEP = 10` (`bin/memories.ts:261-262`) | list backups (name, size, date) read-only; optional "keep N" setting; a "back up now" button would be a new server write path (low risk, it only adds a file) |

---

## 3. Guardrails (`hooks/guard.ts` and its callers)

Callers: `hooks/register.ts` `tool.call` (`:1501`, `admit({content, kind, origin:'tool'})`), `bin/mcp-proxy.ts` (origin `proxy`, own guard code `~:128-165`), `bin/guard-audit.ts` (read-only store audit). The dashboard server does not call it yet (no write routes). `admit()` takes no configuration; every constant is module-level.

### 3.1 Rules and numbers

| Rule | What it does | Hard-coded value | Verdict | User-adjustable? |
|---|---|---|---|---|
| G1 secrets | 8 patterns: AWS access key `AKIA...`, GitHub token `gh[pousr]_`, `sk-` keys (incl. `sk-proj`/`sk-ant`/`svcacct`/`admin`), Slack `xox[abp]-`, JWT, private key header, Bearer token with a digit, URL with credentials (`guard.ts:32-43`); plus an assignment rule: `password`/`passwd`/`secret`/`api_key`/`token` then `=` or `:` then 12+ non-space chars, unless the value starts with a path, `$`, `<`, `{`, `%`, `process.env`, `os.environ`, `env.`, `http(s):` (`:46-48`) | the lists, the `{20,}`, `{8,}`, `{10,}`, `12` quantifiers | block, no override (the `confirm` flag does not reach it) | no for the built-ins. Allow ADD-ONLY extra patterns (a list of regex strings) with a validity and length check; never let a user remove or loosen the built-ins. Risk: a bad regex can hang a save (ReDoS), so cap pattern length and test against a time budget |
| G2 size | empty or `< MIN_LENGTH` blocks; `> MAX_LENGTH` blocks; `> WARN_LENGTH` warns (`guard.ts:26-28,69-76`) | `MIN_LENGTH 15`, `WARN_LENGTH 1500`, `MAX_LENGTH 4000` | block / warn | yes for WARN and MIN (within sane bounds). MAX: yes up to a ceiling; the engine caps embeddings input at 8192 chars (`engine/src/config.ts:118`), the extraction prompt shows 4000 (`hooks/backfill.ts:33`), and the planned dashboard body cap is 24 KB (v3 CRUDX.1). Suggest ceiling 8000 (inferred; Rohit decides). `WARN < MAX` must hold. Empty text must stay blocked |
| G3 near-duplicate | `mnemopi_similar` with `top_k: 3`, `min_score: NEAR_DUPLICATE_SCORE`; matches the save itself (score >= 0.9999 and same first 80 chars in the saver's own rows) are skipped; the memory named in `replaces` is skipped (`guard.ts:107-143`, `register.ts:560`) | threshold `0.88`, `top_k 3`, preview 80 chars, self-match 0.9999 | warn (strict mode refuses until `confirm: true`); fails open when embeddings are off | threshold: yes (0.80 to 0.99). On/off: yes (it only runs with embeddings). `top_k`: low value, leave fixed |
| G4 chatter | warn when text has a date AND a status word (`released|merged|done|next|overnight|round`), or contains `today|tonight|this session`; skipped for kinds `context`, `event`, `instruction`, `preference`, `decision` (`guard.ts:78-91`) | the date regex (ISO, `d/m/yyyy`, month names), the 6 status words, 3 now-words, the 5 exempt kinds | warn | on / warn / off per rule: yes. Edit word lists: possible (add-only is safest). Exempt kinds: possible but low value |
| Mode | `guardMode`: `strict` (warn becomes a refusal until `confirm: true`) or `warn` (store flagged, `metadata.guard`) (`register.ts:96`; wrapper env `MNEMOSYNE_GUARD_MODE`) | | | yes (exists). A natural extension: a per-rule mode (G2-warn, G3, G4: `strict`/`warn`/`off`) instead of one global switch; G1 and the G2 hard blocks stay block |
| Activity-log masking | separate secret masker in `hooks/activity-log.ts:107-116` (`SECRET_NAME`, `SECRET_VALUE` caps 256, `LONG_RUN` 32+, `TEXT_LIMIT 200`, `REDACT_INPUT_LIMIT 2000`, `IDS_LIMIT 50`) | | | no: it is a privacy control, keep fixed |

### 3.2 Must stay fixed

1. G1 built-ins and "no override for a secret". 2. Empty text blocked. 3. The rule that a block never reaches the engine and never consumes the remember trigger. 4. The activity-log masker. 5. The fact that messages name the rule, never the matched text.

### 3.3 Implementation notes

1. To make G2/G3/G4 adjustable, `admit()` needs a second argument (a resolved guard-config object), kept import-free as today. `tests/guard.test.ts` and `tests/bun/mcp-proxy.spec.ts` pin the defaults; defaults must stay the same.
2. The proxy gets `guardMode` only through the wrapper env, set at wrapper write time (session start) and read once at process start. A per-call read of `<root>/config.json` (as it does for the vocabulary) would make guard settings live for outside clients too.
3. Texts that quote the numbers must derive from the setting: `plugin.json` guardMode description ("over 4000 characters", "1500 characters"), `RULES_SECTION`, tool `confirm` descriptions in `register.ts` and `mcp-proxy.ts`, README Settings table and "The save guard".
4. `bin/guard-audit.ts` has the same constants (through `admit`), so it follows.

---

## 4. Tags

Files: `hooks/tags.ts` (format, 53 lines), `hooks/vocab.ts` (vocabulary file shape and alias folding), `bin/vocab.ts` (the one writer: `init`, `admit`, `alias`, `list`, `candidates`), `register.ts` (`tagRulesFor`, ~`:480`; `cleanTags` at `:496`, `:1284`, `:1614`), `bin/mcp-proxy.ts` (`tagRulesNow`), `hooks/backfill.ts` (the tagger).

| Knob | Today | Where | User-adjustable? |
|---|---|---|---|
| Max tags per memory | `MAX_TAGS = 5`; the "min 2" in the prompt is advice only, nothing enforces a minimum | `tags.ts:7`; advice texts `register.ts:79` ("2 to 5"), tool schema `tags` description ("2 to 5"), update schema ("at most 5"), proxy `TAGS_PROPERTY` ("at most 5") | yes (1 to 10 say). The three description strings must be built from the setting; `tests/tags.test.ts` pins 5 |
| Max tag length | `MAX_TAG_LENGTH = 31` code points | `tags.ts:8` | low value; it is also the stored-format contract (C6) and `parseVocabulary` validates against it: keep fixed |
| Namespaces | `entity`, `agent`, `asset` | `tags.ts:12`; `vocab.ts` `nsOf`/`parseVocabulary` | no: adding one changes the format contract (C6) and the vocabulary validation. Show read-only |
| Normalisation | NFKC, lowercase, kebab-case, non-letter/digit runs become `-`, trimmed | `tags.ts:21-33` | no (format contract) |
| Project-name drop | a tag equal to the owner's readable project name is dropped | `vocab.ts` `projectNameOf`, `tagRules` | could be a toggle ("keep project-name tags"); low value, leave |
| Aliases | `vocabulary.json` `tags[tag].aliases`, folded on every write by plugin tools and the proxy | `vocab.ts` `aliasMap`, `foldTag` | yes, as data, but the CRUD for it is already planned as `GET /api/vocabulary`, `POST /api/vocabulary/admit` and `/alias` (v3 CRUDX.4) and a Vocabulary panel (CRUD.3) in 0.9.0. Do not duplicate; 0.8.5 may show counts and link only |
| Auto-admit | a candidate proposed for 3 memories is admitted as `auto` | `vocab.ts:14` `AUTO_ADMIT_COUNT` | yes (1 to 10); used by `bin/vocab.ts candidates` |
| Agent seeds | `agent:claude-code`, `agent:codex`, `agent:opencode`, `agent:agy` | `vocab.ts:17-22` | data in the vocabulary file, editable through admit |
| Tagger | Haiku (`BACKFILL_MODEL`, follows `extractionModel`), concurrency 2, max tokens 120, timeout 60 s, 20 per batch, text shown 4000 chars, tag list shown 150, rate-limit waits 2 s/5 s/10 s | `hooks/backfill.ts:15-37,79,313` | batch/concurrency: leave fixed (rate-limit safety, v3 VOCAB.4 chose them). Model: already `extractionModel` |

---

## 5. Embeddings, recall, expiry

### 5.1 Embeddings

1. Option `embeddings` (`auto`/`on`/`off`), see 1.2. Model fixed: `BAAI/bge-small-en-v1.5`, 384 dimensions, ONNX int8 from `Qdrant/bge-small-en-v1.5-onnx-Q` (`hooks/engine.ts:14`, `register.ts:267`). It is pinned in `engineEnv` together with API route off (`MNEMOPI_EMBEDDING_API_URL`, `..._VIA_API`, `..._API_KEY`, `OPENROUTER_*`, `OPENAI_API_KEY` emptied, `MNEMOPI_EMBEDDINGS_API_OPT_IN=0`, `engine.ts:35-80`). Changing the model wipes vectors (`/mnemosyne-embed rebuild`). Verdict: model and API route are NOT user settings (privacy: local only, C1/C1b). The UI shows them read-only.
2. Download location `<root>/model-cache/cache/fastembed/` (`PI_CONFIG_DIR=.claude/mnemosyne/model-cache`, `engine.ts:15,74`). `auto` only decides at setup time (macOS arm64) (`register.ts:282,1360+`); at runtime `embeddingsOn` checks the marker and files, not the platform.
3. Cost facts for a help text (README): about 0.3 s per embedding engine call, about 0.4 GB per embedding process.

### 5.2 Recall

| Knob | Today | Where | User-adjustable? |
|---|---|---|---|
| Result count, Claude's `memory_recall` | `limit` 1 to 50, default `RECALL_LIMIT = 5` | `register.ts:64,138 (schema text),1310 (clamp)` | yes: default (1 to 20) and max (50 to 100?) |
| First-prompt auto-recall | one engine call per sentence, at most 4 sentences of the prompt (`sentences(e.text).slice(0,4)`), each query cut to 300 chars, each limit 5, merged by id and cut to 5 | `register.ts:1724-1728` | yes: on/off (off = no automatic recall; remember/recall terms still work), count (1 to 10), max sentences (1 to 6). Recall term: topic is the first sentence after the term |
| Which prompts trigger | `rememberTerms`, `recallTerms` (options), person origins only `composer, bridge, sdk, slack-ping` | `register.ts:70` | origins: leave fixed (anti-injection) |
| Ranking weights | vector 0.5, full text 0.3, importance 0.2, normalised; temporal weight 0 (off), half-life 24 h / recency half-life 168 h; stated/inferred/tool/imported/unknown veracity weights; episodic tier weights 1.0/0.85/0.7 | `engine/src/config.ts:161-267,307`; `engine/src/core/beam/helpers.ts:35,92`; recall args `vec_weight`, `fts_weight`, `importance_weight` exist (`mcp-tools.ts:89-91`) but the plugin never passes them | possible as a "Recall ranking" advanced group: pass `vec_weight/fts_weight/importance_weight` per call (no engine change), or set `MNEMOPI_*_WEIGHT` in `engineEnv`. Note: `engineEnv` does NOT pin these today, so an exported shell variable already changes recall silently (undocumented knob; inferred from the env being "laid over the caller's own environment", `engine.ts:24`). Recommend an explicit setting plus pinning so behaviour is the same everywhere |
| Relevance floor | drops a candidate whose word match is below 0.08/0.18/0.34/0.22 (by query length 1/2/3/4+ words) unless its vector similarity is at least 0.65; keyword/vector blend `0.8 x lexical + 0.2 x dense` | `engine/src/core/beam/recall.ts:352-355,710,727` | engine code, hard-coded: do NOT expose in 0.8.5 (needs an engine change, and only MODEL-type phases may touch `engine/`; v3 constraint 1) |
| Engine timeouts | engine call 20 s (`runAll`), knowledge batch 120 s, backfill apply 120 s, backup 300 s, reembed 600 s | `register.ts:534,907,751-754,993` | no |

### 5.3 Expiry and trimming

1. Context notes expire 14 days after the save: `CONTEXT_EXPIRY_DAYS = 14` (`hooks/kinds.ts:45`), used by `validUntilFor` in `register.ts` and `mcp-proxy.ts`. `expires_in_days` 1 to 365 (`kinds.ts:48-52`). Recall stops returning an expired row; it is not deleted. Adjustable: the 14 (1 to 365), and optionally "expire other kinds by default" (a per-kind default expiry map, for example `event: 30`). Text in the tool descriptions and README ("14 days") must follow.
2. The unused-expiry sweep: engine tool `mnemopi_expire_unused { days (default 90, at least 30), kinds (default context, event, error, artifact), dry_run (default true), limit (1 to 200, default 50), validator }` (`engine/src/mcp-tools.ts:257-276`, `engine/src/core/beam/store.ts:980-1040`). Protected kinds `fact, preference, instruction, decision, unknown` are never swept whatever the caller passes; pinned rows (`metadata.pinned`) are spared; it sets `valid_until`, deletes nothing. NOTHING in the plugin calls it today (grep: only docs and the engine). The plan's SESSION.4 adds the daily sweep with option `expireUnusedDays` (90 default, 0 = off, 1-29 refused). So a 0.8.5 Settings tab can list it only as planned, or must not invent a second option with another name (conflict, section 7).
3. Trim: the engine deletes only rows whose scope is `session` and older than `MNEMOPI_WM_TTL_HOURS` (default 24) or past `MNEMOPI_WM_MAX_ITEMS` (default 10000) (`engine/src/config.ts:137-143`, `store.ts:234`). The plugin saves with scope `global` or `channel`, so none of its saves is trimmed. Not a user setting.
4. Session rules: first-prompt recall runs once per session (atom `recalled`), re-armed after a compaction (`session.compact`, `register.ts:~1655`). Could be a toggle "recall again after compaction" (low value).
5. Activity log: `MAX_BYTES = 1 MiB` then one backup `.1`, `MAX_LINE 16 KiB` (`bin/activity.ts:22-25`); daily tally keeps 90 days (`bin/activity.ts:167,190`). Adjustable: log size cap (256 KB to 16 MB). The 90-day tally is the map's data; leave.

---

## 6. MCP servers and tools

### 6.1 The plugin's tools for Claude (registered at every `session.start`, `register.ts:1348`, `$.tool.register({...tool, isDeferred:false})`, definitions `register.ts:104-195`)

| Tool | Params | Limits and rules |
|---|---|---|
| `memory_remember` | `content`, `kind` (required: one of `fact, preference, instruction, decision, context, error, artifact, event`), `importance` (0 to 1, default 0.5), `tags` (array), `global` (per-project mode), `expires_in_days` (1 to 365), `replaces` (id), `owner` (with replaces), `confirm` | guard (G1-G4) first; kind required; a context note gets 14 days; tags cleaned to at most 5; near-duplicate check; refused on a stale engine |
| `memory_recall` | `query`, `limit` (1 to 50, default 5) | owner's rows plus every `scope:'global'` row; results trimmed to id, owner, content, scope, timestamp |
| `memory_update` | `memory_id`, `content`, `importance`, `tags` (at most 5; `[]` removes), `kind`, `confirm`, `owner` | needs at least one change; guard on new content; stale engine refused |
| `memory_forget` | `memory_id`, `owner` | permanent delete, as the row's owner |
| `memory_stats` | none | counts; provider renamed to `mnemosyne` |

All five can be switched off by not registering them: nothing in the repo does that today. Hazards: `prompt.compose` adds the rules block only when `memory_remember` is registered (`register.ts:~1660`); the remember trigger (`prompt.submit`) tells Claude to call `memory_remember`, so if remember is off the trigger must also stop (or the model would try a missing tool). The `tool.call` matcher `^mcp__mnemosyne__memory_` stays harmless. A per-tool on/off is feasible and low risk if it applies at the next session start (the tool registry is built there), and the Settings tab says so.

### 6.2 `externalMcp` proxy (`bin/mcp-proxy.ts`, wrapper `<root>/bin/mnemosyne-mcp`)

1. Serves the same five tools (`ALLOWED`, `mcp-proxy.ts:~37`), renamed `memory_*`; everything else answers `-32601 Tool not available`. Pins on remember: `source mcp:<client>`, `trust_tier EXTERNAL_WRITE`, scope `global` (or `channel` in per-project owners), `author_id <client>`, `author_type agent`; drops `bank`, `metadata`, `memory_type`, `valid_until`, `veracity`, `trust_tier`; importance clamped; tags cleaned; same guard; engine-build check. Owner: env `MNEMOSYNE_OWNER` (default `global`).
2. Env set by the wrapper (`register.ts:398-440`): `MNEMOSYNE_OWNER` (default), `MNEMOSYNE_ACTIVITY_LOG`, `MNEMOSYNE_GUARD_MODE`, `MNEMOSYNE_VOCABULARY`, `MNEMOSYNE_CLI`, and the same local-only pins as `engineEnv`.
3. Per-tool defaults for outside agents: possible later (v3 LATER.2 "agent-aware recall for outside agents", parked). Candidates: allow-list of tools (for example read-only: recall and stats only), default owner, guard mode for outside clients separate from Claude's. These are env/config for the wrapper; the wrapper is rewritten only at session start.

### 6.3 Engine tools (27, hidden from Claude and from the proxy)

`mnemopi_knowledge_prompt, knowledge_store, remember, similar, expire_unused, recall, shared_remember, shared_recall, shared_forget, shared_stats, sleep, stats, invalidate, validate, get, triple_add, triple_query, scratchpad_write, scratchpad_read, scratchpad_clear, export, update, forget, import, diagnose, graph_query, graph_link` (`engine/src/mcp-tools.ts:374-495`+). The plugin itself calls: `remember, recall, update, forget, stats, similar, invalidate, knowledge_prompt, knowledge_store` (grep of `hooks/`, `bin/`, `ui/server.ts`). The others stay unreachable: `sleep` widens a project's facts to global, `get` reads any owner's row, `export` writes the whole store anywhere, `shared_*` rows are deleted after 24 h (`bin/mcp-proxy.ts` header, DESIGN section 5.6). Not user settings; list them read-only at most.

Verdict: per-tool on/off for the five public tools: yes (session-start effect). Per-tool defaults: recall default limit and remember default importance (0.5) and default kind are the sane ones. Engine tools: no.

---

## 7. The dashboard server and UI today

### 7.1 Server

1. Start: `/mnemosyne-ui` (`register.ts:1411` handler -> `hooks/ui-launch.ts` `openDashboard`) runs `bun ui/server.ts --hold` through `$.process.spawn` with env `MNEMOSYNE_PLUGIN_ROOT, ROOT, STORE, CLI, ACTIVITY_LOG, EXTRACTION, EMBEDDINGS` (`ui-launch.ts:155-164`). It binds `127.0.0.1` on a port the OS picks, makes a random 32-byte token, writes `<root>/ui.json {port, token, pid}` (0600), prints one ready line, and exits when stdin closes, its parent is gone, or on a signal. One server is shared by all sessions; a later `/mnemosyne-ui` reuses it, and a changed `extractionModel`/`embeddings` only prints a "restart the dashboard" note (`ui-launch.ts` `restartNote`). The user opens `http://127.0.0.1:<port>/#token=<token>`; the page keeps the token in `sessionStorage`.
2. Guards (outer handler `ui/server.ts:~2300-2320` and `post()` `:2160-2170`): Host header must equal `127.0.0.1:<port>` (403 otherwise, DNS rebinding); every `/api/*` needs `Authorization: Bearer <token>` (constant time, header only; 401); POST needs `Origin == http://<host>` (403), `application/json` (415), body at most `MAX_BODY_BYTES = 4096` (413); OPTIONS is 405; strict CSP (no inline script or style) on every reply; `Cache-Control: no-store`. SQLite is opened read-only (`query_only`); every write goes through the engine (`hooks/engine.ts`).
3. Routes that exist in code now (`ui/server.ts:2231-2283`): `GET /api/health`, `/api/health-report`, `/api/knowledge`, `/api/memories`, `/api/memories/<id>`, `/api/galaxy`, `/api/activity`, `/api/activity/stream` (NDJSON), `POST /api/search`, `POST /api/forget`, dev-only `/api/dev-stamp`. That is all.
4. Planned only (v3 C7, CRUDX): `POST /api/memory/create|update|retire|restore`, `POST /api/vocabulary/admit|alias`, `GET /api/review`, `GET /api/vocabulary`, `unusedByDesign` in health-report, a per-route body cap (24 KB for create/update), `state` on every memory, a shared write limiter (`forgets: limiter(1)` today, `server.ts:~2153`). None of it is in code: `grep` of `ui/server.ts` finds no `/api/memory` route. Also not in code: `sessionSummary`, `expireUnusedDays`, `pinned` flag on update, `hooks/session.ts`, import commands.
5. No existing route reads or writes plugin settings, `settings.json`, or `claude plugin configure`.

### 7.2 UI structure

1. `ui/index.html` (451 lines): header with `<nav id="tabs">` drawn by JS, then one `<main id="view-<name>" class="main view" hidden>` per tab, a shared bottom sheet (`#sheet`, `ui/sheet.ts`) and a footer with `#facts`. Views today: `map, memories, activity, search, knowledge, review, health` (`ui/app.ts:30-32`: `VIEWS` const, `VIEW_NAMES` map). `drawTabs()` (`app.ts:~667`) builds the buttons; `show(view)` (`app.ts:677`) toggles `hidden`, sets `aria-current`, and lazily loads (`loadMemories`, `startActivity`, `loadKnowledge`, `loadReview`, `loadHealthReport`). Per-tab logic lives in sibling modules (`ui/health.ts`, `ui/review.ts`, `ui/knowledge.ts`) with a thin DOM wiring part in `app.ts`. CSP means no inline styles or scripts, all text via `textContent`; specs assert that (`tests/bun/health-view.spec.ts:383-395`).
2. A Settings tab slots in as: `VIEWS`/`VIEW_NAMES` (2 lines), one `<main id="view-settings">` in `index.html`, a `show()` branch (`if (view === 'settings') void loadSettings()`), a new `ui/settings.ts` for the pure logic/rendering (like `health.ts`), CSS in `ui/style.css`, and a new server module for the routes. No test pins the tab list as a whole (grep found none), but `tests/bun/ui-views.spec.ts` exercises `app.ts`.
3. The footer `#facts` and `GET /api/health` already show store, engine, plugin version, embeddings and activity.
4. `localStorage`/`sessionStorage` use: token (sessionStorage), search mode and a few map prefs (localStorage). Browser-only preferences (theme, search mode) can appear in Settings as "this browser" rows; they are not plugin settings.

---

## 8. Anything else configurable or hard-coded

| Item | Today | Where | Verdict |
|---|---|---|---|
| Store location | `memoryDir` | 1.2 | exists |
| Backups | keep 10; refuses with less free disk than needed; every apply command backs up first (C9) | `bin/memories.ts:261-340` | keep-count: yes (3 to 50). Free-space rule: fixed |
| Activity log size and path | 1 MiB + one `.1` backup; path `<root>/activity.jsonl` | `bin/activity.ts:22` | size: yes; path: fixed |
| Activity append mode | env `MNEMOSYNE_ACTIVITY_APPEND` = `run`/`spawn`/`await` (default `spawn`), timeouts 5 s / 1 s | `register.ts:663-669` | dev/debug only; do not surface |
| Bank | pinned to `default` so a shell variable cannot move writes to `<store>/banks/<x>` | `engine.ts:42` | fixed (security) |
| Extraction model | `extractionModel` | 1.2 | exists. Extra knobs fixed: `KNOWLEDGE_MAX_TOKENS 2000`, `KNOWLEDGE_TIMEOUT_MS 60_000`, effort `low`, one extraction at a time per session |
| Remember/recall terms | options | 1.2 | exists |
| What is injected into context | `RULES_SECTION` (the "Long-term memory (Mnemosyne)" block appended last on every prompt compose except `bare`), first-prompt recall block, "Mnemosyne recall for ... found nothing" | `register.ts:72-82,1645,1690+` | candidates: toggle for the rules block (risk: Claude then does not know the rules; keep default on); toggle for the recalled-memories block is the first-prompt recall switch in 5.2 |
| Prompt-injection of memories on first prompt | on; person origins only | `register.ts:1690-1740` | switch: yes (5.2) |
| Dashboard | server idle/parent check `MNEMOSYNE_UI_PARENT_CHECK_MS` (default 10 s, 100 ms to 10 s); list limit 1000 rows / 240 chars preview; search 20 per owner, 10 owners; activity default 200 max 1000; stream poll 500 ms, max 10 min, 8 streams; 4 engine processes at once | `ui/server.ts:100-130` | browser-side view limits could be user prefs; server limits: fixed |
| Setup/installer timeouts | 600 s / 240 s / 300 s | `hooks/engine-build.ts` | fixed |
| Project registry | `projects.json`, names capped at 200 chars, remote host only | `hooks/projects.ts` | fixed (privacy) |
| Kinds list | 8 kinds with labels | `hooks/kinds.ts:5-14` | fixed (engine `memory_type` contract; the sweep's protected list depends on it) |
| Dev mode | `bun run dev:ui` | `scripts/dev-ui.ts` | not a user setting |

---

## 9. Conflicts with the planned 0.9.0 work (`docs/plans/mnemosyne-v3.md`, `DESIGN.md`)

Plan structure: Summary, How to use, Goal, Design/context, Contracts C1-C12, Out of scope, Risks, Task graph, Lanes/workers/models, then waves 1 to 8 (MODEL, GUARD, META, VOCAB, REL8, CRUDX+IMPORT, CRUD+SESSION, HARDEN, REL9, LATER), Verification, "Standing constraints for every worker" (`:968-981`, 10 rules), Decisions, Notes for the reviewer. Waves 1 to 3b are built (0.8.x). The 0.9.0 half is not.

1. `hooks/register.ts` is the hottest shared file: SESSION (`hooks/session.ts` plus edits in `register.ts` first-prompt branch `:1690+`, `session.end`, sweep), IMPORT (new commands), and the map plan's MAPX.8 hunk near `owner()` (already merged, `registerProject`). A Settings release that reads config in `register.ts` (guard config, recall count, per-tool registration, tag max) touches the same regions as SESSION.2 (first-prompt block) and `tool.call`. Mitigation: keep register.ts edits to one resolver call at the top of `register()` and pass a resolved object down; put everything else in new files (`hooks/settings.ts` import-free, like `guard.ts`).
2. `.claude-plugin/plugin.json`: SESSION.1 adds `sessionSummary`, SESSION.4 adds `expireUnusedDays` (min 30 rule), GUARD.3 added `guardMode`. If 0.8.5 adds `userConfig` fields it collides in the same JSON object, and the plan fixes names and semantics for those two. Do not create competing names. A schema-driven form (section 1.3.5) avoids hard-coding them.
3. `ui/server.ts`: CRUDX.1 rewrites `post()` (per-route cap), renames the forgets limiter to a general write limiter, adds routes in the route table (`:2231-2283`) and changes `MAX_BODY_BYTES` handling. Settings routes go in the same table. Whichever lands second rebases (the plan already uses that rule for MAPX.2, D7). Reuse `post()`; add settings routes in a separate module and register them with 2 lines.
4. `ui/app.ts`: CRUD phase edits forget confirm, Review tab, Memories "Show retired" toggle, adds forms; `VIEWS` line is a one-line conflict, and another lane has `ui/app.ts` modified in the working tree right now. CRUDX forbids `ui/app.ts`; CRUD (UI) owns it. Keep the Settings edit to `VIEWS`, `VIEW_NAMES`, one `show()` branch, and new `ui/settings.ts`.
5. Standing constraint 2 (nothing touches the real store/home): Settings writes `~/.claude/settings.json` through `claude plugin configure`. Tests must stub the CLI and use a temp HOME (`tests/bun/no-real-home.spec.ts`).
6. Constraint 8 / C8 (memory text never logged): config values like `rememberTerms` are not memory text, but an activity line for "setting changed" needs a new `ActivityAction` ('settings'), which is the exact file CRUDX.0 changes (`hooks/activity-log.ts:10`). Either skip the log line in 0.8.5 or add the action in the same step as CRUDX.0.
7. Constraint 4 and Decision 1: expiry sweep and retire are Rohit-approved only; the Settings tab may set `expireUnusedDays` (when it exists) but must not run `expire --apply`.
8. Constraint 1: only MODEL touches `engine/`. Ranking floors (0.65, 0.8/0.2, minimum relevance) are engine code; leave out of 0.8.5.
9. Contract C9 (backup before apply): changing `memoryDir`/`scope` is not an apply, but should warn that rows are not moved.
10. Release numbering: REL9 asserts `"version": "0.9.0"`, README must mention `expireUnusedDays`, DESIGN `v0.9.0`; 0.8.5 in between breaks nothing in the gate commands (grep-based). README "Settings" table will need new rows; REL8/REL9 tasks edit README/DESIGN, so keep 0.8.5 docs edits to a clearly marked section.
11. Duplicates with CRUD.3 (Vocabulary panel) and `/api/vocabulary` (CRUDX.4): do not build alias editing in Settings.
12. Decisions open in the plan that a settings tab would touch: item 9 (pin `MNEMOPI_HOST_LLM_ENABLED`; `engineEnv` already blanks it, `engine.ts:45`), item 11 (keep 0.88). Rohit already ruled the 0.88 default stays; it can still become an adjustable setting with 0.88 as the default.

---

## Recommended settings list

Legend: option = existing `userConfig` option (written with `claude plugin configure`, takes effect per notes), config = new key in `<root>/config.json` (read per call, live), read-only = shown, not editable.

### Guard
1. `guardMode` strict/warn (option, exists).
2. Warn length (config, default 1500, 200 to MAX-1).
3. Max length (config, default 4000, up to a ceiling such as 8000; Rohit to confirm).
4. Min length (config, default 15, 5 to 100).
5. Near-duplicate: on/off and threshold (config, default on and 0.88, 0.80 to 0.99).
6. Task-chatter check: strict/warn/off (config, default follows `guardMode`).
7. Extra secret patterns: add-only list of regexes with a test box (config, empty default). Built-in secret rules shown read-only, cannot be disabled.

### Tags
1. Max tags per memory (config, default 5, 1 to 10), with the three help texts built from it.
2. Auto-admit count (config, default 3).
3. Read-only: tag length 31, namespaces entity/agent/asset, vocabulary tag and candidate counts, link to the 0.9.0 Vocabulary panel.

### Recall and embeddings
1. `embeddings` auto/on/off (option) plus model status (read-only: model name, downloaded yes/no, vectors missing count).
2. Default recall count for `memory_recall` (config, default 5) and its max (config, default 50).
3. First-prompt auto-recall: on/off, count (default 5), sentences (default 4) (config).
4. `rememberTerms`, `recallTerms` (options).
5. Advanced (optional, behind "Advanced"): ranking weights vector/keyword/importance (config, defaults 0.5/0.3/0.2, passed per recall call and pinned in `engineEnv`).

### Expiry
1. Context-note expiry days (config, default 14, 1 to 365).
2. Unused-expiry sweep `expireUnusedDays` (the planned 0.9.0 option: show it when it exists, from the schema; otherwise show as "arrives in 0.9.0").
3. Read-only: protected kinds, the 24 h trim applies only to session-scope rows.

### Storage
1. `memoryDir` (option) with a "rows are not moved" warning.
2. `scope` global/per-project (option) with a "which memories you will see" warning.
3. `activityLog` on/off (option), log size cap (config, default 1 MiB).
4. Backups: keep N (config, default 10), list of backups (read-only), optional "Back up now".
5. `extractionModel` (option; `off` allowed).

### MCP tools
1. On/off per tool: remember, recall, update, forget, stats (config, default all on; effect at next session start). Remember off also stops the remember trigger.
2. `externalMcp` (option) plus outside-tools allow-list (config, default all five) and the wrapper path with a copy button.
3. Read-only: the 27 hidden engine tools, and why.

### Dashboard
1. Browser-only preferences (theme, search mode) as "this browser" rows.
2. Read-only facts: server port, started-with `extractionModel`/`embeddings` and a "restart needed" flag when they differ from the current values.
3. Reset to default per setting and "Reset all" (options: write the default value, or the default string through the CLI; config keys: delete the key).

### Setup actions
1. Setup status card (engine installed, build `18.12.3-mnemosyne.10`, model files, wrapper).
2. Copyable commands: `/mnemosyne-setup`, `/mnemosyne-embed`, `/mnemosyne-tags`, `/mnemosyne-knowledge`.
3. No in-browser re-run of setup, no rebuild of vectors.

---

## Open questions for Rohit

1. Where do the new knobs live: (a) a plugin-owned `<root>/config.json` read per call (live, no reload, my pick for everything that is not already an option), or (b) more `userConfig` options (shown in `/config` too, but each needs a plugin reload, collides with SESSION's `plugin.json` edits, and `multiple` options do not appear as `/config` rows)? Or both?
2. For the 10 existing options, is the CLI route enough (`claude plugin configure --values-stdin`; the change shows after a reload/restart, and the page says so), or must a change be live? Live needs a new server-to-hook channel or a `/mnemosyne-settings` slash command using `$.config.set`. I could not verify here whether an external CLI write reloads a running session.
3. Which risky settings may the dashboard edit: `memoryDir` and `scope` (they change which memories are visible; nothing is migrated)? Suggest allow with a confirm, or read-only with a link to `/plugin`.
4. Max length ceiling: 4000 today, 8000 proposed (embedding input cap is 8192). Agree? And may MIN go below 15?
5. Extra secret patterns: allow user-written regexes (add-only, validated), or only a "words that must never be saved" list (safe, no regex)?
6. Per-tool on/off: ship in 0.8.5 (effect at next session start), or leave to the planned agent-aware work (LATER.2)? Turning `memory_remember` off also needs the trigger switched off.
7. First-prompt recall switch and count: yes in 0.8.5? (It touches the same `prompt.submit` region SESSION.2 will edit.)
8. `expireUnusedDays`: the Settings tab shows it only when SESSION.4 ships (schema-driven), correct?
9. Should settings changes leave an activity-log line? It needs a new `ActivityAction`, the file CRUDX.0 changes. Skip for 0.8.5?
10. Ranking weights: expose (and pin in `engineEnv`, which also stops a shell variable from silently changing recall), or leave hidden?
11. Setup actions: status plus copyable commands only (my pick), or also a server-side "Back up now" button?
12. Is the dashboard tab order `Map, Memories, Activity, Search, Knowledge, Review, Health, Settings` fine (Settings last)?
