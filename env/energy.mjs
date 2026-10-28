// Energy: the power that Toaster Wars buildings and fences spend (PLAYABLE.md items 20 and 21). Owner: sonnet.
//
// Windmills (on high-ground pads) and Dams (on river dam sites) MAKE energy; the Power Strip makes a little, so a base can
// never be left with nothing (no softlock). Each finished Toaster USES energy and so does each live fence (1 per 8 tiles,
// POWER-NETWORK.md section 11). Every connected network does its own sums: when it uses more than it makes it browns out
// its lowest-priority loads first: fences, then Toasters (newest first).
//
// Opt-in: nothing runs unless state.energy exists (enableEnergy; play/toaster-play.mjs turns it on). Pure, deterministic,
// no Node-only globals (this file runs in the browser). Hooks: env/power.mjs (sites, cost, lit, shed fences are passable),
// env/bakery.mjs (a shed Toaster is unpowered), env/sim-territory.mjs (stepEnergy right after stepPower).

import { distance } from './state.mjs';
import { buildLines, liveGroundLines, supercover } from './power.mjs';
import { LADDER_SITES } from '../maps/layout-ladder.mjs';

export const ENERGY = Object.freeze({
  make: Object.freeze({ strip: 2, generator: 2, windmill: 3, dam: 6, milldam: 14 }), // a Generator lights its network AND makes a little
  use: Object.freeze({ toaster: 2 }),
  fenceTiles: 8, // 1 energy per this many fence tiles, rounded up
  cost: Object.freeze({ windmill: 40, dam: 90, milldam: 160 }),
});

const mirror = ([x, y]) => [255 - x, 255 - y];
// Wheatfield Valley (256 x 256). Windmill pads: high ground, four per side. Dam sites: one on each creek bank, and the Mill Dam.
const PADS_SIDE0 = [[30, 224], [26, 214], [40, 236], [58, 210]];
const DAMS_SIDE0 = [[88, 85]];
export const WHEATFIELD_SITES = Object.freeze([
  ...PADS_SIDE0.map(([x, y]) => ({ kind: 'windmill', x, y })),
  ...PADS_SIDE0.map(mirror).map(([x, y]) => ({ kind: 'windmill', x, y })),
  ...DAMS_SIDE0.map(([x, y]) => ({ kind: 'dam', x, y })),
  ...DAMS_SIDE0.map(mirror).map(([x, y]) => ({ kind: 'dam', x, y })),
  { kind: 'milldam', x: 131, y: 127 },
]);

const blank = () => ({ made: 0, used: 0, shed: 0 });

/** Turn the energy rules on. sites defaults to the Wheatfield list on a 256-wide map; other maps get none. */
export function enableEnergy(state, sites, opts = {}) {
  state.energy = {
    free: new Set(opts.free || []), // sides that never brown out (the bots, until they learn Windmills)
    sites: sites ?? (state.width === 256 ? WHEATFIELD_SITES.map((s) => ({ ...s })) : state.width === 132 && state.height === 148 ? LADDER_SITES.map(s => ({ ...s })) : []),
    cost: ENERGY.cost, make: ENERGY.make,
    shedFences: new Set(), shedToasters: new Set(), shedSig: '', report: [blank(), blank()],
  };
  return state.energy;
}

/** The site at exactly (x, y) that accepts this build kind, or null. Kind 'dam' also accepts the Mill Dam site. */
export function siteAt(state, kind, x, y) {
  const E = state.energy;
  if (!E) return null;
  return E.sites.find((s) => s.x === x && s.y === y && (s.kind === kind || (kind === 'dam' && s.kind === 'milldam'))) ?? null;
}

/** What a site costs and makes: { kind, cost, make } (kind 'milldam' for the big one). */
export const siteSpec = (site) => ({ kind: site.kind, cost: ENERGY.cost[site.kind], make: ENERGY.make[site.kind] });

const makeOf = (p) => (p.kind === 'strip' || p.kind === 'generator' ? ENERGY.make[p.kind] : (p.make ?? 0));
const fenceCost = (tiles) => Math.ceil(tiles / ENERGY.fenceTiles);

/**
 * This tick's sums, per connected network. Needs state.power.view (stepPower refreshes it). Fills
 * state.energy.report[side] = { made, used, shed } and the shed sets that the bakery and the fence code read.
 */
export function stepEnergy(state) {
  const E = state.energy, view = state.power && state.power.view;
  if (!E || !view) return;
  const nets = new Map(); // net object -> { owner, made, toasters: [ids], fences: [{ key, cost }] }
  const slot = (net) => {
    if (!nets.has(net)) nets.set(net, { owner: net.owner, made: 0, toasters: [], fences: [] });
    return nets.get(net);
  };
  for (const p of view.points) {
    const net = view.netOf.get(p.id);
    if (net) slot(net).made += makeOf(p);
  }
  for (const s of state.structures) {
    if (s.kind !== 'toaster' || !s.complete || s.hp <= 0) continue;
    const cover = view.points.find((p) => p.owner === s.owner && distance(p, s) <= Math.max(p.range, 1));
    const net = cover && view.netOf.get(cover.id);
    if (net) slot(net).toasters.push(s.id);
  }
  const P = state.power;
  if (P.fences && P.fenceLinks && P.fenceLinks.size > 0) {
    // All fences that stand if power were enough; the ones we shed this tick are passable but still counted here, so a
    // restored network brings them back by itself.
    for (const l of liveGroundLines(buildLines(state), state, true)) {
      const net = view.netOf.get(l.a.id);
      if (net) slot(net).fences.push({ key: `${l.a.id}-${l.b.id}`, cost: fenceCost(supercover(l.a, l.b).length) });
    }
  }
  const report = [blank(), blank()];
  const shedFences = new Set(), shedToasters = new Set();
  for (const n of [...nets.values()].sort((a, b) => a.owner - b.owner)) {
    let used = n.toasters.length * ENERGY.use.toaster + n.fences.reduce((t, f) => t + f.cost, 0);
    const r = report[n.owner];
    r.made += n.made;
    r.used += used;
    if (E.free.has(n.owner)) continue;
    const fences = [...n.fences].sort((a, b) => (a.key < b.key ? -1 : 1)); // last key goes dark first
    while (used > n.made && fences.length) { const f = fences.pop(); used -= f.cost; shedFences.add(f.key); r.shed += 1; }
    const toasters = [...n.toasters].sort((a, b) => a - b); // newest (highest id) goes dark first
    while (used > n.made && toasters.length) { const id = toasters.pop(); used -= ENERGY.use.toaster; shedToasters.add(id); r.shed += 1; }
  }
  E.shedFences = shedFences;
  E.shedToasters = shedToasters;
  E.shedSig = [...shedFences].sort().join(',') + '|' + [...shedToasters].sort((a, b) => a - b).join(',');
  E.report = report;
}

/** One side's Power numbers for the HUD: { made, used, shed }. */
export function powerOf(state, side) {
  const r = state.energy && state.energy.report[side];
  return r ? { made: r.made, used: r.used, shed: r.shed } : blank();
}
