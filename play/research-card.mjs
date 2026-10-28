// The research card (TERRITORY.md section 6): one cell per upgrade with its cost, time and state. Pure helpers.
// Owner: haiku (Classic play UI). Upgrades come from STATS.upgrades once env/stats.mjs has the table; the card only
// lays them out. A click is handled by the app with data-research.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The upgrades a player can see: the shared ones and their own faction's. */
export function researchFor(upgrades, faction) {
  return upgrades.filter((u) => u.faction === 'shared' || u.faction === faction);
}

/**
 * 'done', 'busy' (researching now), 'locked' (its tier is not open, or the level below it is not done), 'poor' (not
 * enough Shards, Flux or Alloy) or 'ready'. ctx: { tier, shards, flux, alloy, done: [ids], busy: id or null }.
 */
export function researchState(u, { tier = 1, shards = 0, flux = 0, alloy = 0, done = [], busy = null } = {}) {
  if (done.includes(u.id)) return 'done';
  if (busy === u.id) return 'busy';
  if (u.tier > tier) return 'locked';
  if (u.requires && !done.includes(u.requires)) return 'locked';
  const c = u.cost ?? {};
  if (shards < (c.shards ?? 0) || flux < (c.flux ?? 0) || alloy < (c.alloy ?? 0)) return 'poor';
  return 'ready';
}

// "100/100" or "200/200/50A": Shards, Flux, and Alloy only when it is part of the cost.
export function costText(cost = {}) {
  const parts = [cost.shards ?? 0, cost.flux ?? 0].join('/');
  return cost.alloy ? `${parts}/${cost.alloy}A` : parts;
}

/** The card as HTML: one button per upgrade. Empty list gives an empty string. */
export function renderResearchCard(upgrades, ctx = {}) {
  return upgrades.map((u) => {
    const state = researchState(u, ctx);
    return `<button class="rs ${state}" data-research="${esc(u.id)}" title="${esc(u.effect ?? u.name)}">`
      + `<span class="rs-name">${esc(u.name)}</span>`
      + `<small>Tier ${u.tier} · ${costText(u.cost)} · ${u.seconds} s</small></button>`;
  }).join('');
}

// ---------------------------------------------------------------------------------------------
// Toaster Wars (build wave 2, card M3): the research buttons on the Assembly Line card, paid in Wheat + Flour.
// play/input.mjs puts these entries on the command card; a click or key runs act(state, 'research:<id>').
// ---------------------------------------------------------------------------------------------
import { RESEARCH_ROWS, researchRow, researchLockReason, RESEARCH_TRACKS } from '../env/research.mjs';

export const RESEARCH_ACTION = 'research:';
/** The upgrade id inside a card action ('research:ground-weapons-1'), or null when the action is not a research. */
export const researchIdOf = (action) => (typeof action === 'string' && action.startsWith(RESEARCH_ACTION) ? action.slice(RESEARCH_ACTION.length) : null);

/** "100 Wheat + 2 Flour". */
export const priceText = (cost) => `${cost.wheat} Wheat + ${cost.flour} Flour`;

/**
 * The researches to offer on a building of this kind: the next unfinished level of each track, then each unit research not yet
 * done. A level already queued still shows (it reads "Researching"). Order: tracks first, as RESEARCH_TRACKS lists them.
 */
export function toasterResearchFor(state, side, buildingKind) {
  const done = state?.research?.done?.[side] ?? [];
  const rows = RESEARCH_ROWS.filter((r) => r.building === buildingKind && !done.includes(r.id));
  const tracks = RESEARCH_TRACKS.map((t) => rows.find((r) => r.track === t)).filter(Boolean);
  return [...tracks, ...rows.filter((r) => !r.track)];
}

// Keys for the three track buttons (the free cells c v b of the Assembly Line card); unit researches are click-only.
const TRACK_KEY = { 'ground-weapons': 'c', 'ground-armor': 'v', 'structure-armor': 'b' };

/**
 * Command-card entries for a selected building of this kind: [{ slot, key, pos, label, action, cost, locked, reason, tip }].
 * `cost` is the Wheat price (the card greys it when short); the Flour price and the lock sit in `tip` and `reason`.
 * An empty list when the match has no Toaster Wars research (Classic).
 */
export function toasterResearchEntries(state, side, buildingKind) {
  if (!state?.research || !state.noTiers) return [];
  const flour = state.toast?.pantry?.[side]?.flour ?? 0;
  return toasterResearchFor(state, side, buildingKind).map((r) => {
    const lock = researchLockReason(state, side, r.id);
    const poorWheat = (state.shards?.[side] ?? 0) < r.cost.wheat;
    const poorFlour = flour < r.cost.flour;
    const reason = lock ?? (poorFlour ? `Not enough Flour (${r.cost.flour})` : poorWheat ? `Not enough Wheat (${r.cost.wheat})` : null);
    const key = TRACK_KEY[r.track] ?? '';
    return {
      slot: `research-${r.id}`, key, pos: key || undefined, label: r.name, action: RESEARCH_ACTION + r.id, cost: r.cost.wheat,
      tip: `${r.name}: ${r.effect}. ${priceText(r.cost)}, ${r.seconds} s.`,
      locked: !!reason, ...(reason ? { reason } : {}),
    };
  });
}

/** The one line a toast shows when a research is queued from the card. */
export function researchQueuedText(id) {
  const r = researchRow(id);
  return r ? `Researching ${r.name} (${r.seconds} s)` : 'Researching';
}
