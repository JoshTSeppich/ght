// toaster-sonnet (Normal) scouts with one Crumb at 1:30 (card 6, Haiku B). The scout stands at the chain tip to watch the lane
// for 30 s, then goes back to mining. Owner: AI B (Haiku). Pins the scout timing; the counter-build and raids are in
// tests/bots-sonnet-counter-raid.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));
const SCOUT_TICK = 24 * 60 * 1.5; // 1:30
const STAY = 24 * 30; // the scout watches for 30 s

test('no Crumb is sent to scout before 1:30', () => {
  const state = createToasterState(3);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const obs = clone(observe(state, 0));
  obs.tick = SCOUT_TICK - 1;
  bot.act(obs);
  assert.equal(bot.scout(), null, 'no scout before 1:30');
});

test('at 1:30 one Crumb of ours becomes the scout, and it is one of our Crumbs', () => {
  const state = createToasterState(3);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const obs = clone(observe(state, 0));
  obs.tick = SCOUT_TICK;
  bot.act(obs);
  const id = bot.scout();
  assert.notEqual(id, null, 'a scout is picked at 1:30');
  const crumb = obs.units.find((u) => u.id === id);
  assert.ok(crumb && crumb.owner === 0 && crumb.kind === 'worker', 'the scout is one of our Crumbs');
});

test('the scout keeps its post for 30 s, then goes back to mining', () => {
  const state = createToasterState(3);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const obs = clone(observe(state, 0));
  obs.tick = SCOUT_TICK;
  bot.act(obs);
  const id = bot.scout();
  obs.tick = SCOUT_TICK + STAY - 1;
  bot.act(obs);
  assert.equal(bot.scout(), id, 'still on watch at 30 s minus a tick');
  obs.tick = SCOUT_TICK + STAY;
  bot.act(obs);
  assert.equal(bot.scout(), null, 'released after 30 s');
});

test('only one Crumb is ever sent to scout in a match', () => {
  const state = createToasterState(3);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const obs = clone(observe(state, 0));
  obs.tick = SCOUT_TICK;
  bot.act(obs);
  const id = bot.scout();
  obs.tick = SCOUT_TICK + STAY;
  bot.act(obs);
  obs.tick = SCOUT_TICK + STAY + 24 * 60;
  bot.act(obs);
  assert.equal(bot.scout(), null, 'no second scout after the first one came home');
  assert.notEqual(id, null);
});
