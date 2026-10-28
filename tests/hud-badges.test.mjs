// Blinking "what is missing" badges (hud-badges.mjs): the 'full' badge follows the pantry cap, which grows with each complete Toaster.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState } from '../play/toaster-play.mjs';
import { badgesFor } from '../play/hud-badges.mjs';
import { pantryCapOf, BAKERY } from '../env/bakery.mjs';

const fresh = () => {
  const s = createToasterState(7);
  s.structures = s.structures.filter((b) => !(b.kind === 'toaster' && b.owner === 0));
  s.shards[0] = 500;
  return s;
};
const add = (s, kind, x, y, over = {}) => {
  const b = { id: 900 + s.structures.length, owner: 0, kind, x, y, hp: 200, progress: 0, complete: true, queue: [], ...over };
  s.structures.push(b); return b;
};
const iconsOf = (s, id) => Object.fromEntries(badgesFor(s, 0).map((x) => [x.id, x.icons]))[id];

test('a Mill with the flat six flour and no Toaster is full; the cap is six until a Toaster is complete', () => {
  const s = fresh();
  const mill = add(s, 'mill', 20, 20);
  s.toast.pantry[0].flour = BAKERY.pantryCap;
  assert.equal(pantryCapOf(s, 0), 6);
  assert.deepEqual(iconsOf(s, mill.id), ['full']);
});

test('with a complete Toaster the cap is nine, so six flour is not full and the Mill is not badged', () => {
  const s = fresh();
  const mill = add(s, 'mill', 20, 20);
  add(s, 'toaster', 24, 20);
  s.toast.pantry[0].flour = BAKERY.pantryCap;
  assert.equal(pantryCapOf(s, 0), 9);
  assert.equal(iconsOf(s, mill.id), undefined, 'no badge: the Mill still grinds');
  s.toast.pantry[0].flour = 9;
  assert.deepEqual(iconsOf(s, mill.id), ['full'], 'full at nine');
});

test('a Well is full at the grown cap, not the flat six', () => {
  const s = fresh();
  const well = add(s, 'well', 22, 20);
  add(s, 'toaster', 24, 20);
  s.toast.pantry[0].water = 8;
  assert.equal(iconsOf(s, well.id), undefined, 'eight water with a Toaster: not full');
  s.toast.pantry[0].water = 9;
  assert.deepEqual(iconsOf(s, well.id), ['full']);
});

test('an incomplete Toaster does not lift the cap', () => {
  const s = fresh();
  const mill = add(s, 'mill', 20, 20);
  add(s, 'toaster', 24, 20, { complete: false });
  s.toast.pantry[0].flour = BAKERY.pantryCap;
  assert.deepEqual(iconsOf(s, mill.id), ['full']);
});
