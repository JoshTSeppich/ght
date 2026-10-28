// HUD for PLAYABLE.md items 6, 7, 8, 9, 23 (owner: sonnet): top bar, queue, badges, tooltips, cancel-train.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState, createPlayableState } from '../play/toaster-play.mjs';
import { renderBar, createFlowTracker, pilotLight } from '../play/hud-bar.mjs';
import { renderQueue, queueItems, cancelCommand, trainProgress } from '../play/hud-queue.mjs';
import { badgesFor, drawBadges, badgeVisible } from '../play/hud-badges.mjs';
import { tipFor, numbersOf } from '../play/hud-tips.mjs';
import { renderCard } from '../play/command-card.mjs';
import { renderSelectionPanel } from '../play/hud.mjs';
import { observe, createInitialState as createState } from '../env/state.mjs';
import { step } from '../env/sim.mjs';
import { STATS } from '../env/stats.mjs';
import { BAKERY, pantryCapOf } from '../env/bakery.mjs';

const fresh = () => createToasterState(7);
const strip = (s, side = 0) => s.structures.find((x) => x.kind === 'core' && x.owner === side);
const add = (s, kind, x, y, owner = 0) => { const b = { id: 900 + s.structures.length, owner, kind, x, y, hp: 200, progress: 0, complete: true, queue: [] }; s.structures.push(b); return b; };

test('top bar: Wheat Flour Water Toast Power Upkeep, no Supply under upkeep', () => {
  const html = renderBar(fresh(), { side: 0 });
  for (const w of ['Wheat', 'Flour', 'Water', 'Toast', 'Power', 'Upkeep', '0:00']) assert.match(html, new RegExp(w));
  assert.doesNotMatch(html, /Supply|Shards/);
});

test('upkeep is red only when it beats wheat income', () => {
  const s = fresh();
  s.tick = 24 * 120;
  s.units.push({ id: 800, owner: 0, kind: 'brute', x: 5, y: 5, hp: 240, carrying: 0, order: null });
  const flow = createFlowTracker();
  assert.match(renderBar(s, { side: 0, flow }), /Upkeep <b id="res-upkeep" style="color:#ff5d5d">/);
  flow.feed([{ e: 'deliver', id: s.units.find((u) => u.owner === 0 && u.kind === 'worker').id, amount: 500 }], s);
  assert.doesNotMatch(renderBar(s, { side: 0, flow }), /id="res-upkeep" style/);
});

test('income rates show on hover', () => {
  const s = fresh();
  s.tick = 24 * 60;
  const flow = createFlowTracker();
  flow.feed([{ e: 'mill', player: 0 }, { e: 'mill', player: 0 }, { e: 'well', player: 0 }, { e: 'bake', player: 0, slices: 4 }], s);
  const r = flow.rates(0, s.tick);
  assert.equal(r.flour, 2); assert.equal(r.water, 1); assert.equal(r.toast, 4);
  assert.match(renderBar(s, { side: 0, flow }), /title="[^"]*about 2 flour a minute/);
});

test('Power chip reads Energy used/made, goes red when loads were shed, and shows the old on/total without Energy', () => {
  const s = createPlayableState(7);
  const base = observe(s, 0).power.energy;
  const html = renderBar(s, { side: 0 });
  assert.match(html, new RegExp(`id="res-power"[^>]*>${base.used} of ${base.made}<`));
  assert.doesNotMatch(html, /id="res-power"[^>]*color:#ff5d5d/);
  s.energy.report[0] = { made: 2, used: 6, shed: 2 };
  const short = renderBar(s, { side: 0 });
  assert.match(short, /id="res-power"[^>]*color:#ff5d5d[^>]*>6 of 2</);
  assert.match(short, /2 load\(s\) went dark/);
  assert.doesNotMatch(renderBar(fresh(), { side: 0 }), /color:#ff5d5d[^>]*>\d+ of \d+</, 'no Energy block: the old plugged-in count');
});

test('selection shows a Hungry chip for a Popper with no toast, and none for a fed one', () => {
  const s = fresh();
  s.units = s.units.filter((u) => u.kind !== 'worker');
  const st = strip(s, 0);
  const p = { id: 880, owner: 0, kind: 'grunt', x: st.x + 2, y: st.y + 2, hp: 60, carrying: 0, order: null };
  s.units.push(p);
  step(s, [[], []]);
  s.ammo.slices[p.id] = 0; s.ammo.rounds[p.id] = 0; s.ammo.stock = [0, 0]; s.toast.stack = [0, 0];
  const pick = () => observe(s, 0).units.filter((u) => u.id === p.id);
  assert.match(renderSelectionPanel(observe(s, 0), pick(), { side: 0, live: s }), />Hungry</);
  s.ammo.slices[p.id] = 3;
  assert.doesNotMatch(renderSelectionPanel(observe(s, 0), pick(), { side: 0, live: s }), />Hungry</);
});

test('Pilot light chip shows while the stack is under the floor, hides above it', () => {
  const s = fresh();
  s.toast.stack[0] = BAKERY.pilotFloor - 1;
  assert.ok(pilotLight(s, 0));
  assert.match(renderBar(s, { side: 0 }), /Pilot light/);
  s.toast.stack[0] = BAKERY.pilotFloor;
  assert.equal(pilotLight(s, 0), null);
  assert.doesNotMatch(renderBar(s, { side: 0 }), /Pilot light/);
});

test('queue: progress bar and up to 5 icons that cancel', () => {
  const s = fresh();
  const st = strip(s);
  st.queue = ['worker', 'worker', 'worker', 'worker', 'worker'];
  st.training = STATS.units.worker.trainTicks / 2;
  assert.equal(trainProgress(st), 0.5);
  assert.equal(queueItems(st).length, STATS.match.queueMax);
  const html = renderQueue(st);
  assert.equal((html.match(/data-cancel=/g) || []).length, 5);
  assert.match(html, /width:50%/);
  assert.deepEqual(cancelCommand(`${st.id}:2`), { type: 'cancel-train', building: st.id, index: 2 });
  assert.equal(cancelCommand('junk'), null);
  assert.equal(renderQueue({ ...st, queue: [] }), '');
  const snap = observe(s, 0);
  const panel = renderSelectionPanel(snap, [snap.structures.find((x) => x.id === st.id)], { side: 0, live: s });
  assert.match(panel, /data-cancel=/);
});

test('cancel-train removes the unit and resets the head (upkeep match: no refund)', () => {
  const s = fresh();
  const st = strip(s);
  step(s, [[{ type: 'train', building: st.id, kind: 'worker' }, { type: 'train', building: st.id, kind: 'worker' }], []]);
  assert.equal(st.queue.length, 2);
  step(s, [[{ type: 'cancel-train', building: st.id, index: 1 }], []]);
  assert.equal(st.queue.length, 1);
  step(s, [[{ type: 'cancel-train', building: st.id, index: 0 }], []]);
  assert.equal(st.queue.length, 0);
  assert.equal(st.training ?? null, null);
  const bad = step(s, [[{ type: 'cancel-train', building: st.id, index: 3 }], []]);
  assert.ok(bad.some((e) => e.e === 'reject'));
});

test('cancel-train refunds the cost when units are paid up front', () => {
  const s = createState(3);
  const st = strip(s);
  const w0 = s.shards[0];
  step(s, [[{ type: 'train', building: st.id, kind: 'worker' }], []]);
  assert.equal(s.shards[0], w0 - STATS.units.worker.cost);
  step(s, [[{ type: 'cancel-train', building: st.id, index: 0 }], []]);
  assert.equal(s.shards[0], w0);
});

test('badges: Mill without wheat, full Mill, dry Well, starved Toaster; only your own', () => {
  const s = fresh();
  const mill = add(s, 'mill', 20, 20), well = add(s, 'well', 22, 20), toaster = add(s, 'toaster', 24, 20);
  s.shards[0] = 0; s.toast.pantry[0].flour = 0; s.toast.pantry[0].water = 0;
  well.dry = true;
  let b = Object.fromEntries(badgesFor(s, 0).map((x) => [x.id, x.icons]));
  assert.deepEqual(b[mill.id], ['wheat']);
  assert.deepEqual(b[well.id], ['water']);
  assert.ok(b[toaster.id].includes('flour') && b[toaster.id].includes('water'));
  s.shards[0] = 500; s.toast.pantry[0].flour = pantryCapOf(s, 0); well.dry = false;
  b = Object.fromEntries(badgesFor(s, 0).map((x) => [x.id, x.icons]));
  assert.deepEqual(b[mill.id], ['full']);
  assert.equal(b[well.id], undefined);
  assert.equal(badgesFor(s, 1).some((x) => x.id === mill.id), false);
});

test('badges draw only while blinking on', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, k) => (k === 'save' || k === 'restore' ? () => {} : (...a) => { calls.push(k); }), set: () => true });
  const badges = [{ id: 1, kind: 'mill', x: 3, y: 3, icons: ['wheat', 'full'] }];
  const proj = () => ({ sx: 100, sy: 100 });
  assert.equal(badgeVisible(0), true);
  assert.equal(badgeVisible(700), false);
  drawBadges(ctx, badges, proj, 30, 700);
  assert.equal(calls.length, 0);
  drawBadges(ctx, badges, proj, 30, 0);
  assert.ok(calls.includes('arc'));
});

test('tooltips: name, cost, hotkey, what it does, numbers from the tables', () => {
  const n = numbersOf();
  const mill = tipFor({ action: 'build', kind: 'mill', key: 'i', cost: STATS.structures.mill.cost });
  assert.match(mill, /^Build Mill \(I\), 75 Wheat\./);
  assert.ok(mill.includes(`${n.mill.wheat} wheat makes 1 flour every ${n.mill.everySeconds} s`));
  const popper = tipFor({ action: 'train', kind: 'grunt', key: 'o', cost: 50 });
  assert.match(popper, /^Train Popper \(O\), 50 Wheat\./);
  assert.match(popper, /HP/);
  assert.match(tipFor({ action: 'stop', key: 's', label: 'Stop' }), /^Stop \(S\)\./);
  assert.equal(tipFor({ action: 'mystery' }), null);
});

test('every button on every card has a tooltip with its hotkey', () => {
  const entries = [
    ...Object.keys(STATS.units).map((kind) => ({ key: 'c', kind, action: 'train', cost: STATS.units[kind].cost })),
    ...['mill', 'well', 'toaster', 'forge', 'turret'].map((kind) => ({ key: 'i', kind, action: 'build', cost: STATS.structures[kind].cost })),
    ...['extension', 'pylon'].map((kind) => ({ key: 'x', kind, action: 'build', cost: 30 })),
    ...['amove', 'stop', 'hold', 'move', 'rally'].map((action) => ({ key: 'a', action, label: action })),
  ];
  for (const e of entries) assert.ok(tipFor(e), `${e.kind ?? e.action} has a tip`);
  const html = renderCard([{ key: 'c', kind: 'worker', action: 'train', cost: 50 }], { shards: 999, tips: true });
  assert.match(html, /title="Train Crumb \(C\), 50 Wheat\./);
});
