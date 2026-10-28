# Systems design: wells, tech tree, terrain, hotkeys (Joshua's brief, 2026-10-25 22:11; spec by Claude; full text with StarCraft analysis in the Claude doc "GHT Systems Design")

Builders: this file is the spec. Chat is in the repo root: `node read.mjs --since N` to read, `node say.mjs <team> "text"` to post (PLAN, REVIEW?, DONE or BLOCKED, under 700 characters). Helpers: Haiku only, `node ~/dev/control-room/bin/spawn.mjs`. Where it and the code disagree, the code changes. Nothing named, drawn or numbered from any other game goes into the game.

## 1. Wells (tickets W1, W2)
- A Well pays out in ticks: 1 Water every wellTicks (6 s = 10 a minute) once complete, no worker. It never depletes. Income goes to the side's pantry.
- Pantry cap: 6 + 3 per complete Toaster of that side (today a flat 6).
- Crowding: for a Well W, with every OTHER Well on the map (any owner) j at Chebyshev distance d_j < R = 8: rate(W) = base / (1 + sum_j (1 - d_j / R)). Recomputed every beat. Spring Wells keep their every-second-beat halving on top.
  Worked: alone 10/min; two 2 apart 5.7 each (11.4); two 5 apart 7.3 each (14.5); three all 2 apart 4.0 each (12.0); two 8+ apart 10 each (20); yours 3 from an enemy Well: 6.2 for both.
- Placement rule: a Well may not be placed within 6 tiles of an ENEMY structure (any kind).
- Expose on the Well structure: s.crowd (count inside R), s.rateTicks (effective ticks per bucket), s.ratePerMin; and in observeBakery wells[].
- Ghost (W2): with a Well on the cursor draw its R ring and the rings of every Well in sight (enemy in their colour) and print "10 Water / min", "shared with 1 Well: 5.7 / min", "dry: no water within 4", "too close to an enemy building". Selected Well: "7.3 / min, shared with 1 (2 tiles)". Tooltip explains the rule in one line.

## 2. Resources and tiers (tickets T1, T2, T3)
- Resources: Wheat (Crumbs, 28/min each, at most 6 per field tile), Flour (Mill 10 wheat to 1 every 20 s), Water (Wells), Toast (1 flour + 1 water + power = 4 slices / 5 s; Strip pilot 1 / 20 s), Power (Strip 2, Windmill 3, Dam 6, Mill Dam 14; Toaster uses 2), Supply (cap 40; upkeep 5% of unit cost a minute is the real cap).
- Tiers, replacing the foundry/sanctum/hangar + Hold gates in env/stats.mjs tiers and env/tiers.mjs:
  - Tier 1 Strip (nothing): Crumb, Mill, Well, Toaster, Extension Box, Heat Lamp.
  - Tier 2 Kitchen (one complete Toaster): Assembly Line; Popper, Zapper, Flak Popper; Relay Pylon.
  - Tier 3 Powered (a complete Windmill or Dam of yours): Four-Slice, Broiler, Bagel; Mill Dam.
- Clarity: a locked button stays visible and greyed, keeps its key, and its tooltip names the missing thing ("Needs a Toaster", "Needs a Windmill or Dam", "Not enough Wheat (75)"); cost and build time on hover; the first slice and the first Windmill each fire a one-line toast ("Kitchen open: the Assembly Line is yours").
- Kitchen panel (K): the chain as boxes and arrows with live per-minute numbers on each arrow, greyed boxes with cost and key, opens once automatically at the first Mill, K or Esc closes.
- TECH-TREE.md generated from stats by scripts/tech-tree-doc.mjs with --check.

## 3. Terrain (tickets TR1, TR2; the rest after Joshua picks)
- TR1 High ground: a unit on a high tile (map heights) sees +2 tiles and ranged shots from high to a lower tile reach +1; a unit on low ground cannot see a high tile until adjacent (or a friendly unit is up there). Cue: lighter rim on high-tile edges; a small up-arrow by units standing high. Tests: sight, reach, no sight up, ramp tiles count as low.
- TR2 Cords and water: a cord cannot cross a water tile except through a Relay Pylon standing on a bank tile (adjacent to water); fords 'f' and bridges 'B' are the only walkable crossings (confirm in env/movement.mjs; rocks.push for '~' says water is impassable today); a complete Dam you own is walkable like a bridge. Cue: cord goes dark at the bank, plug-out icon; stepping stones drawn on fords.
- Later (Joshua picks): wheat as cover (invisible beyond 3 tiles while standing in wheat), rubble as destructible pass (200 hp exists), Windmill sight 8 when powered, ruins +20% Well rate, map guarantee: pond, creek reach with ford, hill, rubble pass within 30 tiles of each Strip; fairness test on mirrored counts.

## 4. Hotkeys (tickets H1, H2)
- Grid default: 5 x 3 card on Q W E R T / A S D F G / Z X C V B; keys printed on the buttons; row 1 universal on every card: Q Move, W Stop, E Hold, R Patrol, T Attack-move.
- Crumb row 2-3: A Mill, S Well, D Toaster, F Assembly Line, G Heat Lamp, Z Extension Box, X Relay Pylon, C Windmill, V Dam, B Gather. Strip: A Crumb, S Rally, D Pilot on/off. Assembly Line: A Popper, S Zapper, D Flak, F Four-Slice, G Broiler, Z Bagel, X Rally. Fighters: A Resupply; Four-Slice S Shove; Bagel A Roll. Heat Lamp: A target priority. Well/Mill/Toaster: A show rings, S pause. Box/Pylon: A fence on/off, S unplug.
- Classic profile (one setting): A attack-move, S stop, H hold, M move, P patrol, R rally; buildings I W T F L X V N D; units C O Z L(Four-Slice, off F) B K E; card prints those letters.
- Global, both profiles: 1-0 groups (Ctrl set, Shift add, double-tap jump; add 0), F1 idle Crumb, F2 army, F3 all Crumbs, Backspace cycle Strip then Toasters, Tab cycle types in selection, Shift queue, Space last alert, K kitchen, Alt (hold) all Well rings + all cord reaches, F5-F8 camera recall (Ctrl+Fn save; sandbox cheats move to Shift+F5-F8), backtick mute (U freed), Esc cancel.

## 6. Not built until Joshua answers (see the Claude doc, section 6): E1 timeout score order, C1 cord 16 + Pylons every 14 (the offence fix), M1 water within 30 tiles. Built now: E2 spread auto-gather (idle Crumbs take the nearest tile with a free slot; "6 of 6 working" shown on the field).
