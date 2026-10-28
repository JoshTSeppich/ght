// breakpoints: hits-to-kill from rowOf for every attacker, at Weapons and Armor levels 0 to 3 (BUILD-CARDS-W2 A3).
// Pins the table the script prints to the real formula: env/combat.mjs damagePerHit, with armor, tags, bonus,
// structureMultiplier and hits.ground/air all read from the actual rows (M2 Combat Scale), not a stand-in model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowOf } from '../env/stats.mjs';
import { damagePerHit } from '../env/combat.mjs';
import {
  ATTACKERS, TARGETS, COMMON_TARGETS, canHit, effectiveDamage, hitsToKill, breakpointTable, flaggedLevels,
} from '../scripts/breakpoints.mjs';

const TW = { ammo: true };

test('ATTACKERS is every shooter with a shot: the seven fighters, both armed flyers, and the Heat Lamp', () => {
  assert.deepEqual([...ATTACKERS].sort(), [
    'brute', 'crumpetBomber', 'dart', 'grunt', 'howler', 'lancer', 'spiker', 'turret', 'waffleWing', 'worker',
  ].sort());
  // The Crouton Kite is a true scout (DECISIONS.md 3): no `damage` field, so it never attacks.
  assert.ok(!ATTACKERS.includes('croutonKite'));
});

test('TARGETS is every unit kind plus the Heat Lamp as the one structure stand-in', () => {
  assert.ok(TARGETS.includes('croutonKite'));
  assert.ok(TARGETS.includes('turret'));
});

test('the three common targets are the Crumb, the Popper and the Zapper', () => {
  assert.deepEqual([...COMMON_TARGETS], ['worker', 'grunt', 'lancer']);
});

test('canHit matches each row\'s hits.ground/air: ground fighters cannot hit flyers, the Flak Popper and Heat Lamp can', () => {
  assert.equal(canHit('grunt', 'waffleWing'), false);
  assert.equal(canHit('grunt', 'worker'), true);
  assert.equal(canHit('spiker', 'waffleWing'), true);
  assert.equal(canHit('waffleWing', 'worker'), false);
  assert.equal(canHit('turret', 'waffleWing'), true);
});

test('effectiveDamage matches env/combat.mjs damagePerHit for a tag bonus, a structure and an armor floor', () => {
  // Zapper (lancer) vs Crumb (worker): Light bonus applies, no armor.
  const lancer = rowOf(TW, 'lancer'), worker = rowOf(TW, 'worker');
  assert.equal(effectiveDamage('lancer', 'worker', 0, 0), damagePerHit({
    base: lancer.shot.damage, bonus: lancer.bonus, tags: worker.tags, armor: worker.armor,
  }));
  assert.equal(effectiveDamage('lancer', 'worker', 0, 0), 30);
  // Four-Slice (brute) vs the Heat Lamp (turret): the structure multiplier applies, the Armored bonus does not.
  const brute = rowOf(TW, 'brute'), turret = rowOf(TW, 'turret');
  assert.equal(effectiveDamage('brute', 'turret', 0, 0), damagePerHit({
    base: brute.shot.damage * brute.structureMultiplier, bonus: brute.bonus, tags: [...turret.tags], armor: turret.armor,
  }));
  assert.equal(effectiveDamage('brute', 'turret', 0, 0), 71);
  // Crumb (worker) vs Four-Slice (brute): 2 damage minus 2 armor floors at the 0.5 minimum, never 0 or negative.
  assert.equal(effectiveDamage('worker', 'brute', 0, 0), 0.5);
});

test('hitsToKill is null when the attacker cannot hit the target\'s layer, otherwise ceil(hp / effective damage)', () => {
  assert.equal(hitsToKill('grunt', 'croutonKite'), null);
  assert.equal(hitsToKill('grunt', 'grunt', 0, 0), 10); // M2 Combat Scale "done when": Popper vs Popper, 8-12 hits
  assert.equal(hitsToKill('lancer', 'worker', 0, 0), 4);
  assert.equal(hitsToKill('brute', 'turret', 0, 0), 3);
  assert.equal(hitsToKill('worker', 'brute', 0, 0), 1440);
});

test('Weapons levels 0 to 3 take a Crumb against a Popper from 180 to 45 hits (Popper hp 180, GHT overlay)', () => {
  assert.deepEqual([0, 1, 2, 3].map((w) => hitsToKill('worker', 'grunt', w, 0)), [180, 90, 60, 45]);
});

test('Armor levels 1 to 3 cannot push a Crumb hit of 2 below the 1-damage ground-armor floor once already at 0.5', () => {
  // Crumb vs Four-Slice: 2 damage - 2 armor already floors at 0.5; more armor cannot lower it further.
  assert.deepEqual([0, 1, 2, 3].map((a) => hitsToKill('worker', 'brute', 0, a)), [1440, 1440, 1440, 1440]);
});

test('breakpointTable has one row per attacker and target with four Weapons and four Armor columns', () => {
  const rows = breakpointTable();
  assert.equal(rows.length, ATTACKERS.length * TARGETS.length);
  const row = rows.find((r) => r.attacker === 'grunt' && r.target === 'worker');
  assert.deepEqual(row.weapons, [6, 6, 6, 6]); // M2 Combat Scale: Crumb hp 120, Popper 20 damage, no armor on the Crumb
  assert.deepEqual(row.armor, [6, 7, 7, 8]);
  const noHit = rows.find((r) => r.attacker === 'grunt' && r.target === 'croutonKite');
  assert.deepEqual(noHit.weapons, [null, null, null, null]);
});

test('flaggedLevels lists only levels that leave every attacker on the common targets unchanged', () => {
  const flags = flaggedLevels(breakpointTable());
  // Recompute the rule independently, straight from hitsToKill, not from the table the script already built.
  const expected = [];
  for (const track of ['weapons', 'armor']) {
    for (let level = 1; level <= 3; level += 1) {
      const at = (l) => (track === 'weapons' ? [l, 0] : [0, l]);
      const moved = ATTACKERS.some((a) => COMMON_TARGETS.some((t) => {
        const [w, h] = at(level);
        const [pw, ph] = at(level - 1);
        return hitsToKill(a, t, w, h) !== hitsToKill(a, t, pw, ph);
      }));
      if (!moved) expected.push({ track, level, changes: 0 });
    }
  }
  assert.deepEqual(flags, expected);
  // DECISIONS.md 1: every upgrade level must change hits-to-kill against at least one common target.
  assert.deepEqual(flags, []);
});
