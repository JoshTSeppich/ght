// Fresh-eyes playthrough: scripted human opening on the real page match vs toaster-easy. Read-only.
import { makeMatch } from './lib.mjs';
import { createIdleCrumbs } from '../../play/idle-crumbs.mjs';
import { observeToaster } from '../../play/toaster-play.mjs';
import { isFree } from '../../env/state.mjs';
import { STATS } from '../../env/stats.mjs';
const seed = Number(process.argv[2] ?? 7), TPS = 24;
const m = await makeMatch({ seed, maxTicks: 15 * 60 * TPS + 5 });
const s = m.d.state, idle = createIdleCrumbs({ side: 0 });
const my = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
const en = s.structures.find((x) => x.kind === 'core' && x.owner === 1);
console.log('my strip', my.x, my.y, 'enemy', en.x, en.y, 'springs', JSON.stringify(s.springs));
const spot = (cx, cy, r0 = 1, R = 10) => {
  for (let r = r0; r <= R; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || !isFree(s, x, y)) continue;
    return { x, y };
  }
  return null;
};
const dirx = Math.sign(en.x - my.x), diry = Math.sign(en.y - my.y);
const plan = [['mill', () => spot(my.x + 3, my.y - 3)], ['well', () => spot(11, 239)], ['toaster', () => spot(my.x + 2, my.y + 2)], ['forge', () => spot(my.x - 3, my.y - 3)]];
let next = 0, trained = 0, boxes = 0, firstBake = null, firstHit = null, lastBox = null;
const posted = [];
const cnt = (o, k) => s.units.filter((u) => u.owner === o && u.kind === k).length;
await m.runTicks(15 * 60 * TPS, (tk) => {
  const cmds = [...idle.tick(observeToaster(s, 0), new Map())];
  const free = s.units.filter((u) => u.owner === 0 && u.kind === 'worker' && !(u.order && u.order.type === 'build'));
  const sh = s.shards[0];
  if (next < plan.length && sh >= STATS.structures[plan[next][0]].cost && free.length) {
    const a = plan[next][1]();
    if (a) { cmds.push({ type: 'build', unit: free[0].id, kind: plan[next][0], x: a.x, y: a.y }); posted.push(`${(tk / TPS).toFixed(0)}s queued ${plan[next][0]} @${a.x},${a.y}`); next++; }
  }
  const forge = s.structures.find((x) => x.kind === 'forge' && x.owner === 0 && x.complete);
  if (forge && trained < 4 && sh >= 75) { cmds.push({ type: 'train', building: forge.id, kind: 'grunt' }); trained++; posted.push(`${(tk / TPS).toFixed(0)}s queued popper ${trained}`); }
  if (forge && trained >= 4 && boxes < 4 && sh >= 105 && free.length && tk % 48 === 0) {
    const base = lastBox ?? { x: my.x, y: my.y };
    const t = spot(Math.round(base.x + dirx * 9), Math.round(base.y + diry * 9), 0, 4);
    if (t) { cmds.push({ type: 'build', unit: free[free.length - 1].id, kind: 'extension', x: t.x, y: t.y }); lastBox = t; boxes++; posted.push(`${(tk / TPS).toFixed(0)}s queued extension @${t.x},${t.y}`); }
  }
  m.d.queue(cmds);
  for (const e of s.events ?? []) {
    if (e.e === 'bake' && e.player === 0 && !e.pilot && firstBake === null) { firstBake = tk; posted.push(`${(tk / TPS).toFixed(0)}s FIRST TOAST`); }
    if (e.e === 'hit') {
      const t = s.units.find((u) => u.id === e.id) ?? s.structures.find((x) => x.id === e.id);
      const a = s.units.find((u) => u.id === e.by) ?? s.structures.find((x) => x.id === e.by);
      if (t?.owner === 0 && a?.owner === 1 && firstHit === null) { firstHit = tk; posted.push(`${(tk / TPS).toFixed(0)}s FIRST ENEMY HIT on ${t.kind} by ${a.kind}`); }
    }
  }
  if (tk % (60 * TPS) === 0) {
    const k = s.toast;
    const myc = s.structures.find((x) => x.kind === 'core' && x.owner === 0), ec = s.structures.find((x) => x.kind === 'core' && x.owner === 1);
    console.log(`min ${tk / TPS / 60}: wheat ${Math.floor(sh)} flour ${k.pantry[0].flour} water ${k.pantry[0].water} toast ${k.stack[0]} | crumbs ${cnt(0, 'worker')} poppers ${cnt(0, 'grunt')} units ${s.units.filter((u) => u.owner === 0).length} | enemy units ${s.units.filter((u) => u.owner === 1).length} (poppers ${cnt(1, 'grunt')}) wheat ${Math.floor(s.shards[1])} | strip hp ${myc?.hp} vs ${ec?.hp} | mine ${s.structures.filter((x) => x.owner === 0 && x.complete).map((x) => x.kind).join(',')}`);
    while (posted.length) console.log('   ', posted.shift());
  }
});
console.log('ended', JSON.stringify(m.ended), 'tick', s.tick / TPS / 60, 'min');
posted.forEach((p) => console.log('   ', p));
m.stop();
