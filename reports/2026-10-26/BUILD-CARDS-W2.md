# Build wave 2 — GHT to modern standards (2026-10-26)

Read first: reports/2026-10-26/DECISIONS.md (Joshua's five decisions), then RESOURCE-FLOW.md, then your card. Evidence for every gap is in "What's Missing (verified)" and reports/2026-10-26/verify-*.md and web-*.md.

## Standing rules (everyone)
- Own only the files your card lists. Tests first. Never loosen, skip or delete a test. No git commit/push/checkout, no rm, no npm install. One plain command per Bash call.
- Chat lives in the repo root: `node read.mjs --since N` and `node say.mjs <haiku|sonnet> "text"` (under 700 chars). Post PLAN, REVIEW? (files changed + test names), then DONE or BLOCKED in plain words of what Joshua will SEE on /play.
- On the MacBook Air: work in ~/dev/rts-live. Chat posts go in `outbox.jsonl` (one JSON line `{"from":"haiku","text":"..."}`); the lane relays them and refreshes channel.jsonl every 2 minutes. Touch only your card's files: they are copied back to the Mac mini when you post DONE.
- The Mac mini's disk is tight. Write no large files there.

## Shared contracts (so cards can run in parallel)
- Unit rows in env/stats.mjs gain: `armor` (number), `tags` (from Light, Armored, Bread, Mechanical, Structure, Air), `bonus` ({ tag: extraDamage }), `layer` ("ground" | "air"), `hits` ({ ground: bool, air: bool }), `minRange` (default 0).
- env/research.mjs (Research Engineer creates it FIRST, as a stub, within 10 minutes) exports `upgradeLevel(state, player, track) -> 0..3`. Tracks: `ground-weapons`, `ground-armor`, `air-weapons`, `air-armor`, `structure-armor`. Combat imports it; until it lands, combat treats every level as 0.
- Damage per hit = `max(0.5, base + bonus[tag] + level*attackStep - (armor + armorLevel))`; splash neighbours take half of base (no building multiplier).
- env/stats.mjs is edited in this order: Combat Scale (unit rows), then Air Layer (new air rows), then Research (research rows block). Post in chat before and after touching it.

---

## M1. Green build lead — 1 Sonnet (Mac mini, FIRST)
Make `npm test` green before anyone else lands big changes. Existing card: swarms/green-wave-1.mjs. Post the final pass/fail counts. Every other mini card waits for this DONE or 30 minutes.

## M2. Combat Scale Engineer — Sonnet lead + Haiku tester (Mac mini)
Mission: fights read like StarCraft II. Upgrades, armor and counters all matter.
1. Rescale every unit row (Crumb, Popper, Zapper, Four-Slice, Broiler, Flak Popper, Bagel) to about 3x HP. Add armor 0-2, tags, bonus damage and attackStep. Give each unit a job:
   - Popper is the generalist.
   - Zapper is anti-Light.
   - Four-Slice is anti-Armored and anti-Structure (it keeps x2 vs structures).
   - Broiler is siege, with splash and minRange 2.
   - Flak Popper is anti-air, with weak ground damage.
   - Bagel is a fast melee raider vs Light.
2. env/combat.mjs reads armor, tags, bonus, minRange, `hits.air`/`hits.ground` and upgradeLevel().
3. Buildings get armor 1 and the Structure tag. The Heat Lamp becomes the static defense AND the detector: it needs power and toast, and has the hits it needs.
4. Ranks and items count in player fights, not only against camps.
Tests first: tests/combat-armor.test.mjs, combat-bonus-tags, combat-minrange, combat-upgrade-hook (a stubbed level 1 changes hits-to-kill), combat-hits-layer.
Owns: env/combat.mjs, the unit rows of env/stats.mjs, env/items.mjs (player-fight hook).
Done when: Popper vs Popper takes 8-12 hits; each unit beats the unit it counters in an even-cost sandbox fight (scripts/sandbox.mjs from the Balance toolsmith).

## M3. Research and Upgrades Engineer — Sonnet lead + Haiku tester (Mac mini)
Mission: the player can buy upgrades and research on /play, paid in Wheat + Flour, and the simulation enforces the tree.
1. Create env/research.mjs (stub first, see contracts). Then add research queues on buildings: weapons and armor tracks 1-3 per layer, at the Assembly Line (ground) and the new air building (air), with level 2 needing tier 2 and level 3 needing tier 3. Add 4-6 unit researches that give the dead-end units a reason (for example Popper range +1, Bagel charge, Broiler shell radius, Flak Popper range vs air).
2. Stop play/toaster-play.mjs deleting state.research, and wire play/research-card.mjs into the command card.
3. Costs are Wheat + Flour (decision 2). Tier-2 and tier-3 units and buildings get a Flour cost too.
4. The simulation enforces tiers: env/sim-territory.mjs and env/commands.mjs refuse out-of-tier train, build and research orders with a reason code the HUD can show.
Tests first: tests/research-buy.test.mjs, research-tier-gate, research-flour-cost, tier-sim-enforce (a scripted client can't skip a tier).
Owns: env/research.mjs, env/tiers.mjs, the research rows of env/stats.mjs, the research switch in play/toaster-play.mjs, play/research-card.mjs, the tier checks in env/sim-territory.mjs and env/commands.mjs (after Construction, see order).
Done when: on /play, Joshua researches Ground Weapons 1 and sees Poppers kill faster.

## M4. Air Layer Engineer — Sonnet lead + Haiku tester (Mac mini)
Mission: a working flying layer at tier 3.
1. `layer: "air"` units move in a straight line over all terrain, with their own separation. Ground pathing ignores them. Vision is the same.
2. New tier-3 building: the Cooling Rack (the air factory; needs Windmill or Dam).
3. Three flyers:
   - Crouton Kite: cheap scout, no attack.
   - Waffle Wing: air-to-air fighter.
   - Crumpet Bomber: air-to-ground, slow, splash, 1 slice per shot.
   Rows follow the contracts. Flyers draw ammo the same way. They are resupplied only at a Toaster or a Cooling Rack (no Crumb runs in the air).
4. Targeting respects `hits`: Poppers can hit air, Zappers, Four-Slices and Broilers can't, and the Flak Popper and Heat Lamp can.
Start with env/movement.mjs and a new env/air.mjs. Add rows to env/stats.mjs and touch env/combat.mjs only after Combat Scale posts REVIEW?.
Tests first: tests/air-move-over-cliffs, air-targeting-hits, cooling-rack-tier3, air-ammo-resupply.
Owns: env/air.mjs, the air branch of env/movement.mjs, the air rows of env/stats.mjs, the Cooling Rack in env/commands.mjs build table (after Research).
Done when: on /play Joshua builds a Cooling Rack, flies Waffle Wings over a cliff, and Flak Poppers shoot them down.

## M5. Win Rule Engineer — 1 Haiku (Mac mini)
1. Win = every enemy building destroyed (decision 4). Remove the 15:00 default. Add a 60:00 safety cap that ends as a draw. Keep the stalemate rule.
2. Scores and tie-breaks never count building cost. This closes the Heat Lamp exploit; write a test that replays the GPT exploiter (players/gpt-exploiter-6) and shows it no longer wins.
3. Results text for every end reason.
Owns: the end block of env/sim.mjs, env/referee.mjs, the match block of env/stats.mjs, play/results-card.mjs.
Done when: the exploiter test passes and a bot match ends on a kill.

## M6. Controls finisher — 1 Haiku (Mac mini)
Finish the BLOCKED items from wave 1 (the F2 cap test, HUD 1-3 input lines). Then add:
- Alt+number steals units into a new group.
- Ctrl+click selects every unit of that type.
- Ctrl+F1 selects all idle Crumbs.
- Page Up and Page Down move the view.
- Right-click a friendly unit to follow it.
- Attack-move and Shift-queue work on the minimap.
- Air units can be selected and given orders.
Owns: play/input.mjs, the key handling in play/app.mjs, play/camera.mjs.

## M7. HUD and Alerts finisher — 1 Haiku (Mac mini, after M6 touches input.mjs)
- Space cycles through earlier alerts.
- Power-out and toast-out get text alerts.
- Every refused reason code (research, tier, Flour) shows on screen.
- The idle-worker button shows its key.
- A research progress readout and an upgrade-level badge on unit cards.
Owns: play/hud*.mjs, the alerts in play/teach.mjs, play/toaster-sounds.mjs.

## M8. Construction — 1 Haiku (Mac mini)
- Cancelling a building under construction refunds 75%.
- Crumbs repair (the Repair button and key).
- The placement ghost turns red wherever the simulation would refuse.
Owns: play/placement-ghost.mjs, the cancel/repair orders in env/commands.mjs and env/economy.mjs.

## M9. Hive tester fix — 1 Haiku (Mac mini, control-room)
Make control-room/hive-mcp/test/tools.test.mjs agree with roles.json, so `node --test test/` is green. Then post DONE for card 0.

## M10. QA Lead — 1 Haiku (Mac mini, last)
Re-check each DONE in wave 2: that area's tests, the full suite, and one look at /play in a real browser (Playwright screenshot).

## M11. Docs — 1 Haiku (Mac mini, last)
Regenerate TECH-TREE.md from the code (scripts/tech-tree-doc.mjs), including research, Flour costs and the air layer.

## Air lane (MacBook Air, ~/dev/rts-live)

## A1. Map and Expansion Designer — Sonnet lead + Haiku (Air)
1. A new ladder-size map (about 132 by 148): each side gets a main, a natural within 25 tiles (reachable by cord) and a third.
2. Rush is about 35-45 s of Popper walking.
3. Use the 8 generator sockets. Add 2 watchtowers. Golden fields sit behind rocks you have to clear.
4. Add the second-base building (the Outlet).
Owns: maps/* (new maps/layout-ladder.mjs and maps/LADDER.md), env/map.mjs, the pads in env/energy.mjs, and the Outlet in env/power.mjs. Coordinate the Outlet in chat: power.mjs is shared.
Done when: scripts can start a match on the new map and both bots expand to their natural.

## A2. AI Engineer — Sonnet lead + Haiku (Air)
Bots use everything:
- all units, including air
- research and upgrades
- the bakery
- scouting
- harassment
- expanding to the natural
- four levels: Easy, Normal, Hard, Brutal
Toaster-hard must beat the GPT exploiter under the new win rule.
Owns: players/toaster-*, scripts/league.mjs. Run leagues here; the Air has the CPU and the disk.

## A3. Balance Analyst — 1 Sonnet (Air, after M2 and M3 post REVIEW?)
1. scripts/breakpoints.mjs prints hits-to-kill for every pair at upgrade levels 0-3.
2. Run a 40-match league and write reports/2026-10-26/balance-w2.md.
3. Propose number changes in chat. The Combat lead applies them; the Analyst edits no unit rows.

## A4. Art and Audio — 1 Haiku (Air)
- Sprites for the Cooling Rack, the 3 flyers (with shadows, so air reads as air) and the research buildings' upgrade icons.
- Music on /play, with a mute key.
Owns: assets/generated/*, play/drawn-units.mjs, the music wiring in play/sound-player.mjs.

## A5. Start screen and Match Flow — 1 Haiku (Air)
1. play/start-screen.mjs: pick the map (including the new ladder map), side, difficulty and key profile.
2. The menu pauses the game. Speed control outside the sandbox.
3. Keep the last 10 replays.
Owns: play/start-screen.mjs, the menu and play-again code in play/app.mjs (after M6; coordinate in chat), replay storage.

## ChatGPT (Codex, Mac mini rotation)
Exploiters attack the NEW rules: after M5 lands, the rotation's EXPLOITER jobs must win by a different strategy each time (no Heat Lamp stockpile). REVIEW jobs second-opinion every wave-2 REVIEW?.
