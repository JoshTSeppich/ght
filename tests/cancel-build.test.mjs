// cancel-build (card 11, item 2): a site of mine that is still under construction is removed and 75% of its Wheat comes
// back. A finished building cannot be cancelled. Owner: construction. Tests first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { applyCommands } from '../env/commands.mjs';
import { STATS } from '../env/stats.mjs';
import { createInput } from '../play/input.mjs';

const site = (over = {}) => ({ id: 50, owner: 0, kind: 'mill', x: 10, y: 10, complete: false, progress: 12, ...over });
const crumb = (over = {}) => ({ id: 7, owner: 0, kind: 'worker', x: 11, y: 10, order: { type: 'build', site: 50 }, ...over });
const rejects = (state) => state.events.filter((e) => e.e === 'reject').map((e) => e.reason);

test('cancelling a site removes it, refunds 75% of its cost and idles the Crumb building it', () => {
  const state = createTestState({ width: 30, height: 30, shards: [20, 0], structures: [site()], units: [crumb()] });
  applyCommands(state, 0, [{ type: 'cancel-build', building: 50 }]);
  assert.deepEqual(rejects(state), []);
  assert.equal(state.structures.length, 0, 'the site is gone');
  assert.equal(state.shards[0], 20 + Math.floor(STATS.structures.mill.cost * 0.75), 'three quarters of the Mill comes back');
  assert.equal(state.units[0].order, null, 'the Crumb goes idle');
});

test('the refund is 75% of a Toaster too, not a fixed number', () => {
  const state = createTestState({ width: 30, height: 30, shards: [0, 0], structures: [site({ id: 51, kind: 'toaster' })], units: [crumb({ order: null })] });
  applyCommands(state, 0, [{ type: 'cancel-build', building: 51 }]);
  assert.equal(state.shards[0], Math.floor(STATS.structures.toaster.cost * 0.75));
});

test('a finished building is refused: only a site can be cancelled', () => {
  const state = createTestState({ width: 30, height: 30, shards: [0, 0], structures: [site({ complete: true, progress: 60 })] });
  applyCommands(state, 0, [{ type: 'cancel-build', building: 50 }]);
  assert.deepEqual(rejects(state), ['not-a-site']);
  assert.equal(state.structures.length, 1);
  assert.equal(state.shards[0], 0, 'no refund');
});

test("another side's site is refused", () => {
  const state = createTestState({ width: 30, height: 30, shards: [0, 0], structures: [site({ owner: 1 })] });
  applyCommands(state, 0, [{ type: 'cancel-build', building: 50 }]);
  assert.deepEqual(rejects(state), ['not-yours']);
  assert.equal(state.structures.length, 1);
});

// The card: a selected site offers Cancel, a finished building does not, and the button queues the order for the sim.
test('the card offers Cancel for a selected site and queues cancel-build; a finished building gets no Cancel', () => {
  const sited = createTestState({ width: 30, height: 30, shards: [0, 0], structures: [site()] });
  const input = createInput({ side: 0, stats: STATS });
  input.ui.selection = [50];
  assert.ok(input.commandCard(sited).some((e) => e.action === 'cancel-build' && e.key === 'x'), 'Cancel is on the card');
  input.act(sited, 'cancel-build');
  assert.deepEqual(input.ui.outbox, [{ type: 'cancel-build', building: 50 }]);

  const done = createTestState({ width: 30, height: 30, shards: [0, 0], structures: [site({ complete: true, progress: 60 })] });
  const finished = createInput({ side: 0, stats: STATS });
  finished.ui.selection = [50];
  assert.ok(!finished.commandCard(done).some((e) => e.action === 'cancel-build'), 'no Cancel on a finished building');
});

test('an unknown building id is refused and changes nothing', () => {
  const state = createTestState({ width: 30, height: 30, shards: [0, 0], structures: [site()] });
  applyCommands(state, 0, [{ type: 'cancel-build', building: 999 }]);
  assert.deepEqual(rejects(state), ['bad-target']);
  assert.equal(state.structures.length, 1);
});
