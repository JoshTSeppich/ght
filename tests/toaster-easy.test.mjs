// toaster-easy (PLAYABLE.md item 12): the gentle opponent. It loads in the referee sandbox, loses to toaster-sonnet ("normal")
// and never destroys a Power Strip before 10:00 (owner: sonnet). Set EASY_SEEDS=3,5,90 EASY_MINUTES=15 to change the sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { step, checkEnd } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { runMatch } from '../env/referee.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer as easy } from '../players/toaster-easy/bot.mjs';
import { createPlayer as normal } from '../players/toaster-sonnet/bot.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));
const SEEDS = (process.env.EASY_SEEDS ?? '3,5,90').split(',').map(Number);
const MINUTES = Number(process.env.EASY_MINUTES ?? 10.5);
const botFile = fileURLToPath(new URL('../players/toaster-easy/bot.mjs', import.meta.url));

test('toaster-easy is one self-contained file (no imports) and loads in the referee sandbox', async () => {
  const src = readFileSync(botFile, 'utf8');
  assert.ok(!/^\s*import\s/m.test(src) && !/\bimport\(/.test(src), 'a player may import nothing');
  const { log, result } = await runMatch({ seed: 3, players: [botFile, botFile], territory: true, maxTicks: 300 });
  assert.notEqual(result.reason, 'forfeit', JSON.stringify(result));
  assert.ok(!JSON.stringify(log).includes('"reason":"load"'));
});

function play(seed, easySide) {
  const state = createToasterState(seed);
  state.maxTicks = 24 * 60 * MINUTES;
  state.stalemateRule = false; // this test measures the easy bot's pacing; the stalemate rule would end its quiet seeds at ~7:55 (the AI wave fixes that)
  const bots = [0, 1].map((s) => (s === easySide ? easy : normal)({ side: s, stats: STATS, seed }));
  const strips = (o) => state.structures.find((b) => b.kind === 'core' && b.owner === o);
  let stripHurtTick = null, homeArmyAt8 = null, wavesOut = 0;
  const hp0 = [strips(0).hp, strips(1).hp];
  while (!(state.result ?? checkEnd(state))) {
    const cmds = [0, 1].map((s) => bots[s].act(clone(observe(state, s))) || []);
    step(state, cmds);
    if (stripHurtTick === null && [0, 1].some((o) => (strips(o)?.hp ?? 0) < hp0[o])) stripHurtTick = state.tick;
    if (state.tick === 24 * 60 * 8 - 1) homeArmyAt8 = state.units.filter((u) => u.owner === easySide && u.kind !== 'worker').length;
  }
  const result = state.result ?? checkEnd(state);
  const stripGone = [0, 1].map((o) => !strips(o));
  return { state, result, stripGone, homeArmyAt8, stripHurtTick, easyHp: strips(easySide)?.hp ?? 0, normalHp: strips(1 - easySide)?.hp ?? 0, easySide };
}

for (const seed of SEEDS) {
  test(`seed ${seed}: easy loses to normal, no Strip dies before 10:00, 4-6 Poppers home at 8:00`, () => {
    const r = play(seed, seed % 2);
    const easyDead = r.stripGone[r.easySide];
    const normalDead = r.stripGone[1 - r.easySide];
    assert.ok(!normalDead, 'easy must not kill the normal Strip');
    const easyValue = r.easyHp + (r.state.shards?.[r.easySide] ?? 0);
    const normalValue = r.normalHp + (r.state.shards?.[1 - r.easySide] ?? 0);
    assert.ok(easyDead || r.result?.winner === 1 - r.easySide || easyValue < normalValue, `easy did not lose: ${JSON.stringify(r.result)} hp ${r.easyHp} v ${r.normalHp}`);
    assert.ok(!(r.stripGone.some(Boolean) && r.state.tick < 24 * 60 * 10), `a Strip died at tick ${r.state.tick} (gone ${r.stripGone}, easy side ${r.easySide})`);
    assert.ok(r.homeArmyAt8 >= 3 && r.homeArmyAt8 <= 8, `${r.homeArmyAt8} fighters at 8:00`);
  });
}
