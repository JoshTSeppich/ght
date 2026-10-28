// H2 (SYSTEMS-DESIGN.md section 4): holding Alt draws every Well crowding ring and every cord reach (state.power points)
// as faint rings. altRings() is the pure list; drawAltRings() strokes it on the 2D overlay through the page's projection.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BAKERY } from '../env/bakery.mjs';
import { altRings, drawAltRings } from '../play/power-stations-3d.mjs';

const base = (extra = {}) => ({ tick: 0, width: 60, height: 60, units: [], structures: [], power: { points: [] }, ...extra });
const well = (id, owner, x, y, complete = true) => ({ id, owner, kind: 'well', x, y, hp: 100, complete });

test('every complete Well of any owner gets a crowding ring of the Wells radius', () => {
  const state = base({ structures: [well(1, 0, 5, 5), well(2, 1, 40, 40), well(3, 0, 9, 9, false)] });
  const rings = altRings(state, 0).filter((r) => r.what === 'well');
  assert.deepEqual(rings.map((r) => [r.x, r.y, r.r]), [[5, 5, BAKERY.wellCrowdRadius], [40, 40, BAKERY.wellCrowdRadius]]);
  assert.equal(BAKERY.wellCrowdRadius, 8, 'the spec radius R = 8');
});

test('every cord reach in state.power.points gets a ring; points with no range (generators) get none', () => {
  const state = base({
    power: { points: [
      { id: 10, owner: 0, kind: 'pylon', x: 3, y: 3, range: 8 },
      { id: 11, owner: 1, kind: 'outlet', x: 30, y: 30, range: 10 },
      { id: 12, owner: 0, kind: 'windmill', x: 6, y: 6, range: 0 },
    ] },
  });
  const rings = altRings(state, 0).filter((r) => r.what === 'cord');
  assert.deepEqual(rings.map((r) => [r.x, r.y, r.r, r.owner]), [[3, 3, 8, 0], [30, 30, 10, 1]]);
});

test('the view points are preferred over the raw points when the page has built a view', () => {
  const state = base({ power: { points: [], view: { points: [{ id: 1, owner: 1, kind: 'strip', x: 2, y: 2, range: 14 }] } } });
  assert.deepEqual(altRings(state, 0).filter((r) => r.what === 'cord').map((r) => r.r), [14]);
});

test('no Wells and no power is no rings, and a state without power does not throw', () => {
  assert.deepEqual(altRings(base(), 0), []);
  assert.deepEqual(altRings({ tick: 0, width: 1, height: 1, units: [], structures: [] }, 0), []);
});

test('drawAltRings strokes one faint ring per entry, through the projection', () => {
  const calls = { stroke: 0, arcs: 0, alpha: [] };
  const ctx = {
    globalAlpha: 1, lineWidth: 1, strokeStyle: '', setLineDash() {},
    beginPath() {}, moveTo() {}, closePath() {},
    lineTo() { calls.arcs += 1; },
    stroke() { calls.stroke += 1; calls.alpha.push(this.globalAlpha); },
  };
  const state = base({ structures: [well(1, 0, 5, 5)], power: { points: [{ id: 10, owner: 1, kind: 'pylon', x: 3, y: 3, range: 8 }] } });
  const project = (x, y) => ({ sx: x * 10, sy: y * 10 });
  drawAltRings(ctx, state, 0, project, 30);
  assert.equal(calls.stroke, 2);
  assert.ok(calls.arcs >= 2 * 24, 'each ring is a polyline of at least 24 segments');
  assert.ok(calls.alpha.every((a) => a > 0 && a <= 0.5), 'faint');
  assert.equal(ctx.globalAlpha, 1, 'the alpha is restored after drawing');
});
