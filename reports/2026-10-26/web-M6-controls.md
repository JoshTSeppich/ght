# M6 Controls and selection: web + code check (haiku, 2026-10-26)

Sources. Liquipedia's plain `/starcraft2/Hotkeys` page returns 403. The raw wikitext URL works and was used: https://liquipedia.net/starcraft2/index.php?title=Hotkeys&action=raw (per the HIVE tip). Blizzard guides also fetched: https://news.blizzard.com/en-us/article/6640645/game-guide-simplified-controls and https://news.blizzard.com/en-us/article/4552955/game-guide-special-control.
Liquipedia documents the classic layout only. Nothing I fetched describes the Grid layout, so Grid entries are UNVERIFIED.
Code read: play/input.mjs, play/app.mjs, play/camera.mjs, play/command-card.mjs, play/toaster-play.mjs, play/station-controls.mjs, play/index.html.

## Selection
| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Ctrl+click selects all units of a type | MISSING | Blizzard and Liquipedia both say Ctrl+click works. clickSelect (input.mjs:220) takes no ctrl flag; app.mjs:489 passes only shift. |
| 2 | Double-click selects all of a type on screen | CORRECT | Blizzard: "Select all units of that type in the game view." input.mjs:222-228 does this on screen, capped at 12. |
| 3 | Shift-click adds or removes one unit | CORRECT | Blizzard. input.mjs:230-234. |
| 4 | Box select (drag, 5 px threshold) | CORRECT (basic) | Blizzard. app.mjs:485-493, input.mjs:238. |
| 5 | Box select can take buildings | MISSING | boxEntities (input.mjs:90) keeps only units. A box over only a building clears the selection (input.mjs:240). Source not checked. |
| 6 | Box select priority (army over Crumbs) | UNVERIFIED | Not in the fetched sources. Code sorts by id only (input.mjs:99), so no priority. |
| 7 | Selection cap of 12 | UNVERIFIED | Neither source states a cap. Code: MAX_SELECT = 12 (input.mjs:26). |
| 8 | F2 selects the whole army | PARTLY | Liquipedia: "F2: Selects the entire army." Code (input.mjs:526) selects fighters, capped at 12, with a toast on overflow (input.mjs:482). The cap makes it differ from "entire". |
| 9 | F3 selects Crumbs | UNVERIFIED | Neither source states F3. Code: input.mjs:527. |
| 10 | F1 selects idle Crumbs; second press centres | CORRECT | Blizzard: F1 selects idle worker, and F1 again centres. app.mjs:525 and 273-278. |
| 11 | Portrait click selects one unit | PARTLY | app.mjs:572 works. Shift-click and Ctrl-click on portraits do nothing. |

## Control groups
| # | Item | Verdict | Evidence |
|---|---|---|---|
| 12 | Ctrl+1-0 set, Shift+1-0 add, 1-0 recall | CORRECT | Blizzard: Ctrl+number assigns, Shift+number adds, number selects. input.mjs:520-525. Key 0 works (regex `[0-9]`). |
| 13 | Two quick presses centre on the group | CORRECT | Blizzard: "Two rapid presses center view." input.mjs:252-256, DOUBLE_MS 400. |
| 14 | Alt+number moves units out of other groups ("steal") | MISSING | Liquipedia (LotV): "Alt+# creates a group and removes those units from other groups." Code: setGroup (input.mjs:245) never removes ids from other groups, and app.mjs:530 returns on altKey before input.key runs. A unit can sit in two groups. |
| 15 | Empty group recall | CORRECT | input.mjs:246-250 drops dead ids and returns null. Shift+empty toasts "Group n is empty" (input.mjs:264). |
| 16 | Ctrl+0 is safe | LIKELY BUG | app.mjs:533 preventDefaults only `[1-9]`, not 0. Ctrl+0 would also reset browser zoom. Browser behaviour not tested here. |
| 17 | Ctrl or Cmd+digit | UNVERIFIED | app.mjs:531 treats metaKey as Ctrl. Cmd+1-9 switches tabs in Chrome and Safari on Mac, and preventDefault may not stop that. |

## Camera
| # | Item | Verdict | Evidence |
|---|---|---|---|
| 18 | Ctrl+F5-F8 save, F5-F8 recall | MISSING | Liquipedia: "F5–F8 recall locations. Ctrl+F5–F8 saves them." camera.mjs:80-104 has cameraKeyAction and createCameraMarks, and tests/input-camera-marks.test.mjs pins them. grep: nothing in play/ imports them. app.mjs:517 handles F5-F8 only in sandbox. Outside a sandbox F5 falls through with no preventDefault, so the browser reloads the page and the match is lost. |
| 19 | Space jumps to the last alert | PARTLY | Liquipedia: Space focuses the last event, and repeated presses cycle recent events. input.mjs:530 jumps to the one alert; there is no cycling. |
| 20 | Backspace cycles bases | CORRECT | Liquipedia: "focuses the camera on your town structure" and cycles. input.mjs:487-496 does Power Strip, then each Toaster. |
| 21 | Arrow keys scroll | CORRECT | Blizzard. app.mjs:502, camera.mjs:44-54. |
| 22 | Middle-drag pans | CORRECT | Blizzard: "Hold down to scroll map with mouse." input.mjs:730 and 746. |
| 23 | Edge scroll | UNVERIFIED | Neither source covers it. camera.mjs:5 uses a 16 px band. Leaving the window stops it (input.mjs:753-754). |
| 24 | Wheel zoom | CORRECT (wheel) | Liquipedia: the wheel changes view height. app.mjs:496. |
| 25 | Page Up / Page Down adjust view | MISSING | Liquipedia lists them. Code has only wheel and +/- (app.mjs:528-529). |

## Keys that do two things, and key collisions
| # | Item | Verdict | Evidence |
|---|---|---|---|
| 26 | Tab cycles unit types in a selection | BUG (unreachable) | app.mjs:526: Tab toggles Inspect power and returns before input.key runs. cycleTypes (input.mjs:499-510) never fires in Toaster Wars. Blizzard describes Tab as cycling subgroups; the cycling here is the same idea. |
| 27 | P is Patrol in the classic profile | BUG | app.mjs:507 handles 'p' as Pause and returns before input.key. The classic profile maps patrol to 'p' (toaster-play.mjs:88) and the Driftfall legacy page does too (input.mjs:32). Patrol is reachable only by clicking the button. Liquipedia: P = Patrol, and P = Pause in the main menu. |
| 28 | Modifiers ignored on letter hotkeys | BUG (by reading) | input.mjs:516-535 and app.mjs:530-533 fire card hotkeys on Ctrl or Cmd+letter. Ctrl+W (grid Stop) would order a Stop and block nothing. Ctrl+T arms attack-move. Ctrl+R (patrol, preventDefault) blocks reload. Browser behaviour not tested here. |
| 29 | Grid card keys unique within one card | CORRECT | Crumb card keys (toaster-play.mjs:83) are unique. Shared letters across cards (a, s, d, f, r) are by design. |
| 30 | Power Station keys match on classic | CORRECT | station-controls.mjs:9 (x, v, n, d) matches the classic table (toaster-play.mjs:90). The grid table overrides it (z, x, c, v). |
| 31 | Grid layout Q W E R T / A S D F G / Z X C V B | UNVERIFIED | Neither source covers it. |
| 32 | Classic move/stop/hold/patrol/attack = M, S, H, P, A | CORRECT as spec | Matches Liquipedia's defaults. Patrol is blocked by item 27. |
| 33 | Escape cancels an armed mode | CORRECT | input.mjs:519. |

## Mouse and card
| # | Item | Verdict | Evidence |
|---|---|---|---|
| 34 | Right-click smart command | CORRECT (basic) | Enemy: attack. Crystal: gather for Crumbs. Ground: move. input.mjs:287-307. |
| 35 | Right-click on a friendly unit follows it | MISSING | input.mjs:305 issues a move. Source not checked. |
| 36 | Shift-right-click queues | CORRECT for units | input.mjs:274-283. Rally points are single, not queued (input.mjs:314). |
| 37 | Minimap left click and drag centre the camera | CORRECT | app.mjs:547-557. |
| 38 | Minimap right-click gives a command | PARTLY | app.mjs:553 does not pass shift, so Shift+minimap-right-click does not queue. It also does not cancel an armed mode (only the overlay does, app.mjs:458). |
| 39 | Left-click on the minimap while attack-move is armed | MISSING | The minimap ignores ui.mode (app.mjs:547-554). Attack-move stays armed and only pans. |
| 40 | Right-click cancels an armed mode | UNVERIFIED | app.mjs:458. Neither source covers it. |
| 41 | Command card: 5x3 grid, costs, locks, tooltips | CORRECT (code) | command-card.mjs:12-67. |

## Association with the report and the code
- The only sources that cover controls are Liquipedia (classic) and Blizzard. The Grid layout has no source, so all Grid letters are unverified.
- Item 27 and item 26 share one cause: app.mjs handles keys before input.key, and some handlers return early. The fix belongs in the page, not the card.
- Item 14 (steal) is the one real SC2 mechanic with no code. The report should not claim control groups are complete until Alt+number is implemented.
- Item 18 is the most damaging: F5 reloads a live match outside sandbox mode. A one-line preventDefault plus wiring cameraKeyAction would fix both halves.

## Not checked
- Browser behaviour for Ctrl, Cmd and Alt combinations (items 16, 17, 28). Needs a real browser, which the headless rules forbid.
- Shift-queue cap for units (Blizzard says queued commands are limited; the code has no unit cap).
