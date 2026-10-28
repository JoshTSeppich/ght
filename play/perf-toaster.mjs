// The Toaster Wars frame-rate page's runner (owner: sonnet, PERF). Mounts the real Wheatfield scene with the same modules
// play/app.mjs uses, on the synthetic state from play/perf-scenario.mjs.
// Open play/perf-toaster.html (repo-root server). Query: ?units=200 (even), ?quality=high|balanced|low, ?frames=120 (measured),
// ?mode=render (default: sim frozen, only engine render + instanced update timed) | ?mode=sim (one sim tick per frame, never catch-up).
// 30 warm-up frames (shader compile, first renders) are discarded, and warm-up excluded is printed. Result: one console line
// "PERF: {json}", window.__perf, and the on-page readout.
import * as THREE from 'three';
import { createEngine } from '../viewer3d/engine.mjs';
import { createPalette } from '../viewer3d/palette.mjs';
import { createBuildings } from '../viewer3d/buildings.mjs';
import { CAMERA } from './camera.mjs';
import { createLiveWorld } from './app.mjs';
import { installToy } from './toy-render.mjs';
import { createWheatfieldTerrain } from './wheatfield-terrain.mjs';
import { createInstancedUnits } from './units-instanced.mjs';
import { toasterBuildingLook } from './toaster-buildings.mjs';
import { createStationLayer } from './power-stations-3d.mjs';
import { createBreadLife } from './bread-life.mjs';
import { observeToaster } from './toaster-play.mjs';
import { buildToasterScenario, keepMarching, TOASTER_PERF_UNITS } from './perf-scenario.mjs';
import { step } from '../env/sim.mjs';
import { STATS } from '../env/stats.mjs';

const ENGINE_QUALITY = { high: 'high', balanced: 'medium', low: 'low' };   // the page's names -> the engine's tiers
const FRAME_BUDGET_MS = 1000 / 60;
export const WARMUP_FRAMES = 30;
export const DEFAULT_FRAMES = 120;
export const ZOOM_MIN = 16, ZOOM_MAX = 24;
const SIM_SAMPLES = 40;   // ticks timed on their own in render mode, outside the render timing

// Sim cost on its own: n ticks of a twin scene (a fresh build, same seed and units), so the crowd on screen never loses a toaster
// to the timing. Returns the tick times in ms.
export function timeSimTicks(build, n = SIM_SAMPLES) {
  const twin = build();
  const ids = twin.units.filter((u) => u.marching).map((u) => u.id);
  const ms = [];
  for (let i = 0; i < n; i++) {
    keepMarching(twin.state, ids);
    const t0 = performance.now();
    step(twin.state, []);
    ms.push(performance.now() - t0);
  }
  return ms;
}

export const parseFrames = (value) => { const n = Math.floor(Number(value)); return Number.isFinite(n) && n >= 1 ? n : DEFAULT_FRAMES; };

const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const units = Number(q.get('units') ?? TOASTER_PERF_UNITS) || TOASTER_PERF_UNITS;
const quality = ENGINE_QUALITY[q.get('quality')] ? q.get('quality') : 'high';
const mode = q.get('mode') === 'sim' ? 'sim' : 'render';
const frames = parseFrames(q.get('frames'));
const out = typeof document !== 'undefined' ? document.getElementById('out') : null;
const say = (text) => { if (out) out.textContent = text; };
const reporter = createReporter({
  log: (l) => console.log(l), error: (l) => console.error(l),
  publish: (r) => { if (typeof window !== 'undefined') window.__perf = { ...(window.__perf || {}), ...r }; },
});

export function summarise(list) {
  const s = [...list].sort((a, b) => a - b);
  if (!s.length) return { n: 0, median: null, p95: null, mean: null, max: null };
  const at = (p) => s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const r = (v) => +v.toFixed(2);
  return { n: s.length, median: r(at(0.5)), p95: r(at(0.95)), mean: r(mean), max: r(s[s.length - 1]) };
}

// Bounding box of the units -> the gameplay camera: centred on it, 16 to 24 tiles tall, wide enough for the box.
export function frameUnits(list, aspect = 16 / 9, pitch = CAMERA.pitch) {
  if (!list.length) return { cx: 0, cy: 0, zoom: ZOOM_MAX, box: null };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const u of list) { x0 = Math.min(x0, u.x); x1 = Math.max(x1, u.x); y0 = Math.min(y0, u.y); y1 = Math.max(y1, u.y); }
  const need = Math.max((y1 - y0 + 2) * Math.sin(pitch), (x1 - x0 + 2) / (aspect || 16 / 9));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, need)), box: { x0, y0, x1, y1 } };
}

// The scenario scatters units over the whole map (256 tiles), which no 16-24 tile camera can frame. Pack them into one compact
// grid (spacing 1.2 tiles, aspect matched to the screen) centred on their centroid; the order of the list is kept, so the
// two sides interleave and both teams sit in the middle. 1.2 keeps the whole grid inside the central 70% at 1440x900.
export function gatherUnits(list, aspect = 16 / 9, pitch = CAMERA.pitch, spacing = 1.2) {
  const n = list.length;
  if (!n) return [];
  let sx = 0, sy = 0;
  for (const u of list) { sx += u.x; sy += u.y; }
  const cx = Math.round(sx / n), cy = Math.round(sy / n);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * (aspect || 16 / 9) * Math.sin(pitch)))), rows = Math.ceil(n / cols);
  return list.map((_, i) => ({
    x: +(cx + ((i % cols) - (cols - 1) / 2) * spacing).toFixed(3),
    y: +(cy + (Math.floor(i / cols) - (rows - 1) / 2) * spacing).toFixed(3),
  }));
}

// Camera for a fit: the gameplay pose looking at the fit centre. THREE is passed in so node tests can build it.
export function cameraFor(THREE_, fit, toWorld, aspect = 16 / 9, pitch = CAMERA.pitch) {
  const h = fit.zoom, t = toWorld(fit.cx, fit.cy, 0);
  const cam = new THREE_.OrthographicCamera(-h * aspect / 2, h * aspect / 2, h / 2, -h / 2, 0.1, 400);
  cam.position.set(t.x, t.y + Math.sin(pitch) * CAMERA.distance, t.z + Math.cos(pitch) * CAMERA.distance);
  cam.up.set(0, 1, 0); cam.lookAt(t.x, t.y, t.z);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  return cam;
}

// How many units project inside the screen (NDC -1..1, in front of the camera). Pure: reads the camera matrices only.
// `lim` shrinks the box: 0.7 keeps only the units in the central 70% of the width and of the height.
export function countInFrame(list, toWorld, camera, h = 0.4, lim = 1) {
  camera.updateMatrixWorld?.(true);
  const v = camera.matrixWorldInverse.elements, p = camera.projectionMatrix.elements;
  let n = 0;
  for (const u of list) {
    const w = toWorld(u.x, u.y, h);
    const x = v[0] * w.x + v[4] * w.y + v[8] * w.z + v[12];
    const y = v[1] * w.x + v[5] * w.y + v[9] * w.z + v[13];
    const z = v[2] * w.x + v[6] * w.y + v[10] * w.z + v[14];
    const cw = p[3] * x + p[7] * y + p[11] * z + p[15];
    if (!cw) continue;
    const nx = (p[0] * x + p[4] * y + p[8] * z + p[12]) / cw, ny = (p[1] * x + p[5] * y + p[9] * z + p[13]) / cw;
    const nz = (p[2] * x + p[6] * y + p[10] * z + p[14]) / cw;
    if (nx >= -lim && nx <= lim && ny >= -lim && ny <= lim && nz >= -1 && nz <= 1) n++;
  }
  return n;
}

// Units in the central `share` of the frame (0.7: the middle 70% of the width and of the height).
export const countCentre = (list, toWorld, camera, share = 0.7, h = 0.4) => countInFrame(list, toWorld, camera, h, share);

// Under 90% of the units in frame -> open the zoom to the limit.
export const IN_FRAME_MIN = 0.9;
export function widenZoom(fit, inFrame, total) {
  return total && inFrame / total < IN_FRAME_MIN ? ZOOM_MAX : fit.zoom;
}

// Canvas size in px: the element first, then the renderer, then the window when both report 0.
export function viewportOf(canvas, renderer, win = typeof window !== 'undefined' ? window : {}) {
  let w = canvas?.clientWidth || 0, h = canvas?.clientHeight || 0;
  if (!w || !h) {
    const v = { x: 0, y: 0 };
    try { renderer?.getSize?.(v); } catch { /* keep 0 */ }
    w = Math.round(v.x) || 0; h = Math.round(v.y) || 0;
  }
  if (!w || !h) { w = win.innerWidth || 0; h = win.innerHeight || 0; }
  return { w, h, dpr: win.devicePixelRatio || 1 };
}

// Meshes that cast a shadow; an instanced mesh counts once per instance.
export function countCasters(scene) {
  let n = 0;
  scene.traverse((o) => { if (o.castShadow && (o.isMesh || o.isInstancedMesh)) n += o.isInstancedMesh ? (o.count ?? 1) : 1; });
  return n;
}

// The one PERF line per quality tier.
export function perfLine(r) {
  return {
    scene: 'toaster-wheatfield', quality: r.quality, mode: r.mode, units: r.units, alive: r.alive ?? r.units, frames: r.frames,
    renderMedianMs: r.render.median, renderP95Ms: r.render.p95, simMedianMs: r.sim.median,
    fps: r.render.median ? +(1000 / r.render.median).toFixed(1) : null,
    drawCalls: r.drawCalls, triangles: r.triangles, casters: r.casters, viewport: r.viewport,
    inFrame: r.inFrame, target: r.target,
  };
}

// One frame tick: requestAnimationFrame, or a setTimeout fallback when the tab is hidden or throttled, whichever fires first.
export const FRAME_FALLBACK_MS = 50;
export const RUN_DEADLINE_MS = 50000;
export function nextFrame(raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null, wait = setTimeout, clear = clearTimeout) {
  return new Promise((resolve) => {
    let done = false, timer = null;
    const go = () => { if (done) return; done = true; if (timer !== null) clear(timer); resolve(); };
    timer = wait(go, FRAME_FALLBACK_MS);
    try { raf?.(go); } catch { /* the timer still fires */ }
  });
}

// Exactly one PERF line per load: the first of finish()/fail() wins, later calls do nothing.
export function createReporter({ log = () => {}, error = () => {}, publish = () => {} } = {}) {
  let printed = false;
  return {
    get printed() { return printed; },
    finish(line, extra = {}) { if (printed) return false; printed = true; publish({ ...line, ...extra }); log(`PERF ${JSON.stringify(line)}`); return true; },
    fail(err) {
      if (printed) return false; printed = true;
      const message = String(err?.message ?? err);
      publish({ error: message }); error(`PERF ERROR: ${message}`); return true;
    },
  };
}

// The frame loop. Each frame runs inside try/catch; the first error stops the run and is returned, a deadline stops it with the
// frames already measured. Returns { samples, error, timedOut }.
export async function driveFrames({ total, warmup, frame, tick = nextFrame, now = () => performance.now(), deadlineMs = RUN_DEADLINE_MS, onProgress = () => {} }) {
  const samples = [], start = now();
  for (let i = 0; i < total; i++) {
    await tick();
    if (now() - start > deadlineMs) return { samples, error: null, timedOut: true };
    try {
      const r = frame(i);
      if (i >= warmup) samples.push(r);
      onProgress(i);
    } catch (err) { return { samples, error: err, timedOut: false }; }
  }
  return { samples, error: null, timedOut: false };
}

async function run() {
  say(`building ${units} toasters on Wheatfield (quality ${quality}, ${mode} mode)...`);
  const scene = buildToasterScenario({ units });
  const { state, map } = scene;
  const spawned = state.units.length;   // the count the URL asked for, before any tick
  const world = createLiveWorld(observeToaster(state, 0), STATS);
  const palette = createPalette ? createPalette(THREE) : null;
  const canvas = document.getElementById('stage');
  const engine = createEngine(canvas, {
    width: state.width, height: state.height, tileSize: 1, palette, stats: STATS, ortho: true, orthoHeight: 24,
    quality: ENGINE_QUALITY[quality], debug: false, autoplay: false,
  });
  const ctx = engine.ctx;
  const toy = installToy(ctx, engine, { query: q, governor: false });   // governor off: the tier cannot change mid-run   // the premium toy look, as app.mjs installs it
  ctx.log = { stats: STATS };
  ctx.heightAt = () => 0;
  ctx.buildingLook = toasterBuildingLook;
  ctx.time.playing = false;
  world.setAlpha(1);
  engine.setWorld({ ticks: 1e9, frame: () => world.frame() });
  if (ctx.world) ctx.world.map = world.map;
  engine.add(createWheatfieldTerrain(ctx, { map }));
  engine.add(createBuildings(ctx, {}));
  engine.add(createInstancedUnits(ctx, { stats: STATS, side: 0 }));
  engine.add(createStationLayer(ctx, { THREE, getState: () => state, side: 0 }));
  engine.add(createBreadLife(ctx, { THREE, getState: () => state }));

  // The scenario scatters units over the whole map; pack them into one crowd (?spread=1 keeps the scatter), then frame it.
  const viewport0 = viewportOf(canvas, ctx.renderer);
  const aspect = viewport0.w && viewport0.h ? viewport0.w / viewport0.h : 16 / 9;
  if (q.get('spread') !== '1') {
    gatherUnits(state.units, aspect).forEach((p, i) => { state.units[i].x = p.x; state.units[i].y = p.y; });
    world.push(observeToaster(state, 0), []);   // the drawn snapshot was taken before the gather: refresh it so the crowd is drawn where the camera looks
  }
  let fit = frameUnits(state.units, aspect);
  const toWorld = (x, y, h = 0) => ctx.gridToWorld(x, y, h);
  const applyCamera = () => {
    ctx.orthoHeight = fit.zoom;
    engine.resize();   // sizes the renderer and applies orthoHeight
    const cam = ctx.camera, target = ctx.gridToWorld(fit.cx, fit.cy, 0);
    cam.position.set(target.x, target.y + Math.sin(CAMERA.pitch) * CAMERA.distance, target.z + Math.cos(CAMERA.pitch) * CAMERA.distance);
    cam.up.set(0, 1, 0);
    cam.lookAt(target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  };
  applyCamera();

  const marchingIds = scene.units.filter((u) => u.marching).map((u) => u.id);
  const gl = ctx.renderer.getContext?.();
  ctx.renderer.info.autoReset = false;   // engine.step resets once per frame, so composer passes sum across the whole frame

  // Sim cost on its own, never inside the render timing, and on a twin so the crowd on screen keeps all its toasters.
  const simMs = timeSimTicks(() => buildToasterScenario({ units }), SIM_SAMPLES);
  const tickOnce = () => {   // ?mode=sim only: one tick of the real crowd per frame
    keepMarching(state, marchingIds);
    const events = step(state, []);
    world.push(observeToaster(state, 0), events.filter((e) => e.e !== 'late'));
  };
  world.setAlpha(1);

  // Re-apply right before the timed loop; after the warm-up check the crowd is on screen (open the zoom once if under 90%).
  applyCamera();
  let inFrame = 0, inCentre = 0, checked = false, frameIndex = 0;
  const checkFrame = () => {
    checked = true;
    inFrame = countInFrame(state.units, toWorld, ctx.camera);
    const zoom = widenZoom(fit, inFrame, state.units.length);
    if (zoom !== fit.zoom) { fit = { ...fit, zoom }; applyCamera(); inFrame = countInFrame(state.units, toWorld, ctx.camera); }
    inCentre = countCentre(state.units, toWorld, ctx.camera);
  };
  let last = performance.now();
  const total = WARMUP_FRAMES + frames;
  const drive = await driveFrames({
    total, warmup: WARMUP_FRAMES,
    onProgress: (i) => { if (i % 10 === 0) say(`${i < WARMUP_FRAMES ? 'warming up (warm-up excluded)' : 'measuring'}  frame ${i}/${total}  ·  ${spawned} toasters  ·  quality ${quality}`); },
    frame: () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1); last = now;
      if (!checked && frameIndex === WARMUP_FRAMES) checkFrame();
      frameIndex++;
      if (mode === 'sim') tickOnce();   // at most one tick per frame, never a catch-up loop
      const t0 = performance.now();
      engine.step(dt);   // systems' update (the instanced animation) then the composer render
      gl?.finish?.();    // wait for the GPU so the number is the frame, not just the command submit
      return { ms: performance.now() - t0, calls: ctx.renderer.info.render.calls, triangles: ctx.renderer.info.render.triangles };
    },
  });
  if (!checked) checkFrame();
  if (drive.error) throw drive.error;
  const renderMs = drive.samples.map((r) => r.ms), calls = drive.samples.map((r) => r.calls), triangles = drive.samples.map((r) => r.triangles);

  const viewport = viewportOf(canvas, ctx.renderer);
  const plugged = state.units.filter((u) => u.power?.state === 'plugged').length;
  const result = {
    quality, mode, units: spawned, alive: state.units.length, frames: renderMs.length, timedOut: drive.timedOut,
    render: summarise(renderMs), sim: summarise(simMs),
    drawCalls: summarise(calls).median, triangles: summarise(triangles).median,
    casters: countCasters(ctx.scene), viewport, inFrame, target: { x: +fit.cx.toFixed(1), y: +fit.cy.toFixed(1) },
  };
  const line = perfLine(result);
  window.__perf = {
    ...line, render: result.render, sim: result.sim, engineQuality: ENGINE_QUALITY[quality], toyTier: toy?.tier?.() ?? null,
    seed: state.seed, buildings: scene.buildings.length, points: scene.points.length, pluggedUnits: plugged,
    camera: { cx: fit.cx, cy: fit.cy, zoom: fit.zoom, box: fit.box, target: result.target, inFrame },
    inFrame, inCentre, target: result.target,
    passes60: result.render.p95 !== null && result.render.p95 <= FRAME_BUDGET_MS * 1.05,
  };
  reporter.finish(line, { render: result.render, camera: window.__perf.camera, passes60: window.__perf.passes60 });
  document.title = `PERF ${line.renderMedianMs}ms med ${line.renderP95Ms}ms p95 ${line.drawCalls} calls`;
  const aliveNote = line.alive === line.units ? '' : `  (${line.alive} alive at end)`;
  // A compact strip (top-left, 320 px): the spawned count, warm-up excluded, median and p95 against the budget, draws.
  say([
    `GHOSTIES, HOSTIES, AND TOASTIES perf · ${quality} · ${mode}`,
    `${line.units} spawned · ${inFrame} in frame${aliveNote}`,
    `warm-up excluded (${WARMUP_FRAMES}), ${frames} measured`,
    `median ${line.renderMedianMs}  p95 ${line.renderP95Ms} ms (budget ${FRAME_BUDGET_MS.toFixed(1)})`,
    `mean ${result.render.mean}  max ${result.render.max} ms`,
    `draws ${line.drawCalls}  tris ${line.triangles}`,
    `p95 within 60 fps: ${window.__perf.passes60 ? 'YES' : 'NO'}`,
    `sim tick median ${line.simMedianMs} ms (apart)`,
    `${viewport.w}x${viewport.h} · camera ${fit.zoom.toFixed(1)} tiles${drive.timedOut ? ' · deadline hit' : ''}`,
  ].join('\n'));
}

if (typeof document !== 'undefined' && document.getElementById('stage')) {
  run().catch((err) => {
    reporter.fail(err);
    say(`PERF ERROR: ${err?.message ?? err}`);
    document.title = `PERF ERROR: ${err?.message ?? err}`;
    window.__perfError = String(err?.stack ?? err);
  });
}
