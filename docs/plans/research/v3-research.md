# Mnemosyne v3 research: what enters memory, and how it is organised

Date: 2026-10-24. Repo `/Users/rohits/Development/claude-mnemosyne` at `5824f3d` (v0.7.0, main, clean). Store read only with `sqlite3 -readonly` and Python `mode=ro`; nothing written.

Tool notes:
1. CodeGraph: `mcp__codegraph__codegraph_explore` answered that the repo has no `.codegraph/` index. CLAUDE.md says to skip CodeGraph then, so this is not a failure to retry. Fallback used: `/usr/bin/grep` plus Read (read-only).
2. One grep returned nothing on the first try. The cause was zsh treating an unquoted `--include=*.ts` as a glob ("no matches found"). Quoting it fixed that. No result in this report depends on the failed call.
3. The store changed after the brief was written. It now holds 140 rows, all 140 tagged (550 tag uses), and 140 vectors. The brief said 20 were untagged and 139 had vectors.

---

## 1. Who writes each column, and why it ends up 'unknown' / 'IMPORTED'

### 1.1 The write path (verified)

```
Claude: mcp__mnemosyne__memory_remember {content, importance, tags, global}
  -> hooks/register.ts tool.call (:1241)  -> engineArgs (:1034-1053)
  -> one `bun cli.ts mcp` process          -> engine/src/mcp-tools.ts handleRemember (:552-567)
  -> engine/src/core/beam/store.ts remember (:435-548) -> INSERT working_memory (:499-524)
Outside agents: bin/mcp-proxy.ts (same pins, :162-176) -> the same engine tool
```

### 1.2 Per column

| Col | Written by today | Value seen |
|---|---|---|
| source | plugin pins it | 'imported' x140 |
| trust_tier | engine, from source | IMPORTED x140 |
| memory_type | nobody | 'unknown' x140 |
| veracity | trigger saves only | 'unknown' x140 |

1. `source`: the plugin always sends `source: 'imported'` (`hooks/register.ts:1045`). The proxy does the same (`bin/mcp-proxy.ts:168`, comment at `:9-10`).
2. `trust_tier`: handleRemember never passes a trust tier (`engine/src/mcp-tools.ts:556-564`), so the engine derives it from `source` (`store.ts:441` -> `normalizeTrustTier` -> `sourceToTrustTier`, `:108-131`). 'imported' maps to `IMPORTED` (`:118-121`).
3. `memory_type`: the plugin's tool schema has no kind field (`register.ts:76-98`). handleRemember also does not forward a `memory_type` argument, so the engine default applies: `options.memoryType ?? "unknown"` (`store.ts:442`; column default in `beam/schema.ts:36`).
4. `veracity`: handleRemember sends `veracity` with a default of "unknown" (`mcp-tools.ts:562`). The plugin sets `veracity: 'stated'` only for the first main-thread save after a remember trigger phrase (`register.ts:1251-1263`, merged at `:1279`). No row in the store came from a trigger save (`author_type='human'` count is 0).
5. `author_id` / `author_type`: these are sent per call since KNOWX.1 (`register.ts:1049-1050`; the proxy uses the client name; the engine reads them at `mcp-tools.ts:477-478`). 134 rows are NULL because they were saved before KNOWX.1. The 6 'agent' rows date from 2026-10-23 and 2026-10-24 (store query).
6. `scope`: 'channel' per project, or 'global' when `global: true` or in global mode (`register.ts:1046`). Store: channel 133, global 7.
7. `metadata_json`: only `{tags}` (`register.ts:1051`; update at `:452`). All 140 rows are now tagged.
8. Columns no path writes: `valid_until` and `superseded_by` (only `mnemopi_invalidate`, which the plugin does not expose, writes them), `validator`, `validated_at`, `validation_count`, `event_date`, `event_date_precision`, `temporal_tags`, `consolidated_at`, `embed_text`. All are empty in the store. `mnemopi_validate` returns a `validator` field but never stores it (`mcp-tools.ts:854-881`), and `memory_validations` has 0 rows.
9. Side effect: `addTemporalAnnotations` writes `has_source=imported` for every row because the source is not conversation/user/assistant (`store.ts:264-273`). The store holds 140 `has_source|imported` annotations.

### 1.3 Verdict: IMPORTED is deliberate. It is a plugin workaround, not a bug and not an engine default

1. The engine's own default for remember is `source: "conversation"` → STATED (`store.ts:436`). Only `rememberBatch` defaults to IMPORTED (`store.ts:560`).
2. The plugin picked 'imported' on purpose. `trimWorkingMemory` deletes a STATED row that has not been consolidated once it is older than `workingMemoryTtlHours` (24 h) or past 1000 rows per owner. It spares only `trust_tier IS NOT 'IMPORTED'` (`store.ts:222-262`, the test at `:240` and `:245`). DESIGN.md §5 records this decision (lines 1055+: "Any other source lands as trust tier STATED … IMPORTED rows are never trimmed"), as does the comment at `register.ts:1043-1044`.
3. The cost: one column now stands for two things, "durable" and "where this came from". As a result:
   1. provenance is lost on every row;
   2. the engine's own health check counts all 140 rows as "contaminated", because `CONTAMINATED_VERACITY` includes 'unknown' and 'imported' (`beam/consolidate.ts:33-39`, `:1021-1028`);
   3. 'imported' can never mean a real import (documents, session logs), which v3 needs.
4. Inferred (from timestamps and the archive name, not checked against the archive contents): 106 of 140 rows were written on 2026-10-16, and 106 of the 121 rows that start with a `[slug]` prefix carry that date. That matches a one-time move of Claude auto-memory files (`~/.claude/mnemosyne/archive/claude-memory-hermes-switchui-2026-10-16.tgz`). So about 106 rows really are imports, and about 34 are later saves by Claude.

---

## 2. What the engine already supports that v3 can reuse

1. Typed kinds: `MemoryType` has 14 values: fact, preference, decision, commitment, goal, event, instruction, relationship, context, learning, observation, error, artifact, unknown (`engine/src/core/typed-memory.ts:1-16`). Per-type decay rates exist (`:379-406`). A regex classifier `classifyMemory` exists (`:284`) but nothing calls it. I ran it read-only on the 140 rows and it is weak: 43 instruction, 29 "relationship" (it fires on "needs", "requires", "part of"), 24 "error" (it fires on any mention of "bug" or "issue"). Reuse the kind list; do not trust the classifier.
2. Veracity labels and weights: stated 1.0, unknown 0.8, inferred 0.7, imported 0.6, tool 0.5, false 0 (`beam/recall.ts:89-101`; defaults in `config.ts:200-218`). Recall already scores by them.
3. Trust tiers: STATED, DERIVED, EXTERNAL_WRITE, IMPORTED (`store.ts:60-65`). Today they only decide the TTL trim.
4. Retire without deleting: `invalidate(id, replacementId)` sets `valid_until=now` and `superseded_by` (`store.ts:643-672`), and recall already hides those rows (`beam/recall.ts:459`, `:536-547`; `getContext` at `store.ts:632-633`). It is exposed as engine tool `mnemopi_invalidate`, which the plugin does not expose. There is no un-invalidate.
5. `valid_until` on save: `remember` accepts `validUntil` (`store.ts:443`), but handleRemember does not forward it. It is the natural way to make "project status" notes expire.
6. Exact-duplicate check: the same content within one owner updates the existing row instead of inserting a new one (`store.ts:156-160`, `:450-496`). There is no near-duplicate check.
7. Vectors: `memory_embeddings(memory_id, embedding_json, model)` holds bge-small-en-v1.5 vectors with 384 dimensions. All 140 are present. Recall blends them in.
8. Content sanitizer: `sanitizeContent` moves data-URIs, content over 1 MB and high-entropy base64 over 100 kB into blobs (`core/content-sanitizer.ts:73-120`). Nothing calls it (grep over `engine/src`). It is a starting point for size guards, but its thresholds are far too large for memory notes.
9. Knowledge (memoria tables): facts 32, instructions 12, kg 37, preferences 3, timelines 8, from the 0.6.0 extraction. `triples`, `gists`, `graph_edges`, `facts`, `scratchpad`, `episodic_memory` and `consolidation_log` are all 0. The 0.7.0 plan keeps `triples` and graph out because they have no owner and forget does not purge them. That still holds, which makes `triple_end` low value.
10. Triples with end dates: `triples.valid_until` exists, and adding a triple ends the earlier one with the same subject and predicate (`core/triples.ts:252`). This is the engine's form of `triple_end`, but it sits in the owner-less store.
11. Scratchpad (`mnemopi_scratchpad_*`, capped by `MNEMOPI_SP_MAX`): unused. It is a possible holding place for quarantined saves, but it has no owner, so it is not recommended for that.
12. Sleep/consolidation into episodic memory and gists: present but unused, and it crosses owners (0.7.0 plan, Out of scope). Do not reuse it in v3.

---

## 3. Profile of the real store (read only)

1. Counts: 140 rows. Per owner: hermes-switchui 65, matrixkoder 62, claude-mnemosyne 9, cc-workflows 4. Scope: channel 133, global 7. Per day: 106 on 2026-10-16, then 1 to 9 per day through 2026-10-24.
2. Length: min 276, p25 481, median 588, p75 745, p90 966, max 2545 characters. Buckets: 41 rows at 200-499, 86 at 500-999, 11 at 1000-1999, 2 over 2000. No row is a one-line fact; the shortest is 276 characters. Most are multi-sentence rules or notes.
3. Use: 115 recalled at least once, 25 never recalled, 5 recalled 20 or more times (max 80). Importance: 57 at 0.5, 42 at 0.8, and the rest spread from 0.2 to 0.95.
4. Exact or normalised duplicates: 0.
5. Near-duplicates by vector (cosine over all 9,730 pairs):
   1. Baseline: median pair 0.646, p90 0.722, p99 0.796, p99.9 0.873, max 0.928. Each row's nearest neighbour: median 0.80, p90 0.873.
   2. Pairs at 0.92 or more: 2; at 0.90: 4; at 0.88: 6; at 0.85: 22. At 0.88 they form 4 clusters covering 10 rows (sizes 4, 2, 2, 2). All pairs are within one owner.
   3. What the top pairs are: sibling progress notes from one MatrixKoder plan (`mk-plan-inbox-q1-flat-files` vs `-q2-q3`, 0.928; `…-done` vs `…-next`, 0.921), two Hermes Self-Improve notes (0.915), a SUPERSEDED reviewer note next to the note that replaced it (`mk-reviewer-pane` vs `mk-reviewer-agy-38-medium`, 0.887), and two or three overlapping `cc-workflows` repo descriptions (0.856-0.878).
   4. So at 0.88 and above, the matches are related notes that belong merged or retired, not identical text. A threshold that blocks would throw away real updates. A warning that names the match and suggests `memory_update` fits the data.
6. Notes that should be retired (candidates only; each needs Rohit's OK):
   1. 5 rows carry an explicit marker, all in matrixkoder: `da54d9242dfc37af` (SUPERSEDED inside), `ce61a767704ed87f` (HISTORICAL), `72d4c3871ac8f649`, `412c73174a45864d` and `f485b1bd408585e3` (SUPERSEDED, with the replacement named). They are still recalled; `412c…` is at 0.887 to its replacement.
   2. 40 rows are dated progress or status notes ("2026-10-20 … v0.7.1 released", "…-next", "r1-done", "built overnight", "plan status (updated 2026-10-24 overnight)"). These are task chatter by the user's own rule ("never remember … one-off task details", `register.ts:66`). Some are heavily recalled (`milestone-v0.6.0-storage-layout` rc=34, `cc-workflows` rc=80), so they need case-by-case review, not bulk retirement.
   3. 24 more rows match softer words ("stale", "obsolete", "old"). Most are false positives, such as "stale token" used as a technical term.
7. Secrets scan (regex over content, counts only): AWS keys, GitHub tokens, `sk-` keys, JWTs, PEM private keys, Bearer tokens and key=value secrets: 0 each. One email-shaped string. 22 runs of 40+ characters that look high-entropy, all of them file paths. 7 rows contain `/Users/<name>` paths. So the store holds no secrets today, and a guard must not flag paths.
8. Tags, the main source of noise: 447 distinct tags across 550 uses; 407 are used only once. The top tag is `hermes-switchui` (34), which repeats the owner. `matrixkoder` (14), `claude-mnemosyne` (4), `mnemosyne` (3), `cc-workflows` (2) and many `hermes-agent …` variants also restate the project. There is drift between near-synonyms ("code review" / "review workflow" / "mk plans" / "plan inbox"), and tags contain spaces. The tagger prompt gives Haiku no existing vocabulary (`hooks/backfill.ts:51-59`). `cleanTags` only lowercases, trims and caps at 5 tags of 24 characters (`hooks/tags.ts`).
9. Format noise: 121 of 140 rows start with a `[slug]` prefix carried over from the auto-memory import (inferred, see 1.3.4). It is harmless for recall but repeats the owner.
10. What looks like garbage, and why:
    1. Rows retired in their own text that are still live (5).
    2. Dated progress notes that will be stale within days (about 40, a heuristic count; review per row).
    3. Clusters of the same evolving topic saved as separate rows instead of updated (4 clusters, 10 rows).
    4. One-off tags (407) and tags that repeat the owner.
    5. Provenance columns that say nothing (all of section 1).
    6. Nothing here is a secret or a binary blob.
11. Engine side files: `~/.claude/mnemosyne/model-cache/logs/` holds 194 `omp.*.log` files of about 170 B each, all from 2026-10-24: one per engine process, never pruned. Store files are `-rw-r--r--` inside a `drwx------` folder, so they are safe through the folder. `store/banks/` is `drwxr-xr-x` (a minor inconsistency).

---

## 4. Guardrails: what enters memory

### 4.1 Where to enforce

Writes come from four entry points:
1. Claude's tool calls (`register.ts` tool.call).
2. Outside agents (`bin/mcp-proxy.ts`).
3. The dashboard (`ui/server.ts`, once CRUD lands).
4. v3's importers.

Options:
1. Engine-side check (in `remember`): one place for everything, but it is an engine fork change with a wider engine-diff. The engine cannot talk to Claude to ask "update instead?". And every check costs an engine process.
2. Plugin-side check in each entry point, sharing one import-free module, `hooks/guard.ts`, the same pattern as `hooks/tags.ts`, which the hooks, the proxy and Bun code already share. The hooks cannot import engine code (0.7.0 plan, What is wrong today, 10). An import-free module is fine.
3. Recommendation: option 2 for every content rule (it is cheap, needs no engine process, and gives one reply shape), plus one small read-only engine tool for the near-duplicate check. Only the engine can embed the new text. The near-duplicate query runs in the same engine process as the save. `runAll` already sends several requests in one process (`register.ts:458-473`), so it costs no extra process launch.

### 4.2 What to check, and what to do on a hit

| Id | Rule | Action | False-positive guard |
|---|---|---|---|
| G1 | Secret patterns | Block | Known prefixes only |
| G2 | Size caps | Block / warn | Above store p99 |
| G3 | Near-duplicate | Warn | Cosine ≥ 0.88 only |
| G4 | Task chatter | Warn | Kind = project state |

Notes:
1. G1 secrets: block. The reply names the rule, never the matched text, and the activity log records only the rule id. Patterns: AWS `AKIA…`, `gh[pousr]_`, `sk-…`, `xox[abp]-`, JWT, PEM private key headers, `Bearer` plus a long token, `password|secret|api_key|token` with `=` or `:` followed by 12+ non-space characters, and URLs with `user:pass@`. Do not treat high-entropy runs alone as secrets: in this store they are all file paths (3.7).
2. G2 size: block over 4,000 characters (the store max is 2,545, and `BACKFILL_TEXT_LIMIT` is 4,000 at `hooks/backfill.ts:26`). Warn over 1,500 characters ("one fact per call"). Block under 15 characters or empty.
3. G3 near-duplicate: a warning that lists up to 3 matches (id, owner, score, 80-character preview) and says "update one of these instead". By default the save still goes through and the row is flagged `metadata.guard = ['near-duplicate:<id>']`. A strict mode (option `guard: strict`) refuses until the call passes `confirm_new: true`. The threshold of 0.88 is the store's p99.9 pair score; 0.80 would hit half of all rows' nearest neighbours.
4. G4 ephemeral chatter: warn only. Heuristics: a date plus status words (released, merged, done, next, overnight, round, r\d), or "today", "tonight", "this session". The fix offered is to save it with kind `context` and a `valid_until` (default 14 days) instead of refusing it.
5. Required fields: `kind` from a small enum. A missing kind is not refused: the save goes through as `unknown` with a warning, so outside clients that do not know the field keep working.
6. PII (emails, phone numbers): warn only, a later phase. One email-shaped string exists today, and Rohit's own email is fine to store.
7. Prompt-injection text inside a memory ("ignore previous instructions"): warn and flag. Memories are injected into context at session start, so this matters more than PII. Cheap regex; later phase.

### 4.3 Quarantine

Quarantine would need a holding place:
1. `scratchpad` has no owner;
2. a second table would be an engine change;
3. a flag in metadata adds nothing new.

Recommendation: the flag in metadata, i.e. store with `metadata.guard` set, and show flagged rows in a dashboard Review queue (CRUD). Blocking is kept for secrets and oversize only.

### 4.4 Avoiding false positives

1. Regexes match known token formats, not entropy.
2. Every rule has an id, and the option `guardRules` can turn single rules off.
3. A spec corpus: all 140 real rows, run read-only from a fixture export, must produce 0 blocks. Gate it in CI with a synthetic copy, never the real store.
4. Warnings never block in the default mode.

---

## 5. Tag vocabulary design

1. Where it lives. Options:
   1. A file `<root>/vocabulary.json` (0600, like `tags-proposed.json`);
   2. a table in the store (an engine change, and it would be lost with a store reset);
   3. derived on the fly from existing tags (no curation).
   Recommendation: option 1, written only through a Bun helper (`bin/vocab.ts`, like `bin/memories.ts save`), read by the hooks with `$.fs.read`, the proxy and the dashboard.
2. Shape: `{ version, tags: { "<tag>": { ns, description, aliases[], admitted: "seed"|"auto"|"user", count } }, candidates: { "<tag>": { count, firstSeen } } }`.
3. Namespaces:
   1. bare = topic (`git`, `code-review`);
   2. `entity:` = people, organisations and named systems (`entity:rohit`, `entity:hermes-agent`);
   3. `agent:` = which agent a memory is about or for (`agent:codex`, `agent:opencode`, `agent:claude-code`, `agent:agy`), meeting requirement 6;
   4. `asset:` = infra, tools, repos and services (`asset:launchd`, `asset:zai-glm`, `asset:sqlite`), meeting requirement 7.
   Project names are never tags, because the owner already says the project: a tag equal to an owner's readable name is dropped.
4. Format: `^([a-z]+:)?[a-z0-9][a-z0-9-]{0,30}$`. Kebab-case, no spaces. `cleanTags` gains alias mapping ("code review" → `code-review`) and namespace checks.
5. How the tagger gets it: the system prompt lists the admitted tags, grouped by namespace and capped at about 150 entries (sorted by count). The rules: "choose 2-5 from this list; at most one new tag, written `new:<tag>`". `parseTags` maps aliases and moves `new:` tags into `candidates`.
6. Admission: a candidate becomes admitted when it is used on 3 or more memories or when Rohit accepts it on the dashboard. Admitted tags are never auto-removed.
7. Seed: generated once from the current 447 tags. Keep tags with count of 2 or more after alias folding (about 40 today), add the namespaced seeds above, and Rohit edits the list on the dashboard before the retag runs.
8. Retag: `/mnemosyne-tags retag` (dry run, then apply) re-tags every row against the vocabulary. 140 Haiku calls at today's size; the existing tags flow (proposals file plus sha256 staleness check) is reused.

---

## 6. Dashboard CRUD

1. What exists today (verified):
   1. Reads: `GET /api/memories`, `/api/galaxy`, `/api/knowledge`, `/api/activity`, `/api/health`, `/api/health-report` (`ui/server.ts:1749-1800`).
   2. Writes: only `POST /api/forget` (`:1584-1630`), plus `POST /api/search`, which leaves recall counts alone.
   3. Forget already has a two-step confirm in the UI, naming the memory's first line and id (`ui/app.ts:332-356`).
   4. Create, edit and retire do not exist.
2. Guards already in place (DESIGN §3.3, verified in code):
   1. bind to 127.0.0.1 with a port the OS picks;
   2. a 32-byte token at each start, sent as `Authorization: Bearer`, compared in constant time;
   3. a Host header check (403 otherwise);
   4. POST requires `Origin === http://<host>` (`:1681`), which is the CSRF defence, plus `Content-Type: application/json` (`:1683`), a body size cap (`:1684-1686`), and one write at a time (`limiter(1)`, `:1671`);
   5. an activity log line with origin 'ui'.
3. To add: `POST /api/memory/create`, `/api/memory/update`, `/api/memory/retire`, `/api/memory/restore`, `GET /api/review` (the retirement and quarantine queue with a reason per row) and `GET /api/vocabulary` (later also `POST` to admit or alias a tag). Each runs `hooks/guard.ts` and goes through the engine as the row's owner, never by writing SQLite directly. This matches how forget already works.
4. Extra security needs:
   1. The create owner must be one of the owners already in the store, or 'global'; free text is refused.
   2. Retire and restore get the same two-step confirm as forget.
   3. Create and update show guard warnings and need a second click to save anyway.
   4. A secret hit is refused with no override.
   5. Never echo the content back into the log beyond the existing preview.
   6. Keep every route behind the existing `post()` guard. No new GET route may change anything.
   7. The body cap is `MAX_BODY_BYTES = 4096` (`ui/server.ts:105`, verified), which cannot carry 4,000 characters of content plus JSON, or multi-byte text. Give the write routes their own cap, about 24 KB, and keep 4096 for search and forget.

---

## 7. Official docs

No design choice here needs the fastembed, onnxruntime or SQLite docs:
1. The near-duplicate check reuses the engine's existing embedding call.
2. JSON1 (`json_each`, `json_extract`) is already used by `bin/memories.ts`.
3. Not consulted; nothing depends on them.

---

## Verified vs inferred

Verified (code read or store queried this session):
1. All column writers in section 1.
2. IMPORTED as a deliberate TTL workaround (`register.ts:1043-1045`, `store.ts:230-262`, DESIGN §5).
3. handleRemember dropping kind, trust tier and valid_until.
4. classifyMemory and sanitizeContent being unused.
5. invalidate and the recall filters.
6. The `CONTAMINATED_VERACITY` list.
7. Every store count, length, cosine and tag statistic in section 3.
8. The dashboard routes and guards.
9. The model-cache log count.

Inferred, not checked:
1. That the 106 rows from 2026-10-16 came from the auto-memory archive. Based on dates, the `[slug]` format and the archive name; the archive was not opened.
2. That the 40 "dated status" rows are chatter. Regex heuristic; needs per-row review.
3. That a 0.88 warning threshold will not annoy. Based on this store's distribution only.
4. The `MNEMOPI_MCP_BANK` .env hole. Taken from Rohit's open-items list. I saw that the plugin pins it to '' (`hooks/engine.ts:42`) and the engine falls back with `||` (`mcp-tools.ts:465`); I did not test whether a `.env` file fills it.
5. Linux, Windows and Intel Mac status. From the open-items list; not tested.

---

## Top 5 recommendations

1. Separate "durable" from "where it came from". Make one small engine fork change so the 24-hour trim never deletes a row whose scope is not 'session'. Then let the plugin write honest `source`, `trust_tier`, `memory_type` and `valid_until`, which means forwarding those arguments in handleRemember and handleUpdate. Existing rows stay IMPORTED; a backed-up migration relabels the clear cases.
2. Add one import-free guard module (`hooks/guard.ts`) used by every write path: block secrets and oversize text; warn on near-duplicates (cosine ≥ 0.88 through a new read-only engine tool) and on dated task chatter; flag rather than quarantine. Prove it with a fixture corpus that must give 0 blocks on today's 140 rows.
3. Give `memory_remember` a required-but-forgiving `kind` (the engine's own type names) and a `replaces` id that retires the old row (`invalidate` with `superseded_by`). Evolving notes then get updated or superseded instead of piling up. That is the root cause of the 4 clusters and the 5 still-live SUPERSEDED rows.
4. Replace free-form tagging with a vocabulary file: namespaces `entity:`, `agent:`, `asset:`; no project-name tags; kebab-case; aliases; at most one new tag per call, admitted on use or by Rohit. Then retag the 140 rows.
5. Retire by review, not by bulk. A dashboard Review queue lists candidates with reasons (explicit markers, clusters, dated status, never recalled), and each retire is a per-memory confirm that uses `invalidate`, so it can be undone. Nothing is deleted. Run the knowledge backfill only after this cleanup, so Haiku calls are not spent on rows that get retired.
