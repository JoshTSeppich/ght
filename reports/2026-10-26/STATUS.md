# Toaster Wars fix waves: STATUS (QA Lead, 2026-10-26)

Kept by QA Lead (card 15). Read-only for everything outside reports/.
Verified = the card's named tests re-run by QA this wave and green, plus the claims in the DONE post checked against those tests.
Not verified = no QA check yet. A /play screenshot was NOT taken for any item: this headless session has no browser or screenshot tool.

## Wave check, this run

Full suite: see the "Full suite" section at the bottom (output in qa-suite-wave.txt).

| Card | Owner | Item | Status | Verified | Evidence / open |
|---|---|---|---|---|---|
| 1 Match Rules | Sonnet | 1 stalemate in sim.mjs (2:00 quiet, 60 s countdown) | DONE | PASS | tests/stalemate.test.mjs 9/9 |
| 1 | Sonnet | 2 timeout tie-break (damage counter, then Wheat, then true draw) | DONE | PASS | tests/timeout-tiebreak.test.mjs 6/6; counter fed by Combat A |
| 1 | Sonnet | 3 territory win from map (Wheatfield 21 of 31) | DONE | PASS | tests/territory-wincount.test.mjs 5/5 |
| 1 | Sonnet | 4 default length 21600 ticks (15:00) | DONE | PASS (targeted) | Full-suite fallout: tests/cord-leash and tests/sim-determinism were red in the earlier runs; see Full suite |
| 1 | Sonnet | 5 replays rebuild Toaster Wars | DONE | PASS | tests/rerun-toaster.test.mjs 5/5. Open: haiku review #1325 says rerun infers max(ticks, 21600), so an old pre-rules timeout log replays differently. Not covered by a test |
| 1 | Sonnet | Done-when: 40-match league, fewer than 4 timer ends; rerun matches matches/room/latest.json exactly | NOT DONE | not verified | League waits on AI (card 6); the latest.json byte check not run |
| 2 Combat | Haiku A | 1 fog in chooseTarget and ordered attacks | DONE | PASS | tests/combat-fog.test.mjs 5/5 |
| 2 | Haiku A | 2 target hold | DONE | PASS | tests/combat-target-hold.test.mjs 3/3 |
| 2 | Haiku A | 3 priority: fighters, Crumbs, buildings, Power Strip | DONE, one BLOCKED line | PASS (new tests) | tests/combat-priority.test.mjs 5/5. Joshua decision: tests/combat-targeting.test.mjs:106 still pins the old forge-over-brute rule. Keep the new priority and update that test, or drop item 3 |
| 2 | Haiku A | 4 splash at half base shot | DONE | PASS | tests/combat-splash-structure.test.mjs 2/2 |
| 2 | Haiku A | 5 Heat Lamp only while powered | DONE | PASS | tests/heat-lamp-power.test.mjs 3/3 |
| 2 | Haiku A | 6 per-side building-damage counter | DONE | PASS (via timeout-tiebreak) | state.buildingDamage read by the tie-break |
| 3 Tech Tree | Haiku A | 1 Kitchen tier gate in sim (train, build) | DONE | PASS | tests/tier-sim-enforce.test.mjs 6/6 |
| 3 | Haiku A | 2 Relay Pylon needs-toaster in sim | DONE | PASS | same file |
| 3 | Haiku A | Done-when: bots still pass; seeds 3 and 5 of toaster-easy red | OPEN | not verified | The gate is not the cause for seed 3 (correction #1258); seed 5 unchecked. Cause unknown |
| 4 Economy | Haiku A | A1 idle Crumbs to least-loaded Wheat in cord reach | DONE | PASS | tests/idle-crumbs-spread.test.mjs: the 400 Wheat/min over 3 min test passes. The 390/830/1280 figures in chat are not pinned by a test |
| 4 | Haiku A | A2 Power Strip rally uses the same pick | DONE | PASS (targeted) | idle-crumbs-spread test file |
| 4 | Haiku A | A3 gather target auto in sim | DONE | PASS | sim gather test in idle-crumbs-spread |
| 4 | Haiku B | B1 retarget in cord reach, field-empty event | DONE, open | PASS (test), FAIL (log) | tests/field-empty.test.mjs passes. FAIL part: field-empty is missing from EVENT_FIELDS in env/log.mjs, so log-format reds (review #1325). Sonnet to add it |
| 4 | Haiku B | B2 unit cap 40, budget note | DONE | PASS | tests/unit-cap.test.mjs passes |
| 4 | Haiku B | B3 starting Crumbs from the map | DONE | PASS | tests/start-crumbs.test.mjs passes |
| 4 | Haiku B | B4 saturation for HUD | DONE | PASS (targeted) | fieldSaturation in env/economy.mjs; HUD use is card 8 |
| 6 AI | Haiku B (Normal) | scout at 1:30, counters, raids | DONE, review open | PASS (new tests) | tests/bots-sonnet-scout.test.mjs and bots-sonnet-counter-raid.test.mjs, 9/9. Open: gpt review #1302 CHANGES: visibility radius 6 vs real Crumb 5 / Strip 8 / site 2; scout never stops its gather order (test checks only the scout id). Not answered in chat |
| 6 | Haiku A (Easy) | Mill/Well/Toaster by 2:00, tier mix, Strip attack 6:00-8:00, pullback | NOT DONE | not verified | Not posted |
| 6 | Sonnet lead (Hard + league) | toaster-hard, league.mjs, reports/league/latest.json | IN PROGRESS | not verified | Review request #1326 open. Known: every league match ends on the timer until the economy fix; bots-attack-time not done |
| 7 Controls | Haiku A | A1 Hold and attack-move use real ranges | DONE | PASS | tests/controls-a-keys.test.mjs 6/6 (A1 to A5 cases) |
| 7 | Haiku A | A2 saved cameras F5-F8, Ctrl+ save, Shift+ cheats | DONE | PASS | same file |
| 7 | Haiku A | A3 Tab cycles unit types; inspect power on F4 | DONE | PASS | same file |
| 7 | Haiku A | A4 P is Patrol on classic; Pause only with nothing selected | DONE | PASS | same file |
| 7 | Haiku A | A5 letters ignore Ctrl/Cmd; Ctrl+0; PageUp/PageDown | DONE | PASS | same file |
| 7 | Haiku B | B1 Alt+number groups | NOT DONE | not verified | Controls B status #1305: NOT DONE |
| 7 | Haiku B | B2 Ctrl+click, box select buildings, F2 uncapped, Ctrl+F1, right-click follow, minimap | NOT DONE | not verified | F2 test 'keeps the selection cap' pins the old cap. Joshua decides: replace that assertion or keep the cap. 76-failure full run from the same wave |
| 7 | Haiku B | B3 set-rally order in sim | WAITS | not verified | Waits on Construction DONE (card 11) |
| 8 HUD | Haiku | items 1-6 | PLAN posted (#1332), not DONE | not verified | Items 1-3 wait on Controls B |
| 9 UX Writer | Haiku | items 1-7 | DONE | PASS | tests/text-truth.test.mjs 11/11 green (tooltip numbers, key profile, mute label, refusal words). Not touched: env/stats.mjs:438 text, teach lancer line |
| 10 Match Flow | Haiku | start screen, results text, play again, F10 menu, replays | NOT STARTED | not verified | No DONE posted |
| 11 Construction | Haiku | ghost checks, cancel-build, repair | PLAN posted (#1333), not DONE | not verified | Waits on Economy DONE (now posted) |
| 12 Power and Bakery | Haiku | item 1 Mill Dam price 160; item 3 toast run speed; item 4 Four-Slice volleys | DONE | PASS | tests/station-price.test.mjs 3/3, toast-run-speed 1/1, four-slice-ammo 2/2 |
| 12 | Haiku | item 2 one reach rule for cords and fences | BLOCKED on Joshua | not verified | Contradicts pinned tests power-fence-gap and power-lines 19-21 |
| 13 Docs | Haiku | items 1-3: tech-tree-doc, SWITCHED-OFF.md, stale comments | DONE | PASS (item 1, item 2 file present) | tests/tech-tree-doc.test.mjs 10/10. Item 3 comment edits not re-checked by QA |
| 14 Balance | Haiku | breakpoints.mjs and sandbox.mjs | DONE, review open | PASS (tests) | tests/breakpoints.test.mjs 9/9, tests/sandbox-fight.test.mjs 6/6. Open: gpt review #1321 CHANGES: sandbox has no Power Strips, so the 5000-stock ammo call cannot resupply; tests/sandbox-fight.test.mjs:41 accepts an unchanged draw |
| 0 Hive MCP | Sonnet | toaster-hive server, agent files | BLOCKED (#1221, #1244) | not verified | Server, tester file and role files not finished per the posts |
| 0b Hive remote | Sonnet | HTTP door for ChatGPT | NOT STARTED | not verified | |

## Open decisions for Joshua
1. combat-targeting.test.mjs:106: keep the new combat priority (update that test) or drop Combat item 3.
2. input-hotkeys.test.mjs 'F2 keeps the selection cap': replace the assertion (F2 uncapped) or keep the 12 cap.
3. Power and Bakery item 2: one reach rule for cords and fences, against the pinned power-fence-gap and power-lines tests.

## Full suite
Result: 2002 tests, 1980 pass, 14 fail, 4 cancelled (output in qa-suite-wave.txt). Verdict: FAIL.
Failing: tests/bots-all-units (bot does not give itself away; 714 s), tests/easy-bot-plan (706 s), tests/toaster-easy (588 s), tests/style-lab (603 s); log validation (validateLog, tick-entry shape, log JSON round trip, byte-identical logs, timing field) in log-format and sim-determinism; equal-distance lower-id tie in combat; 'whole match under 5 seconds' (perf); F2 selection cap; wheatfield water navy centre.
Caveat: QA sent TaskStop to the run partway through, when it looked silent. The summary still came out, but the 4 cancelled tests may be from that stop. Re-run those files alone before reading them as bugs.
