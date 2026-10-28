// Wheatfield Valley ponds (decision C): a 3 x 4 pond of creek water near each Power Strip, so a Well can draw fast water
// from the first minute. Owner: sonnet. Real modules, nothing stubbed.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, loadMapV4, isConnected } from '../env/map.mjs';
import { drawWheatfield } from '../maps/layout-wheatfield.mjs';
import { BAKERY } from '../env/bakery.mjs';

const W = 256, H = 256;
const SEEDS = [1, 7, 472];
const m = loadMapV4('wheatfield');
const full = generateMap(7, { map: 'wheatfield' }); // the sim's view: wells, crystals, cores and workers
const layout = drawWheatfield();
const ponds = layout.extras.ponds;
const at = (x, y) => m.tiles[y][x];
const mirror = (x, y) => ({ x: W - 1 - x, y: H - 1 - y });
// Windmill pads on side 0 (env/energy.mjs PADS_SIDE0), and their point mirrors.
const PADS_SIDE0 = [[30, 224], [26, 214], [40, 236], [58, 210]];
const PADS = PADS_SIDE0.flatMap(([x, y]) => [{ x, y }, mirror(x, y)]);
// The walk from the home Strip to the home wheat: the Strip at (18, 232) and the nearest wheat tile at (24, 227).
const WALK = { a: { x: 18, y: 232 }, b: { x: 24, y: 227 } };

const pondTiles = (p) => {
  const out = [];
  for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) out.push({ x, y });
  return out;
};
const allPondTiles = () => ponds.flatMap(pondTiles);

// Distance from point p to the segment a-b (Euclidean, in tiles).
function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe('wheatfield ponds', () => {
  test('there is one 3 x 4 pond near each Strip, and the two are point mirrors', () => {
    assert.equal(ponds.length, 2);
    for (const p of ponds) {
      assert.equal(p.w, 3);
      assert.equal(p.h, 4);
      for (const t of pondTiles(p)) assert.equal(at(t.x, t.y), '~', `pond tile ${t.x},${t.y} is water`);
    }
    const [a, b] = ponds;
    const mirrored = new Set(pondTiles(a).map(({ x, y }) => { const k = mirror(x, y); return `${k.x},${k.y}`; }));
    for (const t of pondTiles(b)) assert.ok(mirrored.has(`${t.x},${t.y}`), `pond B tile ${t.x},${t.y} mirrors pond A`);
  });

  for (const seed of SEEDS) {
    test(`seed ${seed}: the nearest water is 8 to 12 tiles from each Strip`, () => {
      const map = generateMap(seed, { map: 'wheatfield' });
      assert.equal(map.cores.length, 2);
      for (const core of map.cores) {
        const d = Math.min(...map.water.map(([x, y]) => Math.hypot(x - core.x, y - core.y)));
        assert.ok(d >= 8 && d <= 12, `Strip at ${core.x},${core.y}: nearest water ${d.toFixed(2)} tiles`);
      }
    });
  }

  test('no pond tile overlaps a windmill pad, the home spring, a crystal, a Strip or a worker', () => {
    const blocked = new Set([
      ...PADS.map(({ x, y }) => `${x},${y}`),
      ...full.wells.map(([x, y]) => `${x},${y}`),
      ...full.crystals.map((c) => `${c.x},${c.y}`),
      ...full.cores.map((c) => `${c.x},${c.y}`),
      ...full.workers.flat().map((c) => `${c.x},${c.y}`),
    ]);
    assert.ok(full.wells.some(([x, y]) => x === 14 && y === 226), 'the home spring is still on the map');
    for (const t of allPondTiles()) assert.ok(!blocked.has(`${t.x},${t.y}`), `pond tile ${t.x},${t.y} is free`);
  });

  test('the pond stays off the walk from the Strip to the home wheat', () => {
    for (const t of allPondTiles()) {
      assert.ok(segDist(t, WALK.a, WALK.b) > 3, `pond tile ${t.x},${t.y} is clear of the walk`);
    }
  });

  for (const seed of SEEDS) {
    test(`seed ${seed}: every open tile still connects with the ponds in place`, () => {
      assert.ok(isConnected(generateMap(seed, { map: 'wheatfield' })));
    });
  }

  test('a Well on open ground beside the pond is within the creek-rate reach of water', () => {
    const [a] = ponds;
    const well = { x: a.x + a.w + 2, y: a.y + 1 };
    assert.equal(at(well.x, well.y), '.', 'the Well spot is open ground');
    const near = allPondTiles().some((t) => Math.max(Math.abs(t.x - well.x), Math.abs(t.y - well.y)) <= BAKERY.wellReach);
    assert.ok(near, `a Well at ${well.x},${well.y} stands within ${BAKERY.wellReach} tiles of pond water`);
  });

  test('the layout is deterministic: drawing it twice gives the same map', () => {
    const again = drawWheatfield();
    assert.deepEqual(again.tiles, layout.tiles);
    assert.deepEqual(again.extras.ponds, ponds);
  });
});
