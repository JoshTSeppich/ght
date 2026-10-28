# Ghosties, Hosties, and Toasties playtest checklist (PLAYABLE.md item 32)

Owner: haiku (QA playtester). Use this on http://localhost:4477/preview/rts/play/index.html (the default page is
GHT; add `?classic=1` only to check the old page). Run it in a real browser with screenshots, then file every
failure in the team chat as: **what I did, what I expected, what happened, screenshot path**.

## 0. Headless smoke first (no browser needed)

```
node playtest/smoke.mjs
```

It boots the play modules, runs a 2-minute match (seed 7) with the easy bot and fails on any console error, a rejected
human command, or a referee error. Exit 0 means green. Run it before the browser pass.

## 1. Start a match

- [ ] The page loads with the title **GHT**, no red errors in the console.
- [ ] The top bar shows Wheat, Flour, Water, Toast, Power and Upkeep per minute; hover shows the income rate.
- [ ] The camera opens on your base (the Power Strip), not on the enemy.
- [ ] There is no Drift banner, no market or goods panel, no tier readout and no Supply readout in the default match.
- [ ] The **Menu** button (or F10) opens Resume / Surrender / Restart and the **Opponent** choice (Easy / Normal / None).

## 2. Farm

- [ ] Starting Crumbs stand idle until you right-click wheat (or use the idle-Crumb button / F1 to select them).
- [ ] Right-click on wheat sends a Crumb; it carries wheat home to a station within the cord and the top bar Wheat goes up.
- [ ] An idle Crumb shows the idle-Crumb button blinking; pressing it selects the idle Crumb.
- [ ] Wheat, flour and water rates shown in the bar match what the tooltip says.

## 3. Build the kitchen

Hotkeys: **I** Mill, **W** Well, **T** Toaster, **F** Assembly Line (the Crumb factory), **L** Heat Lamp,
**X** Extension Box, **V** Relay Pylon. Build with the hotkey, then click the map.

- [ ] Placing a building shows a green or red preview; a red preview says why (no wheat, out of cord reach, blocked, Well not near water).
- [ ] Mill: consumes wheat, makes flour; the pantry stops at 6 flour.
- [ ] Well: must be by water; makes water; the pantry stops at 6 water.
- [ ] Toaster: bakes slices from 1 flour + 1 water while it is powered; the Toast count goes up.
- [ ] A building that is missing its input shows a blinking icon above it (no wheat, full pantry, no water, no power).
- [ ] Every button tooltip shows cost, one sentence and the hotkey.

## 4. Train

Hotkeys: **C** Crumb, **O** Popper, **Z** Zapper, **F** Four-Slice, **B** Broiler, **K** Flak Popper, **E** Bagel
(trainees come from the Assembly Line or the Power Strip; check which one each button uses).

- [ ] Training a unit takes wheat and shows a progress bar; up to 5 can be queued (icons on the bar).
- [ ] Clicking a queue icon cancels it and refunds the cost.
- [ ] A rally point set with right-click on the Assembly Line or the Strip sends new units to that point.
- [ ] Upkeep per minute in the top bar goes down (more negative) as the army grows.

## 5. Place boxes

- [ ] Extension Box (30 wheat) extends your cord; a box must join the network to show power.
- [ ] Relay Pylon extends reach further for its cost.
- [ ] A unit outside the cord shows it is unpowered and does not work.

## 6. Fight

- [ ] Attack (A) and move (M) work; box-select (drag) and right-click smart commands work.
- [ ] Poppers fire slices; a fighter's ammo runs down and the unit shows hunger when it runs out.
- [ ] Control groups 1-9 select and recall units.
- [ ] Hungry units will not fight until they eat (toast from the stack). Hunger is readable on the unit.

## 7. Win

- [ ] Destroy the enemy Power Strip. A results card appears: winner, time, wheat gathered, slices baked, toasters lost.
- [ ] **Restart** on the card reloads a new match; **Watch replay** plays your match back (`?mode=watch&replay=last`).

## 8. Lose

- [ ] Your Power Strip destroyed ends the match with a loss card (same card, loss wording).
- [ ] **Surrender** from the Menu ends the match at once with the results card.
- [ ] No loss happens before about 3:00 against the easy bot.

## 9. Sandbox keys (`?difficulty=none`, or Opponent: None in the Menu)

- [ ] There is no enemy that attacks; the enemy Strip stays idle.
- [ ] **P** pauses; **[** and **]** step the game speed (0.5x, 1x, 2x, 4x) and the speed chip shows it.
- [ ] **F5** adds 500 wheat; **F6** adds 20 toast; **F7** reveals the map; **F8** spawns a squad of 4 of the selected unit type at the cursor (max 8 in a squad).
- [ ] The sandbox does not show the results card (no winner).

## 10. Feel and readability

- [ ] A stranger can say what to do next within 3 minutes without help.
- [ ] Every number on screen matches the table in ECONOMY.md.
- [ ] Nothing shows a raw internal name (no "Shards" text on the default page).
- [ ] Screenshots of the top bar, a build preview and a results card are saved for the chat.

## Filing a failure

Post in the team chat: `FAIL <checklist section> <one line>`, then the steps (1, 2, 3), what you expected, what you saw,
and the screenshot path. Keep it under 900 characters.
