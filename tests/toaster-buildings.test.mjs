// Toaster Wars buildings (owner: sonnet): the Power Strip, Mill, Well and Toaster as blocky toys, hooked into
// viewer3d/buildings.mjs through ctx.buildingLook. Real Three.js, headless.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildToasterBody, TOASTER_BUILDING_KINDS, toasterBuildingLook, toasterBuildingMaterials } from '../play/toaster-buildings.mjs';
import { createBuildings } from '../viewer3d/buildings.mjs';

const tris = (g) => { let n = 0; g.traverse((o) => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n; };
const meshes = (g) => { const a = []; g.traverse((o) => { if (o.isMesh) a.push(o); }); return a; };
// the solid parts only: the ground decal (named 'contact') is wider than the model on purpose
const solidBox = (g) => { g.updateMatrixWorld(true); const b = new THREE.Box3(); g.traverse((o) => { if (o.isMesh && o.name !== 'contact') b.expandByObject(o); }); return b; };

test('four kinds: Power Strip (core), Mill, Well, Toaster; others are left to the old builders', () => {
  assert.deepEqual([...TOASTER_BUILDING_KINDS].sort(), ['core', 'mill', 'toaster', 'well']);
  assert.equal(buildToasterBody(THREE, 'forge', 0), null);
  assert.equal(buildToasterBody(THREE, 'turret', 0), null);
});

test('each model is a small blocky toy: under a tile and a half wide (the Power Strip may be 2.3), cheap, team colour on it, casts shadows', () => {
  for (const k of TOASTER_BUILDING_KINDS) {
    const p = buildToasterBody(THREE, k, 0);
    assert.equal(p.kind, k);
    assert.ok(p.body.isGroup);
    const box = solidBox(p.body), size = box.getSize(new THREE.Vector3());
    const maxX = k === 'core' ? 3.2 : 1.5;
    assert.ok(size.x <= maxX && size.z <= (k === 'core' ? 1.4 : 1.5), `${k} footprint ${size.x.toFixed(2)} x ${size.z.toFixed(2)}`);
    assert.ok(size.y > 0.3 && size.y < (k === 'mill' ? 2.21 : 1.4), `${k} height ${size.y.toFixed(2)}`);
    assert.ok(box.min.y >= -0.001, `${k} sits on the ground`);
    assert.ok(tris(p.body) < 400, `${k} triangles ${tris(p.body)}`);
    assert.ok(meshes(p.body).some((m) => m.castShadow), `${k} casts a shadow`);
    // the contract of viewer3d/buildings.mjs
    for (const f of ['spin', 'pulse', 'barrels']) assert.ok(Array.isArray(p[f]), f);
    const col = (o) => meshes(o.body).map((m) => m.material.color.getHex());
    assert.notDeepEqual(col(p), col(buildToasterBody(THREE, k, 1)), `${k}: the two teams differ`);
  }
});

test('the Power Strip is the base: about 3.0 x 0.7 x 1.3 tiles, cream satin, tall socket rail, plugs with prongs, team stripe', () => {
  const strip = buildToasterBody(THREE, 'core', 0);
  const size = solidBox(strip.body).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 3.0) < 0.15, `width ${size.x.toFixed(2)}`);
  assert.ok(Math.abs(size.z - 1.3) < 0.1, `depth ${size.z.toFixed(2)}`);
  assert.ok(size.y >= 1.2 && size.y < 1.4, `height with the flag ${size.y.toFixed(2)}`);
  for (const i of [0, 1]) {
    assert.ok(strip.body.getObjectByName(`team-plug-${i}`), `team plug ${i}`);
    assert.ok(strip.body.getObjectByName(`prong-${i}-a`) && strip.body.getObjectByName(`prong-${i}-b`), `prongs ${i}`);
  }
  assert.equal(strip.body.getObjectByName('sockets').children.length, 5);
  const rail = strip.body.getObjectByName('socket-rail');
  assert.ok(rail.scale.y >= 0.45 && rail.scale.x >= 2.85, 'rail is a tall back wall across the full width');
  const stripe = strip.body.getObjectByName('team-stripe');
  assert.ok(stripe, 'team stripe along the front edge');
  assert.ok(stripe.scale.x >= 2.95, `stripe runs the full front ${stripe.scale.x.toFixed(2)}`);
  assert.ok(stripe.scale.x * stripe.scale.z >= 0.3 * 3.0 * 1.3 * 0.3, 'stripe is a real share of the top');
});

test('satin edges on the boxes: every box carries aHalf and the shared toy edge material; the cream chassis is roughness 0.48', () => {
  const strip = buildToasterBody(THREE, 'core', 0);
  const chassis = strip.body.getObjectByName('strip');
  assert.equal(chassis.material.roughness, 0.48);
  assert.ok(chassis.material.userData.toyEdges, 'applyToyEdges ran on the chassis material');
  assert.ok(chassis.geometry.getAttribute('aHalf'), 'aHalf per vertex, so the edge band can find the box');
});

test('every building material carries the screen-space edge patch', () => {
  const M = toasterBuildingMaterials(THREE);
  for (const m of [M.chassis, M.faceplate, M.feet, M.toast, M.heat, ...M.team]) {
    assert.ok(m.userData.toyEdges?.uToyPx, `${m.name} has the px edge uniform`);
  }
  for (const [kind, name] of [['core', 'strip'], ['toaster', 'toaster']]) {
    const mesh = buildToasterBody(THREE, kind, 0).body.getObjectByName(name);
    assert.ok(mesh.material.userData.toyEdges, `${kind} body edge-patched`);
    assert.ok(mesh.geometry.getAttribute('aHalf'));
  }
});

test('?toy=0 keeps the old look: plain 0.78 roughness, no edge band, no decal', () => {
  globalThis.location = { search: '?toy=0' };
  try {
    const p = buildToasterBody(THREE, 'toaster', 0);
    assert.equal(p.body.getObjectByName('toaster').material.roughness, 0.78);
    assert.ok(!p.body.getObjectByName('toaster').material.userData.toyEdges);
    assert.equal(p.body.getObjectByName('contact'), undefined);
  } finally {
    delete globalThis.location;
  }
  assert.equal(buildToasterBody(THREE, 'toaster', 0).body.getObjectByName('contact').name, 'contact', 'the toy look is back without the flag');
});

test('contact decal under every building: one shared decal material across bodies and kinds', () => {
  const bodies = TOASTER_BUILDING_KINDS.map((k) => buildToasterBody(THREE, k, 0));
  const decal = bodies.map((p) => p.body.getObjectByName('contact'));
  assert.ok(decal.every(Boolean), 'each body has a decal');
  assert.ok(decal.every((d) => d.material === decal[0].material), 'one shared material');
  assert.equal(decal[0].material.depthWrite, false);
});

test('no per-building materials: the whole set of kinds and owners shares a handful of materials', () => {
  const seen = new Set();
  for (const k of TOASTER_BUILDING_KINDS) for (const owner of [0, 1]) {
    for (const m of meshes(buildToasterBody(THREE, k, owner).body)) seen.add(m.material);
  }
  assert.ok(seen.size <= 14, `distinct materials ${seen.size}`);
});

test('the Power Strip has five sockets and a face; the Toaster has two slices of toast that bob; the Mill has a gold hopper', () => {
  const strip = buildToasterBody(THREE, 'core', 0);
  assert.equal(strip.body.getObjectByName('sockets').children.length, 5);
  assert.ok(strip.body.getObjectByName('eye-left') && strip.body.getObjectByName('eye-right'));
  const t = buildToasterBody(THREE, 'toaster', 0);
  const slices = [t.body.getObjectByName('toast-left'), t.body.getObjectByName('toast-right')];
  assert.ok(slices.every(Boolean));
  const y0 = slices.map((s) => s.position.y);
  t.tick(0.4, 1 / 60);
  assert.ok(slices.some((s, i) => Math.abs(s.position.y - y0[i]) > 0.005), 'toast bobs');
  const m = buildToasterBody(THREE, 'mill', 0);
  assert.ok(m.body.getObjectByName('hopper'));
});

test('createBuildings uses ctx.buildingLook for these kinds and still builds forge and turret the old way', () => {
  const ctx = { THREE, scene: new THREE.Scene(), tileSize: 1, palette: null, gridToWorld: (x, y, h = 0, o = new THREE.Vector3()) => o.set(x - 128, h, y - 128) };
  ctx.buildingLook = toasterBuildingLook;
  const b = createBuildings(ctx);
  const mk = (id, kind, x) => ({ id, owner: 0, kind, x, y: 5, hp: 100, progress: 0, complete: true, queue: [] });
  const next = { tick: 1, units: [], structures: [mk(1, 'core', 3), mk(2, 'mill', 6), mk(3, 'well', 9), mk(4, 'toaster', 12), mk(5, 'forge', 15), mk(6, 'turret', 18)] };
  b.update({ tick: 1, alpha: 1, prev: next, next, events: [] }, 1 / 60);
  b.update({ tick: 2, alpha: 1, prev: next, next: { ...next, tick: 2 }, events: [] }, 1 / 60);
  const root = ctx.scene.getObjectByName('buildings');
  const names = root.children.map((c) => c.name);
  assert.equal(names.length, 6);
  assert.ok(root.children[0].getObjectByName('sockets'), 'the core is a Power Strip');
  assert.ok(root.children[1].getObjectByName('hopper'), 'the mill has a hopper');
  assert.ok(root.children[4].getObjectByProperty('type', 'Mesh'), 'the forge is still drawn');
  b.dispose();
});

test('dispose frees the custom body geometries and materials (haiku #727)', () => {
  // a fresh namespace (same classes) = a fresh page: earlier tests' bodies, never disposed, must not hold the shared counts
  const T2 = { ...THREE };
  const ctx = { THREE: T2, scene: new T2.Scene(), tileSize: 1, palette: null, gridToWorld: (x, y, h = 0, o = new T2.Vector3()) => o.set(x - 128, h, y - 128) };
  const made = [];
  ctx.buildingLook = (T, kind, owner) => {
    const p = toasterBuildingLook(T, kind, owner);
    p?.body.traverse((o) => { if (o.geometry) made.push(o.geometry); if (o.material) made.push(o.material); });
    return p;
  };
  const b = createBuildings(ctx);
  const s1 = { tick: 1, units: [], structures: ['mill', 'well'].map((k, i) => ({ id: i + 1, owner: 0, kind: k, x: 3 + i * 3, y: 5, hp: 100, progress: 0, complete: true, queue: [] })) };
  b.update({ tick: 1, alpha: 1, prev: s1, next: s1, events: [] }, 1 / 60);
  assert.ok(made.length > 10);
  const counts = new Map(made.map((o) => [o, 0]));
  for (const o of made) o.addEventListener('dispose', () => counts.set(o, counts.get(o) + 1));
  b.dispose();
  assert.ok(made.every((o) => counts.get(o) >= 1), 'every custom geometry and material was disposed');
});

test('removing a custom-look building frees its own body only, never the shared scaffold and geometry caches (haiku #733)', () => {
  const ctx = { THREE, scene: new THREE.Scene(), tileSize: 1, palette: null, gridToWorld: (x, y, h = 0, o = new THREE.Vector3()) => o.set(x - 128, h, y - 128), buildingLook: toasterBuildingLook };
  const b = createBuildings(ctx);
  const mk = (id, kind, x) => ({ id, owner: 0, kind, x, y: 5, hp: 100, progress: 0, complete: true, queue: [] });
  const s1 = { tick: 1, units: [], structures: [mk(1, 'mill', 3), mk(2, 'mill', 6)] };
  b.update({ tick: 1, alpha: 1, prev: s1, next: s1, events: [] }, 1 / 60);
  const root = ctx.scene.getObjectByName('buildings');
  const [first, second] = root.children;
  const own = new Set(); first.getObjectByName('mill-tower').traverse((o) => { if (o.geometry) own.add(o.geometry); });
  const shared = new Set();
  second.traverse((o) => { if (o.geometry) shared.add(o.geometry); for (const m of [].concat(o.material ?? [])) shared.add(m); });
  const freed = new Set();
  for (const o of shared) o.addEventListener('dispose', () => freed.add(o));
  // the second building stays; the first is destroyed and, once it has faded, disposed
  const s2 = { tick: 2, units: [], structures: [mk(2, 'mill', 6)] };
  for (let t = 2; t < 40; t++) b.update({ tick: t, alpha: 1, prev: s2, next: { ...s2, tick: t }, events: [] }, 0.25);
  assert.equal(root.children.length, 1, 'the destroyed building is gone');
  assert.equal(freed.size, 0, 'nothing the surviving building uses was disposed');
  b.dispose();
});

// Request #8: the "four cyan slabs" beside the Power Strip were the two team plugs. viewer3d/buildings.mjs animates every
// parts.pulse entry with obj.scale.set(k, 1, k), which wiped the plug's 0.3 x 0.2 x 0.3 scale and blew it up to about one tile.
function stripScene() {
  const ctx = { THREE, scene: new THREE.Scene(), tileSize: 1, palette: null, gridToWorld: (x, y, h = 0, o = new THREE.Vector3()) => o.set(x, h, y) };
  ctx.buildingLook = toasterBuildingLook;
  const b = createBuildings(ctx);
  const next = { tick: 1, units: [], structures: [{ id: 1, owner: 0, kind: 'core', x: 18, y: 20, hp: 100, progress: 0, complete: true, queue: [] }] };
  for (let i = 0; i < 40; i++) b.update({ tick: 1 + i, alpha: 1, prev: next, next: { ...next, tick: 1 + i }, events: [] }, 0.1);
  ctx.scene.updateMatrixWorld(true);
  return { ctx, b };
}

test('request #8: after the building animation runs, no flat cyan box wider than 0.6 tiles sits beside the Power Strip', () => {
  const { ctx, b } = stripScene();
  const c = new THREE.Vector3(18, 0, 20), found = [];
  ctx.scene.traverse((o) => {
    if (!o.isMesh || o.name === 'contact' || o.name === 'team-stripe') return; // the stripe is the strip's own team band, 0.26 deep, on its top
    const bb = new THREE.Box3().setFromObject(o), ctr = bb.getCenter(new THREE.Vector3());
    if (ctr.distanceTo(c) > 3.5) return;
    const col = o.material.color, size = bb.getSize(new THREE.Vector3());
    const cyan = col && col.b > 0.5 && col.r < 0.3;
    if (cyan && Math.max(size.x, size.z) > 0.6) found.push(`${o.name} ${size.toArray().map((v) => v.toFixed(2))}`);
  });
  assert.deepEqual(found, [], 'cyan slabs near the strip');
  b.dispose();
});

test('request #8: the plugs keep their small size while they pulse, and the strip is the only body there with its contact decal', () => {
  const { ctx, b } = stripScene();
  const root = ctx.scene.getObjectByName('buildings');
  assert.equal(root.children.length, 1, 'one structure, the Power Strip');
  for (const n of ['team-plug-0', 'team-plug-1']) {
    const p = root.getObjectByName(n), size = new THREE.Box3().setFromObject(p).getSize(new THREE.Vector3());
    assert.ok(size.x < 0.45 && size.z < 0.45 && size.y < 0.3, `${n} is ${size.toArray().map((v) => v.toFixed(2))}`);
  }
  assert.ok(root.getObjectByName('contact'), 'the soft contact decal is there');
  b.dispose();
});

test('#18 building materials carry the pixel-width toy edge helper', () => {
  const mats = toasterBuildingMaterials(THREE);
  const withEdges = Object.values(mats).filter((x) => x && x.userData && x.userData.toyEdges);
  assert.ok(withEdges.length > 0, 'at least one building material has toy edges');
});

test('#19 every building material compiles with the crest mask, ivory lift and charcoal inset; aHalf is per box', () => {
  const mats = toasterBuildingMaterials(THREE);
  const satin = Object.values(mats).flat().filter((m) => m && m.userData && m.userData.toyEdges);
  assert.ok(satin.length >= 6, 'chassis, faceplate, feet, toast, heat and team materials carry the edge shader');
  for (const m of satin) {
    const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <tonemapping_fragment>' };
    m.onBeforeCompile(shader, {});
    const f = shader.fragmentShader;
    assert.match(f, /toyEdgeMasks\(vToyPos/, `${m.name} crest mask`);
    assert.match(f, /vec3\(1\.0, 0\.92, 0\.72\), toyMasks\.x \* uToyLift/, `${m.name} ivory lift`);
    assert.match(f, /vec3\(0\.10, 0\.11, 0\.13\)/, `${m.name} charcoal inset`);
    assert.match(shader.vertexShader, /vToyPos = position \* \(2\.0 \* aHalf\)/, `${m.name} object-space vToyPos`);
    assert.equal(shader.uniforms.uToyPx.value, 3);
  }
});

test('#35 Mill, Well and Toaster have distinct block silhouettes and large colour cues', () => {
  for (const owner of [0, 1]) {
    const kinds = ['mill', 'well', 'toaster'];
    const bodies = kinds.map(k => buildToasterBody(THREE, k, owner).body);
    const sizes = bodies.map(b => solidBox(b).getSize(new THREE.Vector3()));
    const [mill, well, toaster] = bodies;
    const dimensions = (body, name, expected) => assert.deepEqual(body.getObjectByName(name).scale.toArray(), expected, name);
    dimensions(mill, 'tower', [0.78, 1.7, 0.78]);
    dimensions(mill, 'hopper', [1.3, 0.5, 1.1]);
    assert.equal(mill.getObjectByName('tower').position.y, 0.85);
    assert.equal(mill.getObjectByName('hopper').position.y, 1.95);
    dimensions(well, 'water', [1.3, 0.08, 0.9]);
    dimensions(well, 'ring', [1.5, 0.4, 0.12]);
    dimensions(toaster, 'toaster', [1.2, 0.55, 0.75]);
    for (const name of ['toast-left', 'toast-right']) dimensions(toaster, name, [0.66, 0.75, 0.08]);
    assert.equal(buildToasterBody(THREE, 'toaster', owner).stackTop.y, 1.35);
    assert.ok(sizes[1].x > sizes[0].x && sizes[1].x > sizes[2].x, 'Well is widest');
    assert.ok(sizes[0].y > sizes[2].y + 0.2, 'Mill is clearly tallest');
    assert.ok(sizes[1].y < sizes[2].y * 0.55, 'Well is clearly lowest');
    for (let i = 0; i < sizes.length; i++) for (let j = i + 1; j < sizes.length; j++) {
      assert.ok(Math.abs(sizes[i].y / sizes[i].x - sizes[j].y / sizes[j].x) > 0.15, 'different bounding-box proportions');
    }
    assert.equal(new Set(bodies.map(b => meshes(b).length)).size, 3, 'different part counts');
    const M = toasterBuildingMaterials(THREE);
    const hopper = mill.getObjectByName('hopper'), door = mill.getObjectByName('door');
    assert.equal(hopper.material, M.toast);
    assert.ok(hopper.scale.x >= 0.9 && hopper.scale.y >= 0.3, 'large gold hopper');
    assert.equal(door.material, M.faceplate);
    const water = well.getObjectByName('water'), rim = well.getObjectByName('ring');
    assert.equal(rim.material, M.faceplate);
    assert.equal(water.material.color.getHexString(), '4aa8d8');
    assert.ok(water.scale.x >= 0.7 && water.scale.z >= 0.5, 'broad visible water surface');
    assert.ok(water.position.y + water.scale.y / 2 < rim.position.y + rim.scale.y / 2, 'water inset below rim');
    for (const name of ['slot-toast-left', 'slot-toast-right']) {
      const slot = toaster.getObjectByName(name);
      assert.equal(slot.material, M.faceplate);
      assert.ok(slot.scale.x >= 0.35 && slot.scale.z >= 0.15, 'slots read at play zoom');
    }
    assert.equal(toaster.getObjectByName('toast-left').material, M.toast);
    for (const b of bodies) for (const m of meshes(b).filter(m => m.name !== 'contact')) {
      assert.equal(m.geometry.type, 'BoxGeometry', 'plain blocks only');
      assert.ok(m.geometry.getAttribute('aHalf'), 'toy edges on each block');
    }
    assert.ok(bodies.every(b => b.getObjectByName('team')), 'team blocks retained');
  }
});
