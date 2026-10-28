// B2 (ROLE-CARDS section 4): the unit cap stays at 40 and the note that said "no cap" is corrected.
// The cap is enforced in env/commands.mjs for every match, /play included (budget on or off). Owner: economy B (haiku).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { applyCommands } from '../env/commands.mjs';
import { STATS } from '../env/stats.mjs';
import { allocId } from '../env/state.mjs';

const train = (s) => {
  const core = s.structures.find((b) => b.owner === 0 && b.kind === 'core');
  s.shards[0] = 100000;
  s.events = [];
  applyCommands(s, 0, [{ type: 'train', building: core.id, kind: 'worker' }]);
  return s.events.find((e) => e.e === 'reject')?.reason ?? null;
};

// Fill side 0 with plain Crumbs until it holds `total` units (units plus queued trainees).
const fillTo = (s, total) => {
  const home = s.units.find((u) => u.owner === 0 && u.kind === 'worker');
  while (s.units.filter((u) => u.owner === 0).length < total) {
    s.units.push({ ...home, id: allocId(s), x: home.x, y: home.y, order: null, power: undefined });
  }
};

test('the unit cap is 40 in the stats table', () => {
  assert.equal(STATS.match.unitCap, 40);
});

test('a side at 39 units can train one more (the 40th); the 41st is refused with unit-cap', () => {
  const s = createTerritoryMatch(7);
  fillTo(s, 39);
  assert.equal(train(s), null);
  assert.equal(train(s), 'unit-cap');
});

test('the budget note no longer says the game has no cap', () => {
  const head = readFileSync(new URL('../env/budget.mjs', import.meta.url), 'utf8').split('\n').slice(0, 8).join('\n');
  assert.doesNotMatch(head, /no supply cap, training/);
  assert.match(head, /40-unit cap/);
});
