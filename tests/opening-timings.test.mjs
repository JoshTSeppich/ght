// Opening timings (PLAYABLE.md items 14, 15 and 24). Owner: haiku (Data analyst). The scripted opening lives in
// scripts/opening-sim.mjs: 6 Crumbs farm the field by the Power Strip, then Mill, Well, Toaster, the Assembly Line, and
// 4 Poppers. The target tests are skipped until the Economy Lead (sonnet) lands numbers; then remove the skip.
// Times below are game seconds (24 ticks a second).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOpening } from '../scripts/opening-sim.mjs';
import { STATS } from '../env/stats.mjs';

const TPS = STATS.clock.ticksPerSecond;
const sec = (ticks) => ticks / TPS;
const SKIP = 'waiting for the Economy Lead to land numbers (PLAYABLE item 15); remove this skip then';

// Targets from PLAYABLE.md. The Economy Lead sets or confirms these; the test reads them, so nothing else changes.
const TARGET = Object.freeze({
  paidBySec: 90, // item 15: 6 Crumbs pay for a Mill + Well + Toaster in about this long
  paidToleranceSec: 15, // "about" 90 s: a band, not a point
  firstSquadBySec: 300, // item 14: the first squad (4 Poppers) by 5:00
});

// Always on: the scripted opening runs to the end, orders are all accepted, and the same seed gives the same numbers.
test('the scripted opening runs: 4 Poppers out, every order accepted, deterministic', () => {
  const a = runOpening(1);
  const b = runOpening(1);
  assert.equal(a.popperTicks.length, 4, 'four Poppers came off the Assembly Line');
  assert.deepEqual(a.rejects, [], 'no order was refused');
  assert.equal(a.paidAt, b.paidAt, 'same seed, same paid-for tick');
  assert.equal(a.fourthPopper, b.fourthPopper, 'same seed, same 4th Popper tick');
  assert.equal(runOpening(7).fourthPopper, a.fourthPopper, 'the Wheatfield map is fixed, so other seeds print the same row');
  assert.equal(a.wellWater, 'spring', 'the Strip on Wheatfield has its water from the home spring, not the creek');
});

test('6 Crumbs pay for a Mill + Well + Toaster in about 90 s', { skip: SKIP }, () => {
  const m = runOpening(1);
  assert.ok(m.paidAt !== null, 'the income reached the cost of the three buildings');
  const s = sec(m.paidAt);
  assert.ok(Math.abs(s - TARGET.paidBySec) <= TARGET.paidToleranceSec, `paid for at ${s.toFixed(1)} s, want about ${TARGET.paidBySec} s`);
});

test('the first squad (4 Poppers) is out by 5:00', { skip: SKIP }, () => {
  const m = runOpening(1);
  assert.ok(m.fourthPopper !== null, 'the 4th Popper came out');
  assert.ok(sec(m.fourthPopper) <= TARGET.firstSquadBySec, `4th Popper at ${sec(m.fourthPopper).toFixed(1)} s, want by ${TARGET.firstSquadBySec} s`);
});

test('the buildings are affordable in plan order: Mill, Well, Toaster, Assembly Line', { skip: SKIP }, () => {
  const m = runOpening(1);
  const order = ['mill', 'well', 'toaster', 'forge'].map((k) => m.affordable[k]);
  for (const t of order) assert.ok(t !== undefined, 'every building became affordable');
  for (let i = 1; i < order.length; i++) assert.ok(order[i] >= order[i - 1], 'the plan is bought in order');
});
