// Probe (f)+(g): at T0 a perfect straight chain of Extension Boxes (8 tiles apart, the link range) is laid from our Strip to 6 tiles
// from the enemy Strip, and N fed Poppers are dropped at its end. Does the Strip die, when, and what did the chain cost?
// The defender is toaster-easy; we do nothing else. Read-only on the repo.
// Usage: node systems-rush.mjs [N=6] [startSecond=240] [seed=7] [crumbs=0] [reissueEvery=72 ticks]
import { makeMatch } from './lib.mjs';
import { allocId } from '../../env/state.mjs';
import { STATS } from '../../env/stats.mjs';
const N = Number(process.argv[2] ?? 6), T0 = Number(process.argv[3] ?? 240) * 24, seed = Number(process.argv[4] ?? 7), C = Number(process.argv[5] ?? 0), RE = Number(process.argv[6] ?? 72);
const m = await makeMatch({ seed, difficulty: 'easy', maxTicks: 21600 });
const s = m.d.state;
const mine0 = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
const enemy = s.structures.find((x) => x.kind === 'core' && x.owner === 1);
let spawned = false, ids = [], hit = null, boxes = 0;
await m.runTicks(T0 + 24 * 300, (tk) => {
  if (!spawned && tk >= T0) {
    spawned = true;
    const gx = enemy.x - 6, gy = enemy.y + 6;
    const span = Math.max(Math.abs(gx - mine0.x), Math.abs(gy - mine0.y)) - STATS.power?.strip;
    const n = Math.ceil(Math.max(Math.abs(gx - mine0.x), Math.abs(gy - mine0.y)) / 8);
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      s.power.points.push({ id: allocId(s), owner: 0, kind: 'extension', x: Math.round(mine0.x + (gx - mine0.x) * f), y: Math.round(mine0.y + (gy - mine0.y) * f), range: 12 });
      boxes++;
    }
    const last = s.power.points[s.power.points.length - 1];
    for (let i = 0; i < N + C; i++) {
      const kind = i < N ? 'grunt' : 'worker';
      const u = { id: allocId(s), owner: 0, kind, x: last.x + (i % 3), y: last.y + 1 + Math.floor(i / 3), hp: kind === 'grunt' ? 60 : 40, order: null, carrying: 0 };
      s.units.push(u); ids.push(u.id);
      if (s.ammo) s.ammo.slices[u.id] = kind === 'grunt' ? 6 : 0;
    }
    void span;
    console.log(`t=${(tk / 24).toFixed(0)}s chain of ${boxes} boxes (${boxes * 30} wheat) + ${N} Poppers (${N * 75} wheat) = ${boxes * 30 + N * 75} wheat; Strip hp`, enemy.hp, 'enemy units', s.units.filter((u) => u.owner === 1).length);
    m.d.queue(ids.filter((id) => s.units.find((u) => u.id === id).kind === 'grunt').map((id) => ({ type: 'attack', unit: id, target: enemy.id })));
  }
  if (spawned) {
    const mine = s.units.filter((u) => ids.includes(u.id) && u.kind === 'grunt');
    if (RE && (tk - T0) % RE === 0 && tk > T0) m.d.queue(mine.map((u) => ({ type: 'attack', unit: u.id, target: enemy.id })));
    if ((tk - T0) % (24 * 10) === 0) console.log(`+${(tk - T0) / 24}s Strip hp ${enemy.hp} Poppers ${mine.length} slices ${mine.map((u) => s.ammo.slices[u.id]).join(',')} power ${mine.map((u) => u.power && u.power.state).join(',')} enemy units ${s.units.filter((u) => u.owner === 1).length}`);
    if (enemy.hp <= 0 && hit === null) hit = tk;
  }
});
console.log('Strip killed at', hit === null ? 'never (within 5 min)' : ((hit - T0) / 24).toFixed(0) + ' s after the drop', '| ended', JSON.stringify(m.ended));
m.stop();
