// Stalemate (Match Rules, card 1.1): 120 s with no structure damage, no unit kill and no new structure (income does not
// count) warns, then 60 s later the match ends with reason `stalemate`, scored like a timeout. GHT matches only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, step, checkEnd, updateStalemate, STALEMATE } from '../env/sim.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';

const createTerritoryMatchForTests = (seed) => createTerritoryMatch(seed);

const QUIET = 24 * 120;
const COUNTDOWN = 24 * 60;
const NO_COMMANDS = [[], []];

function run(state, ticks) {
  const all = [];
  for (let i = 0; i < ticks && !state.result; i++) {
    const events = step(state, NO_COMMANDS);
    for (const e of events) if (e.e && e.e.startsWith('stalemate')) all.push({ ...e, at: state.tick });
  }
  return all;
}

test('the constants are 120 s quiet and a 60 s countdown at 24 ticks a second', () => {
  assert.equal(STALEMATE.quietTicks, QUIET);
  assert.equal(STALEMATE.countdownTicks, COUNTDOWN);
});

test('an idle GHT match warns at 2:00 and ends by stalemate 60 s later, scored like a timeout', () => {
  const state = createTerritoryMatchForTests(3);
  state.maxTicks = 24 * 60 * 15;
  const marks = run(state, QUIET + COUNTDOWN + 5);
  const warning = marks.find((e) => e.e === 'stalemate-warning');
  assert.ok(warning, 'a stalemate-warning event');
  assert.equal(warning.at, QUIET, 'the warning comes after 120 quiet seconds');
  assert.equal(warning.ticks, COUNTDOWN, 'it says how long the countdown is');
  assert.equal(state.result?.reason, 'stalemate');
  assert.equal(state.result.tick, QUIET + COUNTDOWN);
  assert.ok(Array.isArray(state.result.score), 'scored like a timeout: a score pair rides on the result');
  assert.equal(state.result.score.length, 2);
});

test('the stalemate result names the same winner a timeout would at that moment', () => {
  const state = createTerritoryMatchForTests(3);
  state.maxTicks = 24 * 60 * 15;
  run(state, QUIET + COUNTDOWN + 5);
  const asTimeout = { ...state, tick: state.maxTicks, result: null, stalemate: null };
  const timeout = checkEnd(asTimeout);
  assert.equal(timeout.reason, 'timeout');
  assert.equal(state.result.winner, timeout.winner);
});

test('a new structure restarts the quiet clock', () => {
  const state = createTerritoryMatchForTests(3);
  state.maxTicks = 24 * 60 * 15;
  run(state, 1000);
  // The ids the sim snapshots at the top of a tick, then a site that appears during that tick.
  const before = new Set(state.structures.map((s) => s.id));
  const next = Math.max(...before) + 1;
  state.structures.push({ ...state.structures.find((s) => s.owner === 0 && s.kind === 'core'), id: next, kind: 'mill', complete: false, hp: 10 });
  state.tick += 1;
  state.events = [];
  updateStalemate(state, before);
  assert.equal(state.stalemate.last, 1001, 'the clock restarted on the tick the structure appeared');
  const marks = run(state, QUIET + 10);
  const warning = marks.find((e) => e.e === 'stalemate-warning');
  assert.ok(warning, 'a warning still comes, later');
  assert.equal(warning.at, 1001 + QUIET, 'the clock restarted on the tick the structure appeared');
});

test('income does not count: mining and delivering events never reset the clock', () => {
  const state = createTerritoryMatchForTests(3);
  state.tick = 500;
  updateStalemate(state, new Set(state.structures.map((s) => s.id)));
  const last = state.stalemate.last;
  state.tick = 900;
  state.events = [{ e: 'mine', id: 5, x: 1, y: 1, amount: 5, left: 100 }, { e: 'deliver', id: 5, amount: 5, shards: 50 }, { e: 'spend', player: 0, amount: 10, shards: 40 }];
  updateStalemate(state, new Set(state.structures.map((s) => s.id)));
  assert.equal(state.stalemate.last, last);
});

test('structure damage, a unit kill and a destroyed structure each reset the clock', () => {
  const state = createTerritoryMatchForTests(3);
  const ids = new Set(state.structures.map((s) => s.id));
  const coreId = state.structures.find((s) => s.kind === 'core').id;
  const cases = [
    [{ e: 'hit', id: coreId, by: 99, dmg: 5, hp: 100 }],
    [{ e: 'die', id: 424242 }],
    [{ e: 'die', id: coreId }],
  ];
  for (const events of cases) {
    state.tick = 100;
    state.stalemate = { last: 0, endsAt: null };
    state.events = events;
    updateStalemate(state, ids);
    assert.equal(state.stalemate.last, 100, JSON.stringify(events));
  }
  // damage to a unit that survives is not structure damage and not a kill
  state.tick = 200;
  state.stalemate = { last: 0, endsAt: null };
  state.events = [{ e: 'hit', id: 424242, by: 99, dmg: 5, hp: 10 }];
  updateStalemate(state, ids);
  assert.equal(state.stalemate.last, 0);
});

test('activity during the countdown cancels it and says so', () => {
  const state = createTerritoryMatchForTests(3);
  const ids = new Set(state.structures.map((s) => s.id));
  state.stalemate = { last: 0, endsAt: null };
  state.tick = QUIET;
  state.events = [];
  updateStalemate(state, ids);
  assert.equal(state.stalemate.endsAt, QUIET + COUNTDOWN);
  assert.ok(state.events.some((e) => e.e === 'stalemate-warning'));
  state.tick = QUIET + 100;
  state.events = [{ e: 'die', id: 424242 }];
  updateStalemate(state, ids);
  assert.equal(state.stalemate.endsAt, null);
  assert.ok(state.events.some((e) => e.e === 'stalemate-clear'));
  assert.equal(checkEnd({ ...state, tick: QUIET + COUNTDOWN + 1 }), null, 'no stalemate end after it was cancelled');
});

test('a classic match (createMatch) has no stalemate rule', () => {
  const state = createMatch(3);
  state.maxTicks = 24 * 60 * 15;
  const marks = run(state, QUIET + COUNTDOWN + 50);
  assert.equal(marks.length, 0);
  assert.equal(state.result, null);
});

test('timeout still wins when both limits arrive on the same tick', () => {
  const state = createTerritoryMatchForTests(3);
  state.maxTicks = QUIET + COUNTDOWN;
  run(state, QUIET + COUNTDOWN + 5);
  assert.equal(state.result.reason, 'timeout');
});
