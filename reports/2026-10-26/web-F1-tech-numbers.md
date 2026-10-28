# WEB F1 — tech-building costs (research-sc2.md §1) and global upgrade table (§2)
Checker: Haiku (web). Date 2026-10-26. Read-only; no game files touched.

## Access limits (read this first)
- Every Liquipedia building page returned HTTP 403 to WebFetch, both `liquipedia.net/starcraft2/<Building>` and `www.` and the `(Legacy_of_the_Void)` titles. The Liquipedia API URL redirected to Barracks, with no numbers. The fandom wiki returned 402/403. So NO building page was fetched.
- Liquipedia patch pages DID fetch: `liquipedia.net/starcraft2/Patch_5.0.13`.
- Blizzard news pages DID fetch: 5.0.13 (news.blizzard.com/en-us/starcraft2/24078322/...), 5.0.16 (24259080), 5.0.17 (24309308).
- Web search snippets are NOT fetched pages. Under the HIVE rule they can only support "partly", never "verified". Snippet-only items are marked SNIPPET below.

## §1 Tech-building cost table (minerals / gas / seconds)
| Row (report value) | Verdict | Evidence |
|---|---|---|
| Terran Barracks 150/0/46 | SNIPPET | LotV Barracks page snippet gives 150/0; the 46 is an unlabeled number in the same block (time unconfirmed). |
| Terran Tech Lab 50/25/18 | SNIPPET | Tech Lab (LotV) snippet: 50/25/18. Page not fetched. |
| Terran Reactor 50/50/36 | SNIPPET | Reactor snippet only. |
| Terran Factory, Starport, Engineering Bay, Armory, Fusion Core, Orbital | UNVERIFIED | No fetched source. |
| Terran Armory 150/50/46 | PARTLY | Fetched 5.0.13 notes (Blizzard and Liquipedia): "Cost reduced from 150/100 to 150/50." Gas matches the post-patch value; time UNVERIFIED. |
| Protoss Gateway, Cyber Core, Forge, Twilight, Robo, Stargate, Templar Archives, Warp Gate | UNVERIFIED | No fetched source. |
| Zerg Hatchery 275/0/71 | UNVERIFIED | No fetched source. |
| Zerg Hive 200/150/71 | SNIPPET (weak) | A search result carried 200/150/71 for Hive, flagged by the search agent as possibly a different figure. Not confirmed. |
| Zerg Lair, Spire, Hydra Den, Infestation Pit, Pool, Evo, Roach Warren | UNVERIFIED | No fetched source. |

Net: 0 of 26 rows verified on a fetched building page. Armory gas and Tech Lab / Reactor values match snippets. Time values are all unconfirmed.

## §2 Global upgrade table, three levels (minerals/gas, seconds)
Current Zerg row values from fetched Blizzard notes:
- Zerg Ground Carapace (fetched, Blizzard 5.0.16 and 5.0.17):
  - 5.0.16 cut it: "Level 1 cost decreased from 150/150 to 100/100. Level 2 cost decreased from 200/200 to 150/150. Level 3 cost decreased from 250/250 to 200/200."
  - 5.0.17 raised it back: "Level 1 cost increased to 150/150 from 100/100. Level 2 cost increased to 200/200 from 150/150. Level 3 cost increased to 250/250 from 200/200."
  - So the current full three-level Zerg Ground Carapace is **150/150, 200/200, 250/250**. Times UNVERIFIED.
  - Report row "150/150, 114 s, no level 2 or 3": **WRONG** (incomplete). Levels 2 and 3 are missing.
- Zerg Flyer Attacks / Flyer Carapace (SNIPPET only; Liquipedia Spire/Upgrades page and an Abathur page in search):
  - Flyer Attacks: L1 100/100, L2 175/175 (Lair), L3 250/250 (Hive).
  - Flyer Carapace: L1 100/100, L2 175/175, L3 250/250 (secondary source).
  - Report row is missing Level 1 (100/100) for both. Report's L2 175/175 and L3 250/250 are consistent with the snippet. Times UNVERIFIED. Gate Lair then Hive: consistent with snippet.
  - Verdict: PARTLY.
- Terran Infantry Weapons/Armor:
  - Report: L1 100/100, L2 150/150, L3 200/200. Gate Armory.
  - Claim "5.0.13 cut from 100/175/250 to 100/150/200": **CORRECT as stated in the 5.0.13 notes.** Fetched text, Blizzard 5.0.13 article and Liquipedia Patch 5.0.13 page: "Infantry weapons/armor upgrades cost reduced from 100/175/250 to 100/150/200."
  - Caveat: the fetched Blizzard 5.0.13 article carries only "We happy to push 5.0.13" as intro. The fetched text does not state live vs PTR. A devtrackers page titled "5.0.13 PTR Patch Notes" carries the same line. A search snippet says the live patch shipped 2024-03-26; SNIPPET only. So the number is CORRECT; live status is UNVERIFIED on a fetched page.
  - Level 2/3 times 136 s and 157 s: UNVERIFIED.
- Protoss Ground Weapons/Armor (SNIPPET, Fandom-derived, not fetched): L1 100/100 121.6 s, L2 150/150 144.6 s, L3 200/200 167.9 s. Report's 121/145/168 s match to rounding. Verdict: PARTLY (costs and times consistent with snippet; primary not fetched).
- Protoss Shields (SNIPPET): L1 150/150, L2 200/200, L3 250/250, times 121.6/144.6/167.9 s. Matches report. A patch-history snippet says earlier values were 150/225/300 and later cut to 150/200/250. Verdict: PARTLY.

## Association (web fact to code and report)
- Blizzard re-tuned Zerg Carapace costs twice in two patches: cut at 5.0.16, reverted at 5.0.17. This is a concrete instance of the report's "small changes, 45-55% balance" advice and of its own caveat that Liquipedia lags patches. Any GHT number copied from a patch table should carry a patch tag.
- The Terran cut (-25 minerals at L2, -50 at L3) and the Armory gas cut (100 to 50) are the same kind of change: cheaper upgrades in exchange for faster access to the high-tier fights. That matches HIVE item 1 (/play has no research at all), so none of these SC2 costs change GHT until research is wired in.
- The report's GHT "Hot Coils 100+10 Flour, 150+20, 200+30" rests on invented stats (HIVE item 6). The SC2 real figures for Terran/Protoss/Zerg upgrades are nearly all 100-250 per level. Pattern holds; the specific GHT values remain unsupported.

## Summary counts
- §1 rows: 26 claims. 0 fully verified on a building page. 3 snippet-level matches (Barracks, Tech Lab, Reactor). 1 PARTLY (Armory gas). Rest UNVERIFIED.
- §2: Terran 5.0.13 claim CORRECT as to the notes. Zerg Ground Carapace WRONG (missing L2/L3; current 150/200/250). Zerg Flyer PARTLY (L1 missing). Protoss Ground and Shields PARTLY (snippet only).

## Not done
- Building pages (Liquipedia) could not be fetched. Build times for every row remain UNVERIFIED. The fix is a Liquipedia-accessible copy or the in-game data.
