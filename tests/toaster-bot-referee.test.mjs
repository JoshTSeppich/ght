// The toaster-sonnet bot must load inside the referee sandbox (a player may read only its own file): no load forfeit (owner: sonnet).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runMatch } from '../env/referee.mjs';

const bot = fileURLToPath(new URL('../players/toaster-sonnet/bot.mjs', import.meta.url));

test('two toaster-sonnet bots play real referee ticks, not a tick-0 load forfeit', async () => {
  const { log, result } = await runMatch({ seed: 3, players: [bot, bot], territory: true, maxTicks: 300 });
  assert.notEqual(result.reason, 'forfeit', JSON.stringify(result));
  assert.ok(result.tick >= 300, `ended at tick ${result.tick}`);
  assert.ok(!JSON.stringify(log).includes('"reason":"load"'), 'no load forfeit in the log');
});
