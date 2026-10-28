// PLAYABLE.md item 10: the default GHT match has no Drift, market, research or tier gates. ?classic=1 keeps them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState, toasterPanel } from '../play/toaster-play.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { tierReason } from '../env/tiers.mjs';

test('toaster state has the GHT leftovers switched off', () => {
  const s = createToasterState(7);
  assert.equal(s.drift, undefined);
  assert.equal(s.market, undefined);
  // M3 (Research and Upgrades): /play keeps state.research so the player can buy upgrades; only the tier gates stay off here.
  assert.deepEqual(s.research, { done: [[], []] }, 'research exists and starts empty');
  assert.equal(tierReason(s, 0, 3), null);
  assert.equal(toasterPanel(s, 0), '');
});

test('the territory match (bots, Match Room, classic) still has them', () => {
  const s = createTerritoryMatch(7);
  assert.ok(s.drift && s.market && s.research);
  assert.equal(tierReason(s, 0, 3), 'tier-locked');
});
