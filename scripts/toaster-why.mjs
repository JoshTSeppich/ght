// First N cord refusals with the unit, its order target, anchor and cord. node scripts/toaster-why.mjs <seed> <fromTick> [N]
import { step } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const seed = Number(process.argv[2] ?? 90), from = Number(process.argv[3] ?? 2000), N = Number(process.argv[4] ?? 12);
const state = createToasterState(seed);
state.maxTicks = from + 600;
const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed }));
let shown = 0;
while (state.tick < from + 600 && shown < N) {
  const cmds = [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []);
  const before = new Map(state.units.map((u) => [u.id, { order: u.order && { ...u.order }, x: u.x, y: u.y }]));
  const events = step(state, cmds);
  if (state.tick < from) continue;
  for (const e of events) {
    if (e.e !== 'cord-limit' || shown >= N) continue;
    const u = state.units.find((x) => x.id === e.id);
    const b = before.get(e.id);
    const anchor = state.power.points.find((p) => p.id === u.power.anchor) || state.structures.find((s) => s.id === u.power.anchor);
    shown++;
    console.log(state.tick, e.reason, u.kind, 'owner', u.owner, 'at', u.x, u.y, 'order', JSON.stringify(b.order), 'anchor', anchor && [anchor.kind, anchor.x, anchor.y], 'cord', JSON.stringify(u.power.cord && u.power.cord.pts), 'state', u.power.state);
  }
}
