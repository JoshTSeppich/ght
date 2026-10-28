// Card 8 item 4: a match result plays one stinger. A Toaster Wars win has the synth jingle only; every other result
// (Toaster Wars loss, any non-Toaster win or loss) has exactly one sample stinger. Draws play nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resultStingers } from '../play/toaster-sounds.mjs';

test('a Toaster Wars win plays the synth jingle and no sample stinger', () => {
  assert.deepEqual(resultStingers({ winner: 0 }, 0, true), { synth: 'jingle', sample: null });
});

test('a Toaster Wars loss plays the sample defeat stinger and no jingle', () => {
  assert.deepEqual(resultStingers({ winner: 1 }, 0, true), { synth: null, sample: 'defeat' });
});

test('a non-Toaster win plays the sample victory stinger only', () => {
  assert.deepEqual(resultStingers({ winner: 0 }, 0, false), { synth: null, sample: 'victory' });
});

test('a non-Toaster loss plays the sample defeat stinger only', () => {
  assert.deepEqual(resultStingers({ winner: 1 }, 0, false), { synth: null, sample: 'defeat' });
});

test('a draw or a missing result plays nothing', () => {
  assert.deepEqual(resultStingers({ winner: null }, 0, true), { synth: null, sample: null });
  assert.deepEqual(resultStingers(null, 0, false), { synth: null, sample: null });
});

test('every result plays at most one stinger', () => {
  for (const toasterOn of [true, false]) {
    for (const winner of [0, 1, null]) {
      const s = resultStingers({ winner }, 0, toasterOn);
      assert.ok((s.synth ? 1 : 0) + (s.sample ? 1 : 0) <= 1, `winner ${winner} toaster ${toasterOn}`);
    }
  }
});
