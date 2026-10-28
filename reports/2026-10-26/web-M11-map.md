# Web check M11: THE MAP (Wheatfield Valley vs StarCraft II maps)

Checker: haiku (web). Read-only. Code reads done with grep, and one read-only node run of `generateMapV4(7, 'wheatfield')`.
Sources: `maps/WHEATFIELD.md`, `maps/layout-wheatfield.mjs`, `env/map.mjs`, `reports/2026-10-26/research-sc2.md` (map lines), HIVE.md, chat #1185-#1194.

## Verdict on the map facts (code, seed 7)

| Claim | Result | Evidence |
|---|---|---|
| 256 x 256, 2 players, point-mirrored | CORRECT | w=256 h=256; cores (18,232) and (237,23) are exact mirrors; ponds (10,238) and (243,14) too |
| 31 Reaches (15 a side + Dam) | CORRECT | `reaches.length` = 31; `DAM_ID` = 31 |
| 6 starting workers per side | CORRECT | `workers` = [6, 6]; the economy table says 4 (see below) |
| Home fields 8 tiles = 14,400 Wheat | CORRECT | home S block 4x2 = 8 tiles; WHEAT_AMOUNT 1800 (env/map.mjs:12) |
| 2 bridges and 3 fords | WRONG (doc is stale) | code: 2 bridges and 2 fords (BRIDGE_X 52, 201; FORD_X 88, 165). WHEATFIELD.md "As built" already says 2 fords; the table and overview still say 3 |
| 2 wells (one a side, the home spring) | CORRECT | `wells` = 2; (14,226) is the home 'U' |
| 8 generator sockets | CORRECT count, PARTLY used (see below) | `sockets` = 8, 4 a side |
| Meadows and generator sockets "removed from the map" (MAP STYLE RULE) | WRONG (conflict) | code still places 8 'G' sockets and 8 'L' vents (meadows) |
| Grid-like, square tiles, straight cliffs (MAP STYLE RULE, overrides the rest) | CONTRADICTED | Reaches are nearest-seed Voronoi cells; the creek is a sine bend (`BEND`); the doc's own "As built" admits Voronoi |
| Mill Dam: 4-tile gap, 6 movable rocks | CORRECT | `DAM_GAP` 4 tiles; `rockSlots` 6; 6 '#' tiles in the layout |
| Lower Farm has "the first creek inlet (fast water)" | UNBUILT | no inlet in the layout; the only fast water beside a Strip is the 3x4 pond (decision C) |
| Old Windmill: "toughest camp, honey, item drop" | PARTLY | one 'X' ruin exists (134,122), but no code reads it (see below) |
| Crumb Creek "2 bridges, 3 fords" | see bridges row | |
| Symmetry | CORRECT by construction | point mirror checked on cores, workers, ponds; the map builder mirrors all features |
| Two Power Strips 219 tiles apart (HIVE correction 8) | PARTLY | 219 is the x gap only. Straight-line gap = hypot(219, 209) = 302.7 tiles; that is the number to use |

## Pathing (read-only BFS, 8-connected, unit cost, seed 7)
- Blocked: creek water, rocks, crystals, rubble. Open tiles: 60,904. Reachable from core 0: 60,904. Unreachable: 0. So every open tile connects, on this seed.
- Core-to-core path: **302 steps** (straight line 302.7). Not converted to seconds: the unit speeds are not checked (UNVERIFIED for time).
- Only one seed checked. Other seeds are UNVERIFIED.

## Resource totals (code, from the layers)
- Standard wheat 'S': 80 tiles total (40 a side) at 1,800 each. Per side: home 8, Lower Farm 16, Creek Bank A 8, Creek Bank B 8. About 72,000 Wheat a side.
- Golden 'R': 96 tiles total (48 a side, two 6x4 blocks each) at 3,600 each. About 172,800 Wheat a side.
- Total per side about 244,800 Wheat. Map total about 489,600. Vents 'L': 8 tiles at 600.
- Water tiles 2,448 (creek + 2 ponds).
- Ramps: 578 tiles in the built list; gates: 48 (floor and ramp).

## Is each map feature used by game code?

| Layer | Read by code? | Where |
|---|---|---|
| cores, workers | YES | env/state.mjs:36,43; sim |
| water (creek, ponds) | YES | env/sim-territory.mjs:64; env/bakery.mjs:65-70; play/app.mjs:254 |
| wells ('U') | YES | env/sim-territory.mjs:79 (springs); bots; app placement |
| wheat 'S', golden 'R' | YES | crystals; env/economy |
| vents 'L' | YES | env/economy.mjs:560,745,898 |
| ramps | YES | env/vision.mjs:32; env/rocks.mjs:54,67 |
| rubble | YES | env/rocks.mjs:60; play/wheatfield-terrain.mjs |
| gates, reaches, reachGrid | YES | env/reach-path.mjs; env/neutrals.mjs (camps per Reach) |
| bridges 'B', fords 'f' (the arrays) | NO | walkability comes through gates, not the arrays; `state.fords` in rocks.mjs is a different thing |
| sockets 'G' | PARTLY | drawn only: play/wheatfield-terrain.mjs:210,389; play/minimap-kitchen.mjs:10. No power or energy code reads them |
| camps 'k' (4 tiles) | NO | env/neutrals.mjs builds one camp per Reach from its own rule, not from these tiles |
| ruin 'X' (Old Windmill) | NO | tests only (tests/wheatfield-map.test.mjs:196) |
| extras.dam (gap, rockSlots, lowered) | NO (tests and the map module only) | env/rocks.mjs pushes and fords by its own rule; it never reads extras.dam |
| riverWhenDammed | NO | tests only |
| extras.ponds | tests only (the pond water itself is used, as '~') | tests/map-wheatfield.test.mjs |
| extras.crossings | NO | |

So the HIVE line "8 generator sockets no code uses" is PARTLY right: the sockets are drawn but never simulated. The camps, the ruin and the dam data are unused by the sim. The Dam's push logic exists in env/rocks.mjs (fordRunAcross, dam flag) but is not tied to the map's dam data. WHEATFIELD.md says "the sim does not run pushes yet" — that line is UNVERIFIED for the current rocks.mjs.

## StarCraft II map comparison (Liquipedia, via search and raw pages)
- Ephemeron LE (raw page, Liquipedia): infobox width 132, height 148; rush distance 35 s; "Destroy the rocks to open up larger, unobstructed attack paths across the high grounds." Units of 132x148 are not stated on the page (assumed tiles). Older ladder pool (2019-2020), so not necessarily today's pool.
- Altitude LE (raw page): width 140, height 140; rush distance 38; 14 standard bases and 2 rich bases blocked by destructible Xel'Naga towers (500 HP each). Killing the rock towers removes them and opens the rich bases.
- Winter's Gate LE (search snippet): 128 x 132 tiles, rush 41 s to the enemy natural.
- Current 2026 ladder pool: UNVERIFIED (Liquipedia's Ladder Maps page returned 403; the Map page redirects to Maps and was not read).
- Size gap: Wheatfield is 256 x 256 = 65,536 tiles, about 3.3 times the area of Ephemeron or Altitude (about 19,500 each), if their figures are tiles.
- Rush distance: not converted. SC2 gives rush distance in seconds; Wheatfield's 302-step path is in tiles. A conversion needs Toaster Wars unit speed (not checked) — UNVERIFIED.
- Xel'Naga towers: Blizzard's game guide (news.blizzard.com/en-us/article/4546768/game-guide-map-elements) says a tower is controlled by having units adjacent to it and grants vision over "a good chunk of the map". It does not give a count or placement. **Wheatfield has no tower or watchtower feature at all.** The Old Windmill 'X' is the closest thing and it does nothing in code.
- Destructible rocks: SC2 uses them to gate expansions and backdoors (Ephemeron, Altitude, Blizzard guide). Wheatfield's dam rocks are '#' tiles that sit in the map, and env/rocks.mjs handles pushes generally. The map's rock layout does not gate any Reach.
- Natural expansions: SC2 natural = the first expansion behind a choke. Wheatfield's Lower Farm is the natural in the doc; it has no choke feature beyond the creek and the gates (not counted).

## Associations (web fact -> code problem)
1. **Ladder maps are 128-148 tiles and keep rush distances at 35-41 s; Wheatfield's 302-step core path is about 3x the area.** The doc's "every step outward costs cord" design needs a long walk to justify it, so the size is part of the design, not an accident. But the rush-distance numbers do not exist in the code, so the "10 min Dam fight" pacing cannot be checked against any figure.
2. **Altitude's rich bases are blocked by Xel'Naga towers that must be killed or held.** Wheatfield's Golden Fields (2 a side, 3,600 a tile) sit on open ground with no gate. The SC2 pattern (a rich field held by a destructible block) is the answer to the doc's "big, exposed" golden fields, and the code has nothing that makes the Golden Fields hard to reach. The 'X' ruin could be that block, but it is inert.
3. **SC2 Xel'Naga towers give map-wide vision when held.** Wheatfield's Generator Hills (overlook the fields) are the doc's vision answer; the sim has no vision feature tied to them (env/vision.mjs only reads ramps and heights). Connect the 8 sockets or the Old Windmill to vision and the SC2 tower rule gives a tested mechanic.
4. **Style rule vs build.** The overriding MAP STYLE RULE (grid-like, no meadows, no sockets) is not followed by the layout, which is Voronoi, has sine creek bends, keeps 8 sockets and 8 vents. The team should pick one; the code is the one that runs.

## Chat check-in
Posted to the team chat (see the next step). Haiku note: Liquipedia's `action=raw` URLs worked; plain pages returned 403.

## Not checked
- Other seeds, the unit speed for time-based rush distance, the current 2026 ladder pool, chokes and gate counts per side, the Dam push, the 6-worker vs 4-worker start (env/economy-table.mjs says 4; map says 6).
