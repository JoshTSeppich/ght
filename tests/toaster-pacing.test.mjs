// Toaster Wars pacing (sonnet). A bot that plays the toaster rules must be able to reach the enemy Power Strip through
// Extension Boxes, and a whole match between two such bots must not end before 3:00. Short runs only; the 10-seed
// length sweep is .sandbox/sonnet-pace/inproc.mjs (numbers in TERRITORY-PACING.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { step, checkEnd } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));

function play(seed, ticks) {
  const state = createTerritoryMatch(seed, {});
  state.maxTicks = ticks;
  const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed }));
  let result = null;
  while (!result) {
    const cmds = [0, 1].map((s) => bots[s].act(clone(observe(state, s))) || []);
    step(state, cmds);
    result = state.result ?? checkEnd(state);
  }
  return { state, result };
}

test('observe shows a side its own Power points and nothing of the enemy', () => {
  const state = createTerritoryMatch(1, {});
  state.power.points.push({ id: 900, owner: 0, kind: 'extension', x: 30, y: 220, range: 8 });
  state.power.points.push({ id: 901, owner: 1, kind: 'extension', x: 200, y: 40, range: 8 });
  const mine = observe(state, 0).power.points;
  assert.deepEqual(mine.map((p) => p.id), [900]);
  assert.deepEqual(observe(state, 1).power.points.map((p) => p.id), [901]);
});

test('observe lists a side\'s own cut units', () => {
  const state = createTerritoryMatch(1, {});
  const mine = state.units.find((u) => u.owner === 0);
  mine.power = { state: 'down', anchor: null, battery: 0 };
  assert.deepEqual(observe(state, 0).power.cut, [{ id: mine.id, state: 'down' }]);
  assert.deepEqual(observe(state, 1).power.cut, []);
});

test('a toaster bot walks its Extension Boxes most of the way to the enemy Strip', () => {
  // SYSTEMS-DESIGN.md section 2: a Crumb mines 28 Wheat a minute (was ~150), so the first kitchen and the chain take longer: 4:00, not 3:00.
  const { state } = play(1, 24 * 60 * 4); // 4:00
  for (const side of [0, 1]) {
    const foe = state.structures.find((s) => s.kind === 'core' && s.owner !== side);
    const boxes = state.power.points.filter((p) => p.owner === side && p.kind === 'extension');
    assert.ok(boxes.length >= 8, `side ${side} placed ${boxes.length} boxes`);
    const near = Math.min(...boxes.map((p) => Math.max(Math.abs(p.x - foe.x), Math.abs(p.y - foe.y))));
    assert.ok(near < 200, `side ${side} chain got to ${near} tiles from the enemy Strip`);
  }
});

test('no Power Strip falls before 3:00 in a bot v bot match', () => {
  for (const seed of [1, 2]) {
    const { state, result } = play(seed, 24 * 60 * 3);
    assert.ok(state.structures.filter((s) => s.kind === 'core').every((s) => s.hp > 0), `seed ${seed}: a Strip fell before 3:00`);
    assert.equal(result.reason, 'timeout');
  }
});

// The full 15:00 length check is ~1 minute a seed, so the suite runs it only with PACING_SWEEP=1 (the same opt-in as
// tests/opening-pacing.test.mjs). Seeds 3 and 5 are the ones whose siege ends in a Strip kill.
test('a full bot v bot match is decisive or close by the 15:00 cap, and never early', { skip: !process.env.PACING_SWEEP, timeout: 600000 }, () => {
  for (const seed of [3, 5]) {
    const { state, result } = play(seed, 24 * 60 * 15);
    assert.ok(result.tick >= 24 * 60 * 3, `seed ${seed} ended at tick ${result.tick}, before 3:00`);
    if (result.reason === 'core') {
      assert.ok(result.tick >= 24 * 60 * 10, `seed ${seed}: a Strip fell at ${(result.tick / 1440).toFixed(1)} min, under the 10 min floor`);
    } else {
      const hp = state.structures.filter((s) => s.kind === 'core').map((s) => s.hp);
      assert.ok(Math.min(...hp) < STATS.toaster.coreHp * 0.6, `seed ${seed}: timed out with both Strips above 60% (${hp})`);
    }
  }
});
