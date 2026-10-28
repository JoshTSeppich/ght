// B4 (ROLE-CARDS section 4): the sim exposes workers per field and capacity per base for the HUD saturation readout.
// fieldSaturation(state, owner) in env/economy.mjs. Owner: economy B (haiku).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { fieldSaturation } from '../env/economy.mjs';
import { distance } from '../env/state.mjs';
import { POWER } from '../env/power.mjs';

test('at the start: 6 Crumbs, and the readout counts the wheat in cord reach and the open tiles beside it', () => {
  const s = createTerritoryMatch(7);
  const core = s.structures.find((b) => b.owner === 0 && b.kind === 'core');
  const fields = s.crystals.filter((c) => c.amount > 0 && distance(core, c) <= POWER.cord.worker);
  const sat = fieldSaturation(s, 0);
  assert.equal(sat.workers, 6);
  assert.equal(sat.fields, fields.length);
  assert.equal(sat.workersPerField, 6 / fields.length);
  assert.ok(sat.capacity >= fields.length, 'every field has at least one open tile beside it');
  assert.equal(sat.saturation, 6 / sat.capacity);
});

test('a side with no wheat in reach reads zero fields, zero capacity and no division by zero', () => {
  const s = createTerritoryMatch(7);
  for (const c of s.crystals) c.amount = 0;
  const sat = fieldSaturation(s, 0);
  assert.equal(sat.fields, 0);
  assert.equal(sat.workersPerField, 0);
  assert.equal(sat.saturation, 0);
});
