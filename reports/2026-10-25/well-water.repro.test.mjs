// Repro for chat #833 (Claude, 04:45): a Well placed next to the home spring showed a green ghost, but Water stayed 0
// for over 60 s. Test-shaped: each test states what should happen; a red test is a reproduced bug, a green one is not.
// Real Toaster Wars state (createPlayableState, Wheatfield, seed 7). Read-only: nothing in the repo is edited.
// Run: node --test reports/2026-10-25/well-water.repro.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayableState } from '../../play/toaster-play.mjs';
import { stepBakery, BAKERY } from '../../env/bakery.mjs';
import { mapReason } from '../../play/placement-ghost.mjs';
import { generateMap } from '../../env/map.mjs';
import { isFree } from '../../env/state.mjs';
import { STATS } from '../../env/stats.mjs';

const TPS = STATS.clock.ticksPerSecond;
const SEED = 7;

// Our Strip and the spring nearest to it: the "home spring" of the chat report.
function homeSpring(state) {
  const core = state.structures.find((s) => s.kind === 'core' && s.owner === 0);
  const [sx, sy] = [...state.springs].sort((a, b) => Math.max(Math.abs(a[0] - core.x), Math.abs(a[1] - core.y)) - Math.max(Math.abs(b[0] - core.x), Math.abs(b[1] - core.y)))[0];
  return { core, sx, sy };
}

// A tile within the Well's reach of the spring that the ghost accepts (no map reason) and the base accepts (free tile).
function wellTileNear(state, sx, sy) {
  const ctx = { waterSet: state.waterSet, springs: state.springs, enemyFenced: null };
  for (let r = 1; r <= BAKERY.wellReach; r++) {
    for (let y = sy - r; y <= sy + r; y++) for (let x = sx - r; x <= sx + r; x++) {
      if (Math.max(Math.abs(x - sx), Math.abs(y - sy)) !== r) continue;
      if (!isFree(state, x, y)) continue;
      if (mapReason(ctx, 'well', x, y) === null) return { x, y };
    }
  }
  return null;
}

test('the sim and the ghost agree on the water and springs of Wheatfield', () => {
  const state = createPlayableState(SEED);
  const map = generateMap(SEED, { map: 'wheatfield' });
  assert.equal(state.springs.length, map.wells.length, 'spring list matches the map');
  assert.ok(state.waterSet.size > 0, 'the sim has creek water');
  assert.equal(state.waterSet.size, map.water.length, 'creek tiles match the map (ghost reads the same set)');
});

test('a Well placed in the ghost-green spot next to the home spring makes water within 60 s', () => {
  const state = createPlayableState(SEED);
  const { sx, sy } = homeSpring(state);
  const at = wellTileNear(state, sx, sy);
  assert.ok(at, 'the ghost finds a green tile near the spring');
  const well = { id: 9100, owner: 0, kind: 'well', x: at.x, y: at.y, hp: STATS.structures.well.hp, complete: true, progress: 1, queue: [] };
  state.structures.push(well);
  for (let t = 0; t < 60 * TPS; t++) { stepBakery(state); state.tick += 1; }
  const pantry = state.toast.pantry[0];
  assert.equal(well.dry, false, `the Well at ${at.x},${at.y} is not dry (spring ${sx},${sy})`);
  assert.ok(pantry.water >= 1, `water in the pantry after 60 s (got ${pantry.water}, spring=${well.spring})`);
});

test('a Well on the home spring tile itself is not reported dry', () => {
  const state = createPlayableState(SEED);
  const { sx, sy } = homeSpring(state);
  const well = { id: 9101, owner: 0, kind: 'well', x: sx, y: sy, hp: STATS.structures.well.hp, complete: true, progress: 1, queue: [] };
  state.structures.push(well);
  for (let t = 0; t < 60 * TPS; t++) { stepBakery(state); state.tick += 1; }
  assert.equal(well.dry, false);
  assert.ok(state.toast.pantry[0].water >= 1, `water after 60 s on the spring (got ${state.toast.pantry[0].water})`);
});

test('a Well with no spring or creek in reach is dry, and says so (the ghost should refuse it)', () => {
  const state = createPlayableState(SEED);
  // the first free tile the ghost calls far from water (the corner at 2,2 is creek itself, so it is not a dry spot)
  const ctx = { waterSet: state.waterSet, springs: state.springs, enemyFenced: null };
  let far = null;
  for (let y = 0; y < state.height && !far; y++) for (let x = 0; x < state.width && !far; x++) {
    if (isFree(state, x, y) && mapReason(ctx, 'well', x, y) === 'far-from-water') far = { x, y };
  }
  assert.ok(far, 'a dry tile exists on Wheatfield');
  const well = { id: 9102, owner: 0, kind: 'well', x: far.x, y: far.y, hp: STATS.structures.well.hp, complete: true, progress: 1, queue: [] };
  state.structures.push(well);
  for (let t = 0; t < 30 * TPS; t++) { stepBakery(state); state.tick += 1; }
  assert.equal(well.dry, true);
  assert.equal(state.toast.pantry[0].water, 0);
  assert.equal(mapReason({ waterSet: state.waterSet, springs: state.springs }, 'well', far.x, far.y), 'far-from-water');
});
