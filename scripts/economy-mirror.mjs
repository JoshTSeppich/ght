// Economy curve of the bot mirror (PLAYABLE.md item 14). Owner: sonnet.
//   node scripts/economy-mirror.mjs [seeds=6] [maxMin=15]
// One line per seed: how it ended, then at 2/5/8/12 min side 0's fighters, Mills, Toasters, wheat in the bank, and toast.
import { step, checkEnd } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const MARKS = [2, 5, 8, 12];

export function mirror(seed, maxMin = 15) {
  const state = createToasterState(seed);
  state.maxTicks = maxMin * 1440;
  const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed }));
  const marks = {};
  let result = null, firstShot = null;
  while (!result) {
    const cmds = [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []);
    const events = step(state, cmds);
    if (firstShot === null && events.some((e) => e.e === 'attack' || e.e === 'hit' || e.e === 'shot')) firstShot = +(state.tick / 1440).toFixed(1);
    const m = state.tick / 1440;
    if (state.tick % 1440 === 0 && MARKS.includes(m)) {
      const mine = (k) => state.structures.filter((s) => s.owner === 0 && s.kind === k).length;
      marks[m] = {
        fighters: state.units.filter((u) => u.owner === 0 && u.kind !== 'worker').length,
        crumbs: state.units.filter((u) => u.owner === 0 && u.kind === 'worker').length,
        mills: mine('mill'), toasters: mine('toaster'), wheat: Math.round(state.shards[0]),
      };
    }
    result = state.result ?? checkEnd(state);
  }
  return { seed, min: +(state.tick / 1440).toFixed(1), reason: result.reason, winner: result.winner, firstShot, marks };
}

if (process.argv[1] && process.argv[1].endsWith('economy-mirror.mjs')) {
  const n = Number(process.argv[2] ?? 6), maxMin = Number(process.argv[3] ?? 15);
  for (let seed = 1; seed <= n; seed++) {
    const r = mirror(seed, maxMin);
    const m = Object.entries(r.marks).map(([k, v]) => `${k}m f${v.fighters}/c${v.crumbs}/M${v.mills}/T${v.toasters}/$${v.wheat}`).join(' ');
    console.log(`seed ${r.seed}: ended ${r.min}m ${r.reason} winner ${r.winner} | first shot ${r.firstShot}m | ${m}`);
  }
}
