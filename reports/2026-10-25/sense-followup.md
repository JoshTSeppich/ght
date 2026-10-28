# Sense follow-up (haiku, 2026-10-25)

Report only. No game fix is in here. Probes are beside this file; the match runs use the page's real setup: `createPlayableState`, Wheatfield, seed 7, the page's default opponent `players/toaster-easy/bot.mjs` (play/opponent.mjs:19), `maxTicks` 21600, easy.

Marks: **VERIFIED** = run here and the output is quoted. **UNVERIFIED** = not run, or run but the cause is not pinned.
Not eyeballed in a browser: everything below. These are sim runs in node, not the play page.

## 1. Idle match vs toaster-easy (seed 7)

Command: `node reports/2026-10-25/idle-match.mjs nothing 7` and `... idle-hook 7`. Wheat is `[ours, theirs]`. Strip hp is `[ours, theirs]`. Printed every 2 minutes.

**Variant "nothing" (player does nothing, no auto-gather)** — VERIFIED
```
min 2: wheat [100,100]   units [6,6]   stripHP [2400,2400]
min 4: wheat [100,845]   units [6,6]   stripHP [2400,2400]
min 6: wheat [100,1316]  units [6,12]  stripHP [2400,2400]
min 8: wheat [100,2377]  units [6,12]  stripHP [2400,2400]
ended {"winner":1,"reason":"core","tick":13867,"value":[100,3621]}  final 9.63 min
```
Our Strip falls between minute 8 and 9.63. Enemy wins by Strip kill, not by timeout.

**Variant "idle-hook" (player's idle Crumbs auto-gather, as the page does)** — VERIFIED
```
min 2:  wheat [2130,100]   units [6,6]   stripHP [2400,2400]
min 4:  wheat [3945,845]   units [6,6]   stripHP [2400,2400]
min 6:  wheat [5345,1316]  units [6,12]  stripHP [2400,2400]
min 8:  wheat [7170,2377]  units [6,12]  stripHP [2400,2400]
min 10: wheat [7995,2025]  units [0,14]  stripHP [1580,2400]
ended {"winner":1,"reason":"core","tick":17230,"value":[7995,4029]}  final 11.97 min
```
- Wheat rises about 900 per minute with idle Crumbs. This is the flood in WHAT-IS-LEFT decision B. Both variants end by Strip kill, not by the 15:00 timeout, so decision A is not what decides these two runs.
- The bot's first Strip damage is near 9 min, after the 8:00 squad (matches its header comment).

## 2. Scripted minimal build (Mill, Well, Toaster, 3 Poppers by 3:00)

Command: `node reports/2026-10-25/minimal-build.mjs 7`. Our idle Crumbs auto-gather as the page does. Build sites: Mill at 19,227; Well at 12,224 (within 4 tiles of the home spring); Toaster at 19,232; Assembly Line (`forge`, 150 wheat) at 13,227. Poppers are trained at the Assembly Line.

- Build queue times: Mill 0.0 s, Well 2.6 s, Toaster 10.2 s, Assembly Line 20.6 s. Assembly Line complete 24.3 s. Poppers queued 26.2, 31.1, 35.5 s. At 3:00: Mill, Well, Toaster, Assembly Line all standing, 3 Poppers, wheat 2337. — VERIFIED
- **First toast baked at 23.0 s** (4 slices, stack 12). — VERIFIED
- Pilot-light bakes: 0. The stack never fell under the floor. — VERIFIED
- **Does the bot attack?** Yes. First enemy hits on our side at 542 s (9:02), then a steady stream; our Strip is destroyed before 10:41 (`ended ... "core"`, final 10.68 min). Our three Poppers were never ordered to move; the probe does not command fighters. — VERIFIED that the bot attacks at 9:02 and wins by Strip kill. UNVERIFIED how much our Poppers would have held back with orders, because the probe gave none.
- Note on the probe: a build order replaces a builder's order, so the probe gives each site its own Crumb. Two early versions gave all sites one Crumb and the Mill never finished; that was a probe bug, fixed before the numbers above.

## 3. Why a hungry Popper was resupplied in 0.1 s (sense.md row 8)

Probe: `node reports/2026-10-25/popper-resupply.mjs <distance>`. A Popper (`grunt`) is emptied next to our Strip, one idle Crumb is at the Strip, stock is above the reserve.

| Popper distance from Strip | Resupplied after | Event |
|---|---|---|
| 2 tiles | 0.08 s (tick 2) | `run` then `resupply` |
| 10 tiles | 0.42 s (tick 10) | `run` then `resupply` |
| 25 tiles | 1.04 s (tick 25) | `run` then `resupply` |

- **Cause: a normal Crumb run, not the lifeline.** VERIFIED. `assignRuns` (env/ammo.mjs ~line 242) sends an idle Crumb to the neediest powered fighter: `oneWay = max(1, ceil(distance(core, unit) * worker speed))`, and the slices arrive at `tick + oneWay`. Worker speed is 1 tile per tick, so a Popper two tiles from the Strip is topped up in two ticks (0.08 s).
- The lifeline is not involved: `stepLifeline` waits `lifelineSeconds` (20 s) and needs no Crumb to be running. The 0.1 s case never reaches it. VERIFIED by the 0.08 s figure against the 20 s interval.
- What this means for the stranger: a Popper that stands near the Strip shows Hungry for about 2 ticks. The chip is in the HUD for that long, so a player may never see it. The sim is consistent with its own rules; the question is whether the "Hungry" cue should last longer. That is a design call, not a bug. UNVERIFIED how the HUD draws a 2-tick state.

## 4. Chat #833: a Well giving no water

Repro: `node --test reports/2026-10-25/well-water.repro.test.mjs`. Four tests on the real playable state:

1. Sim and ghost agree on springs and creek water for Wheatfield seed 7. — VERIFIED (passes).
2. A Well on a ghost-green tile in reach of the home spring makes water within 60 s, not dry. — VERIFIED (passes).
3. A Well on the home spring tile itself is not dry and makes water within 60 s. — VERIFIED (passes).
4. A Well with no spring or creek in reach is dry, and the ghost says `far-from-water`. — VERIFIED (passes; the first draft used the corner tile 2,2, which is creek itself, so the probe picks a real dry tile).

**Verdict: does not reproduce at the rule level.** A complete Well by the spring makes water within 12 s (the spring draws every second 6 s beat, see env/bakery.mjs).

What the repro does NOT cover (so the chat report is still open):
- The build path: the Well starts as a construction site and only draws once complete. The repro adds a finished Well. UNVERIFIED that a human-placed site completes near the spring within the time Joshua saw.
- The page's own placement call (play/input.mjs placeCheck) with the real click. UNVERIFIED.
- The Toaster: the chat showed flour going 1 then 0 with water 0. Flour is taken only when water is at least 1 (env/bakery.mjs), so the report's numbers are not explained by the sim rules shown here. UNVERIFIED.
- Needs a browser run on /play?edition=off&mode=sandbox to see the real ghost and pantry. Not eyeballed in a browser.

## 5. Other things found while doing this (not fixed)

- `env/live.mjs:47` comment says "The AI still sees STATS.match.maxTicks in its observation." That is no longer true after the observation fix. The owner should update the comment (cross-owner line posted in chat).
- `research/TOY-EDGES-GPT.md` and `live/.compile-state.json` mention the removed flag. Not touched (not in haiku's file list). Harmless text.
- The `hit` event carries `id` (target) and `by` (attacker), with no `player` field. Anyone counting enemy hits by `e.player` gets nothing. The probe looks up owners instead.

## Files changed by this task

- `env/state.mjs` — observation `maxTicks` is `state.maxTicks` when set (valid positive integer), else `STATS.match.maxTicks`.
- `tests/observation-maxticks.test.mjs` — new, 4 tests (red first, then green).
- `play/coil-motion.mjs` — `coilEnabled` removed; header rewritten (the Coil motion was never flag-gated in `play/toaster-units.mjs`).
- `play/coil-motion.test.mjs` — NOT edited by haiku (sonnet's file). Its first test imports `coilEnabled`, so the file fails on import until sonnet applies the lines posted in chat. This is the only red left from this task.
- `reports/2026-10-25/` — new: `lib.mjs`, `idle-match.mjs`, `minimal-build.mjs`, `popper-resupply.mjs`, `well-water.repro.test.mjs`, this file.

Run `node reports/2026-10-25/<file>` from the repo root. None of these edit the repo.
