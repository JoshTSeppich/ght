// Debug probe: are the extra Crumbs mining? Read-only.
import { makeMatch } from './lib.mjs';
import { createIdleCrumbs } from '../../play/idle-crumbs.mjs';
import { observeToaster } from '../../play/toaster-play.mjs';
const m = await makeMatch({ seed: 7, difficulty: 'easy', maxTicks: 21600 });
const s = m.d.state;
const idle = createIdleCrumbs({ side: 0 });
const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
s.shards[0] = 300;
let q = 0;
await m.runTicks(24 * 180, () => {
  const c = [...idle.tick(observeToaster(s, 0), new Map())];
  if (q < 4) { c.push({ type: 'train', building: core.id, kind: 'worker' }); q++; }
  m.d.queue(c);
});
for (const u of s.units.filter((x) => x.owner === 0 && x.kind === 'worker')) console.log(u.id, u.x.toFixed(0), u.y.toFixed(0), JSON.stringify(u.order), u.carrying, u.power && u.power.state);
console.log('state keys', Object.keys(s).join(','));
m.stop();
