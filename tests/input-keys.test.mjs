// H1 (SYSTEMS-DESIGN.md section 4): the 5 x 3 command card, two key profiles (grid default, classic), the universal
// top row, Patrol as a two-point loop, and the mute key on backtick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createInput, assignHotkeys, MUTE_KEY } from '../play/input.mjs';
import { HOTKEY_PROFILES, toasterInputOptions, keyProfile } from '../play/toaster-play.mjs';
import { layoutCard, GRID, GRID_KEYS } from '../play/command-card.mjs';

const base = (extra = {}) => ({
  tick: 0, width: 40, height: 40, rocks: [], crystals: [], shards: { 0: 999, 1: 999 }, units: [], structures: [], ...extra,
});
const crumb = () => base({ units: [{ id: 1, owner: 0, kind: 'worker', x: 5, y: 5, hp: 10, order: null }] });
const strip = () => base({ structures: [{ id: 2, owner: 0, kind: 'core', x: 5, y: 5, hp: 100, complete: true, queue: [] }] });
const built = (id, kind) => base({ structures: [{ id, owner: 0, kind, x: 8, y: 8, hp: 100, complete: true, queue: [] }] });
const fighter = (kind) => base({ units: [{ id: 1, owner: 0, kind, x: 5, y: 5, hp: 10, order: null }] });

// Every selection the card can show, with the ids that make it.
const SCENES = {
  crumb: { state: crumb(), sel: [1] },
  strip: { state: strip(), sel: [2] },
  assembly: { state: built(3, 'forge'), sel: [3] },
  mill: { state: built(4, 'mill'), sel: [4] },
  well: { state: built(5, 'well'), sel: [5] },
  toaster: { state: built(6, 'toaster'), sel: [6] },
  heatLamp: { state: built(7, 'turret'), sel: [7] },
  popper: { state: fighter('grunt'), sel: [1] },
  fourSlice: { state: fighter('brute'), sel: [1] },
  bagel: { state: fighter('dart'), sel: [1] },
};

function cardsFor(profile) {
  const out = {};
  for (const [name, { state, sel }] of Object.entries(SCENES)) {
    const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions(profile) });
    input.ui.selection = sel;
    out[name] = input.commandCard(state);
  }
  // A Power Station pair (Box or Pylon) is picked on the field, not by unit or building.
  const station = createInput({ side: 0, stats: STATS, ...toasterInputOptions(profile) });
  station.ui.stationSel = [9, 10];
  out.station = station.commandCard(base());
  return out;
}

// Entries are looked up by slot: a slot is one button's job and is unique on its card.
const bySlot = (card, slot) => card.find((e) => e.slot === slot);
const printed = (card, slot) => bySlot(card, slot)?.key;

test('the grid is 5 by 3: Q W E R T / A S D F G / Z X C V B', () => {
  assert.deepEqual(GRID.map((r) => r.join(' ')), ['q w e r t', 'a s d f g', 'z x c v b']);
  assert.equal(GRID_KEYS.length, 15);
});

test('the mute key is backtick in both profiles: no button takes it, and U is free for a button', () => {
  assert.equal(MUTE_KEY, '`');
  for (const profile of ['grid', 'classic']) {
    for (const k of Object.values(HOTKEY_PROFILES[profile])) assert.notEqual(k, MUTE_KEY, `${profile} takes backtick`);
  }
  for (const card of [...Object.values(cardsFor('grid')), ...Object.values(cardsFor('classic'))]) {
    for (const e of card) assert.notEqual(e.key, MUTE_KEY);
  }
  assert.equal(assignHotkeys(['upper']).upper, 'u', 'a legacy kind can take U now');
});

test('no key means two things on one card, in either profile, for every selection', () => {
  for (const profile of ['grid', 'classic']) {
    for (const [name, card] of Object.entries(cardsFor(profile))) {
      const keys = card.map((e) => e.key);
      assert.equal(new Set(keys).size, keys.length, `${profile} ${name}: ${keys.join(' ')}`);
    }
  }
});

test('every entry is placed on a cell, and no cell holds two entries', () => {
  for (const profile of ['grid', 'classic']) {
    for (const [name, card] of Object.entries(cardsFor(profile))) {
      const cells = layoutCard(card).filter(Boolean);
      assert.equal(cells.length, card.length, `${profile} ${name}`);
      assert.equal(new Set(cells.map((c) => c.entry)).size, cells.length, `${profile} ${name} cells`);
    }
  }
});

test('row 1 is the same on every card: Q Move, W Stop, E Hold, R Patrol, T Attack-move', () => {
  const want = [['move', 'q'], ['stop', 'w'], ['hold', 'e'], ['patrol', 'r'], ['amove', 't']];
  for (const [name, card] of Object.entries(cardsFor('grid'))) {
    const row = layoutCard(card).slice(0, 5).map((c) => c?.entry);
    for (const [i, [action, key]] of want.entries()) {
      assert.equal(row[i]?.action, action, `${name} cell ${i}`);
      assert.equal(row[i]?.key, key, `${name} ${action}`);
    }
  }
  const rowOf = (card) => layoutCard(card).slice(0, 5).map((c) => `${c.entry.action}:${c.entry.key}`).join(' ');
  const classic = cardsFor('classic');
  for (const [name, card] of Object.entries(classic)) assert.equal(rowOf(card), rowOf(classic.crumb), `classic ${name}`);
});

test('grid Crumb card: A Mill S Well D Toaster F Assembly Line G Heat Lamp Z Extension Box X Relay Pylon C Windmill V Dam B Gather', () => {
  const card = cardsFor('grid').crumb;
  const want = { mill: 'a', well: 's', toaster: 'd', forge: 'f', turret: 'g', extension: 'z', pylon: 'x', windmill: 'c', dam: 'v' };
  for (const [kind, key] of Object.entries(want)) assert.equal(printed(card, kind), key, kind);
  assert.equal(printed(card, 'gather'), 'b');
});

test('grid Strip card: A Crumb S Rally D Pilot', () => {
  const card = cardsFor('grid').strip;
  assert.equal(printed(card, 'worker'), 'a');
  assert.equal(printed(card, 'rally'), 's');
  assert.equal(printed(card, 'pilot'), 'd');
});

test('grid Assembly Line card: A Popper S Zapper D Flak F Four-Slice G Broiler Z Bagel X Rally', () => {
  const card = cardsFor('grid').assembly;
  const want = { grunt: 'a', lancer: 's', spiker: 'd', brute: 'f', howler: 'g', dart: 'z' };
  for (const [kind, key] of Object.entries(want)) assert.equal(printed(card, kind), key, kind);
  assert.equal(printed(card, 'lineRally'), 'x');
});

test('grid fighters: A Resupply; Four-Slice S Shove; Bagel A Roll', () => {
  const grid = cardsFor('grid');
  assert.equal(printed(grid.popper, 'resupply'), 'a');
  assert.equal(printed(grid.fourSlice, 'resupply'), 'a');
  assert.equal(printed(grid.fourSlice, 'shove'), 's');
  assert.equal(printed(grid.bagel, 'roll'), 'a');
});

test('grid Heat Lamp: A target priority; Well, Mill and Toaster: A show rings, S pause', () => {
  assert.equal(printed(cardsFor('grid').heatLamp, 'priority'), 'a');
  for (const name of ['mill', 'well', 'toaster']) {
    const card = cardsFor('grid')[name];
    assert.equal(printed(card, 'rings'), 'a', name);
    assert.equal(printed(card, 'pause'), 's', name);
  }
});

test('grid Power Station pair: A fence on/off, S unplug', () => {
  const card = cardsFor('grid').station;
  assert.equal(printed(card, 'fence'), 'a');
  assert.equal(printed(card, 'unplug'), 's');
});

test('classic profile: M Move, S Stop, H Hold, P Patrol, A Attack-move, and the old building and unit letters', () => {
  const classic = cardsFor('classic');
  assert.deepEqual(layoutCard(classic.crumb).slice(0, 5).map((c) => c.entry.key), ['m', 's', 'h', 'p', 'a']);
  const want = { mill: 'i', well: 'w', toaster: 't', forge: 'f', turret: 'l', extension: 'x', pylon: 'v', windmill: 'n', dam: 'd' };
  for (const [kind, key] of Object.entries(want)) assert.equal(printed(classic.crumb, kind), key, kind);
  assert.equal(printed(classic.crumb, 'gather'), 'g');
  assert.equal(printed(classic.strip, 'worker'), 'c');
  const units = { grunt: 'o', lancer: 'z', spiker: 'k', brute: 'l', howler: 'b', dart: 'e' };
  for (const [kind, key] of Object.entries(units)) assert.equal(printed(classic.assembly, kind), key, kind);
  assert.equal(printed(classic.assembly, 'lineRally'), 'r');
  assert.equal(printed(classic.station, 'fence'), 'f');
  assert.equal(printed(classic.station, 'unplug'), 'u');
});

test('classic Four-Slice is on L, and the grid profile keeps it on F', () => {
  assert.equal(HOTKEY_PROFILES.classic.brute, 'l');
  assert.equal(HOTKEY_PROFILES.grid.brute, 'f');
});

test('the profile setting: ?keys=classic wins, a stored value is used otherwise, grid is the default', () => {
  assert.equal(keyProfile(new URLSearchParams('keys=classic'), null), 'classic');
  assert.equal(keyProfile(new URLSearchParams('keys=grid'), 'classic'), 'grid');
  assert.equal(keyProfile(new URLSearchParams(''), 'classic'), 'classic');
  assert.equal(keyProfile(new URLSearchParams(''), null), 'grid');
  assert.equal(keyProfile(new URLSearchParams('keys=weird'), null), 'grid');
});

test('placeholders for commands that do not exist yet are greyed, placed, and say coming', () => {
  const cards = cardsFor('grid');
  for (const [card, slot] of [[cards.strip, 'pilot'], [cards.fourSlice, 'shove'], [cards.bagel, 'roll'], [cards.heatLamp, 'priority'], [cards.well, 'pause'], [cards.station, 'unplug']]) {
    const e = bySlot(card, slot);
    assert.equal(e.locked, true, slot);
    assert.match(e.reason, /coming/i, slot);
  }
  assert.equal(bySlot(cards.assembly, 'lineRally').locked, false);
});

test('Patrol is a two-point loop: the unit walks to the clicked point and back, again and again', () => {
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions('grid') });
  const state = base({ units: [{ id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null }] });
  input.ui.selection = [1];
  input.key(state, 'r');
  assert.equal(input.ui.mode?.type, 'patrol');
  input.modeClick(state, { x: 9, y: 5 });
  const stops = [];
  for (let step = 0; step < 6; step++) {
    state.tick = step;
    for (const c of input.tick(state)) if (c.type === 'move') { stops.push([c.x, c.y]); state.units[0].x = c.x; state.units[0].y = c.y; }
  }
  assert.deepEqual(stops.slice(0, 4), [[9, 5], [5, 5], [9, 5], [5, 5]]);
});

test('Stop ends a patrol: no more loop orders after it', () => {
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions('grid') });
  const state = base({ units: [{ id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp: 10, order: null }] });
  input.ui.selection = [1];
  input.key(state, 'r');
  input.modeClick(state, { x: 9, y: 5 });
  state.tick = 0;
  input.tick(state);
  input.key(state, 'w');
  state.tick = 5;
  state.units[0].x = 9; state.units[0].y = 5;
  const after = input.tick(state).filter((c) => c.type === 'move');
  assert.deepEqual(after, []);
});

test('Gather (grid B): the Crumb walks to a crystal and gathers it', () => {
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions('grid') });
  const state = base({ units: [{ id: 1, owner: 0, kind: 'worker', x: 5, y: 5, hp: 10, order: null }], crystals: [{ x: 12, y: 5, amount: 10 }] });
  input.ui.selection = [1];
  input.key(state, 'b');
  assert.equal(input.ui.mode?.type, 'gather');
  input.modeClick(state, { x: 12, y: 5 });
  assert.deepEqual(input.tick(state), [{ type: 'gather', unit: 1, x: 12, y: 5 }]);
});

test('the fence on the Power Station card is A (grid) and the card fences with two stations picked', () => {
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions('grid') });
  input.ui.stationSel = [9, 10];
  const card = input.commandCard(base());
  assert.equal(card.find((e) => e.action === 'fence')?.key, 'a');
});
