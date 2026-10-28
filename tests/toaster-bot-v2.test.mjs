// toaster-sonnet v2 on the REAL rules (cord-bending on): it never re-sends a refused order, its box lane keeps its Crumbs and
// fighters inside their cords, and the board keeps moving (owner: sonnet). Short runs; the 6-seed 15-minute sweep is
// scripts/toaster-measure.mjs (numbers in TERRITORY-PACING.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { step, checkEnd } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));

test('a refused move is not sent again while the back-off lasts', () => {
  const state = createToasterState(3);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const crumb = state.units.find((u) => u.owner === 0 && u.kind === 'worker');
  const obs = clone(observe(state, 0));
  const gatherAt = (o) => bot.act(clone(o)).filter((c) => c.unit === crumb.id && c.type === 'gather');
  const first = gatherAt(obs);
  assert.equal(first.length, 1, 'an idle Crumb is sent to wheat');
  const bad = first[0];
  // The sim says the cord stopped that gather.
  obs.power.refused = [{ id: crumb.id, tick: 5, reason: 'cord', x: bad.x, y: bad.y, target: null }];
  obs.tick = 6;
  for (let t = 6; t < 6 + 24 * 6; t += 3) {
    obs.tick = t;
    const again = gatherAt(obs);
    assert.ok(!again.some((c) => c.x === bad.x && c.y === bad.y), `tick ${t}: the refused wheat tile is not re-sent`);
  }
});

test('mirror match on the real rules: few refusals, the chain holds at mid-lane until the push, the board keeps changing', () => {
  const state = createToasterState(3);
  state.maxTicks = 24 * 60 * 4;
  const bots = [0, 1].map((side) => createPlayer({ side, stats: STATS, seed: 3 }));
  let limits = 0, orders = 0, sig = '', still = 0, worstStill = 0;
  while (!(state.result ?? checkEnd(state))) {
    const cmds = [0, 1].map((s) => bots[s].act(clone(observe(state, s))) || []);
    orders += cmds[0].length + cmds[1].length;
    for (const e of step(state, cmds)) if (e.e === 'cord-limit') limits++;
    if (state.tick % 24 === 0) {
      const s = JSON.stringify([state.shards, state.units.map((u) => [u.id, u.x, u.y, u.hp]), state.structures.map((b) => [b.id, b.hp])]);
      still = s === sig ? still + 1 : 0;
      worstStill = Math.max(worstStill, still);
      sig = s;
    }
  }
  assert.ok(limits < 400, `${limits} cord refusals in 4 minutes (the old bot made thousands)`);
  assert.ok(limits < orders / 20, `${limits} refusals of ${orders} orders`);
  for (const side of [0, 1]) {
    const foe = state.structures.find((s) => s.kind === 'core' && s.owner !== side);
    const boxes = state.power.points.filter((p) => p.owner === side && p.kind === 'extension');
    const near = Math.min(...boxes.map((p) => Math.max(Math.abs(p.x - foe.x), Math.abs(p.y - foe.y))));
    assert.ok(boxes.length >= 10 && near <= 170, `side ${side}: ${boxes.length} boxes, nearest ${near} from the enemy Strip`);
  }
  assert.ok(worstStill < 10, `the board stood still for ${worstStill} s`);
});
