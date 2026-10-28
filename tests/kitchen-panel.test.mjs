// The Kitchen panel (WELLS-TECH-TERRAIN.md section 2, ticket T1): the chain as boxes and arrows, live per-minute numbers and
// the greying of what the side does not own yet. Owner: haiku (Kitchen panel). Pure model and HTML; no DOM here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayableState } from '../play/toaster-play.mjs';
import { createFlowTracker } from '../play/hud-bar.mjs';
import { STATS } from '../env/stats.mjs';
import { ENERGY } from '../env/energy.mjs';
import { TOASTER_HOTKEYS } from '../play/toaster-play.mjs';
import { kitchenModel, kitchenHtml, millPlaced, autoOpenDue, keyAction, mountKitchenPanel, KITCHEN_FLAG } from '../play/kitchen-panel.mjs';

/** A playable match with the side's kitchen cleared, so each test adds only what it needs. */
const fresh = () => {
  const s = createPlayableState(7);
  s.structures = s.structures.filter((x) => x.kind === 'core');
  return s;
};
const build = (s, kind, owner = 0, complete = true) => {
  s.structures.push({ id: 9000 + s.structures.length, kind, owner, complete, hp: 200, queue: [], x: 10, y: 10 });
};

test('a fresh match greys the Mill, Well, Toaster, Windmill and Dam, and lights the Strip, Wheat and Power', () => {
  const m = kitchenModel(fresh(), 0);
  for (const id of ['mill', 'well', 'toaster', 'windmill', 'dam', 'flour', 'water', 'toast', 'fire']) assert.equal(m.boxes[id].owned, false, `${id} is not owned yet`);
  for (const id of ['wheat', 'strip', 'power']) assert.equal(m.boxes[id].owned, true, `${id} is always there`);
  const html = kitchenHtml(m);
  assert.match(html, /class="kb off" data-box="mill"/);
  assert.match(html, /class="kb" data-box="strip"/);
});

// SYSTEMS-DESIGN.md section 4: grid keys Mill A, Well S, Toaster D, Windmill C, Dam V.
test('a greyed box shows its cost and hotkey (Mill 75 A, Well 50 S, Toaster 100 D, Windmill 40 C, Dam 90 V)', () => {
  const m = kitchenModel(fresh(), 0);
  assert.equal(m.boxes.mill.cost, STATS.structures.mill.cost);
  assert.equal(m.boxes.well.cost, STATS.structures.well.cost);
  assert.equal(m.boxes.toaster.cost, STATS.structures.toaster.cost);
  assert.equal(m.boxes.windmill.cost, ENERGY.cost.windmill);
  assert.equal(m.boxes.dam.cost, ENERGY.cost.dam);
  assert.equal(m.boxes.mill.hotkey, TOASTER_HOTKEYS.mill);
  const html = kitchenHtml(m);
  assert.match(html, /data-box="mill"[^>]*>[\s\S]*?75 wheat[\s\S]*?<kbd>A<\/kbd>/);
  assert.match(html, /data-box="dam"[^>]*>[\s\S]*?90 wheat[\s\S]*?<kbd>V<\/kbd>/);
});

test('a finished Mill lights the Mill and Flour; an unfinished one does not', () => {
  const s = fresh();
  build(s, 'mill', 0, false);
  assert.equal(kitchenModel(s, 0).boxes.mill.owned, false, 'a Mill still building is not owned yet');
  s.structures.at(-1).complete = true;
  const m = kitchenModel(s, 0);
  assert.equal(m.boxes.mill.owned, true);
  assert.equal(m.boxes.flour.owned, true, 'flour comes from the Mill');
  assert.equal(m.boxes.water.owned, false, 'a Mill does not make water');
  assert.match(kitchenHtml(m), /class="kb" data-box="mill"/);
});

test('the other side\'s buildings do not light your boxes', () => {
  const s = fresh();
  build(s, 'well', 1);
  assert.equal(kitchenModel(s, 0).boxes.well.owned, false);
});

test('a Windmill or a Dam you own lights its Power box source, and a Dam counts for the Mill Dam too', () => {
  const s = fresh();
  build(s, 'milldam', 0);
  const m = kitchenModel(s, 0);
  assert.equal(m.boxes.dam.owned, true, 'the Mill Dam is a Dam');
  assert.equal(m.boxes.windmill.owned, false);
});

test('per-minute numbers come from the last 60 s of flow events on each arrow', () => {
  const s = fresh();
  s.tick = 60 * STATS.clock.ticksPerSecond;
  s.units.push({ id: 501, owner: 0 });
  const flow = createFlowTracker();
  flow.feed([
    { e: 'deliver', id: 501, amount: 10 }, { e: 'deliver', id: 501, amount: 2 },
    { e: 'mill', player: 0 }, { e: 'mill', player: 0 }, { e: 'mill', player: 0 },
    { e: 'well', player: 0 },
    { e: 'bake', player: 0, slices: 4 },
  ], s);
  const m = kitchenModel(s, 0, { flow });
  assert.equal(m.arrows.wheat.value, 12, 'wheat hauled in the last minute');
  assert.equal(m.arrows.flour.value, 3);
  assert.equal(m.arrows.water.value, 1);
  assert.equal(m.arrows.toast.value, 4);
  assert.match(kitchenHtml(m), /12 wheat\/min/);
  assert.match(kitchenHtml(m), /3 flour\/min/);
});

test('an event older than 60 s no longer counts', () => {
  const s = fresh();
  s.tick = 60 * STATS.clock.ticksPerSecond;
  const flow = createFlowTracker();
  flow.feed([{ e: 'mill', player: 0 }], s);
  s.tick = 130 * STATS.clock.ticksPerSecond;
  flow.feed([], s);
  assert.equal(kitchenModel(s, 0, { flow }).arrows.flour.value, 0);
});

test('without a flow tracker the arrows read zero, not NaN', () => {
  const m = kitchenModel(fresh(), 0);
  for (const k of ['wheat', 'flour', 'water', 'toast']) assert.equal(m.arrows[k].value, 0);
  assert.doesNotMatch(kitchenHtml(m), /NaN/);
});

test('the Power arrow reads used of made from the energy report', () => {
  const s = fresh();
  s.energy = { report: [{ made: 5, used: 2, shed: 0 }, { made: 0, used: 0, shed: 0 }] };
  const m = kitchenModel(s, 0);
  assert.equal(m.arrows.power.used, 2);
  assert.equal(m.arrows.power.made, 5);
  assert.match(kitchenHtml(m), /2 of 5 used/);
});

test('with Energy off the Power arrow says power is on instead of a made figure', () => {
  const s = fresh();
  delete s.energy;
  const m = kitchenModel(s, 0);
  assert.equal(m.arrows.power.made, null);
  assert.doesNotMatch(kitchenHtml(m), /of null/);
});

test('millPlaced sees a Mill of yours while it is still building, and ignores the other side', () => {
  const s = fresh();
  assert.equal(millPlaced(s, 0), false);
  build(s, 'mill', 1);
  assert.equal(millPlaced(s, 0), false);
  build(s, 'mill', 0, false);
  assert.equal(millPlaced(s, 0), true);
});

test('the panel auto-opens once, the first time a Mill is placed (sessionStorage flag)', () => {
  const s = fresh();
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  assert.equal(autoOpenDue(s, 0, storage), false, 'no Mill yet');
  build(s, 'mill', 0, false);
  assert.equal(autoOpenDue(s, 0, storage), true);
  storage.setItem(KITCHEN_FLAG, '1');
  assert.equal(autoOpenDue(s, 0, storage), false, 'the flag stops a second auto-open');
});

test('K toggles the panel, Esc closes it when open, and other keys pass through', () => {
  assert.equal(keyAction('k', { open: false, trainable: false }), 'open');
  assert.equal(keyAction('K', { open: true, trainable: false }), 'close');
  assert.equal(keyAction('Escape', { open: true, trainable: false }), 'close');
  assert.equal(keyAction('Escape', { open: false, trainable: false }), null, 'Esc with the panel shut cancels a command as before');
  assert.equal(keyAction('x', { open: false, trainable: false }), null);
});

test('K trains a Flak Popper when the selected building can train one, so the hotkey is not lost', () => {
  assert.equal(keyAction('k', { open: false, trainable: true }), null);
  assert.equal(keyAction('k', { open: true, trainable: true }), 'close', 'an open panel still closes on K');
});

test('the mounted panel opens on K, re-renders the numbers, closes on Esc, and auto-opens for the first Mill', () => {
  const made = [];
  const fakeEl = () => ({ hidden: false, innerHTML: '', className: '', id: '', appendChild() {}, addEventListener() {}, setAttribute() {} });
  const doc = { createElement: () => { const e = fakeEl(); made.push(e); return e; }, body: { appendChild() {} } };
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const s = fresh();
  const k = mountKitchenPanel(doc, { storage });
  const el = made[0];
  assert.equal(el.hidden, true, 'shut at first');
  k.update(s, 0);
  assert.equal(el.hidden, true, 'no Mill, no auto-open');
  assert.equal(k.handleKey('k'), true);
  assert.equal(el.hidden, false, 'K opens');
  assert.match(el.innerHTML, /data-box="mill"/, 'it draws on open');
  assert.equal(k.handleKey('Escape'), true);
  assert.equal(el.hidden, true, 'Esc closes');
  assert.equal(k.handleKey('Escape'), false, 'Esc with the panel shut is not ours');
  build(s, 'mill', 0, false);
  k.update(s, 0);
  assert.equal(el.hidden, false, 'the first Mill opens it once');
  assert.equal(store.get(KITCHEN_FLAG), '1');
  k.close();
  k.update(s, 0);
  assert.equal(el.hidden, true, 'a second update does not re-open it');
});
