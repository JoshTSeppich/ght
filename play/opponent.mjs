// Opponent choice on the Toaster Wars play page (PLAYABLE.md item 12). Owner: sonnet. Pure helpers plus one tiny DOM mount.
//   ?difficulty=easy    players/toaster-easy (the default): slow kitchen, one small squad late, never a Strip kill before 10:00
//   ?difficulty=normal  players/toaster-sonnet
//   ?difficulty=none    sandbox: an idle enemy and the cheat keys (play/sandbox.mjs reads the same parameter)
// ?ai=NAME still wins, and ?classic=1 keeps the old built-in AI.

export const OPPONENTS = [['easy', 'Easy'], ['normal', 'Normal'], ['none', 'None']];

/** easy | normal | none from the query; anything else is easy. */
export const opponentLevel = (q) => {
  const d = q.get('difficulty');
  return d === 'normal' || d === 'none' ? d : 'easy';
};

/** The ai name for app.mjs: ?ai wins, then the Toaster Wars bots by difficulty, else the classic built-in AI. */
export const opponentAiName = (q, toasterOn) => q.get('ai') ?? (!toasterOn ? 'builtin' : opponentLevel(q) === 'normal' ? 'toaster-sonnet' : 'toaster-easy');

/** The search string for a new choice: same page, same other options, difficulty replaced (mode=sandbox is dropped). */
export function opponentSearch(search, level) {
  const p = new URLSearchParams(search);
  p.set('difficulty', level);
  if (p.get('mode') === 'sandbox') p.delete('mode');
  return '?' + p.toString();
}

/**
 * Adds "Opponent: Easy / Normal / None" to the small menu (mountMatchMenu's #matchmenu). Picking a level reloads the page with it.
 * Returns the select, or null when there is no menu.
 */
export function mountOpponentChoice(root, { level, search, go }) {
  const box = root.querySelector('#matchmenu');
  if (!box) return null;
  const doc = root.ownerDocument;
  const row = doc.createElement('label');
  row.id = 'mm-opponent';
  row.textContent = 'Opponent: ';
  const sel = doc.createElement('select');
  sel.id = 'mm-opponent-select';
  for (const [v, name] of OPPONENTS) {
    const o = doc.createElement('option');
    o.value = v; o.textContent = name; o.selected = v === level;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => go(opponentSearch(search, sel.value)));
  row.appendChild(sel);
  box.insertBefore(row, box.querySelector('#mm-resume'));
  return sel;
}
