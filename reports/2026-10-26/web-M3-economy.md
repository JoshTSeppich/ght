# M3 check: the worker economy (Crumbs and Wheat)

Checker: Haiku, minutiae slice M3. Read-only: no game files touched. Simulations ran with `node --input-type=module -e` (nothing written to disk).

## What was run
- Real /play state: `createPlayableState(7)` (play/toaster-play.mjs), which calls `createTerritoryMatch` (env/sim-territory.mjs). That match turns the mining chain on (`enableChain`), the budget on and ammo on, on the Wheatfield map.
- Gather orders were given through `step()` (env/sim.mjs) for 3 minutes of game time (24 tps).
- Config check: `createMatch` (classic, legacy map, 400 Wheat a tile, carry 10, mineTicks 8) is NOT what /play plays. My first run used it and gave about 350 Wheat a minute per Crumb. Discard it. Any number from the classic `STATS.crystal` row is the wrong one for /play.

## Measured on /play (createPlayableState, seed 7)
| Setup | Wheat in 180 s | Per minute | Notes |
|---|---|---|---|
| 6 Crumbs on the nearest field (24,226, 1800 Wheat, 6 tiles from Core) | 585 | ~195 total, ~32 per Crumb | field left 1310 at 180 s |
| 16 Crumbs on the same field | 535 | ~178 total | only 5 Crumbs ever stood beside the tile; the rest queue |
| 16 Crumbs spread over the 8 nearest home fields | 1385 | ~430 total, ~27 per Crumb | 0 Crumbs idle |

- Field 24,226 has 5 passable neighbours out of 8 (node check). So one tile takes at most 5 mining Crumbs. Crumbs 6 and up add nothing and can jam the approach. This is an emergent cap, not a coded one. verify-C M4 said "about 9" from adjacency; that was wrong for this tile.
- The per-Crumb rate (about 27-32/min) matches `tests/passive-income.test.mjs` (25-30/min).
- Timing comes from `STATS.economy.hand` (carry 5, mineTicks 200 = 8.33 s). Chain-off `STATS.crystal` (carry 10, mineTicks 8) is dead on /play.

## Code facts (read, not run)
- Mining/carry: env/economy.mjs:29-30 picks `handMine`/`handCarry` only when `state.chain` exists. `tickGather` (economy.mjs:211-303): walk, then mine `mineTicks` ticks, take min(carry, tile.amount), walk back. Delivery is instant at the sink (`deliverByHand`, :306). Walk speed: toaster Crumb speed 2 (env/stats.mjs:169), so 2 ticks a tile.
- Drop-off: with the chain on, the nearest complete Core or Depot (economy.mjs:183-196). Depots are chain-only.
- Depletion: a tile at 0 triggers `retarget` (economy.mjs:201-209). That search is map-wide (`nearestCrystalWithShards`, :161), so a depleted Crumb walks to any field. Then play/idle-crumbs.mjs `nearestWheat` only looks within cord reach 12 for auto-gather, and any Crumb still on a far gather order does not come back. verify-C M1/M2 found the same stall.
- Auto-gather (play/idle-crumbs.mjs): an order-less Crumb idle for 72 ticks (3 s) gets `gather` on the nearest wheat inside cord reach 12 of a side's power point or Core. At tick 0-1, idle Crumbs go at once (`since = -Infinity`). Retry every 120 ticks. Every idle Crumb picks the same nearest tile, so they pile onto one tile (the 16-on-one-tile case above). The "spread to 2 per tile" from SYSTEMS-DESIGN E2 is not in the code.
- Player gather (env/commands.mjs:69-79): only checks that a crystal with amount > 0 is on the tile. No cord check, no tile cap.
- Worker rally (play/input.mjs:600-619): a new Crumb from the Core takes the Core's default rally, which is the nearest Wheat anywhere on the map (input.mjs:605), not one within cord reach. Every new Crumb piles onto that one tile. Plays against the cord rule.
- Starting Wheat: `STATS.match.startShards` = 100 (env/stats.mjs:96; state.mjs:26). Workers pay no upkeep (budget.mjs:33 `NO_UPKEEP`; stats.mjs:409 `exempt`).
- Unit cap: env/commands.mjs:113 checks `STATS.match.unitCap` (40) unconditionally in `doTrain`. budget.mjs `unitCapApplies` (:55) says the cap is off when the budget is on, and sim-territory turns the budget on. So on /play the cap is still enforced by commands.mjs. Either the budget's "no supply cap" text is wrong or the check is missing a guard. Not run, from reading only.
- Mill: 10 Wheat to 1 flour per 20 s (env/bakery.mjs:32-33, 149-153), so 30 Wheat/min per Mill. Matches the HIVE's "3 flour a minute".
- Golden field: Wheatfield 'R' tile = 3600 (env/map.mjs:128, 2x of 1800). Drawn gold (play/wheatfield-terrain.mjs:51, 209). Fade by amount/full (wheatfield-terrain.mjs:371-372, floor 0.25 when amount > 0). No "depleted" text found in play/ (grep).
- Bank: `state.shards` is the Wheat bank. Nothing on /play shows a stall warning when a field runs out.

## Comparison with StarCraft II mining
Liquipedia (https://liquipedia.net/starcraft2/Mining_Minerals) returned HTTP 403 to WebFetch. I could not read it. The figures below are from WebSearch snippets (https://tl.net/forum/starcraft-2/113577-sc2-optimal-worker-saturation, https://west-games.com/starcraft-mineral-income-calculator/) and are UNVERIFIED on a fetched page:
- Carry: 5 minerals a trip (blue patches). UNVERIFIED.
- Rate: first two workers on a patch about 40/min each, a third about 20/min; 3 on a patch about 102/min. UNVERIFIED.
- Saturation: 2 per patch is the efficient layer; 16 optimal, 24 maximum per base (also cited in research-sc2.md:76). UNVERIFIED.

Comparison:
- Per-Crumb rate: /play gives about 27-32/min, close to SC2's first-two-worker rate of about 40/min (a shade lower, with more walking here).
- Diminishing returns: SC2 gives the 3rd worker about half. /play gives Crumb 6 onward nothing at a tile, a hard wall instead of a curve. The HIVE F4 proposal ("2 per tile at full, 3rd at half, cap 3") is what SC2 does, and nothing in code does it yet.
- Walking: SC2 workers mine at the patch and walk to a Nexus or Hatchery; the walk is a fixed small cost. /play has the same shape (walk 2 ticks a tile), so near-Core fields are fine. Far fields are not fine: no cord, no drop-off, the Crumb walks back to a far Core.
- Depletion: SC2 bases mine out and force expansion (research-sc2 point 8). Here one 8-tile home field is 14,400 Wheat. At about 430/min for 16 spread Crumbs, that is about 33 min, so the HIVE's "about 30 min at 16 Crumbs" holds only if the 16 are spread over all 8 tiles. Concentrated on one tile, the field lasts about 9 min for one tile's 1800 at 180/min.
- Rally: SC2 rally sends new workers to the nearest patch with the fewest workers on it. /play sends every new Crumb to the single nearest tile, so the rally itself piles them up.

## Associations
- Crowding is the main economic lever. Five open tiles beside a field cap what a field can yield. Spreading (spread test: 430/min vs 178/min with the same 16 Crumbs) is worth more than any new Crumb. Fixing the auto-gather to spread over the 8 nearest tiles (SC2 "saturation") would double the rate of a 16-Crumb economy without touching the numbers.
- Map-wide retarget + cord-only auto-gather means a depleted field strands Crumbs (verify-C M1). SC2's answer is expansion on a close, cheap natural. Here that needs an Outlet or a cord chain (verify-C M2).

## Corrections to the research report and HIVE
1. HIVE point 3 ("lasts about 30 min at 16 Crumbs") is right only if the 16 are spread over the 8 home tiles. Concentrated, they add no more than 5 Crumbs' worth to a tile.
2. research-sc2 F4 says "2 Crumbs per tile at full rate, 3rd at half, cap 3". The code has none of this; the real emergent cap is 5 per tile at field 24,226.
3. verify-C M4 said "about 9 Crumbs a tile". For field 24,226 the number is 5 (5 open neighbours).
4. Classic `STATS.crystal` (carry 10, 8 ticks) is not what /play uses. Anyone quoting a Crumb's rate from it is wrong by about 10x.

## Not checked
- Liquipedia (403). SC2 numbers are snippet-only.
- Full test suite. Only tests/passive-income.test.mjs was read, not run.
- The unit-cap question in commands.mjs:113 was read, not run.
- Field depletion for 8 tiles, and 16 Crumbs over a full 8-field match, were not run to the end.
