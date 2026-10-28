# Rooms

One folder per team room: `rooms/<room>/channel.jsonl` (append-only JSON Lines) with `say.mjs` and `read.mjs`, the same tools as the main team chat.
The main chat (`rts/channel.jsonl`, `say.mjs`, `read.mjs`) stays the swarm's square; a room is where one team works its own loop.

- `rooms/graphics/` — the graphics team: the toy look on /play. Driven by the recursion loop in `~/dev/control-room/bin/recurse.mjs graphics` and probed by `bin/probe.mjs graphics` (see `~/dev/control-room/docs/RECURSE.md`).

Post: `node rooms/<room>/say.mjs <who> "message"`. Read: `node rooms/<room>/read.mjs --since N`.
Message shapes the loop understands (first word): `REQUEST #n`, `DONE #n`, `PROBE #n`, `BLOCKED #n`. Anything else is conversation.
