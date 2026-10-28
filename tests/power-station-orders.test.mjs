// Player orders for Power Stations: build a Relay Pylon, set or clear a fence (set-fence). Owner: sonnet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { POWER } from '../env/power.mjs';
import { isFree, isPassable } from '../env/state.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { enableFences } from '../env/fence.mjs';

const rejects = (ev) => ev.filter((e) => e.e === 'reject');

test('Relay Pylon: place-power kind pylon costs 60 and lands as a station', () => {
  const s = createTerritoryMatch(5);
  const w = s.units.find((u) => u.owner === 0 && u.kind === 'worker');
  s.shards[0] = 200;
  const spot = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]].map(([a, b]) => ({ x: w.x + a, y: w.y + b }))
    .find((t) => isPassable(s, t.x, t.y) && isFree(s, t.x, t.y));
  const ev = step(s, [[{ type: 'place-power', unit: w.id, kind: 'pylon', x: spot.x, y: spot.y }], []]);
  assert.deepEqual(rejects(ev), []);
  assert.equal(s.shards[0], 200 - POWER.cost.pylon);
  assert.ok(s.power.points.some((p) => p.kind === 'pylon' && p.x === spot.x && p.y === spot.y));
});

test('set-fence turns a ground link into a fence and clears it again', () => {
  const s = createTerritoryMatch(5);
  enableFences(s);
  const core = s.structures.find((c) => c.owner === 0 && c.kind === 'core');
  s.power.points.push({ id: 900, owner: 0, kind: 'extension', x: core.x + 6, y: core.y, range: 8 });
  let ev = step(s, [[{ type: 'set-fence', a: core.id, b: 900, on: true }], []]);
  assert.deepEqual(rejects(ev), []);
  assert.equal(s.power.fenceLinks.size, 1);
  ev = step(s, [[{ type: 'set-fence', a: core.id, b: 900, on: false }], []]);
  assert.deepEqual(rejects(ev), []);
  assert.equal(s.power.fenceLinks.size, 0);
  ev = step(s, [[{ type: 'set-fence', a: core.id, b: 12345, on: true }], []]);
  assert.equal(rejects(ev)[0].reason, 'no-such-link');
});
