// Economy timeline of a mirror match (owner: sonnet). node scripts/toaster-econ.mjs <seed> [toMin]
// Per minute: shards, wheat left within 12 / 24 / anywhere of each Strip, and where the gatherers are heading.
import { step } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const seed = Number(process.argv[2] ?? 3), to = Number(process.argv[3] ?? 8);
const state = createToasterState(seed);
state.maxTicks = to * 1440;
const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed }));
const d = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
while (state.tick < to * 1440 && !state.result) {
  const cmds = [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []);
  step(state, cmds);
  if (state.tick % 1440 === 0) {
    const out = [0, 1].map((o) => {
      const core = state.structures.find((s) => s.kind === 'core' && s.owner === o);
      const w = (r) => Math.round(state.crystals.filter((c) => c.amount > 0 && d(c, core) <= r).reduce((t, c) => t + c.amount, 0));
      const gs = state.units.filter((u) => u.owner === o && u.kind === 'worker' && u.order && u.order.type === 'gather');
      const far = gs.map((u) => d(u.order, core));
      return `s${o} $${state.shards[o]} wheat<=12:${w(12)} <=24:${w(24)} all:${w(999)} gatherDist[${far.join(',')}]`;
    });
    console.log((state.tick / 1440) + 'm', out.join(' | '));
  }
}
