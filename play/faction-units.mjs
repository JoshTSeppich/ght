// One instanced renderer for model DATA from any faction (ENG-101). Takes the pure-data models of play/toaster-models.mjs
// and play/faction-models.mjs (same format) and draws every part through per-batch InstancedMesh, sharing the toy edge
// shader on box parts. The FactionKit table below (ENG-102 seed) says, per faction, how parts are coloured and how pivots
// move; the core loop has no faction conditionals. Presentation only: nothing here reads or writes the sim.
//
//   createFactionUnits(ctx, { scale }) -> { begin(), emit(unit), end(), dispose(), root, draws, KITS }
//   unit = { faction: 'toasters'|'ghosters'|'hosters', model, x, z (world), yaw, team, t (seconds), moving, attacking, phase }
//
// Pivots: each part may carry hinge [x,y,z]; the kit's pose(pivot, unit) returns { rx, rz, dy } applied about that hinge.
// geo: box | plane (size z ignored) | tyre (5-sided, axis x) | prism (5-sided, axis z) | cone5 (axis y, tip up) | prism5.

import * as THREE from 'three';
import { FACTION_COLORS } from './faction-models.mjs';
import { applyToyEdges } from './toy-render.mjs';

const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
const solid = (color, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });

// ---------------------------------------------------------------------------------------------------------------
// FactionKits: materials by part name and a pose function by pivot. Adding a faction = adding an entry here.
// ---------------------------------------------------------------------------------------------------------------
const T = FACTION_COLORS.toasters, G = FACTION_COLORS.ghosters, H = FACTION_COLORS.hosters;
export const KITS = {
  toasters: {
    parts: {
      chassis: () => solid(T.body), faceplate: () => solid(T.face, 0.8), eyes: () => unlit('#12E4FF'), team: 'team',
      feet: () => solid('#303844'), toast: () => solid(T.toast), glow: () => unlit('#FF7A2E'), tyre: () => solid('#303844', 0.8),
      hub: () => solid('#F2D7A6'), prism: () => solid(T.body),
    },
    pose(pivot, u) {
      if (pivot === 'axle') return { rx: u.moving ? u.t * 9 : 0 };
      if (pivot === 'toast') return { dy: u.attacking ? Math.max(0, Math.sin(u.t * 6)) * 0.25 : 0 };
      return null;
    },
    bob: (u) => (u.moving ? Math.abs(Math.sin(u.t * 9)) * 0.03 : 0),
    edges: true,   // big boxes carry the toy edge; on 0.3-tile human and ghost parts it washes the whole face pale
  },
  ghosters: {
    parts: {
      porcelain: () => Object.assign(solid(G.body, 0.28, 0.08), { emissive: new THREE.Color(G.shadow), emissiveIntensity: 0.6 }), 'ghost-eye': () => unlit(G.eyes),
      wisp: () => unlit(G.eyes, { transparent: true, opacity: 0.85 }),
    },
    pose(pivot, u) {
      const s = Math.sin(u.t * 4 + u.phase) * 0.35;
      if (pivot === 'tendrilL') return { rx: s };
      if (pivot === 'tendrilR') return { rx: -s };
      if (pivot === 'body' && u.attacking) return { rx: -0.25 * Math.max(0, Math.sin(u.t * 5)) };
      return null;
    },
    bob: (u) => Math.sin(u.t * 2.2 + u.phase) * 0.06,
  },
  hosters: {
    parts: {
      jacket: () => solid(H.jacket), skin: () => solid(H.skin), pants: () => solid(H.pants), hat: () => solid('#1d1b22'),
      prop: () => solid('#F4F1EA'), 'prop-glow': () => unlit(H.accent),
    },
    pose(pivot, u) {
      const w = u.moving ? Math.sin(u.t * 8 + u.phase) * 0.6 : 0;
      const party = u.attacking && !u.moving, beat = Math.sin(u.t * 7.5 + u.phase);
      if (pivot === 'legL') return { rx: w };
      if (pivot === 'legR') return { rx: -w };
      if (pivot === 'armL') return party ? { rx: -2.6 + beat * 0.4 } : { rx: -w * 0.8 };
      if (pivot === 'armR') return u.attacking ? { rx: -1.4 - Math.max(0, beat) * 0.6 } : { rx: w * 0.8 };   // raise the gear
      if (pivot === 'head') return { rx: party ? beat * 0.12 : Math.sin(u.t * 1.5 + u.phase) * 0.08 };
      if (pivot === 'body' && party) return { rz: beat * 0.1 };   // dancing
      return null;
    },
    bob: (u) => (u.moving ? Math.abs(Math.sin(u.t * 8 + u.phase)) * 0.05 : u.attacking ? Math.abs(Math.sin(u.t * 7.5)) * 0.08 : 0),
  },
};

const GEOS = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  plane: () => new THREE.PlaneGeometry(1, 1),
  tyre: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 5).rotateZ(Math.PI / 2),
  prism: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 5).rotateX(Math.PI / 2),
  cone5: () => new THREE.ConeGeometry(0.5, 1, 5),
  prism5: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 5),
};

export function createFactionUnits(ctx, { scale = 0.9 } = {}) {
  const unitScale = scale * (ctx.tileSize ?? 1);
  const root = new THREE.Group();
  root.name = 'faction-units';
  ctx.scene.add(root);
  const geoCache = {}, matCache = {}, batches = {};
  const geoOf = (g) => (geoCache[g] ??= (GEOS[g] ?? GEOS.box)());

  function materialOf(faction, part) {
    const key = `${faction}:${part}`;
    if (matCache[key]) return matCache[key];
    const make = KITS[faction]?.parts?.[part];
    let m;
    if (make === 'team') m = solid('#ffffff');                         // tinted per instance with the team accent
    else if (typeof make === 'function') m = make();
    else { m = solid('#ff00ff'); console.warn(`[faction-units] no material for ${key}`); }   // loud, never invisible
    if (m.isMeshStandardMaterial && KITS[faction]?.edges) applyToyEdges(m);
    m.side = THREE.DoubleSide;
    return (matCache[key] = m);
  }
  function batchOf(faction, part, geo) {
    const key = `${faction}:${part}:${geo}`;
    if (batches[key]) return batches[key];
    const material = materialOf(faction, part);
    const g = geoOf(geo).clone();
    const b = { key, geo: g, material, mesh: null, cap: 0, used: 0, half: null, team: KITS[faction]?.parts?.[part] === 'team' };
    grow(b, 64);
    return (batches[key] = b);
  }
  function grow(b, cap) {
    const old = b.mesh;
    const mesh = new THREE.InstancedMesh(b.geo, b.material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    const half = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    b.geo.setAttribute('aHalf', half);
    if (old) { mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, b.used * 16)); mesh.instanceColor.array.set(old.instanceColor.array.subarray(0, b.used * 3)); half.array.set(b.half.array.subarray(0, b.used * 3)); root.remove(old); old.dispose(); }
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0; mesh.name = `faction-${b.key}`;
    root.add(mesh);
    b.mesh = mesh; b.cap = cap; b.half = half;
  }

  const U = new THREE.Matrix4(), P = new THREE.Matrix4(), M = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const accents = FACTION_COLORS.teamAccents.map((c) => new THREE.Color(c));

  function begin() { for (const b of Object.values(batches)) b.used = 0; }

  function emit(u) {
    const kit = KITS[u.faction];
    if (!kit || !u.model) return;
    const t = { t: u.t ?? 0, phase: u.phase ?? 0, moving: !!u.moving, attacking: !!u.attacking };
    U.compose(v.set(u.x, (kit.bob?.(t) ?? 0) * unitScale, u.z), q.setFromEuler(e.set(0, u.yaw ?? 0, 0)), s.setScalar(unitScale));
    const bodyPose = kit.pose('body', t);
    for (const part of u.model.parts) {
      // the part's own transform: position, optional tip-down flip, size (planes keep depth 1)
      const sz = part.size;
      P.compose(v.set(...part.pos), q.setFromEuler(e.set(part.flipY ? Math.PI : 0, 0, part.rotZ ?? 0)), s.set(sz[0] || 1, sz[1] || 1, part.geo === 'plane' ? 1 : (sz[2] || 1)));
      // the pivot's swing about its hinge (wheels spin about their own centre), then the body's pose for everything
      const pose = part.pivot === 'body' ? null : kit.pose(part.pivot, t);
      M.copy(P);
      if (pose) M.premultiply(swing(part.pivot === 'axle' ? part.pos : (part.hinge ?? part.pos), pose));
      if (bodyPose) M.premultiply(swing(u.model.parts[0]?.hinge ?? [0, u.model.height / 2, 0], bodyPose));
      M.premultiply(U);
      const b = batchOf(u.faction, part.part, part.geo);
      if (b.used >= b.cap) grow(b, b.cap * 2);
      const i = b.used++;
      b.mesh.setMatrixAt(i, M);
      if (b.team) b.mesh.setColorAt(i, accents[(u.team ?? 0) % accents.length]);
      if (part.geo === 'box') b.half.setXYZ(i, sz[0] / 2, sz[1] / 2, sz[2] / 2); else b.half.setXYZ(i, 0, 0, 0);   // toy edges on boxes only
    }
  }
  function swing(h, { rx = 0, rz = 0, dy = 0 }) {
    tmp.makeTranslation(h[0], h[1] + dy, h[2]);
    tmp.multiply(P2.makeRotationFromEuler(e.set(rx, 0, rz)));
    tmp.multiply(P3.makeTranslation(-h[0], -h[1], -h[2]));
    return tmp.clone();
  }
  const P2 = new THREE.Matrix4(), P3 = new THREE.Matrix4();

  function end() {
    for (const b of Object.values(batches)) {
      b.mesh.count = b.used;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      b.half.needsUpdate = true;
    }
  }
  function dispose() {
    for (const b of Object.values(batches)) { root.remove(b.mesh); b.mesh.dispose(); b.geo.dispose(); }
    for (const m of Object.values(matCache)) m.dispose();
    ctx.scene.remove(root);
  }
  return { begin, emit, end, dispose, root, KITS, get draws() { return Object.values(batches).filter((b) => b.used).length; } };
}
