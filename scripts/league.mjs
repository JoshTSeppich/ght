// Bot league on the rules Joshua plays on /play (createPlayableState: cords, ammo, bakery, fences and Energy, so Windmills open tier 3): a round robin where every ordered pair plays, so each pairing runs with the spawns
// swapped (owner: AI Engineer). Writes reports/league/latest.json: per match the ending (timer endings counted), the tick of the
// first damage, the unit kinds each side used and the expansions (Extension Boxes) each side planted.
//   node scripts/league.mjs [--bots rush,expand,tech,turtle,normal,easy] [--seeds 3] [--min 15] [--jobs 4] [--out path] [--no-stalemate]
// Entrants: rush, expand, tech, turtle (players/toaster-hard), normal (toaster-sonnet), easy (toaster-easy).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { step, checkEnd } from '../env/sim.mjs';
import { observe } from '../env/state.mjs';
import { STATS } from '../env/stats.mjs';
import { createPlayableState } from '../play/toaster-play.mjs';

const HERE = fileURLToPath(import.meta.url);
export const HARD = ['rush', 'expand', 'tech', 'turtle'];
export const ENTRANTS = [...HARD, 'normal', 'easy', 'brutal'];

export async function makeBot(name, side, seed) {
  if (HARD.includes(name)) {
    const { createPlayer } = await import('../players/toaster-hard/bot.mjs');
    return createPlayer({ side, stats: STATS, seed, personality: name });
  }
  const dir = name === 'easy' ? 'toaster-easy' : name === 'brutal' ? 'toaster-brutal' : 'toaster-sonnet';
  const { createPlayer } = await import(`../players/${dir}/bot.mjs`);
  return createPlayer({ side, stats: STATS, seed });
}

const clone = (x) => JSON.parse(JSON.stringify(x));

/** One match. names = [side 0 entrant, side 1 entrant]. Returns a plain record. */
export async function playMatch(seed, names, { maxMin = 15, stalemate, startShards } = {}) {
  const state = createPlayableState(seed);
  if (stalemate !== undefined) state.stalemateRule = stalemate; // default: the match rules decide
  state.maxTicks = maxMin * 60 * 24;
  if (startShards !== undefined) state.shards = [startShards, startShards]; // tests only: a rich start shows every unit kind quickly
  const bots = await Promise.all([0, 1].map((s) => makeBot(names[s], s, seed)));
  const hp = new Map();
  const used = [new Set(), new Set()];
  const seenUnits = new Set();
  let firstDamage = null, refused = 0, cordLimits = 0, orders = 0;
  let result = null;
  while (!result) {
    const cmds = [0, 1].map((s) => bots[s].act(clone(observe(state, s))) || []);
    orders += cmds[0].length + cmds[1].length;
    // refused = commands the sim rejected; a cord-limit is a walk that ran out of cord (not a rejected command), counted apart
    for (const e of step(state, cmds)) {
      if (e.e === 'order-refused' || e.e === 'refused' || e.e === 'reject') refused++;
      else if (e.e === 'cord-limit') cordLimits++;
    }
    for (const u of state.units) {
      if (!seenUnits.has(u.id)) { seenUnits.add(u.id); used[u.owner].add(u.kind); }
    }
    if (firstDamage === null) {
      for (const x of [...state.units, ...state.structures]) {
        const was = hp.get(x.id);
        if (was !== undefined && x.hp < was) { firstDamage = state.tick; break; }
        hp.set(x.id, x.hp);
      }
      if (firstDamage === null && state.units.length < hp.size) {
        // something vanished before it was ever seen damaged
        const alive = new Set([...state.units, ...state.structures].map((x) => x.id));
        for (const id of hp.keys()) if (!alive.has(id)) { firstDamage = state.tick; break; }
      }
    }
    result = state.result ?? checkEnd(state);
  }
  const boxes = [0, 1].map((s) => state.power.points.filter((p) => p.owner === s && p.kind === 'extension').length);
  return {
    seed, sides: names, ticks: state.tick, minutes: +(state.tick / 1440).toFixed(2), reason: result.reason, winner: result.winner ?? null,
    timer: result.reason === 'timeout' || result.reason === 'stalemate', firstDamageTick: firstDamage,
    unitsUsed: used.map((s) => [...s].sort()), expansions: boxes, orders, refused, cordLimits,
  };
}

export function summarize(matches, bots) {
  const rows = {};
  for (const b of bots) rows[b] = { played: 0, wins: 0, losses: 0, draws: 0, timerEndings: 0, unitKinds: [], expansions: 0 };
  const kinds = {};
  for (const m of matches) {
    for (const s of [0, 1]) {
      const r = rows[m.sides[s]];
      if (!r) continue;
      r.played++;
      if (m.winner === null) r.draws++; else if (m.winner === s) r.wins++; else r.losses++;
      if (m.timer) r.timerEndings++;
      r.expansions += m.expansions[s];
      (kinds[m.sides[s]] ||= new Set());
      for (const k of m.unitsUsed[s]) kinds[m.sides[s]].add(k);
    }
  }
  for (const b of bots) rows[b].unitKinds = [...(kinds[b] || [])].sort();
  const damaged = matches.filter((m) => m.firstDamageTick !== null).map((m) => m.firstDamageTick).sort((a, b) => a - b);
  return {
    matches: matches.length, timerEndings: matches.filter((m) => m.timer).length,
    firstDamageMedianTick: damaged.length ? damaged[Math.floor(damaged.length / 2)] : null, byBot: rows,
  };
}

const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] : dflt; };

async function main() {
  const one = arg('one', null);
  if (one) { // child: --one seed,a,b
    const [seed, a, b] = one.split(',');
    console.log(JSON.stringify(await playMatch(Number(seed), [a, b], { maxMin: Number(arg('min', 15)), stalemate: process.argv.includes('--no-stalemate') ? false : undefined })));
    return;
  }
  const bots = arg('bots', ENTRANTS.join(',')).split(',');
  const seeds = arg('seeds', '3').split(',').map(Number);
  const maxMin = Number(arg('min', 15));
  const jobs = Math.max(1, Number(arg('jobs', 4)));
  const out = arg('out', fileURLToPath(new URL('../reports/league/latest.json', import.meta.url)));
  const plan = [];
  for (const seed of seeds) for (const a of bots) for (const b of bots) if (a !== b) plan.push([seed, a, b]); // both seatings of every pair
  const results = new Array(plan.length);
  let next = 0;
  const runOne = (p) => new Promise((resolve) => {
    const c = spawn(process.execPath, [HERE, '--one', p.join(','), '--min', String(maxMin), ...(process.argv.includes('--no-stalemate') ? ['--no-stalemate'] : [])]);
    let text = '';
    c.stdout.on('data', (d) => { text += d; });
    c.on('close', () => { try { resolve(JSON.parse(text.trim().split('\n').pop())); } catch { resolve({ seed: p[0], sides: [p[1], p[2]], error: text.slice(0, 200) }); } });
  });
  await Promise.all(Array.from({ length: jobs }, async () => {
    while (next < plan.length) { const i = next++; results[i] = await runOne(plan[i]); }
  }));
  const ok = results.filter((r) => !r.error);
  const report = { generated: 'league.mjs', maxMin, seeds, bots, errors: results.filter((r) => r.error), summary: summarize(ok, bots), matches: ok };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 1) + '\n');
  console.log(JSON.stringify(report.summary));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
