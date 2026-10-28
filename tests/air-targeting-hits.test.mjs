// Air Layer targeting: the hits property determines what each unit can attack.
// croutonKite: hits.ground=false, hits.air=false (no weapon)
// waffleWing: hits.ground=false, hits.air=true (air-to-air)
// crumpetBomber: hits.ground=true, hits.air=false (air-to-ground)
// Poppers and Flak Poppers can hit air (decision 1); most ground units can't.
// Owner: haiku (Air Layer tester).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState, findEntity } from '../env/state.mjs';
import { step } from '../env/sim.mjs';
import { STATS } from '../env/stats.mjs';

function unit(id, owner, kind, x, y, order = null) {
  return { id, owner, kind, x, y, hp: STATS.units[kind].hp, carrying: 0, order };
}

const NO_COMMANDS = [[], []];

function attackOrder(tick) {
  return (state) => tick === 0 ? state : [[], []];
}

test('Crouton Kite has no weapon (hits.ground=false, hits.air=false)', () => {
  const row = STATS.units.croutonKite;
  assert.strictEqual(row.hits.ground, false, 'croutonKite should not hit ground');
  assert.strictEqual(row.hits.air, false, 'croutonKite should not hit air');
  assert.strictEqual(row.damage, undefined, 'croutonKite should have no damage');
});

test('Waffle Wing targets air only (hits.ground=false, hits.air=true)', () => {
  const row = STATS.units.waffleWing;
  assert.strictEqual(row.hits.ground, false, 'waffleWing should not hit ground');
  assert.strictEqual(row.hits.air, true, 'waffleWing should hit air');
  assert.ok(row.damage > 0, 'waffleWing should have damage');
});

test('Crumpet Bomber targets ground only (hits.ground=true, hits.air=false)', () => {
  const row = STATS.units.crumpetBomber;
  assert.strictEqual(row.hits.ground, true, 'crumpetBomber should hit ground');
  assert.strictEqual(row.hits.air, false, 'crumpetBomber should not hit air');
  assert.ok(row.damage > 0, 'crumpetBomber should have damage');
});

test('Popper can hit both ground and air', () => {
  const row = STATS.units.grunt; // Popper is the generalist
  assert.strictEqual(row.hits.ground, true, 'Popper should hit ground');
  // Note: Combat lead needs to set grunt.hits.air = true per M4 requirements (BUILD-CARDS-W2).
  // For now this checks the current state; the test will pass once Combat lead updates it.
  assert.strictEqual(row.hits.air, true, 'Popper should hit air (DECISIONS.md 3 and M4 requirement)');
});

test('Zapper can\'t hit air (anti-Light only)', () => {
  const row = STATS.units.lancer; // Zapper
  assert.strictEqual(row.hits.ground, true, 'Zapper should hit ground');
  assert.strictEqual(row.hits.air, false, 'Zapper should not hit air');
});

test('Four-Slice can\'t hit air (anti-Armored only)', () => {
  const row = STATS.units.brute; // Four-Slice
  assert.strictEqual(row.hits.ground, true, 'Four-Slice should hit ground');
  assert.strictEqual(row.hits.air, false, 'Four-Slice should not hit air');
});

test('Broiler can\'t hit air (splash only ground)', () => {
  const row = STATS.units.howler; // Broiler
  assert.strictEqual(row.hits.ground, true, 'Broiler should hit ground');
  assert.strictEqual(row.hits.air, false, 'Broiler should not hit air');
});

test('Flak Popper can hit both ground and air', () => {
  const row = STATS.units.spiker; // Flak Popper
  assert.strictEqual(row.hits.ground, true, 'Flak Popper should hit ground');
  assert.strictEqual(row.hits.air, true, 'Flak Popper should hit air');
});

test('Bagel can\'t hit air (melee raider)', () => {
  const row = STATS.units.dart; // Bagel
  assert.strictEqual(row.hits.ground, true, 'Bagel should hit ground');
  assert.strictEqual(row.hits.air, false, 'Bagel should not hit air');
});

test('Heat Lamp structure can hit both ground and air', () => {
  const row = STATS.structures.turret; // Heat Lamp
  assert.strictEqual(row.hits.ground, true, 'Heat Lamp should hit ground');
  assert.strictEqual(row.hits.air, true, 'Heat Lamp should hit air');
});

test('Crumpet Bomber attacks Popper on ground (air-to-ground)', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'crumpetBomber', 5, 15, { type: 'attack', target: 2 }),
      unit(2, 1, 'grunt', 10, 15), // Popper as target
    ],
    structures: []
  });

  const startHp = STATS.units.grunt.hp;
  let ticks = 0;
  while (ticks < 200 && findEntity(state, 2).hp === startHp) {
    step(state, NO_COMMANDS);
    ticks++;
  }

  const target = findEntity(state, 2);
  assert.ok(target.hp < startHp, 'Popper should take damage from Crumpet Bomber');
});

test('Waffle Wing attacks another Waffle Wing (air-to-air)', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'waffleWing', 5, 15, { type: 'attack', target: 2 }),
      unit(2, 1, 'waffleWing', 10, 15),
    ],
    structures: []
  });

  const startHp = STATS.units.waffleWing.hp;
  let ticks = 0;
  while (ticks < 200 && findEntity(state, 2).hp === startHp) {
    step(state, NO_COMMANDS);
    ticks++;
  }

  const target = findEntity(state, 2);
  assert.ok(target.hp < startHp, 'Waffle Wing should take damage from another Waffle Wing');
});
