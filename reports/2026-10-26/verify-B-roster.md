# Verify B: unit roster, roles, counters

Read-only, 2026-10-26, `/Users/joshuaseppich/dev/rts`. Numbers from `rowOf({ ammo: {} }, kind)` and `ammoOf(kind)` (one-line `node -e` calls). Nothing edited.

## 1. Stats: CONFIRMED

| Unit | Cost | HP | Shot dmg / every (ticks) | Range | Speed | Splash | Struct x | Slices |
|---|---|---|---|---|---|---|---|---|
| Crumb (worker) | 50 | 40 | 2 / 12 | 1 | 2 | - | 1 | none |
| Popper (grunt) | 75 | 60 | 20 / 36 | 4 | 3 | - | 1 | 1 per 3 shots |
| Zapper (lancer) | 65 | 40 | 18 / 30 | 3 | 3 | - | 1 | 1 per 3 shots |
| Four-Slice (brute) | 225 | 240 | 36 / 30 | 5 | 4 | - | 2 | 4 per volley |
| Broiler (howler) | 175 | 70 | 30 / 36 | 9 | 4 | 1 | 1.5 | 1 per 3 shots |
| Flak Popper (spiker) | 70 | 50 | 15 / 36 | 5 | 3 | 1 | 0.5 | 1 per 3 shots |
| Bagel (dart) | 125 | 120 | 14 / 12 | 1 | 2 | - | 1 | none (`ammo: false`) |

- Evidence: `env/stats.mjs:21` (24 ticks/s), base rows `:151-160`, overlay `:165-177`, `rowOf` `:523`.
- "50 Wheat" is Shards, which the HUD labels Wheat (`play/hud-bar.mjs:97`).
- The numbers hold only with `state.ammo` on. Without it `rowOf({}, 'grunt')` gives damage 8, range 1; lancer range 4.

## 2. No air layer: CONFIRMED

- Nothing assigns `layer` to a unit. The only mentions are reads: `env/economy.mjs:557`, `:856`, `env/vision.mjs:24`.
- `env/vision.mjs:16` `AIR_KINDS` = skiff, barge, seer. None is in `STATS.units`.
- `env/combat.mjs` has no air/ground filter; `chooseTarget` takes the nearest enemy in reach.
- Anti-air is text only: `env/stats.mjs:442`, `play/hud-tips.mjs:51`.

## 3. Index: PARTLY

Index = sqrt(dps x hp) / cost, dps = damage x 24 / every.

| Unit | dps | hp | cost | index | vs Popper |
|---|---|---|---|---|---|
| Popper | 13.33 | 60 | 75 | 0.3771 | baseline |
| Zapper | 14.40 | 40 | 65 | 0.3692 | -2.1% |
| Four-Slice | 28.80 | 240 | 225 | 0.3695 | -2.0% |
| Bagel | 28.00 | 120 | 125 | 0.4637 | +23.0% |
| Broiler | 20.00 | 70 | 175 | 0.2138 | -43.3% |
| Flak Popper | 10.00 | 50 | 70 | 0.3194 | -15.3% |

- Bagel, Broiler and Flak match with Popper as baseline. The Popper/Zapper/Four-Slice spread is 2.14% (max/min), so "within 2%" is a rounding-level miss.

What the index misses:

- **Toast.** Damage per slice: Broiler 90, Popper 60, Zapper 54, Flak 45, Four-Slice 9. Four-Slice gets about 6.7x less per slice than a Popper (`env/ammo.mjs` ARMED).
- **Slices per kill** (whole shots):

| Target | Popper | Zapper | Four-Slice | Broiler | Flak | Bagel |
|---|---|---|---|---|---|---|
| 60 hp Popper | 1.00 | 1.33 | 8.00 | 0.67 | 1.33 | 0 |
| 40 hp Zapper | 0.67 | 1.00 | 8.00 | 0.67 | 1.00 | 0 |
| 240 hp Four-Slice | 4.00 | 4.67 | 28.00 | 2.67 | 5.33 | 0 |
| 150 hp Heat Lamp | 2.67 | 3.00 | 12.00 | 1.33 | 6.67 | 0 |

- **Splash:** Broiler and Flak hit neighbours within 1 tile at half damage (`env/combat.mjs` splash block). Not in index.
- **Range and high ground:** high ground adds 1 reach at range 2+ (`env/combat.mjs:9`).
- **Minimum range:** none exists. Broiler "brittle up close" (`play/hud-tips.mjs:50`) has no mechanic.
- **Speed:** tiles/s = 24 / speed: Popper, Zapper, Flak 8; Broiler, Four-Slice 6; Bagel, Crumb 12.
- **Structures:** Four-Slice dps 57.6 vs buildings, Broiler 30, Flak 5.
- **Slots:** Popper full load = 18 shots = 360 damage (six kills). Four-Slice = 2 volleys = 72 damage (one kill).
- **Feeding:** a Crumb carries 2 slices (`env/ammo.mjs:38`, `:256`). Four-Slice needs 4 in hand (`hasShot`, `:158-159`), so two runs before its first volley.
- **Power:** `canFire` requires power for every armed unit (`:165-168`). Bagel's "needs power" is not unique; its only difference is no slices.
- **Commands:** Roll, Shove, Resupply show "no command yet" (`play/input.mjs:417-419`).

## 4. Stale comment: CONFIRMED

- `env/ammo.mjs:47`: "six 10-damage shots into a 60 hp Popper". Pop Shot is 20 (`env/stats.mjs:170`), so three shots kill. "One full load is about one kill" holds only for Four-Slice.
- Same idea in `players/toaster-easy/bot.mjs:502` and `players/toaster-sonnet/bot.mjs:475` ("a Popper fires six slices"). Ambiguous: six slices is a full load, which is 18 shots.

## 5. No tags or bonus path in combat: CONFIRMED, with caveat

- `env/combat.mjs:88-89`: damage is `shot.damage`, times structure multiplier for structures only. No tags.
- Bonus fields exist but no combat code reads them: Weapons and Hide ("+1 damage per hit", "+1 armor", `env/stats.mjs:37-40`), Sidewind `:67`, Long Strike `:68`, Thick Hide `:80`. Researched items land in `state.research.done` (`env/tiers.mjs:137`) with no combat reader.
- Items: `unitMods` (`env/items.mjs:95-104`) gives `damageMul` and `armour`; read only by `env/neutrals.mjs:151,192`.

## Associations

| Where | Says | Verdict |
|---|---|---|
| `env/stats.mjs:438` Popper | "one slice a shot" | WRONG (3 shots per slice) |
| `env/stats.mjs:439` Zapper | "fast, short-range" | PARTLY (range 3 short; same speed, faster cadence) |
| `env/stats.mjs:440` Four-Slice | "slow heavy volley ... braces to fire" | Slow/heavy MATCH; "braces" is animation only (`COMBAT.md:25`) |
| `env/stats.mjs:441` Broiler | "artillery ... splash" | MATCH |
| `env/stats.mjs:442` Flak | "anti-air and anti-swarm" | Anti-swarm MATCH; anti-air WRONG |
| `env/stats.mjs:443` Bagel | "needs power, no slices" | Slices MATCH; power not unique |
| `play/hud-tips.mjs:47` | "one slice a shot" | WRONG |
| `play/hud-tips.mjs:48-49` | Zapper "bites close"; Four-Slice "good against walls" | MATCH |
| `play/hud-tips.mjs:50` | Broiler "brittle up close" | PARTLY (no mechanic) |
| `play/hud-tips.mjs:51` | Flak "anything that flies" | WRONG |
| `play/teach.mjs:11` | grunt "cheap, sturdy" | PARTLY (60 hp) |
| `play/teach.mjs:12` | lancer "hits from a distance, keep behind grunts" | WRONG for Toaster Wars (Zapper 3, Popper 4); true of classic rows only |
| `play/teach.mjs:78` coach set | grunt, lancer, brute | Omits howler, spiker, dart (minor) |
| `SYSTEMS-DESIGN.md:18-19` | Tier 2 Popper/Zapper/Flak (Toaster); Tier 3 Four-Slice/Broiler/Bagel (Windmill or Dam) | MATCH `env/stats.mjs:251-255`, `env/tiers.mjs:49-76` |
| `SYSTEMS-DESIGN.md:31`, `TECH-TREE.md:66-71` hotkeys | A Popper, S Zapper, D Flak, F Four-Slice, G Broiler, Z Bagel | MATCH `play/toaster-play.mjs:80-88` |
| `TECH-TREE.md:25, 43-46` | Popper "none"; Four-Slice/Flak/Broiler/Bagel "Hold 3" | WRONG for Toaster Wars |
| `TECH-TREE.md` (generated) | "what each tier unlocks" | Built from territory `STATS.tiers` (`scripts/tech-tree-doc.mjs:40`), not `toasterTiers`. Wrong tiers. |
| `TECH-TREE.md:12` | "a fighter needs slices" | PARTLY (Bagel) |
| `UNITS.md:11, 31-32` | Skyspike anti-air; Grunt/Lancer/Dart counters | Driftfall v3 draft; stale |
| `players/builtin/ai.mjs:23-29` COUNTERS | vs grunt pick lancer x2.0 | Classic-era; inverted for Toaster Wars. Not the default: `play/opponent.mjs:16` picks toaster-easy or toaster-sonnet |
| `players/toaster-easy/bot.mjs:506`, `players/toaster-sonnet/bot.mjs:479` | Build grunt and lancer | Only these two kinds are ever trained by the Toaster Wars bots |

## MISSED

1. **TECH-TREE.md has the wrong unlock rule.** It is generated from territory tiers. Toaster Wars uses `STATS.toasterTiers` (Toaster, then Windmill or Dam). Largest doc error here.
2. **Counters that exist:** power cords (an unpowered armed unit cannot move or fire, `canMove`/`canFire`); supply raids within `raidRange: 2` (`env/ammo.mjs:35-41`); Popper outranges Zapper; Broiler outranges all; splash on clumps; Four-Slice x2 and Broiler x1.5 vs buildings, Flak x0.5; high ground +1 reach; nearest-target rule (no type priority).
3. **Not present:** type counters, armour, air/ground targeting, minimum range, attribute tags, combat-facing research, item damage in player combat.
4. **Heat Lamp target priority** (`SYSTEMS-DESIGN.md:31`) is unbuilt.
5. **Upgrade names reference roles that do not exist here:** Fang, Spitter, Bulldozer, Adder (shade), Charmer (conduit), Thumper (`env/stats.mjs:61-85`). Shade and conduit are not in `STATS.units`.
6. **Classic vs Toaster rows invert the ranking.** Any text or weight from classic numbers flips Popper and Zapper.
7. **Index blind spot:** it ranks raw stats and says nothing about toast, where Four-Slice is about 6 to 7 times worse per slice than a Popper.

Not verified: whether `players/builtin` runs Toaster Wars beyond `?ai=builtin` (`play/app.mjs:220`). No test suite run.
