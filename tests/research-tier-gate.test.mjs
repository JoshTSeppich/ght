// Research levels follow the Kitchen tiers: level 1 is open, level 2 needs a Toaster, level 3 needs a Windmill or Dam,
// and each level needs the one below it. Refusals carry the same reason codes as units (needs-toaster, needs-power).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState } from '../play/toaster-play.mjs';
import { step } from '../env/sim.mjs';
import { researchLockReason, upgradeLevel } from '../env/research.mjs';

function setup() {
  const state = createToasterState(7);
  const f = { id: 800, owner: 0, kind: 'forge', x: 6, y: 6, hp: 300, complete: true, queue: [] };
  state.structures.push(f);
  state.shards[0] = 9000;
  state.toast.pantry[0].flour = 6;
  return { state, f };
}
const buy = (state, f, upgrade) => {
  state.events = [];
  state.toast.pantry[0].flour = 6;
  step(state, [[{ type: 'research', building: f.id, upgrade }], []]);
  return state.events.filter((e) => e.e === 'reject').map((e) => e.reason);
};
const finish = (state) => { for (let i = 0; i < 3000 && state.structures.some((s) => (s.research || []).length); i++) step(state, [[], []]); };

test('level 2 without a Toaster is refused needs-earlier first, then needs-toaster once level 1 is done', () => {
  const { state, f } = setup();
  assert.deepEqual(buy(state, f, 'ground-weapons-2'), ['needs-earlier']);
  assert.deepEqual(buy(state, f, 'ground-weapons-1'), []);
  finish(state);
  assert.equal(upgradeLevel(state, 0, 'ground-weapons'), 1);
  assert.deepEqual(buy(state, f, 'ground-weapons-2'), ['needs-toaster']);
  state.structures.push({ id: 900, owner: 0, kind: 'toaster', x: 4, y: 4, hp: 250, complete: true, queue: [] });
  assert.deepEqual(buy(state, f, 'ground-weapons-2'), []);
});

test('level 3 needs a Windmill or Dam of yours, not just a Toaster', () => {
  const { state, f } = setup();
  state.structures.push({ id: 900, owner: 0, kind: 'toaster', x: 4, y: 4, hp: 250, complete: true, queue: [] });
  state.research.done[0].push('ground-armor-1', 'ground-armor-2');
  assert.deepEqual(buy(state, f, 'ground-armor-3'), ['needs-power']);
  state.power.points.push({ id: 950, owner: 1, kind: 'windmill', x: 9, y: 9, range: 3 });
  assert.deepEqual(buy(state, f, 'ground-armor-3'), ['needs-power'], "their windmill does not count");
  state.power.points.push({ id: 951, owner: 0, kind: 'windmill', x: 9, y: 10, range: 3 });
  assert.deepEqual(buy(state, f, 'ground-armor-3'), []);
});

test('the card helper names the lock in the words of the Kitchen', () => {
  const { state } = setup();
  assert.equal(researchLockReason(state, 0, 'ground-weapons-1'), null);
  state.research.done[0].push('ground-weapons-1');
  assert.equal(researchLockReason(state, 0, 'ground-weapons-2'), 'Needs a Toaster');
  assert.equal(researchLockReason(state, 0, 'ground-weapons-1'), 'Done');
});

test('every track has levels 1 to 3 with rising tiers', async () => {
  const { researchRow, RESEARCH_TRACKS } = await import('../env/research.mjs');
  for (const t of RESEARCH_TRACKS) {
    for (const n of [1, 2, 3]) {
      const r = researchRow(`${t}-${n}`);
      assert.ok(r, `${t}-${n} exists`);
      assert.equal(r.tier, n);
      assert.equal(r.level, n);
    }
  }
});
