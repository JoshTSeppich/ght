# PURPOSE: Tier 3 (what a Windmill or Dam opens) — read-only check, 2026-10-26

Scope: Four-Slice (brute), Broiler (howler), Bagel (dart), Mill Dam, and the tier-3 gate itself. Checked against code at the
file:line given. No game file was edited.

## Method
- Costs, toast and power: `env/economy-table.mjs` (ECONOMY), `env/stats.mjs` (`toaster` overlay ~line 160-180, `toasterTiers` ~line 250), `env/energy.mjs:15-19`.
- Toast rules: `env/ammo.mjs:46-54` (ARMED: slots, slices per attack, shotsPerSlice), `env/ammo.mjs:174` (spendShot).
- Combat: `env/combat.mjs:104` (stepCombat), `env/combat.mjs:76` (chooseTarget, fog gate via `isSeen`).
- Sight: `env/vision.mjs:6-9` (DEFAULT_SIGHT: howler 7, brute 6, dart 7, grunt 6, lancer 6, turret 7).
- Duels run in node with `env/combat.mjs` + `env/ammo.mjs` on `createTestState` (flat, 64x64, nothing else on the board):
  a full load each side (`st.ammo.slices` unset = full slots), no movement, no bakery resupply, both sides placed at the
  shorter of the two ranges (so both can fire at once). Winner, seconds, toast spent by each side (sum of `shot.slices`), kills.
  Group size n = round(cost of X / cost of Y), i.e. equal Wheat. One-on-one rows are in the report too.
- Limits, stated so the numbers are read right: (a) no movement, so a Popper that walks 4 tiles in ~0.5 s is not modelled;
  (b) Crumbs do not auto-fight (`env/combat.mjs:13` AUTO_KINDS has no worker), so Crumb rows are optimistic for the attacker;
  (c) no resupply, so a Four-Slice vs Power Strip "stalls" at 900 s, meaning it ran dry, not that it lost.

## Tier-3 gate
- Gate: `env/stats.mjs` toasterTiers[3] `need: "power"` ("Needs a Windmill or Dam"); `env/tiers.mjs:59-62` (kitchenNeedMet)
  checks points of kind windmill or dam, complete. The Mill Dam point is stored as kind `dam` (`env/power.mjs:218`),
  so it also counts.
- Cost of the jump: one Windmill, 40 Wheat (`env/energy.mjs:19`), on one of four high-ground pads per side (`env/energy.mjs:27`).
  Windmill itself is tier 1. No toast, no Hold, no building besides the pad.
- Compare tier 2: need a complete Toaster (100 Wheat, 60 ticks = 2.5 s), `env/stats.mjs` toasterTiers[2].

## Table
Toast per kill = toast the side spends / enemy units it kills, from the duels. "Slice" = one unit of toast.

| item | needs | feeds | beats | loses to | verdict | evidence |
|---|---|---|---|---|---|---|
| Tier-3 gate (Windmill or Dam) | 40 Wheat Windmill on a pad (Dam 90, Mill Dam 160); no toast | unlocks Four-Slice, Broiler, Bagel; the Windmill's 3 power also takes the Strip from 1 Toaster to 2 | nothing directly | nothing | PURPOSEFUL | energy.mjs:19,27; tiers.mjs:59-62; stats.mjs toasterTiers |
| Four-Slice (brute) | 225 Wheat, upkeep 11.25/min, 8 slots, 4 slices a volley, 36 dmg every 1.25 s, range 5, 240 hp | breaks clumps and Strips, but badly (see right); enables nothing next | 1 Popper (8 slices, 1.3 s); 1 Zapper; 1 Flak Popper (8 slices each); 5 Crumbs (stall, Crumbs do not fight back, see method) | 3 Poppers (225 Wheat, Four-Slice dies at 7.5 s, 1 kill, Poppers spend 5); 3 Zappers (6.3 s); 3 Flak Poppers (10.5 s, Flak spends 7); 2 Heat Lamps (4.5 s, 0 kills, 8 slices wasted) | WEAK | ammo.mjs:50 (brute slots 8, slices 4); stats.mjs:172 (36 dmg, every 30 ticks); economy-table slicesPerMinuteFighting 192 |
| Broiler (howler) | 175 Wheat, upkeep 8.75/min, 4 slots, 1 slice = 3 shots of 30 every 1.5 s, splash 1 (neighbours take 15), range 9 but sight 7, 70 hp | the only tier-3 answer to Heat Lamps and tier-1/2 clumps: outranges Heat Lamp (5), Popper (4), Zapper (3), Flak (5) | 1 Popper (1 slice, 1.5 s); 2 Popper at range 7 (1 slice, 3.0 s, 0 lost, 2 kills by splash); 1 Heat Lamp at range 7 (2 slices, 4.5 s, 0 lost); 4 Crumbs (1 slice, 3.0 s, 4 kills) | 2 Poppers at range 4 (1.5 s, Broiler dies, 1 kill); 3 Zappers (1.3 s); 3 Flak Poppers (1.5 s); 2 Heat Lamps at range 5 (1 s); walking Poppers close 3 tiles in ~0.4 s | PURPOSEFUL (with the range cap below) | ammo.mjs:52 (howler slots 4); combat.mjs:124 (splash half); vision.mjs:8 (howler sight 7); duel rows |
| Bagel (dart) | 125 Wheat, upkeep 6.25/min, power only, no slices, range 1, 14 dmg every 12 ticks (28 dps), 120 hp | the only tier-3 unit with no toast cost: raids a Power Strip on power alone (85.5 s, 0 toast); kills Crumbs and Zappers | 3 Crumbs (4 s, 0 toast); 2 Zappers (2.5 s); 2 Flak Poppers (3.5 s); 1 Popper (2 s, Popper spends 1) | 2 Poppers (mutual KO at 4.5 s, Poppers spend 3 slices); 1 Heat Lamp (4.5 s, 0 toast) | PURPOSEFUL, but its fence exemption is a BROKEN LINK (below) | ammo.mjs:53 (no slices); stats.mjs toaster.units.dart; fence.mjs:27,75; input.mjs:457 Roll not wired |
| Mill Dam (160 Wheat, 14 power) | 160 Wheat on the one Mill Dam site (`env/energy.mjs:31`), no toast | 14 power = 7 Toasters of 2 each; cheapest power per Wheat (11.4 vs Dam 15, Windmill 13.3) | nothing tier 3 needs (one Windmill already opens tier 3) | flour: one Toaster burns 12 Flour a minute, so 2 Toasters need 8 Mills; 14 power sits mostly unused | DEAD END for tier 3 (power in surplus); price shown wrong (BROKEN LINK below) | energy.mjs:16,19,31; kitchen-panel.mjs:25; station-controls.mjs:11; RESOURCE-FLOW.md line 13 |

Toast per slice (damage per slice of toast, from the stats rows):
- Popper 20 x 3 = 60 (vs structures 60); Zapper 18 x 3 = 54 (54); Flak Popper 15 x 3 = 45 plus splash;
- Broiler 30 x 3 = 90 plus splash 15 to neighbours (vs structures 45 x 3 = 135, structureMultiplier 1.5);
- Four-Slice 36 / 4 = 9 per slice (vs structures 72 / 4 = 18, structureMultiplier 2);
- Bagel 0 (no slices). Heat Lamp 0 (power only, `env/combat.mjs:31`: a turret fires on power and spends nothing).
- Toast per Power Strip kill (2,400 hp, `env/stats.mjs:167` toaster.coreHp): Popper 40 slices; Broiler 18; Four-Slice 133; Bagel 0 (85.5 s on power).
- Burn while firing: Four-Slice 192 slices a minute (economy-table), Broiler 13.3, Popper 13.3. One Toaster makes 48 a minute (`env/economy-table.mjs` toasterSeconds 5, slicesPerBake 4). One Four-Slice firing eats four Toasters' output.

## Duel detail (equal Wheat, n = round(costX / costY))
Four-Slice (225):
- vs 3 Popper: Y wins 7.5 s; X 1 kill; X spends 8 (8 per kill); Y spends 5 (5 per X kill)
- vs 3 Zapper: Y wins 6.3 s; X 1 kill; 8 per kill; Y 5
- vs 3 Flak Popper: Y wins 10.5 s; X 1 kill; 8 per kill; Y 7
- vs 2 Heat Lamp: Y wins 4.5 s; X 0 kills; 8 wasted; Heat Lamp 0
- vs 1 Popper: X wins 1.3 s; X spends 8 per kill; Popper spends 1
- vs Power Strip: stalls at 900 s after 8 slices = 144 damage (6% of 2,400)

Broiler (175):
- vs 4 Crumb: X wins 3.0 s; 4 kills for 1 slice (0.25 per kill)
- vs 2 Popper: Y wins 1.5 s; X 1 kill for 1 slice; Y spends 2
- vs 3 Zapper: Y wins 1.3 s; X 0 kills; Y spends 3
- vs 3 Flak Popper: Y wins 1.5 s; X 1 kill; Y spends 3
- vs 2 Heat Lamp: Y wins 1.0 s; X 0 kills
- vs 1 Popper / 1 Zapper / 1 Flak Popper: X wins 1.5 s each for 1 slice
- Kiting at its real sight (7 tiles): 1 Heat Lamp: X wins 4.5 s, 2 slices, 0 lost; 2 Popper: X wins 3.0 s, 1 slice, 2 kills (splash), 0 lost; at 6 tiles the Heat Lamp row is the same.
- vs Power Strip: 4 slices = 540 damage in 900 s with no resupply (135 per slice)

Bagel (125):
- vs 3 Crumb: X wins 4.0 s, 3 kills, 0 toast
- vs 2 Popper: mutual KO at 4.5 s; X 2 kills; Y spends 3 slices
- vs 2 Zapper: X wins 2.5 s; Y spends 2
- vs 2 Flak Popper: X wins 3.5 s; Y spends 2
- vs 1 Heat Lamp: Y wins 4.5 s; 0 toast
- vs 1 Popper: X wins 2.0 s; Popper spends 1
- vs Power Strip alone: 85.5 s, 0 toast

## Against StarCraft II tier-3 logic
Source: Liquipedia (raw wikitext via `index.php?title=...&action=raw`):
- Siege Tank (Legacy of the Void): 150/125, range 7 in tank mode and 13 in siege mode, splash 100% within 0.47, 50% to 0.78, 25% to 1.25; tech needs a Factory with a Tech Lab. https://liquipedia.net/starcraft2/index.php?title=Siege_Tank_(Legacy_of_the_Void)&action=raw
- Colossus (Legacy of the Void): 300/200, 6 supply, two lances (10 +1, x2) cleaving a line 2.8 wide, range 7 (9 with the upgrade); needs a Robotics Bay. https://liquipedia.net/starcraft2/index.php?title=Colossus_(Legacy_of_the_Void)&action=raw

The SC2 logic: a late unit answers a stalled game with range (siege), splash (cleave, falloff) and value per resource. The Broiler follows that shape: range 9 (its real band is 7, sight-capped), splash, and 90 damage per toast slice against Siege Tank-style splash. The Four-Slice breaks the logic: 225 Wheat for 9 damage per toast slice, about 7x less damage per toast than a Popper (9 against 60), so in a toast-limited game it makes the stall worse. The Bagel has no direct SC2 analogue; it is closer to a cheap raider with no ammunition.

## DEAD ENDs and BROKEN LINKs, with the smallest fix
1. **DEAD END — Mill Dam as a tier-3 purpose.** Tier 3 needs one power building; the Windmill (40) already gives it. The Mill Dam's 14 power would run 7 Toasters, but 7 Toasters need 84 Flour a minute, 28 Mills; the player typically has 4 to 8. Smallest fix: none in code; keep it out of the tier-3 choice and present it as late power only (or skip the Mill Dam in the tier-3 story).
2. **BROKEN LINK — Mill Dam price shown wrong.** `play/kitchen-panel.mjs:25` shows the Dam button at ENERGY.cost.dam (90), while `play/station-controls.mjs:11` charges 160 on the Mill Dam site. Smallest fix: in kitchen-panel, show 160 for the milldam site (or label it "Mill Dam 160").
3. **BROKEN LINK — Broiler range is past its sight.** Range 9 (classic row) but `env/vision.mjs:8` gives howler sight 7 and `env/combat.mjs:76` (chooseTarget) only targets what the side can see, so the 8-9 band is dead on low ground. Measured: a Broiler at 9 fires nothing in 300 s. Smallest fix: `env/vision.mjs:8` DEFAULT_SIGHT howler 7 -> 9 (one number).
4. **BROKEN LINK — Bagel is a fence flyer.** `env/fence.mjs:27` puts 'bagel' in FLYERS, so `fence.mjs:75` returns no block and the enclosure never stops it (`fence.mjs:249` also treats it as not contesting). The team correction says nothing flies, and the Bagel is a rolling ground melee unit. Smallest fix: remove 'bagel' from FLYERS, unless SYSTEMS-DESIGN.md states an exception (not checked here).
5. **BROKEN LINK — Roll and Shove are shown, not wired.** `play/input.mjs:457` (Bagel "Roll: no command yet") and `:459` (Four-Slice "Shove: no command yet"). The buttons promise commands the sim lacks. Smallest fix: hide these two `soon` entries until the command exists.
6. **Minor (not a verdict):** `env/power.mjs:26` POWER.cord has no entry for dart, howler or spiker, so they fall to `cordOf` default 8 (`env/power.mjs:36`). Works, but silent. Smallest fix: add the three to POWER.cord with their intended reach.
7. **Four-Slice (WEAK, not a dead end):** the fix is the number, not a new unit. Smallest change to test: volley damage or slots (`env/ammo.mjs:50` slots 8, one volley = 4 slices). At 9 damage per slice it needs about 6.7x (60 / 9) to match a Popper. Not recommended until the Broiler and Bagel are settled.

## Is reaching tier 3 worth it today? Yes.
The jump is one 40-Wheat Windmill (energy.mjs:19). The player needs it anyway: the Power Strip's 2 power runs one Toaster, and the Windmill's 3 more makes the second (2 + 3 = 5 power, 2 Toasters at 2 each). So the gate costs nothing extra. What the tier buys is the choice: the Broiler (175 Wheat) kills a Heat Lamp for 2 slices, and two Poppers for 1 slice, without loss at its sight range of 7; the Bagel (125 Wheat) raids a Power Strip for 0 toast. The Four-Slice (225 Wheat) is 9 damage per slice, 8 slices per Popper kill, and loses to 3 Poppers. Reach tier 3 for the Windmill; buy Broilers and Bagels; do not buy the Four-Slice until its damage per slice changes.
