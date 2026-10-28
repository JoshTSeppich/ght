// Replays (Match Rules, card 1.5): rerun() reads the log's rules and rebuilds a Toaster Wars state, so a territory
// log replays to the same events and the same result. Old logs with no `rules` are recognised by their opening state.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rerun, simEvents, createLiveMatch } from '../env/live.mjs';
import { runMatch } from '../env/referee.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { validateLog } from '../env/log.mjs';

const BOT = fileURLToPath(new URL('../players/toaster-easy/bot.mjs', import.meta.url));
const SONNET = fileURLToPath(new URL('../players/toaster-sonnet/bot.mjs', import.meta.url));
// The opening state and first 50 ticks of the 25 Oct room log (matches/room/latest.json), kept as a fixture because
// matches/room/ is generated match output and no longer tracked.
const ROOM_LOG = fileURLToPath(new URL('./fixtures/room-log-no-rules.json', import.meta.url));

function compareToLog(log, again) {
  assert.equal(again.ticks.length, log.ticks.length, 'same number of ticks');
  for (let i = 0; i < again.ticks.length; i++) {
    assert.deepEqual(again.ticks[i].events, simEvents(log.ticks[i].events), 'tick ' + i + ' events match');
  }
  assert.deepEqual(again.state.result, log.result);
}

test('a referee territory match writes its rules into the log and rerun reproduces it', async () => {
  const { log } = await runMatch({ seed: 5, players: [BOT, BOT], territory: true, maxTicks: 400 });
  assert.deepEqual(log.rules, { state: 'territory', maxTicks: 400 });
  // validateLog already objects to the territory event names (claimed, hold-gained); the rules field adds nothing to that.
  assert.deepEqual(validateLog(log).filter((p) => !/unknown event kind/.test(p)), [], 'the extra field keeps the log valid');
  const again = rerun(log);
  assert.ok(again.state.territory, 'rebuilt as a Toaster Wars state');
  assert.ok(again.state.power && again.state.ammo, 'with cords and ammo, like the match');
  compareToLog(log, again);
});

test('a classic referee match still replays as a classic state', async () => {
  const { log } = await runMatch({ seed: 5, players: [BOT, BOT], maxTicks: 120 });
  assert.equal(log.rules.state, 'classic');
  const again = rerun(log);
  assert.equal(again.state.territory, undefined);
  compareToLog(log, again);
});

test('a live match records its rules and rerun takes the same state builder', async () => {
  const driver = createLiveMatch({ seed: 4, human: 0, ai: BOT, createState: createTerritoryMatch, maxTicks: 150, aiStartTick: 0 });
  await driver.ready();
  while (!driver.result) await driver.tick();
  assert.equal(driver.log.rules.state, 'createTerritoryMatch');
  assert.equal(driver.log.rules.maxTicks, 150);
  compareToLog(driver.log, rerun(driver.log, { createState: createTerritoryMatch }));
});

test('an old territory log with no rules is recognised by its opening state', () => {
  const log = JSON.parse(fs.readFileSync(ROOM_LOG, 'utf8'));
  assert.equal(log.rules, undefined, 'the saved room log predates the rules field');
  const head = { ...log, ticks: log.ticks.slice(0, 50), result: null };
  const again = rerun(head);
  assert.ok(again.state.territory, 'rebuilt as Toaster Wars from log.initial (power and kitchen)');
  assert.equal(again.ticks.length, 50);
});

// The room log (seed 668, toaster-sonnet mirror) was recorded on 25 Oct, before the economy changes, so its
// events no longer replay on today's rules. The same match played now replays exactly.
test('rerun reproduces a fresh toaster-sonnet mirror match exactly (the room match setup)', { timeout: 300000 }, async () => {
  const { log } = await runMatch({ seed: 668, players: [SONNET, SONNET], territory: true, maxTicks: 3000 });
  compareToLog(log, rerun(log));
});
