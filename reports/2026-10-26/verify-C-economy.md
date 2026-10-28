# Verify C: economy and expansion (Wheatfield, GHT on /play)

Verifier run 2026-10-26, read-only. No game file, test or doc was edited. Only this report was written.

**Ran:** node one-liners that build the Wheatfield map (seeds 7, 1, 2, 3, 42) and the /play state, stepping the sim up to 240 s. `node --test tests/passive-income.test.mjs` (that file only: 2/2 pass). Not run: the full suite, `tests/builtin-ai.test.mjs`.

## Verdicts

1. **PARTLY.** Amounts are right: `env/map.mjs:12` WHEAT_AMOUNT 1800 (wheatfield), `:128` rich = 2x (3600), `:9`/`:113` AMOUNT 400 for every other size. Tiles do deplete (`env/economy.mjs:297-298`). But the 8 home tiles hold 14,400 in total, so they are not gone within a normal match. See M1 for what happens when they are.

2. **CONFIRMED, with one correction.** Seeds 7, 1, 2, 3, 42 give the identical map. The seed only scatters rocks (`maps/layout-v4.mjs:300`). Totals: 176 tiles, 96 rich, 489,600 Wheat. Two Strips, at (18,232) and (237,23). Distances use Chebyshev, the code's `distance` (`env/state.mjs:131`):
   - within 8 tiles: 6 tiles, 10,800
   - within 30 tiles: 8 tiles, 14,400 (all 6-9 tiles away)
   - within 60 tiles: 16 tiles, 28,800 (the extra 8 are at 59-60)
   - Correction: the next wheat after the home 8 is 59 tiles away, not "near".

3. **PARTLY.** Hand mining is 5 per 200 ticks: `env/stats.mjs` (hand carry 5, mineTicks 200), mineSeconds 8.33 via `env/economy-table.mjs`. About 28 per Crumb per minute: `tests/passive-income.test.mjs` passes both tests this run. **The 6-Crumb cap per tile is not in the code.** `env/economy.mjs:211-303` and `env/commands.mjs:69-79` have no tile occupancy check. The only "at most 6 per field tile" is design text (`SYSTEMS-DESIGN.md:15`). E2 is marked "built" at `SYSTEMS-DESIGN.md:35`, but `play/idle-crumbs.mjs:12-23` `nearestWheat()` returns the single nearest tile, with no spreading. Node: six idle Crumbs after 120 s were all targeting (24,227). The walk is short at home (toaster overlay worker speed 2); I did not time it separately.

4. **CONFIRMED.** `env/bakery.mjs:34` Well = 144 ticks = 10 per minute. `:35` Toaster = 120 ticks = every 5 s. `:36` 4 slices per bake. `:162-168` a Toaster bakes only when powered and holding 1 flour + 1 water. The Mill (`:149-153`) takes 10 Wheat straight from `state.shards[owner]`, the bank, every 20 s. No Crumb has to deliver it. The arithmetic holds: 12 flour/min is 4 Mills, 12 water/min is 1.2 Wells.

5. **CONFIRMED.** Node: a new grunt reads `observeAmmo` slices 6, slots 6, shots 18. `env/ammo.mjs:48` slots 6, shotsPerSlice 3. `:142` defaults to full slots.

6. **CONFIRMED, with a qualifier.** Sockets, camps and the ruin are only generated and drawn. `env/map.mjs:115-138` builds them, and no sim rule reads them. Windmill pads come from their own list, `env/energy.mjs:23-33` WHEATFIELD_SITES, and 0 of 8 map sockets coincide with a pad (node). Camps: `env/neutrals.mjs:28-31` builds its own camps from the seed and only when `enableNeutrals` runs. On /play `state.neutrals` is absent (node), so the map 'k' tiles are never read. The ruin appears only at `maps/layout-wheatfield.mjs:179`. Play code draws sockets as pads (`play/wheatfield-terrain.mjs:389-392`) and on the minimap (`play/minimap-kitchen.mjs:10`).

7. **PARTLY.** No Totem, Mound, Depot, Drill or Track is on /play. A grep of `play/input.mjs`, `toaster-play.mjs`, `command-card.mjs`, `toaster-buildings.mjs`, `app.mjs` and `hud*.mjs` comes back empty. `TECH-TREE.md:30` "not yet" is right for the UI. The sim does have a claim command (`env/sim-territory.mjs:115-156`, 100 Wheat, `env/stats.mjs:201-204`), and no /play control sends it. Extension Box, Pylon, Windmill and Dam are placeable (`play/input.mjs:434,548`), so cord reach can grow (see M2). **What the bots do:** /play's default opponent is `players/toaster-easy` (`play/opponent.mjs:16`), and normal is `toaster-sonnet`. Neither issues `claim` nor expands. The builtin AI does both: `players/builtin/ai.mjs:207-223` claims, `:85-128` sends Crumbs to far fields. It runs only with `?ai=builtin` or `?classic=1`. `tests/builtin-ai.test.mjs:43-44` counts "expanded" as any gather order more than 9 tiles from the core, on the classic `createMatch`. That is an order, not wheat delivered, and nothing tests Wheatfield expansion.

8. **CONFIRMED (5%, on /play).** `env/stats.mjs:166` sets toaster upkeep 5; `play/toaster-play.mjs:25` applies it; `env/budget.mjs:85` reads it. Node: one Popper = 3.75 Wheat/min. Classic is 10% (`env/budget.mjs:23`). The in-game tip disagrees (A1).

## Associations (what depends on these numbers, and where they disagree)

- **A1. Tip text reads the classic rows.** `play/hud-tips.mjs:40-44,25`. Node output for a Popper: "60 HP, 8 damage, reach 1, holds 6 slices. Eats 7.5 wheat a minute. Takes 0.6 s to bake." The engine says 20 damage, reach 4 (toaster overlay, `env/stats.mjs`), 1.25 s train (`env/economy-table.mjs`), 3.75 per minute. `STATS.budget` is never defined, so upkeep falls back to 10%. The HUD upkeep chip (`play/hud-bar.mjs:56,105`) uses the right 5%, so the tip and the chip disagree.
- **A2. ECONOMY.md** matches the engine on the kitchen, Wells, pilot light, pantry, upkeep, the 1800/400 tiles and the Popper row (`ECONOMY.md:9-47`). One disagreement: `ECONOMY.md:78` says "two Mills keep six Crumbs' wheat moving". Two Mills make 6 flour a minute, which is 24 slices, half a Toaster. `ECONOMY.md:67` says a Toaster needs four.
- **A3. SYSTEMS-DESIGN.md** `:15` (6 per tile, 28/min) is design, not code. `:35` (E2 built, "6 of 6 working" on the field) is false: no such text exists in play/ or env/.
- **A4. WHEATFIELD.md** contradicts itself on sockets. Line 25 says they are removed; lines 81 and 99 still have "generator sockets". Lower Farm (line 78, "the first expansion", "a bigger wheat field") is not near: the nearest other field is 59-60 tiles away (8 tiles, 14,400). The 61-100 band holds 32 tiles, 24 of them rich.
- **A5. TECH-TREE.md:30** "not yet" matches /play.
- **A6. Stale comments.** `env/toast.mjs:3,30` describes a 5 s bake and "one Toast a minute" per unit. That bake never runs in a match: `stepToast` is called only by `tests/toast-economy.test.mjs`. `env/ammo.mjs:47` says "six 10-damage shots"; the overlay is 20.
- **A7. Tests that pin these numbers:** `tests/passive-income.test.mjs` (passes), `tests/ammo.test.mjs:63-68` (full slots, passes by reading), `tests/idle-crumbs.test.mjs` (nearest-tile rule, no spread test), `tests/builtin-ai.test.mjs` (classic only).

## Missed (anything that stops a player ever needing to expand, or running out of toast)

- **M1. Silent stall when the home field empties.** Node: I zeroed the 8 home tiles and ran six idle Crumbs for 120 s. The bank stayed at 100 and every Crumb had no order. Idle search is limited to cord reach 12 (`play/idle-crumbs.mjs:7`). The retarget at `env/economy.mjs:201-209` is map-wide, but the cord leash then drops the order (`env/power.mjs:8-11`). Timing: six Crumbs bring about 168 a minute, so 14,400 lasts about 86 min. Forty Crumbs would drain it in roughly 13 min (not measured). After that the Mills starve, toast stops, and the pilot light gives 3 slices a minute (`env/bakery.mjs:43-44`).
- **M2. Far manual gather fails on cord, not on rule.** Six Crumbs ordered to (34,173), 59 tiles out, got accepted orders. They walked back and went idle near y≈220. The bank was still 100 after 4 min. So expansion means cords (Extension Box, Pylon). Not tested: whether a laid chain brings wheat home.
- **M3. Income is wheat-bound, so expansion comes sooner than the docs suggest.** One busy Toaster takes 120 Wheat a minute (12 flour), which is 71% of six Crumbs' 168. Each fighting Popper adds about 33 Wheat a minute of toast plus 3.75 upkeep. Six Crumbs run one full kitchen and little else. More Crumbs at home are the cheap fix first: 50 Wheat each, paid back in about 2 min. "Never needs to expand" holds for one kitchen in a 12-16 min match, not beyond.
- **M4. Crew per tile is uncapped.** Nothing limits Crumbs per tile. Idle Crumbs all go to the same tile (`play/idle-crumbs.mjs:12-23`). Adjacency (Chebyshev 1) is the only practical limit, about 9 per tile, and that is not coded.
- **M5. Other unit tips probably read classic rows too.** `kindTip` reads only `STATS.units`. I checked the Popper only.
- **M6. Renderer and sim disagree on windmill spots.** 0 of 8 sockets coincide with the sim's windmill pads (above).

## Not done / caveats

- Full suite not run; `tests/passive-income.test.mjs` only.
- `tests/builtin-ai.test.mjs` not run. It is classic only, so it does not bear on Wheatfield.
- Extension Box and Pylon expansion not simulated (M2).
- "40 Crumbs drain in ~13 min" is arithmetic, not a sim run.
- Only file written: this report. Folder `reports/2026-10-26/` was created for it.

## Ten most important lines

1. Wheat amounts are right: 1800 per Wheatfield tile, 3600 rich, 400 on the classic sizes (`env/map.mjs:9,12,128`).
2. The home Strip has only 8 wheat tiles (14,400 Wheat); the next field is 59 tiles away, with the same layout on every seed.
3. The "6 Crumbs per tile" cap and the E2 spread are not in the code; idle Crumbs all pile onto the one nearest tile (`play/idle-crumbs.mjs:12-23`).
4. Kitchen math checks out: Mill draws from the bank, Toaster bakes every 5 s, Well 10/min (`env/bakery.mjs:34-36,149-168`).
5. A new Popper holds 6 slices, 18 shots (`env/ammo.mjs:48,142`).
6. Sockets, camps and the ruin are drawn but read by no rule; the 8 sockets match none of the 8 windmill pads (`env/energy.mjs:23-33`).
7. /play has no Totem, Mound, Depot or Drill button, but Extension Boxes and Pylons extend cord reach.
8. Upkeep is 5% on /play (3.75 a Popper); the in-game tip wrongly says 7.5 and 8 damage (`play/hud-tips.mjs:25,40-44`).
9. Stall risk: when the home 8 tiles empty, idle Crumbs sit idle and the bank freezes; far manual orders are dropped at the cord edge (tested).
10. One busy Toaster eats 120 Wheat a minute, 71% of six Crumbs' income, so more Crumbs or cords are needed well before the 14,400 at home runs out.
