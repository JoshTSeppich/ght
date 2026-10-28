# Verify A: upgrades, armor, research, breakpoints

Read-only crawl. No game file, test or doc was edited. Numbers come from `node -e` one-liners that import `env/stats.mjs`, `play/toaster-play.mjs`, `env/sim-territory.mjs` and `env/sim.mjs`.

## Claims

1. **PARTLY.** The level rows are right. "About 20 unit-specific researches" is wrong.
   - Level rows: `env/stats.mjs:32-51`. Weapons 100/175/250 Shards, Flux equal, Alloy 50 at level 3 (`:33`). Hide 125/220/315, Alloy 50 at level 3 (`:34`). Seconds 60/75/90 (`:36`). Hide rounding checks out: 175×1.25 = 218.75 → 220, 250×1.25 = 312.5 → 315.
   - Node: `UPGRADES.length` = 33, of which 12 are level rows.
   - Unit-specific rows (have a `unit` field): only 6. Sidewind/Fang `:67`, Long Strike/Spitter `:68`, Venom/Adder `:72`, Constrict/Charmer `:74`, Thick Hide/Bulldozer `:80`, Rumble/Thumper `:85`.
   - The other 15 non-level rows are land, mining, Coil-wide or Burrow-wide upgrades.

2. **PARTLY.** Entry points and what they do with research:
   - `switchOffDriftfall` is called only from `createToasterState` (`play/toaster-play.mjs:28`). `createPlayableState` (`:37`) wraps it. Research is off on the /play path. Node: `createToasterState(7)` and `createPlayableState(7)` both have `research === undefined` and `drift === undefined`.
   - **Research stays ON** in these paths:
     - `createReplayState` (`play/toaster-play.mjs:60`). It does not call `switchOffDriftfall`. `play/app.mjs:231` uses it for replay when there is no last record. Node: `research true, drift true`.
     - `createTerritoryMatch` (`env/sim-territory.mjs:74` calls `enableResearch`). Used by `env/referee.mjs:216` when `options.territory` is set, and by `play/territory-wire.mjs:12` for `?territory=1`.
   - **Research stays OFF** in `createMatch` (`env/sim.mjs`, the classic match). `env/live.mjs:137` and `:183` fall back to it, so the live compiler is off unless it passes `createState`.
   - Bots: `players/` has no `research`, `upgrade`, `Hide` or `Weapons` strings (grep empty). No bot emits a `research` command. The bots' territory matches have research on, but nothing uses it.
   - Match Room: `match-room/` has no code that touches research. Its matches come through the referee, so they are on only if `territory` is set.
   - The comment at `play/toaster-play.mjs:44` says "the bots' own matches keep them". That is only partly true, as above.

3. **CONFIRMED, with exceptions.**
   - `env/combat.mjs` (1-130) reads only `rowOf` fields: `shot.damage`, `shot.every`, `structureMultiplier`, `splash`, `range`. It never reads an upgrade, an armor value or a research effect.
   - No unit row has an `armor` key. The only `armor` string in env/play/players is the effect text at `env/stats.mjs:39`.
   - Never read anywhere: `armorBonus` (`:80`), `rangeBonus` (`:68`), `speedBonus` (`:67`), `stunSeconds` (`:85`). Also never read: `warnSeconds`, `claimBuildBonus`, `holdExtraSeconds`, `damage`/`range` on Hold Fast, `slow`, `holdSeconds`, `breakSeconds`, `wallHp`, `movesClaim`, `bufferBonus`, `loadsPerSecond`, `alloyPerCycle`, `floodSpeed`, `floodDamage` (in `stats.mjs`; `effects.mjs:13` has its own `floodDamage`).
   - Exceptions, where research is read by id instead of by field:
     - Swimmers: `env/effects.mjs:41` skips Flood damage. The half-speed field `floodSpeed` is not read.
     - Tunnels: `env/effects.mjs:102` and `:109`.
   - Chain mods: `modOf` (`env/economy.mjs:601`) reads drillSpeed, trackSpeed and buffer keys. `setChainMod` (`:596`) has no caller. So Drill Speed, Track Speed, Bigger Buffers, Cube Press and Twin Press do nothing, even with research on.
   - `env/tiers.mjs:137` pushes the finished id into `research.done`. Nothing else in the sim reads `weaponsGround1` … `hideAir3`.

4. **WRONG on the counts.** The direction holds, but the numbers do not match. Method: damage is `rowOf(state, kind).shot.damage` with `state.ammo` on. Target hp is `STATS.units[kind].hp`. Hits are `ceil(hp / dmg)`. The 42 pairs are 7 unit kinds × the 6 other unit kinds.
   - +1 damage per level, at level 3 (+3): **17 of 42** change, not 14. The figure 14 is what you get at level 2 (+2).
   - +10% per level, at level 3 (×1.3 rounded, or ×1.331 raw): **28** or **26**. None of my variants gives 25. Level 2 (×1.2) gives 23.
   - Sanity check: `rowOf(...).shot.damage` is 2, 20, 18, 36, 30, 15, 14 for Crumb, Popper, Zapper, Four-Slice, Broiler, Flak Popper, Bagel.

   **Power Strip** (2400 hp, `env/stats.mjs:167`, applied by `env/sim-territory.mjs:99`). Hits to kill, base / +1×3 / +10%×1.3. Structure multiplier applied to the shot, so +1 is multiplied too:
   - Crumb 1200 / 480 / 800
   - Popper 120 / 105 / 93
   - Zapper 134 / 115 / 105
   - Four-Slice 34 / 31 / 26
   - Broiler 54 / 49 / 42
   - Flak Popper 320 / 267 / 240
   - Bagel 172 / 142 / 134
   - Heat Lamp 200 / 160 / 150

   **Heat Lamp** (turret, 150 hp, shot 12 every 12 ticks). Hits to kill, base / +1×3 / +10%×1.3:
   - Crumb 75 / 30 / 50. This is the big one: +1 is +150% damage for a 2-dmg Crumb.
   - Popper 8 / 7 / 6
   - Zapper 9 / 8 / 7
   - Four-Slice 3 / 2 / 2
   - Broiler 4 / 4 / 3
   - Flak Popper 20 / 17 / 15
   - Bagel 11 / 9 / 9

   What changes: the flat +1 is strongly non-linear. It is huge on the weakest hitters and small on the strong ones. Percent scaling is smoother. Neither changes anything in the live game, because no upgrade is ever bought (see Missed).

5. **CONFIRMED, with a correction.** Popper hp 60 (`STATS.units.grunt`), Pop Shot 20 (`env/stats.mjs`, Toaster overlay). That is 3 shots. Shots are 36 ticks apart. Shot 1 lands at tick 0 and shot 3 at tick 72, which is 3.0 s at 24 ticks a second. So "3 shots, about 3 seconds" holds.
   - **Correction:** `PLAYABLE.md:30` says a Popper fires "every 0.75 s, so about 80 slices a minute". The code says every 36 ticks = 1.5 s, so about 40 a minute. The doc is wrong.

## Associations

Truth column is for /play today.

| Where | What it says | True on /play? |
|---|---|---|
| `TECH-TREE.md:20, 39, 56` | Lists research per tier with no "not in this build" flag | **No.** Research is off on /play and no UI can buy anything. |
| `PLAYABLE.md:30` | Popper fires every 0.75 s | **No.** It is 1.5 s. |
| `PLAYABLE.md:33-36` | "Leftovers still switched on": Drift, market, tiers, upgrades with no Alloy | **Stale.** `tests/toaster-no-leftovers.test.mjs:12` asserts all of these are off. Only the upgrades line is still roughly true, and only because research is off. |
| `TERRITORY.md:84-86` | Tier table with weapons/hide levels | Design text, not a /play claim. Untrue on /play. |
| `TERRITORY.md:92-132` | Upgrade tables | Design. Only Swimmers and Tunnels have live effects. |
| `TERRITORY.md:216` | "play/: … research card" | **No.** `play/research-card.mjs` has no importer except its own test. |
| `TERRITORY.md:230` | Quakestone gives Hide upgrades | Design only. |
| `UNITS.md:13` | Brute "heavy armor" tag | Flavour text. No armor stat exists. |
| `ECONOMY.md`, `SYSTEMS-DESIGN.md` | Grep for upgrade/research/Hide/Weapons/armor | Nothing mentioned. |
| `COMBAT.md` | No upgrade or armor text | n/a |
| `play/research-card.mjs` (title = `u.effect`) | Card with cost, time, state | **Not rendered anywhere.** |
| `play/research-card.test.mjs` | Tests the unrendered card | Passes in isolation. Not run here. |
| `play/toaster-play.mjs:44` | "no research (its upgrades cost Flux and Alloy)" | True on /play. "The bots' own matches keep them" is only partly true. |
| `env/economy.mjs:594-595` | Lists drillSpeed, trackSpeed, buffer, pressOut as set by research | Setter never called. Dead. |
| HUD (`play/hud*.mjs`), teach text, Kitchen panel, command card, input, tutorial, hud-tips | No upgrade, research, Hide, Weapons or armor text | n/a. Nothing to be true or false. |
| `players/` (bots) | No research strings | n/a. Bots never research. |
| `tests/toaster-no-leftovers.test.mjs:12, 19` | Research undefined on /play, present on classic | **True.** |
| `tests/sim-tiers-research.test.mjs:69-116` | Queue, pay, finish, reject, debt pause; default createMatch rejects research | **True** for the sim. Says nothing about any UI. |
| `tests/tech-tree-doc.test.mjs:69-72` | Every upgrade appears under its tier in TECH-TREE.md | Doc parity only. |
| `tests/stats-territory.test.mjs` | Table parity with TERRITORY.md | Doc parity only. |
| `tests/economy-chain.test.mjs`, `tests/sim-flood-tunnels.test.mjs` | Mention research | **UNVERIFIED.** Not read in full. |

## Missed

- **The replay path keeps research and Drift on.** `createReplayState` (`play/toaster-play.mjs:60`) does not call `switchOffDriftfall`. `play/app.mjs:231` uses it for replay when there is no last record. The comment at `:44` does not mention replays.
- **No UI can issue a research command, on any page.** `grep` finds no `research` command, card, hotkey or button in `play/` or `players/`. The only emitter is raw commands in tests. So "research is off on /play" is moot: no route to buy an upgrade exists, even in classic or territory.
- **Hide and Weapons do nothing in combat, even with research on.** `env/combat.mjs` never reads them. Only Swimmers and Tunnels are read by id. The claim in the task implies the combat path is wired, and it is not.
- **Five upgrades are dead even where research is on.** Drill Speed 1-3, Track Speed, Bigger Buffers, Cube Press and Twin Press write to `setChainMod`, and nothing calls that function.
- **Swimmers is half-done.** The flood-damage skip works (`effects.mjs:41`). The half-speed `floodSpeed` is not read.
- **The hits-to-kill claim ignores ground vs air.** Ground Weapons only affects ground attackers. The counts above include all attackers, so they overstate what a single upgrade changes. Not important, but it would change the 17/42 figure.
- **The +10% reading is ambiguous.** Additive (×1.3) and compound (×1.331) give different counts (28 vs 26). The report should say which one the design means. `TERRITORY.md` says "+1 damage per hit" for weapons, and percent is not spelled out.
- **Two stale docs cite the same wrong Popper rate.** Check `PLAYABLE.md` and any doc quoting "80 slices a minute".

Report written by Haiku 5.5, verification only. No game file, test or doc was changed.
