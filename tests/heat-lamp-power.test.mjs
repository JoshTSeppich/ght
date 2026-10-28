// Heat Lamp (the 'turret' kind) fires only while powered, like units (ROLE-CARDS Combat A5, web-M5-combat finding 9).
// Real modules only: env/state.mjs, env/combat.mjs, env/ammo.mjs, env/stats.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS, rowOf } from '../env/stats.mjs';
import { createTestState, findEntity } from '../env/state.mjs';
import { stepCombat } from '../env/combat.mjs';
import { enableAmmo, setAmmoHooks } from '../env/ammo.mjs';

const stat = (kind) => STATS.units?.[kind] ?? STATS.structures?.[kind] ?? STATS[kind];
const structure = (id, owner, kind, x, y) =>
  ({ id, owner, kind, x, y, hp: stat(kind).hp, progress: 0, complete: true, queue: [] });
const grunt = (id, owner, x, y) => ({ id, owner, kind: 'grunt', x, y, hp: stat('grunt').hp, carrying: 0, order: null });

// Heat Lamp (6 tiles) at (5,5) against an enemy grunt at (7,5); toast-and-slice rules are on, so the power hook decides.
function world(isPowered) {
  const s = createTestState({
    width: 20, height: 20, rocks: [], crystals: [], shards: [0, 0],
    units: [grunt(2, 1, 7, 5)], structures: [structure(1, 0, 'turret', 5, 5)],
  });
  enableAmmo(s, {});
  setAmmoHooks(s, { isPowered });
  return s;
}
const hpOf = (s, id) => findEntity(s, id)?.hp;

test('an unpowered Heat Lamp does not fire', () => {
  const s = world(() => false);
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('grunt').hp);
  assert.equal(s.events.filter((e) => e.e === 'hit').length, 0);
});

test('a powered Heat Lamp fires at the enemy in reach', () => {
  const s = world(() => true);
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('grunt').hp - (rowOf(s, 'turret').shot.damage - rowOf(s, 'grunt').armor));
});

test('power cut mid-fight stops the Heat Lamp on the next tick', () => {
  let powered = true;
  const s = world(() => powered);
  stepCombat(s);
  const afterFirst = hpOf(s, 2);
  assert.ok(afterFirst < stat('grunt').hp);
  powered = false;
  s.tick += 100;
  stepCombat(s);
  assert.equal(hpOf(s, 2), afterFirst);
});
