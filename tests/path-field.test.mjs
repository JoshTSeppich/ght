// findPathCached must give exactly the path findPath gives, on random mazes, goals, `within` and blocked starts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findPath } from '../env/path.mjs';
import { createFieldCache, findPathCached, findPathAround } from '../env/path-field.mjs';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

test('cached field paths are identical to breadth-first paths', () => {
  const r = rng(7);
  let compared = 0;
  for (let round = 0; round < 40; round++) {
    const width = 8 + Math.floor(r() * 30);
    const height = 8 + Math.floor(r() * 30);
    const density = r() * 0.4;
    const solid = new Uint8Array(width * height);
    for (let i = 0; i < solid.length; i++) solid[i] = r() < density ? 1 : 0;
    const grid = { width, height, blocked: (x, y) => solid[y * width + x] === 1 };
    const cache = createFieldCache();
    for (let q = 0; q < 60; q++) {
      const from = { x: Math.floor(r() * width), y: Math.floor(r() * height) };
      const to = { x: Math.floor(r() * width), y: Math.floor(r() * height) };
      const within = Math.floor(r() * 4);
      const want = findPath(grid, from, to, { within });
      for (let rep = 0; rep < 3; rep++) { // the 2nd and 3rd ask go through the cached field
        const got = findPathCached(cache, solid, 0, grid, from, to, within);
        assert.deepEqual(got, want, `round ${round} q ${q} rep ${rep}`);
      }
      compared++;
    }
  }
  assert.ok(compared > 2000);
});

test('the cache forgets its fields when the map changes', () => {
  let solid = new Uint8Array(100); // callers hand over a fresh array each tick
  const grid = { width: 10, height: 10, blocked: (x, y) => solid[y * 10 + x] === 1 };
  const cache = createFieldCache();
  const a = findPathCached(cache, solid, 0, grid, { x: 0, y: 0 }, { x: 9, y: 0 }, 0);
  assert.equal(a.length, 9);
  solid = solid.slice();
  for (let y = 0; y < 9; y++) solid[y * 10 + 5] = 1; // wall with a gap at the bottom
  const b = findPathCached(cache, solid, 0, grid, { x: 0, y: 0 }, { x: 9, y: 0 }, 0);
  assert.deepEqual(b, findPath(grid, { x: 0, y: 0 }, { x: 9, y: 0 }));
  assert.ok(b.length > 9);
});

test('the walk around other units gives the same path whenever a shortest route survives', () => {
  const r = rng(11);
  let same = 0;
  let cut = 0;
  for (let round = 0; round < 60; round++) {
    const width = 8 + Math.floor(r() * 30);
    const height = 8 + Math.floor(r() * 30);
    const solid = new Uint8Array(width * height);
    for (let i = 0; i < solid.length; i++) solid[i] = r() < r() * 0.3 ? 1 : 0;
    const grid = { width, height, blocked: (x, y) => solid[y * width + x] === 1, mask: solid };
    const cache = createFieldCache();
    for (let q = 0; q < 60; q++) {
      const taken = new Uint8Array(width * height);
      const crowd = r() * 0.25;
      for (let i = 0; i < taken.length; i++) taken[i] = r() < crowd ? 1 : 0;
      const from = { x: Math.floor(r() * width), y: Math.floor(r() * height) };
      taken[from.y * width + from.x] = 0; // a unit's own tile is not an obstacle to itself
      const to = { x: Math.floor(r() * width), y: Math.floor(r() * height) };
      const within = Math.floor(r() * 3);
      const crowded = { width, height, blocked: (x, y) => solid[y * width + x] === 1 || taken[y * width + x] === 1 };
      const want = findPath(crowded, from, to, { within });
      const free = findPath(grid, from, to, { within });
      const got = findPathAround(cache, solid, 0, grid, taken, from, to, within);
      if (got === undefined) {
        cut++;
        assert.ok(free && (!want || want.length > free.length), 'only gives up when every shortest route is cut');
      } else if (got === null) {
        assert.equal(free, null);
      } else {
        same++;
        assert.deepEqual(got, want === null ? null : want, `round ${round} q ${q}`);
      }
    }
  }
  assert.ok(same > 500 && cut > 20, `same ${same} cut ${cut}`);
});
