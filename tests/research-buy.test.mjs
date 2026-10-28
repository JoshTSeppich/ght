// Research on GHT (M3): the Assembly Line queues Ground Weapons 1, it costs Wheat + Flour, it finishes, and
// upgradeLevel() reads the result. The /play state keeps state.research (it used to be deleted).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState, createPlayableState } from '../play/toaster-play.mjs';
import { step } from '../env/sim.mjs';
import { upgradeLevel, researchRow, RESEARCH_TRACKS } from '../env/research.mjs';

const forge = (state, owner = 0) => {
  const f = { id: 800 + owner, owner, kind: 'forge', x: 6, y: 6, hp: 300, complete: true, queue: [] };
  state.structures.push(f);
  return f;
};
const toaster = (state, owner = 0) => state.structures.push({ id: 900 + owner, owner, kind: 'toaster', x: 4, y: 4, hp: 250, complete: true, queue: [] });
const rejects = (state) => state.events.filter((e) => e.e === 'reject').map((e) => e.reason);

test('/play keeps state.research and every level starts at 0', () => {
  for (const make of [createToasterState, createPlayableState]) {
    const state = make(7);
    assert.ok(state.research, 'state.research is kept');
    for (const t of RESEARCH_TRACKS) assert.equal(upgradeLevel(state, 0, t), 0);
  }
});

test('Ground Weapons 1 at the Assembly Line costs Wheat + Flour, finishes, and raises upgradeLevel to 1', () => {
  const state = createToasterState(7);
  const f = forge(state);
  const row = researchRow('ground-weapons-1');
  assert.ok(row.cost.wheat > 0 && row.cost.flour > 0, 'paid in both');
  state.shards[0] = 500;
  state.toast.pantry[0].flour = 6;
  state.events = [];
  step(state, [[{ type: 'research', building: f.id, upgrade: 'ground-weapons-1' }], []]);
  assert.deepEqual(rejects(state), []);
  assert.equal(state.shards[0] < 500 - row.cost.wheat + 5, true, 'Wheat paid');
  assert.equal(state.toast.pantry[0].flour <= 6 - row.cost.flour, true, 'Flour paid');
  assert.equal(upgradeLevel(state, 0, 'ground-weapons'), 0, 'not done yet');
  assert.equal(f.research.length, 1);
  for (let i = 0; i < row.ticks + 2; i++) step(state, [[], []]);
  assert.equal(upgradeLevel(state, 0, 'ground-weapons'), 1);
  assert.equal(upgradeLevel(state, 1, 'ground-weapons'), 0, 'the other side is untouched');
  assert.equal(upgradeLevel(state, 0, 'ground-armor'), 0);
});

test('a research already done or already queued is refused', () => {
  const state = createToasterState(7);
  const f = forge(state);
  state.shards[0] = 2000;
  state.toast.pantry[0].flour = 6;
  state.events = [];
  step(state, [[{ type: 'research', building: f.id, upgrade: 'ground-weapons-1' }, { type: 'research', building: f.id, upgrade: 'ground-weapons-1' }], []]);
  assert.deepEqual(rejects(state), ['already-queued']);
});

test('research is refused for a building that is not yours, not finished, or the wrong one for the track', () => {
  const state = createToasterState(7);
  const mine = forge(state);
  const theirs = forge(state, 1);
  state.shards[0] = 2000;
  state.toast.pantry[0].flour = 6;
  const tryOne = (cmd) => { state.events = []; step(state, [[cmd], []]); return rejects(state); };
  assert.deepEqual(tryOne({ type: 'research', building: theirs.id, upgrade: 'ground-weapons-1' }), ['not-yours']);
  assert.deepEqual(tryOne({ type: 'research', building: 1, upgrade: 'ground-weapons-1' }), ['wrong-building'], 'the Strip researches nothing');
  assert.deepEqual(tryOne({ type: 'research', building: mine.id, upgrade: 'air-weapons-1' }), ['wrong-building'], 'air needs the Cooling Rack');
  assert.deepEqual(tryOne({ type: 'research', building: mine.id, upgrade: 'nonsense' }), ['bad-target']);
  mine.complete = false;
  assert.deepEqual(tryOne({ type: 'research', building: mine.id, upgrade: 'ground-weapons-1' }), ['not-complete']);
});

test('the queue holds three and refuses a fourth', () => {
  const state = createToasterState(7);
  const f = forge(state);
  state.shards[0] = 5000;
  state.toast.pantry[0].flour = 6;
  state.events = [];
  const ids = ['ground-weapons-1', 'ground-armor-1', 'structure-armor-1', 'popper-range'];
  step(state, [ids.map((upgrade) => ({ type: 'research', building: f.id, upgrade })), []]);
  assert.deepEqual(rejects(state).length > 0, true);
  assert.equal(f.research.length <= 3, true);
});

test('unit researches exist for the dead-end units and give a number to read', async () => {
  const { unitMod } = await import('../env/research.mjs');
  const state = createToasterState(7);
  state.research.done[0].push('popper-range');
  assert.equal(unitMod(state, 0, 'grunt', 'rangeBonus') > 0, true);
  assert.equal(unitMod(state, 1, 'grunt', 'rangeBonus'), 0);
  assert.equal(unitMod(state, 0, 'lancer', 'rangeBonus'), 0);
});
