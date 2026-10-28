// Top bar words (WHAT-IS-LEFT rank 10; sense.md rows 6, 10, 11 and the stranger table): Power used of made, Toasters N/40
// under upkeep, the 14:00 timeout warning, the Mill hint and the Pilot light hover. Owner: haiku.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createToasterState, createPlayableState } from '../play/toaster-play.mjs';
import { renderBar } from '../play/hud-bar.mjs';
import { STATS } from '../env/stats.mjs';
import { BAKERY, pantryCapOf } from '../env/bakery.mjs';

const fresh = () => createToasterState(7);

test('Flour and Water chips read "x / cap", and the cap grows with each complete Toaster of that side', () => {
  const s = fresh();
  s.structures = s.structures.filter((b) => !(b.kind === 'toaster' && b.owner === 0));
  s.toast.pantry[0] = { flour: 7, water: 2, energy: 0 };
  const none = renderBar(s, { side: 0 });
  assert.match(none, /id="res-flour"[^>]*>7 \/ 6</);
  assert.match(none, /id="res-water"[^>]*>2 \/ 6</);
  assert.match(none, /title="Flour waiting for a Toaster \(pantry holds 6\)/);
  s.structures.push({ id: 990, kind: 'toaster', owner: 0, x: 30, y: 30, hp: 200, progress: 0, complete: true, queue: [] });
  const one = renderBar(s, { side: 0 });
  assert.equal(pantryCapOf(s, 0), 9);
  assert.match(one, /id="res-flour"[^>]*>7 \/ 9</);
  assert.match(one, /id="res-water"[^>]*>2 \/ 9</);
  assert.match(one, /title="Flour waiting for a Toaster \(pantry holds 9\)/);
  assert.doesNotMatch(one, /full/i);
});

test('Power chip reads "used of made" with a visible caption, and goes red only when used beats made', () => {
  const s = createPlayableState(7);
  s.energy.report[0] = { made: 2, used: 0, shed: 0 };
  const calm = renderBar(s, { side: 0 });
  assert.match(calm, /Power <b id="res-power"[^>]*>0 of 2<\/b>/);
  assert.match(calm, /<small[^>]*>used of made<\/small>/);
  assert.doesNotMatch(calm, /id="res-power"[^>]*color:#ff5d5d/);
  s.energy.report[0] = { made: 2, used: 2, shed: 0 };
  assert.doesNotMatch(renderBar(s, { side: 0 }), /id="res-power"[^>]*color:#ff5d5d/, 'used equal to made is not red');
  s.energy.report[0] = { made: 2, used: 6, shed: 2 };
  const short = renderBar(s, { side: 0 });
  assert.match(short, /id="res-power"[^>]*color:#ff5d5d[^>]*>6 of 2<\/b>/);
  assert.match(short, /<small[^>]*>used of made<\/small>/);
  assert.match(short, /2 load\(s\) went dark/);
});

test('GHT shows Upkeep and a Toasties N/40 chip with the unit cap', () => {
  const s = fresh();
  const side0 = s.units.filter((u) => u.owner === 0).length;
  const html = renderBar(s, { side: 0 });
  assert.match(html, /Upkeep <b/);
  const m = html.match(/Toasties <b id="res-toasters">(\d+)\/(\d+)<\/b>/);
  assert.ok(m, 'Toasties chip is there'); // DECISIONS 7: official rename
  assert.equal(Number(m[1]), side0 + sumQueues(s, 0));
  assert.equal(Number(m[2]), STATS.match.unitCap);
  assert.doesNotMatch(html, /Supply/);
});

function sumQueues(s, side) {
  let n = 0;
  for (const b of s.structures) if (b.owner === side) n += b.queue.length;
  return n;
}

test('from 14:00 the clock counts down "left" in amber; the 15 minute match is read at tps', () => {
  const s = fresh();
  s.tick = 14 * 60 * 24;
  assert.match(renderBar(s, { side: 0, tps: 24 }), /id="clock" style="color:#ffb13b">1:00 left · bigger army wins<\/b>/);
  s.tick = 15 * 60 * 24 - 24 * 30;
  assert.match(renderBar(s, { side: 0, tps: 24 }), />0:30 left · bigger army wins</);
  s.tick = 14 * 60 * 24 - 1;
  const before = renderBar(s, { side: 0, tps: 24 });
  assert.doesNotMatch(before, /left · bigger army wins/);
  assert.match(before, /id="clock">13:59</);
  // at 12 ticks a second the same 14:00 mark is tick 10080
  const slow = fresh();
  slow.tick = 14 * 60 * 12;
  assert.match(renderBar(slow, { side: 0, tps: 12 }), /1:00 left · bigger army wins/);
});

test('Flour hint names the Mill and its wheat cost, not hauling', () => {
  const s = fresh();
  s.toast.pantry[0].flour = 0;
  const html = renderBar(s, { side: 0 });
  assert.match(html, new RegExp(`title="Flour is out\\. Build a Mill \\(${STATS.structures.mill.cost} wheat\\)`));
  assert.doesNotMatch(html, /haul wheat to it/);
});

test('Pilot light hover is one plain line that defines it', () => {
  const s = fresh();
  s.toast.stack[0] = BAKERY.pilotFloor - 1;
  const html = renderBar(s, { side: 0 });
  const title = html.match(/id="pilot" title="([^"]*)"/)?.[1] ?? '';
  assert.match(title, /^Pilot light: your Power Strip bakes 1 emergency slice every \d+(\.\d+)? s while toast is under \d+\.$/);
  assert.equal((title.match(/\. /g) || []).length, 0, 'one sentence, one line');
});
