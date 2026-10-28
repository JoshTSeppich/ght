# GHT — Ghosties, Toasties & Broskies

[![GHT CI](https://github.com/JoshTSeppich/ght/actions/workflows/ci.yml/badge.svg)](https://github.com/JoshTSeppich/ght/actions/workflows/ci.yml)

GHT is a browser real-time strategy game in which three factions, the Ghosties, the Toasties and the Broskies, battle
over wheat, water and power. Workers bring in wheat, the kitchen turns it into toast so the army never fights hungry,
and every toaster can only reach as far as its power cord. The game is designed, built and play-tested by a swarm of
AI agents that write the code, review each other's work and run seeded matches against each other's bots.

Formerly Driftfall / Toaster Wars.

## Quick start

Needs Node.js 20.15 or newer.

```sh
npm ci            # install (three.js is the only dependency)
npm test          # run every *.test.mjs in tests/ and play/ with node --test
npm run build     # production build into dist/
npm run preview   # serve dist/ locally, the way a static host would
```

The game itself is `play/index.html`. Serve the repo folder (or run `npm run build` and `npm run preview`) and open it
in a browser. To play one bot against another headless and save the match log:

```sh
node env/run-match.mjs --seed 7 --p0 players/toaster-easy/bot.mjs --p1 players/toaster-hard/bot.mjs --out match.json
```

## Repository layout

| Path | What it holds |
| --- | --- |
| `env/` | The deterministic simulation: rules, stats, economy, combat, pathing, the referee and the match log |
| `play/` | The playable browser client: renderer, HUD, controls, tutorial, menus and the art labs |
| `players/` | Bots: the built-in AI, the toaster difficulty ladder and the GPT exploiter league |
| `maps/` | Map layouts and their design notes |
| `viewer/`, `viewer3d/` | 2D and 3D replay viewers for recorded match logs |
| `live/` | The live TV pages and the build compiler that tests, records a match and publishes status |
| `engine/` | The Coil movement engine (gaits and IK for the units) |
| `assets/` | Sprites, icons, models, audio and their licence records |
| `analytics/` | Per-match statistics from recorded logs |
| `scripts/` | Test runner, build, preview and the balance / league tools |
| `tests/` | The test suite and its fixtures |
| `matches/` | Sample match logs the viewer tests load (live recordings are not tracked) |
| `security/` | Content security policy and the secrets scan for the shipped build |
| `research/`, `docs/`, `reports/` | Design research, outside reads and dated swarm reports |
| `roles/`, `.claude/` | The swarm's role list and agent definitions |
| `rooms/`, `match-room/` | Team room chats (`channel.jsonl`, with `say.mjs` / `read.mjs`) |
| `playtest/`, `promo/`, `concept/` | Playtest checklist, posters and early concept pages |
| `.sandbox-qa/`, `scratch-haiku/` | Agents' QA scratch runs and probes |

The design specs live at the top level: start with `NORTHSTAR.md`, `PLAYABLE.md`, `SYSTEMS-DESIGN.md`, `FACTIONS.md`,
`ECONOMY.md` and `TECH-TREE.md`. Changes are listed in `CHANGELOG.md`.
