// With wrap on, a straight cord re-anchors to a nearer Extension Box, so a box chain carries toasters on (owner: sonnet).
// Before this, a wrapped unit kept its first anchor (the Strip) for ever and never walked past 12 tiles of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { step } from '../env/sim.mjs';
import { enablePower } from '../env/power.mjs';

const NONE = [[], []];
const cliffs = [];
for (let x = 10; x <= 12; x++) for (let y = 0; y <= 10; y++) cliffs.push([x, y]);

function open() {
  const state = createTestState({
    width: 60, height: 40,
    structures: [{ id: 1, owner: 0, kind: 'core', x: 5, y: 5 }, { id: 2, owner: 1, kind: 'core', x: 54, y: 34 }],
    units: [{ id: 10, owner: 0, kind: 'worker', x: 6, y: 5, hp: 40, order: { type: 'move', x: 17, y: 5 }, carrying: 0 }],
  });
  enablePower(state);
  state.power.wrap = true;
  return state;
}
const run = (s, n) => { for (let i = 0; i < n; i++) step(s, NONE); return s.units[0]; };

test('an Extension Box carries a wrapped Crumb past the Strip cord', () => {
  const s = open();
  assert.equal(run(s, 40).x, 17, 'the Strip cord (12) reaches x 17');
  s.power.points.push({ id: 50, owner: 0, kind: 'extension', x: 18, y: 5, range: 8 });
  s.units[0].order = { type: 'move', x: 29, y: 5 };
  const u = run(s, 60);
  assert.equal(u.x, 29, 'the box carries the cord on');
  assert.equal(u.power.anchor, 50);
  assert.equal(u.power.state, 'plugged');
});

test('a cord bent round a cliff unwinds when a box has a clear line, and stays wrapped when only the cliff-side box is near', () => {
  const state = createTestState({
    width: 40, height: 40, rocks: cliffs,
    structures: [{ id: 1, owner: 0, kind: 'core', x: 5, y: 5 }, { id: 2, owner: 1, kind: 'core', x: 34, y: 34 }],
    units: [{ id: 10, owner: 0, kind: 'worker', x: 6, y: 5, hp: 40, order: { type: 'move', x: 13, y: 12 }, carrying: 0 }],
  });
  enablePower(state);
  state.power.wrap = true;
  run(state, 60);
  const u = state.units[0];
  assert.ok(u.power.cord && u.power.cord.pts.length > 1, 'the walk round the cliff left the cord bent');
  state.power.points.push({ id: 51, owner: 0, kind: 'extension', x: u.x, y: u.y + 1, range: 8 });
  run(state, 5);
  assert.equal(state.units[0].power.anchor, 51, 'a box in clear sight unwinds the bend');
  assert.equal(state.units[0].power.cord.pts.length, 1);
});
