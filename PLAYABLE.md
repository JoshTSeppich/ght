# PLAYABLE.md: what's needed before Joshua can just mess around in Ghosties, Hosties, and Toasties (23 Oct, 21:17)

Joshua: "I just want to mess around in the game. Are the farming mechanics and costs of things all squared up?"

Short answer: **No, not yet.** The bread chain exists in the code, but it's a mix of old GHT numbers and new
toaster rules that were never balanced together. Several things on screen are leftovers, power is free, and nothing
teaches you what to do. Facts checked in code tonight:

- **Start:** 100 Wheat, 6 Crumbs standing idle, 1 Power Strip, 8 slices of toast. Crumbs don't gather until you
  right-click wheat.
- **Wheat is still "Shards" inside the code.** A trip carries 5-10, and each field tile holds 1800.
- **Mill:** 75 wheat. Grinds 10 wheat into 1 flour every 8 s, so a busy Mill eats about 75 wheat a minute.
- **Well:** 50 wheat. 1 water every 6 s by the river, much slower at a spring.
- **Toaster building:** 100 wheat. 1 flour + 1 water makes 4 slices every 5 s. It only needs to be "powered", and
  the Strip is always powered, so electricity costs nothing.
- **Pantry:** holds at most 6 flour and 6 water.
- **Units cost wheat only:**

  | Unit | Wheat |
  |---|---|
  | Crumb | 50 |
  | Popper | 50 |
  | Zapper | 75 |
  | Four-Slice | 150 |
  | Broiler | 150 |
  | Flak Popper | 100 |
  | Bagel | 100 |

- **Upkeep:** 5% of a unit's cost per minute in GHT (the classic rate is 10%), in wheat, with no supply cap (yet the top bar shows "Supply 6/40").
- **Ammo (as of 26 Oct):** a Popper has 6 slots and fires one slice every 4.5 s (three 20-damage shots, 1.5 s apart), so about
  13 slices a minute while fighting (`ECONOMY.units.grunt.slicesPerMinuteFighting`; env/ammo.mjs ARMED). The 23 Oct figures (3 slices, 0.75 s, 80 a minute) are superseded.
- **Leftovers still switched on in the default match:**
  - the Drift (floods, quakes, blooms on a timer);
  - the old Trading House market (flux, glowmoss);
  - tiers ("Hold 1/3 for Tier 2");
  - upgrades that cost Flux and Alloy, which this map doesn't have, so they can never be bought.
- **Windmills and dams** (the planned power sources) don't exist in the game rules.
- **Not built in the rules:** Bagels need power but no slices, and Flak Popper anti-air has no air units to shoot at.

## The list (in order: 1 makes it playable, 2 makes it fair, 3 makes it fun)

### 1. Make it playable (must have)
1. One source of numbers: an ECONOMY table in env/stats.mjs, plus a written ECONOMY.md with every cost and rate in
   plain words, and a test that the HUD shows the same numbers.
2. Rename Shards to Wheat everywhere (state, observe, HUD, tooltips, bots, tests), keeping an alias for old saves.
3. Crumbs auto-gather the nearest wheat at the start and when idle, plus an idle-Crumb button that blinks.
4. A rally point on the Power Strip and the Assembly Line (right-click sets it).
5. Build placement shows a green or red footprint and the reason: no wheat, out of power reach, blocked, Well not
   near water.
6. Every button tooltip shows its cost, what it does, and its hotkey.
7. Training queue: the Assembly Line and the Strip show a progress bar, with up to 5 queued.
8. Top bar: Wheat, Flour, Water, Toast (stack), Power, and Upkeep per minute (red when negative), with income rates
   on hover.
9. Each building shows what it's missing (no wheat for the Mill, a full pantry, no water, no power) as a blinking
   icon above it.
10. Turn off the leftovers in the default match: the Drift, the old market and goods, tiers with Flux/Alloy costs,
    and the Supply readout. Keep them behind ?classic=1.
11. A real win and lose screen (Power Strip destroyed, or surrender), and Restart.
12. Difficulty choice for the opponent: an easy bot that builds slowly, plus the toaster-sonnet bot as normal.
13. Pause, speed (1x, 2x, 4x) and a free camera for messing around: a SANDBOX mode with no enemy (or a passive one),
    plus cheat keys for wheat and toast.

### 2. Square up the farming and costs (balance)
14. Write down the target economy curve and make the numbers serve it:
    - 0:00-2:00 Crumbs farm, first Mill, Well and Toaster;
    - 2:00-5:00 the first squad;
    - 5:00+ push with boxes;
    - 12-16 min a typical siege.
15. Wheat income per Crumb (carry and trip time) measured on Wheatfield distances, with the target that 6 Crumbs
    pay for a Mill + Well + Toaster in about 90 s.
16. Rebalance the Mill: it must not eat more than a Crumb brings. Target 1 Mill per 3 Crumbs, about 25-30 wheat a
    minute in and 3 flour a minute out.
17. Rebalance toast against fire rate: a Popper at 80 slices a minute is wrong. Shots per slice (2-3 shots per
    slice), ammo slots (6), and bake output, so one Toaster feeds about 4 fighting Poppers.
18. Unit costs against value: Popper 50 is too cheap next to its upkeep. Re-cost all 7 (and Crumb at 50).
19. Upkeep: 10% a minute with no cap snowballs into debt. Pick either a supply cap fed by Toasters (Supply = toast
    capacity) or lower upkeep; one system, shown in the HUD.
20. Make POWER a real resource:
    - Windmills on high-ground pads and Dams at river sites generate Energy;
    - each Toaster building and each fence draws Energy;
    - the Strip makes a little, for the no-softlock rule;
    - the HUD shows Power used out of Power made.
21. Extension Box (30) and Relay Pylon (60) priced against the cord rules; check that an Extension Box chain of 10
    to the enemy costs about one Popper squad.
22. Hungry state readable: "Hungry" over units, a growl, droopy eyes, and Crumbs auto-ferry toast to the front.
23. Pilot light (the Strip bakes 1 slice every 20 s below 4) shown in the HUD as the no-softlock safety net.
24. A balance test suite: scripted openings (6 Crumbs, then Mill/Well/Toaster, then 4 Poppers) that assert the
    timings in item 14, plus bot-mirror length tests.

### 3. Make it fun to mess around in (polish)
25. The bread chain visible: Crumbs carrying wheat sacks, the Mill sails turning, the Well bucket, the Toaster
    popping slices, the toast stack growing beside the Strip.
26. Sound: a pop on each shot, a ding when toast is ready, a Mill creak, Crumb chirps, a cord snap.
27. Selection feel: double-click selects all of a type, control groups 1-9, F1 for idle Crumbs, and the cords of the
    selected units light up.
28. The Wheatfield minimap shows wheat, water, windmill pads and dam sites, plus your power network.
29. A first-match tutorial in 5 popups: gather wheat, build the Mill/Well/Toaster, train Poppers, place boxes,
    attack the Strip.
30. Neutral camps on Wheatfield (TERRITORY.md section 13) and item drops, only after the economy is squared.
31. A performance check in a real browser on the MacBook Air: 200 toasters at 60 fps on Wheatfield.
32. A real-browser playtest checklist run by an agent with screenshots (Claude's built-in browser), not node tests
    only: start, farm, build, fight, win and lose.

## Who should do each item (Joshua, 21:20: "the types of candidate you'd want for that role")
Model tiers: **Sonnet** for code that touches the game rules or the renderer, **Haiku** for mechanical and test
work, **GPT (Codex)** for Design Studio visuals and copy, and the **Match Room experts** to review. Item numbers
match the list above.

| # | Candidate | Model |
|---|---|---|
| 1 | Economy systems engineer: one data table, a docs generator, contract tests | Sonnet |
| 2 | Refactor janitor: a mechanical rename with aliases, zero behaviour change | Haiku |
| 3 | RTS controls engineer who knows auto-gather and idle-worker conventions | Sonnet |
| 4 | RTS controls engineer (same seat as 3) | Sonnet |
| 5 | Placement and UX engineer: ghost footprints, validity reasons | Sonnet |
| 6 | UX writer: short, exact tooltips in toaster voice | GPT, checked by Haiku against the table |
| 7 | HUD engineer: queues and progress bars | Haiku |
| 8 | HUD and information designer: what goes on the bar, colours for warnings | Sonnet, plus GPT for the look |
| 9 | Game-feel UI engineer: status icons over buildings | Haiku, plus GPT for the icons |
| 10 | Integration engineer: feature flags, default vs classic | Sonnet |
| 11 | Flow engineer: match end, results screen, restart | Haiku |
| 12 | AI opponent designer: a deliberately weaker, readable bot | Sonnet |
| 13 | Tools and debug engineer: sandbox mode, time controls, cheats | Sonnet |
| 14 | Lead economy designer with StarCraft macro instincts: owns the pacing curve | Sonnet; Economy Designer and Pacing expert review |
| 15 | Data analyst: measures trips and income with scripted sims | Haiku |
| 16 | Economy designer: production ratios (worker : Mill : Toaster) | Sonnet |
| 17 | Combat designer: shots per slice, ammo, fire rates against toast output | Sonnet; Combat & Damage expert review |
| 18 | Unit-cost balancer: cost against value, counters | Sonnet; Fanatic Council review |
| 19 | Systems designer: one army limit (supply from Toasters, or upkeep) | Sonnet; decided with Joshua |
| 20 | Power systems engineer: windmills, dams, energy budget in the sim and HUD | Sonnet; GPT for windmill and dam models |
| 21 | Economy designer: prices for stations against cord reach | Haiku sweeps, Sonnet signs off |
| 22 | Game-feel designer: hunger readability, auto-ferry logic | Sonnet logic, GPT animation |
| 23 | HUD engineer (same seat as 8) | Haiku |
| 24 | QA and balance-test engineer: scripted openings and timing asserts | Haiku |
| 25 | Technical animator: Mill sails, Well bucket, popping slices, toast stack | GPT in the Design Studio, Sonnet wires it into /play |
| 26 | Sound designer: original synthesized sounds, no samples from other games | Sonnet with a procedural audio lib, GPT for the sound list |
| 27 | RTS controls engineer (same seat as 3) | Sonnet |
| 28 | Minimap and cartography engineer | Haiku |
| 29 | Onboarding designer: 5 steps, toaster voice | GPT copy, Haiku wiring |
| 30 | Encounter designer: neutral camps, item drops | Sonnet, after the economy is done |
| 31 | Performance engineer on a real MacBook Air | Sonnet, Air seat |
| 32 | QA playtester who drives a real browser and files bugs with screenshots | Haiku with the built-in browser, or Claude |

**Seats to run together:**
- One controls engineer owns 3, 4 and 27.
- One HUD engineer owns 7, 8 and 23.
- One economy lead owns 14, 16, 18 and 19, with the experts reviewing.
