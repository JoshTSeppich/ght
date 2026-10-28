// Research and upgrades for Toaster Wars (build wave 2, card M3). Owner: sonnet (Research lead).
// Weapons and armor tracks 1 to 3 per layer are bought at the Assembly Line ('forge', ground and structure tracks) and the
// Cooling Rack (air tracks). Level 2 needs the Kitchen's tier 2 (a Toaster), level 3 tier 3 (a Windmill or Dam), and each
// level needs the one below it. Everything costs Wheat + Flour (decision 2); Flour is the Toasters' pantry flour.
//
//   upgradeLevel(state, player, track) -> 0..3         combat reads this (tracks: RESEARCH_TRACKS)
//   unitMod(state, player, kind, key)  -> number        the sum of a unit research's number, 0 when not researched
//   researchRow(id) / RESEARCH_ROWS                    the table (Wheat, Flour, seconds, ticks, building, tier, requires)
//   doToasterResearch(state, player, c) -> null | code  the 'research' command; stepToasterResearch(state) counts it down
//   researchLockReason(state, side, id) -> text | null  one line for the card: "Done", "Needs a Toaster", ...
//   flourCostOf(kind), flourReason / chargeFlour / refundFlour   Flour for tier 2 and 3 units and buildings
// The numbers live in STATS.research (env/stats.mjs); this file builds the rows from them.

import { STATS, secondsToTicks } from './stats.mjs';
import { emit } from './state.mjs';
import { canProgress } from './budget.mjs';

const R = STATS.research;
export const RESEARCH_TRACKS = Object.freeze(Object.keys(R.tracks));
export const TRACKS = RESEARCH_TRACKS; // the name the first stub exported
export const RESEARCH_QUEUE_MAX = R.queueMax;

function row(id, name, tier, building, [wheat, flour, seconds], effect, extra = {}) {
  return Object.freeze({ id, name, tier, building, cost: Object.freeze({ wheat, flour }), seconds, ticks: secondsToTicks(seconds), effect, ...extra });
}

const TRACK_ROWS = RESEARCH_TRACKS.flatMap((track) => {
  const info = R.tracks[track];
  return R.levelCost[info.kind].map((c, i) => row(`${track}-${i + 1}`, `${info.name} ${i + 1}`, i + 1, info.building, c, info.effect,
    { track, level: i + 1, ...(i > 0 ? { requires: `${track}-${i}` } : {}) }));
});

// Unit researches: a reason to field the dead-end units. `mods` are numbers the unit's code reads with unitMod().
const UNIT_ROWS = R.units.map((u) => row(u.id, u.name, u.tier, u.building, u.cost, u.effect, { unit: u.unit, mods: u.mods }));

export const RESEARCH_ROWS = Object.freeze([...TRACK_ROWS, ...UNIT_ROWS]);
const BY_ID = new Map(RESEARCH_ROWS.map((r) => [r.id, r]));
export const researchRow = (id) => BY_ID.get(id) ?? null;

// Flour for tier 2 and 3 kinds (decision 2). Basic kinds (Crumb, Mill, Well, Toaster, Heat Lamp, Windmill, Dam) cost Wheat only.
export const FLOUR_COST = R.flourCost;
export const flourCostOf = (kind) => FLOUR_COST[kind] ?? 0;

// ---------------------------------------------------------------------------------------------
// Flour
// ---------------------------------------------------------------------------------------------

/** Flour costs apply on the Toaster Wars rules (noTiers) when the pantry exists. */
export const flourOn = (state) => !!state.noTiers && !!state.toast?.pantry;
const pantry = (state, side) => state.toast.pantry[side];

/** 'no-flour' when this side's pantry cannot pay `amount`, else null. */
export const flourShort = (state, side, amount) => (flourOn(state) && amount > 0 && !(pantry(state, side).flour >= amount) ? 'no-flour' : null);
export const flourReason = (state, side, kind) => flourShort(state, side, flourCostOf(kind));
export function chargeFlour(state, side, amountOrKind) {
  const n = typeof amountOrKind === 'number' ? amountOrKind : flourCostOf(amountOrKind);
  if (flourOn(state) && n > 0) pantry(state, side).flour -= n;
}
export function refundFlour(state, side, kind) {
  const n = flourCostOf(kind);
  if (flourOn(state) && n > 0) pantry(state, side).flour += n;
}

// ---------------------------------------------------------------------------------------------
// Levels and unit numbers
// ---------------------------------------------------------------------------------------------

const doneOf = (state, player) => state?.research?.done?.[player] ?? [];

/** The level (0..3) a side has reached on a track. Reads state.research.done, so it works on any state; 0 without research. */
export function upgradeLevel(state, player, track) {
  const done = doneOf(state, player);
  let level = 0;
  for (let n = 1; n <= 3; n++) if (done.includes(`${track}-${n}`)) level = n;
  return level;
}

/** The sum of one number (key) from this side's finished unit researches for a kind. 0 when none. */
export function unitMod(state, player, kind, key) {
  let sum = 0;
  for (const id of doneOf(state, player)) {
    const r = BY_ID.get(id);
    if (r?.unit === kind && typeof r.mods?.[key] === 'number') sum += r.mods[key];
  }
  return sum;
}

// ---------------------------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------------------------

function tierNeedMet(state, side, tier) {
  const need = STATS.toasterTiers[tier]?.need;
  if (!need) return true;
  if (need === 'toaster') return state.structures.some((s) => s.owner === side && s.kind === 'toaster' && s.complete);
  const points = state.power?.points ?? state.power?.view?.points ?? [];
  return points.some((p) => p.owner === side && (p.kind === 'windmill' || p.kind === 'dam'));
}

const queuedAnywhere = (state, side, id) => state.structures.some((s) => s.owner === side && (s.research || []).some((r) => r.upgrade === id));

/** Returns null when queued, else the reject reason (a code the HUD maps to a line). */
export function doToasterResearch(state, player, c) {
  const building = typeof c.building === 'number' ? state.structures.find((s) => s.id === c.building) : undefined;
  if (!building) return 'bad-target';
  const up = typeof c.upgrade === 'string' ? researchRow(c.upgrade) : null;
  if (!up) return 'bad-target';
  if (building.owner !== player) return 'not-yours';
  if (building.kind !== up.building) return 'wrong-building';
  if (!building.complete) return 'not-complete';
  const done = doneOf(state, player);
  if (done.includes(up.id)) return 'already-done';
  if (queuedAnywhere(state, player, up.id)) return 'already-queued';
  if (up.requires && !done.includes(up.requires)) return 'needs-earlier';
  if (!tierNeedMet(state, player, up.tier)) return `needs-${STATS.toasterTiers[up.tier].need}`;
  if ((building.research || []).length >= RESEARCH_QUEUE_MAX) return 'queue-full';
  if (state.shards[player] < up.cost.wheat) return 'no-shards';
  const short = flourShort(state, player, up.cost.flour);
  if (short) return short;

  state.shards[player] -= up.cost.wheat;
  chargeFlour(state, player, up.cost.flour);
  emit(state, { e: 'spend', player, amount: up.cost.wheat, shards: state.shards[player] });
  (building.research ||= []).push({ upgrade: up.id, ticksLeft: up.ticks });
  emit(state, { e: 'research-queued', id: building.id, upgrade: up.id });
  return null;
}

/** Per tick: the head of each building's queue counts down (a debt pause holds it); when it reaches 0 it is done. */
export function stepToasterResearch(state) {
  for (const s of state.structures) {
    const r = s.research && s.research[0];
    s.researchPaused = !!r && !canProgress(state, s.owner, 'research');
    if (!r || s.researchPaused) continue;
    r.ticksLeft -= 1;
    if (r.ticksLeft <= 0) {
      s.research.shift();
      state.research.done[s.owner].push(r.upgrade);
      emit(state, { e: 'researched', player: s.owner, upgrade: r.upgrade });
    }
  }
}

/** One line for the card button: "Done", "Researching", "Needs a Toaster", ... or null when it can be bought (cost aside). */
export function researchLockReason(state, side, id) {
  const up = researchRow(id);
  if (!up) return 'Unknown research';
  if (doneOf(state, side).includes(id)) return 'Done';
  if (queuedAnywhere(state, side, id)) return 'Researching';
  if (up.requires && !doneOf(state, side).includes(up.requires)) return `Needs ${researchRow(up.requires).name}`;
  if (!tierNeedMet(state, side, up.tier)) return STATS.toasterTiers[up.tier].needText;
  return null;
}
