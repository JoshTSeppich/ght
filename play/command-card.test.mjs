// The command card (decision E): every entry shows, hotkeys keep their cells, and a Crumb shows Windmill (N).
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS } from '../env/stats.mjs';
import { createInput } from './input.mjs';
import { toasterInputOptions } from './toaster-play.mjs';
import { layoutCard, renderCard, GRID_KEYS } from './command-card.mjs';

const crumbSnap = () => ({
  tick: 0, width: 40, height: 40, rocks: [], crystals: [], shards: { 0: 999, 1: 999 },
  units: [{ id: 1, owner: 0, kind: 'worker', x: 5, y: 5, hp: 10 }], structures: [],
});

/** Keys that appear in the card, once each, with the cell they sit on. */
const cellKeys = (cells) => cells.filter(Boolean).map((c) => c.entry.key);

// SYSTEMS-DESIGN.md section 4: the Crumb card is row 1 (5 universal) plus 10 build/gather entries = 15.
test('a Crumb card lists all 15 entries and the layout drops none of them', () => {
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions() });
  input.ui.selection = [1];
  const card = input.commandCard(crumbSnap());
  assert.equal(card.length, 15);
  const cells = layoutCard(card);
  assert.equal(cells.filter(Boolean).length, card.length);
  assert.deepEqual(cellKeys(cells).sort(), card.map((c) => c.key).sort());
});

// SYSTEMS-DESIGN.md section 4: Windmill is C on the grid profile.
test('Windmill (C) shows on the Crumb card and as a button', () => {
  const input = createInput({ side: 0, stats: STATS, ...toasterInputOptions() });
  input.ui.selection = [1];
  const card = input.commandCard(crumbSnap());
  const windmill = card.find((c) => c.kind === 'windmill');
  assert.ok(windmill, 'the Crumb card has a Windmill entry');
  assert.equal(windmill.key, 'c');
  assert.match(renderCard(card, { shards: 999 }), /data-kind="windmill"/);
});

test('no entry is ever dropped, whatever the card length', () => {
  for (let n = 0; n <= 40; n++) {
    const card = Array.from({ length: n }, (_, i) => ({ key: i % 2 ? 'a' : 'n', label: `e${i}`, action: 'build', kind: `k${i}` }));
    const cells = layoutCard(card);
    // SYSTEMS-DESIGN.md section 4: the card is a 5-column grid, at least 3 rows.
    assert.equal(cells.length % 5, 0, `n=${n}: whole rows of five`);
    assert.ok(cells.length >= 15, `n=${n}: at least the three rows`);
    assert.equal(cells.filter(Boolean).length, n, `n=${n}: every entry has a cell`);
    const kinds = cells.filter(Boolean).map((c) => c.entry.kind).sort();
    assert.deepEqual(kinds, card.map((c) => c.kind).sort());
  }
});

test('a button whose key is on the grid sits on that key cell, the rest fill in order', () => {
  const card = [
    { key: 'n', label: 'Windmill', kind: 'windmill', action: 'build' },
    { key: 'w', label: 'Well', kind: 'well', action: 'build' },
    { key: 'h', label: 'Hold', action: 'hold' },
  ];
  const cells = layoutCard(card);
  assert.equal(cells[GRID_KEYS.indexOf('w')]?.entry.kind, 'well');
  // Windmill and Hold are not on the grid: they take the first free cells, in card order.
  assert.equal(cells[0].entry.kind, 'windmill');
  assert.equal(cells[2].entry.action, 'hold');
});

// SYSTEMS-DESIGN.md section 4: 5 x 3 grid, growing a row when needed.
test('the card grows to five columns and as many rows as it needs', () => {
  const card = Array.from({ length: 16 }, (_, i) => ({ key: `z${i}`, label: `e${i}`, action: 'build', kind: `k${i}` }));
  const cells = layoutCard(card);
  assert.equal(cells.length, 20);
  assert.equal(cells.slice(15).filter(Boolean).length, 1, 'the 16th entry lands in row four');
});
