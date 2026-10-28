// Target hold: an auto-acquiring unit keeps its target while it is valid and in reach (ROLE-CARDS Combat A2).
// Real modules only: env/state.mjs, env/combat.mjs, env/stats.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createTestState, findEntity } from '../env/state.mjs';
import { stepCombat } from '../env/combat.mjs';

const stat = (kind) => STATS.units?.[kind] ?? STATS.structures?.[kind] ?? STATS[kind];
const unit = (id, owner, kind, x, y, order = null) =>
  ({ id, owner, kind, x, y, hp: stat(kind).hp, carrying: 0, order });
const world = (units) => createTestState({ width: 20, height: 20, rocks: [], crystals: [], shards: [0, 0], units });
const hpOf = (state, id) => findEntity(state, id)?.hp;

test('a Lancer keeps shooting its held target when a nearer enemy walks into reach', () => {
  // Brute 2 is the only enemy at first (distance 4, the Lancer's full reach).
  const s = world([unit(1, 0, 'lancer', 2, 5), unit(2, 1, 'brute', 6, 5)]);
  stepCombat(s);
  assert.equal(findEntity(s, 1).targetId, 2);
  // A nearer enemy arrives at distance 1. Without a hold the Lancer would switch to it.
  s.units.push(unit(3, 1, 'brute', 3, 5));
  s.nextId = 4;
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('brute').hp - 2 * stat('lancer').damage);
  assert.equal(hpOf(s, 3), stat('brute').hp);
  assert.equal(findEntity(s, 1).targetId, 2);
});

test('a held target that leaves reach is dropped and the unit re-picks', () => {
  const s = world([unit(1, 0, 'lancer', 2, 5), unit(2, 1, 'brute', 6, 5)]);
  stepCombat(s);
  // Pull the held brute out of reach (distance 7 > 4) and put a new enemy in reach.
  findEntity(s, 2).x = 9;
  s.units.push(unit(3, 1, 'brute', 4, 5));
  s.nextId = 4;
  stepCombat(s);
  assert.equal(hpOf(s, 3), stat('brute').hp - stat('lancer').damage);
  assert.equal(hpOf(s, 2), stat('brute').hp - stat('lancer').damage);
  assert.equal(findEntity(s, 1).targetId, 3);
});

test('a dead held target is dropped and the unit re-picks the next enemy', () => {
  const s = world([unit(1, 0, 'lancer', 2, 5), unit(2, 1, 'brute', 6, 5), unit(3, 1, 'brute', 5, 5)]);
  findEntity(s, 1).targetId = 2;
  findEntity(s, 2).hp = 1;
  stepCombat(s);
  assert.equal(findEntity(s, 2), null);
  // The next enemy in reach is taken on the following tick.
  stepCombat(s);
  assert.equal(findEntity(s, 1).targetId, 3);
  assert.equal(hpOf(s, 3), stat('brute').hp - stat('lancer').damage);
});
