// GHT on the play page (Joshua 10-23: "I want to SEE GHT"). Owner: sonnet (Playable Client).
// Pure helpers, no DOM. The default page is the territory match on Wheatfield Valley with power, ammo, bakery, fences
// and wrap on; ?classic=1 keeps the old GHT Classic page. The top bar names the kitchen: Wheat, Flour, Water, Toast,
// Power. An ingredient that is missing (and would stop the Toaster) blinks. No Trading House goods panel: GHT has
// no toaster market. The side panel is empty on /play; the Kitchen panel (play/kitchen-panel.mjs) shows the tiers.
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { enableFences } from '../env/fence.mjs';
import { enableEnergy } from '../env/energy.mjs';
import { reachViews } from './reach-view.mjs';
import { driftBanner, activeCountdowns } from './drift-banner.mjs';
import { tierStatus, renderTier } from './tier-readout.mjs';
import { STATS } from '../env/stats.mjs';
import { observe } from '../env/state.mjs';
import { generateMap } from '../env/map.mjs';
import { renderBar } from './hud-bar.mjs';

export const PAGE_TITLE = 'GHOSTIES, HOSTIES, AND TOASTIES';

/** GHT unless the page asks for ?classic=1. */
export const toasterMode = (q) => q.get('classic') !== '1';

/** The ready territory match: power cords, ammo, bakery on (createTerritoryMatch), plus fences and wrap. */
export function createToasterState(seed) {
  const state = createTerritoryMatch(seed);
  state.budget.upkeepPercent = STATS.toaster.upkeepPercent;
  enableFences(state);
  state.power.wrap = true;
  switchOffGht(state);
  return state;
}

/**
 * The match Joshua plays: createToasterState plus Energy (PLAYABLE.md item 20). Windmills and Dams make it, Toasters and fences use
 * it. Both sides play by the same energy rules (the bots build Windmills).
 */
export function createPlayableState(seed) {
  const state = createToasterState(seed);
  enableEnergy(state);
  return state;
}

/**
 * GHT leaves the classic rules behind (PLAYABLE.md item 10): no Drift (floods, quakes, blooms), no market, no
 * research (its upgrades cost Flux and Alloy), no tier gates. ?classic=1 and the bots' own matches keep them.
 */
export function switchOffGht(state) {
  delete state.drift;
  delete state.market;
  state.noTiers = true; // state.research stays: on GHT it holds the Wheat + Flour upgrades (env/research.mjs)
  return state;
}

/**
 * The state the TV recordings (play/replay) run on: the pacing rules of TERRITORY-PACING.md, cords straight (wrap off). With
 * cords that bend round rocks the toaster-sonnet bots still stall mid-map (their lanes are not wrap-aware yet), so the TV
 * shows the chain-and-siege match the bots can really play.
 */
export function createReplayState(seed) {
  const state = createTerritoryMatch(seed, {});
  enableFences(state);
  state.power.wrap = true; // the real rule: cords bend round rocks (the bots are wrap-aware now)
  enableEnergy(state); // the TV shows the real rules: the bots raise Windmills
  return state;
}

/** { on, createState } for a page query. createState(seed) goes to createLiveMatch; undefined keeps the old match. */
export function toasterOptions(q) {
  const on = toasterMode(q);
  return { on, createState: on ? createPlayableState : undefined };
}

/**
 * The two key profiles (SYSTEMS-DESIGN.md section 4). Each slot is one button: a kind (its name) or an action on a card.
 * The grid profile is the default and its letters ARE the cells of the 5 x 3 card (Q W E R T / A S D F G / Z X C V B);
 * the classic profile prints today's letters on the same cells. Within one card a key is never used twice.
 * Slots that repeat a name on different cards (rally on the Strip and on the Assembly Line) get their own slot.
 */
export const HOTKEY_PROFILES = Object.freeze({
  grid: Object.freeze({
    move: 'q', stop: 'w', hold: 'e', patrol: 'r', amove: 't',                              // row 1, every card
    worker: 'a', rally: 's', pilot: 'd',                                                     // Strip (the core)
    mill: 'a', well: 's', toaster: 'd', forge: 'f', turret: 'g', extension: 'z', pylon: 'x', windmill: 'c', dam: 'v', gather: 'b', // Crumb
    grunt: 'a', lancer: 's', spiker: 'd', brute: 'f', howler: 'g', dart: 'z', lineRally: 'x', // Assembly Line
    resupply: 'a', shove: 's', roll: 'a', priority: 'a', rings: 'a', pause: 's', fence: 'a', unplug: 's', // the rest
  }),
  classic: Object.freeze({
    move: 'm', stop: 's', hold: 'h', patrol: 'p', amove: 'a',
    worker: 'c', rally: 'r', pilot: 'd',
    mill: 'i', well: 'w', toaster: 't', forge: 'f', turret: 'l', extension: 'x', pylon: 'v', windmill: 'n', dam: 'd', gather: 'g',
    grunt: 'o', lancer: 'z', spiker: 'k', brute: 'l', howler: 'b', dart: 'e', lineRally: 'r',
    resupply: 'y', shove: 'j', roll: 'j', priority: 'y', rings: 'g', pause: 'w', fence: 'f', unplug: 'u',
  }),
});
/** The key profile for a page: ?keys=classic|grid wins, then the stored setting, then grid. Anything else is grid. */
export const keyProfile = (q, stored = null) => ((q.get('keys') ?? stored) === 'classic' ? 'classic' : 'grid');
/** Hotkeys by toaster name for the grid profile (the default). Kept under its old name for the kitchen panel. */
export const TOASTER_HOTKEYS = HOTKEY_PROFILES.grid;
/** Extra createInput options for GHT: the key table, the grid cells, and the Power Station buttons. */
export const toasterInputOptions = (profile = 'grid') => ({ hotkeys: HOTKEY_PROFILES[profile] ?? HOTKEY_PROFILES.grid, grid: HOTKEY_PROFILES.grid, stations: true });

/** The Wheatfield Valley map data for the terrain and the minimap, or null when the page runs another map (?map=). */
export function wheatfieldMap(seed, q) {
  const name = q.get('map') ?? 'wheatfield';
  return name === 'wheatfield' ? generateMap(seed, { map: 'wheatfield' }) : null;
}

const INGREDIENTS = Object.freeze([['flour', 'Flour'], ['water', 'Water']]);

/** Ingredients (flour, water) the side has none of in its pantry; the Toaster cannot bake without them. */
export function missingIngredients(state, side) {
  const p = state?.toast?.pantry?.[side];
  if (!p) return [];
  return INGREDIENTS.filter(([k]) => !(p[k] > 0)).map(([k]) => k);
}

/**
 * The top strip (play/hud-bar.mjs draws it): Wheat, Flour, Water, Toast, Power, Upkeep per minute, a Pilot light chip, the
 * clock and the alert. Works on the live state. A missing ingredient is `class="res blink"`. opts.flow is a
 * createFlowTracker() for the income-rate hovers.
 */
export function toasterTopBar(state, opts = {}) {
  return renderBar(state, opts);
}

/** The side panel for ?classic=1: Drift warnings and the research tier readout. Empty on GHT (no Drift, no research). */
export function toasterPanel(state, side) {
  if (!state?.territory) return '';
  reachViews(state.territory);
  if (state.noTiers || (!state.drift && !state.research)) return ''; // GHT: no Drift, no tiers
  const parts = [];
  const banner = driftBanner(state.drift?.events ?? [], state.tick, side);
  if (banner) parts.push(`<div class="drift ${banner.phase}"><b>${banner.title}</b></div>`);
  for (const c of activeCountdowns(state.drift?.events ?? [], state.tick, side)) parts.push(`<div class="drift timed">${c.label}${c.where ? ` ${c.where}` : ''}: ${c.secondsLeft} s left</div>`);
  const builtKinds = state.structures.filter((s) => s.owner === side && s.complete).map((s) => s.kind);
  parts.push(renderTier(tierStatus({ holds: state.territory.hold[side], builtKinds })));
  return parts.join('');
}

/**
 * observe() plus what the 3D toasters need to draw: each unit's power state and cord corners, the power points and the
 * ammo handle (hunger). observe() leaves these out, so without this the thick cords never reach the cord batch.
 */
export function observeToaster(state, side) {
  const snap = observe(state, side);
  if (!state.power) return snap;
  const byId = new Map(state.units.map((u) => [u.id, u]));
  for (const u of snap.units) {
    const p = byId.get(u.id)?.power;
    if (p) u.power = { state: p.state, anchor: p.anchor, cord: p.cord ? { pts: p.cord.pts.map((q) => ({ x: q.x, y: q.y })) } : undefined };
  }
  const view = state.power.view;
  snap.power = { view: view ? { points: view.points } : null, points: view?.points ?? state.power.points, fenceLinks: [...(state.power.fenceLinks ?? [])] };
  snap.ammo = state.ammo;
  return snap;
}
