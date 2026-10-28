// Trace the chain2 cord-leash walk tick by tick (same setup as reports/2026-10-24/chain2.mjs, minus prints).
import { step } from '../env/sim.mjs';
import { STATS } from '../env/stats.mjs';
import { createPlayableState } from '../play/toaster-play.mjs';
import { stepVerdict } from '../env/power.mjs';
import { distance } from '../env/state.mjs';

const mode = process.argv[2] || 'full';
const s = createPlayableState(7);
const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
const crumbs = () => s.units.filter((u) => u.owner === 0 && u.kind === 'worker');
const run = (n, c0 = [], c1 = []) => { const out = []; for (let i = 0; i < n; i++) out.push(...step(s, [i === 0 ? c0 : [], i === 0 ? c1 : []])); return out; };
s.shards[0] = 3000;
const pad = s.energy.sites.find((q) => q.kind === 'windmill');
const w = crumbs()[0];
run(1, [{ type: 'move', unit: w.id, x: pad.x, y: pad.y }]);
for (let i = 0; i < 24 * 40 && Math.hypot(w.x - pad.x, w.y - pad.y) > 1; i++) run(1);
run(1, [{ type: 'place-power', unit: w.id, kind: 'windmill', x: pad.x, y: pad.y }]);
// forge
let forgeSpot = null;
for (let r = 2; r < 10 && !forgeSpot; r++) for (let y = core.y - r; y <= core.y + r && !forgeSpot; y++) for (let x = core.x - r; x <= core.x + r; x++) {
  if (Math.max(Math.abs(x - core.x), Math.abs(y - core.y)) !== r) continue;
  if (s.rockSet?.has(x + ',' + y) || s.crystals.some((c) => c.x === x && c.y === y) || s.structures.some((q) => q.x === x && q.y === y) || s.units.some((u) => u.x === x && u.y === y)) continue;
  forgeSpot = { x, y }; break;
}
run(1, [{ type: 'build', unit: crumbs()[1].id, kind: 'forge', x: forgeSpot.x, y: forgeSpot.y }]);
run(24 * 12);
const forge = s.structures.find((x) => x.kind === 'forge' && x.owner === 0);
for (const kind of ['grunt', 'lancer', 'brute', 'howler', 'spiker', 'dart', 'worker']) {
  const host = kind === 'worker' ? core : forge;
  const n0 = s.units.length;
  run(1, [{ type: 'train', building: host.id, kind }]);
  for (let i = 0; i < 24 * 15 && s.units.length === n0; i++) run(1);
}
const w1 = s.shards[0]; run(24 * 60);
const popper = s.units.find((u) => u.owner === 0 && u.kind === 'grunt');
if (mode === 'hunger') { s.ammo.slices[popper.id] = 0; s.ammo.rounds[popper.id] = 0; run(24 * 40); }
const p = popper;
console.log('setup done: tick', s.tick, 'units', s.units.length, 'popper', p.x, p.y, JSON.stringify(p.power), 'wheat', s.shards[0]);
run(1, [{ type: 'move', unit: p.id, x: 95, y: 149 }]);
const owned = () => s.power.view.points.filter((q) => q.owner === 0);
let prev = { x: p.x, y: p.y };
let maxD = 0;
for (let i = 0; i < 24 * 90; i++) {
  const t = s.tick + 1;
  const evs = run(1);
  if (t >= 2163 && t <= 2165) console.log('RESULT', t, JSON.stringify(s.result));
  const mine = evs.filter((e) => e.id === p.id);
  const moved = p.x !== prev.x || p.y !== prev.y;
  const d = Math.min(...owned().map((q) => distance(q, p)));
  maxD = Math.max(maxD, d);
  if (moved && (d > 12 || mine.length)) {
    console.log('tick', t, 'from', prev.x, prev.y, 'to', p.x, p.y, 'd', d, 'state', p.power.state, 'anchor', p.power.anchor,
      'verdict', stepVerdict(s, p, p.x, p.y), 'events', mine.map((e) => e.e + (e.reason ? ':' + e.reason : '')).join(','),
      'order', JSON.stringify(p.order));
  }
  prev = { x: p.x, y: p.y };
}
console.log('end', p.x, p.y, p.power.state, 'maxD', maxD);
