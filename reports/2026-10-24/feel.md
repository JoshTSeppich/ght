# Toaster Wars feel report (reporter-feel, 2026-10-24)

**Verdict: the game works, but it does not yet feel like a finished RTS in the hands. It has no teacher on screen, an unreadable command card that hides the Windmill, no visible shots, and no sound or icon for hunger or no-power. The guide is built but not plugged in, and almost every polish item was shipped "not eyeballed in a browser".**

Evidence marks: VERIFIED = I ran it or cite file:line. UNVERIFIED = read from code or chat only; I have no browser here.
Chat times are UTC as logged in channel.jsonl. Joshua's local time is six hours earlier (the 22:27 local camera fix is #830 at 04:27Z).

## 1. Why the box-select caught 5 of 6 Crumbs

- A drag selects a unit only if its single projected centre point lies inside the rectangle (`play/input.mjs:71-80`, `boxEntities`). That point is the unit's tile position lifted 0.5 tile above the ground (`SHOW_H = 0.5`, `play/app.mjs:379,396`). VERIFIED.
- The drawn unit is bigger than that point, and the cord and wheels are not tested at all. A Crumb whose body is visibly inside the box can have its point just outside. The Crumb on the top or left edge of the group is the likely miss. UNVERIFIED which Crumb and by how many pixels.
- Single-click picking is more forgiving: 22-24 px radius (`input.mjs:58`, `app.mjs:480`). So a click works where a box does not.
- The drag rectangle drawn on screen uses the same pixels (`app.mjs:642-648`), so the box shown is the box tested.
- The 12-unit cap (`MAX_SELECT`, `input.mjs:21`) is not the cause with 6 units. When it is hit, the box drops units silently (PLAYTEST.md item 7, still open).
- Crumbs hop while walking (#819, 04:03Z); the hop moves the drawn body, not the tested point. UNVERIFIED as a contributor.

## 2. Feedback per action

| Action | Picture | Sound | Gap |
|---|---|---|---|
| Select | green ring and health bar (`app.mjs:604-612`) | `unit_select` blip from the file player (`feel.mjs:97`) | no unit voice. UNVERIFIED that the blip is audible |
| Move | ring ping at the target (`app.mjs:669-678`), waypoint lines | `unit_move_ack` blip plus Crumb chirp (`toaster-sounds.mjs:107`), from two systems | possible double sound. UNVERIFIED |
| Gather | Crumb carries a sack and hops (`bread-life.mjs`) | none for the human (`resource_collected` is in the manifest, not mapped) | no "+N wheat" and no delivery sound |
| Build | placement ghost, green or red with a reason (`placement-ghost.mjs`); a Crumb walks over | `building_placed` and `building_finished` from the file player, own side only (`feel.mjs:28-31`) | no construction progress shown. UNVERIFIED |
| Attack | white hit ring and small camera shake (`feel.mjs:84-95`), strike pose | `pop` per hit (`toaster-sounds.mjs:103`) | **no projectile is drawn on /play.** The slice arc and Hot Coil bolt exist only in the Studio (`play/style-lab/pop-shot.mjs`). VERIFIED by grep |
| Hungry | orange "Hungry" chip in the selection (`hud.mjs:96-98`), droopy eyes (`toaster-units.mjs:210-214`) | **none**: the `hungry` event is not handled in `cuesFor` | no icon above the unit; only visible when selected or zoomed in |
| Unpowered | cord and badge icons over Mill, Well, Toaster (`hud-badges.mjs`); Power chip red when short (#835, 04:58Z, not browser-checked) | **none** | no fighter-level cue that it cannot advance |
| Cord cut | cord drawn differently (UNVERIFIED) | `snap` (`toaster-sounds.mjs:109`) | no alert text for your own cut cord |
| Under attack | "Under attack (Space)" in the top bar for 6 s (`hud-bar.mjs:90,108`); minimap ping (#809, 04:00Z) | Strip alarm only when a Strip or core is hit (`toaster-sounds.mjs:105`) | any other hit is silent; the text never names what was hit |
| Command refused | toast (`input.mjs:389-392`) | none | only runs when `stations` is on; other rejects are UNVERIFIED |

Sound facts. Two audio systems run together: the file player from `assets/audio/MANIFEST.json` and the new synth. M mutes only when nothing is selected; otherwise M is Move (`app.mjs:494`). The sound panel is fixed bottom-right (`toaster-sounds.mjs:130`). All sound needs a first click or key.

## 3. The first three minutes (easy opponent, default query)

- The only instruction is a toast, "Select your Crumbs and right-click wheat...", for 3.2 s (`app.mjs:761,796`). VERIFIED. It matches Claude's note that nothing explained what to do first.
- Crumbs auto-gather at the start and 3 s after going idle (#777, 03:26Z). So wheat flows with no input. The risk is the player never learns they can give orders.
- The 5-step tutorial (`play/tutorial.mjs`, `play/tutorial-card.mjs`, 14 tests green) is **not wired in**: `grep tutorial play/app.mjs` returns 0. VERIFIED. Haiku asked sonnet for four lines at 04:00Z (#811). I found no AGREE or later wiring post in the chat.
- The easy bot builds a thing every 45 s and never touches the Strip before 10:00 (#788, 03:34Z). The normal bot pushes at 8.5 min (#837). So there is no pressure for the first 8 minutes or more. UNVERIFIED by play; read from chat.
- There is no objective line. VERIFIED: no "Win" text in `toaster-play.mjs`, `hud-bar.mjs`.
- Tooltips exist (`hud-tips.mjs`, toaster voice, with numbers) but only as the browser's native `title` attribute (`command-card.mjs:59`): about a second to appear, invisible in screenshots. `research/COPY.md` is not read by any code; `hud-tips.mjs` has its own text. VERIFIED by grep.
- The bread chain works once built (Mill → Flour 1, Well → Water 6, Toaster → Toast, #836 at 05:19Z), but nothing says the order. A Well by the home spring stayed dry for 60 s earlier (#834, 04:45Z); whether that is fixed is UNVERIFIED.

## 4. Hotkeys and the command card

- The Crumb card has 13 entries but the grid has 12 cells. **The Windmill (N) button is dropped.** VERIFIED: I ran `createInput` with the Toaster Wars options and `layoutCard`: 13 entries, 12 placed, Windmill absent. `layoutCard` (`command-card.mjs:23-35`) discards the overflow while its comment says "nothing is lost". The N key still works (`input.mjs:379-381`) but nobody can see it, and Windmills are the gate for a second Toaster (#827, 04:11Z).
- Buttons sit on cells that do not match their key: Hold (H) on the Q cell, Move (M) on E, Heat Lamp (L) on R, Mill (I) on Z, Toaster (T) on C. VERIFIED by the same run. This is what Claude saw in the pane. The classic grid teaches nothing.
- Hotkeys come from `TOASTER_HOTKEYS` (`toaster-play.mjs:78-81`): Mill I, Toaster T, Heat Lamp L, Well W, Dam D, Windmill N, Extension X, Pylon V, Assembly Line F. Units: Crumb C, Popper O, Zapper Z, Four-Slice F, Bagel E, Broiler B, Flak K. Mill I, Popper O, Bagel E and Flak K are odd mnemonics. F means Assembly Line on a Crumb, Four-Slice on the Line, and fence when a station is selected. T for Toaster clashes with no unit name. VERIFIED.
- Missing: no Patrol, no select-all-army key, no home key. F1 idle Crumb, Ctrl+1..9 and double-tap centre exist (`input.mjs:364-370`). The Mac Ctrl+digit risk is still open (PLAYTEST.md item 8). UNVERIFIED.

## 5. Camera

- Edge pan: 16 px band, speed scales with zoom (`camera.mjs:6,43`). Arrow keys. Middle-drag. Zoom 12-40 by wheel or +/- (`camera.mjs:6`, `app.mjs:490`).
- Claude's fix (#830, 04:27Z): leaving the window stops the pan, no push over buttons, pointer lock opt-in (`input.mjs:582-596`). VERIFIED in code and chat. Whether the drift is gone in a long session is UNVERIFIED.
- Minimap: click and drag recentre, right-click sends a command (`app.mjs:536-546`). Kitchen sites and pings are drawn (`minimap-kitchen.mjs`).
- Missing: follow-selected, a home key, pan acceleration. Space jumps to the last alert.

## 6. End card and restart

- The card shows Victory or Defeat, Winner, Time, Wheat gathered, Slices baked, Toasters lost, Restart, Watch replay, and "Enter restarts" (`results-card.mjs:30-41`). VERIFIED. Restart is a full page reload. The Menu overlay bug was fixed at 04:01Z (#811).
- Gaps: the reason says "A Power Strip fell" without saying whose. No next-step line. No "play again harder" button, though Opponent is in the Menu (`opponent.mjs`).

## 7. Animation: play page versus Studio

- On /play, VERIFIED by code: the Coil motion graph always runs for units (`toaster-units.mjs:187,236-240`: strike, hit flinch, knock-back, shatter, expressions), bread-life sacks, Mill sails, Well bucket, Toaster slices, toast stacks (#819), thick cords with a flash near the limit, hit ring, shake.
- `coilEnabled()` for `?motion=coil` is defined but nothing calls it (grep), so the flag is dead code.
- Studio only: the five-beat attack grammar with a visible slice arc, Hot Coil bolt, Quad Volley spread, Bread Shell lob, Crouton Flak, Bagel roll (COMBAT.md section 3, `style-lab/*`).
- `drift-banner.mjs` is reached only through `toasterPanel`, which returns nothing in Toaster Wars (`toaster-play.mjs:113`). Squad salute on select and the victory hop dance are UNVERIFIED on screen.

## RANKED: what is left

| # | What the player experiences now | What it should be | Where in code | Evidence | Size | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | Nothing says what to do; one 3 s toast | The 5-step tutorial card on screen, plus a one-line objective in the top bar | `app.mjs` (4 lines), `tutorial.mjs`, `tutorial-card.mjs`, `hud-bar.mjs` | #811 04:00Z; grep tutorial app.mjs = 0 | S | sonnet (wiring) | VERIFIED |
| 2 | Windmill button missing from the Crumb card; a second Toaster goes dark with no visible fix | All buttons visible (two rows or a paged card) | `command-card.mjs:23-35`, `input.mjs:316-330` | node run: 13 entries, 12 placed | S | sonnet | VERIFIED |
| 3 | Shots are invisible: a ring and a flinch | A slice or bolt arc from shooter to target | `toaster-units.mjs`, `bread-life.mjs`; port `style-lab/pop-shot.mjs` | grep projectile in play: none | L | fable/gpt design, sonnet wiring | VERIFIED |
| 4 | Box-select misses units whose lifted centre point sits just outside the box | Test the body extent, not one point | `input.mjs:71-80`, `app.mjs:396` | code cite; Claude saw 5 of 6 | S | sonnet | VERIFIED rule, UNVERIFIED which unit |
| 5 | Buttons sit on cells that do not match their keys; odd letters (Mill I, Popper O) | Cell equals key, or a documented grid | `command-card.mjs`, `toaster-play.mjs:78-81` | node run | M | sonnet, Joshua's call | VERIFIED |
| 6 | Hungry and unpowered fighters have no sound or overhead icon | Growl on going hungry, icon above the unit, an unpowered cue | `toaster-sounds.mjs:98-122`, `hud-badges.mjs`, `toaster-units.mjs` | no hungry case in `cuesFor`; #814 04:02Z | M | sonnet, gpt (icon) | VERIFIED |
| 7 | Tooltips are native `title`: slow, absent from screenshots | A real hover card using the hud-tips text | `command-card.mjs:59`, `hud-tips.mjs` | code cite | S | haiku | VERIFIED |
| 8 | Easy bot is passive 8+ minutes; no pressure | One small visible early raid on Easy | `players/toaster-easy/bot.mjs` | #788 03:34Z, #837 05:46Z | M | sonnet | UNVERIFIED |
| 9 | "Under attack" never says what; non-Strip hits are silent | Name and place; a sound for any own building or unit | `input.mjs:386-399`, `toaster-sounds.mjs:105` | code cite | S | sonnet | VERIFIED |
| 10 | Gather and deliver give no number or sound | A "+N wheat" float and a collect tick | `bread-life.mjs`, `toaster-sounds.mjs` | `resource_collected` unmapped | S | haiku | VERIFIED |
| 11 | Two audio systems; select and move blips may double; M is Move or Mute | One mixer and a mute key that never clashes | `app.mjs:272-296,494`, `feel.mjs:97-98` | code cite | M | sonnet | UNVERIFIED (audibility) |
| 12 | Menu, sound panel and fullscreen buttons crowd the screen edges | A tidy layout away from the edge-pan band | `results-card.mjs:79`, `toaster-sounds.mjs:130`, `input.mjs:582` | code cite | S | haiku | UNVERIFIED |
| 13 | No follow camera, home key or army-select key | Home jumps to the Strip; a select-army key | `input.mjs:361-378` | grep Home/Backspace/follow: none | S | sonnet | VERIFIED |
| 14 | End card says "A Power Strip fell", with no next step | Say whose Strip, offer a harder rematch, show a tip | `results-card.mjs:25-41` | code cite | S | haiku | VERIFIED |
| 15 | `?motion=coil` and `research/COPY.md` look wired but are not | Delete the dead flag; load tooltip and tutorial copy from COPY.md | `coil-motion.mjs:14`, `research/COPY.md` | grep | S | haiku | VERIFIED |

## Claimed DONE but never seen in a browser

Times are UTC (subtract six for Joshua's local time).

- Power stations 3D (Extension Box, Pylon, Outlet, fences): sonnet, 2026-10-23 23:33, "NOT eyeballed in a browser"
- Placement ghost: 2026-10-24 03:25, "not eyeballed in a browser"
- HUD items 6, 7, 8, 9, 23 (top bar, queue bars, missing icons, tooltips): 03:46, "not eyeballed in a browser"
- Playtest suite, item 32: haiku, 04:00, "Not run in a real browser yet"
- Sounds, item 26: sonnet, 04:01, no browser check; nothing was heard in Claude's pane
- Hunger and 3 shots per slice, items 17 and 22: 04:02, "not eyeballed"
- Bread life (sacks, sails, bucket, toast stack), item 25: 04:03, "not eyeballed in a browser"
- Prices, upkeep and Mill rates, items 14, 16, 18, 19: 04:14, "no browser check"
- Power chip and Hungry chip: 04:58, "Not browser-checked"
- Studio cleanup (gpt): 04:06, "not browser-checked"
- Seen in a real browser: Menu fix and sandbox basics (#811, 04:01), camera fix and sandbox playtest (#830 04:27, #833 04:45), the `res-` chip ids and bread chain (#836, 05:19), and Claude's 11:10 local session.

## Open questions for Joshua

1. Should the five-step tutorial card be on by default (`?tutorial=0` turns it off), or only a quiet hint line?
2. Should the Crumb card grow to two rows so all 13 buttons show, or should some buildings move into a sub-menu?
3. Should each button sit on the grid cell of its key (classic layout), even if that changes letters like Mill (I) and Popper (O)?
4. Do you want visible shots in the match now, even at some frame-rate cost, or keep the ring-and-flinch for the first release?
5. Should Easy include one small early raid so a new player sees that hunger and power matter, or stay passive until 10:00?
