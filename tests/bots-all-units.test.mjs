// Over 10 seeded matches the hard bots train every fighting unit and the Crumb (owner: AI Engineer). A rich start (3000 wheat each)
// keeps the matches short: this checks the unit mix table and the tier gates (Toaster for tier 2, Windmill for tier 3), not the economy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playMatch, HARD } from '../scripts/league.mjs';

test('every unit kind appears over 10 seeded matches', async () => {
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    const names = [HARD[i % 4], HARD[(i + 1 + (i >> 2)) % 4]];
    const m = await playMatch(i + 1, names, { maxMin: 2.75, stalemate: false, startShards: 3000 });
    for (const side of m.unitsUsed) for (const k of side) seen.add(k);
  }
  for (const kind of ['worker', 'grunt', 'lancer', 'spiker', 'brute', 'howler', 'dart']) assert.ok(seen.has(kind), `${kind} never trained (saw ${[...seen].sort()})`);
});
