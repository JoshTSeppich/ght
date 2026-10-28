// Toaster-hard: toaster-sonnet's cord-aware planner (copied whole, because the referee sandbox reads only the player's own
// file) with five personalities picked by createPlayer({ personality }): rush, expand, tech, turtle, brutal (table
// PERSONALITIES below). Without an explicit personality, createPlayer({ difficulty }) maps 'brutal' to the brutal
// personality and everything else (including 'hard') to tech, so /play's Hard and Brutal difficulty settings differ.
// A personality sets the opening, the build list, the unit mix (every unit of every open tier), when the push starts and how
// big the army must be. Default personality is 'tech'. Same Player API as toaster-sonnet, plus scout() for tests.
// Scouting (one Crumb at 1:30), raiding (Zappers and Bagels hunt Crumbs from 1:30), research (env/research.mjs, ground
// tracks through the Assembly Line, air tracks through the Cooling Rack) and the air layer (Cooling Rack + the three
// flyers, env/air.mjs) run the same for every personality; no clock or randomness.
// Original header of the planner follows.
// Toaster-sonnet v2: a bot that plays the Toaster Wars rules, cord-bending included. Crumbs mine wheat, it builds the kitchen
// (Mill, Well, Toaster) so its fighters have toast, an Assembly Line for Poppers and Zappers, and walks a chain of Extension
// Boxes toward the enemy Power Strip (a cord reaches only so far, TERRITORY.md section 20). The army follows the chain and
// sieges once the last box is in range. Player API only (plus the pure cord-wrap helpers); no clock or randomness, so
// matches replay exactly.
//
// Wrap-aware: a cord bends round rocks and every bend costs length (max 3 bends). So each next box is planned by walking the
// lane tile by tile on a simulated cord (env/cord-wrap.mjs, the same function the sim uses) and stops where the cord would
// run out. A box at that corner pegs the cord and the next stretch starts fresh.
// Never re-issues a refused order: the sim leaves the reason in obs.power.refused; the bot backs off that order for a while,
// retreats toward its nearest station (always legal) or, for the chain Crumb, plugs a box where it stands and re-plans.
// env/cord-wrap.mjs inlined: the referee sandbox lets a player read ONLY its own file, so importing ../../env
// made every toaster-sonnet match a tick-0 double forfeit (reason 'load'). Keep in sync with env/cord-wrap.mjs.
// ---- begin inlined env/cord-wrap.mjs ----
const { cordMove, newCord } = (() => {
// Cord wrap-point list (POWER-NETWORK.md section 4, build step 3). Owner: sonnet. Pure and deterministic.
//
// A unit's cord is a list of points: the anchor (its station), then the corners it bends around, then the unit (the
// "tip", not stored). Corners are tile corners (half-tile coordinates), so they are exact in floating point.
//   wrap:   when the straight line from the last point to the tip would cut through a blocked tile, bend the cord round
//           the nearest usable corner of the tile it hits, and repeat until every segment is clear;
//   unwrap: when the tip swings back across a corner (the cross product of the segment into the corner and the segment
//           out of it flips sign), that corner is dropped; a final pull drops any corner the cord no longer needs;
//   length: the sum of the segment lengths (Chebyshev, like every other distance here, so a straight cord costs exactly
//           what the plain cord leash costs). Moves stop when the length would exceed the cord.
// blocked(x, y) says which tiles the cord cannot pass through (cliffs, rocks, water, enemy walls).

const EPS = 1e-9;
const MAX_BENDS = 3; // POWER-NETWORK.md section 11: at most 3 wrap points per cord
const cross = (a, b, c) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const euclid = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** A taut cord with no bends, anchored at (x, y). */
const newCord = (anchor) => ({ pts: [{ x: anchor.x, y: anchor.y, side: 0 }] });

// The first blocked tile the open segment p to q passes through, as { x, y, t }, or null. Touching only a tile's edge or
// corner does not count, so the cord can hug a cliff corner.
function segmentBlockedBy(p, q, blocked) {
  const x0 = Math.round(Math.min(p.x, q.x)) - 1, x1 = Math.round(Math.max(p.x, q.x)) + 1;
  const y0 = Math.round(Math.min(p.y, q.y)) - 1, y1 = Math.round(Math.max(p.y, q.y)) + 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  let best = null;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!blocked(x, y)) continue;
      let t0 = 0, t1 = 1, hit = true;
      for (const [o, d, c] of [[p.x, dx, x], [p.y, dy, y]]) {
        const lo = c - 0.5, hi = c + 0.5;
        if (Math.abs(d) < EPS) {
          if (!(o > lo + EPS && o < hi - EPS)) { hit = false; break; }
        } else {
          let a = (lo - o) / d, b = (hi - o) / d;
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a);
          t1 = Math.min(t1, b);
        }
      }
      if (hit && t1 - t0 > EPS && (!best || t0 < best.t - EPS)) best = { x, y, t: t0 };
    }
  }
  return best;
}

// The corner the cord should bend round for the blocked segment a to b. The obstacle is the connected cluster of blocked
// tiles around the tile hit; on each side of the segment take its farthest corner that touches free space (skipping
// corners the cord already holds), then keep the side with the shorter detour. Concave clusters just take another pass.
function bendCorner(a, b, hit, blocked, held) {
  const seen = new Set([hit.x + ',' + hit.y]);
  const queue = [[hit.x, hit.y]];
  for (let i = 0; i < queue.length && queue.length < 400; i++) {
    const [x, y] = queue[i];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const k = (x + dx) + ',' + (y + dy);
        if ((dx || dy) && !seen.has(k) && blocked(x + dx, y + dy)) { seen.add(k); queue.push([x + dx, y + dy]); }
      }
    }
  }
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const best = { '-1': null, 1: null };
  for (const [x, y] of queue) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (blocked(x, y + sy) && blocked(x + sx, y) && blocked(x + sx, y + sy)) continue; // inside the cluster
      const c = { x: x + sx * 0.5, y: y + sy * 0.5 };
      if (held.some((p) => p.x === c.x && p.y === c.y)) continue;
      const d = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / len;
      if (Math.abs(d) < EPS) continue;
      const side = Math.sign(d);
      const cur = best[side];
      if (!cur || Math.abs(d) > Math.abs(cur.d) + EPS || (Math.abs(d) > Math.abs(cur.d) - EPS && (c.y < cur.c.y || (c.y === cur.c.y && c.x < cur.c.x)))) best[side] = { c, d };
    }
  }
  let pick = null;
  for (const side of [1, -1]) {
    const o = best[side];
    if (!o) continue;
    const detour = euclid(a, o.c) + euclid(o.c, b);
    if (!pick || detour < pick.detour - EPS) pick = { c: o.c, detour };
  }
  return pick && pick.c;
}

const withTip = (pts, tip) => [...pts, tip];
const sides = (pts, tip) => {
  const all = withTip(pts, tip);
  for (let i = 1; i < pts.length; i++) pts[i].side = Math.sign(cross(all[i - 1], all[i], all[i + 1]));
};

// Drop every corner whose neighbours already see each other (a taut cord keeps only the corners it needs).
function pull(pts, tip, blocked) {
  for (let i = pts.length - 1; i >= 1; i--) {
    const next = i + 1 < pts.length ? pts[i + 1] : tip;
    if (!segmentBlockedBy(pts[i - 1], next, blocked)) pts.splice(i, 1);
  }
}

/** The cord after the tip moved to `tip`. Returns a new cord; the old one is untouched. */
function updateCord(cord, tip, blocked) {
  const pts = cord.pts.map((p) => ({ ...p }));
  // Unwrap: the tip swung back across the last corner.
  while (pts.length > 1) {
    const k = pts.length - 1;
    if (Math.sign(cross(pts[k - 1], pts[k], tip)) === -pts[k].side) pts.pop();
    else break;
  }
  pull(pts, tip, blocked);
  // Wrap: bend round corners until every segment is clear.
  let tangled = false;
  for (let guard = 0; guard < 24; guard++) {
    const all = withTip(pts, tip);
    let at = -1, hit = null;
    for (let i = 0; i + 1 < all.length && !hit; i++) {
      hit = segmentBlockedBy(all[i], all[i + 1], blocked);
      at = i;
    }
    if (!hit) break;
    if (pts.length > MAX_BENDS) { tangled = true; break; } // more than 3 wrap points: too tangled to route
    const c = bendCorner(all[at], all[at + 1], hit, blocked, all);
    if (!c) { tangled = true; break; } // nothing new to bend round
    pts.splice(at + 1, 0, { x: c.x, y: c.y, side: 0 });
  }
  pull(pts, tip, blocked);
  sides(pts, tip);
  return tangled ? { pts, tangled: true } : { pts };
}

/** Length used: the sum of the segments from the anchor through every corner to the tip. */
function cordUsed(cord, tip) {
  let total = 0;
  const all = withTip(cord.pts, tip);
  for (let i = 0; i + 1 < all.length; i++) total += dist(all[i], all[i + 1]);
  return total;
}

/**
 * Try to move the tip to `tip`. { ok: true, cord, used } when the new cord fits in maxLen; otherwise
 * { ok: false, cord: <the old cord, unchanged>, used } and the unit's move must stop.
 */
function cordMove(cord, tip, blocked, maxLen) {
  const next = updateCord(cord, tip, blocked);
  const used = cordUsed(next, tip);
  return !next.tangled && used <= maxLen ? { ok: true, cord: next, used } : { ok: false, cord, used };
}

/** Re-anchor the cord at a peg: a rock or Extension Box on tile `peg` that one of the corners touches. Null if none. */
function pegAt(cord, peg) {
  for (let k = 1; k < cord.pts.length; k++) {
    const p = cord.pts[k];
    if (Math.abs(Math.abs(p.x - peg.x) - 0.5) < EPS && Math.abs(Math.abs(p.y - peg.y) - 0.5) < EPS) {
      return { pts: cord.pts.slice(k).map((q, i) => ({ ...q, side: i === 0 ? 0 : q.side })) };
    }
  }
  return null;
}

return { cordMove, newCord };
})();
// ---- end inlined env/cord-wrap.mjs ----


const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const MIN = 24 * 60;
// Until pushTick the chain stops at `hold` of the lane and the armies skirmish in the middle; then the chain and the siege go on.
// mix: unit kind -> weight; each Assembly Line trains the open kind furthest below its share. Tier 3 kinds (brute, howler, dart)
// open with the first Windmill; every personality lists them, so every unit of every open tier is used.
const PERSONALITIES = {
  rush: { reserve: 200, pushTick: 4 * MIN, hold: 0.8, minArmy: 6, workers: 8, toasters: 2, turrets: 0, chainNeedsForge: false, capBase: 10, capPush: 14, capArrived: 18,
    build: ['mill', 'well', 'toaster', 'forge', 'forge', 'mill', 'toaster', 'well', 'forge', 'toaster', 'mill', 'well', 'toaster'],
    mix: { grunt: 3, lancer: 3, dart: 2, spiker: 1, howler: 1, brute: 1 } },
  expand: { reserve: 120, pushTick: 7 * MIN, hold: 0.6, minArmy: 10, workers: 14, toasters: 4, turrets: 0, chainNeedsForge: false, capBase: 8, capPush: 14, capArrived: 18,
    build: ['mill', 'well', 'toaster', 'mill', 'forge', 'toaster', 'well', 'forge', 'toaster', 'mill', 'well', 'toaster', 'mill'],
    mix: { grunt: 3, lancer: 3, spiker: 1, howler: 2, brute: 1, dart: 1 } },
  tech: { reserve: 80, pushTick: 9 * MIN, hold: 0.5, minArmy: 12, workers: 10, toasters: 4, turrets: 0, chainNeedsForge: false, capBase: 8, capPush: 14, capArrived: 16,
    build: ['mill', 'well', 'toaster', 'forge', 'mill', 'toaster', 'well', 'forge', 'toaster', 'mill', 'well', 'toaster', 'mill'],
    mix: { grunt: 2, lancer: 2, spiker: 1, howler: 3, brute: 3, dart: 1 } },
  turtle: { reserve: 60, pushTick: 12 * MIN, hold: 0.4, minArmy: 16, workers: 12, toasters: 4, turrets: 3, chainNeedsForge: true, capBase: 12, capPush: 18, capArrived: 22,
    build: ['mill', 'well', 'toaster', 'forge', 'turret', 'mill', 'toaster', 'turret', 'well', 'forge', 'turret', 'toaster', 'mill', 'well', 'toaster'],
    mix: { grunt: 3, lancer: 2, spiker: 2, howler: 2, brute: 2, dart: 1 } },
};
const TIER3 = new Set(['brute', 'howler', 'dart']);
const CORD = 12; // POWER.cord for Crumbs, Poppers and Zappers
const HOP = 10; // box spacing at most (a box links within 12)
const STEP = 4; // lane tiles per move order, so a walking unit follows the lane the cord was planned on
const SIEGE = 6; // a last box this close lets Poppers (range 4, cord 12) walk up and reach the enemy Strip without bending past the cord
const PLUG_COOL = 24 * 6; // a plug that failed is not retried for 6 s
const BACKOFF = 24 * 8; // a refused order is not tried again for 8 s
const FIELD_REACH = 11; // wheat this close to a station can be mined and hauled home inside the cord
const SIGHT = 6; // tiles a unit or Strip sees (env/vision.mjs DEFAULT_SIGHT, one number here)
const SCOUT_TICK = 24 * 90; // 1:30: one Crumb walks out to the chain tip to watch the lane
const SCOUT_STAY = 24 * 30; // ... and goes back to mining after 30 s
const RAID_TICK = SCOUT_TICK; // from 1:30 Zappers and Bagels hunt Crumbs that come into the corridor
const RAID_REACH = 12; // a raider looks this far for a Crumb (one cord length)
// Research (M3, env/research.mjs): the 'research' command is idempotent-safe to repeat (already-done/already-queued
// cost nothing), so the plan is just tried in order on a cooldown; no feedback from obs is needed. Ground tracks first
// (every match reaches a Forge), air tracks once a Cooling Rack stands.
const RESEARCH_COOLDOWN = 24 * 20; // don't resend the same research more than once every 20 s
const GROUND_RESEARCH = ['ground-weapons-1', 'ground-armor-1', 'ground-weapons-2', 'ground-armor-2', 'structure-armor-1', 'ground-weapons-3', 'ground-armor-3'];
const AIR_RESEARCH = ['air-weapons-1', 'air-armor-1', 'air-weapons-2', 'air-armor-2'];
// Air layer (M4, env/air.mjs): the Cooling Rack opens at tier 3, same gate as Four-Slice/Broiler/Bagel. Flyers ignore the
// cord entirely but are only resupplied standing beside a Toaster or the Cooling Rack, so every flyer spends part of a
// fixed duty cycle back home instead of hunting, a time-based stand-in for ammo feedback obs does not give a bot.
const AIR_MIX = { croutonKite: 1, waffleWing: 2, crumpetBomber: 2 };
const AIR_CAP = 6; // a small supplementary air force, on top of the ground army cap
const AIR_CYCLE = 24 * 40; // 40 s out hunting, 10 s home topping up slices
const AIR_HOME = 24 * 10;
const AIR_HOME_REACH = 3; // close enough to a Toaster/Cooling Rack to resupply

export { PERSONALITIES };

export function createPlayer({ side, stats, personality, difficulty }) {
  const name = personality || 'tech';
  const P = PERSONALITIES[name] || PERSONALITIES.tech;
  const PUSH_TICK = P.pushTick;
  const HOLD_FRAC = P.hold;
  const U = stats.units;
  const S = stats.structures;
  let lastBuild = 0;
  let chainWorker = null, windWorker = null; // windWorker: the Crumb raising Windmills (it mines nothing meanwhile)
  const PADS = [[30, 224], [26, 214], [40, 236], [58, 210]]; // Windmill pads of the side-0 corner (env/energy.mjs); the other side mirrors them
  const windBoxes = new Set(); // Extension Boxes that only carry a Windmill: not part of the siege chain
  const WANT_TOASTERS = P.toasters; // Windmills built so this many Toasters run: 2 energy from the Strip + 3 per Windmill against 2 per Toaster
  let lane = null; // walkable path from our Strip to the enemy Strip (the creek and cliffs force detours)
  let laneTick = -1e9;
  const bans = new Map(); // unit id -> { until, x, y, target } for the last refused order
  const seenRefusal = new Map(); // unit id -> tick of the last refusal already handled
  const plugCool = new Map(); // cut unit id -> tick before which no new plug is tried
  const plugAssign = new Map(); // cut unit id -> the Crumb sent to plug it
  const badField = new Map(); // "x,y" of wheat -> tick until which no Crumb is sent there
  let scoutWorker = null, scoutSent = false; // the 1:30 lookout Crumb; one per match
  const intel = new Map(); // foe unit id -> { kind, x, y } at its last sighting; dropped when the unit is gone (the counter-build reads this)
  let researchForge = null; // the Assembly Line this side's ground research queues go through, once one is complete
  let researchRackId = null; // the Cooling Rack this side's air research queues go through, once one is complete
  let groundResearchIdx = 0, airResearchIdx = 0, nextGroundResearchAt = 0, nextAirResearchAt = 0;

  // Breadth-first walk over the rock-free tiles, 8 ways, no corner cutting. Returns tiles from `from` to `to`, or [].
  function findLane(obs, from, to) {
    const W = obs.width;
    const H = obs.height;
    const blocked = new Uint8Array(W * H);
    for (const [x, y] of obs.rocks) blocked[y * W + x] = 1;
    const prev = new Int32Array(W * H).fill(-1);
    const start = from.y * W + from.x;
    const goal = to.y * W + to.x;
    blocked[start] = 0;
    blocked[goal] = 0;
    prev[start] = start;
    const queue = [start];
    for (let head = 0; head < queue.length && prev[goal] < 0; head++) {
      const c = queue[head];
      const cx = c % W;
      const cy = (c - cx) / W;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if ((!dx && !dy) || x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
          const n = y * W + x;
          if (prev[n] >= 0 || blocked[n]) continue;
          if (dx && dy && (blocked[cy * W + x] || blocked[y * W + cx])) continue;
          prev[n] = c;
          queue.push(n);
        }
      }
    }
    if (prev[goal] < 0) return [];
    const path = [];
    for (let c = goal; c !== start; c = prev[c]) path.push({ x: c % W, y: (c - (c % W)) / W });
    path.push(from);
    return path.reverse();
  }

  function act(obs) {
    const cmds = [];
    const tick = obs.tick;
    const mine = obs.units.filter((u) => u.owner === side);
    const foeU = obs.units.filter((u) => u.owner !== side);
    const core = obs.structures.find((s) => s.owner === side && s.kind === 'core');
    const foeCore = obs.structures.find((s) => s.owner !== side && s.kind === 'core');
    if (!core) return cmds;
    let shards = obs.shards[side];
    const workers = mine.filter((u) => u.kind === 'worker');
    const army = mine.filter((u) => u.kind !== 'worker');
    const have = (kind) => obs.structures.filter((s) => s.owner === side && s.kind === kind);
    const key = (c) => c.x + ',' + c.y;
    const taken = new Set([...obs.units, ...obs.structures, ...obs.crystals].map(key));
    const rock = new Set(obs.rocks.map((r) => r[0] + ',' + r[1]));
    const isRock = (x, y) => rock.has(x + ',' + y);
    const free = (x, y) => x >= 1 && y >= 1 && x < obs.width - 1 && y < obs.height - 1 && !taken.has(x + ',' + y) && !rock.has(x + ',' + y);
    // The nearest free tile to (x, y), looking outward in rings.
    const nearFree = (x, y, max = 6, ok = () => true) => {
      for (let d = 0; d <= max; d++) {
        for (let dy = -d; dy <= d; dy++) {
          for (let dx = -d; dx <= d; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === d && free(x + dx, y + dy) && ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
          }
        }
      }
      return null;
    };

    // Refusals: the sim says which order the cord stopped. Back off that exact order; never send it again until the ban ends.
    const power = obs.power || {};
    for (const r of power.refused || []) {
      if (seenRefusal.get(r.id) === r.tick) continue;
      seenRefusal.set(r.id, r.tick);
      const prev = bans.get(r.id);
      // A refused retreat must not trigger another retreat: one retreat per quiet spell, then silence until the ban ends.
      bans.set(r.id, { until: tick + BACKOFF, x: r.x, y: r.y, target: r.target, reason: r.reason, retreated: !!(prev && prev.until > tick && prev.retreated) });
      const u = mine.find((q) => q.id === r.id);
      if (u && u.kind === 'worker' && r.x !== null && !u.carrying) badField.set(r.x + ',' + r.y, tick + BACKOFF * 4);
    }
    const banned = (u, x, y, target = null) => {
      const b = bans.get(u.id);
      if (!b || b.until <= tick) return false;
      return (target !== null && b.target === target) || (x !== null && b.x === x && b.y === y);
    };
    const downIds = new Set((power.cut || []).filter((c) => c.state === 'down').map((c) => c.id));
    const cutNow = new Set((power.cut || []).map((c) => c.id)); // unplugged units: any order of theirs is rejected until a Crumb plugs them back in
    const mine2 = (list) => list.filter((u) => !downIds.has(u.id) && !cutNow.has(u.id)); // a powered-down unit can't move at all: only a Crumb's plug helps

    const stations = [core, ...((power.points) || [])];
    const nearestStation = (p) => stations.reduce((b, s) => (dist(s, p) < dist(b, p) ? s : b), stations[0]);
    // Order a unit to (x, y) unless it already has that order or the order is banned; a banned move retreats to the nearest station.
    // Quiet spell after a refusal: no new order for this unit except one retreat toward its nearest station (always legal).
    const quiet = (u) => { const b = bans.get(u.id); return b && b.until > tick ? b : null; };
    const settle = (u) => {
      const b = quiet(u);
      if (!b || b.retreated) return;
      b.retreated = true;
      const st = nearestStation(u);
      const home = nearFree(st.x, st.y, 3) || st;
      if (dist(u, home) > 1) cmds.push({ type: 'move', unit: u.id, x: home.x, y: home.y });
    };
    const order = (u, x, y, type = 'move') => {
      if (u.order && u.order.type === type && u.order.x === x && u.order.y === y) return;
      if (quiet(u)) { settle(u); return; }
      cmds.push({ type, unit: u.id, x, y });
    };

    // Intel: a foe unit is remembered at every sighting by one of our units or Strips, and forgotten once it is gone. The
    // counter-build and the research plan below read this, so an enemy army nobody of ours has seen does not change what we do.
    {
      const lookouts = [...mine, ...obs.structures.filter((s) => s.owner === side)];
      for (const e of foeU) if (lookouts.some((p) => dist(p, e) <= SIGHT)) intel.set(e.id, { kind: e.kind, x: e.x, y: e.y });
      const foeIds = new Set(foeU.map((e) => e.id));
      for (const id of [...intel.keys()]) if (!foeIds.has(id)) intel.delete(id);
    }
    const sighted = (kind) => [...intel.values()].filter((v) => v.kind === kind).length;

    // Scout: at 1:30 one free Crumb (the lowest id) is picked and kept out of mining until 30 s later; the chain section sends it out.
    if (scoutWorker !== null && !workers.some((q) => q.id === scoutWorker)) scoutWorker = null;
    if (!scoutSent && tick >= SCOUT_TICK) {
      const sc = mine2(workers).filter((q) => !(q.order && q.order.type === 'build') && q.id !== chainWorker && q.id !== windWorker && !q.carrying && !quiet(q)).sort((a, b) => a.id - b.id)[0];
      if (sc) { scoutWorker = sc.id; scoutSent = true; }
    }
    const scouting = (id) => id === scoutWorker && tick < SCOUT_TICK + SCOUT_STAY;

    // Mining. Wheat inside a station's reach only (a Crumb that wanders off its cord is refused or powers down). Home fields first;
    // when they run dry the Crumbs take the fields beside the box chain, nearest the Strip first.
    const reachable = (c) => stations.some((s) => dist(s, c) <= FIELD_REACH) && !(badField.get(key(c)) > tick);
    const live = obs.crystals.filter((c) => c.amount > 0 && reachable(c)).sort((a, b) => dist(a, core) - dist(b, core) || a.y - b.y || a.x - b.x);
    const load = new Map();
    for (const w of workers) if (w.order && w.order.type === 'gather') load.set(key(w.order), (load.get(key(w.order)) || 0) + 1);
    for (const w of mine2(workers)) {
      if (w.order || w.id === chainWorker || w.id === windWorker || scouting(w.id)) continue;
      if (quiet(w)) { settle(w); continue; }
      const pool = live.filter((c) => !banned(w, c.x, c.y));
      if (!pool.length) {
        if (dist(w, core) > 3) order(w, core.x, core.y); // nothing minable: wait at the Strip, inside the cord
        continue;
      }
      const c = pool.reduce((b, t) => ((load.get(key(t)) || 0) < (load.get(key(b)) || 0) ? t : b), pool[0]);
      cmds.push({ type: 'gather', unit: w.id, x: c.x, y: c.y });
      load.set(key(c), (load.get(key(c)) || 0) + 1);
    }
    if (core.complete && workers.length + core.queue.length < P.workers && core.queue.length < 2 && shards >= U.worker.cost) {
      cmds.push({ type: 'train', building: core.id, kind: 'worker' });
      shards -= U.worker.cost;
    }

    // Builds, one at a time: Mill, Well, Toaster, Assembly Line (Forge). The Well goes by the home spring.
    const busy = workers.some((w) => w.order && w.order.type === 'build');
    const builder = mine2(workers).find((w) => !(w.order && w.order.type === 'build') && w.id !== chainWorker && w.id !== windWorker && w.id !== scoutWorker);
    const build = P.build;
    const count = (k) => have(k).length;
    const seen = { mill: 0, well: 0, toaster: 0, forge: 0, turret: 0 };
    let next = null, step = 0;
    for (const k of build) {
      seen[k]++;
      if (count(k) < seen[k]) { next = k; break; }
      step++;
    }
    // After the opening (first four buildings) extra buildings wait for a wheat reserve, so the box chain and the fighters are not starved.
    // A building also keeps the stalemate clock (120 s without damage, a kill or a new structure) from running: one every 90 s regardless.
    const reserve = step >= 4 && tick - lastBuild < 24 * 90 ? P.reserve : 0;
    const windmills = (power.points || []).filter((p) => p.kind === 'windmill' && (p.owner === undefined || p.owner === side));
    // No 2nd Toaster until the Windmills can carry it: a Toaster over budget goes dark.
    if (power.energy && next === 'toaster' && count('toaster') >= 1 && 2 + 3 * windmills.length < 2 * (count('toaster') + 1)) next = null;
    if (next && !busy && builder && workers.length >= 4 && shards >= S[next].cost + reserve) {
      let spot = null;
      if (next === 'well') {
        const springs = (obs.kitchen && obs.kitchen.wells) || [];
        const at = springs.map(([x, y]) => ({ x, y })).sort((a, b) => dist(a, core) - dist(b, core))[0]; // our own spring
        if (at) spot = nearFree(at.x, at.y, 3);
      }
      if (!spot) spot = nearFree(core.x + (foeCore ? Math.sign(foeCore.x - core.x) * 4 : 4), core.y + (foeCore ? Math.sign(foeCore.y - core.y) * 4 : 4), 8);
      if (spot && !banned(builder, spot.x, spot.y)) {
        cmds.push({ type: 'build', unit: builder.id, kind: next, x: spot.x, y: spot.y });
        lastBuild = tick;
        shards -= S[next].cost;
      }
    }

    // Windmills (env/energy.mjs): the Strip makes 2 energy, a Toaster uses 2, a Windmill on a high-ground pad makes 3. A Crumb walks to the
    // next pad, plugging an Extension Box on the way when no station reaches it, then raises the Windmill. Pads: Wheatfield Valley, mirrored.
    {
      const ed = (p, q) => Math.hypot(p.x - q.x, p.y - q.y); // the sim measures reach in straight lines
      const flip = core.x > obs.width / 2;
      const padList = PADS.map(([x, y]) => (flip ? { x: obs.width - 1 - x, y: obs.height - 1 - y } : { x, y }));
      const wanted = Math.min(padList.length, Math.ceil((2 * WANT_TOASTERS - 2) / 3));
      const pad = padList.find((p) => !windmills.some((m) => m.x === p.x && m.y === p.y));
      const w = mine2(workers).find((q) => q.id === windWorker);
      if (!power.energy || windmills.length >= wanted || !pad || !core.complete || count('toaster') < 1 || count('well') < 1) windWorker = null;
      else if (shards >= 40 || w) {
        const cand = w || mine2(workers).filter((q) => !(q.order && q.order.type === 'build') && !q.carrying && q.id !== chainWorker && q.id !== scoutWorker && !quiet(q) && ed(q, core) <= 12).sort((p, q) => ed(p, core) - ed(q, core) || p.id - q.id)[0]; // one that is still on the Strip's cord
        if (cand) {
          windWorker = cand.id;
          const st = [core, ...(power.points || []).filter((p) => p.kind === 'extension')];
          const near = st.reduce((b, s) => (ed(s, pad) < ed(b, pad) ? s : b), st[0]);
          if (ed(near, pad) <= 11) {
            if (ed(cand, pad) <= 1) {
              if (shards >= 40) { cmds.push({ type: 'place-power', unit: cand.id, kind: 'windmill', x: pad.x, y: pad.y }); shards -= 40; }
            } else {
              const t = nearFree(pad.x, pad.y, 2, (x, y) => !(x === pad.x && y === pad.y) && ed(near, { x, y }) <= 11);
              if (t) order(cand, t.x, t.y);
            }
          } else {
            const f = 10 / ed(near, pad);
            const spot = nearFree(Math.round(near.x + (pad.x - near.x) * f), Math.round(near.y + (pad.y - near.y) * f), 2, (x, y) => ed(near, { x, y }) <= 11);
            if (spot) {
              if (ed(cand, spot) <= 1) { if (shards >= 30) { cmds.push({ type: 'place-power', unit: cand.id, kind: 'extension', x: spot.x, y: spot.y }); windBoxes.add(spot.x + ',' + spot.y); shards -= 30; } }
              else order(cand, spot.x, spot.y);
            }
          }
        }
      }
    }

    // The chain of Extension Boxes. The lane is re-found now and then (rocks can be pushed); the next box goes on the lane as far
    // as a simulated cord walk reaches, so the Crumb never walks out of its cord.
    // The mix table: of the kinds that are open, train the one furthest below its share (queued units count). Tier 2 kinds need a
    // finished Toaster; tier 3 kinds (Four-Slice, Broiler, Bagel) need a standing Windmill or Dam.
    const owned = {};
    for (const u of army) owned[u.kind] = (owned[u.kind] || 0) + 1;
    for (const f of have('forge')) for (const q of f.queue || []) owned[q.kind || q] = (owned[q.kind || q] || 0) + 1;
    const toastered = have('toaster').some((s) => s.complete);
    const powered = (power.points || []).some((p) => (p.kind === 'windmill' || p.kind === 'dam') && (p.owner === undefined || p.owner === side));
    const open = (k) => toastered && (!TIER3.has(k) || powered);

    // Research (M3): once a complete Assembly Line stands, work down GROUND_RESEARCH in order, resending the next item on a
    // cooldown. A resend of something already done or already queued costs nothing (env/research.mjs), so no feedback from
    // obs is needed to know when to move on; GROUND_RESEARCH is short enough that the cooldown alone paces it sensibly.
    const myForge = have('forge').find((s) => s.complete);
    if (myForge) researchForge = myForge.id;
    if (researchForge && groundResearchIdx < GROUND_RESEARCH.length && tick >= nextGroundResearchAt && shards >= 150) {
      cmds.push({ type: 'research', building: researchForge, upgrade: GROUND_RESEARCH[groundResearchIdx] });
      nextGroundResearchAt = tick + RESEARCH_COOLDOWN;
      groundResearchIdx += 1;
    }

    // Air layer (M4): the Cooling Rack needs the same standing Windmill or Dam as the ground tier-3 kinds. One Rack is
    // plenty for a mix this size; AIR_MIX trains the kind furthest below its share, same pattern as the ground mix.
    if (powered && count('coolingRack') < 1 && !busy && shards >= S.coolingRack.cost + reserve) {
      const rackBuilder = mine2(workers).find((w) => !(w.order && w.order.type === 'build') && w.id !== chainWorker && w.id !== windWorker && w.id !== scoutWorker && !cmds.some((c) => c.type === 'build' && c.unit === w.id));
      if (rackBuilder) {
        const away = foeCore ? -Math.sign(foeCore.x - core.x) : -1;
        const spot = nearFree(core.x + away * 4, core.y + (foeCore ? -Math.sign(foeCore.y - core.y) * 4 : -4), 8);
        if (spot && !banned(rackBuilder, spot.x, spot.y)) {
          cmds.push({ type: 'build', unit: rackBuilder.id, kind: 'coolingRack', x: spot.x, y: spot.y });
          shards -= S.coolingRack.cost;
        }
      }
    }
    const rack = have('coolingRack').find((s) => s.complete);
    if (rack) {
      researchRackId = rack.id;
      const airOwned = {};
      for (const u of army) if (AIR_MIX[u.kind]) airOwned[u.kind] = (airOwned[u.kind] || 0) + 1;
      for (const q of rack.queue || []) airOwned[q.kind || q] = (airOwned[q.kind || q] || 0) + 1;
      const airKinds = Object.keys(AIR_MIX);
      const airCount = airKinds.reduce((n, k) => n + (airOwned[k] || 0), 0);
      if (rack.queue.length < 2 && airCount < AIR_CAP) {
        const airWant = airKinds.reduce((b, k) => ((airOwned[k] || 0) / AIR_MIX[k] < (airOwned[b] || 0) / AIR_MIX[b] ? k : b), airKinds[0]);
        if (shards >= U[airWant].cost + 60) {
          cmds.push({ type: 'train', building: rack.id, kind: airWant });
          shards -= U[airWant].cost;
        }
      }
    }
    if (researchRackId && airResearchIdx < AIR_RESEARCH.length && tick >= nextAirResearchAt && shards >= 150) {
      cmds.push({ type: 'research', building: researchRackId, upgrade: AIR_RESEARCH[airResearchIdx] });
      nextAirResearchAt = tick + RESEARCH_COOLDOWN;
      airResearchIdx += 1;
    }

    // afford: only kinds the wheat in hand pays for (plus the 60 kept back), so an expensive kind never blocks cheaper ones for minutes.
    const neediest = (afford = Infinity) => {
      const kinds = Object.keys(P.mix).filter((k) => open(k) && U[k] && U[k].cost + 60 <= afford);
      return kinds.length ? kinds.reduce((b, k) => ((owned[k] || 0) / P.mix[k] < (owned[b] || 0) / P.mix[b] ? k : b), kinds[0]) : null;
    };
    // Fighters first: while the army is small, a box (30) waits until the next fighter's price is banked as well (toaster-sonnet spent every shard on boxes and never trained anyone before 6:00).
    const want = neediest();
    const hungry = !!want && have('forge').some((f) => f.complete) && army.length < Math.ceil(P.capBase * 0.6);
    const boxPay = 30 + (hungry ? U[want].cost + 60 : 0);
    const fc = foeCore || core;
    const boxes = (power.points || []).filter((p) => p.kind === 'extension' && !windBoxes.has(p.x + ',' + p.y));
    if (foeCore && (!lane || (!lane.length && tick - laneTick > 480) || tick - laneTick > 24 * 60)) { lane = findLane(obs, core, foeCore); laneTick = tick; }
    const path = lane && lane.length ? lane : [core, fc];
    const laneAt = (q) => path.reduce((b, r, i) => (dist(r, q) < dist(path[b], q) ? i : b), 0);
    // The box (or the Strip) furthest along the lane: straight-line "nearest" can sit across the creek.
    const tip = boxes.reduce((b, p) => (laneAt(p) > laneAt(b) ? p : b), core);
    const ti = laneAt(tip);
    const arrived = dist(tip, fc) <= SIEGE;
    // Walk the lane from the tip on a simulated cord; the last tile it can reach within HOP is where the next box goes.
    const ceiling = tick >= PUSH_TICK ? path.length : Math.floor(path.length * HOLD_FRAC); // the chain waits here until the push
    const pushing = tick >= PUSH_TICK && army.length >= P.minArmy;
    const hop = pushing ? 5 : HOP; // while pushing the army stands AHEAD of the tip, so boxes go close in and the Crumb never has to squeeze past it
    const planBox = () => {
      let cord = newCord(tip);
      let best = -1;
      for (let j = ti + 1; j < ceiling && dist(path[j], tip) <= hop; j++) {
        const m = cordMove(cord, path[j], isRock, CORD);
        if (!m.ok) break;
        cord = m.cord;
        if (free(path[j].x, path[j].y)) best = j;
      }
      return best;
    };
    // One lane step for a unit heading to lane index `to`: the tile STEP along the lane from where it stands.
    const laneStep = (u, to) => {
      const lu = laneAt(u);
      const k = lu < to ? Math.min(lu + STEP, to) : Math.max(lu - STEP, to);
      return path[k];
    };
    const goLane = (u, to) => {
      // Keep a lane order that still leads on: re-aiming every few ticks makes a unit shuffle on the spot.
      const o = u.order;
      if (o && o.type === 'move' && Number.isInteger(o.x)) {
        const lu = laneAt(u), lo = laneAt(o);
        const ahead = lu < to ? lo > lu && lo <= to : lo < lu && lo >= to;
        if (ahead && dist(u, o) <= STEP + 2) return;
      }
      const t = laneStep(u, to);
      const spot = nearFree(t.x, t.y, 2) || t;
      order(u, spot.x, spot.y);
    };
    if (!arrived && core.complete && (shards >= 20 || chainWorker !== null) && count('toaster') >= 1 && count('well') >= 1 && (count('forge') >= 1 || !P.chainNeedsForge)) { // kitchen and barracks first: boxes are 30 wheat each
      const w = mine2(workers).find((q) => q.id === chainWorker) || mine2(workers).find((q) => !(q.order && q.order.type === 'build') && !q.carrying && q.id !== scoutWorker);
      if (w) {
        chainWorker = w.id;
        const refused = bans.get(w.id);
        const j = ti < ceiling - 1 ? planBox() : -1; // at the ceiling the Crumb waits at the tip for the push
        if (refused && refused.until > tick) {
          // The cord stopped us: plug a box on the nearest free tile right here (it re-pegs the cord) instead of trying again.
          const t = nearFree(w.x, w.y, 1, (x, y) => stations.some((s) => dist(s, { x, y }) <= 12));
          if (t && shards >= boxPay && !w.order) {
            cmds.push({ type: 'place-power', unit: w.id, kind: 'extension', x: t.x, y: t.y });
            shards -= 30;
            bans.delete(w.id); // the new box pegs the cord: planning starts again from here
          } else if (shards < 30) chainWorker = null; // broke: go back to mining instead of standing at the end of a cord
          else settle(w);
        } else if (j >= 0) {
          const spot = path[j];
          const stand = path[Math.max(ti, j - 1)];
          if (dist(w, spot) <= 1) {
            if (shards >= boxPay) {
              cmds.push({ type: 'place-power', unit: w.id, kind: 'extension', x: spot.x, y: spot.y });
              shards -= 30;
            }
          } else if (dist(w, tip) > HOP + 1 && laneAt(w) < ti) goLane(w, ti); // still on the way out: walk the lane to the tip first
          else order(w, stand.x, stand.y);
        } else if (dist(w, tip) > 2) goLane(w, ti);
      } else chainWorker = null;
    } else if (arrived) chainWorker = null; // the chain is done: back to mining

    // Scout: the lookout stands at the chain tip (the furthest box is always inside its cord) and sights the lane ahead. Its
    // sightings go into intel above. After 30 s it is released back to mining.
    if (scoutWorker !== null && tick >= SCOUT_TICK + SCOUT_STAY) scoutWorker = null;
    else if (scoutWorker !== null) {
      const sc = mine2(workers).find((q) => q.id === scoutWorker);
      if (sc && dist(sc, tip) > 2) goLane(sc, ti);
    }

    if (globalThis.BOTDBG && side === 0 && tick % 720 === 0) console.log("DBG", tick / 1440, "ti", ti, "/", path.length, "ceil", ceiling, "tip", tip.x, tip.y, "arrived", arrived, "chainWorker", chainWorker, "shards", shards, "j", planBox(), "w", JSON.stringify(workers.filter((q) => q.id === chainWorker).map((q) => [q.x, q.y, q.order])), "quiet", JSON.stringify([...bans.entries()].filter(([, b]) => b.until > tick)));
    // Army: Poppers and Zappers from every finished Assembly Line. The chain comes first: a fat army with no box in range does nothing.
    // Toast, not bodies, wins a siege (a Popper fires six slices and must be refilled), but idle wheat wins nothing: a rich side trains on.
    const cap = (arrived ? P.capArrived : tick >= PUSH_TICK ? P.capPush : P.capBase) + (shards > 500 ? Math.min(16, Math.floor((shards - 500) / 150)) : 0);
    for (const f of have('forge').filter((s) => s.complete)) {
      if (f.queue.length >= 2 || army.length + f.queue.length >= cap) continue;
      let kind = neediest();
      if (!kind) continue;
      // Past half the price of the kind we lack most, save for it; below that, buy the neediest cheaper kind.
      if (shards < U[kind].cost + 60) {
        if (shards >= (U[kind].cost + 60) / 2) continue;
        kind = neediest(shards);
        if (!kind) continue;
      }
      if (shards >= U[kind].cost + 60) { // keep a little wheat back: every fighter also eats upkeep
        cmds.push({ type: 'train', building: f.id, kind });
        shards -= U[kind].cost;
        owned[kind] = (owned[kind] || 0) + 1;
      }
    }

    // Re-plug: a Crumb walks to each unit whose cord was cut and plugs it back in (a dead unit stays dead otherwise).
    const cut = power.cut || [];
    const cutIds = new Set(cut.map((c) => c.id));
    const pluggers = mine2(workers).filter((w) => !cutIds.has(w.id) && w.id !== chainWorker && w.id !== windWorker && w.id !== scoutWorker);
    const usedPlug = new Set();
    for (const id of [...plugAssign.keys()]) if (!cutIds.has(id)) plugAssign.delete(id); // mended or gone
    for (const c of cut.slice(0, 4)) {
      const victim = mine.find((u) => u.id === c.id);
      // The same Crumb stays on the same victim until it is mended: re-picking the nearest every tick makes them all dither.
      let p = victim && pluggers.find((w) => w.id === plugAssign.get(c.id) && !usedPlug.has(w.id));
      if (!p && victim) p = pluggers.filter((w) => !usedPlug.has(w.id)).sort((a, b) => dist(a, victim) - dist(b, victim) || a.id - b.id)[0];
      if (!p) continue;
      plugAssign.set(c.id, p.id);
      usedPlug.add(p.id);
      if (dist(p, victim) <= 1) {
        // A plug takes 1 s and fails when no station is within the victim's cord: try once, then leave it alone for a while.
        if (!(plugCool.get(victim.id) > tick) && stations.some((st) => dist(st, victim) <= CORD)) { cmds.push({ type: 'plug', unit: p.id, target: victim.id }); plugCool.set(victim.id, tick + PLUG_COOL); }
      }
      else if (Math.abs(laneAt(p) - laneAt(victim)) > STEP) goLane(p, laneAt(victim)); // far off: walk the lane, the way the cord was planned
      else {
        const spot = nearFree(victim.x, victim.y, 1) || victim;
        order(p, spot.x, spot.y);
      }
    }

    // Push: sit at the chain tip (inside the cord) until the tip is in siege range; then everything goes for the Strip.
    // The army walks the lane in short steps, the way the boxes were planned; a straight run at the Strip leaves the cord.
    const inCorridor = (e) => path.some((p, i) => i % 3 === 0 && dist(p, e) <= 7) || stations.some((p) => dist(p, e) <= 7);
    const holdIdx = arrived ? ti : pushing ? Math.min(path.length - 1, ti + 7) : Math.min(path.length - 1, Math.max(6, ti - 8)); // wait a little behind the tip so the Crumb laying boxes has the lane ahead to itself; never ON the Strip, where a crowd blocks the Crumbs' drop-off
    const hold = path[holdIdx];
    const go = arrived && army.length >= P.minArmy && tick >= PUSH_TICK;
    const groundArmy = mine2(army).filter((u) => (U[u.kind] || {}).layer !== 'air');
    for (const u of groundArmy) {
      if (quiet(u)) { settle(u); continue; }
      // Raid: a Zapper or Bagel (after 1:30, before the push) goes for a Crumb in the corridor up to a cord's length away.
      const raider = (u.kind === 'lancer' || u.kind === 'dart') && tick >= RAID_TICK && !pushing;
      const raid = raider ? foeU.filter((e) => e.kind === 'worker' && dist(e, u) <= RAID_REACH && inCorridor(e)).sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0] : null;
      // Before the push only what walks up to us is fought; from the push on the army steps out to clear the lane for the chain.
      const near = raid || foeU.filter((e) => (pushing ? dist(e, u) <= 14 && (dist(e, tip) <= 16 || inCorridor(e)) : dist(e, u) <= 6 && inCorridor(e))).sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0];
      const t = near || (go && foeCore && dist(u, foeCore) <= 10 ? foeCore : null);
      if (t && !banned(u, null, null, t.id)) {
        if (!(u.order && u.order.type === 'attack' && u.order.target === t.id)) cmds.push({ type: 'attack', unit: u.id, target: t.id });
      } else if (!t || banned(u, null, null, t.id)) {
        if (dist(u, hold) > 3) goLane(u, holdIdx);
      }
    }

    // Air: flyers ignore the lane and the cord. Each spends AIR_HOME ticks of every AIR_CYCLE standing beside a Toaster or
    // the Cooling Rack to top up on slices (env/air.mjs resupplies only there), the rest hunting whatever is in reach; the
    // Crouton Kite carries no weapon and just extends how far ahead we see.
    const airArmy = mine.filter((u) => (U[u.kind] || {}).layer === 'air');
    if (airArmy.length) {
      const airHomes = [...have('toaster'), ...have('coolingRack')].filter((s) => s.complete);
      const homeSpot = airHomes.length ? airHomes.reduce((b, s) => (dist(s, tip) < dist(b, tip) ? s : b), airHomes[0]) : core;
      for (const u of airArmy) {
        if (quiet(u)) { settle(u); continue; }
        const resupplying = tick % AIR_CYCLE < AIR_HOME;
        if (resupplying) {
          if (dist(u, homeSpot) > AIR_HOME_REACH) { const h = nearFree(homeSpot.x, homeSpot.y, 3) || homeSpot; order(u, h.x, h.y); }
          continue;
        }
        if (u.kind === 'croutonKite') { if (dist(u, tip) > 3) order(u, tip.x, tip.y); continue; } // no weapon: just watches the lane ahead
        const canHitAir = U[u.kind].hits && U[u.kind].hits.air;
        const canHitGround = U[u.kind].hits && U[u.kind].hits.ground;
        const target = foeU.filter((e) => dist(e, u) <= 16 && ((canHitAir && (U[e.kind] || {}).layer === 'air') || (canHitGround && (U[e.kind] || {}).layer !== 'air'))).sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0]
          || (go && foeCore && canHitGround ? foeCore : null);
        if (target && !banned(u, null, null, target.id)) {
          if (!(u.order && u.order.type === 'attack' && u.order.target === target.id)) cmds.push({ type: 'attack', unit: u.id, target: target.id });
        } else if (dist(u, tip) > 6) order(u, tip.x, tip.y);
      }
    }
    return cmds;
  }
  return { name: 'toaster-hard-' + name, act, scout: () => scoutWorker };
}
