// Probe: why did a hungry Popper get resupplied in 0.1 s (sense.md row 8)? Real Toaster Wars state (createPlayableState),
// one Popper (kind grunt) emptied next to our Power Strip, one idle Crumb at the Strip, stock above the reserve.
// Prints every ammo event with its tick and the time since the Popper went hungry. Read-only: nothing in the repo is edited.
import { createPlayableState } from '../../play/toaster-play.mjs';
import { stepAmmo, unitState, ammoOf, addStock, AMMO_TUNING } from '../../env/ammo.mjs';
import { STATS } from '../../env/stats.mjs';

const TPS = STATS.clock.ticksPerSecond;
const state = createPlayableState(7);
const core = state.structures.find((s) => s.kind === 'core' && s.owner === 0);
const DIST = Number(process.argv[2] ?? 2); // tiles from the Strip to the Popper
const grunt = { id: 9001, owner: 0, kind: 'grunt', x: core.x + DIST, y: core.y, hp: 50, order: null, carrying: 0 };
const crumb = { id: 9002, owner: 0, kind: 'worker', x: core.x, y: core.y, hp: 40, order: null, carrying: 0 };
state.units.push(grunt, crumb);
addStock(state, 0, 10);
const events = [];
const origEmit = state.events;
const log = (label) => console.log(label);

// Step the ammo layer only (the same call the sim makes each tick, before combat); the full sim is not needed for the path.
stepAmmo(state);
state.ammo.slices[grunt.id] = 0;
const hungryAt = state.tick;
log(`start: grunt state=${unitState(state, grunt)} slices=${state.ammo.slices[grunt.id]} stock=${state.ammo.stock?.[0] ?? '?'} reserve=${AMMO_TUNING.reserve} crumb at core=${crumb.x},${crumb.y}`);
let resupplied = null;
for (let i = 0; i < 24 * 60 && resupplied === null; i++) {
  const before = state.events.length;
  stepAmmo(state);
  for (const e of state.events.slice(before)) {
    events.push({ tick: state.tick, ...e });
    if (e.e === 'run') log(`tick ${state.tick}: run ${e.id} crumb ${e.crumb} -> unit ${e.unit} carrying ${e.slices}`);
    if (e.e === 'resupply' || e.e === 'lifeline') resupplied = state.tick;
  }
  state.tick += 1;
}
const dt = resupplied === null ? null : ((resupplied - hungryAt) / TPS).toFixed(2);
log(`resupplied at tick ${resupplied} after ${dt ?? 'never'} s (lifeline interval is ${AMMO_TUNING.lifelineSeconds} s)`);
log(`events: ${events.map((e) => `${e.e}@${e.tick}`).join(' ') || 'none'}`);
log(`final: grunt state=${unitState(state, grunt)} slices=${state.ammo.slices[grunt.id]}`);
void origEmit; void ammoOf;
