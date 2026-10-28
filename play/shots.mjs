// Visible shots on /play (owner: sonnet, COMBAT.md section 3). The Studio studies come across as timing and paths:
// Pop Shot's slice arc (play/style-lab/pop-shot.mjs), Quad Volley's four slices, Bread Shell's high lob, and Hot Coil's
// bolt (play/style-lab/hot-coil.mjs). Every flying shot is one slot in ONE InstancedMesh, at most MAX_LIVE at a time.
// Presentation only: the sim decides the hit; a shot is drawn from the moment its attack started, in milliseconds, so the
// 24-tick sim reads as smooth 60 fps motion.
//
//   shotStyleOf(kind) -> 'slice' | 'bolt' | 'quad' | 'lob' | null      (toaster model id -> style)
//   shotTiming(style) -> { launch, land, end } in ms from the attack's start
//   shotProgress(style, ageMs) -> { live, p }                          (in flight between launch and land)
//   arcPoint(from, to, p, height) -> { x, y, z }
//   shotPaths(style, from, to) -> [{ from, to, height }]
//   createShotPool(ctx, { unitScale, max }) -> { spawn, update(nowMs), live(nowMs), mesh, dispose() }

import * as THREE from 'three';
import { COLORS } from './toaster-models.mjs';

export const MAX_LIVE = 64;

export const SHOT_STYLE = Object.freeze({ popper: 'slice', zapper: 'bolt', 'four-slice': 'quad', broiler: 'lob' });
// launch: the shot leaves the toast; land: it hits (flight = land - launch); end: the spark is over and the slot is free.
const TIMING = Object.freeze({
  slice: { launch: 200, land: 340, end: 410 },   // Pop Shot: 140 ms flight, bonk at 340
  bolt: { launch: 200, land: 340, end: 370 },    // Hot Coil: 140 ms flight, the flash runs to 370
  quad: { launch: 200, land: 380, end: 450 },    // Quad Volley: four slices leave together and fan out
  lob: { launch: 240, land: 500, end: 560 },     // Bread Shell: a slower, higher lob
});
const SIZE = Object.freeze({ slice: 0.6, bolt: 0.8, quad: 0.45, lob: 1.0 });   // tiles, before the unit scale
const THICK = 0.2;
const HEIGHT = Object.freeze({ slice: 1.2, bolt: 0.25, quad: 0.7, lob: 3.0 });  // arc height in tiles
const SPREAD = 0.9;                                                            // tiles between the four Quad Volley slices
const TOAST = new THREE.Color('#d99448'), HOT = new THREE.Color('#ffb347');
const TEAM = [new THREE.Color(COLORS.cyan), new THREE.Color(COLORS.orange)];

export const shotStyleOf = (kind) => SHOT_STYLE[kind] ?? null;
export const shotTiming = (style) => TIMING[style] ?? null;

/** In flight between launch and land. p runs 0..1 across the flight. */
export function shotProgress(style, ageMs) {
  const t = TIMING[style];
  if (!t || !(ageMs >= t.launch) || !(ageMs < t.land)) return { live: false, p: 0 };
  return { live: true, p: (ageMs - t.launch) / (t.land - t.launch) };
}

/** A point on the straight line from a to b, lifted by a parabola that peaks at `height` in the middle. */
export function arcPoint(a, b, p, height = 0) {
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p + 4 * height * p * (1 - p), z: a.z + (b.z - a.z) * p };
}

/** The paths one attack throws: one slice or bolt, four spread slices for the Quad Volley, one lob. */
export function shotPaths(style, from, to) {
  if (!TIMING[style]) return [];
  const h = HEIGHT[style];
  if (style !== 'quad') return [{ from: { ...from }, to: { ...to }, height: h }];
  const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz) || 1;
  const px = -dz / len, pz = dx / len;                                  // sideways, across the aim
  return [-1.5, -0.5, 0.5, 1.5].map((k) => ({
    from: { ...from },
    to: { x: to.x + px * k * SPREAD, y: to.y, z: to.z + pz * k * SPREAD },
    height: h,
  }));
}

/** One InstancedMesh of toast discs. Each slot is one flying slice or bolt; a finished slot is reused. */
export function createShotPool(ctx, { unitScale = 1, max = MAX_LIVE } = {}) {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 5).rotateX(Math.PI / 2);   // five-sided, axis along z
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.name = 'toaster-shots';
  mesh.frustumCulled = false;
  mesh.count = 0;
  ctx.scene?.add(mesh);

  const slots = Array.from({ length: max }, () => ({ on: false, style: null, from: null, to: null, height: 0, t0: 0, team: 0 }));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), pos = new THREE.Vector3();
  const dir = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1), c = new THREE.Color();

  const done = (sl, nowMs) => !sl.on || nowMs - sl.t0 >= TIMING[sl.style].end;
  const live = (nowMs) => slots.reduce((n, sl) => n + (sl.on && nowMs - sl.t0 < TIMING[sl.style].end ? 1 : 0), 0);

  // Claim a slot for each path. A full pool recycles the oldest shot (the one launched first), so the cap holds.
  function spawn(style, from, to, team, nowMs) {
    const paths = shotPaths(style, from, to);
    for (const p of paths) {
      let slot = slots.find((sl) => done(sl, nowMs));
      if (!slot) slot = slots.reduce((a, b) => (b.t0 < a.t0 ? b : a));
      Object.assign(slot, { on: true, style, from: p.from, to: p.to, height: p.height, t0: nowMs, team: team ? 1 : 0 });
    }
    return paths.length;
  }

  // Write the in-flight slots into the front of the mesh; the rest are not drawn.
  function update(nowMs) {
    let n = 0;
    for (const sl of slots) {
      if (!sl.on) continue;
      const { p, live: flying } = shotProgress(sl.style, nowMs - sl.t0);
      if (!flying) continue;
      const a = arcPoint(sl.from, sl.to, p, sl.height), b = arcPoint(sl.from, sl.to, Math.min(1, p + 0.02), sl.height);
      dir.set(b.x - a.x, b.y - a.y, b.z - a.z);
      if (dir.lengthSq() < 1e-12) dir.set(0, 0, 1);
      q.setFromUnitVectors(up, dir.normalize());
      const size = SIZE[sl.style] * unitScale;
      s.set(size, size, THICK * unitScale);
      m.compose(pos.set(a.x, a.y, a.z), q, s);
      mesh.setMatrixAt(n, m);
      c.copy(sl.style === 'bolt' ? HOT : TOAST).lerp(TEAM[sl.team], 0.3);
      mesh.setColorAt(n, c);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function dispose() {
    ctx.scene?.remove(mesh);
    mesh.dispose();
    geo.dispose();
    mat.dispose();
  }

  return { spawn, update, live, mesh, dispose, get max() { return max; } };
}
