// Combat rebalance (PLAYABLE.md 17+22): a slice feeds several Popper shots, one Toaster keeps about four Poppers
// fighting, and a dry fighter is Hungry (growl event + droopy flag) until a Crumb brings toast. Owner: sonnet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { ECONOMY } from '../env/stats.mjs';
import { enableAmmo, stepAmmo, spendShot, unitState, observeAmmo, canFire } from '../env/ammo.mjs';

const mk = (units) => createTestState({
  width: 64, height: 64, shards: [0, 0],
  structures: [
    { id: 1, owner: 0, kind: 'core', x: 3, y: 3, hp: 1500, complete: true },
    { id: 2, owner: 1, kind: 'core', x: 60, y: 60, hp: 1500, complete: true },
  ],
  units,
});
const popper = (id, x = 5, y = 3) => ({ id, owner: 0, kind: 'grunt', x, y, order: null });

test('table: a Popper burns about 13 slices a minute, so one Toaster (48) keeps about 4 fighting', () => {
  const p = ECONOMY.units.grunt;
  assert.equal(p.shotsPerSlice, 3);
  assert.ok(p.slicesPerMinuteFighting >= 11 && p.slicesPerMinuteFighting <= 14, String(p.slicesPerMinuteFighting));
  const fed = ECONOMY.perMinute.toasterSlicesOut / p.slicesPerMinuteFighting;
  assert.ok(fed >= 3.5 && fed <= 4.5, String(fed));
});

test('one slice feeds three shots, the fourth shot spends the next slice', () => {
  const s = mk([popper(10)]);
  enableAmmo(s, { stock: 0 });
  stepAmmo(s);
  assert.equal(observeAmmo(s, 0).units[0].slices, 6);
  for (let i = 0; i < 3; i++) assert.ok(spendShot(s, s.units[0], 99));
  assert.equal(observeAmmo(s, 0).units[0].slices, 5);
  assert.ok(spendShot(s, s.units[0], 99));
  assert.equal(observeAmmo(s, 0).units[0].slices, 4);
  assert.equal(observeAmmo(s, 0).units[0].shots, 4 * 3 + 2);
});

test('a dry Popper growls once, shows droopy eyes, and a Crumb ferries toast to it', () => {
  const s = mk([popper(10), { id: 11, owner: 0, kind: 'worker', x: 4, y: 3, order: null }]);
  enableAmmo(s, { stock: 10 });
  stepAmmo(s);
  for (let i = 0; i < 18; i++) spendShot(s, s.units[0], 99);
  assert.equal(unitState(s, s.units[0]), 'hungry');
  assert.equal(canFire(s, s.units[0]), false);
  const growls = () => s.events.filter((e) => e.e === 'hungry').length;
  stepAmmo(s);
  assert.equal(growls(), 1);
  assert.equal(observeAmmo(s, 0).units[0].droopy, true);
  stepAmmo(s);
  assert.equal(growls(), 1);
  for (let i = 0; i < 400 && unitState(s, s.units[0]) === 'hungry'; i++) { s.tick += 1; stepAmmo(s); }
  assert.equal(unitState(s, s.units[0]), 'fed');
  assert.equal(observeAmmo(s, 0).units[0].droopy, false);
});
