// Character Forge studio runner (owner: Claude). Lineup of every recipe, two teams, walking / attacking / idle in turn,
// lit like the game (sun + sky + soft shadows, ACES), with a recipe editor that rebuilds a unit live.
import * as THREE from 'three';
import { RECIPES } from './forge/recipes.mjs';
import { ACCESSORIES, ARCHETYPES } from './forge/archetypes.mjs';
import { bake } from './forge/bake.mjs';
import { createForgeUnits } from './forge/units.mjs';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a2436'); scene.fog = new THREE.Fog('#2a2436', 40, 90);
scene.add(new THREE.HemisphereLight('#d9d2ff', '#5a4a36', 1.1));
const sun = new THREE.DirectionalLight('#fff1dc', 2.2); sun.position.set(-10, 18, 12); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 60 }); sun.shadow.bias = -0.0004;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#7f8a6a', roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const band = (z, color, op) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 2.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.01, z); scene.add(m); };
band(-3.4, '#31D5F5', 0.10); band(0, '#7960AD', 0.35); band(3.4, '#C8323F', 0.42);

const forge = createForgeUnits(THREE, scene, { scale: 0.9 });
let detail = q.get('detail') === 'hero' ? 'hero' : 'game';
const recipes = RECIPES.map((r) => ({ ...r }));
let selected = recipes.find((r) => r.id === 'host') ?? recipes[0];
const bakedInfo = new Map();
function rebuild(r) { const b = bake(THREE, r, { detail }); forge.add(b); bakedInfo.set(r.id, b); }
function rebuildAll() { for (const r of recipes) rebuild(r); drawList(); }

const rowZ = { toasters: -3.4, ghosters: 0, hosters: 3.4 };
function layout() {
  const out = [];
  for (const f of Object.keys(rowZ)) {
    const list = recipes.filter((r) => r.faction === f);
    const step = f === 'toasters' ? 2.6 : 1.75;
    list.forEach((r, i) => [0, 1].forEach((team) => out.push({ id: r.id, x: (i - (list.length - 1) / 2) * step * 2 + team * step, z: rowZ[f] + (team ? 0.5 : -0.3), team, phase: i * 1.3 + team, mode: (i + team) % 3 })));
  }
  return out;
}

const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
let view = q.get('view') === 'close' ? 'close' : 'rts';
function aim(t) {
  if (view === 'rts') { cam.position.set(0, 22, 21); cam.lookAt(0, 0, 0.3); return; }
  const u = layout().find((x) => x.id === selected.id && x.team === 0) ?? { x: 0, z: 0 };
  const a = t * 0.4;
  cam.position.set(u.x + Math.sin(a) * 5, 2.6, u.z + Math.cos(a) * 5); cam.lookAt(u.x, 0.9, u.z);
}
function resize() { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---- UI ----
const $ = (id) => document.getElementById(id), msg = $('msg'), ta = $('recipe');
const say = (t, err = false) => { msg.textContent = t; msg.className = err ? 'err' : ''; };
function drawList() {
  $('list').innerHTML = recipes.map((r) => `<div data-id="${r.id}" class="${r === selected ? 'on' : ''}"><span>${r.id} <span class="f">${r.faction}</span></span><span>${(bakedInfo.get(r.id)?.tris ?? 0).toLocaleString()} tris</span></div>`).join('');
  for (const el of $('list').children) el.onclick = () => select(recipes.find((r) => r.id === el.dataset.id));
}
function select(r) { selected = r; ta.value = JSON.stringify(r, null, 2); drawList(); const b = bakedInfo.get(r.id); say(`${r.id}: ${b.tris.toLocaleString()} triangles, ${b.parts} parts, ${b.segments.length} moving pieces (${b.segments.map((s) => s.pivot).join(', ')})\nBases: ${Object.keys(ARCHETYPES).join(', ')}\nGear: ${Object.keys(ACCESSORIES).join(', ')}`); }
$('apply').onclick = () => {
  try { const r = JSON.parse(ta.value); const i = recipes.findIndex((x) => x.id === r.id); if (i >= 0) recipes[i] = r; else recipes.push(r); rebuild(r); selected = r; drawList(); select(r); }
  catch (e) { say(String(e.message ?? e), true); }
};
$('dup').onclick = () => { const r = { ...selected, id: `${selected.id}-2` }; recipes.push(r); rebuild(r); select(r); };
const toggle = (id, on) => $(id).setAttribute('aria-pressed', on);
$('v-rts').onclick = () => { view = 'rts'; toggle('v-rts', true); toggle('v-close', false); };
$('v-close').onclick = () => { view = 'close'; toggle('v-rts', false); toggle('v-close', true); };
$('d-hero').onclick = () => { detail = detail === 'hero' ? 'game' : 'hero'; toggle('d-hero', detail === 'hero'); rebuildAll(); select(selected); };
let animate = q.get('still') !== '1';
$('anim').onclick = () => { animate = !animate; toggle('anim', animate); };
toggle('v-rts', view === 'rts'); toggle('v-close', view === 'close'); toggle('d-hero', detail === 'hero'); toggle('anim', animate);

rebuildAll(); select(selected);
const units = layout();
function frame(now) {
  const t = animate ? now / 1000 : 0;
  aim(t);
  forge.begin();
  for (const u of units) {
    const walking = animate && u.mode === 0, attacking = animate && u.mode === 1;
    forge.emit({ id: u.id, x: u.x + (walking ? Math.sin(t * 0.8 + u.phase) * 0.6 : 0), z: u.z, yaw: u.team ? -0.4 : 0.4, team: u.team, t, moving: walking, attacking, phase: u.phase });
  }
  forge.end();
  renderer.render(scene, cam);
  const s = forge.stats();
  window.__forge = { ...s, units: units.length };
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
