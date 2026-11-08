# Changelog

Newest first. Each release is tagged `vX.Y.Z` on GitHub; the README and DESIGN.md describe the contracts.

## 0.31.4 (bug-hunt batch E: housekeeping)

No engine change.

1. **A session marker that disappears mid-list no longer stops the summaries.** A marker claimed by another session between listing and reading is skipped (#36).
2. **A live sweep lock is never deleted.** When a stale lock was taken over just as another process renewed it, the fresh lock was removed; it is now put back (#37).
3. **Session summaries that keep failing give up.** A summary whose model call fails waits 1, 2, 4, then 8 hours before the next try, and after 5 failed attempts it is dropped with one line in the activity log, instead of being retried on every first prompt forever (#38).
4. **The plans in `docs/plans/` say what shipped** (#39).

`adm-zip` advisories (#35, still open): reviewed; the vulnerable code runs only in `onnxruntime-node`'s install script, which the plugin's own install skips, so nothing reachable at runtime. Moving the engine's `onnxruntime-node` pin from 1.26.0 to 1.31.1 would clear all 8 when the engine is next touched.

## 0.31.3 (bug-hunt batch D: the dashboard)

No engine change.

1. **The Memories list shows the latest load.** A slow reply to an earlier load could overwrite the rows of a later one (#20).
2. **A search typed after Escape runs.** Typing a new search while the previous request was still running did nothing (#22).
3. **The Knowledge note's Clear button keeps focus** across re-renders (#29).
4. **A failed Review reload says so** instead of silently showing the old queue (#30).
5. **Forgetting a search hit keeps your place.** The list no longer collapses back to 10 and the count stays right (#31).
6. **Live recall updates a memory's last-recalled time** on the map (#32).
7. **Only the last copied command says "Copied"** on the Settings page (#33).

#21 (reconnect replays duplicates after 20,000 lines) was already fixed: the stream resumes from a fresh cursor.

## 0.31.2 (bug-hunt batch B: recall and query)

Engine build 18.12.3-mnemosyne.18 (engine changes 34 to 40). Run `/mnemosyne-setup` once after updating; outside Claude Code, `bun bin/update.ts` or Update… on the Health tab.

1. **Meaning search looks at every memory.** With embeddings on, only the 500 newest memories were compared by meaning, so an older memory that matched by meaning but shared no words was never found. Now every memory with an embedding is compared (the work grows with the store; fine for thousands of memories) (#19).
2. **Recall settings from the engine's own API are honoured.** `useSynonyms`, `useIntent`, `useMmr` and `mmrLambda` passed to `recall()` were silently dropped (#7).
3. **Words with two meanings search both.** "token", "push", "setup", "check" and similar words now find memories that use either meaning's words (#12).
4. **"Chicago" is not a time word.** Words that merely contain "ago", "last" or "before" (Chicago, Elasticsearch, plastic, beforehand) no longer pull recent unrelated notes into results (#17).
5. **Long questions keep all their words.** In a question with several words, later words were dropped from the keyword search when earlier ones had many synonyms (#26).
6. **"The day before yesterday" means two days back** (#9).
7. **Notes are not mistaken for events.** The letters "at" and "on" inside other words made almost every note look a bit like an event (#23).

## 0.31.1 (bug-hunt batch C: extraction and parsing)

Engine build 18.12.3-mnemosyne.17 (engine changes 29 to 33). Run `/mnemosyne-setup` once after updating; outside Claude Code, `bun bin/update.ts` or Update… on the Health tab.

1. **A cut-off extraction reply no longer leaves junk facts.** When the model's reply was truncated or malformed JSON, its keys ("instructions") and lines like `"facts": [` were stored as facts. Now only real values are kept (#14).
2. **Conversations with `$` in them reach the fact extractor unchanged.** Text such as `$$`, `$&` or `$'` (prices, shell snippets, regexes) was rewritten before extraction (#11).
3. **Percentages are recognised as metrics.** "Cache hit rate is 85%." gave no metric before (#10).
4. **"Launched …" notes are events.** A note starting with "launched on", or with "launched" after punctuation, was not classified as an event (#24).
5. **Facts no longer lose the start of a word.** "X is an amazing tool" was stored as "mazing tool" (#25).
6. **Imported document headings keep a trailing `#`.** A heading like "Learn C#" lost its `#`; closing `#`s are now stripped only after a space, as in CommonMark. A document imported before this fix gets the corrected headings on its next import, so its old chunks for those headings may stay alongside the new ones (#27).

## 0.31.0 (one project memory across clones, worktrees and moves)

Issue #3. Only `scope: per-project` changes; `global` is untouched. No engine change.

1. **One memory per repo.** A second clone, a worktree, a moved repo or a fresh cloud checkout of the same remote now uses the project's existing memory instead of starting empty. Remotes match in any form (ssh, https, a port, `.git`, and case on GitHub, GitLab and Bitbucket).
2. **Nothing moves.** A folder that already has an owner keeps it, so every stored memory stays where it is. A repo seen for the first time gets `project-<repo>-<hash of its remote>`, the same on every machine; a repo without a remote, or a plain folder, keeps the path id.
3. **No names leave the hook.** `projects.json` gains a hash of each remote (`remoteKey`), never the remote, org or user. The lookup is `bun bin/projects.ts resolve`, once per folder per session; if it fails, the path id is used as before.

Tests: `tests/bun/project-identity.spec.ts` (remote forms, the rule, and real git clones, a worktree, a moved repo, a new repo and a cloud checkout against a real store and registry).

## 0.30.2 (bug-hunt batch A: six save and settings fixes)

Engine build 18.12.3-mnemosyne.16 (engine changes 26 to 28). Run `/mnemosyne-setup` once after updating; outside Claude Code, `bun bin/update.ts` or Update… on the Health tab.

1. **An older fact no longer replaces the current one.** Adding a fact with an earlier start date than the current fact for the same subject and predicate stores it as history, ending where the current one starts; the current fact stays current. No fact's date range can end before it starts any more, and the change and the insert are one step (#15).
2. **Saving the text of a retired or expired memory again leaves it retired.** Before, the save said "stored" while the memory stayed hidden. Now the reply says `retired` or `expired` with its id, Claude is told it can be restored from the dashboard, nothing named in `replaces` is retired in its favour, no knowledge is extracted from it, `/mnemosyne-import` counts it apart from saves, the dashboard's New memory shows it as kept (not as a failure), and the activity log counts it as no save (#16).
3. **`mnemopi_validate` finds the memory.** Its bank `private` is the main store and `surface` the shared store; before, both opened a new empty bank, found nothing and left the empty folder behind (#13).
4. **"Remember that…" survives a refused first try.** When Claude's first save after your remember phrase was refused (an unknown kind, a bad expiry, a bad `replaces`), the corrected retry was saved as Claude's own note. Now any refusal leaves your phrase for the retry, so it is saved as your stated fact (#18).
5. **Long project folder names get their session summary.** A project whose folder name was longer than about 84 characters never got a last-session summary; the marker now accepts every owner the project registry accepts, from one shared limit (#28).
6. **Typing `none` on the Settings page no longer reports a failed save.** A trigger-phrase list holding only `none` (any case) saves as off and the page says so (#34).

## 0.30.1 (two engine fixes from mikemikimike)

Engine build 18.12.3-mnemosyne.15 (engine changes 24 and 25). Thanks to mikemikimike for both fixes (#41, #42).

1. **Turning the model off stays off.** `llm: { enabled: false }` was read as "not set" when a model or completion was also configured, so the engine could call a model you had turned off. It is now respected, and fact extraction checks it the same way as consolidation (#6).
2. **Model replies keep their lists.** Fact extraction and other model replies no longer lose every `- item` line and the first `Source:` line, which had emptied a list of extracted facts. Summaries still drop the lines that only repeat the prompt (#8).

## 0.30.0 (storm clouds, live ties and captions in the nebula)

1. **Storm clouds.** Each cloud of three or more memories is an electric storm: it breathes slowly, and every 5 to 14 seconds it flashes in two strikes while a jagged bolt crackles between two of its memories. With reduced motion the clouds glow steadily.
2. **Ties from topics to projects, with current flowing.** Each nebula cloud has a glowing tie rising to every project that holds at least two of its memories (global memories tie to the sun). On each tie one crackling ball of electricity travels from the storm up to the project and back again, lighting the line as it passes (faster on a lit tie; a steady line with reduced motion). A tie and its ball are brighter and larger the more of the cloud the project holds. At rest the ties are faint; hover a planet and only its ties light up (the topics it feeds), hover a speck and its cloud's ties light up (the projects that share that topic). A planet's tooltip lists its topics ("Topics: sap · nce-mcs (12), …"), a speck's tooltip the projects in its cloud.
3. **Captions when the map is left alone.** After 5 seconds without mouse or wheel input on the map (at the Galaxy, no tooltip open), a random speck shows its memory's first line, fading in and out over about 8 seconds; at most three at once, never two from one cloud. Any mouse or wheel input clears them at once. With reduced motion they appear without fading.
4. The Show card has a "Nebula captions" switch, and the legend a Tie row.

## 0.29.0 (the meaning nebula)

The Meaning layout moves into the Galaxy: a nebula under the solar system shows your memories by what they say, while the planets above show where they live.

1. **The nebula.** Every live memory with a vector is a glowing speck under the orbit plane, placed by meaning (the same UMAP layout Meaning used). Specks that bunch together form clouds, each in its own colour and named after its most typical tags; the names never repeat, and tags that only say who wrote a memory (`agent:…`) are left out.
2. **Linked to the planets.** Hover a memory on a planet, or a speck, and a thread joins the two while its closest memories light up; open a memory and its thread stays. Click a speck to open its memory on its planet (a global one is flown to).
3. **Views.** Below looks up through the nebula at the planets; Side shows the two layers; from above the nebula dims so the planets stay readable. The Show card has a "Meaning nebula" switch, and the legend a Nebula row.
4. **No separate Meaning layout.** The Layout card has Galaxy and Timeline; a saved Meaning choice opens the Galaxy.
5. Inside a planet the drag and zoom hint steps aside, so the longer path no longer runs into it.

## 0.28.4 (the Galaxy pill in the button row)

On the Galaxy page the path pill now sits in the same row as the view buttons (+, -, Top, Below, Side, Reset), with the drag and zoom hint above it.

## 0.28.3 (a tidier Galaxy page)

1. **The path pill moves to the bottom.** On the Galaxy page the path (Galaxy, and the planet or moon you flew to) now sits bottom left above the hint, and the Bodies legend takes the top left corner.
2. **No Colour dots by card.** Memory dots are always coloured by writer, as the legend says; a Recalls or Age choice remembered from before is not restored.
3. **No Sample outer-belt dust toggle.** The outer belt is your real retired, expired and lapsed memories (not sample data), so it always shows; the toggle and its leftover mockup name are gone.
4. **The Bodies strip runs the full width** under the rail and the map, so more chips fit without scrolling.

## 0.28.2 (the Update button finds a new release at once)

The dashboard checks GitHub for a new release at most once a day and keeps the answer, so right after a release the Update button could stay hidden for up to a day (it did for v0.28.1).

1. **A stale answer is not kept.** When the remembered release is older than the version the dashboard runs (it was checked before the last update), the dashboard asks GitHub again.
2. **Check now.** The Health tab's System panel has a "Check now" link beside the version; it asks GitHub again (at most once a minute) and shows the Update button when a newer release exists.
## 0.28.1 (kind questions and the profile card)

Issue #56 part 2, and the "user preferences" miss the recall answer key showed. Engine build 18.12.3-mnemosyne.14, changes 22 and 23 in engine/UPSTREAM.md.

1. **Questions about a kind of memory.** "user preferences", "my decisions", "instructions" now find the memories of that kind, although their text seldom says the word. "user" or "my" next to a kind word means yours, so it is not searched. On the author's store "user preferences" went from no hit to all five expected memories in the top 10; MRR 0.798 to 0.828, and every labelled question now finds a right answer. Questions without a kind word are unchanged.
2. **The profile card.** "who is X" and "tell me about X" also get what memory knows about X, from the knowledge extracted from your memories ("is CEO and solo owner of · Interstellar Consulting GmbH", "specialises in · SAP SD, SAP Inter-Company (IC), cutover management"). "Rohit" and "Rohit Sharma" count as the same; "Rohit's MRP enhancement" does not. Only facts from memories the asking project can see are used. Every MCP client gets it in the recall reply (`entity`); the dashboard's Search tab shows it above the results, each line opening its memory.
3. **Matched words** in Search no longer list small question words ("Matched is, rohit" is now "Matched rohit"), and match whole words only.
4. **Developers:** `MNEMOSYNE_DEV_ENGINE=repo bun run dev:ui` runs the checkout's engine.
## 0.28.0 (one-step update without Claude Code)

Issue #43. A machine that runs Mnemosyne only through Claude Desktop (or another MCP client) has no `claude plugin update`, so the engine and the plugin copy behind `mnemosyne-mcp` stayed on whatever was copied by hand. New script `bin/update.ts`:

1. **One command.** `bun bin/update.ts` finds the latest release tag (`vX.Y.Z`), stages it in `~/.claude/mnemosyne/update-staging` (git, or the release tarball and `tar` without git) and runs that release's own updater. `--from <checkout>` uses a checkout instead, `--tag vX.Y.Z` picks a release.
2. **Safe swaps.** The engine goes through `install-engine.ts` (built beside the old one, checked, then swapped); the plugin copy in `~/.claude/mnemosyne/plugin` (proxy and dashboard) is staged and swapped the same way; `bin/mnemosyne-mcp.cmd` is rewritten with the current launcher, keeping its store, activity log, guard mode, vocabulary, model cache and embeddings values. The store, `config.json`, `vocabulary.json` and the activity log are never written. A failure leaves the old install working and says what is installed. Each run downloads into a folder of its own and makes its changes under `engine.lock`. The staged plugin copy is checked file by file (plus its version and the proxy's imports) before the swap. The launcher is replaced by rename.
3. **Running chats.** A running engine does not always lock its folder on Windows, so the swap is tried, not predicted. If Windows refuses it, the old version is put back, and the updater names the Claude chats' MCP processes holding it (how many, which pids) and exits 2. `--wait <s>` waits for them first; `--stop-engines` stops them, and only then.
4. **The dashboard.** The always-on dashboard (scheduled task "Mnemosyne dashboard") is stopped for the swap and started again through its task, windowless.
5. **Start Menu.** On Windows each update (or `--install-shortcut`) writes "Update Mnemosyne" next to "Open Mnemosyne dashboard". It runs the update hidden and shows the result in a message box; when chats are running it asks before stopping them.
6. **Output.** Old to new plugin version and engine build. Exit 0 done or up to date, 1 failed, 2 refused while engines run, 3 another install holds the lock.

7. **Update button.** The Health tab's System panel shows "vX · vY available" with an Update… button (or "up to date"). The release check is cached for a day, and a failed check stays silent. The confirm lists what changes, Cancel is the default, and the run is detached and windowless (WMI on Windows). It writes progress to `update-status.json`, which the panel shows, and the page reloads once the restarted dashboard is back. The old dashboard hands its port and token over through `ui-handoff.json`, once and for 30 minutes at most. Routes: `GET /api/update`, `GET /api/update/status`, `POST /api/update/start`, all behind the token (the POST also behind the origin and JSON checks).

No engine or recall change. Tests: `tests/bun/update.spec.ts` covers the planning, the swap-failure message, the progress file, process sorting, the launcher and release staging with a fake runner and fetch (no network). `tests/bun/update-dashboard.spec.ts` covers the version comparison, the daily check, the handoff, the routes' token, origin and refusal checks, and the panel's states on a stand-in document.

## 0.27.2 (fast meaning search across projects)

A dashboard search in "Keyword + meaning" across every project took 20-30 s: each project ran in its own engine process, and each process loaded the embedding model again.

1. **One warm engine.** The dashboard keeps one engine process with the model loaded and asks it for each project in turn. On the author's store: the first search about 3-4 s, later ones about 1 s, with results identical to before.
2. **Every project is searched.** The old cap of 10 projects (the smallest were skipped) is now 100.
3. **Safe by default.** The engine takes the project per call only when the dashboard starts it that way (engine change 21, build 18.12.3-mnemosyne.13); hooks and the MCP launcher clear it. With an older engine, or if the warm engine fails, search falls back to one process per project.
4. The warm engine stops after 10 idle minutes, so an idle dashboard holds no model in memory.
## 0.27.1 (Show on map selects the memory)

"Map" on a Knowledge row (and on Search and Memories) opened the Map tab but selected nothing: the request reached only the older force-graph renderer, while the Galaxy layout is drawn by the solar scene.

1. **The solar map takes the request.** It sets the memory level (breadcrumb, URL, card), flies to the memory's probe, and keeps a request that arrives before the map has loaded.
2. **Global memories too.** A true global sits in the sun belt, which is not a planet, so its card used to fall back to the store overview. It now opens its own card under "Global (sun belt)", and the camera goes back to the overview where the belt is.
3. A memory the map does not hold (retired, expired) says so in the status line.

## 0.27.0 (entity questions find what they ask about)

Issue #56, part 1 (ranking; the entity card comes later). A question like "who is Rohit" or "tell me about X" returned the newest notes that mention the name, not the memories about it. Four general rules, in the engine (build 18.12.3-mnemosyne.12, change 20 in engine/UPSTREAM.md):

1. **Intent is on.** Recall reads what kind of question it is (who/what is, how to, when) by default. `use_intent: false` on `mnemopi_recall` gives the old ranking.
2. **"Who is X" is a question about X.** It used to count as a plain fact question.
3. **The question's opening is not searched.** "tell me about", "what do you know about", "do you remember" are dropped before the keyword search, so memories that merely contain "tell" or "know" stop matching. The same words inside a question ("known issues") are still searched.
4. **About X beats mentions X.** For these questions, a memory that names X as its subject counts as a full match, and recency only breaks near-ties.

**Measured** with `bin/eval.ts` on the author's store (112 queries, 33 with answers, 6 of them new "who is" questions): the right memory in the top 5 went from 76.8% to 86.9%, MRR from 0.759 to 0.798. 98% of all queries keep the same top hit, and no labelled non-entity question changed rank. New engine tests use a made-up store.
## 0.26.1 (Health counts other agents' recalls)

The Health tab warned "Claude has not recalled anything in n days" when the memory was in daily use through other MCP agents (Codex, Claude Desktop). Now:

1. **Other agents count as use.** If Claude Code made no recall but other agents did, the finding is ok: "Other agents recalled n times in n days", with a note that this is fine if you work in other agents.
2. **Act only when no agent recalls.** The act finding is now "No agent has recalled anything in n days". Dashboard searches alone still do not count as use.
3. **When both recall**, the ok finding reads "Agents recalled n times in n days" and splits Claude Code and other agents.
4. **Tiles:** "Other apps' recalls" is now "Other agents' recalls", ok when above 0. The Claude tile is only act when no agent recalls.

No engine or recall change.

## 0.26.0 (recall evaluation harness)

The first step of the gbrain learnings: measure recall before any ranking change. New script `bin/eval.ts`:

1. **`capture`** reads the real recall queries from the activity log (and its backup), one per project and text, with how often each was asked. It writes `<root>/eval/queries.jsonl`.
2. **`run`** replays every captured query (plus the labelled set) and writes `<root>/eval/runs/<name>.json`.
   - **Safety:** it works on a snapshot copy of the store (VACUUM INTO a temp folder, removed after) with recall counts left alone, so nothing in the live store changes.
   - **Speed:** one engine process per project.
   - **Options:** `--mode keyword|hybrid`, `--k`, and `--weights vector,keyword,importance` for A/B runs.
3. **`gold-draft`** writes the most-asked queries with today's top hits (each with its first line) to `<root>/eval/gold.draft.json`. You copy the right ids into `expect` and save it as `gold.json`, the labelled set.
4. **`compare a b`** reports, on the queries both runs answered, how often the top hit is the same and how much the top 5 and top k overlap; with a gold set, recall@1, @5, @k, hit@k and MRR for each. **`report run`** gives one run's gold scores.
5. **Privacy:** queries, labels and runs hold your memory ids and query text. They stay in the Mnemosyne root (a 0700 folder, 0600 files, written by rename), never in this repository.

**On the author's store** (107 real queries over 14 projects):
- Keyword-only and keyword + meaning agree on the top hit for 84%.
- Meaning search leaves 1 query empty, against 6 for keyword-only.
- Two hybrid runs agree 100%, so a difference the harness reports comes from the change, not from noise.

No setting, engine or recall change.

## 0.25.0 (Settings tab polish)

The ninth and last step of the tab polish, following the design proposal's Settings notes.

1. **Three columns per row:**
   - what it is: the name, its key, a "Changed" label and the help;
   - the control: the current value and default, the editor, Reset and the message;
   - when and where: applies and home.

   A row used to stack about seven lines.
2. **Save only when it is a valid change:** a number or text field is checked as it is typed, against its type and range and against the rows it must agree with (the warn length stays below the max length, and the max above the warn). While the field holds an unsaved change the row has an amber edge and **Cancel** puts the saved value back. Save stays off until the change is valid. Enter saves; Esc cancels.
3. **Changed from the default:** a teal edge and a "Changed" label. A number with a range shows a track with its value and a tick at the default, and Reset to default is lit only on a changed row.
4. **When and where:** "● Applies now" is neutral; anything later is "↻ Applies next session" or "after restart" in amber. The home reads ⌂ Mnemosyne config, ⌂ Plugin option, or 🔒 for read-only. A plugin option this page cannot write says "Plugin option (read-only here)" and shows `/config` with **Copy**, in place of the bare "change it in /config".
5. **Rail and quick filters:**
   - a sticky rail of groups with their counts, and a teal dot where a setting differs from its default; a click jumps to the group;
   - quick filters with counts: All, Changed, Next session, Plugin options and Read-only;
   - each group says "n settings · m changed".
6. **Read-only facts fold** into one locked line each (the built-in secret rules, the tag format, the engine tools); opened, the facts.
7. **Reset all** moves to a danger zone at the foot. Its confirm lists exactly what changes ("Black hole: closeness 0.7 → 0.8"); the typed "reset" stays.

No server, setting or engine change.

## 0.24.0 (Vocabulary tab polish)

The eighth step of the tab polish, following the design proposal's Vocabulary notes.

1. **Usage bars:** each tag has a bar against the most used tag, then its count; the namespace shows muted before the name ("entity: arxada"), with its other spellings and description.
2. **Unused in ash:** a tag no memory uses is ash with a dashed "unused" label, not alarm amber. It is allowed, and stays until a person removes it.
3. **Topics and Projects:** "Other tags" splits into **Topics** (#) and **Projects** (▣). A project tag is one whose name is a project's whole name or its core ("uno" for Project-Uno-2025, "subshero" for Code-Subshero). A word that is only part of a name ("sap" in SAPflow, "personal" in personal-life) stays a topic. Each group has a glyph, a line saying what it holds, and its uses.
4. **Find and sort:** a find box (name, alias or description; `/` to focus, Esc to clear) and Most used / A–Z.
5. **Candidates panel** on the right:
   - each candidate is a card with ticks toward the auto-admit count, "n of N · admitted on its own at N";
   - with no candidates, an empty state explains the rule and links to the setting;
   - two notes say a candidate never changes a memory's tags until you act.
6. **Spelling suggestion:** when an admitted tag is within two edits (or one contains the other), the card says "Looks like sap (spelling)". **Count as sap** comes first, then Admit as new; "Count as…" with any tag and Apply (was "Alias to…" and Alias) stays.
7. **Tiles and ribbon:** admitted, waiting, unused and tag uses, and a ribbon of uses per group (a segment jumps to its group). Hovering a tag offers **Open N memories →**, the Memories tab filtered to that tag.
8. **Header:** the slightly tighter tab spacing keeps the header on one line at 1440 px with "in 13 projects + global".
9. **Server:** `GET /api/vocabulary` adds `autoAdmitCount` (tags.autoAdmitCount). The Memories form's tag picker keeps its own order and words. No setting or engine change.

## 0.23.0 (Health tab polish, one project count)

The seventh step of the tab polish, following the design proposal's Health notes.

1. **What needs action first:** a board at the top gives a verdict ("Running, with 1 thing to act on"), counts by state (▲ act, ● watch, ✓ ok) and up to three findings, each with one button (Open Settings, Open Knowledge, Open Review). The findings, worst first:
   - Claude has not recalled anything over the days the log covers (act: check that Claude Code has the memory tools on);
   - memories without extracted knowledge, never recalled live memories, untagged memories (watch);
   - the activity log off (watch);
   - meaning search off (information).
2. **Every tile shows its state** with a coloured top edge and a mark whose shape carries the meaning (a check in a circle, a triangle, an i), so it still reads in greyscale. Claude recalls in the log is "act" when it is 0 over more than a day of log.
3. **System panel up top:** the version, store, server, activity log and mode moved from the bottom of the page into a panel beside the board, one status mark per line. The page shows "checked HH:MM · refresh".
4. **Feature rows with state:** each has a mark. Provenance reads **By design** (only saves since provenance began carry it) with a slate bar; knowledge still missing is a blue "watch" bar. **Recalled at least once** now counts against the live memories ("81 of 95 live"), the same set as never recalled.
5. **Recalls per day, stacked by who asked:** Claude Code, other apps and the dashboard, with a legend. Days before the log began are hatched. The number under each day stays Claude's.
6. **Projects as bars** against the largest (global in gold): the five largest, then "▸ n more, 1–4 each". **Storage** shows chips: empty, with data, unused by design.
7. **One project count:** the header said 14 projects (counting global) where Health said 13. Global is not a project anywhere now: the header reads "117 memories in 13 projects + global".
8. **Server:** `/api/health-report` adds `uiRecallsPerDay` (the dashboard's searches, never counted as Claude's) and `liveTotal`. No setting or engine change.

## 0.22.0 (Review tab polish, one never-recalled count)

The sixth step of the tab polish, following the design proposal's Review notes.

1. **Triage chips:** the six queues split into **Needs a look** (a count over 0, as an amber badge; Not live in ash) and **Clear** (a dashed outline and ✓ 0). The labels are shorter; the long ones are the tooltips.
2. **Why it is listed:** a banner says why the memories in the queue are there. Each row has reason chips: amber for why (never recalled, no tags, not recalled in n days, low importance), blue for context (new · n days, recalled n×).
3. **A grace period:** a memory saved in the last 7 days has had no chance to be recalled. The banner says how many of the queue are that new. **Show new ones** (on by default, kept in this browser) hides them from Never recalled when turned off, and the banner names the day the last one returns.
4. **Keep:** a row's **Keep** hides that memory from the queues for 30 days (kept in this browser). A "This pass" line counts kept and retired with a bar. Each one done is listed above the queue: "✓ kept · Undo" or "○ retired · Restore". The confirm's cancel now reads **Keep it**, and Retire… stays grey until hovered.
5. **Readable rows and groups:** the text splits into a bold title (up to the first colon or closing bracket) and the rest. A queue that spans several projects is grouped by project (global first), with 4 rows each and "▸ n more".
6. **Retire confirm:** it opens as a strip under the memory, with "Enter retires · Esc cancels".
7. **Keys:** J and K move, O opens, Space keeps, R opens the retire confirm (Enter retires, Esc cancels), U undoes the last.
8. **One never-recalled count:** the Health report's never-recalled count and list now count live memories only, the Review rule. On a store with 22 never-recalled memories, 8 of them retired or expired, both tabs say 14.

No setting or engine change.

## 0.21.0 (Activity tab polish)

The fifth step of the tab polish, following the design proposal's Activity notes.

1. **Colour by action**, as on the map's live trails: recall gold, save blue, update green, forget red, retire an ash ring. Each row has a rail in its colour; the badges, chips and tiles follow. Five new tokens (`--act-recall`, `--act-save`, `--act-update`, `--act-forget`, `--act-retire`) are used for rails, dots and bars only, never for text.
2. **Bursts fold:** three or more lines in a row with the same action, origin and app, each within a minute of the next, become one row. It shows the count, the span, the queries asked (with counts), the projects (a strip and percentages) and the found range. Opened, it lists three lines, then "+ n more". A burst of 30 or more at one a second or faster is marked "script pace" and offers "Hide <app>"; a chip undoes it. The **Group bursts** switch is kept in this browser. A failed line never folds.
3. **Filters:**
   - the action chips (All, Recall, Save, Update, Retire, Forget, Failed) show their counts under the other filters;
   - **From** (All, Claude Code, Other apps, Dashboard) replaces "Outside agents";
   - a **Project** drop-down;
   - the App drop-down stays, for one app.
4. **Day headings:** Today, Yesterday, then dates, each with its counts by action and failures. The newest day is open and older days are folded; a click opens one.
5. **Failures in the row:** a failed line has a red rail, its error under the text, **Try again** (a recall's words go to the Search tab) and **Copy error**.
6. **Tiles:** **Recalls today** now counts every recall (it was Claude's only) with a split bar and note: Claude, other apps, dashboard. Claude's own count, the same rule as the Health tab, is in the note. Saved today shows the last save when it is 0. A new **Retired today** tile counts by project. **Failed calls** names the newest failure and has a "show ↓" link to it.
7. **Today by hour:** 24 columns stacked by action, on a square-root scale so one big burst does not flatten the rest. A column jumps to the first row of its hour.

No server, setting or engine change.

## 0.20.0 (Knowledge tab polish)

The fourth step of the tab polish, following the design proposal's Knowledge notes.

1. **Four tiles:** Items (and how many memories they came from, with a count per kind), Recalled this week, Gone quiet (amber when not 0) and Never used. The design's weekly spark is left out: the server keeps no weekly series.
2. **Kind tabs** with the memory-kind glyphs and an underline, instead of a fifth set of colours; keys 1 to 5 switch kind.
3. **Quick states:** All / Gone quiet / Never used, with counts under the other filters, replace the lone "Never used" toggle. Gone quiet means the source memory was recalled, but not in the last 30 days.
4. **Grouped by project › topic** by default. A project row shows the owner chip, the reach (every project for global, shared when its memories are shared), the count, the recall range and how recently it was used, and its topics when folded. A topic row follows, then the items. Click, Enter or ←/→ folds a project; the first three are open. **Flat** keeps the table as before; the choice is kept in this browser.
5. **Top topics** as chips with counts; a click filters to that topic.
6. **A row opens its source:** a click or Enter shows the memory the item was mined from (kind, project, reach, saved date, its text), the other items mined from it, and Open memory and Show on map. Open and Map stay in the row. O opens the memory, M the map, J and K move, `/` finds, Esc closes the source.
7. **"Used" is now "Source recalls"**, since it counts the source memory's recalls; the bar is scaled to the most in the list.
8. **Shapes:** a relation reads as subject, link and object, with its confidence as five pips (the number stays for screen readers); an instruction's state is an Active or Retired pill. A project with nothing of the kind says so and offers its memories.
9. **Server:** `GET /api/knowledge` adds each item's source `scope`, and a relation's `subject`, `predicate` and `object`. No setting or engine change.

## 0.19.0 (Search tab polish, one width for every tab)

The third step of the tab polish, following the design proposal's Search notes.

1. **One width:** every tab but the Map now shares one content width (centred up to 1440 px). Before, Memories had no limit, Search stopped at 960 px and the other tabs at 1280 px, so the edges moved when switching tabs.
2. **The query card:**
   - a big query box with a focus ring;
   - "As seen from" (was "Project"): one project searches what Claude would receive there, its own memories plus the shared and global ones, and a line under the box says so; "Every project" searches each project as itself;
   - the last five queries as chips, kept in this browser only.
3. **Each hit:**
   - the rank over a score ring (0 to 1) instead of the edge bar;
   - a head with the kind glyph and word, the owner chip, the reach, how it matched, and the date and recalls;
   - the lead in bold with the query words marked, then "Matched incoterm, location" (or "close in meaning"), up to three tags, Open and Map.
4. **The weak-match line:** in rank order, a dashed line marks where scores drop under 0.50, the matches Claude still receives but that are weak.
5. **Result header:** the count, query, mode and time, with Rank / Newest / Most recalled sorting that needs no new search.
6. **Where the results come from:** a side panel counts hits by project (with bars), kind and how they matched. A click filters the list; a second click, or Clear filter, undoes it.
7. **States:** before a search (example queries, or your recent ones), nothing found (with Switch to Keyword + meaning and Every project when they apply), searching (skeleton lines) and a failure.
8. **Keys:** `/` on Activity, Knowledge, Review, Health, Vocabulary and Settings opens Search; on Search, J and K move through the hits, Enter opens, M shows the hit on the map.
9. A hit opens in the same side panel as Memories on screens 1200 px and wider.
10. **Server:** `POST /api/search` adds each hit's `memory_type` (read from the store) and `ms`, the time the search took. The page now waits 120 s (was 60 s) before it stops a search: a cold Keyword + meaning search of every project took longer than 60 s on a 117-memory store. No setting or engine change.

## 0.18.0 (Memories tab polish)

The second step of the tab polish, following the design proposal's Memories notes.

1. **Groundwork the next tabs reuse:**
   - an owner chip (global in gold);
   - kind glyphs (a CSS mask per kind; the shape alone tells the kind);
   - a reach marker: all is a gold dot, shared a dashed blue ring, project a plain ring, as on the map.
2. **Each row is one line:**
   - the lead (up to a colon) in bold, with at most three tags under it ("+n" for more); the Tags column is gone;
   - new Kind, Reach and Importance (five pips) columns;
   - recalls as a log-scaled bar;
   - the saved time as "09:42", "19 Oct" or a date.
3. Not-live rows are in ash with their state as a worded pill.
4. **One filter bar:** text, tag or id, with `/` to focus it; the tag is a token inside the bar. "Show retired" became a Live / Not live / All control with counts. It is still this viewer's setting; the old "on" reads as All.
5. **Reach and kind chips,** counted by the server under the other filters. A chip with 0 is disabled.
6. **Title, groups and empty state:**
   - the title counts live, not live, global and shared memories, and the projects;
   - rows are grouped under sticky day headings (Today, Yesterday, then dates); the "Most recalled" sort is not grouped;
   - with no rows, an empty state names the filters that are on, with Clear project and Clear all filters.
7. **Keys:** J and K move, Enter opens, Esc closes (and in the filter box clears it first), `/` filters, N starts a new memory. A hint in the footer lists them.
8. **The memory panel:**
   - on screens 1200 px and wider, opened from Memories, it stands beside the list and the list makes room;
   - its head shows the kind, the owner chip and the reach;
   - a four-number strip (importance, recalls, saved, state) and a sentence on the reach were added.
9. **Server:** `GET /api/memories` takes `reach=all|shared|project` and `kind=`, returns `facets: { reach, kind }` and each row's `memory_type`, and its `q` also matches the start of an id. No setting or engine change.

## 0.17.0 (dashboard shell and shared design tokens)

First step of the tab polish: the header every tab shares, and the design tokens the next tabs build on.

1. Shared tokens in `ui/style.css`: the map's data-role colours (gold, shared blue, bond violet, slate, ash), amber for waiting, and a spacing, radius and type scale.
2. The active tab is a teal underline instead of a filled pill. The header says "117 memories in 14 projects"; the plugin and engine versions moved behind an ⓘ About button.
3. One connection pill replaces "local only": "Local · live" (teal), "Reconnecting…" (amber) or "Link expired" (red ring). The standing "Connected to the local Mnemosyne server." line is gone.
4. When the server stops, an amber strip says so, counts down to the next check ("Next check in 8 s"), and has a Try now button; the page's data is dimmed as out of date. When the link expired (the server restarted), a recovery card replaces the red sentence: run `/mnemosyne-ui` (with a Copy button), open the new link, and nothing was lost.
5. The server watch gained `nextIn()` and `retry()`. No server, setting or engine change.

## 0.16.0 (calm motion, folding tethers, focus)

1. Calmer motion: everything on the map turns at half the earlier speed (orbits, planet rings, moons and their swarms, probes, the sun belt, the camera's auto-rotate). While a tooltip is open, and for 2 seconds after it closes, nothing turns, so a hovered memory stays under the pointer long enough to read (before, only the orbits slowed to 15% and the dots kept moving). The planet tooltip's "one orbit every N min" follows the new speed.
2. Folding tethers (design proposal item 3): with no focus, each gold tether shows only a short stub (three beads at the sun belt, two at the planet), so long lines no longer cross the whole map. The focused project's tethers draw in full and brighter; other projects' are hidden.
3. Focus (item 5): the project you hover (its planet, memory dots, ring or probes; kept for the 2-second hold) or the one you opened is in focus. A white ring marks it at galaxy level, its black-hole bonds brighten and keep their "N pairs" chip, other bonds fade and lose the chip, and other planets' labels step back.
4. The planet tooltip gains a line: "N shared with every project (probes) · M global memories close (best S)". No server, setting or engine change.

## 0.15.0 (colours and lines)

From the galaxy design proposal (items 1 and 2): each colour has one meaning and each kind of line its own shape, so they cannot be mistaken for each other.

1. Colour roles: gold = belongs to every project (sun belt, tethers), blue = shared but lives in a project (probes), violet = a bond between two projects only, slate = structure (orbits), ash = no longer live. The outer belt of retired, expired and lapsed memories moves from violet to ash grey; orbits are slate.
2. Gold tethers are strings of gold beads on an arc lifted above the orbit plane (16 beads, a fixed 4 px on screen so they read from the galaxy view), not straight lines.
3. A black-hole bond is two violet strands side by side with an "N pairs" label at the top of its arc.
4. Probes ride a dashed blue ring (28 dashes), so the ring reads as "shared from this home" even where the probes are tiny.
5. The legend's right card names them: Orbit, Gold beads, Probe · dashed ring, Outer belt (ash), Twin violet strands. No server, setting or engine change.

## 0.14.0 (probes)

1. A project's memory shared with every project (scope global) is now a **probe** circling its own planet, station or starship, just outside the moons (up to 48 per body), instead of a blue dot in the sun belt. It belongs to that project and is visible to every project; the probe says so. Hover names the memory; a click selects it and flies to its body. The memory also stays an asteroid in its kind's swarm, so sizes and counts are unchanged.
2. The sun belt holds only the true global memories (owner global, gold), with their tethers from 0.13.0. The store card shows "Global (sun belt)" and "Probes (shared from projects)" as two numbers. Legend row "Probe". No server, setting or engine change.

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
