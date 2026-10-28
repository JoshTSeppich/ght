// Character Forge (play/forge/*): every recipe bakes in node with real Three.js, at the detail Joshua asked for, with the
// pivots its archetype animates, and bad recipes fail loudly with the list of valid names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RECIPES } from '../play/forge/recipes.mjs';
import { expand, ARCHETYPES, ACCESSORIES, PALETTES } from '../play/forge/archetypes.mjs';
import { bake, colorOf } from '../play/forge/bake.mjs';
import { SHAPES } from '../play/forge/shapes.mjs';

const PIVOTS = { human: ['body', 'head', 'legL', 'legR', 'armL', 'armR'], ghost: ['body', 'tendrilL', 'tendrilR'], toaster: ['body', 'axle0', 'axle1', 'axle2', 'axle3'], lantern: ['body'] };

test('every recipe bakes to a high-detail model with its archetype pivots and per-vertex team/glow flags', () => {
  for (const r of RECIPES) {
    const b = bake(THREE, r);
    assert.ok(b.tris >= 1000 && b.tris <= 20000, `${r.id}: ${b.tris} tris`);
    const pivots = b.segments.map((s) => s.pivot);
    for (const p of PIVOTS[r.base]) assert.ok(pivots.includes(p), `${r.id} lacks pivot ${p}`);
    for (const s of b.segments) for (const a of ['position', 'normal', 'color', 'aTeam', 'aEmit']) assert.ok(s.geometry.attributes[a], `${r.id}/${s.pivot} ${a}`);
    const team = b.segments.some((s) => s.geometry.attributes.aTeam.array.some((v) => v === 1));
    const glow = b.segments.some((s) => s.geometry.attributes.aEmit.array.some((v) => v === 1));
    assert.ok(team, `${r.id} has a team colour`);
    if (r.base !== 'human') assert.ok(glow, `${r.id} has glowing eyes`);
    b.segments.forEach((s) => s.geometry.dispose());
  }
});

test('hero detail is richer than game detail', () => {
  const r = RECIPES.find((x) => x.id === 'host');
  assert.ok(bake(THREE, r, { detail: 'hero' }).tris > bake(THREE, r).tris * 1.8);
});

test('a new character is one short recipe', () => {
  const b = bake(THREE, { id: 'test-guest', faction: 'hosters', base: 'human', height: 1.7, wear: ['partyhat', 'sunglasses'], hold: 'bottle' });
  assert.ok(b.tris > 3000);
});

test('bad recipes fail loudly and name the valid choices', () => {
  assert.throws(() => expand({ id: 'x', faction: 'hosters', base: 'robot' }), /bases: human, ghost, toaster, lantern/);
  assert.throws(() => expand({ id: 'x', faction: 'hosters', base: 'human', hold: 'sword' }), /accessories: .*clipboard/);
  assert.throws(() => bake(THREE, { id: 'x', faction: 'hosters', base: 'human', parts: [{ shape: 'blob', size: [1, 1, 1], at: [0, 0, 0], slot: 'skin' }] }), /shapes: rbox/);
});

test('colours resolve recipe -> faction palette, and every archetype and accessory is exported', () => {
  assert.equal(colorOf({ faction: 'hosters', colors: { jacket: '#123456' } }, 'jacket'), '#123456');
  assert.equal(colorOf({ faction: 'ghosters' }, 'porcelain'), PALETTES.ghosters.porcelain);
  assert.deepEqual(Object.keys(ARCHETYPES), ['human', 'ghost', 'toaster', 'lantern']);
  assert.ok(Object.keys(ACCESSORIES).length >= 15 && SHAPES.includes('bell'));
});
