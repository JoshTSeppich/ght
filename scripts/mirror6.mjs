// Mirror games on the REAL Toaster rules incl. energy (no exemption). Owner: sonnet.
//   node scripts/mirror6.mjs <seed> [maxMin=20] [bot=sonnet|easy]    prints one JSON line
import { step, checkEnd } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createPlayableState } from '../play/toaster-play.mjs';

export async function mirror(seed, maxMin = 20, bot = 'sonnet') {
  const { createPlayer } = await import(`../players/toaster-${bot}/bot.mjs`);
  const state = createPlayableState(seed);
  state.maxTicks = maxMin * 1440;
  const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed }));
  let result = null, firstShot = null, wind = [0, 0], dams = [0, 0], dark = 0;
  while (!result) {
    const cmds = [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []);
    const events = step(state, cmds);
    if (firstShot === null && events.some((e) => e.e === 'attack' || e.e === 'hit' || e.e === 'shot')) firstShot = +(state.tick / 1440).toFixed(1);
    if (state.tick % 240 === 0) {
      wind = [0, 1].map((s) => state.power.points.filter((p) => p.owner === s && p.kind === 'windmill').length);
      dark += state.energy.shedToasters.size;
      dams = [0, 1].map((q) => state.power.points.filter((p) => p.owner === q && p.kind === 'dam').length);
    }
    result = state.result ?? checkEnd(state);
  }
  const strips = state.structures.filter((s) => s.kind === 'core').map((s) => Math.round(s.hp));
  return { seed, bot, min: +(state.tick / 1440).toFixed(1), reason: result.reason, winner: result.winner, firstShot, windmills: wind, dams, darkSamples: dark, stripHp: strips, energy: state.energy.report };
}

if (process.argv[1] && process.argv[1].endsWith('mirror6.mjs')) {
  console.log(JSON.stringify(await mirror(Number(process.argv[2] ?? 1), Number(process.argv[3] ?? 20), process.argv[4] ?? 'sonnet')));
}
