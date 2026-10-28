# Research report under check: "Toaster Wars: Turning a Working Prototype into a Full StarCraft II-Style Real-Time Strategy Game"

Written 2026-10-26 by a research agent from outside sources. It is being DOUBLE-CHECKED: treat every number and quote below as a claim, not a fact. Toaster Wars numbers in it were invented from a brief that had errors (see HIVE.md).

StarCraft II feels complete because four systems press on each other all the time: finite resources that force players to spread out, a tech tree where every step costs something and locks you into a path, three levels of upgrades plus unit-specific upgrades that change exact fight math, and a counter system built on unit tags that rewards scouting and switching tech. Toaster Wars already has the economy skeleton (workers, a second resource, power, ammunition, supply, upkeep, high ground, control groups). The four pressure systems are missing or only partly built, and that is why bases never die, timeouts tie, and nobody has a reason to expand or switch tech.

## TL;DR
- What makes StarCraft II "complete": every base mines out, so players must expand. Tier jumps cost money, time and production capacity. Weapons and armor upgrades go to level 3 and are timed to change how many hits it takes to kill key units. Bonus damage against tags like Light and Armored creates soft counters (and a few hard ones). Games end when all buildings die, with stalemate detection as a backstop. Blizzard balanced all of this by aiming for 45-55% matchup win rates, looking at tournament results and pro feedback, and making small changes.
- What Toaster Wars needs (in priority order): fix how workers spread across fields and make fields finite. Add an expansion base (the "Outlet"). Give fighters a starting load of toast and add forward power so offence is cheap. Add a win rule based on key structures plus an overtime capture mode so matches end. Then add attribute tags and bonus damage, a three-tier tree with two add-ons and a branch choice, global upgrades with three levels, and one or two upgrades per fighter.
- How to balance it with bots: a combat sandbox, a breakpoint table generator, and a round-robin league of five scripted bot personalities plus "exploiter" bots, borrowed from how AlphaStar trained. Targets: each strategy wins 40-60% against the field, spawn-side win rate 47-53%, median match length 9-12 minutes, fewer than 10% of matches end on the timer, first attack between 2:30 and 4:30, and 1.5-3 expansions per player per game. At least 400 games per comparison; change one number by 10% or less at a time.

## 1. Tech tree anatomy in StarCraft II
- Terran: Barracks (infantry), Factory (vehicles), Starport (air); tech: Engineering Bay, Armory, Ghost Academy, Fusion Core. One add-on per production building. Tech Lab (50 minerals, 25 gas, 18 s) unlocks advanced units and that building's unit upgrades. Reactor (50/50, 36 s) "enables the attached building to build two units simultaneously and increases the size of its build queue from 5 to 8." Terran buildings lift off and land on other add-ons "to achieve tech swaps, tech rushes or early unit production."
- Protoss: Gateway (later Warp Gate) -> Cybernetics Core -> Twilight Council / Robotics Facility / Stargate -> Templar Archives, Dark Shrine, Robotics Bay, Fleet Beacon. Twilight Council gates Forge levels 2 and 3. Buildings must sit in Pylon power, but "even an unpowered Twilight Council still meets the prerequisites for all of the upgrades and buildings it unlocks."
- Zerg: Hatchery -> Lair -> Hive. Lair 150/100, 57 s; unlocks Hydralisk Den, Infestation Pit, Spire, Nydus Network, level 2 upgrades. Hive 200/150, 71 s, needs an Infestation Pit; unlocks Ultralisk Cavern, Greater Spire, Viper, level 3 upgrades.
- Tech switch: abandoning a unit composition for another; works only with money banked and the new tech built.

Key costs (Legacy of the Void, patch line 5.0.x; Liquipedia, "faster" seconds):
| Race | Building / step | Minerals | Gas | Time (s) |
|---|---|---|---|---|
| Terran | Barracks | 150 | 0 | 46 |
| Terran | Factory | 150 | 100 | 43 |
| Terran | Starport | 150 | 100 | 36 |
| Terran | Engineering Bay | 125 | 0 | 25 |
| Terran | Armory | 150 | 50 | 46 |
| Terran | Fusion Core | 150 | 150 | 46 |
| Terran | Tech Lab | 50 | 25 | 18 |
| Terran | Reactor | 50 | 50 | 36 |
| Terran | Orbital Command | 150 | 0 | 25 |
| Protoss | Gateway | 150 | 0 | 46 |
| Protoss | Cybernetics Core | 150 | 0 | 36 |
| Protoss | Forge | 150 | 0 | 32 |
| Protoss | Twilight Council | 150 | 100 | 36 |
| Protoss | Robotics Facility | 150 | 100 | 46 |
| Protoss | Stargate | 150 | 150 | 43 |
| Protoss | Templar Archives | 150 | 200 | 36 |
| Protoss | Warp Gate research | 50 | 50 | 100 |
| Zerg | Hatchery | 275 | 0 | 71 |
| Zerg | Spawning Pool | 200 | 0 | 46 |
| Zerg | Evolution Chamber | 75 | 0 | 25 |
| Zerg | Roach Warren | 150 | 0 | 39 |
| Zerg | Lair | 150 | 100 | 57 |
| Zerg | Hydralisk Den | 100 | 100 | 29 |
| Zerg | Spire | 150 | 150 | 66 |
| Zerg | Infestation Pit | 100 | 100 | 36 |
| Zerg | Hive | 200 | 150 | 71 |
Pattern claimed: a tier step costs roughly one to two production buildings' worth, takes 40-70 s, always costs some of the scarce second resource.

## 2. Upgrade systems
"In each category there are three levels. The second and third levels of most categories require an additional tech building."
| Line | Level 1 | Level 2 | Level 3 | Gate for 2-3 |
|---|---|---|---|---|
| Terran Infantry Weapons/Armor | 100/100, 114 s | 150/150, 136 s | 200/200, 157 s | Armory |
| Protoss Ground Weapons/Armor | 100/100, 121 s | 150/150, 145 s | 200/200, 168 s | Twilight Council |
| Protoss Shields | 150/150, 121 s | 200/200, 145 s | 250/250, 168 s | Twilight Council |
| Zerg Ground Carapace | 150/150, 114 s | - | - | Lair, then Hive |
| Zerg Flyer Carapace / Attacks | - | 175/175, 136 s (Lair) | 250/250, 157 s (Hive) | Lair, then Hive |
Claimed: Patch 5.0.13 cut Terran infantry upgrades "from 100/175/250 to 100/150/200". Claimed scaling rule: each level about 50% more than level 1 and about 20 s longer; level 2 or 3 needs a second tech building. Attack upgrade size "generally correspond[s] to being [base damage/10, min 1]". Attack upgrades "do not apply to damage caused by abilities."

Unit-specific upgrades:
| Upgrade | Cost / time | Change |
|---|---|---|
| Stimpack | 100/100, 100 s | +50% movement and attack speed for 11 s, costs 10 hp (Marine) / 20 (Marauder) |
| Combat Shield | 100/100, 79 s | Marine 45 -> 55 hp; "a shielded Marine beats a stimmed one with 7 hit points left" |
| Concussive Shells | 50/50, 43 s | slows 50% for 1.07 s |
| Metabolic Boost | 100/100, 79 s | Zergling speed +60% |
| Blink | 150/150, 121 s | short teleport, 7 s cooldown |
| Charge | (Twilight Council) | Zealot base speed to 4.725 plus a dash |
Breakpoint example: Marine 6 damage, 45 hp, 0 armor: 8 hits; +1 weapons: 7 hits; Combat Shield 55 hp: 10 hits, +1: 8 hits. "armor cannot reduce damage below 0.5".

## 3. Balance in practice
- "Talking Balance with David Kim": balance judged from "our internal data, tournament results, as well as the feedback we receive from pro-players and the community at large"; "a 45-55% win rate suggests that there is no sign of imbalance"; "it's not uncommon for a race that shows a 54% win rate this week to show 46% next week"; maps: "a 70% PvT win ratio on Cloud Kingdom ... and a 37% win ratio on Metalopolis for TvZ"; small changes because "careers [are] on the line"; "balance via map design is something we've been pushing for."
- Damage model: hit points, armor 0-3, cooldown, tags (Light, Armored, Biological, Mechanical, Massive, Structure, Psionic); Marauder 10 (+10 vs Armored); armor floor 0.5.
- Dustin Browder: "Starcraft is a game of hard counters and of muddy counters ... the original Starcraft had ... Archons, Ultralisks and Firebats, all of which are really hard counters ... Dragoons, Hydralisks, Zealots and Marines that are very muddy counters." "Our goal for Starcraft is not having the maximum number of units possible, but the minimum. We are not trying to make the biggest game, we are trying to make the smallest, best game."
- Lanchester: Stanescu, Barriga, Buro, "Using Lanchester Attrition Laws for Combat Prediction in StarCraft" (AIIDE 2015): unit strength "learned using maximum likelihood estimation from past recorded battles"; attrition order between 1 and 2. Proposed index: cost-efficiency ~ sqrt(damage per second x hit points) / cost.
- Mining: first two workers on a patch about 40/min each, third about 20; 3 on a patch ~102/min; 3 on a geyser ~114 gas/min; 16 optimal, 24 maximum per base.
- LotV December 2014 update: resources cut to 70% "encouraged players to move out more and take expansions more aggressively which led to action packed games." Half of each base's patches small. Claimed: Patch 5.0.16 (June 2026) set large patches to 1,600, small to 1,100, geysers to 2,500.
- AlphaStar (Nature, October 2019): main agents, main exploiters, league exploiters; Grandmaster with all three races, above 99.8% of ranked players.
- Volz, Rudolph, Naujoks (arXiv 1603.03795, 2016): tested on Top Trumps; "a multi-objective evolutionary algorithm to obtain decks that optimise objectives, e.g. win rate and average number of tricks". Morosan and Poli applied evolutionary balancing to StarCraft. Onal and Bulbul (2025): near-Nash point where "each unit is equally preferable".

## 4. What makes StarCraft II dynamic
Macro vs micro; scouting and denial; build orders and timing attacks; harassment; expansions and map control (natural behind a choke); defender's advantage; Warcraft III upkeep 100% income at 0-50 food, 70% at 51-80, 40% at 81+ ("High Upkeep is MEANT to be very punishing"); win condition "Destruction of all of a player's buildings"; stalemate detection: if no player has income, production or destroyed structures for three minutes, the game ends in a draw; map design (rush distance, natural, high ground, watchtowers, destructible rocks).
Minimum set claimed: finite resources with diminishing worker returns, expansions, scarce second resource gating tech, tiered tree with visible commitment, three-level upgrades plus a few unit-changing upgrades, tag-based bonus damage, splash, air vs anti-air, a fast raider, static defense, a decisive win condition, a map with chokes, high ground and a contested middle.

## 5. Other games
- Battle Aces (Uncapped Games, David Kim; founded June 2021 by LightSpeed and Quantum Studios Group, a Tencent subsidiary; announced Summer Game Fest 2024): no workers/production buildings/supply depots; "automated resource gathering, instant unit-spawning, and preset expansions"; 8-unit deck; "Intelligence Bar"; cancelled May 23, 2025: "the returns from early testing were not strong enough to support continued development".
- Stormgate (Frost Giant): full launch August 5, 2025; Tim Morten (Game Developer, Aug 21, 2025): "We're at 20 percent of what we saw during early access, and that is not a sustainable place for us to be"; raised "almost $40 million"; about 48 staff.
- Beyond All Reason / Zero-K: streaming economy, no worker trips, no finite fields.
- Company of Heroes: points must connect to base for income; observation post +40%; Victory Point ticket drain 250/500/1000.
- Age of Empires IV: landmarks with two age-up choices; variant civilizations.
- Warcraft III: upkeep (above).
- Faction structure: matchups grow as n(n+1)/2; recommend one mirrored faction, later AoE4-style variants.

## 6. Ending matches
All-buildings win condition, stalemate detection, mine-out, splash and siege vs static defense, CoH ticket drain, WC3 upkeep.

## Proposed Toaster Wars design (sections A-G, condensed)
A. Checklist claims: has worker economy; partial saturation; MISSING finite resources; MISSING expansions; partial second resource; has power/water; has supply+upkeep; partial production buildings; partial tiers; missing add-ons; PARTIAL upgrades ("level 1 only"); missing unit upgrades; missing tags; partial armor; partial splash; HAS air vs anti-air; partial raider; has static defense; has high ground; partial chokes; missing watchtowers/rocks; partial scouting; missing timing attacks; missing tech switching; partial win condition; missing stalemate prevention; has hotkeys; has bots.
B. Tree: Tier 1 Power Strip, Outlet (new expansion, 300 Wheat, 60 s), Mill, Well, Toaster (unlocks tier 2), Windmill, Extension Box, Heat Lamp. Tier 2 Assembly Line (needs a Toaster), add-ons Twin Slot (2 at once) and Timer Dial (quality), Test Kitchen (research), Relay Pylon. Tier 3 Fuse Box (Assembly Line + Windmill or Dam), Grill Works (Four-Slice, Broiler), Hover Rack (Bagel as AIR), Dam/Mill Dam; Breaker Panel (Fuse Box + an Outlet) for level 3.
C. Upgrades: Hot Coils / Thick Crust / Updraft Coils / Sugar Glaze at 100+10 Flour, 150+20, 200+30; 75/90/105 s; +1 damage light, +2 heavy. Unit upgrades: Toast Tote, Crust Plating (Popper 60->75 hp), Spring Trigger (+1 range), Static Cling, Long Lead, Kernel Burst, Extra-Wide Slots, Bread Bin Armor, Preheat, Top Element, Poppy Seed Thrusters, Everything Seasoning. Breakpoint table built on INVENTED stats (Popper 8 damage).
D. Roster with tags Light/Heavy/Wired/Baked/Airborne/Huge/Structure; INVENTED stats (Popper 60 hp 8 damage range 5; Zapper 45 hp; Flak Popper 100+5 Flour; Four-Slice 300 hp armor 2; Broiler 200+20 Flour, 160 hp; Bagel AIR 175+15 Flour). Targets: cost efficiency within +-15% of Popper; counter fights keep 0-25% / 30-50% / 60-80%; time to kill 6-10 s; upkeep 30-45% of two-base income.
E. Balance plan: metrics table (spawn win rate 47-53%, strategy vs field 40-60%, median length 9-12 min, timer endings <10%, main base dies >=70%, first damage 2:30-4:30, first Outlet 2:30-4:30, 1.5-3 expansions, tier 3 in 60-85% of long games, each fighter in 20-90% of games, comeback 20-35%, idle workers <5%); combat sandbox; breakpoint generator; 5 bot personalities; exploiter loop; +-10% sweeps; map tests; 400 games minimum (margin ~+-5%).
F. Fixes: F1 key-structure win rule, Strip death unpowers cords, Four-Slice +20 vs structures, bot attack at 1.3x army value / retreat at 0.7x. F2 Crumb Jar capture points at 11:00 draining a 300-point meter; stalemate detection after 2 min; tie-break by damage to structures. F3 fighters spawn with full toast; Toast Tote; Outlets as power hubs; Relay Pylon reach 20; neutral Wall Sockets. F4 2 Crumbs per tile at full rate, 3rd at half, cap 3, bounce. F5 finite home field 8 tiles at 900/500 (5,600 total), natural Outlet sites, golden middle field +40%, Breaker Panel needs an Outlet.
G. Build order: Phase 1 (13 tickets: worker spread, saturation display, finite tiles, Outlet, natural + golden field, starting toast, Relay Pylon buff, Wall Sockets, win rule, Strip death unpowers, stalemate detection, Crumb Jar overtime, bot attack/retreat); Phase 2 counters (tags, roster v1, combat sandbox, breakpoint generator); Phase 3 tree and upgrades; Phase 4 map and information; Phase 5 balance machinery.

Caveats the report itself gave: Toaster Wars numbers are starting points, untested; a Toaster burns 1 Flour per 5 s (12/min) while a Mill makes 3/min; Liquipedia's Building Statistics summary can lag patches; Battle Aces and Stormgate lessons come from previews; bot win-rate bands need larger samples than human ladder data.

Sources the report listed: Liquipedia StarCraft II pages (Tech Lab, Reactor, Twilight Council, Pylon, Lair, Hatchery, Hive, Upgrades, Engineering Bay, Armor, Marauder, Mining Minerals, Buildings, Stalemate Detection, Patch 5.0.16, Planetary Fortress, Building Statistics); Blizzard news (Talking Balance with David Kim; LotV Multiplayer Development Update Dec 17 2014; StarCraft II 5.0.16 Patch Notes); TL.net (David Kim Reddit Q&A transcript; Lanchester's square law thread; saturation thread); GameStar Browder interview; Digital Trends, VentureBeat, Sportskeeda on Battle Aces; Beyond All Reason guide; Company of Heroes and Age of Empires wikis; classic.battle.net and Liquipedia Warcraft III upkeep; arXiv 2311.17190; AlphaStar PDF; ResearchGate (Integrated Balancing of an RTS Game; Computational Game Unit Balancing based on Game Theory).
