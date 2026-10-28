// Match Flow item 3 (ROLE-CARDS section 10): Play again keeps every setting of the match, only the difficulty changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resultsCardHtml, normalQuery } from '../play/results-card.mjs';

const result = { winner: 0, reason: 'core', tick: 100 };
const totals = { wheat: 900, slices: 40, lost: 0 };
const linkOf = (query) => new URL(resultsCardHtml(result, 0, totals, { query }).match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&'), 'http://x/').searchParams;

test('Play again keeps seed, ticks, side, keys, mute and tutorial', () => {
  const q = new URLSearchParams('seed=42&ticks=9000&side=1&keys=classic&mute=1&tutorial=0&territory=1&difficulty=easy');
  const link = linkOf('?' + q.toString());
  for (const [k, v] of q) {
    if (k === 'difficulty') continue;
    assert.equal(link.get(k), v, k);
  }
});

test('Play again on Normal sets difficulty=normal and nothing else changes', () => {
  const link = linkOf('?seed=42&difficulty=easy&keys=modern');
  assert.equal(link.get('difficulty'), 'normal');
  assert.equal(link.get('seed'), '42');
  assert.equal(link.get('keys'), 'modern');
});

test('the live page hands its query to the card (app.mjs showResultsCard)', async () => {
  const src = await readFile(new URL('../play/app.mjs', import.meta.url), 'utf8');
  assert.match(src, /resultsCardHtml\(result, side, totals, \{ tps, query: q \}\)/);
});

test('a match started with no query still gets the Normal link', () => {
  assert.equal(linkOf('').get('difficulty'), 'normal');
  assert.equal(normalQuery(new URLSearchParams('seed=7&side=0')), 'seed=7&side=0&difficulty=normal');
});
