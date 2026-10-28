// Movement phase (ENV-SPEC §6, §8).
//
// Each tick, every unit with an order that has somewhere to go takes one step along a fresh breadth-first path.
// Units are visited one at a time in id order: lowest id first on even ticks, highest id first on odd ticks.
// Planning ignores units; the actual step is only taken if the next tile is free right now (rocks, crystals,
// structures and other units all block, and a unit that already moved this tick counts at its new tile).
// A unit whose next tile is taken simply waits this tick. If it is still blocked by a unit on its next moving
// tick, it looks for a detour that treats standing units as obstacles and takes that instead; when no detour
// exists (two units head-on in a one-tile gap) it keeps waiting, as §6 says. Once on a detour the unit keeps
// planning around other units until it arrives, so it never walks straight back into the unit that blocked it
// (an idle unit parked on the shortest path would otherwise trap it in a two-tile shuffle forever). Brutes
// (speed 2) only move on even ticks.
//
// A move order ends when the unit stands on its target tile. Any order whose destination cannot be reached
// at all (walled off by rocks, crystals or structures) is cleared and a `blocked` event is logged.

import { findPath } from './path.mjs';
import { createFieldCache, findPathCached, findPathAround } from './path-field.mjs';
import { STATS, rowOf } from './stats.mjs';
import { findEntity, isPassable, distance, emit } from './state.mjs';
import { fenceBlocker, stepFences } from './fence.mjs';
import { stepAirMovement, stepAirResupply } from './air.mjs';

/** Look up the stats row for a unit kind. Tolerates the common table layouts. */
function unitStats(kind) {
  if (!STATS || typeof STATS !== 'object') return null;
  return STATS.units?.[kind] ?? STATS.unit?.[kind] ?? STATS[kind] ?? null;
}

function unitSpeed(unit, state) {
  const speed = (state ? rowOf(state, unit.kind) : unitStats(unit.kind))?.speed;
  return Number.isInteger(speed) && speed > 0 ? speed : 1;
}

function unitRange(unit, state) {
  const range = (state ? rowOf(state, unit.kind) : unitStats(unit.kind))?.range;
  return Number.isInteger(range) && range >= 0 ? range : 1;
}

// Air Layer (DECISIONS.md 3): a layer:"air" unit flies its own way (env/air.mjs stepAirMovement) and never blocks, or
// is blocked by, the ground below it. Every ground collision check in this file goes through isGroundFree/
// groundObstacles instead of counting a flyer's tile as taken.
const isAirUnit = (state, u) => (state ? rowOf(state, u.kind) : unitStats(u.kind))?.layer === 'air';

/** Like env/state.mjs isFree, but a flyer standing on the tile never counts: ground pathing ignores the air layer. */
function isGroundFree(state, x, y) {
  return isPassable(state, x, y) && !state.units.some((u) => u.x === x && u.y === y && !isAirUnit(state, u));
}

/** The side's Core, or null if it has been destroyed. */
function coreOf(state, player) {
  let best = null;
  for (const s of state.structures) {
    if (s.owner === player && s.kind === 'core' && (best === null || s.id < best.id)) best = s;
  }
  return best;
}

/**
 * Where a unit wants to be for its current order.
 *
 * Returns `{ x, y, within }` meaning "any tile within distance `within` of (x, y)" (`within` 0 means the tile
 * itself), or `null` when the unit has nowhere to go (no order, a mining Worker, a target that no longer exists).
 *
 * - move:   the ordered tile, within 0.
 * - attack: the target's tile, within the unit's range.
 * - gather: next to the crystal tile while heading out or mining; next to the own Core while carrying back.
 * - build:  next to the construction site.
 */
export function destinationOf(state, unit) {
  const order = unit?.order;
  if (!order || typeof order !== 'object') return null;

  switch (order.type) {
    case 'move':
      if (!Number.isInteger(order.x) || !Number.isInteger(order.y)) return null;
      return { x: order.x, y: order.y, within: 0 };

    case 'attack': {
      const target = findEntity(state, order.target);
      if (!target) return null;
      return { x: target.x, y: target.y, within: unitRange(unit, state) };
    }

    case 'gather': {
      if (order.phase === 'toCore') {
        const core = coreOf(state, unit.owner);
        if (!core) return null;
        return { x: core.x, y: core.y, within: 1 };
      }
      if (!Number.isInteger(order.x) || !Number.isInteger(order.y)) return null;
      return { x: order.x, y: order.y, within: 1 };
    }

    case 'build': {
      const site = findEntity(state, order.site);
      if (!site) return null;
      return { x: site.x, y: site.y, within: 1 };
    }

    default:
      return null;
  }
}

function arrived(unit, dest) {
  return distance(unit, dest) <= dest.within;
}

function clearOrder(state, unit) {
  unit.order = null;
  emit(state, { e: 'order', id: unit.id, order: null });
}

// Units that were held up by another unit on their last moving tick, and units currently on a detour. Both are
// kept outside the unit records so that observations, logs and record comparisons never see them; they only
// decide whether this unit plans around other units this tick.
const fieldCaches = new WeakMap(); // per match: goal distance fields (env/path-field.mjs)
const wallIds = new WeakMap(); // fence tile Set -> small id
let nextWallId = 1;
function wallsIdOf(walls) {
  if (!walls) return 0;
  if (!walls.tiles) return -1; // unknown walls: never cached
  let id = wallIds.get(walls.tiles);
  if (!id) wallIds.set(walls.tiles, (id = nextWallId++));
  return id;
}

let occupied = null; // scratch: 1 on every tile another unit stands on, cleared after each use

function fieldCacheOf(state) {
  let cache = fieldCaches.get(state);
  if (!cache) fieldCaches.set(state, (cache = createFieldCache()));
  return cache;
}

// Where every unit stands, as a short string. Units stuck in a jam stand still for many ticks, and the detour fields are
// shared for as long as nothing moves.
function unitsSignature(state) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (const u of state.units) {
    a = Math.imul(a ^ ((u.x << 12) ^ u.y), 0x01000193) >>> 0;
    b = Math.imul(b + ((u.y << 12) ^ u.x) + 1, 0x85ebca6b) >>> 0;
  }
  return state.units.length + ':' + a.toString(36) + b.toString(36);
}

/**
 * findPath over the unit's grid with every other unit's tile blocked too, for detours. The field is built with all units
 * blocked, the asking unit's own tile included: its search never revisits where it starts, so the answer is the same.
 */
function detourPath(state, unit, solid, grid, wallsId, from, goal, within) {
  if (wallsId < 0) return findPath(avoidingUnits(state, unit, grid.mask), from, goal, { within });
  // First try the cheap walk down the unobstructed field; it answers whenever a route as short as that one is still open.
  const w = state.width;
  if (!occupied || occupied.length < w * state.height) occupied = new Uint8Array(w * state.height);
  const cells = [];
  for (const u of state.units) {
    if (u === unit || isAirUnit(state, u) || u.x < 0 || u.y < 0 || u.x >= w || u.y >= state.height) continue;
    occupied[u.y * w + u.x] = 1;
    cells.push(u.y * w + u.x);
  }
  const around = findPathAround(fieldCacheOf(state), solid, wallsId, grid, occupied, from, goal, within);
  for (const c of cells) occupied[c] = 0;
  if (around !== undefined) return around;
  const crowded = { width: state.width, height: state.height, make: () => avoidingUnits(state, null, grid.mask) };
  return findPathCached(fieldCacheOf(state), solid, 'u' + unitsSignature(state) + '|' + wallsId, crowded, from, goal, within);
}

const waiting = new WeakSet();
const detouring = new WeakSet();

function forget(unit) {
  waiting.delete(unit);
  detouring.delete(unit);
}

/** Units sorted for this tick: lowest id first on even ticks, highest id first on odd ticks (§8). */
function unitsInTickOrder(state) {
  const units = state.units.slice().sort((a, b) => a.id - b.id);
  if (state.tick % 2 !== 0) units.reverse();
  return units;
}

/**
 * Run the movement phase on `state` in place. Emits `move`, `blocked` and `order` events.
 */
export function stepMovement(state) {
  // Air Layer (DECISIONS.md 3): flyers move and get resupplied their own way, entirely apart from the ground logic
  // below (neither env/sim.mjs nor env/sim-territory.mjs need to know about them).
  stepAirMovement(state);
  stepAirResupply(state);

  // Rocks, crystals and structures do not change during this phase, so they are flattened to a bitmap once. The old
  // per-tile isPassable() scanned every crystal and structure inside every path search (80% of a bot match's time).
  // Built on first use, so a tick with nothing to path costs nothing.
  let solidBits = null;
  const getSolid = () => (solidBits ??= solidMap(state));
  // The planning grid for a unit: rocks, crystals, structures and (when fences are on) the enemy's live fence tiles as one
  // byte mask. One grid per distinct set of fence tiles per tick.
  const grids = new Map();
  const gridFor = (walls) => {
    const tiles = walls ? walls.tiles ?? walls : null;
    let g = grids.get(tiles);
    if (!g) {
      const mask = walls ? wallMask(state, getSolid(), walls) : getSolid();
      g = { width: state.width, height: state.height, mask, blocked: (x, y) => mask[y * state.width + x] === 1, walls };
      grids.set(tiles, g);
    }
    return g;
  };
  // Power fences (env/fence.mjs): live enemy ground lines are walls for this unit. Null unless fences are on.
  stepFences(state);
  const fences = fenceBlocker(state);
  let grid = null;

  for (const unit of unitsInTickOrder(state)) {
    // The unit may have been removed by an earlier phase; never move a ghost.
    if (!unit || unit.hp <= 0) continue;
    if (isAirUnit(state, unit)) continue; // already moved above, its own way
    const walls = fences && fences(unit);

    const dest = destinationOf(state, unit);
    if (!dest) {
      forget(unit);
      continue;
    }

    if (arrived(unit, dest)) {
      forget(unit);
      if (unit.order.type === 'move') clearOrder(state, unit);
      continue;
    }

    // Brutes (speed 2) only step on even ticks; everyone else every tick.
    if (state.tick % unitSpeed(unit, state) !== 0) continue;

    const from = { x: unit.x, y: unit.y };
    const goal = { x: dest.x, y: dest.y };
    grid = gridFor(walls);
    const wallsId = wallsIdOf(walls);
    const path = wallsId >= 0 ? findPathCached(fieldCacheOf(state), getSolid(), wallsId, grid, from, goal, dest.within ?? 0) : findPath(grid, from, goal, { within: dest.within });
    if (!path || path.length === 0) {
      // Walled off: nowhere to go, ever. Drop the order and say so.
      forget(unit);
      emit(state, { e: 'blocked', id: unit.id });
      clearOrder(state, unit);
      continue;
    }

    let next = path[0];
    if (detouring.has(unit)) {
      // Already on a detour: keep planning around other units so the plain path cannot lead straight back into
      // the unit that blocked it. If no detour exists any more, the plain path below is used as usual.
      const detour = detourPath(state, unit, getSolid(), grid, wallsId, from, goal, dest.within ?? 0);
      if (detour && detour.length > 0) next = detour[0];
    }
    if (!isGroundFree(state, next.x, next.y)) {
      // Someone is standing there. First time: just wait. Still blocked next moving tick: try a detour that
      // treats every other unit as an obstacle. No detour (head-on in a gap): keep waiting.
      const detour = waiting.has(unit) ? detourPath(state, unit, getSolid(), grid, wallsId, from, goal, dest.within ?? 0) : null;
      if (!detour || detour.length === 0) {
        waiting.add(unit);
        continue;
      }
      next = detour[0];
      detouring.add(unit);
    }

    waiting.delete(unit);
    unit.x = next.x;
    unit.y = next.y;
    emit(state, { e: 'move', id: unit.id, x: unit.x, y: unit.y });

    if (arrived(unit, dest)) {
      forget(unit);
      if (unit.order.type === 'move') clearOrder(state, unit);
    }
  }
}

/** A planning grid where other units' tiles count as blocked too (used only for detours). `base` is the unit's own mask. */
function avoidingUnits(state, self, base) {
  const w = state.width;
  const mask = base.slice();
  for (const u of state.units) if (u !== self && !isAirUnit(state, u) && u.x >= 0 && u.y >= 0 && u.x < w && u.y < state.height) mask[u.y * w + u.x] = 1;
  return { width: w, height: state.height, mask, blocked: (x, y) => mask[y * w + x] === 1 };
}

const wallCells = new WeakMap(); // fence tile Set -> the in-bounds cell indexes it names (the Set is immutable while cached)

/** The solid mask plus the enemy fence tiles, as a new mask. */
function wallMask(state, solid, walls) {
  const w = state.width;
  const mask = solid.slice();
  if (!walls.tiles) {
    for (let y = 0; y < state.height; y++) for (let x = 0; x < w; x++) if (walls(x, y)) mask[y * w + x] = 1;
    return mask;
  }
  let cells = wallCells.get(walls.tiles);
  if (!cells || cells.w !== w || cells.h !== state.height) {
    const list = [];
    for (const k of walls.tiles) {
      const comma = k.indexOf(',');
      const x = +k.slice(0, comma);
      const y = +k.slice(comma + 1);
      if (x >= 0 && y >= 0 && x < w && y < state.height) list.push(y * w + x);
    }
    cells = { w, h: state.height, list };
    wallCells.set(walls.tiles, cells);
  }
  for (const c of cells.list) mask[c] = 1;
  return mask;
}

/** 1 for every tile isPassable() would refuse (rock, crystal, structure), 0 elsewhere; callers stay in bounds. */
function solidMap(state) {
  const w = state.width;
  const solid = new Uint8Array(w * state.height);
  for (const k of state.rockSet) {
    const comma = k.indexOf(',');
    const x = +k.slice(0, comma);
    const y = +k.slice(comma + 1);
    if (x >= 0 && y >= 0 && x < w && y < state.height) solid[y * w + x] = 1;
  }
  for (const c of state.crystals) if (c.x >= 0 && c.y >= 0 && c.x < w && c.y < state.height) solid[c.y * w + c.x] = 1;
  for (const t of state.structures) if (t.x >= 0 && t.y >= 0 && t.x < w && t.y < state.height) solid[t.y * w + t.x] = 1;
  return solid;
}
