// Wells crowd each other (SYSTEMS-DESIGN.md section 1, ticket W1). For a Well W, every OTHER standing Well of ANY owner at
// Chebyshev distance d < wellCrowdRadius (R = 8) adds (1 - d / R) to a sum, and W draws at base / (1 + sum): 10 a minute
// alone, and the rate is recomputed every beat. A spring Well keeps its every-second-beat halving on top. The pantry cap is
// 6 plus 3 for each complete Toaster on that side. A Well may not be placed within 6 tiles of an enemy structure.
// Headless: drives stepBakery and the build command directly, no renderer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { applyCommands } from '../env/commands.mjs';
import { isFree } from '../env/state.mjs';
import { BAKERY, stepBakery, observeBakery, pantryCapOf, wellPlaceReason } from '../env/bakery.mjs';

const W = BAKERY.wellTicks; // one Well alone: 6 s
const SPRING_W = W * BAKERY.springEvery;
// The beat interval for a crowd sum: W times (1 + sum). Every worked example below comes out a whole number of ticks.
const beat = (sum) => Math.round(W * (1 + sum));
// One decimal, as the spec quotes rates ("5.7 / min").
const tenth = (x) => Math.round(x * 10) / 10;

// A match with only the two Strips: no starting Wells or Toasters, and no water on the map, so every Well draws at the creek rate.
function bare() {
  const s = createTerritoryMatch(7);
  s.structures = s.structures.filter((x) => x.kind === 'core');
  s.bakery.water = null;
  s.bakery.springs = [];
  for (const side of [0, 1]) Object.assign(s.toast.pantry[side], { flour: 0, water: 0 });
  return s;
}
let nextId = 5000;
const building = (s, kind, owner, x, y, complete = true) => {
  const b = { id: nextId++, owner, kind, x, y, hp: 100, complete, queue: [] };
  s.structures.push(b);
  return b;
};
// The first call to stepBakery is tick 1, the first sight of a Well, so its first draw comes one interval later.
const tickTo = (s, n) => { while (s.tick < n) { s.tick++; stepBakery(s); } };
const water = (s, side) => s.toast.pantry[side].water;

test('the spec numbers: radius 8 for crowding, 6 tiles from an enemy for placement', () => {
  assert.equal(BAKERY.wellCrowdRadius, 8);
  assert.equal(BAKERY.wellEnemyReach, 6);
  assert.equal(W, 144, 'six seconds at 24 ticks a second');
});

test('a Well alone makes 10 Water a minute, one every six seconds', () => {
  const s = bare();
  const w = building(s, 'well', 0, 40, 40);
  tickTo(s, 1);
  assert.equal(w.crowd, 0, 'no other Well in reach');
  assert.equal(w.rateTicks, W);
  assert.equal(w.ratePerMin, 10);
  tickTo(s, W);
  assert.equal(water(s, 0), 0, 'no draw before the interval ends');
  tickTo(s, 1 + W);
  assert.equal(water(s, 0), 1, 'one Water at six seconds');
  tickTo(s, 1 + 2 * W);
  assert.equal(water(s, 0), 2, 'and one more six seconds later');
});

test('two Wells 2 apart: 5.7 a minute each, 11.4 together', () => {
  const s = bare();
  const a = building(s, 'well', 0, 40, 40), b = building(s, 'well', 0, 42, 40);
  tickTo(s, 1);
  assert.equal(a.crowd, 1);
  assert.equal(b.crowd, 1);
  assert.equal(tenth(a.ratePerMin), 5.7);
  assert.equal(tenth(b.ratePerMin), 5.7);
  assert.equal(tenth(a.ratePerMin + b.ratePerMin), 11.4);
  assert.equal(a.rateTicks, beat(0.75), '10 / 1.75 a minute: a beat every 10.5 s');
  tickTo(s, 1 + beat(0.75) - 1);
  assert.equal(water(s, 0), 0, 'not yet at 10.5 s');
  tickTo(s, 1 + beat(0.75));
  assert.equal(water(s, 0), 2, 'both draw on the same beat');
});

test('two Wells 5 apart: 7.3 a minute each, 14.5 together', () => {
  const s = bare();
  const a = building(s, 'well', 0, 40, 40), b = building(s, 'well', 0, 45, 40);
  tickTo(s, 1);
  assert.equal(tenth(a.ratePerMin), 7.3);
  assert.equal(tenth(b.ratePerMin), 7.3);
  assert.equal(tenth(a.ratePerMin + b.ratePerMin), 14.5);
});

test('three Wells all 2 apart: 4.0 a minute each, 12.0 together', () => {
  const s = bare();
  const ws = [building(s, 'well', 0, 40, 40), building(s, 'well', 0, 42, 40), building(s, 'well', 0, 40, 42)];
  tickTo(s, 1);
  for (const w of ws) {
    assert.equal(w.crowd, 2);
    assert.equal(tenth(w.ratePerMin), 4);
    assert.equal(w.rateTicks, beat(1.5));
  }
  assert.equal(tenth(ws.reduce((t, w) => t + w.ratePerMin, 0)), 12);
});

test('two Wells 8 apart do not crowd: 10 a minute each, 20 together', () => {
  const s = bare();
  const a = building(s, 'well', 0, 40, 40), b = building(s, 'well', 0, 48, 40);
  tickTo(s, 1);
  assert.equal(a.crowd, 0, 'eight tiles is not inside R = 8');
  assert.equal(b.crowd, 0);
  assert.equal(a.ratePerMin, 10);
  assert.equal(b.ratePerMin, 10);
});

test('two Wells 7 apart are inside R: 8.9 a minute each', () => {
  const s = bare();
  const a = building(s, 'well', 0, 40, 40), b = building(s, 'well', 0, 47, 40);
  tickTo(s, 1);
  assert.equal(a.crowd, 1);
  assert.equal(tenth(a.ratePerMin), 8.9, '10 / 1.125');
  assert.equal(tenth(b.ratePerMin), 8.9);
});

test('distance is Chebyshev: a Well 6 tiles off on both axes shares at 8.0 a minute', () => {
  const s = bare();
  const a = building(s, 'well', 0, 40, 40), b = building(s, 'well', 0, 46, 46);
  tickTo(s, 1);
  assert.equal(a.crowd, 1, '(46,46) is six tiles off on both axes: counted');
  assert.equal(tenth(a.ratePerMin), 8, '10 / 1.25');
  assert.equal(b.crowd, 1);
});

test('an enemy Well 3 tiles off slows both sides: 6.2 a minute each', () => {
  const s = bare();
  const mine = building(s, 'well', 0, 40, 40), theirs = building(s, 'well', 1, 43, 40);
  tickTo(s, 1);
  assert.equal(mine.crowd, 1, 'an enemy Well within reach counts');
  assert.equal(theirs.crowd, 1);
  assert.equal(tenth(mine.ratePerMin), 6.2);
  assert.equal(tenth(theirs.ratePerMin), 6.2);
  tickTo(s, 1 + beat(0.625));
  assert.equal(water(s, 0), 1, 'my Well drew once, into my pantry');
  assert.equal(water(s, 1), 1, 'their Well drew once, into their pantry');
});

test('a dead or unbuilt Well does not crowd anyone', () => {
  const s = bare();
  const w = building(s, 'well', 0, 40, 40);
  building(s, 'well', 0, 42, 40, false);
  building(s, 'well', 1, 41, 40).hp = 0;
  tickTo(s, 1);
  assert.equal(w.crowd, 0);
  assert.equal(w.rateTicks, W);
  assert.equal(w.ratePerMin, 10);
});

test('a dry Well draws nothing and makes 0 a minute', () => {
  const s = bare();
  s.bakery.water = new Set(['0,0']); // water on the map, but nowhere near (40,40)
  const w = building(s, 'well', 0, 40, 40);
  tickTo(s, 1);
  assert.equal(w.dry, true);
  assert.equal(w.ratePerMin, 0);
  tickTo(s, 1 + 3 * W);
  assert.equal(water(s, 0), 0);
});

test('a spring Well alone: 5 a minute, one every twelve seconds', () => {
  const s = bare();
  s.bakery.springs = [[40, 40]];
  const w = building(s, 'well', 0, 40, 40);
  tickTo(s, 1);
  assert.equal(w.spring, true);
  assert.equal(w.rateTicks, SPRING_W, 'alone: twelve seconds between Water');
  assert.equal(w.ratePerMin, 5);
  tickTo(s, 1 + W);
  assert.equal(water(s, 0), 0, 'the first beat, at six seconds, does not draw');
  tickTo(s, 1 + SPRING_W);
  assert.equal(water(s, 0), 1, 'the second beat, at twelve seconds, draws');
});

test('a spring Well with a neighbour 2 apart keeps the halving: 2.9 a minute', () => {
  const s = bare();
  s.bakery.springs = [[40, 40]];
  const w = building(s, 'well', 0, 40, 40);
  building(s, 'well', 0, 42, 40);
  tickTo(s, 1);
  assert.equal(w.rateTicks, 2 * beat(0.75), 'the shared beat, then every second beat on top');
  assert.equal(tenth(w.ratePerMin), 2.9, '10 / 1.75 / 2');
});

test('a second Well placed later slows the first from its next beat on', () => {
  const s = bare();
  const a = building(s, 'well', 0, 40, 40);
  tickTo(s, 1 + W);
  assert.equal(water(s, 0), 1, 'alone at first: one Water at six seconds');
  building(s, 'well', 0, 42, 40);
  tickTo(s, 1 + W + 1);
  assert.equal(a.rateTicks, beat(0.75), 'recomputed on the next tick: a beat of 10.5 s now');
  tickTo(s, 1 + W + beat(0.75));
  assert.equal(water(s, 0), 2, 'the next beat comes one shared interval after the last draw');
});

test('the pantry cap is 6 plus 3 for each complete Toaster on that side', () => {
  const s = bare();
  assert.equal(pantryCapOf(s, 0), 6);
  building(s, 'toaster', 0, 44, 40, false);
  assert.equal(pantryCapOf(s, 0), 6, 'an unbuilt Toaster adds nothing');
  building(s, 'toaster', 1, 44, 44);
  assert.equal(pantryCapOf(s, 0), 6, 'an enemy Toaster adds nothing to my cap');
  assert.equal(pantryCapOf(s, 1), 9);
  building(s, 'toaster', 0, 44, 36);
  assert.equal(pantryCapOf(s, 0), 9);
  building(s, 'toaster', 0, 48, 40);
  assert.equal(pantryCapOf(s, 0), 12);
});

test('a full pantry stops the Well until a Toaster raises the cap', () => {
  const s = bare();
  const w = building(s, 'well', 0, 40, 40);
  s.toast.pantry[0].water = BAKERY.pantryCap;
  tickTo(s, 1 + W);
  assert.equal(water(s, 0), BAKERY.pantryCap, 'full at six: no draw');
  building(s, 'toaster', 0, 44, 40);
  tickTo(s, 1 + 2 * W);
  assert.equal(water(s, 0), BAKERY.pantryCap + 1, 'the new Toaster lets the next Water in');
  assert.equal(w.crowd, 0);
});

test('observeBakery lists each Well with its crowd, rate and water source, and the cap', () => {
  const s = bare();
  s.bakery.springs = [[40, 40]];
  s.bakery.water = new Set(['60,40']); // a creek tile far enough from the spring Well to leave it alone
  building(s, 'well', 0, 40, 40);
  building(s, 'well', 0, 58, 40);
  building(s, 'toaster', 0, 44, 44);
  tickTo(s, 1);
  const o = observeBakery(s, 0);
  assert.equal(o.pantryCap, 9);
  assert.equal(o.wells.length, 2);
  const spring = o.wells.find((w) => w.spring);
  assert.deepEqual({ crowd: spring.crowd, rateTicks: spring.rateTicks, ratePerMin: spring.ratePerMin, dry: spring.dry, spring: spring.spring },
    { crowd: 0, rateTicks: SPRING_W, ratePerMin: 5, dry: false, spring: true });
  const creek = o.wells.find((w) => !w.spring);
  assert.deepEqual({ crowd: creek.crowd, rateTicks: creek.rateTicks, ratePerMin: creek.ratePerMin, dry: creek.dry, spring: creek.spring },
    { crowd: 0, rateTicks: W, ratePerMin: 10, dry: false, spring: false });
  assert.deepEqual(o.dry, []);
});

test('a Well may not stand within six tiles of an enemy structure of any kind', () => {
  const s = bare();
  building(s, 'toaster', 1, 40, 40);
  assert.equal(wellPlaceReason(s, 0, 'well', 46, 46), 'too-close-enemy', 'six tiles off on both axes: refused');
  assert.equal(wellPlaceReason(s, 0, 'well', 43, 40), 'too-close-enemy');
  assert.equal(wellPlaceReason(s, 0, 'well', 40, 34), 'too-close-enemy', 'six tiles up');
  assert.equal(wellPlaceReason(s, 0, 'well', 47, 40), null, 'seven tiles off: fine');
  assert.equal(wellPlaceReason(s, 0, 'mill', 43, 40), null, 'the rule is for Wells only');
});

test('an unfinished enemy site counts, a destroyed enemy does not, and my own buildings never do', () => {
  const s = bare();
  building(s, 'mill', 1, 60, 60, false);
  assert.equal(wellPlaceReason(s, 0, 'well', 60, 54), 'too-close-enemy', 'a site is a structure');
  const gone = building(s, 'toaster', 1, 20, 20);
  gone.hp = 0;
  assert.equal(wellPlaceReason(s, 0, 'well', 20, 26), null, 'a destroyed enemy is not in the way');
  building(s, 'toaster', 0, 44, 40);
  assert.equal(wellPlaceReason(s, 0, 'well', 42, 40), null, 'my own buildings do not block a Well');
});

// A row with open ground at x, x + 3 and x + 7, so the build tests stand on passable tiles whatever the map's rocks are.
function openRun(s) {
  const free = (x, y) => isFree(s, x, y) && !s.structures.some((b) => b.x === x && b.y === y);
  for (let y = 20; y < s.height - 20; y++) for (let x = 20; x < s.width - 20; x++) {
    if (free(x, y) && free(x + 3, y) && free(x + 7, y)) return { x, y };
  }
  throw new Error('no open run of tiles on this map');
}

test('the build command refuses a Well within six tiles of an enemy and spends nothing', () => {
  const s = bare();
  const { x, y } = openRun(s);
  building(s, 'toaster', 1, x, y);
  const worker = s.units.find((u) => u.owner === 0 && u.kind === 'worker');
  s.shards[0] = 1000;
  applyCommands(s, 0, [{ type: 'build', unit: worker.id, kind: 'well', x: x + 3, y }]);
  assert.ok(s.events.some((e) => e.e === 'reject' && e.reason === 'too-close-enemy'), 'a reject with the reason');
  assert.equal(s.structures.filter((b) => b.kind === 'well').length, 0);
  assert.equal(s.shards[0], 1000, 'nothing spent');
});

test('the build command accepts a Well seven tiles from an enemy', () => {
  const s = bare();
  const { x, y } = openRun(s);
  building(s, 'toaster', 1, x, y);
  const worker = s.units.find((u) => u.owner === 0 && u.kind === 'worker');
  s.shards[0] = 1000;
  applyCommands(s, 0, [{ type: 'build', unit: worker.id, kind: 'well', x: x + 7, y }]);
  assert.equal(s.events.filter((e) => e.e === 'reject').length, 0, 'no reject');
  assert.equal(s.structures.filter((b) => b.kind === 'well').length, 1);
});
