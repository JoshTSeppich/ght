# M7 MINUTIAE: HUD, feedback and sound (GHT /play)

Checker: haiku (web). Read-only. Code read by hand (no node run). Liquipedia checked via the raw form the HIVE tip gives.

## Web sources used
- Liquipedia Hotkeys, raw: https://liquipedia.net/starcraft2/index.php?title=Hotkeys&action=raw (fetched). Plain page URLs return 403. Minimap raw page returned 404, not used.
- Blizzard "Game guide: simplified controls": https://news.blizzard.com/en-us/article/6640645/game-guide-simplified-controls (fetched). F1 selects and cycles idle workers. Spacebar centres on the last warning notification, then cycles up to earlier ones. Drag-select. Minimap ping on Alt+G.
- Blizzard "Game guide: special controls": https://news.blizzard.com/en-us/article/4552955/game-guide-special-control (fetched). Idle icon or F1 cycles idle workers. Space cycles up to 8 past transmissions. Double-click selects all of one type.
- Liquipedia Hotkeys (raw) quotes: idle worker F1; Space "View last warning area"; Ctrl+# creates group; Ctrl+left-click selects all of that type; F2 selects entire army; Alt+# moves units between groups; Alt+G pings map. Sound/mute key: not on page.
- Not found: an SC2 alert or notification list (what triggers alerts, sound settings). The WebSearch for SC2 alert triggers found only old patch notes. Marked UNVERIFIED below.

## Mute control (the check you asked for)
- The mute key is the backtick. Confirmed: play/input.mjs:29 `MUTE_KEY = '`'`; app.mjs:504-505 toggles on it and toasts "Sound off (`)". play/index.html:7 header says "` mute". Correct.
- The on-screen label still says "(U)": play/toaster-sounds.mjs:152 `'Muted (U)' : 'Sound (U)'`. WRONG. And in classic keys U is Unplug (play/toaster-play.mjs HOTKEY_PROFILES.classic `unplug: 'u'`), so the label points at the wrong key in both profiles. See B1.

## MISSING (StarCraft II has it, GHT does not)

MUST
- M1. Silent refusals on train and build. A queued train refused for "queue-full" or "unit-cap" (env/commands.mjs:110, :113) or for lack of wheat gives no text. The only reject texts are for place-power and set-fence (play/station-controls.mjs:56-63), and noteEvents only toasts those (play/input.mjs:543-545). The card shows red price only (play/command-card.mjs:52 class "poor"). SC2 prints a message for "Not enough resources" and "Supply blocked". Evidence: not found: grep "queue-full" in play/ (no toast mapping). Fix: add reject text for train (queue-full, unit-cap, wheat) to REJECT_TEXT.

SHOULD
- M2. Alert history. SC2 Space cycles back through up to 8 earlier notifications (Blizzard 4552955). Here only one slot holds the last alert: play/input.mjs:182 (ui.alert), :530 (Space jumps to it). The history exists but is not wired: play/teach.mjs:131 createAlerts (with Shift-Space walk-back, teach.mjs:138) is called only by teach.test.mjs. Not found: grep createAlerts in play/app.mjs.
- M3. Text alert for power out and toast out. Power-down plays a sound only (play/toaster-sounds.mjs cuesFor 'powerdown'); toast out is a blinking chip (play/hud-bar.mjs:100 blink when stack 0) and a growl. Neither reaches Space or the alert line. Only "under attack" and "Construction complete" are alerts (play/input.mjs:552, :555). SC2 announces these kinds of loss through its notification line.
- M4. Idle-Crumb button shows no key. SC2 idle icon shows F1 (Blizzard 6640645 and Liquipedia Hotkeys). The live button (play/idle-crumbs.mjs idleButtonHtml, imported at app.mjs:25) says "Idle Crumbs N" and the key is only in its title on hover, and the title says F1 (idle-crumbs.mjs). Visible hint missing; see B7 for the wrong key in teach.mjs.
- M5. Music in /play. None. The only ambient loop is in the 3D viewer (viewer3d/audio.mjs:251-256). assets/audio/MANIFEST.json lists ambient_loop, but play/ never plays it. Not found: grep "ambient_loop" in play/ (only viewer3d). SC2 has music.
- M6. Ctrl+F1 select all idle workers (Blizzard 4552955). Not found: grep "F1" in play/app.mjs shows only the single-cycle at app.mjs:525.
- M7. Ctrl+click selects every unit of a type (Liquipedia Hotkeys). Not found in play/input.mjs; double-click does it (index.html:5). Partial.

NICE
- M8. Keyboard minimap ping. SC2 uses Alt+G. Here pings only come from mouse click (play/app.mjs:462-470, :676-682) and from being hit (play/minimap-kitchen.mjs:36-50).
- M9. Tab (inspect power, app.mjs:526) is not in the key legend in play/index.html:6-10. Undocumented.
- M10. Research-done alert: not applicable. /play has no research (HIVE correction 1). Recorded so nobody adds it blindly.

## BROKEN (exists, but wrong, inconsistent or contradicted by text the player sees)

- B1. Mute label says "(U)" (play/toaster-sounds.mjs:152). Key is backtick (input.mjs:29). Fix the label string.
- B2. Toaster upkeep tip is 2x too high. play/hud-tips.mjs:25 reads `{...BUDGET, ...(STATS.budget||{})}.upkeepPercentPerMinute`. STATS.budget is not set, so it falls back to BUDGET's 10 (env/budget.mjs:23). The GHT rate is 5 (env/stats.mjs:166 `toaster.upkeepPercent: 5`, applied at play/toaster-play.mjs:25 as state.budget.upkeepPercent, used at env/budget.mjs:85; economy-table.mjs:56 uses 5%). Example: Popper 75 wheat: tip line hud-tips.mjs:44 says "Eats 7.5 wheat a minute"; sim eats 3.75 (hud-bar.mjs:105 upkeep chip shows the sim figure). Player sees two different upkeeps. Fix: read STATS.toaster.upkeepPercent.
- B3. "press F to fence the line" is wrong for the default grid keys. play/hud-tips.mjs:58 (extension) and play/teach.mjs KIND_LINE. In HOTKEY_PROFILES.grid, fence = 'a' and forge = 'f' (play/toaster-play.mjs:79-97). F builds the Assembly Line. The text is copied from the classic profile (fence 'f' there).
- B4. Power tooltip names classic keys. play/hud-bar.mjs:69 "Windmills (N) and Dams (D)". Grid keys: windmill C, dam V (toaster-play.mjs grid). N and D are classic.
- B5. Flak Popper tip: "crouton flak for swarms and anything that flies" (play/hud-tips.mjs:51). Nothing flies (HIVE correction 2).
- B6. Lancer text contradicts itself. hud-tips.mjs:48 (Zapper) says "bites close and fast". teach.mjs KIND_LINE lancer says "Hits from a distance". The teach text only shows in classic (command-card.mjs:42 uses teach describe when tips are off, app.mjs:759 passes tips: toaster.on), but the classic text lists classic kinds (depot, drill, siphon, press, tradinghouse at teach.mjs KIND_LINE). Keep one source.
- B7. Idle-Crumb hotkey '.' is not bound. play/teach.mjs:53 IDLE_KEY = '.'; the coach line teach.mjs:96 says "Press . to select it". Not found: grep "'\.'" in play/input.mjs (no binding). The real key is F1 (app.mjs:525). teach.idleButtonHtml (teach.mjs:65-72) is not used by app.mjs (app uses idle-crumbs.mjs).
- B8. Coach text uses wrong keys if it ever runs. teach.mjs:RULES: train-worker fallback 'W' (grid worker is 'a', toaster-play.mjs:86); attack text "press A" (no attack key in grid; attack-move is T). The coach is dead: createCoach is only in teach.test.mjs (not found: grep createCoach in play/app.mjs). Either wire it or delete it.
- B9. Two stingers on a win in /play. app.mjs:309 plays synth 'jingle' on a win. app.mjs:313 `else showResult(...); sounds.play(...)` is unbraced, so the sample stinger also plays on every result, including GHT wins and losses.
- B10. Most sample events are never played. app.mjs:305-313 is the only sounds.play call (the result stinger). unit_select, unit_move_ack, ranged_shot, melee_hit, building_finished, alert_under_attack, resource_collected in assets/audio/MANIFEST.json are dead in /play; the synth in play/toaster-sounds.mjs does the work. The manifest note ("Nobody has listened to these yet") is still true.
- B11. Ding on cancel (UNVERIFIED sim detail). toaster-sounds.mjs cuesFor 'queue': a shrinking queue plays "ding" ("toast ready"). If a cancel also emits a 'queue' event, cancelling plays the unit-ready sound. Did not confirm the event in the sim.
- B12. Kitchen toast arrow shows twice in one row. play/kitchen-panel.mjs row 4 prints "toast/min" before and after the Toast box with the same number. Cosmetic.
- B13. Alerts are not rate-limited by building. input.mjs:552 replaces the alert text on every hit; the Space line then names the newest hit only. Sound 'ouch' is limited to 0.15 s (toaster-sounds.mjs LIMITS), pops are not.
- B14. Under-attack names the unit, construction alert does not name the building (input.mjs:552 vs :555). Minor.
- B15. Circular import: play/hud-queue.mjs imports portraitSvg from hud.mjs, and hud.mjs imports renderQueue. Works (used lazily) but fragile.

## FINE (exists and matches code and, where checked, SC2)
- F1. Top bar: Wheat, Flour, Water, Toast, Power used/made, Upkeep, Toasters N/40 (env/stats.mjs:98 unitCap 40), clock with countdown in the last minute (hud-bar.mjs:78, :116). Matches the 15:00 match.
- F2. Blink chips for empty Flour, Water, Toast and unplugged Power (hud-bar.mjs:97-103; index.html .blink CSS).
- F3. Pilot light chip (hud-bar.mjs:95, :114).
- F4. Alert line shows for 6 s with (Space) hint (input.mjs:552-555; app.mjs:749). Space = last alert matches Liquipedia "View last warning area" and Blizzard "centres on the last warning notification".
- F5. Selection panel: single entity (portrait, HP, status, queue, item slots, rank stars), Hungry chip for toast-less fighters (hud.mjs:100), multi-select grid with chips and click-to-single (hud.mjs:124-137). Matches SC2 selection panel.
- F6. Health bar colours from palette thresholds (hud.mjs:31-39).
- F7. Queue: progress bar, icons, click to cancel with refund text (hud-queue.mjs:23-35). Refund is 0 under upkeep (hud-queue.mjs:19), correct for budget mode.
- F8. Build/train tooltip: cost, build or bake time, one-line sentence and numbers (hud-tips.mjs:69-86). Numbers checked against code: Mill 10 wheat = 1 flour / 20 s = 3 a minute (bakery.mjs:32-33); Toaster 4 slices every 5 s (bakery.mjs:35-36); Well 6 s (bakery.mjs:34); pantry 6 + 3 per Toaster (bakery.mjs:37-38).
- F9. Locked entries say why first (command-card.mjs:33-36 tooltip, input.mjs:441 reason). Only the reason strings for locks; "Needs a Toaster" style lines are in input.mjs, not checked line by line.
- F10. Kitchen panel: boxes, arrows with per-minute numbers over 60 s, grey unbuilt boxes with cost and hotkey (kitchen-panel.mjs:24-120). Opens once on the first Mill (kitchen-panel.mjs update). K trains a Flak Popper on a selected building (keyAction), so K is not stolen.
- F11. Idle Crumbs: auto-gather after 3 s (idle-crumbs.mjs IDLE_TICKS 72), blinking button, F1 cycles (idle-crumbs.mjs). SC2 does not auto-send idle workers; this is a design choice, noted for the report.
- F12. Badges over Mill, Well, Toaster for missing wheat, water, flour, power, full pantry (hud-badges.mjs:12-34, BADGE_TIPS). Blink 0.5 s on, 0.3 s off.
- F13. Minimap hit pings and click pings (minimap-kitchen.mjs:36-50; app.mjs:462-470, :676-682). Red attack, green move.
- F14. Chirp on order, pop on each shot (toaster-sounds.mjs cuesFor). Unit acknowledgement exists (chirp). Attack sounds exist (pop, ouch, alarm for core).
- F15. Alarm for the Power Strip hit (toaster-sounds.mjs cuesFor: core/strip -> alarm).
- F16. Mute persists across pages (ght.muted in localStorage, toaster-sounds.mjs:3, sound-player.mjs:7). ?mute=1 works (app.mjs:282, :304).
- F17. Volume slider, saved (toaster-sounds.mjs:145-156 and VOL_KEY).
- F18. Clicking "Sound" label toggles mute (toaster-sounds.mjs:154). The label text is the only problem (B1).
- F19. Teach/tutorial card is wired (app.mjs:247 mountTutorial). Not checked line by line here; the M7 HUD and the first-minutes text in tutorial.mjs were not read in full.

## Associations (to other slices and reports)
- Upkeep tip (B2) and the F8 numbers come from the same table. The top bar uses the sim's 5 percent; the tip uses the default 10. Same root as HIVE correction 6: the report's numbers must come from one table.
- M1 (silent refusals) links to the reject path for the station commands (station-controls.mjs). Fixing it is one REJECT_TEXT entry per refusal reason.
- M2/M3 link to the 15:00 match: losing Toast or Power silently is what makes a raid decisive. SC2's notification line is the model.
- The idle-worker design (F11 auto-gather) has no SC2 counterpart and should be stated in the report as our rule, not SC2 practice.
- Liquipedia hotkey conflicts are the same problem as the report's hotkey claims: classic letters leaking into grid text (B3, B4, B7, B8).

## UNVERIFIED
- SC2 alert triggers and sounds (which events, how many, which volume). Liquipedia Alerts and Notifications pages not reached; search gave only old patch notes.
- SC2 "Not enough resources" and "Supply blocked" messages: from general SC2 knowledge, not fetched. Put in M1 as a recommendation, not a sourced fact.
- B11 (ding on cancel): needs the sim event list.

## Summary
- MUST: M1 (silent refusals). SHOULD: M2-M7. NICE: M8-M10.
- BROKEN: 15, of which the most visible are B1 (mute label), B2 (upkeep tip 2x), B3 (F fence key), B4 (N/D keys), B5 (flying), B9 (double stinger).
- FINE: 19 groups.
