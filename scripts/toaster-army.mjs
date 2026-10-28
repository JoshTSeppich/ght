// Where is one side's army and chain at a given minute. node scripts/toaster-army.mjs <seed> <minute> <side>
import { step } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const seed = Number(process.argv[2] ?? 3), min = Number(process.argv[3] ?? 10), side = Number(process.argv[4] ?? 1);
const state = createToasterState(seed);
state.maxTicks = min * 1440 + 1;
const bots = [0, 1].map((s) => createPlayer({ side: s, stats: STATS, seed }));
while (state.tick < min * 1440) {
  const cmds = [0, 1].map((s) => bots[s].act(JSON.parse(JSON.stringify(observe(state, s)))) || []);
  step(state, cmds);
}
const foe = state.structures.find((s) => s.kind === 'core' && s.owner !== side);
const mineCore = state.structures.find((s) => s.kind === 'core' && s.owner === side);
console.log('foe core', foe.x, foe.y, 'hp', foe.hp, 'mine', mineCore.x, mineCore.y);
const pts = state.power.points.filter((p) => p.owner === side).map((p) => [p.x, p.y]);
console.log('boxes', pts.length, 'last 6', JSON.stringify(pts.slice(-6)));
for (const u of state.units.filter((q) => q.owner === side && q.kind !== 'worker')) {
  console.log(u.kind, u.id, u.x, u.y, 'hp', u.hp, 'order', JSON.stringify(u.order), 'power', u.power.state, 'anchor', u.power.anchor, 'refused', JSON.stringify(u.power.refused), 'ammo', JSON.stringify(u.ammo || u.fed));
}
console.log('structures', JSON.stringify(state.structures.filter((s) => s.owner === side).map((s) => [s.kind, s.x, s.y, s.complete])));
console.log('toast', JSON.stringify(state.toast));
