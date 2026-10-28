// Splash: neighbours take half the base shot, never the building-multiplied one (ROLE-CARDS Combat A4, web-M5-combat finding 8).
// Real modules only: env/state.mjs, env/combat.mjs, env/stats.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS, rowOf } from '../env/stats.mjs';
import { enableAmmo } from '../env/ammo.mjs';
import { createTestState, findEntity } from '../env/state.mjs';
import { stepCombat } from '../env/combat.mjs';

const stat = (kind) => STATS.units?.[kind] ?? STATS.structures?.[kind] ?? STATS[kind];
const unit = (id, owner, kind, x, y) => ({ id, owner, kind, x, y, hp: stat(kind).hp, carrying: 0, order: null });
const structure = (id, owner, kind, x, y) =>
  ({ id, owner, kind, x, y, hp: stat(kind).hp, progress: 0, complete: true, queue: [] });
// Splash is a Toaster Wars rule (state.ammo on), so the world turns the ammo rules on and the numbers come from rowOf.
const world = ({ units = [], structures = [] }) => {
  const s = createTestState({ width: 20, height: 20, rocks: [], crystals: [], shards: [0, 0], units, structures });
  enableAmmo(s, {});
  return s;
};
const shotOf = (s, kind) => rowOf(s, kind).shot?.damage ?? rowOf(s, kind).damage;
const hpOf = (state, id) => findEntity(state, id)?.hp;

test('a splash neighbour that is a building takes half the base shot, not the building-multiplied one', () => {
  // Howler (base 20, splash 1, structure x1.5) hits the forge (id 2, lower id) at (8,5); the turret (id 3) at (8,6) is beside it.
  const s = world({ units: [unit(1, 0, 'howler', 2, 5)], structures: [structure(2, 1, 'forge', 8, 5), structure(3, 1, 'turret', 8, 6)] });
  stepCombat(s);
  const base = shotOf(s, 'howler');
  // Armor (DECISIONS.md 1) takes its point off every hit; the structure multiplier still only applies to the primary target.
  assert.equal(hpOf(s, 2), stat('forge').hp - (Math.floor(base * rowOf(s, 'howler').structureMultiplier) - rowOf(s, 'forge').armor));
  assert.equal(hpOf(s, 3), stat('turret').hp - (Math.floor(base / 2) - rowOf(s, 'turret').armor));
});

test('a splash neighbour that is a building takes half the base shot when the primary target is a unit', () => {
  // An armed grunt (id 3) is the primary target: a unit takes the plain base shot. The forge (id 2) beside it is the neighbour.
  const s = world({ units: [unit(1, 0, 'howler', 2, 5), unit(3, 1, 'grunt', 8, 6)], structures: [structure(2, 1, 'forge', 8, 5)] });
  stepCombat(s);
  assert.equal(hpOf(s, 3), stat('grunt').hp - (shotOf(s, 'howler') - rowOf(s, 'grunt').armor));
  assert.equal(hpOf(s, 2), stat('forge').hp - (Math.floor(shotOf(s, 'howler') / 2) - rowOf(s, 'forge').armor));
});
