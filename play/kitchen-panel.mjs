// The Kitchen panel (WELLS-TECH-TERRAIN.md section 2, ticket T1): the bread chain drawn as boxes and arrows, with live
// per-minute numbers on each arrow and the boxes this side does not own yet greyed, with their cost and hotkey.
// Chain: Wheat -> Mill -> Flour; Well -> Water; Power Strip, Windmill and Dam -> Power; Flour + Water + Power -> Toast ->
// Toasters fire. kitchenModel() and kitchenHtml() are pure (tested in node); mountKitchenPanel() is the only DOM code.
// K opens and closes it, Esc closes it, and it opens once by itself the first time a Mill is placed (sessionStorage flag).
import { STATS } from '../env/stats.mjs';
import { ENERGY } from '../env/energy.mjs';
import { TOASTER_HOTKEYS } from './toaster-play.mjs';

export const KITCHEN_FLAG = 'kitchen-panel-seen';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const perMin = (n) => (Math.abs(n) >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));

// Each box: its name, a one-line note, what it costs (wheat) and its hotkey. kind = the building that lights it (a list when
// more than one kind counts); from = the building that makes a resource; always = there from the first tick.
const BOXES = Object.freeze({
  wheat: { name: 'Wheat', note: 'Crumbs haul it', always: true },
  mill: { name: 'Mill', note: 'grinds wheat into flour', kind: 'mill', cost: STATS.structures.mill.cost, hotkey: TOASTER_HOTKEYS.mill },
  flour: { name: 'Flour', note: 'from the Mill', from: 'mill' },
  well: { name: 'Well', note: 'draws water by the river', kind: 'well', cost: STATS.structures.well.cost, hotkey: TOASTER_HOTKEYS.well },
  water: { name: 'Water', note: 'from the Well', from: 'well' },
  strip: { name: 'Power Strip', note: 'the base: everything plugs in', kind: 'core' },
  windmill: { name: 'Windmill', note: 'on a high-ground pad', kind: 'windmill', cost: ENERGY.cost.windmill, hotkey: TOASTER_HOTKEYS.windmill },
  dam: { name: 'Dam', note: 'on a creek site', kind: ['dam', 'milldam'], cost: ENERGY.cost.dam, hotkey: TOASTER_HOTKEYS.dam },
  power: { name: 'Power', note: 'used of made', kind: ['core', 'windmill', 'dam', 'milldam'] },
  toaster: { name: 'Toaster', note: 'bakes the toast', kind: 'toaster', cost: STATS.structures.toaster.cost, hotkey: TOASTER_HOTKEYS.toaster },
  toast: { name: 'Toast', note: 'the ammo', from: 'toaster' },
  fire: { name: 'Toasties fire', note: 'need Toast to shoot', from: 'toaster' },
});

/** The kinds this side has on the board and finished (the Power Strip counts while it has hp). milldam also counts as dam. */
function haveKinds(state, side) {
  const have = new Set();
  for (const s of state?.structures ?? []) {
    if (s.owner !== side) continue;
    if (s.kind === 'core' ? s.hp > 0 : s.complete === true) { have.add(s.kind); if (s.kind === 'milldam') have.add('dam'); }
  }
  return have;
}

/** True once this side has placed a Mill, finished or not (the first Mill opens the panel). */
export const millPlaced = (state, side) => (state?.structures ?? []).some((s) => s.owner === side && s.kind === 'mill');

/**
 * The panel's data for one side: boxes (owned, cost, hotkey), arrows (per-minute numbers from the flow tracker over the last
 * 60 s, and the Power report: used of made, made null while Energy is off). flow is a createFlowTracker(), optional.
 */
export function kitchenModel(state, side, { flow = null } = {}) {
  const have = haveKinds(state, side);
  const r = flow ? flow.rates(side, state.tick) : { wheat: 0, flour: 0, water: 0, toast: 0 };
  const en = state.energy?.report?.[side] ?? null;
  const owned = {
    wheat: true,
    strip: have.has('core'),
    mill: have.has('mill'), flour: have.has('mill'),
    well: have.has('well'), water: have.has('well'),
    windmill: have.has('windmill'), dam: have.has('dam'),
    power: have.has('core') || have.has('windmill') || have.has('dam') || have.has('milldam'),
    toaster: have.has('toaster'), toast: have.has('toaster'), fire: have.has('toaster'),
  };
  const boxes = {};
  for (const [id, b] of Object.entries(BOXES)) {
    boxes[id] = { id, name: b.name, note: b.note, owned: owned[id], cost: b.cost ?? null, hotkey: b.hotkey ?? null };
  }
  const arrows = {
    wheat: { value: r.wheat }, flour: { value: r.flour }, water: { value: r.water }, toast: { value: r.toast },
    power: { used: en?.used ?? 0, made: en ? en.made : null },
  };
  return { boxes, arrows };
}

const box = (m, id) => {
  const b = m.boxes[id];
  const cls = b.owned ? 'kb' : 'kb off';
  const line = b.cost != null ? `<small>${b.cost} wheat</small>` : `<small>${esc(b.note)}</small>`;
  const key = b.hotkey ? `<kbd>${esc(b.hotkey.toUpperCase())}</kbd>` : '';
  const tip = `${b.name}: ${b.note}.${b.cost != null ? ` Costs ${b.cost} wheat.` : ''}${b.hotkey ? ` Hotkey ${b.hotkey.toUpperCase()}.` : ''}${b.owned ? '' : ' Not built yet.'}`;
  return `<div class="${cls}" data-box="${id}" title="${esc(tip)}"><b>${esc(b.name)}</b>${line}${key}</div>`;
};
const arrow = (text) => `<span class="ka">&rarr; ${esc(text)}</span>`;
const plus = '<span class="kp">+</span>';

/** The panel's markup for a kitchenModel() result. Fixed layout: the chain reads top to bottom, one recipe per row. */
export function kitchenHtml(m) {
  const a = m.arrows;
  const power = a.power.made == null ? 'power on' : `${a.power.used} of ${a.power.made} used`;
  const rows = [
    [box(m, 'wheat'), arrow(`${perMin(a.wheat.value)} wheat/min`), box(m, 'mill'), arrow(`${perMin(a.flour.value)} flour/min`), box(m, 'flour')],
    [box(m, 'well'), arrow(`${perMin(a.water.value)} water/min`), box(m, 'water')],
    [box(m, 'strip'), plus, box(m, 'windmill'), plus, box(m, 'dam'), arrow(power), box(m, 'power')],
    [box(m, 'flour'), plus, box(m, 'water'), plus, box(m, 'power'), arrow(`${perMin(a.toast.value)} toast/min`), box(m, 'toast'), arrow(`${perMin(a.toast.value)} toast/min`), box(m, 'fire')],
    [box(m, 'toaster'), '<span class="kp">bakes it</span>'],
  ];
  return `<div class="kitchen-head"><b>Kitchen</b><span class="dim">K or Esc closes</span><button type="button" data-close aria-label="Close the kitchen">x</button></div>`
    + `<div class="kitchen-rows">${rows.map((r) => `<div class="kr">${r.join('')}</div>`).join('')}</div>`
    + '<p class="kitchen-foot">Numbers: the last 60 s, per minute. Grey = not built yet: its cost in wheat and its hotkey.</p>';
}

/** What a key does to the panel: 'open', 'close', or null (not ours, so the match gets it). trainable: the selected building can train a Flak Popper (K). */
export function keyAction(key, { open, trainable = false }) {
  if (open && (key === 'Escape' || key === 'k' || key === 'K')) return 'close';
  if (!open && (key === 'k' || key === 'K') && !trainable) return 'open';
  return null;
}

/** True when the panel should open by itself: a Mill of this side exists and the session has not seen the panel open yet. */
export function autoOpenDue(state, side, storage) {
  if (!millPlaced(state, side)) return false;
  try { return storage?.getItem(KITCHEN_FLAG) !== '1'; } catch { return true; } // storage that throws: the mount's own flag still stops a repeat
}

function sessionOf(doc) {
  try { return doc.defaultView?.sessionStorage ?? null; } catch { return null; }
}

/**
 * Adds the panel to doc. Returns { el, open(), close(), toggle(), handleKey(key, { trainable }), update(state, side, opts) }.
 * update() runs every frame: it opens the panel once for the first Mill and re-renders only when the markup changes.
 */
export function mountKitchenPanel(doc, { storage = sessionOf(doc) } = {}) {
  const el = doc.createElement('div');
  el.id = 'kitchen';
  el.className = 'kitchen';
  el.hidden = true;
  doc.body.appendChild(el);
  let open = false, last = '', autoDone = false, lastArgs = null;
  const setOpen = (v) => { open = v; el.hidden = !v; if (v && lastArgs) render(); };
  const render = () => {
    const html = kitchenHtml(kitchenModel(lastArgs.state, lastArgs.side, lastArgs.opts));
    if (html !== last) { el.innerHTML = html; last = html; }
  };
  el.addEventListener('click', (e) => { if (e.target.closest?.('button[data-close]')) setOpen(false); });
  return {
    el,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open),
    isOpen: () => open,
    handleKey(key, { trainable = false } = {}) {
      const a = keyAction(key, { open, trainable });
      if (a === 'open') setOpen(true);
      else if (a === 'close') setOpen(false);
      return a !== null;
    },
    update(state, side, opts = {}) {
      lastArgs = { state, side, opts };
      if (!open && !autoDone && autoOpenDue(state, side, storage)) {
        autoDone = true;
        try { storage?.setItem(KITCHEN_FLAG, '1'); } catch { /* no storage: autoDone still holds for this page */ }
        setOpen(true);
      }
      if (open) render();
    },
  };
}
