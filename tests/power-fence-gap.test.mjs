// Documents an intended gap (haiku #748): a box can be PLACED up to its cord range from a station (extension 12,
// pylon 12-14 depending on the end) but a fence line only spans STATION link (8, a pylon pair 16). A box placed
// further than 8 tiles from the network can carry toasters (cord) but cannot be joined by a fence line to it.
// The cord is the leash; the fence is an optional wall. Gating placement on the fence reach would shorten every
// box lane from 12 to 8 tiles, so we keep the gap and pin it here so a change is deliberate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { POWER, STATION, linkReach } from '../env/power.mjs';

test('cord range is wider than fence link reach for extension boxes (intended)', () => {
  assert.ok(POWER.range.extension > STATION.extension.link, `${POWER.range.extension} vs ${STATION.extension.link}`);
  const strip = { kind: 'strip', x: 0, y: 0 }, box = { kind: 'extension', x: 12, y: 0 };
  assert.ok(Math.hypot(box.x - strip.x, box.y - strip.y) > linkReach(strip, box), 'a box at 12 has no fence line to the strip');
  assert.equal(linkReach(strip, box), 8);
});

test('a pylon pair still links at 16', () => {
  assert.equal(linkReach({ kind: 'pylon' }, { kind: 'pylon' }), 16);
});
