// The bread chain alive on /play (PLAYABLE.md item 25, owner: sonnet): presentation from sim state, headless.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createToasterState } from '../play/toaster-play.mjs';
import { breadActivity, crumbCarry, stackSlices, createBreadLife, MAX_STACK } from '../play/bread-life.mjs';
import { buildToasterBody, LIVE_BODIES } from '../play/toaster-buildings.mjs';
import { BAKERY, pantryCapOf } from '../env/bakery.mjs';
import { addStock } from '../env/ammo.mjs';

const mk = (kind, owner = 0, x = 10, y = 10) => ({ id: 900 + x, kind, owner, x, y, hp: 100, complete: true });

test('breadActivity mirrors the bakery: Mill needs wheat and room, Well needs water and room, Toaster needs power + flour + water', () => {
  const st = createToasterState(3);
  const mill = mk('mill'), well = mk('well'), toaster = mk('toaster');
  st.shards[0] = 0; st.toast.pantry[0] = { flour: 0, water: 0, energy: 0 };
  assert.equal(breadActivity(st, mill), 0);
  st.shards[0] = BAKERY.wheatPerFlour; assert.equal(breadActivity(st, mill), 1);
  st.toast.pantry[0].flour = pantryCapOf(st, 0); assert.equal(breadActivity(st, mill), 0, 'pantry full: sails rest');
  assert.equal(breadActivity(st, well), 1);
  assert.equal(breadActivity(st, { ...well, dry: true }), 0);
  assert.equal(breadActivity(st, toaster), 0, 'no flour or water');
  st.toast.pantry[0].water = 2; assert.equal(breadActivity(st, toaster), 1);
  assert.equal(breadActivity(st, { ...toaster, unpowered: true }), 0);
  assert.equal(breadActivity(st, { ...toaster, complete: false }), 0);
});

test('a Mill keeps its sails turning past the flat six once a complete Toaster raises the pantry cap', () => {
  const st = createToasterState(3);
  st.structures = st.structures.filter((s) => !(s.kind === 'toaster' && s.owner === 0));
  const mill = mk('mill');
  st.shards[0] = BAKERY.wheatPerFlour; st.toast.pantry[0] = { flour: BAKERY.pantryCap, water: 0, energy: 0 };
  assert.equal(breadActivity(st, mill), 0, 'six flour and no Toaster: full, sails rest');
  st.structures.push(mk('toaster', 0, 30, 30));
  assert.equal(breadActivity(st, mill), 1, 'a complete Toaster lifts the cap to 9, so the Mill works at six');
  st.toast.pantry[0].flour = pantryCapOf(st, 0);
  assert.equal(breadActivity(st, mill), 0, 'at the new cap it rests again');
});

test('crumbCarry: a sack when loaded, a slice when ferrying toast, nothing for others', () => {
  assert.equal(crumbCarry(null, { kind: 'worker', hp: 5, carrying: 4 }), 'sack');
  assert.equal(crumbCarry(null, { kind: 'worker', hp: 5, carrying: 0 }), null);
  assert.equal(crumbCarry(null, { kind: 'worker', hp: 5, carrying: 4, carryingToast: 1 }), 'toast');
  assert.equal(crumbCarry(null, { kind: 'worker', hp: 5, order: { type: 'ferry' } }), 'toast');
  assert.equal(crumbCarry(null, { kind: 'grunt', hp: 5, carrying: 4 }), null);
});

test('stackSlices follows toast and is capped', () => {
  assert.deepEqual([0, 1, 7, 99, -3].map(stackSlices), [0, 1, 7, MAX_STACK, 0]);
});

function fakeCtx() {
  const scene = new THREE.Scene();
  return { scene, THREE, tileSize: 1, heightAt: () => 0, gridToWorld: (x, y, h = 0, t = new THREE.Vector3()) => t.set(x, h, y), worldToGrid: (v) => ({ x: v.x, y: v.z }) };
}

test('the layer shows sacks, slices and the toast stack, and wakes the Mill and Toaster bodies', () => {
  LIVE_BODIES.clear();
  const ctx = fakeCtx();
  const st = createToasterState(3);
  const mill = mk('mill', 0, 20, 20), toaster = mk('toaster', 0, 24, 20);
  st.structures.push(mill, toaster);
  const bodies = {};
  for (const s of [mill, toaster]) {
    const parts = buildToasterBody(THREE, s.kind, 0);
    parts.body.position.set(s.x, 0, s.y); ctx.scene.add(parts.body); bodies[s.kind] = parts;
  }
  st.shards[0] = 99; st.toast.pantry[0] = { flour: 2, water: 2, energy: 0 };
  addStock(st, 0, 5);
  const crumbs = st.units.filter((u) => u.kind === 'worker' && u.owner === 0);
  assert.ok(crumbs.length >= 2, 'the start has Crumbs');
  crumbs[0].carrying = 5; crumbs[1].carryingToast = 1;
  const layer = createBreadLife(ctx, { THREE, getState: () => st });
  const frame = { units: st.units, structures: st.structures };
  for (let i = 0; i < 90; i++) layer.update(frame, 1 / 60);
  const mesh = (n) => layer.root.children[n];
  assert.equal(mesh(0).count, 1, 'one sack');
  assert.equal(mesh(1).count, 1, 'one ferried slice');
  assert.ok(mesh(2).count >= 1 && mesh(2).count <= 2 * MAX_STACK,'toast stack beside the Strip');
  assert.ok(bodies.mill.act > 0.9 && bodies.toaster.act > 0.9, `working: ${bodies.mill.act} ${bodies.toaster.act}`);
  assert.ok(bodies.mill.spin[0].speed > 3, `sails spin at ${bodies.mill.spin[0].speed}`);
  st.shards[0] = 0; // out of wheat: the sails slow to a drift
  for (let i = 0; i < 180; i++) layer.update(frame, 1 / 60);
  assert.ok(bodies.mill.act < 0.05 && bodies.mill.spin[0].speed < 0.7);
  const before = mesh(2).count; // the stack shrinks when the toast is eaten
  st.toast.stack[0] = 0;
  for (let i = 0; i < 180; i++) layer.update(frame, 1 / 60);
  assert.ok(mesh(2).count < before, `stack ${before} -> ${mesh(2).count}`);
  layer.dispose();
});

test('200 Crumbs cost almost nothing: three instanced meshes, a frame well under 2 ms', () => {
  LIVE_BODIES.clear();
  const ctx = fakeCtx();
  const st = createToasterState(3);
  for (let i = 0; i < 200; i++) st.units.push({ id: 5000 + i, kind: 'worker', owner: 0, x: 5 + (i % 20), y: 5 + Math.floor(i / 20), hp: 40, carrying: 5, order: null });
  const layer = createBreadLife(ctx, { THREE, getState: () => st, side: 0 });
  const frame = { units: st.units, structures: st.structures };
  layer.update(frame, 1 / 60);
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) layer.update(frame, 1 / 60);
  const ms = (performance.now() - t0) / 100;
  assert.ok(ms < 2, `${ms.toFixed(3)} ms per frame`);
  assert.equal(layer.root.children.length, 3);
});

test('300 loaded Crumbs: sacks stop at the cap and never spill into the slice mesh; a detached body is forgotten', () => {
  LIVE_BODIES.clear();
  const ctx = fakeCtx();
  const st = createToasterState(3);
  for (let i = 0; i < 300; i++) st.units.push({ id: 7000 + i, kind: 'worker', owner: 0, x: 3 + (i % 30), y: 3 + Math.floor(i / 30), hp: 40, carrying: 5, order: null });
  const group = new THREE.Group(); // a body inside a group that never reaches the scene
  const parts = buildToasterBody(THREE, 'mill', 0);
  group.add(parts.body);
  assert.ok(LIVE_BODIES.has(parts));
  const layer = createBreadLife(ctx, { THREE, getState: () => st });
  layer.update({ units: st.units, structures: st.structures }, 1 / 60);
  assert.ok(layer.root.children[0].count <= 256, 'sacks capped');
  assert.equal(layer.root.children[1].count, 0, 'no sack Crumb is drawn as toast');
  assert.ok(!LIVE_BODIES.has(parts), 'the detached group no longer stays in LIVE_BODIES');
});
