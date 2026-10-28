// GHT simulation loop (ENV-SPEC.md §8 and §9).
//
//   createMatch(seed)            -> fresh state at tick 0
//   step(state, [cmds0, cmds1])  -> the tick's events (state is mutated in place)
//   checkEnd(state)              -> { winner, reason, tick, value } or null
//
// Determinism: no Math.random, Date, timers or async here. Side order flips on
// odd ticks (§8 fairness rule); the id-order flip inside each phase is done by
// the phase module itself, reading state.tick.

import { createInitialState } from './state.mjs';
import { applyCommands } from './commands.mjs';
import { stepProduction, stepGathering } from './economy.mjs';
import { stepMovement } from './movement.mjs';
import { stepCombat } from './combat.mjs';
import { STATS, PACING, sideValue, valueOf, canonKind } from './stats.mjs';
import { applyRuleCommands, stepRulesPre, stepRulesPost, runProduction } from './sim-territory.mjs';

const DEFAULT_MAX_TICKS = 2000;

/** The tick limit (§9 step 3): STATS.match.maxTicks. A test state may carry its own `maxTicks` override. */
export function maxTicksOf(state) {
  if (state && Number.isInteger(state.maxTicks) && state.maxTicks > 0) return state.maxTicks;
  const fromStats = STATS.match && STATS.match.maxTicks;
  return Number.isInteger(fromStats) && fromStats > 0 ? fromStats : DEFAULT_MAX_TICKS;
}

/** Which side acts first on the tick being computed from `tick` (§8): side 0 on even ticks, side 1 on odd. */
export function sideOrder(tick) {
  return tick % 2 === 0 ? [0, 1] : [1, 0];
}

// Toaster names are aliases (env/stats.mjs ROSTER): { type: 'train', kind: 'popper' } means 'grunt'. Anything that is not
// a known name passes through unchanged, so the normal reject reasons still apply.
function withCanonKind(command) {
  if (!command || typeof command !== 'object' || typeof command.kind !== 'string') return command;
  const kind = canonKind(command.kind);
  return kind && kind !== command.kind ? { ...command, kind } : command;
}

/** Create a new match from a seed: the initial state at tick 0. */
// options.pacing (env/stats.mjs PACING): a tougher Core and the 3:00 shield, with slower timings. Off by default.
export function createMatch(seed, options = {}) {
  const state = createInitialState(seed);
  if (!Array.isArray(state.events)) state.events = [];
  if (state.result === undefined) state.result = null;
  if (options.pacing) {
    state.pacing = true;
    for (const s of state.structures) if (s.kind === 'core') s.hp = PACING.coreHp;
  }
  return state;
}

/**
 * Advance the state by one tick, running the six phases of §8 in order:
 * commands (side order flips on odd ticks), production, gathering, movement,
 * combat, then the tick counter and the end check. Returns the tick's events.
 */
export function step(state, commands) {
  state.events = [];
  const structIds = stalemateOn(state) ? new Set(state.structures.map((s) => s.id)) : null;

  const lists = Array.isArray(commands) ? commands : [];
  const perSide = [0, 1].map((p) => (Array.isArray(lists[p]) ? lists[p].map(withCanonKind) : []));

  // 1. Commands, one side then the other.
  for (const player of sideOrder(state.tick)) {
    applyCommands(state, player, applyRuleCommands(state, player, perSide[player]));
  }

  // 2. Production: training queues and construction sites. (Territory rules, only when on: Drift clock, claims, budget.)
  stepRulesPre(state);
  runProduction(state, stepProduction);

  // 3. Gathering: mining, delivery, retargeting.
  stepGathering(state);

  // 4. Movement.
  stepMovement(state);

  // 5. Combat: simultaneous damage, then deaths.
  stepCombat(state);

  // 6. Tick ends, then the end check.
  state.tick += 1;
  if (structIds) updateStalemate(state, structIds);
  state.result = checkEnd(state);
  if (!state.result) state.result = stepRulesPost(state);

  return state.events;
}

function coreOf(state, player) {
  // Structures are kept in id order; the first matching Core is the one.
  for (const s of state.structures) {
    if (s.kind === 'core' && s.owner === player) return s;
  }
  return null;
}

/**
 * The match-end check (DECISIONS.md #4): all buildings destroyed ⇒ the other side wins (`buildings`);
 * tick reached 60:00 ⇒ draw (`timeout`); stalemate countdown expires ⇒ scored end (`stalemate`).
 */
export function checkEnd(state) {
  const value = [sideValue(state, 0), sideValue(state, 1)];
  const tick = state.tick;

  // Check if all buildings of one side are destroyed
  const side0Buildings = state.structures.filter((s) => s.owner === 0);
  const side1Buildings = state.structures.filter((s) => s.owner === 1);
  if (side0Buildings.length === 0) return { winner: 1, reason: 'buildings', tick, value };
  if (side1Buildings.length === 0) return { winner: 0, reason: 'buildings', tick, value };

  if (tick >= maxTicksOf(state)) return scoredEnd(state, 'timeout', value, tick);
  if (state.stalemate && state.stalemate.endsAt !== null && tick >= state.stalemate.endsAt) return scoredEnd(state, 'stalemate', value, tick);

  return null;
}

// A scored end (timeout or stalemate): board score, then damage dealt to enemy buildings (state.buildingDamage, counted in
// env/combat.mjs), then the Wheat bank (it never decides a side that has more on the board), then a true draw.
function scoredEnd(state, reason, value, tick) {
  const score = [timeoutValue(state, 0), timeoutValue(state, 1)];
  const damage = [state.buildingDamage?.[0] ?? 0, state.buildingDamage?.[1] ?? 0];
  const bank = [state.shards[0], state.shards[1]];
  const by = [score, damage, bank].find((pair) => pair[0] !== pair[1]) ?? [0, 0];
  const winner = by[0] > by[1] ? 0 : by[1] > by[0] ? 1 : null;
  return { winner, reason, tick, value, score, damage };
}

/** Stalemate rule: 120 s with no structure damage, no unit kill and no new structure (income does not count) warns; 60 s later the match ends. */
export const STALEMATE = Object.freeze({ quietTicks: 24 * 120, countdownTicks: 24 * 60 });

// On for GHT (territory) matches; state.stalemateRule true or false overrides either way.
const stalemateOn = (state) => (state.stalemateRule === undefined ? !!state.territory : state.stalemateRule === true);

/**
 * Called once a tick after combat with the structure ids from before the tick. A hit on a structure, a death (a kill or a
 * lost building) or a structure that was not there before restarts the quiet clock and cancels a countdown.
 */
export function updateStalemate(state, idsBefore) {
  const st = (state.stalemate ||= { last: state.tick - 1, endsAt: null });
  const events = (state.events ||= []);
  const active = state.structures.some((s) => !idsBefore.has(s.id)) || events.some((e) => e.e === 'die' || (e.e === 'hit' && idsBefore.has(e.id)));
  if (active) {
    st.last = state.tick;
    if (st.endsAt !== null) {
      st.endsAt = null;
      events.push({ e: 'stalemate-clear' });
    }
  } else if (st.endsAt === null && state.tick - st.last >= STALEMATE.quietTicks) {
    st.endsAt = st.last + STALEMATE.quietTicks + STALEMATE.countdownTicks;
    events.push({ e: 'stalemate-warning', ticks: STALEMATE.countdownTicks, endsAt: st.endsAt });
  }
}

/**
 * What a side has on the board at a timeout: its units at cost, and the Core's remaining hp.
 * Building costs never count in scoring (DECISIONS.md #4); this closes the Heat Lamp stockpile exploit.
 * The wheat bank is not counted here.
 */
export function timeoutValue(state, player) {
  let total = 0;
  for (const u of state.units) if (u.owner === player) total += valueOf(u);
  // Only count Core hp, not other building costs
  const core = state.structures.find((s) => s.owner === player && s.kind === 'core');
  if (core) total += Math.max(0, core.hp ?? 0);
  return total;
}
