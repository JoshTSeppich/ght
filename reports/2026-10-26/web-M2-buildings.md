# M2 BUILDINGS: minutiae check (web + code), 2026-10-26

Checker: haiku, web checker. Slice M2 of the minutiae sweep: every structure's cost, hp, build time, placement, builder, cancel/refund, repair, rally, queue length, death, and visibility. Code read-only. Web sources: Liquipedia returned HTTP 403 to WebFetch, so SC2 claims rest on search snippets and one Blizzard guide page. Those are marked UNVERIFIED where the snippet did not state the number.

## 1. Code facts (GHT, `state.ammo` overlay, 24 ticks = 1 s)

| Building | Cost (wheat) | HP | Build time | Builder | Tier / gate | Source |
|---|---|---|---|---|---|---|
| Power Strip (core) | none (can't build) | 2400 (toaster coreHp; base 1000) | n/a | n/a | n/a | stats.mjs:131, 167; sim-territory.mjs:99 |
| Assembly Line (forge) | 150 | 400 | 80 ticks = 3.3 s (toaster overlay; base 40) | Crumb (worker) | tier 2, Needs a Toaster | stats.mjs:140, 178; tiers.mjs:72 |
| Heat Lamp (turret) | 100 | 150 | 60 ticks = 2.5 s | Crumb | tier 1 | stats.mjs:141, 179 |
| Mill | 75 | 200 | 60 ticks = 2.5 s | Crumb | tier 1 | stats.mjs:142 |
| Well | 50 | 150 | 40 ticks = 1.7 s | Crumb | tier 1 | stats.mjs:143 |
| Toaster | 100 | 250 | 60 ticks = 2.5 s | Crumb | tier 1 | stats.mjs:144 |
| Extension Box | 30 (station) | none in code | instant | Crumb (place-power) | tier 1 | power.mjs:28; station-controls.mjs:2 |
| Relay Pylon | 60 (station) | none in code | instant | Crumb (place-power) | tier 2, Needs a Toaster (UI only, see 3.2) | power.mjs:28; stats.mjs:253 |
| Windmill | 40 (site price) | none in code | instant | Crumb (place-power, high-ground pad) | tier 1 | energy.mjs:19; power.mjs:206 |
| Dam | 90 (site price) | none in code | instant | Crumb (place-power, river site) | tier 1 | energy.mjs:19; power.mjs:207 |
| Mill Dam | 160 (site price) | none in code | instant | Crumb, via the Dam key | not a button of its own | energy.mjs:19, 31; power.mjs:207-209 |

Build mechanics (economy.mjs:118-139; sim-territory.mjs:120-130 is the claim path only): hp rises from 1 by maxHp/buildTicks per tick, so a site is only as tough as its progress. A worker must stand within distance 1 for each tick of progress; if it leaves, progress stops. Completion clears the builder's order.

Power stations are not structures. doPlaceCord (power.mjs:218-221) pushes them into `state.power.points` with no hp and no build time. Combat's target list is `everything(state)` (combat.mjs:26), and the only damage path I found is over `state.structures`. So in code, stations appear untargetable. This is NOT confirmed by a test; I did not read combat.mjs:26-30 in full.

## 2. Queue, cancel, refund, repair, rally

- **Queue length**: `STATS.match.queueMax = 5` (stats.mjs:99), one value for every building. A full queue rejects with `queue-full` (commands.mjs:110). No Reactor or Tech Lab add-on exists, so there is no 8-slot queue.
- **Pay**: classic (no budget) charges the full unit cost when queued (commands.mjs:111-117). Under the GHT budget, cost is drawn gradually as the unit trains (budget.mjs via sim-territory.mjs:164-175).
- **Cancel train**: `cancel-train {building, index}` (commands.mjs:124-140). Classic: full refund, emitted as `refund`. Budget: no refund; the HUD says 0 (hud-queue.mjs:19). Cancelling the head also forfeits the cost already drawn (commands.mjs:130-132).
- **Cancel construction**: NO command. There is no cancel-build and no demolish. A site's cost is spent at placement (commands.mjs:94). A destroyed site refunds nothing (test: economy-build-train.test.mjs:224-238; combat-damage.test.mjs:208).
- **Repair**: NO command, no regen, no UI. The only "repair" hits in env/play are style-lab animation (play/style-lab/*), not gameplay.
- **Rally**: client-only. The sim has no rally state. input.mjs:600-619 sends each new unit a move or gather order when it appears within 2 tiles of a flagged building. The Power Strip defaults to the nearest crystal (input.mjs:604-606). Assembly Line rally uses the `lineRally` key (input.mjs:429). The referee and bots never see rally.
- **Death**: `die` removes the entity (combat.mjs:115-117). No refund path exists in the code for destroyed buildings or queued units. The Power Strip dying ends the match with reason `core` (sim.mjs:111-112). A dead Toaster or Well stops counting for the bakery and for energy (bakery.mjs:78, 88; energy.mjs:77).
- **Armor**: none. Combat subtracts hp only, and the research report already says combat reads no armor.

## 3. Findings (ranked)

1. **Mill Dam costs more than the card says.** Card price is `stationCost('dam') = ENERGY.cost.dam = 90` (station-controls.mjs:11). The Mill Dam site charges `state.energy.cost.milldam = 160` (power.mjs:209), but the no-shards pre-check uses 90 (power.mjs:211). A player with 90-159 wheat sees "no-shards" after seeing a 90 price, then the real deduction is 160. Mismatch. Verify with a test before filing.
2. **Relay Pylon tier gate is UI-only.** The sim gates `build` and `train` by tier (sim-territory.mjs:199, 207) but `place-power` is in the "mine" list (sim-territory.mjs:196) and is never tier-checked. A non-UI client can place a Pylon with no Toaster, though the card locks it (input.mjs:192-195).
3. **No construction cancel.** Once placed, a Toaster site costs 100 and can only be lost, never refunded. SC2 lets you cancel construction with a refund (see 4.2), so this is a real gap, not just a missing button.
4. **Repair and rally are not in the sim.** Rally lives in the client (input.mjs:600), so it cannot be scripted, replayed or tested headless. Repair does not exist at all.
5. **Queue length 5 everywhere.** Not per building. Assembly Line, Toaster and Mill share it, and no add-on raises it.
6. **Stations have no hp.** Extension, Pylon, Windmill and Dam cannot be damaged in the code path I read, so enemy raids cannot cut a cord except by killing the Strip. Needs a test.
7. **Card shows "coming soon" for Rings, Pause, Target, Unplug, Pilot** (input.mjs:428-435). Cancel-build and repair do not appear at all, not even as coming-soon.

## 4. Web check against StarCraft II

### 4.1 Build queue
- Research claim: Reactor "increases the size of its build queue from 5 to 8". **PARTLY / UNVERIFIED.** The one search hit, Liquipedia "Campaign/Tech Reactor" (https://liquipedia.net/starcraft2/Tech_Reactor), says the 8-slot queue belongs to a campaign-only building that does not exist in standard multiplayer. The plain Reactor's queue size was not in any result. Do not cite the 5-to-8 claim for multiplayer.

### 4.2 Cancel refund
- Research claim: none given. Search returned only an old AnandTech forum thread (https://forums.anandtech.com/threads/official-star-craft-2-multiplayer-thread.2095987/post-31757200). It says cancelling a building under construction returns the investment, while destroying one under construction gives no refund, and a destroyed production building returns the resources for its queue. **No percentage found.** The 75% figure in my brief was NOT found: UNVERIFIED.

### 4.3 Repair
- Liquipedia SC2 Repair and SCV pages returned 403. Search snippet (https://liquipedia.net/starcraft2/SCV_%28Legacy_of_the_Void%29) confirms SCVs repair Terran buildings and mechanical units but gives no cost ratio. A Team Liquid blog says 25% of cost from zero to full, unverified; the Brood War Liquipedia page says about one third. **Conflicting, UNVERIFIED.**

### 4.4 Rally
- Blizzard game guide (https://news.blizzard.com/en-us/article/4488317/game-guide-buildings): rally points set where the unit goes right after it is made; a rally target that dies before the unit exits makes the unit stop. Rally on a transport loads the unit. **Confirms** the concept; the code's rally is client-side (see 2), so the "dead target" case does not exist there.

### 4.5 Construction and armor
- Blizzard guide: "Structures under construction have no damage mitigation." **Confirmed** on that page. Also: units can get stuck when they exit a structure built next to other objects. The code's building ramp (hp = progress share) is a different mechanism, so no direct match.
- Structure armor values: not fetched (Liquipedia 403). **UNVERIFIED.**

## 5. Associations

- SC2's construction-site vulnerability (no mitigation until finished) and GHT' hp ramp (economy.mjs:128) both let an early kill of a site cost the whole investment, and the code refunds nothing. The research report's "bases never die" concern is about the Strip; the bigger M2 risk is that a 100-wheat Toaster can be lost to one raid with no undo. A construction cancel with a partial refund would match SC2 and close finding 3, but the refund rate still needs a source.
- The report's repair-free design is consistent with the code, but if SC2's repair is a core part of its "bases don't die" argument, GHT has no equivalent for Heat Lamps or Toasters.
- Rally lives client-side; SC2's rally rules (4.4) are sim rules. Moving rally into the sim is the faithful version and would make it testable.

## 6. Verdicts

| Claim | Verdict | Evidence |
|---|---|---|
| Reactor queue 5 to 8 (multiplayer) | PARTLY | Liquipedia Tech Reactor: campaign-only |
| Cancel refund 75% (SC2) | UNVERIFIED | no percentage found |
| Repair cost (SC2) | UNVERIFIED, sources conflict | Liquipedia 403; TL blog 25%; BW page one third |
| Construction has no damage mitigation (SC2) | CORRECT (for SC2 structures) | Blizzard guide |
| Rally dies-means-stops (SC2) | CORRECT | Blizzard guide |
| GHT: no repair, no cancel build | CORRECT (code) | grep of env and play; commands.mjs has cancel-train only |
| GHT: queue 5 for every building | CORRECT (code) | stats.mjs:99 |

## 7. Not checked
- Combat target list for station points (combat.mjs:26-30 read only by grep).
- Whether a dead production building's queued units are charged or refunded under the budget (no refund path found; not tested).
- Liquipedia pages (403); any SC2 figure from them is UNVERIFIED.
- No test was run and no game code was edited.
