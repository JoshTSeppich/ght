// The GHT command card: a locked entry stays on its cell with its key, greyed, and says why on hover.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createInput } from '../play/input.mjs';
import { toasterInputOptions } from '../play/toaster-play.mjs';
import { layoutCard, renderCard, tooltip } from '../play/command-card.mjs';

const TPS = STATS.clock.ticksPerSecond;
const crumb = (extra = {}) => ({
  tick: 0, width: 40, height: 40, rocks: [], crystals: [], shards: { 0: 999, 1: 999 },
  units: [{ id: 1, owner: 0, kind: 'worker', x: 5, y: 5, hp: 10 }], structures: [], ...extra,
});
const strip = (extra = {}) => ({
  tick: 0, width: 40, height: 40, rocks: [], crystals: [], shards: { 0: 999, 1: 999 }, units: [],
  structures: [{ id: 2, owner: 0, kind: 'core', x: 5, y: 5, hp: 100, complete: true, queue: [] }], ...extra,
});
const forgeOf = (complete = true) => ({ id: 3, owner: 0, kind: 'forge', x: 8, y: 8, hp: 400, complete, queue: [] });
const toasterOf = { id: 4, owner: 0, kind: 'toaster', x: 2, y: 8, hp: 250, complete: true };

const input = () => {
  const i = createInput({ side: 0, stats: STATS, ...toasterInputOptions() });
  return i;
};
const entry = (card, action, kind) => card.find((e) => e.action === action && e.kind === kind);

test('a Crumb card keeps all 15 entries (the universal row, 9 buildings, Gather), locked ones included, and no key goes missing', () => {
  const i = input();
  i.ui.selection = [1];
  const card = i.commandCard(crumb());
  assert.equal(card.length, 15);
  const cells = layoutCard(card);
  assert.equal(cells.filter(Boolean).length, card.length);
});

test('Assembly Line and Relay Pylon are locked on a fresh board: "Needs a Toaster", key kept', () => {
  const i = input();
  i.ui.selection = [1];
  const card = i.commandCard(crumb());
  const forge = entry(card, 'build', 'forge');
  assert.equal(forge.locked, true);
  assert.equal(forge.reason, 'Needs a Toaster');
  assert.equal(forge.key, 'f');
  assert.equal(entry(card, 'build', 'pylon').reason, 'Needs a Toaster');
});

test('Tier 1 buttons on the Crumb card are open: Mill, Well, Toaster, Extension Box, Heat Lamp, Windmill, Dam', () => {
  const i = input();
  i.ui.selection = [1];
  const card = i.commandCard(crumb());
  for (const kind of ['mill', 'well', 'toaster', 'extension', 'turret', 'windmill', 'dam']) {
    assert.equal(entry(card, 'build', kind).locked, false, kind);
    assert.equal(entry(card, 'build', kind).reason, undefined, kind);
  }
});

test('the Assembly Line unlocks once a complete Toaster of yours stands', () => {
  const i = input();
  i.ui.selection = [1];
  const card = i.commandCard(crumb({ structures: [toasterOf] }));
  assert.equal(entry(card, 'build', 'forge').locked, false);
  assert.equal(entry(card, 'build', 'pylon').locked, false);
  assert.equal(entry(card, 'build', 'forge').key, 'f');
});

test('a Toaster still going up does not unlock the Assembly Line', () => {
  const i = input();
  i.ui.selection = [1];
  const card = i.commandCard(crumb({ structures: [{ ...toasterOf, complete: false }] }));
  assert.equal(entry(card, 'build', 'forge').reason, 'Needs a Toaster');
});

test('the Assembly Line card lists its Popper, Zapper and Four-Slice, each locked by its own tier', () => {
  const i = input();
  i.ui.selection = [3];
  const card = i.commandCard(strip({ structures: [forgeOf(true)] }));
  assert.equal(entry(card, 'train', 'grunt').reason, 'Needs a Toaster');
  assert.equal(entry(card, 'train', 'brute').reason, 'Needs a Windmill or Dam');
  assert.equal(entry(card, 'train', 'brute').key, 'f', 'Four-Slice keeps its key');
});

test('Powered units open with a Windmill of yours, and the Kitchen keeps its Toaster', () => {
  const i = input();
  i.ui.selection = [3];
  const powered = { ...strip({ structures: [forgeOf(true), toasterOf] }), power: { points: [{ id: 9, owner: 0, kind: 'windmill', x: 1, y: 1, range: 3 }] } };
  const card = i.commandCard(powered);
  assert.equal(entry(card, 'train', 'grunt').locked, false);
  assert.equal(entry(card, 'train', 'brute').locked, false);
});

test('Wheat lock: a Mill at 75 Wheat is greyed "Not enough Wheat (75)" with 30 in the pantry, and open at 75', () => {
  const i = input();
  i.ui.selection = [1];
  const poor = i.commandCard(crumb({ shards: { 0: 30, 1: 999 } }));
  assert.equal(entry(poor, 'build', 'mill').locked, true);
  assert.equal(entry(poor, 'build', 'mill').reason, 'Not enough Wheat (75)');
  const enough = i.commandCard(crumb({ shards: { 0: 75, 1: 999 } }));
  assert.equal(entry(enough, 'build', 'mill').locked, false);
});

test('a Tier 2 lock and a Wheat lock: the Kitchen reason comes first', () => {
  const i = input();
  i.ui.selection = [1];
  const card = i.commandCard(crumb({ shards: { 0: 10, 1: 999 } }));
  assert.equal(entry(card, 'build', 'forge').reason, 'Needs a Toaster');
});

test('renderCard: a locked button is greyed, keeps its key, and its tooltip names the reason, the cost and the build time', () => {
  const i = input();
  i.ui.selection = [1];
  const card = i.commandCard(crumb());
  const html = renderCard(card, { shards: 999, tips: true });
  const forgeTag = html.match(/<button class="cc locked"[^>]*data-kind="forge"[^>]*>/)?.[0];
  assert.ok(forgeTag, 'forge button is greyed (class locked)');
  assert.match(forgeTag, /data-key="f"/);
  assert.match(forgeTag, /opacity:\.4/);
  assert.match(forgeTag, /title="Needs a Toaster\./);
  assert.match(forgeTag, /150 Wheat/);
  assert.match(forgeTag, new RegExp(`Takes ${(STATS.structures.forge.buildTicks / TPS).toFixed(1).replace(/\.0$/, '')} s`));
});

test('renderCard: an open button has no locked class and no grey style', () => {
  const i = input();
  i.ui.selection = [1];
  const html = renderCard(i.commandCard(crumb({ structures: [toasterOf] })), { shards: 999, tips: true });
  const millTag = html.match(/<button class="cc"[^>]*data-kind="mill"[^>]*>/)?.[0];
  assert.ok(millTag);
  assert.doesNotMatch(millTag, /opacity/);
});

const crumbCard = (extra) => { const i = input(); i.ui.selection = [1]; return i.commandCard(crumb(extra)); };

test('tooltip() puts the lock reason first and keeps the one-line description after it', () => {
  const card = crumbCard();
  const text = tooltip({ ...entry(card, 'build', 'forge'), key: 'f' }, { tips: true });
  assert.ok(text.startsWith('Needs a Toaster. '), text);
  assert.match(text, /Assembly Line/);
});

test('an open entry carries no reason text', () => {
  const card = crumbCard();
  const text = tooltip({ ...entry(card, 'build', 'mill'), key: 'i' }, { tips: true });
  assert.doesNotMatch(text, /Needs|Not enough/);
});
