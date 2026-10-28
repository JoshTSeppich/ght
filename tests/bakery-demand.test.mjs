// DECISIONS.md 6: baking is demand-driven. A Toaster bakes only while the toast stack is under BAKERY.toastTarget, and keeps
// BAKERY.flourReserve Flour in the pantry (for the Assembly Line and tier-2/3 orders) unless the stack is under toastHungry.
// Before this, a Toaster baked every 5 s whenever it could, so 1 Mill (3 Flour a minute) never left 2 Flour for the Assembly Line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState } from '../play/toaster-play.mjs';
import { step } from '../env/sim.mjs';
import { BAKERY, wantsToast } from '../env/bakery.mjs';
import { runOpening } from '../scripts/opening-sim.mjs';
import { STATS } from '../env/stats.mjs';

function kitchen({ stack, flour, water = 6 }) {
  const state = createToasterState(7);
  const core = state.structures.find((s) => s.kind === 'core' && s.owner === 0);
  state.structures.push({ id: 900, owner: 0, kind: 'toaster', x: core.x + 2, y: core.y, hp: 250, complete: true, queue: [] });
  state.toast.stack[0] = stack;
  state.toast.pantry[0].flour = flour;
  state.toast.pantry[0].water = water;
  return state;
}
const run = (state, seconds) => { for (let i = 0; i < seconds * STATS.clock.ticksPerSecond; i++) step(state, [[], []]); };

test('wantsToast: full stack never, hungry stack always, otherwise only Flour above the reserve', () => {
  const wants = (stack, flour) => { const s = createToasterState(7); s.toast.stack[0] = stack; return wantsToast(s, 0, flour); };
  assert.equal(wants(BAKERY.toastTarget, 99), false, 'a full stack wants no toast');
  assert.equal(wants(BAKERY.toastHungry - 1, 1), true, 'a hungry army takes the last Flour');
  assert.equal(wants(BAKERY.toastHungry, BAKERY.flourReserve), false, 'fed enough: the reserve stays');
  assert.equal(wants(BAKERY.toastHungry, BAKERY.flourReserve + 1), true, 'Flour above the reserve bakes');
});

test('a Toaster with a full stack leaves the Flour alone', () => {
  const state = kitchen({ stack: BAKERY.toastTarget, flour: 4 });
  run(state, 60);
  assert.equal(state.toast.pantry[0].flour, 4, 'no Flour burned');
  assert.equal(state.toast.stack[0], BAKERY.toastTarget);
});

test('a Toaster with a fed army keeps the reserve; with a hungry army it bakes down to nothing', () => {
  const fed = kitchen({ stack: BAKERY.toastHungry, flour: BAKERY.flourReserve });
  run(fed, 60);
  assert.equal(fed.toast.pantry[0].flour, BAKERY.flourReserve, 'the reserve is still there');
  const hungry = kitchen({ stack: BAKERY.pilotFloor, flour: 1 });
  run(hungry, 20);
  assert.equal(hungry.toast.pantry[0].flour, 0, 'a hungry army gets the Flour');
  assert.ok(hungry.toast.stack[0] > BAKERY.pilotFloor, 'and it came back as toast');
});

test('one Mill opening: the Assembly Line is affordable in Wheat and Flour, no refused orders, 4 Poppers by 5:00', () => {
  const m = runOpening(1);
  assert.ok(m.affordable.forge !== undefined, 'the Assembly Line became affordable');
  assert.ok(m.flourAtForge >= STATS.research.flourCost.forge, `${m.flourAtForge} Flour in the pantry when the Wheat was there`);
  assert.deepEqual(m.rejects, []);
  assert.equal(m.popperTicks.length, 4);
  assert.ok(m.fourthPopper <= 300 * STATS.clock.ticksPerSecond, '4th Popper by 5:00');
});
