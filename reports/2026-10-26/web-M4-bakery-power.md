# WEB CHECK M4: the bakery and the power network (2026-10-26, haiku)

Scope: Mill, Well, Toaster, pantry, toast and Crumb runs, power sources, cords, Extension Boxes, Relay Pylons, fences, cut and reconnect. Code read: env/bakery.mjs, env/ammo.mjs, env/toast.mjs, env/power.mjs, env/energy.mjs, env/fence.mjs, env/cord-wrap.mjs, and env/sim-territory.mjs (call order). Not read: the HUD and renderer, so what the player sees is only the emitted events (UNVERIFIED for display).

## Web access status (read first)
- Every WebFetch of liquipedia.net (Pylon, Assimilator, Twilight Council, Mining Minerals) returned HTTP 403. No Liquipedia page was fetched, so no web claim here is verified on a fetched page.
- Search snippets quoting Liquipedia or Blizzard are used below and marked "snippet". They are weaker than a fetch.

## Web checks of the research report's claims (M4 slice)
| Claim (research-sc2.md) | Verdict | Evidence |
|---|---|---|
| Unpowered Twilight Council still meets prerequisites for what it unlocks; it cannot research | CORRECT (snippet) | Liquipedia Twilight Council snippet: "even an unpowered Twilight Council still meets the prerequisites for all of the upgrades and buildings it unlocks" |
| Pylon power radius 6.5 | UNVERIFIED for LotV | Only a Wings of Liberty patch 1.3.3 note snippet (cut 7.5 to 6.5). Not confirmed for LotV |
| Pylon supply 8 (the code's "pylon" is not supply; code has no supply) | UNVERIFIED | No authoritative source found |
| Pylon cost 100 minerals, 18 s | UNVERIFIED | Liquipedia Pylon page not reachable |
| Assimilator (refinery) cost 75 minerals, 21 s | CORRECT (snippet, not in report) | Liquipedia infobox snippet "Cost 75 0 21" |
| Geyser 2,250 gas raised to 2,500 in 5.0.16 | CORRECT (snippet) | Blizzard 5.0.16 patch-note snippet: "Vespene Geysers' resource count increased from 2,250 to 2,500" |
| Large mineral patch 1,800 to 1,600 in 5.0.16 | CORRECT (snippet) | Blizzard 5.0.16 snippet |
| Small mineral patch to 1,100 in 5.0.16 | PARTLY | Final notes snippet say 1,100; PTR notes snippet say 1,200. Not resolved |
| Rich geyser harvest return 8 to 6 | not in report | Blizzard 5.0.16 snippet |
| 3 workers on a patch ~102 a minute; 3 on a geyser ~114 gas a minute | PARTLY | TL forum snippet: 3 on a patch ~102/min. Geyser 114 not found |
| First two workers ~40/min, third ~20 | UNVERIFIED | Forum snippets conflict (~42/min flat per worker up to 16; 61/min in a Liquipedia MULE snippet) |
| 16 optimal, 24 maximum workers per base | UNVERIFIED (24 not found) | TL forum snippet: 16 workers with an 8-8 split; no source for 24 |

## Code findings (M4), checked against the code and the chat
1. CORRECT (HIVE 7): Toaster bakes one flour and one water every 5 s (12/min each, 48 slices/min). Mill makes one flour every 20 s (3/min) and eats 10 Wheat per flour. env/bakery.mjs BAKERY.
2. stepToast is never called in the territory sim. env/sim-territory.mjs calls stepBakery and stepAmmo (line 251), but stepToast only appears in its own file. So toast moods (happy/grumpy/strike), eating, and toastAttackScale are inert in /play. Check before relying on HIVE 4.
3. Two power graphs disagree. Cord networks (power.mjs POWER.range: Strip 14, Outlet 10, Extension 12, Pylon 8) decide whether a Toaster is lit (bakery structurePowered). Station links (power.mjs STATION: Strip link 10, Extension link 8, Pylon link 16) decide fences and energy. A Toaster can be lit by a 12-tile Extension while its fence line is not linked at 8.
4. Energy budget: Strip makes 2, one Toaster uses 2. A second Toaster on a Strip-only network browns out (newest first) unless a Windmill (3) or Dam (6) joins the network. Design fact, not an error.
5. toast.mjs header says toast is baked "at the Power Strip from Flour + Water + Energy". bakery.mjs bakes at the Toaster from Flour + Water. The header is stale (and energy is not an ingredient in the live path).
6. Tick constants: power.mjs hard-codes 24 ticks per second (battery 240, plug 24, reserve 720, enclosure hold 144). env/stats.mjs TICKS_PER_SECOND = 24, so they match today. They break silently if the rate changes.
7. Well crowding: beat = 6 s x (1 + sum of (1 - d/8)) over other Wells within 8 tiles, any owner. Spring wells draw every second beat. Dry Wells (no water or spring within 4) make nothing and cost nothing. Enemy-distance rule: no Well within 6 (Chebyshev) of an enemy structure.
8. Pantry cap: 6 + 3 per complete Toaster of that side. The Power Strip pilot bakes 1 slice every 20 s while stock is under 4, so a side is never softlocked.
9. Crumb runs: 2 slices per run, speed from worker speed, raided by an enemy fighter within 2 tiles (slices lost). Lifeline (1 slice per 20 s when stuck) and dole (one free Crumb per 30 s when broke) are the guarantees.
10. Cuts: an enemy on the cord line sets battery (10 s), then power-down. Re-plug needs a Crumb adjacent for 1 s. Events: cord-cut, power-battery, power-down, plug-start, plugged, plug-fail, reserve-crumb, fence-up, fence-down, enclosed (what the HUD should show; display not read).
11. Fences: 1 energy per 8 wall tiles, shed fences first, then Toasters. Enclosure needs 3 posts and 6 s held (144 ticks at 24/s). Pocket cap 400 tiles.

## Associations (web fact to code problem)
- SC2 worker saturation (Team Liquid snippets: per-worker income flat to 16 workers, then falls) is the nearest analogue to the Well crowd curve in bakery.mjs. Both punish stacking on one resource. The Well formula is a linear falloff to 8 tiles; SC2's is a per-patch cap. Consider the same "one more costs you" message for the HUD.
- SC2's Twilight Council rule (unpowered still counts as a prerequisite) contrasts with the Toaster Wars design, where a shed Toaster stops baking. If the report's tier-2 "needs a Toaster" should keep its rule, check whether prerequisite checks use structurePowered (not verified in this slice).
- SC2 Assimilator and geyser amounts (2,250 to 2,500) back the report's geyser change, but Toaster Wars has no gas. Its power is energy by the building, not a per-geyser pool, so the 5.0.16 numbers do not transfer.

## Left open
- Liquipedia pages (blocked by 403): Pylon power radius and supply for LotV, Vespene per geyser for LotV, mining per-worker table, 16/24 worker counts.
- Renderer and HUD: what the player sees for each event (not read).
- Whether the prerequisite checks use the power state (not read).

Sources (snippets only): Liquipedia Twilight Council and Assimilator (via search); Blizzard 5.0.16 patch notes (via search); Blizzard Wings of Liberty 1.3.3 notes (via search); Team Liquid mining threads (via search).
