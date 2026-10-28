// The key a button or hint names, read from the active key profile (HOTKEY_PROFILES in play/toaster-play.mjs), so no
// tooltip, tutorial line or coach prompt quotes a letter the profile does not bind. Owner: haiku (UX Writer). Pure, no DOM.
import { HOTKEY_PROFILES, keyProfile } from './toaster-play.mjs';

// Bound outside the profile table: F1 selects the next idle Crumb in both profiles (app.mjs F1 handler).
const FIXED = Object.freeze({ idle: 'F1' });

/** The profile a page runs in: ?keys=classic|grid, then the stored setting, then grid. Node has no page, so grid. */
export function activeProfile() {
  let stored = null;
  try { stored = globalThis.localStorage?.getItem('keys') ?? null; } catch { /* blocked storage: grid */ }
  return keyProfile(new URLSearchParams(globalThis.location?.search ?? ''), stored);
}

/** The key for an action (a profile slot name such as 'fence' or 'amove', or 'idle'), upper case, e.g. 'A'. '' when unknown. */
export function keyFor(action, profile = activeProfile()) {
  const table = HOTKEY_PROFILES[profile] ?? HOTKEY_PROFILES.grid;
  const key = FIXED[action] ?? table[action];
  return key ? String(key).toUpperCase() : '';
}
