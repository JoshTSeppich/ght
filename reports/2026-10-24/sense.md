# reporter-sense: does Toaster Wars make sense? (2026-10-24)

**Verdict: the bread chain, costs and upkeep work as written in the sim, and the passive wheat is an intended auto-gather (not a sim bug), but the game does not yet make sense end to end: wheat floods with nothing to spend on, a passive player can WIN a 15:00 timeout on hoarded wheat (against the classic builtin bot; the real page opponent was not run), the cord leash broke in one scripted setup, bots are told the match is 2000 ticks, and the screen explains very little.**

Honest scope: I ran the real modules (`createPlayableState`, `step`, `createLiveMatch`, `renderBar`, `createIdleCrumbs`) from probe scripts in `reports/2026-10-24/`. I ran out of turns before finishing three things, marked UNVERIFIED below.

**Big caveat on the idle matches.** Joshua's brief and `.sandbox-qa/probe/match-timer.mjs` use `players/builtin/ai.mjs`. But `play/opponent.mjs:19` says the page's default opponent is `players/toaster-easy/bot.mjs` (`?difficulty=easy`), not the builtin bot. My `lib.mjs` still loads the builtin AI (my attempt to switch it was blocked), so my idle-match numbers describe the classic builtin easy bot, NOT what a stranger actually faces. Rerun with `toaster-easy` before trusting the "how it ends" rows.

## Ranked: what is left

| # | What is wrong or unexplained | Root cause (file:line) | Evidence (quoted from my runs) | Size | Owner | Status |
|---|---|---|---|---|---|---|
| 1 | **Wheat floods and has no sink.** 6 idle Crumbs bring about 17 wheat a second with nothing built; the bank hits thousands, so wheat is never a decision. A passive player's "value" beats the bot's. | Auto-gather: `play/app.mjs:289` pushes `idleCrumbs.tick(...)`; `play/idle-crumbs.mjs:46` sets `since = -Infinity` when `now <= 1`, so every Crumb is sent to the nearest wheat at tick 1. Income is high because fields are close and a mine takes 8 ticks (haiku #821: ~150 wheat/Crumb/min vs target 25). | Bare sim, no hook: `t=110.0s wheat=100`. With the page's hook: `t=4.0s wheat=145  t=40.0s wheat=770  t=46.0s wheat=870  t=110.0s wheat=1970` (matches Claude's 160 / 755 / 885 / 1975). First command: `{"type":"gather","unit":3,"x":24,"y":227}`. | M | sonnet (economy) | VERIFIED |
| 2 | **A do-nothing player wins on timeout** (builtin easy opponent only). Timeout compares "value", which wheat dominates. | `env/sim.mjs:114-118` timeout returns the higher `value`; `sideValue` counts the bank. | `idle-match.mjs idle-hook 7`: wheat `[3945,55]` min 4, `[7170,979]` min 8, `[11565,5265]` min 14, Strips 2400/2400, `ended {"winner":0,"reason":"timeout","tick":21600,"value":[12465,8978]}`. With no auto-gather: `ended {"winner":1,"reason":"timeout","value":[400,8978]}`. Enemy had 40 units by min 7, Strip hp 2400 both sides, never attacked. | M | sonnet + Joshua decision | VERIFIED for builtin easy; UNVERIFIED for toaster-easy |
| 3 | **Cord leash is not always enforced.** "No toaster can go farther than its cord" held in 5 setups but failed in one. | `env/power.mjs:156-171` `stepVerdict` / `enforceCords` (`power.mjs:345`) normally emit `cord-limit` and stop the unit. In the failing run no `cord-limit` fired; `stepPower` (`power.mjs:252-255`) then switched it to battery, and battery units move freely (`power.mjs:160`) for `POWER.batteryTicks = 240` (10 s, `power.mjs:29`). Root cause not found. | Holding: `leash.mjs` stops at (22,220) 12.6 from the point; `leash2.mjs none/windmill/crowd/hunger` each print `cord-limit:cord` and stay at (15,220). Failing: `chain2.mjs`: `EVENT tick 3125 power-battery pos 15 219 ... strip@18,232 d13.3 windmill@30,224 d15.8`, then `EVENT tick 3365 power-down pos 27 151 ... strip d81.5`; `popper ended at 27 151 max distance ... 74.1 cord 12`. | M | sonnet (power owner) | VERIFIED symptom in one script; cause UNVERIFIED (needs a minimal repro; I only ruled out windmill, crowd of 12 units, hunger) |
| 4 | **Bots are told the match is 2000 ticks; the real match is 21600.** | `env/state.mjs:192` `maxTicks: STATS.match.maxTicks`; `env/stats.mjs:97` `maxTicks: 2000`; the live state uses `state.maxTicks = 21600` (`env/live.mjs:184`, `play/app.mjs:50`). | Read, not run: `grep maxTicks players/` finds no use in `players/builtin`, `toaster-easy` or `toaster-sonnet`, so no bot reads it today. (My probe line printing "observe says 0" was a bug in my print, ignore it.) | S | sonnet | VERIFIED by grep and file:line; the observation value itself UNVERIFIED by run |
| 5 | **Docs contradict the game.** `ECONOMY.md` says "Crumbs do not gather until you right-click wheat" and "Power itself costs nothing to run yet"; both are false now (auto-gather; Toasters use 2 Energy). | `scripts/economy-doc.mjs` / `env/economy-table.mjs` text not updated after items 3 and 20. | Auto-gather shown in #1; energy: `make: strip 2, windmill 3`, `use: toaster 2` (`env/energy.mjs:19-21`). | S | haiku | VERIFIED |
| 6 | **Power "0/2" is used/made Energy, and is never explained by name.** A stranger reads a fraction like a health bar. Goes red "4/2" when short. | `play/hud-bar.mjs:96` chip value `${en.used}/${en.made}`. Tooltip text exists (`hud-bar.mjs:67-72`) but only on hover. | Fresh start HUD: `Power 0/2` (Strip makes 2, nothing uses). One Windmill: `Power 0/5`. Two Toasters, no Windmill: `energy {"made":2,"used":4,"shed":1}`, HUD `Power 4/2`, `shedToasters [18]`, toaster 18 `powered=false`. | S | haiku / gpt (copy) | VERIFIED |
| 7 | **Windmills and Dams need a Crumb to walk to a fixed pad; nothing on screen tells a stranger this.** The build command is `place-power`, and `build` with `kind: windmill` is rejected `wrong-kind`. | `env/power.mjs:190-205` (`doPlaceCord`: `too-far` if distance > 1, `not-a-site`). | `windmill paid 40`, `energy {"made":5,"used":0,"shed":0}` after walking a Crumb to pad (30,224). `REJECT ... "reason":"wrong-kind"` when sent as `build`. | S | fable/gpt (onboarding) | VERIFIED |
| 8 | **Hunger resupply looked instant** (0.1 s), so a stranger may never see "Hungry". I did not find out why. | `env/ammo.mjs` stepAmmo run/lifeline path, not read. | Emptied Popper: `state hungry canFire false canMove true`; `resupplied after ticks 3 (0.1 s) state fed slices 6`. | S | sonnet | VERIFIED symptom; cause UNVERIFIED |
| 9 | **Claude's "Well gave no water" (chat #833) did not reproduce.** | n/a | My Well at the home spring (18,230): `well: 17 events, first at 14.8 s, gaps(s) 12.0`; pantry water reached 6. If it fails on the page, the ghost and the bakery disagree about a different tile. | S | haiku (add the test #833 asked for) | VERIFIED sim works; page failure UNVERIFIED |
| 10 | **Supply is hidden in Toaster Wars; the 40-unit cap is invisible.** | `play/hud-bar.mjs:98-103`: Supply chip only when the budget is off; Toaster Wars has a budget so it shows Upkeep instead. | HUD text `Wheat 2130 Flour 0 Water 0 Toast 8 Power 0/2 Upkeep 0/min 2:00`, no Supply. `ECONOMY.md`: "40 units is the hard limit". | S | sonnet | VERIFIED (code + HUD run) |
| 11 | **Match end for a passive player is a 15:00 timeout nobody warns about.** Result text is "Time ran out; the stronger side wins." | `play/app.mjs:813`. | `ended ... "reason":"timeout","tick":21600` = 15.00 min both variants. | S | sonnet | VERIFIED (builtin bot) |
| 12 | **Not done:** a scripted minimal-build full match; the real page opponent (toaster-easy) idle match; reading `hud-tips.mjs`, `research/COPY.md`, `play/teach.mjs`, `play/tutorial.mjs` for explanations; reading TERRITORY 16-20, COMBAT, ENV-SPEC, POWER-NETWORK, FANATICS in full. | Ran out of turns. | n/a | M | haiku | UNVERIFIED |

## Rules that work as written (do not re-check)

All VERIFIED by running the real play state (`createPlayableState`, seed 7, side 1 idle), probe `chain.mjs` and `chain2.mjs`:

- **Mill:** 1 flour every 20.0 s for 10 wheat (`mill: gaps(s) 20.0,...`; first flour at 22.8 s). Matches `ECONOMY.md`.
- **Well:** at the home spring, 1 water every 12.0 s (`gaps(s) 12.0`), first at 14.8 s. (Creek rate 6 s not run.)
- **Toaster:** +4 slices per bake while powered with flour and water (`stack 52` after 240 s, bakes gated by the Mill's flour, every 20 s).
- **Toaster power:** a second Toaster with only the Strip (made 2) is shed: `shedToasters [18]`, `powered=false`; only toaster 17 baked (`{"17":3}` in 60 s).
- **Building costs charged at placement:** Mill 75, Well 50, Toaster 100, Assembly Line 150 (`paid` equals STATS), Windmill 40.
- **Unit costs** are drawn while training; totals matched `ECONOMY.md` within upkeep drip: Popper 75, Zapper 66 (65), Four-Slice 225, Broiler 176 (175), Flak 71 (70), Bagel 126 (125), Crumb 51 (50).
- **Upkeep:** 5% of cost a minute, Crumbs free. Six fighters: `upkeep/min (budget.mjs) 36.750`, HUD `Upkeep 37/min`, and measured drain `-37.00` wheat over 60 s with no income.
- **Hunger states:** `fresh popper state fed slices 6`; emptied: `hungry canFire false canMove true`. A hungry Popper cannot fire. (Resupply timing: see #8.)
- **Cord leash:** held in five setups (see #3), unit stops near 12 to 14 tiles and its order is dropped.
- **Start:** 100 wheat, 6 Crumbs, Strip 2400 hp, 8 slices (`stack 8`), Strip makes 2 Energy.
- **Passive wheat** is the intended item-3 auto-gather (`PLAYABLE.md` item 3), not a stray grant. Nothing in `env/` adds wheat with no Crumb orders.
- **Nobody loses early:** against the builtin easy bot Strips were untouched through 15:00.

## Stranger test (from code, `play/hud-bar.mjs`; `hud-tips`, COPY.md and teach text NOT read)

| HUD item | What it means in the rules | Does the screen explain it? |
|---|---|---|
| Wheat | Money. Crumbs haul it; buildings, units and the Mill spend it. | Hover only: "Crumbs haul it, the Mill grinds it, units cost it." No on-screen hint that Crumbs already auto-gather. "Wheat" is still `shards` in code. |
| Flour | Ground from wheat by a Mill; Toaster input. Max 6. | Hover only. Blinks when 0 with "Build a Mill and haul wheat to it" (the Mill needs no hauling in the sim: wheat is taken from the bank). That text is misleading. |
| Water | Drawn by a Well within 4 tiles of water; Toaster input. | Hover only; blinks at 0 ("Build a Well near the river"). Spring vs creek speed is not shown. |
| Toast | Ammo stack at the Strip. Hungry fighters cannot fire. | Hover: "Toast is ammo". Blinks at 0. |
| Power `used/made` | Energy used by Toasters and fences / made by Strip, Windmills, Dams. | Hover explains; the chip shows no unit and no label for used vs made. Reads `0/2` all game until you build. |
| Upkeep `N/min` | Wheat the army eats per minute. | Hover only; red when above income. |
| Supply | Unit count / 40 cap. | Hidden in Toaster Wars (`hud-bar.mjs:98-103`). A stranger hits the cap with no warning. |
| Blinking missing-ingredient | Flour or Water chip pulsing at 0. | Only the chip blinks; no icon over the Toaster was checked (`hud-badges.mjs` not read: UNVERIFIED). |
| Pilot light chip | Strip bakes 1 slice per 20 s while the stack is under 4. | Hover text exists and is good; the term "Pilot light" is never defined on screen otherwise. |

Words a stranger will not understand: **Crumb, Popper, Zapper, Four-Slice, Broiler, Bagel, Power Strip (Strip), Assembly Line, Windmill pad, Dam site, Pilot light, Upkeep, Hungry, "Power 0/2", "cord", "extension box", "plug"**. The tutorial (haiku #810) is not wired to the page as of the last chat I read.

## Open questions for Joshua

1. Should a passive player be able to win a timeout on hoarded wheat? (Fix options: timeout counts army and Strip hp, not bank; or end the match only by Strip kill.)
2. Should Crumbs auto-gather from tick 1 at all? It makes the opening trivial and floods wheat. Keep it, but cut income about 6x (haiku's target 25 wheat/Crumb/min)?
3. Is the cord a hard leash, or does a 10 s battery grace (`POWER.batteryTicks`, 240) count as intended? Right now a unit that slips out can walk 70 tiles in the grace.
4. Should Supply (the 40 cap) come back on the bar, given there is no other cap?
5. Which opponent is the real default for strangers: `toaster-easy` (per `play/opponent.mjs`) or builtin easy (per the QA probe)? Reports and tests should use the same one.

## Files (all under `reports/2026-10-24/`, none edit the repo)

`lib.mjs` (harness, still loads the builtin AI), `wheat-trace.mjs`, `passive-wheat.mjs`, `chain.mjs`, `chain2.mjs`, `leash.mjs`, `leash2.mjs`, `idle-match.mjs`.
Run: `node reports/2026-10-24/passive-wheat.mjs`, `chain.mjs`, `chain2.mjs`, `leash2.mjs none|windmill|crowd|hunger`, `idle-match.mjs nothing|idle-hook 7`.
