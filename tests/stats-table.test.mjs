// stats-table: shape of STATS, costs from the spec tables, valueOf and sideValue.
// Shape (from env/stats.mjs): STATS.units[kind], STATS.structures[kind] (forge, turret), STATS.core, STATS.match,
// STATS.crystal, STATS.referee.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATS, UNIT_KINDS, STRUCTURE_KINDS, valueOf, sideValue, ECONOMY } from '../env/stats.mjs';

const UNIT_FIELDS = ['cost', 'hp', 'damage', 'range', 'speed', 'trainTicks'];
// Costs come from the ECONOMY table (re-priced for GHT); the other columns are spec section 5.
const SPEC_UNITS = {
  worker: { cost: ECONOMY.units.worker.wheat, hp: 120, // M2 Combat Scale (DECISIONS.md 1): 3x hp, 40 -> 120
 damage: 2, range: 1, speed: 1, trainTicks: 20 },
  grunt: { cost: ECONOMY.units.grunt.wheat, hp: 60, damage: 8, range: 1, speed: 1, trainTicks: 15 },
  lancer: { cost: ECONOMY.units.lancer.wheat, hp: 40, damage: 10, range: 4, speed: 1, trainTicks: 20 },
  brute: { cost: ECONOMY.units.brute.wheat, hp: 240, damage: 25, range: 1, speed: 2, trainTicks: 40 },
};
const SPEC_STRUCTURES = {
  forge: { cost: 150, hp: 400, buildTicks: 40 },
  turret: { cost: 100, hp: 150, buildTicks: 30 },
};

const isPosNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;

// The four spec units keep their classic numbers; the GHT roster adds Broiler, Flak Popper and Bagel
// (howler, spiker, dart), the kitchen (mill, well, toaster), and the Air Layer (DECISIONS.md 3): Crouton Kite,
// Waffle Wing, Crumpet Bomber and the Cooling Rack. tests/toaster-roster.test.mjs covers those.
test('unit kinds list is the four spec units plus the three GHT kinds', () => {
  assert.deepEqual(
    [...UNIT_KINDS].sort(),
    [...Object.keys(SPEC_UNITS), 'dart', 'howler', 'spiker', 'croutonKite', 'waffleWing', 'crumpetBomber'].sort(),
  );
});

test('structure kinds list is the buildable ones; the Core is kept in STATS.core', () => {
  assert.deepEqual([...STRUCTURE_KINDS].sort(), ['coolingRack', 'forge', 'mill', 'toaster', 'turret', 'well']);
});

test('every unit kind has every required field as a positive number', () => {
  for (const kind of UNIT_KINDS) {
    assert.ok(STATS.units[kind], `STATS.units.${kind} missing`);
    for (const f of UNIT_FIELDS) {
      // The Crouton Kite is a true scout (DECISIONS.md 3): it carries no `damage` field at all, like the Core.
      if (f === 'damage' && kind === 'croutonKite') {
        assert.equal(STATS.units[kind].damage, undefined, 'the Crouton Kite scout has no attack');
        continue;
      }
      assert.ok(isPosNum(STATS.units[kind][f]), `STATS.units.${kind}.${f} = ${STATS.units[kind][f]}`);
    }
  }
});

test('every structure kind has cost, hp and buildTicks as positive numbers; the Core has hp', () => {
  assert.ok(isPosNum(STATS.core.hp), 'core.hp');
  for (const kind of STRUCTURE_KINDS) {
    for (const f of ['cost', 'hp', 'buildTicks']) {
      assert.ok(isPosNum(STATS.structures[kind][f]), `${kind}.${f}`);
    }
  }
});

test('unit numbers match spec section 5', () => {
  for (const [kind, want] of Object.entries(SPEC_UNITS)) {
    for (const [f, v] of Object.entries(want)) {
      assert.equal(STATS.units[kind][f], v, `${kind}.${f}`);
    }
  }
});

test('structure numbers match spec section 4', () => {
  for (const [kind, want] of Object.entries(SPEC_STRUCTURES)) {
    for (const [f, v] of Object.entries(want)) {
      assert.equal(STATS.structures[kind][f], v, `${kind}.${f}`);
    }
  }
  assert.equal(STATS.core.hp, 1000);
  assert.equal(STATS.structures.turret.damage, 12);
  assert.equal(STATS.structures.turret.range, 5);
});

test('global numbers match the spec', () => {
  assert.equal(STATS.match.startShards, 100);
  assert.equal(STATS.match.unitCap, 40);
  assert.equal(STATS.match.maxTicks, 21600); // 15 minutes at 24 ticks a second (was 2000)
  assert.equal(STATS.match.queueMax, 5);
  assert.equal(STATS.crystal.amount, 400);
  assert.equal(STATS.crystal.mineTicks, 8);
  assert.equal(STATS.crystal.carry, 10);
  assert.equal(STATS.referee.thinkMs, 50);
  assert.equal(STATS.referee.hardMs, 1000);
  assert.equal(STATS.referee.throwLimit, 50);
});

test('valueOf gives cost for every unit kind', () => {
  for (const [kind, want] of Object.entries(SPEC_UNITS)) {
    assert.equal(valueOf({ kind, hp: 1 }), want.cost, kind);
  }
});

test('valueOf gives cost for complete structures', () => {
  assert.equal(valueOf({ kind: 'forge', complete: true }), 150);
  assert.equal(valueOf({ kind: 'turret', complete: true }), 100);
});

test('valueOf gives 0 for the Core, complete or not', () => {
  assert.equal(valueOf({ kind: 'core', complete: true }), 0);
  assert.equal(valueOf({ kind: 'core' }), 0);
});

test('valueOf gives 0 for unfinished sites', () => {
  assert.equal(valueOf({ kind: 'forge', complete: false, progress: 10, hp: 100 }), 0);
  assert.equal(valueOf({ kind: 'turret', complete: false, progress: 0, hp: 1 }), 0);
});

test('sideValue adds Shards, units and complete buildings for that side only', () => {
  const state = {
    shards: [30, 999],
    units: [
      { id: 3, owner: 0, kind: 'worker' },
      { id: 4, owner: 0, kind: 'brute' },
      { id: 5, owner: 1, kind: 'lancer' },
    ],
    structures: [
      { id: 1, owner: 0, kind: 'core', complete: true },
      { id: 11, owner: 0, kind: 'forge', complete: true },
      { id: 12, owner: 0, kind: 'turret', complete: false },
      { id: 2, owner: 1, kind: 'core', complete: true },
      { id: 13, owner: 1, kind: 'turret', complete: true },
    ],
  };
  assert.equal(sideValue(state, 0), 30 + ECONOMY.units.worker.wheat + ECONOMY.units.brute.wheat + STATS.structures.forge.cost);
  assert.equal(sideValue(state, 1), 999 + ECONOMY.units.lancer.wheat + STATS.structures.turret.cost);
});

test('sideValue with nothing but Shards is just the Shards', () => {
  const state = { shards: [100, 0], units: [], structures: [] };
  assert.equal(sideValue(state, 0), 100);
  assert.equal(sideValue(state, 1), 0);
});
