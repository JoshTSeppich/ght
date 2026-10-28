# Verify D: how matches end, pacing and offence

Verifier: Haiku 5.5, read-only, 2026-10-26. No game file, test or doc was edited. Replays were run in memory
(createTerritoryMatch + the logged commands); nothing was written except this report.

## Verdicts

**1. Losing the Power Strip loses the match: CONFIRMED.**
- Strip hp 2400: env/stats.mjs:167 (`coreHp: 2400`), applied in env/sim-territory.mjs:99 (enableHunger). Node: `createTerritoryMatch(7)` gives Core hp `[2400, 2400]`.
- Death removal: env/combat.mjs:114-117 (hp <= 0 removed from `state.structures`, `die` emitted).
- End check: env/sim.mjs:110-112 `if (!core0) return {winner:1, reason:'core'}` runs before the tick check (sim.mjs:114). step() runs combat, then `tick += 1`, then checkEnd (sim.mjs:82-86).
- It happens: matches/room/latest.json (toaster-sonnet mirror, seed 668) ends `reason: "core"`, tick 18272. The last event is `die` on id 2.

**2. Timeout at 15:00, scored by board value, bank breaks ties: CONFIRMED, with corrections.**
- 21,600 is the live/referee limit: env/referee.mjs:202 and 220, env/live.mjs:48, play/app.mjs:53 and 233.
- Correction: `STATS.match.maxTicks` is still 2000 (env/stats.mjs:97). A bare `createTerritoryMatch()` has `maxTicksOf` = 2000 (node), so it times out at 83 s. A territory win needs a 2160-tick countdown (territory.mjs:148), so it cannot fire before tick 2000.
- Scoring: env/sim.mjs:114-119 uses `timeoutValue` (sim.mjs:129-138): units at cost + complete structures at cost + Strip hp. The bank is used only on an exact tie (sim.mjs:117). `value` in the result is `sideValue` (env/stats.mjs:540-545), which includes the bank.
- The smoke match: live/compile.mjs:144-147 runs sample vs sample, seed 935, `--max-ticks 4320`. That is 3 game-minutes, not 15.
- Replay (node, in memory): tick 4320, `value [1080,1085]`, `score [2800,2800]`, shards `[680,685]`, winner 1. Each side has 8 units and an untouched 2400 Strip. Hold is `[1,1]`.
- So the score tie is real: 2800 = 2400 Strip + 400 of units each. Side 1 wins because it banked 5 more wheat. The rule is deterministic (no randomness), but the decision rests on 5 wheat. sim.mjs:113 marks this as "assumption A, Joshua to confirm".
- Trap: env/live.mjs:136 `rerun()` replays with classic `createMatch`, so it does NOT reproduce this log (node: winner null, value [300,300]). Use `createTerritoryMatch`.

**3. Territory win on /play, bot matches, or nowhere: PARTLY.**
- It is active wherever `createTerritoryMatch` runs: /play (play/toaster-play.mjs:24, 60; play/app.mjs:229-233 via createLiveMatch) and bot matches (env/run-match.mjs:20 `territory: true` by default; env/referee.mjs:216). Hook: env/sim-territory.mjs:263 `stepRulesPost` -> env/territory.mjs:94-163.
- Threshold is 14 on every map: env/territory.mjs:7 (`winCount: 14`), pinned by tests/territory.test.mjs:173-176.
- Wheatfield has 31 Reaches (node: `reachLayoutV4(chosenMap())` length 31). 14 of 31 is 45%. The map's own `winCount` (maps/layout-sizes.mjs `winCountFor(31)` = 21, set at env/map.mjs:77) is never read (grep: only env/map.mjs and env/territory.mjs mention winCount).
- Bot logs: `hold-gained` appears 2 times in each whole 21,600-tick log (m7, s1, s7, s472). A 14-Reach win was never close.

**4. Pushing power to the enemy costs ~30 boxes, 900 Wheat, 9.5 min: PARTLY (inputs right, framing and time wrong).**
- Inputs: env/power.mjs:26-28 (extension range 12, cost 30; strip range 14). Node: Strips at (18,232) and (237,23) on seed 7, Chebyshev 219.
- Link rule: env/power.mjs:58-60 (max of the two ranges). Placement needs an owner's own point in range: `doPlaceCord`, env/power.mjs:194-224. Boxes never link to enemy points, so power is not "pushed" to the enemy at all.
- Build time: none. `doPlaceCord` inserts the box at once (env/power.mjs:219-222). `buildTicks` does not apply, so "9.5 min" is not a build time.
- Box count (arithmetic): box n sits 14 + 12(n-1) tiles from the own Strip.
  - Within SIEGE = 6 of the enemy Strip (players/toaster-easy/bot.mjs:196): 14 + 12(n-1) >= 213, so n = 18, cost 540 Wheat (30 each). The review's "18 boxes (UNVERIFIED)" matches this arithmetic.
  - Within 14 of the enemy Strip: n = 17, 510 Wheat.
  - 900 Wheat = 30 boxes is the bot's actual build with detours (creek and cliffs), not a minimum.
- Walking: worker speed 2 (node `rowOf(s,'worker').speed` = 2, one tile per 2 ticks = 12 tiles/s). 213 tiles is about 18 s in a straight line.
- So 9.5 min cannot come from the code's build or walk times. It is Wheat income plus the bot's sequencing. At the review's 175 Wheat/min (its figure, not checked here), 540 Wheat takes 3.1 min and 900 takes 5.1 min. The 9.5 min is UNVERIFIED.

**5. Bot matches almost never kill a Strip: PARTLY (true for the logs read, but one counter-example).**
- Recorded end reasons: 7 timeouts (matches/latest.json, sample-1, sample-7 at 2000 ticks; m7, s1, s7, s472 at 21,600 ticks) and 1 `core` kill (matches/room/latest.json, toaster-sonnet mirror, seed 668, tick 18272).
- Strip hits in the four 21,600-tick logs: 0 (node: hits on ids 1 and 2 = 0; seeds 1, 7 and 472 have Strips at ids 1 and 2). Total hits per log: 0-32.
- Attack rules:
  - toaster-easy (players/toaster-easy/bot.mjs): no Strip attack before 10:00 (`NO_STRIP_BEFORE` = 14400, line 188). It pushes boxes toward the enemy Strip and attacks only when the chain tip is within SIEGE = 6 and tick >= 14400 (lines 539-552). Retreats to the nearest station when a move is refused (lines 14, 292-313).
  - builtin (players/builtin/ai.mjs): first wave at tick 2400 (normal) or 4800 (easy). Waves go when army >= 8 (or 12) with enough power, or when the clock passes 4800 (or 6600) with army >= 3 (or 5) (lines 18-19, 303-305). Retreats when army <= 1, or when its power is under 0.6x the foe's before 2 x waveByTick (line 306). Targets, in order: enemy army within 9, enemy units within 8, production within 6, then the enemy Core (lines 328-335).
  - fable and haiku (identical structure): attack until fighters fall below `minArmyToKeepAttacking` or their value falls below 0.6x the enemy's (bot.mjs:33, 230). Target rank: turret 0, forge 1, Core 2, rest 3 (bot.mjs:321). The Strip comes last among structures.
  - sonnet (players/sonnet/bot.mjs:268-271): production (non-core, non-turret) before the Core. Pulls the army home when enemies come within 10 of the Core (line 236).
- So no bot picks the Strip first, and toaster-easy waits until 10:00. The review's claim that seed 7 had "no attack ever happens" (review-systems.md:42) matches the logs.

**6. Kill times: CONFIRMED for the arithmetic; four Four-Slices are ammo-bound, not hp-bound.**
- 10 Poppers (grunt toaster row: range 4, shot 20 every 36 ticks, structure x1; node `rowOf`; combat.mjs:88-89 and 98): 200 damage per 36 ticks = 133 hp/s. 2400 hp falls in 18.0 s (432 ticks). That needs 120 shots, 12 each. Storage is 6 slots x 3 shots = 18 shots per Popper (env/ammo.mjs:48, 57-59), so no resupply is needed. Assumes all ten are in range 4 and not distracted: `chooseTarget` takes the nearest enemy in range first (combat.mjs:58-68).
- 4 Four-Slices (brute: shot 36 every 30 ticks, structure x2 gives 72 per shot): 4 x 72 per 30 ticks = 230 hp/s, so 10.4 s (250 ticks), but only if fed.
  - Damage is one hit per attack, not per slice (combat.mjs:88-107). Quad Volley spends 4 slices (env/ammo.mjs:50, 184-188). No x4 is applied to damage.
  - Storage is 8 slots = 2 volleys per brute, so 8 volleys = 576 damage before they go hungry. A 2400 kill needs 34 volleys = 136 slices in about 10.6 s, which is about 13 slices/s. The ammo.mjs:59 comment gives 48 per minute per Toaster (0.8/s), so about 16 Toasters must run. Four Four-Slices cannot realistically kill a Strip in 10 s.

## Associations (docs, tests, HUD vs code)
- TERRITORY.md:51 says "14 of 21 for 90 s". TERRITORY.md:324 and 332 say "two-thirds rounded up, 14/21/28 (winCountFor)". The docs disagree with each other. The code uses 14 everywhere.
- review-systems.md:34-42 (timeout tie 3525/3525 on seeds 1, 7, 472; winners decided by 3-7 Wheat). Consistent with sim.mjs:117. My smoke replay shows the same mechanism.
- review-systems.md:7 "30 boxes, 900 Wheat, 9.5 min" and line 74 "18 boxes (UNVERIFIED)": 18 is confirmed as arithmetic for SIEGE. 30 and 9.5 min are not derivable from the code.
- SYSTEMS-DESIGN.md:35 lists "E1 timeout score order" as pending Joshua. The code is still the bank tie-break. Docs and code agree that this is open.
- tests/timeout-value.test.mjs (lines 23-41): bank not counted, Strip hp counted. Agrees with code.
- tests/sim-end-conditions.test.mjs (lines 85-182): uses `STATS.match.maxTicks` (2000). It tests the classic clock, not the 21,600 live clock.
- tests/toaster-pacing.test.mjs:66-71: the 10-minute floor and "never early" sweep is skipped unless PACING_SWEEP=1. Not run here.
- HUD, play/results-card.mjs:24-28: `WHY` has only timeout, forfeit and both. A territory win (`reason: 'territory'`, territory.mjs:155) falls through to `WHY.both` and shows "Both Power Strips fell." (results-card.mjs:57). Docs and HUD disagree.

## Missed (why matches don't end)
- **Territory threshold is 14 on all maps** (env/territory.mjs:7). Wheatfield's own winCount (21) is computed (env/map.mjs:77) but never read.
- **Results card shows "Both Power Strips fell." for a territory win** (play/results-card.mjs:24-28, 55-57).
- **Bare territory states end at tick 2000** (env/stats.mjs:97), before the 2160-tick territory countdown can finish. Any caller that skips the referee or live driver never sees a territory or 15-minute result.
- **`rerun()` replays classic `createMatch`** (env/live.mjs:136-143), so it cannot verify territory logs. Anyone checking claim 2 with it gets a false mismatch.
- **Bots target the Strip last.** fable, haiku and sonnet rank production and turrets first. A timeout is decided by Strip hp (2400 of the 2800 smoke score). Turtling keeps the score, so exact ties are common.
- **Offence is ammo-bound.** Four-Slices hold 2 volleys each, and Toaster output is about 0.8 slices/s. Popper storage is enough for a 18 s Strip kill, but a stalled bakery starves brutes. The kitchen (env/bakery.mjs), not the Strip hp, limits pushes.
- **Power boxes are instant.** The real limits are Wheat (540-900) and Crumb time spent placing and walking. Cord cuts (env/power.mjs:275-295) sever a push: the review says the best bot's push was destroyed after 8 shots.
- **"Almost never" is an overgeneralisation.** One of the 8 recorded results ended by Core kill (matches/room/latest.json, seed 668, tick 18272). Its replay was not checked here.
- **Smoke match is 3 minutes**, so its timeout at tick 4320 says nothing about the 15-minute rule.

## Not checked
- Replay of seed 668 (only its result line was read).
- players/fable and players/haiku results.json (one run each, all 2026-10-22, not tallied).
- The 9.5-minute and 175 Wheat/min figures (review-systems.md, not measured).
- The full 15-minute bot-vs-bot run (not run; the suite is not run per rules).
