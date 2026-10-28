// repair (card 11, item 3): a Crumb standing beside a damaged building of mine restores its hit points for Wheat, one
// tick at a time. The rate is pinned here: 2 hp for 1 Wheat per tick. Owner: construction. Tests first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestState } from '../env/state.mjs';
import { applyCommands } from '../env/commands.mjs';
import { stepGathering } from '../env/economy.mjs';

const mill = (over = {}) => ({ id: 50, owner: 0, kind: 'mill', x: 10, y: 10, complete: true, hp: 100, ...over });
const crumb = (over = {}) => ({ id: 7, owner: 0, kind: 'worker', x: 11, y: 10, ...over });
const rejects = (state) => state.events.filter((e) => e.e === 'reject').map((e) => e.reason);
const repair = { type: 'repair', unit: 7, target: 50 };

test('a Crumb beside a damaged building restores 2 hp for 1 Wheat each tick', () => {
  const state = createTestState({ width: 30, height: 30, shards: [10, 0], structures: [mill()], units: [crumb()] });
  applyCommands(state, 0, [repair]);
  assert.deepEqual(rejects(state), []);
  stepGathering(state);
  assert.equal(state.structures[0].hp, 102);
  assert.equal(state.shards[0], 9);
  assert.deepEqual(state.units[0].order, { type: 'repair', target: 50 }, 'the Crumb keeps repairing');
});

test('hit points stop at the maximum: the order ends and no more Wheat is taken', () => {
  const state = createTestState({ width: 30, height: 30, shards: [10, 0], structures: [mill({ hp: 199 })], units: [crumb()] });
  applyCommands(state, 0, [repair]);
  stepGathering(state);
  assert.equal(state.structures[0].hp, 200);
  assert.equal(state.shards[0], 9, 'one Wheat for the last point');
  assert.equal(state.units[0].order, null);
  stepGathering(state);
  assert.equal(state.shards[0], 9, 'nothing more is taken');
});

test('a Crumb not beside the building is refused', () => {
  const state = createTestState({ width: 30, height: 30, shards: [10, 0], structures: [mill()], units: [crumb({ x: 14 })] });
  applyCommands(state, 0, [repair]);
  assert.deepEqual(rejects(state), ['not-adjacent']);
  assert.equal(state.units[0].order, null);
});

test('a building at full hit points is refused', () => {
  const state = createTestState({ width: 30, height: 30, shards: [10, 0], structures: [mill({ hp: 200 })], units: [crumb()] });
  applyCommands(state, 0, [repair]);
  assert.deepEqual(rejects(state), ['full-hp']);
});

test('no Wheat, no repair: refused at the order, and nothing is taken', () => {
  const state = createTestState({ width: 30, height: 30, shards: [0, 0], structures: [mill()], units: [crumb()] });
  applyCommands(state, 0, [repair]);
  assert.deepEqual(rejects(state), ['no-wheat']);
  assert.equal(state.structures[0].hp, 100);
});

test('running dry mid-repair clears the order: the Crumb stops and says so in the order event', () => {
  const state = createTestState({ width: 30, height: 30, shards: [1, 0], structures: [mill()], units: [crumb()] });
  applyCommands(state, 0, [repair]);
  stepGathering(state);
  assert.equal(state.shards[0], 0);
  assert.equal(state.structures[0].hp, 102);
  stepGathering(state);
  assert.equal(state.structures[0].hp, 102, 'no Wheat, no hit points');
  assert.equal(state.units[0].order, null);
  assert.ok(state.events.some((e) => e.e === 'order' && e.id === 7 && e.order === null));
});

test('a building under construction, or another side\'s, is refused', () => {
  const site = createTestState({ width: 30, height: 30, shards: [10, 0], structures: [mill({ complete: false, hp: 20 })], units: [crumb()] });
  applyCommands(site, 0, [repair]);
  assert.deepEqual(rejects(site), ['not-complete']);
  const theirs = createTestState({ width: 30, height: 30, shards: [10, 0], structures: [mill({ owner: 1 })], units: [crumb()] });
  applyCommands(theirs, 0, [repair]);
  assert.deepEqual(rejects(theirs), ['not-yours']);
});

test('only a Crumb repairs: a fighter is refused', () => {
  const state = createTestState({ width: 30, height: 30, shards: [10, 0], structures: [mill()], units: [crumb({ kind: 'grunt' })] });
  applyCommands(state, 0, [repair]);
  assert.deepEqual(rejects(state), ['wrong-kind']);
});

test('a building destroyed mid-repair clears the Crumb\'s order', () => {
  const state = createTestState({ width: 30, height: 30, shards: [10, 0], structures: [mill()], units: [crumb()] });
  applyCommands(state, 0, [repair]);
  state.structures = [];
  stepGathering(state);
  assert.equal(state.units[0].order, null);
  assert.equal(state.shards[0], 10, 'no Wheat taken for a building that is gone');
});
