// Idle Crumbs (PLAYABLE.md item 3). Owner: sonnet (Playable Client). Pure, no DOM, browser-safe.
// A Crumb that stands idle for 3 s (or is idle on the first tick of the match) is sent to gather the nearest wheat inside its
// cord reach, as a normal 'gather' command for the human side. The page shows a blinking button with the idle count; F1 cycles
// through the idle Crumbs. Crumbs the player is steering (a plan in the input, or Hold) are left alone.
import { pickWheatTile } from '../env/economy.mjs';

export const IDLE_TICKS = 72;     // 3 s at 24 ticks per second
export const RETRY_TICKS = 120;    // a Crumb with no wheat in reach is looked at again after 5 s
export const CORD_REACH = 12;      // POWER.cord.worker in env/power.mjs

/**
 * The Wheat tile a Crumb should mine next: the least-loaded one in cord reach of the side's power points (env/economy.mjs
 * pickWheatTile, the same pick the sim uses for target 'auto'); null when none. `assigned` carries this tick's new orders.
 * The snapshot has no rocks, so a rock beside a field counts as open here; the sim's pick sees them.
 */
export function nearestWheat(snap, u, side, reach = CORD_REACH, assigned = new Map()) {
  const pts = (snap.power?.points ?? []).filter((p) => p.owner === side);
  for (const s of snap.structures) if (s.owner === side && s.kind === 'core' && !pts.some((p) => p.id === s.id)) pts.push(s);
  const passable = (x, y) => !snap.crystals.some((c) => c.x === x && c.y === y) && !snap.structures.some((s) => s.x === x && s.y === y);
  return pickWheatTile({ unit: u, crystals: snap.crystals, units: snap.units, points: pts, passable, assigned, reach });
}

export function createIdleCrumbs({ side = 0, kind = 'worker', idleTicks = IDLE_TICKS } = {}) {
  const since = new Map();   // unit id -> tick it was first seen idle
  const tried = new Map();   // unit id -> tick of the last auto-gather attempt
  let cursor = -1;
  const isIdle = (u, plans) => {
    if (u.owner !== side || u.kind !== kind || u.order) return false;
    const p = plans?.get?.(u.id);
    return !(p && (p.cur || p.queue?.length || p.hold));
  };

  /** Idle Crumbs now (no order, no plan), in id order. */
  const idle = (snap, plans) => snap.units.filter((u) => isIdle(u, plans)).sort((a, b) => a.id - b.id);

  /** Commands for this tick: gather orders for Crumbs idle long enough. Call once per tick with the observation. */
  function tick(snap, plans) {
    const cmds = [];
    const now = snap.tick ?? 0;
    const live = new Set();
    const assigned = new Map();  // tile key -> Crumbs sent there in this call, so one tick spreads them
    for (const u of snap.units) {
      if (u.owner !== side || u.kind !== kind) continue;
      live.add(u.id);
      if (!isIdle(u, plans)) { since.delete(u.id); continue; }
      if (!since.has(u.id)) since.set(u.id, now <= 1 ? -Infinity : now); // match start: go to work at once
      if (now - since.get(u.id) < idleTicks) continue;
      if (tried.has(u.id) && now - tried.get(u.id) < RETRY_TICKS) continue;
      tried.set(u.id, now);
      const w = nearestWheat(snap, u, side, CORD_REACH, assigned);
      if (w) { cmds.push({ type: 'gather', unit: u.id, x: w.x, y: w.y }); assigned.set(`${w.x},${w.y}`, (assigned.get(`${w.x},${w.y}`) || 0) + 1); }
    }
    for (const id of [...since.keys()]) if (!live.has(id)) { since.delete(id); tried.delete(id); }
    return cmds;
  }

  /** F1: the next idle Crumb after the last one picked (wraps). Returns { id, x, y } or null. */
  function cycle(snap, plans) {
    const list = idle(snap, plans);
    if (!list.length) { cursor = -1; return null; }
    const next = list.find((u) => u.id > cursor) ?? list[0];
    cursor = next.id;
    return { id: next.id, x: next.x, y: next.y };
  }

  return { tick, idle, cycle, count: (snap, plans) => idle(snap, plans).length };
}

/** HTML of the idle-Crumb button; '' when none are idle. It blinks (class idle-blink). */
export function idleButtonHtml(count) {
  return count > 0 ? `<button class="idle-btn idle-blink" data-idle="1" title="Idle Crumbs: click or press F1 to select the next one">Idle Crumbs <b>${count}</b> <kbd>F1</kbd></button>` : '';
}
