// Probe (b): wheat income per minute with 6, 8 or 10 Crumbs on the page match (nothing built, nothing else spent).
// Extra Crumbs are trained from a topped-up bank; the top-up is exactly the Crumbs' price. Read-only on the repo.
// Usage: node systems-income.mjs [crumbs=6] [seed=7] [spread=0|1]
//   spread=0: the page's idle-Crumb hook (everyone goes to the nearest wheat tile, as in play).
//   spread=1: a careful player right-clicks Crumb i onto the (i mod 6)-th nearest wheat tile instead.
import { makeMatch } from './lib.mjs';
import { createIdleCrumbs } from '../../play/idle-crumbs.mjs';
import { observeToaster } from '../../play/toaster-play.mjs';
const C = Number(process.argv[2] ?? 6), seed = Number(process.argv[3] ?? 7), SPREAD = Number(process.argv[4] ?? 0);
const m = await makeMatch({ seed, difficulty: 'easy', maxTicks: 21600 });
const s = m.d.state;
const idle = createIdleCrumbs({ side: 0 });
const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
s.shards[0] = 100 + 50 * (C - 6);
const near = s.crystals.filter((t) => t.amount > 0).sort((a, b) => Math.hypot(a.x - core.x, a.y - core.y) - Math.hypot(b.x - core.x, b.y - core.y)).slice(0, 8);
let queued = 0;
const marks = [];
await m.runTicks(24 * 60 * 6 + 1, (tk) => {
  const cmds = [];
  if (SPREAD) {
    if (tk % 48 === 1) {
      const cr = s.units.filter((u) => u.owner === 0 && u.kind === 'worker').sort((a, b) => a.id - b.id);
      cr.forEach((u, i) => {
        const t = near[i % near.length];
        if (!u.order || u.order.type !== 'gather' || u.order.x !== t.x || u.order.y !== t.y) cmds.push({ type: 'gather', unit: u.id, x: t.x, y: t.y });
      });
    }
  } else cmds.push(...idle.tick(observeToaster(s, 0), new Map()));
  if (queued < C - 6) { cmds.push({ type: 'train', building: core.id, kind: 'worker' }); queued++; }
  m.d.queue(cmds);
  if (tk % (24 * 60) === 0 && tk >= 24 * 60) marks.push([tk / 1440, Math.floor(s.shards[0])]);
});
const crumbs = s.units.filter((u) => u.owner === 0 && u.kind === 'worker').length;
console.log(`Crumbs ${crumbs} spread=${SPREAD}; bank at each minute:`, marks.map((x) => `${x[0]}:${x[1]}`).join(' '));
const per = marks.slice(1).map((x, i) => x[1] - marks[i][1]);
console.log('wheat per minute (min 2..6):', per.join(', '), '| per Crumb per minute:', per.map((p) => (p / crumbs).toFixed(1)).join(', '));
m.stop();
