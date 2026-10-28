// The 15:00 timeout verdict (assumption A, PLAYABLE/ECONOMY): units at cost + complete structures at cost + the Strip's hp.
// The wheat bank is only a tiebreak. Owner: sonnet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEnd, step, timeoutValue } from '../env/sim.mjs';
import { STATS, ECONOMY } from '../env/stats.mjs';
import { createPlayableState, observeToaster } from '../play/toaster-play.mjs';
import { createIdleCrumbs } from '../play/idle-crumbs.mjs';
import { createPlayer } from '../players/toaster-easy/bot.mjs';

const FIFTEEN_MINUTES = 21600; // 24 ticks a second, 15 minutes: the live match length

// A playable state with both sides at the start, the clock set to the timeout.
function atTimeout(seed = 3) {
  const s = createPlayableState(seed);
  s.maxTicks = FIFTEEN_MINUTES;
  s.tick = FIFTEEN_MINUTES;
  return s;
}

const addGrunt = (s, owner) => s.units.push({ id: 9000 + owner, owner, kind: 'grunt', x: 2, y: 2, hp: 60, carrying: 0, order: null });

test('the bank is not counted: a side with 5000 wheat and no army loses the timeout to a side with one more Popper', () => {
  const s = atTimeout();
  s.shards = [5000, 0];
  addGrunt(s, 1);
  const end = checkEnd(s);
  assert.equal(end.reason, 'timeout');
  assert.equal(end.winner, 1);
  assert.ok(end.score[1] > end.score[0], `score ${end.score}`);
});

test('timeoutValue is units at cost plus complete structures at cost plus the Strip hp, and nothing else', () => {
  const s = atTimeout();
  const base = timeoutValue(s, 0);
  assert.equal(base, 6 * ECONOMY.units.worker.wheat + STATS.toaster.coreHp);
  s.shards[0] = 9999;
  assert.equal(timeoutValue(s, 0), base, 'wheat in the bank does not move the score');
  const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
  core.hp -= 500;
  assert.equal(timeoutValue(s, 0), base - 500, 'a hurt Strip scores less by its lost hp');
});

test('a hurt Strip loses the timeout even with the same wheat and army', () => {
  const s = atTimeout();
  const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
  core.hp -= 800;
  const end = checkEnd(s);
  assert.equal(end.winner, 1);
  assert.equal(end.reason, 'timeout');
});

test('the bank only breaks an exact tie in score', () => {
  const s = atTimeout();
  s.shards = [200, 100];
  const end = checkEnd(s);
  assert.equal(end.winner, 0, 'equal board, more wheat in the bank wins');
  const even = atTimeout();
  even.shards = [150, 150];
  assert.equal(checkEnd(even).winner, null, 'equal board and equal bank is a draw');
});

test('an idle-Crumb player (auto-gather only) does not win the 15-minute timeout against toaster-easy', () => {
  const s = createPlayableState(1);
  s.maxTicks = FIFTEEN_MINUTES;
  const idle = createIdleCrumbs({ side: 0 });
  const bot = createPlayer({ side: 1, stats: STATS });
  const plans = new Map();
  let result = null;
  for (let i = 0; i < FIFTEEN_MINUTES && !result; i++) {
    const enemy = bot.act(observeToaster(s, 1));
    step(s, [idle.tick(observeToaster(s, 0), plans), Array.isArray(enemy) ? enemy : []]);
    result = s.result;
  }
  assert.ok(result, 'the match reached its end');
  // The bot may kill the idle Strip before 15:00 (reason 'core'); either way the hoarded bank must not win it.
  // A quiet match can also end by stalemate (120 s with no damage, kill or new structure, then 60 s); it is scored like a timeout.
  assert.ok(['core', 'timeout', 'stalemate'].includes(result.reason), result.reason);
  assert.notEqual(result.winner, 0, `idle side must lose or draw, score ${result.score}`);
  if (result.reason !== 'core') assert.ok(result.score[0] < result.score[1], `idle board ${result.score[0]} behind ${result.score[1]}`);
});
