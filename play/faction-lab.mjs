// The faction lab's runner (ENG-101). Three rows at gameplay zoom: Toasters (play/toaster-models.mjs), Ghosters and Hosters
// (play/faction-models.mjs), two teams each, some moving and some attacking, all drawn by play/faction-units.mjs.
import * as THREE from 'three';
import { createEngine } from '../viewer3d/engine.mjs';
import { createPalette } from '../viewer3d/palette.mjs';
import { installToy } from './toy-render.mjs';
import { CAMERA } from './camera.mjs';
import { TOASTERS } from './toaster-models.mjs';
import { GHOSTERS, HOSTERS, FACTION_COLORS, trianglesOf } from './faction-models.mjs';
import { createFactionUnits } from './faction-units.mjs';

const q = new URLSearchParams(location.search);
const zoom = Number(q.get('zoom')) || 16, still = q.get('still') === '1';
const W = 64, H = 64, canvas = document.getElementById('stage'), out = document.getElementById('out');
let palette; try { palette = createPalette(THREE); } catch { /* engine defaults */ }
const engine = createEngine(canvas, { width: W, height: H, tileSize: 1, palette, ortho: true, orthoHeight: zoom, quality: q.get('quality') ?? 'high', autoplay: true });
const ctx = engine.ctx;
try { installToy(ctx, engine, { query: q }); } catch (e) { console.warn('[lab] toy look', e); }

// ground: a soft field with three tinted strips under the three factions (where wire / haunt / carpet will go, ENG-103)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ color: '#8f9a7a', roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
const c = ctx.gridToWorld(W / 2, H / 2, 0); ground.position.set(c.x, -0.01, c.z); ctx.scene.add(ground);
const strip = (gy, color, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(15, 2.2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; const p = ctx.gridToWorld(W / 2, gy, 0); m.position.set(p.x, 0.005, p.z); ctx.scene.add(m); };
strip(H / 2 - 3, '#31D5F5', 0.10); strip(H / 2, FACTION_COLORS.ghosters.haunt, 0.35); strip(H / 2 + 3, '#C8323F', 0.45);

const rows = [
  ['toasters', ['crumb', 'popper', 'zapper', 'four-slice', 'bagel'].map((id) => TOASTERS[id]).filter(Boolean)],
  ['ghosters', Object.values(GHOSTERS)],
  ['hosters', Object.values(HOSTERS)],
];
const units = [];
rows.forEach(([faction, models], r) => {
  const gy = H / 2 - 3 + r * 3;
  models.forEach((model, i) => {
    for (const team of [0, 1]) {
      const gx = W / 2 - 7.5 + i * 2.9 + team * 1.35;
      units.push({ faction, model, gx, gy: gy + (team ? 0.6 : -0.2), team, phase: i * 1.7 + team, moving: i % 2 === 0, attacking: i % 2 === 1 || team === 1 });
    }
  });
});

const fu = createFactionUnits(ctx);
const at = new THREE.Vector3();
engine.add({
  name: 'faction-lab',
  update(_f, dt) {
    const t = still ? 0 : performance.now() / 1000;
    fu.begin();
    for (const u of units) { ctx.gridToWorld(u.gx, u.gy, 0, at); fu.emit({ ...u, x: at.x, z: at.z, yaw: 0.35 * (u.team ? -1 : 1), t, moving: !still && u.moving, attacking: !still && u.attacking }); }
    fu.end();
  },
});
engine.setWorld({ ticks: 1e9, frame: () => ({ tick: 0, alpha: 0, prev: null, next: null, events: [] }) });

// gameplay camera (play/app.mjs applyCamera)
const cam = ctx.camera, target = ctx.gridToWorld(W / 2, H / 2, 0);
function aim() {
  cam.position.set(target.x, target.y + Math.sin(CAMERA.pitch) * CAMERA.distance, target.z + Math.cos(CAMERA.pitch) * CAMERA.distance);
  cam.lookAt(target);
  const a = (ctx.size.width / ctx.size.height) || 16 / 9;
  cam.top = zoom / 2; cam.bottom = -zoom / 2; cam.left = -zoom * a / 2; cam.right = zoom * a / 2; cam.updateProjectionMatrix();
}
aim(); addEventListener('resize', () => setTimeout(aim, 0));
engine.start?.();
const tris = rows.map(([f, ms]) => `${f.padEnd(9)} ${ms.map((m) => `${m.id}:${trianglesOf(m)}`).join(' ')}`).join('\n');
setTimeout(() => { aim(); out.textContent = `Faction lab (fixture, no sim)  zoom ${zoom} tiles\nTop: Toasties   Middle: Ghosties   Bottom: Broskies\n${tris}\ndraw batches ${fu.draws}`; window.__lab = { ok: true, draws: fu.draws }; }, 800);
