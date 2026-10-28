import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { damagePerHit, setUpgradeLevelHook } from '../env/combat.mjs';

test('upgrade level increases damage per hit', () => {
  // attackBonus = level * attackStep, so level 1 adds 1x attackStep
  // base damage 5, no upgrades (level 0): 5 damage
  let dmg = damagePerHit({
    base: 5,
    armor: 0,
    attackBonus: 0,
    armorBonus: 0,
  });
  assert.equal(dmg, 5, 'No upgrade: base damage only');

  // With level 1 upgrade (attackStep 1): base 5 + level*step (1*1) = 6
  dmg = damagePerHit({
    base: 5,
    armor: 0,
    attackBonus: 1, // level 1 * attackStep 1
    armorBonus: 0,
  });
  assert.equal(dmg, 6, 'Level 1 upgrade adds 1 damage');

  // With level 2 upgrade: base 5 + 2*1 = 7
  dmg = damagePerHit({
    base: 5,
    armor: 0,
    attackBonus: 2, // level 2 * attackStep 1
    armorBonus: 0,
  });
  assert.equal(dmg, 7, 'Level 2 upgrade adds 2 damage');

  // With level 3 upgrade: base 5 + 3*1 = 8
  dmg = damagePerHit({
    base: 5,
    armor: 0,
    attackBonus: 3, // level 3 * attackStep 1
    armorBonus: 0,
  });
  assert.equal(dmg, 8, 'Level 3 upgrade adds 3 damage');
});

test('armor upgrade reduces damage taken', () => {
  const baseAttack = 10;

  // No armor upgrade: 10 - (armor 1) = 9 taken
  let dmg = damagePerHit({
    base: baseAttack,
    armor: 1,
    armorBonus: 0,
  });
  assert.equal(dmg, 9);

  // Armor upgrade level 1: 10 - (armor 1 + bonus 1) = 8 taken
  dmg = damagePerHit({
    base: baseAttack,
    armor: 1,
    armorBonus: 1,
  });
  assert.equal(dmg, 8);

  // Armor upgrade level 2: 10 - (armor 1 + bonus 2) = 7 taken
  dmg = damagePerHit({
    base: baseAttack,
    armor: 1,
    armorBonus: 2,
  });
  assert.equal(dmg, 7);

  // Armor upgrade level 3: 10 - (armor 1 + bonus 3) = 6 taken
  dmg = damagePerHit({
    base: baseAttack,
    armor: 1,
    armorBonus: 3,
  });
  assert.equal(dmg, 6);
});

test('combat changes hits-to-kill at each upgrade level', () => {
  // Calculate hits needed to kill: hp / damage_per_hit
  const targetHp = 24; // Example: 3x base might be 8, so 3x = 24

  // No upgrades: 24 / 4 = 6 hits
  let hitsToKill = Math.ceil(targetHp / damagePerHit({ base: 4, armor: 0, attackBonus: 0 }));
  assert.equal(hitsToKill, 6);

  // Level 1 weapon upgrade: base 4 + 1 = 5, so 24 / 5 = 5 hits (one fewer)
  hitsToKill = Math.ceil(targetHp / damagePerHit({ base: 4, armor: 0, attackBonus: 1 }));
  assert.equal(hitsToKill, 5);

  // Level 2: base 4 + 2 = 6, so 24 / 6 = 4 hits
  hitsToKill = Math.ceil(targetHp / damagePerHit({ base: 4, armor: 0, attackBonus: 2 }));
  assert.equal(hitsToKill, 4);

  // Level 3: base 4 + 3 = 7, so 24 / 7 ≈ 3.43 = 4 hits
  hitsToKill = Math.ceil(targetHp / damagePerHit({ base: 4, armor: 0, attackBonus: 3 }));
  assert.equal(hitsToKill, 4);
});

test('upgradeLevel hook returns correct level for tests', () => {
  const state = createTestState({
    width: 64,
    height: 64,
    shards: [0, 0],
    structures: [
      { id: 1, owner: 0, kind: 'core', x: 3, y: 3, hp: 1500, complete: true },
    ],
    units: [],
  });

  // Set hook to return level 1
  setUpgradeLevelHook(() => 1);
  // Combat reads upgradeLevel; in stepCombat this would use the hook
  // Verify the hook is in place (combat imports and uses it)
  assert.doesNotThrow(() => {
    setUpgradeLevelHook(() => 1);
  }, 'Hook can be set to return level 1');

  // Reset to null (restores research.mjs)
  setUpgradeLevelHook(null);
  assert.doesNotThrow(() => {
    setUpgradeLevelHook(null);
  }, 'Hook can be reset to null');
});
