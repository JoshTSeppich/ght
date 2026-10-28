// Target priority for idle units: armed units, then Crumbs, then buildings, then the Power Strip (ROLE-CARDS Combat A3).
// Nearest in reach wins inside a class; lower id breaks ties. Real modules only: env/state.mjs, env/combat.mjs, env/stats.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createTestState, findEntity } from '../env/state.mjs';
import { stepCombat, chooseTarget } from '../env/combat.mjs';

const stat = (kind) => STATS.units?.[kind] ?? STATS.structures?.[kind] ?? STATS[kind];
const unit = (id, owner, kind, x, y) => ({ id, owner, kind, x, y, hp: stat(kind).hp, carrying: 0, order: null });
const structure = (id, owner, kind, x, y) =>
  ({ id, owner, kind, x, y, hp: stat(kind).hp, progress: 0, complete: true, queue: [] });
const world = ({ units = [], structures = [] }) =>
  createTestState({ width: 20, height: 20, rocks: [], crystals: [], shards: [0, 0], units, structures });
const hpOf = (state, id) => findEntity(state, id)?.hp;

// Lancer (range 4) at (5,5) for side 0. Enemies are placed so the nearest one is the lower class.
const lancer = () => unit(1, 0, 'lancer', 5, 5);

test('an armed unit in reach beats a Crumb that is nearer', () => {
  const s = world({ units: [lancer(), unit(2, 1, 'worker', 6, 5), unit(3, 1, 'grunt', 8, 5)] });
  assert.equal(chooseTarget(s, findEntity(s, 1)).id, 3);
  stepCombat(s);
  assert.equal(hpOf(s, 3), stat('grunt').hp - stat('lancer').damage);
  assert.equal(hpOf(s, 2), stat('worker').hp);
});

test('a Crumb in reach beats a building that is nearer', () => {
  const s = world({ units: [lancer(), unit(3, 1, 'worker', 8, 5)], structures: [structure(2, 1, 'forge', 6, 5)] });
  assert.equal(chooseTarget(s, findEntity(s, 1)).id, 3);
});

test('a building beats the Power Strip (core) that is nearer', () => {
  const s = world({ units: [lancer()], structures: [structure(2, 1, 'core', 6, 5), structure(3, 1, 'forge', 8, 5)] });
  assert.equal(chooseTarget(s, findEntity(s, 1)).id, 3);
});

test('the Power Strip is the last choice but still a target when nothing else is in reach', () => {
  const s = world({ units: [lancer()], structures: [structure(2, 1, 'core', 8, 5)] });
  assert.equal(chooseTarget(s, findEntity(s, 1)).id, 2);
});

test('inside one class the nearest enemy wins, lower id on a tie', () => {
  const s = world({ units: [lancer(), unit(3, 1, 'grunt', 9, 5), unit(4, 1, 'grunt', 7, 5), unit(5, 1, 'grunt', 4, 5)] });
  assert.equal(chooseTarget(s, findEntity(s, 1)).id, 5);
  const tie = world({ units: [lancer(), unit(3, 1, 'grunt', 7, 4), unit(4, 1, 'grunt', 7, 6)] });
  assert.equal(chooseTarget(tie, findEntity(tie, 1)).id, 3);
});
