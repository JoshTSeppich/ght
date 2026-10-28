// Air Layer movement: layer:"air" units fly in a straight line over all terrain,
// cliffs, rocks, and other obstacles. Ground units can't block air movement.
// Owner: haiku (Air Layer tester).
//
// Tests the contract from env/air.mjs stepAirMovement: every flyer moves one step
// per tick (respecting its speed) toward its destination, ignoring terrain.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState, findEntity } from '../env/state.mjs';
import { step } from '../env/sim.mjs';
import { STATS, rowOf } from '../env/stats.mjs';

function unit(id, owner, kind, x, y, order = null) {
  return { id, owner, kind, x, y, hp: STATS.units[kind].hp, carrying: 0, order };
}

function structure(id, owner, kind, x, y, complete = true) {
  const row = STATS.structures[kind];
  return { id, owner, kind, x, y, hp: row.hp, progress: row.buildTicks, complete, queue: [] };
}

// A test map with rocks in a wall formation, forcing ground units to detour.
// Air units should fly straight over.
function mapWithObstacles() {
  const width = 32, height = 32;
  const rocks = [];
  // Build a wall of rocks from (15, 5) to (15, 25)
  for (let y = 5; y <= 25; y++) {
    rocks.push([15, y]);
  }
  return { width, height, rocks, crystals: [] };
}

test('Flyer flies straight over a rock wall', () => {
  const map = mapWithObstacles();
  const state = createTestState({ ...map, shards: [1000, 0], units: [
    unit(1, 0, 'croutonKite', 5, 15, { type: 'move', x: 25, y: 15 }),
  ], structures: [] });

  for (let i = 0; i < 30; i++) {
    step(state, [[], []]);
  }

  const flyer = findEntity(state, 1);
  assert.ok(flyer, 'Flyer should exist');
  // Crouton Kite has speed 1, so it should move 1 tile per tick. After 20 ticks, it should be at x=25 (5+20=25)
  assert.ok(flyer.x >= 23, `Flyer should have moved past the rock wall (x=${flyer.x})`);
});

test('Flyer ignores ground units while moving', () => {
  const map = mapWithObstacles();
  const state = createTestState({ ...map, shards: [1000, 0], units: [
    unit(1, 0, 'croutonKite', 5, 15, { type: 'move', x: 25, y: 15 }),
    unit(2, 1, 'grunt', 15, 15), // Ground unit blocking the path
  ], structures: [] });

  const startX = 5;
  for (let i = 0; i < 25; i++) {
    step(state, [[], []]);
  }

  const flyer = findEntity(state, 1);
  assert.ok(flyer.x > startX, 'Flyer should move forward despite ground unit in the way');
});

test('Multiple flyers don\'t collide with each other', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'croutonKite', 5, 10, { type: 'move', x: 25, y: 10 }),
      unit(2, 0, 'croutonKite', 5, 15, { type: 'move', x: 25, y: 15 }),
    ],
    structures: []
  });

  for (let i = 0; i < 30; i++) {
    step(state, [[], []]);
  }

  const u1 = findEntity(state, 1);
  const u2 = findEntity(state, 2);
  // Each flyer should end up in its own lane (different y)
  assert.strictEqual(u1.y, 10, 'Flyer 1 should maintain its y lane');
  assert.strictEqual(u2.y, 15, 'Flyer 2 should maintain its y lane');
});

test('Flyer respects speed: Waffle Wing (speed 1) moves 1 tile per tick', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'waffleWing', 5, 15, { type: 'move', x: 15, y: 15 }),
    ],
    structures: []
  });

  step(state, [[], []]); // Tick 0
  let flyer = findEntity(state, 1);
  assert.equal(flyer.x, 6, 'After 1 tick, Waffle Wing should move 1 tile (speed 1)');
});

test('Flyer clears its move order when it reaches destination', () => {
  const state = createTestState({
    width: 32, height: 32, rocks: [], crystals: [],
    shards: [1000, 0],
    units: [
      unit(1, 0, 'croutonKite', 5, 15, { type: 'move', x: 7, y: 15 }),
    ],
    structures: []
  });

  for (let i = 0; i < 5; i++) {
    step(state, [[], []]);
  }

  const flyer = findEntity(state, 1);
  assert.equal(flyer.order, null, 'Move order should be cleared when destination is reached');
});
