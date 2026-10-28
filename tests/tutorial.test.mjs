// Item 29: the first-match tutorial (play/tutorial.mjs). Owner: haiku. Steps read real game state, never a timer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIAL_STEPS, tutorialOn, tutorialProgress } from '../play/tutorial.mjs';
import { STATS } from '../env/stats.mjs';

const maxCore = STATS.toaster?.coreHp ?? STATS.core.hp;
const snap = ({ units = [], structures = [] } = {}) => ({ units, structures });
const me = { id: 1, owner: 0, kind: 'worker' };
const built = (kind, owner = 0, extra = {}) => ({ id: 100 + Math.random() * 1e6 | 0, owner, kind, complete: true, hp: 100, ...extra });
const enemyStrip = (hp = maxCore) => ({ id: 9, owner: 1, kind: 'core', complete: true, hp });

test('the tutorial has exactly five steps in the order from PLAYABLE.md item 29', () => {
  assert.deepEqual(TUTORIAL_STEPS.map((s) => s.id), ['wheat', 'kitchen', 'poppers', 'boxes', 'strip']);
  for (const s of TUTORIAL_STEPS) {
    assert.ok(s.title && s.body, `step ${s.id} needs a title and a body`);
    assert.ok(s.body.length <= 140, `step ${s.id} copy is short`);
  }
});

test('?tutorial=0 turns the guide off; anything else leaves it on', () => {
  assert.equal(tutorialOn(new URLSearchParams('tutorial=0')), false);
  assert.equal(tutorialOn(new URLSearchParams('')), true);
  assert.equal(tutorialOn(new URLSearchParams('tutorial=1')), true);
});

test('a fresh match shows step 1 as current and nothing done', () => {
  const p = tutorialProgress(snap({ units: [me] }), 0, { wheatGathered: 0 });
  assert.equal(p.current, 0);
  assert.equal(p.finished, false);
  assert.deepEqual(p.steps.map((s) => s.done), [false, false, false, false, false]);
});

test('step 1 completes when wheat has been gathered', () => {
  const p = tutorialProgress(snap({ units: [me] }), 0, { wheatGathered: 10 });
  assert.equal(p.steps[0].done, true);
  assert.equal(p.current, 1);
});

test('step 2 needs a complete Mill, Well and Toaster; an unfinished one does not count', () => {
  const partial = snap({ structures: [built('mill'), built('well'), built('toaster', 0, { complete: false })] });
  assert.equal(tutorialProgress(partial, 0, { wheatGathered: 5 }).steps[1].done, false);
  const all = snap({ structures: [built('mill'), built('well'), built('toaster')] });
  assert.equal(tutorialProgress(all, 0, { wheatGathered: 5 }).steps[1].done, true);
});

test('the enemy\'s buildings never complete our steps', () => {
  const theirs = snap({ structures: [built('mill', 1), built('well', 1), built('toaster', 1)], units: [{ id: 5, owner: 1, kind: 'grunt' }] });
  const p = tutorialProgress(theirs, 0, { wheatGathered: 5 });
  assert.deepEqual(p.steps.map((s) => s.done), [true, false, false, false, false]);
});

test('step 3 needs one Popper (grunt) of ours', () => {
  const p = tutorialProgress(snap({ units: [{ id: 3, owner: 0, kind: 'grunt' }] }), 0, { wheatGathered: 5 });
  assert.equal(p.steps[2].done, true);
});

test('step 4 needs two complete Extension Boxes', () => {
  const one = snap({ structures: [built('extension')] });
  assert.equal(tutorialProgress(one, 0).steps[3].done, false);
  const two = snap({ structures: [built('extension'), built('extension')] });
  assert.equal(tutorialProgress(two, 0).steps[3].done, true);
});

test('step 5 completes when the enemy Power Strip is hurt, and not before', () => {
  assert.equal(tutorialProgress(snap({ structures: [enemyStrip()] }), 0).steps[4].done, false);
  assert.equal(tutorialProgress(snap({ structures: [enemyStrip(maxCore - 50)] }), 0).steps[4].done, true);
});

test('steps show in order: a later step waits for the earlier one', () => {
  const p = tutorialProgress(snap({ structures: [enemyStrip(maxCore - 50)] }), 0, { wheatGathered: 0 });
  assert.equal(p.steps[4].done, true);
  assert.equal(p.current, 0);
});

test('all five done means finished, with no current step', () => {
  const p = tutorialProgress(snap({
    units: [{ id: 3, owner: 0, kind: 'grunt' }],
    structures: [built('mill'), built('well'), built('toaster'), built('extension'), built('extension'), enemyStrip(maxCore - 1)],
  }), 0, { wheatGathered: 1 });
  assert.equal(p.finished, true);
  assert.equal(p.current, -1);
});

test('the step copy is plain text in toaster voice, never a raw key name or undefined', () => {
  for (const s of TUTORIAL_STEPS) assert.doesNotMatch(`${s.title} ${s.body}`, /undefined|null|\[object/);
});

test('the card marks done steps with a tick, the current one as now, and the rest as later', async () => {
  const { tutorialHtml } = await import('../play/tutorial-card.mjs');
  const p = tutorialProgress(snap({ units: [me] }), 0, { wheatGathered: 4 });
  const html = tutorialHtml(p);
  assert.equal((html.match(/class="done"/g) || []).length, 1);
  assert.equal((html.match(/class="now"/g) || []).length, 1);
  assert.equal((html.match(/class="later"/g) || []).length, 3);
  assert.match(html, /data-close/);
});

test('the finished card says so, and the card escapes its own text', async () => {
  const { tutorialHtml } = await import('../play/tutorial-card.mjs');
  const done = tutorialProgress(snap({
    units: [{ id: 3, owner: 0, kind: 'grunt' }],
    structures: [built('mill'), built('well'), built('toaster'), built('extension'), built('extension'), enemyStrip(maxCore - 1)],
  }), 0, { wheatGathered: 1 });
  assert.match(tutorialHtml(done), /Tutorial done/);
  const bad = { steps: [{ title: '<img>', body: '"x"', done: false }], current: 0, finished: false };
  assert.doesNotMatch(tutorialHtml(bad), /<img>/);
});

test('the objective line under the top bar is the one sentence from the brief', async () => {
  const { OBJECTIVE } = await import('../play/tutorial.mjs');
  assert.equal(OBJECTIVE, 'Feed your Toasties. Destroy the enemy Power Strip.'); // DECISIONS 7: official rename
});

test('the page mounts the guide on by default and shows the objective (app.mjs wiring)', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../play/app.mjs', import.meta.url), 'utf8');
  assert.match(src, /tutorialOn\(q\)/, 'the guide is gated by ?tutorial=0');
  assert.match(src, /mountTutorial\(/);
  assert.match(src, /tutorialProgress\(/);
  assert.match(src, /OBJECTIVE/);
});
