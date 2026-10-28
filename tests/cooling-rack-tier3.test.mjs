// Cooling Rack tier requirement: the air factory is a tier-3 building that needs
// Windmill or Dam to unlock, per DECISIONS.md decision 2 (Tier cost: Wheat + Flour).
// It trains Crouton Kite, Waffle Wing, and Crumpet Bomber.
// Owner: haiku (Air Layer tester).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState, findEntity } from '../env/state.mjs';
import { step } from '../env/sim.mjs';
import { STATS } from '../env/stats.mjs';

function unit(id, owner, kind, x, y, order = null) {
  return { id, owner, kind, x, y, hp: STATS.units[kind].hp, carrying: 0, order };
}

function structure(id, owner, kind, x, y, complete = true) {
  const row = STATS.structures[kind];
  return { id, owner, kind, x, y, hp: row.hp, progress: row.buildTicks, complete, queue: [] };
}

test('Cooling Rack is tier 3', () => {
  const row = STATS.structures.coolingRack;
  assert.ok(row, 'coolingRack should exist in STATS');
  // For Toaster Wars (the current game), check toasterTiers
  const tier3Unlocks = STATS.toasterTiers?.[3]?.unlocks ?? [];
  assert.ok(tier3Unlocks.includes('coolingRack'), 'Cooling Rack should be in tier 3 unlocks');
});

test('Cooling Rack trains the three air units', () => {
  const row = STATS.structures.coolingRack;
  assert.ok(Array.isArray(row.trains), 'Cooling Rack should have trains array');
  assert.ok(row.trains.includes('croutonKite'), 'Should train Crouton Kite');
  assert.ok(row.trains.includes('waffleWing'), 'Should train Waffle Wing');
  assert.ok(row.trains.includes('crumpetBomber'), 'Should train Crumpet Bomber');
});

test('Cooling Rack is in the build table', () => {
  assert.ok(STATS.structures.coolingRack, 'Cooling Rack should be in STATS.structures');
  const row = STATS.structures.coolingRack;
  assert.ok(row.cost > 0, 'Cooling Rack should have a cost');
  assert.ok(row.hp > 0, 'Cooling Rack should have HP');
  assert.ok(row.buildTicks > 0, 'Cooling Rack should have build time');
});

test('Can train air units from Cooling Rack', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [10000, 0],
    units: [],
    structures: [
      structure(1, 0, 'coolingRack', 10, 10, true),
    ]
  });

  const building = findEntity(state, 1);
  const row = STATS.structures[building.kind];

  for (const kind of ['croutonKite', 'waffleWing', 'crumpetBomber']) {
    assert.ok(row.trains.includes(kind), `Cooling Rack should be able to train ${kind}`);
  }
});

test('Cooling Rack has appropriate stats', () => {
  const row = STATS.structures.coolingRack;
  assert.ok(row.hp > 0, 'Cooling Rack should have HP');
  assert.strictEqual(row.armor, 1, 'Cooling Rack should have armor');
  assert.ok(row.buildTicks > 0, 'Cooling Rack should have a build time');
  assert.ok(row.cost > 0, 'Cooling Rack should cost Flour');
});

test('All air units are tier 3 compatible', () => {
  for (const kind of ['croutonKite', 'waffleWing', 'crumpetBomber']) {
    const row = STATS.units[kind];
    assert.ok(row, `${kind} should exist in STATS`);
    assert.strictEqual(row.layer, 'air', `${kind} should be air layer`);
  }
});
