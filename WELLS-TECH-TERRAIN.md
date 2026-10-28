# Wells, a readable tech tree, and tactical terrain (Joshua, 2026-10-25 22:07; plan by Claude)

> Joshua: "How does a well give resources? Something like an automatic vespene geyser, though the closer wells are to one another the less they produce per min. The resource and tech tree needs to be made clearer. There needs to be a way for each player to use the terrain tactically."

## 1. Wells: automatic, and crowding costs (decision: Joshua's words; numbers are Claude's starting points)
Today (env/bakery.mjs): a Well is automatic (no workers). Every 6 s it adds 1 Water if it stands within 4 tiles of creek or pond water; by the home spring it draws every 12 s; elsewhere it is dry. Pantry cap 6 Water a side. Two Wells on one pond each draw at full rate: stacking is the best play. That changes:
- **Crowding rule:** a Well's draw rate is divided by the number of Wells (any owner) within 6 tiles of it, counting itself: alone 1 per 6 s; two within 6 tiles 1 per 12 s each (no gain); three 1 per 18 s each (a loss). Spreading Wells along the creek, or holding a second pond, is the way to more Water, which makes water sites worth fighting over.
- **Readable on screen:** the placement ghost shows the Well's rate before you place it ("1 Water / 6 s" or "shared: 1 / 12 s") and draws the 6-tile crowding ring; a selected Well shows its rate and its crowd.
- **Pantry:** cap rises with each Toaster (6 + 3 per Toaster) so a bigger kitchen does not throw water away.
- Ticket W1 (sonnet, S): env/bakery.mjs crowding rule + tests. W2 (sonnet, S): ghost rate text and ring (play/placement-ghost.mjs, play/hud.mjs). W3 (haiku, S): ECONOMY.md regen and the Well tooltip (play/hud-tips.mjs).

## 2. The resource and tech tree, made clear
The chain is Wheat -> Mill -> Flour; Well -> Water; Flour + Water + Power -> Toast (the ammo); Toasters need Power from the Strip, Windmills (high-ground pads) and Dams (creek sites); units need Toast to fire and a cord to move. Tiers (env/tiers.mjs) gate Four-Slice, Broiler and Flak behind buildings and held land. None of this is drawn anywhere a player looks.
- **Kitchen panel (K key, and the first time a Mill is placed):** one screen that draws the chain as boxes and arrows with live numbers on each arrow (wheat/min, flour/min, water/min, toast/min, power used of made) and greys out what you do not have yet; click a box to get the hotkey and cost. Also drawn as a static picture in the tutorial step 2.
- **Tech tree strip:** under the command card, the three tiers as three rows: what each unlocks, what it needs, with the ones you own lit. Hover a locked unit on the card and the strip highlights what is missing.
- **Docs:** TECH-TREE.md generated from env/stats.mjs and env/tiers.mjs by a script, the way ECONOMY.md is, so it can never go stale.
- Ticket T1 (sonnet, M): play/kitchen-panel.mjs + tests, pure render from observeBakery and the energy report. T2 (sonnet, M): play/tech-strip.mjs + card hover link. T3 (haiku, S): scripts/tech-tree-doc.mjs + TECH-TREE.md + the stale-doc test.

## 3. Terrain, tactically (proposal for Joshua to pick from; nothing built until he picks)
The map already has high ground (14,928 tiles), cliffs (impassable), the creek, windmill pads on high ground and dam sites, but the sim treats high ground as paint. Three mechanics, cheapest first; each is one ticket and one test:
- **A. High ground is sight and reach.** A unit on high ground sees 2 tiles farther and ranged shots from high to low get +1 range; a unit on low ground cannot see onto high ground until it is adjacent. Windmill pads then become hills worth holding. (env/vision.mjs, env/combat.mjs; S-M.)
- **B. The creek is a wall with fords.** Water is impassable to walkers except at 2-3 marked fords per crossing and the Dam; a Dam you own becomes a bridge. Cords cannot cross water except on a Relay Pylon, so the creek is a line that costs power to push past. (env/map.mjs, env/movement.mjs, env/power.mjs; M.)
- **C. Rocks are cover and chokepoints.** A unit adjacent to a boulder takes 25% less ranged damage from the far side; cliff pairs form 1-tile passes the map generator guarantees between each base and the centre. (env/combat.mjs, env/map.mjs; M.)
Claude's recommendation: A and B together make the existing hills, pads, creek and dams matter without new art; C is cheap but easy to miss on screen. Each needs one visible cue (a lighter rim on high ground, ford stones in the creek, a shield pip on a covered unit).

## Decisions open for Joshua
1. Crowding radius 6 and the divide-by-count curve, or a gentler curve (alone 100%, two 70% each, three 50% each)?
2. Terrain: A, B, C, or a different mechanic; and does high ground block sight both ways?
3. Should the Kitchen panel open automatically the first time, or only on K?
