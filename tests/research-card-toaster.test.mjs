// The Assembly Line card offers research (M3): next level per track, locks in Kitchen words, a click queues the order.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState } from '../play/toaster-play.mjs';
import { createInput } from '../play/input.mjs';
import { STATS } from '../env/stats.mjs';
import { toasterResearchEntries, researchIdOf } from '../play/research-card.mjs';

function setup() {
  const state = createToasterState(7);
  const f = { id: 800, owner: 0, kind: 'forge', x: 6, y: 6, hp: 300, complete: true, queue: [] };
  state.structures.push(f);
  state.shards[0] = 500;
  state.toast.pantry[0].flour = 6;
  return { state, f };
}

test('the Assembly Line offers the next level of each track, then the unit researches', () => {
  const { state } = setup();
  const ids = toasterResearchEntries(state, 0, 'forge').map((e) => researchIdOf(e.action));
  assert.deepEqual(ids.slice(0, 3), ['ground-weapons-1', 'ground-armor-1', 'structure-armor-1']);
  assert.ok(ids.includes('popper-range'));
  assert.ok(!ids.includes('air-weapons-1'), 'air research is the Cooling Rack\'s');
  state.research.done[0].push('ground-weapons-1');
  assert.equal(researchIdOf(toasterResearchEntries(state, 0, 'forge')[0].action), 'ground-weapons-2');
});

test('entries are locked with the Kitchen words, or with a Flour or Wheat reason', () => {
  const { state } = setup();
  state.research.done[0].push('ground-weapons-1');
  const byId = (id) => toasterResearchEntries(state, 0, 'forge').find((e) => researchIdOf(e.action) === id);
  assert.equal(byId('ground-weapons-2').reason, 'Needs a Toaster');
  assert.equal(byId('ground-armor-1').locked, false);
  state.toast.pantry[0].flour = 0;
  assert.match(byId('ground-armor-1').reason, /Flour/);
  state.toast.pantry[0].flour = 6;
  state.shards[0] = 1;
  assert.match(byId('ground-armor-1').reason, /Wheat/);
});

test('Classic (no noTiers) gets no research entries', () => {
  const { state } = setup();
  state.noTiers = false;
  assert.deepEqual(toasterResearchEntries(state, 0, 'forge'), []);
});

test('selecting the Assembly Line shows the buttons and clicking one sends the research order', () => {
  const { state, f } = setup();
  const input = createInput({ side: 0, stats: STATS, stations: true });
  input.ui.selection = [f.id];
  const card = input.commandCard(state);
  const gw = card.find((e) => e.action === 'research:ground-weapons-1');
  assert.ok(gw, 'on the card');
  assert.equal(gw.locked, false);
  input.act(state, 'research:ground-weapons-1');
  assert.deepEqual(input.ui.outbox, [{ type: 'research', building: f.id, upgrade: 'ground-weapons-1' }]);
  const locked = card.find((e) => e.action === 'research:ground-weapons-2');
  assert.equal(locked, undefined, 'only the next level of a track is offered');
});

test('a locked research button toasts why and sends nothing', () => {
  const { state, f } = setup();
  state.toast.pantry[0].flour = 0;
  const input = createInput({ side: 0, stats: STATS, stations: true });
  input.ui.selection = [f.id];
  input.act(state, 'research:ground-weapons-1');
  assert.deepEqual(input.ui.outbox, []);
  assert.match(input.ui.message.text, /Flour/);
});
