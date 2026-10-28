// C: Windmill fixes Power, unit total cost + upkeep (no Mill so the wheat delta is clean), hunger, cord leash.
import { step } from '../../env/sim.mjs';
import { STATS } from '../../env/stats.mjs';
import { createPlayableState } from '../../play/toaster-play.mjs';
import { unitState, canFire, canMove, observeAmmo, stockOf } from '../../env/ammo.mjs';
import { upkeepPerMinute } from '../../env/budget.mjs';
import { renderBar } from '../../play/hud-bar.mjs';
import { POWER } from '../../env/power.mjs';

const bar = (s) => renderBar(s, { side: 0 }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const s = createPlayableState(7);
const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
const crumbs = () => s.units.filter((u) => u.owner === 0 && u.kind === 'worker');
const rej = [];
const run = (n, cmds0 = [], cmds1 = []) => { for (let i = 0; i < n; i++) for (const e of step(s, [i === 0 ? cmds0 : [], i === 0 ? cmds1 : []])) { if (globalThis.__watch && e.id === globalThis.__watch && ['cord-limit', 'power-battery', 'power-down', 'cord-cut'].includes(e.e)) console.log('   EVENT tick', s.tick, e.e, e.reason || '', 'pos', globalThis.__p.x, globalThis.__p.y, 'prevAnchor-points', JSON.stringify(s.power.view.points.filter((q) => q.owner === 0).map((q) => q.kind + '@' + q.x + ',' + q.y + ' r' + q.range + ' d' + Math.hypot(q.x - globalThis.__p.x, q.y - globalThis.__p.y).toFixed(1))), 'wrap cord', JSON.stringify(globalThis.__p.power.cord || null).slice(0, 160)); if (e.e === 'reject' && e.player === 0) rej.push(e.reason + ':' + e.command?.type); } };
s.shards[0] = 3000; // probe setup

console.log('== Windmill: walk a Crumb to the pad, place-power');
const pad = s.energy.sites.find((q) => q.kind === 'windmill');
const w = crumbs()[0];
run(1, [{ type: 'move', unit: w.id, x: pad.x, y: pad.y }]);
for (let i = 0; i < 24 * 40 && Math.hypot(w.x - pad.x, w.y - pad.y) > 1; i++) run(1);
console.log('crumb at', w.x, w.y, 'pad', pad.x, pad.y, 'core', core.x, core.y);
const b0 = s.shards[0];
run(1, [{ type: 'place-power', unit: w.id, kind: 'windmill', x: pad.x, y: pad.y }]);
console.log('windmill paid', b0 - s.shards[0], '(ENERGY.cost 40)', 'rejects', rej.slice(-2));
console.log('energy', JSON.stringify(s.energy.report[0]), '| HUD', bar(s));

console.log('== Toasters needing power: 1 toaster -> 2/ made; add Windmill makes 5');
console.log('(energy.mjs make: strip 2, windmill 3, toaster use 2)');

console.log('== Units: total wheat taken for each unit (queue one, wait to spawn, no Mill, no income)');
// forge first
const builder = crumbs()[1];
const spot = [core.x + 3, core.y + 3];
let forgeSpot = null;
for (let r = 2; r < 10 && !forgeSpot; r++) for (let y = core.y - r; y <= core.y + r && !forgeSpot; y++) for (let x = core.x - r; x <= core.x + r; x++) {
  if (Math.max(Math.abs(x - core.x), Math.abs(y - core.y)) !== r) continue;
  if (s.rockSet?.has(x + ',' + y) || s.crystals.some((c) => c.x === x && c.y === y) || s.structures.some((q) => q.x === x && q.y === y) || s.units.some((u) => u.x === x && u.y === y)) continue;
  forgeSpot = { x, y }; break;
}
run(1, [{ type: 'build', unit: builder.id, kind: 'forge', x: forgeSpot.x, y: forgeSpot.y }]);
run(24 * 12);
const forge = s.structures.find((x) => x.kind === 'forge' && x.owner === 0);
console.log('forge complete', forge.complete, 'rejects', rej.slice(-2));
const table = [];
for (const kind of ['grunt', 'lancer', 'brute', 'howler', 'spiker', 'dart', 'worker']) {
  const host = kind === 'worker' ? core : forge;
  const b = s.shards[0], n0 = s.units.length;
  run(1, [{ type: 'train', building: host.id, kind }]);
  for (let i = 0; i < 24 * 15 && s.units.length === n0; i++) run(1);
  const b2 = s.shards[0];
  table.push(`${kind}: wheat taken ${(b - b2)} (STATS ${STATS.units[kind].cost}) spawned=${s.units.length > n0} in ${(i => i)(0) || ''}`);
  // idle upkeep sanity: the upkeep is also draining while waiting, so compensate below
}
console.log(table.join('\n'));
const up = upkeepPerMinute(s, 0).shards;
console.log('upkeep/min (budget.mjs)', up.toFixed(3), 'HUD:', bar(s).match(/Upkeep \S+/)[0]);
const kinds = s.units.filter((u) => u.owner === 0 && u.kind !== 'worker').map((u) => u.kind);
const exp = kinds.reduce((t, k) => t + STATS.units[k].cost * 0.05, 0);
console.log('fighters', kinds.join(','), 'expected 5% of cost each =', exp.toFixed(2), '/min (crumbs pay none)');
const w1 = s.shards[0]; run(24 * 60); console.log('60 s with no income/no mill: wheat change', (s.shards[0] - w1).toFixed(2));

console.log('== Hunger: a Popper with empty slots');
const popper = s.units.find((u) => u.owner === 0 && u.kind === 'grunt');
console.log('fresh popper state', unitState(s, popper), 'slices', s.ammo.slices[popper.id]);
s.ammo.slices[popper.id] = 0; s.ammo.rounds[popper.id] = 0; // probe setup: spend its slots
console.log('emptied: state', unitState(s, popper), 'canFire', canFire(s, popper), 'canMove', canMove(s, popper));
console.log('HUD stock', stockOf(s, 0));
let fixedAt = null;
for (let i = 0; i < 24 * 40; i++) { run(1); if (fixedAt === null && (s.ammo.slices[popper.id] ?? 0) > 0) fixedAt = i; }
console.log('resupplied after ticks', fixedAt, '(' + (fixedAt / 24).toFixed(1) + ' s) state', unitState(s, popper), 'slices', s.ammo.slices[popper.id], 'runs seen', observeAmmo(s, 0)?.runs?.length);

console.log('== Cord leash: send a Popper far away; how far does it get?');
const maxCord = POWER.cord;
console.log('POWER.cord', JSON.stringify(maxCord));
console.log('before the walk: popper', popper.id, 'at', popper.x, popper.y, 'power', JSON.stringify({ state: popper.power.state, anchor: popper.power.anchor, battery: popper.power.battery }), 'all-units power states', s.units.filter((u) => u.owner === 0).map((u) => u.kind + ':' + u.power.state).join(' '));
const target ={ x: popper.x + 80, y: popper.y - 80 };
run(1, [{ type: 'move', unit: popper.id, x: Math.max(1, Math.min(254, target.x)), y: Math.max(1, Math.min(254, target.y)) }]);
globalThis.__watch = popper.id; globalThis.__p = popper;
let maxD = 0, stateAtEnd = null;
const pts = () => (s.power.view?.points ?? []).filter((p) => p.owner === 0);
for (let i = 0; i < 24 * 90; i++) {
  run(1);
  const d = Math.min(...pts().map((p) => Math.hypot(p.x - popper.x, p.y - popper.y)));
  if (d > maxD) maxD = d;
  if (i % 120 === 0 || i < 5) console.log('  t+' + (i / 24).toFixed(1) + ' pos ' + popper.x + ',' + popper.y + ' d=' + d.toFixed(1) + ' st=' + popper.power.state + ' ord=' + (popper.order ? popper.order.type + '>' + popper.order.x + ',' + popper.order.y : 'none'));
}
console.log('popper ended at', popper.x, popper.y, 'max distance from nearest lit power point', maxD.toFixed(1), 'cord 12; power.state', popper.power?.state, 'unitState', unitState(s, popper), 'order', JSON.stringify(popper.order));
console.log('rejects overall', rej.length, rej.slice(0, 5));
