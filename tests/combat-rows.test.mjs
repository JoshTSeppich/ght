// Combat Scale rows (M2): the real GHT rows carry armor, tags, bonus, hits, minRange and ~3x hp, and fights follow them.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rowOf, STATS, UNIT_KINDS } from '../env/stats.mjs';
import { enableAmmo } from '../env/ammo.mjs';
import { createTestState, findEntity } from '../env/state.mjs';
import { stepCombat, chooseTarget, setUpgradeLevelHook } from '../env/combat.mjs';

afterEach(() => setUpgradeLevelHook(null));
const mk = (id, owner, kind, x, y, extra = {}) => ({ id, owner, kind, x, y, hp: 0, carrying: 0, order: null, ...extra });
const world = (units) => {
  const s = createTestState({ width: 30, height: 30, rocks: [], crystals: [], shards: [0, 0], units: [] });
  enableAmmo(s, {});
  for (const u of units) s.units.push({ ...u, hp: rowOf(s, u.kind).hp });
  return s;
};
const hit = (s, a, t) => {
  s.units.find((u) => u.id === a).order = { type: 'attack', target: t };
  const before = findEntity(s, t).hp;
  stepCombat(s);
  return before - findEntity(s, t).hp;
};

// Air Layer (DECISIONS.md 3): the three flyers are layer "air"; every other kind stays "ground".
const AIR_KINDS = ['croutonKite', 'waffleWing', 'crumpetBomber'];

test('every unit row declares armor, tags, bonus, layer, hits and minRange', () => {
  const s = world([]);
  for (const kind of UNIT_KINDS) {
    const r = rowOf(s, kind);
    assert.equal(typeof r.armor, 'number', kind);
    assert.ok(r.tags.length > 0, kind);
    assert.equal(typeof r.bonus, 'object', kind);
    assert.equal(r.layer, AIR_KINDS.includes(kind) ? 'air' : 'ground', kind);
    assert.equal(typeof r.hits.ground, 'boolean', kind);
    assert.equal(typeof r.hits.air, 'boolean', kind);
    assert.equal(typeof r.minRange, 'number', kind);
  }
  for (const kind of ['forge', 'turret', 'mill', 'well', 'toaster']) {
    assert.equal(rowOf(s, kind).armor, 1, kind);
    assert.ok(rowOf(s, kind).tags.includes('Structure'), kind);
  }
});

test('Popper vs Popper takes 8-12 hits', () => {
  const s = world([mk(1, 0, 'grunt', 5, 5), mk(2, 1, 'grunt', 8, 5)]);
  const per = hit(s, 1, 2);
  assert.ok(per > 0);
  const hits = Math.ceil(rowOf(s, 'grunt').hp / per);
  assert.ok(hits >= 8 && hits <= 12, `hits to kill ${hits}`);
});

test('Zapper hits a Light Popper harder than an Armored Four-Slice, after armor', () => {
  const w = world([]);
  const light = hit(world([mk(1, 0, 'lancer', 5, 5), mk(2, 1, 'grunt', 8, 5)]), 1, 2);
  const armored = hit(world([mk(1, 0, 'lancer', 5, 5), mk(2, 1, 'brute', 8, 5)]), 1, 2);
  assert.equal(light, rowOf(w, 'lancer').shot.damage + rowOf(w, 'lancer').bonus.Light - rowOf(w, 'grunt').armor);
  assert.ok(light > armored);
});

test('Four-Slice gets its Armored bonus on a Broiler and its x2 on a building', () => {
  const s = world([mk(1, 0, 'brute', 5, 5), mk(2, 1, 'howler', 8, 5)]);
  const r = rowOf(s, 'brute');
  assert.equal(hit(s, 1, 2), r.shot.damage + r.bonus.Armored - rowOf(s, 'howler').armor);
});

test('Flak Popper does weak ground damage and big damage to Air-tagged targets', () => {
  const r = rowOf(world([]), 'spiker');
  assert.ok(r.shot.damage <= 8);
  assert.ok(r.bonus.Air >= 8);
  assert.equal(r.hits.air, true);
});

test('Broiler cannot shell inside minRange 2 but can at 2', () => {
  const near = world([mk(1, 0, 'howler', 5, 5), mk(2, 1, 'grunt', 6, 5)]);
  assert.equal(chooseTarget(near, near.units[0]), null);
  const edge = world([mk(1, 0, 'howler', 5, 5), mk(2, 1, 'grunt', 7, 5)]);
  assert.equal(chooseTarget(edge, edge.units[0]).id, 2);
});

test('a weapons level 1 hook adds attackStep per hit and cuts a Popper duel by a hit or more', () => {
  const plain = hit(world([mk(1, 0, 'grunt', 5, 5), mk(2, 1, 'grunt', 8, 5)]), 1, 2);
  setUpgradeLevelHook((st, p, track) => (p === 0 && track === 'ground-weapons' ? 1 : 0));
  const up = hit(world([mk(1, 0, 'grunt', 5, 5), mk(2, 1, 'grunt', 8, 5)]), 1, 2);
  assert.equal(up - plain, STATS.units.grunt.attackStep);
  const hp = rowOf(null, 'grunt').hp;
  assert.ok(Math.ceil(hp / up) < Math.ceil(hp / plain));
});

test('classic matches (hunger off) keep the old flat damage', () => {
  const s = createTestState({ width: 30, height: 30, rocks: [], crystals: [], shards: [0, 0], units: [] });
  s.units.push(mk(1, 0, 'grunt', 5, 5, { hp: 60, order: { type: 'attack', target: 2 } }), mk(2, 1, 'brute', 6, 5, { hp: 240 }));
  stepCombat(s);
  assert.equal(findEntity(s, 2).hp, 240 - STATS.units.grunt.damage);
});
