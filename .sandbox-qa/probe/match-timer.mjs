// Probe: does a play-page Toaster Wars match (createLiveMatch + createPlayableState + builtin easy AI, maxTicks 21600)
// end early, e.g. at tick 2000 (83 s)? Same fake-timer harness as tests/sandbox.test.mjs.
import { createLiveMatch } from '../../env/live.mjs';
import { createPlayableState } from '../../play/toaster-play.mjs';
const ai = await import('../../players/builtin/ai.mjs');
const LIMIT_S = Number(process.argv[2] || 100);
let t = 0, seq = 0; const timers = new Map();
const turns = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
let ended = null;
const d = createLiveMatch({ seed: 7, human: 0, createState: createPlayableState, tps: 24, ai, maxTicks: 24 * 60 * 15, difficulty: 'easy',
  now: () => t, setTimer: (fn, w) => { timers.set(++seq, { at: t + Math.max(0, w), fn }); return seq; }, clearTimer: (id) => timers.delete(id) });
d.on('end', (r) => { ended = r; });
await d.ready();
d.start();
const ms = LIMIT_S * 1000;
for (let i = 0; i < 200000 && t < ms && !ended; i++) {
  await turns();
  const due = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
  if (!due || due[1].at > ms) break;
  timers.delete(due[0]); t = Math.max(t, due[1].at); due[1].fn();
}
await turns();
console.log(JSON.stringify({ virtualSeconds: t / 1000, tick: d.state.tick, stateMaxTicks: d.state.maxTicks, ended }, null, 1));
d.stop();
