// Forge bake (owner: Claude, Character Forge): an expanded recipe -> one merged BufferGeometry per PIVOT, with the colour
// of every part baked into vertex colours and two flags per vertex: aTeam (1 = take the side's colour) and aEmit (1 = draw
// self-lit, eyes and glows). A whole character is then a handful of geometries however many parts it has, so detail costs
// triangles, not draw calls.
//
//   bake(THREE, recipe, { detail: 'game' | 'hero' }) -> { id, faction, base, height, hover, width, tris,
//                                                         segments: [{ pivot, hinge, geometry, tris }] }
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { expand, PALETTES, GLOW_SLOTS } from './archetypes.mjs';
import { makeShape } from './shapes.mjs';

export function colorOf(recipe, slot) {
  return recipe.colors?.[slot] ?? PALETTES[recipe.faction]?.[slot] ?? PALETTES.hosters[slot] ?? '#ff00ff';
}

export function bake(THREE, recipe, { detail = 'game' } = {}) {
  const model = expand(recipe);
  const byPivot = new Map();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  for (const part of model.parts) {
    let g = makeShape(THREE, part, detail);
    g = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    m.compose(new THREE.Vector3(...part.at), q.setFromEuler(e.set(...(part.rot ?? [0, 0, 0]))), one);
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    const team = part.slot === 'team', emit = !!part.eye && GLOW_SLOTS.includes(part.slot) || GLOW_SLOTS.includes(part.slot);
    c.set(team ? '#ffffff' : colorOf(recipe, part.slot));
    const col = new Float32Array(n * 3), aTeam = new Float32Array(n), aEmit = new Float32Array(n);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; aTeam[i] = team ? 1 : 0; aEmit[i] = emit ? 1 : 0; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aTeam', new THREE.BufferAttribute(aTeam, 1));
    g.setAttribute('aEmit', new THREE.BufferAttribute(aEmit, 1));
    const key = part.pivot ?? 'body';
    if (!byPivot.has(key)) byPivot.set(key, []);
    byPivot.get(key).push(g);
  }
  const segments = [];
  let tris = 0;
  for (const [pivot, list] of byPivot) {
    const geometry = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    geometry.computeBoundingSphere();
    const t = geometry.attributes.position.count / 3;
    tris += t;
    segments.push({ pivot, hinge: model.pivots[pivot]?.hinge ?? [0, 0, 0], geometry, tris: t });
  }
  return { id: model.id, faction: model.faction, base: model.base, height: model.height, hover: model.hover, width: model.width, tris, segments, parts: model.parts.length };
}
