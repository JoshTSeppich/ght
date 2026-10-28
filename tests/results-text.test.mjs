// Match Flow item 2 (ROLE-CARDS section 10): the results card gives one line per end reason, and a timeout names the number that decided it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resultsCardHtml } from '../play/results-card.mjs';

const totals = { wheat: 500, slices: 40, lost: 1 };
const card = (result, side = 0) => resultsCardHtml({ tick: 24 * 60, ...result }, side, totals);

test('a Power Strip kill names whose Strip fell', () => {
  assert.match(card({ winner: 0, reason: 'core' }), /The enemy Power Strip fell\./);
  assert.match(card({ winner: 1, reason: 'core' }), /Your Power Strip fell\./);
});

test('a territory win says the Reaches were held, for the winner and the loser', () => {
  assert.match(card({ winner: 0, reason: 'territory' }), /You held enough Reaches to win\./);
  assert.match(card({ winner: 1, reason: 'territory' }), /The other side held enough Reaches to win\./);
  assert.doesNotMatch(card({ winner: 0, reason: 'territory' }), /Both Power Strips fell/);
});

test('a stalemate says nobody fought and that it was scored like a timeout', () => {
  assert.match(card({ winner: 0, reason: 'stalemate', score: [2800, 2400], damage: [0, 0] }), /Nobody fought, so the match ended as a stalemate, scored like a timeout\./);
});

test('a timeout names the board value that decided it, from the side that played', () => {
  assert.match(card({ winner: 0, reason: 'timeout', score: [2800, 2400], damage: [0, 0] }), /Time ran out\. Board value 2800 to 2400 decided it\./);
  assert.match(card({ winner: 1, reason: 'timeout', score: [2400, 2800], damage: [0, 0] }, 0), /Board value 2400 to 2800 decided it\./);
});

test('a timeout level on board names the damage that decided it', () => {
  assert.match(card({ winner: 0, reason: 'timeout', score: [2800, 2800], damage: [300, 120] }), /Damage to enemy buildings 300 to 120 decided it\./);
});

test('a timeout level on board and damage says the Wheat bank decided it', () => {
  assert.match(card({ winner: 1, reason: 'timeout', score: [2800, 2800], damage: [0, 0] }, 0), /Wheat in the bank decided it\./);
});

test('a timeout level on board, damage and Wheat is a true draw, not the stronger side', () => {
  const html = card({ winner: null, reason: 'timeout', score: [2800, 2800], damage: [0, 0] });
  assert.match(html, /DRAW/);
  assert.match(html, /true draw/);
  assert.doesNotMatch(html, /stronger side wins/);
});

test('a forfeit the AI caused says the opponent crashed or timed out, not that it gave up', () => {
  const html = card({ winner: 0, reason: 'forfeit' });
  assert.match(html, /The opponent crashed or timed out\./);
  assert.doesNotMatch(html, /gave up/);
});

test('a surrender by you still says you surrendered', () => {
  assert.match(card({ winner: 1, reason: 'forfeit' }), /You surrendered\./);
});
