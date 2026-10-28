# M10 check: THE BOTS (computer opponent), 2026-10-26

Checker: haiku (web slice M10). Code and match facts are from reading players/, play/opponent.mjs, play/app.mjs, env/stats.mjs, tests/toaster-easy.test.mjs and summarising matches/*.json with node. Web facts are only those seen on a fetched page or a search snippet; the snippet-only ones are marked.

## 1. Which bots exist and which one /play uses

- /play (play/opponent.mjs, play/app.mjs:218-220): default is **toaster-easy**. `?difficulty=normal` picks **toaster-sonnet**. `?difficulty=none` is the sandbox (idle enemy, cheat keys). `?ai=` overrides everything. With Toaster Wars off, the default is the classic `players/builtin/ai.mjs`.
- Bot folders under players/: builtin, toaster-easy, toaster-sonnet, sonnet, haiku, fable, fanatic-sonnet, fanatic-haiku, fanatic-fable, defender-sonnet, sample-player.mjs. Only toaster-easy and toaster-sonnet are wired to /play. I did not audit the other older bots.
- Tests: tests/toaster-easy.test.mjs asserts easy loses to normal, no Strip dies before 10:00, and 3-8 fighters at home at 8:00. These are assertions, not recorded results.

## 2. toaster-easy (players/toaster-easy/bot.mjs, 33 KB, one file)

- Build order (line 'const build'): mill, well, toaster, forge, toaster, mill, well. First build at 0:20. One building at a time, BUILD_GAP 45 s (a "slow kitchen"). Needs 4+ workers.
- Workers: trains Crumbs up to 6 total.
- Army: trains only grunt (Popper, 75 Wheat) and lancer (Zapper, 65 Wheat). Rule: grunt first; lancer once there are at least 4 grunts and lancers < grunts-3. The comment says "mostly Poppers", the code gives roughly 4:1 early, then about 3:1 hovering. Army cap 6 before 8:00, 8 after.
- Power: Windmills on 4 pads (WANT_TOASTERS 2), an Extension Box chain toward the enemy Strip, cord-wrap planning copied in, plugs cut cords (plugs do not fail silently; they retry after 6 s).
- Scouting: none. The bot does not send a unit to look; it only reads the observation.
- Attack: no push before 8:00 (PUSH_TICK). The chain stops at 35% of the lane (HOLD_FRAC) until then. After 8:00 it sends ONE squad of 6 (SQUAD) along the chain. No second wave while the squad lives.
- Retreat: the squad goes home when toast <= 3 (HUNGRY) and may go out again at toast >= 9 (FED), after a 30 s rest.
- Strip: never attacks the enemy Strip before 10:00 (NO_STRIP_BEFORE).
- Harass: none. Expansion: none (one Strip, no second base). Research: none.
- Bakery / Four-Slice / Broiler / Flak Popper / Bagel: never trained or built. (grep: zero hits for bakery, brute, howler, spiker, dart, research in this file.)
- Refusal handling: a refused order is banned 8 s; one retreat per quiet spell.

## 3. toaster-sonnet (players/toaster-sonnet/bot.mjs, 31 KB)

- Same skeleton (cord-wrap, box chain, plugs, windmills).
- Build order: mill, well, toaster, forge, mill, toaster, well, forge, toaster, mill, well, toaster, mill. No 45 s gap check read; BUILD_GAP not verified.
- Army: lancer when nl < ng, else grunt, so alternating 1:1 Zapper:Popper. Cap 8 before push, 14 after push, 16 when arrived, plus a shards bonus.
- Push: PUSH_TICK at 8:30; pushes only with army >= 12. HOLD_FRAC 0.5 (chain to half the lane before push).
- Attack: all fighters attack when the tip arrives and army >= 12 after 8:30 (the "go" flag). No squad concept.
- Scouting, harassment, expansion, research, bakery, Four-Slice, Broiler, Flak, Bagel: none found (grep zero hits).

## 4. Classic builtin AI (players/builtin/ai.mjs), the non-Toaster fallback

- Two settings in code (lines 18-19):
  - easy: 8 workers, Forge at worker count 5, one Forge only, no Turret expansion, wave size 12, earliest attack tick 4800, waveByTick 6600, minArmy 5, think every 6 ticks, queue 1.
  - normal: 12 workers, Forge at 4, second Forge, Turret at expansion, wave size 8, earliest 2400, waveByTick 4800, minArmy 3, think every tick, queue 2.
- It does train from any kind listed in the building's `trains` list, so it can use every kind in the roster. It does expand (claim) and builds a Turret for the claim.

## 5. Match results (matches/)

- matches/room/latest.json (toaster-sonnet mirror, seed 668, 18,272 ticks = 12:41): side 0 won by core kill, value 3079 vs 1143.
  - Both sides: first Popper/Zapper queued at ~1:15, first attack command at 8:30 (8.5 min), first plug at ~9-10 min.
  - Side 0: 1767 attack commands, 76 plugs, 42 grunt + 46 lancer trains. Side 1: 1204 attacks, 8 plugs, 38 grunt + 50 lancer trains.
  - Events: 263 "bake", 31 cord-cut, 30 raid, 200 die, 83 plug-fail.
  - Side 0 wins after cutting side 1 cords and plugging its own; side 1 did not repair cuts (8 plugs vs 76).
- matches/latest.json, sample-1.json, sample-7.json: sample-player vs sample-player on the classic 32x32 format, all timeouts (2000 or 4320 ticks). Not Toaster bots. Not evidence for any bot.
- No recorded easy-vs-normal result exists in the repo. The claim "easy loses to normal" is only a test assertion.

## 6. Web: what the SC2 built-in AI does

Verified on a fetched page:
- sc2mapster wiki (https://sc2mapster.wiki.gg/wiki/Tutorials/Artificial_Intelligence), the editor AI doc, not the skirmish AI: ten levels "Very easy" to "Cheater 3" in the preferred setup; campaigns use Easy, Normal, Hard, Brutal. No numeric effect per level stated. The melee build order is predefined and cannot be changed (Method 1 starts 100 minerals, 6 workers). Default APM cap 200. Attack waves are defined by triggers (wave size, composition, send frequency: not stated). Bullies (harass units) exist in the editor. Retreat not mentioned.

Search snippets only (fetch failed):
- Liquipedia (https://liquipedia.net/starcraft2/Artificial_Intelligence) returned HTTP 403 to WebFetch. The snippet lists Very Easy, Easy, Medium, Hard, Harder, Very Hard, Elite, then Cheater 1 (Vision), Cheater 2 (Resources), Cheater 3 (Insane). UNVERIFIED on a fetched page.
- Liquipedia snippet: the AI picks a build matching the opening type you select (build order dropdown). UNVERIFIED.
- Old Blizzard forum thread (https://us.forums.blizzard.com/en/starcraft/t/how-to-stop-the-ai-s-first-push/127): anecdotal, pre-patch, says the AI builds economy first then a 12-unit push around 6:00, knows your base location, and reacts poorly to tech. UNVERIFIED and dated.
- Academic note (TStarBots, paperswithcode snippet): the top difficulty tiers are described as cheating (vision, income). UNVERIFIED on a fetched page.

Not found: any primary source with wave sizes, send timings, scouting thresholds, or retreat rules for the skirmish AI.

## 7. Associations (web to code)

- SC2's top tiers cheat by income and vision. toaster-easy and toaster-sonnet have no difficulty knob at all beyond which bot runs, and no income or vision bonus. So "normal" is a different bot, not a stronger version of "easy". The SC2 pattern (same brain, scaled timing and income) would be a cleaner difficulty dial than swapping whole bots.
- SC2 AIs use build-order variety (a dropdown of openings). Our bots have one fixed build list each; the only variety is the order of the same buildings in sonnet vs easy.
- SC2's melee AI uses a timed first push with a defined wave. toaster-easy's squad of 6 and toaster-sonnet's push at 8:30 with army >= 12 are the same idea. Neither scouts, so neither can adapt the way a scouted build can.
- Code vs HIVE correction 1 (no research): the bots never research either, so "build order with upgrades" is absent on both sides, not just in /play.
- Code vs HIVE correction 2 (Bagel is melee ground): no bot trains the Bagel (dart), Broiler (howler), Flak (spiker) or Four-Slice (brute). The bots use only 2 of 7 roster kinds. Consistent with the report's unit mix being unplayed.

## 8. Lines to take away

1. /play default is toaster-easy; normal is toaster-sonnet; none is the sandbox.
2. Easy: slow kitchen, 6 fighters home until 8:00, one 6-unit squad after, no Strip hit before 10:00, no scouting, no harass, no expansion.
3. Sonnet: same machinery, push at 8:30 with 12+ army, Zapper:Popper 1:1.
4. Bots never use Bakery, Four-Slice, Broiler, Flak, Bagel, or research. Only 2 of 7 roster kinds.
5. Match room: toaster-sonnet mirror, side 0 won at 12:41 by core kill; cord cuts and plugs decided it (76 vs 8 plugs).
6. sample-1/sample-7/latest are the classic sample bots, timeouts, not evidence.
7. Liquipedia 403; the difficulty names are from a snippet only.
8. Web gives no verified numeric wave, scout or retreat behaviour for SC2's skirmish AI.
