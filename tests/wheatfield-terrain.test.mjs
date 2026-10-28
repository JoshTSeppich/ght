// Wheatfield Valley on the play page (owner: sonnet): a square-grid ground in the Quiet Battlefield palette (STYLE-BIBLE
// section 8, play/style-lab/grid-terrain-kit.mjs look), a minimap that shows the land instead of dark Voronoi cells, and
// boulders / wheat bundles / windmill pads drawn from the map's own tile letters. Real Three.js, headless.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateMap } from '../env/map.mjs';
import { TERRAIN_PALETTE } from '../play/style-lab/terrain-kit.mjs';
import {
  QUIET, tileColour, buildTileImage, buildMinimapImage, createWheatfieldTerrain, SEAM, NAVY, BAND, SHORE, SPRING, rippleSpots, GLINT_BUDGET, LIT_GROUND_GAIN,
} from '../play/wheatfield-terrain.mjs';

const map = generateMap(7, { map: 'wheatfield' });
const px = (img, x, y) => { const i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
const hex = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const near = (a, b, tol = 24) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

test('the palette is the Quiet Battlefield table: ground, wheat, water, cliff, ramp', () => {
  assert.equal(QUIET.ground, TERRAIN_PALETTE.ground);
  assert.equal(QUIET.ground, 0x52696b); assert.equal(QUIET.wheat, 0xc9a65e); assert.equal(QUIET.shallow, 0x367d8a);
  assert.equal(QUIET.cliff, 0x303f48); assert.equal(QUIET.ramp, 0x89918a);
});

test('tile letters map to surfaces: creek is water, bridge and ford are walkable looks, wheat is warm', () => {
  assert.equal(tileColour('~', {}), BAND);
  assert.equal(tileColour('~', { deep: true }), NAVY);
  assert.equal(tileColour('.', {}), QUIET.ground);
  assert.equal(tileColour('.', { high: true }), QUIET.high);
  assert.equal(tileColour('B', {}), QUIET.ramp);
  assert.equal(tileColour('=', {}), QUIET.ramp);
  assert.equal(tileColour('G', {}), QUIET.socket);
  assert.equal(tileColour('L', {}), QUIET.meadow);
  assert.notEqual(tileColour('S', {}), QUIET.ground, 'a wheat field tile is tinted');
});

test('the tile image is a 256 x 256 grid with thin seams, one pixel block per tile, no bright grass', () => {
  const img = buildTileImage(map);
  assert.equal(img.width, 256 * 4); assert.equal(img.height, 256 * 4);
  assert.equal(img.data.length, img.width * img.height * 4);
  // an open ground tile: body pixel is the base ground (± the faint grain), the seam pixel is darker
  let gx = -1, gy = -1;
  outer: for (let y = 2; y < 250; y++) for (let x = 2; x < 250; x++) if (map.tiles[y][x] === '.' && !(map.heights?.[y]?.[x] > 0)) { gx = x; gy = y; break outer; }
  assert.ok(gx >= 0);
  const body = px(img, gx * 4 + 2, gy * 4 + 2), seam = px(img, gx * 4, gy * 4);
  assert.ok(near(body, hex(QUIET.ground), 12), `body ${body}`);
  assert.ok(seam[0] + seam[1] + seam[2] < body[0] + body[1] + body[2], 'the seam is darker than the tile');
  assert.ok(SEAM > 0 && SEAM < 0.6);
  // the creek: a water tile is blue (blue channel above red)
  const w = map.water[Math.floor(map.water.length / 2)];
  const wp = px(img, w[0] * 4 + 2, w[1] * 4 + 2);
  assert.ok(wp[2] > wp[0], `creek tile looks like water ${wp}`);
  // no pixel is brighter than a bright-grass green (the world stays quieter than the Toastinators)
  let bright = 0;
  for (let i = 0; i < img.data.length; i += 4 * 97) if (img.data[i + 1] > 215) bright++;
  assert.equal(bright, 0);
});

test('the minimap image is 256 x 256, one pixel per tile, water blue, wheat gold-ish, not the old dark board', () => {
  const m = buildMinimapImage(map);
  assert.equal(m.width, 256); assert.equal(m.height, 256);
  const w = map.water[1000];
  const p = px(m, w[0], w[1]);
  assert.ok(p[2] > p[0]);
  const c = map.crystals[0];
  const cp = px(m, c.x, c.y);
  assert.ok(cp[0] > cp[2], 'wheat is warm');
  const g = px(m, 10, 120);
  assert.ok(g[1] > 0x40, 'land is not near black');
});

function fakeCtx() {
  const ctx = { THREE, scene: new THREE.Scene(), tileSize: 1, camera: new THREE.PerspectiveCamera(),
    gridToWorld(x, y, h, out = new THREE.Vector3()) { return out.set(x + 0.5 - 128, h, y + 0.5 - 128); } };
  return ctx;
}
const frameOf = (crystals, rocks = map.rocks) => ({ tick: 1, next: { crystals, rocks, units: [], structures: [] }, prev: { crystals, rocks, units: [], structures: [] } });

test('the terrain system: one ground plane, boulders, wheat bundles, pads; cheap in draws; disposes clean', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  t.update(frameOf(map.crystals.map((c) => ({ ...c }))), 1 / 60);
  const ground = ctx.scene.getObjectByName('wheatfield-ground');
  assert.ok(ground && ground.isMesh);
  const bb = new THREE.Box3().setFromObject(ground);
  assert.ok(Math.abs(bb.min.x + 128) < 0.01 && Math.abs(bb.max.x - 128) < 0.01, 'the plane covers 256 tiles');
  assert.equal(t.heightAt(10, 10), 0);
  assert.ok(t.stats.boulders > 1000, `boulders ${t.stats.boulders}`);
  assert.ok(t.stats.wheat >= 176 * 5 - 5, `wheat blades ${t.stats.wheat}`);
  assert.ok(t.stats.draws <= 7, `draws ${t.stats.draws}`);
  // water tiles never become boulders even though the sim stores creek water as rock
  assert.ok(t.stats.boulders <= map.rocks.length - map.water.length + map.rubble.length + 5);
  t.dispose();
  assert.equal(ctx.scene.children.length, 0);
});

test('the ground is lit: a standard material with the picture as its map, roughness 0.9, and it takes shadows', () => {
  const ctx = fakeCtx();
  createWheatfieldTerrain(ctx, { map });
  const ground = ctx.scene.getObjectByName('wheatfield-ground');
  assert.ok(ground.material.isMeshStandardMaterial, 'not MeshBasicMaterial, which ignores the sun');
  assert.ok(ground.material.map?.image, 'the tile picture is the map');
  assert.equal(ground.material.roughness, 0.9);
  assert.equal(ground.receiveShadow, true);
});

test('every boulder gets a soft contact decal: one decal per boulder, in the shared decal set', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  t.update(frameOf(map.crystals.map((c) => ({ ...c }))), 1 / 60);
  const decals = ctx.scene.getObjectByName('toy-contact-shadows');
  assert.ok(decals, 'decal set exists');
  assert.equal(decals.count, t.stats.boulders);
  assert.equal(decals.material.depthWrite, false);
  t.dispose();
  assert.equal(ctx.scene.getObjectByName('toy-contact-shadows'), undefined, 'dispose removes the decals');
});

test('wheat shrinks as a field is mined and vanishes at zero', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  const full = map.crystals.map((c) => ({ ...c }));
  t.update(frameOf(full), 1 / 60);
  const visibleFull = t.stats.wheatShown;
  const mined = full.map((c, i) => (i < 20 ? { ...c, amount: 0 } : c));
  t.update(frameOf(mined), 1 / 60);
  assert.ok(t.stats.wheatShown < visibleFull, 'twenty emptied fields lose their bundles');
  t.dispose();
});

test('Quiet Battlefield contrast: wheat is the brightest warm tile, navy is darker than the shallow band, the seam is subtle', () => {
  const lum = (h) => ((h >> 16) & 255) * 0.3 + ((h >> 8) & 255) * 0.59 + (h & 255) * 0.11;
  assert.ok(lum(NAVY) < lum(BAND) - 15, 'shallow band is lighter than navy');
  assert.ok(lum(NAVY) < lum(QUIET.ground) - 20, 'water is darker than the ground');
  for (const ch of ['S', 'R']) {
    const w = tileColour(ch, {});
    assert.ok(((w >> 16) & 255) > (w & 255) + 40, 'wheat is warm');
    assert.ok(lum(w) > lum(QUIET.ground) + 25 && lum(w) > lum(QUIET.high), 'wheat is the brightest ground feature');
  }
  assert.ok(SEAM <= 0.07, 'seam is a faint pull toward the cliff colour');
});

// What the player sees at a world point: sample the ground texture through the plane's own transform and UVs.
function seenColourAtTile(ground, tex, tx, ty, ctx) {
  const p = ctx.gridToWorld(tx, ty, 0, new THREE.Vector3());
  ground.updateMatrixWorld(true);
  const local = ground.worldToLocal(p.clone());
  const pg = ground.geometry.parameters;
  const u = local.x / pg.width + 0.5, v = local.y / pg.height + 0.5;
  const width = tex.image.width, height = tex.image.height, data = tex.image.data;
  const col = Math.min(width - 1, Math.floor(u * width));
  const row = tex.flipY ? Math.floor((1 - v) * height) : Math.floor(v * height);
  const r = Math.min(height - 1, row) * width + col;
  return [data[r * 4], data[r * 4 + 1], data[r * 4 + 2]];
}

test('every base and starting worker stands on ground, and the terrain the player sees there is ground, not water', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  const ground = ctx.scene.getObjectByName('wheatfield-ground');
  const tex = ground.material.map;
  const spots = [...map.cores, ...map.workers.flat()].map((c) => (Array.isArray(c) ? c : [c.x, c.y]));
  assert.ok(spots.length >= 4);
  for (const [x, y] of spots) {
    assert.notEqual(map.tiles[y][x], '~', `tile ${x},${y} is water in the layout`);
    const c = seenColourAtTile(ground, tex, x, y, ctx);
    const want = hex(tileColour(map.tiles[y][x], { high: (map.heights?.[y]?.[x] ?? 0) > 0 }));
    assert.ok(near(c, want, 14), `terrain at base tile ${x},${y} is ${c}, the layout says ${want}`);
  }
  for (const [x, y] of [map.water[100], map.water[map.water.length - 100]]) {
    const c = seenColourAtTile(ground, tex, x, y, ctx);
    assert.ok(c[2] > c[0], `water tile ${x},${y} should look blue: ${c}`);
  }
  t.dispose();
});

test('wheat fields are big gold patches: a starter plot, the Lower Farm and the Golden Fields read as warm blocks', () => {
  const img = buildTileImage(map);
  const warm = (x, y) => { const p = px(img, x * 4 + 2, y * 4 + 2); return p[0] > p[2] + 40; };
  let tiles = 0, warmTiles = 0;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) if (map.tiles[y][x] === 'S' || map.tiles[y][x] === 'R') { tiles++; if (warm(x, y)) warmTiles++; }
  assert.ok(tiles >= 100, `field tiles ${tiles}`);
  assert.equal(warmTiles, tiles, 'every field tile is gold');
  // fields have body: at least 12 warm tiles in a 5 x 5 block somewhere
  let best = 0;
  for (let y = 0; y < 251; y += 1) for (let x = 0; x < 251; x += 1) {
    if (map.tiles[y][x] !== 'S' && map.tiles[y][x] !== 'R') continue;
    let n = 0; for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) if (warm(x + dx, y + dy)) n++;
    best = Math.max(best, n);
  }
  assert.ok(best >= 18, `densest 5x5 block has ${best} warm tiles`);
});

test('the windmill pads are small warm stones, not big cyan slabs beside the base', () => {
  const ctx = fakeCtx();
  createWheatfieldTerrain(ctx, { map });
  const pads = ctx.scene.getObjectByName('wheatfield-pads');
  pads.geometry.computeBoundingBox();
  const size = pads.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(size.x <= 0.6 && size.z <= 0.6 && size.y <= 0.06, `pad ${size.x} x ${size.y} x ${size.z}`);
  const c = new THREE.Color(pads.material.color.getHex());
  assert.ok(c.r >= c.b, 'warm or neutral, not blue-cyan');
});

// ---- Request #3: wheat tufts with relief ----
import { WHEAT_TUFT, buildWheatTuftGeometry } from '../play/wheatfield-terrain.mjs';

function wheatOf(m = map) {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map: m });
  t.update(frameOf(m.crystals.map((c) => ({ ...c }))), 1 / 60);
  return { ctx, t, mesh: ctx.scene.getObjectByName('wheatfield-wheat') };
}

test('wheat tufts: five blades per cluster, 2 to 3 clusters per tile, at most 1.5x the old 8 blades per tile', () => {
  const { t, mesh } = wheatOf();
  const tiles = map.crystals.length;
  assert.equal(WHEAT_TUFT.blades, 5);
  assert.ok(mesh.count >= tiles * 2 && mesh.count <= tiles * 3, 'clusters ' + mesh.count + ' for ' + tiles + ' tiles');
  assert.equal(t.stats.wheat, mesh.count * 5, 'stats.wheat counts blades');
  assert.ok(t.stats.wheat <= tiles * 8 * 1.5, 'blades ' + t.stats.wheat);
  assert.ok(mesh.count <= tiles * 8 * 1.5, 'instance count within 1.5x of the old count');
  t.dispose();
});

test('wheat is one lit, shadow-casting instanced mesh with an instance colour', () => {
  const { t, mesh } = wheatOf();
  assert.ok(mesh.isInstancedMesh && mesh.castShadow === true);
  assert.ok(mesh.material.isMeshStandardMaterial);
  assert.ok(mesh.instanceColor, 'instance colour set');
  t.dispose();
});

test('wheat output is deterministic between runs', () => {
  const a = wheatOf(), b = wheatOf();
  assert.deepEqual(Array.from(a.mesh.instanceMatrix.array.slice(0, a.mesh.count * 16)), Array.from(b.mesh.instanceMatrix.array.slice(0, b.mesh.count * 16)));
  assert.deepEqual(Array.from(a.mesh.instanceColor.array.slice(0, a.mesh.count * 3)), Array.from(b.mesh.instanceColor.array.slice(0, b.mesh.count * 3)));
  const g1 = buildWheatTuftGeometry(), g2 = buildWheatTuftGeometry();
  assert.deepEqual(Array.from(g1.attributes.position.array), Array.from(g2.attributes.position.array));
  a.t.dispose(); b.t.dispose();
});

test('blade heights vary between 0.45 and 0.9 tiles and every blade is tilted', () => {
  const hs = WHEAT_TUFT.heights;
  assert.equal(hs.length, 5);
  assert.ok(Math.min(...hs) >= 0.45 - 1e-9 && Math.max(...hs) <= 0.9 + 1e-9, String(hs));
  assert.ok(Math.max(...hs) - Math.min(...hs) > 0.2, 'heights actually vary');
  assert.ok(WHEAT_TUFT.tilts.every((t) => t > 0.02 && t < 0.5));
  const g = buildWheatTuftGeometry(); g.computeBoundingBox();
  assert.ok(g.boundingBox.max.y <= 0.9 + 1e-6 && g.boundingBox.max.y >= 0.8, 'tuft top ' + g.boundingBox.max.y);
  const { t, mesh } = wheatOf();
  const m = new THREE.Matrix4(), s = new THREE.Vector3();
  for (let i = 0; i < mesh.count; i += 7) { mesh.getMatrixAt(i, m); s.setFromMatrixScale(m); assert.ok(s.y <= 1.0001, 'full-grown scale ' + s.y); }
  t.dispose();
});

test('wheat tiles are painted as a darker, warmer plot floor with furrows (still warm)', () => {
  const img = buildTileImage(map);
  const c = map.crystals[0];
  const rows = [0, 1, 2, 3].map((py) => px(img, c.x * 4 + 2, c.y * 4 + py));
  const lum = (p) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
  const gold = hex(tileColour('S', {}));
  assert.ok(lum(rows[1]) < lum(gold) - 15, 'plot floor is darker than the flat gold');
  assert.ok(rows[1][0] > rows[1][2] + 40, 'still warm');
  assert.ok(new Set(rows.map((r) => r.join())).size >= 3, 'furrow rows differ');
});

test('water reads as water: shore rim differs from deep middle, spring pops, ripples are deterministic and add one mesh', () => {
  const img = buildTileImage(map);
  const isW = (x, y) => map.tiles[y]?.[x] === '~' || map.tiles[y]?.[x] === 'U';
  const isLand = (x, y) => map.tiles[y]?.[x] !== undefined && !isW(x, y);
  let shore = null, deep = null;
  for (const [x, y] of map.water) {
    if (x < 1 || y < 1 || x > 254 || y > 254) continue;
    // a shore tile with land only on its west side, so the scale-4 centre pixel (2, 2) is inside the navy, not the rim
    if (!shore && map.tiles[y][x] === '~' && isLand(x - 1, y) && isW(x + 1, y) && !isLand(x, y - 1) && !isLand(x, y + 1)) shore = [x, y];
    if (!deep && map.tiles[y][x] === '~' && [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => isW(x + dx, y + dy))) deep = [x, y];
  }
  assert.ok(shore && deep);
  const rim = px(img, shore[0] * 4, shore[1] * 4 + 2), mid = px(img, shore[0] * 4 + 2, shore[1] * 4 + 2), dp = px(img, deep[0] * 4 + 2, deep[1] * 4 + 2);
  assert.deepEqual(rim, hex(SHORE));
  const sum = (c) => c[0] + c[1] + c[2];
  assert.ok(sum(rim) > sum(mid) + 30 && sum(mid) > sum(dp), `three values ${rim} ${mid} ${dp}`);
  const sat = (h) => { const c = hex(h), mx = Math.max(...c), mn = Math.min(...c); return (mx - mn) / mx; };
  assert.equal(SPRING, 0x2d6f8c, 'spring is a moderately dark cool blue');
  assert.ok(sat(SPRING) < sat(QUIET.cyan) && sum(hex(SPRING)) < sum(hex(0x367D8A)) && sum(hex(SPRING)) > sum(hex(NAVY)), 'spring sits between navy and the bible shallow, less saturated than team cyan');
  assert.ok(sum(hex(SPRING)) < sum(hex(QUIET.cyan)) * 0.7, 'spring is far darker than team cyan');
  const a = rippleSpots(map), b = rippleSpots(generateMap(7, { map: 'wheatfield' }));
  assert.equal(a.length, b.length); assert.deepEqual(a.slice(0, 50), b.slice(0, 50));
  assert.ok(a.length >= 3 * map.water.length, 'at least 3 dashes per water tile');
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  t.update(frameOf(map.crystals.map((c) => ({ ...c }))), 1 / 60);
  const g = ctx.scene.getObjectByName('wheatfield-glints');
  assert.ok(g && g.isInstancedMesh && !g.castShadow);
  assert.equal(g.parent.children.filter((c) => c.name === 'wheatfield-glints').length, 1);
  assert.ok(t.stats.glints > 0 && t.stats.glints <= GLINT_BUDGET);
  assert.ok(t.stats.draws <= 7);
  t.dispose();
});

test('water tiles get a navy centre at play zoom: spring ring and shore rim are 2 px or wider, the middle is darkest', () => {
  // a 4 x 3 patch: a creek tile with land west, north and south, and a spring with land all round; scale 16 = play-zoomed detail
  const small = { width: 4, height: 3, tiles: ['....', '.~U.', '....'] };
  const img = buildTileImage(small, 16);
  const sum = (c) => c[0] + c[1] + c[2];
  const creekCentre = px(img, 16 + 8, 16 + 8), creekRim = px(img, 16, 16 + 8);
  assert.ok(near(creekCentre, hex(NAVY), 24), `shore centre sits near navy ${creekCentre}`);
  assert.ok(sum(creekCentre) < sum(creekRim), 'shore centre is darker than its rim');
  assert.deepEqual(px(img, 16, 16 + 8), hex(SHORE));
  assert.deepEqual(px(img, 16 + 1, 16 + 8), hex(SHORE), 'the shore rim is at least 2 px wide');
  const springCentre = px(img, 32 + 8, 16 + 8), springRing = px(img, 32, 16 + 8);
  assert.deepEqual(springRing, hex(SHORE).map((v, i) => Math.round(v + (hex(SPRING)[i] - v) * 0.25)), 'spring footprint has a light bank');
  const deepest = hex(SPRING).map((v, i) => Math.round(v + (hex(NAVY)[i] - v) * 0.7));
  assert.ok(springCentre.every((v, i) => v < hex(SPRING)[i] && v >= deepest[i]), `spring centre is dark navy-blue ${springCentre}`);
  assert.ok(sum(springCentre) < sum(springRing), 'centre darker than bank');
});

test('each spring tile has 2 or 3 short glint dashes inside the pool, flagged for a dimmer colour', () => {
  const spots = rippleSpots(map);
  map.tiles.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== 'U') return;
    const mine = spots.filter((s) => s.x === x && s.y === y);
    assert.ok(mine.length >= 2 && mine.length <= 3);
    mine.forEach((s) => assert.ok(Math.abs(s.dx) <= 0.3 && Math.abs(s.dy) <= 0.3 && s.len <= 0.16 && s.spring === true));
  }));
});

test('springs are real boxes: a blue frame and a darker navy inset per U tile, nothing else on the tile, at most +1 draw', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  t.update(frameOf(map.crystals.map((c) => ({ ...c }))), 1 / 60);
  const sp = ctx.scene.getObjectByName('wheatfield-springs');
  const us = []; map.tiles.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'U') us.push([x, y]); }));
  assert.ok(us.length > 0 && sp && sp.isInstancedMesh && !sp.castShadow && !sp.receiveShadow);
  assert.equal(sp.count, us.length * 2);
  assert.ok(sp.material.isMeshLambertMaterial, 'matte');
  const lum = (c) => c.r * 0.3 + c.g * 0.6 + c.b * 0.1;
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
  us.forEach(([x, y], i) => {
    const p = ctx.gridToWorld(x, y, 0);
    sp.getMatrixAt(i * 2, m); m.decompose(pos, q, sc); const frame = { top: pos.y + sc.y / 2, w: sc.x }; sp.getColorAt(i * 2, col); const fl = lum(col);
    sp.getMatrixAt(i * 2 + 1, m); m.decompose(pos, q, sc); const inset = { top: pos.y + sc.y / 2, w: sc.x }; sp.getColorAt(i * 2 + 1, col); const il = lum(col);
    assert.ok(frame.top <= 0.02 && inset.top <= 0.02 && inset.top > frame.top, 'flush with the ground');
    assert.ok(frame.w <= 1 && frame.w > inset.w && (frame.w - inset.w) / 2 <= 0.08 + 1e-9, 'the lip is at most 0.08 tile wide');
    assert.ok(il < fl, 'the pool is darker than the lip');
    assert.ok(Math.abs(pos.x - p.x) < 1e-6 && Math.abs(pos.z - p.z) < 1e-6);
    // no other instanced mesh sits on the tile (glints only follow the camera focus, so they are left out)
    ctx.scene.traverse((o) => {
      if (!o.isInstancedMesh || o === sp || o.name === 'wheatfield-glints') return;
      o.geometry.computeBoundingBox();
      for (let k = 0; k < o.count; k++) {
        o.getMatrixAt(k, m);
        const b = o.geometry.boundingBox.clone().applyMatrix4(m);
        assert.ok(!(b.min.x < p.x + 0.5 && b.max.x > p.x - 0.5 && b.min.z < p.z + 0.5 && b.max.z > p.z - 0.5), `${o.name} covers spring ${x},${y}`);
      }
    });
  });
  const noU = { ...map, tiles: map.tiles.map((r) => (typeof r === 'string' ? [...r] : r).map((c) => (c === 'U' ? '.' : c))) };
  const base = createWheatfieldTerrain(fakeCtx(), { map: noU });
  base.update(frameOf(map.crystals.map((c) => ({ ...c }))), 1 / 60);
  assert.ok(t.stats.draws - base.stats.draws <= 1 && t.stats.draws <= 6); // 6 props; the pool lives in the ground shader
  t.dispose(); base.dispose();
});

test('toy ground keeps white material color and exposes its shader gain', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  try {
    const material = ctx.scene.getObjectByName('wheatfield-ground').material;
    assert.ok(material.isMeshStandardMaterial);
    assert.equal(material.color.getHex(), 0xffffff);
    assert.equal(material.userData.groundGain.value, LIT_GROUND_GAIN);
  } finally {
    t.dispose();
  }
});

test('light pool is baked into the toy ground shader: no pool mesh, uPoolCentre uniform, no extra draw', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  t.update(frameOf(map.crystals.map((c) => ({ ...c }))), 1 / 60);
  assert.equal(ctx.scene.getObjectByName('wheatfield-light-pool'), undefined, 'no pool mesh');
  const ground = ctx.scene.getObjectByName('wheatfield-ground');
  if (!ground.material.isMeshStandardMaterial) { t.dispose(); return; } // ?toy=0 path stays unlit
  assert.equal(typeof ground.material.onBeforeCompile, 'function');
  const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>' };
  ground.material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.uPoolCentre, 'uPoolCentre uniform');
  assert.ok(/uniform vec2 uPoolCentre/.test(shader.fragmentShader));
  assert.ok(/smoothstep\(5\.0, 13\.0/.test(shader.fragmentShader));
  assert.ok(shader.fragmentShader.indexOf('map_fragment') < shader.fragmentShader.indexOf('diffuseColor.rgb *='), 'tint after map_fragment');
  t.dispose();
});

test('the light pool centre follows the camera target only once it has moved more than 2 tiles', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  const frame = frameOf(map.crystals.map((c) => ({ ...c })));
  const ground = ctx.scene.getObjectByName('wheatfield-ground');
  const centre = ground.material.userData.poolCentre.value;
  const look = (x, z) => { ctx.camera.position.set(x, 20, z + 20); ctx.camera.lookAt(x, 0, z); ctx.camera.updateMatrixWorld(true); };
  look(0, 0); t.update(frame, 1 / 60);
  const x0 = centre.x;
  look(1, 0); t.update(frame, 1 / 60);
  assert.equal(centre.x, x0, 'a 1 tile move leaves it');
  look(6, 0); t.update(frame, 1 / 60);
  assert.ok(Math.abs(centre.x - x0) > 4, 'a 6 tile move re-centres it');
});

test('the ground around a spring is one dark cool blue pond: no tan, wheat or ivory colour touches the spring', () => {
  const sc = 4, img = buildTileImage(map, sc);
  const tan = (c) => c[0] > c[2] + 8 || c[0] > 0x90;                    // warm (red above blue) or bright: tan, cream, wheat
  let seen = 0;
  map.tiles.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== 'U') return;
    for (let ty = y - 1; ty <= y + 1; ty++) for (let tx = x - 1; tx <= x + 1; tx++) for (let py = 0; py < sc; py++) for (let pxl = 0; pxl < sc; pxl++) {
      const p = px(img, tx * sc + pxl, ty * sc + py); seen++;
      assert.ok(!tan(p), `tile ${tx},${ty} pixel ${pxl},${py} is not tan: ${p}`);
      assert.ok(p[2] > p[0] + 20 && p[0] + p[1] + p[2] <= 469, `tile ${tx},${ty} is dark and blue: ${p}`);
    }
  }));
  assert.ok(seen > 0);
});

// The pond on screen is not a spring: a 3 x 4 creek pool sunk into a high plateau (seed 7, tiles 243-245 x 14-17). Probes #27-#69 saw
// its ivory high-ground rim as a tan band and its SHORE rim as a pale cyan ring.
const POND = { x0: 243, x1: 245, y0: 14, y1: 17 };
const inPond = (x, y) => x >= POND.x0 && x <= POND.x1 && y >= POND.y0 && y <= POND.y1;

test('the sunken pond (a small pool ringed by high ground) is one dark cool blue shape: light cool bank, no ivory wall or tan', () => {
  assert.ok([...map.tiles[POND.y0]].slice(POND.x0, POND.x1 + 1).every((c) => c === '~'), 'the pond tiles are where the probe put them');
  const sc = 4, img = buildTileImage(map, sc);
  const tan = (c) => c[0] > c[1] + 15 && c[0] > 140;
  for (let ty = POND.y0 - 2; ty <= POND.y1 + 2; ty++) for (let tx = POND.x0 - 2; tx <= POND.x1 + 2; tx++) for (let py = 0; py < sc; py++) for (let pxl = 0; pxl < sc; pxl++) {
    const p = px(img, tx * sc + pxl, ty * sc + py);
    assert.ok(!tan(p), `tile ${tx},${ty} pixel ${pxl},${py} is not tan: ${p}`);
    if (inPond(tx, ty)) assert.ok(p[2] > p[0] + 20 && p[0] + p[1] + p[2] <= 469, `pond tile ${tx},${ty} pixel ${pxl},${py} is dark cool blue, not a pale ring: ${p}`);
    else assert.ok(Math.max(...p) <= 0x96, `ground tile ${tx},${ty} pixel ${pxl},${py} has no ivory wall: ${p}`);
  }
});

test('the pond shows at most 3 glint dashes in all, however many water tiles it has', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  const c = ctx.gridToWorld(244, 15.5, 0);
  ctx.camera.position.set(c.x, 20, c.z + 20); ctx.camera.lookAt(c.x, 0, c.z); ctx.camera.updateMatrixWorld(true);
  t.update(frameOf(map.crystals.map((o) => ({ ...o }))), 1 / 60);
  const g = ctx.scene.getObjectByName('wheatfield-glints');
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < g.count; i++) {
    g.getMatrixAt(i, m); m.decompose(pos, q, s);
    if (inPond(Math.round(pos.x + 128 - 0.5), Math.round(pos.z + 128 - 0.5))) n++;
  }
  assert.ok(n >= 1 && n <= 3, `${n} dashes on the pond`);
  t.dispose();
});

test('each spring has a flush ring in a dark cool blue, never a pale fill', () => {
  const ctx = fakeCtx();
  const t = createWheatfieldTerrain(ctx, { map });
  const sp = ctx.scene.getObjectByName('wheatfield-springs'), col = new THREE.Color();
  for (let i = 0; i < sp.count; i += 2) {
    sp.getColorAt(i, col);
    const [r, g, b] = [col.r, col.g, col.b].map((v) => Math.round(v * 255));
    assert.ok(b > r + 20 && r + g + b < 3 * 0x8c, `ring ${r},${g},${b} is dark and blue`);
  }
  t.dispose();
});

test('pond water is painted as one shape: no per-tile seam, light bank and up to 70 % navy centre', () => {
  const sc = 8, img = buildTileImage(map, sc);
  const lo = hex(SPRING), hi = hex(NAVY), bank = hex(SHORE).map((v, i) => Math.round(v + (lo[i] - v) * 0.25));
  const lum = (c) => c[0] + c[1] + c[2];
  const at = (tx, ty, fx, fy) => px(img, Math.round(tx * sc + fx * sc), Math.round(ty * sc + fy * sc));
  // Every pond pixel stays within the cool bank-to-deep palette.
  for (let ty = POND.y0; ty <= POND.y1; ty++) for (let tx = POND.x0; tx <= POND.x1; tx++) for (let py = 0; py < sc; py++) for (let pxl = 0; pxl < sc; pxl++) {
    const p = px(img, tx * sc + pxl, ty * sc + py);
    for (let k = 0; k < 3; k++) {
      const a = bank[k], b = lo[k] + (hi[k] - lo[k]) * 0.7;
      assert.ok(p[k] >= Math.min(a, b) - 2 && p[k] <= Math.max(a, b) + 2, `pond pixel ${tx},${ty} ${pxl},${py} channel ${k} in range: ${p}`);
    }
  }
  // the seam between two interior tiles (column 244, rows 15|16) matches the tile centres: no grid
  const centreA = at(244, 15, 0.5, 0.5), centreB = at(244, 16, 0.5, 0.5);
  for (const [a, b] of [[at(244, 15, 0.5, 0.99), at(244, 16, 0.5, 0)], [at(243, 15, 0.99, 0.5), at(244, 15, 0, 0.5)]]) {
    assert.ok(near(a, b, 3), `across the seam: ${a} vs ${b}`);
    assert.ok(Math.abs(lum(a) - lum(centreA)) <= 14 && Math.abs(lum(b) - lum(centreB)) <= 14, `seam ${a} close to centres ${centreA}, ${centreB}`);
  }
  // rim is lighter (more SPRING) than the middle
  assert.ok(lum(at(244, 14, 0.5, 0.05)) > lum(centreA), 'rim lighter than the middle');
});


test('a 2x2 pond has a light bank at least 25 luminance above its dark centre', () => {
  const small = { width: 4, height: 4, tiles: ['....', '.~~.', '.~~.', '....'], heights: Array.from({ length: 4 }, () => [1, 1, 1, 1]) };
  const img = buildTileImage(small, 8);
  const lum = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  const bank = px(img, 8, 15), centre = px(img, 15, 15);
  assert.ok(lum(bank) - lum(centre) >= 25, `bank ${bank}, centre ${centre}`);
  assert.ok(lum(centre) < lum(hex(SPRING)), 'centre darker than SPRING');
});
