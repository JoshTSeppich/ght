// The cord leash (NORTHSTAR 2): no toaster goes farther than its cord from a power point, and the battery grace is only
// for a unit whose anchor was destroyed or whose cord an enemy cut. Owner: sonnet. Tests first.
//
// The reporter's setup (reports/2026-10-24/chain2.mjs): a playable match runs past its 2000-tick limit (checkEnd sets a
// result, so the sim skips stepRulesPost, which is where the cord check used to run), then a Popper walks out of range.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { step } from '../env/sim.mjs';
import { enablePower, enforceCords, POWER, cordLength } from '../env/power.mjs';
import { createPlayableState } from '../play/toaster-play.mjs';

const NONE = [[], []];

// The tiles a unit of `owner` may stand on: within its cord of a live point that has range (range 0 never anchors).
function anchorsOf(state, owner) {
  const pts = [];
  for (const s of state.structures) if (s.kind === 'core' && s.owner === owner && s.hp > 0) pts.push(s);
  for (const c of state.claims || []) if (c.owner === owner && c.complete && c.hp > 0 && !c.dead) pts.push(c);
  for (const p of state.power.points) if (p.owner === owner && p.hp !== 0 && (p.range ?? 0) > 0) pts.push(p);
  return pts;
}
const reachOf = (state, u) => Math.min(...anchorsOf(state, u.owner).map((p) => Math.max(Math.abs(p.x - u.x), Math.abs(p.y - u.y))));
const inCord = (state, u) => reachOf(state, u) <= cordLength(u.kind);

// Steps n ticks, returning every event and the first tick a plugged unit stood out of cord (or -1). The check is per
// tick while the match runs. Once a match has a result the sim skips the end-of-tick check (env/sim.mjs), so a move
// there is checked at the start of the next tick: one settle step with no orders, then the end position is checked.
function walk(state, n, id) {
  const events = [];
  let outAt = -1;
  const out = () => { const u = state.units.find((x) => x.id === id); return !!(u && u.power && u.power.state === 'plugged' && !inCord(state, u)); };
  for (let i = 0; i < n; i++) {
    events.push(...step(state, NONE));
    if (outAt < 0 && !state.result && out()) outAt = state.tick;
  }
  events.push(...step(state, NONE)); // settle: a pending check runs at the start of this tick
  if (outAt < 0 && out()) outAt = state.tick;
  return { events, outAt };
}

// The reporter's setup: a playable match (wrap on) that has passed its 2000-tick limit, then a Popper walks 80 tiles out.
test('a Popper sent out of cord after the match limit still stops at the cord limit (reporter setup)', () => {
  const state = createPlayableState(7);
  state.maxTicks = 2000; // the match limit this setup was reported on (the default is now 21,600)
  const p = state.units.find((u) => u.owner === 0 && u.kind === 'worker');
  for (let i = 0; i < 2010; i++) step(state, NONE);
  assert.ok(state.result, 'the playable match has passed its tick limit');
  const target = { x: Math.max(1, Math.min(254, p.x + 40)), y: Math.max(1, Math.min(254, p.y - 40)) };
  step(state, [[{ type: 'move', unit: p.id, x: target.x, y: target.y }], []]);
  const { events, outAt } = walk(state, 24 * 60, p.id);
  assert.equal(outAt, -1, `the unit stood out of cord from tick ${outAt}`);
  assert.equal(events.filter((e) => e.e === 'power-battery' && e.id === p.id).length, 0, 'no battery grace for a live anchor');
  assert.ok(events.some((e) => e.e === 'cord-limit' && e.id === p.id), 'the walk was stopped with a cord-limit event');
});

// The crowd: a knot of friendly units on the way out. A unit that cannot step back onto its last tile still stays in cord.
test('a crowd on the way out does not let a unit leave its cord', () => {
  const units = [{ id: 10, owner: 0, kind: 'grunt', x: 6, y: 5, hp: 40, order: { type: 'move', x: 30, y: 5 }, carrying: 0 }];
  for (let k = 0; k < 8; k++) units.push({ id: 20 + k, owner: 0, kind: 'worker', x: 17 + (k % 2), y: 4 + Math.floor(k / 2), hp: 40, order: null, carrying: 0 });
  const state = createTestState({
    width: 60, height: 40, rocks: [],
    structures: [{ id: 1, owner: 0, kind: 'core', x: 5, y: 5 }, { id: 2, owner: 1, kind: 'core', x: 55, y: 35 }],
    units,
  });
  enablePower(state);
  state.power.wrap = true;
  state.maxTicks = 1; // the match is already over: the cord check must not depend on it
  const { events, outAt } = walk(state, 24 * 20, 10);
  assert.equal(outAt, -1, `the unit stood out of cord from tick ${outAt}`);
  assert.ok(events.some((e) => e.e === 'cord-limit' && e.id === 10), 'the crowd stopped it with a cord-limit event');
});

// A windmill is a point with range 0: it has no cord reach of its own, so it cannot anchor a unit that walks past the Strip.
test('a windmill (range 0) does not extend the cord', () => {
  const state = createTestState({
    width: 60, height: 40, rocks: [],
    structures: [{ id: 1, owner: 0, kind: 'core', x: 5, y: 5 }, { id: 2, owner: 1, kind: 'core', x: 55, y: 35 }],
    units: [{ id: 10, owner: 0, kind: 'worker', x: 6, y: 5, hp: 40, order: { type: 'move', x: 30, y: 5 }, carrying: 0 }],
  });
  enablePower(state);
  state.power.wrap = true;
  state.power.points.push({ id: 30, owner: 0, kind: 'windmill', x: 20, y: 5, range: 0, hp: 100, make: 5 });
  const { events, outAt } = walk(state, 24 * 20, 10);
  assert.equal(outAt, -1, `the unit stood out of cord from tick ${outAt}`);
  const u = state.units[0];
  assert.ok(Math.max(Math.abs(u.x - 5), Math.abs(u.y - 5)) <= POWER.cord.worker, 'the unit is within a Crumb cord of the Strip');
  assert.ok(events.some((e) => e.e === 'cord-limit' && e.id === 10), 'stopped by the Strip cord, not walked past it');
});

// The grace is for a destroyed anchor: with the Strip gone, a unit goes to battery (and only then may it walk freely).
test('a unit whose only anchor is destroyed goes to battery', () => {
  const state = createTestState({
    width: 60, height: 40, rocks: [],
    structures: [{ id: 1, owner: 0, kind: 'core', x: 5, y: 5, hp: 0 }, { id: 2, owner: 1, kind: 'core', x: 55, y: 35 }],
    units: [{ id: 10, owner: 0, kind: 'worker', x: 6, y: 5, hp: 40, order: null, carrying: 0 }],
  });
  enablePower(state);
  state.power.wrap = true;
  const events = [];
  for (let i = 0; i < 3; i++) events.push(...step(state, NONE));
  assert.ok(events.some((e) => e.e === 'power-battery' && e.id === 10), 'an unanchored unit runs on its battery');
});

// A cord-edge unit that stepped one tile out, with its back tile and every in-cord neighbour taken, must not stay out of
// cord: it goes to the nearest free tile inside the cord, and the next tick does not record its spot as a baseline.
test('a cord-edge unit with its back tile and in-cord neighbours taken goes to the nearest free in-cord tile', () => {
  const edge = 5 + cordLength('worker');
  const taken = [[edge, 5], [edge - 1, 4], [edge - 1, 5], [edge - 1, 6], [edge, 4], [edge, 6]];
  const units = [{ id: 10, owner: 0, kind: 'worker', x: edge + 1, y: 5, hp: 40, order: null, carrying: 0 }];
  taken.forEach(([x, y], k) => units.push({ id: 20 + k, owner: 0, kind: 'worker', x, y, hp: 40, order: null, carrying: 0 }));
  const state = createTestState({
    width: 60, height: 40, rocks: [],
    structures: [{ id: 1, owner: 0, kind: 'core', x: 5, y: 5, hp: 100 }, { id: 2, owner: 1, kind: 'core', x: 55, y: 35, hp: 100 }],
    units,
  });
  enablePower(state);
  for (const u of state.units) u.power = { state: 'plugged', anchor: 1, battery: 0 };
  const mover = state.units[0];
  state.power.before = new Map([[mover.id, { x: edge, y: 5 }]]); // it stood on the cord edge before this tick's move
  state.events = [];
  enforceCords(state);
  assert.ok(inCord(state, mover), `the unit is out of cord at (${mover.x},${mover.y})`);
  assert.equal(state.units.filter((u) => u.x === mover.x && u.y === mover.y).length, 1, 'the unit does not overlap another unit');
  assert.ok(state.events.some((e) => e.e === 'cord-limit' && e.id === mover.id), 'the move was stopped with a cord-limit event');
  const { outAt } = walk(state, 24 * 2, mover.id);
  assert.equal(outAt, -1, `the unit stood out of cord from tick ${outAt}`);
});

// The long walk with wrap on: a Crumb walks the long way round a cliff for a minute and never leaves its cord.
test('a long walk round a cliff with wrap on ends inside the cord', () => {
  const cliffs = [];
  for (let x = 10; x <= 12; x++) for (let y = 0; y <= 30; y++) cliffs.push([x, y]);
  const state = createTestState({
    width: 60, height: 40, rocks: cliffs,
    structures: [{ id: 1, owner: 0, kind: 'core', x: 5, y: 5 }, { id: 2, owner: 1, kind: 'core', x: 55, y: 35 }],
    units: [{ id: 10, owner: 0, kind: 'worker', x: 6, y: 5, hp: 40, order: { type: 'move', x: 20, y: 25 }, carrying: 0 }],
  });
  enablePower(state);
  state.power.wrap = true;
  const { events, outAt } = walk(state, 24 * 60, 10);
  assert.equal(outAt, -1, `the unit stood out of cord from tick ${outAt}`);
  assert.equal(events.filter((e) => e.e === 'power-battery').length, 0, 'no battery on a live anchor');
  const u = state.units[0];
  assert.ok(inCord(state, u), 'the unit ends inside its cord');
});
