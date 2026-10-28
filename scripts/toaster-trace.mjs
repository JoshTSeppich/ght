// Prints a mirror match as a timeline on the real rules (owner: sonnet). node scripts/toaster-trace.mjs <seed> [fromMin] [toMin] [everySec]
import { step, checkEnd } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const seed = Number(process.argv[2] ?? 90), from = Number(process.argv[3] ?? 0), to = Number(process.argv[4] ?? 8), every = Number(process.argv[5] ?? 30);
const state = createToasterState(seed);
state.maxTicks = to * 1440;
const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed }));
const lim = {};
let result = null;
while (!result) {
  const cmds = [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []);
  const events = step(state, cmds);
  for (const e of events) if (e.e === 'cord-limit') { const u = state.units.find((x) => x.id === e.id); const k = (u ? u.owner : '?') + ':' + e.reason; lim[k] = (lim[k] || 0) + 1; }
  if (state.tick >= from * 1440 && state.tick % (every * 24) === 0) {
    const row = [0, 1].map((o) => {
      const us = state.units.filter((u) => u.owner === o);
      const w = us.filter((u) => u.kind === 'worker');
      const f = us.filter((u) => u.kind !== 'worker');
      const pw = {};
      for (const u of us) pw[u.power ? u.power.state : '-'] = (pw[u.power ? u.power.state : '-'] || 0) + 1;
      const ord = {};
      for (const u of us) { const t = u.order ? u.order.type : 'idle'; ord[t] = (ord[t] || 0) + 1; }
      const boxes = state.power.points.filter((p) => p.owner === o && p.kind === 'extension');
      const core = state.structures.find((s) => s.kind === 'core' && s.owner === o);
      return `s${o} $${state.shards[o]} W${w.length} F${f.length} box${boxes.length} hp${Math.round(core.hp)} pw${JSON.stringify(pw)} ord${JSON.stringify(ord)}`;
    });
    console.log((state.tick / 1440).toFixed(2), row.join(' | '), JSON.stringify(lim));
  }
  result = state.result ?? checkEnd(state);
}
console.log('END', state.tick, JSON.stringify(result));
