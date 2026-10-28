// Controls A (ROLE-CARDS section 7, items A1, A3, A4, A5): the keys a player presses and what each one does.
// The page (play/app.mjs) owns the browser events; the decisions it makes are pure functions in play/input.mjs, so
// each key is pinned here. Saved cameras (A2) are pinned in tests/input-camera-marks.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS, rowOf } from '../env/stats.mjs';
import { createInput, INSPECT_KEY, pauseKeyFires, gameTakesKey } from '../play/input.mjs';
import { toasterInputOptions, HOTKEY_PROFILES } from '../play/toaster-play.mjs';

const base = (extra = {}) => ({
  tick: 0, width: 40, height: 40, rocks: [], crystals: [], shards: { 0: 999, 1: 999 }, units: [], structures: [], ammo: {}, ...extra,
});
// A Popper (grunt) of mine at (5,5) and an enemy Popper three tiles east, at (8,5).
const duel = () => base({
  units: [
    { id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null },
    { id: 9, owner: 1, kind: 'grunt', x: 8, y: 5, hp: 10, order: null },
  ],
});

test('A1: Hold uses the Toaster Wars range, so a Popper (range 4) holds an enemy three tiles away', () => {
  const state = duel();
  const input = createInput({ side: 0, stats: STATS, rowOf, ...toasterInputOptions('grid') });
  input.ui.selection = [1];
  input.key(state, 'e'); // grid Hold
  const out = input.tick(state);
  assert.ok(out.some((c) => c.type === 'attack' && c.target === 9), 'the Popper attacks the enemy inside its real range');
});

test('A1: without the Toaster Wars rows Hold reads the old range (1), so the same Popper does not reach', () => {
  const state = duel();
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions('grid') });
  input.ui.selection = [1];
  input.key(state, 'e');
  const out = input.tick(state);
  assert.equal(out.some((c) => c.type === 'attack'), false);
});

test('A5: a card letter with Ctrl or Cmd is not a card key (Ctrl+W does not Stop, Ctrl+R does not Patrol)', () => {
  const state = duel();
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions('grid') });
  input.ui.selection = [1];
  input.key(state, 'r', { ctrl: true });
  assert.equal(input.ui.mode, null, 'Ctrl+R arms nothing');
  input.key(state, 'w', { ctrl: true });
  assert.equal(input.tick(state).some((c) => c.type === 'stop'), false, 'Ctrl+W orders nothing');
  input.key(state, 'r');
  assert.notEqual(input.ui.mode, null, 'plain R still arms Patrol');
});

test('A5: gameTakesKey: digits (Ctrl+0 too), Space, Escape, Tab and plain card letters are the game\'s; Ctrl or Cmd letters are not', () => {
  assert.equal(gameTakesKey('0', { mod: true }), true, 'Ctrl+0 is ours, so the browser zoom reset does not fire');
  assert.equal(gameTakesKey('5', {}), true);
  assert.equal(gameTakesKey(' ', {}), true);
  assert.equal(gameTakesKey('Escape', {}), true);
  assert.equal(gameTakesKey('Tab', {}), true);
  assert.equal(gameTakesKey('r', { cardKeys: ['r'] }), true);
  assert.equal(gameTakesKey('r', { mod: true, cardKeys: ['r'] }), false, 'Ctrl+R reloads: the browser keeps it');
  assert.equal(gameTakesKey('t', { mod: true, cardKeys: ['t'] }), false, 'Cmd+T opens a tab');
  assert.equal(gameTakesKey('Tab', { mod: true }), false, 'Ctrl+Tab switches tabs');
});

test('A4: P pauses only with nothing selected, so Patrol (classic P) reaches the units; resume always works', () => {
  assert.equal(pauseKeyFires('p', { paused: false, selected: 0 }), true);
  assert.equal(pauseKeyFires('P', { paused: false, selected: 0 }), true);
  assert.equal(pauseKeyFires('p', { paused: false, selected: 2 }), false, 'with units picked, P is Patrol');
  assert.equal(pauseKeyFires('p', { paused: true, selected: 2 }), true, 'a paused game resumes on P');
  assert.equal(pauseKeyFires('p', { paused: false, selected: 0, mod: true }), false, 'Ctrl+P is the browser print');
});

test('A3: inspect power is F4, and no card in either profile uses F4', () => {
  assert.equal(INSPECT_KEY, 'F4');
  const used = [...Object.values(HOTKEY_PROFILES.grid), ...Object.values(HOTKEY_PROFILES.classic)];
  assert.equal(used.includes(INSPECT_KEY), false);
});
