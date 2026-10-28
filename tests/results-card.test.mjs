// PLAYABLE.md item 11: results card numbers, html, last-match recording. Plus a real surrender through the live driver.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchStats, resultsCardHtml, clockOf, saveLastMatch, loadLastMatch, replayQuery, normalQuery } from '../play/results-card.mjs';

test('stats count wheat, slices and toasters lost for one side only', () => {
  const m = createMatchStats(0);
  m.note([{ id: 1, owner: 0 }, { id: 2, owner: 1 }], [
    { e: 'deliver', id: 1, amount: 7 }, { e: 'deliver', id: 2, amount: 9 },
    { e: 'bake', player: 0, slices: 4 }, { e: 'bake', player: 1, slices: 4 },
    { e: 'die', id: 1 }, { e: 'die', id: 2 },
  ]);
  m.note([], [{ e: 'die', id: 1 }]); // owner remembered after the unit left the list
  assert.deepEqual(m.totals, { wheat: 7, slices: 4, lost: 2 });
});

test('card shows winner, time, the three numbers and both buttons', () => {
  const html = resultsCardHtml({ winner: 0, reason: 'core', tick: 24 * 125 }, 0, { wheat: 640, slices: 52, lost: 3 });
  for (const t of ['VICTORY', 'You', '2:05', '640', '52', '3', 'id="restart"', 'id="replay"', 'Power Strip']) assert.ok(html.includes(t), t);
  assert.ok(resultsCardHtml({ winner: 1, reason: 'forfeit', tick: 10 }, 0, { wheat: 0, slices: 0, lost: 0 }).includes('You surrendered'));
  assert.equal(clockOf(24 * 61), '1:01');
});

test('last match round-trips through a store and replayQuery asks for it', () => {
  const mem = new Map();
  const store = { setItem: (k, v) => mem.set(k, v), getItem: (k) => mem.get(k) ?? null };
  assert.equal(loadLastMatch(store), null);
  assert.ok(saveLastMatch({ seed: 9, ticks: [{ tick: 0, commands: [[{ type: 'x' }], []] }, { tick: 1, commands: [[], []] }] }, store));
  const rec = loadLastMatch(store);
  assert.equal(rec.seed, 9);
  assert.deepEqual(Object.keys(rec.commands), ['0']);
  const q = new URLSearchParams(replayQuery(new URLSearchParams('seed=9&ai=sonnet')));
  assert.equal(q.get('mode'), 'watch'); assert.equal(q.get('replay'), 'last'); assert.equal(q.get('ai'), null);
});

test('card says whose Power Strip fell', () => {
  const totals = { wheat: 500, slices: 40, lost: 1 };
  assert.match(resultsCardHtml({ winner: 0, reason: 'core', tick: 100 }, 0, totals), /The enemy Power Strip fell\./);
  assert.match(resultsCardHtml({ winner: 1, reason: 'core', tick: 100 }, 0, totals), /Your Power Strip fell\./);
  assert.match(resultsCardHtml({ winner: null, reason: 'core', tick: 100 }, 0, totals), /Both Power Strips fell\./);
});

test('card gives one tip line from the numbers', () => {
  const none = resultsCardHtml({ winner: 1, reason: 'core', tick: 100 }, 0, { wheat: 300, slices: 0, lost: 0 });
  assert.match(none, /Build a Mill, a Well and a Toaster\./);
  const lost = resultsCardHtml({ winner: 1, reason: 'core', tick: 100 }, 0, { wheat: 300, slices: 40, lost: 6 });
  assert.match(lost, /You lost 6 toasters\./);
  const thin = resultsCardHtml({ winner: 1, reason: 'core', tick: 100 }, 0, { wheat: 120, slices: 40, lost: 0 });
  assert.match(thin, /Crumbs gathered only 120 wheat/);
  const fine = resultsCardHtml({ winner: 0, reason: 'core', tick: 100 }, 0, { wheat: 900, slices: 40, lost: 0 });
  assert.match(fine, /Keep the toast flowing/);
});

test('card offers Play again on Normal: a link to ?difficulty=normal that keeps the rest of the query', () => {
  const html = resultsCardHtml({ winner: 0, reason: 'core', tick: 100 }, 0, { wheat: 900, slices: 40, lost: 0 }, { query: '?seed=7&difficulty=easy' });
  assert.match(html, /<a id="again-normal" href="\?seed=7&amp;difficulty=normal">Play again on Normal<\/a>/);
  assert.equal(normalQuery(''), 'difficulty=normal');
  assert.equal(new URLSearchParams(normalQuery('?seed=7&difficulty=easy')).get('seed'), '7');
});
