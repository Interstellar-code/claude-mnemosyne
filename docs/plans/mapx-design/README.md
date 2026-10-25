# MAPX design: the solar-system map (0.9.0)

This folder is the design for plan phase MAPX (`docs/plans/mnemosyne-v3.md`). Rohit approved it on 2026-10-25 as the target: the dashboard's Galaxy view should look and behave like this mockup. The build ports the mockup's code. It does not redesign the map from the text.

Source: the "v3: solar-system map" row of the Mnemosyne Dashboard canvas, https://claude.ai/artifact/6Qn6icDrmQn6BJKjtmpiy2 (version 31, 2026-10-25). Press Play on "Map v3" there to use it.

## Files

1. `MapSolar.dc.html`: the interactive board, copied verbatim. It is a Design-canvas component (`<x-dc>` markup, `sc-for` and `sc-if`, a `DCLogic` class). It only runs inside the canvas, which supplies `support.js` and the three.js bundle.
2. `MapSolarSpec.dc.html`: the spec sheet (mapping table, Arrange by, drill-down, rules and caps), copied verbatim.
3. `solar-scene.js`: the board's script extracted for reading and porting: the data, helpers and the `Component` class with all 33 methods. It runs on `window.THREE`, three.js r186 plus `OrbitControls`, `EffectComposer`, `RenderPass`, `UnrealBloomPass` and `OutputPass`. That is the same three.js version the repo pins (`three` 0.186.1).

What in the mockup is real and what is sample data:

1. Real (the store on 2026-10-25): the 5 projects, memory counts, kinds, tag names and counts, recalls, median ages, writers, the 6 global memories and the 3 similar-memory links.
2. Sample: the 3 space stations and 3 starships (plain folders), memory text, per-memory sizes, knowledge satellites, outer-belt dust and the live events (simulated).

## Can the mockup replace the map page as it is?

Mostly, yes. The 3D scene is plain JavaScript on the same three.js version, so it moves over nearly line for line. The 3D scene covers geometry, textures, orbits, black holes, comets and beams, picking, camera flights, Find and the show/hide filter. What has to change is everything around it. The work is a port, not a rewrite.

### Reused as is, or nearly (about two thirds of the code)

1. The scene building: `initScene`, `makePlanet`, `makeCraft`, `memoryRing`, `makeHoles`, `circle`, `pointsObject`, `glow`, `label`.
2. The procedural textures: `planetTexture` (land, bands, spots, clouds), `sunTexture`, `glowTexture` and `dotTexture`.
3. The motion: `frame` (orbits by size, at most 10 rings, shared rings, black-hole lines with a 30-second pulse, the spread swarm, satellites), `spreadSwarm`, `satellites` and `recolour`.
4. The interaction: `pick` (raycast, solid bodies before dots, tags read from the surface coordinates), `act`, the flights (`flyTo`, `flyPlanet`, `flyMoon`, `flyMemory`, `flyMemoryDirect`, `flyHome`, `view`, `dolly`) and `findGo`.
5. The rules: `targets` (rings), `orbitSpeed`, `planetR`, `extent`, `styleOf`, `sizeClass`, `describe`, `labelName`, `tagColour`, `dotColour`, `searchResults`, `metric` and `linksOf`.

### What changes in the port

1. **The page runtime.** The dashboard has no canvas runtime, so the `<x-dc>` markup and `renderVals()` become the dashboard's own DOM builders (`createElement` and `textContent`). That covers the rail cards, the legend cards, Find and its results, the Bodies strip, Details and Live activity, built the way `ui/app.ts` builds its tabs today. `setState` becomes the page's state object, read once per frame as `ui/map-state.ts` does now.
2. **The security policy.** The dashboard's Content Security Policy is `style-src 'self'` (`ui/server.ts:73`), so the mockup's inline `style="…"` attributes are refused. All styling moves to classes in `ui/style.css`. Dynamic values, such as the tooltip position or a chip's dimmed state, are set through `element.style` or a class. Google Fonts cannot load, so the page keeps the dashboard's own fonts.
3. **The 3D library.** The mockup uses a global `window.THREE`. The dashboard loads `ui/vendor/map-lib.js`, which today exports only `ForceGraph3D`, `SpriteText` and the four bloom passes. The same bundle already contains three.js r186. `scripts/vendor-map.ts` adds the three.js classes the scene uses, plus `OrbitControls`, to the export list, with no new package. The Galaxy view then runs on plain three.js. Timeline and Meaning stay on `ForceGraph3D`. Switching views disposes one renderer before creating the other, so there is still at most one WebGL context.
4. **The data.** The hard-coded `PROJECTS`, `LINKS` and `WRITERS` become `GET /api/galaxy` (MAPX.2): projects with activity, tags and kind (from `projects.json`, SESSION.5), plus memories, writers and links. Activity comes from the daily tally (MAPX.3). Memory text, importance, recalls, pins, expiry and knowledge items replace the placeholders.
5. **Live events.** The simulated recall, save, update and forget events become the real activity stream (`ui/stream.ts`, `toMapEvent`), keeping the same visuals: recall planet → sun, save sun → body, update a green beam, forget a red laser.
6. **Find.** Memory results come from `POST /api/search` (keyword plus meaning) instead of the tag-based samples. Bodies, moons and tags stay local.
7. **Tests.** The rules functions move into a pure module (`ui/solar-layout.ts`) with specs, and the scene goes into `ui/solar.ts`. The mockup's Node smoke test drove every hover, click, flight, Find and filter against the real three.js with a stubbed renderer. The same approach becomes `tests/bun/solar-scene.spec.ts`, so the port is checked against the mockup's behaviour.
8. **The writes.** Details' Edit, Pin and Retire wire to the CRUD forms and routes (CRUD, CRUDX).

### Where each piece of the mockup goes

| # | Mockup part | Dashboard file |
|---|---|---|
| 1 | rules functions | `ui/solar-layout.ts` (new, pure) |
| 2 | `Component` scene methods | `ui/solar.ts` (new) |
| 3 | rail, legend, Find, strip, Details, Live | `ui/app.ts`, `ui/index.html`, `ui/style.css` |
| 4 | `PROJECTS`, `LINKS`, `WRITERS` | `GET /api/galaxy` in `ui/server.ts` |
| 5 | simulated events | `ui/stream.ts`, `ui/map-live.ts` |
| 6 | the three.js global | `scripts/vendor-map.ts`, `ui/vendor/map-lib.*` |

The phase's tasks in the plan follow this table.
