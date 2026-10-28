// Scripted opening on Wheatfield Valley (PLAYABLE.md items 15 and 24). Owner: haiku (Data analyst).
// The plan, for side 0 only (side 1 does nothing, so nothing attacks):
//   6 Crumbs farm the field nearest the Power Strip. One Crumb builds each thing in turn: Mill, Well, Toaster, then the
//   Assembly Line (Poppers come from there, not from the Strip), then 4 Poppers. A builder goes back to farming when its
//   building is done. Build spots are the nearest free tiles on the power network. On Wheatfield no creek is within a Well's reach of the Strip, so the Well draws from the home spring
//   (slow water); wellWater() reports which one it got.
// Deterministic: the same seed gives the same numbers. The Wheatfield map is fixed and the scripted play has no
// randomness, so every seed prints the same row (seeds are accepted for the day a map varies). Wheat per Crumb per
// minute is total wheat banked by the six Crumbs over the run divided by Crumb-minutes; it reads high (about 150)
// because the fields are close and a mine takes only 8 ticks.
//   node scripts/opening-sim.mjs [seed ...]      prints the table
//   node scripts/opening-sim.mjs --json [seed]   prints the raw metrics
import { step } from '../env/sim.mjs';
import { STATS } from '../env/stats.mjs';
import { structurePowered, BAKERY } from '../env/bakery.mjs';
import { flourCostOf } from '../env/research.mjs';
import { createToasterState } from '../play/toaster-play.mjs';

const TPS = STATS.clock.ticksPerSecond;
const SIDE = 0;
const CREW = 6;
const MINUTES = 8;
const BUILDS = ['mill', 'well', 'toaster', 'forge'];
const POPPERS = 4;
const PAID_BY = STATS.structures.mill.cost + STATS.structures.well.cost + STATS.structures.toaster.cost;

const eu = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The water a Well at (x, y) would draw from, as env/bakery.mjs waterAt decides it: 'creek' (fast) when water is within
 * BAKERY.wellReach tiles, else 'spring' (slow) when a map spring is, else null (dry).
 */
function wellWater(state, x, y) {
  const water = state.bakery?.water ?? new Set();
  const springs = state.bakery?.springs ?? [];
  const r = BAKERY.wellReach;
  for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) if (water.has(`${i},${j}`)) return 'creek';
  if (springs.some(([sx, sy]) => Math.max(Math.abs(sx - x), Math.abs(sy - y)) <= r)) return 'spring';
  return null;
}

function isFreeTile(state, x, y) {
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return false;
  if (state.rockSet?.has(`${x},${y}`)) return false;
  if (state.crystals.some((c) => c.x === x && c.y === y)) return false;
  if (state.structures.some((s) => s.x === x && s.y === y)) return false;
  return !state.units.some((u) => u.x === x && u.y === y);
}

/** The nearest free tile to the Strip that the building can stand on: powered, and by the creek for a Well. */
function siteFor(state, kind, core) {
  for (let r = 2; r <= 12; r++) {
    for (let y = core.y - r; y <= core.y + r; y++) {
      for (let x = core.x - r; x <= core.x + r; x++) {
        if (Math.max(Math.abs(x - core.x), Math.abs(y - core.y)) !== r) continue;
        if (!isFreeTile(state, x, y)) continue;
        if (!structurePowered(state, { owner: SIDE, kind, x, y })) continue;
        if (kind === 'well' && !wellWater(state, x, y)) continue;
        return { x, y };
      }
    }
  }
  return null;
}

/** The field tile nearest the Strip that still has wheat. */
function nearestField(state, core) {
  let best = null;
  for (const c of state.crystals) {
    if (!(c.amount > 0)) continue;
    if (!best || eu(c, core) < eu(best, core)) best = c;
  }
  return best;
}

/**
 * Runs one scripted opening and returns its metrics. The chat table and the test read the same object.
 * opts.minutes: how long to run at most (default 8). The run stops early once 4 Poppers are out.
 */
export function runOpening(seed = 1, opts = {}) {
  const minutes = opts.minutes ?? MINUTES;
  const state = createToasterState(seed);
  state.maxTicks = Math.ceil(minutes * 60 * TPS) + 1;
  const core = state.structures.find((s) => s.kind === 'core' && s.owner === SIDE);
  const crew = new Set(state.units.filter((u) => u.owner === SIDE && u.kind === 'worker').map((u) => u.id));

  const m = {
    seed,
    wheatGathered: 0, // wheat the crew brought home (deliver events)
    milled: 0, // wheat the Mill ground into flour
    affordable: {}, // kind -> first tick the balance (Wheat AND Flour) covered it while it was next in line
    flourReady: {}, // kind -> first tick the pantry held the Flour it costs (DECISIONS.md 2) while it was next in line
    flourAtForge: null, // Flour in the pantry the tick the Assembly Line first became affordable in Wheat
    placed: {}, // kind -> tick the build order was accepted
    done: {}, // kind -> tick the building was finished
    wellWater: null, // what the Well draws from: creek (fast), spring (slow) or null (dry)
    paidAt: null, // tick the crew had gathered the Mill + Well + Toaster cost (income only, the start wheat not counted)
    firstBake: null, // tick of the first toaster bake (not the Strip's pilot light)
    popperTicks: [], // tick each Popper came off the Assembly Line
    rejects: [],
    timeline: [], // one row per game minute: wheat in the bank, wheat gathered so far
    endTick: 0,
  };
  const sites = new Map(); // site id -> kind
  let planAt = 0; // index into BUILDS
  let builder = null; // { id, kind } while a Crumb is building
  let queued = 0; // Poppers queued on the Assembly Line and not yet out
  let minute = 0;

  while (state.tick < state.maxTicks && !state.result) {
    const tick = state.tick;
    const cmds = [];
    const mine = state.units.filter((u) => u.owner === SIDE && crew.has(u.id));

    // Idle Crumbs go to the nearest field. The builder stays on its site until it is done.
    const field = nearestField(state, core);
    for (const u of mine) {
      if (builder && u.id === builder.id) continue;
      if (!u.order && field) cmds.push({ type: 'gather', unit: u.id, x: field.x, y: field.y });
    }

    // Buildings, one at a time, in plan order.
    const kind = BUILDS[planAt];
    if (kind && !builder) {
      const cost = STATS.structures[kind].cost;
      const flour = state.toast.pantry[SIDE].flour;
      const flourOk = flour >= flourCostOf(kind);
      if (kind === 'forge' && m.flourAtForge === null && state.shards[SIDE] >= cost) m.flourAtForge = flour;
      if (m.flourReady[kind] === undefined && flourOk) m.flourReady[kind] = tick;
      if (m.affordable[kind] === undefined && state.shards[SIDE] >= cost && flourOk) m.affordable[kind] = tick;
      const site = state.shards[SIDE] >= cost && flourOk ? siteFor(state, kind, core) : null;
      const worker = mine.find((u) => !u.carrying && !(u.order && u.order.type === 'build')) || mine[0];
      if (site && worker) {
        cmds.push({ type: 'build', unit: worker.id, kind, x: site.x, y: site.y });
        if (kind === 'well') m.wellWater = wellWater(state, site.x, site.y);
        builder = { id: worker.id, kind };
      }
    }

    // Poppers, one at a time, once the Assembly Line stands. The next one is queued when the line is empty.
    const forge = state.structures.find((s) => s.owner === SIDE && s.kind === 'forge' && s.complete);
    if (!kind && forge && forge.queue.length === 0 && m.popperTicks.length + queued < POPPERS) {
      const cost = STATS.units.grunt.cost;
      const flourOk = state.toast.pantry[SIDE].flour >= flourCostOf('grunt');
      if (m.affordable.grunt === undefined && state.shards[SIDE] >= cost && flourOk) m.affordable.grunt = tick;
      if (state.shards[SIDE] >= cost && flourOk) {
        cmds.push({ type: 'train', building: forge.id, kind: 'grunt' });
        queued += 1;
      }
    }

    const events = step(state, [cmds, []]);

    for (const e of events) {
      if (e.e === 'reject' && e.player === SIDE) m.rejects.push({ tick, reason: e.reason, kind: e.command?.type });
      if (e.e === 'deliver' && crew.has(e.id)) m.wheatGathered += e.amount;
      if (m.paidAt === null && m.wheatGathered >= PAID_BY) m.paidAt = state.tick;
      if (e.e === 'mill' && e.player === SIDE) m.milled += e.wheat;
      if (e.e === 'bake' && e.player === SIDE && !e.pilot && m.firstBake === null) m.firstBake = tick;
      if (e.e === 'spawn' && e.unit && e.unit.owner === SIDE && e.unit.kind === 'grunt') {
        m.popperTicks.push(tick);
        queued -= 1;
      }
      if (e.e === 'spawn' && e.structure && e.structure.owner === SIDE) sites.set(e.structure.id, e.structure.kind);
      if (e.e === 'done' && sites.has(e.id)) {
        const done = sites.get(e.id);
        m.done[done] = state.tick;
        if (builder && builder.kind === done) builder = null; // back to the field
        if (BUILDS[planAt] === done) planAt += 1;
      }
    }
    if (builder && m.placed[builder.kind] === undefined) m.placed[builder.kind] = tick;

    if (state.tick % (60 * TPS) === 0) {
      minute += 1;
      m.timeline.push({ minute, wheat: state.shards[SIDE], gathered: m.wheatGathered });
    }
    if (m.popperTicks.length >= POPPERS) break;
  }

  m.endTick = state.tick;
  m.fourthPopper = m.popperTicks[POPPERS - 1] ?? null;
  m.wheatPerCrumbPerMin = m.wheatGathered / (CREW * (state.tick / TPS / 60));
  return m;
}

const sec = (t) => (t === null || t === undefined ? '-' : `${(t / TPS).toFixed(1)} s`);

/** The Markdown table the Economy Lead reads. Times are game seconds from the start. */
export function openingTable(runs) {
  const lines = [
    '| seed | wheat per Crumb per min | Mill affordable | Well affordable | Toaster affordable | Assembly Line affordable | first slice baked | 4th Popper |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const m of runs) {
    lines.push(`| ${m.seed} | ${m.wheatPerCrumbPerMin.toFixed(1)} | ${sec(m.affordable.mill)} | ${sec(m.affordable.well)} | ${sec(m.affordable.toaster)} | ${sec(m.affordable.forge)} | ${sec(m.firstBake)} | ${sec(m.fourthPopper)} |`);
  }
  const m = runs[0];
  lines.push('');
  lines.push(`Placed → finished (seed ${m.seed}): ${Object.keys(m.placed).map((k) => `${k} ${sec(m.placed[k])} → ${sec(m.done[k])}`).join(', ')}`);
  lines.push(`Wheat gathered: ${m.wheatGathered}; ground by the Mill: ${m.milled}; rejected orders: ${m.rejects.length}`);
  return lines.join('\n');
}

// CLI: node scripts/opening-sim.mjs [--json] [seed ...]
if (process.argv[1] && process.argv[1].endsWith('opening-sim.mjs')) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const seeds = args.filter((a) => a !== '--json').map(Number);
  const runs = (seeds.length ? seeds : [1]).map((s) => runOpening(s));
  console.log(json ? JSON.stringify(runs, null, 2) : openingTable(runs));
}
