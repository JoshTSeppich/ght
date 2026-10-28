// Passive wheat: six auto-gathering Crumbs (play/idle-crumbs.mjs, hooked in play/app.mjs) bring about 25-30 wheat a Crumb a
// minute at the home field, so the bank is 400-700 after 120 s. Owner: sonnet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { createPlayableState, observeToaster } from '../play/toaster-play.mjs';
import { createIdleCrumbs } from '../play/idle-crumbs.mjs';

// Runs the page's loop (play/app.mjs:289): the idle-Crumb hook gives the side-0 commands each tick, nothing else moves.
function runIdle(seconds, seed = 7) {
  const s = createPlayableState(seed);
  const idle = createIdleCrumbs({ side: 0 });
  const plans = new Map();
  const bank = [];
  for (let i = 1; i <= 24 * seconds; i++) {
    step(s, [idle.tick(observeToaster(s, 0), plans), []]);
    bank[Math.round(i / 24)] = Math.floor(s.shards[0]);
  }
  return { s, bank };
}

test('six idle Crumbs leave 400-700 wheat in the bank after 120 s', () => {
  const { s, bank } = runIdle(120);
  const wheat = bank[120];
  assert.equal(s.units.filter((u) => u.owner === 0 && u.kind === 'worker').length, 6);
  assert.ok(wheat >= 400 && wheat <= 700, `wheat after 120 s is ${wheat}`);
});

test('a Crumb brings about 25-30 wheat a minute, measured between 40 s and 110 s', () => {
  const { bank } = runIdle(110);
  const perCrumbPerMinute = ((bank[110] - bank[40]) / 6) / (70 / 60);
  assert.ok(perCrumbPerMinute >= 25 && perCrumbPerMinute <= 30, `${perCrumbPerMinute.toFixed(1)} wheat per Crumb per minute`);
});
