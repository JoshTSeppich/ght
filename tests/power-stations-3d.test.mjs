// Power Stations drawn on /play (owner: sonnet): primitives from the sim's fence view, and the three.js layer headless.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stationPrims, primTriangles, createStationLayer, PYLON_TOP } from '../play/power-stations-3d.mjs';
import { fenceView } from '../play/power-view.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { setFence } from '../env/fence.mjs';
import { stepPower } from '../env/power.mjs';

function stationed() {
  const s = createToasterState(7);
  const strip = s.structures.find((c) => c.owner === 0 && c.kind === 'core');
  s.power.points.push({ id: 900, owner: 0, kind: 'extension', x: strip.x + 6, y: strip.y, range: 8 });
  s.power.points.push({ id: 901, owner: 0, kind: 'pylon', x: strip.x + 3, y: strip.y - 4, range: 8 });
  s.power.points.push({ id: 902, owner: 0, kind: 'pylon', x: strip.x + 15, y: strip.y - 4, range: 8 });
  stepPower(s);
  return { s, strip };
}

test('boxes are low, pylons are tall, the high line runs at the pylon cap with a ground shadow', () => {
  const { s } = stationed();
  const prims = stationPrims(fenceView(s, 0), 0);
  const top = (id) => Math.max(...prims.boxes.filter((b) => b.x === s.power.points.find((p) => p.id === id).x && b.y === s.power.points.find((p) => p.id === id).y).map((b) => b.h + b.sh));
  assert.ok(top(900) < 1, 'Extension Box is low');
  assert.ok(top(901) >= PYLON_TOP, 'Relay Pylon is tall');
  const high = prims.beams.filter((b) => b.mat === 'high0');
  assert.ok(high.length > 0 && high.every((b) => b.w <= 0.06), 'thin overhead line');
  assert.ok(high.some((b) => b.a[1] >= PYLON_TOP), 'it rides at the cap');
  assert.ok(prims.beams.some((b) => b.mat === 'shadow'), 'with a ground shadow');
  assert.ok(prims.boxes.some((b) => b.mat === 'cap0'), 'lit caps glow in the team colour');
});

test('a live fence is a thick team rail; a browned-out fence is grey and sparks', () => {
  const { s, strip } = stationed();
  assert.equal(setFence(s, 0, strip.id, 900, true), null);
  let prims = stationPrims(fenceView(s, 0), 0);
  const rail = prims.beams.find((b) => b.mat === 'rail0');
  assert.ok(rail && rail.w >= 0.18, 'thick glowing rail');
  assert.equal(prims.sparks.length, 0);
  const view = fenceView(s, 0);
  view.wires.forEach((w) => { w.state = 'dark'; });
  prims = stationPrims(view, 0);
  assert.ok(prims.beams.some((b) => b.mat === 'railDark') && !prims.beams.some((b) => b.mat === 'rail0'));
  assert.ok(prims.sparks.length > 0);
});

test('fenced land is a pentagon tint per tile and pegs are dots', () => {
  const view = { posts: [], wires: [], overhead: [], fenced: ['4,5', '5,5'], pegs: [{ id: 1, x: 7, y: 8 }] };
  const prims = stationPrims(view, 1);
  assert.equal(prims.pents.length, 2);
  assert.equal(prims.pents[0].mat, 'tint1');
  assert.ok(prims.boxes.some((b) => b.mat === 'peg1' && b.x === 7 && b.y === 8));
  const tris = primTriangles(prims);
  assert.equal(tris.get('tint1').length, 2 * 5 * 9, 'five triangles a tile');
});

test('the layer builds meshes, rebuilds only when the view changes, and disposes', () => {
  const { s, strip } = stationed();
  const scene = new THREE.Scene();
  const ctx = { THREE, scene, tileSize: 1, gridToWorld: (x, y, h, o) => o.set(x, h, y) };
  const layer = createStationLayer(ctx, { getState: () => s, side: 0 });
  layer.update({});
  assert.ok(layer.meshes.get('post').geometry.attributes.position.count > 0);
  assert.ok(layer.meshes.get('high0'));
  const before = layer.meshes.get('post');
  s.tick += 6; layer.update({});
  assert.equal(layer.meshes.get('post'), before, 'unchanged view keeps the mesh');
  setFence(s, 0, strip.id, 900, true); s.tick += 6; layer.update({});
  assert.ok(layer.meshes.get('rail0'), 'a new fence appears');
  assert.ok(layer.meshes.size <= 9, 'few draw calls');
  layer.dispose();
  assert.equal(scene.children.length, 0);
});
