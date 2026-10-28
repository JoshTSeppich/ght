// Timeout tie-break (Match Rules, card 1.2): board score first, then damage dealt to enemy buildings
// (state.buildingDamage[side], incremented by env/combat.mjs), then the Wheat bank, then a true draw.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEnd } from '../env/sim.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';

const LIMIT = 24 * 60 * 15;

function atTimeout() {
  const s = createTerritoryMatch(3);
  s.maxTicks = LIMIT;
  s.tick = LIMIT;
  return s;
}

test('equal board: the side that damaged more enemy buildings wins, even with less Wheat in the bank', () => {
  const s = atTimeout();
  s.shards = [0, 900];
  s.buildingDamage = [350, 120];
  const end = checkEnd(s);
  assert.equal(end.reason, 'timeout');
  assert.equal(end.winner, 0);
  assert.deepEqual(end.damage, [350, 120]);
});

test('board score still beats the damage counter', () => {
  const s = atTimeout();
  const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
  core.hp -= 100; // side 0 is behind on the board
  s.buildingDamage = [5000, 0];
  assert.equal(checkEnd(s).winner, 1);
});

test('equal board and equal damage: the Wheat bank decides, as before', () => {
  const s = atTimeout();
  s.shards = [10, 300];
  s.buildingDamage = [40, 40];
  assert.equal(checkEnd(s).winner, 1);
});

test('equal board, equal damage and equal bank is a true draw', () => {
  const s = atTimeout();
  s.shards = [200, 200];
  s.buildingDamage = [0, 0];
  const end = checkEnd(s);
  assert.equal(end.winner, null);
  assert.equal(end.reason, 'timeout');
});

test('a state with no counter yet reads as zero for both sides', () => {
  const s = atTimeout();
  delete s.buildingDamage;
  s.shards = [210, 200];
  const end = checkEnd(s);
  assert.equal(end.winner, 0);
  assert.deepEqual(end.damage, [0, 0]);
});

test('a stalemate ending uses the same tie-break order', () => {
  const s = atTimeout();
  s.tick = 4320;
  s.stalemate = { last: 0, endsAt: 4320 };
  s.shards = [0, 900];
  s.buildingDamage = [10, 0];
  const end = checkEnd(s);
  assert.equal(end.reason, 'stalemate');
  assert.equal(end.winner, 0);
});
