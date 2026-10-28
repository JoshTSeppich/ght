// B: the bread chain, costs, power shedding, hunger, cord leash on the REAL play state (createPlayableState).
// Probe setup (stated, not a rule): side 0 starts with extra wheat so the chain can be timed without farming, and no Crumb gathers.
import { step } from '../../env/sim.mjs';
import { STATS } from '../../env/stats.mjs';
import { createPlayableState } from '../../play/toaster-play.mjs';
import { structurePowered, BAKERY } from '../../env/bakery.mjs';
import { unitState, canFire, canMove, observeAmmo } from '../../env/ammo.mjs';
import { upkeepPerMinute } from '../../env/budget.mjs';
import { renderBar } from '../../play/hud-bar.mjs';

const TPS = 24;
const s = createPlayableState(7);
const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
const crumbs = s.units.filter((u) => u.owner === 0 && u.kind === 'worker');
const log = [];
const ev = {};
const run = (n, cmds0 = []) => {
  for (let i = 0; i < n; i++) {
    const out = step(s, [i === 0 ? cmds0 : [], []]);
    for (const e of out) {
      ev[e.e] = (ev[e.e] || 0) + 1;
      if (e.e === 'reject' && e.player === 0) log.push('REJECT ' + JSON.stringify(e));
    }
  }
};
const free = (x, y) => x >= 0 && y >= 0 && !s.rockSet?.has(`${x},${y}`) && !s.crystals.some((c) => c.x === x && c.y === y) && !s.structures.some((q) => q.x === x && q.y === y) && !s.units.some((u) => u.x === x && u.y === y);
function waterKind(x, y) {
  const r = BAKERY.wellReach;
  for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) if (s.bakery.water?.has(`${i},${j}`)) return 'creek';
  return s.bakery.springs.some(([sx, sy]) => Math.max(Math.abs(sx - x), Math.abs(sy - y)) <= r) ? 'spring' : null;
}
function site(kind, avoid = []) {
  for (let r = 2; r <= 14; r++) for (let y = core.y - r; y <= core.y + r; y++) for (let x = core.x - r; x <= core.x + r; x++) {
    if (Math.max(Math.abs(x - core.x), Math.abs(y - core.y)) !== r || !free(x, y)) continue;
    if (avoid.some((a) => Math.abs(a.x - x) < 2 && Math.abs(a.y - y) < 2)) continue;
    if (!structurePowered(s, { owner: 0, kind, x, y })) continue;
    if (kind === 'well' && !waterKind(x, y)) continue;
    return { x, y };
  }
  return null;
}
const placed = [];
function build(kind, builder) {
  const p = site(kind, placed);
  const before = s.shards[0];
  run(1, [{ type: 'build', unit: builder.id, kind, x: p.x, y: p.y }]);
  placed.push(p);
  const paid = before - s.shards[0];
  return { kind, p, paid, listed: STATS.structures[kind].cost };
}
s.shards[0] = 2000; // probe setup
console.log('== costs: wheat actually taken at placement vs STATS / ECONOMY.md');
const cost = [];
const mill = build('mill', crumbs[0]); const well = build('well', crumbs[1]); const toaster = build('toaster', crumbs[2]);
for (const c of [mill, well, toaster]) cost.push(`${c.kind}: paid ${c.paid}, STATS ${c.listed}, at (${c.p.x},${c.p.y})`);
console.log(cost.join('\n'));
console.log('well water source:', waterKind(well.p.x, well.p.y));
const startTick = s.tick;
const ticks = (n) => run(n);
// record per-event timing
const times = { mill: [], well: [], bake: [] };
for (let i = 0; i < 24 * 240; i++) {
  const out = step(s, [[], []]);
  for (const e of out) {
    if (e.player === 0 && times[e.e] && !e.pilot) times[e.e].push(s.tick);
    if (e.e === 'reject' && e.player === 0) log.push('REJECT ' + JSON.stringify(e));
  }
}
const gaps = (a) => a.slice(1).map((v, i) => ((v - a[i]) / TPS).toFixed(1)).slice(0, 8).join(',');
console.log('== 240 s of chain (no Crumb farming; wheat banked 2000-ish)');
for (const k of ['mill', 'well', 'bake']) console.log(`${k}: ${times[k].length} events, first at ${(times[k][0] / TPS).toFixed(1)} s, gaps(s) ${gaps(times[k])}`);
console.log('wheat now', Math.floor(s.shards[0]), 'pantry', JSON.stringify(s.toast.pantry[0]), 'stack', s.toast.stack[0], 'rejects', log.slice(0, 3));
console.log('expected: mill 1 flour / 20 s costing 10 wheat; well creek 1/6 s, spring 1/12 s; toaster +4 slices / 5 s');

console.log('== 2nd Toaster with no Windmill (made 2, each Toaster uses 2)');
const t2 = build('toaster', crumbs[3]);
run(24 * 12);
console.log('toaster2 paid', t2.paid, 'energy', JSON.stringify(s.energy.report[0]), 'shedToasters', JSON.stringify([...s.energy.shedToasters]));
console.log('HUD:', renderBar(s, { side: 0 }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
const st = s.structures.filter((x) => x.kind === 'toaster' && x.owner === 0).map((x) => `${x.id}:powered=${structurePowered(s, x)}`);
console.log('toasters', st.join(' '));
// bake events in next 60s per toaster
const bakes = {};
for (let i = 0; i < 24 * 60; i++) for (const e of step(s, [[], []])) if (e.e === 'bake' && e.player === 0 && !e.pilot) bakes[e.id] = (bakes[e.id] || 0) + 1;
console.log('bakes per toaster id in 60 s (flour+water supplied only by 1 Mill, so compare powered vs shed):', JSON.stringify(bakes));

console.log('== Windmill fix: build a windmill on pad (30,224) cost');
const pad = s.energy.sites.find((q) => q.kind === 'windmill');
const w0 = s.shards[0];
run(1, [{ type: 'build', unit: crumbs[4].id, kind: 'windmill', x: pad.x, y: pad.y }]);
console.log('windmill paid', w0 - s.shards[0], 'site', JSON.stringify(pad), 'cmd rejects', log.filter((l) => l.includes('windmill')).slice(0, 2));
run(24 * 40);
console.log('energy after 40 s', JSON.stringify(s.energy.report[0]), 'windmill complete?', s.structures.filter((q) => q.kind === 'windmill').map((q) => q.owner + ':' + q.complete).join(','));

console.log('== Units: train costs and upkeep');
const forge = build('forge', crumbs[5]);
console.log('forge paid', forge.paid, 'STATS', forge.listed);
run(24 * 10);
const f = s.structures.find((x) => x.kind === 'forge' && x.owner === 0);
console.log('forge complete', f?.complete);
const costs = {};
for (const kind of ['grunt', 'lancer', 'brute', 'howler', 'spiker', 'dart', 'worker']) {
  const host = kind === 'worker' ? core : f;
  const b = s.shards[0];
  run(1, [{ type: 'train', building: host.id, kind }]);
  costs[kind] = `paid ${b - s.shards[0]} STATS ${STATS.units[kind].cost}`;
  run(24 * 8);
}
console.log(JSON.stringify(costs, null, 1));
const up = upkeepPerMinute(s, 0);
const fighters = s.units.filter((u) => u.owner === 0 && u.kind !== 'worker').length;
console.log('fighters', fighters, 'upkeep/min per budget.mjs', up.shards.toFixed(2), 'HUD', renderBar(s, { side: 0 }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').match(/Upkeep [^ ]+/)?.[0]);
const w1 = s.shards[0]; run(24 * 60); console.log('wheat change over 60 s (mill eats, no income; windmill 0 cost):', Math.floor(s.shards[0] - w1));
globalThis.__s = s;
export { s, run, crumbs, f, core };
