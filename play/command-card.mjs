// Command card: a 5 by 3 grid of buttons, each with its key printed, cost and a tooltip. Pure helpers, no DOM.
// Owner: haiku (Classic HUD). The card entries come from input.commandCard(snap); this file only lays them out.
import { kindName } from './hud.mjs';
import { iconHtml } from './icons.mjs';
import { describe } from './teach.mjs';
import { tipFor } from './hud-tips.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The card grid (SYSTEMS-DESIGN.md section 4): Q W E R T / A S D F G / Z X C V B. Each entry sits on its grid cell (entry.pos,
// the grid letter of its slot); the key printed on it (entry.key) follows the key profile, grid or classic.
export const GRID = Object.freeze([
  Object.freeze(['q', 'w', 'e', 'r', 't']),
  Object.freeze(['a', 's', 'd', 'f', 'g']),
  Object.freeze(['z', 'x', 'c', 'v', 'b']),
]);
export const GRID_KEYS = Object.freeze(GRID.flat());

/**
 * Put each card entry on its grid cell. Entries whose cell is taken (or not on the grid) take the first free cell, so nothing is lost.
 * The grid is five columns and three rows; it grows a row whenever a card needs one.
 * Returns one cell per slot, each { key, entry } or null for an empty cell.
 */
export function layoutCard(card) {
  const rows = Math.max(GRID.length, Math.ceil(card.length / GRID[0].length));
  const cells = new Array(rows * GRID[0].length).fill(null);
  const loose = [];
  for (const entry of card) {
    const at = GRID_KEYS.indexOf(entry.pos ?? entry.key);
    if (at >= 0 && cells[at] === null) cells[at] = entry;
    else loose.push(entry);
  }
  for (const entry of loose) {
    const free = cells.indexOf(null);
    if (free >= 0) cells[free] = entry;
  }
  return cells.map((entry, i) => (entry ? { key: GRID_KEYS[i] ?? entry.key, entry } : null));
}

/** Tooltip text for one entry: what it does, what it costs, its hotkey. A locked entry leads with why ("Needs a Toaster."). */
export function tooltip(entry, opts) {
  const base = (opts?.tips && tipFor(entry)) || describe({ ...entry, label: entry.kind ? kindName(entry.kind) : entry.label }, opts).title;
  return entry.locked && entry.reason ? `${entry.reason}. ${base}` : base;
}

/**
 * The card as HTML: twelve cells, empty ones blank. shards and mode come from the live state and input.ui.mode.
 * Buttons carry data-action, data-kind and data-key, so one click handler serves the whole card.
 */
export function renderCard(card, { shards = 0, mode = null, tips = false } = {}) {
  return layoutCard(card).map((cell) => {
    if (!cell) return '<span class="cc empty" aria-hidden="true"></span>';
    const { key: cellKey, entry } = cell;
    const key = entry.key ?? cellKey; // show the key that really works, even when the button sits on another cell
    const poor = entry.cost !== undefined && shards < entry.cost && !entry.locked; // a locked entry is greyed, not also red
    const active = !!mode && (mode.type === entry.action || (mode.type === 'place' && mode.kind === entry.kind));
    const name = entry.kind ? kindName(entry.kind) : entry.label; // once, in the proper name (the sim keeps 'forge' as an id)
    const pic = iconHtml(entry.kind ?? entry.action, name);
    const hasArt = pic.startsWith('<img'); // no art: the readable fallback IS the label; never print the name twice
    const icon = pic;
    const cost = entry.cost !== undefined ? `<small>${entry.cost}</small>` : '';
    const grey = entry.locked ? ';opacity:.4;filter:grayscale(1)' : ''; // locked: still there, still clickable (it says why)
    const cls = entry.locked ? ' locked' : poor ? ' poor' : '';
    return `<button class="cc${cls}${active ? ' on' : ''}" data-action="${entry.action}" data-kind="${entry.kind ?? ''}" data-key="${key}" style="position:relative${grey}" title="${esc(tooltip({ ...entry, key }, { tips }))}">`
      + `<kbd style="position:absolute;top:2px;right:2px">${key.toUpperCase()}</kbd>${icon}${hasArt ? `<span class="lbl">${name}</span>` : ''}${cost}</button>`;
  }).join('');
}

/** A string that changes whenever the card's look changes; use it to skip re-rendering an unchanged card. */
export function cardSignature(card, { shards = 0, mode = null } = {}) {
  return JSON.stringify([card, shards, mode]);
}
