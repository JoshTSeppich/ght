// tech-tree-doc: TECH-TREE.md is generated from env/stats.mjs (Toaster Wars tiers) and play/toaster-play.mjs; a stale file fails
// here (WELLS-TECH-TERRAIN.md T3). Owner: haiku. The script's --check mode is run for real, so `npm test` catches a doc that was not regenerated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { STATS, ECONOMY, UPGRADES, toasterName } from '../env/stats.mjs';
import { toasterTierOf } from '../env/tiers.mjs';
import { TOASTER_HOTKEYS } from '../play/toaster-play.mjs';
import { renderTechTreeDoc, labelOf, CARDS, clashesOnACard } from '../scripts/tech-tree-doc.mjs';

const script = fileURLToPath(new URL('../scripts/tech-tree-doc.mjs', import.meta.url));
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const doc = renderTechTreeDoc();
// The Toaster Wars tier table: every kind on each list, by tier.
const TIERS = [1, 2, 3].map((n) => ({ n, ...STATS.toasterTiers[n] }));
// The text from "## Tier n" up to the next "## " heading.
const tierSection = (n) => {
  const start = doc.indexOf(`## Tier ${n}`);
  assert.ok(start >= 0, `no Tier ${n} heading`);
  const end = doc.indexOf('\n## ', start + 1);
  return doc.slice(start, end < 0 ? undefined : end);
};

test('TECH-TREE.md is up to date (run: node scripts/tech-tree-doc.mjs)', () => {
  assert.equal(read('TECH-TREE.md'), doc);
});

test('--check exits 0 for the real file, and 1 for a stale copy', () => {
  const ok = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tech-tree-doc-'));
  const file = path.join(dir, 'TECH-TREE.md');
  fs.writeFileSync(file, 'old text\n');
  const stale = spawnSync(process.execPath, [script, '--check', '--file', file], { encoding: 'utf8' });
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /stale/);
  fs.writeFileSync(file, doc);
  const fresh = spawnSync(process.execPath, [script, '--check', '--file', file], { encoding: 'utf8' });
  assert.equal(fresh.status, 0, fresh.stderr);
});

test('the doc names the Toaster Wars gate of each tier, from the same table /play reads', () => {
  assert.ok(tierSection(1).includes('Needs nothing: open from the start.'), 'Tier 1');
  assert.ok(tierSection(2).includes(`${STATS.toasterTiers[2].needText}.`), 'Tier 2 gate');
  assert.ok(tierSection(3).includes(`${STATS.toasterTiers[3].needText}.`), 'Tier 3 gate');
});

test('the doc names no Driftfall tier rule that /play does not use (Holds, Foundry, Sanctum, Hangar)', () => {
  assert.doesNotMatch(doc, /Hold \d/);
  assert.doesNotMatch(doc, /Foundry|Sanctum|Hangar/);
});

test('the doc includes research on /play and names no Driftfall faction upgrade', () => {
  assert.match(doc, /## Research on \/play/);
  assert.match(doc, /Upgrade Tracks/);
  assert.match(doc, /Unit Researches/);
  // Check that faction-specific upgrades (coil, burrow) are not in the doc, but Toaster Wars upgrades are OK
  const factionUpgrades = UPGRADES.filter(u => u.faction && u.faction !== 'shared');
  for (const u of factionUpgrades) assert.ok(!doc.includes(u.name), `${u.name} is faction-specific research /play does not have`);
});

test('every tier unlock sits in the section of its own tier, with its hotkey where one exists', () => {
  for (const { n, unlocks } of TIERS) {
    const section = tierSection(n);
    for (const kind of unlocks) {
      assert.ok(section.includes(`| ${labelOf(kind)} |`), `${kind} missing from Tier ${n}`);
      if (TOASTER_HOTKEYS[kind]) assert.ok(section.includes(`| ${TOASTER_HOTKEYS[kind].toUpperCase()} |`), `${kind} hotkey`);
    }
  }
});

test('every Toaster Wars unit lands in the tier that toasterTierOf() gives it, and its Wheat cost is in that row', () => {
  for (const { unlocks } of TIERS) for (const kind of unlocks.filter((k) => Object.hasOwn(STATS.units, k))) {
    const section = tierSection(toasterTierOf(kind));
    assert.ok(section.includes(`| ${toasterName(kind)} |`), kind);
    assert.ok(section.includes(`${ECONOMY.units[kind].wheat} Wheat`), `${kind} cost`);
  }
});

test('the hotkeys-used-twice section reports only clashes within one card', () => {
  assert.deepEqual(clashesOnACard(TOASTER_HOTKEYS), [], 'the real cards repeat no key');
  assert.deepEqual(clashesOnACard({ mill: 'a', well: 'a' }, { c: ['mill', 'well'] }), [{ card: 'c', key: 'a', kinds: ['mill', 'well'] }]);
  assert.deepEqual(clashesOnACard({ mill: 'a', well: 'a' }, { c: ['mill'], d: ['well'] }), [], 'cross-card reuse is not a clash');
  assert.match(doc, /## Hotkeys used twice[\s\S]*\n(None\.|- \*\*)/);
});

test('the bread chain at the top is written from the bakery numbers', () => {
  const chain = doc.slice(doc.indexOf('## The bread chain'), doc.indexOf('## Tier 1'));
  const b = ECONOMY.bakery;
  assert.ok(chain.includes(`every ${b.millSeconds} s`), 'mill time');
  assert.ok(chain.includes(`${b.slicesPerBake} slices`), 'slices per bake');
  assert.ok(chain.includes(`every ${b.toasterSeconds} s`), 'toaster time');
  assert.ok(chain.includes(`${b.pantryCap} flour and ${b.pantryCap} water`), 'pantry base');
  assert.ok(chain.includes(`${b.pantryPerToaster} more for each complete Toaster`), 'pantry growth');
  assert.ok(chain.includes(`within ${b.wellReach} tiles`), 'well reach');
  assert.ok(chain.includes(`${b.wellCrowdRadius} tiles`), 'well crowd radius');
});

test('CARDS lists every grid kind that has a hotkey, once', () => {
  const listed = Object.values(CARDS).flat();
  assert.equal(new Set(listed).size, listed.length, 'a kind on two cards');
  for (const kind of ['mill', 'well', 'toaster', 'grunt', 'worker', 'fence', 'unplug', 'rings', 'pause', 'priority']) {
    assert.ok(listed.includes(kind), `${kind} is on no card`);
  }
});
