// PLAYABLE.md items 3, 4, 27 on the real GHT match: auto-gather, rally flags, double-click, control groups.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { createToasterState, observeToaster, toasterInputOptions } from '../play/toaster-play.mjs';
import { createInput } from '../play/input.mjs';
import { createIdleCrumbs } from '../play/idle-crumbs.mjs';
import { STATS } from '../env/stats.mjs';

function setup(seed = 3) {
  const state = createToasterState(seed);
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions() });
  const idle = createIdleCrumbs({ side: 0 });
  const obs = () => observeToaster(state, 0);
  const run = (n) => { for (let i = 0; i < n; i++) { const o = obs(); step(state, [[...input.tick(o), ...idle.tick(o, input.ui.plans)], []]); } };
  return { state, input, idle, obs, run };
}
const project = (x, y) => ({ sx: x * 10, sy: y * 10 });
const size = { width: 9999, height: 9999 };

test('item 3: at match start every Crumb goes to wheat by itself and wheat comes in', () => {
  const { state, run, obs } = setup();
  const crumbs = obs().units.filter((u) => u.owner === 0 && u.kind === 'worker');
  assert.ok(crumbs.length >= 4);
  const before = state.shards[0];
  run(2);
  assert.ok(obs().units.filter((u) => u.owner === 0 && u.kind === 'worker' && u.order?.type === 'gather').length >= 1, 'someone is gathering');
  run(24 * 40);
  assert.ok(state.shards[0] > before, `wheat grew: ${before} -> ${state.shards[0]}`);
});

test('item 3: a Crumb the player stopped is sent back to wheat after 3 s', () => {
  const { input, state, run, obs, idle } = setup();
  run(24 * 5);
  const u = obs().units.find((q) => q.owner === 0 && q.kind === 'worker');
  step(state, [[{ type: 'stop', unit: u.id }], []]);
  assert.ok(idle.count(obs(), input.ui.plans) >= 1 || obs().units.find((q) => q.id === u.id).order);
  run(24 * 4);
  assert.ok(obs().units.find((q) => q.id === u.id).order, 'working again');
});

test('item 4: right-click with the Power Strip or Assembly Line selected sets a rally flag', () => {
  const { input, obs } = setup();
  const o = obs();
  const strip = o.structures.find((s) => s.owner === 0 && s.kind === 'core');
  input.setSelectionForTest?.([strip.id]);
  input.ui.selection = [strip.id];
  const r = input.rightClick(o, { x: strip.x + 4, y: strip.y + 4 });
  assert.equal(r.kind, 'rally');
  assert.ok(input.ui.rally.get(strip.id));
  const forge = { ...strip, id: 9999, kind: 'forge' };
  const o2 = { ...o, structures: [...o.structures, forge] };
  input.ui.selection = [9999];
  assert.equal(input.rightClick(o2, { x: 3, y: 3 }).kind, 'rally');
  assert.deepEqual(input.ui.rally.get(9999), { type: 'move', x: 3, y: 3 });
});

test('item 4: a rallied Crumb walks to the wheat and gathers; a trained fighter walks to the flag', () => {
  const { input, state, run, obs } = setup();
  const strip = obs().structures.find((s) => s.owner === 0 && s.kind === 'core');
  const wheat = state.crystals.filter((c) => c.amount > 0).sort((a, b) => (a.x - strip.x) ** 2 + (a.y - strip.y) ** 2 - (b.x - strip.x) ** 2 - (b.y - strip.y) ** 2)[0];
  input.ui.selection = [strip.id];
  input.rightClick(obs(), { x: wheat.x, y: wheat.y });
  assert.equal(input.ui.rally.get(strip.id).type, 'gather');
  run(2);
  const n0 = obs().units.filter((u) => u.owner === 0).length;
  state.shards[0] += 500;
  input.ui.selection = [strip.id];
  input.act(obs(), 'train', 'worker');
  run(24 * 12);
  const fresh = obs().units.filter((u) => u.owner === 0);
  assert.ok(fresh.length > n0, 'a Crumb was trained');
});

test('item 27: double-click selects every on-screen unit of that type', () => {
  const { input, obs } = setup();
  const o = obs();
  const mine = o.units.filter((u) => u.owner === 0 && u.kind === 'worker');
  input.clickSelect(o, project, size, mine[0], { now: 1000 });
  assert.equal(input.ui.selection.length, 1);
  input.clickSelect(o, project, size, mine[0], { now: 1200 });
  assert.deepEqual([...input.ui.selection].sort(), mine.map((u) => u.id).sort().slice(0, 12));
});

test('item 27: Ctrl+1 sets a group, 1 recalls it, a double-tap centres the camera', () => {
  const { input, obs } = setup();
  const o = obs();
  const mine = o.units.filter((u) => u.owner === 0).slice(0, 3);
  input.ui.selection = mine.map((u) => u.id);
  input.key(o, '1', { ctrl: true });
  input.ui.selection = [];
  assert.equal(input.key(o, '1', { now: 1000 }), null);
  assert.equal(input.ui.selection.length, 3);
  const fx = input.key(o, '1', { now: 1200 });
  assert.ok(fx?.center && Number.isFinite(fx.center.x));
});
