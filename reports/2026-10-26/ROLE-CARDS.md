# Role cards — GHT fix waves (2026-10-26)

Source: the Claude doc "GHT — What's Missing (verified)", tab "Role cards". Evidence for every item is in reports/2026-10-26/verify-*.md and web-*.md.

Standing rules for every builder: own only the files your card lists; tests first; never loosen, skip or delete a test; no git commit/push/checkout, no rm, no npm install; one plain command per Bash call (no && ; | chaining). Chat is in the repo root: `node read.mjs --since N` to read, `node say.mjs <haiku|sonnet> "text"` to post (under 700 chars). Post PLAN when you start, REVIEW? with files changed, then DONE (or BLOCKED) in plain words of what Joshua sees on /play. Shared files go in order: play/input.mjs (Controls, then HUD), play/app.mjs (Controls, then Match Flow), env/commands.mjs (Economy, then Construction, then the Controls rally order), play/teach.mjs (UX Writer, then HUD). If a file on that list is mid-edit by an earlier owner (check chat), touch only your own lines and say so in REVIEW?. The Mac's disk is tight: write no large files.

## 1. Match Rules Engineer — 2 agents (Sonnet lead, Haiku tester)
Mission: every match ends by a rule the player understands, and most end before 15:00.
1. Stalemate detection in env/sim.mjs. Track the last tick with structure damage, a unit kill or a new structure; income does not count. After 120 s with none, emit `stalemate-warning` and count down 60 s; then end with reason `stalemate`, scored like a timeout.
2. Timeout tie-break (env/referee.mjs:202, sideValue in env/stats.mjs:540): add a per-side "damage dealt to enemy buildings" counter (coordinate with Combat, which increments it) and use it before the Wheat bank; equal counters make a true draw.
3. Territory win (env/territory.mjs:7): read the map's own target (winCountFor in maps/layout-sizes.mjs) instead of a fixed 14.
4. Default length (env/stats.mjs:97): 2,000 ticks to 21,600; fix every test that leans on 2,000 (grep maxTicks).
5. Replays (env/live.mjs:136): rerun() reads the log's rules and rebuilds a GHT state.
Tests first: tests/stalemate.test.mjs, tests/timeout-tiebreak.test.mjs, tests/territory-wincount.test.mjs, tests/rerun-toaster.test.mjs.
Owns: env/sim.mjs, env/referee.mjs, env/territory.mjs, env/live.mjs, the match block of env/stats.mjs.
Done when: in a 40-match bot league fewer than 4 end on the timer, and rerun() reproduces matches/room/latest.json exactly.

## 2. Combat Systems Engineer — Haiku A now (lead and Haiku B wait for decisions 1 and 3)
Mission: you shoot what you see, and fights follow readable rules.
1. Fog: chooseTarget (env/combat.mjs:57-70) only takes enemies on tiles the attacker's side can see (visionOf); an ordered attack needs vision too.
2. Target hold: keep `unit.targetId` while valid and in reach; re-pick only when not.
3. Priority when nothing is ordered: armed units, then Crumbs, then buildings, then the Power Strip.
4. Splash (env/combat.mjs:88-99): neighbours take half the base shot, not the building-multiplied one.
5. Heat Lamp (env/combat.mjs:36-42): fires only while powered, like units.
6. A per-side building-damage counter for Match Rules.
Tests first: combat-fog, combat-target-hold, combat-priority, combat-splash-structure, heat-lamp-power.
Owns: env/combat.mjs, targeting reads in env/vision.mjs.
Done when: the new tests and the full suite pass.

## 3. Tech Tree Engineer — Haiku A now
Mission: the tree the player sees is the tree the simulation enforces.
1. env/sim-territory.mjs:199-207: under `noTiers`, check the GHT tiers (toasterTiers, env/stats.mjs:251-255) with a sim-side copy of kitchenLockReason (play/input.mjs:195). Refuse with `needs-toaster` or `needs-power`.
2. Same check for place-power of a Relay Pylon (env/sim-territory.mjs:196).
Tests first: tests/tier-sim-enforce.test.mjs (Four-Slice with no Windmill or Dam is refused; a Pylon with no Toaster is refused; bots still pass tests/bots*).
Owns: tier checks in env/sim-territory.mjs, env/tiers.mjs.
Done when: a scripted client cannot skip a tier.

## 4. Economy Engineer — 2 Haiku (A: spreading, B: running out and numbers)
Mission: default worker behaviour mines well, and running out of Wheat is never silent.
A1. play/idle-crumbs.mjs:12-23: send an idle Crumb to the least-loaded Wheat tile in cord reach, not the nearest. A tile is full when every passable tile beside it holds a Crumb.
A2. The Power Strip's default rally (play/input.mjs:604-606) uses the same pick and stays inside cord reach (coordinate with Controls on play/input.mjs: touch only those lines).
A3. Move the pick into the simulation (a `gather` order with target `auto` in env/economy.mjs) so bots and replays get it.
B1. When a tile empties, retarget (env/economy.mjs:201-209) inside cord reach; if nothing is left, emit `field-empty`.
B2. Unit cap: keep 40 (env/commands.mjs:113) and correct the "no cap" note in env/budget.mjs:55.
B3. Starting Crumbs: env/economy-table.mjs says 4, the map gives 6; make the table read the map.
B4. Expose workers-per-field and capacity per base for a HUD saturation readout.
Tests first: tests/idle-crumbs-spread.test.mjs (16 idle Crumbs mine at least 400 Wheat a minute over 3 minutes, measured like reports/2026-10-26/web-M3-economy.md), tests/field-empty.test.mjs, tests/unit-cap.test.mjs, tests/start-crumbs.test.mjs.
Owns: play/idle-crumbs.mjs, env/economy.mjs, env/budget.mjs, the cap line in env/commands.mjs, env/economy-table.mjs.

## 6. AI Engineer — Sonnet lead + 2 Haiku
Mission: the computer plays the whole game: every unit, the bakery, scouting, raids and real attacks.
Haiku A, players/toaster-easy: Mill, Well and Toaster by 2:00; once a tier opens, train from a mix table including every unit of that tier; attack the Strip between 6:00 and 8:00; pull back below 0.7 of visible enemy army value.
Haiku B, players/toaster-sonnet (Normal): scout with a Crumb at 1:30; counter-build from a table (Broilers against massed Poppers and Zappers, Four-Slices against Broilers); raid Crumbs with Zappers and Bagels.
Lead: new players/toaster-hard with four personalities (rush, fast expand, tech, turtle) and scripts/league.mjs, a round robin with spawns swapped writing timer endings, first damage, units used and expansions to reports/league/latest.json.
Tests first: tests/bots-all-units.test.mjs (every unit kind appears over 10 seeded matches), tests/bots-attack-time.test.mjs (Normal damages a Strip before 8:00), tests/bots-legal.test.mjs (no refused orders).

## 7. Controls Engineer — 2 Haiku (A: keys and camera, B: selection and orders)
Mission: every key does what the card and SYSTEMS-DESIGN.md say, in both key profiles, and no browser shortcut leaks.
A1. play/app.mjs:257 passes the GHT rows (rowOf) to createInput, so Hold and attack-move use real ranges (play/input.mjs:598, 626, 655).
A2. Saved cameras: wire cameraKeyAction and createCameraMarks (play/camera.mjs:80-104): F5-F8 recall, Ctrl+F5-F8 save, preventDefault so F5 never reloads; sandbox cheats move to Shift+F5-F8 (play/app.mjs:517).
A3. Tab: move "inspect power" (play/app.mjs:526) to another key; Tab cycles unit types (play/input.mjs:499-510).
A4. P: Patrol must be reachable on the classic profile (play/app.mjs:507); Pause moves to the F10 menu or only fires with nothing selected.
A5. Letter hotkeys ignore Ctrl or Cmd; preventDefault on Ctrl+0 (play/input.mjs:516-535, play/app.mjs:530-533). Page Up and Page Down change the view.
B1. Alt+number makes a group and removes those units from other groups (play/input.mjs:245; stop dropping Alt at play/app.mjs:530).
B2. Ctrl+click selects every unit of that type on screen (play/input.mjs:220). Box select takes buildings when no units are inside (play/input.mjs:90, 240). F2 has no 12 cap (play/input.mjs:26, 526). Ctrl+F1 selects every idle Crumb. Right-click a friendly unit to follow it (play/input.mjs:305). Attack-move and Shift-queue on the minimap.
B3. Rally in the simulation: a `set-rally` order in env/commands.mjs after Economy and Construction land (check chat), so bots and replays see rallies.
Tests first: one test per key in tests/input*.test.mjs and play/app.test.mjs.
Owns: play/input.mjs, key handling in play/app.mjs, play/camera.mjs.

## 8. HUD, Alerts and Audio Engineer — 1 Haiku (after Controls posts DONE)
1. Show a line for every refused train or build (queue full, unit cap, not enough Wheat, needs a Toaster) by extending noteEvents (play/input.mjs:543-545).
2. Wire createAlerts (play/teach.mjs:131) so Space cycles back through the last 8 alerts.
3. New alerts: power out, toast out, field empty, construction finished naming the building.
4. Brace the else at play/app.mjs:313 so a win plays one stinger.
5. Play the ambient loop from assets/audio/MANIFEST.json on /play with the mute key.
6. The idle-Crumb button shows "F1" on its face; saturation readout on the Power Strip from Economy's numbers.
Tests first: tests/hud-refusals.test.mjs, tests/alerts-cycle.test.mjs, tests/result-sound.test.mjs.
Owns: play/hud*.mjs, play/toaster-sounds.mjs, alerts in play/teach.mjs.

## 9. UX Writer — 1 Haiku
1. Tooltips read rowOf, not STATS.units: Popper 20 damage, reach 4, 3.75 Wheat a minute (play/hud-tips.mjs:25, 40-44); check every unit.
2. Upkeep reads the GHT 5% (play/hud-tips.mjs:25).
3. "One slice per three shots" (env/stats.mjs:438 text only, play/hud-tips.mjs:47).
4. Flak Popper line without "flies" (play/hud-tips.mjs:51).
5. Keys come from the active profile through a helper keyFor(action) reading HOTKEY_PROFILES: fence, Windmill, Dam, Extension Box, attack-move, idle key (play/hud-tips.mjs:58, play/hud-bar.mjs:69, play/tutorial.mjs:10-11, play/teach.mjs:53, 96, 99).
6. Mute label "Sound (`)" (play/toaster-sounds.mjs:152).
7. Words for refusal codes too-close-enemy, needs-toaster, needs-power (play/placement-ghost.mjs:77-86).
Tests first: tests/text-truth.test.mjs (every tooltip number equals rowOf; no tip names a key that is not the active profile's key for that action).

## 10. Match Flow Engineer — 1 Haiku (after Controls posts DONE)
1. play/start-screen.mjs: pick map, side, opponent (Easy, Normal, Hard when it exists), key profile and seed; it writes the query the page already reads.
2. Result texts (play/results-card.mjs:24-28): one line per end reason: Strip destroyed, territory held, stalemate, timeout with the deciding number, true draw, opponent crashed or timed out.
3. Play again keeps every setting (play/app.mjs:818).
4. The F10 menu pauses the game; keep the last 10 replays with a list on the start screen.
Tests first: tests/results-text.test.mjs, tests/play-again-query.test.mjs, tests/start-screen.test.mjs.

## 11. Construction Engineer — 1 Haiku (after Economy posts DONE)
1. Placement ghost (play/placement-ghost.mjs) runs the same checks as the simulation, including the 6-tile enemy rule for Wells.
2. `cancel-build` order in env/commands.mjs: removes a site, refunds 75%.
3. `repair` order: a Crumb beside a damaged building restores hit points for Wheat (env/economy.mjs).
4. Card buttons for both (coordinate letters with Controls).
Tests first: tests/ghost-matches-sim.test.mjs, tests/cancel-build.test.mjs, tests/repair.test.mjs.

## 12. Power and Bakery Engineer — 1 Haiku
1. Mill Dam price: card and pre-check equal the charge (play/station-controls.mjs:11, env/power.mjs:209-211); one number in one table.
2. One reach rule for cords and fences (env/power.mjs POWER.range and STATION links).
3. Toast runs walk at the GHT Crumb speed (env/ammo.mjs:259 uses rowOf).
4. Four-Slice ammo shows volleys, not slices (env/ammo.mjs:362 observeAmmo).
Tests first: tests/station-price.test.mjs, tests/power-one-reach.test.mjs, tests/toast-run-speed.test.mjs, tests/four-slice-ammo.test.mjs.

## 13. Docs and Cleanup Engineer — 1 Haiku
1. scripts/tech-tree-doc.mjs reads the GHT tiers (env/stats.mjs:251-255) and says /play has no research yet; regenerate TECH-TREE.md; flag only same-card hotkey clashes.
2. reports/2026-10-26/SWITCHED-OFF.md: one line each for the research card, alert history, first-minutes coach, toast moods (env/toast.mjs) and unused samples: wire (which expert) or delete. Delete nothing yourself.
3. Stale comments: env/ammo.mjs:47, env/toast.mjs header, play/toaster-play.mjs:5 and 126, PLAYABLE.md:30, TERRITORY.md:51 versus 324-332.
Tests first: tests/tech-tree-doc.test.mjs fails when TECH-TREE.md names a tier rule /play doesn't use.

## 14. Balance toolsmith — 1 Haiku (the Balance lead waits for decision 1)
1. scripts/breakpoints.mjs prints hits-to-kill for every attacker and target at Weapons and Hide levels 0 to 3 from rowOf, flagging levels that change nothing against the three most common targets.
2. scripts/sandbox.mjs fights equal-value armies (500, 1,000, 2,000 Wheat) on open ground and at a choke; writes winner, value left, fight length.
Tests first: tests/breakpoints.test.mjs pins the table.

## 15. QA Lead — 1 Haiku
On every DONE in the rts chat: re-run that area's verifier prompt (reports/2026-10-26/verify-* and web-M*), run the full suite once, take one /play screenshot; post PASS or FAIL with evidence. Keep reports/2026-10-26/STATUS.md (each fix, owner, open/done/verified). Read-only except reports/.

## 0. toaster-hive MCP server — Sonnet lead + Haiku tester (first in the queue)
One Node MCP server in ~/dev/control-room/hive-mcp/ (stdio, zero dependencies beyond what claude-code-bridge already uses). Tools, each taking `role`: hive_read(since), hive_post(text), claim_files(files), set_status(fix, state), run_tests(files), write_file(path, content) that refuses paths outside the role's file list (from a roles.json built from this file), liquipedia(page) using the index.php?title=<Page>&action=raw form, run_match(seed, bots), simulate_mining(seed, crumbs, minutes). Tests in hive-mcp/test/. Register it in ~/.claude.json only by printing the exact `claude mcp add` command for Joshua; do not edit his config. Then write ~/dev/rts/.claude/agents/<role>.md for each card above (name, description, model, tools). Done when: the tests pass and one Haiku session using it posts to the hive and is refused a write outside its files.

## 0b. toaster-hive remote door for ChatGPT — Sonnet lead (after 0 posts DONE)
Joshua (14:35): ChatGPT chat sessions should run sims and write code through a bridge. ChatGPT can only reach remote MCP servers over HTTPS, so:
1. Add a streamable-HTTP transport to the toaster-hive server (same tools), listening on 127.0.0.1 only, behind a bearer token stored in ~/.toaster-hive/token (generated once, never printed in chat or logs).
2. A `gpt` role whose files are a separate git worktree, ~/dev/rts-gpt (create with `git worktree add ../rts-gpt -b gpt/sandbox` from ~/dev/rts). Each ChatGPT session gets its own subfolder session id for scratch output. No arbitrary shell: tools only — read_file, write_file (worktree only), run_tests(files), run_match(seed, bots), simulate_mining, run_league(short), git_diff, hive_read, hive_post (posts as team gpt). Rate limit: one sim at a time, 5 minutes cap.
3. Exposure: write bin/hive-tunnel.sh that runs `cloudflared tunnel --url http://127.0.0.1:<port>` and prints the public URL; do NOT install cloudflared or start the tunnel — Joshua runs it. Write docs/HIVE-REMOTE.md: how to start it, the URL + token to paste into ChatGPT (Settings, Connectors, add a custom MCP connector), how to stop it, and the risks.
4. Merging: GPT's work stays on branch gpt/sandbox; a Claude reviewer reads its diff before anything moves to the main tree.
Tests: the HTTP transport refuses requests without the token; write_file refuses paths outside ~/dev/rts-gpt; run_match times out at 5 minutes.
