// Energy (PLAYABLE.md items 20 and 21): Windmills and Dams make it, Toasters and fences use it, a short network browns out
// fences first and then Toasters, the Strip always makes a little. Owner: sonnet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { isFree, isPassable, observe } from '../env/state.mjs';
import { createPlayableState as createToasterState, createToasterState as bare } from '../play/toaster-play.mjs';
import { ENERGY, WHEATFIELD_SITES, powerOf } from '../env/energy.mjs';
import { POWER } from '../env/power.mjs';
import { STATS } from '../env/stats.mjs';

const rejects = (ev) => ev.filter((e) => e.e === 'reject');
const toaster = (s, id, x, y, owner = 0) => s.structures.push({ id, owner, kind: 'toaster', x, y, hp: 250, progress: 0, complete: true, queue: [] });
const settle = (s, n = 2) => { for (let i = 0; i < n; i++) step(s, [[], []]); };
const build = (s, kind, x, y, wheat = 500) => {
  const w = s.units.find((u) => u.owner === 0 && u.kind === 'worker');
  w.x = x + 1; w.y = y; s.shards[0] = wheat;
  return step(s, [[{ type: 'place-power', unit: w.id, kind, x, y }], []]);
};

test('the Wheatfield sites are free ground and mirror each other', () => {
  const s = createToasterState(5);
  const sites = WHEATFIELD_SITES;
  assert.equal(sites.filter((q) => q.kind === 'windmill').length, 8);
  assert.equal(sites.filter((q) => q.kind === 'milldam').length, 1);
  for (const q of sites) assert.ok(isPassable(s, q.x, q.y) && isFree(s, q.x, q.y), `${q.kind} ${q.x},${q.y}`);
  for (const q of sites.filter((r) => r.kind !== 'milldam')) {
    assert.ok(sites.some((r) => r.kind === q.kind && r.x === 255 - q.x && r.y === 255 - q.y), `mirror of ${q.x},${q.y}`);
  }
});

test('a Windmill goes on a pad only, costs its price and makes Energy', () => {
  const s = createToasterState(5);
  s.power.points.push({ id: 900, owner: 0, kind: 'extension', x: 30, y: 226, range: 12 }); // the cord reaches the pad
  assert.equal(rejects(build(s, 'windmill', 33, 226))[0].reason, 'not-a-site');
  assert.equal(rejects(build(s, 'windmill', 30, 224, 20))[0].reason, 'no-shards');
  const ev = build(s, 'windmill', 30, 224, 100);
  assert.deepEqual(rejects(ev), []);
  assert.equal(s.shards[0], 100 - ENERGY.cost.windmill);
  const wm = s.power.points.find((p) => p.kind === 'windmill');
  assert.equal(wm.make, ENERGY.make.windmill);
  settle(s);
  assert.equal(powerOf(s, 0).made, ENERGY.make.strip + ENERGY.make.windmill);
});

test('a Windmill cannot take a dam site and the Mill Dam is the big prize', () => {
  const s = createToasterState(5);
  s.power.points.push({ id: 900, owner: 0, kind: 'extension', x: 130, y: 127, range: 12 });
  assert.equal(rejects(build(s, 'windmill', 131, 127))[0].reason, 'not-a-site');
  assert.deepEqual(rejects(build(s, 'dam', 131, 127, 300)), []);
  assert.equal(s.shards[0], 300 - ENERGY.cost.milldam);
  assert.equal(s.power.points.find((p) => p.kind === 'dam').make, ENERGY.make.milldam);
  assert.ok(ENERGY.make.milldam > 2 * ENERGY.make.dam && ENERGY.make.dam > ENERGY.make.windmill);
});

test('the Strip alone feeds one Toaster; the second goes dark until a Windmill is built', () => {
  const s = createToasterState(5);
  toaster(s, 70, 22, 228); toaster(s, 71, 24, 228);
  settle(s);
  assert.deepEqual(powerOf(s, 0), { made: 2, used: 4, shed: 1 });
  assert.ok(s.energy.shedToasters.has(71) && !s.energy.shedToasters.has(70), 'the newest goes dark first');
  s.power.points.push({ id: 900, owner: 0, kind: 'windmill', x: 26, y: 228, range: 0, make: 3 });
  settle(s);
  assert.deepEqual(powerOf(s, 0), { made: 5, used: 4, shed: 0 });
  assert.equal(s.energy.shedToasters.size, 0);
});

test('a brown-out drops the fence before it touches a Toaster', () => {
  const s = createToasterState(5);
  toaster(s, 70, 22, 228);
  s.power.points.push({ id: 900, owner: 0, kind: 'extension', x: 24, y: 232, range: 8 });
  s.power.fenceLinks.add('1-900'); // Strip to box: a short fence = 1 Energy
  settle(s);
  const r = powerOf(s, 0);
  assert.equal(r.made, 2);
  assert.ok(r.used > r.made, 'fence + Toaster ask for more than the Strip makes');
  assert.equal(s.energy.shedFences.size, 1);
  assert.equal(s.energy.shedToasters.size, 0);
  s.power.points.push({ id: 901, owner: 0, kind: 'windmill', x: 26, y: 228, range: 0, make: 3 });
  settle(s);
  assert.equal(s.energy.shedFences.size, 0, 'energy back: the fence rises again by itself');
});

test('brown-out is per network: an island without energy sheds, the home network is untouched', () => {
  const s = createToasterState(5);
  toaster(s, 70, 22, 228);
  s.power.points.push({ id: 900, owner: 0, kind: 'extension', x: 80, y: 140, range: 12 });
  toaster(s, 71, 81, 140);
  settle(s);
  assert.ok(!s.energy.shedToasters.has(70));
  assert.ok(s.energy.shedToasters.has(71), 'the island makes nothing, so its own Toaster goes dark');
});

test('observe shows your own Power numbers and nobody else is leaked', () => {
  const s = createToasterState(5);
  toaster(s, 70, 22, 228);
  settle(s);
  assert.deepEqual(observe(s, 0).power.energy, { made: 2, used: 2, shed: 0 });
  assert.deepEqual(observe(s, 1).power.energy, { made: 2, used: 0, shed: 0 });
});

test('a Generator lights its network and makes a little Energy (it is not a dead weight)', () => {
  const s = createToasterState(5);
  const strip = s.structures.find((b) => b.kind === 'core' && b.owner === 0);
  s.power.points.push({ id: 950, owner: 0, kind: 'generator', x: strip.x + 3, y: strip.y, range: POWER.range.generator });
  settle(s);
  assert.equal(powerOf(s, 0).made, ENERGY.make.strip + ENERGY.make.generator);
});

test('deterministic: the same match gives the same sums', () => {
  const run = () => {
    const s = createToasterState(9);
    toaster(s, 70, 22, 228); toaster(s, 71, 24, 228); toaster(s, 72, 26, 228);
    settle(s, 30);
    return JSON.stringify([s.energy.report, [...s.energy.shedToasters]]);
  };
  assert.equal(run(), run());
});

test('item 21: ten Extension Boxes cost about one Popper squad', () => {
  const chain = 10 * POWER.cost.extension;
  const squad = 4 * STATS.units.grunt.cost; // the opening squad of PLAYABLE.md item 14
  assert.equal(POWER.cost.extension, 30);
  assert.equal(POWER.cost.pylon, 60);
  assert.ok(chain >= 0.75 * squad && chain <= 1.25 * squad, `${chain} wheat of boxes vs ${squad} for four Poppers`);
});

test('the playable match holds both sides to the same energy rules and the bare toaster match has none', () => {
  assert.equal(bare(5).energy, undefined);
  const s = createToasterState(5);
  toaster(s, 70, 22, 228); toaster(s, 71, 24, 228);
  toaster(s, 80, 233, 27, 1); toaster(s, 81, 231, 27, 1);
  settle(s);
  assert.deepEqual(powerOf(s, 1), { made: 2, used: 4, shed: 1 }); // no exemption: the newest Toaster goes dark
  assert.equal(s.energy.shedToasters.has(81), true);
});
