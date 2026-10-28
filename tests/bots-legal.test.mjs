// The hard bots send no refused orders: no cord refusal, no rejected command (owner: AI Engineer).
import test from 'node:test';
import assert from 'node:assert/strict';
import { playMatch } from '../scripts/league.mjs';

const PAIRS = [['rush', 'turtle'], ['expand', 'tech']];

for (const [a, b] of PAIRS) {
  test(`${a} vs ${b}: 5 minutes, no refused orders`, async () => {
    const m = await playMatch(3, [a, b], { maxMin: 5, stalemate: false });
    assert.equal(m.refused, 0, `${m.refused} refused orders out of ${m.orders}`);
    assert.ok(m.orders > 50, 'both bots actually played');
  });
}
