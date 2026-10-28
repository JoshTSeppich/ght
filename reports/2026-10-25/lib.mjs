// Shared harness (copy of reports/2026-10-24/lib.mjs): builds the exact play-page match with fake timers.
// Opponent is players/toaster-easy/bot.mjs, the page's real default (play/opponent.mjs:19 opponentAiName), not the classic builtin AI.
import { createLiveMatch } from '../../env/live.mjs';
import { createPlayableState } from '../../play/toaster-play.mjs';
const ai = await import('../../players/toaster-easy/bot.mjs');
export async function makeMatch({ seed = 7, difficulty = 'easy', maxTicks = 21600, noAi = false } = {}) {
  let t = 0, seq = 0; const timers = new Map(); let ended = null;
  const turns = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
  const d = createLiveMatch({ seed, human: 0, createState: createPlayableState, tps: 24, ai, maxTicks, difficulty,
    now: () => t, setTimer: (fn, w) => { timers.set(++seq, { at: t + Math.max(0, w), fn }); return seq; }, clearTimer: (id) => timers.delete(id) });
  d.on('end', (r) => { ended = r; });
  await d.ready(); d.start();
  // run until tick >= n (or ended); onTick(tick) fires after each new tick
  const runTicks = async (n, onTick) => {
    let last = d.state.tick;
    for (let i = 0; i < 5000000 && d.state.tick < n && !ended; i++) {
      await turns();
      const due = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]); t = Math.max(t, due[1].at); due[1].fn();
      if (onTick && d.state.tick !== last) { last = d.state.tick; onTick(d.state.tick); }
    }
    await turns();
  };
  return { d, runTicks, get ended() { return ended; }, stop: () => d.stop() };
}
