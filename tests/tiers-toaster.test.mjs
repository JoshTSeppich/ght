// GHT tiers (SYSTEMS-DESIGN.md section 2): Strip (nothing), Kitchen (one complete Toaster), Powered (a complete
// Windmill or Dam of yours). No Hold, no foundry, sanctum or hangar. The GHT tiers stay on STATS.tiers for ?classic=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { toasterTierOf, kitchenLockReason } from '../env/tiers.mjs';

const toaster = (owner, complete = true) => ({ id: 10 + owner, owner, kind: 'toaster', x: 4, y: 4, hp: 250, complete });
const windmill = (owner) => ({ id: 30 + owner, owner, kind: 'windmill', x: 9, y: 9, range: 3 });
/** A state in the observation shape: structures with a complete flag, power points under power.view.points. */
const board = ({ structures = [], points = [] } = {}) => ({ tick: 0, structures, power: { view: { points } }, shards: { 0: 999, 1: 999 } });

test('the table: Strip is nothing, Kitchen is one complete Toaster, Powered is a Windmill or Dam', () => {
  const t = STATS.toasterTiers;
  assert.deepEqual(Object.keys(t), ['1', '2', '3']);
  assert.equal(t[1].need, null);
  assert.equal(t[2].need, 'toaster');
  assert.equal(t[3].need, 'power');
  assert.equal(t[2].needText, 'Needs a Toaster');
  assert.equal(t[3].needText, 'Needs a Windmill or Dam');
  assert.deepEqual([...t[1].unlocks].sort(), ['extension', 'mill', 'turret', 'toaster', 'well', 'windmill', 'dam', 'worker'].sort());
  assert.deepEqual([...t[2].unlocks].sort(), ['forge', 'grunt', 'lancer', 'pylon', 'spiker'].sort());
  assert.deepEqual([...t[3].unlocks].sort(), ['brute', 'dart', 'howler'].sort());
});

test('the GHT tiers stay on STATS.tiers for ?classic=1 (their tests read them)', () => {
  assert.deepEqual(STATS.tiers[2].needs, ['foundry', 'sanctum']);
  assert.equal(STATS.tiers[2].hold, 3);
});

test('toasterTierOf: each Kitchen and Powered kind sits in its tier; everything else is tier 1', () => {
  for (const kind of ['forge', 'grunt', 'lancer', 'spiker', 'pylon']) assert.equal(toasterTierOf(kind), 2, kind);
  for (const kind of ['brute', 'howler', 'dart']) assert.equal(toasterTierOf(kind), 3, kind);
  for (const kind of ['worker', 'mill', 'well', 'toaster', 'extension', 'turret', 'windmill', 'dam']) assert.equal(toasterTierOf(kind), 1, kind);
  assert.equal(toasterTierOf('nonsense'), 1);
});

test('Strip: tier 1 kinds are never locked, even on an empty board', () => {
  const empty = board();
  for (const kind of ['worker', 'mill', 'well', 'toaster', 'extension', 'turret', 'windmill', 'dam']) {
    assert.equal(kitchenLockReason(empty, 0, kind), null, kind);
  }
});

test('Kitchen: the Assembly Line and Relay Pylon say "Needs a Toaster" until a complete Toaster of yours stands', () => {
  for (const kind of ['forge', 'pylon', 'grunt', 'lancer', 'spiker']) {
    assert.equal(kitchenLockReason(board(), 0, kind), 'Needs a Toaster', kind);
  }
  assert.equal(kitchenLockReason(board({ structures: [toaster(0, false)] }), 0, 'forge'), 'Needs a Toaster', 'a Toaster still going up does not count');
  assert.equal(kitchenLockReason(board({ structures: [toaster(0)] }), 0, 'forge'), null);
  assert.equal(kitchenLockReason(board({ structures: [toaster(0)] }), 0, 'spiker'), null);
});

test('Kitchen: another side\'s Toaster opens nothing for you', () => {
  const theirs = board({ structures: [toaster(1)] });
  assert.equal(kitchenLockReason(theirs, 0, 'forge'), 'Needs a Toaster');
  assert.equal(kitchenLockReason(theirs, 1, 'forge'), null);
});

test('Powered: Four-Slice, Broiler and Bagel say "Needs a Windmill or Dam" until one of yours stands', () => {
  for (const kind of ['brute', 'howler', 'dart']) {
    assert.equal(kitchenLockReason(board({ structures: [toaster(0)] }), 0, kind), 'Needs a Windmill or Dam', kind);
  }
  assert.equal(kitchenLockReason(board({ structures: [toaster(0)], points: [windmill(1)] }), 0, 'brute'), 'Needs a Windmill or Dam', 'their windmill');
  assert.equal(kitchenLockReason(board({ structures: [toaster(0)], points: [windmill(0)] }), 0, 'brute'), null);
  assert.equal(kitchenLockReason(board({ structures: [toaster(0)], points: [{ id: 40, owner: 0, kind: 'dam', x: 1, y: 1, range: 6 }] }), 0, 'dart'), null, 'a Dam counts too');
});

test('Powered is judged on its own: a Windmill opens tier 3 without a Toaster, and no Hold is needed', () => {
  const windmillOnly = board({ points: [windmill(0)] });
  assert.equal(kitchenLockReason(windmillOnly, 0, 'brute'), null);
  assert.equal(kitchenLockReason(windmillOnly, 0, 'forge'), 'Needs a Toaster');
  const withHold = { ...board({ structures: [toaster(0)] }), holdOverride: () => 0, territory: { hold: [0, 0] } };
  assert.equal(kitchenLockReason(withHold, 0, 'forge'), null, 'Hold 0 does not lock the Kitchen');
});

test('the lock reads the power points the sim keeps too (state.power.points, no view)', () => {
  const simShaped = { tick: 0, structures: [toaster(0)], power: { points: [windmill(0)] } };
  assert.equal(kitchenLockReason(simShaped, 0, 'brute'), null);
});

test('a kind not on any list is open', () => {
  assert.equal(kitchenLockReason(board(), 0, 'not-a-kind'), null);
});
