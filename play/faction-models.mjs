// Ghosters and Hosters as DATA (author: GPT, art director, AMP gpt-031/032; integrated by Claude). Same format as
// play/toaster-models.mjs: pure data and pure maths, no Three.js, checked in node by tests/faction-models.test.mjs.
// Model units: CRUMB width = 1, ground at y = 0, front faces +Z. The renderer owns meshes and team colours.
//
//   GHOSTERS[id] / HOSTERS[id] = { id, top, height, radius, hover, body: {w,h,d,lift}, wheels: null, parts: [part] }
//   part = { id, part, pivot, geo, size, pos, hinge, eye?, flipY? }
//   part  = batch: porcelain | ghost-eye | wisp (Ghosters); jacket | skin | pants | hat | prop | prop-glow (Hosters)
//   pivot = Ghosters body | tendrilL | tendrilR;  Hosters body | head | legL | legR | armL | armR (the gear rides armR)
//   hinge = the point (model units) the pivot swings about
//   geo   = box | plane | cone5 (five-sided cone, axis y, tip up; flipY = tip down) | prism5 (five-sided prism, axis y)
//           size is the bounding box. Ghosters float (hover); Hosters stand on y = 0.
//
// Integration fixes over the transferred draft (its sha256 did not match what arrived, so it was re-checked by hand):
// leg-r sat at the hip and stuck out the front (now mirrors leg-l); the ghost shell gets a cone5 cap so it tapers like
// the art; tendrils hang tip-down; kindOf's toaster fallback returns the real lowercase id 'crumb'.

export const GEO_TRIS = Object.freeze({ box: 12, plane: 2, tyre: 20, prism: 20, cone5: 10, prism5: 20 });

export const FACTION_COLORS = Object.freeze({
  toasters: { body: '#E6CCA0', face: '#31363E', toast: '#F0B647' },
  ghosters: { body: '#364568', shadow: '#273352', eyes: '#A6E8D6', haunt: '#7960AD' },
  hosters: { jacket: '#C35D51', pants: '#353A48', skin: '#E5B75B', accent: '#E5B75B' },
  teamAccents: ['#31D5F5', '#FF6B53', '#F6D65A', '#AD90F5'],
});

const P = (id, part, pivot, geo, size, pos, hinge, extra = {}) =>
  ({ id, part, pivot, geo, size, pos, ...(hinge ? { hinge } : {}), ...extra });

// ---------------------------------------------------------------------------------------------------------------
// Ghosters: a five-sided porcelain shell with a pointed cap, two hanging wisp tendrils, a glowing eye band.
// ---------------------------------------------------------------------------------------------------------------
function ghost(id, height, width, hover, reach, extras = []) {
  const center = hover + height * 0.5;
  const shellH = height * 0.62, capH = height * 0.3;
  const shellY = hover + height * 0.18 + shellH / 2;
  return {
    id, top: hover + height, height, radius: width * 0.55, hover,
    body: { w: width, h: height, d: width * 0.75, lift: hover }, wheels: null,
    parts: [
      P('shell', 'porcelain', 'body', 'prism5', [width, shellH, width * 0.85], [0, shellY, 0], [0, center, 0]),
      P('cap', 'porcelain', 'body', 'cone5', [width, capH, width * 0.85], [0, shellY + shellH / 2 + capH / 2, 0], [0, center, 0]),
      P('tail-l', 'wisp', 'tendrilL', 'cone5', [width * 0.36, height * 0.42, width * 0.36],
        [-width * 0.2, hover + height * 0.04, 0], [-width * 0.2, hover + height * 0.22, 0], { flipY: true }),
      P('tail-r', 'wisp', 'tendrilR', 'cone5', [width * 0.36, height * 0.42, width * 0.36],
        [width * 0.2, hover + height * 0.04, 0], [width * 0.2, hover + height * 0.22, 0], { flipY: true }),
      P('eyes', 'ghost-eye', 'body', 'plane', [width * 0.52, height * 0.16, 0],
        [0, shellY + shellH * 0.15, width * 0.43], [0, center, 0], { eye: true }),
      ...extras,
    ],
    attackReach: reach,
  };
}

export const GHOSTERS = Object.freeze({
  wisp: ghost('wisp', 1.12, 0.76, 0.28, 1.0),
  shade: ghost('shade', 1.0, 0.93, 0.20, 0.8),
  phantom: ghost('phantom', 1.32, 0.73, 0.36, 3.0),
  lantern: {
    id: 'lantern', top: 1.18, height: 1.18, radius: 0.48, hover: 0,
    body: { w: 0.68, h: 0.95, d: 0.68, lift: 0 }, wheels: null,
    parts: [
      P('base', 'porcelain', 'body', 'box', [0.68, 0.18, 0.68], [0, 0.09, 0], [0, 0, 0]),
      P('column', 'porcelain', 'body', 'prism5', [0.48, 0.77, 0.48], [0, 0.565, 0], [0, 0.18, 0]),
      P('light', 'ghost-eye', 'body', 'box', [0.36, 0.22, 0.36], [0, 1.055, 0], [0, 0.18, 0]),
    ],
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Hosters: real humans. Torso, head, two legs and two thin arms (GPT gpt-034: "humans must read as humans at gameplay
// zoom"; Hoster budget 76). The gear is a small plane held in the right hand, so it swings with the arm. The Host wears a
// box top hat (a rectangular crown, not a party cone) and is the one hero-budget model.
function human(id, opts = {}) {
  const { h = 1.35, w = 0.66, hat = false, equipment = 'clipboard', bulky = false } = opts;
  const legH = h * 0.37, torsoH = h * 0.36, headH = h * 0.23;
  const torsoY = legH + torsoH / 2, headY = legH + torsoH + headH / 2;
  const depth = bulky ? 0.50 : 0.40;
  const armW = w * 0.2, armH = torsoH * 1.05, shoulderY = legH + torsoH * 0.95, armX = w / 2 + armW / 2;
  const p = [
    P('torso', 'jacket', 'body', 'box', [w, torsoH, depth], [0, torsoY, 0], [0, torsoY, 0]),
    P('head', 'skin', 'head', 'box', [w * 0.65, headH, depth * 0.8], [0, headY, 0], [0, legH + torsoH, 0]),
    P('leg-l', 'pants', 'legL', 'box', [w * 0.30, legH, depth * 0.8], [-w * 0.22, legH / 2, 0], [-w * 0.22, legH, 0]),
    P('leg-r', 'pants', 'legR', 'box', [w * 0.30, legH, depth * 0.8], [w * 0.22, legH / 2, 0], [w * 0.22, legH, 0]),
    P('arm-l', 'jacket', 'armL', 'box', [armW, armH, depth * 0.55], [-armX, shoulderY - armH / 2, 0], [-armX, shoulderY, 0]),
    P('arm-r', 'jacket', 'armR', 'box', [armW, armH, depth * 0.55], [armX, shoulderY - armH / 2, 0], [armX, shoulderY, 0]),
    P(equipment, equipment === 'megaphone' ? 'prop-glow' : 'prop', 'armR', 'plane',
      [w * 0.36, 0.3, 0], [armX, shoulderY - armH * 0.95, depth * 0.32], [armX, shoulderY, 0]),
  ];
  if (hat) {
    const crownH = headH * 0.85;
    p.push(P('top-hat', 'hat', 'head', 'box', [w * 0.6, crownH, depth * 0.72], [0, headY + headH / 2 + crownH / 2, 0], [0, legH + torsoH, 0]));
  }
  return {
    id, top: h + (hat ? headH * 0.85 : 0), height: h, radius: w * 0.65, hover: 0,
    body: { w, h: torsoH, d: depth, lift: legH }, wheels: null, budget: hat ? 90 : 76,
    parts: p,
  };
}

export const HOSTERS = Object.freeze({
  host: human('host', { h: 1.44, hat: true, equipment: 'clipboard' }),
  corkshot: human('corkshot', { h: 1.30, equipment: 'cork-launcher' }),
  'confetti-bomber': human('confetti-bomber', { h: 1.30, equipment: 'party-popper' }),
  bouncer: human('bouncer', { h: 1.41, w: 0.87, bulky: true, equipment: 'badge' }),
  dj: human('dj', { h: 1.31, equipment: 'record' }),
  'hype-captain': human('hype-captain', { h: 1.36, equipment: 'megaphone' }),
});

const ALIASES = Object.freeze({
  ghost: 'wisp', ghost_wisp: 'wisp', ghost_shade: 'shade', ghost_phantom: 'phantom',
  haunted_lantern: 'lantern', ghost_lantern: 'lantern',
  party_host: 'host', party_guest: 'corkshot', hoster: 'host',
  confetti_bomber: 'confetti-bomber', hype_captain: 'hype-captain',
});

// Compatibility classifier only: snapshots should carry faction and kind explicitly. Unknown Ghoster/Hoster kinds stay
// visibly in-family; anything else is handed back to the Toasters' own lookup (play/toaster-models.mjs toasterKindOf).
export function kindOf(kind) {
  const k = typeof kind === 'string' ? kind.trim().toLowerCase() : '';
  const normalized = ALIASES[k] || k;
  if (Object.hasOwn(GHOSTERS, normalized)) return { faction: 'ghosters', id: normalized };
  if (Object.hasOwn(HOSTERS, normalized)) return { faction: 'hosters', id: normalized };
  if (/^(ghost|wisp|shade|phantom|haunt)/.test(k)) return { faction: 'ghosters', id: 'wisp' };
  if (/^(host|guest|party|dj|cork|bouncer|hype|confetti)/.test(k)) return { faction: 'hosters', id: 'host' };
  return { faction: 'toasters', id: 'crumb' };
}

export const trianglesOf = (model) => model.parts.reduce((n, p) => n + (GEO_TRIS[p.geo] ?? 0), 0);

export function validate(model) {
  const problems = [];
  if (!model || typeof model !== 'object') return ['model missing'];
  if (!Array.isArray(model.parts) || !model.parts.length) return ['parts missing'];
  const isHoster = Object.values(HOSTERS).includes(model), isGhoster = Object.values(GHOSTERS).includes(model);
  for (const p of model.parts) {
    if (!Object.hasOwn(GEO_TRIS, p.geo)) problems.push(`${p.id}: unknown geometry ${p.geo}`);
    if (!Array.isArray(p.hinge) || p.hinge.length !== 3 || !p.hinge.every(Number.isFinite)) problems.push(`${p.id}: missing/invalid hinge`);
    if (!Array.isArray(p.pos) || p.pos.length !== 3 || !p.pos.every(Number.isFinite) ||
        !Array.isArray(p.size) || p.size.length !== 3 || !p.size.every(Number.isFinite)) { problems.push(`${p.id}: invalid position or size`); continue; }
    if (p.size.some((x) => x < 0)) problems.push(`${p.id}: negative size`);
    if (isHoster && p.pos[1] - p.size[1] / 2 < -1e-6) problems.push(`${p.id}: below ground`);
    if (Math.abs(p.pos[0]) > model.radius * 1.6 || Math.abs(p.pos[2]) > model.radius * 1.6) problems.push(`${p.id}: outside the footprint`);
  }
  // Budgets (GPT gpt-034): 60 target for simple units, 76 for Hosters (arms), the Host 90 (hat), 240 ceiling for Toasters.
  const tris = trianglesOf(model), budget = model.budget ?? 60;
  if (tris > budget) problems.push(`triangle budget: ${tris} > ${budget}`);
  if (isGhoster && !(model.hover >= 0)) problems.push('ghost hover missing');
  return problems;
}
