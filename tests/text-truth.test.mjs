// UX Writer (ROLE-CARDS section 9): every number and key the player reads matches the GHT rows, the
// GHT upkeep rate, the ammo rule and the active key profile. Evidence: reports/2026-10-26/verify-E-docs.md,
// verify-B-roster.md, web-M7-hud.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { STATS, rowOf } from '../env/stats.mjs';
import { BAKERY } from '../env/bakery.mjs';
import { ammoOf } from '../env/ammo.mjs';
import { tipFor, numbersOf } from '../play/hud-tips.mjs';
import { keyFor } from '../play/key-text.mjs';
import { HOTKEY_PROFILES } from '../play/toaster-play.mjs';
import { TUTORIAL_STEPS, tutorialSteps } from '../play/tutorial.mjs';
import { powerTitle } from '../play/hud-bar.mjs';
import { IDLE_KEY } from '../play/teach.mjs';
import { reasonText } from '../play/placement-ghost.mjs';
import { mountSoundControls } from '../play/toaster-sounds.mjs';

const TW = { ammo: {} }; // the GHT state shape rowOf() reads (env/stats.mjs rowOf)
const UNITS = ['worker', 'grunt', 'lancer', 'brute', 'howler', 'spiker', 'dart'];
const tipOf = (kind) => tipFor({ action: 'train', kind, key: 'x', cost: rowOf(TW, kind).cost });

test('tooltips: the Popper quotes its GHT shot, reach and upkeep, not the classic table', () => {
  const row = rowOf(TW, 'grunt');
  assert.equal(row.shot.damage, 20);
  const tip = tipOf('grunt');
  assert.match(tip, new RegExp(`${row.shot.damage} damage, reach ${row.range}`));
  assert.doesNotMatch(tip, /\b8 damage/);
  assert.match(tip, /Eats 3\.75 wheat a minute\./);
});

test('tooltips: every unit tip quotes the row rowOf() gives for it', () => {
  for (const kind of UNITS) {
    const row = rowOf(TW, kind);
    assert.match(tipOf(kind), new RegExp(`${row.hp} HP, ${row.shot.damage} damage, reach ${row.range}`), kind);
  }
});

test('tooltips: upkeep uses the GHT rate the sim charges (5 percent), not the default 10', () => {
  assert.equal(STATS.toaster.upkeepPercent, 5);
  assert.equal(numbersOf().upkeepPercent, STATS.toaster.upkeepPercent);
});

test('tooltips: the Popper says one slice every three shots, the figure ammo.mjs uses', () => {
  assert.equal(ammoOf('grunt').shotsPerSlice, 3);
  assert.match(tipOf('grunt'), /one slice every three shots/);
  assert.doesNotMatch(tipOf('grunt'), /one slice a shot/);
});

test('tooltips: the Flak Popper does not claim it hits anything that flies', () => {
  const tip = tipOf('spiker');
  assert.match(tip, /swarm/);
  assert.doesNotMatch(tip, /fl(y|ies)|air/i);
});

test('tooltips: the Broiler does not claim a weakness up close the sim does not have', () => {
  assert.doesNotMatch(tipOf('howler'), /brittle/i);
});

test('keys: fence, Windmill, Dam, Extension Box, attack-move and idle come from the active profile', () => {
  for (const profile of ['grid', 'classic']) {
    for (const action of ['fence', 'windmill', 'dam', 'extension', 'amove']) {
      assert.equal(keyFor(action, profile), HOTKEY_PROFILES[profile][action].toUpperCase(), `${profile} ${action}`);
    }
  }
  assert.equal(keyFor('fence', 'grid'), 'A');
  assert.equal(keyFor('windmill', 'grid'), 'C');
  assert.equal(keyFor('dam', 'grid'), 'V');
  assert.equal(keyFor('extension', 'grid'), 'Z');
  assert.equal(keyFor('amove', 'grid'), 'T');
  assert.equal(keyFor('extension', 'classic'), 'X');
  assert.equal(keyFor('amove', 'classic'), 'A');
  assert.equal(keyFor('idle', 'grid'), 'F1');
  assert.equal(keyFor('idle', 'classic'), 'F1');
  assert.equal(IDLE_KEY, 'F1', 'the coach names the key the game binds (app.mjs F1)');
});

test('keys: the tutorial copy names the keys of the profile it is read in', () => {
  const grid = tutorialSteps('grid');
  assert.match(grid.find((s) => s.id === 'boxes').body, /Extension Boxes \(Z\)/);
  assert.match(grid.find((s) => s.id === 'strip').body, /attack-move \(T\)/);
  const classic = tutorialSteps('classic');
  assert.match(classic.find((s) => s.id === 'boxes').body, /Extension Boxes \(X\)/);
  assert.match(classic.find((s) => s.id === 'strip').body, /attack-move \(A\)/);
  assert.deepEqual(TUTORIAL_STEPS, tutorialSteps('grid'), 'the default copy is the grid copy');
});

test('keys: the power tooltip names the Windmill and Dam keys of the default profile', () => {
  const tip = powerTitle({ used: 3, made: 10, shed: 0 }, 0);
  assert.match(tip, new RegExp(`Windmills \\(${keyFor('windmill', 'grid')}\\) and Dams \\(${keyFor('dam', 'grid')}\\)`));
  assert.doesNotMatch(tip, /\(N\)|\(D\)/);
});

test('mute label: names the backtick key in both states', async () => {
  const made = [];
  const doc = { body: { append() {} }, createElement() { const el = { style: {}, append() {} }; made.push(el); return el; } };
  let muted = false;
  const sounds = { getVolume: () => 0.5, isMuted: () => muted, setVolume() {}, setMuted() {}, toggleMute() {} };
  mountSoundControls(sounds, doc);
  const label = made[1];
  assert.equal(label.textContent, 'Sound (`)');
  muted = true;
  mountSoundControls(sounds, doc);
  assert.equal(made[4].textContent, 'Muted (`)');
  assert.doesNotMatch(`${label.textContent} ${made[4].textContent}`, /\(U\)/);
});

test('refusals: the three codes read as plain words, not raw tokens', () => {
  assert.equal(reasonText('too-close-enemy'), `Too close to an enemy building: stay more than ${BAKERY.wellEnemyReach} tiles away`);
  assert.equal(reasonText('needs-toaster'), 'Needs a Toaster first');
  assert.equal(reasonText('needs-power'), 'Needs a Windmill or Dam first');
  for (const code of ['too-close-enemy', 'needs-toaster', 'needs-power']) {
    assert.doesNotMatch(reasonText(code), /-|^[a-z]/, code);
  }
});
