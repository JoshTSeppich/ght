// Controls B (ROLE-CARDS section 7, items B1-B2): selection and orders. Alt+number steals units from other groups,
// Ctrl+click picks every unit of a type on screen, box select takes a building when no unit is inside, F2 is not capped
// at 12, Ctrl+F1 lists every idle Crumb, and right-click on a friendly unit follows it. The page (play/app.mjs) owns the
// browser events; the decisions are pure in play/input.mjs, so each one is pinned here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createInput, MAX_SELECT } from '../play/input.mjs';
import { createIdleCrumbs } from '../play/idle-crumbs.mjs';

const base = (extra = {}) => ({
  tick: 0, width: 60, height: 60, rocks: [], crystals: [], shards: { 0: 999, 1: 999 }, units: [], structures: [], ...extra,
});
// Screen = tile x 10, so a box in pixels maps straight onto tiles.
const project = (x, y) => ({ sx: x * 10, sy: y * 10 });
const ALL = { x0: 0, y0: 0, x1: 600, y1: 600 };
const SIZE = { width: 600, height: 600 };
const make = () => createInput({ side: 0, stats: STATS });

test('B1: Alt+number makes a group and takes those units out of every other group', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null },
    { id: 2, owner: 0, kind: 'grunt', x: 6, y: 5, hp: 10, order: null },
  ] });
  const input = make();
  input.ui.selection = [1, 2];
  input.key(state, '1', { ctrl: true });            // group 1 = 1, 2
  input.ui.selection = [1];
  input.key(state, '2', { alt: true });             // Alt+2: group 2 = 1, and 1 leaves group 1
  assert.deepEqual(input.ui.groups['1'], [2]);
  assert.deepEqual(input.ui.groups['2'], [1]);
});

test('B1: Ctrl+number still leaves the other groups alone (only Alt steals)', () => {
  const state = base({ units: [{ id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null }] });
  const input = make();
  input.ui.selection = [1];
  input.key(state, '1', { ctrl: true });
  input.key(state, '2', { ctrl: true });
  assert.deepEqual(input.ui.groups['1'], [1]);
  assert.deepEqual(input.ui.groups['2'], [1]);
});

test('B2: Ctrl+click selects every unit of that type on screen, not just the one clicked', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null },
    { id: 2, owner: 0, kind: 'grunt', x: 9, y: 9, hp: 10, order: null },
    { id: 3, owner: 0, kind: 'worker', x: 7, y: 7, hp: 10, order: null },
  ] });
  const input = make();
  input.clickSelect(state, project, SIZE, state.units[0], { ctrl: true, now: 1000 });
  assert.deepEqual(input.ui.selection.sort(), [1, 2]);
});

test('B2: a plain click on one unit still selects only that unit', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null },
    { id: 2, owner: 0, kind: 'grunt', x: 9, y: 9, hp: 10, order: null },
  ] });
  const input = make();
  input.clickSelect(state, project, SIZE, state.units[0], { now: 1000 });
  assert.deepEqual(input.ui.selection, [1]);
});

test('B2: a box with no unit in it selects a building of mine', () => {
  const state = base({
    units: [{ id: 1, owner: 1, kind: 'grunt', x: 20, y: 20, hp: 10, order: null }],
    structures: [{ id: 7, owner: 0, kind: 'mill', x: 3, y: 3, hp: 100, complete: true, queue: [] }],
  });
  const input = make();
  input.boxSelect(state, project, { x0: 40, y0: 40, x1: 50, y1: 50 });  // misses the mill (screen 30,30) and the enemy grunt
  assert.deepEqual(input.ui.selection, []);
  input.boxSelect(state, project, { x0: 0, y0: 0, x1: 50, y1: 50 });
  assert.deepEqual(input.ui.selection, [7]);
});

test('B2: a box with units in it still takes the units, not the buildings', () => {
  const state = base({
    units: [{ id: 1, owner: 0, kind: 'grunt', x: 3, y: 3, hp: 10, order: null }],
    structures: [{ id: 7, owner: 0, kind: 'mill', x: 3, y: 4, hp: 100, complete: true, queue: [] }],
  });
  const input = make();
  input.boxSelect(state, project, ALL);
  assert.deepEqual(input.ui.selection, [1]);
});

test('B2: F2 selects every fighter, past the 12 cap that holds for other selections', () => {
  const units = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, owner: 0, kind: 'grunt', x: 2 + i, y: 2, hp: 10, order: null }));
  const state = base({ units });
  const input = make();
  assert.equal(MAX_SELECT, 12);
  input.key(state, 'F2');
  assert.equal(input.ui.selection.length, 14);
});

test('B2: F3 still holds at most 12 Crumbs', () => {
  const units = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, owner: 0, kind: 'worker', x: 2 + i, y: 2, hp: 10, order: null }));
  const input = make();
  input.key(base({ units }), 'F3');
  assert.equal(input.ui.selection.length, MAX_SELECT);
});

test('B2: Ctrl+F1 lists every idle Crumb (the list the page selects)', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'worker', x: 5, y: 5, hp: 10, order: null },
    { id: 2, owner: 0, kind: 'worker', x: 6, y: 5, hp: 10, order: null },
    { id: 3, owner: 0, kind: 'worker', x: 7, y: 5, hp: 10, order: { type: 'gather', x: 9, y: 9 } },
  ] });
  const input = make();
  const idle = createIdleCrumbs({ side: 0 }).idle(state, input.ui.plans).map((u) => u.id);
  assert.deepEqual(idle, [1, 2]);
});

test('B2: Ctrl+F1 invocation selects every idle Crumb', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'worker', x: 5, y: 5, hp: 10, order: null },
    { id: 2, owner: 0, kind: 'worker', x: 6, y: 5, hp: 10, order: null },
    { id: 3, owner: 0, kind: 'worker', x: 7, y: 5, hp: 10, order: { type: 'gather', x: 9, y: 9 } },
  ] });
  const input = make();
  const idle = createIdleCrumbs({ side: 0 }).idle(state, input.ui.plans).map((u) => u.id);
  input.key(state, 'F1', { ctrl: true, idleIds: idle });
  assert.deepEqual(input.ui.selection, [1, 2]);
});

test('B2: right-click on a friendly unit follows it, and the follower keeps up', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null },
    { id: 2, owner: 0, kind: 'grunt', x: 20, y: 5, hp: 10, order: null },
  ] });
  const input = make();
  input.ui.selection = [1];
  const r = input.rightClick(state, { x: 20, y: 5, entity: state.units[1] });
  assert.equal(r.kind, 'follow');
  const first = input.tick(state);
  assert.deepEqual(first.filter((c) => c.unit === 1), [{ type: 'move', unit: 1, x: 20, y: 5 }]);
  // The target moved on and the follower is idle again: it heads for the new spot.
  state.units[1].x = 30;
  const again = input.tick({ ...state, tick: 5 });
  assert.deepEqual(again.filter((c) => c.unit === 1), [{ type: 'move', unit: 1, x: 30, y: 5 }]);
});

test('B2: a follower within 2 tiles of its target stops (no move order)', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null },
    { id: 2, owner: 0, kind: 'grunt', x: 6, y: 5, hp: 10, order: null },
  ] });
  const input = make();
  input.ui.selection = [1];
  input.rightClick(state, { x: 6, y: 5, entity: state.units[1] });
  assert.deepEqual(input.tick(state).filter((c) => c.unit === 1), []);
});

test('B2: a plain right-click on open ground is still a move, not a follow', () => {
  const state = base({ units: [{ id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null }] });
  const input = make();
  input.ui.selection = [1];
  assert.equal(input.rightClick(state, { x: 12, y: 12 }).kind, 'move');
});

test('B2: Shift+right-click on the minimap queues a follow after the current order', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null },
    { id: 2, owner: 0, kind: 'grunt', x: 20, y: 5, hp: 10, order: null },
  ] });
  const input = make();
  input.ui.selection = [1];
  input.rightClick(state, { x: 12, y: 12 });
  input.rightClick(state, { x: 20, y: 5, entity: state.units[1] }, { shift: true });
  assert.equal(input.ui.plans.get(1).queue.length, 2);
});

test('B2: an already-busy follower (gather order) still follows when right-clicked without Shift', () => {
  const state = base({ units: [
    { id: 1, owner: 0, kind: 'worker', x: 5, y: 5, hp: 10, order: { type: 'gather', x: 10, y: 10 } },
    { id: 2, owner: 0, kind: 'worker', x: 20, y: 5, hp: 10, order: null },
  ], crystals: [{ x: 10, y: 10, amount: 100 }] });
  const input = make();
  input.ui.selection = [1];
  // Unit 1 is gathering; right-click on unit 2 without Shift to follow
  input.rightClick(state, { x: 20, y: 5, entity: state.units[1] });
  // The follow order should be queued
  assert.equal(input.ui.plans.get(1).queue.length, 1);
  assert.equal(input.ui.plans.get(1).queue[0].type, 'follow');
  // After the unit finishes gathering and becomes idle, it should move to follow
  state.units[0].order = null;
  const cmds = input.tick({ ...state, tick: 10 });
  const follows = cmds.filter((c) => c.unit === 1 && c.type === 'move');
  assert.equal(follows.length, 1, 'should send a move command to follow after gathering ends');
});
