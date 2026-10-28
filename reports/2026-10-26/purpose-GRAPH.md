# Purpose graph: GHT on /play (2026-10-26, read-only)

Slice: THE WHOLE GRAPH. Read: env/stats.mjs, env/bakery.mjs, env/power.mjs, env/energy.mjs, env/ammo.mjs, env/tiers.mjs, env/combat.mjs, env/economy.mjs, env/sim-territory.mjs, env/territory.mjs, play/toaster-play.mjs, play/input.mjs, play/station-controls.mjs, play/app.mjs. Numbers below are from a node run on `createPlayableState(1)` (the /play match) and `rowOf()`, not from the docs.

Tier reports: purpose-T1.md, T2.md and T3.md landed while I was writing. Their measured findings are in section 11; where we disagree, the disagreement is stated there.

## 0. What /play is (verified in code)

- `createPlayableState` = `createTerritoryMatch` + energy + fences + wrap, then `switchOffGht` (play/toaster-play.mjs:42-50).
- ON: budget (upkeep 5%/min), power (cords), ammo (toast), bakery (mill/well/toaster), chain (drills etc. in the sim), fences, energy, territory rules.
- OFF: research (`delete state.research`), Drift, market, GHT tiers (`noTiers`).
- Kitchen tiers are the only tiers (env/stats.mjs:251-255, env/tiers.mjs kitchenLockReason).
- Start: 100 Wheat each side, 6 Crumbs each side, Power Strip 2400 hp, start stack 8 slices. Wheat tiles hold 1800 each.
- Cords are the leash: every plugged fighter must stay within its cord of one of its side's points (power.mjs stepVerdict, enforceCords). Crumb cord 12, Popper 12, Zapper 12, Four-Slice 9.

## 1. Numbers (node output)

```
UNIT worker Crumb cost 50 hp 40 dmg 2 every 12 range 1 train s 1.67
UNIT grunt Popper cost 75 hp 60 dmg 20 every 36 range 4 train s 1.25
UNIT lancer Zapper cost 65 hp 40 dmg 18 every 30 range 3 train s 1.67
UNIT brute Four-Slice cost 225 hp 240 dmg 36 every 30 range 5 train s 3.33
UNIT howler Broiler cost 175 hp 70 dmg 30 every 36 range 9 train s 3.33
UNIT spiker Flak Popper cost 70 hp 50 dmg 15 every 36 range 5 train s 2.08
UNIT dart Bagel cost 125 hp 120 dmg 14 every 12 range 1 train s 2.08
STRUCT forge Assembly Line cost 150 hp 400 build s 3.33 trains grunt,lancer,brute,howler,spiker,dart
STRUCT turret Heat Lamp cost 100 hp 150 build s 2.50
STRUCT mill Mill cost 75 hp 200 build s 2.50
STRUCT well Well cost 50 hp 150 build s 1.67
STRUCT toaster Toaster cost 100 hp 250 build s 2.50
TIERS {"1":{"unlocks":["worker","mill","well","toaster","extension","turret","windmill","dam"]},"2":{"need":"toaster","unlocks":["forge","grunt","lancer","spiker","pylon"]},"3":{"need":"power","unlocks":["brute","howler","dart"]}}
BAKERY wheatPerFlour 10, millTicks 480 (1 flour / 20 s), wellTicks 144 (1 water / 6 s), toasterTicks 120 (5 s), slicesPerBake 4, pantryCap 6 (+3 per Toaster), springEvery 2, pilotTicks 480, pilotFloor 4, startStack 8
ENERGY make strip 2, windmill 3, dam 6, milldam 14; use toaster 2; cost windmill 40, dam 90, milldam 160; fence 1 per 8 tiles
POWER range strip 14, outlet 10, extension 12, pylon 8 (pylon-to-pylon link 16); cost extension 30, pylon 60
Sites: windmill pads 12 to 40 tiles from side 0's Strip; dams 147-149 tiles; Mill Dam 113 tiles; map springs at (14,226) [near side 0] and (241,29)
```

Derived (same code, my arithmetic):

| Item | Per-slice damage | Slices a minute while firing | Wheat a minute of flour while firing | Core (2400 hp) by one unit's full load or volley |
|---|---|---|---|---|
| Popper | 3 shots x 20 = 60 | 13.3 | 33 | 120 shots = 40 slices = 100 Wheat |
| Zapper | 3 x 18 = 54 | 16 | 40 | (not computed) |
| Flak Popper | 3 x 15 = 45 | 13.3 | 33 | no air targets exist |
| Broiler | 3 x 30 = 90 (x1.5 vs buildings = 135) | 13.3 | 33 | 54 shots = 18 slices = 45 Wheat (range 9 is only usable to sight 7, section 11) |
| Four-Slice | 36 per 4 slices = 9 (x2 vs buildings = 18) | 192 | 480 | 34 volleys = 136 slices = 340 Wheat |
| Bagel | none (no toast; power gate) | 0 | 0 | 171 hits = 86 s for one Bagel |
| Heat Lamp (turret) | none (no toast, no energy row) | 0 | 0 | 24 dps, 100 Wheat; fires with or without power (section 11) |

Flour rule: 1 flour + 1 water = 4 slices, so 1 slice = 2.5 Wheat of flour. Toaster at full speed = 12 flour a minute = 120 Wheat a minute (71% of 6 Crumbs at ~28/min, RESOURCE-FLOW). One Mill = 3 flour a minute.

Income: a Crumb mines 5 per 200 ticks = 36 a minute raw (chain on: economy.mjs mineTicks/carry), about 28 a minute with walking (RESOURCE-FLOW; T1 measured 30 alone and 160 for six). 6 Crumbs = about 168 a minute.

## 2. Adjacency list (A -> B: A is needed for, feeds, or unlocks B)

Edges are hand-derived from the code paths named in brackets. The numbers in section 1 come from the node run.

```
Wheat -> Crumb                     train at the Power Strip, 50 [stats.mjs core.trains]
Wheat -> Mill, Well, Toaster, Heat Lamp, Extension Box, Windmill, Dam, Mill Dam, Relay Pylon, Assembly Line   build [commands + placeCheck]
Wheat -> Popper, Zapper, Flak Popper, Four-Slice, Broiler, Bagel   train at the Assembly Line [stats.forge.trains]
Wheat -> upkeep                    5% a minute of each army unit's cost; Crumbs exempt [budget, toaster.upkeepPercent]
Wheat -> flour                     Mill takes 10 per flour, 1 flour / 20 s, only while the pantry has room [bakery.mjs:149-153]
Crumb -> Wheat                     mines 5 per 200 ticks, gathers to the Strip [economy.mjs]
Crumb -> Popper..Bagel (toast)     hauls 2 slices per run from the Strip stack, reserve 2 [ammo.mjs:242-271]
Crumb -> cords                     place Extension, Windmill, Dam, Pylon (adjacent, linked, plugged) and re-plug cut units [power.mjs:178, 194-223]
Crumb -> Heat Lamp/Mill/Well/Toaster   walk and build
Mill -> Flour                      [bakery.mjs:149-153]
Well -> Water                      needs water within 4 tiles or the spring; a spring draws every 2nd beat; Wells crowd each other [bakery.mjs:85-105, 109-113]
Flour -> Toaster                   pantry, instant, no carrier [bakery.mjs:162-170]
Water -> Toaster                   same
Energy -> Toaster                  2 each; newest Toaster sheds first when short [energy.mjs:94-103; bakery structurePowered]
Power Strip -> Energy              2, free, always lit [energy.mjs make.strip]
Power Strip -> Toast stack         starts at 8; pilot light 1 slice / 20 s when the stack is under 4 [bakery.mjs:172-180]
Power Strip -> cord reach          14 tiles [power.mjs POWER.range.strip]
Windmill -> Energy                 3 (must be placed on a pad; cord-linked at placement)
Dam -> Energy                      6 (river site, 147-149 tiles away)
Mill Dam -> Energy                 14 (site 113 tiles away)
Extension Box -> cord reach        12 tiles, 30 Wheat, instant
Relay Pylon -> cord reach          8; pylon-to-pylon 16; 60 Wheat
Cord reach -> fighter movement     stepVerdict: a plugged unit outside its cord is sent back [power.mjs:160-175, enforceCords]
Cord reach -> Bagel                power gate [ammo canMove]
Energy -> Heat Lamp                INTENDED (combat.mjs:31, :41) but NOT enforced: the isPowered hook passes turrets (sim-territory.mjs:92-95; T1)
Energy -> Fence                    1 per 8 tiles [energy.mjs:18, 86-89]
Fence -> enemy ground lines and enemy cords   walls [power.mjs enemyWallTiles, liveGroundLines]
Toaster (complete) -> Toast        4 slices per 5 s, needs power + flour + water [bakery.mjs:162-170]
Toaster (complete) -> Assembly Line gate   tier 2 "needs a Toaster" [stats.toasterTiers.2; tiers.mjs kitchenNeedMet]
Toaster (complete) -> Relay Pylon  gate, tier 2
Toaster (complete) -> Popper, Zapper, Flak Popper   gate, tier 2 (also needs an Assembly Line to train them)
Windmill or Dam (point exists) -> Four-Slice, Broiler, Bagel   gate, tier 3 "needs a Windmill or Dam" (existence only)
Toast -> Popper, Zapper, Flak Popper, Broiler   1 slice = 3 shots
Toast -> Four-Slice                4 slices = 1 volley [ammo.mjs:50]
Toast -> the Bagel                 none
Heat Lamp -> enemy units and buildings within 5   12 damage / 12 ticks; no slices [stats.toaster.structures.turret; ammo: turret has no slices]
Popper..Four-Slice..Broiler -> enemy Crumbs, buildings, Power Strip   damage; buildings x1 Popper, x1.5 Broiler, x2 Four-Slice [combat.mjs:118]
Enemy fighter within 2 tiles -> a Crumb run   raid cuts the run [ammo.mjs:230-237]
Enemy Crumb -> cord cut             an enemy standing on a plugged unit's cord line cuts it [power.mjs:287-297]
Power Strip (2400 hp) destroyed -> match won by the other side   [env/sim.mjs:112-114, reason core]
Timer (21600 ticks) -> score decides   [stats.match.maxTicks]
Claim (Totem or Mound) -> Reach held -> Territory win   claims = [] on /play; no button [sim-territory.mjs:199; territory.mjs:157]
Drill, Siphon, Track, Depot, Press, Trading House -> (economy chain)   state.chain on; no card button [economy.mjs; stats.economy, stats.market]
Flux, Alloy -> upgrades, Press   no producer on the card [stats.resources]
Neutral camp -> item drops -> upgrades/units   no file imports env/neutrals.mjs (grep)
```

## 3. Orphans (nothing feeds them, or nothing needs them)

Nothing feeds them on /play (data only):
- 33 upgrades in `UPGRADES` (env/stats.mjs:46-86): 12 Weapons/Hide rows (ground and air, levels 1-3), 21 land and unit rows. The only path to them is `doResearch`, and /play deletes `state.research` (toaster-play.mjs:49). Combat reads no upgrade (`env/combat.mjs:118` uses only `structureMultiplier`).
- Flux and Alloy: produced only by Siphons and Presses, neither on the card. Consumed only by research and Press.
- Glowmoss, Stormglass, Quakestone, Ironroot, Amberlight (stats.resources): no pickup on /play.
- Neutral camps, the 9 items (`items.list`), the 3 camp strengths (`neutrals.strengths`): `neutrals.mjs` is imported by nothing, so the sim never sends camps. play/app.mjs:713-745 draws them only if they arrive.
- Drill, Siphon, Track, Depot, Press, Trading House: the economy chain is on, but no card button (the card lists `STATS.structures` only, input.mjs:177). Reachable only by a scripted command (UNVERIFIED which path).
- Totem, Mound, claims, Tunnels (env/effects.mjs doTunnel): no card button, `state.claims = []`.
- Sockets (Wheatfield generator sockets): parsed in env/map.mjs:115-138, drawn in play/toaster-buildings.mjs and minimap-kitchen.mjs, read by no rule in env/.
- GHT-only unlocks: mender, shade, mast, seer, conduit, skiff, barge (`STATS.tiers`, env/stats.mjs:235-243). Foundry, Sanctum and Hangar are not in `STATS.structures`.
- Air: no flying unit exists in the Toaster roster. Air upgrades (6 rows), Stormglass's "air units" use, and the Flak Popper's "anti-air" text have no target. The Bagel is listed as a flyer in `env/fence.mjs:27`, which is wrong (section 11).

Card buttons that do nothing (play/input.mjs:457-470, `soon(...)`): Roll (Bagel), Shove (Four-Slice), Target (Heat Lamp), Pilot (Strip), Unplug (stations). They show "Coming" and have no command.

Built, but nothing needs them to win: Mill Dam (a Windmill already opens tier 3, and a Toaster needs only 2 power). Pylon (only needed past the Extension Box reach, and the Extension Box does the same job for 30 instead of 60 per 12 tiles).

## 4. Dead ends (feed nothing the player needs to win)

- Heat Lamp: defends a base, feeds no win step (T1 agrees). Its power gate is not enforced, so it fires with no power at all. As it stands it is the cheapest sustained damage on the card (24 dps for 100 Wheat, no toast) and beats all four tier-2 fighters 1 v 1 (T2). That makes it an alternative to fighters, not a step toward them.
- Fence: walls enemy ground lines and enemy cords; costs energy; nothing needs it.
- Dam and Mill Dam: energy only; the Windmill (40) already satisfies the tier 3 gate and powers one extra Toaster.
- Bagel's toast-free fire: feeds the Core kill, so not a dead end, but it is the one unit that never draws on the kitchen.
- Flak Popper: feeds the Core kill as a ground fighter; its anti-air purpose has no target. Half a dead end.
- Upkeep: a sink by design (5% a minute of army value).

## 5. Loops

Makes sense:
- Wheat -> Crumb -> Wheat: a Crumb (50) pays back in 50 / 28 = 1.8 min. A compounding loop.
- Power Strip -> pilot toast -> Power Strip: a designed no-softlock (COMBAT.md 2), so the side that loses its kitchen can still crawl.
- Toast -> Crumb run -> fighter -> Toast spent: the carry loop. Enemy fighters within 2 tiles break it (raid), so it is a real contest.

Does not make sense:
- Wheat -> Mill -> Flour -> Toaster -> Toast -> Four-Slice -> (no Wheat back): 480 Wheat a minute of flour at full fire, and the fight returns no Wheat. Four-Slice is the loop that costs more than the whole economy mines (6 Crumbs = 168 a minute).
- Fights do not return Wheat on /play (grep: no bounty in env/combat.mjs, sim.mjs, sim-territory.mjs or referee.mjs; neutral camps not wired). So every loop that starts at Wheat and passes through a fight ends with less Wheat. The only Wheat that comes back is by killing enemy Crumbs (their income stops).
- Energy: a Toaster uses power and returns none. A Windmill makes power and needs 40 Wheat plus a cord link to reach a Toaster. Not a loop, but the Windmill's gate only checks that a Windmill exists, not that it is lit (a cut Windmill still opens tier 3).

## 6. The chain to a win, Wheat-only, 6 Crumbs, no losses

The enemy Strip is 219 tiles away (Chebyshev) from ours (18,232) to (237,23). A fighter cannot walk there unless a cord chain of our own points reaches it: each fighter must be within its cord of our point (power.mjs stepVerdict). So the real chain has a cord step, not only a Wheat step.

| # | Step | Wheat | Time at 168/min (cumulative) | It exists so that |
|---|---|---|---|---|
| 1 | Mill (75) + Well by water or spring (50) | 125 | ~0:10 | flour and water exist for the Toaster |
| 2 | Toaster (100), powered by the Strip's own 2 energy | 100 | ~0:45 (first toast ~1:00: flour arrives 1 per 20 s) | toast exists |
| 3 | Assembly Line (150), needs a complete Toaster | 150 | ~1:50 | fighters can be trained |
| 4 | 7 Poppers (75 each), each loaded to 6 slices = 18 shots on spawn (ammo.mjs:330) | 525 | ~5:00 | the army exists; 7 full loads = 126 shots x 20 = 2520 >= 2400 Core |
| 5 | Extension Box chain, 12 tiles a hop, 17-19 boxes across ~205-219 tiles (instant, 30 each) | 510-570 | ~8:20 | the cord reaches the enemy Strip, so the army can walk there |
| 6 | Flour for the 7 full loads (42 slices = 10.5 flour) + upkeep (~26/min) | ~105 + ~80 | ~8:45 | the loads are made |

Earliest win by a 7-Popper rush: about 8.5 to 9 minutes, with nothing lost. Cord breaks, enemy fences (wrap is on, so bends cost length) and enemy cuts push it later. The timer is 15 minutes (21600 ticks), so the chain fits, but only just with one raid. The 17-19 box count is a straight-line estimate; T1 measured 12 boxes (about 360 Wheat) to reach the home Dam at (88,85), so the real route cost is UNVERIFIED.

Tier-3 branch (for a long game): Windmill (40) plus Broiler (175) = 215 Wheat more, and the Broiler is the best per slice against buildings (135 per slice, 45 Wheat for a Core). Four-Slice (225) is the worst per slice against anything.

Tier-2 branch (Pylon, 60): only needed to pass the Extension Box reach. 16 per pylon-to-pylon hop costs 60, so the box chain (12 per 30) is cheaper for the same distance.

## 7. Weakest links (ranked, with numbers)

1. The cord chain. 17-19 Extension Boxes (510-570 Wheat, about 3.5 min of income) and a Crumb walking the line. Nothing on the card says so. Any enemy standing on a line cuts it (power.mjs:287-297), and enemy fences wall it (power.mjs enemyWallTiles, wrap on).
2. Flour. A Toaster at full speed = 12 flour a minute = 120 Wheat a minute; one Mill makes 3 (30 Wheat a minute). With one Mill the Toaster runs at 25% (12 slices a minute, about one Popper firing). Four Mills (300 Wheat) per Toaster.
3. Four-Slice. 192 slices a minute while firing = 480 Wheat a minute of flour; 9 damage per slice (18 vs buildings), against 60 for a Popper. Tier 3's headline unit is the worst use of toast on the card.
4. Tier 3 gate checks only that a Windmill or Dam exists (tiers.mjs kitchenNeedMet reads `state.power.points`). A cut Windmill still opens Four-Slice, Broiler and Bagel.
5. The Heat Lamp beats the tier-2 army for nothing: 24 dps, no toast, and (because its gate is not enforced) no power either. An attacker's cord chain and fighters that stand near one face that damage with no toast to spend. Nothing on the card explains that trade.

Not a weak link: Crumbs (income 28 a minute each, payback 1.8 min), Popper (60 damage per slice; the best toast-per-damage fighter of tier 2).

## 8. The intended chain, in plain words

Tier 1 (open from the start, Wheat only):
- Crumbs mine Wheat, so the bank can pay for the kitchen.
- Mill and Well exist so flour and water can be made; Toaster exists so flour + water + power can become toast.
- Extension Boxes exist so the cord reaches far enough for a Crumb to plug a Toaster, a Windmill and, later, the enemy Strip.
- Heat Lamp exists so a base can defend itself without a fighter. (Intended: it fires only with power. Built: it fires without power, T1.)
- Windmill and Dam exist so more than one Toaster can run (the Strip alone makes 2 energy, one Toaster's worth).

Tier 2 (opens with a complete Toaster):
- Assembly Line exists so fighters can be trained; it is gated so no fighter exists before the toast does.
- Popper, Zapper and Flak Popper exist so there is a cheap toast-fed army. Popper is the Core killer at 100 Wheat of flour per Strip. Zapper is the fast short-range option. Flak Popper's anti-air purpose has no target. Against the tier-1 Heat Lamp, the tier-2 army has no answer (T2: the Heat Lamp beats all four 1 v 1), so tier 2 answers nothing tier 1 cannot already do.
- Relay Pylon exists so a cord can jump 16 tiles pylon to pylon (the card's text says 16 for every link; it is 8 to anything but another pylon, section 11).

Tier 3 (opens with a Windmill or Dam standing):
- Broiler exists so there is a splash shooter that is the best per slice against buildings (135). Its range 9 is only usable to its sight of 7 (section 11).
- Bagel exists so there is a power-only melee rammer that uses no toast.
- Four-Slice exists so there is a 240 hp, range 5 tank. Its toast cost (192 slices a minute while firing) is the weakest link on the map; it is not a sensible tier-3 purchase over Broiler or Bagel.

Win: destroy the enemy Power Strip (2400 hp), or hold the higher score at the 15-minute timer.

## 9. The 10 smallest changes that give every item a purpose

Ranked smallest first. Each names the file and the owner from reports/2026-10-26/ROLE-CARDS.md. Where no card owns a file, the owner is marked for Joshua.

1. env/fence.mjs:27: delete `'bagel'` from FLYERS (one token; the Bagel is a ground rolling unit). Owner: none on the cards (fence.mjs); suggest Combat Systems Engineer. Joshua to confirm.
2. env/vision.mjs:8: howler sight 7 -> 9 (one number), so the Broiler's range 9 can be used. Owner: Combat Systems Engineer (card 2 owns the targeting reads in vision.mjs).
3. play/input.mjs:457-470: remove the five "Coming" buttons (Roll, Shove, Target, Pilot, Unplug) until each has a command. Owner: Controls Engineer (card 7).
4. play/hud-tips.mjs:63: Relay Pylon text "links up to 16 tiles" -> "16 to another Relay Pylon, 8 to anything else" (read STATION.pylon.shortLink). Owner: UX Writer (card 9).
5. env/stats.mjs:437 and :442 (text only): drop "hauls ... flour, water" from the Crumb and "anti-air" from the Flak Popper. Owner: UX Writer (card 9).
6. play/kitchen-panel.mjs:25: the Mill Dam button shows 90; the site charges 160 (play/station-controls.mjs:11). One price table. Owner: Power and Bakery Engineer (card 12 item 1).
7. env/sim-territory.mjs:92-95: the isPowered hook passes turrets; make it return `structurePowered` for a turret, so the Heat Lamp's power gate (card 2 item 5) holds. Owner: Combat Systems Engineer (card 2 item 5).
8. play/toaster-play.mjs:49 and env/territory.mjs:157: switch the territory win off on /play, since no claim can be placed. Owner: Match Rules Engineer (card 1).
9. env/ammo.mjs:50: lower the Four-Slice volley cost from 4 slices, so it stops burning 192 slices a minute. One number. Owner: Balance toolsmith (the number), Power and Bakery Engineer (the file).
10. env/stats.mjs:46-86, play/toaster-play.mjs:49, env/combat.mjs:118: keep research on /play with Ground Weapons 1 priced in Wheat (flux 0) and read its +1 damage in combat, so the 33 upgrades have a first buyer. Owner: Tech Tree Engineer (card 3) and Combat Systems Engineer (card 2). Three lines, so it is the largest of the ten.

Next, not in the ten (each bigger or a Joshua call): the 6 Air upgrade rows (env/stats.mjs:50-51, Tech Tree); the GHT-only unlock names (env/stats.mjs:235-243) and RULE_STRUCTURES entries /play never places (env/stats.mjs:474-481, Tech Tree and Construction); the tier-3 gate checking that a Windmill is lit, not only placed (env/tiers.mjs, Tech Tree); the neutral camps and their 9 items (env/neutrals.mjs is imported by nothing; no card covers camps; Joshua to name an owner); the Wheatfield sockets (env/map.mjs:115-138; Power and Bakery, or delete); the drill/depot/press/house buttons (Construction Engineer).

## 10. Not verified

- Whether the sim accepts drill, depot, press or house from a command on /play (`economy.mjs:671` checks the tile; the command route is not traced).
- Whether a Heat Lamp can target a station (Extension Box) inside its 5 tiles.
- The Wheat-per-field figure (8 fields of 14,400 in HIVE.md): I checked 1800 per tile and the Crumb rate, not the field count.
- The 28 Wheat a minute per Crumb with walking is RESOURCE-FLOW's figure (T1 measured about 27), not re-derived.
- The chain's box count (17-19) is a straight-line estimate; the real route is not traced.

## 11. Reconciliation with purpose-T1, T2, T3 (landed during this report)

Agreed with them (their measurement or line, my reading):
- Heat Lamp feeds nothing; it is a dead end (T1). Its power gate is not enforced: `stepVerdict` returns null for a unit with no power record, and the isPowered hook passes turrets (sim-territory.mjs:92-95, T1). My section 2 and section 4 now say so.
- Heat Lamp beats all four tier-2 fighters 1 v 1 (T2). Tier 2 answers nothing a tier-1 Heat Lamp can't.
- Broiler range 9 is capped by sight 7 (`env/vision.mjs:8`), so 8-9 is dead ground (T3).
- Mill Dam button shows 90, the site charges 160 (`play/kitchen-panel.mjs:25` vs `play/station-controls.mjs:11`, T3).
- Relay Pylon text "16 tiles" is wrong for everything but a pylon (`play/hud-tips.mjs:63`, T2).
- Bagel is listed in FLYERS (`env/fence.mjs:27`), so fences never stop it (T3).
- Four-Slice: 9 damage per toast slice, the worst on the card (T3 agrees with my table).
- Roll and Shove are "coming" buttons with no command (T3).
- Dam: 90 Wheat for 6 Power, about 360 Wheat of boxes to reach the home Dam (T1). Weaker than the Windmill, as in my section 3.

Disagreements (my reading kept, with the reason):
- T1 says Crumbs haul Flour and Water. The code does not: `stepBakery` writes flour and water straight into the pantry (`env/bakery.mjs:151-165`), and the only run is toast (`env/ammo.mjs:242-271`). The ROSTER text at `env/stats.mjs:437` is wrong. My weakest-links list therefore has no raid point on flour or water.
- T3 says `kitchenNeedMet` checks that the Windmill or Dam point is `complete`. It does not: the power point has no `complete` field, and the tier-3 branch is `points.some(kind windmill|dam)` (`env/tiers.mjs`). My "existence only" stands.
- T1 gives the Extension Box range 12 and the STATION link 8 (`env/power.mjs:415`). The cord network uses max(range), so 12 is what the live game uses; 8 applies only to the ground-line fence. Not a purpose gap.
- T2 gives the Assembly Line and tier-2 Popper a train time of 30 ticks (the overlay). The node run gives 1.25 s = 30 ticks. Same number.
