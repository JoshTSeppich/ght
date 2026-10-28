# Crosscurrent (`ladder`)

132 columns by 148 rows, with rotational symmetry: `(x,y) → (131-x,147-y)`.
The opening ground route crosses two ridges through opposite seven-tile passages.
No random scatter changes competitive routes, resource access or spawn fairness.

| Feature | Side 0 | Side 1 |
| --- | --- | --- |
| Main / Power Strip | 20,18 | 111,129 |
| Natural / Outlet spot | 40,27 | 91,120 |
| Third | 72,24 | 59,123 |
| First Extension Box | 31,23 | 100,124 |
| Ridge passage | 97–103,47–51 | 28–34,96–100 |

The natural is 20 tiles from the main using the simulation's Chebyshev distance
(about 22 tiles in a straight line). One Extension Box connects the main to an
Outlet at the natural. `extras.bases[side].cord` describes both placements.
The shortest opening walk to within one tile of the enemy Strip is 326 steps:
**40.75 seconds** at the live Popper's three ticks per step and 24 ticks per second.
This measures walking on the initial terrain; an attacking army also needs its
normal power chain and toast supply.

Each main, natural and third has eight Wheat tiles, with 1,800 Wheat per tile.
Each main has a small pond; each natural and third has a spring for a Well.
Two golden fields, with eight double-yield tiles each, sit in rock enclosures.
A Crumb can push the single entrance rock inward to open the mining approach.
`extras.gold` names the entrance, standing tile and mining approach for each side.
The tests verify both blocked access before clearing and a real successful push.

All eight `G` sockets are usable Windmill energy pads. Coordinates are
`24,26`, `44,34`, `74,32`, `106,36`, plus their rotational mirrors.
`enableEnergy()` selects these pads on the 132×148 map. Existing Wheatfield pads
and other maps retain their prior behavior.

Two neutral watchtower sites stand at `83,62` and `48,85`. Their map records
declare a two-tile occupation radius and twelve-tile sight. The exported
`watchtowerSources(state, side)` helper grants a source only when living ground
units from exactly one side occupy the radius. Contested towers grant neither
side sight. **The map supplies sites and tested occupation logic; the live vision
and drawing hooks still need their owning files updated.** The helper expects
`state.watchtowers = generateMap(seed, {map:'ladder'}).watchtowers`; its `sight`
field must be honored when merging these sources into vision.

## Outlet

Send `place-power` with `kind: 'outlet'`, an adjacent plugged Crumb, and a linked
free tile. The Outlet costs **100 Wheat**, completes immediately like other power
stations, and anchors/links at range 10. It is a real targetable structure using
the existing `core` simulation row, with `powerKind: 'outlet'` and `name: 'Outlet'`.
That lets the existing worker training, resource drop-off, combat and building
enumeration systems include it. Both power station enumerators return `outlet`.
Destroying it removes its power anchor. It does not create an independent energy
source: keep it connected to the main or to a generator.

Live command tests walk a Crumb through the natural cord route, build an Outlet,
train a new Crumb, deposit Wheat locally, and check its destroyed anchor disappears.
Refused placements leave the bank unchanged. The build-button/label hookup is
still needed in the UI owner's files; observations currently serialize its
simulation kind as `core`.

## Start and verify

Open `/play?map=ladder`, or create a scripted match:

```js
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { enableEnergy } from '../env/energy.mjs';
const state = createTerritoryMatch(42, { map: 'ladder' });
enableEnergy(state);
```

For existing scripts that use the default map picker, set `DRIFTFALL_MAP=ladder`.
The default map has not changed. `loadMapV4('ladder')`, `generateMap(seed,
{map:'ladder'})` and `reachLayoutV4('ladder')` are all supported. Nine Reaches have
roles main, natural, third and flank for each side, plus the neutral centre.
`extras.bases`, `extras.energySites`, `extras.gold` and `watchtowers` are available
for bots and presentation code.

Run `node --test maps/ladder.test.mjs` separately: the shared full-suite runner
currently discovers only tests under `tests/` and `play/`.

The existing toaster-hard `expand` personalities were probed against each other
for three simulated minutes, seed 42, normal power/wrap/energy enabled. Both built
a Mill, Well and Toaster with zero rejected commands, but neither built an Outlet
or claimed a natural. **Both-bot natural expansion remains blocked on A2.** This
card changes no player files. A5 owns adding the map to the start menu; the vision
owner must wire tower sight, and the UI owner must expose Outlet construction.
