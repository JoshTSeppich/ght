// High ground (SYSTEMS-DESIGN.md section 3, ticket TR1). Owner: haiku.
// A unit standing on a high tile sees 2 tiles farther and its ranged shots to a lower tile reach 1 farther.
// A unit on low ground cannot see a high tile unless it is adjacent or a friendly unit stands high.
// Ramps count as low. Air sees everything. Real modules only, no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestState, findEntity as lookup } from '../env/state.mjs';
import { visionOf, isSeen, sightOf, heightAt } from '../env/vision.mjs';
import { stepCombat, chooseTarget } from '../env/combat.mjs';
import { STATS } from '../env/stats.mjs';
import { buildTileImage, createWheatfieldTerrain } from '../play/wheatfield-terrain.mjs';
import { createToasterUnits } from '../play/toaster-units.mjs';
import { generateMap } from '../env/map.mjs';

// ---------- vision ----------

// A 30 x 5 field: x >= 10 is high ground (height 1), the rest is low. No ramps unless a test adds one.
function plateau(extra = {}) {
  const s = createTestState({ width: 30, height: 5, ...extra });
  s.heights = Array.from({ length: 5 }, () => Array.from({ length: 30 }, (_, x) => (x >= 10 ? 1 : 0)));
  s.ramps = [];
  return s;
}
const seen = (s, player, x, y) => isSeen(visionOf(s, player), x, y);

test('a unit on high ground sees two tiles farther than the same unit on low ground', () => {
  assert.equal(sightOf({ kind: 'grunt', complete: true }), 6);
  const high = plateau({ units: [{ owner: 0, kind: 'grunt', x: 12, y: 2 }] });
  assert.ok(seen(high, 0, 4, 2), 'eight tiles west, on low ground: seen from the plateau');
  assert.ok(!seen(high, 0, 3, 2), 'nine tiles west is still out of sight');
  // the same grunt on low ground stops at six tiles
  const low = plateau({ units: [{ owner: 0, kind: 'grunt', x: 8, y: 2 }] });
  assert.ok(seen(low, 0, 2, 2), 'six tiles west is seen from low ground');
  assert.ok(!seen(low, 0, 1, 2), 'seven tiles west is not');
});

test('a unit on low ground cannot see a high tile unless it is adjacent', () => {
  const two = plateau({ units: [{ owner: 0, kind: 'grunt', x: 8, y: 2 }] });
  assert.ok(!seen(two, 0, 10, 2), 'two tiles away is not adjacent: hidden');
  const one = plateau({ units: [{ owner: 0, kind: 'grunt', x: 9, y: 2 }] });
  assert.ok(seen(one, 0, 10, 2), 'the high tile next to it is seen');
  assert.ok(!seen(one, 0, 11, 2), 'but not the one behind it');
});

test('a friendly unit standing high reveals the high ground it sees; an enemy one does not', () => {
  const ally = plateau({ units: [{ owner: 0, kind: 'grunt', x: 4, y: 2 }, { owner: 0, kind: 'grunt', x: 13, y: 2 }] });
  assert.ok(seen(ally, 0, 11, 2), 'the high friend sees the plateau, so the side sees it');
  assert.ok(seen(ally, 0, 13, 2));
  const enemy = plateau({ units: [{ owner: 0, kind: 'grunt', x: 4, y: 2 }, { owner: 1, kind: 'grunt', x: 13, y: 2 }] });
  assert.ok(!seen(enemy, 0, 11, 2), 'an enemy on the plateau does not reveal it to us');
});

test('a unit on a ramp is on low ground: no sight bonus and no sight up', () => {
  const s = plateau({ units: [{ owner: 0, kind: 'grunt', x: 10, y: 2 }] });
  s.ramps = [{ x: 10, y: 2, axis: 'ew' }];
  assert.equal(heightAt(s, 10, 2), 0);
  assert.ok(seen(s, 0, 4, 2) && !seen(s, 0, 3, 2), 'six tiles west, not eight');
  assert.ok(seen(s, 0, 11, 2), 'the adjacent high tile is seen');
  assert.ok(!seen(s, 0, 12, 2), 'two tiles up the plateau is not');
});

test('air units still see the plateau from anywhere in their own radius', () => {
  const s = plateau({ units: [{ owner: 0, kind: 'skiff', x: 6, y: 2, hp: 90 }] });
  assert.ok(seen(s, 0, 12, 2));
});

// ---------- combat ----------

const stat = (kind) => STATS.units?.[kind] ?? STATS.structures?.[kind] ?? STATS[kind];
const unit = (id, owner, kind, x, y, order = null) => ({ id, owner, kind, x, y, hp: stat(kind).hp, carrying: 0, order });
function field(units) {
  const s = createTestState({ width: 30, height: 5, rocks: [], crystals: [], shards: [0, 0], units, structures: [] });
  s.heights = Array.from({ length: 5 }, () => Array.from({ length: 30 }, (_, x) => (x >= 10 ? 1 : 0)));
  s.ramps = [];
  return s;
}
const hpOf = (s, id) => lookup(s, id)?.hp;
const lancerRange = () => stat('lancer').range;

test('a lancer on high ground reaches a lower target one tile farther than its range', () => {
  const r = lancerRange();
  const s = field([unit(1, 0, 'lancer', 10 + 1, 2), unit(2, 1, 'worker', 10 + 1 - (r + 1), 2)]);
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('worker').hp - stat('lancer').damage, 'range + 1 from the plateau is a hit');
});

test('the same distance from low ground is out of range; a target on the same height gets no bonus', () => {
  const r = lancerRange();
  const low = field([unit(1, 0, 'lancer', 2, 2), unit(2, 1, 'worker', 2 + r + 1, 2)]);
  stepCombat(low);
  assert.equal(hpOf(low, 2), stat('worker').hp, 'low to low at range + 1: no hit');
  const hh = field([unit(1, 0, 'lancer', 15, 2), unit(2, 1, 'worker', 15 - (r + 1), 2)]);
  stepCombat(hh);
  assert.equal(hpOf(hh, 2), stat('worker').hp, 'high to high (both on the plateau) gets no bonus');
});

test('the bonus follows an attack order too, and a melee unit gets none', () => {
  const r = lancerRange();
  const ordered = field([unit(1, 0, 'lancer', 11, 2, { type: 'attack', target: 2 }), unit(2, 1, 'worker', 11 - (r + 1), 2)]);
  assert.equal(chooseTarget(ordered, ordered.units[0])?.id, 2);
  const melee = field([unit(1, 0, 'grunt', 11, 2), unit(2, 1, 'worker', 9, 2)]);
  assert.equal(chooseTarget(melee, melee.units[0]), null, 'grunt (range 1) on the plateau does not reach two tiles down');
});

test('a ramp tile counts as low for the reach bonus', () => {
  const r = lancerRange();
  const s = field([unit(1, 0, 'lancer', 10, 2), unit(2, 1, 'worker', 10 - (r + 1), 2)]);
  s.ramps = [{ x: 10, y: 2, axis: 'ew' }];
  stepCombat(s);
  assert.equal(hpOf(s, 2), stat('worker').hp);
});

// ---------- the cues (play/) ----------

test('high-tile rim: the edge pixels of a high tile facing low ground are lighter than its middle', () => {
  const tiles = Array.from({ length: 6 }, () => '......');
  const heights = Array.from({ length: 6 }, (_, y) => Array.from({ length: 6 }, (_, x) => (x >= 2 && x <= 3 && y >= 2 && y <= 3 ? 1 : 0)));
  const map = { width: 6, height: 6, tiles, heights, water: [], rubble: [], crystals: [], rocks: [], sockets: [], ramps: [] };
  const img = buildTileImage(map, 4);
  const lum = (x, y) => { const i = (y * img.width + x) * 4; return img.data[i] + img.data[i + 1] + img.data[i + 2]; };
  // tile (2,2): its north edge faces low ground, its middle pixel is interior
  const middle = lum(2 * 4 + 2, 2 * 4 + 2);
  const northRim = lum(2 * 4 + 2, 2 * 4 + 1);
  assert.ok(northRim > middle + 20, `north rim ${northRim} vs middle ${middle}`);
  // the east side of tile (2,2) faces the high tile (3,2): no rim there
  const eastInside = lum(2 * 4 + 3, 2 * 4 + 2);
  assert.ok(Math.abs(eastInside - middle) < 20, `high-to-high edge stays body colour: ${eastInside} vs ${middle}`);
  // a low tile is unchanged by the rim: its middle matches the plain ground
  const low = lum(0 * 4 + 2, 0 * 4 + 2);
  assert.ok(Math.abs(low - middle) > 20, 'low ground and high ground differ');
});

test('the terrain system exposes highAt on the shared ctx so units can ask for it', () => {
  const map = generateMap(7, { map: 'wheatfield' });
  const scene = new THREE.Scene();
  const ctx = { scene, tileSize: 1, camera: new THREE.PerspectiveCamera(), gridToWorld: (x, y, h = 0, out = new THREE.Vector3()) => out.set(x, h, y) };
  const t = createWheatfieldTerrain(ctx, { map });
  let high = null, low = null;
  for (let y = 2; y < 250 && (!high || !low); y++) for (let x = 2; x < 250; x++) {
    if (map.heights[y][x] > 0 && !high) high = [x, y];
    if (map.heights[y][x] === 0 && map.tiles[y][x] === '.' && !low) low = [x, y];
  }
  assert.ok(ctx.highAt(...high), 'a high tile');
  assert.ok(!ctx.highAt(...low), 'a low tile');
  assert.ok(!ctx.highAt(-1, -1), 'off the map is low');
  t.dispose();
  assert.equal(ctx.highAt, undefined, 'dispose removes it');
});

test('a unit standing high gets an up-arrow of three icon boxes above it; a unit on low ground gets none', () => {
  const ctxOf = (high) => ({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), tileSize: 1,
    gridToWorld(x, y, z, out) { return out.set(x, z, y); }, highAt: () => high });
  const view = { id: 1, kind: 'grunt', owner: 0, pos: new THREE.Vector3(3, 0, 4), yaw: 0.4, spec: { size: 0.65, height: 0.8 },
    dying: false, hitFlash: 0, lastHitAt: -Infinity, spawnAt: -Infinity };
  const info = { pose: 'idle', time: 1, dt: 1 / 60, selected: false, tr: { scale: 1, dy: 0 }, state: null };
  const boxes = (high) => {
    const t = createToasterUnits(ctxOf(high));
    t.begin(); t.emit(view, { x: 3, y: 4, kind: 'grunt' }, info); t.end();
    const n = t.batches['icon:box']?.used ?? 0;
    t.dispose();
    return n;
  };
  assert.equal(boxes(false), 0, 'low ground: no icon');
  assert.equal(boxes(true), 3, 'high ground: stem and two arms');
});
