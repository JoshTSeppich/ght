// Per-side building-damage counter (ROLE-CARDS Combat A6, read by the Match Rules timeout tie-break in env/sim.mjs).
// state.buildingDamage[side] counts the hp a side removed from enemy buildings; units do not count; overkill does not.
// Real modules only: env/state.mjs, env/combat.mjs, env/stats.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createTestState, findEntity } from '../env/state.mjs';
import { stepCombat } from '../env/combat.mjs';

const stat = (kind) => STATS.units?.[kind] ?? STATS.structures?.[kind] ?? STATS[kind];
const unit = (id, owner, kind, x, y) => ({ id, owner, kind, x, y, hp: stat(kind).hp, carrying: 0, order: null });
const structure = (id, owner, kind, x, y, extra = {}) =>
  ({ id, owner, kind, x, y, hp: stat(kind).hp, progress: 0, complete: true, queue: [], ...extra });
const world = ({ units = [], structures = [] }) =>
  createTestState({ width: 20, height: 20, rocks: [], crystals: [], shards: [0, 0], units, structures });

test('a side that hits an enemy building is credited with the damage it removed', () => {
  const s = world({ units: [unit(1, 0, 'grunt', 5, 5)], structures: [structure(2, 1, 'forge', 6, 5)] });
  stepCombat(s);
  assert.equal(s.buildingDamage[0], stat('grunt').damage);
  assert.equal(s.buildingDamage[1], 0);
});

test('damage to enemy units is not counted', () => {
  const s = world({ units: [unit(1, 0, 'grunt', 5, 5), unit(2, 1, 'brute', 6, 5)] });
  stepCombat(s);
  assert.equal(s.buildingDamage?.[0] ?? 0, 0);
});

test('overkill is not counted: only the hp the building had left', () => {
  const s = world({ units: [unit(1, 0, 'brute', 5, 5)], structures: [structure(2, 1, 'forge', 6, 5, { hp: 10 })] });
  stepCombat(s);
  assert.equal(s.buildingDamage[0], 10);
});

test('two attackers on one building add up, each counted for its own side', () => {
  const s = world({
    units: [unit(1, 0, 'grunt', 5, 5), unit(2, 0, 'grunt', 5, 6), unit(3, 1, 'grunt', 3, 5)],
    structures: [structure(4, 1, 'forge', 6, 5), structure(5, 0, 'forge', 4, 5)],
  });
  stepCombat(s);
  assert.equal(s.buildingDamage[0], 2 * stat('grunt').damage);
  assert.equal(s.buildingDamage[1], stat('grunt').damage);
});

test('a counter is not created for a tick with no building hit', () => {
  const s = world({ units: [unit(1, 0, 'grunt', 2, 2)] });
  stepCombat(s);
  assert.equal(s.buildingDamage, undefined);
});
