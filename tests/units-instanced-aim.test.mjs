// Regression: the shot-aim target passed to the toaster layer must be a real Vector3 (gridToWorld calls target.set).
// On 2026-10-25 a plain object here switched the units system off on the first hit and froze /play at 0:00.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('units-instanced builds the shot aim with a THREE.Vector3, never a plain object', () => {
  const src = fs.readFileSync(new URL('../play/units-instanced.mjs', import.meta.url), 'utf8');
  const line = src.split('\n').find((l) => l.includes('const aim = aimEnt'));
  assert.ok(line, 'the aim line exists');
  assert.ok(line.includes('new THREE.Vector3()'), `aim target must be a Vector3: ${line.trim()}`);
  assert.ok(!line.includes('{ x: 0, y: 0, z: 0 }'), 'a plain object breaks gridToWorld (target.set)');
});

test('bakeKind gives every vertex aLocal in -1..1 and a positive aHalf', async () => {
  const { bakeKind } = await import('../play/units-instanced.mjs');
  const { geom } = bakeKind('worker');
  const n = geom.attributes.position.count;
  const L = geom.attributes.aLocal, H = geom.attributes.aHalf;
  assert.ok(L && H, 'aLocal and aHalf exist');
  assert.equal(L.count, n); assert.equal(L.itemSize, 3); assert.equal(H.itemSize, 3);
  for (let i = 0; i < n * 3; i++) {
    assert.ok(Math.abs(L.array[i]) <= 1.0001, 'aLocal within -1..1');
    assert.ok(H.array[i] > 0, 'aHalf positive');
  }
});

test('makeUnitMaterial injects the shared edge band, skips emissive, and bumps the cache key', async () => {
  const { makeUnitMaterial } = await import('../play/units-instanced.mjs');
  const { TOY_EDGE_PX } = await import('../play/toy-render.mjs');
  const m = makeUnitMaterial();
  assert.notEqual(m.customProgramCacheKey(), 'ght-instanced-units');
  assert.match(m.customProgramCacheKey(), /edge/);
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\n#include <color_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>',
  };
  m.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /toyEdgeMasks/);
  assert.match(shader.fragmentShader, /vEmit\s*<=?\s*0\.0/);
  assert.match(shader.vertexShader, /attribute vec3 aLocal/);
  assert.match(shader.vertexShader, /attribute vec3 aHalf/);
  assert.equal(shader.uniforms.uToyPx.value, TOY_EDGE_PX.default);
  assert.ok(shader.uniforms.uToyLift.value >= 0.3, 'baked path gets the same output lift (#11)');
  assert.match(shader.fragmentShader, /vEmit <= 0\.0/);
});
