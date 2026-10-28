// Toaster Wars input: a click on a locked button refuses with its reason; the first slice and the first power each toast once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createInput } from '../play/input.mjs';
import { toasterInputOptions } from '../play/toaster-play.mjs';

const TOAST_KITCHEN = 'Kitchen open: the Assembly Line is yours';
const TOAST_POWER = 'Power is up: the Four-Slice, Broiler and Bagel are yours';

const crumbState = (extra = {}) => ({
  tick: 0, width: 40, height: 40, rocks: [], crystals: [], shards: { 0: 999, 1: 999 },
  units: [{ id: 1, owner: 0, kind: 'worker', x: 5, y: 5, hp: 10 }], structures: [], ...extra,
});
const toaster = { id: 4, owner: 0, kind: 'toaster', x: 2, y: 8, hp: 250, complete: true };
const selectCrumb = (input) => { input.ui.selection = [1]; return input; };
const kitchen = () => createInput({ side: 0, stats: STATS, ...toasterInputOptions() });

test('a click on the locked Assembly Line says "Needs a Toaster" and queues nothing', () => {
  const i = selectCrumb(kitchen());
  i.act(crumbState(), 'build', 'forge');
  assert.equal(i.ui.message?.text, 'Needs a Toaster');
  assert.equal(i.ui.mode, null);
  assert.equal(i.ui.outbox.length, 0);
});

test('a click on a Crumb build with too little Wheat says "Not enough Wheat (75)"', () => {
  const i = selectCrumb(kitchen());
  i.act(crumbState({ shards: { 0: 30, 1: 999 } }), 'build', 'mill');
  assert.equal(i.ui.message?.text, 'Not enough Wheat (75)');
  assert.equal(i.ui.mode, null);
});

test('a click on an open Mill starts placing it', () => {
  const i = selectCrumb(kitchen());
  i.act(crumbState(), 'build', 'mill');
  assert.deepEqual(i.ui.mode, { type: 'place', kind: 'mill' });
});

test('with a complete Toaster the Assembly Line opens for placing', () => {
  const i = selectCrumb(kitchen());
  i.act(crumbState({ structures: [toaster] }), 'build', 'forge');
  assert.deepEqual(i.ui.mode, { type: 'place', kind: 'forge' });
});

test('a locked Four-Slice train at the Assembly Line says "Needs a Windmill or Dam" and queues nothing', () => {
  const i = kitchen();
  i.ui.selection = [3];
  const forge = { id: 3, owner: 0, kind: 'forge', x: 8, y: 8, hp: 400, complete: true, queue: [] };
  i.act(crumbState({ units: [], structures: [forge, toaster] }), 'train', 'brute');
  assert.equal(i.ui.message?.text, 'Needs a Windmill or Dam');
  assert.equal(i.ui.outbox.length, 0);
});

test('the first slice toasts the Kitchen line once; a second slice and a pilot slice do not toast again', () => {
  const i = kitchen();
  const s = crumbState({ structures: [toaster] });
  i.noteEvents(s, [{ e: 'bake', player: 0, id: 4, slices: 4, stack: 12 }]);
  assert.equal(i.ui.message?.text, TOAST_KITCHEN);
  i.ui.message = null;
  i.noteEvents(s, [{ e: 'bake', player: 0, id: 4, slices: 4, stack: 16 }]);
  assert.equal(i.ui.message, null, 'second slice: no toast');
});

test('a pilot slice from the Strip alone does not open the Kitchen toast', () => {
  const i = kitchen();
  i.noteEvents(crumbState(), [{ e: 'bake', player: 0, id: 2, slices: 1, stack: 9, pilot: true }]);
  assert.equal(i.ui.message, null);
  i.noteEvents(crumbState({ structures: [toaster] }), [{ e: 'bake', player: 0, id: 4, slices: 4, stack: 13 }]);
  assert.equal(i.ui.message?.text, TOAST_KITCHEN, 'the first Toaster slice still toasts');
});

test('another side\'s slice does not toast for you', () => {
  const i = kitchen();
  i.noteEvents(crumbState(), [{ e: 'bake', player: 1, id: 7, slices: 4, stack: 12 }]);
  assert.equal(i.ui.message, null);
});

test('the first Windmill toasts the Powered line once; the second Windmill does not', () => {
  const i = kitchen();
  const place = (point) => ({ e: 'place-power', point });
  i.noteEvents(crumbState(), [place({ id: 9, owner: 0, kind: 'windmill', x: 1, y: 1, range: 3 })]);
  assert.equal(i.ui.message?.text, TOAST_POWER);
  i.ui.message = null;
  i.noteEvents(crumbState(), [place({ id: 10, owner: 0, kind: 'windmill', x: 2, y: 1, range: 3 })]);
  assert.equal(i.ui.message, null);
});

test('the first Dam also toasts the Powered line (either one unlocks tier 3)', () => {
  const i = kitchen();
  i.noteEvents(crumbState(), [{ e: 'place-power', point: { id: 11, owner: 0, kind: 'dam', x: 3, y: 3, range: 6 } }]);
  assert.equal(i.ui.message?.text, TOAST_POWER);
});

test('a Windmill of the other side does not toast for you', () => {
  const i = kitchen();
  i.noteEvents(crumbState(), [{ e: 'place-power', point: { id: 12, owner: 1, kind: 'windmill', x: 3, y: 3, range: 3 } }]);
  assert.equal(i.ui.message, null);
});

test('Classic cards (no stations) carry no lock fields, so the classic path is unchanged', () => {
  const i = createInput({ side: 0, stats: STATS });
  i.ui.selection = [1];
  const card = i.commandCard(crumbState());
  assert.ok(card.length > 0);
  for (const e of card) assert.equal('locked' in e, false, e.kind ?? e.action);
});
