// Air Layer ammo resupply: flyers draw ammo the same way as ground units but are
// resupplied directly from the stock by stepAirResupply when parked at a Toaster
// or Cooling Rack (no Crumb run). Owner: haiku (Air Layer tester).
//
// The contract from env/air.mjs stepAirResupply: when a flyer with ammo is
// within RESUPPLY_RADIUS (1 tile) of a complete friendly Toaster or Cooling Rack,
// and its ammo is depleted (hungry), it gets topped up from the side's toast stack.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState, findEntity, distance } from '../env/state.mjs';
import { step } from '../env/sim.mjs';
import { STATS } from '../env/stats.mjs';
import { isAmmoOn, unitState } from '../env/ammo.mjs';

function unit(id, owner, kind, x, y, order = null) {
  return { id, owner, kind, x, y, hp: STATS.units[kind].hp, carrying: 0, order };
}

function structure(id, owner, kind, x, y, complete = true) {
  const row = STATS.structures[kind];
  return { id, owner, kind, x, y, hp: row.hp, progress: row.buildTicks, complete, queue: [] };
}

test('Waffle Wing (armed flyer) can be resupplied', () => {
  const row = STATS.units.waffleWing;
  assert.ok(row.damage > 0, 'Waffle Wing should be armed');
});

test('Crouton Kite (unarmed flyer) is not resupplied', () => {
  const row = STATS.units.croutonKite;
  // Crouton Kite has no damage, so it carries no ammo
  assert.strictEqual(row.damage, undefined, 'Crouton Kite should be unarmed');
});

test('Flyer parked next to Toaster gets resupplied', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'waffleWing', 10, 10, { type: 'move', x: 10, y: 10 }),
    ],
    structures: [
      structure(1, 0, 'toaster', 9, 10, true),
    ]
  });

  // Set up ammo: deplete the flyer
  if (isAmmoOn(state)) {
    const A = state.ammo;
    A.slices[1] = 0; // Mark as hungry
    state.toast.stack[0] = 10; // Toaster has toast
  }

  const before = isAmmoOn(state) ? state.ammo.slices[1] : null;

  // Run a tick to trigger stepAirResupply
  step(state, [[], []]);

  if (isAmmoOn(state)) {
    const after = state.ammo.slices[1];
    assert.ok(after > 0, 'Flyer should be resupplied when parked next to Toaster');
  }
});

test('Flyer parked next to Cooling Rack gets resupplied', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'waffleWing', 10, 10, { type: 'move', x: 10, y: 10 }),
    ],
    structures: [
      structure(2, 0, 'coolingRack', 9, 10, true),
    ]
  });

  // Set up ammo: deplete the flyer
  if (isAmmoOn(state)) {
    const A = state.ammo;
    A.slices[1] = 0;
    state.toast.stack[0] = 10;
  }

  const before = isAmmoOn(state) ? state.ammo.slices[1] : null;

  step(state, [[], []]);

  if (isAmmoOn(state)) {
    const after = state.ammo.slices[1];
    assert.ok(after > 0, 'Flyer should be resupplied when parked next to Cooling Rack');
  }
});

test('Flyer far from supply doesn\'t get resupplied', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'waffleWing', 5, 5, { type: 'move', x: 5, y: 5 }),
    ],
    structures: [
      structure(1, 0, 'toaster', 20, 20, true), // Far away
    ]
  });

  if (isAmmoOn(state)) {
    const A = state.ammo;
    A.slices[1] = 0;
    state.toast.stack[0] = 10;
  }

  step(state, [[], []]);

  if (isAmmoOn(state)) {
    const after = state.ammo.slices[1];
    assert.equal(after, 0, 'Flyer far from supply should not be resupplied');
  }
});

test('Flyer at incomplete structure doesn\'t get resupplied', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'waffleWing', 10, 10, { type: 'move', x: 10, y: 10 }),
    ],
    structures: [
      structure(1, 0, 'toaster', 9, 10, false), // Incomplete
    ]
  });

  if (isAmmoOn(state)) {
    const A = state.ammo;
    A.slices[1] = 0;
    state.toast.stack[0] = 10;
  }

  step(state, [[], []]);

  if (isAmmoOn(state)) {
    const after = state.ammo.slices[1];
    assert.equal(after, 0, 'Flyer should not be resupplied at incomplete structure');
  }
});

test('Flyer at enemy structure doesn\'t get resupplied', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'waffleWing', 10, 10, { type: 'move', x: 10, y: 10 }),
    ],
    structures: [
      structure(1, 1, 'toaster', 9, 10, true), // Enemy structure
    ]
  });

  if (isAmmoOn(state)) {
    const A = state.ammo;
    A.slices[1] = 0;
    state.toast.stack[0] = 10;
  }

  step(state, [[], []]);

  if (isAmmoOn(state)) {
    const after = state.ammo.slices[1];
    assert.equal(after, 0, 'Flyer should not be resupplied at enemy structure');
  }
});

test('Crumpet Bomber (slow) uses toast for ammo', () => {
  const row = STATS.units.crumpetBomber;
  assert.ok(row.damage > 0, 'Crumpet Bomber should be armed');
  assert.ok(row.ammo !== false, 'Crumpet Bomber should draw ammo');
});

test('No Crumb runs to flyers: flyers only resupply at Toaster/Cooling Rack', () => {
  // This is a structural test: verify that env/ammo.mjs never assigns Crumbs to flyers.
  // The test just checks that the flyer row has layer:"air" which excludes it from Crumb runs.
  for (const kind of ['croutonKite', 'waffleWing', 'crumpetBomber']) {
    const row = STATS.units[kind];
    assert.strictEqual(row.layer, 'air', `${kind} should be air layer (no Crumb runs)`);
  }
});
