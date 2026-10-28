# Web check F2: upgrades, quotes, mining, Patch 5.0.16, stalemate, upkeep

Checker: Haiku 5.5 hive checker, 2026-10-26. Read-only on the game. Slice: research-sc2.md sections 2 (upgrades and breakpoint example), 3 (quotes, mining, Dec 2014 cut, Patch 5.0.16), 4 (stalemate, WC3 upkeep).

Method: WebFetch where the page loaded. Many Liquipedia pages returned HTTP 403 and the Marine, Stimpack, Combat Shield, Upgrades, Mineral and Stalemate pages could not be fetched. Those claims rest on WebSearch excerpts and are marked PARTLY or UNVERIFIED accordingly. Excerpts are not quotes from a page I saw in full.

## Section 2: unit upgrades and breakpoint example

| Claim | Verdict | Evidence |
|---|---|---|
| Terran infantry weapons/armor costs 100/100, 150/150, 200/200 | PARTLY | Liquipedia Engineering Bay excerpt (search): L1 100/100, L2 150/150 and L3 200/200, L2 and L3 need an Armory. https://liquipedia.net/starcraft2/Engineering_Bay (excerpt only) |
| Research times 114 s, 136 s, 157 s | UNVERIFIED | No page showed times. |
| Patch 5.0.13 cut levels "from 100/175/250 to 100/150/200" | UNVERIFIED | Starcraft Wiki excerpt gives 100/175/250 for an older campaign-era version. No 5.0.13 patch note fetched. |
| Attack upgrade size "base damage/10, min 1" | PARTLY | Liquipedia Upgrades excerpt: increases "generally follow base damage/10, min 1 but this is not universal." The report drops "not universal". https://liquipedia.net/starcraft2/Upgrades (403, excerpt only) |
| Attack upgrades do not apply to ability damage | UNVERIFIED | Not seen. |
| Armor cannot reduce damage below 0.5 | PARTLY | Liquipedia armor excerpt: "Armor also cannot reduce damage below 0.5." Not fetched. https://liquipedia.net/starcraft2/Armor (search excerpt) |
| Stimpack 100/100, 100 s; 10 HP cost for Marine | PARTLY / UNVERIFIED | 10 HP cost: Liquipedia excerpt and Battle.net strategy page. 100/100, 100 s came only from classic.battle.net, which covers original StarCraft. SC2 time not confirmed. |
| Combat Shield 100/100, 79 s; +10 HP | PARTLY | Starcraft Wiki Marine (SC2) excerpt: 100/100, 79 s, +10 HP. Liquipedia Stimpack excerpt: Combat Shield offsets the 10 HP Stimpack cost. https://starcraft.fandom.com/wiki/Marine_(StarCraft_II) |
| Marine 45 HP base, so 55 with Combat Shield | PARTLY | 55 total: blizzplanet blog ("a whopping 55 hit points"). Base 45 not confirmed by any source fetched. |
| Marine 6 damage, 0 armor | UNVERIFIED | Marine Liquipedia page not retrievable (403, and search returned none). |
| Concussive Shells 50/50 43 s; Metabolic Boost 100/100 79 s; Blink 150/150 121 s; Charge | UNVERIFIED | Not checked. |
| Breakpoint arithmetic: 45/6 = 8 hits; 45/7 = 7 hits; 55/6 = 10 hits; 55/7 = 8 hits | CORRECT (arithmetic) | Ceil of HP/damage, given the inputs above. The inputs themselves are PARTLY or UNVERIFIED. |

## Section 3: quotes and mining

- **David Kim, "Talking Balance" (45-55% win rate, "no sign of imbalance", 54% this week / 46% next, Cloud Kingdom 70% PvT, Metalopolis 37% TvZ, "careers on the line"):** UNVERIFIED. The episode and the 45-55% phrase were not found. The Blizzard article "The Balancing Act" (https://news.blizzard.com/en-us/article/1136961/starcraft-ii-the-balancing-act, 2010, unsigned) was fetched. Its wording: a 55:45 ratio is "still within acceptable boundaries"; ratios "exceeding 60%:40% could indicate that a small imbalance might exist"; "a variance of +/- 5%". The fetched text does not mention tournament results, pro feedback or careers. So the report's bands and quotes are not from that source. Likely the report merged a 2010 source with a later podcast. Correct it to the 55:45 / 60:40 wording, or find the podcast.
- **Balance judged from "internal data, tournament results, pro-players":** PARTLY. Internal data (millions of games) is in the 2010 article. Tournament and pro feedback are not in it.
- **Dustin Browder hard/muddy counters:** PARTLY. GameStar English interview excerpt (https://www.gamestar.de/artikel/starcraft-2-exclusive-interview-with-lead-designer-dustin-browder,2313674.html) says Browder called Archons, Ultralisks and Firebats "really hard counters" and Dragoons, Hydralisks, Zealots and Marines "very muddy counters." The report's exact sentence was not seen verbatim.
- **Browder "minimum, not maximum" units quote:** UNVERIFIED.
- **Mining 40/40/20 per minute, 102 per minute for 3 on a patch, 114 gas per minute on a geyser:** PARTLY for 40/40/20 and 102 (search summary of Liquipedia Mining Minerals, plus old TL threads). Geyser 114: UNVERIFIED. Figures are from older game versions.
- **16 optimal, 24 maximum per base:** PARTLY. Team Liquid saturation threads. One minority TL thread argues the optimum is about 27 by marginal analysis. Not a Blizzard or Liquipedia source.
- **LotV December 2014 cut to 70%:** CORRECT on the 70% figure. Blizzard News (German, de-de, 17 Dec 2014, David Kim) says resources were reduced to 70% of HotS and that this encouraged players to leave their base and attack expansions. https://news.blizzard.com/de-de/article/17222794/20141217 The report's English quote was not seen verbatim. "Half of each base's patches small" is UNVERIFIED.
- **Patch 5.0.16 exists (June 2026):** CORRECT. Liquipedia Patch 5.0.16 page (fetched): North America 22 June 2026, Europe and Korea 23 June 2026. https://liquipedia.net/starcraft2/Patch_5.0.16 Blizzard notes (fetched) agree on the mineral and geyser lines. https://news.blizzard.com/en-us/article/24259080/starcraft-ii-5-0-16-patch-notes
  - Large mineral patch 1,800 to 1,600: CORRECT.
  - Small mineral patch 900 to 1,100: CORRECT (report wrote "small to 1,100" without the old value).
  - Geysers 2,250 to 2,500: CORRECT at release. The report says "geysers to 2,500", which is the release value only.
  - **STALE:** the Liquipedia page says the June 30 2026 hotfix lowered the default geyser to 2,000 (total gas per base 5,000 to 4,000). The report should say so.
  - **OMITTED:** starting workers 12 to 8; total default gas per base 4,500 to 5,000; rich geyser harvest 8 to 6.
  - Patch 5.0.17 reverting 5.0.16: UNVERIFIED. One third-party guide says so. The Liquipedia 5.0.17 page was not checked.

## Section 4: stalemate and upkeep

- **Stalemate: three minutes with no income, no production and no destroyed structures ends the game in a draw:** PARTLY. Search excerpts (not fetched) say this has applied since patch 1.2.0 (2011), with a countdown shown to players. Liquipedia Stalemate Detection returned 404 and Blizzard pages 403 for other lookups. Ask for the primary page before relying on it.
- **Warcraft III upkeep bands 0-50 food = 100%, 51-80 = 70%, 81+ = 40%:** PARTLY. Search excerpts from warcraft.wiki.gg and classic.battle.net (not fetched) match. Those bands are the TFT version. The excerpt says Reign of Chaos used 0-40 / 41-70 / 71+ (the report's bands are off by ten). Quote "High Upkeep is MEANT to be very punishing": UNVERIFIED.

## Associations (web fact to Toaster Wars code)

1. **Stalemate vs. the code's endings.** verify-D-endings.md says the code has no stalemate or draw rule. It ends on a Core kill, or on the 15:00 timeout scored by board value with a bank tie-break. The SC2 rule fires only when nobody has income. Toaster Wars keeps income running (Mills draw from the bank every 20 s, Crumbs keep mining), so the report's "stalemate after 2 min" in F2 would almost never fire. It needs a different trigger, such as no Strip damage for N minutes.
2. **Mining cap vs. Crumbs per tile.** The SC2 3-per-patch diminishing return (40/40/20) is the fix the report wants (E2 "6 per tile"). verify-C-economy.md (M4, A3) confirms the code has no per-tile cap and idle Crumbs all pile onto one tile. The SC2 curve is the model for a cap with diminishing returns, not a hard cap of 6.
3. **Dec 2014 cut and finite fields.** Blizzard cut resources to 70% to force expansion. verify-C (M1, #2) shows the Toaster Wars home field (8 tiles, 14,400 Wheat) lasts about 86 min at six Crumbs, so nothing pushes the player out inside a match. A 70% style cut on home tiles is the lever. Note the coincidence: Toaster Wars' 1,800 per tile (env/map.mjs:12) is the same number SC2 cut to 1,600 on 22 June 2026. It is not a sourced value.
4. **Upkeep.** The report's WC3 bands are a gold tax. verify-C (#8) shows Toaster Wars upkeep is a flat 5% on /play, and the in-game tip reads 10%. A banded tax would be a new design, not a copy of the code. Keep this in mind when the report's target is "30-45% of two-base income".

## Summary of corrections for the report

1. Add Patch 5.0.16 hotfix: geysers were cut to 2,000 on 30 June 2026 (Liquipedia 5.0.16 page). Add starting workers 12 to 8.
2. Replace the David Kim 45-55% / Talking Balance quotes. The 2010 Blizzard article gives 55:45 and 60:40 with +/-5%.
3. Upkeep bands are TFT; RoC was 0-40 / 41-70 / 71+.
4. Stalemate detection: keep the 3-minute no-income rule as stated, with the caveat that Toaster Wars income never stops.
5. Mark UNVERIFIED: Marine 6/45 stats, Stimpack and Combat Shield SC2 costs/times, Concussive, Metabolic, Blink, Charge, the 5.0.13 cut, the Browder "minimum" quote, the 114 gas/min geyser rate.
