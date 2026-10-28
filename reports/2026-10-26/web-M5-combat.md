# M5 minutiae check: combat, vision, fog of war (web + code), 2026-10-26

Checker: haiku (web checker, read-only). Code read: env/combat.mjs, env/vision.mjs, env/ammo.mjs, env/items.mjs, env/effects.mjs, plus the callers they touch (env/neutrals.mjs, env/stats.mjs, env/sim-territory.mjs, play/fog.mjs, play/input.mjs, tests/combat-*.test.mjs, tests/high-ground.test.mjs, tests/vision.test.mjs).

## Web source status (read this first)
- Liquipedia returned HTTP 403 to WebFetch on every page tried (Fog_of_War, High_Ground, Target_Priority, Splash_Damage, Automatic_Targeting, High_Ground_and_Low_Ground). Nothing below is verified from a fetched Liquipedia page.
- The Liquipedia statements below come from WebSearch snippets only. They are marked PARTLY or UNVERIFIED accordingly.
- Snippet sources: liquipedia.net/starcraft2/High_Ground_and_Low_Ground, liquipedia.net/starcraft2/Sight, liquipedia.net/starcraft2/Automatic_Targeting, liquipedia.net/starcraft2/Siege_Mode, liquipedia.net/starcraft2/Fog_of_war (stub). Blizzard forum post on Thor/Queen order (user-written, secondary).

## Code findings (verified by reading the files)

1. **Items do not touch PvP combat or vision.** `unitMods` (env/items.mjs:95) gives damageMul, armour, range, sight, attackSpeed. Its only callers are env/items.mjs itself (heal cap, Recall HP) and env/neutrals.mjs (creature fights, armour at :151, range/damageMul at :192). combat.mjs and vision.mjs never call it. Result: Fang Polish, Scale Plating, Crystal Monocle (range and sight), Rattle Bell (attack speed) do nothing against players. vision.mjs:20 uses `kindStats(...).sight` only.
2. **Rank bonuses are dead in PvP.** effectiveRank damage and HP (items.mjs:98-99) never reach combat. HP only matters for heal cap and Recall.
3. **Kill credit is creature-only.** `awardKill` is called only from neutrals.mjs:135, inside `damageCreature`. combat.mjs never calls `damageCreature` (its own comment, neutrals.mjs:15, says it is "wired in" later). So a player kill never ranks a unit and `onUnitDeath` (Shed Skin, items.mjs:136) never runs for PvP deaths. Ranks and Recall only ever come from camp kills and item bonuses.
4. **Stormglass Shard (stun) and Ironroot Brace (root) are inert.** `stunOnHit` (items.mjs:122) and `isRooted` (items.mjs:119) have no caller outside items.mjs and tests/items.test.mjs. Grep covered env, play, players, tests.
5. **Fog does not gate combat.** `chooseTarget` (combat.mjs:57-70) takes every enemy entity in reach. It never consults visionOf. An attack order also hits its ordered target with no sight check. A unit can shoot what its side cannot see.
6. **No target priority.** Auto-acquire is nearest-in-reach, ties to lower id (combat.mjs:64-69). Fighters, workers, structures, sites and the Core are all equal. The target is re-chosen every tick, so it is never held.
7. **No minimum range and no attack-move in combat.** Grep for minRange/minimum range found nothing in env. An attack order only ever hits its ordered target (combat.mjs:60-62). Units with a move order do not fire (canAttack, :40-42). attack-move is a play/input.mjs feature (ACQUIRE = 6 tiles, input.mjs:27); I did not trace how it becomes orders.
8. **Splash friendly fire is off; splash damage is mis-scaled.** Splash skips the attacker's own owner (combat.mjs:98), so no friendly fire. But splash uses `dmg` after the primary target's structureMultiplier (combat.mjs:88-89 then :99). Example: Broiler (howler) overlay shot 30 hits a structure at x1.5 = 45; a unit beside it takes floor(45/2) = 22, not 15. Conversely, a unit primary target's damage halved onto a structure neighbour gets no structure multiplier of its own.
9. **Heat Lamp fires without power or slices.** canAttack checks ammo only for units (combat.mjs:36-39, canFire is `isUnit` only). Power hook in sim-territory.mjs:90-95 and ammo.mjs:108 apply to units only. Nothing in env gates a turret on power. Turret: 150 hp, cost 100, damage 12, range 5 (stats.mjs:141); overlay shot 12 every 12 ticks (stats.mjs:179). Target priority is unbuilt: play/input.mjs:430 says "no command yet".
10. **Out-of-ammo.** Units that are hungry cannot fire (canFire, ammo.mjs:166-172). Unpowered units cannot move, fire or be resupplied. Bagel (dart) needs power only (ammo:false). Turrets are exempt (finding 9).
11. **Classic mode has no cadence.** With state.ammo off, every attacker deals its full `damage` every tick (combat.mjs:88, no nextShot). Territory matches always have hunger on (sim-territory.mjs:84-86), so shipped play is unaffected. Classic tests are.
12. **Creature fights ignore orders, power and ammo, and use the wrong stats.** neutrals.mjs:187-199 (autoFight) fires every unitAttackEvery (8) ticks, for any non-worker with damage, whether it has a move order, is unpowered or is hungry. It uses `kindStats` (classic: grunt range 1, damage 8), not `rowOf` (Toaster overlay: range 4, 20 every 36 ticks). A Popper walking past a camp hits it with classic numbers.
13. **Overkill: no retarget, damage is wasted.** All attacks are decided from start-of-phase state (combat.mjs:82-94), damage is summed then applied with hp clamped at 0 (:105-107), and hits report post-damage hp (:111). Late attackers still land on a dead target this tick. Units whose ordered target died clear their order (:119-129). combat-damage.test.mjs:295 pins "overkill hits report hp at or below 0".
14. **Vision rules (code).** Sight is per tile, Chebyshev, height-gated. Units on high ground (height > 0, not on a ramp) get +2 sight, units only, not structures (vision.mjs:40-41). Low-ground pieces see high tiles only within 1 tile (NEAR_SIGHT) or when a friendly unit on high ground sees them (vision.mjs:46-47). Air ignores height. Sites see 2 tiles (SITE_SIGHT). Cargo in a Barge sees nothing (vision.mjs:38). Rocks do not block sight (no LOS check). Ranged units on high ground reach +1 down (combat.mjs:48-52, only range >= 2). No miss, no reveal of attackers.
15. **Fog is current-only.** `filterVisible` (vision.mjs:75-78) returns enemy pieces only on seen tiles. There is no snapshot of last-seen enemy structures. play/fog.mjs keeps explored terrain only.

## Comparison with StarCraft II

| # | Mechanic | SC2 (what I could verify) | Code | Verdict |
|---|---|---|---|---|
| A | Auto-acquire keeps its target | Liquipedia Automatic_Targeting snippet: a unit keeps its chosen target until it is invalid, leaves range, or a higher-priority target enters range. | Re-chosen every tick, nearest wins (combat.mjs:64-69). | PARTLY (snippet) |
| B | Target priority | Snippet: a priority table exists; AI-only worker override puts workers under buildings. Blizzard forum post (secondary): Thor/Queen order air-to-ground, ground-to-ground and buildings, air, ground, workers, buildings last. | No priority at all. | UNVERIFIED (table not read) |
| C | Fog: last-known structures | Liquipedia Fog_of_war stub snippet: structures stay at their last-known location in last-known state; cannot be selected or inspected. | Current-only filter, no snapshot (vision.mjs:75-78). | PARTLY (snippet) |
| D | Fog: explored vs unexplored | Blizzard guide: dark = unexplored, grey = explored, enemy moves hidden in grey. | Same two-level idea in play/fog.mjs. | CORRECT in shape (snippet) |
| E | High ground: low ground cannot see high | Snippet: units on high ground see low ground; low ground cannot spot ground units above. | Low tile seen only within 1 tile or via a friendly high-ground unit (vision.mjs:46-47). | PARTLY: code allows a 1-tile look up; snippet did not mention that. |
| F | Attacking from high ground reveals the attacker | Snippet: attackers from high ground are shown, not granted vision. | Not modelled. No reveal, no miss. | MISSING in code |
| G | High-ground range bonus | Snippet mentions no range bonus. | +1 reach down for range >= 2 (combat.mjs:48-52). | UNVERIFIED as a bug; differs from snippet. |
| H | Splash friendly fire | Liquipedia Siege_Mode snippet: Siege Tank splash hits hostile AND friendly units; a Shaped Blast upgrade cuts friendly damage by 75% (StarCraft Wiki snippet). | Splash skips own owner (combat.mjs:98). | PARTLY: code is the opposite of SC2 default. |
| I | Minimum range | Snippet: Siege Tank in Siege Mode has minimum range 2. | None in code. | PARTLY (snippet) |
| J | Overkill | No Liquipedia page reached. | Damage wasted, no retarget (combat.mjs:105-111). | UNVERIFIED |
| K | Attack needs vision | Not confirmed by any fetched page. | Not enforced (finding 5). | UNVERIFIED |

## Bugs or gaps to route (for the builders, not me)
- Items' damage, armour, range, sight, attack speed, stun and root are unwired for PvP (findings 1, 4). Kills never rank PvP units (finding 3).
- Heat Lamp fires unpowered (finding 9). Creature fights use classic stats and ignore orders and ammo (finding 12).
- Splash multiplier mis-scaled (finding 8). Splash skip for own owner is fine; neighbour structure multiplier is missing.
- No target priority, no target hold, no attack-move in combat (findings 6, 7).

## Association
The SC2 snippets say a unit's target is held and that vision gates fog. The code re-picks the nearest enemy each tick and ignores vision in combat. Together with finding 3 (kills only from camps), a PvP-ranked system would need combat to call `awardKill`/`onUnitDeath` and to read `unitMods`. That is one wiring change, not three.

## Not checked
- The fetched text of any Liquipedia page (all 403). Everything Liquipedia-sourced is snippet-level.
- play/input.mjs attack-move path (only its comment and constant read).
- Turret power behaviour in the play layer (grep found no structure power gate in env).
