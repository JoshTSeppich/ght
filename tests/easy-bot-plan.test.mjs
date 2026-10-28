// toaster-easy plan (AI card section 6, Haiku A): the opening by 2:00, a tier mix that includes every unit of each open tier,
// the first Power Strip attack between 6:00 and 8:00, and the pull-back below 0.7 of visible enemy army value.
// tests/toaster-easy.test.mjs keeps its own assertions; this file adds the card's rules without touching them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { step } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createToasterState } from '../play/toaster-play.mjs';
import { createPlayer as easy } from '../players/toaster-easy/bot.mjs';
import { createPlayer as normal } from '../players/toaster-sonnet/bot.mjs';

const MIN = 24 * 60; // ticks per minute
const SEEDS = (process.env.EASY_PLAN_SEEDS ?? '3,5,90').split(',').map(Number);
const MINUTES = Number(process.env.EASY_PLAN_MINUTES ?? 15);
const clone = (x) => JSON.parse(JSON.stringify(x));

// Plays one seeded match, easy against normal, and records what the easy side did.
function play(seed, easySide, minutes = MINUTES) {
  const state = createToasterState(seed);
  state.maxTicks = MIN * minutes;
  const bots = [0, 1].map((s) => (s === easySide ? easy : normal)({ side: s, stats: STATS, seed }));
  const rec = { builds: [], trains: [], rejects: [], stripAttacks: [], firstBuilt: new Map(), enemyCore: null, easySide };
  const enemyCore = () => state.structures.find((b) => b.kind === 'core' && b.owner === 1 - easySide);
  while (!state.result && state.tick < state.maxTicks) {
    const cmds = [0, 1].map((s) => bots[s].act(clone(observe(state, s))) || []);
    const mine = cmds[easySide];
    for (const c of mine) {
      if (c.type === 'build') rec.builds.push({ tick: state.tick, kind: c.kind });
      if (c.type === 'train') rec.trains.push({ tick: state.tick, kind: c.kind });
      if (c.type === 'attack' && rec.enemyCore && c.target === rec.enemyCore) rec.stripAttacks.push(state.tick);
    }
    if (!rec.enemyCore) rec.enemyCore = enemyCore()?.id ?? null;
    const events = step(state, cmds);
    for (const e of events) if (e.e === 'reject' && e.player === easySide) rec.rejects.push({ tick: state.tick, reason: e.reason, command: e.command });
    for (const s of state.structures) {
      if (s.owner !== easySide || !s.complete || rec.firstBuilt.has(s.kind)) continue;
      rec.firstBuilt.set(s.kind, state.tick);
    }
  }
  return { ...rec, state };
}

// Opening: a Mill, a Well and a Toaster placed by 2:00 (the card's "by 2:00").
for (const seed of SEEDS.slice(0, 2)) {
  test(`seed ${seed}: easy places a Mill, a Well and a Toaster by 2:00`, () => {
    const state = createToasterState(seed);
    state.maxTicks = 2 * MIN;
    const bots = [0, 1].map((s) => (s === 0 ? easy : normal)({ side: s, stats: STATS, seed }));
    while (state.tick < 2 * MIN && !state.result) {
      const cmds = [0, 1].map((s) => bots[s].act(clone(observe(state, s))) || []);
      step(state, cmds);
    }
    const kinds = new Set(state.structures.filter((s) => s.owner === 0).map((s) => s.kind));
    for (const k of ['mill', 'well', 'toaster']) assert.ok(kinds.has(k), `no ${k} placed by 2:00 (has ${[...kinds].join(', ')})`);
  });
}

// Tier mix: once the Toaster opens tier 2, the Assembly Line trains every tier-2 kind; once a Windmill or Dam stands, every tier-3 kind.
test('tier mix: every unit of each open tier is trained, and no order is refused', () => {
  const trained = new Set();
  for (const seed of SEEDS) {
    const r = play(seed, seed % 2);
    const tier2At = r.firstBuilt.get('toaster');
    const tier3At = Math.min(r.firstBuilt.get('windmill') ?? Infinity, r.firstBuilt.get('dam') ?? Infinity);
    assert.ok(tier2At !== undefined, `seed ${seed}: no Toaster finished`);
    for (const kind of ['grunt', 'lancer', 'spiker']) {
      assert.ok(r.trains.some((t) => t.kind === kind && t.tick >= tier2At), `seed ${seed}: no ${kind} trained after the Toaster opened tier 2`);
      trained.add(kind);
    }
    if (Number.isFinite(tier3At)) {
      for (const kind of ['brute', 'howler', 'dart']) {
        if (r.trains.some((t) => t.kind === kind && t.tick >= tier3At)) trained.add(kind);
      }
    }
    assert.deepEqual(r.rejects, [], `seed ${seed}: refused orders ${JSON.stringify(r.rejects.slice(0, 3))}`);
  }
  for (const kind of ['grunt', 'lancer', 'spiker', 'brute', 'howler', 'dart']) assert.ok(trained.has(kind), `${kind} never trained across seeds ${SEEDS}`);
});

// First attack on the Power Strip lands between 6:00 and 8:00.
for (const seed of SEEDS.slice(0, 2)) {
  test(`seed ${seed}: easy first attacks the enemy Power Strip between 6:00 and 8:00`, () => {
    const r = play(seed, seed % 2, 8.2);
    assert.ok(r.stripAttacks.length > 0, 'easy never ordered an attack on the enemy Power Strip');
    const first = r.stripAttacks[0];
    assert.ok(first >= 6 * MIN && first <= 8 * MIN, `first Strip attack at tick ${first} (${(first / MIN).toFixed(2)} min)`);
  });
}

// Pull back: a squad that is worth less than 0.7 of the enemy army it can see turns for home instead of attacking.
function obs({ tick, mine, foe }) {
  const core = (owner, x, y) => ({ id: 1000 + owner, owner, kind: 'core', x, y, hp: 2400, complete: true, queue: [] });
  const struct = (id, owner, kind, x, y) => ({ id, owner, kind, x, y, hp: 200, complete: true, queue: [] });
  const units = [...mine.map((u) => ({ ...u, owner: 0, hp: 60, carrying: null, order: null })), ...foe.map((u) => ({ ...u, owner: 1, hp: 60, carrying: null, order: null }))];
  return {
    tick, you: 0, width: 64, height: 64, rocks: [], crystals: [], wheat: [500, 500], shards: [500, 500],
    units,
    structures: [core(0, 10, 10), core(1, 52, 52), struct(2, 0, 'toaster', 14, 10), struct(3, 0, 'well', 10, 14), struct(4, 0, 'mill', 6, 10), struct(5, 0, 'forge', 14, 14)],
    kitchen: { toast: 12, flour: 0, water: 0, wells: [] },
    power: { points: [], refused: [], energy: null, cut: [] },
  };
}
const grunts = (ids, x, y) => ids.map((id) => ({ id, kind: 'grunt', x: x + (id % 3), y: y + (id % 2) }));

for (const [label, foeCount, expectAttack] of [['outnumbered', 12, false], ['ahead', 2, true]]) {
  test(`pull back: a squad of 6 Poppers ${label} (${foeCount} visible enemy Poppers) ${expectAttack ? 'attacks' : 'goes home'}`, () => {
    const bot = easy({ side: 0, stats: STATS, seed: 1 });
    const squadIds = [101, 102, 103, 104, 105, 106];
    const mine = grunts(squadIds, 24, 24);
    // Every enemy stands 7 tiles from the squad: all of them visible (VISION 7), none inside a home unit's 6-tile reach.
    const foe = Array.from({ length: foeCount }, (_, i) => ({ id: 201 + i, kind: 'grunt', x: 33, y: 24 + (i % 2) }));
    const tick = 8 * MIN + 10; // the squad goes out from the push tick (8:00 until Joshua moves it)
    bot.act(obs({ tick, mine, foe: [] })); // the first act forms the squad of six from the army
    const cmds = bot.act(obs({ tick: tick + 24, mine, foe }));
    const squadCmds = cmds.filter((c) => squadIds.includes(c.unit));
    const attacks = squadCmds.filter((c) => c.type === 'attack');
    if (expectAttack) assert.ok(attacks.length > 0, `squad should attack, got ${JSON.stringify(squadCmds)}`);
    else {
      assert.equal(attacks.length, 0, `squad should not attack ${foeCount} Poppers, got ${JSON.stringify(attacks)}`);
      assert.ok(squadCmds.some((c) => c.type === 'move'), 'squad should move home');
    }
  });
}

// Gating: the Assembly Line trains tier-2 kinds only with a complete Toaster, and tier-3 kinds only with power standing.
test('tier gate: no tier-2 train without a complete Toaster, no tier-3 train without power', () => {
  const noToaster = [{ id: 2, owner: 0, kind: 'toaster', x: 14, y: 10, hp: 10, complete: false, queue: [] }];
  const bot = easy({ side: 0, stats: STATS, seed: 1 });
  const base = obs({ tick: 9 * MIN, mine: [], foe: [] });
  base.structures = base.structures.filter((s) => s.kind !== 'toaster').concat(noToaster);
  const cmds = bot.act(base);
  assert.equal(cmds.filter((c) => c.type === 'train' && c.kind !== 'worker').length, 0, 'trained tier-2 without a Toaster');
  const open = obs({ tick: 9 * MIN, mine: [], foe: [] });
  const trains = easy({ side: 0, stats: STATS, seed: 1 }).act(open).filter((c) => c.type === 'train');
  assert.ok(trains.some((c) => ['grunt', 'lancer', 'spiker'].includes(c.kind)), `tier 2 open should train a tier-2 kind, got ${JSON.stringify(trains)}`);
  assert.ok(!trains.some((c) => ['brute', 'howler', 'dart'].includes(c.kind)), 'tier 3 must stay shut without power');
});
