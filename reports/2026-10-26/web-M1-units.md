# Web check M1: units and how they behave (2026-10-26)

Checker: haiku (web + code read-only). Scope: the seven Toaster Wars units, their real stats, and their behaviours (auto-acquire, attack-move, stop, hold, patrol, chase and give-up, focus fire, retreat, out of toast, death). Code read: env/combat.mjs, env/movement.mjs, env/ammo.mjs, env/stats.mjs, play/input.mjs, plus app.mjs:257 and power.mjs (enforceCords). Nothing edited.

## Web sources and what they support
- Blizzard "Game guide: basic unit controls", https://news.blizzard.com/en-us/article/4552956/game-guide-basic-unit-controls (fetched). Quoted: Stop "will ensure that your units will engage and chase enemies attacking them"; Hold Position "will not move to engage enemies in its sight range" but "will attack targets of opportunity with its own ranged attacks"; Patrol "effectively perform[s] an Attack-Move" between two points; Attack-Move "automatically engaging any enemy units or buildings that come into their range on the way to their destination", ignoring targets they cannot attack.
- Liquipedia pages (Attack-move, Hold_Position, Patrol, Stop, Automatic_Targeting): all returned HTTP 403 to WebFetch. UNVERIFIED on Liquipedia itself. The WebSearch snippet (not a fetched page) agrees with the Blizzard guide on Hold, Patrol and Stop. Liquipedia unit pages were not reached.
- Blizzard "simplified controls" and Orbi Patches FAQ: appeared in search only, not fetched.

## Real stats (overlay in env/stats.mjs, STATS.toaster, applied by rowOf when state.ammo is on)
Speed is ticks per step at 24 tps; tiles/s = 24 / speed.

| Unit (roster name) | cost | hp | shot dmg / every | range (overlay, base) | speed (overlay, tiles/s) | splash | structure x |
|---|---|---|---|---|---|---|---|
| worker (Crumb) | 50 | 40 | 2 / 12 ticks (0.5 s) | 1 (1) | 2 (12) | - | 1 |
| grunt (Popper) | 75 | 60 | 20 / 36 (1.5 s) | 4 (1) | 3 (8) | - | 1 |
| lancer (Zapper) | 65 | 40 | 18 / 30 (1.25 s) | 3 (4) | 3 (8) | - | 1 |
| brute (Four-Slice) | 225 | 240 | 36 / 30 (1.25 s), 4 slices a volley | 5 (1) | 4 (6) | - | 2 |
| howler (Broiler) | 175 | 70 | 30 / 36 (1.5 s) | 9 (9) | 4 (6, base not overridden) | 1 tile, half dmg | 1.5 |
| spiker (Flak Popper) | 70 | 50 | 15 / 36 (1.5 s) | 5 (5) | 3 (8) | 1 tile, half dmg | 0.5 |
| dart (Bagel) | 125 | 120 | 14 / 12 (0.5 s), no slices | 1 (1) | 2 (12) | - | 1 |

Verdict on the HIVE list: CORRECT for all seven (cost, hp, shot damage, cadence). Read in code: stats.mjs:139-181 (overlay), 151-159 (base). Two extra facts the HIVE lacks: the Four-Slice hits structures for double damage and the Flak Popper for half, and the Bagel's melee range is 1.

## Behaviours: web vs code
| Behaviour | Blizzard guide (SC2) | Code (repo) | Verdict |
|---|---|---|---|
| Auto-acquire | Units in range fire on their own | Idle fighters (AUTO_KINDS: grunt, lancer, brute, howler, spiker, dart) fire at the nearest enemy in overlay range, lower id on ties (combat.mjs:13,57-69). Crumbs never fire idle. | Partly matches. Crumbs idle do nothing, which SC2 workers also do. |
| Attack-move | Walk, engage what enters range, resume | input.mjs:27 ACQUIRE = 6 tiles, radius max(6, base range + 2) (input.mjs:655). It then issues an explicit attack order and resumes the walk when the target dies (input.mjs:651-659). | Matches in outline. Acquisition is by the page, not the sim. Base range is used (see bugs). |
| Stop | Stopped units engage and chase attackers | input.mjs:458 clears the plan and sends stop. An idle fighter never moves to chase (combat.mjs:41 needs an attack order to move). | DIFFERS. Repo Stop does not pursue. |
| Hold | Shoot in range, never move to engage | input.mjs:625-634: explicit attack only when a foe is within BASE range; drops the attack if the target is out of BASE range. Sim auto-fire still covers overlay range for idle units. | Matches in intent. Range source is wrong (below). |
| Patrol | Attack-move between two points | input.mjs:322-332 builds an amove loop between the target and the start tile. | Matches. |
| Chase and give up | Chases; gives up when the target leaves reach (SC2 has leash-ish behaviour in practice) | An attack order follows its target with no leash or give-up (movement.mjs:68-72); it drops only when the target dies or no path exists (movement.mjs:227-232). Attack-move drops its destination after 4 idle re-tries (input.mjs:648). | No leash in repo. Divergence to decide, not an error. |
| Focus fire | Player orders a target | Each attacker picks its nearest enemy in reach at start of phase (combat.mjs:57-69). Damage is summed then applied, so overkill is allowed (combat.mjs:104-107). No focus logic beyond explicit attack orders. | Matches the mechanism. |
| Retreat | Move command | No retreat command. Row 1 is Move, Stop, Hold, Patrol, Attack (input.mjs:33). Roll (Bagel) and Resupply are "coming soon" stubs (input.mjs:417-419). | Missing, as the report says. |
| Out of toast | n/a | canFire false: no shot (ammo.mjs:166-172). Movement does not check canFire, so a hungry unit still walks. Growl event fires once when it runs dry (ammo.mjs:333-341). | Repo-specific. |
| Death | Units vanish | Dead removed, die event, attack orders on the dead cleared (combat.mjs:115-129). Its slices are deleted with it (ammo.mjs:326-330). | Nothing dropped or refunded. |

## Findings (code, verified by reading)
1. **Hold and attack-move use the classic table, not the toaster ranges.** app.mjs:257 passes STATS (base) to createInput, and input.mjs:598,626,655 read stats.units[kind].range. Base ranges: Popper 1 (real 4), Zapper 4 (real 3), Four-Slice 1 (real 5), Flak 5 (5), Broiler 9 (9), Bagel 1 (1). Effect: a holding Popper will not explicitly target a foe at 2 to 4 tiles, and a holding Four-Slice drops attacks past 1 tile even though it shoots 5. Idle auto-fire in the sim softens the Popper case; the explicit-order logic and the "stop if out of range" check are still wrong.
2. **Runs use the classic Crumb speed.** ammo.mjs:259 uses kindStats("worker").speed, which is the base row (1 tick a tile). A Crumb walks at overlay speed 2. So toast runs arrive about twice as fast as a Crumb can walk. Read from code; not run.
3. **Stale comment.** ammo.mjs:47 says "six 10-damage shots into a 60 hp Popper" and "one full load is about one kill". Overlay damage is 20 (3 shots to kill), and a full Popper load is 18 shots, about six kills.
4. **Four-Slice ammo count is 4x high in the HUD.** Its volley costs 4 slices (ammo.mjs:184) and shotsPer is 1, so a full 8-slot load is 2 volleys. observeAmmo (ammo.mjs:362) reports 8 shots.
5. **Slices are lost, not refunded.** A Crumb that dies on a run, a target that dies before arrival, or a raid all emit spill or raid and the slices are gone (ammo.mjs:213-237). Stock was taken at dispatch (ammo.mjs:267). This is the real cost of raiding.
6. **Unpowered units are pulled back, not frozen.** movement.mjs never calls canMove. power.mjs enforceCords (power.mjs:355-380) snaps a unit that ended a tick out of cord back to its last legal tile. The ammo header promises "cannot move" (ammo.mjs:22); the mechanism is different.
7. **Stop is passive in the repo, active in SC2.** The Blizzard guide says Stop engages and chases attackers. Here an idle unit never leaves its tile.

## Associations (connect to the rest of the hive)
- The SC2 Hold/Stop split is the lesson for finding 1 and 7: Hold means "fire, never walk", and the repo's Hold already does that. Stop should either pursue or be renamed.
- Finding 2 changes the HIVE's Crumb economy numbers. The research's "toast runs" timing and "raid" windows (ammo.mjs raidRange 2) were computed on the wrong speed.
- Finding 5 links to research section F3 (spawn with full toast, Toast Tote): with slices lost on raids, a raid is worth more than the report assumes.
- The report's "Bagel = air raider" is contradicted by the code: the Bagel is dart, a melee roller with range 1 and ammo false, speed 2 (12 tiles/s). The SC2 analogue is a fast melee raider, not an air unit.

## Not checked
- Liquipedia unit pages and the Attack-move, Hold, Patrol, Stop pages (403). Blizzard quotes are the only fetched SC2 source here.
- No game run; all code findings are read, not executed.
