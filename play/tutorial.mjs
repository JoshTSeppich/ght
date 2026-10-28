// First-match tutorial in five steps (PLAYABLE.md item 29). Owner: haiku. Pure helpers, no DOM: play/tutorial-card.mjs
// draws it. Every step completes from the live state (or the wheat counter), never from a timer. ?tutorial=0 turns it off.
import { STATS } from '../env/stats.mjs';
import { keyFor, activeProfile } from './key-text.mjs';

/** The five steps. The keys in the copy are read from the key profile (play/key-text.mjs), so each names what the player presses. */
export function tutorialSteps(profile = activeProfile()) {
  const k = (action) => keyFor(action, profile);
  return Object.freeze([
    { id: 'wheat', title: 'Gather wheat', body: 'Right-click a wheat field with a Crumb. Breakfast starts in the field.' },
    { id: 'kitchen', title: 'Build the kitchen', body: 'Build a Mill, a Well by the river and a Toaster. Wheat becomes flour, then toast.' },
    { id: 'poppers', title: 'Train Poppers', body: `Train Poppers at the Assembly Line (${k('forge')}). Keep toast coming for their ammo.` },
    { id: 'boxes', title: 'Extend the cord', body: `Place two Extension Boxes (${k('extension')}) toward the enemy, linked to your Power Strip.` },
    { id: 'strip', title: 'Attack the Power Strip', body: `Select your fed Poppers and attack-move (${k('amove')}) to their Power Strip. Cut their breakfast.` },
  ]);
}

/** The default (grid) copy. Tests and callers that have no page read it; the page uses tutorialSteps(profile). */
export const TUTORIAL_STEPS = tutorialSteps('grid');

const KITCHEN = Object.freeze(['mill', 'well', 'toaster']);
const MAX_CORE_HP = STATS.toaster?.coreHp ?? STATS.core.hp;

/** The one-line objective under the top bar, always on screen in Toaster Wars. */
export const OBJECTIVE = 'Feed your Toasties. Destroy the enemy Power Strip.';

/** ?tutorial=0 turns the guide off; anything else (or no parameter) leaves it on. */
export const tutorialOn = (q) => q.get('tutorial') !== '0';

/**
 * Which steps are done for `side`. `snap` is an observe() snapshot (units, structures); `wheatGathered` is the running
 * wheat count from play/results-card.mjs createMatchStats; `profile` is the key profile the copy names (default: the page's).
 * Returns { steps: [{ id, title, body, done }], current, finished } where current is the first step not yet done (-1 when all five are).
 */
export function tutorialProgress(snap, side, { wheatGathered = 0, profile = activeProfile() } = {}) {
  const mine = (snap?.structures ?? []).filter((s) => s.owner === side && s.complete);
  const built = new Set(mine.map((s) => s.kind));
  const boxes = mine.filter((s) => s.kind === 'extension').length;
  const popper = (snap?.units ?? []).some((u) => u.owner === side && u.kind === 'grunt');
  const enemyCores = (snap?.structures ?? []).filter((s) => s.owner !== side && s.kind === 'core');
  // Hurt Strip counts. A side whose Strip is gone (and ours still stands) has lost; the attack is done too.
  const ownCore = (snap?.structures ?? []).some((s) => s.owner === side && s.kind === 'core');
  const strip = enemyCores.some((c) => c.hp < MAX_CORE_HP) || (enemyCores.length === 0 && ownCore);
  const done = [
    wheatGathered > 0,
    KITCHEN.every((k) => built.has(k)),
    popper,
    boxes >= 2,
    strip,
  ];
  const steps = tutorialSteps(profile).map((s, i) => ({ ...s, done: done[i] }));
  const current = steps.findIndex((s) => !s.done);
  return { steps, current, finished: current === -1 };
}
