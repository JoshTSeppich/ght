// The TV plays a recorded toaster-sonnet v toaster-sonnet match (owner: sonnet). The recording is seed + commands; the page
// rebuilds the same state and feeds the commands through the live driver, so the same siege unfolds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLiveMatch } from '../env/live.mjs';
import { recordMatch } from '../play/replay/record.mjs';
import { replaySeed, nextReplaySeed, replayPlayer, loadReplay, REPLAY_SEEDS } from '../play/replay/replay-bot.mjs';
import { createReplayState, observeToaster } from '../play/toaster-play.mjs';
import { step } from '../env/sim.mjs';

const q = (s) => new URLSearchParams(s);
const sig = (st) => JSON.stringify([st.tick, st.shards, st.units.map((u) => [u.id, u.x, u.y, u.hp]), st.structures.map((s) => [s.id, s.hp]), st.power.points.map((p) => [p.id, p.x, p.y])]);

test('which recording the TV plays: 3 by default, 5 on seed 5, none for ?replay=off or a chosen AI', () => {
  assert.equal(replaySeed(q('mode=watch')), 3);
  assert.equal(replaySeed(q('mode=watch&seed=5')), 5);
  assert.equal(replaySeed(q('mode=watch&seed=9')), 3);
  assert.equal(replaySeed(q('mode=watch&replay=off')), null);
  assert.equal(replaySeed(q('mode=watch&ai=sonnet')), null);
  assert.deepEqual(REPLAY_SEEDS.map(nextReplaySeed), [5, 3]);
});

test('the live driver fed by the replay bots reproduces the recorded match tick for tick', async () => {
  const rec = recordMatch(3, { maxTicks: 1500 });
  assert.ok(Object.keys(rec.commands).length > 5, 'the bots gave orders');
  const make = replayPlayer(rec);
  const driver = createLiveMatch({ seed: 3, human: 0, createState: createReplayState, ai: make, aiStartTick: 0, maxTicks: 1500, tps: 24 });
  await driver.ready();
  // The page's watch loop: after each tick the 'human' side's recorded orders for the next tick are queued.
  const side0 = make({ side: 0 });
  driver.queue(rec.commands[0]?.[0] ?? []);
  driver.on('tick', () => { driver.queue(side0.act(observeToaster(driver.state, 0))); });
  const plain = createReplayState(3); plain.maxTicks = 1500;
  for (let t = 0; t < 1500; t++) {
    await driver.tick();
    step(plain, rec.commands[t] ?? [[], []]);
    if (t % 250 === 249) assert.equal(sig(driver.state), sig(plain), `tick ${t + 1}`);
  }
  assert.equal(sig(driver.state), sig(plain));
});

test('a missing recording loads as null, not a crash', async () => {
  assert.equal(await loadReplay(3, async () => { throw new Error('offline'); }), null);
  assert.equal(await loadReplay(3, async () => ({ ok: false })), null);
});

for (const seed of REPLAY_SEEDS) {
  const file = fileURLToPath(new URL(`../play/replay/toaster-seed-${seed}.json.gz`, import.meta.url));
  test(`recording seed ${seed}: loads through the page loader, and a Power Strip dies after 3:00 (a siege, not a standoff)`, { skip: !existsSync(file) && 'not recorded' }, async () => {
    const bytes = readFileSync(file);
    const rec = await loadReplay(seed, async () => ({ ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }));
    assert.ok(rec, 'the loader parses the gzipped file');
    const plain = await loadReplay(seed, async () => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(rec)).buffer }));
    assert.equal(plain.ticks, rec.ticks, 'a server that already unzipped it works too');
    assert.equal(rec.seed, seed);
    assert.equal(rec.result.reason, 'core');
    assert.ok(rec.ticks >= 24 * 180, `ended at tick ${rec.ticks}`);
    assert.ok(rec.ticks <= rec.maxTicks);
  });
}
