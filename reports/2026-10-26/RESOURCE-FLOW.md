# How the resources go together (Joshua, 14:54; checked against the code 2026-10-26)

Everything turns into one thing: toast, the army's ammunition. A fighter without slices cannot shoot.

- Wheat is the money. Crumbs mine it (5 Wheat per 200 ticks, about 28 a minute each with walking) into the bank. Every unit and building costs Wheat; the army also costs 5% of its value a minute in upkeep.
- Flour: a Mill takes 10 Wheat from the bank every 20 s and makes 1 Flour (3 a minute).
- Water: a Well makes about 10 a minute by itself, no workers, if it stands within 4 tiles of water; Wells closer than 8 tiles share (rate = 10 / (1 + sum of (1 - d/8))). No Well within 6 tiles of an enemy building.
- Power: Power Strip 2, Windmill 3, Dam 6, Mill Dam 14; a Toaster uses 2. Power reaches buildings through cords (Extension Box 12 tiles, Relay Pylon).
- Toaster: while powered, turns 1 Flour + 1 Water into 4 slices every 5 s. Pantry holds 6 Flour and 6 Water plus 3 per Toaster.
- Toast: Crumbs carry slices (2 per run) to fighters; a slice is 3 shots for Popper, Zapper, Flak Popper and Broiler; a Four-Slice volley spends 4 slices; the Bagel needs power but no toast.
- Tiers on /play (button-enforced only, today): tier 2 opens with a complete Toaster (Assembly Line, Popper, Zapper, Flak Popper, Relay Pylon); tier 3 opens with a Windmill or Dam (Four-Slice, Broiler, Bagel, Mill Dam).

Known imbalance: one running Toaster burns 12 Flour a minute, four Mills' worth, about 70% of six Crumbs' Wheat. Toast is the real limit on fighting.
