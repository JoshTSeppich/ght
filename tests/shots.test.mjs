// Visible shots on /play (owner: sonnet, COMBAT.md section 3). The Studio's Pop Shot slice arc, Quad Volley's four slices,
// Bread Shell's lob and Hot Coil's bolt, drawn from the sim's attacks by one instanced pool (max 64 live). Headless: real Three.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MAX_LIVE, SHOT_STYLE, shotStyleOf, shotTiming, shotProgress, arcPoint, shotPaths, createShotPool } from '../play/shots.mjs';
import { createToasterUnits } from '../play/toaster-units.mjs';

const fixture = () => ({ scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), tileSize: 1,
  gridToWorld(x, y, z, out) { return out.set(x, z, y); } });
const view = (over = {}) => ({ id: 1, kind: 'popper', owner: 0, pos: new THREE.Vector3(3, 0, 4), yaw: 0, spec: { size: 0.65, height: 0.8 },
  dying: false, hitFlash: 0, lastHitAt: -Infinity, spawnAt: -Infinity, ...over });
const info = (over = {}) => ({ pose: 'idle', time: 1, dt: 1 / 60, selected: false, tr: { scale: 1, dy: 0 }, state: null, ...over });
const count = (t, key) => t.batches[key]?.used ?? 0;

test('the four attacking toasters map to the four Studio studies; the rest fire no shot', () => {
  assert.deepEqual(SHOT_STYLE, { popper: 'slice', zapper: 'bolt', 'four-slice': 'quad', broiler: 'lob' });
  assert.equal(shotStyleOf('popper'), 'slice');
  assert.equal(shotStyleOf('zapper'), 'bolt');
  assert.equal(shotStyleOf('four-slice'), 'quad');
  assert.equal(shotStyleOf('broiler'), 'lob');
  for (const k of ['crumb', 'bagel', 'flak-popper']) assert.equal(shotStyleOf(k), null, k);
});

test('timing: Pop Shot is the 520 ms reference (flight 200-340, bonk at 340); every style launches after the anticipation', () => {
  const slice = shotTiming('slice');
  assert.equal(slice.launch, 200);
  assert.equal(slice.land, 340);
  assert.ok(slice.end <= 520);
  for (const s of ['slice', 'bolt', 'quad', 'lob']) {
    const t = shotTiming(s);
    assert.ok(t.launch < t.land && t.land < t.end, s);
  }
  assert.equal(shotTiming('nothing'), null);
});

test('progress: a shot is live only while in flight, p runs 0 to 1 across the flight', () => {
  assert.equal(shotProgress('slice', 150).live, false);
  const start = shotProgress('slice', 200);
  assert.equal(start.live, true);
  assert.equal(start.p, 0);
  const mid = shotProgress('slice', 270);
  assert.ok(Math.abs(mid.p - 0.5) < 1e-9);
  assert.equal(shotProgress('slice', 340).live, false, 'landed: the impact belongs to the spark, not the flight');
});

test('arc: the Pop Shot slice rises above the straight line and lands exactly on the target', () => {
  const a = { x: 0, y: 0, z: 0 }, b = { x: 10, y: 0, z: 0 };
  assert.deepEqual(arcPoint(a, b, 0, 1.2), { x: 0, y: 0, z: 0 });
  const top = arcPoint(a, b, 0.5, 1.2);
  assert.equal(top.x, 5);
  assert.ok(Math.abs(top.y - 1.2) < 1e-9, 'peak is the arc height at the middle');
  const end = arcPoint(a, b, 1, 1.2);
  assert.ok(Math.abs(end.x - 10) < 1e-9 && Math.abs(end.y) < 1e-9);
});

test('paths: one slice, one straight bolt, four spread slices for the Quad Volley, one high lob', () => {
  const from = { x: 0, y: 1, z: 0 }, to = { x: 0, y: 0, z: 8 };
  assert.equal(shotPaths('slice', from, to).length, 1);
  assert.equal(shotPaths('bolt', from, to).length, 1);
  const quad = shotPaths('quad', from, to);
  assert.equal(quad.length, 4);
  const aims = new Set(quad.map((p) => Math.round(p.to.x * 1000)));
  assert.equal(aims.size, 4, 'four different landing points');
  const lob = shotPaths('lob', from, to)[0];
  assert.ok(lob.height > shotPaths('slice', from, to)[0].height, 'the lob arcs higher than a slice');
  for (const p of quad) assert.deepEqual(p.from, from, 'every slice leaves the same slot');
});

test('pool: one InstancedMesh, never more than 64 live shots, the oldest is recycled when full', () => {
  const ctx = fixture();
  const pool = createShotPool(ctx, { unitScale: 0.9 });
  assert.equal(MAX_LIVE, 64);
  assert.equal(pool.mesh.isInstancedMesh, true);
  assert.equal(ctx.scene.children.includes(pool.mesh), true);
  for (let i = 0; i < 40; i++) pool.spawn('quad', { x: i, y: 1, z: 0 }, { x: i, y: 0, z: 9 }, 0, 1000);   // 160 slices asked for
  assert.ok(pool.live(1100) <= MAX_LIVE, `live ${pool.live(1100)}`);
  assert.equal(pool.live(1100), 64, 'the pool fills to the cap');
  pool.dispose();
});

test('pool: a finished shot frees its slot; updates write matrices for in-flight shots only', () => {
  const pool = createShotPool(fixture(), { unitScale: 0.9 });
  pool.spawn('slice', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 6 }, 0, 0);
  pool.update(100);
  assert.equal(pool.mesh.count, 0, 'before launch nothing draws');
  pool.update(250);
  assert.equal(pool.mesh.count, 1, 'in flight: one slice drawn');
  pool.update(400);
  assert.equal(pool.mesh.count, 0, 'landed at 340 ms: not drawn in flight');
  assert.equal(pool.live(500), 0, 'past its 410 ms end: the slot is free');
  pool.dispose();
});

test('pool: team colour tints the toast (cyan side 0, orange side 1), the bolt is hot', () => {
  const pool = createShotPool(fixture(), { unitScale: 0.9 });
  pool.spawn('slice', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 6 }, 0, 0);
  pool.spawn('slice', { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 6 }, 1, 0);
  pool.update(250);
  const c0 = new THREE.Color(), c1 = new THREE.Color();
  pool.mesh.getColorAt(0, c0); pool.mesh.getColorAt(1, c1);
  assert.ok(c1.r > c0.r && c0.b >= c1.b, 'side 1 leans orange, side 0 leans cyan');
  pool.dispose();
});

test('the Popper attack spawns one slice from its toast, aimed at the target, once per attack (not once per frame)', () => {
  const t = createToasterUnits(fixture());
  const v = view();
  const aim = { x: 3, y: 0, z: 9 };
  t.begin(); t.emit(v, null, info({ pose: 'attack', time: 1, aim })); t.end();
  for (let i = 1; i < 30; i++) { t.begin(); t.emit(v, null, info({ pose: 'attack', time: 1 + i / 60, aim })); t.end(); }
  assert.equal(t.shots.live(1.3 * 1000), 1, 'one shot for one attack');
  t.dispose();
});

test('no aim: the shot flies forward from the toaster, so a missing target still shows an attack', () => {
  const t = createToasterUnits(fixture());
  t.begin(); t.emit(view(), null, info({ pose: 'attack', time: 1 })); t.end();
  assert.equal(t.shots.live(1000 + 250), 1);
  t.dispose();
});

test('a Crumb or a Bagel attacks without a shot', () => {
  const t = createToasterUnits(fixture());
  t.begin(); t.emit(view({ kind: 'worker' }), null, info({ pose: 'attack', time: 1 })); t.end();
  t.begin(); t.emit(view({ id: 2, kind: 'dart' }), null, info({ pose: 'attack', time: 1 })); t.end();
  assert.equal(t.shots.live(1250), 0);
  t.dispose();
});

test('hungry fighters wear an overhead toast outline with a slash; fed ones do not', () => {
  const hungry = createToasterUnits(fixture());
  hungry.begin(); hungry.emit(view({ kind: 'grunt' }), null, info({ state: 'hungry' })); hungry.end();
  const fed = createToasterUnits(fixture());
  fed.begin(); fed.emit(view({ kind: 'grunt' }), null, info({ state: 'fed' })); fed.end();
  assert.equal(count(hungry, 'icon:box'), 5, 'four sides of the outline and the slash');
  assert.equal(count(fed, 'icon:box'), 0);
  hungry.dispose(); fed.dispose();
});

test('unpowered fighters (power battery or down) wear an overhead plug-out icon; powered ones do not', () => {
  const off = createToasterUnits(fixture());
  off.begin(); off.emit(view(), null, info({ state: 'unpowered' })); off.end();
  const battery = createToasterUnits(fixture());
  battery.begin(); battery.emit(view(), { power: { state: 'battery' } }, info()); battery.end();
  const down = createToasterUnits(fixture());
  down.begin(); down.emit(view(), { power: { state: 'down' } }, info()); down.end();
  const plugged = createToasterUnits(fixture());
  plugged.begin(); plugged.emit(view(), { power: { state: 'plugged' } }, info()); plugged.end();
  assert.equal(count(battery, 'icon:box'), 3, 'plug body, two prongs');
  assert.equal(count(down, 'icon:box'), 3);
  assert.equal(count(plugged, 'icon:box'), 0);
  assert.equal(count(off, 'icon:box'), 3, 'the ammo state unpowered gets the same icon');
  for (const x of [off, battery, down, plugged]) x.dispose();
});
