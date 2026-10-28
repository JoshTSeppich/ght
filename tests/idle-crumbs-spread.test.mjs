// Spreading idle Crumbs (play/idle-crumbs.mjs, env/economy.mjs pickWheatTile). Sixteen Crumbs must not pile onto one tile:
// measured like reports/2026-10-26/web-M3-economy.md, 16 spread over the home fields bring about 430 Wheat a minute.
// Owner: Economy A (haiku). The bar is 400 a minute over 3 minutes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { allocId, isFree } from '../env/state.mjs';
import { pickWheatTile } from '../env/economy.mjs';
import { createPlayableState, observeToaster } from '../play/toaster-play.mjs';
import { createIdleCrumbs } from '../play/idle-crumbs.mjs';

const crumb = (id, x, y, extra = {}) => ({ id, owner: 0, kind: 'worker', x, y, order: null, ...extra });

// Ten more Crumbs on free tiles near the Power Strip, so the page starts with sixteen (six come with the match).
function sixteenCrumbs(seed = 7) {
  const s = createPlayableState(seed);
  const core = s.structures.find((x) => x.owner === 0 && x.kind === 'core');
  const template = s.units.find((u) => u.owner === 0 && u.kind === 'worker');
  for (let r = 2; r <= 6 && s.units.filter((u) => u.owner === 0 && u.kind === 'worker').length < 16; r++) {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (s.units.filter((u) => u.owner === 0 && u.kind === 'worker').length >= 16) break;
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = core.x + dx, y = core.y + dy;
      if (!isFree(s, x, y)) continue;
      s.units.push({ ...template, id: allocId(s), x, y, carrying: 0, order: null });
    }
  }
  return s;
}

test('sixteen idle Crumbs on /play mine at least 400 Wheat a minute over 3 minutes', () => {
  const s = sixteenCrumbs();
  assert.equal(s.units.filter((u) => u.owner === 0 && u.kind === 'worker').length, 16);
  const idle = createIdleCrumbs({ side: 0 });
  const plans = new Map();
  const start = s.shards[0];
  for (let i = 0; i < 24 * 180; i++) step(s, [idle.tick(observeToaster(s, 0), plans), []]);
  const perMinute = (s.shards[0] - start) / 3;
  assert.ok(perMinute >= 400, `${perMinute.toFixed(0)} Wheat a minute from 16 Crumbs`);
});

test('pick: a tile with fewer Crumbs already sent wins over a nearer one', () => {
  const crystals = [{ x: 5, y: 5, amount: 100 }, { x: 7, y: 5, amount: 100 }];
  const points = [{ x: 6, y: 6 }];
  const unit = crumb(9, 6, 4);
  assert.deepEqual(pickWheatTile({ unit, crystals, units: [crumb(1, 4, 4, { order: { type: 'gather', x: 5, y: 5 } })], points }), { x: 7, y: 5, amount: 100 });
  assert.deepEqual(pickWheatTile({ unit, crystals, units: [], points }), { x: 5, y: 5, amount: 100 });
});

test('pick: a full tile (every passable tile beside it holds a Crumb) is passed over', () => {
  const crystals = [{ x: 5, y: 5, amount: 100 }, { x: 9, y: 5, amount: 100 }];
  const points = [{ x: 7, y: 5 }];
  const ring = [[4, 4], [5, 4], [6, 4], [4, 5], [6, 5], [4, 6], [5, 6], [6, 6]].map(([x, y]) => crumb(100 + x * 10 + y, x, y));
  const unit = crumb(9, 7, 3);
  assert.deepEqual(pickWheatTile({ unit, crystals, units: ring, points }), { x: 9, y: 5, amount: 100 });
});

test('pick: wheat outside cord reach of every point, or empty, is never chosen', () => {
  const crystals = [{ x: 40, y: 40, amount: 100 }, { x: 6, y: 5, amount: 0 }];
  assert.equal(pickWheatTile({ unit: crumb(1, 7, 5), crystals, units: [], points: [{ x: 5, y: 5 }] }), null);
});

test('sim: a gather order with target auto picks the least-loaded tile in cord reach', () => {
  const s = sixteenCrumbs();
  const [a, b] = s.units.filter((u) => u.owner === 0 && u.kind === 'worker');
  step(s, [[{ type: 'gather', unit: a.id, target: 'auto' }], []]);
  const first = a.order;
  assert.equal(first?.type, 'gather');
  step(s, [[{ type: 'gather', unit: b.id, target: 'auto' }], []]);
  assert.notDeepEqual([b.order.x, b.order.y], [first.x, first.y]);
});
