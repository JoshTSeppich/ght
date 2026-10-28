// sandbox-fight: equal-value armies fight on open ground and at a choke (ROLE-CARDS section 14, item 2).
// Real modules only: env/sim.mjs step, env/state.mjs createTestState, env/ammo.mjs enableAmmo, env/stats.mjs ECONOMY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY } from '../env/stats.mjs';
import { armyFor, layoutFor, fight, ARMY_SIZES, FIGHTERS } from '../scripts/sandbox.mjs';

const valueOfArmy = (army) => army.reduce((sum, { kind, count }) => sum + count * ECONOMY.units[kind].wheat, 0);

test('the army sizes are 500, 1000 and 2000 Wheat', () => {
  assert.deepEqual([...ARMY_SIZES], [500, 1000, 2000]);
});

test('armyFor spends an equal Wheat share on each fighter and never goes over budget', () => {
  for (const wheat of ARMY_SIZES) {
    const army = armyFor(wheat);
    assert.ok(valueOfArmy(army) <= wheat, `${wheat} Wheat army costs ${valueOfArmy(army)}`);
    assert.deepEqual(army.map((a) => a.kind), [...FIGHTERS]);
    for (const { kind, count } of army) {
      assert.equal(count, Math.floor(wheat / FIGHTERS.length / ECONOMY.units[kind].wheat));
    }
  }
});

test('open ground has no rocks; the choke has a wall across the middle with a gap', () => {
  const open = layoutFor('open');
  assert.equal(open.rocks.length, 0);
  const choke = layoutFor('choke');
  assert.ok(choke.rocks.length > 0);
  const midX = Math.floor(choke.width / 2);
  const wallRows = new Set(choke.rocks.filter(([x]) => x === midX).map(([, y]) => y));
  assert.ok(wallRows.size < choke.height, 'the wall must leave a gap');
  assert.ok(wallRows.size > 0, 'the wall must stand somewhere');
});

test('a fight reports a winner, the value each side has left and the fight length in ticks', () => {
  const r = fight({ wheat: 500, layout: 'open' });
  assert.ok(r.winner === 0 || r.winner === 1 || r.winner === null);
  assert.equal(r.valueLeft.length, 2);
  assert.ok(Number.isInteger(r.ticks) && r.ticks > 0);
  if (r.winner !== null) {
    assert.ok(r.valueLeft[r.winner] > 0);
    assert.equal(r.valueLeft[1 - r.winner], 0);
  }
});

test('equal armies on the same ground give the same result every run', () => {
  const a = fight({ wheat: 500, layout: 'choke' });
  const b = fight({ wheat: 500, layout: 'choke' });
  assert.deepEqual(a, b);
});

test('the fight stops at the tick cap and reports a draw when neither side is gone', () => {
  const r = fight({ wheat: 500, layout: 'open', maxTicks: 1 });
  assert.equal(r.ticks, 1);
  assert.equal(r.winner, null);
});
