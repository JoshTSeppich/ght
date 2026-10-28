// Sandbox mode on the play page (PLAYABLE.md item 13, owner: sonnet). ?mode=sandbox or ?difficulty=none ('Opponent: None')
// gives an enemy that never acts. P pauses, [ and ] step the game speed, F5-F8 are cheats sent as ordinary 'debug' commands
// (env/debug.mjs) that the sim refuses outside a sandbox. Pure helpers, no DOM.
import { DEBUG, enableSandbox } from '../env/debug.mjs';
import { createMatch } from '../env/sim.mjs';

export const SPEEDS = Object.freeze([0.5, 1, 2, 4]);

/** True for ?mode=sandbox and for the 'Opponent: None' menu choice (?difficulty=none). */
export const sandboxMode = (q) => q.get('mode') === 'sandbox' || q.get('difficulty') === 'none';

/** The enemy of a sandbox: never acts. */
export const idleOpponent = Object.freeze({ name: 'idle', act: () => [] });

/** createState wrapper: the same match, marked as a sandbox so the cheats are legal. */
export const sandboxState = (create = createMatch) => (seed) => enableSandbox(create(seed));

/** The next speed one step up (+1) or down (-1), clamped at the ends. */
export function stepSpeed(speed, dir) {
  const i = Math.max(0, SPEEDS.indexOf(speed));
  return SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, i + (dir > 0 ? 1 : -1)))];
}

export const speedLabel = (speed) => `${speed}x`;

/**
 * The debug command for a key, or null. `selectedKind` is the unit kind of the selection (F8 needs one), `cursor` the tile
 * under the mouse ({x, y}).
 */
export function cheatCommand(key, { selectedKind = null, cursor = null } = {}) {
  if (key === 'F5') return { type: 'debug', op: 'wheat', amount: DEBUG.wheat };
  if (key === 'F6') return { type: 'debug', op: 'toast', amount: DEBUG.toast };
  if (key === 'F7') return { type: 'debug', op: 'reveal' };
  if (key === 'F8' && selectedKind && cursor) return { type: 'debug', op: 'spawn', kind: selectedKind, x: cursor.x, y: cursor.y, count: DEBUG.squad };
  return null;
}

/** The small on-screen badge listing the keys. */
export function sandboxBadge(speed = 1, paused = false) {
  return `<b>Sandbox</b> ${paused ? 'PAUSED' : speedLabel(speed)}<br>P pause · [ ] speed<br>F5 +${DEBUG.wheat} wheat · F6 +${DEBUG.toast} toast<br>F7 reveal map · F8 spawn squad`;
}

/** The speed readout for the top bar. */
export const speedChip = (speed, paused) => `<span class="res" title="[ and ] change the speed, P pauses">Speed <b id="speed">${paused ? 'paused' : speedLabel(speed)}</b></span>`;
