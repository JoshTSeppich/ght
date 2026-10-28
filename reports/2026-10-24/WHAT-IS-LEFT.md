# What is left to make GHT look, feel and make sense (merged, 2026-10-24 11:50)

Merged by Claude from the three reporter files beside this one: look.md, feel.md, sense.md. Each row cites the reporter and its row number; the reporters' evidence marks (VERIFIED / UNVERIFIED) stand. Nothing here is a fix; builders start only on items Joshua picks.

## Five decisions only Joshua can make (everything below waits on at least one)

| # | Decision | Why it matters | Report |
|---|---|---|---|
| A | How does a 15:00 timeout decide the winner? Today it is bank value, so a player who only auto-gathers wins on hoarded wheat. Options: army + Strip hp, or Strip-kill only. | Breaks the point of the game | sense #2 |
| B | Keep tick-1 auto-gather? If yes, cut income about 6x (haiku's target 25 wheat per Crumb per minute; measured about 150). | Wheat floods, nothing to spend on, every balance number is moot | sense #1, feel 3 |
| C | Water and relief: bring the creek (or a pond) within sight of each Strip, and whether Wheatfield gets real cliffs and ramps now or after v0.1. | Nearest water is 147 tiles from the Strip; the ground is a flat unlit picture | look #1, #2 |
| D | Camera: keep orthographic, or go to perspective FOV 35 as RENDERING.md says. Changes the whole feel and every pick. | Blocks look items 4, 8 | look #9 |
| E | Command card: two rows so all 13 Crumb buttons show (Windmill is silently dropped today), and should each button sit on the cell of its key? | The Windmill gates a second Toaster; cells do not match keys | feel #2, #5 |

## Ranked: what is left (owner, size)

| Rank | What is left | Owner | Size | Source |
|---|---|---|---|---|
| 1 | Wheat income and the timeout rule (decisions A and B): cut auto-gather income, make timeout count army and Strip, warn before 15:00 | sonnet | M | sense #1, #2, #11 |
| 2 | Wire the 5-step tutorial card (built, 14 tests green, zero references in app.mjs) and add a one-line objective to the top bar | sonnet | S | feel #1 |
| 3 | Command card: show all 13 buttons; cell = key (decision E) | sonnet | S–M | feel #2, #5 |
| 4 | The stage: lit ground that takes shadows, contact decals under buildings and rocks, relief if decision C says so | fable (design), sonnet | L (+S for decals) | look #1, #3 |
| 5 | Water near the base (decision C), water that reads as water | fable decides, sonnet | M | look #2 |
| 6 | Visible shots: slice arc and Hot Coil bolt exist only in the Studio; on /play an attack is a ring and a flinch | gpt/fable design, sonnet | L | feel #3 |
| 7 | Cord leash: one scripted run let a Popper walk 74 tiles on the 10 s battery grace with no cord-limit event; needs a minimal repro and a decision on whether the grace is intended | sonnet | M | sense #3 |
| 8 | Toy finish you can see: edge band in screen pixels (now 0.8 px at 800x600), satin and edges on buildings, a Power Strip that reads as the base, no sci-fi glow ring | sonnet, gpt (Strip design) | S–M | look #4, #5 |
| 9 | Hungry and unpowered fighters: a growl, an icon above the unit, an unpowered cue; name what was hit in "Under attack" | sonnet, gpt (icons) | M | feel #6, #9 |
| 10 | Words on screen: Power used/made labelled, Supply chip back (40 cap is invisible), Pilot light defined, real hover cards instead of native title tooltips, Flour hint text corrected (the Mill takes wheat from the bank) | haiku | S | sense #6, #10, stranger table; feel #7 |
| 11 | Box-select tests one lifted point per unit; test the body | sonnet | S | feel #4 |
| 12 | Windmill and Dam have no 3D models; Assembly Line and Heat Lamp fall back to GHT sci-fi builders | gpt (models), sonnet | M | look #7, #8 |
| 13 | Bloom runs in play against the spec, no environment map; A/B in a browser (decision D for the camera) | sonnet | S | look #9, #10, #11 |
| 14 | Perf: no frame-rate number exists; play/perf.html runs the old 128x128 map with grunts, not Wheatfield with toasters and cords. Build the real scene and record median and p95 on the Air | haiku runs, sonnet builds the scene | M | look #16 |
| 15 | Stale docs and dead flags: ECONOMY.md says no auto-gather and free power (both false); observation tells bots maxTicks 2000 while the match is 21600 (no bot reads it yet); ?motion=coil is dead; research/COPY.md is read by nothing | haiku | S | sense #4, #5; feel #15 |
| 16 | Easy opponent is passive for 8+ minutes; one small early raid so hunger and power matter | sonnet | M | feel #8 |
| 17 | Feedback gaps: "+N wheat" and a collect tick, two audio systems with M as both Move and mute, buttons in the edge-pan band, end card does not say whose Strip fell | haiku / sonnet | S each | feel #10–#14 |
| 18 | Selection rings, wheat tufts, rubble: five-sided team rings, five-blade bundles, pale movable rubble per the style bible | haiku | S each | look #6, #12, #15 |

## The gate before any of it ships

Ten DONE claims since last night say "not eyeballed in a browser" (feel.md lists them with times). A browser pass on /play with and without ?toy=0, plus the Studio side-by-side, is the acceptance step for ranks 4, 6, 8, 9, 13. Joshua's own session at 11:10 and Claude's at 11:20 are the only screen evidence on record.

## Still unverified (reporters ran out of turns)

- An idle match and a scripted minimal build against the page's real default opponent, players/toaster-easy (sense.md's idle numbers are against the classic builtin bot).
- Why a hungry Popper resupplied in 0.1 s.
- The chat report of a Well giving no water on the page (does not reproduce in the sim).
- Fog of war on the play page (no code path found in app.mjs; not checked in a browser).

Probe scripts live beside this file; none edit the repo.
