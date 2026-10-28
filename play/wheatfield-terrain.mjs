// Wheatfield Valley on the play page (owner: sonnet, Playable Client). The 256 x 256 map as a square-grid toy landscape
// in the Quiet Battlefield palette (STYLE-BIBLE section 8; the look of play/style-lab/grid-terrain-kit.mjs): one ground
// plane textured from the map's tile letters with thin seams between the tiles, five-sided boulders on the rock lines,
// wheat bundles on the wheat fields (they shrink as Crumbs haul the wheat), flat windmill pads on the generator sockets.
// The world is quieter than the Toastinators: muted blue-grey ground, water cool and dark, no bright grass anywhere.
//
//   QUIET                     the palette (hex numbers), TERRAIN_PALETTE of the style lab
//   tileColour(ch, {deep, high})  hex for a tile letter of maps/layout-wheatfield.mjs
//   buildTileImage(map, scale)    { width, height, data } RGBA for the ground texture (scale px per tile, default 4)
//   buildMinimapImage(map)        the same land at one pixel per tile, for the minimap
//   createWheatfieldTerrain(ctx, { map }) -> { update(frame), dispose(), heightAt(), stats }  (viewer3d system shape)
// Pure parts run in node; the system needs three.js but no renderer (tests/wheatfield-terrain.test.mjs).
import * as THREE from 'three';
import { TERRAIN_PALETTE } from './style-lab/terrain-kit.mjs';
import { createContactShadows, toyLookOn } from './toy-render.mjs';

// Run with node --test play/wheatfield-terrain.mjs; inert when imported by the client.
if (typeof process !== 'undefined' && process.argv[1] &&
    import.meta.url === new URL(process.argv[1], 'file://').href) {
  const { default: test } = await import('node:test');
  const { default: assert } = await import('node:assert/strict');
  test('toy ground pool tints keep blue at least 1.25 times red and above green', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL(import.meta.url), 'utf8');
    for (const name of ['poolWarm', 'poolCool']) {
      const declaration = source.match(new RegExp(`vec3 ${name} = ([^;]+);`));
      assert.ok(declaration, `${name} shader declaration exists`);
      const vectors = [...declaration[1].matchAll(/vec3\(([\d.]+), ([\d.]+), ([\d.]+)\)/g)];
      assert.ok(vectors.length, `${name} has an RGB tint`);
      for (const [, r, g, b] of vectors) {
        assert.ok(+b >= 1.25 * +r && +b >= +g, `${name}: blue ${b} must be >= 1.25 times red ${r} and >= green ${g}`);
      }
    }
  });
}

// The gain now lives in the ground shader, in linear light under bright key and hemisphere lights,
// so it has to be low to land near the style bible's mid-dark #52696B on screen.
// Estimate, not a browser reading; tune the gain here.
export const LIT_GROUND_GAIN = 0.35;

export const QUIET = TERRAIN_PALETTE;
export const SEAM = 0.07; // how far a seam pixel is pulled toward the cliff colour: a quiet 1 px line, not a board
export const NAVY = 0x1b3b57; // deep water: darker than the style-bible deep, so the creek reads as a cut in the ground
export const BAND = 0x4d97a6; // shallow band: clearly lighter than the navy, still cool
export const SHORE = 0x7cc4cf; // the lit shallow rim where water meets land: the lightest water value, still cooler than team cyan
export const SPRING = 0x2d6f8c; // the well spring: moderately dark cool blue, between navy and the bible shallow, darker and bluer than team cyan
export const GLINT_SPRING = 0x5f9fb8; // dim, inside the water: dimmer ripple dashes on spring pools
export const HIGH_RIM = 0xf2e7c9; // warm ivory: the lit rim on a high tile's edge where it meets low ground (SYSTEMS-DESIGN.md section 3)
export const GLINT = 0xcff6ff; // pale-cyan ripple dashes on the water
export const GLINT_BUDGET = 900; // dashes alive at once (2 triangles each): the whole ripple set stays under +2,000 triangles
const FOG = 0x26353f;
export const GOLD = 0xe8b84a; // field gold: the brightest warm thing on the map

const rgb = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hash = (x, y) => { let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const PLOT = 0x5a4522; // the dark warm earth a wheat plot is tilled in
const isWater = (ch) => ch === '~';

/** Hex colour of one tile letter. deep: a water tile with water on all four sides; high: raised ground. */
export function tileColour(ch, { deep = false, high = false } = {}) {
  switch (ch) {
    case '~': return deep ? NAVY : BAND;
    case 'U': return SPRING;                              // a spring: the Well goes here
    case 'B': case '=': case '|': return QUIET.ramp;              // bridges and ramps share the pale stone value
    case 'f': return rgbToHex(mix(rgb(QUIET.shallow), rgb(QUIET.ramp), 0.5));   // a ford: shallows over stone
    case 'G': return QUIET.socket;                                // a windmill pad
    case 'L': return QUIET.meadow;
    case 'S': return rgbToHex(mix(rgb(QUIET.ground), rgb(GOLD), 0.9));   // a wheat field: the brightest warm thing on the map
    case 'R': return rgbToHex(mix(rgb(QUIET.ground), rgb(GOLD), 1));  // golden wheat
    case '#': return QUIET.cliff;
    default: return high ? QUIET.high : QUIET.ground;
  }
}
const rgbToHex = ([r, g, b]) => (r << 16) | (g << 8) | b;

// Raised ground at a tile; off the map is low ground.
const highTile = (map, x, y) => (map.heights?.[y]?.[x] ?? 0) > 0;

function tileInfo(map, x, y) {
  const ch = map.tiles[y][x];
  const w = (xx, yy) => xx >= 0 && yy >= 0 && xx < map.width && yy < map.height && isWater(map.tiles[yy][xx]);
  return { ch, deep: isWater(ch) && w(x - 1, y) && w(x + 1, y) && w(x, y - 1) && w(x, y + 1), high: (map.heights?.[y]?.[x] ?? 0) > 0 };
}

function landSides(map, x, y) {
  const land = (xx, yy) => xx >= 0 && yy >= 0 && xx < map.width && yy < map.height && !isWater(map.tiles[yy][xx]) && map.tiles[yy][xx] !== 'U';
  return { n: land(x, y - 1), s: land(x, y + 1), w: land(x - 1, y), e: land(x + 1, y) };
}

/** Ripple dashes: 3 to 5 per water tile, pure functions of the tile (so a seed always gives the same set). */
export function rippleSpots(map) {
  const out = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    const ch = map.tiles[y][x];
    if (!isWater(ch) && ch !== 'U') continue;
    if (ch === 'U') {                                       // a spring pool: 2 or 3 short dashes over the navy
      const n = 2 + Math.floor(hash(x + 2, y + 6) * 2);
      for (let k = 0; k < n; k++) out.push({ x, y, dx: (hash(x * 7 + k, y) - 0.5) * 0.5, dy: (hash(x, y * 7 + k + 3) - 0.5) * 0.5, len: 0.1 + hash(x + k, y + 9) * 0.06, spring: true });
      continue;
    }
    const n = 3 + Math.floor(hash(x + 5, y + 11) * 3);
    for (let k = 0; k < n; k++) out.push({ x, y, dx: (hash(x * 7 + k, y) - 0.5) * 0.8, dy: (hash(x, y * 7 + k + 3) - 0.5) * 0.8, len: 0.22 + hash(x + k, y + 9) * 0.2 });
  }
  return out;
}

const POND_MAX = 24; // a water pool this small (or smaller) whose land neighbours are all raised ground is a pond, not the creek
const pondCache = new WeakMap();
/** Set of y * width + x keys of the pond water tiles: small '~' pools ringed by high ground (no ivory wall, no pale rim, 3 dashes in all). */
export function pondTiles(map) {
  let set = pondCache.get(map);
  if (set) return set;
  set = new Set();
  set.anchors = new Set();
  const seen = new Set();
  const inMap = (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  for (let y0 = 0; y0 < map.height; y0++) for (let x0 = 0; x0 < map.width; x0++) {
    if (!isWater(map.tiles[y0][x0]) || seen.has(y0 * map.width + x0)) continue;
    const comp = [], stack = [[x0, y0]];
    seen.add(y0 * map.width + x0);
    let ringed = true;
    while (stack.length) {
      const [x, y] = stack.pop();
      comp.push([x, y]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inMap(nx, ny)) continue;
        const k = ny * map.width + nx;
        if (isWater(map.tiles[ny][nx])) { if (!seen.has(k)) { seen.add(k); stack.push([nx, ny]); } }
        else if (!highTile(map, nx, ny)) ringed = false;   // low ground, a ford or a bridge touches it: part of the creek
      }
    }
    if (ringed && comp.length <= POND_MAX) {
      comp.forEach(([x, y]) => set.add(y * map.width + x));
      const keys = comp.map(([x, y]) => y * map.width + x).sort((a, b) => a - b);
      set.anchors.add(keys[keys.length >> 1]);          // the one tile of the pond that keeps its ripple dashes
    }
  }
  pondCache.set(map, set);
  return set;
}

/** The spring itself and its 8 neighbours: the pond footprint. */
const nearSpring = (map, x, y) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.tiles[y + dy]?.[x + dx] === 'U') return true;
  return false;
};

const isWheat = (ch) => ch === 'S' || ch === 'R';
function nearWheat(map, x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const row = map.tiles[y + dy];
    if (row && isWheat(row[x + dx])) return true;
  }
  return false;
}

/** RGBA pixels for the ground texture: `scale` x `scale` pixels per tile, a faint grain, a seam on each tile's top and left. */
export function buildTileImage(map, scale = 4) {
  const width = map.width * scale, height = map.height * scale;
  const data = new Uint8Array(width * height * 4);
  const cliff = rgb(QUIET.cliff);
  const ponds = pondTiles(map);
  const inFoot = (x, y) => { const c = map.tiles[y]?.[x]; return c === 'U' || ponds.has(y * map.width + x) || (c !== undefined && !isWater(c) && nearSpring(map, x, y)); };
  const POND_DEPTH = 2;   // tiles from the pond's outer edge at which the water reaches its deepest colour (35 % navy)
  // distance in tiles from a point (tile units) to the nearest non-pond tile: one shape across the whole footprint, no per-tile gradient
  const edgeDist = (fx, fy) => {
    let best = POND_DEPTH;
    const cx = Math.floor(fx), cy = Math.floor(fy);
    for (let y = cy - POND_DEPTH; y <= cy + POND_DEPTH; y++) for (let x = cx - POND_DEPTH; x <= cx + POND_DEPTH; x++) {
      if (inFoot(x, y)) continue;
      const dx = Math.max(x - fx, 0, fx - (x + 1)), dy = Math.max(y - fy, 0, fy - (y + 1));
      best = Math.min(best, Math.hypot(dx, dy));
    }
    return best;
  };
  const springC = rgb(SPRING), navyC = rgb(NAVY);
  for (let ty = 0; ty < map.height; ty++) for (let tx = 0; tx < map.width; tx++) {
    const { ch, deep, high } = tileInfo(map, tx, ty);
    let base = rgb(tileColour(ch, { deep, high }));
    if (ch === '.' && nearWheat(map, tx, ty)) base = mix(base, rgb(QUIET.wheat), 0.3); // a golden verge: fields read as big patches
    const pond = ch !== 'U' && !isWater(ch) && nearSpring(map, tx, ty); // a spring's neighbour: pond water, never tan, wheat or ivory rim
    if (pond) base = mix(rgb(SPRING), rgb(NAVY), 0.35);
    const grain = (hash(tx, ty) - 0.5) * 0.04;                  // ±2 %: tiles read as tiles without noise
    const plot = isWheat(ch);                                    // wheat tiles: tilled plot floor, darker and warmer than the flat gold
    if (plot) base = mix(base, rgb(PLOT), 0.45);
    const body = base.map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + grain)))));
    const water = isWater(ch) || ch === 'U';
    const land = water ? landSides(map, tx, ty) : null;          // which sides of a water tile touch land
    const shore = water && (land.n || land.s || land.w || land.e);
    const inner = ch === 'U' ? mix(rgb(NAVY), rgb(SPRING), 0.2) : shore ? mix(rgb(NAVY), rgb(BAND), 0.15) : body; // a spring's and a shore tile's middle sinks to navy
    const seam = mix(body, cliff, SEAM), furrow = body.map((v) => Math.round(v * 0.8));
    // high ground: a lighter rim on each side that faces low ground (or the map edge); high-to-high edges stay plain
    const lowSide = (xx, yy) => !highTile(map, xx, yy) && !nearSpring(map, xx, yy) && !ponds.has(yy * map.width + xx); // no ivory rim toward a spring pond or a sunken pool
    const rimOn = high && !pond && scale >= 3 ? { n: lowSide(tx, ty - 1), s: lowSide(tx, ty + 1), w: lowSide(tx - 1, ty), e: lowSide(tx + 1, ty) } : null;
    const rimC = rimOn ? mix(body, rgb(HIGH_RIM), 0.45) : null;
    const rw = Math.max(2, Math.round(scale * 0.18));
    for (let py = 0; py < scale; py++) for (let pxl = 0; pxl < scale; pxl++) {
      if (scale >= 3 && inFoot(tx, ty)) {                       // one pond shape: light bank, shallow band, then a navy centre
        const depth = edgeDist(tx + (pxl + 0.5) / scale, ty + (py + 0.5) / scale);
        const wc = depth < 0.22 ? mix(rgb(SHORE), springC, 0.25)
          : depth < 0.5 ? mix(springC, rgb(BAND), (depth - 0.22) / 0.28)
          : mix(springC, navyC, Math.max(0.45, 0.7 * depth / POND_DEPTH));
        const wi = ((ty * scale + py) * width + tx * scale + pxl) * 4;
        data[wi] = wc[0]; data[wi + 1] = wc[1]; data[wi + 2] = wc[2]; data[wi + 3] = 255;
        continue;
      }
      if (water && scale >= 3) {                              // water: no grid seams; a light rim on land-facing sides, a deeper middle
        const rw = Math.max(2, Math.round(scale * 0.18));       // shore rim: at least 2 px, on land-facing sides only
        const edge = Math.min(pxl, py, scale - 1 - pxl, scale - 1 - py);
        const rim = (land.n && py < rw) || (land.s && py >= scale - rw) || (land.w && pxl < rw) || (land.e && pxl >= scale - rw);
        const wc = ch === 'U' || ponds.has(ty * map.width + tx) ? mix(rgb(SPRING), rgb(NAVY), edge / ((scale - 1) / 2)) : rim ? rgb(SHORE) : inner; // a spring: SPRING at the edge, deep navy in the middle
        const wi = ((ty * scale + py) * width + tx * scale + pxl) * 4;
        data[wi] = wc[0]; data[wi + 1] = wc[1]; data[wi + 2] = wc[2]; data[wi + 3] = 255;
        continue;
      }
      const rimPx = rimOn && ((rimOn.n && py < rw) || (rimOn.s && py >= scale - rw) || (rimOn.w && pxl < rw) || (rimOn.e && pxl >= scale - rw));
      const c = rimPx ? rimC : scale >= 3 && (py === 0 || pxl === 0) ? seam : plot && scale >= 3 && py === scale - 1 ? furrow : body; // no seams on the 1 px minimap
      const i = ((ty * scale + py) * width + tx * scale + pxl) * 4;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

/** The land at one pixel per tile (no seams), with the wheat fields marked. */
export function buildMinimapImage(map) {
  const img = buildTileImage(map, 1);
  const set = (x, y, hexv) => { const i = (y * img.width + x) * 4; [img.data[i], img.data[i + 1], img.data[i + 2]] = rgb(hexv); };
  for (const c of map.crystals ?? []) set(c.x, c.y, c.rich ? 0xe0b84a : QUIET.wheat);
  for (const [x, y] of map.sockets ?? []) set(x, y, 0x8ec1d4);
  return img;
}

// ------------------------------------------------------------------------------------------------------------------
// The system
// ------------------------------------------------------------------------------------------------------------------

// One wheat cluster: five tapered, tilted blades of different heights (0.45 to 0.9 tiles) merged into one geometry, dark gold at the
// base and light gold at the tip (vertex colours); the instance colour nudges each cluster a little. Pure numbers, so it is deterministic.
export const WHEAT_TUFT = {
  blades: 5,
  heights: [0.9, 0.72, 0.62, 0.78, 0.48],
  tilts: [0.06, 0.2, 0.26, 0.22, 0.3],         // radians off vertical
  angles: [0, 1.3, 2.6, 3.9, 5.2],             // which way each leans
  base: 0xa8863f, tip: 0xdcbb70,               // two golds close to the wheat #C9A65E
};
export function buildWheatTuftGeometry() {
  const parts = [], base = new THREE.Color(WHEAT_TUFT.base), tip = new THREE.Color(WHEAT_TUFT.tip);
  for (let k = 0; k < WHEAT_TUFT.blades; k++) {
    const h = WHEAT_TUFT.heights[k], g = new THREE.ConeGeometry(0.055, h, 4, 1, true).toNonIndexed();
    g.translate(0, h / 2, 0);
    g.rotateZ(WHEAT_TUFT.tilts[k]); g.rotateY(WHEAT_TUFT.angles[k]);
    const r = 0.1 + 0.08 * Math.sin(k * 2.1), a = WHEAT_TUFT.angles[k] + 0.7;
    g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { c.copy(base).lerp(tip, Math.min(1, pos.getY(i) / h)); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const out = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const clustersOf = (c) => 2 + (hash(c.x + 31, c.y + 17) < 0.25 ? 1 : 0); // 2 or 3 per tile, about 2.25 on average

export function createWheatfieldTerrain(ctx, { map }) {
  const root = new THREE.Group(); root.name = 'wheatfield';
  ctx.scene.add(root);
  const W = map.width, H = map.height, ts = ctx.tileSize ?? 1;
  const toWorld = (x, y, h = 0) => ctx.gridToWorld(x, y, h, new THREE.Vector3());
  const disposables = [];
  const own = (o) => { disposables.push(o); return o; };
  const prevBackground = ctx.scene.background, prevFog = ctx.scene.fog;
  ctx.scene.background = new THREE.Color(FOG);   // beyond the map edge: the quiet fog colour, not GHT's purple dusk
  ctx.scene.fog = null;
  // Shared with the unit renderer (play/toaster-units.mjs draws the up-arrow on units standing high): highAt(x, y) in tiles.
  const highAt = (x, y) => highTile(map, Math.round(x), Math.round(y));
  ctx.highAt = highAt;

  // Ground: one plane, one texture (1024 x 1024), nearest when zoomed in, mipmapped when zoomed out.
  // The plane lies flat with texture row 0 at its south edge (v = 0), but tile row 0 is the north edge: flip the rows.
  const img = buildTileImage(map, 4);
  const rowBytes = img.width * 4, flipped = new Uint8Array(img.data.length);
  for (let r = 0; r < img.height; r++) flipped.set(img.data.subarray(r * rowBytes, (r + 1) * rowBytes), (img.height - 1 - r) * rowBytes);
  const tex = own(new THREE.DataTexture(flipped, img.width, img.height, THREE.RGBAFormat));
  tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = 8; tex.flipY = false; tex.needsUpdate = true;
  // Lit, so the sun's shadows from buildings and rocks land on it (MeshBasicMaterial ignored them). ?toy=0 keeps the unlit ground.
  const toy = toyLookOn();
  const groundMat = own(toy ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, fog: false })
    : new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  const ground = new THREE.Mesh(own(new THREE.PlaneGeometry(W * ts, H * ts)), groundMat);
  ground.name = 'wheatfield-ground'; ground.rotation.x = -Math.PI / 2; ground.position.copy(toWorld((W - 1) / 2, (H - 1) / 2, -0.01));
  ground.renderOrder = -1; ground.receiveShadow = true;
  root.add(ground);

  // Lit-stage light pool, baked into the toy ground shader: muted cool grey near the focus tile, cool navy from ~13 tiles out.
  // The tint multiplies diffuseColor right after map_fragment, so sun light and shadows still apply. No extra draw.
  const poolCentre = { value: new THREE.Vector2() };
  if (toy) {
    const groundGain = { value: LIT_GROUND_GAIN };
    groundMat.userData.groundGain = groundGain;
    groundMat.onBeforeCompile = (shader) => {
      shader.uniforms.uGroundGain = groundGain;
      shader.uniforms.uPoolCentre = poolCentre;
      shader.uniforms.uPoolTile = { value: ts };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vPoolXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPoolXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vPoolXZ;\nuniform vec2 uPoolCentre;\nuniform float uPoolTile;\nuniform float uGroundGain;')
        .replace('#include <map_fragment>', `#include <map_fragment>
  {
    float poolD = distance(vPoolXZ, uPoolCentre) / uPoolTile;
    vec3 poolWarm = 0.9 * vec3(0.72, 0.92, 1.12);
    vec3 poolCool = vec3(0.48, 0.58, 0.66) * 0.6;
    diffuseColor.rgb *= uGroundGain * mix(poolWarm, poolCool, smoothstep(5.0, 13.0, poolD));
  }`);
    };
  }
  let poolAt = null;
  function movePool(fx, fy) {
    if (poolAt && Math.hypot(fx - poolAt[0], fy - poolAt[1]) <= 2) return;
    poolAt = [fx, fy]; const p = toWorld(fx, fy, 0); poolCentre.value.set(p.x, p.z);
  }
  { const p = toWorld((W - 1) / 2, (H - 1) / 2, 0); poolCentre.value.set(p.x, p.z); }
  groundMat.userData.poolCentre = poolCentre;

  // Instanced props. One draw call each: boulders (five-sided blocks), wheat blades, windmill pads.
  const dummy = new THREE.Object3D();
  const boulderGeo = own(new THREE.CylinderGeometry(0.46, 0.56, 1, 5));
  const boulderMat = own(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const cap = (n) => Math.max(1, n);
  let boulders = null, boulderKey = '', boulderDecals = null;
  function buildBoulders(rocks, rubble) {
    if (boulders) { root.remove(boulders); boulders.dispose?.(); }
    boulderDecals?.dispose();
    const waterSet = new Set(map.water.map(([x, y]) => y * W + x));
    const list = rocks.filter(([x, y]) => !waterSet.has(y * W + x));
    const all = [...list.map(([x, y]) => ({ x, y, cliff: true })), ...rubble.map((r) => ({ x: r.x, y: r.y, cliff: false }))];
    const set = new Set(all.map((o) => o.y * W + o.x));
    boulders = new THREE.InstancedMesh(boulderGeo, boulderMat, cap(all.length));
    boulders.name = 'wheatfield-boulders'; boulders.frustumCulled = false; boulders.castShadow = true; boulders.receiveShadow = true;
    const col = new THREE.Color();
    all.forEach((o, i) => {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && set.has((o.y + dy) * W + o.x + dx)) n++;
      const hgt = o.cliff ? 0.7 + n * 0.12 + hash(o.x, o.y) * 0.5 : 0.35 + hash(o.x, o.y) * 0.2;
      const s = o.cliff ? 1.02 : 0.55;
      dummy.position.copy(toWorld(o.x, o.y, hgt * ts / 2)); dummy.rotation.set(0, hash(o.y, o.x) * Math.PI * 2, 0);
      dummy.scale.set(s * ts, hgt * ts, s * ts); dummy.updateMatrix(); boulders.setMatrixAt(i, dummy.matrix);
      // cliffs: dark blue-grey with a little variation; movable rubble: the pale rock value
      col.setHex(o.cliff ? QUIET.cliff : QUIET.rock).multiplyScalar(0.92 + hash(o.x + 7, o.y) * 0.16 + (o.cliff ? 0.28 * Math.min(1, n / 8) : 0));
      boulders.setColorAt(i, col);
    });
    boulders.count = all.length; boulders.instanceMatrix.needsUpdate = true; if (boulders.instanceColor) boulders.instanceColor.needsUpdate = true;
    root.add(boulders);
    // a soft contact decal under every boulder: one instanced draw, the shared decal material (RENDERING.md part 2)
    if (toyLookOn()) {
      boulderDecals = createContactShadows(ctx, { capacity: cap(all.length) });
      boulderDecals.set(all.map((o) => { const p = toWorld(o.x, o.y, 0), s = (o.cliff ? 1.02 : 0.55) * ts; return { x: p.x, y: p.y, z: p.z, width: s, depth: s }; }));
    }
    boulderKey = `${rocks.length}:${rubble.length}`;
    stats.boulders = all.length;
  }

  // Wheat: five blades per field tile, shrinking with the wheat left. The sim lists a tile's wheat in `crystals`.
  const bladeGeo = own(buildWheatTuftGeometry());
  const bladeMat = own(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
  let wheat = null, wheatTiles = [], wheatOffsets = [];
  function buildWheat(crystals) {
    if (wheat) { root.remove(wheat); wheat.dispose?.(); }
    wheatTiles = crystals;
    wheatOffsets = []; let total = 0;
    for (const c of crystals) { wheatOffsets.push(total); total += clustersOf(c); }
    wheat = new THREE.InstancedMesh(bladeGeo, bladeMat, cap(total));
    wheat.name = 'wheatfield-wheat'; wheat.frustumCulled = false; wheat.castShadow = true; wheat.receiveShadow = false;
    wheat.count = total;
    const col = new THREE.Color();
    for (let i = 0; i < total; i++) wheat.setColorAt(i, col.setScalar(0.92 + hash(i, 5) * 0.16));
    wheat.instanceColor.needsUpdate = true;
    root.add(wheat);
    stats.wheat = total * WHEAT_TUFT.blades;
  }
  const wheatFull = new Map();
  function updateWheat(crystals) {
    if (!wheat || crystals.length !== wheatTiles.length) buildWheat(crystals);
    let shown = 0;
    crystals.forEach((c, i) => {
      const full = wheatFull.get(i) ?? (wheatFull.set(i, Math.max(c.amount, 1)), wheatFull.get(i));
      const f = c.amount > 0 ? Math.max(0.25, Math.min(1, c.amount / full)) : 0;
      if (f > 0) shown++;
      for (let k = 0; k < clustersOf(c); k++) {
        const ox = (hash(c.x * 3 + k, c.y) - 0.5) * 0.6, oy = (hash(c.x, c.y * 3 + k + 9) - 0.5) * 0.6;
        dummy.position.copy(toWorld(c.x + ox, c.y + oy, 0));
        dummy.rotation.set(0, hash(c.x + k * 13, c.y + 5) * Math.PI * 2, 0);
        dummy.scale.set(ts, Math.max(f, 0.0001) * ts, ts); dummy.updateMatrix();
        wheat.setMatrixAt(wheatOffsets[i] + k, dummy.matrix);
      }
    });
    wheat.instanceMatrix.needsUpdate = true;
    stats.wheatShown = shown;
  }

  // Windmill pads: a small low warm stone on each generator socket (never a big cool slab beside a base).
  const padGeo = own(new THREE.BoxGeometry(0.5, 0.04, 0.5));
  const padMat = own(new THREE.MeshLambertMaterial({ color: 0xb8aea0 }));
  const sockets = map.sockets ?? [];
  const pads = new THREE.InstancedMesh(padGeo, padMat, cap(sockets.length));
  pads.name = 'wheatfield-pads'; pads.count = sockets.length; pads.frustumCulled = false;
  sockets.forEach(([x, y], i) => { dummy.position.copy(toWorld(x, y, 0.04 * ts)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(ts); dummy.updateMatrix(); pads.setMatrixAt(i, dummy.matrix); });
  root.add(pads);

  // Water glints: one instanced set of thin pale-cyan quads just above the ground. Opacity shimmers with time; no shadows.
  // Only GLINT_BUDGET dashes live at once, re-aimed at the water nearest the camera's ground point (triangle budget).
  const spots = rippleSpots(map);
  const byTile = new Map();
  spots.forEach((sp, i) => { const key = sp.y * W + sp.x; (byTile.get(key) ?? byTile.set(key, []).get(key)).push(i); });
  const waterKeys = [...byTile.keys()];
  const ponds = pondTiles(map);
  const origin = toWorld(0, 0, 0);
  const glintGeo = own(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const glintMat = own(new THREE.MeshBasicMaterial({ color: GLINT, transparent: true, opacity: 0.6, depthWrite: false, fog: false }));
  const glints = new THREE.InstancedMesh(glintGeo, glintMat, Math.min(GLINT_BUDGET, Math.max(1, spots.length)));
  glints.name = 'wheatfield-glints'; glints.frustumCulled = false; glints.castShadow = false; glints.receiveShadow = false;
  glints.count = 0; glints.renderOrder = 1;
  const glintFull = new THREE.Color(1, 1, 1);                    // instance colour multiplies the material's GLINT: white keeps creek dashes as they were
  const gA = new THREE.Color(GLINT), gB = new THREE.Color(GLINT_SPRING);
  const glintDim = new THREE.Color(gB.r / gA.r, gB.g / gA.g, gB.b / gA.b);   // spring dashes land on GLINT_SPRING
  root.add(glints);
  let glintFocus = '';
  function placeGlints(fx, fy) {
    const near = waterKeys.map((k) => { const x = k % W, y = (k - x) / W; return [(x - fx) ** 2 + (y - fy) ** 2, k]; }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const room = glints.instanceMatrix.count;
    let n = 0;
    for (const [, k] of near) {
      const inPond = ponds.has(k);                            // a pond keeps 3 dashes in all, all on its middle tile
      if (inPond && !ponds.anchors.has(k)) continue;
      for (const [j, i] of byTile.get(k).entries()) {
        if (n >= room || (inPond && j >= 3)) break;
        const sp = spots[i];
        dummy.position.copy(toWorld(sp.x + sp.dx, sp.y + sp.dy, 0.03 * ts)); dummy.rotation.set(0, 0, 0);
        dummy.scale.set(sp.len * ts, 1, 0.045 * ts); dummy.updateMatrix(); glints.setMatrixAt(n, dummy.matrix);
        glints.setColorAt(n++, sp.spring ? glintDim : glintFull);
      }
      if (n >= room) break;
    }
    glints.count = n; glints.instanceMatrix.needsUpdate = true; if (glints.instanceColor) glints.instanceColor.needsUpdate = true; stats.glints = n;
  }
  function focusTile() {
    const cam = ctx.camera; if (!cam) return [W / 2, H / 2];
    const p = cam.position, d = cam.getWorldDirection(new THREE.Vector3());
    let wx = p.x, wz = p.z;
    if (d.y < -0.05) { const t = -p.y / d.y; if (t > 0) { wx = p.x + d.x * t; wz = p.z + d.z * t; } }
    return [(wx - origin.x) / ts, (wz - origin.z) / ts];
  }

  // Springs: the 4 px ground texture can't hold a ring and a pool, so each 'U' tile gets two flush boxes in ONE instanced draw:
  // a light shore-teal ring and a navy pool (66-74 % of the tile, varied per tile), both under 0.02 tall so no side faces show.
  const springTiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (map.tiles[y][x] === 'U') springTiles.push([x, y]);
  const springGeo = own(new THREE.BoxGeometry(1, 1, 1));
  const springMat = own(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const springs = new THREE.InstancedMesh(springGeo, springMat, Math.max(1, springTiles.length * 2));
  springs.name = 'wheatfield-springs'; springs.frustumCulled = false; springs.castShadow = false; springs.receiveShadow = false;
  springs.count = springTiles.length * 2;
  springTiles.forEach(([x, y], i) => {
    const pool = 0.86 + 0.02 * hash(x + 3, y + 17);                // lip = (1 - pool) / 2 = 0.06 to 0.07 tile
    [[new THREE.Color(SPRING).lerp(new THREE.Color(NAVY), 0.15), 1, 0.01], [new THREE.Color(NAVY).lerp(new THREE.Color(SPRING), 0.5), pool, 0.018]].forEach(([c, w, h], k) => {
      dummy.position.copy(toWorld(x, y, h * ts / 2)); dummy.rotation.set(0, 0, 0); dummy.scale.set(w * ts, h * ts, w * ts); dummy.updateMatrix();
      springs.setMatrixAt(i * 2 + k, dummy.matrix); springs.setColorAt(i * 2 + k, new THREE.Color(c));
    });
  });
  if (springTiles.length) { springs.instanceMatrix.needsUpdate = true; springs.instanceColor.needsUpdate = true; root.add(springs); }

  const stats = {
    glints: 0, ripples: spots.length, boulders: 0, wheat: 0, wheatShown: 0,
    get draws() { return 1 + (boulders ? 1 : 0) + (wheat ? 1 : 0) + (sockets.length ? 1 : 0) + (spots.length ? 1 : 0) + (springTiles.length ? 1 : 0); },
  };
  return {
    name: 'wheatfield-terrain', stats,
    heightAt: () => 0,
    update(frame) {
      const snap = frame?.next ?? frame?.prev ?? {};
      const rocks = snap.rocks ?? map.rocks, crystals = snap.crystals ?? map.crystals;
      const key = `${rocks.length}:${map.rubble.length}`;
      if (!boulders || key !== boulderKey) buildBoulders(rocks, map.rubble);
      updateWheat(crystals);
      const [fx, fy] = focusTile(); movePool(fx, fy);
      const gKey = `${Math.round(fx / 4)}:${Math.round(fy / 4)}`;
      if (gKey !== glintFocus) { glintFocus = gKey; placeGlints(fx, fy); }
      const t = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      glintMat.opacity = 0.55 + 0.25 * Math.sin(t * 1.7);        // slow shimmer
    },
    dispose() {
      ctx.scene.remove(root);
      for (const d of disposables) d.dispose?.();
      boulders?.dispose?.(); wheat?.dispose?.(); pads.dispose?.(); glints.dispose?.(); springs.dispose?.(); boulderDecals?.dispose();
      ctx.scene.background = prevBackground; ctx.scene.fog = prevFog;
      if (ctx.highAt === highAt) delete ctx.highAt;
    },
  };
}
