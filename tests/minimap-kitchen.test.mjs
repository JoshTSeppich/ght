// PLAYABLE.md item 28: the minimap marks for Toaster Wars (play/minimap-kitchen.mjs). Node-only, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateMap } from '../env/map.mjs';
import { createToasterState, observeToaster } from '../play/toaster-play.mjs';
import { kitchenSites, networkLines, createPings, drawKitchenMinimap, PING_TICKS } from '../play/minimap-kitchen.mjs';

const wheat = generateMap(3, { map: 'wheatfield' });

/** A stub 2d context that records calls, so the test can count what was drawn. */
function stubCtx() {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    fillRect: rec('fillRect'), beginPath: rec('beginPath'), moveTo: rec('moveTo'), lineTo: rec('lineTo'),
    arc: rec('arc'), stroke: rec('stroke'), fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
  };
}

test('the Wheatfield map gives windmill pads and one Mill Dam site', () => {
  const sites = kitchenSites(wheat);
  assert.equal(sites.pads.length, wheat.sockets.length);
  assert.ok(sites.pads.length > 0, 'the map has windmill pads');
  assert.ok(sites.dam, 'the Mill Dam is on the map');
  assert.ok(sites.dam.tiles.length >= 4, 'the dam gap is at least four tiles');
  // The dam centre sits on the river, between the two sides.
  assert.ok(Math.abs(sites.dam.x - 127.5) < 3 && Math.abs(sites.dam.y - 127.5) < 3);
});

test('kitchenSites has no dam when the map does not', () => {
  const sites = kitchenSites({ sockets: [[1, 2]], extras: null });
  assert.deepEqual(sites.pads, [{ x: 1, y: 2 }]);
  assert.equal(sites.dam, null);
});

test('networkLines links own points within the larger range and never draws enemy points', () => {
  const points = [
    { id: 1, owner: 0, x: 0, y: 0, range: 10 },
    { id: 2, owner: 0, x: 9, y: 0, range: 4 },   // 9 apart: within the larger range (10)
    { id: 3, owner: 0, x: 30, y: 0, range: 4 },  // too far from both
    { id: 4, owner: 1, x: 1, y: 1, range: 10 },  // enemy: ignored
  ];
  const net = networkLines(points, 0);
  assert.equal(net.points.length, 3);
  assert.deepEqual(net.lines.map(([a, b]) => [a.id, b.id]), [[1, 2]]);
});

test('an attack ping appears where your unit loses hp, and fades after PING_TICKS', () => {
  const pings = createPings();
  const before = { width: 8, height: 8, units: [{ id: 7, owner: 0, x: 3, y: 4, hp: 50 }], structures: [] };
  const hit = { width: 8, height: 8, units: [{ id: 7, owner: 0, x: 3, y: 4, hp: 40 }], structures: [] };
  assert.deepEqual(pings.update(before, 0, 10), [], 'the first snapshot only records');
  const live = pings.update(hit, 0, 12);
  assert.equal(live.length, 1);
  assert.deepEqual([live[0].x, live[0].y], [3, 4]);
  assert.equal(pings.update(hit, 0, 12 + PING_TICKS).length, 0, 'the ping is gone when its time is up');
});

test('enemy damage does not ping your minimap', () => {
  const pings = createPings();
  const a = { units: [{ id: 9, owner: 1, x: 1, y: 1, hp: 20 }], structures: [] };
  const b = { units: [{ id: 9, owner: 1, x: 1, y: 1, hp: 5 }], structures: [] };
  pings.update(a, 0, 1);
  assert.equal(pings.update(b, 0, 2).length, 0);
});

test('drawKitchenMinimap draws pads, the dam, the network and pings on a real Toaster Wars state', () => {
  const state = createToasterState(3);
  const snap = observeToaster(state, 0);
  const ctx = stubCtx();
  const sx = 160 / wheat.width, sy = 160 / wheat.height;
  const pings = [{ x: 10, y: 10, tick: 0 }];
  drawKitchenMinimap(ctx, { snap, side: 0, sites: kitchenSites(wheat), pings, tick: 5, sx, sy });
  const arcs = ctx.calls.filter((c) => c[0] === 'arc').length;
  assert.ok(arcs >= wheat.sockets.length, 'every windmill pad gets a ring');
  assert.ok(arcs >= wheat.sockets.length + pings.length, 'the ping ring is drawn too');
  assert.ok(ctx.calls.some((c) => c[0] === 'fillRect'), 'the dam and network dots are drawn');
});
