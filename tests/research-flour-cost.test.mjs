// Decision 2: Flour is the second resource. Tier 2 and 3 units and buildings cost Flour; basic ones cost Wheat only.
// Flour comes out of the same pantry the Toasters bake from. Refusal code: no-flour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState } from '../play/toaster-play.mjs';
import { step } from '../env/sim.mjs';
import { flourCostOf } from '../env/research.mjs';

const toaster = (state) => state.structures.push({ id: 900, owner: 0, kind: 'toaster', x: 4, y: 4, hp: 250, complete: true, queue: [] });
const forge = (state) => { const f = { id: 800, owner: 0, kind: 'forge', x: 6, y: 6, hp: 300, complete: true, queue: [] }; state.structures.push(f); return f; };
const rejects = (state) => state.events.filter((e) => e.e === 'reject').map((e) => e.reason);

// DECISIONS.md 6: the Popper is the basic fighter, so it costs Wheat only (the other tier-2 kinds still cost Flour).
test('basic kinds cost no Flour, tier 2 and 3 kinds do', () => {
  for (const k of ['worker', 'grunt', 'mill', 'well', 'toaster', 'turret', 'windmill', 'dam']) assert.equal(flourCostOf(k), 0, k);
  for (const k of ['lancer', 'spiker', 'forge', 'pylon', 'brute', 'howler', 'dart']) assert.ok(flourCostOf(k) > 0, k);
  assert.ok(flourCostOf('brute') >= flourCostOf('lancer'), 'tier 3 costs at least tier 2');
});

test('training a Zapper with no Flour is refused no-flour and charges nothing; with Flour it takes it', () => {
  const state = createToasterState(7);
  toaster(state);
  const f = forge(state);
  state.shards[0] = 500;
  state.events = [];
  step(state, [[{ type: 'train', building: f.id, kind: 'lancer' }], []]);
  assert.deepEqual(rejects(state), ['no-flour']);
  assert.equal(f.queue.length, 0);
  state.toast.pantry[0].flour = 3;
  state.events = [];
  step(state, [[{ type: 'train', building: f.id, kind: 'lancer' }], []]);
  assert.deepEqual(rejects(state), []);
  assert.equal(f.queue.length, 1);
  assert.ok(state.toast.pantry[0].flour <= 3 - flourCostOf('lancer'), 'Flour paid');
});

test('a Popper trains with an empty pantry (Wheat only)', () => {
  const state = createToasterState(7);
  toaster(state);
  const f = forge(state);
  state.shards[0] = 500;
  state.events = [];
  step(state, [[{ type: 'train', building: f.id, kind: 'grunt' }], []]);
  assert.deepEqual(rejects(state), []);
  assert.equal(f.queue.length, 1);
});

test('cancelling a queued unit gives the Flour back', () => {
  const state = createToasterState(7);
  toaster(state);
  const f = forge(state);
  state.shards[0] = 500;
  state.toast.pantry[0].flour = 3;
  step(state, [[{ type: 'train', building: f.id, kind: 'lancer' }, { type: 'train', building: f.id, kind: 'lancer' }], []]);
  const before = state.toast.pantry[0].flour;
  step(state, [[{ type: 'cancel-train', building: f.id, index: 1 }], []]);
  assert.equal(state.toast.pantry[0].flour >= before + flourCostOf('lancer') - 1, true);
});

test('a Crumb builds an Assembly Line only with Flour in the pantry', () => {
  const state = createToasterState(7);
  toaster(state);
  const w = state.units.find((u) => u.owner === 0 && u.kind === 'worker');
  state.shards[0] = 900;
  const cmd = { type: 'build', unit: w.id, kind: 'forge', x: w.x + 2, y: w.y + 2 };
  state.events = [];
  step(state, [[cmd], []]);
  assert.deepEqual(rejects(state), ['no-flour']);
  state.toast.pantry[0].flour = 4;
  state.events = [];
  step(state, [[cmd], []]);
  assert.deepEqual(rejects(state), []);
});

test('a research that needs more Flour than the pantry holds is refused no-flour', () => {
  const state = createToasterState(7);
  const f = forge(state);
  state.shards[0] = 900;
  state.events = [];
  step(state, [[{ type: 'research', building: f.id, upgrade: 'ground-weapons-1' }], []]);
  assert.deepEqual(rejects(state), ['no-flour']);
  assert.equal(state.shards[0] >= 900, true, 'no Wheat was taken');
});
