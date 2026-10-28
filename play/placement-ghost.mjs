// Placement ghost (PLAYABLE.md item 5). Owner: sonnet (Placement and build UX). Pure helpers plus one canvas drawer, no DOM.
//   While a building or station is armed, the tile under the cursor shows a blocky toy ghost: green when the sim would
//   take the order, red with a one-line reason when not. A Well also lights the water tiles it can draw from.
//   The verdict is play/input.mjs placeCheck (the sim's own rules: free tile, wheat, cord reach); this file adds the two
//   rules that need the map (Well near water, enemy fenced land) and turns reasons into plain sentences.
import { BAKERY } from '../env/bakery.mjs';
import { STATS } from '../env/stats.mjs';

const key = (x, y) => `${x},${y}`;
export const WELL_REACH = BAKERY.wellReach;
// Wells this close (square reach, like WELL_REACH) split one draw between them (WELLS-TECH-TERRAIN.md section 1).
export const CROWD_REACH = BAKERY.wellCrowdReach ?? 6;
const SECONDS = (ticks) => ticks / STATS.clock.ticksPerSecond;
export const CREEK_SECONDS = SECONDS(BAKERY.wellTicks); // one Water every 6 s by the creek or river
export const SPRING_SECONDS = SECONDS(BAKERY.wellTicks * BAKERY.springEvery); // by a map spring: every second beat, 12 s

/** Wells (any owner, standing or building) within CROWD_REACH of (x, y), not counting the one with id skipId. */
export function wellsNear(structures, x, y, { reach = CROWD_REACH, skipId = null } = {}) {
  let n = 0;
  for (const s of structures ?? []) {
    if (s.kind !== 'well' || (s.hp ?? 1) <= 0 || s.id === skipId) continue;
    if (Math.max(Math.abs(s.x - x), Math.abs(s.y - y)) <= reach) n++;
  }
  return n;
}

/** Where a Well at (x, y) would draw from: 'creek' (fast), 'spring' (slow), or 'dry'. A map with no water lets it stand as a creek Well (env/bakery.mjs waterAt). */
export function wellSource(ctx, x, y) {
  const hasWater = (ctx?.waterSet ?? tileSet(ctx?.water)).size > 0;
  const hasSprings = (ctx?.springs ?? []).length > 0;
  if (!hasWater && !hasSprings) return 'creek';
  const reach = waterInReach(ctx, x, y);
  if (!reach.length) return 'dry';
  return reach.some((w) => !w.spring) ? 'creek' : 'spring';
}

/** The ghost's rate line: what a Well placed here WILL draw, given the Wells already standing within reach. */
export function ghostRate(source, sharers = 0) {
  if (source === 'dry') return 'dry: no water in reach';
  const every = (source === 'spring' ? SPRING_SECONDS : CREEK_SECONDS) * (sharers + 1);
  return sharers ? `shared with ${sharers} Well${sharers === 1 ? '' : 's'}: 1 / ${every} s` : `1 Water / ${every} s`;
}

/** The selection panel's line for a built Well: its rate (every seconds per Water) and how many Wells share it. */
export function panelRate({ every, sharers = 0, dry = false }) {
  if (dry) return 'Dry: no water in reach';
  return sharers ? `Water 1 / ${every} s, shared with ${sharers}` : `Water 1 / ${every} s`;
}

/** A Set of "x,y" keys from an array of [x, y] pairs or an existing Set. */
export const tileSet = (tiles) => (tiles instanceof Set ? tiles : new Set((tiles ?? []).map(([x, y]) => key(x, y))));

/** Water tiles (and spring tiles) within the Well's reach of (x, y): [{ x, y, spring }]. */
export function waterInReach(ctx, x, y, reach = WELL_REACH) {
  const out = [];
  const water = ctx?.waterSet ?? tileSet(ctx?.water);
  for (let ty = y - reach; ty <= y + reach; ty++) for (let tx = x - reach; tx <= x + reach; tx++) if (water.has(key(tx, ty))) out.push({ x: tx, y: ty, spring: false });
  for (const [sx, sy] of ctx?.springs ?? []) if (Math.max(Math.abs(sx - x), Math.abs(sy - y)) <= reach) out.push({ x: sx, y: sy, spring: true });
  return out;
}

/**
 * The map rules the base check does not know. null when fine, else a reason key.
 *   ctx = { water: [[x, y]] | Set (or waterSet: Set), springs: [[x, y]], enemyFenced: Set of "x,y" }
 * A Well needs water in reach (a map with no water at all lets it stand anywhere, as in env/bakery.mjs waterAt).
 */
export function mapReason(ctx, kind, x, y) {
  if (!ctx) return null;
  if (ctx.enemyFenced && ctx.enemyFenced.has(key(x, y))) return 'enemy-fence';
  if (kind === 'well') {
    const any = (ctx.waterSet ?? tileSet(ctx.water)).size > 0 || (ctx.springs ?? []).length > 0;
    if (any && !waterInReach(ctx, x, y).length) return 'far-from-water';
  }
  return null;
}

/** One plain sentence for a refusal. `need` is the wheat cost of the kind. */
export function reasonText(reason, { need } = {}) {
  const r = String(reason ?? '');
  if (r.startsWith('not enough wheat')) return need > 0 ? `Not enough wheat (need ${need})` : 'Not enough wheat';
  if (r.startsWith('out of cord') || r === 'out-of-cord') return 'Out of power reach';
  if (r === 'far-from-water') return `A Well must be within ${WELL_REACH} tiles of water`;
  if (r === 'enemy-fence') return 'Too close to the enemy: that land is fenced';
  if (r === 'too-close-enemy') return `Too close to an enemy building: stay more than ${BAKERY.wellEnemyReach} tiles away`;
  if (r === 'needs-toaster') return 'Needs a Toaster first';
  if (r === 'needs-power') return 'Needs a Windmill or Dam first';
  if (r === 'unit in the way') return 'Blocked by a unit';
  if (r === 'off-map') return 'Off the map';
  if (r === 'blocked') return 'Blocked';
  return r ? r[0].toUpperCase() + r.slice(1) : 'Cannot build here';
}

/** What to draw under the cursor: { x, y, kind, ok, text, water: [tiles a Well can use] }. `chk` is placeCheck's { ok, reason }. */
export function ghostFor(chk, kind, x, y, { need = 0, label = kind, ctx = null, structures = ctx?.structures } = {}) {
  const well = kind === 'well';
  const source = well ? wellSource(ctx, x, y) : null;
  const sharers = well ? wellsNear(structures, x, y) : 0;
  const cost = need > 0 ? ` (${need})` : '';
  let text;
  if (well && source === 'dry' && (chk.ok || chk.reason === 'far-from-water')) text = ghostRate('dry');
  else if (!chk.ok) text = reasonText(chk.reason, { need });
  else text = well ? `${label}${cost} · ${ghostRate(source, sharers)}` : `${label}${cost}`;
  return {
    x, y, kind, ok: !!chk.ok && source !== 'dry', text,
    water: well ? waterInReach(ctx, x, y) : [],
    ring: well ? { x, y, r: CROWD_REACH } : null,
  };
}

const HEIGHT = { mill: 0.9, well: 0.55, toaster: 0.7, extension: 0.45, pylon: 1.4, assembly: 0.8, heatlamp: 1.1 };

/**
 * Draw the ghost on the 2D overlay: the water in range as blue tiles, then a blocky box on the tile (top, left and right
 * faces), green or red, and the reason under it. project(x, y, z) -> { sx, sy }; tp = pixels per tile.
 */
export function drawGhost(ov, project, ghost, tp = 40) {
  const fill = ghost.ok ? [60, 255, 110] : [255, 60, 60];
  const rgba = (a, k = 1) => `rgba(${fill.map((c) => Math.round(c * k)).join(',')},${a})`;
  const quad = (pts, f, s) => {
    ov.beginPath(); pts.forEach((p, i) => (i ? ov.lineTo(p.sx, p.sy) : ov.moveTo(p.sx, p.sy))); ov.closePath();
    ov.fillStyle = f; ov.fill(); ov.strokeStyle = s; ov.lineWidth = 2; ov.stroke();
  };
  for (const w of ghost.water) {
    const c = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([dx, dy]) => project(w.x + dx, w.y + dy, 0.02));
    quad(c, w.spring ? 'rgba(120,220,255,.45)' : 'rgba(80,170,255,.4)', 'rgba(150,215,255,.9)');
  }
  if (ghost.ring) {
    // The crowding reach is a square of tiles (the same reach wellsNear counts), drawn faint on the ground.
    const { x, y, r } = ghost.ring;
    const corners = [[-r, -r], [r, -r], [r, r], [-r, r]].map(([dx, dy]) => project(x + dx, y + dy, 0.03));
    ov.beginPath(); corners.forEach((p, i) => (i ? ov.lineTo(p.sx, p.sy) : ov.moveTo(p.sx, p.sy)));
    ov.closePath(); ov.strokeStyle = 'rgba(255,255,255,.22)'; ov.lineWidth = 1; ov.stroke();
  }
  const h = HEIGHT[ghost.kind] ?? 0.7, m = 0.42;
  const P = (dx, dy, z) => project(ghost.x + dx, ghost.y + dy, z);
  const base = [P(-m, -m, 0.02), P(m, -m, 0.02), P(m, m, 0.02), P(-m, m, 0.02)];
  const top = [P(-m, -m, h), P(m, -m, h), P(m, m, h), P(-m, m, h)];
  quad([base[3], base[2], top[2], top[3]], rgba(0.35, 0.6), rgba(0.9));
  quad([base[2], base[1], top[1], top[2]], rgba(0.35, 0.8), rgba(0.9));
  quad(top, rgba(0.5), rgba(1));
  const at = project(ghost.x, ghost.y, 0);
  ov.font = '600 12px system-ui'; ov.textAlign = 'center';
  const w = ov.measureText ? ov.measureText(ghost.text).width + 12 : ghost.text.length * 7 + 12;
  ov.fillStyle = 'rgba(0,0,0,.65)'; ov.fillRect(at.sx - w / 2, at.sy + 0.55 * tp, w, 18);
  ov.fillStyle = ghost.ok ? '#fff' : '#ffb0a8'; ov.fillText(ghost.text, at.sx, at.sy + 0.55 * tp + 13);
  ov.textAlign = 'left';
}
