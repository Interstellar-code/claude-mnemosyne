# Dashboard UI polish: proposal per page

Date: 2026-10-24. Status: proposal, nothing built. Source: a read-only review of
`ui/` (four parallel reviews plus the screenshots). No browser run was done, so the
line references are from reading the code, not from a live check.

Effort: S = under an hour, M = a few hours, L = a day or more.

## 0. Cross-page changes (do first, every page gains)

| Id | Change | Effort |
|----|--------|--------|
| X1 | Map is the first page that loads | S |
| X2 | One shared bottom sheet for details | M |
| X3 | Version/Store/Server footer moves into Health | S |
| X4 | Glossaries become tooltips or a "?" popover | S |
| X5 | Hide empty columns, clamp long text to 2 lines | S |

1. X1. `ui/app.ts:509` `let current: View = 'memories'` and `ui/app.ts:576`
   `show('memories')` become `'map'`. `VIEWS` already lists map first. Risk: the map
   is the heavy page (three.js), so its "Loading…" and failure message must be
   readable on first paint.
2. X2. A single bottom sheet component (slides up from the bottom, about 60-70% of the
   height, Close button and Esc, focus returns to the clicked row, two columns on
   wide screens). It replaces the narrow right panel on Memories and is reused by
   Knowledge (click a fact), Activity (open a memory) and Review. Use a plain
   `aside` with a class toggle, not `<dialog>`, because the tests use a fake DOM.
3. X3. The `#foot` block (`index.html:328`) shows on every tab and adds noise. Make it
   a collapsed "About this server" card at the bottom of Health.
4. X4. The static `<dl>` legends on Activity become hover tips on the badges plus one
   collapsed "What do these mean?" block.
5. X5. Columns that are empty for the current filter are hidden; long text is clamped
   to 2 lines with the full text in the sheet.

---

## 1. Map

What you asked, and the plan:

1. Collapsible left panel (S-M). Each rail card (`Layout`, `Colour by`, `Glow`,
   `Links`, `Knowledge`, `Activity layers`, `Projects`) becomes a `<details>` accordion.
   Layout and Colour by start open, the rest closed; open state is remembered in
   localStorage like glow and layout already are (`ui/map.ts:366-374`). The topics box
   is forced open when a project is focused.
2. Details below the graph (M). Recommended hybrid: the clicked star or project shows
   in a full-width card under the graph (two columns: text left, stats, knowledge
   and similar right). The right column keeps the always-on Overview. Lower the stage
   height a little (620px to about 540px) and scroll the card into view on a new
   click, so it is never off screen.
3. "Reading the map" legend to the right column (S), as a collapsed
   "How to read this" block under Overview.
4. Live indicator to the right column (S), as a small card: On/Off pill and the last
   5 events. The ids stay, so `ui/map.ts` needs no change.
5. Map as the default page: see X1.

More polish:

6. Hide "Simulate a recall / Simulate a write" (they are demo buttons) behind a small
   "Demo" menu or `?demo=1` (S).
7. Links and Activity-layer checkboxes become compact toggle chips like the Knowledge
   chips, which cuts about 8 rows from the rail (M).
8. The left rail can collapse to an icon strip, to give the graph full width (M).
9. Keyboard shortcuts: `/` find, `R` rotate, `0` reset, `1/2/3` layout, `Esc` clear,
   listed in the stage hint (S-M).
10. Glow moves into the stage controls as a small popover (S).

Layout target:

```
┌ rail (accordion) ┐┌──────── graph ────────┐┌ Overview      ┐
│ ▸ Layout         ││                        ││ 151 memories  │
│ ▸ Colour by      ││                        │├ Live ● On     ┤
│ ▸ Links          ││                        ││ last 5 events │
│ ▸ Knowledge      │└────────────────────────┘├ How to read ▸ ┤
│ ▸ Activity       │┌ Selected: star detail ─┐└───────────────┘
└──────────────────┘└────────────────────────┘
```

---

## 2. Memories

1. Bottom sheet for the selected memory (M, see X2). Today the detail is a 380px
   right panel (`ui/style.css:314-322`, `memoryDetail` at `ui/app.ts:315-381`), which is
   why it is hard to read. The sheet shows the full text large on the left, and on
   the right saved, recalls, last recalled, source, importance, scope, tags and
   Forget. The list gets bottom padding while it is open so the last rows stay
   visible.
2. Denser rows (S): less cell padding, the memory id moves from under every row into
   the sheet, and the text is clamped to 2 lines.
3. Tags already filter on click (`ui/app.ts:269-288`); give them a visible hover and
   cursor so people find it (S).
4. Recalls column shows "never" instead of 0, with last-recalled as a tooltip (S).
5. Optional: paging past 1000 rows (M).

---

## 3. Activity

Your questions answered first:

1. "Tool" is not an expand. The Source cell shows "Claude tool" and below it the raw
   origin word `tool` plus the session id. Only the session id is a button: clicking
   it filters the list to that one session and adds the "Session: f36dd5c4 ×" chip.
   It looked like an expand because the list changed. `tool` means Claude called a
   memory tool itself; the other origins are `hook` (automatic recall), `trigger`
   (you said "remember that"), `external` (another app through mnemosyne-mcp), `ui`
   (this dashboard) and `backfill`.
2. WHAT is empty on "learn" rows because the knowledge-extraction log line is
   written without any text (`hooks/register.ts:744-751`, `923-931`), only the
   memory id and "14 items". The page has no fallback for it.

Proposal:

3. A plain sentence in WHAT for every row (S), for example
   "Claude learned 14 items from: <memory preview>",
   "Claude recalled 5 for "plan template"", "You said: remember …".
   Two parts: write the text at the source (the extract hook knows the memory text),
   and for old lines look the preview up by memory id on the page.
4. One-line Source cell (S): "Claude Code · tool", with the session as a small chip
   whose tooltip says "show only this session".
5. Real row expand (M): click or Enter opens a detail line under the row with the
   full text, memory ids as links that open the bottom sheet, the result breakdown
   (for learn: "9 facts, 3 instructions, 2 relations"), client, session and error.
6. Group by session (M-L): "Session f36dd5c4 · 12:19-20:00 · 4 events", collapsible.
   Live events slot into the open group.
7. The two static legends become tooltips plus one collapsed block (S, see X4).

Row target:

```
20:00:51  learn     Claude Code · tool  matrixkoder  Learned 14 items from "2026-10-24: the numbered-block…"  14 items ▸
          └ 9 facts · 3 instructions · 2 relations   memory b27d8318 ↗   session f36dd5c4
```

---

## 4. Search

Does search already use embeddings? Yes, when the dashboard started with embeddings
on, and on this machine it did (`embeddings.json` is present, so `bun run dev:ui`
starts with them on). That comes from reading the code, not a live test. The engine's
recall blends meaning into the keyword score. But the page never tells you this,
you cannot turn it off, and it shows only 5 results.

Proposal:

1. "Match by" control (M): Keyword | Keyword + meaning. Keyword runs the engine with
   embeddings off for that request (true keyword-only). The control is disabled with
   a hint when the server has no embeddings. A pure "Meaning only" mode needs an
   engine change (L), so it comes later if wanted.
2. A "why it matched" badge per result (S-M): keyword, meaning, or both. The engine
   already returns keyword and dense scores per hit; the server throws them away
   today (`mergeHits`, `ui/server.ts:1488-1501`).
3. More results (S): 20 instead of 5, with "Show more". The engine already pulls 50
   candidates.
4. Click a result to open the bottom sheet instead of jumping to Memories (S, after
   X2).
5. Project filter and recent searches under the box (S).

Untested risk: with meaning on, each of up to 10 projects starts its own engine
process and may load the model, so a search across all projects could be slow.
Measure it before raising limits.

---

## 5. Knowledge

1. Used column (S): a number plus a small bar instead of the wrapped sentence
   "its memory was recalled 0 times"; the meaning goes into the header tooltip.
2. Hide the Status column on Facts, Preferences and Timeline, where it is always
   empty (`statusOf`, `ui/knowledge.ts:179-183`) (S).
3. The banner "started without the extraction setting…" is hidden when items exist,
   because they prove extraction ran. It shows only for "off" or for zero items (S).
4. Filters and sort (S-M): project, "never used", text find, sort by used or last
   used. All client-side, since the data is already on the page.
5. Group by source memory (M): "From memory 'MatrixKoder plan template…' · 6 facts",
   collapsible. This removes the repeated "Show on map" link and repeated used counts.
6. Click a row to open its source memory in the bottom sheet, with Show on map and
   Forget there (M, after X2).
7. The three tiles become one summary line, and "never used" is clickable to apply the
   filter (S).

---

## 6. Health, and a new Review tab

Health keeps only the overview:

1. Tiles, feature coverage, the recalls chart and Projects stay.
2. Remove "Most recalled" (S). Keep the field in the API so its tests stay green.
3. Storage becomes a collapsed block (S-M): summary line
   "Storage · 2.2 MB · 42 tables, 18 empty", with a filter All | Has data | Empty
   and a scrolling list when opened.
4. The 14-day chart shows only the days the log covers, or greys the earlier days:
   today 12 zero bars read as "no recalls" when they mean "no data" (S).
5. Feature bars become a compact checklist with a one-line fix hint on the ones that
   are not done (S).
6. The "Never recalled" tile links to Review (S).
7. A recalls trend on the tile, last 7 days against the 7 before (M).

New Review tab (M), where memory upkeep happens:

8. "Never recalled", moved from Health, with Open (bottom sheet) and Forget per row.
9. Filters on the same list, available today with no server work: no tags, not
   recalled for 30+ days, low importance.
10. Later, with server work: possible duplicates (similar pairs from the embeddings
    the map already computes), memories with no author, memories with no knowledge
    mined, and a "Keep" that dismisses a row (needs stored state).

Server: the move works with today's API. A small `GET /api/review` endpoint is
better than reloading the whole health report (M).

---

## 7. Suggested order

| Id | Batch | Effort |
|----|-------|--------|
| B1 | X1, X3, X5, Health 2-4, Knowledge 1-3 | S each |
| B2 | Bottom sheet (X2) on Memories | M |
| B3 | Map rail, details, right column | M |
| B4 | Activity sentences, source cell, expand | M |
| B5 | Review tab | M |
| B6 | Search match-by and why-matched | M |
| B7 | Grouping (Activity, Knowledge), extras | M-L |

Each batch is a small change in this checkout, verified once with the repo's
gates. Tests that pin today's DOM need updating along the way, mainly
`tests/bun/ui-views.spec.ts`, `feed.spec.ts`, `inert.spec.ts`, `health-view.spec.ts`
and `knowledge-view.spec.ts`.
