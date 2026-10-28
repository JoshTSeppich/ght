// Re-run chain2 up to the walk, then trace tick by tick until the Popper leaves 'plugged'.
import { step } from '../../env/sim.mjs';
import { createPlayableState } from '../../play/toaster-play.mjs';
const mode = process.argv[2] || 'windmill';
const s = createPlayableState(7); s.shards[0] = 3000;
const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
const run = (n, c = []) => { const out = []; for (let i = 0; i < n; i++) out.push(...step(s, [i === 0 ? c : [], []])); return out; };
const crumbs = s.units.filter((u) => u.owner === 0);
if (mode === 'windmill') {
  const w = crumbs[0], pad = s.energy.sites.find((q) => q.kind === 'windmill');
  run(1, [{ type: 'move', unit: w.id, x: pad.x, y: pad.y }]);
  for (let i = 0; i < 24 * 40 && Math.hypot(w.x - pad.x, w.y - pad.y) > 1; i++) run(1);
  run(1, [{ type: 'place-power', unit: w.id, kind: 'windmill', x: pad.x, y: pad.y }]);
}
run(1, [{ type: 'build', unit: crumbs[1].id, kind: 'forge', x: core.x - 2, y: core.y - 2 }]);
run(24 * 14);
const forge = s.structures.find((x) => x.kind === 'forge' && x.owner === 0);
run(1, [{ type: 'train', building: forge.id, kind: 'grunt' }]); run(24 * 5);
const p = s.units.find((u) => u.owner === 0 && u.kind === 'grunt');
if (mode === 'crowd' || mode === 'windmill-crowd') {
  for (const kind of ['lancer', 'brute', 'howler', 'spiker', 'dart']) { run(1, [{ type: 'train', building: forge.id, kind }]); run(24 * 8); }
  console.log('crowd trained; units', s.units.filter((u) => u.owner === 0).length);
}
if (mode === 'hunger') { s.ammo.slices[p.id] = 0; s.ammo.rounds[p.id] = 0; run(24 * 40); console.log('hunger+resupply done; popper at', p.x, p.y, JSON.stringify(p.power)); }
console.log(mode, 'popper at', p.x, p.y);
run(1, [{ type: 'move', unit: p.id, x: 95, y: 149 }]);
for (let i = 0; i < 24 * 8; i++) {
  const ev = run(1).filter((e) => ['cord-limit', 'power-battery', 'power-down'].includes(e.e) && e.id === p.id);
  if (ev.length || i % 24 === 0) console.log('tick+' + i, 'pos', p.x, p.y, p.power.state, 'anchor', p.power.anchor, ev.map((e) => e.e + (e.reason ? ':' + e.reason : '')).join(','));
  if (p.power.state !== 'plugged') break;
}
