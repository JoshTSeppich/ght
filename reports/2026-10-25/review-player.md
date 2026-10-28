# Fresh-eyes player review: GHT, 2026-10-25

Reviewer: a new RTS player, no earlier reports read until the end. Evidence marks: VERIFIED (ran it, or file:line) / UNVERIFIED.

**Limits of this review.** I could not open the screenshots. They live in ~/dev/control-room/data/recurse/graphics/shots/, which is outside the one folder this session may read (the listing was refused), and I found no shots.json inside the repo. So section 1 is NOT a first impression from pictures. It is a first impression from the written design. The match in section 2 is real: scripts `reports/2026-10-25/player-match.mjs`, `player-match2.mjs`, `player-match3.mjs` (seed 7, the page's real opponent players/toaster-easy, fake timers, 15 simulated minutes).

## 1. First impression (from the design text, not the pictures)

VERIFIED from NORTHSTAR.md:1-10 and ECONOMY.md: the pitch is great. Wheat to flour to toast, the army eats the toast, and the toasters are leashed by their cords. That is a StarCraft economy with a joke on top, and I understood it in one breath. What I could not judge is whether it looks the way the drawings promise; the Studio and the live page were not visible to me. UNVERIFIED: everything about how it looks.

## 2. Match log (seed 7, my scripted opening, the page's easy bot)

Map facts (VERIFIED, printed by the script): my Strip is at (18,232), the enemy Strip at (237,23). That is about 300 tiles apart. Cord reach per Extension Box is 12 tiles, so a straight march needs on the order of 25-30 boxes.

| Min | What I saw (wheat / flour / water / toast, my side) |
|---|---|
| 0:00 | 100 wheat, 6 Crumbs auto-gather from the first tick. I queued Mill at 0 s, Well at 11 s (at 9,237 by the pond), Toaster at 58 s. |
| 1 | wheat 5, flour 2, water 6, toast 8. The 100 starting wheat is gone to buildings in the first minute. |
| 2 | wheat 5, flour 0, water 6, toast 24. **First toast baked at 65 s** (by the Toaster, not the Strip's pilot light). The Assembly Line went down at 118 s. |
| 3 | wheat -7 (negative: debt after the Line and a second Mill), toast 32, first Popper out at about 2:35. |
| 4 | wheat 43, toast 44, 2 Poppers. Enemy has Mill and Well, 120 wheat, 6 Crumbs. |
| 5 | wheat 12, toast 64, 4 Poppers done (about 4:55). Enemy has a Toaster. |
| 6 | wheat 112, toast 84. Enemy has an Assembly Line. Still 0 enemy Poppers. |
| 7-10 | wheat climbs about 100 a minute (212, 302, 402, 492) with nothing I want to buy. Toast climbs 24 a minute with nobody eating it (108, 132, 156, 180). The enemy sits at 10-65 wheat, still 0 Poppers. |
| 11-15 | wheat 572, 662, 742, 827, 907. Toast 204 up to 300. Enemy still 6 Crumbs and 0 Poppers; one of its units walks toward me along its box chain: 301 tiles away at minute 1, 237 at minute 10, 169 at 12, 47 at 15. |
| 15:00 | **No fight. No enemy attack. Time-out at 15:00.** Both Strips 2400/2400. |

First enemy attack: **never within 15 minutes** in this run (the script counts any enemy hit on my units or buildings; none). Who wins: nobody fought. The match ended with Strips untouched; the time-out rule decides it (WHAT-IS-LEFT says by bank value, which I did not re-verify). The winner of my run would be me on hoarded wheat, which is exactly the problem.

What did not work in my script, and why it matters (VERIFIED in the runs): my first two scripts used `build` for Extension Boxes, which silently does nothing; boxes need `place-power` (env/power.mjs:193: "next to a plugged Crumb, inside the cord"). In run 3 box #1 was placed at 5:10, and then my script stalled because a box did not appear where I expected, so I never got a real march. I did not prove the chain works for a human player; the Poppers got no further than 11 tiles from my Strip. UNVERIFIED: a full siege.

Other facts: the lone Mill is the whole toast limit. One Mill makes 3 flour a minute, which is 12 slices (ECONOMY.md "busy Mill"), and the log matches: toast rose 12 a minute with one Mill (run 1), 24 with two (run 3). Flour sits at 0-1 all game while water sits at the cap of 6. Tutorial and tips exist and are wired (play/app.mjs:245-246, 736).

## 3. Top 10 things that would most improve the next player's first match

1. **Nothing ever happens to you.** Easy bot never trained a Popper in 15 minutes and never attacked (VERIFIED, run 3). A new player sits in a calm farm sim with 900 wheat. Should be: one small, telegraphed raid around 4-6 min so hunger and cords matter. Size M.
2. **The enemy is 300 tiles away.** Cord reach 12, box 30 wheat: about 25-30 boxes before a Popper can even see the enemy. Should be: the first siege reachable in 3-4 minutes of box building, or a smaller default map. Size M-L.
3. **Hoarding wins the clock.** Passive play ends with ~900 wheat and 300 toast and a draw/win by bank. Should be: army plus Strip hp decides the time-out, with a warning before 15:00 (WHAT-IS-LEFT decision A, which I confirm from play). Size M.
4. **Wheat has nothing to buy after minute 6.** Income ~100+/min, no sink beyond 40-unit cap and 30-wheat boxes. Should be: visible sinks (more Mills, second Line, Heat Lamps) pulling the player, and the tutorial should say "build a second Mill" once toast is the limit. Size S (text) to M (balance).
5. **The Mill is an invisible bottleneck.** Flour is 0-1 all match, water is full; one Mill feeds a quarter of a Toaster (ECONOMY.md). The player is not told. Should be: a "Toaster idle: no flour" chip and a tooltip that says build more Mills. Size S.
6. **Placing an Extension Box is a different command from building, and fails silently.** `build` with kind extension did nothing and gave no error; `place-power` needs a plugged Crumb adjacent. Should be: clear rejection text in the log ("no Crumb next to that spot") or a ghost preview. Size S-M. (VERIFIED: my own two failed runs. UNVERIFIED how the page UI behaves; the HUD route may differ.)
7. **Wheat goes negative with no warning in the sim.** -7 at minute 3 while upkeep ticks. Should be: red wheat number and a "you are in debt" toast before it bites. Size S. (HUD turns Upkeep red, play/hud-bar.mjs:93, but only when upkeep exceeds income; I did not see the page.)
8. **The 100 starting wheat vanishes in 60 seconds.** Mill 75 + Well 50 + Toaster 100 is 225 against 100 start; the first minute is waiting with nothing to do. Should be: say so in tutorial step 2 ("you can afford the Mill now, the rest as wheat arrives"), or order the steps Mill, Well, Toaster by cost. Size S.
9. **Tutorial step 5 says "attack-move (A) to their Power Strip" but the Strip is 300 tiles away and the page gives no hint of distance or the box count.** Should be: a minimap ping to the enemy and "N boxes to go". Size S-M. (UNVERIFIED that the minimap lacks this.)
10. **Look and feel could not be judged by me.** I could not see the page. The earlier WHAT-IS-LEFT says on the live page an attack is "a ring and a flinch" (feel #3): if still true, the toast ammo fantasy is invisible. Should be: slice arcs on the page. Size L. UNVERIFIED tonight.

## 4. Three things already good

1. **The premise reads in one breath.** NORTHSTAR.md:1-10. The ammo-is-toast rule is easy to explain and funny.
2. **The first toast comes fast.** VERIFIED: 65 s with the Mill, Well, Toaster order, and the HUD's own text gets the numbers right (`play/hud-tips.mjs` reads numbers from the tables, so the tooltip and the sim cannot disagree).
3. **The five-step tutorial is wired to real state, not timers** (`play/tutorial.mjs:28-47`, mounted at `play/app.mjs:246`), and the objective line is one sentence: "Feed your toasters. Destroy the enemy Power Strip."

## 5. Would I play a second match?

**No, not tonight.** Honest reason: in my fifteen simulated minutes nothing fought me and I could not reach the enemy. The idea earns a second look; the match as it runs does not yet. If an early raid arrived at 5 minutes and the first siege were reachable by minute 8, I would say yes. Caveat: I did not see the pictures, so a great-looking page might change this.

## What the earlier reviewers missed or got wrong

(Read only after writing the sections above.)

- **Missed: the distance.** WHAT-IS-LEFT never states that the two Strips are about 300 tiles apart (I print it: 18,232 vs 237,23). It matters more than the water item (decision C). It explains why the easy bot's single squad barely arrives by minute 15.
- **Missed: the Mill ceiling.** The list talks about too much wheat (decision B), but not that toast, the real limit, is capped by one Mill at 12 slices a minute and the player is never told.
- **Missed: `build` vs `place-power` for boxes**, which silently fails. A script (or UI) that uses the wrong verb sees no error.
- **Closes an open question:** WHAT-IS-LEFT lists the scripted build against players/toaster-easy as unverified. Done tonight: first toast at 65 s, bot trains no Poppers and never attacks in 15 minutes (seed 7, one seed only).
- **Confirms:** decision A (bank value decides the time-out) and rank 16 (passive easy bot) are real and are the top two problems for a first match.
- **Not checked by me:** the wired tutorial text (rank 2 there is now done in code: play/app.mjs:246), the Well-gives-no-water chat report (my Well gave water, 6 by minute 1), and anything visual.
