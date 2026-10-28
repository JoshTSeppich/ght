// H2 (SYSTEMS-DESIGN.md section 4): the global keys. F2 every fighter, F3 every Crumb, Backspace cycles the Power Strip
// then each Toaster, Tab cycles the unit types inside the selection, digits 0-9 are groups (Ctrl sets, Shift adds).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createInput, MAX_SELECT } from '../play/input.mjs';

const base = (extra = {}) => ({
  tick: 0, width: 60, height: 60, rocks: [], crystals: [], shards: { 0: 999, 1: 999 }, units: [], structures: [], ...extra,
});
const unit = (id, owner, kind, x = 5, y = 5) => ({ id, owner, kind, x, y, hp: 10, order: null });
const struct = (id, owner, kind, x, y) => ({ id, owner, kind, x, y, hp: 100, complete: true, queue: [] });
const make = () => createInput({ side: 0, stats: STATS });

test('F2 selects every fighter of mine: not Crumbs, not the enemy, not buildings', () => {
  const state = base({
    units: [unit(1, 0, 'worker'), unit(2, 0, 'grunt'), unit(3, 0, 'brute'), unit(4, 1, 'grunt'), unit(5, 0, 'dart')],
    structures: [struct(6, 0, 'toaster', 9, 9)],
  });
  const input = make();
  assert.equal(input.key(state, 'F2'), null);
  assert.deepEqual(input.ui.selection, [2, 3, 5]);
});

test('F2 with Shift adds the fighters to the selection', () => {
  const state = base({ units: [unit(1, 0, 'worker'), unit(2, 0, 'grunt'), unit(3, 0, 'brute')] });
  const input = make();
  input.ui.selection = [1];
  input.key(state, 'F2', { shift: true });
  assert.deepEqual(input.ui.selection, [1, 2, 3]);
});

// M6 / ROLE-CARDS B2: F2 has no 12 cap; the cap stays on F3 (Crumbs) and says how many it dropped.
test('F2 selects every fighter with no cap; F3 keeps the selection cap and says how many it dropped', () => {
  const fighters = Array.from({ length: MAX_SELECT + 2 }, (_, i) => unit(i + 1, 0, 'grunt'));
  const f2 = make();
  f2.key(base({ units: fighters }), 'F2');
  assert.equal(f2.ui.selection.length, MAX_SELECT + 2);
  const crumbs = Array.from({ length: MAX_SELECT + 2 }, (_, i) => unit(i + 1, 0, 'worker'));
  const f3 = make();
  f3.key(base({ units: crumbs }), 'F3');
  assert.equal(f3.ui.selection.length, MAX_SELECT);
  assert.match(f3.ui.message.text, /12 of 14/);
});

test('F3 selects every Crumb of mine and nothing else', () => {
  const state = base({ units: [unit(1, 0, 'worker'), unit(2, 0, 'grunt'), unit(3, 1, 'worker'), unit(7, 0, 'worker')] });
  const input = make();
  input.key(state, 'F3');
  assert.deepEqual(input.ui.selection, [1, 7]);
});

test('F3 with no Crumbs of mine says so and keeps the selection', () => {
  const input = make();
  input.ui.selection = [2];
  input.key(base({ units: [unit(2, 0, 'grunt')] }), 'F3');
  assert.deepEqual(input.ui.selection, [2]);
  assert.match(input.ui.message.text, /No Crumbs/);
});

test('Backspace cycles the Power Strip, then each Toaster, and jumps the camera to it', () => {
  const state = base({
    structures: [struct(2, 0, 'core', 4, 4), struct(6, 0, 'toaster', 20, 8), struct(8, 0, 'toaster', 30, 12), struct(9, 1, 'toaster', 50, 50)],
  });
  const input = make();
  assert.deepEqual(input.key(state, 'Backspace'), { center: { x: 4, y: 4 } });
  assert.deepEqual(input.ui.selection, [2]);
  assert.deepEqual(input.key(state, 'Backspace'), { center: { x: 20, y: 8 } });
  assert.deepEqual(input.ui.selection, [6]);
  assert.deepEqual(input.key(state, 'Backspace'), { center: { x: 30, y: 12 } });
  assert.deepEqual(input.key(state, 'Backspace'), { center: { x: 4, y: 4 } }, 'wraps back to the Power Strip');
  assert.deepEqual(input.ui.selection, [2]);
});

test('Backspace with no Power Strip standing goes to the Toasters only', () => {
  const state = base({ structures: [struct(6, 0, 'toaster', 20, 8)] });
  const input = make();
  assert.deepEqual(input.key(state, 'Backspace'), { center: { x: 20, y: 8 } });
  assert.deepEqual(input.key(state, 'Backspace'), { center: { x: 20, y: 8 } });
});

test('Tab cycles the unit types inside the selection, and only those', () => {
  const state = base({ units: [unit(1, 0, 'worker'), unit(2, 0, 'grunt'), unit(3, 0, 'grunt'), unit(4, 0, 'brute'), unit(5, 0, 'grunt')] });
  const input = make();
  input.ui.selection = [1, 2, 3, 4];
  input.key(state, 'Tab');
  assert.deepEqual(input.ui.selection, [1], 'first type: the Crumb');
  input.key(state, 'Tab');
  assert.deepEqual(input.ui.selection, [2, 3], 'next type: the Poppers, not unit 5 which was never selected');
  input.key(state, 'Tab');
  assert.deepEqual(input.ui.selection, [4], 'next type: the Four-Slice');
  input.key(state, 'Tab');
  assert.deepEqual(input.ui.selection, [1], 'wraps to the first type');
});

test('Tab with nothing selected does nothing', () => {
  const input = make();
  assert.equal(input.key(base({ units: [unit(1, 0, 'grunt')] }), 'Tab'), null);
  assert.deepEqual(input.ui.selection, []);
});

test('a fresh selection restarts the Tab cycle at its first type', () => {
  const state = base({ units: [unit(1, 0, 'worker'), unit(2, 0, 'grunt'), unit(3, 0, 'grunt')] });
  const input = make();
  input.ui.selection = [1, 2];
  input.key(state, 'Tab');
  input.key(state, 'Tab');
  assert.deepEqual(input.ui.selection, [2]);
  input.ui.selection = [1, 2, 3];
  input.key(state, 'Tab');
  assert.deepEqual(input.ui.selection, [1]);
});

test('digit 0 is a group like 1-9: Ctrl+0 sets it, 0 recalls it', () => {
  const state = base({ units: [unit(1, 0, 'grunt'), unit(2, 0, 'grunt')] });
  const input = make();
  input.ui.selection = [1, 2];
  input.key(state, '0', { ctrl: true });
  assert.deepEqual(input.ui.groups[0], [1, 2]);
  input.ui.selection = [];
  input.key(state, '0');
  assert.deepEqual(input.ui.selection, [1, 2]);
});

test('Shift+digit adds group n to the selection (the shifted symbol is read as its digit)', () => {
  const state = base({ units: [unit(1, 0, 'grunt'), unit(2, 0, 'grunt'), unit(3, 0, 'grunt')] });
  const input = make();
  input.ui.selection = [1];
  input.key(state, '1', { ctrl: true });
  input.ui.selection = [2];
  input.key(state, '!', { shift: true });
  assert.deepEqual(input.ui.selection, [2, 1]);
  input.ui.selection = [3];
  input.key(state, ')', { shift: true });
  assert.deepEqual(input.ui.selection, [3], 'group 0 is empty so the selection is kept');
  assert.deepEqual(input.ui.groups[1], [1]);
});

test('plain digits still recall a group, and a double tap still returns the centre', () => {
  const state = base({ units: [unit(1, 0, 'grunt', 10, 10), unit(2, 0, 'grunt', 14, 12)] });
  const input = make();
  input.ui.groups[2] = [1, 2];
  assert.equal(input.key(state, '2', { now: 1000 }), null);
  assert.deepEqual(input.ui.selection, [1, 2]);
  assert.deepEqual(input.key(state, '2', { now: 1200 }), { center: { x: 12, y: 11 } });
});
