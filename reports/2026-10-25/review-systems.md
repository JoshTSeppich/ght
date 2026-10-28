# Fresh systems review: do GHT' rules form a game? (2026-10-25)

Reviewer: fresh RTS systems designer, no prior context. Everything below is VERIFIED (I ran it; output quoted; probe scripts are in reports/2026-10-25/, named `systems-*.mjs`) or marked UNVERIFIED. Nothing in the repo was edited. The harness is reports/2026-10-25/lib.mjs, used as is (the real page match: `createLiveMatch`, `createPlayableState`, `toaster-easy`, fake timers).

## 1. Verdict

**Not yet a game; it is a well-built economy with no ending.** The kitchen is a real first five minutes: first toast at 65 s, a clear 175 wheat a minute, a continuous fight that costs real money. But I ran six full 15-minute matches (three easy-vs-easy, three toaster-sonnet-vs-easy) and **no Power Strip died in any of them; all six ended in a timeout.** In the mirror the timeout score was an exact tie (3525 vs 3525), so the winner was decided by the wheat bank, the one thing today's change said the score no longer uses. The cord leash works as designed (a push needs about 30 Extension Boxes, 900 wheat, and 9.5 minutes of Crumb walking), but it makes attacking so expensive and so cuttable that the best bot's only push was destroyed after firing 8 shots. A Popper rush at 4:00 is not just weak, it is impossible. The result is a safe game with no reason to leave home. Two separate bugs hide the real balance: extra Crumbs earn nothing under the page's auto-gather, and the timeout scoring rewards turtling.

## 2. The numbers I measured

**(a) Time to first toast.** Seed 7, scripted sensible opening (Mill at 0:00, Well at 10.9 s, Toaster at 57.5 s, Assembly Line at 118 s), Crumbs on the page's auto-gather (`minimal-build.mjs`):
```
0.0 s: queue mill (cost 75, wheat 100)   10.9 s: queue well   57.5 s: queue toaster (cost 100)
65.0 s: FIRST TOAST baked (4 slices, stack 12)
118.3 s: queue forge   122.5 s: Assembly Line complete   146.8 s: Popper 1   180.0 s: wheat 2, Poppers 2
```
The bank, not build time, sets the pace: wheat is at 0-2 for most of the first 3:00. Two Poppers at 3:00.

**(b) Wheat income, 6/8/10 Crumbs** (`systems-income.mjs`, nothing built, bank at each minute, per-minute gain for minutes 2-6):
```
page auto-gather (idle-Crumb hook):  6 Crumbs: 175,170,170,175,175   8 Crumbs: 175,175,175,160,175   10 Crumbs: 175,175,175,160,170
Crumbs sent to different wheat tiles: 6: 180,175,190,175,175   8: 235,230,250,225,235   10: 295,290,305,285,295
```
**Finding: under the page's own auto-gather, Crumbs 7-10 add zero income** (about 29 a minute at 6, 22 at 8, 17 at 10). The debug probe shows all ten Crumbs ordered onto the same tile (24,227), with only about six able to work it at once. Spread over several tiles, income is linear at about 29.5 per Crumb per minute (175 / 235 / 295). The 28 a minute target in ECONOMY.md is correct for 6 Crumbs and for nothing larger. (Cause "one tile, six work slots" is inferred from the order dump: UNVERIFIED as a rule; the effect is VERIFIED.)

**(c) What 167 wheat a minute buys** (`systems-army-math.mjs`, plain arithmetic on STATS, Poppers at 75, upkeep 5% of cost a minute, kitchen of 375 paid by 1:30, buying from 2:30; the Mill-draw assumption is mine, UNVERIFIED as a player pattern):
```
All wheat to Poppers:          8:00 = 12 Poppers (upkeep 45/min)   12:00 = 18 Poppers (upkeep 67.5/min)
2 Mills feeding toast (-60/min): 8:00 =  7 Poppers                  12:00 = 11 Poppers
3 Mills (-90/min):               8:00 =  4 Poppers                  12:00 =  7 Poppers
```
Upkeep alone eats the whole income at 45 Poppers (29 if 2 Mills draw 60), so the 40-unit cap is never what limits you. A Popper in a continuous fight costs 13.3 slices x 2.5 = 33.3 wheat of toast plus 3.75 upkeep = 37 wheat a minute: **167 a minute feeds only four Poppers in a nonstop fight.** Toast, not wheat, is the real limit, as ECONOMY.md says.

**(d) How a 15:00 timeout is scored.** env/sim.mjs:104-123: Cores gone decides first; at `maxTicks` (21600 = 15:00) `timeoutValue` (env/sim.mjs:129) = units at cost + complete structures at cost + the Power Strip's remaining hp. The bank breaks only an exact tie. Extension Boxes, generators and fences are not structures (`valueOf`, env/stats.mjs:521), so they score 0. **The Strip's 2400 hp is 2400 of a typical 3500 points**, worth 32 Poppers. So a side that keeps its Strip and its small army wins; a side that spends 900 on a box chain and loses its army scores worse. Turtle beats rusher by construction unless the rusher actually damages the Strip (1 hp = 1 point). Easy-vs-easy proves the tie case is the normal case: seeds 1, 7, 472 all ended `"reason":"timeout","tick":21600,"score":[3525,3525]` and the bank picked the winner (`value` [1077,1070], [1067,1070], [1072,1070] gave winners 0, 1, 0).

**(e) toaster-easy vs toaster-easy** (env/run-match.mjs, p0 and p1 both `players/toaster-easy/bot.mjs`):
```
seed 1:   {"winner":0,"reason":"timeout","tick":21600,"value":[1077,1070],"score":[3525,3525]}
seed 7:   {"winner":1,"reason":"timeout","tick":21600,"value":[1067,1070],"score":[3525,3525]}
seed 472: {"winner":0,"reason":"timeout","tick":21600,"value":[1072,1070],"score":[3525,3525]}
```
Same end time (15:00), same reason, exact score tie, three different winners decided by 3-7 wheat. Seed 7 command log: first train at 172 s, only 3 Poppers all game, the box chain starts at 8:00 and reaches 14-15 boxes (about 168 tiles of the 219 between Strips) by about 11:40; no attack ever happens. I also ran toaster-sonnet (p0) vs toaster-easy, seeds 1/7/472: all three `timeout`, winner 0, score [4060,3525] / [3660,3375] / [3710,3375].

**(f) Popper rush at 4:00.** Not possible. The Strips are 219 tiles apart (map 256x256, Strips at 18,232 and 237,23, VERIFIED `systems-probe1.mjs`). Poppers cord 12, so they cannot walk the map without a built chain. The best bot (toaster-sonnet, seed 7) placed 30 Extension Boxes between 2:07 and 11:35 (`place-power` x30) and attacked at 10:00. The defender already has toast at 1:05 (a), plus the Strip's reserve, so "before the defender has toast" can never be true. Dropping 6 fed Poppers at the enemy Strip at 4:00 by hand (a cheat, `systems-rush.mjs`) took the Strip from 2400 to 1660 in 10 s (31%); then my hand-made chain failed to hold their power and they went dark (`battery` at 10 s, `down` at 20 s), so I cannot say from this probe how long a properly connected squad needs. Extrapolating, six Poppers kill a Strip in roughly 30-40 s of fire if fed (UNVERIFIED; a 36-slice load is borderline). The cheat shows the Strip is killable; the leash is what stops it.

**(g) The cord leash across the map.** Chain cost, from the real bot: **30 Extension Boxes = 900 wheat**, placed over 9.5 minutes (2:07 to 11:35). The straight-line lower bound is 219 / 12 (box link range) = about 18 boxes = 540 wheat (UNVERIFIED arithmetic; the bot needs 30 because cords bend round rocks, `cord-wrap.mjs`). 900 wheat is 5.4 minutes of the whole 6-Crumb income, or 12 Poppers. What happened to the push (events log of seed 7, p0 = sonnet): its 8 fighters got **8 shots in the whole match** (`shot:p0 8`, 599-601 s), then 8 `cord-cut`, 7 `power-down`, 64 `plug-start` and 64 `plug-fail` events (569-843 s). Easy's 24 shots killed the squad by 14:13. The defender's counter to a 900-wheat push is a few cheap cord cuts.

## 3. The five changes that would most improve pacing and counters

| # | Change | File and number | Size | One-line test |
|---|---|---|---|---|
| 1 | **Fix auto-gather so extra Crumbs earn.** Spread idle Crumbs over the nearest N wheat tiles (about 3 per tile) instead of one. Right now Crumb 7+ is 50 wheat for 0 income. | play/idle-crumbs.mjs: one target tile today; target `ceil(crumbs/3)` nearest tiles. Optional: a per-tile worker cap in env/economy.mjs mining. | S | Extend tests/passive-income.test.mjs: 6, 8, 10 Crumbs must give 170-180, 230-240, 290-300 a minute (today 175 / 175 / 175). |
| 2 | **Make a timeout need a reason to attack.** Count Strip hp x2 (or add damage dealt to the Strip) and stop counting a side's unspent Crumbs and buildings above a cap, so a turtle with a full Strip no longer beats a raider who hurt it; make the tie-break "damage dealt" not the bank. | env/sim.mjs:129 `timeoutValue`: core term from `hp` to `2 * hp`; tie-break at env/sim.mjs:114 from `state.shards` to damage dealt. | S | Seeds 1, 7, 472 easy-vs-easy must no longer end `score` equal; a bot that lands 600 Strip damage beats the same bot that turtles. |
| 3 | **Shorten the chain, keep the leash.** Raise the Extension Box reach so a push takes about 18 boxes, not 30 (and walking time falls from 9.5 minutes to about 6). The cost 30 can stay. | env/power.mjs:27 `range.extension` 12 to 16, and the place step `linkRange` (env/power.mjs:59); `cord.grunt` 12 to 14 (env/economy-table.mjs:26). | M | Rerun toaster-sonnet vs toaster-easy: first Strip damage must come before 8:00 and the chain must be at most 20 boxes. |
| 4 | **Give the defender a cheap, visible cord-cut and the attacker a cheap re-plug**, so a push is a fight, not a coin flip. Today 64 `plug-fail` against 8 `cord-cut` means a re-plug nearly always fails. | cord-cut: `POWER.plugTicks` and the plug-fail rule in env/power.mjs (`plugging`); batteryTicks 240 to 360 (env/power.mjs:30). | M | Scripted push of 8 Poppers + 2 Crumbs against 2 defenders with cord cuts: attacker wins 40-60% over seeds 1-20, not 0%. |
| 5 | **Let toast, not wheat, be the visible constraint at 6-8 Crumbs.** Two Mills should keep 4 Poppers fed; at 167 a minute you can fund 7 Poppers at 8:00 (2 Mills) but feed only 4 in a fight. Raise Mill output so a 7-Popper squad is fed: 10 wheat to flour every 20 s to every 15 s. | env/economy-table.mjs Mill 20 s to 15 s (a Mill then makes 4 flour = 16 slices a minute) and Popper `slices held` 6 to 8. | S | A 7-Popper squad at 8:00 must fire for 60 s without a hungry unit when 2 Mills have run since 2:00; income-to-toast tables in ECONOMY.md regenerate. |

Size key: S under an hour of edits, M a morning with tests, L a day or a design change.

## 4. Rules that work and must not be touched

- **Crumb hand mining at 200 ticks (about 29.5 wheat per Crumb per minute).** Linear when the Crumbs are spread (175 / 235 / 295 for 6 / 8 / 10). That is the right per-Crumb number; fix the spreading (change 1), not the rate.
- **The kitchen opening.** First toast at 65 s with 100 starting wheat, by a sensible build. The 100-wheat start and the Mill-75 / Well-50 / Toaster-100 prices make the first minute a real sequence of decisions.
- **Upkeep at 5% a minute, no supply cap.** It bites at 29-45 Poppers (far above the 40 cap) and the continuous-fight cost (37 wheat a minute per Popper) is the real limit. It is simple to read and I would not add a second pressure.
- **Toast as ammo with a hungry state.** The stock mechanism produced the only real fight in my six matches: the easy defender's 24 shots against the sonnet squad's 8.
- **The 2400 hp Power Strip.** It makes a rush lose by arithmetic (nothing kills it before about 6:00 even with a perfect chain) and is the right size for the 12-16 minute match in NORTHSTAR.md. Change what it is worth in the timeout, not its hp.
- **The cord leash as a hard stop.** The rule is clear, and the cord-cut/power-down counter actually defeated a 30-box push. Tune the cost (change 3), not the rule.
- **Pond 8.5 tiles from each Strip.** A Well within 4 tiles of the water gave a toast at 65 s with no friction. Keep it.

## 5. Three open questions for Joshua

1. **Should a 15:00 timeout be a win at all?** All six matches I ran ended in a timeout and none in a Strip kill, and the mirror ties exactly. Do you want "most Strip damage / most spent on the board wins" (a real decision, favours the raider), or "a draw unless a Strip falls" (honest, but no winner for the end screen in most matches)?
2. **Should the player's Crumbs auto-spread over the field, or should sending them to different tiles be a skill?** Today the auto-gather hides a flat income curve (6, 8 and 10 Crumbs all give 175), and a newcomer who trains four more Crumbs gets nothing for 200 wheat. A hotkey is fine for a pro, but NORTHSTAR #10 says the first three minutes teach themselves.
3. **How long should a push take?** Today a perfect straight chain is about 18 boxes (UNVERIFIED) and the real bot needed 30 boxes over 9.5 minutes, so the first fight is at 10:00 of a 15:00 match. NORTHSTAR.md says first contact around minute 5-6 and a 12-16 minute match. Which do you want: first contact at about 6:00, or a long build-up with one decisive fight?

## What I could not verify

- Why my hand-built chain in `systems-rush.mjs` did not keep the dropped Poppers plugged (they went to battery at 10 s). I did not trace it; the fake `state.power.points` may need more fields than I gave them. Rush kill time is therefore an extrapolation.
- The straight-line chain of 18 boxes is arithmetic, not a run.
- The 8-seed / 20-seed rates in the "one-line tests" are targets, not measurements.
- `reports/2026-10-25/{m7,s1,s7,s472}.json` are match logs the probes read; safe to delete.
