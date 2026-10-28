// Measures toaster-sonnet mirror matches on the REAL rules (createToasterState: cords bend, fences, ammo). Owner: sonnet.
//   node scripts/toaster-measure.mjs <seed> [maxMin=15] [wrap=1]    prints one JSON line
// frozen = no unit moved, no hp changed, no spend for 10 s while the match was past 5:00 and not over (a frozen board).
import { step, checkEnd } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

export function measure(seed, { maxMin = 15, wrap = true } = {}) {
  const state = createToasterState(seed);
  state.power.wrap = wrap;
  state.maxTicks = maxMin * 60 * 24;
  const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed }));
  let result = null, frozenTicks = 0, maxFrozen = 0, sig = '', refused = 0, orders = 0, cordLimits = 0;
  const reasons = {};
  while (!result) {
    const cmds = [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []);
    orders += cmds[0].length + cmds[1].length;
    const events = step(state, cmds);
    for (const e of events) {
      if (e.e === 'cord-limit') { cordLimits++; reasons[e.reason] = (reasons[e.reason] || 0) + 1; }
      if (e.e === 'order-refused' || e.e === 'refused') refused++;
    }
    if (state.tick % 24 === 0) {
      const s = JSON.stringify([state.shards, state.units.map((u) => [u.id, u.x, u.y, u.hp]), state.structures.map((b) => [b.id, b.hp])]);
      if (s === sig) frozenTicks += 24; else frozenTicks = 0;
      sig = s;
      maxFrozen = Math.max(maxFrozen, state.tick > 24 * 300 ? frozenTicks : 0);
    }
    result = state.result ?? checkEnd(state);
  }
  const strips = state.structures.filter((s) => s.kind === 'core').map((s) => Math.round(s.hp));
  return {
    seed, wrap, ticks: state.tick, min: +(state.tick / 1440).toFixed(2), reason: result.reason, winner: result.winner,
    stripHp: strips, frozenSecs: Math.round(maxFrozen / 24), frozen: maxFrozen >= 24 * 60, orders, cordLimits, reasons,
  };
}

if (process.argv[1] && process.argv[1].endsWith('toaster-measure.mjs')) {
  const seed = Number(process.argv[2] ?? 3);
  const t0 = Date.now();
  const out = measure(seed, { maxMin: Number(process.argv[3] ?? 15), wrap: process.argv[4] !== '0' });
  console.log(JSON.stringify({ ...out, sec: Math.round((Date.now() - t0) / 1000) }));
}
