// The 60 fps gate's scenario (owner: haiku, Performance). A pure builder, so node tests can check it without a browser:
// the v4 map (128 x 128, maps/driftfall-v4.json through env/map.mjs), both Cores, and N units spread over open floor,
// split evenly between the two sides and point-mirrored. Half of them march across the map at once (the worst case for
// the renderer: every unit moving, every frame), the other half stand still on their tile.
//
//   buildPerfScenario({ seed, units }) -> { state, map, units: [{ id, side, kind, x, y, marching }] }
//   The state is a plain sim state (env/state.mjs createTestState plus the v4 layers the renderer reads).
import { generateMapV4, generateMap } from '../env/map.mjs';
import { createTestState } from '../env/state.mjs';
import { createPlayableState } from './toaster-play.mjs';
import { STATS } from '../env/stats.mjs';
import { POWER } from '../env/power.mjs';

export const PERF_UNITS = 200;
export const PERF_SEED = 7;
const KINDS = ['grunt', 'grunt', 'grunt', 'lancer', 'lancer'];   // 60% melee, 40% ranged, the usual mix

export function buildPerfScenario({ seed = PERF_SEED, units = PERF_UNITS } = {}) {
  if (!Number.isInteger(units) || units < 2 || units % 2) throw new Error('units must be an even count of at least 2');
  const map = generateMapV4(seed);
  const { width, height } = map;
  const taken = new Set([...map.cores.map((c) => `${c.x},${c.y}`)]);
  // Open floor on side 0's half, in reading order, so the even stride spreads the units over the whole half.
  const half = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width / 2; x++) {
      if (map.tiles[y][x] === '.' && !taken.has(`${x},${y}`)) half.push({ x, y });
    }
  }
  const perSide = units / 2;
  if (half.length < perSide) throw new Error(`only ${half.length} open tiles on side 0's half`);
  const chosen = [];
  for (let i = 0; i < perSide; i++) chosen.push(half[Math.floor((i * half.length) / perSide)]);

  const placed = [];
  let nextId = 1 + map.cores.length;
  let i = 0;
  for (const tile of chosen) {
    const kind = KINDS[i % KINDS.length];
    const marching = i % 2 === 0;
    placed.push({ id: nextId++, side: 0, kind, x: tile.x, y: tile.y, marching });
    // point mirror: side 1 is (W-1-x, H-1-y)
    placed.push({ id: nextId++, side: 1, kind, x: width - 1 - tile.x, y: height - 1 - tile.y, marching });
    i++;
  }

  const crystals = map.crystals.map((c) => ({ x: c.x, y: c.y, amount: c.amount }));
  const state = createTestState({
    width, height, seed,
    rocks: map.rocks,
    crystals,
    shards: [0, 0],
    structures: map.cores.map((c, side) => ({ id: side + 1, owner: side, kind: 'core', x: c.x, y: c.y })),
    units: placed.map((p) => ({
      id: p.id, owner: p.side, kind: p.kind, x: p.x, y: p.y,
      order: p.marching ? { type: 'move', x: width - 1 - p.x, y: height - 1 - p.y } : null,
    })),
  });
  // The v4 layers the renderer's terrain, buildings and vents read (the sim reads tiles and heights for the ramp rule).
  state.tiles = map.tiles;
  state.heights = map.heights;
  state.ramps = map.ramps;
  state.vents = map.vents;
  state.rubble = map.rubble;
  return { state, map, units: placed };
}

// --- The real scene: Toaster Wars on Wheatfield (owner: sonnet, PERF). The same match the page plays (createPlayableState,
// the Wheatfield map through generateMap), with synthetic toasters, buildings and cords for the frame-rate measure.
// Pure: no DOM, no three.js, so node tests can check it. play/perf-toaster.mjs mounts it in the browser.
//
//   buildToasterScenario({ seed, units, buildings, points }) -> { state, map, units, buildings, points, cordUnits }
export const TOASTER_PERF_UNITS = 200;
export const TOASTER_PERF_BUILDINGS = 12;
export const TOASTER_PERF_POINTS = 6;
export const TOASTER_KIND_MIX = Object.freeze(['worker', 'grunt', 'lancer', 'brute', 'howler']);   // Crumb, Popper, Zapper, Four-Slice, Broiler
export const TOASTER_BUILDING_MIX = Object.freeze(['mill', 'well', 'toaster', 'forge', 'turret']);
const CORDS_PER_POINT = 4;

export function buildToasterScenario({ seed = PERF_SEED, units = TOASTER_PERF_UNITS, buildings = TOASTER_PERF_BUILDINGS,
  points = TOASTER_PERF_POINTS } = {}) {
  if (!Number.isInteger(units) || units < 2 || units % 2) throw new Error('units must be an even count of at least 2');
  if (!Number.isInteger(buildings) || buildings < 0) throw new Error('buildings must be a count of 0 or more');
  if (!Number.isInteger(points) || points < 1) throw new Error('points must be a count of at least 1');
  const state = createPlayableState(seed);
  const map = generateMap(seed, { map: 'wheatfield' });
  const { width, height } = map;
  // Side 0's half of the open floor, in reading order: points, buildings and units are strided over it.
  const taken = new Set(state.structures.map((s) => `${s.x},${s.y}`));
  const half = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width / 2; x++) {
      if (map.tiles[y][x] === '.' && !taken.has(`${x},${y}`)) half.push({ x, y });
    }
  }
  const stride = (list, n) => Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]);
  const pointTiles = stride(half, points);
  const used = new Set(pointTiles.map((t) => `${t.x},${t.y}`));
  const free = half.filter((t) => !used.has(`${t.x},${t.y}`));
  const buildingTiles = stride(free, buildings);
  for (const t of buildingTiles) used.add(`${t.x},${t.y}`);
  const floor = half.filter((t) => !used.has(`${t.x},${t.y}`));
  const perSide = units / 2;
  if (floor.length < perSide + points * CORDS_PER_POINT) throw new Error('not enough open floor for the scenario');

  // Cords: the nearest open tiles to each power point, so those units can plug into it.
  const cordTiles = [];
  const claimed = new Set();
  for (const p of pointTiles) {
    const near = floor.filter((t) => !claimed.has(`${t.x},${t.y}`))
      .sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)));
    for (const t of near.slice(0, CORDS_PER_POINT)) { claimed.add(`${t.x},${t.y}`); cordTiles.push(t); }
  }
  const rest = floor.filter((t) => !claimed.has(`${t.x},${t.y}`));
  const chosen = [...cordTiles, ...stride(rest, perSide - cordTiles.length)];

  // Side 0 units are the chosen tiles; side 1 mirrors each one through the map centre. Every second unit marches.
  const placed = [];
  let i = 0;
  for (const tile of chosen) {
    const kind = TOASTER_KIND_MIX[i % TOASTER_KIND_MIX.length];
    const marching = i % 2 === 0;
    placed.push({ side: 0, kind, x: tile.x, y: tile.y, marching });
    placed.push({ side: 1, kind, x: width - 1 - tile.x, y: height - 1 - tile.y, marching });
    i++;
  }
  // Keep only the two Strips (cores) from the playable match: the scene is the synthetic set, not the opening.
  state.structures = state.structures.filter((s) => s.kind === 'core');
  state.units = [];
  state.nextId = Math.max(0, ...state.structures.map((s) => s.id)) + 1;
  for (const s of state.structures) s.complete = true;

  const structures = buildingTiles.map((t, k) => ({
    id: state.nextId++, owner: k % 2, kind: TOASTER_BUILDING_MIX[k % TOASTER_BUILDING_MIX.length],
    x: t.x, y: t.y, hp: 100, progress: 0, complete: true, queue: [],
  }));
  state.structures.push(...structures);
  for (const p of pointTiles) {
    state.power.points.push({ id: state.nextId++, owner: 0, kind: 'outlet', x: p.x, y: p.y, range: POWER.range.outlet });
  }
  const unitRows = placed.map((p) => {
    const row = {
      id: state.nextId++, owner: p.side, kind: p.kind, x: p.x, y: p.y,
      hp: STATS.units[p.kind]?.hp ?? 10, carrying: 0,
      order: p.marching ? { type: 'move', x: width - 1 - p.x, y: height - 1 - p.y } : null,
    };
    state.units.push(row);
    return { ...p, id: row.id };
  });
  return { state, map, units: unitRows, buildings: structures, points: state.power.points.slice(-points), cordUnits: cordTiles.length };   // side 0 toasters placed to plug in (side 1 mirrors them)
}

/** Marching units that have reached their order walk back the way they came, so the crowd keeps moving. Mutates state. */
export function keepMarching(state, marchingIds) {
  const ids = new Set(marchingIds);
  for (const u of state.units) {
    if (!ids.has(u.id) || u.order) continue;
    u.order = { type: 'move', x: state.width - 1 - u.x, y: state.height - 1 - u.y };
  }
  return state;
}
