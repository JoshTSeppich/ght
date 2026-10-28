// Toaster Wars buildings as blocky toys (owner: sonnet, Playable Client): the Power Strip (the base), the Mill, the Well and
// the Toaster. Cream and charcoal blocks, five-sided rounds, a team-colour block on each, and cute faces where a toaster
// would have one. Same palette and proportions as the units (play/toaster-models.mjs), so a base reads as one family.
// The materials are shared (one set per THREE namespace, not per building) and the boxes carry the toy edge band
// (play/toy-render.mjs applyToyEdges). Every body has a soft contact decal under it.
// viewer3d/buildings.mjs asks for these through ctx.buildingLook(THREE, kind, owner) and falls back to its own builders
// for anything this returns null for (Assembly Line, Heat Lamp).
//
//   buildToasterBody(T, kind, owner) -> { kind, body, spin, pulse, head, furnace, muzzle, barrels, stackTop, tick(clock, dt) } | null
//   toasterBuildingLook = buildToasterBody   (the ctx hook)
//   toasterBuildingMaterials(T)               the shared material set (exported for tests)
// Units here are tiles; a model sits on y = 0 and stays inside about 1.4 tiles (the Power Strip is 3.0 wide).
import { COLORS } from './toaster-models.mjs';
import { TOY_MATERIALS, applyToyEdges, contactMaterial, shareObject, retainObject, toyLookOn } from './toy-render.mjs';

export const TOASTER_BUILDING_KINDS = Object.freeze(['core', 'mill', 'well', 'toaster']);
const TEAM = [COLORS.cyan, COLORS.orange];
const WATER = '#4aa8d8';

/**
 * Every live Mill, Well and Toaster body, so play/bread-life.mjs can switch its work on and off (parts.act, 0..1) without
 * touching viewer3d/buildings.mjs. Entries leave the set when their body is taken out of the scene.
 */
export const LIVE_BODIES = new Set();

// One material set per THREE namespace: every building of every kind and owner draws from these. Reference-counted
// (shareObject / retainObject in toy-render.mjs), so a destroyed building frees only what no other body still uses.
const shared = new WeakMap();
export function toasterBuildingMaterials(T) {
  let s = shared.get(T);
  if (s) return s;
  const satin = (name, color, t) => {
    const m = new T.MeshStandardMaterial({ color: new T.Color(color), roughness: t.roughness, metalness: t.metalness });
    m.name = name;
    return shareObject(applyToyEdges(m, { THREE: T }).material);
  };
  const glow = (name, color) => { const m = new T.MeshBasicMaterial({ color: new T.Color(color) }); m.toneMapped = false; m.name = name; return shareObject(m); };
  s = {
    chassis: satin('toy-chassis', COLORS.chassis, TOY_MATERIALS.chassis),
    faceplate: satin('toy-faceplate', COLORS.faceplate, TOY_MATERIALS.faceplate),
    feet: satin('toy-feet', COLORS.feet, TOY_MATERIALS.feet),
    toast: satin('toy-toast', COLORS.toast, TOY_MATERIALS.toast),
    heat: satin('toy-heat', COLORS.heat, TOY_MATERIALS.chassis),
    team: TEAM.map((c, i) => satin(`toy-team-${i}`, c, TOY_MATERIALS.team)),
    eye: glow('toy-eye', COLORS.eye),
    water: glow('toy-water', WATER),
    decal: contactMaterial(T),
    decalGeo: shareObject(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
  };
  shared.set(T, s);
  return s;
}

// A box with the toy edge band: a unit box, scaled to size, with each vertex carrying the half-extents (aHalf).
function toyBox(T, parent, name, w, h, d, material, x, y, z) {
  const geo = new T.BoxGeometry(1, 1, 1);
  const n = geo.attributes.position.count, half = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) half.set([w / 2, h / 2, d / 2], i * 3);
  geo.setAttribute('aHalf', new T.BufferAttribute(half, 3));
  const m = new T.Mesh(geo, material);
  m.name = name; m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}

// ?toy=0: the old look, plain satin-less materials and no decal or edge band (one set per body, as before).
function plainBuildingMaterials(T, owner) {
  const plain = (color) => new T.MeshStandardMaterial({ color: new T.Color(color), roughness: 0.78, metalness: 0.02 });
  const glow = (color) => { const m = new T.MeshBasicMaterial({ color: new T.Color(color) }); m.toneMapped = false; return m; };
  const team = TEAM.map((c) => plain(c));
  return {
    chassis: plain(COLORS.chassis), faceplate: plain(COLORS.faceplate), feet: plain(COLORS.feet), toast: plain(COLORS.toast),
    heat: plain(COLORS.heat), team, eye: glow(COLORS.eye), water: glow(WATER), decal: null, decalGeo: null,
  };
}

export function buildToasterBody(T, kind, owner) {
  if (!TOASTER_BUILDING_KINDS.includes(kind)) return null;
  const body = new T.Group();
  const parts = { kind, body, spin: [], pulse: [], head: null, furnace: null, muzzle: null, barrels: [], tick: null, act: 0 };
  if (kind !== 'core') LIVE_BODIES.add(parts);
  const toy = toyLookOn();
  const M = toy ? toasterBuildingMaterials(T) : plainBuildingMaterials(T, owner);
  const team = M.team[owner] ?? M.team[0];
  const add = (parent, name, geo, material, x, y, z) => {
    const m = new T.Mesh(geo, material);
    m.name = name; m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  };
  const box = (parent, name, w, h, d, material, x, y, z) => (toy ? toyBox(T, parent, name, w, h, d, material, x, y, z)
    : add(parent, name, new T.BoxGeometry(w, h, d), material, x, y, z));
  const eyes = (parent, y, z, spread, size, faceW) => {
    const plate = box(parent, 'face', faceW, size * 2.2, 0.02, M.faceplate, 0, y, z);
    for (const s of [-1, 1]) add(parent, s < 0 ? 'eye-left' : 'eye-right', new T.BoxGeometry(size * 0.75, size, 0.02), M.eye, s * spread, y + size * 0.1, z + 0.014);
    return plate;
  };
  // the soft contact decal under the body: one shared material, one plane per body (RENDERING.md part 2)
  const decal = (w, d) => {
    if (!toy) return null;
    const m = new T.Mesh(M.decalGeo, M.decal);
    m.name = 'contact'; m.scale.set(w * 1.12, 1, d * 1.12); m.position.y = 0.012; m.renderOrder = 2; m.castShadow = false; m.receiveShadow = false;
    body.add(m); return m;
  };

  if (kind === 'core') {
    // Power Strip, the base: 3.0 x 0.7 x 1.3 tiles. A cream satin bar on four dark feet, a tall charcoal socket rail across
    // the back with five raised sockets, a team-colour stripe along the whole front edge of the top, a face on the front,
    // and a team plug (block body, two charcoal prongs) on each front corner. A cord loop out the left end.
    decal(3.0, 1.3);
    box(body, 'strip', 3.0, 0.46, 1.3, M.chassis, 0, 0.33, 0);
    for (const sx of [-1.3, 1.3]) for (const sz of [-0.5, 0.5]) box(body, 'foot', 0.18, 0.1, 0.18, M.feet, sx, 0.05, sz);
    // charcoal back wall, 0.5 tall and the full width, with five big team-colour socket blocks on its face
    box(body, 'socket-rail', 2.9, 0.5, 0.3, M.faceplate, 0, 0.81, -0.4);
    const sockets = new T.Group(); sockets.name = 'sockets'; body.add(sockets);
    for (let i = 0; i < 5; i++) box(sockets, `socket-${i}`, 0.4, 0.34, 0.12, team, -1.08 + i * 0.54, 0.8, -0.2);
    box(body, 'team-stripe', 3.0, 0.04, 0.26, team, 0, 0.58, 0.52);
    box(body, 'flag-pole', 0.06, 1.1, 0.06, M.faceplate, -1.42, 0.7, -0.05);
    box(body, 'flag', 0.5, 0.3, 0.04, team, -1.14, 1.05, -0.05);
    eyes(body, 0.34, 0.655, 0.4, 0.13, 1.2);
    const plugs = [-1.28, 1.28].map((x, i) => {
      // viewer3d/buildings.mjs pulses with obj.scale.set(k, 1, k), which would replace a box's own size scale (the plug grew to
      // a one-tile cyan slab). So the pulse drives a wrapper group and the plug box keeps its size inside it.
      const pulse = new T.Group(); pulse.name = `plug-pulse-${i}`; pulse.position.set(x, 0.66, 0.3); body.add(pulse);
      const p = box(pulse, `team-plug-${i}`, 0.3, 0.2, 0.3, team, 0, 0, 0);
      for (const [n, dx] of [['a', -0.07], ['b', 0.07]]) box(body, `prong-${i}-${n}`, 0.05, 0.05, 0.12, M.faceplate, x + dx, 0.66, 0.5);
      parts.pulse.push({ obj: pulse, base: 1, amp: 0.12, speed: 2.4 + i * 0.4 });
      return p;
    });
    parts.plugs = plugs;
    const cord = add(body, 'cord', new T.TorusGeometry(0.26, 0.05, 5, 10, Math.PI * 1.6), M.faceplate, -1.52, 0.34, -0.1);
    cord.rotation.set(0, Math.PI / 2, 0);
  } else if (kind === 'mill') {
    // Tall grain tower: the broad gold hopper and charcoal door survive play zoom.
    decal(1.3, 1.1);
    const tw = new T.Group(); tw.name = 'mill-tower'; body.add(tw);
    box(tw, 'tower', 0.78, 1.7, 0.78, M.chassis, 0, 0.85, 0);
    box(tw, 'hopper', 1.3, 0.5, 1.1, M.toast, 0, 1.95, 0);
    box(tw, 'door', 0.44, 0.78, 0.04, M.faceplate, 0, 0.39, 0.41);
    box(tw, 'team', 0.3, 0.26, 0.04, team, 0, 1.2, 0.41);
  } else if (kind === 'well') {
    // Low open basin: four charcoal rim blocks leave the blue top inset exposed.
    decal(1.5, 1.14);
    box(body, 'ring', 1.5, 0.4, 0.12, M.faceplate, 0, 0.2, 0.51);
    box(body, 'rim-back', 1.5, 0.4, 0.12, M.faceplate, 0, 0.2, -0.51);
    for (const x of [-0.69, 0.69]) box(body, 'rim-side', 0.12, 0.4, 0.9, M.faceplate, x, 0.2, 0);
    box(body, 'basin', 1.5, 0.2, 1.02, M.chassis, 0, 0.1, 0);
    const water = box(body, 'water', 1.3, 0.08, 0.9, M.water, 0, 0.32, 0);
    water.castShadow = false;
    box(body, 'team', 0.3, 0.12, 0.03, team, 0, 0.2, 0.585);
  } else if (kind === 'toaster') {
    // Wide barracks: two broad dark slots with golden toast above the cream body.
    decal(1.2, 0.75);
    box(body, 'toaster', 1.2, 0.55, 0.75, M.chassis, 0, 0.355, 0);
    for (const x of [-0.36, 0.36]) box(body, 'foot', 0.18, 0.08, 0.5, M.feet, x, 0.04, 0);
    const toasts = [];
    for (const [name, z] of [['toast-left', -0.16], ['toast-right', 0.16]]) {
      box(body, `slot-${name}`, 0.74, 0.04, 0.18, M.faceplate, 0, 0.65, z);
      toasts.push(box(body, name, 0.66, 0.75, 0.08, M.toast, 0, 0.975, z));
    }
    box(body, 'team', 0.35, 0.14, 0.04, team, 0, 0.36, 0.395);
    const rest = toasts.map((t) => t.position.y);
    // idle: a slow bob. Baking: the slices pop up sharply every 1.2 s, one after the other (GPT's popSeconds 0.18).
    parts.tick = (clock) => toasts.forEach((t, i) => {
      const bob = 0.5 + 0.5 * Math.sin(clock * 1.6 + i * Math.PI);
      const ph = ((clock + i * 0.3) % 1.2) / 0.18, pop = ph < 1 ? Math.sin(Math.PI * ph) : 0;
      t.position.y = rest[i] + 0.07 * bob * (1 - parts.act) + 0.16 * pop * parts.act;
    });
    parts.stackTop = new T.Vector3(0, 1.35, 0);
  }
  // one count per mesh, matching what viewer3d/buildings.mjs disposeRecord releases when this body goes (toy look only)
  if (toy) body.traverse((o) => {
    if (!o.isMesh) return;
    for (const x of [o.geometry, ...[].concat(o.material)]) if (x?.userData && 'refs' in x.userData) retainObject(x);
  });
  return parts;
}

export const toasterBuildingLook = buildToasterBody;
