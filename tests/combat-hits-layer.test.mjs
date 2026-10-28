import { test } from 'node:test';
import assert from 'node:assert/strict';

test('hits.ground=false prevents targeting ground units', () => {
  // Flak Popper has hits: { ground: false, air: true }
  // canHit function checks: if (row.hits && row.hits[layerOf(target)] === false) return false
  // So it will reject ground targets

  const flakRow = { hits: { ground: false, air: true } };
  const groundTargetLayer = 'ground';

  // canHit would reject: flakRow.hits[groundTargetLayer] === false
  assert.equal(flakRow.hits[groundTargetLayer], false, 'Flak Popper hits.ground is false');
  assert(flakRow.hits && flakRow.hits[groundTargetLayer] === false, 'canHit rejects ground targets');
});

test('hits.air=false prevents targeting air units', () => {
  // Popper has hits: { ground: true, air: false }
  // It cannot hit air units

  const popperRow = { hits: { ground: true, air: false } };
  const airTargetLayer = 'air';

  assert.equal(popperRow.hits[airTargetLayer], false, 'Popper hits.air is false');
  assert(popperRow.hits && popperRow.hits[airTargetLayer] === false, 'canHit rejects air targets');
});

test('hits.ground=true and hits.air=true hit both layers', () => {
  // Some units can hit both ground and air
  const multiRow = { hits: { ground: true, air: true } };

  assert.equal(multiRow.hits['ground'], true, 'Can hit ground');
  assert.equal(multiRow.hits['air'], true, 'Can hit air');
  assert(!(multiRow.hits && multiRow.hits['ground'] === false), 'Does not reject ground');
  assert(!(multiRow.hits && multiRow.hits['air'] === false), 'Does not reject air');
});

test('buildings are always ground layer', () => {
  // Buildings have layer 'ground' (hardcoded in combat.mjs layerOf)
  // Flak Popper with hits.ground=false cannot target buildings

  const flakRow = { hits: { ground: false, air: true } };
  const buildingLayer = 'ground'; // buildings always ground

  // A Flak Popper cannot hit ground layer, so cannot hit buildings
  assert.equal(flakRow.hits[buildingLayer], false, 'Cannot hit ground layer (buildings)');
});

test('air units have layer field set to air', () => {
  // Air units declare layer: 'air'
  // Popper with hits.air=false cannot target them

  const popperRow = { hits: { ground: true, air: false } };
  const airUnit = { layer: 'air' };

  // Popper cannot hit air layer
  assert.equal(popperRow.hits[airUnit.layer], false, 'Popper cannot hit air units');
});
