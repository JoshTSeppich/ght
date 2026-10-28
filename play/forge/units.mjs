// Forge units renderer (owner: Claude, Character Forge): draws baked characters (play/forge/bake.mjs) as instanced
// segments, one InstancedMesh per (character, pivot), all sharing ONE material: vertex colours, a per-instance team colour
// mixed in where aTeam = 1, and self-lit where aEmit = 1. Poses come from the archetype (walk, bob, sway, party, wheels),
// so a new character animates the moment its recipe exists. Presentation only: nothing here touches the sim.
//
//   createForgeUnits(THREE, scene, { scale }) -> { add(baked), has(id), begin(), emit(unit), end(), dispose(), root, stats() }
//   unit = { id, x, y?, z (world), yaw, team, t (s), moving, attacking, phase, blink? }

const TEAM = ['#31D5F5', '#FF6B53', '#F6D65A', '#AD90F5'];

export function forgeMaterial(THREE) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05 });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTeam;\nattribute float aEmit;\nattribute vec3 iTeam;\nvarying float vEmit;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n  vColor.rgb = mix(vColor.rgb, iTeam, aTeam);\n  vEmit = aEmit;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEmit;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vEmit * 0.55;');
  };
  m.customProgramCacheKey = () => 'forge-v1';
  return m;
}

// Archetype poses: pivot -> { rx, rz, dy } about the pivot's hinge, plus a whole-body bob.
export const POSES = {
  human: {
    bob: (u) => (u.moving ? Math.abs(Math.sin(u.t * 8 + u.phase)) * 0.05 : u.attacking ? Math.abs(Math.sin(u.t * 7.5)) * 0.07 : 0),
    pose(pivot, u) {
      const w = u.moving ? Math.sin(u.t * 8 + u.phase) * 0.6 : 0, party = u.attacking && !u.moving, beat = Math.sin(u.t * 7.5 + u.phase);
      switch (pivot) {
        case 'legL': return { rx: w };
        case 'legR': return { rx: -w };
        case 'armL': return party ? { rx: -2.6 + beat * 0.4 } : { rx: -w * 0.8 };
        case 'armR': return u.attacking ? { rx: -1.3 - Math.max(0, beat) * 0.5 } : { rx: w * 0.8 };
        case 'head': return { rx: party ? beat * 0.12 : Math.sin(u.t * 1.5 + u.phase) * 0.06 };
        case 'body': return party ? { rz: beat * 0.08 } : null;
        default: return null;
      }
    },
  },
  ghost: {
    bob: (u) => Math.sin(u.t * 2.2 + u.phase) * 0.07,
    pose(pivot, u) {
      const s = Math.sin(u.t * 4 + u.phase) * 0.35;
      if (pivot === 'tendrilL') return { rx: s };
      if (pivot === 'tendrilR') return { rx: -s };
      if (pivot === 'body' && u.attacking) return { rx: -0.22 * Math.max(0, Math.sin(u.t * 5)) };
      return null;
    },
  },
  toaster: {
    bob: (u) => (u.moving ? Math.abs(Math.sin(u.t * 9)) * 0.025 : 0),
    pose(pivot, u) {
      if (pivot.startsWith('axle')) return { rx: u.moving ? u.t * 9 : 0 };
      if (pivot === 'toast') return { dy: u.attacking ? Math.max(0, Math.sin(u.t * 6)) * 0.22 : 0 };
      return null;
    },
  },
  lantern: { bob: () => 0, pose: () => null },
};

export function createForgeUnits(THREE, scene, { scale = 0.9, capacity = 64 } = {}) {
  const root = new THREE.Group();
  root.name = 'forge-units';
  scene.add(root);
  const material = forgeMaterial(THREE);
  const kinds = new Map();
  const teams = TEAM.map((c) => new THREE.Color(c));

  function makeMesh(seg, cap) {
    const geo = seg.geometry;
    const mesh = new THREE.InstancedMesh(geo, material, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const iTeam = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    iTeam.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iTeam', iTeam);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0;
    return { mesh, iTeam, cap };
  }
  function add(baked) {
    if (kinds.has(baked.id)) remove(baked.id);
    const k = { baked, used: 0, segs: baked.segments.map((s) => ({ ...s, ...makeMesh(s, capacity) })) };
    for (const s of k.segs) root.add(s.mesh);
    kinds.set(baked.id, k);
  }
  function remove(id) {
    const k = kinds.get(id);
    if (!k) return;
    for (const s of k.segs) { root.remove(s.mesh); s.mesh.dispose(); s.geometry.dispose(); }
    kinds.delete(id);
  }
  function grow(k) {
    for (const s of k.segs) {
      const old = s.mesh, cap = s.cap * 2;
      const next = makeMesh(s, cap);
      next.mesh.instanceMatrix.array.set(old.instanceMatrix.array);
      next.iTeam.array.set(s.iTeam.array);
      root.remove(old); old.dispose();
      Object.assign(s, next); root.add(s.mesh);
    }
  }

  const U = new THREE.Matrix4(), M = new THREE.Matrix4(), S = new THREE.Matrix4(), R = new THREE.Matrix4(), B = new THREE.Matrix4();
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  const swing = (out, h, { rx = 0, rz = 0, dy = 0 }) =>
    out.makeTranslation(h[0], h[1] + dy, h[2]).multiply(R.makeRotationFromEuler(e.set(rx, 0, rz))).multiply(S.makeTranslation(-h[0], -h[1], -h[2]));

  function begin() { for (const k of kinds.values()) k.used = 0; }
  function emit(u) {
    const k = kinds.get(u.id);
    if (!k) return false;
    if (k.used >= k.segs[0].cap) grow(k);
    const i = k.used++;
    const P = POSES[k.baked.base] ?? POSES.lantern;
    const st = { t: u.t ?? 0, phase: u.phase ?? 0, moving: !!u.moving, attacking: !!u.attacking };
    U.compose(v.set(u.x, (u.y ?? 0) + P.bob(st) * scale, u.z), q.setFromEuler(e.set(0, u.yaw ?? 0, 0)), s3.setScalar(scale));
    const bodyPose = P.pose('body', st);
    if (bodyPose) U.multiply(swing(B, k.baked.segments.find((s) => s.pivot === 'body')?.hinge ?? [0, k.baked.height / 2, 0], bodyPose));
    const team = teams[(u.team ?? 0) % teams.length];
    for (const s of k.segs) {
      const pose = s.pivot === 'body' ? null : P.pose(s.pivot, st);
      if (pose) M.multiplyMatrices(U, swing(B, s.hinge, pose)); else M.copy(U);
      s.mesh.setMatrixAt(i, M);
      s.iTeam.setXYZ(i, team.r, team.g, team.b);
    }
    return true;
  }
  function end() {
    for (const k of kinds.values()) for (const s of k.segs) { s.mesh.count = k.used; s.mesh.instanceMatrix.needsUpdate = true; s.iTeam.needsUpdate = true; }
  }
  function stats() {
    let draws = 0, tris = 0;
    for (const k of kinds.values()) if (k.used) { draws += k.segs.length; tris += k.used * k.baked.tris; }
    return { kinds: kinds.size, draws, tris };
  }
  function dispose() { for (const id of [...kinds.keys()]) remove(id); material.dispose(); scene.remove(root); }
  return { add, remove, has: (id) => kinds.has(id), begin, emit, end, dispose, root, stats };
}
