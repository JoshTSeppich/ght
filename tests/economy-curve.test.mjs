// The target economy curve (PLAYABLE.md items 14, 16, 18, 19; ECONOMY.md "The target curve"). Owner: sonnet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ECONOMY, STATS } from '../env/stats.mjs';
import { upkeepPerMinute } from '../env/budget.mjs';
import { ENERGY } from '../env/energy.mjs';
import { createToasterState } from '../play/toaster-play.mjs';

test('one Mill per 3 Crumbs: about 25-30 Wheat in and 3 flour out a minute', () => {
  const pm = ECONOMY.perMinute;
  assert.ok(pm.millWheatIn >= 25 && pm.millWheatIn <= 30, `mill eats ${pm.millWheatIn}`);
  assert.equal(pm.millFlourOut, 3);
});

test('a first kitchen (Mill + Well + Toaster) is affordable from the start and cheap next to 6 Crumbs of income', () => {
  const kitchen = ECONOMY.buildings.mill.wheat + ECONOMY.buildings.well.wheat + ECONOMY.buildings.toaster.wheat;
  assert.ok(kitchen <= 250, `kitchen costs ${kitchen}`);
});

test('prices follow value: tougher or longer-reaching units never cost less than a Popper, Crumb stays 50', () => {
  const u = ECONOMY.units;
  assert.equal(u.worker.wheat, 50);
  assert.ok(u.grunt.wheat > u.worker.wheat, 'a fighter costs more than a Crumb');
  for (const k of ['brute', 'howler', 'dart']) assert.ok(u[k].wheat > u.grunt.wheat, `${k} costs more than a Popper`);
  assert.ok(u.lancer.wheat <= u.grunt.wheat, 'the glass-cannon Zapper is not dearer than the Popper');
  assert.ok(u.brute.wheat > u.howler.wheat, 'the 240 hp Four-Slice is the dearest');
});

test('upkeep is lower in Toaster Wars (5%), the classic budget keeps 10%, and the HUD sum agrees', () => {
  assert.equal(ECONOMY.upkeep.percentOfCostPerMinute, 5);
  assert.equal(STATS.upkeep.ratePerMinute, 0.1);
  const s = createToasterState(3);
  s.units.push({ id: 9001, owner: 0, kind: 'grunt', x: 1, y: 1, hp: 60, carrying: 0, order: null });
  const mine = upkeepPerMinute(s, 0).shards;
  assert.equal(mine, ECONOMY.units.grunt.wheat * 0.05);
});

test('the energy numbers in ECONOMY equal env/energy.mjs (Strip 2, Generator 2, Windmill 3, Dam 6, Toaster 2)', () => {
  const p = ECONOMY.power;
  assert.deepEqual(p.energyMade, ENERGY.make);
  assert.deepEqual(p.energyUsed, ENERGY.use);
  assert.deepEqual(p.energyCost, ENERGY.cost);
  assert.equal(p.fenceTilesPerEnergy, ENERGY.fenceTiles);
  assert.equal(p.energyMade.strip, 2);
  assert.equal(p.energyUsed.toaster, 2);
  assert.equal(p.energyMade.windmill, 3);
});

test('ECONOMY.md carries the target curve', async () => {
  const fs = await import('node:fs');
  const md = fs.readFileSync(new URL('../ECONOMY.md', import.meta.url), 'utf8');
  for (const part of ['0:00-2:00', '2:00-5:00', '5:00+', '12-16 min', 'Army limit']) assert.ok(md.includes(part), part);
});
