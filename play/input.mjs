// Driftfall Classic: input -> commands (owner: sonnet, Playable Client).
// Pure module: no DOM, no three.js, no clock. The page (play/app.mjs) feeds it clicks, boxes and keys in tile and
// screen terms; it keeps the selection, control groups, modes and per-unit order plans, and each tick returns the
// list of sim commands for this side (tick(state) -> commands).
//
// The sim understands only move / attack / gather / build / train / stop (ENV-SPEC section 10). The classic
// extras are done here, on top of those six, so they work today and can move into the sim later without the page
// changing:
//   attack-move (A, click)  walk to the point, attack anything that comes within ACQUIRE tiles, then carry on
//   hold position (H)       never chases: attacks only what is already in range, stops if it walks out of range
//   Shift-queue             orders after the current one; each starts when the unit goes idle
//   rally points            new units walk (or Workers mine) where the building's rally points
//
// `state` everywhere is an observation-shaped object: { tick, width, height, rocks, crystals, shards, units,
// structures }, as observe() in env/state.mjs returns. `stats` is the STATS table.

import { edgeVector } from './camera.mjs';
import { mapReason, reasonText } from './placement-ghost.mjs';
import { kindName } from './hud.mjs';
import { isStationKind, stationPlaceCheck, stationCost, pickStation, fenceOrder, rejectText, STATION_KINDS, STATION_KEYS } from './station-controls.mjs';
import { kitchenLockReason } from '../env/tiers.mjs';
import { toasterResearchEntries, researchIdOf, researchQueuedText } from './research-card.mjs';   // Research lead: the Assembly Line's upgrade buttons
import { researchRow, flourCostOf } from '../env/research.mjs';
import { pickWheatTile } from '../env/economy.mjs';   // Power Strip rally: the auto-gather pick (Economy A)
import { wellPlaceReason } from '../env/bakery.mjs';   // the ghost refuses a Well the sim refuses (Construction)

export const KITCHEN_OPEN_TEXT = 'Kitchen open: the Assembly Line is yours';          // the first slice from a Toaster
export const POWER_UP_TEXT = 'Power is up: the Four-Slice, Broiler and Bagel are yours'; // the first Windmill or Dam

export const MAX_SELECT = 12;
export const ACQUIRE = 6;          // attack-move notices enemies this many tiles away
export const DOUBLE_MS = 400;      // double-click / double-tap window
export const MUTE_KEY = '`';       // sound on/off (play/app.mjs); backtick in both key profiles, so U is free for a button
export const INSPECT_KEY = 'F4';   // inspect power (play/app.mjs); Tab cycles unit types inside a selection instead

/** P pauses (or resumes) only when nothing is picked: with units picked, P is Patrol on the classic profile. Ctrl/Cmd+P is print. */
export function pauseKeyFires(k, { paused = false, selected = 0, mod = false } = {}) {
  if (mod || !/^p$/i.test(k)) return false;
  return paused || selected === 0;
}

/**
 * Whether the game takes a key press (so the page prevents the browser's default). Digits take Ctrl too (groups, Ctrl+0
 * zoom reset). With Ctrl or Cmd, letters, Tab and Space belong to the browser, so the card does not take them.
 */
export function gameTakesKey(k, { mod = false, cardKeys = [] } = {}) {
  if (/^[0-9]$/.test(k)) return true;
  if (mod) return false;
  return k === ' ' || k === 'Escape' || k === 'Tab' || cardKeys.includes(k.toLowerCase());
}
const RESERVED_KEYS = new Set(['a', 's', 'h', 'm', 'r', 'p', 'q', MUTE_KEY]);
// The Driftfall pages (no key profile) keep today's letters on the universal row; Toaster Wars passes its profile table.
const LEGACY_KEYS = Object.freeze({ move: 'm', stop: 's', hold: 'h', patrol: 'p', amove: 'a', rally: 'r', lineRally: 'r' });
const ROW1 = Object.freeze([['move', 'Move', 'move'], ['stop', 'Stop', 'stop'], ['hold', 'Hold', 'hold'], ['patrol', 'Patrol', 'patrol'], ['amove', 'Attack', 'amove']]);

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const byId = (a, b) => a.id - b.id;

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------------------------------------------

export function entityMap(state) {
  const m = new Map();
  for (const u of state.units) m.set(u.id, u);
  for (const s of state.structures) m.set(s.id, s);
  return m;
}

export function isStructure(state, e) {
  return state.structures.includes(e);
}

/** Hotkey letters for a list of kinds: first unused letter of the name, never one of the reserved command keys. */
export function assignHotkeys(kinds) {
  const used = new Set(RESERVED_KEYS);
  const out = {};
  for (const kind of kinds) {
    const pick = [...kind.toLowerCase()].find((c) => /[a-z]/.test(c) && !used.has(c))
      ?? 'abcdefghijklmnopqrstuvwxyz'.split('').find((c) => !used.has(c));
    used.add(pick);
    out[kind] = pick;
  }
  return out;
}

/** The entity under a screen point: the nearest projected unit/structure within `radius` px. Units beat structures. */
export function pickEntity(state, project, sx, sy, { radius = 22, structureRadius = 34 } = {}) {
  let best = null, bestD = Infinity;
  const consider = (e, r, bias) => {
    const p = project(e.x, e.y);
    const d = Math.hypot(p.sx - sx, p.sy - sy) + bias;
    if (d <= r + bias && d < bestD) { best = e; bestD = d; }
  };
  for (const s of state.structures) consider(s, structureRadius, 12);
  for (const u of state.units) consider(u, radius, 0);
  return best;
}

/**
 * The points that stand for a unit's body in a box test: its centre, the four corners of its footprint square
 * (BODY tiles out) and the four edge midpoints. Any of them inside the box selects the unit.
 */
export const BODY = 0.45; // half-width of a unit's footprint, in tiles
export function bodyPoints(u) {
  return [[0, 0], [-BODY, -BODY], [BODY, -BODY], [BODY, BODY], [-BODY, BODY], [-BODY, 0], [BODY, 0], [0, -BODY], [0, BODY]]
    .map(([dx, dy]) => [u.x + dx, u.y + dy]);
}

/** Own units whose body (any footprint point, see bodyPoints) falls inside the rectangle (sorted by id, capped at `max`). */
export function boxEntities(state, project, rect, side, max = MAX_SELECT) {
  const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1);
  const y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
  const inside = state.units.filter((u) => {
    if (u.owner !== side) return false;
    return bodyPoints(u).some(([tx, ty]) => {
      const p = project(tx, ty);
      return p.sx >= x0 && p.sx <= x1 && p.sy >= y0 && p.sy <= y1;
    });
  }).sort(byId);
  return inside.slice(0, max);
}

/** Free tiles around (x, y), nearest first, for spreading a group so units do not pile onto one tile. */
export function spreadTiles(state, x, y, count) {
  const taken = new Set(state.structures.map((s) => `${s.x},${s.y}`));
  const rocks = new Set(state.rocks.map(([rx, ry]) => `${rx},${ry}`));
  for (const c of state.crystals) taken.add(`${c.x},${c.y}`);
  const ok = (tx, ty) => tx >= 0 && ty >= 0 && tx < state.width && ty < state.height && !rocks.has(`${tx},${ty}`) && !taken.has(`${tx},${ty}`);
  const out = [];
  for (let r = 0; r < 12 && out.length < count; r++) {
    const ring = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(x + dx, y + dy)) ring.push({ x: x + dx, y: y + dy });
    }
    ring.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y) || a.y - b.y || a.x - b.x);
    for (const t of ring) if (out.length < count) out.push(t);
  }
  return out;
}

/** Give each unit the nearest still-unused tile (greedy, in id order after sorting by distance to the target). */
export function assignTiles(units, tiles) {
  const free = tiles.slice();
  const out = new Map();
  for (const u of [...units].sort((a, b) => a.id - b.id)) {
    let bi = 0, bd = Infinity;
    free.forEach((t, i) => { const d = Math.hypot(t.x - u.x, t.y - u.y); if (d < bd) { bd = d; bi = i; } });
    out.set(u.id, free.splice(bi, 1)[0] ?? tiles[0]);
  }
  return out;
}

export function crystalAt(state, x, y) {
  return state.crystals.find((c) => c.x === x && c.y === y && c.amount > 0) ?? null;
}

/** Can `kind` be placed on (x, y) right now? { ok, reason }. Mirrors the sim's build checks (one tile). */
export function placeCheck(state, stats, side, kind, x, y, ctx = null) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= state.width || y >= state.height) return { ok: false, reason: 'off-map' };
  if (state.rocks.some(([rx, ry]) => rx === x && ry === y)) return { ok: false, reason: 'blocked' };
  if (state.crystals.some((c) => c.x === x && c.y === y)) return { ok: false, reason: 'blocked' };
  if (state.structures.some((s) => s.x === x && s.y === y)) return { ok: false, reason: 'blocked' };
  if (state.units.some((u) => u.x === x && u.y === y)) return { ok: false, reason: 'unit in the way' };
  const tooClose = wellPlaceReason(state, side, kind, x, y); // the sim's own enemy-Well rule (env/bakery.mjs), Construction
  if (tooClose) return { ok: false, reason: tooClose };
  const mapBad = mapReason(ctx, kind, x, y); // Well near water, enemy fenced land (play/placement-ghost.mjs)
  if (mapBad) return { ok: false, reason: mapBad };
  if (isStationKind(kind) && !stats.structures[kind]) return stationPlaceCheck(state, side, kind, x, y);
  const cost = stats.structures[kind]?.cost ?? Infinity;
  if (state.shards[side] < cost) return { ok: false, reason: 'not enough wheat' };
  return { ok: true, reason: null };
}

// ---------------------------------------------------------------------------------------------------------------
// The input controller
// ---------------------------------------------------------------------------------------------------------------

// rowOf(state, kind) gives the row a unit's range is read from (Toaster Wars: env/stats.mjs rowOf); without it, the STATS table.
export function createInput({ side = 0, stats, hotkeys = null, grid = null, stations = false, placeContext = null, rowOf = null }) {
  const trainable = (s) => stats.structures[s.kind]?.trains ?? (s.kind === 'core' ? stats.core?.trains : null) ?? [];
  const buildKinds = Object.keys(stats.structures).filter((k) => stats.structures[k].cost !== undefined && k !== 'core');
  // hotkeys: a { slot: key } profile table (Toaster Wars: grid or classic, play/toaster-play.mjs), else the first free letter.
  // grid: the same table's grid letters, which give each button its cell on the 5 x 3 card (the printed key may differ).
  const withTable = (keys) => { for (const k of Object.keys(keys)) if (hotkeys?.[k]) keys[k] = hotkeys[k]; return keys; };
  const buildKeys = withTable(assignHotkeys(buildKinds));
  const keyForKind = (kinds) => withTable(assignHotkeys(kinds));
  // One card button: its slot (what it does), the key it prints and presses, and its cell (the grid letter).
  const btn = (slot, fields, fallback = LEGACY_KEYS[slot]) => {
    const key = hotkeys?.[slot] ?? fallback;
    return { slot, key, pos: grid?.[slot] ?? key, ...fields };
  };
  // A command the sim does not have yet: greyed on its cell, with the word 'coming' on hover; a press says so.
  const soon = (slot, label, what) => btn(slot, { label, action: 'soon', coming: `Coming: ${what}` });

  const ui = {
    side,
    selection: [],                    // ids, in the order selected
    groups: {},                       // '1'..'9' -> [ids]
    stationSel: [],                   // ids of the selected Power Stations (Toaster Wars)
    mode: null,                       // null | { type: 'amove' | 'move' | 'rally' } | { type: 'place', kind }
    lastGroupKey: null, lastGroupAt: -Infinity,
    lastClickId: null, lastClickAt: -Infinity,
    cycleIdx: -1,                     // Backspace: the index of the last base it jumped to (Power Strip, then Toasters)
    tab: null,                        // Tab: { base: [unit ids], idx, shown } while cycling the types of a selection
    alert: null,                      // { x, y, text, tick } for Space
    alertHistory: [],                 // earlier alerts for Space cycling
    alertCycle: -1,                   // index in alertHistory; -1 means showing the current alert
    message: null,                    // { text, until } short toast for the page
    plans: new Map(),                 // unit id -> { queue, cur, hold, issuedAt, tries }
    rally: new Map(),                 // structure id -> { type: 'move' | 'gather', x, y }
    known: null,                      // unit ids seen so far (for rally)
    outbox: [],                       // one-shot commands (train, build) sent on the next tick
    firsts: { slice: false, power: false }, // Toaster Wars: the one-time kitchen toasts have fired
  };

  /** Toaster Wars only: why a card entry is locked for this side right now (the tier, then the Wheat), or null when open. */
  function lockReason(state, entry) {
    if (!stations) return null;
    if (researchIdOf(entry.action)) return entry.reason ?? null; // research-card.mjs already judged the tier, the Wheat and the Flour
    if (entry.kind && (entry.action === 'build' || entry.action === 'train')) {
      const tier = kitchenLockReason(state, side, entry.kind);
      if (tier) return tier;
      const flour = flourCostOf(entry.kind);
      if (flour > 0 && state.noTiers && (state.toast?.pantry?.[side]?.flour ?? 0) < flour) return `Not enough Flour (${flour})`;
    }
    if (entry.cost !== undefined && (state.shards?.[side] ?? 0) < entry.cost) return `Not enough Wheat (${entry.cost})`;
    return null;
  }

  const toast = (text) => { ui.message = { text }; };

  function mine(state) {
    const m = entityMap(state);
    ui.selection = ui.selection.filter((id) => m.has(id));
    return ui.selection.map((id) => m.get(id));
  }
  function selectedUnits(state) { return mine(state).filter((e) => !isStructure(state, e) && e.owner === side); }
  function selectedStructures(state) { return mine(state).filter((e) => isStructure(state, e) && e.owner === side); }

  // Selection --------------------------------------------------------------------------------------------------
  function setSelection(ids, add = false, cap = MAX_SELECT) {
    const next = add ? [...ui.selection] : [];
    for (const id of ids) if (!next.includes(id)) next.push(id);
    ui.selection = next.slice(0, cap);
  }

  /** Left click on the world. `target` is the entity under the cursor or null. dblKey is `now` for double-click. */
  function clickSelect(state, project, size, target, { shift = false, ctrl = false, now = 0 } = {}) {
    if (!target) { if (!shift) ui.selection = []; return; }
    const double = ui.lastClickId === target.id && now - ui.lastClickAt < DOUBLE_MS;
    ui.lastClickId = target.id; ui.lastClickAt = now;
    // Double-click or Ctrl+click: every unit of that type on screen (B2).
    if ((double || ctrl) && target.owner === side && !isStructure(state, target)) {
      const rect = { x0: 0, y0: 0, x1: size.width, y1: size.height };
      const same = boxEntities(state, project, rect, side, 999).filter((u) => u.kind === target.kind);
      setSelection(same.map((u) => u.id), shift, Infinity);
      return;
    }
    if (shift && target.owner === side && !isStructure(state, target)) {
      const has = ui.selection.includes(target.id);
      ui.selection = has ? ui.selection.filter((id) => id !== target.id) : [...ui.selection, target.id].slice(0, MAX_SELECT);
      return;
    }
    setSelection([target.id]);
  }

  /** My buildings whose tile falls inside the box on screen (B2: a box with no unit in it takes the building). */
  function boxStructures(state, project, rect) {
    const x0 = Math.min(rect.x0, rect.x1), x1 = Math.max(rect.x0, rect.x1);
    const y0 = Math.min(rect.y0, rect.y1), y1 = Math.max(rect.y0, rect.y1);
    return state.structures.filter((s) => {
      if (s.owner !== side || !(s.hp > 0)) return false;
      const p = project(s.x, s.y);
      return p.sx >= x0 && p.sx <= x1 && p.sy >= y0 && p.sy <= y1;
    }).map((s) => s.id);
  }

  function boxSelect(state, project, rect, { shift = false } = {}) {
    let ids = boxEntities(state, project, rect, side).map((u) => u.id);
    if (!ids.length) ids = boxStructures(state, project, rect).slice(0, MAX_SELECT);
    if (!ids.length && !shift) { ui.selection = []; return; }
    setSelection(ids, shift);
  }

  // Control groups ---------------------------------------------------------------------------------------------
  function setGroup(n, state) { ui.groups[n] = selectedUnits(state).concat(selectedStructures(state)).map((e) => e.id); }
  /** Alt+number (B1): the group takes the selection, and those units leave every other group. */
  function stealGroup(n, state) {
    setGroup(n, state);
    const taken = new Set(ui.groups[n]);
    for (const g of Object.keys(ui.groups)) if (g !== String(n)) ui.groups[g] = ui.groups[g].filter((id) => !taken.has(id));
  }
  function recallGroup(n, state, now) {
    const m = entityMap(state);
    const ids = (ui.groups[n] ?? []).filter((id) => m.has(id));
    ui.groups[n] = ids;
    if (!ids.length) return null;
    ui.selection = ids.slice(0, MAX_SELECT);
    const twice = ui.lastGroupKey === n && now - ui.lastGroupAt < DOUBLE_MS;
    ui.lastGroupKey = n; ui.lastGroupAt = now;
    if (!twice) return null;
    const es = ids.map((id) => m.get(id));
    return { x: es.reduce((a, e) => a + e.x, 0) / es.length, y: es.reduce((a, e) => a + e.y, 0) / es.length };
  }

  /** Shift+digit: add group n to the selection (an empty group says so and keeps the selection). */
  function addGroup(n, state) {
    const m = entityMap(state);
    const ids = (ui.groups[n] ?? []).filter((id) => m.has(id));
    ui.groups[n] = ids;
    if (!ids.length) { toast(`Group ${n} is empty`); return; }
    setSelection(ids, true);
  }

  // Orders (plans) ---------------------------------------------------------------------------------------------
  function planOf(id) {
    let p = ui.plans.get(id);
    if (!p) ui.plans.set(id, (p = { queue: [], cur: null, hold: false, issuedAt: -1, tries: 0, loop: null }));
    return p;
  }
  function give(ids, orderFor, shift) {
    for (const id of ids) {
      const order = orderFor(id);
      if (!order) continue;
      const p = planOf(id);
      p.hold = false;
      p.loop = null; // a new order ends a patrol
      if (shift && (p.cur || p.queue.length)) p.queue.push(order);
      else { p.queue = [order]; p.cur = null; p.tries = 0; }
    }
  }

  /** Right click. `target` = { x, y (tile), entity?: picked entity }. Shift queues instead of replacing. */
  function rightClick(state, target, { shift = false } = {}) {
    ui.mode = null;
    const units = selectedUnits(state);
    const structs = selectedStructures(state);
    const e = target.entity ?? null;
    if (!units.length && structs.length) { // buildings: right-click sets the rally point
      for (const s of structs) setRally(state, s, target);
      return { kind: 'rally' };
    }
    if (!units.length) return { kind: 'none' };
    const ids = units.map((u) => u.id);
    if (e && e.owner !== side) { give(ids, () => ({ type: 'attack', target: e.id }), shift); return { kind: 'attack', target: e.id }; }
    // B2: right-click a friendly unit (not one of the selected) to follow it.
    if (e && !isStructure(state, e) && !ids.includes(e.id)) { give(ids, () => ({ type: 'follow', target: e.id }), shift); return { kind: 'follow', target: e.id }; }
    const crystal = crystalAt(state, target.x, target.y);
    if (crystal) {
      const m = new Map(units.map((u) => [u.id, u]));
      give(ids, (id) => (m.get(id).kind === 'worker' ? { type: 'gather', x: crystal.x, y: crystal.y } : { type: 'move', x: target.x, y: target.y }), shift);
      return { kind: 'gather' };
    }
    spreadMove(state, units, target, 'move', shift);
    return { kind: 'move' };
  }

  function spreadMove(state, units, target, type, shift) {
    const tiles = assignTiles(units, spreadTiles(state, target.x, target.y, units.length));
    give(units.map((u) => u.id), (id) => { const t = tiles.get(id) ?? target; return { type, x: t.x, y: t.y }; }, shift);
  }

  function setRally(state, s, target) {
    const crystal = crystalAt(state, target.x, target.y);
    ui.rally.set(s.id, crystal ? { type: 'gather', x: crystal.x, y: crystal.y } : { type: 'move', x: target.x, y: target.y });
    toast(crystal ? 'Rally: mine here' : 'Rally point set');
  }

  /** Left click while a mode is armed (attack-move, move, rally, place). Returns true when it used the click. */
  /** Patrol: the units walk to the clicked point and back to where they stand now, and keep doing it until a new order. */
  function patrolTo(state, units, target) {
    const tiles = assignTiles(units, spreadTiles(state, target.x, target.y, units.length));
    for (const u of units) {
      const t = tiles.get(u.id) ?? target;
      const loop = [{ type: 'amove', x: t.x, y: t.y }, { type: 'amove', x: Math.round(u.x), y: Math.round(u.y) }];
      const p = planOf(u.id);
      p.hold = false; p.cur = null; p.tries = 0;
      p.queue = loop.map((o) => ({ ...o }));
      p.loop = loop;
    }
  }

  /** Gather: a click on a crystal sends the Crumbs there (they mine it); a click on open ground keeps the mode armed. */
  function gatherClick(state, target, shift) {
    const crystal = crystalAt(state, target.x, target.y);
    if (!crystal) { toast('Click a crystal to gather'); return true; }
    const workers = selectedUnits(state).filter((u) => u.kind === 'worker');
    give(workers.map((u) => u.id), () => ({ type: 'gather', x: crystal.x, y: crystal.y }), shift);
    ui.mode = shift ? ui.mode : null;
    return true;
  }

  function repairClick(state, target, shift) {
    const building = target.entity;
    if (!building || !building.hp) { toast('Click a building to repair'); return true; }
    const workers = selectedUnits(state).filter((u) => u.kind === 'worker');
    for (const u of workers) ui.outbox.push({ type: 'repair', unit: u.id, target: building.id });
    ui.mode = shift ? ui.mode : null;
    return true;
  }

  function modeClick(state, target, { shift = false } = {}) {
    const mode = ui.mode;
    if (!mode) return false;
    if (mode.type === 'place') return place(state, target, shift);
    if (mode.type === 'gather') return gatherClick(state, target, shift);
    if (mode.type === 'repair') return repairClick(state, target, shift);
    ui.mode = shift && mode.type !== 'rally' ? mode : null;
    const units = selectedUnits(state);
    if (mode.type === 'rally') { for (const s of selectedStructures(state)) setRally(state, s, target); return true; }
    if (!units.length) return true;
    if (mode.type === 'patrol') { patrolTo(state, units, target); return true; }
    if (mode.type === 'amove') {
      if (target.entity && target.entity.owner !== side) { give(units.map((u) => u.id), () => ({ type: 'attack', target: target.entity.id }), shift); return true; }
      spreadMove(state, units, target, 'amove', shift);
    } else spreadMove(state, units, target, 'move', shift);
    return true;
  }

  function place(state, target, shift) {
    const { kind } = ui.mode;
    const chk = placeCheck(state, stats, side, kind, target.x, target.y, placeContext ? placeContext() : null);
    if (!chk.ok) { toast(reasonText(chk.reason, { need: stats.structures[kind]?.cost ?? stationCost(kind) })); return true; }
    const station = stations && isStationKind(kind);
    const workers = selectedUnits(state).filter((u) => u.kind === 'worker');
    if (!workers.length) { ui.mode = null; return true; }
    workers.sort((a, b) => dist(a, target) - dist(b, target) || a.id - b.id);
    const w = workers[0];
    const p = planOf(w.id);
    const order = { type: station ? 'station' : 'build', kind, x: target.x, y: target.y };
    p.hold = false;
    if (shift && (p.cur || p.queue.length)) p.queue.push(order); else { p.queue = [order]; p.cur = null; }
    if (!shift) ui.mode = null;
    return true;
  }

  // Keys -------------------------------------------------------------------------------------------------------
  function queueTrain(state, kind) {
    const structs = selectedStructures(state).filter((s) => s.complete && trainable(s).includes(kind));
    if (!structs.length) return false;
    structs.sort((a, b) => a.queue.length - b.queue.length || a.id - b.id); // shortest queue first
    // Check what the sim would check, so the player gets a reason instead of a silent reject.
    const cost = stats.units[kind]?.cost ?? 0;
    const pending = ui.outbox.filter((c) => c.type === 'train').reduce((n, c) => n + (c.kind === kind ? cost : (stats.units[c.kind]?.cost ?? 0)), 0);
    const supply = state.units.filter((u) => u.owner === side).length + state.structures.reduce((n, s) => n + (s.owner === side ? s.queue.length : 0), 0)
      + ui.outbox.filter((c) => c.type === 'train').length;
    if (state.shards[side] - pending < cost) { toast('Not enough wheat'); return true; }
    if (structs[0].queue.length >= (stats.match?.queueMax ?? 5)) { toast('Queue is full'); return true; }
    if (supply + 1 > (stats.match?.unitCap ?? 40)) { toast('Unit cap reached'); return true; }
    ui.outbox.push({ type: 'train', building: structs[0].id, kind });
    return true;
  }

  /** Fence the two picked Power Stations (the Box/Pylon card's A). Returns false when no station is picked. */
  function fencePicked(state) {
    if (!ui.stationSel.length) return false;
    const ids = [...ui.stationSel, ...selectedStructures(state).filter((s) => s.kind === 'core').map((s) => s.id)];
    const o = fenceOrder(state, ids);
    if (o.error) toast(o.error); else { ui.outbox.push(o.cmd); toast(o.text); }
    return true;
  }

  /** The command card for the current selection: [{ key, pos, label, kind, action, cost, locked, reason }]. */
  function commandCard(state) {
    const units = selectedUnits(state), structs = selectedStructures(state);
    // Row 1 is the same on every card (SYSTEMS-DESIGN.md section 4): Move, Stop, Hold, Patrol, Attack-move.
    const card = ROW1.map(([slot, label, action]) => btn(slot, { label, action }));
    if (units.length) {
      if (units.some((u) => u.kind === 'worker')) {
        for (const kind of buildKinds) card.push(btn(kind, { label: kind, kind, action: 'build', cost: stats.structures[kind].cost }, buildKeys[kind]));
        if (stations) {
          for (const kind of STATION_KINDS) card.push(btn(kind, { label: kind, kind, action: 'build', cost: stationCost(kind) }, STATION_KEYS[kind]));
          card.push(btn('gather', { label: 'Gather', action: 'gather' }));
          card.push(btn('repair', { label: 'Repair', action: 'repair' }, 'u'));
        }
      } else if (stations) { // fighters: the extras their kinds have (commands the sim lacks show as coming)
        if (units.some((u) => u.kind === 'dart')) card.push(soon('roll', 'Roll', 'Bagel rolls: no command yet'));
        else card.push(soon('resupply', 'Resupply', 'resupply from the bakery: no command yet'));
        if (units.some((u) => u.kind === 'brute')) card.push(soon('shove', 'Shove', 'Four-Slice shove: no command yet'));
      }
    } else if (structs.length) {
      // Toaster Wars shows one kind of building at a time, so one key never names two things.
      const same = stations ? structs.filter((s) => s.kind === structs[0].kind) : structs;
      const kinds = [...new Set(same.flatMap((s) => (s.complete ? trainable(s) : [])))];
      const keys = keyForKind(kinds);
      for (const kind of kinds) card.push(btn(kind, { label: kind, kind, action: 'train', cost: stats.units[kind]?.cost }, keys[kind]));
      if (structs.some((s) => !s.complete)) card.push(btn('cancelBuild', { label: 'Cancel', action: 'cancel-build' }, 'x')); // a site: refund 75% (Construction)
      if (!stations) card.push(btn('rally', { label: 'Rally', action: 'rally' }, 'r'));
      else if (structs[0].kind === 'core') { card.push(btn('rally', { label: 'Rally', action: 'rally' })); card.push(soon('pilot', 'Pilot', 'the pilot light is automatic: no on/off yet')); }
      else if (structs[0].kind === 'forge') card.push(btn('lineRally', { label: 'Rally', action: 'rally' }));
      else if (structs[0].kind === 'turret') card.push(soon('priority', 'Target', 'Heat Lamp target priority: no command yet'));
      else if (['mill', 'well', 'toaster'].includes(structs[0].kind)) {
        card.push(soon('rings', 'Rings', 'show the well rings on the field: no toggle yet'), soon('pause', 'Pause', 'pause production: no command yet'));
      }
      if (stations && structs.some((s) => s.complete)) card.push(...toasterResearchEntries(state, side, structs[0].kind)); // Wheat + Flour upgrades
    } else if (stations && ui.stationSel.length) { // a Power Station pair (Box or Pylon): fence on/off, unplug
      card.push(btn('fence', { label: 'Fence', action: 'fence' }), soon('unplug', 'Unplug', 'unplug a station: no command yet'));
    }
    // Toaster Wars: a locked entry stays on the card with its key; `locked` greys it and `reason` is its tooltip line.
    if (!stations) return card;
    return card.map((e) => {
      const reason = e.coming ?? lockReason(state, e);
      return reason ? { ...e, locked: true, reason } : { ...e, locked: false };
    });
  }

  /** Run a command-card action (also what a button click does). Returns an effect for the page or null. */
  function act(state, action, kind) {
    const units = selectedUnits(state);
    const entry = stations && (action === 'build' || action === 'train') ? commandCard(state).find((e) => e.action === action && e.kind === kind) : null;
    if (entry?.locked) { toast(entry.reason); return null; }
    const researchId = researchIdOf(action);
    if (researchId) { // an upgrade button: the selected building that researches it, shortest queue first
      const e = commandCard(state).find((x) => x.action === action);
      if (!e) return null;
      if (e.locked) { toast(e.reason); return null; }
      const homes = selectedStructures(state).filter((s) => s.complete && s.kind === researchRow(researchId)?.building);
      homes.sort((a, b) => (a.research?.length ?? 0) - (b.research?.length ?? 0) || a.id - b.id);
      if (!homes.length) return null;
      ui.outbox.push({ type: 'research', building: homes[0].id, upgrade: researchId });
      toast(researchQueuedText(researchId));
      return null;
    }
    switch (action) {
      case 'amove': if (units.length) ui.mode = { type: 'amove' }; return null;
      case 'move': if (units.length) ui.mode = { type: 'move' }; return null;
      case 'patrol': if (units.length) ui.mode = { type: 'patrol' }; return null;
      case 'gather': if (units.some((u) => u.kind === 'worker')) ui.mode = { type: 'gather' }; return null;
      case 'repair': if (units.some((u) => u.kind === 'worker')) ui.mode = { type: 'repair' }; return null;
      case 'rally': if (selectedStructures(state).length) ui.mode = { type: 'rally' }; return null;
      case 'fence': fencePicked(state); return null;
      case 'cancel-build': // Construction: each selected site of mine goes; finished buildings are not offered this button
        for (const s of selectedStructures(state)) if (!s.complete) ui.outbox.push({ type: 'cancel-build', building: s.id });
        return null;
      case 'soon': toast('Coming soon: that command is not in the game yet'); return null;
      case 'stop':
        for (const u of units) { const p = planOf(u.id); p.queue = []; p.cur = null; p.hold = false; p.loop = null; ui.outbox.push({ type: 'stop', unit: u.id }); }
        return null;
      case 'hold':
        for (const u of units) { const p = planOf(u.id); p.queue = []; p.cur = null; p.hold = true; p.loop = null; ui.outbox.push({ type: 'stop', unit: u.id }); }
        return null;
      case 'build':
        if (!units.some((u) => u.kind === 'worker')) return null;
        if (state.shards[side] < (stations && isStationKind(kind) ? stationCost(kind) : stats.structures[kind].cost)) { toast('Not enough wheat'); return null; }
        ui.mode = { type: 'place', kind }; return null;
      case 'train':
        if (!queueTrain(state, kind)) toast('Cannot train that here');
        return null;
      default: return null;
    }
  }

  // Global keys (SYSTEMS-DESIGN.md section 4) ----------------------------------------------------------------------
  /** F2 (fighters, no cap, B2) and F3 (Crumbs, capped at MAX_SELECT): every unit of mine that passes `want`; Shift adds. */
  function selectWhere(state, want, what, shift, { cap = MAX_SELECT } = {}) {
    const found = state.units.filter((u) => u.owner === side && u.hp > 0 && want(u));
    if (!found.length) { toast(`No ${what} of yours`); return null; }
    const ids = found.map((u) => u.id);
    ui.selection = shift ? [...new Set([...ui.selection, ...ids])] : ids;
    ui.selection = ui.selection.slice(0, cap);
    ui.stationSel = [];
    if (found.length > cap) toast(`Selected ${cap} of ${found.length} (a selection holds ${cap})`);
    return null;
  }

  /** Ctrl+F1 (B2): every idle Crumb is selected at once; the camera stays put. */
  function selectIdle(state, idleIds) {
    if (!idleIds.length) { toast('No idle Crumbs'); return null; }
    ui.selection = idleIds.slice();
    ui.stationSel = [];
    return null;
  }

  /** Backspace: the Power Strip, then each Toaster of mine, one per press. The camera jumps to it and it is selected. */
  function cycleBases(state) {
    const mine = state.structures.filter((s) => s.owner === side && s.hp > 0 && (s.kind === 'core' || s.kind === 'toaster'));
    const list = [...mine.filter((s) => s.kind === 'core'), ...mine.filter((s) => s.kind === 'toaster')];
    if (!list.length) { toast('No Power Strip or Toaster of yours'); return null; }
    ui.cycleIdx = (ui.cycleIdx + 1) % list.length;
    const s = list[ui.cycleIdx];
    ui.selection = [s.id];
    ui.stationSel = [];
    return { center: { x: s.x, y: s.y } };
  }

  /** Tab: the unit types inside the selection, one type per press (the selection narrows to that type). A new selection restarts it. */
  function cycleTypes(state) {
    const shown = ui.selection.join(',');
    if (!ui.tab || ui.tab.shown !== shown) ui.tab = { base: selectedUnits(state).map((u) => u.id), idx: -1, shown: null };
    const m = entityMap(state);
    const units = ui.tab.base.map((id) => m.get(id)).filter((u) => u && u.owner === side && !isStructure(state, u));
    const kinds = [...new Set(units.map((u) => u.kind))];
    if (!kinds.length) { ui.tab = null; return null; }
    const idx = (ui.tab.idx + 1) % kinds.length;
    ui.selection = units.filter((u) => u.kind === kinds[idx]).map((u) => u.id);
    ui.tab = { base: ui.tab.base, idx, shown: ui.selection.join(',') };
    return null;
  }

  /** Shift+digit reports the symbol on a US keyboard (Shift+1 is '!'); read it as its digit. */
  const SHIFT_DIGIT = Object.freeze({ ')': '0', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8', '(': '9' });

  /** A key press. Returns { center: {x, y} } when the camera should move, else null. */
  function key(state, k, { ctrl = false, shift = false, alt = false, now = 0, idleIds = [] } = {}) {
    if (shift && SHIFT_DIGIT[k]) k = SHIFT_DIGIT[k];
    k = k.length === 1 ? k.toLowerCase() : k;
    if (k === 'Escape') { ui.mode = null; return null; }
    if (/^[0-9]$/.test(k)) {
      if (alt) { stealGroup(k, state); toast(`Group ${k} set (taken from other groups)`); return null; }
      if (ctrl) { setGroup(k, state); toast(`Group ${k} set`); return null; }
      if (shift) { addGroup(k, state); return null; }
      const c = recallGroup(k, state, now);
      return c ? { center: c } : null;
    }
    if (k === 'F2') return selectWhere(state, (u) => u.kind !== 'worker', 'fighters', shift, { cap: Infinity });
    if (k === 'F3') return selectWhere(state, (u) => u.kind === 'worker', 'Crumbs', shift);
    if (k === 'F1' && ctrl) return selectIdle(state, idleIds);
    if (k === 'Backspace') return cycleBases(state);
    if (k === 'Tab') return cycleTypes(state);
    if (k === ' ') {
      if (!ui.alert && !ui.alertHistory.length) return null;
      if (ui.alertCycle < 0 && ui.alert) { ui.alertCycle = -1; return { center: { x: ui.alert.x, y: ui.alert.y } }; }
      if (ui.alertHistory.length === 0) return null;
      ui.alertCycle = (ui.alertCycle + 1) % ui.alertHistory.length;
      const prev = ui.alertHistory[ui.alertCycle];
      return { center: { x: prev.x, y: prev.y } };
    }
    // F is the Assembly Line on the card now; with two Power Stations picked it still fences (the old key, not printed).
    if (stations && k === 'f' && fencePicked(state)) return null;
    if (ctrl && /^[a-z]$/.test(k)) return null; // Ctrl or Cmd + letter is the browser's (Ctrl+R, Ctrl+W, Ctrl+T), not a card key
    const card = commandCard(state);
    const hit = card.find((c) => c.key === k);
    if (hit) return act(state, hit.action, hit.kind);
    return null;
  }

  // Alerts ---------------------------------------------------------------------------------------------------------
  function addToAlertHistory(alert) {
    ui.alertHistory.push(alert);
    if (ui.alertHistory.length > 10) ui.alertHistory.shift();
    ui.alertCycle = -1;
  }

  function noteEvents(state, events) {
    const m = entityMap(state);
    for (const ev of events) {
      if (ev.e === 'reject' && ev.player === side && stations) {
        const text = rejectText(ev);
        if (text) toast(text);
        if (ev.reason === 'no-tier' || ev.reason === 'no-flour') toast(ev.reason === 'no-tier' ? 'Not unlocked yet' : 'Not enough Flour');
      } else if (stations && ev.e === 'bake' && ev.player === side && !ev.pilot && !ui.firsts.slice) {
        ui.firsts.slice = true; toast(KITCHEN_OPEN_TEXT);
      } else if (stations && ev.e === 'place-power' && ev.point?.owner === side && (ev.point.kind === 'windmill' || ev.point.kind === 'dam') && !ui.firsts.power) {
        ui.firsts.power = true; toast(POWER_UP_TEXT);
      } else if (ev.e === 'hit') {
        const t = m.get(ev.id);
        if (t && t.owner === side) {
          const alert = { x: t.x, y: t.y, text: `${kindName(t.kind)} under attack`, tick: state.tick };
          ui.alert = alert;
          addToAlertHistory(alert);
        }
      } else if (ev.e === 'done') {
        const t = m.get(ev.id);
        if (t && t.owner === side) {
          const alert = { x: t.x, y: t.y, text: 'Construction complete', tick: state.tick };
          ui.alert = alert;
          addToAlertHistory(alert);
        }
      } else if (ev.e === 'power-down' && ev.player === side) {
        const t = m.get(ev.id);
        if (t) {
          const alert = { x: t.x, y: t.y, text: `${kindName(t.kind)} lost power`, tick: state.tick };
          ui.alert = alert;
          addToAlertHistory(alert);
        }
      } else if (ev.e === 'hungry' && ev.player === side) {
        const t = m.get(ev.id);
        if (t) {
          const alert = { x: t.x, y: t.y, text: `${kindName(t.kind)} out of toast`, tick: state.tick };
          ui.alert = alert;
          addToAlertHistory(alert);
        }
      }
    }
  }

  // Per-tick driver --------------------------------------------------------------------------------------------
  function nearestEnemy(state, u, radius, { threatsFirst = true } = {}) {
    let best = null, bd = Infinity;
    const consider = (e, bias) => {
      if (e.owner === side) return;
      const d = dist(u, e);
      if (d > radius) return;
      if (d + bias < bd) { best = e; bd = d + bias; }
    };
    for (const e of state.units) consider(e, threatsFirst && e.kind === 'worker' ? 3 : 0);
    for (const e of state.structures) consider(e, 6);
    return best;
  }

  function cmdFor(u, order) {
    switch (order.type) {
      case 'move': case 'amove': return { type: 'move', unit: u.id, x: order.x, y: order.y };
      case 'attack': return { type: 'attack', unit: u.id, target: order.target };
      case 'gather': return { type: 'gather', unit: u.id, x: order.x, y: order.y };
      case 'build': return { type: 'build', unit: u.id, kind: order.kind, x: order.x, y: order.y };
      case 'station': return null; // walked up to and placed by tick()
      default: return null;
    }
  }

  /** Click on open ground: select the station there (shift adds). Returns true when a station was hit. */
  function selectStation(state, x, y, shift = false) {
    if (!stations) return false;
    const id = pickStation(state, side, x, y);
    if (id === null) { if (!shift) ui.stationSel = []; return false; }
    if (!shift) ui.selection = [];
    ui.stationSel = shift ? (ui.stationSel.includes(id) ? ui.stationSel.filter((q) => q !== id) : [...ui.stationSel, id].slice(-2)) : [id];
    return true;
  }

  function tick(state) {
    const out = ui.outbox.splice(0);
    const m = entityMap(state);
    const rangeOf = (u) => (rowOf ? rowOf(state, u.kind) : stats.units[u.kind])?.range ?? 1;

    // Rally: units that appeared since the last tick head for their building's rally point. A Power Strip's rally is 'auto':
    // the least-loaded Wheat tile in cord reach, picked when the Crumb appears (the same pick as the sim's gather 'auto').
    if (ui.known === null) {
      ui.known = new Set(state.units.map((u) => u.id));
      for (const s of state.structures) if (s.owner === side && s.kind === 'core' && !ui.rally.has(s.id)) ui.rally.set(s.id, { type: 'gather', auto: true });
    }
    // `state` here is the observation, which has no rocks: a rock beside a field counts as open (the sim's pick sees them).
    const autoTile = (u) => pickWheatTile({ unit: u, crystals: state.crystals, units: state.units,
      passable: (x, y) => !state.crystals.some((c) => c.x === x && c.y === y) && !state.structures.some((s) => s.x === x && s.y === y),
      points: [...state.structures.filter((s) => s.owner === side && s.kind === 'core' && s.hp > 0), ...(state.power?.points ?? []).filter((p) => p.owner === side)] });
    for (const u of state.units) {
      if (ui.known.has(u.id)) continue;
      ui.known.add(u.id);
      if (u.owner !== side) continue;
      const home = state.structures.filter((s) => s.owner === side && ui.rally.has(s.id) && dist(s, u) <= 2).sort((a, b) => dist(a, u) - dist(b, u) || a.id - b.id)[0];
      const r = home && ui.rally.get(home.id);
      if (!r) continue;
      const at = () => (r.auto ? autoTile(u) : r);
      if (r.type === 'gather' && u.kind === 'worker') give([u.id], () => { const t = at(); return t && { type: 'gather', x: t.x, y: t.y }; }, false);
      else if (r.type === 'move' || r.type === 'gather') give([u.id], () => { const t = at(); return t && { type: 'move', x: t.x, y: t.y }; }, false);
    }

    for (const [id, p] of [...ui.plans]) {
      const u = m.get(id);
      if (!u || isStructure(state, u)) { ui.plans.delete(id); continue; }
      const idle = u.order === null && p.issuedAt < state.tick;
      // Follow (B2): take the next follow order, then walk to the target's tile whenever idle and more than 2 tiles away.
      if (!p.cur && p.queue[0]?.type === 'follow') p.cur = p.queue.shift();
      if (p.cur && p.cur.type === 'follow') {
        const t = m.get(p.cur.target);
        if (!t) { p.cur = null; }
        else { if (idle && dist(u, t) > 2) { out.push({ type: 'move', unit: id, x: Math.round(t.x), y: Math.round(t.y) }); p.issuedAt = state.tick; } continue; }
      }
      if (p.hold) {
        const r = rangeOf(u);
        if (u.order === null) {
          const foe = nearestEnemy(state, u, r);
          if (foe) { out.push(cmdFor(u, { type: 'attack', target: foe.id })); p.issuedAt = state.tick; }
        } else if (u.order.type === 'attack') {
          const t = m.get(u.order.target);
          if (!t || dist(u, t) > r) { out.push({ type: 'stop', unit: id }); p.issuedAt = state.tick; }
        }
        continue;
      }
      if (p.cur && p.cur.type === 'station') {
        const o = p.cur;
        if (dist(u, o) <= 1 && !(u.x === o.x && u.y === o.y)) { out.push({ type: 'place-power', unit: id, kind: o.kind, x: o.x, y: o.y }); p.cur = null; p.issuedAt = state.tick; }
        else if (idle) {
          if (p.tries++ >= 8) p.cur = null;
          else { out.push({ type: 'move', unit: id, x: o.x + Math.sign(u.x - o.x), y: o.y + Math.sign(u.y - o.y) }); p.issuedAt = state.tick; }
        }
        continue;
      }
      // Finish the current order when its unit goes idle.
      if (p.cur && idle) {
        if (p.cur.type === 'amove') {
          if (dist(u, p.cur) <= 0 || p.tries >= 4) { p.cur = null; }
        } else p.cur = null;
      }
      if (p.cur && p.cur.type === 'amove') {
        // Attack-move: look for enemies each tick; otherwise keep walking to the destination.
        const attacking = u.order && u.order.type === 'attack';
        if (!attacking) {
          const foe = nearestEnemy(state, u, Math.max(ACQUIRE, rangeOf(u) + 2));
          if (foe) { out.push(cmdFor(u, { type: 'attack', target: foe.id })); p.issuedAt = state.tick; p.tries = 0; continue; }
          if (idle) { out.push(cmdFor(u, p.cur)); p.issuedAt = state.tick; p.tries++; }
        }
        continue;
      }
      if (!p.cur && !p.queue.length && idle && p.loop) p.queue = p.loop.map((o) => ({ ...o })); // patrol: go round again
      if (!p.cur && p.queue.length) {
        p.cur = p.queue.shift();
        p.tries = 0;
        const c = cmdFor(u, p.cur);
        if (c) { out.push(c); p.issuedAt = state.tick; }
        if (p.cur.type === 'amove') p.tries = 1;
      }
      if (!p.cur && !p.queue.length && idle) ui.plans.delete(id);
    }
    return out.slice(0, stats.match?.maxCommandsPerTick ?? 100);
  }

  return {
    ui, commandCard, act, key, tick, noteEvents, mine,
    clickSelect, boxSelect, rightClick, modeClick, setGroup, recallGroup, selectedUnits, selectedStructures,
    setMode: (mode) => { ui.mode = mode; },
    placeCheck: (state, kind, x, y) => placeCheck(state, stats, side, kind, x, y, placeContext ? placeContext() : null),
    pickStation: (state, x, y, shift = false) => selectStation(state, x, y, shift),
    takeMessage: () => { const m = ui.message; ui.message = null; return m; },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Pointer feel: click-in capture (Pointer Lock) with an in-game cursor, edge pushing that survives leaving the window,
// middle-drag pan, and a fullscreen toggle (F11 or the corner button). Everything is injected (win, doc, overlay, rig)
// so node tests run it against fakes. Returns { rel(e), toggleFullscreen }: rel(e) is the cursor in overlay pixels
// (the virtual cursor while locked), so the page's click handlers keep working unchanged.
// ---------------------------------------------------------------------------------------------------------------
export function installPointerControls({ win, doc, overlay, rig, lock = true }) {
  let last = { x: 0, y: 0 };
  let panning = false;
  let downEl = null;
  const rel = (e) => {
    if (rig.locked && rig.cursor) return { x: rig.cursor.x, y: rig.cursor.y };
    const r = overlay.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // The in-game cursor, shown only while the pointer is locked (the system cursor is hidden then).
  const cursorEl = doc.createElement('div');
  Object.assign(cursorEl.style, { position: 'fixed', left: '0', top: '0', width: '24px', height: '24px', pointerEvents: 'none', zIndex: '60', display: 'none' });
  cursorEl.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M2 2 L2 19 L7 14.5 L10.5 22 L13.5 20.6 L10.2 13.4 L17 13 Z" fill="#33e0ff" stroke="#0b0918" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  doc.body.append(cursorEl);
  const placeCursor = () => { if (rig.cursor) cursorEl.style.transform = `translate(${rig.cursor.x}px, ${rig.cursor.y}px)`; };

  // Fullscreen: F11 or the corner button.
  const toggleFullscreen = () => {
    const p = doc.fullscreenElement ? doc.exitFullscreen?.() : doc.documentElement.requestFullscreen?.();
    p?.catch?.(() => {});
  };
  const fsButton = doc.createElement('button');
  fsButton.textContent = '⛶';
  fsButton.title = 'Fullscreen (F11)';
  Object.assign(fsButton.style, { position: 'fixed', right: '10px', top: '8px', zIndex: '40', font: 'inherit', color: '#e8e4f4', background: '#26223ccc', border: '1px solid #4a4568', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer' });
  fsButton.addEventListener('click', toggleFullscreen);
  doc.body.append(fsButton);
  win.addEventListener('keydown', (e) => {
    if (e.key !== 'F11') return;
    e.preventDefault();
    toggleFullscreen();
  });

  // Click-in capture; Esc is the browser's own release.
  doc.addEventListener('pointerlockchange', () => {
    if (doc.pointerLockElement === overlay) { rig.lock(last.x, last.y); cursorEl.style.display = 'block'; placeCursor(); }
    else { rig.unlock(); cursorEl.style.display = 'none'; }
  });
  overlay.addEventListener('mousedown', (e) => {
    if (e.button === 1) { e.preventDefault?.(); panning = true; return; }
    last = rel(e);
    if (e.button === 0 && lock && !rig.locked) {
      try { overlay.requestPointerLock?.()?.catch?.(() => {}); } catch { /* the browser refused; try again on the next click */ }
    }
  });

  win.addEventListener('mousemove', (e) => {
    if (rig.locked) { rig.moveCursor(e.movementX || 0, e.movementY || 0); placeCursor(); }
    else {
      last = rel(e);
      // No edge push while the pointer is over a button or control (the Menu and fullscreen buttons sit in the top-right
      // corner, so reaching for them used to slide the camera to the top right).
      const t = e.target; const onControl = t && t !== overlay && t.closest?.('button, input, select, a, #matchmenu');
      if (onControl) rig.mouse = null; else rig.setMouse(last.x, last.y);
    }
    if (panning) rig.dragBy(e.movementX || 0, e.movementY || 0);
  });
  win.addEventListener('mouseup', (e) => { if (e.button === 1) panning = false; });
  win.addEventListener('blur', () => { panning = false; });

  // Leaving the window STOPS edge panning (Joshua, 23 Oct: the camera kept 'dragging to the top right' after the
  // mouse left the game for the browser chrome or another pane). Edge-scroll only while the pointer is inside the game.
  doc.documentElement.addEventListener('mouseleave', () => { if (!rig.locked) rig.mouse = null; });
  win.addEventListener('blur', () => { if (!rig.locked) rig.mouse = null; });

  // While locked, real clicks land on the overlay; hand them to whatever HUD element is under the virtual cursor
  // (minimap, command card, buttons) as synthetic mouse events.
  const forward = (e) => {
    if (!rig.locked || !rig.cursor || e.isTrusted === false) return;
    if (e.type === 'mousedown') {
      const el = doc.elementFromPoint?.(rig.cursor.x, rig.cursor.y);
      downEl = el && el !== overlay ? el : null;
    }
    const target = downEl;
    if (!target) return;
    e.stopPropagation();
    const send = (type) => target.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: rig.cursor.x, clientY: rig.cursor.y, button: e.button, buttons: e.buttons, view: win }));
    send(e.type);
    if (e.type === 'mouseup') { send('click'); downEl = null; }
  };
  win.addEventListener('mousedown', forward, true);
  win.addEventListener('mouseup', forward, true);

  return { rel, toggleFullscreen };
}
