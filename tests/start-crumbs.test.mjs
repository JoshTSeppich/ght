// B3 (ROLE-CARDS section 4): the economy table's starting Crumbs come from the map's worker list, not a typed-in 4.
// Owner: economy B (haiku).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS, ECONOMY } from '../env/stats.mjs';
import { buildEconomy } from '../env/economy-table.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { generateMap } from '../env/map.mjs';

const crumbsAtStart = (s) => s.units.filter((u) => u.owner === 0 && u.kind === 'worker').length;

test('the table says as many starting Crumbs as /play gives side 0 at tick 0', () => {
  const s = createTerritoryMatch(7);
  assert.equal(ECONOMY.start.crumbs, crumbsAtStart(s));
});

test('the table reads the starting Crumbs from the map it is given', () => {
  const map = generateMap(7, { map: 'wheatfield' });
  assert.equal(buildEconomy(STATS, { map }).start.crumbs, map.workers[0].length);
  const four = { workers: [[{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }], []] };
  assert.equal(buildEconomy(STATS, { map: four }).start.crumbs, 4);
});
