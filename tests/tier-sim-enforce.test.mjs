// Toaster Wars tiers enforced by the sim (ROLE-CARDS section 3): a Kitchen kind the side has no tier for is refused
// with 'needs-toaster' or 'needs-power', whatever the page sends. Driftfall (noTiers off) keeps its Hold rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRuleCommands, createTerritoryMatch } from '../env/sim-territory.mjs';
import { createToasterState } from '../play/toaster-play.mjs';

const toaster = (owner) => ({ id: 900 + owner, owner, kind: 'toaster', x: 4, y: 4, hp: 250, complete: true });
const windmill = (owner) => ({ id: 950 + owner, owner, kind: 'windmill', x: 9, y: 9, range: 3 });

/** Run one side's commands through the sim's rule step; return the Kitchen refusals only (other reasons are not this test's). */
function refusals(state, player, commands) {
  state.events = [];
  applyRuleCommands(state, player, commands);
  return state.events.filter((e) => e.e === 'reject' && e.reason.startsWith('needs-')).map((e) => e.reason);
}

test('Toaster Wars: Four-Slice (brute) is refused needs-power with no Windmill or Dam of yours', () => {
  const state = createToasterState(7);
  assert.deepEqual(refusals(state, 0, [{ type: 'train', building: 1, kind: 'brute' }]), ['needs-power']);
});

test('Toaster Wars: a Popper (grunt) is refused needs-toaster until a complete Toaster of yours stands', () => {
  const state = createToasterState(7);
  assert.deepEqual(refusals(state, 0, [{ type: 'train', building: 1, kind: 'grunt' }]), ['needs-toaster']);
  state.structures.push(toaster(0));
  assert.deepEqual(refusals(state, 0, [{ type: 'train', building: 1, kind: 'grunt' }]), []);
});

test('Toaster Wars: a Relay Pylon is refused needs-toaster with no Toaster, and the Toaster itself is not locked', () => {
  const state = createToasterState(7);
  const w = state.units.find((u) => u.owner === 0 && u.kind === 'worker');
  const pylon = { type: 'place-power', unit: w.id, kind: 'pylon', x: w.x + 1, y: w.y };
  assert.deepEqual(refusals(state, 0, [pylon]), ['needs-toaster']);
  const toasterBuild = { type: 'build', kind: 'toaster', x: w.x + 1, y: w.y };
  assert.deepEqual(refusals(state, 0, [toasterBuild]), [], 'tier 1 kinds are open from the start');
});

test('Toaster Wars: a Windmill or Dam of yours opens the Powered kinds; another side\'s does not', () => {
  const state = createToasterState(7);
  state.power.points.push(windmill(1));
  assert.deepEqual(refusals(state, 0, [{ type: 'train', building: 1, kind: 'brute' }]), ['needs-power'], 'their windmill');
  state.power.points.push(windmill(0));
  assert.deepEqual(refusals(state, 0, [{ type: 'train', building: 1, kind: 'brute' }]), [], 'your windmill');
});

test('a refused Kitchen build is not handed on to commands.mjs; an accepted one is', () => {
  const state = createToasterState(7);
  const build = { type: 'build', kind: 'forge', x: 3, y: 3 };
  state.events = [];
  assert.deepEqual(applyRuleCommands(state, 0, [build]), [], 'refused: nothing is left for commands.mjs');
  assert.deepEqual(state.events.filter((e) => e.e === 'reject').map((e) => e.reason), ['needs-toaster']);
  state.structures.push(toaster(0));
  state.events = [];
  assert.deepEqual(applyRuleCommands(state, 0, [build]), [build], 'accepted: the build goes on');
  assert.equal(state.events.filter((e) => e.e === 'reject').length, 0);
});

// Research and Flour (M3): a scripted client cannot skip a research tier or a Flour price either.
test('a scripted client cannot buy level 3 research, or train a tier 2 unit, by sending the raw command', () => {
  const state = createToasterState(7);
  const f = { id: 800, owner: 0, kind: 'forge', x: 6, y: 6, hp: 300, complete: true, queue: [] };
  state.structures.push(f);
  state.shards[0] = 9000;
  state.toast.pantry[0].flour = 6;
  state.research.done[0].push('ground-weapons-1', 'ground-weapons-2');
  const codes = (cmds) => { state.events = []; applyRuleCommands(state, 0, cmds); return state.events.filter((e) => e.e === 'reject').map((e) => e.reason); };
  assert.deepEqual(codes([{ type: 'research', building: f.id, upgrade: 'ground-weapons-3' }]), ['needs-power']);
  assert.deepEqual(codes([{ type: 'train', building: f.id, kind: 'grunt' }]), ['needs-toaster']);
  assert.deepEqual(codes([{ type: 'research', building: f.id, upgrade: 'ground-weapons-2' }]), ['already-done']);
});

test('Driftfall (noTiers off) keeps its Hold rule and does not read the Kitchen tiers', () => {
  const state = createTerritoryMatch(7);
  assert.equal(state.noTiers, undefined);
  assert.deepEqual(refusals(state, 0, [{ type: 'train', building: 1, kind: 'brute' }]).filter((r) => r.startsWith('needs-')), []);
});
