// The Opponent choice (PLAYABLE.md item 12): easy is the default, normal is toaster-sonnet, none is the sandbox (owner: sonnet).
import test from 'node:test';
import assert from 'node:assert/strict';
import { opponentLevel, opponentAiName, opponentSearch, mountOpponentChoice } from '../play/opponent.mjs';
import { sandboxMode } from '../play/sandbox.mjs';

const q = (s) => new URLSearchParams(s);

test('easy by default, normal and none on request', () => {
  assert.equal(opponentLevel(q('')), 'easy');
  assert.equal(opponentLevel(q('difficulty=bogus')), 'easy');
  assert.equal(opponentLevel(q('difficulty=normal')), 'normal');
  assert.equal(opponentAiName(q(''), true), 'toaster-easy');
  assert.equal(opponentAiName(q('difficulty=easy'), true), 'toaster-easy');
  assert.equal(opponentAiName(q('difficulty=normal'), true), 'toaster-sonnet');
  assert.equal(opponentAiName(q('ai=haiku'), true), 'haiku');
  assert.equal(opponentAiName(q(''), false), 'builtin', 'classic keeps the old AI');
});

test('none is the sandbox, and leaving it drops mode=sandbox', () => {
  assert.equal(sandboxMode(q('difficulty=none')), true);
  assert.equal(sandboxMode(q('difficulty=easy')), false);
  assert.equal(opponentSearch('?seed=4&mode=sandbox', 'easy'), '?seed=4&difficulty=easy');
  assert.equal(opponentSearch('', 'none'), '?difficulty=none');
});

test('the menu gets an Opponent select that reloads with the choice', () => {
  const made = [];
  const el = (tag) => {
    const e = { tag, children: [], listeners: {}, appendChild(c) { this.children.push(c); return c; }, addEventListener(t, f) { this.listeners[t] = f; } };
    made.push(e); return e;
  };
  const resume = {};
  const box = { insertBefore(n, ref) { this.inserted = [n, ref]; }, querySelector: (s) => (s === '#mm-resume' ? resume : null) };
  const root = { ownerDocument: { createElement: el }, querySelector: (s) => (s === '#matchmenu' ? box : null) };
  let went = null;
  const sel = mountOpponentChoice(root, { level: 'easy', search: '?seed=2', go: (s) => { went = s; } });
  assert.deepEqual(sel.children.map((o) => o.textContent), ['Easy', 'Normal', 'None']);
  assert.equal(sel.children.find((o) => o.selected).value, 'easy');
  assert.equal(box.inserted[1], resume);
  sel.value = 'normal';
  sel.listeners.change();
  assert.equal(went, '?seed=2&difficulty=normal');
  assert.equal(mountOpponentChoice({ querySelector: () => null }, {}), null);
});
