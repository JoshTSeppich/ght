import test from 'node:test';
import assert from 'node:assert/strict';
import { mapReason, reasonText, ghostFor, waterInReach, drawGhost, wellsNear, CROWD_REACH } from '../play/placement-ghost.mjs';
import { placeCheck, createInput } from '../play/input.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { generateMap } from '../env/map.mjs';
import { observe } from '../env/state.mjs';
import { applyCommands } from '../env/commands.mjs';

const map = generateMap(1, { map: 'wheatfield' });
const ctx = { water: map.water, springs: map.wells };

// The page's snapshot has the full lists the check reads; this mirrors it from the live state.
const snapOf = (state, side) => Object.assign(observe(state, side), {
  shards: state.shards, rocks: [...state.rocks], structures: state.structures, units: state.units, crystals: state.crystals,
});

test('texts are plain and carry the cost', () => {
  assert.equal(reasonText('not enough wheat', { need: 75 }), 'Not enough wheat (need 75)');
  assert.equal(reasonText('out of cord reach: build next to a powered station'), 'Out of power reach');
  assert.equal(reasonText('blocked'), 'Blocked');
  assert.equal(reasonText('far-from-water'), 'A Well must be within 4 tiles of water');
  assert.match(reasonText('enemy-fence'), /^Too close to the enemy/);
});

test('a Well far from water is red, one by the river is green and lists water', () => {
  const [wx, wy] = map.water[0];
  assert.equal(mapReason(ctx, 'well', wx, wy + 1), null);
  assert.ok(waterInReach(ctx, wx, wy + 1).length > 0);
  let far = null;
  for (let y = 0; y < map.height && !far; y++) for (let x = 0; x < map.width; x++) if (!waterInReach(ctx, x, y).length) { far = { x, y }; break; }
  assert.ok(far, 'the map has dry ground');
  assert.equal(mapReason(ctx, 'well', far.x, far.y), 'far-from-water');
  assert.equal(mapReason(ctx, 'mill', far.x, far.y), null, 'only Wells care about water');
  assert.equal(mapReason({}, 'well', 3, 3), null, 'a map with no water lets a Well stand anywhere');
  assert.equal(ghostFor({ ok: false, reason: 'far-from-water' }, 'well', far.x, far.y, { ctx }).water.length, 0);
});

test('enemy fenced land is refused', () => {
  assert.equal(mapReason({ enemyFenced: new Set(['4,5']) }, 'mill', 4, 5), 'enemy-fence');
  assert.equal(mapReason({ enemyFenced: new Set(['4,5']) }, 'mill', 4, 6), null);
});

test('the ghost agrees with the sim: each tile near the Strip gets the verdict the sim gives the build order', () => {
  const base = createToasterState(1);
  const strip = base.structures.find((s) => s.owner === 0);
  const crumbId = base.units.find((u) => u.owner === 0 && u.kind === 'worker').id;
  let green = 0, red = 0;
  for (const kind of ['mill', 'well', 'toaster']) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const x = strip.x + dx, y = strip.y + dy;
      const state = createToasterState(1);
      const c = state.units.find((u) => u.id === crumbId);
      c.x = x; c.y = y + 1 < state.height ? y + 1 : y - 1; // the builder stands next to the site
      const chk = placeCheck(snapOf(state, 0), STATS, 0, kind, x, y); // no map context: the sim's own rules only
      const before = state.structures.length;
      applyCommands(state, 0, [{ type: 'build', unit: c.id, kind, x, y }]);
      const simOk = state.structures.length === before + 1;
      assert.equal(chk.ok, simOk, `${kind} at ${x},${y}: ghost ${chk.ok} (${chk.reason}) vs sim ${simOk}`);
      if (simOk) green++; else red++;
    }
  }
  assert.ok(green > 0 && red > 0, `both verdicts were exercised (${green} green, ${red} red)`);
});

test('no wheat: red with the need; stations out of cord reach: red', () => {
  const state = createToasterState(1);
  const strip = state.structures.find((s) => s.owner === 0);
  const poor = snapOf(state, 0); poor.shards = [10, 10];
  let x = strip.x + 2, y = strip.y + 2;
  while (state.units.some((u) => u.x === x && u.y === y) || state.rockSet.has(`${x},${y}`)) x++;
  const chk = placeCheck(poor, STATS, 0, 'mill', x, y);
  assert.equal(chk.ok, false);
  assert.equal(ghostFor(chk, 'mill', x, y, { need: STATS.structures.mill.cost }).text, 'Not enough wheat (need 75)');
  const far = placeCheck(snapOf(state, 0), STATS, 0, 'extension', strip.x + 40, strip.y);
  assert.equal(reasonText(far.reason), 'Out of power reach');
});

test('createInput passes the map context to placeCheck', () => {
  const input = createInput({ side: 0, stats: STATS, placeContext: () => ({ enemyFenced: new Set(['5,5']) }) });
  const snap = { width: 20, height: 20, rocks: [], crystals: [], structures: [], units: [], shards: [500, 500] };
  assert.equal(input.placeCheck(snap, 'mill', 5, 5).reason, 'enemy-fence');
  assert.equal(input.placeCheck(snap, 'mill', 6, 5).ok, true);
});

test('drawGhost paints a green or red box and the reason', () => {
  const calls = [];
  const ov = new Proxy({}, {
    get: (t, k) => (k === 'measureText' ? () => ({ width: 50 }) : (...a) => calls.push([k, ...a])),
    set: (t, k, v) => { calls.push(['set', k, v]); return true; },
  });
  const project = (x, y, z) => ({ sx: x * 10, sy: y * 10 - z * 10 });
  drawGhost(ov, project, ghostFor({ ok: true }, 'mill', 3, 3, { need: 75, label: 'Mill' }), 40);
  assert.ok(calls.some((c) => c[0] === 'fillText' && c[1] === 'Mill (75)'));
  assert.ok(calls.some((c) => c[0] === 'set' && String(c[2]).startsWith('rgba(60,255,110')));
  calls.length = 0;
  drawGhost(ov, project, ghostFor({ ok: false, reason: 'blocked' }, 'mill', 3, 3), 40);
  assert.ok(calls.some((c) => c[0] === 'fillText' && c[1] === 'Blocked'));
  assert.ok(calls.some((c) => c[0] === 'set' && String(c[2]).startsWith('rgba(255,60,60')));
});

// Crowding (WELLS-TECH-TERRAIN.md section 1): Wells within CROWD_REACH tiles, any owner, split one draw.
const creek = { water: [[10, 10]] }; // a creek tile; a Well at (10, 12) is in reach of it
const well = (x, y, owner = 0, extra = {}) => ({ id: `${x},${y}`, kind: 'well', x, y, owner, hp: 150, complete: true, ...extra });

test('the crowd is every Well within 6 tiles of any owner, not itself and not the dead', () => {
  assert.equal(CROWD_REACH, 6);
  assert.equal(wellsNear([], 10, 12), 0);
  assert.equal(wellsNear([well(10, 16)], 10, 12), 1, 'four tiles off: in reach');
  assert.equal(wellsNear([well(10, 18)], 10, 12), 1, 'six tiles off: still in reach');
  assert.equal(wellsNear([well(10, 19)], 10, 12), 0, 'seven tiles off: out of reach');
  assert.equal(wellsNear([well(12, 12, 1)], 10, 12), 1, 'an enemy Well counts too');
  assert.equal(wellsNear([well(10, 12), well(11, 12, 1, { hp: 0 })], 10, 12, { skipId: '10,12' }), 0, 'skips itself and dead Wells');
  assert.equal(wellsNear([{ kind: 'mill', x: 10, y: 13, owner: 0, hp: 150 }], 10, 12), 0, 'only Wells crowd');
});

test('the ghost text names the rate a Well will have: alone, then shared', () => {
  assert.equal(ghostFor({ ok: true }, 'well', 10, 12, { need: 50, label: 'Well', ctx: creek }).text, 'Well (50) · 1 Water / 6 s');
  assert.equal(
    ghostFor({ ok: true }, 'well', 10, 12, { need: 50, label: 'Well', ctx: creek, structures: [well(10, 17, 1)] }).text,
    'Well (50) · shared with 1 Well: 1 / 12 s',
  );
  assert.equal(
    ghostFor({ ok: true }, 'well', 10, 12, { need: 50, label: 'Well', ctx: creek, structures: [well(10, 17), well(11, 15, 1)] }).text,
    'Well (50) · shared with 2 Wells: 1 / 18 s',
  );
  assert.equal(ghostFor({ ok: true }, 'well', 3, 3, { label: 'Well' }).text, 'Well · 1 Water / 6 s', 'a map with no water: the creek rate');
});

test('a spring-only Well is slow: 1 Water / 12 s', () => {
  const spring = { water: [], springs: [[10, 10]] };
  assert.equal(ghostFor({ ok: true }, 'well', 10, 12, { label: 'Well', ctx: spring }).text, 'Well · 1 Water / 12 s');
});

test('a dry tile says so in the ghost, and the reason is not shown', () => {
  const g = ghostFor({ ok: false, reason: 'far-from-water' }, 'well', 30, 30, { label: 'Well', ctx: creek });
  assert.equal(g.text, 'dry: no water in reach');
  assert.equal(g.ok, false);
});

test('a Well short of wheat still says so: the rate is not the reason', () => {
  assert.equal(ghostFor({ ok: false, reason: 'not enough wheat' }, 'well', 10, 12, { need: 50, ctx: creek }).text, 'Not enough wheat (need 50)');
});

test('the Well ghost draws a faint 6-tile ring; other kinds draw none', () => {
  assert.deepEqual(ghostFor({ ok: true }, 'well', 10, 12, { ctx: creek }).ring, { x: 10, y: 12, r: 6 });
  assert.equal(ghostFor({ ok: true }, 'mill', 10, 12, { ctx: creek }).ring, null);
  const calls = [];
  const ov = new Proxy({}, {
    get: (t, k) => (k === 'measureText' ? () => ({ width: 50 }) : (...a) => calls.push([k, ...a])),
    set: (t, k, v) => { calls.push(['set', k, v]); return true; },
  });
  const project = (x, y, z) => ({ sx: x * 10, sy: y * 10 - z * 10 });
  drawGhost(ov, project, ghostFor({ ok: true }, 'well', 10, 12, { ctx: creek }), 40);
  assert.ok(calls.some((c) => c[0] === 'set' && c[1] === 'strokeStyle' && c[2] === 'rgba(255,255,255,.22)'), 'the ring is stroked');
});
