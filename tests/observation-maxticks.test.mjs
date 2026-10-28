// The observation tells bots the tick limit. It must be the limit the match really runs to (state.maxTicks, e.g. the
// live match's 15 minutes = 21600 ticks), not STATS.match.maxTicks (2000) every time. Pure node.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STATS } from '../env/stats.mjs';
import { createInitialState, observe } from '../env/state.mjs';

const FIFTEEN_MINUTES = 24 * 60 * 15;

test('observation reports the state tick limit when the match sets one (live match: 21600)', () => {
  const s = createInitialState(7);
  s.maxTicks = FIFTEEN_MINUTES;
  for (const you of [0, 1]) assert.equal(observe(s, you).maxTicks, FIFTEEN_MINUTES);
});

test('observation falls back to STATS.match.maxTicks when the state has no limit of its own', () => {
  const s = createInitialState(7);
  assert.equal(observe(s, 0).maxTicks, STATS.match.maxTicks);
});

test('observation ignores a nonsense state limit and falls back to STATS', () => {
  for (const bad of [0, -5, 1.5, 'soon', null]) {
    const s = createInitialState(7);
    s.maxTicks = bad;
    assert.equal(observe(s, 0).maxTicks, STATS.match.maxTicks, `maxTicks=${String(bad)}`);
  }
});

test('observation maxTicks matches the limit the sim ends the match at', async () => {
  const { maxTicksOf } = await import('../env/sim.mjs');
  const s = createInitialState(7);
  s.maxTicks = FIFTEEN_MINUTES;
  assert.equal(observe(s, 0).maxTicks, maxTicksOf(s));
});
