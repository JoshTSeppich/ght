// Combat sandbox: equal-value armies (500, 1,000 and 2,000 Wheat) fight on open ground and at a choke.
// node scripts/sandbox.mjs
// Each side gets the same army: an equal Wheat share for every fighter, priced by ECONOMY (the /play prices). The fight
// runs the real sim step with real attack orders, so the sim does the pathing, the gap and the shooting. Supply is a big
// Power Strip store (enableAmmo stock), so the fight measures the army and the ground, not the kitchen.
// One run per setting: mirror armies still differ by the deploy order, so read the winner as one sample.
import { fileURLToPath } from 'node:url';
import { step } from '../env/sim.mjs';
import { createTestState } from '../env/state.mjs';
import { enableAmmo } from '../env/ammo.mjs';
import { ECONOMY } from '../env/stats.mjs';

export const ARMY_SIZES = Object.freeze([500, 1000, 2000]);
// The seven fighters on /play, Crumb to Bagel. The Heat Lamp is a turret and is not in an army.
export const FIGHTERS = Object.freeze(['worker', 'grunt', 'lancer', 'brute', 'howler', 'spiker', 'dart']);
export const LAYOUTS = Object.freeze(['open', 'choke']);

const WIDTH = 40;
const HEIGHT = 24;
const SUPPLY = 5000; // Power Strip store per side, big enough that no army runs dry in a fight
const DEFAULT_MAX_TICKS = 24 * 300; // five minutes at 24 ticks a second
const RETARGET_TICKS = 12; // half a second: how often idle units pick their nearest enemy again
const DEPLOY = { 0: { x0: 3, x1: 8 }, 1: { x0: WIDTH - 9, x1: WIDTH - 4 } };

// Equal share of the budget for every fighter, rounded down to whole units.
export function armyFor(wheat) {
  const share = wheat / FIGHTERS.length;
  return FIGHTERS.map((kind) => ({ kind, count: Math.floor(share / ECONOMY.units[kind].wheat) }));
}

export function layoutFor(name) {
  if (name === 'open') return { name, width: WIDTH, height: HEIGHT, rocks: [] };
  if (name === 'choke') {
    // A wall down the middle with a three-tile gap; the gap is the only way across.
    const midX = Math.floor(WIDTH / 2);
    const gapTop = Math.floor(HEIGHT / 2) - 1;
    const rocks = [];
    for (let y = 0; y < HEIGHT; y += 1) if (y < gapTop || y > gapTop + 2) rocks.push([midX, y]);
    return { name, width: WIDTH, height: HEIGHT, rocks };
  }
  throw new Error(`unknown layout ${name}`);
}

const valueOf = (kind) => ECONOMY.units[kind].wheat;
const sideCount = (state, side) => state.units.filter((u) => u.owner === side).length;
const sideValue = (state, side) => state.units.filter((u) => u.owner === side).reduce((sum, u) => sum + valueOf(u.kind), 0);

// Lays out one side's army on free tiles inside its deployment strip, front to back.
function deploy(side, army, rockSet) {
  const { x0, x1 } = DEPLOY[side];
  const free = [];
  for (let x = x0; x <= x1; x += 1) for (let y = 0; y < HEIGHT; y += 1) if (!rockSet.has(`${x},${y}`)) free.push([x, y]);
  const units = [];
  for (const { kind, count } of army) {
    for (let n = 0; n < count; n += 1) {
      const [x, y] = free[units.length];
      units.push({ owner: side, kind, x, y, carrying: 0, order: null });
    }
  }
  return units;
}

// The attack orders for this tick: every unit with no live target attacks the nearest enemy unit (ties go to the lower id).
function retarget(state) {
  const orders = [[], []];
  for (const u of state.units) {
    const target = u.order?.type === 'attack' ? state.units.find((t) => t.id === u.order.target) : null;
    if (target && target.owner !== u.owner) continue;
    let best = null;
    for (const e of state.units) {
      if (e.owner === u.owner) continue;
      const d = Math.max(Math.abs(e.x - u.x), Math.abs(e.y - u.y));
      if (!best || d < best.d || (d === best.d && e.id < best.e.id)) best = { e, d };
    }
    if (best) orders[u.owner].push({ type: 'attack', unit: u.id, target: best.e.id });
  }
  return orders;
}

// Runs one fight. winner is 0 or 1, or null for a draw (both sides gone together, or neither gone by the cap).
export function fight({ wheat, layout, maxTicks = DEFAULT_MAX_TICKS }) {
  const L = layoutFor(layout);
  const rockSet = new Set(L.rocks.map(([x, y]) => `${x},${y}`));
  const army = armyFor(wheat);
  // Ids alternate between the sides, so the combat step's id order does not hand one side the first shot every time.
  const [ours, theirs] = [deploy(0, army, rockSet), deploy(1, army, rockSet)];
  const units = ours.flatMap((u, i) => [u, theirs[i]]);
  const state = createTestState({ width: L.width, height: L.height, rocks: L.rocks, units });
  enableAmmo(state, { stock: SUPPLY });
  state.maxTicks = maxTicks;
  // Every RETARGET_TICKS each unit without a live target attacks the nearest enemy (the real attack order, so the sim
  // paths it through the gap on a choke and it fights from its own range). Units never stop to wait for each other.
  step(state, retarget(state));
  while (state.tick < maxTicks && sideCount(state, 0) > 0 && sideCount(state, 1) > 0) {
    step(state, state.tick % RETARGET_TICKS === 0 ? retarget(state) : [[], []]);
  }
  const [left, right] = [sideCount(state, 0), sideCount(state, 1)];
  const winner = left > 0 && right === 0 ? 0 : right > 0 && left === 0 ? 1 : null;
  return { winner, valueLeft: [sideValue(state, 0), sideValue(state, 1)], ticks: state.tick };
}

function printTable() {
  console.log('army    ground  winner  value left (0 / 1)   fight length');
  for (const layout of LAYOUTS) {
    for (const wheat of ARMY_SIZES) {
      const r = fight({ wheat, layout });
      const who = r.winner === null ? 'draw' : `side ${r.winner}`;
      const seconds = (r.ticks / 24).toFixed(1);
      console.log(`${String(wheat).padEnd(8)}${layout.padEnd(8)}${who.padEnd(8)}${String(r.valueLeft[0]).padStart(6)} / ${String(r.valueLeft[1]).padEnd(8)}${seconds} s`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) printTable();
