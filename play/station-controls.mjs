// Player controls for Power Stations (Joshua 10-23 09:29). Owner: sonnet (Playable Client). Pure helpers, no DOM.
//   The Crumb card gets Extension Box (X, 30 wheat) and Relay Pylon (V, 60 wheat).
//   Click an empty spot near a station to select it (shift adds); with two stations selected, F sets or clears the fence
//   on the link between them (a Power Strip that is selected counts as a station).
import { POWER, lineKey } from '../env/power.mjs';
import { ENERGY, WHEATFIELD_SITES, siteAt } from '../env/energy.mjs';

export const STATION_KINDS = Object.freeze(['extension', 'pylon', 'windmill', 'dam']);
export const STATION_KEYS = Object.freeze({ extension: 'x', pylon: 'v', windmill: 'n', dam: 'd' });
export const isStationKind = (kind) => STATION_KINDS.includes(kind);
// The price is the site's when a site is given (the Mill Dam costs more than a Dam), else the kind's plain price.
export const stationCost = (kind, site = null) => (site ? ENERGY.cost[site.kind] : (ENERGY.cost[kind] ?? POWER.cost[kind]));
// The energy site a Windmill or Dam lands on. The view does not carry the sites, so the Wheatfield layout stands in
// for them (the sim charges state.energy's site price, the same table).
const siteOn = (snap, kind, x, y) => siteAt({ energy: { sites: snap.energy?.sites ?? WHEATFIELD_SITES } }, kind, x, y);
const PICKABLE = new Set(['strip', 'outlet', 'extension', 'pylon', 'windmill', 'dam']);

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Card entries for the Crumb: { key, label, kind, action: 'build', cost }. */
export const stationCardEntries = () => STATION_KINDS.map((kind) => ({ key: STATION_KEYS[kind], label: kind, kind, action: 'build', cost: stationCost(kind) }));

/** Your power points in a snapshot (snap.power.view.points, or snap.power.points). */
const pointsOf = (snap) => snap?.power?.view?.points ?? snap?.power?.points ?? [];

/** The id of your station nearest (x, y) within `radius` tiles, or null. Enemy stations are not selectable. */
export function pickStation(snap, side, x, y, radius = 1.2) {
  let best = null, bd = Infinity;
  for (const p of pointsOf(snap)) {
    if (p.owner !== side || !PICKABLE.has(p.kind)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d <= radius && d < bd) { best = p; bd = d; }
  }
  return best ? best.id : null;
}

/** Can a station of `kind` go on (x, y)? Mirrors the sim: wheat, a free tile and a power point in cord reach. */
export function stationPlaceCheck(snap, side, kind, x, y) {
  if (!isStationKind(kind)) return { ok: false, reason: 'not a station' };
  if (snap.shards[side] < stationCost(kind, siteOn(snap, kind, x, y))) return { ok: false, reason: 'not enough wheat' };
  const range = POWER.range[kind];
  const linked = pointsOf(snap).some((p) => p.owner === side
    && cheb(p, { x, y }) <= (p.kind === 'pylon' && kind === 'pylon' ? POWER.pylonLink : Math.max(p.range ?? 0, range)));
  if (!linked) return { ok: false, reason: 'out of cord reach: build next to a powered station' };
  return { ok: true, reason: null };
}

/**
 * The fence order for two selected station ids: { cmd, text } or { error }. A link already fenced is cleared (toggle).
 * snap.power.fenceLinks lists the fenced lineKeys.
 */
export function fenceOrder(snap, ids) {
  const uniq = [...new Set(ids)];
  if (uniq.length !== 2) return { error: 'Select two stations (click one, shift-click the other), then press F.' };
  const [a, b] = uniq;
  const on = !(snap?.power?.fenceLinks ?? []).includes(lineKey(a, b));
  return { cmd: { type: 'set-fence', a, b, on }, text: on ? 'Fence on: enemies cannot cross the glowing rail.' : 'Fence off.' };
}

const REJECT_TEXT = Object.freeze({
  'place-power': {
    'no-shards': 'Not enough wheat for that station.', 'out-of-cord': 'Too far from your power: build next to a station.',
    'bad-target': 'Something is in the way there.', 'too-far': 'Your Crumb must stand next to it.', unplugged: 'That Crumb is cut off from power.',
    'enemy-fence': 'That land is fenced by the enemy.',
    'not-a-site': 'Windmills go on the high-ground pads, Dams on the river dam sites.',
  },
  'set-fence': {
    'no-such-link': 'Those two stations are not linked. Build one within reach of the other.', 'high-line': 'Pylon lines are overhead: they never block.',
    'crosses-enemy-fence': 'A fence cannot cross an enemy fence.', 'cuts-off-enemy': 'A fence may not seal the enemy off completely.',
    'not-yours': 'That link is not yours.', 'no-power': 'Fences are off in this match.',
  },
});
/** A plain sentence for a sim 'reject' event about a station command, or null for other rejects. */
export function rejectText(ev) {
  const t = ev?.command?.type;
  if (ev?.e !== 'reject' || !REJECT_TEXT[t]) return null;
  return REJECT_TEXT[t][ev.reason] ?? `Cannot do that (${ev.reason}).`;
}
