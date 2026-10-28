// The GHT top bar (PLAYABLE.md items 8 and 23). Owner: sonnet (HUD). Pure helpers, no DOM, no Node globals.
// Wheat, Flour, Water, Toast (stack), Power used of made and Upkeep per minute, each with an income-rate hover. Upkeep turns
// red when it is more than the wheat coming in. GHT also shows Toasters N/40 (the unit cap). A "Pilot light" chip
// shows while the Power Strip is baking emergency slices. From 14:00 the clock counts down the last minute in amber.
// Without a budget (classic) the cap shows as Supply.
import { STATS } from '../env/stats.mjs';
import { BAKERY, pantryCapOf } from '../env/bakery.mjs';
import { upkeepPerMinute, isEnabled as budgetOn } from '../env/budget.mjs';
import { keyFor } from './key-text.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clockOf = (tick, tps) => { const s = Math.floor(tick / tps); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmt = (n) => (Math.abs(n) >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10));
export const FLOW_WINDOW_SECONDS = 60;

/**
 * Rolling income counters. feed(events, state) after each sim step (events carry deliver, mill, well, bake); rates(side, tick)
 * gives per-minute figures over the last minute (scaled up while the match is younger than a minute).
 */
export function createFlowTracker({ tps = STATS.clock.ticksPerSecond } = {}) {
  const log = [[], []]; // per side: { t, wheat, flour, water, toast }
  const window = FLOW_WINDOW_SECONDS * tps;
  return {
    feed(events, state) {
      const tick = state.tick;
      for (const ev of events ?? []) {
        let side = ev.player;
        const row = { t: tick, wheat: 0, flour: 0, water: 0, toast: 0 };
        if (ev.e === 'deliver' && ev.resource === undefined) { side = state.units.find((u) => u.id === ev.id)?.owner; row.wheat = ev.amount; }
        else if (ev.e === 'mill') row.flour = 1;
        else if (ev.e === 'well') row.water = 1;
        else if (ev.e === 'bake') row.toast = ev.slices;
        else continue;
        if (side === 0 || side === 1) log[side].push(row);
      }
      for (const l of log) while (l.length && l[0].t < tick - window) l.shift();
    },
    rates(side, tick) {
      const span = Math.max(10 * tps, Math.min(window, tick)); // never divide by a tiny span
      const sum = (k) => log[side].reduce((n, r) => n + r[k], 0) * (window / span) * (60 / FLOW_WINDOW_SECONDS);
      return { wheat: sum('wheat'), flour: sum('flour'), water: sum('water'), toast: sum('toast') };
    },
  };
}

function powerCount(state, side) {
  let on = 0, total = 0;
  for (const u of state.units) {
    if (u.owner !== side || !u.power) continue;
    total++;
    if (u.power.state !== 'down') on++;
  }
  return { on, total };
}

/** Wheat going out each minute under the budget (upkeep), 0 when the budget is off. */
export const upkeepOf = (state, side) => (budgetOn(state) ? upkeepPerMinute(state, side).shards : 0);

/** True while the Power Strip is baking its own slices: it is alive and the stack is under the pilot floor. */
export function pilotLight(state, side) {
  if (!state.bakery || !state.toast) return null;
  const strip = state.structures.find((s) => s.kind === 'core' && s.owner === side && s.hp > 0);
  if (!strip || state.toast.stack[side] >= BAKERY.pilotFloor) return null;
  const next = Math.max(0, (state.bakery.pilotAt?.[side] ?? 0) - state.tick);
  return { stack: state.toast.stack[side], floor: BAKERY.pilotFloor, secondsToNext: Math.ceil(next / STATS.clock.ticksPerSecond), everySeconds: BAKERY.pilotTicks / STATS.clock.ticksPerSecond };
}

/** Hover text for the Energy readout "used/made". */
export function powerTitle(en, cut = 0) {
  const base = `Energy: your base uses ${en.used} and makes ${en.made}. Toasties and fences use it; Windmills (${keyFor('windmill')}) and Dams (${keyFor('dam')}) make it.`;
  if (en.shed > 0) return `${base} Short on Energy: ${en.shed} load(s) went dark (fences first, then the newest Toastie). Build a Windmill.`;
  return cut > 0 ? `${base} ${cut} Toastie(s) cut off from the cord; re-plug them with a Crumb.` : `${base} Enough to go round.`;
}

/** The strip as an HTML string. flow is a createFlowTracker() (optional: without it the hovers carry no measured rates). */
// Chip ids are prefixed res- because the page already has #toast (the pop-up message box, opacity 0): the Toast count
// used to inherit that and was invisible.
// The 15 minute match: the timeout that the army and Strip decide (decision A). The warning starts in its last minute.
export const MATCH_SECONDS = 15 * 60;
const WARN_SECONDS = 60;

export function renderBar(state, { side = 0, tps = STATS.clock.ticksPerSecond, alert = null, alertTicks = 6 * 24, flow = null, matchTicks = MATCH_SECONDS * tps } = {}) {
  const p = state.toast?.pantry?.[side] ?? { flour: 0, water: 0 };
  const stack = state.toast?.stack?.[side] ?? 0;
  const r = flow ? flow.rates(side, state.tick) : null;
  const rate = (v, unit) => (r ? ` Coming in: about ${fmt(v)} ${unit} a minute.` : '');
  const chip = (id, label, value, { blink = false, bad = false, title = '', caption = '' } = {}) =>
    `<span class="res${blink ? ' blink' : ''}"${bad ? ' style="color:#ff5d5d"' : ''} title="${esc(title)}">${label} <b id="res-${id}"${bad ? ' style="color:#ff5d5d"' : ''}>${value}</b>${caption ? ` <small style="font-size:10px;opacity:.75">${caption}</small>` : ''}</span>`;
  const cap = pantryCapOf(state, side); // grows with each complete Toaster of this side
  const noFlour = !(p.flour > 0), noWater = !(p.water > 0);
  const pw = powerCount(state, side);
  const en = state.energy?.report?.[side] ?? null; // { made, used, shed } from env/energy.mjs, when Energy is on
  const cut = pw.total - pw.on;
  const up = upkeepOf(state, side);
  const overspend = up > 0 && up > (r ? r.wheat : 0) && state.tick > 30 * tps;
  const pilot = pilotLight(state, side);
  const fresh = alert && state.tick - alert.tick < alertTicks;
  let html = chip('shards', 'Wheat', Math.floor(state.shards[side]), { bad: state.shards[side] < 0, title: `Wheat: Crumbs haul it, the Mill grinds it, units cost it.${rate(r?.wheat, 'wheat')}` })
    + chip('flour', 'Flour', `${p.flour} / ${cap}`, { blink: noFlour, title: noFlour ? `Flour is out. Build a Mill (${STATS.structures.mill.cost} wheat).${rate(r?.flour, 'flour')}` : `Flour waiting for a Toaster (pantry holds ${cap}).${rate(r?.flour, 'flour')}` })
    + chip('water', 'Water', `${p.water} / ${cap}`, { blink: noWater, title: noWater ? `Water is out. Build a Well near the river.${rate(r?.water, 'water')}` : `Water waiting for a Toaster (pantry holds ${cap}).${rate(r?.water, 'water')}` })
    + chip('toast', 'Toast', stack, { blink: stack <= 0, title: `Toast is ammo: hungry Toasties cannot fire.${rate(r?.toast, 'slices')}` })
    + (en
      ? chip('power', 'Power', `${en.used} of ${en.made}`, { blink: en.shed > 0 || cut > 0, bad: en.used > en.made, caption: 'used of made', title: powerTitle(en, cut) })
      : chip('power', 'Power', pw.total ? `${pw.on}/${pw.total}` : 'on', { blink: cut > 0, title: cut > 0 ? `${cut} Toastie(s) cut off from power; re-plug them with a Crumb.` : 'Every Toastie is plugged in.' }));
  if (budgetOn(state)) {
    html += chip('upkeep', 'Upkeep', `${fmt(up)}/min`, { bad: overspend, title: `Upkeep: your army eats ${fmt(up)} wheat a minute${r ? `; you bring in about ${fmt(r.wheat)}` : ''}.${overspend ? ' You are spending more than you earn: send more Crumbs to the wheat.' : ''}` });
  }
  if (STATS.match.unitCap) {
    let used = state.units.filter((u) => u.owner === side).length;
    for (const s of state.structures) if (s.owner === side) used += s.queue.length;
    const cap = STATS.match.unitCap;
    if (budgetOn(state)) html += `<span class="res${used >= cap ? ' warn' : ''}" title="Toasties: units and queued units, out of the ${cap} cap">Toasties <b id="res-toasters">${used}/${cap}</b></span>`;
    else html += `<span class="res${used >= cap ? ' warn' : ''}" title="Supply: units and queued units / cap">Supply <b id="supply">${used}/${cap}</b></span>`;
  }
  if (pilot) html += `<span class="res warn" id="pilot" title="${esc(`Pilot light: your Power Strip bakes 1 emergency slice every ${pilot.everySeconds} s while toast is under ${pilot.floor}.`)}">Pilot light</span>`;
  const left = matchTicks - state.tick;
  const clock = left <= WARN_SECONDS * tps
    ? `<b id="clock" style="color:#ffb13b">${clockOf(Math.max(0, left), tps)} left · bigger army wins</b>`
    : `<b id="clock">${clockOf(state.tick, tps)}</b>`;
  return html
    + `<span class="res">${clock}</span>`
    + `<span id="alert">${fresh ? `${esc(alert.text)} (Space)` : ''}</span>`;
}
