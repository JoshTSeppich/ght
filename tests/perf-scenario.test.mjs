// The perf scenarios (owner: sonnet, PERF). The Toaster Wars scene the frame-rate page measures must be the real match with
// the synthetic set on top: 200 toasters in the five kinds, half marching, 6 power points, 12 buildings. Pure node tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildToasterScenario, keepMarching, TOASTER_KIND_MIX, TOASTER_PERF_UNITS, TOASTER_PERF_BUILDINGS, TOASTER_PERF_POINTS,
} from '../play/perf-scenario.mjs';
import { step } from '../env/sim.mjs';
import { observeToaster } from '../play/toaster-play.mjs';

test('toaster scenario: 200 toasters, five kinds, half marching', () => {
  const { state, units } = buildToasterScenario();
  assert.equal(TOASTER_PERF_UNITS, 200);
  assert.equal(units.length, 200);
  assert.equal(state.units.length, 200);
  for (const kind of TOASTER_KIND_MIX) assert.ok(units.some((u) => u.kind === kind), `no ${kind}`);
  assert.equal(units.filter((u) => u.side === 0).length, 100);
  assert.equal(units.filter((u) => u.marching).length, 100);
  const marching = state.units.filter((u) => u.order);
  assert.equal(marching.length, 100, 'every marching unit has a move order and nothing else does');
});

test('toaster scenario: six power points, twelve buildings, and cords for the points', () => {
  const { state, buildings, points, cordUnits } = buildToasterScenario();
  assert.equal(TOASTER_PERF_BUILDINGS, 12);
  assert.equal(TOASTER_PERF_POINTS, 6);
  assert.equal(buildings.length, 12);
  assert.equal(points.length, 6);
  assert.equal(new Set(points.map((p) => `${p.x},${p.y}`)).size, 6, 'power points sit on distinct tiles');
  assert.equal(state.structures.filter((s) => s.kind !== 'core').length, 12, 'the only non-core structures are the scene buildings');
  assert.equal(cordUnits, 24, 'four toasters per power point are close enough to plug in');
});

test('toaster scenario: no two units or buildings share a tile, and side 1 mirrors side 0', () => {
  const { state, map, units } = buildToasterScenario();
  const tiles = new Set();
  for (const u of state.units) {
    const key = `${u.x},${u.y}`;
    assert.ok(!tiles.has(key), `two units on ${key}`);
    tiles.add(key);
    if (u.owner === 0) assert.equal(map.tiles[u.y][u.x], '.', `side 0 unit on ${key} is not open floor`);
  }
  for (const b of state.structures) {
    if (b.kind === 'core') continue;
    assert.ok(!tiles.has(`${b.x},${b.y}`), `building on a unit at ${b.x},${b.y}`);
  }
  for (const u of units.filter((row) => row.side === 0)) {
    const mirror = units.find((row) => row.side === 1 && row.kind === u.kind && row.x === map.width - 1 - u.x && row.y === map.height - 1 - u.y);
    assert.ok(mirror, `no mirror for ${u.x},${u.y}`);
  }
});

test('toaster scenario: the same seed builds the same scene', () => {
  const a = buildToasterScenario({ seed: 3 });
  const b = buildToasterScenario({ seed: 3 });
  assert.deepEqual(a.units.map((u) => [u.x, u.y, u.kind, u.marching]), b.units.map((u) => [u.x, u.y, u.kind, u.marching]));
  assert.deepEqual(a.points.map((p) => [p.x, p.y]), b.points.map((p) => [p.x, p.y]));
});

test('toaster scenario: the sim steps the scene without throwing', () => {
  const { state } = buildToasterScenario();
  for (let t = 0; t < 3; t++) step(state, []);
  assert.ok(state.tick >= 3);
  assert.ok(state.units.length > 0);
});

test('toaster scenario: the snapshot the page draws from has every toaster, buildings and power points', () => {
  const { state } = buildToasterScenario();
  step(state, []);
  const snap = observeToaster(state, 0);
  assert.equal(snap.units.length, state.units.length);
  assert.equal(snap.structures.filter((s) => s.kind !== 'core').length, 12);
  assert.ok(snap.power.points.length >= 6, 'the six scene points are in the snapshot');
});

test('toaster scenario: a count that cannot be split between two sides is refused', () => {
  assert.throws(() => buildToasterScenario({ units: 201 }), /even count/);
  assert.throws(() => buildToasterScenario({ points: 0 }), /at least 1/);
});

test('keepMarching gives an idle marching unit a new move order and leaves the rest alone', () => {
  const state = {
    width: 10, height: 10,
    units: [
      { id: 1, x: 2, y: 3, order: null },
      { id: 2, x: 4, y: 4, order: { type: 'move', x: 0, y: 0 } },
      { id: 3, x: 5, y: 5, order: null },
    ],
  };
  keepMarching(state, [1, 2]);
  assert.deepEqual(state.units[0].order, { type: 'move', x: 7, y: 6 });
  assert.deepEqual(state.units[1].order, { type: 'move', x: 0, y: 0 });
  assert.equal(state.units[2].order, null);
});

// ---- perf page helpers (request #5) ----
const perf = await import('../play/perf-toaster.mjs');

test('perf page: ?frames defaults to 120 and rejects junk; warm-up is 30 and excluded', () => {
  assert.equal(perf.DEFAULT_FRAMES, 120);
  assert.equal(perf.WARMUP_FRAMES, 30);
  assert.equal(perf.parseFrames(null), 120);
  assert.equal(perf.parseFrames('abc'), 120);
  assert.equal(perf.parseFrames('0'), 120);
  assert.equal(perf.parseFrames('45'), 45);
});

test('perf page: the camera frames the units bounding box at 16 to 24 tiles tall', () => {
  const { state } = buildToasterScenario();
  const fit = perf.frameUnits(state.units, 16 / 9);
  assert.ok(fit.zoom >= 16 && fit.zoom <= 24, `zoom ${fit.zoom}`);
  for (const u of state.units) assert.ok(u.x >= fit.box.x0 && u.x <= fit.box.x1 && u.y >= fit.box.y0 && u.y <= fit.box.y1);
  assert.equal(fit.cx, (fit.box.x0 + fit.box.x1) / 2);
  assert.equal(fit.cy, (fit.box.y0 + fit.box.y1) / 2);
  assert.equal(perf.frameUnits([{ x: 3, y: 3 }]).zoom, 16, 'a tiny box still opens at the 16-tile minimum');
});

test('perf page: viewport falls back from the canvas to the renderer to the window', () => {
  const win = { innerWidth: 800, innerHeight: 600, devicePixelRatio: 2 };
  assert.deepEqual(perf.viewportOf({ clientWidth: 1440, clientHeight: 900 }, null, win), { w: 1440, h: 900, dpr: 2 });
  const renderer = { getSize(v) { v.x = 1000; v.y = 500; } };
  assert.deepEqual(perf.viewportOf({ clientWidth: 0, clientHeight: 0 }, renderer, win), { w: 1000, h: 500, dpr: 2 });
  const zero = { getSize(v) { v.x = 0; v.y = 0; } };
  assert.deepEqual(perf.viewportOf({ clientWidth: 0, clientHeight: 0 }, zero, win), { w: 800, h: 600, dpr: 2 });
});

test('perf page: casters count instances, and the PERF line carries the agreed fields with sim apart', () => {
  const objs = [{ castShadow: true, isMesh: true }, { castShadow: true, isInstancedMesh: true, count: 200 }, { castShadow: false, isMesh: true }];
  assert.equal(perf.countCasters({ traverse: (fn) => objs.forEach(fn) }), 201);
  const line = perf.perfLine({
    quality: 'high', mode: 'render', units: 200, frames: 120, render: { median: 8, p95: 12 }, sim: { median: 3 },
    drawCalls: 90, triangles: 120000, casters: 201, viewport: { w: 1440, h: 900, dpr: 1 },
  });
  assert.equal(line.renderMedianMs, 8);
  assert.equal(line.renderP95Ms, 12);
  assert.equal(line.simMedianMs, 3);
  assert.equal(line.fps, 125);
  for (const k of ['drawCalls', 'triangles', 'units', 'viewport', 'casters']) assert.ok(k in line, k);
});

// ----- request #16: units=200 spawns 200 and the crowd keeps them -----
test('perf page: units=200 spawns exactly 200 toasters, and the sim timing never removes one from the crowd', () => {
  const build = () => buildToasterScenario({ units: 200 });
  const scene = build();
  const spawned = scene.state.units.length;
  assert.equal(spawned, 200, 'the requested count is the spawned count');
  const ms = perf.timeSimTicks(build, 40);
  assert.equal(ms.length, 40);
  assert.ok(ms.every((t) => Number.isFinite(t) && t >= 0));
  assert.equal(scene.state.units.length, spawned, 'the timed twin ticks leave the rendered scene whole');
});

test('perf page: the warm-up is excluded from the stats, so only the frames after it are summarised', async () => {
  const tick = async () => {};
  const warmup = perf.WARMUP_FRAMES;
  const run = await perf.driveFrames({ total: warmup + 5, warmup, tick, frame: (i) => i });
  assert.deepEqual(run.samples, [30, 31, 32, 33, 34]);
  assert.equal(perf.summarise(run.samples).n, 5);
});

// ----- request #6: the page always finishes and prints exactly one line -----
test('perf runner: reporter prints exactly one line, a PERF line or a PERF ERROR line', () => {
  const logs = [], errs = [], pub = [];
  const r = perf.createReporter({ log: (l) => logs.push(l), error: (l) => errs.push(l), publish: (p) => pub.push(p) });
  assert.equal(r.fail(new Error('boom')), true);
  assert.equal(r.finish({ a: 1 }), false, 'a later finish is ignored');
  assert.equal(r.fail('again'), false);
  assert.deepEqual(errs, ['PERF ERROR: boom']);
  assert.equal(logs.length, 0);
  assert.deepEqual(pub, [{ error: 'boom' }]);
  const ok = perf.createReporter({ log: (l) => logs.push(l), error: (l) => errs.push(l) });
  assert.equal(ok.finish({ renderMedianMs: 3.2 }), true);
  assert.equal(ok.fail('late'), false);
  assert.deepEqual(logs, ['PERF {"renderMedianMs":3.2}']);
  assert.equal(errs.length, 1);
});

test('perf runner: driveFrames returns samples, stops on a thrown frame, and honours the deadline', async () => {
  const tick = async () => {};
  const ok = await perf.driveFrames({ total: 10, warmup: 3, tick, frame: (i) => i });
  assert.deepEqual(ok.samples, [3, 4, 5, 6, 7, 8, 9]);
  assert.equal(ok.error, null);
  const bad = await perf.driveFrames({ total: 10, warmup: 3, tick, frame: (i) => { if (i === 6) throw new Error('gl lost'); return i; } });
  assert.equal(bad.error.message, 'gl lost');
  assert.deepEqual(bad.samples, [3, 4, 5]);
  let t = 0;
  const late = await perf.driveFrames({ total: 100, warmup: 0, tick, now: () => (t += 1000), deadlineMs: 5000, frame: (i) => i });
  assert.equal(late.timedOut, true);
  assert.ok(late.samples.length > 0 && late.samples.length < 100);
});

test('perf runner: nextFrame falls back to the timer when requestAnimationFrame never fires', async () => {
  const t0 = Date.now();
  await perf.nextFrame(() => {});
  assert.ok(Date.now() - t0 < 1000);
});

test('perf runner: frameUnits frames the units box 16-24 tiles tall, centred', () => {
  const f = perf.frameUnits([{ x: 10, y: 20 }, { x: 30, y: 36 }, { x: 20, y: 28 }], 16 / 9);
  assert.equal(f.cx, 20); assert.equal(f.cy, 28);
  assert.ok(f.zoom >= perf.ZOOM_MIN && f.zoom <= perf.ZOOM_MAX);
  assert.deepEqual(f.box, { x0: 10, y0: 20, x1: 30, y1: 36 });
  assert.equal(perf.frameUnits([{ x: 5, y: 5 }]).zoom, perf.ZOOM_MIN);
  assert.equal(perf.frameUnits([{ x: 0, y: 0 }, { x: 200, y: 200 }]).zoom, perf.ZOOM_MAX);
});

// ---- request #7: the camera must see the crowd ----
import * as THREE_NS from 'three';

test('perf camera: the scenario spreads units over the whole map, so gatherUnits packs them into one frame', () => {
  const { state } = buildToasterScenario();
  const raw = perf.frameUnits(state.units, 16 / 9);
  assert.equal(raw.zoom, perf.ZOOM_MAX, 'the raw spread cannot fit in 24 tiles');
  const g = perf.gatherUnits(state.units, 16 / 9);
  assert.equal(g.length, state.units.length);
  const fit = perf.frameUnits(g, 16 / 9);
  assert.ok(fit.zoom <= perf.ZOOM_MAX);
  assert.ok(fit.box.x1 - fit.box.x0 < 30 && fit.box.y1 - fit.box.y0 < 30, JSON.stringify(fit.box));
  const keys = new Set(g.map((p) => `${p.x},${p.y}`));
  assert.equal(keys.size, g.length, 'no two toasters on the same spot');
  assert.equal(perf.gatherUnits([], 16 / 9).length, 0);
});

test('perf camera: countInFrame counts units whose projection lands inside NDC -1..1', () => {
  const cam = new THREE_NS.OrthographicCamera(-10, 10, 5, -5, 0.1, 200);   // 20 wide, 10 tall
  cam.position.set(0, 50, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  const toWorld = (x, y, h = 0) => ({ x, y: h, z: y });
  const units = [{ x: 0, y: 0 }, { x: 9, y: 4 }, { x: -9, y: -4 }, { x: 11, y: 0 }, { x: 0, y: 6 }, { x: 40, y: 40 }];
  assert.equal(perf.countInFrame(units, toWorld, cam), 3);
  assert.equal(perf.countInFrame([], toWorld, cam), 0);
});

test('perf camera: the gathered crowd of 200 is >= 90% in frame from the real camera pose', () => {
  const { state } = buildToasterScenario();
  const aspect = 16 / 9;
  const g = perf.gatherUnits(state.units, aspect);
  state.units.forEach((u, i) => { u.x = g[i].x; u.y = g[i].y; });
  const fit = perf.frameUnits(state.units, aspect);
  const toWorld = (x, y, h = 0) => ({ x: x + 0.5 - 128, y: h, z: y + 0.5 - 128 });
  const cam = perf.cameraFor(THREE_NS, fit, toWorld, aspect);
  assert.ok(perf.countInFrame(state.units, toWorld, cam) >= 180);
});

test('perf camera: the PERF line carries inFrame, units and the tile target; widenZoom opens to the limit under 90%', () => {
  const line = perf.perfLine({
    quality: 'high', mode: 'render', units: 200, frames: 120, render: { median: 2, p95: 3 }, sim: { median: 1 },
    drawCalls: 40, triangles: 1000, casters: 5, viewport: { w: 10, h: 10 }, inFrame: 195, target: { x: 128, y: 128 },
  });
  assert.equal(line.inFrame, 195); assert.equal(line.units, 200); assert.deepEqual(line.target, { x: 128, y: 128 });
  assert.equal(perf.widenZoom({ zoom: 16 }, 150, 200), perf.ZOOM_MAX);
  assert.equal(perf.widenZoom({ zoom: 16 }, 190, 200), 16, 'already >= 90%: leave it');
});

// ----- request #17: the 200-toaster crowd sits in the middle of the frame -----
test('perf crowd: at 1440x900 at least 150 of the 200 toasters land in the central 70% of the frame, both teams in it', () => {
  const { state } = buildToasterScenario({ units: 200 });
  const aspect = 1440 / 900;
  const g = perf.gatherUnits(state.units, aspect);
  state.units.forEach((u, i) => { u.x = g[i].x; u.y = g[i].y; });
  const fit = perf.frameUnits(state.units, aspect);
  const toWorld = (x, y, h = 0) => ({ x: x + 0.5 - 128, y: h, z: y + 0.5 - 128 });
  const cam = perf.cameraFor(THREE_NS, fit, toWorld, aspect);
  const centre = perf.countCentre(state.units, toWorld, cam, 0.7);
  assert.ok(centre >= 150, `${centre} of 200 in the central 70%`);
  for (const side of [0, 1]) {
    const mine = state.units.filter((u) => u.owner === side);
    assert.ok(perf.countCentre(mine, toWorld, cam, 0.7) >= 75, `team ${side} is not visible in the middle`);
  }
  // A toaster is at least half a tile across; at 1440x900 a tile is 900 / zoom px tall and wide, so each is >= 18 px.
  assert.ok((900 / fit.zoom) * 0.5 >= 18, `zoom ${fit.zoom} makes a toaster under 18 px`);
});

test('perf crowd: the live world takes the gathered positions, so the drawn crowd matches the camera', () => {
  const src = readFileSync(new URL('../play/perf-toaster.mjs', import.meta.url), 'utf8');
  const gather = src.indexOf('gatherUnits(state.units, aspect).forEach');
  const refresh = src.indexOf('world.push(observeToaster(state, 0), [])', gather);
  assert.ok(gather > 0 && refresh > gather, 'a fresh snapshot is pushed after the gather');
});
