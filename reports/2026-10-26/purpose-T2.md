# PURPOSE: Tier 2 (what a complete Toaster opens)

Slice: Assembly Line, Popper, Zapper, Flak Popper, Relay Pylon. Read-only. Code at the commit in the working tree on 2026-10-26.

## Method
- Stats: `rowOf(state, kind)` with `enableAmmo` on (the Toaster Wars overlay), env/stats.mjs:436-453 (roster), 166-185 (overlay), 240-258 (tiers).
- Fights: env/combat.mjs `stepCombat`, one-to-one, full load, no movement, no resupply, no upgrades (combat.mjs reads no upgrade or armour). Range = min of the two ranges, so both can reach. Cap 2400 ticks (100 s). Times are ticks / 24.
- Equal-Wheat: 300 Wheat a side (floor(300/cost) units each), stacked on one tile, no movement. Stacking makes splash units (Broiler, Flak Popper) look too strong, so use the 1-v-1 table as the primary evidence.
- Toast per fight: slices spent by the winner (ARMED slices, 3 shots per slice for Popper, Zapper, Flak Popper).
- Power: `buildLines` in env/power.mjs:465-520 on a state with a Power Strip (core) and a 3-tile river of rock (creek water is rock for movement, env/sim-territory.mjs:62-66).
- Liquipedia: raw pages via WebFetch (`index.php?title=...&action=raw`). Bash curl was refused by permission.

## Stats used (toaster overlay where it applies)
| Kind | Name | Wheat | HP | Shot | Cadence | Range | Slots (slices) | Splash |
|---|---|---|---|---|---|---|---|---|
| grunt | Popper | 75 | 60 | 20 | 36 ticks (1.5 s) | 4 | 6 (3 shots a slice) | no |
| lancer | Zapper | 65 | 40 | 18 | 30 ticks (1.25 s) | 3 | 6 (3 shots a slice) | no |
| spiker | Flak Popper | 70 | 50 | 15 | 36 ticks (1.5 s) | 5 | 6 (3 shots a slice) | yes, neighbours take half |
| forge | Assembly Line | 150 | 400 | none | build 80 ticks | none | none | no |
| pylon | Relay Pylon | 60 | see note | none | none | 8 (power) | none | no |

Upkeep: 5% of cost a minute (STATS.toaster.upkeepPercent). Train times: Popper 30, Zapper 40, Flak 50 ticks (overlay). Tier 2 unlock: a complete Toaster (env/stats.mjs:253; env/tiers.mjs:121-127 kitchen check).

## 1-v-1 results (fed, no movement)
| Pair | Winner, time, hp left |
|---|---|
| Popper v Zapper (d=3) | Popper, 1.5 s, 24 left |
| Popper v Flak Popper (d=4) | Popper, 3.0 s, 15 left |
| Popper v Four-Slice (d=4) | Four-Slice, 1.3 s |
| Popper v Broiler (d=4) | Broiler, 1.5 s |
| Popper v Bagel (d=1) | Bagel, 2.0 s |
| Popper v Heat Lamp (d=4) | Heat Lamp, 2.0 s, 110 of 150 left |
| Zapper v Flak Popper (d=3) | Zapper, 2.5 s, 10 left |
| Zapper v Four-Slice (d=3) | Four-Slice, 1.3 s |
| Zapper v Broiler (d=3) | Broiler, 1.5 s |
| Zapper v Bagel (d=1) | Bagel, 1.0 s, 102 left |
| Zapper v Heat Lamp (d=3) | Heat Lamp, 1.5 s, 114 left |
| Flak Popper v Four-Slice (d=5) | Four-Slice, 1.3 s |
| Flak Popper v Broiler (d=5) | Broiler, 1.5 s, 40 left |
| Flak Popper v Bagel (d=1) | Bagel, 1.5 s |
| Flak Popper v Heat Lamp (d=5) | Heat Lamp, 2.0 s, 135 left |

Toast per kill (slices the winner spent): Popper kills Zapper with 2 shots = 1 slice (1 of 6). Zapper kills Flak Popper with 3 shots = 1 slice. Popper kills Flak Popper with 3 shots = 1 slice. A slice is 1/4 of a Toaster run (1 Flour + 1 Water makes 4 slices, env/bakery.mjs), so one kill is about 0.25 Flour.

Equal-Wheat (stacked, 300 Wheat a side): Popper 4 v Zapper 4: Popper 2 left, Zapper 0. Popper 4 v Flak 4: Flak 2 left (splash on stacks, artifact). Popper 4 v Heat Lamp 3: Heat Lamp 2 left. Flak 4 v Broiler 1: Flak 3 left (splash artifact). Zapper 4 v Flak 4: Flak 2 left.

## Items

| Item | Needs | Feeds | Beats (1-v-1 numbers) | Loses to | Verdict | Evidence |
|---|---|---|---|---|---|---|
| Assembly Line (forge) | 150 Wheat, 400 hp, 80-tick build (overlay). Unlock: a complete Toaster. No toast cost. | The only trainer of fighters: grunt, lancer, spiker (tier 2), brute, howler, dart (tier 3). Queue to STATS.match.queueMax. | Nothing directly; it is a building. Structure damage is its only defence. | Anything that reaches it; it is a plain 400 hp target. | PURPOSEFUL | env/stats.mjs:138-144, 253; env/tiers.mjs:121-127; play/hud-tips.mjs:53. Production is not gated by power (only the bakery is, env/bakery.mjs:116-123). Units still need a cord to move or fire (env/sim-territory.mjs:84-100). I did not test a freshly spawned unit's cord. |
| Popper (grunt) | 75 Wheat, 60 hp, 20 dmg / 1.5 s, range 4, 1 slice per 3 shots, 6 slots, 30-tick train. Unlock: Assembly Line, tier 2. | Ranged fighter; the only tier-2 ranged unit with range 4 and 60 hp. Its job: beat the Zapper and Flak Popper for toast. | Zapper (24 hp left), Flak Popper (15 left), Zapper equal-Wheat (2 left). | Four-Slice (1.3 s), Broiler (1.5 s), Bagel at melee (2.0 s), Heat Lamp (110 of 150 left, 2.0 s). Heat Lamp equal-Wheat: 2 of 3 turrets left. | PURPOSEFUL against the other tier-2 fighters; WEAK against the tier-1 turret. | env/stats.mjs:437, 166-185; env/ammo.mjs:24-28; env/combat.mjs:165-172 (fed fire); fights above. |
| Zapper (lancer) | 65 Wheat, 40 hp, 18 dmg / 1.25 s, range 3, 1 slice per 3 shots, 6 slots. Unlock: tier 2. | Short-range fast bolt. Its only 1-v-1 win is the Flak Popper. | Flak Popper (10 left). | Popper (dead Zapper, Popper 24 left), Four-Slice (1.3 s), Broiler (1.5 s), Bagel (1.0 s), Heat Lamp (114 left). Equal-Wheat: 0 of 4 vs Popper 2. | WEAK: beats only the Flak Popper (-1 of 6 tier-2 pairs). It is cheaper than the Popper (65 v 75) and loses to it at range 3. | env/stats.mjs:438; env/ammo.mjs:26; play/hud-tips.mjs:52 ("keep it near a Popper": its own tooltip admits the dependency). |
| Flak Popper (spiker) | 70 Wheat, 50 hp, 15 dmg / 1.5 s, range 5, splash 1 (half damage to neighbours), 1 slice per 3 shots. Unlock: tier 2. | Splash on clumps. Its ROSTER line says "anti-air". Nothing in Toaster Wars flies. | Nothing 1-v-1. Equal-Wheat on stacked Poppers: 2 left (splash artifact). | Popper (15 left), Zapper (10 left), Four-Slice, Broiler (40 left), Bagel, Heat Lamp (135 left). | DEAD END for its anti-air job (no flyer exists in the Toaster roster). Its splash job alone is WEAK. | env/stats.mjs:439-442 (ROSTER "anti-air"); env/vision.mjs:16,24 (AIR_KINDS = skiff, barge, seer, which are classic tier 3 and not in the Toaster roster); env/stats.mjs:253 (tier-2 list). Player-facing tooltip (play/hud-tips.mjs:54) says "bursts on swarms", so the player never sees "anti-air". |
| Relay Pylon (pylon) | 60 Wheat (env/power.mjs:28, economy-table.mjs:27). Unlock: tier 2. Power: a Power Strip or lit network to be lit. | Power across water and cliffs. Lines are high and never blocked (env/power.mjs:409-410, 461-481). Pylon to pylon 16 tiles. Pylon to Strip, Outlet, Extension, Toaster range: 8. Pylon to Windmill or Dam: min(8, 6) = 6. Toaster is powered if within 8 of a lit pylon (env/bakery.mjs:116-123). | Verified crossing: strip (5,10), pylon (12,10), pylon (26,10) across a 3-wide river: both lit (lines 1-10 and 10-11 high). An Extension Box across the river: no line (lit only the Strip). | Dark when it stands alone (no link to a lit point, test D). Only 8 tiles to a non-pylon. Cuts by enemy units on the line. Does not light a fence (fences need ground lines, env/power.mjs:546-550). | PURPOSEFUL (its water-hop job is unique among power stations). Its player-facing reach text is a BROKEN LINK (see below). | env/power.mjs:27-29, 412-416; test A/B/C/D/F/G; play/hud-tips.mjs:63. |

## Comparison with StarCraft II tier 2
Liquipedia raw pages (WebFetch):
- Marauder (Legacy of the Void): 100/25, from a Barracks with a Tech Lab, ground only (the infobox says "Ground"), +10 damage vs Armored. Its job is armour. https://liquipedia.net/starcraft2/index.php?title=Marauder_(Legacy_of_the_Void)&action=raw
- Stalker (Legacy of the Void): 125/50, from a Gateway with a Cybernetics Core, hits air and ground, Blink. Its job is mobility and anti-air. https://liquipedia.net/starcraft2/index.php?title=Stalker_(Legacy_of_the_Void)&action=raw

Logic: each SC2 tier-2 unit answers something tier 1 cannot. Marauder answers armour (the Roach and the Stalker). Stalker answers air (tier 1 Marines can shoot air, but the Stalker is the air answer that also hits ground). Our tier 2 has the same shape, but the tier-1 side is empty of mobile fighters: the only tier-1 attacker is the Heat Lamp, which beats all four tier-2 fighters 1-v-1 (table above). Tier 2 therefore answers nothing tier 1 can't already do, which is the main gap.

The clean parallel to a dead end: the Stalker's air hit exists because there are air targets (Medivacs, Mutalisks, Liberators). Flak Popper's anti-air claim has no target, so it is the Toaster analogue of a Marauder that cannot shoot anything armoured: a unit whose only bullet has no target.

## DEAD ENDs and BROKEN LINKs with the smallest fix

1. **DEAD END: Flak Popper's anti-air job.** No flying unit exists in Toaster Wars. The anti-air skiff, barge and seer are classic tier 3 (env/vision.mjs:16) and not in the Toaster roster. Smallest fix: strike "anti-air" from the roster line (env/stats.mjs:442). Keep the splash, and name the job "clump burst" for what it does. Bigger fix only if wanted: add a flyer to the Toaster roster.
2. **BROKEN LINK (text): Relay Pylon reach.** play/hud-tips.mjs:63 says "Links up to 16 tiles". The sim gives 16 only pylon to pylon, and 8 to a Strip, Outlet, Extension or Toaster (env/power.mjs:416, `shortLink: 8`). Smallest fix: in play/hud-tips.mjs:63, read `n.station.pylonShort` (STATION.pylon.shortLink) and write "Links up to 16 tiles to another Relay Pylon, 8 to anything else." Also add `pylonShort` to the `n.station` object at play/hud-tips.mjs:27.
3. **Adjacent, outside my slice (tier 3, noted for the owner):** the Four-Slice has 8 slots at 4 slices a volley, so two volleys (72 damage at x2 on buildings) and then it is hungry. The Heat Lamp survived a Four-Slice 1-v-1 with 6 hp left (env/ammo.mjs:24-28). Smallest fix for the tier-3 owner: raise slots to 12 or 16 for brute, or keep it and say so in its tooltip.

## Not checked
- Spawn cord: whether a freshly trained unit is plugged in at the Assembly Line.
- Movement and kiting: the fights are stationary. Zapper's range-3 kite and Bagel's melee closure are not measured.
- Upgrades: none in combat (env/combat.mjs reads none).
- Relay Pylon hit points: the table in env/power.mjs does not set them, and I did not look up the building's hp.
