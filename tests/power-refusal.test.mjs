// A refused move leaves a reason the bot can read (owner: sonnet). When the cord limit stops a unit and drops its order,
// the unit remembers { tick, reason, x, y } (x, y = the tile it was walking to) and observe() lists it under power.refused
// for the owner only, so a bot never re-issues the same order into the same wall.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestState, observe } from '../env/state.mjs';
import { step } from '../env/sim.mjs';
import { enablePower } from '../env/power.mjs';

const NONE = [[], []];
function open() {
  const state = createTestState({
    width: 60, height: 40,
    structures: [{ id: 1, owner: 0, kind: 'core', x: 5, y: 5 }, { id: 2, owner: 1, kind: 'core', x: 54, y: 34 }],
    units: [{ id: 10, owner: 0, kind: 'worker', x: 6, y: 5, hp: 40, order: { type: 'move', x: 30, y: 5 }, carrying: 0 }],
  });
  enablePower(state);
  return state;
}

test('walking past the cord leaves a refusal the owner can read', () => {
  const s = open();
  for (let i = 0; i < 60; i++) step(s, NONE);
  const u = s.units[0];
  assert.equal(u.order, null, 'the order was dropped');
  const r = u.power.refused;
  assert.ok(r, 'the refusal is remembered');
  assert.equal(r.reason, 'cord');
  assert.deepEqual([r.x, r.y], [30, 5], 'it names the tile the unit was walking to');
  assert.ok(r.tick > 0 && r.tick <= s.tick);
  const mine = observe(s, 0).power.refused;
  assert.deepEqual(mine.map((q) => [q.id, q.reason, q.x, q.y]), [[10, 'cord', 30, 5]]);
  assert.equal(observe(s, 1).power.refused.length, 0, 'the enemy never sees it');
});

test('a new order clears nothing by itself, but a newer refusal replaces the old one', () => {
  const s = open();
  for (let i = 0; i < 60; i++) step(s, NONE);
  const first = s.units[0].power.refused.tick;
  s.units[0].order = { type: 'move', x: 40, y: 6 };
  for (let i = 0; i < 10; i++) step(s, NONE);
  const r = s.units[0].power.refused;
  assert.ok(r.tick > first);
  assert.deepEqual([r.x, r.y], [40, 6]);
});
