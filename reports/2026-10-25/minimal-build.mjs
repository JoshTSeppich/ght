// Probe: a scripted minimal build for our side (Mill, Well, Toaster, then 3 Poppers from an Assembly Line by 3:00), on the
// page's real match (createPlayableState, seed 7) against players/toaster-easy/bot.mjs. Our idle Crumbs auto-gather as the
// page does (play/app.mjs creates createIdleCrumbs for the human side). Read-only: nothing in the repo is edited.
// Prints when the first toast is baked (our side) and every tick-range where an enemy unit or structure hits ours.
// Usage: node reports/2026-10-25/minimal-build.mjs [seed]
import { makeMatch } from './lib.mjs';
import { createIdleCrumbs } from '../../play/idle-crumbs.mjs';
import { observeToaster } from '../../play/toaster-play.mjs';
import { structurePowered, BAKERY } from '../../env/bakery.mjs';
import { isFree } from '../../env/state.mjs';
import { STATS } from '../../env/stats.mjs';

const seed = Number(process.argv[2] ?? 7);
const TPS = STATS.clock.ticksPerSecond;
const THREE_MIN = 3 * 60 * TPS;
const m = await makeMatch({ seed, difficulty: 'easy', maxTicks: 21600 });
const s = m.d.state;
const idle = createIdleCrumbs({ side: 0 });
const core = s.structures.find((x) => x.kind === 'core' && x.owner === 0);
const spring = [...s.springs].sort((a, b) => Math.max(Math.abs(a[0] - core.x), Math.abs(a[1] - core.y)) - Math.max(Math.abs(b[0] - core.x), Math.abs(b[1] - core.y)))[0];

// The first free tile on rings around (cx, cy) that passes a test (default: free).
function spot(cx, cy, ok = () => true, maxR = 12) {
  for (let r = 2; r <= maxR; r++) for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || !isFree(s, x, y) || !ok(x, y)) continue;
    return { x, y };
  }
  return null;
}
const nearSpring = (x, y) => Math.max(Math.abs(x - spring[0]), Math.abs(y - spring[1])) <= BAKERY.wellReach;
const powered = (x, y) => structurePowered(s, { owner: 0, x, y });

const plan = [
  { kind: 'mill', cost: STATS.structures.mill.cost, at: () => spot(core.x + 3, core.y - 3) },
  { kind: 'well', cost: STATS.structures.well.cost, at: () => spot(spring[0], spring[1], nearSpring, 6) },
  { kind: 'toaster', cost: STATS.structures.toaster.cost, at: () => spot(core.x + 2, core.y + 2, powered, 8) },
  { kind: 'forge', cost: STATS.structures.forge.cost, at: () => spot(core.x - 3, core.y - 3) },
];
const log = [];
const note = (t) => { log.push(`${(m.d.state.tick / TPS).toFixed(1)} s: ${t}`); console.log(log.at(-1)); };
let next = 0, placed = {}, trained = 0, firstBake = null, pilotBakes = 0, ourHitsByEnemy = [];
let forgeId = null, builder = null;

await m.runTicks(21600 + 1, (tk) => {
  // our side: the idle Crumbs gather (the page's default), then our queued builds and trains
  const cmds = [...idle.tick(observeToaster(s, 0), new Map())];
  // one Crumb per site (a new build order replaces the builder's old one, so each site gets its own idle Crumb)
  // (idle Crumbs get gather orders from the idle hook, so "no order" is the wrong test; "not building" is the right one)
  const crumbs = s.units.filter((u) => u.owner === 0 && u.kind === 'worker' && !(u.order && u.order.type === 'build'));
  if (next < plan.length && s.shards[0] >= plan[next].cost && crumbs.length) {
    const p = plan[next];
    const at = p.at();
    if (at) {
      cmds.push({ type: 'build', unit: crumbs[0].id, kind: p.kind, x: at.x, y: at.y });
      placed[p.kind] = at; note(`queue ${p.kind} at ${at.x},${at.y} (cost ${p.cost}, wheat ${Math.floor(s.shards[0])})`);
      next++;
    }
  }
  const forge = s.structures.find((x) => x.kind === 'forge' && x.owner === 0 && x.complete);
  if (forge && !forgeId) { forgeId = forge.id; note('Assembly Line complete'); }
  if (forgeId && trained < 3 && s.shards[0] >= STATS.units.grunt.cost) {
    cmds.push({ type: 'train', building: forgeId, kind: 'grunt' }); trained += 1; note(`queue Popper ${trained}/3`);
  }
  m.d.queue(cmds);

  // events from the last tick: our first real bake, and enemy hits on our side
  for (const e of s.events ?? []) {
    if (e.e === 'bake' && e.player === 0 && !e.pilot && firstBake === null) { firstBake = s.tick; note(`FIRST TOAST baked (${e.slices} slices, stack ${e.stack})`); }
    if (e.e === 'bake' && e.player === 0 && e.pilot) pilotBakes += 1;
    // a hit event has the target id and the attacker id (env/combat.mjs); count hits where the target is ours and the attacker is theirs
    if (e.e === 'hit') {
      const target = s.units.find((u) => u.id === e.id) ?? s.structures.find((x) => x.id === e.id);
      const attacker = s.units.find((u) => u.id === e.by) ?? s.structures.find((x) => x.id === e.by);
      if (target?.owner === 0 && attacker?.owner === 1 && ourHitsByEnemy.length < 20) ourHitsByEnemy.push(s.tick);
    }
  }
  if (tk === THREE_MIN) note(`3:00 check: wheat ${Math.floor(s.shards[0])}, Poppers ${s.units.filter((u) => u.owner === 0 && u.kind === 'grunt').length}, structures ${s.structures.filter((x) => x.owner === 0).map((x) => x.kind + (x.complete ? '' : '(building)')).join(',')}`);
});

const enemy = (kind) => s.units.filter((u) => u.owner === 1 && u.kind === kind).length;
console.log('--- summary, seed', seed);
console.log('first toast baked at', firstBake === null ? 'never' : (firstBake / TPS).toFixed(1) + ' s');
console.log('pilot-light bakes (Strip, no kitchen needed)', pilotBakes);
console.log('enemy hits on our side (first 20 tick numbers)', ourHitsByEnemy.length ? ourHitsByEnemy.map((t) => (t / TPS).toFixed(1)).join(' ') : 'none');
console.log('ended', JSON.stringify(m.ended), 'final', (s.tick / TPS / 60).toFixed(2), 'min');
console.log('enemy units now', s.units.filter((u) => u.owner === 1).length, 'Poppers', enemy('grunt'), 'our Strip hp', s.structures.find((x) => x.kind === 'core' && x.owner === 0)?.hp);
m.stop();
