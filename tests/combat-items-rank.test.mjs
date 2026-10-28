// Ranks and items count in player fights, not only against camps (M2 item 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowOf } from '../env/stats.mjs';
import { enableAmmo } from '../env/ammo.mjs';
import { enableItems, effectiveRank } from '../env/items.mjs';
import { createTestState, findEntity } from '../env/state.mjs';
import { stepCombat } from '../env/combat.mjs';

const duel = ({ items = false, kills = 0, victimHp } = {}) => {
  const s = createTestState({ width: 30, height: 30, rocks: [], crystals: [], shards: [0, 0], units: [] });
  enableAmmo(s, {});
  if (items) enableItems(s);
  const hp = rowOf(s, 'grunt').hp;
  s.units.push(
    { id: 1, owner: 0, kind: 'grunt', x: 5, y: 5, hp, carrying: 0, kills, order: { type: 'attack', target: 2 } },
    { id: 2, owner: 1, kind: 'grunt', x: 8, y: 5, hp: victimHp ?? hp, carrying: 0, order: null },
  );
  stepCombat(s);
  return s;
};

test('a ranked attacker hits harder than an unranked one when items are on', () => {
  const plain = duel({ items: true });
  const ranked = duel({ items: true, kills: 3 });
  assert.equal(effectiveRank(ranked.units[0]), 1);
  const full = rowOf(plain, 'grunt').hp;
  assert.ok(full - findEntity(ranked, 2).hp > full - findEntity(plain, 2).hp);
});

test('with items off, kills change nothing', () => {
  const full = rowOf(duel(), 'grunt').hp;
  assert.equal(full - findEntity(duel({ kills: 3 }), 2).hp, full - findEntity(duel(), 2).hp);
});

test('a kill in a player fight earns the killer a kill when items are on', () => {
  const s = duel({ items: true, victimHp: 1 });
  assert.ok(!findEntity(s, 2), 'the victim is dead');
  assert.equal(s.units[0].kills, 1);
});
