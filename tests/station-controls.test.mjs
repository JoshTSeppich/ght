// Power Station controls (owner: sonnet): the Crumb card, building boxes and pylons, selecting stations, F to fence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { STATS } from '../env/stats.mjs';
import { POWER } from '../env/power.mjs';
import { createInput } from '../play/input.mjs';
import { createToasterState, observeToaster, toasterInputOptions, TOASTER_HOTKEYS } from '../play/toaster-play.mjs';
import { pickStation, stationPlaceCheck, fenceOrder, rejectText } from '../play/station-controls.mjs';
import { kindName } from '../play/hud.mjs';
import { renderCard } from '../play/command-card.mjs';

function setup() {
  const state = createToasterState(7);
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions() });
  const obs = () => observeToaster(state, 0);
  const run = (n) => { for (let i = 0; i < n; i++) { const o = obs(); const ev = step(state, [input.tick(o), []]); input.noteEvents(o, ev); } };
  return { state, input, run, obs };
}
const crumb = (o) => o.units.find((u) => u.owner === 0 && u.kind === 'worker');

// SYSTEMS-DESIGN.md section 4: Extension Box is Z and Relay Pylon is X on the grid card.
test('the Crumb card offers Extension Box (Z, 30) and Relay Pylon (X, 60) with proper names', () => {
  const { input, obs } = setup();
  const o = obs();
  input.ui.selection = [crumb(o).id];
  const card = input.commandCard(o);
  const box = card.find((c) => c.kind === 'extension'), pylon = card.find((c) => c.kind === 'pylon');
  assert.deepEqual([box.key, box.cost, pylon.key, pylon.cost], ['z', 30, 'x', 60]);
  assert.equal(kindName('extension'), 'Extension Box');
  assert.equal(kindName('pylon'), 'Relay Pylon');
  const keys = card.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length, 'no hotkey is used twice');
  assert.equal(TOASTER_HOTKEYS.extension, 'z');
  assert.equal(TOASTER_HOTKEYS.pylon, 'x');
  const html = renderCard(card, { shards: 500 });
  assert.match(html, /Extension Box/);
  assert.match(html, /Relay Pylon/);
});

test('classic input has no station buttons', () => {
  const state = createToasterState(7);
  const input = createInput({ side: 0, stats: STATS });
  const o = observeToaster(state, 0);
  input.ui.selection = [crumb(o).id];
  assert.ok(!input.commandCard(o).some((c) => c.kind === 'extension'));
});

// SYSTEMS-DESIGN.md section 4: Z (grid profile) arms the Extension Box.
test('Z then a click builds an Extension Box: the Crumb walks up, wheat is paid, the station stands', () => {
  const { state, input, run, obs } = setup();
  state.shards[0] = 300; run(1);
  const o = obs();
  const w = crumb(o);
  input.ui.selection = [w.id];
  const strip = o.structures.find((s) => s.owner === 0 && s.kind === 'core');
  // a free tile 4 tiles from the Strip, inside its reach
  const spot = [[4, 0], [-4, 0], [0, 4], [0, -4], [4, 4], [-4, -4], [3, 0], [0, 3]].map(([a, b]) => ({ x: strip.x + a, y: strip.y + b })).find((t) => input.placeCheck(o, 'extension', t.x, t.y).ok);
  assert.ok(spot, 'a legal tile exists');
  input.key(o, 'z');
  assert.deepEqual(input.ui.mode, { type: 'place', kind: 'extension' });
  input.modeClick(o, spot);
  run(240);
  const p = state.power.points.find((q) => q.kind === 'extension');
  assert.ok(p, 'the Extension Box was placed');
  assert.equal(state.shards[0] <= 300 - POWER.cost.extension, true);
});

test('Relay Pylon is built the same way for 60 wheat', () => {
  const { state, input, run, obs } = setup();
  state.shards[0] = 300; run(1);
  if (state.toast?.pantry) state.toast.pantry[0].flour = 10; // M3 / DECISIONS.md 2: tier-2 buildings cost Flour (pylon: 1)
  // SYSTEMS-DESIGN.md section 2: the Relay Pylon is Kitchen tier, so it needs one complete Toaster of yours standing first.
  const core = state.structures.find((s) => s.owner === 0 && s.kind === 'core');
  state.structures.push({ id: 900, owner: 0, kind: 'toaster', x: core.x - 8, y: core.y + 8, hp: 250, progress: 60, complete: true, queue: [] });
  const o = obs();
  input.ui.selection = [crumb(o).id];
  const strip = o.structures.find((s) => s.owner === 0 && s.kind === 'core');
  const spot = [[4, 0], [-4, 0], [0, 4], [0, -4], [4, 4], [-4, -4], [3, 0], [0, 3]].map(([a, b]) => ({ x: strip.x + a, y: strip.y + b })).find((t) => input.placeCheck(o, 'pylon', t.x, t.y).ok);
  input.key(o, 'x'); // SYSTEMS-DESIGN.md section 4: X is the Relay Pylon
  input.modeClick(o, spot);
  run(240);
  assert.ok(state.power.points.some((q) => q.kind === 'pylon'));
});

test('placeCheck says why: too poor, or out of cord reach', () => {
  const { state, obs } = setup();
  const o = obs();
  const strip = o.structures.find((s) => s.owner === 0 && s.kind === 'core');
  state.shards[0] = 10;
  assert.equal(stationPlaceCheck(observeToaster(state, 0), 0, 'extension', strip.x + 3, strip.y).reason, 'not enough wheat');
  state.shards[0] = 500;
  const far = stationPlaceCheck(observeToaster(state, 0), 0, 'extension', strip.x + 60, strip.y);
  assert.equal(far.ok, false);
  assert.match(far.reason, /cord/);
});

test('click a station to select it, two stations then F sets the fence, F again clears it', () => {
  const { state, input, run, obs } = setup();
  const strip = state.structures.find((s) => s.owner === 0 && s.kind === 'core');
  state.power.points.push({ id: 900, owner: 0, kind: 'extension', x: strip.x + 6, y: strip.y, range: 8 });
  state.power.points.push({ id: 901, owner: 0, kind: 'extension', x: strip.x + 12, y: strip.y, range: 8 });
  run(2);
  let o = obs();
  assert.equal(pickStation(o, 0, strip.x + 6.4, strip.y + 0.3), 900);
  assert.equal(pickStation(o, 0, strip.x + 30, strip.y), null);
  assert.equal(input.pickStation(o, strip.x + 6, strip.y), true);
  assert.deepEqual(input.ui.stationSel, [900]);
  input.key(o, 'f');
  assert.match(input.takeMessage().text, /two stations/i);
  assert.equal(input.pickStation(o, strip.x + 12, strip.y, true), true);
  assert.deepEqual(input.ui.stationSel, [900, 901]);
  input.key(o, 'f');
  run(2);
  assert.equal(state.power.fenceLinks.size, 1, 'the fence is set');
  o = obs();
  assert.equal(fenceOrder(o, [900, 901]).cmd.on, false, 'now F would clear it');
  input.key(o, 'f');
  run(2);
  assert.equal(state.power.fenceLinks.size, 0, 'the fence is cleared');
});

test('a rejected station order tells the player why, in a sentence', () => {
  assert.match(rejectText({ e: 'reject', command: { type: 'place-power' }, reason: 'out-of-cord' }), /Too far from your power/);
  assert.match(rejectText({ e: 'reject', command: { type: 'set-fence' }, reason: 'crosses-enemy-fence' }), /cannot cross/);
  assert.equal(rejectText({ e: 'reject', command: { type: 'move' }, reason: 'x' }), null);
});
