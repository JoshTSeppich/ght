// Card 8 item 6: a saturation readout on the Power Strip panel, read from Economy's fieldSaturation (env/economy.mjs B4),
// so the HUD and the sim agree on what "saturated" means.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldSaturation } from '../env/economy.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { saturationLine } from '../play/hud-saturation.mjs';

test('a fresh GHT match shows the Crumbs, fields and percent that fieldSaturation reports', () => {
  const state = createToasterState(7);
  const f = fieldSaturation(state, 0);
  const html = saturationLine(state, 0);
  assert.ok(f.workers > 0 && f.fields > 0, 'the starting base has Crumbs and wheat in reach');
  assert.match(html, new RegExp(`${f.workers} Crumbs? on ${f.fields} wheat fields?`));
  assert.match(html, new RegExp(`${Math.round(f.saturation * 100)}%`));
  assert.match(html, new RegExp(`${f.capacity} open tiles`));
});

test('an empty reach shows nothing, not a 0% bar', () => {
  assert.equal(saturationLine({ units: [], crystals: [], structures: [], tick: 0 }, 0), '');
});

test('the readout is one line of HTML with no user text in it', () => {
  const html = saturationLine(createToasterState(3), 0);
  assert.match(html, /^<div class="sat"[^>]*>[^<]*<\/div>$/);
});
