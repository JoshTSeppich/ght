// The end of a Toaster Wars match (PLAYABLE.md item 11): the numbers for the results card, the card itself, a small
// Menu (Resume / Surrender / Restart) and the last-match recording the "Watch replay" button plays. Owner: sonnet.
// The tracker and the html are pure; only mountMatchMenu and saveLastMatch touch the DOM / sessionStorage.

/** Counts one side's match: wheat delivered, slices baked, units (toasters) lost. Feed it every tick's events. */
export function createMatchStats(side) {
  const owner = new Map(); // unit id -> owner; ids are unique, so it only grows
  const s = { wheat: 0, slices: 0, lost: 0 };
  return {
    totals: s,
    /** state.units is the live list (or a snapshot's units); events are that tick's sim events. */
    note(units, events) {
      for (const u of units) owner.set(u.id, u.owner);
      for (const e of events) {
        if (e.e === 'deliver' && owner.get(e.id) === side && (e.resource === undefined || e.resource === 'shards')) s.wheat += e.amount || 0;
        else if (e.e === 'bake' && e.player === side) s.slices += e.slices || 0;
        else if (e.e === 'die' && owner.get(e.id) === side) s.lost += 1;
      }
    },
  };
}

export const clockOf = (tick, tps = 24) => { const t = Math.floor(tick / tps); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The timeout / stalemate line: names the first pair that differs (board value, then damage to buildings); else the bank.
function scoredLineOf(result, side, draw) {
  const lead = result.reason === 'stalemate' ? 'Nobody fought, so the match ended as a stalemate, scored like a timeout.' : 'Time ran out.';
  if (draw) return `${lead} Board, damage and Wheat are level: a true draw.`;
  const by = [['Board value', result.score], ['Damage to enemy buildings', result.damage]].find(([, p]) => p && p[0] !== p[1]);
  return by ? `${lead} ${by[0]} ${by[1][side]} to ${by[1][1 - side]} decided it.` : `${lead} Wheat in the bank decided it.`;
}

/** One line per end reason: why the match ended, for the card. */
export function reasonOf(result, side) {
  const draw = result.winner === null || result.winner === undefined, won = result.winner === side;
  if (result.reason === 'forfeit') return won ? 'The opponent crashed or timed out.' : 'You surrendered.';
  if (result.reason === 'buildings' && !draw) return won ? 'You destroyed all enemy buildings.' : 'All your buildings were destroyed.';
  if (result.reason === 'core' && !draw) return won ? 'The enemy Power Strip fell.' : 'Your Power Strip fell.';
  if (result.reason === 'territory') return won ? 'You held enough Reaches to win.' : 'The other side held enough Reaches to win.';
  if (result.reason === 'timeout' || result.reason === 'stalemate') return scoredLineOf(result, side, draw);
  return 'Both Power Strips fell.';
}

/** The query for Play again on Normal: the same query with difficulty=normal. */
export function normalQuery(q = '') {
  const next = new URLSearchParams(q);
  next.set('difficulty', 'normal');
  return next.toString();
}

/**
 * One line from the numbers, for the card. The first rule that fits wins: no toast baked, a lot of toasters lost, too little
 * wheat gathered, or a plain nudge.
 */
export function tipOf(result, side, totals) {
  if (!totals.slices) return 'Build a Mill, a Well and a Toaster.';
  if (totals.lost >= 5) return `You lost ${totals.lost} Toasties. Fight near your Power Strip, where toast is close.`;
  if (totals.wheat < 200) return `Crumbs gathered only ${totals.wheat} wheat. Send more Crumbs to the wheat.`;
  return result.winner === side ? 'Keep the toast flowing so your Poppers can fire.' : 'Hit the enemy Power Strip sooner, before its army grows.';
}

/**
 * The results card's html. result: { winner, reason, tick }; totals: createMatchStats().totals; opts.query: the page query
 * (Play again on Normal keeps it).
 */
export function resultsCardHtml(result, side, totals, { tps = 24, query = '' } = {}) {
  const draw = result.winner === null || result.winner === undefined, won = result.winner === side;
  const why = reasonOf(result, side);
  const row = (k, v) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`;
  return `<h1 class="${draw ? '' : won ? 'win' : 'lose'}">${draw ? 'DRAW' : won ? 'VICTORY' : 'DEFEAT'}</h1><p>${why}</p>`
    + `<table class="stats">${row('Winner', draw ? 'nobody' : won ? 'You' : 'The other side')}${row('Time', clockOf(result.tick ?? 0, tps))}`
    + `${row('Wheat gathered', totals.wheat)}${row('Slices baked', totals.slices)}${row('Toasties lost', totals.lost)}</table>`
    + `<p class="tip">${esc(tipOf(result, side, totals))}</p>`
    + '<p><button id="restart">Restart</button> <button id="replay">Watch replay</button></p>'
    + `<p><a id="again-normal" href="?${esc(normalQuery(query))}">Play again on Normal</a></p>`
    + '<p class="dim">Enter restarts</p>';
}

/** Store the match (seed + the commands the sim applied) so ?mode=watch&replay=last can play it back. */
export function saveLastMatch(log, store = globalThis.sessionStorage) {
  const commands = {};
  for (const t of log.ticks) if (t.commands && (t.commands[0]?.length || t.commands[1]?.length)) commands[t.tick] = t.commands;
  const rec = { seed: log.seed, maxTicks: log.ticks.length + 1, commands };
  try { store?.setItem('toaster-last-match', JSON.stringify(rec)); return true; } catch { return false; }
}

/** The recording saveLastMatch stored, or null. */
export function loadLastMatch(store = globalThis.sessionStorage) {
  try { const rec = JSON.parse(store?.getItem('toaster-last-match')); return rec && rec.commands && Number.isInteger(rec.seed) ? rec : null; } catch { return null; }
}

/** The page url for Watch replay: same query, watch mode, the last match. */
export function replayQuery(q) {
  const next = new URLSearchParams(q);
  next.set('mode', 'watch'); next.set('replay', 'last'); next.delete('ai');
  return next.toString();
}

/**
 * A small Menu button (and F10) with Resume / Surrender / Restart. onSurrender() is called after a confirm click; the
 * app then shows the results card through the driver's end event. Returns { open, close }.
 */
export function mountMatchMenu(root, { onSurrender, onRestart, isOver = () => false }) {
  const doc = root.ownerDocument;
  const btn = doc.createElement('button');
  btn.id = 'menubtn'; btn.textContent = 'Menu (F10)';
  btn.style.cssText = 'position:fixed;right:8px;top:44px;z-index:5;opacity:.8';
  const box = doc.createElement('div');
  box.id = 'matchmenu'; box.hidden = true;
  box.style.cssText = 'position:fixed;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#000a;text-align:center';
  box.innerHTML = '<h2>Menu</h2><button id="mm-resume">Resume</button><button id="mm-surrender">Surrender</button><button id="mm-restart">Restart</button>';
  root.append(btn, box);
  // inline display:flex beats the [hidden] attribute, so toggle display too (the menu used to stay on screen after Resume)
  const show = (on) => { box.hidden = !on; box.style.display = on ? 'flex' : 'none'; };
  const close = () => show(false);
  const open = () => { if (!isOver()) show(true); };
  show(false);
  btn.addEventListener('click', () => (box.hidden ? open() : close()));
  box.querySelector('#mm-resume').addEventListener('click', close);
  box.querySelector('#mm-restart').addEventListener('click', () => { close(); onRestart(); });
  const sur = box.querySelector('#mm-surrender');
  sur.addEventListener('click', () => {
    if (sur.dataset.sure !== '1') { sur.dataset.sure = '1'; sur.textContent = 'Really surrender?'; return; }
    close(); onSurrender();
  });
  doc.defaultView?.addEventListener('keydown', (e) => { if (e.key === 'F10') { e.preventDefault(); box.hidden ? open() : close(); } });
  return { open, close };
}
