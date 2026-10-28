# M8 match flow: menu to score screen (web checker, Haiku)

Scope: play/app.mjs, play/results-card.mjs, play/opponent.mjs, play/sandbox.mjs, play/watch.mjs, env/live.mjs, env/referee.mjs, env/sim.mjs, env/stats.mjs. Read-only. Chat read to #1192; posting one check-in after this file.

## Web sources: status
- Liquipedia direct fetches all returned HTTP 403 (Stalemate_Detection, Replay, Game_Speed). Liquipedia claims below come from WebSearch snippets only, NOT from a fetched page. Treat them as UNVERIFIED until a fetch works.
- Blizzard news and fan pages were seen only as search snippets.

## Start screen and options (code)
- There is no start screen. index.html has no menu; play boots straight into a match behind a "loading…" overlay (play/app.mjs:802).
- Options are URL query only: `seed` (default 7), `side` (0 or 1, any mode), `difficulty` (easy default, normal for watch, none = sandbox), `ai`, `ticks` (default 21600), `tps` (default 24), `keys`, `mute`, `tutorial`, `territory`, `mode=watch|sandbox`, `replay`.
- Map: the only map is wheatfieldMap (play/toaster-play.mjs). No map picker found.
- Opponent: play/opponent.mjs maps easy to players/toaster-easy and normal to players/toaster-sonnet. Easy's comment says "never a Strip kill before 10:00" (CORRECTNESS of that claim UNVERIFIED: not tested here).
- The AI idles until 3:00 (aiStartTick = 24*180 = 4320, env/live.mjs:51). The human has no peace period.

## Loading
- The clock starts only after the AI module loads (env/live.mjs:479-481). A failed load forfeits the AI at tick 0; the human wins (env/live.mjs:450-456).
- Loading time is never caught up as game time.

## Pause, speed, menu
- P toggles pause (play/app.mjs:507-512). Pause halts the clock; the AI is not asked while paused.
- Menu / F10 (play/results-card.mjs:92-117) opens Resume / Surrender / Restart. **Opening the menu does NOT pause the game** (only P calls driver.pause). The clock keeps running under the menu.
- Game speed: only the sandbox has speed keys ([ and ], play/app.mjs:513-516). Steps are 0.5, 1, 2, 4 (play/sandbox.mjs:7). Live matches are always 1x for players.
- env/live.mjs:487-494 setSpeed says "0.5x to 4x" in its comment but accepts any value up to 16. Mismatch, but not player-reachable.
- Watch mode also accepts P (pause) but has no speed keys.

## Surrender, victory, defeat, draw (what triggers each)
- Surrender: Menu, Surrender, then "Really surrender?" (two clicks). Calls driver.resign(); AI wins with reason `forfeit` (env/live.mjs:517-522).
- Core kill: reason `core`. One Core (Power Strip in GHT) gone = the other side wins (env/sim.mjs:110-112).
- Both cores on the same tick: DRAW, reason `both-cores` (env/sim.mjs:110).
- Timeout at tick >= maxTicks (21600 = 15:00 at 24 tps): higher sideValue wins; sideValue = units at cost + complete structures at cost + Power Strip hp (env/sim.mjs:114-137). An exact tie on value falls back to the wheat bank (state.shards). If the bank also ties, DRAW (env/sim.mjs:117-118).
- AI forfeits (env/live.mjs:277-303): a single hard timeout (hardMs 1000) forfeits at once; 50 cumulative errors (throwLimit) forfeit. A reply over thinkMs (50 ms) is "late" and its commands are dropped, not forfeited.
- A stopped driver or a sim throw halts the clock (env/live.mjs pump, emits error).

## Stalemate rule
- env/ and play/ contain NO stalemate or idle-end rule (grep for stalemate, sudden-death, tie-break: no hits). A match where both sides idle runs to 15:00 and is decided by value, then bank.
- See SC2 comparison below.

## Score / results card (GHT)
- Shows: DRAW / VICTORY / DEFEAT, one reason line, Winner, Time, Wheat gathered, Slices baked, Toasters lost, one tip line, Restart, Watch replay, Play again on Normal, Enter restarts (play/results-card.mjs:54-66; app.mjs:815-821).
- Stats are for YOUR side only (createMatchStats(side)). The enemy's numbers are not shown.

## Bugs and copy problems (verified by reading the code)
1. **"Play again on Normal" drops the query.** app.mjs:818 calls resultsCardHtml(result, side, totals, { tps }) with no `query`, so the link defaults to `?difficulty=normal` and loses seed, ticks, side, keys, mute and tutorial settings. Fix: pass `query` (results-card.mjs:54 already accepts it).
2. **Timeout copy on a DRAW.** On an exact tie the banner says DRAW but the reason line still says "Time ran out; the stronger side wins." (results-card.mjs:26, 57).
3. **Forfeit copy blames the AI.** A winning human sees "The other side gave up." for any forfeit, including AI load failure, 50 errors or a hard timeout (results-card.mjs:57). The AI did not give up.
4. **"Enter for a new game" = same match.** Enter and Restart call location.reload() with the same query (app.mjs:503, 819), so the same seed (default 7) replays the identical map and opening. Nothing randomizes the seed.
5. **Timeout tie-break hidden.** The card never says the wheat bank breaks a tie, so a player can't learn the rule from the end screen.
6. **Only the last match is kept.** saveLastMatch writes sessionStorage 'toaster-last-match' only (results-card.mjs:69-74). It is lost on tab close and holds one match. No file export.

## Replays and watch mode
- Replay = `?mode=watch&replay=last` replays the stored command log; the match runs to log length + 1 (results-card.mjs:72, 82-86).
- Watch mode (TV): a 10 s countdown then the next seed (play/watch.mjs:10; app.mjs:842-852). If the clock sits at 0:00 for too long, the page falls back to live AIs once (app.mjs:585).
- Watch end shows a winner or Draw; the replay-over screen offers Play again only.

## SC2 comparison (Liquipedia not fetched; WebSearch snippets only)
- **Stalemate:** search snippet says patch 1.2.0 (Jan 2011) ended the game in a tie for all remaining players after 3 consecutive minutes with no income, no production and no structure destroyed, with a countdown shown. A melee option could switch the check off. Modern rules UNVERIFIED. GHT has no such rule; idle sides sit to 15:00. This is a gap to decide on, not a bug.
- **Timeout:** SC2 has no fixed time limit; GHT' 15:00 limit is a design choice. Its tie-break (value, then wheat bank) differs from SC2's tie.
- **Surrender:** SC2 surrender ends one player. GHT does the same and adds a two-step confirm: good.
- **Replays:** SC2 saves .SC2Replay files and a replay library. GHT keeps one session-scoped record. Gap, not an error.
- **Pause:** SC2 single player pauses via the game menu. GHT pauses only via P and does not pause on the menu (see above).
- **Speed:** Liquipedia's speed list (Slower to Faster, Faster default for ladder) UNVERIFIED. GHT has no speed control for players.
- **Score screen:** a patch-note snippet mentions a Technology column on the Score Summary tab; SC2 shows both players. GHT shows only your side.
- **Replay viewer:** snippets mention speed change and rewind; pause not found in sources. GHT watch mode has P.

## Association (to the research)
- The HIVE correction on "15:00 timeout" is confirmed in code: a GHT match with no fighting lasts 21600 ticks and is decided by sideValue, not by economy. Any design that wants the SC2-style stalemate rule needs a new check in env/sim.mjs checkEnd (idle for 3 min, no income, no production, no kill).

## Summary
- No start screen; URL query is the only option set.
- Pause does not stop the menu. Speed is sandbox-only.
- No stalemate rule in code; SC2 had one from 2011 (per snippet).
- Bugs: Play-again-on-Normal drops the query; DRAW shows the timeout line; forfeit copy blames the AI.
