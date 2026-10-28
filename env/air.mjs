// Air Layer (build wave 2, card M4; DECISIONS.md 3). Owner: sonnet (Air lead).
//
// A unit whose stats row says layer: "air" (env/stats.mjs) ignores the ground: it flies in a straight line toward its
// order's destination over rocks, crystals, structures and even enemy fences, and no grounded unit's pathing ever
// treats it as an obstacle (the ground branch of env/movement.mjs skips air-layer units when it blocks tiles). Flyers
// keep their own distance from each other instead: stepAirMovement steps each one straight at its goal and, only when
// another flyer already sits on that exact next tile, tries the next-best heading instead of waiting like a grounded
// unit would (there is no terrain to detour around up here).
//
// Ammo (env/ammo.mjs) still applies the same way: a flyer holds slices and goes hungry when it runs out. The one
// difference is how it gets fed back: no Crumb ever flies a resupply run to one (env/ammo.mjs's assignRuns/
// stepLifeline only look at grounded fighters), so stepAirResupply tops a hungry flyer's slices up directly, straight
// from the side's stock, whenever it is parked at (or right beside) one of its own complete Toasters or Cooling Racks.
//
// Shared contract:
//   stepAirMovement(state)   moves every layer:"air" unit one step closer to its order's destination
//   stepAirResupply(state)   resupplies a hungry flyer parked at a Toaster or Cooling Rack; no Crumb run involved
// Both are called once a tick from env/movement.mjs's stepMovement (the air lead's file), so env/sim.mjs and
// env/sim-territory.mjs need no new wiring.
import { rowOf } from './stats.mjs';
import { distance, emit } from './state.mjs';
import { destinationOf } from './movement.mjs';
import { isAmmoOn, ammoOf, unitState } from './ammo.mjs';
import { isToastOn } from './toast.mjs';

const isAirUnit = (state, u) => rowOf(state, u.kind)?.layer === 'air';

function airSpeed(state, unit) {
  const speed = rowOf(state, unit.kind)?.speed;
  return Number.isInteger(speed) && speed > 0 ? speed : 1;
}

function clearOrder(state, unit) {
  unit.order = null;
  emit(state, { e: 'order', id: unit.id, order: null });
}

const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);
const arrived = (unit, dest) => distance(unit, dest) <= (dest.within ?? 0);

// The direct heading toward the goal first, then the two headings either side of it, so a flyer crowded by its own
// side still makes progress most ticks instead of waiting the way a grounded unit does (there is nothing to detour
// around in the air; the only obstacle is another flyer on the exact tile it wants).
function headingsToward(dx, dy) {
  if (dx === 0 && dy === 0) return [[0, 0]];
  if (dx !== 0 && dy !== 0) return [[dx, dy], [dx, 0], [0, dy]];
  return dx !== 0 ? [[dx, 0], [dx, 1], [dx, -1]] : [[0, dy], [1, dy], [-1, dy]];
}

/** Every layer:"air" unit flies one step toward its order's destination, ignoring all terrain. */
export function stepAirMovement(state) {
  const flyers = state.units.filter((u) => u.hp > 0 && isAirUnit(state, u));
  if (flyers.length === 0) return;
  for (const unit of flyers) {
    const dest = destinationOf(state, unit);
    if (!dest) continue;
    if (arrived(unit, dest)) {
      if (unit.order?.type === 'move') clearOrder(state, unit);
      continue;
    }
    if (state.tick % airSpeed(state, unit) !== 0) continue;

    const dx = sign(dest.x - unit.x);
    const dy = sign(dest.y - unit.y);
    for (const [sx, sy] of headingsToward(dx, dy)) {
      const nx = unit.x + sx;
      const ny = unit.y + sy;
      if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
      if (flyers.some((o) => o !== unit && o.x === nx && o.y === ny)) continue; // another flyer already took this tile
      unit.x = nx;
      unit.y = ny;
      emit(state, { e: 'move', id: unit.id, x: unit.x, y: unit.y });
      if (arrived(unit, dest) && unit.order?.type === 'move') clearOrder(state, unit);
      break;
    }
    // Every heading this tick was taken by another flyer: it simply tries again next moving tick.
  }
}

const RESUPPLY_RADIUS = 1; // tiles from a Toaster or Cooling Rack a flyer counts as "parked" there

function atSupplyBuilding(state, unit) {
  return state.structures.some(
    (s) => s.owner === unit.owner && s.complete && (s.kind === 'toaster' || s.kind === 'coolingRack') && distance(s, unit) <= RESUPPLY_RADIUS,
  );
}

/** Tops a hungry flyer's slices up straight from the side's stock, no Crumb run, while it is parked at a Toaster or Cooling Rack. */
export function stepAirResupply(state) {
  if (!isAmmoOn(state)) return;
  const A = state.ammo;
  for (const unit of state.units) {
    if (unit.hp <= 0 || !isAirUnit(state, unit)) continue;
    const row = ammoOf(unit.kind);
    if (!row) continue; // unarmed (the Crouton Kite carries no weapon)
    if (unitState(state, unit) !== 'hungry') continue;
    if (!atSupplyBuilding(state, unit)) continue;
    const have = A.slices[unit.id] ?? row.slots;
    const need = row.slots - have;
    if (need <= 0) continue;
    const side = unit.owner;
    const stockLeft = isToastOn(state) ? state.toast.stack[side] : A.stock[side];
    const give = Math.min(need, Math.max(0, stockLeft));
    if (give <= 0) continue;
    if (isToastOn(state)) state.toast.stack[side] -= give;
    else A.stock[side] -= give;
    A.slices[unit.id] = have + give;
    emit(state, { e: 'resupply', player: side, id: unit.id, unit: unit.id, slices: give, left: A.slices[unit.id] });
  }
}
