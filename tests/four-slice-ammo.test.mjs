// Four-Slice ammo shows volleys, not slices (card 12, item 4). A Quad Volley spends four slices, so observeAmmo
// reports how many volleys a unit holds and how many it can carry; the slice count stays for the renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { enableAmmo, stepAmmo, observeAmmo } from '../env/ammo.mjs';

function setup() {
  const state = createTestState({
    width: 64, height: 64, shards: [0, 0],
    structures: [
      { id: 1, owner: 0, kind: 'core', x: 3, y: 3, hp: 1500, complete: true },
      { id: 2, owner: 1, kind: 'core', x: 60, y: 60, hp: 1500, complete: true },
    ],
    units: [{ id: 10, owner: 0, kind: 'brute', x: 9, y: 3, order: null }],
  });
  enableAmmo(state, { stock: 0, reserve: 0 });
  stepAmmo(state);
  return state;
}

test('a Four-Slice holding 5 slices has 1 volley, and a full one (8 slices) has 2 volleys of room', () => {
  const state = setup();
  const u = observeAmmo(state, 0).units[0];
  assert.equal(u.slots, 8);
  assert.equal(u.volleySlots, 2, 'eight slots hold two volleys');
  state.ammo.slices[10] = 5;
  const v = observeAmmo(state, 0).units[0];
  assert.equal(v.slices, 5);
  assert.equal(v.volleys, 1, 'five slices is one whole volley');
  assert.equal(v.shots, 1, 'one volley left to fire');
});

test('three slices is no volley, and the Four-Slice shows none to fire', () => {
  const state = setup();
  state.ammo.slices[10] = 3;
  const v = observeAmmo(state, 0).units[0];
  assert.equal(v.volleys, 0);
  assert.equal(v.shots, 0);
});
