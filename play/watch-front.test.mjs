import test from 'node:test';
import assert from 'node:assert/strict';
import { frontFocus, createStallWatch } from './watch-front.mjs';

const u = (id, owner, x, y, kind = 'grunt') => ({ id, owner, x, y, kind, hp: 10 });
const stateOf = (units = [], points = [], cores = [[0, 10, 200], [1, 240, 20]]) => ({
  width: 256, height: 256, units, power: { points },
  structures: cores.map(([owner, x, y], i) => ({ id: 900 + i, kind: 'core', owner, x, y, hp: 100 })),
});
const pt = (owner, x, y) => ({ id: x * 1000 + y, owner, kind: 'extension', x, y });

test('frontFocus: the closest pair of enemies is where the camera looks', () => {
  const f = frontFocus(stateOf([u(1, 0, 100, 100), u(2, 1, 104, 100), u(3, 0, 20, 190), u(4, 1, 230, 30)]));
  assert.ok(Math.hypot(f.x - 102, f.y - 100) < 1, `${f.x},${f.y}`);
  assert.equal(f.why, 'front');
});

test('frontFocus: a toaster at the enemy Strip is a siege and draws the eye', () => {
  const f = frontFocus(stateOf([u(1, 0, 236, 24), u(2, 1, 100, 100), u(3, 0, 90, 100)]));
  assert.ok(Math.hypot(f.x - 238, f.y - 22) < 3, `${f.x},${f.y}`);
});

test('frontFocus: with no fighters it frames the two box-chain tips, not a corner', () => {
  const f = frontFocus(stateOf([u(1, 0, 12, 198, 'worker')], [pt(0, 10, 195), pt(0, 60, 150), pt(1, 235, 25), pt(1, 190, 60)]));
  assert.ok(Math.abs(f.x - 125) < 1 && Math.abs(f.y - 105) < 1, `${f.x},${f.y}`);
});

test('frontFocus: an empty board falls back to the middle of the two Strips', () => {
  const f = frontFocus(stateOf());
  assert.deepEqual([f.x, f.y], [125, 110]);
});

test('stall watch: fires once when the clock has not moved for the grace period', () => {
  const w = createStallWatch({ graceMs: 5000 });
  assert.equal(w.check(0, 0), false);
  assert.equal(w.check(10, 3000), false);
  assert.equal(w.check(10, 7000), false, 'moved at 3000, so only 4 s of stillness');
  assert.equal(w.check(10, 8500), true);
  assert.equal(w.check(10, 9500), false, 'only fires once');
});
