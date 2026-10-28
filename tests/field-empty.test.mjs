// B1 (ROLE-CARDS section 4): when a Crumb's tile empties it retargets inside cord reach, never past it;
// when no wheat is left in reach it goes idle and the sim emits `field-empty`. Owner: economy B (haiku).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { step } from '../env/sim.mjs';
import { distance } from '../env/state.mjs';
import { POWER } from '../env/power.mjs';

const core0 = (s) => s.structures.find((b) => b.owner === 0 && b.kind === 'core');
const inReach = (s, c) => distance(core0(s), c) <= POWER.cord.worker;

test('a Crumb whose tile empties retargets to wheat inside cord reach, not beyond it', () => {
  const s = createTerritoryMatch(7);
  const reach = s.crystals.filter((c) => c.amount > 0 && inReach(s, c));
  assert.ok(reach.length >= 2, 'the home field has wheat in reach');
  const [empty] = reach;
  const outside = s.crystals.find((c) => c.amount > 0 && !inReach(s, c));
  const worker = s.units.find((u) => u.owner === 0 && u.kind === 'worker');
  empty.amount = 0;
  worker.order = { type: 'gather', x: empty.x, y: empty.y, phase: 'toField', ticks: 0 };
  step(s, [[], []]);
  assert.equal(worker.order?.type, 'gather');
  const target = s.crystals.find((c) => c.x === worker.order.x && c.y === worker.order.y);
  assert.ok(target.amount > 0, 'retargeted to a tile that still has wheat');
  assert.ok(inReach(s, target), `retargeted to (${target.x},${target.y}), which is outside cord reach`);
  assert.notEqual(target, empty);
  assert.ok(outside, 'the map has wheat outside reach to test against');
});

test('with no wheat left in cord reach the Crumb goes idle and the sim emits field-empty', () => {
  const s = createTerritoryMatch(7);
  const tile = s.crystals.find((c) => c.amount > 0 && inReach(s, c));
  for (const c of s.crystals) if (inReach(s, c)) c.amount = 0;
  const worker = s.units.find((u) => u.owner === 0 && u.kind === 'worker');
  worker.order = { type: 'gather', x: tile.x, y: tile.y, phase: 'toField', ticks: 0 };
  const events = step(s, [[], []]);
  const empty = events.find((e) => e.e === 'field-empty');
  assert.ok(empty, 'field-empty was emitted');
  assert.equal(empty.id, worker.id);
  assert.equal(worker.order, null);
});
