// Combat fog: a side only shoots what its own pieces can see (ROLE-CARDS Combat A1, web-M5-combat finding 5).
// Real modules only: env/state.mjs, env/combat.mjs, env/stats.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createTestState, findEntity } from '../env/state.mjs';
import { stepCombat } from '../env/combat.mjs';

const stat = (kind) => STATS.units?.[kind] ?? STATS.structures?.[kind] ?? STATS[kind];
const unit = (id, owner, kind, x, y, order = null) =>
  ({ id, owner, kind, x, y, hp: stat(kind).hp, carrying: 0, order });
const structure = (id, owner, kind, x, y) =>
  ({ id, owner, kind, x, y, hp: stat(kind).hp, progress: 0, complete: true, queue: [] });
const hpOf = (state, id) => findEntity(state, id)?.hp;

// Flat 20x20 map; `highTiles` are raised one level, so a low lancer cannot see them past its adjacent tiles.
function world({ units = [], structures = [], highTiles = [] }) {
  const s = createTestState({ width: 20, height: 20, rocks: [], crystals: [], shards: [0, 0], units, structures });
  s.heights = Array.from({ length: 20 }, () => Array(20).fill(0));
  for (const [x, y] of highTiles) s.heights[y][x] = 1;
  return s;
}

test('idle Lancer does not shoot an enemy on a high tile it cannot see', () => {
  const s = world({ units: [unit(1, 0, 'lancer', 2, 5), unit(2, 1, 'brute', 6, 5)], highTiles: [[6, 5]] });
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('brute').hp);
  assert.equal(s.events.filter((e) => e.e === 'hit').length, 0);
});

test('the same Lancer shoots the same enemy once it is on level ground (control)', () => {
  const s = world({ units: [unit(1, 0, 'lancer', 2, 5), unit(2, 1, 'brute', 6, 5)] });
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('brute').hp - stat('lancer').damage);
});

test('an ordered attack on a target the side cannot see does nothing', () => {
  const s = world({ units: [unit(1, 0, 'lancer', 2, 5, { type: 'attack', target: 2 }), unit(2, 1, 'brute', 6, 5)], highTiles: [[6, 5]] });
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('brute').hp);
});

test('a friendly unit on high ground that sees the enemy lets the Lancer shoot it', () => {
  // The spotter stands on the high tile at (6,4), next to the target at (6,5): its sight reveals the target to side 0.
  const s = world({
    units: [unit(1, 0, 'lancer', 2, 5), unit(3, 0, 'grunt', 6, 4), unit(2, 1, 'brute', 6, 5)],
    highTiles: [[6, 4], [6, 5]],
  });
  stepCombat(s);
  // The spotter grunt is adjacent to the brute too, so it hits as well; both shots land.
  assert.equal(hpOf(s, 2), stat('brute').hp - stat('lancer').damage - stat('grunt').damage);
});

test('a structure the side cannot see is not chosen as an idle target', () => {
  const s = world({ units: [unit(1, 0, 'lancer', 2, 5)], structures: [structure(2, 1, 'forge', 6, 5)], highTiles: [[6, 5]] });
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('forge').hp);
});
