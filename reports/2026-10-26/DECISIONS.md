# Joshua's decisions (2026-10-26, 17:14 MDT)

Asked "to modern standards": a StarCraft II-class RTS. These five settle the open questions in "What's Missing (verified)". Every builder reads this before their card.

1. **Damage scale: StarCraft II scale.** Hit points go up about 3x, every unit gets armor, and damage per hit is `max(0.5, damage + attackLevel*attackStep - (armor + armorLevel))`. Upgrades are +1 per level with 3 levels. A fight between equal armies should take 10-20 s, not 3-5 s. Every upgrade level must change hits-to-kill against at least one of the three most common targets (Balance Analyst checks this with scripts/breakpoints.mjs).
2. **Tech cost: Wheat + Flour.** Flour is the second resource, like Vespene gas. It feeds Toasters AND pays for research, tier-2/3 units and tier-2/3 buildings, so the player has to choose. Basic units and buildings cost Wheat only.
3. **Air: yes, at tier 3.** Add a flying layer. Flyers ignore terrain and cliffs, and use their own separation. Each unit declares what it can hit: `hits: { ground, air }`. The Flak Popper becomes the dedicated anti-air unit. Tier 3 adds a scout flyer, an air-to-air fighter and an air-to-ground bomber, built from a new tier-3 air building. Names are toaster-themed and original, with no brands.
4. **Win rule: destroy all buildings.** You win when every enemy building is gone. There is no 15:00 timeout. A 60:00 safety cap ends a match as a draw. The stalemate rule stays as a safeguard. Score and tie-breaks never count building cost (this closes the Heat Lamp stockpile exploit).
5. **Map scale: Claude's default.** Each side gets a natural expansion within 25 tiles, reachable by cord. Rush distance is about 35-45 s of Popper walking, close to a current ladder map. The 8 generator sockets get used, and watchtowers are added.

Unchanged: Wheat is mined by Crumbs, toast is ammunition, power runs through cords, and tiers are tier 2 = Toaster, tier 3 = Windmill or Dam.

## Decision 6 (2026-10-27): baking is demand-driven, so Flour can pile up (Flour balance lead, build wave 2)

Asked whether to make the Mill faster, have the Toaster keep a reserve, or make Flour cheaper, Joshua said: "whatever is going to be balanced." The balance targets are the ones already written down: PLAYABLE.md items 14-16 (first squad of 4 Poppers by 5:00; 1 Mill per 3 Crumbs, about 30 Wheat in and 3 Flour a minute out; the Mill must not eat more than a Crumb brings) and Decision 2 (Flour is the second resource: a player who invests in Mills must be able to spend it on tech).

**The problem.** The Toaster baked every 5 s whenever it held 1 Flour + 1 Water, so it ate 12 Flour a minute against a Mill's 3. The pantry never reached the 2 Flour the Assembly Line costs. Measured on the unchanged tree (1 Mill, forge 2 Flour): the Assembly Line was never affordable in 8 minutes, and one 5-minute bot match logged 2,925 refusals, all `build/forge no-flour`.

**What was tried** (1-Mill scripted opening, `scripts/opening-sim.mjs`; four 5-minute bot matches: rush v turtle, easy v normal, easy v turtle, expand v tech; sandbox scripts in `.sandbox/flour/`):

| Option | Assembly Line affordable | 4th Popper | Refusals (4 matches) | Verdict |
|---|---|---|---|---|
| Unchanged (forge 2, Popper 1 Flour) | never | never | 2,925 / 3,237 / 3,207 / 568 | the bug |
| B. Mill twice as fast (20 s to 10 s) | 149.8 s | 324 s (late) | 0 | The Mill grinds 290 Wheat in the opening instead of 100, so the Assembly Line and the 4th Popper both slip. Fails "first squad by 5:00" and "the Mill must not eat more than a Crumb brings". |
| C. Cheaper Flour (Popper, Zapper, Flak Popper 0; forge 1) | 122.8 s | 252.9 s | 154 / 186 / 156 / 160 | The Toaster still eats every Flour (pantry ends at 0), so Mills never produce a surplus to spend. Treats the symptom. |
| **A. Demand-driven baking with a reserve** | **117.3 s** | **255.5 s** | **0 / 0 / 0 / 0** | Chosen. Fixes the cause and changes no existing number. |

**The rule (env/bakery.mjs).** A Toaster bakes only while the toast stack is under `toastTarget` = 24 (four Poppers, 6 slices each, PLAYABLE item 17), and, once the stack is at `toastHungry` = 8 or more, only with more than `flourReserve` = 2 Flour in the pantry. A hungry army (stack under 8) still gets the last Flour, so fighters are never left empty; the Strip's pilot light is unchanged. Baking is army upkeep: it follows the army's use of toast, and no longer burns Flour nobody committed to it. The Mill and Toaster rates, the pantry cap and `slicesPerBake` did not change.

**Numbers changed.**
- New BAKERY constants: `toastTarget` 24, `toastHungry` 8, `flourReserve` 2.
- `STATS.research.flourCost`: `grunt` (Popper) 1 to 0; `forge` stays 2 (haiku had set it to 1 in the working tree at 21:51; it is back to the Research lead's 2, and the reserve makes 2 affordable).
- Unchanged: `millTicks` 20 s, `toasterTicks` 5 s, `wheatPerFlour` 10, the other Flour costs.

**Flour curve, 1-Mill opening (seed 1).** Before: Toaster finishes at 60.2 s, the pantry is at 0 from then on, the Assembly Line is never affordable. After: 2 Flour by 63 s, the pantry holds 2 when the Wheat arrives, the Assembly Line is affordable at 117.3 s (limited by Wheat, not Flour), finished at 121.0 s, 4th Popper at 255.5 s (target: by 300 s). In the 5-minute bot matches the pantry ends at 2 to 9 Flour per side instead of 0 to 1.

**The Popper.** Decision 2 says "basic units and buildings cost Wheat only", and the SC2 analogy is a gas-free tier-1 fighter. The tier table (`STATS.toasterTiers[2]`) lists the Popper with the tier-2 kinds ("Needs a Toaster"), which is how the Research lead read the decision and pinned it in `tests/research-flour-cost.test.mjs`. That reading is ambiguous, not wrong. Per the balance lead's brief, the Popper is the basic fighter and costs Wheat only. The Zapper and Flak Popper still cost 1 Flour each. Measured: with demand-driven baking the opening also works with the Popper at 1 Flour (4th Popper 255.5 s), so this is a design call, not a requirement. If Joshua prefers Poppers to cost 1 Flour, set `flourCost.grunt` back to 1.

**Not fixed here.** `tests/easy-bot-plan.test.mjs` (tier mix and the two 6:00-8:00 first-attack tests) still fail with Flour set to 0 in a sandbox copy. The cause is Wheat, not Flour: the Popper costs 75 after the Combat Scale rescale, the easy bot only trains one when it holds 135, its Wheat stays under about 90 (boxes and extra buildings), and in seed 3 it trained only Zappers. That is for the AI owner.

## Decision 7 (2026-10-27, 18:27 MDT): official rename to "Ghosties, Hosties, and Toasties"

Joshua: "Officially rename it to Ghosties, Hosties, and Toasties. Put things in order."

The official game name is **Ghosties, Hosties, and Toasties**. The three factions are the Ghosties, the Hosties and the Toasties, in that order. The game was formerly Toaster Wars, then "Ghosters, Hosters and Toasters", and originally Driftfall. The GitHub repo stays named `driftfall`.

**Scope (player-facing text only).**
- Renamed: the game title wherever a player or viewer sees it (setup screen heading, page `<title>`s under play/, boot and error text, the perf page label), the faction display names Toasters, Ghosters and Hosters (now Toasties, Ghosties, Hosties) in UI copy (objective line, tutorial and card tips, HUD counter "Toasties 6/40", results card), and the title lines of NORTHSTAR.md, PLAYABLE.md, COMBAT.md, playtest/PLAYTEST.md and maps/WHEATFIELD.md.
- Not renamed: code identifiers, file names, module paths, state keys, CSS classes and element ids (`res-toasters`, `FACTION_COLORS.toasters`, `play/toaster-*.mjs`), the repo name, unit names (Crumb, Popper and the rest), the Toaster BUILDING (it bakes toast) and the word toaster for the appliance. Code comments, Joshua's quoted history, reports/ and old docs keep the old names as the record.
- Tests that pinned an old title or string were updated with a "DECISIONS 7: official rename" comment.

The single source of truth for the three factions is now FACTIONS.md at the repo root.
