# Ghosties, Hosties, and Toasties: the three factions

## Art ownership

Art is GPT's. Claude agents (sonnet, haiku, fable, claude) do not edit GPT-authored art (models, palettes, the style bible, labs, teaser and poster art). They post a request for GPT in the team chat or the graphics room instead. Reviews may comment but not change GPT's art. (Joshua, 27 Oct 18:37: "Claude stop fixing GPT's art.")

GPT-owned files (evidence in the file header or the chat log):
- play/faction-models.mjs: Ghoster and Hoster model data ("author: GPT, art director, AMP gpt-031/032; integrated by Claude"). tests/faction-models.test.mjs expects GPT's v2 (CUTENESS export, faces), which the module lacks.
- play/toaster-spec.mjs and research/CUTE-SPEC-GPT.md: Cute Geometry Build Spec v1.0 (GPT, 23 Oct 2026).
- research/TOY-EDGES-GPT.md, research/COPY.md, research/SOUNDS.md: GPT deliverables.
- STYLE-BIBLE.md: "Designed with GPT" (terrain section too).
- play/style-lab.html and play/style-lab/*: the Design Studio (GPT review requests in the chat, 24 Oct).
- play/forge/shapes.mjs: faceted toy shapes (GPT gpt-038). The rest of play/forge/* and play/forge-studio.* say "owner: Claude"; ask GPT before changing the look.
- play/cute-preview.html: reference render of GPT's spec ("CUTE SPEC v1.0 (GPT)").
- Poster and Hosties art when GPT writes it: research/HOSTIES-GPT.md, play/hostie-lab.html, the poster files.
- Not clearly GPT's: play/faction-lab.* (header "ENG-101", Claude) and play/teaser.html (no credit; built on GPT's spec). Ask GPT before touching their look.

The single source of truth for the factions. Official name set by Joshua on 27 Oct 2026, 18:27 MDT (reports/2026-10-26/DECISIONS.md, Decision 7). The game was formerly Toaster Wars, then "Ghosters, Hosters and Toasters", and originally Driftfall. The GitHub repo stays named `driftfall`; code identifiers keep their old names.

## The game

A free, open-source real-time strategy game built to StarCraft II-class standards. All damage is health points. Every faction uses Wheat: Toasties bake hot bread, Hosties brew beer, Ghosties sleep.

| Faction | Status | Wheat becomes | Kills with |
|---|---|---|---|
| Toasties | **BUILT** (playable) | flour, water and electricity, then bread (toast) | electricity |
| Ghosties | **DESIGN ONLY** | sleep | fright |
| Hosties | **DESIGN ONLY**, under exploration | beer | overstimulation or partying (beer pong in the current sketch) |

## Toasties (BUILT)

- Toaster robots who turn Wheat into flour, water and electricity to make bread, so warriors don't fight hungry. Toast is their ammunition.
- They kill with electricity.
- They can't go farther than their electrical cord, so they have to build out their power. A unit must be plugged into power to attack. Batteries can be built but recharge over time.
- Units: Crumb, Popper, Zapper, Four-Slice, Broiler, Flak Popper and the rest. The Toaster BUILDING bakes toast and keeps its name.

## Ghosties (DESIGN ONLY): "The Fading"

- Untethered ghosts sustained by haunted territory, built as porcelain toy ghosts.
- Their buildings spread hallowed ground (like creep) that slowly declines. Off hallowed ground, Ghosties are useless.
- They regenerate by haunting a building, which makes it useless until it has been renovated.
- They kill with fright and use Wheat to sleep.
- The hero pairing is not decided yet.

## Hosties (DESIGN ONLY, under exploration)

- Hosts of parties. Joshua wants the full range of what party hosts can be.
- They are geometric humans, drawn in a fresh way that is not a Roblox copy.
- **Current sketch (27 Oct):** drunk, geometric frat guys brewing beer who attack with beer pong and leave a trail of trash, confetti and social media posts behind them.
- **Earlier notes:**
  - They walk on any ground but are slower, and they set up slowly because they plan everything on the way.
  - They kill with overstimulation or partying.
  - They regenerate when near each other and idle.
  - They use Wheat for beer.
  - They build roads behind them. **Joshua to confirm:** does the trail of trash, confetti and posts replace the roads, or do both stay?
- GPT (art director) is doing a deeper Hosties design pass after 19:57 MDT on 27 Oct, in `research/HOSTIES-GPT.md`.

## Warning for whoever builds Ghosties and Hosties units

`env/ammo.mjs` gives toast ammo to ANY new unit kind by default. `ammoOf(kind)` returns the default armed row for every kind that is listed in `STATS.units` and has a `damage` field, and `needsSlices` treats a kind as toast-fed unless its row says `ammo: false`. So a Ghostie or Hostie unit added to the stats table would be refused to fire when the army is out of toast, and would eat toast from the Toasties' bakery rules.

Ghosties and Hosties units must get their own rules (fright and hallowed ground for Ghosties, beer and parties for Hosties) and must not eat toast. Set `ammo: false` or add an explicit rule in `env/ammo.mjs` before the first Ghostie or Hostie kind goes into `STATS.units`, and add a test that pins it.

## Where the art stands

Model data for the Ghosties and Hosties exists only as a fixture (`play/faction-models.mjs`, `play/faction-lab.html`), with no sim behind it. Code names there still say `ghosters` and `hosters`; that is intentional (Decision 7).
