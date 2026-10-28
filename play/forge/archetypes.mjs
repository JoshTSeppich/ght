// Forge archetypes and accessories (owner: Claude, Character Forge). Pure data: a recipe goes in, a list of parts comes
// out, no Three.js. An archetype is a body plan (toaster, ghost, human, lantern) with named ANCHORS where gear attaches and
// PIVOTS the animator swings; an accessory is a small function that hangs parts on an anchor. A new character is a recipe:
//
//   { id: 'host', faction: 'hosters', base: 'human', height: 1.6, build: 'normal', wear: ['tophat'], hold: 'clipboard',
//     colors: { jacket: '#C35D51' } }
//
//   expand(recipe) -> { id, faction, base, height, hover, pivots: { name: { hinge } }, parts: [part] }
//   part = { shape, size: [w,h,d], at: [x,y,z], rot?: [x,y,z], slot, pivot, ...shape options }
//   slot = a colour name looked up in the recipe colours, then the faction palette; 'team' takes the side's colour,
//          slots in GLOW_SLOTS are drawn self-lit.
// Model units: a Popper's body is ~1.25 wide, ground y = 0, front +Z.

export const GLOW_SLOTS = Object.freeze(['eye', 'glow', 'lamp', 'wisp', 'flare', 'screen']);

export const PALETTES = Object.freeze({
  toasters: { body: '#E6CCA0', face: '#31363E', eye: '#33E6FF', toast: '#F0B647', tyre: '#303844', hub: '#F2D7A6', dark: '#3a3f48', accent: '#D8432F' },
  ghosters: { porcelain: '#5466A8', shade: '#2F3A66', face: '#1C2140', eye: '#A6F2DC', wisp: '#9C86E8', mouth: '#0F1226', accent: '#C9B6FF', lamp: '#D8C8FF', dark: '#262C4C' },
  hosters: {
    skin: '#F2C68E', jacket: '#C35D51', pants: '#353A48', shoes: '#22242C', shirt: '#F4F1EA', hair: '#4A3020', white: '#FFFFFF',
    pupil: '#1A1C22', mouth: '#8E3A30', hat: '#24222E', accent: '#E5B75B', gold: '#E5B75B', bottle: '#2F7A3A', paper: '#F4F1EA',
    board: '#9B6A3C', metal: '#9AA3AD', dark: '#24222E', glass: '#111216', velvet: '#8E1F2C', glow: '#FF6B53', screen: '#31D5F5',
  },
});

const v3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const P = (shape, size, at, slot, pivot, extra = {}) => ({ shape, size, at, slot, pivot, ...extra });
const BUILD = { slim: 0.9, normal: 1, broad: 1.38 };

// ---------------------------------------------------------------------------------------------------------------
// Archetypes
// ---------------------------------------------------------------------------------------------------------------
export const ARCHETYPES = {
  human(r) {
    const H = r.height ?? 1.5, w = H * 0.5 * (BUILD[r.build] ?? 1), d = w * 0.5;
    const legTop = H * 0.34, hipY = H * 0.36, torsoY = H * 0.54, torsoH = H * 0.30, headY = H * 0.83, headH = H * 0.25;
    const sh = H * 0.665, armX = w * 0.5 + w * 0.06;
    const pivots = {
      body: { hinge: [0, hipY, 0] }, head: { hinge: [0, H * 0.7, 0] },
      legL: { hinge: [-w * 0.19, legTop, 0] }, legR: { hinge: [w * 0.19, legTop, 0] },
      armL: { hinge: [-armX, sh, 0] }, armR: { hinge: [armX, sh, 0] },
    };
    const parts = [];
    for (const [s, piv] of [[-1, 'legL'], [1, 'legR']]) {
      parts.push(P('rbox', [w * 0.3, legTop - H * 0.05, d * 0.7], [s * w * 0.19, H * 0.05 + (legTop - H * 0.05) / 2, 0], 'pants', piv, { r: 0.05 }));
      parts.push(P('rbox', [w * 0.32, H * 0.06, d * 0.95], [s * w * 0.19, H * 0.03, d * 0.12], 'shoes', piv, { r: 0.03 }));
    }
    parts.push(P('rbox', [w * 0.74, H * 0.07, d * 0.82], [0, hipY, 0], 'pants', 'body', { r: 0.03 }));
    parts.push(P('rbox', [w * 0.8, torsoH, d * 0.9], [0, torsoY, 0], 'jacket', 'body', { r: 0.09 }));
    if (r.shirt !== false) parts.push(P('rbox', [w * 0.24, torsoH * 0.78, 0.05], [0, torsoY + torsoH * 0.06, d * 0.45], 'shirt', 'body', { r: 0.02 }));
    parts.push(P('cyl', [w * 0.24, H * 0.06, w * 0.24], [0, H * 0.71, 0], 'skin', 'head'));
    parts.push(P('rbox', [w * 0.64, headH, d * 1.1], [0, headY, 0], 'skin', 'head', { r: 0.11 }));
    // the face: big toy eyes (white, pupil, glint), a small smile
    for (const s of [-1, 1]) {
      parts.push(P('ball', [w * 0.13, headH * 0.3, 0.05], [s * w * 0.13, headY + headH * 0.06, d * 0.55], 'white', 'head'));
      parts.push(P('ball', [w * 0.08, headH * 0.2, 0.04], [s * w * 0.13, headY + headH * 0.04, d * 0.58], 'pupil', 'head', { eye: true }));
      parts.push(P('ball', [w * 0.03, headH * 0.06, 0.02], [s * w * 0.13 + w * 0.02, headY + headH * 0.1, d * 0.6], 'white', 'head'));
    }
    parts.push(P('capsule', [w * 0.2, headH * 0.08, 0.04], [0, headY - headH * 0.24, d * 0.56], 'mouth', 'head'));   // a small smile
    for (const [s, piv] of [[-1, 'armL'], [1, 'armR']]) {
      parts.push(P('capsule', [w * 0.2, torsoH * 0.95, w * 0.2], [s * armX, sh - torsoH * 0.42, 0], 'jacket', piv));
      parts.push(P('ball', [w * 0.17, w * 0.17, w * 0.17], [s * armX, sh - torsoH * 0.95, 0], 'skin', piv));
    }
    parts.push(P('rbox', [w * 0.22, torsoH * 0.14, w * 0.23], [-armX, sh - torsoH * 0.3, 0], 'team', 'armL', { r: 0.03 }));   // armband
    const anchors = {
      headTop: { at: [0, headY + headH / 2, 0], pivot: 'head', w: w * 0.64, d: d * 1.1 },
      face: { at: [0, headY + headH * 0.06, d * 0.6], pivot: 'head', w: w * 0.64 },
      handR: { at: [armX, sh - torsoH * 0.95, w * 0.06], pivot: 'armR' },
      back: { at: [0, torsoY, -d * 0.45], pivot: 'body', w: w * 0.8 },
    };
    if (!(r.wear ?? []).some((x) => HEADGEAR.has(x))) parts.push(P('rbox', [w * 0.68, headH * 0.32, d * 1.16], [0, headY + headH * 0.42, -0.02], 'hair', 'head', { r: 0.08 }));
    return { height: H, hover: 0, width: w, pivots, parts, anchors };
  },

  ghost(r) {
    const W = r.width ?? 1.1, H = r.height ?? 1.2, hover = r.hover ?? 0.25, facets = r.facets ?? 5;
    const cy = hover + H * 0.55, shellH = H * 0.82;
    const pivots = { body: { hinge: [0, cy, 0] }, tendrilL: { hinge: [-W * 0.22, hover + H * 0.2, 0] }, tendrilR: { hinge: [W * 0.22, hover + H * 0.2, 0] } };
    const zf = W * 0.44;
    const parts = [
      P('bell', [W, shellH, W * 0.9], [0, hover + H * 0.14 + shellH / 2, 0], 'porcelain', 'body', { sides: facets }),
      P('rbox', [W * 0.66, H * 0.34, 0.06], [0, cy + H * 0.08, zf], 'face', 'body', { r: 0.05 }),
      P('ball', [W * 0.17, H * 0.19, 0.06], [-W * 0.15, cy + H * 0.12, zf + 0.04], 'eye', 'body', { eye: true }),
      P('ball', [W * 0.17, H * 0.19, 0.06], [W * 0.15, cy + H * 0.12, zf + 0.04], 'eye', 'body', { eye: true }),
      P('ball', [W * 0.09, H * 0.08, 0.05], [0, cy - H * 0.03, zf + 0.035], 'mouth', 'body'),
      P('cone', [W * 0.26, H * 0.42, W * 0.26], [-W * 0.22, hover + H * 0.02, 0], 'wisp', 'tendrilL', { flip: true, sides: 5 }),
      P('cone', [W * 0.26, H * 0.42, W * 0.26], [W * 0.22, hover + H * 0.02, 0], 'wisp', 'tendrilR', { flip: true, sides: 5 }),
      P('rbox', [W * 0.24, H * 0.14, 0.07], [W * 0.26, cy + H * 0.26, -W * 0.4], 'team', 'body', { r: 0.03 }),
    ];
    const anchors = {
      headTop: { at: [0, hover + H * 0.14 + shellH, 0], pivot: 'body', w: W },
      back: { at: [0, cy, -W * 0.42], pivot: 'body', w: W }, bottom: { at: [0, hover + H * 0.1, 0], pivot: 'body', w: W },
      face: { at: [0, cy + H * 0.12, zf + 0.05], pivot: 'body', w: W * 0.66 },
    };
    return { height: H, hover, width: W, pivots, parts, anchors };
  },

  toaster(r) {
    const w = r.w ?? 1.25, h = r.h ?? 1.1, d = r.d ?? 0.84, wheelR = h * 0.2, lift = wheelR * 1.1, slots = r.slots ?? 2;
    const by = lift + h / 2, top = lift + h;
    const pivots = { body: { hinge: [0, by, 0] }, toast: { hinge: [0, top, 0] } };
    const parts = [
      P('rbox', [w, h, d], [0, by, 0], 'body', 'body', { r: 0.1 }),
      P('rbox', [w * 0.72, h * 0.46, 0.05], [0, by + h * 0.1, d / 2 + 0.01], 'face', 'body', { r: 0.05 }),
      P('rbox', [w * 0.13, h * 0.17, 0.04], [-w * 0.17, by + h * 0.14, d / 2 + 0.04], 'eye', 'body', { r: 0.03, eye: true }),
      P('rbox', [w * 0.13, h * 0.17, 0.04], [w * 0.17, by + h * 0.14, d / 2 + 0.04], 'eye', 'body', { r: 0.03, eye: true }),
      P('rbox', [w * 0.3, h * 0.1, d * 0.34], [-w * 0.3, top + 0.03, 0], 'team', 'body', { r: 0.03 }),
      P('rbox', [0.08, h * 0.22, 0.14], [w / 2 + 0.04, by + h * 0.12, 0.1], 'dark', 'body', { r: 0.03 }),
    ];
    for (let i = 0; i < slots; i++) {
      const x = (i - (slots - 1) / 2) * (w * 0.36);
      parts.push(P('rbox', [w * 0.3, h * 0.05, d * 0.5], [x, top + 0.005, 0], 'dark', 'body', { r: 0.02 }));
      parts.push(P('wedge', [w * 0.27, h * 0.5, d * 0.12], [x, top + h * 0.12, 0], 'toast', 'toast', { r: 0.05, slope: 0.15 }));
    }
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], i) => {
      const at = [sx * (w / 2 - 0.02), wheelR, sz * d * 0.3], piv = `axle${i}`;
      pivots[piv] = { hinge: at };
      parts.push(P('cyl', [wheelR * 2, 0.2, wheelR * 2], at, 'tyre', piv, { rot: [0, 0, Math.PI / 2], sides: 10 }));
      parts.push(P('cyl', [wheelR * 0.9, 0.22, wheelR * 0.9], at, 'hub', piv, { rot: [0, 0, Math.PI / 2], sides: 10 }));
    });
    const anchors = { headTop: { at: [0, top + h * 0.3, 0], pivot: 'body', w }, back: { at: [0, by, -d / 2], pivot: 'body', w } };
    return { height: top + h * 0.3, hover: 0, width: w, pivots, parts, anchors };
  },

  lantern(r) {
    const s = r.height ?? 1.4;
    const pivots = { body: { hinge: [0, 0, 0] } };
    const parts = [
      P('cyl', [0.9 * s / 1.4, 0.14, 0.9 * s / 1.4], [0, 0.07, 0], 'shade', 'body', { sides: 5 }),
      P('lathe', [0.62, s * 0.55, 0.62], [0, 0.14 + s * 0.275, 0], 'lamp', 'body', { profile: [[0, 0], [0.4, 0.05], [0.5, 0.4], [0.42, 0.95], [0, 1]], sides: 5 }),
      P('cyl', [0.74, s * 0.55, 0.74], [0, 0.14 + s * 0.275, 0], 'porcelain', 'body', { sides: 5, open: true, frame: true }),
      P('cone', [1.0, s * 0.3, 1.0], [0, 0.14 + s * 0.55 + s * 0.15, 0], 'shade', 'body', { sides: 5 }),
      P('ball', [0.14, 0.14, 0.14], [0, 0.14 + s * 0.88, 0], 'accent', 'body'),
      P('ball', [0.1, 0.13, 0.05], [-0.12, 0.14 + s * 0.32, 0.33], 'eye', 'body', { eye: true }),
      P('ball', [0.1, 0.13, 0.05], [0.12, 0.14 + s * 0.32, 0.33], 'eye', 'body', { eye: true }),
      P('rbox', [0.26, 0.1, 0.06], [0, 0.14 + s * 0.5, -0.36], 'team', 'body', { r: 0.02 }),
    ];
    return { height: s, hover: 0, width: 1, pivots, parts: parts.filter((x) => !x.frame), anchors: { headTop: { at: [0, s, 0], pivot: 'body', w: 0.8 } } };
  },
};

// ---------------------------------------------------------------------------------------------------------------
// Accessories: (anchor, opts) -> parts. Headgear replaces a human's hair.
// ---------------------------------------------------------------------------------------------------------------
const HEADGEAR = new Set(['tophat', 'partyhat', 'headphones', 'cap']);
export const ACCESSORIES = {
  tophat(A) { const t = A.headTop, w = t.w; return [
    P('cyl', [w * 1.25, 0.05, w * 1.15], v3(t.at, [0, 0.03, 0]), 'hat', t.pivot, { sides: 18 }),
    P('cyl', [w * 0.82, 0.36, w * 0.76], v3(t.at, [0, 0.22, 0]), 'hat', t.pivot, { sides: 18 }),
    P('cyl', [w * 0.84, 0.07, w * 0.78], v3(t.at, [0, 0.09, 0]), 'team', t.pivot, { sides: 18 })]; },
  partyhat(A) { const t = A.headTop, w = t.w; return [
    P('cone', [w * 0.6, 0.42, w * 0.6], v3(t.at, [0, 0.2, 0]), 'accent', t.pivot, { sides: 14 }),
    P('ball', [0.1, 0.1, 0.1], v3(t.at, [0, 0.43, 0]), 'team', t.pivot)]; },
  cap(A) { const t = A.headTop, w = t.w; return [
    P('ball', [w * 1.02, w * 0.5, w * 1.02], v3(t.at, [0, -0.02, 0]), 'accent', t.pivot),
    P('rbox', [w * 0.7, 0.04, w * 0.45], v3(t.at, [0, -0.06, w * 0.55]), 'accent', t.pivot, { r: 0.015 })]; },
  headphones(A) { const t = A.headTop, w = t.w; return [
    P('torus', [w * 1.12, 0.07, w * 0.5], v3(t.at, [0, -0.06, 0]), 'dark', t.pivot, { r: 0.07, rot: [Math.PI / 2, 0, 0] }),
    P('cyl', [0.22, 0.12, 0.22], v3(t.at, [-w * 0.55, -0.2, 0]), 'dark', t.pivot, { rot: [0, 0, Math.PI / 2] }),
    P('cyl', [0.22, 0.12, 0.22], v3(t.at, [w * 0.55, -0.2, 0]), 'dark', t.pivot, { rot: [0, 0, Math.PI / 2] }),
    P('cyl', [0.15, 0.13, 0.15], v3(t.at, [w * 0.6, -0.2, 0]), 'screen', t.pivot, { rot: [0, 0, Math.PI / 2] })]; },
  sunglasses(A) { const f = A.face, w = f.w; return [
    P('rbox', [w * 0.42, 0.11, 0.05], v3(f.at, [-w * 0.22, 0.01, 0.03]), 'glass', f.pivot, { r: 0.03 }),
    P('rbox', [w * 0.42, 0.11, 0.05], v3(f.at, [w * 0.22, 0.01, 0.03]), 'glass', f.pivot, { r: 0.03 }),
    P('rbox', [w * 0.9, 0.025, 0.03], v3(f.at, [0, 0.05, 0.02]), 'glass', f.pivot, { r: 0.01 })]; },
  clipboard(A) { const h = A.handR; return [
    P('rbox', [0.34, 0.46, 0.05], v3(h.at, [0, 0.12, 0.16]), 'board', h.pivot, { r: 0.02 }),
    P('rbox', [0.28, 0.36, 0.02], v3(h.at, [0, 0.1, 0.195]), 'paper', h.pivot, { r: 0.01 }),
    P('rbox', [0.14, 0.06, 0.05], v3(h.at, [0, 0.34, 0.2]), 'metal', h.pivot, { r: 0.015 })]; },
  bottle(A) { const h = A.handR; return [
    P('cyl', [0.2, 0.42, 0.2], v3(h.at, [0, 0.08, 0.2]), 'bottle', h.pivot, { rot: [Math.PI / 2.6, 0, 0] }),
    P('cone', [0.13, 0.2, 0.13], v3(h.at, [0, 0.26, 0.42]), 'bottle', h.pivot, { rot: [Math.PI / 2.6, 0, 0] }),
    P('cyl', [0.1, 0.1, 0.1], v3(h.at, [0, 0.32, 0.5]), 'gold', h.pivot, { rot: [Math.PI / 2.6, 0, 0] }),
    P('cyl', [0.21, 0.14, 0.21], v3(h.at, [0, 0.06, 0.18]), 'paper', h.pivot, { rot: [Math.PI / 2.6, 0, 0] })]; },
  megaphone(A) { const h = A.handR; return [
    P('cone', [0.36, 0.5, 0.36], v3(h.at, [0, 0.12, 0.34]), 'gold', h.pivot, { rot: [-Math.PI / 2, 0, 0], sides: 16 }),
    P('cyl', [0.1, 0.18, 0.1], v3(h.at, [0, 0.02, 0.08]), 'dark', h.pivot)]; },
  popper(A) { const h = A.handR; return [
    P('cyl', [0.24, 0.62, 0.24], v3(h.at, [0, 0.2, 0.12]), 'accent', h.pivot, { rot: [-0.5, 0, 0] }),
    P('cyl', [0.25, 0.06, 0.25], v3(h.at, [0, 0.36, 0.2]), 'team', h.pivot, { rot: [-0.5, 0, 0] }),
    P('cone', [0.34, 0.2, 0.34], v3(h.at, [0, 0.52, 0.28]), 'flare', h.pivot, { flip: true, rot: [-0.5, 0, 0], sides: 12 })]; },
  ropepost(A) { const h = A.handR; return [
    P('cyl', [0.1, 0.9, 0.1], v3(h.at, [0.05, 0.05, 0.14]), 'gold', h.pivot, { sides: 12 }),
    P('ball', [0.18, 0.18, 0.18], v3(h.at, [0.05, 0.52, 0.14]), 'gold', h.pivot),
    P('cyl', [0.3, 0.06, 0.3], v3(h.at, [0.05, -0.38, 0.14]), 'gold', h.pivot, { sides: 16 }),
    P('capsule', [0.08, 0.6, 0.08], v3(h.at, [-0.25, 0.3, 0.14]), 'velvet', h.pivot, { rot: [0, 0, 1.1] })]; },
  speakerpack(A) { const b = A.back; return [
    P('rbox', [b.w * 0.8, 0.62, 0.32], v3(b.at, [0, 0.02, -0.18]), 'dark', b.pivot, { r: 0.06 }),
    P('cyl', [0.3, 0.05, 0.3], v3(b.at, [0, 0.12, -0.35]), 'glow', b.pivot, { rot: [Math.PI / 2, 0, 0] }),
    P('cyl', [0.18, 0.05, 0.18], v3(b.at, [0, -0.17, -0.35]), 'glow', b.pivot, { rot: [Math.PI / 2, 0, 0] })]; },
  crest(A) { const t = A.headTop; return [P('cone', [t.w * 0.42, 0.32, t.w * 0.42], v3(t.at, [0, 0.1, 0]), 'porcelain', t.pivot, { sides: 5 })]; },
  cowl(A) { const t = A.headTop; return [
    P('lathe', [t.w * 1.25, 0.62, t.w * 1.15], v3(t.at, [0, -0.2, -0.05]), 'shade', t.pivot, { profile: [[0.5, 0], [0.5, 0.45], [0.38, 0.8], [0, 1]], sides: 5 })]; },
  tail(A) { const b = A.back; return [
    P('cone', [0.32, 0.9, 0.32], v3(b.at, [0, -0.35, -0.25]), 'wisp', b.pivot, { flip: true, rot: [0.7, 0, 0], sides: 5 }),
    P('cone', [0.2, 0.55, 0.2], v3(b.at, [0, -0.72, -0.6]), 'wisp', b.pivot, { flip: true, rot: [1.0, 0, 0], sides: 5 })]; },
  emitters(A) { const t = A.headTop, w = t.w; return [-1, 1].flatMap((s) => [
    P('rbox', [0.22, 0.22, 0.5], v3(t.at, [s * w * 0.32, -0.15, 0.1]), 'dark', t.pivot, { r: 0.04 }),
    P('cyl', [0.15, 0.04, 0.15], v3(t.at, [s * w * 0.32, -0.15, 0.36]), 'glow', t.pivot, { rot: [Math.PI / 2, 0, 0] })]); },
};

// ---------------------------------------------------------------------------------------------------------------
export function expand(recipe) {
  const base = ARCHETYPES[recipe.base];
  if (!base) throw new Error(`forge: unknown base "${recipe.base}" (bases: ${Object.keys(ARCHETYPES).join(', ')})`);
  const body = base(recipe);
  const parts = [...body.parts];
  for (const name of [...(recipe.wear ?? []), ...(recipe.hold ? [recipe.hold] : [])]) {
    const acc = ACCESSORIES[name];
    if (!acc) throw new Error(`forge: unknown accessory "${name}" (accessories: ${Object.keys(ACCESSORIES).join(', ')})`);
    parts.push(...acc(body.anchors, recipe));
  }
  for (const extra of recipe.parts ?? []) parts.push(extra);   // hand-placed parts for one-offs
  return { id: recipe.id, faction: recipe.faction, base: recipe.base, height: body.height, hover: body.hover, width: body.width, pivots: body.pivots, parts };
}
