// Forge shapes: the geometry vocabulary recipes are written in (owner: Claude, Character Forge). Every shape is centred on its
// own origin, sized by `size` [w, h, d] in model units, and built at a detail level: 'game' (the RTS camera, a few hundred
// to a few thousand triangles per unit) or 'hero' (promo close-ups, roughly 3x).
//
//   makeShape(THREE, spec, detail) -> BufferGeometry      spec = { shape, size, r?, sides?, profile?, ... }
//   SHAPES = the shape names below, so tests and the studio can list them.
//
// rbox      rounded box (bevel radius r, the toy look)        capsule   pill along y
// ball      sphere (ellipsoid via size)                        cyl       cylinder (sides, rounded top/bottom not modelled)
// cone      cone / pyramid (sides; flip = tip down)            torus     ring in the xz plane (r = tube radius share)
// bell      lathe of a ghost-bell profile (sides 5 = faceted porcelain, 24 = smooth)
// lathe     lathe of any profile [[radius, y], ...] in unit space (0..1 height, radius share of width)
// wedge     a box with a sloped top (front lower than back), for roofs, toast tips, hoods
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const SHAPES = Object.freeze(['rbox', 'capsule', 'ball', 'cyl', 'cone', 'torus', 'bell', 'lathe', 'wedge']);
const DETAIL = { game: 1, hero: 2.2 };
// the porcelain spirit: a five-sided crystal, angular taper (GPT gpt-038: no onion curves)
const BELL = [[0, 0], [0.34, 0], [0.5, 0.2], [0.5, 0.52], [0.3, 0.84], [0, 1]];

export function makeShape(THREE, spec, detail = 'game') {
  const k = DETAIL[detail] ?? 1;
  const [w, h, d] = spec.size;
  const seg = (n) => Math.max(3, Math.round(n * k));
  let g;
  switch (spec.shape) {
    case 'rbox': {
      // faceted designer toys (GPT gpt-038): one bevel segment, a small bevel, the primary planes stay visible
      const r = Math.min(spec.r ?? 0.05, 0.12 * Math.min(w, h, d), w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
      g = new RoundedBoxGeometry(w, h, d, spec.bevel ?? (k > 1 ? 3 : 2), Math.max(1e-3, r));   // flat-shaded: a chamfer that catches light
      break;
    }
    case 'capsule': {
      const r = Math.min(w, d) / 2;
      g = new THREE.CapsuleGeometry(r, Math.max(0.001, h - 2 * r), spec.capSeg ?? 2, spec.sides ?? 6);
      g.scale(w / (2 * r), 1, d / (2 * r));
      break;
    }
    case 'ball': g = new THREE.SphereGeometry(0.5, seg(14), seg(10)); g.scale(w, h, d); break;
    case 'cyl': g = new THREE.CylinderGeometry(0.5, 0.5, 1, spec.sides ?? seg(14), 1); g.scale(w, h, d); break;
    case 'cone': g = new THREE.ConeGeometry(0.5, 1, spec.sides ?? seg(12), 1); g.scale(w, h, d); if (spec.flip) g.rotateX(Math.PI); break;
    case 'torus': g = new THREE.TorusGeometry(0.5 - (spec.r ?? 0.12) / 2, (spec.r ?? 0.12) / 2, seg(8), seg(18)); g.rotateX(Math.PI / 2); g.scale(w, h / Math.max(1e-3, spec.r ?? 0.12), d); break;
    case 'bell':
    case 'lathe': {
      const prof = (spec.shape === 'bell' ? BELL : spec.profile).map(([r, y]) => new THREE.Vector2(Math.max(0, r), y - 0.5));
      const angular = spec.angular ?? (spec.sides && spec.sides <= 8);   // faceted: piecewise-linear, decisive silhouette changes
      g = new THREE.LatheGeometry(angular ? prof : smooth(THREE, prof, seg(2)), spec.sides ?? seg(20));
      g.scale(w, h, d);
      if (spec.sides && spec.sides <= 8) g.rotateY(Math.PI / spec.sides);   // put a flat facet toward the camera
      break;
    }
    case 'wedge': {
      g = new RoundedBoxGeometry(w, h, d, seg(2), Math.min(spec.r ?? 0.04, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
      const pos = g.attributes.position, slope = spec.slope ?? 0.5;
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), z = pos.getZ(i); if (y > 0) pos.setY(i, y - (z / d + 0.5) * slope * h); }
      g.computeVertexNormals();
      break;
    }
    default: throw new Error(`forge: unknown shape "${spec.shape}" (shapes: ${SHAPES.join(', ')})`);
  }
  return g;
}

// Catmull-Rom smoothing of a lathe profile so a handful of control points gives a rounded silhouette.
function smooth(THREE, pts, per) {
  if (pts.length < 3) return pts;
  const curve = new THREE.SplineCurve(pts);
  return curve.getPoints((pts.length - 1) * per);
}
