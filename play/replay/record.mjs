// Records a Toaster Wars match between two toaster-sonnet bots for the TV (watch mode). Owner: sonnet.
//   node play/replay/record.mjs <seed> [out.json]     (writes play/replay/toaster-seed-<seed>.json.gz by default)
// The match runs on createReplayState(seed), the state the TV page builds, with both bots acting every tick.
// Only the non-empty command lists are kept: the sim is deterministic, so seed + commands replay the whole match.
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { step, checkEnd } from '../../env/sim.mjs';
import { observe } from '../../env/state.mjs';
import { STATS } from '../../env/stats.mjs';
import { createReplayState } from '../toaster-play.mjs';
import { createPlayer } from '../../players/toaster-sonnet/bot.mjs';

export const MAX_TICKS = 24 * 60 * 15;

/** Play the match; returns { seed, maxTicks, ticks, result, commands: { tick: [cmds0, cmds1] } }. */
export function recordMatch(seed, { maxTicks = MAX_TICKS } = {}) {
  const state = createReplayState(seed);
  state.maxTicks = maxTicks;
  const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed }));
  const commands = {};
  let result = null;
  while (!result) {
    const cmds = [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []);
    if (cmds[0].length || cmds[1].length) commands[state.tick] = cmds;
    step(state, cmds);
    result = state.result ?? checkEnd(state);
  }
  return { seed, maxTicks, ticks: state.tick, result, commands };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seed = Number(process.argv[2] ?? 3);
  const out = process.argv[3] ?? fileURLToPath(new URL(`./toaster-seed-${seed}.json.gz`, import.meta.url));
  const t0 = Date.now();
  const rec = recordMatch(seed);
  writeFileSync(out, out.endsWith('.gz') ? gzipSync(JSON.stringify(rec), { level: 9 }) : JSON.stringify(rec));
  console.log(JSON.stringify({ seed, ticks: rec.ticks, min: +(rec.ticks / 1440).toFixed(2), result: rec.result, sec: (Date.now() - t0) / 1000, out }));
}
