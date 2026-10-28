# THE HIVE — double-checking the StarCraft II research (2026-10-26)

Joshua (11:38): "run more agents to be crawling the findings and double checking and finding assoc[iations]". (11:44): "start many haiku's with internet access to check in with the hive". Everyone checking reads this file first and checks in through the team chat.

## Where things are
- `reports/2026-10-26/research-sc2.md` — the research report being checked (StarCraft II tech tree, upgrades, balance; a proposed GHT design). Every number in it is a claim.
- `reports/2026-10-26/verify-A-upgrades.md`, `verify-B-roster.md`, `verify-C-economy.md`, `verify-D-endings.md`, `verify-E-docs.md` — read-only CODE crawlers (they may still be writing; read what exists).
- `reports/2026-10-26/web-*.md` — the WEB checkers (you). Read each other's as they land.
- Team chat: `node read.mjs --since 1185` to read; `node say.mjs haiku "CHECK <your slice>: ..."` to post. Under 700 characters, at most 2 posts each.

## Corrections Claude found in the code so far (verify, don't trust)
1. /play has no research at all (play/toaster-play.mjs deletes state.research); env/combat.mjs reads no upgrade and no armor.
2. Nothing flies. The Bagel is a rolling melee ground unit (Ram, needs power, no toast). The report's air layer and "Bagel = air raider" are wrong.
3. Wheat fields are finite (1,800 a tile, 3,600 golden), but each home field is 8 tiles (14,400 Wheat) and lasts ~30 min at 16 Crumbs: nobody mines out inside 15:00.
4. New fighters already spawn with a full toast load (Popper: 18 shots).
5. The Wheatfield map already places 8 generator sockets that no code uses.
6. The report's GHT unit stats are invented. Real: Popper 75 Wheat, 60 hp, 20 damage every 1.5 s, range 4; Zapper 65, 40 hp, 18/1.25 s; Four-Slice 225, 240 hp, 36/1.25 s; Broiler 175, 70 hp, 30/1.5 s, range 9, splash; Flak Popper 70, 50 hp, 15/1.5 s, splash; Bagel 125, 120 hp, 14/0.5 s melee. Units die in 2-4 hits, so "+1 damage a level" changes hits-to-kill for only 14 of 42 pairs by level 3 (+10% a level: 25 of 42).
7. A Toaster burns 12 Flour a minute; a Mill makes 3.
8. The two Power Strips are 219 tiles apart on a 256-tile map; cord reach is 12 tiles a box.

## Joshua (11:45): "verify the minutiae of the game and make sure nothing is missing"
Two kinds of Haiku checkers, both with web access:

**MINUTIAE checkers (most of you).** Take one area of the game and go through every detail in it: every unit, building, command, key, rule, edge case and piece of feedback.
1. Read this file and `node read.mjs --since 1185`.
2. Inventory your area FROM THE CODE: list every item with its real numbers and behaviour (file:line). Try it with a node one-liner where you can (import the env/ modules; build a state with play/toaster-play.mjs createPlayableState(seed) and step it).
3. Look up how StarCraft II does the same area (WebFetch Liquipedia StarCraft II pages; cite the URL). Compare detail by detail.
4. Write three lists: MISSING (StarCraft II has it, GHT does not, with "not found: grep <term>" or file:line as evidence), BROKEN (exists but wrong, inconsistent or contradicted by text the player sees), FINE (exists and works). Mark each MISSING item MUST (a StarCraft-class game can't ship without it) / SHOULD / NICE.
5. ASSOCIATIONS: read the other verify-*.md and web-*.md reports that exist and the chat again; note where your gaps connect to theirs.
6. Post ONE check-in to the chat (under 700 characters): your top 3 MUST items and your best association.
7. Write `reports/2026-10-26/web-<slice>.md` (under 120 lines). Final answer: your 8 most important lines.

**FACT checkers.** Check your slice of research-sc2.md on the web (WebFetch the primary page). A claim is verified only if you saw it on a fetched page: CORRECT / WRONG (right value) / PARTLY / UNVERIFIED, with the URL. Then associations, one chat check-in, and the report, as above.

## Web tip (tested 11:52)
Liquipedia returns 403 to plain page fetches from this Mac, and the Fandom wiki returns 402. What WORKS: the raw wikitext, `https://liquipedia.net/starcraft2/index.php?title=<Page_Title>&action=raw` (e.g. `Barracks_(Legacy_of_the_Void)`), and the API, `https://liquipedia.net/starcraft2/api.php?action=parse&page=<Page_Title>&prop=wikitext&format=json`. Use the "(Legacy_of_the_Void)" page titles. If nothing loads, quote a WebSearch snippet marked "snippet only", or mark UNVERIFIED.

## Rules
Read-only on the game: never edit game code, tests or docs. The only file you write is your own report. One plain command per Bash call. No git, no rm, no npm. The disk on this Mac is nearly full: write nothing else.
