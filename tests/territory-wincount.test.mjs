// Territory win (Match Rules, card 1.3): the Reaches needed come from the map (winCountFor in maps/layout-sizes.mjs),
// not a fixed 14. An explicit rules.winCount still wins, so hand-built tests keep working.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReaches, createTerritory, updateTerritory, TERRITORY_RULES } from '../env/territory.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { winCountFor } from '../maps/layout-sizes.mjs';

const sq = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const layoutOf = (n) => ({
  width: n * 10, height: 10,
  reaches: Array.from({ length: n }, (_, i) => ({
    id: i, name: 'R' + i, role: 'centre', side: null, mirror: n - 1 - i, centre: { x: i * 10 + 5, y: 5 }, outline: sq(i * 10, 0, i * 10 + 10, 10),
  })),
});

test('Wheatfield needs 21 of 31 Reaches', () => {
  const s = createTerritoryMatch(7);
  assert.equal(s.territory.reaches.length, 31);
  assert.equal(s.territory.rules.winCount, winCountFor(31));
  assert.equal(s.territory.rules.winCount, 21);
});

test('any layout reads two thirds rounded up from its own Reach count', () => {
  for (const n of [5, 9, 21, 41]) {
    const state = { tick: 0, units: [], structures: [], events: [], result: null };
    createTerritory(state, buildReaches(layoutOf(n)));
    assert.equal(state.territory.rules.winCount, winCountFor(n), `${n} Reaches`);
  }
});

test('an explicit winCount in the rules overrides the map', () => {
  const state = { tick: 0, units: [], structures: [], events: [], result: null };
  createTerritory(state, buildReaches(layoutOf(9)), { winCount: 2 });
  assert.equal(state.territory.rules.winCount, 2);
});

test('holding 14 of 31 starts no countdown; holding 21 does', () => {
  const state = { tick: 0, units: [], structures: [], events: [], result: null };
  createTerritory(state, buildReaches(layoutOf(31)));
  const claims = (count) => Array.from({ length: count }, (_, i) => ({ id: 100 + i, owner: 0, kind: 'totem', x: i * 10 + 5, y: 5, complete: true, hp: 5 }));
  state.structures = claims(14);
  updateTerritory(state);
  assert.equal(state.territory.hold[0], 14);
  assert.equal(state.territory.countdown[0], null, '14 is not enough on a 31-Reach map');
  state.structures = claims(21);
  updateTerritory(state);
  assert.equal(state.territory.hold[0], 21);
  assert.equal(state.territory.countdown[0], TERRITORY_RULES.winTicks);
});

test('TERRITORY_RULES keeps 14 as the stated default for a rules table with no map', () => {
  assert.equal(TERRITORY_RULES.winCount, 14);
});
