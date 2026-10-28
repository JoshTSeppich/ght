// Breadth-first shortest path on a 4-directional grid. See ENV-SPEC.md section 6.
// Neighbour order is fixed (up, right, down, left) so the same question gives the same path.
//
// The grid may carry `mask`, a Uint8Array (1 = blocked) with the same answers as `blocked`; the search then reads the bytes
// directly. The search buffers are shared between calls and reset with a stamp, so a call allocates nothing but its path.

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

let scratch = null;

function buffers(size) {
  if (!scratch || scratch.seen.length < size) scratch = { seen: new Int32Array(size), prev: new Int32Array(size), queue: new Int32Array(size), stamp: 0 };
  return scratch;
}

export function findPath({ width, height, blocked, mask }, from, to, { within = 0 } = {}) {
  if (from.x < 0 || from.y < 0 || from.x >= width || from.y >= height) return null;
  const tx = to.x;
  const ty = to.y;
  if (Math.max(Math.abs(from.x - tx), Math.abs(from.y - ty)) <= within) return [];

  const start = from.y * width + from.x;
  const buf = buffers(width * height);
  const { seen, prev, queue } = buf;
  const stamp = ++buf.stamp;
  seen[start] = stamp;
  prev[start] = -1;
  let tail = 0;
  queue[tail++] = start;
  for (let head = 0; head < tail; head++) {
    const cur = queue[head];
    const cx = cur % width;
    const cy = (cur - cx) / width;
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const n = ny * width + nx;
      if (seen[n] === stamp || (mask ? mask[n] === 1 : blocked(nx, ny))) continue;
      seen[n] = stamp;
      prev[n] = cur;
      const ax = nx > tx ? nx - tx : tx - nx;
      const ay = ny > ty ? ny - ty : ty - ny;
      if ((ax > ay ? ax : ay) <= within) {
        const path = [];
        for (let i = n; i !== start; i = prev[i]) path.push({ x: i % width, y: Math.floor(i / width) });
        return path.reverse();
      }
      queue[tail++] = n;
    }
  }
  return null;
}
