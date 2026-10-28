// The bots play by the energy rules: each builds Windmills on its pads before a Toaster would go dark (PLAYABLE.md item 20). Owner: sonnet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createPlayableState } from '../play/toaster-play.mjs';

async function play(bot, minutes) {
  const { createPlayer } = await import(`../players/toaster-${bot}/bot.mjs`);
  const state = createPlayableState(3);
  const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed: 3 }));
  let dark = 0;
  for (let i = 0; i < minutes * 1440; i++) {
    step(state, [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []));
    dark = Math.max(dark, state.energy.shedToasters.size);
  }
  const wind = (o) => state.power.points.filter((p) => p.owner === o && p.kind === 'windmill').length;
  const toasters = (o) => state.structures.filter((s) => s.owner === o && s.kind === 'toaster').length;
  return { state, dark, wind, toasters };
}

for (const [bot, windmills, toasters] of [['sonnet', 2, 4], ['easy', 1, 2]]) {
  test(`${bot} bot: both sides raise ${windmills} Windmill(s) on their pads and no Toaster goes dark`, async () => {
    const r = await play(bot, 5);
    for (const side of [0, 1]) {
      assert.ok(r.wind(side) >= windmills, `side ${side} has ${r.wind(side)} Windmills at 5:00`);
      assert.ok(2 + 3 * r.wind(side) >= 2 * r.toasters(side), `side ${side}: ${r.toasters(side)} Toasters on ${r.wind(side)} Windmills`);
    }
    assert.ok(r.toasters(0) <= toasters);
    assert.equal(r.dark, 0, 'a Toaster went dark');
    const pads = new Set(r.state.energy.sites.filter((s) => s.kind === 'windmill').map((s) => `${s.x},${s.y}`));
    for (const p of r.state.power.points.filter((q) => q.kind === 'windmill')) assert.ok(pads.has(`${p.x},${p.y}`), 'a Windmill stands off its pad');
  });
}
