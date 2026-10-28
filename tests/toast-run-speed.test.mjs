// Toast runs walk at the Toaster Wars Crumb speed (card 12, item 3). env/ammo.mjs read the classic worker row
// (kindStats speed 1); a Toaster Wars state plays worker speed 2 (STATS.toaster.units.worker), so runs use rowOf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { rowOf } from '../env/stats.mjs';
import { enableAmmo, stepAmmo } from '../env/ammo.mjs';

test('a toast run takes as many ticks per tile as the Toaster Wars Crumb speed', () => {
  const state = createTestState({
    width: 64, height: 64, shards: [0, 0],
    structures: [
      { id: 1, owner: 0, kind: 'core', x: 3, y: 3, hp: 1500, complete: true },
      { id: 2, owner: 1, kind: 'core', x: 60, y: 60, hp: 1500, complete: true },
    ],
    units: [
      { id: 5, owner: 0, kind: 'worker', x: 3, y: 3, order: null },
      { id: 10, owner: 0, kind: 'grunt', x: 9, y: 3, order: null },
    ],
  });
  enableAmmo(state, { stock: 10, reserve: 0 });
  stepAmmo(state);
  state.ammo.slices[10] = 0; // hungry, so the grunt asks for a load
  stepAmmo(state);
  const run = state.ammo.runs[0];
  assert.ok(run, 'a run starts');
  const perTile = rowOf(state, 'worker').speed;
  assert.equal(perTile, 2, 'the Toaster Wars Crumb speed');
  assert.equal(run.arrive - run.start, Math.ceil(6 * perTile), 'six tiles at that speed');
});
