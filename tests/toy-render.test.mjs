// Premium toy renderer (owner: sonnet). Pure logic of play/toy-render.mjs: material table, edge-shader injection,
// instance batching by map chunk, shadow-frustum fit, quality governor. Runs in node with real Three.js, no GPU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  TOY_MATERIALS, makeToyMaterials, injectEdgeHighlight, planBatches, BATCH_TYPES, fitShadowFrustum,
  QUALITY_TIERS, createGovernor, toyEnabled, applyToyLook, createContactShadows,
  applyToyEdges, createToyBoxInstances, snapShadowCentre, installToy, applyToyToUnits, contactMaterial,
  TOY_EDGE_PX, clampEdgePx,
} from '../play/toy-render.mjs';

test('material table matches RENDERING.md and builds one shared material per part', () => {
  assert.deepEqual(Object.keys(TOY_MATERIALS).sort(), ['chassis', 'faceplate', 'feet', 'team', 'toast']);
  assert.equal(TOY_MATERIALS.chassis.color, '#F2D7A6');
  assert.equal(TOY_MATERIALS.chassis.roughness, 0.48);
  assert.equal(TOY_MATERIALS.faceplate.metalness, 0.08);
  const a = makeToyMaterials(THREE), b = makeToyMaterials(THREE);
  assert.ok(a.chassis instanceof THREE.MeshStandardMaterial);
  assert.notEqual(a.chassis, b.chassis);
  assert.equal(a.toast.roughness, 0.82);
});

test('edge highlight injects object-space distance, fwidth AA and half-extents, once', () => {
  const shader = { uniforms: {}, vertexShader: 'void main(){\n#include <begin_vertex>\n}', fragmentShader: 'void main(){\n#include <opaque_fragment>\n}' };
  injectEdgeHighlight(shader, { halfExtents: [0.5, 0.3, 0.4], band: 0.02, intensity: 0.18 });
  assert.match(shader.vertexShader, /vToyPos/);
  assert.match(shader.fragmentShader, /fwidth/);
  assert.match(shader.fragmentShader, /uToyHalf/);
  assert.deepEqual(shader.uniforms.uToyHalf.value.toArray(), [0.5, 0.3, 0.4]);
  assert.equal(shader.uniforms.uToyIntensity.value, 0.18);
  const once = shader.fragmentShader;
  injectEdgeHighlight(shader, {});
  assert.equal(shader.fragmentShader, once, 'second call is a no-op');
  assert.throws(() => injectEdgeHighlight({ vertexShader: 'x', fragmentShader: 'y', uniforms: {} }, {}));
});

test('batches group by part type and map chunk, one per pair, deterministic', () => {
  const parts = [
    { type: 'chassis', x: 1, y: 1 }, { type: 'chassis', x: 2, y: 3 }, { type: 'chassis', x: 20, y: 3 },
    { type: 'eyes', x: 1, y: 1 }, { type: 'decal', x: 40, y: 40 },
  ];
  const b = planBatches(parts, 16);
  assert.deepEqual(b.map((x) => `${x.type}@${x.cx},${x.cy}:${x.items.length}`),
    ['chassis@0,0:2', 'chassis@1,0:1', 'eyes@0,0:1', 'decal@2,2:1']);
  assert.ok(BATCH_TYPES.includes('faceplate') && BATCH_TYPES.includes('toast'));
  assert.throws(() => planBatches([{ type: 'bogus', x: 0, y: 0 }], 16));
});

test('shadow frustum follows the view and stays tight', () => {
  const f = fitShadowFrustum({ x0: 10, y0: 20, x1: 30, y1: 36 }, { margin: 2 });
  assert.equal(f.cx, 20); assert.equal(f.cy, 28);
  assert.ok(f.half >= 12 && f.half <= 28, `half ${f.half}`);
  const huge = fitShadowFrustum({ x0: 0, y0: 0, x1: 256, y1: 256 }, {});
  assert.equal(huge.half, 28, 'capped at 28');
});

test('governor drops tier on sustained slow frames and climbs back only after a long calm, with hysteresis', () => {
  assert.deepEqual(QUALITY_TIERS.map((t) => t.name), ['high', 'balanced', 'performance']);
  const g = createGovernor({ window: 30, downMs: 20, upMs: 13, cooldown: 60 });
  assert.equal(g.tier.name, 'high');
  for (let i = 0; i < 10; i++) g.push(40);
  assert.equal(g.tier.name, 'high', 'a short spike does not switch');
  for (let i = 0; i < 30; i++) g.push(25);
  assert.equal(g.tier.name, 'balanced');
  for (let i = 0; i < 29; i++) g.push(25);
  assert.equal(g.tier.name, 'balanced', 'cooldown stops flapping');
  for (let i = 0; i < 40; i++) g.push(25);
  assert.equal(g.tier.name, 'performance');
  for (let i = 0; i < 100; i++) g.push(16);
  assert.equal(g.tier.name, 'performance', '16 ms is between thresholds: stay');
  for (let i = 0; i < 200; i++) g.push(8);
  assert.notEqual(g.tier.name, 'performance', 'calm frames climb back');
  assert.ok(g.stats().p95 >= g.stats().median);
});

test('?toy=0 turns the toy look off; default on', () => {
  assert.equal(toyEnabled(new URLSearchParams('')), true);
  assert.equal(toyEnabled(new URLSearchParams('toy=0')), false);
  assert.equal(toyEnabled(new URLSearchParams('toy=1')), true);
  assert.equal(toyEnabled(undefined), true);
});

test('applyToyLook sets the rig, AgX, capped pixel ratio and one shadow caster', () => {
  const sun = new THREE.DirectionalLight(), rim = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight();
  const scene = new THREE.Scene();
  scene.add(sun, rim, hemi);
  const renderer = { toneMapping: 0, toneMappingExposure: 1, outputColorSpace: '', setPixelRatio() {}, shadowMap: { enabled: true, type: 0 } };
  const ctx = { THREE, scene, renderer, lights: { sun, rim, hemi }, size: { dpr: 2 } };
  const look = applyToyLook(ctx);
  assert.equal(renderer.toneMapping, THREE.AgXToneMapping);
  assert.equal(renderer.toneMappingExposure, 1.15);
  assert.equal(renderer.outputColorSpace, THREE.SRGBColorSpace);
  assert.equal(sun.intensity, 2.6);
  assert.equal(sun.castShadow, true);
  assert.equal(rim.castShadow, false);
  assert.equal(hemi.intensity, 0.85);
  assert.equal(sun.shadow.bias, -0.00015);
  assert.equal(sun.shadow.normalBias, 0.025);
  assert.ok(look.fill instanceof THREE.DirectionalLight && look.fill.castShadow === false);
  assert.ok(scene.children.includes(look.fill));
  look.dispose();
  assert.ok(!scene.children.includes(look.fill));
});

test('contact shadows: one instanced quad, one matrix per unit, no depth write', () => {
  const scene = new THREE.Scene();
  const cs = createContactShadows({ THREE, scene }, { capacity: 8 });
  assert.ok(cs.mesh instanceof THREE.InstancedMesh);
  assert.equal(cs.mesh.material.depthWrite, false);
  cs.set([{ x: 1, y: 0.02, z: 2, radius: 0.5 }, { x: 3, y: 0.02, z: 4, radius: 0.4 }]);
  assert.equal(cs.mesh.count, 2);
  const m = new THREE.Matrix4(); cs.mesh.getMatrixAt(1, m);
  assert.equal(new THREE.Vector3().setFromMatrixPosition(m).x, 3);
  cs.set(Array.from({ length: 20 }, () => ({ x: 0, y: 0, z: 0, radius: 1 })));
  assert.equal(cs.mesh.count, 8, 'capacity caps the draw');
});

test('#54 contact decals are dark, solid near the centre and soft at the edge', () => {
  const cs = createContactShadows({ THREE, scene: new THREE.Scene() });
  const material = cs.mesh.material;
  assert.ok(material.opacity >= 0.18 && material.opacity <= 0.34);
  assert.ok(Math.abs(material.opacity - 0.32) < 0.01, 'peak opacity near 0.32');
  const c = material.color.clone().convertLinearToSRGB();
  assert.ok(255 * (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) < 60);
  const { data, width } = material.map.image;
  const alpha = (x, y) => data[(y * width + x) * 4 + 3];
  assert.ok(alpha(32, 32) > alpha(0, 32));
  assert.ok(alpha(44, 32) >= 250, 'inner footprint stays solid');
  assert.equal(alpha(0, 0), 0);
  cs.set([{ x: 0, y: 0, z: 0, width: 2, depth: 1 }]);
  const m = new THREE.Matrix4(); cs.mesh.getMatrixAt(0, m);
  const scale = new THREE.Vector3().setFromMatrixScale(m);
  assert.ok(scale.x >= 2.2 && scale.x <= 2.3);
  assert.ok(scale.z >= 1.1 && scale.z <= 1.15);
  assert.ok(m.elements[13] > 0 && m.elements[13] < 0.02);
  assert.equal(material.depthWrite, false);
  cs.dispose();
});

test('contact shadows are a 64px radial texture and depth goes in scale.z', () => {
  const scene = new THREE.Scene();
  const cs = createContactShadows({ THREE, scene }, { capacity: 4 });
  assert.equal(cs.mesh.material.map.image.width, 64);
  assert.equal(cs.mesh.material.toneMapped, false);
  cs.set([{ x: 0, y: 0, z: 0, width: 1, depth: 2 }]);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  cs.mesh.getMatrixAt(0, m); m.decompose(p, q, s);
  assert.ok(s.z > s.x * 1.5, `depth ${s.z} vs width ${s.x}`);
  assert.ok(Math.abs(s.y - 1) < 1e-6);
});

test('applyToyEdges: aHalf attribute, fwidth AA, guarded against reuse and missing aHalf', () => {
  const mat = new THREE.MeshStandardMaterial();
  const h = applyToyEdges(mat, { px: 3.2, intensity: 0.2 });
  assert.throws(() => applyToyEdges(mat), /already/);
  assert.throws(() => applyToyEdges(new THREE.MeshBasicMaterial()), TypeError);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
  mat.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /attribute vec3 aHalf/);
  assert.match(shader.fragmentShader, /fwidth/);
  assert.match(shader.fragmentShader, /toyHas/, 'no aHalf means no edge');
  assert.equal(shader.uniforms.uToyPx.value, 3.2);
  h.setPx(9); assert.equal(shader.uniforms.uToyPx.value, 3.5, 'clamped to 3.5 px');
  h.setPx(0.2); assert.equal(shader.uniforms.uToyPx.value, 2.5, 'clamped to 2.5 px');
  assert.ok(mat.customProgramCacheKey().includes('toy-edges'));
  const mesh = createToyBoxInstances([{ x: 0, y: 0, z: 0, width: 2, height: 1, depth: 4 }], mat);
  assert.deepEqual(Array.from(mesh.geometry.getAttribute('aHalf').array), [1, 0.5, 2]);
  assert.throws(() => createToyBoxInstances([{ width: 0, height: 1, depth: 1 }], mat));
});

test('shadow centre snaps to light-space texels so panning never shimmers', () => {
  const dir = new THREE.Vector3(-8, 14, 9).normalize();
  const a = snapShadowCentre(new THREE.Vector3(10.01, 0, 5.02), dir, 0.1);
  const b = snapShadowCentre(new THREE.Vector3(10.03, 0, 5.03), dir, 0.1);
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  for (const axis of [right, up]) {
    const k = a.dot(axis) / 0.1;
    assert.ok(Math.abs(k - Math.round(k)) < 1e-6, 'centre sits on a texel boundary');
    assert.ok(Math.abs(b.dot(axis) - a.dot(axis)) < 1e-9 || Math.abs(b.dot(axis) - a.dot(axis)) > 0.09);
  }
  assert.ok(snapShadowCentre(a.clone(), dir, 0.1).distanceTo(a) < 1e-9, 'idempotent');
});

function fakeCtx(extra = {}) {
  const sun = new THREE.DirectionalLight(), rim = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight();
  const scene = new THREE.Scene(); scene.add(sun, rim, hemi);
  return { THREE, scene, renderer: { shadowMap: { enabled: true } }, lights: { sun, rim, hemi }, ...extra };
}

test('installToy is idempotent per ctx and honours ?toy=0', () => {
  const added = [];
  const engine = { add: (s) => added.push(s), resize() {} };
  const ctx = fakeCtx({ quality: {}, composer: {} });
  const a = installToy(ctx, engine, { query: new URLSearchParams('') });
  const b = installToy(ctx, engine, { query: new URLSearchParams('') });
  assert.equal(a, b); assert.equal(ctx.toy, a);
  assert.equal(added.length, 1);
  assert.equal(ctx.scene.children.filter((c) => c.isDirectionalLight).length, 3, 'sun, rim and ONE fill');
  assert.ok(a.missing.includes('gridToWorld'), 'reports what the ctx lacks');
  assert.equal(installToy(fakeCtx(), engine, { query: new URLSearchParams('toy=0') }), null);
});

test('MSAA: samples stay set on both composer targets after a resize', () => {
  const t1 = new THREE.WebGLRenderTarget(8, 8), t2 = new THREE.WebGLRenderTarget(8, 8);
  applyToyLook(fakeCtx({ composer: { renderTarget1: t1, renderTarget2: t2 } }));
  t1.setSize(16, 16);
  assert.equal(t1.samples, 4); assert.equal(t2.samples, 4);
});

test('applyToyToUnits makes baked unit materials satin and receive shadows, once', () => {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), mat, 2);
  root.add(mesh);
  assert.equal(applyToyToUnits(root), 1);
  assert.equal(mat.roughness, 0.48); assert.ok(mat.metalness <= 0.08);
  assert.equal(mesh.receiveShadow, true);
  assert.equal(applyToyToUnits(root), 0, 'second pass is a no-op');
});

test('the edge band is measured in screen pixels: the mask is uToyPx times the per-pixel derivative, clamped 2.5 to 3.5 (3 px since #19)', () => {
  assert.deepEqual(TOY_EDGE_PX, { min: 2.5, default: 3, max: 3.5 });
  assert.equal(clampEdgePx(undefined), 3);
  assert.equal(clampEdgePx(0.5), 2.5);
  assert.equal(clampEdgePx(9), 3.5);
  const mat = new THREE.MeshStandardMaterial();
  applyToyEdges(mat);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
  mat.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /uToyPx \* aa/, 'band = pixels times fwidth, so it holds at every zoom');
  assert.ok(!/uToyBand/.test(shader.fragmentShader), 'no model-unit band left');
});

test('the toy look turns bloom off (RENDERING.md part 10: ship without it)', () => {
  const sun = new THREE.DirectionalLight(), rim = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight();
  const renderer = { toneMapping: 0, toneMappingExposure: 1, outputColorSpace: '', shadowMap: { enabled: true, type: 0 } };
  const bloom = { enabled: true };
  applyToyLook({ THREE, scene: new THREE.Scene(), renderer, lights: { sun, rim, hemi }, passes: { bloom } });
  assert.equal(bloom.enabled, false);
});

test('one shared contact-shadow material for every decal set; dispose of one set keeps it', () => {
  const a = contactMaterial(THREE);
  assert.equal(contactMaterial(THREE), a);
  const cs = createContactShadows({ THREE, scene: new THREE.Scene() }, { capacity: 2 });
  assert.equal(cs.mesh.material, a);
  assert.equal(a.map.image.width, 64);
  cs.dispose();
  assert.equal(contactMaterial(THREE), a, 'still the same object after a dispose');
});

test('edge shader: band width comes from screen derivatives and a px uniform, not model units', () => {
  const mat = new THREE.MeshStandardMaterial();
  applyToyEdges(mat);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' };
  mat.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /uniform float uToyPx/);
  assert.match(shader.fragmentShader, /fwidth\(d\)/);
  assert.match(shader.fragmentShader, /uToyPx \* aa/, 'band = px x model-units-per-pixel');
  assert.ok(!/uToyBand/.test(shader.fragmentShader), 'no fixed model-unit band');
  assert.ok(shader.uniforms.uToyPx.value >= 2.5 && shader.uniforms.uToyPx.value <= 3.5);
  const i = shader.uniforms.uToyIntensity.value;
  assert.ok(i >= 0.35 && i <= 0.45, `ivory intensity ${i}`);
  assert.equal(shader.uniforms.uToyInset.value, 0.12, 'charcoal inset darkens the face about 12 percent');
});

test('toy-render exports the shared edge GLSL used by instanced units', async () => {
  const m = await import('../play/toy-render.mjs');
  assert.match(m.TOY_EDGE_FUNC_GLSL, /toyEdgeMasks/);
  assert.match(m.TOY_EDGE_FUNC_GLSL, /fwidth/);
  const u = m.toyEdgeUniforms();
  assert.equal(u.uToyPx.value, 3); assert.equal(u.uToyIntensity.value, 0.4); assert.equal(u.uToyInset.value, 0.12);
});

// #11 cause: /play toasters draw through play/toaster-units.mjs (applyToyEdges), not the baked makeUnitMaterial. Its tint
// (#fff0d5) is nearly the cream chassis (#F2D7A6), so the albedo mix lightens the chassis by ~4 percent and lighting plus
// tone mapping erase that. The fix lifts the OUTPUT colour toward white after tone mapping.
test('#11 edge lift hits the output colour after tone mapping; the tint alone was too close to the chassis', () => {
  const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const chassis = hex(TOY_MATERIALS.chassis.color), tint = hex('#fff0d5');
  const albedoGain = (lum(tint) * 0.4 + lum(chassis) * 0.6) / lum(chassis) - 1;
  assert.ok(albedoGain < 0.06, `albedo-only band lightens the chassis by only ${(albedoGain * 100).toFixed(1)}%`);
  const mat = new THREE.MeshStandardMaterial();
  applyToyEdges(mat);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <tonemapping_fragment>\n#include <colorspace_fragment>' };
  mat.onBeforeCompile(shader);
  const f = shader.fragmentShader;
  const lift = shader.uniforms.uToyLift.value;
  assert.ok(lift >= 0.3 && lift <= 0.5, 'chassis lift');
  assert.match(f, /#include <tonemapping_fragment>\s*gl_FragColor\.rgb = mix\(gl_FragColor\.rgb, vec3\(1\.0, 0\.92, 0\.72\), toyMasks\.x \* uToyLift\)/);
  assert.ok(f.indexOf('* uToyLift)') < f.indexOf('#include <colorspace_fragment>'), 'before sRGB encode');
  const enc = (l) => 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  assert.ok(enc(0.6 + 0.4 * lift) / enc(0.6) >= 1.12, 'edge at least 12 percent lighter than a mid face in output pixels');
  const team = new THREE.MeshStandardMaterial();
  applyToyEdges(team, { lift: 0.2 });
  const s2 = { uniforms: {}, vertexShader: shader.vertexShader, fragmentShader: '#include <common>\n#include <color_fragment>' };
  team.onBeforeCompile(s2);
  assert.equal(s2.uniforms.uToyLift.value, 0.2, 'per-material lift keeps the cyan block unblown');
});

test('#18 edge band is max(model width, uToyPx screen pixels) via fwidth, and the material still compiles with it', async () => {
  const m = await import('../play/toy-render.mjs');
  assert.match(m.TOY_EDGE_FUNC_GLSL, /max\(uToyPx \* aa, vec3\(TOY_EDGE_MIN_MODEL\)\)/);
  assert.match(m.TOY_EDGE_FUNC_GLSL, /#define TOY_EDGE_MIN_MODEL 0\.025/);
  assert.match(m.TOY_EDGE_FUNC_GLSL, /fwidth\(d\)/);
  assert.ok(m.TOY_EDGE_LIFT >= 0.5);
  const mat = new THREE.MeshStandardMaterial();
  m.applyToyEdges(mat);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <tonemapping_fragment>' };
  mat.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /TOY_EDGE_MIN_MODEL/);
  assert.match(shader.fragmentShader, /fwidth/);
});

// #19: prove the crest mask, the ivory output lift and the charcoal inset are in the compiled fragment shader of the
// materials the play scene really uses, and that vToyPos is object-space per instance.
test('#19 applyToyEdges shader carries crest mask, ivory lift, charcoal inset and per-instance object-space vToyPos', async () => {
  const m = await import('../play/toy-render.mjs');
  const mat = new THREE.MeshStandardMaterial();
  m.applyToyEdges(mat);
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <tonemapping_fragment>' };
  mat.onBeforeCompile(shader);
  const f = shader.fragmentShader;
  assert.match(f, /toyEdgeMasks\(vToyPos, max\(vToyHalf/, 'crest mask runs on vToyPos with the per-instance half extents');
  assert.match(f, /vec3\(1\.0, 0\.92, 0\.72\), toyMasks\.x \* uToyLift/, 'ivory lift on the output');
  assert.match(f, /1\.0 - toyMasks\.y \* uToyInset/, 'inset darkens the face');
  assert.match(f, /vec3\(0\.10, 0\.11, 0\.13\)/, 'charcoal tint');
  assert.match(f, /band \+ 1\.5 \* aa/, 'inset is 1.5 px wide');
  assert.match(shader.vertexShader, /attribute vec3 aHalf/);
  assert.match(shader.vertexShader, /vToyPos = position \* \(2\.0 \* aHalf\)/, 'object space, scaled by the instance half extents');
  assert.equal(shader.uniforms.uToyLift.value, 0.5, 'lift stays at the 0.5 cap');
  assert.equal(m.TOY_EDGE_LIFT, 0.5);
});

test('#19 injectEdgeHighlight body still compiles to a crest line (object-space vToyPos)', () => {
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '#include <opaque_fragment>' };
  injectEdgeHighlight(shader, { THREE });
  assert.match(shader.vertexShader, /vToyPos = position;/);
  assert.match(shader.fragmentShader, /uToyIntensity \* edge/);
});
