# M9 check: the tech tree, research and upgrades as /play meets them

Checker: haiku (web slice M9). Read: HIVE.md, team chat (1185-1192, all graphics probes, nothing on tech), the code files named below. Read-only; no game files touched.

## Verdict in one line
/play has no research, no upgrades and no GHT tier readout. Its only tech gate is the GHT kitchen rule (Assembly Line/Popper/Zapper/Flak Popper need a Toaster; Four-Slice/Broiler/Bagel need a Windmill or Dam), and that gate lives in the UI only.

## Code facts (verified by reading the files)
- `play/toaster-play.mjs:46-50` `switchOffGht`: deletes `state.drift`, `state.market`, `state.research`; sets `state.noTiers = true`. Called from `createToasterState` (line 28).
- `env/tiers.mjs:46` `tierReason` returns null when `state.noTiers`. So the GHT Hold tiers are off on /play.
- `env/sim-territory.mjs:199` and `:207`: train and build are checked with `tierReason(...)`, which is null on /play. The sim does not enforce the kitchen tiers. Only the Wheat budget is enforced.
- `env/sim-territory.mjs:196,206`: `type === 'research' && state.research` is false on /play, so `doResearch` never runs.
- `env/tiers.mjs:72` `kitchenLockReason` is imported only by `play/input.mjs:21,195` (the command card). It is UI-only.
- `play/toaster-play.mjs:130`: `toasterPanel` returns '' when `!state.drift && !state.research`. On /play both are deleted, so the tier readout is never drawn. (`app.mjs:756` calls it.) The comments at toaster-play.mjs:5 and :126 still say the side panel is the tier readout: stale.
- `play/research-card.mjs` (upgrade cells, data-research buttons) is imported only by its own test. No page renders it.
- `env/effects.mjs:41` (Swimmers) and `:102` (Tunnels) read `state.research`, so they are classic-only. No other env file reads the numeric upgrade effect fields (`drillSpeedBonus`, `bufferBonus`, `armorBonus`, `speedBonus`, `warnSeconds`, `loadsPerSecond`); the earlier HIVE correction 1 holds.
- `env/stats.mjs` has no `foundry`, `sanctum` or `hangar` entry in `STATS.structures`. `tiers.mjs:26` drops missing buildings, so GHT tier 2 and 3 open on Hold alone (this is what TECH-TREE.md says, and it is a classic rule).

## Full table
Columns: item | in data | buyable on /play | has an effect on /play | shown to the player on /play.
"No" means: no button, no sim path, no reader.

| item | in data | buyable on /play | has an effect on /play | shown to the player |
|---|---|---|---|---|
| GHT tier 1 (open) | `STATS.tiers[1]`, Hold 0 | n/a, always open | n/a | not shown (readout hidden) |
| GHT tier 2 (Foundry or Sanctum + Hold 3) | `STATS.tiers[2]`; foundry/sanctum not in STATS.structures | No: gate not enforced (`noTiers`) | No | TECH-TREE.md only |
| GHT tier 3 (Hangar + Hold 6) | `STATS.tiers[3]`; hangar not in STATS.structures | No: gate not enforced | No | TECH-TREE.md only |
| Hold count and Tier readout | `play/tier-readout.mjs` | n/a | No | No: `toasterPanel` returns '' |
| Kitchen tier 1 (open: Crumb, Mill, Well, Toaster, Extension, Turret, Windmill, Dam, Heat Lamp, Power Strip) | `STATS.toasterTiers[1]` | Yes, open | Yes (normal play) | card, no lock |
| Kitchen tier 2 "Needs a Toaster" (Assembly Line, Popper, Zapper, Flak Popper, Pylon) | `STATS.toasterTiers[2]` | Greyed until a complete Toaster stands; UI only, sim accepts | Lock only | card: greyed, tooltip "Needs a Toaster."; click toasts it |
| Kitchen tier 3 "Needs a Windmill or Dam" (Four-Slice, Broiler, Bagel) | `STATS.toasterTiers[3]` | Greyed until a Windmill or Dam is listed in power points; UI only | Lock only | same as above |
| Wheat lock on a card entry | `input.mjs:198` | Greyed "Not enough Wheat (N)" | Lock only | tooltip and toast |
| Research building: Foundry, Sanctum, Hangar | in tiers.mjs / TECH-TREE only; not in STATS.structures | No | No | not shown |
| Assembly Line as research/tech | it is `forge` (tier 2 kitchen); trains 6 units | Needs a Toaster | Yes (trains units) | card |
| Research queue (3 deep, one per building) | `TIER_RULES.researchQueueMax` in tiers.mjs | No | No | not shown |
| Research card (one cell per upgrade) | `play/research-card.mjs` | No | No | not shown (module unused) |
| Ground Weapons 1-3 (100/100, 175/175, 250/250+50 Alloy; 60/75/90 s; tiers 1/2/3) | stats.mjs `levelTrack` | No | No (+1 damage: no reader in combat.mjs) | not shown |
| Ground Hide 1-3 (125/125, 220/220, 315/315+50 Alloy) | stats.mjs | No | No (+1 armor: no reader) | not shown |
| Air Weapons 1-3, Air Hide 1-3 (same costs) | stats.mjs | No | No (no air units on /play) | not shown |
| Drift Sense (100/50, tier 1) | stats.mjs | No | No (Drift is off on /play) | not shown |
| Deep Claim, Hold Fast (tier 2) | stats.mjs | No | No (no claims reader) | not shown |
| Drill Speed 1-3 (tiers 2/2/3; 100/50, 150/75, 200/100/25) | stats.mjs, `requires` chain | No | No (Drill not a /play button; no reader) | not shown |
| Track Speed, Bigger Buffers (tier 2) | stats.mjs | No | No (no reader) | not shown |
| Twin Press (tier 3, 200/100/50) | stats.mjs | No | No (Press not a button) | not shown |
| Coil: Sidewind, Long Strike, Swimmers, Shed Skin (tier 2) | stats.mjs | No | No (Swimmers reads `state.research`, classic only) | not shown |
| Coil: Venom, Constrict (tier 3) | stats.mjs | No | No | not shown |
| Burrow: Tunnels (tier 2; effects.mjs:102 reads research) | stats.mjs | No | No (classic only) | not shown |
| Burrow: Thick Hide, Cube Press, Bank Up (tier 2) | stats.mjs | No | No | not shown |
| Burrow: Undermine, Rumble (tier 3) | stats.mjs | No | No | not shown |
| Kitchen panel tech info | `play/kitchen-panel.mjs` BOXES | n/a | n/a | No tier, research or Assembly Line box; greyed boxes show Wheat cost and hotkey only |
| TECH-TREE.md research lists | generated from stats + tiers | n/a | n/a | lists 5 tier 1, 18 tier 2, 10 tier 3 upgrades (I counted 33 in data: matches). Does not say they are classic-only |

## Discrepancies found
1. TECH-TREE.md, Tier 2 and Tier 3 sections, describe the GHT Hold rule (Hold 3, Hold 6, Foundry/Sanctum/Hangar). /play uses kitchen rules instead. Example: TECH-TREE gives Four-Slice (brute) as "Hold 3"; `toasterTiers[3]` puts brute on "Needs a Windmill or Dam". Flak Popper (spiker) and Popper (grunt) are "Hold 3" in TECH-TREE but "Needs a Toaster" in code. The file does not say which rule applies to which mode.
2. TECH-TREE.md "Research:" lines list upgrades as if /play had them. It has none.
3. toaster-play.mjs comments at lines 5 and 126 say the side panel is a tier readout. The code returns '' there.
4. The tier gate on /play is UI-only (`input.mjs`), not in the sim. A command sent past the card is accepted (sim-territory.mjs:199 with `noTiers`). Worth knowing before anyone calls it enforced.
5. research-card.test.mjs uses ids like `weapons-1`; the real ids are `weaponsGround1` style (stats.mjs:38). The test does not check the real table.
6. Kitchen tier 2 needs `complete === true` for a Toaster (tiers.mjs:60), but the power check (line 63) does not check `complete`. Not verified in the sim: may be fine.

## Comparison with StarCraft II (Liquipedia)
- Liquipedia fetch: https://liquipedia.net/starcraft2/Upgrades returned HTTP 403 to WebFetch. Not verified on a fetched page. Also https://liquipedia.net/starcraft2/Forge and /Armory returned 403. A fandom mirror returned 402. Only search snippets are available.
- From the search snippet (not fetched): Liquipedia lists Level 2 and Level 3 of most categories as needing an extra tech building; a mirror gives Forge Ground Weapons L2 150/150 and L3 200/200 with a Twilight Council prerequisite (Protoss, patch 1.4.2 note). Marked UNVERIFIED.
- Structural comparison (from the code, not from SC2 sources): SC2 has one research building per race with a queue; GHT has no research building on /play, and its tier gates are per button (a unit needs a Toaster or a Windmill). The closest analogue to an SC2 tech building is the Toaster itself. The GHT Foundry/Sanctum/Hangar design is the SC2-like one, and it is not built.
- SC2 gates Level 2 and 3 upgrades behind a tech building; on /play the numeric upgrades have no building at all, so the analogy stops at the card.

## Associations for the hive
- The gap between data and play is the whole M9 story: 33 upgrades, 0 buyable, 0 effective on /play. The only live tech system is the kitchen gate, and it is UI-only.
- Connects to HIVE correction 1 (no research on /play) and correction 6 (Popper/Zapper/Four-Slice stats): the costs in the kitchen list match STATS.structures and STATS.units.
- If the team wants SC2-style upgrades on /play, the first step is not the upgrade table. It is a research building card entry and a sim gate (`doResearch` with `noTiers`) that the sim actually calls. Without it, the Weapons/Hide cells are data only.

## Not traced
- Veterancy ranks and Keepsake list in stats.mjs:387-398: not traced on /play.
- Command-card text in input.mjs beyond the lock lines: not traced in full.
- Live play in a browser: not run (headless rules in memory).
