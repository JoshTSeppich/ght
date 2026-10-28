import { test } from 'node:test';
import assert from 'node:assert/strict';
import { damagePerHit } from '../env/combat.mjs';

test('bonus damage applies to units with matching tags', () => {
  // Zapper is anti-Light with bonus damage
  // Attack with Light tag bonus: base 5 + 3 bonus = 8
  const dmg = damagePerHit({
    base: 5,
    bonus: { Light: 3 },
    tags: ['Light'],
    armor: 0,
  });
  assert.equal(dmg, 8, 'Bonus damage is added to base');
});

test('bonus damage does not apply to units without matching tags', () => {
  // Zapper attacking Armored (no Light tag)
  // base 5 + 0 bonus = 5 (because Armored has no Light tag)
  const dmg = damagePerHit({
    base: 5,
    bonus: { Light: 3 },
    tags: ['Armored'],
    armor: 0,
  });
  assert.equal(dmg, 5, 'No bonus when tag does not match');
});

test('multiple bonuses stack for units with multiple tags', () => {
  // Four-Slice has bonus vs Armored and Structure
  // Target with both tags receives both bonuses
  const dmg = damagePerHit({
    base: 5,
    bonus: { Armored: 2, Structure: 3 },
    tags: ['Armored', 'Structure'],
    armor: 0,
  });
  assert.equal(dmg, 10, 'Both bonuses (2 + 3) stack');
});

test('bonus damage stacks with armor reduction', () => {
  // Zapper (bonus +3 vs Light) attacks Light unit with armor 1
  // base 5 + bonus 3 - armor 1 = 7
  const dmg = damagePerHit({
    base: 5,
    bonus: { Light: 3 },
    tags: ['Light'],
    armor: 1,
  });
  assert.equal(dmg, 7, 'Bonus and armor both apply');
});

test('counter units beat their targets in even-cost sandbox', () => {
  // Zapper (anti-Light): higher damage against Light
  const zapperVsLight = damagePerHit({
    base: 4,
    bonus: { Light: 3 },
    tags: ['Light'],
    armor: 0,
  });
  const lightVsZapper = damagePerHit({
    base: 3,
    bonus: {},
    tags: ['Armored'], // Zapper is not Light
    armor: 0,
  });

  assert(zapperVsLight > lightVsZapper, 'Zapper counters Light damage');

  // Four-Slice (anti-Armored and Structure): higher damage
  const fourVsArmored = damagePerHit({
    base: 4,
    bonus: { Armored: 3, Structure: 2 },
    tags: ['Armored'],
    armor: 0,
  });
  const armoredVsFour = damagePerHit({
    base: 3,
    bonus: {},
    tags: [],
    armor: 0,
  });

  assert(fourVsArmored > armoredVsFour, 'Four-Slice counters Armored units');
});
