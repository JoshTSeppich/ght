// The Power Strip's rally and the sim's auto gather (env/economy.mjs pickWheatTile). A Crumb from the Strip goes to the
// least-loaded Wheat inside cord reach, never to a far field. Owner: Economy A (haiku).
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { allocId, isFree } from '../env/state.mjs';
import { POWER } from '../env/power.mjs';
import { createToasterState, observeToaster, toasterInputOptions } from '../play/toaster-play.mjs';
import { createInput } from '../play/input.mjs';
import { STATS } from '../env/stats.mjs';

const inReach = (strip, c) => Math.hypot(c.x - strip.x, c.y - strip.y) <= POWER.cord.worker;

// A new Crumb standing on a free tile next to the Strip, as if the Strip had just trained it.
function spawnCrumb(state, strip) {
  for (let r = 1; r <= 3; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !isFree(state, strip.x + dx, strip.y + dy)) continue;
    const id = allocId(state);
    state.units.push({ id, owner: 0, kind: 'worker', x: strip.x + dx, y: strip.y + dy, hp: 40, carrying: 0, order: null });
    return id;
  }
  throw new Error('no free tile beside the Strip');
}

test('A2: a Crumb from the Power Strip is sent to Wheat inside cord reach, not the nearest tile on the map', () => {
  const state = createToasterState(3);
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions() });
  const obs = () => observeToaster(state, 0);
  input.tick(obs());                       // first tick: every unit already there is known; no rally orders for them
  const strip = state.structures.find((s) => s.owner === 0 && s.kind === 'core');
  const id = spawnCrumb(state, strip);
  const cmds = input.tick(obs());
  const order = cmds.find((c) => c.unit === id && c.type === 'gather');
  assert.ok(order, 'the new Crumb gets a gather order');
  assert.ok(inReach(strip, order), `tile ${order.x},${order.y} is outside cord reach of the Strip`);
  assert.ok(state.crystals.some((c) => c.x === order.x && c.y === order.y && c.amount > 0), 'the tile has Wheat');
});

test('A3: gather with target auto is refused when no Wheat is in cord reach', () => {
  const state = createToasterState(3);
  const strip = state.structures.find((s) => s.owner === 0 && s.kind === 'core');
  for (const c of state.crystals) c.amount = 0;
  const id = spawnCrumb(state, strip);
  step(state, [[{ type: 'gather', unit: id, target: 'auto' }], []]);
  assert.equal(state.units.find((u) => u.id === id).order, null);
});
