// Toaster Wars minimap marks (PLAYABLE.md item 28): windmill pads, the Mill Dam site, your power network as team-colour
// lines, and attack pings. Pure helpers plus a 2d-canvas drawer, so a node test can drive it with a stub context. The land
// itself (gold wheat, navy water) is the base image from play/wheatfield-terrain.mjs; this only adds the marks on top.

export const KITCHEN_MAP = Object.freeze({ pad: '#8ea3ae', padRing: '#e6f3f7', dam: '#e6f3f7', damBar: '#1b3b57', line: '#4aa8ff', dot: '#4aa8ff', foe: '#ff8a3d', ping: '#ff3b3b' });
export const PING_TICKS = 60; // how long an attack ping stays on the minimap, in sim ticks

/** Windmill pads and the Mill Dam site from a Wheatfield map (generateMap(seed, { map: 'wheatfield' })). */
export function kitchenSites(map) {
  const pads = (map?.sockets ?? []).map(([x, y]) => ({ x, y }));
  const gap = map?.extras?.dam?.gap ?? [];
  if (!gap.length) return { pads, dam: null };
  const sum = gap.reduce((a, [x, y]) => ({ x: a.x + x, y: a.y + y }), { x: 0, y: 0 });
  return { pads, dam: { x: sum.x / gap.length, y: sum.y / gap.length, tiles: gap.map(([x, y]) => ({ x, y })) } };
}

/**
 * The network lines of one side: every pair of its power points within the larger of their two ranges (the rule in
 * env/power.mjs). Enemy points and lines are never drawn, so the minimap shows only what you can see of your own grid.
 */
export function networkLines(points, side) {
  const own = (points ?? []).filter((p) => p.owner === side);
  const lines = [];
  for (let i = 0; i < own.length; i++) for (let j = i + 1; j < own.length; j++) {
    const a = own[i], b = own[j];
    const reach = Math.max(a.range ?? 0, b.range ?? 0);
    if (Math.hypot(a.x - b.x, a.y - b.y) <= reach) lines.push([a, b]);
  }
  return { points: own, lines };
}

/**
 * Attack pings: a ping is added at the tile where one of your units or buildings loses hp. Give it the previous snapshot's
 * hp by id; the first call only records. Returns the live pings, the ones younger than PING_TICKS.
 */
export function createPings() {
  let hp = null;
  let live = [];
  return {
    update(snap, side, tick) {
      const now = new Map();
      const hit = [];
      for (const e of [...(snap.units ?? []), ...(snap.structures ?? [])]) {
        if (e.owner !== side) continue;
        now.set(e.id, e.hp);
        const before = hp?.get(e.id);
        if (before !== undefined && e.hp < before) hit.push({ x: e.x, y: e.y, tick });
      }
      hp = now;
      live = [...live, ...hit].filter((p) => tick - p.tick < PING_TICKS);
      return live;
    },
    live: () => live,
  };
}

/**
 * Draw the marks on the minimap canvas. snap: { width, height, units, structures, power: { view: { points } } }; sites from
 * kitchenSites(); pings from createPings().update(). sx, sy are minimap pixels per tile; tick is the sim tick (for the ping ring).
 */
export function drawKitchenMinimap(ctx, { snap, side, sites, pings = [], tick = 0, sx, sy }) {
  const cx = (x) => (x + 0.5) * sx, cy = (y) => (y + 0.5) * sy;
  const r = Math.max(1.5, Math.min(sx, sy) * 0.6);
  // Windmill pads: a pale ring with a dot in it.
  for (const p of sites?.pads ?? []) {
    ctx.strokeStyle = KITCHEN_MAP.padRing; ctx.lineWidth = 1; ctx.beginPath();
    ctx.arc(cx(p.x), cy(p.y), r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = KITCHEN_MAP.pad; ctx.fillRect(cx(p.x) - 0.5, cy(p.y) - 0.5, 1, 1);
  }
  // The Mill Dam site: a pale bar across the gap, dark outline so it reads on the navy water.
  if (sites?.dam) {
    const d = sites.dam;
    ctx.fillStyle = KITCHEN_MAP.damBar;
    for (const t of sites.dam.tiles) ctx.fillRect(cx(t.x) - sx / 2 - 0.5, cy(t.y) - sy / 2 - 0.5, sx + 1, sy + 1);
    ctx.fillStyle = KITCHEN_MAP.dam; ctx.fillRect(cx(d.x) - 1, cy(d.y) - 1, 2, 2);
  }
  // Your power network: team-colour lines between linked points, a dot on each point.
  const net = networkLines(snap?.power?.view?.points ?? snap?.power?.points ?? [], side);
  ctx.strokeStyle = KITCHEN_MAP.line; ctx.lineWidth = 1; ctx.beginPath();
  for (const [a, b] of net.lines) { ctx.moveTo(cx(a.x), cy(a.y)); ctx.lineTo(cx(b.x), cy(b.y)); }
  ctx.stroke();
  ctx.fillStyle = KITCHEN_MAP.dot;
  for (const p of net.points) ctx.fillRect(cx(p.x) - 1, cy(p.y) - 1, 2, 2);
  // Attack pings: a ring that grows and fades over PING_TICKS.
  for (const p of pings) {
    const age = Math.max(0, tick - p.tick) / PING_TICKS;
    ctx.strokeStyle = KITCHEN_MAP.ping; ctx.lineWidth = 1;
    ctx.globalAlpha = 1 - age; ctx.beginPath();
    ctx.arc(cx(p.x), cy(p.y), 2 + age * 8, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
