// toaster-sonnet (Normal) counter-builds from what it has seen, and raids Crumbs with Zappers and Bagels (card 6, Haiku B).
// Counter table: Broilers (howler) against massed Poppers and Zappers, Four-Slices (brute) against Broilers, Bagels (dart) for
// raids; every tier-3 kind waits for a standing Windmill or Dam (env/tiers.mjs). Owner: AI B (Haiku).
import test from 'node:test';
import assert from 'node:assert/strict';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer } from '../players/toaster-sonnet/bot.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));
const LATE = 24 * 60 * 3; // 3:00, after 1:30
const EARLY = 24 * 60 * 1; // 1:00, before 1:30
const TIER3 = 'windmill';

// A state where side 0 has a finished Strip and one finished Assembly Line, plus whatever the test adds.
function base(seed = 3) {
  const state = createToasterState(seed);
  const core = state.structures.find((s) => s.owner === 0 && s.kind === 'core');
  const forge = addStructure(state, 0, 'forge', core.x + 3, core.y + 3);
  return { state, core, forge };
}

let nextId = 90000;
function addStructure(state, owner, kind, x, y) {
  const s = { id: nextId++, owner, kind, x, y, hp: 400, progress: 0, complete: true, queue: [] };
  state.structures.push(s);
  return s;
}
function addUnit(state, owner, kind, x, y) {
  const u = { id: nextId++, owner, kind, x, y, hp: 50, carrying: null, order: null };
  state.units.push(u);
  return u;
}
function addWindmill(state) {
  state.power.points.push({ id: nextId++, owner: 0, kind: TIER3, x: 20, y: 20, range: 12 });
}
function trainsOf(cmds, forgeId) {
  return cmds.filter((c) => c.type === 'train' && c.building === forgeId).map((c) => c.kind);
}
function foesNearCore(state, core, kind, n) {
  for (let i = 0; i < n; i++) addUnit(state, 1, kind, core.x + 2 + (i % 3), core.y + 2 + Math.floor(i / 3));
}

test('before a Windmill stands, no tier-3 kind is trained (the Strip would refuse it)', () => {
  const { state, core, forge } = base();
  foesNearCore(state, core, 'grunt', 6);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const obs = clone(observe(state, 0));
  obs.tick = LATE;
  obs.shards = [5000, 5000];
  obs.wheat = [5000, 5000];
  const kinds = trainsOf(bot.act(obs), forge.id);
  assert.ok(kinds.length >= 1, 'the Assembly Line trains something');
  for (const k of kinds) assert.ok(k === 'grunt' || k === 'lancer', `${k} is tier 3`);
});

test('massed Poppers and Zappers seen: the Assembly Line trains Broilers', () => {
  const { state, core, forge } = base();
  addWindmill(state);
  foesNearCore(state, core, 'grunt', 4);
  foesNearCore(state, core, 'lancer', 2);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const obs = clone(observe(state, 0));
  obs.tick = LATE;
  obs.shards = [5000, 5000];
  obs.wheat = [5000, 5000];
  assert.equal(trainsOf(bot.act(obs), forge.id)[0], 'howler');
});

test('Broilers seen: the Assembly Line trains Four-Slices', () => {
  const { state, core, forge } = base();
  addWindmill(state);
  foesNearCore(state, core, 'howler', 1);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const obs = clone(observe(state, 0));
  obs.tick = LATE;
  obs.shards = [5000, 5000];
  obs.wheat = [5000, 5000];
  assert.equal(trainsOf(bot.act(obs), forge.id)[0], 'brute');
});

test('Bagels are trained for raids only after 1:30, with a Windmill standing', () => {
  const { state, core, forge } = base();
  addWindmill(state);
  const early = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const o1 = clone(observe(state, 0));
  o1.tick = EARLY;
  o1.shards = [5000, 5000];
  o1.wheat = [5000, 5000];
  assert.ok(!trainsOf(early.act(o1), forge.id).includes('dart'), 'no Bagel before 1:30');
  const late = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const o2 = clone(observe(state, 0));
  o2.tick = LATE;
  o2.shards = [5000, 5000];
  o2.wheat = [5000, 5000];
  assert.ok(trainsOf(late.act(o2), forge.id).includes('dart'), 'a Bagel after 1:30');
});

test('after 1:30 a Zapper hunts an enemy Crumb 8 tiles away; before 1:30 it does not', () => {
  const { state, core } = base();
  const zapper = addUnit(state, 0, 'lancer', core.x - 2, core.y);
  const crumb = addUnit(state, 1, 'worker', core.x + 6, core.y);
  const bot = createPlayer({ side: 0, stats: STATS, seed: 3 });
  const o1 = clone(observe(state, 0));
  o1.tick = EARLY;
  const early = bot.act(o1).filter((c) => c.type === 'attack' && c.unit === zapper.id);
  assert.ok(!early.some((c) => c.target === crumb.id), 'no raid before 1:30');
  const o2 = clone(observe(state, 0));
  o2.tick = LATE;
  const late = bot.act(o2).filter((c) => c.type === 'attack' && c.unit === zapper.id);
  assert.ok(late.some((c) => c.target === crumb.id), 'the Zapper attacks the Crumb');
});
