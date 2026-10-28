// Cached goal distance fields: the same answers as findPath in env/path.mjs, much cheaper when units share a goal.
//
// findPath is a breadth-first search from the unit with neighbours tried up, right, down, left. Its path is therefore the
// shortest route whose sequence of directions is smallest (up < right < down < left): the queue order is the order of
// those direction strings, and each tile keeps the earliest parent. Given D(x) = steps from tile x to the nearest goal
// tile, that route is a greedy walk: from each tile take the first direction whose neighbour has D one lower.
//
// D comes from a multi-source search out of the goal tiles. It is built only as far as the asking unit needs, kept, and
// continued when a farther unit asks, so every unit and every tick that heads for the same goal shares the work. The
// cache belongs to one match and is dropped whenever the blocked tiles change.

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const UNSEEN = 65535;
const MAX_FIELDS = 32;

/** A cache bound to one match. */
export function createFieldCache() {
  return { solid: null, solidRef: null, fields: new Map(), pool: [] };
}

function newField(cache, width, height, blocked, mask, to, within) {
  const size = width * height;
  // Evicted fields lend their buffers: a miss is then a fill, not two big allocations.
  const old = cache.pool.pop();
  const f = old && old.dist.length === size ? old : { dist: new Uint16Array(size), queue: new Int32Array(size) };
  f.dist.fill(UNSEEN);
  Object.assign(f, { width, height, blocked, mask, head: 0, tail: 0 });
  const x0 = Math.max(0, to.x - within), x1 = Math.min(width - 1, to.x + within);
  const y0 = Math.max(0, to.y - within), y1 = Math.min(height - 1, to.y + within);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (mask ? mask[y * width + x] === 1 : blocked(x, y)) continue;
      f.dist[y * width + x] = 0;
      f.queue[f.tail++] = y * width + x;
    }
  }
  return f;
}

// Advance the search by one tile. False when it has nothing left to expand.
function expandOne(f) {
  if (f.head >= f.tail) return false;
  const { width, height, dist, queue, blocked, mask } = f;
  const cur = queue[f.head++];
  const cx = cur % width;
  const cy = (cur - cx) / width;
  const nd = dist[cur] + 1;
  for (let d = 0; d < 4; d++) {
    const nx = cx + DX[d];
    const ny = cy + DY[d];
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const n = ny * width + nx;
    if (dist[n] !== UNSEEN || (mask ? mask[n] === 1 : blocked(nx, ny))) continue;
    dist[n] = nd;
    queue[f.tail++] = n;
  }
  return true;
}

// Smallest D among the tile's neighbours that is already known, or UNSEEN.
function nearest(f, x, y) {
  let best = UNSEEN;
  for (let d = 0; d < 4; d++) {
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= f.width || ny >= f.height) continue;
    const v = f.dist[ny * f.width + nx];
    if (v < best) best = v;
  }
  return best;
}

/** Look up or extend the field for this goal; { f, best } with best the smallest known neighbour distance, or null when unreachable. */
function fieldFor(cache, solid, wallsId, grid, from, to, within) {
  const { width, height } = grid;
  if (cache.solidRef !== solid) {
    cache.solidRef = solid;
    if (!cache.solid || cache.solid.length !== solid.length || !sameBytes(cache.solid, solid)) {
      cache.solid = solid.slice();
      for (const f of cache.fields.values()) if (cache.pool.length < MAX_FIELDS) cache.pool.push(f);
      cache.fields.clear();
    }
  }
  const key = `${to.x},${to.y},${within},${wallsId}`;
  let f = cache.fields.get(key);
  if (f) {
    cache.fields.delete(key); // refresh recency
  } else {
    const g = grid.make ? grid.make() : grid;
    f = newField(cache, width, height, g.blocked, g.mask, to, within);
    if (cache.fields.size >= MAX_FIELDS) {
      const old = cache.fields.keys().next().value;
      cache.pool.push(cache.fields.get(old));
      cache.fields.delete(old);
    }
  }
  cache.fields.set(key, f);

  // Search until every tile at least as near the goal as the unit's best neighbour is known.
  let best = nearest(f, from.x, from.y);
  while (best === UNSEEN ? f.head < f.tail : f.head < f.tail && f.dist[f.queue[f.head]] < best) {
    expandOne(f);
    if (best === UNSEEN) best = nearest(f, from.x, from.y);
  }
  return best === UNSEEN ? null : { f, best };
}

/**
 * findPath(grid, from, to, { within }) with identical results. `solid` is the Uint8Array behind grid.blocked (a new array
 * each tick); the cache is emptied whenever its bytes change. `wallsId` names the exact blocked set of `grid` (equal ids
 * must mean equal blocked tiles); `grid.make()`, when present, builds the real grid and is only called on a miss.
 */
export function findPathCached(cache, solid, wallsId, grid, from, to, within = 0) {
  const { width, height } = grid;
  if (from.x < 0 || from.y < 0 || from.x >= width || from.y >= height) return null;
  if (Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) <= within) return [];
  const hit = fieldFor(cache, solid, wallsId, grid, from, to, within);
  if (!hit) return null;
  const { f } = hit;
  const path = [];
  let cx = from.x, cy = from.y, want = hit.best;
  for (;;) {
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || f.dist[ny * width + nx] !== want) continue;
      cx = nx;
      cy = ny;
      break;
    }
    path.push({ x: cx, y: cy });
    if (want === 0) return path;
    want--;
  }
}

let seenBuf = null;
let seenStamp = 0;

/**
 * The path findPath would find on grid + extra blocked tiles (`taken[i] === 1`: other units), for the common case that a
 * route as short as the unobstructed one still exists. Then the answer is the first such route in up, right, down, left
 * order: a depth-first walk down the unobstructed field (every step one nearer the goal), backing out of dead ends,
 * finds exactly that. Returns undefined when every shortest route is cut (the detour is longer: use a full search),
 * null when the goal cannot be reached at all, [] when already there.
 */
export function findPathAround(cache, solid, wallsId, grid, taken, from, to, within = 0) {
  const { width, height } = grid;
  if (from.x < 0 || from.y < 0 || from.x >= width || from.y >= height) return null;
  if (Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) <= within) return [];
  const hit = fieldFor(cache, solid, wallsId, grid, from, to, within);
  if (!hit) return null;
  const { dist } = hit.f;
  const size = width * height;
  if (!seenBuf || seenBuf.length < size) seenBuf = new Int32Array(size);
  const stamp = ++seenStamp;

  const start = from.y * width + from.x;
  const tiles = [start]; // the route so far
  const next = [0]; // next direction to try at each tile of the route
  while (tiles.length > 0) {
    const top = tiles.length - 1;
    const cur = tiles[top];
    const want = top === 0 ? hit.best : dist[cur] - 1; // distance the next tile must have
    const cx = cur % width;
    const cy = (cur - cx) / width;
    let moved = false;
    while (next[top] < 4) {
      const d = next[top]++;
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (dist[n] !== want || taken[n] === 1 || seenBuf[n] === stamp) continue;
      if (want === 0) {
        const path = [];
        for (let i = 1; i < tiles.length; i++) path.push({ x: tiles[i] % width, y: Math.floor(tiles[i] / width) });
        path.push({ x: nx, y: ny });
        return path;
      }
      tiles.push(n);
      next.push(0);
      moved = true;
      break;
    }
    if (!moved) {
      seenBuf[cur] = stamp; // a dead end stays dead whatever route led to it
      tiles.pop();
      next.pop();
    }
  }
  return undefined;
}

// Browser-safe byte equality (Buffer is Node-only: it crashed the live play page, 'live driver stopped: Buffer is not defined').
function sameBytes(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
