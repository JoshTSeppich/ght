// Training queue for the Power Strip and the Assembly Line (PLAYABLE.md item 7). Owner: sonnet (HUD). Pure helpers.
// A progress bar for the unit being trained and up to queueMax queued icons; clicking an icon cancels it (data-cancel).
import { STATS } from '../env/stats.mjs';
import { portraitSvg, kindName } from './hud.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 0..1 progress of the head of the queue. training is the structure's remaining ticks (null = not started yet). */
export function trainProgress(structure, stats = STATS) {
  const head = structure.queue?.[0];
  if (!head) return 0;
  const total = stats.units[head]?.trainTicks || 1;
  const left = structure.training ?? total;
  return Math.max(0, Math.min(1, 1 - left / total));
}

/** { kind, index, refund } for each queued unit: what the icon shows and what cancelling returns (0 under upkeep). */
export function queueItems(structure, { stats = STATS, budget = false } = {}) {
  return (structure.queue ?? []).slice(0, stats.match.queueMax).map((kind, index) => ({ kind, index, refund: budget ? 0 : stats.units[kind]?.cost ?? 0 }));
}

/** The queue panel: empty string when nothing is queued. */
export function renderQueue(structure, { stats = STATS, budget = false, tps = stats.clock.ticksPerSecond } = {}) {
  const items = queueItems(structure, { stats, budget });
  if (!items.length) return '';
  const head = items[0];
  const secs = Math.ceil(((structure.training ?? stats.units[head.kind]?.trainTicks ?? 0)) / tps);
  const pct = (trainProgress(structure, stats) * 100).toFixed(0);
  const waiting = structure.training === 0;
  const bar = `<div class="bar q-bar" title="${esc(`${kindName(head.kind)}: ${waiting ? 'ready, waiting for room' : `${secs} s left`}`)}"><i style="width:${pct}%;background:#ffb13b"></i></div>`;
  const icons = items.map((it) => {
    const tip = `${kindName(it.kind)}${it.index === 0 ? ' (baking)' : ' (waiting)'}. Click to cancel${it.refund ? `: ${it.refund} Wheat comes back` : ''}.`;
    return `<button class="pick q-item${it.index === 0 ? ' on' : ''}" data-cancel="${structure.id}:${it.index}" title="${esc(tip)}">${portraitSvg(it.kind, structure.owner, { size: 32, label: kindName(it.kind) })}</button>`;
  }).join('');
  return `<div class="queue">${bar}<div class="picks q-icons">${icons}</div></div>`;
}

/** Parse a data-cancel value into the sim command { type: 'cancel-train', building, index }, or null. */
export function cancelCommand(value) {
  const m = /^(\d+):(\d+)$/.exec(String(value ?? ''));
  return m ? { type: 'cancel-train', building: Number(m[1]), index: Number(m[2]) } : null;
}
