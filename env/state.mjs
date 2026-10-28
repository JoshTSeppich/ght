// Game state: creation, lookups, tile tests and the player's observation.
// Shape and rules: ENV-SPEC.md §2, §10, §13, §14. Numbers come from env/stats.mjs.
import { STATS, kindStats } from './stats.mjs';
import { generateMap } from './map.mjs';

// Full hit points for any kind (unit, structure or core), from the stats table.
function maxHpOf(kind) {
  return kindStats(kind).hp;
}

function copyOrder(order) {
  return order ? { ...order } : null;
}

// opts.map names the map (env/map.mjs); the default is the classic 32 x 32 one unless the caller chooses.
export function createInitialState(seed, opts = {}) {
  const map = generateMap(seed, { map: opts.map });
  const state = {
    tick: 0,
    seed,
    width: map.width,
    height: map.height,
    rocks: map.rocks.map(([x, y]) => [x, y]),
    rockSet: new Set(map.rocks.map(([x, y]) => `${x},${y}`)),
    crystals: map.crystals.map((c) => ({ x: c.x, y: c.y, amount: c.amount })),
    shards: [STATS.match.startShards, STATS.match.startShards],
    nextId: 1,
    units: [],
    structures: [],
    events: [],
    result: null,
  };

  // Ids follow spec §13: Core 0 = 1, Core 1 = 2, side 0 Workers 3–6, side 1 Workers 7–10.
  for (let side = 0; side < 2; side++) {
    const core = map.cores[side];
    state.structures.push({
      id: allocId(state), owner: side, kind: 'core', x: core.x, y: core.y,
      hp: STATS.core.hp, progress: 0, complete: true, queue: [],
    });
  }
  for (let side = 0; side < 2; side++) {
    for (const tile of map.workers[side]) {
      state.units.push({
        id: allocId(state), owner: side, kind: 'worker', x: tile.x, y: tile.y,
        hp: STATS.units.worker.hp, carrying: 0, order: null,
      });
    }
  }
  return state;
}

// Hand-built state for tests. Units and structures are given as plain records; any missing hp, carrying,
// order, progress, complete or queue gets its usual starting value. Missing ids are filled in.
export function createTestState({ width, height, rocks = [], crystals = [], shards = [0, 0], units = [], structures = [], tick = 0, seed = 0 } = {}) {
  const state = {
    tick,
    seed,
    width,
    height,
    rocks: rocks.map(([x, y]) => [x, y]),
    rockSet: new Set(rocks.map(([x, y]) => `${x},${y}`)),
    crystals: crystals.map((c) => ({ x: c.x, y: c.y, amount: c.amount })),
    shards: [shards[0], shards[1]],
    nextId: 1,
    units: [],
    structures: [],
    events: [],
    result: null,
  };

  const givenIds = [...units, ...structures].map((e) => e.id).filter((id) => Number.isInteger(id));
  state.nextId = givenIds.length ? Math.max(...givenIds) + 1 : 1;

  for (const u of units) {
    state.units.push({
      id: Number.isInteger(u.id) ? u.id : allocId(state),
      owner: u.owner, kind: u.kind, x: u.x, y: u.y,
      hp: u.hp ?? maxHpOf(u.kind),
      carrying: u.carrying ?? 0,
      order: copyOrder(u.order ?? null),
    });
  }
  for (const s of structures) {
    const complete = s.complete ?? true;
    state.structures.push({
      id: Number.isInteger(s.id) ? s.id : allocId(state),
      owner: s.owner, kind: s.kind, x: s.x, y: s.y,
      hp: s.hp ?? (complete ? maxHpOf(s.kind) : 1),
      progress: s.progress ?? 0,
      complete,
      queue: s.queue ? [...s.queue] : [],
    });
  }
  state.units.sort((a, b) => a.id - b.id);
  state.structures.sort((a, b) => a.id - b.id);
  return state;
}

export function findEntity(state, id) {
  return state.units.find((u) => u.id === id) ?? state.structures.find((s) => s.id === id) ?? null;
}

export function unitsOf(state, player) {
  return state.units.filter((u) => u.owner === player);
}

export function structuresOf(state, player) {
  return state.structures.filter((s) => s.owner === player);
}

function inBounds(state, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < state.width && y < state.height;
}

// True when the tile is on the map and has no rock, crystal or structure (units are ignored).
export function isPassable(state, x, y) {
  if (!inBounds(state, x, y)) return false;
  if (state.rockSet.has(`${x},${y}`)) return false;
  if (state.crystals.some((c) => c.x === x && c.y === y)) return false;
  if (state.structures.some((s) => s.x === x && s.y === y)) return false;
  return true;
}

// True when the tile is passable and no unit stands on it.
export function isFree(state, x, y) {
  return isPassable(state, x, y) && !state.units.some((u) => u.x === x && u.y === y);
}

// Distance in tiles: the larger of the horizontal and vertical gap (spec §6).
export function distance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

// Next free id. Ids only go up and are never reused (spec §13).
export function allocId(state) {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

// Adds an event to this tick's list (cleared at the start of each step).
export function emit(state, event) {
  state.events.push(event);
}

// What one player is allowed to see: a fresh deep copy shaped as in spec §10. Nothing else leaks through.
export function observe(state, player) {
  const obs = baseObservation(state, player);
  // GHT (a territory match with hunger on): your own kitchen and the map's spring wells, so a bot can place a
  // Well and see its toast. Nothing about the other side is added.
  if (state.bakery && state.toast) {
    obs.kitchen = {
      toast: state.toast.stack[player], flour: state.toast.pantry[player].flour, water: state.toast.pantry[player].water,
      wells: (state.springs || []).map(([x, y]) => [x, y]),
    };
  }
  // Your own Extension Boxes and Generators (a cord is only as long as the last box), so a bot can see its chain. Never the enemy's.
  if (state.power && Array.isArray(state.power.points)) {
    obs.power = {
      points: state.power.points.filter((p) => p.owner === player).map((p) => ({ id: p.id, kind: p.kind, x: p.x, y: p.y, range: p.range })),
      // Your own units whose cord is cut ('battery' = running out, 'down' = dead until a Crumb plugs it back in).
      // Your own units whose last move or attack was refused by the cord (reason 'cord' | 'down' | 'stuck', the tile or target it was heading for).
      refused: state.units.filter((u) => u.owner === player && u.hp > 0 && u.power && u.power.refused).map((u) => ({ id: u.id, ...u.power.refused })),
      energy: state.energy ? { ...state.energy.report[player] } : null, // { made, used, shed } (env/energy.mjs)
      cut: state.units.filter((u) => u.owner === player && u.hp > 0 && u.power && (u.power.state === 'battery' || u.power.state === 'down')).map((u) => ({ id: u.id, state: u.power.state })),
    };
  }
  return obs;
}

function baseObservation(state, player) {
  return {
    tick: state.tick,
    you: player,
    width: state.width,
    height: state.height,
    rocks: state.rocks.map(([x, y]) => [x, y]),
    crystals: state.crystals.map((c) => ({ x: c.x, y: c.y, amount: c.amount })),
    // Wheat is the player-facing name for shards (PLAYABLE item 2). `shards` stays as an alias for old bots and tests.
    wheat: [state.shards[0], state.shards[1]],
    shards: [state.shards[0], state.shards[1]],
    units: state.units.map((u) => ({
      id: u.id, owner: u.owner, kind: u.kind, x: u.x, y: u.y, hp: u.hp,
      carrying: u.carrying, order: copyOrder(u.order),
    })),
    structures: state.structures.map((s) => ({
      id: s.id, owner: s.owner, kind: s.kind, x: s.x, y: s.y, hp: s.hp,
      progress: s.progress, complete: s.complete, queue: [...s.queue],
    })),
    unitCap: STATS.match.unitCap,
    // the limit this match really runs to (the live match sets 21600); STATS only when the state has none (env/sim.mjs maxTicksOf)
    maxTicks: Number.isInteger(state.maxTicks) && state.maxTicks > 0 ? state.maxTicks : STATS.match.maxTicks,
  };
}
