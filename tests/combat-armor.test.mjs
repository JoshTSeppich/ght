import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { damagePerHit } from '../env/combat.mjs';

test('armor reduces damage: base damage - armor = damage dealt', () => {
  // Base 10 damage, no armor: 10 damage
  let dmg = damagePerHit({ base: 10, armor: 0 });
  assert.equal(dmg, 10);

  // Base 10 damage, 2 armor: 8 damage
  dmg = damagePerHit({ base: 10, armor: 2 });
  assert.equal(dmg, 8);

  // Base 5 damage, 3 armor: 2 damage (not negative)
  dmg = damagePerHit({ base: 5, armor: 3 });
  assert.equal(dmg, 2);

  // Base 1 damage, 2 armor: MIN_DAMAGE (0.5)
  dmg = damagePerHit({ base: 1, armor: 2 });
  assert.equal(dmg, 0.5);
});

test('armor bonus stacks with base armor', () => {
  // Base 10, armor 2, armorBonus 1 from upgrades: 10 - (2 + 1) = 7
  const dmg = damagePerHit({ base: 10, armor: 2, armorBonus: 1 });
  assert.equal(dmg, 7);
});

test('armor applies correctly to unit vs unit combat', () => {
  const state = createTestState({
    width: 64,
    height: 64,
    shards: [0, 0],
    structures: [
      { id: 1, owner: 0, kind: 'core', x: 3, y: 3, hp: 1500, complete: true },
      { id: 2, owner: 1, kind: 'core', x: 60, y: 60, hp: 1500, complete: true },
    ],
    units: [],
  });

  // Popper is the generalist; calculate damage against Light unit with armor
  // Poppers should deal standard damage reduced by target's armor
  const popperRow = { damage: 5, attackStep: 1, bonus: {}, tags: [] };
  const lightRow = { armor: 1, tags: ['Light'] };

  const dmg = damagePerHit({
    base: popperRow.damage,
    bonus: {},
    tags: lightRow.tags,
    armor: lightRow.armor,
  });

  assert(dmg > 0, 'Popper deals damage to Light even with armor');
  assert.equal(dmg, 4, 'Popper damage (5) - Light armor (1) = 4');
});
