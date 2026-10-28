import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSelectionPanel } from '../play/hud.mjs';
import { tipFor, numbersOf } from '../play/hud-tips.mjs';
import { STATS } from '../env/stats.mjs';
import { BAKERY } from '../env/bakery.mjs';

// WELLS-TECH-TERRAIN.md section 1: a selected Well shows its rate and who it shares the draw with; the tooltip explains it.
const tps = STATS.clock.ticksPerSecond;
const well = (over = {}) => ({ id: 1, kind: 'well', x: 10, y: 12, owner: 0, hp: 150, complete: true, queue: [], progress: 0, ...over });
const panelFor = (e, others = []) => renderSelectionPanel({ tick: 0, units: [], shards: [0, 0], structures: [e, ...others] }, [e], { side: 0 });

test('a lone Well shows Water 1 / 6 s and no crowd', () => {
  const html = panelFor(well());
  assert.match(html, /Water 1 \/ 6 s/);
  assert.doesNotMatch(html, /shared/);
});

// The crowd ring is BAKERY.wellCrowdRadius (8), not a literal: a Well at 6 tiles shares, one at 8 does not.
test('a Well with a neighbour in 6 tiles shares the draw: 1 / (1 + (1 - 6/8)) = 8 a minute, Water 1 / 7.5 s', () => {
  assert.match(panelFor(well(), [well({ id: 2, x: 10, y: 18, owner: 1 })]), /Water 1 \/ 7\.5 s, shared with 1/);
});

test('a Well eight tiles off (the crowd radius) is not shared', () => {
  const html = panelFor(well(), [well({ id: 2, x: 10, y: 20 })]);
  assert.match(html, /Water 1 \/ 6 s/);
  assert.doesNotMatch(html, /shared/);
});

test('a spring Well is slow: Water 1 / 12 s', () => {
  assert.match(panelFor(well({ spring: true })), /Water 1 \/ 12 s/);
});

test('a dry Well says there is no water in reach', () => {
  assert.match(panelFor(well({ dry: true })), /Dry: no water in reach/);
});

test('the sim fields crowd and rateTicks win when the sim supplies them', () => {
  assert.match(panelFor(well({ crowd: 2, rateTicks: 18 * tps })), /Water 1 \/ 18 s, shared with 2/);
});

test('an unfinished Well shows its build progress, not a rate', () => {
  const html = panelFor(well({ complete: false, progress: 0 }));
  assert.match(html, /Building 0%/);
  assert.doesNotMatch(html, /Water 1/);
});

test('the Well tooltip states the crowding rule in one line: 10 Water a minute alone; Wells within 8 tiles share', () => {
  assert.equal(numbersOf().well.crowdReach, BAKERY.wellCrowdRadius);
  assert.equal(BAKERY.wellCrowdRadius, 8);
  const tip = tipFor({ action: 'build', kind: 'well', key: 'w', cost: 50 });
  assert.match(tip, /10 Water a minute alone; Wells within 8 tiles share\./);
  assert.doesNotMatch(tip, /6 tiles/);
});
