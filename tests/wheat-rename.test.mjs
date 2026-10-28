// Wheat rename (PLAYABLE item 2, owner: haiku). The player and the bots say Wheat; the state field stays `shards`
// (a TODO marks it) and observe() keeps `shards` as an alias so old bots and tests still pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, observe } from '../env/state.mjs';
import { toasterOptions, toasterTopBar } from '../play/toaster-play.mjs';

const q = (s = '') => new URLSearchParams(s);

test('observe(): wheat is the same numbers as shards, for both sides', () => {
  const s = createInitialState(6);
  s.shards[0] = 137;
  s.shards[1] = 42;
  const o = observe(s, 0);
  assert.deepEqual(o.wheat, [137, 42]);
  assert.deepEqual(o.wheat, o.shards, 'shards stays as an alias');
});

test('observe(): wheat is a copy, not the live state array', () => {
  const s = createInitialState(6);
  const before = s.shards[0];
  const o = observe(s, 0);
  s.shards[0] = before + 999;
  assert.equal(o.wheat[0], before);
  assert.equal(o.shards[0], before);
});

test('the toaster top bar says Wheat and never Shards', () => {
  const s = toasterOptions(q('')).createState(7);
  const html = toasterTopBar(s, { side: 0 });
  assert.match(html, /Wheat/);
  assert.doesNotMatch(html, /Shards/);
});
