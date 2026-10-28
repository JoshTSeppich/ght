// ghost-matches-sim (card 11, item 1): the placement ghost's verdict is the sim's verdict for the same build order, tile by
// tile, including the Well rule that no Well may stand within wellEnemyReach of an enemy structure. Owner: construction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { placeCheck } from '../play/input.mjs';
import { ghostFor, reasonText } from '../play/placement-ghost.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { STATS } from '../env/stats.mjs';
import { BAKERY } from '../env/bakery.mjs';
import { observe } from '../env/state.mjs';
import { applyCommands } from '../env/commands.mjs';

// The page's snapshot has the full lists the check reads; this mirrors it from the live state.
const snapOf = (state, side) => Object.assign(observe(state, side), {
  shards: state.shards, rocks: [...state.rocks], structures: state.structures, units: state.units, crystals: state.crystals,
});

// Tries one build order in a fresh copy of the Toaster Wars match. Returns { chk, simOk } for the same tile and kind.
function verdicts(kind, x, y, { side = 0 } = {}) {
  const state = createToasterState(1);
  const builder = state.units.find((u) => u.owner === side && u.kind === 'worker');
  // The builder stands next to the site, on a free tile (the ghost and the sim both refuse a site under a unit).
  const step = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => [x + dx, y + dy])
    .find(([bx, by]) => bx >= 0 && by >= 0 && bx < state.width && by < state.height && !state.units.some((u) => u.x === bx && u.y === by));
  if (!step) return null;
  builder.x = step[0]; builder.y = step[1];
  const chk = placeCheck(snapOf(state, side), STATS, side, kind, x, y);
  const before = state.structures.length;
  applyCommands(state, side, [{ type: 'build', unit: builder.id, kind, x, y }]);
  return { chk, simOk: state.structures.length === before + 1 };
}

test('every tile near the Strip gets the verdict the sim gives the build order', () => {
  const strip = createToasterState(1).structures.find((s) => s.owner === 0);
  let green = 0, red = 0;
  for (const kind of ['mill', 'well', 'toaster']) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const v = verdicts(kind, strip.x + dx, strip.y + dy);
      if (!v) continue;
      assert.equal(v.chk.ok, v.simOk, `${kind} at ${strip.x + dx},${strip.y + dy}: ghost ${v.chk.ok} (${v.chk.reason}) vs sim ${v.simOk}`);
      if (v.simOk) green++; else red++;
    }
  }
  assert.ok(green > 0 && red > 0, `both verdicts were exercised (${green} green, ${red} red)`);
});

test('a Well inside the enemy rule is red in the ghost and refused by the sim, with the plain reason', () => {
  const enemy = createToasterState(1).structures.find((s) => s.owner === 1);
  const reach = BAKERY.wellEnemyReach;
  let refused = 0, allowed = 0, tooClose = 0;
  for (let dy = -reach - 2; dy <= reach + 2; dy++) for (let dx = -reach - 2; dx <= reach + 2; dx++) {
    const x = enemy.x + dx, y = enemy.y + dy;
    const v = verdicts('well', x, y);
    if (!v) continue;
    assert.equal(v.chk.ok, v.simOk, `well at ${x},${y}: ghost ${v.chk.ok} (${v.chk.reason}) vs sim ${v.simOk}`);
    if (v.simOk) allowed++;
    else refused++;
    if (v.chk.reason === 'too-close-enemy') tooClose++;
  }
  assert.ok(refused > 0 && allowed > 0, `both verdicts were exercised (${allowed} allowed, ${refused} refused)`);
  assert.ok(tooClose > 0, 'the enemy rule was exercised: some Wells are refused as too close to the enemy');
});

test('the enemy-rule refusal reads as a sentence on the ghost', () => {
  const g = ghostFor({ ok: false, reason: 'too-close-enemy' }, 'well', 5, 5, { label: 'Well', need: 50 });
  assert.equal(g.ok, false);
  assert.equal(g.text, reasonText('too-close-enemy'));
  assert.match(g.text, /^Too close to an enemy building/);
});
