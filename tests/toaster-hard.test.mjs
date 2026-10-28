// toaster-hard: four personalities (rush, expand, tech, turtle) on one single-file planner (owner: AI Engineer).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { observe } from '../env/state.mjs';
import { createPlayer, PERSONALITIES } from '../players/toaster-hard/bot.mjs';
import { HARD, summarize } from '../scripts/league.mjs';

const ALL_KINDS = ['grunt', 'lancer', 'spiker', 'brute', 'howler', 'dart'];

test('four personalities, each with a mix that names every fighting unit', () => {
  assert.deepEqual(Object.keys(PERSONALITIES).sort(), [...HARD].sort());
  for (const [name, p] of Object.entries(PERSONALITIES)) {
    for (const k of ALL_KINDS) assert.ok(p.mix[k] > 0, `${name} never trains ${k}`);
    assert.ok(p.pushTick > 0 && p.minArmy > 0 && p.build.length >= 8, `${name} has a plan`);
  }
  assert.ok(PERSONALITIES.rush.pushTick < PERSONALITIES.expand.pushTick);
  assert.ok(PERSONALITIES.expand.pushTick < PERSONALITIES.tech.pushTick);
  assert.ok(PERSONALITIES.tech.pushTick < PERSONALITIES.turtle.pushTick);
  assert.ok(PERSONALITIES.turtle.turrets > 0 && PERSONALITIES.rush.turrets === 0);
  assert.ok(PERSONALITIES.expand.workers > PERSONALITIES.rush.workers);
  assert.ok(PERSONALITIES.expand.chainNeedsForge === false);
});

test('a player has a name by personality and answers the opening observation with legal orders', () => {
  for (const personality of HARD) {
    const state = createToasterState(3);
    const bot = createPlayer({ side: 0, stats: STATS, seed: 3, personality });
    assert.equal(bot.name, 'toaster-hard-' + personality);
    const cmds = bot.act(JSON.parse(JSON.stringify(observe(state, 0))));
    assert.ok(cmds.length > 0 && cmds.every((c) => typeof c.type === 'string'), personality);
    assert.ok(cmds.some((c) => c.type === 'gather'), `${personality}: Crumbs go to wheat at once`);
  }
});

test('the bot file imports nothing (the referee sandbox reads only the player file)', () => {
  const text = readFileSync(new URL('../players/toaster-hard/bot.mjs', import.meta.url), 'utf8');
  assert.equal(/^\s*import\s/m.test(text), false);
});

test('league summary counts timer endings and units per bot', () => {
  const m = (reason, winner, a, b) => ({ sides: [a, b], reason, winner, timer: reason === 'stalemate' || reason === 'timeout', firstDamageTick: 100, unitsUsed: [['grunt'], ['lancer']], expansions: [3, 4] });
  const s = summarize([m('core', 0, 'rush', 'tech'), m('stalemate', 1, 'tech', 'rush')], ['rush', 'tech']);
  assert.equal(s.matches, 2);
  assert.equal(s.timerEndings, 1);
  assert.equal(s.byBot.rush.played, 2);
  assert.equal(s.byBot.rush.wins, 2);
  assert.equal(s.byBot.tech.losses, 2);
  assert.equal(s.byBot.tech.timerEndings, 1);
  assert.equal(s.firstDamageMedianTick, 100);
});
