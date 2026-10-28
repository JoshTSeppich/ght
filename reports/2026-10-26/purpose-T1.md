# PURPOSE T1: does every tier-1 item feed something? (2026-10-26, read-only)

Scope: Crumb, Power Strip, Mill, Well, Toaster, Extension Box, Heat Lamp, Windmill, Dam; resources Wheat, Flour, Water, Power, Toast.
Method: code read (file:line) plus node runs on `createPlayableState(5)` from play/toaster-play.mjs, stepping `env/sim.mjs` `step()` at 24 ticks/s. Test states pushed structures in directly (complete, no build time) so the chain could be timed; the build command itself was read in env/commands.mjs:95-107.
Liquipedia (raw wikitext, fetched): Supply Depot, Refinery, Engineering Bay, Barracks (Legacy of the Void).

## Table

| item | needs | feeds | verdict | evidence |
|---|---|---|---|---|
| Crumb | 50 Wheat, trained at the Power Strip (stats.mjs:131-133); 12-tile cord to a power point (power.mjs:26) | Wheat income (30/min alone, 160/min with 6 on auto, measured); the only builder (commands.mjs:95-107, `wrong-kind` for anything else); places Extension Boxes (plug/place-power); hauls Flour/Water/Toast and Toast slices to fighters (ammo.mjs:241) | PURPOSEFUL | sim 60 s runs: 1 Crumb +30, 6 Crumbs +160 |
| Power Strip | the start; no cost | Power 2 (ENERGY.make strip, energy.mjs:9); cord root, reach 14 (power.mjs:27); the toast stack, 8 at start, 1 slice a 20 s pilot light (bakery.mjs:37-43, 98-120); trains Crumbs (stats.mjs:133) | PURPOSEFUL | losing it loses the match (stats.mjs:446) |
| Mill | 75 Wheat (stats.mjs:142); no power check (bakery.mjs stepBakery mill branch) | Flour: 10 Wheat to 1 Flour every 480 ticks (20 s) (BAKERY, bakery.mjs:37-46); measured 3 Flour and 30 Wheat a minute. Flour feeds Toaster only | PURPOSEFUL | one Toaster at full speed (12 bakes/min) needs 4 Mills; a Mill eats 30 Wheat a minute, the same as one Crumb earns |
| Well | 50 Wheat (stats.mjs:143); water within 4 tiles (wellReach, bakery.mjs:wellReach 4) else dry; no power check | Water 1:1 with Flour into the Toaster. Alone 10/min (rateTicks 144, measured). Home spring well at (12,224): 5/min (spring, every second beat, measured). Two adjacent Wells: 5.33/min each, 10.7 total (crowd formula, bakery.mjs refreshWells) | PURPOSEFUL (WEAK when clustered) | a Well built on dry land makes 0 and is warned: hud-badges.mjs:8 "No water.", placement-ghost.mjs:33 'dry' |
| Toaster | 100 Wheat (stats.mjs:144); Flour 1 and Water 1 in the pantry; lit power reach, 2 Power (ENERGY.use, energy.mjs:10); structurePowered (bakery.mjs) | Toast: 4 slices every 5 s (bakery.mjs:43-45); pantry cap +3 per Toaster (pantryPerToaster); tier 2 opens on a complete Toaster (stats.mjs:251-253, `need: "toaster"`) | PURPOSEFUL | measured: 1 Mill plus 1 Toaster gave 2 bakes in 60 s (Flour-limited), +8 slices |
| Extension Box | 30 Wheat (POWER.cost, power.mjs:28); a Crumb next to the site (place-power) | Cord reach 12 (POWER.range, power.mjs:27). Toaster 20 tiles out: structurePowered false without it, true with it (measured). Brings Windmill/Dam networks out to Dams | PURPOSEFUL | home Dam at (88,85) needs 12 boxes, about 360 Wheat, to light (measured: network made 8 = Strip 2 + Dam 6). Note: STATION table says extension link 8 (power.mjs:415), ground-line opt-in only; not a verdict driver |
| Heat Lamp (turret) | 100 Wheat (stats.mjs:141), hp 150; combat.mjs:31 and :41 say it needs power | Feeds nothing: no item enables, unlocks, or consumes it. Fires 12 damage every 12 ticks (24 dps), range 5 (stats.mjs:141; toaster overlay) | DEAD END, plus BROKEN LINK on its power gate | measured: unpowered Heat Lamp 32 tiles from the Strip fired 4 shots and killed a 40 hp Crumb (hit events, by:700). See the list below |
| Windmill | 40 Wheat on a high-ground pad (energy.mjs cost); pads 4 per side (energy.mjs PADS) | Power 3 (energy.mjs make). Measured: Strip alone with 2 Toasters sheds 1 (made 2, used 4); add a Windmill and the shed is 0 (made 5, used 4). Tier 3 open on a Windmill or Dam (stats.mjs:254, need "power"; kitchenNeedMet, tiers.mjs) | PURPOSEFUL | the home pads sit 12 tiles from the Strip, inside its 14-tile reach |
| Dam | 90 Wheat (energy.mjs cost); the river site (88,85) is 147 tiles from the home Strip | Power 6, the same tier 3 gate as Windmill | WEAK | about 450 Wheat with 12 boxes for 6 Power (0.013 Power per Wheat) against Windmill 3 per 40 (0.075). It only adds a second route to a gate the Windmill already opens |
| Wheat | Crumb mining (30/min per Crumb alone) | Mill (30/min each), every building, every unit | PURPOSEFUL | the Mill and the Toaster are its main sinks |
| Flour | Mill, 10 Wheat each (3/min per Mill) | Toaster bake, 1 each (pantry cap 6 + 3 per Toaster) | PURPOSEFUL | 4 Mills per full Toaster |
| Water | Well (10/min alone; 5/min home spring) | Toaster bake, 1 each | PURPOSEFUL | with Flour, the only other input of Toast |
| Power | Power Strip 2, Windmill 3, Dam 6, Mill Dam 14 (energy.mjs:9) | Toaster uses 2 each; fences use 1 per 8 tiles (energy.mjs:fenceTiles); tier 3 gate (Windmill or Dam) | PURPOSEFUL | Mill, Well, Heat Lamp do not draw Power (the Heat Lamp should; see the list) |
| Toast | Toaster 4 slices per bake; Power Strip pilot 1 per 20 s below 4 slices; starts at 8 | Fighter ammo: Popper holds 6 slots, 3 shots a slice (ammo.mjs ARMED grunt), a Four-Slice volley costs 4 slices; Crumbs haul it (2 per run). Toast is the only feed of fighters | PURPOSEFUL | the real limit on fighting, per RESOURCE-FLOW.md |

## Comparison with StarCraft II (Legacy of the Void)

Pages read as raw wikitext (Liquipedia, `index.php?title=<Page>&action=raw`):
- Supply Depot: https://liquipedia.net/starcraft2/index.php?title=Supply_Depot_(Legacy_of_the_Void)&action=raw. 100 minerals, +8 supply, no requirement, unlocks Barracks. Upgrade: Calldown: Extra Supplies.
- Refinery: https://liquipedia.net/starcraft2/index.php?title=Refinery_(Legacy_of_the_Void)&action=raw. 75 minerals, harvests Vespene Gas. The fetched page does not name what gas pays for; I did not verify that.
- Engineering Bay: https://liquipedia.net/starcraft2/index.php?title=Engineering_Bay_(Legacy_of_the_Void)&action=raw. 125 minerals, requires a Command Center, unlocks Missile Turret, Sensor Tower and Planetary Fortress, is the research centre for infantry weapons, armour, Hi-Sec and Neosteel.
- Barracks: https://liquipedia.net/starcraft2/index.php?title=Barracks_(Legacy_of_the_Void)&action=raw. 150 minerals, requires a Supply Depot, unlocks Orbital, Bunker, Factory, Ghost Academy, builds Marine, Marauder, Reaper, Ghost.

Comparison:
- Every SC2 tier-1 building has a requirement or a downstream unlock. The Supply Depot gates Barracks; the Barracks gates units; the Engineering Bay gates the upgrades and the turret.
- Our Heat Lamp is the one tier-1 building with no downstream: nothing requires it and it unlocks nothing. The Engineering Bay is the nearest analogue, and in SC2 it is itself a gate, while our turret is free.
- Our Toaster does the Barracks job: it gates tier 2 (Assembly Line units). The Windmill and Dam do the Factory job: they gate tier 3. The Mill, Well and Toaster together are the Refinery's job made into a chain, and the chain is deeper than SC2's single gas building.
- The Dam is a second tier 3 gate at roughly 6 times the cost per Power of a Windmill, with no SC2 counterpart; that is why it is WEAK.

## DEAD ENDs and BROKEN LINKs, with the smallest fix

1. **DEAD END: Heat Lamp feeds nothing.** Evidence: no item requires it, unlocks from it, or draws Power or Toast from it (stats.mjs:141, stats.mjs:446). Smallest fix: each turret shot takes one slice through `spendShot` (env/ammo.mjs), so the Heat Lamp draws on the Toast stack. Fires only when the stack has slices; that links it to Toast.
2. **BROKEN LINK: Heat Lamp power gate.** Promised in env/combat.mjs:31 ("the Heat Lamp fires only while powered") and in the chat plan (#1242). Not enforced: `stepVerdict` returns null for anything without `unit.power` (env/power.mjs:162-163), and the isPowered hook (env/sim-territory.mjs:92-95) passes turrets. Measured: an unpowered Heat Lamp 32 tiles out fired 4 shots (12 damage each) and killed a Crumb. Smallest fix: in that hook, `if (u.kind === 'turret') return structurePowered(s, u);`.
3. Open discrepancy, not a verdict: Extension Box range 12 (POWER.range) vs link 8 in the STATION table (power.mjs:415). The place-power check and the network both use 12, so the live game is consistent; only the ground-line opt-in uses 8.

## Not verified here
- Tier 1 Crumb training time and carry rate were read, not timed.
- The Refinery page does not say what gas pays for, so I did not compare gas spending.
- Two Wells at 4 to 7 tiles apart were not measured; only adjacent (distance 1) and the formula.
