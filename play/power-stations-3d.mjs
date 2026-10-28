// Power Stations on the play page (Joshua 10-23 09:29: stations that connect cords, fences that change the terrain).
// Owner: sonnet (Playable Client). The look is GPT's Design Studio study (play/style-lab/power-stations.mjs):
//   Extension Box = a low charcoal post with a glowing team cap; Relay Pylon = a tall thin post with a wide cap, joined to
//   other pylons by a thin overhead high line with a dark ground shadow; Outlet = a cream socket plate;
//   a live ground fence = a thick glowing team rail, a browned-out one is grey with sparks;
//   fenced land = a soft team pentagon tint on every fenced tile; pegs = round dots where a cord bends round a corner.
//
//   stationPrims(view)                      pure: fenceView() output -> flat lists of beams, boxes and pentagons by material
//   createStationLayer(ctx, { getState, side }) -> viewer3d system { update(frame, dt), dispose(), root }
// All geometry is built in tile units (x east, height up, y south) and merged into ONE mesh per material, rebuilt only when
// the view changes (stations, fences, fenced land and pegs change a few times a minute), so it costs 8 draw calls at most.
import { fenceView } from './power-view.mjs';
import { COLORS } from './toaster-models.mjs';
import { BAKERY } from '../env/bakery.mjs';

export const POST_COLOR = '#303844';
export const GREY = '#7d858c';
export const OUTLET_COLOR = '#f2d7a6';
export const PYLON_TOP = 2.6; // tile units: the high line runs at the cap of a pylon
export const RAIL_Y = 0.3;

const TEAM = [COLORS.cyan, COLORS.orange];
const REFRESH_TICKS = 6; // the view is rebuilt from the sim at most this often

const mix = (a, b, t) => a + (b - a) * t;

// Alt held (SYSTEMS-DESIGN.md section 4): every Well crowding ring (R = BAKERY.wellCrowdRadius, for each complete Well of any
// owner) and every cord reach (the power points with a range; a generator has none). Pure: [{ what, owner, x, y, r }].
export function altRings(state) {
  const out = [];
  for (const s of state.structures ?? []) {
    if (s.kind === 'well' && s.complete && s.hp > 0) out.push({ what: 'well', owner: s.owner, x: s.x, y: s.y, r: BAKERY.wellCrowdRadius });
  }
  const points = state.power?.view?.points ?? state.power?.points ?? [];
  for (const p of points) if (p.range > 0) out.push({ what: 'cord', owner: p.owner, x: p.x, y: p.y, r: p.range });
  return out;
}

/** Strokes altRings() on the 2D overlay: faint team-coloured rings, a little stronger for my side. `project` is the page's. */
export function drawAltRings(ctx, state, side, project, tp) {
  const rings = altRings(state);
  if (!rings.length) return;
  const alpha = ctx.globalAlpha, width = ctx.lineWidth;
  ctx.lineWidth = Math.max(1, tp * 0.04);
  for (const r of rings) {
    ctx.globalAlpha = r.owner === side ? 0.45 : 0.3;
    ctx.strokeStyle = TEAM[r.owner] ?? GREY;
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const p = project(r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, 0);
      if (i === 0) ctx.moveTo(p.sx, p.sy); else ctx.lineTo(p.sx, p.sy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = alpha; ctx.lineWidth = width;
}

/**
 * Turn a fenceView() into drawable primitives, grouped by material key.
 *   beams:  { mat, a: [x,h,y], b: [x,h,y], w, h }    a box from a to b (rails, high lines, shadows, cords)
 *   boxes:  { mat, x, h, y, sx, sh, sy }             an axis-aligned box centred at x,y with its base at h
 *   pents:  { mat, x, h, y, r }                      a flat pentagon of circumradius r lying at height h
 *   sparks: { x, h, y }                              where a browned-out fence crackles
 * Materials: 'post', 'outlet', 'cap0'/'cap1' (glowing team cap), 'capDark', 'rail0'/'rail1', 'railDark', 'high0'/'high1',
 * 'shadow', 'tint0'/'tint1', 'peg0'/'peg1'.
 */
export function stationPrims(view, side = 0) {
  const out = { beams: [], boxes: [], pents: [], sparks: [] };
  for (const p of view.posts) {
    const cap = p.lit ? `cap${p.owner}` : 'capDark';
    if (p.kind === 'outlet') {
      out.boxes.push({ mat: 'outlet', x: p.x, h: 0, y: p.y, sx: 0.8, sh: 0.18, sy: 0.6 });
      out.boxes.push({ mat: 'post', x: p.x - 0.16, h: 0.18, y: p.y, sx: 0.12, sh: 0.02, sy: 0.22 });
      out.boxes.push({ mat: 'post', x: p.x + 0.16, h: 0.18, y: p.y, sx: 0.12, sh: 0.02, sy: 0.22 });
      out.boxes.push({ mat: cap, x: p.x, h: 0.18, y: p.y + 0.22, sx: 0.3, sh: 0.06, sy: 0.08 });
    } else if (p.tall) {
      out.boxes.push({ mat: 'post', x: p.x, h: 0, y: p.y, sx: 0.8, sh: 0.2, sy: 0.7 });
      out.boxes.push({ mat: 'post', x: p.x, h: 0.2, y: p.y, sx: 0.24, sh: PYLON_TOP - 0.2, sy: 0.45 });
      out.boxes.push({ mat: cap, x: p.x, h: PYLON_TOP, y: p.y, sx: 1, sh: 0.18, sy: 0.5 });
    } else {
      out.boxes.push({ mat: 'post', x: p.x, h: 0, y: p.y, sx: 0.8, sh: 0.2, sy: 0.7 });
      out.boxes.push({ mat: 'post', x: p.x, h: 0.2, y: p.y, sx: 0.65, sh: 0.55, sy: 0.45 });
      out.boxes.push({ mat: cap, x: p.x, h: 0.75, y: p.y, sx: 0.7, sh: 0.18, sy: 0.5 });
    }
  }
  const topOf = (id) => {
    const p = view.posts.find((q) => q.id === id);
    return p && p.tall ? PYLON_TOP + 0.09 : 0.84;
  };
  const near = (pt) => view.posts.reduce((b, q) => (!b || Math.hypot(q.x - pt.x, q.y - pt.y) < Math.hypot(b.x - pt.x, b.y - pt.y) ? q : b), null);
  for (const w of view.wires) {
    const live = w.state === 'live';
    out.beams.push({ mat: live ? `rail${w.owner}` : 'railDark', a: [w.from.x, RAIL_Y, w.from.y], b: [w.to.x, RAIL_Y, w.to.y], w: live ? 0.2 : 0.14, h: live ? 0.2 : 0.12 });
    if (!live) out.sparks.push({ x: (w.from.x + w.to.x) / 2, h: RAIL_Y + 0.1, y: (w.from.y + w.to.y) / 2 });
  }
  for (const l of view.overhead) {
    const ha = topOf(near(l.from)?.id), hb = topOf(near(l.to)?.id);
    out.beams.push({ mat: `high${l.owner}`, a: [l.from.x, ha, l.from.y], b: [l.to.x, hb, l.to.y], w: 0.05, h: 0.05 });
    out.beams.push({ mat: 'shadow', a: [l.from.x, 0.02, l.from.y + 0.2], b: [l.to.x, 0.02, l.to.y + 0.2], w: 0.09, h: 0.005 });
  }
  for (const k of view.fenced) {
    const [x, y] = k.split(',').map(Number);
    out.pents.push({ mat: `tint${view.fencedOwner?.[k] ?? side}`, x, h: 0.03, y, r: 0.5 });
  }
  for (const g of view.pegs) out.boxes.push({ mat: `peg${side}`, x: g.x, h: 0, y: g.y, sx: 0.26, sh: 0.2, sy: 0.26 });
  return out;
}

/** The view for the layer: your fenceView plus the enemy's fenced land (fenceView reports only the side asked for). */
export function layerView(state, side) {
  const mine = fenceView(state, side);
  const theirs = state.power?.enclosure ? fenceView(state, 1 - side) : { fenced: [] };
  const fencedOwner = {};
  for (const k of mine.fenced) fencedOwner[k] = side;
  for (const k of theirs.fenced) fencedOwner[k] = 1 - side;
  return { ...mine, fenced: Object.keys(fencedOwner).sort(), fencedOwner };
}

// --- three.js side -------------------------------------------------------------------------------------------------

function mergeInto(bufs, mat, tris) {
  const b = bufs.get(mat) ?? bufs.set(mat, []).get(mat);
  for (const v of tris) b.push(v);
}
function boxTris(c, ax, ay, az, hx, hy, hz) {
  // eight corners from a centre c and three half-extent axes; 12 triangles
  const v = [];
  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? 1 : -1, sy = i & 2 ? 1 : -1, sz = i & 4 ? 1 : -1;
    v.push([c[0] + ax[0] * hx * sx + ay[0] * hy * sy + az[0] * hz * sz,
      c[1] + ax[1] * hx * sx + ay[1] * hy * sy + az[1] * hz * sz,
      c[2] + ax[2] * hx * sx + ay[2] * hy * sy + az[2] * hz * sz]);
  }
  const quads = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 2, 6, 4], [1, 5, 7, 3], [0, 4, 5, 1], [2, 3, 7, 6]];
  const out = [];
  for (const [a, b, c2, d] of quads) out.push(...v[a], ...v[b], ...v[c2], ...v[a], ...v[c2], ...v[d]);
  return out;
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Flat triangle arrays (x,y,z floats) per material key for a prims list. Pure; exported for tests. */
export function primTriangles(prims) {
  const bufs = new Map();
  for (const b of prims.boxes) {
    mergeInto(bufs, b.mat, boxTris([b.x, b.h + b.sh / 2, b.y], [1, 0, 0], [0, 1, 0], [0, 0, 1], b.sx / 2, b.sh / 2, b.sy / 2));
  }
  for (const b of prims.beams) {
    const d = norm([b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]]);
    const len = Math.hypot(b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]);
    let side = cross(d, [0, 1, 0]);
    if (Math.hypot(...side) < 1e-6) side = [1, 0, 0];
    side = norm(side);
    const up = norm(cross(side, d));
    const c = [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2, (b.a[2] + b.b[2]) / 2];
    mergeInto(bufs, b.mat, boxTris(c, d, up, side, len / 2, b.h / 2, b.w / 2));
  }
  for (const p of prims.pents) {
    const t = [];
    for (let i = 0; i < 5; i++) {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 5, a1 = a0 + (2 * Math.PI) / 5;
      t.push(p.x, p.h, p.y, p.x + p.r * Math.cos(a1), p.h, p.y + p.r * Math.sin(a1), p.x + p.r * Math.cos(a0), p.h, p.y + p.r * Math.sin(a0));
    }
    mergeInto(bufs, p.mat, t);
  }
  return bufs;
}

export function createStationLayer(ctx, { getState, side = 0, THREE } = {}) {
  const T = THREE ?? ctx.THREE ?? ctx.three;
  if (!T) throw new Error('createStationLayer needs ctx.THREE');
  const root = new T.Group();
  root.name = 'power-stations';
  const origin = ctx.gridToWorld(0, 0, 0, new T.Vector3());
  root.position.copy(origin);
  root.scale.setScalar(ctx.tileSize ?? 1);
  ctx.scene.add(root);

  const basic = (color, extra = {}) => { const m = new T.MeshBasicMaterial({ color: new T.Color(color), side: T.DoubleSide, ...extra }); m.toneMapped = false; return m; };
  const std = (color) => new T.MeshStandardMaterial({ color: new T.Color(color), roughness: 0.85, flatShading: true, side: T.DoubleSide });
  const soft = (color, opacity) => basic(color, { transparent: true, opacity, depthWrite: false });
  const mats = {
    post: std(POST_COLOR), outlet: std(OUTLET_COLOR),
    cap0: basic(TEAM[0]), cap1: basic(TEAM[1]), capDark: basic(GREY),
    rail0: basic(TEAM[0]), rail1: basic(TEAM[1]), railDark: basic(GREY),
    high0: basic(TEAM[0]), high1: basic(TEAM[1]),
    shadow: soft('#303f48', 0.35),
    tint0: soft(TEAM[0], 0.16), tint1: soft(TEAM[1], 0.16),
    peg0: basic(TEAM[0]), peg1: basic(TEAM[1]),
  };
  const sparkMat = basic('#f25745');
  const meshes = new Map();
  let sparks = null, sig = '', lastTick = -1e9, sparkSpots = [];

  function clearMeshes() {
    for (const m of meshes.values()) { root.remove(m); m.geometry.dispose(); }
    meshes.clear();
    if (sparks) { root.remove(sparks); sparks.geometry.dispose(); sparks = null; }
  }
  function rebuild(view) {
    clearMeshes();
    const prims = stationPrims(view, side);
    for (const [mat, tris] of primTriangles(prims)) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(tris, 3));
      g.computeVertexNormals();
      const m = new T.Mesh(g, mats[mat]);
      m.name = `power-${mat}`; m.frustumCulled = false;
      m.castShadow = mat === 'post'; m.receiveShadow = false;
      if (mat.startsWith('tint') || mat === 'shadow') m.renderOrder = 1;
      root.add(m); meshes.set(mat, m);
    }
    sparkSpots = prims.sparks;
    if (sparkSpots.length) {
      const t = [];
      for (const s of sparkSpots) for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5;
        t.push(s.x, s.h, s.y, s.x + Math.cos(a) * 0.5, s.h + 0.25, s.y + Math.sin(a) * 0.5, s.x + Math.cos(a + 0.3) * 0.3, s.h + 0.12, s.y + Math.sin(a + 0.3) * 0.3);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(t, 3));
      sparks = new T.Mesh(g, sparkMat); sparks.name = 'power-sparks'; sparks.frustumCulled = false;
      root.add(sparks);
    }
  }

  return {
    name: 'power-stations', root, meshes,
    update(frame) {
      const state = getState?.();
      if (!state?.power) return;
      if (state.tick - lastTick >= REFRESH_TICKS || state.tick < lastTick) {
        lastTick = state.tick;
        const view = layerView(state, side);
        const s = JSON.stringify([view.posts.map((p) => [p.id, p.x, p.y, p.lit]), view.wires, view.overhead, view.fenced, view.pegs.map((p) => [p.x, p.y])]);
        if (s !== sig) { sig = s; rebuild(view); }
      }
      // Gentle life: live rails and caps pulse a little; sparks flash on and off on browned-out fences.
      const t = (state.tick + (frame?.alpha ?? 0)) / 24;
      const pulse = mix(0.82, 1, 0.5 + 0.5 * Math.sin(t * 5));
      for (const [k, team] of [['rail0', 0], ['rail1', 1], ['cap0', 0], ['cap1', 1]]) mats[k].color.set(TEAM[team]).multiplyScalar(pulse);
      if (sparks) sparks.visible = Math.sin(t * 31) > -0.2;
    },
    dispose() {
      clearMeshes();
      ctx.scene.remove(root);
      for (const m of Object.values(mats)) m.dispose();
      sparkMat.dispose();
    },
  };
}
