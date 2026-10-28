import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdleCrumbs, nearestWheat, idleButtonHtml } from '../play/idle-crumbs.mjs';

const crumb = (id, x, y, extra = {}) => ({ id, owner: 0, kind: 'worker', x, y, order: null, ...extra });
const snapOf = (tick, units, crystals) => ({ tick, units, crystals, structures: [{ id: 99, owner: 0, kind: 'core', x: 5, y: 5 }], power: { points: [{ id: 99, owner: 0, x: 5, y: 5 }] } });
const wheat = [{ x: 8, y: 5, amount: 100 }, { x: 6, y: 5, amount: 100 }, { x: 40, y: 40, amount: 100 }, { x: 5, y: 7, amount: 0 }];

test('nearestWheat: nearest inside cord reach, skips empty and out-of-reach wheat', () => {
  assert.deepEqual(nearestWheat(snapOf(0, [], wheat), crumb(1, 7, 5), 0), { x: 6, y: 5, amount: 100 });
  assert.equal(nearestWheat(snapOf(0, [], [wheat[2], wheat[3]]), crumb(1, 7, 5), 0), null);
});

test('match start: an idle Crumb gathers at once, with a normal gather command', () => {
  const ic = createIdleCrumbs();
  assert.deepEqual(ic.tick(snapOf(0, [crumb(1, 7, 5)], wheat)), [{ type: 'gather', unit: 1, x: 6, y: 5 }]);
});

test('later: idle 3 s (72 ticks) before the first order, then a 5 s retry gap', () => {
  const ic = createIdleCrumbs();
  const u = [crumb(1, 7, 5)];
  assert.deepEqual(ic.tick(snapOf(100, u, wheat)), []);
  assert.deepEqual(ic.tick(snapOf(171, u, wheat)), []);
  assert.equal(ic.tick(snapOf(172, u, wheat)).length, 1);
  assert.deepEqual(ic.tick(snapOf(173, u, wheat)), []);
});

test('a Crumb with an order, a plan or Hold is left alone; busy resets the idle clock', () => {
  const ic = createIdleCrumbs();
  const plans = new Map([[2, { cur: null, queue: [], hold: true }]]);
  assert.deepEqual(ic.tick(snapOf(0, [crumb(1, 7, 5, { order: { type: 'move' } }), crumb(2, 7, 5)], wheat), plans), []);
  ic.tick(snapOf(100, [crumb(3, 7, 5)], wheat));
  ic.tick(snapOf(150, [crumb(3, 7, 5, { order: { type: 'gather' } })], wheat));
  assert.deepEqual(ic.tick(snapOf(200, [crumb(3, 7, 5)], wheat)), []);
});

test('no wheat in reach: no command, no crash; other kinds and the enemy are ignored', () => {
  const ic = createIdleCrumbs();
  const grunt = { ...crumb(4, 7, 5), kind: 'grunt' }, foe = { ...crumb(5, 7, 5), owner: 1 };
  assert.deepEqual(ic.tick(snapOf(0, [crumb(1, 7, 5), grunt, foe], [wheat[2]])), []);
});

test('F1 cycles idle Crumbs in id order and wraps; the button shows the count', () => {
  const ic = createIdleCrumbs();
  const s = snapOf(10, [crumb(3, 1, 1), crumb(1, 2, 2), crumb(2, 3, 3, { order: { type: 'move' } })], wheat);
  assert.equal(ic.count(s), 2);
  assert.equal(ic.cycle(s).id, 1); assert.equal(ic.cycle(s).id, 3); assert.equal(ic.cycle(s).id, 1);
  assert.equal(createIdleCrumbs().cycle(snapOf(0, [], wheat)), null);
  assert.match(idleButtonHtml(2), /idle-blink[^>]*>Idle Crumbs <b>2<\/b>/);
  assert.equal(idleButtonHtml(0), '');
});
