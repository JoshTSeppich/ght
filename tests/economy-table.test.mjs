// economy-table: ONE ECONOMY object holds every economy number; ECONOMY.md is generated from it (PLAYABLE.md item 1).
// Owner: sonnet. The table pins the numbers the rules use today; it must not change any of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ECONOMY, STATS, rowOf } from '../env/stats.mjs';
import { buildEconomy } from '../env/economy-table.mjs';
import { BAKERY } from '../env/bakery.mjs';
import { ammoOf, AMMO_TUNING } from '../env/ammo.mjs';
import { POWER, STATION } from '../env/power.mjs';
import { createTerritoryMatch } from '../env/sim-territory.mjs';
import { renderEconomyDoc } from '../scripts/economy-doc.mjs';
import { stationCost } from '../play/station-controls.mjs';

const T = STATS.clock.ticksPerSecond;
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('ECONOMY.md is up to date (run: node scripts/economy-doc.mjs)', () => {
  assert.equal(read('ECONOMY.md'), renderEconomyDoc(ECONOMY));
});

test('stats.mjs exports the same table that buildEconomy makes, frozen', () => {
  assert.deepEqual(ECONOMY, buildEconomy(STATS));
  assert.ok(Object.isFrozen(ECONOMY) && Object.isFrozen(ECONOMY.units.grunt));
});

test('unit and building costs and times equal what the rules play by', () => {
  for (const [kind, u] of Object.entries(ECONOMY.units)) {
    const row = rowOf({ ammo: {} }, kind);
    assert.equal(u.wheat, row.cost, kind);
    assert.equal(u.hp, row.hp, kind);
    assert.equal(u.trainSeconds, Math.round((row.trainTicks / T) * 100) / 100, kind);
    if (row.shot) assert.equal(u.shotEverySeconds, Math.round((row.shot.every / T) * 100) / 100, kind);
  }
  for (const [kind, s] of Object.entries(ECONOMY.buildings)) {
    const row = rowOf({ ammo: {} }, kind);
    assert.equal(s.wheat, row.cost, kind);
    assert.equal(s.buildSeconds, Math.round((row.buildTicks / T) * 100) / 100, kind);
  }
  assert.equal(ECONOMY.strip.hp, STATS.toaster.coreHp);
});

test('bakery numbers equal env/bakery.mjs', () => {
  const b = ECONOMY.bakery;
  assert.equal(b.wheatPerFlour, BAKERY.wheatPerFlour);
  assert.equal(b.millSeconds * T, BAKERY.millTicks);
  assert.equal(b.wellSeconds * T, BAKERY.wellTicks);
  assert.equal(b.toasterSeconds * T, BAKERY.toasterTicks);
  assert.equal(b.pilotSeconds * T, BAKERY.pilotTicks);
  for (const k of ['slicesPerBake', 'pantryCap', 'pantryPerToaster', 'wellReach', 'wellCrowdRadius', 'wellEnemyReach', 'springEvery', 'pilotFloor']) assert.equal(b[k], BAKERY[k], k);
  assert.deepEqual([b.wellCrowdRadius, b.wellEnemyReach, b.pantryPerToaster], [8, 6, 3]);
  assert.equal(ECONOMY.start.stripStack, BAKERY.startStack);
});

test('ammo and power numbers equal env/ammo.mjs and env/power.mjs', () => {
  for (const [kind, u] of Object.entries(ECONOMY.units)) {
    const armed = ammoOf(kind);
    if (kind === 'worker' || kind === 'croutonKite') { assert.equal(armed, null); continue; } // the Kite is a true scout, no weapon
    if (kind === 'dart') { assert.equal(STATS.units.dart.ammo, false); assert.equal(u.slicesPerShot, 0); continue; }
    assert.equal(u.slots, armed.slots, kind);
    assert.equal(u.slicesPerShot, armed.attack.slices, kind);
  }
  assert.equal(ECONOMY.ammo.crumbCarrySlices, AMMO_TUNING.crumbCarry);
  assert.equal(ECONOMY.ammo.stripReserveSlices, AMMO_TUNING.reserve);
  assert.deepEqual(ECONOMY.power.cordTiles, POWER.cord);
  for (const [k, c] of Object.entries(ECONOMY.power.stationWheat)) assert.equal(c, POWER.cost[k], k);
  for (const k of Object.keys(ECONOMY.power.stationReachTiles)) assert.equal(ECONOMY.power.stationReachTiles[k], POWER.range[k], k);
  assert.ok(STATION.pylon);
});

test('start resources and wheat per tile equal a real Toaster match', () => {
  const state = createTerritoryMatch(1, {});
  assert.equal(state.shards[0], ECONOMY.start.wheat);
  assert.equal(state.units.filter((u) => u.owner === 0).length, ECONOMY.start.crumbs);
  assert.equal(state.structures.filter((s) => s.owner === 0 && s.kind === 'core').length, ECONOMY.start.powerStrips);
  assert.equal(state.toast.stack[0], ECONOMY.start.stripStack);
  const amounts = new Set(state.crystals.map((c) => c.amount));
  assert.ok(amounts.has(ECONOMY.wheat.tileAmount));
  assert.ok(amounts.has(ECONOMY.wheat.tileAmount * ECONOMY.wheat.richMultiplier));
  assert.equal(ECONOMY.wheat.crumbCarryPerTrip, state.chain.handCarry ?? STATS.economy.hand.carry);
});

test('per-minute math (the economy lead\'s starting point)', () => {
  const pm = ECONOMY.perMinute;
  assert.deepEqual(
    [pm.wheatPerCrumb, pm.millWheatIn, pm.millFlourOut, pm.toasterSlicesOut, pm.wheatPerSlice, pm.popperSlicesWhileFighting, pm.popperWheatWhileFighting, pm.popperUpkeepWheat],
    [50, 30, 3, 48, 2.5, 13.3, 33.3, 3.75],
  );
});

test('the HUD and tooltips show ECONOMY numbers: card costs match, and their files hold no cost literals', () => {
  for (const [kind, u] of Object.entries(ECONOMY.units)) assert.equal(STATS.units[kind].cost, u.wheat, kind);
  for (const [kind, s] of Object.entries(ECONOMY.buildings)) assert.equal(STATS.structures[kind].cost, s.wheat, kind);
  for (const k of ['extension', 'pylon']) assert.equal(stationCost(k), ECONOMY.power.stationWheat[k], k);
  for (const file of ['play/hud.mjs', 'play/command-card.mjs', 'play/toaster-play.mjs', 'play/station-controls.mjs', 'play/input.mjs']) {
    const src = read(file);
    assert.doesNotMatch(src, /\bcost\s*[:=]\s*\d/, `${file} hard-codes a cost`);
  }
});

test('env/economy-table.mjs uses no Node-only globals (env runs in the browser)', () => {
  assert.doesNotMatch(read('env/economy-table.mjs'), /\b(Buffer|process|require)\b|from ['"]node:/);
});
