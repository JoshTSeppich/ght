// D: the cord leash. Send a fresh Popper on a long walk away from base; log distance to nearest own power point and power state.
import { step } from '../../env/sim.mjs';
import { createPlayableState } from '../../play/toaster-play.mjs';
import { unitState } from '../../env/ammo.mjs';
const s = createPlayableState(7);
s.shards[0] = 3000;
const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
// probe setup: add a Popper via debug spawn is not needed; use F8-like path: train needs a forge, so build one fast.
const builder = s.units.find((u) => u.owner === 0);
const evs = [];
const run = (n, c = []) => { for (let i = 0; i < n; i++) for (const e of step(s, [i === 0 ? c : [], []])) if (['power-battery', 'power-down', 'cord-cut'].includes(e.e)) evs.push(s.tick + ':' + e.e + ':' + e.id); };
if (process.argv[2] === 'windmill') {
  const w = s.units.filter((u) => u.owner === 0)[1];
  const pad = s.energy.sites.find((q) => q.kind === 'windmill');
  run(1, [{ type: 'move', unit: w.id, x: pad.x, y: pad.y }]);
  for (let i = 0; i < 24 * 40 && Math.hypot(w.x - pad.x, w.y - pad.y) > 1; i++) run(1);
  run(1, [{ type: 'place-power', unit: w.id, kind: 'windmill', x: pad.x, y: pad.y }]);
  console.log('windmill placed at', pad.x, pad.y);
}
run(1, [{ type: 'build', unit: builder.id, kind: 'forge', x: core.x + 4, y: core.y }]);
run(24 * 14);
const forge = s.structures.find((x) => x.kind === 'forge' && x.owner === 0);
run(1, [{ type: 'train', building: forge.id, kind: 'grunt' }]);
run(24 * 5);
const p = s.units.find((u) => u.owner === 0 && u.kind === 'grunt');
console.log('popper', p.id, 'at', p.x, p.y, 'complete forge', forge.complete);
const dir = [{ x: Number(process.argv[3] || 150), y: Number(process.argv[4] || 150), name: 'toward map centre (enemy)' }];
run(1, [{ type: 'move', unit: p.id, x: dir[0].x, y: dir[0].y }]);
const near = () => Math.min(...(s.power.view.points).filter((q) => q.owner === 0).map((q) => Math.hypot(q.x - p.x, q.y - p.y)));
let lastMsg = '';
for (let sec = 1; sec <= 60; sec++) {
  run(24);
  if (sec <= 20 || sec % 10 === 0) console.log(`t+${sec}s pos (${p.x},${p.y}) nearestPoint ${near().toFixed(1)} state=${p.power.state} battery=${p.power.battery} order=${p.order ? p.order.type : 'none'} ammoState=${unitState(s, p)}`);
}
console.log('events', evs.join(' '));
