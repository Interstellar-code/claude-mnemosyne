# mapx-solar-map: The dashboard's Galaxy view becomes a solar system (a port of the approved mockup)

Status: decided, ready to build (Rohit's decisions 2026-10-25, see Decisions). Created 2026-10-25. Baseline: `main` at `ba6f97d` (plugin 0.8.2). Delivery: each task group on a short branch off `main`, merged straight into `main` after a separate review; nothing is pushed. Release: 0.8.3 (Rohit, confirmed 2026-10-25).

This plan was split out of phase MAPX of `docs/plans/mnemosyne-v3.md` on 2026-10-25, because Rohit wants the map built first, ahead of the rest of 0.9.0 (the dashboard writes, the importers, session summaries and the expiry sweep). Everything the old MAPX text said is carried here; what changed, and why, is listed in "Notes for the reviewer". A later step removes MAPX from the 0.9.0 plan; "What the 0.9.0 plan must drop or point to" is the list for that step.

## Summary

The Galaxy view of the dashboard's Map tab becomes a solar system. The memory store is a sun, each writer is a nodule on its surface, each project is a planet, tags are land on the planet, memory kinds are moons, and each memory is an asteroid. Belts hold the untyped, global and no-longer-live memories, and black-hole pairs link similar memories across projects. Timeline and Meaning stay as they are. The look and behaviour are fixed by an approved mockup (Mnemosyne Dashboard canvas, version 31, exported to `docs/plans/mapx-design/`), so the work is a port of that code onto real data, the dashboard's security policy and the repo's tests, not a redesign.

The plan has 12 tasks (MAPX.0 to MAPX.11): MAPX.0 is done, four build waves follow, and MAPX.9 comes later. The build is laid out for speed (Rohit, 2026-10-25): the rules port starts in wave 1 against a fixture, the page shell is built beside the scene against a fixed scene interface (C13), and the docs are drafted early, so the serial path is the rules, the scene, the wiring and the Details panel. MAPX.0 (the design) is done. The first release is read-only: the Details panel shows everything about a memory but does not change it. Edit, Pin and Retire from the Details panel are MAPX.9, which waits for the 0.9.0 write routes and forms.

## How to use this plan (for the coordinator)

1. Orchestration is Orca: Orca worktrees and the `orchestration` skill. This plan uses no other orchestrator.
2. Each task below is written to be pasted as a worker prompt. A worker prompt is: the "Standing constraints for every worker" section, the "Phase block" (file scope, hazards, review level), and the task block (goal, acceptance, refs, gate).
3. Task ids are stable and are not in build order; the build order is the wave table. MAPX.1 to MAPX.7 keep the ids they had in the 0.9.0 plan; MAPX.8 to MAPX.11 are new (MAPX.11, the page shell, was split out of MAPX.6 for speed).
4. Tasks marked "Rohit" are manual: do not dispatch them to a worker.
5. One task cannot start until 0.9.0 work lands: MAPX.9 (needs CRUDX and CRUD). Everything else needs nothing from the 0.9.0 plan (see "Dependencies on the 0.9.0 plan").
6. The three Orca lanes (`v3-lane-a`, `v3-lane-b`, `v3-lane-c`, under `/Users/rohits/orca/workspaces/claude-mnemosyne/`) were created at `2f1a104`, which is behind `main`. Before a lane starts a task it creates a fresh short branch off `main`. The old lane branches (`v3/crudx`, `v3/import`) hold no commits of their own on 2026-10-25 and are left to the 0.9.0 plan.
7. This plan assumes the map runs alone on the three lanes. If the coordinator starts 0.9.0 work on an idle lane meanwhile, the shared files in the dependency table apply: whichever branch lands second rebases.

---

## Goal

The Galaxy view of the Map tab looks and behaves like the approved mockup, on the real store, live. Rohit: "I'm happy if I get this exact design."

Why: the 0.6.0 galaxy shows every memory as a star but cannot show who wrote a memory, what kind it is, whether it is pinned or about to expire, which projects share memories, or how busy a project is. The new view carries all of that in one picture, and the 0.9.0 write features (Retire, Pin, Edit) attach to it later.

From: Rohit's mapping decisions of 2026-10-25, the approved canvas (version 31), and `docs/plans/mapx-design/` (the port map, the spec sheet and the mockup code).

---

## Design / context

### What is wrong today

1. The Galaxy layout draws every memory as a topic star (`ui/map.ts`, built on 3d-force-graph; rules in `ui/map-state.ts`, positions in `ui/map-layout.ts`). It has no writer, no kind, no pin, no expiry, no project kind and no activity measure.
2. `GET /api/galaxy` (`galaxyLevel`, `ui/server.ts:1124`) returns, per memory, only `id, owner, tags, recalls, lastRecalled, created, label` (plus `position` and `similar` neighbours when the meaning layout exists), per project only `owner, label, count, recalls`, and a top-level `knowledge: [{ id, kind, text, memory }]` list of the facts, preferences, instructions, timelines and relations mined from the listed memories (`ui/server.ts:1161-1183`; each text is one line cut to 80 characters by `galaxyLabel`). That `knowledge` list is the source of the map's satellites (mapping row 18); nothing new is needed for them. Its WHERE clause (`GALAXY_WHERE`, `ui/server.ts:694`) is only "has an owner", so retired, expired and lapsed rows are counted and drawn like live ones.
3. `GET /api/memories/<id>` (`getMemory`, `ui/server.ts:652`) returns the full text, importance, recalls, scope, metadata, source, kind (`memory_type`) and veracity, but not trust tier, expiry, replacement, state or the audit trail.
4. "How often in the last 30 days" cannot be answered: the activity log (`activity.jsonl`) rotates at 1 MB (`bin/activity.ts:18`) and held only 2026-10-23 to 2026-10-25 on 2026-10-25.
5. The plugin works out a project's owner id from the repo root (`owner()`, `hooks/register.ts:344-351`) and throws away whether the project is a git repo, whether it has a remote, and where. So the map cannot tell a repo from a plain folder.
6. The vendored 3D bundle (`ui/vendor/map-lib.js`) exports only `ForceGraph3D`, `SpriteText` and four post-processing passes (`scripts/vendor-map.ts:37-43`). The mockup's scene needs plain three.js classes and `OrbitControls`.
7. The real store on 2026-10-25 (read-only check): 123 live memories in 5 projects, 6 with scope global, 0 not live, writers `claude-code` 121 and `imported` 2, and 123 stored vectors. Of the 121 `claude-code` rows, 111 carry `metadata.source_backfill = 'inferred'` and 10 carry `'author'`. No code in this repo writes `source_backfill`; an earlier one-off backfill did, and the map only reads it.

### The port approach

The approved mockup is a working 3D app on three.js r186, the version the repo pins (`three` 0.186.1). Its code is in `docs/plans/mapx-design/`: `MapSolar.dc.html` (the board), `MapSolarSpec.dc.html` (the spec sheet), `solar-scene.js` (the board's script, extracted; about 1040 lines and, by a method-header count, 40 methods, though its README says 33) and `README.md` (the port map). The mockup is the contract for look and behaviour. Where the spec sheet and this plan disagree, the spec sheet and this plan win over the mockup's code; where this plan and the spec sheet disagree, Rohit decides (the coordinator asks).

Reused as is, or nearly (about two thirds of the code):

1. scene building: `initScene`, `makePlanet`, `makeCraft`, `memoryRing`, `makeHoles`, `circle`, `pointsObject`, `glow`, `label`;
2. the procedural textures: `planetTexture`, `sunTexture`, `glowTexture`, `dotTexture`;
3. motion: `frame`, `spreadSwarm`, `satellites`, `recolour`;
4. interaction: `pick`, `act`, the flights (`flyTo`, `flyPlanet`, `flyMoon`, `flyMemory`, `flyMemoryDirect`, `flyHome`, `view`, `dolly`) and `findGo`;
5. the rules: `targets`, `orbitSpeed`, `planetR`, `extent`, `styleOf`, `sizeClass`, `describe`, `labelName`, `tagColour`, `dotColour`, `searchResults`, `metric`, `linksOf`.

What changes in the port:

1. The page runtime. The mockup's `<x-dc>` markup, `renderVals()` and `setState` exist only inside the design canvas. In the dashboard, the Map tab's markup is static HTML in `ui/index.html` (`<main id="view-map">`, line 29) filled by `ui/map.ts` (`createMap`, line 371) with `createElement` and `textContent`, and its logic is in `ui/map-state.ts`. The page around the scene is rebuilt there, not in `ui/app.ts` (which only calls `createMap`, line 690).
2. The security policy. The page's Content Security Policy is `style-src 'self'` (`ui/server.ts:72-73`), so the mockup's inline `style="..."` attributes (117 lines of `MapSolar.dc.html` carry them) are refused. All styling moves to classes in `ui/style.css`; dynamic values (tooltip position, a dimmed chip) are set through `element.style` or a class. Google Fonts cannot load, so the dashboard's own fonts stay.
3. The 3D library. The mockup reads a global `window.THREE`. The dashboard imports `ui/vendor/map-lib.js`, so MAPX.1 adds the needed three.js classes and `OrbitControls` to its export list, with no new package. Timeline and Meaning stay on `ForceGraph3D`. Switching views disposes one renderer before creating the other, so there is at most one WebGL context.
4. The data. The hard-coded `PROJECTS`, `LINKS` and `WRITERS` become `GET /api/galaxy` (MAPX.2), `<root>/activity-daily.json` (MAPX.3) and `<root>/projects.json` (MAPX.8).
5. Live events. The simulated events become the real activity stream (`ui/stream.ts` carries the stream; `toMapEvent` is in `ui/map-live.ts:47`), with the same visuals. The dashboard's two Simulate buttons ("Simulate a recall" and "Simulate a write", `ui/index.html`, backed by `simulate()` at `ui/map-live.ts:115`) stay and keep drawing demo events; the mockup's four per-kind buttons are not added.
6. Find. Memory results come from `POST /api/search` (keyword plus meaning); bodies, moons and tags stay local. That route writes a 'recall' line to the activity log and is single-flight; MAPX.11 says how Find handles both.
7. Tests. The rules become a pure module (`ui/solar-layout.ts`), the scene goes into `ui/solar.ts`, and a spec drives every hover, click, flight, Find and filter on the vendored three.js with stubbed browser parts.
8. No sample data ships. The mockup's six sample folders, "(sample)" labels, sample outer-belt dust, sample memory text and sample satellites are demo data; the real view shows only what the store, `projects.json` and the stream hold.
9. Names and seeds. The mockup keys every project's look on `fnv(p.id)` where `p.id` is the project name (`matrixkoder`). The real id is the owner (`project-matrixkoder-<hash>`), so hashing it would give different styles, angles and land masses than the approved canvas. MAPX.4 hashes the project label (`projectLabel(owner)`, `ui/server.ts:673`, which gives `matrixkoder`), with the owner as the tie-break, so the real five projects look as they do on the canvas.
10. Writer colours. The mockup hard-codes `claude-code` and `imported`. MAPX.4 assigns each writer a colour from the colour-blind-safe palette in order of memories written (most first); the first two entries are the mockup's `#56B4E9` and `#CC79A7`, so the real store looks as approved.
11. Motion. The spec sheet says "motion pauses on hover or selection"; the mockup's code slows every orbit to 15% while a tooltip shows (`hoverSlow`, `solar-scene.js:710`) and does not pause on selection. The mockup behaviour wins (it is what Rohit approved).

Beyond the mockup (the code does not have these, but the spec sheet or Rohit's decisions require them):

1. a pinned memory has a halo; a memory in its last 7 days before expiry fades;
2. asteroid size follows importance and brightness follows recalls (the mockup's per-memory sizes are sample);
3. a project idle for 30 or more days gets an ice cap;
4. a local-only repo gets a "no remote" mark, and an owner with no `projects.json` record is a planet marked "kind unknown";
5. a row whose writer was backfilled (`metadata.source_backfill = 'inferred'`) is drawn a little fainter;
6. the URL hash holds the level (the mockup has no hash handling);
7. Tab moves through sun, planets, moons and memories (the mockup has no keyboard support).

### The mapping (Rohit's decisions, 2026-10-25)

| # | Object | Stands for | Visual |
|---|---|---|---|
| 1 | Sun | the memory store | size = live memory count; it turns; a soft glow, dim enough that its surface (granulation, sunspots) stays visible |
| 2 | Nodules on the sun | writers (`source`) | size = memories written; turn with the sun; flare on write |
| 3 | Planets | projects (owners) | size = memory count; the owner 'global' is not a planet or a chip, its rows live only in the sun belt (row 14) |
| 3a | Planet style | size class | gas giant 30+ (Jupiter, Saturn), ice giant 10-29 (Neptune, Uranus), rocky under 10 (Earth, Mars, Venus, Mercury), dwarf under 3 (Pluto); neighbours in a class get different variants |
| 3b | Planet or craft | project kind (`projects.json`, MAPX.8) | a git repo is a planet; a local-only repo is a planet with a small "no remote" mark; a plain folder is a craft: a space station when it is a lasting workspace (5 or more memories; ring station, tags as lit panels, memories docked) or a starship when it is small or new (under 5; saucer and nacelles, tags as lit windows, it faces its direction of travel); an owner with no record is a planet marked "kind unknown" |
| 4 | Orbit distance | the Arrange by choice | default: activity, busier = closer |
| 5 | Surface land masses | the project's tags | area = times used there; on gas giants they are coloured bands and storm spots |
| 6 | Moons | memory kinds | one per kind present; size = count |
| 7 | Moon swarm | that kind's memories | one asteroid per memory; from Galaxy level the planet's memories show as a ring of asteroids around it |
| 8 | Asteroid colour | writer (Colour dots by) | or recalls, or age |
| 9 | Asteroid size | importance | bigger = more important |
| 10 | Asteroid brightness | recalls | brighter = recalled more |
| 11 | Halo | pinned | always visible |
| 12 | Fading | expiry (`valid_until`) | dims in its last 7 days |
| 13 | Planet asteroid belt | kind 'unknown' | old untyped rows (and a dwarf's memories) |
| 14 | Sun asteroid belt | global memories | rows with scope 'global' (6 on 2026-10-25), and any owner 'global' rows; each still counts toward its planet's size |
| 15 | Outer galaxy belt | retired, expired, lapsed | faded; Restore pulls it back |
| 16 | Black-hole pair | similar memories across projects | pulsing energy: older planet to its black hole to the partner's black hole to newer planet; moons stay more prominent than black holes |
| 17 | Binary pair | near-duplicates in one project | Review lens only. DEFERRED to a later task (Rohit, 2026-10-25): not built in this plan (see Open questions, L1) |
| 18 | Satellites | a memory's knowledge items | around the selected memory |
| 19 | Recall comet | a live recall | gold, from the planet to the caller's nodule (the agent in that project asks) |
| 19a | Save comet | a live save | blue, from the writer's nodule to the planet |
| 19b | Update beam | a live update | a neutral green beam from the writer's nodule to the body |
| 19c | Forget laser | a live forget | a red laser from the writer's nodule to the body; the memory fades |
| 20 | Clouds, ice cap | needs review, idle 30+ days | clouds when more than a quarter of a project's memories are kind unknown; an ice cap when the project's newest live memory was saved or recalled 30 or more days ago (`lastActive`, C11.2) |

The spec sheet (`MapSolarSpec.dc.html`) lists the space station and the starship as rows 3c and 3d and the clouds and ice cap as row 20; the 0.9.0 plan folded 3c and 3d into 3b and left row 20 out. All are kept here. Shown in the Details panel only, not on the map: trust tier, veracity, author and the audit trail.

### Arrange by

It replaces the rail's Colour by card. Planet size is always the memory count; only orbit distance changes, and each planet keeps its angle so you can still find it.

| # | Option | Orbit distance |
|---|---|---|
| 1 | Activity (default) | writes + recalls in the last 30 days; busiest closest |
| 2 | Size | memory count; biggest closest |
| 3 | Age | median age of live memories; youngest closest |
| 4 | Recalls | lifetime recalls; most recalled closest |

Until the daily tally (MAPX.3) holds 30 days, Activity uses lifetime numbers (memories plus recalls) and the panel says so.

### Layout and behaviour (Rohit, 2026-10-25)

The map stays a true 3D scene like 0.6.0's (orbit by dragging, from the top or below; right-drag pans; scroll zooms; Top, Below, Side and Reset buttons; auto-rotate is offered but off by default, because a turning camera cancels out the planets' own slow orbits). Space is near-black: no grey haze from the star field or the bloom. A Find box sits at the top centre of the map (as in 0.6.0): typing lists matching planets, stations, starships, kind moons, tags and memories (memories through the existing `POST /api/search`, keyword plus meaning), dims every body that does not match, and picking a result or pressing Enter flies the camera there and opens it in the Details panel (a memory result flies straight into that memory); Escape clears it. Under the map, a fixed-height Bodies strip lists every planet, station and starship as fixed-width chips in at most two rows (more scroll sideways, never down); a chip shows or hides that body on the map without moving the camera (a hidden body also hides its label, orbit line when it is alone on it, black holes and live events), and Show all brings everything back; clicking a body on the map still flies in. The left rail keeps Arrange by, Colour dots by and Show only. The legend floats in the map's two empty top corners (Bodies on the left, Belts, links and motion on the right) and can be hidden. Under the map, a full-width row holds the Details panel (the clicked sun, planet, moon or memory) and, beside it, the Live activity log of 0.6.0, which stays. Drill-down is a camera flight, as the 0.6.0 map's camera flights are: a click speeds the camera into the body (star streaks), and the next level settles in; the path bar flies back out; reduced motion switches instantly. Wheel, +/- buttons and drag zoom and pan at every level. Every body has a hover tooltip (planet: style, counts, top tags, black holes; land or band: tag, uses, other planets with it; moon; asteroid; belt; outer-belt memory: its state, the date, its project and Restore; black hole; satellite). Levels: Galaxy (sun, planets, belts, black holes), then Planet (camera flies in; labelled land masses, kind moons, its black holes named by partner), then Moon (the swarm spreads into a readable ring), then Memory (satellites, and the detail panel). The path bar shows the level, and the URL hash holds it so a reload returns there.

Rules and caps from the spec sheet, which the build keeps:

1. Orbits are ordered rings by rank; ring gaps grow with planet size, so planets never overlap.
2. A project under 3 memories is a dwarf planet: small, no moons, its memories in its belt; it keeps its rank's ring.
3. At most 12 land masses per planet; the rest are small islands. At most 8 moons.
4. A black hole needs 2 or more similar pairs (cosine 0.80 or more) between two projects.
5. Asteroids appear only at Planet level and deeper; at Galaxy level a swarm is a haze.
6. Every body has a tooltip (the list above).
7. Motion slows to 15% while a tooltip is showing (the mockup's behaviour; the spec sheet's word "pauses" is read this way, and selection does not pause); reduced motion stops orbits and flights; Tab moves sun, planets, moons, memories.
8. Colours come from a colour-blind-safe palette; a tag's hue family comes from its namespace.

### File map

1. `scripts/vendor-map.ts` and `ui/vendor/map-lib.js`, `map-lib.d.ts`, `map-lib.inputs.json` (and `scan-allow.json` if a reviewed scan count moves) are changed by MAPX.1.
2. `ui/server.ts` (`galaxyLevel` and its helpers, `getMemory`, the meaning cache version) and `ui/semantic-worker.ts` (cross-project pairs) are changed by MAPX.2.
3. `bin/activity.ts` is changed by MAPX.3.
4. `ui/solar-layout.ts` (new, pure) is changed by MAPX.4.
5. `ui/solar.ts` (new) and `ui/map-live.ts` (event mapping only) are changed by MAPX.5.
6. `ui/index.html`, `ui/style.css`, `ui/map.ts`, `ui/map-state.ts`, `ui/app.ts` (`takeToken()` and the `createMap` call only) and `ui/tsconfig.json` are changed by MAPX.11 (the page shell, `takeToken()`) and MAPX.6 (the wiring, the `createMap` call); MAPX.7 changes the Details panel in `ui/map.ts`, `ui/index.html` and `ui/style.css`.
7. `hooks/projects.ts` and `bin/projects.ts` (new) and three small hunks of `hooks/register.ts` (an import, a spawn helper beside `record()`, one call in `session.start`) are changed by MAPX.8.
8. The Details panel's write controls are changed by MAPX.9 (`ui/app.ts`, `ui/map.ts`, `ui/style.css`).
9. `README.md`, `DESIGN.md`, `.claude-plugin/plugin.json` are changed by MAPX.10.

### Contracts

Contract numbers C1 to C10 belong to the 0.9.0 plan and are not restated here. C11 moves here with the same id so references stay valid; C12 and C13 are new.

1. C11: the solar-system map's data, written by MAPX.2 and MAPX.3, read only by the map (`activitySource` in item 2 has one value for the whole reply, see MAPX.2):
   1. `GET /api/galaxy` adds per memory `source`, `sourceInferred`, `kind`, `scope`, `importance`, `pinned`, `state` and `validUntil`;
   2. per project it adds `liveCount`, `kinds: [{ kind, count }]`, `unknown` (live rows of kind unknown), `global` (live rows with scope global), `lastActive` (the newest of `timestamp` and `last_recalled` over the project's live rows, the base of the ice cap), `activity30`, `activitySource`, `recallsTotal`, `medianAgeDays`, `firstSaved`, `tags: [{ tag, count }]` (at most 40) and `tagsTotal`, all over live rows, and `projectKind` and `remoteHost` from C12; the existing `count` and `recalls` keep their meaning (all rows) so older pages still work;
   3. at the top level it adds `writers: [{ source, count, inferred }]`, `globalLive` (live rows with scope 'global' or owner 'global', for the sun belt) and `links: [{ a, b, pairs: [{ older, newer, score }] }]`;
   4. the state rule, written once as an exported helper `memoryState` in `ui/server.ts`: a row is live when `superseded_by` is NULL and `valid_until` is NULL or still in the future. Otherwise take the newest 'retire' or 'expire' row among the audit rows (the table keeps only the last 3 per memory, and a later 'update' row is skipped, not read as the state): 'expire' gives 'expired', 'retire' gives 'retired'; with neither, a row with `superseded_by` set is 'retired' and any other is 'lapsed' (its own expiry date passed). The engine's retire sets `valid_until` to now and `superseded_by` to the replacement or NULL (`engine/src/core/beam/store.ts`, `invalidateRows`) and writes an audit row only when a `validator` was passed, so a retire with no validator and no replacement reads 'lapsed' (a known limit; the dashboard's retire passes `validator: 'dashboard'`). Restore clears both columns (`restoreWorking`), so a restored row is live again whatever its audit rows say. The 0.9.0 plan's CRUDX.3 reuses this helper (see the dependency table);
   5. `<root>/activity-daily.json`, mode 0600, `{ version, days: { <owner>: { <day>: { writes, recalls } } } }`, 90 days, counts only, written only by `appendActivity` (MAPX.3).
2. C12: `<root>/projects.json`, mode 0600, written only by `bin/projects.ts` (MAPX.8) and read by MAPX.2: `{ version, projects: { <owner>: { name, kind: 'repo' | 'folder', remoteHost: <host> | null, firstSeen, lastSeen } } }`. `remoteHost` is the remote's host only (for example `github.com`), never the full URL, a user name, a port or a token. A repo with no remote has `remoteHost: null`; a remote with no network host (a local path or a `file://` URL) records `'local'` (plan default, MAPX.8).
3. C13: the scene interface between `ui/solar.ts` (MAPX.5) and the page around it (MAPX.11, MAPX.6), fixed here so both can be built at the same time. `ui/solar.ts` exports `createSolarScene(options)` where `options` holds `canvas`, `three` (the module from `ui/vendor/map-lib.js`), optional `createRenderer` and `clock` (so specs can stub them), and the callbacks `onHover(tip | null, x, y)` (`tip` is a list of lines, the first the title), `onPick(target)` and `onLevel(level)`. It returns `{ setData(galaxy), setView(view), flyTo(target), showView(name), zoom(factor), event(mapEvent), dispose() }`:
   1. `galaxy` is the C11 reply of `GET /api/galaxy`; `view` is `{ arrange, colour, hidden: { <owner>: true }, query, rotate, sample, legend }`; `name` is 'top', 'below', 'side' or 'reset'; `mapEvent` is what `toMapEvent` returns (`ui/map-live.ts:47`);
   2. `target` and `level` share one shape: `{ level: 'galaxy' } | { level: 'planet', owner } | { level: 'moon', owner, kind } | { level: 'memory', owner, kind, id }`;
   3. the page never reaches into the scene's three.js objects, and the scene never touches DOM outside its canvas; Find's matching (`searchResults`) lives in `ui/solar-layout.ts` (MAPX.4) and is shared by both;
   4. a test fake of this interface, `tests/bun/solar-scene-fake.ts` (MAPX.11), records every call, so the page shell is tested without WebGL.


### Out of scope

1. No new write route and no change to any write path. The map reads. The one exception is the two small derived files (C11.5 and C12), which hold counts and project facts, never memory text.
2. No change to the engine (`engine/`). Nothing here needs it.
3. No redesign of the mockup. A change to the look needs Rohit's word and a re-export of the canvas (MAPX.0, item 3).
4. No sample or demo data in the real view (the Simulate buttons keep their demo events, as in 0.6.0).
5. No removal of the old Galaxy drawing code. Timeline's morph still starts from the topic layout in `ui/map-layout.ts` and `ui/map-state.ts`, so that code stays; removing what becomes unreachable is a later cleanup (open question O4).
6. No Edit, Pin or Retire in the first release (MAPX.9 adds them after the 0.9.0 write routes exist).
7. No binary pairs (mapping row 17, near-duplicates in one project under a Review lens): deferred to a later task by Rohit's decision of 2026-10-25.

### Risks

1. The port drifts from the mockup. Guards: `tests/bun/solar-scene.spec.ts` drives the same behaviours the mockup was approved on, and Rohit compares the build side by side with the canvas (manual QA). Phases: MAPX.5, MAPX.6.
2. The frame rate with up to 2000 memories. Guard: MAPX.1's measurement before the scene is built, with the part to change named if it is under 50 fps (`Points` per planet, labels or bloom).
3. Inline styles refused by the page's policy. Guard: MAPX.11 moves all styling to `ui/style.css`, and a spec scans the built page for `style=` attributes.
4. The links computation is slow. Black holes need cosine scores between memories of different projects; with 2000 vectors that is about 2 million comparisons. It must not run on the server's event loop (it would stall `/api/health` and the activity stream, which is why `ui/semantic-worker.ts` exists). Guard: MAPX.2 has the existing worker emit the cross-project pairs in the same pass that already finds each memory's neighbours, and caches them in `meaning.json` under a bumped `MEANING_VERSION`; the cold time is measured and reported.
5. The daily tally is written by several processes at once (the hooks' detached script, the MCP proxy and the dashboard server), and a read-modify-write file can lose a count or be corrupted. Guard: MAPX.3 takes a lock like `rotate()` does, writes to a temp file and renames, skips the tally rather than wait, and never lets the log line fail.
6. `hooks/register.ts` is on every save path. Guard: MAPX.8 keeps its change to three small hunks (an import, a spawn helper beside `record()`, and one call in the `session.start` handler), leaves `owner()` untouched, puts the logic in `hooks/projects.ts` and `bin/projects.ts`, runs the write detached with the same spawn pattern the activity log uses, and specs that a failing or slow registry write changes no save.
7. The URL hash is shared with the sign-in token. `ui/app.ts:606-607` reads `#token=...` and clears the whole hash on load. Guard: MAPX.11 reads `#level=` before `takeToken()` clears the fragment (or clears it only when `token=` is present), writes the level with `history.replaceState`, uses a different key, and specs that a `#token=` link still signs in, a reload keeps the level, and a bad level falls back to Galaxy.
8. Retired rows read as live on the old views. `/api/galaxy` and the Memories tab ignore `valid_until` today, and the 0.9.0 plan fixes the Memories tab (CRUDX.3, CRUD.2). This plan fixes the new Galaxy view only and leaves Timeline and Meaning as they are (open question O3).
9. Writer names do not match between rows and events. A row's `source` is `claude-code`, `dashboard`, `import:doc`, `mcp:<client>` and so on; an activity line's `client` is `claude-code`, `dashboard`, `mnemosyne-knowledge`, `mnemosyne-tags` or an outside client's name. Guard: MAPX.5 maps a client to a nodule by exact `source` match, then by `mcp:<client>`, and an event whose client has no nodule starts at the sun's centre (plan default, open question O5). Events whose owner is missing or 'global' (an outside agent with no project, or the dashboard's multi-project search) have no planet: they draw as a pulse on the sun and the nodule, not a comet to a planet.
10. Find writes to the activity log and is single-flight. `POST /api/search` appends a 'recall' line (origin 'ui', client 'dashboard', owner the single owner searched, else 'global'; `ui/server.ts:1623-1630`), answers 429 while another search runs (`:1616`) and 400 for `mode: 'hybrid'` without embeddings (`:1605`). Guard: MAPX.11 searches memories on Enter or after a pause, never per keystroke, sends `mode: 'keyword'` when embeddings are off, and treats 429 quietly; MAPX.3 does not count those lines and MAPX.5 draws nothing for them, so searching does not light the map.

---

## Dependencies on the 0.9.0 plan

Every link between this plan and `docs/plans/mnemosyne-v3.md`. Soft means this plan ships without waiting, using the fallback. Hard means the work cannot be done until the 0.9.0 task lands.

| # | Link | Kind | Fallback or rule | Carried by |
|---|---|---|---|---|
| D1 | Memory `state` (CRUDX.3) | soft | the map's data route computes it from the store's columns (C11.4) | MAPX.2 |
| D2 | Project kind (SESSION.5, `projects.json`) | soft | this plan owns the registry (Decision 3); until a project is recorded it is a planet marked "kind unknown" | MAPX.8, MAPX.2 |
| D3 | The `pinned` flag (IMPORT.3) | soft | read `metadata.pinned`; missing means not pinned; the halo appears once pins exist | MAPX.2, MAPX.5 |
| D4 | Shared UI files with CRUD (`ui/index.html`, `ui/style.css`; `ui/app.ts` only at `takeToken()` and the `createMap` call) | merge order | whichever branch lands second rebases onto `main`; no task waits; MAPX.7 touches none of `ui/app.ts` | MAPX.11, MAPX.6 |
| D5 | Edit, Pin and Retire in the Details panel (CRUDX.1, CRUDX.2 routes; CRUD.1, CRUD.2 forms and confirm) | hard | the Details panel ships read-only; MAPX.9 adds the controls after those tasks are merged | MAPX.9 |
| D6 | `hooks/register.ts` (IMPORT.3, SESSION.1, SESSION.2, SESSION.4 edit it) | merge order | MAPX.8 lands first and changes three small hunks of `hooks/register.ts` (an import, a spawn helper beside `record()`, one call in the `session.start` handler); the 0.9.0 lanes branch from `main` after it | MAPX.8 |
| D7 | `ui/server.ts` (CRUDX edits `post()`, `MAX_BODY_BYTES`, the route table; MAPX.2 edits `galaxyLevel` and `getMemory`) | merge order | different regions; second to land rebases | MAPX.2 |
| D8 | `ActivityAction` names (CRUDX.0 adds restore, import, expire) | none | the tally counts only recall, remember and update; `toMapEvent` ignores other actions | MAPX.3, MAPX.5 |
| D9 | `README.md`, `DESIGN.md`, `.claude-plugin/plugin.json` (REL9.1) | merge order and release | MAPX.10 documents the map and sets the release version; REL9.1 later drops its map items and rebases | MAPX.10 |
| D10 | Review history in `GET /api/review` (CRUDX.5) | none | the Details panel reads the last 3 `memory_validations` rows itself through `GET /api/memories/<id>` (MAPX.2) | MAPX.2, MAPX.7 |

### What the 0.9.0 plan must drop or point to

This is the checklist for the step that removes MAPX from `docs/plans/mnemosyne-v3.md`.

1. Delete the whole "Phase MAPX" section, and replace it with one line: "The solar-system map is built first, in `docs/plans/mapx-solar-map.md` (2026-10-25)".
2. Delete SESSION.5 (the project registry); it is MAPX.8 here. The SESSION phase then has 3 tasks (SESSION.1, SESSION.2, SESSION.4), and its task-order line, its "May touch" list and the wave table lose SESSION.5.
3. Contracts: remove C11 from the 0.9.0 plan and point to this plan's C11 and C12. Remove C11 from REL9.1's DESIGN item.
4. Task graph: delete the MAPX row of wave 6; wave 6 becomes HARDEN part B only. REL9's "Needs first" becomes HARDEN.3 only. The task counts become 12 phases and 47 tasks (56 minus 8 MAPX tasks minus SESSION.5); the Summary's "13 phases" and "56 tasks" and "the solar-system map (MAPX, added 2026-10-25)" change with them.
5. Lanes: remove the MAPX.1 entry from wave 4's lane C cell and the MAPX.2 to MAPX.7 entry from wave 6's lane A cell and the "reviews MAPX" in lane B's wave 6 cell. Lane C's wave 4 cell becomes idle.
6. File map item 13 and the Review rule's list (MAPX is "standard") lose MAPX. Search the whole file for any other "MAPX" or "solar" mention (the Summary, the Risks and the Notes) and clear it.
7. LATER.4 ("Moved into MAPX") keeps its text but points to this plan.
8. "0.9.0 review" item 5 ends "The map shows non-live rows in its outer belt (MAPX)"; point it to this plan.
9. CRUDX.3: reuse the exported `memoryState` helper from `ui/server.ts` (C11.4) for `state` instead of writing a second rule, and use the same four values. If the map plan has not merged when CRUDX.3 is built, CRUDX.3 writes the rule and this plan's MAPX.2 imports it; the coordinator decides at that time, and the rule text in C11.4 is the shared definition.
10. CRUD.2 is unchanged. MAPX.9 here reuses its confirm and Restore.
11. REL9.1: remove the "solar-system map (the mapping table and Arrange by)" README item and the map items from the DESIGN.md item, and rebase onto MAPX.10's README and DESIGN.md changes. The map ships as 0.8.3 (decided), so REL9 keeps the number 0.9.0.
12. "Decisions" and "Notes for the reviewer": note that the map moved here, and drop item 13's mention of `ui/map-*.ts` and `bin/activity.ts`.
13. The 0.9.0 plan's baseline and "Status 2026-10-25" lines gain: "the map plan ships first; `main` moves on".

---

## Task graph (build the Orca DAG from this)

"Needs first" means every listed task is done, including its review and its merge into `main`.

| Wave | Task | Needs first | Notes |
|---|---|---|---|
| 0 | MAPX.0 | nothing | done 2026-10-25 |
| 1 | MAPX.4 | nothing | the rules, against the C11 fixture; starts the serial path |
| 1 | MAPX.1 | nothing | vendor exports and frame-rate check |
| 1 | MAPX.2 | nothing | the data route; builds against fixtures of C11.5 and C12 |
| 1 | MAPX.3 | nothing, runs after MAPX.1 on the same lane | the daily tally |
| 1 | MAPX.8 | nothing, runs after MAPX.2 on the same lane | the project registry (moved SESSION.5) |
| 2 | MAPX.5 | MAPX.1, MAPX.4 | the scene, behind the C13 interface |
| 2 | MAPX.11 | MAPX.4 (for `searchResults`) | the page shell, against a fake scene (C13) |
| 2 to 4 | MAPX.10 | draft: nothing; final pass: MAPX.7 | docs drafted early, finished and versioned last |
| 3 | MAPX.6 | MAPX.5, MAPX.11, MAPX.2, MAPX.3, MAPX.8 | wiring the shell to the scene and the real data |
| 3 | MAPX.7 | MAPX.6 | the Details panel, read-only |
| later | MAPX.9 | MAPX.7, and from the 0.9.0 plan: CRUDX.1, CRUDX.2, CRUD.1, CRUD.2 | Edit, Pin and Retire |

The serial path is MAPX.4, MAPX.5, MAPX.6, MAPX.7 (four build steps, all on lane A), then the short final pass of MAPX.10. All three lanes build in waves 1 and 2. MAPX.6 needs MAPX.3 and MAPX.8 merged so the page can be tried on real activity numbers and real project kinds.

Task-level notes: MAPX.4 writes `tests/bun/fixtures/galaxy-c11.json` from C11 and builds against it, so it does not wait for MAPX.2; MAPX.2's spec checks the real reply has the fixture's shape. MAPX.2 reads the tally and registry formats from C11.5 and C12 and tests with fixture files, so it does not wait for MAPX.3 or MAPX.8; the real files meet the route in MAPX.6's manual check. MAPX.5 and MAPX.11 meet only through C13. In-phase order is the order of the table.

Task counts: 12 tasks (MAPX.0 to MAPX.11), 1 done, 1 later (MAPX.9).

---

## Lanes, workers and models

The same three lanes as the 0.9.0 plan (Rohit's decision, 2026-10-24); each is an Orca worktree under `/Users/rohits/orca/workspaces/claude-mnemosyne/`. Each task group gets its own short branch off `main`, merges straight into `main` after its review, and the other lanes rebase at the next wave boundary. Nothing is pushed.

| Lane | Worktree | Worker |
|---|---|---|
| A | `v3-lane-a` | Claude Sonnet, high effort |
| B | `v3-lane-b` | Claude Sonnet, medium effort (high for MAPX.8 and MAPX.9) |
| C | `v3-lane-c` | OMP; Rohit sets the model in OMP himself |

Who builds and who reviews (a proposal; the coordinator may swap lanes A and B, never put lane C on MAPX.8 or MAPX.9):

| Wave | Lane A (Sonnet high) | Lane B (Sonnet) | Lane C (OMP) |
|---|---|---|---|
| 1 | builds MAPX.4 | builds MAPX.2, then MAPX.8 (high) | builds MAPX.1, then MAPX.3; reviews MAPX.2 |
| 2 | builds MAPX.5; reviews MAPX.8 | reviews MAPX.1, MAPX.3 and MAPX.4; builds MAPX.11 | drafts MAPX.10; reviews MAPX.11 |
| 3 | builds MAPX.6, then MAPX.7 | reviews MAPX.5, then MAPX.6 and MAPX.7 | idle |
| 4 | reviews MAPX.10 | idle | finishes MAPX.10 |
| later | reviews MAPX.9 | builds MAPX.9 (high) | idle |

Rules:

1. A task group is reviewed by a lane that did not build any task in it. The builder never approves its own work. Lane C may build MAPX.1, MAPX.3 and MAPX.10 (standard-risk, reversible work), and never gives the approving review of MAPX.8 or MAPX.9.
2. One worker builds the serial path MAPX.4, MAPX.5, MAPX.6 and MAPX.7 (lane A), because the rules, scene and wiring share one API; lane B builds the page shell (MAPX.11) beside it against C13, and reviews lane A's steps.
3. Review groups: R1 = MAPX.1 (lane B); R2 = MAPX.2 (lane C); R3 = MAPX.3 (lane B); R3b = MAPX.8 (lane A, data-loss depth for the `hooks/register.ts` hunks); R4 = MAPX.4 (lane B); R5 = MAPX.5 (lane B); R5b = MAPX.11 (lane C); R6 = MAPX.6 and MAPX.7 (lane B, plus Rohit's manual QA); R7 = MAPX.10 (lane A); R8 = MAPX.9 (lane A).
4. Workers do not choose models, efforts or agents and do not dispatch other workers; the coordinator alone does that.
5. MAPX.1's frame-rate step needs a real browser with a GPU. If the worker has no browser tool, the step ends with a manual handoff: Rohit opens the throwaway page and reads the on-screen frame counter (the worker adds one).

---

## Phase block: MAPX (applies to every task below)

Paste this ahead of each task block.

1. Delivers: C11 and C12 and the solar-system Galaxy view, ported from the mockup.
2. Needs first: nothing from the 0.9.0 plan, except MAPX.9.
3. Read first: `docs/plans/mapx-design/README.md`, `MapSolarSpec.dc.html` and `solar-scene.js` (the mockup, method by method); `DESIGN.md` §3.5, §3.7 and §3.8 (the map today); `ui/map.ts` (how the page loads `map-lib.js`, line 239 and 2086, and builds the Map tab, `createMap` line 371); `ui/map-state.ts` (the state pattern); `ui/stream.ts` and `ui/map-live.ts` (live events; `toMapEvent` at line 47); `ui/server.ts:72-73` (the Content Security Policy), `galaxyLevel` (line 1124) and the `/api/galaxy` route (line 1857); `bin/activity.ts:115` (`appendActivity`); `hooks/register.ts:344-351` (`owner()`) and `:654-700` (`record()`, the spawn pattern).
4. May touch (the union of all tasks; each task block narrows it): `scripts/vendor-map.ts`, `ui/vendor/map-lib.js`, `ui/vendor/map-lib.d.ts`, `ui/vendor/map-lib.inputs.json`, `ui/vendor/scan-allow.json`, `ui/solar-layout.ts` and `ui/solar.ts` (new), `ui/map.ts`, `ui/map-state.ts`, `ui/map-live.ts`, `ui/index.html`, `ui/style.css`, `ui/app.ts` (`takeToken()` and the `createMap` call only), `ui/tsconfig.json` (to list the new files), `ui/server.ts` (`galaxyLevel`, `getMemory` and their helpers only), `ui/semantic-worker.ts` (MAPX.2), `bin/activity.ts`, `bin/projects.ts` and `hooks/projects.ts` (new), `hooks/register.ts` (MAPX.8's three small hunks only), `tests/bun/map-state.spec.ts`, `tests/bun/map-live.spec.ts`, `tests/bun/galaxy-api.spec.ts`, `tests/bun/semantic.spec.ts`, `tests/bun/activity.spec.ts`, `tests/bun/vendor-scan.spec.ts`, `tests/bun/solar-*.spec.ts`, `tests/bun/solar-fakes.ts`, `tests/bun/solar-scene-fake.ts` and `tests/bun/fixtures/galaxy-c11.json` (new), `tests/projects.test.ts` (new), `tests/register.test.ts` (MAPX.8 only), `README.md`, `DESIGN.md`, `.claude-plugin/plugin.json` (MAPX.10 only).
5. Must not touch: `engine/`, `ui/review.ts`, `ui/health.ts`, `tests/bun/helpers.ts`, the write routes in `ui/server.ts`, and `docs/plans/mapx-design/` (the reference stays as approved), and `docs/plans/mnemosyne-v3.md` (the cleanup step owns it).
6. Review level: standard. The map reads; the only things it writes are the two derived files (tally and registry). MAPX.8 is reviewed with one extra check (a registry failure cannot block or change a save). MAPX.9 is reviewed at data-loss depth, because it triggers retire and pin writes.
7. Hazards: the risks list above (items 1 to 10), each with its guard.
8. Manual QA steps (Rohit, once, in the dashboard, after MAPX.7 has merged and before MAPX.10; the canvas is open beside it, "Map v3" Play):
   1. Galaxy: the sun has a `claude-code` nodule; the planets match the projects; each is a repo planet on github.com (a project says "kind unknown" until a Claude session has started in it since MAPX.8 landed; start one in each of the five first); the busiest is closest; Arrange by Size, Age and Recalls each moves the planets, and each keeps its angle. Compare the picture with the canvas: sun, nodule glow, planet styles, rings, belts and black holes.
   2. Planet: matrixkoder's surface shows its tags as land, `workflow-rules` the same colour as on the other planets; its kind moons orbit; its black holes name partner projects.
   3. Memory: the Details panel shows text, kind, tags, writer, provenance, dates, state, pin, history and similar memories.
   4. Live: a recall in a Claude session sends a gold comet from the `claude-code` nodule; a save by Claude sends a blue comet from the `claude-code` nodule to the planet; Forget in the dashboard draws a red laser and the memory fades (it starts at the sun's centre, since no memory has the writer `dashboard` yet).
   5. Find: type a project, a tag and a word from a memory; the list shows planets, tags and memories; Enter flies there; Escape clears. A memory search does not draw a comet and does not raise the project's activity.
   6. Bodies strip: hide a planet with its chip; its label, orbit line and black holes disappear and the camera does not move; Show all brings it back.
   7. Reload on a Planet level and on a Memory level: the URL hash returns you there; open the sign-in link with `#token=` and see the dashboard still signs in.
   8. Reduced motion (system setting): nothing orbits and flights switch instantly; Tab walks sun, planets, moons, memories.
   9. Timeline and Meaning still work and Galaxy to Timeline and back leaves one WebGL context.
9. Suggested commit message for the phase: `feat(map): the galaxy becomes a solar system`

---

## Wave 0: the design

#### MAPX.0: The design, approved and exported (done, 2026-10-25)

1. Done: the mockup is the "v3: solar-system map" row of the Mnemosyne Dashboard canvas, https://claude.ai/artifact/6Qn6icDrmQn6BJKjtmpiy2 (version 31; boards `MapSolar.dc.html`, interactive, and `MapSolarSpec.dc.html`, the spec sheet). Rohit approved it as the target on 2026-10-25 ("I'm happy if I get this exact design").
2. Exported to `docs/plans/mapx-design/`: both boards verbatim, `solar-scene.js` (the script) and `README.md` (the port map). The mockup's own Node smoke test (the one `README.md` says drove every hover, click and flight) is not in the export; MAPX.5 writes its spec from the behaviour list instead.
3. If the canvas changes later, the coordinator re-exports it here before the build starts, and notes the version.

---

## Wave 1: the rules, vendor exports, the data route, the tally and the registry

#### MAPX.1: Vendor exports and a frame-rate check (lane C)

1. Goal: the dashboard's bundle can run the mockup's scene, and it runs fast enough with a large store.
2. Acceptance:
   1. `scripts/vendor-map.ts` adds to `map-lib.js`'s export list (`ENTRY`, lines 37-43) the three.js names `solar-scene.js` uses, found by searching it for `T.<Name>`: `Scene`, `PerspectiveCamera`, `WebGLRenderer`, `Group`, `Mesh`, `Points`, `Line`, `LineLoop`, `Sprite`, `SphereGeometry`, `BoxGeometry`, `CylinderGeometry`, `TorusGeometry`, `RingGeometry`, `BufferGeometry`, `BufferAttribute`, `MeshBasicMaterial`, `MeshStandardMaterial`, `LineBasicMaterial`, `PointsMaterial`, `SpriteMaterial`, `CanvasTexture`, `Color`, `Vector2`, `Vector3`, `Raycaster`, `PointLight`, `AmbientLight`, `AdditiveBlending`, `NormalBlending`, `DoubleSide`, `SRGBColorSpace`, and `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js`; the four post-processing passes are already exported; the package list and licences are unchanged (the 0.9.0 plan's list left out the lights, the buffer classes and `DoubleSide`);
   2. `ui/vendor/map-lib.d.ts` (generated from `scripts/vendor-map.ts`'s declaration text, lines 163-290) declares each new export with the narrow shape the port uses, in the style of the existing declarations; `ui/vendor/map-lib.inputs.json` records the new export list, size and sha256; `bun scripts/vendor-map.ts --check` passes; the bundle's new size and gzip size are written in the report;
   3. the vendored-code scan still passes: `tests/bun/vendor-scan.spec.ts` compares the scan counts in `ui/vendor/scan-allow.json`; if adding exports moves a reviewed count, the worker explains the new count in `scan-allow.json` (what hit, why inert) and says so in the report, and changes nothing else in the allow list;
   4. a throwaway page (kept outside the repo, for example in the worker's scratch folder, served by `bun scripts/dev-ui.ts`) builds `solar-scene.js`'s scene on the vendored bundle with 5 planets, 6 craft and 2000 memories (rings and swarms), and the frame rate on Rohit's Mac (arm64) is written in the task's report; if it is under 50 fps, the report says which part (`Points` per planet, labels or bloom) to change;
   5. the throwaway page is never merged.
3. Refs: `scripts/vendor-map.ts:37-43` (`ENTRY`), `:59-` (the patches), `:110-` (`SCAN_RULES`); `ui/vendor/scan-allow.json`; `tests/bun/vendor-scan.spec.ts`; `docs/plans/mapx-design/solar-scene.js`.
4. Gate: `bun scripts/vendor-map.ts --check && bun run test:bun` (timeout 900 s, must exit 0).
5. Scope: `scripts/vendor-map.ts`, `ui/vendor/*` (the files above), `tests/bun/vendor-scan.spec.ts` only if a reviewed count needs a new case. Do not touch `ui/` source files; if MAPX.5 later needs another class, the coordinator sends a one-line change back here.

#### MAPX.2: GET /api/galaxy and GET /api/memories/<id> carry what the solar system needs (C11) (lane B)

1. Goal: the read-only data for the new view and its Details panel.
2. Acceptance:
   1. each project gains the fields of C11.2: `liveCount`, `kinds`, `unknown`, `global`, `lastActive`, `activity30`, `activitySource`, `recallsTotal`, `medianAgeDays`, `firstSaved`, `tags` (at most 40, by count then name) and `tagsTotal`, plus `projectKind` ('repo', 'folder' or 'unknown') and `remoteHost` read from `<root>/projects.json` (C12); a missing, empty or corrupt `projects.json` gives `projectKind: 'unknown'` and `remoteHost: null` for every project; all of these are computed in SQL or over all live rows, not over the capped 2000-memory list; the owner 'global' stays in `projects` (older pages use it) and is marked by its owner id only; the reply also gains `globalLive` (C11.3);
   2. each memory gains `source`, `sourceInferred` (true when `metadata.source_backfill` is `'inferred'`; `'author'` and a missing value are false), `kind` (`memory_type`), `scope`, `importance`, `pinned` (`metadata.pinned === true`; a missing flag is false), `state` and `validUntil`, with `state` from the exported helper `memoryState` (C11.4), whose audit rows are read for all non-live rows in one query, not one per row;
   3. the reply gains `writers: [{ source, count, inferred }]` (live rows per `source`, and how many of them are inferred); the existing `knowledge` list is unchanged and is what satellites use;
   4. `activity30` sums the last 30 days from `<root>/activity-daily.json` (C11.5). The choice of source is made once for the whole reply so orbits stay comparable: `activitySource` is 'tally' for every project when the oldest day in the file is 30 or more days ago, else 'lifetime' for every project, and `activity30` is then `liveCount + recallsTotal`. A missing or corrupt tally file gives 'lifetime'. The two measures differ in kind and the panel says which one is shown: the tally counts a recall under the caller's project (the line's owner), while `recallsTotal` counts recalls under the project that owns the memory. The specs use fixture tally files, so this task does not wait for MAPX.3;
   5. the reply gains `links: [{ a, b, pairs: [{ older, newer, score }] }]` for live memories of two different owners with cosine 0.80 or more; a pair of projects is listed only with at least 2 pairs; at most 50 pairs per link, best first; `a` is the older project (by `firstSaved`), `older` and `newer` are memory ids (the older and newer `timestamp`). The pairs are not computed on the server's event loop: `ui/semantic-worker.ts` gets each input's owner (`MeaningInput` gains `owner`) and, in the pass that already finds each memory's neighbours (`neighboursOf`), also returns every cross-owner pair at or above 0.80 (at most 200 best per owner pair); the server drops pairs that are not live, applies the two limits above and caches the result in `meaning.json` under a bumped `MEANING_VERSION` (`ui/server.ts:744`; an older cache is then a miss). `links` is absent when there are no vectors, and also when there are fewer than `MIN_MEANING_VECTORS` (10), because the worker does not run below that; the cold time on 2000 vectors is measured and written in the report (risk 4);
   6. `GET /api/memories/<id>` gains, additively, `trust_tier`, `valid_until`, `superseded_by`, `state` and `history: [{ action, validator, at }]` (the newest 3 `memory_validations` rows, newest first, never any text; empty when there are none or the table is missing), and its existing fields do not change;
   7. read-only, within the existing 2000-memory cap; `memories` still lists newest first; the existing fields and the existing `count` and `recalls` per project keep their meaning, so older pages ignore the additions; `tests/bun/galaxy-api.spec.ts` covers each field, a store without vectors, a store with fewer than 10 vectors, a store without `metadata.source_backfill`, a store without `memory_validations`, a retired row, an expired row, a lapsed row, a restored row (live again), a retire followed by an update (still 'retired'), a retire with no validator and no replacement ('lapsed'), a pinned row, a corrupt `projects.json`, the `getMemory` additions, and four tally fixtures: one with 30 or more days of history (`activitySource: 'tally'`), one with fewer (`'lifetime'`), no file, and a corrupt file (both `'lifetime'`); `tests/bun/semantic.spec.ts` covers the cross-owner pairs and the cache version bump.
3. Refs: `ui/server.ts:1124` (`galaxyLevel`), `:1161-1183` (the `knowledge` list), `:722-734` (`GalaxyMemory`, `GalaxyProject`), `:690-694` (`GALAXY_LIMIT`, `GALAXY_WHERE`), `:744` and `:767` (`MEANING_VERSION`, `meaningKey`), `:817` (`readVectorIndex`), `:652` (`getMemory`), `:673` (`projectLabel`), `:1857` (the route); `ui/semantic-worker.ts:30` (`MeaningInput`), `:149` (`meaningOf`); `engine/src/core/beam/schema.ts:26-55` (columns), `:275` (`memory_embeddings`), `:318` (`memory_validations`, trimmed to the newest 3 per memory); `engine/src/core/beam/store.ts:660` (`AuditAction`), `invalidateRows`, `restoreWorking`.
4. Gate: `bun run test:bun && bun run typecheck` (timeout 900 s, must exit 0).
5. Scope: `ui/server.ts` (`galaxyLevel`, `getMemory`, `memoryState`, the meaning cache version and helpers only), `ui/semantic-worker.ts`, `tests/bun/galaxy-api.spec.ts`, `tests/bun/semantic.spec.ts`. The write routes are untouched. Its spec also checks the real reply has the shape of `tests/bun/fixtures/galaxy-c11.json` (written by MAPX.4; read here, never edited).

#### MAPX.3: A daily activity tally per project (lane C)

1. Goal: "how often in the last 30 days", which the 1 MB activity log cannot answer.
2. Acceptance:
   1. `appendActivity` (`bin/activity.ts:115`) also adds to `<root>/activity-daily.json` (mode 0600, C11.5): for each line with `ok` true, a 'remember' or 'update' line adds the line's `count` (its memories touched; 1 when the field is missing or not a positive integer) to `writes`, and a 'recall' line adds its `count` to `recalls`; nothing else is counted; a 'recall' line with origin 'ui' (the dashboard's own Search, which logs client 'dashboard') is not counted, because it is a person searching, not Claude using memory; the day is the line's own `t` in UTC (`YYYY-MM-DD`; the current UTC day when `t` is missing); no memory text, no ids;
   2. days older than 90 are dropped on write; the log line is written first and a tally failure never stops it or throws; the tally is derived from the same lines as the log, so a line dropped by the log (too long, not an object) is not counted;
   3. concurrent writers cannot corrupt the file: it is written to a temp file in the same folder and renamed, under a lock like `rotate()`'s (`bin/activity.ts:92`, lock taken with `O_EXCL`, stale lock taken over after `LOCK_STALE_MS`); a writer that cannot take the lock quickly skips the tally for that batch (counts may be slightly low under contention; the file is never corrupt);
   4. a corrupt or unreadable tally file is rebuilt empty, the log line is still written, and the folder and file modes are 0700 and 0600 as for the log;
   5. the hooks reach this through `bun bin/activity.ts <path>` (the script) and the proxy and dashboard server import `appendActivity`; both paths tally; the tally path is derived from the log path's folder (`<root>/activity-daily.json` beside `activity.jsonl`), and a log path that is not `activity.jsonl` still works in tests;
   6. `tests/bun/activity.spec.ts` covers counting, the UTC day, the 90-day drop, a corrupt tally file (rebuilt, the log line still written), two writers at once (valid JSON afterwards), a 'recall' line with origin 'ui' not counted, and that no text or id enters the file; it uses a temp folder only (`tests/bun/no-real-home.spec.ts` must stay green).
3. Refs: `bin/activity.ts:18` (`MAX_BYTES`), `:39` (`normalize`), `:92` (`rotate`), `:115` (`appendActivity`); `hooks/activity-log.ts:10-31` (`ActivityAction`, `ActivityEntry`); `ui/server.ts:1623-1630` (the search's log line).
4. Gate: `bun run test:bun` (timeout 900 s, must exit 0).
5. Scope: `bin/activity.ts`, `tests/bun/activity.spec.ts`. The MAPX.2 route reads the file; this task never reads it back.

#### MAPX.8: A local project registry: repo or plain folder (lane B; moved here from SESSION.5, Rohit, 2026-10-25)

1. Goal: record what kind of project each owner is, so the map can draw repos as planets and plain folders as space stations or starships. Today the plugin asks `$.session.repo()` while working out the owner (`hooks/register.ts:344-351`) and throws the answer away. Decided by Rohit (2026-10-25): no backfill command, and `owner()` stays untouched; a project records itself the next time a Claude session starts in it, and an unrecorded project is a planet marked "kind unknown".
2. Acceptance:
   1. `hooks/projects.ts` (new, imports nothing from `claude-code`, like `hooks/guard.ts`) holds the pure parts: `remoteHostOf(remote)` (the host only, lower-cased, no user, no password, no token, no port; `git@github.com:o/r.git`, `https://user:token@github.com/o/r.git` and `ssh://git@host:22/o/r` all give the host; a remote with no network host gives `'local'`; no remote gives `null`) and the registry file's parse, merge and format;
   2. at `session.start` (`hooks/register.ts:1287`) the plugin takes the result of the existing `owner()` call and `$.session.repo()` and hands `{ owner, name, kind, remoteHost }` to `bun bin/projects.ts write <path>` on stdin, detached, with the activity log's spawn pattern (`record()`, `hooks/register.ts:654-700`: a `$.process.spawn` loop drained in a detached task, the script capping itself at a few seconds), not `writeEmbeddingsMarker`; `kind` is 'repo' when `$.session.repo()` returns a repo and 'folder' when it returns null; `name` is the last segment of the repo root (or the working folder); `remoteHost` is computed in the hook by `remoteHostOf`, so a full remote URL never leaves the hook; the owner 'global' (scope not per-project) is never recorded; at most one write per owner per process;
   3. `bin/projects.ts write <path>` writes `<root>/projects.json` (C12; mode 0600, folder 0700, temp file and rename, `firstSeen` kept, `lastSeen` today's UTC date, a corrupt existing file rebuilt); the path is a required argument and there is no default, so the script can never reach the real Mnemosyne root by itself; it exits 0 whatever happens;
   4. a failure, a missing `bun` or a timeout never blocks, delays or changes a save, a recall or the session start (spec: a registry write that throws and one that hangs leave the session start result and a save unchanged);
   5. the `hooks/register.ts` change is three small hunks: the import of `hooks/projects.ts`, a small spawn helper beside `record()`, and one call in the `session.start` handler; `owner()` and every other caller of it are unchanged (a spec checks the id for the fixture root `/work/My Repo` in `tests/register.test.ts` is the same as before);
   6. tests: `tests/projects.test.ts` (new) and `tests/register.test.ts` cover a repo, a local-only repo, a plain folder, each remote form above, the `global` owner skipped, `firstSeen` kept across writes, a corrupt existing file (rebuilt), and that no remote URL, user name or token is ever written. `tests/` (outside `tests/bun/`) is not scanned by `tests/bun/no-real-home.spec.ts`, so these specs set `HOME` to a temp folder and pass temp paths only, and the reviewer greps the new files for any use of the real home.
3. Refs: `hooks/register.ts:344-351` (`owner()`), `:654-700` (`record()`, the spawn pattern), `:1287` (`session.start`), `.claude-plugin/types/claude-code/index.d.ts:11951` (`SessionRepo`: `root`, `remote`, `internal`); `bin/activity.ts` (the detached-script pattern).
4. Gate: `claude plugin test . && bun run test:bun` (timeout 900 s, must exit 0).
5. Scope: `hooks/projects.ts`, `bin/projects.ts`, three small hunks of `hooks/register.ts`, `tests/projects.test.ts`, `tests/register.test.ts`. On 2026-10-25 all five owners are GitHub repos, so no station or starship appears on real data until a plain folder gets memories; until a Claude session has started in each project after this lands, that project is a planet marked "kind unknown". Do after MAPX.3 on the same lane; lands before the 0.9.0 lanes touch `hooks/register.ts`.

---

## Wave 1 (continued): the rules, first on the serial path

#### MAPX.4: Port the rules into `ui/solar-layout.ts` (lane A)

1. Goal: the mockup's pure functions, typed and tested, with no DOM and no three.js.
2. Acceptance:
   1. port from `solar-scene.js`: `targets` (orbit rings: at most 10; past 10 bodies the least significant under the current arrange share the outer rings, rank i of n going to ring 9 - floor((n-1-i)*10/n), evenly spaced at the speed of the ring's largest body, with one orbit line and one tilt), `orbitSpeed` (0.04 rad/s times the dwarf radius divided by the body radius: big bodies crawl, small ones move faster), `planetR`, `extent`, `metric`, `styleOf` and `sizeClass` (gas 30+, ice 10-29, rocky, dwarf under 3; neighbours in a class differ), the craft rule (plain folder: station at 5+ memories, else starship; an owner with no record is a planet), `describe`, `labelName`, `tagColour`, `dotColour`, `linksOf` and `searchResults`, plus the new rules: the ice cap (the project's `lastActive`, C11.2, is 30 or more days ago), the clouds (more than a quarter of live memories kind unknown), the "no remote" mark, and the cap of 12 land masses and 8 moons;
   2. they read the shape `GET /api/galaxy` returns (MAPX.2) instead of the hard-coded `PROJECTS`, `LINKS` and `WRITERS`; counts come from `liveCount`, not `count`; the same input in any order gives the same output;
   3. seeds and names: every place the mockup hashes the project id (`fnv(p.id)`, `fnv(p.id + 'orbit')`, `'ring'`, `'noise'`, `'untidy'`, the land and tag-light hashes, the style pick and the start angle) hashes the project label (`projectLabel(owner)`, so `matrixkoder`, not `project-matrixkoder-<hash>`) instead; when two projects share a label, both hash `label|owner`; sorting ties break by label, then owner; the label is what the panel, chips and tooltips show;
   4. the owner 'global' is never a planet, craft or chip; its rows (and every live row with scope 'global') feed only the sun belt, whose count is `globalLive`; each scope-global row still counts toward its own project's size;
   5. writer colours: writers are sorted by count (then name) and take colours in order from the colour-blind-safe palette `#56B4E9`, `#CC79A7`, `#E69F00`, `#009E73`, `#0072B2`, `#D55E00` (wrapping after six); the nodule's place on the sun comes from a hash of the writer's name, not a hard-coded latitude and longitude; the event colours (`EVENT_COLOUR`) stay as in the mockup;
   6. `tests/bun/solar-layout.spec.ts` checks the mockup's numbers on its own data (the 11 bodies of `solar-scene.js` give 10 rings with one shared pair under each arrange option; the orbit times of about 11, 10, 5.5, 5 and 2.6 minutes; the styles Saturn, Jupiter, Mars, Mercury and Pluto), that the real owners `project-<name>-<hash>` give the same styles and angles as the mockup's names, two projects with the same label, the owner 'global' skipped, writer colours for the real two writers (`claude-code`, `imported`) equal to the mockup's, plus one project, no global memories, an owner with no `projects.json` record, a local-only repo, and 25 bodies.
3. Gate: `bun run test:bun && bun run typecheck` (timeout 900 s, must exit 0).
4. Scope: `ui/solar-layout.ts`, `ui/tsconfig.json` (list the new file), `tests/bun/solar-layout.spec.ts`, `tests/bun/fixtures/galaxy-c11.json` (new). Needs nothing: this task writes the fixture from C11 (every field of C11.1 to C11.3, for the mockup's 11 bodies) and builds against it, so it starts in wave 1 without waiting for MAPX.2.

---

## Wave 2: the scene and the page shell, side by side

#### MAPX.5: Port the scene into `ui/solar.ts`, on live data and the live stream (lane A)

1. Goal: the mockup's 3D scene as the dashboard's Galaxy view.
2. Acceptance:
   1. port from `solar-scene.js`, keeping behaviour and look: the textures (`planetTexture`, `sunTexture`, glow, dot), the scene (`initScene`, `makePlanet`, `makeCraft`, `memoryRing`, `makeHoles`), the frame loop (orbits slowed to 15% while a tooltip shows, shared rings, the spread swarm, satellites from the `knowledge` list, the black-hole line with one pulse every 30 seconds), picking (`pick`: solid bodies before dots, tags from the surface coordinates), `act`, the camera flights and views, Find's fly-to, the show/hide filter, and the bloom, sun and darkness levels as approved (bloom strength 0.375, radius 0.3, threshold 0.6; clear colour `0x010205`);
   2. it imports three.js from `ui/vendor/map-lib.js` (MAPX.1), never a global; renderer, composer and canvas creation are injected so a spec can stub them; `dispose()` frees its textures, geometries and materials, removes its listeners and calls `renderer.forceContextLoss()`; hosting and switching layouts is MAPX.6;
   3. live events come from the stream the page already holds (`ui/stream.ts`, mapped by `toMapEvent` in `ui/map-live.ts`): a recall is a gold comet between the body and the caller's nodule, a save a blue comet from the writer's nodule, an update a green beam, a forget a red laser with the memory fading; the nodule is found from the event's `client` as in risk 9 (exact `source` match, then `mcp:<client>`, else the sun's centre); an event whose owner is missing or 'global' has no planet and draws as a pulse on the sun and the nodule; a 'recall' event whose client is 'dashboard' (the dashboard's own Find, which logs a recall) draws nothing; the dashboard's two Simulate buttons keep the demo events (`simulate`, `ui/map-live.ts:115`), which never call the server;
   4. the items "beyond the mockup" (Design, items 1 to 5): the pinned halo, fading in the last 7 days, asteroid size from importance and brightness from recalls, the ice cap, the "no remote" and "kind unknown" marks, and a fainter row for an inferred writer; the halo reads `pinned` and shows once pins exist. Binary pairs are not built (deferred);
   5. reduced motion stops orbits, pulses and flights (views switch instantly); auto-rotate is off by default;
   6. `tests/bun/solar-scene.spec.ts` (with stand-ins for the canvas, its 2d context and the document in `tests/bun/solar-fakes.ts`) runs the scene on the vendored three.js with a stub renderer and checks every hover kind, planet, moon and memory clicks, a black hole flying to its partner, Find results and Enter, hiding and showing a body, all four live event kinds, an event from an unknown client, an event with owner 'global', a dashboard 'recall' drawing nothing, satellites from a `knowledge` list, `dispose()` calling `forceContextLoss`, and 35 seconds of simulated clock time in frames (a fake clock, not a real wait) without an error;
   7. `ui/solar.ts` exposes exactly the C13 interface (`createSolarScene` and its methods and callbacks), so MAPX.11's shell plugs in unchanged; a spec checks the returned object's method names against C13.
3. Refs: `docs/plans/mapx-design/solar-scene.js` (every method named above); `ui/map.ts:226-239` (`MapHost`, `LIB_URL`), `:2086` (the library import); `ui/map-live.ts:47` (`toMapEvent`), `:82-115` (`simulate`).
4. Gate: `bun run test:bun && bun run typecheck` (timeout 900 s, must exit 0).
5. Scope: `ui/solar.ts`, `ui/map-live.ts` (event-to-nodule mapping only), `ui/tsconfig.json`, `tests/bun/solar-scene.spec.ts`, `tests/bun/solar-fakes.ts`, `tests/bun/map-live.spec.ts`. The hosting by `createMap` is MAPX.6. Do after MAPX.4 and MAPX.1.

#### MAPX.11: The page shell around the map, against a fake scene (lane B)

1. Goal: the mockup's page (rail, legend, Find, Bodies strip, Details placeholder, Live activity) built the dashboard's way, before the scene exists; it talks to the scene only through C13.
2. Acceptance:
   1. the Map tab's markup in `ui/index.html` (the `view-map` section) and its builders in `ui/map.ts` gain the mockup's page, built with `createElement` and `textContent`, the state in `ui/map-state.ts`'s pattern (read once per frame), no framework; the Layout card (`#map-card-layout`, `ui/index.html:32`, with the Galaxy, Meaning and Timeline buttons) stays visible in every layout, because it is the only way back out of Galaxy; in the Galaxy layout the other rail cards become Arrange by, Colour dots by and Show, and Timeline and Meaning keep today's rail cards unchanged; in the Galaxy layout the Details panel takes the place of `#map-inspector` and `#map-overview` (MAPX.7 fills it), and the 0.6.0 Live strip (`#map-live-strip`) stays; the other layouts keep their inspector and overview;
   2. no inline `style` attributes (the page's policy is `style-src 'self'`, `ui/server.ts:72-73`): every style is a class in `ui/style.css`; dynamic values (tooltip position, a chip's dimmed state) are set through `element.style` or a class; the page keeps its own fonts (no Google Fonts); a spec scans the built `index.html` and the DOM the builders make for `style=` attributes;
   3. the layout matches the mockup: the rail, the map with the path bar, Find at the top centre, the two collapsible legend cards in the top corners, the view buttons (Top, Below, Side, Reset, auto-rotate), the fixed Bodies strip of two rows under the map, and the full-width row of Details and Live activity; the Galaxy layout's existing Find box (`#map-find`) is reused;
   4. Find searches memories through `POST /api/search` on Enter or after a pause of about 400 ms with at least 3 characters, never per keystroke, one request at a time; the request sends `mode: 'keyword'` when the server's embeddings are off (otherwise the Search tab's mode, `ui/app.ts:1605`), so there is no 400; a 429 ("a search is already running") is handled quietly (local results stay, the next Enter retries) and shows no error; the search logs a 'recall' line, which MAPX.3 does not count and MAPX.5 does not draw (risk 10); bodies, moons and tags are matched locally as you type;
   5. the URL hash holds the level (`#level=galaxy`, `planet:<owner>`, `moon:<owner>:<kind>`, `memory:<id>`; the exact spelling is the worker's), under the key `level`; `takeToken()` (`ui/app.ts:605-612`) clears the whole fragment on load (line 607), so it is changed to read `#level=` first, or to clear the fragment only when it holds `token=`; the level is written with `history.replaceState` (no history entries); a reload keeps the level (the Map is already the page's first tab, `ui/app.ts:660`); a bad or stale hash (an owner or id that is not in the data) falls back to Galaxy; a `#token=` link still signs in;
   6. Arrange by, Colour dots by and the Show toggles are remembered per viewer in `localStorage`, as the layout is today (wrapped in try/catch); Tab moves through sun, planets, moons and memories in order, with a visible focus and an `aria-live` announcement of the level;
   7. every call to the scene goes through C13; the shell is driven in specs by `tests/bun/solar-scene-fake.ts`, which records calls (`setView` on each control, `flyTo` on a Find pick or a hash level, `showView` and `zoom` on the view buttons) and fires `onHover`, `onPick` and `onLevel` back;
   8. `tests/bun/map-state.spec.ts` and `tests/bun/solar-page.spec.ts` cover the controls, Find's keys (typing, Enter, Escape), the debounce, a 429 and a keyword-only mode, the strip's show and hide, the Layout card visible in all three layouts, the hash round trip and the `#token=` case, and that the Timeline and Meaning rails are unchanged.
3. Gate: `bun run test:bun && bun run typecheck` (timeout 900 s, must exit 0).
4. Scope: `ui/index.html`, `ui/style.css`, `ui/map.ts` (the Galaxy layout's page builders only), `ui/map-state.ts`, `ui/app.ts` (`takeToken()` only), `ui/tsconfig.json`, `tests/bun/map-state.spec.ts`, `tests/bun/solar-page.spec.ts`, `tests/bun/solar-scene-fake.ts` (new). Needs MAPX.4 (for `searchResults`); built beside MAPX.5. It does not create a renderer or import `ui/solar.ts`. `ui/index.html` and `ui/style.css` are also edited by 0.9.0's CRUD phase (dependency D4): whichever lands second rebases.

---

## Wave 3: wiring the page and the Details panel

#### MAPX.6: Wire the page shell to the scene and the real data (lane A)

1. Goal: the shell (MAPX.11) drives the real scene (MAPX.5) on real data, with one WebGL context at a time.
2. Acceptance:
   1. `createMap` (`ui/app.ts:690`) hosts the solar scene as the Galaxy layout through C13: it creates the scene with the vendored three.js, passes `GET /api/galaxy` to `setData`, forwards the live stream's events to `event`, and swaps the fake for the real scene with no change to the shell's code;
   2. renderer teardown: today `ui/map.ts` creates `ForceGraph3D` once (line 2092) and never frees it. Switching layouts now disposes the active renderer before creating the other: leaving Timeline or Meaning tears the force graph down (the library's own teardown if the bundled version has one, which the worker checks in `ui/vendor/map-lib.d.ts` and the bundle, plus `renderer().forceContextLoss()`); leaving Galaxy calls the solar scene's `dispose()` (MAPX.5); the other one is created when its layout is picked again; at most one WebGL context exists at any time; a spec with counted fakes checks creations equal disposals after Galaxy, Timeline, Galaxy, Meaning, Galaxy;
   3. a store with no memories, a store with no `projects.json`, and no WebGL show the existing empty and no-WebGL messages instead of a blank map;
   4. Find's picks, the hash level, the Bodies strip and the view buttons behave on the real scene as they did on the fake (the shell's specs run again against a stubbed real scene);
   5. `tests/bun/solar-page.spec.ts` gains the teardown count, the three empty cases and the real-scene run.
3. Gate: `bun run test:bun && bun run typecheck` (timeout 900 s, must exit 0). Rohit's manual QA runs once, after MAPX.7 (review group R6), not here.
4. Scope: `ui/map.ts`, `ui/app.ts` (the `createMap` call at line 690 only), `ui/style.css` (only if wiring needs a class), `tests/bun/solar-page.spec.ts`. Do after MAPX.5, MAPX.11, MAPX.2, MAPX.3 and MAPX.8.

#### MAPX.7: The Details panel on real memories, read-only (lane A)

1. Goal: the mockup's Details panel shows real fields.
2. Acceptance:
   1. it shows the store summary in the Galaxy view, a body's facts, top tags and black holes (each a button that flies to the partner), a moon's kind and count, or a memory;
   2. for a memory: the full text, kind, tags (a click lights the land mass), writer (and "inferred" when it was backfilled), source, trust tier and veracity, created, last recalled and recall count, expiry, state, pin, the last 3 audit actions (`history`) and similar memories (a cross-project one points to its black hole), from `GET /api/galaxy` and `GET /api/memories/<id>` (MAPX.2); an older server reply without the new fields still renders, with each missing field shown as a dash;
   3. the panel has no Edit, Pin or Retire button yet (MAPX.9 adds them); the outer-belt tooltip names Restore as "Restore it in the Review tab" until then;
   4. the panel is built in `ui/map.ts` (where `#map-inspector` is filled today by `fillInspector`, `ui/map.ts:709-711`) and keeps the element id `#map-inspector`, so `ui/app.ts`'s reveal observer (`wireInspectorReveal`, line 712) keeps working; all text through `textContent`; `tests/bun/solar-panel.spec.ts` covers the fields, every body kind, and an older reply.
3. Gate: `bun run test:bun && bun run typecheck` (timeout 900 s, must exit 0). Then Rohit's manual QA (Phase block, item 8), side by side with the canvas, once, as part of review group R6.
4. Scope: `ui/map.ts`, `ui/index.html`, `ui/style.css`, `tests/bun/solar-panel.spec.ts`. It does not touch `ui/app.ts`. Do after MAPX.6.

---

## Waves 2 to 4: docs and the release of the read-only map

#### MAPX.10: README, DESIGN and the version 0.8.3 (lane C)

1. Goal: document the map and set the release version, 0.8.3 (Rohit, confirmed 2026-10-25). Two passes on one branch: a draft in wave 2 from the mockup, this plan and the design README; a final pass after MAPX.7 merges, matched to what was built, with the version bump. Only the final pass is reviewed and merged.
2. Acceptance:
   1. README: the Dashboard section's Map bullet (line 228) and "The galaxy" section (line 246 on) describe the solar-system Galaxy view: the mapping table, Arrange by, Find, the Bodies strip, the Details panel, the live events, and that Timeline and Meaning are unchanged; they say the Details panel is read-only until the dashboard writes (0.9.0) land; they name the two new files in the Mnemosyne root (`activity-daily.json`, counts only; `projects.json`, project names and the remote's host only) and say a project is recorded the next time a Claude session starts in it;
   2. `DESIGN.md` gains a v0.8.3 section with contracts C11 and C12, the state rule, the port approach (what carries over from the mockup, seeds from the project label) and the dashboard's policy notes (no inline styles, one WebGL context); it replaces §3.7's galaxy description where it changed (§3.7 starts at line 663);
   3. `.claude-plugin/plugin.json` version is 0.8.3 (it is 0.8.2 today);
   4. nothing in `ui/`, `hooks/`, `engine/` or `bin/` changes.
3. Gate (two commands, both must exit 0):
   1. `claude plugin validate . && claude plugin test .` (timeout 600 s);
   2. `grep -q 'activity-daily.json' README.md && grep -q 'projects.json' DESIGN.md && grep -q 'v0.8.3' DESIGN.md && grep -q '"version": "0.8.3"' .claude-plugin/plugin.json` (timeout 60 s).
4. Scope: `README.md`, `DESIGN.md`, `.claude-plugin/plugin.json`. Review level: light. After the task: Rohit tags and pushes the release with the release skill.

---

## Later: the writes (waits for the 0.9.0 write routes and forms)

#### MAPX.9: Edit, Pin and Retire in the Details panel (lane B, high; later)

1. Goal: the Details panel acts on a memory, using the dashboard writes the 0.9.0 plan builds. Do not start until CRUDX.1, CRUDX.2, CRUD.1 and CRUD.2 are merged into `main`.
2. Acceptance:
   1. a memory's Details panel gains Edit (opens CRUD.1's form), Pin / Unpin (the update route's `pinned`) and Retire (CRUD.2's two-step confirm, naming the memory's first line and id, with the optional 'replaced by'); a non-live memory gains Restore; no new write route, no bulk action, no select-all;
   2. the outer-belt tooltip's Restore becomes the real button;
   3. after a write the Galaxy data is fetched again and the scene rebuilds the affected body, keeping the camera and the level; a 409 or 422 shows the form's own messages; nothing is written without the confirm;
   4. a retire or restore draws nothing on the stream today (`toMapEvent` ignores those actions), so the refresh above is what shows the change;
   5. specs cover each control calling the right route with the right body (stubbed `fetch`), the confirm, the absence of bulk actions, the refresh, and that the controls are absent for a read-only (older) server; the extra manual check is Rohit's: Pin a memory and see its halo; Retire one and see it move to the outer belt; Restore it; a save from the dashboard comes from a `dashboard` nodule once such a row exists.
3. Gate: `bun run test:bun && bun run typecheck` (timeout 900 s, must exit 0).
4. Scope: `ui/app.ts`, `ui/map.ts`, `ui/style.css`, `tests/bun/solar-panel.spec.ts`, a README sentence. Reviewed at data-loss depth by a lane that did not build it.

---

## Verification

### Gate commands

Run from the repository root. All must exit 0.

1. SUITE: run after every merge of a worker's branch into `main` (timeout 1500 s). A task counts as done only when SUITE is green on the merged result and its own task gate passed:

   ```
   claude plugin test . && bun run typecheck && bun run test:bun && claude plugin validate . && bun scripts/engine-diff.ts && bun scripts/vendor-map.ts --check
   ```

2. EMBED (`bun run test:embed`, timeout 900 s) is not part of this plan: nothing here changes how vectors are made or compared by the engine. MAPX.2's links read stored vectors only.
3. The individual gates, for reference (timeouts in seconds):

   | Gate | Command | Timeout |
   |---|---|---|
   | test | `claude plugin test .` | 600 |
   | typecheck | `bun run typecheck` | n/a |
   | validate | `claude plugin validate .` | n/a |
   | bun | `bun run test:bun` | 900 |
   | engine | `bun scripts/engine-diff.ts` | 300 |
   | vendor | `bun scripts/vendor-map.ts --check` | 300 |

`bun run typecheck` runs three projects; `ui/tsconfig.json` lists the UI files by name, so every new `ui/` file (`ui/solar-layout.ts`, `ui/solar.ts`) must be added to its `include` or it is not type-checked.

### Review rule

1. The review of each task group is done by a different worker than the one who built it. The builder never approves its own work.
2. Review depth: standard for MAPX.1 to MAPX.7 and MAPX.10 (light for MAPX.10); MAPX.8 is standard plus one named check, that a registry failure or slowness cannot block or change a save, a recall or the session start; MAPX.9 is data-loss depth (the reviewer checks that no write happens without the confirm, that nothing is bulk, and that retire and pin send the right ids).
3. A reviewer reruns the gate commands itself and does not trust "tests pass" from the builder.
4. A task whose review finds a defect goes back to a worker with the finding written into the task; do not widen the task's file scope to make it pass.
5. Rohit's manual QA runs once, after MAPX.7 is built, as part of review group R6; MAPX.6 alone is not QA'd.
6. For the page tasks the reviewer also opens the canvas and the dashboard side by side and lists any visible difference in look or behaviour; a difference is a finding unless this plan lists it as a change.

---

## Standing constraints for every worker

1. Nothing touches `engine/`. Nothing changes a write route in `ui/server.ts` or any write path. This plan reads the store; its only writes are `<root>/activity-daily.json` (MAPX.3) and `<root>/projects.json` (MAPX.8).
2. Nothing touches the real store `~/.claude/mnemosyne/store` or the real Mnemosyne root. Tests and audits use temp stores and temp roots (`tests/bun/no-real-home.spec.ts` must stay green). The only task that points at the real store is Rohit's manual check; the backfill (MAPX.8) is a dry run by default and Rohit applies it.
3. Never use `git checkout` or `git stash` to undo changes.
4. No silent workarounds. If a tool, path or method named in a task fails or returns unusable output, stop, report the exact error text, and ask before using a substitute. A test that passed through a workaround did not pass.
5. A failed tool gets three real tries before reporting, and each try must change something (fix a wrong name or argument; use its other form such as the CLI or a different argument shape; check how it is registered or run it by hand). Say each failure in one line. After the third, stop and report what was called, the exact text and the three attempts.
6. Workers never orchestrate: they do not dispatch other workers, do not run any orchestration loop, do not call `jev_*` tools, and do not pick or switch models, efforts or agents. The coordinator alone does that, and a worker uses its own default model for any subagent its task allows.
7. Memory text is never logged or written to a file this plan creates; the tally holds counts, the registry holds names and hosts (C11.5, C12).
8. Stay inside the task's scope files. If a task seems to need a file outside it, ask the coordinator instead of editing it. `tests/bun/helpers.ts` is forbidden; new test helpers go in new files.
9. Do not edit `docs/plans/mapx-design/` (the approved reference) or `docs/plans/mnemosyne-v3.md`.
10. Page text is made with `createElement` and `textContent`, never `innerHTML`, and never with inline `style` attributes (the page's policy refuses them).
11. A worker reports done with the task id, what changed, the gate command and its real output, and, for MAPX.1, the measured frame rate and bundle size.

---

## Decisions

Decided (Rohit, 2026-10-25):

1. The build is a port of the approved mockup (canvas version 31), not a redesign. The mockup is the contract for look and behaviour.
2. Fast track: the map plan is independent of the 0.9.0 plan and runs first. Its soft links to 0.9.0 work have fallbacks (the dependency table); its one hard link, the write controls in the Details panel, is MAPX.9 and waits.
3. Today all 5 real projects are GitHub repos, so no station or starship appears on real data until a plain folder gets memories. A local-only repo is a planet with a "no remote" mark.
4. Planning and orchestration is Orca (worktrees and the `orchestration` skill), never MatrixKoder. Three worktree lanes exist (`v3-lane-a`, `v3-lane-b`, `v3-lane-c`). Task groups go on short branches off `main` and merge straight into `main` after a separate review; nothing is pushed.
5. The map ships ahead of the rest of 0.9.0, as release 0.8.3 (O1, confirmed).
6. The mapping, Arrange by and layout decisions of 2026-10-25 above, unchanged.
7. O2, decided: the registry backfill is dropped. There is no `bin/projects.ts backfill`, and `owner()` in `hooks/register.ts` stays untouched. MAPX.8 passes `owner()`'s result and `$.session.repo()` to a detached `bin/projects.ts write`, using the activity log's spawn pattern (`hooks/register.ts:654-700`). Projects record themselves at their next session start; an unrecorded project is a planet marked "kind unknown".
8. Binary pairs (mapping row 17, near-duplicates in one project) are deferred to a later task. They are not in MAPX.5's acceptance (Open questions, L1).

Plan defaults (the coordinator's choices to close gaps; Rohit can overturn any):

1. The map plan owns the project registry (MAPX.8, moved from SESSION.5, without the backfill), instead of using the fallback "every owner is a planet marked kind unknown". Why: the registry's only reader is the map; without it all five real planets would carry a "kind unknown" mark for ever, which does not match the approved mockup (where they are repos on github.com), so "the exact design" could not be seen on real data; and the work is small (one pure module, one script and three small hunks of `hooks/register.ts`). How the conflicts are avoided: the logic lives in new files, `owner()` is not touched, the `register.ts` change is three small hunks (an import, a spawn helper beside `record()`, one call in `session.start`), and MAPX.8 lands before the 0.9.0 lanes (IMPORT.3, SESSION.1, SESSION.2, SESSION.4) touch that file, so they branch from `main` after it. If Rohit would rather not touch `hooks/register.ts` before 0.9.0, the fallback still works: drop MAPX.8, and MAPX.2 and MAPX.6 show every owner as a planet marked "kind unknown".
2. A remote with no network host (a local path or `file://` URL) records the host `'local'`; only "no remote at all" is `null` and shows the "no remote" mark.
3. A client with no nodule (for example `mnemosyne-tags`, or `dashboard` before any dashboard save exists) starts its event at the sun's centre.
4. Planet size and the sun use live memory counts (`liveCount`); the old `count` and `recalls` per project keep their old meaning so Timeline and Meaning are untouched.
5. The memories of a dwarf planet (under 3) sit in its belt, as the spec sheet says.
6. `bin/projects.ts` takes the registry path as a required argument instead of `--root`/`--store` flags, and has no default path, so it cannot reach the real root unless called with it; it needs no store, because there is no backfill.
7. Find's memory search runs on Enter or after a pause, in keyword mode when embeddings are off, and its recall log line is ignored by the tally and the scene (risk 10).

## Open questions for Rohit

Resolved by Rohit on 2026-10-25 and moved to Decisions: O1 (release 0.8.3) and O2 (no backfill). The ids O3 to O5 are kept so references stay valid.

3. O3: should Timeline and Meaning also hide retired, expired and lapsed rows? Recommended: leave them as they are in this plan (they show every row, as in 0.8.2); the Memories tab fix is in 0.9.0 (CRUD.2).
4. O4: after the solar view ships, the old topic-star Galaxy drawing is unreachable, but its layout code still feeds Timeline's morph. Recommended: keep it for now and plan a cleanup once the map is accepted. Alternative: remove the unreachable drawing code in MAPX.6 (a larger diff in a 2196-line file).
5. O5: an event from a client with no nodule starts at the sun's centre (a plan default). Alternative: add a nodule for any client seen in the stream (a nodule with no stored rows would show size 0).
6. L1 (later, not in this plan): binary pairs, the Review lens that draws near-duplicates in one project as a pair (mapping row 17). Deferred by Rohit on 2026-10-25. It needs the near-duplicate pairs inside one project (cosine 0.88 and up, `NEAR_DUPLICATE_SCORE` at `hooks/guard.ts:107`); the same worker pass as MAPX.2's links can emit them, so adding it later is a small task after the map is accepted.

---

## Notes for the reviewer

Departures from, and corrections to, the old MAPX text in `docs/plans/mnemosyne-v3.md`, each with its reason:

1. The old text said live events come from `ui/stream.ts` (`toMapEvent`). `toMapEvent` is in `ui/map-live.ts:47`; `ui/stream.ts` holds the stream (`createStream`). Corrected.
2. The old MAPX.6 built the page "in `ui/app.ts`". The Map tab's markup is static in `ui/index.html` (`view-map`, line 29) and filled by `ui/map.ts`; `ui/app.ts` only calls `createMap` (line 690). The scope now names `ui/index.html`, `ui/map.ts` and `ui/map-state.ts`, with `ui/app.ts` limited to the call and the hash.
3. The old "May touch" list omitted `ui/tsconfig.json`, which lists UI files by name; a new `ui/solar-layout.ts` or `ui/solar.ts` would not be type-checked. Added to MAPX.4, MAPX.5 and MAPX.6.
4. The old MAPX.1 omitted `ui/vendor/scan-allow.json` and `tests/bun/vendor-scan.spec.ts`. New exports can move a reviewed scan count, which fails `bun run test:bun`; both are now in scope, with a rule to explain any moved count. Its export list also omitted the lights, `BufferGeometry`, `BufferAttribute`, `DoubleSide` and `Line`-related names that `solar-scene.js` uses; the list now follows a search of the file.
5. The old MAPX.2 did not give the route `kinds`, `unknown`, `global` or `tagsTotal` per project, which the mockup's planets use (moons, the belts, the clouds rule, the tag count). Added to C11.2. It also would have computed project figures over the capped 2000-memory list; the figures are now over all live rows, and `liveCount` is added so planet size is not inflated by retired rows (the route's WHERE clause does not exclude them today).
6. The old MAPX.2 said `state` "as CRUDX.3". With CRUDX.3 not yet built, C11.4 now defines the rule once, including the case the 0.9.0 text left out: `superseded_by` set with no audit row is 'retired', and a restored row is live again. The engine's retire records an audit row only when a `validator` is given, so a retire with no validator and no replacement reads 'lapsed'; and the state reads the newest retire or expire row among the last 3, not the newest action of any kind (an update after a retire must not hide it).
7. The old MAPX.7 read the tier, expiry, state and last 3 audit actions from `GET /api/memories/<id>`, which returns none of them. MAPX.2 now adds them there, additively.
8. The old tally rule ("adds each line's count") left the unit, the day and concurrency open. MAPX.3 fixes them: the line's `count`, the UTC day of its `t`, a lock and an atomic rename.
9. The old SESSION.5 backfill ("`/mnemosyne-setup` ... matches each owner's name and hash against folders on disk") had no source of folders and the owner id is a one-way hash. Rohit dropped it (O2): projects record themselves at session start. Its tests moved from the non-existent `tests/session.test.ts` (SESSION.1 creates it) to `tests/projects.test.ts` and `tests/register.test.ts`.
10. The old manual QA step 4 ("a save from the dashboard comes from the `dashboard` nodule") and step 3 ("Pin works") cannot pass in the read-only release: the dashboard cannot save yet and has no pin. They changed to what the read-only release can show (a save by Claude; a dashboard forget starting at the sun's centre); the dashboard-save and Pin checks moved to MAPX.9.
11. The old text dropped the spec sheet's rows 3c and 3d (kept here as part of 3b, with their own look), row 20 (clouds, ice cap, now row 20), and its "Rules and caps" (now a list in the Design section). The old "beyond the mockup" list also left out two things the code lacks: URL-hash handling and keyboard Tab order; both are now listed.
12. The old text implied the mockup's smoke test could be reused ("the way the mockup's smoke test did"). It is not in `docs/plans/mapx-design/`; MAPX.5 writes the spec from the behaviour list and adds fake browser parts in `tests/bun/solar-fakes.ts`.
13. The URL hash was unspecified against the existing use of the hash for the sign-in token (`ui/app.ts:97`, `606-607`); MAPX.6 resolves it (a separate key, read before the fragment is cleared, written with `replaceState`).
14. `docs/plans/mapx-design/README.md` says `solar-scene.js` has 33 methods. A count of the `Component` class's method headers finds 40 (39 without `renderVals`). Left as found; not material.
15. The mockup's sun tooltip and nodule tooltip contain sample text ("122 of them backfilled"); the store has 121 `claude-code` rows, of which 111 are `inferred` and 10 `author`. The build uses the real counts.
16. The old MAPX.1 said the frame rate is measured "on Rohit's Mac". A worker lane may have no GPU browser; the plan adds a manual handoff for that case.
17. Not resolved and not invented: the exact spelling of the URL hash values (left to MAPX.6), the exact narrow type shapes in `map-lib.d.ts` (MAPX.1), and whether the black-hole cache needs an on-disk file (decided by MAPX.2's measurement).
18. Review round (2026-10-25, an independent reviewer, verdict "ready after fixes"). Applied: satellites sourced from `/api/galaxy`'s existing `knowledge` list; seeds hashed from the project label (the mockup hashes the project name, the real id is the owner); the Layout card stays visible in every layout; the motion rule (mockup wins); the dashboard's two Simulate buttons stay; writer colours from a palette; tally fixtures in MAPX.2's specs; the state rule reads the newest retire or expire row; the hash is read before `takeToken()` clears it; Find's search behaviour and its logged recall line; links computed by the semantic worker, not the server thread; renderer teardown as an acceptance item; `lastActive` for the ice cap; the owner 'global' is not a planet; MAPX.8's hooks change is three hunks and its tests use temp paths; the manual QA gate runs once after MAPX.7; MAPX.7 no longer touches `ui/app.ts`; the activity-source switch is made once for all projects; 35 seconds is simulated clock time. Rohit's decisions applied: O1 = 0.8.3, O2 = no backfill, binary pairs deferred.
19. Review items checked against the code and adjusted, not applied as stated: (a) the reviewer's "39 methods" is 40 by a header count (39 without `renderVals`); (b) `bin/projects.ts` takes a required path argument instead of `--root`/`--store`, which is stricter and needs no store now that there is no backfill; (c) "a reload opens the Map tab" is already true (`current` starts as 'map', `ui/app.ts:660`), so it is a spec check, not a change.
