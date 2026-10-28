// The bread chain, alive on the play page (PLAYABLE.md item 25). Owner: sonnet (Playable Client). Presentation only: it reads
// the live sim state and never writes it. The timings are GPT's Design Studio study (play/style-lab/bread-chain.mjs).
//   Crumbs      a wheat sack on the back while loaded, a toast slice while ferrying; both hop with the walk
//   Mill        sails spin fast while it grinds (a lazy drift otherwise)       } through toaster-buildings.mjs LIVE_BODIES,
//   Well        the bucket bobs deeper and quicker while it draws water         } parts.act 0..1, no edit to viewer3d
//   Toaster     the slices pop one after the other while it bakes              }
//   Strip       a stack of toast slices beside it that grows and shrinks with the toast in the pantry
//
//   breadActivity(state, s)        pure: 0 or 1, is this Mill / Well / Toaster working right now
//   crumbCarry(state, unit)        pure: 'sack' | 'toast' | null
//   stackSlices(toast)             pure: how many slices the stack beside the Strip shows
//   createBreadLife(ctx, { THREE, getState })   // one stack layer draws the toast beside every Strip, both sides
//   (MAX_CARRIERS caps sacks and slices separately; a Crumb past its own cap just shows nothing) -> viewer3d system { update(frame, dt), dispose() }
import { BAKERY, pantryCapOf } from '../env/bakery.mjs';
import { stockOf } from '../env/ammo.mjs';
import { BREAD_CHAIN_TIMINGS, sampleBreadChain } from './style-lab/bread-chain.mjs';
import { LIVE_BODIES } from './toaster-buildings.mjs';

export const MAX_CARRIERS = 256;
export const MAX_STACK = 12; // slices drawn beside one Strip
const COLS = 3;              // the stack is built three slices wide, so 12 slices is four rows tall
const SMOOTH = 5;            // 1/s: how fast the working state and the stack follow the sim

/** 1 while the building has something to do this beat, else 0. Mirrors env/bakery.mjs stepBakery's own conditions. */
export function breadActivity(state, s) {
  if (!s || !s.complete || !(s.hp > 0)) return 0;
  const pantry = state.toast?.pantry?.[s.owner];
  if (!pantry) return 0;
  const cap = pantryCapOf(state, s.owner);
  if (s.kind === 'mill') return state.shards?.[s.owner] >= BAKERY.wheatPerFlour && pantry.flour < cap ? 1 : 0;
  if (s.kind === 'well') return !s.dry && pantry.water < cap ? 1 : 0;
  if (s.kind === 'toaster') return !s.unpowered && pantry.flour >= 1 && pantry.water >= 1 ? 1 : 0;
  return 0;
}

/** What a Crumb carries: wheat, flour or ore in hand is a sack; a toast slice in hand (or an order to ferry it) is toast. */
export function crumbCarry(state, u) {
  if (!u || u.kind !== 'worker' || !(u.hp > 0)) return null;
  if (u.carryingToast > 0 || /ferry|feed|toast/.test(u.order?.type ?? '')) return 'toast';
  if (u.carrying > 0 || u.carryingFlux > 0 || u.carryingRare?.amount > 0) return 'sack';
  return null;
}

/** Slices in the stack beside the Strip: one per toast up to MAX_STACK. */
export const stackSlices = (toast) => Math.max(0, Math.min(MAX_STACK, Math.floor(toast || 0)));

export function createBreadLife(ctx, { THREE: TH, getState } = {}) {
  const T = TH ?? ctx.THREE ?? ctx.three;
  if (!T) throw new Error('createBreadLife needs ctx.THREE');
  const root = new T.Group();
  root.name = 'bread-life';
  root.position.copy(ctx.gridToWorld(0, 0, 0, new T.Vector3()));
  root.scale.setScalar(ctx.tileSize ?? 1);
  ctx.scene.add(root);

  const mat = (c) => new T.MeshStandardMaterial({ color: new T.Color(c), roughness: 0.85, flatShading: true });
  const mesh = (geo, color, cap) => {
    const m = new T.InstancedMesh(geo, mat(color), cap);
    m.instanceMatrix.setUsage(T.DynamicDrawUsage);
    m.frustumCulled = false; m.castShadow = true; m.count = 0;
    root.add(m); return m;
  };
  const sacks = mesh(new T.BoxGeometry(0.2, 0.22, 0.14), '#c8a24a', MAX_CARRIERS);
  const slices = mesh(new T.BoxGeometry(0.15, 0.17, 0.04), '#d9953b', MAX_CARRIERS);
  const bank = mesh(new T.BoxGeometry(0.22, 0.05, 0.18), '#d9953b', MAX_STACK * 2);
  const dummy = new T.Object3D();
  const set = (im, i, x, y, z, sx = 1, sy = 1, rz = 0) => {
    dummy.position.set(x, y, z); dummy.rotation.set(0, 0, rz); dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
  };

  const homeOf = new Map();    // body parts -> structure id, matched once by where the body stands
  const shown = [0, 0];        // smoothed stack height per side
  const last = new Map();      // unit id -> { x, y, moved } for hop timing
  let clock = 0;
  const wp = new T.Vector3();

  function matchBodies(structures) {
    for (const parts of [...LIVE_BODIES]) {
      let up = parts.body, top = up, inScene = false;
      while (up) { top = up; if (up === ctx.scene) { inScene = true; break; } up = up.parent; }
      // Not under this scene: a body whose whole chain ends in a detached root (no Scene) is gone, so forget it.
      if (!inScene) { if (!top.isScene) { LIVE_BODIES.delete(parts); homeOf.delete(parts); } continue; }
      if (homeOf.has(parts)) continue;
      parts.body.getWorldPosition(wp);
      const g = ctx.worldToGrid ? ctx.worldToGrid(wp) : null;
      if (!g) continue;
      let best = null, bd = 1.2;
      for (const s of structures) {
        if (s.kind !== parts.kind) continue;
        const d = Math.hypot(s.x - g.x, s.y - g.y);
        if (d < bd) { bd = d; best = s; }
      }
      if (best) homeOf.set(parts, best.id);
    }
  }

  return {
    name: 'bread-life', root,
    update(frame, dt = 1 / 60) {
      const state = getState?.();
      if (!state) return;
      clock += dt;
      const k = 1 - Math.exp(-SMOOTH * dt);
      const structs = new Map(state.structures.map((s) => [s.id, s]));
      matchBodies(frame?.structures ?? state.structures);
      for (const [parts, id] of homeOf) {
        const s = structs.get(id);
        parts.act += (breadActivity(state, s) - parts.act) * k;
      }
      // Crumbs: sack or slice on the back, hopping while the Crumb is walking.
      const byId = new Map(state.units.map((u) => [u.id, u]));
      let ns = 0, nt = 0;
      for (const fu of frame?.units ?? []) {
        if (fu.dying || fu.kind !== 'worker') continue;
        const kind = crumbCarry(state, byId.get(fu.id) ?? fu);
        const prev = last.get(fu.id);
        const moving = prev ? Math.hypot(fu.x - prev.x, fu.y - prev.y) > 0.004 : false;
        last.set(fu.id, { x: fu.x, y: fu.y });
        if (!kind || (ns >= MAX_CARRIERS && nt >= MAX_CARRIERS)) continue;
        const f = sampleBreadChain(clock + fu.id * 0.37, moving ? 'move' : 'idle');
        const h = (ctx.heightAt?.(Math.round(fu.x), Math.round(fu.y)) || 0) + 0.6 + 0.07 * f.hop;
        const squash = 1 - 0.05 * f.landing * (moving ? 1 : 0);
        if (kind === 'sack') { if (ns < MAX_CARRIERS) set(sacks, ns++, fu.x - 0.1, h, fu.y - 0.1, 1, squash); }
        else if (nt < MAX_CARRIERS) set(slices, nt++, fu.x + 0.04, h + 0.02, fu.y - 0.08, 1, squash, 0.1 * f.landing);
      }
      sacks.count = ns; slices.count = nt;
      sacks.instanceMatrix.needsUpdate = true; slices.instanceMatrix.needsUpdate = true;
      if (last.size > 4 * MAX_CARRIERS) for (const id of last.keys()) if (!byId.has(id)) last.delete(id);
      // The toast stack beside each Strip.
      let nb = 0;
      for (const s of frame?.structures ?? state.structures) {
        if (s.kind !== 'core' || s.dying) continue;
        const want = stackSlices(stockOf(state, s.owner));
        shown[s.owner] += (want - shown[s.owner]) * k;
        if (Math.abs(want - shown[s.owner]) < 0.02) shown[s.owner] = want;
        const n = Math.ceil(shown[s.owner] - 1e-6), base = (ctx.heightAt?.(Math.round(s.x), Math.round(s.y)) || 0) + 0.03;
        for (let i = 0; i < n && nb < MAX_STACK * 2; i++) {
          const part = Math.min(1, shown[s.owner] - i); // the top slice grows in, or shrinks out
          set(bank, nb++, s.x + 1.0 + (i % COLS - 1) * 0.05, base + Math.floor(i / COLS) * 0.055 + 0.025 * part, s.y + 0.1, part, part, (i % 2 ? 1 : -1) * 0.03);
        }
      }
      bank.count = nb; bank.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      ctx.scene.remove(root);
      for (const m of [sacks, slices, bank]) { m.geometry.dispose(); m.material.dispose(); }
      for (const parts of homeOf.keys()) parts.act = 0;
    },
  };
}

export { BREAD_CHAIN_TIMINGS };
