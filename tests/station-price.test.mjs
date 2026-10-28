// Mill Dam price (card 12, item 1): the Dam card and the placement pre-check quote the price the sim charges.
// The sim charges the site's price (env/power.mjs placeCheck, state.energy.cost[site.kind]): 160 on the Mill Dam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ENERGY, WHEATFIELD_SITES } from '../env/energy.mjs';
import { POWER } from '../env/power.mjs';
import { createToasterState, observeToaster } from '../play/toaster-play.mjs';
import { stationCost, stationCardEntries, stationPlaceCheck } from '../play/station-controls.mjs';

const milldam = WHEATFIELD_SITES.find((s) => s.kind === 'milldam');

test('one price table: power.mjs holds no Dam or Windmill price, the site sets it in energy.mjs', () => {
  assert.equal(POWER.cost.dam, 0);
  assert.equal(POWER.cost.windmill, 0);
});

test('the Dam card shows the plain Dam price, and a Mill Dam site quotes its own price', () => {
  const dam = stationCardEntries().find((e) => e.kind === 'dam');
  assert.equal(dam.cost, ENERGY.cost.dam);
  assert.equal(stationCost('dam', { kind: 'milldam' }), ENERGY.cost.milldam);
  assert.equal(stationCost('dam', { kind: 'dam' }), ENERGY.cost.dam);
});

test('the pre-check refuses a Mill Dam at 159 Wheat and allows it at 160, the price the sim charges', () => {
  const state = createToasterState(7);
  // a Crumb-built Extension Box in cord reach of the Mill Dam site, so only the price can refuse it
  state.power.points.push({ id: 900, owner: 0, kind: 'extension', x: milldam.x - 3, y: milldam.y, range: POWER.range.extension });
  state.shards[0] = ENERGY.cost.milldam - 1;
  const short = stationPlaceCheck(observeToaster(state, 0), 0, 'dam', milldam.x, milldam.y);
  assert.deepEqual([short.ok, short.reason], [false, 'not enough wheat']);
  state.shards[0] = ENERGY.cost.milldam;
  assert.equal(stationPlaceCheck(observeToaster(state, 0), 0, 'dam', milldam.x, milldam.y).ok, true);
});
