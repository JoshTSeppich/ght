# Verify E: docs and in-game text vs the code

Scope: TECH-TREE.md, SYSTEMS-DESIGN.md, ECONOMY.md, and the player-facing strings in play/. Read-only. Nothing in the repo was edited.
Commands run (all read-only): `node scripts/tech-tree-doc.mjs --check` (prints "TECH-TREE.md is up to date"), `node scripts/economy-doc.mjs --check` (prints "ECONOMY.md is up to date"), and one-line `node -e` reads of env/stats.mjs and env/economy-table.mjs values.
Profile note: "grid" is the /play default (play/toaster-play.mjs HOTKEY_PROFILES.grid); "classic" is `?keys=classic`.

## 1. TECH-TREE.md tiers: CONFIRMED (old tiers), gate detail below
- TECH-TREE.md:37 "Needs Hold 3 ... Foundry or Sanctum"; :54 "Needs Hold 6 ... Hangar". Those are the GHT rules in env/stats.mjs:232-244 (`tiers`). The generator reads `STATS.tiers` (scripts/tech-tree-doc.mjs tierSection).
- The GHT tiers (env/stats.mjs:251-255, `toasterTiers`: Kitchen = one complete Toaster, Powered = a Windmill or Dam) appear nowhere in TECH-TREE.md.
- Research lines (TECH-TREE.md:20, 39, 56: "Ground Weapons 1" ...) describe a system /play turns off: play/toaster-play.mjs:47-50 `switchOffGht` deletes `state.research` and sets `state.noTiers`.
- Gate, which exists only in the UI: env/tiers.mjs:72-76 `kitchenLockReason` is called only from play/input.mjs:195 (the card's lockReason). Greyed and clickable, with a reason line (play/command-card.mjs:62, :40-44).
- Gate in the sim: NOT enforced. env/sim-territory.mjs:199 and :207 call `tierReason`, which returns null when `state.noTiers` is set (env/tiers.mjs:46). `stepTiers` only runs under `if (state.research)` (env/sim-territory.mjs:248), so it never runs in /play. Nothing else in env/ calls `kitchenLockReason`. Reading the code: a train or build command for a Four-Slice (brute) with no Windmill is accepted by the sim. A runtime test was not run; the test that would settle it is a sim-level `train` of `brute` with no Windmill.
- Panel: the Hold readout is blank in /play (play/toaster-play.mjs:130 `if (!state.drift && !state.research) return ''`).
- VERDICT: CONFIRMED. The new tier gate works only as a button lock (play/input.mjs:195). The sim does not refuse.

## 2. TECH-TREE.md bread chain: PARTLY (stale)
- TECH-TREE.md:13 "Pantry: holds at most 6 flour and 6 water per side". The generator reads `E.bakery.pantryCap` (economy-table.mjs:15 = 6). The real cap is 6 + 3 per complete Toaster: env/bakery.mjs:37-38 and :77-79 `pantryCapOf`. play/hud-tips.mjs:55-56 and play/hud-bar.mjs:98-99 already say so.
- TECH-TREE.md:9 "draws 1 water every 6 s" is the one-Well base only. env/bakery.mjs:82-103 adds the crowd rule (R = 8, base / (1 + sum)). Spring 12 s is right (`wellSeconds * springEvery`).
- "within 4 tiles of water": CONFIRMED (bakery.mjs:39 wellReach 4).
- Fix belongs in the generator (scripts/tech-tree-doc.mjs), not TECH-TREE.md by hand.

## 3. TECH-TREE "Hotkeys used twice": WRONG as a claim about the generator
- The generator reports no problems. `--check` passes ("up to date"). `renderTechTreeDoc` lists every key that more than one kind uses in the GRID table, with no card awareness (scripts/tech-tree-doc.mjs `clashes`). So the list is by-design cross-card reuse presented under a "used twice" heading (TECH-TREE.md:65-72).
- Same-card collisions: none found by reading the card builder (play/input.mjs:398-435). Worker card: mill a, well s, toaster d, forge f, turret g, extension z, pylon x, windmill c, dam v, gather b; Strip: worker a, rally s, pilot d; Assembly Line: grunt a, lancer s, spiker d, brute f, howler g, dart z, lineRally x; Mill/Well/Toaster: rings a, pause s; Box/Pylon: fence a, unplug s; fighters: resupply a or roll a (mutually exclusive by `units.some(dart)`), shove s.
- Not proven: the card builder was not called on live selections. The "never used twice" invariant (play/toaster-play.mjs:76) has no test that enforces it (grep for the phrase finds only the comment).

## 4. SYSTEMS-DESIGN.md, item by item
| Item | Verdict | Evidence |
|---|---|---|
| 1 Wells: R = 8 crowding formula | LANDED | env/bakery.mjs:86-103 (wellCrowdRadius 8, `base / (1 + sum)`) |
| 1 Wells: 6-tile enemy rule | LANDED | env/bakery.mjs:109-112 wellPlaceReason; env/commands.mjs:89 rejects; tests/bakery-wells.test.mjs:245-248 |
| 1 Wells: s.crowd, s.rateTicks, s.ratePerMin, observeBakery wells[] | LANDED | env/bakery.mjs:98-103, :193 |
| 1/W2 Ghost wording | PARTLY | play/placement-ghost.mjs:39-47 gives "dry: no water in reach" and "shared with N Wells: 1 / N s". Spec wording ("10 Water / min", "5.7 / min", "too close to an enemy building") is absent. The ghost never calls wellPlaceReason (no hit in play/), so it can show green on a refused site. |
| 1 Refusal text for enemy rule | NOT LANDED (as text) | placement-ghost.mjs:77-86 `reasonText` maps no 'too-close-enemy', so the player sees the raw token capitalised: "Too-close-enemy" |
| 2 Pantry growth (6 + 3 per Toaster) | LANDED | env/bakery.mjs:37-38, :77-79, :145 |
| 2 Tiers table (Strip / Kitchen / Powered) | LANDED (data) | env/stats.mjs:251-255; env/tiers.mjs:49-76 |
| 2 Tiers enforced | PARTLY | UI only: play/input.mjs:195. Sim: env/sim-territory.mjs:199-207 via noTiers |
| 2 Greyed buttons, key kept, reason tooltip | LANDED | play/command-card.mjs:40-44, :62; play/input.mjs:437 |
| 2 Cost and build time on hover | UNVERIFIED | tooltip builder checked for "Needs" only |
| 2 First-slice and first-Windmill toasts | LANDED | play/input.mjs:23-24 (texts), :547-549 (fire) |
| 2 Kitchen panel, K/Esc, auto-open at first Mill | LANDED | play/kitchen-panel.mjs:5, :148-150; play/app.mjs:249, :527 |
| 2 TECH-TREE generated with --check | PARTLY | --check runs and passes; content is the old tiers (see 1) |
| 4 Grid card 5x3, row 1 on every card | LANDED | play/input.mjs:400 ROW1; play/toaster-play.mjs:79 HOTKEY_PROFILES.grid |
| 4 Classic profile letters | LANDED | play/toaster-play.mjs:79-95 classic block (I W T F L X V N D; C O Z L B K E) |
| 4 1-0 groups (Ctrl set, Shift add) | LANDED | play/input.mjs:512-521 |
| 4 F1 idle Crumb | LANDED | play/app.mjs:525 |
| 4 F2 army, F3 all Crumbs | LANDED | play/input.mjs:526-527 |
| 4 Backspace cycle Strip then Toasters | LANDED | play/input.mjs:486-528 |
| 4 Tab cycle types in selection | NOT LANDED in /play | play/app.mjs:526 takes Tab for "Inspect power" whenever `toaster.on`, returning before input.key (app.mjs:531). input.mjs:529 cycleTypes is unreachable on the page. |
| 4 Shift queue, Space last alert, K, Esc | LANDED | play/input.mjs:11; play/app.mjs:749; app.mjs:527 |
| 4 Alt (hold) shows all Well rings and cord reaches | NOT LANDED | play/app.mjs:530 `if (e.altKey) return;` is the only Alt code. input.mjs:432 greys Rings: "no toggle yet". |
| 4 Backtick mute, U freed | PARTLY | Backtick: LANDED (play/app.mjs:504; play/input.mjs:29; input.test.mjs:138). U is freed only in grid. In classic, `unplug: 'u'` (toaster-play.mjs classic block), so U unplugs. |
| 4 F5-F8 camera recall; Ctrl+F5-F8 save | NOT LANDED | play/camera.mjs:80-88 has `cameraKeyAction`, but play/app.mjs imports only CAMERA and createCameraRig (app.mjs:20). Nothing in app uses CAMERA_KEYS. |
| 4 Sandbox cheats move to Shift+F5-F8 | NOT LANDED | play/app.mjs:517 `if (sandbox && /^F[5-8]$/` runs the cheat on bare F5-F8 with no shift check |
| 3 TR1 high ground: sight +2, reach +1 | LANDED (rules) | env/vision.mjs:14, :41; env/combat.mjs:10, :51. Cue (rim, up-arrow) and ramp test: UNVERIFIED |
| 3 TR2 cords and water | PARTLY | Water blocks ground lines (env/power.mjs:461-462 lineOfSight). Pylon-ended lines never block (power.mjs:410, :480). No "bank tile" rule anywhere (grep for bank in env/power.mjs: none). Fords come from pushed rocks (env/rocks.mjs:9-10), not map 'f' tiles. |
| E2 Spread auto-gather | PARTLY | play/idle-crumbs.mjs:2-5, :12 (nearest wheat in cord reach, 3 s idle). No free-slot check. The "6 of 6 working" label exists nowhere in code (repo-wide grep hits only docs and TEST-PLAN). |

SYSTEMS-DESIGN.md also has no section 5 (goes 4 to 6). Cosmetic.

## 5. Sound control "(U)": CONFIRMED stale
- play/toaster-sounds.mjs:152 paints `'Muted (U)'` / `'Sound (U)'`.
- Real key: `MUTE_KEY = '`'` (play/input.mjs:29), handled at play/app.mjs:504. The toast on that same key says "Sound off (`)" (app.mjs:505).
- In classic, U is Unplug (toaster-play.mjs classic block). The label sends players to the wrong key.

## 6. ECONOMY.md: CONFIRMED
- `node scripts/economy-doc.mjs --check`: "ECONOMY.md is up to date".
- Hand spot checks against raw sources:
  1. Crumb 50 Wheat, 40 hp, 1.67 s train: ECONOMY gives 1.67; the GHT overlay is trainTicks 40 = 1.67 s at 24 tps (env/stats.mjs:169). The raw classic value is 20 ticks (stats.mjs:152), which the doc correctly does not use.
  2. Toaster 100 Wheat, 250 hp, 2.5 s build: buildTicks 60 / 24 = 2.5 (stats.mjs toaster row).
  3. Power Strip 2400 hp: env/stats.mjs:167 coreHp 2400.
  4. Field tile 1800 Wheat: env/map.mjs:12 WHEAT_AMOUNT = 1800.
  5. Windmill 40 Wheat / makes 3; Dam 90 / 6; Mill Dam 160 / 14: env/economy-table.mjs:33, :36.
  Also checked: Crumb cord 12, Four-Slice 9 (economy-table.mjs:26); mine 8.33 s (stats.mjs:286 mineTicks 200 / 24); carry 5 (stats.mjs:286); Crumb carries 2 slots and Strip reserve 2 (env/ammo.mjs:37-38); unit cap 40, queue 5 (stats.mjs:98-99).
- Not checked: the brown-out order (fences first, then newest Toaster) in env/energy.mjs.

## Associations: strings that state a rule the grid default does not follow
All of these use classic letters, so they are right under `?keys=classic` and wrong on the default page.
- play/tutorial.mjs:10 "Place two Extension Boxes (X)": grid extension is Z (toaster-play.mjs grid block), X is Relay Pylon. WRONG.
- play/tutorial.mjs:11 "attack-move (A)": grid attack-move is T (row 1). Pressing A on a Popper gives Resupply, which says "coming". This is the OBJECTIVE step. WRONG.
- play/teach.mjs:99 "press A, then click the enemy base to attack": same error. WRONG.
- play/teach.mjs:18 and play/hud-tips.mjs:58 "press F to fence the line": grid fence is A on the Box/Pylon card (input.mjs:434-435); F is Assembly Line. WRONG.
- play/station-controls.mjs:50 "then press F": WRONG for the same reason.
- play/hud-bar.mjs:69 "Windmills (N) and Dams (D)": grid is C and V. WRONG.
- play/toaster-sounds.mjs:152 "(U)": see section 5. WRONG.
- play/tutorial.mjs:9 "Train Poppers at the Assembly Line (F)": grid F is Assembly Line. CORRECT.
- play/index.html header (lines 6-9): grid keys, ` mute, Ctrl+1..9, 1..9, Space, P, Esc. CORRECT. It omits F-keys, Backspace, Tab; it does not state a false rule.
- TECH-TREE.md:37, :54 "Foundry or Sanctum" and "Hangar": these do not apply to /play (see section 1).
- toaster-play.mjs:76 "Within one card a key is never used twice": an invariant with no enforcing test.

## MISSED: the text most likely to mislead a player or builder today
1. The tutorial objective (play/tutorial.mjs:11) and teach (teach.mjs:99) both say "attack-move (A)" / "press A". On the default grid, A is Resupply, which is a dead button. A new player is told to press a key that does nothing and concludes that attacking is broken. The same applies to "Extension Boxes (X)" (X is Relay Pylon on grid).
2. "(U)" on the Sound control (toaster-sounds.mjs:152). In classic, U is Unplug, so a player who obeys the label takes a station off the cord.
3. TECH-TREE.md (the builder's spec sheet): it tells builders that Tier 2 needs Hold 3 plus a Foundry or Sanctum, and Tier 3 needs Hold 6 plus a Hangar. The shipped kitchen gate is a Toaster and a Windmill or Dam, and the sim does not enforce either. A builder reading the doc will build a gate that does not exist.
4. Enemy-Well refusal reads "Too-close-enemy" (placement-ghost.mjs:77-86 has no mapping). The ghost shows the spot as OK.

## Recommended fixes (not applied; read-only task)
- Generator (scripts/tech-tree-doc.mjs): read `toasterTiers`, not `STATS.tiers`; add the pantry +3-per-Toaster and the crowd line; report same-card collisions instead of cross-card reuse.
- Strings: replace the classic letters in tutorial.mjs, teach.mjs, hud-tips.mjs, hud-bar.mjs and station-controls.mjs with keys from `input.hotkeys` (so they follow the profile). Change toaster-sounds.mjs:152 to the backtick.
- Add `'too-close-enemy'` to reasonText.
- Decide and document in SYSTEMS-DESIGN.md: Alt rings, Tab, camera recall/save, Shift+F5-F8 cheats, and TR2 bank tiles are NOT LANDED. Mark them as such.
